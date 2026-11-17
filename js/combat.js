// @ts-check
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
  const DEPLOY_CAP = { infantry: 12, archer: 8, cavalry: 6 };
  // GDD §7: cavalry accelerate toward a target, pass through, and turn for another run.
  const CAVALRY = {
    rampSeconds: 0.8, // from half to full speed while charging straight
    chargeBonus: 1.2, // GDD §6 AttackModifier for a simple cavalry charge (AI only)
    chargeMomentum: 0.6, // momentum needed for the bonus
    passDistance: 22, // this close, the rider rides on through
    overrunSeconds: 0.6, // how long they keep going before wheeling round
    followRange: 180, // on Follow, engage enemies this close
    holdRange: 160, // on Hold, engage enemies this close
    followGap: 80, // otherwise stay this near the hero
  };
  /**
   * GDD §6 scaling: at most `activeCap` units fight at once (hero, companion, soldiers and enemies
   * together). Each side's share is fixed when the battle starts; the rest wait in reserve and step in
   * as others fall, a stack at a time. The cap is a setting (20 / 30 / 40) for slower phones.
   */
  const BATTLE = { activeCap: 40, capChoices: [20, 30, 40], stack: 3, minEnemies: 6 };
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
  /** Battle sounds: the hero's own are loudest, everyone else's quieter (js/audio.js rate-limits them). */
  const sound = (name, ...units) => CL.audio?.play(name, units.some((u) => u?.role === 'hero') ? 1 : 0.4);

  function mitigate(raw, armor) {
    return Math.max(1, Math.round((raw * 100) / (100 + 4 * (armor || 0))));
  }

  /** Deploy the hero plus healthy roster soldiers and start the encounter's first wave. */
  /** Start a battle from an encounter id (data/encounters.js) or a ready-made definition (a band). */
  /**
   * @param {any} [encounter] an encounter id or a ready-made definition
   * @param {{ plan?: any }} [opts] plan: a battle setup from the preparation screen (js/prep.js, V2-07)
   */
  function startBattle(encounter = DEFAULT_ENCOUNTER, opts = {}) {
    const g = game();
    const enc = typeof encounter === 'string' ? CL.content.encounter(encounter) : encounter;
    g.encounter = enc.id;
    g.encounterDef = enc;
    g.battleId = CL.campaign.battles + 1;
    if (!enc.practice) CL.encounter.beginIfClosed(); // a failed retreat keeps its encounter; a fresh battle starts one
    g.totalWaves = enc.waves.length;
    g.mode = 'battle';
    CL.audio?.onMode('battle'); // battles don't start through ui.changeMode, so tell the music here
    g.paused = false;
    g.t = 0;
    g.wave = 0;
    g.kills = 0;
    g.allies = [];
    g.enemies = [];
    g.arrows = [];
    g.effects = [];
    g.attackQueuedAt = null;
    g.allyReserve = [];
    g.enemyReserve = [];
    // A practice battle (the debug panel's stress test) brings its own soldiers and changes nothing.
    g.practice = Array.isArray(enc.practice) ? { started: performance.now(), frames: 0, sim: 0, draw: 0, worst: 0, peak: 0 } : null;
    g.group = 'infantry';
    g.orders = { infantry: 'follow', archer: 'hold', cavalry: 'charge' };
    // A ready-made arena (the debug camera test, PROTO-A) or a battle map from the content.
    g.battleMap = enc.mapDef || CL.arena.mapFor(enc.map || 'open_country');
    const anchor = g.battleMap.spawn.hero;
    g.hero = makeUnit(anchor.x, anchor.y, 'ally', 'hero');
    Object.assign(g.hero, CL.character.heroCombat()); // HP, damage, armor, shield from the character
    g.hero.face = 'right';
    // Share the field: the enemies get room for their biggest wave (up to half the cap), the
    // company the rest. Soldiers beyond their formation slots or that share wait in reserve.
    const soldiers = g.practice ? enc.practice.map((troop) => ({ troop, id: null })) : CL.party.healthySoldiers();
    const withMara = !g.practice && CL.companion.fit() ? 1 : 0;
    const biggestWave = Math.max(...enc.waves.map((w) => Object.values(w).reduce((a, b) => a + b, 0)));
    const enemyShare = Math.max(Math.min(biggestWave, Math.floor(BATTLE.activeCap / 2)), BATTLE.minEnemies);
    g.allyCap = Math.max(1 + withMara, Math.min(1 + withMara + soldiers.length, BATTLE.activeCap - enemyShare));
    g.enemyCap = BATTLE.activeCap - g.allyCap;
    const placed = { infantry: 0, archer: 0, cavalry: 0 };
    for (const s of soldiers) {
      const role = CL.content.troop(s.troop).role;
      if (!(role in placed)) continue;
      if (placed[role] >= DEPLOY_CAP[role] || 1 + withMara + g.allies.length >= g.allyCap) {
        g.allyReserve.push({ troop: s.troop, soldierId: s.id });
        continue;
      }
      const i = placed[role]++;
      const [x, y] =
        role === 'infantry'
          ? [anchor.x - 95 + (i % 3) * 42, anchor.y - 85 + Math.floor(i / 3) * 47]
          : role === 'archer'
            ? [anchor.x - 166 + (i % 3) * 40, anchor.y + 58 + Math.floor(i / 3) * 44]
            : [anchor.x - 210 + (i % 2) * 52, anchor.y - 120 + Math.floor(i / 2) * 56]; // cavalry on the left wing
      const u = makeUnit(x, y, 'ally', s.troop, s.id);
      CL.units.resolveObstacles(u); // form up around trees and walls
      g.allies.push(u);
    }
    // The companion fights beside the hero (GDD §10), with the infantry's orders.
    if (withMara) {
      const m = CL.companion.get();
      const u = makeUnit(anchor.x - 40, anchor.y + 34, 'ally', 'mercenary');
      Object.assign(u, CL.companion.combat(), { companion: m.id, frames: CL.companion.def(m.id).frames, role: 'infantry' });
      CL.units.resolveObstacles(u);
      g.allies.push(u);
    }
    for (const a of g.allies) {
      a.holdX = a.x;
      a.holdY = a.y;
    }
    if (opts.plan && !g.practice) CL.prep.place(g, opts.plan); // the chosen setup (V2-07)
    spawnWave();
    Object.assign(g, { overview: false, cameraFocus: null, scanIn: 0 });
    CL.camera.snap(g); // one-screen maps keep the camera at 0,0
    CL.tactics.scan(g, 0); // what the company can see from the start
    CL.ui.hideBattleOverlays();
    CL.diag.log('info', 'Battle begun', { encounter: enc.id, battleId: g.battleId, deployed: placed, reserve: g.allyReserve.length, cap: BATTLE.activeCap });
  }

  function spawnWave() {
    const g = game();
    const art = CL.assets.enemyArt;
    g.wave++;
    const wave = g.encounterDef.waves[g.wave - 1];
    const troops = Object.entries(wave).flatMap(([id, n]) => Array(n).fill(id));
    const room = enemyCapOf(g);
    for (const troopId of troops.slice(0, room)) addEnemy(g, troopId, art);
    g.enemyReserve = troops.slice(room);
    CL.ui.message(`Enemy wave ${g.wave} / ${g.totalWaves}${g.enemyReserve.length ? ` · ${g.enemyReserve.length} more waiting` : ''}`);
    CL.diag.log('info', 'Enemy wave spawned', { wave: g.wave, enemies: wave, reserve: g.enemyReserve.length });
  }

  const enemyCapOf = (g) => g.enemyCap ?? Number.POSITIVE_INFINITY; // older battle states have no cap
  const aliveCount = (list) => list.reduce((n, u) => n + (u.alive ? 1 : 0), 0);

  function addEnemy(g, troopId, art = CL.assets.enemyArt) {
    const box = g.battleMap.spawn.enemies;
    let [x, y] = [rand(box.x0, box.x1), rand(box.y0, box.y1)];
    for (let tries = 0; tries < 30 && CL.units.blocked(x, y); tries++) [x, y] = [rand(box.x0, box.x1), rand(box.y0, box.y1)];
    const e = makeUnit(x, y, 'enemy', troopId);
    CL.units.resolveObstacles(e);
    e.face = 'left';
    e.art = art[g.enemies.length % art.length];
    g.enemies.push(e);
    return e;
  }

  function addAlly(g, r) {
    const a = g.battleMap.spawn.hero;
    const u = makeUnit(a.x - 150 + rand(-30, 30), a.y + rand(-90, 90), 'ally', r.troop, r.soldierId);
    CL.units.resolveObstacles(u);
    u.face = 'right';
    u.holdX = u.x;
    u.holdY = u.y;
    g.allies.push(u);
    return u;
  }

  /**
   * Reserves step in as others fall: a stack at a time (or the last few), each side up to its
   * share of the field. Called every frame; cheap when nothing waits.
   */
  function reinforce(g) {
    const sides = [
      { reserve: g.enemyReserve, alive: aliveCount(g.enemies), cap: enemyCapOf(g), add: (t) => addEnemy(g, t), who: 'Enemy reserves' },
      { reserve: g.allyReserve, alive: (g.hero.alive ? 1 : 0) + aliveCount(g.allies), cap: g.allyCap ?? Number.POSITIVE_INFINITY, add: (r) => addAlly(g, r), who: 'Your reserves' },
    ];
    for (const s of sides) {
      if (!s.reserve?.length) continue;
      const free = s.cap - s.alive;
      if (free < Math.min(BATTLE.stack, s.reserve.length)) continue;
      const n = Math.min(free, s.reserve.length);
      for (const r of s.reserve.splice(0, n)) s.add(r);
      CL.ui.message(`${s.who}: ${n} join the fight${s.reserve.length ? ` (${s.reserve.length} still waiting)` : ''}`);
      CL.diag.log('info', 'Reinforcements', { side: s.who, joined: n, waiting: s.reserve.length });
    }
  }

  /**
   * Apply raw damage, reduced by the target's armor. A guarding target absorbs it entirely
   * when the source is inside its 120° shield arc (GDD §6); hits from behind or the flanks land.
   * Returns 'blocked' | 'hit' | 'down' | null.
   */
  function hit(target, raw, source) {
    const g = game();
    if (!target.alive) return null;
    if (target === g.hero && g.godMode) return 'blocked'; // debug panel
    if (target.guard && source && inArc(target, source, ARC.block)) {
      sound('block', target, source);
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.2, color: '#f6daa6', kind: 'block' });
      return 'blocked';
    }
    if (g.practice && g.practice.firstHit == null) g.practice.firstHit = g.t; // camera test: time to contact
    target.hp = Math.max(0, target.hp - mitigate(raw, target.armor));
    if (source && source.team !== target.team) {
      if (!target.hitBy) target.hitBy = new Set();
      target.hitBy.add(source);
    }
    target.flash = 0.14;
    if (source) push(target, source.x, source.y, KNOCKBACK);
    g.effects.push({
      x: target.x,
      y: target.y - 23,
      t: 0.35,
      color: target.team === 'ally' ? '#f4bb72' : '#f77864',
      kind: 'hit',
    });
    if (target.hp) {
      sound('hit', target, source);
      return 'hit';
    }
    sound('down', target, source);
    target.alive = false;
    target.ground = true;
    target.downAt = g.t;
    target.swing = null;
    target.guard = false;
    if (target.team === 'enemy') g.kills++;
    if (g.practice && g.practice.firstDown == null) g.practice.firstDown = g.t; // camera test: time to first blood
    if (source) source.kills = (source.kills || 0) + 1; // soldier XP for their own kills
    // Everyone else who wounded it earns an assist (soldiers' service records, V2-03).
    for (const u of target.hitBy || []) if (u !== source) u.assists = (u.assists || 0) + 1;
    target.hitBy = null;
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
      sound('bow', u);
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
    sound('swing', u);
    return true;
  }

  /** During the active window, hit every opponent in reach and arc — each at most once per swing. */
  function resolveSwing(u) {
    for (const v of opponentsOf(u)) {
      if (!v?.alive || u.swing.hit.includes(v.id)) continue;
      if (dist(u, v) > u.reach || !inArc(u, v, ARC.attack)) continue;
      u.swing.hit.push(v.id);
      hit(v, u.damage * (u.chargeBonus || 1), u);
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

  /** Move along a direction at a fraction of the unit's speed (charging cavalry). */
  function ride(u, dx, dy, dt, factor) {
    const s = u.speed;
    u.speed = s * factor;
    move(u, dx, dy, dt);
    u.speed = s;
  }

  function cavalryAi(u, dt) {
    tickTimers(u, dt);
    u.aiTimer -= dt;
    if (u.aiTimer <= 0 || (u.target && !u.target.alive)) {
      u.aiTimer = rand(0.17, 0.41);
      u.target = nearestAlive(u, opponentsOf(u)) || null;
    }
    u.momentum ??= 0;
    const target = u.target;
    const g = game();
    const cmd = u.team === 'ally' ? g.orders.cavalry : 'charge';
    // Hold and Follow keep the horsemen back until enemies come close.
    if (!target || (cmd === 'hold' && dist(u, target) > CAVALRY.holdRange) || (cmd === 'follow' && dist(u, target) > CAVALRY.followRange)) {
      u.momentum = 0;
      u.overrun = 0;
      const home = cmd === 'hold' ? { x: u.holdX, y: u.holdY } : g.hero;
      const gap = cmd === 'hold' ? 5 : CAVALRY.followGap;
      if (u.team === 'ally' && home && dist(u, home) > gap + 5) move(u, home.x - u.x, home.y - u.y, dt);
      return;
    }
    if (u.overrun > 0) {
      // Riding on through after the pass, then wheel round for another run.
      u.overrun -= dt;
      ride(u, u.runDir[0], u.runDir[1], dt, 0.5 + 0.5 * u.momentum);
      if (u.overrun <= 0) u.momentum *= 0.4;
      return;
    }
    const [dx, dy] = normalize(target.x - u.x, target.y - u.y);
    u.runDir = [dx, dy];
    const was = u.momentum;
    u.momentum = Math.min(1, u.momentum + dt / CAVALRY.rampSeconds);
    if (was < CAVALRY.chargeMomentum && u.momentum >= CAVALRY.chargeMomentum) sound('horse', u); // hooves at full gallop
    ride(u, dx, dy, dt, 0.5 + 0.5 * u.momentum);
    if (dist(u, target) < u.reach - 1 && !u.swing && u.attackCooldown <= 1e-6) {
      u.chargeBonus = u.momentum >= CAVALRY.chargeMomentum ? CAVALRY.chargeBonus : 1;
      startAttack(u);
    }
    if (dist(u, target) < CAVALRY.passDistance) u.overrun = CAVALRY.overrunSeconds;
  }

  function ai(u, dt) {
    if (u.role === 'cavalry' && u.alive) return cavalryAi(u, dt);
    if (!u.alive) return;
    tickTimers(u, dt);
    u.aiTimer -= dt;
    // Retarget at once when the current target falls, instead of swinging at a body.
    if (u.aiTimer <= 0 || (u.target && !u.target.alive)) {
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
    // GDD §6: blocking needs a shield equipped.
    h.guard = h.alive && blockInput && h.canBlock !== false && !isCommitted(h);
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
      if (CL.units.arrowBlocked(a.x, a.y)) {
        // GDD §6: arrows collide with terrain — trees, walls and crates stop them.
        a.life = 0;
        sound('thunk');
        g.effects.push({ x: a.x, y: a.y, t: 0.15, color: '#d9c8a2', kind: 'thunk' });
        continue;
      }
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
    if (g.mode !== 'battle' || g.paused || g.overview) return; // the tactical overview holds the battle still (V2-06)
    dt = Math.min(dt, MAX_DT);
    g.t += dt;
    const h = g.hero;
    updateHero(h, dt);
    for (const u of [...g.allies, ...g.enemies]) ai(u, dt);
    CL.units.separate([h, ...g.allies, ...g.enemies]); // bodies: crowd, but never stack on one spot
    updateArrows(h, dt);
    for (const e of g.effects) e.t -= dt;
    g.effects = g.effects.filter((e) => e.t > 0);
    reinforce(g);
    CL.tactics.scan(g, dt); // what the company can see (V2-06)
    CL.camera.follow(g, dt);

    // GDD §15 edge case: the battle only ends when no one is left waiting to step in.
    if (g.enemies.every((e) => !e.alive) && !g.enemyReserve?.length) {
      if (g.wave < g.totalWaves) {
        g.enemies = [];
        spawnWave();
      } else CL.party.endBattle(true);
    } else if (!h.alive && g.allies.every((a) => !a.alive) && !g.allyReserve?.length) CL.party.endBattle(false);
  }

  /** Change the active-unit cap (Settings / debug panel); takes effect from the next battle. */
  function setActiveCap(n) {
    if (!BATTLE.capChoices.includes(n)) return false;
    BATTLE.activeCap = n;
    CL.diag.log('info', 'Battle size set', { activeCap: n });
    return true;
  }

  /** Select a unit group and/or issue an order to the selected group. */
  function order(group, cmd) {
    const g = game();
    if (group) g.group = group;
    if (cmd && g.group === 'cavalry' && !g.allies.some((a) => a.role === 'cavalry' && a.alive)) {
      CL.ui.message('No cavalry in this battle'); // GDD §7: cavalry shown as unavailable
      return;
    }
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
    BATTLE,
    setActiveCap,
    reinforce,
    CAVALRY,
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
