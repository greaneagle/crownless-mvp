// P11-11: the realms' lines against each other, AI against AI (no hero in the fight: the hero stands
// fallen at the middle of the field, so everyone thinks in full, js/styles.js). Each realm's squad at a
// tier: its foot and its archers (and at T3 its riders), the same size a side. Reports the row's win %
// against each column, from both sides of the field, so each realm's strengths and weaknesses show.
//   node scripts/realm-lab.js [seeds=10] [--tier T2|T3] [--json]
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
const { spread } = require(path.join(ROOT, 'scripts/parity'));

/** Each realm's squad at a tier: troop ids, foot first. */
const SQUADS = {
  T2: {
    valedorn: ['footman', 'footman', 'footman', 'hunter', 'hunter'],
    aurelian: ['spearman', 'spearman', 'spearman', 'skirmisher', 'skirmisher'],
    hrothmark: ['axeman', 'axeman', 'axeman', 'fell_archer', 'fell_archer'],
    vessaro: ['pikeman', 'pikeman', 'pikeman', 'crossbowman', 'crossbowman'],
    ostrand: ['ostrand_shieldman', 'ostrand_shieldman', 'ostrand_shieldman', 'ostrand_bowman', 'ostrand_bowman'],
    saltreach: ['saltreach_pikeman', 'saltreach_pikeman', 'saltreach_pikeman', 'saltreach_crossbow', 'saltreach_crossbow'],
    outlaws: ['reaver', 'reaver', 'reaver', 'outlaw_huntress', 'outlaw_huntress'],
    free: ['mercenary', 'mercenary', 'mercenary', 'mercenary', 'mercenary'],
  },
  T3: {
    valedorn: ['guard', 'guard', 'longbowman', 'longbowman', 'rider'],
    aurelian: ['legionary', 'legionary', 'marksman', 'marksman', 'horse_scout'],
    hrothmark: ['huscarl', 'huscarl', 'fell_warden', 'fell_warden', 'hill_rider'],
    vessaro: ['pavisier', 'pavisier', 'arbalester', 'arbalester', 'light_horse'],
    free: ['sellsword', 'sellsword', 'sellsword', 'sellsword', 'sellsword'],
  },
};

/** One fight: `a` (allies, on the left) against `b` (enemies, on the right). True when `a` wins. */
function fight(seed, a, b) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  CL.combat.startBattle({ id: 'realm_lab', name: 'Realm lab', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  const [cx, cy] = [480, 270];
  const line = (ids, team, x0, dir) =>
    ids.map((id, i) => {
      const t = CL.content.troop(id);
      const back = t.role === 'archer' ? 70 : t.role === 'cavalry' ? 40 : 0;
      const u = CL.units.makeUnit(x0 - dir * back, cy - 80 + ((i * 47) % 200), team, id);
      u.face = dir > 0 ? 'right' : 'left';
      return u;
    });
  g.allies = line(a, 'ally', cx - 170, 1);
  g.enemies = line(b, 'enemy', cx + 170, -1);
  g.enemyReserve = [];
  g.allyReserve = [];
  Object.assign(g.hero, { x: cx, y: cy + 400, alive: false, hp: 0 }); // out of the fight, near enough for full styles
  for (let t = 0; t < 120 / 0.02; t++) {
    CL.combat.update(0.02);
    const la = g.allies.some((u) => u.alive && !u.routing);
    const lb = g.enemies.some((u) => u.alive && !u.routing);
    if (!la || !lb) return la && !lb;
  }
  const hp = (list) => list.reduce((n, u) => n + (u.alive ? u.hp : 0), 0);
  return hp(g.allies) > hp(g.enemies);
}

function run({ seeds = 10, tier = 'T2' } = {}) {
  const S = SQUADS[tier];
  const ids = Object.keys(S);
  const table = {};
  for (const r of ids) {
    table[r] = {};
    for (const c of ids) {
      if (r === c) continue;
      let w = 0;
      for (let i = 1; i <= seeds; i++) {
        if (fight(spread(i), S[r], S[c])) w++;
        if (!fight(spread(100 + i), S[c], S[r])) w++; // and from the other side
      }
      table[r][c] = (100 * w) / (2 * seeds);
    }
  }
  return { tier, ids, table };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
  const tier = args.includes('--tier') ? args[args.indexOf('--tier') + 1] : 'T2';
  const out = run({ seeds, tier });
  if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`The realms' ${tier} lines, row against column, win % (${seeds} seeds from each side)`);
    console.log(`${''.padEnd(11)}${out.ids.map((c) => c.slice(0, 9).padStart(10)).join('')}   mean`);
    for (const r of out.ids) {
      const vals = out.ids.map((c) => (r === c ? null : out.table[r][c]));
      const mean = vals.filter((v) => v != null).reduce((a, b) => a + b, 0) / (out.ids.length - 1);
      console.log(`${r.padEnd(11)}${vals.map((v) => (v == null ? '·' : v.toFixed(0)).padStart(10)).join('')}${mean.toFixed(0).padStart(7)}`);
    }
  }
}

module.exports = { SQUADS, fight, run };
