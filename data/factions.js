/* Crownless content: factions. Plain classic script; no modules, no fetch. */
(function (root) {
  var C = (root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {});
  C.factions = {
    valedorn: {id:'valedorn',name:'Valedorn Crown',color:'#3b6ea5',description:'Old kingdom loyalists holding the northern towns.',initialReputation:0},
    aurelian: {id:'aurelian',name:'Aurelian Remnant',color:'#a53b3b',description:'Rival claimants holding the southern forts.',initialReputation:0},
    neutral:  {id:'neutral',name:'Road Reavers',color:'#8a6d3b',description:'Bandits, looters and hireable mercenaries of the frontier.',initialReputation:0}
  };
})(typeof window !== 'undefined' ? window : globalThis);
