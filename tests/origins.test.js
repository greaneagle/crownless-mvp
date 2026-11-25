// P10-05: origins replace the backgrounds. Each of the first three has an opening quest, cast from the
// kingdom you chose, that teaches the basics and leads into the common quest (Q1), ending within the
// band set in data. tests/slow/origins.test.js plays every origin from every kingdom with the bot.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');
const { endState } = require('./helpers/origins');

const say = (CL, conv, re) => {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
};

/** Ride to the story band with this tag and win the fight, as a player would. */
function beat(CL, tag) {
  const c = CL.campaign;
  const p = c.parties.find((x) => x.questTag === tag);
  assert.ok(p, `${tag} is on the map`);
  if (CL.game.mode !== 'map') CL.world.leaveSettlement();
  Object.assign(c.world, { x: p.x, y: p.y, location: null });
  CL.parties.open(p.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
}

/** Arrive at a settlement (the `enter` the story listens to). */
function arrive(CL, sid) {
  const s = CL.content.get('settlements', sid);
  if (CL.campaign.world.location && CL.game.mode !== 'map') CL.world.leaveSettlement();
  CL.world.travelTo({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY });
  for (let i = 0; i < 20000 && CL.campaign.world.location !== sid; i++) {
    if (CL.game.mode === 'encounter') {
      CL.parties.attack();
      CL.debugTools.endBattleNow(true);
      CL.world.returnToMap();
    }
    if (!CL.game.travel && CL.game.mode === 'map') CL.world.travelTo({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY });
    CL.world.update(0.1);
  }
  assert.equal(CL.campaign.world.location, sid);
}

function hire(CL, n) {
  for (let i = 0; i < n; i++) assert.ok(CL.party.recruit(CL.party.recruitsHere()[0]), 'hired');
}

function inBand(CL, c, who) {
  const band = CL.content.get('origin_rules', 'band');
  const s = endState(CL, c);
  for (const k of ['gold', 'soldiers', 'gear', 'level', 'renown']) assert.ok(s[k] >= band[k][0] && s[k] <= band[k][1], `${who}: ${k} ${s[k]} outside ${band[k].join('–')}`);
  assert.equal(CL.story.questStatus(c, 'q1'), 'active', `${who}: into the common quest`);
  assert.equal(CL.story.state(c).flags.origin_done, true);
  return s;
}

/** The quests some list of effects completes while starting Q1 (the hand-off into the common quest). */
function handOffs(CL) {
  const out = new Set();
  const walk = (x) => {
    if (Array.isArray(x)) {
      if (x.some((e) => e?.start === 'q1')) for (const e of x) if (e?.complete) out.add(e.complete);
      x.forEach(walk);
    } else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(CL.content.table('quests'));
  walk(CL.content.table('dialogue'));
  return out;
}

test('five origins replace the backgrounds; each has an opening quest, each a few steps that end in the common quest', () => {
  const { CL } = loadGame({ party: false });
  const O = CL.content.table('origins');
  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(O))), ['traveller', 'noble', 'farmhand', 'scout', 'peddler']);
  for (const o of Object.values(O)) {
    const q = CL.content.get('quests', o.quest);
    assert.ok(q.opening && q.stages.length >= 3 && q.stages.length <= 5, `${o.id}: 3 to 5 steps`);
    assert.ok(handOffs(CL).has(o.quest), `${o.id}: leads into Q1`);
  }
  assert.equal(Object.keys(CL.content.table('backgrounds')).length, 0, 'no backgrounds any more');
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('the unhorsed traveller: the innkeeper, two hires, the horse thieves, the innkeeper again; the horse is the edge', () => {
  const { CL } = newCampaign(11, 'traveller', { realm: 'valedorn', plain: false });
  const c = CL.campaign;
  assert.equal(c.world.location, 'stonebridge');
  assert.equal(c.roster.length, 0);
  assert.equal(CL.story.state(c).quests.o_traveller.stage, 'o_trav_inn');
  assert.equal(CL.story.questStatus(c, 'q1'), 'unstarted', 'the common quest waits for the opening one');
  // The innkeeper speaks the opening in the streets, and is on the menu.
  assert.ok(CL.town.streetPeople('stonebridge').some((p) => p.id === 'origin_innkeeper' && p.name === 'Hilde the Innkeeper'));
  let v = CL.story.talk('origin_innkeeper', c);
  assert.match(v.text, /Oakford road/);
  say(CL, v, /get my horse back/);
  hire(CL, 2);
  assert.equal(CL.story.state(c).quests.o_traveller.stage, 'o_trav_thieves');
  beat(CL, 'o_trav_thieves');
  assert.equal(c.equipment.horse, 'nag', 'your horse, back under you');
  arrive(CL, 'stonebridge');
  v = CL.story.talk('origin_innkeeper', c);
  assert.equal(v.node, 'back');
  say(CL, v, /go and see/);
  assert.equal(CL.story.questStatus(c, 'o_traveller'), 'done');
  inBand(CL, c, 'traveller');
  // The innkeeper is an innkeeper again, and the speed hint is due.
  assert.equal(CL.town.streetPeople('stonebridge').some((p) => p.id === 'origin_innkeeper'), false);
  const tip = CL.content.get('tips', 'speed');
  assert.equal(tip.when, 'originDone');
});

test('the impoverished noble, from Aurelia: Old Tam, three hires, the debt collectors, home; the family axe is the edge', () => {
  const { CL } = newCampaign(12, 'noble', { realm: 'aurelian', plain: false });
  const c = CL.campaign;
  assert.equal(c.world.location, 'eastwatch');
  let v = CL.story.talk('origin_retainer', c);
  assert.equal(v.speaker, 'Old Tam');
  assert.match(v.text, /out to Saltmere/);
  const gold = c.gold;
  say(CL, v, /bring him home/);
  assert.equal(c.gold, gold + 40, 'the strongbox');
  hire(CL, 3);
  beat(CL, 'o_noble_collectors');
  arrive(CL, 'eastwatch');
  v = CL.story.talk('origin_retainer', c);
  assert.equal(v.node, 'home');
  say(CL, v, /I will/);
  assert.equal(c.equipment.weapon, 'hand_axe', 'your grandfather’s axe, in hand');
  assert.equal(c.inventory.worn_sword, 1, 'the old sword in the pack');
  inBand(CL, c, 'noble');
  assert.equal(CL.story.peopleAt('eastwatch', c).some((t) => t.id === 'origin_retainer'), false, 'Old Tam has done his part');
});

test('the farmhand, from Ostrand: begins in the village with its willing men; the raiders, the headman, the town', () => {
  const { CL } = newCampaign(13, 'farmhand', { realm: 'ostrand', plain: false });
  const c = CL.campaign;
  const k = c.story.cast;
  assert.equal(c.world.location, k.village);
  assert.deepEqual(JSON.parse(JSON.stringify(c.roster.map((s) => s.troop))), ['ostrand_levy', 'ostrand_levy', 'ostrand_levy'], 'three of its men, the realm’s own levies');
  let v = CL.story.talk('origin_headman', c);
  assert.equal(v.speaker, 'The Headman of Fenwick');
  say(CL, v, /We go now/);
  beat(CL, 'o_farm_raiders');
  arrive(CL, k.village);
  v = CL.story.talk('origin_headman', c);
  say(CL, v, /To Harrowgate/);
  assert.equal(c.roster.length, 3, 'the men stay with you: the farmhand’s edge, soldiers without a fee');
  arrive(CL, 'harrowgate');
  assert.equal(CL.story.questStatus(c, 'o_farmhand'), 'done');
  inBand(CL, c, 'farmhand');
  assert.match(CL.story.talk('story_elder', c).text, /you led its men well/);
});

test('P10-06, the scout, from Hrothmark: the recruiter, two hires, the border village, the road watchers; +1 Agility', () => {
  const { CL } = newCampaign(16, 'scout', { realm: 'hrothmark', plain: false });
  const c = CL.campaign;
  const k = c.story.cast;
  assert.equal(c.world.location, 'hrothgard');
  assert.ok(CL.town.streetPeople('hrothgard').some((p) => p.id === 'origin_recruiter' && p.name === 'Halvar Axehand'), 'the recruiter speaks the opening, before his own talk');
  say(CL, CL.story.talk('origin_recruiter', c), /find them/);
  hire(CL, 2);
  arrive(CL, k.border);
  assert.equal(CL.story.state(c).quests.o_scout.stage, 'o_scout_camp');
  beat(CL, 'o_scout_watchers');
  arrive(CL, 'hrothgard');
  const agi = c.character.attributes.agi;
  say(CL, CL.story.talk('origin_recruiter', c), /go and see/);
  assert.equal(c.character.attributes.agi, agi + 1, 'the edge');
  inBand(CL, c, 'scout');
  assert.equal(CL.town.streetPeople('hrothgard').find((p) => p.name === 'Halvar Axehand').id, 'story_recruiter', 'back to his own talk');
});

test('P10-06, the peddler, from Vessaro: the merchant, two guards, grain bought in the village and sold in the town', () => {
  const { CL } = newCampaign(17, 'peddler', { realm: 'vessaro', plain: false });
  const c = CL.campaign;
  const k = c.story.cast;
  let gold = c.gold;
  say(CL, CL.story.talk('origin_merchant', c), /deal/);
  assert.equal(c.gold, gold + 25, 'toward the grain: nobody is stuck without the crowns to buy it');
  hire(CL, 2);
  arrive(CL, k.village);
  assert.ok(CL.trade.buy(c, k.village, 'grain', 2).ok);
  assert.equal(CL.story.state(c).quests.o_peddler.stage, 'o_ped_sell');
  arrive(CL, 'vessara');
  assert.ok(CL.trade.sell(c, 'vessara', 'grain', 2).ok);
  gold = c.gold;
  say(CL, CL.story.talk('origin_merchant', c), /go and see/);
  assert.equal(c.gold, gold + 45, 'the edge: a merchant’s thanks');
  inBand(CL, c, 'peddler');
});

test('bots and tests keep the bare start', () => {
  const { CL } = newCampaign(15, 'farmhand'); // plain: the GDD start
  assert.equal(CL.campaign.world.location, 'stonebridge');
  assert.equal(CL.campaign.roster.length, 0);
  assert.equal(CL.campaign.gold, 60);
  assert.equal(CL.story.questStatus(CL.campaign, 'o_farmhand'), 'unstarted');
  assert.equal(CL.story.questStatus(CL.campaign, 'q1'), 'active');
});

test('each opening band can be beaten or cowed: Intimidate moves the quest on too', () => {
  const { CL } = loadGame({ party: false });
  for (const o of Object.values(CL.content.table('origins')).filter((x) => x.quest)) {
    for (const st of CL.content.get('quests', o.quest).stages.filter((s) => s.band)) {
      const on = st.on.filter((t) => t.match?.tag === st.band.tag);
      assert.ok(on.some((t) => t.event === 'battle') && on.some((t) => t.event === 'parley' && t.match.outcome === 'intimidate'), `${o.quest}.${st.id}`);
      const next = (t) => t.do.find((e) => e.stage)?.stage;
      assert.equal(next(on.find((t) => t.event === 'parley')), next(on.find((t) => t.event === 'battle')), `${st.id}: the same way on`);
    }
  }
});
