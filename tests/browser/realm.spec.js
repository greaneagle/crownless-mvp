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
  await expect(screen.locator('.realmCard')).toHaveCount(6); // P10-02: with the coast's two realms
  const vale = screen.locator('.realmCard[data-realm="valedorn"]');
  await expect(vale.locator('h3')).toHaveText('Valedorn Crown · King Godric Ardane');
  await expect(vale).toContainText('Greywall Fort (fort): Lord Hamon Greymantle · the story decides it');
  await expect(vale).toContainText('Brackenfield (village, under Greywall): Lady Hawise Greymantle');
  await expect(screen.locator('.realmCard[data-realm="vessaro"] h3')).toHaveText('Vessaro League · Queen Lucrezia Salviati');
  await expect(screen.locator('.realmNote')).toContainText('Free City of Merrow, Free Port of Gullhaven: free cities'); // P10-02
  await expectLayoutSound(page, ['#realmScreen [data-tab="holdings"]', '#realmScreen [data-tab="lords"]', '#primaryBtn']);
  // The Lords tab: what each holds (or landless), their kin, need and where they are (P8-07's lines).
  await press(page, '#realmScreen [data-tab="lords"]');
  await expect(page.locator('#realmScreen [data-tab="lords"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(vale).toContainText('Lord Hamon Greymantle of House Greymantle · Valedorn · holds Greywall Fort, Highmere');
  await expect(vale).toContainText('Kin: Hawise Greymantle (sister), Tancred Greymantle (son)');
  await expect(vale).toContainText('Lord Tancred Greymantle of House Greymantle · Valedorn · landless');
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

test('P9-01: each realm’s card shows its treasury and trend, its laws and its officers', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  const want = await game(page, (CL) => ({ t: CL.crowns.treasury(CL.campaign, 'valedorn'), m: CL.realm.titled(CL.crowns.holder(CL.campaign, 'valedorn', 'marshal'), CL.campaign) }));
  const vale = page.locator('#realmScreen .realmCard[data-realm="valedorn"]');
  await expect(vale.locator('.realmCrown').first()).toHaveText(`Treasury: ${want.t} crowns, steady.`);
  await expect(vale).toContainText('Laws: a crown; 10% to the crown; the eldest child inherits; 3 fiefs a lord; the ruler makes war.');
  await expect(vale).toContainText(`Offices: Marshal: ${want.m} · Steward:`);
  const ves = page.locator('#realmScreen .realmCard[data-realm="vessaro"]');
  await expect(ves).toContainText('Laws: a league; 10% to the crown; the council chooses an heir; 3 fiefs a lord; the council makes war.');
  await expectLayoutSound(page, ['#realmScreen [data-tab="holdings"]', '#primaryBtn']);
});

test('P9-02: the Diplomacy tab shows each pair of realms, their treaties with end days, and trust', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    CL.diplomacy.sign(c, 'trade', 'valedorn', 'hrothmark'); // test setup: a treaty to show
    CL.diplomacy.addTrust(c, 'aurelian', 'vessaro', -15);
  });
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="diplomacy"]');
  await expect(page.locator('#realmScreen [data-tab="diplomacy"]')).toHaveAttribute('aria-pressed', 'true');
  const cards = page.locator('#realmScreen .diplomacyCard');
  await expect(cards).toHaveCount(15); // every pair of six realms (P10-02)
  const vh = page.locator('#realmScreen .diplomacyCard[data-pair="hrothmark|valedorn"]');
  await expect(vh.locator('h3')).toHaveText(/^Valedorn and Hrothmark: at peace/);
  await expect(vh).toContainText('Treaties: trade until day 121.');
  await expect(page.locator('#realmScreen .diplomacyCard[data-pair="aurelian|vessaro"]')).toContainText('Trust: Aurelian in Vessaro -15, Vessaro in Aurelian 0.');
  await expectLayoutSound(page, ['#realmScreen [data-tab="holdings"]', '#realmScreen [data-tab="diplomacy"]', '#primaryBtn']);
});

test('P9-03: the Your realm tab: declare a realm from a fort you hold, then set the marshal’s policy', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign; // test setup: Westholt is yours, the story is over, with the renown and soldiers to rule
    CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'test' });
    CL.story.state(c).flags.ending = 'valedorn';
    c.renown = 600;
    for (let i = 0; i < 40; i++) CL.save.addSoldier(c, 'levy');
  });
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="rule"]');
  const card = page.locator('#realmScreen .ruleCard[data-declare="westholt_castle"]');
  await expect(card).toContainText('Your holdings leave the Valedorn Crown and become a realm of your own.');
  await press(page, card.locator('button', { hasText: 'Declare' }));
  const head = page.locator('#realmScreen .ruleCard[data-realm="r1"]');
  await expect(head.locator('h3')).toHaveText('The Realm of Westholt Castle');
  await expect(head).toContainText('You rule The Realm of Westholt Castle, from Westholt Castle.');
  await expect(head).toContainText('Offices: Marshal: vacant');
  const marshal = page.locator('#realmScreen select[data-policy="marshal"]');
  await marshal.selectOption('expand:hrothmark');
  expect(await game(page, (CL) => CL.campaign.rule.marshal)).toBe('expand:hrothmark');
  await expect(page.locator('#realmScreen select[data-policy="marshal"]')).toHaveValue('expand:hrothmark');
  await page.locator('#realmScreen select[data-policy="chancellor"]').scrollIntoViewIfNeeded(); // the screen scrolls
  await expectLayoutSound(page, ['#realmScreen select[data-policy="chancellor"]', '#primaryBtn']);
});

test('P9-T: the Your realm tab: offer a treaty to a realm, answered at once by its ruler', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign; // test setup: your realm at Westholt, and Aurelia thinks well of it
    CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'test' });
    CL.story.state(c).flags.ending = 'valedorn';
    c.renown = 600;
    for (let i = 0; i < 40; i++) CL.save.addSoldier(c, 'levy');
    const id = CL.founding.declare(c, 'player', 'westholt_castle');
    CL.diplomacy.addTrust(c, 'aurelian', id, 40);
  });
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="rule"]');
  const card = page.locator('#realmScreen .ruleCard[data-treaties="aurelian"]');
  await expect(card.locator('h3')).toHaveText('Treaties with Aurelian');
  await expect(card).toContainText('Their ruler answers by their trust in you');
  const offer = card.locator('button', { hasText: 'Offer trade' });
  await offer.scrollIntoViewIfNeeded();
  await press(page, offer);
  expect(await game(page, (CL) => CL.diplomacy.has(CL.campaign, 'r1', 'aurelian', 'trade'))).toBe(true);
  await expect(page.locator('#realmScreen .ruleCard[data-treaties="aurelian"]')).toContainText('Break the trade');
  const broken = '#realmScreen .ruleCard[data-treaties="aurelian"] button:has-text("Break the trade")';
  await page.locator(broken).scrollIntoViewIfNeeded();
  await expectLayoutSound(page, [broken, '#primaryBtn']);
});
