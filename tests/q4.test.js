// Q4 "The Greywall Verdict" (GDD §4 climax; Gate D pass: "each ending is reachable, no quest
// soft-lock, sandbox continues").
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function say(CL, conv, re) {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
}

/** Finished Q1–Q3 with the given Q2 and Q3 choices; Q4 should be under way. */
function ready({ q2 = 'kept', q3 = 'road', packet = q2 === 'kept', opts } = {}) {
  const env = loadGame({ random: () => 0.99, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  const s = CL.story.state(c);
  const done = { status: 'done', stage: null, notes: [], startedDay: 0, endedDay: 0 };
  s.quests.q1 = { ...done };
  s.quests.q2 = { ...done };
  s.flags.q2_choice = q2;
  if (q2 === 'kept') s.flags.has_evidence = true;
  if (packet) c.inventory.courier_packet = 1;
  // Finish Q3 for real so its completion starts Q4.
  s.quests.q3 = { status: 'active', stage: 'q3_road', notes: [], startedDay: 0, stageDay: 0 };
  s.flags.q3_side = q3;
  CL.story.apply([{ complete: 'q3' }, { start: 'q4' }], c, { quest: 'q3' });
  return env;
}

const stage = (CL) => CL.story.state(CL.campaign).quests.q4?.stage;
const host = (CL) => CL.campaign.parties.find((p) => p.questTag === 'q4_host');

function winField(CL) {
  const p = host(CL);
  assert.ok(p, 'the host is on the field');
  CL.parties.open(p.id);
  assert.equal(CL.parties.current().def.map, 'greywall_courtyard', 'fought at Greywall');
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
  assert.equal(stage(CL), 'q4_terms');
  assert.ok(CL.story.peopleAt('greywall_fort').some((t) => t.id === 'story_parley'));
}

test('finishing Q3 begins Q4; all three declarations are offered', () => {
  const { CL } = ready();
  assert.equal(stage(CL), 'q4_declare');
  assert.equal(CL.story.talk('crown_agent').node, 'q4_declare');
  assert.equal(CL.story.talk('rival_agent').node, 'q4_declare');
  assert.equal(CL.story.talk('story_elder').node, 'q4_road');
  assert.equal(CL.story.peopleAt('greywall_fort').length, 0, 'no parley before the battle');
});

test('ending 1 — the Crown holds Greywall', () => {
  const { CL, uiCalls } = ready({ q2: 'crown', q3: 'crown' });
  const c = CL.campaign;
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian', 'GDD edge case: a fort changes owner before Q4');
  say(CL, CL.story.talk('crown_agent'), /stand with the Crown/);
  assert.equal(stage(CL), 'q4_field_crown');
  assert.equal(host(CL).template, 'aurelian_patrol');
  winField(CL);
  const before = { ...c.reputation };
  const v = CL.story.talk('story_parley');
  assert.deepEqual(
    Array.from(v.options.map((o) => o.text)),
    ['Greywall stays with the Crown.', 'Not yet. I need a moment.'],
  );
  say(CL, v, /stays with the Crown/);
  assert.equal(CL.story.questStatus(c, 'q4'), 'done');
  assert.equal(CL.realm.owner('greywall_fort', c), 'valedorn', 'retaken');
  assert.equal(c.reputation.valedorn, before.valedorn + 25);
  assert.equal(c.reputation.aurelian, Math.max(-100, before.aurelian - 25));
  assert.equal(CL.story.state(c).flags.ending, 'crown');
  const shown = uiCalls.find((x) => x[0] === 'showEnding')?.[1];
  assert.equal(shown.title, 'The Crown Holds Greywall');
  assert.match(shown.text, /King’s hall/, 'remembers the Q2 choice');
});

test('ending 2 — the Remnant takes Greywall', () => {
  const { CL, uiCalls } = ready({ q2: 'rival', q3: 'rival' });
  const c = CL.campaign;
  say(CL, CL.story.talk('rival_agent'), /stand with the Remnant/);
  assert.equal(host(CL).template, 'valedorn_patrol');
  winField(CL);
  say(CL, CL.story.talk('story_parley'), /passes to the Remnant/);
  assert.equal(CL.realm.owner('greywall_fort', c), 'aurelian');
  assert.deepEqual(Array.from(CL.party.recruitsHere.call(null, { ...c, world: { ...c.world, location: 'greywall_fort' } })), ['recruit', 'skirmisher']);
  assert.equal(CL.story.state(c).flags.ending, 'rival');
  assert.equal(uiCalls.find((x) => x[0] === 'showEnding')[1].title, 'The Remnant Takes Greywall');
});

test('ending 3 — the road peace: refuse both crowns and lay the kept packet on the table', () => {
  const { CL, uiCalls } = ready({ q2: 'kept', q3: 'road' });
  const c = CL.campaign;
  const v = CL.story.talk('story_elder');
  assert.match(v.text, /Oswin’s packet/);
  say(CL, v, /stand for the road/);
  assert.equal(host(CL).template, 'bandits');
  winField(CL);
  const owner = CL.realm.owner('greywall_fort', c);
  const before = { ...c.reputation };
  const terms = CL.story.talk('story_parley');
  assert.deepEqual(
    Array.from(terms.options.map((o) => o.text)),
    ['Lay both charters on the table: neither claim is clean.', 'Not yet. I need a moment.'],
  );
  say(CL, terms, /Lay both charters/);
  assert.equal(CL.story.state(c).flags.ending, 'compromise');
  assert.equal(CL.realm.owner('greywall_fort', c), owner, 'the garrison stays; the gates open to both');
  assert.equal(c.reputation.valedorn, before.valedorn + 25);
  assert.equal(c.reputation.aurelian, before.aurelian + 25);
  assert.equal('courier_packet' in c.inventory, false);
  assert.equal(uiCalls.find((x) => x[0] === 'showEnding')[1].title, 'The Road Peace');
});

test('the road without evidence: the envoys make you choose a crown (no soft-lock)', () => {
  const { CL } = ready({ q2: 'crown', q3: 'road', packet: false });
  say(CL, CL.story.talk('story_elder'), /stand for the road/);
  winField(CL);
  const v = CL.story.talk('story_parley');
  assert.match(v.text, /Without proof/);
  assert.deepEqual(
    Array.from(v.options.map((o) => o.text)),
    ['Greywall stays with the Crown.', 'Greywall passes to the Remnant.', 'Not yet. I need a moment.'],
  );
  const before = { ...CL.campaign.reputation };
  say(CL, v, /passes to the Remnant/);
  assert.equal(CL.story.state(CL.campaign).flags.ending, 'rival');
  assert.equal(CL.campaign.reputation.valedorn, before.valedorn, 'no betrayal penalty for a neutral broker');
});

test('a lost deciding battle can be fought again; "not yet" at the parley waits', () => {
  const { CL } = ready({ q2: 'crown', q3: 'crown' });
  say(CL, CL.story.talk('crown_agent'), /stand with the Crown/);
  const p = host(CL);
  CL.parties.open(p.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(false);
  CL.world.returnToMap();
  assert.equal(stage(CL), 'q4_field_crown');
  assert.ok(host(CL), 'the host still waits');
  winField(CL);
  assert.equal(say(CL, CL.story.talk('story_parley'), /Not yet/), null);
  assert.equal(stage(CL), 'q4_terms');
});

test('Mara’s fate is written into the ending', () => {
  for (const [flags, re] of [
    [{ mara_saved: true }, /Mara rides at your side/],
    [{ mara_gone: 'fell' }, /a place for Mara/],
  ]) {
    const { CL, uiCalls } = ready({ q2: 'crown', q3: 'crown' });
    Object.assign(CL.story.state(CL.campaign).flags, flags);
    say(CL, CL.story.talk('crown_agent'), /stand with the Crown/);
    winField(CL);
    say(CL, CL.story.talk('story_parley'), /stays with the Crown/);
    assert.match(uiCalls.find((x) => x[0] === 'showEnding')[1].text, re);
  }
});

test('after the ending the sandbox carries on: contracts, travel, people remember', () => {
  const { CL } = ready({ q2: 'kept', q3: 'road' });
  const c = CL.campaign;
  say(CL, CL.story.talk('story_elder'), /stand for the road/);
  winField(CL);
  say(CL, CL.story.talk('story_parley'), /Lay both charters/);
  assert.equal(CL.story.currentQuest(), null);
  assert.equal(CL.story.peopleAt('greywall_fort').length, 0, 'the parley has packed up');
  CL.party.advanceDays(3);
  c.world.location = 'stonebridge';
  assert.ok(CL.contracts.offerAt(c, 'stonebridge'), 'work is still posted');
  let heard = false;
  for (let i = 0; i < 8 && !heard; i++) heard = /Warden of the Road/.test(CL.story.view('story_elder', 'again', c, i).text);
  assert.ok(heard, 'the Elder remembers');
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.story.flags.ending, 'compromise');
  assert.equal(s.story.quests.q4.status, 'done');
});
