// The experimental graphics demo (Debug → Graphics Demo; js/gfx/). The browser cases (tests/browser/
// gfx-demo.spec.js) play it; these check the parts that need no screen: the save guard, that normal
// play never loads it, its map routes, and that every soldier it fields has a look.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, memoryStorage } = require('./helpers/load');

const ROOT = path.join(__dirname, '..');
const GFX = ['gallery', 'map', 'city', 'battle']; // the art kit (js/art/) is loaded with the game

/** A game with the demo's drawing and scene files loaded into it (no DOM: nothing is drawn). */
function withGfx() {
  const loaded = loadGame();
  for (const f of GFX) {
    const file = path.join(ROOT, 'js', 'gfx', `${f}.js`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), loaded.sandbox, { filename: file });
  }
  return loaded;
}

test('while the demo is open the save is never written; otherwise it is', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  assert.equal(CL.save.write(), true);
  const before = JSON.stringify(storage.data);
  CL.gfxDemo = { active: true };
  CL.campaign.gold += 500; // what the demo's sandbox might do
  assert.equal(CL.save.write(), false);
  CL.campaign.day += 5;
  assert.equal(CL.save.autosave(), false);
  assert.equal(JSON.stringify(storage.data), before);
  CL.gfxDemo = { active: false };
  assert.equal(CL.save.write(), true);
});

test('normal play does not load the demo: index.html lists none of its files, the Debug panel loads them on demand', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /js\/gfx\//);
  assert.match(html, /data-cheat="gfxDemo"[^>]*>Graphics Demo — New Art Direction</);
  const debug = fs.readFileSync(path.join(ROOT, 'js', 'debug.js'), 'utf8');
  const files = debug.match(/GFX_FILES = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(files, [...GFX, 'demo']);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, 'js', 'gfx', `${f}.js`)), f);
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'gfx', 'demo.css')));
  // The main loop hands frames to the demo only while it is active.
  assert.match(fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8'), /if \(CL\.gfxDemo\?\.active\) \{\s+CL\.gfxDemo\.frame\(dt\);/);
});

test('the demo map: routes go round water and mountains, and cross the river only at the bridge or the ford', () => {
  const { CL } = withGfx();
  const M = CL.gfx.scenes.map;
  const S = { t: 0 };
  M.init(S);
  const P = M.PLACES;
  for (const [a, b] of [['brackenfield', 'stonebridge'], ['stonebridge', 'ulfstead'], ['highmere', 'saltwick'], ['greywall', 'oakford']]) {
    const path = M.route(S.mapLand.grid, { x: P[a].x, y: P[a].y + 20 }, { x: P[b].x, y: P[b].y + 20 });
    assert.ok(path?.length > 2, `${a} → ${b}`);
    for (const [x, y] of path) {
      const c = Math.floor(x / 20);
      const r = Math.floor(y / 20);
      assert.ok(Number.isFinite(S.mapLand.grid.cost[r * S.mapLand.grid.cols + c]), `${a} → ${b} passes ${x},${y}`);
    }
  }
  // Stonebridge to Ulfstead is across the river: the route goes by a crossing.
  const across = M.route(S.mapLand.grid, { x: P.stonebridge.x, y: P.stonebridge.y + 20 }, { x: P.ulfstead.x, y: P.ulfstead.y + 20 });
  assert.ok(across.some(([x, y]) => Math.hypot(x - P.ford.x, y - P.ford.y) < 60 || Math.hypot(x - 1043, y - 540) < 60));
  // The same land every time (a fixed seed).
  const S2 = { t: 0 };
  M.init(S2);
  assert.equal(S2.mapLand.trees.length, S.mapLand.trees.length);
  assert.deepEqual(S2.mapLand.trees[10], S.mapLand.trees[10]);
});

test('every soldier the demo battle fields is a real troop with its own look, and looks are stable', () => {
  const { CL } = withGfx();
  const B = CL.gfx.scenes.battle;
  const F = CL.gfx.fig;
  const troops = new Set([...B.ARMY, ...Object.values(B.FOES).flatMap((f) => Object.keys(f.wave))]);
  for (const id of troops) {
    assert.ok(CL.content.troop(id), id);
    assert.ok(CL.content.troop(id).look, `${id} has a look`);
  }
  assert.ok(B.ARMY.length + 1 + Object.values(B.FOES.hrothmark.wave).reduce((a, b) => a + b, 0) <= 40, 'the whole battle fits on the field at once');
  // Roles show: spears for reach-70 infantry, bows for archers, a horse for cavalry.
  for (const id of troops) {
    const t = CL.content.troop(id);
    const L = t.look;
    if (t.role === 'archer') assert.equal(L.weapon, 'bow', id);
    if (t.role === 'cavalry') assert.ok(L.mount, id);
    if (t.role === 'infantry' && t.reach >= 70) assert.equal(L.weapon, 'spear', id);
  }
  assert.deepEqual(F.troopLook('footman', 'valedorn', 7), F.troopLook('footman', 'valedorn', 7));
  assert.notDeepEqual(F.troopLook('footman', 'valedorn', 7), F.troopLook('footman', 'valedorn', 8));
});

test('the demo battle field and city are in the game’s battle-map format', () => {
  const { CL } = withGfx();
  const field = CL.gfx.scenes.battle.field();
  const city = CL.gfx.scenes.city.cityMap();
  for (const m of [field, city]) {
    assert.ok(m.width > 960 && m.height > 540 && m.bounds && m.spawn.hero);
    for (const o of m.obstacles) {
      if (o.shape === 'circle') assert.ok(o.r > 0 && Number.isFinite(o.x) && Number.isFinite(o.y));
      else assert.ok(o.shape === 'rect' && o.w > 0 && o.h > 0);
    }
  }
  // The old renderer can draw the battle field too (the comparison): every obstacle has its look.
  for (const o of field.obstacles) assert.ok(o.look && o.demo, JSON.stringify(o));
  assert.ok(field.slow.length === 1 && field.ground.waters.length === 1); // the stream is the game's ford rule
});
