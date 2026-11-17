// @ts-check
/* Crownless storage layer (V2-01, design §24.7). Saves are read and written through CL.storage
 * instead of touching localStorage directly, so a store build can swap in another backend (IndexedDB,
 * a desktop app's files) without changing the save logic.
 *
 * The interface is synchronous, like localStorage. An asynchronous backend would load its keys into
 * memory at boot and write through behind that copy. Calls never throw: a failed read gives null and
 * a failed write or remove gives false, with the error kept in `lastError` and the diagnostics log.
 *
 * Device keys (settings, tips seen, export reminders, dev mode) still use localStorage directly;
 * they are not part of a save. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** @type {StorageBackend} The browser's localStorage, looked up on each call. */
  const browser = {
    name: 'localStorage',
    get: (key) => root.localStorage.getItem(key),
    set: (key, value) => root.localStorage.setItem(key, value),
    remove: (key) => root.localStorage.removeItem(key),
  };

  let backend = browser;

  /** @param {string} what @param {string} key @param {unknown} e */
  function failed(what, key, e) {
    CL.storage.lastError = String(e);
    CL.diag.log('warn', `Storage ${what} failed`, { key, backend: backend.name, error: String(e) });
  }

  /** @param {string} key @returns {string | null} */
  function get(key) {
    try {
      return backend.get(key);
    } catch (e) {
      failed('read', key, e);
      return null;
    }
  }

  /** @param {string} key @param {string} value @returns {boolean} true once the value is stored */
  function set(key, value) {
    try {
      backend.set(key, value);
      return true;
    } catch (e) {
      failed('write', key, e);
      return false;
    }
  }

  /** @param {string} key @returns {boolean} */
  function remove(key) {
    try {
      backend.remove(key);
      return true;
    } catch (e) {
      failed('remove', key, e);
      return false;
    }
  }

  /** Swap the backend (a store build, or a test). With no argument, go back to localStorage. */
  function use(next = browser) {
    backend = next;
    CL.diag.log('info', 'Storage backend', { backend: next.name });
  }

  CL.storage = {
    get,
    set,
    remove,
    use,
    backendName: () => backend.name,
    lastError: null,
  };
})(typeof window !== 'undefined' ? window : globalThis);
