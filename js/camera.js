// @ts-check
/* Crownless battle camera (PROTO-A, the camera test run; design §6.2, §24.6). Groundwork for V2-05.
 *
 * Battles are simulated in world pixels. A normal battle map is one screen (960×540), so the camera
 * stays at 0,0 and nothing changes. A larger arena (`width`/`height` on the battle map) is drawn
 * through the camera, which follows the hero with damping and stops at the arena's edges:
 *
 *   screenX = worldX - camera.x        worldX = screenX + camera.x     (no zoom yet)
 *
 * The camera lives in CL.game.camera (transient: { x, y } top-left in world pixels). It moves in
 * `follow`, called from the battle's update, so it is the same in the browser and in tests. Input in
 * battles is not positional today (joystick, buttons, keys), so only drawing uses the transform. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const FOLLOW = 6; // how quickly the camera catches up (per second); higher is stiffer
  const LEAD = 0.25; // seconds of the hero's movement to look ahead

  /** The world size of a battle map: its own, or one screen. */
  const worldSize = (m) => ({ w: m?.width || CL.W, h: m?.height || CL.H });

  /** Where the camera should be: centred on the hero (a little ahead), within the arena. */
  function target(g) {
    const { w, h } = worldSize(g.battleMap);
    const hero = g.hero;
    if (!hero) return { x: 0, y: 0 };
    // A moment's look elsewhere (tapping the minimap, V2-06), then back to the hero.
    const f = CL.tactics?.focusPoint(g);
    const lead = f ? { x: 0, y: 0 } : g.joystick || { x: 0, y: 0 };
    const [px, py] = f ? [f.x, f.y] : [hero.x, hero.y];
    const cx = px + lead.x * hero.speed * LEAD - CL.W / 2;
    const cy = py + lead.y * hero.speed * LEAD - CL.H / 2;
    return { x: Math.max(0, Math.min(w - CL.W, cx)), y: Math.max(0, Math.min(h - CL.H, cy)) };
  }

  /** Put the camera straight on its target (a battle starting). @param {any} g */
  function snap(g) {
    g.camera = target(g);
    return g.camera;
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
    return { x: cam.x, y: cam.y, w: CL.W, h: CL.H };
  }

  /** Is a world point within the view, with a margin in pixels? @param {any} g */
  function visible(g, x, y, margin = 0) {
    const v = view(g);
    return x >= v.x - margin && x <= v.x + v.w + margin && y >= v.y - margin && y <= v.y + v.h + margin;
  }

  /** @param {any} g @param {number} x @param {number} y */
  const toScreen = (g, x, y) => ({ x: x - (g.camera?.x || 0), y: y - (g.camera?.y || 0) });
  /** @param {any} g @param {number} x @param {number} y */
  const toWorld = (g, x, y) => ({ x: x + (g.camera?.x || 0), y: y + (g.camera?.y || 0) });

  /** Does this battle need a moving camera at all? @param {any} g */
  const scrolls = (g) => {
    const { w, h } = worldSize(g.battleMap);
    return w > CL.W || h > CL.H;
  };

  CL.camera = { FOLLOW, LEAD, worldSize, target, snap, follow, view, visible, toScreen, toWorld, scrolls };
})(typeof window !== 'undefined' ? window : globalThis);
