// W-05a: the river ford battle plays in the browser, at desktop and phone size (Debug → Ford battle 30):
// the river is drawn between the armies, the hero moves by real input and wades at half speed, the
// controls stay sound, and the battle ends on its result screen.
const { test, expect, open, waitMode, game, press, touch, isTouch, newGame, toMap, debug, expectLayoutSound } = require('./helpers');

/** Move the hero east for a while by real input (WASD on desktop, the joystick on the phone). */
async function walkEast(page, ms) {
  if (isTouch(page)) {
    const joy = await page.locator('#joystick').boundingBox();
    const t = await touch(page);
    const [x, y] = [joy.x + joy.width / 2, joy.y + joy.height / 2];
    await t.down([{ id: 3, x, y }]);
    await t.move([{ id: 3, x: x + joy.width * 0.45, y }]);
    await page.waitForTimeout(ms);
    await t.up();
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(ms);
    await page.keyboard.up('KeyD');
  }
}

/** Game seconds and hero x, read together. */
const where = (page) => game(page, (CL) => ({ x: CL.game.hero.x, t: CL.game.t }));

test('the ford battle: the river between the armies, wading at half speed, and a result', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="ford"][data-n="30"]');
  await waitMode(page, 'battle');
  const m = await game(page, (CL) => ({ id: CL.game.battleMap.id, river: CL.game.battleMap.slow[0], field: document.querySelector('#stage').dataset.field }));
  expect(m.id).toBe('river_ford');
  expect(m.field).toBe('large');
  await expectLayoutSound(page, ['#joystick', '#zoomBtn', '#mapBtn', '#ordersBtn', '#blockBtn', '#attackBtn', '#pauseBtn', '#settingsBtn'], { info: ['#topLeft'] });
  // The river is drawn: zoomed out, the canvas shows its water colour where the river is.
  await press(page, '#zoomBtn');
  const water = await game(page, (CL) => {
    const g = CL.game;
    const r = g.battleMap.slow[0];
    const s = CL.camera.toScreen(g, r.x + r.w / 2, g.hero.y);
    return { inView: s.x > 0 && s.x < CL.W, x: s.x, y: s.y };
  });
  if (water.inView) {
    await page.waitForFunction(({ x, y }) => {
      const c = document.querySelector('#game');
      const k = c.width / 960;
      const [r, , b] = c.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      return b > r && b > 100; // blue water, not grass
    }, water);
  }
  await press(page, '#zoomBtn');
  // Wading: put the hero on the bank (test setup), then walk east by real input on land and in water.
  await game(page, (CL) => {
    const g = CL.game;
    const r = g.battleMap.slow[0];
    Object.assign(g.hero, { x: r.x - 420, y: g.battleMap.height / 2 });
  });
  const a0 = await where(page);
  await walkEast(page, 600);
  const a1 = await where(page);
  const dry = (a1.x - a0.x) / (a1.t - a0.t);
  await game(page, (CL) => {
    const g = CL.game;
    const r = g.battleMap.slow[0];
    Object.assign(g.hero, { x: r.x + 20, y: g.battleMap.height / 2 });
  });
  const b0 = await where(page);
  await walkEast(page, 600);
  const b1 = await where(page);
  const wet = (b1.x - b0.x) / (b1.t - b0.t);
  expect(dry).toBeGreaterThan(50);
  expect(wet / dry).toBeGreaterThan(0.35);
  expect(wet / dry).toBeLessThan(0.65);
  // And it ends like any battle.
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await expect(page.locator('#result')).toContainText('Arena');
});
