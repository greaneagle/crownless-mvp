// Battle tuning pass (V2-T2): a battle always ends. When the hero falls the company fights on; an
// enemy that falls back and is left alone gives up the field; and if nobody can close for long, the
// enemy slips away. Auto-resolve counts the company's soldiers for fighting in ranks (SC-37).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function battle({ company = ['footman', 'footman', 'hunter', 'hunter'], wave = { looter: 6 } } = {}) {
  const env = loadGame({ random: () => 0.5 });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of company) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [wave], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  return { ...env, c, g: CL.game };
}

test('when the hero falls, the sergeants take over: every group charges', () => {
  const { CL, g, uiCalls } = battle();
  g.orders = { infantry: 'follow', archer: 'hold', cavalry: 'hold' };
  g.hero.alive = false;
  CL.combat.update(0.05);
  assert.deepEqual({ ...g.orders }, { infantry: 'charge', archer: 'charge', cavalry: 'charge' });
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /sergeants take over/.test(x[1])));
  g.orders.archer = 'hold'; // the player may still order them
  CL.combat.update(0.05);
  assert.equal(g.orders.archer, 'hold', 'only once');
});

test('an enemy group falling back that nobody presses gives up the field', () => {
  const { CL, g } = battle();
  CL.morale.update(g, 0.25);
  for (const e of g.enemies.slice(0, 3)) e.alive = false; // half of them gone: they fall back
  g.morale['enemy:infantry'].cohesion = 25;
  const far = g.enemies.filter((e) => e.alive);
  for (const e of far) Object.assign(e, { x: g.battleMap.bounds.maxX - 60 });
  Object.assign(g.hero, { x: 200 });
  for (const a of g.allies) Object.assign(a, { x: 150 });
  for (let i = 0; i < 4 * 11; i++) CL.morale.update(g, 0.25);
  assert.equal(far.some((e) => e.routing), false, 'not before 12 s');
  for (let i = 0; i < 4 * 2; i++) CL.morale.update(g, 0.25);
  assert.ok(far.every((e) => e.routing || !e.alive), 'gone after 12 s left alone');
});

test('a battle where nobody can close ends: after 45 s without a blow the enemy slips away', () => {
  const { CL, g, uiCalls } = battle({ wave: { looter: 2 } });
  for (const e of g.enemies) Object.assign(e, { x: g.battleMap.bounds.maxX - 20, y: g.battleMap.bounds.minY + 20, speed: 0 });
  for (const a of g.allies) a.speed = 0;
  g.hero.speed = 0;
  for (let i = 0; i < 20 * 44 && g.mode === 'battle'; i++) CL.combat.update(0.05);
  assert.equal(g.mode, 'battle', 'still going at 44 s');
  for (let i = 0; i < 20 * 3 && g.mode === 'battle'; i++) CL.combat.update(0.05);
  assert.equal(g.mode, 'result');
  assert.equal(g.result.win, true);
  assert.equal(g.kills, 0, 'no kill credit');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Neither side will close/.test(x[1])));
});

test('SC-37: auto-resolve counts the company’s soldiers for fighting in ranks, and a won fight costs fewer', () => {
  const { CL } = loadGame();
  const A = CL.autoresolve;
  assert.equal(A.COMPANY_FACTOR, 1.5);
  assert.ok(A.lossChance(A.WINNER_LOSS, 10, 5) < 0.35 * 0.5, 'below the old 0.35 × odds');
  assert.equal(A.WINNER_LOSS.min, 0.05);
});
