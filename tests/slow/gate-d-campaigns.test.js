// Gate D acceptance, the slow half (GDD §14; moved from tests/gate-d.test.js by H-01): "each ending
// is reachable, no quest soft-locks, and the sandbox continues."
//
// The soft-lock check plays 42 whole campaigns from a fresh start with a randomized story bot
// (tests/helpers/story-bot.js) on the real game logic. The runs mix three starts (a funded company,
// the bare GDD start, a bot that loses most fights), and the bot saves and reloads at random. Every
// run must reach an ending, and together they must reach every ending, every quest stage and every
// authored branch. P10-04: the seeds are split across the kingdoms (7 each), the story cast from each,
// and every kingdom's runs must reach an ending.   npm run test:slow
const test = require('node:test');
const assert = require('node:assert/strict');
const { newCampaign, mulberry } = require('../../scripts/simulate-campaign');
const { makeStoryBot } = require('../helpers/story-bot');

const PER_REALM = 7; // P10-04: about 8 a kingdom (60 seeds until P10-00, 40 until P10-04)
const REALMS = require('../helpers/load').loadGame().CL.story.startRealms();
const SEEDS = PER_REALM * REALMS.length;

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

function playOne(seed, realm) {
  const env = newCampaign(seed, 'farmhand', { realm });
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

test(`no quest soft-locks, every ending reachable: ${SEEDS} randomized campaigns from a fresh start, ${PER_REALM} in each kingdom`, () => {
  const seen = { stages: new Set(), endings: new Set(), q1: new Set(), q2_choice: new Set(), q2_how: new Set(), q3_side: new Set(), mara: new Set() };
  let reloads = 0;
  let CL0 = null;
  const ended = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const realm = REALMS[(seed - 1) % REALMS.length];
    const { CL, r } = playOne(seed, realm);
    CL0 = CL;
    assert.equal(CL.campaign.startRealm, realm);
    const quests = Object.entries(CL.story.state(CL.campaign).quests).map(([k, v]) => `${k}:${v.status}/${v.stage}`);
    assert.ok(r.finished, `seed ${seed} (${realm}) never reached an ending (${quests.join(' ')})\n${r.trace.slice(-12).join('\n')}`);
    assert.equal(r.stats.stuck, 0, `seed ${seed}: travel got stuck`);
    ended[realm] = (ended[realm] || 0) + 1;
    const f = CL.story.state(CL.campaign).flags;
    for (const s of r.stats.stages) seen.stages.add(s);
    seen.endings.add(f.ending);
    seen.q1.add(f.q1_wagon_safe || f.q1_wagon_slipped ? 'wagon' : f.q1_hired ? 'recruits' : 'bandits');
    for (const k of ['q2_choice', 'q2_how', 'q3_side']) seen[k].add(f[k]);
    seen.mara.add(f.mara_saved ? 'saved' : f.mara_gone || 'unharmed');
    reloads += r.stats.reloads;
  }
  const CL = CL0;
  assert.deepEqual(Object.keys(ended).sort(), [...REALMS].sort(), 'an ending from every kingdom');
  // The main story's stages (the bot leaves the V2-Q errands alone; tests/errands.test.js walks them).
  const stages = Object.values(CL.content.table('quests')).filter((q) => !q.side && !q.opening).flatMap((q) => q.stages.map((s) => s.id));
  assert.deepEqual(
    stages.filter((s) => !seen.stages.has(s)),
    [],
    'every quest stage is reached',
  );
  assert.deepEqual([...seen.endings].sort(), Object.keys(CL.content.get('quests', 'q4').endings).sort(), 'all three endings');
  assert.deepEqual([...seen.q1].sort(), ['bandits', 'recruits', 'wagon'], 'all three Q1 routes');
  // The two ways to sell one side's plans to the other mirror each other and are rare for a random
  // player (hear one side out, then pick the sale from the other: about 1 run in 20, the Crown's way
  // about 1 in 100). Here they count as one branch; tests/q3.test.js walks both every time. (W-07
  // re-baseline: its step changes shifted the bots' random draws, and 60 seeds no longer happened on
  // both directions.)
  const family = (v) => (typeof v === 'string' && v.startsWith('sold_to_') ? 'sold' : v);
  for (const k of ['q2_choice', 'q2_how', 'q3_side']) {
    assert.deepEqual([...new Set([...seen[k]].map(family))].sort(), [...new Set([...authoredValues(CL, k)].map(family))].sort(), `every ${k} branch`);
  }
  assert.ok(seen.mara.has('saved') && seen.mara.has('fell'), 'Mara can be saved or lost (GDD §10)');
  assert.ok(reloads > SEEDS, 'saved and reloaded along the way');
});

test('after the ending the sandbox continues: news, work, patrols, travel and saves', () => {
  for (const seed of [1, 2, 13]) {
    const { CL, r } = playOne(seed, 'valedorn');
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
    assert.deepEqual([...kinds].sort(), ['bandit', 'caravan', 'lord', 'patrol'], 'patrols, caravans, Reavers and lords (P8-01) keep moving');
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
