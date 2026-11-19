// P7-04: on the map, the Hide button appears in a forest and hides the company until it sets off, and
// a band the company can't see can't be tapped (the tap travels to the spot instead). Desktop and phone.
const { test, expect, open, game, press, pressAt, mapToPage, newGame, toMap, debug } = require('./helpers');

test('Hide in a forest, and an unseen band is not on the map', async ({ page }) => {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="clearParties"]');
  await toMap(page);
  // Test setup: midday, the company standing in the forest west of Stonebridge.
  await game(page, (CL) => {
    Object.assign(CL.campaign.world, { x: 70, y: 80 });
    CL.campaign.day = Math.floor(CL.campaign.day) + 0.5;
    CL.mapView.centre(true);
  });
  const hide = page.locator('#hideBtn');
  await expect(hide).toBeVisible();
  await press(page, hide);
  expect(await game(page, (CL) => CL.campaign.world.hidden)).toBe(true);
  await expect(hide).toHaveText('Stop hiding');
  await press(page, hide);
  expect(await game(page, (CL) => Boolean(CL.campaign.world.hidden))).toBe(false);
  // Out in the open there is nowhere to hide.
  await game(page, (CL) => Object.assign(CL.campaign.world, { x: 125, y: 70 }));
  await expect(hide).toBeHidden();
  // A band out of sight: a tap where it stands travels there, it doesn't open the band.
  const spot = await game(page, (CL) => {
    const c = CL.campaign;
    const band = CL.parties.spawn(c, 'bandits');
    Object.assign(band, { x: c.world.x + 30, y: c.world.y, tx: null, ty: null, ignoreUntil: 1e9 });
    CL.mapView.state.zoom = 1;
    CL.mapView.centre(true);
    return { x: band.x, y: band.y, seen: CL.sight.playerSees(c, band) };
  });
  expect(spot.seen).toBe(false);
  const p = await mapToPage(page, spot.x, spot.y);
  await pressAt(page, p.x, p.y);
  expect(await game(page, (CL) => CL.game.travel?.type)).toBe('point');
});
