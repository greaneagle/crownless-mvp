// @ts-check
/* Crownless spatial grid (W-07): which world parties are near a point, without looking at all of them.
 *
 * The map is cut into square cells of CELL map units. A grid is built from a list of parties (each
 * step of the world simulation builds one), and `near` returns every party whose cell could hold a
 * point within `range` of (x, y) in gameplay distance (CL.world.mapDist: a unit north–south counts
 * `aspect` of one east–west, so the north–south reach is range / aspect). Callers still measure the
 * exact distance; the grid only narrows the search. Results come back in the order of the list the
 * grid was built from, so code that picks "the first, nearest" picks exactly what a full scan would. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const CELL = 10; // map units

  const key = (cx, cy) => `${cx},${cy}`;

  /**
   * @template {{ x: number, y: number }} T
   * @param {T[]} items @param {number} [cell] @returns {{ cell: number, aspect: number, cells: Map<string, number[]>, items: T[] }}
   */
  function build(items, cell = CELL) {
    const cells = new Map();
    items.forEach((p, i) => {
      const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell));
      const list = cells.get(k);
      if (list) list.push(i);
      else cells.set(k, [i]);
    });
    return { cell, aspect: CL.world?.map?.().aspect ?? 1, cells, items }; // the world's aspect, read once
  }

  /**
   * Everything that may lie within `range` of (x, y), in the order the grid was built from.
   * @template T @param {{ cell: number, aspect: number, cells: Map<string, number[]>, items: T[] }} grid
   * @param {number} x @param {number} y @param {number} range @returns {T[]}
   */
  function near(grid, x, y, range) {
    const rx = range;
    const ry = range / Math.max(1e-9, grid.aspect);
    const c = grid.cell;
    const found = [];
    for (let cx = Math.floor((x - rx) / c); cx <= Math.floor((x + rx) / c); cx++) {
      for (let cy = Math.floor((y - ry) / c); cy <= Math.floor((y + ry) / c); cy++) {
        const list = grid.cells.get(key(cx, cy));
        if (list) for (const i of list) found.push(i);
      }
    }
    found.sort((a, b) => a - b);
    return found.map((i) => grid.items[i]);
  }

  CL.spatial = { CELL, build, near };
})(typeof window !== 'undefined' ? window : globalThis);
