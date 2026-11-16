/* Crownless sprite loading. Files are assets/u####.png (units) and assets/w####.png (world). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const imgs = {};

  // Frame indices into the u#### unit sprite set.
  const heroFrames = {
    down: [0, 1, 2, 3],
    left: [16, 17, 18, 19],
    right: [32, 33, 34, 35],
    up: [48, 49, 50, 51],
  };
  const allyArt = { infantry: [72, 73, 74, 75], archer: [85, 86, 87, 88] };
  const enemyArt = [92, 93, 94, 95, 120, 121, 122, 123, 200, 201, 202, 203];
  const worldTiles = [0, 1, 2, 3, 7, 12, 20, 34, 50, 61, 91, 110, 121, 132, 147, 167, 174];

  const key = (prefix, i) => prefix + String(i).padStart(4, '0');

  function loadImg(k) {
    const img = new Image();
    imgs[k] = img;
    CL.diag.assets.requested++;
    img.onload = () => {
      CL.diag.assets.loaded++;
    };
    img.onerror = () => {
      CL.diag.assets.failed.push(k);
      CL.diag.log('error', 'Sprite failed to load', { file: k });
    };
    img.src = `assets/${k}.png`;
  }

  function preload() {
    const used = new Set([
      ...Object.values(heroFrames).flat(),
      ...Object.values(allyArt).flat(),
      ...enemyArt,
    ]);
    for (const i of used) loadImg(key('u', i));
    for (const i of worldTiles) loadImg(key('w', i));
  }

  CL.assets = { imgs, heroFrames, allyArt, enemyArt, key, preload };
})(typeof window !== 'undefined' ? window : globalThis);
