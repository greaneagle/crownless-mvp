// P9-01 · Realms as organisations: every realm's treasury and its book, money only between real
// accounts, a broke realm, a league's council at war, offices and their vacancies, the laws, and the
// save step (v24 → v25, 2.30.0's fixtures).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.30');

/** The world with only the lords riding; the company has money and food. */
function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  Object.assign(c, { gold: 2000, food: 400 });
  CL.game.mode = 'map';
  const id = (k) => Object.keys(c.people).find((x) => c.people[x].key === k);
  return { ...env, c, K: CL.crowns, R: CL.realm, F: CL.fiefs, id };
}
const days = (CL, n) => {
  for (let i = 0; i < n; i++) {
    CL.party.advanceDays(1);
    CL.game.contactParty = null;
  }
};
/** Test setup: empty a realm's treasury (on its book). */
const empty = (K, c, f) => K.pay(c, K.side(f), 'world', K.treasury(c, f), 'debug');

test('every realm starts with four weeks of its income; Merrow has a treasury and no offices', () => {
  const { c, K, R } = world();
  K.ensure(c);
  for (const f of R.kingdoms()) {
    assert.ok(K.treasury(c, f.id) > 0, f.id);
    assert.equal(K.treasury(c, f.id), K.RULES.startWeeks * K.income(c, f.id), `${f.id}: four weeks`);
  }
  assert.deepEqual(plain(K.record(c, 'merrow').offices), {});
  for (const f of R.realms()) assert.deepEqual(Object.keys(K.record(c, f.id).offices).sort(), ['chancellor', 'marshal', 'steward']);
});

test('money is conserved: 120 days of the world, every book balances every day, and the due comes in', () => {
  const { CL, c, K } = world();
  const problems = [];
  for (let d = 0; d < 120; d++) {
    days(CL, 1);
    for (const p of K.invariants(c)) if (problems.length < 5) problems.push(`day ${d}: ${p}`);
  }
  assert.deepEqual(problems, []);
  for (const f of ['valedorn', 'aurelian', 'hrothmark', 'vessaro']) {
    const b = K.record(c, f).book;
    assert.ok(b.length >= 12, `${f}: a book of 12 weeks`);
    assert.ok(b.some((p) => p.in.due > 0), `${f}: the crown's due comes in`);
    assert.ok(b.some((p) => p.in.tax > 0), `${f}: the tax of the ruler's own land`);
    assert.ok(b.some((p) => p.out.wages > 0 || p.out.militia > 0), `${f}: the ruler's land costs the crown`);
    assert.ok(b.some((p) => p.out.office === 30), `${f}: three officers paid`);
  }
  assert.ok(K.record(c, 'merrow').book.some((p) => p.in.trade > 0), 'the free city trades');
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
});

test('the due: the law’s share into the treasury, a twentieth more with a steward; never from the crown’s own land', () => {
  const { c, K, F, R } = world();
  K.ensure(c);
  const sid = Object.keys(c.holdings).find((s) => c.holdings[s].sovereign === 'valedorn' && !K.crownLand(c, s) && c.holdings[s].kind === 'fort');
  const h = F.ensure(c, sid);
  h.treasury = 500;
  const before = K.treasury(c, 'valedorn');
  const r = F.week(c, sid, 100);
  assert.equal(r.due, Math.round(r.tax * 0.1 * (1 + K.RULES.steward)), 'with a steward');
  assert.ok(K.record(c, 'valedorn').book.at(-1).in.due >= r.due);
  assert.equal(K.treasury(c, 'valedorn') - before, r.due);
  // Without a steward: the law's share alone.
  K.record(c, 'valedorn').offices.steward = null;
  const r2 = F.week(c, sid, 101);
  assert.equal(r2.due, Math.round(r2.tax * 0.1));
  // The crown's own land: its tax is the treasury's, its costs too; the ruler's own purse is untouched.
  const own = Object.keys(c.holdings).find((s) => c.holdings[s].sovereign === 'valedorn' && K.crownLand(c, s));
  assert.ok(own, 'the ruler holds land');
  const purse = c.holdings[own].treasury;
  const t0 = K.treasury(c, 'valedorn');
  const w = F.week(c, own, 102);
  assert.equal(w.due, 0);
  assert.equal(K.treasury(c, 'valedorn') - t0, w.tax - w.wages - w.repairs - w.refill);
  assert.equal(c.holdings[own].treasury, purse);
  assert.equal(R.rulerOf('valedorn', c), c.holdings[own].holder);
});

