// P9-B2 (D-P9c, as in Mount & Blade): a band or lord on the map fights as one army; the two sides share
// the field by their numbers, and both feed in reserves as men fall, keeping their share. Fixed
// encounters (lairs, story bands, the tournament, the walls) keep their waves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { headlessUi } = require('./helpers/campaign-bot');

test('the share: in proportion to the numbers, never fewer than 10 a side (or all of a smaller side)', () => {
  const { CL } = loadGame();
  const s = (size, a, b) => JSON.stringify(CL.combat.shareOf(size, a, b));
  assert.equal(s(100, 300, 200), JSON.stringify({ allies: 60, enemies: 40 }), '300 against 200 at 100: 60 and 40');
  assert.equal(s(40, 300, 200), JSON.stringify({ allies: 24, enemies: 16 }));
  assert.equal(s(100, 30, 50), JSON.stringify({ allies: 30, enemies: 50 }), 'everyone fits: everyone fights');
  assert.equal(s(100, 20, 400), JSON.stringify({ allies: 10, enemies: 90 }), 'never fewer than 10');
  assert.equal(s(100, 4, 400), JSON.stringify({ allies: 4, enemies: 96 }), 'or all of a smaller side');
  assert.equal(s(100, 400, 3), JSON.stringify({ allies: 97, enemies: 3 }));
  assert.equal(s(100, 101, 100), JSON.stringify({ allies: 50, enemies: 50 }), 'rounded');
  assert.equal(s(20, 25, 25), JSON.stringify({ allies: 10, enemies: 10 }));
  for (let a = 1; a < 300; a += 17) for (let b = 1; b < 300; b += 23) {
    const r = CL.combat.shareOf(60, a, b);
    assert.ok(r.allies + r.enemies <= 60 && r.allies <= a && r.enemies <= b, `${a} v ${b}`);
  }
});

/** A seeded campaign with a company of `n` and a band of `troops` beside it, its encounter open. */
function setup({ n = 60, mix = ['footman', 'footman', 'hunter', 'levy', 'rider'], troops = { reaver: 20, looter: 20 }, size = 40 } = {}) {
  const env = loadGame({ seed: 4242 });
  const { CL } = env;
  CL.ui = headlessUi(CL);
  CL.combat.setActiveCap(size);
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < n; i++) CL.save.addSoldier(c, mix[i % mix.length]);
  c.world.location = null;
  c.parties = c.parties.filter((p) => Math.hypot(p.x - c.world.x, p.y - c.world.y) > 40); // nobody near to ride in
  CL.game.mode = 'map';
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { troops: { ...troops }, x: c.world.x, y: c.world.y });
  CL.parties.open(p.id);
  return { CL, c, p, g: CL.game };
}
const standing = (list) => list.filter((u) => u.alive && !u.routing).length;

test('a band on the map shares the field by its numbers; both sides wait in reserve', () => {
  const { CL, g } = setup({ n: 59, troops: { reaver: 20, looter: 20 }, size: 40 });
  CL.parties.attack();
  assert.equal(g.share, true);
  // You 60 (hero and 59), them 40: 24 and 16 on a field of 40.
  assert.deepEqual([g.allyCap, g.enemyCap], [24, 16]);
  assert.equal(1 + g.allies.length, 24);
  assert.equal(g.enemies.length, 16);
  assert.deepEqual([g.allyReserve.length, g.enemyReserve.length], [59 - 23, 24]);
  assert.equal(g.totalWaves, 1, 'one army, not waves');
  const line = CL.combat.fieldShare(g.encounterDef);
  assert.deepEqual([line.mine, line.theirs, line.allies, line.enemies], [60, 40, 24, 16], 'the Prepare screen’s numbers');
});

test('reserves step in on both sides as men fall, from behind their own line, keeping their share; nobody twice', () => {
  const { CL, g } = setup({ n: 59, troops: { reaver: 20, looter: 20 }, size: 40 });
  CL.parties.attack();
  // Six of theirs and six of yours fall at once (far from anyone).
  const frontEnemy = Math.max(...g.enemies.map((e) => e.x));
  const rearAlly = Math.min(...g.allies.map((a) => a.x));
  for (const e of g.enemies.slice(0, 6)) e.alive = false;
  for (const a of g.allies.filter((x) => x.soldierId != null).slice(0, 6)) a.alive = false;
  const before = { enemies: g.enemies.length, allies: g.allies.length };
  CL.combat.reinforce(g);
  const newEnemies = g.enemies.slice(before.enemies);
  const newAllies = g.allies.slice(before.allies);
  assert.equal(newEnemies.length, 6);
  assert.equal(newAllies.length, 6);
  assert.equal(standing(g.enemies), 16, 'their share kept');
  assert.equal(1 + standing(g.allies), 24, 'yours kept');
  assert.ok(newEnemies.every((e) => e.x >= frontEnemy - 1), 'theirs come from behind their own line');
  assert.ok(newAllies.every((a) => a.x <= rearAlly + 1), 'yours from behind yours');
  const ids = g.allies.map((a) => a.soldierId).filter((id) => id != null);
  assert.equal(new Set(ids).size, ids.length, 'no soldier on the field twice');
});

