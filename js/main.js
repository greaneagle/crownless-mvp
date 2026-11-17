/* Crownless boot and main loop. Must load last. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { diag } = CL;

  CL.content.init();
  CL.settings.load(); // device settings: volumes, battle size, effects
  CL.audio.bind();
  CL.campaign = CL.save.load();
  CL.save.bindTabs();
  CL.assets.preload();

  CL.ui.$('#stage').dataset.dev = CL.dev ? 'on' : 'off';
  root.addEventListener('resize', () => CL.ui.fitHud());
  const canvas = CL.ui.$('#game');
  CL.render.init(canvas);
  CL.input.bind(canvas);
  CL.debugTools.bind();
  CL.ui.bindSettings();
  CL.ui.bindHelp();
  CL.fullscreen.bind();
  // Every button gives a small click (rate-limited; silent until audio is unlocked by this very tap).
  root.document.addEventListener('click', (e) => e.target.closest?.('button') && CL.audio.play('select', 0.6), true);

  let last = performance.now();
  function loop(ts) {
    try {
      const dt = (ts - last) / 1000;
      last = ts;
      const t0 = performance.now();
      CL.combat.update(dt);
      CL.world.update(dt);
      CL.town.update(dt);
      const t1 = performance.now();
      CL.render.draw();
      CL.tips.tick(ts); // situation tips (low food, points to spend, wounded)
      const t2 = performance.now();
      // Frame timing for the diagnostics panel (smoothed), and a stress battle's tally.
      diag.simMs = diag.simMs * 0.95 + (t1 - t0) * 0.05;
      diag.drawMs = diag.drawMs * 0.95 + (t2 - t1) * 0.05;
      const p = CL.game.mode === 'battle' && !CL.game.paused ? CL.game.practice : null;
      if (p) {
        p.frames++;
        p.sim += t1 - t0;
        p.draw += t2 - t1;
        p.worst = Math.max(p.worst, dt * 1000);
        const g = CL.game;
        const live = (l) => l.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
        p.peak = Math.max(p.peak, (g.hero.alive ? 1 : 0) + live(g.allies) + live(g.enemies));
      }
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
  if (CL.save.notice) CL.ui.message(CL.save.notice);
  diag.log('info', 'Crownless booted', { build: CL.BUILD, assetCount: diag.assets.requested });
  requestAnimationFrame(loop);
})(typeof window !== 'undefined' ? window : globalThis);
