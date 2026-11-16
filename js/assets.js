/* Crownless sprite loading. Files are assets/u####.png (units) and assets/w####.png (world). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const imgs = {};

  // Frame indices into the u#### unit sprite set.
  const heroFrames = {
    down: [0, 1, 2, 3],
    left: [16, 17, 18, 19],
    right: [32, 33, 34, 35],
    up: [48, 49, 50, 51],
  };
  const allyArt = { infantry: [72, 73, 74, 75], archer: [85, 86, 87, 88] };
  // Mounted troops have their own art: blue-tabard Valedorn riders, red Aurelian scouts.
  const troopArt = { rider: [204, 205, 206, 207], horse_scout: [210, 211, 212, 213] };
  const enemyArt = [92, 93, 94, 95, 120, 121, 122, 123, 200, 201, 202, 203];
  const worldTiles = [0, 1, 2, 3, 7, 12, 20, 34, 50, 61, 91, 110, 121, 132, 147, 167, 174];

  const key = (prefix, i) => prefix + String(i).padStart(4, '0');

  function loadImg(k) {
    const img = new Image();
    imgs[k] = img;
    CL.diag.assets.requested++;
    img.onload = () => {
      CL.diag.assets.loaded++;
    };
    img.onerror = () => {
      CL.diag.assets.failed.push(k);
      CL.diag.log('error', 'Sprite failed to load', { file: k });
    };
    img.src = `assets/${k}.png`;
  }

  function preload() {
    const used = new Set([
      ...Object.values(heroFrames).flat(),
      ...Object.values(allyArt).flat(),
      ...Object.values(troopArt).flat(),
      ...enemyArt,
      // Townsfolk in walkable town hubs.
      ...Object.values(CL.content?.table('town_hubs') || {}).flatMap((h) => h.npcs.flatMap((n) => n.frames)),
      ...Object.values(CL.content?.table('companions') || {}).flatMap((m) => m.frames),
    ]);
    for (const i of used) loadImg(key('u', i));
    for (const i of worldTiles) loadImg(key('w', i));
  }

  // ---- Hero cloak colours ----
  // The hero sprite's cloak is the only saturated red (hue ≥ 330° or ≤ 12°); hair and skin sit at
  // 15–30°. Recolouring just that band changes the cloak and leaves the rest of the sprite alone.
  const CLOAK_TINT = { crimson: null, forest: { hue: 125 }, violet: { hue: 278 }, ash: { grey: true } };
  const tintCache = new Map();

  function rgbToHsl(r, g, b) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  /** A hero frame with the chosen cloak colour, or null while the image is still loading. */
  function heroSprite(k, cloak) {
    const img = imgs[k];
    if (!img?.complete || !img.naturalWidth) return null;
    const tint = CLOAK_TINT[cloak];
    if (!tint) return img;
    const cacheKey = `${k}:${cloak}`;
    if (tintCache.has(cacheKey)) return tintCache.get(cacheKey);
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const x = cv.getContext('2d');
    x.drawImage(img, 0, 0);
    try {
      const data = x.getImageData(0, 0, cv.width, cv.height);
      const p = data.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 16) continue;
        const [h, s, l] = rgbToHsl(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255);
        if (s < 0.25 || !(h >= 330 || h <= 12)) continue;
        const [r, g, b] = tint.grey ? hslToRgb(0, s * 0.08, l * 0.95) : hslToRgb(tint.hue, s * 0.85, l);
        p[i] = r;
        p[i + 1] = g;
        p[i + 2] = b;
      }
      x.putImageData(data, 0, 0);
    } catch (e) {
      CL.diag.log('warn', 'Cloak tint unavailable', { error: String(e) });
      return img;
    }
    tintCache.set(cacheKey, cv);
    return cv;
  }

  CL.assets = { imgs, heroFrames, allyArt, troopArt, enemyArt, key, preload, heroSprite, CLOAK_TINT };
})(typeof window !== 'undefined' ? window : globalThis);
