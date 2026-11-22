// P9-B3: a company of 150 on the Party screen (grouped by troop, a group opened by a tap, how the limit
// is made up) and on the Detachments screen (choosing by troop), by real input at desktop and phone size.
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

/** Test setup: a company of 150 of six troops, a Leadership and renown to lead them, and a veteran captain. */
async function bigCompany(page) {
  await open(page);
  await newGame(page);
  return game(page, (CL) => {
    const c = CL.campaign;
    c.roster = [];
    const mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard'];
    for (let i = 0; i < 150; i++) CL.save.addSoldier(c, mix[i % mix.length]);
    c.character.skills.leadership = 10;
    c.renown = 2400;
    Object.assign(c, { gold: 5000, food: 600 });
    c.roster.find((s) => s.troop === 'guard').record.battles = 12;
    CL.ui.refreshRoster();
    return { cap: CL.party.partyCap(c), head: CL.party.headcount(c) };
  });
}

test('the Party screen with 150 soldiers: grouped by troop with counts, a group opened by a tap', async ({ page }) => {
  const at = await bigCompany(page);
  expect(at).toEqual({ cap: 178, head: 150 });
  await toMap(page);
  await press(page, '#partyBtn');
  await waitMode(page, 'character');
  await expect(page.locator('#sheetStats')).toContainText('Party size 150/178 (8 + Leadership 10 ×5 + renown 120 (1 per 20))');
  const groups = page.locator('#sheetTroops details.soldierGroup');
  await expect(groups).toHaveCount(5);
  const foot = groups.filter({ hasText: 'Footman ×50' });
  await expect(foot).toHaveCount(1);
  await expect(foot.locator('.soldierRow').first()).toBeHidden();
  await foot.locator('summary').scrollIntoViewIfNeeded();
  await press(page, foot.locator('summary'));
  await expect(foot.locator('.soldierRow')).toHaveCount(50);
  await expect(foot.locator('.soldierRow').first()).toBeVisible();
  // The rows keep their touch size; the screen fits the width.
  const box = await foot.locator('summary').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(page.crownlessTouch ? 44 : 20);
  const vp = page.viewportSize();
  const sheet = await page.locator('#sheetTroops').boundingBox();
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(vp.width + 1);
  // A soldier's card from inside the group, and back to the list with the group still open.
  await press(page, foot.locator('.soldierRow').nth(3));
  await expect(page.locator('#sheetTroops')).toContainText('Footman');
  expect(await game(page, (CL) => CL.game.soldierProfile != null)).toBe(true);
});

test('Detachments with a big company: soldiers chosen by troop, five at a time', async ({ page }) => {
  await bigCompany(page);
  await game(page, (CL) => {
    CL.campaign.world.location = 'stonebridge';
  });
  await press(page, '#detachBtn');
  await waitMode(page, 'detachments');
  const screen = page.locator('#detachScreen');
  const pick = screen.locator('.detachByTroop button', { hasText: 'Hunter +5' });
  await expect(pick).toHaveText('Hunter +5 · 0/25');
  await pick.scrollIntoViewIfNeeded();
  await press(page, pick);
  await expect(screen.locator('.detachByTroop button', { hasText: 'Hunter +5' })).toHaveText('Hunter +5 · 5/25');
  await press(page, screen.locator('.detachByTroop button', { hasText: 'Hunter +5' }));
  await expect(screen).toContainText('Soldiers going (10)');
});
