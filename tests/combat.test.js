// Combat tests: Gate A rules (GDD §6) and Gate B data-driven units, armor and archers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function setup() {
  const env = loadGame();
  const { CL } = env;
  CL.game.allies = [];
  CL.game.enemies = [];
  CL.game.effects = [];
  CL.game.arrows = [];
  CL.game.kills = 0;
  return env;
}

test('units are built from troop definitions', () => {
  const { CL } = setup();
  const levy = CL.units.makeUnit(0, 0, 'ally', 'levy', 3);
  assert.deepEqual(
    [levy.troop, levy.role, levy.hp, levy.maxhp, levy.damage, levy.armor, levy.reach, levy.soldierId],
    ['levy', 'infantry', 45, 45, 7, 1, 48, 3],
  );
  const hero = CL.units.makeUnit(0, 0, 'ally', 'hero');
  assert.deepEqual([hero.role, hero.hp, hero.damage, hero.reach], ['hero', 85, 18, 67]);
  const hunter = CL.units.makeUnit(0, 0, 'ally', 'hunter');
  assert.equal(hunter.role, 'archer');
  assert.deepEqual({ ...hunter.ranged }, { projectileSpeed: 240, range: 225, cooldown: 1.6, accuracy: 0.6 });
  assert.throws(() => CL.units.makeUnit(0, 0, 'enemy', 'dragon'), /Unknown troops id: dragon/);
});

test('armor mitigation follows GDD §6', () => {
  const { CL } = setup();
  const m = CL.combat.mitigate;
  assert.equal(m(18, 0), 18);
  assert.equal(m(18, 1), 17);
  assert.equal(m(18, 3), 16);
  assert.equal(m(14, 6), 11);
  assert.equal(m(1, 50), 1, 'never below 1');
});

test('attack arc is 90° and block arc is 120° (GDD §6)', () => {
  const { CL } = setup();
  const { inArc, ARC } = CL.units;
  const a = { x: 0, y: 0, face: 'right' };
  const deg = (d) => ({ x: Math.cos((d * Math.PI) / 180) * 10, y: Math.sin((d * Math.PI) / 180) * 10 });
  assert.equal(inArc(a, deg(0), ARC.attack), true);
  assert.equal(inArc(a, deg(44), ARC.attack), true);
  assert.equal(inArc(a, deg(46), ARC.attack), false);
  assert.equal(inArc(a, deg(59), ARC.block), true);
  assert.equal(inArc(a, deg(61), ARC.block), false);
  assert.equal(inArc(a, deg(180), ARC.block), false);
});

test('move clamps to arena bounds and faces the dominant axis', () => {
  const { CL } = setup();
  const u = CL.units.makeUnit(900, 480, 'ally', 'hero');
  CL.units.move(u, 1, 0.2, 1);
  assert.equal(u.x, 908);
  assert.equal(u.face, 'right');
  CL.units.move(u, 0, -1, 0.1);
  assert.equal(u.face, 'up');
  const before = { x: u.x, y: u.y };
  CL.units.move(u, 0.1, 0.1, 1); // below the 0.5 dead-zone
  assert.deepEqual({ x: u.x, y: u.y }, before);
});

test('a guarding unit absorbs frontal hits; flank and rear hits land', () => {
  const { CL } = setup();
  const defender = CL.units.makeUnit(100, 100, 'ally', 'hero');
  defender.face = 'right';
  defender.guard = true;
  const at = (x, y) => CL.units.makeUnit(x, y, 'enemy', 'reaver');
  assert.equal(CL.combat.hit(defender, 20, at(130, 115)), 'blocked', '~27° off-axis');
  assert.equal(defender.hp, 85);
  assert.equal(CL.combat.hit(defender, 20, at(110, 130)), 'hit', '~72° flank');
  assert.equal(CL.combat.hit(defender, 20, at(70, 100)), 'hit', 'behind');
  assert.equal(defender.hp, 45);
});

test('a lethal hit downs the unit, cancels its swing and counts one kill', () => {
  const { CL } = setup();
  const e = CL.units.makeUnit(0, 0, 'enemy', 'reaver');
  e.swing = { t: 0.05, hit: [] };
  CL.game.t = 3;
  assert.equal(CL.combat.hit(e, 999, null), 'down');
  assert.equal(e.alive, false);
  assert.equal(e.swing, null);
  assert.equal(e.downAt, 3);
  assert.equal(CL.combat.hit(e, 999, null), null, 'hitting a downed unit is a no-op');
  assert.equal(CL.game.kills, 1);
});

test('melee hits push the target back', () => {
  const { CL } = setup();
  const src = CL.units.makeUnit(100, 100, 'ally', 'hero');
  const v = CL.units.makeUnit(130, 100, 'enemy', 'looter');
  CL.combat.hit(v, 5, src);
  assert.equal(v.x, 136);
});

