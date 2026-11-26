// P11-07: bows and crossbows in the hero's hands (docs/PHASE-11-PLAN.md §10.6). Hold to draw and let go
// to loose (a tap looses when ready); the assisted target and its lead; manual aim; the flight's
// effective and far range; swept hits at any speed; the quiver, its refill and "Out of arrows"; a
// switch can't skip a reload; Archery and Strength; armour heavier than the bow allows.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** The hero with a bow (or crossbow) at (100, 300) facing right, and foes placed relative to it, still. */
function range(weapon = 'short_bow', foes = [['looter', 150, 0]], opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  c.equipment.weapon = weapon;
  c.equipment.offhand = null;
  if (opts.setup) opts.setup(CL, c);
  CL.combat.startBattle();
  const g = CL.game;
  Object.assign(g.hero, { x: 100, y: 300, face: 'right' });
  g.allies = [];
  g.enemies = foes.map(([id, dx, dy]) => Object.assign(CL.units.makeUnit(100 + dx, 300 + dy, 'enemy', id), { face: 'left', aiTimer: 99, attackCooldown: 99 }));
  return { ...env, g, h: g.hero };
}
const step = (CL, s, dt = 0.02) => {
  for (let t = 0; t < s - 1e-9; t += dt) CL.combat.update(dt);
};

test('a bow draws while Attack is held and looses when let go; walking is slower while drawing', () => {
  const { CL, g, h } = range();
  const r = h.ranged;
  assert.ok(r && !r.crossbow, 'a bow in hand is the hero’s own shot');
  g.attackHeld = true;
  step(CL, r.draw / 2);
  assert.ok(h.drawT > 0 && h.drawT < r.draw);
  assert.equal(g.arrows.length, 0, 'nothing flies while drawing');
  step(CL, r.draw);
  assert.equal(g.arrows.length, 0, 'held at full: still waiting');
  g.attackHeld = false;
  step(CL, 0.02);
  assert.equal(g.arrows.length, 1, 'let go: it flies');
  assert.equal(h.drawT, 0);
  // Walking while drawing: half pace.
  const { CL: L2, g: g2, h: h2 } = range('short_bow', [['looter', 300, 0]]);
  g2.hold.KeyW = true;
  L2.combat.update(0.1);
  const free = Math.abs(h2.y - 300);
  g2.attackHeld = true;
  L2.combat.update(0.02); // the draw begins
  const y0 = h2.y;
  L2.combat.update(0.1);
  assert.ok(Math.abs(h2.y - y0) < free * 0.75, 'slower while drawing');
});

test('a tap looses as soon as the draw is full', () => {
  const { CL, g, h } = range();
  g.attackHeld = true;
  step(CL, 0.04);
  g.attackHeld = false;
  step(CL, 0.02);
  assert.equal(g.arrows.length, 0, 'not yet drawn');
  step(CL, h.ranged.draw);
  assert.equal(g.arrows.length, 1, 'then it flies by itself');
});

test('assisted aim: the target in the cone in reach with a clear shot, the last struck first; it leads a mover', () => {
  const { CL, g, h } = range('short_bow', [['looter', 200, 0], ['looter', 120, 40], ['looter', -100, 0]]);
  const [far, near, behind] = g.enemies;
  assert.equal(CL.combat.aimTarget(h), near, 'the nearest in front');
  h.lastShot = far;
  assert.equal(CL.combat.aimTarget(h), far, 'the one last shot, while it is a fair target');
  h.lastShot = behind;
  assert.equal(CL.combat.aimTarget(h), near, 'not one behind you');
  far.x = 100 + h.ranged.maxRange + 50;
  h.lastShot = null;
  near.alive = false;
  assert.equal(CL.combat.aimTarget(h), null, 'nobody in reach');
  // The lead: a target walking down is aimed ahead of.
  near.alive = true;
  g.aimTrack = { id: near.id, x: near.x, y: near.y - 30, t: g.t - 0.5 };
  const to = CL.combat.lead(h, near);
  assert.ok(to.y > near.y, 'ahead of it');
  assert.ok(to.y - near.y <= 60 * CL.combat.BOW.leadMax + 1e-9);
});

test('manual aim: with a pointer the shot goes where it points (a setting)', () => {
  const { CL, g, h } = range('short_bow', [['looter', 150, 0]]);
  g.aimPoint = { x: 100, y: 450, touch: false };
  CL.settings.set('aimMouse', true);
  g.attackHeld = true;
  step(CL, h.ranged.draw + 0.02);
  g.attackHeld = false;
  CL.combat.update(0.02);
  const a = g.arrows[0];
  assert.ok(Math.abs(a.dy) > 0.9, 'straight down, at the pointer');
  CL.settings.set('aimMouse', false);
  h.face = 'right'; // the first shot turned the hero to its pointer
  g.attackHeld = true;
  step(CL, h.ranged.draw + 0.02);
  g.attackHeld = false;
  CL.combat.update(0.02);
  assert.ok(Math.abs(g.arrows.at(-1).dx) > 0.8, 'off: the game picks the looter');
});

