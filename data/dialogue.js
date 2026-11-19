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
      start: [{ if: { quest: 'q1', stage: 'q1_report' }, node: 'q1_report' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_road' }, { if: { not: { flag: 'met_elder' } }, node: 'first' }, 'again'],
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
            { if: { standing: 'valedorn', is: 'friendly' }, text: 'The Crown’s captains speak well of you. That opens doors in this town.' },
            { if: { flag: 'ending', is: 'compromise' }, text: 'The Warden of the Road! Sit, sit — the children want to hear about the parley again.' },
            { if: { flag: 'ending', is: 'valedorn' }, text: 'Greywall stays blue, and Stonebridge breathes easier. You did that.' },
            { if: { flag: 'ending', is: 'aurelian' }, text: 'Red over Greywall. Strange days. But the war is over, and that is something.' }
          ],
          options: [
            { text: 'Is there work for me?', if: { quest: 'q1', is: 'unstarted' }, next: 'q1_work' },
            { text: 'About that work…', if: { quest: 'q1', stage: 'q1_choose_work' }, next: 'q1_work' },
            { text: 'About that work…', if: { any: [{ quest: 'q1', stage: 'q1_wagon_go' }, { quest: 'q1', stage: 'q1_wagon_back' }, { quest: 'q1', stage: 'q1_bandits' }, { quest: 'q1', stage: 'q1_recruits' }, { quest: 'q1', stage: 'q1_drill' }] }, next: 'q1_progress' },
            { text: 'What troubles Stonebridge?', next: 'troubles' },
            { text: 'Who holds Greywall now?', if: { flag: 'asked_troubles' }, next: 'greywall' },
            { text: 'One of my soldiers was born here: {veteran}.', if: [{ veteran: 3 }, { quest: 'sq_homecoming', is: 'unstarted' }], next: 'sq_home_offer' },
            { text: 'The grain for the feast is bought.', if: { quest: 'sq_homecoming', stage: 'sq_home_report' }, next: 'sq_home_feast' }
          ]
        },
        sq_home_offer: {
          services: false,
          text: ['{veteran}! I knew the family. Off to the wars with nothing but a borrowed spear, and back with a name. Stonebridge will feast them properly — if you can find the grain. The granary is bare this season.'],
          options: [
            { text: 'I’ll buy the grain.', do: [{ start: 'sq_homecoming' }], quest: 'sq_homecoming' },
            { text: 'Another time.' }
          ]
        },
        sq_home_feast: {
          services: false,
          text: ['The whole town turns out. {veteran} is seated at the head of the table, red to the ears, while the children ask for the story of every scar. You will hear about this feast in every tavern on the march.'],
          options: [{ text: 'To {veteran}!', do: [{ honourVeteran: 30 }, { complete: 'sq_homecoming' }] }]
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
        q4_road: {
          services: false,
          text: [
            'Both armies are marching on Greywall, {name}, and Stonebridge sits between them. Whoever wins, we bury our sons.',
            'There are hard men on both sides who want this war, and they have hired blades to start it. Break those blades, and the envoys will have to talk instead.',
            { if: [{ has: 'courier_packet' }, { flag: 'has_evidence' }], text: 'And you still carry Oswin’s packet. Two charters, both sealed — lay that on the parley table and neither crown can claim the law is theirs alone.' },
            { if: { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }, text: 'Without proof that neither claim is clean, though, they may only listen to the winner of the field.' }
          ],
          options: [
            { text: 'I’ll stand for the road — for neither crown.', do: [{ set: 'q4_side', to: 'road' }, { stage: 'q4_field_road', quest: 'q4' }], next: 'q4_road_sworn' },
            { text: 'I have not decided yet.' }
          ]
        },
        q4_road_sworn: {
          services: false,
          text: ['Then the road thanks you. Ride for Greywall — and come home.'],
          options: [{ text: 'I will.' }]
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
          ],
          options: [
            { text: 'Any advice for a growing company?', if: [{ soldiers: 3 }, { quest: 'sq_larders', is: 'unstarted' }], next: 'sq_larders_offer' },
            { text: 'My quartermaster has laid in stores.', if: { quest: 'sq_larders', stage: 'sq_larders_report' }, next: 'sq_larders_done' },
            { text: 'Teach me to fight to a plan.', if: [{ soldiers: 5 }, { quest: 'sq_planned', is: 'unstarted' }], next: 'sq_planned_offer' }
          ]
        },
        sq_larders_offer: {
          services: false,
          text: ['A company marches on its stomach and fights for its pay. Get yourself a quartermaster: they keep the next wages aside and the larder full, and they write down every crown. Then come and tell me you never once ran out of bread.'],
          options: [
            { text: 'I’ll find one.', do: [{ start: 'sq_larders' }, { stage: 'sq_larders_stock', quest: 'sq_larders', if: { follower: 'quartermaster' } }] },
            { text: 'I can count my own bread.' }
          ]
        },
        sq_larders_done: {
          services: false,
          text: ['Full larders and the wages in the chest. Now that is a company. Here — for your trouble.'],
          options: [{ text: 'Thank you, Sergeant.', do: [{ complete: 'sq_larders' }] }]
        },
        sq_planned_offer: {
          services: false,
          text: ['A band of Reavers has dug in near Oakford: shields locked, sell-swords in the middle. Charge them and you lose good soldiers. Fight them yourself, and before you do, pick a setup on the Prepare screen. Defensive lets them come to your line.'],
          options: [
            { text: 'I’ll take them on to a plan.', do: [{ start: 'sq_planned' }] },
            { text: 'Not now.' }
          ]
        }
      }
    },
    // GDD §4 Q4: "a short negotiation scene" at Greywall after the deciding battle.
    greywall_parley: {
      id: 'greywall_parley',
      speaker: 'The Parley at Greywall',
      place: 'greywall_fort',
      visible: { quest: 'q4', stage: 'q4_terms' },
      start: 'terms',
      nodes: {
        terms: {
          services: false,
          text: [
            'In a tent below Greywall’s walls, Captain Aldric and Magistrate Vell sit across a trestle table. Both look at you.',
            { if: { flag: 'q4_side', is: 'valedorn' }, text: 'Aldric smiles; Vell does not. The field was the Crown’s, and everyone in the tent knows who won it.' },
            { if: { flag: 'q4_side', is: 'aurelian' }, text: 'Vell inclines her head; Aldric stares at the table. The field was the Remnant’s, and everyone in the tent knows who won it.' },
            { if: { flag: 'q4_side', is: 'road' }, text: 'Neither army fired a shot. They are here because you made them talk — and they are waiting to see what you will say.' },
            { if: [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }], text: 'Without proof, neither will yield the law to the other. One of them must have the fort.' }
          ],
          options: [
            { text: 'Greywall stays with the Crown.', if: { any: [{ flag: 'q4_side', is: 'valedorn' }, [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }]] }, do: [{ owner: 'greywall_fort', to: 'valedorn' }, { rep: 'valedorn', by: 25 }, { rep: 'aurelian', by: -25, if: { flag: 'q4_side', is: 'valedorn' } }, { complete: 'q4' }, { ending: 'valedorn', quest: 'q4' }] },
            { text: 'Greywall passes to the Remnant.', if: { any: [{ flag: 'q4_side', is: 'aurelian' }, [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }]] }, do: [{ owner: 'greywall_fort', to: 'aurelian' }, { rep: 'aurelian', by: 25 }, { rep: 'valedorn', by: -25, if: { flag: 'q4_side', is: 'aurelian' } }, { complete: 'q4' }, { ending: 'aurelian', quest: 'q4' }] },
            { text: 'Lay both charters on the table: neither claim is clean.', if: [{ flag: 'q4_side', is: 'road' }, { has: 'courier_packet' }, { flag: 'has_evidence' }], do: [{ take: 'courier_packet' }, { rep: 'valedorn', by: 25 }, { rep: 'aurelian', by: 25 }, { complete: 'q4' }, { ending: 'compromise', quest: 'q4' }] },
            { text: 'Not yet. I need a moment.' }
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
            { text: 'Not my business.' },
            { text: 'Could a company earn from its wagons?', if: { quest: 'sq_venture', is: 'unstarted' }, next: 'sq_venture_offer' },
            { text: 'My merchant has turned a profit.', if: { quest: 'sq_venture', stage: 'sq_venture_report' }, next: 'sq_venture_done' }
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
          options: [
            { text: 'On my way.' },
            { text: 'Could a company earn from its wagons?', if: { quest: 'sq_venture', is: 'unstarted' }, next: 'sq_venture_offer' },
            { text: 'My merchant has turned a profit.', if: { quest: 'sq_venture', stage: 'sq_venture_report' }, next: 'sq_venture_done' }
          ]
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
          ],
          options: [
            { text: 'Could a company earn from its wagons?', if: { quest: 'sq_venture', is: 'unstarted' }, next: 'sq_venture_offer' },
            { text: 'My merchant has turned a profit.', if: { quest: 'sq_venture', stage: 'sq_venture_report' }, next: 'sq_venture_done' }
          ]
        },
        sq_venture_offer: {
          services: false,
          text: ['Could it! Hire a merchant, give them a purse, and let them trade as you ride. A good one buys only where they know the price elsewhere is better, and tells you every coin. Bring them to a few markets first: nobody knows a price they have not seen.'],
          options: [
            { text: 'I’ll try it.', do: [{ start: 'sq_venture' }, { stage: 'sq_venture_trade', quest: 'sq_venture', if: { follower: 'merchant' } }] },
            { text: 'I’ll stick to the sword.' }
          ]
        },
        sq_venture_done: {
          services: false,
          text: ['Profit on the first venture! Most lose their shirts. Here is a little something from the guild, and keep that merchant fed.'],
          options: [{ text: 'They will be.', do: [{ complete: 'sq_venture' }] }]
        }
      }
    },
    valedorn_agent: {
      id: 'valedorn_agent',
      speaker: 'Captain Aldric',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_declare' }, 'talk'],
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

        q4_declare: {
          services: false,
          text: ['The Remnant has marched on Greywall. One battle will settle it. Stand with the Crown, {name}, and the Crown will stand with you.'],
          options: [
            { text: 'I stand with the Crown at Greywall.', do: [{ set: 'q4_side', to: 'valedorn' }, { stage: 'q4_field_valedorn', quest: 'q4' }], next: 'q4_sworn' },
            { text: 'Not yet.' }
          ]
        },
        q4_sworn: {
          services: false,
          text: ['Then ride for Greywall. Win the field, and the parley will listen to you.'],
          options: [{ text: 'To Greywall.' }]
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
          ],
          options: [{ text: 'Any work on the frontier?', if: [{ quest: 'sq_border', is: 'unstarted' }, { not: { standing: 'valedorn', is: 'hostile' } }], next: 'sq_border_offer' }]
        },
        sq_border_offer: {
          services: false,
          text: ['Raiders are burning farms between Brackenfield and Greywall. I have a watch posted near Brackenfield; they are too few to attack, but if they hear a fight they will ride to it. Seventy crowns if you break the raiders.'],
          options: [
            { text: 'I’ll break them.', do: [{ start: 'sq_border' }] },
            { text: 'Not now.' }
          ]
        }
      }
    },
    aurelian_agent: {
      id: 'aurelian_agent',
      speaker: 'Magistrate Vell',
      place: 'eastwatch',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_declare' }, 'talk'],
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

        q4_declare: {
          services: false,
          text: ['The Crown has drawn up its host before Greywall. One battle will decide whether the law comes home. Stand with us, {name}.'],
          options: [
            { text: 'I stand with the Remnant at Greywall.', do: [{ set: 'q4_side', to: 'aurelian' }, { stage: 'q4_field_aurelian', quest: 'q4' }], next: 'q4_sworn' },
            { text: 'Not yet.' }
          ]
        },
        q4_sworn: {
          services: false,
          text: ['Then ride for Greywall. Win the field, and the parley will listen to you.'],
          options: [{ text: 'To Greywall.' }]
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
    },

    // ---- W-05c: people of the lands beyond the March, each with an errand that shows their land.
    hrothgard_steward: {
      id: 'hrothgard_steward',
      speaker: 'Steward Ingrid',
      place: 'hrothgard',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'You come up from the March? Then you have seen what two crowns do to a country. Here the clans keep the hills, and the hills keep the clans.',
            'Our axes are heavy and our feet are slow, southerner. We do not need to be quick. We need to be standing when the others are not.',
            'Timber and iron go down to the coast; wine comes back up. The road through the pass is the only road that matters.',
            { if: { quest: 'sq_pass', is: 'done' }, text: 'The pass is open and the carts are moving. The clans have long memories, for friends as well.' }
          ],
          options: [
            { text: 'Is there work for a sword?', if: [{ quest: 'sq_pass', is: 'unstarted' }, { not: { standing: 'hrothmark', is: 'hostile' } }], next: 'sq_pass_offer' },
            { text: 'The pass is open.', if: { quest: 'sq_pass', stage: 'sq_pass_report' }, next: 'sq_pass_done' }
          ]
        },
        sq_pass_offer: {
          services: false,
          text: ['Raiders have walled off the pass on the Greywall road, where it climbs between the peaks. No carts come up, none go down. Eighty crowns, and the clans will know your name, if you clear it.'],
          options: [
            { text: 'I’ll open the pass.', do: [{ start: 'sq_pass' }] },
            { text: 'Not my mountains.' }
          ]
        },
        sq_pass_done: {
          services: false,
          text: ['So I heard: the first carts came through this morning. Here is your silver. Drink with us before you go back down to your squabbling kings.'],
          options: [{ text: 'Gladly.', do: [{ complete: 'sq_pass' }] }]
        }
      }
    },
    vessara_factor: {
      id: 'vessara_factor',
      speaker: 'Factor Salviati',
      place: 'vessara',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'The League has no king, traveller. It has a ledger. Everything here is for sale, and everything has its price, written down.',
            'Our crossbowmen are not brave. They do not need to be: a bolt does not care who is brave.',
            'Wine and salt are cheap on this coast; timber and iron are not. A sensible company carries the one north and the other south.',
            { if: { quest: 'sq_timber', is: 'done' }, text: 'The yards are hammering again, thanks to your timber. The League remembers a good supplier.' }
          ],
          options: [
            { text: 'Anything worth carrying?', if: [{ quest: 'sq_timber', is: 'unstarted' }, { not: { standing: 'vessaro', is: 'hostile' } }], next: 'sq_timber_offer' },
            { text: 'The timber is delivered.', if: { quest: 'sq_timber', stage: 'sq_timber_report' }, next: 'sq_timber_done' }
          ]
        },
        sq_timber_offer: {
          services: false,
          text: ['The shipyards are starved of timber. Up north it lies in heaps: buy it in the highlands, sell it here at our market, and the League adds sixty crowns to whatever profit you make.'],
          options: [
            { text: 'I’ll fetch your timber.', do: [{ start: 'sq_timber' }] },
            { text: 'Too far to haul beams.' }
          ]
        },
        sq_timber_done: {
          services: false,
          text: ['Every beam paid for and logged. Sixty crowns, as agreed: the League always pays what it writes down.'],
          options: [{ text: 'A pleasure.', do: [{ complete: 'sq_timber' }] }]
        }
      }
    },
    merrow_clerk: {
      id: 'merrow_clerk',
      speaker: 'Clerk of the Council',
      place: 'merrow',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'Welcome to Merrow, where no crown is worth more than its weight. The Council asks only that you pay your harbour dues.',
            'Swords are the city’s second trade, after cloth. You will find no better company for hire anywhere on the coast.',
            'Valedorn, Aurelian, the clans, the League: all of them trade here, and none of them rule here. That is how we like it.',
            { if: { quest: 'sq_lights', is: 'done' }, text: 'Ships are coming in whole again. The Council has entered your name on the good side of the ledger.' }
          ],
          options: [
            { text: 'Does the Council need a captain?', if: [{ quest: 'sq_lights', is: 'unstarted' }, { not: { standing: 'merrow', is: 'hostile' } }], next: 'sq_lights_offer' },
            { text: 'The false lights are out.', if: { quest: 'sq_lights', stage: 'sq_lights_report' }, next: 'sq_lights_done' }
          ]
        },
        sq_lights_offer: {
          services: false,
          text: ['Wreckers on the west coast are hanging lanterns on the rocks, and ships bound here run aground on them. The Council will pay ninety crowns to put the lights out, but it wants its own steel there: hire at least one of our sell-swords first.'],
          options: [
            { text: 'I’ll hire your swords and go.', do: [{ start: 'sq_lights' }] },
            { text: 'Find another captain.' }
          ]
        },
        sq_lights_done: {
          services: false,
          text: ['The Council thanks you, in the form it prefers: coin. Ninety crowns. Do come back; Merrow always has work for those who finish it.'],
          options: [{ text: 'I will.', do: [{ complete: 'sq_lights' }] }]
        }
      }
    },
    // ---- P7-06: companions of the wider world (data/companions.js, js/retinue.js) ----
    sigrun: {
      id: 'sigrun',
      speaker: 'Sigrun',
      place: 'hrothgard',
      visible: { not: { flag: 'sigrun_joined' } },
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: ['Sigrun sharpens an axe by the hearth and does not look up. Raiders burned my hall at the Steading. I ride with no one until they are broken.', 'The clans fight in a wedge. You would do well to learn it.'],
          options: [
            { text: 'Will you ride with my company?', if: { quest: 'sq_sigrun', is: 'unstarted' }, next: 'sq_sigrun_offer' },
            { text: 'The Steading raiders are broken.', if: { quest: 'sq_sigrun', stage: 'sq_sigrun_report' }, next: 'sq_sigrun_done' }
          ]
        },
        sq_sigrun_offer: {
          services: false,
          text: ['Break the raiders at the Steading, north in the hills, and I will ride with you. Not for coin alone: I want to see them broken.'],
          options: [
            { text: 'I’ll break them.', do: [{ start: 'sq_sigrun' }] },
            { text: 'Not my feud.' }
          ]
        },
        sq_sigrun_done: {
          services: false,
          text: ['Then my feud is done, and my axe is yours. Eight crowns a week, and never pay a Reaver to pass: I would sooner fight.'],
          options: [
            { text: 'Ride with us, Sigrun.', if: [{'room': 1}], do: [{'complete': 'sq_sigrun'}, {'retinue': 'sigrun'}] },
            { text: 'My company is full. Wait for me.', if: { not: { room: 1 } } },
            { text: 'Not yet.' }
          ]
        }
      }
    },
    iacopo: {
      id: 'iacopo',
      speaker: 'Iacopo',
      place: 'vessara',
      visible: { not: { flag: 'iacopo_joined' } },
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: ['A thin man with ink on his fingers counts coins that are not his. Iacopo, once a crossbow captain of the League. Now I owe a moneylender 120 crowns.', 'My bolts go where I point them, and I know the price of everything. Pay me on time and I will never leave you.'],
          options: [
            { text: 'Would you keep my company’s books?', if: { quest: 'sq_iacopo', is: 'unstarted' }, next: 'sq_iacopo_offer' },
            { text: 'Here are your 120 crowns.', if: { quest: 'sq_iacopo', stage: 'sq_iacopo_pay' }, next: 'sq_iacopo_done' }
          ]
        },
        sq_iacopo_offer: {
          services: false,
          text: ['Settle my debt, 120 crowns, and I am yours. Twelve a week after that, and on time: a man who is not paid does not stay.'],
          options: [
            { text: 'I’ll settle it.', do: [{ start: 'sq_iacopo' }] },
            { text: 'Too dear.' }
          ]
        },
        sq_iacopo_done: {
          services: false,
          text: ['Paid, and logged. Iacopo of Vessara is at your service.'],
          options: [
            { text: 'Welcome to the company.', if: [{'room': 1}, {'gold': 120}], do: [{'gold': -120}, {'complete': 'sq_iacopo'}, {'retinue': 'iacopo'}] },
            { text: 'My company is full. Wait for me.', if: { not: { room: 1 } } },
            { text: 'Not yet.' }
          ]
        }
      }
    },
    livia: {
      id: 'livia',
      speaker: 'Livia',
      place: 'tessaro',
      visible: { not: { flag: 'livia_joined' } },
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: ['A woman with an Aurelian shield on her back binds a farmer’s hand. Livia. Six years I patched up the legion’s wounded, until I saw what it did to people like these.', 'Deserters from my own legion robbed this village. I want them answered for.'],
          options: [
            { text: 'Will you join my company?', if: { quest: 'sq_livia', is: 'unstarted' }, next: 'sq_livia_offer' },
            { text: 'The deserters are broken.', if: { quest: 'sq_livia', stage: 'sq_livia_report' }, next: 'sq_livia_done' }
          ]
        },
        sq_livia_offer: {
          services: false,
          text: ['Break the deserters at their camp in the east. And know this: I will not ride against the people of any kingdom who did us no harm.'],
          options: [
            { text: 'I’ll deal with them.', do: [{ start: 'sq_livia' }] },
            { text: 'Not now.' }
          ]
        },
        sq_livia_done: {
          services: false,
          text: ['Then the village can sleep. My shield is yours: eight crowns a week, and keep your hands off honest caravans.'],
          options: [
            { text: 'Join us, Livia.', if: [{'room': 1}], do: [{'complete': 'sq_livia'}, {'retinue': 'livia'}] },
            { text: 'My company is full. Wait for me.', if: { not: { room: 1 } } },
            { text: 'Not yet.' }
          ]
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
