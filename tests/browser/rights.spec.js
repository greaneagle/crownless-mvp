// P8-03: a right refused shows its reason where the button is, instead of hiding the button: the
// recruit buttons of a Hostile owner, by real input at desktop and phone size. (The rules are in
// tests/rights.test.js.)
const { test, expect, open, game, press, newGame } = require('./helpers');

test('Rights: a Hostile owner’s recruits are shown disabled, with the reason on them and below', async ({ page }) => {
  await open(page);
  await newGame(page);
  const hire = page.locator('#recruitA');
  await expect(hire).toBeVisible();
  await expect(hire).toBeEnabled();
  // Test setup: Valedorn turns Hostile to you.
  await game(page, (CL) => {
    CL.realm.adjust(CL.campaign, 'valedorn', -60);
    CL.ui.refreshRoster();
  });
  const why = "The Valedorn Crown won't let you recruit here: they count you Hostile";
  await expect(hire).toBeVisible();
  await expect(hire).toBeDisabled();
  await expect(hire).toHaveAttribute('title', why);
  await expect(page.locator('#serviceNote')).toHaveText(`${why}.`);
  const soldiers = await game(page, (CL) => CL.campaign.roster.length);
  await hire.click({ force: true }); // a press on a disabled button does nothing
  expect(await game(page, (CL) => CL.campaign.roster.length)).toBe(soldiers);
  // The board says the same.
  await press(page, '#contractsBtn');
  await expect(page.locator('#contractsScreen')).toContainText(`${why.replace('recruit here', 'take their work here')}. Win back their favour`);
});
