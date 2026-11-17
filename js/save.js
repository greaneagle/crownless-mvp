/* Crownless save service.
 *
 * Schema v2 (key `crownless_save`): individual soldiers with troop IDs, XP and wound timers,
 * an item inventory and a campaign day clock. Every write first copies the previous save to
 * `crownless_save_backup`; a corrupt main save falls back to the backup.
 *
 * Schema v1 (key `crownless_v03_party`, build 0.3.x) held aggregate counts. It is migrated on
 * first load (infantry → levy, archers → hunter) and left untouched as a further backup. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const VERSION = 2;
  const KEY = 'crownless_save';
  const BACKUP_KEY = 'crownless_save_backup';
  const LEGACY_KEY = 'crownless_v03_party';
  const MAX_VALUE = 99999;
  const MAX_ROSTER = 200;
  const V1_TROOP = { infantry: 'levy', archer: 'hunter' };
  const WOUND_DAYS = 2;

  const isCount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const count = (n, fallback) => (isCount(n) ? Math.min(MAX_VALUE, Math.floor(n)) : fallback);

  /**
   * A brand-new campaign (GDD §5): the background's kit — 60 crowns, worn sword, clothing,
   * oak shield, food — and no soldiers. The character itself is filled in by the creator.
   */
  function starter(background = 'farmhand') {
    const c = {
      version: VERSION,
      gold: 0,
      renown: 0,
      battles: 0,
      victories: 0,
      day: 0, // campaign days elapsed (fractional)
      nextSoldierId: 1,
      roster: [],
      inventory: {},
      lastResolvedBattle: 0,
      world: CL.world.defaultState(), // map position, current settlement, site timers
      character: null, // set by the character creator
      equipment: CL.character.blankEquipment(),
      food: 0, // rations; one feeds 5 people for a day
      morale: CL.upkeep.MORALE.start,
      nextWagesDay: CL.upkeep.WAGE_INTERVAL,
      starving: false,
      markets: CL.trade.defaultMarkets(), // current scarcity per settlement and good
      cargo: {}, // trade goods carried
      rngSeed: CL.autoresolve.newSeed(), // seeded randomness for the world and auto-resolve
      parties: [], // patrols, caravans and bands on the map
      partySpawns: {}, // template id → day its next party may appear
      nextPartyId: 1,
      contract: null, // the one active contract
      contractOffers: {}, // settlement id → posted offer
      nextContractId: 1,
      contractsDone: 0,
      reputation: CL.realm.defaultReputation(), // kingdom → score [-100, 100] (GDD §10)
      owners: CL.realm.defaultOwners(), // fort → owning kingdom (GDD §12 territory)
      story: CL.story.blank(), // quest progress, story flags, conversation visits (GDD §13)
      companion: null, // Mara, once she joins (GDD §10)
      news: CL.news.blank(), // recent world events and regional news lines
    };
    CL.character.applyKit(c, background);
    CL.upkeep.stowFood(c);
    CL.parties.ensure(c, true);
    return c;
  }

  function addSoldier(c, troop, woundedUntil = null) {
    const s = { id: c.nextSoldierId++, troop, xp: 0, woundedUntil };
    c.roster.push(s);
    return s;
  }

  const knownTroop = (id) => Boolean(CL.content.table('troops')[id]) && id !== 'hero';
  const knownItem = (id) => Boolean(CL.content.table('items')[id]);

  /** Validate a parsed v2 save; unknown IDs and malformed entries are dropped (GDD §13). */
  function sanitize(d) {
    if (d?.version !== VERSION) return null;
    const s = starter();
    for (const k of ['gold', 'renown', 'battles', 'victories', 'lastResolvedBattle']) s[k] = count(d[k], s[k]);
    s.day = isCount(d.day) ? Math.min(MAX_VALUE, d.day) : 0;
    if (Array.isArray(d.roster)) {
      s.roster = [];
      const seen = new Set();
      for (const e of d.roster.slice(0, MAX_ROSTER)) {
        if (!e || !knownTroop(e.troop) || !Number.isInteger(e.id) || e.id < 1 || seen.has(e.id)) continue;
        seen.add(e.id);
        s.roster.push({
          id: e.id,
          troop: e.troop,
          xp: count(e.xp, 0),
          woundedUntil: isCount(e.woundedUntil) ? e.woundedUntil : null,
        });
      }
    }
    const maxId = s.roster.reduce((m, e) => Math.max(m, e.id), 0);
    s.nextSoldierId = Math.max(maxId + 1, count(d.nextSoldierId, 1));
    s.world = CL.world.sanitize(d.world);
    s.character = CL.character.sanitize(d.character);
    s.equipment = CL.character.sanitizeEquipment(d.equipment);
    s.inventory = {};
    if (d.inventory && typeof d.inventory === 'object') {
      for (const [id, n] of Object.entries(d.inventory)) {
        if (knownItem(id) && isCount(n) && n >= 1) s.inventory[id] = Math.min(MAX_VALUE, Math.floor(n));
      }
    }
    CL.upkeep.sanitize(s, d); // food, morale, payday (and stows any food items)
    CL.trade.sanitize(s, d); // market scarcity and cargo
    CL.realm.sanitize(s, d); // reputation and fort owners
    CL.story.sanitize(s, d); // quests and flags: unknown quests and stages are dropped
    CL.companion.sanitize(s, d); // companion and her gear
    CL.news.sanitize(s, d); // recent events and news lines
    CL.parties.sanitize(s, d); // world parties and the RNG seed
    CL.contracts.sanitize(s, d); // after parties: an active hunt needs its band
    return s;
  }

  /** Convert a 0.3.x aggregate save into a v2 roster. */
  function migrateV1(d) {
    if (d?.version !== 1) return null;
    const c = starter();
    c.roster = [];
    c.nextSoldierId = 1;
    for (const k of ['gold', 'renown', 'battles', 'victories']) c[k] = count(d[k], c[k]);
    const add = (role, n, wounded) => {
      for (let i = 0; i < Math.min(count(n, 0), MAX_ROSTER); i++) {
        addSoldier(c, V1_TROOP[role], wounded ? WOUND_DAYS : null);
      }
    };
    add('infantry', d.infantry, false);
    add('archer', d.archer, false);
    add('infantry', d.woundedInfantry, true);
    add('archer', d.woundedArcher, true);
    c.lastResolvedBattle = c.battles;
    return c;
  }

  function read(key) {
    const text = root.localStorage.getItem(key);
    return text == null ? null : JSON.parse(text);
  }

  function tryLoad(key, convert) {
    try {
      return convert(read(key));
    } catch (e) {
      CL.diag.log('warn', 'Cannot read save', { key, error: String(e) });
      return null;
    }
  }

  /** Load the best available save. Sets CL.save.existed so the title can offer Continue. */
  function load() {
    CL.save.existed = true;
    const main = tryLoad(KEY, sanitize);
    if (main) return main;
    const backup = tryLoad(BACKUP_KEY, sanitize);
    if (backup) {
      CL.diag.log('warn', 'Main save unreadable; restored backup');
      // Tell the player rather than quietly losing their last few minutes.
      CL.save.notice = 'Your latest save could not be read, so the one before it was loaded. You may have lost a few minutes.';
      return backup;
    }
    const legacy = tryLoad(LEGACY_KEY, migrateV1);
    if (legacy) {
      CL.diag.log('info', 'Migrated 0.3 save to v2', { soldiers: legacy.roster.length });
      return legacy;
    }
    CL.save.existed = false;
    return starter();
  }

  /**
   * Another tab of this game wrote the save (the `storage` event only fires in the other tabs). This
   * tab's copy is now out of date: it stops saving, so it can't overwrite newer progress, and says so.
   */
  function bindTabs() {
    root.addEventListener?.('storage', (e) => {
      if (e.key !== KEY || CL.save.stale) return;
      CL.save.stale = true;
      CL.diag.log('warn', 'Save changed in another tab; this tab stopped saving');
      CL.ui?.showStale?.();
    });
  }

  function write() {
    if (CL.save.stale) {
      CL.ui?.message?.('This game is open in another tab. Reload this page to carry on here.');
      return false;
    }
    try {
      const previous = root.localStorage.getItem(KEY);
      if (previous) root.localStorage.setItem(BACKUP_KEY, previous);
      root.localStorage.setItem(KEY, JSON.stringify(CL.campaign));
      CL.save.lastSavedAt = Date.now();
      CL.save.lastError = null;
      CL.diag.log('info', 'Campaign saved', { day: CL.campaign.day, soldiers: CL.campaign.roster.length });
      return true;
    } catch (e) {
      // GDD §13: browser storage can fail or be cleared — tell the player to export.
      if (!CL.save.lastError) CL.ui?.message?.('Could not save in this browser — use Save & export to keep your progress.');
      CL.save.lastError = String(e);
      CL.diag.log('error', 'Save failed', { error: String(e) });
      return false;
    }
  }

  CL.save = {
    VERSION,
    KEY,
    BACKUP_KEY,
    LEGACY_KEY,
    WOUND_DAYS,
    starter,
    addSoldier,
    sanitize,
    migrateV1,
    existed: false,
    lastSavedAt: null,
    lastError: null,
    stale: false,
    notice: null,
    load,
    write,
    bindTabs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
