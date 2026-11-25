// Shared setup for the browser specs (W-00). Every test starts from a known device: its own empty
// storage (a fresh browser context), fixed settings, a seeded Math.random and a fixed start time.
// Assertions read the game's state through window.Crownless; controls are driven by real input
// (mouse clicks on desktop, touch taps on the phone), never by calling the function under test.
const fs = require('node:fs');
const path = require('node:path');
const base = require('@playwright/test');

const { expect } = base;
const FIXTURES = path.join(__dirname, '..', 'fixtures');

/**
 * Device settings for tests: no tips over the controls, no full-screen request on touch, no sound.
 * P10-G1: the classic 960×540 canvas (Sharpness Fast). Headless Chromium draws in software, and a canvas
 * at the screen's real pixels, six workers at once, slowed frames enough to expire the map's 2.5 s
 * message before the layout checks reached it. `art.spec.js` tests Balanced and Sharp on purpose.
 */
const TEST_SETTINGS = { music: 0, sfx: 0, battleSize: 30, battleSizeChosen: true, battlefield: 'large', prepPreset: 'balanced', prepSkip: false, prepCustom: null, reducedEffects: false, healthBars: true, tips: false, fullscreen: false, mapSpeed: 'fast', sharpness: 'fast' }; // P10-01: Fast, as before 4.1.0's Normal default

/** A fixed moment for Date.now and timers (Playwright's clock), so dates and animations repeat. */
const START_TIME = new Date('2026-11-18T10:00:00Z');

/** An exported save file from tests/fixtures (the whole file text, as Import would read it). */
function fixtureText(set, file) {
  return fs.readFileSync(path.join(FIXTURES, set, file), 'utf8');
}

/** A fixture's campaign as the browser would hold it in localStorage (crownless_save). */
function fixtureCampaign(set, file) {
  return JSON.stringify(JSON.parse(fixtureText(set, file)).campaign);
}

/** What the build that wrote a fixture recorded about it (tests/fixtures/<set>/index.json). */
function fixtureExpect(set, file) {
  const index = JSON.parse(fs.readFileSync(path.join(FIXTURES, set, 'index.json'), 'utf8'));
  return index.find((f) => f.file === file).expect;
}

/**
 * Prepare a page before the game loads: storage contents, settings, a seeded Math.random.
 * `storage` is written once per test (a reload keeps what the game saved since).
 */
async function prepare(page, { storage = {}, settings = {}, seed = 1234 } = {}) {
  await page.clock.install({ time: START_TIME });
  await page.addInitScript(
    ({ storage, settings, seed }) => {
      // Mulberry32: the same small seeded generator the Node bots use.
      let a = seed >>> 0;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      if (!sessionStorage.getItem('crownless_test_ready')) {
        sessionStorage.setItem('crownless_test_ready', '1');
        localStorage.clear();
        localStorage.setItem('crownless_settings', JSON.stringify(settings));
        // Play as the published site does: the Logs and Debug buttons hidden (debug() shows them briefly).
        localStorage.setItem('crownless_dev', '0');
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      }
    },
    { storage, settings: { ...TEST_SETTINGS, ...settings }, seed },
  );
}

/** Load the game and wait for it to boot onto the title screen. */
async function open(page, options) {
  await prepare(page, options);
  await page.goto('/index.html');
  await page.waitForFunction(() => window.Crownless?.game?.mode === 'title' && document.querySelector('#primaryBtn')?.offsetParent !== null);
}

/** Wait until the game is in a mode (state, never a fixed sleep). */
async function waitMode(page, mode, timeout = 15_000) {
  await page.waitForFunction((m) => window.Crownless.game.mode === m, mode, { timeout });
}

/** Read something from the game: a function run in the page with window.Crownless as CL. */
function game(page, fn, arg) {
  return page.evaluate(({ src, arg }) => new Function('CL', 'arg', `return (${src})(CL, arg);`)(window.Crownless, arg), { src: fn.toString(), arg });
}

/** True on the phone project (touch input); set by the test fixture from the project's settings. */
const isTouch = (page) => Boolean(page.crownlessTouch);

