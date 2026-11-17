// Battle simulation benchmark (GDD §6 "Scaling: initially profile 20 active units, then 30, then
// 40"; §12 performance targets). Runs real battles headlessly at a fixed 60 Hz step and reports the
// simulation's cost per frame. Drawing is not included: measure that in the browser with the debug
// panel's stress battle. Every map is used, so obstacle steering is part of the cost.
//   node scripts/bench-battle.js [seconds=20]
const { loadGame } = require('../tests/helpers/load');

const SIZES = [20, 30, 40, 60];
const MAPS = ['grass_field', 'forest_clearing', 'greywall_courtyard', 'open_country', 'forest_wilds'];
const STEP = 1 / 60;

/** A battle of about `total` units: half allies (hero included), half enemies, mixed roles. */
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

function bench(total, map, seconds) {
  const CL = setup(total, map);
  const g = CL.game;
  const active = () => [g.hero, ...g.allies, ...g.enemies].filter((u) => u.alive).length;
  const deployed = active();
  const times = [];
  let peak = 0;
  for (let i = 0; i < seconds * 60 && g.mode === 'battle'; i++) {
    const t0 = process.hrtime.bigint();
    CL.combat.update(STEP);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    peak = Math.max(peak, active());
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { deployed, peak, frames: times.length, mean, p95: times[Math.floor(times.length * 0.95)], max: times.at(-1) };
}

function run(seconds = 20) {
  const rows = [];
  for (const total of SIZES) {
    for (const map of MAPS) {
      bench(total, map, 2); // warm up the JIT on this shape
      const r = bench(total, map, seconds);
      rows.push({ units: total, map, deployed: r.deployed, frames: r.frames, 'mean ms': r.mean.toFixed(3), 'p95 ms': r.p95.toFixed(3), 'max ms': r.max.toFixed(2) });
    }
  }
  return rows;
}

if (require.main === module) {
  console.table(run(Number(process.argv[2] || 20)));
  console.log('Budget at 60 fps is 16.7 ms per frame for everything (simulation + drawing).');
}

module.exports = { run, bench, setup };
