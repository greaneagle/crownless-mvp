// V2-Q errands: small optional quests that show the new systems, built with the quest interpreter.
// Each is walked end to end here through the real systems (the story bot leaves them alone).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A company with money and soldiers, standing in a settlement. */
function camp(at = 'stonebridge', soldiers = ['levy', 'levy', 'levy', 'hunter', 'hunter']) {
  const env = loadGame({ random: () => 0.5 });
  const { CL } = env;
  const c = CL.campaign;
  c.gold = 800;
  c.roster = [];
  for (const t of soldiers) CL.save.addSoldier(c, t, null, { origin: 'stonebridge' });
  c.food = 0;
  go(CL, c, at);
  return { ...env, c };
}
function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
/** Talk to someone and pick options by text, in order. Returns the last view. */
function say(CL, who, ...picks) {
  let v = CL.story.talk(who);
  for (const p of picks) {
    const o = v?.options.find((x) => p.test(x.text));
    assert.ok(o, `${who}: no option ${p} in ${JSON.stringify(v?.options.map((x) => x.text))}`);
    v = CL.story.choose(v, o.index);
  }
  return v;
}
const status = (CL, c, id) => CL.story.questStatus(c, id);
const stage = (CL, c, id) => CL.story.state(c).quests[id]?.stage;

test('every errand is optional (side: true), offered by someone you know, and can be turned down', () => {
  const { CL } = loadGame();
  const errands = Object.values(CL.content.table('quests')).filter((q) => q.side);
  assert.deepEqual(errands.map((q) => q.id).sort(), ['sq_border', 'sq_homecoming', 'sq_larders', 'sq_planned', 'sq_venture']);
  for (const q of errands) {
    const t = CL.content.table('dialogue')[q.giver];
    const offer = Object.entries(t.nodes).find(([id, n]) => id.startsWith('sq_') && (n.options || []).some((o) => (o.do || []).some((e) => e.start === q.id)));
    assert.ok(offer, `${q.id}: an offer`);
    assert.ok(offer[1].options.some((o) => !o.do), `${q.id}: a way to say no`);
  }
  // The main story never waits on an errand.
  for (const q of Object.values(CL.content.table('quests')).filter((x) => !x.side)) assert.equal(JSON.stringify(q).includes('sq_'), false, `${q.id} never refers to an errand`);
});

test('Home from the Wars (named soldiers, chronicle): a Stonebridge-born veteran is feasted at home', () => {
  const { CL, c } = camp();
  CL.story.state(c).flags.met_elder = true;
  const vet = c.roster[1];
  vet.record.battles = 4;
  assert.match(CL.story.talk('stonebridge_elder').options.map((o) => o.text).join('|'), new RegExp(`One of my soldiers was born here: ${vet.name}\\.`));
  say(CL, 'stonebridge_elder', /born here/, /buy the grain/);
  assert.equal(stage(CL, c, 'sq_homecoming'), 'sq_home_grain');
  assert.equal(CL.trade.buy(c, 'stonebridge', 'grain', 2).ok, true);
  assert.equal(stage(CL, c, 'sq_homecoming'), 'sq_home_report');
  const xp = vet.xp;
  say(CL, 'stonebridge_elder', /grain for the feast/, /^To /);
  assert.equal(status(CL, c, 'sq_homecoming'), 'done');
  assert.equal(vet.xp, xp + 30);
  assert.equal(CL.soldiers.noteText(vet.notes.at(-1)), 'Feted at home in Stonebridge.');
  assert.equal(c.chronicle.at(-1).kind, 'quest', 'in the company chronicle');
  assert.equal(CL.story.journal(c).find((r) => r.id === 'sq_homecoming').side, true);
});

test('Full Larders (quartermaster): hire one, let them lay in stores, report to Brun', () => {
  const { CL, c } = camp();
  say(CL, 'sergeant_brun', /advice for a growing company/, /find one/);
  assert.equal(stage(CL, c, 'sq_larders'), 'sq_larders_hire');
  CL.quartermaster.hire(c); // hiring: wages set aside and food bought at once
  assert.equal(stage(CL, c, 'sq_larders'), 'sq_larders_report');
  say(CL, 'sergeant_brun', /laid in stores/, /Thank you/);
  assert.equal(status(CL, c, 'sq_larders'), 'done');
  // Already have one when Brun asks: straight to laying in stores.
  const b = camp();
  b.CL.quartermaster.hire(b.c);
  say(b.CL, 'sergeant_brun', /advice/, /find one/);
  assert.equal(stage(b.CL, b.c, 'sq_larders'), 'sq_larders_stock');
});

