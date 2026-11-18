// W-03: battle zoom, by real input on a large field (Debug → Camera test 30). A two-finger pinch on
// the field zooms and never attacks, moves the hero or taps the minimap; the joystick, Attack and
// Orders still work while zoomed; the zoom button, the mouse wheel and Z; the zoom is kept.
const { test, expect, open, waitMode, game, press, touch, isTouch, newGame, toMap, debug, expectLayoutSound } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
});

const zoom = (page) => game(page, (CL) => CL.camera.zoomOf(CL.game));

/** Count the hero's swings as they start (a swing is short; see battle.spec.js). */
async function countSwings(page) {
  await page.evaluate(() => {
    window.crownlessSwings = 0;
    const h = window.Crownless.game.hero;
    let swing = h.swing;
    Object.defineProperty(h, 'swing', {
      configurable: true,
      get: () => swing,
      set: (v) => {
        if (v && !swing) window.crownlessSwings++;
        swing = v;
      },
    });
  });
}

/** A field spot clear of the minimap, the HUD and the controls, in page coordinates. */
async function fieldSpot(page) {
  const b = await page.locator('#game').boundingBox();
  return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.45 };
}

test('the zoom button sits with the controls and toggles 1× and 0.75×; the zoom is kept for the next battle', async ({ page }) => {
  await expect(page.locator('#zoomBtn')).toHaveText('1×');
  await expectLayoutSound(page, ['#joystick', '#zoomBtn', '#mapBtn', '#ordersBtn', '#blockBtn', '#attackBtn', '#pauseBtn', '#settingsBtn'], { info: ['#topLeft'] });
  await press(page, '#zoomBtn');
  expect(await zoom(page)).toBe(0.75);
  await expect(page.locator('#zoomBtn')).toHaveText('0.75×');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('crownless_settings'))).battleZoom).toBe(0.75);
  await press(page, '#zoomBtn');
  expect(await zoom(page)).toBe(1);
  await press(page, '#zoomBtn');
  // A new battle starts at the kept zoom.
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await press(page, page.locator('#primaryBtn', { hasText: 'Continue' }));
  await waitMode(page, 'map');
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  expect(await zoom(page)).toBe(0.75);
});

test('a pinch on the field zooms, and never attacks, moves the hero or taps the minimap', async ({ page }) => {
  test.skip(!isTouch(page), 'touch pinch');
  await countSwings(page);
  const before = await game(page, (CL) => ({ x: CL.game.hero.x, y: CL.game.hero.y }));
  const c = await fieldSpot(page);
  const t = await touch(page);
  // Fingers closing: zoom out.
  await t.down([
    { id: 1, x: c.x - 150, y: c.y },
    { id: 2, x: c.x + 150, y: c.y },
  ]);
  for (let i = 1; i <= 6; i++) {
    await t.move([
      { id: 1, x: c.x - 150 + i * 14, y: c.y },
      { id: 2, x: c.x + 150 - i * 14, y: c.y },
    ]);
  }
  await t.lift([{ id: 1, x: c.x - 66, y: c.y }]); // one finger first: no tap from the other
  await t.up();
  expect(await zoom(page)).toBeLessThan(0.9);
  const after = await game(page, (CL) => ({ x: CL.game.hero.x, y: CL.game.hero.y, joy: { ...CL.game.joystick }, queued: CL.game.attackQueuedAt, held: CL.game.attackHeld, focus: CL.game.cameraFocus, overview: CL.game.overview }));
  expect(after.joy).toEqual({ x: 0, y: 0 });
  expect(after.held).toBe(false);
  expect(after.focus).toBeNull();
  expect(after.overview).toBe(false);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1); // the hero stood still
  expect(await page.evaluate(() => window.crownlessSwings)).toBe(0);
  // At the widest zoom, closing the fingers again opens the overview; spreading them goes back.
  const pinch = async (ids, from, to) => {
    await t.down([
      { id: ids[0], x: c.x - from, y: c.y },
      { id: ids[1], x: c.x + from, y: c.y },
    ]);
    for (let i = 1; i <= 6; i++) {
      const d = from + ((to - from) * i) / 6;
      await t.move([
        { id: ids[0], x: c.x - d, y: c.y },
        { id: ids[1], x: c.x + d, y: c.y },
      ]);
    }
    await t.up();
  };
  await pinch([5, 6], 150, 60);
  expect(await game(page, (CL) => CL.game.overview)).toBe(true);
  // (on the left half: the overview opens the Orders panel over the right of the field)
  const b = await page.locator('#game').boundingBox();
  const lx = b.x + b.width * 0.3;
  await t.down([
    { id: 8, x: lx - 30, y: c.y },
    { id: 9, x: lx + 30, y: c.y },
  ]);
  for (let i = 1; i <= 6; i++) {
    await t.move([
      { id: 8, x: lx - 30 - i * 11, y: c.y },
      { id: 9, x: lx + 30 + i * 11, y: c.y },
    ]);
  }
  await t.up();
  expect(await game(page, (CL) => CL.game.overview)).toBe(false);
  expect(await page.evaluate(() => window.crownlessSwings)).toBe(0);
  // Fingers spreading: zoom in.
  await t.down([
    { id: 3, x: c.x - 40, y: c.y },
    { id: 4, x: c.x + 40, y: c.y },
  ]);
  for (let i = 1; i <= 6; i++) {
    await t.move([
      { id: 3, x: c.x - 40 - i * 25, y: c.y },
      { id: 4, x: c.x + 40 + i * 25, y: c.y },
    ]);
  }
  await t.up();
  expect(await zoom(page)).toBeGreaterThan(1.2);
  expect(await page.evaluate(() => window.crownlessSwings)).toBe(0);
});

