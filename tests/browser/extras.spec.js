// P7-11: battle extras by real input at desktop and phone size: the formation buttons in the Orders
// panel (Loose · Wall · Wedge), the hill slopes and the wagon ambush from the Debug panel's practice
// battles. (The rules and the measurements are in tests/extras.test.js and tests/slow/battle-extras.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap, debug, expectLayoutSound } = require('./helpers');

test('Orders: the formation buttons set the infantry’s formation and show it; Hold closes a wall up', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="hills"][data-n="30"]');
  await waitMode(page, 'battle');
  await game(page, (CL) => (CL.game.paused = true)); // test setup: hold the battle still while the buttons are tried
  await press(page, '#ordersBtn');
  const panel = page.locator('#ordersPanel');
  await expect(panel).toBeVisible();
  const wall = panel.locator('[data-formation="wall"]');
  await wall.scrollIntoViewIfNeeded();
  await expect(panel.locator('[data-formation="loose"]')).toHaveClass(/active/);
  await expectLayoutSound(page, ['#ordersPanel [data-formation="loose"]', '#ordersPanel [data-formation="wall"]', '#ordersPanel [data-formation="wedge"]'], { scrolled: true });
  await press(page, wall);
  await expect(wall).toHaveClass(/active/);
  await expect(page.locator('#message')).toHaveText('Infantry: shield wall');
  expect(await game(page, (CL) => CL.game.formation)).toBe('wall');
  await press(page, panel.locator('[data-group="infantry"]'));
  await press(page, panel.locator('[data-order="hold"]'));
  const ys = await game(page, (CL) =>
    CL.game.allies
      .filter((a) => a.role === 'infantry' && a.alive && !a.companion)
      .map((a) => a.holdY)
      .sort((a, b) => a - b),
  );
  expect(ys.length).toBeGreaterThan(1);
  for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1] - 22) < 1e-6 || ys[i] - ys[i - 1] < 1e-6).toBe(true);
  await press(page, panel.locator('[data-formation="wedge"]'));
  await expect(page.locator('#message')).toHaveText('Infantry: wedge: it forms on Follow or Charge');
  await expect(panel.locator('[data-formation="wedge"]')).toHaveClass(/active/);
  await expect(wall).not.toHaveClass(/active/);
});

test('the wagon ambush: the wagon is on the field and in the HUD, and burns', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="wagon"][data-n="20"]');
  await waitMode(page, 'battle');
  await game(page, (CL) => (CL.game.paused = true));
  await expect(page.locator('#summary')).toContainText('Wagon 100%');
  expect(await game(page, (CL) => CL.game.enemies.filter((e) => e.raider).length)).toBeGreaterThan(0);
  // Test setup: a raider's blow that finishes it.
  await game(page, (CL) => CL.combat.hit(CL.game.wagon, 9999, CL.game.enemies[0]));
  await expect(page.locator('#summary')).toContainText('Wagon lost');
});
