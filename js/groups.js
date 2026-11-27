// @ts-check
/* Crownless group AI and counterplay (V2-08a; design §8.1, §8.2, §8.4, §8.5; owner idea "shield cover").
 * Small, testable rules that combat.js asks each frame. Morale and rout are V2-08b.
 *
 * Shields: troops with `shield: true` in data/troops.js (Footman, Guard, Legionary, Mercenary,
 * Sellsword; and Mara) raise their shield when an enemy in front of them is swinging at them, unless
 * they are mid-swing themselves. A raised shield blocks blows from the front arc, as the hero's does.
 *
 * Shield cover (owner idea, 2026-11-17): a raised shield also protects the ally right beside the
 * blocker on the shield side (the blocker's left), against blows from the blocker's front arc. Only
 * adjacent allies (COVER_REACH), only frontal blows; the blocker's own rules still apply (slowed, can't
 * swing). Hero, soldiers and enemies alike; arrows included, so shield infantry screens archers.
 *
 * Bracing: troops with `brace: true` (Spearman, Legionary) facing a charging rider stop the charge and
 * hurt the rider (once per pass); a rider from behind or the flank is not stopped.
 *
 * Line of sight: archers only loose when no tree, wall or crate stands between them and the target;
 * otherwise they step sideways to find a clear shot (the player is told, now and then).
 *
 * Formations: on Follow, the company keeps loose ranks around the hero (infantry ahead, archers behind)
 * and breaks ranks to fight anything close, then drifts back. Each group has a state for the Orders
 * panel and later for morale: forming · formed · advancing · engaged. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const COVER_REACH = 34; // px from blocker to the covered ally
  const SIDE_MIN = 4; // px: how far to the shield side the ally must stand
  const SHIELD_LOOKOUT = 1.6; // × the attacker's reach: how close a swing must be to raise a shield
  const BRACE = { reach: 62, damage: 1.6, cooldown: 1.0 };
  const LOS_STEP = 24;
  const FORM = { rankGap: 30, fileGap: 28, perRank: 5, infantryAhead: 52, archersBehind: 72 };
  const STATE_EVERY = 0.25; // seconds between group-state updates
  const ENGAGE = 95; // px: a soldier this close to an enemy is engaged
  const FACE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const troopOf = (u) => CL.content.table('troops')[u.troop] || {};
  /** Does this unit carry a shield it can raise? (The player's hero is steered by the player.) */
  const hasShield = (u) => u.role !== 'hero' && (Boolean(troopOf(u).shield) || Boolean(u.companion));
  const braces = (u) => Boolean(troopOf(u).brace);

  // ---- Shields ----

  /**
   * Should this soldier raise its shield now? Only if it has one, isn't mid-swing, and an opponent in
   * front of it is winding up or striking at it from within reach.
   * @param {Unit} u @param {Unit[]} opponents
   */
  function shouldGuard(u, opponents) {
    // P11-05: not during its own swing at all: its recovery (longer after a whiff) is the opening a
    // patient fighter strikes into (docs/PHASE-11-PLAN.md §10.2).
    if (!u.alive || !hasShield(u) || u.swing) {
      u.threatSince = null;
      return false;
    }
    let threat = false;
    for (const o of opponents) {
      if (!o?.alive || !o.swing || o.ranged) continue;
      const phase = CL.units.swingPhase(o);
      if (phase !== 'windup' && phase !== 'active') continue;
      if (Math.hypot(o.x - u.x, o.y - u.y) > o.reach * SHIELD_LOOKOUT) continue;
      if (!CL.units.inArc(o, u, CL.profile.arcOf(o))) continue; // not aimed at us (the cone of its blow, from its profile)
      if (CL.units.inArc(u, o, CL.units.ARC.block)) {
        threat = true; // in front: raise it
        break;
      }
    }
    // P11-05: honestly: the shield comes up a reaction after the threat is seen (by tier; P11-10 by
    // style), never in the same frame; it stays up while the threat lasts.
    const t = CL.game?.t ?? 0;
    if (!threat) {
      u.threatSince = null;
      return false;
    }
    if (u.threatSince == null) {
      u.threatSince = t;
      u.guardTake = CL.styles ? Math.random() < CL.styles.guardUse(u) : true; // P11-10: by style, once a threat
    }
    if (!u.guardTake) return false;
    const delay = CL.styles ? CL.styles.reaction(u) : (CL.combat?.GUARD_DELAY?.[CL.content.table('troops')[u.troop]?.tier] ?? 0.15);
    return t - u.threatSince >= delay - 1e-9;
  }

  /**
   * Is `target` covered by a raised shield beside it against a blow from `source`? Returns the blocker
   * or null. @param {Unit} target @param {Unit} source @param {Unit[]} friends target's side (hero included)
   */
  function coverFor(target, source, friends) {
    if (!source) return null;
    for (const v of friends) {
      if (!v?.alive || v === target || !v.guard) continue;
      // A shield wall covers further and on both sides; a wedge gives and gets no cover (P7-11).
      const reach = CL.formations && CL.game ? CL.formations.cover(CL.game, v, target) : { reach: COVER_REACH, bothSides: false };
      if (!reach) continue;
      const dx = target.x - v.x;
      const dy = target.y - v.y;
      if (Math.hypot(dx, dy) > reach.reach) continue;
      const f = FACE[v.face] || FACE.right;
      const left = [f[1], -f[0]]; // the shield side: the blocker's left
      const side = dx * left[0] + dy * left[1];
      if ((reach.bothSides ? Math.abs(side) : side) < SIDE_MIN) continue;
      if (CL.units.inArc(v, source, CL.units.ARC.block)) return v;
    }
    return null;
  }

  // ---- Bracing against cavalry ----

  /**
   * A charging rider meets braced spears in front of them: the charge stops and the rider is hurt.
   * Returns the spearman who stopped it, or null. @param {any} g @param {Unit} rider @param {Unit[]} opponents
   */
  function braceAgainst(g, rider, opponents, chargeMomentum) {
    if ((rider.momentum || 0) < chargeMomentum || (rider.bracedUntil || 0) > g.t) return null;
    for (const o of opponents) {
      if (!o?.alive || Math.hypot(o.x - rider.x, o.y - rider.y) > BRACE.reach) continue; // the cheap test first (P9-B1)
      const square = CL.formations?.squared(g, o); // P9-B4: a square braces on every side, spears or not
      if ((!braces(o) && !square) || CL.units.isCommitted(o)) continue;
      if (!square && !CL.units.inArc(o, rider, CL.units.ARC.block)) continue; // spears face the charge, not the flank
      rider.momentum = 0;
      rider.overrun = 0;
      rider.bracedUntil = g.t + BRACE.cooldown;
      CL.combat.hit(rider, o.damage * BRACE.damage, o);
      g.effects.push({ x: rider.x, y: rider.y - 20, t: 0.3, color: '#f6daa6', kind: 'brace' });
      return o;
    }
    return null;
  }

  // ---- Archers' line of sight ----

  /** Can an arrow fly from u to t without hitting a tree, wall or crate? @param {Unit} u @param {Unit} t */
  function clearShot(u, t) {
    const [x0, y0, x1, y1] = [u.x, u.y - 20, t.x, t.y - 16];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / LOS_STEP));
    for (let i = 1; i < n; i++) if (CL.units.arrowBlocked(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
    return true;
  }

  /** Step sideways to find a clear shot (keeps one side until it works). @param {Unit} u @param {Unit} t */
  function seekShot(u, t, dt) {
    if (!u.losSide) u.losSide = u.id % 2 ? 1 : -1;
    const [dx, dy] = CL.util.normalize(t.x - u.x, t.y - u.y);
    CL.units.move(u, -dy * u.losSide, dx * u.losSide, dt);
    u.losBlocked = (u.losBlocked || 0) + dt;
    if (u.losBlocked > 1.5) {
      u.losSide = -u.losSide; // that way didn't work: try the other
      u.losBlocked = 0;
    }
  }

  // ---- Follow formation ----

  /**
   * Where a division's block stands beside the hero on Follow (P9-B4): infantry ahead, archers behind;
   * a second division of a role stands to the side of the first (below it, so the two don't overlap).
   * @param {any} g @param {string} div
   */
  function followAnchor(g, div) {
    const h = g.hero;
    const role = CL.divisions ? CL.divisions.roleOf(div) : div;
    const second = /2$/.test(div);
    const first = second ? g.allies.filter((a) => a.alive && a.div === role && !a.companion && !a.outside).length : 0;
    const beside = second ? (Math.min(FORM.perRank, first) / 2 + Math.min(FORM.perRank, first) / 2 + 1) * FORM.fileGap : 0;
    return { x: role === 'archer' ? h.x - FORM.archersBehind : h.x + FORM.infantryAhead, y: h.y + beside };
  }

  /** Where this soldier stands in their division's loose ranks around the hero on Follow. @param {any} g @param {Unit} u */
  function followSlot(g, u) {
    const formed = CL.formations?.slot(g, u); // a formed division: wall, wedge, line, column, square
    if (formed) return formed;
    const div = u.div || u.role;
    const mates = g.allies.filter((a) => a.alive && (a.div || a.role) === div && !a.companion && !a.outside);
    const i = Math.max(0, mates.indexOf(u));
    const files = Math.min(FORM.perRank, mates.length);
    const rank = Math.floor(i / FORM.perRank);
    const file = i % FORM.perRank;
    const at = followAnchor(g, div);
    return { x: at.x - rank * FORM.rankGap, y: at.y + (file - (files - 1) / 2) * FORM.fileGap };
  }

  // ---- Group states (Orders panel; morale in V2-08b) ----

  /** Update each of the company's groups: forming · formed · advancing · engaged. @param {any} g */
  function updateStates(g, dt) {
    g.stateIn = (g.stateIn ?? 0) - dt;
    if (g.stateIn > 0) return g.groupState;
    g.stateIn = STATE_EVERY;
    const near = CL.units.proximity(g.enemies.filter((e) => e.alive)); // once, not once a soldier (P9-B1)
    const state = {};
    for (const grp of CL.divisions ? CL.divisions.present(g) : ['infantry', 'archer', 'cavalry']) {
      const units = g.allies.filter((a) => a.alive && (a.div || a.role) === grp && !a.companion && !a.outside);
      if (!units.length) continue;
      const engaged = units.some((u) => near.any(u.x, u.y, ENGAGE));
      const order = g.orders[grp];
      const role = CL.divisions ? CL.divisions.roleOf(grp) : grp;
      if (engaged) state[grp] = 'engaged';
      else if (order === 'charge') state[grp] = 'advancing';
      else {
        const spot = (u) => (order === 'hold' ? { x: u.holdX, y: u.holdY } : role === 'cavalry' ? g.hero : followSlot(g, u));
        const far = units.filter((u) => {
          const s = spot(u);
          return Math.hypot(s.x - u.x, s.y - u.y) > (role === 'cavalry' ? 110 : 45);
        }).length;
        state[grp] = far > units.length / 3 ? 'forming' : 'formed';
      }
    }
    g.groupState = state;
    return state;
  }

  CL.groups = { COVER_REACH, BRACE, FORM, hasShield, braces, shouldGuard, coverFor, braceAgainst, clearShot, seekShot, followAnchor, followSlot, updateStates };
})(typeof window !== 'undefined' ? window : globalThis);
