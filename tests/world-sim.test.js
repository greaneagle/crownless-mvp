// W-07: a world simulation that scales. The spatial grid changes nothing but speed; contacts are swept,
// so a coarse step can't carry two parties through each other; the same seed gives the same world; a
// long rest in one go plays like the same rest a day at a time; and kingdoms go to war and make peace
// by simple rules, the March pair held in tension by the story until its ending (decision D-W5).
// The 90-day runs (80 parties and the save size; a long rest in one go against a day at a time) are in
// tests/slow/world-sim.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

test('the grid finds everything a full scan would, in the same order', () => {
  const { CL } = loadGame();
  const k = CL.world.map().aspect;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const items = Array.from({ length: 300 }, (_, i) => ({ id: i, x: rnd() * 200, y: rnd() * 200 }));
  const grid = CL.spatial.build(items);
  for (let q = 0; q < 400; q++) {
    const [x, y, r] = [rnd() * 220 - 10, rnd() * 220 - 10, rnd() * 25];
    const want = items.filter((p) => Math.hypot(p.x - x, (p.y - y) * k) <= r).map((p) => p.id);
    const got = plain(
      CL.spatial
        .near(grid, x, y, r)
        .filter((p) => Math.hypot(p.x - x, (p.y - y) * k) <= r)
        .map((p) => p.id),
    );
    assert.deepEqual(got, want, `query ${q}`);
  }
});

/** A seeded world played for some days, with or without the grid. */
function played(days, { grid = true, seed = 4242 } = {}) {
  const { CL } = loadGame({ worldParties: true, seed });
  CL.parties.options.grid = grid;
  const c = CL.campaign;
  Object.assign(c, { food: 1e4, gold: 1e4 });
  for (let d = 0; d < days; d++) CL.party.advanceDays(1);
  return { CL, c };
}

test('with or without the grid, the same seed plays out exactly the same world', () => {
  const a = played(12, { grid: true });
  const b = played(12, { grid: false });
  assert.equal(JSON.stringify(a.c.parties), JSON.stringify(b.c.parties));
  assert.equal(JSON.stringify(a.c.news), JSON.stringify(b.c.news));
  assert.equal(JSON.stringify(a.c.relations), JSON.stringify(b.c.relations));
  assert.equal(JSON.stringify(a.c.markets), JSON.stringify(b.c.markets));
  // Determinism: the same seed again gives the same world.
  const again = played(12, { grid: true });
  assert.equal(JSON.stringify(again.c.parties), JSON.stringify(a.c.parties));
  assert.ok(a.c.parties.length > 20, 'a busy world');
});

test('swept contacts: a band and a caravan that cross within one coarse step still meet', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.parties = [];
  c.partySpawns = Object.fromEntries(Object.keys(CL.content.table('party_templates')).map((t) => [t, 1e9])); // no newcomers
  // Far from the player (in Stonebridge), on open grass in the eastern provinces: both act once an hour.
  const band = CL.parties.spawn(c, 'eastern_deserters');
  const caravan = CL.parties.spawn(c, 'aurelian_caravan');
  Object.assign(band, { x: 160, y: 80, tx: 166, ty: 80, troops: { mercenary: 6 } });
  Object.assign(caravan, { x: 166, y: 80, tx: 160, ty: 80, troops: { recruit: 1 } });
  assert.ok(CL.world.mapDist(c.world.x, c.world.y, 160, 80) > CL.parties.NEAR_PLAYER, 'far from the player');
  // Without sweeping they'd swap places in the hour (each moves 3–4 units over 6) and never be 1.6 apart.
  const caught = CL.parties.tick(c, CL.parties.COARSE_HOURS);
  assert.equal(caught, null);
  assert.equal(c.parties.includes(caravan), false, 'the band caught the caravan on the way past');
  assert.ok(c.news.events.some((e) => e.kind === 'caravan_lost'));
});

test('parties far from the player act once an hour; near ones every quarter hour', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.parties = [];
  c.partySpawns = Object.fromEntries(Object.keys(CL.content.table('party_templates')).map((t) => [t, 1e9]));
  const far = CL.parties.spawn(c, 'aurelian_caravan');
  const near = CL.parties.spawn(c, 'valedorn_caravan');
  Object.assign(far, { x: 170, y: 100, tx: 190, ty: 100 });
  Object.assign(near, { x: c.world.x + 2, y: c.world.y, tx: c.world.x + 22, ty: c.world.y });
  const was = { far: [far.x, far.y], near: [near.x, near.y] };
  CL.parties.tick(c, 0.25);
  assert.deepEqual([far.x, far.y], was.far, 'far: saving up its time');
  assert.notDeepEqual([near.x, near.y], was.near, 'near: moved');
  CL.parties.tick(c, 0.75);
  assert.notDeepEqual([far.x, far.y], was.far, 'far: a whole hour at once');
});

