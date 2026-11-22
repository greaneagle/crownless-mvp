// P9-B3 (D-P9b): a bigger company. The limit grows to 200 (tests/progression.test.js has its parts);
// here: a company of 150's week (wages, food, the quartermaster), hiring five at once, and the world's
// armies to match (households and garrisons three times the data's, at the same cost; bands, patrols and
// caravans beyond the March bigger).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A company of `n` of the usual mix. */
function company(CL, n) {
  const c = CL.campaign;
  c.roster = [];
  const mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard'];
  for (let i = 0; i < n; i++) CL.save.addSoldier(c, mix[i % mix.length]);
  return c;
}

test('a company of 150: its wages and its food, exactly', () => {
  const { CL } = loadGame();
  const c = company(CL, 150);
  const U = CL.upkeep;
  const wages = c.roster.reduce((n, s) => n + CL.content.troop(s.troop).wage, 0);
  assert.equal(U.weeklyWages(c), wages);
  assert.equal(U.partySize(c), 151, 'the hero and 150');
  c.food = 1000;
  const per = U.dailyRations(c);
  U.tick(c, c.day, c.day + 1);
  assert.equal(c.food, 1000 - per, 'a day’s rations');
  c.gold = wages; // the purse pays when the chest is empty
  const r = U.payWages(c);
  assert.deepEqual([r.owed, r.paid], [wages, wages]);
});

test('the quartermaster keeps a company of 150: the automatic budget grows with it, a fixed one may reach 10,000', () => {
  const { CL } = loadGame();
  const c = company(CL, 150);
  c.gold = 5000;
  const Q = CL.quartermaster;
  assert.ok(Q.hire(c), 'hired');
  const week = CL.upkeep.dailyRations(c) * 7 * CL.upkeep.rationPrice(c);
  assert.ok(Q.budgetOf(c) >= week, `the automatic budget (${Q.budgetOf(c)}) covers a week’s food (${week})`);
  Q.setRule(c, 'budget', 4000);
  assert.equal(Q.budgetOf(c), 4000, 'a fixed budget over the old 1,000');
  Q.setRule(c, 'budget', 50000);
  assert.equal(Q.budgetOf(c), 10000, 'kept within its limit');
});

test('hiring five at once: each a hire, within the money and the room', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.roster = [];
  c.character.skills.leadership = 4; // a limit of 28
  c.world.location = 'stonebridge';
  const id = CL.party.recruitsHere()[0];
  const price = CL.content.troop(id).recruitCost;
  c.gold = price * 7;
  assert.equal(CL.party.canHireMany(c, id, 5), 5);
  assert.equal(CL.party.recruitMany(id, 5), 5);
  assert.equal(c.roster.length, 5);
  assert.equal(c.gold, price * 2);
  assert.equal(CL.party.canHireMany(c, id, 5), 2, 'the money left');
  assert.equal(CL.party.recruitMany(id, 5), 2);
  c.gold = 99999;
  while (CL.party.headcount(c) < CL.party.partyCap(c) - 3) CL.save.addSoldier(c, 'levy');
  assert.equal(CL.party.canHireMany(c, id, 5), 3, 'the room left');
  assert.equal(CL.party.recruitMany(id, 5), 3);
  assert.equal(CL.party.headcount(c), CL.party.partyCap(c), 'full, never over');
  assert.equal(CL.events.recent.filter((e) => e.type === 'SoldierRecruited').length, 10, 'every one a hire');
});

test('the world to match: garrisons and households three times the data’s; a fort’s garrison costs what it did', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const A = CL.world.armies();
  assert.deepEqual([A.households, A.garrisons, A.beyondHome], [3, 3, 2.5]);
  const F = CL.fiefs;
  const base = CL.content.get('settlements', 'westholt_castle').garrison;
  const h = c.holdings.westholt_castle;
  assert.equal(F.count(h.garrison), 22 * 3);
  assert.equal(F.garrisonTarget(h), 22 * 3);
  // The week's wages for the tripled garrison: what the data's garrison cost at a third of each wage.
  const old = Math.round(Object.entries(base).reduce((n, [id, k]) => n + CL.content.troop(id).wage * k, 0) / 3);
  const r = F.week(c, 'westholt_castle', 0);
  assert.ok(Math.abs(r.wages - old) <= 1, `garrison wages ${r.wages}, as before ${old}`);
});

test('beyond the March, bands, patrols and caravans are bigger; in the March they are as they were', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const W = CL.world;
  let inside = 0;
  let outside = 0;
  for (const t of Object.values(CL.content.table('party_templates'))) {
    if (!['bandit', 'patrol', 'caravan'].includes(t.kind)) continue;
    for (let i = 0; i < 4; i++) {
      const p = CL.parties.spawn(c, t.id);
      const k = W.regionAt(p.x, p.y)?.home ? 1 : W.armies().beyondHome;
      const n = Object.values(p.troops).reduce((a, b) => a + b, 0);
      const most = Object.values(t.troops).reduce((a, [, hi]) => a + Math.round(hi * k), 0);
      assert.ok(n <= Math.max(most, 1), `${t.id}: ${n} at most ${most}`);
      if (k === 1) inside++;
      else {
        outside++;
        const least = Object.values(t.troops).reduce((a, [lo]) => a + (lo ? Math.max(1, Math.round(lo * k)) : 0), 0);
        assert.ok(n >= least, `${t.id}: ${n} at least ${least} beyond the March`);
      }
    }
  }
  assert.ok(inside > 0 && outside > 0, `${inside} in the March, ${outside} beyond`);
});

const CL_MAX = loadGame().CL.content.get('contracts', 'bandit_hunt').maxTroops; // 14

test('contracts fit the company: up to 20 as before; a company of 100 is offered bigger bands and paid for them', () => {
  const offer = (n, template) => {
    const { CL } = loadGame({ seed: 99 });
    const c = company(CL, n);
    const o = CL.contracts.makeOffer(c, 'stonebridge', template);
    return { o, size: o.troops ? Object.values(o.troops).reduce((a, b) => a + b, 0) : 0 };
  };
  const small = offer(19, 'bandit_hunt');
  const big = offer(99, 'bandit_hunt');
  // Past 20, the largest band grows with the square root of the company's size over 20 (14 → about 31 for 100).
  assert.ok(big.size > CL_MAX && big.size <= Math.round(CL_MAX * Math.sqrt(5)), `a hunt's band: ${small.size} for 19, ${big.size} for 99`);
  assert.ok(big.o.reward.gold > small.o.reward.gold * 1.5, `its pay: ${small.o.reward.gold} and ${big.o.reward.gold}`);
  const t = loadGame().CL.content.get('contracts', 'bandit_hunt');
  assert.ok(small.size <= t.maxTroops, `up to 20, the template’s largest band at most (${small.size})`);
  const escort = [offer(19, 'escort'), offer(99, 'escort')];
  assert.ok(escort[1].size > escort[0].size && escort[1].o.reward.gold > escort[0].o.reward.gold * 2, `an escort’s ambush (${escort[0].size}, ${escort[1].size}) and pay (${escort[0].o.reward.gold}, ${escort[1].o.reward.gold})`);
});

test('a mercenary company pays its way: the realm’s weekly pay covers its soldiers’ wages', () => {
  const { CL } = loadGame();
  const c = company(CL, 120);
  assert.ok(CL.allegiance.weeklyPay(c) >= CL.upkeep.weeklyWages(c), `${CL.allegiance.weeklyPay(c)} a week against wages of ${CL.upkeep.weeklyWages(c)}`);
});
