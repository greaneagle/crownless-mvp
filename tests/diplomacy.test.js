// P9-02 · Diplomacy and treaties: each kind's life, trust kept and broken (heard everywhere), a pact
// holding clashes short of war, allies in a defensive war and an offensive one, tribute exact between
// treasuries, the AI's offers, the envoy, and the save step (v25 → v26, 2.30.0's fixtures).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.30');

function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  CL.crowns.ensure(c);
  Object.assign(c, { gold: 2000, food: 400 });
  CL.game.mode = 'map';
  return { ...env, c, D: CL.diplomacy, R: CL.realm, K: CL.crowns };
}
/** Clashes enough to tip a pair from tension into war (or not). */
const brink = (R, c, a, b) => {
  R.setRelation(c, a, b, 'tension', 'test');
  for (let i = 0; i < R.RELATIONS.warHeat; i++) R.clashed(c, a, b, 1);
};
/** Test setup: a realm's ruler comes to think ill of another's. */
const sour = (CL, c, a, b) => {
  for (let i = 0; i < 4; i++) CL.nobles.note(c, CL.realm.rulerOf(a, c), CL.realm.rulerOf(b, c), 'abandoned', { kin: false });
};

test('each kind lasts its days and ends kept; a month kept is +5 trust to both; peace has no end', () => {
  const { c, D } = world();
  for (const kind of ['truce', 'nonaggression', 'alliance', 'access', 'trade']) {
    const t = D.sign(c, kind, 'valedorn', 'hrothmark');
    assert.equal(t.until - t.since, D.DAYS[kind], kind);
  }
  const p = D.sign(c, 'peace', 'aurelian', 'vessaro');
  assert.equal(p.until, null);
  assert.equal(D.between(c, 'valedorn', 'hrothmark').length, 5);
  c.day = 30;
  D.weekly(c, 30);
  assert.equal(D.trust(c, 'valedorn', 'hrothmark'), 5 * 5, 'five treaties kept a month');
  assert.equal(D.has(c, 'valedorn', 'hrothmark', 'truce'), false, 'the truce ran out');
  c.day = 120;
  D.weekly(c, 120);
  assert.deepEqual(plain(D.between(c, 'valedorn', 'hrothmark').map((t) => t.kind)), ['alliance']);
  assert.equal(D.has(c, 'aurelian', 'vessaro', 'peace'), true);
  assert.deepEqual(plain(D.invariants(c)), []);
});

test('a war worn out leaves a truce treaty with its end day; while it holds, no new war', () => {
  const { c, D, R } = world();
  R.setRelation(c, 'valedorn', 'hrothmark', 'war', 'test');
  R.setRelation(c, 'valedorn', 'hrothmark', 'tension', 'exhaustion');
  const t = D.between(c, 'valedorn', 'hrothmark', 'truce')[0];
  assert.ok(t);
  assert.equal(t.until, c.relations['hrothmark|valedorn'].truceUntil);
  brink(R, c, 'valedorn', 'hrothmark');
  assert.equal(R.relation(c, 'valedorn', 'hrothmark'), 'tension');
});

test('a pact holds clashes short of war; a ruler who thinks ill breaks it, and every court hears', () => {
  const { CL, c, D, R } = world();
  D.sign(c, 'nonaggression', 'valedorn', 'hrothmark');
  D.sign(c, 'trade', 'valedorn', 'hrothmark');
  brink(R, c, 'valedorn', 'hrothmark');
  assert.equal(R.relation(c, 'valedorn', 'hrothmark'), 'tension', 'the pact holds');
  sour(CL, c, 'hrothmark', 'valedorn');
  R.clashed(c, 'valedorn', 'hrothmark', 1);
  assert.equal(R.relation(c, 'valedorn', 'hrothmark'), 'war');
  assert.equal(D.between(c, 'valedorn', 'hrothmark').length, 0, 'every treaty between them broken');
  assert.equal(D.trust(c, 'valedorn', 'hrothmark'), 2 * D.TRUST.broken, 'two treaties broken: the injured');
  assert.equal(D.trust(c, 'aurelian', 'hrothmark'), 2 * D.TRUST.heard, 'and every other realm');
  assert.equal(D.trust(c, 'vessaro', 'hrothmark'), 2 * D.TRUST.heard);
  assert.ok(c.news.events.some((e) => e.kind === 'treaty_broken' && e.faction === 'hrothmark'));
  // Under −30, a realm won't sign with the breaker.
  assert.equal(D.answer(c, 'trade', 'hrothmark', 'valedorn').ok, false);
  assert.match(D.answer(c, 'trade', 'hrothmark', 'valedorn').why, /does not trust/);
});

