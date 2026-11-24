// @ts-check
/* Crownless portable saves (GDD §13): manual export/import between browsers and devices.
 *
 * File: { format: 'crownless-save', version, game, exportedAt, checksum, campaign }.
 * The checksum (FNV-1a over the campaign JSON) catches damaged or hand-edited files.
 * Import is strict: malformed files, saves from a newer version and ANY unknown ID are rejected
 * with a list of problems, and the current save is never touched by a failed import. Before a
 * successful import the current save is set aside in its own slot so it can be restored. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const FORMAT = 'crownless-save';
  const PRE_IMPORT_KEY = 'crownless_save_pre_import';
  const MAX_BYTES = 2_000_000;
  const MAX_PROBLEMS = 8;

  /** FNV-1a 32-bit, as 8 hex digits. Integrity only, not security. */
  function checksum(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function serialize(c = CL.campaign) {
    const body = JSON.stringify(c);
    return JSON.stringify(
      {
        format: FORMAT,
        version: CL.save.VERSION,
        game: CL.BUILD,
        exportedAt: new Date().toISOString(),
        checksum: checksum(body),
        campaign: c,
      },
      null,
      1,
    );
  }

  /** A safe download name: crownless-edda-day12-2026-11-16.json */
  function fileName(c = CL.campaign, date = new Date()) {
    const who = (c.character?.name || 'wanderer')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
    return `crownless-${who || 'wanderer'}-day${CL.party.dayNumber(c.day)}-${date.toISOString().slice(0, 10)}.json`;
  }

  // ---- Strict validation: every ID must exist in the content ----

  function unknownIds(raw) {
    const problems = [];
    const has = (table, id) => Boolean(CL.content.table(table)[id]);
    const bad = (what) => problems.length < MAX_PROBLEMS && problems.push(what);
    const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);

    for (const s of Array.isArray(raw.roster) ? raw.roster : []) {
      if (!has('troops', s?.troop) || s.troop === 'hero') bad(`unknown troop "${s?.troop}"`);
    }
    for (const id of Object.keys(obj(raw.inventory) ? raw.inventory : {})) if (!has('items', id)) bad(`unknown item "${id}"`);
    for (const [slot, id] of Object.entries(obj(raw.equipment) ? raw.equipment : {})) {
      if (id != null && CL.content.table('items')[id]?.slot !== slot) bad(`"${id}" cannot be worn as ${slot}`);
    }
    if (raw.world?.location != null && !has('settlements', raw.world.location)) bad(`unknown settlement "${raw.world.location}"`);
    const sites = CL.world.map().sites;
    for (const id of Object.keys(obj(raw.world?.sites) ? raw.world.sites : {})) if (!sites[id]) bad(`unknown site "${id}"`);
    if (raw.character) {
      if (!has('backgrounds', raw.character.background)) bad(`unknown background "${raw.character.background}"`);
      for (const id of Object.keys(obj(raw.character.skills) ? raw.character.skills : {})) if (!has('skills', id)) bad(`unknown skill "${id}"`);
    }
    for (const id of Object.keys(obj(raw.cargo) ? raw.cargo : {})) {
      if (!CL.content.table('markets')[id]?.tradeGood) bad(`unknown trade good "${id}"`);
    }
    for (const sid of Object.keys(obj(raw.markets) ? raw.markets : {})) if (!has('settlements', sid)) bad(`unknown market "${sid}"`);
    for (const p of Array.isArray(raw.parties) ? raw.parties : []) {
      if (!has('party_templates', p?.template)) bad(`unknown party type "${p?.template}"`);
      for (const id of Object.keys(obj(p?.troops) ? p.troops : {})) if (!has('troops', id)) bad(`unknown troop "${id}" in a party`);
    }
    // Boards hold one offer per template (older saves: a single offer) plus 'taken' markers.
    const offers = Object.values(obj(raw.contractOffers) ? raw.contractOffers : {}).flatMap((b) =>
      obj(b) && b.template ? [b] : Object.values(obj(b) ? b : {}).filter((o) => obj(o)),
    );
    for (const k of [raw.contract, ...offers]) {
      if (!obj(k)) continue;
      if (!has('contracts', k.template)) bad(`unknown contract "${k.template}"`);
      if (!has('settlements', k.giver)) bad(`unknown contract giver "${k.giver}"`);
      if (k.to != null && !has('settlements', k.to)) bad(`unknown contract destination "${k.to}"`);
      if (k.good != null && !has('markets', k.good)) bad(`unknown contract goods "${k.good}"`);
    }
    for (const e of Array.isArray(raw.news?.events) ? raw.news.events : []) {
      if (!obj(e)) continue;
      if (!has('news', e.kind)) bad(`unknown news kind "${e.kind}"`);
      for (const k of ['place', 'dest', 'fort']) if (e[k] != null && !has('settlements', e[k])) bad(`unknown place "${e[k]}" in the news`);
    }
    return problems;
  }

  /**
   * Parse and check an exported file (or a raw save object). Never touches storage.
   * Returns { ok: true, campaign } or { ok: false, reason, problems }.
   */
  /**
   * Save text that went through a chat app, email or notes may pick up a byte-order mark, blank lines
   * or code fences around it. Keep just the JSON object.
   */
  function clean(text) {
    let t = String(text).replace(/^\uFEFF/, '').trim();
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first > 0 || (last >= 0 && last < t.length - 1)) t = t.slice(Math.max(0, first), last + 1);
    return t;
  }

  // ---- Export reminders (GDD §13: browser storage can be cleared; iOS Safari clears it after ~7 days unused) ----

  const EXPORT_KEY = 'crownless_last_export';
  const REMIND_AFTER_DAYS = 7; // real days since the last export
  const REMIND_FROM_DAY = 3; // campaign days played before the first reminder
  let reminded = false;

  function lastExport() {
    try {
      const v = JSON.parse(root.localStorage.getItem(EXPORT_KEY) || 'null');
      return v && typeof v.at === 'number' ? v : null;
    } catch {
      return null;
    }
  }

  /** Remember that the player took a copy (file or text) just now. */
  function markExported(c = CL.campaign) {
    try {
      root.localStorage.setItem(EXPORT_KEY, JSON.stringify({ at: Date.now(), day: c.day }));
    } catch {
      // nothing to remember it in
    }
  }

  /** Once a session, on entering a settlement: a nudge to export if it's overdue. Returns the text or null. */
  function reminder(c = CL.campaign, now = Date.now()) {
    if (reminded || !c?.character) return null;
    const last = lastExport();
    const due = last ? now - last.at > REMIND_AFTER_DAYS * 86400000 : c.day >= REMIND_FROM_DAY;
    if (!due) return null;
    reminded = true;
    return last
      ? 'It has been a while since you exported a copy of your save. Browsers can clear their storage — Save & export keeps one safe.'
      : 'Your progress lives only in this browser, which can clear it. Save & export makes a copy you can keep or move to another device.';
  }

  /** Ask the browser not to clear this site's storage on its own (granted quietly by most; Firefox may ask). */
  function persist() {
    const s = root.navigator?.storage;
    if (!s?.persist) return Promise.resolve(null);
    return s.persisted().then((already) => already || s.persist()).catch(() => null);
  }

  function parse(text) {
    if (typeof text === 'string') text = clean(text);
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'The file is empty.' };
    if (text.length > MAX_BYTES) return { ok: false, reason: 'The file is too large to be a Crownless save.' };
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'This is not a Crownless save file (it could not be read).' };
    }
    if (!data || typeof data !== 'object') return { ok: false, reason: 'This is not a Crownless save file.' };

    let raw = data;
    if (data.format === FORMAT) {
      if (!Number.isInteger(data.version)) return { ok: false, reason: 'The save file has no version.' };
      if (data.version > CL.save.VERSION) {
        return { ok: false, reason: `This save was made by a newer version of Crownless (${data.game || `save v${data.version}`}). Update the game first.` };
      }
      if (!data.campaign || typeof data.campaign !== 'object') return { ok: false, reason: 'The save file has no campaign in it.' };
      if (data.checksum !== checksum(JSON.stringify(data.campaign))) {
        return { ok: false, reason: 'The save file is damaged or has been edited (checksum mismatch).' };
      }
      raw = data.campaign;
    }

    // Structure first (design SC-31): a partial or damaged campaign is rejected, not filled in.
    if (!Number.isInteger(raw.version)) return { ok: false, reason: 'This is not a Crownless save file.' };
    const check = CL.save.check(raw);
    if (check.newer) return { ok: false, reason: 'This save was made by a newer version of Crownless. Update the game first.' };
    if (check.otherWorld) return { ok: false, reason: 'This save belongs to a world this version no longer has: campaigns begun before the world grew cannot continue in it.', problems: check.problems };
    // P9-08: a save of the other official world: it is imported in that world.
    if (check.elsewhere) return { ok: false, reason: `This save belongs to ${CL.worlds.name(check.elsewhere)}. Choose that world at a new game, then import it again.`, problems: [] };
    if (check.problems.length) return { ok: false, reason: 'The save is incomplete or damaged, so it was not loaded.', problems: check.problems };
    const gone = CL.packs.missing(raw.packs); // P9-07: a pack it was begun with is not on
    if (gone.length) return { ok: false, reason: `${gone.map(CL.save.packNeeded).join('. ')}. Turn it on in Settings, reload, and import again.`, problems: [] };

    if (raw.version === 1) {
      const migrated = CL.save.migrateV1(raw);
      return migrated ? { ok: true, campaign: migrated, migrated: true } : { ok: false, reason: 'The old save could not be read.' };
    }
    const current = CL.save.migrate(raw); // older schema versions step up first (pure; raw is unchanged)
    if (!current) return { ok: false, reason: 'The save could not be read.' };
    const problems = unknownIds(current);
    if (problems.length) return { ok: false, reason: 'The save mentions things this version of the game does not know.', problems };
    const campaign = CL.save.sanitize(current);
    if (!campaign) return { ok: false, reason: 'The save could not be read.' };
    return { ok: true, campaign, migrated: raw.version < CL.save.VERSION };
  }

  const NOT_STORED = 'The game could not be saved in this browser (storage may be full, or the game is open in another tab), so nothing changed.';

  /**
   * Apply a parsed import: set the current save aside, then switch to the imported campaign.
   * Success is reported only once the imported game is stored (design SC-32); if anything fails on
   * the way, the current game and the earlier pre-import copy are put back as they were.
   */
  function importText(text) {
    const r = parse(text);
    if (!r.ok) {
      CL.diag.log('warn', 'Import rejected', { reason: r.reason, problems: r.problems });
      return r;
    }
    const current = CL.storage.get(CL.save.KEY);
    const olderCopy = CL.storage.get(PRE_IMPORT_KEY);
    if (current && !CL.storage.set(PRE_IMPORT_KEY, current)) {
      CL.diag.log('warn', 'Import stopped: no room for a pre-import copy');
      return { ok: false, reason: 'There was no room to keep a copy of your current game first, so nothing was imported. Export your current game, then try again.' };
    }
    const previous = CL.campaign;
    const existed = CL.save.existed;
    CL.campaign = r.campaign;
    if (!CL.save.write()) {
      CL.campaign = previous;
      CL.save.existed = existed;
      if (olderCopy == null) CL.storage.remove(PRE_IMPORT_KEY);
      else CL.storage.set(PRE_IMPORT_KEY, olderCopy);
      CL.diag.log('warn', 'Import not stored; current game kept');
      return { ok: false, reason: NOT_STORED };
    }
    CL.save.existed = true;
    resetTransient();
    CL.diag.log('info', 'Save imported', { day: r.campaign.day, migrated: Boolean(r.migrated) });
    return r;
  }

  function hasPreImport() {
    return Boolean(CL.storage.get(PRE_IMPORT_KEY));
  }

  /** Bring back the save that was replaced by the last import. Its copy is removed only once it is stored again. */
  function restorePreImport() {
    const text = CL.storage.get(PRE_IMPORT_KEY);
    if (!text) return { ok: false, reason: 'There is no earlier save to restore.' };
    let s = null;
    try {
      s = CL.save.fromRaw(JSON.parse(text)).campaign;
    } catch {
      s = null;
    }
    if (!s) return { ok: false, reason: 'The earlier save could not be read.' };
    const previous = CL.campaign;
    CL.campaign = s;
    if (!CL.save.write()) {
      CL.campaign = previous;
      return { ok: false, reason: NOT_STORED };
    }
    resetTransient();
    CL.storage.remove(PRE_IMPORT_KEY);
    CL.diag.log('info', 'Pre-import save restored');
    return { ok: true };
  }

  /** Clear per-session state that belonged to the previous campaign. */
  function resetTransient() {
    Object.assign(CL.game, { travel: null, siteId: null, partyId: null, contactParty: null, waiting: false, waitPlan: null, waitCut: null, godMode: false, newGame: false });
  }

  CL.portable = {
    FORMAT,
    PRE_IMPORT_KEY,
    EXPORT_KEY,
    clean,
    lastExport,
    markExported,
    reminder,
    persist,
    checksum,
    serialize,
    fileName,
    unknownIds,
    parse,
    importText,
    hasPreImport,
    restorePreImport,
  };
})(typeof window !== 'undefined' ? window : globalThis);
