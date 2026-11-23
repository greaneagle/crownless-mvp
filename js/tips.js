/* Crownless first-time tips (Gate E tutorial; content in data/help.js). The first time a screen or
 * situation comes up, a short card explains it once — per device, so a second campaign on the same
 * phone isn't lectured again. Tips can be turned off or shown again from Settings. The first battle
 * waits while its controls card is read. Q1 remains the playable tutorial (GDD §4).
 * Seen tips live in their own storage key, like the settings, never in the save. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SEEN_KEY = 'crownless_tips_seen';
  const CHECK_EVERY = 1000; // ms between checks of the situation tips on the map

  const tips = () => Object.values(CL.content.table('tips'));
  let seen = null;
  let showing = null;
  let lastCheck = 0;

  function loadSeen() {
    if (seen) return seen;
    try {
      const list = JSON.parse(root.localStorage.getItem(SEEN_KEY) || '[]');
      seen = new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
    } catch {
      seen = new Set();
    }
    return seen;
  }

  function markSeen(id) {
    loadSeen().add(id);
    try {
      root.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // storage blocked: the tip may show again next session, which is harmless
    }
  }

  /** Forget every seen tip (Settings → Show tips again). */
  function reset() {
    seen = new Set();
    try {
      root.localStorage.removeItem(SEEN_KEY);
    } catch {
      // nothing to forget
    }
    CL.diag.log('info', 'Tips reset');
  }

  // Situations a tip can wait for.
  const WHEN = {
    lowFood: (c) => c.roster.length > 0 && CL.upkeep.foodDays(c) < 2,
    points: (c) => Boolean(c.character?.skillPoints || c.character?.attributePoints),
    wounded: () => CL.party.woundedSoldiers().length > 0,
    reserves: () => Boolean(CL.game.allyReserve?.length || CL.game.enemyReserve?.length),
    captured: () => CL.game.result && !CL.game.result.win && !CL.game.result.practice,
    // W-05c: the party has left the story's home land, for a named region of the world that isn't
    // `home` (data/world_map.js regions).
    awayFromHome: (c) => {
      const r = CL.world.regionAt(c.world.x, c.world.y);
      return Boolean(r) && !CL.world.map().regions[r.id].home;
    },
    // P8-04: at a kingdom's capital, where Service and fealty are offered.
    atCapital: (c) => {
      const sid = c.world?.location;
      const f = sid ? CL.realm.owner(sid, c) : null;
      return Boolean(f) && CL.realm.isRealm(f) && CL.realm.capitalOf(f) === sid;
    },
    // P8-07: a lord's petition is waiting for your answer.
    petition: (c) => Boolean(CL.nobles?.petition(c)),
    // P9-02: the Realms screen's Diplomacy tab is open.
    diplomacyTab: () => CL.game.realmTab === 'diplomacy',
  };

  /** The text for this device: touch phones get the touch wording, keyboards the key wording. */
  function textFor(t) {
    if (t.text) return t.text;
    let touch = false;
    try {
      touch = Boolean(root.matchMedia?.('(pointer: coarse)').matches);
    } catch {
      touch = false;
    }
    return touch ? t.textTouch : t.textKeys;
  }

  /** The first unseen tip for this screen whose situation holds, or null. */
  function due(mode) {
    if (CL.settings?.get('tips') === false || !CL.campaign) return null;
    loadSeen();
    for (const t of tips()) {
      if (t.on !== mode || seen.has(t.id)) continue;
      if (t.when && !WHEN[t.when]?.(CL.campaign)) continue;
      return t;
    }
    return null;
  }

  /** Show a due tip for this screen, if any and none is showing. Returns the tip shown. */
  function check(mode = CL.game.mode) {
    if (showing || CL.game.practice) return null;
    const t = due(mode);
    if (!t) return null;
    showing = t;
    markSeen(t.id);
    if (t.pause && mode === 'battle') CL.ui.setPaused?.(true, 'tip');
    CL.ui.showTip?.({ ...t, text: textFor(t) });
    CL.diag.log('info', 'Tip shown', { tip: t.id });
    return t;
  }

  /** The card was closed ("Got it", or the screen moved on). */
  function dismiss() {
    const t = showing;
    showing = null;
    if (t?.pause && CL.game.mode === 'battle') CL.ui.setPaused?.(false, 'tip');
    return t;
  }

  /** From the main loop: situation tips (low food, points, wounded) are checked once a second. */
  function tick(now) {
    if (now - lastCheck < CHECK_EVERY) return;
    lastCheck = now;
    if (['map', 'town', 'settlement', 'battle'].includes(CL.game.mode)) check();
  }

  /** Content checks (from content.validate). */
  function validate(C, err) {
    for (const t of Object.values(C.tips || {})) {
      if (!t.title || !(t.text || (t.textTouch && t.textKeys))) err(`tip ${t.id}: needs a title and text (or textTouch and textKeys)`);
      if (!C.help_topics?.[t.help]) err(`tip ${t.id}: unknown help topic ${t.help}`);
      if (t.when && !WHEN[t.when]) err(`tip ${t.id}: unknown situation ${t.when}`);
    }
    for (const h of Object.values(C.help_topics || {})) {
      if (!h.title || !Array.isArray(h.body) || !h.body.length) err(`help ${h.id}: needs a title and text`);
      for (const row of h.controls || []) if (!Array.isArray(row) || row.length !== 3) err(`help ${h.id}: controls rows are [touch, keys, action]`);
    }
  }

  CL.tips = { SEEN_KEY, WHEN, check, dismiss, tick, reset, due, textFor, validate, showing: () => showing };
})(typeof window !== 'undefined' ? window : globalThis);
