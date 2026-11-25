// P9-04 · Rebellion and deposition: a faction only from grievances, its warnings, each of the ruler's
// responses, demands met and refused, the rising and its three outcomes (holdings, garrisons and claims
// right), SC-26 (your vassals depose you; the save goes on), SC-27 (refuge with an old enemy), your
// summons by both sides, and the save step (v27 → v28).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  CL.crowns.ensure(c);
  CL.story.state(c).flags.ending = 'valedorn';
  Object.assign(c, { gold: 2000, food: 400 });
  CL.game.mode = 'map';
  const messages = [];
  CL.ui.message = (t) => messages.push(t);
  return { ...env, c, RB: CL.rebellion, R: CL.realm, N: CL.nobles, messages };
}
const note = (N, c, a, b, deed, n) => {
  for (let i = 0; i < n; i++) N.note(c, a, b, deed, { kin: false });
};
/** Test setup: three of a realm's riding lords who think ill of its ruler and well of one another. */
function aggrieve(env, f = 'valedorn', n = 3) {
  const { CL, c, N, R } = env;
  const ruler = R.rulerOf(f, c);
  const lords = CL.lords.riders(c).filter((p) => c.people[p].realm === f && c.people[p].status === 'free').slice(0, n);
  for (const a of lords) {
    note(N, c, a, ruler, 'abandoned', 3);
    for (const b of lords) if (a !== b) note(N, c, a, b, 'helped', 2);
  }
  return lords;
}
const weeks = (env, x, n) => {
  for (let i = 0; i < n; i++) {
    env.c.day += 7;
    env.RB.step(env.c, x);
  }
};

test('a faction forms from grievances alone: none without them; three bonded lords and a claimant with them', () => {
  const env = world();
  const { c, RB } = env;
  assert.equal(RB.form(c, 'valedorn'), null, 'no grievances, no faction');
  const lords = aggrieve(env);
  const x = RB.form(c, 'valedorn');
  assert.ok(x);
  assert.deepEqual(plain([...x.members].sort()), plain([...lords].sort()));
  assert.ok(lords.includes(x.claimant));
  assert.equal(RB.form(c, 'valedorn'), null, 'one at a time');
  // The same world forms the same faction: no roll.
  const again = world();
  aggrieve(again);
  assert.deepEqual(plain(again.RB.form(again.c, 'valedorn').members), plain(x.members));
});

