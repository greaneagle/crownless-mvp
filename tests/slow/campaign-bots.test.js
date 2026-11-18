// Long headless campaigns (moved from tests/acceptance.test.js and tests/v2-acceptance.test.js by
// H-01): bots play whole new games on the real game logic.   npm run test:slow
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeBot } = require('../helpers/campaign-bot');
const { newCampaign } = require('../../scripts/simulate-campaign');

test('new campaigns do not stall: eight seeds all make progress in 15 days', () => {
  // Gate C (GDD §14). Every campaign keeps moving and wins something. One unlucky start may still be
  // level 1 by day 15 (at 4 h per battle, from 1.6.0, seed 4 of 30 is; on average the bots level
  // faster than at 6 h).
  let levelled = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { CL } = newCampaign(seed);
    const s = makeBot(CL).play(15);
    const c = CL.campaign;
    assert.equal(s.stuck, 0, `seed ${seed} stalled`);
    assert.ok(s.wins >= 1, `seed ${seed} never won`);
    assert.ok(c.day >= 15, `seed ${seed} ran out of steps`);
    if (c.character.level >= 2) levelled++;
  }
  assert.ok(levelled >= 7, `only ${levelled} of 8 seeds levelled`);
});

// v2.0 acceptance (V2-13).
test('Prototype G (short): hands-off, presets-only and expert players all get through the same campaign, and resume after a reload', () => {
  const { run } = require('../../scripts/prototype-g');
  for (const style of ['hands-off', 'presets', 'expert']) {
    const r = run(2, style, 8);
    assert.equal(r.stuck, 0, `${style}: never stuck`);
    assert.ok(r.resumed, `${style}: the reload picked up where it left off`);
    assert.ok(r.day >= 8 - 0.01, `${style}: reached day 8`);
    assert.ok(r.money >= 0 && r.soldiers >= 0);
  }
});
