// P11-00: the XP pace. The campaign bots (tests/helpers/campaign-bot.js, each style) play brand-new games
// (scripts/simulate-campaign.js's start) and record the game day of each level and the XP by source,
// so P11-03 can set the curve past level 10 from measured play (docs/PHASE-11-PLAN.md §7, §9).
//
//   node scripts/progression.js [days=360] [seeds=3] [--styles hands-off,presets,expert,ruler] [--json]
//
// Sources: battles (js/party.js), contracts (js/contracts.js), the story (js/story.js), other.
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { makeBot } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
const { newCampaign } = require(path.join(ROOT, 'scripts/simulate-campaign'));

const STYLES = ['hands-off', 'presets', 'expert', 'ruler'];
const MARKS = [60, 120, 180, 360]; // the days at which the level and the XP earned so far are reported (XP keeps counting past the cap)

/** Where an XP award came from, by the module that gave it. */
function sourceOf(stack) {
  for (const [file, name] of [
    ['contracts.js', 'contracts'],
    ['story.js', 'story'],
    ['party.js', 'battles'],
  ])
    if (stack.includes(file)) return name;
  return 'other';
}

/** One campaign: days to each level and XP by source. */
function campaign(seed, style, days) {
  const { CL } = newCampaign(seed);
  const c = CL.campaign;
  const C = CL.character;
  const levelDay = { 1: 0 };
  const xp = { battles: 0, contracts: 0, story: 0, other: 0 };
  const at = {};
  const gain = C.gainXp;
  C.gainXp = (amount, camp = CL.campaign) => {
    const before = camp.character?.level;
    const src = sourceOf(new Error().stack || '');
    if (amount > 0) xp[src] += amount;
    const n = gain(amount, camp);
    for (let L = before + 1; L <= camp.character.level; L++) levelDay[L] = Math.round(camp.day * 10) / 10;
    return n;
  };
  const bot = makeBot(CL, { style });
  let played = 0;
  for (const m of [...MARKS.filter((d) => d < days), days]) {
    bot.play(m - played);
    played = m;
    at[m] = { level: c.character.level, xp: Math.round(xp.battles + xp.contracts + xp.story + xp.other) };
  }
  return { seed, style, level: c.character.level, levelDay, xp, at };
}

function run({ days = 360, seeds = 3, styles = STYLES } = {}) {
  const rows = [];
  for (const style of styles) for (let seed = 1; seed <= seeds; seed++) rows.push(campaign(seed, style, days));
  return rows;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const nums = args.filter((a, i) => /^\d+$/.test(a) && !String(args[i - 1]).startsWith('--'));
  const days = Number(nums[0] || 360);
  const seeds = Number(nums[1] || 3);
  const i = args.indexOf('--styles');
  const styles = i >= 0 ? args[i + 1].split(',') : STYLES;
  const t0 = Date.now();
  const rows = run({ days, seeds, styles });
  if (args.includes('--json')) console.log(JSON.stringify({ days, seeds, rows }, null, 2));
  else {
    console.log(`XP pace: the campaign bots, ${days} days, ${seeds} seeds a style. The day each level came (– never)`);
    console.log(`${'style'.padEnd(10)}seed  L2   L3   L4   L5   L6   L7   L8   L9   L10  ${MARKS.filter((d) => d <= days).map((d) => `L/XP@${d}`.padStart(11)).join('')}   XP: battles contracts story other`);
    for (const r of rows) {
      const cells = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((L) => String(r.levelDay[L] != null ? Math.round(r.levelDay[L]) : '–').padStart(4)).join(' ');
      const marks = MARKS.filter((d) => d <= days).map((d) => `${r.at[d].level}/${r.at[d].xp}`.padStart(11)).join('');
      console.log(`${r.style.padEnd(10)}${String(r.seed).padStart(4)} ${cells} ${marks}   ${[r.xp.battles, r.xp.contracts, r.xp.story, r.xp.other].map((n) => String(Math.round(n)).padStart(7)).join(' ')}`);
    }
    console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}

module.exports = { STYLES, campaign, run, sourceOf };
