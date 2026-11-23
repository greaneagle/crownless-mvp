// P8-07: the Lords tab by real input at desktop and phone size: each lord with what they hold, their
// kin, their top need, where they are and what they think of you; Ask… a lord, a request and its
// answer with the reasons; a negotiated price paid once; a lord's petition accepted. (The model, its
// factors, changing realm and the saves are in tests/nobles.test.js.)
const { test, expect, open, waitMode, game, press, newGame, toMap } = require('./helpers');

async function lordsTab(page) {
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="lords"]');
}

test('Lords: each lord’s lines; Ask… Lord Tancred to ride with you: a price and its reasons, paid once', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: a sworn vassal of Valedorn with crowns to spend.
  await game(page, (CL) => {
    const c = CL.campaign;
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
    c.gold = 1000;
  });
  await lordsTab(page);
  const tancred = page.locator('#realmScreen .lordRow').filter({ hasText: 'Lord Tancred Greymantle · Valedorn · landless' });
  await expect(tancred).toContainText('Kin: Hamon Greymantle (father)');
  await expect(tancred).toContainText('Wants land of his own');
  await expect(tancred).toContainText('hungry for glory, hungry for land');
  await expect(tancred).toContainText('He hardly knows you (0).');
  await tancred.locator('.lordAskBtn').scrollIntoViewIfNeeded();
  await press(page, tancred.locator('.lordAskBtn'));
  const card = page.locator('#realmScreen .lordAskCard');
  await expect(card.locator('h3')).toHaveText('Ask Lord Tancred Greymantle');
  await expect(card.locator('[data-ask="siege"]')).toBeDisabled(); // you besiege nothing
  await expect(card.locator('[data-ask="siege"]')).toHaveAttribute('title', 'You are besieging nothing');
  await press(page, card.locator('[data-ask="ride"]'));
  const answer = card.locator('.lordAnswer');
  await expect(answer).toHaveAttribute('data-answer', 'negotiate');
  await expect(answer.locator('b')).toHaveText(/^Lord Tancred Greymantle will, for \d+ crowns\.$/);
  await expect(answer).toContainText('He is sworn to the same crown (+). He owes you nothing. You are close to his lands (+). He is hungry for glory (+). He doesn\'t fear you.');
  const vp = page.viewportSize();
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  const before = await game(page, (CL) => CL.campaign.gold);
  const price = await game(page, (CL) => CL.campaign.nobles.asks[Object.keys(CL.campaign.people).find((id) => CL.campaign.people[id].key === 'tancred_greymantle')].price);
  await press(page, '#lordPay');
  expect(await game(page, (CL) => CL.campaign.gold)).toBe(before - price);
  await expect(page.locator('#lordPay')).toHaveCount(0); // once
  await expect(card.locator('[data-ask="ride"]')).toBeDisabled(); // his word given
  await press(page, '#lordAskClose');
  await expect(page.locator('#realmScreen .lordAskCard')).toHaveCount(0);
});

test('Lords: a petition from a lord, accepted at the top of the Lords tab', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: Lord Serlo, who minds the coin, asks for a loan.
  await game(page, (CL) => {
    const c = CL.campaign;
    c.gold = 500;
    CL.nobles.openPetition(c, Object.keys(c.people).find((id) => c.people[id].key === 'serlo_fernby'));
  });
  await lordsTab(page);
  const card = page.locator('#realmScreen .petitionCard');
  await expect(card).toHaveAttribute('data-petition', 'loan');
  await expect(card.locator('h3')).toHaveText('A petition from Lord Serlo Fernby');
  await expect(card).toContainText('Lend him 100 crowns, to be repaid 130 in 14 days.');
  await press(page, '#petitionAccept');
  await expect(page.locator('#realmScreen .petitionCard')).toHaveCount(0);
  expect(await game(page, (CL) => CL.campaign.gold)).toBe(400);
  expect(await game(page, (CL) => CL.campaign.nobles.debts.map((d) => [d.kind, d.amount]))).toEqual([['loan', 130]]);
});

test('Lords: P9-L1 a lord short of coin asks you to escort her caravan; accepted, it is your contract', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: Lady Hawise, her fief's treasury empty, petitions you.
  const want = await game(page, (CL) => {
    const c = CL.campaign;
    const hawise = Object.keys(c.people).find((id) => c.people[id].key === 'hawise_greymantle');
    for (const sid of CL.realm.fiefsOf(hawise, c)) c.holdings[sid].treasury = 0;
    const x = CL.nobles.openPetition(c, hawise);
    return { kind: x.kind, to: CL.content.get('settlements', x.to).name, amount: x.amount };
  });
  expect(want.kind).toBe('escort');
  await lordsTab(page);
  const card = page.locator('#realmScreen .petitionCard');
  await expect(card).toHaveAttribute('data-petition', 'escort');
  await expect(card).toContainText(new RegExp(`Escort her caravan from .+ to ${want.to}, for ${want.amount} crowns[.]`));
  await press(page, '#petitionAccept');
  await expect(page.locator('#message')).toContainText(`${want.amount} crowns on arrival`);
  expect(await game(page, (CL) => [CL.campaign.contract?.reward.gold, CL.contracts.summary()])).toEqual([want.amount, expect.stringMatching(new RegExp(`^escort to ${want.to}`))]);
});

test('P9-04: a rising in your realm: summoned by both sides on the Allegiance tab, you choose one', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign; // test setup: a vassal of Valedorn, three of whose lords rise against the king
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
    const ruler = CL.realm.rulerOf('valedorn', c);
    const lords = CL.lords.riders(c).filter((p) => c.people[p].realm === 'valedorn').slice(0, 3);
    for (const a of lords) {
      for (let i = 0; i < 3; i++) CL.nobles.note(c, a, ruler, 'abandoned', { kin: false });
      for (const b of lords) if (a !== b) for (let i = 0; i < 2; i++) CL.nobles.note(c, a, b, 'helped', { kin: false });
    }
    const x = CL.rebellion.form(c, 'valedorn');
    x.stage = 'demands';
    CL.rebellion.refuse(c, x.id);
  });
  await toMap(page);
  await press(page, '#journalBtn');
  await waitMode(page, 'journal');
  await press(page, '#journalRealmBtn');
  await waitMode(page, 'realm');
  await press(page, '#realmScreen [data-tab="allegiance"]');
  const card = page.locator('#realmScreen .risingCard');
  await expect(card.locator('h3')).toHaveText('Civil war: both sides summon you');
  await expect(card).toContainText('Civil war:');
  await press(page, card.locator('button', { hasText: 'Ride with the rising' }));
  await expect(page.locator('#realmScreen .risingCard')).toHaveCount(0);
  const sworn = await game(page, (CL) => ({ realm: CL.allegiance.sworn(CL.campaign), rising: CL.campaign.rebellions.list[0].rising }));
  expect(sworn.realm).toBe(sworn.rising);
});
