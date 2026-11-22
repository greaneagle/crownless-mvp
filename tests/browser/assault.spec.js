// P8-06b: the assault on the walls by real input at desktop and phone size: from your siege's card,
// Storm the walls starts the battle on the fort's wall (gate, ladders, courtyard), and its result feeds
// the siege. (The map, the way through, the ram and the result are in tests/assault.test.js.)
const { test, expect, open, waitMode, game, press, newGame, debug } = require('./helpers');

test('Assault: Storm the walls from your siege starts the battle on the wall; won, the fort is yours', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: a vassal of Valedorn, at war, three days into a siege of Castra Nova.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
    const s = CL.content.get('settlements', 'castra_nova');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'castra_nova' });
    const siege = CL.sieges.begin(c, 'castra_nova');
    Object.assign(siege, { began: c.day - 3.5, lastDay: Math.floor(c.day) });
    CL.town.enterPlace();
  });
  await waitMode(page, 'settlement');
  const storm = page.locator('#siegeStorm');
  await storm.scrollIntoViewIfNeeded();
  await expect(storm).toBeEnabled();
  await expect(page.locator('#siegeAssault')).toHaveText('Simulate');
  await press(page, storm);
  await waitMode(page, 'battle');
  const field = await game(page, (CL) => ({ wall: Boolean(CL.game.battleMap.wall), ladders: CL.game.siege.ladders, ram: CL.game.siege.ram, side: CL.game.siege.side, gaps: CL.game.battleMap.wall.gaps.length }));
  expect(field).toEqual({ wall: true, ladders: 3, ram: true, side: 'attack', gaps: 4 });
  // P9-B5: one army a side (no waves of 8), the garrison on this stretch of wall.
  const army = await game(page, (CL) => {
    const g = CL.game;
    const all = CL.fiefs.count(CL.realm.holding('castra_nova', CL.campaign).garrison);
    return { share: g.share, waves: g.totalWaves, theirs: g.enemies.length + g.enemyReserve.length, part: Math.ceil(all * CL.assault.RULES.garrisonShare.attack) };
  });
  expect(army).toEqual({ share: true, waves: 1, theirs: army.part, part: army.part });
  await expect(page.locator('#message')).toContainText('To the walls! 3 ladders up, and the ram for the gate.');
  // Test setup: the battle's end (the fight itself is the bots' and the parity script's).
  await game(page, (CL) => CL.debugTools.endBattleNow(true));
  await waitMode(page, 'result');
  await press(page, '#primaryBtn');
  expect(await game(page, (CL) => CL.realm.owner('castra_nova', CL.campaign))).toBe('valedorn');
});

test('Debug: Siege assault 100, by real taps, puts 50 a side at the wall as one army', async ({ page }) => {
  await open(page, { settings: { battleSize: 150, battleSizeChosen: true } });
  await newGame(page);
  await debug(page, '[data-cheat="assault"][data-n="100"]');
  await waitMode(page, 'battle');
  const now = await game(page, (CL) => ({ wall: Boolean(CL.game.battleMap.wall), allies: CL.game.allies.length, enemies: CL.game.enemies.length, waves: CL.game.totalWaves }));
  expect(now).toEqual({ wall: true, allies: 50, enemies: 50, waves: 1 });
});
