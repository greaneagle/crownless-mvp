// P9-B4 (D-P9e): command in layers. Divisions (the default split, your choices, kept with the save),
// orders and formations per division, layer 1's plan for both sides, layer 3's captains and plans of
// your own, and layer 4's live and timed orders on the tactical map.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { headlessUi } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company of `mix` (troop → count) and a band beside it, its encounter open. */
function setup(mix, troops = { looter: 10 }, { size = 150 } = {}) {
  const { CL } = loadGame({ seed: 77 });
  CL.ui = headlessUi(CL);
  CL.combat.setActiveCap(size);
  const c = CL.campaign;
  c.roster = [];
  for (const [t, n] of Object.entries(mix)) for (let i = 0; i < n; i++) CL.save.addSoldier(c, t);
  c.world.location = null;
  c.parties = c.parties.filter((p) => Math.hypot(p.x - c.world.x, p.y - c.world.y) > 40);
  CL.game.mode = 'map';
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { troops: { ...troops }, x: c.world.x, y: c.world.y });
  CL.parties.open(p.id);
  return { CL, c, g: CL.game, D: CL.divisions };
}

test('the default split: a division a role; a role of more than 30 splits into two, one each in turn', () => {
  const small = setup({ footman: 12, hunter: 6, rider: 4 });
  small.CL.parties.attack();
  assert.deepEqual(plain(small.D.present(small.g)), ['infantry', 'archer', 'cavalry'], 'as before: the roles');
  const big = setup({ footman: 40, hunter: 10 });
  const plan = big.D.plan(big.c, big.c.roster);
  const foot = big.c.roster.filter((s) => s.troop === 'footman').map((s) => plan.get(s.id));
  assert.equal(foot.filter((d) => d === 'infantry').length, 20);
  assert.equal(foot.filter((d) => d === 'infantry2').length, 20);
  assert.equal(foot[0], 'infantry');
  assert.equal(foot[1], 'infantry2');
  assert.ok(big.c.roster.filter((s) => s.troop === 'hunter').every((s) => plan.get(s.id) === 'archer'));
});

test('your choices: a troop type, a soldier, a name; kept with the save, and a soldier gone is forgotten', () => {
  const { CL, c, D } = setup({ footman: 6, guard: 4, hunter: 4 });
  assert.equal(D.assign(c, 'troop', 'guard', 'infantry2'), true);
  const h = c.roster.find((s) => s.troop === 'hunter');
  assert.equal(D.assign(c, 'soldier', h.id, 'archer2'), true);
  assert.equal(D.assign(c, 'troop', 'guard', 'dragoons'), false, 'only the six slots');
  assert.equal(D.rename(c, 'infantry2', '  The Old Guard <b> '), true);
  assert.equal(D.name(c, 'infantry2'), 'The Old Guard b');
  const plan = D.plan(c, c.roster);
  assert.ok(c.roster.filter((s) => s.troop === 'guard').every((s) => plan.get(s.id) === 'infantry2'));
  assert.equal(plan.get(h.id), 'archer2');
  // The save.
  const gone = c.roster.find((s) => s.troop === 'footman');
  D.assign(c, 'soldier', gone.id, 'infantry2');
  c.roster = c.roster.filter((s) => s !== gone);
  const back = CL.save.sanitize(plain(c));
  assert.equal(back.divisions.names.infantry2, 'The Old Guard b');
  assert.equal(back.divisions.troops.guard, 'infantry2');
  assert.equal(back.divisions.soldiers[h.id], 'archer2');
  assert.equal(back.divisions.soldiers[gone.id], undefined, 'a soldier no longer with you');
  // Junk is dropped; nothing chosen, nothing saved.
  const junk = CL.save.sanitize({ ...plain(c), divisions: { names: { infantry: 5, wizards: 'x' }, troops: { nobody: 'infantry', guard: 'nowhere' }, soldiers: { x: 'infantry' } } });
  assert.equal(junk.divisions, undefined);
});

test('orders by division: a second division keeps its own; its soldiers stand beside the first', () => {
  const { CL, g, D } = setup({ footman: 40, hunter: 4 }, { looter: 20 });
  CL.parties.attack();
  assert.deepEqual(plain(D.present(g)), ['infantry', 'archer', 'infantry2']);
  CL.combat.order('infantry2', 'hold');
  assert.equal(g.orders.infantry2, 'hold');
  assert.equal(g.orders.infantry, 'follow', 'the first keeps its own');
  const one = D.members(g, 'infantry')[0];
  const two = D.members(g, 'infantry2')[0];
  assert.equal(D.orderOf(g, two), 'hold');
  assert.equal(D.orderOf(g, one), 'follow');
  const a1 = CL.groups.followAnchor(g, 'infantry');
  const a2 = CL.groups.followAnchor(g, 'infantry2');
  assert.equal(a1.x, a2.x, 'the same distance ahead of the hero');
  assert.ok(a2.y > a1.y + 100, 'beside the first, not on it');
  CL.combat.order('cavalry2', 'charge');
  assert.ok(g.orders.cavalry2 !== 'charge' || !D.members(g, 'cavalry2').length, 'nobody to carry it out');
});

