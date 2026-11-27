// P11-08: on horseback, by real input at desktop and phone size: a battle ridden (the hero on their
// horse, steering by the stick), Dismount from the Orders panel, and the walls' rule said before an
// assault. The rules are in tests/mounted.test.js.
const { test, expect, open, waitMode, game, press, newGame, toMap, debug } = require('./helpers');

/** Test setup: a rouncey and Riding 1. */
async function withHorse(page) {
  await game(page, (CL) => {
    const c = CL.campaign;
    c.inventory.rouncey = 1;
    CL.character.equip('rouncey', c);
    c.character.skills.riding = 1;
  });
}

test('ride a battle: the hero on their horse, steering; Dismount in Orders, and no getting back on', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withHorse(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => [CL.game.hero.mounted, CL.gfx.battle.lookOf(CL.game.hero).mount != null])).toEqual([true, true]);
  // Steer right for a moment: the horse gathers speed.
  const x0 = await game(page, (CL) => CL.game.hero.x);
  await game(page, (CL) => {
    CL.game.joystick = { x: 1, y: 0 };
  });
  await expect.poll(() => game(page, (CL) => CL.game.hero.momentum)).toBeGreaterThan(0.3);
  await game(page, (CL) => {
    CL.game.joystick = { x: 0, y: 0 };
  });
  expect(await game(page, (CL) => CL.game.hero.x)).toBeGreaterThan(x0);
  // Dismount from the Orders panel.
  await press(page, '#ordersBtn');
  await expect(page.locator('#dismountBtn')).toBeVisible();
  await press(page, '#dismountBtn');
  await expect(page.locator('#message')).toContainText('You dismount: you fight on foot');
  expect(await game(page, (CL) => CL.game.hero.mounted)).toBe(false);
  await expect(page.locator('#dismountBtn')).toBeHidden();
});

test('the walls: horses can’t go onto them, and it is said', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withHorse(page);
  await toMap(page);
  await debug(page, '[data-cheat="assault"][data-n="30"]');
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => CL.game.hero.mounted)).toBe(false);
  expect(await game(page, (CL) => CL.game.battleMap.mounts)).toBe(false);
});
