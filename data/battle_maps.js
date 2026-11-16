/* Crownless content: battle_maps. Plain classic script; no modules, no fetch. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.battle_maps = {
    grass_field: {
      id:'grass_field',
      name:'Grass Field',
      tileset:'16x16',
      terrainPalette:['w0000','w0001','w0002','w0034','w0050'],
      spawnAnchors:{player:{x:330,y:270},enemy:{x:700,y:270}}
    },
    forest_clearing: {
      id:'forest_clearing',
      name:'Forest Clearing',
      tileset:'16x16',
      terrainPalette:['w0061','w0091','w0110','w0121'],
      spawnAnchors:{player:{x:300,y:300},enemy:{x:720,y:220}}
    },
    greywall_courtyard: {
      id:'greywall_courtyard',
      name:'Greywall Courtyard',
      tileset:'16x16',
      terrainPalette:['w0132','w0147','w0167','w0174'],
      spawnAnchors:{player:{x:320,y:270},enemy:{x:760,y:270}}
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
