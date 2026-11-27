// P11-13: formations and orders that hold. Slots and leash, frontage, flanks, the wedge breaking ranks,
// loose spread, the wall's shared pressure, cohesion, terrain breaks, too few to form, order states, the
// enemy's line, and the crowd effect's aimed blows (docs/NEXT-TASKS.md P11-13).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const BATTLE = { id: 't', name: 't', map: 'open_country', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } };

/** A battle with the company's foot (troop ids) on Hold in a formation, standing in their slots; one far-off looter. */
function held(CL, troops, kind = 'line', order = 'hold') {
  const c = CL.campaign;
  c.roster = [];
  for (const t of troops) CL.save.addSoldier(c, t);
  CL.combat.startBattle(BATTLE);
  const g = CL.game;
  const foot = g.allies.filter((a) => !a.companion && a.role === 'infantry');
  for (const [i, u] of foot.entries()) Object.assign(u, { x: 400, y: 300 + i * 30, holdX: 400, holdY: 300 + i * 30 });
  g.orders.infantry = order;
  CL.formations.set(g, kind, true, 'infantry');
  for (const u of foot) Object.assign(u, { x: u.holdX, y: u.holdY });
  for (const e of g.enemies) Object.assign(e, { x: 1400, y: 300 });
  CL.formations.tick(g, 1);
  return { g, foot, F: CL.formations };
}

const enemy = (CL, troop, x, y) => {
  const e = CL.units.makeUnit(x, y, 'enemy', troop);
  e.face = 'left';
  CL.game.enemies.push(e);
  return e;
};

test('slots and leash: on Hold a formed soldier fights only near its slot and never steps out of its leash; loose chases', () => {
  for (const [kind, leashed] of [
    ['line', true],
    ['loose', false],
  ]) {
    const { CL } = loadGame({ seed: 3 });
    const { g, foot, F } = held(CL, Array(6).fill('footman'), kind);
    const u = foot[2];
    const home = { x: u.holdX, y: u.holdY };
    // A foe 80 px in front of the slot, standing: both go for it; the line only as far as its leash.
    const e = enemy(CL, 'looter', home.x + 80, home.y);
    e.speed = 0; // it stands
    for (let i = 0; i < 60; i++) {
      u.target = e;
      u.aiTimer = 1;
      CL.combat.ai(u, 0.05);
    }
    const away = Math.hypot(u.x - home.x, u.y - home.y);
    if (leashed) {
      assert.equal(F.leash(g, u), F.LEASH.line);
      assert.ok(away <= F.LEASH.line + 1e-6, `a line soldier stays within its leash (${away.toFixed(0)} px)`);
    } else {
      assert.equal(F.leash(g, u), null);
      assert.ok(away > F.LEASH.line + 4, `a loose soldier goes all the way (${away.toFixed(0)} px)`);
    }
    // Further off (beyond the leash and reach of the slot): the line soldier lets it be; loose, it was 85 px.
    Object.assign(u, { x: home.x, y: home.y });
    Object.assign(e, { x: home.x + 100 });
    for (let i = 0; i < 40; i++) {
      u.target = e;
      CL.combat.ai(u, 0.05);
    }
    if (leashed) assert.ok(Math.hypot(u.x - home.x, u.y - home.y) < 6, 'stays in its slot');
  }
});

test('frontage: a sweep meets one soldier of a formed line from the front; from the flank it strikes more', () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'line');
  const [v] = foot;
  const front = { x: v.x + 40, y: v.y, team: 'enemy' };
  const side = { x: v.x, y: v.y - 40, team: 'enemy' };
  assert.equal(F.frontage(g, v, front), false, 'the front meets one blow a slot');
  assert.equal(F.frontage(g, v, side), true, 'from the side a sweep goes on');
  F.set(g, 'loose', true, 'infantry');
  CL.formations.tick(g, 1);
  assert.equal(F.frontage(g, v, front), true, 'loose: as before');
});

test('flanks: a formed division struck from the side or rear takes more and is shaken more; a square has no flank', () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'line');
  const v = foot[0];
  const front = { x: v.x + 40, y: v.y, team: 'enemy' };
  const rear = { x: v.x - 40, y: v.y, team: 'enemy' };
  const side = { x: v.x, y: v.y + 40, team: 'enemy' };
  assert.equal(F.flankOf(g, v, front), 1);
  assert.equal(F.flankOf(g, v, side), F.FLANK.line);
  assert.equal(F.flankOf(g, v, rear), F.FLANK.line);
  // The blow itself: the same raw damage from the rear lands harder than from the front.
  const a = enemy(CL, 'reaver', v.x + 40, v.y);
  const b = enemy(CL, 'reaver', v.x - 40, v.y);
  v.guard = false;
  const hp0 = v.hp;
  CL.combat.hit(v, 10, a);
  const fromFront = hp0 - v.hp;
  const hp1 = v.hp;
  CL.combat.hit(v, 10, b);
  assert.ok(hp1 - v.hp > fromFront, `rear ${hp1 - v.hp} > front ${fromFront}`);
  assert.equal(v.formFlankedAt, g.t, 'marked for morale');
  F.set(g, 'square', true, 'infantry');
  CL.formations.tick(g, 1);
  assert.equal(F.flankOf(g, v, rear), 1, 'a square faces every way');
  assert.equal(F.flankOf(g, v, side), 1);
});

