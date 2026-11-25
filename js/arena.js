// @ts-check
/* Crownless large arenas (PROTO-A's camera test; V2-05). Battlefields several screens across, built
 * in code from a small spec in data/battle_maps.js (`generate: { kind, scale, seed }`), in the same
 * format as a hand-made battle map plus a world size (`width`, `height`) and movement `bounds`.
 * Each uses its own fixed seed, never the campaign's randomness, so a map is the same every time.
 *
 *   forest  trees (block arrows) and bushes, about as dense as the Forest Clearing, with glades
 *   field   open grass with a few copses, rocks and bushes, and dirt patches
 *   ford    (W-05a) open banks either side of a river the armies meet in: its shallows (`slow`)
 *           slow everyone wading through them, and nothing grows in the water
 *   hills   (P7-11) rolling grass with three rises (`high`): a knoll where the company forms up, a hill
 *           between the armies and a knoll on the enemy's side. Archers on a rise shoot further
 *   assault (P8-06b) a fort's wall across the field: a gate in the middle (shut until a ram breaks it),
 *           one to three ladder points (the only other ways up), a walkway behind the wall that counts
 *           as high ground, and the courtyard beyond with a keep line to fall back to. Built for each
 *           battle (`assault(opts)`, not kept): its ladders and gate depend on the siege, and when you
 *           defend it is mirrored, the courtyard on your side
 *
 * `mapFor(id)` is how battles get their map: a generated map is built once and kept; and with the
 * device setting "Battlefield: Small" a large map is swapped for its one-screen counterpart
 * (`small` in the data), the classic maps. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['forest', 'field', 'ford', 'hills'];
  const FORD_SLOW = 0.5; // speed in the shallows (W-05a)

  /** Small seeded generator (mulberry32), local to the arena. @param {number} seed */
  function mulberry(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TREE = { shape: 'circle', r: 20, blocksArrows: true, look: 'tree' }; // P10-G2: the art kit's looks

  /**
   * The parts every arena shares: size, spawns kept clear, a placer that keeps obstacles apart.
   * @param {number} scale @param {() => number} rand
   */
  function frame(scale, rand) {
    const W = CL.W * scale;
    const H = CL.H * scale;
    const hero = { x: Math.round(W * 0.18), y: Math.round(H / 2) };
    const enemies = { x0: Math.round(W * 0.76), x1: Math.round(W * 0.92), y0: Math.round(H * 0.28), y1: Math.round(H * 0.72) };
    const keepClear = [
      { x: hero.x - 120, y: hero.y, r: 300 },
      { x: (enemies.x0 + enemies.x1) / 2, y: (enemies.y0 + enemies.y1) / 2, r: 330 },
    ];
    const obstacles = [];
    const open = [];
    const free = (x, y, pad) => keepClear.every((k) => Math.hypot(x - k.x, y - k.y) > k.r + pad) && open.every((c) => ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 > 1);
    /** Place up to n obstacles at least minGap apart; `at` picks a spot, `make` builds one. */
    const place = (n, minGap, make, at = () => [80 + rand() * (W - 160), 110 + rand() * (H - 200)]) => {
      for (let tries = 0, made = 0; made < n && tries < n * 40; tries++) {
        const [x, y] = at();
        if (x < 60 || x > W - 60 || y < 90 || y > H - 70) continue;
        if (!free(x, y, 20) || obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) continue;
        obstacles.push(make(Math.round(x), Math.round(y)));
        made++;
      }
    };
    return { W, H, hero, enemies, obstacles, open, place };
  }

  // A bush's shape is drawn from the arena's own stream, as its sprite was, so every map is laid out as before.
  const bush = (rand) => (x, y) => ({ shape: 'circle', x, y, r: 14, blocksArrows: false, look: 'bush', seed: Math.floor(rand() * 3) });
  const rock = (x, y) => ({ shape: 'circle', x, y, r: 15, blocksArrows: false, look: 'rock' });
  const tree = (x, y) => ({ ...TREE, x, y });

  /**
   * A forest arena `scale` screens wide and high (3 = 2880×1620): trees and bushes, glades, open ground
   * around both spawns, and the forest clearing's palette.
   * @param {number} [scale] @param {number} [seed]
   */
  function forest(scale = 3, seed = 7) {
    const rand = mulberry(seed);
    const f = frame(scale, rand);
    for (let i = 0; i < 2 * scale; i++) f.open.push({ x: 200 + rand() * (f.W - 400), y: 150 + rand() * (f.H - 300), rx: 140 + rand() * 160, ry: 90 + rand() * 90 });
    // About as dense as the forest clearing (9 trees, 4 bushes a screen), spread over the arena.
    f.place(9 * scale * scale, 95, tree);
    f.place(4 * scale * scale, 60, bush(rand));
    const decor = Array.from({ length: 4 * scale * scale }, () => [rand() < 0.5 ? 'ferns' : 'leaves', Math.round(rand() * (f.W - 50)), Math.round(rand() * (f.H - 40)), 40, 31]);
    return finish(f, { id: `forest_${scale}x`, name: `Forest (${scale}×)`, ground: { base: '#4f7140', patches: f.open.map((c) => ({ color: '#6f8a4c', ...c })) }, decor });
  }

  /**
   * An open field `scale` screens across: grass, a few copses of trees, scattered rocks and bushes, and
   * dirt patches, in the grass field's palette. Mostly open, so cavalry has room to ride.
   * @param {number} [scale] @param {number} [seed]
   */
  function field(scale = 3, seed = 11) {
    const rand = mulberry(seed);
    const f = frame(scale, rand);
    const copses = Array.from({ length: 2 * scale }, () => [200 + rand() * (f.W - 400), 160 + rand() * (f.H - 320)]);
    for (const [cx, cy] of copses) f.place(4, 70, tree, () => [cx + (rand() - 0.5) * 260, cy + (rand() - 0.5) * 180]);
    f.place(2 * scale * scale, 80, rock);
    f.place(2 * scale * scale, 60, bush(rand));
    const patches = Array.from({ length: 3 * scale }, () => ({ color: '#a28e61', x: 150 + rand() * (f.W - 300), y: 120 + rand() * (f.H - 240), rx: 90 + rand() * 180, ry: 60 + rand() * 100 }));
    const flowers = ['flowers', 'flowers', 'flowers', 'stones', 'flowers'];
    const decor = Array.from({ length: 3 * scale * scale }, () => [flowers[Math.floor(rand() * flowers.length)], Math.round(rand() * (f.W - 60)), Math.round(rand() * (f.H - 60)), 52, 56]);
    return finish(f, { id: `field_${scale}x`, name: `Field (${scale}×)`, ground: { base: '#71904e', patches }, decor });
  }

  /**
   * A river crossing `scale` screens across (W-05a): grass banks with a few copses and rocks, and a
   * river running north–south between the two armies. All of it is a ford: shallow enough to cross
   * anywhere, at half speed. Arrows fly over it.
   * @param {number} [scale] @param {number} [seed]
   */
  function ford(scale = 3, seed = 13) {
    const rand = mulberry(seed);
    const f = frame(scale, rand);
    const river = { x: Math.round(f.W * 0.44), y: 0, w: Math.round(f.W * 0.12), h: f.H };
    // Nothing is placed in the water or on its edge.
    f.open.push({ x: river.x + river.w / 2, y: f.H / 2, rx: river.w / 2 + 50, ry: f.H });
    const copses = Array.from({ length: 2 * scale }, () => [200 + rand() * (f.W - 400), 160 + rand() * (f.H - 320)]);
    for (const [cx, cy] of copses) f.place(3, 70, tree, () => [cx + (rand() - 0.5) * 240, cy + (rand() - 0.5) * 180]);
    f.place(2 * scale * scale, 80, rock);
    f.place(2 * scale * scale, 60, bush(rand));
    const flowers = ['flowers', 'flowers', 'flowers', 'stones'];
    const decor = Array.from({ length: 2 * scale * scale }, () => [flowers[Math.floor(rand() * flowers.length)], Math.round(rand() * (f.W - 60)), Math.round(rand() * (f.H - 60)), 52, 56]).filter((d) => Number(d[1]) + 52 < river.x - 20 || Number(d[1]) > river.x + river.w + 20);
    return {
      ...finish(f, { id: `ford_${scale}x`, name: `River ford (${scale}×)`, ground: { base: '#71904e', patches: [], waters: [river] }, decor }),
      slow: [{ ...river, factor: FORD_SLOW }],
    };
  }

  /**
   * Hill country `scale` screens across (P7-11): grass with a few copses and rocks, and three rises in
   * `high` (ellipses): one under the company's start (Balanced's archers stand on it), the middle hill
   * the armies meet near, and one on the enemy's side. Nothing grows on a rise, so archers can stand
   * there. @param {number} [scale] @param {number} [seed]
   */
  function hills(scale = 3, seed = 17) {
    const rand = mulberry(seed);
    const f = frame(scale, rand);
    const ex = Math.round((f.enemies.x0 + f.enemies.x1) / 2);
    const high = [
      { x: f.hero.x - 60, y: f.hero.y, rx: 210, ry: 160 },
      { x: Math.round(f.W * 0.5), y: Math.round(f.H * 0.34), rx: 260, ry: 150 },
      { x: ex, y: Math.round(f.H * 0.7), rx: 200, ry: 130 },
    ];
    for (const r of high) f.open.push({ ...r, rx: r.rx + 30, ry: r.ry + 30 });
    const copses = Array.from({ length: 2 * scale }, () => [200 + rand() * (f.W - 400), 160 + rand() * (f.H - 320)]);
    for (const [cx, cy] of copses) f.place(3, 70, tree, () => [cx + (rand() - 0.5) * 240, cy + (rand() - 0.5) * 180]);
    f.place(2 * scale * scale, 80, rock);
    f.place(2 * scale * scale, 60, bush(rand));
    const flowers = ['flowers', 'flowers', 'flowers', 'stones'];
    const decor = Array.from({ length: 2 * scale * scale }, () => [flowers[Math.floor(rand() * flowers.length)], Math.round(rand() * (f.W - 60)), Math.round(rand() * (f.H - 60)), 52, 56]);
    return { ...finish(f, { id: `hills_${scale}x`, name: `Hills (${scale}×)`, ground: { base: '#71904e', patches: [], rises: high }, decor }), high };
  }

  function finish(f, parts) {
    return {
      ...parts,
      tileset: '16x16',
      width: f.W,
      height: f.H,
      bounds: { minX: 47, maxX: f.W - 52, minY: 65, maxY: f.H - 50 },
      obstacles: f.obstacles,
      spawn: { hero: f.hero, enemies: f.enemies },
    };
  }

  // ---- The assault (P8-06b) ----

  const WALL = { at: 0.56, thick: 26, gate: 96, ladder: 48, walkway: 70, keep: 0.86, climb: 0.25, foot: 20 };
  const LADDER_YS = [0.24, 0.76, 0.1];

  /**
   * A fort's wall `scale` screens across. `ladders` 1–3 ladder points; `gateOpen` (a broken gate);
   * `defend`: mirrored, so the hero starts in the courtyard and the attackers come from the far side.
   * @param {{ ladders?: number, gateOpen?: boolean, defend?: boolean, scale?: number, seed?: number }} [opts]
   */
  function assault({ ladders = 1, gateOpen = false, defend = false, scale = 2, seed = 23 } = {}) {
    const rand = mulberry(seed);
    const W = CL.W * scale;
    const H = CL.H * scale;
    // The attackers' side is the west (left); defending, the map is mirrored (x → W − x).
    const mx = (x) => (defend ? W - x : x);
    const wx = Math.round(W * WALL.at);
    const wallX = defend ? W - wx - WALL.thick : wx; // the wall's west edge
    const centre = wallX + WALL.thick / 2;
    const n = Math.max(1, Math.min(3, Math.round(ladders)));
    const gaps = [{ kind: 'gate', y: Math.round(H / 2), h: WALL.gate }, ...LADDER_YS.slice(0, n).map((f) => ({ kind: 'ladder', y: Math.round(H * f), h: WALL.ladder }))].sort((a, b) => a.y - b.y);
    const obstacles = [];
    let top = 0;
    for (const g of gaps) {
      const y0 = g.y - g.h / 2;
      if (y0 > top) obstacles.push({ shape: 'rect', x: wallX, y: top, w: WALL.thick, h: y0 - top, blocksArrows: false, look: 'wall' });
      top = g.y + g.h / 2;
    }
    obstacles.push({ shape: 'rect', x: wallX, y: top, w: WALL.thick, h: H - top, blocksArrows: false, look: 'wall' });
    const gate = gaps.find((g) => g.kind === 'gate');
    if (!gateOpen) obstacles.push({ shape: 'rect', x: wallX, y: gate.y - gate.h / 2, w: WALL.thick, h: gate.h, blocksArrows: false, look: 'crate', gate: true });
    // The walkway behind the wall: high ground for its archers (P7-11's rises).
    const inner = defend ? wallX - WALL.walkway / 2 : wallX + WALL.thick + WALL.walkway / 2;
    const high = [{ x: Math.round(inner), y: Math.round(H / 2), rx: WALL.walkway / 2, ry: Math.round(H / 2) }];
    // The keep line: a few blocks across the courtyard's far end to fall back to.
    const keepX = Math.round(mx(W * WALL.keep));
    for (const fy of [0.2, 0.42, 0.58, 0.8]) obstacles.push({ shape: 'rect', x: keepX - 20, y: Math.round(H * fy) - 22, w: 40, h: 44, blocksArrows: true, look: 'crate' });
    // A few rocks outside.
    for (let i = 0; i < 6; i++) {
      const x = Math.round(mx(W * (0.12 + rand() * 0.3)));
      const y = Math.round(H * (0.12 + rand() * 0.76));
      if (Math.abs(y - H / 2) > 120) obstacles.push(rock(x, y));
    }
    const hero = defend ? { x: Math.round(mx(W * 0.78)), y: Math.round(H / 2) } : { x: Math.round(W * 0.2), y: Math.round(H / 2) };
    // Attacking, the defenders stand behind the wall; defending, the attackers come from the far side.
    const enemies = defend
      ? { x0: Math.round(W - W * 0.24), x1: Math.round(W - W * 0.1), y0: Math.round(H * 0.25), y1: Math.round(H * 0.75) }
      : { x0: wallX + WALL.thick + 18, x1: wallX + WALL.thick + 260, y0: Math.round(H * 0.18), y1: Math.round(H * 0.82) };
    if (defend) [hero.x] = [Math.round(wallX - 260)];
    const courtyard = defend ? { x0: 0, x1: wallX } : { x0: wallX + WALL.thick, x1: W };
    const stone = { x: courtyard.x0, y: 0, w: courtyard.x1 - courtyard.x0, h: H, color: '#8d8a80' };
    return {
      id: `assault_${n}${gateOpen ? '_open' : ''}${defend ? '_defend' : ''}`,
      name: 'The walls',
      tileset: '16x16',
      ground: { base: '#71904e', patches: [], stone, rises: high },
      decor: [],
      width: W,
      height: H,
      bounds: { minX: 47, maxX: W - 52, minY: 65, maxY: H - 50 },
      obstacles,
      // P9-B5: climbing a ladder is slow (and breaks ranks, as wading does): the wall's own strength.
      slow: gaps.filter((g) => g.kind === 'ladder').map((g) => ({ x: wallX - WALL.foot, y: g.y - g.h / 2, w: WALL.thick + 2 * WALL.foot, h: g.h, factor: WALL.climb })),
      spawn: { hero, enemies },
      high,
      wall: { x: wallX, w: WALL.thick, centre, gaps, outside: defend ? 1 : -1, courtyard },
      gateOpen,
    };
  }

  /**
   * The way through a wall (P8-06b): a unit whose destination is on the other side of the wall heads
   * for the nearest open gap (a ladder, or the gate once broken) on its own side, then through it. Null
   * when no wall stands between. Units never go through the wall itself (it is solid).
   */
  function wayThrough(map, x0, y0, x1, y1) {
    const w = map?.wall;
    if (!w) return null;
    const s0 = Math.sign(x0 - w.centre);
    const s1 = Math.sign(x1 - w.centre);
    if (!s0 || !s1 || s0 === s1) return null;
    const open = w.gaps.filter((g) => g.kind !== 'gate' || map.gateOpen);
    if (!open.length) return { x: w.centre + s0 * 40, y: y0 };
    const gap = open.reduce((a, b) => (Math.abs(y0 - b.y) + Math.abs(y1 - b.y) < Math.abs(y0 - a.y) + Math.abs(y1 - a.y) ? b : a));
    if (Math.abs(x0 - w.centre) < 46 && Math.abs(y0 - gap.y) < gap.h / 2 - 6) return { x: w.centre - s0 * 60, y: gap.y };
    return { x: w.centre + s0 * 40, y: gap.y };
  }

  const GENERATORS = { forest, field, ford, hills };
  const built = new Map();

  /**
   * P9-B1: a large field grows with the battle size, so 200 fighters have room. Up to `from` fighters
   * it is the data's size; at `to` it is `most` times as wide and high (3 screens become 4.2; 3.7 at 150).
   */
  const GROW = { from: 80, to: 200, most: 1.4 };
  /** How much bigger than the data's size a generated field is at a battle size. @param {number} size */
  const growth = (size) => 1 + (GROW.most - 1) * Math.max(0, Math.min(1, (size - GROW.from) / (GROW.to - GROW.from)));

  /**
   * Build a generated map record from the data (once per size; later calls get the same object).
   * @param {any} rec @param {number} [size] the battle size (default: the current setting)
   */
  function build(rec, size = CL.combat?.BATTLE.activeCap ?? GROW.from) {
    if (!rec.generate) return rec;
    const g = rec.generate;
    const scale = Math.round(g.scale * growth(size) * 100) / 100;
    const key = scale === g.scale ? rec.id : `${rec.id}@${scale}`;
    if (built.has(key)) return built.get(key);
    const map = { ...GENERATORS[g.kind](scale, g.seed), id: rec.id, name: rec.name, small: rec.small || null };
    built.set(key, map);
    return map;
  }

  /**
   * The battle map to fight on: the data's map (built if generated), or, with the device setting
   * "Battlefield: Small", a large map's one-screen counterpart. @param {string} id
   */
  function mapFor(id) {
    const rec = CL.content.get('battle_maps', id);
    if (rec.small && CL.settings?.get('battlefield') === 'small') return CL.content.get('battle_maps', rec.small);
    return build(rec);
  }

  CL.arena = { KINDS, FORD_SLOW, WALL, GROW, growth, forest, field, ford, hills, assault, wayThrough, build, mapFor };
})(typeof window !== 'undefined' ? window : globalThis);
