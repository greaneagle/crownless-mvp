/* Crownless claims: losing and retaking land (P8-08, design §17.3–17.6, SC-20–SC-23, decision D-P8e).
 *
 * - **Every way you lose a holding, and what is left** (`LOSSES`): a siege (control to the taker, held by
 *   its ruler; you keep an `old` claim; a castellan walks out of a surrender, or is taken with a fort
 *   stormed and freed when it is retaken), your liege's revocation (after a warning: a second missed
 *   call takes back a fief, no claim), leaving the realm (released: no claim; defected or expelled: a
 *   `granted` claim), and handing it back yourself (no claim). Your soldiers, money, mill and followers
 *   are never part of it.
 * - **Your claims** (`mine`): each with how it came about, its realm, who holds it now, and what could
 *   press it. A claim never pays and gives no control. The policies you had there are kept with it
 *   (`claim.policies`), restored if you get it back.
 * - **Pressing a claim:**
 *   - retake it by siege (CL.sieges, CL.rights `besiege`): if your liege backs the claim (you are their
 *     sworn vassal, with room for a fief, and the ruler doesn't think ill of you) the fort is yours
 *     again with the villages you claimed; otherwise it is a conquest like any other (D-P8f);
 *   - ask your liege to press it in their war (`askLiege`): the realm's next siege goes for it;
 *   - buy it back from the realm that holds it (`buyBack`): at peace with your liege, for a price.
 *   A claim on a holding your own liege's crown holds becomes a grant offered to you; one held by a
 *   lord of your own realm is refused while you are sworn.
 * Claims are kept on the holdings (`holding.claims`, P8-02); this module only reads and presses them. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const PLAYER = 'player';

  const RULES = {
    price: { fort: 800, village: 200 },
    askGap: 7, // days between asking your liege about one claim
    pressDays: 30, // how long a pressed claim leads the realm's sieges
    grudge: -10, // a ruler who thinks less of you than this won't back your claim
    serve: { days: 30, wins: 4, again: 60 }, // P9-L1: a fort back for a term of service: battles won against its holder's enemies
  };
  const LOSSES = ['stormed', 'surrendered', 'revoked', 'released', 'defected', 'expelled', 'handed'];

  const R = () => CL.realm;
  const place = (id) => (typeof id === 'string' && CL.content.table('settlements')[id]) || null;
  const placeName = (id) => place(id)?.name || id;
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'the realm';
  const short = (f) => CL.content.table('factions')[f]?.short || factionName(f);
  const opinion = (c, from) => (CL.nobles ? CL.nobles.opinion(c, from, PLAYER) : 0);

  /** Your claims, newest first, a seat before its villages: [{ sid, claim }]. @param {Campaign} c */
  function mine(c) {
    const out = [];
    for (const [sid, h] of Object.entries(c.holdings || {})) {
      const k = h.claims.find((x) => x.by === PLAYER);
      if (k) out.push({ sid, claim: k });
    }
    const order = { town: 0, fort: 1, village: 2 }; // a seat before its villages
    return out.sort((a, b) => b.claim.since - a.claim.since || order[c.holdings[a.sid].kind] - order[c.holdings[b.sid].kind] || a.sid.localeCompare(b.sid));
  }
  const claimOf = (c, sid) => R().holding(sid, c)?.claims.find((x) => x.by === PLAYER) || null;

  /** How a claim came about, in words. */
  function howWords(k) {
    const day = `day ${CL.party.dayNumber(k.since)}`;
    if (k.kind === 'granted') return `held of the ${factionName(k.realm)} until you left them on ${day}`;
    if (k.kind === 'conquest') return `won in a conquest on ${day}`;
    return `held for the ${factionName(k.realm)} until it was taken on ${day}`;
  }

  /** The realm you could press a claim with: the one you serve. */
  const liege = (c) => CL.allegiance?.sworn(c) || null;

  /** Can your liege back this claim (on retaking it, or now)? { ok, why } */
  function backing(c, sid) {
    const k = claimOf(c, sid);
    const f = liege(c);
    if (!k) return { ok: false, why: 'You have no claim to it' };
    if (!f) return { ok: false, why: 'No crown stands behind you: swear to one' };
    const ruler = R().rulerOf(f, c);
    if (opinion(c, ruler) < RULES.grudge) return { ok: false, why: `${R().titled(ruler, c)} thinks too little of you to back it` };
    if (R().fiefsOf(PLAYER, c).length >= R().FIEF_CAP) return { ok: false, why: `You hold ${R().FIEF_CAP} fiefs already` };
    return { ok: true, why: '' };
  }

  /** Ask your liege to press it in their war: { ok, why } for the button. */
  function canAskLiege(c, sid) {
    const h = R().holding(sid, c);
    const k = claimOf(c, sid);
    const f = liege(c);
    if (!k || !h) return { ok: false, why: 'You have no claim to it' };
    if (!f) return { ok: false, why: 'You are sworn to no crown' };
    if (h.sovereign === f) return { ok: false, why: `It is held for your own liege: a claim against them is refused while you are sworn` };
    if (R().relation(c, f, h.controller) !== 'war') return { ok: false, why: `${short(f)} is not at war with ${short(h.controller)}` };
    if (h.kind === 'village') return { ok: false, why: `It goes with ${placeName(h.seat)}: press that claim` };
    if (k.pressed != null && c.day < k.pressed) return { ok: false, why: `Your liege presses it already, until day ${CL.party.dayNumber(k.pressed)}` };
    if (k.asked != null && c.day < k.asked + RULES.askGap) return { ok: false, why: `You asked lately; ask again on day ${CL.party.dayNumber(k.asked + RULES.askGap)}` };
    if (R().locked(c, sid)) return { ok: false, why: 'Only the story decides this fort until it ends' };
    return { ok: true, why: '' };
  }

  /** Ask your liege to press your claim in their war: the ruler agrees if they think well enough of you. */
  function askLiege(c, sid) {
    const can = canAskLiege(c, sid);
    if (!can.ok) return { ok: false, text: can.why };
    const k = claimOf(c, sid);
    const f = liege(c);
    const ruler = R().rulerOf(f, c);
    k.asked = Math.floor(c.day);
    const will = opinion(c, ruler) + (c.influence?.[f] || 0) >= 0;
    if (!will) {
      const why = CL.nobles?.deedWords(c, ruler, PLAYER);
      return { ok: true, agreed: false, text: `${R().titled(ruler, c)} will not spend the crown's lords on your claim to ${placeName(sid)}${why ? `: ${why}` : ''}.` };
    }
    k.pressed = Math.floor(c.day) + RULES.pressDays;
    return { ok: true, agreed: true, text: `${R().titled(ruler, c)} will press your claim: the ${short(f)} lords go for ${placeName(sid)} next.` };
  }

  /** Is a fort's taking pressed for a realm (js/sieges.js aims at it)? */
  const pressedFor = (c, sid, f) => {
    const k = claimOf(c, sid);
    return Boolean(k?.pressed != null && c.day < k.pressed && liege(c) === f);
  };

  /** What buying it back costs and whether the realm holding it would sell: { ok, why, price }. */
  function canBuyBack(c, sid) {
    const h = R().holding(sid, c);
    const k = claimOf(c, sid);
    const f = liege(c);
    if (!k || !h) return { ok: false, why: 'You have no claim to it', price: 0 };
    const price = RULES.price[h.kind] || RULES.price.fort;
    if (h.kind === 'village') return { ok: false, why: `It goes with ${placeName(h.seat)}`, price };
    if (!f) return { ok: false, why: 'Swear to a crown first: it would be held for them', price };
    if (h.sovereign === f) return { ok: false, why: `It is held for your own liege: ${h.holder === R().rulerOf(f, c) ? 'the crown may grant it to you' : 'a claim against them is refused while you are sworn'}`, price };
    if (R().relation(c, f, h.controller) === 'war') return { ok: false, why: `${short(h.controller)} is at war with your liege: take it instead`, price };
    if (R().isHostile(c, h.controller)) return { ok: false, why: `The ${factionName(h.controller)} count you an enemy`, price };
    if (R().locked(c, sid)) return { ok: false, why: 'Only the story decides this fort until it ends', price };
    if (CL.sieges?.at(c, sid)) return { ok: false, why: 'It is besieged', price };
    if (R().fiefsOf(PLAYER, c).length >= R().FIEF_CAP) return { ok: false, why: `You hold ${R().FIEF_CAP} fiefs already`, price };
    if (c.gold < price) return { ok: false, why: `It costs ${price} crowns (you have ${c.gold})`, price };
    return { ok: true, why: '', price };
  }

  /**
   * P9-L1: serve the realm holding it for it, instead of paying: within 30 days, win four battles
   * against its enemies (Reavers, or a realm at war with it) and never attack its people. Offered as
   * buying back is (sworn to a liege at peace with it), with no price; broken off, not again for 60 days.
   */
  function canServeBack(c, sid) {
    const k = claimOf(c, sid);
    const buy = canBuyBack(c, sid);
    const S = RULES.serve;
    if (!k) return { ok: false, why: buy.why };
    if (k.serveUntil != null) return { ok: false, why: `You serve the ${factionName(k.serveRealm)} for it until day ${CL.party.dayNumber(k.serveUntil)}: ${k.serveWins || 0} of ${S.wins} battles won` };
    if (k.serveAgain != null && c.day < k.serveAgain) return { ok: false, why: `They won't offer it again before day ${CL.party.dayNumber(k.serveAgain)}` };
    // The same conditions as buying it back, but money.
    if (!buy.ok && !/^It costs /.test(buy.why)) return { ok: false, why: buy.why };
    return { ok: true, why: '' };
  }

  /** Take the term of service for it. */
  function serveBack(c, sid) {
    const can = canServeBack(c, sid);
    if (!can.ok) return { ok: false, text: can.why };
    const k = claimOf(c, sid);
    const f = R().holding(sid, c).controller;
    Object.assign(k, { serveRealm: f, serveFrom: Math.floor(c.day), serveUntil: Math.floor(c.day) + RULES.serve.days, serveWins: 0 });
    return { ok: true, text: `The ${factionName(f)} will hand ${placeName(sid)} back to you for a season's service: win ${RULES.serve.wins} battles against their enemies by day ${CL.party.dayNumber(k.serveUntil)}, and never raise a hand against their people.` };
  }

  /** The service ends: done (the fort handed back, as bought), or broken off. */
  function endService(c, sid, done, why = '') {
    const k = claimOf(c, sid);
    if (!k || k.serveUntil == null) return null;
    const f = k.serveRealm;
    for (const f of ['serveRealm', 'serveFrom', 'serveUntil', 'serveWins']) delete k[f];
    if (!done) {
      k.serveAgain = Math.floor(c.day) + RULES.serve.again;
      CL.ui.message(`Your service to the ${factionName(f)} for ${placeName(sid)} is broken off${why ? `: ${why}` : ''}.`);
      return { done: false };
    }
    const liegeF = liege(c);
    R().transfer(c, sid, { controller: liegeF, sovereign: liegeF, holder: PLAYER, willing: true, reason: 'served for' });
    restoreVillages(c, sid);
    CL.news?.record(c, 'fief_granted', { place: sid, text: `The ${factionName(f)} hand ${placeName(sid)} back to ${c.character?.name || 'its old holder'} for a season's service.` });
    CL.ui.message(`Your service is done: the ${factionName(f)} hand ${placeName(sid)} back. It is yours again, held of the ${factionName(liegeF)}.`);
    return { done: true };
  }

  /** A battle fought (js/encounter.js): a win against the realm's enemies counts for your service. */
  function afterBattle(c, { win, faction, kind }) {
    if (!win) return;
    for (const { sid, claim: k } of mine(c)) {
      if (k.serveUntil == null) continue;
      const enemy = kind === 'bandit' || faction === R().outlaws() || (R().isRealm(faction) && R().relation(c, k.serveRealm, faction) === 'war');
      if (!enemy) continue;
      k.serveWins = (k.serveWins || 0) + 1;
      if (k.serveWins >= RULES.serve.wins) endService(c, sid, true);
      else CL.ui.message(`A battle for the ${factionName(k.serveRealm)}: ${k.serveWins} of ${RULES.serve.wins} for ${placeName(sid)}.`);
    }
  }

  /** You attacked a realm's people (js/parties.js): a service to them is broken off. */
  function onAttack(c, f) {
    for (const { sid, claim: k } of mine(c)) if (k.serveUntil != null && k.serveRealm === f) endService(c, sid, false, 'you attacked their people');
  }

  /** Buy it back: the realm holding it sells it to your liege, with you as its holder, and its villages you claimed. */
  function buyBack(c, sid) {
    const can = canBuyBack(c, sid);
    if (!can.ok) return { ok: false, text: can.why };
    const h = R().holding(sid, c);
    const seller = h.controller;
    const f = liege(c);
    if (!CL.accounts.spend(c, can.price, `bought back ${placeName(sid)} from the ${factionName(seller)}`)) return { ok: false, text: 'You cannot pay' };
    R().transfer(c, sid, { controller: f, sovereign: f, holder: PLAYER, willing: true, reason: 'bought back' });
    restoreVillages(c, sid);
    CL.news?.record(c, 'fief_granted', { place: sid, text: `The ${factionName(seller)} sell ${placeName(sid)} back to ${c.character?.name || 'its old holder'}.` });
    return { ok: true, text: `You buy ${placeName(sid)} back for ${can.price} crowns. It is yours again, held of the ${factionName(f)}.` };
  }

  /** The villages of a seat you held come back to you with it (the crown's to grant, you first). */
  function restoreVillages(c, seat) {
    for (const v of R().villagesOf(seat, c)) {
      if (!claimOf(c, v) || R().fiefsOf(PLAYER, c).length >= R().FIEF_CAP) continue;
      R().transfer(c, v, { holder: PLAYER, willing: true, reason: 'claim restored', quiet: true });
    }
  }

  /**
   * You took a fort for your realm (js/sieges.js take): if your liege backs your claim, it is yours again
   * at once, with the villages you held. Returns true when it was (no conqueror's choice then).
   */
  function onRetake(c, sid) {
    if (!claimOf(c, sid) || R().sovereignOf(sid, c) !== liege(c) || !backing(c, sid).ok) return false;
    if (!R().transfer(c, sid, { holder: PLAYER, willing: true, reason: 'claim restored' })) return false;
    restoreVillages(c, sid);
    const ruler = R().rulerOf(liege(c), c);
    CL.ui.message(`${R().titled(ruler, c)} confirms your claim: ${placeName(sid)} is yours again.`);
    return true;
  }

  /** Hand a fief back to the crown yourself: no claim kept. */
  function handBack(c, sid) {
    const h = R().holding(sid, c);
    if (h?.holder !== PLAYER) return { ok: false, text: 'It is not yours' };
    const ruler = R().rulerOf(h.sovereign, c);
    R().transfer(c, sid, { holder: ruler, willing: true, reason: 'handed back' });
    CL.nobles?.note(c, ruler, PLAYER, 'refused', { kin: false });
    return { ok: true, text: `You hand ${placeName(sid)} back to ${R().titled(ruler, c)}. You keep no claim to it.` };
  }

  /** What a claim card shows: { title, lines, liege, buy }. */
  function card(c, sid) {
    const h = R().holding(sid, c);
    const k = claimOf(c, sid);
    const lines = [`${placeName(sid)} (${h.kind}): ${howWords(k)}.`];
    lines.push(`Now ${h.controller === h.sovereign ? `held for the ${factionName(h.sovereign)}` : `in the ${factionName(h.controller)}'s hands`} by ${R().titled(h.holder, c)}. A claim gives no income and no control.`);
    const f = liege(c);
    const press = [];
    if (h.kind === 'village') press.push(`It goes with ${placeName(h.seat)}: retake or regain that, and your liege grants its villages again (you first).`);
    else {
      const siege = CL.rights.may(c, PLAYER, 'besiege', sid);
      press.push(siege.ok ? `Retake it by siege: ${f ? (backing(c, sid).ok ? 'your liege would back your claim, and it would be yours again' : `it would fall to your liege (${backing(c, sid).why.toLowerCase()})`) : 'as an independent, at the cost of attacking its realm'}.` : `Retake it by siege: not now (${siege.why.charAt(0).toLowerCase()}${siege.why.slice(1)}).`);
      if (h.sovereign === f && h.holder === R().rulerOf(f, c)) press.push('Your liege holds it: the crown will offer it to you as a grant.');
    }
    if (k.pressed != null && c.day < k.pressed) press.push(`Your liege presses it in their war until day ${CL.party.dayNumber(k.pressed)}.`);
    if (k.serveUntil != null) press.push(`You serve the ${factionName(k.serveRealm)} for it: ${k.serveWins || 0} of ${RULES.serve.wins} battles won against their enemies, by day ${CL.party.dayNumber(k.serveUntil)}.`);
    return { title: placeName(sid), lines: [...lines, ...press], liege: canAskLiege(c, sid), buy: canBuyBack(c, sid), serve: canServeBack(c, sid) };
  }

  /** Day by day: a claim on land your liege's crown holds becomes a grant offered to you. */
  function tick(c) {
    // P9-L1: a service for a fort runs out, or can no longer be done (the conditions of buying it back).
    for (const { sid, claim: k } of mine(c)) {
      if (k.serveUntil == null) continue;
      if (c.day >= k.serveUntil) endService(c, sid, false, 'the season ran out');
      else {
        const h = c.holdings[sid];
        if (h.controller !== k.serveRealm || !liege(c) || R().relation(c, liege(c), k.serveRealm) === 'war') endService(c, sid, false, 'things have changed');
      }
    }
    const f = liege(c);
    if (!f || !CL.fiefs) return;
    for (const { sid } of mine(c)) {
      const h = c.holdings[sid];
      if (h.sovereign !== f || h.controller !== f || h.holder !== R().rulerOf(f, c)) continue;
      if ((c.grants || []).some((g) => g.sid === sid) || claimOf(c, sid).offered) continue; // offered once: declined, it goes elsewhere
      if (R().fiefsOf(PLAYER, c).length >= R().FIEF_CAP || R().locked(c, sid) || (h.seat && R().locked(c, h.seat))) continue;
      const g = CL.fiefs.offer(c, sid, PLAYER);
      if (!g) continue;
      claimOf(c, sid).offered = true;
      CL.diag.log('info', 'Claim becomes a grant', { holding: sid });
    }
  }

  /**
   * Prototype D's start (design §28.1; the Debug panel and tests/slow/prototype-d.test.js): you are a
   * sworn vassal of a realm holding a fort and its village, with a warband of 12 and a mill there, at
   * home elsewhere; an enemy realm goes to war and its lords gather against the fort. The world's data
   * names them (`prototypeD`: in the Sundered Realm, Westholt Castle and Ashby for Valedorn, Hrothmark).
   * Test values only: it sets the state directly. Returns what it set, or null if it could not.
   */
  function prototypeD(c) {
    const def = CL.world.map().prototypeD; // this world's choice of places and realms (data/world_map.js)
    if (!def) return null;
    const { fort, village, enemy, realm: f } = def;
    if (!c.holdings?.[fort] || !c.holdings[village] || !R().isRealm(enemy) || !R().isRealm(f)) return null;
    CL.story.state(c).flags.ending ||= f; // the sandbox after the story, so wars can come
    const a = CL.allegiance.state(c);
    Object.assign(a, { kind: 'vassal', realm: f, since: c.day, until: null, serviceDays: 30, summonsMissed: 0, window: { start: c.day, days: 10 }, nextPay: null, served: null, lastOath: c.day });
    R().adjust(c, f, Math.max(0, 30 - (c.reputation[f] || 0)), 'prototype D');
    for (const sid of [fort, village]) if (R().holderOf(sid, c) !== PLAYER) R().transfer(c, sid, { holder: PLAYER, willing: true, reason: 'prototype D' });
    const troops = ['footman', 'footman', 'hunter', 'footman', 'levy', 'hunter', 'footman', 'footman', 'hunter', 'levy', 'footman', 'hunter'];
    while (c.roster.length < 12) CL.save.addSoldier(c, troops[c.roster.length]);
    c.gold = Math.max(c.gold, 1500);
    c.food = Math.max(c.food, 120);
    if (!CL.business.get(c)) CL.business.buy(c, village) || CL.business.buy(c, def.home);
    const home = place(def.home);
    Object.assign(c.world, { x: home.mapX, y: home.mapY, location: def.home });
    R().setRelation(c, f, enemy, 'war', 'prototype D');
    CL.lords.ensure(c, c.day, true);
    const w = place(fort);
    for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === enemy)) Object.assign(q, { x: w.mapX + 4, y: w.mapY - 4, tx: null, ty: null, troops: CL.lords.troopsFor(c, q.lordId), intent: 'campaign' });
    const s = CL.sieges.plan(c, enemy, fort);
    return { fort, village, enemy, siege: s?.sid || null, mill: CL.business.get(c)?.place || null };
  }

  CL.claims = { RULES, LOSSES, prototypeD, mine, claimOf, howWords, backing, canAskLiege, askLiege, pressedFor, canBuyBack, buyBack, canServeBack, serveBack, endService, afterBattle, onAttack, restoreVillages, onRetake, handBack, card, tick };
})(typeof window !== 'undefined' ? window : globalThis);
