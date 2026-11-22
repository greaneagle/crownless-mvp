// P9-B1: the battle size from 20 to 150 in Settings, used by the next battle; Debug → Battle benchmark
// and its result screen; a slow battle's offer of a smaller size (W-00's flows, desktop and phone).
const { test, expect, open, waitMode, game, press, newGame, toMap, debug } = require('./helpers');

test('Settings: the battle size goes from 20 to 200, and the next battle uses it', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await press(page, '#settingsBtn');
  await expect(page.locator('#settingsPanel')).toBeVisible();
  const sizes = await page.locator('#setBattleSize option').evaluateAll((os) => os.map((o) => Number(o.value)));
  expect(sizes).toEqual([20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
  await page.locator('#setBattleSize').scrollIntoViewIfNeeded();
  await page.locator('#setBattleSize').selectOption('120');
  expect(await game(page, (CL) => [CL.settings.get('battleSize'), CL.settings.get('battleSizeChosen'), CL.combat.BATTLE.activeCap])).toEqual([120, true, 120]);
  await press(page, '#doneSettings');
  await expect(page.locator('#settingsPanel')).toBeHidden();
  // The next battle (Debug → Stress 150 here: its own soldiers, fought at the setting's size).
  await debug(page, '[data-cheat="soldier"][data-n="5"]');
  await page.evaluate(() => {
    document.querySelector('#cheatCap').value = '120'; // the stress test fights at the panel's size: the same as the setting
  });
  await debug(page, '[data-cheat="stress"][data-n="150"]');
  await waitMode(page, 'battle');
  const field = await game(page, (CL) => ({ cap: CL.combat.BATTLE.activeCap, share: CL.game.allyCap + CL.game.enemyCap, on: 1 + CL.game.allies.length + CL.game.enemies.length, reserve: CL.game.allyReserve.length + CL.game.enemyReserve.length }));
  expect(field.cap).toBe(120);
  expect(field.share).toBe(120);
  expect(field.on).toBeLessThanOrEqual(120);
  expect(field.on).toBeGreaterThan(100);
  expect(field.reserve).toBeGreaterThan(0);
  // Kept on the device after a reload.
  await page.reload();
  await page.waitForFunction(() => window.Crownless?.game?.mode === 'title');
  expect(await game(page, (CL) => CL.settings.get('battleSize'))).toBe(120);
});

test('Debug → Battle benchmark runs every size and reports each on its result screen', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  // Test setup: two sizes of a second each, not six of thirty (the screen and the flow are under test).
  await game(page, (CL) => Object.assign(CL.debugTools.BENCH, { sizes: [40, 150], seconds: 1 }));
  const before = await game(page, (CL) => CL.combat.BATTLE.activeCap);
  await debug(page, '[data-cheat="benchmark"]');
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => CL.combat.BATTLE.activeCap)).toBe(40);
  await waitMode(page, 'result', 60_000);
  await expect(page.locator('#overlayTitle')).toHaveText('BATTLE BENCHMARK');
  const text = await page.locator('#result').innerText();
  expect(text).toMatch(/Largest size at 30 fps or better/);
  expect(text).toMatch(/40 at once/);
  expect(text).toMatch(/150 at once/);
  const rows = await game(page, (CL) => CL.game.result.practice.rows.map((r) => r.cap));
  expect(rows).toEqual([40, 150]);
  expect(await game(page, (CL) => [CL.combat.BATTLE.activeCap, Boolean(CL.game.godMode)])).toEqual([before, false]);
  expect(await game(page, (CL) => CL.diag.events.some((e) => e.msg.startsWith('Battle benchmark: 40:')))).toBe(true);
  await expect(page.locator('#primaryBtn')).toBeVisible();
  await press(page, '#primaryBtn');
  await expect.poll(() => game(page, (CL) => CL.game.mode)).not.toBe('result');
});

test('a battle that ran slowly offers a smaller size once; Use sets it', async ({ page }) => {
  await open(page, { settings: { battleSize: 100, battleSizeChosen: false } });
  // Never chosen: the device's own default (150); at 12 fps of the 30 wanted, the offer is the size
  // cut in proportion, to the step below (60).
  const size = await game(page, (CL) => CL.settings.BATTLE_DEFAULT[matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop']);
  const offer = Math.max(20, Math.floor((size * 12) / 30 / 10) * 10);
  expect(await game(page, (CL) => CL.settings.get('battleSize'))).toBe(size);
  await newGame(page);
  await debug(page, '[data-cheat="soldier"][data-n="5"]');
  await toMap(page);
  // Test setup: a campaign battle (the Captain's Trial, as a new game's first fight), then the frame
  // rate this device would have shown in it: 12 fps for 20 seconds.
  const started = await game(page, (CL) => {
    CL.combat.startBattle('captains_trial');
    return CL.game.mode;
  });
  expect(started).toBe('battle');
  await game(page, (CL) => {
    CL.game.frameTally = { frames: 240, ms: 20000 };
  });
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await expect(page.locator('#slowOffer')).toBeVisible();
  await expect(page.locator('#slowOffer')).toContainText('12 frames a second');
  await expect(page.locator('#slowOfferUse')).toHaveText(`Use ${offer}`);
  expect(await game(page, (CL) => CL.settings.get('battleSize'))).toBe(size);
  await press(page, '#slowOfferUse');
  await expect(page.locator('#slowOffer')).toContainText(`Battle size set to ${offer}`);
  expect(await game(page, (CL) => [CL.settings.get('battleSize'), CL.settings.get('battleSizeChosen')])).toEqual([offer, true]);
});
