// Group AI and counterplay (V2-08a; design §8.1, §8.2, §8.4, §8.5): soldiers raise shields, a raised
// shield covers the ally beside it (owner idea), braced spears stop a charge, archers need a clear
// shot, the company follows in loose ranks, and orders that can't be carried out say so.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A one-screen battle with a hand-placed scene: everyone else moved far away. */
function scene(map = 'grass_field') {
  const env = loadGame({ random: () => 0.5 });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'hunter', 'hunter', 'spearman']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map, waves: [{ looter: 2, horse_scout: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  for (const u of [g.hero, ...g.allies, ...g.enemies]) Object.assign(u, { x: 60 + u.id * 3, y: 470, guard: false, swing: null });
  return { ...env, g };
}
const one = (list, troop) => list.find((u) => u.troop === troop);

test('shield cover: a swing at the ally beside a raised shield is blocked from the front, lands from the side or on an uncovered ally', () => {
  const { CL, g } = scene();
  const blocker = one(g.allies, 'footman');
  const friend = g.allies.find((u) => u.troop === 'hunter');
  const enemy = g.enemies[0];
  Object.assign(blocker, { x: 400, y: 300, face: 'right', guard: true });
  // Facing right, the shield side is the blocker's left: up the screen.
  Object.assign(friend, { x: 400, y: 276, hp: friend.maxhp });
  Object.assign(enemy, { x: 440, y: 286 });
  assert.equal(CL.combat.hit(friend, 20, enemy), 'blocked', 'covered against a frontal blow');
  assert.equal(friend.hp, friend.maxhp);
  // The same swing from the side (above, outside the blocker's front arc): it lands.
  Object.assign(enemy, { x: 400, y: 236 });
  assert.equal(CL.combat.hit(friend, 20, enemy), 'hit');
  // An ally on the other side (the sword side) is not covered.
  const other = g.allies.filter((u) => u.troop === 'hunter')[1];
  Object.assign(other, { x: 400, y: 324, hp: other.maxhp });
  Object.assign(enemy, { x: 440, y: 314 });
  assert.equal(CL.combat.hit(other, 20, enemy), 'hit');
  // Too far from the blocker to be covered.
  Object.assign(friend, { x: 400, y: 250, hp: friend.maxhp });
  Object.assign(enemy, { x: 440, y: 260 });
  assert.equal(CL.combat.hit(friend, 20, enemy), 'hit');
  // No raised shield, no cover.
  blocker.guard = false;
  Object.assign(friend, { x: 400, y: 276 });
  Object.assign(enemy, { x: 440, y: 286 });
  assert.equal(CL.combat.hit(friend, 20, enemy), 'hit');
});

test('the hero can cover a companion or soldier too, and arrows are stopped the same way', () => {
  const { CL, g } = scene();
  const friend = one(g.allies, 'hunter');
  Object.assign(g.hero, { x: 500, y: 300, face: 'right' });
  g.blockHeld = true; // the player holds Block
  Object.assign(friend, { x: 500, y: 278, hp: friend.maxhp });
  const archer = Object.assign(g.enemies[0], { x: 700, y: 290 }); // an enemy shooting from in front
  g.arrows = [{ x: 520, y: friend.y - 16, dx: -1, dy: 0, speed: 300, team: 'enemy', life: 1, source: archer, damage: 30 }];
  CL.combat.update(0.05);
  assert.equal(friend.hp, friend.maxhp, 'the hero’s shield screened the archer beside them');
});

test('shield troops raise their shields at a swing coming at them from the front, not otherwise', () => {
  const { CL, g } = scene();
  const f = one(g.allies, 'footman');
  const e = g.enemies[0];
  Object.assign(f, { x: 300, y: 300, face: 'right' });
  Object.assign(e, { x: 340, y: 300, face: 'left', swing: { t: 0.05, hit: [] } }); // winding up
  // P11-05: honestly: not in the same frame, but a reaction later (P11-10: the footman's style's).
  CL.content.table('fighting_styles')[CL.styles.of(f).id].guardUse = 1; // test setup: it always guards
  const react = CL.styles.reaction(f);
  g.t = 10;
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false, 'not the instant it is seen');
  g.t = 10 + react - 0.01;
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false, 'still reacting');
  g.t = 10 + react;
  assert.equal(CL.groups.shouldGuard(f, g.enemies), true, 'up a reaction later');
  assert.equal(CL.groups.shouldGuard(one(g.allies, 'hunter'), g.enemies), false, 'no shield, no block');
  Object.assign(e, { x: 260, y: 300, face: 'right' }); // behind the footman
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false, 'a blow from behind is not seen coming');
  Object.assign(e, { x: 340, y: 300, face: 'left', swing: null });
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false, 'nobody swinging');
  Object.assign(e, { swing: { t: 0.05, hit: [] } });
  f.swing = { t: 0.2, hit: [] }; // mid-swing: committed
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false);
  f.swing = { t: 0.4, hit: [] }; // P11-05: and in its own recovery: the opening
  g.t = 20;
  CL.groups.shouldGuard(f, g.enemies);
  g.t = 21;
  assert.equal(CL.groups.shouldGuard(f, g.enemies), false, 'no shield in its own recovery');
});

