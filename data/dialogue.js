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
      speaker: 'Caravan Master',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'My seal was broken before I even reached the pass.',
            'Survive the ambush, then recover the courier packet.',
            'Show it to your masters, or keep it. Either way, choose wisely.'
          ]
        }
      }
    },
    valedorn_agent: {
      id: 'valedorn_agent',
      speaker: 'Valedorn Agent',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'Two banners claim this land, and only one can stand.',
            'Take our contract and settle the patrol and the caravan in one stroke.',
            'Keep Mara alive — she is the witness this frontier needs.'
          ]
        }
      }
    },
    aurelian_agent: {
      id: 'aurelian_agent',
      speaker: 'Aurelian Agent',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'Greywall’s verdict will decide who rules the south.',
            'Win the deciding battle, then dictate the settlement’s terms.',
            'Valedorn, Aurelian, or compromise — the choice will be yours.'
          ]
        }
      }
    },
    mara: {
      id: 'mara',
      speaker: 'Mara',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'I have walked every road between the forts.',
            'A token of mine has gone missing — I would like it back.',
            'Do not let the Reavers put me in the ground.'
          ]
        }
      }
    },
    bandit_informant: {
      id: 'bandit_informant',
      speaker: 'Bandit Informant',
      start: 'talk',
      nodes: {
        talk: {
          cycle: true,
          text: [
            'Word travels fast among those who live off the road.',
            'Wagons, patrols, and better-paying employers — I hear it all.',
            'Cross me and the next coin you spend will be your last.'
          ]
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
