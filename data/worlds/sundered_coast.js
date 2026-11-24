/* Crownless content: the second official world, the Sundered Coast (P9-08, design §23.1). Plain classic
 * script, data only. "The Sundered Coast" is a working name: rename it here.
 *
 * A world in the world format (docs/WORLD-FORMAT.md): a manifest, the tables it gives whole, and
 * `merge`, which changes fields of the game's shared tables (the tables it does not give: items,
 * goods, skills, help, news, world events …). js/worlds.js puts it in place at boot when it is chosen.
 *
 * Two realms and a free city on a 150 × 120 map: the Kingdom of Ostrand in the north (a crown), the
 * Saltreach League in the south (a league), the Free Port of Gullhaven on the east coast, and the
 * Wreckers, its outlaws. A sandbox start: no story, nobody's errand. Its troops reuse today's art. */
(function (root) {
  root.CROWNLESS_WORLDS = root.CROWNLESS_WORLDS || {};
  var GOODS = function (grain, salt, wool, iron, cloth, tools, timber, wine, flour) {
    return { grain: grain, salt: salt, wool: wool, iron: iron, cloth: cloth, tools: tools, timber: timber, wine: wine, flour: flour };
  };
  var TOWN_GEAR = ['worn_sword', 'hand_axe', 'arming_sword', 'war_mace', 'oak_shield', 'kite_shield', 'leather_cap', 'iron_helm', 'gambeson', 'leather_chest', 'mail_hauberk', 'gloves', 'mail_mittens', 'boots', 'greaves', 'nag', 'rouncey', 'smoked_meat'];
  var PORT_GEAR = TOWN_GEAR.concat(['knights_sword', 'heater_shield', 'bascinet', 'courser']);
  var VILLAGE_GEAR = ['leather_cap', 'gambeson', 'boots', 'nag'];
  var TOWN = ['recruit', 'trade', 'rest', 'contracts', 'leave'];
  var VILLAGE = ['trade', 'rest'];
  var FORT = ['recruit', 'rest'];
  var O_GARRISON = { ostrand_shieldman: 10, ostrand_levy: 4, ostrand_bowman: 6 };
  var S_GARRISON = { saltreach_pikeman: 10, saltreach_militia: 4, saltreach_crossbow: 6 };
  var LOOT = [[99, 'mid']];

  root.CROWNLESS_WORLDS.sundered_coast = {
    manifest: { id: 'sundered_coast', title: 'The Sundered Coast', author: 'Crownless', version: '1.0.0', engine: '>=3.14.0 <5.0.0', kind: 'world', requires: [] },

    factions: {
      ostrand: { id: 'ostrand', name: 'Kingdom of Ostrand', short: 'Ostrand', emblem: 'O', order: 1, culture: 'ostrand', ruler: { male: 'King', female: 'Queen' }, color: '#3f6f9a', description: 'Cold-water lords of the northern cliffs: shieldmen and bowmen.', initialReputation: 0, recruits: ['ostrand_levy'], garrison: O_GARRISON },
      saltreach: { id: 'saltreach', name: 'Saltreach League', short: 'Saltreach', emblem: 'S', order: 2, culture: 'saltreach', ruler: { male: 'Doge', female: 'Dogaressa' }, color: '#b0782a', description: 'Salt towns of the southern flats, ruled by their council: pikes and crossbows.', laws: { power: 'league', succession: 'council', war: 'council' }, initialReputation: 0, recruits: ['saltreach_militia'], garrison: S_GARRISON },
      gullhaven: { id: 'gullhaven', name: 'Free Port of Gullhaven', short: 'Gullhaven', emblem: 'G', order: 3, freeCity: true, culture: 'border', color: '#6b5aa5', description: 'A harbour that answers to no crown: neutral, rich, and full of swords for hire.', initialReputation: 0, recruits: ['mercenary'] },
      neutral: { id: 'neutral', name: 'Wreckers', short: 'Wrecker', emblem: 'W', order: 9, lineName: 'Sell-swords and wreckers', culture: 'border', color: '#8a6d3b', description: 'Wreckers, looters and hireable swords of the coast.', initialReputation: 0, recruits: [] }
    },

    troops: {
      hero: { id: 'hero', name: 'Hero', faction: 'neutral', role: 'hero', tier: 'T1', hp: 85, damage: 18, armor: 0, speed: 142, reach: 67, wage: 0, recruitCost: 0, upgradeTo: null, upgradeCost: 0 },
      ostrand_levy: { id: 'ostrand_levy', name: 'Ostrand Levy', faction: 'ostrand', role: 'infantry', tier: 'T1', hp: 45, damage: 7, armor: 1, speed: 90, reach: 48, wage: 3, recruitCost: 15, upgradeTo: 'ostrand_shieldman', upgradeCost: 25, altUpgradeTo: 'ostrand_bowman', altUpgradeCost: 25 },
      ostrand_shieldman: { id: 'ostrand_shieldman', name: 'Shieldman', shield: true, faction: 'ostrand', role: 'infantry', tier: 'T2', hp: 62, damage: 10, armor: 4, speed: 88, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0 },
      ostrand_bowman: { id: 'ostrand_bowman', name: 'Cliff Bowman', faction: 'ostrand', role: 'archer', tier: 'T2', hp: 58, damage: 10, armor: 2, speed: 84, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0, ranged: { projectileSpeed: 240, range: 230, cooldown: 1.6, accuracy: 0.6 } },
      saltreach_militia: { id: 'saltreach_militia', name: 'Salt Militia', faction: 'saltreach', role: 'infantry', tier: 'T1', hp: 44, damage: 7, armor: 1, speed: 92, reach: 48, wage: 3, recruitCost: 15, upgradeTo: 'saltreach_pikeman', upgradeCost: 25, altUpgradeTo: 'saltreach_crossbow', altUpgradeCost: 25 },
      saltreach_pikeman: { id: 'saltreach_pikeman', name: 'Flats Pikeman', brace: true, faction: 'saltreach', role: 'infantry', tier: 'T2', hp: 58, damage: 11, armor: 3, speed: 88, reach: 72, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0 },
      saltreach_crossbow: { id: 'saltreach_crossbow', name: 'League Crossbow', faction: 'saltreach', role: 'archer', tier: 'T2', hp: 58, damage: 13, armor: 2, speed: 84, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0, ranged: { projectileSpeed: 300, range: 240, cooldown: 2.2, accuracy: 0.7 } },
      mercenary: { id: 'mercenary', name: 'Mercenary', shield: true, faction: 'neutral', culture: 'border', role: 'infantry', tier: 'T2', hp: 60, damage: 10, armor: 3, speed: 92, reach: 48, wage: 6, recruitCost: 25, upgradeTo: 'sellsword', upgradeCost: 60 },
      sellsword: { id: 'sellsword', name: 'Sellsword', shield: true, faction: 'neutral', culture: 'border', role: 'infantry', tier: 'T3', hp: 80, damage: 15, armor: 5, speed: 92, reach: 48, wage: 14, recruitCost: 60, upgradeTo: null, upgradeCost: 0 },
      looter: { id: 'looter', name: 'Looter', faction: 'neutral', role: 'infantry', tier: 'T1', hp: 45, damage: 7, armor: 1, speed: 90, reach: 48, wage: 3, recruitCost: 15, upgradeTo: null, upgradeCost: 0 },
      reaver: { id: 'reaver', name: 'Wrecker', faction: 'neutral', role: 'infantry', tier: 'T2', hp: 60, damage: 10, armor: 3, speed: 90, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0 }
    },

    settlements: {
      gullhaven: { id: 'gullhaven', name: 'Gullhaven', type: 'town', ownerFaction: 'gullhaven', explorable: false, services: TOWN, mapX: 138, mapY: 62, market: GOODS(1, 0.9, 1, 1, 0.9, 0.9, 1.05, 0.9, 1.1), gear: PORT_GEAR },
      harrowgate: { id: 'harrowgate', name: 'Harrowgate', type: 'town', ownerFaction: 'ostrand', explorable: false, services: TOWN, mapX: 40, mapY: 25, market: GOODS(1, 1.2, 0.85, 0.95, 1.05, 1, 0.9, 1.2, 1.05), gear: TOWN_GEAR },
      coldkeep: { id: 'coldkeep', name: 'Coldkeep', type: 'fort', ownerFaction: 'ostrand', explorable: false, services: FORT, mapX: 75, mapY: 42, garrison: O_GARRISON },
      whitecliff: { id: 'whitecliff', name: 'Whitecliff Hold', placeName: 'Whitecliff', type: 'fort', ownerFaction: 'ostrand', explorable: false, services: FORT, mapX: 110, mapY: 20, garrison: O_GARRISON },
      brindle: { id: 'brindle', name: 'Brindle', type: 'village', ownerFaction: 'ostrand', seat: 'harrowgate', explorable: false, services: VILLAGE, mapX: 22, mapY: 14, market: GOODS(0.85, 1.3, 0.8, 1.2, 1.2, 1.25, 0.9, 1.3, 0.95), gear: VILLAGE_GEAR },
      fenwick: { id: 'fenwick', name: 'Fenwick', type: 'village', ownerFaction: 'ostrand', seat: 'coldkeep', explorable: false, services: VILLAGE, mapX: 60, mapY: 30, market: GOODS(0.8, 1.25, 0.9, 1.3, 1.2, 1.2, 0.95, 1.25, 0.9), gear: VILLAGE_GEAR },
      thornby: { id: 'thornby', name: 'Thornby', type: 'village', ownerFaction: 'ostrand', seat: 'whitecliff', explorable: false, services: VILLAGE, mapX: 120, mapY: 36, market: GOODS(0.9, 1.1, 0.85, 1.25, 1.15, 1.2, 0.85, 1.2, 1), gear: VILLAGE_GEAR },
      calder: { id: 'calder', name: 'Calder', type: 'town', ownerFaction: 'saltreach', explorable: false, services: TOWN, mapX: 45, mapY: 94, market: GOODS(1.05, 0.85, 1.1, 1.15, 0.95, 1, 1.2, 0.95, 1.1), gear: TOWN_GEAR },
      rookmoor: { id: 'rookmoor', name: 'Rookmoor', type: 'fort', ownerFaction: 'saltreach', explorable: false, services: FORT, mapX: 72, mapY: 76, garrison: S_GARRISON },
      seagate: { id: 'seagate', name: 'Seagate', type: 'fort', ownerFaction: 'saltreach', explorable: false, services: FORT, mapX: 112, mapY: 100, garrison: S_GARRISON },
      marlow: { id: 'marlow', name: 'Marlow', type: 'village', ownerFaction: 'saltreach', seat: 'calder', explorable: false, services: VILLAGE, mapX: 22, mapY: 104, market: GOODS(0.85, 0.8, 1.2, 1.3, 1.1, 1.25, 1.25, 1, 0.95), gear: VILLAGE_GEAR },
      pennick: { id: 'pennick', name: 'Pennick', type: 'village', ownerFaction: 'saltreach', seat: 'rookmoor', explorable: false, services: VILLAGE, mapX: 88, mapY: 88, market: GOODS(0.9, 0.8, 1.15, 1.25, 1.1, 1.2, 1.2, 1.05, 1), gear: VILLAGE_GEAR },
      tidewell: { id: 'tidewell', name: 'Tidewell', type: 'village', ownerFaction: 'saltreach', seat: 'seagate', explorable: false, services: VILLAGE, mapX: 128, mapY: 110, market: GOODS(0.95, 0.8, 1.1, 1.3, 1, 1.25, 1.3, 0.9, 1.05), gear: VILLAGE_GEAR }
    },

    encounters: {
      looter_band: { id: 'looter_band', name: 'Looter Band', enemyFaction: 'neutral', map: 'open_country', waves: [{ looter: 3 }, { looter: 4 }], reward: { goldBase: 20, goldPerKill: 3, renown: 2 }, loot: 'low' },
      wrecker_crew: { id: 'wrecker_crew', name: 'Wrecker Crew', enemyFaction: 'neutral', map: 'forest_wilds', waves: [{ looter: 4, reaver: 2 }, { looter: 5, reaver: 3 }], reward: { goldBase: 52, goldPerKill: 3, renown: 4 }, loot: 'mid' },
      deserter_band: { id: 'deserter_band', name: 'Deserters', enemyFaction: 'neutral', map: 'open_country', waves: [{ mercenary: 3, looter: 3 }, { mercenary: 2, reaver: 3 }], reward: { goldBase: 55, goldPerKill: 4, renown: 4 }, loot: 'mid' }
    },

    party_templates: {
      lord_ostrand: { id: 'lord_ostrand', name: 'Ostrand Lord', kind: 'lord', faction: 'ostrand', hostile: false, count: 0, respawnDays: 0, speed: 3.7, detection: 8, leader: 'ostrand_shieldman', reward: { goldBase: 40, goldPerKill: 5, renown: 12 }, lootBySize: [[99, 'high']], text: '"You ride on {lord}’s land. Keep to the cliff roads and keep the peace."', hostileText: '"There is the one the King has outlawed. Ride them down!"' },
      lord_saltreach: { id: 'lord_saltreach', name: 'Saltreach Lord', kind: 'lord', faction: 'saltreach', hostile: false, count: 0, respawnDays: 0, speed: 3.7, detection: 8, leader: 'saltreach_pikeman', reward: { goldBase: 40, goldPerKill: 5, renown: 12 }, lootBySize: [[99, 'high']], text: '"The League’s roads are for trade. {lord} wishes you a quiet one."', hostileText: '"The Council has put a price on you. Take them!"' },
      bandits: { id: 'bandits', name: 'Wreckers', kind: 'bandit', faction: 'neutral', hostile: true, count: 3, respawnDays: 1.5, speed: 3.8, detection: 9, lairs: ['looter_camp', 'wreckers_cove'], roam: 14, troops: { looter: [3, 6], reaver: [0, 3] }, toll: { base: 20, perTroop: 4 }, reward: { goldBase: 15, goldPerKill: 3, renown: 2 }, lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']], text: 'Wreckers off the beaches, smelling of tar and salt, want your purse.' },
      moor_deserters: { id: 'moor_deserters', name: 'Deserters', kind: 'bandit', faction: 'neutral', hostile: true, count: 2, respawnDays: 2, speed: 3.8, detection: 9, lairs: ['deserter_camp', 'drowned_chapel'], roam: 14, troops: { mercenary: [1, 3], looter: [2, 4] }, toll: { base: 25, perTroop: 5 }, reward: { goldBase: 20, goldPerKill: 4, renown: 3 }, lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']], text: 'Deserters from both banners, with nothing left to lose but their swords.' },
      ostrand_patrol: { id: 'ostrand_patrol', name: 'Ostrand Patrol', kind: 'patrol', faction: 'ostrand', hostile: false, count: 2, respawnDays: 2, speed: 3.6, detection: 7, home: 'coldkeep', frontier: { x: 74, y: 56, jitter: 4, chance: 0.15 }, troops: { ostrand_shieldman: [3, 4], ostrand_bowman: [2, 3], ostrand_levy: [2, 3] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: LOOT, text: '"Wreckers have been seen on the strand. The King wants them gone."', hostileText: '"That is the one the King wants. Take them!"' },
      saltreach_patrol: { id: 'saltreach_patrol', name: 'Saltreach Patrol', kind: 'patrol', faction: 'saltreach', hostile: false, count: 2, respawnDays: 2, speed: 3.6, detection: 7, home: 'rookmoor', frontier: { x: 74, y: 62, jitter: 4, chance: 0.15 }, troops: { saltreach_pikeman: [3, 4], saltreach_crossbow: [2, 3], saltreach_militia: [2, 3] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: LOOT, text: '"The League keeps its roads, and the salt upon them. Good day."', hostileText: '"The Council wants you. Pikes!"' },
      gullhaven_watch: { id: 'gullhaven_watch', name: 'Gullhaven Watch', kind: 'patrol', faction: 'gullhaven', hostile: false, count: 1, respawnDays: 2, speed: 3.6, detection: 7, home: 'gullhaven', troops: { mercenary: [3, 5] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: LOOT, text: '"The port keeps the peace on its own doorstep. Spend well in Gullhaven."', hostileText: '"The harbour masters want a word with you. A long one."' },
      ostrand_caravan: { id: 'ostrand_caravan', name: 'Ostrand Caravan', kind: 'caravan', faction: 'ostrand', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['harrowgate', 'brindle', 'fenwick', 'thornby', 'gullhaven'], goods: ['wool', 'timber'], troops: { ostrand_levy: [2, 4] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'Carts of wool and cliff timber, bound for the port.' },
      saltreach_caravan: { id: 'saltreach_caravan', name: 'Saltreach Caravan', kind: 'caravan', faction: 'saltreach', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['calder', 'marlow', 'pennick', 'tidewell', 'gullhaven'], goods: ['salt', 'grain'], troops: { saltreach_militia: [2, 4] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'Salt sacks and grain on mule-back, with a few militia to guard them.' },
      gullhaven_caravan: { id: 'gullhaven_caravan', name: 'Gullhaven Caravan', kind: 'caravan', faction: 'gullhaven', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['gullhaven', 'harrowgate', 'calder', 'gullhaven'], goods: ['cloth', 'tools', 'wine'], troops: { mercenary: [2, 3] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'A Gullhaven trading house’s wagons, guarded by hired swords.' },
      company_detachment: { id: 'company_detachment', name: 'Your patrol', kind: 'detachment', faction: 'neutral', hostile: false, count: 0, respawnDays: 1, speed: 3.8, detection: 9, troops: { looter: [1, 1] }, reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, lootBySize: [[99, 'low']], text: 'Your own soldiers, under the captain you sent.' }
    },

    cultures: {
      ostrand: { id: 'ostrand', name: 'Ostrand', about: 'Cliff folk of the cold north coast: hard, short names.', given: ['Hakon', 'Eirik', 'Torvald', 'Ulf', 'Ragnar', 'Sten', 'Arne', 'Brand', 'Gunnar', 'Leif', 'Orm', 'Vidar'], givenFemale: ['Astrid', 'Sigrid', 'Ingrid', 'Thora', 'Ragna', 'Gudrun', 'Helga', 'Liv'], trades: ['Netter', 'Cooper', 'Smith', 'Salter', 'Fowler', 'Wright'], epithets: ['Cliffborn', 'the Grim', 'Saltbeard', 'Gull-Eye', 'Ironhand', 'the Quiet'], forms: [{ pattern: '{given} of {origin}', weight: 3 }, { pattern: '{given} {epithet}', weight: 3 }, { pattern: '{given} {trade}', weight: 2 }, { pattern: '{given}', weight: 1 }] },
      saltreach: { id: 'saltreach', name: 'Saltreach', about: 'Salt-pan towns of the southern flats: long, lilting names.', given: ['Aurelio', 'Benedetto', 'Cosimo', 'Dario', 'Emilio', 'Fausto', 'Guido', 'Lorenzo', 'Marco', 'Nero', 'Piero', 'Tullio'], givenFemale: ['Bianca', 'Chiara', 'Donata', 'Fiora', 'Giulia', 'Lucia', 'Nella', 'Serena'], trades: ['Salaro', 'Fabbro', 'Mercante', 'Barcaiolo', 'Tessitore'], epithets: ['il Rosso', 'the Salt', 'Quickhand', 'il Vecchio', 'the Thrifty'], forms: [{ pattern: '{given} of {origin}', weight: 4 }, { pattern: '{given} {epithet}', weight: 2 }, { pattern: '{given} {trade}', weight: 2 }, { pattern: '{given}', weight: 1 }] },
      border: { id: 'border', name: 'Coast folk', about: 'Harbour people, wreckers and sell-swords: short plain names and nicknames.', given: ['Tam', 'Wat', 'Hob', 'Jory', 'Bran', 'Kit', 'Dell', 'Rook', 'Fenn', 'Corrie', 'Abe', 'Lew'], givenFemale: ['Nell', 'Moll', 'Tess', 'Bet', 'Wenna', 'Ysolt', 'Gwen', 'Pell'], epithets: ['Crowfoot', 'Mudlark', 'Two-Knives', 'Ferryman', 'Saltback', 'No-Thumbs', 'Lucky', 'Ditchwater', 'Owl'], forms: [{ pattern: '{given} {epithet}', weight: 5 }, { pattern: '{given} of {origin}', weight: 2 }, { pattern: '{given}', weight: 2 }] }
    },

    // A sandbox: no story and no walkable town.
    quests: {},
    dialogue: {},
    town_hubs: {},

    world_map: {
      sundered_coast: {
        id: 'sundered_coast',
        name: 'The Sundered Coast',
        sandbox: true,
        start: 'gullhaven',
        bounds: { w: 150, h: 120 },
        factions: ['ostrand', 'saltreach', 'gullhaven'],
        outlaws: 'neutral',
        relations: [{ between: ['ostrand', 'saltreach'], state: 'war' }],
        simulation: { partiesPerRegion: 12 },
        armies: { households: 3, garrisons: 3, beyondHome: 2.5 },
        regions: {
          north: { name: 'the northern cliffs', x: 0, y: 0, w: 132, h: 58, home: true },
          south: { name: 'the salt flats', x: 0, y: 58, w: 132, h: 62, home: true },
          port: { name: 'the Gullhaven shore', x: 132, y: 0, w: 18, h: 120 }
        },
        view: { zoom: 1 },
        baseSpeed: 4,
        terrain: { road: 1.2, grass: 1, forest: 0.75, hills: 0.8, mountain: 0.4, marsh: 0.5, river: 0.3, ford: 0.8, bridge: 1 },
        battleMaps: { forest: 'forest_wilds', hills: 'hill_slopes', mountain: 'hill_slopes', marsh: 'forest_wilds', river: 'river_ford', ford: 'river_ford', open: 'open_country', fort: 'greywall_courtyard' },
        areas: [
          { kind: 'mountain', poly: [[82, 4], [100, 4], [104, 16], [96, 26], [84, 22]] },
          { kind: 'hills', poly: [[4, 30], [30, 32], [28, 48], [6, 46]] },
          { kind: 'marsh', poly: [[50, 104], [80, 102], [84, 116], [52, 118]] }
        ],
        waters: [{ line: [[0, 60], [40, 57], [74, 59], [104, 60], [132, 63]], width: 1.2, crossings: [{ kind: 'bridge', x: 73.6, y: 59, r: 2.5 }, { kind: 'ford', x: 30, y: 57.6, r: 2 }, { kind: 'ford', x: 118, y: 61.5, r: 2 }] }],
        coast: ['east'],
        roadWidth: 1.6,
        time: { battle: 4, capture: 12, rest: 24 },
        roads: [
          ['brindle', 'harrowgate', 'fenwick', 'coldkeep', 'whitecliff', 'thornby', 'gullhaven'],
          ['marlow', 'calder', 'rookmoor', 'pennick', 'seagate', 'tidewell', 'gullhaven'],
          ['coldkeep', 'rookmoor'],
          ['harrowgate', 'calder']
        ],
        river: [],
        forests: [[[50, 8], [66, 6], [70, 18], [54, 20]], [[92, 70], [108, 68], [110, 84], [94, 86]], [[8, 70], [26, 68], [28, 84], [10, 86]]],
        hills: [[16, 38], [24, 42]],
        sites: {
          looter_camp: { id: 'looter_camp', name: 'Looter Camp', mapX: 128, mapY: 50, encounter: 'looter_band', respawnDays: 2, text: 'A handful of ragged looters squat by the coast road, waiting for easy prey. A fair first test for a lone sword.' },
          wreckers_cove: { id: 'wreckers_cove', name: 'Wreckers’ Cove', mapX: 142, mapY: 88, encounter: 'wrecker_crew', respawnDays: 3, text: 'False lights on the rocks and a beach full of other people’s cargo.' },
          deserter_camp: { id: 'deserter_camp', name: 'Deserter Camp', mapX: 50, mapY: 66, encounter: 'deserter_band', respawnDays: 3, text: 'Men of both banners who walked away from the river war, and kept their swords.' },
          drowned_chapel: { id: 'drowned_chapel', name: 'Drowned Chapel', mapX: 66, mapY: 110, encounter: 'wrecker_crew', respawnDays: 3, text: 'A chapel the marsh took back, and the wreckers took after it.' }
        },
        nobles: [
          { id: 'hakon_vargr', name: 'Hakon Vargr', gender: 'male', realm: 'ostrand', ruler: true, home: 'harrowgate', holds: ['harrowgate', 'brindle'], kin: [{ id: 'sigrid_vargr', tie: 'child' }], traits: 'stern, proud, slow to forgive' },
          { id: 'sigrid_vargr', name: 'Sigrid Vargr', gender: 'female', realm: 'ostrand', home: 'harrowgate', holds: [], kin: [{ id: 'hakon_vargr', tie: 'parent' }], traits: 'bold, restless, quick to anger' },
          { id: 'torvald_hask', name: 'Torvald Hask', gender: 'male', realm: 'ostrand', home: 'coldkeep', holds: ['coldkeep', 'fenwick'], kin: [], traits: 'watchful, patient, a hard border lord' },
          { id: 'ingrid_skarde', name: 'Ingrid Skarde', gender: 'female', realm: 'ostrand', home: 'whitecliff', holds: ['whitecliff', 'thornby'], kin: [], traits: 'shrewd, generous, keeps her word' },
          { id: 'piero_salaro', name: 'Piero Salaro', gender: 'male', realm: 'saltreach', ruler: true, home: 'calder', holds: ['calder', 'marlow'], kin: [{ id: 'lucia_salaro', tie: 'sibling' }], traits: 'careful, greedy, a born trader' },
          { id: 'lucia_salaro', name: 'Lucia Salaro', gender: 'female', realm: 'saltreach', home: 'calder', holds: [], kin: [{ id: 'piero_salaro', tie: 'sibling' }], traits: 'clever, ambitious, smiles too easily' },
          { id: 'guido_ferro', name: 'Guido Ferro', gender: 'male', realm: 'saltreach', home: 'rookmoor', holds: ['rookmoor', 'pennick'], kin: [], traits: 'brave, blunt, loyal to the Council' },
          { id: 'chiara_vento', name: 'Chiara Vento', gender: 'female', realm: 'saltreach', home: 'seagate', holds: ['seagate', 'tidewell'], kin: [], traits: 'cold, capable, trusts nobody' }
        ]
      }
    },

    // The shared tables, changed for this world: the refugees of a war here are this world's levies;
    // the retinue's homes and the lists' hosts are its places.
    merge: {
      tournaments: { lists: { hosts: ['gullhaven', 'harrowgate', 'calder'] } },
      world_events: { refugees: { recruit: 'ostrand_levy' } },
      companions: { sigrun: { home: 'harrowgate' }, iacopo: { home: 'calder' }, livia: { home: 'gullhaven' } }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
