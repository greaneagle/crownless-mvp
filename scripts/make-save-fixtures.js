// Builds the v1.0 save fixtures (tests/fixtures/saves-v1.0/): exported save files from five points in
// a real campaign, played on the real game logic by the same bots the tests use. They are the
// "first fixtures the v2 migration must load" (docs/V2-PLAN.md 5.8 / V2-01) and are committed as
// files; tests/save-fixtures.test.js checks every build can still read them.
//   node scripts/make-save-fixtures.js
// Re-running replaces them, so only do that on purpose (for example, a new fixture set for v2.0).
const fs = require('node:fs');
const path = require('node:path');
const { newCampaign, mulberry } = require('./simulate-campaign');
const { makeBot } = require('../tests/helpers/campaign-bot');
const { makeStoryBot } = require('../tests/helpers/story-bot');

const OUT = path.join(__dirname, '..', 'tests', 'fixtures', 'saves-v1.0');

function funded(CL) {
  const c = CL.campaign;
  c.gold = 3000;
  c.food = 200;
  for (const id of ['footman', 'footman', 'hunter', 'levy']) CL.save.addSoldier(c, id);
}

/** A short summary a later build must reproduce when it loads the file. */
function summary(c, CL) {
  const quests = {};
  for (const [id, r] of Object.entries(c.story.quests)) quests[id] = r.status;
  return {
    name: c.character?.name ?? null,
    day: Math.round(c.day * 1000) / 1000,
    gold: c.gold,
    renown: c.renown,
    soldiers: c.roster.length,
    soldierIds: c.roster.map((s) => s.id),
    troops: c.roster.map((s) => s.troop),
    location: c.world.location,
    quests,
    ending: CL.story.state(c).flags.ending ?? null,
    companion: c.companion?.id ?? null,
    contract: c.contract ? c.contract.template : null,
    owners: Object.fromEntries(CL.realm.forts().map((s) => [s.id, CL.realm.owner(s.id, c)])), // who holds each fort's gates (c.owners until P8-02)
    reputation: { ...c.reputation },
    parties: c.parties.filter((p) => !p.lordId).length, // the regular parties: lords ride beside them from 2.26.0 (P8-01)
    newsLines: c.news.lines.length,
  };
}

const FIXTURES = [
  {
    file: 'new-game.json',
    about: 'A brand-new game: character created, standing in Stonebridge, no soldiers.',
    make() {
      return newCampaign(1).CL;
    },
  },
  {
    file: 'campaign-day30.json',
    about: '30 days of mercenary life by the campaign bot: soldiers, upgrades, gear, cargo, contracts.',
    make() {
      const { CL } = newCampaign(1);
      makeBot(CL).play(30);
      return CL;
    },
  },
  {
    file: 'mid-story-escort.json',
    about: 'Part-way through the story, with an escort contract under way (caravan and ambush on the map).',
    make() {
      const { CL } = newCampaign(2);
      funded(CL);
      // Play only until a middle quest (Q2 or Q3) is under way, then take an escort.
      const bot = makeStoryBot(CL, mulberry(2 * 31 + 7));
      for (let steps = 2; steps <= 300; steps += 2) {
        bot.play(steps);
        const q = CL.story.state(CL.campaign).quests;
        if (q.q2?.status === 'active' || q.q3?.status === 'active') break;
      }
      const c = CL.campaign;
      if (c.contract) CL.contracts.abandon(c);
      const r = CL.contracts.accept(c, 'stonebridge', 'escort');
      if (!r.ok) throw new Error(`escort not taken: ${r.reason}`);
      return CL;
    },
  },
  {
    file: 'ending-road-peace-mara.json',
    about: 'The story finished with the road peace (compromise ending), Mara in the company.',
    make() {
      const { CL } = newCampaign(3);
      funded(CL);
      makeStoryBot(CL, mulberry(3 * 31 + 7)).play(800);
      return CL;
    },
  },
  {
    file: 'ending-crown.json',
    about: 'The story finished with Greywall held for the Crown (Valedorn ending); the sandbox goes on.',
    make() {
      const { CL } = newCampaign(5);
      funded(CL);
      makeStoryBot(CL, mulberry(5 * 31 + 7)).play(800);
      return CL;
    },
  },
];

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  for (const f of FIXTURES) {
    const CL = f.make();
    const text = CL.portable.serialize(CL.campaign);
    fs.writeFileSync(path.join(OUT, f.file), text);
    index.push({ file: f.file, about: f.about, build: CL.BUILD, expect: summary(CL.campaign, CL) });
    console.log(`${f.file}: ${(text.length / 1024).toFixed(1)} KB`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
}

module.exports = { summary, FIXTURES };
