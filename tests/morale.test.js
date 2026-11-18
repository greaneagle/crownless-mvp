// Battle morale (V2-08b; design §8.3): groups on both sides hold, waver, fall back and rout from what
// they can see (losses, the hero, flanks, nearby routs, veterans), never from a roll; routed enemies
// count as beaten with no kill credit and half the spoils; the hero can rally the company.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A one-screen battle: the company on the left, the enemy on the right, everyone far apart. */
function scene({ company = ['footman', 'footman', 'footman', 'hunter', 'hunter'], wave = { looter: 6 }, random = () => 0.5 } = {}) {
  const env = loadGame({ random });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of company) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [wave], reward: { goldBase: 10, goldPerKill: 4, renown: 1 }, loot: 'low' });
  const g = CL.game;
  g.allies.forEach((u, i) => {
    Object.assign(u, { x: 150, y: 120 + i * 40 });
  });
  Object.assign(g.hero, { x: 190, y: 260 });
  g.enemies.forEach((u, i) => {
    Object.assign(u, { x: 820, y: 120 + i * 40 });
  });
  return { ...env, g };
}
const tick = (CL, g, n = 1) => {
  for (let i = 0; i < n; i++) CL.morale.update(g, 0.25);
};

test('a fresh group holds; its losses, a lost hero and a flank attack shake it, part by part', () => {
  const { CL, g } = scene();
  tick(CL, g);
  const fresh = CL.morale.targetFor(g, 'ally', 'infantry');
  assert.equal(g.moraleState['ally:infantry'], 'hold');
  assert.equal(fresh.parts.hero, CL.morale.TERMS.heroNear, 'the hero close by steadies them');
  assert.equal(fresh.parts.veterans, 6, 'footmen are tier 2');
  const inf = g.allies.filter((u) => u.role === 'infantry');
  inf[0].alive = false;
  inf[1].alive = false;
  const hurt = CL.morale.targetFor(g, 'ally', 'infantry');
  assert.ok(Math.abs(hurt.parts.groupLoss - -40) < 1e-9, 'two of three lost');
  assert.ok(hurt.total < fresh.total - 40);
  g.hero.alive = false;
  assert.equal(CL.morale.targetFor(g, 'ally', 'infantry').parts.hero, -CL.morale.TERMS.heroDown);
  inf[2].flankedAt = g.t;
  assert.equal(CL.morale.targetFor(g, 'ally', 'infantry').parts.flank, -CL.morale.TERMS.flank);
});

test('the states follow cohesion with a small gap before recovering, so they do not flicker', () => {
  const { CL } = loadGame();
  const s = CL.morale.stateFor;
  assert.equal(s(70, 'hold'), 'hold');
  assert.equal(s(50, 'hold'), 'waver');
  assert.equal(s(25, 'hold'), 'fallback', 'worse at once');
  assert.equal(s(10, 'waver'), 'rout');
  assert.equal(s(57, 'waver'), 'waver', 'just over the line: still wavering');
  assert.equal(s(62, 'waver'), 'hold');
  assert.equal(s(33, 'fallback'), 'fallback');
  assert.equal(s(40, 'fallback'), 'waver');
});

test('predictable, not random: the same battle gives the same morale whatever the dice say', () => {
  const run = (random) => {
    const { CL, g } = scene({ random });
    tick(CL, g);
    for (const u of g.enemies.slice(0, 3)) u.alive = false;
    tick(CL, g, 6);
    return JSON.stringify({ state: g.moraleState, c: Math.round(g.morale['enemy:infantry'].cohesion * 1000) });
  };
  assert.equal(run(() => 0.01), run(() => 0.99));
});

test('veterans are steadier: the same losses that make recruits run leave tier 3 soldiers standing', () => {
  const shaken = (troop) => {
    const { CL, g } = scene({ company: [troop, troop, troop, troop], wave: { looter: 4 } });
    tick(CL, g);
    g.hero.alive = false;
    for (const u of g.allies.slice(0, 2)) u.alive = false;
    g.morale['ally:infantry'].cohesion = null; // read the new figure straight away
    tick(CL, g);
    return { state: g.moraleState['ally:infantry'], vets: CL.morale.TERMS.tier[CL.content.troop(troop).tier] };
  };
  const levy = shaken('levy');
  const guard = shaken('guard');
  assert.equal(guard.vets - levy.vets, 14);
  assert.equal(levy.state, 'rout');
  assert.equal(guard.state, 'fallback', 'shaken, but not running');
});

