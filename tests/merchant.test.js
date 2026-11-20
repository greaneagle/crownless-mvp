// The merchant follower (V2-12; design §12.3, §12.7, SC-13, SC-14, Prototype E): trades an assigned
// budget through the same market functions as the player, knows only prices it has seen, reports what
// it did and why, and can be stopped and paid out at any time.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');
const { preHoldings } = require('./helpers/pre-holdings');

/** A company with money, standing in a market town. */
function camp({ at = 'oakford', gold = 600, opts = {} } = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.gold = gold;
  c.roster = [];
  for (const t of ['levy', 'levy', 'levy', 'levy']) CL.save.addSoldier(c, t); // room in the wagons
  c.food = 99;
  goTo(CL, c, at, false);
  return { ...env, c };
}
/** Arrive somewhere (without the rest of the arrival: just where the company is). */
function goTo(CL, c, sid, trade = true) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
  return trade ? CL.merchant.visit(c) : null;
}
const budget = (CL, c) => CL.accounts.balance(c, CL.merchant.ACCOUNT);

test('§12.7: hire, give a budget, trade between two markets, read exactly what and why, stop, recover, and it all survives a reload', () => {
  const storage = memoryStorage();
  const { CL, c } = camp({ opts: { storage } });
  const M = CL.merchant;
  const m = M.hire(c);
  assert.ok(m);
  assert.equal(M.fund(c, 200), true);
  assert.equal(budget(CL, c), 200);
  assert.deepEqual(Object.keys(m.prices), ['oakford'], 'knows only where it has been');
  // Saltmere: salt is cheap here and dear in Oakford.
  c.day += 1;
  const r1 = goTo(CL, c, 'saltmere');
  assert.ok(r1.bought.salt?.n > 0, r1.text);
  assert.match(r1.text, /^At Saltmere: Bought \d+ salt for \d+.*Cash \d+\.$/);
  assert.ok(m.stock.salt > 0);
  // Back in Oakford: sells it for more than it cost.
  c.day += 1;
  const cost = m.paid.salt;
  const r2 = goTo(CL, c, 'oakford');
  assert.ok(r2.sold.salt.total > cost, `${r2.sold.salt.total} > ${cost}`);
  assert.ok(m.log.some((e) => /^At Oakford: Sold \d+ salt for \d+/.test(e.text)));
  // Stop: nothing happens at the next market.
  M.setActive(c, false);
  assert.equal(goTo(CL, c, 'saltmere'), null);
  // Recover, then reload: the purse has it all.
  const before = c.gold + budget(CL, c);
  const got = M.recover(c);
  assert.equal(c.gold, before);
  assert.equal(budget(CL, c), 0);
  assert.ok(got.cash > 0);
  assert.equal(CL.save.write(), true);
  const back = loadGame({ storage }).CL.campaign;
  assert.equal(back.gold, c.gold);
  assert.equal(JSON.stringify(back.followers.merchant), JSON.stringify(c.followers.merchant));
});

test('SC-13: every buy and sale is a real market trade from the budget; the budget is bounded; your purse is never touched', () => {
  const { CL, c } = camp();
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 200);
  const purse = c.gold;
  c.ledger = [];
  for (const sid of ['saltmere', 'oakford', 'highmere', 'brackenfield', 'saltmere', 'oakford']) {
    c.day += 1;
    goTo(CL, c, sid);
    assert.ok(budget(CL, c) >= 0);
  }
  assert.equal(c.gold, purse, 'not one crown from your purse');
  const mine = c.ledger.filter((e) => e.from === M.ACCOUNT || e.to === M.ACCOUNT);
  assert.ok(mine.length > 0);
  for (const e of mine) assert.match(e.why, /^merchant: (bought|sold) 1 [a-z]+$/, 'only market trades, a unit at a time');
  const flow = mine.reduce((n, e) => n + (e.to === M.ACCOUNT ? e.amount : -e.amount), 0);
  assert.equal(budget(CL, c), 200 + flow, 'the budget is exactly what came in and went out');
  assert.equal(JSON.stringify(c.cargo), '{}', 'your cargo untouched');
});

test('no same-town profit loop: visiting one market again and again earns nothing', () => {
  const { CL, c } = camp();
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 200);
  c.day += 1;
  goTo(CL, c, 'saltmere');
  const worth = M.worth(c);
  for (let i = 0; i < 5; i++) goTo(CL, c, 'saltmere');
  assert.ok(M.worth(c) <= worth);
  assert.equal(Object.keys(M.get(c).stock).every((g) => M.get(c).stock[g] >= 0), true);
});

test('SC-14: with no profitable trade the merchant keeps the capital and says so', () => {
  const { CL, c } = camp({ at: 'stonebridge' });
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 150);
  const r = goTo(CL, c, 'stonebridge');
  assert.equal(Object.keys(r.bought).length + Object.keys(r.sold).length, 0);
  assert.match(r.text, /^At Stonebridge: no safe trade \(no other market known yet\)\. Cash 150 kept\.$/);
  assert.equal(budget(CL, c), 150);
});

