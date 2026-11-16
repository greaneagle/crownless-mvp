/* Crownless boot and main loop. Must load last. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { diag } = CL;

  CL.content.init();
  CL.campaign = CL.save.load();
  CL.assets.preload();

  const canvas = CL.ui.$('#game');
  CL.render.init(canvas);
  CL.input.bind(canvas);
  CL.debugTools.bind();

  let last = performance.now();
  function loop(ts) {
    try {
      const dt = (ts - last) / 1000;
      last = ts;
      CL.combat.update(dt);
      CL.world.update(dt);
      CL.town.update(dt);
      CL.render.draw();
      diag.frames++;
      if (ts - diag.lastFps > 1000) {
        diag.fps = Math.round((diag.frames * 1000) / (ts - diag.lastFps));
        diag.frames = 0;
        diag.lastFps = ts;
        if (CL.ui.isDebugOpen()) CL.ui.renderDebug();
      }
    } catch (e) {
      diag.log('error', 'Frame exception', { message: String(e), stack: e.stack });
    }
    requestAnimationFrame(loop);
  }

  CL.ui.changeMode('title');
  diag.log('info', 'Crownless booted', { build: CL.BUILD, assetCount: diag.assets.requested });
  requestAnimationFrame(loop);
})(typeof window !== 'undefined' ? window : globalThis);
