// Minimap and tactical overview (V2-06; design §6.3, §6.7, SC-05): only detected enemies are shown;
// tapping the minimap looks there for a moment; the overview holds the battle still and sends the
// selected group to a tapped spot. None of it is needed to win a battle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (x) => JSON.parse(JSON.stringify(x));

/** A battle on Open Country with a mixed company, the enemy two screens away. */
function bigBattle(opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'hunter', 'hunter', 'hunter', 'rider']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [{ looter: 4, reaver: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  return { ...env, g: CL.game };
}

test('a one-screen battle has no minimap or overview, and taps stay sword swings', () => {
  const { CL } = loadGame();
  CL.combat.startBattle({ ...CL.content.encounter('captains_trial'), map: 'forest_clearing' });
  const g = CL.game;
  assert.equal(CL.tactics.active(g), false);
  assert.equal(CL.tactics.tap(g, 480, 30), false);
  assert.equal(CL.tactics.overview(g, true), false);
  assert.equal(g.overview, false);
});

test('only detected enemies are shown: unseen at the start, seen when the company comes near, then last seen', () => {
  const { CL, g } = bigBattle();
  assert.ok(g.enemies.every((e) => !e.detected), 'two screens away, nobody has seen them');
  assert.deepEqual(plain(CL.tactics.knownEnemies(g)), []);
  // A rider scouts ahead to within sight of the first enemy.
  const scout = g.allies.find((a) => a.role === 'cavalry');
  const e = g.enemies[0];
  Object.assign(scout, { x: e.x - CL.tactics.SIGHT + 20, y: e.y });
  CL.tactics.scan(g, 1);
  assert.equal(e.seen, true);
  const known = CL.tactics.knownEnemies(g);
  assert.ok(known.some((k) => k.unit === e && k.live));
  // The rider rides back out of sight: the enemy is remembered where it was last seen.
  const where = { x: e.x, y: e.y };
  Object.assign(scout, { x: g.hero.x, y: g.hero.y });
  e.x += 300;
  CL.tactics.scan(g, 1);
  const k = CL.tactics.knownEnemies(g).find((x) => x.unit === e);
  assert.deepEqual([k.live, Math.round(k.x), Math.round(k.y)], [false, Math.round(where.x), Math.round(where.y)]);
});

test('the overview holds the battle still while it is open', () => {
  const { CL, g } = bigBattle();
  assert.equal(CL.tactics.overview(g, true), true);
  const before = JSON.stringify([g.t, g.allies.map((a) => [a.x, a.y]), g.enemies.map((e) => [e.x, e.y])]);
  for (let i = 0; i < 200; i++) CL.combat.update(0.05);
  assert.equal(JSON.stringify([g.t, g.allies.map((a) => [a.x, a.y]), g.enemies.map((e) => [e.x, e.y])]), before);
  CL.tactics.overview(g, false);
  CL.combat.update(0.05);
  assert.ok(g.t > 0, 'and runs again when it closes');
});

test('SC-05: choose the archers in the overview and tap the field: they go to that very spot and hold', () => {
  const { CL, g } = bigBattle();
  CL.tactics.overview(g, true);
  CL.combat.order('archer', null); // Orders: 2 Archers
  const r = CL.tactics.overviewRect(g);
  const spot = { x: 1500, y: 600 };
  const s = CL.tactics.toScreen(r, spot.x, spot.y);
  assert.equal(CL.tactics.tap(g, s.x, s.y), true);
  assert.equal(g.orders.archer, 'hold');
  const archers = g.allies.filter((a) => a.role === 'archer');
  const cx = archers.reduce((n, a) => n + a.holdX, 0) / archers.length;
  const cy = archers.reduce((n, a) => n + a.holdY, 0) / archers.length;
  assert.ok(Math.hypot(cx - spot.x, cy - spot.y) < 30, `block centred on the spot (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
  for (const a of archers) assert.equal(CL.units.blocked(a.holdX, a.holdY), false, 'nobody is sent into a tree');
  assert.notEqual(g.orders.infantry, 'hold', 'only the chosen group');
  // Close the overview: they march there.
  CL.tactics.overview(g, false);
  const start = Math.hypot(archers[0].x - archers[0].holdX, archers[0].y - archers[0].holdY);
  for (let i = 0; i < 100; i++) CL.combat.update(0.05);
  assert.ok(Math.hypot(archers[0].x - archers[0].holdX, archers[0].y - archers[0].holdY) < start - 200);
});

test('a tap outside the field in the overview does nothing, and a group that is not there says so', () => {
  const { CL, g, uiCalls } = bigBattle();
  CL.tactics.overview(g, true);
  const orders = { ...g.orders };
  assert.equal(CL.tactics.tap(g, 2, 2), true, 'the tap belongs to the overview');
  assert.deepEqual({ ...g.orders }, orders);
  g.allies = g.allies.filter((a) => a.role !== 'cavalry');
  assert.equal(CL.tactics.sendGroup(g, 'cavalry', 1000, 800), 0);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /No cavalry/.test(x[1])));
});

test('tap the minimap: the camera looks there for a moment, then comes back to the hero', () => {
  const { CL, g } = bigBattle();
  const r = CL.tactics.minimapRect(g);
  assert.ok(r.y + r.h < 120 && Math.abs(r.x + r.w / 2 - CL.W / 2) < 2, 'top centre, clear of the battle');
  const spot = { x: 2400, y: 900 };
  const s = CL.tactics.toScreen(r, spot.x, spot.y);
  assert.equal(CL.tactics.tap(g, s.x, s.y), true);
  for (let i = 0; i < 30; i++) CL.combat.update(0.05);
  const centre = () => ({ x: g.camera.x + CL.W / 2, y: g.camera.y + CL.H / 2 });
  assert.ok(Math.hypot(centre().x - spot.x, centre().y - spot.y) < 80, 'looking at the spot');
  for (let i = 0; i < 100; i++) CL.combat.update(0.05);
  assert.equal(g.cameraFocus, null);
  assert.ok(Math.abs(centre().x - g.hero.x) < 120, 'back with the hero');
  assert.equal(CL.tactics.tap(g, 5, CL.H - 5), false, 'a tap elsewhere is still a sword swing');
});

test('screen and field coordinates convert both ways, for the minimap and the overview', () => {
  const { CL, g } = bigBattle();
  for (const r of [CL.tactics.minimapRect(g), CL.tactics.overviewRect(g)]) {
    const p = CL.tactics.toScreen(r, 1234, 567);
    const w = CL.tactics.toWorld(r, p.x, p.y);
    assert.ok(Math.abs(w.x - 1234) < 1e-6 && Math.abs(w.y - 567) < 1e-6);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= CL.W && r.y + r.h <= CL.H);
  }
});
