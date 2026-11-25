/* Crownless graphics demonstration (experimental; Debug → Graphics Demo). Not part of normal play:
 * this file is only loaded when the demo is opened, and nothing in the game calls it.
 *
 * The shared visual language: one palette, one outline, one light, one shadow, and the small set of
 * drawing helpers every scene is built from (nature, props, buildings). Characters and horses are in
 * figures.js; the three scenes in map.js, city.js and battle.js.
 *
 * Conventions (every drawing function):
 *   - `ctx` first, then the anchor point: the object's foot or base centre (x, y) in world pixels, where
 *     it meets the ground. Things are drawn upward (negative y) from there, so sorting by y paints the
 *     scene in depth order.
 *   - `s` is a size multiplier (1 = the battle and town scale; the map uses about 0.45).
 *   - `seed` picks a stable variation (never Math.random while drawing, so nothing flickers).
 *   - Perspective: a slightly raised three-quarter view from the south. Fronts face the viewer, roofs
 *     and tree crowns are seen a little from above.
 *   - Light from the upper left: the left/top faces get `light`, the right/bottom faces `shade`, and
 *     shadows fall a little to the lower right (STYLE.shadow).
 *   - Outline: one warm dark brown, one width (STYLE.line), on silhouettes only, never on inner detail.
 *   - Colour: base, one shade, an optional highlight. No gradients, no textures. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** The palette. Change a value here and every scene follows. */
  const PAL = {
    grass: '#97b875',
    grassLight: '#a8c584',
    grassDark: '#86a967',
    meadow: '#b3c985',
    field: '#d9c784',
    fieldGreen: '#a9bf72',
    forest: '#4f7b4f',
    forestLight: '#6b9660',
    forestDark: '#3b6342',
    pine: '#45704f',
    pineDark: '#355a40',
    trunk: '#6b5339',
    road: '#d6c49d',
    roadEdge: '#c3ae84',
    cobble: '#cfc3a6',
    cobbleLine: '#b7aa8b',
    plaster: '#e4d1a7',
    plasterShade: '#cbb58a',
    stone: '#bdb6a5',
    stoneShade: '#9d9686',
    stoneDark: '#837c6e',
    timber: '#574b3a',
    terracotta: '#a96548',
    terracottaShade: '#8b4f37',
    slate: '#717d89',
    slateShade: '#5c6672',
    thatch: '#c8a660',
    thatchShade: '#a98944',
    shingle: '#6b5444',
    shingleShade: '#56423a',
    door: '#6a4a30',
    window: '#4a5560',
    windowLit: '#f2cf7a',
    water: '#7fb3c8',
    waterDeep: '#6aa1b8',
    waterLight: '#b4d8e2',
    sand: '#e2d2a0',
    bank: '#c7b98a',
    rock: '#a9a395',
    rockShade: '#8b8578',
    snow: '#f3efe4',
    mountain: '#a39a86',
    mountainShade: '#857c6b',
    steel: '#b6bfc8',
    steelShade: '#8592a0',
    wood: '#9a7448',
    woodShade: '#7a5a37',
    cloth: '#e9dcc0',
    gold: '#d8b25a',
    crimson: '#b0453a',
    ink: '#3a2b20',
  };

  /** One outline, one light, one shadow for everything. */
  const STYLE = {
    outline: 'rgba(58,43,32,0.78)',
    line: 1.3,
    shadow: 'rgba(42,60,30,0.2)',
    shadowDx: 0.32, // shadows lean to the lower right: dx per unit of height
    shadowDy: 0.12,
  };

  /** Realm colours and shapes used by the demo (from data/factions.js where it has them). */
  const REALMS = {
    valedorn: { color: '#3b6ea5', trim: '#e8dcb8', dark: '#2d5582', device: 'chevron', shield: 'kite' },
    hrothmark: { color: '#4f7a5a', trim: '#e2d6b4', dark: '#3a5c44', device: 'quarter', shield: 'round' },
    reavers: { color: '#5a3a32', trim: '#b0453a', dark: '#3e2622', device: 'slash', shield: 'round' },
    merchant: { color: '#c08a3e', trim: '#f0e2bf', dark: '#946628', device: 'coin', shield: 'round' },
  };

  /** Mulberry32: a small seeded generator for stable variation. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** A stable number in [0, 1) from a seed and an index. */
  const hash = (seed, i = 0) => rng((seed * 2654435761 + i * 40503) >>> 0)();

  const shades = new Map();
  /** A colour lightened (k > 0) or darkened (k < 0), memoised: hex in, hex out. */
  function tone(hex, k) {
    const key = `${hex}${k}`;
    let v = shades.get(key);
    if (v) return v;
    const n = Number.parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
    const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
    v = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    shades.set(key, v);
    return v;
  }

  // ---- Path helpers ----

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }
  /** Fill the current path, then outline it (the one outline). */
  function fillLine(ctx, fill, line = STYLE.line) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (line > 0) {
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = line;
      ctx.stroke();
    }
  }
  function fill(ctx, color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  /** The soft ground shadow under anything standing: an ellipse leaning lower right. */
  function shadow(ctx, x, y, rx, ry, height = 0) {
    ctx.fillStyle = STYLE.shadow;
    ellipse(ctx, x + height * STYLE.shadowDx, y + height * STYLE.shadowDy, rx, ry);
    ctx.fill();
  }

  // ---- Nature ----

  /**
   * A tree: a short irregular trunk and three overlapping crown shapes (shade, base, light).
   * kind: 'broad' (oak), 'pine', 'birch'. `sway` (radians) leans the crown a touch in the wind.
   */
  function tree(ctx, x, y, s = 1, seed = 1, kind = 'broad', sway = 0) {
    const r = rng(seed);
    const h = (34 + r() * 10) * s;
    shadow(ctx, x + 6 * s, y, 18 * s, 6 * s, h * 0.25);
    if (kind === 'pine') {
      const w = (15 + r() * 4) * s;
      ctx.fillStyle = PAL.trunk;
      ctx.fillRect(x - 2 * s, y - 8 * s, 4 * s, 8 * s);
      const lean = sway * h * 0.5;
      for (let i = 0; i < 3; i++) {
        const top = y - h + i * h * 0.24;
        const base = y - h * 0.22 - (2 - i) * h * 0.14;
        const ww = w * (0.6 + i * 0.22);
        poly(ctx, [x + lean * (1 - i * 0.3), top, x + ww, base, x - ww, base]);
        fillLine(ctx, i === 2 ? PAL.pine : tone(PAL.pine, 0.06 * (2 - i)));
        // Shaded right half: one flat shape, no gradient.
        poly(ctx, [x + lean * (1 - i * 0.3), top, x + ww, base, x + ww * 0.1, base]);
        fill(ctx, PAL.pineDark);
      }
      return;
    }
    const birch = kind === 'birch';
    // Trunk with a fork, slightly irregular.
    ctx.fillStyle = birch ? '#e6e0d0' : PAL.trunk;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y);
    ctx.lineTo(x - 2 * s, y - h * 0.45);
    ctx.lineTo(x - 5 * s, y - h * 0.62);
    ctx.lineTo(x + 1 * s, y - h * 0.5);
    ctx.lineTo(x + 5 * s, y - h * 0.62);
    ctx.lineTo(x + 2.5 * s, y - h * 0.42);
    ctx.lineTo(x + 3.5 * s, y);
    ctx.closePath();
    fillLine(ctx, birch ? '#e6e0d0' : PAL.trunk, STYLE.line * 0.9);
    const cx = x + sway * h * 0.6;
    const cy = y - h * 0.72;
    const R = (13 + r() * 4) * s * (birch ? 0.85 : 1);
    const base = birch ? '#8fb067' : PAL.forest;
    // Crown silhouette: four blobs as one path, outlined once.
    const blobs = [
      [cx - R * 0.55, cy + R * 0.15, R * 0.72],
      [cx + R * 0.55, cy + R * 0.2, R * 0.7],
      [cx + (r() - 0.5) * R * 0.3, cy - R * 0.35, R * 0.8],
      [cx, cy + R * 0.35, R * 0.7],
    ];
    ctx.beginPath();
    for (const [bx, by, br] of blobs) {
      ctx.moveTo(bx + br, by);
      ctx.arc(bx, by, br, 0, Math.PI * 2);
    }
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = STYLE.line * 2; // the outer half shows round the union
    ctx.stroke();
    ctx.fillStyle = base;
    ctx.fill();
    // Shade on the lower right, light on the upper left (two flat shapes).
    ctx.fillStyle = tone(base, -0.16);
    ellipse(ctx, cx + R * 0.38, cy + R * 0.42, R * 0.62, R * 0.42);
    ctx.fill();
    ctx.fillStyle = tone(base, 0.16);
    ellipse(ctx, cx - R * 0.32, cy - R * 0.38, R * 0.42, R * 0.3);
    ctx.fill();
  }

  /** A low bush: two or three blobs; `berries` adds a few dots of colour. */
  function bush(ctx, x, y, s = 1, seed = 1, berries = null) {
    const r = rng(seed);
    const w = (11 + r() * 4) * s;
    shadow(ctx, x + 3 * s, y, w * 1.05, 4 * s, 4 * s);
    ctx.beginPath();
    for (const [bx, by, br] of [[x - w * 0.45, y - 5 * s, w * 0.58], [x + w * 0.42, y - 5 * s, w * 0.55], [x, y - 9 * s, w * 0.62]]) {
      ctx.moveTo(bx + br, by);
      ctx.arc(bx, by, br, 0, Math.PI * 2);
    }
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = STYLE.line * 2;
    ctx.stroke();
    ctx.fillStyle = PAL.forestLight;
    ctx.fill();
    ctx.fillStyle = tone(PAL.forestLight, 0.15);
    ellipse(ctx, x - w * 0.25, y - 11 * s, w * 0.35, w * 0.22);
    ctx.fill();
    if (berries) {
      ctx.fillStyle = berries;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + (r() - 0.5) * w * 1.3, y - 4 * s - r() * 8 * s, 1.3 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** A boulder: a faceted lump, lit top-left. */
  function rock(ctx, x, y, s = 1, seed = 1) {
    const r = rng(seed);
    const w = (11 + r() * 6) * s;
    const h = (8 + r() * 5) * s;
    shadow(ctx, x + 3 * s, y, w * 1.05, 4 * s, h * 0.5);
    const pts = [x - w, y, x - w * 0.8, y - h * 0.7, x - w * 0.2, y - h, x + w * 0.55, y - h * 0.85, x + w, y - h * 0.25, x + w * 0.85, y];
    poly(ctx, pts);
    fillLine(ctx, PAL.rock);
    poly(ctx, [x - w * 0.8, y - h * 0.7, x - w * 0.2, y - h, x + w * 0.55, y - h * 0.85, x + w * 0.1, y - h * 0.45]);
    fill(ctx, tone(PAL.rock, 0.18));
    poly(ctx, [x + w * 0.55, y - h * 0.85, x + w, y - h * 0.25, x + w * 0.85, y, x + w * 0.2, y]);
    fill(ctx, PAL.rockShade);
  }

  /** A tuft of grass or a few flowers: tiny strokes for the ground (decor; no outline). */
  function tuft(ctx, x, y, s = 1, color = PAL.grassDark, flowers = null) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y);
    ctx.lineTo(x - 4 * s, y - 4 * s);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5 * s);
    ctx.moveTo(x + 3 * s, y);
    ctx.lineTo(x + 4.5 * s, y - 3.5 * s);
    ctx.stroke();
    if (flowers) {
      ctx.fillStyle = flowers;
      ctx.beginPath();
      ctx.arc(x - 4 * s, y - 5 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.arc(x + 4.5 * s, y - 4.5 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Props ----

  function barrel(ctx, x, y, s = 1) {
    shadow(ctx, x + 2 * s, y, 8 * s, 3 * s, 6 * s);
    rrect(ctx, x - 6 * s, y - 15 * s, 12 * s, 15 * s, 4 * s);
    fillLine(ctx, PAL.wood);
    ctx.fillStyle = PAL.woodShade;
    ctx.fillRect(x + 1.5 * s, y - 14 * s, 4 * s, 13 * s);
    ctx.strokeStyle = PAL.steelShade;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y - 11 * s);
    ctx.lineTo(x + 6 * s, y - 11 * s);
    ctx.moveTo(x - 6 * s, y - 4 * s);
    ctx.lineTo(x + 6 * s, y - 4 * s);
    ctx.stroke();
    ellipse(ctx, x, y - 15 * s, 6 * s, 2.2 * s);
    fillLine(ctx, tone(PAL.wood, 0.15), STYLE.line * 0.8);
  }

  /** A crate seen from above-front: a lit top and a front face with a plank cross. */
  function crate(ctx, x, y, s = 1, w = 18) {
    const W = w * s;
    const H = W * 0.75;
    const T = W * 0.38;
    shadow(ctx, x + 3 * s, y, W * 0.65, 4 * s, H * 0.5);
    rrect(ctx, x - W / 2, y - H - T, W, H + T, 1.5 * s);
    fillLine(ctx, PAL.wood);
    ctx.fillStyle = tone(PAL.wood, 0.18);
    ctx.fillRect(x - W / 2 + 1, y - H - T + 1, W - 2, T - 1);
    ctx.strokeStyle = PAL.woodShade;
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(x - W / 2 + 2, y - H + 2);
    ctx.lineTo(x + W / 2 - 2, y - 2);
    ctx.moveTo(x - W / 2, y - H);
    ctx.lineTo(x + W / 2, y - H);
    ctx.stroke();
  }

  /** A fence from (x1, y1) to (x2, y2): posts and two rails. */
  function fence(ctx, x1, y1, x2, y2, s = 1) {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / (16 * s)));
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 3.4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const h of [5, 10]) {
      ctx.moveTo(x1, y1 - h * s);
      ctx.lineTo(x2, y2 - h * s);
    }
    ctx.stroke();
    ctx.strokeStyle = PAL.wood;
    ctx.lineWidth = 1.8 * s;
    ctx.stroke();
    for (let i = 0; i <= n; i++) {
      const px = x1 + ((x2 - x1) * i) / n;
      const py = y1 + ((y2 - y1) * i) / n;
      rrect(ctx, px - 1.8 * s, py - 13 * s, 3.6 * s, 13 * s, 1 * s);
      fillLine(ctx, PAL.woodShade, STYLE.line * 0.8);
    }
    ctx.lineCap = 'butt';
  }

  /** A low dry-stone wall from (x1, y) to (x2, y): a lit top and a front face. */
  function stoneWall(ctx, x1, y, x2, s = 1, seed = 3) {
    const h = 12 * s;
    const t = 6 * s;
    shadow(ctx, (x1 + x2) / 2 + 3, y + 2, (x2 - x1) / 2 + 4, 4 * s, h);
    rrect(ctx, x1, y - h - t, x2 - x1, h + t, 3 * s);
    fillLine(ctx, PAL.stoneShade);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(x1 + 1, y - h - t + 1, x2 - x1 - 2, t);
    const r = rng(seed);
    // Capstones along the top, irregular (by seed, so stable).
    for (let xx = x1 + 4 * s; xx < x2 - 3 * s; ) {
      const w = (7 + r() * 6) * s;
      rrect(ctx, xx, y - h - t - 2.5 * s, Math.min(w, x2 - 2 - xx), 6 * s, 2.5 * s);
      fillLine(ctx, tone(PAL.stone, r() * 0.12), STYLE.line * 0.7);
      xx += w + 1.5 * s;
    }
    ctx.strokeStyle = tone(PAL.stoneShade, -0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let xx = x1 + 6 * s; xx < x2 - 4; xx += (8 + r() * 8) * s) {
      const yy = y - h + (r() < 0.5 ? 3 : 7) * s;
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + 4 * s);
    }
    ctx.stroke();
  }

  /** A banner on a pole: field colour, a simple device, a gentle wave from `t`. */
  function banner(ctx, x, y, s, realm, t = 0, h = 34) {
    const R = REALMS[realm] || realm;
    const H = h * s;
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - H);
    ctx.stroke();
    ctx.strokeStyle = PAL.woodShade;
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
    const w = 14 * s;
    const fh = 11 * s;
    const wave = Math.sin(t * 3) * 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - H + 1);
    ctx.quadraticCurveTo(x + w * 0.5, y - H + 1 + wave, x + w, y - H + 2);
    ctx.lineTo(x + w - 2 * s, y - H + fh * 0.6 + wave * 0.4);
    ctx.lineTo(x + w, y - H + fh + 1);
    ctx.quadraticCurveTo(x + w * 0.5, y - H + fh + wave, x, y - H + fh);
    ctx.closePath();
    fillLine(ctx, R.color, STYLE.line * 0.9);
    device(ctx, x + w * 0.42, y - H + fh * 0.55 + wave * 0.5, 3.6 * s, R);
  }

  /** A realm's device, small: chevron, quarters, a slash, a coin. Shape as well as colour. */
  function device(ctx, x, y, r, R) {
    ctx.fillStyle = R.trim;
    ctx.strokeStyle = R.trim;
    ctx.lineWidth = r * 0.5;
    ctx.beginPath();
    if (R.device === 'chevron') {
      ctx.moveTo(x - r, y + r * 0.6);
      ctx.lineTo(x, y - r * 0.5);
      ctx.lineTo(x + r, y + r * 0.6);
      ctx.stroke();
    } else if (R.device === 'quarter') {
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
    } else if (R.device === 'slash') {
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.stroke();
    } else {
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function well(ctx, x, y, s = 1) {
    shadow(ctx, x + 4 * s, y, 18 * s, 6 * s, 10 * s);
    ellipse(ctx, x, y - 8 * s, 15 * s, 7 * s);
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);
    ellipse(ctx, x, y, 15 * s, 4 * s);
    fill(ctx, PAL.stoneShade);
    ellipse(ctx, x, y - 9 * s, 11 * s, 4.5 * s);
    fill(ctx, PAL.waterDeep);
    // The roof frame.
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y - 6 * s);
    ctx.lineTo(x - 12 * s, y - 30 * s);
    ctx.moveTo(x + 12 * s, y - 6 * s);
    ctx.lineTo(x + 12 * s, y - 30 * s);
    ctx.stroke();
    ctx.strokeStyle = PAL.wood;
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    poly(ctx, [x - 17 * s, y - 27 * s, x, y - 39 * s, x + 17 * s, y - 27 * s]);
    fillLine(ctx, PAL.terracotta);
    poly(ctx, [x, y - 39 * s, x + 17 * s, y - 27 * s, x + 4 * s, y - 27 * s]);
    fill(ctx, PAL.terracottaShade);
  }

  /** A market stall: counter, produce, and a striped fabric awning in `color`. */
  function stall(ctx, x, y, s = 1, color = PAL.crimson, goods = ['#d9b04f', '#b84d3a', '#7fa055']) {
    const w = 46 * s;
    shadow(ctx, x + 6 * s, y, w * 0.6, 6 * s, 14 * s);
    // Posts.
    ctx.fillStyle = PAL.woodShade;
    for (const px of [x - w / 2 + 2, x + w / 2 - 5]) ctx.fillRect(px, y - 34 * s, 3 * s, 34 * s);
    rrect(ctx, x - w / 2, y - 14 * s, w, 14 * s, 2 * s);
    fillLine(ctx, PAL.wood);
    // Produce baskets on the counter.
    goods.forEach((c, i) => {
      const bx = x - w / 2 + 8 * s + i * 15 * s;
      ellipse(ctx, bx, y - 15 * s, 6 * s, 3.4 * s);
      fillLine(ctx, '#b08a52', STYLE.line * 0.7);
      ctx.fillStyle = c;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(bx - 3 * s + k * 3 * s, y - 17 * s - (k % 2) * 1.5 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // Awning: a sloped panel with stripes and a scalloped edge.
    const top = y - 40 * s;
    const lip = y - 30 * s;
    poly(ctx, [x - w / 2 - 4 * s, lip, x - w / 2 + 2 * s, top, x + w / 2 - 2 * s, top, x + w / 2 + 4 * s, lip]);
    fillLine(ctx, PAL.cloth);
    ctx.fillStyle = color;
    const n = 5;
    for (let i = 0; i < n; i += 2) {
      const a = i / n;
      const b = (i + 1) / n;
      const lx = (k) => x - w / 2 - 4 * s + k * (w + 8 * s);
      const tx = (k) => x - w / 2 + 2 * s + k * (w - 4 * s);
      poly(ctx, [lx(a), lip, tx(a), top, tx(b), top, lx(b), lip]);
      ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const lx = x - w / 2 - 4 * s + ((i + 0.5) * (w + 8 * s)) / n;
      ctx.moveTo(lx + (w + 8 * s) / n / 2, lip);
      ctx.arc(lx, lip, (w + 8 * s) / n / 2, 0, Math.PI);
    }
    fillLine(ctx, color, STYLE.line * 0.8);
  }

  /** The smith's anvil on its stump, and a forge whose glow pulses with `t`. */
  function anvil(ctx, x, y, s = 1) {
    shadow(ctx, x + 2 * s, y, 9 * s, 3 * s, 6 * s);
    ctx.fillStyle = PAL.woodShade;
    rrect(ctx, x - 5 * s, y - 8 * s, 10 * s, 8 * s, 2 * s);
    fillLine(ctx, PAL.woodShade);
    poly(ctx, [x - 9 * s, y - 13 * s, x + 7 * s, y - 13 * s, x + 11 * s, y - 11 * s, x + 4 * s, y - 9 * s, x - 6 * s, y - 9 * s]);
    fillLine(ctx, '#5d636b');
  }
  function forge(ctx, x, y, s = 1, t = 0, night = 0) {
    shadow(ctx, x + 4 * s, y, 17 * s, 5 * s, 10 * s);
    rrect(ctx, x - 15 * s, y - 16 * s, 30 * s, 16 * s, 3 * s);
    fillLine(ctx, PAL.stoneShade);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(x - 14 * s, y - 15 * s, 28 * s, 4 * s);
    const glow = 0.65 + 0.35 * Math.sin(t * 5) * Math.sin(t * 2.3);
    ellipse(ctx, x, y - 13 * s, 9 * s, 3 * s);
    fill(ctx, `rgba(238,${120 + Math.round(60 * glow)},60,${0.85})`);
    if (night) {
      ctx.fillStyle = `rgba(255,170,80,${0.12 * glow * night})`;
      ellipse(ctx, x, y - 8 * s, 40 * s, 22 * s);
      ctx.fill();
    }
  }

  /** A weapon rack: spears and shields by the barracks door. */
  function rack(ctx, x, y, s = 1, realm = 'valedorn') {
    const R = REALMS[realm];
    shadow(ctx, x + 3 * s, y, 14 * s, 4 * s, 10 * s);
    ctx.strokeStyle = PAL.woodShade;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(x - 9 * s + i * 6 * s, y);
      ctx.lineTo(x - 11 * s + i * 6 * s, y - 34 * s);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.steel;
    for (let i = 0; i < 4; i++) {
      poly(ctx, [x - 11 * s + i * 6 * s, y - 40 * s, x - 13 * s + i * 6 * s, y - 33 * s, x - 9 * s + i * 6 * s, y - 33 * s]);
      ctx.fill();
    }
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(x - 14 * s, y - 14 * s, 28 * s, 3 * s);
    shieldShape(ctx, x + 13 * s, y - 10 * s, 6 * s, R.shield, R);
  }

  /** A shield's face: 'kite', 'round' or 'heater', in a realm's colours with its device. */
  function shieldShape(ctx, x, y, r, shape, R, back = false) {
    ctx.beginPath();
    if (shape === 'kite') {
      ctx.moveTo(x - r * 0.85, y - r * 0.9);
      ctx.quadraticCurveTo(x, y - r * 1.25, x + r * 0.85, y - r * 0.9);
      ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.4, x, y + r * 1.45);
      ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.4, x - r * 0.85, y - r * 0.9);
    } else if (shape === 'heater') {
      ctx.moveTo(x - r * 0.9, y - r * 0.85);
      ctx.lineTo(x + r * 0.9, y - r * 0.85);
      ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.6, x, y + r * 1.15);
      ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.6, x - r * 0.9, y - r * 0.85);
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    if (back) return fillLine(ctx, PAL.wood);
    fillLine(ctx, R.wood ? PAL.wood : R.color);
    ctx.save();
    ctx.clip();
    if (shape === 'round') {
      // Planks, a rim and a boss: the northern round shield.
      if (R.device === 'quarter') {
        ctx.fillStyle = R.trim;
        ctx.fillRect(x - r, y - r, r, r);
        ctx.fillRect(x, y, r, r);
      } else if (R.device === 'slash') {
        ctx.strokeStyle = R.trim;
        ctx.lineWidth = r * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = tone(PAL.steelShade, -0.1);
      ctx.lineWidth = r * 0.16;
      ellipse(ctx, x, y, r * 0.92, r * 0.92);
      ctx.stroke();
      ellipse(ctx, x, y, r * 0.28, r * 0.28);
      fillLine(ctx, PAL.steel, STYLE.line * 0.7);
      return;
    }
    device(ctx, x, y - r * 0.05, r * 0.55, R);
    ctx.restore();
  }

  // ---- Buildings ----

  /** Wall and roof materials: [base, shade]. */
  const WALLS = {
    plaster: [PAL.plaster, PAL.plasterShade],
    stone: [PAL.stone, PAL.stoneShade],
    timber: ['#a5835a', '#8a6b47'],
    whitewash: ['#ece3cc', '#d3c7a9'],
  };
  const ROOFS = {
    terracotta: [PAL.terracotta, PAL.terracottaShade],
    slate: [PAL.slate, PAL.slateShade],
    thatch: [PAL.thatch, PAL.thatchShade],
    shingle: [PAL.shingle, PAL.shingleShade],
    turf: ['#7d9156', '#677a45'],
  };

  /**
   * A building, three-quarter view. Spec (all in world px at s = 1):
   *   x, y      the front wall's bottom centre (the street line)
   *   w         front width;   d  depth (how much roof shows above the wall)
   *   h         wall height
   *   wall      'plaster' | 'stone' | 'timber' | 'whitewash';  base: optional stone ground floor
   *   roof      'terracotta' | 'slate' | 'thatch' | 'shingle' | 'turf'
   *   form      'gable' (ridge along the front) | 'end' (gable end to the street) | 'hip' | 'long' (a hall)
   *   beams     timber framing on the wall;  chimney: -1..1 along the ridge, or null
   *   door      'center' | 'left' | 'right' | 'wide' (a barn or forge);  windows: count
   *   sign      { kind: 'tavern' | 'smith' | 'barracks' | 'guild', at: 'left' | 'right' }
   *   awning    a colour for a cloth awning over the door
   * `night` (0..1) lights the windows.
   */
  function building(ctx, b, t = 0, night = 0) {
    const s = b.s || 1;
    const { x, y } = b;
    const w = b.w * s;
    const h = b.h * s;
    const d = (b.d ?? b.w * 0.5) * s;
    const [wall, wallShade] = WALLS[b.wall || 'plaster'];
    const [roof, roofShade] = ROOFS[b.roof || 'terracotta'];
    const L = x - w / 2;
    const R = x + w / 2;
    const top = y - h;
    // Shadow: the footprint pushed lower right.
    ctx.fillStyle = STYLE.shadow;
    poly(ctx, [R, y, R + h * 0.42, y + h * 0.1, R + h * 0.42, top - d * 0.4 + h * 0.18, R, top - d * 0.5]);
    ctx.fill();
    ctx.fillRect(L + 6 * s, y - 2, w, 6 * s);

    const form = b.form || 'gable';
    const over = 5 * s; // eaves overhang
    // Front wall (and, for 'end', the gable triangle above it).
    const peak = top - d * 0.95;
    if (form === 'end') {
      poly(ctx, [L, y, L, top, x, peak, R, top, R, y]);
    } else {
      poly(ctx, [L, y, L, top, R, top, R, y]);
    }
    fillLine(ctx, wall);
    // The wall's right quarter in shade (light from the left), as one flat shape.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = wallShade;
    ctx.fillRect(R - w * 0.16, peak - 2, w * 0.16 + 1, y - peak + 2);
    if (b.base) {
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(L, y - h * 0.45, w, h * 0.45);
      ctx.fillStyle = PAL.stoneShade;
      ctx.fillRect(R - w * 0.16, y - h * 0.45, w * 0.16, h * 0.45);
      ctx.strokeStyle = tone(PAL.stoneShade, -0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, y - h * 0.45);
      ctx.lineTo(R, y - h * 0.45);
      for (let i = 1; i < w / (12 * s); i++) {
        const xx = L + i * 12 * s + ((i % 2) * 6 - 3) * s;
        ctx.moveTo(xx, y - h * 0.45);
        ctx.lineTo(xx, y - h * 0.22);
      }
      ctx.stroke();
    } else if ((b.wall || 'plaster') === 'stone') {
      ctx.strokeStyle = tone(PAL.stoneShade, -0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let row = 1; row * 8 * s < h; row++) {
        const yy = y - row * 8 * s;
        for (let xx = L + ((row % 2) * 7 + 4) * s; xx < R - 2; xx += 14 * s) {
          ctx.moveTo(xx, yy);
          ctx.lineTo(xx + 6 * s, yy);
        }
      }
      ctx.stroke();
    }
    if (b.beams) {
      // Timber framing: posts, a rail, a pair of braces. Upper floor only when there is a stone base.
      const y0 = b.base ? y - h * 0.45 : y;
      ctx.strokeStyle = PAL.timber;
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(L, top + 1.5 * s);
      ctx.lineTo(R, top + 1.5 * s);
      ctx.moveTo(L, y0 - 1);
      ctx.lineTo(R, y0 - 1);
      const posts = Math.max(2, Math.round(w / (22 * s)));
      for (let i = 0; i <= posts; i++) {
        const xx = L + (i * w) / posts;
        ctx.moveTo(xx, top);
        ctx.lineTo(xx, y0);
      }
      ctx.moveTo(L + 2, y0 - 2);
      ctx.lineTo(L + w / posts - 2, top + 3);
      ctx.moveTo(R - 2, y0 - 2);
      ctx.lineTo(R - w / posts + 2, top + 3);
      if (form === 'end') {
        ctx.moveTo(x, peak + 4);
        ctx.lineTo(x, top);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Roof.
    if (form === 'end') {
      // Two planes seen from the gable end: the left one lit, the right one in shade.
      poly(ctx, [L - over, top + 2 * s, x, peak - over * 0.6, x - d * 0.18, peak - d * 0.62, L - over - d * 0.18, top - d * 0.62 + 2 * s]);
      fillLine(ctx, tone(roof, 0.06));
      poly(ctx, [R + over, top + 2 * s, x, peak - over * 0.6, x - d * 0.18, peak - d * 0.62, R + over - d * 0.18, top - d * 0.62 + 2 * s]);
      fillLine(ctx, roofShade);
      roofLines(ctx, b, L - over, top - d * 0.62, w + over * 2, d * 0.6, roofShade);
    } else {
      const back = top - d;
      const inset = form === 'hip' ? w * 0.22 : form === 'long' ? w * 0.06 : 0;
      // Front slope (most of what shows), a thin lit strip of the back slope above the ridge.
      const ridge = back + d * 0.2;
      poly(ctx, [L - over, top + 2 * s, R + over, top + 2 * s, R - inset, ridge, L + inset, ridge]);
      fillLine(ctx, roof);
      poly(ctx, [L + inset, ridge, R - inset, ridge, R - inset * 0.7, back, L + inset * 0.7, back]);
      fillLine(ctx, tone(roof, 0.12));
      if (form === 'hip') {
        // The hipped ends: the right one in shade, the left one lit.
        poly(ctx, [R + over, top + 2 * s, R - inset, ridge, R - inset * 0.7, back]);
        fillLine(ctx, roofShade);
        poly(ctx, [L - over, top + 2 * s, L + inset, ridge, L + inset * 0.7, back]);
        fillLine(ctx, tone(roof, 0.08));
      } else {
        // The right end of the slope in shade, as one flat band (light from the left).
        poly(ctx, [R + over - w * 0.14, top + 2 * s, R + over, top + 2 * s, R - inset, ridge, R - inset - w * 0.12, ridge]);
        fill(ctx, roofShade);
      }
      roofLines(ctx, b, L - over, ridge, w + over * 2, top - ridge, roofShade);
      if (b.chimney != null) {
        const cx = x + b.chimney * w * 0.3;
        rrect(ctx, cx - 4 * s, ridge - 6 * s, 8 * s, 16 * s, 1.5 * s);
        fillLine(ctx, PAL.stoneShade);
        ctx.fillStyle = PAL.stone;
        ctx.fillRect(cx - 3.5 * s, ridge - 5.5 * s, 3.5 * s, 15 * s);
      }
    }

    // Door, windows, sign, awning.
    const doorW = (b.door === 'wide' ? 22 : 11) * s;
    const doorH = (b.door === 'wide' ? 20 : 17) * s;
    const dx = b.door === 'left' ? L + w * 0.22 : b.door === 'right' ? R - w * 0.22 : x;
    rrect(ctx, dx - doorW / 2, y - doorH, doorW, doorH, b.door === 'wide' ? 2 * s : 5 * s);
    fillLine(ctx, b.door === 'wide' ? tone(PAL.door, -0.1) : PAL.door);
    if (b.door === 'wide' && night === 0) {
      ctx.fillStyle = '#2f2722';
      ctx.fillRect(dx - doorW / 2 + 3, y - doorH + 3, doorW - 6, doorH - 3);
    }
    const n = b.windows ?? Math.max(1, Math.round(w / (30 * s)));
    const lit = night > 0.3;
    for (let i = 0; i < n; i++) {
      // Windows spread across the wall, skipping the door.
      let wx = L + ((i + 0.5) * w) / n;
      if (Math.abs(wx - dx) < doorW) wx += (wx < dx ? -1 : 1) * doorW * 0.9;
      if (wx < L + 6 * s || wx > R - 6 * s) continue;
      const wy = b.base ? top + h * 0.2 : y - h * 0.62;
      rrect(ctx, wx - 3.6 * s, wy, 7.2 * s, 8 * s, 2.5 * s);
      fillLine(ctx, lit && hash(b.seed || 7, i) < 0.8 ? PAL.windowLit : PAL.window, STYLE.line * 0.8);
      ctx.fillStyle = PAL.timber;
      ctx.fillRect(wx - 4.6 * s, wy + 8 * s, 9.2 * s, 1.6 * s);
    }
    if (b.awning) {
      poly(ctx, [dx - doorW, y - doorH - 2 * s, dx + doorW, y - doorH - 2 * s, dx + doorW + 3 * s, y - doorH + 6 * s, dx - doorW - 3 * s, y - doorH + 6 * s]);
      fillLine(ctx, b.awning);
    }
    if (b.sign) hangingSign(ctx, b.sign.at === 'left' ? L + 4 * s : R - 4 * s, top + 8 * s, s, b.sign.kind, b.sign.at === 'left' ? -1 : 1, t);
    if (lit && night > 0) {
      // Light spill from the door, faint.
      ctx.fillStyle = `rgba(255,205,120,${0.14 * night})`;
      ellipse(ctx, dx, y + 4 * s, doorW * 1.4, 6 * s);
      ctx.fill();
    }
  }

  /** Thatch gets soft bands; tiles and slate get courses. Inside the roof box (clipped). */
  function roofLines(ctx, b, x, y, w, h, color) {
    if (h <= 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = (b.roof === 'thatch' ? 5 : 4.2) * (b.s || 1);
    for (let yy = y + step; yy < y + h - 1; yy += step) {
      ctx.moveTo(x + 3, yy);
      ctx.lineTo(x + w - 3, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** A sign on a bracket: a tankard (tavern), an anvil (smith), crossed spears (barracks), a key (guild). */
  function hangingSign(ctx, x, y, s, kind, dir, t) {
    const sw = Math.sin(t * 1.7) * 0.08;
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 14 * s, y);
    ctx.stroke();
    ctx.save();
    ctx.translate(x + dir * 11 * s, y);
    ctx.rotate(sw);
    rrect(ctx, -7 * s, 2 * s, 14 * s, 12 * s, 2 * s);
    fillLine(ctx, PAL.cloth, STYLE.line * 0.9);
    ctx.fillStyle = PAL.timber;
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    if (kind === 'tavern') {
      ctx.fillStyle = '#b97b3a';
      ctx.fillRect(-3.5 * s, 5 * s, 6 * s, 7 * s);
      ctx.fillStyle = '#fff7e0';
      ctx.fillRect(-3.5 * s, 4 * s, 6 * s, 2 * s);
      ctx.arc(3.3 * s, 8.5 * s, 2 * s, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else if (kind === 'smith') {
      poly(ctx, [-5 * s, 6 * s, 4 * s, 6 * s, 5.5 * s, 7.5 * s, 2 * s, 9 * s, -3 * s, 9 * s]);
      ctx.fill();
      ctx.fillRect(-1.5 * s, 9 * s, 3 * s, 3 * s);
    } else if (kind === 'barracks') {
      ctx.moveTo(-4.5 * s, 12 * s);
      ctx.lineTo(4.5 * s, 4 * s);
      ctx.moveTo(4.5 * s, 12 * s);
      ctx.lineTo(-4.5 * s, 4 * s);
      ctx.stroke();
    } else {
      ctx.arc(-2 * s, 8 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.moveTo(0.4 * s, 8 * s);
      ctx.lineTo(5 * s, 8 * s);
      ctx.lineTo(5 * s, 10 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A town wall run from (x1, y) to (x2, y) with crenellations, and optional towers at the ends. */
  function cityWall(ctx, x1, y, x2, s = 1, h = 30) {
    const H = h * s;
    const T = 8 * s;
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(x1 + 5, y, x2 - x1, 8 * s);
    poly(ctx, [x1, y, x1, y - H, x2, y - H, x2, y]);
    fillLine(ctx, PAL.stoneShade);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(x1 + 1, y - H - T, x2 - x1 - 2, T);
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = STYLE.line;
    ctx.strokeRect(x1, y - H - T, x2 - x1, T);
    // Merlons along the walk.
    for (let xx = x1 + 3 * s; xx < x2 - 6 * s; xx += 12 * s) {
      rrect(ctx, xx, y - H - T - 6 * s, 7 * s, 7 * s, 1 * s);
      fillLine(ctx, PAL.stone, STYLE.line * 0.8);
    }
    ctx.strokeStyle = tone(PAL.stoneShade, -0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let row = 1; row * 9 * s < H; row++) {
      for (let xx = x1 + ((row % 2) * 8 + 3) * s; xx < x2 - 3; xx += 16 * s) {
        ctx.moveTo(xx, y - row * 9 * s);
        ctx.lineTo(xx + 8 * s, y - row * 9 * s);
      }
    }
    ctx.stroke();
  }

  /** A round tower with a conical roof (or a flat crenellated top when `cap` is 'flat'). */
  function tower(ctx, x, y, s = 1, h = 54, r = 15, roof = 'slate', cap = 'cone', t = 0, realm = null) {
    const H = h * s;
    const Rr = r * s;
    ctx.fillStyle = STYLE.shadow;
    poly(ctx, [x + Rr, y, x + Rr + H * 0.35, y + H * 0.08, x + Rr + H * 0.3, y - H * 0.35, x + Rr * 0.6, y - H * 0.5]);
    ctx.fill();
    ellipse(ctx, x, y, Rr, Rr * 0.42);
    fill(ctx, PAL.stoneShade);
    ctx.beginPath();
    ctx.moveTo(x - Rr, y);
    ctx.lineTo(x - Rr, y - H);
    ctx.lineTo(x + Rr, y - H);
    ctx.lineTo(x + Rr, y);
    ctx.ellipse(x, y, Rr, Rr * 0.42, 0, 0, Math.PI);
    ctx.closePath();
    fillLine(ctx, PAL.stone);
    ctx.fillStyle = PAL.stoneShade;
    ctx.fillRect(x + Rr * 0.3, y - H, Rr * 0.7, H + Rr * 0.3);
    // A slit window.
    rrect(ctx, x - 1.6 * s, y - H * 0.6, 3.2 * s, 8 * s, 1.5 * s);
    fill(ctx, PAL.window);
    if (cap === 'flat') {
      ellipse(ctx, x, y - H, Rr * 1.1, Rr * 0.45);
      fillLine(ctx, PAL.stone);
      for (let i = -2; i <= 2; i++) {
        rrect(ctx, x + i * Rr * 0.42 - 3 * s, y - H - 5 * s + Math.abs(i) * 0.8 * s, 6 * s, 6 * s, 1 * s);
        fillLine(ctx, PAL.stone, STYLE.line * 0.8);
      }
    } else {
      const [rc, rs] = ROOFS[roof];
      poly(ctx, [x - Rr * 1.25, y - H + 2 * s, x, y - H - Rr * 2.4, x + Rr * 1.25, y - H + 2 * s]);
      fillLine(ctx, rc);
      poly(ctx, [x, y - H - Rr * 2.4, x + Rr * 1.25, y - H + 2 * s, x + Rr * 0.2, y - H + 2 * s]);
      fill(ctx, rs);
    }
    if (realm) banner(ctx, x, y - H - (cap === 'flat' ? 4 * s : Rr * 2.3), s * 0.8, realm, t, 18);
  }

  /** A covered wagon (the merchant's): two wheels, a bed and a cloth hood; `t` turns the wheels. */
  function wagon(ctx, x, y, s = 1, dir = 1, t = 0, hood = PAL.cloth) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    shadow(ctx, 2, 0, 22, 5, 10);
    rrect(ctx, -18, -15, 36, 9, 2);
    fillLine(ctx, PAL.wood);
    ctx.beginPath();
    ctx.moveTo(-17, -15);
    ctx.lineTo(-17, -26);
    ctx.quadraticCurveTo(-17, -36, -4, -36);
    ctx.lineTo(6, -36);
    ctx.quadraticCurveTo(17, -36, 17, -26);
    ctx.lineTo(17, -15);
    ctx.closePath();
    fillLine(ctx, hood);
    ctx.fillStyle = tone(hood, -0.12);
    ctx.fillRect(8, -33, 8, 18);
    ctx.strokeStyle = tone(hood, -0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const hx of [-9, 0, 9]) {
      ctx.moveTo(hx, -36);
      ctx.lineTo(hx, -15);
    }
    ctx.stroke();
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, -9);
    ctx.lineTo(30, -7);
    ctx.stroke();
    for (const wx of [-10, 10]) {
      ellipse(ctx, wx, -5, 6, 6);
      fillLine(ctx, PAL.woodShade);
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + (k * Math.PI) / 3;
        ctx.moveTo(wx - Math.cos(a) * 5, -5 - Math.sin(a) * 5);
        ctx.lineTo(wx + Math.cos(a) * 5, -5 + Math.sin(a) * 5);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A soft warm light (lamps, windows, the forge at night): the one place a gradient is used. */
  function glow(ctx, x, y, r, a, color = '255,196,120') {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** A small offscreen-canvas cache for repeated static drawings (trees and peaks on the map). */
  const caches = new Map();
  /**
   * Draw `paint(ctx)` (a drawing anchored at 0,0 inside a box of w×h around it, ox/oy from its
   * top-left to the anchor) once per pixel scale `k`, then reuse the image.
   */
  function cached(key, k, w, h, ox, oy, paint) {
    const id = `${key}@${k.toFixed(2)}`;
    let c = caches.get(id);
    if (!c) {
      c = root.document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * k));
      c.height = Math.max(1, Math.ceil(h * k));
      const cx = c.getContext('2d');
      cx.setTransform(k, 0, 0, k, ox * k, oy * k);
      paint(cx);
      caches.set(id, c);
      if (caches.size > 400) caches.delete(caches.keys().next().value); // oldest first
    }
    return c;
  }
  function dropCaches() {
    caches.clear();
  }

  CL.gfx = Object.assign(CL.gfx || {}, {
    PAL,
    STYLE,
    REALMS,
    WALLS,
    ROOFS,
    rng,
    hash,
    tone,
    ellipse,
    rrect,
    poly,
    fillLine,
    fill,
    shadow,
    tree,
    bush,
    rock,
    tuft,
    barrel,
    crate,
    fence,
    stoneWall,
    banner,
    device,
    well,
    stall,
    anvil,
    forge,
    rack,
    shieldShape,
    building,
    cityWall,
    tower,
    wagon,
    glow,
    cached,
    dropCaches,
    cacheSize: () => caches.size,
  });
})(typeof window !== 'undefined' ? window : globalThis);
