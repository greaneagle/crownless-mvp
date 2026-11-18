// W-01: text size. At each of the four sizes, on the desktop and on the landscape phone (and at the
// largest size on four more realistic phone sizes), every key screen keeps its controls inside the
// viewport, clear of each other, at least 44×44 CSS px on touch, and with no label spilling out of
// its button; the battle controls stay clear of the Orders panel; canvas text uses the scaled font.
// Also: a size change applies at once and persists, and mid-battle it disturbs nothing.
const { test, expect, open, waitMode, game, press, pressAt, canvasToPage, newGame, toMap, debug, expectLayoutSound, isTouch } = require('./helpers');

const SIZES = { small: 0.9, normal: 1, large: 1.15, larger: 1.3 };
const TOP_RIGHT_MAP = ['#waitBtn', '#partyBtn', '#journalBtn', '#settingsBtn'];
const BATTLE_CONTROLS = ['#joystick', '#mapBtn', '#ordersBtn', '#blockBtn', '#attackBtn', '#pauseBtn', '#settingsBtn'];
// Realistic landscape phones besides 812×375 (W-01 layout rules), checked at the largest size.
const PHONES = [
  [667, 375],
  [740, 360],
  [844, 390],
  [915, 412],
];

/**
 * Every visible control in `root` (buttons, selects, text inputs, summaries): scrolled into view if
 * its panel scrolls, it must lie inside the viewport, be at least 44×44 on touch, and a button's
 * label must not spill out of it.
 */
