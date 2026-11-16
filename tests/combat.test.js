// Combat regression tests pinned to the 0.3.0 behavior in docs/BASELINE.md.
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

test('unit stats match the 0.3.0 baseline', () => {
  const { CL } = setup();
  const expect = {
    hero: [85, 142, 18],
    infantry: [70, 94, 11],
    archer: [46, 84, 8],
    brute: [85, 77, 13],
    reaver: [52, 103, 11],
    unknown_role: [52, 103, 11],
  };
  for (const [role, [hp, speed, damage]] of Object.entries(expect)) {
    const u = CL.units.makeUnit(0, 0, 'enemy', role);
    assert.deepEqual([u.hp, u.maxhp, u.speed, u.damage], [hp, hp, speed, damage], role);
  }
});

test('facingToward uses a ~135° frontal arc', () => {
  const { CL } = setup();
  const a = { x: 0, y: 0, face: 'right' };
  const at = (x, y) => CL.units.facingToward(a, { x, y });
  assert.equal(at(10, 0), true, 'straight ahead');
  assert.equal(at(10, 20), true, '~63° off-axis');
  assert.equal(at(10, 30), false, '~72° off-axis');
  assert.equal(at(-10, 0), false, 'behind');
  assert.equal(at(0, 10), false, 'side');
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

test('a frontal block absorbs the hit; a hit from behind lands', () => {
  const { CL } = setup();
  const defender = CL.units.makeUnit(100, 100, 'ally', 'hero');
  defender.face = 'right';
  defender.guard = true;
  const front = CL.units.makeUnit(130, 100, 'enemy', 'reaver');
  const back = CL.units.makeUnit(70, 100, 'enemy', 'reaver');
  CL.combat.hit(defender, 20, front);
  assert.equal(defender.hp, 85);
  CL.combat.hit(defender, 20, back);
  assert.equal(defender.hp, 65);
});

test('a lethal hit downs the unit and counts an enemy kill once', () => {
  const { CL } = setup();
  const e = CL.units.makeUnit(0, 0, 'enemy', 'reaver');
  CL.combat.hit(e, 999, null);
  assert.equal(e.alive, false);
  assert.equal(e.hp, 0);
  CL.combat.hit(e, 999, null); // hitting a downed unit is a no-op
  assert.equal(CL.game.kills, 1);
});

test('a melee swing hits only one target and respects cooldown', () => {
  const { CL } = setup();
  const hero = CL.units.makeUnit(100, 100, 'ally', 'hero');
  hero.face = 'right';
  hero.attackCooldown = 0;
  CL.game.hero = hero;
  const e1 = CL.units.makeUnit(130, 100, 'enemy', 'reaver');
  const e2 = CL.units.makeUnit(140, 105, 'enemy', 'reaver');
  CL.game.enemies = [e1, e2];
  CL.combat.doAttack(hero);
  assert.equal(e1.hp + e2.hp, 52 * 2 - 18, 'exactly one target damaged');
  assert.equal(hero.attackCooldown, 0.49);
  CL.combat.doAttack(hero); // still cooling down
  assert.equal(e1.hp + e2.hp, 52 * 2 - 18);
});

test('archers spawn an arrow only within 245px', () => {
  const { CL } = setup();
  const archer = CL.units.makeUnit(100, 100, 'ally', 'archer');
  archer.attackCooldown = 0;
  CL.game.enemies = [CL.units.makeUnit(400, 100, 'enemy', 'reaver')];
  CL.combat.doAttack(archer);
  assert.equal(CL.game.arrows.length, 0);
  archer.attackCooldown = 0;
  CL.game.enemies[0].x = 300;
  CL.combat.doAttack(archer);
  assert.equal(CL.game.arrows.length, 1);
  assert.equal(CL.game.arrows[0].damage, 8);
});

test('startBattle caps the deployed party at 12 infantry and 8 archers', () => {
  const { CL, uiCalls } = setup();
  Object.assign(CL.campaign, { infantry: 20, archer: 20 });
  CL.combat.startBattle();
  const roles = CL.game.allies.map((a) => a.role);
  assert.equal(roles.filter((r) => r === 'infantry').length, 12);
  assert.equal(roles.filter((r) => r === 'archer').length, 8);
  assert.equal(CL.game.mode, 'battle');
  assert.equal(CL.game.hero.face, 'right');
  assert.equal(CL.game.enemies.length, 6, 'wave 1 has 6 enemies');
  assert.ok(uiCalls.some((c) => c[0] === 'hideBattleOverlays'));
});

test('waves: 6 enemies then 8, then victory', () => {
  const { CL, uiCalls } = setup();
  CL.combat.startBattle();
  const brutes = CL.game.enemies.filter((e) => e.role === 'brute').length;
  assert.equal(brutes, 2, 'every 5th spawn is a brute');
  for (const e of CL.game.enemies) e.alive = false;
  CL.combat.update(0.01);
  assert.equal(CL.game.wave, 2);
  assert.equal(CL.game.enemies.length, 8);
  for (const e of CL.game.enemies) e.alive = false;
  CL.combat.update(0.01);
  assert.equal(CL.game.mode, 'result');
  assert.equal(CL.game.result.win, true);
  assert.ok(uiCalls.some((c) => c[0] === 'changeMode' && c[1] === 'result'));
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
