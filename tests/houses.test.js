// P9-06 · Houses, marriage and claims: houses from kin; §19.6 (a marriage alliance with its obligations,
// opinions of a house apart from its members', a house that loses its land and keeps its name, a petition
// for restoration); a death and each law's succession; a contested one; no heir; a refused proposal's
// reasons; deaths of wounds; the save step.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
  CL.lords.ensure(c, c.day, true);
  const key = (k) => Object.keys(c.people).find((id) => c.people[id].key === k);
  return { ...env, c, H: CL.houses, R: CL.realm, N: CL.nobles, key };
}

test('houses from kin: parents, children and siblings together, named by the eldest; every person in one', () => {
  const { c, H, key } = world();
  const g = H.houseOf(c, key('hamon_greymantle'));
  assert.equal(g.name, 'Greymantle');
  for (const k of ['hawise_greymantle', 'tancred_greymantle']) assert.ok(g.members.includes(key(k)), k);
  assert.notEqual(H.houseOf(c, key('avice_westmere')), H.houseOf(c, key('serlo_fernby')), 'cousins of two names: two houses');
  for (const pid of Object.keys(c.people)) assert.ok(H.houseOf(c, pid), pid);
  assert.deepEqual(plain(H.invariants(c)), []);
  assert.match(H.line(c, g), /^House Greymantle: Lord Hamon Greymantle \(head\), .+; \d+ holdings?\.$/);
});

