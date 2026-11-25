// P7-04: pursuit and detection. Sight on the map by the time of day and the ground; the company's size
// and the Hide stance; chases that end at a last-seen spot, a search there, and giving up; the map shows
// what the company sees, with faded marks where it last saw the rest; nothing a quest needs is lost.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const NOON = 0.5; // a campaign day's fraction: midday
const MIDNIGHT = 0; // and midnight

/** On the open map, with nothing else around and no newcomers. */
function onMap(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  c.parties = [];
  c.partySpawns = Object.fromEntries(Object.keys(CL.content.table('party_templates')).map((t) => [t, 1e9]));
  c.food = 500;
  return { ...env, c, S: CL.sight };
}

/** A clear spot of each kind of ground in the realm. */
const GRASS = [125, 70];
const FOREST = [70, 80];
const HILLS = [190, 50];

test('sight: shorter at night, longer from high ground, short into a forest', () => {
  const { CL, c, S } = onMap();
  const band = CL.parties.spawn(c, 'bandits');
  const t = CL.content.get('party_templates', 'bandits');
  const at = (p, [x, y]) => Object.assign(p, { x, y });
  at(c.world, GRASS);
  at(band, [GRASS[0] + 1, GRASS[1]]);
  const day = S.partyRange(c, band, NOON);
  assert.ok(Math.abs(day - t.detection * S.visibility(c)) < 1e-9, 'by day on grass: its detection, scaled by your size');
  assert.ok(Math.abs(S.partyRange(c, band, MIDNIGHT) - day * S.NIGHT.factor) < 1e-9, 'night');
  at(band, HILLS);
  assert.ok(Math.abs(S.partyRange(c, band, NOON) - day * S.HIGH_GROUND) < 1e-9, 'from the hills');
  at(band, GRASS);
  at(c.world, FOREST);
  assert.ok(Math.abs(S.partyRange(c, band, NOON) - day * S.FOREST) < 1e-9, 'into a forest');
  assert.equal(S.isNight(10 + 21 / 24), true);
  assert.equal(S.isNight(10 + 4.9 / 24), true);
  assert.equal(S.isNight(10 + 5 / 24), false);
  // The company's own sight works the same way.
  at(c.world, GRASS);
  at(band, [GRASS[0] + 3, GRASS[1]]);
  assert.equal(S.playerRange(c, band, NOON), S.PLAYER_SIGHT);
  assert.equal(S.playerRange(c, band, MIDNIGHT), S.PLAYER_SIGHT * S.NIGHT.factor);
});

test('a small company is harder to spot than a big one; hiding in a forest much harder still', () => {
  const { CL, c, S } = onMap();
  c.roster = [];
  const alone = S.visibility(c);
  for (let i = 0; i < 20; i++) CL.save.addSoldier(c, 'levy');
  const big = S.visibility(c);
  assert.equal(alone, S.SIZE.alone);
  assert.ok(Math.abs(big - S.SIZE.max) < 1e-9);
  // Hide: only in a forest, standing still; setting off breaks it.
  Object.assign(c.world, { x: GRASS[0], y: GRASS[1] });
  assert.equal(CL.world.toggleHide(), false, 'not in the open');
  Object.assign(c.world, { x: FOREST[0], y: FOREST[1] });
  assert.equal(CL.world.toggleHide(), true);
  assert.equal(S.visibility(c), big * S.HIDDEN);
  CL.world.travelTo({ type: 'point', id: null, x: FOREST[0] + 5, y: FOREST[1] });
  assert.equal(S.hidden(c), false, 'setting off breaks it');
  assert.equal(c.world.hidden, undefined);
});

