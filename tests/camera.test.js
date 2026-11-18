// PROTO-A, the camera test run (docs/V2-PLAN.md; design §6.2, §28.1 Prototype A): a battle camera that
// follows the hero across a generated forest three screens across, measured from the Debug panel.
// Ordinary one-screen battles must not change at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** Play a battle with a simple hero driver (as in tests/battlemaps.test.js). */
function fight(CL, maxSeconds = 240) {
  const g = CL.game;
  let steps = 0;
  CL.combat.order('infantry', 'charge');
  CL.combat.order('archer', 'follow');
  CL.combat.order('cavalry', 'charge');
  while (g.mode === 'battle' && steps < maxSeconds * 50) {
    const h = g.hero;
    const e = g.enemies.filter((x) => x.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (e && h.alive) {
      const [dx, dy] = [e.x - h.x, e.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = L > 45 || !CL.units.inArc(h, e, CL.units.ARC.attack) ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.02);
    steps++;
  }
  return steps * 0.02;
}

test('an ordinary battle keeps the camera at 0,0 and its old bounds', () => {
  const { CL } = loadGame({ random: () => 0.5 });
  CL.combat.startBattle({ ...CL.content.encounter('captains_trial'), map: 'forest_clearing' });
  const g = CL.game;
  assert.equal(CL.camera.scrolls(g), false);
  for (let i = 0; i < 200; i++) {
    g.joystick = { x: 1, y: 1 };
    CL.combat.update(0.05);
    assert.deepEqual({ ...g.camera }, { x: 0, y: 0, zoom: 1 });
  }
  assert.ok(g.hero.x <= CL.units.BOUNDS.maxX && g.hero.y <= CL.units.BOUNDS.maxY, 'still stopped by the one-screen edge');
});

test('the forest arena: three screens each way, the same from the same seed, nothing spawns in a tree', () => {
  const { CL } = loadGame();
  const a = CL.arena.forest(3);
  assert.deepEqual([a.width, a.height], [CL.W * 3, CL.H * 3]);
  assert.equal(JSON.stringify(CL.arena.forest(3)), JSON.stringify(a), 'deterministic');
  assert.notEqual(JSON.stringify(CL.arena.forest(3, 8)), JSON.stringify(a));
  const trees = a.obstacles.filter((o) => o.blocksArrows);
  assert.ok(trees.length >= 60, `${trees.length} trees`);
  for (const o of a.obstacles) assert.ok(o.x > 0 && o.x < a.width && o.y > 0 && o.y < a.height);
  CL.combat.startBattle({ id: 't', name: 't', mapDef: a, waves: [{ reaver: 10 }], practice: Array(10).fill('footman'), reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  for (const u of [CL.game.hero, ...CL.game.allies, ...CL.game.enemies]) assert.equal(CL.units.blocked(u.x, u.y), false, `${u.troop} at ${u.x},${u.y}`);
  assert.ok(CL.game.enemies.every((e) => e.x > CL.W * 2), 'the enemy starts two screens away');
});

test('the camera follows the hero, eases in, and stops at the arena edges', () => {
  const { CL } = loadGame();
  const a = CL.arena.forest(3);
  CL.combat.startBattle({ id: 't', name: 't', mapDef: a, waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  const centred = () => [g.hero.x - g.camera.x, g.hero.y - g.camera.y];
  assert.ok(Math.abs(centred()[1] - CL.H / 2) < 1, 'starts with the hero in the middle');
  g.hero.x += 400; // the hero jumps; the camera eases after
  CL.camera.follow(g, 0.05);
  assert.ok(centred()[0] > CL.W / 2 + 200, 'not snapped at once');
  for (let i = 0; i < 100; i++) CL.camera.follow(g, 0.05);
  assert.ok(Math.abs(centred()[0] - CL.W / 2) < 2, 'caught up');
  Object.assign(g.hero, { x: 0, y: 0 });
  CL.camera.snap(g);
  assert.deepEqual({ ...g.camera }, { x: 0, y: 0, zoom: 1 });
  Object.assign(g.hero, { x: a.width, y: a.height });
  CL.camera.snap(g);
  assert.deepEqual({ ...g.camera }, { x: a.width - CL.W, y: a.height - CL.H, zoom: 1 });
  const p = CL.camera.toScreen(g, 1234, 987);
  assert.deepEqual({ ...CL.camera.toWorld(g, p.x, p.y) }, { x: 1234, y: 987 });
});

test('in the arena the hero walks past the one-screen edge, up to the arena bounds', () => {
  const { CL } = loadGame();
  const a = CL.arena.forest(3);
  CL.combat.startBattle({ id: 't', name: 't', mapDef: a, waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const h = CL.game.hero;
  Object.assign(h, { x: 1400, y: 800 });
  for (let i = 0; i < 2000; i++) CL.units.move(h, 1, 1, 0.05);
  assert.ok(h.x > CL.units.BOUNDS.maxX && h.x <= a.bounds.maxX);
  assert.ok(h.y > CL.units.BOUNDS.maxY && h.y <= a.bounds.maxY);
});

test('the Debug camera test: a whole battle in the arena, reported, and the campaign untouched', () => {
  const { CL } = loadGame({ random: () => 0.5 });
  const before = JSON.stringify(CL.campaign);
  CL.debugTools.cameraTest(30);
  const g = CL.game;
  assert.equal(g.mode, 'battle');
  assert.equal(CL.combat.BATTLE.activeCap, 30, 'everyone on the field at once');
  assert.ok(g.allies.some((u) => u.troop === 'rider') && g.enemies.some((u) => u.troop === 'horse_scout'), 'cavalry on both sides');
  assert.equal(g.allies.length + g.enemies.length + 1, 30);
  g.godMode = true; // the hero survives to see it out
  const seconds = fight(CL);
  assert.equal(g.mode, 'result', `ended after ${seconds} s`);
  const s = g.result.practice;
  assert.equal(s.arena, `${CL.W * 3}×${CL.H * 3}`);
  assert.ok(s.contactS > 3, `first contact after ${s.contactS} s: the armies have to march`);
  assert.ok(s.battleS >= s.contactS);
  assert.match(g.result.html, /Arena 2880×1620: first contact after/);
  assert.equal(JSON.stringify(CL.campaign), before, 'nothing in the campaign changed');
  CL.combat.setActiveCap(30);
});

test('the obstacle grid in big arenas answers exactly like checking every obstacle', () => {
  const { CL } = loadGame();
  const a = CL.arena.forest(3);
  CL.combat.startBattle({ id: 't', name: 't', mapDef: a, waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const U = CL.units;
  let rand = 7;
  const next = () => {
    rand = (rand * 1103515245 + 12345) % 2147483648;
    return rand / 2147483648;
  };
  let hits = 0;
  for (let i = 0; i < 20000; i++) {
    const [x, y] = [next() * a.width, next() * a.height];
    const full = a.obstacles.some((o) => U.inside(o, x, y, 12));
    assert.equal(U.blocked(x, y), full, `blocked at ${x},${y}`);
    assert.equal(U.arrowBlocked(x, y), a.obstacles.some((o) => o.blocksArrows !== false && U.inside(o, x, y)), `arrow at ${x},${y}`);
    if (full) hits++;
  }
  assert.ok(hits > 500, `the test points found obstacles (${hits})`);
});
