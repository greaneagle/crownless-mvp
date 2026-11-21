// P8-06a (slow): the landed world alone (`npm run landed`), 180 days after the story's ending on three
// seeds. Forts change hands by sieges; no realm loses every fort (no snowball, design §20.7); the
// invariants hold every day.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/landed');

test('180 days of the world alone: forts change hands, nobody loses them all, the invariants hold', () => {
  let taken = 0;
  for (const seed of [1, 2, 3]) {
    const r = run(seed, 180);
    assert.deepEqual(r.problems, [], `seed ${seed}: invariants`);
    for (const t of r.timeline) for (const [f, n] of Object.entries(t.forts)) assert.ok(n >= 1, `seed ${seed}, day ${t.day}: ${f} has no fort`);
    assert.ok(r.begun > 0, `seed ${seed}: sieges begin`);
    taken += r.fell;
  }
  assert.ok(taken > 0, 'forts do change hands');
});
