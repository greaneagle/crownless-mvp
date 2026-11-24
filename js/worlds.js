/* Crownless worlds (P9-08, design §23.1): the official worlds this build ships with, and the one this
 * game plays.
 *
 * The first world of data/*.js (the Sundered Realm) is the built-in one. Others are world packages
 * in data/worlds/*.js (`CROWNLESS_WORLDS`), in the world format (docs/WORLD-FORMAT.md): each gives the
 * tables it replaces whole, and `merge` changes fields of the shared tables it leaves as they are.
 *
 * The world is chosen at a new game ("Which world?") and kept in localStorage (`crownless_world`). It is
 * put in place here, at load, before anything reads the content: choosing another world, or opening a
 * save of another world, reloads the page. A save records its world (`worldId`, js/save.js).
 */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const KEY = 'crownless_world';

  const raw = () => root.CROWNLESS_CONTENT || {};
  const packages = () => root.CROWNLESS_WORLDS || {};
  /** The built-in world: the first world of data/*.js. */
  const BUILTIN = Object.keys(raw().world_map || {})[0] || '';
  const BUILTIN_NAME = raw().world_map?.[BUILTIN]?.name || BUILTIN;

  /** Every world this build has: `{ id, name, sandbox }`, the built-in one first. */
  function installed() {
    const out = [{ id: BUILTIN, name: BUILTIN_NAME, sandbox: false }];
    for (const [id, w] of Object.entries(packages())) {
      const m = w?.world_map?.[id];
      if (m && id !== BUILTIN) out.push({ id, name: m.name || w.manifest?.title || id, sandbox: Boolean(m.sandbox) });
    }
    return out;
  }
  const known = (id) => installed().some((w) => w.id === id);

  function chosen() {
    try {
      const id = root.localStorage?.getItem(KEY);
      return id && known(id) ? id : BUILTIN;
    } catch {
      return BUILTIN;
    }
  }

  /** Keep `id` as the world to play from the next load. */
  function choose(id) {
    if (!known(id)) return false;
    try {
      if (id === BUILTIN) root.localStorage?.removeItem(KEY);
      else root.localStorage?.setItem(KEY, id);
      return true;
    } catch (e) {
      CL.diag?.log('warn', 'World choice not kept', { error: String(e) });
      return false;
    }
  }

  const name = (id) => installed().find((w) => w.id === id)?.name || id;

  // ---- In the browser: another world means a reload ----

  const NEW_KEY = 'crownless_world_new';
  /** Play `id` from now: kept, and the page reloads into it (with `newGame`, straight to the creator). */
  function switchTo(id, { newGame = false } = {}) {
    if (!choose(id)) return false;
    try {
      if (newGame) root.sessionStorage?.setItem(NEW_KEY, id);
    } catch {
      // no session storage: the title opens instead of the creator
    }
    CL.diag?.log('info', 'World chosen', { world: id, newGame });
    root.location?.reload();
    return true;
  }
  /** Was this load a new game in a world just chosen? (Read once.) */
  function takeNewGame() {
    try {
      const id = root.sessionStorage?.getItem(NEW_KEY);
      root.sessionStorage?.removeItem(NEW_KEY);
      return Boolean(id) && id === current();
    } catch {
      return false;
    }
  }

  /** The world now in play (its id). */
  const current = () => Object.keys(raw().world_map || {})[0] || BUILTIN;

  /** Put a world in place of the built-in one (at load; tests call it the same way). */
  function use(id) {
    if (id === current() || !packages()[id]) return false;
    const C = CL.content.compose(raw(), packages()[id]);
    const live = raw();
    for (const k of Object.keys(live)) if (!(k in C)) delete live[k];
    Object.assign(live, C);
    CL.diag?.log('info', 'World', { world: id });
    return true;
  }

  use(chosen());

  CL.worlds = { KEY, BUILTIN, installed, known, name, chosen, choose, current, use, switchTo, takeNewGame, package: (id) => packages()[id] || null };
})(typeof window !== 'undefined' ? window : globalThis);
