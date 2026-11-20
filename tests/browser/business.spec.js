// P7-10: the mill, by real input at desktop and phone size (a touch tap on the phone): buy it at
// Oakford from the town screen, put crowns in, a week runs on payday on its own and its report is on the
// card, the Accounts screen shows it too, and selling needs a second tap. (The rules, the ledger over 90
// days, the owner's law and saves are in tests/business.test.js.)
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

test('Mill: buy it at Oakford, fund it, a week runs on its own, and sell it from the Accounts screen', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: the company in Oakford with crowns.
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'oakford');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'oakford' });
    c.gold = 700;
    CL.ui.refreshRoster();
  });
  const card = page.locator('#businessHere .mill');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-mill', 'forSale');
  await expect(card).toContainText('A mill for sale · 300 crowns');
  await expect(card.locator('.estimate')).toContainText(/^At today's prices the village miller would grind about \d+ sacks a week, for \+\d+ crowns/);
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await press(page, '#millBuy');
  await expect(card).toHaveAttribute('data-mill', 'owned');
  await expect(card).toContainText('Your mill at Oakford · its money 0 crowns');
  await press(page, '#millFund200');
  await expect(card).toContainText('its money 200 crowns');
  expect(await game(page, (CL) => CL.campaign.gold)).toBe(200);
  // Time passes to the next payday (test setup): the mill runs a week with no clicks.
  await game(page, (CL) => {
    const c = CL.campaign;
    CL.party.advanceDays(c.nextWagesDay - c.day + 0.01);
    CL.ui.refreshRoster();
  });
  await expect(card.locator('.millLog li').first()).toContainText(/^Day \d+: Ground \d+ grain into \d+ flour: sold for \d+, the grain cost \d+, wage 6, the lord's due \d+\. Week \+\d+ crowns\./);
  // The Accounts screen shows the same mill, and selling asks twice.
  await press(page, '#accountsBtn');
  await waitMode(page, 'accounts');
  const acct = page.locator('#accountsScreen .mill');
  await expect(acct).toContainText('Your mill at Oakford');
  const sell = acct.locator('#millSell');
  await sell.scrollIntoViewIfNeeded();
  await expect(sell).toHaveText('Sell · 180 crowns');
  await press(page, sell);
  await expect(sell).toContainText("It can't be undone. Tap again");
  const before = await game(page, (CL) => ({ gold: CL.campaign.gold, mill: CL.business.cash(CL.campaign) }));
  await press(page, sell);
  await expect(page.locator('#accountsScreen .mill')).toHaveCount(0);
  expect(await game(page, (CL) => ({ gold: CL.campaign.gold, owned: CL.campaign.businesses.owned.length, end: CL.campaign.businesses.past.at(-1).end }))).toEqual({ gold: before.gold + 180 + before.mill, owned: 0, end: 'sold' });
});

test('Mill: a Hostile owner’s warning is on the card', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'oakford');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'oakford' });
    c.gold = 700;
    CL.business.buy(c, 'oakford');
    CL.realm.adjust(c, 'valedorn', -60);
    CL.business.tick(c);
    CL.ui.refreshRoster();
  });
  const card = page.locator('#businessHere .mill');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.warn')).toHaveText(/^.+ will seize it on day \d+ unless you sell it or mend relations first\.$/);
  await expect(card.locator('#millFund')).toBeEnabled();
});
