// One seeded battle fought to the end by a simple bot hero, summarised so two runs can be compared
// (H-01's isolation test). It loads the game with only a `seed`, the way most tests do, so it takes
// the loader's default seeded Math.random. Run directly it prints the summary as JSON, so a test can
// get the result from a fresh process:   node tests/helpers/seeded-fight.js [seed=7]
const { loadGame } = require('./load');

/** Fight a mixed company against looters and reavers; returns what happened, rounded for comparison. */
function seededFight(seed = 7) {
  const { CL } = loadGame({ seed });
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'hunter', 'hunter', 'levy']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 'iso', name: 'iso', map: 'open_country', waves: [{ looter: 6, reaver: 3 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  let steps = 0;
  for (; steps < 30000 && g.mode === 'battle'; steps++) {
    const h = g.hero;
    const foe = g.enemies.filter((e) => e.alive && !e.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (foe && h.alive) {
      const [dx, dy] = [foe.x - h.x, foe.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = L > 45 ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.02);
  }
  // Array.from: the game's own arrays belong to its realm, and a strict deep-equal compares prototypes.
  const hp = (list) => Array.from(list, (u) => (u.alive ? Math.round(u.hp * 100) / 100 : 0));
  return {
    mode: g.mode,
    win: g.result?.win ?? null,
    steps,
    kills: g.kills,
    hero: g.hero.alive ? Math.round(g.hero.hp * 100) / 100 : 0,
    allies: hp(g.allies),
    enemies: hp(g.enemies),
  };
}

module.exports = { seededFight };

if (require.main === module) console.log(JSON.stringify(seededFight(Number(process.argv[2] ?? 7))));
