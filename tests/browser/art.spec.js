// P10-G1 (D-P10k): the art kit in the game. The Sharpness setting sizes the canvas to the screen's
// real pixels (Fast keeps the classic 960×540), kept on the device; the Art gallery opens from the
// Debug panel, turns its pages, and closes with the save untouched; from P10-G6 no screen asks for an image.
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

test('the Art gallery: every realm’s troops and more, page by page; it closes with the game and save as they were', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  const before = { storage: await storage(page), campaign: await game(page, (CL) => JSON.stringify(CL.campaign)) };
  await debug(page, '[data-cheat="artGallery"]');
  await page.waitForFunction(() => window.Crownless.artGallery?.active === true);
  await expect(page.locator('#galleryCanvas')).toBeVisible();
  const pages = await game(page, (CL) => CL.gfx.scenes.gallery.pages().map((p) => p.realm || p.kind));
  expect(pages).toEqual(['storybook', 'mounted', 'valedorn', 'aurelian', 'hrothmark', 'vessaro', 'neutral', 'ostrand', 'saltreach', 'people', 'arms', 'regional', 'buildings', 'props']);
  // Next page: a tap on the bottom line (phone) or Tab (desktop).
  if (isTouch(page)) {
    const b = await page.locator('#galleryCanvas').boundingBox();
    await pressAt(page, b.x + b.width / 2, b.y + b.height * 0.97);
  } else await page.keyboard.press('Tab');
  expect(await game(page, (CL) => CL.artGallery.state.gallery.page)).toBe(1);
  // While it is open nothing is saved, and the world stands still.
  expect(await game(page, (CL) => CL.save.write())).toBe(false);
  expect(await game(page, (CL) => CL.diag.events.filter((e) => e.level === 'error').length)).toBe(0);
  await press(page, '#galleryExit');
  await page.waitForFunction(() => !window.Crownless.artGallery.active);
  await waitMode(page, 'map');
  await expect(page.locator('#galleryCanvas')).toHaveCount(0);
  await expect(page.locator('#galleryUi')).toHaveCount(0);
  await expect(page.locator('#galleryCss')).toHaveCount(0);
  expect(await game(page, (CL) => ({ listeners: CL.artGallery.listenerCount(), stage: document.querySelector('#stage').dataset.gallery ?? null, campaign: JSON.stringify(CL.campaign) }))).toEqual({ listeners: 0, stage: null, campaign: before.campaign });
  expect(await storage(page)).toEqual(before.storage);
  // Opened again, it is loaded once, and the old graphics demo is gone.
  await debug(page, '[data-cheat="artGallery"]');
  await page.waitForFunction(() => window.Crownless.artGallery.active);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.Crownless.artGallery.active);
  expect(await game(page, (CL) => ({ entries: CL.artGallery.entries, viewer: [...document.scripts].filter((s) => s.src.includes('/js/gfx/viewer.js')).length, demo: typeof CL.gfxDemo, button: Boolean(document.querySelector('[data-cheat="gfxDemo"]')) }))).toEqual({ entries: 2, viewer: 1, demo: 'undefined', button: false });
});

test('P10-G6: no screen requests an image: the menus, the party sheet, the Realm, a town, talk, the map and a battle', async ({ page }) => {
  const asked = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || /\/icons\//.test(url)) return; // drawn pictures, and the home-screen icons
    if (r.resourceType() === 'image' || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) asked.push(url.replace(/^https?:\/\/[^/]+/, ''));
  });
  await open(page, { settings: { sharpness: 'balanced' } });
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await game(page, (CL) => (CL.game.plainStart = true));
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  await game(page, (CL) => CL.save.addSoldier(CL.campaign, 'levy'));
  for (const mode of ['character', 'journal', 'realm', 'trade']) {
    await game(page, (CL, m) => CL.ui.changeMode(m), mode);
    await page.waitForTimeout(150);
  }
  await game(page, (CL) => CL.ui.changeMode('settlement'));
  await press(page, page.locator('#secondaryBtn', { hasText: 'Walk the streets' }));
  await waitMode(page, 'town');
  await game(page, (CL) => CL.town.open(CL.game.town.npcs[0]));
  await waitMode(page, 'talk');
  await game(page, (CL) => {
    CL.town.leave();
  });
  await waitMode(page, 'map');
  await page.waitForTimeout(600);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await page.waitForTimeout(800);
  expect(asked).toEqual([]);
  expect(await game(page, (CL) => CL.diag.events.filter((e) => e.level === 'error').length)).toBe(0);
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

