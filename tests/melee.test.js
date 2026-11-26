// P11-05: melee rhythm and defence (docs/PHASE-11-PLAN.md §10.1–§10.4). Each family's own timing; a
// whiff's longer recovery; the targets a blow strikes, nearest first; stagger, its immunity and its cap;
// knockback that shrinks on repeats; shield pressure, a broken guard and its recovery; the Shield skill;
// the weapon guard; the AI's honest guard reaction; the hero's body from the weapon in hand (D-P11d);
// the parry experiment (D-P11j); and the art drawing the phase the simulation is in, every frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A battle with the hero at (100, 100) facing right and enemies placed relative to it, standing still. */
function fight(troops = [['reaver', 40, 0]], opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  CL.combat.startBattle();
  const g = CL.game;
  Object.assign(g.hero, { x: 100, y: 100, face: 'right', attackCooldown: 0 });
  g.allies = [];
  g.enemies = troops.map(([id, dx, dy]) => {
    const e = CL.units.makeUnit(100 + dx, 100 + dy, 'enemy', id);
    Object.assign(e, { face: 'left', aiTimer: 99, attackCooldown: 99 });
    return e;
  });
  g.effects = [];
  return { ...env, g };
}
const step = (CL, seconds, dt = 0.02) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) CL.combat.update(dt);
};
/** A unit's profile with some fields changed (as a pack's family would). */
const tune = (u, fields) => {
  u.profile = { ...u.profile, ...fields };
  return u;
};

test('each family has its own rhythm; the hero’s cooldown is everyone’s (D-P11d)', () => {
  const { CL } = loadGame();
  const F = CL.content.table('weapon_families');
  const total = (f) => f.windup + f.active + f.recovery;
  assert.ok(total(F.sword) < total(F.axe) && total(F.axe) < total(F.greatsword) && total(F.greatsword) < total(F.greataxe), 'sword, axe, greatsword, greataxe: ever slower');
  assert.ok(F.spear.reach > F.greatsword.reach && F.greatsword.reach > F.sword.reach && F.sword.reach > F.axe.reach, 'reach: spear, greatsword, sword, axe');
  for (const f of Object.values(F)) assert.equal(f.cooldown.hero, f.cooldown.ai, f.id);
  assert.deepEqual([F.greatsword.guard, F.spear.guard, F.sword.guard, F.unarmed.guard], ['weapon', 'shield', 'shield', 'none']);
  assert.ok(F.greataxe.poise > F.sword.poise && F.mace.stagger > F.sword.stagger && F.axe.shieldPressure > F.sword.shieldPressure);
});

test('the hero’s body: reach and timing from the weapon in hand, speed from a pace, Agility and armour', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const P = CL.profile;
  const B = CL.content.table('body');
  const resolve = (eq) => P.resolve({ hero: c, equipment: { ...c.equipment, ...eq } });
  c.character.attributes.agi = 5;
  const sword = resolve({ weapon: 'arming_sword', body: 'clothing' });
  assert.equal(sword.reach, CL.content.table('weapon_families').sword.reach, 'not the hero troop’s 67');
  assert.equal(sword.speed, B.speed, 'not the hero troop’s 142');
  assert.ok(resolve({ weapon: 'ash_spear' }).reach > sword.reach);
  assert.ok(resolve({ body: 'mail_hauberk' }).speed < sword.speed, 'mail slows you (a placeholder until P11-06)');
  c.character.attributes.agi = 8;
  assert.ok(Math.abs(resolve({ body: 'clothing' }).speed - B.speed * (1 + 3 * B.agility)) < 1e-9, 'Agility: a share a point above 5');
  // Its skill trains it: One-Handed for a sword, Two-Handed for a greatsword, Polearm for a spear.
  c.character.skills = { ...c.character.skills, one_handed: 0, two_handed: 0, polearm: 0 };
  const plainSword = resolve({ weapon: 'arming_sword' });
  c.character.skills.one_handed = 5;
  const trained = resolve({ weapon: 'arming_sword' });
  assert.ok(Math.abs(trained.damage - plainSword.damage * 1.15) < 1e-9, '+3% a point');
  assert.ok(trained.timing.recovery < plainSword.timing.recovery && trained.cooldown.hero < plainSword.cooldown.hero, 'a little quicker');
  assert.equal(resolve({ weapon: 'ash_spear' }).damage, CL.content.item('ash_spear').stats.damage, 'One-Handed doesn’t train a spear');
  c.character.skills.polearm = 2;
  assert.ok(Math.abs(resolve({ weapon: 'ash_spear' }).damage - CL.content.item('ash_spear').stats.damage * 1.06) < 1e-9);
  // In battle: a greatsword has a weapon guard, a sword and shield the shield, fists nothing.
  CL.combat.startBattle();
  assert.equal(CL.game.hero.guardKind, 'shield');
  assert.equal(CL.game.hero.reach, P.of(CL.game.hero).reach);
});

