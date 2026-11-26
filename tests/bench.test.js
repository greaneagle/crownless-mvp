// P11-00: the battle benchmark's frame-time detail (scripts/bench-battle.js in Node; Debug → Battle
// benchmark's result, js/party.js): percentiles, the frames over budget, the cache, the looks and the heap.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { bench } = require('../scripts/bench-battle');

test('the benchmark reports frame-time percentiles, the frames over budget, the cache and the heap', () => {
  // scripts/bench-battle.js (the simulation in Node)
  const r = bench(40, 'open_country', 1);
  for (const k of ['p50', 'p95', 'p99', 'max', 'over16', 'over33', 'heapMB']) assert.ok(Number.isFinite(r[k]), k);
  assert.ok(r.p50 <= r.p95 && r.p95 <= r.p99 && r.p99 <= r.max);
  // Debug → Battle benchmark's result (the practice battle's numbers, js/party.js), from samples as js/main.js records them.
  const { CL } = loadGame({ seed: 9 });
  CL.combat.setActiveCap(40);
  CL.combat.startBattle(CL.debugTools.benchDef(40));
  const p = CL.game.practice;
  for (let i = 0; i < 100; i++) {
    p.frameList.push(i === 99 ? 40 : i % 10 === 0 ? 20 : 16);
    p.simList.push(1);
    p.drawList.push(2);
  }
  CL.party.endBattle(true);
  const s = CL.game.result.practice;
  assert.deepEqual([s.frameP50, s.frameP95, s.frameP99, s.over16, s.over33, s.sampled, s.simP95, s.drawP95], [16, 20, 40, 11, 1, 100, 1, 2]);
  for (const k of ['cacheEntries', 'cacheHitRate', 'looks', 'heapMB']) assert.ok(k in s, k); // null in Node: no canvas, no performance.memory
  assert.match(CL.game.result.html, /p95 20/);
});
