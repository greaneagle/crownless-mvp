// P7-09: a tournament bout, by real input at desktop and phone size (a touch tap on the phone): enter
// the lists at Stonebridge, fight the first bout with the ATTACK button (no orders in a duel), and come
// back to the town with the bracket moved on. (The rules, anti-farm and gear safety are in
// tests/tourney.test.js.)
const { test, expect, open, waitMode, game, press, newGame, isTouch } = require('./helpers');

test('Tournament: enter the lists, win a bout with ATTACK, and the bracket moves on', async ({ page }) => {
  await open(page);
  await newGame(page);
  // Test setup: the company in Stonebridge with crowns, and a tournament called there today.
  await game(page, (CL) => {
    const c = CL.campaign;
    const s = CL.content.get('settlements', 'stonebridge');
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
    c.gold = 300;
    c.tourney.hosts.stonebridge.next = c.day;
    CL.tourney.tick(c);
    CL.ui.refreshRoster();
  });
  const card = page.locator('#tourneyHere .tourney');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText(/^Tournament at Stonebridge · entries close day \d+/);
  await expect(card).toContainText('Champion: 150 crowns and 5 renown');
  const box = await card.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await press(page, '#tourneyEnter');
  await expect(card).toHaveAttribute('data-tourney', 'bracket');
  await expect(card).toContainText('You fight in tournament gear; your own stays in your pack.');
  const own = await game(page, (CL) => JSON.stringify(CL.campaign.equipment));
  await press(page, '#tourneyFight');
  await waitMode(page, 'battle');
  await expect(page.locator('#attackBtn')).toBeVisible();
  await expect(page.locator('#ordersBtn')).toBeHidden();
  // Test setup: a weary first opponent, brought close, so a few blows decide it. P10-00: too weary to
  // raise a shield (a guarded blow does nothing, and the bout was sometimes lost: "BOUT LOST").
  await game(page, (CL) => {
    CL.groups.shouldGuard = () => false;
    const [e] = CL.game.enemies;
    const h = CL.game.hero;
    Object.assign(e, { hp: 1, x: h.x + 34, y: h.y });
    h.face = 'right';
  });
  for (let i = 0; i < 30 && (await game(page, (CL) => CL.game.mode)) === 'battle'; i++) {
    await game(page, (CL) => Object.assign(CL.game.enemies[0], { x: CL.game.hero.x + 34, y: CL.game.hero.y }));
    // P10-00: the bout can end between the check above and this blow; the result screen then covers
    // ATTACK, so a blow that cannot land is skipped instead of waiting out the test.
    const attack = page.locator('#attackBtn');
    await (isTouch(page) ? attack.tap({ timeout: 2000 }) : attack.click({ timeout: 2000 })).catch(() => {});
    await page.waitForTimeout(250);
  }
  await waitMode(page, 'result');
  await expect(page.locator('#overlayTitle')).toHaveText('BOUT WON');
  await expect(page.locator('#result')).toContainText(/^You beat .+ in the first bout\. Next, the semi-final: /);
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  await expect(card).toContainText(/the semi-final/);
  expect(await game(page, (CL) => ({ round: CL.campaign.tourney.bracket.round, gear: JSON.stringify(CL.campaign.equipment) }))).toEqual({ round: 1, gear: own });
});
