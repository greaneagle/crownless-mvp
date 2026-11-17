// Builds save fixtures from an OLD build of the game (V2-01: "fixtures from 0.14, 0.28 and 1.0"), so
// later builds are tested against saves that old builds really wrote, not imitations.
//
//   git worktree add --detach <dir> <commit>        (a throwaway checkout of the old build)
//   node scripts/make-legacy-save-fixtures.js <dir> <label>
//   git worktree remove <dir>
//
// It loads the OLD checkout's own game logic and bots (scripts/simulate-campaign.js and
// tests/helpers/*.js at that commit), plays a seeded campaign there, exports it with that build's own
// Save & export, and writes tests/fixtures/saves-<label>/ in this repository: the exported files and
// index.json with what a later build must reproduce on import.
// Used for 0.14.0 (a00c5b6, Gate C), 0.28.0 (d96b90d, Gate D), 1.2.0 (2673ca9, save schema v3)
// 1.3.0 (f7a54c4, save schema v4) and 1.4.0 (e53ce42, save schema v5).
// Re-running replaces the set; only do that on purpose. The 0.3.x (schema v1) fixture is
// hand-written from docs/BASELINE.md §6 instead,
// because that build was a single minified file with no bots.
const fs = require('node:fs');
const path = require('node:path');

const [, , checkout, label] = process.argv;
if (!checkout || !label) {
  console.error('usage: node scripts/make-legacy-save-fixtures.js <old-build-checkout> <label>');
  process.exit(1);
}
const OLD = path.resolve(checkout);
const OUT = path.join(__dirname, '..', 'tests', 'fixtures', `saves-${label}`);
const { newCampaign, mulberry } = require(path.join(OLD, 'scripts', 'simulate-campaign.js'));
const { makeBot } = require(path.join(OLD, 'tests', 'helpers', 'campaign-bot.js'));
const storyBotFile = path.join(OLD, 'tests', 'helpers', 'story-bot.js');
const makeStoryBot = fs.existsSync(storyBotFile) ? require(storyBotFile).makeStoryBot : null;

/** What a later build must reproduce after importing: only fields every build since 0.5 has kept. */
function summary(c) {
  const out = {
    build: null,
    name: c.character?.name ?? null,
    day: Math.round(c.day * 1000) / 1000,
    gold: c.gold,
    renown: c.renown,
    battles: c.battles,
    victories: c.victories,
    soldierIds: c.roster.map((s) => s.id),
    troops: c.roster.map((s) => s.troop),
    xp: c.roster.map((s) => s.xp),
    location: c.world?.location ?? null,
  };
  if (c.story) {
    out.quests = {};
    for (const [id, r] of Object.entries(c.story.quests)) out.quests[id] = r.status;
  }
  return out;
}

const FIXTURES = [
  {
    file: 'campaign-day20.json',
    about: '20 days of mercenary life by that build’s campaign bot.',
    make() {
      const { CL } = newCampaign(3);
      makeBot(CL).play(20);
      return CL;
    },
  },
];
if (makeStoryBot) {
  FIXTURES.push({
    file: 'story-played.json',
    about: 'A funded company playing the story with that build’s story bot until a middle quest is under way or the story ends (seed 4 reaches the Q4 ending).',
    make() {
      const { CL } = newCampaign(4);
      const c = CL.campaign;
      c.gold = 3000;
      c.food = 200;
      for (const id of ['footman', 'footman', 'hunter', 'levy']) CL.save.addSoldier(c, id);
      const bot = makeStoryBot(CL, mulberry(4 * 31 + 7));
      for (let steps = 2; steps <= 300; steps += 2) {
        bot.play(steps);
        const q = CL.story.state(CL.campaign).quests;
        if (q.q1?.status === 'done' && (q.q2?.status === 'active' || q.q3?.status === 'active')) break;
      }
      return CL;
    },
  });
}

fs.mkdirSync(OUT, { recursive: true });
const index = [];
for (const f of FIXTURES) {
  const CL = f.make();
  const text = CL.portable.serialize(CL.campaign);
  fs.writeFileSync(path.join(OUT, f.file), `${text}\n`);
  const expect = summary(CL.campaign);
  expect.build = CL.BUILD;
  index.push({ file: f.file, about: f.about, expect });
  console.log(`${label}/${f.file}: build ${CL.BUILD}, day ${expect.day}, ${expect.soldierIds.length} soldiers, ${text.length} bytes`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
