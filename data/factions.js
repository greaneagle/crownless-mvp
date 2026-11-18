/* Crownless content: factions. Plain classic script; no modules, no fetch.
 * culture: the name culture (data/names.js) of people raised in this faction's lands.
 * emblem: the letter on its banners on the map; order: its place on the troop tree (W-04).
 * Which factions are a world's kingdoms is the world's own list (data/world_map.js `factions`).
 * lineName: optional heading for this faction's troops on the troop tree (default: name). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.factions = {
    valedorn: {id:'valedorn',name:'Valedorn Crown',short:'Valedorn',emblem:'V',order:1,culture:'valedorn',color:'#3b6ea5',description:'Knightly border lords holding the western march.',initialReputation:0,recruits:['levy','hunter'],garrison:{footman:10,guard:4,hunter:6,longbowman:2}},
    aurelian: {id:'aurelian',name:'Aurelian Remnant',short:'Aurelian',emblem:'A',order:2,culture:'aurelian',color:'#a53b3b',description:'Heirs of imperial law holding the eastern march.',initialReputation:0,recruits:['recruit','skirmisher'],garrison:{spearman:10,legionary:4,skirmisher:6,marksman:2}},
    neutral:  {id:'neutral',name:'Road Reavers',short:'Reaver',emblem:'R',order:9,lineName:'Sell-swords and road bands',culture:'border',color:'#8a6d3b',description:'Bandits, looters and hireable mercenaries of the frontier.',initialReputation:0,recruits:[]}
  };
})(typeof window !== 'undefined' ? window : globalThis);