test('an ally joins a defensive war; asked to join an attack it declines without a quarrel, and joins with one', () => {
  const { CL, c, D, R } = world();
  CL.story.state(c).flags.ending = 'valedorn'; // the March pair free of the story
  D.sign(c, 'alliance', 'valedorn', 'vessaro');
  // Hrothmark attacks Valedorn: Vessaro marches.
  R.setRelation(c, 'valedorn', 'hrothmark', 'war', 'test', null, c.day, 'hrothmark');
  assert.equal(R.relation(c, 'vessaro', 'hrothmark'), 'war', 'the ally joins');
  assert.ok(c.news.events.some((e) => e.kind === 'ally_joins' && e.faction === 'vessaro'));
  // Valedorn attacks Aurelia: Vessaro has no quarrel with Aurelia, and declines.
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test', null, c.day, 'valedorn');
  assert.notEqual(R.relation(c, 'vessaro', 'aurelian'), 'war');
  assert.equal(D.trust(c, 'valedorn', 'vessaro'), D.TRUST.declined);
  // With a quarrel of its own it joins.
  R.setRelation(c, 'valedorn', 'aurelian', 'peace', 'test');
  R.setRelation(c, 'vessaro', 'aurelian', 'tension', 'test');
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test', null, c.day, 'valedorn');
  assert.equal(R.relation(c, 'vessaro', 'aurelian'), 'war');
  // An ally that can't afford a war declines even a defensive one.
  const { c: c2, D: D2, R: R2, K: K2 } = world();
  D2.sign(c2, 'alliance', 'valedorn', 'vessaro');
  K2.pay(c2, K2.side('vessaro'), 'world', K2.treasury(c2, 'vessaro'), 'debug');
  R2.setRelation(c2, 'valedorn', 'hrothmark', 'war', 'test', null, c2.day, 'hrothmark');
  assert.notEqual(R2.relation(c2, 'vessaro', 'hrothmark'), 'war');
  assert.equal(D2.trust(c2, 'valedorn', 'vessaro'), D2.TRUST.declined);
});

test('tribute moves exactly between treasuries each week; unpaid, it is broken by the payer', () => {
  const { c, D, K } = world();
  D.sign(c, 'tribute', 'hrothmark', 'valedorn', { from: 'hrothmark', to: 'valedorn', amount: 37 });
  const [h0, v0] = [K.treasury(c, 'hrothmark'), K.treasury(c, 'valedorn')];
  D.weekly(c, c.day);
  assert.equal(h0 - K.treasury(c, 'hrothmark'), 37);
  assert.equal(K.treasury(c, 'valedorn') - v0, 37);
  assert.equal(K.record(c, 'valedorn').book.at(-1).in.tribute, 37);
  assert.deepEqual(plain(K.invariants(c)), []);
  K.pay(c, K.side('hrothmark'), 'world', K.treasury(c, 'hrothmark'), 'debug');
  D.weekly(c, c.day);
  assert.equal(D.has(c, 'hrothmark', 'valedorn', 'tribute'), false);
  assert.equal(D.trust(c, 'valedorn', 'hrothmark'), D.TRUST.broken);
});

test('the AI: two fronts seek a truce; beaten, peace with a tenth of its income in tribute; rich and at peace, trade; a threat, an alliance', () => {
  const { CL, c, D, R, K } = world();
  CL.story.state(c).flags.ending = 'valedorn';
  R.setRelation(c, 'hrothmark', 'valedorn', 'war', 'test');
  R.setRelation(c, 'hrothmark', 'vessaro', 'war', 'test');
  const o = D.nextOffer(c, 'hrothmark');
  assert.equal(o.kind, 'truce');
  c.day += 20; // weariness
  const r = D.resolve(c, o);
  assert.equal(r.ok, true, r.why);
  assert.notEqual(R.relation(c, o.from, o.to), 'war');
  assert.ok(D.has(c, o.from, o.to, 'truce'));
  assert.equal(D.nextOffer(c, 'hrothmark')?.to === o.to && D.nextOffer(c, 'hrothmark')?.kind === 'truce', false, 'not the same offer again soon');
  // Beaten: two forts lost in this war (their old lords' claims say so).
  const forts = Object.keys(c.holdings).filter((s) => c.holdings[s].kind === 'fort' && c.holdings[s].sovereign === 'aurelian').slice(0, 2);
  R.setRelation(c, 'aurelian', 'vessaro', 'war', 'test');
  R.setRelation(c, 'aurelian', 'valedorn', 'war', 'test');
  for (const sid of forts) R.transfer(c, sid, { controller: 'vessaro', reason: 'test' });
  const p = D.nextOffer(c, 'aurelian');
  assert.equal(p.kind, 'peace');
  assert.equal(p.terms.amount, Math.round(K.income(c, 'aurelian') * D.RULES.tributeShare));
  assert.equal(p.terms.from, 'aurelian');
  // Rich and at peace with all: trade, with the realm it thinks best of.
  const { c: c2, D: D2, K: K2 } = world();
  K2.pay(c2, 'world', K2.side('valedorn'), 50000, 'debug');
  assert.equal(D2.nextOffer(c2, 'valedorn').kind, 'trade');
  const t = D2.resolve(c2, D2.nextOffer(c2, 'valedorn'));
  assert.equal(t.ok, true, t.why);
  // A neighbour twice as strong: an alliance with its rival.
  const { CL: G, c: c3, D: D3, R: R3 } = world();
  G.story.state(c3).flags.ending = 'valedorn';
  for (const pid of G.lords.riders(c3).filter((x) => c3.people[x].realm === 'hrothmark')) G.lords.partyOf(c3, pid).troops = { huscarl: 200 }; // test setup: twice anyone's strength
  R3.setRelation(c3, 'hrothmark', 'aurelian', 'tension', 'test');
  const a = D3.nextOffer(c3, 'valedorn');
  assert.deepEqual(plain(a), { kind: 'alliance', from: 'valedorn', to: 'aurelian', terms: { against: 'hrothmark' } });
});

