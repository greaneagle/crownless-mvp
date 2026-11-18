// Flow 7: a battle, from the encounter through Prepare and Fight to the result screen, and the battle
// controls driven by real input: joystick (phone) and WASD (desktop), Attack, Block, the Orders panel
// (group, order, Rally), the minimap, the MAP overview and Pause (W-00). Debug-panel battles are used
// only to get onto a large field quickly; every control under test is pressed for real.
const { test, expect, open, waitMode, game, press, pressAt, hold, touch, canvasToPage, newGame, toMap, debug } = require('./helpers');

/** From a new game: five soldiers, an empty road, the map, a tap on the Looter Camp, its encounter. */
async function toEncounter(page) {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="soldier"][data-n="5"]');
  // No roaming band on the road (travel advances with real frame time, so where parties meet varies):
  // the tap always reaches the camp's own fight.
  await debug(page, '[data-cheat="clearParties"]');
  await toMap(page);
  const [cx, cy] = await game(page, (CL) => {
    const s = CL.world.map().sites.looter_camp;
    return CL.world.toPx(s.mapX, s.mapY);
  });
  const p = await canvasToPage(page, cx, cy);
  await pressAt(page, p.x, p.y);
  await waitMode(page, 'encounter', 30_000);
}

/** A practice battle on a large forest field (Debug → Camera test 30): armies start apart. */
async function toFieldBattle(page) {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
}

const hero = (page) => game(page, (CL) => ({ x: CL.game.hero.x, y: CL.game.hero.y, alive: CL.game.hero.alive }));

test('Attack → Prepare → Fight starts the battle; it ends on a result screen and Continue returns to the map', async ({ page }) => {
  await toEncounter(page);
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await expect(page.locator('#prepPanel')).toBeVisible();
  await expect(page.locator('#prepPanel h2')).toHaveText('Prepare for battle');
  // Choose a preset, then fight.
  await press(page, page.locator('#prepPanel .prepPresets button', { hasText: 'Defensive' }));
  await expect(page.locator('#prepPanel .prepPresets button.active')).toHaveText('Defensive');
  await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  const b = await game(page, (CL) => ({ allies: CL.game.allies.length, enemies: CL.game.enemies.length, field: document.querySelector('#stage').dataset.field }));
  expect(b.allies).toBeGreaterThan(0);
  expect(b.enemies).toBeGreaterThan(0);
  await expect(page.locator('#attackBtn')).toBeVisible();
  // End it from the Debug panel (the result path is what is under test here).
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await expect(page.locator('#overlayTitle')).toHaveText('VICTORY');
  await expect(page.locator('#result')).toBeVisible();
  const battles = await game(page, (CL) => CL.campaign.battles);
  expect(battles).toBe(1);
  await press(page, page.locator('#primaryBtn', { hasText: 'Continue' }));
  await waitMode(page, 'map');
});

test('Simulate from the Prepare screen resolves the fight without a battle', async ({ page }) => {
  await toEncounter(page);
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await press(page, page.locator('#prepPanel button', { hasText: 'Simulate' }));
  await waitMode(page, 'result');
  expect(await game(page, (CL) => CL.campaign.battles)).toBe(1);
});

test('the hero moves with the joystick on the phone and with WASD on desktop', async ({ page }) => {
  await toFieldBattle(page);
  const start = await hero(page);
  if (page.crownlessTouch) {
    const joy = await page.locator('#joystick').boundingBox();
    const [cx, cy] = [joy.x + joy.width / 2, joy.y + joy.height / 2];
    const t = await touch(page);
    await t.down([{ id: 1, x: cx, y: cy }]);
    await t.move([{ id: 1, x: cx + joy.width * 0.4, y: cy }]);
    await page.waitForFunction((x0) => window.Crownless.game.hero.x > x0 + 20, start.x);
    expect(await game(page, (CL) => CL.game.joystick.x)).toBeGreaterThan(0.5);
    await t.up();
    await page.waitForFunction(() => window.Crownless.game.joystick.x === 0);
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForFunction((x0) => window.Crownless.game.hero.x > x0 + 20, start.x);
    await page.keyboard.up('KeyD');
    const right = await hero(page);
    await page.keyboard.down('KeyS');
    await page.waitForFunction((y0) => window.Crownless.game.hero.y > y0 + 20, right.y);
    await page.keyboard.up('KeyS');
  }
});

