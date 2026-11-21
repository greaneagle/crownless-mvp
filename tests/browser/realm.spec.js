// P8-02: the Realm screen (Holdings and Lords, read-only) from the Journal on the map and in a settlement, and a
// settlement's holder on a map tap and on its screen, by real input at desktop and phone size (a touch
// tap on the phone). (The model, transfer, saves and the 2.23 fixtures are in tests/holdings.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap, settlementOnPage, pressAt, expectLayoutSound } = require('./helpers');

test('Realm: Holdings and Lords tabs from the map’s Journal, every realm, and back', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await expect(page.locator('#overlayTitle')).toHaveText('THE REALMS');
  const screen = page.locator('#realmScreen');
  await expect(screen.locator('.realmCard')).toHaveCount(4);
  const vale = screen.locator('.realmCard[data-realm="valedorn"]');
  await expect(vale.locator('h3')).toHaveText('Valedorn Crown · King Godric Ardane');
  await expect(vale).toContainText('Greywall Fort (fort): Lord Hamon Greymantle · the story decides it');
  await expect(vale).toContainText('Brackenfield (village, under Greywall): Lady Hawise Greymantle');
  await expect(screen.locator('.realmCard[data-realm="vessaro"] h3')).toHaveText('Vessaro League · Queen Lucrezia Salviati');
  await expect(screen.locator('.realmNote')).toContainText('Free City of Merrow: a free city');
  await expectLayoutSound(page, ['#realmScreen [data-tab="holdings"]', '#realmScreen [data-tab="lords"]', '#primaryBtn']);
  // The Lords tab: what each holds (or landless), their kin, need and where they are (P8-07's lines).
  await press(page, '#realmScreen [data-tab="lords"]');
  await expect(page.locator('#realmScreen [data-tab="lords"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(vale).toContainText('Lord Hamon Greymantle · Valedorn · holds Greywall Fort, Highmere');
  await expect(vale).toContainText('Kin: Hawise Greymantle (sister), Tancred Greymantle (son)');
  await expect(vale).toContainText('Lord Tancred Greymantle · Valedorn · landless');
  await expect(vale).toContainText('Kin: Hamon Greymantle (father)');
  // It scrolls, and every card fits the width.
  const last = screen.locator('.realmCard').last();
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await press(page, '#primaryBtn'); // Back to the Journal
  await waitMode(page, 'journal');
  await press(page, '#primaryBtn'); // and to the map
  await waitMode(page, 'map');
});

test('Realm: a change of hands shows; a settlement tells its holder on a tap and on its screen', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: Aurelia takes Westholt (a fort of the wider world, not the story's).
  await game(page, (CL) => CL.realm.setOwner(CL.campaign, 'westholt_castle', 'aurelian', 'test'));
  await press(page, '#placeJournalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  const aur = page.locator('#realmScreen .realmCard[data-realm="aurelian"]');
  await expect(aur).toContainText('Westholt Castle (fort): First Magistrate Severin Aquila · claimed by Lady Avice Westmere');
  await expect(aur).toContainText('Ashby (village, under Westholt): First Magistrate Severin Aquila');
  await press(page, '#primaryBtn'); // Back to the Journal, then to Stonebridge
  await waitMode(page, 'journal');
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  await toMap(page);
  // A tap on Greywall sets off for it and says who holds it.
  const at = await settlementOnPage(page, 'greywall_fort');
  await pressAt(page, at.x, at.y);
  await expect(page.locator('#message')).toContainText('Greywall Fort: held by Lord Hamon Greymantle for Valedorn.');
});
