// P11-15: Prepare and the battle report. The hero line (what you fight with, horse or foot, the
// quiver) and a change of it; a finding for this field; the foe as far as the company knows it, and
// unknown when it can't; Fight in two taps; Skip this screen; the report's summary and More.
// Reaching an encounter is test setup (a band put beside the company); every control under test is
// pressed for real.
const { test, expect, open, waitMode, game, press, newGame, toMap, debug } = require('./helpers');

/** A new game on the map with a few soldiers and a second weapon, and a band of 20 beside the company. */
async function toBand(page, { scout = false, horse = false } = {}) {
  await open(page);
  await newGame(page);
  await debug(page, '[data-cheat="soldier"][data-n="5"]');
  await debug(page, '[data-cheat="clearParties"]');
  await toMap(page);
  await game(
    page,
    (CL, o) => {
      const c = CL.campaign;
      c.equipment.weapon2 = 'short_bow';
      if (o.horse) {
        c.equipment.horse = 'rouncey';
        c.character.skills.riding = 1;
      }
      if (o.scout) c.followers.scout = { name: 'Odo', culture: 'valedorn', origin: null, hired: c.day, unpaid: 0, log: [] };
      const p = CL.parties.spawn(c, 'bandits');
      Object.assign(p, { x: c.world.x + 1, y: c.world.y, troops: { reaver: 10, looter: 6, outlaw_huntress: 4 }, tx: null, ty: null });
      CL.parties.open(p.id);
    },
    { scout, horse },
  );
  await waitMode(page, 'encounter');
}

test('Prepare: the hero line, a change of weapon and of horse, the foe as seen, the field, then Fight in two taps', async ({ page }) => {
  await toBand(page, { horse: true });
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first()); // tap 1
  await waitMode(page, 'prepare');
  const hero = page.locator('#prepGear .heroLine');
  await expect(hero).toContainText('Riding your Rouncey');
  await expect(hero.locator('.itemIco').first()).toBeVisible();
  await expect(page.locator('#prepFoe')).toHaveText('Road Reavers: about 20, mostly foot and some archers.');
  await expect(page.locator('#prepField')).toContainText('Open ground');
  // Change the weapon: the bow, with its quiver.
  await press(page, page.locator('#prepLoadout'));
  await expect(hero).toContainText('Shortbow');
  await expect(hero.locator('.quiverWord')).toHaveText(/^\d+ shots$/);
  expect(await game(page, (CL) => CL.campaign.loadout.last)).toEqual({ open_country: 'secondary' });
  // On foot instead.
  await press(page, page.locator('#prepRide', { hasText: 'Fight on foot' }));
  await expect(hero).toContainText('On foot');
  await press(page, page.locator('#prepPanel .prepActions button', { hasText: 'Fight' })); // tap 2
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => [CL.game.loadout.which, Boolean(CL.game.hero.mounted)])).toEqual(['secondary', false]);
});

test('Prepare: a scout names their weapons; a finding for this field; a lair is unknown', async ({ page }) => {
  await toBand(page, { scout: true, horse: true });
  await game(page, (CL) => {
    CL.campaign.character.skills.riding = 0; // the Rouncey's requirement not met: a finding
  });
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await expect(page.locator('#prepFoe')).toHaveText('Road Reavers: about 20, mostly axes, some maces and some bows (your scout’s estimate).');
  await expect(page.locator('#prepGear .finding', { hasText: 'Rouncey needs Riding 1' })).toHaveCount(1); // said once, not twice
  await expect(page.locator('#prepAbout')).toContainText('Infantry in front');
  // Defensive against this enemy: their shots are known (a scout), so the wall says so.
  await press(page, page.locator('#prepPanel .prepPresets button', { hasText: 'Defensive' }));
  await expect(page.locator('#prepAbout')).toContainText('a shield wall takes the arrows');
  // A lair instead, with no scout: what waits inside is unknown, and the setups say nothing of it.
  await game(page, (CL) => {
    CL.campaign.followers.scout = null;
    CL.game.prep = null;
    CL.game.partyId = null;
    CL.game.siteId = 'looter_camp';
    CL.ui.changeMode('encounter');
  });
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await expect(page.locator('#prepFoe')).toContainText('how many and how armed, unknown.');
  await expect(page.locator('#prepAbout')).toHaveText(/^Infantry in front, archers behind; both go with you\. The cavalry waits on a flank and charges when your archers first loose\.$/);
});

test('Skip this screen: Attack goes straight in, with the loadout remembered for the field', async ({ page }) => {
  await toBand(page);
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await press(page, page.locator('#prepLoadout'));
  await press(page, page.locator('#prepPanel label', { hasText: 'Skip this screen next time' }).locator('input'));
  await press(page, page.locator('#prepPanel .prepActions button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  await press(page, page.locator('#primaryBtn', { hasText: 'Continue' }));
  await waitMode(page, 'map');
  await game(page, (CL) => {
    const c = CL.campaign;
    c.loadout.start = 'primary'; // as if chosen elsewhere: the field's memory wins on Prepare
    const p = CL.parties.spawn(c, 'bandits');
    Object.assign(p, { x: c.world.x + 1, y: c.world.y, troops: { looter: 3 }, tx: null, ty: null });
    CL.parties.open(p.id);
  });
  await waitMode(page, 'encounter');
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first()); // one tap: no Prepare
  await waitMode(page, 'battle');
  expect(await game(page, (CL) => CL.game.loadout.which)).toBe('secondary');
});

test('the battle report: a summary line on one screen, More on request', async ({ page }) => {
  await toBand(page);
  await press(page, page.locator('#encounterOptions button', { hasText: 'Attack' }).first());
  await waitMode(page, 'prepare');
  await press(page, page.locator('#prepPanel .prepActions button', { hasText: 'Fight' }));
  await waitMode(page, 'battle');
  await page.waitForFunction(() => window.Crownless.game.t > 3);
  await debug(page, '[data-cheat="win"]');
  await waitMode(page, 'result');
  const summary = page.locator('#result .reportSummary');
  await expect(summary).toHaveText(/^Victory in \d+ (s|min \d\d s)\. You lost (no one|\d+ \(.+\)); they lost \d+/);
  await expect(summary).toBeInViewport();
  const more = page.locator('#result details.reportMore');
  await expect(more.locator('summary')).toBeInViewport();
  await expect(more.locator('p')).toBeHidden();
  // One screen: the overlay's modal does not scroll before More is opened.
  expect(await page.evaluate(() => { const m = document.querySelector('#overlay .modal'); return m.scrollHeight <= m.clientHeight + 1; })).toBe(true);
  await press(page, more.locator('summary'));
  await expect(more).toHaveAttribute('open', '');
  await expect(more).toContainText('You: ');
  await expect(more).toContainText('Infantry: ');
  await expect(more).toContainText('Enemies defeated');
});
