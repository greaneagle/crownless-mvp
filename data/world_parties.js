/* Crownless content: world_parties. Plain classic script; no modules, no fetch.
 * GDD §8 "World map party agents": two patrols per faction, one caravan per faction, up to three
 * bandit parties. Speeds are map units per hour (the player's base is 4); detection and
 * contact distances are map units. troops: troop id → [min, max] rolled when the party spawns. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.party_templates = {
    bandits: {
      id: 'bandits',
      name: 'Road Reavers',
      kind: 'bandit',
      faction: 'neutral',
      hostile: true,
      count: 3,
      respawnDays: 1.5,
      speed: 3.8,
      detection: 9,
      lairs: ['looter_camp', 'reaver_hideout'],
      roam: 14,
      troops: { looter: [3, 6], reaver: [0, 3] },
      toll: { base: 20, perTroop: 4 },
      reward: { goldBase: 15, goldPerKill: 3, renown: 2 },
      // Loot tier by band size: up to 6 → low, up to 10 → mid, larger → high (data/items.js).
      lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']],
      text: 'A ragged band of Road Reavers blocks the way, blades out.'
    },
    valedorn_patrol: {
      id: 'valedorn_patrol',
      name: 'Valedorn Patrol',
      kind: 'patrol',
      faction: 'valedorn',
      hostile: false,
      count: 2,
      respawnDays: 2,
      speed: 3.6, // heavier than bands, so a band that spots them first can slip away
      detection: 7,
      home: 'greywall_fort',
      troops: { footman: [3, 4], hunter: [2, 3], levy: [2, 3] },
      // Attacking a kingdom's patrol or caravan costs 15 reputation with it (GDD §10); a Hostile kingdom's patrols hunt you.
      reward: { goldBase: 20, goldPerKill: 4, renown: 6 },
      lootBySize: [[99, 'mid']],
      text: '"Keep to the roads, wanderer. Reavers have been seen in the hills, and the Crown wants them gone."',
      hostileText: '"That is the one the Crown wants. Take them!" The patrol closes in, lances lowered.'
    },
    aurelian_patrol: {
      id: 'aurelian_patrol',
      name: 'Aurelian Patrol',
      kind: 'patrol',
      faction: 'aurelian',
      hostile: false,
      count: 2,
      respawnDays: 2,
      speed: 3.6, // heavier than bands, so a band that spots them first can slip away
      detection: 7,
      home: 'ashgate_fort',
      troops: { spearman: [3, 4], skirmisher: [2, 3], recruit: [2, 3] },
      reward: { goldBase: 20, goldPerKill: 4, renown: 6 },
      lootBySize: [[99, 'mid']],
      text: '"Imperial law still holds east of the river. Travel peacefully and you will have no trouble from us."',
      hostileText: '"By imperial law, you are under arrest." The patrol spreads out to cut off your road.'
    },
    valedorn_caravan: {
      id: 'valedorn_caravan',
      name: 'Valedorn Caravan',
      kind: 'caravan',
      faction: 'valedorn',
      hostile: false,
      count: 1,
      respawnDays: 1,
      speed: 3,
      detection: 0,
      route: ['stonebridge', 'oakford', 'highmere', 'brackenfield'],
      goods: ['grain', 'wool'],
      troops: { levy: [2, 4] },
      reward: { goldBase: 60, goldPerKill: 2, renown: 1 },
      lootBySize: [[99, 'low']],
      text: 'Wagons heavy with grain and wool creak along under a few nervous guards.',
      hostileText: 'The guards draw steel as soon as they see your banner.'
    },
    aurelian_caravan: {
      id: 'aurelian_caravan',
      name: 'Aurelian Caravan',
      kind: 'caravan',
      faction: 'aurelian',
      hostile: false,
      count: 1,
      respawnDays: 1,
      speed: 3,
      detection: 0,
      route: ['eastwatch', 'redfield', 'saltmere', 'dunmarsh'],
      goods: ['salt', 'cloth'],
      troops: { recruit: [2, 4] },
      reward: { goldBase: 60, goldPerKill: 2, renown: 1 },
      lootBySize: [[99, 'low']],
      text: 'A string of mules laden with salt and bolts of cloth, watched over by a handful of recruits.',
      hostileText: 'The recruits form a nervous line in front of the mules.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