test("the wedge's first blow into a formed line breaks the struck soldiers' ranks for a time", () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'line');
  const v = foot[2];
  assert.equal(F.formed(g, v), 'line');
  const n = F.breakRanks(g, v);
  assert.ok(n >= 2, `the struck soldier and the ones beside (${n})`);
  assert.equal(F.formed(g, v), null, 'broken');
  assert.equal(F.of(g, v), 'line', 'still in its place in the shape');
  g.t += F.WEDGE.breaks + 0.1;
  assert.equal(F.formed(g, v), 'line', 'formed again');
});

test('loose ranks are wider: arrows find fewer', () => {
  const { CL } = loadGame();
  const { g, foot } = held(CL, Array(6).fill('footman'), 'loose', 'follow');
  const ys = [...new Set(foot.map((u) => Math.round(CL.groups.followSlot(g, u).y)))].sort((p, q) => p - q);
  assert.equal(ys[1] - ys[0], CL.groups.FORM.fileGap);
  assert.ok(CL.groups.FORM.fileGap >= 36);
  assert.equal(CL.divisions.shape('loose', 1, 6).dy - CL.divisions.shape('loose', 0, 6).dy, 36);
});

test("a shield wall shares a blocked blow's pressure with the shields beside it", () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'wall');
  const v = foot[2];
  const e = enemy(CL, 'axeman', v.x + 40, v.y);
  v.guard = true;
  v.face = 'right';
  CL.combat.hit(v, 10, e);
  const inWall = v.press;
  const beside = foot.filter((w) => w !== v && w.press > 0);
  assert.ok(beside.length >= 1, 'the shields beside take part of it');
  F.set(g, 'loose', true, 'infantry');
  CL.formations.tick(g, 1);
  v.press = 0;
  v.guard = true;
  CL.combat.hit(v, 10, e);
  assert.ok(inWall < v.press, `in the wall ${inWall} < alone ${v.press}`);
});

test('cohesion: the share in their slots; scattered, the formation lapses and the order says moving', () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'wall');
  assert.equal(g.formState.ally.infantry.cohesion, 1);
  assert.equal(g.orderState.infantry.state, 'holding');
  for (const [i, u] of foot.slice(0, 4).entries()) Object.assign(u, { x: u.holdX - 200 - i * 10 });
  F.tick(g, 1);
  assert.ok(g.formState.ally.infantry.cohesion < F.COHESION.formed);
  assert.equal(F.formed(g, foot[5]), null, 'its effects lapse');
  assert.equal(F.guard(g, foot[5], []), false);
  assert.equal(g.orderState.infantry.state, 'moving');
});

test('terrain: thick trees break a formation, not a column; a ford breaks every one', () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(6).fill('footman'), 'line');
  const u = foot[0];
  g.battleMap = { ...g.battleMap, obstacles: [0, 1, 2].map((i) => ({ shape: 'circle', x: u.x + 30, y: u.y - 30 + i * 30, r: 10, look: 'tree', blocksArrows: true })) };
  F.tick(g, 1);
  assert.equal(u.dense, true);
  assert.equal(F.of(g, u), 'loose', 'in the trees');
  F.set(g, 'column', true, 'infantry');
  F.tick(g, 1);
  assert.equal(F.of(g, u), 'column', 'a column marches through');
});

test("too few to form: three stay loose, and the order's state says why", () => {
  const { CL, uiCalls } = loadGame();
  const { g, foot, F } = held(CL, Array(3).fill('footman'), 'wall');
  assert.equal(F.of(g, foot[0]), 'loose');
  assert.equal(g.orderState.infantry.state, 'cant');
  assert.match(g.orderState.infantry.reason, /too few/);
  F.set(g, 'wall', false, 'infantry');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /too few to form one/.test(x[1])));
});

