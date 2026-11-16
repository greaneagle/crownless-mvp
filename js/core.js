/* Crownless core: namespace, constants, math helpers and diagnostics log.
 * Classic script — every module attaches to window.Crownless (CL). */
(function (root) {
  'use strict';
  root.Crownless = root.Crownless || {};
  const CL = root.Crownless;

  CL.BUILD = '0.3.0';
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
