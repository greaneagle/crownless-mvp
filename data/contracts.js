/* Crownless content: contracts. Plain classic script; no modules, no fetch.
 * GDD §4 "Repeatable work": templates vary target and reward, without procedural dialogue.
 * Offered in settlements with the 'contracts' service, one offer per template on each board, all on
 * the same lifecycle (js/contracts.js). GDD §4: bandit hunt, escort, delivery.
 *   strength: target band power as a multiple of the player's power when offered, [min, max]
 *   reward:   gold = goldBase + goldPerTroop × band size (hunts) or goldPerLeague × distance (escort,
 *             delivery); renown; hero XP = xpBase + xpPerTroop × size or xpPerLeague × distance
 *   distance: map units from the giver — the camp (hunts) or the destination (escort, delivery)
 *   Escort: a marked caravan rolls toward the destination only while the player stays within
 *     escortRange; a Reaver ambush (ambushStrength) waits on the route. Paid on arrival.
 *   Delivery: goods (qty of one trade good, a refundable deposit at their value) or a sealed message
 *     (letterChance); delivered by entering the destination. Paid on arrival.
 *   board: false (P9-02): never rolled for a board; posted by the game itself (the envoy).
 *   standing: the standing with the giver's realm when it is paid (default the usual for helping).
 *   Envoy (P9-02): a realm's offer of a treaty, carried as a sealed letter from its capital to the
 *     other realm's; posted only for a vassal of the realm (js/diplomacy.js). */
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
    },
    escort: {
      id: 'escort',
      name: 'Caravan Escort',
      kind: 'escort',
      band: 'bandits',
      troopPool: ['looter', 'reaver'],
      minTroops: 3,
      maxTroops: 10,
      ambushStrength: [0.5, 0.9],
      distance: [12, 32],
      escortRange: 6,
      timeLimitDays: 4,
      reward: { goldBase: 30, goldPerLeague: 3, renown: 4, xpBase: 30, xpPerLeague: 2 },
      failRenown: 2,
      offer: 'A merchant wagon needs a sword beside it as far as {to}, and the Reavers know the road.',
      done: 'The caravan rolls safely into {to}. The drivers pay you on the spot.'
    },
    delivery: {
      id: 'delivery',
      name: 'Delivery',
      kind: 'delivery',
      distance: [12, 40],
      goodsQty: [3, 5],
      letterChance: 0.4,
      timeLimitDays: 5,
      reward: { goldBase: 20, goldPerLeague: 2, renown: 2, xpBase: 20, xpPerLeague: 1 },
      failRenown: 2,
      offer: 'A load needs carrying to {to}, and the carters are all on the road already.',
      offerLetter: 'A sealed letter must reach {to}, unopened. Speed matters more than strength.',
      done: 'Delivered to {to}. You are paid on the spot.'
    },
    envoy: {
      id: 'envoy',
      name: 'Envoy',
      kind: 'delivery',
      board: false,
      distance: [0, 999],
      goodsQty: [1, 1],
      letterChance: 1,
      timeLimitDays: 6,
      reward: { goldBase: 60, goldPerLeague: 0, renown: 0, xpBase: 20, xpPerLeague: 0 },
      standing: 5,
      failRenown: 2,
      offer: 'The Crown needs an envoy: carry its offer of {treaty} to {to}, and speak for it there.',
      offerLetter: 'The Crown needs an envoy: carry its offer of {treaty} to {to}, and speak for it there.',
      done: 'You put the Crown’s offer before the court of {to}, and are paid for the ride.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
