// P8-06b · The assault battle: the walled map (wall, gate, ladders, walkway, courtyard; mirrored to
// defend), the way through the wall, the ram, the setups on the walls, holding the courtyard, and the
// result feeding the siege both ways (taken, thrown back without capture, held, fallen).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { headlessUi } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));

test('the walled map: a wall across the field with a gate and one to three ladders; mirrored to defend', () => {
  const { CL } = loadGame();
  for (const n of [1, 2, 3]) {
    const m = CL.arena.assault({ ladders: n });
    const gaps = m.wall.gaps;
    assert.equal(gaps.filter((g) => g.kind === 'ladder').length, n);
    assert.equal(gaps.filter((g) => g.kind === 'gate').length, 1);
    assert.ok(m.obstacles.some((o) => o.gate), 'the gate is shut');
    const walls = m.obstacles.filter((o) => o.look === 'wall');
    assert.equal(walls.length, gaps.length + 1, 'the wall between the gaps');
    for (const g of gaps) for (const w of walls) assert.ok(g.y + g.h / 2 <= w.y || g.y - g.h / 2 >= w.y + w.h, 'no wall in a gap');
    assert.ok(m.spawn.hero.x < m.wall.x, 'attacking: you start outside');
    assert.ok(m.spawn.enemies.x0 > m.wall.x + m.wall.w, 'the defenders behind the wall');
    CL.game.battleMap = m;
    assert.equal(CL.formations.highAt(m.high[0].x, m.high[0].y), true, 'the walkway is high ground');
  }
  const d = CL.arena.assault({ ladders: 2, defend: true });
  assert.ok(d.spawn.hero.x < d.wall.x && d.wall.outside === 1, 'defending: you start in the courtyard, the attackers come from the far side');
  assert.ok(d.spawn.enemies.x0 > d.wall.x + d.wall.w);
  assert.equal(CL.arena.assault({ gateOpen: true }).obstacles.some((o) => o.gate), false, 'a broken gate');
});

test('the way through: a ladder or the broken gate, never the wall; nobody stands in it', () => {
  const { CL } = loadGame();
  const m = CL.arena.assault({ ladders: 1 });
  const w = m.wall;
  const ladder = w.gaps.find((g) => g.kind === 'ladder');
  // From outside to the courtyard: first to the ladder's foot, then through it.
  const a = CL.arena.wayThrough(m, w.x - 300, ladder.y + 200, w.x + 300, ladder.y + 150);
  assert.ok(a.x < w.x && Math.abs(a.y - ladder.y) < 1, 'to the foot of the ladder');
  const b = CL.arena.wayThrough(m, w.centre - 30, ladder.y, w.x + 300, ladder.y + 150);
  assert.ok(b.x > w.x + w.w, 'then over');
  assert.equal(CL.arena.wayThrough(m, w.x - 300, 100, w.x - 100, 900), null, 'no wall between: none');
  // The gate is a way only once broken.
  const gate = w.gaps.find((g) => g.kind === 'gate');
  const shut = CL.arena.wayThrough(m, w.x - 200, gate.y, w.x + 200, gate.y);
  assert.notEqual(shut.y, gate.y);
  const open = CL.arena.wayThrough({ ...m, gateOpen: true }, w.x - 200, gate.y, w.x + 200, gate.y);
  assert.equal(open.y, gate.y);
  // A unit walking it gets through, and is never inside the wall.
  CL.game.battleMap = m;
  const u = CL.units.makeUnit(w.x - 300, ladder.y + 260, 'ally', 'levy');
  const goal = { x: w.x + 300, y: ladder.y + 200 };
  for (let i = 0; i < 2000 && u.x < w.x + w.w + 40; i++) {
    const via = CL.arena.wayThrough(m, u.x, u.y, goal.x, goal.y) || goal;
    CL.units.move(u, via.x - u.x, via.y - u.y, 0.02);
    assert.equal(m.obstacles.some((o) => o.look === 'wall' && CL.units.inside(o, u.x, u.y)), false, 'not in the wall');
  }
  assert.ok(u.x > w.x + w.w, 'over the wall by the ladder');
});

test('the ram: attackers at the gate break it after 25 seconds; the setups make sense on the walls', () => {
  const { CL } = loadGame();
  CL.ui = headlessUi(CL);
  const g = CL.game;
  CL.combat.startBattle(CL.assault.practice(20, 'attack'));
  assert.equal(g.siege.gateOpen, false);
  const at = CL.assault.gatePoint(g);
  Object.assign(g.hero, { x: at.x, y: at.y });
  for (let t = 0; t < 26 / 0.05; t++) {
    Object.assign(g.hero, { x: at.x, y: at.y, alive: true, hp: g.hero.maxhp });
    CL.assault.update(g, 0.05);
  }
  assert.equal(g.siege.gateOpen, true);
  assert.equal(g.battleMap.obstacles.some((o) => o.gate), false, 'gone from this battle’s map');
  assert.equal(CL.arena.assault({ ladders: 2 }).obstacles.some((o) => o.gate), true, 'the shared map untouched');
  // Setups: Balanced at the ladders (attacking), Defensive on the walkway and at the gate (defending).
  const atk = CL.arena.assault({ ladders: 2 });
  const p = CL.prep.plan('balanced', atk);
  const ladder = atk.wall.gaps.find((x) => x.kind === 'ladder');
  assert.ok(Math.abs(p.anchors.infantry.y - ladder.y) < 40 && p.anchors.infantry.x < atk.wall.x, 'infantry at the ladder');
  assert.ok(p.anchors.archer.x < p.anchors.infantry.x, 'archers behind');
  assert.equal(p.orders.infantry, 'charge');
  const def = CL.arena.assault({ ladders: 2, defend: true });
  const q = CL.prep.plan('defensive', def);
  g.battleMap = def;
  assert.equal(CL.formations.highAt(q.anchors.archer.x, q.anchors.archer.y), true, 'archers on the walkway');
  const gate = def.wall.gaps.find((x) => x.kind === 'gate');
  assert.ok(Math.abs(q.anchors.infantry.y - gate.y) < 40, 'infantry at the gate');
  assert.deepEqual(plain(q.orders), { infantry: 'hold', archer: 'hold', cavalry: 'hold' });
});

