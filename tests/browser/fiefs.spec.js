// P8-05: a grant of land and your fief, by real input at desktop and phone size: the grant message with
// Accept and Decline interrupts the map; the Realm screen's Fief tab shows the holding and changes a
// policy in place; the conqueror's choice offers its four answers. (The rules are in tests/fiefs.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

async function onScreen(page, sel) {
  const l = page.locator(sel);
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  const vp = page.viewportSize();
  expect(b.x >= -0.5 && b.x + b.width <= vp.width + 0.5 && b.y + b.height <= vp.height + 0.5).toBe(true);
  expect(b.height).toBeGreaterThanOrEqual(43.5);
}

test('Fiefs: a grant of Fernley comes as a message; Accept makes it yours, and the Fief tab shows it', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: a vassal of Valedorn whom the crown has chosen for Fernley.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
    CL.realm.transfer(c, 'fernley', { holder: c.rulers.valedorn, willing: true });
    c.grants.push({ sid: 'fernley', helper: 'player', day: c.day, declined: [], offeredTo: null });
    CL.fiefs.decideGrants(c);
  });
  await waitMode(page, 'grant');
  await expect(page.locator('#overlayTitle')).toHaveText('A GRANT OF LAND');
  await expect(page.locator('#overlayText')).toContainText('King Godric Ardane grants you Fernley (a village).');
  await expect(page.locator('#overlayText')).toContainText(/It pays about \d+ crowns a week in tax; the crown takes a tenth\./);
  await onScreen(page, '#grant_accept');
  await onScreen(page, '#grant_decline');
  await press(page, '#grant_accept');
  await waitMode(page, 'map');
  await expect(page.locator('#message')).toHaveText('You are granted Fernley.');
  expect(await game(page, (CL) => CL.realm.holderOf('fernley', CL.campaign))).toBe('player');
  // The Fief tab: Journal → The Realms → Fief.
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="fief"]');
  const card = page.locator('#realmScreen .fiefCard[data-fief="fernley"]');
  await expect(card.locator('h3')).toHaveText('Fernley · the reeve');
  await expect(card).toContainText(/Militia 6 · prosperity 50 · unrest 20 · treasury \d+ crowns/);
  await expect(card).toContainText('No week run yet: the first report comes on payday.');
  const tax = card.locator('button', { hasText: 'Tax:' });
  await expect(tax).toHaveText('Tax: normal');
  await press(page, tax);
  await expect(card.locator('button', { hasText: 'Tax:' })).toHaveText('Tax: heavy');
  expect(await game(page, (CL) => CL.campaign.holdings.fernley.policies.tax)).toBe('heavy');
  await expect(card.locator('button', { hasText: 'Put in 50' })).toBeDisabled(); // only at the holding
  await onScreen(page, '#realmScreen .fiefCard[data-fief="fernley"] button:has-text("Tax:")');
});

test('Fiefs: the conqueror’s choice offers ask, suggest, hand over and keep; asking is the first', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
    CL.realm.transfer(c, 'castra_nova', { controller: 'valedorn', sovereign: 'valedorn', by: 'player' });
    c.grants.length = 0;
    CL.ui.openConquest('castra_nova');
  });
  await waitMode(page, 'conquest');
  await expect(page.locator('#overlayTitle')).toHaveText('THE CONQUEROR’S CHOICE');
  const buttons = page.locator('#ransomOptions button');
  await expect(buttons).toHaveCount(4);
  await expect(buttons.first()).toContainText('Ask the liege for it');
  for (const id of ['#conquest_ask', '#conquest_suggest', '#conquest_hand', '#conquest_keep']) await onScreen(page, id);
  await press(page, '#conquest_ask');
  await waitMode(page, 'map');
  await expect(page.locator('#message')).toHaveText('You ask the crown for it.');
  expect(await game(page, (CL) => CL.campaign.grants.find((g) => g.sid === 'castra_nova')?.helper)).toBe('player');
});
