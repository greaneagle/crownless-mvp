// P7-08: a world event in a settlement, by real input at desktop and phone size: its card says what is
// going on and what happens if no one helps; taking part resolves it, and the Journal's chronicle tells
// it. (The rules, cooldowns and a 90-day bot run are in tests/happenings.test.js and tests/slow.)
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

test('World events: refugees at Oakford; feed them from the town screen, and it is in the chronicle', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: the company in Oakford with food to share, and refugees at the gate.
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'oakford');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'oakford' });
    c.food = 40;
    CL.happenings.start(c, 'refugees', 'oakford');
    CL.ui.refreshRoster();
  });
  const card = page.locator('#happeningsHere .happening[data-happening="refugees"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText(/^Refugees · \d+ days left/);
  await expect(card.locator('.ignored')).toHaveText('If no one helps, they move on and eat the town bare: grain costs more in Oakford.');
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await press(page, card.locator('button[data-choice="feed"]'));
  await expect(page.locator('#message')).toContainText('You share out 15 rations.');
  await expect(page.locator('#happeningsHere .happening')).toHaveCount(0);
  expect(await game(page, (CL) => ({ food: CL.campaign.food, result: CL.campaign.happenings.past.at(-1).result }))).toEqual({ food: 25, result: 'fed' });
  await press(page, '#placeJournalBtn');
  await waitMode(page, 'journal');
  await expect(page.locator('.chronicleCard')).toContainText('Fed the refugees at Oakford.');
});

test('World events: a choice that cannot be made says why on the button', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'stonebridge');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
    c.food = 2;
    CL.happenings.start(c, 'food_shortage', 'stonebridge');
    CL.ui.refreshRoster();
  });
  const card = page.locator('#happeningsHere .happening[data-happening="food_shortage"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('button[data-choice="sell"]')).toBeDisabled();
  await expect(card.locator('.why')).toHaveText('You need 20 rations (you have 2)');
});