test('§19.6: a marriage alliance and its obligation; a house’s regard apart from its members’; a house without land; a petition for restoration', () => {
  const { c, H, R, N, key } = world();
  const tancred = key('tancred_greymantle');
  const avice = key('avice_westmere');
  // An alliance by marriage, its obligation tracked: each answers the other's call with +20.
  assert.ok(H.canMarry(c, tancred, avice).ok);
  H.marry(c, tancred, avice);
  const [hg, hw] = [H.houseOf(c, tancred), H.houseOf(c, avice)];
  assert.ok(hg.alliances.includes(hw.id) && hw.alliances.includes(hg.id), 'allied');
  assert.equal(c.people[tancred].spouse, avice);
  const hamon = key('hamon_greymantle');
  const r = N.consider(c, avice, { by: hamon, kind: 'ride' });
  assert.ok(r.reasons.some((x) => /house is allied/.test(x.text) && x.sign === '+'), N.reasonLine(r));
  // Opinions of a house apart from its members'.
  const serlo = key('serlo_fernby');
  const before = { lord: N.opinion(c, serlo, hamon), house: H.regard(c, serlo, hg.id) };
  H.wronged(c, H.houseOf(c, serlo).id, hamon, -30);
  assert.equal(N.opinion(c, serlo, hamon), before.lord, 'what he thinks of the man is his own');
  assert.ok(H.regard(c, serlo, hg.id) < before.house, 'what he thinks of the house falls');
  // A family that loses all its land keeps its members and name.
  const ruler = R.rulerOf('valedorn', c);
  for (const m of hg.members) for (const sid of R.fiefsOf(m, c)) R.transfer(c, sid, { holder: ruler, willing: true, reason: 'test' });
  assert.equal(hg.members.reduce((n, m) => n + R.fiefsOf(m, c).length, 0), 0);
  assert.equal(H.byId(c, hg.id).name, 'Greymantle');
  assert.ok(hg.members.length >= 3);
  assert.match(H.line(c, hg), /no land/);
  // A claimant petitions their liege for restoration.
  const sid = 'highmere';
  R.addClaim(c, sid, { by: hamon, realm: 'valedorn', kind: 'old' });
  assert.ok(H.restorable(c, hamon).includes(sid));
  for (let i = 0; i < 3; i++) N.note(c, ruler, hamon, 'helped', { kin: false });
  const p = H.petition(c, hamon, sid);
  assert.ok(p.ok, p.why);
  assert.equal(R.holderOf(sid, c), hamon, 'restored');
  // And refused, for a reason that reads.
  R.transfer(c, 'brackenfield', { holder: ruler, willing: true, reason: 'test' });
  const hawise = key('hawise_greymantle');
  R.addClaim(c, 'brackenfield', { by: hawise, realm: 'valedorn', kind: 'old' });
  for (let i = 0; i < 4; i++) N.note(c, ruler, hawise, 'revoked', { kin: false });
  const no = H.petition(c, hawise, 'brackenfield');
  assert.equal(no.ok, false);
  assert.match(no.why, /refuses: .+ thinks ill of Lady Hawise Greymantle/);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('a death and each law’s succession: the eldest child; the kin the lords think best of; the council’s choice', () => {
  for (const law of ['eldest', 'kin', 'council']) {
    const { CL, c, H, R, key } = world();
    CL.crowns.ensure(c);
    CL.crowns.record(c, 'valedorn').laws = { succession: law };
    const hamon = key('hamon_greymantle');
    const fiefs = R.fiefsOf(hamon, c);
    assert.ok(fiefs.length >= 2);
    const { cands } = H.heirs(c, hamon);
    const s = H.die(c, hamon, 'wounds');
    assert.equal(s.law, law);
    assert.equal(c.people[hamon].status, 'dead');
    if (law === 'eldest') assert.equal(s.heir, key('tancred_greymantle'), 'his son');
    else assert.equal(s.heir, cands[0].pid);
    for (const sid of fiefs) assert.notEqual(R.holderOf(sid, c), hamon, `${sid} left with the dead`);
    assert.ok(fiefs.some((sid) => R.holderOf(sid, c) === s.heir), 'the heir holds land');
    assert.equal(H.houseOf(c, hamon), null, 'the dead are of no house now');
    assert.ok(c.news.events.some((e) => e.kind === 'lord_died' && /inherits/.test(e.text)));
    assert.deepEqual(plain(R.invariants(c)), [], law);
  }
});

test('a contested succession: the second keeps claims, and three lords behind them make a faction', () => {
  const { CL, c, H, R, N, key } = world();
  CL.crowns.ensure(c);
  CL.crowns.record(c, 'valedorn').laws = { succession: 'kin' };
  const hamon = key('hamon_greymantle');
  const [a, b] = [key('tancred_greymantle'), key('hawise_greymantle')];
  // The court is split between them; three lords favour Hawise.
  const lords = CL.lords.riders(c).filter((p) => c.people[p].realm === 'valedorn' && ![hamon, a, b].includes(p));
  for (const p of lords.slice(0, 3)) for (let i = 0; i < 2; i++) N.note(c, p, b, 'helped', { kin: false });
  for (const p of lords.slice(3)) for (let i = 0; i < 4; i++) N.note(c, p, a, 'helped', { kin: false });
  const fiefs = R.fiefsOf(hamon, c);
  // Close the gap to within 10, as a split court would.
  for (let i = 0; i < 20; i++) {
    const [x, y] = H.heirs(c, hamon).cands;
    if (x.score - y.score <= H.RULES.contested - 2) break;
    N.note(c, lords[i % lords.length], y.pid, 'helped', { kin: false });
  }
  const { cands } = H.heirs(c, hamon);
  assert.ok(Math.abs(cands[0].score - cands[1].score) <= H.RULES.contested, `close: ${cands.map((x) => x.score.toFixed(1))}`);
  const s = H.die(c, hamon);
  assert.equal(s.contested, true);
  for (const sid of fiefs) assert.ok(R.claimsOn(sid, c).some((k) => k.by === s.rival), `${sid}: the rival's claim`);
  assert.ok(c.news.events.some((e) => e.kind === 'succession_contested'));
  if (s.faction) assert.equal(s.faction.claimant, s.rival, 'the faction backs the rival');
  // No heir: a lord with land and no kin; the crown takes it, to grant.
  const w = world();
  const lone = Object.keys(w.c.people).find((p) => !w.c.people[p].kin.length && w.R.fiefsOf(p, w.c).length && !w.R.rules(p, w.c));
  if (lone) {
    const land = w.R.fiefsOf(lone, w.c);
    const f = w.c.people[lone].realm;
    w.CL.crowns.ensure(w.c);
    w.CL.crowns.record(w.c, f).laws = { succession: 'eldest' };
    const t = w.H.die(w.c, lone);
    assert.equal(t.heir, null);
    for (const sid of land) assert.equal(w.R.holderOf(sid, w.c), w.R.rulerOf(f, w.c), `${sid} to the crown`);
  }
});

test('a lord beaten in battle dies of wounds now and then (3%); you never die', () => {
  const { CL, c, H, key } = world();
  const pid = key('serlo_fernby');
  const q = CL.lords.partyOf(c, pid);
  CL.autoresolve.next = () => 0.01; // under 3%
  assert.equal(CL.lords.beaten(c, q, 'aurelian'), null);
  assert.equal(c.people[pid].status, 'dead');
  assert.equal(c.people[pid].cause, 'wounds');
  assert.equal(H.die(c, 'player'), null, 'never you');
  const w = world();
  w.CL.autoresolve.next = () => 0.5;
  const x = w.CL.lords.beaten(w.c, w.CL.lords.partyOf(w.c, w.key('serlo_fernby')), 'aurelian');
  assert.ok(x, 'captured, as before');
});

test('a proposal refused for reasons that read; accepted with a dowry; your spouse may refuse an order', () => {
  const { CL, c, H, R, key } = world();
  const tancred = key('tancred_greymantle');
  assert.match(H.propose(c, 'player', tancred).line || H.canMarry(c, 'player', tancred).why, /no house yet/);
  // You hold land: your house (a vassal of Valedorn, granted Ashby).
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  R.transfer(c, 'ashby', { holder: 'player', willing: true, reason: 'test' });
  H.weekly(c);
  const mine = H.mine(c);
  assert.ok(mine, 'your house');
  assert.equal(mine.head, 'player');
  const r = H.propose(c, 'player', tancred);
  assert.notEqual(r.answer, 'obey');
  assert.match(r.line, /A marriage is for life, not a favour \(−\)\./);
  assert.match(r.words, /refuses|would accept with a dowry of \d+ crowns/);
  // Liked well enough, and with a dowry: yes.
  for (let i = 0; i < 6; i++) CL.nobles.note(c, tancred, 'player', 'freed', { kin: false });
  c.gold = 2000;
  const yes = H.propose(c, 'player', tancred, { dowry: 500 });
  assert.equal(yes.answer, 'obey', yes.line);
  assert.equal(H.spouseOf(c), tancred);
  assert.ok(mine.alliances.includes(H.houseOf(c, tancred).id));
  assert.ok(c.gold <= 1500, 'the dowry paid');
  assert.equal(H.end(c, 'player').ok, false, 'not before 90 days');
  const ride = H.askSpouse(c, 'ride');
  assert.ok(ride.ok || /refuses/.test(ride.why));
  c.day += 91;
  assert.equal(H.end(c, 'player').ok, true);
  assert.equal(H.spouseOf(c), null);
  assert.ok(H.houseOf(c, tancred).rivals.includes(mine.id), 'the houses are rivals now');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('save v30: houses, marriages and the dead round-trip; junk repaired; v29 migrates', () => {
  const { CL, c, H, key } = world();
  H.marry(c, key('tancred_greymantle'), key('avice_westmere'));
  H.die(c, key('serlo_fernby'));
  const text = JSON.stringify(c);
  const back = CL.save.sanitize(JSON.parse(text));
  assert.deepEqual(plain(back.houses), plain(c.houses));
  assert.equal(back.people[key('tancred_greymantle')].spouse, key('avice_westmere'));
  assert.equal(back.people[key('serlo_fernby')].status, 'dead');
  const d = JSON.parse(text);
  d.people[key('avice_westmere')].spouse = key('hamon_greymantle'); // one-sided
  d.houses['house:999'] = { name: 'Ghost', members: [key('serlo_fernby'), 'person:9999'] };
  const fixed = CL.save.sanitize(d);
  assert.equal(fixed.people[key('avice_westmere')].spouse, undefined);
  assert.equal(fixed.people[key('tancred_greymantle')].spouse, undefined);
  assert.deepEqual(plain(fixed.houses['house:999'].members), []);
  assert.deepEqual(plain(H.invariants(fixed)), []);
  const old = JSON.parse(text);
  old.version = 29;
  delete old.houses;
  delete old.nextHouseId;
  const m = CL.save.migrate(old);
  assert.equal(m.version, CL.save.VERSION);
  const built = CL.save.sanitize(m);
  assert.ok(Object.keys(built.houses).length >= 5, 'built from kin on load');
});
