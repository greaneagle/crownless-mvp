/* Crownless content: troops. Plain classic script; no modules, no fetch.
 * Distances (reach, ranged.range) and speeds are in battle-canvas pixels, which are
 * drawn ~3x larger than the GDD's 16px-tile figures. 'hero' is the player's own body.
 * P10-09 (D-P10d): women soldiers, in two realms and one band, no more. `gender: 'female'` marks a
 * woman's troop (her name from her culture's women's names); her line upgrades into her own line.
 * `women: { troop, share }` on a realm's first recruit: hiring it brings, in `share` of hires (drawn
 * from the campaign's own 'recruits' roll), that woman's troop instead.
 * P10-G1 (D-P10k): every troop's `look`, below: what the art kit draws it wearing and carrying (the
 * vocabulary is CL.content.LOOK). The realm's colours come from the side it fights for. A look agrees
 * with the troop: a shield only with `shield`, a spear or pike for long reach, a bow or a crossbow by
 * the shot, a mount for cavalry (the content checks hold it). Faces, skin and hair vary by soldier. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.troops = {
    levy: {id:'levy',name:'Levy',faction:'valedorn',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:'footman',upgradeCost:25,altUpgradeTo:'hunter',altUpgradeCost:25},
    footman: {id:'footman',name:'Footman',shield:true,faction:'valedorn',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:90,reach:48,wage:6,recruitCost:25,upgradeTo:'guard',upgradeCost:60,altUpgradeTo:'rider',altUpgradeCost:90},
    guard: {id:'guard',name:'Guard',shield:true,faction:'valedorn',role:'infantry',tier:'T3',hp:80,damage:14,armor:6,speed:90,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    hunter: {id:'hunter',name:'Hunter',faction:'valedorn',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'longbowman',upgradeCost:60,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    longbowman: {id:'longbowman',name:'Longbowman',faction:'valedorn',role:'archer',tier:'T3',hp:80,damage:14,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    rider: {id:'rider',name:'Rider',faction:'valedorn',role:'cavalry',tier:'T3',hp:90,damage:14,armor:6,speed:135,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    recruit: {id:'recruit',name:'Recruit',faction:'aurelian',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:'spearman',upgradeCost:25,altUpgradeTo:'skirmisher',altUpgradeCost:25},
    spearman: {id:'spearman',name:'Spearman',brace:true,faction:'aurelian',role:'infantry',tier:'T2',hp:60,damage:11,armor:3,speed:88,reach:70,wage:6,recruitCost:25,upgradeTo:'legionary',upgradeCost:60,altUpgradeTo:'horse_scout',altUpgradeCost:90},
    legionary: {id:'legionary',name:'Legionary',shield:true,brace:true,faction:'aurelian',role:'infantry',tier:'T3',hp:80,damage:14,armor:6,speed:90,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    skirmisher: {id:'skirmisher',name:'Skirmisher',faction:'aurelian',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'marksman',upgradeCost:60,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    marksman: {id:'marksman',name:'Marksman',faction:'aurelian',role:'archer',tier:'T3',hp:80,damage:14,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    horse_scout: {id:'horse_scout',name:'Horse Scout',faction:'aurelian',role:'cavalry',tier:'T3',hp:90,damage:14,armor:6,speed:135,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    // W-05b (decision D-W3): two new kingdoms' tier 1–3 trees, each with a cavalry branch. Hrothmark's
    // northern foot is heavy and slow (more armour, axes hit hard); the Vessaro League's crossbows
    // hit hard but load slowly, and its light horse are fast but thin-skinned.
    clansman: {id:'clansman',name:'Clansman',faction:'hrothmark',role:'infantry',tier:'T1',hp:48,damage:7,armor:1,speed:86,reach:48,wage:3,recruitCost:15,upgradeTo:'axeman',upgradeCost:25,altUpgradeTo:'fell_archer',altUpgradeCost:25,women:{troop:'shieldmaiden',share:0.15}},
    // Hrothmark's shieldmaidens (P10-09): a quicker shield line of its own, to the hearth-guard.
    shieldmaiden: {id:'shieldmaiden',name:'Shieldmaiden',gender:'female',shield:true,faction:'hrothmark',role:'infantry',tier:'T1',hp:46,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:'shield_sister',upgradeCost:25},
    shield_sister: {id:'shield_sister',name:'Shield-sister',gender:'female',shield:true,faction:'hrothmark',role:'infantry',tier:'T2',hp:60,damage:11,armor:3,speed:88,reach:48,wage:6,recruitCost:25,upgradeTo:'hearth_maiden',upgradeCost:60},
    hearth_maiden: {id:'hearth_maiden',name:'Hearth Maiden',gender:'female',shield:true,faction:'hrothmark',role:'infantry',tier:'T3',hp:82,damage:15,armor:6,speed:86,reach:48,wage:13,recruitCost:65,upgradeTo:null,upgradeCost:0},
    axeman: {id:'axeman',name:'Axeman',shield:true,faction:'hrothmark',role:'infantry',tier:'T2',hp:62,damage:12,armor:3,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'huscarl',upgradeCost:60,altUpgradeTo:'hill_rider',altUpgradeCost:90},
    huscarl: {id:'huscarl',name:'Huscarl',shield:true,faction:'hrothmark',role:'infantry',tier:'T3',hp:86,damage:15,armor:7,speed:82,reach:48,wage:13,recruitCost:65,upgradeTo:null,upgradeCost:0},
    fell_archer: {id:'fell_archer',name:'Fell Archer',faction:'hrothmark',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:82,reach:48,wage:6,recruitCost:25,upgradeTo:'fell_warden',upgradeCost:60,ranged:{projectileSpeed:240,range:215,cooldown:1.6,accuracy:0.6}},
    fell_warden: {id:'fell_warden',name:'Fell Warden',faction:'hrothmark',role:'archer',tier:'T3',hp:82,damage:14,armor:5,speed:82,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:215,cooldown:1.6,accuracy:0.6}},
    hill_rider: {id:'hill_rider',name:'Hill Rider',faction:'hrothmark',role:'cavalry',tier:'T3',hp:94,damage:15,armor:6,speed:125,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    militia: {id:'militia',name:'Militia',faction:'vessaro',role:'infantry',tier:'T1',hp:44,damage:7,armor:1,speed:92,reach:48,wage:3,recruitCost:15,upgradeTo:'pikeman',upgradeCost:25,altUpgradeTo:'crossbowman',altUpgradeCost:25,women:{troop:'popolana',share:0.15}},
    // The League's town women who take up the crossbow (P10-09): a spear at first, then the bow.
    popolana: {id:'popolana',name:'Popolana',gender:'female',faction:'vessaro',role:'infantry',tier:'T1',hp:42,damage:7,armor:1,speed:94,reach:48,wage:3,recruitCost:15,upgradeTo:'balestriera',upgradeCost:25},
    balestriera: {id:'balestriera',name:'Balestriera',gender:'female',faction:'vessaro',role:'archer',tier:'T2',hp:56,damage:13,armor:2,speed:86,reach:48,wage:6,recruitCost:25,upgradeTo:'arbalestriera',upgradeCost:60,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.72}},
    arbalestriera: {id:'arbalestriera',name:'Arbalestriera',gender:'female',faction:'vessaro',role:'archer',tier:'T3',hp:76,damage:18,armor:5,speed:86,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.72}},
    pikeman: {id:'pikeman',name:'Pikeman',brace:true,faction:'vessaro',role:'infantry',tier:'T2',hp:58,damage:11,armor:3,speed:88,reach:72,wage:6,recruitCost:25,upgradeTo:'pavisier',upgradeCost:60,altUpgradeTo:'light_horse',altUpgradeCost:90},
    pavisier: {id:'pavisier',name:'Pavisier',shield:true,brace:true,faction:'vessaro',role:'infantry',tier:'T3',hp:80,damage:13,armor:6,speed:88,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    crossbowman: {id:'crossbowman',name:'Crossbowman',faction:'vessaro',role:'archer',tier:'T2',hp:58,damage:13,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'arbalester',upgradeCost:60,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.7}},
    arbalester: {id:'arbalester',name:'Arbalester',faction:'vessaro',role:'archer',tier:'T3',hp:78,damage:18,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.7}},
    light_horse: {id:'light_horse',name:'Light Horse',faction:'vessaro',role:'cavalry',tier:'T3',hp:80,damage:13,armor:4,speed:150,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    // The western outlaws' huntresses (P10-09): forest archers who ride with the band.
    outlaw_huntress: {id:'outlaw_huntress',name:'Outlaw Huntress',gender:'female',faction:'neutral',role:'archer',tier:'T2',hp:52,damage:10,armor:1,speed:92,reach:48,wage:6,recruitCost:25,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:215,cooldown:1.6,accuracy:0.6}},
    looter: {id:'looter',name:'Looter',faction:'neutral',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:null,upgradeCost:0},
    reaver: {id:'reaver',name:'Reaver',faction:'neutral',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:90,reach:48,wage:6,recruitCost:25,upgradeTo:null,upgradeCost:0},
    mercenary: {id:'mercenary',name:'Mercenary',shield:true,faction:'neutral',culture:'border',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:92,reach:48,wage:6,recruitCost:25,upgradeTo:'sellsword',upgradeCost:60},
    // 1.5.0 (V2-03b, finding F-1): the Mercenary's own tier 3, so hired swords have somewhere to grow.
    // Not for hire; only trained. A little dearer than a kingdom's tier 3 (it is paid to stay).
    sellsword: {id:'sellsword',name:'Sellsword',shield:true,faction:'neutral',culture:'border',role:'infantry',tier:'T3',hp:80,damage:15,armor:5,speed:92,reach:48,wage:14,recruitCost:60,upgradeTo:null,upgradeCost:0},

    // P10-02: the coast's realms, Ostrand (shieldmen, cliff bowmen) and Saltreach (pikes, crossbows).
    ostrand_levy: { id: 'ostrand_levy', name: 'Ostrand Levy', faction: 'ostrand', role: 'infantry', tier: 'T1', hp: 45, damage: 7, armor: 1, speed: 90, reach: 48, wage: 3, recruitCost: 15, upgradeTo: 'ostrand_shieldman', upgradeCost: 25, altUpgradeTo: 'ostrand_bowman', altUpgradeCost: 25 },
    ostrand_shieldman: { id: 'ostrand_shieldman', name: 'Shieldman', shield: true, faction: 'ostrand', role: 'infantry', tier: 'T2', hp: 62, damage: 10, armor: 4, speed: 88, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0 },
    ostrand_bowman: { id: 'ostrand_bowman', name: 'Cliff Bowman', faction: 'ostrand', role: 'archer', tier: 'T2', hp: 58, damage: 10, armor: 2, speed: 84, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0, ranged: { projectileSpeed: 240, range: 230, cooldown: 1.6, accuracy: 0.6 } },
    saltreach_militia: { id: 'saltreach_militia', name: 'Salt Militia', faction: 'saltreach', role: 'infantry', tier: 'T1', hp: 44, damage: 7, armor: 1, speed: 92, reach: 48, wage: 3, recruitCost: 15, upgradeTo: 'saltreach_pikeman', upgradeCost: 25, altUpgradeTo: 'saltreach_crossbow', altUpgradeCost: 25 },
    saltreach_pikeman: { id: 'saltreach_pikeman', name: 'Flats Pikeman', brace: true, faction: 'saltreach', role: 'infantry', tier: 'T2', hp: 58, damage: 11, armor: 3, speed: 88, reach: 72, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0 },
    saltreach_crossbow: { id: 'saltreach_crossbow', name: 'League Crossbow', faction: 'saltreach', role: 'archer', tier: 'T2', hp: 58, damage: 13, armor: 2, speed: 84, reach: 48, wage: 6, recruitCost: 25, upgradeTo: null, upgradeCost: 0, ranged: { projectileSpeed: 300, range: 240, cooldown: 2.2, accuracy: 0.7 } },

    hero: {id:'hero',name:'Hero',faction:'neutral',role:'hero',tier:'T1',hp:85,damage:18,armor:0,speed:142,reach:67,wage:0,recruitCost:0,upgradeTo:null,upgradeCost:0},
  };
  // P10-G1: looks (one row a troop; js/content.js LOOK lists the parts).
  var LOOKS = {
    levy: { tunic: '#a59273', helmet: 'cap', weapon: 'club' },
    footman: { tunic: '#c6b38c', armour: 'gambeson', tabard: true, helmet: 'nasal', shield: 'kite', weapon: 'sword' },
    guard: { armour: 'mail', pauldrons: true, tabard: true, helmet: 'great', shield: 'kite', weapon: 'sword' },
    hunter: { tunic: '#7a6e4a', armour: 'leather', helmet: 'hood', hoodColor: '#5f6a45', weapon: 'bow', quiver: true },
    longbowman: { tunic: '#c6b38c', armour: 'gambeson', tabard: true, helmet: 'kettle', weapon: 'bow', bowSize: 1.15, quiver: true },
    rider: { armour: 'mail', tabard: true, helmet: 'nasal', weapon: 'lance', mount: { coat: '#8a5a3a', mane: '#2e2119' } },
    recruit: { tunic: '#c9b48e', helmet: 'cap', capColor: '#8a3b32', weapon: 'sword' },
    spearman: { tunic: '#b8a582', armour: 'leather', tabard: true, helmet: 'crest', plume: '#b0453a', weapon: 'spear' },
    legionary: { armour: 'mail', pauldrons: true, tabard: true, helmet: 'crest', plume: '#b0453a', shield: 'heater', weapon: 'sword' },
    skirmisher: { tunic: '#c9b48e', armour: 'leather', helmet: 'cap', capColor: '#8a3b32', weapon: 'bow', quiver: true },
    marksman: { tunic: '#c9b48e', armour: 'gambeson', tabard: true, helmet: 'kettle', weapon: 'bow', bowSize: 1.15, quiver: true },
    horse_scout: { tunic: '#c9b48e', armour: 'leather', tabard: true, helmet: 'crest', plume: '#e8dcb8', weapon: 'spear', mount: { coat: '#6a4a32', mane: '#241a14' } },
    clansman: { tunic: '#6f776b', armour: 'fur', hairStyle: 'braid', beard: true, weapon: 'axe' },
    shieldmaiden: { tunic: '#68705f', armour: 'fur', hairStyle: 'braid', shield: 'round', weapon: 'sword' },
    shield_sister: { tunic: '#68705f', armour: 'fur', tabard: true, helmet: 'spangen', hairStyle: 'braid', shield: 'round', weapon: 'sword' },
    hearth_maiden: { armour: 'mail', fur: true, tabard: true, helmet: 'spangen', hairStyle: 'braid', shield: 'round', weapon: 'axe' },
    axeman: { tunic: '#5f6a5c', armour: 'fur', tabard: true, helmet: 'spangen', beard: true, shield: 'round', weapon: 'axe' },
    huscarl: { armour: 'mail', pauldrons: true, fur: true, helmet: 'spangen', beard: true, shield: 'round', weapon: 'axe' },
    fell_archer: { tunic: '#62695a', armour: 'fur', helmet: 'furhat', weapon: 'bow', quiver: true },
    fell_warden: { tunic: '#62695a', armour: 'leather', fur: true, helmet: 'spangen', beard: true, weapon: 'bow', bowSize: 1.15, quiver: true },
    hill_rider: { tunic: '#62695a', armour: 'fur', helmet: 'spangen', beard: true, weapon: 'spear', mount: { coat: '#9a7a52', mane: '#5a4430', pony: true } },
    militia: { tunic: '#d8c48e', helmet: 'cap', capColor: '#b5862a', weapon: 'club' },
    popolana: { tunic: '#c98a4a', hat: 'kerchief', hatColor: '#b5862a', weapon: 'club' },
    balestriera: { tunic: '#d8c48e', armour: 'gambeson', hat: 'kerchief', hatColor: '#b5862a', weapon: 'crossbow', quiver: true },
    arbalestriera: { tunic: '#d8c48e', armour: 'gambeson', tabard: true, helmet: 'sallet', weapon: 'crossbow', quiver: true },
    pikeman: { tunic: '#d8c48e', armour: 'gambeson', tabard: true, helmet: 'sallet', weapon: 'pike' },
    pavisier: { armour: 'mail', tabard: true, helmet: 'sallet', shield: 'pavise', weapon: 'sword' },
    crossbowman: { tunic: '#d8c48e', armour: 'leather', helmet: 'kettle', weapon: 'crossbow', quiver: true },
    arbalester: { armour: 'mail', tabard: true, helmet: 'sallet', weapon: 'crossbow', quiver: true },
    light_horse: { tunic: '#d8c48e', armour: 'leather', tabard: true, hat: 'brim', hatColor: '#8a6a3a', band: '#b5862a', weapon: 'spear', mount: { coat: '#b08a5a', mane: '#4a3626' } },
    outlaw_huntress: { tunic: '#6a5a40', armour: 'leather', helmet: 'hood', hoodColor: '#4a4a32', weapon: 'bow', quiver: true },
    looter: { tunic: '#9a8462', armour: 'rags', helmet: 'hood', hoodColor: '#7d6a50', weapon: 'club' },
    reaver: { tunic: '#8a6a4a', armour: 'leather', helmet: 'hood', hoodColor: '#6e4c3a', weapon: 'axe' },
    mercenary: { tunic: '#7d7a72', armour: 'gambeson', helmet: 'kettle', shield: 'heater', weapon: 'sword' },
    sellsword: { armour: 'mail', pauldrons: true, helmet: 'great', shield: 'heater', weapon: 'sword' },
    ostrand_levy: { tunic: '#8a8f94', armour: 'fur', helmet: 'cap', capColor: '#5a6470', weapon: 'axe' },
    ostrand_shieldman: { tunic: '#7d858c', armour: 'mail', tabard: true, helmet: 'nasal', shield: 'kite', weapon: 'sword' },
    ostrand_bowman: { tunic: '#7d858c', armour: 'leather', fur: true, helmet: 'hood', hoodColor: '#5a6470', weapon: 'bow', quiver: true },
    saltreach_militia: { tunic: '#e2d2a8', hat: 'brim', hatColor: '#c9a55e', band: '#b0782a', weapon: 'club' },
    saltreach_pikeman: { tunic: '#e2d2a8', armour: 'gambeson', tabard: true, helmet: 'kettle', weapon: 'pike' },
    saltreach_crossbow: { tunic: '#e2d2a8', armour: 'leather', hat: 'brim', hatColor: '#c9a55e', band: '#b0782a', weapon: 'crossbow', quiver: true },
  };
  for (var lookId in LOOKS) C.troops[lookId].look = LOOKS[lookId];
  // P11-01: each troop's weapon (a family of data/weapons.js), the one its look carries: a club or a
  // hammer is a mace; a bow of size 1.15 a longbow, a smaller one a shortbow. The troop's own damage,
  // reach and shot still override the family's (P11-11 moves troops onto their weapons).
  var LOOK_WEAPON = { sword: 'sword', axe: 'axe', greataxe: 'greataxe', spear: 'spear', pike: 'pike', lance: 'lance', crossbow: 'crossbow', club: 'mace', hammer: 'mace' };
  Object.keys(C.troops).forEach(function (tid) {
    var t = C.troops[tid];
    var w = t.look?.weapon;
    t.weapon = t.role === 'hero' ? 'unarmed' : w === 'bow' ? ((t.look.bowSize || 1) >= 1.15 ? 'longbow' : 'shortbow') : LOOK_WEAPON[w];
  });
})(typeof window !== 'undefined' ? window : globalThis);