test('formations: each division its own; line, column and square; what a role may take; the square braces on every side', () => {
  const { CL, g, D } = setup({ footman: 12, hunter: 6, rider: 4 });
  CL.parties.attack();
  const F = CL.formations;
  assert.equal(F.set(g, 'square', true, 'infantry'), true);
  assert.equal(F.set(g, 'wall', true, 'archer'), false, 'archers carry no shields');
  assert.equal(F.set(g, 'line', true, 'archer'), true);
  assert.equal(F.chosenFor(g, 'infantry'), 'square');
  assert.equal(F.chosenFor(g, 'archer'), 'line');
  assert.equal(F.chosenFor(g, 'cavalry'), 'loose');
  const foot = D.members(g, 'infantry')[0];
  assert.equal(F.of(g, foot), 'square');
  assert.ok(F.speed(g, foot) < 0.6, 'a square is slow');
  // The square's ring: everyone about the same distance from its middle.
  const ring = Array.from({ length: 12 }, (_, i) => D.shape('square', i, 12));
  const r = ring.map((o) => Math.hypot(o.dx, o.dy));
  assert.ok(Math.max(...r) - Math.min(...r) < 1);
  // A line is wide, a column deep.
  const span = (kind) => {
    const pts = Array.from({ length: 12 }, (_, i) => D.shape(kind, i, 12));
    return { wide: Math.max(...pts.map((p) => p.dy)) - Math.min(...pts.map((p) => p.dy)), deep: Math.max(...pts.map((p) => p.dx)) - Math.min(...pts.map((p) => p.dx)) };
  };
  assert.ok(span('line').wide > span('line').deep * 3);
  assert.ok(span('column').deep > span('column').wide);
  // A rider charging a square from behind is stopped, as spears stop one from in front.
  F.set(g, 'square', true, 'infantry');
  const rider = CL.units.makeUnit(foot.x + 30, foot.y, 'enemy', 'horse_scout');
  Object.assign(rider, { momentum: 1 });
  foot.face = 'left'; // its back to the rider
  g.orders.infantry = 'hold';
  assert.ok(CL.groups.braceAgainst(g, rider, [foot], CL.combat.CAVALRY.chargeMomentum), 'braced from behind');
});

test('layer 1: Auto chooses from the odds; the enemy, when it is an army, plans by the same rules', () => {
  const strong = setup({ guard: 20, longbowman: 8 }, { looter: 6 });
  assert.equal(strong.CL.prep.autoChoice(), 'aggressive');
  const weak = setup({ levy: 3 }, { reaver: 14 });
  assert.equal(weak.CL.prep.autoChoice(), 'defensive');
  const even = setup({ levy: 6 }, { reaver: 5 }); // odds 79%: neither clearly stronger (85%) nor weaker (45%)
  assert.equal(even.CL.prep.autoChoice(), 'balanced');
  const p = weak.CL.prep.plan('auto', weak.CL.arena.mapFor('open_country'));
  assert.equal(p.preset, 'auto');
  assert.equal(p.auto, 'defensive');
  assert.equal(p.formation, 'wall');
  // The enemy's plan: an army (more than 20) much the weaker holds and forms blocks; a small band doesn't plan.
  const army = setup({ guard: 60, longbowman: 20 }, { looter: 30 });
  army.CL.parties.attack();
  assert.deepEqual(plain(army.g.enemyOrders), { infantry: 'hold', archer: 'hold', cavalry: 'hold' });
  const band = setup({ guard: 20 }, { looter: 8 });
  band.CL.parties.attack();
  assert.equal(band.g.enemyOrders, null, 'a band of 8 fights as B-01 tuned it');
  const host = setup({ levy: 10 }, { reaver: 40 });
  host.CL.parties.attack();
  assert.equal(host.g.enemyOrders.infantry, 'charge', 'the stronger army comes on');
});

