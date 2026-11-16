/* Crownless seeded randomness and auto-resolve (GDD §7).
 *
 *   Power = Σ(Count × TierPower × HealthFactor) × (1 + 0.03 × LeaderTactics)
 *   TierPower = { T1: 1, T2: 1.7, T3: 2.5 }
 *   WinChance(A) = clamp(PowerA / (PowerA + PowerB), 0.1, 0.9)
 *
 * The winner always takes losses (no guaranteed zero-casualty victories): each of its troops falls
 * with a chance that grows as the fight gets closer. Rolls come from the campaign's seeded RNG
 * (CL.campaign.rngSeed) so outcomes are reproducible from a save. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TIER_POWER = { T1: 1, T2: 1.7, T3: 2.5 };
  // The hero is worth far more than one soldier in a real battle (a fresh hero alone reliably beats
  // seven looters), so their auto-resolve power comes from their actual stats: HP × damage relative
  // to a T1 soldier (45 HP × 7 damage), ×1.5 with a shield. A new Farmhand ≈ 7.5; grows with
  // levels and gear. Deliberately below the hero's real-battle worth so playing it out still pays.
  const T1_BASELINE = 45 * 7;
  const SHIELD_FACTOR = 1.5;
  const TACTICS = 0.03;
  const WIN_CLAMP = [0.1, 0.9];
  // Winner's per-troop chance to fall: 0.35 × (loser power / winner power), within these bounds.
  const WINNER_LOSS = { scale: 0.35, min: 0.08, max: 0.6 };
  // Loser's per-troop chance to fall (for a beaten player party; NPC losers are wiped out).
  const LOSER_LOSS = { scale: 0.6, min: 0.4, max: 0.9 };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // ---- Seeded RNG (mulberry32), state kept in the campaign so it is saved ----

  function next(c = CL.campaign) {
    c.rngSeed = (c.rngSeed + 0x6d2b79f5) >>> 0;
    let t = c.rngSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const int = (c, lo, hi) => lo + Math.floor(next(c) * (hi - lo + 1));
  // New-campaign seed from the clock (not Math.random, so other rolls are untouched).
  const newSeed = () => (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;

  // ---- Power ----

  /** Power of a troop table { troopId: count }. */
  function troopsPower(troops) {
    let p = 0;
    for (const [id, n] of Object.entries(troops)) p += n * TIER_POWER[CL.content.troop(id).tier];
    return p;
  }

  function heroPower(c = CL.campaign) {
    const h = CL.character.heroCombat(c);
    return ((h.hp * h.damage) / T1_BASELINE) * (h.canBlock ? SHIELD_FACTOR : 1);
  }

  /** The player's fighting power: healthy soldiers plus the hero, boosted by Tactics. */
  function playerPower(c = CL.campaign) {
    let p = heroPower(c);
    for (const s of c.roster) if (s.woundedUntil === null) p += TIER_POWER[CL.content.troop(s.troop).tier];
    return p * (1 + TACTICS * CL.character.skill('tactics', c));
  }

  const winChance = (pa, pb) => clamp(pa / (pa + pb), WIN_CLAMP[0], WIN_CLAMP[1]);

  const lossChance = (spec, ownPower, otherPower) => clamp(spec.scale * (otherPower / ownPower), spec.min, spec.max);

  /**
   * Roll which of `units` fall. `units` is a list of anything; at least one falls when `atLeastOne`
   * (the winner of a real fight is never untouched).
   */
  function rollFallen(c, units, chance, atLeastOne) {
    const fallen = units.filter(() => next(c) < chance);
    if (atLeastOne && units.length && !fallen.length) fallen.push(units[Math.floor(next(c) * units.length)]);
    return fallen;
  }

  /** Expand { id: n } into ['id', 'id', …] and back. */
  const expand = (troops) => Object.entries(troops).flatMap(([id, n]) => Array(n).fill(id));
  function collapse(list) {
    const out = {};
    for (const id of list) out[id] = (out[id] || 0) + 1;
    return out;
  }

  /** Remove `fallen` (a list of troop ids) from a troop table, in place. */
  function removeTroops(troops, fallen) {
    for (const id of fallen) {
      troops[id] -= 1;
      if (troops[id] <= 0) delete troops[id];
    }
  }

  /** Off-screen fight between two NPC parties. Loser is destroyed; winner suffers attrition. */
  function resolveParties(c, a, b) {
    const pa = troopsPower(a.troops);
    const pb = troopsPower(b.troops);
    const aWins = next(c) < winChance(pa, pb);
    const [winner, loser] = aWins ? [a, b] : [b, a];
    const [pw, pl] = aWins ? [pa, pb] : [pb, pa];
    const fallen = rollFallen(c, expand(winner.troops), lossChance(WINNER_LOSS, pw, pl), true);
    removeTroops(winner.troops, fallen);
    return { winner, loser, winnerLosses: fallen.length };
  }

  CL.autoresolve = {
    TIER_POWER,
    heroPower,
    WINNER_LOSS,
    LOSER_LOSS,
    next,
    int,
    newSeed,
    troopsPower,
    playerPower,
    winChance,
    lossChance,
    rollFallen,
    expand,
    collapse,
    removeTroops,
    resolveParties,
  };
})(typeof window !== 'undefined' ? window : globalThis);