test('while zoomed out the joystick moves the hero, Attack swings and Orders opens', async ({ page }) => {
  await press(page, '#zoomBtn');
  expect(await zoom(page)).toBe(0.75);
  await countSwings(page);
  const start = await game(page, (CL) => CL.game.hero.x);
  if (isTouch(page)) {
    const joy = await page.locator('#joystick').boundingBox();
    const t = await touch(page);
    const [x, y] = [joy.x + joy.width / 2, joy.y + joy.height / 2];
    await t.down([{ id: 7, x, y }]);
    await t.move([{ id: 7, x: x + joy.width * 0.4, y }]);
    await page.waitForFunction((x0) => window.Crownless.game.hero.x > x0 + 10, start);
    await t.up();
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForFunction((x0) => window.Crownless.game.hero.x > x0 + 10, start);
    await page.keyboard.up('KeyD');
  }
  await press(page, '#attackBtn');
  await page.waitForFunction(() => window.crownlessSwings >= 1);
  await press(page, '#ordersBtn');
  await expect(page.locator('#ordersPanel')).toBeVisible();
  await press(page, '#closeOrders');
  expect(await zoom(page)).toBe(0.75);
});

test('a tap on the minimap still looks there when zoomed', async ({ page }) => {
  await press(page, '#zoomBtn');
  const r = await game(page, (CL) => CL.tactics.minimapRect(CL.game));
  const b = await page.locator('#game').boundingBox();
  const k = b.width / 960;
  const p = { x: b.x + (r.x + r.w * 0.8) * k, y: b.y + (r.y + r.h * 0.5) * k };
  if (isTouch(page)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => Boolean(window.Crownless.game.cameraFocus));
});

test('the mouse wheel zooms the field and Z toggles; a click still attacks', async ({ page }) => {
  test.skip(isTouch(page), 'mouse and keyboard');
  const c = await fieldSpot(page);
  await page.mouse.move(c.x, c.y);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200);
  await page.waitForFunction(() => window.Crownless.camera.zoomOf(window.Crownless.game) > 1.3);
  await page.keyboard.press('KeyZ');
  expect(await zoom(page)).toBe(0.75);
  await page.keyboard.press('KeyZ');
  expect(await zoom(page)).toBe(1);
  await countSwings(page);
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => window.crownlessSwings >= 1);
});
