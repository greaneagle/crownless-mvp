/* Crownless seeded randomness and auto-resolve (GDD §7).
 *
 *   Power = Σ(Count × TierPower × HealthFactor) × (1 + 0.03 × LeaderTactics)
 *   (from 1.19.0, V2-T2: your company's soldiers count × 1.5 for fighting in ranks behind shields,
 *   as they do in a fought battle since 1.11.0; enemy bands don't)
 *   TierPower = { T1: 1, T2: 1.7, T3: 2.5 }
 *   WinChance(A) = clamp(PowerA² / (PowerA² + PowerB²), 0.1, 0.9)
 *   (from 2.11.0, B-01: powers squared, as Lanchester's law has it for a melee: in a fought battle the
 *   stronger side wins far more often than its share of the strength, and the odds now say so. Before,
 *   a company at 2.5 : 1 was told 71% and won every fight in person.)
 *
 * The winner always takes losses (no guaranteed zero-casualty victories): each of its troops falls
 * with a chance that grows as the fight gets closer. Rolls come from the campaign's seeded RNG
 * (CL.campaign.rngSeed) so outcomes are reproducible from a save. The other named streams
 * (casualties, loot, upkeep; V2-02) are here too: `roll(c, stream)`. */
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
  const ODDS_POWER = 2; // B-01: the square law
  // V2-T2: soldiers of the company count this much more (ranks, shields and cover: fought battles
  // since 1.11.0 are far kinder to a company than auto-resolve was, SC-37).
  const COMPANY_FACTOR = 1.5;
  // Winner's per-troop chance to fall: 0.25 × (loser power / winner power), within these bounds
  // (V2-T2: was 0.35, 8–60%; a won fight in person costs far less).
  const WINNER_LOSS = { scale: 0.2, min: 0.05, max: 0.5 };
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

  // ---- Named random streams (V2-02, design §24.8) ----
  // The world stream is `rngSeed` above: world parties, skirmishes, contract offers, auto-resolve
  // and retreat. Each other campaign roll has its own stream in `c.rng`, so one system's rolls
  // never reshuffle another's, and the same save replays the same outcomes:
  //   casualties  who dies and who is wounded after a fought battle (auto-resolve rolls all of its
  //               outcome, its casualties included, on the world stream, as before)
  //   loot        battle loot, and the item taken on capture
  //   upkeep      desertion
  //   names       soldiers' names (V2-03)
  // Moment-to-moment rolls inside a fought battle (aim, AI timing) stay unseeded: they depend on the
  // player's real-time input anyway. News and cosmetics never use any of these.
  /** @type {Array<keyof Campaign["rng"]>} */
  const STREAMS = ['casualties', 'loot', 'upkeep', 'names'];

  /** A stream's starting seed from the campaign seed and the stream's name (FNV-1a, then mixed). */
  function streamSeed(base, name) {
    let h = (0x811c9dc5 ^ base) >>> 0;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /** Every named stream's seed, derived from one campaign seed. */
  const streamSeeds = (base) => Object.fromEntries(STREAMS.map((s) => [s, streamSeed(base >>> 0, s)]));

  /** Next number in [0, 1) from a named stream (mulberry32; the state lives in c.rng, so it is saved). */
  function roll(c, stream) {
    if (!c.rng) c.rng = streamSeeds(c.rngSeed);
    if (!Number.isInteger(c.rng[stream])) c.rng[stream] = streamSeed(c.rngSeed, stream);
    c.rng[stream] = (c.rng[stream] + 0x6d2b79f5) >>> 0;
    let t = c.rng[stream];
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

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
    for (const s of c.roster) if (s.woundedUntil === null) p += TIER_POWER[CL.content.troop(s.troop).tier] * COMPANY_FACTOR * (CL.blacksmith?.powerFactor(s) ?? 1); // fine kit (P7-03)
    p += CL.companion?.power(c) || 0; // Mara, if she is fit
    return p * (1 + TACTICS * CL.character.skill('tactics', c));
  }

  /**
   * Why the odds are what they are (V2-07, "Simulate ... with reasons"): each side's strength, part by
   * part, in the same units as playerPower and troopsPower. Lines of plain text.
   */
  function explain(c, enemyTroops) {
    const own = [];
    own.push(`your hero ${heroPower(c).toFixed(1)}`);
    const fit = { T1: 0, T2: 0, T3: 0 };
    let wounded = 0;
    for (const s of c.roster) {
      if (s.woundedUntil !== null) wounded++;
      else fit[CL.content.troop(s.troop).tier]++;
    }
    for (const t of ['T1', 'T2', 'T3']) if (fit[t]) own.push(`${fit[t]} ${t} soldier${fit[t] === 1 ? '' : 's'} ${(fit[t] * TIER_POWER[t] * COMPANY_FACTOR).toFixed(1)}`);
    const mara = CL.companion?.power(c) || 0;
    if (mara) own.push(`your companion ${mara.toFixed(1)}`);
    const tactics = CL.character.skill('tactics', c);
    const pp = playerPower(c);
    const pe = troopsPower(enemyTroops);
    const foes = Object.entries(enemyTroops).map(([id, n]) => `${n} ${CL.content.troop(id).name}${n === 1 ? '' : 's'}`);
    const lines = [`Your side ${pp.toFixed(1)}: ${own.join(', ')}${tactics ? `, then +${Math.round(TACTICS * tactics * 100)}% for Tactics` : ''}. Soldiers count half as much again for fighting in ranks.`];
    if (wounded) lines.push(`${wounded} wounded soldier${wounded === 1 ? '' : 's'} sat it out.`);
    lines.push(`Their side ${pe.toFixed(1)}: ${foes.join(', ')}.`);
    lines.push(`Odds ${Math.round(winChance(pp, pe) * 100)}%: in a melee numbers count twice over, so the stronger side wins more often than its share of the strength (kept between 10% and 90%).`);
    return lines;
  }

  const winChance = (pa, pb) => {
    const [a, b] = [pa ** ODDS_POWER, pb ** ODDS_POWER];
    return clamp(a / Math.max(1e-9, a + b), WIN_CLAMP[0], WIN_CLAMP[1]);
  };

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
    COMPANY_FACTOR,
    heroPower,
    WINNER_LOSS,
    LOSER_LOSS,
    next,
    int,
    newSeed,
    STREAMS,
    streamSeed,
    streamSeeds,
    roll,
    troopsPower,
    playerPower,
    explain,
    winChance,
    ODDS_POWER,
    lossChance,
    rollFallen,
    expand,
    collapse,
    removeTroops,
    resolveParties,
  };
})(typeof window !== 'undefined' ? window : globalThis);
