/* Crownless content: dialogue. Plain classic script; no modules, no fetch.
 * Dialogue trees, read by the story interpreter (js/story.js, which documents the condition and
 * effect vocabulary). GDD §4: "use conditional lines, shared scenes and 3–5 quest flags".
 *   speaker  display name
 *   start    a node id, or a list of { if, node } tried in order (a bare id is the fallback)
 *   place    optional settlement id: offered as "Talk to …" on that settlement's menu
 *   visible  optional condition for appearing there
 *   nodes    id → { text, cycle?, services?, options: [{ text, if?, do?, next?, quest? }] }
 *            text: a string, or a list of strings / { if, text }; all matching entries are joined
 *            (with cycle: one per visit, rotating). An option without `next` ends the talk.
 *            services: false hides the speaker's shop/recruit/tavern menu on that node. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.dialogue = {
    stonebridge_elder: {
      id: 'stonebridge_elder',
      speaker: 'Elder Maren',
      start: [{ if: { quest: 'q1', stage: 'q1_report' }, node: 'q1_report' }, { if: { not: { flag: 'met_elder' } }, node: 'first' }, 'again'],
      nodes: {
        first: {
          text: [
            'Welcome to Stonebridge, {name}. Strangers are rarer than reavers these days.',
            { if: { background: 'farmhand' }, text: 'You have a farmer’s hands. Good — we need people who know what a harvest costs.' },
            { if: { background: 'scout' }, text: 'You walk like someone who reads the ground. The roads could use eyes like yours.' },
            { if: { background: 'peddler' }, text: 'A peddler, by the look of that pack. Trade has been thin since the caravans started vanishing.' }
          ],
          options: [
            { text: 'Is there work for me?', do: [{ set: 'met_elder' }], next: 'q1_work' },
            { text: 'What troubles Stonebridge?', do: [{ set: 'met_elder' }], next: 'troubles' },
            { text: 'Only passing through.', do: [{ set: 'met_elder' }] }
          ]
        },
        again: {
          cycle: true,
          text: [
            'Stonebridge has stood at this ford since before the empire. It will stand after.',
            { if: { renown: 20 }, text: 'People in the square speak of your band, {name}. Kindly, mostly.' },
            { if: { standing: 'valedorn', is: 'hostile' }, text: 'The Crown’s riders were asking after you. I told them nothing — but be careful here.' },
            { if: { standing: 'valedorn', is: 'friendly' }, text: 'The Crown’s captains speak well of you. That opens doors in this town.' }
          ],
          options: [
            { text: 'Is there work for me?', if: { quest: 'q1', is: 'unstarted' }, next: 'q1_work' },
            { text: 'About that work…', if: { quest: 'q1', stage: 'q1_choose_work' }, next: 'q1_work' },
            { text: 'About that work…', if: { any: [{ quest: 'q1', stage: 'q1_wagon_go' }, { quest: 'q1', stage: 'q1_wagon_back' }, { quest: 'q1', stage: 'q1_bandits' }, { quest: 'q1', stage: 'q1_recruits' }, { quest: 'q1', stage: 'q1_drill' }] }, next: 'q1_progress' },
            { text: 'What troubles Stonebridge?', next: 'troubles' },
            { text: 'Who holds Greywall now?', if: { flag: 'asked_troubles' }, next: 'greywall' }
          ]
        },
        q1_work: {
          services: false,
          text: [
            'Three jobs want doing, and I can pay for one. Fifty crowns, and the town’s thanks.',
            'A grain wagon waits at Oakford and needs bringing home. Reavers out of the Looter Camp are raiding the roads and need breaking. And Sergeant Brun at the Muster Hall cannot fill his ranks.',
            { if: { background: 'farmhand' }, text: 'The wagon would suit you — you know what that grain is worth.' },
            { if: { background: 'scout' }, text: 'You could find the Reavers before they find you.' },
            { if: { background: 'peddler' }, text: 'Brun pays a fair word for every recruit; a peddler knows how to strike a bargain.' }
          ],
          options: [
            { text: 'I’ll bring the grain wagon from Oakford.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'wagon' }, { stage: 'q1_wagon_go', quest: 'q1' }], next: 'q1_taken' },
            { text: 'I’ll deal with the Reavers.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'bandits' }, { stage: 'q1_bandits', quest: 'q1' }], next: 'q1_taken' },
            { text: 'I’ll help Sergeant Brun.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'recruits' }, { stage: 'q1_recruits', quest: 'q1' }], next: 'q1_taken' },
            { text: 'Let me think on it.', do: [{ start: 'q1' }] }
          ]
        },
        q1_taken: {
          services: false,
          text: [
            { if: { flag: 'q1_path', is: 'wagon' }, text: 'Good. Oakford lies south-west along the road. Bring the wagon back whole, and yourself with it.' },
            { if: { flag: 'q1_path', is: 'bandits' }, text: 'Good. Break any band of them you find on the roads, or clear their camp north-west of town. Mind your numbers.' },
            { if: { flag: 'q1_path', is: 'recruits' }, text: 'Good. Brun is at the Muster Hall. Hire three soldiers and show him they can fight.' },
            'Your journal will keep the details. Come back when it is done.'
          ],
          options: [{ text: 'I’ll see it done.' }]
        },
        q1_progress: {
          services: false,
          cycle: true,
          text: ['The work is not finished yet, {name}. Check your journal.', 'Stonebridge is counting on you. No hurry — but do not forget us.'],
          options: [{ text: 'On my way.' }]
        },
        q1_report: {
          services: false,
          text: [
            { if: { flag: 'q1_wagon_safe' }, text: 'The grain is in, and the drivers say you broke the ambush yourself.' },
            { if: { flag: 'q1_wagon_slipped' }, text: 'The grain is in, and not a sack lost. The drivers say you slipped past the Reavers like a fox.' },
            { if: { flag: 'q1_path', is: 'bandits' }, text: 'The Reavers will think twice before raiding our road again.' },
            { if: { flag: 'q1_path', is: 'recruits' }, text: 'Brun tells me your recruits held their line. He has not smiled like that in years.' },
            'You have earned your wage. But there is something else — something that came back with you.'
          ],
          options: [{ text: 'What is it?', do: [{ give: 'charter_fragment' }, { set: 'knows_charter' }, { complete: 'q1' }], next: 'q1_charter' }]
        },
        q1_charter: {
          services: false,
          text: [
            'A scrap of parchment with the old imperial seal. Part of a charter — the charter, perhaps, that both crowns say gives them Greywall.',
            'Why would Reavers carry such a thing? Someone is paying them to move it, or to lose it.',
            'Keep it safe, {name}. A caravan master in Eastwatch lost a sealed packet on the road last month. He may know more.'
          ],
          options: [{ text: 'I’ll keep it safe.' }]
        },
        troubles: {
          services: false,
          text: [
            'Reavers on the roads, and nobody agrees whose job it is to stop them.',
            'The Crown says Greywall Fort is theirs by right; the Aurelians say an imperial charter gives it to them.',
            'While the lords argue, the wagons burn.'
          ],
          options: [
            { text: 'Tell me about Greywall.', do: [{ set: 'asked_troubles' }], next: 'greywall' },
            { text: 'I will keep my eyes open.', do: [{ set: 'asked_troubles' }] }
          ]
        },
        greywall: {
          services: false,
          text: [
            { if: { owner: 'greywall_fort', is: 'valedorn' }, text: 'Greywall flies the Crown’s blue, as it has for thirty years.' },
            { if: { owner: 'greywall_fort', is: 'aurelian' }, text: 'Greywall flies the Aurelian red now. I never thought I would see it.' },
            'They say an old imperial charter would settle who should hold it — if anyone could find the thing.',
            { if: { flag: 'heard_charter' }, text: 'You have asked me that before. My answer has not changed.' }
          ],
          options: [{ text: 'Thank you, Elder.', do: [{ set: 'heard_charter' }] }]
        }
      }
    },
    sergeant_brun: {
      id: 'sergeant_brun',
      speaker: 'Sergeant Brun',
      start: [{ if: [{ quest: 'q1', stage: 'q1_recruits' }, { not: { flag: 'q1_brun_advance' } }], node: 'q1' }, 'talk'],
      nodes: {
        q1: {
          services: false,
          text: [
            'So Maren sent you. Good. I need three strong backs before the Reavers grow bolder.',
            'Hire them here. I’ll put fifteen crowns toward the first, and you can drill them on the road.'
          ],
          options: [{ text: 'Thank you, Sergeant.', do: [{ gold: 15 }, { set: 'q1_brun_advance' }], next: 'talk' }]
        },
        talk: {
          cycle: true,
          text: [
            'Strong backs and steady hands wanted. Coin up front.',
            'A levy with a full belly fights twice as hard.',
            { if: { quest: 'q1', stage: 'q1_recruits' }, text: 'Three, Maren said. You have hired {flag:q1_hired} so far.' },
            { if: { quest: 'q1', stage: 'q1_drill' }, text: 'Now take them out and win a fight. Nothing teaches like the first one.' }
          ]
        }
      }
    },
    caravan_master: {
      id: 'caravan_master',
      speaker: 'Caravan Master Oswin',
      place: 'eastwatch',
      start: [
        { if: { quest: 'q2', stage: 'q2_choose' }, node: 'q2_read' },
        { if: { quest: 'q2', stage: 'q2_recover' }, node: 'q2_waiting' },
        { if: { quest: 'q2', is: 'done' }, node: 'after' },
        'intro'
      ],
      nodes: {
        intro: {
          text: [
            'Oswin, master of the Eastwatch caravans — what is left of them. Reavers hit my wagons on the river road and took a courier’s packet sealed with the old imperial eagle.',
            { if: { has: 'charter_fragment' }, text: 'Wait — that scrap you carry. The same eagle, the same wax. Where did you find that?' },
            { if: { not: { has: 'charter_fragment' } }, text: 'Whoever sealed it wanted it to reach Greywall. Whoever took it wanted it not to.' },
            'Bring it back and I will pay eighty crowns, no questions.'
          ],
          options: [
            { text: 'I’ll find your packet.', do: [{ start: 'q2' }], next: 'q2_go' },
            { text: 'Not my business.' }
          ]
        },
        q2_go: {
          text: [
            'They are camped on the river road between here and Highmere, bold as you like.',
            'Fight them if you have the swords. A big enough company might scare them off without a fight. Or there is a fence in Highmere who hears everything — for a price.'
          ],
          options: [{ text: 'I’ll be back with it.' }]
        },
        q2_waiting: {
          cycle: true,
          text: ['The river road, between here and Highmere. Fight them, cow them, or buy their secret from the fence in Highmere.', 'Every day that packet is out there, someone is reading it who should not.'],
          options: [{ text: 'On my way.' }]
        },
        q2_read: {
          services: false,
          text: [
            'You found it! Let me see — two charters? Both sealed with the eagle, both naming a different heir to Greywall. One for the Crown, one for the Aurelian line.',
            'Someone forged one of these. Or both. Whoever holds this packet holds the argument.',
            'Captain Aldric of the Crown is in Stonebridge. Magistrate Vell sits here in Eastwatch. Or keep it, and let neither of them have it.'
          ],
          options: [
            { text: 'I’ll keep it. Nobody gets to use this yet.', if: { has: 'courier_packet' }, do: [{ set: 'q2_choice', to: 'kept' }, { set: 'has_evidence' }, { complete: 'q2' }], next: 'kept' },
            { text: 'I need to think about who should see it.' }
          ]
        },
        kept: {
          services: false,
          text: ['A dangerous thing to carry. But maybe the right one. Here is your eighty — and keep your head down on the roads.'],
          options: [{ text: 'I will.' }]
        },
        after: {
          cycle: true,
          text: [
            'The caravans run a little easier these days. Thank you for that.',
            { if: { flag: 'q2_choice', is: 'kept' }, text: 'Still carrying that packet? Good. Neither crown has stopped asking about it.' },
            { if: { flag: 'q2_choice', is: 'valedorn' }, text: 'The Crown’s men walk taller since you gave them that packet. The magistrate does not smile at me any more.' },
            { if: { flag: 'q2_choice', is: 'aurelian' }, text: 'The magistrate says the packet proves the Aurelian claim. Half of Eastwatch believes her.' }
          ]
        }
      }
    },
    valedorn_agent: {
      id: 'valedorn_agent',
      speaker: 'Captain Aldric',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, 'talk'],
      nodes: {
        q2: {
          services: false,
          text: ['They say you have Oswin’s packet. The Crown would be grateful to see it, {name} — and the Crown remembers its friends.'],
          options: [{ text: 'Show the packet to the Crown.', if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], do: [{ take: 'courier_packet' }, { set: 'q2_choice', to: 'valedorn' }, { rep: 'valedorn', by: 25 }, { rep: 'aurelian', by: -10 }, { complete: 'q2' }], next: 'q2_thanks' }, { text: 'Not yet.' }]
        },

        q3_offer: {
          services: false,
          text: [
            'An Aurelian supply column is camped on the Ashgate road, feeding their garrison. Break it, and Greywall stays blue. A hundred and twenty crowns, and the Crown’s gratitude.',
            { if: { flag: 'q3_heard_aurelian' }, text: 'I hear the magistrate has made you an offer too. Choose wisely — or profitably.' }
          ],
          options: [
            { text: 'I’ll ride for the Crown.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'valedorn' }, { stage: 'q3_strike_aurelian', quest: 'q3' }], next: 'q3_go' },
            { text: 'Sell the magistrate’s plans to the Crown (100 crowns).', if: { flag: 'q3_heard_aurelian' }, do: [{ start: 'q3' }, { set: 'q3_side', to: 'sold_to_valedorn' }, { gold: 100 }, { rep: 'valedorn', by: 10 }, { rep: 'aurelian', by: -25 }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_sold' },
            { text: 'I’ll fight for neither banner. I’ll guard the road.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'road' }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_refused' },
            { text: 'Let me think about it.', do: [{ start: 'q3' }, { set: 'q3_heard_valedorn' }] }
          ]
        },
        q3_go: {
          services: false,
          text: ['Good. Your journal has the road. Be quick — columns do not wait.'],
          options: [{ text: 'On my way.' }]
        },
        q3_sold: {
          services: false,
          text: ['A hundred crowns for knowing where they mean to strike. A fair trade — and the magistrate will never know who told us. While both banners chase shadows, the road is anyone’s. Watch yourself out there.'],
          options: [{ text: 'Pleasure doing business.' }]
        },
        q3_refused: {
          services: false,
          text: ['Neither banner? Then may the road thank you, because I will not.'],
          options: [{ text: 'Someone has to.' }]
        },
        q2_thanks: {
          services: false,
          text: ['Two charters… and only one of them true. The King’s lawyers will know which. You have done Valedorn a service it will not forget.'],
          options: [{ text: 'See that it doesn’t.' }]
        },
        talk: {
          cycle: true,
          text: [
            'Greywall has been the Crown’s for thirty years. Paper will not change that.',
            'Keep the roads clear and the Crown keeps your purse full. Simple.',
            { if: { flag: 'q2_choice', is: 'valedorn' }, text: 'The packet you brought us has the Aurelians scrambling. Well done.' },
            { if: { flag: 'q2_choice', is: 'aurelian' }, text: 'You gave that packet to the magistrate. I hope her gold was worth it.' },
            { if: { flag: 'q2_choice', is: 'kept' }, text: 'You still have that packet, I hear. The Crown would pay well for it — if you ever tire of carrying it.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'valedorn' }], text: 'The Aurelian column will not trouble Greywall again. Good work.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'aurelian' }], text: 'You broke a Crown column. I will not forget whose side you chose.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'road' }], text: 'Neither banner, eh? The carters sing your name. The King does not.' }
          ]
        }
      }
    },
    aurelian_agent: {
      id: 'aurelian_agent',
      speaker: 'Magistrate Vell',
      place: 'eastwatch',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, 'talk'],
      nodes: {
        q2: {
          services: false,
          text: ['Oswin tells me you recovered his packet. Imperial law belongs to those who keep it, {name}. Let me see it.'],
          options: [{ text: 'Show the packet to the magistrate.', if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], do: [{ take: 'courier_packet' }, { set: 'q2_choice', to: 'aurelian' }, { rep: 'aurelian', by: 25 }, { rep: 'valedorn', by: -10 }, { complete: 'q2' }], next: 'q2_thanks' }, { text: 'Not yet.' }]
        },

        q3_offer: {
          services: false,
          text: [
            'A Valedorn column holds the Greywall road, choking our couriers. Break it, and the law will have room to breathe. A hundred and twenty crowns, and the Remnant’s thanks.',
            { if: { flag: 'q3_heard_valedorn' }, text: 'I hear Captain Aldric has made you an offer too. Choose wisely — or profitably.' }
          ],
          options: [
            { text: 'I’ll ride for the Remnant.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'aurelian' }, { stage: 'q3_strike_valedorn', quest: 'q3' }], next: 'q3_go' },
            { text: 'Sell the Crown’s plans to the magistrate (100 crowns).', if: { flag: 'q3_heard_valedorn' }, do: [{ start: 'q3' }, { set: 'q3_side', to: 'sold_to_aurelian' }, { gold: 100 }, { rep: 'aurelian', by: 10 }, { rep: 'valedorn', by: -25 }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_sold' },
            { text: 'I’ll fight for neither banner. I’ll guard the road.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'road' }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_refused' },
            { text: 'Let me think about it.', do: [{ start: 'q3' }, { set: 'q3_heard_aurelian' }] }
          ]
        },
        q3_go: {
          services: false,
          text: ['Good. Your journal has the road. Be quick — columns do not wait.'],
          options: [{ text: 'On my way.' }]
        },
        q3_sold: {
          services: false,
          text: ['A hundred crowns for knowing where they mean to strike. A fair trade — and Captain Aldric will never know who told us. While both banners chase shadows, the road is anyone’s. Watch yourself out there.'],
          options: [{ text: 'Pleasure doing business.' }]
        },
        q3_refused: {
          services: false,
          text: ['Neither banner? Then may the road thank you, because I will not.'],
          options: [{ text: 'Someone has to.' }]
        },
        q2_thanks: {
          services: false,
          text: ['Two charters, and one of them a forgery that favours Valedorn — I would stake my seat on it. The Remnant owes you, {name}.'],
          options: [{ text: 'I’ll remember that.' }]
        },
        talk: {
          cycle: true,
          text: [
            'Greywall was granted by charter, not won by the sword. The law is on our side.',
            'Eastwatch remembers the empire’s order. The roads were safe then.',
            { if: { flag: 'q2_choice', is: 'aurelian' }, text: 'The packet you brought me is in the court archive. Valedorn’s claim is crumbling.' },
            { if: { flag: 'q2_choice', is: 'valedorn' }, text: 'You handed that packet to the Crown. I hope you know what you have done.' },
            { if: { flag: 'q2_choice', is: 'kept' }, text: 'You still keep that packet. The court would welcome it — whenever you choose.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'aurelian' }], text: 'The Greywall road is open to our couriers again. The court is grateful.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'valedorn' }], text: 'You cut down our column for the Crown. The law has a long memory.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'road' }], text: 'You guarded the road for everyone. Perhaps there is a third way after all.' }
          ]
        }
      }
    },
    // GDD §10: Mara joins after Q2 "for a modest cost or through a short trust dialogue". She already
    // knows where Oswin's packet went; an honest answer earns her trust, a lie costs it.
    mara: {
      id: 'mara',
      speaker: 'Mara',
      start: [
        { if: { companion: 'mara' }, node: 'with_us' },
        { if: { flag: 'mara_met' }, node: 'verdict' },
        'meet'
      ],
      nodes: {
        meet: {
          services: false,
          text: [
            'You are the one who found Oswin’s packet. I am Mara. I scouted these roads for the empire, back when there was an empire.',
            'I have been looking for someone worth riding with. I do not ride with fools, and I do not ride with liars.',
            { if: { flag: 'mara_saved' }, text: 'And you rode into that clash for me before you even knew my name. I owe you.' }
          ],
          options: [
            { text: 'Then ask me what you want to know.', do: [{ set: 'mara_met' }], next: 'packet' },
            { text: 'I’m not looking for company.' }
          ]
        },
        packet: {
          services: false,
          text: ['So. Where did the packet go?'],
          options: [
            { text: 'To Captain Aldric and the Crown.', if: { flag: 'q2_choice', is: 'valedorn' }, do: [{ add: 'mara_trust' }], next: 'why' },
            { text: 'To Captain Aldric and the Crown.', if: { not: { flag: 'q2_choice', is: 'valedorn' } }, do: [{ set: 'mara_lied' }], next: 'why' },
            { text: 'To Magistrate Vell.', if: { flag: 'q2_choice', is: 'aurelian' }, do: [{ add: 'mara_trust' }], next: 'why' },
            { text: 'To Magistrate Vell.', if: { not: { flag: 'q2_choice', is: 'aurelian' } }, do: [{ set: 'mara_lied' }], next: 'why' },
            { text: 'I kept it.', if: { flag: 'q2_choice', is: 'kept' }, do: [{ add: 'mara_trust' }], next: 'why' },
            { text: 'I kept it.', if: { not: { flag: 'q2_choice', is: 'kept' } }, do: [{ set: 'mara_lied' }], next: 'why' },
            { text: 'That’s my business.', next: 'why' }
          ]
        },
        why: {
          services: false,
          text: [
            { if: { flag: 'mara_lied' }, text: 'Hm. Wenna sells stories as well as secrets, and that is not the one I bought.' },
            { if: { flag: 'mara_trust' }, text: 'That matches what I heard. Good.' },
            'One more. Why do you fight, {name}?'
          ],
          options: [
            { text: 'For coin. Someone has to pay for the bread.', do: [{ set: 'mara_why', to: 'coin' }], next: 'verdict' },
            { text: 'For the people on these roads.', do: [{ set: 'mara_why', to: 'people' }], next: 'verdict' },
            { text: 'For a name people will remember.', do: [{ set: 'mara_why', to: 'name' }], next: 'verdict' }
          ]
        },
        verdict: {
          services: false,
          text: [
            { if: [{ flag: 'mara_trust', gte: 1 }, { not: { flag: 'mara_lied' } }], text: 'You told me the truth when it would have been easy not to. That is enough. I will ride with you — no coin.' },
            { if: [{ flag: 'mara_saved' }, { not: [{ flag: 'mara_trust', gte: 1 }, { not: { flag: 'mara_lied' } }] }], text: 'You came for me on the road. That buys more trust than any answer. I will ride with you — no coin.' },
            { if: { not: { any: [{ flag: 'mara_saved' }, [{ flag: 'mara_trust', gte: 1 }, { not: { flag: 'mara_lied' } }]] } }, text: 'I do not know you well enough to work for nothing. A hundred crowns, and I will ride with you and earn every one.' }
          ],
          options: [
            { text: 'Welcome to the company, Mara.', if: [{ any: [{ flag: 'mara_saved' }, [{ flag: 'mara_trust', gte: 1 }, { not: { flag: 'mara_lied' } }]] }, { room: 1 }], do: [{ companion: 'mara' }], next: 'joined' },
            { text: 'Pay 100 crowns.', if: [{ not: { any: [{ flag: 'mara_saved' }, [{ flag: 'mara_trust', gte: 1 }, { not: { flag: 'mara_lied' } }]] } }, { gold: 100 }, { room: 1 }], do: [{ gold: -100 }, { companion: 'mara' }], next: 'joined' },
            { text: 'My company is full. Later.', if: { not: { room: 1 } } },
            { text: 'Not now.' }
          ]
        },
        joined: {
          services: false,
          text: ['Then let us go. I know a few roads the Reavers do not — you will travel faster with me.'],
          options: [{ text: 'Lead on.' }]
        },
        with_us: {
          cycle: true,
          text: [
            'The river road floods in spring. Keep to the high track past Highmere.',
            'Both crowns want Greywall. Neither asked the people who live under it.',
            { if: { flag: 'mara_saved' }, text: 'I have not forgotten that you came for me on the road. I never will.' },
            { if: { companion: 'mara', is: 'fit' }, text: 'I am ready when you are.' },
            { if: { not: { companion: 'mara', is: 'fit' } }, text: 'Give me a day or two. That last fight took more out of me than I let on.' }
          ]
        }
      }
    },
    bandit_informant: {
      id: 'bandit_informant',
      speaker: 'Wenna the Fence',
      place: 'highmere',
      visible: { quest: 'q2', stage: 'q2_recover' },
      start: 'offer',
      nodes: {
        offer: {
          text: [
            'Word travels fast among those who live off the road. You want Oswin’s packet.',
            'The lads by the river cannot read, so they hid it in a hollow oak and kept the satchel for show. Sixty crowns, and I will tell you which oak.'
          ],
          options: [
            { text: 'Pay 60 crowns.', if: { gold: 60 }, do: [{ gold: -60 }, { give: 'courier_packet' }, { set: 'q2_how', to: 'paid' }, { stage: 'q2_choose', quest: 'q2' }, { note: 'Wenna the Fence sold you the hiding place. The packet was in a hollow oak.', quest: 'q2' }], next: 'paid' },
            { text: 'Too rich for me.' }
          ]
        },
        paid: {
          text: ['Third oak past the ford, a hand’s depth down. Pleasure doing business. You never saw me.'],
          options: [{ text: 'Saw who?' }]
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
