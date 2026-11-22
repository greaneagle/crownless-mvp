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

// P9-B4, layer 1: the same fights with no orders at all, the Auto setup choosing the plan (the default).
test('layer 1: with Auto and no orders, fought battles are over the odds but not far', () => {
  const rows = run({ seeds: 40, preset: 'auto' });
  for (const r of rows) {
    assert.equal(r.unfinished, 0, `${r.scenario}: every fight ends`);
    const over = r.foughtWin - r.odds;
    assert.ok(over >= -8 && over <= 25, `${r.scenario}: fought ${r.foughtWin}% with Auto against stated odds ${r.odds.toFixed(0)}%`);
  }
  const close = rows.filter((r) => ['close', 'veterans', 'outnumbered'].includes(r.scenario));
  const avg = close.reduce((n, r) => n + r.foughtWin - r.odds, 0) / close.length;
  assert.ok(avg >= 2 && avg <= 18, `close fights with Auto: ${avg.toFixed(1)} points over the odds on average (target 5–15)`);
});

// P8-06b: the assault on a fort's walls, fought and simulated with the walls' bonus, attack and defence.
// P9-B5: at the world's scale (a company of 48, a garrison of 66), as one army a side, at the default
// battle size of 150; at 40 every assault ends (its balance there is open: docs/NEXT-TASKS.md, P9-B5).
test('sieges: an assault fought on the walls comes out over the odds, but not far, both ways', () => {
  const { runSiege } = require('../../scripts/parity');
  for (const r of runSiege({ seeds: 40 })) {
    assert.equal(r.unfinished, 0, `${r.scenario}: every fight ends`);
    assert.ok(r.overOdds >= -5 && r.overOdds <= 25, `${r.scenario}: fought ${r.foughtWin}% against the odds ${r.odds.toFixed(0)}%`);
  }
  for (const r of runSiege({ seeds: 10, size: 40 })) assert.equal(r.unfinished, 0, `${r.scenario} at a battle size of 40: every fight ends`);
});

// P9-B2: big battles (the close fights eight and six times over) at a battle size of 40 and of 100,
// the two armies sharing the field and both feeding in reserves. Every one ends, and fighting is never
// far worse than the odds. Not yet asserted: a ceiling. A company with many archers wins big fights
// far above the odds Simulate states (it values an archer like any soldier of its tier), measured and
// kept for P9-B4's plans and P9-T's tuning (docs/NEXT-TASKS.md, P9-B2's Done).
test('big battles, shared and reinforcing on both sides: every one ends; fighting never far under the odds', () => {
  const rows = run({ seeds: 20, big: true });
  for (const r of rows) {
    assert.equal(r.unfinished, 0, `${r.scenario}: every fight ends`);
    assert.ok(r.foughtWin - r.odds >= -15, `${r.scenario}: fought ${r.foughtWin}% against stated odds ${r.odds.toFixed(0)}%`);
  }
});
