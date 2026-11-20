// @ts-check
/* Crownless battle objective (P7-11): protect the wagon, in an escort contract's ambush.
 *
 * When the Reavers lying in wait on the escort road spring (js/contracts.js), the battle has the
 * caravan's wagon on the field, behind the company. It doesn't move or fight; it has 70 HP and a
 * little armour (2), and it is solid (an obstacle: nobody walks through it, arrows fly over it).
 *   - The raiders go for it: every third one that takes the field is out for the wagon and nothing
 *     else (it counts as 1,000 px nearer than it is), unless someone stands in its way (within 60 px:
 *     it fights them first); the rest fight the company, though the wagon still counts as 160 px
 *     nearer for them.
 *   - It is an ambush: the Reavers burst from cover close by (420–640 px ahead of the company, not
 *     from the far side of the field), and the wagon-raiders behind it, on its flank (420–560 px back
 *     and 330–460 px to one side: far enough that both groups strike at about the same time).
 *   - Your soldiers mind it without being told (Balanced does the right thing): a raider near the
 *     wagon counts as nearer when they pick theirs, and they leave their place (on Follow or Hold) for
 *     a raider at the wagon from as far as 420 px.
 *   - If it burns, the caravan is lost and the contract fails (as abandoning it would), even if you
 *     win the fight. Losing the battle loses it too, whether fought or simulated: the ambush takes it.
 * `USE.guard` switches the soldiers' care for it off, for measuring (scripts/extras.js).
 * Nothing is saved: the wagon lasts one battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const WAGON = { hp: 70, armor: 2, w: 46, h: 28, back: 130, pull: 160, raidPull: 1000, raidEvery: 3, blocked: 60, fromFlank: true, guardRadius: 180, guardPull: 150, guardReach: 420, spring: [420, 640], spread: 300, rear: [420, 560], flank: [330, 460] };
  const USE = { guard: true };

  /** Put the wagon on the field if this battle has one (before the company forms up around it). @param {any} g @param {any} enc */
  function begin(g, enc) {
    g.wagon = null;
    g.raiders = 0;
    if (enc?.objective !== 'wagon') return;
    const a = g.battleMap.spawn.hero;
    const [x, y] = [a.x - WAGON.back, a.y];
    const body = { shape: 'rect', x: x - WAGON.w / 2, y: y - WAGON.h / 2, w: WAGON.w, h: WAGON.h, blocksArrows: false, look: 'wagon' };
    // This battle's own copy of the map: the shared one (built once, js/arena.js) is never changed.
    const b = g.battleMap.bounds || CL.units.BOUNDS;
    const enemies = { x0: Math.min(b.maxX - 40, a.x + WAGON.spring[0]), x1: Math.min(b.maxX - 20, a.x + WAGON.spring[1]), y0: Math.max(b.minY + 20, a.y - WAGON.spread), y1: Math.min(b.maxY - 20, a.y + WAGON.spread) };
    const side = a.y + WAGON.flank[1] < b.maxY - 20 ? 1 : -1; // the flank with room
    const ys = [a.y + side * WAGON.flank[0], a.y + side * WAGON.flank[1]].sort((p, q) => p - q);
    const raiders = { x0: Math.max(b.minX + 20, a.x - WAGON.rear[1]), x1: Math.max(b.minX + 40, a.x - WAGON.rear[0]), y0: ys[0], y1: ys[1] };
    g.battleMap = { ...g.battleMap, obstacles: [...g.battleMap.obstacles, body], spawn: { ...g.battleMap.spawn, enemies, raiders } };
    g.wagon = { id: 'wagon', wagon: true, team: 'ally', role: 'wagon', troop: 'wagon', x, y, hp: WAGON.hp, maxhp: WAGON.hp, armor: WAGON.armor, alive: true, face: 'right', flash: 0, guard: false, reach: 0, ranged: null };
  }

  /** The wagon, while it stands (enemies may go for it). @param {any} g */
  const standing = (g) => (g.wagon?.alive ? g.wagon : null);

  /** How much nearer a target counts for an enemy picking one: the wagon a great deal, and to a wagon-raider everything. @param {Unit} u @param {Unit} v */
  const enemyPull = (u, v, nearest = Number.POSITIVE_INFINITY) => (v?.wagon ? (u.raider && nearest > WAGON.blocked ? WAGON.raidPull : WAGON.pull) : 0);

  /**
   * An enemy takes the field: while the wagon stands, every second one is out for it, and bursts from
   * cover behind the company (`joining`: one riding in with another party keeps its place). @param {any} g @param {Unit} e
   */
  function onEnemy(g, e, joining = false) {
    if (!standing(g) || joining) return;
    g.raiders = (g.raiders || 0) + 1;
    if (g.raiders % WAGON.raidEvery) return;
    e.raider = true;
    const box = g.battleMap.spawn.raiders;
    if (!box || !WAGON.fromFlank) return;
    e.x = box.x0 + Math.random() * (box.x1 - box.x0);
    e.y = box.y0 + Math.random() * (box.y1 - box.y0);
    CL.units.resolveObstacles(e);
  }

  /**
   * Who one of your soldiers goes for while the wagon stands: the nearest, a raider by the wagon
   * counting as nearer. Null when there is no wagon (the ordinary rule). @param {any} g @param {Unit} u @param {Unit[]} foes
   */
  function pick(g, u, foes) {
    const w = standing(g);
    if (!w || !USE.guard) return null;
    let best = null;
    let score = Number.POSITIVE_INFINITY;
    for (const v of foes) {
      if (!v?.alive) continue;
      const s = Math.hypot(v.x - u.x, v.y - u.y) - (Math.hypot(v.x - w.x, v.y - w.y) < WAGON.guardRadius ? WAGON.guardPull : 0);
      if (s < score) [best, score] = [v, s];
    }
    return best;
  }

  /** How far a soldier on Follow or Hold goes for this foe: further for one at the wagon. @param {any} g @param {Unit} foe @param {number} base */
  function reach(g, foe, base) {
    const w = standing(g);
    if (!w || !USE.guard || !foe || Math.hypot(foe.x - w.x, foe.y - w.y) >= WAGON.guardRadius) return base;
    return Math.max(base, WAGON.guardReach);
  }

  /** The wagon was cut down: it burns. @param {any} g */
  function onDown(g) {
    g.wagonLost = true;
    g.effects.push({ x: g.wagon.x, y: g.wagon.y - 20, t: 0.6, color: '#f77864', kind: 'hit' });
    CL.ui.message('The wagon is burning! The caravan is lost');
    CL.diag.log('info', 'Wagon lost', { t: g.t });
  }

  /** Did this battle lose its wagon? @param {any} g */
  const lost = (g) => Boolean(g.wagon && !g.wagon.alive);

  /** For the result screen: 'saved', 'lost' or null (no wagon). @param {any} g @param {boolean} win */
  const fate = (g, win) => (g.wagon ? (win && g.wagon.alive ? 'saved' : 'lost') : null);

  CL.objective = { WAGON, USE, begin, standing, enemyPull, onEnemy, pick, reach, onDown, lost, fate };
})(typeof window !== 'undefined' ? window : globalThis);
