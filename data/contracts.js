/* Crownless content: contracts. Plain classic script; no modules, no fetch.
 * GDD §4 "Repeatable work": templates vary target and reward, without procedural dialogue.
 * Offered in settlements with the 'contracts' service. Gate C ships the bandit hunt; escort and
 * delivery templates arrive in Gate D on the same lifecycle (js/contracts.js).
 *   strength: target band power as a multiple of the player's power when offered, [min, max]
 *   reward:   gold = goldBase + goldPerTroop × band size; renown; hero XP = xpBase + xpPerTroop × size */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.contracts = {
    bandit_hunt: {
      id: 'bandit_hunt',
      name: 'Bandit Hunt',
      kind: 'hunt',
      band: 'bandits',
      troopPool: ['looter', 'reaver'],
      minTroops: 3,
      maxTroops: 14,
      strength: [0.7, 1.2],
      distance: [10, 17],
      timeLimitDays: 4,
      reward: { goldBase: 40, goldPerTroop: 6, renown: 5, xpBase: 40, xpPerTroop: 5 },
      failRenown: 2,
      offer: 'Reavers have been raiding the farms nearby. Hunt down their band and you will be paid for every head of it.',
      done: 'The band is broken. Return to {giver} to collect your pay.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