test('the per-region budget: no more regular parties spawn into a region that is full', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.parties = [];
  const cap = CL.world.map().simulation.partiesPerRegion;
  const lair = CL.world.map().sites.looter_camp;
  for (let i = 0; i < cap; i++) Object.assign(CL.parties.spawn(c, 'bandits'), { x: lair.mapX, y: lair.mapY });
  c.partySpawns = {};
  const before = c.parties.length;
  CL.parties.ensure(c);
  const inMarch = c.parties.filter((p) => CL.world.regionAt(p.x, p.y)?.id === CL.world.regionAt(lair.mapX, lair.mapY).id);
  assert.ok(inMarch.length <= cap, `${inMarch.length} in the region, cap ${cap}`);
  assert.ok(c.parties.length > before, 'other regions still fill');
});

// ---- War and peace (W-07, D-W5) ----

test('at the start: the March kingdoms in tension (held by the story), every other pair at peace', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const R = CL.realm;
  assert.equal(R.relation(c, 'valedorn', 'aurelian'), 'tension');
  assert.equal(R.relation(c, 'aurelian', 'valedorn'), 'tension', 'either way round');
  assert.equal(R.storyHeld(c, 'valedorn', 'aurelian'), true);
  const ks = R.kingdoms().map((k) => k.id);
  for (const a of ks) for (const b of ks) if (a < b && R.pairKey(a, b) !== R.pairKey('valedorn', 'aurelian')) assert.equal(R.relation(c, a, b), 'peace', `${a}–${b}`);
  assert.equal(R.relation(c, 'valedorn', 'valedorn'), null);
  assert.equal(R.relation(c, 'valedorn', 'neutral'), null, 'the Reavers have no relations');
});

test('the story holds the March pair in tension, however hot; after Q4 the ending sets it and the rules take over', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const R = CL.realm;
  for (let i = 0; i < 10; i++) R.clashed(c, 'valedorn', 'aurelian', 2, null);
  R.tickRelations(c, c.day + 200);
  assert.equal(R.relation(c, 'valedorn', 'aurelian'), 'tension', 'held until the ending');
  // The road peace ending: peace. A crown taking Greywall: war.
  CL.story.state(c).quests.q4 = { status: 'done', stage: 'q4_terms', notes: [] };
  CL.story.apply([{ ending: 'compromise', quest: 'q4' }], c, { quest: 'q4' });
  assert.equal(R.relation(c, 'valedorn', 'aurelian'), 'peace');
  assert.ok(c.news.events.some((e) => e.kind === 'peace_made'));
  const b = loadGame().CL;
  b.story.apply([{ ending: 'valedorn', quest: 'q4' }], b.campaign, { quest: 'q4' });
  assert.equal(b.realm.relation(b.campaign, 'valedorn', 'aurelian'), 'war');
  assert.equal(b.realm.storyHeld(b.campaign, 'valedorn', 'aurelian'), false);
});

test('rules: an incident sours peace; clashes heat tension into war; war wears out into a truce; quiet tension eases', () => {
  const { CL } = loadGame({ random: () => 0.1 });
  const c = CL.campaign;
  const R = CL.realm;
  const [a, b] = ['hrothmark', 'vessaro'];
  const at = { x: 100, y: 30 };
  // Peace → tension on a border incident (at most one a day).
  c.rngSeed = 1;
  let soured = false;
  for (let d = 0; d < 30 && !soured; d++) soured = R.incident(c, a, b, at, d);
  assert.equal(soured, true);
  assert.equal(R.relation(c, a, b), 'tension');
  assert.equal(R.incident(c, a, b, at, 40), false, 'no incidents once at odds');
  const e = c.news.events.find((x) => x.kind === 'tension_rising');
  assert.equal(e.faction, a);
  assert.equal(e.other, b);
  // Tension → war after four clashes.
  const day0 = c.day;
  for (let i = 0; i < R.RELATIONS.warHeat - 1; i++) R.clashed(c, a, b, 2, at, day0 + i);
  assert.equal(R.relation(c, a, b), 'tension');
  R.clashed(c, a, b, 2, at, day0 + 4);
  assert.equal(R.relation(c, a, b), 'war');
  assert.match(CL.news.bulletin(c, day0 + 4).text, /^Hrothmark and Vessaro are at war\. Blood was spilled in the northern highlands/);
  // War → tension: not before the minimum, then once losses reach exhaustion.
  const since = day0 + 4;
  R.clashed(c, a, b, R.RELATIONS.exhaustion, at, since + 1);
  R.tickRelations(c, since + R.RELATIONS.minWar - 1);
  assert.equal(R.relation(c, a, b), 'war', 'not over yet');
  R.tickRelations(c, since + R.RELATIONS.minWar);
  assert.equal(R.relation(c, a, b), 'tension', 'an exhausted truce');
  assert.ok(c.news.events.some((x) => x.kind === 'truce'));
  // A war with few losses still ends after the longest.
  R.setRelation(c, a, b, 'war', 'test', null, 100);
  R.tickRelations(c, 100 + R.RELATIONS.maxWar);
  assert.equal(R.relation(c, a, b), 'tension');
  // Quiet tension cools to peace.
  const t0 = 100 + R.RELATIONS.maxWar;
  R.clashed(c, a, b, 1, at, t0);
  for (let d = 1; d <= 200 && R.relation(c, a, b) === 'tension'; d++) R.tickRelations(c, t0 + d);
  assert.equal(R.relation(c, a, b), 'peace');
});

