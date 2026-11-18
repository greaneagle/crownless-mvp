// @ts-check
/* Crownless world-map camera (W-02): pan and zoom over the strategic map, kept apart from the rules.
 *
 * The map is laid out in "world pixels": CL.world.toPx, the 2.0 projection (1 map unit = 8.8 px
 * across and 4.96 px down, inside a margin of 40 × 22 px). The camera looks at a map point (cx, cy)
 * at a zoom factor:
 *
 *   screen = (worldPx − worldPx(cx, cy)) × zoom + canvas centre        toMap is its exact inverse
 *
 * At 1× on the 100 × 100 Border March the whole map exactly fills the 960 × 540 canvas, so the camera
 * can't move and the projection is 2.0's (the regression baseline). "Fit" is the zoom at which the
 * whole map (with its margin) fits the canvas: 1× today, about 0.5× once W-05 doubles the map. The
 * zoom runs from "fit" to 2.4× (decision D-Z1); along an axis where the map is smaller than the view
 * it is centred, and clamped only along axes where it is larger.
 *
 * Nothing here touches gameplay: distance, speed, contact and every rule use map units (CL.world).
 * The camera is transient (CL.mapView.state); only the zoom level is kept, as a device setting. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { W, H } = CL;

  const MAX_ZOOM = 2.4;
  const STEPS = [1, 1.6, 2.4]; // the + and − buttons step through "fit" and these
  const FOLLOW_BOX = 0.2; // the party is kept within ±20% of the canvas around its centre
  const FOLLOW_RATE = 5; // per second: how quickly the camera eases after the party
  const KEY_PAN = 520; // canvas px per second while an arrow key is held
  const LABEL_FADE = 0.75; // below this zoom only towns and capitals keep their names
  const EDGE_INSET = 16; // where edge markers sit, in canvas px from the edge

  const state = { cx: 50, cy: 50, zoom: 1, following: true };
  let lastMode = null;
  let lastTravel = null;
  let test = null; // the Debug panel's map drawing test, while it runs

  const view = () => CL.world.VIEW;
  /** The map's size in map units (its world package's `bounds`, W-04). */
  const size = () => CL.world.bounds();
  /** The whole map with its margin, in world pixels. */
  function extent() {
    const v = view();
    const s = size();
    return { w: 2 * v.x0 + s.w * v.sx, h: 2 * v.y0 + s.h * v.sy };
  }
  const round4 = (n) => Math.round(n * 1e4) / 1e4;
  /** The zoom at which the whole map fits the canvas (1 for today's map). */
  const fitZoom = () => Math.min(MAX_ZOOM, round4(Math.min(W / extent().w, H / extent().h)));
  const minZoom = () => fitZoom();
  const maxZoom = () => Math.max(MAX_ZOOM, fitZoom());
  /** "Fit" and the fixed steps above it: what + and − step through. */
  const levels = () => [...new Set([fitZoom(), ...STEPS.filter((z) => z > fitZoom())])];
  const clampZoom = (z) => Math.max(minZoom(), Math.min(maxZoom(), z));

  const toWorld = (mx, my) => CL.world.toPx(mx, my);
  const fromWorld = (px, py) => CL.world.fromPx(px, py);

  /** Map units → canvas pixels through the camera. */
  function toScreen(mx, my) {
    const [px, py] = toWorld(mx, my);
    const [ox, oy] = toWorld(state.cx, state.cy);
    return [(px - ox) * state.zoom + W / 2, (py - oy) * state.zoom + H / 2];
  }

  /** Canvas pixels → map units: the exact inverse of toScreen. */
  function toMap(sx, sy) {
    const [ox, oy] = toWorld(state.cx, state.cy);
    return fromWorld((sx - W / 2) / state.zoom + ox, (sy - H / 2) / state.zoom + oy);
  }

  /** The map area in view, in map units: { x0, y0, x1, y1 }. */
  function visibleRect() {
    const [x0, y0] = toMap(0, 0);
    const [x1, y1] = toMap(W, H);
    return { x0, y0, x1, y1 };
  }

  /** Keep the view on the map: centred along an axis the map doesn't fill, clamped along the others. */
  function clamp() {
    const e = extent();
    let [ox, oy] = toWorld(state.cx, state.cy);
    const half = { w: W / 2 / state.zoom, h: H / 2 / state.zoom };
    ox = 2 * half.w >= e.w ? e.w / 2 : Math.max(half.w, Math.min(e.w - half.w, ox));
    oy = 2 * half.h >= e.h ? e.h / 2 : Math.max(half.h, Math.min(e.h - half.h, oy));
    [state.cx, state.cy] = fromWorld(ox, oy);
  }

  /** Move the view by a drag of (dx, dy) canvas px: the map moves with the finger. */
  function panBy(dx, dy) {
    const [ox, oy] = toWorld(state.cx, state.cy);
    [state.cx, state.cy] = fromWorld(ox - dx / state.zoom, oy - dy / state.zoom);
    clamp();
  }

  /** Zoom by `factor` around canvas point (sx, sy), which stays still under the fingers or cursor. */
  function zoomAt(factor, sx = W / 2, sy = H / 2) {
    const [mx, my] = toMap(sx, sy);
    state.zoom = clampZoom(state.zoom * factor);
    const [px, py] = toWorld(mx, my);
    [state.cx, state.cy] = fromWorld(px - (sx - W / 2) / state.zoom, py - (sy - H / 2) / state.zoom);
    clamp();
  }

  /** Set a zoom level (around the canvas centre, or the party while following). */
  function setZoom(z) {
    if (state.following) {
      state.zoom = clampZoom(z);
      centre(true);
    } else zoomAt(clampZoom(z) / state.zoom);
  }

  /** The next level up or down from the current zoom (+ and − buttons, keys). */
  function step(dir) {
    const ls = levels();
    const z = state.zoom;
    const next = dir > 0 ? ls.find((l) => l > z + 1e-3) : [...ls].reverse().find((l) => l < z - 1e-3);
    if (next == null) return false;
    setZoom(next);
    remember();
    return true;
  }

  /** The party's map position. */
  const party = () => CL.campaign?.world || { x: 50, y: 50 };

  /** Back to the party, and follow it again. */
  function centre(snap = true) {
    state.following = true;
    if (snap) [state.cx, state.cy] = [party().x, party().y];
    clamp();
  }

  /** Keep the party inside a central box, easing after it (a no-op while the whole map fits). */
  function follow(p, dt) {
    if (!state.following) return;
    const [sx, sy] = toScreen(p.x, p.y);
    const bx = W * FOLLOW_BOX;
    const by = H * FOLLOW_BOX;
    const over = (v, c, b) => (v > c + b ? v - (c + b) : v < c - b ? v - (c - b) : 0);
    const dx = over(sx, W / 2, bx);
    const dy = over(sy, H / 2, by);
    if (!dx && !dy) return;
    const k = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, dt));
    const [ox, oy] = toWorld(state.cx, state.cy);
    [state.cx, state.cy] = fromWorld(ox + (dx * k) / state.zoom, oy + (dy * k) / state.zoom);
    clamp();
  }

  /** A manual pan or zoom: stop following until the next journey or Centre. */
  function release() {
    state.following = false;
  }

  /**
   * Where to point at an off-screen map point: { x, y, angle } on the canvas edge, or null when it is
   * in view. For the contract target, quest bands and the party itself when panned away.
   */
  function edgeMarker(mx, my) {
    const [sx, sy] = toScreen(mx, my);
    if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) return null;
    const [dx, dy] = [sx - W / 2, sy - H / 2];
    const t = Math.min((W / 2 - EDGE_INSET) / Math.abs(dx || 1e-9), (H / 2 - EDGE_INSET) / Math.abs(dy || 1e-9));
    return { x: W / 2 + dx * t, y: H / 2 + dy * t, angle: Math.atan2(dy, dx) };
  }

  /** Whether a map point (within `margin` canvas px) is in view: the renderer's culling test. */
  function inView(mx, my, margin = 40) {
    const [sx, sy] = toScreen(mx, my);
    return sx >= -margin && sx <= W + margin && sy >= -margin && sy <= H + margin;
  }

  /** Names of minor places fade out when zoomed far out (towns and capitals keep theirs). */
  const showMinorLabels = () => state.zoom >= LABEL_FADE;

  /** The device's remembered zoom (W-02: a setting), within this map's range. */
  function restore() {
    // The player's own zoom, or the world's opening one (W-04 `view.zoom`) until they pick one.
    state.zoom = clampZoom(Number(CL.settings?.get('mapZoom')) || CL.world.map().view?.zoom || 1);
  }

  /** Keep the current zoom as the device setting (after a gesture, not on every frame of it). */
  function remember() {
    const z = Math.round(state.zoom * 100) / 100;
    if (CL.settings && CL.settings.get('mapZoom') !== z) CL.settings.set('mapZoom', z);
  }

  /** Arrow keys pan on desktop (WASD stays for battle). */
  function keyPan(dt) {
    const h = CL.game.hold || {};
    const dx = (h.ArrowRight ? 1 : 0) - (h.ArrowLeft ? 1 : 0);
    const dy = (h.ArrowDown ? 1 : 0) - (h.ArrowUp ? 1 : 0);
    if (!dx && !dy) return;
    release();
    panBy(-dx * KEY_PAN * dt, -dy * KEY_PAN * dt);
  }

  /** Once per frame: on entering the map look at the party; resume following when a journey starts. */
  function update(dt) {
    const g = CL.game;
    if (g.mode !== lastMode) {
      if (g.mode === 'map' && lastMode !== 'map') {
        restore();
        centre(true);
      }
      lastMode = g.mode;
    }
    if (g.mode !== 'map') return;
    if (g.travel && g.travel !== lastTravel) centre(false); // a new journey: follow again
    lastTravel = g.travel;
    if (test) return runTest(dt);
    keyPan(dt);
    follow(party(), dt);
  }

  /** Forget the camera (a new or loaded game): the next map visit starts on the party. */
  function reset() {
    lastMode = null;
    lastTravel = null;
    Object.assign(state, { cx: 50, cy: 50, following: true });
    restore();
  }

  // ---- The Debug panel's map drawing test (W-02): fps and drawing time at "fit" and at 2.4× ----

  const TEST_SECONDS = 4;

  /** Start it: the whole map at "fit", then 2.4× while panning around. `done(result)` at the end. */
  function startTest(done) {
    test = { phase: 0, t: 0, saved: { ...state }, done, runs: [] };
    beginPhase();
  }

  function beginPhase() {
    const zoom = test.phase === 0 ? fitZoom() : maxZoom();
    test.run = { zoom, frames: 0, draw: 0, sim: 0, worst: 0, seconds: 0 };
    test.t = 0;
    state.zoom = zoom;
    state.following = false;
  }

  /** The camera circles the map so the cache, culling and drawing are all exercised. */
  function runTest(dt) {
    test.t += dt;
    const s = size();
    const a = (test.t / TEST_SECONDS) * Math.PI * 2;
    state.cx = s.w / 2 + Math.cos(a) * s.w * 0.35;
    state.cy = s.h / 2 + Math.sin(a) * s.h * 0.35;
    clamp();
  }

  /** The main loop reports each frame's cost while the test runs. */
  function testFrame(simMs, drawMs, dt) {
    if (!test) return;
    const r = test.run;
    r.frames++;
    r.sim += simMs;
    r.draw += drawMs;
    r.worst = Math.max(r.worst, dt * 1000);
    r.seconds += dt;
    if (test.t < TEST_SECONDS) return;
    test.runs.push({ zoom: r.zoom, fps: Math.round(r.frames / Math.max(0.001, r.seconds)), drawMs: Number((r.draw / Math.max(1, r.frames)).toFixed(2)), simMs: Number((r.sim / Math.max(1, r.frames)).toFixed(2)), worstFrameMs: Math.round(r.worst) });
    if (++test.phase < 2) return beginPhase();
    const { saved, done, runs } = test;
    test = null;
    Object.assign(state, saved);
    clamp();
    done?.({ runs, canvas: CL.render?.backingScale?.() ?? 1, textSize: CL.settings?.get('textSize') ?? 'normal' });
  }

  const testing = () => Boolean(test);

  CL.mapView = {
    MAX_ZOOM,
    STEPS,
    LABEL_FADE,
    state,
    extent,
    fitZoom,
    minZoom,
    maxZoom,
    levels,
    toScreen,
    toMap,
    visibleRect,
    clamp,
    panBy,
    zoomAt,
    setZoom,
    step,
    centre,
    follow,
    release,
    edgeMarker,
    inView,
    showMinorLabels,
    restore,
    remember,
    update,
    reset,
    startTest,
    testFrame,
    testing,
  };
})(typeof window !== 'undefined' ? window : globalThis);
