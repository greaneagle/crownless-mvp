// @ts-check
/* Crownless sight on the world map (P7-04): who can see whom.
 *
 * A party sees as far as its template's `detection` (map units, gameplay distance); the company sees
 * PLAYER_SIGHT. Both are scaled by the moment and the ground, never rolled:
 *   night (20:00–05:00)                 × NIGHT        everyone sees less in the dark
 *   the watcher on hills or mountains   × HIGH_GROUND  a view from above
 *   the watched in a forest             × FOREST       trees hide
 * and, for parties looking for the company, by how easy the company is to spot:
 *   its size                            × 0.7 (alone) up to × 1.3 (twenty), a long column shows
 *   the Hide stance (in a forest, standing still)  × HIDDEN
 * A sighting is remembered: parties chase where they last saw you, then search there (js/parties.js);
 * the map shows the parties the company sees and a faded mark where it last saw the rest (js/render.js).
 * Story bands and the caravan you escort are always shown, so nothing a quest needs is ever lost. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PLAYER_SIGHT = 12; // map units
  const NIGHT = { from: 20, to: 5, factor: 0.6 };
  const HIGH_GROUND = 1.3;
  const FOREST = 0.6;
  const HIDDEN = 0.4;
  const SIZE = { alone: 0.7, perSoldier: 0.03, max: 1.3 };
  const MEMORY_DAYS = 1; // how long the map keeps a faded mark where a party was last seen
  /** For tests of other systems: `rules: false` is sight as before 2.14 (a party sees as far as its
   * detection; the company sees everything). */
  const options = { rules: true };

  /** The hour of the campaign day (0–24). @param {number} day */
  const hourOf = (day) => (((day % 1) + 1) % 1) * 24;
  /** Is it night? @param {number} day */
  const isNight = (day) => {
    const h = hourOf(day);
    return h >= NIGHT.from || h < NIGHT.to;
  };

  const terrain = (x, y) => CL.world.terrainAt(x, y);
  const high = (x, y) => ['hills', 'mountain'].includes(terrain(x, y));
  const inForest = (x, y) => terrain(x, y) === 'forest';

  /** The scale on a watcher's sight from the moment and the ground. */
  function factor(day, from, to) {
    let f = 1;
    if (isNight(day)) f *= NIGHT.factor;
    if (high(from.x, from.y)) f *= HIGH_GROUND;
    if (inForest(to.x, to.y)) f *= FOREST;
    return f;
  }

  /** Can the company hide here (a forest, not travelling)? @param {Campaign} c */
  const canHide = (c) => !c.world.location && inForest(c.world.x, c.world.y) && !CL.game?.travel;

  /** Is the company hidden right now? @param {Campaign} c */
  const hidden = (c) => Boolean(c.world.hidden) && canHide(c);

  /** Take or break the Hide stance. Returns whether hidden now. @param {Campaign} c */
  function setHidden(c, on) {
    if (on && canHide(c)) c.world.hidden = true;
    else delete c.world.hidden; // only kept while true, so older saves read back unchanged
    return Boolean(c.world.hidden);
  }

  /** How easy the company is to spot: its size, and the Hide stance. @param {Campaign} c */
  function visibility(c) {
    const people = c.roster.length + (CL.companion?.slots(c) || 0);
    const size = Math.min(SIZE.max, SIZE.alone + SIZE.perSoldier * people);
    return size * (hidden(c) ? HIDDEN : 1);
  }

  /** How far a party can see the company from where it is now. @param {Campaign} c */
  function partyRange(c, p, day = c.day) {
    const t = CL.content.get('party_templates', p.template);
    return options.rules ? t.detection * factor(day, p, c.world) * visibility(c) : t.detection;
  }

  /** Does a party see the company? @param {Campaign} c */
  const partySees = (c, p, day = c.day) => CL.world.mapDist(p.x, p.y, c.world.x, c.world.y) <= partyRange(c, p, day);

  /** How far the company sees a party from where it stands. @param {Campaign} c */
  const playerRange = (c, p, day = c.day) => PLAYER_SIGHT * (CL.scout?.sightFactor(c) ?? 1) * factor(day, c.world, p); // a scout sees further (P7-02)

  /** Does the company see this party? Story bands and an escorted caravan always show. @param {Campaign} c */
  function playerSees(c, p, day = c.day) {
    if (p.questTag || p.escortTo || p.detachment != null || !options.rules) return true; // your own patrols always show (P7-05)
    return CL.world.mapDist(c.world.x, c.world.y, p.x, p.y) <= playerRange(c, p, day);
  }

  /** Note what the company sees now: each party's last-seen spot (saved with the party). @param {Campaign} c */
  function look(c, day = c.day) {
    for (const p of c.parties || []) if (playerSees(c, p, day)) p.seenAt = { x: p.x, y: p.y, day };
  }

  /**
   * What the map may show of a party: { x, y, live } where the company sees it now, or a faded mark
   * where it was last seen (a contract target's is kept however old), or null. @param {Campaign} c
   */
  function shown(c, p, day = c.day) {
    if (playerSees(c, p, day)) return { x: p.x, y: p.y, live: true };
    const s = p.seenAt;
    if (!s) return null;
    if (p.contractId || day - s.day <= MEMORY_DAYS) return { x: s.x, y: s.y, live: false };
    return null;
  }

  CL.sight = { options, PLAYER_SIGHT, NIGHT, HIGH_GROUND, FOREST, HIDDEN, SIZE, MEMORY_DAYS, hourOf, isNight, factor, canHide, hidden, setHidden, visibility, partyRange, partySees, playerRange, playerSees, look, shown };
})(typeof window !== 'undefined' ? window : globalThis);