test('played out: one side is beaten only when its field and reserve are spent; the totals add up', () => {
  const { CL, c, p, g } = setup({ n: 39, mix: ['footman', 'guard', 'hunter', 'rider'], troops: { looter: 36 }, size: 40 });
  const start = { roster: c.roster.length, enemy: 36 };
  CL.parties.attack();
  Object.assign(g, { hold: {}, joystick: { x: 0, y: 0 } });
  // P11-05: the band holds its ground against this company now (its plan reads the hero's new profile),
  // so the company charges, or a still hero and a holding enemy would stall: played out means fought out.
  for (const div of ['infantry', 'archer', 'cavalry']) CL.combat.order(div, 'charge');
  let t = 0;
  let enemiesMet = 0;
  while (g.mode === 'battle' && t < 600) {
    CL.combat.update(0.05);
    t += 0.05;
    if (g.mode === 'battle' && g.enemies.every((e) => !e.alive) && g.enemyReserve.length) assert.fail('the field emptied with a reserve still waiting');
    enemiesMet = g.enemies.length;
  }
  assert.notEqual(g.mode, 'battle', `ended (after ${t.toFixed(0)} s)`);
  assert.equal(g.result.win, true, 'a trained company beats as many looters');
  assert.equal(enemiesMet + g.enemyReserve.length, start.enemy, 'every one of theirs came on, once');
  assert.equal(g.enemyReserve.length, 0);
  assert.equal(c.parties.includes(p), false, 'the beaten band is broken');
  const company = g.allies.filter((a) => a.soldierId != null);
  assert.equal(company.length + g.allyReserve.length, start.roster, 'every soldier on the field or in reserve, once');
  const fell = company.filter((a) => !a.alive).length;
  assert.ok(start.roster - c.roster.length <= fell, `the company lost no more than fell (${start.roster - c.roster.length} of ${fell}; the rest wounded or saved)`);
});

test('a party that rides in joins its side’s reserve, first in line, and the share is worked out again', () => {
  const { CL, g } = setup({ n: 59, troops: { reaver: 20, looter: 20 }, size: 40 });
  CL.parties.attack();
  const j = { id: -7, name: 'Road Reavers', side: 'enemy', troops: { reaver: 20 }, size: 20, dir: { x: 0, y: 1 }, from: 'south', arriveAt: 0, warned: true, arrived: false };
  g.joining.push(j);
  CL.reinforce.arrive(g, j);
  // You 60, them 60: 20 each on a field of 40 (nobody already fighting leaves it).
  assert.deepEqual([g.allyCap, g.enemyCap], [20, 20]);
  assert.equal(1 + standing(g.allies), 24, 'your 24 stay on');
  assert.equal(standing(g.enemies), 20, 'four of the newcomers ride straight in');
  assert.equal(g.enemies.filter((e) => e.join === j.id).length, 4);
  assert.equal(g.enemyReserve[0].join, j.id, 'the rest first in line');
  assert.equal(g.enemyReserve.length, 24 + 16);
});

test('fixed encounters keep their waves: a lair, a story band, the tournament, the walls', () => {
  const { CL, g } = setup();
  CL.combat.startBattle('captains_trial');
  assert.equal(g.share, false);
  assert.equal(g.totalWaves, 2);
  const t = CL.content.get('party_templates', 'bandits');
  const story = CL.parties.battleDef(t, { looter: 7, reaver: 4 }, 'open_country', { share: false });
  CL.combat.startBattle(story);
  assert.equal(g.share, false);
  assert.equal(g.totalWaves, 2);
  CL.combat.startBattle(CL.assault.practice(30, 'attack'));
  assert.equal(g.share, false, 'the walls');
});

test('the morale of an army counts its reserve', () => {
  const { CL, g } = setup({ n: 19, troops: { looter: 80 }, size: 40 });
  CL.parties.attack();
  CL.combat.update(0.3);
  const t = CL.morale.targetFor(g, 'ally', 'infantry');
  assert.ok(t.parts.outnumbered < 0, `outnumbered four to one counting their reserve: ${t.parts.outnumbered}`);
});
