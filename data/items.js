/* Crownless content: items. Plain classic script; no modules, no fetch. */
(function (root) {
  var C = (root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {});
  C.items = {
    worn_sword: {id:'worn_sword',name:'Worn Sword',type:'weapon',slot:'weapon',rarity:'common',value:12,weight:2,stats:{damage:1},questItem:false},
    clothing: {id:'clothing',name:'Clothing',type:'armor',slot:'body',rarity:'common',value:5,weight:1,stats:{armor:1},questItem:false},
    food_3_days: {id:'food_3_days',name:'Three Days of Food',type:'consumable',slot:null,rarity:'common',value:24,weight:3,stats:{food:3},questItem:false},
    iron_helm: {id:'iron_helm',name:'Iron Helm',type:'armor',slot:'head',rarity:'common',value:20,weight:2,stats:{armor:1},questItem:false},
    leather_chest: {id:'leather_chest',name:'Leather Chest',type:'armor',slot:'body',rarity:'common',value:30,weight:3,stats:{armor:2},questItem:false},
    boots: {id:'boots',name:'Boots',type:'armor',slot:'feet',rarity:'common',value:15,weight:1,stats:{armor:1},questItem:false},
    gloves: {id:'gloves',name:'Gloves',type:'armor',slot:'hands',rarity:'common',value:10,weight:1,stats:{},questItem:false},
    oak_shield: {id:'oak_shield',name:'Oak Shield',type:'shield',slot:'offhand',rarity:'common',value:25,weight:3,stats:{block:true},questItem:false},
    ring_of_roads: {id:'ring_of_roads',name:'Ring of Roads',type:'accessory',slot:'ring',rarity:'uncommon',value:40,weight:0,stats:{pathfinding:1},questItem:false},
    nag: {id:'nag',name:'Nag',type:'horse',slot:'horse',rarity:'common',value:35,weight:0,stats:{travel:0.1},questItem:false},
    charter_fragment: {id:'charter_fragment',name:'Charter Fragment',type:'quest',slot:null,rarity:'quest',value:0,weight:0,stats:{},questItem:true},
    courier_packet: {id:'courier_packet',name:'Courier Packet',type:'quest',slot:null,rarity:'quest',value:0,weight:1,stats:{},questItem:true},
    mara_token: {id:'mara_token',name:"Mara's Token",type:'quest',slot:null,rarity:'quest',value:0,weight:0,stats:{},questItem:true}
  };
})(typeof window !== 'undefined' ? window : globalThis);
