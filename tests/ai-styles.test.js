// P11-10: fighters who think (docs/PHASE-11-PLAN.md §10; data/styles.js, js/styles.js). Each style uses
// the rules everyone shares, sees only what is drawn and answers a reaction after it: the guard's
// reaction is never zero; a longer weapon keeps its reach; a patient fighter waits outside a ready
// opponent's reach (for a while) and strikes into an opening; archers step back from foot; riders
// avoid a braced front and hunt archers; tournament fighters have styles by round (a rival keeps
// theirs); the full style only near the hero (or in a duel); the same seed, the same fight.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A battle with the hero at (300, 300) facing right and these fighters placed relative to them, held still. */
function scene(troops, opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  CL.combat.startBattle({ id: 'ai', name: 'ai', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  Object.assign(g.hero, { x: 300, y: 300, face: 'right', attackCooldown: 99 });
  g.allies = [];
  g.enemies = troops.map(([id, dx, dy, style]) => {
    const e = CL.units.makeUnit(300 + dx, 300 + dy, 'enemy', id);
    Object.assign(e, { face: 'left', aiTimer: 0, attackCooldown: 0 });
    if (style) e.styleId = style;
    return e;
  });
  g.effects = [];
  return { ...env, g, h: g.hero };
}
const step = (CL, s, dt = 0.02) => {
  for (let t = 0; t < s - 1e-9; t += dt) CL.combat.update(dt);
};
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('every troop has a style by its kind; a style is data, checked; the troop card’s words', () => {
  const { CL } = loadGame();
  const S = CL.content.table('fighting_styles');
  assert.equal(CL.styles.forTroop('looter'), 'brawler');
  assert.equal(CL.styles.forTroop('footman'), 'soldier');
  assert.equal(CL.styles.forTroop('legionary'), 'veteran');
  assert.equal(CL.styles.forTroop('huscarl'), 'heavy');
  assert.equal(CL.styles.forTroop('spearman'), 'spear');
  assert.equal(CL.styles.forTroop('hunter'), 'skirmisher');
  assert.equal(CL.styles.forTroop('rider'), 'rider');
  assert.equal(CL.styles.forTroop('hero'), null);
  for (const t of Object.values(CL.content.table('troops'))) if (t.role !== 'hero') assert.ok(S[CL.styles.forTroop(t.id)], t.id);
  assert.match(CL.styles.words('legionary'), /patiently, guards well/);
  assert.deepEqual(Array.from(CL.content.validate()), []);
  // A pack's style is checked, and a troop's.
  const errs = [];
  CL.styles.validate({ fighting_styles: { odd: { id: 'odd', name: 'Odd', words: 'x', reaction: 0, patience: 0, spacing: 0, opportunism: 0, guardUse: 0, retreatAt: 0, pursue: 0, preferRange: 0 } }, troops: { t: { id: 't', style: 'nope' } } }, (e) => errs.push(e));
  assert.ok(errs.some((e) => /reaction must be/.test(e)) && errs.some((e) => /unknown style nope/.test(e)), errs.join('; '));
});

test('the guard’s reaction is never zero, by style; it comes up a reaction after the blow is seen', () => {
  for (const s of Object.values(loadGame().CL.content.table('fighting_styles'))) assert.ok(s.reaction >= 0.05, s.id);
  const { CL, g, h } = scene([['legionary', 36, 0, 'veteran']]);
  const e = g.enemies[0];
  h.swing = { t: 0.01, hit: [] };
  g.t = 5;
  assert.equal(CL.groups.shouldGuard(e, [h]), false, 'not in the same frame');
  g.t = 5 + CL.styles.reaction(e);
  assert.equal(CL.groups.shouldGuard(e, [h]), true, 'a veteran always guards a blow it sees (guardUse 1)');
});

test('a spear keeps the hero at the end of its reach; a sword-user stepping inside it gets in', () => {
  const { CL, g, h } = scene([['spearman', 120, 0, 'spear']]);
  const e = g.enemies[0];
  step(CL, 3);
  const d = gap(e, h);
  assert.ok(d > h.reach + 4 && d <= e.reach + 6, `holds at ${d.toFixed(0)} px: past the hero's ${h.reach}, inside its own ${e.reach}`);
  // A brawler with the same spear walks right in.
  const b = scene([['spearman', 120, 0, 'brawler']]);
  step(b.CL, 3);
  assert.ok(gap(b.g.enemies[0], b.h) < d - 10, 'no spacing without the style');
});

test('a patient fighter waits outside a ready opponent’s reach, for a while; then it closes', () => {
  const { CL, g, h } = scene([['legionary', 150, 0, 'veteran']]);
  const e = g.enemies[0];
  const S = CL.styles.of(e);
  step(CL, 1.2);
  assert.ok(gap(e, h) > h.reach + 4, `waits outside (${gap(e, h).toFixed(0)} px)`);
  assert.equal(e.swing, null, 'no blow while it waits');
  step(CL, S.patience + 1.5);
  assert.ok(e.mind.waited >= S.patience - 1e-9 || e.swing || gap(e, h) <= e.reach, 'the patience has a limit: it closes');
});

test('an opening seen is struck a reaction later: the hero recovering from a miss', () => {
  const { CL, g, h } = scene([['legionary', 30, 0, 'veteran']]);
  const e = g.enemies[0];
  e.x = h.x + Math.max(e.reach, h.reach) + 12; // just outside both reaches: only an opening brings it in
  CL.content.table('fighting_styles').veteran.opportunism = 1; // test setup: it takes every opening
  // The hero in the recovery of a miss (what the pose shows).
  const t = CL.profile.of(h).timing;
  h.swing = { t: t.windup + t.active + 0.01, hit: [], done: true, miss: 0.4 };
  assert.equal(CL.styles.open(g, h), true);
  let struck = null;
  for (let i = 0; i < 60 && !struck; i++) {
    CL.combat.update(0.02);
    h.swing.t = t.windup + t.active + 0.01; // held in recovery
    if (e.swing) struck = g.t;
  }
  assert.ok(struck != null, 'it strikes into the recovery');
  assert.ok(struck - e.mind.openAt >= CL.styles.of(e).reaction - 1e-9, 'a reaction after it was seen, never at once');
});

test('archers keep their distance: a skirmisher steps back from a foot soldier inside its retreat', () => {
  const { CL, g } = scene([['hunter', 200, 0, 'skirmisher']]);
  const a = g.enemies[0];
  const foot = CL.units.makeUnit(a.x - 40, a.y, 'ally', 'footman');
  Object.assign(foot, { aiTimer: 99, attackCooldown: 99 });
  g.allies = [foot];
  const before = gap(a, foot);
  step(CL, 0.6);
  assert.ok(gap(a, foot) > before + 10, `backs off (${before.toFixed(0)} → ${gap(a, foot).toFixed(0)} px)`);
});

test('riders avoid a braced front and hunt archers', () => {
  const { CL, g } = scene([['rider', 0, -200]]);
  const r = g.enemies[0];
  const spear = CL.units.makeUnit(r.x, r.y + 90, 'ally', 'spearman');
  Object.assign(spear, { face: 'up' }); // facing the rider: braced
  const archer = CL.units.makeUnit(r.x + 150, r.y, 'ally', 'hunter');
  assert.equal(CL.styles.riderTarget(g, r, [spear, archer]), archer, 'the archer, though further');
  const foot = CL.units.makeUnit(r.x - 120, r.y, 'ally', 'footman');
  assert.equal(CL.styles.riderTarget(g, r, [spear, foot]), foot, 'anyone but the braced spear');
  spear.face = 'down'; // its back to the rider
  assert.equal(CL.styles.riderTarget(g, r, [spear, foot]), spear, 'a spear from behind is fair game');
});

test('a rider ground down among foot rides out to charge again', () => {
  const { CL, g } = scene([['rider', 30, 0]]);
  const r = g.enemies[0];
  r.momentum = 0;
  let out = false;
  for (let i = 0; i < 100 && !out; i++) out = CL.styles.rideOut(g, r, g.hero, 0.02);
  assert.equal(out, true);
  assert.ok(r.overrun > 0 && r.runDir[0] > 0, 'away from the foot it was stuck on');
});

test('tournament fighters: a style by round; a rival always fights the same way', () => {
  const { CL } = loadGame();
  const rounds = CL.content.get('tournaments', 'lists').rounds.map((r) => r.style);
  assert.deepEqual(JSON.parse(JSON.stringify(rounds)), ['rusher', 'shield_wall', 'counter']);
  for (const s of rounds) assert.equal(CL.content.table('fighting_styles')[s].duel, true);
  // A bout's fighter fights in the round's style.
  const { CL: L2 } = scene([]);
  L2.combat.startBattle({ id: 'tourney_bout', name: 'bout', map: 'tourney_lists', waves: [{ mercenary: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, duel: { opponent: { name: 'Odo', troop: 'mercenary', hp: 80, damage: 10, armor: 1, style: 'counter' }, kit: { weapon: 'arming_sword' } } });
  assert.equal(L2.styles.of(L2.game.enemies[0]).id, 'counter');
});

test('detail by distance: the full style near the hero (and in a duel), the simple rule further off', () => {
  const { CL, g, h } = scene([['legionary', 150, 0, 'veteran'], ['legionary', CL0().DETAIL.radius + 400, 0, 'veteran']]);
  const [near, far] = g.enemies;
  assert.equal(CL.styles.detailed(g, near), true);
  assert.equal(CL.styles.detailed(g, far), false);
  assert.ok(CL.styles.melee(g, near, h, 0.02), 'a plan near');
  assert.equal(CL.styles.melee(g, far, h, 0.02), null, 'none far off');
  g.duel = { opponent: {} };
  assert.equal(CL.styles.detailed(g, far), true, 'a duel always');
});
function CL0() {
  return loadGame().CL.styles;
}

test('the same seed, the same fight', () => {
  const run = () => {
    const { CL, g } = scene([['legionary', 120, 0], ['spearman', 140, 40], ['looter', 130, -40], ['hunter', 260, 0]], { seed: 7 });
    g.hero.attackCooldown = 0;
    step(CL, 6);
    return JSON.stringify(g.enemies.map((e) => [Math.round(e.x), Math.round(e.y), Math.round(e.hp), e.alive]));
  };
  assert.equal(run(), run());
});