/** Press a control the way this project's player would: a touch tap on the phone, a click on desktop. */
async function press(page, locator) {
  const l = typeof locator === 'string' ? page.locator(locator) : locator;
  if (isTouch(page)) await l.tap();
  else await l.click();
}

/** Tap or click a point given in page (CSS) coordinates. */
async function pressAt(page, x, y) {
  if (isTouch(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/**
 * Real touch input with any number of fingers, held and moved (Playwright's touchscreen only taps).
 * Sent through the Chrome DevTools Protocol, so the page sees genuine touch and pointer events.
 * Fingers are `{ id, x, y }` in page coordinates; W-02 uses two of them to pinch.
 *   const t = await touch(page); await t.down([{ id: 1, x, y }]); await t.move([...]); await t.up();
 */
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const points = (fingers) => fingers.map((f) => ({ x: f.x, y: f.y, id: f.id ?? 0, radiusX: 4, radiusY: 4, force: 1 }));
  return {
    down: (fingers) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(fingers) }),
    move: (fingers) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(fingers) }),
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    /** Lift some fingers and keep `staying` down (W-02: the end of a pinch). */
    lift: (staying) => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: points(staying) }),
    cancel: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
}

/**
 * Press and hold a control, run `during`, then release: a held mouse button on desktop, a held finger
 * on the phone.
 */
async function hold(page, locator, during) {
  const l = typeof locator === 'string' ? page.locator(locator) : locator;
  const b = await l.boundingBox();
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
  if (isTouch(page)) {
    const t = await touch(page);
    await t.down([{ id: 1, x, y }]);
    try {
      await during();
    } finally {
      await t.up();
    }
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await during();
    } finally {
      await page.mouse.up();
    }
  }
}

/** Page coordinates of a canvas pixel (the 960×540 backing store is stretched to the screen). */
async function canvasToPage(page, cx, cy) {
  const box = await page.locator('#game').boundingBox();
  return { x: box.x + (cx * box.width) / 960, y: box.y + (cy * box.height) / 540 };
}

/** Page coordinates of a point on the strategic map (map units), through the map camera (W-02). */
async function mapToPage(page, mx, my) {
  const [cx, cy] = await game(page, (CL, [x, y]) => CL.world.toScreen(x, y), [mx, my]);
  return canvasToPage(page, cx, cy);
}

/** Page coordinates of a settlement on the map. */
async function settlementOnPage(page, id) {
  const [mx, my] = await game(page, (CL, sid) => {
    const s = CL.content.get('settlements', sid);
    return [s.mapX, s.mapY];
  }, id);
  return mapToPage(page, mx, my);
}

/**
 * Start a new game through the title and creation screens, ending in the first settlement's menu.
 * P10-05: the bare start (Stonebridge, the common quest) unless `opening` plays the origin's quest.
 */
async function newGame(page, { name = 'Tester', origin = null, opening = false } = {}) {
  await press(page, '#primaryBtn'); // New game
  await waitMode(page, 'create');
  await page.locator('#heroName').fill(name);
  if (origin) await press(page, page.locator('#bgChoices button', { hasText: origin }));
  await game(page, (CL, plain) => (CL.game.plainStart = plain), !opening);
  await press(page, '#primaryBtn'); // Begin
  await waitMode(page, 'settlement');
}

/** Leave the settlement menu for the map. */
async function toMap(page) {
  await press(page, page.locator('#primaryBtn', { hasText: 'Leave' }));
  await waitMode(page, 'map');
}

/**
 * Open the Debug panel (shown on a local server) and press one of its buttons. Only for reaching a
 * situation quickly (a battle, money, soldiers); the thing under test is then driven by real input.
 */
