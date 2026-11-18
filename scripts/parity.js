// Fought versus auto-resolved (H-01; the V2-T2 measurement, design SC-37): the same encounters, each
// fought in person by the campaign bot's hero and, from the same seeded game, auto-resolved through
// the game's own Simulate path. Reports the stated odds, each way's win rate and soldiers lost, and
// the gap. B-01's target is fought battles 5–15 points over the stated odds.
//   node scripts/parity.js [seeds=40] [--preset balanced|defensive|aggressive] [--json]
//
// Seeds are spread with a hash: consecutive seeds fed straight to mulberry32 correlate their first
// draws, which skewed the V2-T2 scratch runs. Each run is its own game (tests/helpers/load.js gives
// every game its own seeded Math), so results don't depend on what ran before.
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));

/** The encounters: a company (the hero is always there) against a band's actual troops. */
const SCENARIOS = [
  { id: 'lone-hero', company: [], enemy: { looter: 3 } },
  { id: 'small', company: ['levy', 'levy', 'levy', 'hunter', 'hunter'], enemy: { looter: 6 } },
  { id: 'close', company: ['footman', 'footman', 'levy', 'levy', 'hunter', 'hunter'], enemy: { looter: 4, reaver: 4 } },
  { id: 'veterans', company: ['footman', 'footman', 'footman', 'spearman', 'spearman', 'longbowman', 'hunter', 'hunter', 'rider'], enemy: { reaver: 6, mercenary: 4 } },
  { id: 'outnumbered', company: ['footman', 'levy', 'levy', 'hunter', 'hunter'], enemy: { looter: 6, reaver: 5 } },
];

/** Murmur3's finaliser: spreads consecutive integers across the 32-bit range. */
function spread(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** A seeded game with the scenario's company and the band open as an encounter. */
function setup(scenario, seed) {
  const env = loadGame({ seed });
  const { CL } = env;
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  c.roster = [];
  for (const t of scenario.company) CL.save.addSoldier(c, t);
  c.world.location = null;
  CL.game.mode = 'map';
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { troops: { ...scenario.enemy }, x: c.world.x, y: c.world.y });
  CL.parties.open(p.id);
  return CL;
}

const fallen = (CL, before) => {
  const c = CL.campaign;
  const dead = before - c.roster.length;
  return dead + c.roster.filter((s) => s.woundedUntil !== null).length;
};

/** The campaign bot's hero (tests/helpers/campaign-bot.js): walk at the nearest enemy and swing. */
function fight(CL, preset) {
  const g = CL.game;
  const e = CL.parties.current();
  const before = CL.campaign.roster.length;
  CL.parties.attack(CL.prep.plan(preset, CL.arena.mapFor(e.def.map)));
  let t = 0;
  for (; t < 30000 && g.mode === 'battle'; t++) {
    const h = g.hero;
    const foe = g.enemies.filter((x) => x.alive && !x.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] || g.enemies.find((x) => x.alive);
    if (foe && h.alive) {
      const [dx, dy] = [foe.x - h.x, foe.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = L > 45 || !CL.units.inArc(h, foe, CL.units.ARC.attack) ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.02);
  }
  return { win: Boolean(g.result?.win), fallen: fallen(CL, before), seconds: t * 0.02, ended: g.mode !== 'battle' };
}

function simulate(CL) {
  const c = CL.campaign;
  const e = CL.parties.current();
  const A = CL.autoresolve;
  const odds = A.winChance(A.playerPower(c), A.troopsPower(e.troops));
  const before = c.roster.length;
  const r = CL.parties.autoResolve();
  return { win: Boolean(r?.win), fallen: fallen(CL, before), odds };
}

function run({ seeds = 40, preset = 'balanced' } = {}) {
  return SCENARIOS.map((s) => {
    const rows = [];
    for (let i = 1; i <= seeds; i++) {
      const seed = spread(i);
      rows.push({ fought: fight(setup(s, seed), preset), auto: simulate(setup(s, seed)) });
    }
    const pct = (k) => (100 * rows.filter((r) => r[k].win).length) / seeds;
    const avg = (f) => rows.reduce((n, r) => n + f(r), 0) / seeds;
    const odds = 100 * rows[0].auto.odds;
    return {
      scenario: s.id,
      company: s.company.length,
      enemies: Object.values(s.enemy).reduce((a, b) => a + b, 0),
      odds,
      autoWin: pct('auto'),
      foughtWin: pct('fought'),
      overOdds: pct('fought') - odds,
      gap: pct('fought') - pct('auto'),
      autoLost: avg((r) => r.auto.fallen),
      foughtLost: avg((r) => r.fought.fallen),
      foughtSeconds: avg((r) => r.fought.seconds),
      unfinished: rows.filter((r) => !r.fought.ended).length,
    };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const seeds = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--preset') ?? 40);
  const preset = opt('--preset') ?? 'balanced';
  const out = run({ seeds, preset });
  if (args.includes('--json')) console.log(JSON.stringify({ seeds, preset, scenarios: out }, null, 2));
  else {
    console.log(`Fought (bot hero, ${preset}) versus auto-resolved, ${seeds} seeds each`);
    const f = (n, d = 0) => n.toFixed(d).padStart(6);
    console.log(`${'scenario'.padEnd(12)}${'size'.padStart(8)}  odds%  auto%  fought%  over-odds  gap  auto-lost  fought-lost  fought-s`);
    for (const r of out) {
      console.log(
        `${r.scenario.padEnd(12)}${`${r.company + 1}v${r.enemies}`.padStart(8)} ${f(r.odds)} ${f(r.autoWin)} ${f(r.foughtWin).padStart(8)} ${f(r.overOdds).padStart(10)} ${f(r.gap).padStart(4)} ${f(r.autoLost, 2).padStart(10)} ${f(r.foughtLost, 2).padStart(12)} ${f(r.foughtSeconds).padStart(9)}${r.unfinished ? `  (${r.unfinished} never ended)` : ''}`,
      );
    }
    console.log('over-odds: fought win% minus the stated odds (B-01 aims for 5–15). gap: fought win% minus auto win%.');
  }
}

module.exports = { run, SCENARIOS, spread };
