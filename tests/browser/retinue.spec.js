// P7-06: meeting a companion of the wider world in their town, taking on their errand, and seeing them
// with their loyalty and motive on the Party sheet, by real input at desktop and phone size. (The rules
// are checked in tests/retinue.test.js.)
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

test('Companions: talk to Iacopo in Vessara, settle his debt, and find him on the Party sheet', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: the company in Vessara with crowns to spare.
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'vessara');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'vessara' });
    c.gold = 500;
    CL.ui.refreshRoster();
  });
  await press(page, page.locator('#peopleHere button', { hasText: 'Talk to Iacopo' }));
  await waitMode(page, 'talk');
  await press(page, page.locator('#talkOptions button', { hasText: 'keep my company’s books' }));
  await press(page, page.locator('#talkOptions button', { hasText: 'settle it' }));
  await waitMode(page, 'settlement');
  await press(page, page.locator('#peopleHere button', { hasText: 'Talk to Iacopo' }));
  await waitMode(page, 'talk');
  await press(page, page.locator('#talkOptions button', { hasText: '120 crowns' }));
  await press(page, page.locator('#talkOptions button', { hasText: 'Welcome to the company' }));
  await waitMode(page, 'settlement');
  expect(await game(page, (CL) => ({ gold: CL.campaign.gold, with: CL.campaign.retinue.map((m) => m.id) }))).toEqual({ gold: 380, with: ['iacopo'] });
  await expect(page.locator('#peopleHere button', { hasText: 'Iacopo' })).toHaveCount(0);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const card = page.locator('#sheetCompanion .retinueCard[data-companion="iacopo"]');
  await card.scrollIntoViewIfNeeded();
  await expect(page.locator('#companionHead')).toBeVisible();
  await expect(card).toContainText(/Iacopo .*content \(\d+\) · fit to fight .*12 crowns a week/);
  await expect(card).toContainText('Cares about:');
  const box = await card.boundingBox();
  const vw = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
});
