/* Crownless content: troops. Plain classic script; no modules, no fetch.
 * Distances (reach, ranged.range) and speeds are in battle-canvas pixels, which are
 * drawn ~3x larger than the GDD's 16px-tile figures. 'hero' is the player's own body. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.troops = {
    levy: {id:'levy',name:'Levy',faction:'valedorn',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:'footman',upgradeCost:25},
    footman: {id:'footman',name:'Footman',faction:'valedorn',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:90,reach:48,wage:6,recruitCost:25,upgradeTo:'guard',upgradeCost:60,altUpgradeTo:'rider',altUpgradeCost:90},
    guard: {id:'guard',name:'Guard',faction:'valedorn',role:'infantry',tier:'T3',hp:80,damage:14,armor:6,speed:90,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    hunter: {id:'hunter',name:'Hunter',faction:'valedorn',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'longbowman',upgradeCost:60,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    longbowman: {id:'longbowman',name:'Longbowman',faction:'valedorn',role:'archer',tier:'T3',hp:80,damage:14,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    rider: {id:'rider',name:'Rider',faction:'valedorn',role:'cavalry',tier:'T3',hp:90,damage:14,armor:6,speed:135,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    recruit: {id:'recruit',name:'Recruit',faction:'aurelian',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:'spearman',upgradeCost:25},
    spearman: {id:'spearman',name:'Spearman',faction:'aurelian',role:'infantry',tier:'T2',hp:60,damage:11,armor:3,speed:88,reach:70,wage:6,recruitCost:25,upgradeTo:'legionary',upgradeCost:60,altUpgradeTo:'horse_scout',altUpgradeCost:90},
    legionary: {id:'legionary',name:'Legionary',faction:'aurelian',role:'infantry',tier:'T3',hp:80,damage:14,armor:6,speed:90,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    skirmisher: {id:'skirmisher',name:'Skirmisher',faction:'aurelian',role:'archer',tier:'T2',hp:60,damage:10,armor:2,speed:84,reach:48,wage:6,recruitCost:25,upgradeTo:'marksman',upgradeCost:60,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    marksman: {id:'marksman',name:'Marksman',faction:'aurelian',role:'archer',tier:'T3',hp:80,damage:14,armor:5,speed:84,reach:48,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0,ranged:{projectileSpeed:240,range:225,cooldown:1.6,accuracy:0.6}},
    horse_scout: {id:'horse_scout',name:'Horse Scout',faction:'aurelian',role:'cavalry',tier:'T3',hp:90,damage:14,armor:6,speed:135,reach:70,wage:12,recruitCost:60,upgradeTo:null,upgradeCost:0},
    looter: {id:'looter',name:'Looter',faction:'neutral',role:'infantry',tier:'T1',hp:45,damage:7,armor:1,speed:90,reach:48,wage:3,recruitCost:15,upgradeTo:null,upgradeCost:0},
    reaver: {id:'reaver',name:'Reaver',faction:'neutral',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:90,reach:48,wage:6,recruitCost:25,upgradeTo:null,upgradeCost:0},
    mercenary: {id:'mercenary',name:'Mercenary',faction:'neutral',role:'infantry',tier:'T2',hp:60,damage:10,armor:3,speed:92,reach:48,wage:6,recruitCost:25,upgradeTo:null,upgradeCost:0},

    hero: {id:'hero',name:'Hero',faction:'neutral',role:'hero',tier:'T1',hp:85,damage:18,armor:0,speed:142,reach:67,wage:0,recruitCost:0,upgradeTo:null,upgradeCost:0},
  };
})(typeof window !== 'undefined' ? window : globalThis);
