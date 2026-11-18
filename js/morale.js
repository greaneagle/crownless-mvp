// @ts-check
/* Crownless battle morale (V2-08b; design §8.3): groups hold, waver, fall back, rout, and rally.
 *
 * Every group on both sides (the company's infantry, archers and cavalry; the enemy's the same) has a
 * cohesion from 0 to 100. It is worked out from what the soldiers can see, never rolled, so a player
 * can plan around it:
 *
 *   start 70
 *   − 60 × the share of the group lost (fallen or fled)       − 25 × the share of the whole side lost
 *   − 15 for each extra enemy per friend (up to −30)            − 25 × the share hit from the flank or
 *                                                                 behind in the last 3 s
 *   − 6 for each friend seen running nearby in the last 6 s (up to −24)
 *   + veterans: T2 +6, T3 +14 (the group's average)            + 10 when no enemy is close (regrouping)
 *   company only: + 12 with the hero close by, − 20 once the hero is down; supplies (camp morale) −10 to +4;
 *   and a Rally: + 30, fading over 20 s
 *
 * Cohesion moves toward that figure (down quickly, up slowly). The state follows it, with a small gap
 * so it doesn't flicker:
 *   hold      55 and up      fights as ordered
 *   waver     below 55       blows land a little lighter (× 0.85)
 *   fall back below 30       gives ground toward its own side, fighting only what reaches it
 *   rout      below 15       runs for its own edge of the field and leaves it
 *
 * Routing soldiers don't fight back. Pursuers can still cut them down (a real kill). Those who get
 * away leave the battle: an enemy who fled counts as beaten, but gives no kill credit and only half
 * the spoils of a kill; a soldier of yours who fled comes back to the company unhurt after the battle.
 * When every enemy left is running, the field is yours.
 *
 * Rally (R, or the Orders panel): the hero steadies every soldier of the company within 300 px,
 * turning back those who are running. Once every 30 s. The hero and the companion never rout. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const EVERY = 0.25; // seconds between morale updates
  const THRESH = { waver: 55, fallback: 30, rout: 15 };
  const GAP = 6; // hysteresis: recover only this far above a threshold
  const RATE = { down: 15, up: 5 }; // cohesion points per second
  const TERMS = {
    base: 70,
    groupLoss: 60,
    sideLoss: 25,
    outnumbered: 15,
    outnumberedMax: 30,
    flank: 25,
    flankSeconds: 3,
    routNearby: 6,
    routNearbyMax: 24,
    routRadius: 320,
    routSeconds: 6,
    tier: { T1: 0, T2: 6, T3: 14 },
    regroup: 10,
    regroupRadius: 190,
    heroNear: 12,
    heroRadius: 280,
    heroDown: 20,
    supply: { min: -10, max: 4 },
  };
  const RALLY = { radius: 300, cooldown: 30, bonus: 30, lasts: 20, floor: 50 };
  // V2-T2: an enemy group falling back that nobody comes near for this long gives up the field.
  const GIVE_UP = { seconds: 12, radius: 300 };
  const FLEE = { speed: 1.15, edge: 14, minSeconds: 4, clearSeconds: 3, clearRadius: 320, maxSeconds: 10, conceded: 2 };
  const WAVER_DAMAGE = 0.85;
  const GROUPS = ['infantry', 'archer', 'cavalry'];
  const LABEL = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' };
  const WORD = { hold: 'steady', waver: 'wavering', fallback: 'falling back', rout: 'routing' };

  const bounds = () => CL.game?.battleMap?.bounds || CL.units.BOUNDS;
  const listOf = (g, team) => (team === 'ally' ? g.allies : g.enemies);
  /** A unit that is part of a group's morale: soldiers on either side (not the hero, not the companion). */
  const inGroup = (u, role) => u.role === role && !u.companion && !u.outside; // helpers from outside keep their own counsel (V2-09)
  const standing = (u) => u.alive && !u.routing;

  const GIVE_GROUND = 160; // px a group falling back steps back toward its own side

  /**
   * Where a group falling back heads for: the company to just behind the hero; otherwise a spot a
   * short way back toward its own side from where the group stood when it began to give ground.
   * @param {any} g @param {Unit} u
   */
  function fallbackPoint(g, u) {
    const h = g.hero;
    if (u.team === 'ally' && h?.alive) return { x: h.x - 90, y: h.y };
    const to = g.morale?.[`${u.team}:${u.role}`]?.fallbackTo;
    if (to) return to;
    const b = bounds();
    return { x: Math.max(b.minX, Math.min(b.maxX, u.x + (u.team === 'ally' ? -GIVE_GROUND : GIVE_GROUND))), y: u.y };
  }

  /** The morale record for one group, made on first use. @param {any} g */
  function record(g, team, role) {
    g.morale ??= {};
    const key = `${team}:${role}`;
    g.morale[key] ??= { cohesion: null, target: null, state: 'hold', base: new Set(), rallyAt: -99 };
    return g.morale[key];
  }

  /** Strength a side can see: its standing soldiers (the hero counts double) plus reserves. @param {any} g */
  function strength(g, team) {
    let n = listOf(g, team).filter(standing).length;
    if (team === 'ally' && g.hero?.alive) n += 2;
    return n + ((team === 'ally' ? g.allyReserve : g.enemyReserve)?.length || 0);
  }

  /**
   * What a group's cohesion is heading for, part by part (for tests and the debug report).
   * @param {any} g @param {string} team @param {string} role
   * @returns {{ total: number, parts: Record<string, number> } | null} null when the group has nobody standing
   */
  function targetFor(g, team, role) {
    const rec = record(g, team, role);
    const list = listOf(g, team);
    const mine = list.filter((u) => inGroup(u, role) && rec.base.has(u.id));
    const up = mine.filter(standing);
    if (!up.length) return null;
    const lost = mine.length - up.length;
    // The whole side, every group's record counted together.
    let seen = 0;
    let gone = 0;
    for (const grp of GROUPS) {
      const r = record(g, team, grp);
      const all = list.filter((u) => inGroup(u, grp) && r.base.has(u.id));
      seen += all.length;
      gone += all.filter((u) => !standing(u)).length;
    }
    const foes = team === 'ally' ? g.enemies : [g.hero, ...g.allies];
    const cx = up.reduce((n, u) => n + u.x, 0) / up.length;
    const cy = up.reduce((n, u) => n + u.y, 0) / up.length;
    /** @type {Record<string, number>} */
    const parts = {};
    parts.base = TERMS.base;
    parts.groupLoss = -TERMS.groupLoss * (lost / mine.length);
    parts.sideLoss = seen ? -TERMS.sideLoss * (gone / seen) : 0;
    const ratio = strength(g, team === 'ally' ? 'enemy' : 'ally') / Math.max(1, strength(g, team));
    parts.outnumbered = -Math.min(TERMS.outnumberedMax, TERMS.outnumbered * Math.max(0, ratio - 1));
    const flanked = up.filter((u) => g.t - (u.flankedAt ?? -99) < TERMS.flankSeconds).length;
    parts.flank = -TERMS.flank * (flanked / up.length);
    const runs = (g.routEvents || []).filter((e) => e.team === team && g.t - e.t < TERMS.routSeconds && Math.hypot(e.x - cx, e.y - cy) < TERMS.routRadius).length;
    parts.routsNearby = -Math.min(TERMS.routNearbyMax, TERMS.routNearby * runs);
    parts.veterans = up.reduce((n, u) => n + (TERMS.tier[CL.content.troop(u.troop).tier] || 0), 0) / up.length;
    const close = up.some((u) => foes.some((f) => f && standing(f) && Math.hypot(f.x - u.x, f.y - u.y) < TERMS.regroupRadius));
    parts.regroup = close ? 0 : TERMS.regroup;
    if (team === 'ally') {
      const h = g.hero;
      parts.hero = h?.alive ? (Math.hypot(h.x - cx, h.y - cy) <= TERMS.heroRadius ? TERMS.heroNear : 0) : -TERMS.heroDown;
      const camp = CL.campaign?.morale;
      parts.supply = Number.isFinite(camp) && !g.practice ? Math.max(TERMS.supply.min, Math.min(TERMS.supply.max, ((camp - 70) / 30) * 8)) : 0;
      parts.rally = RALLY.bonus * Math.max(0, 1 - (g.t - rec.rallyAt) / RALLY.lasts);
    }
    const total = Math.max(0, Math.min(100, Object.values(parts).reduce((a, b) => a + b, 0)));
    return { total, parts };
  }

  /** The next state for a cohesion, from the current one (a small gap before recovering). */
  function stateFor(cohesion, current) {
    const level = { hold: 0, waver: 1, fallback: 2, rout: 3 };
    const raw = cohesion < THRESH.rout ? 'rout' : cohesion < THRESH.fallback ? 'fallback' : cohesion < THRESH.waver ? 'waver' : 'hold';
    if (level[raw] >= level[current]) return raw; // worse (or the same): at once
    // Better: only once clear of the threshold by GAP.
    if (current === 'waver') return cohesion >= THRESH.waver + GAP ? 'hold' : 'waver';
    if (current === 'fallback') return cohesion >= THRESH.fallback + GAP ? stateFor(cohesion, 'waver') : 'fallback';
    return raw;
  }

  /** A unit breaks and runs. @param {any} g @param {Unit} u */
  function startRout(g, u) {
    u.routing = true;
    u.routeT = 0;
    u.guard = false;
    u.swing = null;
    u.morale = 'rout';
    u.moraleMul = 1;
    g.routEvents ??= [];
    g.routEvents.push({ team: u.team, x: u.x, y: u.y, t: g.t });
  }

  /** A routing unit gets clear away: it leaves the battle (not a body on the ground). @param {any} g @param {Unit} u */
  function leave(g, u) {
    u.alive = false;
    u.routed = true;
    u.routing = false;
    u.ground = false;
    u.hitBy = null;
    if (u.team === 'enemy') g.routed = (g.routed || 0) + 1;
    else g.allyRouted = (g.allyRouted || 0) + 1;
    CL.diag.log('info', 'Unit fled the field', { team: u.team, role: u.role, id: u.id });
  }

  /**
   * A routing unit runs for its own edge of the field, away from the nearest enemy, and doesn't fight.
   * It leaves once it has reached the edge (after a few seconds there, so a Rally can still reach it),
   * once it is well clear of every enemy, or after a while regardless. @param {any} g @param {Unit} u
   */
  function flee(g, u, dt) {
    u.routeT = (u.routeT || 0) + dt;
    u.guard = false;
    u.swing = null;
    const b = bounds();
    const dir = u.team === 'ally' ? -1 : 1;
    const foes = u.team === 'ally' ? g.enemies : [g.hero, ...g.allies];
    let near = null;
    let nd = Number.POSITIVE_INFINITY;
    for (const f of foes) {
      if (!f || !standing(f)) continue;
      const d = Math.hypot(f.x - u.x, f.y - u.y);
      if (d < nd) [near, nd] = [f, d];
    }
    const away = near && nd < 200 ? Math.sign(u.y - near.y) * 0.5 : 0;
    const s = u.speed;
    u.speed = s * FLEE.speed;
    CL.units.move(u, dir, away, dt);
    u.speed = s;
    u.face = dir < 0 ? 'left' : 'right';
    u.momentum = 0;
    const atEdge = dir < 0 ? u.x <= b.minX + FLEE.edge : u.x >= b.maxX - FLEE.edge;
    const clear = nd > FLEE.clearRadius;
    if ((atEdge && u.routeT >= FLEE.minSeconds) || (clear && u.routeT >= FLEE.clearSeconds) || u.routeT >= FLEE.maxSeconds) leave(g, u);
  }

  /** What changed this update, for the message line. */
  function announce(team, role, from, to) {
    if (team === 'ally') {
      if (to === 'rout') CL.ui.message(`${LABEL[role]} are routing! Rally them (R)`);
      else if (to === 'fallback') CL.ui.message(`${LABEL[role]} are falling back`);
      else if (to === 'waver' && from === 'hold') CL.ui.message(`${LABEL[role]} are wavering`);
      else if (to === 'hold' && from !== 'hold') CL.ui.message(`${LABEL[role]} hold steady again`);
    } else if (to === 'rout') CL.ui.message(`The enemy ${{ infantry: 'infantry', archer: 'archers', cavalry: 'riders' }[role]} break and run`);
    CL.diag.log('info', 'Morale', { team, group: role, from, to });
  }

  /**
   * Update every group's cohesion and state (four times a second) and move routing units. Called by
   * combat.update each frame. @param {any} g
   */
  function update(g, dt) {
    for (const u of [...g.allies, ...g.enemies]) if (u.routing && u.alive) flee(g, u, dt);
    g.moraleIn = (g.moraleIn ?? 0) - dt;
    if (g.moraleIn > 0) return;
    const step = EVERY - g.moraleIn; // the time since the last update
    g.moraleIn = EVERY;
    g.routEvents = (g.routEvents || []).filter((e) => g.t - e.t < TERMS.routSeconds);
    /** @type {Record<string, string>} */
    const shown = {};
    for (const team of ['ally', 'enemy']) {
      const list = listOf(g, team);
      for (const role of GROUPS) {
        const rec = record(g, team, role);
        for (const u of list) if (inGroup(u, role) && standing(u)) rec.base.add(u.id);
        const t = targetFor(g, team, role);
        if (!t) {
          if (list.some((u) => inGroup(u, role) && u.alive && u.routing)) shown[`${team}:${role}`] = 'rout';
          continue;
        }
        rec.target = t.total;
        rec.cohesion = rec.cohesion == null ? t.total : t.total < rec.cohesion ? Math.max(t.total, rec.cohesion - RATE.down * step) : Math.min(t.total, rec.cohesion + RATE.up * step);
        const from = rec.state;
        rec.state = stateFor(rec.cohesion, from);
        if (rec.state !== from) announce(team, role, from, rec.state);
        const up = list.filter((u) => inGroup(u, role) && standing(u));
        // An enemy group falling back that nobody presses gives up the field (V2-T2: no stalemates).
        if (team === 'enemy' && rec.state === 'fallback') {
          const pressed = up.some((u) => [g.hero, ...g.allies].some((a) => a && standing(a) && Math.hypot(a.x - u.x, a.y - u.y) < GIVE_UP.radius));
          rec.alone = pressed ? 0 : (rec.alone || 0) + step;
          if (rec.alone >= GIVE_UP.seconds) {
            rec.state = 'rout';
            announce(team, role, 'fallback', 'rout');
          }
        } else rec.alone = 0;
        if (rec.state === 'fallback' && from !== 'fallback') {
          const b = bounds();
          const cx = up.reduce((n, u) => n + u.x, 0) / up.length;
          const cy = up.reduce((n, u) => n + u.y, 0) / up.length;
          rec.fallbackTo = { x: Math.max(b.minX, Math.min(b.maxX, cx + (team === 'ally' ? -GIVE_GROUND : GIVE_GROUND))), y: cy };
        }
        if (rec.state === 'rout') {
          for (const u of up) startRout(g, u);
          // Those who join later (reserves, the rallied) start afresh.
          Object.assign(rec, { cohesion: null, target: null, state: 'hold', base: new Set() });
          shown[`${team}:${role}`] = 'rout';
          continue;
        }
        for (const u of up) {
          u.morale = rec.state;
          u.moraleMul = rec.state === 'waver' ? WAVER_DAMAGE : 1;
        }
        shown[`${team}:${role}`] = rec.state;
      }
    }
    g.moraleState = shown;
    // Every enemy on the field running, nobody waiting to step in: they are gone in a moment, and the
    // next wave comes on (or, after the last, the field is yours).
    const foes = g.enemies.filter((e) => e.alive);
    if (foes.length && foes.every((e) => e.routing) && !g.enemyReserve?.length) {
      for (const e of foes) if (e.routeT >= FLEE.conceded) leave(g, e);
      if (!g.concededNote && g.wave >= g.totalWaves) {
        g.concededNote = true;
        CL.ui.message('The enemy flees the field');
      }
    }
  }

  /** A group's morale word for the Orders panel ('' when steady). @param {any} g */
  function word(g, team, role) {
    const s = g.moraleState?.[`${team}:${role}`];
    return s && s !== 'hold' ? WORD[s] : '';
  }

  /** Seconds until the hero can rally again (0 when ready). @param {any} g */
  const rallyIn = (g) => Math.max(0, (g.rallyReadyAt ?? 0) - g.t);

  /**
   * The hero rallies the company: every soldier within reach steadies, and those running turn back.
   * Once every RALLY.cooldown seconds. Returns how many soldiers it reached, or false when it can't.
   * @param {any} g
   */
  function rally(g) {
    if (g.mode !== 'battle' || g.paused || g.overview) return false;
    const h = g.hero;
    if (!h?.alive) {
      CL.ui.message('The hero is down: nobody to rally them');
      return false;
    }
    const wait = rallyIn(g);
    if (wait > 0) {
      CL.ui.message(`Rally ready in ${Math.ceil(wait)} s`);
      return false;
    }
    const near = g.allies.filter((u) => u.alive && !u.companion && Math.hypot(u.x - h.x, u.y - h.y) <= RALLY.radius);
    if (!near.length) {
      CL.ui.message('Nobody close enough to rally');
      return false;
    }
    g.rallyReadyAt = g.t + RALLY.cooldown;
    let turned = 0;
    for (const u of near) {
      if (u.routing) {
        u.routing = false;
        u.routeT = 0;
        turned++;
      }
    }
    for (const role of GROUPS) {
      if (!near.some((u) => u.role === role)) continue;
      const rec = record(g, 'ally', role);
      rec.rallyAt = g.t;
      for (const u of near) if (u.role === role) rec.base.add(u.id);
      rec.cohesion = Math.max(rec.cohesion ?? RALLY.floor, RALLY.floor);
      rec.state = stateFor(rec.cohesion, 'waver');
    }
    for (const u of near) {
      u.morale = record(g, 'ally', u.role).state;
      u.moraleMul = u.morale === 'waver' ? WAVER_DAMAGE : 1;
    }
    g.moraleIn = 0; // show it at once
    g.effects.push({ x: h.x, y: h.y - 20, t: 0.6, life: 0.6, size: 70, color: '#f6daa6', kind: 'rally' });
    CL.audio?.play('horse', 0.6);
    CL.ui.message(turned ? `Rally! ${turned} turn back to the fight` : 'Rally! The company steadies');
    CL.diag.log('info', 'Rally', { reached: near.length, turned });
    return near.length;
  }

  CL.morale = { THRESH, TERMS, RALLY, GIVE_UP, FLEE, WAVER_DAMAGE, fallbackPoint, targetFor, stateFor, update, flee, leave, rally, rallyIn, word, record };
})(typeof window !== 'undefined' ? window : globalThis);
