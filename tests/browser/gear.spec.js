// P11-02: carried and wielded, by real input at desktop and phone size: carry a second weapon from the
// pack, read the gear check's finding on the sheet and in the armoury, choose the loadout a battle
// starts with, buy a piece the check warns about only after a second tap, and switch weapons in battle
// (Q on the desktop, the SWITCH button on the phone). The rules are in tests/gear.test.js.
// The game sells no two-handed weapon yet (P11-04 onward): a test greatsword is added as test setup
// (needing nothing, over its family's requirement). P11-03: a requirement's line, with what it needs,
// what you have and how to get there; the piece kept, and met by spending a point.
const { test, expect, open, waitMode, game, press, newGame, toMap, debug, isTouch } = require('./helpers');

/** Test setup: a two-handed sword the armoury sells, one in the pack, and a shield worn. */
async function withGreatsword(page) {
  await game(page, (CL) => {
    const items = CL.content.table('items');
    items.test_greatsword = { id: 'test_greatsword', name: 'Test Greatsword', type: 'weapon', slot: 'weapon', family: 'greatsword', tier: 2, rarity: 'uncommon', value: 120, weight: 4, stats: { damage: 28 }, req: {}, questItem: false };
    const s = CL.content.table('settlements')[CL.campaign.world.location];
    s.gear = [...(s.gear || []), 'test_greatsword'];
    CL.campaign.inventory.test_greatsword = 1;
    CL.campaign.equipment.offhand = 'oak_shield';
    CL.campaign.gold = 2000;
  });
}

test('the sheet: carry a second weapon, read what it means, choose the one a battle starts with', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withGreatsword(page);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const row = page.locator('#sheetPack li', { hasText: 'Test Greatsword' });
  await expect(row.locator('.compare')).toContainText('more damage');
  await expect(row.locator('.compare')).toContainText('both hands');
  await expect(row.locator('.finding')).toContainText('needs both hands: your Oak Shield will be slung on your back');
  await press(page, row.locator('button', { hasText: 'Carry second' }));
  expect(await game(page, (CL) => CL.campaign.equipment.weapon2)).toBe('test_greatsword');
  const equip = page.locator('#sheetEquip');
  await expect(equip).toContainText('Second weapon: Test Greatsword');
  const findings = page.locator('#sheetFindings');
  await expect(findings.locator('.finding')).toContainText('needs both hands');
  await expect(findings.locator('.finding .findingMark')).toHaveText('i'); // a mark, never colour alone
  await expect(equip.locator('.loadoutRow')).toContainText('Battles start with your first weapon');
  await press(page, equip.locator('button', { hasText: 'Start with second weapon' }));
  expect(await game(page, (CL) => CL.campaign.loadout.start)).toBe('secondary');
  await expect(equip.locator('.loadoutRow')).toContainText('Battles start with your second weapon: Test Greatsword (Oak Shield slung)');
  await press(page, equip.locator('button', { hasText: 'Swap weapons' }));
  expect(await game(page, (CL) => [CL.campaign.equipment.weapon, CL.campaign.loadout.start])).toEqual(['test_greatsword', 'secondary']);
  // A finding fits its row (two lines at most) on the phone.
  await findings.locator('.finding').first().scrollIntoViewIfNeeded();
  const box = await findings.locator('.finding').first().boundingBox();
  const line = await findings.locator('.finding').first().evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect(box.height).toBeLessThanOrEqual(line * 2 + 4);
});

