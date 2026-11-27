// P11-14: the tactics lab's comparisons (scripts/tactics-lab.js --compare), each one's direction at a small
// seed count: a fast guard that combined arms keeps working. The measured tables at 40 seeds are in
// docs/PHASE-11-VALIDATION.md "Combined arms". A side's score: win % minus its own losses %.
const test = require('node:test');
const assert = require('node:assert/strict');
const { compare } = require('../scripts/tactics-lab');

const SEEDS = 2;
const score = (r) => r.win - r.allyLost;

/** Each comparison once, at SEEDS seeds a variant, on the lab's own field (60). */
const out = compare({ seeds: SEEDS, ids: ['screen', 'brace', 'flank', 'wall', 'hill', 'forest', 'hero'], size: 60 });

for (const [id, margin, what] of [
  ['screen', 30, 'archers behind a formed line beat archers in front'],
  ['brace', 10, 'spears braced in a line beat the same spears loose against horse'],
  ['flank', 5, 'horse held on the flank for the volley beats horse sent in first'],
  ['wall', 50, 'a shield wall beats loose ranks under arrows'],
  ['hill', 5, 'archers on the rise beat archers on the flat'],
]) {
  test(`the tactics lab, ${id}: ${what}`, () => {
    const r = out[id];
    assert.ok(score(r.plan) >= score(r.other) + margin, `${id}: plan ${score(r.plan).toFixed(0)} against ${score(r.other).toFixed(0)}`);
  });
}

test('the tactics lab, forest: a column on Charge does no worse than a line (it breaks into loose ranks in the fight)', () => {
  const r = out.forest;
  assert.ok(r.plan.win >= r.other.win - 50, `column ${r.plan.win} against line ${r.other.win}`);
});

test('the tactics lab, hero: a passive hero with a good plan wins, and beats an active hero on Auto', () => {
  const r = out.hero;
  assert.equal(r.plan.win, 100);
  assert.ok(score(r.plan) >= score(r.other), `passive with a plan ${score(r.plan).toFixed(0)} against active on Auto ${score(r.other).toFixed(0)}`);
  assert.ok(score(r.plan) > score(r.charge), 'and beats charging');
});
