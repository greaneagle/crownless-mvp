// P7-11 battle extras: the infantry's formations (shield wall, wedge), the lie of the land (high ground on
// the hill slopes, a ford breaking formations) and one objective (protect the escort's wagon). The
// measured differences, each on its own, are in tests/slow/battle-extras.test.js (scripts/extras.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const BATTLE = (waves, extra = {}) => ({ id: 't', name: 't', map: 'open_country', waves, reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, ...extra });

/** A battle with the given company (troop ids), in the given setup. */
function battle(CL, company, waves = [{ looter: 3 }], { preset = null, extra = {} } = {}) {
  const c = CL.campaign;
  c.roster = [];
  for (const t of company) CL.save.addSoldier(c, t);
  const enc = BATTLE(waves, extra);
  const plan = preset ? CL.prep.plan(preset, CL.arena.mapFor(enc.map)) : null;
  CL.combat.startBattle(enc, { plan });
  return CL.game;
}

const foot = (g) => g.allies.filter((a) => a.role === 'infantry' && !a.companion);

test('a formation holds only where it can: the wall on Hold and Follow, the wedge on Follow and Charge, never in the water', () => {
  const { CL } = loadGame();
  const g = battle(CL, ['footman', 'footman', 'hunter', 'rider']);
  const F = CL.formations;
  const [u] = foot(g);
  assert.equal(g.formation, 'loose', 'every battle starts loose');
  assert.equal(F.of(g, u), 'loose');
  F.set(g, 'wall');
  for (const [order, want] of [['hold', 'wall'], ['follow', 'wall'], ['charge', 'loose']]) {
    g.orders.infantry = order;
    assert.equal(F.of(g, u), want, `wall on ${order}`);
  }
  F.set(g, 'wedge');
  for (const [order, want] of [['hold', 'loose'], ['follow', 'wedge'], ['charge', 'wedge']]) {
    g.orders.infantry = order;
    assert.equal(F.of(g, u), want, `wedge on ${order}`);
  }
  // Infantry only: not the archers, riders or the hero.
  for (const v of [g.hero, ...g.allies.filter((a) => a.role !== 'infantry')]) assert.equal(F.of(g, v), 'loose', v.role);
  // A soldier falling back or running is out of it.
  u.morale = 'fallback';
  assert.equal(F.of(g, u), 'loose');
  u.morale = null;
  // Wading breaks it (the river ford's shallows), and USE switches it off for measuring.
  g.battleMap = { ...g.battleMap, slow: [{ x: u.x - 10, y: u.y - 10, w: 20, h: 20, factor: 0.5 }] };
  assert.equal(F.of(g, u), 'loose', 'in the water');
  F.USE.fordBreaks = false;
  assert.equal(F.of(g, u), 'wedge');
  F.USE.wedge = false;
  assert.equal(F.of(g, u), 'loose');
});

test('the battle setups: Defensive starts in a shield wall closed up on Hold; the others start loose', () => {
  const { CL } = loadGame();
  for (const [preset, want] of [['balanced', 'loose'], ['aggressive', 'loose'], ['custom', 'loose'], ['defensive', 'wall']]) {
    const g = battle(CL, ['footman', 'footman', 'footman', 'levy', 'levy', 'hunter'], [{ looter: 3 }], { preset });
    assert.equal(g.formation, want, preset);
  }
  // Defensive's wall closes up: the files 22 px apart (28 loose) in one line.
  const g = CL.game;
  const ys = foot(g)
    .map((u) => u.holdY)
    .sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i] - ys[i - 1] - CL.formations.WALL.fileGap) < 1e-9, `files ${ys[i] - ys[i - 1]} apart`);
  assert.equal(new Set(foot(g).map((u) => u.holdX)).size, 1, 'one rank');
});

test('Orders: the formation buttons set it, say so, and an order of Hold closes a wall up', () => {
  const { CL, uiCalls } = loadGame();
  const g = battle(CL, ['footman', 'footman', 'footman']);
  g.orders.infantry = 'charge';
  assert.equal(CL.formations.set(g, 'wall'), true);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === 'Infantry: shield wall: it forms on Hold or Follow'));
  assert.equal(CL.formations.set(g, 'phalanx'), false, 'no such formation'); // (a square is one from P9-B4)
  for (const [i, u] of foot(g).entries()) Object.assign(u, { x: 300 + i * 90, y: 400 + i * 60 });
  CL.combat.order('infantry', 'hold');
  const pts = foot(g).map((u) => [u.holdX, u.holdY]);
  assert.equal(new Set(pts.map((p) => p[0])).size, 1, 'closed up into one line');
  const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  assert.ok(Math.abs(ys[2] - ys[0] - 2 * CL.formations.WALL.fileGap) < 1e-9);
});

