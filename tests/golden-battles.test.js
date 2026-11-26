// P11-01: golden battles. The combat profile must not change a single frame. Each scenario of
// tests/helpers/golden.js (the benchmark's battle at 40, the five parity scenarios fought by the masher,
// a tournament bout, an assault) is fought from its seed, and its digest of every frame's positions, HP,
// facings, swings and arrows must equal the one recorded on 5.0.1 before the profile, as must how it ended.
// If a later task changes combat on purpose, it re-records them (`node tests/helpers/golden.js --write`)
// and says so in its Done paragraph.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { FILE, SCENARIOS_GOLDEN } = require('./helpers/golden');

const expected = JSON.parse(fs.readFileSync(FILE, 'utf8')).scenarios;

test('every golden scenario is recorded', () => {
  assert.deepEqual(Object.keys(SCENARIOS_GOLDEN).sort(), Object.keys(expected).sort());
});

for (const [name, fight] of Object.entries(SCENARIOS_GOLDEN)) {
  test(`golden battle ${name}: the same, frame for frame`, () => {
    const got = fight();
    const want = expected[name];
    // How it ended first (the clearer message when it differs), then every frame.
    assert.deepEqual({ ...got, digest: undefined }, { ...want, digest: undefined }, `${name}: the ending`);
    assert.equal(got.digest, want.digest, `${name}: some frame differs`);
  });
}
