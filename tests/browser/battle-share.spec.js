// P9-B2: a band on the map met in battle: the Prepare screen says how the field is shared, and in the
// battle both sides' reserves step in as men fall, keeping their share (W-00's flow, desktop and phone).
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

test('60 against 40 at a battle size of 40: the share on the Prepare screen, then both reserves step in', async ({ page }) => {
  await open(page, { settings: { battleSize: 40, battleSizeChosen: true } });
  await newGame(page);
  await toMap(page);
  // Test setup: a company of 59 and a band of 40 beside it, nobody else near (the flow under test is
  // the encounter, Prepare and the battle, driven by the real buttons).
  await game(page, (CL) => {
    const c = CL.campaign;
    c.roster = [];
    const mix = ['footman', 'footman', 'hunter', 'levy', 'rider'];
    for (let i = 0; i < 59; i++) CL.save.addSoldier(c, mix[i % mix.length]);
    c.parties = c.parties.filter((p) => Math.hypot(p.x - c.world.x, p.y - c.world.y) > 40);
    const p = CL.parties.spawn(c, 'bandits');
    Object.assign(p, { troops: { reaver: 20, looter: 20 }, x: c.world.x, y: c.world.y });
    CL.parties.open(p.id);
  });
  await waitMode(page, 'encounter');
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await expect(page.locator('#prepShare')).toHaveText('You: 60, 24 on the field. Them: 40, 16. The rest step in as men fall.');
  await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  const at = () =>
    game(page, (CL) => {
      const g = CL.game;
      const up = (l) => l.filter((u) => u.alive && !u.routing).length;
      return { share: g.share, caps: [g.allyCap, g.enemyCap], allies: 1 + up(g.allies), enemies: up(g.enemies), reserve: [g.allyReserve.length, g.enemyReserve.length] };
    });
  const start = await at();
  expect(start).toEqual({ share: true, caps: [24, 16], allies: 24, enemies: 16, reserve: [36, 24] });
  // Test setup: six fall on each side at once; the next frames bring in each side's next.
  await game(page, (CL) => {
    const g = CL.game;
    for (const e of g.enemies.slice(0, 6)) e.alive = false;
    for (const a of g.allies.filter((x) => x.soldierId != null).slice(0, 6)) a.alive = false;
  });
  await expect.poll(async () => (await at()).reserve).toEqual([30, 18]);
  const after = await at();
  expect(after.allies).toBe(24);
  expect(after.enemies).toBe(16);
});
