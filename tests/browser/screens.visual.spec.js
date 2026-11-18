// Screenshots of the important screens at desktop and phone size (W-00, visual regression).
// Baselines come only from CI's Linux Chromium (decision D-T2): fonts and rendering differ between
// machines. These tests run on Linux (CI, or the Playwright Docker image through
// `npm run test:visual:docker`), or anywhere with CROWNLESS_VISUAL=1; a screen with no baseline yet
// is skipped with a note until baselines are made (README, "Browser tests").
const fs = require('node:fs');
const { test, expect, open, waitMode, press, pressAt, canvasToPage, game, newGame, toMap, debug } = require('./helpers');

test.describe('@visual key screens', () => {
  test.skip(process.platform !== 'linux' && !process.env.CROWNLESS_VISUAL, 'screenshot baselines are Linux Chromium only (D-T2)');

  /** Hold the game still (its clock and animation frames), then compare the whole page. */
  async function shot(page, name, testInfo, mask = []) {
    const baseline = testInfo.snapshotPath(`${name}.png`);
    const updating = ['all', 'changed'].includes(testInfo.config.updateSnapshots);
    test.skip(!updating && !fs.existsSync(baseline), `no baseline yet for ${name} (${testInfo.project.name}): make them with npm run test:visual:update`);
    // Pause a moment ahead of the page's clock (it keeps running meanwhile, so retry if that passed).
    for (let tries = 0; ; tries++) {
      const now = await page.evaluate(() => Date.now());
      try {
        await page.clock.pauseAt(now + 250);
        break;
      } catch (e) {
        if (tries >= 4 || !/to the past/.test(String(e))) throw e;
      }
    }
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false, mask: [page.locator('#message'), ...mask] });
  }

  test('title', async ({ page }, testInfo) => {
    await open(page);
    await shot(page, 'title', testInfo);
  });

  test('settlement menu', async ({ page }, testInfo) => {
    await open(page);
    await newGame(page);
    await shot(page, 'settlement', testInfo);
  });

  test('world map', async ({ page }, testInfo) => {
    await open(page);
    await newGame(page);
    await toMap(page);
    await shot(page, 'map', testInfo);
  });

  test('Party, Accounts and Journal', async ({ page }, testInfo) => {
    await open(page);
    await newGame(page);
    await press(page, '#gearBtn');
    await waitMode(page, 'character');
    await shot(page, 'party', testInfo);
    await press(page, '#primaryBtn');
    await waitMode(page, 'settlement');
    await page.clock.resume();
    await press(page, '#accountsBtn');
    await waitMode(page, 'accounts');
    await shot(page, 'accounts', testInfo);
    await page.clock.resume();
    await press(page, '#primaryBtn');
    await waitMode(page, 'settlement');
    await press(page, '#placeJournalBtn');
    await waitMode(page, 'journal');
    await shot(page, 'journal', testInfo);
  });

  test('Prepare, battle and result', async ({ page }, testInfo) => {
    await open(page);
    await newGame(page);
    await debug(page, '[data-cheat="soldier"][data-n="5"]');
    await debug(page, '[data-cheat="clearParties"]'); // no band on the road: always the camp's own fight
    await toMap(page);
    const [cx, cy] = await game(page, (CL) => {
      const s = CL.world.map().sites.looter_camp;
      return CL.world.toPx(s.mapX, s.mapY);
    });
    const p = await canvasToPage(page, cx, cy);
    await pressAt(page, p.x, p.y);
    await waitMode(page, 'encounter', 30_000);
    await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
    await waitMode(page, 'prepare');
    await shot(page, 'prepare', testInfo);
    await page.clock.resume();
    await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
    await waitMode(page, 'battle');
    await shot(page, 'battle', testInfo, [page.locator('#game')]); // the field moves; the HUD and controls are compared
    await page.clock.resume();
    await debug(page, '[data-cheat="win"]');
    await waitMode(page, 'result');
    await shot(page, 'result', testInfo, [page.locator('#result')]); // loot and names vary with the fight
  });
});
