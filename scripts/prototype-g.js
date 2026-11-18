// Prototype G, "the hands-off campaign" (V2-13; design Part 2 §28): the same small campaign played by
// (a) a player who never opens a setting and auto-resolves every fight, (b) one who fights in person and
// only picks presets, and (c) an expert who chooses setups, rallies, and keeps a quartermaster and a
// merchant. Each run also saves at the halfway mark, reloads from that save and plays on (resuming after
// time away). Reports outcomes, forced screens and warnings per style.
//   node scripts/prototype-g.js [days=30] [seeds=6]
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame, memoryStorage } = require(path.join(ROOT, 'tests/helpers/load'));
const { makeBot, headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));

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

const WARN = /Wages short|run out of food|deserted|^Quartermaster .*: (food|wages)|went unpaid|leaves the company/;

/** One campaign in one style: play half, save, reload from storage, play the rest. */
function run(seed, style, days) {
  const storage = memoryStorage();
  const messages = [];
  const boot = (fresh) => {
    const env = loadGame({ party: false, random: mulberry(seed * 7919), seed, storage });
    const { CL } = env;
    CL.ui = headlessUi(CL, messages);
    if (fresh) {
      CL.game.newGame = true;
      CL.character.begin({ name: `G${seed}`, background: 'farmhand' });
      const c = CL.campaign;
      c.rngSeed = seed;
      c.parties = [];
      c.partySpawns = {};
      c.nextPartyId = 1;
      CL.parties.ensure(c, true);
    }
    return CL;
  };
  let CL = boot(true);
  const first = makeBot(CL, { style }).play(days / 2);
  if (CL.game.mode === 'battle') CL.debugTools.endBattleNow(true);
  const savedDay = CL.campaign.day;
  const wrote = CL.save.write();
  CL = boot(false); // time away: the page is closed and opened again
  const resumed = Math.abs(CL.campaign.day - savedDay) < 1e-9 && wrote;
  CL.ui.changeMode('map');
  const second = makeBot(CL, { style }).play(days - CL.campaign.day);
  const c = CL.campaign;
  const add = (k) => (first[k] || 0) + (second[k] || 0);
  return {
    money: c.gold + (c.accounts?.chest || 0) + (CL.merchant?.worth(c) || 0),
    soldiers: c.roster.length,
    renown: c.renown,
    level: c.character.level,
    wins: add('wins'),
    losses: add('losses'),
    fought: add('fought'),
    heroDown: add('heroDown'),
    rallies: add('rallies'),
    screens: add('screens'),
    stuck: add('stuck'),
    warnings: messages.filter((m) => WARN.test(m)).length,
    followers: [CL.quartermaster?.get(c) ? 'QM' : '', CL.merchant?.get(c) ? 'merchant' : ''].filter(Boolean).join('+') || '-',
    resumed,
    day: c.day,
  };
}

function main() {
  const days = Number(process.argv[2] || 30);
  const seeds = Number(process.argv[3] || 6);
  const rows = [];
  for (const style of ['hands-off', 'presets', 'expert']) {
    const all = [];
    for (let seed = 1; seed <= seeds; seed++) all.push(run(seed, style, days));
    const sum = (k) => all.reduce((n, r) => n + r[k], 0);
    const med = (k) => [...all.map((r) => r[k])].sort((a, b) => a - b)[Math.floor(all.length / 2)];
    rows.push({
      style,
      'money (median)': Math.round(med('money')),
      soldiers: med('soldiers'),
      renown: med('renown'),
      level: med('level'),
      'won/lost': `${sum('wins')}/${sum('losses')}`,
      fought: sum('fought'),
      'hero down': sum('heroDown'),
      rallies: sum('rallies'),
      'extra screens': sum('screens'),
      warnings: sum('warnings'),
      stuck: sum('stuck'),
      resumed: `${all.filter((r) => r.resumed && r.day >= days - 0.01).length}/${seeds}`,
    });
  }
  console.log(`Prototype G: ${seeds} campaigns × ${days} days, each style on the same seeds`);
  console.table(rows);
}

if (require.main === module) main();
module.exports = { run };