test('warnings a week apart: a rumour, a companion’s word, a friendly lord’s; then demands', () => {
  const env = world();
  const { c, RB, messages, CL } = env;
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  CL.companion.join?.(c);
  c.companion ||= { id: 'mara', woundedUntil: null, equipment: {} };
  const lords = aggrieve(env);
  note(env.N, c, lords[1], 'player', 'helped', 3);
  const x = RB.form(c, 'valedorn');
  x.responded = 'prepare'; // test setup: the ruler's answer given already, so it doesn't change the faction
  RB.step(c, x);
  assert.equal(x.warned, 1);
  assert.ok(c.news.events.some((e) => e.kind === 'faction_rumour'));
  RB.step(c, x);
  assert.equal(x.warned, 1, 'a week apart');
  weeks(env, x, 1);
  assert.equal(x.warned, 2);
  assert.match(messages.join(' '), /Mara: "There's talk/);
  weeks(env, x, 1);
  assert.equal(x.warned, 3);
  assert.match(messages.join(' '), /tells you: "We will put our demands/);
  weeks(env, x, 1);
  assert.equal(x.stage, 'demands');
});

test('the responses: a concession, a mediator, divide, arrest and prepare, each with its effect', () => {
  // Concession: the claimant gets the crown's village; the faction thinks better of the ruler.
  const a = world();
  const lords = aggrieve(a);
  const x = a.RB.form(a.c, 'valedorn');
  const ruler = a.R.rulerOf('valedorn', a.c);
  const before = a.N.opinion(a.c, lords[0], ruler);
  const r = a.RB.respond(a.c, x.id, 'concession');
  assert.equal(r.ok, true, r.text);
  assert.equal(a.N.opinion(a.c, lords[0], ruler) - before, a.N.DEEDS.conceded);
  // A mediator liked by both: +10 and a pause of 30 days.
  const b = world();
  const bl = aggrieve(b);
  const bx = b.RB.form(b.c, 'valedorn');
  const m = b.CL.lords.riders(b.c).find((p) => b.c.people[p].realm === 'valedorn' && !bl.includes(p));
  note(b.N, b.c, b.R.rulerOf('valedorn', b.c), m, 'helped', 2);
  note(b.N, b.c, bx.claimant, m, 'helped', 2);
  assert.equal(b.RB.respond(b.c, bx.id, 'mediator').ok, true);
  assert.equal(bx.pausedUntil, b.c.day + 30);
  // Divide: one member is won over with a village and leaves; three become two, and it breaks.
  const d = world();
  aggrieve(d);
  const dx = d.RB.form(d.c, 'valedorn');
  assert.equal(d.RB.respond(d.c, dx.id, 'divide').ok, true);
  assert.equal(d.RB.active(d.c, 'valedorn'), null, 'two are no faction');
  // Arrest: the claimant is held by their own crown; with the dice against the crown, the rest rise at once.
  const e = world();
  aggrieve(e, 'valedorn', 4);
  const ex = e.RB.form(e.c, 'valedorn');
  const claimant = ex.claimant;
  e.CL.autoresolve.next = () => 0.1;
  assert.equal(e.RB.respond(e.c, ex.id, 'arrest').ok, true);
  assert.equal(e.c.people[claimant].status, 'captive');
  assert.equal(e.c.people[claimant].heldBy, 'valedorn');
  assert.equal(ex.stage, 'rising');
  assert.notEqual(ex.claimant, claimant, 'the next strongest leads them');
  assert.deepEqual(plain(e.R.invariants(e.c)), []);
  // Prepare: the rising starts a quarter weaker.
  const p = world();
  const pl = aggrieve(p);
  const px = p.RB.form(p.c, 'valedorn');
  p.RB.respond(p.c, px.id, 'prepare');
  const q = p.CL.lords.partyOf(p.c, pl.find((x) => x !== px.claimant));
  const men = Object.values(q.troops).reduce((s, n) => s + n, 0);
  px.stage = 'demands';
  p.RB.refuse(p.c, px.id);
  assert.ok(Object.values(q.troops).reduce((s, n) => s + n, 0) <= Math.ceil(men * 0.75) + Object.keys(q.troops).length);
});

test('demands met: the faction breaks up, the realm is quiet 90 days and its lords trust the ruler more; refused: it rises', () => {
  const a = world();
  const lords = aggrieve(a);
  const x = a.RB.form(a.c, 'valedorn');
  x.stage = 'demands';
  x.demand = { kind: 'land', until: a.c.day + 14 };
  const other = Object.keys(a.c.people).find((p) => a.c.people[p].realm === 'valedorn' && !lords.includes(p) && !a.R.rules(p, a.c));
  const was = a.N.opinion(a.c, other, a.R.rulerOf('valedorn', a.c));
  assert.equal(a.RB.meet(a.c, x.id).ok, true);
  assert.equal(a.RB.active(a.c, 'valedorn'), null);
  assert.equal(a.RB.state(a.c).quiet.valedorn, a.c.day + 90);
  assert.equal(a.N.opinion(a.c, other, a.R.rulerOf('valedorn', a.c)) - was, a.N.DEEDS.kept_peace);
  assert.equal(a.RB.form(a.c, 'valedorn'), null, 'quiet');
  // Refused: a realm of their own at war with the crown, their land and garrisons with them.
  const b = world();
  const bl = aggrieve(b);
  const bx = b.RB.form(b.c, 'valedorn');
  bx.stage = 'demands';
  bx.demand = { kind: 'land', until: b.c.day + 14 };
  const held = bl.flatMap((p) => b.R.fiefsOf(p, b.c));
  const garrisons = held.map((s) => plain(b.c.holdings[s].garrison));
  b.RB.refuse(b.c, bx.id);
  const id = bx.rising;
  assert.ok(b.R.isRealm(id));
  assert.equal(b.R.rulerOf(id, b.c), bx.claimant);
  assert.equal(b.R.relation(b.c, 'valedorn', id), 'war');
  for (const p of bl) assert.equal(b.c.people[p].realm, id);
  held.forEach((s, i) => {
    assert.equal(b.c.holdings[s].sovereign, id, s);
    assert.deepEqual(plain(b.c.holdings[s].garrison), garrisons[i], `${s}: its garrison goes with it`);
  });
  assert.ok(b.c.news.events.some((e) => e.kind === 'rising'));
  assert.deepEqual(plain(b.R.invariants(b.c)), []);
});

/** A rising in Valedorn, set up through the real steps. */
function rising(env) {
  const lords = aggrieve(env);
  const x = env.RB.form(env.c, 'valedorn');
  x.stage = 'demands';
  x.demand = { kind: 'land', until: env.c.day + 14 };
  env.RB.refuse(env.c, x.id);
  return { x, lords, held: lords.flatMap((p) => env.R.fiefsOf(p, env.c)), had: Object.fromEntries(lords.map((p) => [p, env.R.fiefsOf(p, env.c).length])) };
}

test('the outcomes: a compromise, the crown’s win and the rebels’ win, with holdings and claims right', () => {
  // Compromise: the war ends in peace; the rebels go home with their land, the claimant pardoned.
  const a = world();
  const { x, lords, held, had } = rising(a);
  a.R.setRelation(a.c, 'valedorn', x.rising, 'peace', 'test');
  a.RB.step(a.c, x);
  assert.equal(a.c.realms[x.rising], undefined, 'the rising realm is gone');
  for (const p of lords) assert.equal(a.c.people[p].realm, 'valedorn');
  for (const s of held) assert.equal(a.c.holdings[s].sovereign, 'valedorn');
  for (const p of lords) assert.equal(a.R.fiefsOf(p, a.c).length, Math.min(had[p], a.R.fiefCap('valedorn', a.c)), `${p} keeps their land, within the law`)
  assert.deepEqual(plain(a.R.invariants(a.c)), []);
  // The crown wins: every rebel fort taken; their fiefs revoked.
  const b = world();
  const B = rising(b);
  for (const s of B.held.filter((sid) => b.c.holdings[sid].kind === 'fort')) b.R.transfer(b.c, s, { controller: 'valedorn', sovereign: 'valedorn', reason: 'test' });
  b.c.day += 14;
  b.RB.step(b.c, B.x);
  assert.equal(b.c.realms[B.x.rising], undefined);
  for (const s of B.held) assert.equal(b.c.holdings[s].holder, b.R.rulerOf('valedorn', b.c), `${s} revoked`);
  assert.deepEqual(plain(b.R.invariants(b.c)), []);
  // The rebels win: the crown left no fort; the claimant rules, the old ruler rides on as a lord.
  const d = world();
  const D = rising(d);
  const old = d.R.rulerOf('valedorn', d.c);
  for (const s of Object.keys(d.c.holdings).filter((sid) => d.c.holdings[sid].kind === 'fort' && d.c.holdings[sid].controller === 'valedorn')) Object.assign(d.c.holdings[s], { controller: D.x.rising, sovereign: D.x.rising }); // test setup: the war went their way
  for (const v of Object.keys(d.c.holdings).filter((sid) => d.c.holdings[sid].kind === 'village' && d.c.holdings[d.c.holdings[sid].seat]?.controller === D.x.rising)) Object.assign(d.c.holdings[v], { controller: D.x.rising, sovereign: D.x.rising });
  d.c.day += 14;
  d.RB.step(d.c, D.x);
  assert.equal(d.R.rulerOf('valedorn', d.c), D.x.claimant);
  assert.equal(d.c.people[old].realm, 'valedorn');
  assert.ok(d.R.fiefsOf(old, d.c).length <= d.R.fiefCap('valedorn', d.c));
  assert.deepEqual(plain(d.R.invariants(d.c)), []);
});

test('summoned by both sides: ride with the rising and your fief goes with you; it wins and you are its vassal again', () => {
  const env = world();
  const { c, RB, R, CL } = env;
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'test' });
  const { x } = rising(env);
  assert.ok(RB.state(c).summons, 'both summon you');
  assert.match(env.messages.join(' '), /both summon you/);
  assert.equal(RB.chooseSide(c, 'rebels').ok, true);
  assert.equal(CL.allegiance.sworn(c), x.rising);
  assert.equal(c.holdings.westholt_castle.sovereign, x.rising);
  assert.deepEqual(plain(R.invariants(c)), []);
  R.setRelation(c, 'valedorn', x.rising, 'peace', 'test');
  RB.step(c, x);
  assert.equal(CL.allegiance.sworn(c), 'valedorn');
  assert.equal(c.holdings.westholt_castle.holder, 'player');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('SC-26 and SC-27: your vassals rise and depose you; you keep company, companions and a claim; an old enemy offers refuge', () => {
  const env = world();
  const { c, RB, R, CL, N } = env;
  // You rule a realm of your own, with three vassals who come to resent you.
  R.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'test' });
  const id = CL.founding.declare(c, 'player', 'westholt_castle', { free: true });
  const vassals = CL.lords.riders(c).filter((p) => c.people[p].realm === 'hrothmark').slice(0, 3);
  for (const p of vassals) CL.nobles.changeRealm(c, p, id);
  CL.lords.ensure(c, c.day, true);
  for (const a of vassals) {
    note(N, c, a, 'player', 'abandoned', 3);
    for (const b of vassals) if (a !== b) note(N, c, a, b, 'helped', 2);
  }
  note(N, c, R.rulerOf('aurelian', c), 'player', 'helped', 2); // an old friend at Aurelia's court
  const roster = c.roster.length;
  const x = RB.form(c, id);
  assert.ok(x, 'your vassals form a faction');
  x.stage = 'demands';
  x.demand = { kind: 'land', until: c.day + 14 };
  RB.refuse(c, x.id);
  // The war goes their way: your fort falls to them.
  Object.assign(c.holdings.westholt_castle, { controller: x.rising, sovereign: x.rising, holder: x.claimant });
  for (const v of R.villagesOf('westholt_castle', c)) Object.assign(c.holdings[v], { controller: x.rising, sovereign: x.rising, holder: x.claimant });
  c.day += 14;
  RB.step(c, x);
  assert.equal(R.rulerOf(id, c), x.claimant, 'deposed');
  assert.equal(R.rules('player', c), null);
  assert.equal(c.roster.length, roster, 'your company is yours');
  assert.ok(c.holdings.westholt_castle.claims.some((k) => k.by === 'player'), 'and your claim');
  assert.ok(RB.state(c).deposed);
  assert.match(env.messages.join(' '), /You are deposed/);
  assert.deepEqual(plain(R.invariants(c)), []);
  // SC-27: refuge with the realm whose ruler thinks well of you.
  assert.equal(RB.state(c).refuge?.realm, 'aurelian');
  assert.equal(RB.acceptRefuge(c).ok, true);
  assert.equal(CL.allegiance.sworn(c), 'aurelian');
  // The same save goes on.
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.rulers[id], x.claimant);
  assert.deepEqual(plain(R.invariants(back)), []);
});

