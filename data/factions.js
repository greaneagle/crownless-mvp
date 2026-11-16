/* Crownless content: factions. Plain classic script; no modules, no fetch. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.factions = {
    valedorn: {id:'valedorn',name:'Valedorn Crown',color:'#3b6ea5',description:'Knightly border lords holding the western march.',initialReputation:0,recruits:['levy','hunter'],garrison:{footman:10,guard:4,hunter:6,longbowman:2}},
    aurelian: {id:'aurelian',name:'Aurelian Remnant',color:'#a53b3b',description:'Heirs of imperial law holding the eastern march.',initialReputation:0,recruits:['recruit','skirmisher'],garrison:{spearman:10,legionary:4,skirmisher:6,marksman:2}},
    neutral:  {id:'neutral',name:'Road Reavers',color:'#8a6d3b',description:'Bandits, looters and hireable mercenaries of the frontier.',initialReputation:0,recruits:[]}
  };
})(typeof window !== 'undefined' ? window : globalThis);
