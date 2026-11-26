// @ts-check
/* Crownless retinue (P7-06): companions beyond the story's one (Mara, js/companion.js).
 *
 * Each (data/companions.js entries with `retinue: true`) lives in one land and joins after a small
 * errand of their own (data/quests.js, effect `{ retinue: id }`). With the company they take a party
 * slot, eat, fight beside the hero (like Mara: never killed in an ordinary battle, wounded instead), lend
 * one skill while fit, can captain a patrol (js/detachments.js), and draw a weekly wage.
 *
 * Loyalty, 0–100, from `loyalty.start`. It moves, never at random, with:
 *   pay           paid on payday +PAID; unpaid UNPAID
 *   battles       a victory with them in the company +WIN; a defeat LOSS
 *   their motive  `likes` / `dislikes` in their data: bandits_beaten, kingdom_attacked (you attacked a
 *                 kingdom's patrol or caravan), toll_paid, caravan_saved (an escort arrived), paid, unpaid
 * Below WARN_BELOW they warn you, saying why (once a day at most). Below LEAVE_BELOW, and only once they
 * have warned you on an earlier day, they leave, saying why: never without warning. Their gear stays with them (it was
 * theirs). They do not come back.
 * State: c.retinue (saved, schema v15): [{ id, woundedUntil, equipment, loyalty, unpaid, warned, why,
 * detached? }]; the story flag <id>_joined, and <id>_gone with the reason once they have left. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PAID = 2;
  const UNPAID = -12;
  const WIN = 1;
  const LOSS = -3;
  const WARN_BELOW = 35;
  const LEAVE_BELOW = 15;
  const EVENTS = ['bandits_beaten', 'kingdom_attacked', 'toll_paid', 'caravan_saved', 'paid', 'unpaid'];
  const REASONS = {
    bandits_beaten: 'you broke a band of Reavers',
    kingdom_attacked: 'you attacked a kingdom’s people',
    toll_paid: 'you paid Reavers to pass',
    caravan_saved: 'you brought a caravan through',
    paid: 'their wage came on time',
    unpaid: 'their wage did not come',
    win: 'a victory',
    loss: 'a defeat',
  };

  const def = (id) => {
    const d = CL.content.table('companions')[id];
    return d?.retinue ? d : null;
  };
  const list = (c) => (c.retinue ||= []);
  const find = (c, id) => list(c).find((m) => m.id === id) || null;
  /** With the company now: not leading a patrol. */
  const present = (c) => list(c).filter((m) => !m.detached);
  /** Fit to fight and to lend their skill. */
  const fit = (m) => m.woundedUntil === null && !m.detached;
  const name = (m) => def(m.id)?.name || m.id;

  /** Party slots they take (all of them, away on a patrol or not: they are still yours). */
  const slots = (c) => list(c).length;

  /** Can this one join now? null, or why not. @param {Campaign} c */
  function joinBlocked(c, id) {
    const d = def(id);
    if (!d) return 'no such companion';
    if (find(c, id)) return 'already with you';
    if (CL.story.state(c).flags[`${id}_gone`]) return 'gone for good';
    if (CL.party.headcount(c) + 1 > CL.party.partyCap(c)) return 'the company is full';
    return null;
  }

  /** Join the company. @param {Campaign} c */
  function join(c, id) {
    if (joinBlocked(c, id)) return false;
    const d = def(id);
    list(c).push({ id, woundedUntil: null, equipment: { ...d.startGear }, loyalty: d.loyalty?.start ?? 60, unpaid: 0, warned: false, why: null });
    CL.story.state(c).flags[`${id}_joined`] = true;
    CL.diag.log('info', 'Companion joined', { id });
    CL.ui.message(`${d.name} joins your company.`);
    return true;
  }

  /** Leave for good, saying why. Their gear goes with them. @param {Campaign} c */
  function leave(c, id, why) {
    const m = find(c, id);
    if (!m) return false;
    if (m.detached) CL.detachments?.loseCaptain(c, m.detached, name(m));
    list(c).splice(list(c).indexOf(m), 1);
    CL.story.state(c).flags[`${id}_gone`] = why;
    CL.diag.log('info', 'Companion left', { id, why });
    CL.ui.message(`${name(m)} has left the company: ${why}.`);
    return true;
  }

  // ---- Loyalty ----

  /** Move one companion's loyalty, with the reason; warn, or leave after a warning. */
  function nudge(c, m, delta, reason) {
    if (!delta) return;
    m.loyalty = Math.max(0, Math.min(100, m.loyalty + delta));
    if (delta < 0) m.why = reason;
    // They leave only once warned on an earlier day: you always have time to put things right.
    if (m.loyalty < LEAVE_BELOW && m.warned && m.warnedDay < Math.floor(c.day)) {
      leave(c, m.id, `${REASONS[reason] || reason}, after warning you`);
      return;
    }
    if (m.loyalty < WARN_BELOW && delta < 0 && m.warnedDay !== Math.floor(c.day)) {
      m.warned = true;
      m.warnedDay = Math.floor(c.day);
      CL.ui.message(`${name(m)} is unhappy: ${REASONS[reason] || reason}. ${m.loyalty < LEAVE_BELOW + 10 ? 'Much more of this and they will go.' : ''}`.trim());
    }
    if (m.loyalty >= WARN_BELOW + 10) m.warned = false; // back on good terms: a fresh warning before any leaving
  }

  /** Something happened that companions care about (one of EVENTS). @param {Campaign} c */
  function onEvent(c, event) {
    for (const m of [...list(c)]) {
      const l = def(m.id)?.loyalty || {};
      const delta = (l.likes?.[event] || 0) + (l.dislikes?.[event] || 0);
      nudge(c, m, delta, event);
    }
  }

  /**
   * After a battle (js/encounter.js): those who went down are wounded; a win or a loss moves the loyalty
   * of those with the company; and the foe's kind may touch their motive.
   * @param {Campaign} c @param {{ win: boolean, down: string[], foe: string | null, attacked: boolean }} o
   */
  function afterBattle(c, { win, down = [], foe = null, attacked = false }) {
    for (const m of present(c)) {
      if (!win || down.includes(m.id)) wound(c, m);
      nudge(c, m, win ? WIN : LOSS, win ? 'win' : 'loss');
    }
    if (win && foe === 'bandit') onEvent(c, 'bandits_beaten');
    if (attacked && (foe === 'patrol' || foe === 'caravan' || foe === 'lord')) onEvent(c, 'kingdom_attacked');
  }

  /** Payday (js/upkeep.js): their wages, from the chest then your purse; paid or not, it shows. */
  function payday(c) {
    for (const m of [...list(c)]) {
      const wage = def(m.id).wage || 0;
      if (!wage) continue;
      const paid = CL.accounts.pay(c, wage, `${name(m)}’s wage`);
      if (paid >= wage) {
        m.unpaid = 0;
        nudge(c, m, PAID, 'paid');
        onOne(c, m, 'paid');
      } else {
        m.unpaid++;
        nudge(c, m, UNPAID, 'unpaid');
        if (find(c, m.id)) onOne(c, m, 'unpaid');
      }
    }
  }

  /** One companion's motive about an event of their own (their pay). */
  function onOne(c, m, event) {
    const l = def(m.id)?.loyalty || {};
    nudge(c, m, (l.likes?.[event] || 0) + (l.dislikes?.[event] || 0), event);
  }

  /** A word for how they feel. */
  function mood(m) {
    if (m.loyalty >= 75) return 'loyal';
    if (m.loyalty >= WARN_BELOW + 10) return 'content';
    if (m.loyalty >= WARN_BELOW) return 'restless';
    return 'unhappy';
  }

  // ---- Battle, wounds, skills, strength ----

  function wound(c, m) {
    const d = def(m.id);
    m.woundedUntil = c.day + d.woundDays;
    CL.ui.message(`${d.name} is wounded and will rest for ${d.woundDays} days.`);
  }

  /** As the clock moves (js/party.js): back on their feet when their time is up. @param {Campaign} c */
  function heal(c) {
    for (const m of list(c)) if (m.woundedUntil !== null && m.woundedUntil <= c.day + 1e-9) m.woundedUntil = null;
  }

  /** Their battle numbers from their own stats and gear (as js/companion.js does for Mara). */
  function combat(m) {
    const p = CL.profile.resolve({ companion: def(m.id), equipment: m.equipment }); // P11-01: one profile
    return { hp: p.hp, maxhp: p.maxhp, damage: p.damage, armor: p.armor, speed: p.speed, reach: p.reach };
  }

  /** Auto-resolve strength of one (about a tier 3 soldier). */
  function powerOf(m) {
    const s = combat(m);
    return (s.hp * s.damage) / (45 * 7);
  }

  /** Strength of those fit and with the company. @param {Campaign} c */
  const power = (c) => present(c).filter(fit).reduce((n, m) => n + powerOf(m), 0);

  /** Skill points they lend the hero while fit and with the company. @param {Campaign} c */
  const skillBonus = (id, c) => present(c).filter(fit).reduce((n, m) => n + (def(m.id).skills?.[id] || 0), 0);

  /** Those who fight in the next battle: fit and with the company. @param {Campaign} c */
  const fighters = (c) => present(c).filter(fit);

  // ---- Saves ----

  /** Repair the retinue onto `s` (after the story flags and the companion). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.retinue = [];
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    for (const x of Array.isArray(d?.retinue) ? d.retinue : []) {
      const cd = def(x?.id);
      if (!cd || s.retinue.some((m) => m.id === cd.id) || s.story.flags[`${cd.id}_gone`]) continue;
      /** @type {Record<string, string | null>} */
      const equipment = {};
      for (const slot of cd.gearSlots) {
        const it = CL.content.table('items')[x.equipment?.[slot]];
        equipment[slot] = it && it.slot === slot ? it.id : null;
      }
      const w = x.woundedUntil;
      s.retinue.push({
        id: cd.id,
        woundedUntil: typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null,
        equipment,
        loyalty: Math.max(0, Math.min(100, Math.round(num(x.loyalty, cd.loyalty?.start ?? 60)))),
        unpaid: Math.max(0, Math.floor(num(x.unpaid, 0))),
        warned: x.warned === true,
        ...(x.warned === true && Number.isFinite(x.warnedDay) ? { warnedDay: Math.floor(x.warnedDay) } : {}),
        why: EVENTS.includes(x.why) || x.why === 'loss' ? x.why : null,
      });
    }
  }

  /** Content checks (from content.validate). */
  function validate(C, err) {
    for (const m of Object.values(C.companions || {})) {
      if (!m.retinue) continue;
      if (!C.settlements?.[m.home]) err(`companion ${m.id}: unknown home ${m.home}`);
      if (!(m.wage >= 0)) err(`companion ${m.id}: needs a wage`);
      if (!m.motive) err(`companion ${m.id}: needs a motive`);
      for (const k of ['likes', 'dislikes']) for (const e of Object.keys(m.loyalty?.[k] || {})) if (!EVENTS.includes(e)) err(`companion ${m.id}: unknown loyalty event ${e}`);
    }
  }

  CL.retinue = { PAID, UNPAID, WIN, LOSS, WARN_BELOW, LEAVE_BELOW, EVENTS, REASONS, def, list, find, present, fit, name, slots, joinBlocked, join, leave, onEvent, afterBattle, payday, mood, wound, heal, combat, powerOf, power, skillBonus, fighters, sanitize, validate };
})(typeof window !== 'undefined' ? window : globalThis);
