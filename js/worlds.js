/* Crownless worlds (P9-08, design §23.1): the official worlds this build ships with, and the one this
 * game plays.
 *
 * The first world of data/*.js (the Sundered Realm) is the built-in one. Others are world packages
 * in data/worlds/*.js (`CROWNLESS_WORLDS`), in the world format (docs/WORLD-FORMAT.md): each gives the
 * tables it replaces whole, and `merge` changes fields of the shared tables it leaves as they are.
 *
 * One world is played (P10-02): the built-in one. `use` puts another world package in its place (the
 * tests and scripts do, as `loadGame({ world })`); the game itself no longer offers a choice (P11-02
 * removed the retired "Which world?" chooser and its kept choice, `crownless_world`). A save records its
 * world (`worldId`, js/save.js): one of another world is kept untouched.
 */
(function (root) {
  'use strict';
  const CL = root.Crownless;

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

  const name = (id) => installed().find((w) => w.id === id)?.name || id;

  /** The retired chooser's kept choices (P9-08 to P10-02), cleared from a browser that still has them. */
  function forget() {
    try {
      root.localStorage?.removeItem('crownless_world');
      root.sessionStorage?.removeItem('crownless_world_new');
    } catch {
      // no storage: nothing kept
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

  CL.worlds = { BUILTIN, installed, known, name, current, use, forget, package: (id) => packages()[id] || null };
})(typeof window !== 'undefined' ? window : globalThis);