test('layer 3: a captain steadies and quickens their division; plans of your own are kept and used', () => {
  const { CL, c, g, D } = setup({ footman: 8, guard: 2, hunter: 4 });
  const vet = c.roster.find((s) => s.troop === 'guard');
  vet.record.battles = 12;
  const caps = D.captains(c);
  assert.ok(caps.some((k) => k.kind === 'soldier' && k.id === vet.id), 'a veteran of tier 3 with 10 battles');
  assert.equal(caps.some((k) => k.id === c.roster.find((s) => s.troop === 'footman').id), false);
  const map = CL.arena.mapFor('open_country');
  const p = CL.prep.plan('balanced', map);
  CL.prep.setCaptain(p, 'archer', caps.find((k) => k.id === vet.id));
  CL.prep.setFacing(p, 'archer', 'up');
  CL.prep.setFormation(p, 'archer', 'line');
  CL.parties.attack(p);
  assert.equal(D.led(g, 'archer'), true);
  assert.equal(g.allies.find((a) => a.soldierId === vet.id).div, 'archer', 'the captain stands with the division they lead');
  CL.combat.update(0.3);
  const led = CL.morale.targetFor(g, 'ally', 'archer');
  assert.equal(led.parts.captain, D.CAPTAIN.morale);
  assert.equal(CL.morale.targetFor(g, 'ally', 'cavalry'), null);
  const archer = D.members(g, 'archer')[0];
  assert.ok(D.speedOf(g, archer) > 1);
  assert.equal(g.facings.archer, 'up');
  // A plan of your own: saved, then used on another field.
  CL.settings.load();
  const mine = CL.prep.plan('custom', map);
  CL.prep.setOrder(mine, 'cavalry', 'hold');
  CL.prep.setFormation(mine, 'infantry', 'line');
  assert.equal(CL.prep.savePlan(mine, map, 1, 'Hold the ridge'), true);
  const used = CL.prep.loadPlan(1, CL.arena.mapFor('forest_wilds'));
  assert.equal(used.orders.cavalry, 'hold');
  assert.equal(used.formations.infantry, 'line');
  assert.equal(CL.settings.get('prepPlans')[1].name, 'Hold the ridge');
  assert.equal(CL.prep.loadPlan(2, map), null, 'an empty slot');
});

test('layer 4: move, charge a spot, fall back, face; timed orders go off together, after a delay or on the volley', () => {
  const { CL, g, D } = setup({ footman: 10, hunter: 6, rider: 4 }, { looter: 12 });
  CL.parties.attack();
  const T = CL.tactics;
  const foot = D.members(g, 'infantry');
  const spot = { x: foot[0].x - 200, y: foot[0].y };
  // Fall back: to the spot, then hold there.
  Object.assign(g, { group: 'infantry', mapAction: 'fallback', mapTiming: 'now' });
  T.command(g, spot.x, spot.y);
  assert.equal(g.orders.infantry, 'hold');
  assert.equal(g.falling.infantry, true);
  for (const u of foot) Object.assign(u, { x: u.holdX, y: u.holdY });
  T.tickOrders(g);
  assert.equal(g.falling.infantry, undefined, 'arrived: no longer falling back');
  // Charge the enemies nearest a spot.
  const far = g.enemies[g.enemies.length - 1];
  Object.assign(g, { group: 'cavalry', mapAction: 'charge' });
  T.command(g, far.x, far.y);
  assert.equal(g.orders.cavalry, 'charge');
  assert.deepEqual(plain(g.focusAt.cavalry), { x: far.x, y: far.y });
  // Face.
  Object.assign(g, { group: 'infantry', mapAction: 'face' });
  const c0 = foot.reduce((n, u) => n + u.x, 0) / foot.length;
  T.command(g, c0, foot[0].y - 400);
  assert.equal(g.facings.infantry, 'up');
  // Timed: the archers move in 5 s; the cavalry charge on the volley.
  Object.assign(g, { group: 'archer', mapAction: 'move', mapTiming: 5 });
  const t0 = g.t;
  T.command(g, spot.x, spot.y + 100);
  Object.assign(g, { group: 'cavalry', mapAction: 'charge', mapTiming: 'volley' });
  T.command(g, far.x, far.y);
  assert.equal(g.timed.length, 2);
  g.t = t0 + 4;
  T.tickOrders(g);
  assert.equal(g.timed.length, 2, 'not yet');
  g.t = t0 + 5.01;
  T.tickOrders(g);
  assert.equal(g.timed.length, 1, 'the archers went');
  assert.equal(g.orders.archer, 'hold');
  g.lastVolley = g.t;
  T.tickOrders(g);
  assert.equal(g.timed.length, 0, 'the volley set off the cavalry');
});
