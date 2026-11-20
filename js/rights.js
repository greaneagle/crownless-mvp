/* Crownless rights (P8-03, design §4.3): who may do what, and where, with a reason in words.
 *
 *   CL.rights.may(c, who, action, target?) → { ok: true, why: '' } or { ok: false, why: '…' }
 *
 * `who` is 'player' or a person of the realms (`person:<n>`, P8-02). `target` is a settlement id for the
 * place actions, and a person id for ransom, release and askHelp. Every right is worked out from the
 * state, never stored and never `if (player.isKing)`:
 *   - standing: a kingdom that counts the player Hostile deals with them in nothing (GDD §10);
 *   - holdings: who holds a place, who controls its gates, which realm claims it (P8-02);
 *   - allegiance: P8-04 fills it in; until then the player is sworn to no realm, and a lord to their own;
 *   - war and peace between realms (W-07), for the lords;
 *   - the story's locks (Greywall and Ashgate until Q4 ends) and the capitals (never taken in Phase 8).
 * Nothing outside this file decides a right (a grep test keeps it so: tests/rights.test.js). What a
 * place offers (a market, a recruiting hall, a board of contracts) is the place's, not a right. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const PLAYER = 'player';

  const R = () => CL.realm;
  const yes = () => ({ ok: true, why: '' });
  const no = (why) => ({ ok: false, why });
  const place = (id) => (typeof id === 'string' && CL.content.table('settlements')[id]) || null;
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'the lords here';
  const short = (f) => CL.content.table('factions')[f]?.short || factionName(f);

  /** The realm a person is sworn to: a lord's own; the player's as their vassal's oath says (P8-04). */
  const allegiance = (c, who) => (who === PLAYER ? CL.allegiance?.sworn(c) || null : R().person(who, c)?.realm || null);
  const A = () => CL.allegiance;
  /** Days since the player's last change of allegiance (an oath taken, or left; a contract that ran its term doesn't count). */
  function sinceOath(c) {
    const a = A().state(c);
    const left = [...a.history].reverse().find((h) => h.end !== 'term');
    const last = Math.max(a.lastOath ?? -1e9, left?.to ?? -1e9);
    return c.day - last;
  }

  /**
   * Is `who` an enemy of kingdom `f` here? The player by standing (Hostile); a lord when their realm is
   * at war with it.
   */
  function enemyOf(c, who, f) {
    if (!R().isKingdom(f)) return false;
    if (who === PLAYER) return R().isHostile(c, f);
    const mine = allegiance(c, who);
    return Boolean(mine) && mine !== f && R().relation(c, mine, f) === 'war';
  }

  /** Why an enemy is barred from a place: "Valedorn won't let you recruit here: they count you Hostile". */
  function barred(c, who, f, doing, action) {
    if (who === PLAYER) return (PLAYER_BARRED[action] || ((n) => `The ${n} won't let you ${doing} here: they count you Hostile`))(factionName(f));
    return `${short(f)} won't let ${R().titled(who, c)} ${doing} here: their realms are at war`;
  }

  // What each place action is called in a refusal.
  const DOING = {
    recruit: 'recruit',
    contract: 'take their work',
    trade: 'trade',
    rest: 'rest',
    buyBusiness: 'buy a business',
    enterFort: 'through the gates',
    enterTourney: 'fight in the lists',
    joinEvent: 'take part',
    shelter: 'shelter',
  };
  // The player's refusals in the words each screen has always used.
  const PLAYER_BARRED = {
    buyBusiness: (n) => `The ${n} count you Hostile and will not sell to you`,
    joinEvent: (n) => `The ${n} count you Hostile and will not deal with an enemy`,
    enterTourney: (n) => `The ${n} count you Hostile: enemies of the town are not welcome in its lists`,
    shelter: (n) => `The ${n} count you Hostile and will not take you in`,
  };
  // Of these, the ones a Hostile owner refuses today (unchanged from before P8-03). Markets and rest
  // stay open to anyone with coin: the place's own people trade and rent beds whatever their lords say.
  const BARRED_TO_ENEMIES = new Set(['recruit', 'contract', 'buyBusiness', 'enterFort', 'enterTourney', 'joinEvent', 'shelter']);

  /** May `who` run this holding as its holder or administrator (P8-05)? */
  function runs(c, who, sid) {
    const h = R().holding(sid, c);
    if (!h) return no(`${place(sid)?.name || 'This place'} is no one's to run`);
    if (h.holder === who || h.administrator === who) return yes();
    if (h.controller !== h.sovereign && R().rulerOf(h.controller, c) === who) return yes(); // occupied: run by the occupier's crown
    return no(`You don't hold ${place(sid).name}: ${R().titled(h.holder, c)} does`);
  }

  /**
   * May `who` do `action` (at `target`)?
   * @param {Campaign} c @param {string} who 'player' or a person id @param {string} action @param {string} [target]
   * @returns {{ ok: boolean, why: string }}
   */
  function may(c, who, action, target) {
    if (who !== PLAYER && !R().person(who, c)) return no('No such person');
    if (DOING[action]) {
      const s = place(target);
      if (!s) return no('Not here');
      const f = R().owner(target, c);
      if (BARRED_TO_ENEMIES.has(action) && enemyOf(c, who, f)) return no(barred(c, who, f, DOING[action], action));
      return yes();
    }
    switch (action) {
      case 'appoint':
      case 'setPolicy':
      case 'drawTreasury':
        return runs(c, who, target);
      case 'grant': {
        // Rulers only: the crown grants what its realm holds (P8-05).
        const h = R().holding(target, c);
        if (!h) return no(`${place(target)?.name || 'That'} is no one's to grant`);
        if (R().rulerOf(h.sovereign, c) !== who) return no(`Only the ruler of the ${factionName(h.sovereign)} grants ${place(target).name}`);
        if (R().locked(c, target) || (h.seat && R().locked(c, h.seat))) return no('Only the story decides this until it ends');
        if (h.controller !== h.sovereign) return no(`The ${factionName(h.controller)} hold its gates`);
        return yes();
      }
      case 'seize': {
        // A fort's gates taken without a siege (the Debug panel; world events later): a fort only, not
        // a story fort before Q4 ends, never a capital. A village follows its seat.
        const s = place(target);
        if (!s || !R().holding(target, c)) return no('Not a holding');
        if (s.type === 'village') return no('A village follows its seat: take the seat');
        if (R().locked(c, target)) return no('Only the story moves this fort until Q4 ends');
        if (R().isCapital(target)) return no('A capital never changes hands');
        return yes();
      }
      case 'besiege': {
        // P8-06a: a realm's lords at war besiege; an independent company has no realm behind it.
        const s = place(target);
        const h = R().holding(target, c);
        if (!s || !h || s.type === 'village') return no('Only a fort or a town can be besieged');
        if (R().locked(c, target)) return no('Only the story decides this fort until it ends');
        if (R().isCapital(target)) return no('A capital never falls in this age');
        const mine = allegiance(c, who);
        if (!mine) return no('No realm stands behind you: swear to one first');
        if (mine === h.controller) return no(`${s.name} is already your realm's`);
        if (R().relation(c, mine, h.controller) !== 'war') return no(`${short(mine)} is not at war with ${short(h.controller)}`);
        return yes();
      }
      case 'serve': {
        // P8-04: a mercenary contract with a realm (or its renewal): Neutral standing or better.
        const f = R().isRealm(target) ? target : R().sovereignOf(target, c);
        if (who !== PLAYER) return no('Lords take service from P8-07');
        if (!R().isRealm(f)) return no('There is no crown here to serve');
        const a = A().state(c);
        if (a.kind === 'vassal') return no(`You are sworn to the ${factionName(a.realm)}: ask for release first`);
        if (enemyOf(c, who, f)) return no(`The ${factionName(f)} count you Hostile: they will not hire you`);
        if (!(a.kind === 'mercenary' && a.realm === f) && sinceOath(c) < A().RULES.oathGap) return no(`You changed your allegiance lately: from day ${CL.party.dayNumber(c.day + A().RULES.oathGap - sinceOath(c))}`);
        return yes();
      }
      case 'swear': {
        // P8-04: `target` is a place of the realm to swear to (its sovereign), or the realm itself.
        const f = R().isRealm(target) ? target : R().sovereignOf(target, c);
        if (!R().isRealm(f)) return no('There is no crown here to swear to');
        if (allegiance(c, who)) return no(`You are already sworn to the ${factionName(allegiance(c, who))}`);
        if (enemyOf(c, who, f)) return no(`The ${factionName(f)} count you Hostile: they will not take your oath`);
        if (who === PLAYER) {
          const V = A().RULES.vassal;
          if (R().standing(c, f) !== 'friendly') return no(`The ${factionName(f)} must count you a friend`);
          if (c.renown < V.renown) return no(`You need ${V.renown} renown (you have ${c.renown})`);
          if (A().mercenaryDays(c, f) < V.serviceDays && !A().favour(c, f)) return no(`Serve them first: ${V.serviceDays} days as their mercenary (you have ${A().mercenaryDays(c, f)}), or win their favour in the story`);
          if (sinceOath(c) < A().RULES.oathGap && A().state(c).kind !== 'mercenary') return no(`You changed your allegiance lately: from day ${CL.party.dayNumber(c.day + A().RULES.oathGap - sinceOath(c))}`);
        }
        return yes();
      }
      case 'askRelease': {
        // P8-04: leave a contract, or ask the ruler to release you from your oath.
        const a = A().state(c);
        if (who !== PLAYER || a.kind === 'independent') return no('You serve no realm');
        if (a.kind === 'vassal' && A().atWar(c, a.realm)) return no(`The ${factionName(a.realm)} are at war: ${R().titled(R().rulerOf(a.realm, c), c)} will not release you now`);
        return yes();
      }
      case 'defect': {
        const a = A().state(c);
        if (who !== PLAYER || a.kind !== 'vassal') return no('You are sworn to no realm');
        return yes();
      }
      case 'leave':
        if (!allegiance(c, who)) return no('You are sworn to no realm');
        if (R().rules(who, c)) return no('A ruler cannot leave their own realm');
        return yes();
      case 'askHelp': {
        // P8-07: ask a lord for help. They listen unless their realm counts you an enemy.
        const p = R().person(target, c);
        if (!p || target === PLAYER) return no('There is no one to ask');
        if (p.status === 'captive') return no(`${R().titled(target, c)} is a captive`);
        if (enemyOf(c, who, p.realm)) return no(`${R().titled(target, c)} will not help an enemy of the ${factionName(p.realm)}`);
        return yes();
      }
      case 'ransom':
      case 'release': {
        // P8-01: whoever holds a captive may ransom or free them.
        const p = R().person(target, c);
        if (p?.status !== 'captive') return no('They are no one’s captive');
        if (p.heldBy !== who) return no(`${R().titled(target, c)} is not your captive`);
        return yes();
      }
      default:
        return no(`Unknown action ${action}`);
    }
  }

  /** The reason as a plain string ('' when allowed): for the places that only need the words. */
  const why = (c, who, action, target) => may(c, who, action, target).why;

  const ACTIONS = [...Object.keys(DOING), 'appoint', 'setPolicy', 'drawTreasury', 'grant', 'seize', 'besiege', 'serve', 'swear', 'askRelease', 'defect', 'leave', 'askHelp', 'ransom', 'release'];

  CL.rights = { PLAYER, ACTIONS, may, why, allegiance, enemyOf };
})(typeof window !== 'undefined' ? window : globalThis);
