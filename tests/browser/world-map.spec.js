// Flows 4 and 6: the strategic map with mouse clicks (desktop) and touch taps (phone): a tap on a
// settlement travels there and arrives, a tap on a party opens the encounter, Wait passes time (W-00);
// P10-01: the speed button and the Wait screen.
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

test('the speed button switches the map between Normal and Fast, and Settings shows it', async ({ page }) => {
  // The test settings run the map Fast (as before 4.1.0); a new device starts at Normal.
  await expect(page.locator('#speedBtn')).toHaveText('▶▶');
  await press(page, '#speedBtn');
  expect(await game(page, (CL) => [CL.settings.get('mapSpeed'), CL.world.rate()])).toEqual(['normal', 1]);
  await expect(page.locator('#speedBtn')).toHaveText('▶');
  await expect(page.locator('#message')).toHaveText('Map speed: Normal, an hour a second.');
  await press(page, '#settingsBtn');
  await expect(page.locator('#setMapSpeed')).toHaveValue('normal');
  await page.locator('#setMapSpeed').selectOption('fast');
  await press(page, '#doneSettings');
  await expect(page.locator('#speedBtn')).toHaveText('▶▶');
  expect(await game(page, (CL) => CL.world.rate())).toBe(4);
});

test('the Wait screen: choose a day, the screen darkens, the day passes, it says so', async ({ page }) => {
  const day0 = await game(page, (CL) => CL.campaign.day);
  await press(page, '#waitBtn');
  await waitMode(page, 'wait');
  await press(page, '#waitScreen [data-wait="24"]');
  await expect(page.locator('#waitDays')).toHaveText('1');
  await expect(page.locator('#waitHours')).toHaveText('0');
  await press(page, '#waitHoursUp');
  await expect(page.locator('#primaryBtn')).toHaveText('Wait 1 day and 1 hour');
  await press(page, '#primaryBtn');
  await waitMode(page, 'map');
  await expect(page.locator('#fade')).toBeVisible();
  await page.waitForFunction(() => !window.Crownless.game.waitPlan, null, { timeout: 15_000 });
  await expect(page.locator('#fade')).toBeHidden();
  expect(await game(page, (CL) => CL.campaign.day)).toBeCloseTo(day0 + 25 / 24, 6);
  await expect(page.locator('#message')).toHaveText('1 day and 1 hour have passed.');
  // Back leaves without waiting.
  await press(page, '#waitBtn');
  await waitMode(page, 'wait');
  await press(page, '#secondaryBtn');
  await waitMode(page, 'map');
  expect(await game(page, (CL) => CL.campaign.day)).toBeCloseTo(day0 + 25 / 24, 6);
});

test('a band that reaches you cuts the wait short and opens the encounter', async ({ page }) => {
  // Setup: a band of Reavers camped just beside the company, which is alone.
  await game(page, (CL) => {
    const c = CL.campaign;
    c.roster = [];
    const p = CL.parties.spawn(c, Object.keys(CL.content.table('party_templates')).find((t) => CL.content.get('party_templates', t).kind === 'bandit'));
    Object.assign(p, { x: c.world.x + 2, y: c.world.y, tx: null, ty: null });
  });
  await press(page, '#waitBtn');
  await waitMode(page, 'wait');
  await press(page, '#waitScreen [data-wait="72"]');
  await press(page, '#primaryBtn');
  await waitMode(page, 'encounter', 15_000);
  await expect(page.locator('#overlayText')).toContainText('Your wait is cut short after');
  await expect(page.locator('#fade')).toBeHidden();
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

test('P9-03: a realm founded in play flies its own banner on the map', async ({ page }) => {
  const color = await game(page, (CL) => {
    const c = CL.campaign; // test setup: a realm of your own at Westholt
    CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'test' });
    CL.story.state(c).flags.ending = 'valedorn';
    const id = CL.founding.declare(c, 'player', 'westholt_castle', { free: true });
    const s = CL.content.get('settlements', 'westholt_castle');
    Object.assign(c.world, { x: s.mapX, y: s.mapY - 3 });
    // Every colour a shape is filled with (P10-G4: the banners are the art kit's, filled paths).
    window.__banners = [];
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function (...args) {
      window.__banners.push(String(this.fillStyle).toLowerCase());
      return fill.apply(this, args);
    };
    return CL.realm.faction(id).color.toLowerCase();
  });
  await press(page, '#centreBtn');
  await expect.poll(() => game(page, (_CL, want) => window.__banners.includes(want), color)).toBe(true);
});

test('P9-05: a marching army is one banner on the map, with its size', async ({ page }) => {
  const want = await game(page, (CL) => {
    const c = CL.campaign; // test setup: Valedorn's army marching beside you
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
    for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind === 'lord') c.partySpawns[t.id] = 0;
    CL.lords.ensure(c, c.day, true);
    const a = CL.armies.plan(c, 'valedorn');
    Object.assign(a, { phase: 'march', objective: 'defend', target: a.rally, set: c.day });
    for (const p of CL.armies.parties(c, a)) {
      Object.assign(p, { x: c.world.x + 3, y: c.world.y, tx: null, ty: null, ignoreUntil: 1e9 });
      CL.sight.look(c, c.day);
    }
    // Every word and number drawn on the canvas.
    window.__texts = [];
    const text = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, x, y) {
      window.__texts.push(String(s));
      return text.call(this, s, x, y);
    };
    return { n: CL.armies.soldiers(c, a), lords: a.members.map((pid) => CL.realm.titled(pid, c)) };
  });
  await press(page, '#centreBtn');
  await expect.poll(() => game(page, (_CL, w) => window.__texts.some((t) => t === String(w.n) || t === `Valedorn army ${w.n}`), want)).toBe(true);
  // Its lords ride under the banner: none of them is drawn alone.
  const alone = await game(page, (_CL, w) => w.lords.filter((name) => window.__texts.some((t) => t.startsWith(name))).length, want);
  expect(alone).toBe(0);
});
