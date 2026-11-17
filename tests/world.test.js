// World map (Gate C step 1): terrain, travel time, settlements, sites, capture release.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** Run world updates (as the main loop would) until the journey ends or `maxSeconds` pass. */
function travel(CL, maxSeconds = 120, dt = 0.05) {
  for (let t = 0; t < maxSeconds && CL.game.travel; t += dt) CL.world.update(dt);
}

function onMap(env) {
  env.CL.world.leaveSettlement();
  return env;
}

test('a new campaign starts inside Stonebridge', () => {
  const { CL } = loadGame();
  const w = CL.campaign.world;
  assert.equal(w.location, 'stonebridge');
  assert.deepEqual([w.x, w.y], [50, 55]);
  assert.equal(CL.party.currentSettlement().name, 'Stonebridge');
});

test('terrain: roads, forests and open grass with GDD speed factors', () => {
  const { CL } = loadGame();
  const { terrainAt, speedAt } = CL.world;
  assert.equal(terrainAt(56, 47.5), 'road', 'midway Stonebridge → Eastwatch');
  assert.equal(terrainAt(20, 30), 'forest');
  assert.equal(terrainAt(75, 20), 'grass');
  assert.equal(speedAt(56, 47.5), 4 * 1.2);
  assert.equal(speedAt(20, 30), 4 * 0.75);
  assert.equal(speedAt(75, 20), 4);
});

test('forest travel takes longer than the same distance on grass', () => {
  const { CL } = loadGame();
  const w = CL.campaign.world;
  Object.assign(w, { x: 12, y: 30 });
  const forest = CL.world.estimateHours(28, 30);
  Object.assign(w, { x: 70, y: 20 });
  const grass = CL.world.estimateHours(86, 20);
  assert.ok(forest > grass * 1.25, `forest ${forest.toFixed(2)}h vs grass ${grass.toFixed(2)}h`);
});

test('travelling to Eastwatch takes road time, advances the clock and autosaves on arrival', () => {
  const env = onMap(loadGame());
  const { CL, storage, uiCalls } = env;
  const expected = CL.world.estimateHours(62, 40);
  const [px, py] = CL.world.toPx(62, 40);
  CL.world.click(px, py);
  assert.equal(CL.game.travel.type, 'settlement');
  travel(CL);
  const hours = CL.campaign.day * 24;
  assert.ok(Math.abs(hours - expected) < 0.2, `took ${hours.toFixed(2)}h, expected ~${expected.toFixed(2)}h`);
  assert.ok(hours > 2 && hours < 5, 'a few hours on the road');
  assert.equal(CL.campaign.world.location, 'eastwatch');
  assert.equal(CL.game.mode, 'settlement');
  assert.equal(JSON.parse(storage.data.crownless_save).world.location, 'eastwatch');
  assert.ok(uiCalls.some((c) => c[0] === 'changeMode' && c[1] === 'settlement'));
});

test('recruits depend on the settlement owner and its services', () => {
  const { CL } = loadGame();
  assert.deepEqual(Array.from(CL.party.recruitsHere()), ['levy', 'hunter', 'mercenary'], 'towns also hire sell-swords');
  CL.campaign.world.location = 'eastwatch';
  assert.deepEqual(Array.from(CL.party.recruitsHere()), ['recruit', 'skirmisher', 'mercenary']);
  assert.equal(CL.party.recruit('levy'), false, 'Aurelian town does not train Valedorn levies');
  assert.equal(CL.party.recruit('recruit'), true);
  CL.campaign.world.location = 'oakford'; // village: trade + rest only
  assert.deepEqual(Array.from(CL.party.recruitsHere()), []);
  assert.equal(CL.party.canRest(), true);
  CL.campaign.world.location = null; // open map
  assert.equal(CL.party.canRest(), false);
  assert.equal(CL.party.rest().length, 0);
});

test('travel heals wounded soldiers as days pass', () => {
  const env = onMap(loadGame());
  const { CL } = env;
  CL.campaign.roster[0].woundedUntil = 0.1; // ~2.4 hours
  const [px, py] = CL.world.toPx(78, 52); // Redfield, most of a day away
  CL.world.click(px, py);
  travel(CL);
  assert.equal(CL.campaign.roster[0].woundedUntil, null);
});

