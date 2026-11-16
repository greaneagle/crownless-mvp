const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A deterministic Math.random that replays `rolls`, then returns `rest`. */
const scripted = (rolls, rest = 0.99) => () => (rolls.length ? rolls.shift() : rest);

test('recruiting costs the troop recruitCost and respects the 15-soldier cap (wounded count)', () => {
  const { CL } = loadGame();
  assert.equal(CL.party.recruit('levy'), true);
  assert.equal(CL.campaign.gold, 115);
  assert.equal(CL.party.recruit('hunter'), true);
  assert.equal(CL.campaign.gold, 90);
  assert.equal(CL.campaign.roster.length, 7);
  assert.equal(CL.party.recruit('guard'), false, 'not hireable at camp');

  CL.campaign.gold = 1000;
  while (CL.campaign.roster.length < 15) CL.save.addSoldier(CL.campaign, 'levy', 9);
  assert.equal(CL.party.recruit('levy'), false, 'full, even though some are wounded');

  CL.campaign.roster.length = 5;
  CL.campaign.gold = 14;
  assert.equal(CL.party.recruit('levy'), false, 'not enough gold');
});

test('casualties: each fallen soldier rolls 35% killed, otherwise wounded', () => {
  const { CL } = loadGame({ random: scripted([0.1, 0.5, 0.34, 0.35]) });
  const fallen = (soldierId) => ({ alive: false, soldierId });
  const r = CL.party.rollCasualties([fallen(1), fallen(2), fallen(3), fallen(4), { alive: true, soldierId: 5 }]);
  assert.deepEqual([...r.killed], [1, 3]);
  assert.deepEqual([...r.wounded], [2, 4]);
});

test('victory pays the encounter reward, applies casualties and wound timers', () => {
  const { CL } = loadGame({ random: scripted([], 0.99) }); // 0.99 → no loot drops
  const c = CL.campaign;
  const r = CL.party.applyBattleResult(c, {
    battleId: 1,
    encounterId: 'captains_trial',
    win: true,
    kills: 10,
    killed: [1],
    wounded: [2, 4],
  });
  assert.equal(r.gold, 52 + 30);
  assert.equal(c.gold, 130 + 82);
  assert.equal(c.renown, 4);
  assert.equal(c.victories, 1);
  assert.equal(c.battles, 1);
  assert.equal(c.day, 0.25);
  assert.deepEqual(
    Array.from(c.roster, (s) => s.id),
    [2, 3, 4, 5],
  );
  assert.equal(c.roster.find((s) => s.id === 2).woundedUntil, 2.25, 'heals 2 days after the battle');
  assert.equal(CL.party.healthySoldiers().length, 2);
});

test('a battle pays out exactly once', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const outcome = { battleId: 1, encounterId: 'captains_trial', win: true, kills: 5, killed: [], wounded: [] };
  assert.ok(CL.party.applyBattleResult(c, outcome));
  const gold = c.gold;
  assert.equal(CL.party.applyBattleResult(c, outcome), null);
  assert.equal(c.gold, gold);
  assert.equal(c.battles, 1);
});

test('loot: one roll per kill at the encounter chance, picked by weight', () => {
  // kill 1: 0.1 < 0.3 → drop, pick 0 → first entry (food). kill 2: 0.5 → no drop.
  // kill 3: 0.2 → drop, pick 0.999 → last entry of the 'mid' table (nag).
  const { CL } = loadGame({ random: scripted([0.1, 0, 0.5, 0.2, 0.999]) });
  const enc = CL.content.encounter('captains_trial');
  const loot = CL.party.rollLoot(enc, 3);
  assert.deepEqual({ ...loot }, { food_3_days: 1, nag: 1 });
});

test('loot is added to the pack on victory', () => {
  const { CL } = loadGame({ random: scripted([0.1, 0]) });
  const before = CL.campaign.food;
  const r = CL.party.applyBattleResult(CL.campaign, {
    battleId: 1, encounterId: 'captains_trial', win: true, kills: 1, killed: [], wounded: [],
  });
  assert.deepEqual({ ...r.loot }, { food_3_days: 1 });
  const eaten = CL.upkeep.dailyRations(CL.campaign) * CL.party.BATTLE_DAYS; // the battle's quarter-day
  assert.equal(CL.campaign.food, before - eaten + 3, 'looted food goes into the ration stock');
  assert.equal('food_3_days' in CL.campaign.inventory, false);
});

test('capture keeps 80% of crowns and takes one non-quest item, never a quest item', () => {
  const { CL } = loadGame({ random: scripted([0]) });
  const c = CL.campaign;
  c.gold = 99;
  c.inventory = { courier_packet: 1, boots: 1 };
  const r = CL.party.applyBattleResult(c, {
    battleId: 1, encounterId: 'captains_trial', win: false, kills: 2, killed: [], wounded: [],
  });
  assert.equal(c.gold, 79);
  assert.equal(r.gold, -20);
  assert.equal(r.lostItem, 'boots');
  assert.deepEqual({ ...c.inventory }, { courier_packet: 1 });
  assert.equal(c.victories, 0);
});

test('wounded soldiers recover when two campaign days have passed', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.roster[0].woundedUntil = 2;
  assert.deepEqual([...CL.party.advanceDays(1)], []);
  assert.equal(CL.party.woundedSoldiers().length, 1);
  assert.deepEqual([...CL.party.advanceDays(1)], [1]);
  assert.equal(CL.party.woundedSoldiers().length, 0);
});

test('rest advances one day, heals and saves', () => {
  const { CL, storage, uiCalls } = loadGame();
  CL.campaign.roster[1].woundedUntil = 1;
  CL.party.rest();
  assert.equal(CL.campaign.day, 1);
  assert.equal(CL.party.dayNumber(), 2);
  assert.equal(CL.campaign.roster[1].woundedUntil, null);
  assert.equal(JSON.parse(storage.data.crownless_save).day, 1);
  assert.ok(uiCalls.some((c) => c[0] === 'message' && /back on their feet/.test(c[1])));
});

test('endBattle resolves once and links casualties to roster soldiers', () => {
  const { CL } = loadGame({ random: scripted([], 0.5) }); // 0.5 → every fallen soldier is wounded
  CL.combat.startBattle();
  const fallen = CL.game.allies[0];
  fallen.alive = false;
  CL.party.endBattle(true);
  const s = CL.campaign.roster.find((x) => x.id === fallen.soldierId);
  assert.equal(s.woundedUntil, 2.25);
  const gold = CL.campaign.gold;
  CL.party.endBattle(true);
  assert.equal(CL.campaign.gold, gold);
  assert.equal(CL.campaign.battles, 1);
  assert.match(CL.game.result.html, /Wounded: 1/);
});
