/* Crownless content: quests. Plain classic script; no modules, no fetch.
 * Read by the story interpreter (js/story.js). A quest starts from a dialogue effect
 * ({ start: 'q1' }) and walks through its stages; each stage has a journal line and triggers:
 *   on: [{ event, match?, if?, do }]   — event: battle | enter | recruit | trade | contract | talk | parley
 * Triggers move the quest on with { stage: 'id' } or close it with { complete: 'q1' } / { fail: 'q1' }.
 * rewards are paid on completion: { gold, renown, xp, rep: { faction: n } }.
 * side: true marks an errand (V2-Q): optional, small, built on the new systems.
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
          on: [{ event: 'battle', match: { win: true, tag: 'q3_column' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'valedorn', by: 25 }, { note: 'The Aurelian column is broken. The Crown is in your debt.' }, { complete: 'q3' }, { start: 'q4' }] }]
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
          on: [{ event: 'battle', match: { win: true, tag: 'q3_column' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'aurelian', by: 25 }, { note: 'The Valedorn column is broken. The Remnant is in your debt.' }, { complete: 'q3' }, { start: 'q4' }] }]
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
          on: [{ event: 'battle', match: { win: true, tag: 'q3_raiders' }, do: [{ recall: 'mara' }, { set: 'mara_saved', if: { flag: 'mara_scouting' } }, { note: 'You reached the clash in time. Mara rode out of the smoke unhurt.', if: { flag: 'mara_scouting' } }, { clear: 'mara_scouting' }, { rep: 'valedorn', by: 10 }, { rep: 'aurelian', by: 10 }, { set: 'road_protector', if: { flag: 'q3_side', is: 'road' } }, { note: 'The caravan is safe. Both banners hear that someone still guards the road.' }, { complete: 'q3' }, { start: 'q4' }] }]
        }
      ],
      rewards: { gold: 120, renown: 15, xp: 100 }
    },
    // GDD §4 Q4 (climax): one deciding field battle near Greywall, then a short negotiation. The
    // outcome uses quest flags plus the battle: Valedorn victory, Aurelian victory, or the
    // compromise / independent road peace — only for a hero who refused full allegiance AND kept
    // Oswin's packet as evidence (Q2). Sets Greywall's owner and both kingdoms' standing, shows an
    // ending panel, and the sandbox carries on.
    q4: {
      id: 'q4',
      title: 'The Greywall Verdict',
      giver: 'aurelian_agent',
      summary: 'Both banners march on Greywall. One battle and one parley will decide the fort, and the march with it.',
      stages: [
        {
          id: 'q4_declare',
          journal: 'Both armies march on Greywall. Declare for the Crown (Captain Aldric, Stonebridge), for the Remnant (Magistrate Vell, Eastwatch), or for the road and neither crown (Elder Maren, Stonebridge).'
        },
        {
          id: 'q4_field_valedorn',
          journal: 'For the Crown: break the Aurelian host drawn up before Greywall Fort.',
          band: { template: 'aurelian_patrol', name: 'Aurelian Host', tag: 'q4_host', near: 'greywall_fort', map: 'greywall_courtyard', troops: { spearman: 6, legionary: 3, skirmisher: 4, marksman: 2, horse_scout: 2 }, camp: true, text: 'The Aurelian host stands before Greywall’s gate in red ranks, legionaries at the centre, horse on the wings. The Crown’s eyes are on you.' },
          on: [{ event: 'battle', match: { win: true, tag: 'q4_host' }, do: [{ stage: 'q4_terms' }, { note: 'The Aurelian host broke before Greywall. The envoys wait in the parley tent.' }, { message: 'The field is yours. Go to the parley at Greywall Fort.' }] }]
        },
        {
          id: 'q4_field_aurelian',
          journal: 'For the Remnant: break the Valedorn host holding Greywall’s approach.',
          band: { template: 'valedorn_patrol', name: 'Valedorn Host', tag: 'q4_host', near: 'greywall_fort', map: 'greywall_courtyard', troops: { footman: 6, guard: 3, hunter: 4, longbowman: 2, rider: 2 }, camp: true, text: 'The Crown’s host holds the approach to Greywall behind a wall of blue shields, riders waiting on the flanks. The Remnant’s eyes are on you.' },
          on: [{ event: 'battle', match: { win: true, tag: 'q4_host' }, do: [{ stage: 'q4_terms' }, { note: 'The Valedorn host broke before Greywall. The envoys wait in the parley tent.' }, { message: 'The field is yours. Go to the parley at Greywall Fort.' }] }]
        },
        {
          id: 'q4_field_road',
          journal: 'For the road: hired blades mean to start the war before either envoy can speak. Break them before Greywall Fort.',
          band: { template: 'bandits', name: 'Hired Blades', tag: 'q4_host', near: 'greywall_fort', map: 'greywall_courtyard', troops: { mercenary: 5, reaver: 4, looter: 4 }, camp: true, text: 'Sell-swords and Reavers, paid by hard men on both sides, are spreading out to fire the first volley. Break them, and the envoys will have to talk.' },
          on: [{ event: 'battle', match: { win: true, tag: 'q4_host' }, do: [{ stage: 'q4_terms' }, { note: 'The hired blades are broken. Neither army fired a shot. The envoys wait in the parley tent.' }, { message: 'The field is quiet. Go to the parley at Greywall Fort.' }] }]
        },
        { id: 'q4_terms', journal: 'Go to the parley at Greywall Fort and set the terms.' }
      ],
      rewards: { gold: 200, renown: 15, xp: 150 },
      endings: {
        // W-07 (D-W5): each ending sets the March kingdoms' relation; from then on the usual rules apply.
        valedorn: {
          relations: { between: ['valedorn', 'aurelian'], to: 'war' },
          title: 'The Crown Holds Greywall',
          text: [
            'The blue banner flies over Greywall, and the Crown’s lawyers call the Aurelian charter a forgery. Valedorn remembers who rode for it.',
            { if: { flag: 'q2_choice', is: 'valedorn' }, text: 'The packet you gave Captain Aldric is read aloud in the King’s hall.' },
            { if: { flag: 'mara_saved' }, text: 'Mara rides at your side still, and the roads between the forts have never been better scouted.' },
            { if: { flag: 'mara_gone', is: 'fell' }, text: 'Some nights, at the fire, you still leave a place for Mara.' },
            'The Remnant licks its wounds east of the river. The roads are quieter — for now. The march goes on, and so do you.'
          ]
        },
        aurelian: {
          relations: { between: ['valedorn', 'aurelian'], to: 'war' },
          title: 'The Remnant Takes Greywall',
          text: [
            'The red banner rises over Greywall for the first time in thirty years. Imperial law has its fort back, and the Remnant remembers who won it.',
            { if: { flag: 'q2_choice', is: 'aurelian' }, text: 'Magistrate Vell enters the packet you gave her into the court archive as proof of the Aurelian claim.' },
            { if: { flag: 'mara_saved' }, text: 'Mara rides at your side still, and the roads between the forts have never been better scouted.' },
            { if: { flag: 'mara_gone', is: 'fell' }, text: 'Some nights, at the fire, you still leave a place for Mara.' },
            'The Crown swears it will return. The march goes on, and so do you.'
          ]
        },
        compromise: {
          relations: { between: ['valedorn', 'aurelian'], to: 'peace' },
          title: 'The Road Peace',
          text: [
            'You lay both charters on the parley table — two eagles, two heirs, both forged. With the proof in front of them and no battle to hide behind, the envoys sign a road peace.',
            'Greywall keeps its garrison, but its gates stay open to both crowns, and the roads between the forts are guarded in common.',
            { if: { flag: 'mara_saved' }, text: 'Mara rides at your side still, and the roads between the forts have never been better scouted.' },
            { if: { flag: 'mara_gone', is: 'fell' }, text: 'Some nights, at the fire, you still leave a place for Mara.' },
            'Carters and drovers call you the Warden of the Road. The march goes on, and so do you.'
          ]
        }
      }
    },
    // ---- V2-Q: errands (owner decision: no new main story; small, optional quests that show the
    // new systems). Each is side: true, offered by someone you already know, and can be ignored.

    // Named soldiers and the chronicle: a Stonebridge-born veteran is feasted at home.
    sq_homecoming: {
      id: 'sq_homecoming',
      title: 'Home from the Wars',
      giver: 'stonebridge_elder',
      side: true,
      summary: 'Stonebridge wants to feast one of its own who rides with your company.',
      stages: [
        {
          id: 'sq_home_grain',
          journal: 'Buy grain at any market for the feast, then bring word to Elder Maren in Stonebridge.',
          on: [{ event: 'trade', match: { good: 'grain', side: 'buy' }, do: [{ stage: 'sq_home_report' }, { note: 'Grain for the feast is in the wagons.' }] }]
        },
        { id: 'sq_home_report', journal: 'Tell Elder Maren in Stonebridge the grain is bought.' }
      ],
      rewards: { renown: 10, xp: 30, rep: { valedorn: 5 } }
    },
    // The quartermaster (V2-11).
    sq_larders: {
      id: 'sq_larders',
      title: 'Full Larders',
      giver: 'sergeant_brun',
      side: true,
      summary: 'Sergeant Brun says a company marches on its stomach, and someone should be minding it.',
      stages: [
        {
          id: 'sq_larders_hire',
          journal: 'Hire a quartermaster: Accounts, in any town or village with a market.',
          on: [{ event: 'hire', match: { follower: 'quartermaster' }, do: [{ stage: 'sq_larders_stock' }] }]
        },
        {
          id: 'sq_larders_stock',
          journal: 'Ride to a market with your quartermaster so they lay in stores.',
          on: [{ event: 'stores', do: [{ stage: 'sq_larders_report' }, { note: 'The quartermaster bought food from the company chest, and logged every crown.' }] }]
        },
        { id: 'sq_larders_report', journal: 'Report to Sergeant Brun in Stonebridge.' }
      ],
      rewards: { gold: 30, xp: 40 }
    },
    // The merchant follower (V2-12).
    sq_venture: {
      id: 'sq_venture',
      title: 'A Merchant’s First Venture',
      giver: 'caravan_master',
      side: true,
      summary: 'Caravan Master Oswin thinks a company with wagons should earn from them.',
      stages: [
        {
          id: 'sq_venture_hire',
          journal: 'Hire a merchant (Accounts, in a market town) and give them a budget.',
          on: [{ event: 'hire', match: { follower: 'merchant' }, do: [{ stage: 'sq_venture_trade' }] }]
        },
        {
          id: 'sq_venture_trade',
          journal: 'Take your merchant to a few markets until they sell at a profit. They only know prices they have seen.',
          on: [{ event: 'venture', match: { profit: true }, do: [{ stage: 'sq_venture_report' }, { note: 'Your merchant sold at a profit. Their log says what and why.' }] }]
        },
        { id: 'sq_venture_report', journal: 'Tell Caravan Master Oswin in Eastwatch how the venture went.' }
      ],
      rewards: { gold: 40, renown: 5, xp: 40 }
    },
    // Nearby reinforcements (V2-09): a Valedorn watch close by rides in if you fight here.
    sq_border: {
      id: 'sq_border',
      title: 'Smoke on the Border',
      giver: 'valedorn_agent',
      side: true,
      summary: 'Raiders are burning farms between Brackenfield and Greywall. A Crown watch is posted nearby.',
      stages: [
        {
          id: 'sq_border_fight',
          journal: 'Break the raiders between Brackenfield and Greywall. The Valedorn watch near Brackenfield will ride to the fight if it hears it.',
          bands: [
            { template: 'bandits', tag: 'sq_border_raiders', name: 'Border Raiders', between: ['brackenfield', 'greywall_fort'], troops: { looter: 5, reaver: 3 }, camp: true, help: true, text: 'Smoke rises behind the raiders’ camp. Somewhere to the south a horn answers: the Crown’s watch has heard you.' },
            { template: 'valedorn_patrol', tag: 'sq_border_watch', name: 'Valedorn Border Watch', near: 'brackenfield', troops: { footman: 3, hunter: 2 }, camp: true, helper: true, text: '“The raiders are north of here. Engage them and we will come — we can hear a fight from here.”' }
          ],
          on: [
            { event: 'battle', match: { win: true, tag: 'sq_border_raiders', reinforced: true }, do: [{ note: 'The Valedorn watch rode in and the raiders broke between you.' }, { rep: 'valedorn', by: 5 }, { complete: 'sq_border' }] },
            { event: 'battle', match: { win: true, tag: 'sq_border_raiders' }, do: [{ note: 'You broke the raiders before the watch arrived.' }, { complete: 'sq_border' }] }
          ]
        }
      ],
      rewards: { gold: 70, renown: 10, rep: { valedorn: 5 } }
    },
    // Battle preparation (V2-07): a dug-in band, best met with a plan.
    sq_planned: {
      id: 'sq_planned',
      title: 'A Planned Engagement',
      giver: 'sergeant_brun',
      side: true,
      summary: 'Sergeant Brun wants to see the company fight to a plan, not just charge.',
      stages: [
        {
          id: 'sq_planned_fight',
          journal: 'Fight the drilled Reavers dug in near Oakford yourself. On the Prepare screen try a setup: Defensive lets them come to your line.',
          band: { template: 'bandits', tag: 'sq_planned_reavers', name: 'Drilled Reavers', near: 'oakford', troops: { looter: 5, reaver: 4, mercenary: 2 }, camp: true, text: 'These Reavers stand in ranks, shields locked, sell-swords in the middle. They will not be rushed. A plan would help.' },
          on: [
            { event: 'battle', match: { win: true, tag: 'sq_planned_reavers', fought: true, preset: ['defensive', 'aggressive', 'custom'] }, do: [{ note: 'You chose your setup and it held. Brun will want to hear it.' }, { renown: 5 }, { complete: 'sq_planned' }] },
            { event: 'battle', match: { win: true, tag: 'sq_planned_reavers' }, do: [{ note: 'The Reavers are broken, if not quite to Brun’s plan.' }, { complete: 'sq_planned' }] }
          ]
        }
      ],
      rewards: { gold: 60, renown: 10, xp: 50 }
    },

    // ---- W-05c: errands beyond the March, one for each new power, each showing its land's character.
    // Their givers live in the new capitals (data/dialogue.js); like every errand, they can be ignored.

    // Hrothmark: the clans hold the mountain pass, and the pass is where raiders wait.
    sq_pass: {
      id: 'sq_pass',
      title: 'Wolves in the Pass',
      giver: 'hrothgard_steward',
      side: true,
      summary: 'Raiders have closed the pass on the Hrothgard–Greywall road, and the clans want it open before the snows.',
      stages: [
        {
          id: 'sq_pass_fight',
          journal: 'Break the raiders holding the pass, on the road south of Hrothgard where it climbs through the mountains.',
          band: { template: 'highland_raiders', tag: 'sq_pass_raiders', name: 'Pass Raiders', between: ['hrothgard', 'greywall_fort'], along: 0.35, troops: { reaver: 4, looter: 3 }, camp: true, text: 'The raiders have built a wall of stones across the road where it squeezes between the peaks. Behind it, axes and a fire.' },
          on: [{ event: 'battle', match: { win: true, tag: 'sq_pass_raiders' }, do: [{ stage: 'sq_pass_report' }, { note: 'The pass is open. The raiders’ wall is already being pulled down.' }] }]
        },
        { id: 'sq_pass_report', journal: 'Tell Steward Ingrid in Hrothgard the pass is open.' }
      ],
      rewards: { gold: 80, renown: 8, xp: 40, rep: { hrothmark: 10 } }
    },
    // The Vessaro League: merchants first. Timber from the northern forests for the southern yards.
    sq_timber: {
      id: 'sq_timber',
      title: 'Timber for the Shipwrights',
      giver: 'vessara_factor',
      side: true,
      summary: 'The League’s shipyards are short of timber. The northern forests have plenty, and the League pays well for what it lacks.',
      stages: [
        {
          id: 'sq_timber_buy',
          journal: 'Buy timber where it is cheap: the northern highlands (Hrothgard and its villages).',
          on: [{ event: 'trade', match: { good: 'timber', side: 'buy' }, do: [{ stage: 'sq_timber_sell' }, { note: 'Timber is loaded. Heavy, but the League pays by the beam.' }] }]
        },
        {
          id: 'sq_timber_sell',
          journal: 'Sell the timber at the market in Vessara, on the southern coast.',
          on: [{ event: 'trade', match: { good: 'timber', side: 'sell', settlement: 'vessara' }, do: [{ stage: 'sq_timber_report' }, { note: 'The shipwrights took every beam.' }] }]
        },
        { id: 'sq_timber_report', journal: 'Tell Factor Salviati in Vessara the timber is delivered.' }
      ],
      rewards: { gold: 60, renown: 5, xp: 40, rep: { vessaro: 10 } }
    },
    // The Free City of Merrow: anything can be bought there, swords included.
    sq_lights: {
      id: 'sq_lights',
      title: 'False Lights',
      giver: 'merrow_clerk',
      side: true,
      summary: 'Wreckers are luring ships onto the rocks west of Merrow. The Council will pay, and will rent you the swords to do it.',
      stages: [
        {
          id: 'sq_lights_hire',
          journal: 'Hire sell-swords in Merrow (Recruit): the Council wants its own steel along.',
          on: [{ event: 'recruit', match: { troop: 'mercenary', settlement: 'merrow' }, do: [{ stage: 'sq_lights_fight' }] }]
        },
        {
          id: 'sq_lights_fight',
          journal: 'Break the wreckers at Wreckers’ Cove, on the coast far to the west.',
          band: { template: 'southern_wreckers', tag: 'sq_lights_wreckers', name: 'Wreckers', near: 'wreckers_cove', troops: { reaver: 3, looter: 4 }, camp: true, text: 'Lanterns on poles along the rocks, and a beach strewn with broken casks. The wreckers turn from their plunder.' },
          on: [{ event: 'battle', match: { win: true, tag: 'sq_lights_wreckers' }, do: [{ stage: 'sq_lights_report' }, { note: 'The false lights are out.' }] }]
        },
        { id: 'sq_lights_report', journal: 'Report to the Clerk of the Council in Merrow.' }
      ],
      rewards: { gold: 90, renown: 10, xp: 50, rep: { merrow: 10 } }
    },

    // ---- P7-06: companions of the wider world. Each joins after a small errand of their own, which
    // shows what they care about (data/companions.js `motive`). Their trees are in data/dialogue.js.
    sq_sigrun: {
      id: 'sq_sigrun',
      title: 'Sigrun’s Feud',
      giver: 'sigrun',
      side: true,
      summary: 'Sigrun of Hrothgard wants the raiders of the Steading broken before she will ride with anyone.',
      stages: [
        {
          id: 'sq_sigrun_fight',
          journal: 'Break the raiders at the Raider Steading, in the hills of the north.',
          band: { template: 'highland_raiders', tag: 'sq_sigrun_raiders', name: 'Steading Raiders', near: 'raider_steading', troops: { reaver: 3, looter: 3 }, camp: true, text: 'Smoke over the Steading, and the raiders who burned Sigrun’s hall drinking in front of it.' },
          on: [{ event: 'battle', match: { win: true, tag: 'sq_sigrun_raiders' }, do: [{ stage: 'sq_sigrun_report' }, { note: 'The Steading raiders are broken.' }] }]
        },
        { id: 'sq_sigrun_report', journal: 'Tell Sigrun in Hrothgard the raiders are broken.' }
      ],
      rewards: { renown: 5, xp: 30 }
    },
    sq_iacopo: {
      id: 'sq_iacopo',
      title: 'Iacopo’s Debt',
      giver: 'iacopo',
      side: true,
      summary: 'Iacopo, a League crossbow captain fallen on hard times, owes 120 crowns. Settle it and he is yours.',
      stages: [{ id: 'sq_iacopo_pay', journal: 'Bring 120 crowns to Iacopo in Vessara to settle his debt.' }],
      rewards: { xp: 20 }
    },
    sq_livia: {
      id: 'sq_livia',
      title: 'Livia’s Deserters',
      giver: 'livia',
      side: true,
      summary: 'Livia, once a medic of the Aurelian legion, wants the deserters who robbed her village dealt with.',
      stages: [
        {
          id: 'sq_livia_fight',
          journal: 'Break the deserters at the Deserter Camp, in the east.',
          band: { template: 'eastern_deserters', tag: 'sq_livia_deserters', name: 'Deserters', near: 'deserter_camp', troops: { mercenary: 2, looter: 3 }, camp: true, text: 'Stolen grain sacks piled by the fire, and men in torn Aurelian colours who reach for their swords.' },
          on: [{ event: 'battle', match: { win: true, tag: 'sq_livia_deserters' }, do: [{ stage: 'sq_livia_report' }, { note: 'The deserters are broken.' }] }]
        },
        { id: 'sq_livia_report', journal: 'Tell Livia in Tessaro the deserters are broken.' }
      ],
      rewards: { renown: 5, xp: 30 }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
