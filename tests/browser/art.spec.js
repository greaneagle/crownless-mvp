// P10-G1 (D-P10k): the art kit in the game. The Sharpness setting sizes the canvas to the screen's
// real pixels (Fast keeps the classic 960×540), kept on the device; the Art gallery opens from the
// Debug panel, turns its pages, and closes with the save untouched.
const { test, expect, open, waitMode, game, press, pressAt, isTouch, newGame, toMap, debug } = require('./helpers');

const storage = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));

/** The canvas width Sharpness should give here: CSS width × pixels per CSS pixel (capped), never under 960. */
function expected(css, dpr, sharpness) {
  const cap = { sharp: 3, balanced: 2, fast: 0 }[sharpness];
  if (!cap) return 960;
  return Math.round(960 * Math.max(1, Math.round(((css * Math.min(dpr, cap)) / 960) * 100) / 100));
}

test('Sharpness sets the canvas to the screen’s pixels, and is kept on the device', async ({ page }) => {
  await open(page, { settings: { sharpness: undefined } }); // the device's own default, as a new player has
  await press(page, '#titleSettingsBtn');
  await expect(page.locator('#settingsPanel')).toBeVisible();
  const info = await page.evaluate(() => ({ css: document.querySelector('#game').getBoundingClientRect().width, dpr: devicePixelRatio }));
  const width = () => page.evaluate(() => document.querySelector('#game').width);
  expect(await page.locator('#setSharpness').inputValue()).toBe('balanced');
  expect(await width()).toBe(expected(info.css, info.dpr, 'balanced'));
  for (const s of ['sharp', 'fast', 'balanced', 'sharp']) {
    await page.locator('#setSharpness').selectOption(s);
    expect(await width()).toBe(expected(info.css, info.dpr, s));
    expect(await page.evaluate(() => document.querySelector('#game').style.imageRendering)).toBe(s === 'fast' ? 'pixelated' : 'auto');
  }
  await page.reload();
  await waitMode(page, 'title');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crownless_settings')).sharpness)).toBe('sharp');
  expect(await width()).toBe(expected(info.css, info.dpr, 'sharp'));
});

test('the map and a battle still draw at the new sharpness', async ({ page }) => {
  await open(page, { settings: { sharpness: 'balanced' } });
  await newGame(page);
  await toMap(page);
  const k = await game(page, (CL) => CL.render.backingScale());
  const info = await page.evaluate(() => ({ css: document.querySelector('#game').getBoundingClientRect().width, dpr: devicePixelRatio }));
  expect(Math.round(960 * k)).toBe(expected(info.css, info.dpr, 'balanced'));
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await page.waitForTimeout(500);
  const r = await game(page, (CL) => ({ errors: CL.diag.events.filter((e) => e.level === 'error').length, fps: CL.diag.fps }));
  expect(r.errors).toBe(0);
});

test('the Art gallery: every realm’s troops and more, page by page, and the save untouched after', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  const before = await storage(page);
  await debug(page, '[data-cheat="artGallery"]');
  await page.waitForFunction(() => window.Crownless.gfxDemo?.scene === 'gallery');
  const pages = await game(page, (CL) => CL.gfx.scenes.gallery.pages().map((p) => p.realm || p.kind));
  expect(pages).toEqual(['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'neutral', 'ostrand', 'saltreach', 'people', 'buildings', 'props']);
  // Next page: a tap on the bottom line (phone) or Tab (desktop).
  if (isTouch(page)) {
    const b = await page.locator('#gfxCanvas').boundingBox();
    await pressAt(page, b.x + b.width / 2, b.y + b.height * 0.97);
  } else await page.keyboard.press('Tab');
  expect(await game(page, (CL) => CL.gfxDemo.state.gallery.page)).toBe(1);
  expect(await game(page, (CL) => CL.diag.events.filter((e) => e.level === 'error').length)).toBe(0);
  await press(page, '#gfxExit');
  await page.waitForFunction(() => !window.Crownless.gfxDemo.active);
  await waitMode(page, 'map');
  expect(await storage(page)).toEqual(before);
});

test('a battle draws no sprite image: every soldier and obstacle is the art kit’s (P10-G2)', async ({ page }) => {
  await open(page, { settings: { sharpness: 'balanced' } });
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  const sprites = await page.evaluate(async () => {
    const seen = new Set();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
      if (img instanceof HTMLImageElement) seen.add(img.src.replace(location.origin, ''));
      return draw.call(this, img, ...rest);
    };
    await new Promise((r) => setTimeout(r, 1500));
    CanvasRenderingContext2D.prototype.drawImage = draw;
    return [...seen];
  });
  expect(sprites).toEqual([]);
  expect(await game(page, (CL) => CL.diag.events.filter((e) => e.level === 'error').length)).toBe(0);
});

test('a town’s streets draw no sprite image, and its people still talk (P10-G3)', async ({ page }) => {
  await open(page, { settings: { sharpness: 'balanced' } });
  await newGame(page);
  await press(page, page.locator('#secondaryBtn', { hasText: 'Walk the streets' }));
  await waitMode(page, 'town');
  const sprites = await page.evaluate(async () => {
    const seen = new Set();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
      if (img instanceof HTMLImageElement) seen.add(img.src.replace(location.origin, ''));
      return draw.call(this, img, ...rest);
    };
    await new Promise((r) => setTimeout(r, 1200));
    CanvasRenderingContext2D.prototype.drawImage = draw;
    return [...seen];
  });
  expect(sprites).toEqual([]);
  // Walk to the innkeeper and talk (the hero set beside them is setup; TALK is pressed for real).
  await game(page, (CL) => {
    const n = CL.game.town.npcs.find((x) => x.role === 'innkeeper');
    Object.assign(CL.game.town.hero, { x: n.x + 14, y: n.y });
  });
  await page.waitForFunction(() => window.Crownless.game.town?.near?.role === 'innkeeper');
  await press(page, '#attackBtn');
  await waitMode(page, 'talk');
});
