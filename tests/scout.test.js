// P7-02: the scout. Sees further; warns of hostile parties by P7-04's sight rules, with a scout's honest
// numbers; estimates rides (within 10% of the real time) and what is known on the way; more ground to
// set up on when you attack; wages and saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const GRASS = [125, 70];

/** In Stonebridge with crowns; optionally a scout. */
function camp(withScout = true, opts = {}) {
  const env = loadGame(opts);
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.gold = 1000;
  c.food = 300;
  if (withScout) assert.ok(CL.scout.hire(c));
  c.parties = [];
  c.partySpawns = Object.fromEntries(Object.keys(CL.content.table('party_templates')).map((t) => [t, 1e9]));
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, S: CL.scout, messages };
}

/** Out on open grass in the morning. */
function outside(CL, c) {
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  Object.assign(c.world, { x: GRASS[0], y: GRASS[1] });
  c.day = Math.floor(c.day) + 0.25; // 06:00, so half a day on is still daylight
}

test('hired in towns; wages with the rest; unpaid twice, they leave', () => {
  const { CL, c, S } = camp(false);
  c.world.location = 'oakford';
  assert.equal(S.canHire(c), false);
  c.world.location = 'stonebridge';
  assert.ok(S.hire(c));
  assert.equal(CL.quartermaster.wagesDue(c), CL.upkeep.weeklyWages(c) + S.WAGE);
  c.gold = 0;
  c.accounts.chest = 0;
  S.payday(c);
  S.payday(c);
  assert.equal(S.get(c), null);
});

test('the company sees half as far again with a scout', () => {
  const without = camp(false);
  const withS = camp(true);
  for (const { CL, c } of [without, withS]) {
    outside(CL, c);
    const band = CL.parties.spawn(c, 'bandits');
    Object.assign(band, { x: GRASS[0] + 15, y: GRASS[1] });
  }
  const seen = (e) => e.CL.sight.playerSees(e.c, e.c.parties[0]);
  assert.equal(seen(without), false, '15 units: beyond the company’s 12');
  assert.equal(seen(withS), true, 'within a scout’s 18');
  assert.equal(withS.CL.sight.playerRange(withS.c, withS.c.parties[0]), withS.CL.sight.PLAYER_SIGHT * withS.S.SIGHT);
});

test('warnings follow the sight rules, with a scout’s numbers and a heading; once per party per half day', () => {
  const { CL, c, S, messages } = camp();
  outside(CL, c);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: GRASS[0] + 10, y: GRASS[1] - 10, troops: { looter: 5, reaver: 2 }, tx: GRASS[0], ty: GRASS[1] });
  const said = S.warn(c);
  assert.deepEqual(plain(said), ['about 8 Reavers to the north-east, riding this way']);
  assert.match(messages().at(-1), /^Scout .+: about 8 Reavers to the north-east, riding this way\.$/);
  assert.deepEqual(plain(S.warn(c)), [], 'not again so soon');
  assert.deepEqual(plain(S.warn(c, c.day + S.WARN_EVERY)), ['about 8 Reavers to the north-east, riding this way'], 'again after half a day');
  // What the company can't see, the scout can't report: at night it is too far off.
  band.warnedAt = undefined;
  assert.deepEqual(plain(S.warn(c, Math.floor(c.day) + 1 + 23 / 24)), [], 'out of sight at night');
  // Friendly traffic is no threat.
  const caravan = CL.parties.spawn(c, 'aurelian_caravan');
  Object.assign(caravan, { x: GRASS[0] + 3, y: GRASS[1] });
  band.warnedAt = c.day;
  assert.deepEqual(plain(S.warn(c)), []);
  // A scout's numbers.
  assert.deepEqual([1, 3, 5, 7, 9, 12, 14, 23].map(S.about), ['a few', 'a few', 'about 6', 'about 8', 'about 10', 'about 10', 'about 15', 'about 25']);
  // Without a scout, no warnings at all.
  const none = camp(false);
  outside(none.CL, none.c);
  Object.assign(none.CL.parties.spawn(none.c, 'bandits'), { x: GRASS[0] + 5, y: GRASS[1] });
  assert.deepEqual(plain(none.S.warn(none.c)), []);
});

test('a ride’s estimate is within 10% of the real time, and names what is known near the way', () => {
  const { CL, c, S, messages } = camp();
  const ew = CL.content.get('settlements', 'eastwatch');
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  const target = { type: 'settlement', id: 'eastwatch', x: ew.mapX, y: ew.mapY };
  const e = S.estimate(c, target);
  assert.match(e.text, /^Scout .+: about \d+(\.5)? hours to Eastwatch; the way looks clear, as far as I know\.$/);
  const day0 = c.day;
  CL.world.travelTo(target);
  assert.equal(messages().at(-1), e.text, 'told as you set off');
  for (let i = 0; i < 5000 && CL.game.travel; i++) CL.world.update(0.05);
  const actual = (c.day - day0) * 24;
  assert.ok(Math.abs(e.hours - actual) <= 0.1 * actual, `estimate ${e.hours.toFixed(2)} h, actual ${actual.toFixed(2)} h`);
  const said = Number(e.text.match(/about ([\d.]+) hours/)[1]);
  assert.ok(Math.abs(said - actual) <= 0.1 * actual, `said ${said} h, actual ${actual.toFixed(2)} h`);
  // Bands known near the way are named; those far off, or never seen, are not.
  const sb = CL.content.get('settlements', 'stonebridge');
  Object.assign(c.world, { x: sb.mapX, y: sb.mapY, location: null });
  const near = CL.parties.spawn(c, 'bandits');
  Object.assign(near, { x: (sb.mapX + ew.mapX) / 2, y: (sb.mapY + ew.mapY) / 2 + 2, troops: { looter: 5 } });
  const far = CL.parties.spawn(c, 'bandits');
  Object.assign(far, { x: sb.mapX, y: sb.mapY + 60 });
  CL.sight.look(c);
  const e2 = S.estimate(c, target);
  assert.equal(e2.dangers.length, 1);
  assert.match(e2.text, /about 6 Reavers near the way/);
  // Hours become days on long rides.
  assert.equal(S.howLong(50), 'about 2 days');
  assert.equal(S.howLong(0.4), 'under an hour');
});

test('more ground to set up on when you attack a band, not when it ambushes you', () => {
  const without = camp(false);
  const withS = camp(true);
  const map = withS.CL.arena.mapFor('open_country');
  const area = (z) => (z.x1 - z.x0) * (z.y1 - z.y0);
  assert.ok(area(withS.CL.prep.zone(map)) > area(without.CL.prep.zone(map)) * 1.3);
  assert.deepEqual(plain(withS.CL.prep.zone(map, true)), plain(without.CL.prep.zone(map, true)));
});

test('saves: the scout is kept; a v12 save migrates to v13', () => {
  const storage = memoryStorage();
  const { CL, c } = camp(true, { storage });
  CL.save.write();
  assert.equal(loadGame({ storage }).CL.campaign.followers.scout.name, c.followers.scout.name);
  const v12 = plain(c);
  v12.version = 12;
  delete v12.followers.scout;
  const r = CL.save.fromRaw(v12);
  assert.equal(r.campaign.version, 17);
  assert.equal(r.campaign.followers.scout, null);
});