test('the envoy: a vassal carries the offer; delivered, it is better heard, for 60 crowns and +5 standing; left on the board, it goes anyway', () => {
  const { CL, c, D, R } = world();
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  const o = { kind: 'trade', from: 'valedorn', to: 'hrothmark', terms: {} };
  assert.deepEqual(plain(D.offer(c, o)), { envoy: true });
  const cap = R.capitalOf('valedorn');
  const to = R.capitalOf('hrothmark');
  const posted = CL.contracts.offersAt(c, cap).find((x) => x.template === 'envoy');
  assert.ok(posted, 'on the capital’s board');
  assert.equal(posted.to, to);
  assert.equal(CL.contracts.accept(c, cap, 'envoy').ok, true);
  const [g0, s0] = [c.gold, CL.realm.score(c, 'valedorn')];
  const score = D.answer(c, 'trade', 'valedorn', 'hrothmark').score;
  c.world.location = to;
  CL.contracts.onArrive(c, to);
  assert.equal(c.gold - g0, 60);
  assert.equal(CL.realm.score(c, 'valedorn') - s0, 5);
  assert.ok(D.has(c, 'valedorn', 'hrothmark', 'trade'));
  assert.ok(score >= 0);
  // Not taken: after three days it goes without you.
  const o2 = { kind: 'trade', from: 'valedorn', to: 'vessaro', terms: {} };
  assert.deepEqual(plain(D.offer(c, o2)), { envoy: true });
  c.day += D.RULES.envoy.days;
  CL.contracts.tick(c);
  assert.ok(D.has(c, 'valedorn', 'vessaro', 'trade'), 'answered without the envoy');
  assert.equal(CL.contracts.offersAt(c, cap).some((x) => x.template === 'envoy'), false);
});

test('saves: v25 → v26 (a truce becomes a treaty), a round trip, junk repaired, and 2.30.0’s saves load', () => {
  const { CL, c, D, R } = world();
  D.sign(c, 'alliance', 'valedorn', 'vessaro');
  D.sign(c, 'tribute', 'hrothmark', 'valedorn', { from: 'hrothmark', to: 'valedorn', amount: 20 });
  D.addTrust(c, 'aurelian', 'hrothmark', -25);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.treaties), plain(c.treaties));
  assert.deepEqual(plain(back.trust), plain(c.trust));
  const d = plain(c);
  d.treaties.push({ id: 99, kind: 'empire', between: ['valedorn', 'hrothmark'], since: 0, until: 9 }, { id: 98, kind: 'trade', between: ['valedorn', 'valedorn'], since: 0, until: 90 }, { ...d.treaties[0], id: 97 }, { id: 96, kind: 'tribute', between: ['aurelian', 'vessaro'], since: 0, until: 90, terms: { from: 'merrow', to: 'vessaro', amount: 5 } });
  d.trust.valedorn = { hrothmark: 900, nowhere: 5 };
  const fixed = CL.save.fromRaw(d).campaign;
  assert.deepEqual(plain(fixed.treaties.map((t) => t.id)), [1, 2]);
  assert.deepEqual(plain(fixed.trust.valedorn), { hrothmark: 100 });
  // v25 → v26: today's siege truce becomes a truce treaty.
  R.setRelation(c, 'valedorn', 'hrothmark', 'war', 'test');
  R.setRelation(c, 'valedorn', 'hrothmark', 'tension', 'exhaustion');
  const v25 = plain(c);
  v25.version = 25;
  delete v25.treaties;
  delete v25.trust;
  delete v25.offers;
  delete v25.nextTreatyId;
  const m = CL.save.migrate(v25);
  assert.equal(m.version, CL.save.VERSION); // and on through the later steps
  assert.deepEqual(plain(m.treaties.map((t) => [t.kind, t.between, t.until])), [['truce', ['hrothmark', 'valedorn'], c.relations['hrothmark|valedorn'].truceUntil]]);
  assert.deepEqual(plain(m.trust), {});
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, G.save.VERSION);
    assert.ok(Array.isArray(G.campaign.treaties));
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign.treaties), JSON.stringify(G.campaign.treaties), `${f.file}: stable`);
  }
});
