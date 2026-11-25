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

test('character creation: name, presentation, origin and cloak, then the first settlement opens', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await expect(page.locator('#overlayTitle')).toHaveText('A NEW WANDERER');
  await page.locator('#heroName').fill('Ada Tester');
  await page.locator('#heroGender').selectOption('woman');
  const origins = page.locator('#bgChoices button');
  await expect(origins).toHaveCount(5); // P10-05: the traveller, the noble, the farmhand, the scout, the peddler
  await press(page, origins.nth(3)); // Scout: no opening quest yet (P10-06)
  const cloaks = page.locator('#cloakChoices button');
  expect(await cloaks.count()).toBeGreaterThan(1);
  await press(page, cloaks.nth(2));
  await press(page, '#primaryBtn'); // Begin
  await waitMode(page, 'settlement');
  const ch = await game(page, (CL) => ({ ...CL.campaign.character, place: CL.campaign.world.location, saved: Boolean(localStorage.getItem('crownless_save')) }));
  expect(ch.name).toBe('Ada Tester');
  expect(ch.gender).toBe('woman');
  expect(ch.origin).toBe('scout');
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
  expect(await game(page, (CL) => [CL.campaign.character.origin, CL.campaign.world.location])).toEqual(['farmhand', 'stonebridge']);
});

test('P10-02: one world: a new game asks no world, and the coast is on the map', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  await expect(page.locator('#worldPick')).toBeHidden();
  expect(await game(page, (CL) => CL.worlds.installed().map((w) => w.id))).toEqual(['sundered_realm']);
  expect(await game(page, (CL) => ['gullhaven', 'harrowgate', 'calder'].map((id) => CL.content.get('settlements', id)?.name))).toEqual(['Gullhaven', 'Harrowgate', 'Calder']);
});

test('P10-04: choose your kingdom: six realms on the new-game screen; Ostrand begins in Harrowgate, its story cast from there', async ({ page }) => {
  await open(page);
  await press(page, '#primaryBtn');
  await waitMode(page, 'create');
  const realms = page.locator('#realmChoices button');
  await expect(realms).toHaveCount(6);
  await expect(realms.nth(0)).toHaveAttribute('aria-checked', 'true'); // Valedorn, as before
  await press(page, realms.nth(4));
  await expect(realms.nth(4)).toHaveAttribute('aria-checked', 'true');
  await expect(realms.nth(4)).toContainText('from Harrowgate');
  await expect(page.locator('#realmNote')).toContainText('Kingdom of Ostrand');
  await game(page, (CL) => (CL.game.plainStart = true)); // the common quest at once (the origins have their own tests)
  await press(page, '#primaryBtn'); // Begin
  await waitMode(page, 'settlement');
  await expect(page.locator('#overlayTitle')).toHaveText('HARROWGATE');
  const s = await game(page, (CL) => ({ realm: CL.campaign.startRealm, at: CL.campaign.world.location, quest: CL.story.currentQuest()?.objective }));
  expect(s).toEqual({ realm: 'ostrand', at: 'harrowgate', quest: 'Find work: talk to Steward Liv in Harrowgate.' });
  await expect(page.locator('#peopleHere')).toContainText('Talk to Steward Liv');
  await expect(page.locator('#peopleHere')).toContainText('Talk to Marshal Hakon');
});

test('P10-07: with the guide on, a new game opens on its first step; Skip the guide clears it; off, nothing shows', async ({ page }) => {
  await open(page, { settings: { tips: true } });
  await newGame(page, { opening: true });
  await expect(page.locator('#tipCard')).toBeVisible();
  await expect(page.locator('#tipTitle')).toHaveText('Towns and villages · guide');
  await expect(page.locator('#tipSkip')).toBeVisible();
  await press(page, '#tipSkip');
  await expect(page.locator('#tipCard')).toBeHidden();
  expect(await game(page, (CL) => ['settlement', 'town', 'map', 'encounter'].map((m) => CL.tips.due(m)?.id || null))).toEqual([null, null, null, null]);
  // Off in Settings (the test default): a new game shows no card at all.
  await game(page, (CL) => {
    CL.settings.set('tips', false);
    CL.tips.reset();
  });
  expect(await game(page, (CL) => CL.tips.due('settlement'))).toBeNull();
});
