/* Crownless graphics demonstration (experimental; Debug → Graphics Demo — New Art Direction).
 *
 * The runtime: entering, leaving and resetting the demo, its own canvas, loop, input and panel.
 * Nothing here is loaded until the Debug button is pressed (js/debug.js loads js/gfx/*.js then).
 *
 * Isolation (the campaign must not change):
 *   - CL.campaign is swapped for a deep copy while the demo runs, and the real one put back on exit.
 *   - CL.game keeps its identity (js/input.js holds a reference to it), but its contents are swapped:
 *     every own property is kept aside on entry, the demo works on a sandbox copy, and on exit the
 *     object is emptied and the kept properties put back, exactly.
 *   - CL.save.write refuses while `active` (one guard line in js/save.js), so no autosave, page hide,
 *     battle end or screen change can write the save. The demo itself never writes storage or settings.
 *   - The main loop (js/main.js) hands each frame to `frame` while active, so the real world, town and
 *     battle never update: no clock, no parties, no autosave. Nothing in the demo is kept after a reload.
 *   - The battle uses the real combat code (js/combat.js) as a practice battle on the sandbox; the battle
 *     size is set for it and put back on exit.
 * Input: the demo's own listeners are added on entry and removed on exit (no duplicates on re-entry).
 * Keys go to the real input code only in the battle scene, where the normal controls should work. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const doc = root.document;

  const W = 960;
  const H = 540;
  const SCENES = ['map', 'city', 'battle', 'gallery'];
  const SCENE_NAMES = { map: 'Map', city: 'City', battle: 'Battle', gallery: 'Gallery' };
  const TIMES = { day: 0, dusk: 0.5, night: 1 };

  /** Battle-relevant fields of CL.game that the demo starts empty (the rest are copied). */
  const FRESH = () => ({
    mode: 'gfxdemo',
    hold: {},
    joystick: { x: 0, y: 0 },
    attackHeld: false,
    blockHeld: false,
    attackQueuedAt: null,
    paused: false,
    overview: false,
    hero: null,
    allies: [],
    enemies: [],
    arrows: [],
    effects: [],
    result: null,
    practice: null,
    duel: null,
    battleMap: null,
    camera: null,
    travel: null,
    town: null,
    talk: null,
    waiting: false,
    waitPlan: null,
    contactParty: null,
    siteId: null,
    partyId: null,
    message: '',
    messageUntil: 0,
  });

  const D = {
    active: false,
    scene: null,
    keys: new Set(),
    night: 0,
    time: 'day',
    sharp: 'device',
    art: 'new', // 'new' or 'current' (the battle drawn by the game's own renderer, for comparison)
    showStats: false,
    state: null, // the demo's own world: map, city, battle (rebuilt by reset)
    kept: null, // what was put aside on entry
    canvas: null,
    ctx: null,
    k: 1,
    stats: { fps: 0, sim: 0, draw: 0, frames: 0, since: 0, worst: 0, last: 0 },
    listeners: [],
    entries: 0,
    log: [],
  };

  // ---- Entry and exit ----

  /** Deep-copy what can be copied (the campaign is plain data). */
  function clone(v) {
    try {
      return root.structuredClone ? root.structuredClone(v) : JSON.parse(JSON.stringify(v));
    } catch {
      return JSON.parse(JSON.stringify(v));
    }
  }

  function enter(scene = 'map') {
    if (D.active) return go(scene);
    const g = CL.game;
    if (g.mode === 'battle' || g.mode === 'prepare') {
      CL.ui.message?.('Finish the battle first');
      return false;
    }
    const kept = { game: { ...g }, campaign: CL.campaign, cap: CL.combat.BATTLE.activeCap, stage: {}, attackText: null };
    const stage = doc.querySelector('#stage');
    for (const k of ['mode', 'field']) kept.stage[k] = stage.dataset[k];
    kept.attackText = doc.querySelector('#attackBtn')?.textContent ?? null;
    D.kept = kept;
    // The sandbox campaign: a deep copy; a hero if the real one has none yet (title screen).
    const sandbox = CL.campaign ? clone(CL.campaign) : CL.save.starter?.();
    if (sandbox && !sandbox.character && CL.character?.create) sandbox.character = CL.character.create({ name: 'Wanderer' });
    CL.campaign = sandbox;
    // The sandbox game: the same object, its contents copied (nested data deep-copied where possible).
    const copy = {};
    for (const [k, v] of Object.entries(kept.game)) {
      if (v && typeof v === 'object') {
        try {
          copy[k] = clone(v);
        } catch {
          copy[k] = v;
        }
      } else copy[k] = v;
    }
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, copy, FRESH());
    D.active = true;
    D.entries++;
    try {
      stage.dataset.gfxdemo = 'on';
      mount(stage);
      reset(false);
      go(scene);
    } catch (e) {
      // Anything that fails while opening puts the game straight back.
      CL.diag?.log('error', 'Graphics demo failed to open', { error: String(e), stack: e?.stack });
      exit();
      throw e;
    }
    note('entered', { scene, entries: D.entries });
    return true;
  }

  function exit() {
    if (!D.active) return false;
    if (D.scene) S()?.leave?.(D.state);
    unmount();
    const g = CL.game;
    const kept = D.kept;
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, kept.game);
    // Nothing is held after the demo (keys and sticks pressed inside it).
    if (g.hold) for (const k of Object.keys(g.hold)) g.hold[k] = false;
    if (g.joystick) Object.assign(g.joystick, { x: 0, y: 0 });
    g.attackHeld = false;
    g.blockHeld = false;
    CL.campaign = kept.campaign;
    CL.combat.BATTLE.activeCap = kept.cap;
    const stage = doc.querySelector('#stage');
    delete stage.dataset.gfxdemo;
    delete stage.dataset.gfxscene;
    for (const [k, v] of Object.entries(kept.stage)) {
      if (v === undefined) delete stage.dataset[k];
      else stage.dataset[k] = v;
    }
    D.active = false;
    D.scene = null;
    D.state = null;
    D.kept = null;
    D.keys.clear();
    // Put the screen back as it was (the same call the game uses to show a screen).
    CL.ui.changeMode?.(g.mode);
    const btn = doc.querySelector('#attackBtn');
    if (btn && kept.attackText != null) btn.textContent = kept.attackText;
    CL.ui.refresh?.();
    note('left', {});
    return true;
  }

  /** A fresh demo world: the player back at the start, the city and battle as new. */
  function reset(redraw = true) {
    const was = D.scene;
    if (was) S()?.leave?.(D.state);
    D.state = { t: 0, from: null, notes: [] };
    for (const name of SCENES) CL.gfx.scenes[name]?.init?.(D.state, api);
    if (redraw && was) go(was, { fresh: true });
    note('reset', {});
  }

  function go(name, opts = {}) {
    if (!D.active || !SCENES.includes(name)) return false;
    const prev = D.scene;
    if (prev && prev !== name) S()?.leave?.(D.state);
    D.scene = name;
    D.keys.clear();
    clearHolds();
    const stage = doc.querySelector('#stage');
    stage.dataset.gfxscene = name;
    if (name !== 'battle') D.art = 'new';
    S()?.enter?.(D.state, api, { from: prev, ...opts });
    refreshPanel();
    note('scene', { scene: name });
    return true;
  }

  const S = () => CL.gfx.scenes[D.scene];

  function clearHolds() {
    const g = CL.game;
    for (const k of Object.keys(g.hold || {})) g.hold[k] = false;
    if (g.joystick) Object.assign(g.joystick, { x: 0, y: 0 });
    g.attackHeld = false;
    g.blockHeld = false;
  }

  // ---- The frame ----

  /** One frame (called by the main loop while the demo is active). */
  function frame(dt) {
    if (!D.active) return;
    const t0 = performance.now();
    const s = S();
    dt = Math.min(0.1, Math.max(0, dt));
    if (!D.paused) {
      D.state.t += dt;
      s?.update?.(D.state, dt, api);
    }
    const t1 = performance.now();
    fit();
    if (D.art === 'current' && D.scene === 'battle') {
      CL.render.draw(); // the game's own renderer on the same live battle (comparison)
    } else {
      const ctx = D.ctx;
      ctx.setTransform(D.k, 0, 0, D.k, 0, 0);
      ctx.clearRect(0, 0, W, H);
      s?.draw?.(ctx, D.state, api);
      if (D.night > 0) nightShade(ctx);
      s?.overlay?.(ctx, D.state, api);
    }
    const t2 = performance.now();
    const st = D.stats;
    st.sim = st.sim * 0.9 + (t1 - t0) * 0.1;
    st.draw = st.draw * 0.9 + (t2 - t1) * 0.1;
    st.frames++;
    st.worst = Math.max(st.worst, dt * 1000);
    if (t2 - st.since > 1000) {
      st.fps = Math.round((st.frames * 1000) / (t2 - st.since));
      st.frames = 0;
      st.since = t2;
      st.lastWorst = Math.round(st.worst);
      st.worst = 0;
      if (D.showStats) showStats();
    }
    s?.hud?.(D.state, api);
  }

  /** Dusk and night: a cool shade over the scene (lit windows and lamps are drawn by the scene). */
  function nightShade(ctx) {
    ctx.save();
    ctx.setTransform(D.k, 0, 0, D.k, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = D.night >= 1 ? '#5a6890' : '#c9a98e';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    S()?.lights?.(ctx, D.state, api);
  }

  // ---- Canvas and panel ----

  function pixelRatio() {
    const dpr = root.devicePixelRatio || 1;
    if (D.sharp === 'device') {
      // The game's own Sharpness setting (P10-G1): Sharp 3, Balanced 2, Fast 1 a CSS pixel.
      const cap = CL.settings?.SHARPNESS?.[CL.settings.get('sharpness')] ?? 2;
      return Math.min(cap || 1, dpr);
    }
    return D.sharp === 'low' ? 1 : D.sharp === '2x' ? Math.min(2, dpr) : Math.min(3, dpr);
  }

  /** Size the backing store to the stage's real pixels (sharp shapes, no pixel-art scaling). */
  function fit() {
    const c = D.canvas;
    const r = c.getBoundingClientRect();
    const pw = Math.max(320, Math.round(r.width * pixelRatio()));
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
    c.id = 'gfxCanvas';
    c.width = W;
    c.height = H;
    c.setAttribute('aria-label', 'Graphics demonstration');
    stage.insertBefore(c, doc.querySelector('#hud'));
    D.canvas = c;
    D.ctx = c.getContext('2d');
    const ui = doc.createElement('div');
    ui.id = 'gfxUi';
    ui.innerHTML = `
      <div id="gfxBar" role="toolbar" aria-label="Graphics demo">
        <button id="gfxMenu" aria-expanded="true" title="Show or hide the demo controls">☰</button>
        <span class="gfxGroup" id="gfxScenes">${SCENES.map((s) => `<button data-gfx-scene="${s}">${SCENE_NAMES[s]}</button>`).join('')}</span>
        <span class="gfxGroup"><button id="gfxTime" title="Time of day">Day</button><button id="gfxArt" title="Draw this battle with the game's current art instead">Old art</button><button id="gfxSharp" title="Canvas resolution: as the Sharpness setting, or 2× or 1× for a test (1× costs far less to draw on a phone)">Res: setting</button><button id="gfxStats" title="Frame rate and drawing time">Stats</button><button id="gfxReset" title="Start the demo over">Reset</button><button id="gfxExit" class="gfxExit" title="Back to your game, exactly as it was">Exit demo</button></span>
      </div>
      <div id="gfxStatsBox" class="hidden" aria-live="off"></div>
      <div id="gfxPrompt" class="hidden"></div>
      <div id="gfxDialog" class="hidden" role="dialog" aria-live="polite"></div>
      <div id="gfxCard" class="hidden" role="dialog"></div>`;
    stage.appendChild(ui);
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'js/gfx/demo.css';
    link.id = 'gfxCss';
    doc.head.appendChild(link);
    ui.querySelector('#gfxMenu').onclick = () => {
      const bar = ui.querySelector('#gfxBar');
      const open = bar.classList.toggle('collapsed');
      ui.querySelector('#gfxMenu').setAttribute('aria-expanded', String(!open));
    };
    for (const b of ui.querySelectorAll('[data-gfx-scene]')) b.onclick = () => go(b.dataset.gfxScene, { direct: true });
    ui.querySelector('#gfxTime').onclick = () => setTime(D.time === 'day' ? 'dusk' : D.time === 'dusk' ? 'night' : 'day');
    ui.querySelector('#gfxArt').onclick = () => setArt(D.art === 'new' ? 'current' : 'new');
    ui.querySelector('#gfxStats').onclick = () => {
      D.showStats = !D.showStats;
      ui.querySelector('#gfxStatsBox').classList.toggle('hidden', !D.showStats);
      showStats();
    };
    ui.querySelector('#gfxSharp').onclick = () => {
      D.sharp = D.sharp === 'device' ? '2x' : D.sharp === '2x' ? 'low' : 'device';
      ui.querySelector('#gfxSharp').textContent = { device: 'Res: setting', '2x': 'Res 2×', low: 'Res 1×' }[D.sharp];
    };
    ui.querySelector('#gfxReset').onclick = () => reset(true);
    ui.querySelector('#gfxExit').onclick = () => exit();
    listen(root, 'keydown', onKey, true);
    listen(root, 'keyup', onKeyUp, true);
    listen(root, 'blur', () => D.keys.clear());
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) S()?.hidden?.(D.state, api);
    });
    listen(c, 'pointerdown', (e) => pointer('down', e));
    listen(c, 'pointermove', (e) => pointer('move', e));
    listen(c, 'pointerup', (e) => pointer('up', e));
    listen(c, 'pointercancel', (e) => pointer('cancel', e));
    listen(c, 'wheel', (e) => {
      e.preventDefault();
      S()?.wheel?.(D.state, e.deltaY, toLogical(e), api);
    }, { passive: false });
    listen(c, 'contextmenu', (e) => e.preventDefault());
    fit();
  }

  function unmount() {
    for (const [target, type, fn, opts] of D.listeners) target.removeEventListener(type, fn, opts);
    D.listeners = [];
    D.canvas?.remove();
    doc.querySelector('#gfxUi')?.remove();
    doc.querySelector('#gfxCss')?.remove();
    D.canvas = null;
    D.ctx = null;
    CL.gfx.dropCaches();
  }

  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    D.listeners.push([target, type, fn, opts]);
  }

  function setTime(name) {
    D.time = name;
    D.night = TIMES[name];
    doc.querySelector('#gfxTime').textContent = name[0].toUpperCase() + name.slice(1);
  }

  function setArt(art) {
    if (D.scene !== 'battle') return;
    D.art = art;
    D.canvas.style.visibility = art === 'current' ? 'hidden' : 'visible';
    doc.querySelector('#stage').dataset.gfxart = art;
    refreshPanel();
  }

  function refreshPanel() {
    const ui = doc.querySelector('#gfxUi');
    if (!ui) return;
    for (const b of ui.querySelectorAll('[data-gfx-scene]')) b.classList.toggle('active', b.dataset.gfxScene === D.scene);
    const art = ui.querySelector('#gfxArt');
    art.classList.toggle('hidden', D.scene !== 'battle');
    art.textContent = D.art === 'current' ? 'New art' : 'Old art';
    if (D.scene !== 'battle' || D.art === 'new') {
      D.canvas.style.visibility = 'visible';
      doc.querySelector('#stage').dataset.gfxart = 'new';
    }
  }

  function showStats() {
    const box = doc.querySelector('#gfxStatsBox');
    if (!box) return;
    const st = D.stats;
    const c = D.canvas;
    box.textContent = `${st.fps} fps · update ${st.sim.toFixed(2)} ms · draw ${st.draw.toFixed(2)} ms · slowest ${st.lastWorst ?? 0} ms · canvas ${c.width}×${c.height}${D.art === 'current' ? ' (current art)' : ''}`;
  }

  // ---- Input ----

  const PASS_IN_BATTLE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyF', 'KeyH', 'KeyC', 'KeyR', 'Digit1', 'Digit2', 'Digit3']);

  function onKey(e) {
    if (!D.active) return;
    if (e.target.closest?.('input, select, textarea')) return;
    const code = e.code;
    D.keys.add(code);
    if (D.scene === 'battle' && PASS_IN_BATTLE.has(code) && D.art !== 'locked') {
      // The battle's own controls (js/input.js), on the sandbox battle.
      if (S()?.key?.(D.state, code, true, api, e) === 'stop') stop(e);
      return;
    }
    stop(e);
    if (code === 'Escape') {
      if (S()?.escape?.(D.state, api)) return;
      return;
    }
    if (!e.repeat) S()?.key?.(D.state, code, true, api, e);
  }
  function onKeyUp(e) {
    if (!D.active) return;
    D.keys.delete(e.code);
    if (D.scene === 'battle' && PASS_IN_BATTLE.has(e.code)) return;
    stop(e);
  }
  function stop(e) {
    e.stopImmediatePropagation();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
  }

  /** Screen position (event) to the demo's 960×540 logical frame. */
  function toLogical(e) {
    const r = D.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  const pointers = new Map();
  function pointer(kind, e) {
    const p = toLogical(e);
    if (kind === 'down') {
      D.canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, p);
    }
    if (kind === 'move' && pointers.has(e.pointerId)) {
      const before = pointers.get(e.pointerId);
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        // Pinch: the distance between two fingers sets the zoom.
        const [a, b] = [...pointers.values()];
        const others = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
        const d0 = Math.hypot(before.x - others.x, before.y - others.y);
        const d1 = Math.hypot(a.x - b.x, a.y - b.y);
        if (d0 > 10) S()?.pinch?.(D.state, d1 / d0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, api);
        return;
      }
    }
    if (kind === 'up' || kind === 'cancel') {
      const many = pointers.size > 1;
      pointers.delete(e.pointerId);
      if (many) return;
    }
    if (pointers.size > 1) return;
    S()?.pointer?.(D.state, kind, p, api, e);
  }

  // ---- Panel helpers for the scenes ----

  /** A prompt above the controls ("Enter Stonebridge"), with optional buttons. */
  function prompt(text, buttons = []) {
    const el = doc.querySelector('#gfxPrompt');
    if (!el) return;
    const key = text + buttons.map((b) => b.label).join('|');
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    if (!text) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = '';
    const span = doc.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    for (const b of buttons) {
      const btn = doc.createElement('button');
      btn.textContent = b.label;
      btn.onclick = b.onClick;
      if (b.id) btn.id = b.id;
      el.appendChild(btn);
    }
  }

  /** A dialogue box: a speaker, their words, and choices. Pass null to close it. */
  function dialog(d) {
    const el = doc.querySelector('#gfxDialog');
    if (!el) return;
    if (!d) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = '';
    const head = doc.createElement('b');
    head.textContent = d.name;
    const role = doc.createElement('small');
    role.textContent = d.role ? ` · ${d.role}` : '';
    const p = doc.createElement('p');
    p.textContent = d.text;
    const row = doc.createElement('div');
    row.className = 'row';
    for (const c of d.choices || []) {
      const btn = doc.createElement('button');
      btn.textContent = c.label;
      btn.onclick = c.onClick;
      row.appendChild(btn);
    }
    el.append(head, role, p, row);
  }

  /** A centred card (an encounter, a result). Pass null to close it. */
  function card(c) {
    const el = doc.querySelector('#gfxCard');
    if (!el) return;
    if (!c) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = '';
    const h = doc.createElement('h2');
    h.textContent = c.title;
    el.appendChild(h);
    for (const line of c.lines || []) {
      const p = doc.createElement('p');
      p.textContent = line;
      el.appendChild(p);
    }
    const row = doc.createElement('div');
    row.className = 'row';
    for (const b of c.buttons || []) {
      const btn = doc.createElement('button');
      btn.textContent = b.label;
      btn.onclick = b.onClick;
      if (b.primary) btn.className = 'primary';
      row.appendChild(btn);
    }
    el.appendChild(row);
  }

  function note(what, data) {
    D.log.push({ what, ...data, at: Math.round(performance.now()) });
    if (D.log.length > 60) D.log.shift();
    CL.diag?.log('info', `Graphics demo: ${what}`, data);
  }

  /** What the scenes may use. */
  const api = {
    W,
    H,
    go,
    prompt,
    dialog,
    card,
    note,
    keys: D.keys,
    get k() {
      return D.k;
    },
    get night() {
      return D.night;
    },
    reduced: () => Boolean(CL.settings?.get?.('reducedEffects')),
    textScale: () => ({ small: 0.9, normal: 1, large: 1.2, larger: 1.4 })[CL.settings?.get?.('textSize')] || 1,
    move() {
      // Keys and the on-screen joystick (js/input.js writes CL.game.joystick), as one vector.
      const k = D.keys;
      const j = CL.game.joystick || { x: 0, y: 0 };
      let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + j.x;
      let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + j.y;
      const m = Math.hypot(x, y);
      if (m > 1) [x, y] = [x / m, y / m];
      return { x, y, m: Math.min(1, m) };
    },
  };

  CL.gfxDemo = {
    get active() {
      return D.active;
    },
    get scene() {
      return D.scene;
    },
    get state() {
      return D.state;
    },
    get stats() {
      return { ...D.stats };
    },
    get art() {
      return D.art;
    },
    get entries() {
      return D.entries;
    },
    listenerCount: () => D.listeners.length,
    log: () => D.log.slice(),
    SCENES,
    enter,
    exit,
    reset,
    go,
    frame,
    setTime,
    setArt,
    setSharpness(v) {
      D.sharp = v;
    },
    api,
  };
})(typeof window !== 'undefined' ? window : globalThis);
