/* Crownless content: battle_maps. Plain classic script; no modules, no fetch.
 * GDD §8: three battle scenes sharing one tile palette, collision system and spawn anchors.
 * Coordinates are battle-canvas pixels (960×540; the playable area is x 47–908, y 65–490).
 *   ground:    base colour, tiled ground sprites (w####), optional patches of dirt/stone
 *   decor:     [tile, x, y, w, h] sprites drawn under everyone, no collision
 *   obstacles: circles { shape:'circle', x, y, r } or rects { shape:'rect', x, y, w, h } that block
 *              movement; blocksArrows: false for low cover (rocks, bushes, fences)
 *              look: { tile, w, h } sprite drawn with its base on the obstacle, or 'wall' / 'crate'
 *   spawn:     hero anchor (allies form up behind it) and the box enemies appear in
 * Large maps (V2-05, from 1.8.0) are generated in code (js/arena.js) from a spec instead:
 *   generate:  { kind: 'forest' | 'field', scale: screens each way, seed } — the same map every time
 *   small:     the one-screen map used instead with the device setting "Battlefield: Small"
 * Ordinary battles in forest and on open ground use the large maps; the Greywall courtyard stays one
 * screen (its walls make the fight). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var rock = function (x, y) {
    return { shape: 'circle', x: x, y: y, r: 15, blocksArrows: false, look: { tile: 'w0012', w: 40, h: 30 } };
  };
  var tree = function (x, y) {
    return { shape: 'circle', x: x, y: y, r: 20, blocksArrows: true, look: { tile: 'w0132', w: 92, h: 97 } };
  };
  var bush = function (x, y, t) {
    return { shape: 'circle', x: x, y: y, r: 14, blocksArrows: false, look: { tile: t || 'w0002', w: 38, h: 30 } };
  };
  C.battle_maps = {
    grass_field: {
      id: 'grass_field',
      name: 'Grass Field',
      tileset: '16x16',
      ground: { base: '#71904e', tiles: ['w0000', 'w0001', 'w0002'], patch: { color: '#a28e61', x: 481, y: 271, rx: 320, ry: 182 } },
      decor: [['w0091', 40, 70, 49, 57], ['w0091', 850, 75, 58, 63], ['w0034', 71, 430, 65, 72], ['w0050', 864, 411, 65, 72], ['w0110', 550, 90, 54, 55], ['w0121', 120, 89, 57, 62]],
      obstacles: [rock(560, 205), rock(610, 360), rock(420, 420)],
      spawn: { hero: { x: 330, y: 270 }, enemies: { x0: 735, x1: 887, y0: 91, y1: 450 } }
    },
    forest_clearing: {
      id: 'forest_clearing',
      name: 'Forest Clearing',
      tileset: '16x16',
      ground: { base: '#4f7140', tiles: ['w0000', 'w0050', 'w0003'], patch: { color: '#6f8a4c', x: 500, y: 290, rx: 260, ry: 150 } },
      decor: [['w0147', 300, 120, 44, 34], ['w0167', 690, 455, 36, 28], ['w0147', 830, 300, 40, 31], ['w0167', 150, 455, 36, 28]],
      obstacles: [
        tree(110, 120), tree(250, 450), tree(420, 140), tree(470, 330), tree(560, 210),
        tree(640, 420), tree(720, 130), tree(860, 470), tree(900, 210),
        bush(380, 250, 'w0001'), bush(600, 300, 'w0002'), bush(770, 300, 'w0003'), bush(180, 300, 'w0002')
      ],
      spawn: { hero: { x: 300, y: 330 }, enemies: { x0: 700, x1: 880, y0: 100, y1: 440 } }
    },
    // V2-05: the large battlefields (the camera test passed at 60 fps on the owner's phone).
    forest_wilds: { id: 'forest_wilds', name: 'Forest Wilds', generate: { kind: 'forest', scale: 3, seed: 7 }, small: 'forest_clearing' },
    open_country: { id: 'open_country', name: 'Open Country', generate: { kind: 'field', scale: 3, seed: 11 }, small: 'grass_field' },
    // W-05a: a river crossing, fought in the shallows (they slow everyone wading through them).
    river_ford: { id: 'river_ford', name: 'River Ford', generate: { kind: 'ford', scale: 3, seed: 13 }, small: 'grass_field' },
    greywall_courtyard: {
      id: 'greywall_courtyard',
      name: 'Greywall Courtyard',
      tileset: '16x16',
      ground: { base: '#7a7055', tiles: ['w0007', 'w0061'], stone: { x: 580, y: 110, w: 330, h: 320, color: '#8d8a80' } },
      decor: [['w0174', 120, 120, 52, 37], ['w0174', 120, 400, 52, 37], ['w0012', 300, 460, 34, 25]],
      obstacles: [
        { shape: 'rect', x: 560, y: 90, w: 350, h: 22, blocksArrows: true, look: 'wall' },
        { shape: 'rect', x: 560, y: 430, w: 350, h: 22, blocksArrows: true, look: 'wall' },
        { shape: 'rect', x: 560, y: 90, w: 24, h: 125, blocksArrows: true, look: 'wall' },
        { shape: 'rect', x: 560, y: 320, w: 24, h: 132, blocksArrows: true, look: 'wall' },
        { shape: 'rect', x: 690, y: 185, w: 40, h: 40, blocksArrows: true, look: 'crate' },
        { shape: 'rect', x: 770, y: 330, w: 44, h: 38, blocksArrows: true, look: 'crate' },
        rock(380, 170), rock(420, 380)
      ],
      spawn: { hero: { x: 300, y: 270 }, enemies: { x0: 620, x1: 880, y0: 135, y1: 410 } }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
