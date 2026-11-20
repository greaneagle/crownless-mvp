// P7-10: the first business, a mill (SC-15, SC-16, SC-40; design §25.1, §27.4). Buying it; a week run
// through the same market functions as the player, limited by input, market and time; its own ledger,
// exact over 90 days; no money loop; bad weeks and their causes; the owner's law (the due, a change of
// hands, a Hostile owner's warning and seizure, seizure on payday); the expert price rules; saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { preHoldings } = require('./helpers/pre-holdings');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company at a market village with crowns. */
function setup(at = 'oakford', opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.gold = 2000;
  go(CL, c, at);
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, B: CL.business, messages };
}
function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
/** A mill bought here, with money in it. */
function owned(at = 'oakford', fund = 300, opts = {}) {
  const env = setup(at, opts);
  const b = env.B.buy(env.c, at);
  assert.ok(b, 'bought');
  if (fund) assert.equal(env.B.fund(env.c, fund), true);
  return { ...env, b };
}
/** The money into and out of the mill's account in its own ledger. */
function flows(B, b) {
  let into = 0;
  let out = 0;
  for (const e of b.book) {
    if (e.to === B.ACCOUNT) into += e.amount;
    if (e.from === B.ACCOUNT) out += e.amount;
  }
  return { into, out };
}

test('buying: a price by the settlement type, only where there is a market, one mill, never from a Hostile owner', () => {
  const { CL, c, B } = setup('oakford');
  const R = B.rules();
  assert.equal(B.priceAt('oakford'), R.price.village);
  assert.equal(B.priceAt('stonebridge'), R.price.town);
  assert.equal(B.priceAt('greywall_fort'), 0, 'no mill for sale in a fort');
  assert.equal(B.blocked(c, 'greywall_fort'), 'No mill for sale here');
  c.gold = 10;
  assert.match(B.blocked(c, 'oakford'), /^You need 300 crowns/);
  c.gold = 2000;
  c.reputation.valedorn = -60;
  assert.match(B.blocked(c, 'oakford'), /will not sell to you$/);
  c.reputation.valedorn = 0;
  const b = B.buy(c, 'oakford');
  assert.equal(c.gold, 2000 - R.price.village);
  assert.deepEqual(plain(B.state(c).owned.map((x) => x.place)), ['oakford']);
  assert.equal(B.cash(c), 0);
  assert.equal(b.manager, 'miller', 'the default manager comes with it');
  assert.equal(c.chronicle.at(-1).kind, 'business');
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), 'Bought the mill at Oakford.');
  go(CL, c, 'fernley');
  assert.equal(B.blocked(c, 'fernley'), 'You already own a mill');
  assert.equal(B.buy(c, 'fernley'), null);
});

test('money in and out only at the mill; the mill keeps its own ledger, and money to and from your purse is in both', () => {
  const { CL, c, B, b } = owned('oakford', 0);
  const before = c.ledger.length;
  assert.equal(B.fund(c, 100), true);
  assert.equal(B.cash(c), 100);
  assert.equal(b.book.at(-1).to, B.ACCOUNT);
  assert.equal(c.ledger.length, before + 1, 'the purse side is in your ledger too');
  go(CL, c, 'fernley');
  assert.equal(B.fund(c, 50), false, 'not from elsewhere');
  assert.equal(B.fund(c, -50), false);
  go(CL, c, 'oakford');
  assert.equal(B.fund(c, -40), true);
  assert.equal(B.cash(c), 60);
  assert.equal(B.fund(c, -61), false, 'never below zero');
  assert.equal(CL.accounts.label(B.ACCOUNT), 'the mill’s money');
  // Captors take a share of what you carry, never the mill's money (it stays at the mill).
  CL.accounts.seize(c, 0.5, 'captors');
  assert.equal(B.cash(c), 60);
});

