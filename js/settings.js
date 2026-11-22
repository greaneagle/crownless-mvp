/* Crownless device settings (GDD §11 "Separate Music/SFX volumes; toggle screen shake/reduced
 * particles", "ally/enemy HP bars optional for low-clutter mode"; §6 battle size). They belong to the
 * device, not the campaign: kept in their own storage key, never in the save, so exporting a save to
 * another phone doesn't carry one phone's volume or battle size with it. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KEY = 'crownless_settings';
  // P9-B1 (D-P9a): 20 to 200 fighters at once, in steps of 10 (20 / 30 / 40 before 3.1.0; 150 at most in 3.1.0).
  const BATTLE_SIZES = Array.from({ length: 19 }, (_, i) => 20 + i * 10);
  /**
   * The battle size a device starts at, until its player chooses one: the largest the owner's phone
   * held at 30 fps or better in Debug → Battle benchmark (P9-B1): 150, at 60 fps (2.4 ms of simulation
   * and 2.6 of drawing a frame, the owner's phone, 3.1.1). `old` is the default before 3.1.0: a device
   * still on it never chose, so it moves to the new default too.
   */
  const BATTLE_DEFAULT = { touch: 150, desktop: 150, old: { touch: 30, desktop: 40 } };
  const SLOW = { fps: 30, seconds: 10 }; // a battle slower than this, for at least this long, offers a smaller size
  const BATTLEFIELDS = ['large', 'small']; // V2-05: large maps with a following camera, or one screen
  const PREP_PRESETS = ['auto', 'balanced', 'defensive', 'aggressive', 'custom']; // V2-07; P9-B4: Auto (the plan chosen for you)
  const PREP_ORDERS = ['follow', 'hold', 'charge'];
  // W-01: text size, the substitute for the browser's pinch-zoom (the page blocks it, because pinch
  // belongs to the map and battle gestures). It scales the game's HTML text and controls and the text
  // drawn on the canvas, not the canvas art.
  const TEXT_SIZES = { small: 0.9, normal: 1, large: 1.15, larger: 1.3 };
  // W-02: the world map's zoom is remembered on the device; the map camera keeps it within the
  // current map's own range ("fit" to 2.4×).
  const MAP_ZOOM = { min: 0.25, max: 2.4 };
  const BATTLE_ZOOM = { min: 0.75, max: 1.5 }; // W-03
  const battleZoom = (v, d) => (Number.isFinite(v) ? Math.max(BATTLE_ZOOM.min, Math.min(BATTLE_ZOOM.max, Math.round(v * 100) / 100)) : d);
  const mapZoom = (v, d) => (Number.isFinite(v) ? Math.max(MAP_ZOOM.min, Math.min(MAP_ZOOM.max, Math.round(v * 100) / 100)) : d);

  /** A remembered Custom setup: each group's offset from the hero's start and its order, or null. */
  function customSetup(v) {
    if (!v || typeof v !== 'object') return null;
    const out = {};
    for (const grp of ['infantry', 'archer', 'cavalry']) {
      const c = v[grp];
      if (!c || !Number.isFinite(c.dx) || !Number.isFinite(c.dy) || !PREP_ORDERS.includes(c.order)) return null;
      out[grp] = { dx: Math.max(-800, Math.min(800, Math.round(c.dx))), dy: Math.max(-800, Math.min(800, Math.round(c.dy))), order: c.order };
    }
    return out;
  }

  function isTouch() {
    try {
      return Boolean(root.matchMedia?.('(pointer: coarse)').matches);
    } catch {
      return false;
    }
  }

  /**
   * P9-B4: plans of your own (layer 3), at most three: each division's offset from the hero's start,
   * order, formation and facing. Anything malformed is dropped (an empty slot stays null).
   */
  function savedPlans(v) {
    if (!Array.isArray(v)) return [];
    const DIVS = ['infantry', 'archer', 'cavalry', 'infantry2', 'archer2', 'cavalry2'];
    const KINDS = ['loose', 'wall', 'wedge', 'line', 'column', 'square'];
    const FACE = ['right', 'up', 'down', 'left'];
    const pick = (o, ok) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, x]) => DIVS.includes(k) && ok(x)));
    return v.slice(0, 3).map((p) => {
      if (!p || typeof p !== 'object') return null;
      const anchors = pick(p.anchors, (a) => a && Number.isFinite(a.dx) && Number.isFinite(a.dy));
      for (const k of Object.keys(anchors)) anchors[k] = { dx: Math.max(-800, Math.min(800, Math.round(anchors[k].dx))), dy: Math.max(-800, Math.min(800, Math.round(anchors[k].dy))) };
      if (!Object.keys(anchors).length) return null;
      return { name: typeof p.name === 'string' ? p.name.slice(0, 20) : 'Plan', anchors, orders: pick(p.orders, (x) => PREP_ORDERS.includes(x)), formations: pick(p.formations, (x) => KINDS.includes(x)), facings: pick(p.facings, (x) => FACE.includes(x)) };
    });
  }

  /** Touch phones and desktops start at their own battle size (BATTLE_DEFAULT). */
  function defaults() {
    const touch = isTouch();
    // Full screen is on by default on phones, where the address bar costs the most room.
    return { music: 50, sfx: 70, battleSize: touch ? BATTLE_DEFAULT.touch : BATTLE_DEFAULT.desktop, battleSizeChosen: false, slowOffered: false, battlefield: 'large', prepPreset: 'auto', prepSkip: false, prepCustom: null, prepPlans: [], reducedEffects: false, healthBars: true, tips: true, fullscreen: touch, textSize: 'normal', mapZoom: null, battleZoom: 1 };
  }

  let current = defaults();

  const volume = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d);

  /** Keep only known settings with valid values; anything else falls back to the default. */
  function sanitize(raw) {
    const d = defaults();
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      music: volume(r.music, d.music),
      sfx: volume(r.sfx, d.sfx),
      ...battleSize(r, d),
      slowOffered: typeof r.slowOffered === 'boolean' ? r.slowOffered : d.slowOffered,
      battlefield: BATTLEFIELDS.includes(r.battlefield) ? r.battlefield : d.battlefield,
      prepPreset: PREP_PRESETS.includes(r.prepPreset) ? r.prepPreset : d.prepPreset,
      prepSkip: typeof r.prepSkip === 'boolean' ? r.prepSkip : d.prepSkip,
      prepCustom: customSetup(r.prepCustom),
      prepPlans: savedPlans(r.prepPlans),
      reducedEffects: typeof r.reducedEffects === 'boolean' ? r.reducedEffects : d.reducedEffects,
      healthBars: typeof r.healthBars === 'boolean' ? r.healthBars : d.healthBars,
      tips: typeof r.tips === 'boolean' ? r.tips : d.tips,
      fullscreen: typeof r.fullscreen === 'boolean' ? r.fullscreen : d.fullscreen,
      textSize: Object.hasOwn(TEXT_SIZES, r.textSize) ? r.textSize : d.textSize,
      mapZoom: mapZoom(r.mapZoom, d.mapZoom), // null: the world's own opening zoom
      battleZoom: battleZoom(r.battleZoom, d.battleZoom),
    };
  }

  /**
   * The battle size and whether the player chose it. Not chosen, it follows the device's default (so a
   * later default reaches it). Settings from before 3.1.0 have no flag: a size other than that build's
   * default was chosen; the old default was not. @param {any} r @param {any} d
   */
  function battleSize(r, d) {
    if (!BATTLE_SIZES.includes(r.battleSize)) return { battleSize: d.battleSize, battleSizeChosen: false };
    const old = isTouch() ? BATTLE_DEFAULT.old.touch : BATTLE_DEFAULT.old.desktop;
    const chosen = typeof r.battleSizeChosen === 'boolean' ? r.battleSizeChosen : r.battleSize !== old;
    return chosen ? { battleSize: r.battleSize, battleSizeChosen: true } : { battleSize: d.battleSize, battleSizeChosen: false };
  }

  /**
   * P9-B1: after a battle that ran slowly (under SLOW.fps for at least SLOW.seconds), a smaller battle
   * size to offer, once per device and only while the player hasn't chosen one; null otherwise. Never
   * applied by itself. @param {number} fps @param {number} seconds
   */
  function slowerOffer(fps, seconds) {
    if (current.battleSizeChosen || current.slowOffered || seconds < SLOW.seconds || !(fps < SLOW.fps)) return null;
    const size = Math.max(BATTLE_SIZES[0], Math.floor((current.battleSize * Math.max(fps, 1)) / SLOW.fps / 10) * 10);
    if (size >= current.battleSize) return null;
    current = { ...current, slowOffered: true };
    persist();
    return size;
  }

  function load() {
    let raw = null;
    try {
      raw = JSON.parse(root.localStorage.getItem(KEY) || 'null');
    } catch {
      raw = null;
    }
    current = sanitize(raw);
    apply();
    return current;
  }

  function persist() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(current));
    } catch (e) {
      CL.diag.log('warn', 'Settings not saved', { error: String(e) });
    }
  }

  /** Push the settings into the systems that use them. */
  function apply() {
    CL.combat?.setActiveCap(current.battleSize);
    CL.audio?.setVolumes(current.music, current.sfx);
    CL.ui?.applyTextScale?.(textScale());
  }

  /** The text-size factor: 0.9, 1, 1.15 or 1.3. */
  const textScale = () => TEXT_SIZES[current.textSize] ?? 1;

  /**
   * A canvas font at the player's text size (W-01): `font(14)` is "bold 14px Georgia" at Normal and
   * "bold 18px Georgia" at Larger. Every font the renderer draws with comes from here (CL.ui.font).
   */
  function font(px, { weight = 'bold', family = 'Georgia' } = {}) {
    return `${weight} ${Math.round(px * textScale())}px ${family}`;
  }

  const get = (key) => current[key];
  const all = () => ({ ...current });

  /** Change one setting (validated), save it and apply it. Returns false for an invalid value. */
  function set(key, value) {
    if (!(key in current)) return false;
    // Choosing a battle size keeps it, whatever later builds' defaults are (P9-B1).
    const next = sanitize({ ...current, [key]: value, ...(key === 'battleSize' ? { battleSizeChosen: true } : {}) });
    if (JSON.stringify(next[key]) !== JSON.stringify(value)) return false; // objects compare by content
    current = next;
    persist();
    apply();
    CL.diag.log('info', 'Setting changed', { [key]: value });
    return true;
  }

  CL.settings = { KEY, BATTLE_SIZES, BATTLE_DEFAULT, SLOW, slowerOffer, BATTLEFIELDS, PREP_PRESETS, TEXT_SIZES, MAP_ZOOM, BATTLE_ZOOM, defaults, sanitize, load, get, all, set, apply, textScale, font };
})(typeof window !== 'undefined' ? window : globalThis);
