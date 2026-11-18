// Nearby reinforcements (V2-09; design §9, SC-08, SC-09, §25.2, §27.3): parties close enough to reach a
// battle within its hours join it at a worked-out time, from their side of the field; distant ones
// can't; a party in a live battle is locked so it can't lose another one; the result applies once.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** The player on open ground at (70, 20) facing a Reaver band; a company of five. */
function setup({ band = { looter: 4 }, opts = {} } = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'hunter', 'hunter']) CL.save.addSoldier(c, t);
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 70, y: 20 });
  c.reputation.valedorn = 40; // Valedorn counts you a friend: its patrols ride to your aid
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 70.5, y: 20, troops: { ...band }, tx: null, ty: null });
  return { ...env, c, band: p };
}
/** Put a party of a template at a spot, standing still. */
function place(CL, c, template, x, y, troops) {
  const p = CL.parties.spawn(c, template);
  Object.assign(p, { x, y, tx: null, ty: null });
  if (troops) p.troops = { ...troops };
  return p;
}
const hoursTo = (CL, c, p) => {
  const t = CL.content.get('party_templates', p.template);
  return CL.world.mapDist(p.x, p.y, c.world.x, c.world.y) / (t.speed * CL.world.map().terrain[CL.world.terrainAt(p.x, p.y)]);
};
const steps = (CL, secs) => {
  for (let i = 0; i < secs * 20 && CL.game.mode === 'battle'; i++) CL.combat.update(0.05);
};

test('SC-08: a nearby friendly patrol rides in at a worked-out time, from its side, and helps; a distant one cannot', () => {
  const { CL, c, band } = setup();
  const near = place(CL, c, 'valedorn_patrol', 70, 15, { footman: 3, hunter: 2 }); // 5 map units north
  const far = place(CL, c, 'valedorn_patrol', 40, 20); // 30 map units off: out of reach and earshot
  CL.parties.open(band.id);
  const planned = CL.reinforce.plan(c, CL.parties.current());
  assert.equal(JSON.stringify(planned.map((j) => j.id)), JSON.stringify([near.id]), 'only the near patrol');
  const j = planned[0];
  assert.equal(j.side, 'ally');
  assert.equal(j.from, 'north');
  assert.ok(Math.abs(j.arriveAt - Math.max(6, hoursTo(CL, c, near) * 10)) < 1e-9, 'an hour of riding is ten seconds of battle');
  assert.ok(j.hours <= CL.clock.hours('battle'));
  CL.parties.attack();
  const g = CL.game;
  assert.equal(g.joining.length, 1);
  g.hero.x -= 400; // keep the fight from ending before they come
  for (const e of g.enemies) e.x += 600;
  steps(CL, j.arriveAt - 0.2);
  assert.equal(g.allies.filter((u) => u.outside).length, 0, 'not before their time');
  steps(CL, 0.3);
  const helpers = g.allies.filter((u) => u.outside);
  assert.equal(helpers.length, 5, 'the whole patrol rides in');
  const b = g.battleMap.bounds;
  assert.ok(helpers.every((u) => u.y < b.minY + 160), 'from the north edge of the field');
  assert.ok(helpers.every((u) => u.soldierId == null), 'not your soldiers: their battles are not on your rolls');
  assert.equal(c.parties.includes(far), true);
});

test('SC-09: an enemy band coming from another side is announced before it arrives; one you can see is named at once', () => {
  const { CL, c, band, uiCalls } = setup();
  place(CL, c, 'bandits', 74, 20, { looter: 3 }); // 4 units east: in sight
  CL.parties.open(band.id);
  const text = CL.reinforce.note(c, CL.parties.current());
  assert.match(text, /Road Reavers \(3\), to the east, would join the fight against you/);
  assert.equal(CL.parties.retreatChance(c, CL.parties.current()) > 0, true, 'you can still choose to slip away');
  CL.parties.attack();
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /^Road Reavers \(3\) coming from the east to join the enemy · about \d+ s$/.test(x[1])));
  // One out of sight is announced only WARN seconds before it comes.
  const r = setup();
  const unseen = place(r.CL, r.c, 'bandits', 78.5, 20, { looter: 2 }); // 8.5 units east: out of sight
  r.CL.parties.open(r.band.id);
  r.CL.parties.attack();
  const j = r.CL.game.joining.find((x) => x.id === unseen.id);
  assert.equal(j.seen, false);
  r.CL.game.hero.x -= 400;
  for (const e of r.CL.game.enemies) e.x += 600;
  steps(r.CL, j.arriveAt - r.CL.reinforce.WARN - 0.5);
  assert.equal(j.warned, false);
  steps(r.CL, 1);
  assert.equal(j.warned, true);
});

