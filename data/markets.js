/* Crownless content: markets. Plain classic script; no modules, no fetch. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.markets = {
    grain: {id:'grain',name:'Grain',basePrice:10,weight:1},
    salt: {id:'salt',name:'Salt',basePrice:18,weight:1},
    wool: {id:'wool',name:'Wool',basePrice:14,weight:1},
    iron: {id:'iron',name:'Iron',basePrice:28,weight:2},
    cloth: {id:'cloth',name:'Cloth',basePrice:32,weight:1},
    tools: {id:'tools',name:'Tools',basePrice:40,weight:3},
    food_ration: {id:'food_ration',name:'Food Ration',basePrice:8,weight:1}
  };
})(typeof window !== 'undefined' ? window : globalThis);
