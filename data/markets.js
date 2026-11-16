/* Crownless content: markets. Plain classic script; no modules, no fetch.
 * GDD §9: six trade goods with base prices and cargo weight. `tradeGood: false` marks entries
 * priced here but not traded on the market screen (food rations are bought from the supplies menu).
 * Icons are placeholder glyphs until the art pass. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.markets = {
    grain: {id:'grain',name:'Grain',basePrice:10,weight:1,tradeGood:true,icon:'🌾'},
    salt: {id:'salt',name:'Salt',basePrice:18,weight:1,tradeGood:true,icon:'🧂'},
    wool: {id:'wool',name:'Wool',basePrice:14,weight:1,tradeGood:true,icon:'🐑'},
    iron: {id:'iron',name:'Iron',basePrice:28,weight:2,tradeGood:true,icon:'⛓️'},
    cloth: {id:'cloth',name:'Cloth',basePrice:32,weight:1,tradeGood:true,icon:'🧵'},
    tools: {id:'tools',name:'Tools',basePrice:40,weight:3,tradeGood:true,icon:'🔨'},
    food_ration: {id:'food_ration',name:'Food Ration',basePrice:8,weight:1,tradeGood:false,icon:'🍞'}
  };
})(typeof window !== 'undefined' ? window : globalThis);
