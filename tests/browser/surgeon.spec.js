// P7-01: hiring a surgeon and buying medicine on the Accounts screen, by real input, at desktop and
// phone size. (Triage itself is checked in tests/surgeon.test.js.)
const { test, expect, open, waitMode, game, press, newGame, debug, expectLayoutSound } = require('./helpers');

test('Accounts: hire a surgeon in Stonebridge, buy medicine, and set the quartermaster to keep some', async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="gold"][data-n="1000"]');
  await press(page, '#accountsBtn');
  await waitMode(page, 'accounts');
  const screen = page.locator('#accountsScreen');
  await press(page, screen.locator('button', { hasText: 'Hire a surgeon' }));
  const doc = await game(page, (CL) => CL.campaign.followers.surgeon?.name);
  expect(doc).toBeTruthy();
  await expect(screen).toContainText(`Surgeon ${doc}`);
  await press(page, screen.locator('button', { hasText: /^Buy 5 · / }));
  expect(await game(page, (CL) => CL.campaign.medicine)).toBe(5);
  await expect(screen).toContainText('Medicine: 5');
  // The quartermaster's medicine rule, on the same screen.
  await press(page, screen.locator('button', { hasText: 'Hire a quartermaster' }));
  await expect(screen).toContainText('Keep 4 medicine while a surgeon rides with us');
  const rule = screen.locator('.qmRule', { hasText: 'medicine' });
  await press(page, rule.locator('button', { hasText: '+' }));
  expect(await game(page, (CL) => CL.campaign.followers.quartermaster.medicine)).toBe(5);
  // Every button on the screen fits and is big enough to tap (scrolled into view one at a time).
  for (const b of await screen.locator('.contractCard').filter({ hasText: 'Surgeon' }).locator('button').all()) {
    await b.scrollIntoViewIfNeeded();
    const box = await b.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(page.crownlessTouch ? 44 : 20);
    expect(box.height).toBeGreaterThanOrEqual(page.crownlessTouch ? 44 : 20);
  }
  await press(page, '#primaryBtn'); // Back
  await waitMode(page, 'settlement');
  await expectLayoutSound(page, ['#accountsBtn', '#restBtn']);
});
