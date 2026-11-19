// Flow 3: an existing save loads into the right day, gold, soldiers and place; a damaged or
// incompatible save shows its notice (SC-31, SC-33) (W-00); a save from before the world grew is
// refused, kept safe and explained (W-05b, decision D-W2).
const { test, expect, open, game, press, fixtureCampaign, fixtureExpect } = require('./helpers');

const state = (page) =>
  game(page, (CL) => {
    const c = CL.campaign;
    return { name: c.character?.name, day: c.day, gold: c.gold, renown: c.renown, soldierIds: c.roster.map((s) => s.id), troops: c.roster.map((s) => s.troop), location: c.world.location, mode: CL.game.mode };
  });

// The campaign is loaded at boot (checked on the title screen); Continue then opens where the party
// stands: a settlement's menu when it stands on one, else the map (2.7: the first saves of the bigger world).
for (const [set, file, place] of [
  ['saves-2.7', 'campaign-day20.json', null],
  ['saves-2.7', 'story-played.json', 'greywall_fort'],
]) {
  test(`Continue loads the ${set} ${file} save into the right day, gold, soldiers and place`, async ({ page }) => {
    const expected = fixtureExpect(set, file);
    await open(page, { storage: { crownless_save: fixtureCampaign(set, file) } });
    const s = await state(page);
    expect(s.name).toBe(expected.name);
    expect(s.day).toBeCloseTo(expected.day, 2);
    expect(s.gold).toBe(expected.gold);
    expect(s.renown).toBe(expected.renown);
    expect(s.soldierIds).toEqual(expected.soldierIds);
    expect(s.troops).toEqual(expected.troops);
    expect(s.location).toBe(expected.location);
    await press(page, '#primaryBtn'); // Continue
    await page.waitForFunction(() => window.Crownless.game.mode !== 'title');
    const after = await state(page);
    expect(after.mode).toBe(place ? 'settlement' : 'map');
    expect(after.location).toBe(place);
    expect(after.gold).toBe(expected.gold);
    if (place) await expect(page.locator('#rosterSummary')).toBeVisible();
  });
}

test('a damaged latest save falls back to the backup and says so', async ({ page }) => {
  const good = fixtureCampaign('saves-2.7', 'campaign-day20.json');
  await open(page, { storage: { crownless_save: good.slice(0, 500), crownless_save_backup: good } });
  // The notice is the message line's text (shown for a few seconds, so read from the game's state).
  expect(await game(page, (CL) => CL.game.message)).toContain('could not be read, so the one before it was loaded');
  expect((await state(page)).gold).toBe(fixtureExpect('saves-2.7', 'campaign-day20.json').gold);
  await expect(page.locator('#primaryBtn')).toHaveText('Continue');
});

test('a save needing troops this build lacks (SC-33) is refused, kept safe, and says so', async ({ page }) => {
  const modded = JSON.parse(fixtureCampaign('saves-2.7', 'campaign-day20.json'));
  modded.roster[0].troop = 'griffin_rider';
  const text = JSON.stringify(modded);
  await open(page, { storage: { crownless_save: text } });
  expect(await game(page, (CL) => CL.game.message)).toContain('Your save could not be opened: it needs troops this version of the game does not have');
  await expect(page.locator('#primaryBtn')).toHaveText('New game');
  expect(await game(page, () => localStorage.getItem('crownless_save_incompatible'))).toBe(text);
});

test('a save from before the world grew is refused, kept safe, and the title says why', async ({ page }) => {
  const old = fixtureCampaign('saves-2.0', 'campaign-day20.json');
  await open(page, { storage: { crownless_save: old } });
  await expect(page.locator('#overlayText')).toContainText('The world has grown: new kingdoms lie beyond the March');
  await expect(page.locator('#overlayText')).toContainText('Your old save has been kept safe');
  await expect(page.locator('#primaryBtn')).toHaveText('New game');
  expect(await game(page, () => localStorage.getItem('crownless_save_other_world'))).toBe(old);
});
