// @ts-check
/* Crownless soldier traits (P7-07): what a soldier's service has made of them.
 *
 * A soldier earns one trait, once, at a milestone of their own service record: never at random. The
 * first milestone they reach decides it (checked after each battle and each wound), and it never
 * changes. It is told as it happens, kept in their notes, shown on their card and on the roll of honour.
 *   Steadfast  8 battles   their group holds together: +COHESION to its cohesion for each steadfast
 *                          soldier standing in it (up to COHESION_MAX) (js/morale.js)
 *   Cautious   2 wounds    slower to engage (ENGAGE × 0.7), will not chase a runner far, and takes
 *                          less from each blow (× 0.8); in auto-resolve, less likely to fall
 *   Impulsive  8 kills     engages early (ENGAGE × 1.5), hits harder (× 1.15) and takes more (× 1.2);
 *                          in auto-resolve, a little stronger and more likely to fall
 * State: a soldier's optional `trait` (and the roll of honour entry's), repaired on load; no schema step,
 * as nobody had one before. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TRAITS = {
    steadfast: { id: 'steadfast', name: 'Steadfast', record: 'battles', at: 8, why: 'after 8 battles with the company', text: 'Holds the group together: steadier cohesion.', engage: 1, dealt: 1, taken: 1, pursue: true, power: 1.05, fall: 1 },
    cautious: { id: 'cautious', name: 'Cautious', record: 'wounds', at: 2, why: 'after a second wound', text: 'Slower to engage, does not chase runners, takes less from each blow.', engage: 0.7, dealt: 1, taken: 0.8, pursue: false, power: 0.95, fall: 0.75 },
    impulsive: { id: 'impulsive', name: 'Impulsive', record: 'kills', at: 8, why: 'after felling 8 enemies', text: 'Engages early and hits harder, but takes more wounds.', engage: 1.5, dealt: 1.15, taken: 1.2, pursue: true, power: 1.1, fall: 1.3 },
  };
  const ORDER = ['steadfast', 'cautious', 'impulsive']; // if two milestones fall in the same battle
  const COHESION = 6;
  const COHESION_MAX = 18;
  const PURSUE_RADIUS = 60; // px: a cautious soldier only strikes a runner this close

  const def = (id) => (typeof id === 'string' && Object.hasOwn(TRAITS, id) ? TRAITS[id] : null);
  const of = (x) => def(x?.trait);

  /**
   * Has this soldier reached a milestone? Gives the trait once, with a note and a message. Returns the
   * trait given, or null. @param {Campaign} c @param {Soldier} s
   */
  function check(c, s) {
    if (!s || s.trait) return null;
    const id = ORDER.find((k) => (s.record?.[TRAITS[k].record] || 0) >= TRAITS[k].at);
    if (!id) return null;
    const t = TRAITS[id];
    s.trait = id;
    CL.soldiers.note(s, { day: c.day, kind: 'trait', trait: id });
    CL.ui.message(`${s.name} has become ${t.name} ${t.why}.`);
    CL.diag.log('info', 'Trait earned', { soldier: s.id, trait: id });
    return id;
  }

  // ---- Battle ----

  /** A soldier's unit takes their trait. @param {Unit} u @param {Soldier | undefined} s */
  function apply(u, s) {
    if (def(s?.trait)) u.trait = s.trait;
    return u;
  }

  /** How far this unit reaches out to engage (× the order's distance). */
  const engage = (u) => of(u)?.engage ?? 1;
  /** A blow's damage, by the trait of who struck and who was struck. */
  const blow = (raw, source, target) => raw * (of(source)?.dealt ?? 1) * (of(target)?.taken ?? 1);
  /** Will this unit go after `target`? A cautious soldier lets a runner go unless it is close. */
  const pursues = (u, target) => !target?.routing || of(u)?.pursue !== false || Math.hypot(target.x - u.x, target.y - u.y) <= PURSUE_RADIUS;

  /** The steadfast bonus to a group's cohesion, from those of them standing. @param {any[]} up */
  const cohesion = (up) => Math.min(COHESION_MAX, up.filter((u) => u.trait === 'steadfast').length * COHESION);

  // ---- Auto-resolve ----

  /** A soldier's strength factor. @param {Soldier} s */
  const power = (s) => of(s)?.power ?? 1;
  /** How likely a soldier is to fall, against the company's rate. @param {Soldier | null | undefined} s */
  const fall = (s) => of(s)?.fall ?? 1;

  CL.traits = { TRAITS, ORDER, COHESION, COHESION_MAX, PURSUE_RADIUS, def, check, apply, engage, blow, pursues, cohesion, power, fall };
})(typeof window !== 'undefined' ? window : globalThis);
