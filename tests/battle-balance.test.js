// B-01: the battle balance pass. Fought company battles are harder (the enemy keeps a loose line,
// picks on the exposed, holds a little longer, and defends its lair harder), and the stated odds follow
// the square law, so Simulate is only a little worse than fighting well. Fought against Simulate across
// many seeds: `node scripts/parity.js` (and the parity check in tests/slow/battle-parity.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A battle with nobody moving yet: the company and the enemy placed by hand. */
function field(enemies = { looter: 3 }, company = []) {
  const { CL } = loadGame({ random: () => 0.5 });
  const c = CL.campaign;
  c.roster = [];
  for (const t of company) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [enemies], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  return { CL, g: CL.game };
}

test('the odds follow the square law: the stronger side wins more often than its share of the strength', () => {
  const { CL } = loadGame();
  const A = CL.autoresolve;
  assert.equal(A.ODDS_POWER, 2);
  assert.equal(A.winChance(5, 5), 0.5);
  assert.equal(A.winChance(2, 1), 0.8, '2 : 1 is 80%, not 67%');
  assert.ok(Math.abs(A.winChance(3, 2) - 9 / 13) < 1e-12);
  assert.equal(A.winChance(100, 1), 0.9, 'still never certain');
  assert.equal(A.winChance(1, 100), 0.1);
  assert.equal(A.winChance(0, 0), 0.1);
  const lines = A.explain(CL.campaign, { looter: 3 });
  assert.match(lines.at(-1), /numbers count twice over/);
});

test('enemy shields cover their own: a raised shield beside an enemy takes the blow meant for it', () => {
  const { CL, g } = field({ looter: 1, mercenary: 1 });
  const [looter, merc] = [g.enemies.find((e) => e.troop === 'looter'), g.enemies.find((e) => e.troop === 'mercenary')];
  const h = g.hero;
  // The mercenary faces the hero with its shield raised; the looter stands on its shield side.
  Object.assign(merc, { x: 600, y: 300, face: 'left', guard: true });
  Object.assign(looter, { x: 600, y: 300 + 20 });
  Object.assign(h, { x: 560, y: 310 });
  const hp = looter.hp;
  assert.equal(CL.combat.hit(looter, 20, h), 'blocked');
  assert.equal(looter.hp, hp);
  merc.guard = false;
  assert.equal(CL.combat.hit(looter, 20, h), 'hit', 'without the raised shield the blow lands');
});

test('the enemy picks on the exposed: an archer or the wounded a little further off, the hero alone', () => {
  const { CL, g } = field({ looter: 1 }, ['levy', 'hunter']);
  const E = CL.combat.ENEMY;
  const [e] = g.enemies;
  const levy = g.allies.find((a) => a.role === 'infantry');
  const hunter = g.allies.find((a) => a.role === 'archer');
  const h = g.hero;
  Object.assign(e, { x: 500, y: 300, aiTimer: 0, target: null });
  Object.assign(levy, { x: 540, y: 300 });
  Object.assign(hunter, { x: 590, y: 300 }); // 50 px further than the levy
  Object.assign(h, { x: 540, y: 330 }); // the levy is beside the hero: the hero is not alone
  CL.combat.update(0.001);
  assert.equal(e.target, hunter, 'the archer, not much further than the nearest');
  Object.assign(hunter, { x: 540 + E.preferRange + 40, y: 300 });
  Object.assign(e, { aiTimer: 0, target: null });
  CL.combat.update(0.001);
  assert.equal(e.target, levy, 'an archer far behind is left alone');
  // The badly wounded.
  levy.hp = Math.floor(levy.maxhp * 0.3);
  Object.assign(hunter, { x: 900, y: 300 });
  Object.assign(h, { x: 530, y: 360 });
  Object.assign(e, { aiTimer: 0, target: null });
  CL.combat.update(0.001);
  assert.equal(e.target, levy);
  // The hero with none of the company near.
  const lone = field({ looter: 1 }, ['levy']);
  const [e2] = lone.g.enemies;
  const levy2 = lone.g.allies[0];
  Object.assign(e2, { x: 500, y: 300, aiTimer: 0, target: null });
  Object.assign(levy2, { x: 460, y: 300 }); // 40 px away, but 124 px from the hero
  Object.assign(lone.g.hero, { x: 580, y: 330 }); // 85 px away
  lone.CL.combat.update(0.001);
  assert.equal(e2.target, lone.g.hero, 'a hero away from the company is fair game');
});

