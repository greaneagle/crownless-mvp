/* Crownless Art gallery viewer (Debug → Art gallery). The host for js/gfx/gallery.js: its own canvas,
 * loop, keys, taps and a small bar. Nothing here is loaded until the Debug button is pressed
 * (js/debug.js loads js/gfx/gallery.js and this file then). From P10-G6 it replaces the graphics demo,
 * whose map, city and battle are now the game itself.
 *
 * The campaign is never touched: the gallery only reads the content and the art kit. While it is open the
 * main loop (js/main.js) hands each frame here, so the world does not move, and CL.save.write refuses (one
 * guard line in js/save.js), so nothing is saved. On exit the screen is as it was. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const doc = root.document;

  const W = 960;
  const H = 540;

  const D = {
    active: false,
    keys: new Set(),
    state: null,
    canvas: null,
    ctx: null,
    k: 1,
    showStats: false,
    stats: { fps: 0, draw: 0, frames: 0, since: 0 },
    listeners: [],
    entries: 0,
    mode: null,
  };

  const S = () => CL.gfx.scenes.gallery;

  function enter() {
    if (D.active) return true;
    const g = CL.game;
    if (g.mode === 'battle' || g.mode === 'prepare') {
      CL.ui.message?.('Finish the battle first');
      return false;
    }
    D.mode = g.mode;
    D.active = true;
    D.entries++;
    D.state = { t: 0 };
    try {
      const stage = doc.querySelector('#stage');
      stage.dataset.gallery = 'on';
      mount(stage);
      S().init(D.state, api);
      S().enter?.(D.state, api);
    } catch (e) {
      CL.diag?.log('error', 'Art gallery failed to open', { error: String(e), stack: e?.stack });
      exit();
      throw e;
    }
    CL.diag?.log('info', 'Art gallery opened', { entries: D.entries });
    return true;
  }

  function exit() {
    if (!D.active) return false;
    S()?.leave?.(D.state, api);
    for (const [target, type, fn, opts] of D.listeners) target.removeEventListener(type, fn, opts);
    D.listeners = [];
    D.canvas?.remove();
    doc.querySelector('#galleryUi')?.remove();
    doc.querySelector('#galleryCss')?.remove();
    D.canvas = null;
    D.ctx = null;
    CL.gfx.dropCaches();
    delete doc.querySelector('#stage').dataset.gallery;
    D.active = false;
    D.state = null;
    D.keys.clear();
    // Nothing is held after the gallery.
    const g = CL.game;
    if (g.hold) for (const k of Object.keys(g.hold)) g.hold[k] = false;
    if (g.joystick) Object.assign(g.joystick, { x: 0, y: 0 });
    CL.ui.changeMode?.(D.mode || g.mode);
    CL.diag?.log('info', 'Art gallery closed', {});
    return true;
  }

  /** One frame (called by the main loop while the gallery is open). */
  function frame(dt) {
    if (!D.active) return;
    dt = Math.min(0.1, Math.max(0, dt));
    D.state.t += dt;
    S().update?.(D.state, dt, api);
    const t0 = performance.now();
    fit();
    const ctx = D.ctx;
    ctx.setTransform(D.k, 0, 0, D.k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    S().draw(ctx, D.state, api);
    const t1 = performance.now();
    const st = D.stats;
    st.draw = st.draw * 0.9 + (t1 - t0) * 0.1;
    st.frames++;
    if (t1 - st.since > 1000) {
      st.fps = Math.round((st.frames * 1000) / (t1 - st.since));
      st.frames = 0;
      st.since = t1;
      if (D.showStats) {
        const box = doc.querySelector('#galleryStats');
        if (box) box.textContent = `${st.fps} fps · draw ${st.draw.toFixed(2)} ms · canvas ${D.canvas.width}×${D.canvas.height}`;
      }
    }
  }

  /** The canvas at the screen's real pixels, capped by the game's Sharpness setting (P10-G1). */
  function fit() {
    const c = D.canvas;
    const r = c.getBoundingClientRect();
    const cap = CL.settings?.SHARPNESS?.[CL.settings.get('sharpness')] ?? 2;
    const pw = Math.max(320, Math.round(r.width * Math.min(cap || 1, root.devicePixelRatio || 1)));
    const ph = Math.round((pw * H) / W);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
      D.ctx.imageSmoothingEnabled = true;
      CL.gfx.dropCaches();
    }
    D.k = c.width / W;
  }

  function mount(stage) {
    const c = doc.createElement('canvas');
    c.id = 'galleryCanvas';
    c.width = W;
    c.height = H;
    c.setAttribute('aria-label', 'Art gallery');
    stage.insertBefore(c, doc.querySelector('#hud'));
    D.canvas = c;
    D.ctx = c.getContext('2d');
    const ui = doc.createElement('div');
    ui.id = 'galleryUi';
    ui.innerHTML = `<div id="galleryBar" role="toolbar" aria-label="Art gallery"><button id="galleryStatsBtn" title="Frame rate and drawing time">Stats</button><button id="galleryExit" title="Back to your game, exactly as it was">Close gallery</button></div><div id="galleryStats" class="hidden" aria-live="off"></div>`;
    stage.appendChild(ui);
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'js/gfx/viewer.css';
    link.id = 'galleryCss';
    doc.head.appendChild(link);
    ui.querySelector('#galleryExit').onclick = () => exit();
    ui.querySelector('#galleryStatsBtn').onclick = () => {
      D.showStats = !D.showStats;
      ui.querySelector('#galleryStats').classList.toggle('hidden', !D.showStats);
    };
    listen(root, 'keydown', onKey, true);
    listen(root, 'keyup', onKeyUp, true);
    listen(root, 'blur', () => D.keys.clear());
    listen(c, 'pointerup', (e) => S().pointer?.(D.state, 'up', toLogical(e), api, e));
    listen(c, 'contextmenu', (e) => e.preventDefault());
    fit();
  }

  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    D.listeners.push([target, type, fn, opts]);
  }

  function onKey(e) {
    if (!D.active || e.target.closest?.('input, select, textarea')) return;
    stop(e);
    if (e.code === 'Escape') return exit();
    D.keys.add(e.code);
    if (!e.repeat) S().key?.(D.state, e.code, true, api, e);
  }
  function onKeyUp(e) {
    if (!D.active) return;
    D.keys.delete(e.code);
    stop(e);
  }
  function stop(e) {
    e.stopImmediatePropagation();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
  }

  /** Screen position to the gallery's 960×540 logical frame. */
  function toLogical(e) {
    const r = D.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  /** What the gallery scene may use. */
  const api = {
    W,
    H,
    keys: D.keys,
    get k() {
      return D.k;
    },
    prompt() {},
    textScale: () => CL.settings?.textScale?.() || 1,
  };

  CL.artGallery = {
    get active() {
      return D.active;
    },
    get state() {
      return D.state;
    },
    get entries() {
      return D.entries;
    },
    listenerCount: () => D.listeners.length,
    enter,
    exit,
    frame,
    api,
  };
})(typeof window !== 'undefined' ? window : globalThis);
