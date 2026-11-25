/* Crownless content: world_parties. Plain classic script; no modules, no fetch.
 * GDD §8 "World map party agents": patrols per kingdom (W-05b: by holdings), caravans between the
 * capitals and the free city, and Reaver bands around each region's lairs. Speeds are map units per hour (the player's base is 4); detection and
 * contact distances are map units. troops: troop id → [min, max] rolled when the party spawns. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.party_templates = {
    // P8-01: the lords of Valedorn ride with their household (js/lords.js): one party a lord, sized by
    // what they hold, of the realm's own troops; the lord fights in person as a guard.
    lord_valedorn: {
      id: 'lord_valedorn',
      name: 'Valedorn Lord',
      kind: 'lord',
      faction: 'valedorn',
      hostile: false,
      count: 0, // not kept at a count: every free lord has one (js/lords.js)
      respawnDays: 0,
      speed: 3.7,
      detection: 8,
      leader: 'guard',
      reward: { goldBase: 40, goldPerKill: 5, renown: 12 },
      lootBySize: [[99, 'high']],
      text: '"Hold there. You ride on {lord}’s land: keep to the roads and keep the peace."',
      hostileText: '"There is the one the Crown has outlawed. Ride them down!"'
    },
    // P8-01: the lords of Aurelian ride with their household (js/lords.js): one party a lord, sized by
    // what they hold, of the realm's own troops; the lord fights in person as a legionary.
    lord_aurelian: {
      id: 'lord_aurelian',
      name: 'Aurelian Lord',
      kind: 'lord',
      faction: 'aurelian',
      hostile: false,
      count: 0, // not kept at a count: every free lord has one (js/lords.js)
      respawnDays: 0,
      speed: 3.7,
      detection: 8,
      leader: 'legionary',
      reward: { goldBase: 40, goldPerKill: 5, renown: 12 },
      lootBySize: [[99, 'high']],
      text: '"By the Magistracy’s law, state your business on these roads. {lord} keeps the peace here."',
      hostileText: '"The law has a warrant for you. Take them alive if you can."'
    },
    // P8-01: the lords of Hrothmark ride with their household (js/lords.js): one party a lord, sized by
    // what they hold, of the realm's own troops; the lord fights in person as a huscarl.
    lord_hrothmark: {
      id: 'lord_hrothmark',
      name: 'Hrothmark Lord',
      kind: 'lord',
      faction: 'hrothmark',
      hostile: false,
      count: 0, // not kept at a count: every free lord has one (js/lords.js)
      respawnDays: 0,
      speed: 3.7,
      detection: 8,
      leader: 'huscarl',
      reward: { goldBase: 40, goldPerKill: 5, renown: 12 },
      lootBySize: [[99, 'high']],
      text: '"A long way from home, southerner. {lord}’s hall keeps open doors to those who keep the peace."',
      hostileText: '"The King’s enemies do not walk the north. Shields up!"'
    },
    // P8-01: the lords of Vessaro ride with their household (js/lords.js): one party a lord, sized by
    // what they hold, of the realm's own troops; the lord fights in person as a pavisier.
    lord_vessaro: {
      id: 'lord_vessaro',
      name: 'Vessaro Lord',
      kind: 'lord',
      faction: 'vessaro',
      hostile: false,
      count: 0, // not kept at a count: every free lord has one (js/lords.js)
      respawnDays: 0,
      speed: 3.7,
      detection: 8,
      leader: 'pavisier',
      reward: { goldBase: 40, goldPerKill: 5, renown: 12 },
      lootBySize: [[99, 'high']],
      text: '"The League’s roads are for trade. {lord} wishes you a profitable journey, and a quiet one."',
      hostileText: '"There is a price on your head, and we mean to collect it."'
    },
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
      count: 3, // W-05b: patrols by holdings (eight)
      respawnDays: 2,
      speed: 3.6, // heavier than bands, so a band that spots them first can slip away
      detection: 7,
      home: 'greywall_fort',
      // GDD §12 "recurring small frontier clashes": some legs ride the border beat between the
      // kingdoms (map point, jittered ± jitter), where rival patrols may meet.
      frontier: { x: 106, y: 93, jitter: 4, chance: 0.15 },
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
      count: 3, // W-05b: patrols by holdings (eight)
      respawnDays: 2,
      speed: 3.6, // heavier than bands, so a band that spots them first can slip away
      detection: 7,
      home: 'ashgate_fort',
      frontier: { x: 106, y: 93, jitter: 4, chance: 0.15 },
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
    },
    // P7-05: a detachment of your own company on the map (js/detachments.js). Never spawned by itself
    // (count 0); its troops are its soldiers, and its orders are yours.
    company_detachment: {
      id: 'company_detachment',
      name: 'Your patrol',
      kind: 'detachment',
      faction: 'neutral',
      hostile: false,
      count: 0,
      respawnDays: 1,
      speed: 3.8,
      detection: 9,
      troops: { levy: [1, 1] },
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      lootBySize: [[99, 'low']],
      text: 'Your own soldiers, under the captain you sent.'
    },
    // W-05b: the wider world's bands, patrols and caravans.
    highland_raiders: {
      id: 'highland_raiders',
      name: 'Highland Raiders',
      kind: 'bandit',
      faction: 'neutral',
      hostile: true,
      count: 2,
      respawnDays: 2,
      speed: 3.8,
      detection: 9,
      lairs: ['raider_steading', 'broken_tower'],
      roam: 14,
      troops: { reaver: [2, 4], looter: [1, 3] },
      toll: { base: 25, perTroop: 5 },
      reward: { goldBase: 20, goldPerKill: 4, renown: 3 },
      lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']],
      text: 'Clanless raiders come down off the hills, axes ready.'
    },
    western_outlaws: {
      id: 'western_outlaws',
      name: 'Western Outlaws',
      kind: 'bandit',
      faction: 'neutral',
      hostile: true,
      count: 2,
      respawnDays: 2,
      speed: 3.8,
      detection: 9,
      lairs: ['outlaw_glade', 'burnt_mill'],
      roam: 14,
      troops: { looter: [3, 6], reaver: [0, 2], outlaw_huntress: [0, 2] }, // P10-09: huntresses among the western outlaws
      toll: { base: 25, perTroop: 5 },
      reward: { goldBase: 20, goldPerKill: 4, renown: 3 },
      lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']],
      text: 'Outlaws step out of the trees and spread across the road.'
    },
    eastern_deserters: {
      id: 'eastern_deserters',
      name: 'Deserters',
      kind: 'bandit',
      faction: 'neutral',
      hostile: true,
      count: 2,
      respawnDays: 2,
      speed: 3.8,
      detection: 9,
      lairs: ['deserter_camp', 'old_watchtower'],
      roam: 14,
      troops: { mercenary: [1, 3], looter: [2, 4] },
      toll: { base: 25, perTroop: 5 },
      reward: { goldBase: 20, goldPerKill: 4, renown: 3 },
      lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']],
      text: 'Deserters in stripped legion kit bar the way, more desperate than disciplined.'
    },
    southern_wreckers: {
      id: 'southern_wreckers',
      name: 'Coast Wreckers',
      kind: 'bandit',
      faction: 'neutral',
      hostile: true,
      count: 2,
      respawnDays: 2,
      speed: 3.8,
      detection: 9,
      lairs: ['wreckers_cove', 'marsh_hideout'],
      roam: 14,
      troops: { reaver: [1, 3], looter: [2, 4] },
      toll: { base: 25, perTroop: 5 },
      reward: { goldBase: 20, goldPerKill: 4, renown: 3 },
      lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']],
      text: 'Wreckers up from the coast, smelling of tar and salt, want your cargo.'
    },
    hrothmark_patrol: {
      id: 'hrothmark_patrol',
      name: 'Hrothmark Patrol',
      kind: 'patrol',
      faction: 'hrothmark',
      hostile: false,
      count: 3,
      respawnDays: 2,
      speed: 3.6,
      detection: 7,
      home: 'skarnwall',
      troops: { axeman: [3, 4], fell_archer: [2, 3], clansman: [2, 3] },
      reward: { goldBase: 20, goldPerKill: 4, renown: 6 },
      lootBySize: [[99, 'mid']],
      text: '"The clans keep these hills. Walk softly and walk on."',
      hostileText: '"There is the outlaw the king wants. Bring them down!"'
    },
    vessaro_patrol: {
      id: 'vessaro_patrol',
      name: 'Vessaro Patrol',
      kind: 'patrol',
      faction: 'vessaro',
      hostile: false,
      count: 3,
      respawnDays: 2,
      speed: 3.6,
      detection: 7,
      home: 'castel_verro',
      troops: { pikeman: [3, 4], crossbowman: [2, 3], militia: [2, 3] },
      reward: { goldBase: 20, goldPerKill: 4, renown: 6 },
      lootBySize: [[99, 'mid']],
      text: '"The League protects its roads, and the trade upon them. Good day."',
      hostileText: '"The League has a price on your head. Crossbows!"'
    },
    merrow_watch: {
      id: 'merrow_watch',
      name: 'Merrow Watch',
      kind: 'patrol',
      faction: 'merrow',
      hostile: false,
      count: 1,
      respawnDays: 2,
      speed: 3.6,
      detection: 7,
      home: 'merrow',
      troops: { mercenary: [3, 5] },
      reward: { goldBase: 20, goldPerKill: 4, renown: 6 },
      lootBySize: [[99, 'mid']],
      text: '"The city keeps the peace on its own doorstep. Spend well in Merrow."',
      hostileText: '"The Council wants a word with you. A long one."'
    },
    hrothmark_caravan: {
      id: 'hrothmark_caravan',
      name: 'Hrothmark Caravan',
      kind: 'caravan',
      faction: 'hrothmark',
      hostile: false,
      count: 1,
      respawnDays: 1,
      speed: 3,
      detection: 0,
      route: ['hrothgard', 'skarnwall', 'calvinum', 'tessaro', 'merrow'],
      goods: ['timber', 'iron'],
      troops: { clansman: [2, 4] },
      reward: { goldBase: 60, goldPerKill: 2, renown: 1 },
      lootBySize: [[99, 'low']],
      text: 'Ox-carts piled with timber and iron bars, bound for the coast.',
      hostileText: 'The drovers drop their goads and take up axes.'
    },
    vessaro_caravan: {
      id: 'vessaro_caravan',
      name: 'Vessaro Caravan',
      kind: 'caravan',
      faction: 'vessaro',
      hostile: false,
      count: 1,
      respawnDays: 1,
      speed: 3,
      detection: 0,
      route: ['vessara', 'pellio', 'sorra', 'merrow', 'castel_verro'],
      goods: ['wine', 'salt'],
      troops: { militia: [2, 4] },
      reward: { goldBase: 60, goldPerKill: 2, renown: 1 },
      lootBySize: [[99, 'low']],
      text: 'Wine casks and salt sacks on mule-back, with a few militia to mind them.',
      hostileText: 'The militia level their spears at you.'
    },
    merrow_caravan: {
      id: 'merrow_caravan',
      name: 'Merrow Caravan',
      kind: 'caravan',
      faction: 'merrow',
      hostile: false,
      count: 1,
      respawnDays: 1,
      speed: 3,
      detection: 0,
      route: ['merrow', 'tessaro', 'eastwatch', 'stonebridge', 'vessara'],
      goods: ['cloth', 'tools', 'wine'],
      troops: { mercenary: [2, 3] },
      reward: { goldBase: 60, goldPerKill: 2, renown: 1 },
      lootBySize: [[99, 'low']],
      text: 'A Merrow trading house’s wagons, guarded by hired swords who look bored.',
      hostileText: 'The hired swords earn their pay today.'
    },
    // P10-02: the coast's lords, bands, patrols and caravans, and the fells' raiders.
    lord_ostrand: { id: 'lord_ostrand', name: 'Ostrand Lord', kind: 'lord', faction: 'ostrand', hostile: false, count: 0, respawnDays: 0, speed: 3.7, detection: 8, leader: 'ostrand_shieldman', reward: { goldBase: 40, goldPerKill: 5, renown: 12 }, lootBySize: [[99, 'high']], text: '"You ride on {lord}’s land. Keep to the cliff roads and keep the peace."', hostileText: '"There is the one the King has outlawed. Ride them down!"' },
    lord_saltreach: { id: 'lord_saltreach', name: 'Saltreach Lord', kind: 'lord', faction: 'saltreach', hostile: false, count: 0, respawnDays: 0, speed: 3.7, detection: 8, leader: 'saltreach_pikeman', reward: { goldBase: 40, goldPerKill: 5, renown: 12 }, lootBySize: [[99, 'high']], text: '"The League’s roads are for trade. {lord} wishes you a quiet one."', hostileText: '"The Council has put a price on you. Take them!"' },
    coast_wreckers: { id: 'coast_wreckers', name: 'Wreckers', kind: 'bandit', faction: 'neutral', hostile: true, count: 3, respawnDays: 1.5, speed: 3.8, detection: 9, lairs: ['strand_camp', 'false_light_cove'], roam: 14, troops: { looter: [3, 6], reaver: [0, 3] }, toll: { base: 20, perTroop: 4 }, reward: { goldBase: 15, goldPerKill: 3, renown: 2 }, lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']], text: 'Wreckers off the beaches, smelling of tar and salt, want your purse.' },
    moor_deserters: { id: 'moor_deserters', name: 'Deserters', kind: 'bandit', faction: 'neutral', hostile: true, count: 2, respawnDays: 2, speed: 3.8, detection: 9, lairs: ['turncoat_camp', 'drowned_chapel'], roam: 14, troops: { mercenary: [1, 3], looter: [2, 4] }, toll: { base: 25, perTroop: 5 }, reward: { goldBase: 20, goldPerKill: 4, renown: 3 }, lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']], text: 'Deserters from both banners, with nothing left to lose but their swords.' },
    fell_raiders: { id: 'fell_raiders', name: 'Fell Raiders', kind: 'bandit', faction: 'neutral', hostile: true, count: 2, respawnDays: 1.5, speed: 3.8, detection: 9, lairs: ['gull_tor', 'fells_hollow'], roam: 14, troops: { looter: [3, 6], reaver: [0, 3] }, toll: { base: 20, perTroop: 4 }, reward: { goldBase: 15, goldPerKill: 3, renown: 2 }, lootBySize: [[6, 'low'], [10, 'mid'], [99, 'high']], text: 'Raiders down from the fells, hungry after a hard winter, want your food and your purse.' },
    ostrand_patrol: { id: 'ostrand_patrol', name: 'Ostrand Patrol', kind: 'patrol', faction: 'ostrand', hostile: false, count: 2, respawnDays: 2, speed: 3.6, detection: 7, home: 'coldkeep', frontier: { x: 274, y: 136, jitter: 4, chance: 0.15 }, troops: { ostrand_shieldman: [3, 4], ostrand_bowman: [2, 3], ostrand_levy: [2, 3] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: [[99, 'mid']], text: '"Wreckers have been seen on the strand. The King wants them gone."', hostileText: '"That is the one the King wants. Take them!"' },
    saltreach_patrol: { id: 'saltreach_patrol', name: 'Saltreach Patrol', kind: 'patrol', faction: 'saltreach', hostile: false, count: 2, respawnDays: 2, speed: 3.6, detection: 7, home: 'rookmoor', frontier: { x: 274, y: 142, jitter: 4, chance: 0.15 }, troops: { saltreach_pikeman: [3, 4], saltreach_crossbow: [2, 3], saltreach_militia: [2, 3] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: [[99, 'mid']], text: '"The League keeps its roads, and the salt upon them. Good day."', hostileText: '"The Council wants you. Pikes!"' },
    gullhaven_watch: { id: 'gullhaven_watch', name: 'Gullhaven Watch', kind: 'patrol', faction: 'gullhaven', hostile: false, count: 1, respawnDays: 2, speed: 3.6, detection: 7, home: 'gullhaven', troops: { mercenary: [3, 5] }, reward: { goldBase: 20, goldPerKill: 4, renown: 6 }, lootBySize: [[99, 'mid']], text: '"The port keeps the peace on its own doorstep. Spend well in Gullhaven."', hostileText: '"The harbour masters want a word with you. A long one."' },
    ostrand_caravan: { id: 'ostrand_caravan', name: 'Ostrand Caravan', kind: 'caravan', faction: 'ostrand', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['harrowgate', 'brindle', 'fenwick', 'thornby', 'gullhaven'], goods: ['wool', 'timber'], troops: { ostrand_levy: [2, 4] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'Carts of wool and cliff timber, bound for the port.' },
    saltreach_caravan: { id: 'saltreach_caravan', name: 'Saltreach Caravan', kind: 'caravan', faction: 'saltreach', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['calder', 'marlow', 'pennick', 'tidewell', 'gullhaven'], goods: ['salt', 'grain'], troops: { saltreach_militia: [2, 4] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'Salt sacks and grain on mule-back, with a few militia to guard them.' },
    gullhaven_caravan: { id: 'gullhaven_caravan', name: 'Gullhaven Caravan', kind: 'caravan', faction: 'gullhaven', hostile: false, count: 1, respawnDays: 1, speed: 3, detection: 0, route: ['gullhaven', 'harrowgate', 'calder', 'marlow', 'merrow', 'gullhaven'], goods: ['cloth', 'tools', 'wine'], troops: { mercenary: [2, 3] }, reward: { goldBase: 60, goldPerKill: 2, renown: 1 }, lootBySize: [[99, 'low']], text: 'A Gullhaven trading house’s wagons, guarded by hired swords.' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
