// Battle simulation benchmark (GDD §6 scaling; §12 performance targets; P9-B1). Runs the Debug
// panel's battle benchmark headlessly (the same open-field battle at 40, 60, 80, 100, 120, 150 and 200 at
// once, with reserves keeping the field full) at a fixed 60 Hz step, and reports the simulation's cost
// per frame. Drawing is not included: measure that in the browser with Debug → Battle benchmark.
//   node scripts/bench-battle.js [seconds=20] [--maps]   (--maps: also the forest and the courtyard)
const { loadGame } = require('../tests/helpers/load');

const SIZES = [40, 60, 80, 100, 120, 150, 200];
const MAPS = ['open_country', 'forest_wilds', 'greywall_courtyard'];
const STEP = 1 / 60;
const STUCK = { every: 5, moved: 2, near: 140 }; // s between samples; px moved; px to the nearest opponent

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The benchmark's battle at `size`, on its open field (or another map's large version). @param {number} size @param {string} [map] */
function setupBench(size, map = 'open_country') {
  const { CL } = loadGame({ random: mulberry(size * 101 + map.length) });
  CL.combat.setActiveCap(size);
  const def = CL.debugTools.benchDef(size);
  if (map !== 'open_country') def.mapDef = CL.arena.build(CL.content.get('battle_maps', map), size);
  CL.combat.startBattle(def);
  const g = CL.game;
  g.godMode = true; // the hero stands in the thick of it the whole time
  g.hold = {};
  g.joystick = { x: 0, y: 0 };
  for (const grp of ['infantry', 'archer', 'cavalry']) g.orders[grp] = 'follow'; // as Debug → Battle benchmark
  return CL;
}

/** A battle of about `total` units: half allies (hero included), half enemies, mixed roles (before P9-B1's benchmark; tests/spacing.test.js). */
function setup(total, map) {
  const { CL } = loadGame({ random: mulberry(total * 101 + map.length) });
  const c = CL.campaign;
  c.roster = [];
  const allies = Math.floor(total / 2) - 1;
  const mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'footman', 'longbowman', 'guard'];
  for (let i = 0; i < allies; i++) CL.save.addSoldier(c, mix[i % mix.length]);
  const enemies = total - allies - 1;
  const emix = ['looter', 'reaver', 'looter', 'mercenary'];
  const wave = {};
  for (let i = 0; i < enemies; i++) wave[emix[i % emix.length]] = (wave[emix[i % emix.length]] || 0) + 1;
  CL.combat.startBattle({ id: 'bench', name: 'Bench', map, waves: [wave], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  CL.game.godMode = true; // the hero stands in the thick of it the whole time
  CL.game.hold = {};
  CL.game.joystick = { x: 0, y: 0 };
  return CL;
}

/**
 * Fighters that stand still with nobody near them, sampled every few seconds (a living, steady
 * fighter that hasn't moved and has no opponent within reach of a charge is stuck).
 */
function stuckOnes(g, last) {
  const all = [g.hero, ...g.allies, ...g.enemies].filter((u) => u?.alive && !u.routing);
  const stuck = [];
  for (const u of all) {
    const was = last.get(u);
    const foes = u.team === 'enemy' ? [g.hero, ...g.allies] : g.enemies;
    const near = foes.some((v) => v.alive && Math.hypot(v.x - u.x, v.y - u.y) < STUCK.near);
    if (was && Math.hypot(was.x - u.x, was.y - u.y) < STUCK.moved && !near && u.role !== 'hero') stuck.push(u);
    last.set(u, { x: u.x, y: u.y });
  }
  return stuck;
}

function bench(size, map, seconds) {
  const CL = setupBench(size, map);
  const g = CL.game;
  const onField = () => [g.hero, ...g.allies, ...g.enemies].reduce((n, u) => n + (u.alive && !u.routing ? 1 : 0), 0);
  const deployed = onField();
  const times = [];
  const last = new Map();
  let [peak, fieldSum, stuck] = [0, 0, 0];
  for (let i = 0; i < seconds * 60 && g.mode === 'battle'; i++) {
    const t0 = process.hrtime.bigint();
    CL.combat.update(STEP);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    const n = onField();
    peak = Math.max(peak, n);
    fieldSum += n;
    if (i && i % (STUCK.every * 60) === 0) stuck = Math.max(stuck, stuckOnes(g, last).length);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { size, map, deployed, peak, onField: fieldSum / times.length, frames: times.length, mean, p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted.at(-1), stuck, ended: g.mode !== 'battle', CL };
}

function run(seconds = 20, maps = MAPS.slice(0, 1)) {
  const rows = [];
  for (const size of SIZES) {
    for (const map of maps) {
      bench(size, map, 2); // warm up the JIT on this shape
      const r = bench(size, map, seconds);
      rows.push({ size, map, deployed: r.deployed, 'on field': r.onField.toFixed(0), frames: r.frames, 'mean ms': r.mean.toFixed(3), 'p95 ms': r.p95.toFixed(3), 'max ms': r.max.toFixed(2), stuck: r.stuck });
    }
  }
  return rows;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const seconds = Number(args.find((a) => /^\d+$/.test(a)) || 20);
  console.table(run(seconds, args.includes('--maps') ? MAPS : MAPS.slice(0, 1)));
  console.log("Budget: 33 ms a frame at 30 fps, 16.7 ms at 60, for everything (simulation and drawing). The owner's phone measured about this machine's speed (2.4 ms of simulation at 150, 3.1.1).");
}

module.exports = { SIZES, MAPS, run, bench, setup, setupBench };
