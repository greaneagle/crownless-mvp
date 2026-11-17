// Battle scaling (GDD §6 "profile 20 active units, then 30, then 40 … reserve stacks enter as
// others fall"; §12 "battle wave cap configurable"; §15 edge case "battle ends during reinforcement
// spawn"; Gate E 5.1).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const live = (list) => list.filter((u) => u.alive).length;

function battle({ cap = 40, soldiers = [], wave = { looter: 8 }, waves } = {}) {
  const env = loadGame();
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of soldiers) CL.save.addSoldier(c, t);
  CL.combat.setActiveCap(cap);
  CL.combat.startBattle({ id: 'test', name: 'Test', map: 'grass_field', waves: waves || [wave], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  Object.assign(CL.game, { hold: {}, joystick: { x: 0, y: 0 } });
  return { ...env, g: CL.game, c };
}

const step = (CL) => CL.combat.update(1 / 60);
function fell(CL, units, n) {
  for (const u of units.filter((x) => x.alive).slice(0, n)) u.alive = false;
  step(CL);
}

test('at the default size (40) today’s battles fit: a full company of 20 and a wave of 8, nobody waits', () => {
  const soldiers = [...Array(12).fill('footman'), ...Array(8).fill('hunter')];
  const { g } = battle({ soldiers });
  assert.equal(g.allies.length, 20);
  assert.equal(g.allyReserve.length, 0);
  assert.equal(g.enemies.length, 8);
  assert.equal(g.enemyReserve.length, 0);
});

test('a smaller battle size keeps the field to the cap; the rest wait and step in a stack at a time', () => {
  const soldiers = [...Array(12).fill('footman'), ...Array(8).fill('hunter')];
  const { CL, g, uiCalls } = battle({ cap: 20, soldiers });
  const onField = () => (g.hero.alive ? 1 : 0) + live(g.allies) + live(g.enemies);
  assert.equal(g.allyCap + g.enemyCap, 20);
  assert.equal(onField(), 20);
  assert.equal(live(g.enemies), 8);
  assert.equal(g.allyReserve.length, 20 - (g.allyCap - 1));
  // Two fall: not yet a full stack's room, so nobody steps in.
  const waiting = g.allyReserve.length;
  fell(CL, g.allies, 2);
  assert.equal(g.allyReserve.length, waiting);
  // A third: three step in together, and the field is full again.
  fell(CL, g.allies, 1);
  assert.equal(g.allyReserve.length, waiting - 3);
  assert.equal(onField(), 20);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Your reserves: 3 join the fight/.test(x[1])));
  // Reinforcements are real soldiers from the roster: they count for XP and casualties.
  assert.ok(g.allies.slice(-3).every((a) => a.soldierId != null && a.team === 'ally'));
  assert.ok(onField() <= 20, 'never over the cap');
});

test('soldiers beyond their formation slots fight as reserves instead of sitting out', () => {
  const { CL, g } = battle({ soldiers: Array(15).fill('footman') });
  assert.equal(g.allies.length, 12, 'twelve infantry in formation');
  assert.equal(g.allyReserve.length, 3);
  fell(CL, g.allies, 3);
  assert.equal(g.allyReserve.length, 0);
  assert.equal(live(g.allies), 12);
});

test('a big enemy wave holds some back; the battle only ends once the reserves are spent', () => {
  const { CL, g } = battle({ cap: 20, soldiers: Array(12).fill('footman'), wave: { looter: 14 } });
  assert.equal(live(g.enemies), g.enemyCap);
  assert.equal(g.enemyReserve.length, 14 - g.enemyCap);
  // Cut down everyone on the field: the last of the reserve still comes on (GDD §15 edge case).
  while (g.enemyReserve.length) fell(CL, g.enemies, live(g.enemies));
  assert.equal(g.mode, 'battle', 'not over while the last reserves are on the field');
  fell(CL, g.enemies, live(g.enemies));
  assert.equal(g.mode, 'result');
  assert.equal(g.result.win, true);
});

test('the company is not beaten while its reserves can still step in', () => {
  const { CL, g } = battle({ cap: 20, soldiers: Array(16).fill('levy') });
  assert.ok(g.allyReserve.length > 0);
  g.hero.alive = false;
  fell(CL, g.allies, live(g.allies));
  assert.equal(g.mode, 'battle');
  assert.ok(live(g.allies) > 0, 'the reserves took the field');
  while (g.allyReserve.length) fell(CL, g.allies, live(g.allies));
  fell(CL, g.allies, live(g.allies));
  assert.equal(g.mode, 'result');
  assert.equal(g.result.win, false);
});

test('waves still come in order, each with its own reserve', () => {
  const { CL, g } = battle({ cap: 20, soldiers: Array(12).fill('footman'), waves: [{ looter: 12 }, { reaver: 4 }] });
  assert.equal(g.wave, 1);
  while (g.enemyReserve.length) fell(CL, g.enemies, live(g.enemies));
  fell(CL, g.enemies, live(g.enemies));
  assert.equal(g.wave, 2);
  assert.equal(live(g.enemies), 4);
});

test('“Win now” credits enemies still waiting; the cap only takes the offered sizes', () => {
  const { CL, g } = battle({ cap: 20, soldiers: Array(12).fill('footman'), wave: { looter: 14 } });
  CL.debugTools.endBattleNow(true);
  assert.equal(g.kills, 14);
  assert.equal(CL.combat.setActiveCap(25), false);
  assert.equal(CL.combat.setActiveCap(30), true);
  assert.equal(CL.combat.BATTLE.activeCap, 30);
});

test('a stress battle is practice: it reports how the device ran and changes nothing in the campaign', () => {
  const { CL, storage } = loadGame();
  const c = CL.campaign;
  const before = JSON.stringify(c);
  const saved = storage.data[CL.save.KEY];
  CL.combat.setActiveCap(40);
  CL.debugTools.stressBattle(60);
  const g = CL.game;
  assert.equal(g.mode, 'battle');
  assert.ok(g.practice);
  assert.equal(g.hero.alive && 1 + live(g.allies) + live(g.enemies), 40, 'capped at the battle size');
  assert.ok(g.allyReserve.length + g.enemyReserve.length > 0, 'the rest wait');
  assert.ok(g.allies.every((a) => a.soldierId == null), 'no roster soldiers involved');
  CL.debugTools.endBattleNow(true);
  assert.equal(g.mode, 'result');
  assert.equal(g.result.practice.cap, 40);
  assert.match(g.result.html, /Nothing in your campaign changed/);
  assert.equal(JSON.stringify(c), before, 'campaign untouched');
  assert.equal(storage.data[CL.save.KEY], saved, 'nothing saved');
});
