// Gate D acceptance (GDD §14): "Expand to 10 settlements, 15 troop types, 3 battle maps, 4 story
// quests, 3 repeatable contracts, a companion, reputation and ending flags. Pass: each ending is
// reachable, no quest soft-locks, and the sandbox continues."
//
// The soft-lock check plays 60 whole campaigns from a fresh start with a randomized story bot
// (tests/helpers/story-bot.js) on the real game logic. The runs mix three starts (a funded company,
// the bare GDD start, a bot that loses most fights), and the bot saves and reloads at random. Every
// run must reach an ending, and together they must reach every ending, every quest stage and every
// authored branch.
const test = require('node:test');
const assert = require('node:assert/strict');
const { newCampaign, mulberry } = require('../scripts/simulate-campaign');
const { makeStoryBot } = require('./helpers/story-bot');

const SEEDS = 60;

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
    t('quests').map((q) => q.id),
    ['q1', 'q2', 'q3', 'q4'],
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

/** Every value a story flag is ever set to in the content (so new branches join the check). */
function authoredValues(CL, flag) {
  const out = new Set();
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      if (x.set === flag && typeof x.to === 'string') out.add(x.to);
      Object.values(x).forEach(walk);
    }
  };
  walk(CL.content.table('dialogue'));
  walk(CL.content.table('quests'));
  return out;
}

function playOne(seed) {
  const env = newCampaign(seed);
  const { CL } = env;
  const c = CL.campaign;
  if (seed % 3) {
    // A funded company; every third run keeps the bare GDD start (60 crowns, no soldiers).
    c.gold = 3000;
    c.food = 300;
    for (const id of ['footman', 'footman', 'footman', 'hunter', 'hunter', 'levy', 'levy', 'levy']) CL.save.addSoldier(c, id);
  } else c.food = 60;
  const r = makeStoryBot(CL, mulberry(seed * 31 + 7), { winChance: seed % 2 ? 0.85 : 0.4 }).play(800);
  return { ...env, r };
}

test('no quest soft-locks, every ending reachable: 60 randomized campaigns from a fresh start', () => {
  const seen = { stages: new Set(), endings: new Set(), q1: new Set(), q2_choice: new Set(), q2_how: new Set(), q3_side: new Set(), mara: new Set() };
  let reloads = 0;
  let CL0 = null;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { CL, r } = playOne(seed);
    CL0 = CL;
    const quests = Object.entries(CL.story.state(CL.campaign).quests).map(([k, v]) => `${k}:${v.status}/${v.stage}`);
    assert.ok(r.finished, `seed ${seed} never reached an ending (${quests.join(' ')})\n${r.trace.slice(-12).join('\n')}`);
    assert.equal(r.stats.stuck, 0, `seed ${seed}: travel got stuck`);
    const f = CL.story.state(CL.campaign).flags;
    for (const s of r.stats.stages) seen.stages.add(s);
    seen.endings.add(f.ending);
    seen.q1.add(f.q1_wagon_safe || f.q1_wagon_slipped ? 'wagon' : f.q1_hired ? 'recruits' : 'bandits');
    for (const k of ['q2_choice', 'q2_how', 'q3_side']) seen[k].add(f[k]);
    seen.mara.add(f.mara_saved ? 'saved' : f.mara_gone || 'unharmed');
    reloads += r.stats.reloads;
  }
  const CL = CL0;
  const stages = Object.values(CL.content.table('quests')).flatMap((q) => q.stages.map((s) => s.id));
  assert.deepEqual(
    stages.filter((s) => !seen.stages.has(s)),
    [],
    'every quest stage is reached',
  );
  assert.deepEqual([...seen.endings].sort(), Object.keys(CL.content.get('quests', 'q4').endings).sort(), 'all three endings');
  assert.deepEqual([...seen.q1].sort(), ['bandits', 'recruits', 'wagon'], 'all three Q1 routes');
  for (const k of ['q2_choice', 'q2_how', 'q3_side']) {
    assert.deepEqual([...seen[k]].sort(), [...authoredValues(CL, k)].sort(), `every ${k} branch`);
  }
  assert.ok(seen.mara.has('saved') && seen.mara.has('fell'), 'Mara can be saved or lost (GDD §10)');
  assert.ok(reloads > SEEDS, 'saved and reloaded along the way');
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

test('after the ending the sandbox continues: news, work, patrols, travel and saves', () => {
  for (const seed of [1, 2, 13]) {
    const { CL, r } = playOne(seed);
    assert.ok(r.finished);
    const c = CL.campaign;
    const ending = CL.story.state(c).flags.ending;
    const lines = c.news.lines.length;
    if (CL.game.mode !== 'map') CL.world.leaveSettlement();
    const kinds = new Set();
    for (let i = 0; i < 12; i++) {
      CL.party.advanceDays(0.5);
      for (const p of c.parties) kinds.add(CL.content.get('party_templates', p.template).kind);
    }
    assert.ok(c.news.lines.length > Math.min(lines, 5), `seed ${seed}: news keeps coming`);
    assert.deepEqual([...kinds].sort(), ['bandit', 'caravan', 'patrol'], 'patrols, caravans and Reavers keep moving');
    // Work is still posted where the player is welcome.
    const board = ['stonebridge', 'eastwatch'].find((sid) => CL.realm.welcomes(c, sid));
    if (board) assert.equal(CL.contracts.offersAt(c, board).length, 3, `seed ${seed}: ${board} posts work`);
    // Travel still works, and the ending survives a reload.
    const s = CL.content.get('settlements', 'oakford');
    CL.world.travelTo({ type: 'settlement', id: 'oakford', x: s.mapX, y: s.mapY });
    for (let i = 0; i < 20000 && c.world.location !== 'oakford'; i++) {
      if (CL.game.mode === 'encounter') {
        CL.parties.attack();
        CL.debugTools.endBattleNow(true);
        CL.world.returnToMap();
      }
      if (!CL.game.travel) CL.world.travelTo({ type: 'settlement', id: 'oakford', x: s.mapX, y: s.mapY });
      CL.world.update(0.1);
    }
    assert.equal(c.world.location, 'oakford');
    CL.save.write();
    const back = CL.save.load();
    assert.equal(back.story.flags.ending, ending);
    assert.equal(back.story.quests.q4.status, 'done');
    assert.equal(JSON.stringify(back), JSON.stringify(CL.save.sanitize(JSON.parse(JSON.stringify(c)))));
  }
});
