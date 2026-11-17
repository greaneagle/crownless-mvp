// v1.0 save fixtures (docs/V2-PLAN.md 5.8 and V2-01): exported saves from five points in a real
// campaign, frozen at the v1.0 release. Every later build must still import them, keep what they
// hold, and be able to play on from them. Built by scripts/make-save-fixtures.js; do not regenerate
// casually; they stand for the saves real players have.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');
const { summary } = require('../scripts/make-save-fixtures');

const DIR = path.join(__dirname, 'fixtures', 'saves-v1.0');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));

test('the v1.0 fixture set covers a fresh start, a long campaign, mid-story work and both kinds of ending', () => {
  assert.equal(index.length, 5);
  const e = Object.fromEntries(index.map((f) => [f.file, f.expect]));
  assert.equal(e['new-game.json'].day, 0);
  assert.ok(e['campaign-day30.json'].day >= 30 && e['campaign-day30.json'].soldiers > 0);
  assert.equal(e['mid-story-escort.json'].contract, 'escort');
  assert.equal(e['mid-story-escort.json'].quests.q2, 'active');
  assert.equal(e['ending-road-peace-mara.json'].ending, 'compromise');
  assert.equal(e['ending-road-peace-mara.json'].companion, 'mara');
  assert.equal(e['ending-crown.json'].ending, 'valedorn');
});

for (const f of index) {
  test(`v1.0 save "${f.file}" still imports, keeps everything, and plays on`, () => {
    const text = fs.readFileSync(path.join(DIR, f.file), 'utf8');
    const { CL } = loadGame({ party: false });
    const r = CL.portable.importText(text);
    assert.equal(r.ok, true, `${r.reason} ${r.problems || ''}`);
    const c = CL.campaign;
    assert.deepEqual(JSON.parse(JSON.stringify(summary(c, CL))), f.expect);
    // Stable: exporting and importing again changes nothing.
    const again = loadGame({ party: false });
    assert.equal(again.CL.portable.importText(CL.portable.serialize(c)).ok, true);
    assert.equal(JSON.stringify(again.CL.campaign), JSON.stringify(c));
    // The campaign carries on: a few days pass, then a save and a load.
    CL.party.advanceDays(3);
    const later = f.expect.day + 3 - 0.001; // the summary rounds the day to three decimals
    assert.ok(c.day >= later);
    CL.save.write();
    assert.ok(CL.save.load().day >= later);
  });
}