/** Hero facing right at (100,100) with enemies placed relative to it. */
function swingSetup(...offsets) {
  const env = setup();
  const { CL } = env;
  CL.combat.startBattle();
  const hero = CL.game.hero;
  Object.assign(hero, { x: 100, y: 100, face: 'right', attackCooldown: 0 });
  CL.game.allies = [];
  CL.game.enemies = offsets.map(([dx, dy]) => {
    const e = CL.units.makeUnit(100 + dx, 100 + dy, 'enemy', 'reaver');
    e.aiTimer = 99; // keep AI still
    e.attackCooldown = 99;
    return e;
  });
  return env;
}

const step = (CL, seconds, dt = 0.02) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) CL.combat.update(dt);
};

test('swing lifecycle: windup 0.16 → active 0.12 → recovery 0.24', () => {
  const { CL } = swingSetup([40, 0]);
  const hero = CL.game.hero;
  const e = CL.game.enemies[0];
  CL.combat.queueAttack();
  step(CL, 0.02);
  assert.equal(CL.units.swingPhase(hero), 'windup');
  step(CL, 0.12);
  assert.equal(e.hp, 60, 'no damage during windup');
  step(CL, 0.04);
  assert.equal(CL.units.swingPhase(hero), 'active');
  assert.equal(e.hp, 60 - 16, 'damage lands in the active window');
  step(CL, 0.14);
  assert.equal(CL.units.swingPhase(hero), 'recovery');
  assert.equal(e.hp, 60 - 16, 'one hit per target per swing');
  step(CL, 0.22);
  assert.equal(hero.swing, null, 'swing finished');
});

test('one swing hits every enemy in the 90° arc, each once; not those outside it', () => {
  const { CL } = swingSetup([40, 0], [35, 20], [10, 50], [-40, 0]);
  CL.combat.queueAttack();
  step(CL, 0.4);
  const hp = CL.game.enemies.map((e) => e.hp);
  assert.deepEqual(hp, [44, 44, 60, 60], 'reavers: 60 hp, armor 3 → 16 damage');
});

test('facing locks while the swing is committed', () => {
  const { CL } = swingSetup([40, 0]);
  const hero = CL.game.hero;
  CL.combat.queueAttack();
  step(CL, 0.02);
  CL.game.hold.KeyW = true;
  step(CL, 0.1);
  assert.equal(hero.face, 'right', 'moving up during windup keeps facing right');
  step(CL, 0.3);
  assert.equal(hero.face, 'up', 'facing follows movement after the commit window');
});

test('block cannot interrupt a committed swing but works in recovery', () => {
  const { CL } = swingSetup([200, 0]);
  const hero = CL.game.hero;
  CL.combat.queueAttack();
  step(CL, 0.02);
  CL.game.blockHeld = true;
  step(CL, 0.1);
  assert.equal(hero.guard, false, 'windup');
  step(CL, 0.1);
  assert.equal(CL.units.swingPhase(hero), 'active');
  assert.equal(hero.guard, false, 'active');
  step(CL, 0.1);
  assert.equal(CL.units.swingPhase(hero), 'recovery');
  assert.equal(hero.guard, true, 'recovery');
});

test('guarding prevents starting an attack', () => {
  const { CL } = swingSetup([40, 0]);
  CL.game.blockHeld = true;
  CL.game.attackHeld = true;
  step(CL, 0.4);
  assert.equal(CL.game.hero.swing, null);
  assert.equal(CL.game.enemies[0].hp, 60);
});

test('a tap within 100 ms of recovery ending is buffered; an earlier tap is dropped', () => {
  const { CL } = swingSetup([200, 0]);
  const hero = CL.game.hero;
  CL.combat.queueAttack();
  step(CL, 0.46); // swing began on the first frame (t=0.02): 0.08 s left
  CL.combat.queueAttack();
  step(CL, 0.1);
  assert.ok(hero.swing && hero.swing.t < 0.1, 'buffered press started a new swing');

  step(CL, 0.6); // let it finish
  CL.combat.queueAttack();
  step(CL, 0.02);
  const second = hero.swing;
  assert.ok(second);
  step(CL, 0.1);
  CL.combat.queueAttack(); // ~0.4 s before recovery ends → too early
  step(CL, 0.6);
  assert.equal(hero.swing, null, 'early press was dropped');
});

test('AI swings turn toward their target at windup', () => {
  const { CL } = setup();
  const u = CL.units.makeUnit(100, 100, 'enemy', 'reaver');
  u.face = 'down';
  u.attackCooldown = 0;
  u.target = CL.units.makeUnit(60, 100, 'ally', 'levy');
  CL.game.hero = u.target;
  assert.equal(CL.combat.startAttack(u), true);
  assert.equal(u.face, 'left');
  assert.equal(CL.combat.startAttack(u), false, 'cannot start while swinging');
});