test('who joins whom: Reavers join Reavers, only a friend’s patrol helps, a Hostile kingdom turns on you, caravans and story bands keep out', () => {
  const { CL, c, band } = setup();
  const S = (p) => CL.reinforce.sideOf(c, p, { kind: 'bandit', faction: 'neutral' });
  assert.equal(S(place(CL, c, 'bandits', 72, 20)), 'enemy');
  assert.equal(S(place(CL, c, 'valedorn_patrol', 72, 20)), 'ally', 'a friend’s patrol helps');
  assert.equal(S(place(CL, c, 'aurelian_patrol', 72, 20)), null, 'a merely neutral kingdom’s patrol keeps out');
  assert.equal(S(place(CL, c, 'valedorn_caravan', 72, 20)), null);
  const quest = place(CL, c, 'bandits', 72, 20);
  quest.questTag = 'q';
  assert.equal(S(quest), null);
  c.reputation.aurelian = -80;
  assert.equal(S(place(CL, c, 'aurelian_patrol', 72, 20)), 'enemy', 'a Hostile kingdom hunts you');
  // You attack a Valedorn patrol: Valedorn's other patrol comes for you; Aurelia helps only a friend.
  const vp = { kind: 'patrol', faction: 'valedorn' };
  c.reputation.aurelian = 0;
  assert.equal(CL.reinforce.sideOf(c, place(CL, c, 'valedorn_patrol', 72, 20), vp), 'enemy');
  assert.equal(CL.reinforce.sideOf(c, place(CL, c, 'aurelian_patrol', 72, 20), vp), null);
  c.reputation.aurelian = 60;
  assert.equal(CL.reinforce.sideOf(c, place(CL, c, 'aurelian_patrol', 72, 20), vp), 'ally');
  assert.ok(band);
});

test('at the unit cap the newcomers wait in reserve and step in from their own side', () => {
  const { CL, c, band } = setup({ band: { looter: 8 } });
  CL.combat.setActiveCap(20);
  const more = place(CL, c, 'bandits', 70, 24, { looter: 9 }); // south
  CL.parties.open(band.id);
  CL.parties.attack();
  const g = CL.game;
  const j = g.joining.find((x) => x.id === more.id);
  const room = 20 - 6 - g.enemies.length; // the whole field counts: hero and five soldiers, eight Reavers
  CL.reinforce.arrive(g, j);
  assert.equal(g.enemies.filter((u) => u.join === more.id).length, room);
  assert.equal(g.enemyReserve.filter((r) => r.join === more.id).length, 9 - room);
  for (const u of g.enemies.slice(0, 3)) u.alive = false;
  CL.combat.reinforce(g);
  const late = g.enemies.filter((u) => u.join === more.id).slice(room);
  assert.ok(late.length > 0);
  assert.ok(late.every((u) => u.y > g.battleMap.bounds.maxY - 200), 'from the south edge, not the enemy camp');
  CL.combat.setActiveCap(40);
});

test('a party still on its way when the battle ends arrives too late and takes no part', () => {
  const { CL, c, band } = setup();
  const late = place(CL, c, 'valedorn_patrol', 70, 11, { footman: 4 }); // 9 units off
  CL.parties.open(band.id);
  CL.parties.attack();
  const g = CL.game;
  assert.ok(g.joining[0].arriveAt > 1);
  CL.debugTools.endBattleNow(true);
  assert.equal(g.mode, 'result');
  steps(CL, 30);
  assert.equal(g.allies.filter((u) => u.outside).length, 0, 'nobody spawns into a finished battle');
  assert.equal(JSON.stringify(late.troops), JSON.stringify({ footman: 4 }));
});

