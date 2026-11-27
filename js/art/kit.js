/* Crownless art: the shared visual language (P10-G1, D-P10k). Everything the game shows is drawn in
 * code from this kit and js/art/figures.js: one palette, one outline, one light, one shadow, and the
 * drawing helpers every scene is built from (nature, props, buildings, banners and devices). There are
 * no image files. docs/ART-STYLE.md explains the rules and how to add a troop, a culture or a prop;
 * Debug → Art gallery shows every part.
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

  /** The palette. Change a value here and every scene follows. P11-12c (D-P11m): the approved concept's colours. */
  const PAL = {
    grass: '#96ad79',
    grassLight: '#a9bd85',
    grassDark: '#778e51',
    meadow: '#b3c985',
    field: '#d9c784',
    fieldGreen: '#a9bf72',
    forest: '#668c43',
    forestLight: '#88a552',
    forestDark: '#4b713f',
    pine: '#45704f',
    pineDark: '#355a40',
    trunk: '#6b5339',
    road: '#d9bf92',
    roadEdge: '#c4aa7e',
    cobble: '#d8c6a2',
    cobbleLine: '#b7a382',
    plaster: '#f0d9aa',
    plasterShade: '#cbb58a',
    stone: '#b8b0a0',
    stoneShade: '#918c80',
    stoneDark: '#79746a',
    timber: '#65472f',
    terracotta: '#bd7655',
    terracottaShade: '#985039',
    slate: '#75849a',
    slateShade: '#515d71',
    thatch: '#d5ad60',
    thatchShade: '#b38943',
    shingle: '#80644c',
    shingleShade: '#614938',
    door: '#875b37',
    window: '#4a5560',
    windowLit: '#f6cf73',
    water: '#76a9bb',
    waterDeep: '#518caa',
    waterLight: '#b4d4dc',
    sand: '#e2d2a0',
    bank: '#c7b98a',
    rock: '#a9a395',
    rockShade: '#8b8578',
    snow: '#f3efe4',
    mountain: '#a39a86',
    mountainShade: '#857c6b',
    steel: '#b6bfc8',
    steelShade: '#8592a0',
    wood: '#a77c49',
    woodShade: '#795231',
    cloth: '#f1e2c1',
    gold: '#e5bd67',
    crimson: '#b0453a',
    ink: '#49352a',
  };

  /** One outline, one light, one shadow for everything. */
  const STYLE = {
    outline: 'rgba(73,53,42,0.9)', // P11-12c: the concept's warm ink
    line: 1.4,
    shadow: 'rgba(42,60,30,0.2)',
    shadowDx: 0.32, // shadows lean to the lower right: dx per unit of height
    shadowDy: 0.12,
  };

  /**
   * Cultures (data/factions.js `culture`): the shapes their soldiers and towns are drawn with. Colour comes
   * from each realm's own `color`; the culture gives the device on banners and tabards, the usual shield,
   * and the town's materials (walls, roofs and roof forms, most common first).
   */
  const CULTURES = {
    valedorn: { device: 'chevron', shield: 'kite', walls: ['plaster', 'stone', 'whitewash'], roofs: ['terracotta', 'slate', 'thatch'], forms: ['end', 'gable', 'hip'] },
    aurelian: { device: 'bar', shield: 'heater', walls: ['whitewash', 'stone', 'plaster'], roofs: ['terracotta', 'terracotta', 'slate'], forms: ['hip', 'gable', 'end'] },
    hrothmark: { device: 'quarter', shield: 'round', walls: ['timber', 'timber', 'stone'], roofs: ['shingle', 'turf', 'shingle'], forms: ['long', 'gable', 'end'] },
    vessaro: { device: 'lozenge', shield: 'heater', walls: ['whitewash', 'plaster', 'stone'], roofs: ['terracotta', 'terracotta', 'thatch'], forms: ['hip', 'gable', 'hip'] },
    border: { device: 'coin', shield: 'round', walls: ['plaster', 'timber', 'stone'], roofs: ['thatch', 'shingle', 'terracotta'], forms: ['gable', 'end', 'long'] },
    ostrand: { device: 'wave', shield: 'kite', walls: ['stone', 'stone', 'whitewash'], roofs: ['slate', 'slate', 'turf'], forms: ['gable', 'long', 'end'] },
    saltreach: { device: 'cross', shield: 'heater', walls: ['whitewash', 'plaster', 'stone'], roofs: ['terracotta', 'slate', 'thatch'], forms: ['hip', 'end', 'gable'] },
  };

  /** Not realms, but sides with a look of their own. */
  const SIDES = {
    reavers: { color: '#5a3a32', trim: '#b0453a', dark: '#3e2622', device: 'slash', shield: 'round', culture: 'border' },
    merchant: { color: '#c08a3e', trim: '#f0e2bf', dark: '#946628', device: 'coin', shield: 'round', culture: 'border' },
  };

  const realmCache = new Map();
  /**
   * A side's colours and shapes: a realm id from data/factions.js (its colour, its culture's device and
   * shield), one of SIDES, or an object already in this shape (passed through). Memoised.
   */
  function realm(id) {
    if (id && typeof id === 'object') return id;
    let r = realmCache.get(id);
    if (r) return r;
    const f = CL.realm?.faction?.(id) || CL.content?.table?.('factions')?.[id] || null;
    if (SIDES[id]) r = SIDES[id];
    else if (f) {
      const c = CULTURES[f.culture] || CULTURES.border;
      r = { color: f.color, trim: f.id === 'neutral' ? '#b0453a' : '#ecdfbd', dark: tone(f.color, -0.25), device: f.id === 'neutral' ? 'slash' : c.device, shield: c.shield, culture: f.culture };
    } else r = { color: '#7a6e5a', trim: '#ecdfbd', dark: '#5a5040', device: 'coin', shield: 'round', culture: 'border' };
    realmCache.set(id, r);
    return r;
  }
  /** Old name kept for the scenes that use it: REALMS[x] is realm(x). */
  const REALMS = new Proxy({}, { get: (_, id) => realm(String(id)) });

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

  // ---- Props ----

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
  function banner(ctx, x, y, s, side, t = 0, h = 34) {
    const R = realm(side);
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
    if (R.edge) {
      // A lord's banner: a gold edge inside the outline (P10-G5).
      ctx.strokeStyle = R.edge;
      ctx.lineWidth = 1.1 * s;
      ctx.stroke();
    }
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
    } else if (R.device === 'bar') {
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.lineWidth = r * 0.7;
      ctx.stroke();
    } else if (R.device === 'cross') {
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    } else if (R.device === 'lozenge') {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.75, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.75, y);
      ctx.closePath();
      ctx.fill();
    } else if (R.device === 'pale') {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.lineWidth = r * 0.7;
      ctx.stroke();
    } else if (R.device === 'chief') {
      // A band across the top, and a roundel under it (P10-G5's house arms).
      ctx.fillRect(x - r * 1.2, y - r * 1.25, r * 2.4, r * 0.8);
      ctx.arc(x, y + r * 0.35, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (R.device === 'roundels') {
      for (const [dx, dy] of [[-0.5, -0.4], [0.5, -0.4], [0, 0.5]]) {
        ctx.moveTo(x + dx * r + r * 0.32, y + dy * r);
        ctx.arc(x + dx * r, y + dy * r, r * 0.32, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (R.device === 'wave') {
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x - r * 0.5, y - r * 0.7, x, y);
      ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.7, x + r, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
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
  function rack(ctx, x, y, s = 1, side = 'valedorn') {
    const R = realm(side);
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

  /** A shield's face: 'kite', 'round', 'heater' or 'pavise', in a side's colours with its device. */
  function shieldShape(ctx, x, y, r, shape, R, back = false) {
    ctx.beginPath();
    if (shape === 'kite') {
      ctx.moveTo(x - r * 0.85, y - r * 0.9);
      ctx.quadraticCurveTo(x, y - r * 1.25, x + r * 0.85, y - r * 0.9);
      ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.4, x, y + r * 1.45);
      ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.4, x - r * 0.85, y - r * 0.9);
    } else if (shape === 'pavise') {
      // The southern pavise: tall, near-rectangular, a raised ridge down the middle.
      ctx.roundRect(x - r * 0.95, y - r * 1.45, r * 1.9, r * 2.7, r * 0.3);
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
    if (shape === 'pavise') {
      ctx.fillStyle = R.trim;
      ctx.fillRect(x - r * 0.14, y - r * 1.5, r * 0.28, r * 2.8);
      device(ctx, x, y - r * 0.4, r * 0.6, R);
    } else device(ctx, x, y - r * 0.05, r * 0.55, R);
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
  function tower(ctx, x, y, s = 1, h = 54, r = 15, roof = 'slate', cap = 'cone', t = 0, side = null) {
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
    if (side) banner(ctx, x, y - H - (cap === 'flat' ? 4 * s : Rr * 2.3), s * 0.8, side, t, 18);
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
  const cacheCount = { hits: 0, misses: 0 }; // P11-00: for Debug → Battle benchmark
  /**
   * Draw `paint(ctx)` (a drawing anchored at 0,0 inside a box of w×h around it, ox/oy from its
   * top-left to the anchor) once per pixel scale `k`, then reuse the image.
   */
  function cached(key, k, w, h, ox, oy, paint, max = 400) {
    const id = `${key}@${k.toFixed(2)}`;
    let c = caches.get(id);
    if (c) {
      cacheCount.hits++;
      // Most recently used last, so the oldest is the one dropped when the cache is full.
      caches.delete(id);
      caches.set(id, c);
    } else {
      cacheCount.misses++;
      c = root.document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * k));
      c.height = Math.max(1, Math.ceil(h * k));
      const cx = c.getContext('2d');
      cx.setTransform(k, 0, 0, k, ox * k, oy * k);
      paint(cx);
      caches.set(id, c);
      while (caches.size > max) caches.delete(caches.keys().next().value); // the least recently used first
    }
    return c;
  }
  function dropCaches() {
    caches.clear();
  }
  /** P11-00: the bake cache's size and its hits and misses since the page loaded (or since `reset`). */
  function cacheStats(reset = false) {
    const out = { entries: caches.size, hits: cacheCount.hits, misses: cacheCount.misses };
    if (reset) Object.assign(cacheCount, { hits: 0, misses: 0 });
    return out;
  }

  // P11-12e: building, tree, bush, tuft, barrel, crate, well and stall are the storybook kit's (js/art/story.js).
  CL.gfx = Object.assign(CL.gfx || {}, {
    PAL,
    STYLE,
    CULTURES,
    SIDES,
    realm,
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
    rock,
    fence,
    stoneWall,
    banner,
    device,
    anvil,
    forge,
    rack,
    shieldShape,
    cityWall,
    tower,
    wagon,
    glow,
    cached,
    cacheStats,
    dropCaches,
    cacheSize: () => caches.size,
  });
})(typeof window !== 'undefined' ? window : globalThis);
