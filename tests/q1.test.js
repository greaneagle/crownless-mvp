// Q1 "A Stranger's Wage" (GDD §4 onboarding; Gate D 4.8): three routes, one destination.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** Pick the option whose text matches. */
function say(CL, conv, re) {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
}

/** Travel on the real world map until arrival (or an encounter stops us). */
function travel(CL, sid) {
  const s = CL.content.get('settlements', sid);
  if (CL.game.mode !== 'map') CL.world.leaveSettlement();
  CL.world.travelTo({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY });
  for (let i = 0; i < 5000 && CL.game.travel && CL.game.mode === 'map'; i++) CL.world.update(0.1);
}

function fightAndWin(CL) {
  assert.equal(CL.game.mode, 'encounter');
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
}

const stage = (CL) => CL.story.state(CL.campaign).quests.q1?.stage;

function takeWork(CL, route) {
  let v = CL.story.talk('stonebridge_elder');
  v = say(CL, v, /work for me/);
  assert.equal(v.node, 'q1_work');
  return say(CL, v, route);
}

/** Report to the Elder and collect. */
function report(CL) {
  const c = CL.campaign;
  const before = { gold: c.gold, renown: c.renown, rep: c.reputation.valedorn };
  let v = CL.story.talk('stonebridge_elder');
  assert.equal(v.node, 'q1_report');
  const text = v.text;
  v = say(CL, v, /What is it/);
  assert.equal(v.node, 'q1_charter');
  assert.match(v.text, /Eastwatch/, 'points the way to Q2');
  assert.equal(CL.story.questStatus(c, 'q1'), 'done');
  assert.equal(c.gold, before.gold + 50);
  assert.equal(c.renown, before.renown + 15, 'GDD: major story resolution +15 renown');
  assert.equal(c.reputation.valedorn, before.rep + 10, 'GDD: helping a faction +10');
  assert.equal(c.inventory.charter_fragment, 1);
  assert.equal(CL.story.state(c).flags.knows_charter, true);
  return text;
}

test('route 1, the wagon: Oakford, the ambush on the road home, then the Elder', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const v = takeWork(CL, /grain wagon/);
  assert.match(v.text, /Oakford/);
  assert.equal(stage(CL), 'q1_wagon_go');
  assert.equal(c.parties.some((p) => p.questTag), false, 'no ambush yet');

  travel(CL, 'oakford');
  assert.equal(c.world.location, 'oakford');
  assert.equal(stage(CL), 'q1_wagon_back');
  const band = c.parties.find((p) => p.questTag === 'q1_ambush');
  assert.ok(band, 'the ambush is waiting');
  assert.deepEqual({ ...band.troops }, { looter: 3 });

  travel(CL, 'stonebridge');
  assert.equal(CL.game.partyId, band.id, 'the Reavers stop the wagon');
  assert.match(CL.parties.current().text, /grain wagon/, 'the ambush has its own words');
  fightAndWin(CL);
  assert.equal(stage(CL), 'q1_report');
  assert.equal(c.parties.some((p) => p.questTag), false);
  travel(CL, 'stonebridge');
  assert.match(report(CL), /broke the ambush/);
});

test('route 1 variant: slipping past the ambush still finishes the job', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  takeWork(CL, /grain wagon/);
  travel(CL, 'oakford');
  const band = c.parties.find((p) => p.questTag === 'q1_ambush');
  band.ignoreUntil = 99; // they never notice us
  travel(CL, 'stonebridge');
  assert.equal(c.world.location, 'stonebridge');
  assert.equal(stage(CL), 'q1_report');
  assert.equal(c.parties.includes(band), false, 'the ambush packs up');
  assert.match(report(CL), /slipped past/);
});

