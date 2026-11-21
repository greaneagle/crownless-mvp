// @ts-check
/* Crownless core: namespace, constants, math helpers and diagnostics log.
 * Classic script — every module attaches to window.Crownless (CL). */
(function (root) {
  'use strict';
  root.Crownless = root.Crownless || /** @type {CrownlessNS} */ ({}); // filled in by every module below
  const CL = root.Crownless;

  CL.BUILD = '2.32.0';

  /**
   * Developer tools (the Logs and Debug buttons) show on a local dev server, and on any build when the
   * page is opened with ?dev (remembered on this device; ?dev=0 turns them off again). F3 always
   * opens the diagnostics panel, so players can still export a report.
   */
  CL.dev = (() => {
    const loc = root.location;
    if (!loc) return false;
    try {
      const q = new URLSearchParams(loc.search).get('dev');
      if (q !== null) root.localStorage.setItem('crownless_dev', q === '0' ? '0' : '1');
      const kept = root.localStorage.getItem('crownless_dev');
      if (kept !== null) return kept === '1';
    } catch {
      // storage blocked: fall back to the host check
    }
    return /^(localhost|127.0.0.1|[::1])$/.test(loc.hostname);
  })();
  CL.SAVEKEY = 'crownless_v03_party';
  CL.W = 960;
  CL.H = 540;

  CL.util = {
    rand: (a, b) => a + Math.random() * (b - a),
    clamp: (n, a, b) => Math.min(b, Math.max(a, n)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    normalize(x, y) {
      const l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    },
  };

  const MAX_EVENTS = 800;

  CL.diag = {
    events: [],
    errors: [],
    assets: { requested: 0, loaded: 0, failed: [] },
    fps: 0,
    frames: 0,
    simMs: 0,
    drawMs: 0,
    lastFps: performance.now(),
    started: new Date().toISOString(),
    log(level, msg, data) {
      const e = { date: new Date().toISOString(), level, msg, ...(data ? { data } : {}) };
      this.events.push(e);
      if (this.events.length > MAX_EVENTS) this.events.shift();
      if (level === 'error') console.error('[Crownless]', msg, data || '');
    },
  };

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('error', (e) =>
      CL.diag.log('error', e.message, {
        file: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack,
      }),
    );
    root.addEventListener('unhandledrejection', (e) =>
      CL.diag.log('error', 'Unhandled promise', { reason: String(e.reason) }),
    );
  }
})(typeof window !== 'undefined' ? window : globalThis);
