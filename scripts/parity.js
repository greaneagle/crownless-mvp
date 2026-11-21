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
function setup(scenario, seed, tweak = null) {
  const env = loadGame({ seed });
  const { CL } = env;
  tweak?.(CL); // B-01: a change to try, before the battle (for measuring one thing at a time)
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

function run({ seeds = 40, preset = 'balanced', tweak = null, only = null } = {}) {
  return SCENARIOS.filter((s) => !only || only.includes(s.id)).map((s) => {
    const rows = [];
    for (let i = 1; i <= seeds; i++) {
      const seed = spread(i);
      rows.push({ fought: fight(setup(s, seed, tweak), preset), auto: simulate(setup(s, seed, tweak)) });
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

// ---- Sieges (P8-06b): the same assault fought on the walls and simulated with the walls' bonus ----

const SIEGE_COMPANY = ['footman', 'footman', 'footman', 'footman', 'guard', 'guard', 'levy', 'levy', 'hunter', 'hunter', 'longbowman', 'longbowman', 'footman', 'footman', 'hunter', 'hunter'];

/** A seeded game: you, a vassal of Valedorn at war with Aurelia, three days into a siege of Castra Nova ('attack'), or holding it for Aurelia against Valedorn's lords ('defend'). */
function siegeSetup(side, seed) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  c.roster = [];
  for (const t of SIEGE_COMPANY) CL.save.addSoldier(c, t);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'parity');
  const f = CL.content.get('settlements', 'castra_nova');
  if (side === 'attack') {
    Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: 0, window: { start: 0, days: 10 } });
    Object.assign(c.world, { x: f.mapX, y: f.mapY, location: 'castra_nova' });
    const s = CL.sieges.begin(c, 'castra_nova');
    Object.assign(s, { began: c.day - 3.5, lastDay: Math.floor(c.day) });
    return { CL, s };
  }
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'aurelian', since: 0, window: { start: 0, days: 10 } });
  CL.realm.transfer(c, 'castra_nova', { holder: 'player', willing: true });
  Object.assign(c.world, { x: f.mapX, y: f.mapY, location: 'castra_nova' });
  for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
  CL.lords.ensure(c, c.day, true);
  const lords = c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn').slice(0, 3);
  for (const q of lords) Object.assign(q, { x: f.mapX + 2, y: f.mapY + 2, troops: { footman: 8, guard: 3, hunter: 4, longbowman: 2 } });
  const s = { id: 99, sid: 'castra_nova', realm: 'valedorn', by: 'ai', lords: lords.map((q) => q.lordId), relief: [], phase: 'encircled', began: c.day - 3.5, gatherBy: null, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
  c.sieges.push(s);
  return { CL, s };
}

/** Fight it on the walls with the campaign bot's hero (through the gaps in the wall). */
function siegeFight(CL, side, s) {
  const g = CL.game;
  const c = CL.campaign;
  const before = c.roster.length;
  if (side === 'attack') CL.sieges.storm(c);
  else CL.sieges.defend(c, s);
  let t = 0;
  for (; t < 40000 && g.mode === 'battle'; t++) {
    const h = g.hero;
    const foe = g.enemies.filter((x) => x.alive && !x.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (foe && h.alive) {
      const way = CL.arena.wayThrough(g.battleMap, h.x, h.y, foe.x, foe.y) || foe;
      const [dx, dy] = [way.x - h.x, way.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      const close = Math.hypot(foe.x - h.x, foe.y - h.y);
      g.joystick = close > 45 || way !== foe ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = close < 70;
    }
    CL.combat.update(0.02);
  }
  return { win: Boolean(g.result?.win), fallen: fallen(CL, before), seconds: t * 0.02, ended: g.mode !== 'battle' };
}

/** Simulate it: your assault through Simulate, or theirs on your fort off the field (the walls' bonus both ways). */
function siegeSimulate(CL, side, s) {
  const c = CL.campaign;
  const A = CL.autoresolve;
  const before = c.roster.length;
  if (side === 'attack') {
    const odds = CL.sieges.odds(c, s);
    const r = CL.sieges.playerAssault(c);
    return { win: Boolean(r?.win), fallen: fallen(CL, before), odds };
  }
  // Defending: the company counts beside the garrison behind the walls.
  const d = CL.sieges.defence(c, s);
  const odds = 1 - A.winChance(CL.sieges.attack(c, s), d.power + A.playerPower(c) * d.wall);
  return { win: A.next(c) < odds, fallen: 0, odds };
}

function runSiege({ seeds = 30 } = {}) {
  return ['attack', 'defend'].map((side) => {
    const rows = [];
    for (let i = 1; i <= seeds; i++) {
      const seed = spread(1000 + i);
      const a = siegeSetup(side, seed);
      const b = siegeSetup(side, seed);
      rows.push({ fought: siegeFight(a.CL, side, a.s), auto: siegeSimulate(b.CL, side, b.s) });
    }
    const pct = (k) => (100 * rows.filter((r) => r[k].win).length) / seeds;
    const odds = (100 * rows.reduce((n, r) => n + r.auto.odds, 0)) / seeds;
    return { scenario: `siege-${side}`, odds, autoWin: pct('auto'), foughtWin: pct('fought'), overOdds: pct('fought') - odds, gap: pct('fought') - pct('auto'), foughtSeconds: rows.reduce((n, r) => n + r.fought.seconds, 0) / seeds, unfinished: rows.filter((r) => !r.fought.ended).length };
  });
}

if (require.main === module && process.argv.includes('--siege')) {
  const seeds = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 30);
  console.log(`Sieges, fought on the walls versus simulated, ${seeds} seeds each`);
  for (const r of runSiege({ seeds })) console.log(`${r.scenario.padEnd(14)} odds ${r.odds.toFixed(0)}%  simulated ${r.autoWin.toFixed(0)}%  fought ${r.foughtWin.toFixed(0)}%  over-odds ${r.overOdds.toFixed(0)}  fought ${r.foughtSeconds.toFixed(0)} s${r.unfinished ? `  (${r.unfinished} never ended)` : ''}`);
  console.log('B-01 aims for fought battles 5–15 points over the stated odds.');
} else if (require.main === module) {
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

module.exports = { run, runSiege, SCENARIOS, spread, setup, fight, simulate };