test('the armoury: the finding before you buy; a piece you could not use needs a second tap', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withGreatsword(page);
  await press(page, '#tradeBtn');
  await waitMode(page, 'trade');
  const row = page.locator('#tradeArmoury li', { hasText: 'Test Greatsword' });
  await expect(row.locator('.finding')).toContainText('needs both hands');
  // A note never stops a purchase: one tap buys.
  const before = await game(page, (CL) => CL.campaign.inventory.test_greatsword || 0);
  await press(page, row.locator('button'));
  expect(await game(page, (CL) => CL.campaign.inventory.test_greatsword)).toBe(before + 1);
  // Test setup: no piece the game sells can't be used yet (requirements come in P11-03), so the check
  // is told one can't, to see the confirmation the player would.
  await game(page, (CL) => {
    const real = CL.gear.checkItem;
    CL.gear.checkItem = (c, id, ctx) => (id === 'test_greatsword' ? [{ kind: 'incompatible', code: 'mounted', item: id, text: 'The Test Greatsword can’t be used from horseback.', have: null, need: null, fix: null }] : real(c, id, ctx));
    CL.ui.refresh();
  });
  const n = await game(page, (CL) => CL.campaign.inventory.test_greatsword);
  const buy = page.locator('#tradeArmoury li', { hasText: 'Test Greatsword' }).locator('button');
  await press(page, buy);
  await expect(buy).toHaveText(/^Buy anyway · /);
  await expect(page.locator('#message')).toContainText('can’t be used from horseback. Tap again to buy it.');
  expect(await game(page, (CL) => CL.campaign.inventory.test_greatsword)).toBe(n);
  await press(page, buy);
  expect(await game(page, (CL) => CL.campaign.inventory.test_greatsword)).toBe(n + 1);
});

/** Test setup: the Knight's Sword (One-Handed 3) in the pack and the armoury, One-Handed at 0. */
async function withKnightsSword(page) {
  await game(page, (CL) => {
    const c = CL.campaign;
    c.character.skills.one_handed = 0;
    c.character.skillPoints = 0;
    c.inventory.knights_sword = 1;
    c.gold = 2000;
    const s = CL.content.table('settlements')[c.world.location];
    s.gear = [...new Set([...(s.gear || []), 'knights_sword'])];
  });
}

test('a requirement in the armoury: what it needs, what you have, how to get there', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withKnightsSword(page);
  await press(page, '#tradeBtn');
  await waitMode(page, 'trade');
  const offer = page.locator('#tradeArmoury li', { hasText: "Knight's Sword" });
  await expect(offer.locator('.finding')).toContainText("needs One-Handed 3; you have 0. More points come as you level.");
  await expect(offer.locator('.finding .findingMark')).toHaveText('🔒');
});

test('a requirement on the sheet: kept though not met, what points would unlock, a point meets it', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withKnightsSword(page);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const row = page.locator('#sheetPack li', { hasText: "Knight's Sword" });
  await press(page, row.locator('button', { hasText: 'Equip' }));
  const findings = page.locator('#sheetFindings');
  await expect(findings.locator('.finding')).toHaveCount(1);
  await expect(findings.locator('.finding')).toContainText("The Knight's Sword needs One-Handed 3; you have 0.");
  expect(await game(page, (CL) => CL.campaign.equipment.weapon)).toBe('knights_sword'); // kept, though not met
  // A finding fits its row (two lines at most) on the phone.
  const box = await findings.locator('.finding').boundingBox();
  const lh = await findings.locator('.finding').evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect(box.height).toBeLessThanOrEqual(lh * 2 + 4);
  // Three points to spend: the sheet names what they'd unlock; spending them meets it.
  await game(page, (CL) => {
    CL.campaign.character.skillPoints = 3;
    CL.ui.refresh();
  });
  await expect(page.locator('#sheetStats')).toContainText("Your points would unlock: Knight's Sword (One-Handed 3)");
  await expect(findings.locator('.finding')).toContainText('Spend 3 skill points on it.');
  for (let i = 0; i < 3; i++) await press(page, page.locator('#sheetStats button[aria-label^="Raise One-Handed"]'));
  await expect(findings.locator('.finding')).toHaveCount(0);
  await expect(page.locator('#sheetStats')).not.toContainText('Your points would unlock');
  // What each skill does, folded away.
  await press(page, page.locator('#sheetStats .statHelp summary'));
  await expect(page.locator('#sheetStats .statHelp')).toContainText('Two-Handed: +3% damage and a little quicker recovery');
});