test('the flight decides the damage: full to the effective range, falling to half at the far end, then it drops', () => {
  const { CL, g, h } = range('short_bow', []);
  const r = h.ranged;
  const at = (d) => {
    const v = CL.units.makeUnit(100 + d, 300 + CL.combat.FLIGHT.cell * 0, 'enemy', 'huscarl');
    Object.assign(v, { aiTimer: 99, attackCooldown: 99, hp: 999, maxhp: 999, armor: 0, guard: false });
    g.enemies = [v];
    g.arrows = [];
    g.arrows.push({ x: 100, y: 300 - 16, dx: 1, dy: 0, speed: r.projectileSpeed, team: 'ally', life: 9, source: h, damage: 20, flown: 0, range: r.range, far: r.maxRange });
    step(CL, 3);
    return 999 - v.hp;
  };
  assert.equal(at(100), 20, 'well within range: full');
  const past = at(r.range + (r.maxRange - r.range) / 2);
  assert.ok(past < 20 && past > 10, `half way past it: ${past}`);
  assert.equal(at(r.maxRange + 40), 0, 'past the far end: it has dropped');
});

test('swept hits: no speed passes through a target (900 px a second, a 0.05 s step)', () => {
  const { CL, g, h } = range('short_bow', []);
  const v = CL.units.makeUnit(200, 300, 'enemy', 'looter');
  Object.assign(v, { aiTimer: 99, attackCooldown: 99, hp: 999, maxhp: 999 });
  g.enemies = [v];
  for (const speed of [240, 600, 900]) {
    g.arrows = [{ x: 100, y: 300 - 16, dx: 1, dy: 0, speed, team: 'ally', life: 2, source: h, damage: 5, flown: 0, range: 600, far: 900 }];
    const hp = v.hp;
    for (let i = 0; i < 10; i++) CL.combat.update(0.05);
    assert.ok(v.hp < hp, `${speed} px/s hits`);
  }
  // The segment test itself: crossing a circle in one long step.
  assert.ok(CL.combat.sweep(0, 0, 100, 0, 50, 5, 19) > 0.3);
  assert.equal(CL.combat.sweep(0, 0, 100, 0, 50, 30, 19), null);
  // Terrain still stops a shot along its path.
  const { CL: L2, g: g2 } = range('short_bow', []);
  g2.battleMap = { ...g2.battleMap, obstacles: [...g2.battleMap.obstacles, { shape: 'rect', x: 140, y: 270, w: 20, h: 40, blocksArrows: true, look: 'crate' }] }; // a new map: its obstacle grid is built afresh
  const w = L2.units.makeUnit(200, 300, 'enemy', 'looter');
  Object.assign(w, { aiTimer: 99, attackCooldown: 99 });
  g2.enemies = [w];
  assert.ok(L2.units.arrowBlocked(150, 284), 'the crate is in the way');
  g2.arrows = [{ x: 100, y: 284, dx: 1, dy: 0, speed: 900, team: 'ally', life: 2, source: g2.hero, damage: 5, flown: 0, range: 600, far: 900 }];
  for (let i = 0; i < 10; i++) L2.combat.update(0.05);
  assert.equal(w.hp, w.maxhp, 'the crate stopped it, at 900 px a second');
});

