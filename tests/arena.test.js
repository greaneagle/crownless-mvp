// World-space battles on large arenas (V2-05; design §6.1–6.2, §6.7, §24.6, SC-04; finding F-2).
// Ordinary battles in forests and in the open are fought on generated fields three screens across,
// with the camera following the hero (PROTO-A passed at 60 fps on the owner's phone). The Greywall
// courtyard stays one screen, and the device setting "Battlefield: Small" brings back the classic maps.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const LARGE = ['forest_wilds', 'open_country'];
const ASSETS = path.join(__dirname, '..', 'assets');

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play a battle with a simple hero driver; returns seconds and how often anyone was inside an obstacle. */
function fight(CL, maxSeconds = 240) {
  const g = CL.game;
  const overlaps = (u) => g.battleMap.obstacles.some((o) => CL.units.inside(o, u.x, u.y, CL.units.UNIT_RADIUS - 0.5));
  let steps = 0;
  let trapped = 0;
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
    if (steps % 25 === 0) for (const u of [h, ...g.allies, ...g.enemies]) if (u.alive && overlaps(u)) trapped++;
  }
  return { seconds: steps * 0.02, ended: g.mode !== 'battle', trapped };
}

test('ordinary battles: forests and open ground are large; the Greywall courtyard stays one screen', () => {
  const { CL } = loadGame();
  for (const id of LARGE) {
    const m = CL.arena.mapFor(id);
    assert.deepEqual([m.width, m.height], [CL.W * 3, CL.H * 3], id);
    assert.equal(m.id, id);
    assert.equal(CL.arena.mapFor(id), m, 'built once, then the same map');
  }
  const yard = CL.arena.mapFor('greywall_courtyard');
  assert.equal(yard.width, undefined);
  assert.equal(CL.content.encounter('looter_band').map, 'open_country');
  assert.equal(CL.content.encounter('captains_trial').map, 'forest_wilds');
});

test('Battlefield: Small brings back the one-screen maps, and only for the large ones', () => {
  const { CL } = loadGame();
  CL.settings.set('battlefield', 'small');
  assert.equal(CL.arena.mapFor('forest_wilds').id, 'forest_clearing');
  assert.equal(CL.arena.mapFor('open_country').id, 'grass_field');
  assert.equal(CL.arena.mapFor('greywall_courtyard').id, 'greywall_courtyard');
  CL.combat.startBattle('captains_trial');
  assert.equal(CL.camera.scrolls(CL.game), false);
  CL.settings.set('battlefield', 'large');
  assert.equal(CL.settings.set('battlefield', 'huge'), false);
});

test('the large maps are the same every time and use only sprites that exist', () => {
  const { CL } = loadGame();
  const other = loadGame().CL;
  for (const id of LARGE) {
    const m = CL.arena.mapFor(id);
    assert.equal(JSON.stringify(other.arena.mapFor(id)), JSON.stringify(m), `${id} is deterministic`);
    const tiles = [...m.ground.tiles, ...m.decor.map((d) => d[0]), ...m.obstacles.map((o) => o.look?.tile).filter(Boolean)];
    for (const t of new Set(tiles)) assert.ok(fs.existsSync(path.join(ASSETS, `${t}.png`)), `${id}: missing assets/${t}.png`);
    for (const o of m.obstacles) assert.ok(o.x > 40 && o.x < m.width - 40 && o.y > 60 && o.y < m.height - 40, `${id}: obstacle inside the arena`);
  }
  const forest = CL.arena.mapFor('forest_wilds').obstacles.filter((o) => o.blocksArrows).length;
  const field = CL.arena.mapFor('open_country').obstacles.filter((o) => o.blocksArrows).length;
  assert.ok(forest > field * 2, `the forest (${forest} trees) is thicker than the field (${field})`);
});

for (const id of LARGE) {
  test(`${id}: nobody spawns in an obstacle, full battles end, nobody is ever trapped`, () => {
    let ended = 0;
    for (let k = 0; k < 4; k++) {
      const { CL } = loadGame({ random: mulberry(k + 1) });
      for (let i = 0; i < 10; i++) CL.save.addSoldier(CL.campaign, ['footman', 'hunter', 'rider', 'levy'][i % 4]);
      CL.combat.startBattle({ id: 't', name: 't', map: id, waves: [{ reaver: 6, looter: 4, horse_scout: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
      assert.ok(CL.camera.scrolls(CL.game));
      for (const u of [CL.game.hero, ...CL.game.allies, ...CL.game.enemies]) assert.equal(CL.units.blocked(u.x, u.y), false, `${u.troop} at ${u.x},${u.y}`);
      CL.game.godMode = true;
      const r = fight(CL);
      assert.equal(r.trapped, 0, `seed ${k}: trapped ${r.trapped}`);
      if (r.ended) ended++;
    }
    assert.equal(ended, 4);
  });
}

test('F-2 in world space: bodies keep their spacing on a large map, far from the old screen', () => {
  const { CL } = loadGame({ random: mulberry(5) });
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < 16; i++) CL.save.addSoldier(c, 'footman');
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  const team = [g.hero, ...g.allies];
  // Pile everyone onto one spot two screens from the origin, then let the bodies push apart.
  for (const u of team) Object.assign(u, { x: 2000, y: 1100 });
  for (let i = 0; i < 120; i++) CL.units.separate(team);
  let closest = Infinity;
  for (let a = 0; a < team.length; a++) for (let b = a + 1; b < team.length; b++) closest = Math.min(closest, Math.hypot(team[a].x - team[b].x, team[a].y - team[b].y));
  assert.ok(closest >= CL.units.SPACING * 0.9, `closest pair ${closest.toFixed(1)} px`);
  assert.ok(team.every((u) => u.x > CL.W), 'they stay where they were, out past the old screen edge');
});

test('reserves step in on a large map: inside the arena and clear of obstacles', () => {
  const { CL } = loadGame({ random: mulberry(9) });
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < 30; i++) CL.save.addSoldier(c, 'footman');
  CL.combat.setActiveCap(20);
  CL.combat.startBattle({ id: 't', name: 't', map: 'forest_wilds', waves: [{ looter: 20 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  assert.ok(g.allyReserve.length > 0 && g.enemyReserve.length > 0);
  for (const u of g.allies.slice(0, 4)) u.alive = false;
  for (const u of g.enemies.slice(0, 4)) u.alive = false;
  CL.combat.reinforce(g);
  const m = g.battleMap;
  for (const u of [...g.allies, ...g.enemies].filter((x) => x.alive)) {
    assert.equal(CL.units.blocked(u.x, u.y), false, `${u.troop} at ${u.x},${u.y}`);
    assert.ok(u.x >= m.bounds.minX && u.x <= m.bounds.maxX && u.y >= m.bounds.minY && u.y <= m.bounds.maxY);
  }
  CL.combat.setActiveCap(40);
});

test('content checks: a generated map needs a known kind, a sensible size, a seed and a one-screen fallback', () => {
  const { CL, sandbox } = loadGame();
  const M = sandbox.CROWNLESS_CONTENT.battle_maps;
  M.forest_wilds.generate = { kind: 'volcano', scale: 9, seed: 1.5 };
  M.open_country.small = 'forest_wilds';
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /forest_wilds: unknown generator volcano/);
  assert.match(errors, /forest_wilds: scale must be 1–4 screens/);
  assert.match(errors, /forest_wilds: needs a whole-number seed/);
  assert.match(errors, /open_country: small must be a one-screen map/);
});
