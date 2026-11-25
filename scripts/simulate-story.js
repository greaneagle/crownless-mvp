// Story soak test: a randomized bot plays whole campaigns from a fresh start to an ending on the
// real game logic (tests/helpers/story-bot.js) and reports endings, branches and any soft-lock.
//   node scripts/simulate-story.js [seeds=200] [--realm id | --every]
// P10-04: --realm begins every game in that kingdom; --every runs the seeds in each kingdom in turn.
// Starts rotate: a funded company, the bare GDD start (every third seed); the bot wins 85% or
// 40% of its fights (odd/even seeds). The same mix as tests/gate-d.test.js, at any size.
const { newCampaign, mulberry } = require('./simulate-campaign');
const { makeStoryBot } = require('../tests/helpers/story-bot');

function run(seed, realm) {
  const { CL } = newCampaign(seed, 'farmhand', { realm });
  const c = CL.campaign;
  if (seed % 3) {
    c.gold = 3000;
    c.food = 300;
    for (const id of ['footman', 'footman', 'footman', 'hunter', 'hunter', 'levy', 'levy', 'levy']) CL.save.addSoldier(c, id);
  } else c.food = 60;
  const r = makeStoryBot(CL, mulberry(seed * 31 + 7), { winChance: seed % 2 ? 0.85 : 0.4 }).play(800);
  const f = CL.story.state(CL.campaign).flags;
  return {
    seed,
    realm: CL.campaign.startRealm,
    ending: r.finished ? f.ending : 'STUCK',
    day: Math.round(CL.campaign.day * 10) / 10,
    q1: f.q1_wagon_safe || f.q1_wagon_slipped ? 'wagon' : f.q1_hired ? 'recruits' : 'bandits',
    q2: `${f.q2_how}/${f.q2_choice}`,
    q3: f.q3_side,
    mara: f.mara_saved ? 'saved' : f.mara_gone || 'unharmed',
    steps: r.stats.steps,
    fights: r.stats.fights,
    reloads: r.stats.reloads,
    trace: r.finished ? null : r.trace,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const seeds = Number(args.find((a) => /^\d+$/.test(a)) || 200);
  const at = args.indexOf('--realm');
  const realm = at >= 0 ? args[at + 1] : null;
  const realms = args.includes('--every') ? require('../tests/helpers/load').loadGame().CL.story.startRealms() : null;
  const tally = {};
  const days = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const r = run(seed, realms ? realms[(seed - 1) % realms.length] : realm);
    for (const k of ['realm', 'ending', 'q1', 'q2', 'q3', 'mara']) tally[`${k}: ${r[k]}`] = (tally[`${k}: ${r[k]}`] || 0) + 1;
    days.push(r.day);
    if (r.trace) console.log(`seed ${seed} STUCK\n${r.trace.join('\n')}`);
  }
  days.sort((a, b) => a - b);
  console.table(tally);
  console.log(`days to an ending: min ${days[0]}, median ${days[days.length >> 1]}, max ${days.at(-1)}`);
}

module.exports = { run };