test('saves: v27 → v28, a faction and a rising round-trip, junk repaired, and 2.30.0’s saves load', () => {
  const env = world();
  const { c, CL } = env;
  const { x } = rising(env);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.rebellions), plain(c.rebellions));
  assert.equal(back.realms[x.rising].rising, 'valedorn');
  const d = plain(c);
  d.rebellions.list.push({ id: 99, realm: 'nowhere', stage: 'faction', members: [] }, { ...d.rebellions.list[0], id: 98 });
  const fixed = CL.save.fromRaw(d).campaign;
  assert.deepEqual(plain(fixed.rebellions.list.map((r) => r.id)), [x.id]);
  const v27 = plain(c);
  v27.version = 27;
  delete v27.rebellions;
  const m = CL.save.migrate(v27);
  assert.equal(m.version, CL.save.VERSION);
  assert.deepEqual(plain(m.rebellions.list), []);
});

test('P9-T: a rising fights its crown first: its army besieges and raids the crown’s land before anyone else’s', () => {
  const env = world();
  const { c, RB, CL } = env;
  aggrieve(env);
  const x = RB.form(c, 'valedorn');
  x.stage = 'demands';
  x.demand = { kind: 'land', until: c.day + 14 };
  RB.refuse(c, x.id);
  const r = x.rising;
  assert.ok(c.realms[r], 'risen');
  const forts = CL.armies.targets(c, r);
  assert.ok(forts.length > 0);
  assert.equal(c.holdings[forts[0]].controller, 'valedorn', `first a fort of its crown (${forts[0]})`);
  const lead = CL.lords.partyOf(c, x.claimant) || { x: 0, y: 0 };
  const villages = CL.armies.raidable(c, { realm: r }, lead);
  if (villages.length) assert.equal(c.holdings[villages[0]].controller, 'valedorn', 'and its villages first');
});

test('P10-00: a rising that loses all its land has lost the civil war: it ends as the crown’s win, and its record goes', () => {
  const env = world();
  const { c, R, RB } = env;
  const { x, lords } = rising(env);
  const theirs = Object.keys(c.holdings).filter((sid) => c.holdings[sid].controller === x.rising && c.holdings[sid].kind !== 'village');
  assert.ok(theirs.length > 0);
  for (const sid of theirs) R.transfer(c, sid, { controller: 'valedorn', sovereign: 'valedorn', reason: 'test', capital: true });
  // The last one taken, as a siege's taking calls it (js/sieges.js take → CL.armies.onTaken).
  env.CL.armies.onTaken(c, theirs.at(-1), x.rising);
  assert.equal(c.realms[x.rising], undefined, 'the rising realm is gone');
  assert.equal(RB.state(c).list.includes(x), false, 'and its rebellion with it');
  for (const p of lords) assert.equal(c.people[p].realm, 'valedorn', `${p} home to their realm`);
  assert.deepEqual(plain(R.invariants(c)), []);
});
