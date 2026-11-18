// W-02: the world-map camera and its gestures, by real input. A drag pans and a pinch zooms without
// ever starting travel; a tap still travels at any zoom; the wheel zooms at the cursor; + − and Centre
// work; the zoom is kept on the device. (Battle and town taps are covered by their own specs.)
const { test, expect, open, waitMode, game, press, pressAt, drag, touch, isTouch, settlementOnPage, newGame, toMap, debug, expectLayoutSound } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="clearParties"]'); // an empty road: nothing comes for the party meanwhile
  await toMap(page);
});

const view = (page) => game(page, (CL) => ({ ...CL.mapView.state }));
const still = (page) => game(page, (CL) => ({ mode: CL.game.mode, travel: CL.game.travel, location: CL.campaign.world.location }));

/** The middle of the canvas, in page coordinates. */
async function middle(page) {
  const b = await page.locator('#game').boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function zoomRightIn(page) {
  while (!(await page.locator('#zoomInBtn').isDisabled())) await press(page, '#zoomInBtn');
  expect((await view(page)).zoom).toBe(2.4);
}

test('the map buttons: − is off at "fit", + steps to 2.4×, and they sit clear of everything', async ({ page }) => {
  await expect(page.locator('#zoomOutBtn')).toBeDisabled();
  await expectLayoutSound(page, ['#zoomOutBtn', '#zoomInBtn', '#centreBtn', '#waitBtn', '#partyBtn', '#journalBtn', '#settingsBtn'], { info: ['#topLeft'] });
  await press(page, '#zoomInBtn');
  expect((await view(page)).zoom).toBe(1.6);
  await press(page, '#zoomInBtn');
  expect((await view(page)).zoom).toBe(2.4);
  await expect(page.locator('#zoomInBtn')).toBeDisabled();
  await press(page, '#zoomOutBtn');
  expect((await view(page)).zoom).toBe(1.6);
});

test('a drag pans the map and never travels, even when it ends on a settlement', async ({ page }) => {
  await zoomRightIn(page);
  const before = await view(page);
  // Press on Oakford and drag: the map moves with the finger, so the finger lifts still over Oakford.
  const oakford = await settlementOnPage(page, 'oakford');
  await drag(page, oakford, { x: oakford.x + 160, y: oakford.y + 50 });
  const after = await view(page);
  expect(after.cx).toBeLessThan(before.cx - 1); // the map moved east, so the view looks further west
  expect(after.following).toBe(false);
  const moved = await settlementOnPage(page, 'oakford');
  expect(Math.abs(moved.x - (oakford.x + 160))).toBeLessThan(3); // under the finger where it lifted
  expect(await still(page)).toEqual({ mode: 'map', travel: null, location: null });
  await expect(page.locator('#centreBtn')).toHaveClass(/away/);
  // A drag that starts beside a village and ends on its icon.
  const village = await settlementOnPage(page, 'brackenfield');
  await drag(page, { x: village.x + 70, y: village.y + 30 }, village);
  expect(await still(page)).toEqual({ mode: 'map', travel: null, location: null });
  expect((await view(page)).cx).not.toBe(after.cx);
});

test('a tap still travels at 2.4×, and following resumes with the journey', async ({ page }) => {
  await zoomRightIn(page);
  const m = await middle(page);
  await drag(page, m, { x: m.x + 40, y: m.y });
  expect((await view(page)).following).toBe(false);
  const oakford = await settlementOnPage(page, 'oakford');
  await pressAt(page, oakford.x, oakford.y);
  expect(await game(page, (CL) => CL.game.travel && { type: CL.game.travel.type, id: CL.game.travel.id })).toEqual({ type: 'settlement', id: 'oakford' });
  expect((await view(page)).following).toBe(true);
  await waitMode(page, 'settlement', 30_000);
  expect(await game(page, (CL) => CL.campaign.world.location)).toBe('oakford');
});

test('Centre brings the view back to the party, at the first press after a drag', async ({ page }) => {
  await zoomRightIn(page);
  const m = await middle(page);
  await drag(page, m, { x: m.x - 250, y: m.y - 120 });
  const party = () => game(page, (CL) => CL.mapView.toScreen(CL.campaign.world.x, CL.campaign.world.y).map(Math.round));
  expect(await party()).not.toEqual([480, 270]);
  await press(page, '#centreBtn');
  expect((await view(page)).following).toBe(true);
  expect(await party()).toEqual([480, 270]);
  await expect(page.locator('#centreBtn')).not.toHaveClass(/away/);
});

test('a two-finger pinch zooms without travel, and lifting one finger first never taps', async ({ page }) => {
  test.skip(!isTouch(page), 'touch pinch');
  // Pinch right over Oakford: a stray tap there would set off for it.
  const o = await settlementOnPage(page, 'oakford');
  const t = await touch(page);
  await t.down([
    { id: 1, x: o.x - 30, y: o.y },
    { id: 2, x: o.x + 30, y: o.y },
  ]);
  for (let i = 1; i <= 6; i++) {
    await t.move([
      { id: 1, x: o.x - 30 - i * 12, y: o.y },
      { id: 2, x: o.x + 30 + i * 12, y: o.y },
    ]);
  }
  await t.lift([{ id: 1, x: o.x - 102, y: o.y }]); // one finger up …
  await t.move([{ id: 1, x: o.x - 100, y: o.y }]);
  await t.up(); // … then the other
  const v = await view(page);
  expect(v.zoom).toBeGreaterThan(1.8);
  expect(await still(page)).toEqual({ mode: 'map', travel: null, location: null });
  // The pinch zoomed around the fingers: Oakford stayed close to where they were.
  const after = await settlementOnPage(page, 'oakford');
  expect(Math.abs(after.x - o.x)).toBeLessThan(40);
  // And the zoom is kept on the device.
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('crownless_settings'))).mapZoom).toBeCloseTo(v.zoom, 1);
});

test('the mouse wheel zooms at the cursor; arrow keys pan; − and C on the keyboard', async ({ page }) => {
  test.skip(isTouch(page), 'mouse and keyboard');
  const o = await settlementOnPage(page, 'oakford');
  await page.mouse.move(o.x, o.y);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200);
  await page.waitForFunction(() => window.Crownless.mapView.state.zoom > 1.5);
  const after = await settlementOnPage(page, 'oakford');
  expect(Math.abs(after.x - o.x) + Math.abs(after.y - o.y)).toBeLessThan(6); // Oakford stayed under the cursor
  expect(await still(page)).toEqual({ mode: 'map', travel: null, location: null });
  const before = await view(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((cx) => window.Crownless.mapView.state.cx > cx + 2, before.cx);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyC');
  expect((await view(page)).following).toBe(true);
  await page.keyboard.press('Minus');
  await page.keyboard.press('Minus');
  expect((await view(page)).zoom).toBe(1);
  expect(await still(page)).toEqual({ mode: 'map', travel: null, location: null });
});

test('the zoom is kept on the device: the map opens at it after a reload', async ({ page }) => {
  await zoomRightIn(page);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('crownless_settings'))).mapZoom).toBe(2.4);
  await page.reload();
  await waitMode(page, 'title');
  await press(page, '#primaryBtn'); // Continue
  await page.waitForFunction(() => ['map', 'settlement'].includes(window.Crownless.game.mode));
  if ((await game(page, (CL) => CL.game.mode)) === 'settlement') await toMap(page);
  expect((await view(page)).zoom).toBe(2.4);
});
