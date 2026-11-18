// @ts-check
/* Crownless battle preparation (V2-07; design §7, SC-06, SC-07, SC-36): simple by default, deeper by
 * choice, and never required.
 *
 * Before a fought battle the player sees the field and chooses a setup:
 *   Balanced    infantry in front, archers behind, cavalry on a flank; everyone follows the hero
 *               (archers keep behind, cavalry rides out to anything close). The default. Until 1.19.0
 *               archers and cavalry held their ground, and the hero went in alone (V2-T2)
 *   Defensive   a tight block, everyone holds
 *   Aggressive  infantry and cavalry forward and charging, archers following
 *   Custom      drag each group's flag inside the deployment zone and pick its starting order
 * Fight starts the battle (two taps from the encounter: Attack, Fight). Simulate auto-resolves it and
 * explains the odds. "Skip this next time" (a device setting) makes Attack go straight in with the
 * remembered setup. Practice battles, tests and debug battles skip preparation entirely.
 *
 * Deployment zone: an area around the hero's start, never toward the enemy beyond a short step. When
 * a band catches you (an ambush), the zone is much smaller.
 *
 * Coordinates are world pixels relative to the map's hero anchor; the enemy is always to the east
 * (+x). A plan is { preset, orders: { group: 'follow' | 'hold' | 'charge' }, anchors: { group: { x, y } } }.
 * Remembered setups live in the device settings (never the save): `prepPreset`, `prepSkip`, and for
 * Custom `prepCustom` (offsets from the anchor and orders). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PRESETS = ['balanced', 'defensive', 'aggressive', 'custom'];
  const GROUPS = ['infantry', 'archer', 'cavalry'];
  const ORDERS = ['follow', 'hold', 'charge'];
  const SETUPS = {
    balanced: {
      orders: { infantry: 'follow', archer: 'follow', cavalry: 'follow' },
      offsets: { infantry: { dx: 70, dy: 0 }, archer: { dx: -90, dy: 0 }, cavalry: { dx: -30, dy: -190 } },
    },
    defensive: {
      orders: { infantry: 'hold', archer: 'hold', cavalry: 'hold' },
      offsets: { infantry: { dx: 40, dy: 0 }, archer: { dx: -60, dy: 0 }, cavalry: { dx: -150, dy: 0 } },
    },
    aggressive: {
      orders: { infantry: 'charge', archer: 'follow', cavalry: 'charge' },
      offsets: { infantry: { dx: 170, dy: 0 }, archer: { dx: 30, dy: 0 }, cavalry: { dx: 130, dy: -210 } },
    },
  };
  const ROW_GAP = 28; // between soldiers across the line (y)
  const RANK_GAP = 30; // between ranks, front to back (x)
  const PER_RANK = 5;

  /** Where the hero starts on a battle map. @param {any} map */
  const anchorOf = (map) => map.spawn.hero;

  /**
   * The deployment zone: around the hero's start, mostly behind it. Smaller when ambushed.
   * @param {any} map @param {boolean} [ambush] @returns {{ x0: number, x1: number, y0: number, y1: number }}
   */
  function zone(map, ambush = false) {
    const a = anchorOf(map);
    const b = map.bounds || CL.units.BOUNDS;
    const [back, front, half] = ambush ? [190, 110, 170] : [420, 260, 380];
    return { x0: Math.max(b.minX, a.x - back), x1: Math.min(b.maxX, a.x + front), y0: Math.max(b.minY, a.y - half), y1: Math.min(b.maxY, a.y + half) };
  }

  /** Keep a point inside the zone and out of trees and walls. @param {any} z */
  function legal(z, x, y) {
    let [px, py] = [Math.max(z.x0, Math.min(z.x1, x)), Math.max(z.y0, Math.min(z.y1, y))];
    for (let k = 1; k < 30 && CL.units.blocked(px, py); k++) {
      const ang = k * 2.4;
      px = Math.max(z.x0, Math.min(z.x1, px + Math.cos(ang) * 5 * k));
      py = Math.max(z.y0, Math.min(z.y1, py + Math.sin(ang) * 5 * k));
    }
    return { x: px, y: py };
  }

  /**
   * A plan for a preset on a map. For Custom, `custom` gives each group's offset from the anchor and its
   * order (missing ones fall back to Balanced). Every anchor is made legal (inside the zone, clear).
   * @param {string} preset @param {any} map @param {{ ambush?: boolean, custom?: any }} [opts]
   */
  function plan(preset, map, { ambush = false, custom = null } = {}) {
    const p = PRESETS.includes(preset) ? preset : 'balanced';
    const base = SETUPS[p === 'custom' ? 'balanced' : p];
    const z = zone(map, ambush);
    const a = anchorOf(map);
    /** @type {Record<string, string>} */
    const orders = {};
    /** @type {Record<string, { x: number, y: number }>} */
    const anchors = {};
    const prevMap = CL.game.battleMap;
    CL.game.battleMap = map; // obstacle checks use the map being planned
    for (const grp of GROUPS) {
      const c = p === 'custom' ? custom?.[grp] : null;
      const off = c && Number.isFinite(c.dx) && Number.isFinite(c.dy) ? c : base.offsets[grp];
      orders[grp] = c && ORDERS.includes(c.order) ? c.order : base.orders[grp];
      anchors[grp] = legal(z, a.x + off.dx, a.y + off.dy);
    }
    CL.game.battleMap = prevMap;
    return { preset: p, ambush, orders, anchors };
  }

  /**
   * Put the deployed company in place for a plan: each group in a block around its anchor, ranks one
   * behind another away from the enemy, and the plan's starting orders. Called by combat.startBattle.
   * @param {any} g @param {{ preset: string, ambush?: boolean, orders: Record<string, string>, anchors: Record<string, { x: number, y: number }> }} p
   */
  function place(g, p) {
    for (const grp of GROUPS) {
      const units = g.allies.filter((u) => u.role === grp && !u.companion);
      const at = p.anchors[grp];
      if (!at) continue;
      const rows = Math.min(PER_RANK, units.length);
      units.forEach((u, i) => {
        const rank = Math.floor(i / PER_RANK);
        const row = i % PER_RANK;
        u.x = at.x - rank * RANK_GAP;
        u.y = at.y + (row - (rows - 1) / 2) * ROW_GAP;
        CL.units.resolveObstacles(u);
        u.holdX = u.x;
        u.holdY = u.y;
        u.face = 'right';
      });
      g.orders[grp] = p.orders[grp];
    }
    // The companion stands by the hero, whatever the setup.
    g.prepPlan = p.preset;
    CL.diag.log('info', 'Battle setup', { preset: p.preset, ambush: Boolean(p.ambush), orders: { ...p.orders } });
  }

  // ---- What the player last chose (device settings) ----

  /** The remembered plan for a map: the saved preset (and Custom layout), or Balanced. @param {any} map @param {boolean} [ambush] */
  function remembered(map, ambush = false) {
    const S = CL.settings;
    return plan(S?.get('prepPreset') || 'balanced', map, { ambush, custom: S?.get('prepCustom') });
  }

  /** Remember a plan as the next default (and whether to skip the screen). @param {any} p @param {any} map @param {boolean} skip */
  function remember(p, map, skip) {
    const S = CL.settings;
    if (!S) return;
    const a = anchorOf(map);
    if (p.preset === 'custom') {
      const custom = {};
      for (const grp of GROUPS) custom[grp] = { dx: Math.round(p.anchors[grp].x - a.x), dy: Math.round(p.anchors[grp].y - a.y), order: p.orders[grp] };
      S.set('prepCustom', custom);
    }
    S.set('prepPreset', p.preset);
    S.set('prepSkip', Boolean(skip));
  }

  // ---- The preview on the preparation screen (left part of the canvas; the panel sits on the right) ----

  const PREVIEW = { x: 16, y: 16, w: Math.round(CL.W * 0.6) - 24, h: CL.H - 32 };
  const FLAG_REACH = 28; // screen pixels: how close a tap must be to pick up a flag

  /**
   * How the preparation screen shows the field: zoomed to the area around the deployment zone (a
   * one-screen map fits whole), leaning toward the enemy's side. Returns the transform for
   * CL.tactics.toScreen / toWorld ({ x, y, scale }: screen = x + world × scale) and the screen box it
   * fills ({ box }) and the world area shown ({ view }). @param {any} map @param {boolean} [ambush]
   */
  function previewRect(map, ambush = false) {
    const { w, h } = CL.camera.worldSize(map);
    const z = zone(map, ambush);
    const aspect = PREVIEW.w / PREVIEW.h;
    let vw = Math.max((z.x1 - z.x0) * 1.8, 900);
    let vh = vw / aspect;
    if (vh < (z.y1 - z.y0) * 1.25) {
      vh = (z.y1 - z.y0) * 1.25;
      vw = vh * aspect;
    }
    [vw, vh] = [Math.min(vw, w), Math.min(vh, h)];
    const cx = (z.x0 + z.x1) / 2 + vw * 0.15;
    const cy = (z.y0 + z.y1) / 2;
    const vx = Math.max(0, Math.min(w - vw, cx - vw / 2));
    const vy = Math.max(0, Math.min(h - vh, cy - vh / 2));
    const scale = Math.min(PREVIEW.w / vw, PREVIEW.h / vh);
    const box = { x: PREVIEW.x + (PREVIEW.w - vw * scale) / 2, y: PREVIEW.y + (PREVIEW.h - vh * scale) / 2, w: vw * scale, h: vh * scale };
    return { x: box.x - vx * scale, y: box.y - vy * scale, scale, w: box.w, h: box.h, box, view: { x: vx, y: vy, w: vw, h: vh } };
  }

  /** The group whose flag is under a tap on the preview, or null. @param {any} p @param {any} map @param {string[]} groups */
  function flagAt(p, map, groups, sx, sy) {
    const r = previewRect(map, p.ambush);
    let best = null;
    for (const grp of groups) {
      const at = CL.tactics.toScreen(r, p.anchors[grp].x, p.anchors[grp].y);
      const d = Math.hypot(at.x - sx, at.y - sy);
      if (d <= FLAG_REACH && (!best || d < best.d)) best = { grp, d };
    }
    return best?.grp || null;
  }

  /** Drag a group's flag to a tap on the preview: the plan becomes Custom; the spot is kept legal. @param {any} p @param {any} map */
  function moveFlag(p, map, grp, sx, sy) {
    const w = CL.tactics.toWorld(previewRect(map, p.ambush), sx, sy);
    const prevMap = CL.game.battleMap;
    CL.game.battleMap = map;
    p.anchors[grp] = legal(zone(map, p.ambush), w.x, w.y);
    CL.game.battleMap = prevMap;
    p.preset = 'custom';
    return p.anchors[grp];
  }

  /** Set one group's starting order: the plan becomes Custom. @param {any} p */
  function setOrder(p, grp, order) {
    if (!GROUPS.includes(grp) || !ORDERS.includes(order)) return false;
    p.orders[grp] = order;
    p.preset = 'custom';
    return true;
  }

  CL.prep = { PRESETS, GROUPS, ORDERS, SETUPS, anchorOf, zone, legal, plan, place, remembered, remember, previewRect, flagAt, moveFlag, setOrder };
})(typeof window !== 'undefined' ? window : globalThis);
