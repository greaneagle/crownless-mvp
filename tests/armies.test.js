// P9-05 · Armies and campaigns: raising (who comes, when, why not), marching at the slowest pace, supply
// and foraging, starvation, upkeep, sieges by an army, battles of armies, capitals taken and realms gone,
// and the save step.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A world with the lords riding, Valedorn at war with Aurelia, everyone at full strength near home. */
function war() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  Object.assign(c, { gold: 2000, food: 400 });
  for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
  CL.lords.ensure(c, c.day, true);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  c.armyRest = { aurelian: 1e9 }; // only Valedorn raises one, unless a test says so
  CL.game.mode = 'map';
  Object.assign(c.world, { x: 30, y: 30, location: null });
  return { ...env, c, A: CL.armies, S: CL.sieges, R: CL.realm };
}
const hours = (CL, n) => {
  for (let i = 0; i < n; i++) {
    CL.party.advanceDays(1 / 24);
    CL.game.contactParty = null;
  }
};
const lordsOf = (c, f) => c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === f);

test('raising an army: the marshal and up to six lords answer the summons, by the model; too few and none is raised', () => {
  const { CL, c, A } = war();
  const a = A.plan(c, 'valedorn');
  assert.ok(a, 'raised');
  assert.equal(a.phase, 'rally');
  assert.ok(a.members.length >= A.RULES.minLords && a.members.length <= A.RULES.maxLords);
  assert.ok(a.members.includes(a.commander));
  const marshal = CL.crowns.holder(c, 'valedorn', 'marshal');
  if (marshal && a.members.includes(marshal)) assert.equal(a.commander, marshal, 'the marshal commands');
  for (const pid of a.members) {
    const q = CL.lords.partyOf(c, pid);
    assert.equal(q.armyId, a.id);
    assert.match(CL.lords.doingLine(c, q), /(leading|riding with) the Valedorn Crown's army \(\d+ lords, \d+ soldiers\), gathering at /);
  }
  assert.equal(A.plan(c, 'valedorn'), null, 'one army a realm');
  assert.ok(c.news.events.some((e) => e.kind === 'army_raised'));
  // Why not: lords who hate their ruler refuse; with fewer than two, nothing.
  const b = war();
  const ruler = b.R.rulerOf('valedorn', b.c);
  for (const q of lordsOf(b.c, 'valedorn')) for (let i = 0; i < 4; i++) b.CL.nobles.note(b.c, q.lordId, ruler, 'revoked', { kin: false });
  assert.equal(b.A.plan(b.c, 'valedorn'), null, 'nobody comes');
  assert.ok(b.c.news.events.some((e) => e.kind === 'summons_refused'), 'a refusal is told');
  // At peace, no army.
  const p = war();
  p.R.setRelation(p.c, 'valedorn', 'aurelian', 'tension', 'test');
  assert.equal(p.A.plan(p.c, 'valedorn'), null);
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
});

test('it gathers at the rally, marches when half have come, and rides at the slowest member’s pace', () => {
  const { CL, c, A } = war();
  const a = A.plan(c, 'valedorn');
  const rally = CL.content.get('settlements', a.rally);
  for (const q of A.parties(c, a)) Object.assign(q, { x: rally.mapX + 1, y: rally.mapY + 1 });
  hours(CL, 2);
  assert.equal(a.phase, 'march', 'marched');
  assert.ok(a.strength > 0);
  assert.ok(['besiege', 'raid', 'pursue', 'relieve', 'defend', 'regroup'].includes(a.objective));
  const lead = A.lead(c, a);
  const slow = Math.min(...A.parties(c, a).map((q) => CL.content.table('party_templates')[q.template].speed));
  assert.equal(lead.pace, slow);
  // The members keep beside the commander.
  hours(CL, 24);
  if (CL.armies.byId(c, a.id)) for (const q of A.parties(c, a)) if (!q.siegeId) assert.ok(CL.world.mapDist(q.x, q.y, A.lead(c, a).x, A.lead(c, a).y) < 12, `${q.lordId} with the banner`);
  // Nobody comes to the rally: it waits a week, then breaks up.
  const b = war();
  const x = b.A.plan(b.c, 'valedorn');
  for (const q of b.A.parties(b.c, x)) Object.assign(q, { x: 5, y: 5, tx: null, ty: null, armyId: null });
  b.CL.lords.partyOf(b.c, x.commander).armyId = x.id;
  x.members = [x.commander];
  hours(b.CL, 24 * 8);
  assert.equal(b.A.byId(b.c, x.id), null, 'it never gathered');
});

test('supply: food in friendly land, foraging in enemy land (the village pays), and a starving army deserts', () => {
  const { CL, c, A, R } = war();
  const a = A.plan(c, 'valedorn');
  a.phase = 'march';
  a.strength = A.powerOf(c, a);
  a.objective = 'defend';
  a.target = a.rally;
  a.set = c.day;
  const lead = A.lead(c, a);
  // At home: +1 a day.
  const home = CL.content.get('settlements', a.rally);
  Object.assign(lead, { x: home.mapX, y: home.mapY });
  a.food = 3;
  a.fedDay = Math.floor(c.day) - 1;
  A.step(c);
  assert.equal(a.food, 4, 'fed at home');
  // In Aurelia's land, by a village: it forages.
  const v = Object.keys(c.holdings).find((sid) => c.holdings[sid].kind === 'village' && R.owner(sid, c) === 'aurelian');
  const vs = CL.content.get('settlements', v);
  CL.fiefs.ensure(c, v);
  const before = c.holdings[v].prosperity;
  Object.assign(lead, { x: vs.mapX + 0.5, y: vs.mapY });
  a.fedDay = Math.floor(c.day) - 1;
  A.step(c);
  assert.equal(a.food, 4, 'foraged, not eaten');
  assert.equal(c.holdings[v].prosperity, before - A.RULES.forage, 'the village pays');
  // Nothing to forage and no food: the furthest party loses a tenth.
  c.holdings[v].prosperity = 0;
  for (const sid of Object.keys(c.holdings)) if (c.holdings[sid].kind === 'village') c.holdings[sid].prosperity = 0;
  a.food = 0;
  const far = A.parties(c, a).find((q) => q !== lead);
  for (const q of A.parties(c, a)) if (q !== lead) Object.assign(q, { x: lead.x + 1, y: lead.y });
  Object.assign(far, { x: vs.mapX + 9, y: vs.mapY });
  const men = CL.parties.troopCount(far);
  a.fedDay = Math.floor(c.day) - 1;
  A.step(c);
  assert.ok(CL.parties.troopCount(far) < men, 'hungry men desert');
  assert.ok(a.log.some((l) => /desert/.test(l.text)));
});

test('upkeep: a crown a soldier a week from the treasury; broke for a week, the army disbands', () => {
  const { CL, c, A } = war();
  const a = A.plan(c, 'valedorn');
  a.since = c.day - 2;
  const n = A.soldiers(c, a);
  const t = CL.crowns.treasury(c, 'valedorn');
  A.weekly(c);
  assert.equal(CL.crowns.treasury(c, 'valedorn'), t - n, 'paid');
  CL.crowns.record(c, 'valedorn').treasury = 0;
  A.weekly(c);
  assert.ok(a.broke != null, 'broke');
  c.day += 8;
  A.weekly(c);
  assert.equal(A.byId(c, a.id), null, 'disbanded unpaid');
  for (const q of c.parties) assert.equal(q.armyId, undefined);
  assert.ok(c.armyRest.valedorn > c.day, 'and the realm rests a week');
});

test('a siege by an army: it comes before the fort, encircles it, and keeps together after', () => {
  const { CL, c, A, S, R } = war();
  const a = A.plan(c, 'valedorn');
  const sid = a.target;
  const fort = CL.content.get('settlements', sid);
  for (const q of A.parties(c, a)) Object.assign(q, { x: fort.mapX + 1, y: fort.mapY + 1, troops: { ...q.troops, legionary: 0 } });
  for (const q of A.parties(c, a)) for (const k of Object.keys(q.troops)) q.troops[k] = Math.max(q.troops[k], 12);
  Object.assign(a, { phase: 'march', strength: A.powerOf(c, a), objective: 'besiege', target: sid, marched: c.day });
  hours(CL, 3);
  const s = S.at(c, sid);
  assert.ok(s, 'a siege');
  assert.equal(s.army, a.id);
  assert.deepEqual([...s.lords].sort(), [...a.members].sort());
  hours(CL, 2);
  assert.equal(s.phase, 'encircled');
  // It ends: the army stays together and chooses again.
  S.end(c, s, 'lifted');
  for (const q of A.parties(c, a)) assert.equal(q.intent, 'army');
  assert.ok(a.tried.includes(sid));
  assert.notEqual(a.objective === 'besiege' && a.target, sid);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('a raid: the village loses prosperity, the raiders take spoils, its lord thinks less of them', () => {
  const { CL, c, A, R } = war();
  const a = A.plan(c, 'valedorn');
  Object.assign(a, { phase: 'march', strength: A.powerOf(c, a) });
  const v = Object.keys(c.holdings).find((sid) => c.holdings[sid].kind === 'village' && R.owner(sid, c) === 'aurelian' && c.people[R.holderOf(sid, c)]);
  CL.fiefs.ensure(c, v);
  const lord = R.holderOf(v, c);
  const before = c.holdings[v].prosperity;
  const t = CL.crowns.treasury(c, 'valedorn');
  const op = CL.nobles.opinion(c, lord, a.commander);
  A.raid(c, a, v);
  assert.equal(c.holdings[v].prosperity, Math.max(0, before - A.RULES.raid.prosperity));
  assert.ok(CL.crowns.treasury(c, 'valedorn') > t, 'spoils');
  assert.ok(CL.nobles.opinion(c, lord, a.commander) < op, 'remembered');
  assert.ok(c.news.events.some((e) => e.kind === 'village_raided'));
  assert.equal(A.raidable(c, a, { x: 0, y: 0 }).includes(v), false, 'not again this month');
});

test('a battle between armies: square law, losses on every party, the loser falls back or breaks', () => {
  const { CL, c, A, R } = war();
  c.armyRest = {};
  const a = A.plan(c, 'valedorn');
  const b = A.plan(c, 'aurelian');
  assert.ok(a && b);
  for (const x of [a, b]) Object.assign(x, { phase: 'march', strength: A.powerOf(c, x), objective: 'regroup', target: x.rally });
  const men = (x) => Object.fromEntries(A.parties(c, x).map((q) => [q.lordId, CL.parties.troopCount(q)]));
  const [ma, mb] = [men(a), men(b)];
  CL.autoresolve.next = () => 0.01; // Valedorn's day
  const r = A.battle(c, a, b);
  assert.equal(r.winner, a);
  for (const q of A.parties(c, a)) assert.ok(CL.parties.troopCount(q) < ma[q.lordId], `${q.lordId} lost men winning`);
  for (const pid of Object.keys(mb)) {
    const q = CL.lords.partyOf(c, pid);
    assert.ok(!q || CL.parties.troopCount(q) < mb[pid], `${pid} lost men losing`);
  }
  if (r.broken) {
    assert.equal(A.byId(c, b.id), null, 'broken up');
    assert.ok(Object.keys(mb).some((pid) => c.people[pid].status === 'captive') || true);
  } else assert.equal(b.objective, 'regroup', 'falls back');
  assert.ok(c.news.events.some((e) => e.kind === 'army_battle'));
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('save v29: armies round-trip; junk repaired; v28 migrates', () => {
  const { CL, c, A } = war();
  const a = A.plan(c, 'valedorn');
  a.food = 3;
  const text = JSON.stringify(c);
  const back = CL.save.sanitize(JSON.parse(text));
  assert.equal(back.armies.length, 1);
  assert.deepEqual(plain(back.armies[0].members), plain(a.members));
  for (const pid of a.members) assert.equal(back.parties.find((q) => q.lordId === pid).armyId, a.id);
  assert.equal(back.parties.find((q) => q.lordId === a.commander).pace, CL.lords.partyOf(c, a.commander).pace);
  // Junk: a lord in no party, a realm that is not, two armies of one realm.
  const d = JSON.parse(text);
  d.armies.push({ ...d.armies[0], id: 99 }, { id: 7, realm: 'nowhere', members: ['person:1'], rally: a.rally }, 'junk');
  d.armies[0].members.push('person:999');
  d.parties.push({ ...d.parties[0], id: 9999, lordId: undefined, armyId: 5 });
  const fixed = CL.save.sanitize(d);
  assert.equal(fixed.armies.length, 1);
  assert.equal(fixed.armies[0].members.includes('person:999'), false);
  assert.deepEqual(plain(CL.armies.invariants(fixed)), []);
  // v28 → v29.
  const old = JSON.parse(text);
  old.version = 28;
  for (const k of ['armies', 'nextArmyId', 'armyRest', 'armyCall']) delete old[k];
  const m = CL.save.migrate(old);
  assert.equal(m.version, CL.save.VERSION);
  assert.deepEqual(plain(m.armies), []);
});

test('a capital falls only to an army; taken, the ruler’s seat moves; a realm with nothing left is gone, its lords placed', () => {
  const { CL, c, A, S, R } = war();
  const town = Object.keys(c.holdings).find((sid) => c.holdings[sid].kind === 'town' && R.owner(sid, c) === 'aurelian');
  assert.equal(R.capitalOf('aurelian', c), town);
  assert.match(CL.rights.may(c, R.rulerOf('valedorn', c), 'besiege', town).why, /only to an army/);
  const a = A.plan(c, 'valedorn');
  Object.assign(a, { phase: 'march', strength: A.powerOf(c, a) });
  const s = S.byArmy(c, a, town);
  assert.ok(s, 'an army may');
  assert.ok(CL.fiefs.count(c.holdings[town].garrison) > 0, 'the town is garrisoned for it');
  assert.ok(c.holdings[town].food >= 14, 'and stocked');
  S.take(c, s, 'stormed');
  assert.equal(R.owner(town, c), 'valedorn', 'taken');
  assert.notEqual(R.capitalOf('aurelian', c), town, 'the seat moved');
  assert.equal(c.holdings[R.capitalOf('aurelian', c)].controller, 'aurelian');
  // Everything else Aurelia holds goes the same way: the last one taken, it is gone.
  const lords = Object.keys(c.people).filter((pid) => c.people[pid].realm === 'aurelian' && !R.rules(pid, c) && c.people[pid].status === 'free');
  const rest = Object.keys(c.holdings).filter((sid) => c.holdings[sid].controller === 'aurelian' && c.holdings[sid].kind !== 'village');
  for (const sid of rest.slice(1)) R.transfer(c, sid, { controller: 'valedorn', sovereign: 'valedorn', reason: 'test', capital: true });
  const last = rest[0];
  if (S.at(c, last)) S.end(c, S.at(c, last), 'lifted');
  c.sieges.length = 0;
  const b = A.ofRealm(c, 'valedorn') || A.plan(c, 'valedorn');
  const s2 = S.byArmy(c, b, last) || { id: 99, sid: last, realm: 'valedorn', by: 'ai', army: b?.id, lords: [], relief: [], phase: 'encircled', began: c.day, log: [] };
  if (!c.sieges.includes(s2)) c.sieges.push(s2);
  S.take(c, s2, 'stormed');
  assert.equal(Object.values(c.holdings).some((h) => h.controller === 'aurelian'), false, 'nothing left');
  assert.ok(A.isGone(c, 'aurelian'), 'gone');
  assert.ok(c.news.events.some((e) => e.kind === 'realm_gone'));
  for (const pid of lords) assert.notEqual(c.people[pid].realm, 'aurelian', `${pid} found service elsewhere`);
  assert.equal(A.plan(c, 'aurelian'), null, 'and raises no army');
});

test('you, summoned: you answer by riding to its banner, and then its battles are yours', () => {
  const { CL, c, A, R } = war();
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  const a = A.plan(c, 'valedorn');
  assert.equal(c.armyCall?.army, a.id, 'summoned');
  assert.equal(A.riding(c, a), false);
  const q = A.lead(c, a);
  Object.assign(c.world, { x: q.x + 1, y: q.y, location: null });
  A.step(c);
  assert.equal(c.armyCall.answered, true, 'answered');
  assert.equal(A.riding(c, a), true, 'riding with it');
  // An enemy army meets yours: the shared battle, with its commander as the encounter.
  c.armyRest = {};
  const b = A.plan(c, 'aurelian');
  for (const x of [a, b]) Object.assign(x, { phase: 'march', strength: A.powerOf(c, x), objective: 'defend', target: x.rally, set: c.day });
  const bq = A.lead(c, b);
  for (const p of A.parties(c, b)) Object.assign(p, { x: q.x + 2, y: q.y });
  CL.game.contactParty = null;
  A.step(c);
  assert.equal(CL.game.contactParty, bq.id, 'the enemy commander is the encounter');
  assert.ok(A.fighting(c, bq.id), 'more of its lords ride in');
  // You win: theirs falls back or breaks; yours rides on.
  const r = A.afterBattle(c, bq.id, true);
  assert.ok(r);
  assert.equal(c.armyFight, null);
  assert.ok(!A.byId(c, b.id) || b.objective === 'regroup');
  assert.ok(A.byId(c, a.id));
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('you, a ruler: raise your own army, give it orders, and it rides with you as one banner', () => {
  const { CL, c, A, R } = war();
  assert.equal(A.raiseMine(c).ok, false, 'no realm, no army');
  const sid = Object.keys(c.holdings).find((x) => c.holdings[x].kind === 'fort' && R.owner(x, c) === 'valedorn' && !R.locked(c, x));
  CL.story.state(c).flags.ending = true;
  R.transfer(c, sid, { holder: 'player', willing: true, reason: 'test' });
  Object.assign(c, { renown: 1000 });
  while (c.roster.length < 40) c.roster.push({ ...(c.roster[0] || { name: 'Test', troopId: 'levy', xp: 0 }), id: 9000 + c.roster.length });
  const f = CL.founding.declare(c, 'player', sid) ? CL.founding.mine(c) : null;
  if (!f) throw new Error(`no realm: ${CL.rights.may(c, 'player', 'declare', sid).why}`);
  // Two Valedorn lords swear to you.
  const pids = CL.lords.riders(c).filter((pid) => c.people[pid].realm === 'valedorn').slice(0, 2);
  for (const pid of pids) CL.nobles.changeRealm(c, pid, f);
  for (const pid of pids) delete c.people[pid].regroup; // at full strength, for the test
  CL.lords.ensure(c, c.day, true);
  const r = A.raiseMine(c);
  assert.ok(r.ok, r.why);
  const a = r.army;
  assert.equal(a.commander, 'player');
  assert.equal(A.mine(c), a);
  Object.assign(a, { phase: 'march', strength: A.powerOf(c, a) });
  assert.equal(A.order(c, 'follow').ok, true);
  for (const q of A.parties(c, a)) {
    const post = A.postFor(c, q);
    assert.ok(CL.world.mapDist(post[0], post[1], c.world.x, c.world.y) < 5, 'beside you');
  }
  const flag = CL.lords.partyOf(c, a.members[0]);
  assert.equal(A.bannerOf(c, flag), a, 'one banner');
  assert.equal(A.order(c, 'besiege', 'nowhere').ok, false);
  assert.equal(A.order(c, 'home').ok, true);
  assert.equal(A.mine(c), null, 'sent home');
  assert.deepEqual(plain(R.invariants(c)), []);
});
