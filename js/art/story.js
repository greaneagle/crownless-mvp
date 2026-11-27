/* Crownless art: the storybook environment kit (P11-12b, D-P11m).
 *
 * The approved Stonebridge concept (the owner's reference, docs/STORYBOOK-INTEGRATION.md)
 * in parts: its palette, buildings built from wall, roof, door, window, chimney, trim and sign planes (tile
 * rows, slate courses, soft thatch eaves, timber frames with braces, stone courses, framed four-pane
 * windows, round-headed plank doors, a curved awning), cobbles laid as single stones, rounded trees and
 * bushes, the well with its winch, the market stall, barrels and crates. Same conventions as js/art/kit.js
 * (anchors at the foot, `s` a size, seeded variation, one light from the upper left, one shadow); a warmer
 * outline. P11-12b drew Stonebridge with it; from P11-12c (5.12.1) it is the kit's: its parts stand in for the
 * kit's own (G.building, G.tree, G.bush, G.tuft, G.barrel, G.crate, G.well, G.stall), so every town, battlefield
 * and the map draw with them. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;

  /** The concept's palette (docs/STORYBOOK-INTEGRATION.md §2). */
  const SPAL = {
    meadow: '#96ad79',
    meadowLight: '#a9bd85',
    meadowDark: '#778e51',
    crown: '#668c43',
    crownLight: '#88a552',
    crownDark: '#4b713f',
    trunk: '#7a5636',
    road: '#d9bf92',
    roadEdge: '#c4aa7e',
    cobble: '#d8c6a2',
    cobbleLine: '#b7a382',
    plaster: '#f0d9aa',
    whitewash: '#f0e4ca',
    timber: '#65472f',
    stone: '#b8b0a0',
    stoneShade: '#918c80',
    stoneDark: '#79746a',
    terracotta: '#bd7655',
    terracottaShade: '#985039',
    slate: '#75849a',
    slateShade: '#515d71',
    thatch: '#d5ad60',
    thatchShade: '#b38943',
    shingle: '#80644c',
    shingleShade: '#614938',
    turf: '#879753',
    wood: '#a77c49',
    woodShade: '#795231',
    door: '#875b37',
    glass: '#d9a65a',
    glassLit: '#f6cf73',
    water: '#76a9bb',
    waterDeep: '#518caa',
    cloth: '#f1e2c1',
    gold: '#e5bd67',
    ink: '#49352a',
  };
  const INK = SPAL.ink;
  const LINE = 1.5;

  const tone = G.tone;
  const hash = G.hash;

  function paint(ctx, color, w = LINE) {
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (w) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  function poly(ctx, pts, color, w = LINE) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    paint(ctx, color, w);
  }
  function rect(ctx, x, y, w, h, color, lw = LINE, r = 0) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath();
    if (r) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else ctx.rect(x, y, w, h);
    paint(ctx, color, lw);
  }
  function oval(ctx, x, y, rx, ry, color, w = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    paint(ctx, color, w);
  }
  function line(ctx, pts, color = INK, w = 1.2) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function shadow(ctx, x, y, rx, ry) {
    oval(ctx, x + rx * 0.18, y + 2, rx, ry, 'rgba(55,68,37,0.22)');
  }
  /** A round-headed opening (a door or an arched window) of width w, height h, its foot at y + h. */
  function arch(ctx, x, y, w, h, color, lw = LINE) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w * 0.5);
    ctx.quadraticCurveTo(x, y, x + w / 2, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + w * 0.5);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    paint(ctx, color, lw);
  }

  /** Stone laid in courses: single stones of slightly different tones, offset row by row. */
  function masonry(ctx, x, y, w, h, color = SPAL.stone, step = 9, seed = 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rect(ctx, x, y, w, h, tone(color, -0.08), 0);
    for (let row = 0; row * step < h; row++) {
      const yy = y + row * step;
      let xx = x - (row % 2) * step * 0.9;
      let i = 0;
      while (xx < x + w) {
        const sw = step * (1.5 + hash(seed + row * 31, i) * 0.9);
        const k = (hash(seed + row * 7, i * 3) - 0.5) * 0.12;
        rect(ctx, xx + 0.7, yy + 0.7, sw - 1.4, step - 1.4, tone(color, k), 0.75, 1.6);
        xx += sw;
        i++;
      }
    }
    ctx.restore();
  }

  /** A framed window of four panes (cross mullions); amber by day, lit at night. */
  function window4(ctx, x, y, w, h, lit, arched = false) {
    rect(ctx, x - 2, y - 2, w + 4, h + 4, SPAL.timber, 1.1, 1.5);
    const glass = lit ? SPAL.glassLit : SPAL.glass;
    if (arched) arch(ctx, x, y, w, h, glass, 0.9);
    else rect(ctx, x, y, w, h, glass, 0.9);
    if (!lit) {
      ctx.fillStyle = 'rgba(255,240,200,0.35)';
      ctx.fillRect(x + 0.8, y + 0.8, w * 0.38, h * 0.38);
    }
    line(ctx, [x + w / 2, y + (arched ? w * 0.15 : 0.5), x + w / 2, y + h], SPAL.timber, 1.3);
    line(ctx, [x, y + h * 0.52, x + w, y + h * 0.52], SPAL.timber, 1.3);
    line(ctx, [x - 3, y + h + 2.6, x + w + 3, y + h + 2.6], SPAL.timber, 2);
  }

  /** A plank door with a round head, its studs and a ring; a stone surround on stone walls. */
  function door(ctx, x, y, w, h, color, stone = false) {
    if (stone) arch(ctx, x - w / 2 - 3, y - h - 3, w + 6, h + 3, tone(SPAL.stone, 0.12), 1.3);
    arch(ctx, x - w / 2, y - h, w, h, color, 1.6);
    for (let i = 1; i < 4; i++) {
      const xx = x - w / 2 + (w * i) / 4;
      line(ctx, [xx, y - h + w * 0.28, xx, y - 1], tone(color, -0.3), 0.9);
    }
    line(ctx, [x - w / 2 + 1, y - h * 0.32, x + w / 2 - 1, y - h * 0.32], tone(color, -0.35), 1.2);
    oval(ctx, x + w * 0.27, y - h * 0.45, 1.2, 1.2, SPAL.gold, 0.6);
  }

  /** Roof cover inside a roof's outline: tile rows of small arcs, slate courses, soft thatch strokes. */
  function cover(ctx, pts, x, y, w, h, color, kind) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.clip();
    const dark = tone(color, -0.2);
    if (kind === 'thatch') {
      for (let row = 0; row * 7 < h + 7; row++) {
        const yy = y + row * 7;
        for (let xx = x + (row % 2) * 4; xx < x + w; xx += 8) line(ctx, [xx, yy, xx - 1.5, yy + 5], dark, 0.8);
      }
    } else if (kind === 'terracotta') {
      for (let row = 1; row * 6.5 < h + 6; row++) {
        const yy = y + row * 6.5;
        ctx.beginPath();
        for (let xx = x - (row % 2) * 4.5; xx < x + w + 9; xx += 9) {
          ctx.moveTo(xx, yy);
          ctx.quadraticCurveTo(xx + 4.5, yy + 3.4, xx + 9, yy);
        }
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    } else {
      for (let row = 1; row * 7 < h + 7; row++) {
        const yy = y + row * 7;
        line(ctx, [x, yy, x + w, yy], dark, 0.8);
        for (let xx = x + (row % 2) * 6; xx < x + w; xx += 12) line(ctx, [xx, yy - 7, xx, yy], tone(color, -0.14), 0.7);
      }
    }
    ctx.restore();
  }

  const WALL = { plaster: SPAL.plaster, stone: SPAL.stone, whitewash: SPAL.whitewash, timber: '#b18a5b' };
  const ROOF = { terracotta: SPAL.terracotta, slate: SPAL.slate, thatch: SPAL.thatch, shingle: SPAL.shingle, turf: SPAL.turf };

  /**
   * A building, the kit's spec (G.building's: x, y the front wall's foot; w, h, d; wall, base, roof, form
   * 'gable' | 'end' | 'hip' | 'long', beams, chimney, door, windows, sign, awning, the town's colours) in the
   * storybook's parts. `banner`: a hanging banner on the front in the realm's colours (`realm`). A tavern
   * (a `sign` of kind 'tavern') and a wide gable roof get a cross gable to the street, as the concept's inn.
   */
  function building(ctx, b, t = 0, night = 0) {
    const s = b.s || 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(s, s);
    const w = b.w;
    const h = b.h;
    const d = b.d ?? w * 0.5;
    const L = -w / 2;
    const R = w / 2;
    const T = -h;
    const lit = night > 0.3;
    const wallKind = b.wall || 'plaster';
    const stone = wallKind === 'stone';
    const wall = b.wallColor || WALL[wallKind] || SPAL.plaster;
    const roofKind = b.roof || 'terracotta';
    const roof = b.roofColor || ROOF[roofKind] || SPAL.terracotta;
    const form = b.form || 'gable';
    const base = b.base && !stone ? h * 0.3 : 0;
    const cross = form === 'gable' && w >= 150 && b.sign?.kind === 'tavern';
    shadow(ctx, 0, 0, w * 0.54, Math.min(9, w * 0.08));
    poly(ctx, [R, 0, R + h * 0.3, h * 0.08, R + h * 0.3, T - d * 0.3, R, T - d * 0.45], 'rgba(55,68,37,0.18)', 0);
    // The wall: masonry or plaster, a stone ground course, the right end in shade.
    rect(ctx, L, T, w, h, wall);
    if (stone) masonry(ctx, L + 0.8, T + 0.8, w - 1.6, h - 1.6, wall, Math.max(6, Math.min(10, h * 0.16)), b.seed || 3);
    if (base) masonry(ctx, L + 0.8, -base, w - 1.6, base - 0.8, SPAL.stone, Math.max(5, Math.min(8, base * 0.34)), (b.seed || 3) + 5);
    ctx.fillStyle = 'rgba(70,50,30,0.12)';
    ctx.fillRect(R - w * 0.1, T, w * 0.1, h);
    rect(ctx, L, T, w, h, null, LINE);
    // Timber framing: a top plate, the floor rail, posts and braces in alternate bays.
    if (b.beams) {
      const bottom = base ? -base : 0;
      const thick = Math.max(2.2, w * 0.016);
      line(ctx, [L, T + 1.2, R, T + 1.2], SPAL.timber, thick + 0.6);
      line(ctx, [L, bottom, R, bottom], SPAL.timber, thick);
      const bays = Math.max(2, Math.round(w / 40));
      for (let i = 0; i <= bays; i++) {
        const xx = L + (w * i) / bays;
        line(ctx, [xx, T, xx, bottom], SPAL.timber, thick);
        if (i < bays && (i + (b.seed || 0)) % 2 === 0) line(ctx, [xx + 2.5, bottom - 2, xx + w / bays - 2.5, T + 3], SPAL.timber, thick * 0.8);
        else if (i < bays) line(ctx, [xx + 2.5, T + 3, xx + w / bays - 2.5, bottom - 2], SPAL.timber, thick * 0.8);
      }
      if (h - base > 40) line(ctx, [L, T + (h - base) * 0.48, R, T + (h - base) * 0.48], SPAL.timber, thick * 0.8);
    }
    // The roof.
    const over = 5;
    const top = T - d * 0.85;
    let ridgeY = top;
    if (form === 'end') {
      const peak = T - d * 0.9;
      poly(ctx, [L, T, 0, peak, R, T], wall);
      if (b.beams) {
        line(ctx, [L + 3, T - 1, 0, peak + 3, R - 3, T - 1], SPAL.timber, 2.6);
        line(ctx, [0, peak + 3, 0, T], SPAL.timber, 2.4);
      }
      const lp = [L - over, T + 2, 0, peak - 3, -d * 0.2, peak - d * 0.14, L - over - d * 0.2, T - d * 0.14];
      poly(ctx, lp, tone(roof, 0.05));
      cover(ctx, lp, L - over - d * 0.2, peak - d * 0.15, w / 2 + over + 4, h + d, roof, roofKind);
      poly(ctx, lp, null);
      const rp = [0, peak - 3, R + over, T + 2, R + over - d * 0.2, T - d * 0.14, -d * 0.2, peak - d * 0.14];
      poly(ctx, rp, tone(roof, -0.18));
      ridgeY = peak;
    } else {
      const inset = form === 'hip' ? w * 0.18 : form === 'long' ? w * 0.05 : 0.5;
      const roofPts = [L - over, T + 2, R + over, T + 2, R - inset, top, L + inset, top];
      if (roofKind === 'thatch') {
        // A soft, rounded thatch: bulging eaves and rounded ends, the eave's edge scalloped.
        ctx.beginPath();
        ctx.moveTo(L - over - 2, T + 3);
        ctx.quadraticCurveTo(L - over - 4, top + d * 0.3, L + inset + 4, top);
        ctx.quadraticCurveTo(0, top - 4, R - inset - 4, top);
        ctx.quadraticCurveTo(R + over + 4, top + d * 0.3, R + over + 2, T + 3);
        ctx.closePath();
        paint(ctx, roof);
        cover(ctx, roofPts, L - over - 4, top - 4, w + over * 2 + 8, d + 8, roof, 'thatch');
        ctx.beginPath();
        for (let xx = L - over; xx < R + over; xx += 10) {
          ctx.moveTo(xx, T + 2);
          ctx.quadraticCurveTo(xx + 5, T + 7, xx + 10, T + 2);
        }
        paint(ctx, roof, 1.1);
        line(ctx, [L + inset + 8, top + 1.5, R - inset - 8, top + 1.5], tone(roof, 0.2), 2.4);
      } else {
        poly(ctx, roofPts, roof);
        cover(ctx, roofPts, L - over, top, w + over * 2, d + 4, roof, roofKind);
        if (form === 'hip') {
          poly(ctx, [R + over, T + 2, R - inset, top, R - inset * 0.25, T + 2], tone(roof, -0.18));
          poly(ctx, [L - over, T + 2, L + inset, top, L + inset * 0.25, T + 2], tone(roof, 0.06), 1);
        } else poly(ctx, [R + over, T + 2, R - w * 0.1, T + 2, R - inset - w * 0.08, top, R - inset, top], tone(roof, -0.14), 0);
        poly(ctx, roofPts, null);
        line(ctx, [L + inset, top, R - inset, top], tone(roof, 0.2), 2.4);
        line(ctx, [L - over, T + 2, R + over, T + 2], tone(roof, -0.25), 1.6);
      }
      if (cross) {
        // The inn's cross gable: a gable end to the street over the left third.
        const gx = L + w * 0.3;
        const gw = w * 0.36;
        const gp = top - d * 0.18;
        poly(ctx, [gx - gw / 2, T + 2, gx, gp + 6, gx + gw / 2, T + 2], wall);
        if (b.beams) {
          line(ctx, [gx - gw / 2 + 3, T, gx, gp + 9, gx + gw / 2 - 3, T], SPAL.timber, 2.6);
          line(ctx, [gx, gp + 9, gx, T], SPAL.timber, 2.4);
          line(ctx, [gx - gw * 0.25, T - (T - gp) * 0.32, gx + gw * 0.25, T - (T - gp) * 0.32], SPAL.timber, 2);
        }
        window4(ctx, gx - 5, T - (T - gp) * 0.55, 10, 9, lit);
        poly(ctx, [gx - gw / 2 - over, T + 4, gx, gp, gx + 3, gp + 4, gx - gw / 2 + 2, T + 4], tone(roof, 0.06));
        poly(ctx, [gx + gw / 2 + over, T + 4, gx, gp, gx - 3, gp + 4, gx + gw / 2 - 2, T + 4], tone(roof, -0.16));
      }
      if (b.chimney != null) {
        const cx = b.chimney * w * 0.3;
        rect(ctx, cx - 5, top - 7, 10, 18, SPAL.stone, 1.3, 1);
        masonry(ctx, cx - 4.3, top - 6.3, 8.6, 16.4, SPAL.stone, 4.5, 9);
        rect(ctx, cx - 6.5, top - 9, 13, 3.4, SPAL.stoneShade, 1.2, 1);
      }
    }
    // The door, the windows (two rows on a tall timber front), an awning, a sign, a banner.
    const dx = b.door === 'left' ? L + w * 0.24 : b.door === 'right' ? R - w * 0.24 : 0;
    const dw = Math.min(w * 0.22, Math.max(13, h * 0.32)) * (b.door === 'wide' ? 1.5 : 1);
    const dh = Math.min(h * 0.78, Math.max(19, h * 0.62));
    door(ctx, dx, 0, dw, dh, b.doorColor || SPAL.door, stone);
    if (stone) rect(ctx, dx - dw / 2 - 5, -2, dw + 10, 3, tone(SPAL.stone, -0.05), 1, 1);
    const n = b.windows ?? Math.max(1, Math.round(w / 46));
    const ww = Math.max(7, Math.min(13, h * 0.22));
    const wh = Math.max(8, Math.min(15, h * 0.27));
    const rows = b.beams && h >= 50 ? 2 : 1;
    // On a timber front the windows sit in the bays between the posts, one a bay at most.
    const bays = b.beams ? Math.max(2, Math.round(w / 40)) : 0;
    const snap = (wx) => (bays ? L + (Math.min(bays - 1, Math.max(0, Math.floor(((wx - L) / w) * bays))) + 0.5) * (w / bays) : wx);
    for (let r = 0; r < rows; r++) {
      const used = new Set();
      const wy = rows === 2 ? (r === 0 ? T + h * 0.14 : -base - wh - h * 0.08) : stone && !base ? T + h * 0.22 : T + (h - base) * 0.3;
      const count = rows === 2 && r === 0 ? n + 1 : n;
      for (let i = 0; i < count; i++) {
        let wx = snap(L + ((i + 0.5) * w) / count);
        if (used.has(Math.round(wx))) continue;
        used.add(Math.round(wx));
        if (cross && Math.abs(wx - (L + w * 0.3)) < w * 0.12 && r === 0) continue;
        if ((r === rows - 1 || rows === 1) && Math.abs(wx - dx) < dw * 0.7 + ww * 0.6) continue;
        if (wx < L + ww || wx > R - ww) wx = Math.max(L + ww, Math.min(R - ww, wx));
        window4(ctx, wx - ww / 2, wy, ww, wh, lit && hash(b.seed || 7, i + r * 9) < 0.85, stone && !b.beams);
      }
    }
    if (b.awning) {
      // The concept's curved awning: a sloping cloth with a scalloped edge.
      const aw = Math.max(30, dw * 2.1);
      const ay = -dh - 4;
      poly(ctx, [dx - aw * 0.45, ay - 9, dx + aw * 0.45, ay - 9, dx + aw * 0.55, ay, dx - aw * 0.55, ay], b.awning, 1.3);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x0 = dx - aw * 0.55 + (i * aw * 1.1) / 5;
        ctx.moveTo(x0, ay);
        ctx.quadraticCurveTo(x0 + (aw * 1.1) / 10, ay + 5, x0 + (aw * 1.1) / 5, ay);
      }
      paint(ctx, tone(b.awning, -0.08), 1.1);
      line(ctx, [dx - aw * 0.3, ay - 8, dx - aw * 0.36, ay - 1, dx + aw * 0.3, ay - 8, dx + aw * 0.36, ay - 1], tone(b.awning, 0.18), 1);
    }
    if (b.sign) {
      const dir = b.sign.at === 'left' ? -1 : 1;
      const sx = dir < 0 ? L : R;
      const sy = T + h * 0.38;
      const sw = Math.sin(t * 1.7) * 0.06;
      line(ctx, [sx, sy - 12, sx + dir * 15, sy - 12], SPAL.timber, 2.2);
      line(ctx, [sx, sy - 4, sx + dir * 6, sy - 12], SPAL.timber, 1.6);
      ctx.save();
      ctx.translate(sx + dir * 12, sy - 12);
      ctx.rotate(sw);
      line(ctx, [-4, 0, -4, 3, 4, 3, 4, 0], INK, 0.8);
      rect(ctx, -8, 3, 16, 14, SPAL.door, 1.4, 2);
      if (b.sign.kind === 'tavern') {
        rect(ctx, -3.5, 6, 6, 8, SPAL.gold, 0.8, 1);
        ctx.beginPath();
        ctx.arc(3, 10, 2.3, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = SPAL.gold;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        rect(ctx, -3.5, 5, 6, 2, SPAL.cloth, 0.5, 1);
      } else if (b.sign.kind === 'barracks') line(ctx, [-4.5, 15, 4.5, 6, 0, 10.5, 4.5, 15, -4.5, 6], SPAL.cloth, 1.4);
      else if (b.sign.kind === 'smith') poly(ctx, [-5, 8, 4, 8, 5.5, 9.5, 2, 11, -3, 11], SPAL.cloth, 0.6);
      else line(ctx, [-3, 10, 0, 10, 5, 10, 5, 12], SPAL.cloth, 1.4);
      ctx.restore();
    }
    if (b.hanging && b.realm) {
      // A hanging banner on the front, over the door (the concept's muster hall).
      const R0 = G.realm(b.realm);
      const bw = Math.min(22, w * 0.12);
      const by = T + 4;
      line(ctx, [-bw / 2 - 3, by, bw / 2 + 3, by], SPAL.timber, 2.4);
      poly(ctx, [-bw / 2, by, bw / 2, by, bw / 2, by + h * 0.5, 0, by + h * 0.5 - 7, -bw / 2, by + h * 0.5], R0.color, 1.4);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-bw / 2, by, bw, h * 0.5);
      ctx.clip();
      line(ctx, [-bw / 2 + 2, by + 3, bw / 2 - 2, by + 3], R0.trim || SPAL.gold, 1.6);
      G.device(ctx, 0, by + h * 0.24, bw * 0.38, R0);
      ctx.restore();
    }
    if (b.sign?.kind === 'tavern' && w >= 120) {
      barrel(ctx, L + 13, 1, 0.72);
      barrel(ctx, L + 26, 2, 0.68);
      crate(ctx, R - 16, 1, 0.72, 18);
    }
    if (lit) {
      ctx.fillStyle = `rgba(255,205,120,${0.14 * night})`;
      ctx.beginPath();
      ctx.ellipse(dx, 4, dw * 1.4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return { ridgeY: b.y + ridgeY * s };
  }

  /** A round tower with a cone roof and a slit window (the elder's house), its foot at (x, y). */
  function tower(ctx, x, y, s = 1, h = 54, r = 15, roofKind = 'slate', t = 0, side = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    shadow(ctx, 0, 0, r * 1.1, 4);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r, -h);
    ctx.lineTo(r, -h);
    ctx.lineTo(r, 0);
    ctx.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI);
    ctx.closePath();
    paint(ctx, SPAL.stone);
    ctx.save();
    ctx.clip();
    masonry(ctx, -r, -h, r * 2, h + r, SPAL.stone, 8, 21);
    ctx.fillStyle = 'rgba(70,60,40,0.18)';
    ctx.fillRect(r * 0.3, -h, r, h + r);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r, -h);
    ctx.moveTo(r, -h);
    ctx.lineTo(r, 0);
    ctx.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI);
    paint(ctx, null);
    arch(ctx, -2.2, -h * 0.68, 4.4, 10, SPAL.timber, 1);
    arch(ctx, -2.2, -h * 0.32, 4.4, 10, SPAL.timber, 1);
    const rc = ROOF[roofKind] || SPAL.slate;
    const pts = [-r * 1.25, -h + 2, 0, -h - r * 2.4, r * 1.25, -h + 2];
    poly(ctx, pts, rc);
    cover(ctx, pts, -r * 1.3, -h - r * 2.4, r * 2.6, r * 2.4, rc, roofKind);
    poly(ctx, [0, -h - r * 2.4, r * 1.25, -h + 2, r * 0.2, -h + 2], tone(rc, -0.2), 0);
    poly(ctx, pts, null);
    ctx.beginPath();
    ctx.ellipse(0, -h + 2, r * 1.25, 3, 0, 0, Math.PI);
    paint(ctx, null, 1.2);
    ctx.restore();
    if (side) G.banner(ctx, x, y - (h + r * 2.3) * s, s * 0.8, side, t, 18);
  }

  /** A rounded tree: a trunk with a fork, a bumpy crown, a lit lobe and a shaded one. */
  function tree(ctx, x, y, s = 1, seed = 1, kind = 'broad', sway = 0) {
    const r = G.rng(seed * 17 + 3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const h = 40 + r() * 7;
    shadow(ctx, 0, 0, 20, 5.5);
    poly(ctx, [-4.5, 0, -3, -17, -10, -26, -6, -27.5, 0, -20, 6, -29, 9.5, -27, 3.6, -15, 4.5, 0], SPAL.trunk, 1.4);
    line(ctx, [-6, 1, -4.5, -2, -1, 0, 3, -2, 6, 1], SPAL.trunk, 1.2);
    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) {
        const yy = -h - 6 + i * 11;
        const ww = 12 + i * 4;
        poly(ctx, [-ww, yy + 22, sway * 4, yy, ww, yy + 22], i === 0 ? '#5f8a52' : '#52774a', 1.4);
        poly(ctx, [sway * 4, yy, ww, yy + 22, 3, yy + 22], '#36573b', 0);
      }
      ctx.restore();
      return;
    }
    const cx = sway * 5;
    const cy = -h * 0.72;
    const R = 16 + r() * 3;
    const bumps = 11;
    ctx.beginPath();
    for (let i = 0; i <= bumps; i++) {
      const a = (i / bumps) * Math.PI * 2;
      const rr = R * (0.94 + hash(seed, i) * 0.1);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr * 0.92;
      if (i === 0) ctx.moveTo(px, py);
      else {
        const am = a - Math.PI / bumps;
        ctx.quadraticCurveTo(cx + Math.cos(am) * rr * 1.24, cy + Math.sin(am) * rr * 1.14, px, py);
      }
    }
    ctx.closePath();
    paint(ctx, kind === 'birch' ? '#93ae60' : SPAL.crown, 1.6);
    oval(ctx, cx - 4.5, cy - 5, R * 0.62, R * 0.44, SPAL.crownLight);
    oval(ctx, cx + 6, cy + 7, R * 0.46, R * 0.32, SPAL.crownDark);
    for (let i = 0; i < 3; i++) line(ctx, [cx - 8 + i * 7, cy - 1 + (i % 2) * 5, cx - 6 + i * 7, cy + 1 + (i % 2) * 5], SPAL.crownDark, 1);
    ctx.restore();
  }

  function bush(ctx, x, y, s = 1, seed = 1, berries = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    shadow(ctx, 0, 0, 15, 4);
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(-21, -9, -11, -10);
    ctx.quadraticCurveTo(-12, -19, -3, -15);
    ctx.quadraticCurveTo(5, -21, 10, -13);
    ctx.quadraticCurveTo(21, -13, 16, 0);
    ctx.closePath();
    paint(ctx, SPAL.crown, 1.3);
    oval(ctx, -6, -9, 7, 4, SPAL.crownLight);
    if (berries) for (let i = 0; i < 4; i++) oval(ctx, -8 + i * 5, -6 - (i % 2) * 4, 1.6, 1.6, berries, 0.5);
    void seed;
    ctx.restore();
  }

  function tuft(ctx, x, y, s = 1, color = SPAL.meadowDark, flower = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 1.6, 1);
      ctx.quadraticCurveTo(i * 2.3, -3, i * 3.4, -6 - Math.abs(i % 2) * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    if (flower) oval(ctx, 0, -8, 2, 2, flower, 0.4);
    ctx.restore();
  }

  function barrel(ctx, x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    shadow(ctx, 0, 0, 10, 3);
    ctx.beginPath();
    ctx.moveTo(-8, -19);
    ctx.quadraticCurveTo(-12, -10, -8, 0);
    ctx.quadraticCurveTo(0, 4, 8, 0);
    ctx.quadraticCurveTo(12, -10, 8, -19);
    ctx.closePath();
    paint(ctx, SPAL.wood);
    oval(ctx, 0, -19, 8, 3, tone(SPAL.wood, 0.17), 1);
    for (let i = -1; i <= 1; i++) line(ctx, [i * 4, -17, i * 5, -9, i * 4, 0], SPAL.woodShade, 0.8);
    for (const yy of [-14, -4]) line(ctx, [-9.5, yy, 0, yy + 2, 9.5, yy], '#5a4433', 2);
    ctx.restore();
  }

  function crate(ctx, x, y, s = 1, w = 18) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const h = w * 0.8;
    shadow(ctx, 0, 0, w * 0.65, 4);
    rect(ctx, -w / 2, -h, w, h, SPAL.wood, 1.3);
    poly(ctx, [-w / 2, -h, -w / 2 + 4, -h - 4, w / 2 + 4, -h - 4, w / 2, -h], tone(SPAL.wood, 0.19), 1.3);
    poly(ctx, [w / 2, -h, w / 2 + 4, -h - 4, w / 2 + 4, -4, w / 2, 0], SPAL.woodShade, 1.3);
    rect(ctx, -w / 2 + 3, -h + 3, w - 6, h - 6, null, 1);
    line(ctx, [-w / 2 + 3, -3, w / 2 - 3, -h + 3], SPAL.woodShade, 2);
    ctx.restore();
  }

  /** The well: a ring of stone in courses, the water inside, two posts, the winch and a bucket. */
  function well(ctx, x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    shadow(ctx, 0, 0, 20, 5);
    ctx.beginPath();
    ctx.moveTo(-15, -16);
    ctx.lineTo(-15, -4);
    ctx.ellipse(0, -4, 15, 6, 0, Math.PI, 0, true);
    ctx.lineTo(15, -16);
    ctx.closePath();
    paint(ctx, SPAL.stone);
    for (let row = 0; row < 2; row++) {
      const yy = -12 + row * 6;
      ctx.beginPath();
      ctx.ellipse(0, yy, 15, 5, 0, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = SPAL.stoneShade;
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        const xx = i * 5.5 + (row % 2) * 2.5;
        if (Math.abs(xx) < 13.5) line(ctx, [xx, yy + 1 + Math.abs(xx) * -0.05, xx, yy + 5.5], SPAL.stoneShade, 0.8);
      }
    }
    oval(ctx, 0, -16, 15, 6, tone(SPAL.stone, 0.06), 1.4);
    oval(ctx, 0, -16, 10.5, 3.8, SPAL.waterDeep, 1);
    oval(ctx, -2, -16.8, 4, 1.2, '#8fbfd0');
    for (const xx of [-13, 13]) rect(ctx, xx - 1.8, -40, 3.6, 24, SPAL.wood, 1, 0.8);
    rect(ctx, -15.5, -41, 31, 4.5, SPAL.woodShade, 1.2, 1);
    line(ctx, [-6, -36.5, -6, -33], INK, 0.8);
    rect(ctx, -9, -34, 18, 3.4, SPAL.wood, 1, 1.5);
    line(ctx, [0, -31, 0, -26], '#5a4433', 1.2);
    poly(ctx, [-4, -26.5, 4, -26.5, 3, -20.5, -3, -20.5], SPAL.wood, 1.1);
    line(ctx, [-4, -24, 4, -24], '#5a4433', 1);
    ctx.restore();
  }

  /** The market stall: posts, a counter of crates and baskets, a striped scalloped awning. */
  function stall(ctx, x, y, s = 1, color = '#3b6ea5', goods = ['#d9b04f', '#b84d3a', '#7fa055']) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    shadow(ctx, 0, 0, 30, 5);
    for (const xx of [-22, 22]) rect(ctx, xx - 1.4, -35, 2.8, 35, SPAL.woodShade, 1);
    rect(ctx, -24, -15, 48, 15, SPAL.wood, 1.4, 1);
    for (let i = 0; i < 3; i++) {
      const xx = -15 + i * 15;
      rect(ctx, xx - 6, -13, 12, 10, tone(SPAL.wood, 0.1), 0.9);
      line(ctx, [xx - 6, -3, xx + 6, -13], SPAL.woodShade, 0.8);
      oval(ctx, xx, -16, 7.5, 3.6, SPAL.woodShade, 0.9);
      for (let j = 0; j < 4; j++) oval(ctx, xx + ((j % 3) - 1) * 3.2, -18 - (j === 3 ? 3 : 0), 2.8, 2.8, goods[i % goods.length], 0.6);
    }
    poly(ctx, [24, -2, 31, -2, 31, -11, 27, -13, 24, -11], '#d7c08f', 1.1);
    for (let i = 0; i < 5; i++) {
      const l = -28 + i * 11.2;
      const r = l + 11.2;
      const tl = -23 + i * 9.2;
      const tr = tl + 9.2;
      const co = i % 2 ? SPAL.cloth : color;
      poly(ctx, [l, -30, tl, -44, tr, -44, r, -30], co, 1);
      ctx.beginPath();
      ctx.moveTo(l, -30);
      ctx.lineTo(r, -30);
      ctx.quadraticCurveTo((l + r) / 2, -22, l, -30);
      paint(ctx, tone(co, -0.06), 0.9);
    }
    line(ctx, [-23, -44, 23, -44], INK, 1.4);
    ctx.restore();
  }

  /**
   * Cobbles laid as single stones in rings round a plaza (an ellipse), each stone a little different in
   * size and tone, inside its edge of darker stones.
   */
  function plaza(ctx, p, color = SPAL.cobble) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx + 5, p.ry + 4, 0, 0, Math.PI * 2);
    paint(ctx, SPAL.roadEdge, 0);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    paint(ctx, tone(color, -0.1), 0);
    ctx.clip();
    const k = p.ry / p.rx;
    const step = 9;
    for (let ring = 0, r = step * 0.6; r < p.rx + step; ring++, r += step) {
      const n = Math.max(6, Math.round((Math.PI * 2 * r) / 13));
      for (let i = 0; i < n; i++) {
        const a0 = ((i + (ring % 2) * 0.5) / n) * Math.PI * 2;
        const a1 = a0 + ((Math.PI * 2) / n) * 0.86;
        const r0 = r - step * 0.42;
        const r1 = r + step * 0.42;
        const pt = (a, rr) => [p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * k];
        const [x0, y0] = pt(a0, r0);
        const [x1, y1] = pt(a1, r0);
        const [x2, y2] = pt(a1, r1);
        const [x3, y3] = pt(a0, r1);
        const tn = (hash(ring * 97 + 5, i) - 0.5) * 0.14;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fillStyle = tone(color, tn);
        ctx.fill();
        ctx.strokeStyle = SPAL.cobbleLine;
        ctx.lineWidth = 0.9;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = tone(SPAL.roadEdge, -0.12);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /** A street's paving, the rectangle of a town's `stone` (a forum, a square): stones in offset rows. */
  function paving(ctx, st, color = SPAL.cobble) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(st.x, st.y, st.w, st.h, 6);
    paint(ctx, tone(color, -0.1), 0);
    ctx.clip();
    for (let row = 0; row * 10 < st.h + 10; row++) {
      const yy = st.y + row * 10;
      for (let xx = st.x - (row % 2) * 8; xx < st.x + st.w; xx += 16) rect(ctx, xx + 0.7, yy + 0.7, 14.6, 8.6, tone(color, (hash(row * 13, xx) - 0.5) * 0.12), 0.8, 2);
    }
    ctx.restore();
  }

  // P11-12c: the kit's parts are the storybook ones everywhere (same signatures, same anchors).
  Object.assign(G, { building, tree, bush, tuft, barrel, crate, well, stall });
  G.story = { SPAL, INK, building, tower, tree, bush, tuft, barrel, crate, well, stall, plaza, paving, masonry, window4, door };
})(typeof window !== 'undefined' ? window : globalThis);
