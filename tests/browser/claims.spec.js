// P8-08: losing and retaking land by real input at desktop and phone size: Debug → Prototype D start,
// then the fort lost: the Realm screen's tab becomes Claims (no chores), each claim with what could
// press it; buying it back at peace; handing a fief back from the Fief tab. (The loss paths, the
// retaking and the saves are in tests/claims.test.js; the whole story in tests/slow/prototype-d.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap, debug } = require('./helpers');

async function realmTab(page, tab) {
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, `#realmScreen [data-tab="${tab}"]`);
}

test('Claims: Debug → Prototype D start; the fort falls; the Claims tab, and buying it back at peace', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="prototypeD"]');
  await waitMode(page, 'map');
  await expect(page.locator('#message')).toContainText('Prototype D: you hold Westholt Castle and Ashby for Valedorn, with a mill at Ashby.');
  expect(await game(page, (CL) => [CL.realm.fiefsOf('player', CL.campaign), CL.campaign.roster.length, CL.campaign.sieges.map((s) => s.sid)])).toEqual([['westholt_castle', 'ashby'], 12, ['westholt_castle']]);
  // Test setup: the gathering storms it while you are away, then peace comes.
  await game(page, (CL) => {
    const c = CL.campaign;
    CL.sieges.take(c, c.sieges[0], 'stormed');
    CL.realm.setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test');
    c.gold = 1000;
  });
  await realmTab(page, 'fief');
  await expect(page.locator('#realmScreen [data-tab="fief"]')).toHaveText('Claims');
  await expect(page.locator('#realmScreen .realmNote')).toContainText('You hold no land. Your company, money, mill and followers are yours');
  await expect(page.locator('#realmScreen .fiefCard')).toHaveCount(0); // no chores
  const card = page.locator('#realmScreen .claimCard[data-claim="westholt_castle"]');
  await expect(card.locator('h3')).toHaveText('Westholt Castle');
  await expect(card).toContainText(/held for the Valedorn Crown until it was taken on day \d+\./);
  await expect(card).toContainText('Now held for the Kingdom of Hrothmark by King Hakon Ulfring. A claim gives no income and no control.');
  await expect(page.locator('#realmScreen .claimCard[data-claim="ashby"]')).toContainText('It goes with Westholt Castle');
  await expect(card.locator('[data-act="liege"]')).toBeDisabled(); // at peace: no war to press it in
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await card.locator('[data-act="buy"]').scrollIntoViewIfNeeded();
  await press(page, card.locator('[data-act="buy"]'));
  await expect(page.locator('#realmScreen [data-tab="fief"]')).toHaveText('Fief');
  await expect(page.locator('#realmScreen .fiefCard[data-fief="westholt_castle"]')).toBeVisible();
  expect(await game(page, (CL) => [CL.campaign.gold, CL.realm.fiefsOf('player', CL.campaign).sort()])).toEqual([200, ['ashby', 'westholt_castle']]);
});

test('Claims: hand a fief back from the Fief tab, after a word of what it means', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: Prototype D's start, without the war.
  await game(page, (CL) => {
    const c = CL.campaign;
    CL.claims.prototypeD(c);
    c.sieges.length = 0;
    CL.realm.setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test');
  });
  await realmTab(page, 'fief');
  const card = page.locator('#realmScreen .fiefCard[data-fief="ashby"]');
  await card.locator('.handBackBtn').scrollIntoViewIfNeeded();
  await press(page, card.locator('.handBackBtn'));
  await expect(card.locator('.handBackNote')).toHaveText('Ashby returns to King Godric Ardane, and you keep no claim to it.');
  await press(page, '#handBackYes');
  await expect(page.locator('#realmScreen .fiefCard[data-fief="ashby"]')).toHaveCount(0);
  expect(await game(page, (CL) => [CL.realm.fiefsOf('player', CL.campaign), CL.claims.mine(CL.campaign).length])).toEqual([['westholt_castle'], 0]);
});