test('a whiff recovers longer: the family’s miss; a blow that lands doesn’t', () => {
  const { CL, g } = fight([['reaver', 200, 0]]);
  const h = g.hero;
  const T = CL.profile.timingOf(h);
  const miss = CL.profile.of(h).miss;
  CL.combat.queueAttack();
  step(CL, T.total + 0.04);
  assert.equal(CL.units.swingPhase(h), 'recovery', 'still recovering past its usual end');
  assert.equal(h.swing.miss, miss);
  step(CL, miss);
  assert.equal(h.swing, null);
  assert.equal(g.whiffed, true, 'the tip’s moment');
  // In reach, the same swing lands and recovers on time.
  const { CL: L2, g: g2 } = fight([['reaver', 40, 0]]);
  L2.combat.queueAttack();
  step(L2, L2.profile.timingOf(g2.hero).total + 0.04);
  assert.equal(g2.hero.swing, null);
});

test('a blow strikes the nearest first, up to its family’s targets, the second and later for less', () => {
  const { CL, g } = fight([['reaver', 46, 0], ['reaver', 38, 10], ['reaver', 30, -8], ['reaver', 42, -14]]);
  const h = g.hero;
  const order = g.enemies.map((e, i) => [Math.hypot(e.x - h.x, e.y - h.y), i]).sort((a, b) => a[0] - b[0]); // before the blow pushes them
  CL.combat.queueAttack();
  step(CL, 0.32);
  const lost = g.enemies.map((e) => e.maxhp - e.hp);
  const first = CL.combat.mitigate(h.damage, 3);
  const later = CL.combat.mitigate(h.damage * CL.combat.MELEE.second, 3);
  assert.equal(lost.filter((n) => n > 0).length, CL.profile.of(h).maxTargets, 'three for a sword');
  assert.equal(lost[order[0][1]], first, 'the nearest takes the full blow');
  assert.equal(lost[order[1][1]], later);
  assert.equal(lost[order[3][1]], 0, 'the furthest is spared');
});

test('stagger: a heavy blow in a windup interrupts it; then immunity; never in the target’s active window', () => {
  const { CL, g } = fight([['footman', 40, 0]]);
  const h = g.hero;
  const e = g.enemies[0];
  tune(h, { stagger: 2.6 }); // a mace's
  e.swing = { t: 0.05, hit: [] };
  g.t = 5;
  CL.combat.hit(e, 5, h);
  assert.equal(e.swing, null, 'the windup is lost');
  assert.ok(e.attackCooldown >= CL.combat.STAGGER.sway);
  // Immune for a while: a second heavy blow in the next windup doesn't interrupt.
  e.swing = { t: 0.05, hit: [] };
  g.t = 5 + CL.combat.STAGGER.immune / 2;
  CL.combat.hit(e, 5, h);
  assert.ok(e.swing, 'not twice in a window: no stunlock');
  g.t = 5 + CL.combat.STAGGER.immune + 0.01;
  CL.combat.hit(e, 5, h);
  assert.equal(e.swing, null, 'after the immunity, again');
  // Its own active window: both blows land, nobody is interrupted.
  e.staggerUntil = -1;
  e.swing = { t: 0.2, hit: [] };
  CL.combat.hit(e, 5, h);
  assert.ok(e.swing, 'active: not interrupted');
  // A light blow against a steady grip: nothing.
  tune(h, { stagger: 1.2 });
  tune(e, { poise: 2.5 });
  e.swing = { t: 0.05, hit: [] };
  g.t += 5;
  CL.combat.hit(e, 5, h);
  assert.ok(e.swing, 'poise beats a sword');
  // Killed mid-swing: nothing left over.
  e.swing = { t: 0.05, hit: [] };
  CL.combat.hit(e, 999, h);
  assert.deepEqual([e.alive, e.swing, e.press], [false, null, 0]);
});

