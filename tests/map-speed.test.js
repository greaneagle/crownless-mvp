// P10-01: the map's speed (Normal 1 game hour a real second, Fast 4) and the Wait screen's wait.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const H = 1 / 24;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a new device runs the map at Normal; unknown values fall back to it', () => {
  const { CL } = loadGame({ mapSpeed: null });
  assert.equal(CL.world.rate(), 1);
  assert.deepEqual({ ...CL.settings.MAP_SPEEDS }, { normal: 1, fast: 4 });
  assert.equal(CL.settings.defaults().mapSpeed, 'normal');
  assert.equal(CL.settings.sanitize({}).mapSpeed, 'normal', 'settings from before 4.1.0');
  assert.equal(CL.settings.sanitize({ mapSpeed: 'warp' }).mapSpeed, 'normal');
  assert.equal(CL.settings.set('mapSpeed', 'warp'), false);
});

test('the rate follows the setting: one real second is an hour at Normal, four at Fast', () => {
  const { CL } = loadGame({ mapSpeed: 'normal' });
  const c = CL.campaign;
  CL.world.leaveSettlement();
  c.food = 100;
  assert.equal(CL.world.rate(), 1);
  CL.world.toggleWait(); // open-ended waiting, as the bots use it
  let day = c.day;
  for (let i = 0; i < 10; i++) CL.world.update(0.1);
  assert.ok(near(c.day - day, 1 * H), 'Normal');
  CL.settings.set('mapSpeed', 'fast');
  assert.equal(CL.world.rate(), 4);
  day = c.day;
  for (let i = 0; i < 10; i++) CL.world.update(0.1);
  assert.ok(near(c.day - day, 4 * H), 'Fast');
});

test('travel at Normal takes four times the real seconds of Fast, for the same game hours', () => {
  const ride = (mapSpeed) => {
    const { CL } = loadGame({ mapSpeed });
    const c = CL.campaign;
    CL.world.leaveSettlement();
    const s = CL.content.table('settlements').hrothgard; // a long ride: the 0.05 s steps don't matter
    const day = c.day;
    CL.world.travelTo({ type: 'settlement', id: 'hrothgard', x: s.mapX, y: s.mapY });
    let seconds = 0;
    while (CL.game.travel && CL.game.mode === 'map' && seconds < 600) {
      CL.world.update(0.05);
      seconds += 0.05;
    }
    return { seconds, hours: (c.day - day) * 24 };
  };
  const normal = ride('normal');
  const fast = ride('fast');
  assert.ok(Math.abs(normal.hours / fast.hours - 1) < 0.02, 'about the same journey in game hours (terrain is read once a step)');
  assert.ok(fast.seconds > 3 && Math.abs(normal.seconds / fast.seconds - 4) < 0.1, `${normal.seconds} s against ${fast.seconds} s`);
});

test('a wait moves the clock by its hours and runs what time drives', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  CL.world.leaveSettlement();
  c.food = 100;
  const [day, food] = [c.day, c.food];
  const p = CL.world.waitNow(30);
  assert.equal(p.cut, false);
  assert.ok(near(c.day - day, 30 * H));
  assert.ok(c.food < food, 'the company ate');
  assert.equal(CL.game.waitPlan, null);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && x[1] === '1 day and 6 hours have passed.'), 'says how long');
  assert.equal(CL.world.span(1), '1 hour');
  assert.equal(CL.world.span(72), '3 days');
  assert.equal(CL.world.span(0.2), 'less than an hour');
});

test('a wait is 1 hour to 30 days, only on the map, one at a time', () => {
  const { CL } = loadGame();
  CL.game.mode = 'settlement';
  assert.equal(CL.world.beginWait(5), false, 'not in a settlement');
  CL.world.leaveSettlement();
  assert.equal(CL.world.beginWait(Number.NaN), false);
  assert.equal(CL.world.beginWait(10000), true);
  assert.equal(CL.game.waitPlan.hours, 30 * 24);
  assert.equal(CL.world.beginWait(3), false, 'one at a time');
  CL.game.waitPlan = null;
  CL.world.beginWait(0.2);
  assert.equal(CL.game.waitPlan.hours, 1);
});

test('the wait fades out, passes, fades back; no taps travel meanwhile', () => {
  const { CL } = loadGame({ mapSpeed: 'normal' });
  const c = CL.campaign;
  CL.world.leaveSettlement();
  c.food = 100;
  const day = c.day;
  const fades = [];
  CL.ui.setFade = (o) => fades.push(o);
  assert.equal(CL.world.beginWait(48), true);
  CL.world.update(0.1);
  assert.equal(c.day, day, 'no time passes while the screen darkens');
  assert.equal(CL.game.waitPlan.phase, 'dusk');
  CL.world.click(...CL.world.toPx(60, 60));
  assert.equal(CL.game.travel, null, 'a tap does nothing during a wait');
  for (let i = 0; i < 400 && CL.game.waitPlan; i++) CL.world.update(0.1);
  assert.equal(CL.game.waitPlan, null);
  assert.ok(near(c.day - day, 2), 'two days passed');
  assert.ok(fades.some((o) => o > 0 && o < 1) && fades.includes(1), 'darkens');
  assert.equal(fades.at(-1), 0, 'and clears');
  assert.equal(CL.game.mode, 'map');
});

test('a band that reaches you cuts the wait short and opens the encounter, saying so', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.world.leaveSettlement();
  c.roster = []; // alone: an easy mark
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 77, y: 20, troops: { looter: 5, reaver: 2 }, tx: null, ty: null });
  CL.game.mode = 'map';
  const day = c.day;
  const w = CL.world.waitNow(5 * 24);
  assert.equal(w.cut, true);
  assert.ok(c.day - day < 1, `stopped early (${((c.day - day) * 24).toFixed(1)} hours)`);
  assert.equal(CL.game.mode, 'encounter');
  assert.equal(CL.game.partyId, p.id);
  assert.match(CL.game.waitCut, /^Your wait is cut short after (less than an hour|\d+ hours?)\.$/);
});
