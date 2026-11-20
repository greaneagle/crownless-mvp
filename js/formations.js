// @ts-check
/* Crownless battle extras (P7-11): the infantry's formations and the lie of the land.
 *
 * Formations (the infantry's; picked in Orders, or by the battle setup: Defensive starts in a shield
 * wall, the others loose):
 *   loose       as before: loose ranks on Follow, break ranks to fight what comes close
 *   shield wall on Hold and Follow: the infantry close up (files 22 px apart instead of 28) and walk at
 *               70%. Shields stay up whenever a foe is in front and near (not only when one swings),
 *               and they strike over them, the shield dropping only for the blow itself; they raise
 *               them against archers in front too; and a raised shield covers the soldier on either
 *               side and a little further (46 px instead of 34, one side only). On Charge it breaks up
 *   wedge       on Follow and Charge: a point toward the enemy, 15% quicker on the move, and the first blow
 *               after closing with a new foe lands harder (×1.3) and shakes them as a blow from the
 *               flank does (their group's morale, js/morale.js). No shield cover in a wedge, given or
 *               taken. On Hold it falls back to loose
 * The lie of the land (W-05a's maps):
 *   high ground the hills battle map has rises (`high`, ellipses): an archer standing on one shoots 25%
 *               further, whichever side they are on. Archers who start on one (Balanced, Defensive and
 *               Aggressive put them on the company's knoll) hold it (js/prep.js)
 *   a ford      wading breaks a formation: in the shallows (`slow` ground) everyone is loose
 * `USE` switches each one off for measuring it on its own (scripts/extras.js, as B-01's ENEMY.use).
 * Nothing here is saved: a formation lasts one battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['loose', 'wall', 'wedge'];
  const NAMES = { loose: 'Loose', wall: 'Shield wall', wedge: 'Wedge' };
  const WALL = { fileGap: 22, rankGap: 26, perRank: 6, speed: 0.7, cover: 46, lookout: 1.6, arrowSlack: 30 };
  const WEDGE = { speed: 1.15, firstBlow: 1.3, rearm: 120, step: 26, fileGap: 26, ahead: 60 };
  const HILL = { range: 1.25 };
  const USE = { wall: true, wedge: true, hill: true, fordBreaks: true };

  const isInfantry = (u) => u && u.team === 'ally' && u.role === 'infantry' && !u.companion && !u.outside;

  /** Which formation a soldier is in right now: the infantry's chosen one, if the order suits it and the ground allows. @param {any} g @param {Unit} u */
  function of(g, u) {
    const f = g.formation || 'loose';
    if (f === 'loose' || !isInfantry(u) || !u.alive || u.routing || u.morale === 'fallback') return 'loose';
    if (USE.fordBreaks && CL.units.groundFactor(u.x, u.y) < 1) return 'loose'; // wading breaks ranks
    const order = g.orders?.infantry;
    if (f === 'wall') return USE.wall && order !== 'charge' ? 'wall' : 'loose';
    return USE.wedge && order !== 'hold' ? 'wedge' : 'loose';
  }

  /** How fast a soldier moves in their formation. @param {any} g @param {Unit} u */
  function speed(g, u) {
    const f = of(g, u);
    return f === 'wall' ? WALL.speed : f === 'wedge' ? WEDGE.speed : 1;
  }

  /**
   * In a shield wall the shields stay up whenever a foe is in front and near, or an archer in front is in
   * range (not only when someone swings). @param {any} g @param {Unit} u @param {Unit[]} opponents
   */
  function guard(g, u, opponents) {
    if (!CL.groups.hasShield(u) || of(g, u) !== 'wall' || CL.units.isCommitted(u)) return false;
    for (const o of opponents) {
      if (!o?.alive || o.routing || !CL.units.inArc(u, o, CL.units.ARC.block)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < (o.ranged ? rangeOf(o) + WALL.arrowSlack : (o.reach || 48) * WALL.lookout)) return true;
    }
    return false;
  }

  /** A shield wall strikes over its shields: may this soldier swing with the shield up? @param {any} g @param {Unit} u */
  const strikesOver = (g, u) => of(g, u) === 'wall';

  /** The shield cover a raised shield gives (js/groups.js): how far, and whether on both sides. Null: none. @param {any} g @param {Unit} blocker @param {Unit} target */
  function cover(g, blocker, target) {
    if (of(g, blocker) === 'wedge' || of(g, target) === 'wedge') return null;
    return of(g, blocker) === 'wall' ? { reach: WALL.cover, bothSides: true } : { reach: CL.groups.COVER_REACH, bothSides: false };
  }

  /** Each frame: a soldier in a wedge with no foe near is ready to strike the first blow again. @param {any} g @param {Unit} u */
  function arm(g, u) {
    if (of(g, u) !== 'wedge') u.wedgeArmed = false;
    else if (!u.target?.alive || Math.hypot(u.target.x - u.x, u.target.y - u.y) > WEDGE.rearm) u.wedgeArmed = true;
  }

  /** The blow's weight from the formation: the wedge's first blow (used once). @param {any} g @param {Unit} u */
  function blow(g, u) {
    if (!u.wedgeArmed || of(g, u) !== 'wedge') return 1;
    return WEDGE.firstBlow;
  }

  /** Where a soldier stands on Follow in a wall (a tight line) or a wedge (a point ahead). Null: the loose ranks. @param {any} g @param {Unit} u */
  function slot(g, u) {
    const f = of(g, u);
    if (f === 'loose') return null;
    const mates = g.allies.filter((a) => isInfantry(a) && a.alive);
    const i = Math.max(0, mates.indexOf(u));
    const h = g.hero;
    if (f === 'wall') {
      const files = Math.min(WALL.perRank, mates.length);
      const rank = Math.floor(i / WALL.perRank);
      const file = i % WALL.perRank;
      return { x: h.x + CL.groups.FORM.infantryAhead - rank * WALL.rankGap, y: h.y + (file - (files - 1) / 2) * WALL.fileGap };
    }
    // The wedge: 0 at the point, then pairs either side, each pair a step further back.
    const k = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 ? -1 : 1;
    return { x: h.x + WEDGE.ahead - k * WEDGE.step, y: h.y + side * k * WEDGE.fileGap };
  }

  /** On Hold in a shield wall the infantry close up into a tight line where they stand. @param {any} g */
  function closeUp(g) {
    if (g.formation !== 'wall' || g.orders?.infantry !== 'hold') return;
    const units = g.allies.filter((a) => isInfantry(a) && a.alive && !a.routing);
    if (!units.length) return;
    const cx = units.reduce((n, u) => n + u.holdX, 0) / units.length;
    const cy = units.reduce((n, u) => n + u.holdY, 0) / units.length;
    const files = Math.min(WALL.perRank, units.length);
    [...units]
      .sort((a, b) => a.holdY - b.holdY)
      .forEach((u, i) => {
        const rank = Math.floor(i / WALL.perRank);
        const file = i % WALL.perRank;
        u.holdX = cx - rank * WALL.rankGap;
        u.holdY = cy + (file - (files - 1) / 2) * WALL.fileGap;
      });
  }

  /** Choose the infantry's formation (Orders, or the battle setup). @param {any} g @param {string} kind */
  function set(g, kind, quiet = false) {
    if (!KINDS.includes(kind)) return false;
    g.formation = kind;
    closeUp(g);
    if (!quiet) {
      const order = g.orders?.infantry;
      const note = kind === 'wall' && order === 'charge' ? ': it forms on Hold or Follow' : kind === 'wedge' && order === 'hold' ? ': it forms on Follow or Charge' : '';
      CL.ui.message(`Infantry: ${NAMES[kind].toLowerCase()}${note}`);
    }
    CL.diag.log('info', 'Formation', { formation: kind });
    return true;
  }

  // ---- The lie of the land ----

  /** Is (x, y) on a rise of the battle map (the hills map's `high` ground)? */
  function highAt(x, y) {
    for (const r of CL.game?.battleMap?.high || []) if (((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 <= 1) return true;
    return false;
  }

  /** An archer's range where they stand: 25% further from high ground. @param {Unit} u */
  function rangeOf(u) {
    if (!u.ranged) return 0;
    return u.ranged.range * (USE.hill && highAt(u.x, u.y) ? HILL.range : 1);
  }

  CL.formations = { KINDS, NAMES, WALL, WEDGE, HILL, USE, of, speed, guard, strikesOver, cover, arm, blow, slot, closeUp, set, highAt, rangeOf };
})(typeof window !== 'undefined' ? window : globalThis);
