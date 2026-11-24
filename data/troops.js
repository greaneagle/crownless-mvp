/* Crownless content: troops. Plain classic script; no modules, no fetch.
 * Distances (reach, ranged.range) and speeds are in battle-canvas pixels, which are
 * drawn ~3x larger than the GDD's 16px-tile figures. 'hero' is the player's own body. */
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
    clansman: {id:'clansman',name:'Clansman',faction:'hrothmark',role:'infantry',tier:'T1',hp:48,damage:7,armor:1,speed:86,reach:48,wage:3,recruitCost:15,upgradeTo:'axeman',upgradeCost:25,altUpgradeTo:'fell_archer',altUpgradeCost:25},
    axeman: {id:'axeman',name:'Axeman',shield:true,faction:'hrothmark',role:'infantry',tier:'T2',hp:62,damage:12,armor:3,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'huscarl',upgradeCost:60,altUpgradeTo:'hill_rider',altUpgradeCost:90},
    huscarl: {id:'huscarl',name:'Huscarl',shield:true,faction:'hrothmark',role:'infantry',tier:'T3',hp:86,damage:15,armor:7,speed:82,reach:48,wage:13,recruitCost:65,upgradeTo:null,upgradeCost:0},
    fell_archer: {id:'fell_archer',name:'Fell Archer',faction:'hrothmark',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:82,reach:48,wage:6,recruitCost:25,upgradeTo:'fell_warden',upgradeCost:60,ranged:{projectileSpeed:240,range:215,cooldown:1.6,accuracy:0.6}},
    fell_warden: {id:'fell_warden',name:'Fell Warden',faction:'hrothmark',role:'archer',tier:'T3',hp:82,damage:14,armor:5,speed:82,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:215,cooldown:1.6,accuracy:0.6}},
    hill_rider: {id:'hill_rider',name:'Hill Rider',faction:'hrothmark',role:'cavalry',tier:'T3',hp:94,damage:15,armor:6,speed:125,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    militia: {id:'militia',name:'Militia',faction:'vessaro',role:'infantry',tier:'T1',hp:44,damage:7,armor:1,speed:92,reach:48,wage:3,recruitCost:15,upgradeTo:'pikeman',upgradeCost:25,altUpgradeTo:'crossbowman',altUpgradeCost:25},
    pikeman: {id:'pikeman',name:'Pikeman',brace:true,faction:'vessaro',role:'infantry',tier:'T2',hp:58,damage:11,armor:3,speed:88,reach:72,wage:6,recruitCost:25,upgradeTo:'pavisier',upgradeCost:60,altUpgradeTo:'light_horse',altUpgradeCost:90},
    pavisier: {id:'pavisier',name:'Pavisier',shield:true,brace:true,faction:'vessaro',role:'infantry',tier:'T3',hp:80,damage:13,armor:6,speed:88,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    crossbowman: {id:'crossbowman',name:'Crossbowman',faction:'vessaro',role:'archer',tier:'T2',hp:58,damage:13,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'arbalester',upgradeCost:60,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.7}},
    arbalester: {id:'arbalester',name:'Arbalester',faction:'vessaro',role:'archer',tier:'T3',hp:78,damage:18,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:300,range:240,cooldown:2.2,accuracy:0.7}},
    light_horse: {id:'light_horse',name:'Light Horse',faction:'vessaro',role:'cavalry',tier:'T3',hp:80,damage:13,armor:4,speed:150,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
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
})(typeof window !== 'undefined' ? window : globalThis);
