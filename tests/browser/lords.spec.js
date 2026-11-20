// P8-01: a lord on the map, by real input at desktop and phone size: a tap tells who they are and what
// they are doing; a ransom offer interrupts the map with Accept, Hold and Release. (Intentions, sizes,
// capture, ransom and escape are in tests/lords.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap, canvasToPage, pressAt } = require('./helpers');

test('Lords: a tap on a lord’s party says who they are and what they are doing', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: Lord Hamon rides a little way off, standing still, where the company can see him.
  const at = await game(page, (CL) => {
    const c = CL.campaign;
    const id = Object.keys(c.people).find((k) => c.people[k].key === 'hamon_greymantle');
    const p = CL.lords.partyOf(c, id);
    Object.assign(p, { x: c.world.x + 5, y: c.world.y - 3, tx: null, ty: null, intent: 'patrol' });
    const d = CL.world.partyDrawPos(p);
    return [d.x, d.y];
  });
  const spot = await canvasToPage(page, at[0], at[1]);
  await pressAt(page, spot.x, spot.y);
  await expect(page.locator('#message')).toContainText('Lord Hamon Greymantle, holder of Greywall Fort and Highmere: riding the bounds of their lands.');
});

test('Lords: a ransom offer interrupts the map with Accept, Hold and Release; Accept pays', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: Lord Hamon is your prisoner and his sister's offer is due.
  const before = await game(page, (CL) => {
    const c = CL.campaign;
    const id = Object.keys(c.people).find((k) => c.people[k].key === 'hamon_greymantle');
    CL.lords.beaten(c, CL.lords.partyOf(c, id), 'player');
    CL.lords.prisonerOf(c, id).offerDay = c.day;
    CL.ui.openRansom();
    return { gold: c.gold, ransom: CL.lords.ransomOf(CL.lords.prisonerOf(c, id)) };
  });
  await waitMode(page, 'ransom');
  await expect(page.locator('#overlayTitle')).toHaveText('A RANSOM OFFER');
  await expect(page.locator('#overlayText')).toContainText('Lady Hawise Greymantle offers');
  for (const id of ['#ransom_accept', '#ransom_hold', '#ransom_release']) await expect(page.locator(id)).toBeVisible();
  await expect(page.locator('#ransom_accept')).toContainText(`Accept · ${before.ransom} crowns`);
  const vp = page.viewportSize();
  for (const id of ['#ransom_accept', '#ransom_hold', '#ransom_release']) {
    const b = await page.locator(id).boundingBox();
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
    expect(b.height).toBeGreaterThanOrEqual(43.5);
  }
  await press(page, '#ransom_accept');
  await waitMode(page, 'map');
  expect(await game(page, (CL) => CL.campaign.gold)).toBe(before.gold + before.ransom);
  expect(await game(page, (CL) => CL.campaign.prisoners.length)).toBe(0);
});

test('Lords: Hold keeps the prisoner and closes the offer; Release lets them go', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    for (const key of ['hamon_greymantle', 'tancred_greymantle']) {
      const id = Object.keys(c.people).find((k) => c.people[k].key === key);
      CL.lords.beaten(c, CL.lords.partyOf(c, id), 'player');
      CL.lords.prisonerOf(c, id).offerDay = c.day;
    }
    CL.ui.openRansom();
  });
  await waitMode(page, 'ransom');
  await press(page, '#ransom_hold');
  // The second offer follows at once.
  await waitMode(page, 'ransom');
  await press(page, '#ransom_release');
  await waitMode(page, 'map');
  const left = await game(page, (CL) => CL.campaign.prisoners.map((x) => CL.campaign.people[x.lord].key));
  expect(left).toEqual(['hamon_greymantle']);
});