test('A Merchant’s First Venture (merchant): hire, trade until a profitable sale, tell Oswin', () => {
  const { CL, c } = camp('eastwatch');
  say(CL, 'caravan_master', /earn from its wagons/, /try it/);
  CL.merchant.hire(c);
  CL.merchant.fund(c, 200);
  assert.equal(stage(CL, c, 'sq_venture'), 'sq_venture_trade');
  for (const sid of ['oakford', 'saltmere', 'oakford']) {
    c.day += 1;
    go(CL, c, sid);
    CL.merchant.visit(c);
  }
  assert.equal(stage(CL, c, 'sq_venture'), 'sq_venture_report', 'salt bought in Saltmere sold dearer in Oakford');
  go(CL, c, 'eastwatch');
  say(CL, 'caravan_master', /turned a profit/, /They will be/);
  assert.equal(status(CL, c, 'sq_venture'), 'done');
});

test('Smoke on the Border (reinforcements): the Valedorn watch rides in to the raiders’ fight', () => {
  const { CL, c } = camp();
  say(CL, 'valedorn_agent', /work on the frontier/, /break them/);
  const raiders = c.parties.find((p) => p.questTag === 'sq_border_raiders');
  const watch = c.parties.find((p) => p.questTag === 'sq_border_watch');
  assert.ok(raiders && watch);
  Object.assign(c.world, { x: raiders.x, y: raiders.y, location: null });
  CL.parties.open(raiders.id);
  const plan = CL.reinforce.plan(c, CL.parties.current());
  assert.equal(JSON.stringify(plan.map((j) => [j.id, j.side])), JSON.stringify([[watch.id, 'ally']]), 'the watch comes, though Valedorn is only neutral');
  assert.ok(plan[0].arriveAt <= 20, 'in time for an ordinary fight');
  CL.parties.attack();
  CL.reinforce.arrive(CL.game, CL.game.joining[0]);
  const rep = c.reputation.valedorn;
  CL.debugTools.endBattleNow(true);
  assert.equal(status(CL, c, 'sq_border'), 'done');
  assert.ok(CL.story.state(c).quests.sq_border.notes.some((n) => /watch rode in/.test(n)));
  assert.ok(c.reputation.valedorn >= rep + 10, 'thanks from the Crown (stage bonus and reward)');
  assert.equal(c.parties.some((p) => p.questTag === 'sq_border_watch'), false, 'the watch goes back to its post (off the map)');
});

test('A Planned Engagement (battle preparation): fight the drilled Reavers to a plan', () => {
  const { CL, c } = camp('stonebridge', ['footman', 'footman', 'footman', 'hunter', 'hunter', 'levy']);
  say(CL, 'sergeant_brun', /fight to a plan/, /take them on/);
  const band = c.parties.find((p) => p.questTag === 'sq_planned_reavers');
  Object.assign(c.world, { x: band.x, y: band.y, location: null });
  CL.parties.open(band.id);
  const map = CL.arena.mapFor(CL.parties.current().def.map);
  CL.parties.attack(CL.prep.plan('defensive', map));
  const renown = c.renown;
  CL.debugTools.endBattleNow(true);
  assert.equal(status(CL, c, 'sq_planned'), 'done');
  assert.ok(CL.story.state(c).quests.sq_planned.notes.some((n) => /chose your setup/.test(n)));
  assert.ok(c.renown >= renown + 15, 'the plan earned a little more renown');
  // Settled by auto-resolve, it still ends (no lock-out), without the bonus.
  const b = camp('stonebridge', ['footman', 'footman', 'footman', 'footman', 'hunter', 'hunter']);
  say(b.CL, 'sergeant_brun', /fight to a plan/, /take them on/);
  const band2 = b.c.parties.find((p) => p.questTag === 'sq_planned_reavers');
  b.CL.parties.open(band2.id);
  for (let i = 0; i < 6 && status(b.CL, b.c, 'sq_planned') === 'active'; i++) {
    if (b.CL.parties.find(b.c, band2.id)) {
      b.CL.parties.open(band2.id);
      b.CL.parties.autoResolve();
    }
  }
  assert.equal(status(b.CL, b.c, 'sq_planned'), 'done');
  assert.ok(b.CL.story.state(b.c).quests.sq_planned.notes.some((n) => /not quite to Brun/.test(n)));
});