test('the world map draws no sprite image: terrain, places, parties and your company are the art kit’s (P10-G4)', async ({ page }) => {
  await open(page, { settings: { sharpness: 'balanced' } });
  await newGame(page);
  await toMap(page);
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
  expect(await game(page, (CL) => CL.diag.events.filter((e) => e.level === 'error').length)).toBe(0);
});

test('P11-04: the hero is drawn in what they carry: the sheet, a battle and a tournament bout, with no image asked for', async ({ page }) => {
  const asked = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || /\/icons\//.test(url)) return;
    if (r.resourceType() === 'image' || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) asked.push(url);
  });
  await open(page);
  await newGame(page);
  // Test setup: a known kit (the pieces need nothing of a new Farmhand).
  await game(page, (CL) => Object.assign(CL.campaign.equipment, { weapon: 'hand_axe', offhand: 'oak_shield', head: 'leather_cap', body: 'gambeson' }));
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  await expect(page.locator('#sheetStats .heroPortrait')).toHaveAttribute('data-sig', 'hand_axe|on|leather_cap|gambeson|none');
  // The sheet's gear rows have their icons, named in words.
  await expect(page.locator('#sheetEquip li', { hasText: 'Hand Axe' }).locator('.itemIco')).toHaveAttribute('aria-label', 'Axe');
  await expect(page.locator('#sheetEquip li', { hasText: 'Oak Shield' }).locator('.itemIco')).toHaveAttribute('aria-label', 'Round shield'); // P11-12d: the icon by the shield's look
  // Another kit, and the portrait follows.
  await game(page, (CL) => {
    Object.assign(CL.campaign.equipment, { head: null, body: 'clothing' });
    CL.ui.refresh();
  });
  await expect(page.locator('#sheetStats .heroPortrait')).toHaveAttribute('data-sig', 'hand_axe|on|none|clothing|none');
  // A battle: the look the battle draws.
  await game(page, (CL) => CL.ui.changeMode('settlement'));
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  const look = () => game(page, (CL) => {
    const L = CL.gfx.battle.lookOf(CL.game.hero);
    return [L.weapon, L.shield, L.helmet, L.armour];
  });
  expect(await look()).toEqual(['axe', 'wood', null, null]);
  await page.waitForTimeout(400);
  expect(asked).toEqual([]);
});

test('P11-04: in a tournament bout the hero is drawn in the loaner kit, not their own', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'stonebridge');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
    Object.assign(c.equipment, { weapon: 'hand_axe', head: null, body: 'clothing' });
    c.gold = 300;
    c.tourney.hosts.stonebridge.next = c.day;
    CL.tourney.tick(c);
    CL.ui.refreshRoster();
  });
  await page.locator('#tourneyHere .tourney').scrollIntoViewIfNeeded();
  await press(page, '#tourneyEnter');
  await press(page, '#tourneyFight');
  await waitMode(page, 'battle');
  const looks = await game(page, (CL) => [CL.game.hero, CL.game.enemies[0]].map((u) => {
    const L = CL.gfx.battle.lookOf(u);
    return [L.weapon, L.shield, L.helmet, L.armour];
  }));
  expect(looks).toEqual([['sword', 'kite', 'plumed', 'gambeson'], ['sword', 'kite', 'plumed', 'gambeson']]);
});
