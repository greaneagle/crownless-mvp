// The experimental graphics demo (Debug → Graphics Demo — New Art Direction; js/gfx/). Opened from the
// Debug panel, played with real input through its three scenes, and closed again: the campaign, the
// save and every other stored key must come back exactly as they were, whatever happens inside.
// Moving pieces into place (a band onto the party, a battle won at once) is test setup; the controls
// under test (taps, keys, the stick, the demo's buttons) are pressed for real.
const { test, expect, open, waitMode, game, press, pressAt, hold, touch, isTouch, newGame, toMap, debug } = require('./helpers');

/** Every stored key and its text (the save, its backup, settings, tips seen, ...). */
const storage = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));

/** A new game on the map, its save written, and the demo opened from the Debug panel. */
async function toDemo(page) {
  await open(page);
  await newGame(page);
  await toMap(page);
  const before = { storage: await storage(page), campaign: await game(page, (CL) => JSON.stringify(CL.campaign)), mode: 'map' };
  await debug(page, '[data-cheat="gfxDemo"]');
  await page.waitForFunction(() => window.Crownless.gfxDemo?.active === true);
  await expect(page.locator('#gfxCanvas')).toBeVisible();
  return before;
}

/** Page coordinates of a point in the demo's 960×540 frame. */
async function demoToPage(page, x, y) {
  const b = await page.locator('#gfxCanvas').boundingBox();
  return { x: b.x + (x * b.width) / 960, y: b.y + (y * b.height) / 540 };
}

/** Where a map point is on the page, through the demo map's camera. */
async function mapPointOnPage(page, mx, my) {
  const [x, y] = await game(page, (CL, [px, py]) => {
    const c = CL.gfxDemo.state.map.cam;
    return [(px - c.x) * c.zoom, (py - c.y) * c.zoom];
  }, [mx, my]);
  return demoToPage(page, x, y);
}

async function expectRestored(page, before) {
  await page.waitForFunction(() => !window.Crownless.gfxDemo.active);
  await expect(page.locator('#gfxCanvas')).toHaveCount(0);
  await expect(page.locator('#gfxUi')).toHaveCount(0);
  await expect(page.locator('#gfxCss')).toHaveCount(0);
  const after = await game(page, (CL) => ({ mode: CL.game.mode, campaign: JSON.stringify(CL.campaign), listeners: CL.gfxDemo.listenerCount(), stage: document.querySelector('#stage').dataset.gfxdemo ?? null }));
  expect(after.mode).toBe(before.mode);
  expect(after.campaign).toBe(before.campaign);
  expect(after.listeners).toBe(0);
  expect(after.stage).toBeNull();
  expect(await storage(page)).toEqual(before.storage);
}

test('normal play never loads the demo, and saves as before', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  const r = await game(page, (CL) => ({ scripts: [...document.scripts].filter((s) => s.src.includes('/js/gfx/')).length, demo: typeof CL.gfxDemo, css: Boolean(document.querySelector('#gfxCss')), saved: CL.save.write() }));
  expect(r).toEqual({ scripts: 0, demo: 'undefined', css: false, saved: true });
  await expect(page.locator('#cheatPanel [data-cheat="gfxDemo"]')).toHaveText('Graphics Demo — New Art Direction');
});

