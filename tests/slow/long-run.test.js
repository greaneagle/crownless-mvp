// P10-00 (SC-29, D-P9i): ten years of the world alone, every invariant every day (scripts/long-run.js;
// the 30-year run is `npm run long-run`, in no suite). No negative money, no holding changing hands
// back and forth, no endless event loop, no runaway realm; the save stays inside its budget.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/long-run');

test('ten years of the world alone: every invariant holds every day, and the save stays under 4 MB', () => {
  const r = run(1, 10);
  assert.deepEqual(r.problems, [], `${r.total} problems`);
  assert.equal(r.years_.length, 10, 'all ten years played');
  const last = r.years_.at(-1);
  assert.ok(last.saveKB < 4096, `save ${last.saveKB} KB after ten years`);
  assert.ok(last.realms >= 2, 'more than one realm still stands');
  // The day's cost does not run away as the years pile up.
  assert.ok(last.msADay < 4 * r.years_[0].msADay + 50, `a day costs ${last.msADay} ms in year 10, ${r.years_[0].msADay} in year 1`);
});
