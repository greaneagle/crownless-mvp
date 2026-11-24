// Flows 5 and 6: the settlement menu's buttons, and walking Stonebridge's streets to talk to someone by
// tapping them, by mouse on desktop and by touch on the phone (W-00).
const { test, expect, open, waitMode, game, press, pressAt, canvasToPage, newGame } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await open(page);
  await newGame(page);
});

test('recruit and buy food from the settlement menu', async ({ page }) => {
  const before = await game(page, (CL) => ({ gold: CL.campaign.gold, soldiers: CL.campaign.roster.length, food: CL.campaign.food }));
  const recruit = page.locator('#recruitA');
  await expect(recruit).toBeEnabled();
  await press(page, recruit);
  const hired = await game(page, (CL) => ({ gold: CL.campaign.gold, soldiers: CL.campaign.roster.length }));
  expect(hired.soldiers).toBe(before.soldiers + 1);
  expect(hired.gold).toBeLessThan(before.gold);
  await press(page, '#buyFoodA');
  const fed = await game(page, (CL) => ({ gold: CL.campaign.gold, food: CL.campaign.food }));
  expect(fed.food).toBeGreaterThan(before.food);
  expect(fed.gold).toBeLessThan(hired.gold);
  await expect(page.locator('#rosterSummary')).toBeVisible();
});

for (const [button, mode, panel] of [
  ['#contractsBtn', 'contracts', '#contractsScreen'],
  ['#accountsBtn', 'accounts', '#accountsScreen'],
  ['#tradeBtn', 'trade', '#tradeScreen'],
  ['#gearBtn', 'character', '#sheet'],
  ['#placeJournalBtn', 'journal', '#journalScreen'],
  ['#savesBtn', 'saves', '#savesScreen'],
]) {
  test(`${button} opens its screen and Back returns to the menu`, async ({ page }) => {
    await press(page, button);
    await waitMode(page, mode);
    await expect(page.locator(panel)).toBeVisible();
    await press(page, '#primaryBtn'); // Back
    await waitMode(page, 'settlement');
  });
}

test('Rest one day passes a day', async ({ page }) => {
  const day0 = await game(page, (CL) => CL.campaign.day);
  await press(page, '#restBtn');
  expect(await game(page, (CL) => CL.campaign.day)).toBeCloseTo(day0 + 1, 3);
});

test('Walk the streets, tap the elder to walk over and talk, then go back to the streets', async ({ page }) => {
  await press(page, page.locator('#secondaryBtn', { hasText: 'Walk the streets' }));
  await waitMode(page, 'town');
  // Someone with a conversation who stands still (pacing people move under the finger).
  const npc = await game(page, (CL) => {
    const n = CL.game.town.npcs.find((x) => x.dialogue && !x.pace);
    return { id: n.id, name: n.name, x: n.x, y: n.y - 16 };
  });
  const p = await canvasToPage(page, npc.x, npc.y);
  await pressAt(page, p.x, p.y);
  await waitMode(page, 'talk', 20_000);
  expect(await game(page, (CL) => CL.game.talk.npc.id)).toBe(npc.id);
  await expect(page.locator('#overlayTitle')).toHaveText(npc.name.toUpperCase());
  await expect(page.locator('#talkOptions button').first()).toBeVisible();
  // The last option of a conversation takes you back to the streets.
  await press(page, page.locator('#talkOptions button').last());
  await page.waitForFunction(() => ['town', 'talk'].includes(window.Crownless.game.mode));
});

test('Town menu returns from the streets to the settlement menu', async ({ page }) => {
  await press(page, page.locator('#secondaryBtn', { hasText: 'Walk the streets' }));
  await waitMode(page, 'town');
  await press(page, '#townMenuBtn');
  await waitMode(page, 'settlement');
});

// P10-03: every capital and free city has streets of its own. Two of them, by real taps: arrive,
// walk the streets, tap the innkeeper, talk, say goodbye, and leave by that town's own gate.
for (const id of ['hrothgard', 'gullhaven']) {
  test(`P10-03: walk ${id}'s streets, talk to the innkeeper, and leave by its gate`, async ({ page }) => {
    await game(page, (CL, sid) => {
      CL.campaign.world.location = sid;
      CL.town.enterPlace();
    }, id);
    await waitMode(page, 'settlement');
    await press(page, page.locator('#secondaryBtn', { hasText: 'Walk the streets' }));
    await waitMode(page, 'town');
    const inn = await game(page, (CL) => {
      const n = CL.game.town.npcs.find((x) => x.role === 'innkeeper');
      return { id: n.id, name: n.name, x: n.x, y: n.y - 16, hub: CL.game.town.hub.id };
    });
    expect(inn.hub).toBe(id);
    const p = await canvasToPage(page, inn.x, inn.y);
    await pressAt(page, p.x, p.y);
    await waitMode(page, 'talk', 20_000);
    expect(await game(page, (CL) => CL.game.talk.npc.id)).toBe(inn.id);
    await expect(page.locator('#overlayTitle')).toHaveText(inn.name.toUpperCase());
    await expect(page.locator('#talkOptions button', { hasText: 'Rest a day by the fire' })).toBeVisible();
    await press(page, page.locator('#talkOptions button', { hasText: 'Goodbye' }));
    await waitMode(page, 'town');
    // Back to where you came in, then through the gate.
    const way = await game(page, (CL) => {
      const h = CL.game.town.hub;
      return [h.spawn, { x: h.exitZone.x + h.exitZone.w / 2, y: h.exitZone.y + h.exitZone.h / 2 }];
    });
    for (const pt of way) {
      const q = await canvasToPage(page, pt.x, pt.y);
      await pressAt(page, q.x, q.y);
      await page.waitForFunction(() => window.Crownless.game.mode !== 'town' || !window.Crownless.game.town.walkTo, null, { timeout: 20_000 });
    }
    await waitMode(page, 'map', 20_000);
    expect(await game(page, (CL) => CL.campaign.world.location)).toBeNull();
  });
}
