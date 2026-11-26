/* Crownless art: the strategic map (P10-G4, D-P10k). What js/render.js calls to draw the world map in
 * the art kit: the terrain (into the renderer's cached layer, one per zoom step), the settlements and
 * sites as miniatures, the parties as small figures with their banners, siege camps, and your company.
 *
 * Everything the map already did stays the renderer's: which places and parties show (sight and the
 * fog), where a party is drawn (beside a landmark), the labels and count badges, the rings for contract
 * and quest targets, the edge markers, night and every tap target. Icons keep about the size they had
 * on screen, so taps and labels land where they did. A miniature is drawn once per kind, culture, side,
 * facing, step and scale (`cached`) and stamped: 200 parties stay cheap. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, fill, poly, rrect, fillLine, tone } = G;

  const FIGURE = 0.62; // a party's figures on the map (a battle's are 1.12)

  // ---- Terrain (map units through CL.world.toPx into the layer's world pixels) ----

  /** Draw the whole terrain into the cached layer. `e` is its extent, `k` its pixels per world pixel. */
  function terrain(ctx, m, e, k) {
    const W = CL.world;
    const { toPx, terrainAt } = W;
    const sx = W.VIEW.sx; // world px per map unit
    const b = W.bounds();
    const [left, top] = toPx(0, 0);
    const [right, bottom] = toPx(b.w, b.h);
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(0, 0, e.w, e.h);
    // Soft variation in the grass: big pale and dark blobs, fixed to the map.
    const r = G.rng(1907);
    for (let i = 0; i < Math.round((e.w * e.h) / 90000); i++) {
      ctx.globalAlpha = 0.28;
      ellipse(ctx, r() * e.w, r() * e.h, 60 + r() * 140, 40 + r() * 80);
      fill(ctx, r() < 0.55 ? PAL.grassLight : r() < 0.5 ? PAL.meadow : PAL.grassDark);
    }
    ctx.globalAlpha = 1;
    // The sea beyond a coast, with a sand rim and a pale shallows band.
    for (const side of m.coast || []) {
      const rect = { north: [0, 0, e.w, top], south: [0, bottom, e.w, e.h - bottom], west: [0, 0, left, e.h], east: [right, 0, e.w - right, e.h] }[side];
      if (!rect) continue;
      ctx.fillStyle = PAL.sand;
      const pad = 9;
      const [x, y, w, h] = rect;
      ctx.fillRect(side === 'east' ? x - pad : x, side === 'south' ? y - pad : y, side === 'east' || side === 'west' ? w + pad : w, side === 'north' || side === 'south' ? h + pad : h);
      ctx.fillStyle = PAL.water;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PAL.waterLight;
      ctx.globalAlpha = 0.55;
      if (side === 'east') ctx.fillRect(x, y, 8, h);
      if (side === 'west') ctx.fillRect(x + w - 8, y, 8, h);
      if (side === 'north') ctx.fillRect(x, y + h - 8, w, 8);
      if (side === 'south') ctx.fillRect(x, y, w, 8);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = PAL.waterLight;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < Math.max(4, (w * h) / 6000); i++) {
        const px = x + 14 + r() * Math.max(1, w - 28);
        const py = y + 14 + r() * Math.max(1, h - 28);
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 6, py - 4, px + 12, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Fields round the villages (looks only).
    for (const s of Object.values(CL.content.table('settlements'))) {
      if (s.type !== 'village') continue;
      const fr = G.rng([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0));
      const [cx, cy] = toPx(s.mapX, s.mapY);
      for (let i = 0; i < 4; i++) {
        const a = fr() * Math.PI * 2;
        const d = 22 + fr() * 16;
        const fx = cx + Math.cos(a) * d;
        const fy = cy + Math.sin(a) * d * 0.6 + 8;
        if (terrainAt(...W.fromPx(fx, fy)) !== 'grass') continue;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((fr() - 0.5) * 0.5);
        const [fw, fh] = [18 + fr() * 10, 10 + fr() * 6];
        const colour = fr() < 0.5 ? PAL.field : PAL.fieldGreen;
        rrect(ctx, -fw / 2, -fh / 2, fw, fh, 2);
        fill(ctx, colour);
        ctx.strokeStyle = tone(colour, -0.12);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let yy = -fh / 2 + 2.5; yy < fh / 2; yy += 3) {
          ctx.moveTo(-fw / 2 + 2, yy);
          ctx.lineTo(fw / 2 - 2, yy);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
    // Areas: marsh pools and reeds, hills as mounds, mountains as shaded peaks (snow up high).
    for (const a of m.areas || []) {
      const box = polyBox(a.poly);
      if (a.kind === 'marsh') {
        G.poly(ctx, a.poly.flatMap((p) => toPx(...p)));
        ctx.globalAlpha = 0.5;
        fill(ctx, '#87a77c');
        ctx.globalAlpha = 1;
      }
      const stepX = a.kind === 'mountain' ? 5.2 : a.kind === 'hills' ? 5 : 3;
      const stepY = a.kind === 'mountain' ? 4.4 : a.kind === 'hills' ? 4.5 : 3.6;
      const marks = [];
      for (let y = box.y0; y <= box.y1; y += stepY) {
        for (let x = box.x0; x <= box.x1; x += stepX) {
          const jx = x + (G.hash(Math.round(x * 10), Math.round(y * 10)) - 0.5) * stepX * 0.6;
          const jy = y + (G.hash(Math.round(y * 10), Math.round(x * 10)) - 0.5) * stepY * 0.5;
          if (terrainAt(jx, jy) !== a.kind) continue;
          marks.push([...toPx(jx, jy), G.hash(Math.round(jx * 7), Math.round(jy * 7))]);
        }
      }
      marks.sort((p, q) => p[1] - q[1]);
      for (const [px, py, h] of marks) {
        if (a.kind === 'marsh') {
          if (h < 0.35) {
            ellipse(ctx, px, py, 6, 2.6);
            fill(ctx, PAL.waterDeep);
          } else {
            ctx.strokeStyle = '#5f7f4a';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            for (const dx of [-2.5, 0, 2.5]) {
              ctx.moveTo(px + dx, py);
              ctx.lineTo(px + dx * 1.4, py - 6 - h * 3);
            }
            ctx.stroke();
          }
        } else if (a.kind === 'hills') mound(ctx, px, py, 0.8 + h * 0.4);
        else {
          const s = 0.55 + h * 0.4;
          const img = G.cached(`mpeak${Math.floor(h * 4)}${s.toFixed(1)}`, k, 60, 52, 30, 46, (c) => peak(c, s, Math.floor(h * 4)));
          ctx.drawImage(img, px - 30, py - 46, 60, 52);
        }
      }
    }
    // Forests: a darker floor and grouped trees (pines in the north, the broadleaf elsewhere).
    for (const forest of m.forests || []) {
      G.poly(ctx, forest.flatMap((p) => toPx(...p)));
      ctx.globalAlpha = 0.5;
      fill(ctx, PAL.forestDark);
      ctx.globalAlpha = 1;
      const box = polyBox(forest);
      const trees = [];
      for (let y = box.y0; y <= box.y1; y += 3) {
        for (let x = box.x0; x <= box.x1; x += 2.6) {
          const jx = x + (G.hash(Math.round(x * 13), Math.round(y * 5)) - 0.5) * 2;
          const jy = y + (G.hash(Math.round(y * 13), Math.round(x * 5)) - 0.5) * 1.6;
          if (terrainAt(jx, jy) !== 'forest') continue;
          trees.push([...toPx(jx, jy), jy < b.h * 0.3 ? 'pine' : G.hash(Math.round(jx), Math.round(jy)) < 0.15 ? 'birch' : 'broad', Math.floor(G.hash(Math.round(jx * 3), Math.round(jy * 3)) * 5)]);
        }
      }
      trees.sort((p, q) => p[1] - q[1]);
      for (const [px, py, kind, v] of trees) {
        const img = G.cached(`mtree:${kind}${v}`, k * 0.5, 60, 66, 30, 58, (c) => G.tree(c, 0, 0, 1, v + 1, kind));
        ctx.drawImage(img, px - 15, py - 29, 30, 33);
      }
    }
    for (const [hx, hy] of m.hills || []) mound(ctx, ...toPx(hx, hy), 1);
    // Rivers and the waters that cost travel, with their banks; fords as stones, bridges as stone spans.
    const stream = (line, width) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [w, colour, a] of [[width + 6, PAL.bank, 1], [width, PAL.water, 1], [Math.max(1, width * 0.35), PAL.waterLight, 0.55]]) {
        ctx.globalAlpha = a;
        smooth(ctx, line.map((p) => toPx(...p)));
        ctx.strokeStyle = colour;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    if (m.river?.length) stream(m.river, 9);
    for (const w of m.waters || []) {
      stream(w.line, Math.max(5, w.width * 2 * sx * 0.6));
      for (const c of w.crossings || []) crossing(ctx, ...toPx(c.x, c.y), c.r * sx * 0.7, c.kind, w.line);
    }
    // Roads: an edge and a warm tan, curving through their points.
    const roads = (m.roads || []).map((road) => road.map((id) => {
      const s = CL.content.get('settlements', id);
      return toPx(s.mapX, s.mapY);
    }));
    for (const [w, colour] of [[7, PAL.roadEdge], [4.5, PAL.road]]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const pts of roads) {
        smooth(ctx, pts);
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
  }

  function polyBox(p) {
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  /** A path through points, curved through their midpoints. */
  function smooth(ctx, pts) {
    ctx.beginPath();
    if (!pts.length) return;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
  function mound(ctx, x, y, s) {
    ctx.fillStyle = STYLE.shadow;
    ellipse(ctx, x + 5 * s, y + 1, 17 * s, 4 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 17 * s, y);
    ctx.quadraticCurveTo(x - 8 * s, y - 12 * s, x + 1 * s, y - 11 * s);
    ctx.quadraticCurveTo(x + 11 * s, y - 10 * s, x + 17 * s, y);
    ctx.closePath();
    fillLine(ctx, '#8fae6c', STYLE.line * 0.8);
    ctx.fillStyle = '#7f9d5f';
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 11 * s);
    ctx.quadraticCurveTo(x + 11 * s, y - 10 * s, x + 17 * s, y);
    ctx.lineTo(x + 6 * s, y);
    ctx.closePath();
    ctx.fill();
  }
  function peak(ctx, s, v) {
    const r = G.rng(v * 11 + 1);
    const w = (24 + r() * 6) * s;
    const h = (34 + r() * 8) * s;
    const tx = (r() - 0.5) * 6 * s;
    ctx.fillStyle = STYLE.shadow;
    poly(ctx, [w, 0, w + h * 0.3, 3, tx + h * 0.2, -h * 0.4]);
    ctx.fill();
    poly(ctx, [-w, 0, tx, -h, w, 0]);
    fillLine(ctx, PAL.mountain);
    poly(ctx, [tx, -h, w, 0, tx + w * 0.15, 0]);
    fill(ctx, PAL.mountainShade);
    poly(ctx, [tx, -h, tx - h * 0.2, -h * 0.66, tx - h * 0.06, -h * 0.71, tx + h * 0.05, -h * 0.63, tx + h * 0.19, -h * 0.69]);
    fillLine(ctx, PAL.snow, STYLE.line * 0.7);
  }
  /** A ford (stepping stones and pale shallows) or a bridge (a stone span across the line). */
  function crossing(ctx, x, y, r, kind, line) {
    if (kind === 'ford') {
      ellipse(ctx, x, y, r * 1.1, r * 0.7);
      ctx.globalAlpha = 0.65;
      fill(ctx, PAL.waterLight);
      ctx.globalAlpha = 1;
      for (let i = -2; i <= 2; i++) {
        ellipse(ctx, x + i * r * 0.32, y + (i % 2) * 2, 2.6, 1.8);
        fillLine(ctx, PAL.rock, 0.8);
      }
      return;
    }
    // Across the water: perpendicular to the line where it is nearest.
    let ang = 0;
    if (line?.length > 1) {
      const pts = line.map((p) => CL.world.toPx(...p));
      let best = Infinity;
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot((pts[i][0] + pts[i - 1][0]) / 2 - x, (pts[i][1] + pts[i - 1][1]) / 2 - y);
        if (d < best) [best, ang] = [d, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) + Math.PI / 2];
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(-r + 2, -3, r * 2, 9);
    rrect(ctx, -r, -5, r * 2, 10, 2);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(-r + 1, 2, r * 2 - 2, 2.5);
    ctx.restore();
  }

  // ---- Settlements ----

  /** A tiny house: a wall, a roof (gable end, ridge or long hall), a door; light from the left. */
  function house(ctx, x, y, w, h, wall, roof, form) {
    const rh = h * 0.95;
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(x - w / 2 + 2, y, w + 2, 2.5);
    rrect(ctx, x - w / 2, y - h, w, h, 0.8);
    fillLine(ctx, wall, STYLE.line * 0.7);
    ctx.fillStyle = tone(wall, -0.14);
    ctx.fillRect(x + w * 0.25, y - h + 0.6, w * 0.24, h - 1);
    if (form === 'end') {
      poly(ctx, [x - w / 2 - 1.5, y - h + 0.5, x, y - h - rh, x + w / 2 + 1.5, y - h + 0.5]);
      fillLine(ctx, roof, STYLE.line * 0.7);
      poly(ctx, [x, y - h - rh, x + w / 2 + 1.5, y - h + 0.5, x + 0.5, y - h + 0.5]);
      fill(ctx, tone(roof, -0.18));
    } else {
      const inset = form === 'long' ? w * 0.05 : w * 0.12;
      poly(ctx, [x - w / 2 - 1.5, y - h + 0.5, x + w / 2 + 1.5, y - h + 0.5, x + w / 2 - inset, y - h - rh * 0.75, x - w / 2 + inset, y - h - rh * 0.75]);
      fillLine(ctx, roof, STYLE.line * 0.7);
      ctx.fillStyle = tone(roof, -0.18);
      ctx.fillRect(x + w * 0.2, y - h - rh * 0.72, w * 0.28, rh * 0.72);
    }
    ctx.fillStyle = PAL.door;
    ctx.fillRect(x - 1.2, y - h * 0.55, 2.4, h * 0.55);
  }

  const WALL = { plaster: PAL.plaster, stone: PAL.stone, timber: '#a5835a', whitewash: '#ece3cc' };
  const ROOF = { terracotta: PAL.terracotta, slate: PAL.slate, thatch: PAL.thatch, shingle: PAL.shingle, turf: '#7d9156' };

  /** A settlement's body (cached): a village's houses, a town's walls and roofs, a castle, a harbour. */
  function body(ctx, s, culture, coastal) {
    const C = G.CULTURES[culture] || G.CULTURES.border;
    const r = G.rng([...s.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    const pick = (list) => list[Math.floor(r() * list.length)];
    const houses = (spots, scale = 1) => {
      for (const [dx, dy] of spots.sort((a, b) => a[1] - b[1])) {
        const form = pick(C.forms);
        house(ctx, dx, dy, (form === 'long' ? 14 : 10) * scale, 5.5 * scale, WALL[pick(C.walls)], ROOF[pick(C.roofs)], form);
      }
    };
    G.shadow(ctx, 2, 3, s.type === 'village' ? 18 : 24, 5, 0);
    if (s.type === 'fort') {
      // A rise, the curtain wall, two towers and the keep: unmistakably a castle.
      ellipse(ctx, 0, 2, 22, 7);
      fill(ctx, '#8fae6c');
      G.cityWall(ctx, -16, -8, 16, 0.42, 22);
      G.tower(ctx, -16, -6, 0.42, 30, 13, 'slate', 'flat');
      G.tower(ctx, 16, -6, 0.42, 30, 13, 'slate', 'flat');
      rrect(ctx, -6, -25, 12, 18, 1);
      fillLine(ctx, PAL.stone, STYLE.line * 0.8);
      ctx.fillStyle = PAL.stoneShade;
      ctx.fillRect(1.5, -24.5, 4, 17);
      for (let i = -1; i <= 1; i++) {
        rrect(ctx, i * 4 - 1.6, -28, 3.2, 3.6, 0.6);
        fillLine(ctx, PAL.stone, STYLE.line * 0.6);
      }
      G.cityWall(ctx, -18, 3, 18, 0.42, 22);
      rrect(ctx, -3.5, -3, 7, 6, 3);
      fill(ctx, '#4a3a2c');
    } else if (s.type === 'town') {
      const big = s.capital ? 1.15 : 1;
      ellipse(ctx, 0, -2, 24 * big, 8 * big);
      fill(ctx, PAL.cobble);
      G.cityWall(ctx, -20 * big, -9 * big, 20 * big, 0.4, 20);
      houses([[-13, -6], [-3, -8], [8, -7], [-8, -1], [4, -1], [14, -2]].map(([x, y]) => [x * big, y * big]), big);
      G.tower(ctx, s.capital ? 0 : 6, -4 * big, 0.45, s.capital ? 48 : 36, 12, culture === 'hrothmark' ? 'shingle' : 'slate', 'cone');
      G.cityWall(ctx, -22 * big, 4, -4, 0.4, 22);
      G.cityWall(ctx, 4, 4, 22 * big, 0.4, 22);
      G.tower(ctx, -22 * big, 5, 0.38, 26, 12, 'slate', 'cone');
      G.tower(ctx, 22 * big, 5, 0.38, 26, 12, 'slate', 'cone');
      rrect(ctx, -4, -3, 8, 7, 3.5);
      fill(ctx, '#4a3a2c');
    } else {
      houses(culture === 'hrothmark' || culture === 'ostrand' ? [[-9, -2], [7, -4], [0, 4]] : [[-10, -1], [3, -5], [11, 1], [-2, 5]]);
      G.tree(ctx, 16, -3, 0.32, r() * 9, culture === 'hrothmark' ? 'pine' : 'broad');
      G.fence(ctx, -18, 7, -6, 8, 0.32);
    }
    if (coastal) {
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(18, 6);
      ctx.lineTo(30, 10);
      ctx.stroke();
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      boat(ctx, 34, 14, 0.38, PAL.cloth);
    }
  }

  /** A small boat with a sail (a harbour's). */
  function boat(ctx, x, y, s, sail) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
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

  /** Is a settlement on the coast (near a sea edge of the map)? */
  function coastal(s) {
    const m = CL.world.map();
    const b = CL.world.bounds();
    const d = { north: s.mapY, south: b.h - s.mapY, west: s.mapX, east: b.w - s.mapX };
    return (m.coast || []).some((side) => d[side] < 16);
  }

  /**
   * A settlement at (x, y) on screen: its miniature, its holder's banner, an occupier's pennant when
   * another holds its gates, and a siege camp round it while it is besieged (P8-06a).
   */
  function settlement(ctx, x, y, s, k, opts = {}) {
    const culture = CL.realm?.faction?.(s.ownerFaction)?.culture || CL.content.table('factions')[s.ownerFaction]?.culture || 'border';
    const sea = coastal(s);
    const img = G.cached(`mset:${s.id}:${culture}:${sea ? 1 : 0}`, k, 90, 60, 45, 40, (c) => body(c, s, culture, sea));
    if (opts.siege) camp(ctx, x, y, opts.siege, opts.t, false);
    ctx.drawImage(img, x - 45, y - 40, 90, 60);
    const t = opts.t ?? 0;
    G.banner(ctx, x + 14, y - (s.type === 'fort' ? 18 : 12), s.type === 'village' ? 0.5 : 0.6, opts.holder || s.ownerFaction, t, s.type === 'village' ? 26 : 32);
    if (opts.controller && opts.controller !== opts.holder) G.banner(ctx, x - 14, y - 10, 0.45, opts.controller, t + 1, 24);
    if (opts.siege) camp(ctx, x, y, opts.siege, t, true);
  }

  /** The besiegers' camp: tents round the walls (behind and in front), a ram and ladders before the gate. */
  function camp(ctx, x, y, realm, t, front) {
    const R = G.realm(typeof realm === 'string' ? realm : 'reavers'); // a band's siege: the outlaws' colours
    const spots = front ? [[-26, 12], [24, 14], [0, 18]] : [[-30, -14], [28, -12]];
    for (const [dx, dy] of spots) {
      const px = x + dx;
      const py = y + dy;
      G.shadow(ctx, px + 2, py, 7, 2, 4);
      poly(ctx, [px - 6, py, px, py - 9, px + 6, py]);
      fillLine(ctx, R.color, STYLE.line * 0.8);
      poly(ctx, [px, py - 9, px + 6, py, px + 1, py]);
      fill(ctx, tone(R.color, -0.2));
    }
    if (front) {
      // A ram shed and a ladder at the gate.
      ctx.save();
      ctx.translate(x - 4, y + 9);
      poly(ctx, [-7, 0, -5, -6, 5, -6, 7, 0]);
      fillLine(ctx, '#8a6a48', STYLE.line * 0.8);
      ctx.restore();
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 6);
      ctx.lineTo(x + 13, y - 6);
      ctx.moveTo(x + 12, y + 7);
      ctx.lineTo(x + 16, y - 5);
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(x + 9.5 + i, y + 4 - i * 3);
        ctx.lineTo(x + 12.5 + i, y + 5 - i * 3);
      }
      ctx.stroke();
      // Smoke from the camp's fires.
      for (let i = 0; i < 2; i++) {
        const k = ((t || 0) * 0.3 + i / 2) % 1;
        ctx.globalAlpha = 0.3 * (1 - k);
        ellipse(ctx, x - 26 + i * 50 + k * 4, y + 4 - k * 20, 3 + k * 4, 2.5 + k * 3);
        fill(ctx, '#e8e2d6');
      }
      ctx.globalAlpha = 1;
    }
  }

  /** A lair or camp on the map: a tent and a fire while it is active, the cold ashes once cleared. */
  function site(ctx, x, y, active, k, t) {
    const img = G.cached(`msite:${active ? 1 : 0}`, k, 40, 34, 20, 26, (c) => {
      G.shadow(c, 1, 2, 13, 3.5, 0);
      poly(c, [-12, 3, -3, -14, 6, 3]);
      fillLine(c, active ? '#6a3a2a' : '#8a7a6a');
      poly(c, [-3, -14, 6, 3, -2, 3]);
      fill(c, active ? '#4e2a20' : '#6e6252');
      poly(c, [-5, 3, -3, -6, -1, 3]);
      fill(c, '#2a1d14');
      c.strokeStyle = PAL.timber;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(6, 4);
      c.lineTo(12, 0);
      c.moveTo(12, 4);
      c.lineTo(6, 0);
      c.stroke();
    });
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.6;
    ctx.drawImage(img, x - 20, y - 26, 40, 34);
    ctx.restore();
    if (active) {
      const f = 0.7 + 0.3 * Math.sin(t * 9);
      ellipse(ctx, x + 9, y - 1, 2.6 * f, 3.8 * f);
      fill(ctx, '#f0a040');
      ellipse(ctx, x + 9, y - 0.5, 1.2, 1.8);
      fill(ctx, '#ffe2a0');
      G.banner(ctx, x - 13, y + 2, 0.45, 'reavers', t, 26);
    }
  }

  // ---- Parties ----

  /** Who a party is on the map: its figures and banner by kind. */
  const PARTY = {
    patrol: { troops: 2, banner: 1 },
    lord: { troops: 1, mounted: true, banner: 1.15, gold: true },
    army: { troops: 2, mounted: true, banner: 1.35, gold: true },
    caravan: { wagon: true, troops: 1, banner: 0 },
    bandit: { troops: 2, banner: 0.95 },
    detachment: { troops: 2, banner: 1, gold: true },
  };

  /** The troops a party's figures wear: its own (the first two of its template), else its realm's first. */
  function figuresOf(t, realm) {
    const ids = Object.keys(t?.troops || {});
    const tr = CL.content.table('troops');
    const valid = ids.filter((id) => tr[id] && tr[id].role !== 'cavalry' && tr[id].role !== 'hero');
    const mounted = ids.find((id) => tr[id]?.role === 'cavalry');
    const first = CL.content.table('factions')[realm]?.recruits?.[0];
    return { foot: valid.length ? valid : [first || 'levy'], mounted: mounted || null };
  }

  const faces = new WeakMap();
  /** A party's facing on the map, from how it moved (kept per party object). */
  function facing(p, x, y) {
    let f = faces.get(p);
    if (!f) {
      f = { x, y, face: 'down', moving: 0 };
      faces.set(p, f);
    }
    const dx = x - f.x;
    const dy = y - f.y;
    if (Math.hypot(dx, dy) > 0.4) {
      f.face = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      f.moving = 1;
    } else f.moving = Math.max(0, f.moving - 0.05);
    f.x = x;
    f.y = y;
    return f;
  }

  /** The party's miniature, baked (kind, side, the troops it shows, facing, step, scale) and stamped. */
  function partyBody(ctx, x, y, kind, realm, fig, face, step, k, arms = null) {
    const P = PARTY[kind] || PARTY.patrol;
    const side = kind === 'bandit' ? 'reavers' : kind === 'detachment' ? 'player' : realm;
    const key = `mparty:${kind}:${typeof side === 'object' ? side.color : side}:${arms ? `${arms.house}.${arms.device}.${arms.trim}` : ''}:${fig.foot.join(',')}:${fig.mounted || ''}:${face}:${step}`;
    const img = G.cached(key, k, 70, 64, 35, 50, (c) => {
      const pose = { face, walk: step >= 0 ? ((step + 0.5) * Math.PI) / 2 : 0, move: step >= 0 ? 1 : 0, t: 0, scale: FIGURE };
      if (P.wagon) {
        G.wagon(c, 6, 0, 0.55, face === 'left' ? -1 : 1, Math.max(step, 0));
        G.fig.figure(c, -12, 2, G.fig.townLook('merchant', 5, side), pose);
        return;
      }
      // A lord rides under their house's arms (P10-G5, asset row 10), others under their realm's.
      if (P.banner) G.banner(c, kind === 'army' ? -16 : -13, 2, 0.62 * P.banner, arms ? { ...arms, edge: PAL.gold } : side, 0, 44);
      const foot = fig.foot.map((id, i) => G.fig.troopLook(id, side, i + 3));
      const offs = [[-6, -2], [6, 0]];
      for (let i = 0; i < Math.min(P.troops, foot.length + (P.troops > foot.length ? 1 : 0)); i++) {
        if (P.mounted && i === 0) continue;
        const L = foot[i % foot.length];
        G.fig.figure(c, offs[i % 2][0], offs[i % 2][1], L, { ...pose, walk: pose.walk + i * 1.3 });
      }
      if (P.mounted) {
        const id = fig.mounted || 'rider';
        const L = { ...G.fig.troopLook(id, side, 2), helmet: P.gold ? 'plumed' : G.fig.troopLook(id, side, 2).helmet, plume: PAL.gold, cloak: P.gold ? G.realm(side).color : null };
        const hf = face === 'left' ? 'left' : 'right';
        G.fig.horse(c, 2, 4, { ...(L.mount || { coat: '#d9d2c4', mane: '#8a8278' }), cloth: side }, { ...pose, hface: hf }, () => G.fig.figure(c, 2, 4, L, { ...pose, face: hf, mounted: true }));
      }
    });
    ctx.drawImage(img, x - 35, y - 50, 70, 64);
  }

  /**
   * A party at (x, y) on screen: a ring by stance (blue friendly, cream neutral, red hostile), its
   * figures and banner, an army's bigger banner. `info`: { kind, realm, template, hostile, friendly, army }.
   */
  function party(ctx, x, y, p, info, k, t) {
    const f = facing(p, x, y);
    const step = f.moving > 0.3 ? Math.floor(t * 6) % 4 : -1;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = info.hostile ? 'rgba(186,72,58,0.9)' : info.friendly ? 'rgba(76,130,196,0.85)' : 'rgba(240,226,191,0.9)';
    ellipse(ctx, x, y + 4, 15, 5.5);
    ctx.stroke();
    const kind = info.army ? 'army' : info.kind;
    partyBody(ctx, x, y + 4, kind, info.realm, figuresOf(info.template, info.realm), f.face, step, k, info.arms || null);
  }

  /** Where the company last saw a party: its banner faded, and a question mark. */
  function ghost(ctx, x, y, info) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    G.banner(ctx, x - 4, y + 6, 0.62, info.kind === 'bandit' ? 'reavers' : info.realm, 0, 34);
    ctx.restore();
  }

  /** Your company: you, two of your soldiers if you have them, your banner and a gold ring. */
  function company(ctx, x, y, moving, face, k, t) {
    const c = CL.campaign;
    const realm = (c && (CL.allegiance?.sworn?.(c) || CL.allegiance?.serves?.(c))) || 'player';
    const roster = (c?.roster || []).filter((s) => !s.wounded).slice(0, 2).map((s) => s.troop);
    const step = moving ? Math.floor(t * 7) % 4 : -1;
    ctx.strokeStyle = 'rgba(216,178,90,0.95)';
    ctx.lineWidth = 2.2;
    ellipse(ctx, x, y + 2, 17, 6);
    ctx.stroke();
    const ch = c?.character;
    const heroL = ch ? G.fig.heroFrom(ch, c.equipment, { which: CL.gear.bestLoadout(c), campaign: c }) : G.fig.heroLook(); // P11-04: in their gear
    const key = `mcompany:${ch?.cloak}:${ch?.gender}:${heroL.sig || ''}:${realm}:${roster.join(',')}:${face}:${step}`;
    const img = G.cached(key, k, 74, 66, 37, 54, (cx) => {
      const pose = { face, walk: step >= 0 ? ((step + 0.5) * Math.PI) / 2 : 0, move: step >= 0 ? 1 : 0, t: 0, scale: FIGURE * 1.05 };
      G.banner(cx, 14, 2, 0.7, { color: G.fig.CLOAKS[ch?.cloak] || G.fig.CLOAKS.crimson, trim: PAL.gold, device: 'coin' }, 0, 46);
      for (const [i, id] of roster.entries()) G.fig.figure(cx, i ? 8 : -9, -3, G.fig.troopLook(id, realm, i + 1), { ...pose, walk: pose.walk + (i + 1) * 1.3 });
      G.fig.figure(cx, 0, 2, heroL, pose);
    });
    ctx.drawImage(img, x - 37, y - 52, 74, 66);
    return { x: x - 16, y: y - 40, w: 32, h: 42 };
  }

  G.worldmap = { FIGURE, PARTY, terrain, settlement, site, party, ghost, company, coastal, figuresOf };
})(typeof window !== 'undefined' ? window : globalThis);