test('the shield wall: slower, shields up while a foe is near in front, striking over them, and wider cover on both sides', () => {
  const { CL } = loadGame();
  const g = battle(CL, ['footman', 'footman', 'levy']);
  const F = CL.formations;
  F.set(g, 'wall', true);
  g.orders.infantry = 'hold';
  const [a, b] = foot(g);
  assert.equal(F.speed(g, a), F.WALL.speed);
  // A foe standing in front, not swinging: an ordinary soldier keeps the shield down, the wall raises it.
  const e = g.enemies[0];
  Object.assign(a, { x: 500, y: 500, face: 'right' });
  Object.assign(e, { x: 560, y: 500, swing: null });
  assert.equal(CL.groups.shouldGuard(a, [e]), false, 'no swing at it');
  assert.equal(F.guard(g, a, [e]), true, 'the wall keeps its shield up');
  assert.equal(F.strikesOver(g, a), true);
  F.set(g, 'loose', true);
  assert.equal(F.guard(g, a, [e]), false);
  assert.equal(F.strikesOver(g, a), false);
  // Cover: a loose shield covers 34 px on its left only; the wall 46 px on either side.
  F.set(g, 'wall', true);
  a.guard = true;
  Object.assign(b, { x: 500, y: 540, face: 'right', guard: false }); // on a's right (facing right, left is up)
  assert.equal(CL.groups.coverFor(b, e, [a, b]), a, 'the wall covers its right too, and 40 px off');
  F.set(g, 'loose', true);
  assert.equal(CL.groups.coverFor(b, e, [a, b]), null, 'a loose shield does not');
  Object.assign(b, { y: 470 });
  assert.equal(CL.groups.coverFor(b, e, [a, b]), a, 'loose: the left side, close by');
  // A levy has no shield: the wall changes nothing for its guard.
  F.set(g, 'wall', true);
  const levy = foot(g).find((u) => u.troop === 'levy');
  Object.assign(levy, { x: 500, y: 500, face: 'right' });
  assert.equal(F.guard(g, levy, [e]), false);
});

test('a shield wall raises its shields against archers in front of it, in their range', () => {
  const { CL } = loadGame();
  const g = battle(CL, ['footman'], [{ crossbowman: 1 }]);
  CL.formations.set(g, 'wall', true);
  g.orders.infantry = 'hold';
  const [a] = foot(g);
  const xbow = g.enemies[0];
  Object.assign(a, { x: 400, y: 500, face: 'right' });
  Object.assign(xbow, { x: 400 + xbow.ranged.range, y: 500 });
  assert.equal(CL.formations.guard(g, a, [xbow]), true);
  Object.assign(xbow, { x: 400 + xbow.ranged.range + 60 });
  assert.equal(CL.formations.guard(g, a, [xbow]), false, 'out of range');
  Object.assign(xbow, { x: 400 - 150 });
  assert.equal(CL.formations.guard(g, a, [xbow]), false, 'behind: no use');
});

