// W-07 (slow): 80 parties over 90 days of rest, headless (scripts/bench-map.js --season). The world
// stays full, no day takes far longer than the rest (no slowdown spikes), and the save of that world
// stays inside its budget: under 100 KB. And fast-forward equivalence: a long rest in one step plays out
// like the same rest a day at a time (checked statistically: step size changes how the random streams
// are drawn, so only the kinds and amounts of what happens can match).
const test = require('node:test');
const assert = require('node:assert/strict');
const { season } = require('../../scripts/bench-map');
const { loadGame } = require('../helpers/load');

test('80 parties over 90 days: steady day times, and the save stays under 100 KB', () => {
  const r = season(80, 90);
  assert.ok(r.live >= 70, `the world stays full: ${r.live} parties`);
  assert.ok(r.saveKb < 100, `save ${r.saveKb.toFixed(1)} KB`);
  assert.ok(r.worst < 3 * r.median, `worst day ${r.worst.toFixed(1)} ms against a median of ${r.median.toFixed(1)} ms`);
});

test('Part 2 §27.4: 90 days of rest in one go plays like 90 one-day rests (in kind, over several seeds)', () => {
  const tally = (oneGo, seed) => {
    const { CL } = loadGame({ worldParties: true, seed });
    const c = CL.campaign;
    Object.assign(c, { food: 1e4, gold: 1e4 });
    if (oneGo) CL.party.advanceDays(90);
    else for (let d = 0; d < 90; d++) CL.party.advanceDays(1);
    const n = (msg) => CL.diag.events.filter((e) => e.msg === msg).length;
    return { arrived: n('Caravan arrived'), fights: n('Off-screen battle'), spawned: n('Party spawned'), parties: c.parties.length };
  };
  const sum = (oneGo) => {
    const t = { arrived: 0, fights: 0, spawned: 0, parties: 0 };
    for (const seed of [11, 22, 33]) for (const [k, v] of Object.entries(tally(oneGo, seed))) t[k] += v;
    return t;
  };
  const a = sum(true);
  const b = sum(false);
  for (const k of Object.keys(a)) {
    assert.ok(a[k] > 0, `${k} happens`);
    assert.ok(Math.abs(a[k] - b[k]) <= 0.25 * Math.max(a[k], b[k]), `${k}: ${a[k]} in one go, ${b[k]} a day at a time`);
  }
});
