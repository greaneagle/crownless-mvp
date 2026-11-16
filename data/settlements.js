/* Crownless content: settlements. Plain classic script; no modules, no fetch.
 * GDD §3: two towns, two forts, six villages. Valedorn holds the west, Aurelian the east.
 * market: baseline scarcity per trade good (GDD §9: 0.8 plentiful … 1.4 scarce) where the
 * settlement offers the trade service. Prices drift back toward these after trading.
 * garrison (forts): the troops holding it (GDD §8 'fort garrison info'); sieges come later.
 * gear: what the local armoury sells (towns a full range, villages the basics). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.settlements = {
    stonebridge: {id:'stonebridge',name:'Stonebridge',type:'town',ownerFaction:'valedorn',explorable:true,services:['recruit','trade','rest','contracts','leave'],mapX:50,mapY:55,market:{grain:0.95,salt:1.1,wool:0.9,iron:1.1,cloth:1.05,tools:1.0},gear:['worn_sword','hand_axe','arming_sword','war_mace','oak_shield','kite_shield','leather_cap','iron_helm','gambeson','leather_chest','mail_hauberk','gloves','mail_mittens','boots','greaves','nag','rouncey','smoked_meat']},
    eastwatch: {id:'eastwatch',name:'Eastwatch',type:'town',ownerFaction:'aurelian',explorable:false,services:['recruit','trade','rest','contracts','leave'],mapX:62,mapY:40,market:{grain:1.15,salt:0.9,wool:1.1,iron:1.0,cloth:0.85,tools:0.9},gear:['worn_sword','arming_sword','war_mace','knights_sword','oak_shield','heater_shield','iron_helm','bascinet','gambeson','leather_chest','mail_hauberk','gloves','boots','nag','rouncey','courser','smoked_meat']},
    greywall_fort: {id:'greywall_fort',name:'Greywall Fort',type:'fort',ownerFaction:'valedorn',explorable:false,services:['recruit','rest'],mapX:42,mapY:30,garrison:{footman:10,guard:4,hunter:6,longbowman:2}},
    ashgate_fort: {id:'ashgate_fort',name:'Ashgate Fort',type:'fort',ownerFaction:'aurelian',explorable:false,services:['recruit','rest'],mapX:70,mapY:70,garrison:{spearman:10,legionary:4,skirmisher:6,marksman:2}},
    oakford: {id:'oakford',name:'Oakford',type:'village',ownerFaction:'valedorn',explorable:false,services:['trade','rest'],mapX:35,mapY:62,market:{grain:0.8,salt:1.3,wool:0.9,iron:1.3,cloth:1.2,tools:1.25},gear:['leather_cap','gambeson','boots','nag']},
    highmere: {id:'highmere',name:'Highmere',type:'village',ownerFaction:'valedorn',explorable:false,services:['trade','rest'],mapX:55,mapY:25,market:{grain:1.1,salt:1.25,wool:0.8,iron:0.85,cloth:1.2,tools:1.1},gear:['hand_axe','leather_cap','boots','gloves']},
    brackenfield: {id:'brackenfield',name:'Brackenfield',type:'village',ownerFaction:'valedorn',explorable:false,services:['trade','recruit'],mapX:30,mapY:45,market:{grain:0.9,salt:1.3,wool:1.0,iron:1.2,cloth:1.25,tools:1.3},gear:['hand_axe','oak_shield','leather_cap','nag']},
    dunmarsh: {id:'dunmarsh',name:'Dunmarsh',type:'village',ownerFaction:'aurelian',explorable:false,services:['trade','rest'],mapX:66,mapY:88,market:{grain:1.25,salt:0.9,wool:1.2,iron:1.3,cloth:1.1,tools:1.2},gear:['leather_cap','gambeson','boots']},
    redfield: {id:'redfield',name:'Redfield',type:'village',ownerFaction:'aurelian',explorable:false,services:['trade','rest'],mapX:78,mapY:52,market:{grain:0.85,salt:1.0,wool:1.05,iron:1.25,cloth:1.15,tools:1.2},gear:['gambeson','gloves','boots','nag']},
    saltmere: {id:'saltmere',name:'Saltmere',type:'village',ownerFaction:'aurelian',explorable:false,services:['trade','recruit'],mapX:84,mapY:80,market:{grain:1.2,salt:0.8,wool:1.2,iron:1.3,cloth:1.0,tools:1.15},gear:['oak_shield','leather_cap','boots','smoked_meat']}
  };
})(typeof window !== 'undefined' ? window : globalThis);