test('braced spears stop a charging rider in front of them and hurt it; from behind the charge goes on', () => {
  const { CL, g } = scene();
  const spear = one(g.allies, 'spearman');
  const rider = one(g.enemies, 'horse_scout');
  Object.assign(spear, { x: 400, y: 300, face: 'right' });
  Object.assign(rider, { x: 450, y: 300, momentum: 1, overrun: 0, hp: rider.maxhp });
  assert.equal(CL.groups.braceAgainst(g, rider, [spear], 0.6), spear);
  assert.equal(rider.momentum, 0);
  assert.ok(rider.hp < rider.maxhp);
  assert.equal(CL.groups.braceAgainst(g, rider, [spear], 0.6), null, 'once per pass');
  g.t += 2;
  Object.assign(rider, { x: 350, y: 300, momentum: 1 }); // the spearman faces away
  assert.equal(CL.groups.braceAgainst(g, rider, [spear], 0.6), null);
  assert.equal(CL.groups.braces(one(g.allies, 'footman')), false, 'only spears brace');
});

test('archers need a clear shot: a tree in the way stops them loosing, and they step aside to find one', () => {
  const { CL, g } = scene('forest_clearing');
  const tree = g.battleMap.obstacles.find((o) => o.blocksArrows && o.x === 470 && o.y === 330);
  const archer = one(g.allies, 'hunter');
  const target = g.enemies[0];
  Object.assign(archer, { x: tree.x - 80, y: tree.y + 20, attackCooldown: 0 });
  Object.assign(target, { x: tree.x + 70, y: tree.y + 20 });
  assert.equal(CL.groups.clearShot(archer, target), false);
  Object.assign(target, { x: tree.x + 70, y: tree.y - 150 });
  assert.equal(CL.groups.clearShot(archer, target), true);
  // In the battle: blocked archers do not shoot but move.
  Object.assign(target, { x: tree.x + 70, y: tree.y + 20 });
  for (const u of g.enemies) if (u !== target) u.alive = false;
  g.orders.archer = 'hold';
  Object.assign(archer, { holdX: archer.x, holdY: archer.y, target, aiTimer: 9 });
  const start = { x: archer.x, y: archer.y };
  for (let i = 0; i < 10; i++) CL.combat.ai(archer, 0.05);
  assert.equal(g.arrows.length, 0, 'no arrow wasted on the tree');
  assert.ok(Math.hypot(archer.x - start.x, archer.y - start.y) > 10, 'stepped aside');
});

test('on Follow the company keeps loose ranks: infantry ahead of the hero, archers behind, spread across', () => {
  const env = loadGame({ random: () => 0.5 });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'footman', 'footman', 'footman', 'hunter', 'hunter', 'hunter']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  g.orders.infantry = 'follow';
  g.orders.archer = 'follow';
  for (let i = 0; i < 120; i++) CL.combat.update(0.05); // the enemy is two screens away
  const inf = g.allies.filter((u) => u.role === 'infantry');
  const arc = g.allies.filter((u) => u.role === 'archer');
  const avg = (l, k) => l.reduce((n, u) => n + u[k], 0) / l.length;
  assert.ok(avg(inf, 'x') > g.hero.x + 20, 'infantry ahead');
  assert.ok(avg(arc, 'x') < g.hero.x - 30, 'archers behind');
  const ys = inf.map((u) => u.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 60, 'spread across, not a clump');
  for (const u of inf) {
    const s = CL.groups.followSlot(g, u);
    assert.ok(Math.hypot(s.x - u.x, s.y - u.y) < 40, 'each near its place in the ranks');
  }
  assert.equal(g.groupState.infantry, 'formed');
  CL.combat.order('infantry', 'charge');
  for (let i = 0; i < 2; i++) CL.combat.update(0.2);
  assert.equal(g.groupState.infantry, 'advancing');
});

test('an order nobody can carry out says why', () => {
  const { CL, g, uiCalls } = scene();
  g.allies = g.allies.filter((u) => u.role !== 'archer');
  CL.combat.order('archer', 'charge');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === 'No archers in this battle'));
  assert.notEqual(g.orders.archer, 'charge');
});

test('content: shields and bracing are true or false, and archers carry no shield', () => {
  const { CL, sandbox } = loadGame();
  const T = sandbox.CROWNLESS_CONTENT.troops;
  T.hunter.shield = true;
  T.levy.brace = 'yes';
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /troop hunter: archers carry no shield/);
  assert.match(errors, /troop levy: brace must be true or false/);
});
