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

  function starter() {
    const c = {
      version: VERSION,
      gold: 130,
      renown: 0,
      battles: 0,
      victories: 0,
      day: 0, // campaign days elapsed (fractional)
      nextSoldierId: 1,
      roster: [],
      inventory: {},
      lastResolvedBattle: 0,
      world: CL.world.defaultState(), // map position, current settlement, site timers
    };
    for (const t of ['levy', 'levy', 'levy', 'hunter', 'hunter']) addSoldier(c, t);
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
    s.inventory = {};
    if (d.inventory && typeof d.inventory === 'object') {
      for (const [id, n] of Object.entries(d.inventory)) {
        if (knownItem(id) && isCount(n) && n >= 1) s.inventory[id] = Math.min(MAX_VALUE, Math.floor(n));
      }
    }
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

  function load() {
    const main = tryLoad(KEY, sanitize);
    if (main) return main;
    const backup = tryLoad(BACKUP_KEY, sanitize);
    if (backup) {
      CL.diag.log('warn', 'Main save unreadable; restored backup');
      return backup;
    }
    const legacy = tryLoad(LEGACY_KEY, migrateV1);
    if (legacy) {
      CL.diag.log('info', 'Migrated 0.3 save to v2', { soldiers: legacy.roster.length });
      return legacy;
    }
    return starter();
  }

  function write() {
    try {
      const previous = root.localStorage.getItem(KEY);
      if (previous) root.localStorage.setItem(BACKUP_KEY, previous);
      root.localStorage.setItem(KEY, JSON.stringify(CL.campaign));
      CL.diag.log('info', 'Campaign saved', { day: CL.campaign.day, soldiers: CL.campaign.roster.length });
    } catch (e) {
      CL.diag.log('error', 'Save failed', { error: String(e) });
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
    load,
    write,
  };
})(typeof window !== 'undefined' ? window : globalThis);
