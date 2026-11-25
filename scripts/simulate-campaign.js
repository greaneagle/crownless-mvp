// Multi-seed campaign simulation: a headless bot plays brand-new games (the GDD start: 60 crowns,
// no soldiers) for N days on the real game logic and reports how each campaign went.
//   node scripts/simulate-campaign.js [days=30] [seeds=8] [--roam]   (--roam, W-08: the bot tours the realm)
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

/**
 * A fresh GDD new game on a seeded world, driven headlessly. P10-04: `realm`, the kingdom it begins in.
 * P10-05: the bare start (the start town, the common quest) unless `plain: false` plays the origin's
 * opening quest.
 */
function newCampaign(seed, origin = 'farmhand', { world, realm, plain = true } = {}) {
  const env = loadGame({ party: false, random: mulberry(seed * 7919), seed, world }); // P9-08: `world`, another official world
  const { CL } = env;
  const messages = [];
  CL.ui = headlessUi(CL, messages);
  CL.game.newGame = true;
  CL.character.begin({ name: `Bot${seed}`, origin, realm, plain });
  const c = CL.campaign;
  c.rngSeed = seed;
  c.parties = [];
  c.partySpawns = {};
  c.nextPartyId = 1;
  CL.parties.ensure(c, true);
  return { ...env, messages };
}

function run(seed, days, { roam = false } = {}) {
  const { CL, messages } = newCampaign(seed);
  const bot = makeBot(CL, { roam });
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
  const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  const days = Number(nums[0] || 30);
  const seeds = Number(nums[1] || 8);
  const roam = process.argv.includes('--roam'); // W-08: tour the realm's boards
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push(run(seed, days, { roam }));
  console.table(rows);
}

module.exports = { newCampaign, run, mulberry };
