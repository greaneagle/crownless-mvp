// Battle maps (GDD §8; Gate D 4.3): three scenes, obstacles, steering, cover, and no trapped units.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { mulberry } = require('../scripts/simulate-campaign');

const MAPS = ['grass_field', 'forest_clearing', 'greywall_courtyard', 'tourney_lists'];

function onMap(mapId, opts) {
  const env = loadGame(opts);
  env.CL.game.battleMap = env.CL.content.get('battle_maps', mapId);
  return env;
}

const overlaps = (CL, u) => CL.game.battleMap.obstacles.some((o) => CL.units.inside(o, u.x, u.y, CL.units.UNIT_RADIUS - 0.5));

test('the map follows where you fight: forest, near a fort, or open ground', () => {
  const { CL } = loadGame();
  assert.equal(CL.world.battleMapAt(70, 80), 'forest_wilds', 'forests are large from 1.8.0 (V2-05)');
  assert.equal(CL.world.battleMapAt(93, 82), 'greywall_courtyard', 'Greywall approach');
  assert.equal(CL.world.battleMapAt(120, 116), 'greywall_courtyard', 'Ashgate approach');
  assert.equal(CL.world.battleMapAt(125, 70), 'open_country');
  assert.equal(CL.content.encounter('captains_trial').map, 'forest_wilds', 'the Reaver Hideout among the trees');
  const t = CL.content.get('party_templates', 'bandits');
  assert.equal(CL.parties.battleDef(t, { looter: 2 }, 'forest_clearing').map, 'forest_clearing');
});

test('collision pushes units out of circles and rectangles, including from the middle', () => {
  const { CL } = onMap('greywall_courtyard');
  const U = CL.units;
  const tree = { shape: 'circle', x: 400, y: 300, r: 20 };
  CL.game.battleMap = { obstacles: [tree] };
  const u = { x: 410, y: 300 };
  U.resolveObstacles(u);
  assert.ok(Math.abs(Math.hypot(u.x - 400, u.y - 300) - (20 + U.UNIT_RADIUS)) < 1e-9);

  const wall = { shape: 'rect', x: 560, y: 90, w: 350, h: 22 };
  CL.game.battleMap = { obstacles: [wall] };
  const v = { x: 700, y: 100 }; // centre inside the wall
  U.resolveObstacles(v);
  assert.ok(v.y <= 90 - U.UNIT_RADIUS + 1e-9 || v.y >= 112 + U.UNIT_RADIUS - 1e-9, `left the wall: y=${v.y}`);
  const w = { x: 700, y: 120 }; // touching the bottom face
  U.resolveObstacles(w);
  assert.ok(w.y >= 112 + U.UNIT_RADIUS - 1e-9);
});

test('the hero slides along a tree instead of passing through it', () => {
  const { CL } = onMap('forest_clearing');
  const hero = CL.units.makeUnit(400, 330, 'ally', 'hero'); // tree at (470, 330)
  for (let i = 0; i < 60; i++) CL.units.move(hero, 1, 0.05, 0.02);
  assert.equal(overlaps(CL, hero), false);
  assert.ok(hero.x > 470, 'got past it by sliding');
});

test('AI soldiers steer around obstacles to reach a target behind them', () => {
  const { CL } = onMap('forest_clearing');
  const s = CL.units.makeUnit(380, 330, 'ally', 'levy'); // tree at (470, 330) in the way
  const goal = { x: 560, y: 330 };
  let t = 0;
  for (; t < 10 && Math.hypot(goal.x - s.x, goal.y - s.y) > 10; t += 0.02) CL.units.move(s, goal.x - s.x, goal.y - s.y, 0.02);
  assert.ok(t < 10, 'reached the goal');
  assert.equal(overlaps(CL, s), false);
});

