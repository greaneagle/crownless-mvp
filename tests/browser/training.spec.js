// P11-17: find the master through a real gear finding, fail and retry, then land the blow in the yard.
const { test, expect, open, waitMode, game, press, newGame } = require('./helpers');

test('armoury lead, one paid lesson, a failed practice bout and a successful retry', async ({ page }) => {
  await open(page);
  await newGame(page);
  await game(page, (CL) => {
    const c = CL.campaign;
    c.gold = 300;
    c.character.attributes.str = 8;
    c.character.skills.two_handed = 2;
    c.world.location = 'hrothgard';
    CL.town.enterPlace();
  });
  await press(page, '#tradeBtn');
  await waitMode(page, 'trade');
  const axe = page.locator('#tradeArmoury li', { hasText: 'Hrothmark Longaxe' });
  await expect(axe).toContainText('Master Hrolf teaches it in Hrothgard.');
  await press(page, '#primaryBtn');
  const master = page.getByRole('button', { name: 'Talk to Master Hrolf', exact: true });
  await press(page, master);
  await waitMode(page, 'talk');
  await press(page, page.getByRole('button', { name: 'Ask about the longaxe' }));
  await press(page, page.getByRole('button', { name: /Pay the lesson fee/ }));
  const drill = page.getByRole('button', { name: /Sparring bout/ });
  await press(page, drill);
  await waitMode(page, 'battle');
  await press(page, '#leavePracticeBtn');
  await expect(page.locator('#overlayTitle')).toHaveText('DRILL ENDED');
  await expect(page.locator('#overlayText')).toContainText('Your fee is paid');
  await press(page, '#primaryBtn');
  await press(page, master);
  await expect(drill).toBeDisabled();
  await press(page, page.getByRole('button', { name: /Goodbye/ }));
  await press(page, '#restBtn');
  await press(page, master);
  await expect(drill).toBeEnabled();
  await press(page, drill);
  await waitMode(page, 'battle');
  await game(page, (CL) => {
    const { hero, enemies } = CL.game;
    // The lesson's real opponent is covered by the scripted combat test. Set up one clean hit here.
    Object.assign(enemies[0], { x: hero.x + 34, y: hero.y, hp: 1, speed: 0, reach: 0, canBlock: false, guardKind: 'none' });
    hero.face = 'right';
  });
  await press(page, '#attackBtn');
  await waitMode(page, 'result');
  await expect(page.locator('#overlayText')).toContainText('Training complete');
  expect(await game(page, (CL) => ({
    unlocked: CL.campaign.character.training.longaxe,
    meets: CL.gear.meets(CL.campaign, 'hrothmark_longaxe'),
    paid: CL.campaign.ledger.filter((e) => e.why === 'training: The longaxe').length
  }))).toEqual({ unlocked: true, meets: true, paid: 1 });
  await press(page, '#primaryBtn');
  await press(page, '#placeJournalBtn');
  await expect(page.locator('#journalScreen')).toContainText('The longaxe · Master Hrolf at Hrothgard · Complete');
});

test('a practice bout uses your own weapon and can be left safely', async ({ page }) => {
  await open(page);
  await newGame(page);
  await press(page, page.getByRole('button', { name: 'Practice', exact: true }));
  await press(page, page.getByRole('button', { name: /Spar with a brawler/ }));
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => CL.game.duel.kit.weapon)).toBe(await game(page, (CL) => CL.campaign.equipment.weapon));
  await press(page, '#leavePracticeBtn');
  await press(page, '#primaryBtn');
  await waitMode(page, 'settlement');
  expect(await game(page, (CL) => CL.campaign.chronicle.at(-1).kind)).toBe('practice');
});
