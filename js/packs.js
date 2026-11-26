/* Crownless packs (P9-07, design §23): data-only content packs in the world format (docs/WORLD-FORMAT.md).
 *
 * A pack is one JSON object: a `manifest` (id, title, author, version, engine, requires), tables by
 * name that add entries, and `merge`, which changes fields of entries that already exist. A pack never
 * deletes, and nothing in it is ever run: it is parsed as JSON, checked, and copied into the content.
 *
 * Ids are namespaced (`world:id`). The official world's short ids stay as they are, and
 * `<official world>:stonebridge` reads as `stonebridge`. A pack's new entries are `<pack id>:<name>`.
 *
 * In the browser, packs are kept in IndexedDB (database `crownless`, store `packs`); the ids of those
 * turned on are mirrored in localStorage, so a game with no packs boots without waiting. A change takes
 * effect on a new game or a reload. A save records the packs it was begun with (`packs`), and a save
 * whose pack is missing is refused, untouched (js/save.js).
 */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LIMIT = 2 * 1024 * 1024; // 2 MB of JSON at most (§23.4)
  const ON_KEY = 'crownless_packs_on';
  const DB = 'crownless';
  const STORE = 'packs';
  const NAME = /^[a-z0-9_]{1,40}$/;
  const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
  const BANNED_KEYS = ['__proto__', 'constructor', 'prototype'];
  const TEXT = ['name', 'short', 'placeName', 'title', 'description', 'text', 'summary'];
  const MAX_DEPTH = 24;

  const raw = () => root.CROWNLESS_CONTENT || {};
  /** The official world: the first world of the data the build shipped with (before any pack). */
  const OFFICIAL = Object.keys(raw().world_map || {})[0] || '';
  const official = () => OFFICIAL;

  /** `<official world>:x` reads as the short id `x`; any other id is itself. */
  function resolve(id) {
    if (typeof id !== 'string') return id;
    const p = `${OFFICIAL}:`;
    return OFFICIAL && id.startsWith(p) ? id.slice(p.length) : id;
  }

  // ---- Versions ----

  const parseVersion = (v) => {
    const m = SEMVER.exec(String(v));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

  /** Does `version` meet `range` (space-separated `>=1.2.0 <2.0.0`, `^1.2.0`, `=1.2.0` or `1.2.0`)? */
  function satisfies(version, range) {
    const v = parseVersion(version);
    if (!v || typeof range !== 'string' || !range.trim()) return false;
    for (const part of range.trim().split(/\s+/)) {
      const m = /^(>=|<=|>|<|=|\^)?(\d+\.\d+\.\d+)$/.exec(part);
      if (!m) return false;
      const w = /** @type {number[]} */ (parseVersion(m[2]));
      const c = cmp(v, w);
      const op = m[1] || '=';
      const ok = op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : op === '=' ? c === 0 : c >= 0 && v[0] === w[0] && (w[0] > 0 || v[1] === w[1]);
      if (!ok) return false;
    }
    return true;
  }
  const validRange = (range) => typeof range === 'string' && range.trim().split(/\s+/).every((p) => /^(>=|<=|>|<|=|\^)?\d+\.\d+\.\d+$/.test(p));

  // ---- Checks ----

  /** Strings, numbers, booleans, null, arrays and plain objects only; no keys that reach prototypes; no links or scripts. */
  function walk(v, at, err, depth = 0) {
    if (depth > MAX_DEPTH) {
      err(`${at}: nested too deeply`);
      return;
    }
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) err(`${at}: not a number JSON can hold`);
      return;
    }
    if (typeof v === 'string') {
      if (/^\s*(javascript|data|vbscript):/i.test(v) || /<\s*script/i.test(v)) err(`${at}: looks like code, and packs hold data only`);
      else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^[\\/]/.test(v) || /(^|[\\/])\.\.([\\/]|$)/.test(v)) err(`${at}: a path must stay inside the pack (no links, no leading /, no ..)`);
      return;
    }
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) walk(v[i], `${at}[${i}]`, err, depth + 1);
      return;
    }
    if (typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]' && Object.getPrototypeOf(Object.getPrototypeOf(v) ?? Object.prototype) === null) { // a plain object, from any realm
      for (const k of Object.keys(v)) {
        if (BANNED_KEYS.includes(k)) err(`${at}: the key "${k}" is not allowed`);
        else walk(v[k], `${at}.${k}`, err, depth + 1);
      }
      return;
    }
    err(`${at}: not plain data`);
  }

  const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'list' : typeof v === 'object' ? 'object' : typeof v);

  /** The manifest's problems (`file` names the pack in each message). */
  function checkManifest(m, file, err, world = false) {
    const at = `${file} › manifest`;
    if (!isObj(m)) return err(`${at}: missing (it needs id, title, author, version and engine)`);
    if (!NAME.test(m.id || '')) err(`${at}: id must be 1–40 of a–z, 0–9 and _ (got ${JSON.stringify(m.id)})`);
    else if (!world && (m.id === OFFICIAL || CL.worlds?.known(m.id))) err(`${at}: id ${m.id} is an official world's`);
    for (const k of ['title', 'author']) if (typeof m[k] !== 'string' || !m[k].trim()) err(`${at}: ${k} must be text`);
    if (!parseVersion(m.version)) err(`${at}: version must look like 1.0.0 (got ${JSON.stringify(m.version)})`);
    if (!validRange(m.engine)) err(`${at}: engine must be a version range such as ">=3.13.0 <4.0.0" (got ${JSON.stringify(m.engine)})`);
    else if (!satisfies(CL.BUILD, m.engine)) err(`${at}: needs the game at ${m.engine}; this is ${CL.BUILD}`);
    if (m.requires != null && (!Array.isArray(m.requires) || m.requires.some((r) => !NAME.test(typeof r === 'string' ? r : r?.id || '')))) err(`${at}: requires must be a list of pack ids`);
    if (m.kind != null && !['pack', 'world'].includes(m.kind)) err(`${at}: kind must be pack or world`);
  }

  /** `merge`'s problems: only entries that exist (in `content` or the pack's own), no change of id, the same type as now. */
  function checkMerge(merge, content, pack, file, err) {
    if (merge == null) return;
    if (!isObj(merge)) return err(`${file} › merge: must be an object of tables`);
    for (const [t, entries] of Object.entries(merge)) {
      if (!CL.content.TABLES.includes(t)) {
        err(`${file} › merge › ${t}: not a table of the world format`);
        continue;
      }
      if (!isObj(entries)) {
        err(`${file} › merge › ${t}: must be an object of entries by id`);
        continue;
      }
      for (const [key, fields] of Object.entries(entries)) {
        const at = `${file} › merge › ${t} › ${key}`;
        const old = content[t]?.[resolve(key)] || pack[t]?.[key];
        if (!old) {
          err(`${at}: there is no ${t} entry ${key} to change`);
          continue;
        }
        if (!isObj(fields)) {
          err(`${at}: must be an object of fields`);
          continue;
        }
        for (const [f, v] of Object.entries(fields)) {
          if (f === 'id') err(`${at}: an entry's id cannot change`);
          else if (f in old && old[f] !== null && v !== null && kind(old[f]) !== kind(v)) err(`${at}: ${f} must be ${kind(old[f]) === 'list' ? 'a list' : `a ${kind(old[f]) === 'string' ? 'text' : kind(old[f])}`}, as it is now (got ${kind(v) === 'string' ? 'text' : kind(v)})`);
        }
      }
    }
  }

  /**
   * Every problem with a pack, each saying which file, which entry and what is wrong. `content` is what
   * it would be added to (the data as it stands); `present` the ids of the packs already applied.
   * Checks the shape, the ids and the types first; then applies the pack to a copy and runs the game's
   * own content checks on the result, keeping those that name the pack's entries.
   * @returns {string[]}
   */
  function check(pack, { file = 'pack.json', content = raw(), present = [] } = {}) {
    const errors = [];
    const err = (msg) => errors.push(msg);
    if (!isObj(pack)) return [`${file}: a pack is one JSON object`];
    walk(pack, file, err);
    if (errors.length) return errors;
    checkManifest(pack.manifest, file, err);
    if (errors.length) return errors;
    const id = pack.manifest.id;
    for (const r of pack.manifest.requires || []) {
      const rid = typeof r === 'string' ? r : r.id;
      if (!present.includes(rid)) err(`${file} › manifest: requires the pack ${rid}, which is not loaded`);
    }
    const TABLES = CL.content.TABLES;
    const added = [];
    for (const [t, entries] of Object.entries(pack)) {
      if (t === 'manifest' || t === 'merge') continue;
      if (!TABLES.includes(t)) {
        err(`${file} › ${t}: not a table of the world format`);
        continue;
      }
      if (!isObj(entries)) {
        err(`${file} › ${t}: must be an object of entries by id`);
        continue;
      }
      for (const [key, rec] of Object.entries(entries)) {
        const at = `${file} › ${t} › ${key}`;
        const [ns, name, more] = key.split(':');
        if (ns !== id || !NAME.test(name || '') || more !== undefined) err(`${at}: a new entry's id must be ${id}:<name>, with a–z, 0–9 and _`);
        else if (content[t]?.[key]) err(`${at}: already exists (a pack adds new entries; change old ones under merge)`);
        if (!isObj(rec)) {
          err(`${at}: must be an object`);
          continue;
        }
        if (rec.id !== key) err(`${at}: its id field must be "${key}" (got ${JSON.stringify(rec.id)})`);
        for (const k of TEXT) if (k in rec && typeof rec[k] !== 'string') err(`${at}: ${k} must be text`);
        added.push([t, key]);
      }
    }
    checkMerge(pack.merge, content, pack, file, err);
    if (errors.length) return errors;
    // The game's own checks on the result: references, ranges, the map.
    const copy = JSON.parse(JSON.stringify(content));
    apply(copy, pack);
    const before = new Set(CL.content.validate(JSON.parse(JSON.stringify(content))));
    const names = [...added.map(([, k]) => k), ...Object.values(pack.merge || {}).flatMap((e) => Object.keys(e).map(resolve))];
    for (const e of CL.content.validate(copy)) {
      if (before.has(e)) continue;
      const which = names.find((n) => e.includes(n));
      err(`${file} › ${which ? `${which}: ` : ''}${e}`);
    }
    return errors;
  }

  /**
   * P9-08: every problem with a whole world (`kind: "world"`): the same shape, manifest and merge rules
   * as a pack; its one world_map entry under its own id; then the game's content checks on the world
   * put over `base` (the shared tables it does not give: items, goods, skills, help …).
   * @returns {string[]}
   */
  function checkWorld(world, { file = 'world.json', base = raw() } = {}) {
    const errors = [];
    const err = (msg) => errors.push(msg);
    if (!isObj(world)) return [`${file}: a world is one JSON object`];
    walk(world, file, err);
    if (errors.length) return errors;
    checkManifest(world.manifest, file, err, true);
    if (errors.length) return errors;
    const id = world.manifest.id;
    if (world.manifest.kind !== 'world') err(`${file} › manifest: kind must be world for a whole world`);
    const allowed = [...CL.content.TABLES, ...WORLD_EXTRA];
    for (const [t, entries] of Object.entries(world)) {
      if (t === 'manifest' || t === 'merge') continue;
      if (!allowed.includes(t)) err(`${file} › ${t}: not a table of the world format`);
      else if (!isObj(entries)) err(`${file} › ${t}: must be an object of entries by id`);
      else for (const [key, rec] of Object.entries(entries)) for (const k of TEXT) if (isObj(rec) && k in rec && typeof rec[k] !== 'string') err(`${file} › ${t} › ${key}: ${k} must be text`);
    }
    const maps = Object.keys(world.world_map || {});
    if (maps.length !== 1 || maps[0] !== id) err(`${file} › world_map: needs one world, under the manifest's id ${id} (got ${maps.join(', ') || 'none'})`);
    checkMerge(world.merge, base, {}, file, err);
    for (const t of Object.keys(world.merge || {})) if (world[t]) err(`${file} › merge › ${t}: the world gives this table whole; change it there`);
    if (errors.length) return errors;
    for (const e of CL.content.validate(CL.content.compose(JSON.parse(JSON.stringify(base)), world))) err(`${file} › ${e}`);
    return errors;
  }
  // Tables of the format outside CL.content.TABLES (the blacksmith's rules, the founded realms' banners,
  // the gear check's words: P11-02, its codes fixed by the game).
  const WORLD_EXTRA = ['forge', 'realm_palette', 'gear_text'];

  /** Add the pack's entries to `content` and change the fields `merge` names. Pure data: nothing is run. */
  function apply(content, pack) {
    for (const [t, entries] of Object.entries(pack)) {
      if (t === 'manifest' || t === 'merge') continue;
      content[t] = content[t] || {};
      for (const [key, rec] of Object.entries(entries)) content[t][key] = JSON.parse(JSON.stringify(rec));
    }
    for (const [t, entries] of Object.entries(pack.merge || {})) {
      for (const [key, fields] of Object.entries(entries)) {
        const rec = content[t]?.[resolve(key)];
        if (rec) Object.assign(rec, JSON.parse(JSON.stringify(fields)));
      }
    }
    return content;
  }

  /**
   * Read a pack from its text: the size, then JSON (never evaluated), then `check`.
   * @returns {{ pack: any, errors: string[] }}
   */
  function parse(text, opts = {}) {
    const file = opts.file || 'pack.json';
    if (typeof text !== 'string') return { pack: null, errors: [`${file}: not text`] };
    if (text.length > LIMIT) return { pack: null, errors: [`${file}: ${Math.ceil(text.length / 1024)} KB is over the 2 MB a pack may be`] };
    let pack;
    try {
      pack = JSON.parse(text);
    } catch (e) {
      return { pack: null, errors: [`${file}: not JSON (${String(e.message || e).slice(0, 120)})`] };
    }
    const errors = pack?.manifest?.kind === 'world' ? checkWorld(pack, { ...opts, file }) : check(pack, { ...opts, file });
    return { pack: errors.length ? null : pack, errors };
  }

  /** A world in the format back into content tables (the manifest set aside). */
  function worldContent(world) {
    const C = {};
    for (const [t, v] of Object.entries(world)) if (t !== 'manifest') C[t] = JSON.parse(JSON.stringify(v));
    return C;
  }

  // ---- The packs this game is playing with ----

  /** @type {{ id: string, version: string, title: string }[]} */
  const active = [];
  /** @type {string[]} */
  const bootErrors = [];

  /** The packs applied to this game's content, in order. */
  const applied = () => active.map((p) => ({ ...p }));
  /** What a new save records: `[{ id, version }]`. */
  const forSave = () => active.map(({ id, version }) => ({ id, version }));

  /**
   * Apply packs to the live content (at boot, before anything reads it; tests use it the same way).
   * Each is checked against the content as it stands; one with problems is left out, with them noted.
   * @returns {string[]} the problems of those left out
   */
  function use(packs) {
    const problems = [];
    for (const pack of packs) {
      const errors = check(pack, { file: `${pack?.manifest?.id || 'pack'}.json`, present: active.map((p) => p.id) });
      if (errors.length) {
        problems.push(...errors);
        continue;
      }
      apply(raw(), pack);
      const m = pack.manifest;
      active.push({ id: m.id, version: m.version, title: m.title });
    }
    if (problems.length) CL.diag?.log('error', 'Pack left out', { problems: problems.slice(0, 10) });
    if (active.length) CL.diag?.log('info', 'Packs applied', { packs: active.map((p) => `${p.id}@${p.version}`) });
    return problems;
  }

  /**
   * A save's `packs` against those applied: the ones it needs that are missing (a different version of
   * one that is on is accepted, and noted).
   * @returns {{ id: string, version: string }[]}
   */
  function missing(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((p) => p && typeof p.id === 'string' && !active.some((a) => a.id === p.id)).map((p) => ({ id: String(p.id).slice(0, 40), version: String(p.version ?? '?').slice(0, 20) }));
  }

  /** A save's `packs`, repaired: `[{ id, version }]` of plausible ids only. */
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((p) => p && NAME.test(p.id || '') && typeof p.version === 'string').map((p) => ({ id: p.id, version: p.version.slice(0, 20) }));
  }

  // ---- The browser's store (IndexedDB) ----

  function onIds() {
    try {
      const v = JSON.parse(root.localStorage?.getItem(ON_KEY) || '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  function setOnIds(ids) {
    try {
      if (ids.length) root.localStorage?.setItem(ON_KEY, JSON.stringify(ids));
      else root.localStorage?.removeItem(ON_KEY);
    } catch (e) {
      CL.diag?.log('warn', 'Pack list not kept', { error: String(e) });
    }
  }

  /** @returns {Promise<IDBDatabase>} */
  function openDb() {
    return new Promise((resolveDb, reject) => {
      if (!root.indexedDB) return reject(new Error('this browser has no IndexedDB'));
      const req = root.indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolveDb(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  /** One request on the store, as a promise. */
  async function store(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((done, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => done(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  /** Every stored pack: `{ id, title, author, version, on, text }`. */
  async function list() {
    const rows = /** @type {any[]} */ ((await store('readonly', (s) => s.getAll())) || []);
    const on = onIds();
    return rows.map((r) => ({ ...r, on: on.includes(r.id) })).sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Import a pack from a file's text: checked against the official world with the packs now on, then
   * stored (off until turned on). Nothing is run.
   * @returns {Promise<{ ok: boolean, errors: string[], id?: string }>}
   */
  async function importText(text, file = 'pack.json') {
    const { pack, errors } = parse(text, { file, present: active.map((p) => p.id) });
    if (!pack) return { ok: false, errors };
    const m = pack.manifest;
    if (m.kind === 'world') return { ok: false, errors: [`${file}: this is a whole world, not a pack to add to one`] };
    try {
      await store('readwrite', (s) => s.put({ id: m.id, title: m.title, author: m.author, version: m.version, text }));
    } catch (e) {
      return { ok: false, errors: [`${file}: could not be kept in this browser (${String(e.message || e)})`] };
    }
    return { ok: true, errors: [], id: m.id };
  }

  /** Turn a stored pack on or off (from the next new game or reload). */
  function setOn(id, on) {
    const ids = onIds().filter((x) => x !== id);
    if (on) ids.push(id);
    setOnIds(ids);
  }

  /** Delete a stored pack (and turn it off). */
  async function remove(id) {
    setOn(id, false);
    await store('readwrite', (s) => s.delete(id));
  }

  /**
   * At boot, before the content is read: apply the packs turned on, in the order they were turned on.
   * With none on, nothing waits. A pack that is gone or no longer passes is left out, and said so.
   */
  async function boot() {
    const ids = onIds();
    if (!ids.length) return [];
    let rows = [];
    try {
      rows = await list();
    } catch (e) {
      bootErrors.push(`The packs could not be read from this browser (${String(e.message || e)}).`);
      return bootErrors;
    }
    const packs = [];
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      if (!row) {
        bootErrors.push(`The pack ${id} is turned on but no longer kept in this browser.`);
        continue;
      }
      try {
        packs.push(JSON.parse(row.text));
      } catch {
        bootErrors.push(`The pack ${id} could not be read.`);
      }
    }
    bootErrors.push(...use(packs));
    return bootErrors;
  }

  CL.packs = { LIMIT, ON_KEY, official, resolve, satisfies, check, checkWorld, apply, parse, worldContent, use, applied, forSave, missing, sanitize, onIds, list, importText, setOn, remove, boot, problems: () => bootErrors.slice() };
})(typeof window !== 'undefined' ? window : globalThis);
