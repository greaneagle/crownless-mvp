// P8-04: allegiance by real input at desktop and phone size: Service on the capital's notice board, with
// the preview of what changes and what stays before the button; then the Realm screen's Allegiance
// tab, and leaving with its preview. (The rules are in tests/allegiance.test.js.)
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

async function fits(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(b.x).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
}

test('Allegiance: take service at Stonebridge from its preview, then see it and leave it from the Realm screen', async ({ page }) => {
  await open(page);
  await newGame(page);
  await press(page, '#contractsBtn');
  await waitMode(page, 'contracts');
  const serve = page.locator('#contractsScreen .allegianceCard[data-action="serve"]');
  await expect(serve.locator('h3')).toHaveText('Service with the Valedorn Crown');
  await expect(serve).toContainText(/You serve the Valedorn Crown for 30 days, at \d+ crowns a week from their treasury \(\d+ crowns in it\)\./);
  await expect(serve).toContainText('Your soldiers and money stay yours.');
  await fits(page, serve);
  // Swearing isn't open yet: the reason is on the card, its button disabled.
  const swear = page.locator('#contractsScreen .allegianceCard[data-action="swear"]');
  await expect(swear).toContainText('The Valedorn Crown must count you a friend');
  await expect(swear.locator('button')).toBeDisabled();
  await press(page, serve.locator('button', { hasText: 'Take service' }));
  await expect(page.locator('#contractsScreen .allegianceCard[data-action="renew"]')).toBeVisible();
  expect(await game(page, (CL) => CL.campaign.allegiance.kind)).toBe('mercenary');
  // The Realm screen's Allegiance tab (Journal → The Realms).
  await press(page, '#primaryBtn'); // back to Stonebridge
  await waitMode(page, 'settlement');
  await press(page, '#placeJournalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="allegiance"]');
  const me = page.locator('#realmScreen .realmCard[data-realm="you"]');
  await expect(me.locator('h3')).toHaveText('Mercenary');
  await expect(me).toContainText(/A mercenary of the Valedorn Crown since day \d+: 30 days left/);
  const leave = page.locator('#realmScreen .allegianceCard[data-action="release"]');
  await expect(leave).toContainText('You leave the Valedorn Crown’s service 30 days early, and lose 10 standing with them.'.replace('’', "'"));
  await fits(page, leave);
  await press(page, leave.locator('button'));
  await expect(page.locator('#realmScreen .realmCard[data-realm="you"] h3')).toHaveText('Independent');
  expect(await game(page, (CL) => [CL.campaign.allegiance.kind, CL.campaign.reputation.valedorn])).toEqual(['independent', -10]);
});

test('Allegiance: a vassal’s defection preview names the fief lost, the claim kept and the hunt', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: a vassal of Valedorn holding Westholt Castle.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
    CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true });
  });
  await press(page, '#placeJournalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="allegiance"]');
  await expect(page.locator('#realmScreen .realmCard[data-realm="you"]')).toContainText('You hold Westholt Castle.');
  const defect = page.locator('#realmScreen .allegianceCard[data-action="defect"]');
  for (const line of ['You will lose Westholt Castle. You keep a claim to it.', "Valedorn's lords will hunt you for 10 days.", 'The Valedorn lords will remember it.', 'Your soldiers and money stay yours.']) await expect(defect).toContainText(line);
  await fits(page, defect);
  const ask = page.locator('#realmScreen .allegianceCard[data-action="release"]');
  await expect(ask).toContainText('Westholt Castle returns to the crown. You keep no claim to it.');
  await press(page, defect.locator('button', { hasText: 'Defect' }));
  expect(await game(page, (CL) => [CL.campaign.allegiance.kind, CL.realm.holderOf('westholt_castle', CL.campaign) === CL.campaign.rulers.valedorn, CL.allegiance.hunted(CL.campaign, 'valedorn')])).toEqual(['independent', true, true]);
});
