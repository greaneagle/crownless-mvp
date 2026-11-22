// P9-B4: command in layers by real input, at desktop and phone size: dividing the company, a captain and
// a formation on the Prepare screen; a timed order on the tactical map; a soldier's division on their card.
const { test, expect, open, waitMode, game, press, pressAt, newGame, toMap, canvasToPage } = require('./helpers');

/** Test setup: a company of 40 foot, 12 archers, 6 riders and a veteran guard, and a band of 50 beside it. */
async function toPrepare(page) {
  await open(page, { settings: { battleSize: 150, battleSizeChosen: true } }); // everyone on the field: every division in the battle
  await newGame(page);
  await toMap(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    c.roster = [];
    for (const [t, n] of Object.entries({ footman: 40, hunter: 12, rider: 6, guard: 1 })) for (let i = 0; i < n; i++) CL.save.addSoldier(c, t);
    c.roster.find((s) => s.troop === 'guard').record.battles = 12;
    c.parties = c.parties.filter((p) => Math.hypot(p.x - c.world.x, p.y - c.world.y) > 40);
    const p = CL.parties.spawn(c, 'bandits');
    Object.assign(p, { troops: { reaver: 30, looter: 20 }, x: c.world.x, y: c.world.y });
    CL.parties.open(p.id);
  });
  await waitMode(page, 'encounter');
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
}

test('Prepare: the divisions folded away; a captain, a formation and a troop type moved, then the battle has them', async ({ page }) => {
  await toPrepare(page);
  const box = page.locator('#prepPanel details.divisions');
  await expect(box.locator('summary')).toContainText('Divisions (4)');
  await box.locator('summary').scrollIntoViewIfNeeded();
  await press(page, box.locator('summary'));
  await expect(box.locator('.divRow').first()).toBeVisible();
  // The archers' captain: the veteran guard; their formation: a line.
  const archers = box.locator('.divRow', { hasText: 'Archers (12)' });
  const guard = await game(page, (CL) => CL.campaign.roster.find((s) => s.troop === 'guard'));
  await archers.locator('select.divCaptain').selectOption(`soldier:${guard.id}`);
  await page.locator('#prepPanel .divRow', { hasText: 'Archers (12)' }).locator('select.divFormation').selectOption('line');
  // The footmen all into the second foot division.
  await page.locator('#prepPanel select.divTroop').first().selectOption('infantry2');
  await expect(page.locator('#prepPanel details.divisions summary')).toContainText('Divisions (4)');
  expect(await game(page, (CL) => CL.campaign.divisions.troops.footman)).toBe('infantry2');
  await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  const now = await game(page, (CL) => {
    const g = CL.game;
    const D = CL.divisions;
    return { present: D.present(g), led: D.led(g, 'archer'), formation: CL.formations.chosenFor(g, 'archer'), foot: D.members(g, 'infantry2').filter((u) => u.troop === 'footman').length };
  });
  // The first foot division is empty: its footmen moved, its one guard leading the archers.
  expect(now.present).toEqual(['archer', 'cavalry', 'infantry2']);
  expect(now.led).toBe(true);
  expect(now.formation).toBe('line');
  expect(now.foot).toBeGreaterThan(30);
});

test('the tactical map: a division, an action and a time chosen by tapping; the order goes off when its time comes', async ({ page }) => {
  await toPrepare(page);
  await press(page, page.locator('#prepPanel button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  await press(page, '#mapBtn');
  await expect(page.locator('#ordersPanel')).toBeVisible();
  await expect(page.locator('#ordersPanel')).toHaveClass(/onMap/);
  await press(page, page.locator('#groupRow button', { hasText: 'Archers' }));
  await press(page, page.locator('[data-map-action="fallback"]'));
  const t5 = page.locator('[data-map-timing="5"]');
  await t5.scrollIntoViewIfNeeded();
  await press(page, t5);
  // A tap on the field behind the company (the overview's own picture of it).
  const spot = await game(page, (CL) => {
    const g = CL.game;
    const r = CL.tactics.overviewRect(g);
    const h = g.hero;
    return CL.tactics.toScreen(r, Math.max(g.battleMap.bounds.minX + 40, h.x - 250), h.y + 120);
  });
  const p = await canvasToPage(page, spot.x, spot.y);
  await pressAt(page, p.x, p.y);
  await expect(page.locator('#message')).toContainText('Archers: fall back, in 5 s');
  expect(await game(page, (CL) => CL.game.timed.map((t) => [t.div, t.kind]))).toEqual([['archer', 'fallback']]);
  // Back to the battle; five seconds later the archers go.
  await press(page, '#mapBtn');
  await game(page, (CL) => {
    for (let i = 0; i < 120; i++) CL.combat.update(0.05); // test setup: the battle's next six seconds at once
  });
  expect(await game(page, (CL) => [CL.game.timed.length, CL.game.orders.archer])).toEqual([0, 'hold']);
});

test('a soldier’s division, chosen on their card on the Party screen', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    for (let i = 0; i < 4; i++) CL.save.addSoldier(c, 'hunter');
    CL.ui.refreshRoster();
  });
  await toMap(page);
  await press(page, '#partyBtn');
  await waitMode(page, 'character');
  const row = page.locator('#sheetTroops .soldierRow').first();
  await row.scrollIntoViewIfNeeded();
  await press(page, row);
  const sel = page.locator('#sheetTroops select.soldierDivision');
  await sel.scrollIntoViewIfNeeded();
  await sel.selectOption('archer2');
  const id = await game(page, (CL) => CL.game.soldierProfile);
  expect(await game(page, (CL, sid) => CL.campaign.divisions.soldiers[sid], id)).toBe('archer2');
});
