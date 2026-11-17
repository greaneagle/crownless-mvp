// The campaign clock (V2-04; design §5, SC-10–12). One calendar; it moves only on the map (travel and
// waiting) and by fixed, named amounts from the world data: a battle 4 hours however long it is fought
// (owner decision 2026-11-17), captivity 12, a rest 24. Pausing, menus, towns and reloads add nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const H = 1 / 24;
const near = (a, b) => Math.abs(a - b) < 1e-9;

/** A Reaver band beside the player on open grass, its encounter open. */
function band(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 4, reaver: 2 }, tx: null, ty: null });
  CL.parties.open(p.id);
  return { ...env, c, p };
}

test('the fixed times come from the world data and are checked at load', () => {
  const { CL, sandbox } = loadGame();
  assert.deepEqual([CL.clock.hours('battle'), CL.clock.hours('capture'), CL.clock.hours('rest')], [4, 12, 24]);
  const time = sandbox.CROWNLESS_CONTENT.world_map.border_march.time;
  time.battle = -1;
  time.nap = 2;
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /time\.battle must be 0–168 hours/);
  assert.match(errors, /unknown time nap/);
});

test('a fought battle costs 4 hours, whether it lasts ten seconds or five minutes', () => {
  const days = [];
  for (const seconds of [10, 300]) {
    const { CL } = loadGame({ random: () => 0.99 });
    CL.combat.startBattle('captains_trial');
    CL.game.godMode = true;
    const start = CL.campaign.day;
    for (let t = 0; t < seconds && CL.game.mode === 'battle'; t += 0.05) CL.combat.update(0.05);
    assert.equal(CL.campaign.day, start, 'no campaign time passes while fighting');
    if (CL.game.mode === 'battle') CL.party.endBattle(true);
    days.push(CL.campaign.day - start);
  }
  assert.ok(near(days[0], 4 * H) && near(days[1], 4 * H), String(days));
});

test('SC-10: five real minutes paused in battle add nothing, and nor does the map loop meanwhile', () => {
  const { CL } = loadGame();
  CL.combat.startBattle('captains_trial');
  CL.game.paused = true;
  const start = CL.campaign.day;
  for (let i = 0; i < 300 * 20; i++) {
    CL.combat.update(0.05);
    CL.world.update(0.05); // the main loop calls it every frame; off the map it does nothing
  }
  assert.equal(CL.campaign.day, start);
});

test('SC-12: auto-resolving the same encounter costs the same 4 hours, win or lose', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { CL, c } = band({ seed });
    const start = c.day;
    const r = CL.parties.autoResolve();
    const expected = r.win ? 4 * H : (4 + 12) * H; // a loss is a capture too
    assert.ok(near(c.day - start, expected), `seed ${seed}: ${c.day - start}`);
  }
});

test('a lost battle: 4 hours of battle, then 12 hours captive', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.combat.startBattle('captains_trial');
  const start = c.day;
  CL.party.endBattle(false);
  assert.ok(near(c.day - start, 16 * H));
  assert.ok(CL.diag.events.some((e) => e.msg === 'Time passes' && e.data.reason === 'battle' && e.data.hours === 4));
  assert.ok(CL.diag.events.some((e) => e.msg === 'Time passes' && e.data.reason === 'capture' && e.data.hours === 12));
});

test('a retreat and a toll take no time', () => {
  const { CL, c } = band();
  let seed = 1;
  for (; seed < 500; seed++) {
    c.rngSeed = seed;
    if (CL.autoresolve.next(c) < CL.parties.retreatChance(c, CL.parties.current())) break;
  }
  c.rngSeed = seed;
  const start = c.day;
  assert.equal(CL.parties.retreat(), true);
  assert.equal(c.day, start);
  const second = band();
  second.c.roster = [];
  second.p.troops = { reaver: 12 };
  second.c.gold = 500;
  const before = second.c.day;
  assert.equal(second.CL.parties.negotiate(), true);
  assert.equal(second.c.day, before);
});

test('resting a day is 24 hours through the clock', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.world.location = 'stonebridge';
  const start = c.day;
  CL.party.rest();
  assert.ok(near(c.day - start, 1));
  assert.ok(CL.diag.events.some((e) => e.msg === 'Time passes' && e.data.reason === 'rest'));
});

test('travel and waiting move the clock at the map rate; towns and menus do not', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.game.mode = 'settlement';
  const start = c.day;
  for (let i = 0; i < 100; i++) CL.world.update(0.1);
  assert.equal(c.day, start, 'in a settlement menu');
  CL.game.mode = 'map';
  CL.game.waiting = true;
  for (let i = 0; i < 10; i++) CL.world.update(0.1); // one real second
  assert.ok(near(c.day - start, CL.world.HOURS_PER_SECOND * H));
});

test('a battle abandoned by a reload costs nothing, and the next one costs its 4 hours once', () => {
  const storage = memoryStorage();
  const first = loadGame({ storage });
  first.CL.save.write();
  const start = first.CL.campaign.day;
  first.CL.combat.startBattle('captains_trial');
  for (let i = 0; i < 100; i++) first.CL.combat.update(0.05);
  // The page is closed mid-battle: battles are never saved halfway.
  const { CL } = loadGame({ storage });
  assert.equal(CL.campaign.day, start);
  CL.combat.startBattle('captains_trial');
  CL.party.endBattle(true);
  CL.party.endBattle(true); // a stray second call
  assert.ok(near(CL.campaign.day - start, 4 * H));
});