test('P11-06: the sheet shows the load in words and a bar; heavy gear says so', async ({ page }) => {
  await open(page);
  await newGame(page);
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const load = page.locator('#sheetStats .loadStat');
  await expect(load).toContainText(/Load\s*6 \/ 1\d · light/);
  await expect(load.locator('.loadBar')).toHaveAttribute('aria-label', /^Load 6 of 1\d, light$/);
  // Test setup: a heavy kit (what it needs, met).
  await game(page, (CL) => {
    const c = CL.campaign;
    c.character.attributes.str = 7;
    c.character.skills.shield = 2;
    Object.assign(c.equipment, { weapon: 'arming_sword', offhand: 'heater_shield', head: 'iron_helm', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves' });
    CL.ui.refresh();
  });
  await expect(load).toContainText('heavy: slower');
  await expect(page.locator('#sheetFindings')).toContainText('Your gear is heavy (18 of 14): you move and recover slower.');
});

test('in battle: SWITCH (Q) brings the second weapon to hand, the shield slung, and back', async ({ page }) => {
  await open(page);
  await newGame(page);
  await withGreatsword(page);
  await game(page, (CL) => CL.character.equip('test_greatsword', CL.campaign, 'weapon2'));
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  const sw = page.locator('#switchBtn');
  await expect(sw).toBeVisible();
  await expect(sw).toHaveAttribute('aria-label', 'Switch to Test Greatsword (Q)');
  await expect(page.locator('#blockBtn')).toBeEnabled();
  const state = () => game(page, (CL) => ({ which: CL.game.loadout.which, family: CL.game.hero.profile.family, block: CL.game.hero.canBlock, guard: CL.game.hero.guardKind, switching: Boolean(CL.game.loadout.switching) }));
  if (isTouch(page)) await press(page, sw);
  else await page.keyboard.press('KeyQ');
  await expect.poll(state).toEqual({ which: 'secondary', family: 'greatsword', block: false, guard: 'weapon', switching: false });
  await expect(page.locator('#blockBtn')).toBeEnabled(); // P11-05: both hands: no shield, but the weapon guards
  await expect(sw).toHaveAttribute('aria-label', /^Switch to /);
  if (isTouch(page)) await press(page, sw);
  else await page.keyboard.press('KeyQ');
  await expect.poll(state).toEqual({ which: 'primary', family: await game(page, (CL) => CL.content.item(CL.campaign.equipment.weapon).family), block: true, guard: 'shield', switching: false });
  await expect(page.locator('#blockBtn')).toBeEnabled();
});

test('regional arms in two town armouries and on the Arbalester’s card', async ({ page }, info) => {
  await open(page);
  await newGame(page);
  for (const { town, item, finding } of [
    { town: 'hrothgard', item: 'Hrothmark Longaxe', finding: 'needs a master’s training' },
    { town: 'vessara', item: 'League Arbalest', finding: 'needs Strength 8' },
  ]) {
    await game(page, (CL, sid) => {
      CL.campaign.world.location = sid;
      CL.town.enterPlace();
    }, town);
    await waitMode(page, 'settlement');
    await press(page, '#tradeBtn');
    await waitMode(page, 'trade');
    const row = page.locator('#tradeArmoury li', { hasText: item });
    await row.scrollIntoViewIfNeeded();
    await expect(row.getByText('Made here')).toBeVisible();
    await expect(row.getByText(finding, { exact: false })).toBeVisible();
    if (town === 'vessara') {
      await expect(row.getByText('reloads while standing still', { exact: false })).toBeVisible();
      if (isTouch(page)) await page.screenshot({ path: info.outputPath('vessara-armoury.png') });
    }
    await press(page, '#primaryBtn');
  }
  await game(page, (CL) => CL.save.addSoldier(CL.campaign, 'arbalester'));
  await press(page, '#gearBtn');
  await waitMode(page, 'character');
  const soldier = page.locator('.soldierRow', { hasText: 'Arbalester' });
  await press(page, soldier);
  const card = page.locator('.soldierCard');
  const link = card.getByRole('button', { name: 'League Arbalest', exact: true });
  await press(page, link);
  await expect(link).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByText('Sold at Vessara.')).toBeVisible();
});