test('the wedge: quicker, a point ahead on Follow, no shield cover, and a first blow that lands harder and shakes the foe, once', () => {
  const { CL } = loadGame({ random: () => 0.5 });
  const g = battle(CL, ['footman', 'footman', 'footman', 'footman', 'footman']);
  const F = CL.formations;
  F.set(g, 'wedge', true);
  g.orders.infantry = 'follow';
  const units = foot(g);
  const [u] = units;
  assert.equal(F.speed(g, u), F.WEDGE.speed);
  // On Follow, a point: the first ahead, the rest in pairs a step further back each.
  const slots = units.map((v) => CL.groups.followSlot(g, v));
  assert.ok(slots[0].x > slots[1].x && slots[1].x === slots[2].x && slots[2].x > slots[3].x, 'a point');
  assert.equal(slots[1].y + slots[2].y, 2 * g.hero.y, 'pairs either side');
  // No cover given or taken.
  units[1].guard = true;
  assert.equal(F.cover(g, units[1], u), null);
  // The first blow: ×1.3 and a flank shock; then ordinary until it draws off again.
  const e = g.enemies[0];
  Object.assign(e, { x: 600, y: 600, hp: 100, maxhp: 100, armor: 0, guard: false });
  Object.assign(u, { x: 300, y: 600, face: 'right', target: e });
  F.arm(g, u);
  assert.equal(u.wedgeArmed, true, 'far from its foe: ready');
  Object.assign(u, { x: 560, damage: 10, moraleMul: 1 });
  g.t = 5;
  const before = e.hp;
  // A swing in its active part lands in the AI's next step.
  u.swing = { t: CL.units.SWING.windup + 0.01, hit: [] };
  CL.combat.ai(u, 1e-6);
  assert.equal(before - e.hp, 13, 'ten raw ×1.3, no armour');
  assert.equal(e.flankedAt, g.t, 'shaken as by a flank blow');
  assert.equal(u.wedgeArmed, false, 'used');
  u.swing = { t: CL.units.SWING.windup + 0.01, hit: [] };
  CL.combat.ai(u, 1e-6);
  assert.equal(before - e.hp, 23, 'the next blow is an ordinary one');
});

test('the hill slopes: three rises, the company forming up on its knoll, archers there shooting 25% further and holding it', () => {
  const { CL } = loadGame();
  const m = CL.arena.mapFor('hill_slopes');
  assert.equal(m, CL.arena.mapFor('hill_slopes'), 'built once');
  assert.deepEqual(JSON.stringify(CL.arena.hills(3, 17).high), JSON.stringify(m.high), 'the same every time');
  assert.equal(m.high.length, 3);
  assert.equal(m.ground.rises, m.ground.rises);
  for (const r of m.high) assert.ok(m.obstacles.every((o) => ((o.x - r.x) / r.rx) ** 2 + ((o.y - r.y) / r.ry) ** 2 > 1), 'nothing grows on a rise');
  assert.equal(CL.content.get('battle_maps', 'hill_slopes').small, 'grass_field');
  // The setups put the archers on the knoll, and they hold it (Custom is left alone).
  for (const preset of ['balanced', 'defensive', 'aggressive']) {
    const p = CL.prep.plan(preset, m);
    CL.game.battleMap = m;
    assert.ok(CL.formations.highAt(p.anchors.archer.x, p.anchors.archer.y), `${preset}: archers on the knoll`);
    assert.equal(p.orders.archer, 'hold', preset);
  }
  assert.equal(CL.prep.plan('custom', m, { custom: { archer: { dx: -90, dy: 0, order: 'follow' } } }).orders.archer, 'follow');
  assert.equal(CL.prep.plan('balanced', CL.arena.mapFor('open_country')).orders.archer, 'follow', 'elsewhere as before');
  // Range: 25% further on a rise, as before off it; and the switch for measuring.
  const g = battle(CL, ['hunter'], [{ looter: 1 }], { extra: { map: 'hill_slopes' } });
  const [a] = g.allies.filter((x) => x.role === 'archer');
  const [top] = m.high;
  Object.assign(a, { x: top.x, y: top.y });
  assert.equal(CL.formations.rangeOf(a), a.ranged.range * 1.25);
  Object.assign(a, { x: top.x + top.rx + 40 });
  assert.equal(CL.formations.rangeOf(a), a.ranged.range);
  Object.assign(a, { x: top.x });
  CL.formations.USE.hill = false;
  assert.equal(CL.formations.rangeOf(a), a.ranged.range);
  CL.formations.USE.hill = true;
  // A shot from the knoll at a foe beyond the ordinary range flies.
  const e = g.enemies[0];
  Object.assign(e, { x: a.x + a.ranged.range + 40, y: a.y });
  a.attackCooldown = 0;
  assert.equal(CL.combat.startAttack(a), true);
  assert.equal(g.arrows.length, 1, 'loosed from the high ground');
  Object.assign(a, { x: top.x + top.rx + 40, attackCooldown: 0 });
  Object.assign(e, { x: a.x + a.ranged.range + 40 });
  g.arrows = [];
  CL.combat.startAttack(a);
  assert.equal(g.arrows.length, 0, 'out of range from the flat');
});

// ---- The objective: protect the wagon ----