test('the enemy keeps a loose line: a soldier far ahead of the rest waits for them (unless it has the numbers)', () => {
  const { CL, g } = field({ looter: 4 }, ['levy', 'levy', 'levy']);
  for (const a of g.allies) Object.assign(a, { x: 120, y: 300 });
  const [front, ...rest] = g.enemies;
  const h = g.hero;
  Object.assign(h, { x: 200, y: 300 });
  rest.forEach((e, i) => {
    Object.assign(e, { x: 900, y: 260 + i * 40 });
  });
  Object.assign(front, { x: 600, y: 300 }); // well ahead of the line, still far from the hero
  for (const e of g.enemies) Object.assign(e, { target: h, aiTimer: 9 });
  const [fx, rx] = [front.x, rest[0].x];
  CL.combat.update(0.1);
  const ahead = fx - front.x;
  const behind = rx - rest[0].x;
  assert.ok(ahead > 0 && behind > 0, 'both move');
  assert.ok(ahead < behind * 0.5, `the runner slows: ${ahead.toFixed(1)} px against ${behind.toFixed(1)}`);
  // Close to its target it goes in at full speed.
  Object.assign(front, { x: h.x + CL.combat.ENEMY.lineEngage - 20, y: 300 });
  const x0 = front.x;
  CL.combat.update(0.1);
  assert.ok(x0 - front.x > behind * 0.8, 'no waiting once close');
  // Outnumbering the company by more than a quarter, it swarms: no line, nobody waits.
  const s = field({ looter: 6 }, ['levy']);
  const [run, ...pack] = s.g.enemies;
  Object.assign(s.g.hero, { x: 200, y: 300 });
  Object.assign(s.g.allies[0], { x: 120, y: 300 });
  pack.forEach((e, i) => {
    Object.assign(e, { x: 900, y: 220 + i * 40 });
  });
  Object.assign(run, { x: 600, y: 300 });
  for (const e of s.g.enemies) Object.assign(e, { target: s.g.hero, aiTimer: 9 });
  const [r0, p0] = [run.x, pack[0].x];
  s.CL.combat.update(0.1);
  assert.equal(s.g.enemyLine, null);
  assert.ok(r0 - run.x > (p0 - pack[0].x) * 0.8, 'the runner keeps running');
});

test('enemy morale: a little steadier than the company, and a band defending its lair minds odds half as much', () => {
  const { CL, g } = field({ looter: 2 }, ['footman', 'footman', 'footman', 'footman', 'footman', 'footman']);
  const T = CL.morale.TERMS;
  CL.combat.update(0.3); // a morale update
  const out = CL.morale.targetFor(g, 'enemy', 'infantry');
  assert.equal(out.parts.steady, T.enemySteady);
  assert.ok(out.parts.outnumbered < 0, 'outnumbered');
  g.lairDefence = true;
  const lair = CL.morale.targetFor(g, 'enemy', 'infantry');
  assert.ok(Math.abs(lair.parts.outnumbered - out.parts.outnumbered * T.lairOutnumbered) < 1e-9);
  assert.equal(CL.morale.targetFor(g, 'ally', 'infantry').parts.steady, undefined, 'the company gets no such help');
  // A lair battle is marked as one when it starts.
  const s = loadGame().CL;
  s.game.siteId = 'looter_camp';
  s.combat.startBattle('looter_band');
  assert.equal(s.game.lairDefence, true);
});

test('a stalled fight with waves still to come: the stuck enemies slip away and the next wave comes on', () => {
  const { CL, g } = field({ looter: 1 });
  g.totalWaves = 2;
  g.encounterDef.waves.push({ looter: 2 });
  const [e] = g.enemies;
  Object.assign(e, { x: 1800, y: 100 });
  g.lastBlowAt = 0;
  g.t = CL.combat.BATTLE.stall + 1;
  g.hero.x = 100;
  CL.combat.update(0.05);
  CL.combat.update(0.05);
  assert.equal(e.alive, false, 'gone');
  assert.equal(g.wave, 2, 'the next wave is on the field');
  assert.equal(g.mode, 'battle');
});
