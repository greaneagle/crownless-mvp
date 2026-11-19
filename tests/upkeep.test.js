// Food, wages, morale and desertion (GDD §9; Gate C step 4).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('one ration feeds 5 people a day, counting the hero', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const U = CL.upkeep;
  assert.equal(U.dailyRations(c), 1, 'hero alone');
  for (let i = 0; i < 4; i++) CL.save.addSoldier(c, 'levy');
  assert.equal(U.dailyRations(c), 1, '5 people');
  CL.save.addSoldier(c, 'levy');
  assert.equal(U.dailyRations(c), 2, '6 people');
  for (let i = 0; i < 5; i++) CL.save.addSoldier(c, 'levy');
  assert.equal(U.dailyRations(c), 3, '11 people');
});

test('time eats food: resting a day with 6 people uses 2 rations', () => {
  const { CL } = loadGame(); // fixture: hero + 5 soldiers, 3 rations from the kit
  CL.campaign.food = 10;
  CL.party.rest();
  assert.ok(near(CL.campaign.food, 8));
});

test('W-08: food follows the local grain: cheaper among the farms, dearer in the highlands, base price off the market', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const at = (id) => {
    c.world.location = id;
    return CL.upkeep.rationPrice(c);
  };
  assert.equal(at('oakford'), 7, 'farm country (grain 0.8)');
  assert.equal(at('stonebridge'), 8);
  assert.equal(at('hrothgard'), 9, 'the highlands (grain 1.2)');
  c.markets.hrothgard.grain = 1.4;
  assert.equal(at('hrothgard'), 10, 'and it moves with the grain market');
  assert.equal(at(null), 8, 'on the road: the base price');
});

test('rations cost 8 crowns, less 1% per Trade point, and need the gold', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  assert.equal(CL.upkeep.rationPrice(c), 8);
  c.character.skills.trade = 10;
  assert.equal(CL.upkeep.rationPrice(c), 7);
  const food = c.food;
  assert.equal(CL.upkeep.buyFood(c, 10), true);
  assert.equal(c.gold, 130 - 70);
  assert.equal(c.food, food + 10);
  c.gold = 5;
  assert.equal(CL.upkeep.buyFood(c, 1), false);
  assert.equal(c.gold, 5);
});

test('starving: morale falls 15 a day and the warning shows once', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  c.food = 0;
  CL.party.advanceDays(1);
  CL.party.advanceDays(1);
  assert.equal(c.morale, 70 - 30);
  assert.equal(c.starving, true);
  const warnings = uiCalls.filter((x) => x[0] === 'message' && /run out of food/.test(x[1]));
  assert.equal(warnings.length, 1);
});

test('GDD edge case: food runs out partway through travel', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  c.food = 0.5; // a quarter-day for 6 people
  CL.world.leaveSettlement();
  CL.world.click(...CL.world.toPx(78, 52)); // Redfield, most of a day away
  for (let t = 0; t < 120 && CL.game.travel; t += 0.05) CL.world.update(0.05);
  assert.equal(c.food, 0);
  assert.ok(c.morale < 70);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /run out of food/.test(x[1])));
});

test('a low-food warning fires when stocks drop below one day', () => {
  const { CL, uiCalls } = loadGame();
  CL.campaign.food = 2.5; // 1.25 days for 6 people
  CL.party.advanceDays(0.5);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /running low/.test(x[1])));
});

test('fed troops recover toward 70 morale, not above', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.food = 100;
  c.morale = 50;
  CL.party.advanceDays(2);
  assert.equal(c.morale, 60);
  CL.party.advanceDays(5);
  assert.equal(c.morale, 70);
  c.morale = 90;
  CL.party.advanceDays(1);
  assert.equal(c.morale, 90, 'high morale from victories is kept');
});

test('wages: every 7 days, wounded included; short pay costs morale (GDD edge case: no gold)', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  c.food = 100;
  c.roster[0].woundedUntil = 99;
  assert.equal(CL.upkeep.weeklyWages(c), 3 * 3 + 2 * 6);
  CL.party.advanceDays(6.9);
  assert.equal(c.gold, 130, 'not yet');
  CL.party.advanceDays(0.2);
  assert.equal(c.gold, 130 - 21);
  assert.equal(c.nextWagesDay, 14);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Paid 21 crowns/.test(x[1])));

  c.gold = 5;
  const morale = c.morale;
  CL.party.advanceDays(7);
  assert.equal(c.gold, 0);
  assert.equal(c.morale, morale - 20);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /paid 5 of 21/.test(x[1])));
});

test('desertion: only below 25 morale, one soldier per bad night', () => {
  const rolls = [];
  const { CL } = loadGame({ random: () => (rolls.length ? rolls.shift() : 0.99) });
  const c = CL.campaign;
  c.food = 100;
  c.morale = 30;
  rolls.push(0); // would desert if allowed
  CL.upkeep.desertionCheck(c);
  assert.equal(c.roster.length, 5, 'morale 30 holds');
  c.morale = 5;
  rolls.length = 0; // the morale-30 check returned before rolling
  rolls.push(0, 0); // desert, pick the first soldier
  const gone = CL.upkeep.desertionCheck(c);
  assert.equal(gone.id, 1);
  assert.equal(c.roster.length, 4);
  rolls.push(0.9); // 0.9 > chance at morale 5 (0.48)
  assert.equal(CL.upkeep.desertionCheck(c), null);
});

test('victory lifts morale by 5, defeat drops it by 10', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  c.food = 100;
  const base = c.morale;
  CL.party.applyBattleResult(c, { battleId: 1, encounterId: 'looter_band', win: true, kills: 0, killed: [], wounded: [] });
  assert.equal(c.morale, base + 5);
  CL.party.applyBattleResult(c, { battleId: 2, encounterId: 'looter_band', win: false, kills: 0, killed: [], wounded: [] });
  assert.equal(c.morale, base + 5 - 10);
});

test('older saves get upkeep fields; food items in the pack become rations', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({ version: 2, day: 10.5, inventory: { food_3_days: 2, boots: 1 }, roster: [] });
  assert.equal(s.food, 3 + 6, 'kit default plus two stowed food items');
  assert.deepEqual({ ...s.inventory }, { boots: 1 });
  assert.equal(s.morale, 70);
  assert.equal(s.nextWagesDay, 17);
  const t = CL.save.sanitize({ version: 2, food: -4, morale: 400, nextWagesDay: 'x', roster: [] });
  assert.equal(t.food, 3);
  assert.equal(t.morale, 100);
});

test('debug supplies: food and morale', () => {
  const { CL } = loadGame();
  CL.debugTools.addFood(10);
  assert.equal(CL.campaign.food, 13);
  CL.debugTools.addFood(-1000);
  assert.equal(CL.campaign.food, 0);
  CL.debugTools.addMorale(-200);
  assert.equal(CL.campaign.morale, 0);
});
