/* Crownless fighting styles (P11-10, docs/PHASE-11-PLAN.md §10; the numbers in data/styles.js).
 * A fighter's style decides how it uses the rules everyone shares: when its guard comes up, whether it
 * keeps at the end of a longer weapon, waits outside a ready opponent's reach, strikes into an opening
 * it sees, an archer's distance and retreat, a rider's choice of target and when it rides out. It reads
 * only what is drawn (a swing's phase, a stagger, a lowered shield, where everyone is), and answers a
 * reaction after it: no hidden advantage, no knowledge of the player's next input.
 * Detail by distance: the full style within DETAIL.radius of the hero, and in every duel; further off,
 * the old simple rule (walk in and swing), which costs nothing. The guard's reaction and its use apply
 * everywhere (they are cheap). Nothing here is saved: a style is the troop's (or the bout's). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** px from the hero within which a fighter thinks in full: set by `npm run bench` (360 at 200 costs 6% over 5.9.0; 160 saved little). */
  const DETAIL = { radius: 360 };
  /** How an opening reads, and the stand-off. */
  const OPEN = { stagger: 0.45, standoff: 14, keepBack: 10, back: 0.7, look: 0.2 };
  /** A rider's choices (cavalryAi): archers worth riding further for; braced spears avoided; out after a grind. */
  const RIDE = { archer: 90, braced: 160, grind: 1.2, grindNear: 46, out: 0.7 };

  /** Each part on its own, for measuring (scripts: parity, prototype-g), as `combat.ENEMY.use`. */
  const USE = { melee: true, archer: true, rider: true, guard: true, ally: true, enemy: true, open: true, spacing: true, patience: true };
  const styles = () => CL.content.table('fighting_styles');

  /** What a fighter keeps in mind from frame to frame (its wait, the opening it saw, its last look round). @param {any} u */
  function mindOf(u) {
    if (!u.mind) u.mind = { waited: 0, openAt: null, take: false };
    return u.mind;
  }

  /** The style a troop fights in: its own `style`, else by its kind. @param {string} troopId */
  function forTroop(troopId) {
    const t = CL.content.table('troops')[troopId];
    if (!t || t.role === 'hero') return null;
    if (t.style && styles()[t.style]) return t.style;
    if (t.role === 'cavalry') return 'rider';
    if (t.role === 'archer') return 'skirmisher';
    const fam = CL.profile?.resolve?.({ troop: troopId })?.family;
    if (fam === 'spear' || fam === 'pike') return 'spear';
    if (t.tier === 'T1') return 'brawler';
    if (t.tier === 'T3') return fam === 'axe' || fam === 'mace' || fam === 'greataxe' ? 'heavy' : 'veteran';
    return 'soldier';
  }

  /** A unit's style record (null for the hero). The unit's own (a bout's), else its troop's. @param {any} u */
  function of(u) {
    if (!u || u.role === 'hero') return null;
    if (u.styleId === undefined) u.styleId = forTroop(u.troop);
    if (u.styleFor !== u.styleId) {
      u.styleFor = u.styleId; // the record, kept on the unit (a bout's style may replace the troop's)
      u.styleRec = u.styleId ? styles()[u.styleId] || null : null;
    }
    return u.styleRec;
  }

  /** The troop card's line: "fights patiently, guards well". @param {string} troopId */
  function words(troopId) {
    const id = forTroop(troopId);
    return id ? styles()[id]?.words || '' : '';
  }

  const ARMOUR_WORDS = { rags: 'rags', cloth: 'cloth', gambeson: 'a gambeson', fur: 'furs', leather: 'leather', mail: 'mail' };
  /**
   * P11-11: the troop card's whole line: its weapon (and shield), its armour and how it fights:
   * "Sword and shield, mail. In battle: fights patiently, guards well". @param {string} troopId
   */
  function card(troopId) {
    const t = CL.content.table('troops')[troopId];
    if (!t || t.role === 'hero') return '';
    const fam = CL.content.table('weapon_families')[CL.profile.resolve({ troop: troopId }).family];
    const kit = fam ? `${fam.name}${t.shield ? ' and shield' : ''}` : '';
    const armour = ARMOUR_WORDS[t.look?.armour] || null;
    const how = words(troopId);
    return `${[kit, armour].filter(Boolean).join(', ')}${how ? `. In battle: ${how}` : ''}`;
  }

  /** Does this fighter think in full this frame (near the hero, or in a duel)? @param {any} g @param {any} u */
  function detailed(g, u) {
    if (g.duel) return true;
    const h = g.hero;
    if (!h) return false;
    const dx = u.x - h.x;
    const dy = u.y - h.y;
    return dx * dx + dy * dy < DETAIL.radius * DETAIL.radius;
  }

  /** The guard's reaction (s, never 0) and whether it comes up against this threat at all. @param {any} u */
  const reaction = (u) => !USE.guard ? (CL.combat?.GUARD_DELAY?.[CL.content.table('troops')[u.troop]?.tier] ?? 0.15) : Math.max(0.05, of(u)?.reaction ?? CL.combat?.GUARD_DELAY?.[CL.content.table('troops')[u.troop]?.tier] ?? 0.15);
  const guardUse = (u) => (USE.guard ? (of(u)?.guardUse ?? 1) : 1);

  /** Is the target open (what is drawn): recovering from a swing, staggered, its guard broken, or running? */
  function open(g, t) {
    if (!t?.alive) return false;
    if (t.swing && CL.units.swingPhase(t) === 'recovery') return true;
    if (t.staggeredAt != null && g.t - t.staggeredAt < OPEN.stagger) return true;
    if ((t.guardBrokenUntil ?? -1) > g.t) return true;
    return Boolean(t.routing);
  }

  /**
   * P11-10: how a foot fighter closes with its target this frame, by its style: null for the simple rule
   * (walk in to its usual distance and swing in reach), else `{ goal, strike, keep }`: the distance to
   * hold, whether to strike when in reach, and whether to step back when closer than `goal`. A patient
   * fighter waits just outside a ready opponent's reach, and strikes one who steps into its own.
   * @param {any} g @param {any} u @param {any} t @param {number} dt
   */
  function melee(g, u, t, dt) {
    if (!USE.melee || !USE[u.team]) return null;
    const S = of(u);
    if (!S || u.ranged || !t?.alive || t.wagon || !detailed(g, u)) return null;
    // A foe busy with someone else is pressed at once (the simple rule): patience and spacing are for
    // the one who faces you, or a crowd fight is lost waiting (measured: scripts/parity.js outnumbered).
    if (!g.duel && t.target && t.target !== u) return null;
    const st = mindOf(u);
    if (u.swing) st.waited = 0; // its own blow: the wait starts again after it
    const mine = u.reach;
    const theirs = t.ranged ? 0 : t.reach || 30;
    // An opening seen: once per opening, by its opportunism, struck a reaction after it was seen.
    if (USE.open && open(g, t)) {
      if (st.openAt == null) {
        st.openAt = g.t;
        st.take = Math.random() < S.opportunism;
      }
      if (st.take && g.t - st.openAt >= S.reaction - 1e-9) return { goal: Math.max(8, mine - 6), strike: true, keep: false };
    } else st.openAt = null;
    // A longer weapon keeps at its own reach, where a shorter one can't answer.
    if (USE.spacing && S.spacing > 0 && mine > theirs + 8) {
      if (st.spaceFor !== t.id) {
        st.spaceFor = t.id; // decided once a target
        st.spaces = Math.random() < S.spacing;
      }
      if (st.spaces) return { goal: mine - 4, strike: true, keep: true };
    }
    // Patience: wait just outside a ready opponent's reach (a limit: then close anyway).
    if (USE.patience && S.patience > 0 && st.waited < S.patience && theirs > 0) {
      st.waited += dt;
      return { goal: Math.max(theirs, mine) + OPEN.standoff, strike: true, keep: true }; // and a foe who steps into its reach is struck
    }
    return null;
  }

  /**
   * P11-10: an archer's distance and retreat: back from a foot soldier inside `retreatAt` (away from it,
   * at part pace), and its target held at `preferRange`. Null for the usual. @param {any} g @param {any} u
   */
  function archer(g, u) {
    if (!USE.archer) return null;
    const S = of(u);
    if (!S || !u.ranged || !detailed(g, u)) return null;
    // Looked for a few times a second, not every frame (measured: `npm run bench` at 200).
    const st = mindOf(u);
    if ((st.lookAt ?? -1) > g.t && st.lookFor === u.target) return st.archer;
    st.lookAt = g.t + OPEN.look;
    st.lookFor = u.target;
    let near = null;
    let nd = S.retreatAt;
    const look = (f) => {
      if (!f?.alive || f.ranged || f.routing || f.wagon) return;
      const d = Math.hypot(f.x - u.x, f.y - u.y);
      if (d < nd) [near, nd] = [f, d];
    };
    if (S.retreatAt > 0) {
      // The foes' own lists, walked in place (no copy: this runs every frame for every archer near the hero).
      if (u.team === 'enemy') {
        look(g.hero);
        for (const f of g.allies) look(f);
      } else for (const f of g.enemies) look(f);
    }
    st.archer = { back: near, range: S.preferRange || null };
    return st.archer;
  }

  /**
   * P11-10: a rider's target: the nearest, archers counting nearer, and a braced spear (or a square)
   * facing it counting much further. @param {any} g @param {any} u @param {any[]} foes
   */
  function riderTarget(g, u, foes) {
    if (!USE.rider || !of(u)) return null;
    let best = null;
    let score = Infinity;
    for (const v of foes) {
      if (!v?.alive) continue;
      let s = Math.hypot(v.x - u.x, v.y - u.y);
      if (v.role === 'archer') s -= RIDE.archer;
      if ((CL.groups.braces?.(v) || CL.formations?.squared?.(g, v)) && CL.units.inArc(v, u, CL.units.ARC.block)) s += RIDE.braced;
      if (v.routing && (of(u).pursue ?? 1) < 0.5) s += RIDE.braced;
      if (s < score) [best, score] = [v, s];
    }
    return best;
  }

  /**
   * P11-10: a rider ground down among foot (slow, close, for a while) rides out to charge again.
   * Returns true when it turns to ride out. @param {any} _g @param {any} u @param {any} t @param {number} dt
   */
  function rideOut(_g, u, t, dt) {
    if (!USE.rider || !of(u) || !t) return false;
    const st = mindOf(u);
    const close = Math.hypot(t.x - u.x, t.y - u.y) < RIDE.grindNear && (u.momentum || 0) < 0.3;
    st.grind = close ? (st.grind || 0) + dt : 0;
    if (st.grind < RIDE.grind) return false;
    st.grind = 0;
    const L = Math.hypot(u.x - t.x, u.y - t.y) || 1;
    u.runDir = [(u.x - t.x) / L, (u.y - t.y) / L];
    u.overrun = RIDE.out;
    return true;
  }

  /** Content checks (from content.validate): each style's numbers in range; a troop's style known. */
  function validate(C, err) {
    if (!C.fighting_styles) return; // a partial table set (a pack's own check) has none to check against
    const S = C.fighting_styles;
    const range = { reaction: [0.05, 1], patience: [0, 10], spacing: [0, 1], opportunism: [0, 1], guardUse: [0, 1], retreatAt: [0, 400], pursue: [0, 1], preferRange: [0, 600] };
    for (const s of Object.values(S)) {
      for (const [k, [lo, hi]] of Object.entries(range)) if (typeof s[k] !== 'number' || s[k] < lo || s[k] > hi) err(`style ${s.id}: ${k} must be a number from ${lo} to ${hi}`);
      if (!s.name || !s.words) err(`style ${s.id}: needs a name and words`);
    }
    for (const t of Object.values(C.troops || {})) if (t.style != null && !S[t.style]) err(`troop ${t.id}: unknown style ${t.style}`);
    for (const T of Object.values(C.tournaments || {})) for (const r of T.rounds || []) if (r.style != null && !S[r.style]) err(`tournament ${T.id}: unknown style ${r.style}`);
  }

  CL.styles = { card, USE, DETAIL, OPEN, RIDE, forTroop, of, words, detailed, reaction, guardUse, open, melee, archer, riderTarget, rideOut, validate };
})(typeof window !== 'undefined' ? window : globalThis);
