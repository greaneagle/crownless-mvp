// P9-08 (slow): the second official world, the Sundered Coast, played end to end by the same bots as
// the Sundered Realm: the campaign bots, Prototype G (every style, with a reload) and the landed world
// alone (`npm run landed -- --world sundered_coast`). The invariants hold every day.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeBot } = require('../helpers/campaign-bot');
const { newCampaign } = require('../../scripts/simulate-campaign');

const WORLD = 'sundered_coast';

test('the Sundered Coast: new campaigns do not stall (the campaign bots, four seeds, 15 days)', () => {
  for (const seed of [1, 2, 3, 4]) {
    const { CL } = newCampaign(seed, 'farmhand', { world: WORLD });
    assert.equal(CL.campaign.worldId, WORLD);
    const s = makeBot(CL).play(15);
    assert.equal(s.stuck, 0, `seed ${seed} stalled`);
    assert.ok(s.wins >= 1, `seed ${seed} never won`);
    assert.ok(CL.campaign.day >= 15, `seed ${seed} ran out of steps`);
    assert.deepEqual(s.invariants, [], `seed ${seed}: invariants`);
  }
});

test('the Sundered Coast: Prototype G, every style, resumes after a reload', () => {
  const { run } = require('../../scripts/prototype-g');
  for (const style of ['hands-off', 'presets', 'expert', 'landed']) {
    const r = run(2, style, 8, { world: WORLD });
    assert.equal(r.stuck, 0, `${style}: never stuck`);
    assert.equal(r.invariants, 0, `${style}: the invariants held`);
    assert.ok(r.resumed, `${style}: the reload picked up where it left off`);
    assert.ok(r.day >= 8 - 0.01, `${style}: reached day 8`);
  }
});

test('the Sundered Coast alone for 180 days: its realms fight, keep a fort and their lords, and the invariants hold', () => {
  const { run } = require('../../scripts/landed');
  let begun = 0;
  for (const seed of [1, 2]) {
    const r = run(seed, 180, { world: WORLD });
    assert.deepEqual(r.problems, [], `seed ${seed}: invariants`);
    for (const t of r.timeline) for (const [f, n] of Object.entries(t.forts)) assert.ok(n >= 1, `seed ${seed}, day ${t.day}: ${f} has no fort`);
    for (const [f, n] of Object.entries(r.riders)) assert.ok(n >= 2, `seed ${seed}: ${f} keeps ${n} riding lords`);
    assert.ok(r.wars >= 1, `seed ${seed}: the realms go to war`);
    begun += r.begun;
  }
  assert.ok(begun > 0, 'sieges begin');
});