test('patrols of kingdoms at peace meet without a fight; at odds they clash', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.parties = [];
  c.partySpawns = Object.fromEntries(Object.keys(CL.content.table('party_templates')).map((t) => [t, 1e9]));
  const men = (p) => CL.parties.troopCount(p);
  const meet = () => {
    const h = CL.parties.spawn(c, 'hrothmark_patrol');
    const v = CL.parties.spawn(c, 'valedorn_patrol');
    Object.assign(h, { x: c.world.x + 5, y: c.world.y, tx: null });
    Object.assign(v, { x: c.world.x + 5.5, y: c.world.y, tx: null });
    return [h, v, men(h), men(v)];
  };
  c.news.clashUntil = 0;
  const [h, v, mh, mv] = meet();
  CL.parties.tick(c, 0.25);
  assert.equal(men(h) + men(v), mh + mv, 'at peace: nobody falls');
  c.parties = [];
  CL.realm.setRelation(c, 'hrothmark', 'valedorn', 'war', 'test');
  c.news.clashUntil = 0;
  const [h2, v2, mh2, mv2] = meet();
  CL.parties.tick(c, 0.25);
  assert.ok(men(h2) + men(v2) < mh2 + mv2 || !c.parties.includes(h2) || !c.parties.includes(v2), 'at war: a clash');
  assert.ok(c.news.events.some((e) => e.kind === 'frontier_clash' && [e.winner, e.loser].sort().join() === 'hrothmark,valedorn'));
});

// ---- Saves (schema v10) ----

test('relations are saved; junk is repaired; a v9 save of the bigger world migrates on (v10: relations)', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  const c = CL.campaign;
  CL.realm.setRelation(c, 'merrow', 'vessaro', 'war', 'test');
  c.relations[CL.realm.pairKey('merrow', 'vessaro')].losses = 5;
  CL.save.write();
  const back = loadGame({ storage }).CL.campaign;
  assert.equal(back.relations[CL.realm.pairKey('merrow', 'vessaro')].state, 'war');
  assert.equal(back.relations[CL.realm.pairKey('merrow', 'vessaro')].losses, 5);
  const junk = CL.save.sanitize({ ...plain(c), relations: { 'merrow|vessaro': { state: 'feud' }, 'aurelian|valedorn': { state: 'war', heat: -3, since: 'x' }, 'x|y': { state: 'war' } } });
  assert.equal(junk.relations['merrow|vessaro'].state, 'peace', 'unknown states fall back');
  assert.equal(junk.relations['aurelian|valedorn'].state, 'war');
  assert.equal(junk.relations['aurelian|valedorn'].heat, 0);
  assert.equal(junk.relations['x|y'], undefined);
  // A 2.7 save (schema v9) left in the browser: migrated, kept as it was, relations from the world.
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'saves-2.7', 'story-played.json'), 'utf8'));
  const old = JSON.stringify(file.campaign);
  const s2 = memoryStorage({ crownless_save: old });
  const g = loadGame({ storage: s2, party: false }).CL;
  assert.equal(g.campaign.version, 17); // on through v10 (relations), v11–v13 (followers), v14 (detachments), v15 (companions), v16 (world events) and v17 (tournaments)
  assert.equal(s2.data[g.save.preMigrationKey(9)], old);
  assert.equal(g.realm.relation(g.campaign, 'valedorn', 'aurelian'), 'tension');
  assert.equal(g.realm.relation(g.campaign, 'hrothmark', 'merrow'), 'peace');
  assert.equal(g.campaign.character.name, file.campaign.character.name);
});

test('the Debug map stress test: 80 parties and fast time, reported apart, then the campaign put back as it was', () => {
  const { CL, storage } = loadGame();
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  const c = CL.campaign;
  const before = JSON.stringify(c);
  CL.debugTools.mapStress(80);
  assert.equal(c.parties.length, 80);
  const dt = 1 / 30;
  for (let i = 0; i < 2000 && CL.game.mapStress; i++) {
    CL.debugTools.stressFrame(dt);
    CL.mapView.update(dt);
    CL.mapView.testFrame(1, 1, dt); // drawing isn't loaded in Node: the main loop measures it in the browser
  }
  const r = CL.game.mapStressResult;
  assert.equal(r.parties, 80);
  assert.ok(r.days > 7, `${r.days} game days in the test's 8 seconds`);
  assert.equal(r.runs.length, 2);
  for (const run of r.runs) assert.ok('simMs' in run && 'drawMs' in run, 'simulation and drawing reported apart');
  assert.ok(r.saveKb > 0 && r.saveMs >= 0);
  assert.equal(JSON.stringify(c), before, 'the campaign exactly as it was');
  assert.equal(storage.data.crownless_stress_probe, undefined, 'the scratch save is gone');
});
