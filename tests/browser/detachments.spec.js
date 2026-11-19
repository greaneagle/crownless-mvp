// P7-05: sending a patrol from the Detachments screen and calling it back, by real input, at desktop
// and phone size. (The rules are checked in tests/detachments.test.js.)
const { test, expect, open, waitMode, game, press, newGame, debug } = require('./helpers');

test('Detachments: choose a captain and soldiers, send them, send a courier after them', async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="gold"][data-n="1000"]');
  await debug(page, '[data-cheat="food"][data-n="10"]');
  // Test setup: a veteran guard (tier 3, 12 battles) and five others.
  const vet = await game(page, (CL) => {
    const c = CL.campaign;
    for (const t of ['guard', 'footman', 'footman', 'hunter', 'hunter', 'levy']) CL.save.addSoldier(c, t);
    const g = c.roster.find((s) => s.troop === 'guard');
    g.record.battles = 12;
    CL.ui.refreshRoster();
    return g.name;
  });
  await press(page, '#detachBtn');
  await waitMode(page, 'detachments');
  const screen = page.locator('#detachScreen');
  await press(page, screen.locator('button', { hasText: vet }).first());
  await press(page, screen.locator('button', { hasText: 'Half the company' }));
  await expect(screen).toContainText('Soldiers going (3)');
  await press(page, screen.locator('button', { hasText: 'Send them' }));
  const sent = await game(page, (CL) => ({ out: CL.detachments.active(CL.campaign).length, roster: CL.campaign.roster.length }));
  expect(sent).toEqual({ out: 1, roster: 3 });
  await expect(screen).toContainText(`${vet}’s patrol · out`);
  await press(page, screen.locator('button', { hasText: 'Send a courier' }));
  await expect(screen.locator('button', { hasText: 'Courier on the way' })).toBeDisabled();
  for (const b of await screen.locator('button').all()) {
    await b.scrollIntoViewIfNeeded();
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(page.crownlessTouch ? 44 : 20);
  }
  await press(page, '#primaryBtn'); // Back
  await waitMode(page, 'settlement');
});
