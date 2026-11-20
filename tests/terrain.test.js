// W-05a: world geometry and terrain. New kinds of ground (hills, mountain with a pass, marsh, river,
// ford, bridge) as data with a speed and a battle map each, all of it passable (decision D-W4); the
// river ford battle map, whose shallows slow everyone; and the Border March exactly as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { testWorld } = require('./helpers/test-world');

// Points in the test world (tests/helpers/test-world.js) on each kind of ground.
const AT = {
  mountain: [108, 45],
  road: [105, 55.2], // the pass: the Eastwatch–Redfield road through the mountains
  marsh: [20, 100],
  hills: [138, 110],
  river: [120, 75.5],
  ford: [130, 75],
  bridge: [95, 77.5], // where the Stonebridge–Ashgate road crosses the river
  forest: [30, 30],
  grass: [140, 20],
};

// Travel times from Stonebridge in 2.5.0 (hours): the March's must not change.
const MARCH_HOURS = {
  eastwatch: 3.0581696910904275,
  greywall_fort: 3.3757311387082956,
  ashgate_fort: 4.523661456233795,
  oakford: 3.231293732042394,
  highmere: 4.298006885103932,
  brackenfield: 5.064891537962323,
  dunmarsh: 6.440404199271968,
  redfield: 6.720554528420918,
  saltmere: 7.6675546332698605,
  looter_camp: 2.6281308944557957,
  reaver_hideout: 2.774578017620652,
};

test('terrainAt: every kind of ground, a road through the mountains, a bridge over the river', () => {
  const { CL } = loadGame({ content: testWorld });
  for (const [kind, [x, y]] of Object.entries(AT)) assert.equal(CL.world.terrainAt(x, y), kind, `${kind} at ${x},${y}`);
});

test('each kind of ground has its speed; every point of the map is passable (D-W4)', () => {
  const { CL } = loadGame({ content: testWorld });
  const m = CL.world.map();
  const base = CL.world.speedAt(...AT.grass);
  const want = { road: 1.2, grass: 1, forest: 0.75, hills: 0.8, mountain: 0.4, marsh: 0.5, river: 0.3, ford: 0.8, bridge: 1 };
  for (const [kind, f] of Object.entries(want)) {
    assert.equal(m.terrain[kind], f);
    assert.ok(Math.abs(CL.world.speedAt(...AT[kind]) - base * f) < 1e-12, kind);
  }
  const b = CL.world.bounds();
  for (let x = 0; x <= b.w; x += 2.5) for (let y = 0; y <= b.h; y += 2.5) assert.ok(CL.world.speedAt(x, y) > 0, `stalls at ${x},${y}`);
});

test('crossing the river: much quicker at the ford than wading anywhere else', () => {
  const { CL } = loadGame({ content: testWorld });
  const w = CL.campaign.world;
  Object.assign(w, { x: 130, y: 69, location: null });
  const atFord = CL.world.estimateHours(130, 81, 400);
  Object.assign(w, { x: 140, y: 69 });
  const wading = CL.world.estimateHours(140, 81, 400);
  Object.assign(w, { x: 140, y: 14 });
  const dry = CL.world.estimateHours(140, 26, 400); // the same 12 units north–south, all grass
  assert.ok(atFord < wading, `ford ${atFord.toFixed(3)} h, wading ${wading.toFixed(3)} h`);
  assert.ok(wading > dry, 'a river is slower than grass');
  // And the journey really happens: travelling straight across arrives, more slowly through water.
  Object.assign(w, { x: 140, y: 69 });
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  CL.world.travelTo({ type: 'point', id: null, x: 140, y: 81 });
  let steps = 0;
  while (CL.game.travel && steps++ < 5000) CL.world.update(0.05);
  assert.deepEqual([w.x, w.y], [140, 81], 'arrives: no terrain stops a journey');
});

test('the battle map for each kind of ground: the ford map at a river or ford', () => {
  const { CL } = loadGame({ content: testWorld });
  const want = { mountain: 'hill_slopes', road: 'open_country', marsh: 'forest_wilds', hills: 'hill_slopes', river: 'river_ford', ford: 'river_ford', bridge: 'open_country', forest: 'forest_wilds', grass: 'open_country' };
  for (const [kind, map] of Object.entries(want)) assert.equal(CL.world.battleMapAt(...AT[kind]), map, kind);
  const fort = CL.realm.forts()[0];
  assert.equal(CL.world.battleMapAt(fort.mapX + 2, fort.mapY), 'greywall_courtyard', 'grass near a fort: the fort approach');
});

