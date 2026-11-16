/* Crownless content: quests. Plain classic script; no modules, no fetch.
 * Read by the story interpreter (js/story.js). A quest starts from a dialogue effect
 * ({ start: 'q1' }) and walks through its stages; each stage has a journal line and triggers:
 *   on: [{ event, match?, if?, do }]   — event: battle | enter | recruit | trade | contract | talk
 * Triggers move the quest on with { stage: 'id' } or close it with { complete: 'q1' } / { fail: 'q1' }.
 * rewards are paid on completion: { gold, renown, xp, rep: { faction: n } }.
 * GDD §4: four story quests; the stage triggers are authored with each quest (Gate D 4.8–4.12). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.quests = {
    q1: {
      id: 'q1',
      title: "A Stranger's Wage",
      giver: 'stonebridge_elder',
      summary: 'Stonebridge needs a sword for hire: escort a wagon, clear the bandits or help the recruiter.',
      stages: [
        { id: 'q1_choose_work', journal: 'Choose your work in Stonebridge: the wagon, the bandits or the recruiter.' },
        { id: 'q1_do_work', journal: 'Finish the work you took on.' },
        { id: 'q1_report', journal: 'Report back to Elder Maren in Stonebridge.' }
      ],
      rewards: { gold: 50, renown: 15 }
    },
    q2: {
      id: 'q2',
      title: 'The Broken Seal',
      giver: 'caravan_master',
      summary: 'A courier’s packet went missing in a caravan ambush. It may say who should hold Greywall.',
      stages: [
        { id: 'q2_ambush', journal: 'Find the site of the caravan ambush.' },
        { id: 'q2_recover_packet', journal: 'Recover the courier packet.' },
        { id: 'q2_choose_faction', journal: 'Decide who sees the packet: Valedorn, Aurelian, or nobody.' }
      ],
      rewards: { gold: 80, renown: 15 }
    },
    q3: {
      id: 'q3',
      title: 'Two Banners',
      giver: 'valedorn_agent',
      summary: 'Both claimants want your sword for a short contract.',
      stages: [
        { id: 'q3_choose_contract', journal: 'Support one claimant, sell information to the other, or refuse both.' },
        { id: 'q3_linked_encounter', journal: 'Resolve the clash on the road.' },
        { id: 'q3_mara_survival', journal: 'Make sure Mara survives.' }
      ],
      rewards: { gold: 120, renown: 15 }
    },
    q4: {
      id: 'q4',
      title: 'The Greywall Verdict',
      giver: 'aurelian_agent',
      summary: 'One battle near Greywall decides the fort, and the march with it.',
      stages: [
        { id: 'q4_field_battle', journal: 'Win the deciding battle near Greywall.' },
        { id: 'q4_negotiation', journal: 'Choose the terms of the settlement.' },
        { id: 'q4_ending', journal: 'See the verdict through.' }
      ],
      rewards: { gold: 200, renown: 15 }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
