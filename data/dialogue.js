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
      start: [{ if: { not: { flag: 'met_elder' } }, node: 'first' }, 'again'],
      nodes: {
        first: {
          text: [
            'Welcome to Stonebridge, {name}. Strangers are rarer than reavers these days.',
            { if: { background: 'farmhand' }, text: 'You have a farmer’s hands. Good — we need people who know what a harvest costs.' },
            { if: { background: 'scout' }, text: 'You walk like someone who reads the ground. The roads could use eyes like yours.' },
            { if: { background: 'peddler' }, text: 'A peddler, by the look of that pack. Trade has been thin since the caravans started vanishing.' }
          ],
          options: [
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
            { text: 'What troubles Stonebridge?', next: 'troubles' },
            { text: 'Who holds Greywall now?', if: { flag: 'asked_troubles' }, next: 'greywall' }
          ]
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
