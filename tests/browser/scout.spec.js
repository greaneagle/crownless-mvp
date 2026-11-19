// P7-02: hiring a scout on the Accounts screen, and the scout's word as you set off and when a band is
// sighted, by real input, at desktop and phone size. (The rules are checked in tests/scout.test.js.)
const { test, expect, open, waitMode, game, press, pressAt, mapToPage, newGame, toMap, debug } = require('./helpers');

test('a scout estimates the ride and warns of a band', async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="gold"][data-n="1000"]');
  await debug(page, '[data-cheat="clearParties"]');
  await press(page, '#accountsBtn');
  await waitMode(page, 'accounts');
  await press(page, page.locator('#accountsScreen button', { hasText: 'Hire a scout' }));
  const scout = await game(page, (CL) => CL.campaign.followers.scout?.name);
  expect(scout).toBeTruthy();
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  await toMap(page);
  // Setting off for Eastwatch: the scout says how long.
  const ew = await game(page, (CL) => {
    CL.campaign.day = Math.floor(CL.campaign.day) + 0.3;
    const s = CL.content.get('settlements', 'eastwatch');
    return { x: s.mapX, y: s.mapY };
  });
  const p = await mapToPage(page, ew.x, ew.y);
  await pressAt(page, p.x, p.y);
  await expect(page.locator('#message')).toContainText(`Scout ${scout}: about`);
  await expect(page.locator('#message')).toContainText('to Eastwatch');
  // A band comes into sight (test setup): the scout warns.
  await game(page, (CL) => {
    const c = CL.campaign;
    const band = CL.parties.spawn(c, 'bandits');
    Object.assign(band, { x: c.world.x + 8, y: c.world.y, troops: { looter: 6 }, tx: null, ty: null, ignoreUntil: 1e9 });
  });
  await expect(page.locator('#message')).toContainText('about 6 Reavers to the east');
});
