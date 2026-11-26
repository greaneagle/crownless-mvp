// P11-07: a bow in the hero's hands, by real input at desktop and phone size: hold ATTACK to draw (the
// ring fills) and let go to loose at the target the game picks (the ring under them); run out of
// arrows and the other weapon comes to hand, with the words. The rules are in tests/archery.test.js.
const { test, expect, open, waitMode, game, hold, newGame, toMap, debug } = require('./helpers');

/** Test setup: a shortbow in hand and a sword carried second, in a practice battle with one looter close. */
async function toArchery(page) {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    c.inventory.short_bow = 1;
    CL.character.equip('short_bow', c);
    c.equipment.offhand = null;
    c.inventory.arming_sword = (c.inventory.arming_sword || 0) + 1;
    CL.character.equip('arming_sword', c, 'weapon2');
    c.inventory.worn_sword = 0;
  });
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await game(page, (CL) => {
    const g = CL.game;
    const h = g.hero;
    const e = g.enemies[0];
    for (const x of g.enemies) Object.assign(x, { aiTimer: 999, attackCooldown: 999 });
    Object.assign(e, { x: h.x + 150, y: h.y, face: 'left' });
    for (const x of g.enemies.slice(1)) Object.assign(x, { x: x.x + 2000 });
    h.face = 'right';
    g.godMode = true;
  });
}

test('hold ATTACK to draw a bow, let go to loose at the target the game picks', async ({ page }) => {
  await toArchery(page);
  expect(await game(page, (CL) => Boolean(CL.game.hero.ranged))).toBe(true);
  await expect(page.locator('#hptext')).toContainText(/Arrows \d+/);
  const before = await game(page, (CL) => CL.game.loadout.ammo.primary);
  await hold(page, '#attackBtn', async () => {
    await page.waitForFunction(() => {
      const h = window.Crownless.game.hero;
      return h.drawT >= h.ranged.draw;
    });
    expect(await game(page, (CL) => CL.game.aimTarget === CL.game.enemies[0])).toBe(true); // the ring is under them
  });
  await expect.poll(() => game(page, (CL) => CL.game.loadout.ammo.primary)).toBe(before - 1);
  await expect(page.locator('#hptext')).toContainText(`Arrows ${before - 1}`);
});

test('out of arrows: the sword comes to hand, and it is said', async ({ page }) => {
  await toArchery(page);
  await game(page, (CL) => {
    CL.game.loadout.ammo.primary = 0;
  });
  await hold(page, '#attackBtn', async () => {
    await expect(page.locator('#message')).toContainText('Out of arrows');
  });
  await expect.poll(() => game(page, (CL) => [CL.game.loadout.which, Boolean(CL.game.hero.ranged)])).toEqual(['secondary', false]);
});
