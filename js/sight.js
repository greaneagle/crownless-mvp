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
 * Story bands and the caravan you escort are always shown, so nothing a quest needs is ever lost.
 *
 * P10-08: sight that grows (the world's `sight` numbers, data/world_map.js). The company sees
 * `base` map units, times the scout follower's 1.5 (js/scout.js), and further by each point of
 * Pathfinding, with Mara riding along (a scout) and on a horse. Its other eyes: each fort or town
 * you hold watches its own circle, and each of your patrols out on the map (js/detachments.js) its
 * own. Night, high ground and forest scale every one of them as above. The map draws what none of
 * them reaches a little darker (js/render.js, unless reduced effects). */
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

  /** P10-08: the world's sight numbers, over the defaults. */
  const DEFAULTS = { base: PLAYER_SIGHT, pathfinding: 0.04, companion: 0.15, horse: 0.1, holdings: { fort: 10, town: 8 }, detachment: 8 };
  const rules = () => ({ ...DEFAULTS, ...(CL.world.map().sight || {}) });

  /**
   * How far the company sees in the open, by day, on flat ground: the base, the scout follower,
   * Pathfinding, Mara and a horse (P10-08). @param {Campaign} c
   */
  function companyRange(c) {
    const R = rules();
    let r = R.base * (CL.scout?.sightFactor(c) ?? 1); // a scout sees further (P7-02)
    r *= 1 + R.pathfinding * (CL.character?.skill('pathfinding', c) || 0);
    if (CL.companion?.has(c, 'mara')) r *= 1 + R.companion; // a scout of the old empire
    if (c.equipment?.horse) r *= 1 + R.horse; // a view from the saddle
    return r;
  }

  /** How far the company sees a party from where it stands. @param {Campaign} c */
  const playerRange = (c, p, day = c.day) => companyRange(c) * factor(day, c.world, p);

  /**
   * Everything that watches for you (P10-08), as circles { x, y, r, kind } before night and ground:
   * the company, each fort or town you hold, each of your patrols on the map. @param {Campaign} c
   */
  function sources(c) {
    const R = rules();
    const out = [{ x: c.world.x, y: c.world.y, r: companyRange(c), kind: 'company' }];
    const S = CL.content.table('settlements');
    for (const [sid, h] of Object.entries(c.holdings || {})) {
      const r = R.holdings?.[h.kind];
      if (r && h.holder === CL.realm?.PLAYER && S[sid]) out.push({ x: S[sid].mapX, y: S[sid].mapY, r, kind: 'holding' });
    }
    if (R.detachment) for (const p of c.parties || []) if (p.detachment != null) out.push({ x: p.x, y: p.y, r: R.detachment, kind: 'patrol' });
    return out;
  }

  /** Does the company see this party? Story bands and an escorted caravan always show. @param {Campaign} c */
  function playerSees(c, p, day = c.day) {
    if (p.questTag || p.escortTo || p.detachment != null || !options.rules) return true; // your own patrols always show (P7-05)
    return sources(c).some((s) => CL.world.mapDist(s.x, s.y, p.x, p.y) <= s.r * factor(day, s, p));
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

  CL.sight = { options, PLAYER_SIGHT, rules, companyRange, sources, NIGHT, HIGH_GROUND, FOREST, HIDDEN, SIZE, MEMORY_DAYS, hourOf, isNight, factor, canHide, hidden, setHidden, visibility, partyRange, partySees, playerRange, playerSees, look, shown };
})(typeof window !== 'undefined' ? window : globalThis);