test('knockback shrinks on repeated hits in a window (no knockback chains)', () => {
  const { CL, g } = fight([['looter', 40, 0]]);
  const h = g.hero;
  const e = g.enemies[0];
  const k = CL.profile.of(h).knockback;
  g.t = 1;
  const pushes = [];
  for (let i = 0; i < 3; i++) {
    const x = e.x;
    CL.combat.hit(e, 1, h);
    pushes.push(Math.round((e.x - x) * 100) / 100);
  }
  assert.deepEqual(pushes, [k, k * CL.combat.KNOCK.shrink, k * CL.combat.KNOCK.shrink ** 2]);
  g.t = 1 + CL.combat.KNOCK.window + 0.1;
  const x = e.x;
  CL.combat.hit(e, 1, h);
  assert.equal(Math.round(e.x - x), k, 'a fresh window, a full push');
});

test('shield pressure: blocked blows wear a shield down until the guard breaks; it recovers while lowered', () => {
  const { CL, g } = fight([['footman', 40, 0]]);
  const h = g.hero;
  const e = g.enemies[0];
  const S = CL.combat.SHIELD;
  e.guard = true;
  g.t = 1;
  const per = CL.profile.of(h).shieldPressure;
  const blows = Math.ceil(S.capacity / per);
  for (let i = 0; i < blows - 1; i++) assert.equal(CL.combat.hit(e, 10, h), 'blocked');
  assert.equal(e.hp, e.maxhp);
  assert.equal(CL.combat.hit(e, 10, h), 'blocked', 'the last blow is still stopped…');
  assert.equal(e.guard, false, '…and the guard breaks');
  assert.ok(e.guardBrokenUntil > g.t);
  assert.equal(CL.combat.hit(e, 10, h), 'hit', 'the shield is down');
  // An axe presses harder: fewer blows to break it.
  const { CL: L2, g: g2 } = fight([['footman', 40, 0]]);
  tune(g2.hero, { shieldPressure: L2.content.table('weapon_families').axe.shieldPressure });
  const f = g2.enemies[0];
  f.guard = true;
  g2.t = 1;
  let n = 0;
  while (f.guard && n < 10) {
    L2.combat.hit(f, 10, g2.hero);
    n++;
  }
  assert.ok(n < blows, `an axe breaks it in ${n}, a sword in ${blows}`);
  // The pressure drains while the shield is down.
  const { CL: L3, g: g3 } = fight([['footman', 40, 0]]);
  const s = g3.enemies[0];
  s.press = 2;
  s.guard = false;
  s.aiTimer = 99;
  L3.combat.update(0.02);
  for (let i = 0; i < 25; i++) L3.combat.update(0.02);
  assert.ok(s.press < 2 - S.recover * 0.4, `drained to ${s.press}`);
});

test('the Shield skill: more before it breaks, quicker recovery, a little wider', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.combat.startBattle();
  const g = CL.game;
  const h = g.hero;
  const narrow = CL.combat.blockArc(h);
  c.character.skills.shield = 5;
  CL.profile.apply(h, CL.profile.resolve({ hero: c, equipment: c.equipment }));
  assert.ok(CL.combat.blockArc(h) < narrow, 'a wider cover (a smaller minimum dot product)');
  const foe = CL.units.makeUnit(140, h.y, 'enemy', 'reaver');
  Object.assign(h, { face: 'right', guard: true, guardKind: 'shield' });
  foe.x = h.x + 40;
  g.t = 1;
  let n = 0;
  while (h.guard && n < 20) {
    CL.combat.hit(h, 5, foe);
    n++;
  }
  const plainBlows = Math.ceil(CL.combat.SHIELD.capacity / CL.profile.of(foe).shieldPressure);
  assert.ok(n > plainBlows, `${n} blows with Shield 5, ${plainBlows} without`);
});

test('the weapon guard: a two-hander’s Block takes part of a frontal blow, in a narrower arc', () => {
  const { CL, g } = fight([['reaver', 40, 0]]);
  const h = g.hero;
  Object.assign(h, { guard: true, guardKind: 'weapon', face: 'right' });
  const e = g.enemies[0];
  const before = h.hp;
  assert.equal(CL.combat.hit(h, 20, e), 'hit');
  assert.equal(before - h.hp, CL.combat.mitigate(20 * CL.combat.WEAPON_GUARD.take, h.armor), 'less gets through');
  // Outside its 90° (inside a shield's 120°): the whole blow.
  const side = CL.units.makeUnit(h.x + 20, h.y + 28, 'enemy', 'reaver');
  const hp = h.hp;
  CL.combat.hit(h, 20, side);
  assert.equal(hp - h.hp, CL.combat.mitigate(20, h.armor));
  // In battle, a greatsword in hand gives it, and BLOCK works with it.
  const { CL: L2 } = loadGame({
    content: (C) => {
      C.items.great_sword.req = {};
    },
  });
  L2.campaign.equipment.weapon = 'great_sword';
  L2.combat.startBattle();
  assert.equal(L2.game.hero.guardKind, 'weapon');
  L2.game.blockHeld = true;
  L2.combat.update(0.02);
  assert.equal(L2.game.hero.guard, true);
});