/** You three days into a siege of Castra Nova for Valedorn, with `company`. */
function siege(company) {
  const { CL } = loadGame({ seed: 4242 });
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  c.roster = [];
  for (const t of company) CL.save.addSoldier(c, t);
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: 0, window: { start: 0, days: 10 } });
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const f = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: f.mapX, y: f.mapY, location: 'castra_nova' });
  const s = CL.sieges.begin(c, 'castra_nova');
  Object.assign(s, { began: c.day - 3.5, lastDay: Math.floor(c.day) });
  return { CL, c, s };
}

test('storming the walls: won, the fort is yours; lost, thrown back with your money, not captured', () => {
  // Won: the courtyard held (the hold decides it).
  const won = siege(['footman', 'footman', 'guard', 'guard', 'hunter', 'hunter']);
  won.CL.sieges.storm(won.c);
  const g = won.CL.game;
  assert.equal(g.mode, 'battle');
  assert.equal(g.siege.side, 'attack');
  assert.equal(g.siege.ladders, 3);
  assert.equal(g.siege.ram, true);
  g.siege.holdT = won.CL.assault.RULES.hold.seconds; // they hold the courtyard, two defenders left in it
  g.enemies.forEach((e, i) => {
    Object.assign(e, i < 2 ? { x: g.battleMap.wall.courtyard.x1 - 60 } : { alive: false });
  });
  for (const a of [g.hero, ...g.allies]) Object.assign(a, { x: g.battleMap.wall.courtyard.x0 + 80 });
  won.CL.combat.update(0.02);
  assert.equal(g.result.win, true);
  won.CL.world.returnToMap();
  assert.equal(won.CL.realm.owner('castra_nova', won.c), 'valedorn', 'taken');
  // Lost: thrown back.
  const lost = siege(['levy']);
  const gold = lost.c.gold;
  lost.CL.sieges.storm(lost.c);
  lost.CL.debugTools.endBattleNow(false);
  assert.equal(lost.CL.game.result.thrownBack, true);
  assert.equal(lost.c.gold, gold, 'nothing seized');
  lost.CL.world.returnToMap();
  assert.equal(lost.CL.game.releasedAt ?? null, null, 'not taken captive');
  assert.equal(lost.c.sieges.length, 0, 'the siege lifted');
  assert.equal(lost.CL.realm.owner('castra_nova', lost.c), 'aurelian');
});

test('defending the walls: in your fort when they storm it, you fight with its garrison; held, the siege lifts', () => {
  const { CL } = loadGame({ seed: 77 });
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'aurelian', since: 0, window: { start: 0, days: 10 } });
  CL.realm.transfer(c, 'castra_nova', { holder: 'player', willing: true });
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const f = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: f.mapX, y: f.mapY, location: 'castra_nova' });
  for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
  CL.lords.ensure(c, c.day, true);
  const lords = c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn').slice(0, 2);
  for (const q of lords) Object.assign(q, { x: f.mapX + 2, y: f.mapY + 2, troops: { levy: 4 } });
  const s = { id: 1, sid: 'castra_nova', realm: 'valedorn', by: 'ai', lords: lords.map((q) => q.lordId), relief: [], phase: 'encircled', began: c.day - 2, gatherBy: null, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
  c.sieges.push(s);
  const enc = CL.sieges.defend(c, s);
  const g = CL.game;
  assert.equal(g.siege.side, 'defend');
  assert.ok(g.allies.filter((a) => a.outside).length >= 10, 'the garrison beside you');
  assert.equal(enc.mapDef.wall.outside, 1);
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
  assert.equal(c.sieges.includes(s), false, 'held: the siege lifted');
  assert.equal(CL.realm.holderOf('castra_nova', c), 'player');
});

test('Simulate uses the same walls; practice assaults both ways end and change nothing', () => {
  const { CL, c, s } = siege(['footman', 'footman', 'hunter']);
  const d = CL.sieges.defence(c, s);
  assert.ok(d.wall > 1, 'the walls count in Simulate as in the fight’s preview');
  for (const side of ['attack', 'defend']) {
    const env = loadGame({ seed: 5 });
    env.CL.ui = headlessUi(env.CL);
    const before = JSON.stringify(env.CL.campaign);
    env.CL.combat.startBattle(env.CL.assault.practice(20, side));
    env.CL.debugTools.endBattleNow(true);
    assert.equal(JSON.stringify(env.CL.campaign), before, `${side}: a practice changes nothing`);
  }
});
