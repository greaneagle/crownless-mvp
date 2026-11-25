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
// 1.3.0 (f7a54c4, save schema v4), 1.4.0 (e53ce42, save schema v5), 1.13.0 (7c7f371, save schema v6), 1.14.0 (a8fc03e, save schema v7), 1.15.0 (c692371, save schema v8) and 2.0.0 (0415109, save schema v9; made at W-00, before any Phase W content change), and 2.7.0 (W-05b: the first saves of the bigger world, made from the working tree; `node scripts/make-legacy-save-fixtures.js . 2.7`),
// and 2.23.0 (9826a3e, save schema v18; P8-02, before the holdings model): with that build's mills
// (CL.business) the set adds a fresh game, Q4 ended for Aurelia through the real parley with a mill at
// Brackenfield, and a Phase 7 company (followers, a retinue companion and a mill).
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
  if (c.owners) out.owners = { ...c.owners };
  if (c.businesses) out.mills = c.businesses.owned.map((b) => ({ place: b.place, owner: b.owner, seizeOn: b.seizeOn }));
  if (c.followers) out.followers = Object.keys(c.followers).filter((k) => c.followers[k]).sort();
  if (Array.isArray(c.retinue)) out.retinue = c.retinue.map((m) => m.id);
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

/** Stand at a settlement, as the game's tests do. */
function go(CL, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(CL.campaign.world, { x: s.mapX, y: s.mapY, location: sid });
}
/** Talk to someone and answer by the options' words, in order (the real dialogue). */
function say(CL, who, ...picks) {
  let v = CL.story.talk(who);
  for (const p of picks) {
    const o = v?.options.find((x) => p.test(x.text));
    if (!o) throw new Error(`${who}: no option ${p} in ${JSON.stringify(v?.options.map((x) => x.text))}`);
    v = CL.story.choose(v, o.index);
  }
  return v;
}
function must(ok, what) {
  if (!ok) throw new Error(`fixture setup failed: ${what}`);
}

const probe = newCampaign(1).CL;
if (probe.business && probe.retinue && probe.realm?.setOwner) {
  FIXTURES.unshift({
    file: 'fresh.json',
    about: 'A new game, just begun, before anything has happened.',
    make() {
      return newCampaign(2).CL;
    },
  });
  FIXTURES.push({
    file: 'q4-aurelia.json',
    about: 'Q1–Q3 done, Q4 played through the real dialogue to the Aurelian ending: Greywall passes to Aurelia, with the player’s mill at Brackenfield (Greywall’s village) and a few days after.',
    make() {
      const { CL } = newCampaign(6);
      const c = CL.campaign;
      c.gold = 3000;
      c.food = 200;
      for (const id of ['footman', 'footman', 'hunter', 'levy']) CL.save.addSoldier(c, id);
      go(CL, 'brackenfield');
      must(CL.business.buy(c, 'brackenfield'), 'mill at Brackenfield');
      must(CL.business.fund(c, 200), 'mill funded');
      const s = CL.story.state(c);
      const done = { status: 'done', stage: null, notes: [], startedDay: 0, endedDay: 0 };
      s.quests.q1 = { ...done };
      s.quests.q2 = { ...done };
      s.flags.q2_choice = 'aurelian';
      s.quests.q3 = { status: 'active', stage: 'q3_road', notes: [], startedDay: 0, stageDay: 0 };
      s.flags.q3_side = 'aurelian';
      CL.story.apply([{ complete: 'q3' }, { start: 'q4' }], c, { quest: 'q3' });
      say(CL, 'rival_agent', /stand with the Remnant/);
      const host = c.parties.find((p) => p.questTag === 'q4_host');
      must(host, 'the Q4 host');
      CL.parties.open(host.id);
      CL.parties.attack();
      CL.debugTools.endBattleNow(true);
      CL.world.returnToMap();
      go(CL, 'greywall_fort');
      say(CL, 'story_parley', /passes to the Remnant/);
      must(CL.realm.owner('greywall_fort', c) === 'aurelian', 'Greywall passed to Aurelia');
      must(CL.story.state(c).flags.ending === 'aurelian', 'the Aurelian ending');
      CL.world.returnToMap?.();
      CL.party.advanceDays(3);
      return CL;
    },
  });
  FIXTURES.push({
    file: 'phase7-company.json',
    about: 'A Phase 7 company at Hrothgard: quartermaster, surgeon, scout and blacksmith, Sigrun of the retinue, a mill at Birkholm, then a few days on the road.',
    make() {
      const { CL } = newCampaign(7);
      const c = CL.campaign;
      c.gold = 4000;
      c.food = 200;
      for (const id of ['axeman', 'axeman', 'clansman', 'fell_archer', 'levy']) CL.save.addSoldier(c, id, null, { origin: 'hrothgard' });
      go(CL, 'birkholm');
      must(CL.business.buy(c, 'birkholm'), 'mill at Birkholm');
      must(CL.business.fund(c, 150), 'mill funded');
      go(CL, 'hrothgard');
      must(CL.quartermaster.hire(c), 'quartermaster');
      must(CL.surgeon.hire(c), 'surgeon');
      must(CL.scout.hire(c), 'scout');
      must(CL.blacksmith.hire(c), 'blacksmith');
      must(CL.retinue.join(c, 'sigrun'), 'Sigrun joins');
      CL.party.advanceDays(4);
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