test("order states: holding, following, charging, waiting, done, and can't with the reason", () => {
  const { CL } = loadGame();
  const { g, F } = held(CL, Array(6).fill('footman'), 'line');
  assert.equal(g.orderState.infantry.state, 'holding');
  assert.equal(g.orderState.infantry.word, 'holding');
  g.orders.infantry = 'charge';
  F.tick(g, 1);
  assert.equal(g.orderState.infantry.state, 'cant', 'a line on Charge');
  assert.equal(g.orderState.infantry.reason, 'a line forms on Hold or Follow');
  F.set(g, 'loose', true, 'infantry');
  F.tick(g, 1);
  assert.equal(g.orderState.infantry.state, 'charging');
  g.timed = [{ div: 'infantry', kind: 'charge', at: g.t + 5 }];
  F.tick(g, 1);
  assert.equal(g.orderState.infantry.state, 'waiting');
  g.timed = [];
  g.orders.infantry = 'hold';
  g.doneAt = { infantry: g.t };
  F.tick(g, 1);
  assert.equal(g.orderState.infantry.state, 'done');
  // An impossible formation: archers can't make a wall; the reason is kept a few seconds.
  g.group = 'infantry';
  assert.equal(F.set(g, 'phalanx', true), false);
  F.note(g, 'infantry', "can't form a square");
  F.tick(g, 1);
  assert.equal(g.orderState.infantry.state, 'cant');
  assert.equal(g.orderState.infantry.reason, "can't form a square");
});

test('the enemy plans by the same choices as the company (P11-14): a wedge when much the stronger, loose between with its horse held, a wall or a square when the weaker', () => {
  /** An army band against a company; returns the battle. */
  const army = (company, troops) => {
    const { CL } = loadGame({ seed: 5 });
    const c = CL.campaign;
    c.roster = [];
    for (const [t, n] of Object.entries(company)) for (let i = 0; i < n; i++) CL.save.addSoldier(c, t);
    c.world.location = null;
    CL.game.mode = 'map';
    const p = CL.parties.spawn(c, 'bandits');
    Object.assign(p, { troops, x: c.world.x, y: c.world.y });
    CL.parties.open(p.id);
    CL.combat.startBattle(CL.parties.current().def);
    return { CL, g: CL.game };
  };
  // Much the stronger: it charges in a wedge.
  let { CL, g } = army({ levy: 4 }, { reaver: 18, looter: 12 });
  assert.equal(g.enemyOrders.infantry, 'charge');
  assert.equal(g.enemyFormations.infantry, 'wedge');
  const foot = g.enemies.find((x) => x.role === 'infantry');
  CL.formations.tick(g, 1);
  assert.equal(CL.formations.of(g, foot), 'wedge', 'formed on Charge');
  // Between: loose ranks, its horse held until its first volley (or a few seconds).
  ({ CL, g } = army({ footman: 12, hunter: 6 }, { reaver: 12, rider: 6, hunter: 6 }));
  assert.equal(g.enemyFormations.infantry, 'loose');
  assert.equal(g.enemyOrders.cavalry, 'hold');
  g.enemyVolley = g.t;
  CL.combat.update(0.02);
  assert.equal(g.enemyOrders.cavalry, 'charge', 'in on the volley');
  // The weaker against a company with horse: it holds in a square.
  ({ CL, g } = army({ footman: 30, hunter: 10, rider: 20 }, { looter: 22 }));
  assert.equal(g.enemyOrders.infantry, 'hold');
  assert.equal(g.enemyFormations.infantry, 'square');
});

test('the crowd effect: a soldier aims its blow at its foe, not along one of four facings', () => {
  for (const aimed of [true, false]) {
    const { CL } = loadGame();
    CL.combat.USE_AIM.on = aimed;
    CL.combat.startBattle(BATTLE);
    const g = CL.game;
    const s = CL.units.makeUnit(400, 300, 'ally', 'spearman');
    // A foe 35° off the facing: outside a spear's 40° thrust from the four facings.
    const e = CL.units.makeUnit(400 + Math.cos(0.61) * 55, 300 + Math.sin(0.61) * 55, 'enemy', 'looter');
    g.allies = [s];
    g.enemies = [e];
    s.target = e;
    s.face = 'right';
    e.speed = 0;
    s.attackCooldown = 0;
    CL.combat.startAttack(s);
    const hp = e.hp;
    for (let i = 0; i < 30 && s.swing; i++) {
      g.t += 0.02;
      CL.units.swingPhase(s);
      s.swing.t += 0.02;
      if (CL.units.swingPhase(s) === 'active') CL.combat.ai(s, 0);
    }
    if (aimed) assert.ok(e.hp < hp, 'struck');
    else assert.equal(e.hp, hp, 'missed (as before 5.13)');
  }
});

test('the points hold them off: a formed long weapon pushes a shorter foe back to its reach', () => {
  const { CL } = loadGame();
  const { g, foot, F } = held(CL, Array(5).fill('spearman'), 'line');
  const u = foot[0];
  const e = enemy(CL, 'looter', u.x + 50, u.y);
  assert.equal(F.atBay(g, u, e), true);
  assert.ok(Math.abs(e.x - u.x - (u.reach - F.BAY.margin)) < 2, `pushed to ${(e.x - u.x).toFixed(0)}`);
  Object.assign(e, { x: u.x + 20 });
  assert.equal(F.atBay(g, u, e), false, 'already inside its own reach: no');
});
