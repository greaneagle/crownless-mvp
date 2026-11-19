// Q3 "Two Banners" (GDD §4 commitment; Gate D): support one, sell to the other, or guard the road —
// and Mara's survival (GDD §10) hangs on reaching the clash in time.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function say(CL, conv, re) {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
}

/** A campaign that has finished Q2 (packet kept), optionally with Mara along. */
function ready({ mara = false, opts } = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const s = CL.story.state(CL.campaign);
  s.quests.q2 = { status: 'done', stage: null, notes: [], startedDay: 0, endedDay: 0 };
  s.flags.q2_choice = 'kept';
  if (mara) assert.equal(CL.companion.join(CL.campaign, 'mara'), true);
  return env;
}

const stage = (CL) => CL.story.state(CL.campaign).quests.q3?.stage;
const band = (CL, tag) => CL.campaign.parties.find((p) => p.questTag === tag);

function winAgainst(CL, p) {
  CL.parties.open(p.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
}

test('the claimants only make their offers once Q2 is done', () => {
  const { CL } = loadGame();
  assert.equal(CL.story.talk('valedorn_agent').node, 'talk');
  const { CL: CL2 } = ready();
  assert.equal(CL2.story.talk('valedorn_agent').node, 'q3_offer');
  assert.equal(CL2.story.talk('aurelian_agent').node, 'q3_offer');
});

test('for the Crown: break the Aurelian column in time and Mara rides back unhurt', () => {
  const { CL } = ready({ mara: true, opts: { random: () => 0.99 } });
  const c = CL.campaign;
  const gold = c.gold;
  let v = CL.story.talk('valedorn_agent');
  assert.equal(
    v.options.some((o) => /Sell/.test(o.text)),
    false,
    'nothing to sell before hearing the other side',
  );
  v = say(CL, v, /ride for the Crown/);
  assert.equal(stage(CL), 'q3_strike_aurelian');
  assert.equal(c.companion.away, true, 'Mara has ridden ahead');
  assert.equal(CL.companion.fit(c), false);
  assert.match(CL.story.currentQuest().objective, /3\.0 days left/);
  const column = band(CL, 'q3_column');
  assert.equal(column.template, 'aurelian_patrol');
  assert.equal(column.camp, true);
  CL.parties.open(column.id);
  assert.equal(CL.parties.current().name, 'Aurelian Supply Column');
  CL.ui.changeMode('map');
  // She is not in this fight's line-up, the column holds its post, and nothing else touches it.
  CL.parties.tick(c, 12);
  assert.ok(Math.hypot(column.x - column.anchor.x, column.y - column.anchor.y) <= 4.5);
  CL.party.advanceDays(1);
  winAgainst(CL, column);
  assert.equal(CL.story.questStatus(c, 'q3'), 'done');
  assert.equal(c.companion.away, false);
  assert.equal(CL.story.state(c).flags.mara_saved, true);
  assert.equal(c.reputation.valedorn, 25);
  assert.equal(c.reputation.aurelian, -15, 'attacking their column costs the usual 15');
  assert.ok(c.gold >= gold + 120);
});

test('too late: Mara is lost for good — her gear comes home, the quest goes on', () => {
  const { CL } = ready({ mara: true, opts: { random: () => 0.99 } });
  const c = CL.campaign;
  c.inventory = {};
  say(CL, CL.story.talk('aurelian_agent'), /ride for the Remnant/);
  assert.equal(stage(CL), 'q3_strike_valedorn');
  assert.equal(band(CL, 'q3_column').template, 'valedorn_patrol');
  CL.party.advanceDays(3.05);
  assert.equal(CL.companion.has(c), false);
  assert.equal(CL.story.state(c).flags.mara_gone, 'fell');
  assert.equal(c.inventory.worn_sword, 1);
  assert.equal(CL.story.state(c).quests.q3.status, 'active', 'still to be finished');
  assert.match(CL.story.journal()[0].notes.join(' '), /too late/);
  CL.party.advanceDays(5);
  assert.equal(CL.story.state(c).quests.q3.notes.filter((n) => /too late/.test(n)).length, 1, 'expires once');
  winAgainst(CL, band(CL, 'q3_column'));
  assert.equal(CL.story.questStatus(c, 'q3'), 'done');
  assert.equal(Boolean(CL.story.state(c).flags.mara_saved), false);
  assert.equal(c.reputation.aurelian, 25);
  assert.equal(CL.companion.join(c, 'mara'), false, 'she never comes back');
});

test('guard the road: the caravan saved, both banners pleased, the compromise flag set', () => {
  const { CL } = ready({ opts: { random: () => 0.99 } });
  const c = CL.campaign;
  say(CL, CL.story.talk('valedorn_agent'), /fight for neither/);
  assert.equal(stage(CL), 'q3_road');
  const raiders = band(CL, 'q3_raiders');
  assert.deepEqual({ ...raiders.troops }, { looter: 5, reaver: 3 });
  winAgainst(CL, raiders);
  assert.equal(CL.story.questStatus(c, 'q3'), 'done');
  assert.deepEqual({ ...c.reputation }, { valedorn: 10, aurelian: 10, hrothmark: 0, vessaro: 0, merrow: 0 });
  assert.equal(CL.story.state(c).flags.road_protector, true);
});

test('sell one side’s plans to the other: paid, but no road-peace credit', () => {
  const { CL } = ready({ opts: { random: () => 0.99 } });
  const c = CL.campaign;
  // Hear Vell out first…
  assert.equal(say(CL, CL.story.talk('aurelian_agent'), /think about it/), null);
  assert.equal(stage(CL), 'q3_choose');
  // …then sell her plans to Aldric.
  const gold = c.gold;
  const v = CL.story.talk('valedorn_agent');
  assert.match(v.text, /offer too/);
  say(CL, v, /Sell the magistrate’s plans/);
  assert.equal(c.gold, gold + 100);
  assert.deepEqual({ ...c.reputation }, { valedorn: 10, aurelian: -25, hrothmark: 0, vessaro: 0, merrow: 0 });
  assert.equal(CL.story.state(c).flags.q3_side, 'sold_to_valedorn');
  assert.equal(stage(CL), 'q3_road');
  winAgainst(CL, band(CL, 'q3_raiders'));
  assert.equal(CL.story.questStatus(c, 'q3'), 'done');
  assert.equal(Boolean(CL.story.state(c).flags.road_protector), false);
});

test('Mara not yet recruited: she scouts anyway, leaves the inn, and owes you if you come', () => {
  const { CL } = ready({ opts: { random: () => 0.99 } });
  const c = CL.campaign;
  const atInn = () => {
    CL.town.enter('stonebridge');
    return CL.game.town.npcs.some((n) => n.id === 'mara');
  };
  assert.equal(atInn(), true);
  say(CL, CL.story.talk('valedorn_agent'), /fight for neither/);
  assert.equal(atInn(), false, 'out scouting');
  winAgainst(CL, band(CL, 'q3_raiders'));
  assert.equal(atInn(), true, 'back at the inn');
  // Saving her earns her trust even after a lie.
  let v = CL.story.talk('mara');
  assert.match(v.text, /rode into that clash for me/);
  v = say(CL, v, /ask me/);
  v = say(CL, v, /Captain Aldric/); // a lie: the packet was kept
  v = say(CL, v, /coin/);
  assert.match(v.text, /came for me on the road/);
  say(CL, v, /Welcome/);
  assert.equal(CL.companion.has(c), true);
});

test('Mara not recruited and too late: she is gone from the inn for good', () => {
  const { CL } = ready();
  say(CL, CL.story.talk('aurelian_agent'), /ride for the Remnant/);
  CL.party.advanceDays(3.5);
  assert.equal(CL.story.state(CL.campaign).flags.mara_gone, 'fell');
  CL.town.enter('stonebridge');
  assert.equal(
    CL.game.town.npcs.some((n) => n.id === 'mara'),
    false,
  );
});

test('a wounded Mara still rides ahead (GDD edge case: companion wounded at story trigger)', () => {
  const { CL } = ready({ mara: true });
  const c = CL.campaign;
  CL.companion.wound(c, 'test');
  say(CL, CL.story.talk('valedorn_agent'), /ride for the Crown/);
  assert.equal(c.companion.away, true);
  CL.party.advanceDays(2.5); // her wound heals while she is away; she is still away
  assert.equal(CL.companion.fit(c), false);
});

test('mid-quest saves keep the clock, the expiry and Mara’s absence', () => {
  const { CL } = ready({ mara: true });
  const c = CL.campaign;
  say(CL, CL.story.talk('valedorn_agent'), /ride for the Crown/);
  CL.party.advanceDays(1);
  let s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.story.quests.q3.stageDay, c.story.quests.q3.stageDay);
  assert.equal(s.companion.away, true);
  CL.party.advanceDays(2.5);
  s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.story.quests.q3.expired, 'q3_strike_aurelian', 'it will not expire twice after a reload');
});