test('Attack swings the sword and a held Block raises the shield', async ({ page }) => {
  await toFieldBattle(page);
  // Count the hero's swings as they start. A swing lasts about half a second, and Playwright's clock
  // catches up in bursts on a busy machine, so a check for "swinging now" can miss it entirely.
  await page.evaluate(() => {
    const h = window.Crownless.game.hero;
    let swing = h.swing;
    window.crownlessSwings = 0;
    Object.defineProperty(h, 'swing', {
      configurable: true,
      get: () => swing,
      set: (v) => {
        if (v && !swing) window.crownlessSwings++;
        swing = v;
      },
    });
  });
  await press(page, '#attackBtn');
  await page.waitForFunction(() => window.crownlessSwings >= 1); // a press held over several busy frames may swing again
  await page.waitForFunction(() => !window.Crownless.game.hero.swing); // the swing runs its course
  await hold(page, '#blockBtn', async () => {
    await page.waitForFunction(() => window.Crownless.game.blockHeld && window.Crownless.game.hero.guard);
  });
  await page.waitForFunction(() => !window.Crownless.game.blockHeld);
});

test('the Orders panel picks a group, gives an order and rallies', async ({ page }) => {
  await toFieldBattle(page);
  await press(page, '#ordersBtn');
  await expect(page.locator('#ordersPanel')).toBeVisible();
  await press(page, page.locator('#ordersPanel [data-group="archer"]'));
  expect(await game(page, (CL) => CL.game.group)).toBe('archer');
  await expect(page.locator('#selectedGroup')).toContainText('Archers');
  await press(page, page.locator('#ordersPanel [data-order="hold"]'));
  expect(await game(page, (CL) => CL.game.orders.archer)).toBe('hold');
  await expect(page.locator('#ordersPanel [data-order="hold"]')).toHaveClass(/active/);
  await press(page, '#rallyBtn');
  expect(await game(page, (CL) => (CL.game.rallyReadyAt ?? 0) > CL.game.t)).toBe(true);
  await press(page, '#closeOrders');
  await expect(page.locator('#ordersPanel')).toBeHidden();
});

test('a tap on the minimap looks there, and MAP opens and closes the tactical overview', async ({ page }) => {
  await toFieldBattle(page);
  const r = await game(page, (CL) => CL.tactics.minimapRect(CL.game));
  const p = await canvasToPage(page, r.x + r.w * 0.9, r.y + r.h * 0.5);
  await pressAt(page, p.x, p.y);
  expect(await game(page, (CL) => Boolean(CL.game.cameraFocus))).toBe(true);
  await press(page, '#mapBtn');
  expect(await game(page, (CL) => Boolean(CL.game.overview))).toBe(true);
  // While the overview is open the battle is held still.
  const t0 = await game(page, (CL) => CL.game.t);
  await page.waitForTimeout(300); // let a few frames run to show that time does not move
  expect(await game(page, (CL) => CL.game.t)).toBe(t0);
  if (page.crownlessTouch) await press(page, '#mapBtn');
  else await page.keyboard.press('KeyM');
  expect(await game(page, (CL) => Boolean(CL.game.overview))).toBe(false);
});

test('Pause holds the battle and Resume carries on', async ({ page }) => {
  await toFieldBattle(page);
  await press(page, '#pauseBtn');
  expect(await game(page, (CL) => CL.game.paused)).toBe(true);
  await expect(page.locator('#pauseBtn')).toHaveText('Resume');
  const t0 = await game(page, (CL) => CL.game.t);
  await page.waitForTimeout(300); // a few frames: paused time stands still
  expect(await game(page, (CL) => CL.game.t)).toBe(t0);
  await press(page, '#pauseBtn');
  expect(await game(page, (CL) => CL.game.paused)).toBe(false);
  await page.waitForFunction((t) => window.Crownless.game.t > t, t0);
  expect((await hero(page)).alive).toBe(true);
});