test('helpers fight for themselves; an enemy they cut down earns you no kill', () => {
  const { CL, c, band } = setup();
  place(CL, c, 'valedorn_patrol', 70, 18, { footman: 3 });
  CL.parties.open(band.id);
  CL.parties.attack();
  const g = CL.game;
  CL.reinforce.arrive(g, g.joining[0]);
  const helper = g.allies.find((u) => u.outside);
  const foe = g.enemies[0];
  foe.hp = 1;
  CL.combat.hit(foe, 50, helper);
  assert.equal(g.kills, 0);
  assert.equal(g.helpKills, 1);
  g.orders.infantry = 'hold';
  helper.aiTimer = 0;
  const start = { x: helper.x, y: helper.y };
  helper.holdX = start.x;
  helper.holdY = start.y;
  for (let i = 0; i < 10; i++) CL.combat.ai(helper, 0.05);
  assert.ok(Math.hypot(helper.x - start.x, helper.y - start.y) > 10, 'your Hold order is not theirs');
});

test('the result applies once: those who fought move to the battle and lose their fallen; a beaten band breaks', () => {
  const { CL, c, band } = setup();
  const pat = place(CL, c, 'valedorn_patrol', 70, 17, { footman: 4, hunter: 2 });
  const reav = place(CL, c, 'bandits', 73, 20, { looter: 3 });
  CL.parties.open(band.id);
  CL.parties.attack();
  const g = CL.game;
  for (const j of g.joining) CL.reinforce.arrive(g, j);
  const mine = g.allies.find((u) => u.join === pat.id && u.troop === 'hunter');
  mine.hp = 1;
  CL.combat.hit(mine, 50, g.enemies[0]);
  const resolved = c.nextResultId;
  CL.debugTools.endBattleNow(true);
  assert.equal(c.nextResultId, resolved + 1);
  assert.equal(JSON.stringify(pat.troops), JSON.stringify({ footman: 4, hunter: 1 }), 'one hunter fell');
  assert.ok(Math.hypot(pat.x - c.world.x, pat.y - c.world.y) < 4, 'the patrol rode to the fight (and moves on from there)');
  assert.equal(c.parties.includes(reav), false, 'the Reavers who joined were beaten too');
  // A second commit of the same battle changes nothing.
  assert.equal(CL.encounter.resolve(c, { kind: 'battle', outcome: { battleId: g.battleId, encounter: g.encounterDef, win: true, kills: 0, killed: [], wounded: [] }, reinforcements: [{ id: pat.id, side: 'ally', arrived: true, fallen: ['footman'] }] }), null);
  assert.equal(pat.troops.footman, 4);
});

test('no double battles: while the battle’s hours pass, the band you fought cannot be beaten by a patrol elsewhere', () => {
  const { CL, c, band } = setup({ band: { looter: 3 } });
  // A strong patrol beside the band but out of earshot of the fight's start: on the map it would run
  // the band down during the battle's four hours. Moved after the plan is made, it never joins.
  CL.parties.open(band.id);
  CL.parties.attack();
  const pat = place(CL, c, 'valedorn_patrol', band.x + 0.5, band.y, { footman: 8, hunter: 4 });
  const g = CL.game;
  assert.equal(g.joining.length, 0);
  for (const u of g.allies) u.alive = false;
  g.hero.alive = false;
  CL.combat.update(0.05); // the company is beaten: the band survives, weakened
  assert.equal(g.mode, 'result');
  assert.equal(c.parties.includes(band), true, 'still there after the four hours: it was locked in your battle');
  assert.equal(g.lock, null, 'and unlocked once the result is in');
  assert.ok(pat);
});

test('auto-resolve counts the same parties, says so, and applies their losses', () => {
  const { CL, c, band } = setup({ band: { looter: 5, reaver: 2 } });
  const pat = place(CL, c, 'valedorn_patrol', 70, 16, { footman: 4, hunter: 3 });
  CL.parties.open(band.id);
  const r = CL.parties.autoResolve();
  assert.match(r.html, /Riding to your aid: Valedorn Patrol \(7\)/);
  assert.match(r.html, /Odds \d+% with them/);
  assert.ok(c.parties.includes(pat) ? Math.hypot(pat.x - c.world.x, pat.y - c.world.y) < 4 : true);
  assert.equal(CL.game.lock, null);
});