test('it knows only prices it has seen, and trusts old ones less (a bounded estimate)', () => {
  const { CL, c } = camp();
  const M = CL.merchant;
  M.hire(c);
  assert.equal(M.bestElsewhere(c, 'salt', 'saltmere').sid, 'oakford');
  assert.equal(M.bestElsewhere(c, 'salt', 'oakford'), null, 'nothing known but here');
  const fresh = M.bestElsewhere(c, 'salt', 'saltmere').price;
  c.day += 40;
  const old = M.bestElsewhere(c, 'salt', 'saltmere').price;
  assert.ok(Math.abs(old - fresh * (1 - M.DECAY.max)) < 1e-9, 'never trusted less than the cap allows');
  assert.equal('highmere' in M.get(c).prices, false);
});

test('Prototype E, honest merchant: 200 crowns over 30 days of markets; nothing appears without a source', () => {
  const { CL, c } = camp();
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 200);
  const route = ['saltmere', 'oakford', 'highmere', 'brackenfield', 'dunmarsh', 'redfield', 'eastwatch', 'stonebridge'];
  let bought = 0;
  let sold = 0;
  for (let day = 0; day < 30; day++) {
    CL.party.advanceDays(1); // markets drift back; wages are paid
    const r = goTo(CL, c, route[day % route.length]);
    for (const x of Object.values(r?.bought || {})) bought += x.total;
    for (const x of Object.values(r?.sold || {})) sold += x.total;
  }
  const m = M.get(c);
  assert.ok(m, 'still with the company (paid from the purse)');
  assert.equal(budget(CL, c), 200 - bought + sold, 'cash: only what trades brought in and took out');
  assert.ok(M.stockCost(m) <= bought + 1e-9, 'goods held cost no more than was spent on goods');
  assert.equal(c.ledger.filter((e) => e.from === 'world' && e.to === M.ACCOUNT && !e.why.startsWith('merchant: sold')).length, 0, 'no income but sales');
  assert.ok(M.worth(c) > 150 && M.worth(c) < 400, `a believable result: ${M.worth(c)}`);
  assert.ok(m.log.length > 0);
});

test('unpaid twice, the merchant leaves and hands back the budget and goods; captors take a share of the budget', () => {
  const { CL, c, uiCalls } = camp();
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 100);
  c.day += 1;
  goTo(CL, c, 'saltmere');
  const goods = Object.values(M.get(c).stock).reduce((a, b) => a + b, 0);
  const cash = budget(CL, c);
  CL.accounts.seize(c, 0.8, 'taken by captors');
  assert.equal(budget(CL, c), Math.floor(cash * 0.8));
  c.gold = 0;
  M.payday(c);
  M.payday(c);
  assert.equal(M.get(c), null);
  assert.equal(c.gold, Math.floor(cash * 0.8), 'the budget came back to the purse');
  assert.equal(Object.values(c.cargo).reduce((a, b) => a + b, 0), goods, 'and the goods to your cargo');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /has gone unpaid twice and leaves/.test(x[1])));
});

test('migration 8 → 9 makes room for a merchant; a damaged merchant is repaired or dropped', () => {
  const { CL, c } = camp();
  const v8 = JSON.parse(JSON.stringify(c));
  v8.version = 8;
  preHoldings(v8);
  delete v8.followers.merchant;
  const v9 = CL.save.MIGRATIONS[8](v8);
  assert.equal(v9.version, 9);
  assert.equal(v9.followers.merchant, null);
  CL.merchant.hire(c);
  const d = JSON.parse(JSON.stringify(c));
  d.followers.merchant.stock = { salt: 3, gold_bars: 9, wool: -2 };
  d.followers.merchant.preset = 'reckless';
  const s = CL.save.sanitize(d);
  assert.equal(JSON.stringify(s.followers.merchant.stock), JSON.stringify({ salt: 3 }));
  assert.equal(s.followers.merchant.preset, 'cautious');
  d.followers.merchant.name = '';
  assert.equal(CL.save.sanitize(d).followers.merchant, null);
});

test('V2-T1: stock that waits sells at cost after 6 days and at a small loss after 14, so capital never sits idle', () => {
  const { CL, c } = camp();
  const M = CL.merchant;
  M.hire(c);
  M.fund(c, 200);
  c.day += 1;
  goTo(CL, c, 'saltmere');
  const m = M.get(c);
  assert.ok(m.stock.salt > 0);
  // Redfield pays about 92% of what the salt cost: not worth it fresh, nor at a week (below cost)…
  c.day += 1;
  assert.ok(!goTo(CL, c, 'redfield').sold.salt);
  c.day += 6;
  assert.ok(!goTo(CL, c, 'redfield').sold.salt, 'at a week it would only sell at cost');
  // …but after 14 days it goes, at no worse than 85% of cost.
  c.day += 8;
  const cost = m.paid.salt;
  const n = m.stock.salt;
  const r = goTo(CL, c, 'redfield');
  assert.ok(r.sold.salt?.n > 0, r.text);
  assert.match(r.text, /salt for \d+ \(old stock\)/);
  assert.ok(r.sold.salt.total >= (cost / n) * r.sold.salt.n * M.AGE.loss - 1);
  assert.deepEqual(Object.keys(M.PRESETS), ['cautious', 'bold']);
  assert.equal(M.PRESETS.bold.margin, 0.06);
});
