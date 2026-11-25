// P10-07: onboarding. A guide for the beginner steps, whatever the origin, each shown once at its
// moment and skippable one at a time or all at once; hint cards for everything deeper; one setting;
// How to Play by stage.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');

/** Show and close whatever is due on this screen; the ids shown, in order. */
function showAll(CL, mode, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = CL.tips.check(mode);
    if (!t) break;
    out.push(t.id);
    CL.tips.dismiss();
  }
  return out;
}

test('the guide: the beginner steps in order, every one a card that points at How to Play', () => {
  const { CL } = loadGame({ party: false });
  const steps = CL.tips.guideSteps().map((t) => t.id);
  assert.deepEqual(JSON.parse(JSON.stringify(steps)), ['settlement', 'town', 'hire', 'map', 'lowFood', 'encounter', 'battle', 'save']);
  assert.deepEqual({ ...CL.tips.step(CL.content.get('tips', 'hire')) }, { n: 3, of: 8 });
  assert.equal(CL.tips.step(CL.content.get('tips', 'trade')), null, 'the market is a hint, not a step');
  // Everything deeper is a hint: the market, contracts, the Realm screen, fiefs, sieges, armies, houses, rule.
  for (const id of ['trade', 'contracts', 'realm', 'fief', 'siege', 'army', 'houses', 'rule']) {
    const t = CL.content.get('tips', id);
    assert.ok(t && !t.guide, `${id} is a hint`);
  }
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('with each origin, the guide meets you where you begin: the town, then hiring if you have nobody yet', () => {
  for (const origin of Object.keys(loadGame({ party: false }).CL.content.table('origins'))) {
    const { CL } = newCampaign(31, origin, { realm: 'valedorn', plain: false });
    CL.settings.set('tips', true);
    CL.tips.reset();
    CL.game.mode = 'settlement';
    const shown = showAll(CL, 'settlement');
    const farm = origin === 'farmhand'; // begins with the village's men: nothing to hire yet
    assert.deepEqual(shown, farm ? ['settlement'] : ['settlement', 'hire'], origin);
    // Each shows once.
    assert.deepEqual(showAll(CL, 'settlement'), [], `${origin}: not again`);
    CL.game.mode = 'map';
    assert.deepEqual(showAll(CL, 'map'), ['map'], `${origin}: the map step on the map`);
  }
});

test('skip one step (Got it) and the next still comes; skip the guide and only the hints are left', () => {
  const { CL } = newCampaign(32, 'traveller', { realm: 'aurelian', plain: false });
  CL.settings.set('tips', true);
  CL.tips.reset();
  CL.game.mode = 'settlement';
  assert.equal(CL.tips.check('settlement').id, 'settlement');
  CL.tips.dismiss(); // Got it: this step only
  assert.equal(CL.tips.due('settlement').id, 'hire');
  CL.tips.skipGuide();
  for (const mode of ['settlement', 'town', 'map', 'encounter', 'battle']) assert.equal(CL.tips.due(mode)?.guide, undefined, `${mode}: no guide step`);
  assert.equal(CL.tips.due('trade').id, 'trade', 'a hint still shows the first time');
  // Show hints again brings the guide back too.
  CL.tips.reset();
  assert.equal(CL.tips.due('settlement').id, 'settlement');
});

test('one setting turns the guide and the hints off, and back on', () => {
  const { CL } = newCampaign(33, 'noble', { realm: 'valedorn', plain: false });
  CL.tips.reset();
  CL.settings.set('tips', false);
  for (const mode of ['settlement', 'map', 'trade', 'realm']) assert.equal(CL.tips.due(mode), null, mode);
  CL.settings.set('tips', true);
  assert.equal(CL.tips.due('settlement').id, 'settlement');
});

test('the guide’s later moments: food low, the first day on the road, an encounter', () => {
  const { CL } = newCampaign(34, 'farmhand', { realm: 'valedorn', plain: false });
  CL.settings.set('tips', true);
  CL.tips.reset();
  const c = CL.campaign;
  showAll(CL, 'map'); // the map step
  c.food = 0;
  assert.equal(CL.tips.due('map').id, 'lowFood');
  CL.tips.check('map');
  CL.tips.dismiss();
  assert.equal(CL.tips.due('map'), null, 'saving waits for a day on the road');
  c.day = 1.2;
  assert.equal(CL.tips.due('map').id, 'save');
  assert.equal(CL.tips.due('encounter').id, 'encounter');
});

test('How to Play by stage: captain, vassal, lord, ruler, from what you are', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const topics = Object.values(CL.content.table('help_topics'));
  for (const st of ['captain', 'vassal', 'lord', 'ruler']) assert.ok(topics.some((h) => h.stage === st), `topics for a ${st}`);
  assert.equal(CL.tips.stage(c), 'captain');
  CL.allegiance.state(c).kind = 'vassal';
  assert.equal(CL.tips.stage(c), 'vassal');
  const sid = Object.keys(c.holdings).find((id) => c.holdings[id].kind === 'village');
  c.holdings[sid].holder = CL.realm.PLAYER;
  assert.equal(CL.tips.stage(c), 'lord');
  c.rulers.valedorn = CL.realm.PLAYER;
  assert.equal(CL.tips.stage(c), 'ruler');
});
