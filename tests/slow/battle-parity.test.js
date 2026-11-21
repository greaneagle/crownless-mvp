// B-01 (slow): fought against Simulate (scripts/parity.js, 40 seeds a scenario). Fought battles come
// out ahead of the stated odds, but not by a mile, and Simulate is only a little worse than fighting.
// The target is 5–15 points over the odds; with 40 seeds a scenario is good to about ±8, so the check
// allows 0–25 for each and asks the close fights' average to sit inside the target.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/parity');

test('fought battles: over the stated odds, but not far; Simulate only a little worse; every fight ends', () => {
  const rows = run({ seeds: 40 });
  for (const r of rows) {
    assert.equal(r.unfinished, 0, `${r.scenario}: every fight ends`);
    const over = r.foughtWin - r.odds;
    assert.ok(over >= -8 && over <= 25, `${r.scenario}: fought ${r.foughtWin}% against stated odds ${r.odds.toFixed(0)}%`);
    assert.ok(r.foughtWin - r.autoWin <= 25, `${r.scenario}: fought ${r.foughtWin}% against Simulate ${r.autoWin}%`);
  }
  const close = rows.filter((r) => ['close', 'veterans', 'outnumbered'].includes(r.scenario));
  const avg = close.reduce((n, r) => n + r.foughtWin - r.odds, 0) / close.length;
  assert.ok(avg >= 2 && avg <= 18, `close fights: ${avg.toFixed(1)} points over the odds on average (target 5–15)`);
});

// P8-06b: the assault on a fort's walls, fought and simulated with the walls' bonus, attack and defence.
test('sieges: an assault fought on the walls comes out over the odds, but not far, both ways', () => {
  const { runSiege } = require('../../scripts/parity');
  for (const r of runSiege({ seeds: 40 })) {
    assert.equal(r.unfinished, 0, `${r.scenario}: every fight ends`);
    assert.ok(r.overOdds >= -5 && r.overOdds <= 25, `${r.scenario}: fought ${r.foughtWin}% against the odds ${r.odds.toFixed(0)}%`);
  }
});
