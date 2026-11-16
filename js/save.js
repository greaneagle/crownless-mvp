/* Crownless save service (schema v1: aggregate troop counts in localStorage). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const MAX_VALUE = 99999;

  function starter() {
    return {
      version: 1,
      gold: 130,
      infantry: 3,
      archer: 2,
      woundedInfantry: 0,
      woundedArcher: 0,
      battles: 0,
      victories: 0,
      renown: 0,
    };
  }

  /** Merge a parsed save onto defaults; only finite non-negative numbers survive. */
  function sanitize(d) {
    if (d?.version !== 1) return null;
    const s = starter();
    for (const k of Object.keys(s)) {
      if (typeof d[k] === 'number' && Number.isFinite(d[k]) && d[k] >= 0) {
        s[k] = Math.min(MAX_VALUE, Math.floor(d[k]));
      }
    }
    return s;
  }

  function load() {
    try {
      const d = JSON.parse(root.localStorage.getItem(CL.SAVEKEY));
      const s = sanitize(d);
      if (s) return s;
    } catch (e) {
      CL.diag.log('warn', 'Cannot read save', { error: String(e) });
    }
    return starter();
  }

  function write() {
    try {
      root.localStorage.setItem(CL.SAVEKEY, JSON.stringify(CL.campaign));
      CL.diag.log('info', 'Campaign saved', { campaign: CL.campaign });
    } catch (e) {
      CL.diag.log('error', 'Save failed', { error: String(e) });
    }
  }

  CL.save = { starter, sanitize, load, write };
})(typeof window !== 'undefined' ? window : globalThis);