test('the Reaver hideout opens an encounter, and victory clears it for 3 days', () => {
  const env = onMap(loadGame({ random: () => 0.5 }));
  const { CL } = env;
  const site = CL.world.map().sites.reaver_hideout;
  CL.world.click(...CL.world.toPx(site.mapX, site.mapY));
  travel(CL);
  assert.equal(CL.game.mode, 'encounter');
  assert.equal(CL.game.siteId, 'reaver_hideout');

  CL.world.attackSite();
  assert.equal(CL.game.mode, 'battle');
  assert.equal(CL.game.encounter, 'captains_trial');
  const dayBefore = CL.campaign.day;
  CL.party.endBattle(true);
  const cleared = CL.campaign.world.sites.reaver_hideout.clearedUntil;
  assert.ok(Math.abs(cleared - (dayBefore + CL.clock.hours('battle') / 24 + 3)) < 1e-9);
  CL.world.returnToMap();
  assert.equal(CL.game.mode, 'map');
  assert.deepEqual([CL.campaign.world.x, CL.campaign.world.y], [site.mapX, site.mapY], 'back where the battle was');

  // Revisit while cleared: no encounter.
  CL.world.travelTo({ type: 'site', id: 'reaver_hideout', x: site.mapX, y: site.mapY });
  assert.equal(CL.game.mode, 'map');
  assert.equal(CL.world.siteActive('reaver_hideout'), false);
  CL.party.advanceDays(3);
  assert.equal(CL.world.siteActive('reaver_hideout'), true);
});

test('defeat: half a day in captivity, then released at the nearest kingdom settlement', () => {
  const env = onMap(loadGame({ random: () => 0.5 }));
  const { CL, uiCalls } = env;
  const site = CL.world.map().sites.reaver_hideout;
  Object.assign(CL.campaign.world, { x: site.mapX, y: site.mapY });
  CL.game.siteId = 'reaver_hideout';
  CL.combat.startBattle('captains_trial');
  CL.party.endBattle(false);
  assert.equal(CL.campaign.day, (CL.clock.hours('battle') + CL.clock.hours('capture')) / 24);
  const nearest = CL.world.nearestSettlement(site.mapX, site.mapY, (s) => s.ownerFaction !== 'neutral');
  assert.deepEqual([CL.campaign.world.x, CL.campaign.world.y], [nearest.mapX, nearest.mapY]);
  assert.equal(CL.campaign.world.sites.reaver_hideout.clearedUntil, 0, 'hideout still active');
  CL.world.returnToMap();
  assert.ok(uiCalls.some((c) => c[0] === 'message' && c[1].includes(nearest.name)));
});

test('clicking hit-tests settlements and sites before open ground', () => {
  const { CL } = loadGame();
  const [sx, sy] = CL.world.toPx(50, 55);
  assert.equal(CL.world.targetAt(sx + 10, sy - 8).id, 'stonebridge');
  const open = CL.world.targetAt(...CL.world.toPx(80, 10));
  assert.equal(open.type, 'point');
  assert.ok(Math.abs(open.x - 80) < 1e-9 && Math.abs(open.y - 10) < 1e-9);
});

test('saved world state is sanitized', () => {
  const { CL } = loadGame();
  const w = CL.world.sanitize({ x: 140, y: -5, location: 'atlantis', sites: { reaver_hideout: { clearedUntil: 7 }, nowhere: {} } });
  assert.deepEqual([w.x, w.y], [100, 0]);
  assert.equal(w.location, null);
  assert.equal(w.sites.reaver_hideout.clearedUntil, 7);
  assert.equal('nowhere' in w.sites, false);
  const d = CL.world.sanitize(undefined);
  assert.equal(d.location, 'stonebridge', 'old saves without a world start at Stonebridge');
});

test('clock label shows day and hour', () => {
  const { CL } = loadGame();
  CL.campaign.day = 2.5;
  assert.equal(CL.world.clockLabel(), 'Day 3, 12:00');
});