test('AI shields come up a reaction after the threat, by tier, and never in their own recovery', () => {
  const { CL, g } = fight([['footman', 40, 0]]);
  const e = g.enemies[0];
  const h = g.hero;
  const tier = CL.content.troop('footman').tier;
  h.swing = { t: 0.01, hit: [] };
  g.t = 3;
  assert.equal(CL.groups.shouldGuard(e, [h]), false, 'not in the same frame');
  g.t = 3 + CL.combat.GUARD_DELAY[tier];
  assert.equal(CL.groups.shouldGuard(e, [h]), true);
  assert.ok(CL.combat.GUARD_DELAY.T3 < CL.combat.GUARD_DELAY.T2 && CL.combat.GUARD_DELAY.T2 < CL.combat.GUARD_DELAY.T1, 'the better, the quicker');
  assert.ok(CL.combat.GUARD_DELAY.T2 < CL.profile.of(h).timing.windup, 'a trained soldier blocks a sword seen coming…');
  e.swing = { t: 0.4, hit: [] };
  g.t = 10;
  CL.groups.shouldGuard(e, [h]);
  g.t = 11;
  assert.equal(CL.groups.shouldGuard(e, [h]), false, '…but not while recovering from its own swing');
});

test('the parry experiment (D-P11j) is off by default; on, Block just before a blow turns it aside', () => {
  const { CL, g } = fight([['reaver', 40, 0]]);
  const h = g.hero;
  const e = g.enemies[0];
  assert.equal(CL.settings.get('parry'), false);
  Object.assign(h, { guard: true, guardKind: 'shield', face: 'right' });
  g.t = 2;
  g.blockPressedAt = 1.95;
  e.swing = { t: 0.2, hit: [] };
  CL.combat.hit(h, 10, e);
  assert.ok(e.swing, 'off: an ordinary block');
  CL.settings.set('parry', true);
  g.blockPressedAt = g.t - CL.combat.PARRY.window / 2;
  assert.equal(CL.combat.hit(h, 10, e), 'blocked');
  assert.equal(e.swing, null, 'the attacker is opened');
  g.blockPressedAt = g.t - CL.combat.PARRY.window - 0.1;
  e.swing = { t: 0.2, hit: [] };
  CL.combat.hit(h, 10, e);
  assert.ok(e.swing, 'too late a Block is a plain block');
  CL.settings.set('parry', false);
});

test('the art draws the phase the simulation is in, every frame (and a whiff’s longer recovery)', () => {
  const { CL, g } = fight([['reaver', 200, 0], ['footman', 34, 0]]);
  const e = g.enemies[1];
  Object.assign(e, { aiTimer: 0, attackCooldown: 0, target: g.hero });
  CL.combat.queueAttack();
  let frames = 0;
  for (let i = 0; i < 90; i++) {
    CL.combat.update(1 / 60);
    for (const u of [g.hero, e]) {
      const sim = CL.units.swingPhase(u);
      const drawn = CL.gfx.battle.poseOf(u).atk?.phase ?? null;
      assert.equal(drawn, sim, `frame ${i}`);
      if (sim) frames++;
    }
  }
  assert.ok(frames > 30, 'and there were swings to draw');
});

test('feedback: the hero reads a miss, a block and a broken guard; the sounds exist', () => {
  const { CL, g } = fight([['footman', 40, 0]]);
  const h = g.hero;
  const e = g.enemies[0];
  const said = [];
  CL.ui.message = (t) => said.push(t);
  e.guard = true;
  g.t = 1;
  CL.combat.hit(e, 5, h);
  assert.ok(said.includes('Blocked'));
  for (let i = 0; i < 6 && e.guard; i++) CL.combat.hit(e, 5, h);
  assert.ok(said.includes('You broke their guard'));
  assert.ok(g.effects.some((x) => x.kind === 'break'));
  assert.equal(g.brokeGuard, true);
  for (const s of ['whiff', 'guardBreak', 'stagger']) assert.equal(typeof CL.audio.SFX[s]?.play, 'function', `a sound for ${s}`);
});
