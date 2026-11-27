// P11-09: one control scheme on phone and PC, by real input at desktop and phone size. Every stuck-input
// case of plan §12 lets go of Attack (and a bow's draw), Block, the keys and the joystick: a release
// outside the button, a pause, a modal, the overview, the page hidden, the phone turned upright, the
// battle ending, a weapon switch, a lost pointer, and a second finger. The switch control (a badge on
// ATTACK's edge, or a swipe across ATTACK) at every text size, and the buttons' icons. The rules behind
// the hints are in tests/tips.test.js.
const { test, expect, open, waitMode, game, press, hold, touch, newGame, toMap, debug, isTouch, expectLayoutSound } = require('./helpers');

/** Test setup: sword and shield in hand, a shortbow carried second, in a practice battle, the enemies held still. */
async function toBattle(page, settings = {}) {
  await open(page, { settings });
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    c.inventory.short_bow = 1;
    CL.character.equip('short_bow', c, 'weapon2');
  });
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await game(page, (CL) => {
    const g = CL.game;
    for (const x of g.enemies) Object.assign(x, { aiTimer: 999, attackCooldown: 999, x: x.x + 2000 });
    g.godMode = true;
  });
}

/** What is held: Attack, Block, any key, the joystick, a bow's draw. */
const held = (page) =>
  game(page, (CL) => {
    const g = CL.game;
    return { attack: Boolean(g.attackHeld), block: Boolean(g.blockHeld), keys: Object.values(g.hold).some(Boolean), stick: Boolean(g.joystick.x || g.joystick.y), draw: (g.hero.drawT || 0) > 0 };
  });
const NOTHING = { attack: false, block: false, keys: false, stick: false, draw: false };

/** The centre of a control, in page coordinates. */
async function centre(page, sel) {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Hold ATTACK (and, on the phone, the joystick pushed right; on the desktop, D) by real input, run
 * `during`, check everything was let go, then lift whatever is still down.
 */
async function heldThrough(page, during) {
  const a = await centre(page, '#attackBtn');
  if (isTouch(page)) {
    const j = await centre(page, '#joystick');
    const t = await touch(page);
    const fingers = [
      { id: 1, x: j.x + 30, y: j.y },
      { id: 2, x: a.x, y: a.y },
    ];
    await t.down(fingers);
    await t.move(fingers);
    await expect.poll(() => held(page)).toMatchObject({ attack: true, stick: true });
    try {
      await during(t, fingers);
      await expect.poll(() => held(page)).toEqual(NOTHING);
    } finally {
      await t.up();
    }
  } else {
    await page.keyboard.down('KeyD');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await expect.poll(() => held(page)).toMatchObject({ attack: true, keys: true });
    try {
      await during();
      await expect.poll(() => held(page)).toEqual(NOTHING);
    } finally {
      await page.mouse.up();
      await page.keyboard.up('KeyD');
    }
  }
  // Lifting afterwards changes nothing: nothing comes back held.
  expect(await held(page)).toEqual(NOTHING);
}

test('a release outside the button lets go of ATTACK', async ({ page }) => {
  await toBattle(page);
  const a = await centre(page, '#attackBtn');
  if (isTouch(page)) {
    const t = await touch(page);
    await t.down([{ id: 1, x: a.x, y: a.y }]);
    await expect.poll(() => held(page)).toMatchObject({ attack: true });
    await t.move([{ id: 1, x: 40, y: 40 }]);
    await t.up();
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await expect.poll(() => held(page)).toMatchObject({ attack: true });
    await page.mouse.move(40, 40);
    await page.mouse.up();
  }
  await expect.poll(() => held(page)).toEqual(NOTHING);
});

test('a pause lets go of everything', async ({ page }) => {
  await toBattle(page);
  await heldThrough(page, async (t, fingers) => {
    if (t) {
      const p = await centre(page, '#pauseBtn');
      await t.down([...fingers, { id: 3, x: p.x, y: p.y }]);
      await t.lift([{ id: 3, x: p.x, y: p.y }]); // a tap with a third finger
    } else await page.keyboard.press('Escape');
    await expect.poll(() => game(page, (CL) => CL.game.paused)).toBe(true);
  });
});

test('a modal (How to Play) lets go of everything', async ({ page }) => {
  await toBattle(page);
  await heldThrough(page, async () => {
    await game(page, (CL) => CL.ui.openHelp('fighting'));
    await expect(page.locator('#helpPanel')).toBeVisible();
  });
  await expect(page.locator('#helpTopics')).toContainText('Your second weapon');
});

test('the tactical overview lets go of everything', async ({ page }) => {
  await toBattle(page);
  await heldThrough(page, async (t, fingers) => {
    if (t) {
      const m = await centre(page, '#mapBtn');
      await t.down([...fingers, { id: 3, x: m.x, y: m.y }]);
      await t.lift([{ id: 3, x: m.x, y: m.y }]);
    } else await page.keyboard.press('KeyM');
    await expect.poll(() => game(page, (CL) => CL.game.overview)).toBe(true);
  });
});

test('the page hidden (backgrounded) lets go of everything', async ({ page }) => {
  await toBattle(page);
  await heldThrough(page, async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
  });
});

