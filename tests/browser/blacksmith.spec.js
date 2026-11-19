// P7-03: hiring a blacksmith, forging the hero's weapon and fitting a soldier with fine kit on the
// Accounts screen, by real input, at desktop and phone size. (The rules are checked in
// tests/blacksmith.test.js.)
const { test, expect, open, waitMode, game, press, newGame, debug } = require('./helpers');

test('Accounts: hire a blacksmith, forge the sword, fit a soldier with fine kit', async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="gold"][data-n="1000"]');
  await debug(page, '[data-cheat="cargo"]'); // +5 of each good: iron to work with
  await debug(page, '[data-cheat="soldier"][data-n="1"]');
  await press(page, '#accountsBtn');
  await waitMode(page, 'accounts');
  const screen = page.locator('#accountsScreen');
  await press(page, screen.locator('button', { hasText: 'Hire a blacksmith' }));
  const smith = await game(page, (CL) => CL.campaign.followers.blacksmith?.name);
  expect(smith).toBeTruthy();
  const card = screen.locator('.contractCard', { hasText: `Blacksmith ${smith}` });
  await expect(card).toContainText('Iron in your cargo: 5');
  const weapon = await game(page, (CL) => CL.campaign.equipment.weapon);
  await press(page, card.locator('button', { hasText: /^Forge · / }).first());
  expect(await game(page, (CL) => CL.campaign.equipment.weapon)).toBe(`${weapon}+1`);
  await expect(card).toContainText('+1 →');
  await press(page, card.locator('button', { hasText: /^Fine kit · / }).first());
  expect(await game(page, (CL) => CL.campaign.roster.filter((s) => s.kit).length)).toBe(1);
  await expect(card).toContainText('1 of 5');
  for (const b of await card.locator('button').all()) {
    await b.scrollIntoViewIfNeeded();
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(page.crownlessTouch ? 44 : 20);
  }
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
});
