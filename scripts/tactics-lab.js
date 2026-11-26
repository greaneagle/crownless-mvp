// P11-00: the tactics lab. Two equal armies (the same troop list each side) on a chosen map, from the
// same seeded games, fought under different plans, so what command is worth can be measured and later
// tasks can show what they changed (docs/PHASE-11-PLAN.md §9).
//
//   node scripts/tactics-lab.js [seeds=40] [--plans charge,auto,plan:line] (plan:fallback on request)
//        [--hero passive,active] [--maps open_country,hill_slopes] [--army mixed|foot|<troop:n,...>]
//        [--size 60] [--json]
//
// Plans:
//   charge         every division on Charge from the start
//   auto           the game's Auto setup (js/prep.js: from the odds Simulate would state)
//   plan:line      layer-4 orders, as a careful player gives them: the infantry in a shield wall on Hold
//                  ahead of the hero, the archers on Hold behind (on the rise, on the hills), the cavalry
//                  held out on a flank and sent in to Charge when the archers first loose
//   plan:fallback  the infantry holds forward; when the enemy comes within 140 px of it, it falls back
//                  to the archers' line and holds there (the archers shooting all the while); the cavalry
//                  as plan:line
// Hero: `passive` stays back and fights only what reaches them; `active` is the campaign bot (masher).
//
// Reports win rate, each side's losses (cut down, as a share of its army), seconds, and ground held: the
// share of each side's living fighters inside the middle third of the field when it ends.
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
const { makePilot, STEP } = require(path.join(ROOT, 'tests/helpers/pilots'));
const { spread } = require(path.join(ROOT, 'scripts/parity'));

const PLANS = ['charge', 'auto', 'plan:line', 'plan:fallback'];
const DEFAULT_PLANS = ['charge', 'auto', 'plan:line']; // plan:fallback on request (--plans), to keep 40 seeds near ten minutes
const HEROES = ['passive', 'active'];
const MAPS = ['open_country', 'hill_slopes'];
const ARMIES = {
  mixed: { footman: 8, spearman: 4, hunter: 6, rider: 4 },
  foot: { footman: 8, spearman: 6, levy: 6 },
};
const FALLBACK_AT = 140;
const MAX_STEPS = 30000;

const expand = (o) => Object.entries(o).flatMap(([t, n]) => Array(n).fill(t));

/** Parse --army: a named army or `troop:n,troop:n`. */
function armyOf(spec = 'mixed') {
  if (ARMIES[spec]) return ARMIES[spec];
  return Object.fromEntries(spec.split(',').map((p) => p.split(':')).map(([t, n]) => [t, Number(n) || 1]));
}

/** The plan's setup before the battle (layer 1–3): a prep plan for the company. */
function setupFor(CL, plan, map) {
  const P = CL.prep;
  if (plan === 'charge') {
    const p = P.plan('balanced', map);
    for (const k of Object.keys(p.orders)) p.orders[k] = 'charge';
    return p;
  }
  if (plan === 'auto') return P.plan('auto', map);
  // plan:line and plan:fallback: hold, archers behind (Balanced's archers stand on the rise of the hills).
  const forward = plan === 'plan:fallback' ? 170 : 70;
  const p = P.plan('custom', map, { custom: { infantry: { dx: forward, dy: 0, order: 'hold' }, archer: { dx: -90, dy: 0, order: 'hold' }, cavalry: { dx: -40, dy: -260, order: 'hold' } } });
  Object.assign(p, { formation: 'wall', formations: { infantry: 'wall', infantry2: 'wall' } });
  return p;
}

/** A seeded game: the company and a band of the same troops open as an encounter. */
function setup(seed, army, size) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  CL.combat.setActiveCap(size);
  const c = CL.campaign;
  c.roster = [];
  for (const t of expand(army)) CL.save.addSoldier(c, t);
  c.world.location = null;
  CL.game.mode = 'map';
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { troops: { ...army }, x: c.world.x, y: c.world.y });
  CL.parties.open(p.id);
  return CL;
}

const centre = (units) => {
  const n = units.length || 1;
  return { x: units.reduce((s, u) => s + u.x, 0) / n, y: units.reduce((s, u) => s + u.y, 0) / n };
};

