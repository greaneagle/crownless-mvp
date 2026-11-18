// Accounts and the quartermaster (V2-11; design §12, §25.1, SC-02): money lives in separate accounts,
// every transfer has a source and a destination, wages come from the company chest first, and a hired
// quartermaster keeps food and the next wages covered from the chest within a budget, logging it all.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

/** In Stonebridge (a market), with crowns and a few soldiers. */
function camp({ gold = 500, soldiers = ['levy', 'levy', 'hunter'], opts = {} } = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.gold = gold;
  c.roster = [];
  for (const t of soldiers) CL.save.addSoldier(c, t);
  return { ...env, c };
}
const total = (CL, c) => CL.accounts.total(c);

test('§25.1: every transfer has a source and a destination; nothing is made from thin air or overdrawn', () => {
  const { CL, c } = camp({ gold: 100 });
  const A = CL.accounts;
  assert.equal(A.transfer(c, 'purse', 'chest', 60, 'put in the chest'), true);
  assert.equal(c.gold, 40);
  assert.equal(A.balance(c, 'chest'), 60);
  assert.equal(total(CL, c), 100, 'moving money between accounts changes nothing in all');
  assert.equal(A.transfer(c, 'purse', 'chest', 41, 'too much'), false, 'never overdrawn');
  assert.equal(A.transfer(c, 'purse', 'chest', 2.5, 'not whole'), false);
  assert.equal(A.transfer(c, 'purse', 'nowhere', 5, 'unknown'), false);
  assert.equal(A.transfer(c, 'chest', 'chest', 5, 'to itself'), false);
  const e = c.ledger.at(-1);
  assert.equal(JSON.stringify([e.from, e.to, e.amount, e.why]), JSON.stringify(['purse', 'chest', 60, 'put in the chest']));
  for (let i = 0; i < A.LEDGER_MAX + 10; i++) A.earn(c, 1, 'drip');
  assert.equal(c.ledger.length, A.LEDGER_MAX, 'the ledger keeps the newest');
});

test('everything that moves money goes through the accounts: the ledger adds up to the change in your wealth', () => {
  const { CL, c } = camp({ gold: 400 });
  const start = total(CL, c);
  c.ledger = [];
  CL.party.recruit('levy');
  CL.upkeep.buyFood(c, 4);
  CL.trade.buy(c, 'stonebridge', Object.keys(c.markets.stonebridge)[0], 1);
  CL.trade.sell(c, 'stonebridge', Object.keys(c.markets.stonebridge)[0], 1);
  CL.accounts.transfer(c, 'purse', 'chest', 50, 'put in the chest');
  CL.party.advanceDays(8); // a payday
  const flow = c.ledger.reduce((n, e) => n + (e.from === 'world' ? e.amount : 0) - (e.to === 'world' ? e.amount : 0), 0);
  assert.equal(total(CL, c) - start, flow);
  const why = c.ledger.map((e) => e.why).join(' | ');
  for (const w of ['hiring a Levy', 'rations', 'market: bought', 'market: sold', 'put in the chest', 'weekly wages']) assert.ok(why.includes(w), w);
});

test('SC-02: wages come from the chest first, then your purse; the soldiers’ records count what was really paid', () => {
  const { CL, c } = camp({ gold: 10 });
  const owed = CL.upkeep.weeklyWages(c);
  CL.accounts.transfer(c, 'purse', 'chest', 5, 'put in the chest');
  c.food = 999;
  const paid = CL.upkeep.payWages(c).paid;
  assert.equal(paid, Math.min(owed, 10));
  assert.equal(CL.accounts.balance(c, 'chest'), 0, 'the chest went first');
  assert.equal(c.roster.reduce((n, s) => n + s.record.wagesPaid, 0), paid);
});

test('captors take a share of the chest as well as the purse', () => {
  const { CL, c } = camp({ gold: 200 });
  CL.accounts.transfer(c, 'purse', 'chest', 100, 'put in the chest');
  const taken = CL.accounts.seize(c, 0.8, 'taken by captors');
  assert.equal(taken, 40);
  assert.equal(c.gold, 80);
  assert.equal(CL.accounts.balance(c, 'chest'), 80);
});

test('the quartermaster: hired from the purse, sets the next wages aside, buys food from the chest only, within the budget, and logs it', () => {
  const { CL, c, uiCalls } = camp({ gold: 300 });
  const Q = CL.quartermaster;
  c.food = 0;
  const q = Q.hire(c);
  assert.ok(q);
  assert.ok(q.name.length > 0);
  const due = Q.wagesDue(c);
  assert.equal(due, CL.upkeep.weeklyWages(c) + Q.WAGE);
  // Hiring ran their first round: wages aside from the purse, food from the chest.
  assert.ok(CL.accounts.balance(c, 'chest') >= 0);
  assert.ok(c.ledger.some((e) => e.from === 'purse' && e.to === 'chest' && e.why === 'set aside for wages'));
  assert.equal(c.ledger.filter((e) => e.why.endsWith('rations')).every((e) => e.from === 'chest'), true, 'food only from the chest');
  // Nothing was in the chest for food: they drew it from the purse (within the budget) and bought.
  assert.ok(c.ledger.some((e) => e.from === 'purse' && e.to === 'chest' && e.why === 'drawn for food'));
  assert.ok(c.food > 0);
  assert.ok(q.spent <= Q.budgetOf(c));
  assert.match(q.log.at(-1).text, /^Bought \d+ rations at Stonebridge for \d+ from the chest/);
  // Again with an empty larder: they fill the reserve, but not past the weekly budget.
  q.spent = 0;
  c.food = 0;
  const done = Q.act(c);
  const need = q.reserveDays * CL.upkeep.dailyRations(c);
  const price = CL.upkeep.rationPrice(c);
  assert.equal(done.rations, Math.min(need, Math.floor(Q.budgetOf(c) / price)));
  assert.ok(q.spent <= Q.budgetOf(c));
  assert.ok(CL.accounts.balance(c, 'chest') >= due, 'the wage money is never spent on food');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /^Quartermaster .+: .*bought \d+ rations for \d+/.test(x[1])));
  // A week later the budget starts again.
  c.day += 7;
  c.food = 0;
  assert.ok(Q.act(c).rations > 0);
});