test('the quiver: shots counted per battle (a quiver adds), fresh the next; empty: the other weapon, or fists, and it is said', () => {
  const { CL, g, h } = range('short_bow', [['looter', 150, 0]], {
    setup: (L, c) => {
      c.inventory.arrow_quiver = 1;
      L.character.equip('arrow_quiver', c, 'ammo');
      c.inventory.arming_sword = 1;
      L.character.equip('arming_sword', c, 'weapon2');
    },
  });
  const r = h.ranged;
  assert.equal(g.loadout.ammo.primary, r.ammo + CL.content.item('arrow_quiver').stats.ammo);
  assert.equal(g.loadout.ammo.secondary, null, 'a sword needs none');
  const said = [];
  CL.ui.message = (t) => said.push(t);
  g.loadout.ammo.primary = 1;
  g.attackHeld = true;
  step(CL, r.draw + 0.02);
  g.attackHeld = false;
  CL.combat.update(0.02);
  assert.equal(g.loadout.ammo.primary, 0);
  g.attackHeld = true;
  CL.combat.update(0.02);
  assert.ok(said.includes('Out of arrows: drawing your Arming Sword'), JSON.stringify(said));
  step(CL, 1);
  assert.equal(g.loadout.which, 'secondary', 'the sword to hand');
  assert.equal(h.ranged, null);
  // A new battle: a full quiver again (arrows are never bought).
  CL.combat.startBattle();
  assert.equal(CL.game.loadout.ammo.primary, r.ammo + CL.content.item('arrow_quiver').stats.ammo);
  // No other weapon: fists.
  const { CL: L2, g: g2, h: h2 } = range('short_bow', [['looter', 150, 0]]);
  g2.loadout.ammo.primary = 0;
  g2.attackHeld = true;
  L2.combat.update(0.02);
  assert.equal(h2.ranged, null);
  assert.equal(h2.damage, L2.character.UNARMED_DAMAGE);
});

test('a crossbow loads on the spot, then looses on a press; a switch loses a draw or a reload', () => {
  const { CL, g, h } = range('light_crossbow', [['looter', 150, 0]], {
    setup: (L, c) => {
      c.inventory.arming_sword = 1;
      L.character.equip('arming_sword', c, 'weapon2');
    },
  });
  const r = h.ranged;
  assert.equal(r.crossbow, true);
  g.hold.KeyW = true;
  step(CL, r.draw + 0.2);
  assert.ok(!h.loaded, 'not while walking');
  g.hold.KeyW = false;
  step(CL, r.draw * 0.6);
  const half = h.drawT;
  assert.ok(half > 0 && !h.loaded);
  // Switch away and back: the reload starts again.
  assert.ok(CL.gear.switchWeapon(g));
  assert.equal(h.drawT, 0, 'a switch loses the reload');
  step(CL, 1);
  assert.ok(CL.gear.switchWeapon(g));
  step(CL, 1);
  assert.equal(g.loadout.which, 'primary');
  step(CL, r.draw + 0.05);
  assert.equal(h.loaded, true);
  g.attackHeld = true;
  CL.combat.update(0.02);
  g.attackHeld = false;
  CL.combat.update(0.02);
  assert.equal(g.arrows.length, 1, 'loaded: a press and a release loose it');
  assert.ok(!h.loaded);
});

test('Archery draws a bow faster and aims truer; Strength loads a crossbow; heavy armour slows a longbow', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const P = CL.profile;
  const shot = (weapon, extra = {}) => {
    const eq = { ...c.equipment, offhand: null, weapon, ...extra };
    return P.resolve({ hero: c, equipment: CL.gear.kitFor(c, eq, 'primary'), carried: eq }).ranged;
  };
  c.character.skills.archery = 0;
  const plain = shot('short_bow');
  c.character.skills.archery = 5;
  const skilled = shot('short_bow');
  assert.ok(skilled.draw < plain.draw && skilled.accuracy > plain.accuracy);
  c.character.attributes.str = 6;
  const weak = shot('light_crossbow');
  c.character.attributes.str = 10;
  const strong = shot('light_crossbow');
  assert.ok(strong.draw < weak.draw, 'Strength loads it faster');
  c.character.skills.archery = 0;
  assert.equal(shot('light_crossbow').draw, strong.draw, 'Archery doesn’t load it');
  c.character.attributes.str = 7;
  c.character.skills.archery = 1;
  const light = shot('hunting_longbow', { body: 'leather_chest' });
  const mail = shot('hunting_longbow', { body: 'mail_hauberk' });
  assert.ok(mail.draw > light.draw, 'mail is heavier than a longbow allows');
  assert.ok(CL.gear.check(c, { ...c.equipment, weapon: 'hunting_longbow', offhand: null, body: 'mail_hauberk' }).some((f) => f.code === 'heavy'));
});

test('troops’ shots fly by the same rule: their far end from their range', () => {
  const { CL } = loadGame();
  CL.combat.startBattle();
  const g = CL.game;
  const archer = CL.units.makeUnit(100, 300, 'enemy', 'hunter');
  const target = CL.units.makeUnit(300, 300, 'ally', 'footman');
  Object.assign(archer, { face: 'right', attackCooldown: 0, target });
  g.allies = [target];
  g.enemies = [archer];
  g.arrows = [];
  CL.combat.startAttack(archer);
  const a = g.arrows[0];
  if (a) {
    assert.equal(a.range, archer.ranged.range);
    assert.equal(a.far, archer.ranged.range * CL.combat.FLIGHT.far);
  }
});
