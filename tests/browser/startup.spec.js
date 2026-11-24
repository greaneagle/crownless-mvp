// Flows 1 and 2: the page starts cleanly, and a new character can be made (W-00).
const { test, expect, open, waitMode, game, press, newGame, fixtureCampaign } = require('./helpers');

test('the page loads without errors and the title screen shows the version', async ({ page }) => {
  await open(page);
  const build = await game(page, (CL) => CL.BUILD);
  await expect(page.locator('#overlayTitle')).toHaveText('CROWNLESS');
  await expect(page.locator('#version')).toContainText(`v${build}`);
  // No save yet: New game is offered, not Continue.
  await expect(page.locator('#primaryBtn')).toHaveText('New game');
  await expect(page.locator('#secondaryBtn')).toBeHidden();
  await expect(page.locator('#titleExtras')).toBeVisible();
});

test('with a save in the browser, the title offers Continue (and New game behind a confirmation)', async ({ page }) => {
  await open(page, { storage: { crownless_save: fixtureCampaign('saves-4.2', 'campaign-day20.json') } });
  await expect(page.locator('#primaryBtn')).toHaveText('Continue');
  await expect(page.locator('#secondaryBtn')).toHaveText('New game');
  await press(page, '#secondaryBtn');
  await expect(page.locator('#secondaryBtn')).toHaveText('Erase save and start over?');
  expect(await game(page, (CL) => CL.game.mode)).toBe('title');
});

test('character creation: name, presentation, background and cloak, then the first settlement opens', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await expect(page.locator('#overlayTitle')).toHaveText('A NEW WANDERER');
  await page.locator('#heroName').fill('Ada Tester');
  await page.locator('#heroGender').selectOption('woman');
  const backgrounds = page.locator('#bgChoices button');
  await expect(backgrounds).toHaveCount(3);
  await press(page, backgrounds.nth(1)); // Scout
  const cloaks = page.locator('#cloakChoices button');
  expect(await cloaks.count()).toBeGreaterThan(1);
  await press(page, cloaks.nth(2));
  await press(page, '#primaryBtn'); // Begin
  await waitMode(page, 'settlement');
  const ch = await game(page, (CL) => ({ ...CL.campaign.character, place: CL.campaign.world.location, saved: Boolean(localStorage.getItem('crownless_save')) }));
  expect(ch.name).toBe('Ada Tester');
  expect(ch.gender).toBe('woman');
  expect(ch.background).toBe('scout');
  expect(ch.place).toBe('stonebridge');
  expect(ch.saved).toBe(true);
  await expect(page.locator('#overlayTitle')).toHaveText('STONEBRIDGE');
});

test('Back from character creation returns to the title without starting a game', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await press(page, '#secondaryBtn'); // Back
  await waitMode(page, 'title');
  expect(await game(page, () => localStorage.getItem('crownless_save'))).toBeNull();
});

test('the new-game helper reaches Stonebridge with the default Farmhand', async ({ page }) => {
  await open(page);
  await newGame(page);
  expect(await game(page, (CL) => [CL.campaign.character.background, CL.campaign.world.location])).toEqual(['farmhand', 'stonebridge']);
});

test('P10-02: one world: a new game asks no world, and the coast is on the map', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await expect(page.locator('#worldPick')).toBeHidden();
  expect(await game(page, (CL) => CL.worlds.installed().map((w) => w.id))).toEqual(['sundered_realm']);
  expect(await game(page, (CL) => ['gullhaven', 'harrowgate', 'calder'].map((id) => CL.content.get('settlements', id)?.name))).toEqual(['Gullhaven', 'Harrowgate', 'Calder']);
});