test('a band loses you in a forest: it rides to where it last saw you, searches there, then gives up', () => {
  const { CL, c, S } = onMap();
  c.roster = [];
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: FOREST[0] - 3, y: FOREST[1], troops: { looter: 6 }, tx: null, ty: null }); // close: you're among trees
  Object.assign(c.world, { x: FOREST[0], y: FOREST[1] });
  c.day = 3 + NOON;
  // It sees a lone rider at the forest's edge and gives chase.
  CL.parties.tick(c, 0.25);
  assert.equal(band.chasing, 'player');
  assert.deepEqual([band.lastSeen.x, band.lastSeen.y], FOREST);
  // You slip deeper into the trees and hide.
  Object.assign(c.world, { x: FOREST[0] + 8, y: FOREST[1] + 4 });
  CL.world.toggleHide();
  assert.ok(!S.partySees(c, band));
  CL.parties.tick(c, 0.25);
  assert.equal(band.chasing, 'search', 'off to the last-seen spot');
  assert.deepEqual([band.tx, band.ty], FOREST);
  // It gets there, searches around for a few hours, then gives up.
  for (let i = 0; i < 40 && band.lastSeen; i++) {
    CL.parties.tick(c, 0.25);
    c.day += 0.25 / 24;
    assert.ok(!S.partySees(c, band) || !band.lastSeen, 'never spots you while you stay hidden');
  }
  assert.equal(band.lastSeen, null, 'given up');
  assert.ok(CL.diag.events.some((e) => e.msg === 'Search given up'));
});

test('a Hostile kingdom’s patrol searches your last-seen spot', () => {
  const { CL, c, S } = onMap();
  c.reputation.valedorn = -60;
  c.roster = [];
  const patrol = CL.parties.spawn(c, 'valedorn_patrol');
  Object.assign(patrol, { x: GRASS[0] - 4, y: GRASS[1], tx: null, ty: null });
  Object.assign(c.world, { x: GRASS[0], y: GRASS[1] });
  c.day = 2 + NOON;
  CL.parties.tick(c, 0.25);
  assert.equal(patrol.chasing, 'player');
  // Night falls and you are far off: it can't see you any more.
  c.day = 3 + MIDNIGHT;
  Object.assign(c.world, { x: GRASS[0] + 12, y: GRASS[1] });
  assert.ok(!S.partySees(c, patrol));
  CL.parties.tick(c, 0.25);
  assert.equal(patrol.chasing, 'search');
});

test('the map: parties the company sees, a faded mark for a day where it last saw the rest; a contract target’s kept', () => {
  const { CL, c, S } = onMap();
  Object.assign(c.world, { x: GRASS[0], y: GRASS[1] });
  c.day = 1 + NOON;
  const near = CL.parties.spawn(c, 'aurelian_caravan');
  const far = CL.parties.spawn(c, 'aurelian_caravan');
  Object.assign(near, { x: GRASS[0] + 3, y: GRASS[1] });
  Object.assign(far, { x: GRASS[0] + 40, y: GRASS[1] });
  S.look(c);
  assert.deepEqual(plain(S.shown(c, near)), { x: near.x, y: near.y, live: true });
  assert.equal(S.shown(c, far), null, 'never seen: not shown');
  // It rides out of sight: the map keeps where it was, for a day.
  const seenAt = { x: near.x, y: near.y };
  near.x += 30;
  assert.deepEqual(plain(S.shown(c, near)), { ...seenAt, live: false });
  assert.equal(S.shown(c, near, c.day + 2), null, 'forgotten after a day');
  // You can't click a party you can't see.
  near.x = seenAt.x;
  const [sx, sy] = CL.world.toScreen(far.x, far.y);
  CL.mapView.state.zoom = CL.mapView.fitZoom();
  assert.notEqual(CL.world.targetAt(...CL.world.toScreen(far.x, far.y)).type, 'party');
  assert.ok(Number.isFinite(sx + sy));
  // A contract target is marked where the giver says, and that mark is kept until found.
  c.world.location = 'stonebridge';
  const o = CL.contracts.offerAt(c, 'stonebridge');
  assert.equal(CL.contracts.accept(c, 'stonebridge').ok, true);
  const target = CL.parties.find(c, c.contract.partyId);
  assert.deepEqual([target.seenAt.x, target.seenAt.y], [o.x, o.y]);
  CL.world.leaveSettlement();
  target.x += 50;
  assert.equal(S.shown(c, target, c.day + 30).live, false, 'still shown, however long ago');
});

test('nothing a quest needs is lost: story bands and the caravan you escort always show', () => {
  const { CL, c, S } = onMap();
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: 10, y: 190, questTag: 'q_test' });
  assert.equal(S.playerSees(c, band, MIDNIGHT), true);
  const caravan = CL.parties.spawn(c, 'aurelian_caravan');
  Object.assign(caravan, { x: 190, y: 10, escortTo: 'eastwatch' });
  assert.equal(S.playerSees(c, caravan), true);
});

