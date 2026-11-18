// @ts-check
/* Crownless battle camera (PROTO-A, the camera test run; design §6.2, §24.6). Groundwork for V2-05.
 *
 * Battles are simulated in world pixels. A normal battle map is one screen (960×540), so the camera
 * stays at 0,0 and nothing changes. A larger arena (`width`/`height` on the battle map) is drawn
 * through the camera, which follows the hero with damping and stops at the arena's edges:
 *
 *   screenX = (worldX - camera.x) × zoom        worldX = screenX / zoom + camera.x
 *
 * The camera lives in CL.game.camera (transient: { x, y, zoom }, top-left in world pixels). It moves
 * in `follow`, called from the battle's update, so it is the same in the browser and in tests. Input in
 * battles is not positional (joystick, buttons, keys), except the minimap and overview taps.
 *
 * Zoom (W-03): 0.75× to 1.5× on a large field (a one-screen field stays at 1×, with nothing more to
 * show), set by pinching the field, the mouse wheel or the zoom button, and kept as a device setting.
 * It only changes what is drawn: what the company can see (V2-06) is still judged by a 1× view around
 * the same centre, so no zoom changes a rule. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const FOLLOW = 6; // how quickly the camera catches up (per second); higher is stiffer
  const LEAD = 0.25; // seconds of the hero's movement to look ahead
  const ZOOM = { min: 0.75, max: 1.5 }; // decision D-Z1
  const ZOOM_OUT = 0.75; // the zoom button's other setting

  /** The current zoom (1 without a camera). @param {any} g */
  const zoomOf = (g) => g.camera?.zoom || 1;

  /** The world size of a battle map: its own, or one screen. */
  const worldSize = (m) => ({ w: m?.width || CL.W, h: m?.height || CL.H });

  /** The zoom range of this battle: 0.75–1.5 on a large field (never wider than the field), else 1. @param {any} g */
  function zoomRange(g) {
    const { w, h } = worldSize(g.battleMap);
    if (!(w > CL.W || h > CL.H)) return { min: 1, max: 1 };
    return { min: Math.max(ZOOM.min, Math.round(Math.max(CL.W / w, CL.H / h) * 1000) / 1000), max: ZOOM.max };
  }

  /** A zoom kept within this battle's range. @param {any} g @param {number} z */
  function clampZoom(g, z) {
    const r = zoomRange(g);
    return Math.max(r.min, Math.min(r.max, Number.isFinite(z) ? z : 1));
  }

  /** Where the camera should be: centred on the hero (a little ahead), within the arena. */
  function target(g) {
    const { w, h } = worldSize(g.battleMap);
    const hero = g.hero;
    if (!hero) return { x: 0, y: 0 };
    const z = zoomOf(g);
    const [vw, vh] = [CL.W / z, CL.H / z];
    // A moment's look elsewhere (tapping the minimap, V2-06), then back to the hero.
    const f = CL.tactics?.focusPoint(g);
    const lead = f ? { x: 0, y: 0 } : g.joystick || { x: 0, y: 0 };
    const [px, py] = f ? [f.x, f.y] : [hero.x, hero.y];
    const cx = px + lead.x * hero.speed * LEAD - vw / 2;
    const cy = py + lead.y * hero.speed * LEAD - vh / 2;
    return { x: Math.max(0, Math.min(w - vw, cx)), y: Math.max(0, Math.min(h - vh, cy)) };
  }

  /** Put the camera straight on its target (a battle starting), at the device's zoom. @param {any} g */
  function snap(g) {
    g.camera = { x: 0, y: 0, zoom: clampZoom(g, Number(CL.settings?.get('battleZoom')) || 1) };
    Object.assign(g.camera, target(g));
    return g.camera;
  }

  /**
   * Zoom to `z` (within the range), keeping the view's centre, then stay inside the field; the follow
   * brings the hero back into the middle. Returns the zoom. @param {any} g @param {number} z
   */
  function setZoom(g, z) {
    if (!g.camera) snap(g);
    const cam = g.camera;
    const before = zoomOf(g);
    const next = clampZoom(g, z);
    const [mx, my] = [cam.x + CL.W / before / 2, cam.y + CL.H / before / 2];
    cam.zoom = next;
    const { w, h } = worldSize(g.battleMap);
    const [vw, vh] = [CL.W / next, CL.H / next];
    cam.x = Math.max(0, Math.min(w - vw, mx - vw / 2));
    cam.y = Math.max(0, Math.min(h - vh, my - vh / 2));
    return next;
  }

  /** Keep the zoom as the device setting (after a pinch, the wheel or the button). @param {any} g */
  function remember(g) {
    const z = Math.round(zoomOf(g) * 100) / 100;
    if (CL.settings && CL.settings.get('battleZoom') !== z) CL.settings.set('battleZoom', z);
  }

  /** The zoom button: 1× ↔ 0.75× (or the field's widest). @param {any} g */
  function toggleZoom(g) {
    const z = zoomOf(g) > clampZoom(g, ZOOM_OUT) + 1e-3 ? ZOOM_OUT : 1;
    setZoom(g, z);
    remember(g);
    return zoomOf(g);
  }

  /** Ease the camera toward the hero. @param {any} g @param {number} dt seconds */
  function follow(g, dt) {
    if (!g.camera) return snap(g);
    const t = target(g);
    const k = 1 - Math.exp(-FOLLOW * Math.max(0, dt));
    g.camera.x += (t.x - g.camera.x) * k;
    g.camera.y += (t.y - g.camera.y) * k;
    return g.camera;
  }

  /** The world rectangle on screen, for drawing only what's visible. @param {any} g */
  function view(g) {
    const cam = g.camera || { x: 0, y: 0 };
    const z = zoomOf(g);
    return { x: cam.x, y: cam.y, w: CL.W / z, h: CL.H / z };
  }

  /**
   * The 1× view around the same centre (inside the field): what the company "sees" on screen for the
   * rules (V2-06), whatever the zoom. At 1× it is the view itself. @param {any} g
   */
  function sightView(g) {
    const v = view(g);
    const { w, h } = worldSize(g.battleMap);
    const x = Math.max(0, Math.min(w - CL.W, v.x + v.w / 2 - CL.W / 2));
    const y = Math.max(0, Math.min(h - CL.H, v.y + v.h / 2 - CL.H / 2));
    return { x: zoomOf(g) === 1 ? v.x : x, y: zoomOf(g) === 1 ? v.y : y, w: CL.W, h: CL.H };
  }

  /** Is a world point inside the 1× sight view? @param {any} g */
  function inSightView(g, x, y) {
    const v = sightView(g);
    return x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
  }

  /** Is a world point within the view, with a margin in pixels? @param {any} g */
  function visible(g, x, y, margin = 0) {
    const v = view(g);
    return x >= v.x - margin && x <= v.x + v.w + margin && y >= v.y - margin && y <= v.y + v.h + margin;
  }

  /** @param {any} g @param {number} x @param {number} y */
  const toScreen = (g, x, y) => ({ x: (x - (g.camera?.x || 0)) * zoomOf(g), y: (y - (g.camera?.y || 0)) * zoomOf(g) });
  /** @param {any} g @param {number} x @param {number} y */
  const toWorld = (g, x, y) => ({ x: x / zoomOf(g) + (g.camera?.x || 0), y: y / zoomOf(g) + (g.camera?.y || 0) });

  /** Does this battle need a moving camera at all? @param {any} g */
  const scrolls = (g) => {
    const { w, h } = worldSize(g.battleMap);
    return w > CL.W || h > CL.H;
  };

  CL.camera = { FOLLOW, LEAD, ZOOM, ZOOM_OUT, zoomOf, zoomRange, clampZoom, worldSize, target, snap, setZoom, remember, toggleZoom, follow, view, sightView, inSightView, visible, toScreen, toWorld, scrolls };
})(typeof window !== 'undefined' ? window : globalThis);
