// Gate D acceptance (GDD §14): "Expand to 10 settlements, 15 troop types, 3 battle maps, 4 story
// quests, 3 repeatable contracts, a companion, reputation and ending flags. Pass: each ending is
// reachable, no quest soft-locks, and the sandbox continues."
//
// The soft-lock check (60 whole campaigns with the story bot) and the after-the-ending check are
// slow tests: tests/slow/gate-d-campaigns.test.js, run by `npm run test:slow` (H-01).
const test = require('node:test');
const assert = require('node:assert/strict');
const { newCampaign } = require('../scripts/simulate-campaign');

test('Gate D scope: the region, troops, maps, quests, contracts, companion, reputation and endings', () => {
  const { CL } = newCampaign(1);
  const t = (name) => Object.values(CL.content.table(name));
  const by = (list, key) => {
    const o = {};
    for (const x of list) o[x[key]] = (o[x[key]] || 0) + 1;
    return o;
  };
  assert.deepEqual(by(t('settlements'), 'type'), { town: 2, fort: 2, village: 6 });
  assert.equal(t('troops').filter((x) => x.id !== 'hero').length, 16, '15 troop types, plus the Sellsword from 1.5.0 (V2-03b)');
  assert.equal(t('battle_maps').filter((m) => !m.generate).length, 3, 'the three hand-made maps');
  assert.equal(t('battle_maps').filter((m) => m.generate).length, 2, 'plus two large generated ones from 1.8.0 (V2-05)');
  assert.deepEqual(
    t('quests').filter((q) => !q.side).map((q) => q.id),
    ['q1', 'q2', 'q3', 'q4'],
    'the four story quests (V2-Q errands are extra and optional)',
  );
  assert.deepEqual(
    t('contracts')
      .map((k) => k.kind || 'hunt')
      .sort(),
    ['delivery', 'escort', 'hunt'],
  );
  assert.deepEqual(
    t('companions').map((m) => m.id),
    ['mara'],
  );
  assert.deepEqual(Object.keys(CL.campaign.reputation).sort(), ['aurelian', 'valedorn']);
  assert.deepEqual(Object.keys(CL.content.get('quests', 'q4').endings).sort(), ['aurelian', 'compromise', 'valedorn']);
  assert.ok(t('items').length >= 25, 'about 30 items including gear, horses and goods');
  assert.deepEqual(Array.from(CL.content.validate()), [], 'all content references check out');
});

test('GDD edge case: the courier’s thieves are removed off-screen — they return, so Q2 can still finish', () => {
  const { loadGame } = require('./helpers/load');
  const { CL } = loadGame();
  const c = CL.campaign;
  c.world.location = 'eastwatch';
  let v = CL.story.talk('caravan_master');
  v = CL.story.choose(v, v.options.find((o) => /find your packet/.test(o.text)).index);
  const tag = (p) => p.questTag === 'q2_thieves';
  const first = c.parties.find(tag);
  assert.ok(first);
  // Wiped off the map (as an off-screen fight would)…
  CL.parties.remove(c, first);
  assert.equal(c.parties.some(tag), false);
  CL.parties.tick(c, 1);
  const again = c.parties.find(tag);
  assert.ok(again && again !== first, 'the story puts them back on the river road');
  // …or missing from a save: they are back after loading too.
  const raw = JSON.parse(JSON.stringify(c));
  raw.parties = raw.parties.filter((p) => p.questTag !== 'q2_thieves');
  CL.campaign = CL.save.sanitize(raw);
  CL.parties.tick(CL.campaign, 0.5);
  const loaded = CL.campaign.parties.find(tag);
  assert.ok(loaded);
  CL.parties.open(loaded.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  assert.equal(CL.story.state(CL.campaign).quests.q2.stage, 'q2_choose', 'the packet is recovered');
});

