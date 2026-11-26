/* Crownless first-time tips (Gate E tutorial; content in data/help.js). The first time a screen or
 * situation comes up, a short card explains it once — per device, so a second campaign on the same
 * phone isn't lectured again. Tips can be turned off or shown again from Settings. The first battle
 * waits while its controls card is read. Q1 remains the playable tutorial (GDD §4).
 * P10-07: the beginner steps are a guide (`guide: true`, in the table's order): moving on the map,
 * a town and its people, hiring, food, an encounter and auto-resolve, the first battle, saving. Each
 * shows once at its moment; one can be passed with Got it, or the whole guide with Skip the guide.
 * Everything deeper is a hint card only. One setting turns both off; "Show hints again" resets them.
 * How to Play opens at your stage (`stage`: captain, vassal, lord or ruler).
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
    // P10-01: the speed hint, after the first contract done; P10-05: or at the end of your origin's opening quest.
    contractDone: (c) => (c.contractsDone || 0) > 0,
    originDone: (c) => Boolean(CL.story.state(c).flags.origin_done) || (c.contractsDone || 0) > 0,
    lowFood: (c) => c.roster.length > 0 && CL.upkeep.foodDays(c) < 2,
    points: (c) => Boolean(c.character?.skillPoints || c.character?.attributePoints),
    wounded: () => CL.party.woundedSoldiers().length > 0,
    reserves: () => Boolean(CL.game.allyReserve?.length || CL.game.enemyReserve?.length),
    captured: () => CL.game.result && !CL.game.result.win && !CL.game.result.practice,
    // W-05c: the party has left the story's home land, for a named region of the world that isn't
    // `home` (data/world_map.js regions).
    awayFromHome: (c) => {
      const r = CL.world.regionAt(c.world.x, c.world.y, c);
      return Boolean(r) && !r.home;
    },
    // P10-07: the guide's moments. In a settlement with no soldiers yet, where some are for hire.
    canHire: (c) => c.roster.length === 0 && Boolean(c.world?.location) && CL.party.recruitsHere().length > 0,
    // A day on the road: time to say the game saves itself.
    secondDay: (c) => c.day >= 1,
    // P10-07: deeper hints. You are summoned to ride with your realm's army.
    summoned: (c) => Boolean(c.armyCall),
    // The Realms screen's Lords tab (houses and marriage) and Fief tab are open.
    lordsTab: () => CL.game.realmTab === 'lords',
    fiefTab: () => CL.game.realmTab === 'fief',
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
    // P9-03: the Your realm tab is open.
    ruleTab: () => CL.game.realmTab === 'rule',
    // P11-05: the hero swung at nothing; the hero broke a shield's guard.
    whiff: () => Boolean(CL.game.whiffed),
    shieldPressure: () => Boolean(CL.game.brokeGuard),
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

  /** P10-07: the guide's steps, in order. */
  const guideSteps = () => tips().filter((t) => t.guide);

  /** Skip the whole guide: its steps are marked seen (the hints still show). */
  function skipGuide() {
    for (const t of guideSteps()) markSeen(t.id);
    if (showing?.guide) dismiss();
    CL.diag.log('info', 'Guide skipped');
  }

  /** "Guide 2 of 7" for a guide step, or null. */
  function step(t) {
    const all = guideSteps();
    const i = all.findIndex((x) => x.id === t.id);
    return i < 0 ? null : { n: i + 1, of: all.length };
  }

  /**
   * Your stage, for How to Play (P10-07): a ruler of a realm, a lord holding land, a vassal sworn to a
   * crown, or a captain of a free company.
   */
  function stage(c = CL.campaign) {
    if (!c) return 'captain';
    if (Object.values(c.rulers || {}).includes(CL.realm.PLAYER)) return 'ruler';
    if (Object.values(c.holdings || {}).some((h) => h.holder === CL.realm.PLAYER)) return 'lord';
    if (CL.allegiance?.state(c).kind === 'vassal') return 'vassal';
    return 'captain';
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
    CL.ui.showTip?.({ ...t, text: textFor(t), step: step(t) });
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
    const STAGES = ['captain', 'vassal', 'lord', 'ruler'];
    for (const h of Object.values(C.help_topics || {})) if (h.stage != null && !STAGES.includes(h.stage)) err(`help ${h.id}: stage is captain, vassal, lord or ruler`);
    for (const h of Object.values(C.help_topics || {})) {
      if (!h.title || !Array.isArray(h.body) || !h.body.length) err(`help ${h.id}: needs a title and text`);
      for (const row of h.controls || []) if (!Array.isArray(row) || row.length !== 3) err(`help ${h.id}: controls rows are [touch, keys, action]`);
    }
  }

  CL.tips = { SEEN_KEY, WHEN, STAGES: ['captain', 'vassal', 'lord', 'ruler'], check, dismiss, tick, reset, due, textFor, validate, skipGuide, guideSteps, step, stage, showing: () => showing };
})(typeof window !== 'undefined' ? window : globalThis);
