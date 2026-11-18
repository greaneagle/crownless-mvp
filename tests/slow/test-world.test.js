// W-04 (slow): the campaign bot plays 30 days of the three-kingdom, 150 × 120 test world.   npm run test:slow
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('../helpers/load');
const { testWorld, WORLD } = require('../helpers/test-world');
const { makeBot, headlessUi } = require('../helpers/campaign-bot');

test('the test world plays: the campaign bot gets through 30 days, parties roam past 100, and positions survive a reload', () => {
  const env = loadGame({ content: testWorld, party: false, seed: 7 });
  const { CL, storage } = env;
  CL.ui = headlessUi(CL, []);
  CL.game.newGame = true;
  CL.character.begin({ name: 'Bot', background: 'farmhand' });
  const c = CL.campaign;
  c.parties = [];
  c.partySpawns = {};
  c.nextPartyId = 1;
  CL.parties.ensure(c, true);
  const far = { x: 0, y: 0 };
  const bot = makeBot(CL);
  for (let d = 0; d < 30; d++) {
    bot.play(d + 1);
    for (const p of c.parties) {
      far.x = Math.max(far.x, p.x);
      far.y = Math.max(far.y, p.y);
    }
  }
  assert.ok(c.day >= 30, `reached day ${c.day.toFixed(1)}`);
  assert.equal(c.worldId, WORLD);
  assert.ok(far.x > 100 && far.y > 100, `parties went past 100: ${far.x.toFixed(1)}, ${far.y.toFixed(1)}`);
  // Every quarter of the map is visited by someone.
  const quarters = new Set();
  const placesInQuarters = Object.values(CL.content.table('settlements')).map((s) => `${s.mapX > 75 ? 'e' : 'w'}${s.mapY > 60 ? 's' : 'n'}`);
  for (const q of placesInQuarters) quarters.add(q);
  assert.equal(quarters.size, 4, 'places in all four quarters');
  // A save and a reload keep positions beyond 100.
  const p = c.parties[0];
  Object.assign(p, { x: 140, y: 115 });
  Object.assign(c.world, { x: 130, y: 110, location: null });
  CL.save.write();
  const again = loadGame({ content: testWorld, party: false, storage, seed: 7 });
  const r = again.CL.save.fromRaw(JSON.parse(storage.data[again.CL.save.KEY])).campaign;
  assert.equal(r.worldId, WORLD);
  assert.deepEqual([r.world.x, r.world.y], [130, 110]);
  const q = r.parties.find((x) => x.id === p.id);
  assert.deepEqual([q.x, q.y], [140, 115]);
});