test('Part 2 §27: just before payday the quartermaster does not spend the wages on food', () => {
  const { CL, c } = camp({ gold: 0 });
  const Q = CL.quartermaster;
  c.gold = Q.HIRE;
  Q.hire(c);
  const due = Q.wagesDue(c);
  CL.accounts.earn(c, due + 3, 'test', 'chest'); // a few crowns more than the wages
  c.food = 0;
  const q = Q.get(c);
  q.spent = 0;
  const done = Q.act(c);
  assert.equal(done.rations, 0, 'not even one ration: it would eat into the wages');
  assert.equal(CL.accounts.balance(c, 'chest'), due + 3);
});

test('on the road the quartermaster warns before shortages, once a day; unpaid twice, they leave', () => {
  const { CL, c, uiCalls } = camp({ gold: 300 });
  const Q = CL.quartermaster;
  Q.hire(c);
  CL.world.leaveSettlement();
  c.food = 1;
  Q.daily(c);
  Q.daily(c);
  const warns = uiCalls.filter((x) => x[0] === 'message' && /^Quartermaster .+: food for [\d.]+ days; we need a market\.$/.test(x[1]));
  assert.equal(warns.length, 1);
  c.gold = 0;
  CL.accounts.seize(c, 0, 'emptied');
  Q.payday(c);
  assert.ok(Q.get(c), 'warned after the first');
  Q.payday(c);
  assert.equal(Q.get(c), null, 'gone after the second');
});

test('rules stay within limits, and the quartermaster, chest and ledger survive save and reload', () => {
  const storage = memoryStorage();
  const { CL, c } = camp({ gold: 300, opts: { storage } });
  const Q = CL.quartermaster;
  Q.hire(c);
  Q.setRule(c, 'reserveDays', 99);
  Q.setRule(c, 'budget', -5);
  Q.setRule(c, 'coverWages', false);
  assert.equal(Q.get(c).reserveDays, Q.LIMITS.reserveDays[1]);
  assert.equal(Q.get(c).budget, 0);
  CL.accounts.transfer(c, 'purse', 'chest', 33, 'put in the chest');
  assert.equal(CL.save.write(), true);
  const back = loadGame({ storage }).CL.campaign;
  assert.equal(JSON.stringify(back.followers), JSON.stringify(c.followers));
  assert.equal(back.accounts.chest, c.accounts.chest);
  assert.equal(JSON.stringify(back.ledger), JSON.stringify(c.ledger));
});

test('migration 7 → 8: an empty chest, an empty ledger, no followers; your gold is your purse', () => {
  const { CL, c } = camp({ gold: 123 });
  const v7 = JSON.parse(JSON.stringify(c));
  v7.version = 7;
  for (const k of ['accounts', 'ledger', 'followers']) delete v7[k];
  const v8 = CL.save.MIGRATIONS[7](v7);
  assert.equal(v8.version, 8);
  assert.equal(v8.gold, 123);
  assert.equal(JSON.stringify([v8.accounts, v8.ledger, v8.followers]), JSON.stringify([{ chest: 0, budgets: {} }, [], { quartermaster: null }]));
  assert.equal(CL.save.check(v8).problems.length, 0);
});

test('V2-T1: the quartermaster’s budget is automatic by default and grows with the company; a fixed one can be set and undone', () => {
  const { CL, c } = camp({ gold: 500 });
  const Q = CL.quartermaster;
  Q.hire(c);
  assert.equal(Q.get(c).budget, null, 'automatic');
  const week = 7 * CL.upkeep.dailyRations(c) * CL.upkeep.rationPrice(c);
  assert.ok(Q.budgetOf(c) >= week * 1.25 && Q.budgetOf(c) < week * 1.25 + 10, 'a week’s food and a quarter');
  const small = Q.budgetOf(c);
  for (let i = 0; i < 12; i++) CL.save.addSoldier(c, 'levy');
  assert.ok(Q.budgetOf(c) > small, 'more mouths, a bigger budget');
  Q.setRule(c, 'budget', 80);
  assert.equal(Q.budgetOf(c), 80);
  Q.setRule(c, 'budget', null);
  assert.equal(Q.get(c).budget, null);
  // A big company left to the quartermaster alone still eats: a week of buying covers a week of food.
  c.food = 0;
  Q.get(c).spent = 0;
  CL.accounts.transfer(c, 'purse', 'chest', 300, 'put in the chest');
  Q.act(c);
  assert.ok(CL.upkeep.foodDays(c) >= Q.get(c).reserveDays - 0.01);
});
