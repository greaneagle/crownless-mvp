// P7-07: a soldier earns a trait after a battle and it shows, by real input at desktop and phone size:
// told as it happens, on their row and card, and on the roll of honour once they retire. (The rules
// and the measured effects are in tests/traits.test.js.)
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

test('Traits: earned at a milestone, shown on the soldier list, the card and the roll of honour', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: a footman one battle short of Steadfast; then that battle's record comes in.
  const name = await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.save.addSoldier(c, 'footman');
    s.record.battles = 7;
    CL.events.emit(c, 'BattleResolved', { win: true, participants: [s.id], soldierKills: {}, soldierAssists: {}, encounterName: 'Road Reavers' });
    CL.ui.refreshRoster();
    return s.name;
  });
  await expect(page.locator('#message')).toContainText(`${name} has become Steadfast after 8 battles with the company.`);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const row = page.locator('.soldierRow', { hasText: name });
  await row.scrollIntoViewIfNeeded();
  await expect(row).toContainText('Steadfast');
  await press(page, row);
  const card = page.locator('.soldierCard');
  await expect(card.locator('.soldierTrait')).toHaveText(/^Steadfast: Holds the group together/);
  await expect(card.locator('.soldierNotes')).toContainText('Became Steadfast after 8 battles with the company.');
  const box = await card.locator('.soldierTrait').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  // Retired with honour, the trait goes onto the roll.
  const retire = card.locator('.retireBtn');
  await retire.scrollIntoViewIfNeeded();
  await press(page, retire);
  await press(page, retire);
  await press(page, page.locator('.viewTabs button', { hasText: 'Roll of honour' }));
  await expect(page.locator('.honourRow', { hasText: name })).toContainText('· Steadfast');
});
