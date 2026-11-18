// Flows 4 and 6: the strategic map with mouse clicks (desktop) and touch taps (phone): a tap on a
// settlement travels there and arrives, a tap on a party opens the encounter, Wait passes time (W-00).
const { test, expect, open, waitMode, game, press, pressAt, mapToPage, settlementOnPage, newGame, toMap, debug } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await open(page);
  await newGame(page);
  // An empty road: map travel advances with real frame time, so whether a roaming band catches the
  // party on the way varies from run to run. The band test spawns its own.
  await debug(page, '[data-cheat="clearParties"]');
  await toMap(page);
});

test('a tap on a settlement travels there, time passes, and its menu opens on arrival', async ({ page }) => {
  const day0 = await game(page, (CL) => CL.campaign.day);
  const oakford = await settlementOnPage(page, 'oakford');
  await pressAt(page, oakford.x, oakford.y);
  // One tap starts exactly one journey toward Oakford.
  expect(await game(page, (CL) => CL.game.travel && { type: CL.game.travel.type, id: CL.game.travel.id })).toEqual({ type: 'settlement', id: 'oakford' });
  await waitMode(page, 'settlement', 30_000);
  const s = await game(page, (CL) => ({ place: CL.campaign.world.location, day: CL.campaign.day }));
  expect(s.place).toBe('oakford');
  expect(s.day).toBeGreaterThan(day0);
  await expect(page.locator('#overlayTitle')).toHaveText('OAKFORD');
});

test('a tap on open ground walks there and halts with Space on desktop', async ({ page }) => {
  const start = await game(page, (CL) => ({ x: CL.campaign.world.x, y: CL.campaign.world.y }));
  const p = await mapToPage(page, start.x + 20, start.y);
  await pressAt(page, p.x, p.y);
  expect(await game(page, (CL) => CL.game.travel?.type)).toBe('point');
  await page.waitForFunction((x0) => window.Crownless.campaign.world.x > x0 + 1, start.x);
  if (!page.crownlessTouch) {
    await page.keyboard.press('Space');
    expect(await game(page, (CL) => CL.game.travel)).toBeNull();
  }
});

test('a tap on a band opens the encounter with its choices', async ({ page }) => {
  await debug(page, '[data-cheat="bandits"]');
  const target = await game(page, (CL) => {
    const p = CL.campaign.parties.find((q) => q.template === 'bandits' || CL.content.get('world_parties', q.template)?.kind === 'bandit');
    const d = CL.world.partyDrawPos(p);
    return { id: p.id, x: d.x, y: d.y };
  });
  const box = await page.locator('#game').boundingBox();
  await pressAt(page, box.x + (target.x * box.width) / 960, box.y + (target.y * box.height) / 540);
  await waitMode(page, 'encounter', 20_000);
  await expect(page.locator('#encounterOptions button', { hasText: 'Attack' }).first()).toBeVisible();
  await expect(page.locator('#encounterOptions button', { hasText: 'Auto-resolve' })).toBeVisible();
});

test('Wait passes time on the map until pressed again', async ({ page }) => {
  const day0 = await game(page, (CL) => CL.campaign.day);
  await press(page, '#waitBtn');
  expect(await game(page, (CL) => CL.game.waiting)).toBe(true);
  await page.waitForFunction((d) => window.Crownless.campaign.day > d + 0.05, day0);
  await press(page, '#waitBtn');
  expect(await game(page, (CL) => CL.game.waiting)).toBe(false);
});

test('Party and Journal open from the map and come back', async ({ page }) => {
  await press(page, '#partyBtn');
  await waitMode(page, 'character');
  await press(page, '#primaryBtn'); // Back
  await waitMode(page, 'map');
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await expect(page.locator('#journalScreen')).toBeVisible();
  await press(page, '#primaryBtn');
  await waitMode(page, 'map');
});
