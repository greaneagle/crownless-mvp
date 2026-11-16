/* Crownless battle simulation: waves, swings, blocks, AI, arrows, win/loss checks.
 * Touches the DOM only through CL.ui hooks so it can run under Node tests. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, dist, normalize } = CL.util;
  const { ARC, SWING, makeUnit, inArc, swingPhase, isCommitted, aim, move, push } = CL.units;

  // Time from one attack start to the next. Melee swings can't restart before SWING.total.
  const COOLDOWN = { hero: SWING.total, archer: 1.2, melee: 0.86 };
  const REACH = { hero: 67, melee: 48 };
  const ARROW = { speed: 240, life: 1.6, hitRadius: 19, maxRange: 245, aimHeight: 16 };
  const SHOT_FLASH = 0.2;
  const KNOCKBACK = 6;
  const INPUT_BUFFER = 0.1; // GDD §6: a press up to 100 ms before recovery ends still swings
  const WAVE_SIZES = [6, 8];
  const GUARD_SPEED = 0.65;
  const MAX_DT = 0.05;

  // AI distances (px). goal = stopping distance from destination.
  const AI = {
    archer: { chase: 145, followGoal: 98, followEngage: 205, followFight: 143, holdEngage: 218, holdFight: 150, fire: 225 },
    melee: { chase: 38, followGoal: 62, followEngage: 75, followFight: 37, holdEngage: 85, holdFight: 37, fire: 47 },
  };

  const game = () => CL.game;
  const opponentsOf = (u) => (u.team === 'enemy' ? [game().hero, ...game().allies] : game().enemies);
  const nearestAlive = (u, list) =>
    list.filter((v) => v?.alive).sort((a, b) => dist(u, a) - dist(u, b))[0];

  function startBattle() {
    const g = game();
    const c = CL.campaign;
    g.mode = 'battle';
    g.paused = false;
    g.t = 0;
    g.wave = 0;
    g.kills = 0;
    g.allies = [];
    g.enemies = [];
    g.arrows = [];
    g.effects = [];
    g.attackQueuedAt = null;
    g.group = 'infantry';
    g.orders = { infantry: 'follow', archer: 'hold' };
    g.hero = makeUnit(330, 270, 'ally', 'hero');
    g.hero.face = 'right';
    const nInf = Math.min(12, c.infantry);
    const nArch = Math.min(8, c.archer);
    for (let i = 0; i < nInf; i++) {
      g.allies.push(makeUnit(235 + (i % 3) * 42, 185 + Math.floor(i / 3) * 47, 'ally', 'infantry'));
    }
    for (let i = 0; i < nArch; i++) {
      g.allies.push(makeUnit(164 + (i % 3) * 40, 328 + Math.floor(i / 3) * 44, 'ally', 'archer'));
    }
    for (const a of g.allies) {
      a.holdX = a.x;
      a.holdY = a.y;
    }
    spawnWave();
    CL.ui.hideBattleOverlays();
    CL.diag.log('info', 'Battle begun', { infantry: nInf, archers: nArch });
  }

  function spawnWave() {
    const g = game();
    const art = CL.assets.enemyArt;
    g.wave++;
    const count = WAVE_SIZES[g.wave - 1] ?? WAVE_SIZES[WAVE_SIZES.length - 1];
    for (let i = 0; i < count; i++) {
      const x = rand(735, 887);
      const y = rand(91, 450);
      const e = makeUnit(x, y, 'enemy', i % 5 === 0 ? 'brute' : 'reaver');
      e.face = 'left';
      e.art = art[i % art.length];
      g.enemies.push(e);
    }
    CL.ui.message(`Enemy wave ${g.wave} / ${g.totalWaves}`);
    CL.diag.log('info', 'Enemy wave spawned', { wave: g.wave, enemies: count });
  }

  /**
   * Apply damage. A guarding target absorbs it entirely when the source is inside its
   * 120° shield arc (GDD §6); hits from behind or the flanks land.
   * Returns 'blocked' | 'hit' | 'down' | null.
   */
  function hit(target, damage, source) {
    const g = game();
    if (!target.alive) return null;
    if (target.guard && source && inArc(target, source, ARC.block)) {
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.2, color: '#f6daa6', kind: 'block' });
      return 'blocked';
    }
    target.hp = Math.max(0, target.hp - damage);
    target.flash = 0.14;
    if (source) push(target, source.x, source.y, KNOCKBACK);
    g.effects.push({
      x: target.x,
      y: target.y - 23,
      t: 0.35,
      color: target.team === 'ally' ? '#f4bb72' : '#f77864',
      kind: 'hit',
    });
    if (target.hp) return 'hit';
    target.alive = false;
    target.ground = true;
    target.downAt = g.t;
    target.swing = null;
    target.guard = false;
    if (target.team === 'enemy') g.kills++;
    CL.diag.log('info', 'Unit down', { role: target.role, team: target.team, id: target.id });
    return 'down';
  }

  /** Begin an attack if the unit is ready. Returns true when an attack started. */
  function startAttack(u) {
    if (!u.alive || u.attackCooldown > 1e-6 || u.swing) return false;
    if (u.role === 'archer') {
      u.attackCooldown = COOLDOWN.archer;
      u.shot = SHOT_FLASH;
      const target = nearestAlive(u, opponentsOf(u));
      if (target && dist(u, target) < ARROW.maxRange) {
        const [dx, dy] = normalize(target.x - u.x, target.y - u.y);
        game().arrows.push({ x: u.x, y: u.y - 20, dx, dy, team: u.team, life: ARROW.life, source: u, damage: u.damage });
      }
      return true;
    }
    // AI soldiers turn to their target as they wind up; the hero swings where they face.
    if (u.role !== 'hero' && u.target?.alive) aim(u, u.target);
    u.attackCooldown = u.role === 'hero' ? COOLDOWN.hero : COOLDOWN.melee;
    u.swing = { t: 0, hit: [] };
    return true;
  }

  /** During the active window, hit every opponent in reach and arc — each at most once per swing. */
  function resolveSwing(u) {
    const reach = u.role === 'hero' ? REACH.hero : REACH.melee;
    for (const v of opponentsOf(u)) {
      if (!v?.alive || u.swing.hit.includes(v.id)) continue;
      if (dist(u, v) > reach || !inArc(u, v, ARC.attack)) continue;
      u.swing.hit.push(v.id);
      hit(v, u.damage, u);
    }
  }

  function advanceSwing(u, dt) {
    if (!u.swing) return;
    u.swing.t += dt;
    const phase = swingPhase(u);
    if (phase === 'active') resolveSwing(u);
    else if (phase === null) u.swing = null;
  }

  function tickTimers(u, dt) {
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    u.shot = Math.max(0, u.shot - dt);
    u.flash = Math.max(0, u.flash - dt);
    if (u.alive) advanceSwing(u, dt);
  }

  function ai(u, dt) {
    if (!u.alive) return;
    tickTimers(u, dt);
    u.aiTimer -= dt;
    if (u.aiTimer <= 0) {
      u.aiTimer = rand(0.17, 0.41);
      u.target = nearestAlive(u, opponentsOf(u)) || null;
    }
    const target = u.target;
    if (!target) return;
    const p = u.role === 'archer' ? AI.archer : AI.melee;
    let dest = target;
    let goal = p.chase;

    if (u.team === 'ally') {
      const cmd = game().orders[u.role];
      if (cmd === 'follow') {
        dest = game().hero;
        goal = p.followGoal;
        if (dist(u, target) < p.followEngage) {
          dest = target;
          goal = p.followFight;
        }
      } else if (cmd === 'hold') {
        if (dist(u, target) < p.holdEngage) {
          dest = target;
          goal = p.holdFight;
        } else {
          dest = { x: u.holdX, y: u.holdY };
          goal = 5;
        }
      }
      // 'charge': chase the nearest enemy (defaults above).
    }

    const d = dist(u, dest);
    if (d > goal + 5) move(u, dest.x - u.x, dest.y - u.y, dt);
    else if (dest === target) aim(u, target);
    if (dist(u, target) < p.fire) startAttack(u);
  }

  /** Record an attack press so a tap during late recovery is not lost. */
  function queueAttack() {
    game().attackQueuedAt = game().t;
  }

  function updateHero(h, dt) {
    const g = game();
    const k = g.hold;
    tickTimers(h, dt);
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + g.joystick.x;
    const y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0) + g.joystick.y;
    // Block input cannot interrupt a committed swing (GDD §6); it takes effect in recovery.
    const blockInput = Boolean(g.blockHeld || k.ShiftLeft || k.ShiftRight);
    h.guard = h.alive && blockInput && !isCommitted(h);
    if (g.attackQueuedAt !== null && g.t - g.attackQueuedAt > INPUT_BUFFER) g.attackQueuedAt = null;
    if (!h.alive) return;
    if (x || y) {
      const old = h.speed;
      if (h.guard) h.speed *= GUARD_SPEED;
      move(h, x, y, dt);
      h.speed = old;
    }
    const wantsAttack = g.attackHeld || k.Space || g.attackQueuedAt !== null;
    if (wantsAttack && !h.guard && startAttack(h)) g.attackQueuedAt = null;
  }

  function updateArrows(h, dt) {
    const g = game();
    for (const a of g.arrows) {
      a.x += a.dx * ARROW.speed * dt;
      a.y += a.dy * ARROW.speed * dt;
      a.life -= dt;
      const targets = a.team === 'ally' ? g.enemies : [h, ...g.allies];
      for (const v of targets) {
        if (v.alive && Math.hypot(a.x - v.x, a.y - (v.y - ARROW.aimHeight)) < ARROW.hitRadius) {
          hit(v, a.damage, a.source);
          a.life = 0;
          break;
        }
      }
    }
    g.arrows = g.arrows.filter((a) => a.life > 0);
  }

  function update(dt) {
    const g = game();
    if (g.mode !== 'battle' || g.paused) return;
    dt = Math.min(dt, MAX_DT);
    g.t += dt;
    const h = g.hero;
    updateHero(h, dt);
    for (const u of [...g.allies, ...g.enemies]) ai(u, dt);
    updateArrows(h, dt);
    for (const e of g.effects) e.t -= dt;
    g.effects = g.effects.filter((e) => e.t > 0);

    if (g.enemies.every((e) => !e.alive)) {
      if (g.wave < g.totalWaves) {
        g.enemies = [];
        spawnWave();
      } else CL.party.endBattle(true);
    } else if (!h.alive && g.allies.every((a) => !a.alive)) CL.party.endBattle(false);
  }

  /** Select a unit group and/or issue an order to the selected group. */
  function order(group, cmd) {
    const g = game();
    if (group) g.group = group;
    if (cmd) {
      g.orders[g.group] = cmd;
      if (cmd === 'hold') {
        for (const a of g.allies.filter((a) => a.role === g.group && a.alive)) {
          a.holdX = a.x;
          a.holdY = a.y;
        }
      }
      CL.ui.message(`${g.group.toUpperCase()} — ${cmd.toUpperCase()}`);
      CL.diag.log('info', 'Command issued', { group: g.group, cmd });
    }
    CL.ui.showSelectedGroup(g.group);
  }

  CL.combat = {
    COOLDOWN,
    REACH,
    INPUT_BUFFER,
    startBattle,
    spawnWave,
    hit,
    startAttack,
    queueAttack,
    ai,
    update,
    order,
  };
})(typeof window !== 'undefined' ? window : globalThis);
