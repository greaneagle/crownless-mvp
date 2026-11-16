/* Crownless content: settlements. Plain classic script; no modules, no fetch. */
(function (root) {
  var C = (root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {});
  C.settlements = {
    stonebridge: {id:'stonebridge',name:'Stonebridge',type:'town',ownerFaction:'valedorn',explorable:true,services:['recruit','trade','rest','contracts','leave'],mapX:50,mapY:55},
    eastwatch: {id:'eastwatch',name:'Eastwatch',type:'town',ownerFaction:'valedorn',explorable:false,services:['trade','rest'],mapX:62,mapY:40},
    greywall_fort: {id:'greywall_fort',name:'Greywall Fort',type:'fort',ownerFaction:'valedorn',explorable:false,services:['recruit','rest'],mapX:42,mapY:30},
    ashgate_fort: {id:'ashgate_fort',name:'Ashgate Fort',type:'fort',ownerFaction:'aurelian',explorable:false,services:['recruit','rest'],mapX:70,mapY:70},
    oakford: {id:'oakford',name:'Oakford',type:'town',ownerFaction:'valedorn',explorable:false,services:['trade','rest'],mapX:35,mapY:62},
    highmere: {id:'highmere',name:'Highmere',type:'town',ownerFaction:'valedorn',explorable:false,services:['trade','rest'],mapX:55,mapY:25},
    brackenfield: {id:'brackenfield',name:'Brackenfield',type:'town',ownerFaction:'neutral',explorable:false,services:['trade','recruit'],mapX:30,mapY:45},
    dunmarsh: {id:'dunmarsh',name:'Dunmarsh',type:'town',ownerFaction:'neutral',explorable:false,services:['trade','rest'],mapX:22,mapY:72},
    redfield: {id:'redfield',name:'Redfield',type:'town',ownerFaction:'aurelian',explorable:false,services:['trade','rest'],mapX:78,mapY:52},
    saltmere: {id:'saltmere',name:'Saltmere',type:'town',ownerFaction:'aurelian',explorable:false,services:['trade','recruit'],mapX:84,mapY:80}
  };
})(typeof window !== 'undefined' ? window : globalThis);
