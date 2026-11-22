// @ts-check
/* Crownless battle awareness: detection, the minimap and the tactical overview (V2-06; design §6.3,
 * §6.7, SC-05). Only for battlefields larger than the screen (V2-05); one-screen battles need none.
 *
 * Detection: an enemy is *seen* while it is within SIGHT of the hero or of any living soldier, or on
 * screen. A seen enemy is *detected* from then on and remembers where it was last seen. The minimap
 * and the edge markers show seen enemies where they are, and detected-but-unseen ones as a faded
 * "last seen" mark. Enemies never seen are not shown anywhere (design: no automatic exposure).
 * Detection only informs the player; the soldiers' own AI is unchanged.
 *
 * Minimap: a small overlay at the top centre of the screen, with terrain, the view rectangle, the hero,
 * the company by group, and detected enemies. Tapping or clicking it turns the camera to that spot for
 * a moment (FOCUS_SECONDS), then the camera eases back to the hero.
 *
 * Tactical overview: the whole battlefield at once, with the battle held still while it is open (an
 * accessible default for two-thumb play). Desktop: hold Tab (or toggle with M). Phone: the MAP button.
 * With a group selected (Orders: 1 Infantry / 2 Archers / 3 Cavalry), tapping the field sends that
 * group there to hold, in a small block. Optional: a whole battle can be fought without it (§6.7).
 *
 * Coordinates: the minimap and the overview each map the battlefield (world pixels) into a screen
 * rectangle with one scale; `toWorld` / `toScreen` convert both ways. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SIGHT = 520; // world pixels a soldier can see (a little over half a screen)
  const SCAN = 0.2; // seconds between detection scans
  const FOCUS_SECONDS = 2.5;
  const MINIMAP = { w: 176, top: 8 }; // screen pixels (its height follows the field's shape)
  const OVERVIEW_MARGIN = 28;
  const BLOCK_GAP = 28; // spacing of a group sent to a spot

  /** Does this battle use the awareness tools at all? @param {any} g */
  const active = (g) => g.mode === 'battle' && Boolean(g.battleMap) && CL.camera.scrolls(g);

  /** A rectangle on screen that shows the whole field at one scale. */
  function fit(m, box) {
    const { w, h } = CL.camera.worldSize(m);
    const scale = Math.min(box.w / w, box.h / h);
    return { x: box.x + (box.w - w * scale) / 2, y: box.y + (box.h - h * scale) / 2, w: w * scale, h: h * scale, scale };
  }

  /** Where the minimap sits on screen (top centre). @param {any} g */
  function minimapRect(g) {
    const { w, h } = CL.camera.worldSize(g.battleMap);
    const mh = Math.round((MINIMAP.w * h) / w);
    return fit(g.battleMap, { x: Math.round((CL.W - MINIMAP.w) / 2), y: MINIMAP.top, w: MINIMAP.w, h: mh });
  }

  /** Where the overview draws the field (the whole screen, less a margin and the bottom bar). @param {any} g */
  const overviewRect = (g) => fit(g.battleMap, { x: OVERVIEW_MARGIN, y: OVERVIEW_MARGIN + 10, w: CL.W - 2 * OVERVIEW_MARGIN, h: CL.H - 2 * OVERVIEW_MARGIN - 50 });

  /** @param {{ x: number, y: number, scale: number }} r */
  const toScreen = (r, wx, wy) => ({ x: r.x + wx * r.scale, y: r.y + wy * r.scale });
  /** @param {{ x: number, y: number, scale: number }} r */
  const toWorld = (r, sx, sy) => ({ x: (sx - r.x) / r.scale, y: (sy - r.y) / r.scale });
  /** @param {{ x: number, y: number, w: number, h: number }} r */
  const inside = (r, sx, sy) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;

  // ---- Detection ----

  /** The company's living eyes, in a grid (P9-B1: once a scan, not once an enemy). @param {any} g */
  const eyesOf = (g) => CL.units.proximity([g.hero, ...g.allies].filter((a) => a?.alive), SIGHT / 2);

  /**
   * Is this enemy in sight of the company right now? @param {any} g @param {Unit} e
   * @param {{ any: (x: number, y: number, r: number) => boolean }} [eyes] the company's eyes (eyesOf)
   */
  function inSight(g, e, eyes = eyesOf(g)) {
    if (CL.camera.inSightView(g, e.x, e.y)) return true; // the 1× view, whatever the zoom (W-03)
    return eyes.any(e.x, e.y, SIGHT + 1e-9); // within SIGHT, the edge included
  }

  /** Update what the company sees (every SCAN seconds; called from the battle's update). @param {any} g @param {number} dt */
  function scan(g, dt) {
    if (!active(g)) return;
    g.scanIn = (g.scanIn ?? 0) - dt;
    if (g.scanIn > 0) return;
    g.scanIn = SCAN;
    const eyes = eyesOf(g);
    for (const e of g.enemies) {
      if (!e.alive) continue;
      e.seen = inSight(g, e, eyes);
      if (e.seen) {
        e.detected = true;
        e.lastSeen = { x: e.x, y: e.y };
      }
    }
  }

  /** Enemies the player may be shown: { unit, x, y, live }. @param {any} g */
  function knownEnemies(g) {
    return g.enemies.filter((e) => e.alive && e.detected).map((e) => ({ unit: e, x: e.seen ? e.x : e.lastSeen.x, y: e.seen ? e.y : e.lastSeen.y, live: Boolean(e.seen) }));
  }

  // ---- Camera focus (tap the minimap) ----

  /** Look at a world point for a moment, then back to the hero. @param {any} g */
  function focus(g, wx, wy) {
    g.cameraFocus = { x: wx, y: wy, until: g.t + FOCUS_SECONDS };
  }

  /** The point the camera should centre on: a live focus, or null for the hero. @param {any} g */
  function focusPoint(g) {
    const f = g.cameraFocus;
    if (!f) return null;
    if (g.t >= f.until) {
      g.cameraFocus = null;
      return null;
    }
    return f;
  }

  // ---- The tactical overview ----

  /** Open or close the overview; the battle holds still while it is open. @param {any} g @param {boolean} [on] */
  function overview(g, on = !g.overview) {
    if (on && !active(g)) return false;
    g.overview = Boolean(on);
    CL.ui?.showOverview?.(g.overview);
    if (g.overview) CL.ui?.message?.('Tactical overview, battle held: pick a group in Orders, then tap where it should go. MAP, Tab or M closes it.');
    CL.diag.log('info', g.overview ? 'Tactical overview opened' : 'Tactical overview closed');
    return g.overview;
  }

  /**
   * Send a group to a spot on the field, to hold there in a small block (centred on the spot, clear of
   * obstacles, inside the field). Returns how many soldiers were sent.
   * @param {any} g @param {string} group 'infantry' | 'archer' | 'cavalry' @param {number} wx @param {number} wy
   */
  function sendGroup(g, group, wx, wy) {
    const units = g.allies.filter((a) => a.alive && a.role === group && !a.outside);
    if (!units.length) {
      CL.ui.message(`No ${group === 'archer' ? 'archers' : group} in this battle`);
      return 0;
    }
    const b = g.battleMap.bounds || CL.units.BOUNDS;
    const cols = Math.ceil(Math.sqrt(units.length));
    const rows = Math.ceil(units.length / cols);
    units.forEach((u, i) => {
      let x = wx + ((i % cols) - (cols - 1) / 2) * BLOCK_GAP;
      let y = wy + (Math.floor(i / cols) - (rows - 1) / 2) * BLOCK_GAP;
      x = Math.max(b.minX, Math.min(b.maxX, x));
      y = Math.max(b.minY, Math.min(b.maxY, y));
      // A spot inside a tree or wall: the nearest free point on a small spiral around it.
      for (let k = 1; k < 24 && CL.units.blocked(x, y); k++) {
        const a = k * 2.4;
        x = Math.max(b.minX, Math.min(b.maxX, x + Math.cos(a) * 6 * k));
        y = Math.max(b.minY, Math.min(b.maxY, y + Math.sin(a) * 6 * k));
      }
      u.holdX = x;
      u.holdY = y;
    });
    g.orders[group] = 'hold';
    g.group = group;
    CL.ui.message(`${{ infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' }[group] || group}: move there and hold`);
    CL.ui.showSelectedGroup?.(group);
    CL.diag.log('info', 'Group sent', { group, soldiers: units.length, x: Math.round(wx), y: Math.round(wy) });
    return units.length;
  }

  /**
   * A tap or click on the battle screen at (sx, sy), in screen pixels. Returns true if the minimap or
   * the overview used it (so it is not also a sword swing). @param {any} g
   */
  function tap(g, sx, sy) {
    if (!active(g)) return false;
    if (g.overview) {
      const r = overviewRect(g);
      if (inside(r, sx, sy)) {
        const p = toWorld(r, sx, sy);
        sendGroup(g, g.group, p.x, p.y);
      }
      return true; // every tap belongs to the overview while it is open
    }
    const r = minimapRect(g);
    if (!inside(r, sx, sy)) return false;
    const p = toWorld(r, sx, sy);
    focus(g, p.x, p.y);
    return true;
  }

  CL.tactics = { SIGHT, SCAN, FOCUS_SECONDS, active, minimapRect, overviewRect, toScreen, toWorld, inside, inSight, scan, knownEnemies, focus, focusPoint, overview, sendGroup, tap };
})(typeof window !== 'undefined' ? window : globalThis);