test('saves: the Hide stance, where parties last saw you and where you last saw them', () => {
  const storage = memoryStorage();
  const { CL, c } = onMap({ storage });
  Object.assign(c.world, { x: FOREST[0], y: FOREST[1] });
  CL.world.toggleHide();
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { lastSeen: { x: 50, y: 60, until: 2.5 }, seenAt: { x: 51, y: 61, day: 1.25 } });
  CL.save.write();
  const back = CL.save.fromRaw(JSON.parse(storage.data[CL.save.KEY])).campaign; // the test loader would clear parties
  assert.equal(back.world.hidden, true);
  const b = back.parties.find((p) => p.id === band.id);
  assert.deepEqual(JSON.parse(JSON.stringify(b.lastSeen)), { x: 50, y: 60, until: 2.5 });
  assert.deepEqual(JSON.parse(JSON.stringify(b.seenAt)), { x: 51, y: 61, day: 1.25 });
  const junk = CL.save.sanitize({ ...JSON.parse(JSON.stringify(c)), parties: [{ ...JSON.parse(JSON.stringify(band)), lastSeen: { x: 'a' }, seenAt: { x: 1, y: 2 } }] });
  assert.equal(junk.parties[0].lastSeen, undefined);
  assert.equal(junk.parties[0].seenAt, undefined);
});

// ---- P10-08: sight that grows, and its other eyes ----

test('P10-08: the company sees further with Pathfinding, Mara, a horse and a scout, by the world’s numbers', () => {
  const { CL, c, S } = onMap();
  const R = S.rules();
  assert.deepEqual(plain(R), plain({ base: 12, pathfinding: 0.04, companion: 0.15, horse: 0.1, holdings: { fort: 10, town: 8 }, detachment: 8 }));
  const base = S.companyRange(c);
  assert.equal(base, 12);
  c.character.skills.pathfinding = 5;
  assert.ok(Math.abs(S.companyRange(c) - 12 * 1.2) < 1e-9, 'each point of Pathfinding');
  c.equipment.horse = 'nag';
  assert.ok(Math.abs(S.companyRange(c) - 12 * 1.2 * 1.1) < 1e-9, 'a view from the saddle');
  assert.ok(CL.companion.join(c, 'mara'));
  const m = CL.world.map().sight;
  const withMara = S.companyRange(c);
  m.companion = 0;
  assert.ok(Math.abs(withMara / S.companyRange(c) - 1.15) < 1e-9, 'Mara rides along (and lends her Pathfinding too)');
  m.companion = 0.15;
  // The numbers are the world's: change them and sight follows.
  m.base = 24;
  assert.ok(Math.abs(S.companyRange(c) / withMara - 2) < 1e-9);
  m.base = 12;
});

test('P10-08: a fort you hold and your patrols watch their own circles; night shrinks them; a party nobody sees is hidden', () => {
  const { CL, c, S } = onMap();
  Object.assign(c.world, { x: GRASS[0], y: GRASS[1] });
  const fort = Object.values(CL.content.table('settlements')).find((s) => s.type === 'fort' && CL.world.mapDist(s.mapX, s.mapY, c.world.x, c.world.y) > 30);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: fort.mapX + 4, y: fort.mapY });
  c.day = 3 + NOON;
  assert.equal(S.playerSees(c, band), false, 'far from the company, nothing watches it');
  c.holdings[fort.id].holder = CL.realm.PLAYER;
  assert.ok(S.sources(c).some((s) => s.kind === 'holding' && s.x === fort.mapX && s.r === 10));
  assert.equal(S.playerSees(c, band), true, 'your fort sees it');
  c.day = 3 + MIDNIGHT;
  Object.assign(band, { x: fort.mapX + 8, y: fort.mapY });
  assert.equal(S.playerSees(c, band), false, 'at night the fort sees only 6');
  // A patrol of yours out on the map watches 8 around it.
  c.day = 3 + NOON;
  c.holdings[fort.id].holder = c.holdings[fort.id].holder === CL.realm.PLAYER ? 'person:1' : c.holdings[fort.id].holder;
  const patrol = { ...CL.parties.spawn(c, 'bandits'), detachment: 1, x: band.x - 6, y: band.y };
  c.parties.push(patrol);
  assert.ok(S.sources(c).some((s) => s.kind === 'patrol'));
  assert.equal(S.playerSees(c, band), true, 'your patrol sees it');
});
