// P9-07: content packs in the browser. Import the sample pack in Settings (kept in IndexedDB), turn it
// on, reload, start a game and find its settlement on the map; a bad pack is refused with a precise
// message; a save begun with the pack, opened with it off, names the pack and is left as it was.
const path = require('node:path');
const { test, expect, open, waitMode, game, press, pressAt, settlementOnPage, newGame, toMap, debug } = require('./helpers');

const SAMPLE = path.join(__dirname, '..', '..', 'packs', 'sample', 'sample.json');

async function openSettings(page) {
  await press(page, '#titleSettingsBtn');
  await expect(page.locator('#settingsPanel')).toBeVisible();
}

test('P9-07: import the sample pack in Settings, turn it on, and its settlement is on the map', async ({ page }) => {
  test.setTimeout(120_000); // the ride from Stonebridge to the far west
  await open(page);
  await openSettings(page);
  await expect(page.locator('#packList')).toContainText('No packs yet');
  await page.locator('#packFile').setInputFiles(SAMPLE);
  await expect(page.locator('#packResult')).toContainText('sample.json is kept in this browser');
  const row = page.locator('#packList .packRow[data-pack="sample"]');
  await expect(row).toContainText('Highcairn (sample pack)');
  await expect(row).toContainText('off');
  await press(page, row.locator('input[type=checkbox]'));
  await expect(row).toContainText('on from the next new game or reload');
  // A reload applies it before the game reads its content.
  await page.reload();
  await page.waitForFunction(() => window.Crownless?.game?.mode === 'title' && document.querySelector('#primaryBtn')?.offsetParent !== null);
  expect(await game(page, (CL) => CL.packs.applied().map((p) => p.id))).toEqual(['sample']);
  await newGame(page);
  expect(await game(page, (CL) => CL.campaign.packs)).toEqual([{ id: 'sample', version: '1.0.0' }]);
  await debug(page, '[data-cheat="clearParties"]');
  await toMap(page);
  // Zoom out (while the button allows) until the new village is in view.
  const box = await page.locator('#game').boundingBox();
  const inView = (p) => p.x > box.x + 20 && p.x < box.x + box.width - 20 && p.y > box.y + 20 && p.y < box.y + box.height - 20;
  let at = await settlementOnPage(page, 'sample:highcairn');
  for (let i = 0; i < 4 && !inView(at) && (await page.locator('#zoomOutBtn').isEnabled()); i++) {
    await press(page, '#zoomOutBtn');
    at = await settlementOnPage(page, 'sample:highcairn');
  }
  expect(inView(at)).toBe(true);
  await pressAt(page, at.x, at.y);
  expect(await game(page, (CL) => CL.game.travel?.id)).toBe('sample:highcairn');
  await waitMode(page, 'settlement', 60_000);
  await expect(page.locator('#overlayTitle')).toHaveText('HIGHCAIRN');
  await expect(page.locator('#prep')).toContainText('Hire Cairn Herder');
});

test('P9-07: a bad pack is refused with a precise message, and a save that needs a pack names it', async ({ page }) => {
  await open(page);
  await openSettings(page);
  const bad = JSON.parse(require('node:fs').readFileSync(SAMPLE, 'utf8'));
  bad.troops['sample:cairn_spear'].upgradeTo = 'sample:nobody';
  await page.locator('#packFile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#packResult')).toContainText('Not imported:');
  await expect(page.locator('#packResult')).toContainText('bad.json › sample:cairn_spear: troop sample:cairn_spear: unknown upgrade sample:nobody');
  await expect(page.locator('#packList')).toContainText('No packs yet');
  // A save begun with the pack, in a game without it: the title says which pack, and the save is kept.
  const text = await game(page, (CL) => {
    CL.campaign.packs = [{ id: 'sample', version: '1.0.0' }];
    CL.save.write();
    return localStorage.getItem(CL.save.KEY);
  });
  await page.reload();
  await page.waitForFunction(() => window.Crownless?.game?.mode === 'title');
  await expect(page.locator('#overlayText')).toContainText('This save needs the pack sample (version 1.0.0)');
  expect(await game(page, (CL) => localStorage.getItem(CL.save.KEY))).toBe(text);
});
