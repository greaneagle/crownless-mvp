// P10-08: the UI toward the references, and the fog of sight on the map.
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

/** The brightness of the map at a point `dx` circle-radii east of the company, with the fog on or off. */
async function brightness(page, dx, { fog }) {
  return game(page, async (CL, { dx, fog }) => {
    CL.settings.set('reducedEffects', !fog);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = CL.campaign;
    const V = CL.mapView;
    const s = CL.sight.sources(c)[0];
    const r = s.r * CL.sight.factor(c.day, s, s);
    const [hx, hy] = V.toScreen(c.world.x, c.world.y);
    const rx = V.toScreen(c.world.x + r, c.world.y)[0] - hx;
    const canvas = document.querySelector('#game');
    const k = canvas.width / CL.W;
    const x = Math.round((hx + dx * rx) * k);
    const y = Math.round((hy + 30) * k); // below the hero's own sprite
    const d = canvas.getContext('2d').getImageData(x - 2, y - 2, 5, 5).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4) / 3;
  }, { dx, fog });
}

test('the fog of sight: darker beyond what you can see, as drawn within; night shrinks it; reduced effects turn it off', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await game(page, (CL) => {
    CL.campaign.day = 2.5; // midday
    CL.mapView.state.following = true;
  });
  const farOn = await brightness(page, 2.2, { fog: true });
  const farOff = await brightness(page, 2.2, { fog: false });
  expect(farOn).toBeLessThan(farOff - 8); // beyond sight: darker
  const nearOn = await brightness(page, 0.5, { fog: true });
  const nearOff = await brightness(page, 0.5, { fog: false });
  expect(Math.abs(nearOn - nearOff)).toBeLessThan(3); // within it: as drawn
  // At night sight is shorter: the same spot, measured by day's reach, falls outside it.
  const dayR = await game(page, (CL) => CL.sight.companyRange(CL.campaign));
  await game(page, (CL) => {
    CL.campaign.day = 3; // midnight
  });
  const nightR = await game(page, (CL) => CL.sight.companyRange(CL.campaign) * CL.sight.factor(CL.campaign.day, CL.campaign.world, CL.campaign.world));
  expect(nightR).toBeLessThan(dayR);
  const atDayEdge = (0.85 * dayR) / nightR; // 0.85 of day's radius, in night radii
  const nOn = await brightness(page, atDayEdge, { fog: true });
  const nOff = await brightness(page, atDayEdge, { fog: false });
  expect(nOn).toBeLessThan(nOff - 4);
  await game(page, (CL) => CL.settings.set('reducedEffects', false));
});

test('a story band is named on the map by its own name', async ({ page }) => {
  await open(page);
  await newGame(page);
  const names = await game(page, (CL) => {
    const c = CL.campaign;
    CL.story.apply([{ start: 'q1' }, { stage: 'q1_wagon_back', quest: 'q1' }], c, { quest: 'q1' });
    const p = c.parties.find((x) => x.questTag === 'q1_ambush');
    return [CL.render.questName(p)];
  });
  expect(names).toEqual(['Reaver Ambush']);
});

test('the reworked screens: the dialogue box names the speaker and what they are; the party sheet has its card and stats', async ({ page }) => {
  await open(page);
  await newGame(page);
  await press(page, page.locator('#peopleHere button', { hasText: 'Elder Maren' }));
  await waitMode(page, 'talk');
  await expect(page.locator('#overlayTitle')).toHaveText('Elder Maren');
  await expect(page.locator('#overlaySub')).toHaveText('Elder');
  await expect(page.locator('#talkOptions button').first()).toBeVisible();
  await press(page, page.locator('#talkOptions button', { hasText: 'Goodbye' }));
  await waitMode(page, 'settlement');
  await expect(page.locator('#rosterSummary .ico')).toHaveCount(5);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  await expect(page.locator('#overlayTitle')).toHaveText('PARTY');
  await expect(page.locator('.heroCard .who b')).toHaveText('Tester');
  await expect(page.locator('.statGrid > div')).toHaveCount(7);
  await expect(page.locator('.statGrid .ico')).toHaveCount(7);
  // The panels wear the new frame: a thin gold border on deep navy.
  const look = await page.locator('#overlay .modal').evaluate((m) => getComputedStyle(m).borderTopWidth);
  expect(look).toBe('1px');
});
