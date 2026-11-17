/* Crownless device settings (GDD §11 "Separate Music/SFX volumes; toggle screen shake/reduced
 * particles", "ally/enemy HP bars optional for low-clutter mode"; §6 battle size). They belong to the
 * device, not the campaign: kept in their own storage key, never in the save, so exporting a save to
 * another phone doesn't carry one phone's volume or battle size with it. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KEY = 'crownless_settings';
  const BATTLE_SIZES = [20, 30, 40];
  const BATTLEFIELDS = ['large', 'small']; // V2-05: large maps with a following camera, or one screen
  const PREP_PRESETS = ['balanced', 'defensive', 'aggressive', 'custom']; // V2-07
  const PREP_ORDERS = ['follow', 'hold', 'charge'];

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

  /** Touch phones start at battle size 30 (every current battle still fits); desktops at 40. */
  function defaults() {
    let touch = false;
    try {
      touch = Boolean(root.matchMedia?.('(pointer: coarse)').matches);
    } catch {
      touch = false;
    }
    // Full screen is on by default on phones, where the address bar costs the most room.
    return { music: 50, sfx: 70, battleSize: touch ? 30 : 40, battlefield: 'large', prepPreset: 'balanced', prepSkip: false, prepCustom: null, reducedEffects: false, healthBars: true, tips: true, fullscreen: touch };
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
      battleSize: BATTLE_SIZES.includes(r.battleSize) ? r.battleSize : d.battleSize,
      battlefield: BATTLEFIELDS.includes(r.battlefield) ? r.battlefield : d.battlefield,
      prepPreset: PREP_PRESETS.includes(r.prepPreset) ? r.prepPreset : d.prepPreset,
      prepSkip: typeof r.prepSkip === 'boolean' ? r.prepSkip : d.prepSkip,
      prepCustom: customSetup(r.prepCustom),
      reducedEffects: typeof r.reducedEffects === 'boolean' ? r.reducedEffects : d.reducedEffects,
      healthBars: typeof r.healthBars === 'boolean' ? r.healthBars : d.healthBars,
      tips: typeof r.tips === 'boolean' ? r.tips : d.tips,
      fullscreen: typeof r.fullscreen === 'boolean' ? r.fullscreen : d.fullscreen,
    };
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
  }

  const get = (key) => current[key];
  const all = () => ({ ...current });

  /** Change one setting (validated), save it and apply it. Returns false for an invalid value. */
  function set(key, value) {
    if (!(key in current)) return false;
    const next = sanitize({ ...current, [key]: value });
    if (JSON.stringify(next[key]) !== JSON.stringify(value)) return false; // objects compare by content
    current = next;
    persist();
    apply();
    CL.diag.log('info', 'Setting changed', { [key]: value });
    return true;
  }

  CL.settings = { KEY, BATTLE_SIZES, BATTLEFIELDS, PREP_PRESETS, defaults, sanitize, load, get, all, set, apply };
})(typeof window !== 'undefined' ? window : globalThis);
