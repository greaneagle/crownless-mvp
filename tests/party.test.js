const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('recruiting spends gold and respects the 15-troop cap', () => {
  const { CL } = loadGame();
  CL.party.recruit('infantry');
  assert.equal(CL.campaign.gold, 110);
  assert.equal(CL.campaign.infantry, 4);
  CL.party.recruit('archer');
  assert.equal(CL.campaign.gold, 85);
  Object.assign(CL.campaign, { gold: 1000, infantry: 10, archer: 5 });
  CL.party.recruit('infantry');
  assert.equal(CL.campaign.infantry, 10, 'party full');
  Object.assign(CL.campaign, { gold: 19, infantry: 1, archer: 0 });
  CL.party.recruit('infantry');
  assert.equal(CL.campaign.infantry, 1, 'not enough gold');
});

test('casualties split by the 35% death roll', () => {
  const rolls = [0.1, 0.5, 0.34, 0.35];
  const { CL } = loadGame({ random: () => rolls.shift() ?? 0.9 });
  const fallen = (role) => ({ role, alive: false });
  const { lost, wounded } = CL.party.rollCasualties([
    fallen('infantry'),
    fallen('infantry'),
    fallen('archer'),
    fallen('archer'),
    { role: 'archer', alive: true },
  ]);
  assert.deepEqual({ ...lost }, { infantry: 1, archer: 1 });
  assert.deepEqual({ ...wounded }, { infantry: 1, archer: 1 });
});

test('victory pays 52 + 3/kill and 4 renown', () => {
  const { CL } = loadGame();
  const c = CL.save.starter();
  CL.party.applyBattleResult(c, true, 10, { infantry: 1, archer: 0 }, { infantry: 1, archer: 1 });
  assert.equal(c.gold, 130 + 52 + 30);
  assert.equal(c.renown, 4);
  assert.equal(c.victories, 1);
  assert.equal(c.battles, 1);
  assert.equal(c.infantry, 1);
  assert.equal(c.archer, 1);
  assert.equal(c.woundedInfantry, 1);
  assert.equal(c.woundedArcher, 1);
});

test('defeat keeps 80% of gold, floored', () => {
  const { CL } = loadGame();
  const c = CL.save.starter();
  c.gold = 99;
  CL.party.applyBattleResult(c, false, 0, { infantry: 0, archer: 0 }, { infantry: 0, archer: 0 });
  assert.equal(c.gold, 79);
  assert.equal(c.victories, 0);
});

test('endBattle applies results exactly once', () => {
  const { CL } = loadGame();
  CL.combat.startBattle();
  CL.party.endBattle(true);
  const gold = CL.campaign.gold;
  CL.party.endBattle(true); // mode is now 'result' → ignored
  assert.equal(CL.campaign.gold, gold);
  assert.equal(CL.campaign.battles, 1);
});

test('recover returns all wounded to duty and saves', () => {
  const { CL, storage } = loadGame();
  Object.assign(CL.campaign, { infantry: 1, archer: 0, woundedInfantry: 2, woundedArcher: 3 });
  CL.party.recover();
  assert.equal(CL.campaign.infantry, 3);
  assert.equal(CL.campaign.archer, 3);
  assert.equal(CL.campaign.woundedInfantry + CL.campaign.woundedArcher, 0);
  assert.equal(JSON.parse(storage.data.crownless_v03_party).archer, 3);
});
