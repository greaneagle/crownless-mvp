/* Crownless content: encounters. Plain classic script; no modules, no fetch.
 * A battle definition: map, enemy waves (troop id → count), rewards and loot.
 * loot: a tier table id from data/items.js (low / mid / high). Each enemy killed gives one roll at the
 * table's chancePerKill; a roll picks one entry by weight. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.encounters = {
    looter_band: {
      id: 'looter_band',
      name: 'Looter Band',
      enemyFaction: 'neutral',
      map: 'open_country',
      waves: [
        { looter: 3 },
        { looter: 4 }
      ],
      reward: { goldBase: 20, goldPerKill: 3, renown: 2 },
      loot: 'low'
    },
    captains_trial: {
      id: 'captains_trial',
      name: "The Captain's Trial",
      enemyFaction: 'neutral',
      map: 'forest_wilds',
      waves: [
        { looter: 4, reaver: 2 },
        { looter: 6, reaver: 2 }
      ],
      reward: { goldBase: 52, goldPerKill: 3, renown: 4 },
      loot: 'mid'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
