/* Crownless content: factions. Plain classic script; no modules, no fetch.
 * ruler (P8-02): what its ruler is called, by gender (default King or Queen).
 * freeCity (P8-02): a kingdom of the map with no ruler, lords or holdings (Merrow).
 * culture: the name culture (data/names.js) of people raised in this faction's lands.
 * emblem: the letter on its banners on the map; order: its place on the troop tree (W-04).
 * Which factions are a world's kingdoms is the world's own list (data/world_map.js `factions`).
 * lineName: optional heading for this faction's troops on the troop tree (default: name).
 * laws (P9-01): a realm's laws, over the defaults { power: 'crown', share: 0.1, succession: 'eldest',
 *   fiefCap: 3, war: 'ruler' }: power 'crown' | 'league'; share, the crown's due (0–0.5); succession
 *   'eldest' | 'kin' | 'council'; fiefCap, the fiefs a lord may hold; war 'ruler' | 'council'.
 * W-05b (decision D-W3): Hrothmark, the Vessaro League and the Free City of Merrow are placeholder
 * names, data only, and can be renamed here without touching code. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.factions = {
    valedorn: {id:'valedorn',name:'Valedorn Crown',short:'Valedorn',emblem:'V',order:1,culture:'valedorn',ruler:{male:'King',female:'Queen'},color:'#3b6ea5',description:'Knightly border lords holding the western march.',initialReputation:0,recruits:['levy','hunter'],garrison:{footman:10,guard:4,hunter:6,longbowman:2}},
    aurelian: {id:'aurelian',name:'Aurelian Remnant',short:'Aurelian',emblem:'A',order:2,culture:'aurelian',ruler:{male:'First Magistrate',female:'First Magistrate'},color:'#a53b3b',description:'Heirs of imperial law holding the eastern march.',initialReputation:0,recruits:['recruit','skirmisher'],garrison:{spearman:10,legionary:4,skirmisher:6,marksman:2}},
    hrothmark: {id:'hrothmark',name:'Kingdom of Hrothmark',short:'Hrothmark',emblem:'H',order:3,culture:'hrothmark',ruler:{male:'King',female:'Queen'},color:'#4f7a5a',description:'Highland clans of the northern forests and mountains: heavy infantry and axemen.',initialReputation:0,recruits:['clansman','fell_archer'],garrison:{axeman:10,huscarl:4,fell_archer:6,fell_warden:2}},
    vessaro:  {id:'vessaro',name:'Vessaro League',short:'Vessaro',emblem:'L',order:4,culture:'vessaro',ruler:{male:'King',female:'Queen'},color:'#b5862a',description:'Merchant towns of the southern marsh and coast: crossbowmen and light horse.',laws:{power:'league',succession:'council',war:'council'},initialReputation:0,recruits:['militia','crossbowman'],garrison:{pikeman:10,pavisier:4,crossbowman:6,arbalester:2}},
    merrow:   {id:'merrow',name:'Free City of Merrow',short:'Merrow',emblem:'M',order:5,freeCity:true,culture:'border',color:'#6b5aa5',description:'A free port that answers to no crown: neutral, rich, and full of swords for hire.',initialReputation:0,recruits:['mercenary']},
    neutral:  {id:'neutral',name:'Road Reavers',short:'Reaver',emblem:'R',order:9,lineName:'Sell-swords and road bands',culture:'border',color:'#8a6d3b',description:'Bandits, looters and hireable mercenaries of the frontier.',initialReputation:0,recruits:[]}
  };
  // P9-03: banner colours for realms founded in play, in the order they are given.
  C.realm_palette = { banners: { id: 'banners', colors: ['#2f8f8f', '#9a4f8a', '#5f7f2f', '#b0603a', '#3f4f9a', '#8a8a3a', '#7a3f3f', '#3a7a6a'] } };
})(typeof window !== 'undefined' ? window : globalThis);
