// P8-06a: sieges by real input at desktop and phone size: at an enemy fort, the Besiege card's preview
// and the siege that follows (Assault, Wait a day, Lift); your fort besieged is an urgent message with
// Ride back and Leave it. (The map's ring round a besieged fort is checked by eye; the rules are in
// tests/sieges.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

test('Sieges: at Castra Nova at war, the Besiege preview, then your siege’s choices; Lift ends it', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: a vassal of Valedorn at war with Aurelia, at the gates of Castra Nova.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
    const s = CL.content.get('settlements', 'castra_nova');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'castra_nova' });
    CL.town.enterPlace();
  });
  await waitMode(page, 'settlement');
  const card = page.locator('#siegeHere .siegeCard');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-siege', 'none');
  await expect(card.locator('h3')).toHaveText('Besiege Castra Nova');
  await expect(card).toContainText(/The garrison: 66 soldiers \(power [\d.]+\), ×1\.60 behind walls at 100%\./); // P9-B3: the world's garrisons, three times the data's
  await expect(card).toContainText('Starving it out: about 14 days, if no relief comes.');
  const vp = page.viewportSize();
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  await press(page, '#siegeBegin');
  await expect(page.locator('#siegeHere .siegeCard')).toHaveAttribute('data-siege', 'yours');
  await expect(page.locator('#siegeHere .siegeCard h3')).toHaveText('Your siege of Castra Nova · day 1');
  await expect(page.locator('#siegeAssault')).toBeDisabled(); // ladders by tomorrow
  await press(page, '#siegeWait');
  await expect(page.locator('#siegeHere .siegeCard h3')).toHaveText('Your siege of Castra Nova · day 2');
  await expect(page.locator('#siegeAssault')).toBeEnabled();
  await expect(page.locator('#siegeHere .siegeCard')).toContainText(/Storm it now: about \d+%\./);
  await press(page, '#siegeLift');
  await expect(page.locator('#siegeHere .siegeCard')).toHaveAttribute('data-siege', 'none');
  // Yours is over. (Valedorn and Aurelia are at war: during the day you waited, Aurelia's lords may
  // begin a siege of their own elsewhere, as the AI does.)
  expect(await game(page, (CL) => CL.campaign.sieges.filter((s) => s.by !== 'ai').length)).toBe(0);
});

test('Sieges: your fort besieged interrupts the map with Ride back or Leave it', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: you hold Castra Nova for Aurelia; Valedorn's lords encircle it.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'aurelian', since: c.day, window: { start: c.day, days: 10 } });
    CL.realm.transfer(c, 'castra_nova', { holder: 'player', willing: true });
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
    const fort = CL.content.get('settlements', 'castra_nova');
    for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn').slice(0, 3)) Object.assign(q, { x: fort.mapX + 2, y: fort.mapY + 2, troops: { guard: 18, footman: 15, hunter: 9 } }); // P9-B3: households in the world's scale
    for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn').slice(3)) Object.assign(q, { x: 10, y: 10 });
    CL.sieges.plan(c, 'valedorn');
    CL.party.advanceDays(0.5);
  });
  await waitMode(page, 'siegeAlarm');
  await expect(page.locator('#overlayTitle')).toHaveText('UNDER SIEGE');
  await expect(page.locator('#overlayText')).toContainText('Castra Nova is besieged by the Valedorn Crown.');
  await expect(page.locator('#alarm_ride')).toBeVisible();
  await expect(page.locator('#alarm_leave')).toContainText('Leave it to the steward');
  await press(page, '#alarm_leave');
  await waitMode(page, 'map');
  expect(await game(page, (CL) => CL.sieges.at(CL.campaign, 'castra_nova')?.phase)).toBe('encircled');
});

test('P9-05: summoned to an army, you ride to its banner from the Allegiance tab and ride with it', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign; // test setup: a vassal of Valedorn at war with Aurelia; its army gathers near you
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
    for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
    CL.lords.ensure(c, c.day, true);
    c.armyRest = { aurelian: 1e9 };
    const a = CL.armies.plan(c, 'valedorn');
    const q = CL.armies.lead(c, a);
    for (const p of CL.armies.parties(c, a)) Object.assign(p, { x: q.x, y: q.y, tx: null, ty: null });
    Object.assign(c.world, { x: q.x + 6, y: q.y, location: null });
  });
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="allegiance"]');
  const card = page.locator('#realmScreen .armyCard');
  await expect(card.locator('h3')).toHaveText('Summoned to the army');
  await expect(card).toContainText(/The Valedorn Crown's army under .+: \d+ lords, \d+ soldiers, gathering at /);
  const vp = page.viewportSize();
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  await press(page, card.locator('button', { hasText: 'Ride to its banner' }));
  await waitMode(page, 'map');
  await expect.poll(() => game(page, (CL) => CL.campaign.armyCall?.answered === true), { timeout: 20000 }).toBe(true);
  expect(await game(page, (CL) => CL.armies.riding(CL.campaign, CL.armies.byId(CL.campaign, CL.campaign.armyCall.army)))).toBe(true);
});
