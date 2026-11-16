/* Crownless content: quests. Plain classic script; no modules, no fetch.
 * Read by the story interpreter (js/story.js). A quest starts from a dialogue effect
 * ({ start: 'q1' }) and walks through its stages; each stage has a journal line and triggers:
 *   on: [{ event, match?, if?, do }]   — event: battle | enter | recruit | trade | contract | talk | parley
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
    // GDD §4 Q2 (investigation): recover a courier's packet by fighting, paying an informant or
    // intimidating the thieves; it holds contradictory Greywall charters. Show it to Valedorn, to
    // Aurelian, or keep it. The choice moves reputation and dialogue, never locks later quests.
    q2: {
      id: 'q2',
      title: 'The Broken Seal',
      giver: 'caravan_master',
      summary: 'Caravan Master Oswin lost a sealed courier packet to Reavers on the river road. It may say who should hold Greywall.',
      stages: [
        {
          id: 'q2_recover',
          journal: 'Recover the packet from the Reavers camped on the river road between Eastwatch and Highmere — fight them, cow them, or pay the fence in Highmere for their secret.',
          band: {
            template: 'bandits',
            tag: 'q2_thieves',
            camp: true, // they sit on their loot; the player chooses how to deal with them
            between: ['eastwatch', 'highmere'],
            troops: { looter: 4, reaver: 2 },
            text: 'The Reavers who took Oswin’s packet are dug in by the river, a broken courier’s satchel hanging from a spear.'
          },
          on: [
            { event: 'battle', match: { win: true, tag: 'q2_thieves' }, do: [{ give: 'courier_packet' }, { set: 'q2_how', to: 'fought' }, { stage: 'q2_choose' }, { note: 'You took the packet from the Reavers by force.' }, { message: 'You recover the courier packet.' }] },
            { event: 'parley', match: { tag: 'q2_thieves', outcome: 'intimidate' }, do: [{ give: 'courier_packet' }, { set: 'q2_how', to: 'cowed' }, { stage: 'q2_choose' }, { note: 'The Reavers threw the packet at your feet rather than face your company.' }, { message: 'The Reavers drop the packet and flee.' }] }
          ]
        },
        {
          id: 'q2_choose',
          journal: 'The packet holds two sealed copies of the Greywall charter, naming different heirs. Show it to Captain Aldric in Stonebridge (Valedorn), Magistrate Vell in Eastwatch (Aurelian), or tell Oswin you are keeping it.'
        }
      ],
      rewards: { gold: 80, renown: 15, xp: 80 }
    },
    // GDD §4 Q3 (commitment): both claimants offer a short mercenary contract. Support one, sell
    // information to the other, or refuse both and protect the road. Each spawns a linked battle:
    // a column to break or a caravan to save. Mara scouts ahead of it; she lives if you get there
    // within 3 days (GDD §10: her one narrative consequence).
    q3: {
      id: 'q3',
      title: 'Two Banners',
      giver: 'valedorn_agent',
      summary: 'Captain Aldric and Magistrate Vell both want your sword. Whatever you choose, the roads will burn somewhere.',
      stages: [
        { id: 'q3_choose', journal: 'Hear the offers: Captain Aldric in Stonebridge (Valedorn) and Magistrate Vell in Eastwatch (Aurelian). Support one, sell one’s plans to the other, or refuse both and guard the road.' },
        {
          id: 'q3_strike_aurelian',
          journal: 'For the Crown: break the Aurelian supply column camped on the Ashgate road, south-east of Stonebridge.',
          band: { template: 'aurelian_patrol', name: 'Aurelian Supply Column', tag: 'q3_column', between: ['stonebridge', 'ashgate_fort'], troops: { spearman: 4, skirmisher: 3, recruit: 3 }, camp: true, text: 'The Aurelian supply column has made camp, wagons in a ring and spears out. They have seen your banner.' },
          begin: [{ set: 'mara_scouting' }, { send: 'mara' }, { message: 'Mara rides ahead to scout. Reach the clash within 3 days, or she will be caught alone.' }],
          deadline: 3,
          expire: [
            { part: 'mara', reason: 'fell', if: { companion: 'mara' } },
            { set: 'mara_gone', to: 'fell', if: { not: { flag: 'mara_gone' } } },
            { clear: 'mara_scouting' },
            { note: 'You came too late. Mara was caught scouting alone and did not come back.' },
            { message: 'Word comes back from the road: Mara was caught alone. She is gone.' }
          ],
          on: [{ event: 'battle', match: { win: true, tag: 'q3_column' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'valedorn', by: 25 }, { note: 'The Aurelian column is broken. The Crown is in your debt.' }, { complete: 'q3' }] }]
        },
        {
          id: 'q3_strike_valedorn',
          journal: 'For the Remnant: break the Valedorn column camped on the Greywall road, north of Stonebridge.',
          band: { template: 'valedorn_patrol', name: 'Valedorn Column', tag: 'q3_column', between: ['stonebridge', 'greywall_fort'], troops: { footman: 4, hunter: 3, levy: 3 }, camp: true, text: 'The Crown’s column holds the Greywall road behind a wall of shields, blue pennants snapping.' },
          begin: [{ set: 'mara_scouting' }, { send: 'mara' }, { message: 'Mara rides ahead to scout. Reach the clash within 3 days, or she will be caught alone.' }],
          deadline: 3,
          expire: [
            { part: 'mara', reason: 'fell', if: { companion: 'mara' } },
            { set: 'mara_gone', to: 'fell', if: { not: { flag: 'mara_gone' } } },
            { clear: 'mara_scouting' },
            { note: 'You came too late. Mara was caught scouting alone and did not come back.' },
            { message: 'Word comes back from the road: Mara was caught alone. She is gone.' }
          ],
          on: [{ event: 'battle', match: { win: true, tag: 'q3_column' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'aurelian', by: 25 }, { note: 'The Valedorn column is broken. The Remnant is in your debt.' }, { complete: 'q3' }] }]
        },
        {
          id: 'q3_road',
          journal: 'While the banners circle each other, Reavers have a caravan pinned on the Eastwatch road. Save it.',
          band: { template: 'bandits', name: 'Caravan Raiders', tag: 'q3_raiders', between: ['stonebridge', 'eastwatch'], troops: { looter: 5, reaver: 3 }, camp: true, text: 'Reavers swarm a stranded caravan, cutting at the harness ropes. The drivers are fighting back with cudgels.' },
          begin: [{ set: 'mara_scouting' }, { send: 'mara' }, { message: 'Mara rides ahead to scout. Reach the clash within 3 days, or she will be caught alone.' }],
          deadline: 3,
          expire: [
            { part: 'mara', reason: 'fell', if: { companion: 'mara' } },
            { set: 'mara_gone', to: 'fell', if: { not: { flag: 'mara_gone' } } },
            { clear: 'mara_scouting' },
            { note: 'You came too late. Mara was caught scouting alone and did not come back.' },
            { message: 'Word comes back from the road: Mara was caught alone. She is gone.' }
          ],
          on: [{ event: 'battle', match: { win: true, tag: 'q3_raiders' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'valedorn', by: 10 }, { rep: 'aurelian', by: 10 }, { set: 'road_protector', if: { flag: 'q3_side', is: 'road' } }, { note: 'The caravan is safe. Both banners hear that someone still guards the road.' }, { complete: 'q3' }] }]
        }
      ],
      rewards: { gold: 120, renown: 15, xp: 100 }
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