/** Fight one battle under a plan; returns the outcome. */
function battle({ seed, plan, hero, map, army = ARMIES.mixed, size = 60 }) {
  const CL = setup(seed, army, size);
  const g = CL.game;
  const e = CL.parties.current();
  const mapDef = CL.arena.mapFor(map);
  CL.combat.startBattle({ ...e.def, map }, { plan: setupFor(CL, plan, mapDef) });
  const T = CL.tactics;
  const D = CL.divisions;
  const cavalry = D.members(g, 'cavalry').length > 0;
  if (plan.startsWith('plan:') && cavalry) {
    // The cavalry go in on the first volley, at the enemy's middle as it is then (a timed order, layer 4).
    g.timed = [{ div: 'cavalry', kind: 'charge', x: 0, y: 0, volley: g.lastVolley ?? -1, aimAtEnemy: true }];
  }
  const pilot = makePilot(CL, hero === 'active' ? 'masher' : 'passive');
  const total = { ally: 1 + g.allies.length + g.allyReserve.length, enemy: g.enemies.length + g.enemyReserve.length };
  let fellBack = false;
  let t = 0;
  for (; t < MAX_STEPS && g.mode === 'battle'; t++) {
    // A timed charge aims where the enemy stands when it goes off.
    for (const o of g.timed || []) if (o.aimAtEnemy) Object.assign(o, centre(g.enemies.filter((x) => x.alive && !x.routing)));
    if (plan === 'plan:fallback' && !fellBack) {
      const inf = D.members(g, 'infantry').filter((u) => u.alive);
      const arch = D.members(g, 'archer').filter((u) => u.alive);
      const c = centre(inf);
      if (inf.length && g.enemies.some((x) => x.alive && !x.routing && Math.hypot(x.x - c.x, x.y - c.y) < FALLBACK_AT)) {
        fellBack = true;
        const a = arch.length ? centre(arch) : { x: c.x - 160, y: c.y };
        T.carry(g, { div: 'infantry', kind: 'fallback', x: a.x + 50, y: a.y });
      }
    }
    pilot.step();
    CL.combat.update(STEP);
  }
  const b = g.battleMap.bounds || CL.units.BOUNDS;
  const third = (b.maxX - b.minX) / 3;
  const mid = (u) => u.x > b.minX + third && u.x < b.maxX - third;
  const held = (list) => {
    const live = list.filter((u) => u.alive && !u.routing);
    return live.length ? live.filter(mid).length / live.length : 0;
  };
  const down = (list) => list.filter((u) => u.ground).length;
  return {
    win: Boolean(g.result?.win),
    ended: g.mode !== 'battle',
    seconds: t * STEP,
    allyLost: down([g.hero, ...g.allies]) / total.ally, // reserves step in by joining g.allies / g.enemies
    enemyLost: down(g.enemies) / total.enemy,
    heldAlly: held([g.hero, ...g.allies]),
    heldEnemy: held(g.enemies),
    fellBack,
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function run({ seeds = 40, plans = DEFAULT_PLANS, heroes = HEROES, maps = MAPS, army = ARMIES.mixed, size = 60 } = {}) {
  const out = [];
  for (const map of maps) {
    for (const hero of heroes) {
      for (const plan of plans) {
        const rows = [];
        for (let i = 1; i <= seeds; i++) rows.push(battle({ seed: spread(i), plan, hero, map, army, size }));
        out.push({
          map,
          hero,
          plan,
          win: (100 * rows.filter((r) => r.win).length) / seeds,
          allyLost: 100 * mean(rows.map((r) => r.allyLost)),
          enemyLost: 100 * mean(rows.map((r) => r.enemyLost)),
          seconds: mean(rows.map((r) => r.seconds)),
          heldAlly: 100 * mean(rows.map((r) => r.heldAlly)),
          heldEnemy: 100 * mean(rows.map((r) => r.heldEnemy)),
          unfinished: rows.filter((r) => !r.ended).length,
        });
      }
    }
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const list = (name, d) => (opt(name) ? opt(name).split(',') : d);
  const seeds = Number(args.find((a, i) => /^\d+$/.test(a) && !String(args[i - 1]).startsWith('--')) ?? 40);
  const army = armyOf(opt('--army'));
  const size = Number(opt('--size')) || 60;
  const t0 = Date.now();
  const out = run({ seeds, plans: list('--plans', DEFAULT_PLANS), heroes: list('--hero', HEROES), maps: list('--maps', MAPS), army, size });
  if (args.includes('--json')) console.log(JSON.stringify({ seeds, army, size, rows: out }, null, 2));
  else {
    const f = (n, d = 0) => n.toFixed(d).padStart(6);
    console.log(`Equal armies (${Object.entries(army).map(([t, n]) => `${n} ${t}`).join(', ')} a side), battle size ${size}, ${seeds} seeds each`);
    console.log(`${'map'.padEnd(14)}${'hero'.padEnd(9)}${'plan'.padEnd(15)}  win%  lost%  killed%  secs  held%  their-held%`);
    for (const r of out) console.log(`${r.map.padEnd(14)}${r.hero.padEnd(9)}${r.plan.padEnd(15)}${f(r.win)}${f(r.allyLost).padStart(7)}${f(r.enemyLost).padStart(9)}${f(r.seconds)}${f(r.heldAlly).padStart(7)}${f(r.heldEnemy).padStart(13)}${r.unfinished ? `  (${r.unfinished} never ended)` : ''}`);
    console.log('lost%: your side cut down (of everyone who fought); killed%: theirs. held%: the share of each side still fighting inside the middle third of the field at the end.');
    console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}

module.exports = { PLANS, DEFAULT_PLANS, HEROES, MAPS, ARMIES, battle, run, setupFor };