test('archers fire within troop range (+20 px slack) on their troop cooldown', () => {
  const { CL } = setup();
  const archer = CL.units.makeUnit(100, 100, 'ally', 'hunter');
  archer.attackCooldown = 0;
  CL.game.enemies = [CL.units.makeUnit(400, 100, 'enemy', 'looter')];
  CL.combat.startAttack(archer);
  assert.equal(CL.game.arrows.length, 0, '300 px is out of range');
  archer.attackCooldown = 0;
  CL.game.enemies[0].x = 340;
  CL.combat.startAttack(archer);
  assert.equal(CL.game.arrows.length, 1, '240 px is in range');
  const a = CL.game.arrows[0];
  assert.equal(a.damage, 10);
  assert.equal(a.speed, 240);
  assert.equal(archer.attackCooldown, 1.6);
});

test('archer accuracy: a hit roll aims true, a miss roll throws the shot off line', () => {
  const rolls = [0.5, 0.7, 0, 0.1];
  const { CL } = loadGame({ random: () => (rolls.length ? rolls.shift() : 0.5) });
  CL.game.allies = [];
  CL.game.arrows = [];
  const archer = CL.units.makeUnit(100, 100, 'ally', 'hunter');
  CL.game.enemies = [CL.units.makeUnit(300, 100, 'enemy', 'looter')];
  rolls.splice(0, rolls.length, 0.5); // 0.5 ≤ 0.6 accuracy → on target
  archer.attackCooldown = 0;
  CL.combat.startAttack(archer);
  assert.equal(CL.game.arrows[0].dy, 0);
  rolls.splice(0, rolls.length, 0.7, 0, 0.1); // miss; smallest offset; rotate negative
  archer.attackCooldown = 0;
  CL.combat.startAttack(archer);
  const miss = CL.game.arrows[1];
  assert.ok(Math.abs(Math.atan2(miss.dy, miss.dx)) >= 0.12 - 1e-9, 'deflected at least 0.12 rad');
});

test('startBattle deploys only healthy soldiers, capped at 12 infantry and 8 archers', () => {
  const { CL, uiCalls } = setup();
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < 14; i++) CL.save.addSoldier(c, 'levy');
  for (let i = 0; i < 10; i++) CL.save.addSoldier(c, 'hunter');
  c.roster[0].woundedUntil = 5;
  CL.combat.startBattle();
  const roles = CL.game.allies.map((a) => a.role);
  assert.equal(roles.filter((r) => r === 'infantry').length, 12);
  assert.equal(roles.filter((r) => r === 'archer').length, 8);
  assert.ok(!CL.game.allies.some((a) => a.soldierId === c.roster[0].id), 'wounded soldier stays in camp');
  assert.ok(CL.game.allies.every((a) => c.roster.some((s) => s.id === a.soldierId)));
  assert.equal(CL.game.mode, 'battle');
  assert.equal(CL.game.battleId, 1);
  assert.equal(CL.game.hero.face, 'right');
  assert.ok(uiCalls.some((x) => x[0] === 'hideBattleOverlays'));
});

test('waves come from the encounter: 4 looters + 2 reavers, then 6 + 2, then victory', () => {
  const { CL, uiCalls } = setup();
  CL.combat.startBattle();
  const count = (id) => CL.game.enemies.filter((e) => e.troop === id).length;
  assert.equal(CL.game.totalWaves, 2);
  assert.deepEqual([count('looter'), count('reaver')], [4, 2]);
  for (const e of CL.game.enemies) e.alive = false;
  CL.combat.update(0.01);
  assert.equal(CL.game.wave, 2);
  assert.deepEqual([count('looter'), count('reaver')], [6, 2]);
  for (const e of CL.game.enemies) e.alive = false;
  CL.combat.update(0.01);
  assert.equal(CL.game.mode, 'result');
  assert.equal(CL.game.result.win, true);
  assert.ok(uiCalls.some((x) => x[0] === 'changeMode' && x[1] === 'result'));
});

test('defeat when the hero and every ally are down', () => {
  const { CL } = setup();
  CL.combat.startBattle();
  CL.game.hero.alive = false;
  for (const a of CL.game.allies) a.alive = false;
  CL.combat.update(0.01);
  assert.equal(CL.game.mode, 'result');
  assert.equal(CL.game.result.win, false);
});

test('update does nothing while paused or outside battle', () => {
  const { CL } = setup();
  CL.combat.startBattle();
  CL.game.paused = true;
  const t = CL.game.t;
  CL.combat.update(0.05);
  assert.equal(CL.game.t, t);
});

test('hold order snapshots current positions of the selected group', () => {
  const { CL } = setup();
  CL.combat.startBattle();
  const inf = CL.game.allies.find((a) => a.role === 'infantry');
  inf.x += 50;
  CL.combat.order('infantry', 'hold');
  assert.equal(inf.holdX, inf.x);
  assert.equal(CL.game.orders.infantry, 'hold');
});
