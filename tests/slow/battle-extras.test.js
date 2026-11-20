// P7-11 (design SC-42): each battle extra measured on its own under the same rules, with the effect on
// and then off on the same seeded encounters (scripts/extras.js). Each one makes a measurable
// difference; every fight ends. About 1½ minutes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/extras');

test('battle extras: each effect, on and off, makes a measurable difference', () => {
  const out = Object.fromEntries(run({ seeds: 20 }).map((r) => [r.effect, r]));
  for (const r of Object.values(out)) assert.equal(r.on.unfinished + r.off.unfinished, 0, `${r.effect}: every fight ends`);
  const { 'wall-melee': wm, 'wall-arrows': wa, wedge, hill, ford, wagon } = out;
  assert.ok(wm.on.lost < wm.off.lost, `the shield wall loses fewer soldiers to Reavers (${wm.on.lost} vs ${wm.off.lost})`);
  assert.ok(wa.on.win > wa.off.win && wa.on.lost < wa.off.lost, `the shield wall stands up to crossbows (${wa.on.win}% vs ${wa.off.win}%)`);
  assert.ok(wedge.on.win >= wedge.off.win, `the wedge wins at least as often (${wedge.on.win}% vs ${wedge.off.win}%)`);
  assert.ok(hill.on.win > hill.off.win, `archers on the knoll beat the crossbows more often (${hill.on.win}% vs ${hill.off.win}%)`);
  assert.ok(Math.abs(ford.on.lost - ford.off.lost) >= 0.2, `wading breaking the wedge changes the fight (${ford.on.lost} vs ${ford.off.lost} lost)`);
  assert.ok(wagon.on.wagon > 0 && wagon.on.wagon < wagon.on.win, `the wagon is at stake: saved in ${wagon.on.wagon}% of fights, won ${wagon.on.win}%`);
});