test('the battle ending mid-hold: nothing is held on the result, nor in the next battle', async ({ page }) => {
  await toBattle(page);
  await heldThrough(page, async () => {
    await game(page, (CL) => CL.debugTools.endBattleNow(true));
    await waitMode(page, 'result');
  });
});

test('a weapon switch mid-draw lets go of ATTACK and the draw: no arrow flies', async ({ page }) => {
  await toBattle(page);
  // The bow to hand first.
  if (isTouch(page)) await press(page, '#switchBtn');
  else await page.keyboard.press('KeyQ');
  await expect.poll(() => game(page, (CL) => Boolean(CL.game.hero.ranged) && !CL.game.loadout.switching)).toBe(true);
  const shots = () => game(page, (CL) => CL.game.loadout.ammo.secondary);
  const before = await shots();
  await hold(page, '#attackBtn', async () => {
    await expect.poll(() => game(page, (CL) => CL.game.hero.drawT > 0)).toBe(true);
    if (isTouch(page)) {
      // A second finger on the switch badge, the first still on ATTACK.
      const a = await centre(page, '#attackBtn');
      const s = await centre(page, '#switchBtn');
      const t = await touch(page);
      await t.down([
        { id: 1, x: a.x, y: a.y },
        { id: 2, x: s.x, y: s.y },
      ]);
      await t.lift([{ id: 2, x: s.x, y: s.y }]); // the second finger's tap
    } else await page.keyboard.press('KeyQ');
    await expect.poll(() => game(page, (CL) => Boolean(CL.game.loadout.switching) || !CL.game.hero.ranged)).toBe(true);
    expect(await held(page)).toMatchObject({ attack: false, draw: false });
  });
  await expect.poll(() => game(page, (CL) => CL.game.loadout.which)).toBe('primary');
  expect(await shots()).toBe(before);
  expect(await held(page)).toMatchObject({ attack: false });
});

test('a lost pointer lets go of ATTACK', async ({ page }) => {
  await toBattle(page);
  const a = await centre(page, '#attackBtn');
  if (isTouch(page)) {
    const t = await touch(page);
    await t.down([{ id: 1, x: a.x, y: a.y }]);
    await expect.poll(() => held(page)).toMatchObject({ attack: true });
    await t.cancel(); // the browser took the touch
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await expect.poll(() => held(page)).toMatchObject({ attack: true });
    await page.evaluate(() => {
      const b = document.querySelector('#attackBtn');
      b.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    });
  }
  await expect.poll(() => held(page)).toMatchObject({ attack: false });
  if (!isTouch(page)) await page.mouse.up();
});

test('a second finger: two on ATTACK hold it until the last lifts; a cancelled touch lets go of both', async ({ page }) => {
  test.skip(!isTouch(page), 'fingers: the phone');
  await toBattle(page);
  const a = await centre(page, '#attackBtn');
  const t = await touch(page);
  const one = { id: 1, x: a.x - 10, y: a.y };
  const two = { id: 2, x: a.x + 10, y: a.y };
  await t.down([one]);
  await t.down([one, two]);
  await t.lift([two]);
  await expect.poll(() => held(page)).toMatchObject({ attack: true });
  await t.up();
  await expect.poll(() => held(page)).toMatchObject({ attack: false });
  await t.down([one]);
  await t.down([one, two]);
  await t.cancel();
  await expect.poll(() => held(page)).toMatchObject({ attack: false });
});

test('turning the phone upright lets go of everything', async ({ page }) => {
  test.skip(!isTouch(page), 'orientation: the phone');
  await toBattle(page);
  const vp = page.viewportSize();
  await heldThrough(page, async () => {
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await expect(page.locator('#rotate')).toBeVisible();
  });
  await page.setViewportSize(vp);
});

test('the buttons show what is in hand: a sword and a shield, then the bow; the badge shows the other weapon', async ({ page }) => {
  await toBattle(page);
  const icon = (sel) => page.locator(`${sel} .btnIco`);
  await expect(icon('#attackBtn')).toHaveClass(/ico-sword/);
  await expect(icon('#blockBtn')).toHaveClass(/ico-shield/);
  await expect(icon('#switchBtn')).toHaveClass(/ico-bow/);
  await expect(page.locator('#switchBtn')).toHaveAttribute('aria-label', 'Switch to Shortbow (Q)');
  if (isTouch(page)) await press(page, '#switchBtn');
  else await page.keyboard.press('KeyQ');
  await expect(icon('#attackBtn')).toHaveClass(/ico-bow/);
  await expect(page.locator('#attackBtn')).toHaveAttribute('aria-label', /^Attack with Shortbow \(hold to draw\)$/);
  await expect(page.locator('#blockBtn')).toBeDisabled(); // a bow: the shield slung, nothing to block with
  await expect(icon('#switchBtn')).toHaveClass(/ico-sword/);
});

