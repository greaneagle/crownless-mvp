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
    if (g.overview) CL.input?.releaseHeld?.(); // P11-09: the battle is held, and so is nothing else
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
    const units = g.allies.filter((a) => a.alive && (a.div || a.role) === group && !a.outside && !a.companion);
    if (!units.length) {
      CL.ui.message(group === CL.divisions.roleOf(group) ? `No ${group === 'archer' ? 'archers' : group} in this battle` : `Nobody in ${CL.divisions.name(CL.campaign, group)} in this battle`);
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
    CL.formations.closeUp(g, group); // a formed division takes its shape there (P9-B4)
    CL.ui.message(`${CL.divisions.name(CL.campaign, group)}: move there and hold`);
    CL.ui.showSelectedGroup?.(group);
    CL.diag.log('info', 'Group sent', { group, soldiers: units.length, x: Math.round(wx), y: Math.round(wy) });
    return units.length;
  }

  /**
   * A tap or click on the battle screen at (sx, sy), in screen pixels. Returns true if the minimap or
   * the overview used it (so it is not also a sword swing). @param {any} g
   */
  // ---- Layer 4 (P9-B4): live command on the tactical map ----

  /** What a tap on the overview does with the selected division, and when. */
  const ACTIONS = ['move', 'charge', 'fallback', 'face'];
  const ACTION_NAMES = { move: 'Move', charge: 'Charge', fallback: 'Fall back', face: 'Face' };
  const TIMINGS = ['now', 5, 10, 'volley'];
  const TIMING_NAMES = { now: 'Now', 5: 'In 5 s', 10: 'In 10 s', volley: 'On the volley' };
  const FALLBACK_DONE = 24; // px from its spot: a division falling back has arrived

  /** Carry out an order for a division at a point of the field (now). @param {any} g @param {{ div: string, kind: string, x: number, y: number }} o */
  function carry(g, o) {
    const D = CL.divisions;
    const name = D.name(CL.campaign, o.div);
    if (!D.members(g, o.div).length) return false;
    g.focusAt ??= {};
    g.falling ??= {};
    if (o.kind === 'move' || o.kind === 'fallback') {
      sendGroup(g, o.div, o.x, o.y);
      delete g.focusAt[o.div];
      if (o.kind === 'fallback') {
        g.falling[o.div] = true; // back to the spot without stopping to fight (js/combat.js), then hold
        CL.ui.message(`${name}: fall back there and hold`);
      } else delete g.falling[o.div];
    } else if (o.kind === 'charge') {
      g.orders[o.div] = 'charge';
      g.focusAt[o.div] = { x: o.x, y: o.y }; // the enemies nearest this spot first
      delete g.falling[o.div];
      CL.ui.message(`${name}: charge them there`);
    } else if (o.kind === 'face') {
      const units = D.members(g, o.div);
      const cx = units.reduce((n, u) => n + u.x, 0) / units.length;
      const cy = units.reduce((n, u) => n + u.y, 0) / units.length;
      const [dx, dy] = [o.x - cx, o.y - cy];
      const facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
      g.facings ??= {};
      g.facings[o.div] = facing;
      for (const u of units) u.face = facing;
      CL.formations.closeUp(g, o.div);
      CL.ui.message(`${name}: face ${facing === 'right' ? 'east' : facing === 'left' ? 'west' : facing === 'up' ? 'north' : 'south'}`);
    } else return false;
    CL.diag.log('info', 'Division order', { ...o, x: Math.round(o.x), y: Math.round(o.y) });
    return true;
  }

  /**
   * Give the selected division the chosen order at a point: now, or timed (after a few seconds, or when
   * the company's archers next loose), so several can be set while the overview holds the battle and go
   * off together. @param {any} g
   */
  function command(g, wx, wy) {
    const o = { div: g.group, kind: ACTIONS.includes(g.mapAction) ? g.mapAction : 'move', x: wx, y: wy };
    const when = TIMINGS.includes(g.mapTiming) ? g.mapTiming : 'now';
    if (when === 'now') return carry(g, o);
    g.timed ??= [];
    g.timed = g.timed.filter((t) => t.div !== o.div); // one waiting order a division: the newest
    g.timed.push({ ...o, ...(when === 'volley' ? { volley: g.lastVolley ?? -1 } : { at: g.t + when }) });
    CL.ui.message(`${CL.divisions.name(CL.campaign, o.div)}: ${ACTION_NAMES[o.kind].toLowerCase()}, ${when === 'volley' ? 'when the archers loose' : `in ${when} s`}`);
    return true;
  }

  /** Each frame: timed orders whose moment has come, and divisions falling back that have arrived. @param {any} g */
  function tickOrders(g) {
    if (g.timed?.length) {
      const due = g.timed.filter((t) => (t.at != null ? g.t >= t.at : (g.lastVolley ?? -1) > t.volley));
      if (due.length) {
        g.timed = g.timed.filter((t) => !due.includes(t));
        for (const t of due) carry(g, t);
      }
    }
    for (const div of Object.keys(g.falling || {})) {
      const units = CL.divisions.members(g, div);
      if (!units.length || units.every((u) => Math.hypot(u.x - u.holdX, u.y - u.holdY) <= FALLBACK_DONE)) {
        delete g.falling[div];
        g.doneAt ??= {};
        g.doneAt[div] = g.t; // P11-13: the order's flag says done for a moment
      }
    }
  }

  function tap(g, sx, sy) {
    if (!active(g)) return false;
    if (g.overview) {
      const r = overviewRect(g);
      if (inside(r, sx, sy)) {
        const p = toWorld(r, sx, sy);
        command(g, p.x, p.y);
      }
      return true; // every tap belongs to the overview while it is open
    }
    const r = minimapRect(g);
    if (!inside(r, sx, sy)) return false;
    const p = toWorld(r, sx, sy);
    focus(g, p.x, p.y);
    return true;
  }

  CL.tactics = { SIGHT, SCAN, FOCUS_SECONDS, ACTIONS, ACTION_NAMES, TIMINGS, TIMING_NAMES, active, minimapRect, overviewRect, toScreen, toWorld, inside, inSight, scan, knownEnemies, focus, focusPoint, overview, sendGroup, carry, command, tickOrders, tap };
})(typeof window !== 'undefined' ? window : globalThis);
