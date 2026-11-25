// P10-05: every origin with an opening quest, from every kingdom, played by the story bot until its
// opening quest has led into the common quest (Q1); each ends within the band set in data
// (data/origins.js `origin_rules.band`). P10-06: all five, and one table of the end state with each
// origin's edge and its worth (gold + 15 a soldier + worn gear), printed for the balance check.
//   npm run test:slow
const test = require('node:test');
const assert = require('node:assert/strict');
const { newCampaign, mulberry } = require('../../scripts/simulate-campaign');
const { makeStoryBot } = require('../helpers/story-bot');
const { endState } = require('../helpers/origins');

const { CL: CL0 } = require('../helpers/load').loadGame();
const REALMS = Array.from(CL0.story.startRealms());
const ORIGINS = Object.values(CL0.content.table('origins')).filter((o) => o.quest).map((o) => o.id);
const BAND = CL0.content.get('origin_rules', 'band');

test(`every origin's opening quest, from every kingdom, leads into the common quest within the band (${ORIGINS.length} × ${REALMS.length})`, () => {
  const out = [];
  let seed = 1;
  for (const origin of ORIGINS) {
    for (const realm of REALMS) {
      const { CL } = newCampaign(seed, origin, { realm, plain: false });
      const q = CL.content.get('origins', origin).quest;
      // A new player's way through it: the quest's steps and nothing else (the bot saves and reloads too).
      // Its fights are won: the band measures the origins, not the luck of a lost fight.
      const r = makeStoryBot(CL, mulberry(seed * 13 + 5), { until: (x) => CL.story.questStatus(x, q) === 'done', focus: q, winChance: 1 }).play(300);
      const c = CL.campaign;
      assert.ok(r.finished, `${origin} in ${realm}: the opening quest never ended\n${r.trace.slice(-10).join('\n')}`);
      assert.equal(CL.story.questStatus(c, 'q1'), 'active', `${origin} in ${realm}: it leads into the common quest`);
      assert.equal(CL.story.state(c).flags.origin_done, true);
      const s = endState(CL, c);
      out.push({ origin, realm, ...s, worth: s.gold + 15 * s.soldiers + s.gear, edge: CL.content.get('origins', origin).edge.split(':')[0] });
      for (const k of Object.keys(BAND).filter((x) => x !== 'id')) {
        assert.ok(s[k] >= BAND[k][0] && s[k] <= BAND[k][1], `${origin} in ${realm}: ${k} ${s[k]} outside ${BAND[k].join('–')}`);
      }
      seed++;
    }
  }
  console.table(out);
});
