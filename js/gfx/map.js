/* Crownless graphics demonstration (experimental, debug only): the strategic map.
 *
 * A small march of its own (not the campaign's world): grass, a river with a bridge and a ford, a
 * mountain range, hills, woods, a lake, the coast and a harbour, Stonebridge (a walled city), Greywall
 * (a castle), villages of two cultures, roads, and parties of every kind moving on them. Tap or click to
 * travel (a route is found round mountains and water), or steer with the keys or the stick.
 * Everything is in map pixels; the camera follows the party, with zoom from 0.5× to 1.6×.
 * The terrain is built once from a fixed seed; nothing here is random while drawing. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, poly, fillLine, fill, tone } = G;
  G.scenes = G.scenes || {};

  const MW = 2400;
  const MH = 1500;
  const CELL = 20;
  const ZOOM = { min: 0.5, max: 1.6 };
  const SPEED = 125; // map px a second on open grass

  // ---- The land (data) ----

  const SEA = [2060, 0, 2020, 170, 2085, 320, 2010, 470, 2070, 630, 1990, 800, 2040, 930, 1960, 1040, 2060, 1150, 2190, 1230, 2300, 1360, 2400, 1420, 2400, 0];
  const RIVER = [[830, 40], [870, 190], [810, 320], [900, 440], [1040, 520], [1180, 585], [1330, 640], [1500, 710], [1690, 760], [1870, 795], [2000, 810]];
  const LAKE = { x: 520, y: 1210, rx: 95, ry: 52 };
  const ROADS = [
    // [from, to, points between]
    ['stonebridge', 'greywall', [[1040, 560], [900, 520], [760, 470]]],
    ['stonebridge', 'brackenfield', [[1000, 700], [880, 800]]],
    ['brackenfield', 'highmere', [[650, 740], [520, 650]]],
    ['highmere', 'greywall', [[520, 480]]],
    ['stonebridge', 'oakford', [[1180, 760], [1290, 860]]],
    ['oakford', 'saltwick', [[1550, 950], [1780, 1000]]],
    ['stonebridge', 'ford', [[1250, 660], [1400, 700]]],
    ['ford', 'ulfstead', [[1560, 560], [1600, 400]]],
    ['brackenfield', 'south', [[850, 1000], [800, 1200], [760, 1460]]],
  ];
  const PLACES = {
    stonebridge: { x: 1110, y: 640, kind: 'city', name: 'Stonebridge', realm: 'valedorn', blurb: 'The march capital: a walled city on the river, its bridge the only one for days.' },
    greywall: { x: 650, y: 420, kind: 'castle', name: 'Greywall', realm: 'valedorn', blurb: 'A Valedorn castle watching the passes.' },
    brackenfield: { x: 820, y: 860, kind: 'village', name: 'Brackenfield', realm: 'valedorn', seed: 4 },
    highmere: { x: 470, y: 600, kind: 'village', name: 'Highmere', realm: 'valedorn', seed: 9 },
    oakford: { x: 1330, y: 900, kind: 'village', name: 'Oakford', realm: 'valedorn', seed: 2 },
    ulfstead: { x: 1640, y: 330, kind: 'village', name: 'Ulfstead', realm: 'hrothmark', seed: 6, blurb: 'A Hrothmark steading of timber halls.' },
    saltwick: { x: 1915, y: 1010, kind: 'harbour', name: 'Saltwick', realm: 'valedorn', seed: 11, blurb: 'Fishing boats and salt sheds on the bay.' },
    ford: { x: 1500, y: 712, kind: 'crossing', name: 'Hartford', realm: null },
    south: { x: 760, y: 1470, kind: 'edge', name: '', realm: null },
  };
  const BRIDGE = { x: 1043, y: 540, a: 0.45 };
  const FORESTS = [
    { x: 300, y: 830, r: 200, n: 120, kind: 'broad' },
    { x: 1420, y: 250, r: 170, n: 95, kind: 'pine' },
    { x: 1830, y: 420, r: 110, n: 44, kind: 'pine' },
    { x: 1000, y: 1190, r: 180, n: 90, kind: 'broad' },
    { x: 1560, y: 1230, r: 125, n: 50, kind: 'birch' },
    { x: 1190, y: 330, r: 80, n: 24, kind: 'broad' },
  ];
  const RANGE = { x0: 40, x1: 780, y0: 70, y1: 300 };

  // ---- Building the land (once) ----

  function init(S) {
    const r = G.rng(20261125);
    const trees = [];
    for (const f of FORESTS) {
      for (let i = 0, tries = 0; i < f.n && tries < f.n * 30; tries++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * f.r;
        const x = f.x + Math.cos(a) * d;
        const y = f.y + Math.sin(a) * d * 0.7;
        if (!dry(x, y, 14) || nearRoad(x, y) < 18 || nearPlace(x, y) < 70) continue;
        trees.push({ x, y, kind: f.kind === 'birch' && r() < 0.5 ? 'broad' : f.kind, v: Math.floor(r() * 6), s: r() < 0.5 ? 0.5 : 0.58 });
        i++;
      }
    }
    // Lone trees on the grass.
    for (let i = 0; i < 60; i++) {
      const x = 80 + r() * (MW - 300);
      const y = 300 + r() * (MH - 380);
      if (dry(x, y, 20) && nearRoad(x, y) > 22 && nearPlace(x, y) > 80 && !inRange(x, y)) trees.push({ x, y, kind: r() < 0.25 ? 'pine' : 'broad', v: Math.floor(r() * 6), s: 0.5 });
    }
    const peaks = [];
    for (let i = 0; i < 90; i++) {
      const x = RANGE.x0 + r() * (RANGE.x1 - RANGE.x0);
      const y = RANGE.y0 + r() * (RANGE.y1 - RANGE.y0) * (1 - Math.abs(x - 410) / 650);
      if (peaks.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) < 58)) continue;
      peaks.push({ x, y, s: 1.15 + r() * 0.7 * (1 - (y - RANGE.y0) / 400), v: Math.floor(r() * 5), snow: y < 190 });
    }
    // A few peaks in the north-east too.
    for (const [x, y, s] of [[1930, 140, 1.3], [1985, 215, 1.0], [1860, 95, 1.2], [1800, 160, 0.9]]) peaks.push({ x, y, s, v: 2, snow: true });
    const hills = [];
    for (let i = 0; i < 40; i++) {
      const near = i < 22;
      const x = near ? RANGE.x0 + r() * (RANGE.x1 - RANGE.x0 + 120) : 1500 + r() * 420;
      const y = near ? RANGE.y1 + r() * 140 : 140 + r() * 380;
      if (!dry(x, y, 30) || nearRoad(x, y) < 26 || nearPlace(x, y) < 80) continue;
      hills.push({ x, y, s: 0.8 + r() * 0.5 });
    }
    const tint = [];
    for (let i = 0; i < 34; i++) tint.push({ x: r() * MW, y: r() * MH, rx: 120 + r() * 220, ry: 70 + r() * 120, c: r() < 0.55 ? PAL.grassLight : r() < 0.6 ? PAL.meadow : PAL.grassDark });
    const fields = [];
    for (const p of Object.values(PLACES)) {
      if (p.kind !== 'village') continue;
      const fr = G.rng(p.seed * 31);
      for (let i = 0; i < 5; i++) {
        const a = fr() * Math.PI * 2;
        const d = 60 + fr() * 50;
        const x = p.x + Math.cos(a) * d;
        const y = p.y + Math.sin(a) * d * 0.6 + 12;
        if (!dry(x, y, 30) || nearRoad(x, y) < 14) continue;
        fields.push({ x, y, w: 46 + fr() * 30, h: 26 + fr() * 14, a: (fr() - 0.5) * 0.5, c: p.realm === 'hrothmark' ? (fr() < 0.5 ? '#9fb36a' : '#b8a96a') : fr() < 0.5 ? PAL.field : PAL.fieldGreen });
      }
    }
    const tufts = [];
    for (let i = 0; i < 260; i++) {
      const x = r() * MW;
      const y = r() * MH;
      if (dry(x, y, 6)) tufts.push({ x, y, f: r() < 0.18 ? ['#f2e2a0', '#e9a6a0', '#c9c2e8'][Math.floor(r() * 3)] : null });
    }
    S.mapLand = { trees, peaks, hills, tint, fields, tufts, grid: grid(trees, peaks) };
    S.map = freshMap();
  }

  function freshMap() {
    return {
      player: { x: 930, y: 790, face: 'right', walk: 0, move: 0, path: null, dest: null },
      cam: { x: 930 - 480, y: 790 - 270, zoom: 1 },
      parties: parties(),
      near: null,
      hover: null,
      encounter: null,
      calm: 0,
      tapAt: null,
    };
  }

  /** The moving parties: who they are, how they look, where they go. */
  function parties() {
    const P = (id, o) => ({ id, x: PLACES[o.route[0]].x + 10, y: PLACES[o.route[0]].y + 22, i: 0, dir: 1, walk: 0, move: 0, face: 'right', wait: o.wait ?? 1, path: null, ...o });
    return [
      P('patrol', { name: 'Valedorn Patrol', kind: 'patrol', realm: 'valedorn', stance: 'friendly', route: ['stonebridge', 'greywall'], speed: 70, troops: ['footman', 'footman'] }),
      P('lord', { name: 'Lord Edric Ardane', kind: 'lord', realm: 'valedorn', stance: 'friendly', route: ['stonebridge', 'oakford', 'stonebridge', 'brackenfield'], speed: 62, troops: ['rider', 'rider'] }),
      P('caravan', { name: 'Merchant caravan', kind: 'caravan', realm: 'merchant', stance: 'neutral', route: ['stonebridge', 'oakford', 'saltwick'], speed: 46, troops: ['merchant', 'guard'] }),
      P('raiders', { name: 'Hrothmark Raiders', kind: 'warband', realm: 'hrothmark', stance: 'hostile', route: ['ulfstead', 'ford'], speed: 58, troops: ['axeman', 'clansman', 'fell_archer'], hunts: true, battle: 'hrothmark' }),
      P('reavers', { name: 'Road Reavers', kind: 'bandits', realm: 'reavers', stance: 'hostile', route: ['highmere', 'brackenfield'], speed: 60, troops: ['reaver', 'looter'], hunts: true, battle: 'reavers', roam: { x: 340, y: 760, r: 200 } }),
      P('hroth_patrol', { name: 'Hrothmark Patrol', kind: 'patrol', realm: 'hrothmark', stance: 'hostile', route: ['ulfstead'], speed: 0, troops: ['shieldmaiden', 'axeman'], hunts: false }),
    ];
  }

  // ---- Terrain tests ----

  function inPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  function lineDist(pts, x, y) {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    return d;
  }
  const riverWidth = (x) => 16 + Math.max(0, (x - 1000) / 1000) * 14;
  const roadLines = () => ROADS.map(([a, b, mid]) => [[PLACES[a].x, PLACES[a].y], ...mid, [PLACES[b].x, PLACES[b].y]]);
  let ROAD_LINES = null;
  const roadsOf = () => (ROAD_LINES ??= roadLines());
  const nearRoad = (x, y) => Math.min(...roadsOf().map((l) => lineDist(l, x, y)));
  const nearPlace = (x, y) => Math.min(...Object.values(PLACES).filter((p) => p.kind !== 'edge').map((p) => Math.hypot(p.x - x, p.y - y)));
  const inRange = (x, y) => x > RANGE.x0 - 20 && x < RANGE.x1 + 20 && y > RANGE.y0 - 20 && y < RANGE.y1 - 10;
  const inLake = (x, y, pad = 0) => ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((y - LAKE.y) / (LAKE.ry + pad)) ** 2 < 1;
  const inRiver = (x, y, pad = 0) => lineDist(RIVER, x, y) < riverWidth(x) / 2 + pad;
  /** Land, not water (with a margin). */
  function dry(x, y, pad = 0) {
    if (x < 0 || y < 0 || x > MW || y > MH) return false;
    if (inPoly(SEA, x + pad, y) || inPoly(SEA, x, y)) return false;
    return !inRiver(x, y, pad) && !inLake(x, y, pad);
  }

  /** The travel grid: the cost of each cell (Infinity where nothing passes). */
  function grid(trees, peaks) {
    const cols = Math.ceil(MW / CELL);
    const rows = Math.ceil(MH / CELL);
    const cost = new Float32Array(cols * rows);
    const crossings = [BRIDGE, PLACES.ford];
    const woods = new Uint8Array(cols * rows);
    for (const t of trees) woods[Math.floor(t.y / CELL) * cols + Math.floor(t.x / CELL)] = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL + CELL / 2;
        const y = r * CELL + CELL / 2;
        let v = 1;
        if (crossings.some((k) => Math.hypot(k.x - x, k.y - y) < 26)) v = 0.7;
        else if (!dry(x, y)) v = Infinity;
        else if (peaks.some((p) => Math.abs(p.x - x) < 34 * p.s && y < p.y + 6 && y > p.y - 40 * p.s)) v = Infinity;
        else if (nearRoad(x, y) < 9) v = 0.55;
        else if (woods[r * cols + c]) v = 1.7;
        cost[r * cols + c] = v;
      }
    }
    return { cols, rows, cost };
  }

  /** A* over the grid, from and to map points. @returns {number[][] | null} waypoints */
  function route(Gr, from, to) {
    const { cols, rows, cost } = Gr;
    const idx = (x, y) => Math.max(0, Math.min(rows - 1, Math.floor(y / CELL))) * cols + Math.max(0, Math.min(cols - 1, Math.floor(x / CELL)));
    const start = idx(from.x, from.y);
    let goal = idx(to.x, to.y);
    if (!Number.isFinite(cost[goal])) {
      // The nearest passable cell to the tap.
      let best = -1;
      let bd = Infinity;
      const [gc, gr] = [goal % cols, Math.floor(goal / cols)];
      for (let dr = -6; dr <= 6; dr++)
        for (let dc = -6; dc <= 6; dc++) {
          const c = gc + dc;
          const r = gr + dr;
          if (c < 0 || r < 0 || c >= cols || r >= rows || !Number.isFinite(cost[r * cols + c])) continue;
          const d = dc * dc + dr * dr;
          if (d < bd) [bd, best] = [d, r * cols + c];
        }
      if (best < 0) return null;
      goal = best;
    }
    const g = new Float32Array(cols * rows).fill(Infinity);
    const came = new Int32Array(cols * rows).fill(-1);
    const heap = [[0, start]];
    g[start] = 0;
    const hx = goal % cols;
    const hy = Math.floor(goal / cols);
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    let steps = 0;
    while (heap.length && steps++ < 40000) {
      const [, cur] = pop();
      if (cur === goal) break;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx;
          const c = cost[n];
          if (!Number.isFinite(c)) continue;
          if (dx && dy && (!Number.isFinite(cost[cy * cols + nx]) || !Number.isFinite(cost[ny * cols + cx]))) continue; // no corner cutting
          const step = (dx && dy ? Math.SQRT2 : 1) * (c + cost[cur]) * 0.5;
          if (g[cur] + step < g[n]) {
            g[n] = g[cur] + step;
            came[n] = cur;
            push([g[n] + Math.hypot(nx - hx, ny - hy) * 0.55, n]);
          }
        }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const cells = [];
    for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push(c);
    cells.reverse();
    // Keep every few cells (smooth enough), and end on the tap itself when it is passable.
    const pts = cells.filter((_, i) => i % 3 === 2 || i === cells.length - 1).map((c) => [(c % cols) * CELL + CELL / 2, Math.floor(c / cols) * CELL + CELL / 2]);
    if (Number.isFinite(cost[idx(to.x, to.y)])) pts.push([to.x, to.y]);
    return pts;
  }

  const costAt = (S, x, y) => {
    const Gr = S.mapLand.grid;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= Gr.cols || r >= Gr.rows) return Infinity;
    return Gr.cost[r * Gr.cols + c];
  };

  // ---- Update ----

  function step(S, who, dt, speed) {
    // Follow a path of waypoints; returns true on arrival.
    if (!who.path?.length) {
      who.move = Math.max(0, who.move - dt * 4);
      return true;
    }
    const [tx, ty] = who.path[0];
    const dx = tx - who.x;
    const dy = ty - who.y;
    const d = Math.hypot(dx, dy);
    const c = costAt(S, who.x, who.y);
    const v = (speed / (Number.isFinite(c) ? c : 1)) * dt;
    if (d <= v) {
      who.x = tx;
      who.y = ty;
      who.path.shift();
    } else {
      who.x += (dx / d) * v;
      who.y += (dy / d) * v;
    }
    who.face = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    who.move = Math.min(1, who.move + dt * 4);
    who.walk += dt * 9;
    return false;
  }

  function update(S, dt, api) {
    const M = S.map;
    const p = M.player;
    if (!M.encounter) {
      const m = api.move();
      if (m.m > 0.1) {
        // Steering: one short step at a time, blocked by water and mountains.
        p.path = null;
        p.dest = null;
        const c = costAt(S, p.x, p.y);
        const v = (SPEED / (Number.isFinite(c) ? c : 1)) * dt * m.m;
        const nx = p.x + m.x * v;
        const ny = p.y + m.y * v;
        if (Number.isFinite(costAt(S, nx, ny))) [p.x, p.y] = [nx, ny];
        else if (Number.isFinite(costAt(S, nx, p.y))) p.x = nx;
        else if (Number.isFinite(costAt(S, p.x, ny))) p.y = ny;
        p.face = Math.abs(m.x) > Math.abs(m.y) * 0.8 ? (m.x < 0 ? 'left' : 'right') : m.y < 0 ? 'up' : 'down';
        p.move = Math.min(1, p.move + dt * 5);
        p.walk += dt * 10;
      } else if (step(S, p, dt, SPEED)) p.dest = null;
    }
    M.calm = Math.max(0, M.calm - dt);
    for (const q of M.parties) moveParty(S, q, dt);
    // The nearest settlement (to enter or look at).
    M.near = null;
    for (const [id, pl] of Object.entries(PLACES)) {
      if (!pl.name || pl.kind === 'crossing') continue;
      if (Math.hypot(pl.x - p.x, pl.y - p.y) < (pl.kind === 'city' ? 70 : 50)) M.near = id;
    }
    // Hostile bands that catch the party.
    if (!M.encounter && M.calm <= 0) {
      for (const q of M.parties) {
        if (q.stance !== 'hostile' || q.beaten || !q.battle) continue;
        if (Math.hypot(q.x - p.x, q.y - p.y) < 26) {
          M.encounter = q.id;
          p.path = null;
          q.path = null;
          encounterCard(S, q, api);
          break;
        }
      }
    }
    follow(M, dt);
  }

  function moveParty(S, q, dt) {
    if (q.beaten) return;
    const p = S.map.player;
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (q.hunts && S.map.calm <= 0 && !S.map.encounter && dist < 170) {
      // A hostile band that sees the party runs at it.
      q.path = [[p.x, p.y]];
      q.chasing = true;
      step(S, q, dt, q.speed * 1.35);
      return;
    }
    q.chasing = false;
    if (S.map.encounter === q.id) return;
    if (!q.speed) {
      // Standing guard: pace a little.
      q.walk += dt * 2;
      q.face = Math.sin(S.t * 0.4 + 1) > 0 ? 'right' : 'left';
      return;
    }
    if (step(S, q, dt, q.speed)) {
      q.wait -= dt;
      if (q.wait > 0) return;
      q.wait = 1.5 + G.hash(q.id.length, q.i) * 2;
      if (q.roam && G.hash(q.i, 7) < 0.6) {
        // Bandits wander off the road into their woods.
        const a = G.hash(q.i, 3) * Math.PI * 2;
        const to = { x: q.roam.x + Math.cos(a) * q.roam.r * 0.7, y: q.roam.y + Math.sin(a) * q.roam.r * 0.5 };
        q.path = route(S.mapLand.grid, q, to);
        q.i++;
        return;
      }
      q.i = (q.i + 1) % q.route.length;
      const pl = PLACES[q.route[q.i]];
      q.path = route(S.mapLand.grid, q, { x: pl.x + 8, y: pl.y + 20 });
    }
  }

  function encounterCard(S, q, api) {
    const n = q.battle === 'hrothmark' ? 16 : 14;
    api.card({
      title: q.name,
      lines: [q.battle === 'hrothmark' ? `A Hrothmark war party of about ${n} bars the road: axes, round shields, a few bows and two hill riders.` : `A band of about ${n} road reavers steps out of the trees. They want your purse.`, 'Your company: about 18, with spears, bows and two riders. (A demonstration battle: nothing in your campaign changes.)'],
      buttons: [
        { label: 'Fight', primary: true, onClick: () => fight(S, q, api) },
        { label: 'Withdraw', onClick: () => withdraw(S, q, api) },
      ],
    });
  }

  function fight(S, q, api) {
    api.card(null);
    S.battleFrom = { party: q.id, enemy: q.battle };
    api.go('battle', { enemy: q.battle, from: 'map' });
  }

  function withdraw(S, q, api) {
    api.card(null);
    const M = S.map;
    M.encounter = null;
    M.calm = 6; // the band lets you go
    const p = M.player;
    const [dx, dy] = [p.x - q.x, p.y - q.y];
    const d = Math.hypot(dx, dy) || 1;
    p.path = route(S.mapLand.grid, p, { x: p.x + (dx / d) * 90, y: p.y + (dy / d) * 90 });
  }

  function follow(M, dt) {
    const c = M.cam;
    const vw = 960 / c.zoom;
    const vh = 540 / c.zoom;
    const tx = Math.max(0, Math.min(MW - vw, M.player.x - vw / 2));
    const ty = Math.max(0, Math.min(MH - vh, M.player.y - vh / 2));
    const k = 1 - Math.exp(-5 * dt);
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
  }

  function setZoom(M, z, at = { x: 480, y: 270 }) {
    const c = M.cam;
    const nz = Math.max(ZOOM.min, Math.min(ZOOM.max, z));
    const wx = c.x + at.x / c.zoom;
    const wy = c.y + at.y / c.zoom;
    c.zoom = nz;
    c.x = Math.max(0, Math.min(MW - 960 / nz, wx - at.x / nz));
    c.y = Math.max(0, Math.min(MH - 540 / nz, wy - at.y / nz));
  }

  // ---- Drawing ----

  function draw(ctx, S, api) {
    const M = S.map;
    const L = S.mapLand;
    const c = M.cam;
    const z = c.zoom;
    const t = S.t;
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-c.x, -c.y);
    const v = { x: c.x, y: c.y, w: 960 / z, h: 540 / z };
    const seen = (x, y, m) => x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    for (const p of L.tint) {
      if (!seen(p.x, p.y, Math.max(p.rx, p.ry))) continue;
      ctx.globalAlpha = 0.32;
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, p.c);
    }
    // Forest floors: a darker soft ground under each wood, so its trees read as one forest.
    ctx.globalAlpha = 0.28;
    for (const f of FORESTS) if (seen(f.x, f.y, f.r)) {
      ellipse(ctx, f.x, f.y + 6, f.r * 0.98, f.r * 0.66);
      fill(ctx, PAL.forestDark);
    }
    ctx.globalAlpha = 1;
    // Fields: soft patches with rows.
    for (const f of L.fields) {
      if (!seen(f.x, f.y, 60)) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.a);
      G.rrect(ctx, -f.w / 2, -f.h / 2, f.w, f.h, 4);
      fill(ctx, f.c);
      ctx.strokeStyle = tone(f.c, -0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let yy = -f.h / 2 + 4; yy < f.h / 2; yy += 4.5) {
        ctx.moveTo(-f.w / 2 + 3, yy);
        ctx.lineTo(f.w / 2 - 3, yy);
      }
      ctx.stroke();
      ctx.restore();
    }
    drawWater(ctx, t, z);
    drawRoads(ctx, z);
    drawBridge(ctx);
    // Tufts (only zoomed in; they would be noise further out).
    if (z > 0.8) for (const q of L.tufts) if (seen(q.x, q.y, 10)) G.tuft(ctx, q.x, q.y, 0.7, PAL.grassDark, q.f);

    // Everything standing, in depth order.
    const k = api.k * z;
    const items = [];
    for (const h of L.hills) if (seen(h.x, h.y, 60)) items.push([h.y, () => hill(ctx, h.x, h.y, h.s)]);
    for (const p of L.peaks) if (seen(p.x, p.y, 70)) items.push([p.y, () => peak(ctx, p, k)]);
    for (const tr of L.trees) if (seen(tr.x, tr.y, 30)) items.push([tr.y, () => mapTree(ctx, tr, k, t)]);
    for (const [id, pl] of Object.entries(PLACES)) if (seen(pl.x, pl.y, 120) && GLYPH[pl.kind]) items.push([pl.y, () => GLYPH[pl.kind](ctx, pl.x, pl.y, 1, t, pl, k, id)]);
    const ps = partyScale(z);
    for (const q of M.parties) if (!q.beaten && seen(q.x, q.y, 40)) items.push([q.y, () => party(ctx, q, ps, t, S)]);
    items.push([M.player.y, () => playerParty(ctx, M.player, ps, t)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, paint] of items) paint();

    // The route and its end.
    const p = M.player;
    if (p.path?.length) {
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(255,246,214,0.85)';
      ctx.lineWidth = 2 / Math.max(0.7, z);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (const [x, y] of p.path) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      const [ex, ey] = p.path[p.path.length - 1];
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2.2 / Math.max(0.7, z);
      ellipse(ctx, ex, ey, 7, 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  const partyScale = (z) => (0.74 * z ** 0.35) / z;

  function drawWater(ctx, t, _z) {
    // The sea: a sand rim, the water, a lighter shallows band and slow ripples.
    poly(ctx, SEA);
    ctx.strokeStyle = PAL.sand;
    ctx.lineWidth = 22;
    ctx.lineJoin = 'round';
    ctx.stroke();
    fill(ctx, PAL.water);
    ctx.save();
    poly(ctx, SEA);
    ctx.clip();
    ctx.strokeStyle = PAL.waterLight;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 9;
    poly(ctx, SEA);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = 2080 + ((i * 137) % 300) + Math.sin(t * 0.5 + i) * 6;
      const y = 60 + ((i * 251) % 1320);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 7, y - 4, x + 14, y);
    }
    ctx.stroke();
    ctx.restore();
    // River: banks, water, a light thread down the middle.
    ctx.lineCap = 'round';
    for (const [w, color, a] of [[10, PAL.bank, 1], [0, PAL.water, 1], [-10, PAL.waterLight, 0.5]]) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = color;
      for (let i = 1; i < RIVER.length; i++) {
        ctx.lineWidth = Math.max(2, riverWidth(RIVER[i][0]) + w);
        ctx.beginPath();
        ctx.moveTo(RIVER[i - 1][0], RIVER[i - 1][1]);
        ctx.lineTo(RIVER[i][0], RIVER[i][1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // The lake.
    ellipse(ctx, LAKE.x, LAKE.y, LAKE.rx + 7, LAKE.ry + 6);
    fill(ctx, PAL.bank);
    ellipse(ctx, LAKE.x, LAKE.y, LAKE.rx, LAKE.ry);
    fill(ctx, PAL.water);
    ellipse(ctx, LAKE.x - 18, LAKE.y - 10, LAKE.rx * 0.5, LAKE.ry * 0.35);
    ctx.globalAlpha = 0.5;
    fill(ctx, PAL.waterLight);
    ctx.globalAlpha = 1;
    // The ford: pale shallows and stepping stones.
    const f = PLACES.ford;
    ellipse(ctx, f.x, f.y, 24, 16);
    ctx.globalAlpha = 0.65;
    fill(ctx, PAL.waterLight);
    ctx.globalAlpha = 1;
    for (const [dx, dy] of [[-10, -9], [-3, -3], [4, 3], [11, 9]]) {
      ellipse(ctx, f.x + dx, f.y + dy, 3.4, 2.2);
      fillLine(ctx, PAL.rock, 0.9);
    }
    ctx.lineCap = 'butt';
  }

  function drawRoads(ctx, z) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, color] of [[9, PAL.roadEdge], [6, PAL.road]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const l of roadsOf()) {
        ctx.moveTo(l[0][0], l[0][1]);
        // Smooth through the midpoints so the roads curve rather than kink.
        for (let i = 1; i < l.length - 1; i++) ctx.quadraticCurveTo(l[i][0], l[i][1], (l[i][0] + l[i + 1][0]) / 2, (l[i][1] + l[i + 1][1]) / 2);
        ctx.lineTo(l[l.length - 1][0], l[l.length - 1][1]);
      }
      ctx.stroke();
    }
    if (z > 0.9) {
      // Wheel ruts, faint.
      ctx.strokeStyle = 'rgba(150,125,80,0.35)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([6, 9]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineCap = 'butt';
  }

  function drawBridge(ctx) {
    const b = BRIDGE;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(-15, -5, 34, 14);
    G.rrect(ctx, -18, -8, 36, 15, 3);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(-17, 3, 34, 3.5);
    ctx.strokeStyle = PAL.stoneDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [-9, 0, 9]) {
      ctx.moveTo(x, -7);
      ctx.lineTo(x, 6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function hill(ctx, x, y, s) {
    ctx.fillStyle = STYLE.shadow;
    ellipse(ctx, x + 10 * s, y + 2, 38 * s, 9 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 38 * s, y);
    ctx.quadraticCurveTo(x - 20 * s, y - 26 * s, x + 2 * s, y - 24 * s);
    ctx.quadraticCurveTo(x + 26 * s, y - 22 * s, x + 38 * s, y);
    ctx.closePath();
    fillLine(ctx, '#8fae6c', STYLE.line * 0.9);
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 24 * s);
    ctx.quadraticCurveTo(x + 26 * s, y - 22 * s, x + 38 * s, y);
    ctx.lineTo(x + 12 * s, y);
    ctx.quadraticCurveTo(x + 10 * s, y - 14 * s, x + 2 * s, y - 24 * s);
    fill(ctx, '#7f9d5f');
    ctx.fillStyle = '#a3bf7d';
    ellipse(ctx, x - 14 * s, y - 16 * s, 10 * s, 4 * s);
    ctx.fill();
  }

  function peak(ctx, p, k) {
    const s = p.s;
    const w = 46 * s;
    const h = 62 * s;
    const img = G.cached(`peak${p.v}${p.snow ? 's' : ''}${s.toFixed(2)}`, k, w * 2 + 30, h + 20, w + 10, h + 8, (cx) => peakShape(cx, 0, 0, s, p.v, p.snow));
    ctx.drawImage(img, p.x - (w + 10), p.y - (h + 8), (w * 2 + 30), h + 20);
  }
  function peakShape(ctx, x, y, s, v, snow) {
    const r = G.rng(v * 11 + 1);
    const w = (40 + r() * 10) * s;
    const h = (50 + r() * 12) * s;
    const tx = x + (r() - 0.5) * 10 * s;
    ctx.fillStyle = STYLE.shadow;
    poly(ctx, [x + w, y, x + w + h * 0.35, y + 4, tx + h * 0.2, y - h * 0.4]);
    ctx.fill();
    poly(ctx, [x - w, y, tx, y - h, x + w, y]);
    fillLine(ctx, PAL.mountain);
    poly(ctx, [tx, y - h, x + w, y, tx + w * 0.15, y]);
    fill(ctx, PAL.mountainShade);
    // A ridge line, and a lit facet.
    poly(ctx, [tx, y - h, x - w * 0.45, y - h * 0.35, tx - w * 0.2, y - h * 0.45]);
    fill(ctx, tone(PAL.mountain, 0.15));
    if (snow) {
      poly(ctx, [tx, y - h, tx - h * 0.2, y - h * 0.68, tx - h * 0.07, y - h * 0.72, tx + h * 0.04, y - h * 0.64, tx + h * 0.19, y - h * 0.7]);
      fillLine(ctx, PAL.snow, STYLE.line * 0.8);
    }
    ctx.fillStyle = '#8fae6c';
    ellipse(ctx, x - w * 0.55, y - 2, w * 0.5, 4 * s);
    ctx.fill();
  }

  function mapTree(ctx, tr, k, _t) {
    const s = tr.s;
    // Drawn once at this zoom (and size), then stamped: a forest is many of the same few trees.
    const img = G.cached(`mtree${tr.kind}${tr.v}`, k * s, 60, 66, 30, 58, (cx) => G.tree(cx, 0, 0, 1, tr.v + 1, tr.kind));
    ctx.drawImage(img, tr.x - 30 * s, tr.y - 58 * s, 60 * s, 66 * s);
  }

  // ---- Settlements (shared with the gallery) ----

  const HOUSE_SPECS = {
    valedorn: [
      { w: 42, h: 18, d: 22, wall: 'plaster', roof: 'terracotta', form: 'end', beams: true },
      { w: 50, h: 20, d: 22, wall: 'plaster', roof: 'terracotta', form: 'gable', beams: true, chimney: 0.6 },
      { w: 40, h: 18, d: 20, wall: 'whitewash', roof: 'thatch', form: 'end' },
      { w: 46, h: 22, d: 24, wall: 'stone', roof: 'slate', form: 'hip' },
    ],
    hrothmark: [
      { w: 58, h: 18, d: 28, wall: 'timber', roof: 'shingle', form: 'long', beams: true, door: 'center', windows: 1 },
      { w: 44, h: 16, d: 24, wall: 'timber', roof: 'turf', form: 'gable', windows: 1 },
      { w: 40, h: 17, d: 22, wall: 'timber', roof: 'shingle', form: 'end', windows: 1 },
    ],
  };

  /** A house at map scale (the town's own building, drawn at about 0.42). */
  function mapHouse(ctx, x, y, s, spec, seed) {
    G.building(ctx, { x, y, s, ...spec, seed, windows: spec.windows ?? 1 }, 0, 0);
  }

  function city(ctx, x, y, s, t, _pl, k = 1, id = 'stonebridge') {
    const S0 = 0.42 * s;
    // The body is static: cached at this zoom; the banners move on top.
    const img = G.cached(`city-${id}`, k, 260, 170, 130, 130, (cx) => cityBody(cx, 0, 0, S0));
    ctx.drawImage(img, x - 130, y - 130, 260, 170);
    G.banner(ctx, x - 2, y - 74 * s, 0.65 * s, 'valedorn', t, 26);
    G.banner(ctx, x - 92 * s, y - 20 * s, 0.5 * s, 'valedorn', t + 1, 22);
    G.banner(ctx, x + 92 * s, y - 20 * s, 0.5 * s, 'valedorn', t + 2, 22);
  }
  function cityBody(ctx, x, y, s) {
    // Back wall, the houses inside, the keep, then the front wall with its gate and towers.
    const R = 220 * s;
    ctx.fillStyle = STYLE.shadow;
    ellipse(ctx, x + 14, y + 4, R * 1.05, R * 0.32);
    ctx.fill();
    ellipse(ctx, x, y - 8 * s, R * 0.95, R * 0.34);
    fill(ctx, PAL.cobble);
    G.cityWall(ctx, x - R * 0.82, y - R * 0.42, x + R * 0.82, s * 1.1, 30);
    G.tower(ctx, x - R * 0.85, y - R * 0.38, s * 1.1, 42, 13, 'slate', 'cone');
    G.tower(ctx, x + R * 0.85, y - R * 0.38, s * 1.1, 42, 13, 'slate', 'cone');
    const r = G.rng(77);
    const spots = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - (row === 1 ? 0 : 1); i++) spots.push([x - R * 0.65 + i * R * 0.33 + (row % 2) * R * 0.15 + (r() - 0.5) * 10 * s, y - R * 0.3 + row * R * 0.13]);
    spots.sort((a, b) => a[1] - b[1]);
    spots.forEach(([hx, hy], i) => {
      if (Math.abs(hx - x) < R * 0.18 && i < 5) return; // the keep's place
      const spec = HOUSE_SPECS.valedorn[Math.floor(r() * 4)];
      mapHouse(ctx, hx, hy, s * 1.05, spec, i + 3);
      if (Math.abs(hx - x) < R * 0.2 && i >= 4 && i < 9) G.tower(ctx, x, y - R * 0.2, s * 1.3, 74, 15, 'slate', 'cone'); // the keep, in the middle
    });
    G.cityWall(ctx, x - R * 0.9, y + 2 * s, x - 26 * s, s * 1.1, 34);
    G.cityWall(ctx, x + 26 * s, y + 2 * s, x + R * 0.9, s * 1.1, 34);
    // Gatehouse.
    G.rrect(ctx, x - 26 * s, y - 52 * s, 52 * s, 54 * s, 3 * s);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(x + 10 * s, y - 51 * s, 15 * s, 52 * s);
    G.rrect(ctx, x - 11 * s, y - 28 * s, 22 * s, 30 * s, 10 * s);
    fillLine(ctx, '#4a3a2c');
    for (let i = -2; i <= 2; i++) {
      G.rrect(ctx, x + i * 10 * s - 3.5 * s, y - 60 * s, 7 * s, 9 * s, 1 * s);
      fillLine(ctx, PAL.stone, STYLE.line * 0.8);
    }
    G.tower(ctx, x - R * 0.92, y + 4 * s, s * 1.1, 46, 14, 'slate', 'cone');
    G.tower(ctx, x + R * 0.92, y + 4 * s, s * 1.1, 46, 14, 'slate', 'cone');
  }

  function castle(ctx, x, y, s, t, _pl, k = 1, id = 'greywall') {
    const img = G.cached(`castle-${id}`, k, 160, 150, 80, 120, (cx) => castleBody(cx, 0, 0, s * 0.42));
    ctx.drawImage(img, x - 80, y - 120, 160, 150);
    G.banner(ctx, x + 2 * s, y - 92 * s, 0.6 * s, 'valedorn', t, 24);
  }
  function castleBody(ctx, x, y, s) {
    // A rise of ground, the curtain wall, corner towers, the keep, the gatehouse.
    ctx.fillStyle = STYLE.shadow;
    ellipse(ctx, x + 18 * s, y + 6 * s, 170 * s, 40 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 175 * s, y + 6 * s);
    ctx.quadraticCurveTo(x - 120 * s, y - 70 * s, x, y - 74 * s);
    ctx.quadraticCurveTo(x + 120 * s, y - 70 * s, x + 175 * s, y + 6 * s);
    ctx.closePath();
    fillLine(ctx, '#8fae6c');
    ctx.fillStyle = '#7f9d5f';
    ellipse(ctx, x + 90 * s, y - 20 * s, 70 * s, 26 * s);
    ctx.fill();
    G.cityWall(ctx, x - 110 * s, y - 92 * s, x + 110 * s, s, 30);
    G.tower(ctx, x - 112 * s, y - 88 * s, s, 50, 16, 'slate', 'flat');
    G.tower(ctx, x + 112 * s, y - 88 * s, s, 50, 16, 'slate', 'flat');
    // The keep: a tall block with a crenellated top.
    G.rrect(ctx, x - 40 * s, y - 150 * s, 80 * s, 104 * s, 3 * s);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(x + 18 * s, y - 149 * s, 21 * s, 102 * s);
    for (let i = -3; i <= 3; i++) {
      G.rrect(ctx, x + i * 11 * s - 4 * s, y - 160 * s, 8 * s, 11 * s, 1 * s);
      fillLine(ctx, PAL.stone, STYLE.line * 0.8);
    }
    for (const [wx, wy] of [[-20, -126], [4, -126], [-8, -96]]) {
      G.rrect(ctx, x + wx * s, y + wy * s, 6 * s, 12 * s, 3 * s);
      fill(ctx, PAL.window);
    }
    G.cityWall(ctx, x - 125 * s, y - 6 * s, x - 30 * s, s, 36);
    G.cityWall(ctx, x + 30 * s, y - 6 * s, x + 125 * s, s, 36);
    G.tower(ctx, x - 128 * s, y - 2 * s, s, 56, 18, 'slate', 'flat');
    G.tower(ctx, x + 128 * s, y - 2 * s, s, 56, 18, 'slate', 'flat');
    G.rrect(ctx, x - 30 * s, y - 62 * s, 60 * s, 60 * s, 3 * s);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(x + 12 * s, y - 61 * s, 17 * s, 58 * s);
    G.rrect(ctx, x - 12 * s, y - 34 * s, 24 * s, 32 * s, 11 * s);
    fillLine(ctx, '#4a3a2c');
    for (let i = -2; i <= 2; i++) {
      G.rrect(ctx, x + i * 12 * s - 4 * s, y - 72 * s, 8 * s, 11 * s, 1 * s);
      fillLine(ctx, PAL.stone, STYLE.line * 0.8);
    }
  }

  function village(ctx, x, y, s, t, pl, k = 1, id = 'v') {
    const seed = typeof t === 'number' && pl?.seed == null ? t : pl?.seed ?? 3;
    const realm = typeof pl === 'string' ? pl : pl?.realm || 'valedorn';
    const img = G.cached(`village-${id}-${seed}-${realm}`, k, 150, 80, 75, 60, (cx) => villageBody(cx, 0, 0, s, seed, realm));
    ctx.drawImage(img, x - 75, y - 60, 150, 80);
  }
  function villageBody(ctx, x, y, s, seed, realm) {
    const r = G.rng(seed * 17 + 3);
    const specs = HOUSE_SPECS[realm] || HOUSE_SPECS.valedorn;
    const spots = realm === 'hrothmark' ? [[-30, -14], [26, -16], [-4, 4]] : [[-34, -12], [10, -18], [36, -2], [-10, 4]];
    // A tree and a fence first (behind), then the houses front to back by y.
    G.tree(ctx, x + 52 * s, y - 10 * s, 0.5, seed, realm === 'hrothmark' ? 'pine' : 'broad');
    G.fence(ctx, x - 58 * s, y + 10 * s, x - 22 * s, y + 14 * s, 0.5);
    G.fence(ctx, x + 22 * s, y + 14 * s, x + 54 * s, y + 9 * s, 0.5);
    for (const [hx, hy] of spots.sort((a, b) => a[1] - b[1])) mapHouse(ctx, x + hx * s, y + hy * s, 0.42 * s, specs[Math.floor(r() * specs.length)], Math.floor(r() * 99));
    if (realm !== 'hrothmark') {
      // The barn.
      G.building(ctx, { x: x + 44 * s, y: y + 16 * s, s: 0.42 * s, w: 46, h: 22, d: 30, wall: 'timber', roof: 'thatch', form: 'end', door: 'wide', windows: 0 }, 0, 0);
    }
  }

  function harbour(ctx, x, y, s, t, pl, k = 1) {
    // A pier into the bay, two boats, then the village.
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 6);
    ctx.lineTo(x + 92, y + 22);
    ctx.stroke();
    ctx.strokeStyle = PAL.wood;
    ctx.lineWidth = 5;
    ctx.stroke();
    boat(ctx, x + 108, y + 40, 1, t, PAL.crimson);
    boat(ctx, x + 80, y - 14, 0.85, t + 2, PAL.cloth);
    village(ctx, x, y, s, t, pl, k, 'harbour');
  }
  function boat(ctx, x, y, s, t, sail) {
    const bob = Math.sin(t * 1.5) * 1.2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(50,80,100,0.25)';
    ellipse(ctx, 2, 3, 17, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(16, -4);
    ctx.quadraticCurveTo(12, 4, 0, 4);
    ctx.quadraticCurveTo(-12, 4, -16, -4);
    fillLine(ctx, PAL.wood);
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -28);
    ctx.stroke();
    poly(ctx, [1, -27, 14, -8, 1, -7]);
    fillLine(ctx, sail, 1);
    ctx.restore();
  }

  const GLYPH = { city, castle, village, harbour };
  G.mapGlyphs = { city, castle, village, harbour, boat, hill, peak: (ctx, x, y, s, v, snow) => peakShape(ctx, x, y, s, v, snow) };

  // ---- Parties ----

  /** A party on the map: one to three miniature figures, a banner, and a wagon or a horse by kind. */
  function party(ctx, q, s, t, _S) {
    const R = G.REALMS[q.realm];
    const P = { face: q.face, walk: q.walk, move: q.move, t, scale: s };
    const hostile = q.stance === 'hostile';
    // The stance ring: blue friend, cream neutral, red hostile (and the banner's shape and figures too).
    ctx.strokeStyle = hostile ? 'rgba(176,69,58,0.85)' : q.stance === 'friendly' ? 'rgba(59,110,165,0.8)' : 'rgba(240,226,191,0.9)';
    ctx.lineWidth = 2.2 * s;
    ellipse(ctx, q.x, q.y + 1, 22 * s, 8 * s);
    ctx.stroke();
    if (q.kind === 'caravan') {
      G.wagon(ctx, q.x + 4 * s, q.y, s * 0.8, q.face === 'left' ? -1 : 1, t * q.move);
      G.fig.figure(ctx, q.x - 16 * s, q.y + 2 * s, G.fig.townLook('merchant', 5), P);
      return;
    }
    const looks = q.troops.map((id, i) => G.fig.troopLook(id, q.realm === 'reavers' ? 'reavers' : q.realm, i + q.id.length));
    if (q.kind === 'lord') {
      const L = { ...G.fig.troopLook('rider', 'valedorn', 3), helmet: 'plumed', plume: PAL.gold, cloak: '#3b6ea5', cloakTrim: PAL.gold, weapon: 'sword' };
      const x = q.x;
      q.hface = q.face === 'left' || q.face === 'right' ? q.face : q.hface || 'right';
      G.fig.horse(ctx, x, q.y, { coat: '#d9d2c4', mane: '#8a8278', cloth: 'valedorn' }, { ...P, hface: q.hface }, () => G.fig.figure(ctx, x, q.y, L, { ...P, mounted: true, face: q.hface }));
      G.banner(ctx, q.x + 14 * s, q.y + 1, s * 1.15, 'valedorn', t, 50);
      // The lord's gold-edged banner reads at a glance: a gold pennant tail.
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 1.6 * s;
      ctx.strokeRect(q.x + 14 * s, q.y - 50 * s * 1.15 + 1, 16 * s * 1.15, 12 * s * 1.15);
      return;
    }
    const offs = looks.length === 3 ? [[-11, -3], [11, -3], [0, 4]] : [[-7, 0], [8, 2]];
    for (const [i, L] of looks.entries()) G.fig.figure(ctx, q.x + offs[i][0] * s, q.y + offs[i][1] * s, L, { ...P, walk: q.walk + i * 1.3 });
    G.banner(ctx, q.x - 18 * s, q.y + 2 * s, s, q.realm, t + q.id.length, 44);
    if (hostile && q.chasing) {
      // Seen and coming: a small red mark over the band.
      ctx.fillStyle = PAL.crimson;
      G.rrect(ctx, q.x - 2 * s, q.y - 52 * s, 4 * s, 10 * s, 2 * s);
      ctx.fill();
      ellipse(ctx, q.x, q.y - 38 * s, 2.2 * s, 2.2 * s);
      ctx.fill();
    }
    void R;
  }

  function playerParty(ctx, p, s, t) {
    // The hero on foot with two companions and the company's own banner (the hero's colour, a gold edge).
    const cloak = CL.campaign?.character?.cloak || 'crimson';
    const hero = G.fig.heroLook(cloak);
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2.6 * s;
    ellipse(ctx, p.x, p.y + 1, 24 * s, 9 * s);
    ctx.stroke();
    const P = { face: p.face, walk: p.walk, move: p.move, t, scale: s };
    G.fig.figure(ctx, p.x - 12 * s, p.y - 3 * s, G.fig.troopLook('spearman', 'valedorn', 4), { ...P, walk: p.walk + 1 });
    G.fig.figure(ctx, p.x + 10 * s, p.y - 4 * s, G.fig.troopLook('hunter', 'valedorn', 5), { ...P, walk: p.walk + 2 });
    G.fig.figure(ctx, p.x, p.y + 3 * s, hero, P);
    const color = G.fig.CLOAKS[cloak] || G.fig.CLOAKS.crimson;
    G.banner(ctx, p.x + 20 * s, p.y + 2 * s, s * 1.05, { color, trim: PAL.gold, device: 'coin' }, t, 46);
  }

  // ---- Labels and the panel ----

  function labels(ctx, S, api) {
    const M = S.map;
    const c = M.cam;
    const z = c.zoom;
    const ts = api.textScale();
    const pill = (text, x, y, strong) => {
      ctx.font = `${strong ? 700 : 600} ${Math.round((strong ? 13 : 11.5) * ts)}px Georgia, serif`;
      const w = ctx.measureText(text).width + 12;
      const h = Math.round((strong ? 19 : 17) * ts);
      ctx.fillStyle = strong ? 'rgba(19,35,51,0.86)' : 'rgba(19,35,51,0.72)';
      G.rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = strong ? '#f3e3b5' : '#efe4c8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };
    for (const [id, pl] of Object.entries(PLACES)) {
      if (!pl.name || pl.kind === 'edge') continue;
      const major = pl.kind === 'city' || pl.kind === 'castle';
      if (!major && z < 0.75 && M.near !== id) continue;
      if (pl.kind === 'crossing' && z < 1.2) continue;
      const sx = (pl.x - c.x) * z;
      const sy = (pl.y - c.y) * z + (pl.kind === 'city' ? 26 : pl.kind === 'castle' ? 22 : 18) * Math.max(0.8, z);
      if (sx < -60 || sx > 1020 || sy < -20 || sy > 560) continue;
      pill(pl.name, sx, sy, major || M.near === id);
    }
    // A party's name when the player is near it or the pointer is over it.
    for (const q of M.parties) {
      if (q.beaten) continue;
      const near = Math.hypot(q.x - M.player.x, q.y - M.player.y) < 120 || M.hover === q.id;
      if (!near) continue;
      const sx = (q.x - c.x) * z;
      const sy = (q.y - c.y) * z - 46 * partyScale(z) * z - 8;
      pill(q.name, sx, sy, false);
    }
  }

  function hud(S, api) {
    const M = S.map;
    if (M.encounter) return;
    if (M.near && PLACES[M.near]) {
      const pl = PLACES[M.near];
      if (M.near === 'stonebridge') api.prompt(`${pl.name}: ${pl.blurb}`, [{ label: 'Enter the city', id: 'gfxEnterCity', onClick: () => api.go('city', { from: 'map' }) }]);
      else api.prompt(`${pl.name}${pl.blurb ? `: ${pl.blurb}` : ' (a village; only Stonebridge can be walked in this demo)'}`, []);
    } else api.prompt(S.map.hint === false ? '' : 'Tap to travel · steer with keys or stick · pinch or wheel to zoom · red rings are hostile', []);
  }

  // ---- Input ----

  function toWorld(M, p) {
    return { x: M.cam.x + p.x / M.cam.zoom, y: M.cam.y + p.y / M.cam.zoom };
  }
  function pointer(S, kind, p, api) {
    const M = S.map;
    const w = toWorld(M, p);
    if (kind === 'move') {
      M.hover = null;
      for (const q of M.parties) if (!q.beaten && Math.hypot(q.x - w.x, q.y - w.y) < 30) M.hover = q.id;
      return;
    }
    if (kind === 'down') {
      M.tapAt = { ...p, t: S.t };
      return;
    }
    if (kind !== 'up' || M.encounter || !M.tapAt) return;
    if (Math.hypot(p.x - M.tapAt.x, p.y - M.tapAt.y) > 16) return;
    M.tapAt = null;
    S.map.hint = false;
    // A tap on Stonebridge goes there (and in, on arrival); anywhere else, travel there.
    const target = Math.hypot(w.x - PLACES.stonebridge.x, w.y - PLACES.stonebridge.y) < 80 ? { x: PLACES.stonebridge.x, y: PLACES.stonebridge.y + 24 } : w;
    const path = route(S.mapLand.grid, M.player, target);
    if (path?.length) {
      M.player.path = path;
      M.player.dest = target;
    }
    api.note('map travel', { to: [Math.round(target.x), Math.round(target.y)], steps: path?.length || 0 });
  }

  function wheel(S, dy, at) {
    setZoom(S.map, S.map.cam.zoom * (dy > 0 ? 0.9 : 1.1), at);
  }
  function pinch(S, ratio, at) {
    setZoom(S.map, S.map.cam.zoom * ratio, at);
  }
  function key(S, code) {
    if (code === 'Equal' || code === 'NumpadAdd') setZoom(S.map, S.map.cam.zoom * 1.15);
    if (code === 'Minus' || code === 'NumpadSubtract') setZoom(S.map, S.map.cam.zoom / 1.15);
    if (code === 'KeyE' || code === 'Enter') {
      if (S.map.near === 'stonebridge') CL.gfxDemo.go('city', { from: 'map' });
    }
  }

  function enter(S, api, opts) {
    const M = S.map;
    if (opts.fresh) S.map = freshMap();
    if (opts.from === 'city') {
      // Out of the gate, just south of the city.
      Object.assign(S.map.player, { x: PLACES.stonebridge.x + 4, y: PLACES.stonebridge.y + 60, path: null, face: 'down' });
    }
    if (opts.from === 'battle' && S.battleFrom) {
      const q = S.map.parties.find((x) => x.id === S.battleFrom.party);
      if (q && S.battleResult?.win) q.beaten = true;
      S.map.encounter = null;
      S.map.calm = 6;
    }
    follow(S.map, 10);
    void M;
    api.card(null);
  }
  function leave(_S, api) {
    api?.prompt?.('');
    api?.card?.(null);
  }
  function lights(ctx, S, api) {
    // At dusk and night: windows and gate fires glow in the settlements.
    const M = S.map;
    const c = M.cam;
    const z = c.zoom;
    ctx.save();
    ctx.setTransform(api.k * z, 0, 0, api.k * z, -c.x * api.k * z, -c.y * api.k * z);
    ctx.globalCompositeOperation = 'lighter';
    for (const pl of Object.values(PLACES)) {
      if (!GLYPH[pl.kind]) continue;
      const n = pl.kind === 'city' ? 10 : pl.kind === 'castle' ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const x = pl.x + (G.hash(i, pl.x) - 0.5) * (pl.kind === 'city' ? 150 : 70);
        const y = pl.y - 6 - G.hash(i, pl.y) * (pl.kind === 'city' ? 60 : 30);
        G.glow(ctx, x, y, 9, 0.7 * api.night);
      }
    }
    // The party's torch.
    const p = M.player;
    G.glow(ctx, p.x, p.y - 8, 30, 0.3 * api.night);
    ctx.restore();
  }
  function onEscape(S, api) {
    if (S.map.encounter) {
      const q = S.map.parties.find((x) => x.id === S.map.encounter);
      if (q) withdraw(S, q, api);
      return true;
    }
    return false;
  }

  G.scenes.map = { init, enter, leave, update, draw, overlay: labels, hud, pointer, wheel, pinch, key, lights, escape: onEscape, route, PLACES, MW, MH, setZoom, dry };
})(typeof window !== 'undefined' ? window : globalThis);
