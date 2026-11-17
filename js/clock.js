// @ts-check
/* Crownless campaign clock (V2-04; design §5): the one authority for campaign time.
 *
 * There is one calendar, `c.day` (fractional days). It moves in two ways only, both through here:
 *   - on the map, continuously while travelling or waiting (js/world.js, at its hours-per-second rate);
 *   - by fixed, named amounts for things that happen off the map clock, set in the world data
 *     (data/world_map.js `time`, in game hours):
 *       battle   a battle and its aftermath, fought or auto-resolved, however long it took (owner
 *                decision 2026-11-17: a fixed amount of overworld time per battle). Replaces the old
 *                hidden flat charge inside the battle result.
 *       capture  held captive after a lost battle, before release
 *       rest     "Rest one day" in a settlement
 * Nothing else passes time: a battle's own seconds, pausing, the deployment and tip cards, menus,
 * towns and a hidden page all add nothing. A retreat is free.
 *
 * `advance` hands the hours to CL.party.advanceDays, which runs everything time drives (upkeep,
 * markets, world parties, contracts, wounds, story deadlines, news), and logs each fixed charge. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['battle', 'capture', 'rest'];
  const DEFAULTS = { battle: 4, capture: 12, rest: 24 };

  /** Hours a fixed event takes, from the world data. @param {string} kind one of KINDS @returns {number} */
  function hours(kind) {
    const h = CL.world.map().time?.[kind];
    return typeof h === 'number' && h >= 0 ? h : DEFAULTS[kind];
  }

  /**
   * Move the campaign clock on. `reason` is 'travel', 'wait', 'debug' or one of KINDS. Returns the
   * soldiers who recovered (from CL.party.advanceDays).
   * @param {Campaign} c @param {number} h game hours (≥ 0) @param {string} reason @returns {number[]}
   */
  function advance(c, h, reason) {
    if (!(h > 0)) return [];
    if (KINDS.includes(reason) || reason === 'debug') CL.diag.log('info', 'Time passes', { reason, hours: h, from: c.day });
    return CL.party.advanceDays(h / 24, c);
  }

  /** Charge one of the fixed events. @param {Campaign} c @param {string} kind @returns {number[]} */
  const pass = (c, kind) => advance(c, hours(kind), kind);

  CL.clock = { KINDS, DEFAULTS, hours, advance, pass };
})(typeof window !== 'undefined' ? window : globalThis);