async function controlsSound(page, root, label) {
  const problems = await page.evaluate(
    ({ root, touch }) => {
      const out = [];
      const sel = ['button', 'select', 'input:not([type=hidden]):not([type=checkbox]):not([type=file])', 'summary'].map((s) => `${root} ${s}`).join(',');
      for (const b of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(b);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !b.getClientRects().length) continue;
        b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = b.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const name = `${b.id ? `#${b.id} ` : ''}"${(b.textContent || b.value || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 32)}"`;
        const at = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} in ${innerWidth}×${innerHeight}`;
        if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`${name} outside the viewport (${at})`);
        if (touch && (r.width < 43.5 || r.height < 43.5)) out.push(`${name} under 44×44 (${at})`);
        if (b.tagName === 'BUTTON' && b.scrollWidth > b.clientWidth + 1) out.push(`${name} label spills out (${b.scrollWidth} > ${b.clientWidth})`);
      }
      return out;
    },
    { root, touch: isTouch(page) },
  );
  expect.soft(problems, `${label}: controls`).toEqual([]);
}

/** No part of the Orders panel lies over the joystick, Block or Attack. */
async function ordersClearOfControls(page) {
  const panel = await page.locator('#ordersPanel').boundingBox();
  for (const sel of ['#joystick', '#blockBtn', '#attackBtn']) {
    const b = await page.locator(sel).boundingBox();
    const w = Math.min(panel.x + panel.width, b.x + b.width) - Math.max(panel.x, b.x);
    const h = Math.min(panel.y + panel.height, b.y + b.height) - Math.max(panel.y, b.y);
    expect(w > 0.5 && h > 0.5, `the Orders panel covers ${sel}`).toBe(false);
  }
}

/** Record every canvas font set from now on. */
async function watchCanvasFonts(page) {
  await page.evaluate(() => {
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
    window.crownlessFonts = new Set();
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
      configurable: true,
      get() {
        return d.get.call(this);
      },
      set(v) {
        window.crownlessFonts.add(v);
        d.set.call(this, v);
      },
    });
  });
}

/** Every key screen, from the title to a battle's result, at the current size. */
async function walkScreens(page, size) {
  const at = (screen) => `${size} ${page.viewportSize().width}×${page.viewportSize().height}, ${screen}`;
  // Title.
  await expectLayoutSound(page, ['#primaryBtn', '#titleSavesBtn', '#titleHelpBtn', '#titleSettingsBtn']);
  await controlsSound(page, '#overlay', at('title'));
  // Settlement, with a company to show.
  await newGame(page);
  await debug(page, '[data-cheat="soldier"][data-n="5"]');
  await expectLayoutSound(page, ['#primaryBtn', '#secondaryBtn']);
  await controlsSound(page, '#overlay', at('settlement'));
  // Accounts and Journal.
  await press(page, '#accountsBtn');
  await waitMode(page, 'accounts');
  await controlsSound(page, '#overlay', at('accounts'));
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  await press(page, '#placeJournalBtn');
  await waitMode(page, 'journal');
  await controlsSound(page, '#overlay', at('journal'));
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  // Party: the soldier list, then a soldier's card.
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  await controlsSound(page, '#overlay', at('party'));
  await press(page, page.locator('.soldierRow').first());
  await expect(page.locator('.soldierCard')).toBeVisible();
  await controlsSound(page, '#overlay', at('soldier card'));
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  // The map: HUD buttons clear of the top-left panel and the message line; labels in the scaled font.
  await debug(page, '[data-cheat="clearParties"]');
  await watchCanvasFonts(page);
  await toMap(page);
  await press(page, '#waitBtn');
  await expectLayoutSound(page, TOP_RIGHT_MAP, { info: ['#topLeft', '#message'] });
  await press(page, '#waitBtn');
  const label = `bold ${Math.round(14 * SIZES[size])}px Georgia`;
  await page.waitForFunction((f) => window.crownlessFonts.has(f), label);
  if (size !== 'normal') expect(await page.evaluate(() => window.crownlessFonts.has('bold 14px Georgia')), 'no unscaled labels').toBe(false);
  // Settings.
  await press(page, '#settingsBtn');
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await controlsSound(page, '#settingsPanel', at('settings'));
  await press(page, '#doneSettings');
  // An encounter, Prepare, the battle with Orders open, and the result.
  const [cx, cy] = await game(page, (CL) => {
    const s = CL.world.map().sites.looter_camp;
    return CL.world.toPx(s.mapX, s.mapY);
  });
  const p = await canvasToPage(page, cx, cy);
  await pressAt(page, p.x, p.y);
  await waitMode(page, 'encounter', 30_000);
  await controlsSound(page, '#overlay', at('encounter'));
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await controlsSound(page, '#prepPanel', at('prepare'));
  await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  await expectLayoutSound(page, BATTLE_CONTROLS, { info: ['#topLeft'] });
  await press(page, '#ordersBtn');
  await expectLayoutSound(page, ['#joystick', '#blockBtn', '#attackBtn', '#pauseBtn', '#settingsBtn', '#closeOrders']);
  await controlsSound(page, '#ordersPanel', at('orders'));
  await ordersClearOfControls(page);
  await press(page, '#closeOrders');
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await controlsSound(page, '#overlay', at('result'));
}

for (const size of Object.keys(SIZES)) {
  test(`every key screen is sound at text size ${size}`, async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, { settings: { textSize: size } });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim())).toBe(String(SIZES[size]));
    await walkScreens(page, size);
  });
}

for (const [w, h] of PHONES) {
  test(`every key screen is sound at text size larger on a ${w}×${h} phone`, async ({ page }) => {
    test.skip(!isTouch(page), 'phone sizes');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await open(page, { settings: { textSize: 'larger' } });
    await walkScreens(page, 'larger');
  });
}

// Desktop browsers' own page zoom stays supported up to 150% (W-01): a 1280×720 window at 150% zoom
// has a CSS viewport of 853×480.
test('every key screen is sound with the desktop browser zoomed to 150%', async ({ page }) => {
  test.skip(isTouch(page), 'desktop page zoom');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 853, height: 480 });
  await open(page);
  await walkScreens(page, 'normal');
});

test('a text size chosen in Settings applies at once, without a reload, and is kept', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  const before = await page.locator('#topRight #waitBtn').boundingBox();
  await press(page, '#settingsBtn');
  await page.locator('#setTextSize').selectOption('larger');
  expect(await game(page, (CL) => CL.settings.get('textSize'))).toBe('larger');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim())).toBe('1.3');
  await press(page, '#doneSettings');
  const after = await page.locator('#topRight #waitBtn').boundingBox();
  expect(after.height).toBeGreaterThan(before.height); // the buttons grew with their text
  await expect(page.locator('#summary')).toContainText(' cr · '); // the HUD's short form
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('crownless_settings'))).textSize).toBe('larger');
  await page.reload();
  await page.waitForFunction(() => window.Crownless?.game?.mode);
  expect(await game(page, (CL) => CL.settings.get('textSize'))).toBe('larger');
});

test('changing the text size mid-battle disturbs nothing: the battle carries on as it was', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  const before = await game(page, (CL) => ({ allies: CL.game.allies.length, enemies: CL.game.enemies.length }));
  await press(page, '#settingsBtn');
  await page.locator('#setTextSize').selectOption('large');
  await press(page, '#doneSettings');
  expect(await game(page, (CL) => ({ mode: CL.game.mode, paused: CL.game.paused }))).toEqual({ mode: 'battle', paused: false });
  const t0 = await game(page, (CL) => CL.game.t);
  await page.waitForFunction((t) => window.Crownless.game.t > t + 0.2, t0);
  expect(await game(page, (CL) => ({ allies: CL.game.allies.length, enemies: CL.game.enemies.length }))).toEqual(before);
  await expect(page.locator('#summary')).toContainText('Allies'); // Large keeps the long form
});
