/* Crownless battle simulation: waves, swings, blocks, AI, arrows, win/loss checks.
 * Touches the DOM only through CL.ui hooks so it can run under Node tests. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, dist, normalize } = CL.util;
  const { ARC, SWING, makeUnit, inArc, swingPhase, isCommitted, aim, move, push } = CL.units;

  // Time from one melee attack start to the next (archers use their troop's ranged.cooldown).
  // Melee swings can't restart before SWING.total.
  const COOLDOWN = { hero: SWING.total, melee: 0.86 };
  const ARROW = { life: 1.6, hitRadius: 19, rangeSlack: 20, aimHeight: 16 };
  // A missed shot (1 - accuracy) is thrown off by 0.12–0.25 rad: enough to miss a standing target.
  const MISS_ANGLE = [0.12, 0.25];
  const SHOT_FLASH = 0.2;
  const KNOCKBACK = 6;
  const INPUT_BUFFER = 0.1; // GDD §6: a press up to 100 ms before recovery ends still swings
  const DEPLOY_CAP = { infantry: 12, archer: 8 };
  const DEFAULT_ENCOUNTER = 'captains_trial';
  const GUARD_SPEED = 0.65;
  const MAX_DT = 0.05;

  // AI distances (px). goal = stopping distance from destination.
  const AI = {
    archer: { chase: 145, followGoal: 98, followEngage: 205, followFight: 143, holdEngage: 218, holdFight: 150 },
    melee: { chase: 38, followGoal: 62, followEngage: 75, followFight: 37, holdEngage: 85, holdFight: 37 },
  };

  const game = () => CL.game;
  const opponentsOf = (u) => (u.team === 'enemy' ? [game().hero, ...game().allies] : game().enemies);
  const nearestAlive = (u, list) =>
    list.filter((v) => v?.alive).sort((a, b) => dist(u, a) - dist(u, b))[0];
  // Start a swing just inside reach; archers loose at their troop range.
  const fireRange = (u) => (u.ranged ? u.ranged.range : u.reach - 1);

  /** GDD §6: Damage = max(1, round(Raw × 100 / (100 + 4 × Armor))). */
  function mitigate(raw, armor) {
    return Math.max(1, Math.round((raw * 100) / (100 + 4 * (armor || 0))));
  }

  /** Deploy the hero plus healthy roster soldiers and start the encounter's first wave. */
  function startBattle(encounterId = DEFAULT_ENCOUNTER) {
    const g = game();
    const enc = CL.content.encounter(encounterId);
    g.encounter = enc.id;
    g.battleId = CL.campaign.battles + 1;
    g.totalWaves = enc.waves.length;
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
    const placed = { infantry: 0, archer: 0 };
    for (const s of CL.party.healthySoldiers()) {
      const role = CL.content.troop(s.troop).role;
      if (!(role in placed) || placed[role] >= DEPLOY_CAP[role]) continue;
      const i = placed[role]++;
      const [x, y] =
        role === 'infantry'
          ? [235 + (i % 3) * 42, 185 + Math.floor(i / 3) * 47]
          : [164 + (i % 3) * 40, 328 + Math.floor(i / 3) * 44];
      g.allies.push(makeUnit(x, y, 'ally', s.troop, s.id));
    }
    for (const a of g.allies) {
      a.holdX = a.x;
      a.holdY = a.y;
    }
    spawnWave();
    CL.ui.hideBattleOverlays();
    CL.diag.log('info', 'Battle begun', { encounter: enc.id, battleId: g.battleId, deployed: placed });
  }

  function spawnWave() {
    const g = game();
    const art = CL.assets.enemyArt;
    g.wave++;
    const wave = CL.content.encounter(g.encounter).waves[g.wave - 1];
    const troops = Object.entries(wave).flatMap(([id, n]) => Array(n).fill(id));
    troops.forEach((troopId, i) => {
      const e = makeUnit(rand(735, 887), rand(91, 450), 'enemy', troopId);
      e.face = 'left';
      e.art = art[i % art.length];
      g.enemies.push(e);
    });
    CL.ui.message(`Enemy wave ${g.wave} / ${g.totalWaves}`);
    CL.diag.log('info', 'Enemy wave spawned', { wave: g.wave, enemies: wave });
  }

  /**
   * Apply raw damage, reduced by the target's armor. A guarding target absorbs it entirely
   * when the source is inside its 120° shield arc (GDD §6); hits from behind or the flanks land.
   * Returns 'blocked' | 'hit' | 'down' | null.
   */
  function hit(target, raw, source) {
    const g = game();
    if (!target.alive) return null;
    if (target.guard && source && inArc(target, source, ARC.block)) {
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.2, color: '#f6daa6', kind: 'block' });
      return 'blocked';
    }
    target.hp = Math.max(0, target.hp - mitigate(raw, target.armor));
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
    if (u.ranged) {
      const r = u.ranged;
      u.attackCooldown = r.cooldown;
      u.shot = SHOT_FLASH;
      const target = nearestAlive(u, opponentsOf(u));
      if (target && dist(u, target) < r.range + ARROW.rangeSlack) {
        let [dx, dy] = normalize(target.x - u.x, target.y - u.y);
        if (Math.random() > r.accuracy) {
          const off = rand(MISS_ANGLE[0], MISS_ANGLE[1]) * (Math.random() < 0.5 ? -1 : 1);
          [dx, dy] = [dx * Math.cos(off) - dy * Math.sin(off), dx * Math.sin(off) + dy * Math.cos(off)];
        }
        game().arrows.push({ x: u.x, y: u.y - 20, dx, dy, speed: r.projectileSpeed, team: u.team, life: ARROW.life, source: u, damage: u.damage });
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
    for (const v of opponentsOf(u)) {
      if (!v?.alive || u.swing.hit.includes(v.id)) continue;
      if (dist(u, v) > u.reach || !inArc(u, v, ARC.attack)) continue;
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
    if (dist(u, target) < fireRange(u)) startAttack(u);
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
      a.x += a.dx * a.speed * dt;
      a.y += a.dy * a.speed * dt;
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
    INPUT_BUFFER,
    DEPLOY_CAP,
    mitigate,
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
