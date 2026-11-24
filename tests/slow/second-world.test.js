// P10-02 (slow): the coast, once the second world (P9-08), is now the Sundered Realm's far east. A
// company that begins at Gullhaven plays there without stalling, by the same campaign bot; the world's
// own wars and sieges, the coast's among them, are `landed`'s (tests/slow/landed.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeBot } = require('../helpers/campaign-bot');
const { newCampaign } = require('../../scripts/simulate-campaign');

test('the coast: a company starting at Gullhaven does not stall (the campaign bot, three seeds, 15 days)', () => {
  for (const seed of [1, 2, 3]) {
    const { CL } = newCampaign(seed, 'farmhand');
    const c = CL.campaign;
    const port = CL.content.get('settlements', 'gullhaven');
    Object.assign(c.world, { x: port.mapX, y: port.mapY, location: 'gullhaven' });
    const s = makeBot(CL).play(15);
    assert.equal(s.stuck, 0, `seed ${seed} stalled`);
    assert.ok(s.wins >= 1, `seed ${seed} never won`);
    assert.ok(c.day >= 15, `seed ${seed} ran out of steps`);
    assert.deepEqual(s.invariants, [], `seed ${seed}: invariants`);
  }
});