test('a mercenary is paid from the realm’s treasury; a broke realm can’t hire, can’t ransom, and its garrisons desert', () => {
  const { CL, c, K, R, F, id } = world();
  c.renown = 50;
  assert.ok(CL.allegiance.act(c, 'serve', 'valedorn'), CL.allegiance.offerWhy(c, 'serve', 'valedorn'));
  const pay = CL.allegiance.weeklyPay(c);
  const t0 = K.treasury(c, 'valedorn');
  const g0 = c.gold;
  c.allegiance.nextPay = c.day; // test setup: payday now
  CL.allegiance.tick(c);
  assert.equal(c.gold - g0, pay, 'paid');
  assert.equal(t0 - K.treasury(c, 'valedorn'), pay, 'from the treasury');
  assert.equal(c.ledger.at(-1).why, 'pay from the Valedorn Crown');
  // Broke: the week's pay is short, and nobody new is hired.
  empty(K, c, 'valedorn');
  const g1 = c.gold;
  c.allegiance.nextPay = c.day;
  const said = [];
  CL.ui.message = (t) => said.push(t);
  CL.allegiance.tick(c);
  assert.equal(c.gold, g1, 'nothing from an empty treasury');
  assert.match(said.join(' '), /treasury is short/);
  CL.allegiance.act(c, 'release', 'valedorn');
  c.allegiance.lastOath = -99;
  assert.match(CL.allegiance.offerWhy(c, 'serve', 'valedorn'), /treasury can't pay/);
  // Can't ransom: a captive lord's ruler, after 30 days, waits.
  const tancred = id('tancred_greymantle');
  CL.lords.beaten(c, CL.lords.partyOf(c, tancred), 'aurelian');
  const x = CL.lords.prisonerOf(c, tancred);
  for (const h of Object.values(c.holdings)) if (h.holder !== 'player') h.treasury = 0;
  c.day = x.since + CL.lords.KIN_RANSOM.rulerAfter;
  assert.equal(CL.lords.kinRansom(c, x), 'wait');
  // The ruler's fort: its garrison goes unpaid, and deserts after the warnings.
  const ruler = R.rulerOf('valedorn', c);
  const fort = Object.keys(c.holdings).find((s) => c.holdings[s].sovereign === 'valedorn' && c.holdings[s].kind === 'fort');
  if (c.holdings[fort].holder !== ruler) R.transfer(c, fort, { holder: ruler, willing: true, reason: 'test' });
  assert.ok(K.crownLand(c, fort));
  const h = F.ensure(c, fort);
  h.unrest = 90; // test setup: the land pays no tax, so nothing comes in
  for (let w = 0; w <= F.RULES.warnings; w++) {
    empty(K, c, 'valedorn');
    F.week(c, fort, 200 + w);
  }
  assert.equal(h.deserting, true, 'unpaid, they desert');
  assert.deepEqual(plain(K.invariants(c)), []);
});

test('a league goes to war by its council’s opinions; a crown by its ruler', () => {
  const { CL, c, K, R } = world();
  assert.equal(K.laws(c, 'vessaro').power, 'league');
  assert.equal(K.laws(c, 'vessaro').war, 'council');
  assert.equal(K.laws(c, 'valedorn').war, 'ruler');
  assert.equal(K.wantsWar(c, 'valedorn', 'hrothmark'), true, 'a crown: the ruler decides');
  assert.equal(K.wantsWar(c, 'vessaro', 'hrothmark'), false, 'the council thinks nothing ill of Hrothmark’s ruler');
  // Border clashes: tension heats, but the league holds back.
  R.setRelation(c, 'vessaro', 'hrothmark', 'tension', 'test');
  for (let i = 0; i < 10; i++) R.clashed(c, 'vessaro', 'hrothmark', 1);
  assert.equal(R.relation(c, 'vessaro', 'hrothmark'), 'tension');
  // The council's lords come to think ill of the other ruler: war.
  const ruler = R.rulerOf('hrothmark', c);
  for (const pid of CL.lords.riders(c).filter((p) => c.people[p].realm === 'vessaro')) for (let i = 0; i < 4; i++) CL.nobles.note(c, pid, ruler, 'abandoned', { kin: false });
  assert.equal(K.wantsWar(c, 'vessaro', 'hrothmark'), true);
  R.clashed(c, 'vessaro', 'hrothmark', 1);
  assert.equal(R.relation(c, 'vessaro', 'hrothmark'), 'war');
});

test('offices: filled by the ruler’s opinion, standing breaking ties; a captive’s falls vacant and is filled in 3 days; the passed over remember', () => {
  const { CL, c, K, R } = world();
  K.ensure(c);
  const ruler = R.rulerOf('valedorn', c);
  const marshal = K.holder(c, 'valedorn', 'marshal');
  assert.ok(marshal && R.fiefsOf(marshal, c).length, 'a lord with land');
  const held = Object.values(K.record(c, 'valedorn').offices);
  assert.equal(new Set(held).size, 3, 'three lords, one office each');
  // The marshal is taken; the chancellor's office is emptied too (test setup), so two could follow.
  CL.lords.beaten(c, CL.lords.partyOf(c, marshal), 'aurelian');
  K.record(c, 'valedorn').offices.chancellor = null;
  const [first, second] = K.choose(c, 'valedorn', 'marshal');
  assert.ok(first && second, 'two candidates');
  for (let i = 0; i < 3; i++) CL.nobles.note(c, ruler, second, 'helped', { kin: false }); // the ruler comes to think best of the second
  K.tick(c);
  assert.equal(K.holder(c, 'valedorn', 'marshal'), null, 'captive: vacant');
  c.day += 2;
  K.tick(c);
  assert.equal(K.holder(c, 'valedorn', 'marshal'), null, 'not yet');
  c.day += 1;
  K.tick(c);
  const pick = K.holder(c, 'valedorn', 'marshal');
  assert.equal(pick, second, 'filled by the ruler’s best opinion');
  assert.ok(CL.nobles.state(c).opinions[first][ruler].log.some(([k]) => k === 'passed_over'), 'the runner-up remembers');
  assert.ok(K.holder(c, 'valedorn', 'chancellor'), 'the other vacancy filled too');
  // The marshal leads the realm's sieges: named first among those who gather.
  assert.equal(K.officesOf(c, pick)[0].office, 'marshal');
  assert.deepEqual(plain(K.invariants(c)), []);
});

test('laws: the fiefs a lord may hold follow the realm’s law', () => {
  const { c, K, R } = world();
  K.ensure(c);
  assert.equal(R.fiefCap('valedorn', c), 3);
  K.record(c, 'valedorn').laws = { fiefCap: 1 };
  assert.equal(R.fiefCap('valedorn', c), 1);
  const lord = Object.keys(c.people).find((p) => c.people[p].realm === 'valedorn' && !R.rules(p, c) && R.fiefsOf(p, c).length === 1);
  const other = Object.keys(c.holdings).find((s) => c.holdings[s].sovereign === 'valedorn' && c.holdings[s].holder === R.rulerOf('valedorn', c) && c.holdings[s].kind === 'village');
  assert.equal(R.transfer(c, other, { holder: lord, willing: true, reason: 'test' }), false, 'one fief a lord here');
  K.record(c, 'valedorn').laws = {};
  assert.ok(R.transfer(c, other, { holder: lord, willing: true, reason: 'test' }));
});

test('saves: v24 → v25 (four weeks of income), a round trip, junk repaired, and 2.30.0’s saves load', () => {
  const { CL, c, K } = world();
  days(CL, 15);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.crowns), plain(c.crowns), 'round trip');
  // Junk: a negative treasury, a book that doesn't add up, an office held by nobody, a bad law.
  const d = plain(c);
  d.crowns.valedorn.treasury = -50;
  d.crowns.aurelian.book[0].start += 999;
  d.crowns.hrothmark.offices.marshal = 'person:999';
  d.crowns.vessaro.laws = { power: 'empire', fiefCap: 2 };
  d.crowns.nowhere = { treasury: 5 };
  const fixed = CL.save.fromRaw(d).campaign;
  assert.ok(fixed.crowns.valedorn.treasury > 0, 'a bad treasury starts afresh from its income');
  assert.equal(fixed.crowns.aurelian.book.length, 1, 'a broken book starts again from today');
  assert.notEqual(fixed.crowns.hrothmark.offices.marshal, 'person:999');
  assert.deepEqual(plain(fixed.crowns.vessaro.laws), { fiefCap: 2 }, 'only good laws are kept');
  assert.equal(fixed.crowns.nowhere, undefined);
  assert.deepEqual(plain(K.invariants(fixed)), []);
  // v24 → v25.
  const v24 = plain(c);
  v24.version = 24;
  delete v24.crowns;
  const m = CL.save.migrate(v24);
  assert.equal(m.version, 25);
  assert.deepEqual(plain(m.crowns), {});
  const loaded = CL.save.fromRaw(v24).campaign;
  for (const f of ['valedorn', 'merrow']) assert.equal(loaded.crowns[f].treasury, K.RULES.startWeeks * K.income(loaded, f));
  // 2.30.0's saves (the latest fixtures) load through the new step.
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, 25);
    for (const k of Object.keys(G.campaign.crowns)) assert.ok(G.campaign.crowns[k].treasury >= 0);
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign.crowns), JSON.stringify(G.campaign.crowns), `${f.file}: stable`);
  }
});
