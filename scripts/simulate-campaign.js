// Multi-seed campaign simulation: a headless bot plays brand-new games (the GDD start: 60 crowns,
// no soldiers) for N days on the real game logic and reports how each campaign went.
//   node scripts/simulate-campaign.js [days=30] [seeds=8]
const { loadGame } = require('../tests/helpers/load');
const { makeBot, headlessUi } = require('../tests/helpers/campaign-bot');

/** Seeded stand-in for Math.random so whole campaigns are reproducible. */
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

/** A fresh GDD new game on a seeded world, driven headlessly. */
function newCampaign(seed, background = 'farmhand') {
  const env = loadGame({ party: false, random: mulberry(seed * 7919), seed });
  const { CL } = env;
  const messages = [];
  CL.ui = headlessUi(CL, messages);
  CL.game.newGame = true;
  CL.character.begin({ name: `Bot${seed}`, background });
  const c = CL.campaign;
  c.rngSeed = seed;
  c.parties = [];
  c.partySpawns = {};
  c.nextPartyId = 1;
  CL.parties.ensure(c, true);
  return { ...env, messages };
}

function run(seed, days) {
  const { CL, messages } = newCampaign(seed);
  const bot = makeBot(CL);
  const s = bot.play(days);
  const c = CL.campaign;
  const count = (msg) => CL.diag.events.filter((e) => e.msg === msg).length;
  return {
    seed,
    day: +c.day.toFixed(1),
    gold: c.gold,
    soldiers: c.roster.length,
    cap: CL.party.partyCap(c),
    level: c.character.level,
    renown: c.renown,
    contracts: c.contractsDone,
    wins: s.wins,
    losses: s.losses,
    retreats: s.retreats,
    tolls: s.tolls,
    hired: s.hired,
    upgraded: s.upgraded,
    gear: s.gearBought,
    armor: CL.character.heroCombat().armor,
    desertions: count('Desertion'),
    starving: messages.filter((m) => /run out of food/.test(m)).length,
    unpaidWages: messages.filter((m) => /Wages short/.test(m)).length,
    minGold: s.minGold,
    stuck: s.stuck,
  };
}

if (require.main === module) {
  const days = Number(process.argv[2] || 30);
  const seeds = Number(process.argv[3] || 8);
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push(run(seed, days));
  console.table(rows);
}

module.exports = { newCampaign, run, mulberry };
