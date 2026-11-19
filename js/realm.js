/* Crownless realm: faction reputation and fort ownership (GDD §10 Reputation, §12 Territory).
 *
 * Reputation: one hidden score per kingdom in [-100, 100], shown as Friendly / Neutral / Hostile
 * (hostile below -25, friendly above +24). Helping a faction +10, attacking its patrols or
 * caravans -15, major story decisions ±25. The Road Reavers are not a diplomatic faction.
 *
 * Territory: the two forts carry owner IDs in the campaign (`c.owners`); every other settlement
 * keeps the owner in its content data. A story event (Q4, later) or the debug panel can move a
 * fort to the other kingdom; recruits, garrison, patrols and the map follow the owner.
 *
 * Relations (W-07): every pair of kingdoms is at 'peace', in 'tension' or at 'war' (`c.relations`,
 * keyed "a|b" with the ids in order: { state, since, heat, losses, lastClash, incidentUntil }).
 * Patrols of kingdoms at peace that meet may cause a border incident, which can sour it to tension;
 * in tension or at war their patrols clash (js/parties.js), each clash heating tension towards war;
 * quiet days cool tension back to peace, and a long or costly war ends in an exhausted truce. The
 * world's data sets the starting states; a pair marked `story` keeps its state until the story's
 * ending, which sets it (decision D-W5: the March pair stays in tension until Q4 ends). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const REP = { min: -100, max: 100, hostileBelow: -25, friendlyAbove: 24, help: 10, bandits: 2, attack: -15, story: 25 };
  const FRIENDLY_CAP_BONUS = 2; // GDD §5 party cap: faction_bonus 0 or 2 for Friendly status
  const STANDING_LABEL = { friendly: 'Friendly', neutral: 'Neutral', hostile: 'Hostile' };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const settlement = (id) => CL.content.get('settlements', id);
  /** This world's kingdoms (W-04: the world package's `factions`, in order). */
  const kingdoms = () => (CL.world.map().factions || []).map((id) => CL.content.get('factions', id));
  /** The faction of road bands and sell-swords (the world's `outlaws`): never a kingdom. */
  const outlaws = () => CL.world.map().outlaws;
  const isKingdom = (id) => kingdoms().some((f) => f.id === id);
  const forts = () => Object.values(CL.content.table('settlements')).filter((s) => s.type === 'fort');

  const STATES = ['peace', 'tension', 'war'];
  // Days and counts for the relations rules (W-07).
  const RELATIONS = {
    incidentChance: 0.25, // a meeting of patrols at peace sours it to tension
    incidentEvery: 1, // days between incidents a pair can have
    warHeat: 4, // clashes in tension that tip it into war
    coolDays: 8, // quiet days that take one clash off the heat
    calmDays: 30, // a quiet tension this long, with no heat, eases to peace
    minWar: 12, // a war lasts at least this many days…
    exhaustion: 12, // …and ends once this many soldiers have fallen in its clashes
    maxWar: 45, // or after this long, whatever the losses
  };
  function defaultReputation() {
    const r = {};
    for (const f of kingdoms()) r[f.id] = clamp(f.initialReputation || 0, REP.min, REP.max);
    return r;
  }

  function defaultOwners() {
    const o = {};
    for (const s of forts()) o[s.id] = s.ownerFaction;
    return o;
  }

  // ---- Reputation ----

  const score = (c, f) => c.reputation?.[f] ?? 0;

  /** 'friendly' | 'neutral' | 'hostile'; null for the Road Reavers (always hostile, never diplomatic). */
  function standing(c, f) {
    if (!isKingdom(f)) return null;
    const s = score(c, f);
    if (s < REP.hostileBelow) return 'hostile';
    if (s > REP.friendlyAbove) return 'friendly';
    return 'neutral';
  }

  const isHostile = (c, f) => standing(c, f) === 'hostile';

  /** Change a kingdom's opinion of the player. Announces a change of standing. Returns the new score. */
  function adjust(c, f, delta, reason = '') {
    if (!isKingdom(f) || !delta) return score(c, f);
    const before = standing(c, f);
    c.reputation[f] = clamp(score(c, f) + delta, REP.min, REP.max);
    const after = standing(c, f);
    const name = CL.content.get('factions', f).name;
    CL.diag.log('info', 'Reputation', { faction: f, delta, score: c.reputation[f], reason });
    if (after !== before) {
      const text = {
        friendly: `The ${name} now count you a friend.`,
        neutral: `The ${name} regard you as neutral again.`,
        hostile: `The ${name} now treat you as an enemy!`,
      }[after];
      CL.ui.message(text);
    }
    return c.reputation[f];
  }

  /** GDD §5: +2 party slots while Friendly with any kingdom. */
  const capBonus = (c) => (kingdoms().some((f) => standing(c, f.id) === 'friendly') ? FRIENDLY_CAP_BONUS : 0);

  // ---- Territory ----

  /** Who holds a settlement now: the campaign's fort owners, else the content owner. */
  function owner(sid, c = CL.campaign) {
    return c?.owners?.[sid] || settlement(sid).ownerFaction;
  }

  /** Move a fort to another kingdom (story or world event). Returns true when it changed hands. */
  function setOwner(c, sid, f, reason = '') {
    const s = settlement(sid);
    if (s.type !== 'fort' || !isKingdom(f) || owner(sid, c) === f) return false;
    const from = owner(sid, c);
    c.owners[sid] = f;
    CL.diag.log('info', 'Fort changed hands', { fort: sid, from, to: f, reason });
    CL.ui.message(`${s.name} now flies the banner of the ${CL.content.get('factions', f).name}.`);
    CL.news?.record(c, 'fort_taken', { fort: sid, owner: f, place: sid });
    return true;
  }

  /** A fort's garrison: its own when held by the original owner, else the holder's standard garrison. */
  function garrison(sid, c = CL.campaign) {
    const s = settlement(sid);
    if (!s.garrison) return null;
    const f = owner(sid, c);
    return f === s.ownerFaction ? s.garrison : CL.content.get('factions', f).garrison || s.garrison;
  }

  /** Settlements a kingdom holds now. */
  function holdings(c, f) {
    return Object.values(CL.content.table('settlements')).filter((s) => owner(s.id, c) === f);
  }

  /** Will this settlement deal with the player? Hostile owners bar recruiting and contracts. */
  const welcomes = (c, sid) => !isHostile(c, owner(sid, c));

  /**
   * GDD §10 "helping a faction": a won fight against Road Reavers helps whoever holds the nearest
   * settlement (+2); finished contracts help the giver's owner (+10, in contracts.js).
   */
  function onBanditsBeaten(c) {
    const w = c.world;
    let best = null;
    for (const s of Object.values(CL.content.table('settlements'))) {
      const d = CL.world.mapDist(w.x, w.y, s.mapX, s.mapY);
      if (!best || d < best.d) best = { s, d };
    }
    if (best) adjust(c, owner(best.s.id, c), REP.bandits, 'bandits beaten');
  }

  // ---- Relations between kingdoms (W-07) ----

  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  /** The world's starting relations (data/world_map.js `relations`), or peace. */
  const worldPair = (a, b) => (CL.world.map().relations || []).find((r) => pairKey(...r.between) === pairKey(a, b)) || null;

  function blankRelation(a, b, day = 0) {
    return { state: worldPair(a, b)?.state || 'peace', since: day, heat: 0, losses: 0, lastClash: null, incidentUntil: 0 };
  }

  function defaultRelations(day = 0) {
    const r = {};
    const ks = kingdoms().map((f) => f.id);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) r[pairKey(ks[i], ks[j])] = blankRelation(ks[i], ks[j], day);
    return r;
  }

  function record(c, a, b) {
    if (!c.relations) c.relations = defaultRelations(c.day);
    const k = pairKey(a, b);
    if (!c.relations[k]) c.relations[k] = blankRelation(a, b, c.day);
    return c.relations[k];
  }

  /** 'peace' | 'tension' | 'war' between two kingdoms (null if either isn't one, or they are one). */
  function relation(c, a, b) {
    if (a === b || !isKingdom(a) || !isKingdom(b)) return null;
    return record(c, a, b).state;
  }

  /** Do their patrols fight? At war or in tension. */
  const atOdds = (c, a, b) => ['war', 'tension'].includes(relation(c, a, b));

  /** A pair the story holds still until its ending (D-W5). */
  const storyHeld = (c, a, b) => Boolean(worldPair(a, b)?.story) && !CL.story?.state(c).flags.ending;

  const NEWS = { war: 'war_declared', tension: 'tension_rising', peace: 'peace_made' };

  /** Set two kingdoms' relation, with a news line (`at`: where it happened, for the news). */
  function setRelation(c, a, b, state, reason = '', at = null, day = c.day) {
    if (!STATES.includes(state) || relation(c, a, b) === null) return false;
    const r = record(c, a, b);
    if (r.state === state) return false;
    const from = r.state;
    Object.assign(r, { state, since: day, heat: 0, losses: 0 });
    CL.diag.log('info', 'Relations', { a, b, from, to: state, reason });
    const kind = from === 'war' && state === 'tension' ? 'truce' : NEWS[state];
    CL.news?.record(c, kind, { ...(at || {}), faction: a, other: b }, day);
    return true;
  }

  /** Patrols of two kingdoms at peace met (js/parties.js): a border incident may sour it. */
  function incident(c, a, b, at, day = c.day) {
    if (relation(c, a, b) !== 'peace' || storyHeld(c, a, b)) return false;
    const r = record(c, a, b);
    if (day < r.incidentUntil) return false;
    r.incidentUntil = day + RELATIONS.incidentEvery;
    if (CL.autoresolve.next(c) >= RELATIONS.incidentChance) return false;
    return setRelation(c, a, b, 'tension', 'border incident', at, day);
  }

  /** Their patrols clashed (js/parties.js), and `lost` soldiers fell: tension heats, war wears out. */
  function clashed(c, a, b, lost, at, day = c.day) {
    if (!atOdds(c, a, b)) return;
    const r = record(c, a, b);
    r.heat++;
    r.lastClash = day;
    if (r.state === 'war') r.losses += lost;
    else if (r.heat >= RELATIONS.warHeat && !storyHeld(c, a, b)) setRelation(c, a, b, 'war', 'border clashes', at, day);
  }

  /** Time passing (CL.party.advanceDays): tension cools, wars wear themselves out. */
  function tickRelations(c, day = c.day) {
    for (const [k, r] of Object.entries(c.relations || {})) {
      const [a, b] = k.split('|');
      if (!isKingdom(a) || !isKingdom(b) || storyHeld(c, a, b)) continue;
      const quiet = day - (r.lastClash ?? r.since);
      if (r.state === 'tension') {
        if (r.heat > 0 && quiet >= RELATIONS.coolDays) {
          r.heat--;
          r.lastClash = day; // the next cooling counts from now
        } else if (r.heat === 0 && day - r.since >= RELATIONS.calmDays && quiet >= RELATIONS.calmDays) {
          setRelation(c, a, b, 'peace', 'quiet border', null, day);
        }
      } else if (r.state === 'war') {
        const long = day - r.since;
        if ((long >= RELATIONS.minWar && r.losses >= RELATIONS.exhaustion) || long >= RELATIONS.maxWar) setRelation(c, a, b, 'tension', 'exhaustion', null, day);
      }
    }
  }

  // ---- Save ----

  function sanitize(s, d) {
    s.reputation = defaultReputation();
    for (const f of kingdoms()) {
      const n = d?.reputation?.[f.id];
      if (typeof n === 'number' && Number.isFinite(n)) s.reputation[f.id] = clamp(Math.round(n), REP.min, REP.max);
    }
    s.owners = defaultOwners();
    for (const fort of forts()) {
      const f = d?.owners?.[fort.id];
      if (isKingdom(f)) s.owners[fort.id] = f;
    }
    // Relations (W-07, schema v10): every pair of this world's kingdoms, from the save where valid.
    s.relations = defaultRelations(s.day);
    const num = (n, fallback) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);
    for (const [k, r] of Object.entries(s.relations)) {
      const old = d?.relations?.[k];
      if (!old || typeof old !== 'object' || !STATES.includes(old.state)) continue;
      Object.assign(r, {
        state: old.state,
        since: num(old.since, r.since),
        heat: Math.max(0, Math.floor(num(old.heat, 0))),
        losses: Math.max(0, Math.floor(num(old.losses, 0))),
        lastClash: old.lastClash == null ? null : num(old.lastClash, null),
        incidentUntil: num(old.incidentUntil, 0),
      });
    }
  }

  CL.realm = {
    REP,
    FRIENDLY_CAP_BONUS,
    STANDING_LABEL,
    kingdoms,
    outlaws,
    isKingdom,
    forts,
    defaultReputation,
    defaultOwners,
    score,
    standing,
    isHostile,
    adjust,
    capBonus,
    owner,
    setOwner,
    garrison,
    holdings,
    welcomes,
    onBanditsBeaten,
    STATES,
    RELATIONS,
    pairKey,
    defaultRelations,
    relation,
    atOdds,
    storyHeld,
    setRelation,
    incident,
    clashed,
    tickRelations,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
