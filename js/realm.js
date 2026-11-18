/* Crownless realm: faction reputation and fort ownership (GDD §10 Reputation, §12 Territory).
 *
 * Reputation: one hidden score per kingdom in [-100, 100], shown as Friendly / Neutral / Hostile
 * (hostile below -25, friendly above +24). Helping a faction +10, attacking its patrols or
 * caravans -15, major story decisions ±25. The Road Reavers are not a diplomatic faction.
 *
 * Territory: the two forts carry owner IDs in the campaign (`c.owners`); every other settlement
 * keeps the owner in its content data. A story event (Q4, later) or the debug panel can move a
 * fort to the other kingdom; recruits, garrison, patrols and the map follow the owner. */
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
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
