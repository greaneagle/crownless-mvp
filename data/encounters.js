/* Crownless content: encounters. Plain classic script; no modules, no fetch.
 * A battle definition: map, enemy waves (troop id → count), rewards and loot.
 * Loot: each enemy killed gives one roll at `chancePerKill`; a roll picks one entry by weight. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.encounters = {
    looter_band: {
      id: 'looter_band',
      name: 'Looter Band',
      enemyFaction: 'neutral',
      map: 'grass_field',
      waves: [
        { looter: 3 },
        { looter: 4 }
      ],
      reward: { goldBase: 20, goldPerKill: 3, renown: 2 },
      loot: {
        chancePerKill: 0.3,
        table: [
          { item: 'food_3_days', weight: 6 },
          { item: 'clothing', weight: 4 },
          { item: 'boots', weight: 3 },
          { item: 'gloves', weight: 3 },
          { item: 'iron_helm', weight: 1 }
        ]
      }
    },
    captains_trial: {
      id: 'captains_trial',
      name: "The Captain's Trial",
      enemyFaction: 'neutral',
      map: 'grass_field',
      waves: [
        { looter: 4, reaver: 2 },
        { looter: 6, reaver: 2 }
      ],
      reward: { goldBase: 52, goldPerKill: 3, renown: 4 },
      loot: {
        chancePerKill: 0.3,
        table: [
          { item: 'food_3_days', weight: 6 },
          { item: 'clothing', weight: 4 },
          { item: 'boots', weight: 3 },
          { item: 'gloves', weight: 3 },
          { item: 'worn_sword', weight: 3 },
          { item: 'leather_chest', weight: 2 },
          { item: 'arming_sword', weight: 1 },
          { item: 'iron_helm', weight: 1 },
          { item: 'oak_shield', weight: 1 }
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
