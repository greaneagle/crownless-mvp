// P11-13: the crowd effect P11-11 found (docs/PHASE-11-VALIDATION.md "Troops by their weapons"): one against
// one a pike, a spear and a huscarl win; three against three they lost. The same pairs at n against n, AI
// against AI, the hero out of the fight (as scripts/realm-lab.js). With `--formed <kind>` the side on the
// left is the company's division on Hold in that formation (loose, line, wall, square: chosen in Orders),
// the right charging it; each pair is fought both ways round (the long weapons holding, then the short),
// so what a held line is worth to each weapon shows.
//   node scripts/crowd-lab.js [seeds=20] [--sizes 1,3,5] [--formed line] [--json]
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
const { spread } = require(path.join(ROOT, 'scripts/parity'));

const PAIRS = [
  ['pikeman', 'footman'],
  ['spearman', 'footman'],
  ['huscarl', 'guard'],
  ['saltreach_pikeman', 'footman'],
];

/**
 * One fight: `a` on the left (the company's soldiers), `b` on the right (enemies). With `formed`, the
 * left holds in that formation where it stands. True when the left wins.
 */
function fight(seed, a, b, formed = null) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  CL.combat.startBattle({ id: 'crowd_lab', name: 'Crowd lab', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  const [cx, cy] = [480, 270];
  const line = (ids, team, x0, dir) =>
    ids.map((id, i) => {
      const u = CL.units.makeUnit(x0, cy - 80 + ((i * 47) % 280), team, id);
      u.face = dir > 0 ? 'right' : 'left';
      return u;
    });
  g.allies = line(a, 'ally', cx - 170, 1);
  g.enemies = line(b, 'enemy', cx + 170, -1);
  g.enemyReserve = [];
  g.allyReserve = [];
  Object.assign(g.hero, { x: cx, y: cy + 400, alive: false, hp: 0 }); // out of the fight, near enough for full styles
  if (formed) {
    for (const u of g.allies) Object.assign(u, { div: 'infantry', holdX: u.x, holdY: u.y });
    g.orders.infantry = 'hold';
    g.heroDownNote = true; // the hero is out of it by design here: the company does not charge
    CL.formations.set(g, formed, true, 'infantry');
    for (const u of g.allies) Object.assign(u, { x: u.holdX, y: u.holdY }); // formed up already
  }
  for (let t = 0; t < 120 / 0.02; t++) {
    CL.combat.update(0.02);
    const la = g.allies.some((u) => u.alive && !u.routing);
    const lb = g.enemies.some((u) => u.alive && !u.routing);
    if (!la || !lb) return la && !lb;
  }
  const hp = (list) => list.reduce((n, u) => n + (u.alive ? u.hp : 0), 0);
  return hp(g.allies) > hp(g.enemies);
}

/** Win % of the pair's first (long) weapon. Loose: from both sides of the field; formed: the long side holding, and the short. */
function run({ seeds = 20, sizes = [1, 3, 5], formed = null } = {}) {
  const rows = [];
  for (const [a, b] of PAIRS) {
    const row = { a, b, holding: {}, charged: {} };
    for (const n of sizes) {
      let w = 0;
      let held = 0;
      for (let i = 1; i <= seeds; i++) {
        if (formed) {
          if (fight(spread(i), Array(n).fill(a), Array(n).fill(b), formed)) w++; // the long weapons hold
          if (!fight(spread(100 + i), Array(n).fill(b), Array(n).fill(a), formed)) held++; // the short ones hold
        } else {
          if (fight(spread(i), Array(n).fill(a), Array(n).fill(b))) w++;
          if (!fight(spread(100 + i), Array(n).fill(b), Array(n).fill(a))) w++;
        }
      }
      if (formed) {
        row.holding[n] = (100 * w) / seeds;
        row.charged[n] = (100 * held) / seeds;
      } else row.holding[n] = (100 * w) / (2 * seeds);
    }
    rows.push(row);
  }
  return rows;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const seeds = Number(args.find((x, i) => /^\d+$/.test(x) && !String(args[i - 1]).startsWith('--')) ?? 20);
  const sizes = opt('--sizes') ? opt('--sizes').split(',').map(Number) : [1, 3, 5];
  const formed = opt('--formed') || null;
  const rows = run({ seeds, sizes, formed });
  if (args.includes('--json')) console.log(JSON.stringify({ seeds, formed, rows }, null, 2));
  else {
    console.log(formed ? `The long weapon's win %, n against n, one side holding in a ${formed} (${seeds} seeds each way)` : `The long weapon's win %, n against n, both loose (${seeds} seeds from each side)`);
    const head = sizes.map((n) => `${n}v${n}`.padStart(7)).join('');
    console.log(`${'pair'.padEnd(32)}${head}${formed ? `   |${head}` : ''}`);
    if (formed) console.log(`${''.padEnd(32)}${'long holds'.padStart(sizes.length * 7)}   |${'short holds'.padStart(sizes.length * 7)}`);
    for (const r of rows) console.log(`${`${r.a} v ${r.b}`.padEnd(32)}${sizes.map((n) => r.holding[n].toFixed(0).padStart(7)).join('')}${formed ? `   |${sizes.map((n) => r.charged[n].toFixed(0).padStart(7)).join('')}` : ''}`);
  }
}

module.exports = { PAIRS, fight, run };
