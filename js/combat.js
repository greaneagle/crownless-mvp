/* Crownless battle simulation: waves, attacks, AI, arrows, win/loss checks.
 * Touches the DOM only through CL.ui hooks so it can run under Node tests. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, dist, normalize } = CL.util;
  const { makeUnit, facingToward, aim, move } = CL.units;

  const ATTACK_ANIM = 0.31;
  const COOLDOWN = { hero: 0.49, archer: 1.2, melee: 0.86 };
  const REACH = { hero: 67, melee: 48 };
  const ARROW = { speed: 240, life: 1.6, hitRadius: 19, maxRange: 245, aimHeight: 16 };
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

  /** Apply damage, or absorb it entirely if the target is guarding toward the source. */
  function hit(target, damage, source) {
    const g = game();
    if (!target.alive) return;
    if (target.guard && source && facingToward(target, source)) {
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.2, color: '#f6daa6' });
      return;
    }
    target.hp = Math.max(0, target.hp - damage);
    target.flash = 0.14;
    g.effects.push({
      x: target.x,
      y: target.y - 23,
      t: 0.35,
      color: target.team === 'ally' ? '#f4bb72' : '#f77864',
    });
    if (!target.hp) {
      target.alive = false;
      target.ground = true;
      if (target.team === 'enemy') g.kills++;
      CL.diag.log('info', 'Unit down', { role: target.role, team: target.team, id: target.id });
    }
  }

  function doAttack(u) {
    if (!u.alive || u.attackCooldown > 0) return;
    u.attack = ATTACK_ANIM;
    u.attackCooldown = u.role === 'hero' ? COOLDOWN.hero : u.role === 'archer' ? COOLDOWN.archer : COOLDOWN.melee;
    const targets = opponentsOf(u);
    if (u.role === 'archer') {
      const target = nearestAlive(u, targets);
      if (target && dist(u, target) < ARROW.maxRange) {
        const [dx, dy] = normalize(target.x - u.x, target.y - u.y);
        game().arrows.push({ x: u.x, y: u.y - 20, dx, dy, team: u.team, life: ARROW.life, source: u, damage: u.damage });
      }
      return;
    }
    const reach = u.role === 'hero' ? REACH.hero : REACH.melee;
    for (const v of targets) {
      if (!v?.alive || dist(u, v) > reach) continue;
      if (facingToward(u, v)) {
        hit(v, u.damage, u);
        break; // one target per swing
      }
    }
  }

  function tickTimers(u, dt) {
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    u.attack = Math.max(0, u.attack - dt);
    u.flash = Math.max(0, u.flash - dt);
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
    if (dist(u, target) < p.fire) doAttack(u);
  }

  function updateHero(h, dt) {
    const g = game();
    const k = g.hold;
    tickTimers(h, dt);
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + g.joystick.x;
    const y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0) + g.joystick.y;
    h.guard = g.blockHeld || k.ShiftLeft || k.ShiftRight;
    if (!h.alive) return;
    if (x || y) {
      const old = h.speed;
      if (h.guard) h.speed *= GUARD_SPEED;
      move(h, x, y, dt);
      h.speed = old;
    }
    if ((g.attackHeld || k.Space) && !h.guard) doAttack(h);
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

  CL.combat = { startBattle, spawnWave, hit, doAttack, ai, update, order };
})(typeof window !== 'undefined' ? window : globalThis);
