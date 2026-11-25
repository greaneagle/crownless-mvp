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
    // P10-04: the main story's people are cast from the kingdom you began in (js/story.js; {cast:role}
    // in text, '@role' in places, realms and conditions). `cast: 'elder' | 'recruiter'` is spoken by
    // that person of your start town's streets; begun in Valedorn, the cast is the Border March's.
    story_elder: {
      id: 'story_elder',
      speaker: '{cast:elder}',
      cast: 'elder',
      start: [{ if: { quest: 'q1', stage: 'q1_report' }, node: 'q1_report' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_road' }, { if: { not: { flag: 'met_elder' } }, node: 'first' }, 'again'],
      nodes: {
        first: {
          text: [
            'Welcome to {cast:home}, {name}. Strangers are rarer than reavers these days.',
            { if: { origin: 'farmhand' }, text: 'You have a farmer’s hands. Good — we need people who know what a harvest costs.' },
            { if: [{ origin: 'farmhand' }, { flag: 'origin_done' }], text: 'And word from {cast:village} is that you led its men well.' },
            { if: [{ origin: 'traveller' }, { flag: 'origin_done' }], text: 'You are the one who walked in at the gate and rode out after your horse. The inn has told half the town.' },
            { if: [{ origin: 'noble' }, { flag: 'origin_done' }], text: 'An old name, and the moneylender’s men broken on the road. Your father would have been glad of you.' },
            { if: { origin: 'scout' }, text: 'You walk like someone who reads the ground. The roads could use eyes like yours.' },
            { if: { origin: 'peddler' }, text: 'A peddler, by the look of that pack. Trade has been thin since the caravans started vanishing.' }
          ],
          options: [
            { text: 'Is there work for me?', do: [{ set: 'met_elder' }], next: 'q1_work' },
            { text: 'What troubles {cast:home}?', do: [{ set: 'met_elder' }], next: 'troubles' },
            { text: 'Only passing through.', do: [{ set: 'met_elder' }] }
          ]
        },
        again: {
          cycle: true,
          text: [
            '{Cast:home} has stood here since before the empire. It will stand after.',
            { if: { renown: 20 }, text: 'People in the square speak of your band, {name}. Kindly, mostly.' },
            { if: { standing: '@crown', is: 'hostile' }, text: '{Cast:crown.banner}’s riders were asking after you. I told them nothing — but be careful here.' },
            { if: { standing: '@crown', is: 'friendly' }, text: '{Cast:crown.banner}’s captains speak well of you. That opens doors in this town.' },
            { if: { flag: 'ending', is: 'compromise' }, text: 'The Warden of the Road! Sit, sit — the children want to hear about the parley again.' },
            { if: { flag: 'ending', is: 'crown' }, text: '{Cast:fort.place} stays {cast:crown.colour}, and {cast:home} breathes easier. You did that.' },
            { if: { flag: 'ending', is: 'rival' }, text: '{Cast:rival.colour} over {cast:fort.place}. Strange days. But the war is over, and that is something.' }
          ],
          options: [
            { text: 'Is there work for me?', if: { quest: 'q1', is: 'unstarted' }, next: 'q1_work' },
            { text: 'About that work…', if: { quest: 'q1', stage: 'q1_choose_work' }, next: 'q1_work' },
            { text: 'About that work…', if: { any: [{ quest: 'q1', stage: 'q1_wagon_go' }, { quest: 'q1', stage: 'q1_wagon_back' }, { quest: 'q1', stage: 'q1_bandits' }, { quest: 'q1', stage: 'q1_recruits' }, { quest: 'q1', stage: 'q1_drill' }] }, next: 'q1_progress' },
            { text: 'What troubles {cast:home}?', next: 'troubles' },
            { text: 'Who holds {cast:fort.place} now?', if: { flag: 'asked_troubles' }, next: 'greywall' },
            { text: 'One of my soldiers was born here: {veteran}.', if: [{ veteran: 3 }, { quest: 'sq_homecoming', is: 'unstarted' }], next: 'sq_home_offer' },
            { text: 'The grain for the feast is bought.', if: { quest: 'sq_homecoming', stage: 'sq_home_report' }, next: 'sq_home_feast' }
          ]
        },
        sq_home_offer: {
          services: false,
          text: ['{veteran}! I knew the family. Off to the wars with nothing but a borrowed spear, and back with a name. {Cast:home} will feast them properly — if you can find the grain. The granary is bare this season.'],
          options: [
            { text: 'I’ll buy the grain.', do: [{ start: 'sq_homecoming' }], quest: 'sq_homecoming' },
            { text: 'Another time.' }
          ]
        },
        sq_home_feast: {
          services: false,
          text: ['The whole town turns out. {veteran} is seated at the head of the table, red to the ears, while the children ask for the story of every scar. You will hear about this feast in every tavern in the land.'],
          options: [{ text: 'To {veteran}!', do: [{ honourVeteran: 30 }, { complete: 'sq_homecoming' }] }]
        },
        q1_work: {
          services: false,
          text: [
            'Three jobs want doing, and I can pay for one. Fifty crowns, and the town’s thanks.',
            'A grain wagon waits at {cast:village} and needs bringing home. Reavers out of the {cast:camp} are raiding the roads and need breaking. And {cast:recruiter}, our recruiter, cannot fill the ranks.',
            { if: { origin: 'farmhand' }, text: 'The wagon would suit you — you know what that grain is worth.' },
            { if: { origin: 'traveller' }, text: 'You know the roads and the thieves on them by now. The Reavers would suit you.' },
            { if: { origin: 'noble' }, text: 'A house that wants soldiers again should start with recruits.' },
            { if: { origin: 'scout' }, text: 'You could find the Reavers before they find you.' },
            { if: { origin: 'peddler' }, text: '{Cast:recruiter.short} pays a fair word for every recruit; a peddler knows how to strike a bargain.' }
          ],
          options: [
            { text: 'I’ll bring the grain wagon from {cast:village}.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'wagon' }, { stage: 'q1_wagon_go', quest: 'q1' }], next: 'q1_taken' },
            { text: 'I’ll deal with the Reavers.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'bandits' }, { stage: 'q1_bandits', quest: 'q1' }], next: 'q1_taken' },
            { text: 'I’ll help {cast:recruiter}.', do: [{ start: 'q1' }, { set: 'q1_path', to: 'recruits' }, { stage: 'q1_recruits', quest: 'q1' }], next: 'q1_taken' },
            { text: 'Let me think on it.', do: [{ start: 'q1' }] }
          ]
        },
        q1_taken: {
          services: false,
          text: [
            { if: { flag: 'q1_path', is: 'wagon' }, text: 'Good. {Cast:village} lies {cast:village.dir} along the road. Bring the wagon back whole, and yourself with it.' },
            { if: { flag: 'q1_path', is: 'bandits' }, text: 'Good. Break any band of them you find on the roads, or clear their camp {cast:camp.dir} of town. Mind your numbers.' },
            { if: { flag: 'q1_path', is: 'recruits' }, text: 'Good. {Cast:recruiter.short} is in the town. Hire three soldiers and show them they can fight.' },
            'Your journal will keep the details. Come back when it is done.'
          ],
          options: [{ text: 'I’ll see it done.' }]
        },
        q1_progress: {
          services: false,
          cycle: true,
          text: ['The work is not finished yet, {name}. Check your journal.', '{Cast:home} is counting on you. No hurry — but do not forget us.'],
          options: [{ text: 'On my way.' }]
        },
        q1_report: {
          services: false,
          text: [
            { if: { flag: 'q1_wagon_safe' }, text: 'The grain is in, and the drivers say you broke the ambush yourself.' },
            { if: { flag: 'q1_wagon_slipped' }, text: 'The grain is in, and not a sack lost. The drivers say you slipped past the Reavers like a fox.' },
            { if: { flag: 'q1_path', is: 'bandits' }, text: 'The Reavers will think twice before raiding our road again.' },
            { if: { flag: 'q1_path', is: 'recruits' }, text: '{Cast:recruiter.short} tells me your recruits held their line. Our recruiter has not smiled like that in years.' },
            'You have earned your wage. But there is something else — something that came back with you.'
          ],
          options: [{ text: 'What is it?', do: [{ give: 'charter_fragment' }, { set: 'knows_charter' }, { note: 'The story goes on with {cast:caravan} in {cast:rival_town}, if you want it. Or leave it: the world goes on without it.', quest: 'q1' }, { complete: 'q1' }], next: 'q1_charter' }]
        },
        q4_road: {
          services: false,
          text: [
            'Both armies are marching on {cast:fort.place}, {name}, and {cast:home} sits between them. Whoever wins, we bury our sons.',
            'There are hard men on both sides who want this war, and they have hired blades to start it. Break those blades, and the envoys will have to talk instead.',
            { if: [{ has: 'courier_packet' }, { flag: 'has_evidence' }], text: 'And you still carry {cast:caravan.short}’s packet. Two charters, both sealed — lay that on the parley table and neither crown can claim the law is theirs alone.' },
            { if: { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }, text: 'Without proof that neither claim is clean, though, they may only listen to the winner of the field.' }
          ],
          options: [
            { text: 'I’ll stand for the road — for neither crown.', do: [{ set: 'q4_side', to: 'road' }, { stage: 'q4_field_road', quest: 'q4' }], next: 'q4_road_sworn' },
            { text: 'I have not decided yet.' }
          ]
        },
        q4_road_sworn: {
          services: false,
          text: ['Then the road thanks you. Ride for {cast:fort.place} — and come home.'],
          options: [{ text: 'I will.' }]
        },
        q1_charter: {
          services: false,
          text: [
            'A scrap of parchment with the old imperial seal. Part of a charter — the charter, perhaps, that both crowns say gives them {cast:fort.place}.',
            'Why would Reavers carry such a thing? Someone is paying them to move it, or to lose it.',
            'Keep it safe, {name}. A caravan master in {cast:rival_town} lost a sealed packet on the road last month. {Cast:caravan.short} may know more.'
          ],
          options: [{ text: 'I’ll keep it safe.' }]
        },
        troubles: {
          services: false,
          text: [
            'Reavers on the roads, and nobody agrees whose job it is to stop them.',
            '{Cast:crown.banner} says {cast:fort} is theirs by right; {cast:rival.banner} says an imperial charter gives it to them.',
            'While the lords argue, the wagons burn.'
          ],
          options: [
            { text: 'Tell me about {cast:fort.place}.', do: [{ set: 'asked_troubles' }], next: 'greywall' },
            { text: 'I will keep my eyes open.', do: [{ set: 'asked_troubles' }] }
          ]
        },
        greywall: {
          services: false,
          text: [
            { if: { owner: '@fort', is: '@crown' }, text: '{Cast:fort.place} flies {cast:crown.banner}’s {cast:crown.colour}, as it has for thirty years.' },
            { if: { owner: '@fort', is: '@rival' }, text: '{Cast:fort.place} flies the {cast:rival} {cast:rival.colour} now. I never thought I would see it.' },
            'They say an old imperial charter would settle who should hold it — if anyone could find the thing.',
            { if: { flag: 'heard_charter' }, text: 'You have asked me that before. My answer has not changed.' }
          ],
          options: [{ text: 'Thank you.', do: [{ set: 'heard_charter' }] }]
        }
      }
    },
    story_recruiter: {
      id: 'story_recruiter',
      speaker: '{cast:recruiter}',
      cast: 'recruiter',
      start: [{ if: [{ quest: 'q1', stage: 'q1_recruits' }, { not: { flag: 'q1_brun_advance' } }], node: 'q1' }, 'talk'],
      nodes: {
        q1: {
          services: false,
          text: [
            'So {cast:elder.short} sent you. Good. I need three strong backs before the Reavers grow bolder.',
            'Hire them here. I’ll put fifteen crowns toward the first, and you can drill them on the road.'
          ],
          options: [{ text: 'Thank you.', do: [{ gold: 15 }, { set: 'q1_brun_advance' }], next: 'talk' }]
        },
        talk: {
          cycle: true,
          text: [
            'Strong backs and steady hands wanted. Coin up front.',
            'A levy with a full belly fights twice as hard.',
            { if: { quest: 'q1', stage: 'q1_recruits' }, text: 'Three, {cast:elder.short} said. You have hired {flag:q1_hired} so far.' },
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
          options: [{ text: 'Thank you.', do: [{ complete: 'sq_larders' }] }]
        },
        sq_planned_offer: {
          services: false,
          text: ['A band of Reavers has dug in near {cast:village}: shields locked, sell-swords in the middle. Charge them and you lose good soldiers. Fight them yourself, and before you do, pick a setup on the Prepare screen. Defensive lets them come to your line.'],
          options: [
            { text: 'I’ll take them on to a plan.', do: [{ start: 'sq_planned' }] },
            { text: 'Not now.' }
          ]
        }
      }
    },
    // ---- P10-05: the origins' people (data/origins.js, the opening quests in data/quests.js).
    // The unhorsed traveller's innkeeper: your start town's own, while the opening quest needs them.
    origin_innkeeper: {
      id: 'origin_innkeeper',
      speaker: '{cast:innkeeper}',
      cast: 'innkeeper',
      visible: { any: [{ quest: 'o_traveller', stage: 'o_trav_inn' }, { quest: 'o_traveller', stage: 'o_trav_back' }] },
      start: [{ if: { quest: 'o_traveller', stage: 'o_trav_back' }, node: 'back' }, 'arrive'],
      nodes: {
        arrive: {
          services: false,
          text: [
            'On foot, and limping? Sit down before you fall down. There is a bed and a bowl for you here, and you can pay me when you have a purse again.',
            'Your horse? The thieves who ride the {cast:village} road. They camp out there brazen as you like, and nobody goes after them alone.',
            'Hire a couple of swords from {cast:recruiter.short} and go together. A company is the only way anyone gets anything back on these roads.'
          ],
          options: [{ text: 'I’ll get my horse back.', do: [{ food: 2 }, { stage: 'o_trav_hire', quest: 'o_traveller' }, { note: 'The innkeeper fed you and told you where the thieves camp, on the {cast:village} road.', quest: 'o_traveller' }] }]
        },
        back: {
          services: false,
          text: [
            'Is that your horse at my trough? Ha! Then the road has a new captain on it.',
            'If you want work, {cast:elder} has more of it than hands. Go and see. And you will hear the map can run faster, if you are in a hurry: the button by the zoom.'
          ],
          options: [{ text: 'I’ll go and see.', do: [{ set: 'origin_done' }, { complete: 'o_traveller' }, { start: 'q1' }] }]
        }
      }
    },
    // The scout's recruiter: your start town's own, while the opening quest needs them (P10-06).
    origin_recruiter: {
      id: 'origin_recruiter',
      speaker: '{cast:recruiter}',
      cast: 'recruiter',
      visible: { any: [{ quest: 'o_scout', stage: 'o_scout_ask' }, { quest: 'o_scout', stage: 'o_scout_back' }] },
      start: [{ if: { quest: 'o_scout', stage: 'o_scout_back' }, node: 'back' }, 'ask'],
      nodes: {
        ask: {
          services: false,
          text: [
            'You are a scout? Then you are what I need. Outlaws are watching the road past {cast:border}, and I will not send recruits down it blind.',
            'Hire two to ride with you, go to {cast:border} and ask what they have seen, then find them. Break them or send them running, and come back and tell me.'
          ],
          options: [{ text: 'I’ll find them.', do: [{ stage: 'o_scout_hire', quest: 'o_scout' }] }]
        },
        back: {
          services: false,
          text: [
            'Broken, or run off? Either way the road is ours again, and you found them faster than anyone I have sent. You have quick feet and quicker eyes. Keep them.',
            'There is more work in town than I can fill. {Cast:elder} has the most of it. And the map runs faster if you are in a hurry: the button by the zoom.'
          ],
          options: [{ text: 'I’ll go and see.', do: [{ attribute: 'agi', by: 1 }, { note: 'The road taught you something: +1 Agility.', quest: 'o_scout' }, { set: 'origin_done' }, { complete: 'o_scout' }, { start: 'q1' }] }]
        }
      }
    },
    // The peddler's merchant: your start town's own, while the opening quest needs them (P10-06).
    origin_merchant: {
      id: 'origin_merchant',
      speaker: '{cast:merchant}',
      cast: 'merchant',
      visible: { any: [{ quest: 'o_peddler', stage: 'o_ped_deal' }, { quest: 'o_peddler', stage: 'o_ped_back' }] },
      start: [{ if: { quest: 'o_peddler', stage: 'o_ped_back' }, node: 'back' }, 'deal'],
      nodes: {
        deal: {
          services: false,
          text: [
            'A peddler with an empty pack. I know the look. Here is a deal: {cast:village} has grain from its own fields, and the town is short of it.',
            'Buy some there and sell it here. Take two guards, mind: a peddler alone on the road is a peddler robbed. Here is something toward the grain, and there is more for you when it is in.'
          ],
          options: [{ text: 'You have a deal.', do: [{ gold: 25 }, { stage: 'o_ped_guards', quest: 'o_peddler' }, { note: 'The merchant gave you 25 crowns toward the grain.', quest: 'o_peddler' }] }]
        },
        back: {
          services: false,
          text: [
            'The grain is in, and the price came down a little for it. That is trade. Here: the rest of what I promised.',
            'If you want more than grain, {cast:elder} has work for a band with guards. And the map runs faster if you are in a hurry: the button by the zoom.'
          ],
          options: [{ text: 'I’ll go and see.', do: [{ gold: 45 }, { note: 'The merchant paid you for the deal.', quest: 'o_peddler' }, { set: 'origin_done' }, { complete: 'o_peddler' }, { start: 'q1' }] }]
        }
      }
    },
    // The impoverished noble's retainer, in your start town while the opening quest lasts.
    origin_retainer: {
      id: 'origin_retainer',
      speaker: 'Old Tam',
      tag: 'Retainer',
      frames: [80, 81, 82, 83],
      place: '@home',
      visible: { quest: 'o_noble', is: 'active' },
      start: [{ if: { quest: 'o_noble', stage: 'o_noble_home' }, node: 'home' }, { if: { quest: 'o_noble', stage: 'o_noble_tam' }, node: 'debt' }, 'waiting'],
      nodes: {
        debt: {
          services: false,
          text: [
            'You came. Good. Your father owed a moneylender more than the house was worth, and now he is dead the moneylender wants it paid.',
            'His men took your brother out to {cast:border} and say they will keep him until the debt is settled. We cannot pay it. But we can settle it another way.',
            'Here is what is left in the strongbox. Hire three soldiers with it, and go and get him.'
          ],
          options: [{ text: 'I will bring him home.', do: [{ gold: 40 }, { stage: 'o_noble_hire', quest: 'o_noble' }] }]
        },
        waiting: {
          services: false,
          cycle: true,
          text: ['Your journal knows the way, my lord. I will be here.', 'Hire your soldiers, then go for him. The moneylender’s men will not wait for ever.'],
          options: [{ text: 'On my way.' }]
        },
        home: {
          services: false,
          text: [
            'You brought him home. Your father would have wept to see it.',
            'Take this. It hung over his hearth: your grandfather’s axe. Older than the debt and worth more than it, to us. Now go and make the name worth something again. {Cast:elder} in the town square is always looking for a sword.'
          ],
          options: [{ text: 'I will.', do: [{ equip: 'hand_axe' }, { note: 'Old Tam gave you your grandfather’s axe.', quest: 'o_noble' }, { set: 'origin_done' }, { complete: 'o_noble' }, { start: 'q1' }] }]
        }
      }
    },
    // The farmhand's headman, in your village while the opening quest lasts.
    origin_headman: {
      id: 'origin_headman',
      speaker: 'The Headman of {cast:village}',
      place: '@village',
      visible: { quest: 'o_farmhand', is: 'active' },
      start: [{ if: { quest: 'o_farmhand', stage: 'o_farm_report' }, node: 'report' }, { if: { quest: 'o_farmhand', stage: 'o_farm_headman' }, node: 'raid' }, 'waiting'],
      nodes: {
        raid: {
          services: false,
          text: [
            'They came at dawn, took the grain from the barns and the beasts from the pens, and they are camped not an hour away, sharing it out.',
            'Three of our men have their flails and their fathers’ old spears, and they will follow you. You always were the one who kept a cool head.'
          ],
          options: [{ text: 'We go now.', do: [{ stage: 'o_farm_raiders', quest: 'o_farmhand' }] }]
        },
        waiting: {
          services: false,
          cycle: true,
          text: ['The raiders are close. Your journal knows where.', 'Keep the men together and they will hold.'],
          options: [{ text: 'On my way.' }]
        },
        report: {
          services: false,
          text: [
            'The grain is back in the barns. The village will not forget it.',
            'The men want to keep following you, and there is no living here this winter. Take them to {cast:home}: there is work there for a band that can fight. Mind you feed them.'
          ],
          options: [{ text: 'To {cast:home}, then.', do: [{ stage: 'o_farm_town', quest: 'o_farmhand' }] }]
        }
      }
    },
    // GDD §4 Q4: "a short negotiation scene" at the contested fort after the deciding battle.
    story_parley: {
      id: 'story_parley',
      speaker: 'The Parley at {cast:fort.place}',
      place: '@fort',
      visible: { quest: 'q4', stage: 'q4_terms' },
      start: 'terms',
      nodes: {
        terms: {
          services: false,
          text: [
            'In a tent below {cast:fort.place}’s walls, {cast:crown_agent} and {cast:rival_agent} sit across a trestle table. Both look at you.',
            { if: { flag: 'q4_side', is: 'crown' }, text: '{Cast:crown_agent.short} smiles; {cast:rival_agent.short} does not. The field was {cast:crown.banner}’s, and everyone in the tent knows who won it.' },
            { if: { flag: 'q4_side', is: 'rival' }, text: '{Cast:rival_agent.short} inclines {cast:rival_agent.his} head; {cast:crown_agent.short} stares at the table. The field was {cast:rival.banner}’s, and everyone in the tent knows who won it.' },
            { if: { flag: 'q4_side', is: 'road' }, text: 'Neither army fired a shot. They are here because you made them talk — and they are waiting to see what you will say.' },
            { if: [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }], text: 'Without proof, neither will yield the law to the other. One of them must have the fort.' }
          ],
          options: [
            { text: '{Cast:fort.place} stays with {cast:crown.banner}.', if: { any: [{ flag: 'q4_side', is: 'crown' }, [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }]] }, do: [{ owner: '@fort', to: '@crown' }, { rep: '@crown', by: 25 }, { rep: '@rival', by: -25, if: { flag: 'q4_side', is: 'crown' } }, { complete: 'q4' }, { ending: 'crown', quest: 'q4' }] },
            { text: '{Cast:fort.place} passes to {cast:rival.banner}.', if: { any: [{ flag: 'q4_side', is: 'rival' }, [{ flag: 'q4_side', is: 'road' }, { not: [{ has: 'courier_packet' }, { flag: 'has_evidence' }] }]] }, do: [{ owner: '@fort', to: '@rival' }, { rep: '@rival', by: 25 }, { rep: '@crown', by: -25, if: { flag: 'q4_side', is: 'rival' } }, { complete: 'q4' }, { ending: 'rival', quest: 'q4' }] },
            { text: 'Lay both charters on the table: neither claim is clean.', if: [{ flag: 'q4_side', is: 'road' }, { has: 'courier_packet' }, { flag: 'has_evidence' }], do: [{ take: 'courier_packet' }, { rep: '@crown', by: 25 }, { rep: '@rival', by: 25 }, { complete: 'q4' }, { ending: 'compromise', quest: 'q4' }] },
            { text: 'Not yet. I need a moment.' }
          ]
        }
      }
    },
    caravan_master: {
      id: 'caravan_master',
      speaker: '{cast:caravan}',
      cast: 'caravan',
      place: '@rival_town',
      start: [
        { if: { quest: 'q2', stage: 'q2_choose' }, node: 'q2_read' },
        { if: { quest: 'q2', stage: 'q2_recover' }, node: 'q2_waiting' },
        { if: { quest: 'q2', is: 'done' }, node: 'after' },
        'intro'
      ],
      nodes: {
        intro: {
          text: [
            '{Cast:caravan.short}, master of the {cast:rival_town} caravans — what is left of them. Reavers hit my wagons on the road and took a courier’s packet sealed with the old imperial eagle.',
            { if: { has: 'charter_fragment' }, text: 'Wait — that scrap you carry. The same eagle, the same wax. Where did you find that?' },
            { if: { not: { has: 'charter_fragment' } }, text: 'Whoever sealed it wanted it to reach {cast:fort.place}. Whoever took it wanted it not to.' },
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
            'They are camped on the road between here and {cast:fence_town}, bold as you like.',
            'Fight them if you have the swords. A big enough company might scare them off without a fight. Or there is a fence in {cast:fence_town} who hears everything — for a price.'
          ],
          options: [{ text: 'I’ll be back with it.' }]
        },
        q2_waiting: {
          cycle: true,
          text: ['The road between here and {cast:fence_town}. Fight them, cow them, or buy their secret from the fence in {cast:fence_town}.', 'Every day that packet is out there, someone is reading it who should not.'],
          options: [
            { text: 'On my way.' },
            { text: 'Could a company earn from its wagons?', if: { quest: 'sq_venture', is: 'unstarted' }, next: 'sq_venture_offer' },
            { text: 'My merchant has turned a profit.', if: { quest: 'sq_venture', stage: 'sq_venture_report' }, next: 'sq_venture_done' }
          ]
        },
        q2_read: {
          services: false,
          text: [
            'You found it! Let me see — two charters? Both sealed with the eagle, both naming a different heir to {cast:fort.place}. One for {cast:crown.banner}, one for {cast:rival.banner}.',
            'Someone forged one of these. Or both. Whoever holds this packet holds the argument.',
            '{Cast:crown_agent} of {cast:crown.banner} is in {cast:home}. {Cast:rival_agent} sits here in {cast:rival_town}. Or keep it, and let neither of them have it.'
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
            { if: { flag: 'q2_choice', is: 'crown' }, text: '{Cast:crown.banner}’s men walk taller since you gave them that packet. {Cast:rival_agent.title} does not smile at me any more.' },
            { if: { flag: 'q2_choice', is: 'rival' }, text: '{Cast:rival_agent.title} says the packet proves the {cast:rival} claim. Half of {cast:rival_town} believes {cast:rival_agent.him}.' }
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
    // Your realm's envoy, in your start town: it holds the contested fort, and asks you to keep it.
    crown_agent: {
      id: 'crown_agent',
      speaker: '{cast:crown_agent}',
      cast: 'crown_agent',
      place: '@home',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_declare' }, 'talk'],
      nodes: {
        q2: {
          services: false,
          text: ['They say you have {cast:caravan.short}’s packet. {Cast:crown.banner} would be grateful to see it, {name} — and {cast:crown.banner} remembers its friends.'],
          options: [{ text: 'Show the packet to {cast:crown.banner}.', if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], do: [{ take: 'courier_packet' }, { set: 'q2_choice', to: 'crown' }, { rep: '@crown', by: 25 }, { rep: '@rival', by: -10 }, { complete: 'q2' }], next: 'q2_thanks' }, { text: 'Not yet.' }]
        },

        q3_offer: {
          services: false,
          text: [
            '{Cast:rival.a} supply column is camped on the {cast:rival_fort.place} road, feeding their garrison. Break it, and {cast:fort.place} stays {cast:crown.colour}. A hundred and twenty crowns, and {cast:crown.banner}’s gratitude.',
            { if: { flag: 'q3_heard_rival' }, text: 'I hear {cast:rival_agent.title} has made you an offer too. Choose wisely — or profitably.' }
          ],
          options: [
            { text: 'I’ll ride for {cast:crown.banner}.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'crown' }, { stage: 'q3_strike_rival', quest: 'q3' }], next: 'q3_go' },
            { text: 'Sell {cast:rival_agent.title}’s plans to {cast:crown.banner} (100 crowns).', if: { flag: 'q3_heard_rival' }, do: [{ start: 'q3' }, { set: 'q3_side', to: 'sold_to_crown' }, { gold: 100 }, { rep: '@crown', by: 10 }, { rep: '@rival', by: -25 }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_sold' },
            { text: 'I’ll fight for neither banner. I’ll guard the road.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'road' }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_refused' },
            { text: 'Let me think about it.', do: [{ start: 'q3' }, { set: 'q3_heard_crown' }] }
          ]
        },
        q3_go: {
          services: false,
          text: ['Good. Your journal has the road. Be quick — columns do not wait.'],
          options: [{ text: 'On my way.' }]
        },
        q3_sold: {
          services: false,
          text: ['A hundred crowns for knowing where they mean to strike. A fair trade — and {cast:rival_agent.title} will never know who told us. While both banners chase shadows, the road is anyone’s. Watch yourself out there.'],
          options: [{ text: 'Pleasure doing business.' }]
        },
        q3_refused: {
          services: false,
          text: ['Neither banner? Then may the road thank you, because I will not.'],
          options: [{ text: 'Someone has to.' }]
        },

        q4_declare: {
          services: false,
          text: ['{Cast:rival.banner} has marched on {cast:fort.place}. One battle will settle it. Stand with {cast:crown.banner}, {name}, and {cast:crown.banner} will stand with you.'],
          options: [
            { text: 'I stand with {cast:crown.banner} at {cast:fort.place}.', do: [{ set: 'q4_side', to: 'crown' }, { stage: 'q4_field_crown', quest: 'q4' }], next: 'q4_sworn' },
            { text: 'Not yet.' }
          ]
        },
        q4_sworn: {
          services: false,
          text: ['Then ride for {cast:fort.place}. Win the field, and the parley will listen to you.'],
          options: [{ text: 'To {cast:fort.place}.' }]
        },
        q2_thanks: {
          services: false,
          text: ['Two charters… and only one of them true. {Cast:crown.banner}’s lawyers will know which. You have done {cast:crown} a service it will not forget.'],
          options: [{ text: 'See that it doesn’t.' }]
        },
        talk: {
          cycle: true,
          text: [
            '{Cast:fort.place} has been {cast:crown.banner}’s for thirty years. Paper will not change that.',
            'Keep the roads clear and {cast:crown.banner} keeps your purse full. Simple.',
            { if: { flag: 'q2_choice', is: 'crown' }, text: 'The packet you brought us has {cast:rival.banner} scrambling. Well done.' },
            { if: { flag: 'q2_choice', is: 'rival' }, text: 'You gave that packet to {cast:rival_agent.title}. I hope {cast:rival_agent.his} gold was worth it.' },
            { if: { flag: 'q2_choice', is: 'kept' }, text: 'You still have that packet, I hear. {Cast:crown.banner} would pay well for it — if you ever tire of carrying it.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'crown' }], text: 'The {cast:rival} column will not trouble {cast:fort.place} again. Good work.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'rival' }], text: 'You broke {cast:crown.a} column. I will not forget whose side you chose.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'road' }], text: 'Neither banner, eh? The carters sing your name. Our ruler does not.' }
          ],
          options: [{ text: 'Any work on the frontier?', if: [{ quest: 'sq_border', is: 'unstarted' }, { not: { standing: '@crown', is: 'hostile' } }], next: 'sq_border_offer' }]
        },
        sq_border_offer: {
          services: false,
          text: ['Raiders are burning farms between {cast:border} and {cast:fort.place}. I have a watch posted near {cast:border}; they are too few to attack, but if they hear a fight they will ride to it. Seventy crowns if you break the raiders.'],
          options: [
            { text: 'I’ll break them.', do: [{ start: 'sq_border' }] },
            { text: 'Not now.' }
          ]
        }
      }
    },
    // The rival realm's envoy, in its town: it claims the contested fort by an imperial charter.
    rival_agent: {
      id: 'rival_agent',
      speaker: '{cast:rival_agent}',
      cast: 'rival_agent',
      place: '@rival_town',
      start: [{ if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], node: 'q2' }, { if: [{ quest: 'q2', is: 'done' }, { any: [{ quest: 'q3', is: 'unstarted' }, { quest: 'q3', stage: 'q3_choose' }] }], node: 'q3_offer' }, { if: { quest: 'q4', stage: 'q4_declare' }, node: 'q4_declare' }, 'talk'],
      nodes: {
        q2: {
          services: false,
          text: ['{Cast:caravan.short} tells me you recovered {cast:caravan.his} packet. Imperial law belongs to those who keep it, {name}. Let me see it.'],
          options: [{ text: 'Show the packet to {cast:rival_agent.title}.', if: [{ quest: 'q2', stage: 'q2_choose' }, { has: 'courier_packet' }], do: [{ take: 'courier_packet' }, { set: 'q2_choice', to: 'rival' }, { rep: '@rival', by: 25 }, { rep: '@crown', by: -10 }, { complete: 'q2' }], next: 'q2_thanks' }, { text: 'Not yet.' }]
        },

        q3_offer: {
          services: false,
          text: [
            '{Cast:crown.a} column holds the {cast:fort.place} road, choking our couriers. Break it, and the law will have room to breathe. A hundred and twenty crowns, and {cast:rival.banner}’s thanks.',
            { if: { flag: 'q3_heard_crown' }, text: 'I hear {cast:crown_agent} has made you an offer too. Choose wisely — or profitably.' }
          ],
          options: [
            { text: 'I’ll ride for {cast:rival.banner}.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'rival' }, { stage: 'q3_strike_crown', quest: 'q3' }], next: 'q3_go' },
            { text: 'Sell {cast:crown.banner}’s plans to {cast:rival_agent.title} (100 crowns).', if: { flag: 'q3_heard_crown' }, do: [{ start: 'q3' }, { set: 'q3_side', to: 'sold_to_rival' }, { gold: 100 }, { rep: '@rival', by: 10 }, { rep: '@crown', by: -25 }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_sold' },
            { text: 'I’ll fight for neither banner. I’ll guard the road.', do: [{ start: 'q3' }, { set: 'q3_side', to: 'road' }, { stage: 'q3_road', quest: 'q3' }], next: 'q3_refused' },
            { text: 'Let me think about it.', do: [{ start: 'q3' }, { set: 'q3_heard_rival' }] }
          ]
        },
        q3_go: {
          services: false,
          text: ['Good. Your journal has the road. Be quick — columns do not wait.'],
          options: [{ text: 'On my way.' }]
        },
        q3_sold: {
          services: false,
          text: ['A hundred crowns for knowing where they mean to strike. A fair trade — and {cast:crown_agent} will never know who told us. While both banners chase shadows, the road is anyone’s. Watch yourself out there.'],
          options: [{ text: 'Pleasure doing business.' }]
        },
        q3_refused: {
          services: false,
          text: ['Neither banner? Then may the road thank you, because I will not.'],
          options: [{ text: 'Someone has to.' }]
        },

        q4_declare: {
          services: false,
          text: ['{Cast:crown.banner} has drawn up its host before {cast:fort.place}. One battle will decide whether the law comes home. Stand with us, {name}.'],
          options: [
            { text: 'I stand with {cast:rival.banner} at {cast:fort.place}.', do: [{ set: 'q4_side', to: 'rival' }, { stage: 'q4_field_rival', quest: 'q4' }], next: 'q4_sworn' },
            { text: 'Not yet.' }
          ]
        },
        q4_sworn: {
          services: false,
          text: ['Then ride for {cast:fort.place}. Win the field, and the parley will listen to you.'],
          options: [{ text: 'To {cast:fort.place}.' }]
        },
        q2_thanks: {
          services: false,
          text: ['Two charters, and one of them a forgery that favours {cast:crown} — I would stake my seat on it. {Cast:rival.banner} owes you, {name}.'],
          options: [{ text: 'I’ll remember that.' }]
        },
        talk: {
          cycle: true,
          text: [
            '{Cast:fort.place} was granted by charter, not won by the sword. The law is on our side.',
            '{Cast:rival_town} remembers the empire’s order. The roads were safe then.',
            { if: { flag: 'q2_choice', is: 'rival' }, text: 'The packet you brought me is in the court archive. {Cast:crown}’s claim is crumbling.' },
            { if: { flag: 'q2_choice', is: 'crown' }, text: 'You handed that packet to {cast:crown.banner}. I hope you know what you have done.' },
            { if: { flag: 'q2_choice', is: 'kept' }, text: 'You still keep that packet. The court would welcome it — whenever you choose.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'rival' }], text: 'The {cast:fort.place} road is open to our couriers again. The court is grateful.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'crown' }], text: 'You cut down our column for {cast:crown.banner}. The law has a long memory.' },
            { if: [{ quest: 'q3', is: 'done' }, { flag: 'q3_side', is: 'road' }], text: 'You guarded the road for everyone. Perhaps there is a third way after all.' }
          ]
        }
      }
    },
    // GDD §10: Mara joins after Q2 "for a modest cost or through a short trust dialogue". She already
    // knows where the caravan master's packet went; an honest answer earns her trust, a lie costs it.
    // P10-04: she waits in your start town.
    mara: {
      id: 'mara',
      speaker: 'Mara',
      place: '@home',
      tag: 'Scout',
      frames: [124, 125, 126, 127],
      // She turns up after Q2, until she joins (or is gone for good).
      visible: [{ quest: 'q2', is: 'done' }, { not: { companion: 'mara' } }, { not: { flag: 'mara_gone' } }, { not: { flag: 'mara_scouting' } }],
      start: [
        { if: { companion: 'mara' }, node: 'with_us' },
        { if: { flag: 'mara_met' }, node: 'verdict' },
        'meet'
      ],
      nodes: {
        meet: {
          services: false,
          text: [
            'You are the one who found {cast:caravan.short}’s packet. I am Mara. I scouted these roads for the empire, back when there was an empire.',
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
            { text: 'To {cast:crown_agent} and {cast:crown.banner}.', if: { flag: 'q2_choice', is: 'crown' }, do: [{ add: 'mara_trust' }], next: 'why' },
            { text: 'To {cast:crown_agent} and {cast:crown.banner}.', if: { not: { flag: 'q2_choice', is: 'crown' } }, do: [{ set: 'mara_lied' }], next: 'why' },
            { text: 'To {cast:rival_agent}.', if: { flag: 'q2_choice', is: 'rival' }, do: [{ add: 'mara_trust' }], next: 'why' },
            { text: 'To {cast:rival_agent}.', if: { not: { flag: 'q2_choice', is: 'rival' } }, do: [{ set: 'mara_lied' }], next: 'why' },
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
            'The low roads flood in spring. Keep to the high track past {cast:fence_town}.',
            'Both crowns want {cast:fort.place}. Neither asked the people who live under it.',
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
      place: '@fence_town',
      visible: { quest: 'q2', stage: 'q2_recover' },
      start: 'offer',
      nodes: {
        offer: {
          text: [
            'Word travels fast among those who live off the road. You want {cast:caravan.short}’s packet.',
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
