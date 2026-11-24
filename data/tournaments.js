/* Crownless content: tournaments (P7-09). Plain classic script; no modules, no fetch.
 * Decision D-P7c: foot-melee duels in the towns that hold the great markets (the capitals and the free
 * city). One record of rules, used by js/tourney.js:
 *   hosts        the towns that hold a tournament, each every `every` days (staggered by `first` +
 *                `stagger` × its place in the list); entries are open for `openDays`
 *   fee          base + perRenown × renown, between min and max (fees rise with renown)
 *   prize        crowns for the champion and the finalist; renown; reputation with the host's owner
 *   repeat       each earlier win in the same town multiplies the prize by `factor`, never below `floor`
 *   cooldown     days before you may enter again in the same town
 *   lossRenown   renown lost when you fall in the first bout
 *   kit          the loaner tournament gear: the hero fights each bout in it, never in their own
 *   rounds       the fighter you meet in each round (quarter-final, semi-final, final): a troop's body,
 *                its numbers multiplied (hp, damage) and armour added; harder each round
 *   townWins     each earlier win in that town makes its fighters this much stronger (+8%)
 *   skill        the other fighters' skill range (decides their bouts among themselves)
 *   rivalChance  the chance your rival enters a tournament you could enter */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.tournaments = {
    lists: {
      id: 'lists',
      name: 'Tournament',
      hosts: ['stonebridge', 'eastwatch', 'hrothgard', 'vessara', 'merrow', 'gullhaven', 'harrowgate', 'calder'],
      every: 14,
      first: 4,
      stagger: 3,
      openDays: 3,
      entrants: 8,
      fee: { base: 20, perRenown: 0.5, min: 20, max: 150 },
      prize: { champion: 150, finalist: 50, renown: { champion: 5, finalist: 2 }, rep: { champion: 4, finalist: 1 } },
      repeat: { factor: 0.6, floor: 0.2 },
      cooldown: 28,
      lossRenown: 1,
      rivalRenown: 2, // besting your rival in a bout
      kit: { weapon: 'arming_sword', offhand: 'kite_shield', head: 'iron_helm', body: 'gambeson', feet: 'boots' },
      rounds: [
        { name: 'first bout', troop: 'mercenary', hp: 1.0, damage: 0.9, armor: 0 },
        { name: 'semi-final', troop: 'mercenary', hp: 1.3, damage: 1.05, armor: 1 },
        { name: 'final', troop: 'sellsword', hp: 1.25, damage: 1.1, armor: 1 }
      ],
      townWins: 0.08,
      skill: [0.8, 1.2],
      rivalChance: 0.6,
      map: 'tourney_lists'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
