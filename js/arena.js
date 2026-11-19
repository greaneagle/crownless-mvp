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
 *
 * `mapFor(id)` is how battles get their map: a generated map is built once and kept; and with the
 * device setting "Battlefield: Small" a large map is swapped for its one-screen counterpart
 * (`small` in the data), the classic maps. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['forest', 'field', 'ford'];
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

  const TREE = { shape: 'circle', r: 20, blocksArrows: true, look: { tile: 'w0132', w: 92, h: 97 } };
  const BUSHES = ['w0001', 'w0002', 'w0003'];

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

  const bush = (rand) => (x, y) => ({ shape: 'circle', x, y, r: 14, blocksArrows: false, look: { tile: BUSHES[Math.floor(rand() * 3)], w: 38, h: 30 } });
  const rock = (x, y) => ({ shape: 'circle', x, y, r: 15, blocksArrows: false, look: { tile: 'w0012', w: 40, h: 30 } });
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
    const decor = Array.from({ length: 4 * scale * scale }, () => [rand() < 0.5 ? 'w0147' : 'w0167', Math.round(rand() * (f.W - 50)), Math.round(rand() * (f.H - 40)), 40, 31]);
    return finish(f, { id: `forest_${scale}x`, name: `Forest (${scale}×)`, ground: { base: '#4f7140', tiles: ['w0000', 'w0050', 'w0003'], patches: f.open.map((c) => ({ color: '#6f8a4c', ...c })) }, decor });
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
    const flowers = ['w0091', 'w0110', 'w0121', 'w0034', 'w0050'];
    const decor = Array.from({ length: 3 * scale * scale }, () => [flowers[Math.floor(rand() * flowers.length)], Math.round(rand() * (f.W - 60)), Math.round(rand() * (f.H - 60)), 52, 56]);
    return finish(f, { id: `field_${scale}x`, name: `Field (${scale}×)`, ground: { base: '#71904e', tiles: ['w0000', 'w0001', 'w0002'], patches }, decor });
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
    const flowers = ['w0091', 'w0110', 'w0121', 'w0034'];
    const decor = Array.from({ length: 2 * scale * scale }, () => [flowers[Math.floor(rand() * flowers.length)], Math.round(rand() * (f.W - 60)), Math.round(rand() * (f.H - 60)), 52, 56]).filter((d) => Number(d[1]) + 52 < river.x - 20 || Number(d[1]) > river.x + river.w + 20);
    return {
      ...finish(f, { id: `ford_${scale}x`, name: `River ford (${scale}×)`, ground: { base: '#71904e', tiles: ['w0000', 'w0001', 'w0002'], patches: [], waters: [river] }, decor }),
      slow: [{ ...river, factor: FORD_SLOW }],
    };
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

  const GENERATORS = { forest, field, ford };
  const built = new Map();

  /** Build a generated map record from the data (once; later calls get the same object). @param {any} rec */
  function build(rec) {
    if (!rec.generate) return rec;
    if (built.has(rec.id)) return built.get(rec.id);
    const g = rec.generate;
    const map = { ...GENERATORS[g.kind](g.scale, g.seed), id: rec.id, name: rec.name, small: rec.small || null };
    built.set(rec.id, map);
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

  CL.arena = { KINDS, FORD_SLOW, forest, field, ford, build, mapFor };
})(typeof window !== 'undefined' ? window : globalThis);