test('route 1: losing to the ambush or losing the band does not soft-lock the quest', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  takeWork(CL, /grain wagon/);
  travel(CL, 'oakford');
  let band = c.parties.find((p) => p.questTag === 'q1_ambush');
  CL.game.partyId = band.id;
  CL.parties.attack();
  CL.debugTools.endBattleNow(false);
  CL.world.returnToMap();
  assert.equal(stage(CL), 'q1_wagon_back');
  assert.ok(c.parties.some((p) => p.questTag === 'q1_ambush'), 'still waiting');
  // Gone some other way (an old save, say): it comes back.
  c.parties = c.parties.filter((p) => !p.questTag);
  CL.parties.ensure(c);
  band = c.parties.find((p) => p.questTag === 'q1_ambush');
  assert.ok(band);
  // Patrols leave it alone and it fights nobody off-screen.
  const patrol = CL.parties.spawn(c, 'valedorn_patrol');
  Object.assign(patrol, { x: band.x, y: band.y, troops: { guard: 20 } });
  c.world.location = 'stonebridge';
  CL.parties.tick(c, 1);
  assert.ok(c.parties.includes(band));
  // Saved and reloaded, it keeps its tag.
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.parties.find((p) => p.id === band.id).questTag, 'q1_ambush');
});

test('route 2, the Reavers: any band or the Looter Camp will do', () => {
  for (const how of ['band', 'camp']) {
    const { CL } = loadGame({ random: () => 0.99 });
    const c = CL.campaign;
    takeWork(CL, /Reavers/);
    assert.equal(stage(CL), 'q1_bandits');
    if (how === 'band') {
      const p = CL.parties.spawn(c, 'bandits');
      CL.parties.open(p.id);
    } else {
      CL.game.siteId = 'looter_camp';
      CL.game.partyId = null;
      CL.ui.changeMode('encounter');
    }
    fightAndWin(CL);
    assert.equal(stage(CL), 'q1_report', how);
    assert.match(report(CL), /think twice/);
  }
});

test('route 3, the recruiter: Brun’s advance, three hires, one won fight', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  takeWork(CL, /Sergeant Brun/);
  assert.equal(stage(CL), 'q1_recruits');
  let v = CL.story.talk('sergeant_brun');
  assert.equal(v.node, 'q1');
  const gold = c.gold;
  v = say(CL, v, /Thank you/);
  assert.equal(c.gold, gold + 15);
  assert.equal(CL.story.talk('sergeant_brun').node, 'talk', 'the advance is paid once');
  c.gold = 500;
  CL.party.recruit('levy');
  CL.party.recruit('levy');
  assert.equal(stage(CL), 'q1_recruits');
  assert.match(CL.story.currentQuest().objective, /2\/3/);
  CL.party.recruit('hunter');
  assert.equal(stage(CL), 'q1_drill');
  const p = CL.parties.spawn(c, 'bandits');
  CL.parties.open(p.id);
  fightAndWin(CL);
  assert.equal(stage(CL), 'q1_report');
  assert.match(report(CL), /recruits held their line/);
});

test('“let me think on it” keeps the quest open; the Elder offers the work again', () => {
  const { CL } = loadGame();
  let v = CL.story.talk('stonebridge_elder');
  v = say(CL, v, /work for me/);
  assert.equal(say(CL, v, /think on it/), null);
  assert.equal(stage(CL), 'q1_choose_work');
  v = CL.story.talk('stonebridge_elder');
  assert.equal(v.node, 'again');
  v = say(CL, v, /About that work/);
  assert.equal(v.node, 'q1_work');
  v = say(CL, v, /Reavers/);
  assert.equal(stage(CL), 'q1_bandits');
  v = CL.story.talk('stonebridge_elder');
  assert.equal(say(CL, v, /About that work/).node, 'q1_progress');
});

test('Q1 is optional: the sandbox runs without it and the Elder can wait', () => {
  const { CL } = loadGame();
  CL.party.advanceDays(20);
  assert.equal(CL.story.questStatus(CL.campaign, 'q1'), 'unstarted');
  const v = CL.story.talk('stonebridge_elder');
  assert.ok(v.options.some((o) => /work for me/.test(o.text)));
});