const S = (CL, id) => CL.content.get('settlements', id);

/** An escort contract taken at Stonebridge, and its ambush sprung (the encounter open). */
function ambushed(CL) {
  const c = CL.campaign;
  c.food = 999;
  const o = CL.contracts.offerAt(c, 'stonebridge', 'escort');
  const sb = S(CL, 'stonebridge');
  Object.assign(o, { to: 'oakford', x: sb.mapX + 2, y: sb.mapY });
  assert.equal(CL.contracts.accept(c, 'stonebridge', 'escort').ok, true);
  const k = c.contract;
  const ambush = CL.parties.find(c, k.ambushId);
  Object.assign(c.world, { x: ambush.x, y: ambush.y, location: null });
  CL.game.mode = 'map';
  CL.parties.open(ambush.id);
  return { c, k, ambush, caravan: CL.parties.find(c, k.partyId) };
}

test('an escort ambush has the wagon: an obstacle on this battle’s own copy of the map, behind the company; the raiders burst out close by', () => {
  const { CL, uiCalls } = loadGame();
  const { c } = ambushed(CL);
  const e = CL.parties.current();
  assert.equal(e.def.objective, 'wagon');
  assert.match(e.text, /if it burns, or you lose, the caravan is lost/);
  const shared = CL.arena.mapFor(e.def.map);
  const count = shared.obstacles.length;
  for (const t of ['footman', 'footman', 'hunter']) CL.save.addSoldier(c, t);
  CL.parties.attack();
  const g = CL.game;
  const w = g.wagon;
  assert.ok(w?.alive);
  assert.equal(w.hp, CL.objective.WAGON.hp);
  assert.equal(shared.obstacles.length, count, 'the shared map is untouched');
  assert.equal(g.battleMap.obstacles.length, count + 1);
  assert.equal(g.battleMap.obstacles.at(-1).look, 'wagon');
  assert.ok(w.x < g.hero.x, 'behind the hero');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Keep the Reavers off the wagon/.test(x[1])));
  // The front bursts from cover close ahead; every third is a wagon-raider, from behind on the flank.
  const raiders = g.enemies.filter((x) => x.raider);
  assert.equal(raiders.length, Math.floor(g.enemies.length / 3));
  for (const x of g.enemies) {
    if (x.raider) assert.ok(x.x < w.x, 'a raider starts behind the wagon');
    else assert.ok(x.x - g.battleMap.spawn.hero.x < 700, 'the front starts close');
  }
  // A raider goes for the wagon, unless someone blocks its way; the rest for the company.
  const r = raiders[0];
  for (const [i, a] of g.allies.entries()) Object.assign(a, { x: 3000 + i * 40, y: 300 });
  Object.assign(g.hero, { x: 3000, y: 400 });
  r.aiTimer = 0;
  CL.combat.ai(r, 0.001);
  assert.equal(r.target, w, 'out for the wagon');
  const blocker = g.allies[0];
  Object.assign(blocker, { x: r.x + 40, y: r.y });
  r.aiTimer = 0;
  CL.combat.ai(r, 0.001);
  assert.equal(r.target, blocker, 'fights who stands in its way');
  // Other battles have no wagon.
  CL.game.mode = 'map';
  const g2 = battle(CL, ['footman']);
  assert.equal(g2.wagon, null);
  assert.ok(g2.enemies.every((x) => !x.raider));
});

test('your soldiers mind the wagon: a raider by it counts as nearer, and they go back for it from further', () => {
  const { CL } = loadGame();
  const g = battle(CL, ['footman'], [{ looter: 2 }], { extra: { objective: 'wagon' } });
  const w = g.wagon;
  const [u] = foot(g);
  const [near, atWagon] = g.enemies;
  Object.assign(u, { x: w.x + 300, y: w.y });
  Object.assign(near, { x: u.x + 150, y: u.y });
  Object.assign(atWagon, { x: w.x + 20, y: w.y + 30 });
  assert.equal(CL.objective.pick(g, u, g.enemies), atWagon);
  assert.equal(CL.objective.reach(g, atWagon, 75), CL.objective.WAGON.guardReach);
  assert.equal(CL.objective.reach(g, near, 75), 75);
  CL.objective.USE.guard = false;
  assert.equal(CL.objective.pick(g, u, g.enemies), null, 'switched off: the ordinary rule');
  assert.equal(CL.objective.reach(g, atWagon, 75), 75);
});