test('trees, walls and crates stop arrows; rocks, bushes and fences do not', () => {
  const { CL } = onMap('forest_clearing');
  assert.equal(CL.units.arrowBlocked(470, 330), true, 'tree');
  assert.equal(CL.units.arrowBlocked(380, 250), false, 'bush');
  CL.game.battleMap = CL.content.get('battle_maps', 'greywall_courtyard');
  assert.equal(CL.units.arrowBlocked(700, 100), true, 'wall');
  assert.equal(CL.units.arrowBlocked(710, 205), true, 'crate');
  assert.equal(CL.units.arrowBlocked(380, 170), false, 'rock');
});

test('a flying arrow is stopped by a tree in its path', () => {
  const { CL } = onMap('forest_clearing');
  CL.combat.startBattle({ id: 't', name: 't', map: 'forest_clearing', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const target = CL.game.enemies[0];
  Object.assign(target, { x: 560, y: 346 });
  CL.game.arrows = [{ x: 380, y: 330, dx: 1, dy: 0, speed: 240, team: 'ally', life: 2, source: CL.game.hero, damage: 50 }];
  for (let i = 0; i < 60; i++) CL.combat.update(0.02);
  assert.equal(target.hp, target.maxhp, 'the tree took the arrow');
});

for (const mapId of MAPS) {
  test(`${mapId}: nobody spawns inside an obstacle`, () => {
    for (let k = 0; k < 10; k++) {
      const { CL } = loadGame({ random: mulberry(k + 1) });
      for (let i = 0; i < 6; i++) CL.save.addSoldier(CL.campaign, 'levy');
      CL.combat.startBattle({ id: 't', name: 't', map: mapId, waves: [{ looter: 8 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
      for (const u of [CL.game.hero, ...CL.game.allies, ...CL.game.enemies]) assert.equal(overlaps(CL, u), false, `${u.troop} at ${u.x},${u.y}`);
    }
  });
}

/** Play a battle with a simple hero driver; returns { seconds, ended, trapped }. */
function fight(CL) {
  const g = CL.game;
  let steps = 0;
  let trapped = 0;
  CL.combat.order('infantry', 'charge');
  CL.combat.order('archer', 'follow');
  while (g.mode === 'battle' && steps < 9000) {
    const h = g.hero;
    const e = g.enemies.filter((x) => x.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (e && h.alive) {
      const dx = e.x - h.x;
      const dy = e.y - h.y;
      const L = Math.hypot(dx, dy) || 1;
      const inArc = CL.units.inArc(h, e, CL.units.ARC.attack);
      g.joystick = L > 45 || !inArc ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.02);
    steps++;
    if (steps % 25 === 0) for (const u of [h, ...g.allies, ...g.enemies]) if (u.alive && overlaps(CL, u)) trapped++;
  }
  return { seconds: steps * 0.02, ended: g.mode !== 'battle', trapped };
}

test('no trapped units: full battles on every map end, and no one is ever inside an obstacle', () => {
  for (const mapId of MAPS) {
    let ended = 0;
    let slowest = 0;
    for (let k = 0; k < 6; k++) {
      const { CL } = loadGame({ random: mulberry(100 + k) });
      for (let i = 0; i < 4; i++) CL.save.addSoldier(CL.campaign, 'footman');
      CL.combat.startBattle({ id: 't', name: 't', map: mapId, waves: [{ looter: 5, reaver: 2 }, { looter: 4 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
      const r = fight(CL);
      assert.equal(r.trapped, 0, `${mapId} run ${k}: unit inside an obstacle`);
      if (r.ended) ended++;
      slowest = Math.max(slowest, r.seconds);
    }
    assert.equal(ended, 6, `${mapId}: every battle resolved (slowest ${slowest.toFixed(1)} s)`);
  }
});

test('forts show their garrison', () => {
  const { CL } = loadGame();
  const g = CL.content.get('settlements', 'greywall_fort').garrison;
  assert.equal(Object.values(g).reduce((a, b) => a + b, 0), 22);
  assert.ok(CL.content.get('settlements', 'ashgate_fort').garrison.spearman > 0);
});