async function debug(page, selector) {
  // The tests play with developer tools hidden, as players see the game; show the Debug button just
  // for this (test setup, not the thing under test), then hide it again.
  await page.evaluate(() => {
    document.querySelector('#stage').dataset.dev = 'on';
  });
  try {
    if (await page.locator('#cheatPanel').isHidden()) await press(page, '#cheatBtn');
    const b = page.locator(`#cheatPanel ${selector}`).first();
    await b.scrollIntoViewIfNeeded();
    await press(page, b);
    if (await page.locator('#cheatPanel').isVisible()) await press(page, '#closeCheats');
  } finally {
    await page.evaluate(() => {
      document.querySelector('#stage').dataset.dev = 'off';
    });
  }
}

/**
 * Drag from one page point to another the way this project's player would: a held mouse button on
 * desktop, one finger on the phone, moved in `steps` (W-02's map pan).
 */
async function drag(page, from, to, steps = 8) {
  const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (isTouch(page)) {
    const t = await touch(page);
    await t.down([{ id: 1, ...from }]);
    for (let i = 1; i <= steps; i++) await t.move([{ id: 1, ...at(i) }]);
    await t.up();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.mouse.up();
  }
}

/**
 * Key controls must be inside the viewport, must not overlap one another, and touch controls must be
 * at least 44×44 CSS px. A reusable check: W-01 runs it at every text size, W-02 on its new buttons.
 * `selectors` lists the controls expected to be visible on this screen; `info` lists things that are
 * read, not tapped (the HUD panel, the message line): inside the viewport and clear of the controls,
 * with no size rule. With `scrolled: true` the controls are in a panel that scrolls inside itself (the
 * settlement menu on a phone): each is scrolled into view and must then fit the viewport and the size
 * rule; overlap isn't compared, since they aren't on screen together.
 */
async function expectLayoutSound(page, selectors, { info = [], scrolled = false, minTouch = 44, touch = isTouch(page) } = {}) {
  const vp = page.viewportSize();
  const boxes = [];
  for (const sel of [...selectors, ...info]) {
    const control = selectors.includes(sel);
    const l = page.locator(sel);
    await expect(l, `${sel} is shown`).toBeVisible();
    if (scrolled) await l.scrollIntoViewIfNeeded();
    const b = await l.boundingBox();
    expect(b, `${sel} has a box`).not.toBeNull();
    const where = `${sel} at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)} in ${vp.width}×${vp.height}`;
    expect(b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= vp.width + 0.5 && b.y + b.height <= vp.height + 0.5, `${where}: inside the viewport`).toBe(true);
    if (touch && control) expect(b.width >= minTouch - 0.5 && b.height >= minTouch - 0.5, `${where}: at least ${minTouch}×${minTouch}`).toBe(true);
    boxes.push({ sel, b });
  }
  if (scrolled) return;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [p, q] = [boxes[i].b, boxes[j].b];
      const w = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x);
      const h = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
      expect(w > 0.5 && h > 0.5, `${boxes[i].sel} and ${boxes[j].sel} overlap`).toBe(false);
    }
  }
}

/**
 * The test fixture used by every spec: it collects uncaught page errors, console errors and the
 * game's own logged errors (a frame exception is caught and logged, not thrown), and fails the test
 * if there were any.
 */
const test = base.test.extend({
  page: async ({ page }, use, testInfo) => {
    page.crownlessTouch = Boolean(testInfo.project.use.hasTouch);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    page.allowedErrors = [];
    await use(page);
    const logged = await page
      .evaluate(() => (window.Crownless?.diag?.events || []).filter((e) => e.level === 'error').map((e) => `game: ${e.msg} ${JSON.stringify(e.data || {})}`))
      .catch(() => []);
    const all = [...errors, ...logged].filter((e) => !page.allowedErrors.some((re) => re.test(e)));
    expect(all, 'no errors in the page').toEqual([]);
  },
});

module.exports = {
  test,
  expect,
  TEST_SETTINGS,
  START_TIME,
  fixtureText,
  fixtureCampaign,
  fixtureExpect,
  prepare,
  open,
  waitMode,
  game,
  isTouch,
  press,
  pressAt,
  touch,
  hold,
  drag,
  canvasToPage,
  mapToPage,
  settlementOnPage,
  newGame,
  toMap,
  debug,
  expectLayoutSound,
};
