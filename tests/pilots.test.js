// P11-00: the hero's pilots (tests/helpers/pilots.js) and the measuring tools built on them: each pilot
// plays a short duel the same way from the same seed, drives the hero only through the player's inputs,
// and behaves as described.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { makePilot, KINDS } = require('./helpers/pilots');
const { duel, tourney } = require('../scripts/duel-lab');

test('each pilot plays a short duel the same way from the same seed', () => {
  for (const pilot of ['masher', 'timer', 'turtle']) {
    const a = duel({ seed: 101, pilot, opponent: 'looter' });
    const b = duel({ seed: 101, pilot, opponent: 'looter' });
    assert.deepEqual(a, b, pilot);
    assert.equal(a.ended, true, `${pilot}: the duel ends`);
    assert.equal(a.win, true, `${pilot} beats a looter`);
    assert.ok(a.given >= 1, `${pilot} lands blows`);
  }
});

test('the timer strikes into recovery and keeps out of reach: no worse off than the masher against a looter', () => {
  const m = duel({ seed: 7, pilot: 'masher', opponent: 'looter' });
  const t = duel({ seed: 7, pilot: 'timer', opponent: 'looter' });
  assert.ok(t.taken <= m.taken, `timer took ${t.taken}, masher ${m.taken}`);
  assert.ok(t.hpShare >= m.hpShare);
});

test('the turtle raises its shield against a swing, and without a shield it cannot', () => {
  const r = duel({ seed: 7, pilot: 'turtle', opponent: 'footman' });
  assert.ok(r.blocked > 0, 'blocks counted');
  // Without a shield the turtle never holds Block up (the hero can't block).
  const { CL } = loadGame({ seed: 7 });
  CL.campaign.equipment.offhand = null;
  CL.combat.startBattle({ id: 'p', name: 'p', map: 'tourney_lists', waves: [{ footman: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  const p = makePilot(CL, 'turtle');
  for (let i = 0; i < 1500 && g.mode === 'battle'; i++) {
    p.step();
    assert.equal(g.hero.guard, false);
    CL.combat.update(0.02);
  }
});

test('pilots drive the hero only through the inputs a player has', () => {
  for (const kind of KINDS) {
    const { CL } = loadGame({ seed: 3 });
    CL.combat.startBattle({ id: 'p', name: 'p', map: 'grass_field', waves: [{ looter: 2 }], practice: ['levy'], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
    const g = CL.game;
    const h = g.hero;
    const p = makePilot(CL, kind);
    const before = { ...h };
    p.step();
    // The hero is untouched until the battle steps; the inputs are set.
    for (const k of ['x', 'y', 'hp', 'face', 'swing', 'guard', 'attackCooldown']) assert.deepEqual(h[k], before[k], `${kind}: ${k}`);
    assert.equal(typeof g.attackHeld, 'boolean', kind);
    assert.equal(typeof g.blockHeld, 'boolean', kind);
    assert.ok(Number.isFinite(g.joystick.x) && Number.isFinite(g.joystick.y), kind);
  }
  assert.throws(() => makePilot(loadGame().CL, /** @type {any} */ ('cheat')), /Unknown pilot/);
});

test('duel-lab fights the real bracket of the lists, round by round', () => {
  const rounds = tourney({ seed: 5, pilot: 'masher', townWins: 0 });
  assert.ok(rounds.length >= 1 && rounds.length <= 3);
  // Every bout before the last was won; the bracket stops at a loss or after the final.
  for (const r of rounds.slice(0, -1)) assert.equal(r.win, true);
  if (rounds.length < 3) assert.equal(rounds.at(-1).win, false);
});
