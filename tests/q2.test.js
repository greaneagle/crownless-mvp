// Q2 "The Broken Seal" (GDD §4 investigation; Gate D 4.9): three ways to the packet, three choices.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function say(CL, conv, re) {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
}

const stage = (CL) => CL.story.state(CL.campaign).quests.q2?.stage;
const people = (CL, sid) => CL.story.peopleAt(sid).map((t) => t.id);

/** Accept Q2 from Oswin in Eastwatch. */
function accept(CL) {
  CL.campaign.world.location = 'eastwatch';
  assert.ok(people(CL, 'eastwatch').includes('caravan_master'));
  let v = CL.story.talk('caravan_master');
  assert.equal(v.node, 'intro');
  v = say(CL, v, /find your packet/);
  assert.equal(v.node, 'q2_go');
  assert.equal(stage(CL), 'q2_recover');
  return CL.campaign.parties.find((p) => p.questTag === 'q2_thieves');
}

test('Oswin’s offer notices the charter fragment from Q1', () => {
  const { CL } = loadGame();
  assert.doesNotMatch(CL.story.talk('caravan_master').text, /same eagle/);
  CL.campaign.inventory.charter_fragment = 1;
  assert.match(CL.story.talk('caravan_master').text, /same eagle/);
});

test('Q2 does not need Q1: anyone can take it in Eastwatch', () => {
  const { CL } = loadGame();
  assert.equal(CL.story.questStatus(CL.campaign, 'q1'), 'unstarted');
  const band = accept(CL);
  assert.ok(band, 'the thieves wait on the river road');
  assert.deepEqual({ ...band.troops }, { looter: 4, reaver: 2 });
  // A camp, not an ambush: the way to Highmere stays open.
  CL.campaign.world.location = null;
  Object.assign(CL.campaign.world, { x: band.x + 1, y: band.y });
  CL.game.mode = 'map';
  band.ignoreUntil = 0;
  assert.equal(CL.parties.wantsPlayer(CL.campaign, band), false);
  assert.equal(CL.save.sanitize(JSON.parse(JSON.stringify(CL.campaign))).parties.find((p) => p.id === band.id).camp, true);
});

test('way 1: fight the thieves for the packet', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const band = accept(CL);
  CL.parties.open(band.id);
  assert.match(CL.parties.current().text, /courier’s satchel/);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  assert.equal(stage(CL), 'q2_choose');
  assert.equal(CL.campaign.inventory.courier_packet, 1);
  assert.equal(CL.story.state(CL.campaign).flags.q2_how, 'fought');
});

test('way 2: a strong enough company cows them into giving it up', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const band = accept(CL);
  CL.parties.open(band.id);
  assert.equal(CL.parties.negotiation(c, CL.parties.current()).kind, 'toll', 'too weak to intimidate yet');
  for (let i = 0; i < 15; i++) CL.save.addSoldier(c, 'guard');
  assert.equal(CL.parties.negotiation(c, CL.parties.current()).kind, 'intimidate');
  CL.parties.negotiate();
  assert.equal(stage(CL), 'q2_choose');
  assert.equal(c.inventory.courier_packet, 1);
  assert.equal(c.parties.includes(band), false, 'the thieves are gone');
});

test('paying the thieves’ toll only buys passage', () => {
  const { CL } = loadGame();
  const band = accept(CL);
  CL.campaign.gold = 500;
  CL.parties.open(band.id);
  CL.parties.negotiate();
  assert.equal(stage(CL), 'q2_recover');
  assert.equal('courier_packet' in CL.campaign.inventory, false);
});