test('the Border March is unchanged inside the bigger world: only roads, forests and grass, the same travel times and battle maps', () => {
  const { CL } = loadGame();
  const kinds = new Set();
  // W-05b: the March sits at + 50, + 50; the Vess flows on south from its edge.
  for (let x = 50; x <= 150; x += 1) for (let y = 50; y < 150; y += 1) kinds.add(CL.world.terrainAt(x, y));
  assert.deepEqual([...kinds].sort(), ['forest', 'grass', 'road']);
  for (const [id, h] of Object.entries(MARCH_HOURS)) {
    const p = CL.content.table('settlements')[id] || CL.world.map().sites[id];
    assert.ok(Math.abs(CL.world.estimateHours(p.mapX, p.mapY) - h) < 1e-9, id);
  }
  assert.equal(CL.world.battleMapAt(70, 80), 'forest_wilds');
  assert.equal(CL.world.battleMapAt(92, 83), 'greywall_courtyard');
  assert.equal(CL.world.battleMapAt(125, 70), 'open_country');
});

test('the bigger world has every kind of ground: the Hrothmark range and its pass, hills, marsh, the Vess with a ford and a bridge, and the sea', () => {
  const { CL } = loadGame();
  const at = { mountain: [120, 42], road: [96, 43], hills: [190, 50], marsh: [20, 158], river: [104, 172], ford: [106, 164], bridge: [101.8, 181.9], forest: [64, 12] };
  for (const [kind, [x, y]] of Object.entries(at)) assert.equal(CL.world.terrainAt(x, y), kind, `${kind} at ${x},${y}`);
  assert.deepEqual(Array.from(CL.world.map().coast), ['south']);
});

test('the river ford battle map: the river between the armies, its shallows at half speed', () => {
  const { CL } = loadGame();
  const m = CL.arena.mapFor('river_ford');
  assert.equal(m, CL.arena.mapFor('river_ford'), 'built once');
  assert.deepEqual(JSON.stringify(CL.arena.ford(3, 13).obstacles), JSON.stringify(m.obstacles), 'the same every time');
  const [river] = m.slow;
  assert.equal(river.factor, CL.arena.FORD_SLOW);
  assert.ok(m.spawn.hero.x < river.x && m.spawn.enemies.x0 > river.x + river.w, 'the armies start on either bank');
  assert.ok(m.obstacles.every((o) => o.x + (o.r || 0) < river.x || o.x - (o.r || 0) > river.x + river.w), 'nothing stands in the water');
  CL.combat.startBattle({ id: 't', name: 't', map: 'river_ford', waves: [{ looter: 3 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  assert.equal(g.battleMap.id, 'river_ford');
  const U = CL.units;
  assert.equal(U.groundFactor(river.x + river.w / 2, 500), 0.5);
  assert.equal(U.groundFactor(river.x - 5, 500), 1);
  // The hero wades: half as far in the same time.
  const h = g.hero;
  Object.assign(h, { x: river.x - 300, y: 500 });
  U.move(h, 1, 0, 0.5);
  const dry = h.x - (river.x - 300);
  Object.assign(h, { x: river.x + 40, y: 500 });
  U.move(h, 1, 0, 0.5);
  const wet = h.x - (river.x + 40);
  assert.ok(Math.abs(wet - dry * 0.5) < 1e-9, `wading ${wet} vs ${dry}`);
  // Other maps have no slow ground.
  CL.combat.startBattle({ id: 't2', name: 't2', map: 'open_country', waves: [{ looter: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  assert.equal(U.groundFactor(1300, 800), 1);
});

test('validation: a speed for every kind, features inside the map, known battle maps', () => {
  const problems = (edit) => {
    const { CL, sandbox } = loadGame({ content: testWorld });
    edit(Object.values(sandbox.CROWNLESS_CONTENT.world_map)[0]);
    return Array.from(CL.content.validate()).join('\n');
  };
  assert.equal(problems(() => {}), '');
  assert.match(problems((m) => (m.terrain.marsh = 0)), /terrain marsh needs a speed above 0/);
  assert.match(problems((m) => m.areas.push({ kind: 'lava', poly: [[1, 1], [2, 1], [2, 2]] })), /unknown area kind lava/);
  assert.match(problems((m) => (m.areas[0].poly[0] = [200, 10])), /mountain area needs 3\+ points inside the map/);
  assert.match(problems((m) => (m.waters[0].crossings[0].kind = 'ferry')), /bad crossing/);
  assert.match(problems((m) => (m.battleMaps.ford = 'atlantis')), /battle map for ford is unknown/);
  assert.match(problems((m) => m.coast.push('up')), /unknown coast up/);
});
