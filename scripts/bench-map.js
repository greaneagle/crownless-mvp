// World-simulation cost per game hour for N parties on the map (H-01; for W-07 and W-08). Times the
// world parties' simulation (CL.parties.tick: targets, movement, contacts and off-screen fights) and
// everything time drives (CL.party.advanceDays: upkeep, markets, contracts, story, news and parties).
//   node scripts/bench-map.js [hours=240] [--parties 10,25,50,100,200] [--json]
//   node scripts/bench-map.js [hours] --armies   (P9-05: with four armies of up to five lords on the map, the phone test)
//   node scripts/bench-map.js --season [parties=80] [days=90]   (W-07: a long rest with a full world:
//     ms per game day, the worst day, and the size of the save at the end)
//
// Before each measured hour the map is topped up to N parties (outside the timing), drawn from the
// real templates in turn, scattered over the map; parties ignore the player so the hour always runs
// to its end. Off-screen fights still happen, so contacts are part of the cost.
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));

const now = () => performance.now();

const ARMIES = process.argv.includes('--armies');

function setup(seed) {
  const { CL } = loadGame({ seed, worldParties: true });
  CL.ui = headlessUi(CL);
  CL.game.mode = 'map';
  if (ARMIES && CL.armies) {
    // P9-05: four armies in the field, and their realms at war (so they keep marching and meeting).
    const c = CL.campaign;
    CL.lords.ensure(c, c.day, true);
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'bench');
    CL.realm.setRelation(c, 'hrothmark', 'vessaro', 'war', 'bench');
    CL.armies.testArmies(c, { x: CL.world.bounds().w / 2, y: CL.world.bounds().h / 2 });
  }
  return CL;
}

/** Top the map up to n parties, round-robin over the templates, each placed at a seeded spot. */
function topUp(CL, n) {
  const c = CL.campaign;
  const ids = Object.values(CL.content.table('party_templates')).filter((t) => t.count > 0).map((t) => t.id); // not detachments
  // `n` regular parties; the lords (P8-01) ride on top of them, as in Debug → Map stress.
  const regular = () => c.parties.filter((p) => !p.lordId).length;
  let k = regular();
  while (regular() < n) {
    const p = CL.parties.spawn(c, ids[k++ % ids.length]);
    const b = CL.world.bounds(); // W-07: anywhere on the world's own map
    [p.x, p.y] = CL.world.clampToMap(CL.autoresolve.next(c) * b.w, CL.autoresolve.next(c) * b.h, 4);
  }
  for (const p of c.parties) p.ignoreUntil = 1e9;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function bench(n, hours, seed = 12345) {
  const out = {};
  for (const [label, step] of [
    ['parties.tick', (CL) => CL.parties.tick(CL.campaign, 1)],
    ['advanceDays', (CL) => CL.party.advanceDays(1 / 24)],
  ]) {
    const CL = setup(seed);
    const c = CL.campaign;
    const times = [];
    let live = 0;
    for (let h = 0; h < hours + 24; h++) {
      topUp(CL, n);
      if (label === 'parties.tick') c.day += 1 / 24; // advanceDays moves the clock itself
      const t0 = now();
      step(CL);
      const dt = now() - t0;
      live += c.parties.length;
      if (h >= 24) times.push(dt); // the first game day warms the JIT
    }
    const total = times.reduce((a, b) => a + b, 0);
    out[label] = { msPerHour: total / times.length, median: median(times), worst: Math.max(...times), parties: live / (hours + 24) };
  }
  return { parties: n, ...out };
}

/**
 * W-07: `days` game days of rest with the map kept at `n` parties (topped up each morning), one day
 * at a time as the clock passes them. Returns ms per day, the worst day and the save's size.
 */
function season(n = 80, days = 90, seed = 12345) {
  const CL = setup(seed);
  const c = CL.campaign;
  c.food = 1e5;
  c.gold = 1e5;
  const times = [];
  for (let d = 0; d < days; d++) {
    topUp(CL, n);
    const t0 = now();
    CL.party.advanceDays(1);
    times.push(now() - t0);
  }
  const text = JSON.stringify(c);
  return { parties: n, days, msPerDay: times.reduce((a, b) => a + b, 0) / days, median: median(times), worst: Math.max(...times), saveKb: text.length / 1024, live: c.parties.length };
}

if (require.main === module && process.argv.includes('--season')) {
  const [n = 80, days = 90] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  const r = season(n, days);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(`${r.days} days with ${r.parties} parties: ${r.msPerDay.toFixed(1)} ms per game day (median ${r.median.toFixed(1)}, worst ${r.worst.toFixed(1)}); save ${r.saveKb.toFixed(1)} KB with ${r.live} parties`);
} else if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--parties');
  const sizes = i >= 0 ? args[i + 1].split(',').map(Number) : [10, 25, 50, 100, 200];
  const hours = Number(args.find((a, j) => /^\d+$/.test(a) && args[j - 1] !== '--parties') ?? 240);
  const rows = sizes.map((n) => bench(n, hours));
  const perSecond = setup(1).world.HOURS_PER_SECOND; // game hours per real second of travel
  if (args.includes('--json')) console.log(JSON.stringify({ hours, hoursPerSecond: perSecond, rows }, null, 2));
  else {
    console.log(`World simulation per game hour, ${hours} hours after a day's warm-up (ms; median and worst hour)${ARMIES ? ', with four armies in the field' : ''}`);
    console.log(`${'parties'.padStart(8)}  ${'parties.tick'.padEnd(26)}${'advanceDays (all of time)'.padEnd(26)}per real second of travel`);
    const cell = (x) => `${x.msPerHour.toFixed(3)} (${x.median.toFixed(3)}, ${x.worst.toFixed(2)})`.padEnd(26);
    for (const r of rows) console.log(`${String(r.parties).padStart(8)}  ${cell(r['parties.tick'])}${cell(r.advanceDays)}${(r.advanceDays.msPerHour * perSecond).toFixed(1)} ms`);
    console.log(`Travel passes ${perSecond} game hours per real second, so the last column is the simulation's share of each second on this machine.`);
  }
}

module.exports = { bench, season };