test('the demo: travel the map, walk and talk in the city, fight, and exit to the game exactly as it was', async ({ page }) => {
  test.setTimeout(90_000);
  const before = await toDemo(page);
  expect(await game(page, (CL) => CL.gfxDemo.scene)).toBe('map');
  await expect(page.locator('#game')).toBeHidden();

  // The map: a tap on Stonebridge sets a route; on arrival the city can be entered.
  const sb = await game(page, (CL) => CL.gfx.scenes.map.PLACES.stonebridge);
  const at = await mapPointOnPage(page, sb.x, sb.y);
  await pressAt(page, at.x, at.y);
  expect(await game(page, (CL) => CL.gfxDemo.state.map.player.path?.length || 0)).toBeGreaterThan(0);
  await expect(page.locator('#gfxEnterCity')).toBeVisible({ timeout: 20_000 });
  await press(page, '#gfxEnterCity');
  await page.waitForFunction(() => window.Crownless.gfxDemo.scene === 'city');

  // The city: walk north (keys on desktop, the stick on the phone); walls and buildings stop the hero.
  const y0 = await game(page, (CL) => CL.gfxDemo.state.city.hero.y);
  if (isTouch(page)) {
    const j = await page.locator('#joystick').boundingBox();
    const t = await touch(page);
    await t.down([{ id: 1, x: j.x + j.width / 2, y: j.y + j.height / 2 }]);
    await t.move([{ id: 1, x: j.x + j.width / 2, y: j.y }]);
    await page.waitForTimeout(700);
    await t.up();
  } else {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
  }
  const y1 = await game(page, (CL) => CL.gfxDemo.state.city.hero.y);
  expect(y1).toBeLessThan(y0 - 40);
  // Talk: a tap on the gate guard walks over and opens what they say.
  const guard = await game(page, (CL) => {
    const C = CL.gfxDemo.state.city;
    const p = C.people.find((q) => q.id === 'guard1');
    return [(p.x - C.cam.x) * C.cam.zoom, (p.y - 18 - C.cam.y) * C.cam.zoom];
  });
  const gp = await demoToPage(page, guard[0], guard[1]);
  await pressAt(page, gp.x, gp.y);
  await expect(page.locator('#gfxDialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#gfxDialog b')).toHaveText('Aldo');
  await press(page, page.locator('#gfxDialog button', { hasText: 'Farewell' }));
  await expect(page.locator('#gfxDialog')).toBeHidden();

  // A battle from its shortcut: the game's own combat, with the normal controls.
  await press(page, '[data-gfx-scene="battle"]');
  await page.waitForFunction(() => window.Crownless.game.mode === 'battle');
  const b = await game(page, (CL) => ({ allies: CL.game.allies.length + 1, enemies: CL.game.enemies.length, practice: Boolean(CL.game.practice), map: CL.game.battleMap.id }));
  expect(b.allies + b.enemies).toBeGreaterThanOrEqual(30);
  expect(b).toMatchObject({ practice: true, map: 'gfx_field' });
  if (isTouch(page)) await hold(page, '#attackBtn', () => page.waitForTimeout(250));
  else await page.keyboard.press('Space');
  await page.waitForFunction(() => window.Crownless.game.hero.attackCooldown > 0 || window.Crownless.game.hero.swing);
  // The old renderer draws the same live battle, for comparison, and back.
  await press(page, '#gfxArt');
  await expect(page.locator('#game')).toBeVisible();
  await press(page, '#gfxArt');
  await expect(page.locator('#game')).toBeHidden();
  await game(page, (CL) => CL.debugTools.endBattleNow(true)); // setup: the battle won at once
  await expect(page.locator('#gfxCard h2')).toHaveText('Victory');
  await press(page, page.locator('#gfxCard button', { hasText: 'Back to the map' }));
  await page.waitForFunction(() => window.Crownless.gfxDemo.scene === 'map');

  // The gallery, Reset, then Exit.
  await press(page, '[data-gfx-scene="gallery"]');
  await press(page, '#gfxReset');
  expect(await game(page, (CL) => CL.gfxDemo.scene)).toBe('gallery');
  await press(page, '#gfxExit');
  await expectRestored(page, before);
  await expect(page.locator('#game')).toBeVisible();
});

test('a hostile band on the map leads to a battle; a defeat ends it too, and nothing is saved', async ({ page }) => {
  test.setTimeout(60_000);
  const before = await toDemo(page);
  // Setup: the Road Reavers step onto the party.
  await game(page, (CL) => {
    const M = CL.gfxDemo.state.map;
    const q = M.parties.find((p) => p.id === 'reavers');
    Object.assign(q, { x: M.player.x + 10, y: M.player.y });
  });
  await expect(page.locator('#gfxCard h2')).toHaveText('Road Reavers');
  await press(page, page.locator('#gfxCard button', { hasText: 'Fight' }));
  await page.waitForFunction(() => window.Crownless.game.mode === 'battle');
  expect(await game(page, (CL) => CL.game.enemies.some((u) => u.troop === 'reaver'))).toBe(true);
  await game(page, (CL) => CL.debugTools.endBattleNow(false));
  await expect(page.locator('#gfxCard h2')).toHaveText('Defeat');
  expect(await storage(page)).toEqual(before.storage);
  await press(page, '#gfxExit');
  await expectRestored(page, before);
});

test('hiding the page, an autosave and a reload during the demo never write the save', async ({ page }) => {
  const before = await toDemo(page);
  await press(page, '[data-gfx-scene="city"]');
  // The page hides (as a phone does on switching apps): the game's own handler tries to save.
  const r = await game(page, (CL) => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    delete document.hidden;
    return { write: CL.save.write(), autosave: CL.save.autosave() };
  });
  expect(r).toEqual({ write: false, autosave: false });
  expect(await storage(page)).toEqual(before.storage);
  // Reloading in the middle: the game boots on the real save, untouched, with no demo running.
  await page.reload();
  await waitMode(page, 'title');
  expect(await storage(page)).toEqual(before.storage);
  expect(await game(page, (CL) => ({ demo: typeof CL.gfxDemo, name: CL.campaign.character?.name }))).toEqual({ demo: 'undefined', name: 'Tester' });
});

test('entering and leaving again and again leaves nothing behind', async ({ page }) => {
  const before = await toDemo(page);
  await press(page, '#gfxExit');
  await expectRestored(page, before);
  for (const scene of ['city', 'battle']) {
    await debug(page, '[data-cheat="gfxDemo"]');
    await page.waitForFunction(() => window.Crownless.gfxDemo.active);
    await press(page, `[data-gfx-scene="${scene}"]`);
    await page.waitForTimeout(300);
    await press(page, '#gfxExit');
    await expectRestored(page, before);
  }
  const r = await game(page, (CL) => ({ entries: CL.gfxDemo.entries, scripts: [...document.scripts].filter((s) => s.src.includes('/js/gfx/demo.js')).length, cap: CL.combat.BATTLE.activeCap }));
  expect(r.entries).toBe(3);
  expect(r.scripts).toBe(1); // loaded once
  expect(r.cap).toBe(30); // the test device's battle size, put back
  // The game plays on: travel on the map still works after the demo.
  await waitMode(page, 'map');
});
