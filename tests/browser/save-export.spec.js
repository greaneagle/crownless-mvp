// Flow 8: Save & export. Save now writes the browser's storage; Export is caught by Playwright's
// download API (nothing leaves the machine); Import works from a file and from pasted text; a damaged
// file is refused with its reason and the game is untouched; Restore brings back the game from before
// the import (W-00).
const fs = require('node:fs');
const { test, expect, open, waitMode, game, press, newGame, fixtureText, fixtureExpect } = require('./helpers');

const FIXTURE = ['saves-2.7', 'story-played.json']; // the first saves of the bigger world (W-05b)

async function openSaves(page) {
  await press(page, '#savesBtn');
  await waitMode(page, 'saves');
}

async function importFile(page, name, text) {
  const chooser = page.waitForEvent('filechooser');
  await press(page, '#importFileBtn');
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('Save now writes the game to the browser storage', async ({ page }) => {
  await open(page);
  await newGame(page, { name: 'Saver' });
  await press(page, '#restBtn'); // change something worth saving
  const day = await game(page, (CL) => CL.campaign.day);
  await openSaves(page);
  await page.evaluate(() => localStorage.removeItem('crownless_save'));
  await press(page, '#saveNowBtn');
  await expect(page.locator('#importResult')).toHaveText('Saved.');
  const saved = JSON.parse(await game(page, () => localStorage.getItem('crownless_save')));
  expect(saved.character.name).toBe('Saver');
  expect(saved.day).toBeCloseTo(day, 6);
});

test('Export downloads a save file of the current game', async ({ page }) => {
  await open(page);
  await newGame(page, { name: 'Exporter' });
  await openSaves(page);
  const download = page.waitForEvent('download');
  await press(page, '#exportBtn');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^crownless-exporter.*\.json$/);
  const data = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
  expect(data.format).toBe('crownless-save');
  expect(data.campaign.character.name).toBe('Exporter');
  expect(data.game).toBe(await game(page, (CL) => CL.BUILD));
  await expect(page.locator('#importResult')).toContainText('Save file exported');
});

test('Import from a file on the title screen loads that game', async ({ page }) => {
  const expected = fixtureExpect(...FIXTURE);
  await open(page);
  await press(page, '#titleSavesBtn');
  await waitMode(page, 'saves');
  await importFile(page, FIXTURE[1], fixtureText(...FIXTURE));
  await waitMode(page, 'settlement');
  const c = await game(page, (CL) => ({ name: CL.campaign.character.name, gold: CL.campaign.gold, place: CL.campaign.world.location }));
  expect(c).toEqual({ name: expected.name, gold: expected.gold, place: expected.location });
  expect(JSON.parse(await game(page, () => localStorage.getItem('crownless_save'))).character.name).toBe(expected.name);
});

test('Import from pasted text loads that game', async ({ page }) => {
  const expected = fixtureExpect(...FIXTURE);
  await open(page);
  await press(page, '#titleSavesBtn');
  await waitMode(page, 'saves');
  await press(page, '#pasteBox summary');
  await page.locator('#importText').fill(fixtureText(...FIXTURE));
  await press(page, '#importTextBtn');
  await waitMode(page, 'settlement');
  expect(await game(page, (CL) => CL.campaign.character.name)).toBe(expected.name);
});

test('a damaged file is refused with its reason and the current game is not changed', async ({ page }) => {
  await open(page);
  await newGame(page, { name: 'Keeper' });
  await openSaves(page);
  const before = await game(page, () => localStorage.getItem('crownless_save'));
  const damaged = fixtureText(...FIXTURE).replace('"gold": ', '"gold": 1');
  await importFile(page, 'damaged.json', damaged);
  await expect(page.locator('#importResult')).toContainText('Import failed:');
  await expect(page.locator('#importResult')).toContainText('Your current game was not changed.');
  expect(await game(page, (CL) => [CL.game.mode, CL.campaign.character.name])).toEqual(['saves', 'Keeper']);
  expect(await game(page, () => localStorage.getItem('crownless_save'))).toBe(before);
});

test('Restore brings back the game from before the last import', async ({ page }) => {
  await open(page);
  await newGame(page, { name: 'Original' });
  await openSaves(page);
  await expect(page.locator('#restoreBtn')).toBeHidden();
  await importFile(page, FIXTURE[1], fixtureText(...FIXTURE));
  await waitMode(page, 'settlement');
  expect(await game(page, (CL) => CL.campaign.character.name)).toBe(fixtureExpect(...FIXTURE).name);
  await openSaves(page);
  await expect(page.locator('#restoreBtn')).toBeVisible();
  await press(page, '#restoreBtn');
  await page.waitForFunction(() => window.Crownless.game.mode !== 'saves');
  expect(await game(page, (CL) => CL.campaign.character.name)).toBe('Original');
});
