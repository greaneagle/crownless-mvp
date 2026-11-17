// @ts-check
/* Crownless generated arenas (PROTO-A, the camera test run). A forest battlefield several screens
 * across, built in code with its own fixed seed (never the campaign's randomness), in the same format
 * as data/battle_maps.js plus a world size (`width`, `height`) and movement `bounds`. Throwaway for
 * the prototype: V2-05 decides how real large arenas are made. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

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

  /**
   * A forest arena `scale` screens wide and high (3 = 2880×1620): scattered trees (block arrows) and
   * bushes (low cover), clearings, open ground around both spawns, and the forest clearing's palette.
   * @param {number} [scale] @param {number} [seed]
   */
  function forest(scale = 3, seed = 7) {
    const rand = mulberry(seed);
    const W = CL.W * scale;
    const H = CL.H * scale;
    const hero = { x: Math.round(W * 0.18), y: Math.round(H / 2) };
    const enemies = { x0: Math.round(W * 0.76), x1: Math.round(W * 0.92), y0: Math.round(H * 0.28), y1: Math.round(H * 0.72) };
    const keepClear = [
      { x: hero.x - 120, y: hero.y, r: 300 },
      { x: (enemies.x0 + enemies.x1) / 2, y: (enemies.y0 + enemies.y1) / 2, r: 330 },
    ];
    const clearings = Array.from({ length: 2 * scale }, () => ({ x: 200 + rand() * (W - 400), y: 150 + rand() * (H - 300), rx: 140 + rand() * 160, ry: 90 + rand() * 90 }));
    const open = (x, y, pad) =>
      keepClear.every((k) => Math.hypot(x - k.x, y - k.y) > k.r + pad) && clearings.every((c) => ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 > 1);
    const obstacles = [];
    const place = (n, minGap, make) => {
      for (let tries = 0, made = 0; made < n && tries < n * 40; tries++) {
        const x = 80 + rand() * (W - 160);
        const y = 110 + rand() * (H - 200);
        if (!open(x, y, 20) || obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) continue;
        obstacles.push(make(Math.round(x), Math.round(y)));
        made++;
      }
    };
    // About as dense as the forest clearing (9 trees, 4 bushes a screen), spread over the arena.
    place(9 * scale * scale, 95, (x, y) => ({ shape: 'circle', x, y, r: 20, blocksArrows: true, look: { tile: 'w0132', w: 92, h: 97 } }));
    place(4 * scale * scale, 60, (x, y) => ({ shape: 'circle', x, y, r: 14, blocksArrows: false, look: { tile: ['w0001', 'w0002', 'w0003'][Math.floor(rand() * 3)], w: 38, h: 30 } }));
    const decor = Array.from({ length: 4 * scale * scale }, () => [rand() < 0.5 ? 'w0147' : 'w0167', Math.round(rand() * (W - 50)), Math.round(rand() * (H - 40)), 40, 31]);
    return {
      id: `forest_arena_${scale}x`,
      name: `Forest arena (${scale}×)`,
      tileset: '16x16',
      width: W,
      height: H,
      bounds: { minX: 47, maxX: W - 52, minY: 65, maxY: H - 50 },
      ground: { base: '#4f7140', tiles: ['w0000', 'w0050', 'w0003'], patches: clearings.map((c) => ({ color: '#6f8a4c', ...c })) },
      decor,
      obstacles,
      spawn: { hero, enemies },
    };
  }

  CL.arena = { forest };
})(typeof window !== 'undefined' ? window : globalThis);