test('the wagon takes blows, does not budge, and burns: the message, the HUD and the result say so', () => {
  const { CL, uiCalls } = loadGame({ random: () => 0.5 });
  const g = battle(CL, ['footman'], [{ reaver: 1 }], { extra: { objective: 'wagon' } });
  const w = g.wagon;
  const at = [w.x, w.y];
  const e = g.enemies[0];
  assert.equal(CL.combat.hit(w, 30, e), 'hit');
  assert.deepEqual([w.x, w.y], at, 'no knockback');
  assert.ok(w.hp < w.maxhp);
  assert.equal(CL.objective.lost(g), false);
  assert.equal(CL.combat.hit(w, 500, e), 'down');
  assert.equal(w.alive, false);
  assert.equal(g.wagonLost, true);
  assert.equal(CL.objective.lost(g), true);
  assert.equal(CL.objective.fate(g, true), 'lost');
  assert.equal(g.kills, 0, 'not a kill');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === 'The wagon is burning! The caravan is lost'));
  e.aiTimer = 0;
  CL.combat.ai(e, 0.001);
  assert.notEqual(e.target, w, 'nobody goes for a burnt wagon');
});

test('the objective wins and loses: won with the wagon standing, the escort goes on; burned or beaten, the caravan and the contract are lost', () => {
  for (const how of ['saved', 'burned', 'beaten', 'simulated loss', 'simulated win']) {
    const { CL, uiCalls } = loadGame({ random: () => 0.5 });
    const { c, ambush, caravan } = ambushed(CL);
    for (const t of ['footman', 'footman', 'hunter']) CL.save.addSoldier(c, t);
    if (how.startsWith('simulated')) {
      const A = CL.autoresolve;
      A.next = () => (how === 'simulated win' ? 0 : 0.999);
      const r = CL.parties.autoResolve();
      assert.equal(r.win, how === 'simulated win');
      assert.match(r.html, how === 'simulated win' ? /The wagon came through/ : /The wagon is lost/);
    } else {
      CL.parties.attack();
      if (how === 'burned') CL.combat.hit(CL.game.wagon, 9999, CL.game.enemies[0]);
      CL.debugTools.endBattleNow(how !== 'beaten');
      assert.match(CL.game.result.html, how === 'saved' ? /The wagon came through/ : /The wagon is lost/);
    }
    CL.world.returnToMap();
    const kept = how === 'saved' || how === 'simulated win';
    assert.equal(c.contract?.status ?? null, kept ? 'active' : null, how);
    assert.equal(c.parties.includes(ambush), false, `${how}: the ambush is gone either way`);
    assert.equal(c.parties.includes(caravan), kept, `${how}: the caravan`);
    assert.equal(uiCalls.some((x) => x[0] === 'message' && /The caravan bound for Oakford is lost\. Your contract from Stonebridge has failed/.test(x[1])), !kept, `${how}: told`);
  }
});

test('the wagon-raiders lie in wait until the band’s front closes with the company, or one of them is found', () => {
  const { CL } = loadGame();
  const g = battle(CL, ['footman', 'footman'], [{ looter: 6 }], { extra: { objective: 'wagon' } });
  const raider = g.enemies.find((e) => e.raider);
  const front = g.enemies.find((e) => !e.raider);
  assert.ok(raider && front);
  assert.equal(CL.objective.sprung(g), false, 'at the start they wait');
  const at = [raider.x, raider.y];
  raider.aiTimer = 0;
  for (let i = 0; i < 20; i++) CL.combat.ai(raider, 0.05);
  assert.deepEqual([raider.x, raider.y], at, 'still in cover');
  Object.assign(front, { x: g.hero.x + 60, y: g.hero.y });
  assert.equal(CL.objective.sprung(g), true, 'the front has closed: they spring');
  for (let i = 0; i < 20; i++) CL.combat.ai(raider, 0.05);
  assert.notDeepEqual([raider.x, raider.y], at, 'and go');
  // Found first: one of them is hit.
  const g2 = battle(CL, ['footman'], [{ looter: 6 }], { extra: { objective: 'wagon' } });
  const r2 = g2.enemies.find((e) => e.raider);
  CL.combat.hit(r2, 5, g2.hero);
  assert.equal(CL.objective.sprung(g2), true);
});
