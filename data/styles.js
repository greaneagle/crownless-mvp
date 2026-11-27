/* Crownless content: fighting styles (P11-10, docs/PHASE-11-PLAN.md §10). Plain classic script.
 * How a fighter uses the same rules as the player: every style sees only what is drawn (the phase of a
 * swing, a stagger, a lowered shield, distances) and acts a reaction after it, never in the same frame.
 *   reaction     s: from seeing a blow wound up (or an opening) to raising a guard (or striking into it); never 0
 *   patience     s: how long it waits just outside the reach of a ready opponent before closing anyway (0: never waits)
 *   spacing      0–1: a longer weapon keeps at its own reach's edge, where a shorter one can't answer (0: no)
 *   opportunism  0–1: how often it strikes into an opening it sees (a miss's recovery, a stagger, a broken guard)
 *   guardUse     0–1: how often a shield (or a guarding weapon) comes up against a blow it sees coming
 *   retreatAt    px: an archer steps back from a foot soldier this close (0: stands)
 *   pursue       0–1: how readily it chases down a foe who runs
 *   preferRange  px: an archer's distance to its target (0: the archer's usual)
 *   duel         a tournament fighter's style only
 *   words        the troop card's line
 * A troop's style is its `style` if it names one, else from its kind (js/styles.js `forTroop`). The
 * numbers were set by measurement (scripts/duel-lab.js --ai, docs/PHASE-11-VALIDATION.md "Styles"). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.fighting_styles = {
    brawler: { id: 'brawler', name: 'Brawler', reaction: 0.22, patience: 0, spacing: 0, opportunism: 0.2, guardUse: 0.5, retreatAt: 0, pursue: 1, preferRange: 0, words: 'fights wildly, slow to guard' },
    soldier: { id: 'soldier', name: 'Soldier', reaction: 0.15, patience: 0.6, spacing: 0, opportunism: 0.5, guardUse: 0.8, retreatAt: 0, pursue: 0.7, preferRange: 0, words: 'fights steadily, keeps its guard' },
    veteran: { id: 'veteran', name: 'Veteran', reaction: 0.1, patience: 1.4, spacing: 0.5, opportunism: 0.9, guardUse: 1, retreatAt: 0, pursue: 0.5, preferRange: 0, words: 'fights patiently, guards well, strikes when you miss' },
    spear: { id: 'spear', name: 'Spear', reaction: 0.13, patience: 1, spacing: 1, opportunism: 0.6, guardUse: 0.8, retreatAt: 0, pursue: 0.5, preferRange: 0, words: 'keeps you at the end of its spear' },
    heavy: { id: 'heavy', name: 'Heavy', reaction: 0.14, patience: 1.8, spacing: 0, opportunism: 0.85, guardUse: 0.7, retreatAt: 0, pursue: 0.4, preferRange: 0, words: 'waits for an opening, then hits hard' },
    skirmisher: { id: 'skirmisher', name: 'Skirmisher', reaction: 0.15, patience: 0, spacing: 0, opportunism: 0.5, guardUse: 0.5, retreatAt: 80, pursue: 0.3, preferRange: 160, words: 'keeps its distance and shoots' },
    rider: { id: 'rider', name: 'Rider', reaction: 0.15, patience: 1.5, spacing: 0, opportunism: 0.6, guardUse: 0.5, retreatAt: 0, pursue: 0.9, preferRange: 0, words: 'charges, rides on and wheels; hunts archers' },
    // Tournament fighters (by round; a rival keeps theirs).
    rusher: { id: 'rusher', name: 'Rusher', duel: true, reaction: 0.18, patience: 0, spacing: 0, opportunism: 0.4, guardUse: 0.6, retreatAt: 0, pursue: 1, preferRange: 0, words: 'comes straight at you' },
    shield_wall: { id: 'shield_wall', name: 'Shield-wall', duel: true, reaction: 0.1, patience: 1.6, spacing: 0, opportunism: 0.6, guardUse: 1, retreatAt: 0, pursue: 0.5, preferRange: 0, words: 'hides behind the shield' },
    counter: { id: 'counter', name: 'Counter-striker', duel: true, reaction: 0.1, patience: 2.2, spacing: 0.5, opportunism: 1, guardUse: 0.9, retreatAt: 0, pursue: 0.5, preferRange: 0, words: 'waits for your miss, and punishes it' },
    reach_keeper: { id: 'reach_keeper', name: 'Reach-keeper', duel: true, reaction: 0.12, patience: 1.2, spacing: 1, opportunism: 0.7, guardUse: 0.8, retreatAt: 0, pursue: 0.6, preferRange: 0, words: 'keeps you at its blade’s end' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