test('way 3: the fence in Highmere sells the hiding place for 60 crowns', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  assert.equal(people(CL, 'highmere').includes('bandit_informant'), false, 'only while the packet is missing');
  accept(CL);
  assert.ok(people(CL, 'highmere').includes('bandit_informant'));
  c.gold = 59;
  let v = CL.story.talk('bandit_informant');
  assert.equal(
    v.options.some((o) => /Pay 60/.test(o.text)),
    false,
    'can’t afford it',
  );
  c.gold = 100;
  v = CL.story.talk('bandit_informant');
  v = say(CL, v, /Pay 60/);
  assert.equal(c.gold, 40);
  assert.equal(stage(CL), 'q2_choose');
  assert.equal(c.inventory.courier_packet, 1);
  assert.equal(
    c.parties.some((p) => p.questTag === 'q2_thieves'),
    false,
  );
  assert.equal(people(CL, 'highmere').includes('bandit_informant'), false);
});

/** Get to the choice the cheap way. */
function withPacket(CL) {
  accept(CL);
  CL.campaign.gold = 200;
  say(CL, CL.story.talk('bandit_informant'), /Pay 60/);
}

test('choice A: show it to Captain Aldric — Valedorn +25, Aurelian −10', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  withPacket(CL);
  const gold = c.gold;
  let v = CL.story.talk('crown_agent');
  assert.equal(v.node, 'q2');
  v = say(CL, v, /Show the packet to the Crown/);
  assert.equal(v.node, 'q2_thanks');
  assert.equal(CL.story.questStatus(c, 'q2'), 'done');
  assert.deepEqual({ ...c.reputation }, { valedorn: 25, aurelian: -10, hrothmark: 0, vessaro: 0, merrow: 0, ostrand: 0, saltreach: 0, gullhaven: 0 });
  assert.equal(c.gold, gold + 80);
  assert.equal('courier_packet' in c.inventory, false);
  assert.equal(CL.realm.standing(c, 'valedorn'), 'friendly');
  // Dialogue remembers.
  assert.match(CL.story.talk('caravan_master').text, /Crown’s men walk taller/);
  for (let i = 0; i < 6; i++) {
    const t = CL.story.view('rival_agent', 'talk', c, i).text; // her small talk (Q3 offers come first now)
    if (/handed that packet to the Crown/.test(t)) return;
  }
  assert.fail('the magistrate never mentions it');
});

test('choice B: show it to Magistrate Vell — Aurelian +25, Valedorn −10', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  withPacket(CL);
  say(CL, CL.story.talk('rival_agent'), /Show the packet to the magistrate/);
  assert.deepEqual({ ...c.reputation }, { valedorn: -10, aurelian: 25, hrothmark: 0, vessaro: 0, merrow: 0, ostrand: 0, saltreach: 0, gullhaven: 0 });
  assert.equal(CL.story.state(c).flags.q2_choice, 'rival');
  assert.match(CL.story.talk('caravan_master').text, /Aurelian claim/);
});

test('choice C: keep it — no reputation change, the evidence flag for the Q4 compromise', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  withPacket(CL);
  const v = CL.story.talk('caravan_master');
  assert.equal(v.node, 'q2_read');
  assert.match(v.text, /two charters/i);
  say(CL, v, /keep it/);
  assert.equal(CL.story.questStatus(c, 'q2'), 'done');
  assert.deepEqual({ ...c.reputation }, { valedorn: 0, aurelian: 0, hrothmark: 0, vessaro: 0, merrow: 0, ostrand: 0, saltreach: 0, gullhaven: 0 });
  assert.equal(c.inventory.courier_packet, 1, 'still carried, protected from sale');
  assert.equal(CL.story.state(c).flags.has_evidence, true);
  assert.equal(CL.trade.sellGear(c, 'eastwatch', 'courier_packet').ok, false);
  assert.notEqual(CL.story.talk('crown_agent').node, 'q2', 'Aldric no longer asks for it as a quest');
});

test('the agents only take the packet while you carry it', () => {
  const { CL } = loadGame();
  withPacket(CL);
  delete CL.campaign.inventory.courier_packet; // lost somehow
  assert.equal(CL.story.talk('crown_agent').node, 'talk');
  assert.equal(
    CL.story.talk('caravan_master').options.some((o) => /keep it/.test(o.text)),
    false,
  );
});
