/* Crownless boot and main loop. Must load last. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { diag } = CL;

  // P9-07: the content packs turned on are applied first, before anything reads the content. With
  // none on (most games) the game starts at once; with some, it waits for IndexedDB.
  if (CL.packs.onIds().length) CL.packs.boot().then(start, (e) => {
    diag.log('error', 'Packs failed at boot', { error: String(e) });
    start();
  });
  else start();

  function start() {
    CL.content.init();
    CL.settings.load(); // device settings: volumes, battle size, effects
    CL.audio.bind();
    const fresh = CL.worlds.takeNewGame(); // P9-08: a new game in the world just chosen
    CL.campaign = CL.save.load();
    // P9-08: the save belongs to another world this build has: open that world (the save is untouched).
    const there = CL.save.elsewhere;
    if (there && !fresh) {
      if (CL.worlds.chosen() !== there) {
        CL.worlds.switchTo(there);
        return;
      }
      CL.save.notice = `Your save belongs to ${CL.worlds.name(there)}, which could not be opened. It has been kept safe and nothing will overwrite it.`;
    }
    CL.save.bindTabs();
    CL.assets.preload();

    CL.ui.$('#stage').dataset.dev = CL.dev ? 'on' : 'off';
    root.addEventListener('resize', () => CL.ui.fitHud());
    // The HUD re-fits whenever its panels change size, not only on a window resize: a button's text
    // changing ("Wait" → "Stop waiting") or a new text size (W-01) would otherwise let the top-left
    // panel run under the buttons.
    if (root.ResizeObserver) {
      let queued = false; // fitting changes the panel being watched, so wait a frame (no observer loop)
      const hud = new root.ResizeObserver(() => {
        if (queued) return;
        queued = true;
        root.requestAnimationFrame(() => {
          queued = false;
          CL.ui.fitHud();
        });
      });
      for (const id of ['#topLeft', '#topRight']) hud.observe(CL.ui.$(id));
    }
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
        // The experimental graphics demo (Debug panel) runs instead of the game while open: nothing of the
        // real campaign updates, travels, autosaves or draws until it is closed (js/gfx/demo.js).
        if (CL.gfxDemo?.active) {
          CL.gfxDemo.frame(dt);
          requestAnimationFrame(loop);
          return;
        }
        const t0 = performance.now();
        CL.combat.update(dt);
        CL.world.update(dt);
        CL.mapView.update(dt); // the map camera follows the party (W-02)
        CL.debugTools.stressFrame(dt); // the Debug panel's map stress test, if running (W-07)
        CL.town.update(dt);
        const t1 = performance.now();
        CL.render.draw();
        CL.tips.tick(ts); // situation tips (low food, points to spend, wounded)
        const t2 = performance.now();
        // Frame timing for the diagnostics panel (smoothed), and a stress battle's tally.
        diag.simMs = diag.simMs * 0.95 + (t1 - t0) * 0.05;
        diag.drawMs = diag.drawMs * 0.95 + (t2 - t1) * 0.05;
        if (CL.game.mode === 'map') CL.mapView.testFrame(t1 - t0, t2 - t1, dt); // the Debug panel's map test, if running
        const ft = CL.game.mode === 'battle' && !CL.game.paused && !CL.game.overview && CL.game.t > 1 ? CL.game.frameTally : null;
        if (ft) {
          ft.frames++;
          ft.ms += dt * 1000;
        }
        const p = CL.game.mode === 'battle' && !CL.game.paused ? CL.game.practice : null;
        if (p) {
          p.frames++;
          p.sim += t1 - t0;
          p.draw += t2 - t1;
          if (CL.game.t > 1) p.worst = Math.max(p.worst, dt * 1000); // from the second second: not the frame that set the battle up (P9-B1)
          const g = CL.game;
          const live = (l) => l.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
          p.peak = Math.max(p.peak, (g.hero.alive ? 1 : 0) + live(g.allies) + live(g.enemies));
        }
        CL.debugTools.benchFrame(); // the Debug panel's battle benchmark, if running (P9-B1)
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
    if (fresh) {
      CL.game.newGame = true;
      CL.ui.changeMode('create');
    }
    if (CL.save.notice) CL.ui.message(CL.save.notice);
    if (CL.packs.problems().length) CL.ui.message(`A pack was left out: ${CL.packs.problems()[0]} (Settings lists your packs).`); // P9-07
    diag.log('info', 'Crownless booted', { build: CL.BUILD, assetCount: diag.assets.requested });
    requestAnimationFrame(loop);
  }
})(typeof window !== 'undefined' ? window : globalThis);
