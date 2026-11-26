/* Crownless sprite loading. From P10-G5 the game loads no sprites: everything it shows is drawn by the
 * art kit (js/art/, D-P10k). What is left is an empty loader, removed with the image files in P10-G6. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const imgs = {};

  /** Nothing to load: the last sprite (the hero's, in the creator and on the party sheet) went in P10-G5. */
  function preload() {}

  CL.assets = { imgs, preload };
})(typeof window !== 'undefined' ? window : globalThis);