test('an enemy band that has lost most of its men breaks and runs: no fighting back, then gone, beaten but not killed', () => {
  const { CL, g, uiCalls } = scene({ wave: { looter: 7 } });
  tick(CL, g); // the company and the band in sight of each other
  for (const u of g.enemies.slice(0, 5)) u.alive = false;
  g.kills = 5;
  g.morale['enemy:infantry'].cohesion = null;
  tick(CL, g);
  const left = g.enemies.filter((u) => u.alive);
  assert.equal(left.length, 2);
  assert.ok(left.every((u) => u.routing), 'the last two run');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /The enemy infantry break and run/.test(x[1])));
  const x0 = left.map((u) => u.x);
  const hero = g.hero;
  Object.assign(hero, { x: left[0].x - 30, y: left[0].y, hp: hero.maxhp });
  for (let i = 0; i < 10; i++) CL.combat.update(0.05);
  assert.ok(left.every((u, i) => u.x > x0[i]), 'running for their own edge');
  assert.equal(hero.hp, hero.maxhp, 'routing soldiers do not swing');
  for (let i = 0; i < 80 && g.mode === 'battle'; i++) CL.combat.update(0.05);
  assert.equal(g.mode, 'result', 'every enemy left running: the field is yours');
  assert.equal(g.result.win, true);
  assert.equal(g.routed, 2);
  assert.equal(g.kills, 5, 'no kill credit for those who fled');
  assert.equal(g.result.gold, 10 + (5 + 1) * 4, 'two who fled give the spoils of one kill');
  assert.match(g.result.html, /Enemies defeated: 5 · 2 fled the field/);
});

test('routed enemies still in a band after a loss live on; your fled soldiers come back unhurt', () => {
  const { CL, g } = scene({ company: ['footman', 'footman'] });
  const [a, b] = g.allies;
  a.alive = false; // cut down
  CL.morale.leave(g, b); // ran off the field
  const { killed, wounded } = CL.party.rollCasualties(g.allies);
  const ids = [...killed, ...wounded];
  assert.ok(ids.includes(a.soldierId));
  assert.ok(!ids.includes(b.soldierId), 'not a casualty');
  CL.morale.leave(g, g.enemies[0]);
  g.enemies[1].alive = false;
  assert.equal(JSON.stringify(g.enemies.filter((e) => !e.alive && !e.routed).map((e) => e.id)), JSON.stringify([g.enemies[1].id]));
});

test('a group that loses heart falls back toward its own side, fighting only what reaches it', () => {
  const { CL, g } = scene({ company: ['levy', 'levy', 'levy', 'levy', 'levy'], wave: { looter: 8 } });
  tick(CL, g);
  g.hero.alive = false;
  const inf = g.allies;
  inf[0].alive = false;
  for (const u of inf) Object.assign(u, { x: 500 });
  for (const u of g.enemies) Object.assign(u, { x: 640 });
  g.morale['ally:infantry'].cohesion = null;
  tick(CL, g);
  assert.equal(g.moraleState['ally:infantry'], 'fallback');
  const before = inf.filter((u) => u.alive).map((u) => u.x);
  g.orders.infantry = 'charge';
  for (const u of inf) if (u.alive) for (let i = 0; i < 6; i++) CL.combat.ai(u, 0.05);
  const after = inf.filter((u) => u.alive).map((u) => u.x);
  assert.ok(after.every((x, i) => x < before[i]), 'giving ground, though ordered to charge');
});

test('rally: the hero turns back soldiers who are running and steadies those near; once every 30 s', () => {
  const { CL, g, uiCalls } = scene();
  const near = g.allies.filter((u) => u.role === 'infantry');
  const far = g.allies.filter((u) => u.role === 'archer');
  for (const u of near) Object.assign(u, { x: g.hero.x - 40, routing: true, routeT: 1 });
  for (const u of far) Object.assign(u, { x: 900, y: 450 });
  assert.equal(CL.morale.rally(g), near.length);
  assert.ok(near.every((u) => !u.routing), 'they turn back');
  assert.ok(g.morale['ally:infantry'].cohesion >= CL.morale.RALLY.floor);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === 'Rally! 3 turn back to the fight'));
  tick(CL, g);
  assert.ok(CL.morale.targetFor(g, 'ally', 'infantry').parts.rally > 29, 'and it lasts a while');
  assert.equal(CL.morale.rally(g), false, 'not again so soon');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /^Rally ready in \d+ s$/.test(x[1])));
  g.t += 31;
  g.hero.alive = false;
  assert.equal(CL.morale.rally(g), false, 'a fallen hero rallies nobody');
});

test('an order to a routing group says why it is not obeyed', () => {
  const { CL, g, uiCalls } = scene();
  for (const u of g.allies.filter((x) => x.role === 'archer')) u.routing = true;
  tick(CL, g);
  CL.combat.order('archer', 'charge');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === 'Archers are routing: Rally them first (R)'));
});

test('a reserve steps in for a soldier who runs, without waiting for them to leave', () => {
  const { CL, g } = scene({ wave: { looter: 3 } });
  g.enemyReserve = ['looter', 'looter', 'looter'];
  g.enemyCap = 3;
  for (const u of g.enemies) u.routing = true;
  CL.combat.reinforce(g);
  assert.equal(g.enemies.filter((u) => u.alive && !u.routing).length, 3);
});