test('a week: through the same market functions (grain dearer, flour cheaper there), nothing in the wagons, report and profit exact', () => {
  const { CL, c, B, b } = owned('oakford', 300);
  const T = CL.trade;
  const grainBefore = T.scarcity(c, 'oakford', 'grain');
  const flourBefore = T.scarcity(c, 'oakford', 'flour');
  const cargo = plain(c.cargo);
  const weight = T.cargoWeight(c);
  const mainLedger = c.ledger.length;
  const cash = B.cash(c);
  const w = B.payday(c);
  assert.ok(w.ground > 0, 'it ground grain');
  assert.equal(w.made, w.ground, 'the village miller makes a sack of flour from a sack of grain');
  assert.ok(T.scarcity(c, 'oakford', 'grain') > grainBefore, 'buying grain made it dearer there');
  assert.ok(T.scarcity(c, 'oakford', 'flour') < flourBefore, 'selling flour made it cheaper there');
  assert.deepEqual(plain(c.cargo), cargo);
  assert.equal(T.cargoWeight(c), weight, 'the mill uses no wagon room');
  assert.equal(w.profit, B.cash(c) - cash);
  assert.equal(w.profit, w.sales - w.grain - w.wage - w.due - w.repairs);
  assert.equal(w.due, Math.round(w.sales * B.rules().due));
  assert.equal(c.ledger.length, mainLedger, 'the week is in the mill’s ledger, not yours');
  assert.match(b.log.at(-1).text, /^Ground \d+ grain into \d+ flour: sold for \d+, the grain cost \d+, wage 6, the lord's due \d+\. Week [+−]\d+ crowns\./);
  assert.equal(b.weeks, 1);
});

test('limited by input, market and time: each sack must pay, the week has an end, and the market tires', () => {
  const { CL, c, B, b } = owned('stonebridge', 1000);
  const m = B.manager(b);
  const w1 = B.payday(c);
  assert.ok(w1.ground <= m.perWeek, 'never more than the miller’s week');
  // Run again and again without the market restocking: it soon grinds nothing, and says why.
  let last = w1;
  for (let i = 0; i < 8; i++) last = B.payday(c);
  assert.equal(last.ground, 0);
  assert.match(last.cause, /^grain too dear for the price of flour/);
  assert.ok(last.profit < 0, 'an idle week still pays the wage');
  assert.match(b.log.at(-1).text, /Bad week: grain too dear/);
  assert.equal(b.log.at(-1).bad, true);
  // The cost of each sack it ground was covered by its flour after the due (the margin), unit by unit.
  const T = CL.trade;
  assert.ok(T.unitSellPrice(c, 'stonebridge', 'flour') * (1 - B.rules().due) - T.unitBuyPrice(c, 'stonebridge', 'grain') < m.margin);
});

test('bad weeks and their causes: no money for the wage, not enough for grain, a breakdown', () => {
  const { c, B, b } = owned('oakford', 0);
  const w = B.payday(c);
  assert.equal(w.ground, 0);
  assert.equal(w.wage, 0);
  assert.match(w.cause, /^idle: not enough money for the village miller's wage/);
  assert.equal(B.cash(c), 0);
  B.fund(c, 10);
  const w2 = B.payday(c);
  assert.equal(w2.wage, 6);
  assert.ok(w2.ground === 0 && /not enough money for more grain/.test(w2.cause), w2.cause);
  // A breakdown: find a week the mill's own roll calls one.
  B.fund(c, 200);
  let found = null;
  for (let i = 0; i < 80 && !found; i++) {
    const day = c.day + 7 * (i + 1);
    if (B.roll(c, day, b.weeks + 1) < B.rules().repairs.chance) found = day;
    else b.weeks++;
  }
  assert.ok(found, 'a breakdown within 80 weeks');
  const cash = B.cash(c);
  const w3 = B.payday(c, found);
  assert.equal(w3.repairs, B.rules().repairs.cost);
  assert.equal(w3.ground, 0);
  assert.match(w3.cause, /^the millstone cracked/);
  assert.equal(B.cash(c), cash - w3.wage - w3.repairs);
});

test('the ledger is exact over 90 days of paydays, with no daily clicks (SC-40)', () => {
  const { CL, c, B, b } = owned('oakford', 300);
  const start = B.cash(c);
  const bookStart = flows(B, b);
  const paydays = Math.floor((90 - (c.nextWagesDay - c.day)) / 7) + 1;
  for (let d = 0; d < 90; d++) CL.party.advanceDays(1);
  assert.equal(b.weeks, paydays, 'one week run per payday crossed');
  const f = flows(B, b);
  assert.equal(B.cash(c), start + (f.into - bookStart.into) - (f.out - bookStart.out), 'its money is exactly what its ledger says');
  assert.equal(B.cash(c) - start, b.profit, 'the weekly reports add up to the change in its money');
  const weeks = b.log.filter((e) => /Week [+−]\d+ crowns/.test(e.text));
  assert.equal(weeks.length, paydays);
  assert.ok(b.profit > 0, 'a good spot pays');
  // No magic profit: never more than every sack at the best possible margin.
  const T = CL.trade;
  const best = T.unitSellPrice(c, 'oakford', 'flour', T.SCARCITY.max) - T.unitBuyPrice(c, 'oakford', 'grain', T.SCARCITY.min);
  assert.ok(b.profit < paydays * B.manager(b).perWeek * best);
});

test('time steps: smaller steps run the same weeks; one long step never makes more', () => {
  const run = (step) => {
    const { CL, c, B, b } = owned('oakford', 300);
    for (let t = 0; t < 90 - 1e-9; t += step) CL.party.advanceDays(step);
    return { weeks: b.weeks, profit: b.profit, cash: B.cash(c) };
  };
  const daily = run(1);
  const hourly = run(1 / 6);
  assert.equal(hourly.weeks, daily.weeks);
  assert.ok(Math.abs(hourly.profit - daily.profit) <= Math.max(10, daily.profit * 0.1), `${hourly.profit} vs ${daily.profit}`);
  const once = run(90);
  assert.equal(once.weeks, daily.weeks, 'no payday skipped or doubled');
  assert.ok(once.profit <= daily.profit, 'markets restock only between steps: one long step is the cautious case');
});

test('no money loop: selling returns less than you paid; buying and selling again always loses', () => {
  const { CL, c, B } = setup('oakford');
  const R = B.rules();
  const start = c.gold;
  for (let i = 0; i < 5; i++) {
    B.buy(c, 'oakford');
    B.fund(c, 100);
    const r = B.sell(c);
    assert.ok(r.price < R.price.village && r.price === Math.floor(R.price.village * R.sellBack));
    assert.equal(r.cash, 100, 'its money comes back to you');
  }
  assert.equal(c.gold, start - 5 * (R.price.village - Math.floor(R.price.village * R.sellBack)));
  assert.equal(B.get(c), null);
  assert.equal(c.accounts.budgets.mill, undefined);
  assert.deepEqual(plain(B.state(c).past.map((p) => p.end)), ['sold', 'sold', 'sold', 'sold', 'sold']);
  assert.equal(B.chronicleText(c.chronicle.at(-1)), 'Sold the mill at Oakford.');
  go(CL, c, 'fernley');
  assert.ok(B.buy(c, 'fernley'), 'after selling, another may be bought');
});

test('the owner’s law: a change of hands is told and the new owner takes the due (SC-15)', () => {
  // Oakford's seat is the capital, which never changes hands in Phase 8; Brackenfield's is Greywall
  // (P8-02: a village follows its seat).
  const { CL, c, B, b, messages } = owned('brackenfield', 300);
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian', 'test');
  assert.equal(CL.realm.owner('brackenfield', c), 'aurelian', 'the village went with its fort');
  B.tick(c);
  assert.equal(b.owner, 'aurelian');
  assert.ok(messages().some((m) => /^Your mill: Brackenfield is now held by Aurel.*Their law: they take 10% of the mill's sales\.$/.test(m)), messages().at(-1));
  assert.equal(b.seizeOn, null, 'a Neutral owner does not seize');
  const w = B.payday(c);
  assert.ok(w.due > 0);
  assert.match(b.book.find((e) => /’s due$/.test(e.why)).why, /Aurel/);
});

test('a Hostile owner warns, and seizes the mill and its money unless you sell first or mend relations (SC-16)', () => {
  const { CL, c, B, b, messages } = owned('oakford', 300);
  CL.realm.adjust(c, 'valedorn', -60);
  B.tick(c);
  assert.equal(b.seizeOn, Math.floor(c.day) + B.rules().seizeDays);
  assert.ok(messages().some((m) => /^Warning: .* will seize the mill at Oakford on day \d+ unless you sell it or mend relations first\.$/.test(m)));
  // Mending relations lifts the threat.
  CL.realm.adjust(c, 'valedorn', 60);
  B.tick(c);
  assert.equal(b.seizeOn, null);
  assert.ok(messages().at(-1).includes('no longer under threat'));
  // Hostile again, and this time nothing is done: seized on the day, told, never silent.
  CL.realm.adjust(c, 'valedorn', -60);
  B.tick(c);
  const cash = B.cash(c);
  const ledger = c.ledger.length;
  for (let d = 0; d < 7; d++) CL.party.advanceDays(1);
  assert.equal(B.get(c), null, 'seized');
  assert.ok(!c.ledger.slice(ledger).some((e) => e.from === B.ACCOUNT), 'none of its money came back to you');
  assert.equal(c.accounts.budgets.mill, undefined);
  assert.ok(messages().some((m) => /has seized your mill at Oakford and its \d+ crowns\.$/.test(m)));
  const past = B.state(c).past.at(-1);
  assert.deepEqual(plain(past), { kind: 'mill', place: 'oakford', day: past.day, end: 'seized', by: 'valedorn' });
  const line = c.chronicle.findLast((e) => e.kind === 'business');
  assert.equal(line.event, 'seized');
  assert.match(B.chronicleText(line), /^The mill at Oakford was seized by /);
  assert.ok(cash > 0);
});

test('selling under the threat of seizure works from anywhere', () => {
  const { CL, c, B } = owned('oakford', 120);
  CL.realm.adjust(c, 'valedorn', -60);
  B.tick(c);
  go(CL, c, 'eastwatch');
  const gold = c.gold;
  const r = B.sell(c);
  assert.equal(c.gold, gold + r.price + r.cash);
  assert.equal(r.cash, 120);
});

test('seized on payday: the law comes first, so it neither pays the wage nor grinds (§27.4)', () => {
  const { CL, c, B, b } = owned('oakford', 300);
  CL.realm.adjust(c, 'valedorn', -60);
  B.tick(c);
  const day = b.seizeOn;
  const book = b.book.length;
  assert.equal(B.payday(c, day), null);
  assert.equal(B.get(c), null);
  assert.equal(b.book.length, book + 1, 'one line: the seizure of its money');
  assert.match(b.book.at(-1).why, /^the mill seized by /);
});

test('the expert price rules stop the miller where you say, and say so', () => {
  const { c, B, b } = owned('oakford', 300);
  assert.equal(B.setRule(c, 'maxInput', 7), false, 'only the listed limits');
  assert.equal(B.setRule(c, 'maxInput', 8), true);
  const w = B.payday(c);
  assert.match(w.cause || w.stop, /^grain dearer than your limit of 8/);
  assert.match(b.log.at(-1).text, /(Bad week|Stopped short): grain dearer than your limit of 8\.$/);
  B.setRule(c, 'maxInput', null);
  B.setRule(c, 'minOutput', 17);
  const w2 = B.payday(c);
  assert.equal(w2.ground, 0);
  assert.match(w2.cause, /^flour cheaper than your limit of 17/);
  assert.equal(b.rules.minOutput, 17);
});

test('a master miller costs more but makes more flour of each sack', () => {
  const { CL, c, B, b } = owned('oakford', 300);
  const R = B.rules();
  const gold = c.gold;
  go(CL, c, 'fernley');
  assert.equal(B.setManager(c, 'master'), false, 'hired at the mill');
  go(CL, c, 'oakford');
  assert.equal(B.setManager(c, 'master'), true);
  assert.equal(c.gold, gold - R.managers.master.hire);
  const est = B.estimate(c, 'oakford', 'master');
  assert.ok(est.out > est.n, 'more flour than grain');
  const w = B.payday(c);
  assert.equal(w.wage, R.managers.master.wage);
  assert.equal(w.made, Math.floor(w.ground * R.managers.master.yield + 1e-9));
  assert.equal(B.setManager(c, 'miller'), true, 'back to the village miller, at no fee');
  assert.equal(b.manager, 'miller');
});

test('the estimate before buying: what the village miller would make at today’s prices', () => {
  const { c, B } = setup('oakford');
  const e = B.estimate(c, 'oakford');
  assert.ok(e.n > 0 && e.profit > 0, JSON.stringify(e));
  const bad = B.estimate(c, 'eldmoor');
  assert.ok(bad.n === 0 || bad.profit < e.profit, 'dear grain makes a poor mill');
});

test('saves: the mill, its rules, log and ledger survive; junk is dropped; v17 saves migrate', () => {
  const { CL, c, B, b } = owned('oakford', 300);
  B.setRule(c, 'maxInput', 10);
  B.payday(c);
  CL.realm.adjust(c, 'valedorn', -60);
  B.tick(c);
  const round = CL.save.fromRaw(plain(c)).campaign;
  const r = round.businesses.owned[0];
  assert.deepEqual(plain(r), plain(b));
  assert.equal(round.accounts.budgets.mill, B.cash(c));
  // Junk.
  const d = plain(c);
  d.businesses.owned[0].place = 'greywall_fort';
  d.businesses.past.push({ kind: 'mill', place: 'nowhere', day: 1, end: 'sold' }, { kind: 'inn', place: 'oakford', day: 1, end: 'sold' });
  const junk = CL.save.fromRaw(d).campaign;
  assert.deepEqual(plain(junk.businesses), { owned: [], past: [] });
  assert.equal(junk.accounts.budgets.mill, undefined);
  // Migration 17 → 18.
  const old = plain(c);
  old.version = 17;
  preHoldings(old);
  delete old.businesses;
  const m = CL.save.migrate(old);
  assert.equal(m.version, CL.save.VERSION);
  assert.deepEqual(plain(m.businesses), { owned: [], past: [] });
});

test('content: the mill’s rules are checked', () => {
  const { CL } = setup('oakford');
  const errs = [];
  const C = plain({ businesses: CL.content.table('businesses'), markets: CL.content.table('markets') });
  CL.business.validate(C, (e) => errs.push(e));
  assert.deepEqual(errs, []);
  C.businesses.mill.sellBack = 1.2;
  C.businesses.mill.managers.miller.hire = 5;
  CL.business.validate(C, (e) => errs.push(e));
  assert.equal(errs.length, 2);
});
