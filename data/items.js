/* Crownless content: items. Plain classic script; no modules, no fetch.
 * GDD §9: ~30 item definitions *including* weapons, helmets, armor, shields, boots, gloves, horses,
 * goods and food (the six trade goods live in data/markets.js). No durability.
 * Equipment stats: weapon `damage` is the GDD WeaponDamage (sword baseline ~14-17); `armor` adds to the
 * hero's armor; shields need `block` to allow blocking; skill names (e.g. `pathfinding`) add skill points;
 * a horse's `travel` is a fractional world-map speed bonus; `food` is rations (one feeds 5 people a day).
 * Slots: weapon, offhand, head, body, hands, feet, horse, ring. `tier` 1–3 drives loot and shops. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.items = {
    // Weapons (one active melee weapon)
    worn_sword: {id:'worn_sword',family:'sword',name:'Worn Sword',type:'weapon',slot:'weapon',tier:1,rarity:'common',value:12,weight:2,stats:{damage:17},questItem:false},
    hand_axe: {id:'hand_axe',family:'axe',name:'Hand Axe',type:'weapon',slot:'weapon',tier:1,rarity:'common',value:45,weight:2,stats:{damage:19},questItem:false},
    arming_sword: {id:'arming_sword',family:'sword',name:'Arming Sword',type:'weapon',slot:'weapon',tier:2,rarity:'uncommon',value:80,weight:2,stats:{damage:21},questItem:false},
    war_mace: {id:'war_mace',family:'mace',name:'War Mace',type:'weapon',slot:'weapon',tier:2,rarity:'uncommon',value:110,weight:3,stats:{damage:22},questItem:false},
    knights_sword: {id:'knights_sword',family:'sword',name:"Knight's Sword",type:'weapon',slot:'weapon',tier:3,rarity:'rare',value:260,weight:2,stats:{damage:25},questItem:false},
    // Shields (needed to block)
    oak_shield: {id:'oak_shield',name:'Oak Shield',type:'shield',slot:'offhand',tier:1,rarity:'common',value:25,weight:3,stats:{block:true},questItem:false},
    kite_shield: {id:'kite_shield',name:'Kite Shield',type:'shield',slot:'offhand',tier:2,rarity:'uncommon',value:70,weight:4,stats:{block:true,armor:1},questItem:false},
    heater_shield: {id:'heater_shield',name:'Iron-Rimmed Heater',type:'shield',slot:'offhand',tier:3,rarity:'rare',value:150,weight:4,stats:{block:true,armor:2},questItem:false},
    // Helmets
    leather_cap: {id:'leather_cap',name:'Leather Cap',type:'armor',slot:'head',tier:1,rarity:'common',value:12,weight:1,stats:{armor:1},questItem:false},
    iron_helm: {id:'iron_helm',name:'Iron Helm',type:'armor',slot:'head',tier:2,rarity:'uncommon',value:55,weight:2,stats:{armor:2},questItem:false},
    bascinet: {id:'bascinet',name:'Bascinet',type:'armor',slot:'head',tier:3,rarity:'rare',value:140,weight:3,stats:{armor:3},questItem:false},
    // Body armour
    clothing: {id:'clothing',name:'Clothing',type:'armor',slot:'body',tier:1,rarity:'common',value:5,weight:1,stats:{armor:1},questItem:false},
    gambeson: {id:'gambeson',name:'Padded Gambeson',type:'armor',slot:'body',tier:1,rarity:'common',value:25,weight:2,stats:{armor:2},questItem:false},
    leather_chest: {id:'leather_chest',name:'Leather Jerkin',type:'armor',slot:'body',tier:2,rarity:'uncommon',value:60,weight:3,stats:{armor:3},questItem:false},
    mail_hauberk: {id:'mail_hauberk',name:'Mail Hauberk',type:'armor',slot:'body',tier:3,rarity:'rare',value:220,weight:6,stats:{armor:5},questItem:false},
    // Gloves
    gloves: {id:'gloves',name:'Work Gloves',type:'armor',slot:'hands',tier:1,rarity:'common',value:10,weight:1,stats:{armor:0},questItem:false},
    mail_mittens: {id:'mail_mittens',name:'Mail Mittens',type:'armor',slot:'hands',tier:2,rarity:'uncommon',value:45,weight:1,stats:{armor:1},questItem:false},
    // Boots
    boots: {id:'boots',name:'Boots',type:'armor',slot:'feet',tier:1,rarity:'common',value:15,weight:1,stats:{armor:1},questItem:false},
    greaves: {id:'greaves',name:'Iron Greaves',type:'armor',slot:'feet',tier:3,rarity:'rare',value:70,weight:3,stats:{armor:2},questItem:false},
    // Horses (passive travel bonus and carrying capacity; mounted combat is later)
    nag: {id:'nag',name:'Nag',type:'horse',slot:'horse',tier:1,rarity:'common',value:35,weight:0,stats:{travel:0.1},questItem:false},
    rouncey: {id:'rouncey',name:'Rouncey',type:'horse',slot:'horse',tier:2,rarity:'uncommon',value:120,weight:0,stats:{travel:0.2},questItem:false},
    courser: {id:'courser',name:'Courser',type:'horse',slot:'horse',tier:3,rarity:'rare',value:300,weight:0,stats:{travel:0.35},questItem:false},
    // Accessory
    ring_of_roads: {id:'ring_of_roads',name:'Ring of Roads',type:'accessory',slot:'ring',tier:2,rarity:'uncommon',value:40,weight:0,stats:{pathfinding:1},questItem:false},
    // Food (goes straight into the ration stock)
    food_3_days: {id:'food_3_days',name:'Three Days of Food',type:'consumable',slot:null,tier:1,rarity:'common',value:24,weight:3,stats:{food:3},questItem:false},
    smoked_meat: {id:'smoked_meat',name:'Smoked Meat',type:'consumable',slot:null,tier:2,rarity:'common',value:45,weight:3,stats:{food:6},questItem:false},
    // Quest items (protected from sale and capture)
    charter_fragment: {id:'charter_fragment',name:'Charter Fragment',type:'quest',slot:null,tier:0,rarity:'quest',value:0,weight:0,stats:{},questItem:true},
    courier_packet: {id:'courier_packet',name:'Courier Packet',type:'quest',slot:null,tier:0,rarity:'quest',value:0,weight:1,stats:{},questItem:true},
    mara_token: {id:'mara_token',name:"Mara's Token",type:'quest',slot:null,tier:0,rarity:'quest',value:0,weight:0,stats:{},questItem:true}
  };

  // P7-03: the blacksmith's forging (js/blacksmith.js). Each piece of the hero's gear in these slots can
  // be improved at most `maxLevel` times; level n adds n × the slot's stats, is worth (1 + valuePerLevel
  // × n) of the piece, and costs costPerLevel × n of its value in crowns plus `iron` × n iron from your
  // cargo. Forged pieces are items of their own ("Arming Sword +1", id `arming_sword+1`), made from these
  // rules when the content loads; no armoury sells them, and they sell for half their value like any
  // gear, which stays below what the plain piece costs to buy (no buying, forging and selling for profit).
  // Fine kit: better-fitted gear for up to `kit.max` named soldiers (more armour and hit points, a little
  // more strength in auto-resolve) for kit.cost crowns and kit.iron iron each.
  C.forge = {
    maxLevel: 2,
    slots: { weapon: { damage: 2 }, body: { armor: 2 }, head: { armor: 1 }, offhand: { armor: 1 }, hands: { armor: 1 }, feet: { armor: 1 } },
    iron: { weapon: 1, body: 2, head: 1, offhand: 1, hands: 1, feet: 1 },
    valuePerLevel: 0.3,
    costPerLevel: 0.3,
    minCost: 10,
    kit: { max: 5, cost: 40, iron: 2, armor: 1, hp: 8, power: 1.15 }
  };
  // GDD §9: small weighted loot tables tied to encounter tier. Encounters name a table by id.
  C.loot_tables = {
    low: {
      id: 'low',
      chancePerKill: 0.3,
      table: [
        { item: 'food_3_days', weight: 6 },
        { item: 'clothing', weight: 4 },
        { item: 'gloves', weight: 3 },
        { item: 'boots', weight: 3 },
        { item: 'leather_cap', weight: 3 },
        { item: 'worn_sword', weight: 3 },
        { item: 'gambeson', weight: 2 },
        { item: 'hand_axe', weight: 1 }
      ]
    },
    mid: {
      id: 'mid',
      chancePerKill: 0.3,
      table: [
        { item: 'food_3_days', weight: 5 },
        { item: 'smoked_meat', weight: 2 },
        { item: 'gambeson', weight: 3 },
        { item: 'leather_cap', weight: 3 },
        { item: 'boots', weight: 2 },
        { item: 'hand_axe', weight: 3 },
        { item: 'leather_chest', weight: 2 },
        { item: 'iron_helm', weight: 2 },
        { item: 'mail_mittens', weight: 2 },
        { item: 'oak_shield', weight: 2 },
        { item: 'arming_sword', weight: 1 },
        { item: 'kite_shield', weight: 1 },
        { item: 'nag', weight: 1 }
      ]
    },
    high: {
      id: 'high',
      chancePerKill: 0.3,
      table: [
        { item: 'smoked_meat', weight: 4 },
        { item: 'leather_chest', weight: 3 },
        { item: 'iron_helm', weight: 3 },
        { item: 'mail_mittens', weight: 2 },
        { item: 'arming_sword', weight: 2 },
        { item: 'war_mace', weight: 2 },
        { item: 'kite_shield', weight: 2 },
        { item: 'greaves', weight: 1 },
        { item: 'bascinet', weight: 1 },
        { item: 'mail_hauberk', weight: 1 },
        { item: 'heater_shield', weight: 1 },
        { item: 'rouncey', weight: 1 },
        { item: 'ring_of_roads', weight: 1 }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
