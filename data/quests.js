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
    // GDD §4 Q1 (onboarding): escort a grain wagon, clear nearby bandits or help a recruiter.
    // Every route ends at Elder Maren with the charter fragment, so no branch locks later story.
    q1: {
      id: 'q1',
      title: "A Stranger's Wage",
      giver: 'stonebridge_elder',
      summary: 'Stonebridge needs a sword for hire: fetch the grain wagon, break the Reavers or help the recruiter.',
      stages: [
        { id: 'q1_choose_work', journal: 'Choose your work: talk to Elder Maren in Stonebridge again.' },
        // Route 1: the grain wagon.
        {
          id: 'q1_wagon_go',
          journal: 'Meet the grain wagon at Oakford, south-west along the road.',
          on: [{ event: 'enter', match: { settlement: 'oakford' }, do: [{ stage: 'q1_wagon_back' }, { note: 'The wagon is loaded at Oakford. Reavers were seen on the road home.' }, { message: 'The grain wagon creaks out of Oakford behind you.' }] }]
        },
        {
          id: 'q1_wagon_back',
          journal: 'Bring the wagon home to Stonebridge. Reavers lie in wait on the Oakford road.',
          band: { template: 'bandits', tag: 'q1_ambush', between: ['oakford', 'stonebridge'], troops: { looter: 3 }, text: 'Reavers burst from the ditch and run for the grain wagon, blades out!' },
          on: [
            { event: 'battle', match: { win: true, tag: 'q1_ambush' }, do: [{ set: 'q1_wagon_safe' }, { stage: 'q1_report' }, { note: 'You broke the ambush. One of the Reavers carried a scrap of sealed parchment.' }] },
            { event: 'enter', match: { settlement: 'stonebridge' }, do: [{ set: 'q1_wagon_slipped' }, { stage: 'q1_report' }, { note: 'You slipped the wagon past the ambush and into Stonebridge.' }] }
          ]
        },
        // Route 2: the Reavers.
        {
          id: 'q1_bandits',
          journal: 'Break a band of Road Reavers on the map, or clear the Looter Camp north-west of Stonebridge.',
          on: [
            { event: 'battle', match: { win: true, site: 'looter_camp' }, do: [{ stage: 'q1_report' }, { note: 'The Looter Camp is cleared. Among the spoils: a scrap of sealed parchment.' }] },
            { event: 'battle', match: { win: true, party: 'bandits' }, do: [{ stage: 'q1_report' }, { note: 'The Reavers are broken. Their leader carried a scrap of sealed parchment.' }] }
          ]
        },
        // Route 3: the recruiter.
        {
          id: 'q1_recruits',
          journal: 'Help Sergeant Brun at the Muster Hall: hire three soldiers ({flag:q1_hired}/3 so far).',
          on: [
            { event: 'recruit', if: { flag: 'q1_hired', gte: 2 }, do: [{ add: 'q1_hired' }, { stage: 'q1_drill' }, { message: 'Three new soldiers. Now see how they fight.' }] },
            { event: 'recruit', do: [{ add: 'q1_hired' }] }
          ]
        },
        {
          id: 'q1_drill',
          journal: 'Lead your new soldiers to victory in a fight — any fight.',
          on: [{ event: 'battle', match: { win: true }, do: [{ stage: 'q1_report' }, { note: 'Your recruits held. In the loot, Brun found a scrap of sealed parchment.' }] }]
        },
        { id: 'q1_report', journal: 'Report back to Elder Maren in Stonebridge.' }
      ],
      rewards: { gold: 50, renown: 15, xp: 60, rep: { valedorn: 10 } }
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