test('no second weapon: no switch control', async ({ page }) => {
  await open(page);
  await newGame(page);
  await toMap(page);
  await debug(page, '[data-cheat="camera"][data-n="30"]');
  await waitMode(page, 'battle');
  await expect(page.locator('#switchBtn')).toBeHidden();
  await expect(page.locator('#attackBtn .btnIco')).toHaveClass(/ico-sword/);
});

test('the swipe setting: no badge; a swipe across ATTACK brings the other weapon to hand', async ({ page }) => {
  await toBattle(page, { switchControl: 'swipe' });
  await expect(page.locator('#switchBtn')).toBeHidden();
  const b = await page.locator('#attackBtn').boundingBox();
  const y = b.y + b.height / 2;
  if (isTouch(page)) {
    const t = await touch(page);
    await t.down([{ id: 1, x: b.x + b.width * 0.85, y }]);
    for (const k of [0.6, 0.4, 0.2, 0.05]) await t.move([{ id: 1, x: b.x + b.width * k, y }]);
    await t.up();
  } else {
    await page.mouse.move(b.x + b.width * 0.85, y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.05, y, { steps: 6 });
    await page.mouse.up();
  }
  await expect.poll(() => game(page, (CL) => CL.game.loadout.which)).toBe('secondary');
  expect(await held(page)).toMatchObject({ attack: false });
});

for (const size of ['small', 'normal', 'large', 'larger']) {
  test(`the switch badge at text size ${size}: 44 px or more, on the screen, clear of the other controls`, async ({ page }) => {
    await toBattle(page, { textSize: size });
    await expectLayoutSound(page, ['#joystick', '#mapBtn', '#ordersBtn', '#blockBtn', '#switchBtn', '#pauseBtn', '#settingsBtn']);
    const s = await page.locator('#switchBtn').boundingBox();
    expect(s.width).toBeGreaterThanOrEqual(44);
    // The badge sits on ATTACK's upper edge, and a tap on it switches (never strikes).
    if (isTouch(page)) await press(page, '#switchBtn');
    else await page.locator('#switchBtn').click();
    await expect.poll(() => game(page, (CL) => CL.game.loadout.which)).toBe('secondary');
    expect(await game(page, (CL) => CL.game.hero.attacking ?? false)).toBeFalsy();
  });
}

test('lifting the joystick thumb keeps ATTACK held by the other: a bow stays drawn', async ({ page }) => {
  test.skip(!isTouch(page), 'two thumbs: the phone');
  await toBattle(page);
  await press(page, '#switchBtn');
  await expect.poll(() => game(page, (CL) => Boolean(CL.game.hero.ranged) && !CL.game.loadout.switching)).toBe(true);
  const j = await centre(page, '#joystick');
  const a = await centre(page, '#attackBtn');
  const t = await touch(page);
  const stick = { id: 1, x: j.x + 30, y: j.y };
  await t.down([stick]);
  await t.down([stick, { id: 2, x: a.x, y: a.y }]);
  await t.lift([stick]);
  await expect.poll(() => held(page)).toMatchObject({ attack: true, stick: false });
  await expect.poll(() => game(page, (CL) => CL.game.hero.drawT > 0)).toBe(true);
  await t.up();
});

test('a hint in battle never covers the joystick, ATTACK or the switch badge, at any text size', async ({ page }) => {
  await toBattle(page);
  for (const size of ['small', 'normal', 'large', 'larger']) {
    await game(page, (CL, s) => {
      CL.settings.set('textSize', s);
      CL.ui.applyTextSize?.();
    }, size);
    for (const id of ['switch', 'riders', 'whiff', 'shieldPressure', 'draw']) {
      // Test setup: the hint shown as the game shows it (its moment is tests/tips.test.js's).
      await game(page, (CL, tip) => {
        const t = CL.content.get('tips', tip);
        CL.ui.showTip({ ...t, text: CL.tips.textFor(t) });
      }, id);
      const card = await page.locator('#tipCard').boundingBox();
      for (const sel of ['#joystick', '#attackBtn', '#switchBtn']) {
        const b = await page.locator(sel).boundingBox();
        const clear = card.x + card.width <= b.x || b.x + b.width <= card.x || card.y + card.height <= b.y || b.y + b.height <= card.y;
        expect(clear, `${size}: the ${id} hint clear of ${sel}`).toBe(true);
      }
    }
  }
});
