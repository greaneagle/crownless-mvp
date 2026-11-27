// @ts-check
/* Crownless battle report (P11-15; plan Area 18): what happened in a fought battle, told after it.
 *
 * It only listens. Combat calls it at the moments that already happen (a blow lands or is blocked, a
 * guard staggers, the hero swings or looses, someone breaks and runs, braced spears stop a charge)
 * and it counts them in `g.report`. Nothing here changes a rule, a timing or a roll: the golden
 * battles (tests/golden-battles.test.js) hold it to that.
 *
 * The result screen shows one summary line (who won, the losses each side, how long), then "More":
 * each division's kills, losses and breaks; the hero's blows, blocks, staggers, shots and accuracy;
 * and the notable moments (a wall held against arrows, a charge broken by spears, a flank that routed
 * them). `read` turns the tally into those lines (plain text; js/party.js escapes them). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** A notable moment is said only when it happened at least this often. */
  const NOTABLE = { wallArrows: 5, braced: 1, flankRouts: 2 };
  /** A unit that breaks within this many seconds of a blow in its flank broke because of it. */
  const FLANK_WINDOW = 4;
  const ROLE_NAMES = { infantry: 'infantry', archer: 'archers', cavalry: 'cavalry' };

  const side = () => ({});
  /** A fresh tally for a battle. @param {any} g */
  function begin(g) {
    g.report = {
      hero: { swings: 0, landed: 0, blocks: 0, staggers: 0, shots: 0, shotHits: 0, felled: 0 },
      divs: { ally: side(), enemy: side() },
      wallArrows: { ally: 0, enemy: 0 },
      braced: { ally: 0, enemy: 0 },
      flankRouts: { ally: 0, enemy: 0 },
    };
  }

  /** The division a unit counts in: a soldier's division, an enemy's role; null for the hero, a companion or the wagon. */
  function divOf(u) {
    if (!u || u.role === 'hero' || u.companion || u.wagon || u.outside) return null;
    return u.team === 'enemy' ? u.role : u.div || u.role;
  }

  function line(g, u) {
    const d = divOf(u);
    if (!d || !g.report) return null;
    const s = g.report.divs[u.team === 'enemy' ? 'enemy' : 'ally'];
    s[d] ??= { kills: 0, losses: 0, broke: 0 };
    return s[d];
  }

  /**
   * A blow's outcome (combat.hit): 'hit', 'down', 'blocked' or null. @param {any} g @param {any} target
   * @param {any} source @param {string | null} result @param {boolean} shot
   */
  function onHit(g, target, source, result, shot) {
    const r = g?.report;
    if (!r || !result || target?.wagon) return;
    const landed = result === 'hit' || result === 'down';
    if (source?.role === 'hero') {
      if (shot && landed) r.hero.shotHits++;
      else if (!shot && landed) r.hero.landed++;
    }
    if (target.role === 'hero' && result === 'blocked') r.hero.blocks++;
    // A shot stopped by a shield of a formed wall (its own, or the one beside it).
    if (result === 'blocked' && shot && target.role !== 'hero' && CL.formations?.of(g, target) === 'wall') r.wallArrows[target.team === 'enemy' ? 'enemy' : 'ally']++;
    if (result === 'down') {
      const lost = line(g, target);
      if (lost) lost.losses++;
      if (source?.role === 'hero') r.hero.felled++;
      const won = source?.team !== target.team ? line(g, source) : null;
      if (won) won.kills++;
    }
  }

  /** The hero began a swing. @param {any} g @param {any} u */
  function onSwing(g, u) {
    if (g?.report && u?.role === 'hero') g.report.hero.swings++;
  }

  /** A shot was loosed. @param {any} g @param {any} u */
  function onShot(g, u) {
    if (g?.report && u?.role === 'hero') g.report.hero.shots++;
  }

  /** A guard staggered by a blow. @param {any} g @param {any} target @param {any} source */
  function onStagger(g, target, source) {
    if (g?.report && source?.role === 'hero' && target) g.report.hero.staggers++;
  }

  /** Someone broke and ran (js/morale.js). @param {any} g @param {any} u */
  function onRout(g, u) {
    const r = g?.report;
    if (!r) return;
    const s = line(g, u);
    if (s) s.broke++;
    const struck = Math.max(u.formFlankedAt ?? -99, u.flankedAt ?? -99);
    if (g.t - struck <= FLANK_WINDOW) r.flankRouts[u.team === 'enemy' ? 'enemy' : 'ally']++;
  }

  /** Braced spears (or a square) stopped a charging rider (js/groups.js). @param {any} g @param {any} by */
  function onBrace(g, by) {
    if (g?.report && by) g.report.braced[by.team === 'enemy' ? 'enemy' : 'ally']++;
  }

  // ---- In words ----

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  /** A battle's length: "45 s", "2 min 05 s". @param {number} t seconds */
  function duration(t) {
    const s = Math.max(0, Math.round(t || 0));
    if (s < 60) return `${s} s`;
    return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  }

  /**
   * The summary line: who won, the losses each side, the time.
   * @param {{ win: boolean, t: number, fallen: number, wounded: number, felled: number, fled: number }} o
   */
  function summary(o) {
    const ours = o.fallen + o.wounded;
    const mine = ours ? `You lost ${ours} (${[o.fallen ? `${o.fallen} fallen` : '', o.wounded ? `${o.wounded} wounded` : ''].filter(Boolean).join(', ')})` : 'You lost no one';
    const theirs = `they lost ${o.felled + o.fled}${o.fled ? ` (${o.fled} fled)` : ''}`;
    return `${o.win ? 'Victory' : 'Defeat'} in ${duration(o.t)}. ${mine}; ${theirs}.`;
  }

  /** The hero's part: "14 blows, 9 landed · 3 blocked · 2 staggered · 20 shots, 11 hit (55%)". @param {any} h */
  function heroLine(h) {
    if (!h) return null;
    const bits = [];
    if (h.swings) bits.push(`${plural(h.swings, 'blow')}, ${h.landed} landed`);
    else if (h.landed) bits.push(`${h.landed} landed`);
    if (h.felled) bits.push(`${h.felled} felled`);
    if (h.blocks) bits.push(`${h.blocks} blocked`);
    if (h.staggers) bits.push(`${h.staggers} staggered`);
    if (h.shots) bits.push(`${plural(h.shots, 'shot')}, ${h.shotHits} hit (${Math.round((h.shotHits / h.shots) * 100)}%)`);
    return `You: ${bits.length ? bits.join(' · ') : 'no blow struck'}`;
  }

  /** One division's line: "Infantry: 9 felled, 2 lost, 1 broke". @param {string} name @param {any} s */
  function divLine(name, s) {
    const bits = [`${s.kills} felled`, `${s.losses} lost`];
    if (s.broke) bits.push(`${s.broke} broke and ran`);
    return `${name}: ${bits.join(', ')}`;
  }

  /** The notable moments, in words. @param {any} r */
  function notable(r) {
    const out = [];
    if (r.wallArrows.ally >= NOTABLE.wallArrows) out.push(`Your shield wall held against ${r.wallArrows.ally} arrows.`);
    if (r.wallArrows.enemy >= NOTABLE.wallArrows) out.push(`Their shield wall took ${r.wallArrows.enemy} of your shots.`);
    if (r.braced.ally >= NOTABLE.braced) out.push(`Your spears stopped ${plural(r.braced.ally, 'charge')}.`);
    if (r.braced.enemy >= NOTABLE.braced) out.push(`Their spears stopped ${r.braced.enemy} of your charges.`);
    if (r.flankRouts.enemy >= NOTABLE.flankRouts) out.push(`Struck in the flank, ${r.flankRouts.enemy} of them broke and ran.`);
    if (r.flankRouts.ally >= NOTABLE.flankRouts) out.push(`${r.flankRouts.ally} of yours broke when struck in the flank.`);
    return out;
  }

  /**
   * The report of a fought battle: the summary line and More's parts (divisions, the hero, notable
   * moments). Null when nothing was counted (a practice battle, an old state).
   * @param {any} g @param {{ win: boolean, fallen: number, wounded: number }} o
   * @returns {{ summary: string, divisions: string[], hero: string | null, notable: string[] } | null}
   */
  function read(g, o) {
    const r = g?.report;
    if (!r) return null;
    const c = CL.campaign;
    const divisions = [];
    // Every division that took the field (in their order), even one that never struck a blow.
    const fielded = new Set([...(CL.divisions?.present?.(g) || []), ...Object.keys(r.divs.ally)]);
    const order = (CL.divisions?.SLOTS || [...fielded]).filter((d) => fielded.has(d));
    for (const d of order) divisions.push(divLine(CL.divisions?.name ? CL.divisions.name(c, d) : d, r.divs.ally[d] || { kills: 0, losses: 0, broke: 0 }));
    const foes = Object.entries(r.divs.enemy).map(([d, s]) => `${ROLE_NAMES[d] || d} ${s.losses} down${s.broke ? `, ${s.broke} broke` : ''}`);
    if (foes.length) divisions.push(`Theirs: ${foes.join(' · ')}`);
    return {
      summary: summary({ win: o.win, t: g.t, fallen: o.fallen, wounded: o.wounded, felled: (g.kills || 0) + (g.helpKills || 0), fled: g.routed || 0 }),
      divisions,
      hero: heroLine(r.hero),
      notable: notable(r),
    };
  }

  CL.report = { NOTABLE, FLANK_WINDOW, begin, divOf, onHit, onSwing, onShot, onStagger, onRout, onBrace, duration, summary, heroLine, divLine, notable, read };
})(typeof window !== 'undefined' ? window : globalThis);
