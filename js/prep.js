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
 * From 2.22.0 (P7-11) Defensive starts the infantry in a shield wall; the others start loose
 * (js/formations.js; Orders changes it during the battle). Aggressive in a wedge was tried and
 * dropped: outnumbered, the wedge's lack of shield cover cost too much (scripts/parity.js).
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

  const PRESETS = ['auto', 'balanced', 'defensive', 'aggressive', 'custom'];
  /**
   * P9-B4, layer 1: Auto chooses a setup from the odds Simulate would state: Aggressive when clearly the
   * stronger, Defensive (a shield wall on Hold) when clearly the weaker, Balanced between; archers on a
   * rise keep it (as every setup does), and the cavalry go to the flank with fewer trees and walls.
   */
  const AUTO = { strong: 0.85, weak: 0.45, flankProbe: 190 }; // strong 0.85: at 79% charging a band of veterans cost more than following in ranks (scripts/parity.js)
  /** A second division of a role stands this far below its first (y), the same distance from the hero. */
  const SECOND = 150;
  const PLANS_MAX = 3; // plans of your own (layer 3), kept on the device
  const GROUPS = ['infantry', 'archer', 'cavalry'];
  const ORDERS = ['follow', 'hold', 'charge'];
  const SETUPS = {
    balanced: {
      formation: 'loose',
      orders: { infantry: 'follow', archer: 'follow', cavalry: 'follow' },
      offsets: { infantry: { dx: 70, dy: 0 }, archer: { dx: -90, dy: 0 }, cavalry: { dx: -30, dy: -190 } },
    },
    defensive: {
      formation: 'wall',
      orders: { infantry: 'hold', archer: 'hold', cavalry: 'hold' },
      offsets: { infantry: { dx: 40, dy: 0 }, archer: { dx: -60, dy: 0 }, cavalry: { dx: -150, dy: 0 } },
    },
    aggressive: {
      formation: 'loose',
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
    // A scout who saw them first gives you more ground to set up on (P7-02; not when ambushed).
    const wide = !ambush && CL.scout?.get(CL.campaign) ? CL.scout.ZONE : 1;
    const [back, front, half] = (ambush ? [190, 110, 170] : [420, 260, 380]).map((n) => n * wide);
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
  /** Auto's choice for this encounter: 'aggressive', 'defensive' or 'balanced'. */
  function autoChoice() {
    const e = CL.parties?.current?.();
    if (!e?.troops) return 'balanced';
    const A = CL.autoresolve;
    const odds = A.winChance(A.playerPower(), A.troopsPower(e.troops));
    return odds >= AUTO.strong ? 'aggressive' : odds <= AUTO.weak ? 'defensive' : 'balanced';
  }

  /** The cavalry's flank for Auto: up (-1) or down (+1), whichever has less in the way. @param {any} map */
  function openFlank(map) {
    const a = anchorOf(map);
    const count = (dy) => (map.obstacles || []).filter((o) => Math.hypot(o.x - a.x, o.y - (a.y + dy)) < AUTO.flankProbe).length;
    return count(AUTO.flankProbe) < count(-AUTO.flankProbe) ? 1 : -1;
  }

  function plan(preset, map, { ambush = false, custom = null } = {}) {
    const p = PRESETS.includes(preset) ? preset : 'balanced';
    const choice = p === 'auto' ? autoChoice() : null;
    const base = SETUPS[p === 'custom' ? 'balanced' : choice || p];
    const z = zone(map, ambush);
    const a = anchorOf(map);
    /** @type {Record<string, string>} */
    const orders = {};
    /** @type {Record<string, { x: number, y: number }>} */
    const anchors = {};
    const prevMap = CL.game.battleMap;
    CL.game.battleMap = map; // obstacle checks use the map being planned
    const flank = choice ? openFlank(map) : -1;
    for (const grp of GROUPS) {
      const c = p === 'custom' ? custom?.[grp] : null;
      const set = base.offsets[grp];
      const off = c && Number.isFinite(c.dx) && Number.isFinite(c.dy) ? c : grp === 'cavalry' && flank > 0 ? { dx: set.dx, dy: -set.dy } : set;
      orders[grp] = c && ORDERS.includes(c.order) ? c.order : base.orders[grp];
      anchors[grp] = legal(z, a.x + off.dx, a.y + off.dy);
    }
    // P7-11: archers who start on a rise (the hills map) keep it: they hold there, unless the setup is Custom.
    if (p !== 'custom' && CL.formations.highAt(anchors.archer.x, anchors.archer.y)) orders.archer = 'hold';
    // P8-06b: on a fort's walls, setups that make sense there (js/assault.js).
    const walls = CL.assault?.anchors(p, map);
    if (walls) {
      for (const grp of GROUPS) {
        const at = walls[grp];
        if (at) anchors[grp] = legal({ x0: map.bounds.minX, x1: map.bounds.maxX, y0: map.bounds.minY, y1: map.bounds.maxY }, at.x, at.y);
      }
      const attacking = map.spawn.hero.x * map.wall.outside > map.wall.centre * map.wall.outside;
      if (attacking) Object.assign(orders, { infantry: 'charge', archer: 'hold', cavalry: 'follow' });
      else Object.assign(orders, { infantry: 'hold', archer: 'hold', cavalry: 'hold' });
    }
    // P9-B4: the second divisions stand beside their first, with its orders.
    for (const grp of GROUPS) {
      anchors[`${grp}2`] = legal(z, anchors[grp].x, anchors[grp].y + SECOND);
      orders[`${grp}2`] = orders[grp];
    }
    CL.game.battleMap = prevMap;
    const formation = p === 'custom' ? 'loose' : base.formation;
    return { preset: p, auto: choice, ambush, orders, anchors, formation, formations: { infantry: formation, infantry2: formation }, facings: {}, captains: {} };
  }

  /**
   * Put the deployed company in place for a plan: each group in a block around its anchor, ranks one
   * behind another away from the enemy, and the plan's starting orders. Called by combat.startBattle.
   * @param {any} g @param {{ preset: string, ambush?: boolean, formation?: string, formations?: Record<string, string>, facings?: Record<string, string>, captains?: Record<string, any>, orders: Record<string, string>, anchors: Record<string, { x: number, y: number }> }} p
   */
  function place(g, p) {
    for (const grp of CL.divisions.SLOTS) {
      const units = g.allies.filter((u) => (u.div || u.role) === grp && !u.companion && !u.outside);
      const at = p.anchors[grp];
      if (!at || !units.length) continue;
      const rows = Math.min(PER_RANK, units.length);
      units.forEach((u, i) => {
        const rank = Math.floor(i / PER_RANK);
        const row = i % PER_RANK;
        u.x = at.x - rank * RANK_GAP;
        u.y = at.y + (row - (rows - 1) / 2) * ROW_GAP;
        CL.units.resolveObstacles(u);
        u.holdX = u.x;
        u.holdY = u.y;
        u.face = p.facings?.[grp] || 'right';
      });
      if (p.orders[grp]) g.orders[grp] = p.orders[grp];
    }
    // Each division's formation (a shield wall closes up on Hold, P7-11), facing and captain (P9-B4).
    g.facings = { ...(p.facings || {}) };
    g.captains = { ...(p.captains || {}) };
    for (const [div, k] of Object.entries(g.captains)) {
      // A captain stands with the division they lead (a soldier of another role leads it from among them).
      const u = k?.kind === 'soldier' ? g.allies.find((a) => a.soldierId === k.id) : null;
      if (u) u.div = div;
    }
    for (const div of CL.divisions.present(g)) {
      const kind = p.formations?.[div] ?? (div === 'infantry' ? p.formation : null) ?? 'loose';
      CL.formations.set(g, kind, true, div);
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

  /** Set one division's starting order: the plan becomes Custom. @param {any} p */
  function setOrder(p, grp, order) {
    if (!CL.divisions.SLOTS.includes(grp) || !ORDERS.includes(order)) return false;
    p.orders[grp] = order;
    p.preset = 'custom';
    return true;
  }

  // ---- Layer 3: a division's captain, formation and facing, and plans of your own ----

  /** A division's captain ({ kind, id } from CL.divisions.captains), or null for none. @param {any} p */
  function setCaptain(p, div, captain) {
    if (!CL.divisions.SLOTS.includes(div)) return false;
    p.captains ??= {};
    for (const d of Object.keys(p.captains)) if (captain && p.captains[d]?.kind === captain.kind && p.captains[d]?.id === captain.id) delete p.captains[d]; // one division a captain
    if (captain) p.captains[div] = { kind: captain.kind, id: captain.id };
    else delete p.captains[div];
    return true;
  }

  /** A division's starting formation: the plan becomes Custom. @param {any} p */
  function setFormation(p, div, kind) {
    if (!(CL.divisions.FORMATIONS[CL.divisions.roleOf(div)] || []).includes(kind)) return false;
    p.formations ??= {};
    p.formations[div] = kind;
    if (div === 'infantry') p.formation = kind;
    p.preset = 'custom';
    return true;
  }

  /** A division's facing (the way it looks and forms up): right (the enemy), up, down or left. @param {any} p */
  function setFacing(p, div, facing) {
    if (!CL.divisions.SLOTS.includes(div) || !CL.divisions.FACINGS.includes(facing)) return false;
    p.facings ??= {};
    p.facings[div] = facing;
    p.preset = 'custom';
    return true;
  }

  /** Keep a plan as one of your own (slot 0–2, on the device), by its offsets from the hero's start. @param {any} p @param {any} map */
  function savePlan(p, map, slot, label = `Plan ${slot + 1}`) {
    const S = CL.settings;
    if (!S || !(slot >= 0 && slot < PLANS_MAX)) return false;
    const a = anchorOf(map);
    const anchors = Object.fromEntries(Object.entries(p.anchors).map(([d, at]) => [d, { dx: Math.round(at.x - a.x), dy: Math.round(at.y - a.y) }]));
    const plans = [...(S.get('prepPlans') || [])];
    while (plans.length < slot) plans.push(null);
    plans[slot] = { name: String(label).slice(0, 20), anchors, orders: { ...p.orders }, formations: { ...(p.formations || {}) }, facings: { ...(p.facings || {}) } };
    return S.set('prepPlans', plans);
  }

  /** One of your plans for this map (null if that slot is empty). @param {any} map @param {boolean} [ambush] */
  function loadPlan(slot, map, ambush = false) {
    const saved = (CL.settings?.get('prepPlans') || [])[slot];
    if (!saved) return null;
    const p = plan('custom', map, { ambush });
    const a = anchorOf(map);
    const z = zone(map, ambush);
    const prevMap = CL.game.battleMap;
    CL.game.battleMap = map;
    for (const [d, o] of Object.entries(saved.anchors)) p.anchors[d] = legal(z, a.x + o.dx, a.y + o.dy);
    CL.game.battleMap = prevMap;
    Object.assign(p.orders, saved.orders);
    p.formations = { ...saved.formations };
    p.formation = saved.formations.infantry || 'loose';
    p.facings = { ...saved.facings };
    p.plan = slot;
    return p;
  }

  CL.prep = { PRESETS, AUTO, SECOND, PLANS_MAX, GROUPS, ORDERS, SETUPS, anchorOf, zone, legal, autoChoice, openFlank, plan, place, remembered, remember, previewRect, flagAt, moveFlag, setOrder, setCaptain, setFormation, setFacing, savePlan, loadPlan };
})(typeof window !== 'undefined' ? window : globalThis);
