/* Crownless allegiance (P8-04, design §16, §22.5, §25.3): independent, a realm's mercenary, or its
 * sworn vassal; one at a time. `c.allegiance` = { kind, realm, since, until, serviceDays, summonsMissed,
 * history, window, lastOath, nextPay, served, hunt }.
 *
 * - **A mercenary contract** (Service, on a capital's notice board): Neutral standing or better; 30 days
 *   at a weekly pay by renown and company size, from the realm's purse (the ledger's `world`). You fight
 *   its enemies; attacking its own patrols, caravans or lords breaks the contract. Its patrols and lords
 *   take your side in a fight. Every day under contract is a day of service to that realm. It ends at
 *   its term (renewable at the capital) or on a breach.
 * - **A vassal's oath** (Swear fealty, from the ruler at the capital): Friendly standing, 150 renown, and
 *   20 days of mercenary service to that realm or the story's favour (your Q4 side). No pay; land may
 *   be granted (P8-05). Obligations: answer summons (P8-06a, P8-07), never fight the realm's people,
 *   and keep 10 days of service in every 30 (days fighting its enemies, at your fief, or at a summons).
 *   A 30-day window short of service counts as a missed summons.
 * - **Leaving:** ask for release (granted when you owe nothing and the realm is at peace; owing, it
 *   costs 15 standing; at war it is refused; a fief returns to the crown with no claim), defect (−40
 *   standing, the realm's lords hunt you for 10 days, a fief is lost with a `granted` claim kept), or be
 *   expelled (three summonses missed, a breach, or Hostile standing: as defection, without the hunt).
 *   Seven days between oaths.
 * - **The preview:** `preview(c, action, realm)` says what will change and what stays, in plain lines,
 *   before anything happens; `act` does exactly what it said. Your soldiers, money, mill and followers
 *   are never part of any change.
 * Rights to serve, swear and leave are CL.rights's (`serve`, `swear`, `leave`). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    term: 30, // days of a mercenary contract
    pay: { base: 20, perSoldier: 3, perRenown: 0.1 }, // crowns a week
    vassal: { renown: 150, serviceDays: 20 }, // to swear (tuned in P8-T)
    window: { days: 30, service: 10 }, // a vassal's service: 10 days in every 30
    release: { owing: -15, early: -10 }, // standing lost asking for release while owing service; a contract left early
    defect: -40,
    huntDays: 10,
    oathGap: 7, // days between oaths
    missedToExpel: 3,
    historyMax: 12,
  };
  const KINDS = ['independent', 'mercenary', 'vassal'];
  const ENDS = ['term', 'breach', 'release', 'early', 'defect', 'expelled', 'switched'];

  const R = () => CL.realm;
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'the realm';
  const short = (f) => CL.content.table('factions')[f]?.short || factionName(f);
  const placeName = (sid) => CL.content.table('settlements')[sid]?.name || sid;

  /** @returns {any} */
  const blank = () => ({ kind: 'independent', realm: null, since: 0, until: null, serviceDays: 0, summonsMissed: 0, history: [], window: null, lastOath: null, nextPay: null, served: null, hunt: null });
  const state = (c) => (c.allegiance ||= blank());
  /** The realm you serve now (mercenary or vassal), or null. */
  const serves = (c) => (state(c).kind === 'independent' ? null : state(c).realm);
  /** The realm you are sworn to as a vassal, or null. */
  const sworn = (c) => (state(c).kind === 'vassal' ? state(c).realm : null);

  /** A week's pay for a mercenary: by renown and the size of the company. */
  const weeklyPay = (c) => Math.round(RULES.pay.base + RULES.pay.perSoldier * c.roster.length + RULES.pay.perRenown * c.renown);

  /** Days of mercenary service you have given a realm, in all (for the vassal's oath). */
  function mercenaryDays(c, f) {
    const a = state(c);
    const past = a.history.filter((h) => h.kind === 'mercenary' && h.realm === f).reduce((n, h) => n + (h.serviceDays || 0), 0);
    return past + (a.kind === 'mercenary' && a.realm === f ? a.serviceDays : 0);
  }

  /** The story's favour: you stood with this realm in Q4. */
  const favour = (c, f) => CL.story?.state(c).flags.q4_side === f;

  /** The realm's capital (where you take service, swear and ask for release). */
  const capital = (f) => R().capitalOf(f);

  /** A vassal's service now: days served in this 30-day window. */
  const owed = (c) => {
    const a = state(c);
    if (a.kind !== 'vassal' || !a.window) return 0;
    return Math.max(0, RULES.window.service - a.window.days);
  };

  /** Is a realm at war with anyone? */
  const atWar = (c, f) => R().kingdoms().some((k) => R().relation(c, f, k.id) === 'war');

  // ---- What changes, before it happens ----

  /** Your holdings that would be affected by leaving a realm (none until P8-05 grants land, or debug). */
  const fiefs = (c, f) => R().fiefsOf(R().PLAYER, c).filter((sid) => R().sovereignOf(sid, c) === f);

  /** What stays yours whatever happens, said once in every preview. */
  function keeps(c) {
    const things = ['soldiers', 'money'];
    if (CL.business?.get(c)) things.push('mill');
    if (Object.values(c.followers || {}).some(Boolean) || c.retinue?.length) things.push('followers');
    return `Your ${things.slice(0, -1).join(', ')} and ${things.at(-1)} stay yours.`;
  }

  /**
   * What an action would do: { ok, why, lines, effects }. `action`: 'serve' (a mercenary contract),
   * 'renew', 'swear', 'release' (ask for release, or leave a contract), 'defect'. `effects` is what
   * `act` applies, so the preview and the change can't disagree.
   */
  function preview(c, action, f = null) {
    const a = state(c);
    const realm = f || a.realm;
    const right = CL.rights.may(c, R().PLAYER, { renew: 'serve', release: 'askRelease' }[action] || action, realm || undefined);
    const lines = [];
    /** @type {any} */
    const effects = { action, realm, rep: 0, hunt: false, lose: [], claim: null, returnTo: null, ends: null, pay: 0 };
    if (!right.ok) return { ok: false, why: right.why, lines: [], effects };
    if (action === 'serve' || action === 'renew') {
      effects.pay = weeklyPay(c);
      lines.push(`You serve the ${factionName(realm)} for ${RULES.term} days, at ${effects.pay} crowns a week from their purse.`);
      lines.push(`Their patrols and lords will side with you; attacking theirs breaks the contract.`);
      if (action === 'serve' && serves(c) && a.realm !== realm) {
        effects.ends = a.kind;
        lines.push(`Your ${a.kind === 'vassal' ? 'oath to' : 'contract with'} the ${factionName(a.realm)} ends.`);
      }
    } else if (action === 'swear') {
      lines.push(`You swear fealty to ${R().titled(R().rulerOf(realm, c), c)} and become a vassal of the ${factionName(realm)}.`);
      lines.push(`You owe ${RULES.window.service} days of service in every ${RULES.window.days}, answer summonses, and never fight the realm's people. There is no pay; land may be granted.`);
      if (a.kind === 'mercenary' && a.realm === realm) lines.push(`Your contract with them ends, served.`);
      else if (serves(c)) {
        effects.ends = a.kind;
        lines.push(`Your ${a.kind === 'vassal' ? 'oath to' : 'contract with'} the ${factionName(a.realm)} ends.`);
      }
    } else if (action === 'release') {
      if (a.kind === 'mercenary') {
        const early = a.until != null && c.day < a.until;
        if (early) effects.rep = RULES.release.early;
        lines.push(early ? `You leave the ${factionName(realm)}'s service ${Math.ceil(a.until - c.day)} days early, and lose ${-effects.rep} standing with them.` : `Your contract with the ${factionName(realm)} ends.`);
      } else {
        if (owed(c) > 0 || a.summonsMissed > 0) effects.rep = RULES.release.owing;
        lines.push(effects.rep ? `${R().titled(R().rulerOf(realm, c), c)} releases you, but you owe service: you lose ${-effects.rep} standing with the ${factionName(realm)}.` : `${R().titled(R().rulerOf(realm, c), c)} releases you from your oath, with their thanks.`);
        effects.lose = fiefs(c, realm);
        effects.returnTo = 'crown';
        for (const sid of effects.lose) lines.push(`${placeName(sid)} returns to the crown. You keep no claim to it.`);
      }
    } else if (action === 'defect') {
      effects.rep = RULES.defect;
      effects.hunt = true;
      effects.lose = fiefs(c, realm);
      effects.claim = 'granted';
      lines.push(`You break with the ${factionName(realm)} without leave: you lose ${-RULES.defect} standing with them.`);
      for (const sid of effects.lose) lines.push(`You will lose ${placeName(sid)}. You keep a claim to it.`);
      lines.push(`${short(realm)}'s lords will hunt you for ${RULES.huntDays} days.`);
    }
    if (action !== 'serve' && action !== 'renew' && action !== 'swear' && lines.length) lines.push(`Lords who think well of you may think less of you.`); // P8-07 says how much
    lines.push(keeps(c));
    return { ok: true, why: '', lines, effects };
  }

  /** Record the end of what you were, in the history. */
  function close(c, end) {
    const a = state(c);
    if (a.kind === 'independent') return;
    a.history = [...a.history, { kind: a.kind, realm: a.realm, from: a.since, to: c.day, end, serviceDays: a.serviceDays }].slice(-RULES.historyMax);
    CL.chronicle?.add(c, { day: c.day, kind: 'allegiance', event: end, as: a.kind, by: a.realm });
    Object.assign(a, { kind: 'independent', realm: null, since: c.day, until: null, serviceDays: 0, summonsMissed: 0, window: null, nextPay: null, served: null });
  }

  /** Give up the realm's holdings you hold: back to the crown, with or without a claim. */
  function giveUp(c, sids, claim) {
    for (const sid of sids) {
      const h = R().holding(sid, c);
      if (!h || h.holder !== R().PLAYER) continue;
      R().transfer(c, sid, { holder: R().rulerOf(h.sovereign, c), willing: !claim, claimKind: claim || 'old', reason: claim ? 'defection' : 'released' });
    }
  }

  /** Do what `preview` said. Returns the preview it acted on, or null when it may not. */
  function act(c, action, f = null) {
    const p = preview(c, action, f);
    if (!p.ok) return null;
    const a = state(c);
    const e = p.effects;
    const realm = e.realm;
    if (action === 'serve' || action === 'renew') {
      if (action === 'renew') {
        a.until = Math.max(a.until ?? c.day, c.day) + RULES.term;
      } else {
        if (serves(c)) close(c, 'switched');
        // A new contract is an oath; taking up service again after a term with the same realm isn't a change of side.
        const again = a.history.at(-1)?.end === 'term' && a.history.at(-1)?.realm === realm;
        Object.assign(a, { kind: 'mercenary', realm, since: c.day, until: c.day + RULES.term, serviceDays: 0, summonsMissed: 0, window: null, nextPay: c.day + 7, served: Math.floor(c.day), lastOath: again ? a.lastOath : c.day });
      }
      CL.ui.message(action === 'renew' ? `Your contract with the ${factionName(realm)} runs ${RULES.term} more days.` : `You take service with the ${factionName(realm)}: ${weeklyPay(c)} crowns a week.`);
    } else if (action === 'swear') {
      const served = a.kind === 'mercenary' && a.realm === realm;
      if (serves(c)) close(c, served ? 'term' : 'switched');
      Object.assign(a, { kind: 'vassal', realm, since: c.day, until: null, serviceDays: 0, summonsMissed: 0, window: { start: c.day, days: 0 }, nextPay: null, served: null, lastOath: c.day });
      CL.ui.message(`You kneel before ${R().titled(R().rulerOf(realm, c), c)} and rise a vassal of the ${factionName(realm)}.`);
    } else if (action === 'release') {
      if (e.rep) R().adjust(c, realm, e.rep, 'released owing service');
      giveUp(c, e.lose, null);
      const early = a.kind === 'mercenary' && e.rep;
      close(c, early ? 'early' : a.kind === 'mercenary' ? 'term' : 'release');
      CL.ui.message(`You are free of the ${factionName(realm)}.`);
    } else if (action === 'defect') {
      R().adjust(c, realm, e.rep, 'defected');
      giveUp(c, e.lose, 'granted');
      close(c, 'defect');
      a.hunt = { realm, until: c.day + RULES.huntDays };
      CL.ui.message(`You have broken with the ${factionName(realm)}. Their lords will be looking for you.`);
    }
    CL.diag.log('info', 'Allegiance', { action, realm, kind: a.kind });
    return p;
  }

  /** Thrown out: as defection, without the hunt (no preview: it happens to you). */
  function expel(c, why) {
    const a = state(c);
    if (a.kind === 'independent') return false;
    const realm = a.realm;
    if (a.kind === 'mercenary') {
      close(c, 'breach');
      CL.ui.message(`The ${factionName(realm)} tear up your contract: ${why}.`);
      return true;
    }
    giveUp(c, fiefs(c, realm), 'granted');
    close(c, 'expelled');
    CL.ui.message(`The ${factionName(realm)} have cast you out: ${why}. Your lands are forfeit.`);
    return true;
  }

  /** You attacked a realm's own people (js/parties.js): a breach of contract or oath with that realm. */
  function onAttack(c, f) {
    if (serves(c) === f) expel(c, 'you attacked their own');
  }

  /** A battle won against the realm's enemies counts as a day of service (once a day). */
  function afterBattle(c, { win, faction, kind }) {
    const f = serves(c);
    if (!f || !win) return;
    const enemy = kind === 'bandit' || (R().isKingdom(faction) && faction !== f && R().relation(c, f, faction) === 'war');
    if (enemy) serve(c);
  }

  /** Mark today as a day of service (fighting, at your fief, at a summons). */
  function serve(c) {
    const a = state(c);
    const today = Math.floor(c.day);
    if (a.kind !== 'vassal' || a.served === today) return false;
    a.served = today;
    a.serviceDays++;
    if (a.window) a.window.days++;
    return true;
  }

  /** Is the company hunted by this realm's lords (after a defection)? */
  const hunted = (c, f) => Boolean(state(c).hunt && state(c).hunt.realm === f && c.day < state(c).hunt.until);

  /** Day by day: pay, the mercenary's days, the term, the vassal's window and expulsion. */
  function tick(c) {
    const a = state(c);
    if (a.hunt && c.day >= a.hunt.until) a.hunt = null;
    if (a.kind === 'mercenary') {
      while (a.served < Math.floor(c.day)) {
        a.served++;
        a.serviceDays++;
      }
      while (a.nextPay != null && c.day >= a.nextPay) {
        CL.accounts.earn(c, weeklyPay(c), `pay from the ${factionName(a.realm)}`);
        a.nextPay += 7;
      }
      if (c.day >= a.until) {
        const f = a.realm;
        close(c, 'term');
        CL.ui.message(`Your contract with the ${factionName(f)} has run its term. Renew it at ${placeName(capital(f))}.`);
      }
    } else if (a.kind === 'vassal') {
      // Garrisoning your fief (P8-05): a day spent at one of your holdings is a day of service.
      const at = c.world?.location;
      if (at && R().holderOf(at, c) === R().PLAYER) serve(c);
      if (a.window && c.day >= a.window.start + RULES.window.days) {
        if (a.window.days < RULES.window.service) {
          a.summonsMissed++;
          CL.ui.message(`You have given the ${factionName(a.realm)} too little service this month (${a.window.days} of ${RULES.window.service} days).`);
        }
        a.window = { start: a.window.start + RULES.window.days, days: 0 };
      }
      if (a.summonsMissed >= RULES.missedToExpel) expel(c, 'you have not answered their call');
      else if (R().isHostile(c, a.realm)) expel(c, 'they count you an enemy');
    }
    if (a.kind === 'mercenary' && R().isHostile(c, a.realm)) expel(c, 'they count you an enemy');
  }

  /** Why you can't take service or swear here, or null — for the board's cards. */
  const offerWhy = (c, action, f) => {
    const r = CL.rights.may(c, R().PLAYER, action, f);
    return r.ok ? null : r.why;
  };

  /** The Allegiance tab's lines: what you are, the term or service, what is owed. */
  function summary(c) {
    const a = state(c);
    if (a.kind === 'independent') return { title: 'Independent', lines: ['You answer to no crown. Take service, or swear fealty, at a kingdom’s capital (its notice board).', ...(a.hunt && c.day < a.hunt.until ? [`${short(a.hunt.realm)}'s lords are hunting you for ${Math.ceil(a.hunt.until - c.day)} more days.`] : [])] };
    const lines = [];
    if (a.kind === 'mercenary') {
      lines.push(`A mercenary of the ${factionName(a.realm)} since day ${CL.party.dayNumber(a.since)}: ${Math.max(0, Math.ceil(a.until - c.day))} days left, ${weeklyPay(c)} crowns a week.`);
      lines.push(`${mercenaryDays(c, a.realm)} days of service to them in all (${RULES.vassal.serviceDays} needed to swear fealty).`);
    } else {
      lines.push(`A vassal of the ${factionName(a.realm)} since day ${CL.party.dayNumber(a.since)}, sworn to ${R().titled(R().rulerOf(a.realm, c), c)}.`);
      const left = Math.ceil(a.window.start + RULES.window.days - c.day);
      lines.push(owed(c) ? `Service owed: ${owed(c)} more days in the next ${left} (fight their enemies, or stay at your fief).` : `Service: met for this month (${a.window.days} days; ${left} days left in it).`);
      if (a.summonsMissed) lines.push(`Calls missed: ${a.summonsMissed} of ${RULES.missedToExpel} before you are cast out.`);
      const land = fiefs(c, a.realm);
      lines.push(land.length ? `You hold ${land.map(placeName).join(', ')}.` : 'You hold no land yet.');
    }
    return { title: a.kind === 'mercenary' ? 'Mercenary' : 'Vassal', lines };
  }

  // ---- Saves ----

  /** Repair the allegiance onto `s` (after the people and holdings). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const x = d?.allegiance;
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    const a = blank();
    s.allegiance = a;
    if (!x || typeof x !== 'object') return;
    a.history = (Array.isArray(x.history) ? x.history : [])
      .filter((h) => h && KINDS.includes(h.kind) && h.kind !== 'independent' && R().isRealm(h.realm) && ENDS.includes(h.end) && num(h.from) && num(h.to))
      .slice(-RULES.historyMax)
      .map((h) => ({ kind: h.kind, realm: h.realm, from: h.from, to: h.to, end: h.end, serviceDays: Math.max(0, Math.floor(num(h.serviceDays) ? h.serviceDays : 0)) }));
    a.lastOath = num(x.lastOath) ? x.lastOath : null;
    if (x.hunt && R().isRealm(x.hunt.realm) && num(x.hunt.until) && x.hunt.until > s.day) a.hunt = { realm: x.hunt.realm, until: x.hunt.until };
    if (!KINDS.includes(x.kind) || x.kind === 'independent' || !R().isRealm(x.realm)) return;
    Object.assign(a, {
      kind: x.kind,
      realm: x.realm,
      since: num(x.since) ? x.since : s.day,
      serviceDays: Math.max(0, Math.floor(num(x.serviceDays) ? x.serviceDays : 0)),
      summonsMissed: Math.max(0, Math.min(RULES.missedToExpel, Math.floor(num(x.summonsMissed) ? x.summonsMissed : 0))),
    });
    if (a.kind === 'mercenary') {
      a.until = num(x.until) ? x.until : s.day + RULES.term;
      a.nextPay = num(x.nextPay) ? x.nextPay : s.day + 7;
      a.served = num(x.served) ? Math.floor(x.served) : Math.floor(s.day);
    } else {
      a.window = num(x.window?.start) ? { start: x.window.start, days: Math.max(0, Math.floor(num(x.window.days) ? x.window.days : 0)) } : { start: s.day, days: 0 };
      a.served = num(x.served) ? Math.floor(x.served) : null;
    }
  }

  CL.allegiance = { RULES, KINDS, blank, state, serves, sworn, weeklyPay, mercenaryDays, favour, capital, owed, atWar, preview, act, expel, onAttack, afterBattle, serve, hunted, tick, offerWhy, summary, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
