// Battle extras, each measured on its own under the same rules (P7-11, design SC-42): the same
// seeded encounters with one effect on and then off, everything else equal. The hero is the parity
// bot's (scripts/parity.js: walks at the nearest enemy and swings), or for the defensive effects a
// steady one, who stands where the company formed up and fights only what comes within 120 px (with
// the charging bot the fight runs off to the far side of the field, away from a wall or a knoll). Reports win %, soldiers lost (killed or wounded), how long the fight ran,
// and for the escort ambush how often the wagon came through.
//   node scripts/extras.js [seeds=40] [--json]
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { setup, fight, spread } = require(path.join(ROOT, 'scripts/parity'));

/** A steady hero: holds the spot the company formed up on and fights only what comes close. */
function steadyFight(CL, preset) {
  const g = CL.game;
  const e = CL.parties.current();
  const before = CL.campaign.roster.length;
  CL.parties.attack(CL.prep.plan(preset, CL.arena.mapFor(e.def.map)));
  const home = { x: g.hero.x, y: g.hero.y };
  let t = 0;
  for (; t < 30000 && g.mode === 'battle'; t++) {
    const h = g.hero;
    if (h.alive) {
      const foe = g.enemies.filter((x) => x.alive && !x.routing && Math.hypot(x.x - h.x, x.y - h.y) < 120).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      const to = foe || (Math.hypot(home.x - h.x, home.y - h.y) > 20 ? home : null);
      const [dx, dy] = to ? [to.x - h.x, to.y - h.y] : [0, 0];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = to && (L > 45 || (foe && !CL.units.inArc(h, foe, CL.units.ARC.attack))) ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = Boolean(foe && L < 70);
    }
    CL.combat.update(0.02);
  }
  const c = CL.campaign;
  const fallen = before - c.roster.length + c.roster.filter((s) => s.woundedUntil !== null).length;
  return { win: Boolean(g.result?.win), fallen, seconds: t * 0.02, ended: g.mode !== 'battle' };
}

const CLOSE = ['footman', 'footman', 'levy', 'levy', 'hunter', 'hunter'];
const SHIELDS = ['footman', 'footman', 'footman', 'footman', 'levy', 'levy', 'hunter', 'hunter'];
const ARCHERS = ['footman', 'footman', 'levy', 'levy', 'hunter', 'hunter', 'hunter', 'hunter'];

/**
 * Each effect: a scenario, a preset, the switch that turns the effect off (`off`), and anything else
 * the scenario needs (`map`: fight on this battle map; `ambush`: an escort ambush with its wagon;
 * `formation`: the infantry's formation, as if chosen in Orders as the battle starts).
 */
const EFFECTS = [
  { id: 'wall-melee', what: 'Shield wall (Defensive, steady hero) against Reavers', hero: 'steady', preset: 'defensive', company: SHIELDS, enemy: { reaver: 8, mercenary: 3 }, off: (CL) => (CL.formations.USE.wall = false) },
  // P9-B2: bands fight as one army, not in waves of 8. Against 6 and 6 the company now won every time with or
  // without the wall, so the crossbows are 8 and 8. The wedge meets 8 at once (the old first wave): against
  // 11 at once it now wins less often than loose ranks (85% against 95%, 40 seeds), for P9-B4's formations.
  { id: 'wall-arrows', what: 'Shield wall (Defensive, steady hero) against crossbows', hero: 'steady', preset: 'defensive', company: SHIELDS, enemy: { crossbowman: 8, militia: 8 }, off: (CL) => (CL.formations.USE.wall = false) },
  { id: 'wedge', what: 'Wedge (Aggressive, chosen in Orders)', preset: 'aggressive', formation: 'wedge', company: CLOSE, enemy: { looter: 4, reaver: 4 }, off: (CL) => (CL.formations.USE.wedge = false) },
  { id: 'hill', what: 'High ground: archers on the knoll against crossbows (Balanced, steady hero, Hill Slopes)', hero: 'steady', preset: 'balanced', company: ARCHERS, enemy: { crossbowman: 6, militia: 5 }, map: 'hill_slopes', off: (CL) => (CL.formations.USE.hill = false) },
  { id: 'ford', what: 'A ford breaks the wedge (Aggressive, wedge chosen in Orders, River Ford)', preset: 'aggressive', formation: 'wedge', company: CLOSE, enemy: { looter: 4, reaver: 7 }, map: 'river_ford', off: (CL) => (CL.formations.USE.fordBreaks = false) },
  { id: 'wagon', what: 'Soldiers mind the wagon (Balanced, escort ambush)', preset: 'balanced', company: CLOSE, enemy: { reaver: 8, looter: 4 }, ambush: true, off: (CL) => (CL.objective.USE.guard = false) },
];

/** One fight: the effect on (or off), on one seed. */
function once(effect, seed, on) {
  const CL = setup({ company: effect.company, enemy: effect.enemy }, seed, (CL) => {
    if (!on) effect.off(CL);
    if (effect.map) CL.world.battleMapAt = () => effect.map;
    if (effect.formation) {
      const place = CL.prep.place;
      CL.prep.place = (g, p) => place(g, { ...p, formation: effect.formation, formations: { infantry: effect.formation, infantry2: effect.formation } });
    }
  });
  if (effect.ambush) CL.campaign.parties.find((p) => p.id === CL.game.partyId).ambush = true;
  const r = (effect.hero === 'steady' ? steadyFight : fight)(CL, effect.preset);
  return { ...r, wagon: effect.ambush ? Boolean(r.win && CL.game.wagon?.alive) : null };
}

function run({ seeds = 40, only = null } = {}) {
  return EFFECTS.filter((e) => !only || only.includes(e.id)).map((e) => {
    const side = (on) => {
      const rows = [];
      for (let i = 1; i <= seeds; i++) rows.push(once(e, spread(i), on));
      const avg = (f) => rows.reduce((n, r) => n + f(r), 0) / seeds;
      return {
        win: (100 * rows.filter((r) => r.win).length) / seeds,
        lost: avg((r) => r.fallen),
        seconds: avg((r) => r.seconds),
        wagon: e.ambush ? (100 * rows.filter((r) => r.wagon).length) / seeds : null,
        unfinished: rows.filter((r) => !r.ended).length,
      };
    };
    return { effect: e.id, what: e.what, on: side(true), off: side(false) };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
  const out = run({ seeds });
  if (args.includes('--json')) console.log(JSON.stringify({ seeds, effects: out }, null, 2));
  else {
    console.log(`Battle extras, each on and off, ${seeds} seeds each (the parity bot's hero)`);
    const f = (n, d = 0) => (n == null ? '–' : n.toFixed(d)).padStart(7);
    console.log(`${'effect'.padEnd(12)}     win% on/off     lost on/off      seconds on/off   wagon% on/off`);
    for (const r of out) {
      console.log(`${r.effect.padEnd(12)} ${f(r.on.win)} ${f(r.off.win)}   ${f(r.on.lost, 2)} ${f(r.off.lost, 2)}   ${f(r.on.seconds)} ${f(r.off.seconds)}   ${f(r.on.wagon)} ${f(r.off.wagon)}${r.on.unfinished + r.off.unfinished ? `  (${r.on.unfinished}/${r.off.unfinished} never ended)` : ''}`);
      console.log(`  ${r.what}`);
    }
  }
}

module.exports = { run, EFFECTS, steadyFight };
