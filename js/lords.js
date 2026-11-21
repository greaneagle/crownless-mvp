/* Crownless lords on the map (P8-01, design §16, §20.6): every free lord of the realms rides with their
 * household as a world party (kind 'lord', `lordId`), met, fought, captured and ransomed.
 *
 * - A party a lord: formed at their home (their seat, or for the landless their kin's seat or the
 *   capital; a capital when that home is lost), sized by what they hold now (landless 12, a village
 *   16, a fort or town 21, 3 more for each further fief), of the realm's own troops, the share of
 *   veterans rising with their standing. The lord fights in person, as the realm's best foot soldier
 *   with their name. Rulers keep to their halls.
 * - Intentions (chosen by the world simulation, js/parties.js): ride the bounds of their lands
 *   (landed), campaign along the realm's borders or ride with a kinsman (landless), hunt Reavers near
 *   them, ride against a realm at odds with theirs, chase a company their realm counts Hostile, and
 *   go home to refill when the ranks are thin.
 * - Captives (`c.prisoners`): a lord beaten by the player is the player's prisoner. Their kin with land
 *   (else their realm) offer a ransom after 2–4 days: 100 crowns and 25 a soldier they led. The player
 *   accepts, holds (another offer in 2–4 days) or releases them for nothing (renown, and the lord's
 *   goodwill, kept for P8-07). A held lord may escape: 3% a day, 8% while the company is under 6
 *   soldiers. Beaten while holding prisoners, the player loses them. A lord beaten off-screen by a
 *   realm's soldiers is that realm's prisoner and comes home in 5–15 days. A free lord without a party
 *   forms one again at home.
 * - `deeds` on a person: what the player did to them or their kin (freed, ransomed, held), for P8-07. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SIZE = { landless: 12, village: 16, seat: 21, perExtra: 3 };
  // The share of each tier by standing (a description of what they hold, never stored).
  const MIX = {
    landless: { T1: 0.5, T2: 0.4, T3: 0.1 },
    lesser: { T1: 0.4, T2: 0.45, T3: 0.15 },
    great: { T1: 0.25, T2: 0.5, T3: 0.25 },
  };
  const RANSOM = { base: 100, perTroop: 25, offerDays: [2, 4], escape: 0.03, escapeWeak: 0.08, weakBelow: 6, freedRenown: 5 };
  const AWAY_DAYS = [5, 15]; // a lord held off-screen by a realm comes home after this long
  const REGROUP = 0.4; // a lord back from captivity or defeat rides out with this share of their ranks
  const LEADER = { hp: 2, damage: 1.35 };
  const REFILL_COST = 3; // crowns a man, from a landed lord's fiefs (P8-05) // the lord in battle: their realm's best foot soldier, stronger
  const DEEDS_MAX = 12;
  const PRISONERS_MAX = 40;
  const WORDS = {
    patrol: 'riding the bounds of their lands',
    campaign: 'on campaign along the realm’s borders',
    hunt: 'hunting Reavers',
    clash: 'riding against soldiers of a realm at odds with theirs',
    home: 'riding home to refill the ranks',
    rest: 'resting at home',
    chase: 'riding for you!',
    search: 'searching for you where they lost you',
    gather: 'gathering for a siege',
    besiege: 'besieging',
    relief: 'riding to relieve a besieged fort',
    escort: 'riding with you',
  };

  const R = () => CL.realm;
  const A = () => CL.autoresolve;
  const place = (id) => (typeof id === 'string' && CL.content.table('settlements')[id]) || null;
  const placeName = (id) => place(id)?.name || 'home';
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'their realm';
  const troopCount = (troops) => Object.values(troops || {}).reduce((a, b) => a + b, 0);
  const isLordParty = (p) => typeof p?.lordId === 'string';

  /** This world's lord party template for a realm, or null (a realm with no lords' template rides none). */
  const templateFor = (f) => Object.values(CL.content.table('party_templates')).find((t) => t.kind === 'lord' && t.faction === f) || null;
  /** The party a lord rides with, or null. @param {Campaign} c @param {string} pid */
  const partyOf = (c, pid) => (c.parties || []).find((p) => p.lordId === pid) || null;
  /** The lords who ride: every person of a realm with a lords' template, not a ruler. */
  const riders = (c) => Object.keys(c.people || {}).filter((id) => !R().rules(id, c) && templateFor(c.people[id].realm));

  /** Where a lord forms up and refills: their home, unless another realm holds it, then the capital. */
  function homeOf(c, pid) {
    const p = c.people[pid];
    const own = (sid) => place(sid) && R().owner(sid, c) === p.realm;
    if (!own(p.home)) {
      const fief = R().fiefsOf(pid, c).find(own);
      p.home = fief || R().capitalOf(p.realm) || p.home; // a lost home: their seat if they have one, else the capital
    }
    return p.home;
  }

  /** How many soldiers a lord leads at full strength: by what they hold now. */
  function sizeFor(c, pid) {
    const fiefs = R().fiefsOf(pid, c);
    if (!fiefs.length) return SIZE.landless;
    const seat = fiefs.some((sid) => c.holdings[sid].kind !== 'village');
    return (seat ? SIZE.seat : SIZE.village) + SIZE.perExtra * (fiefs.length - 1);
  }

  /** The realm's troops by tier: T1 its first, T2 and T3 its foot, archers and (T3) horse. */
  function ranks(f) {
    const all = Object.values(CL.content.table('troops')).filter((t) => t.faction === f && t.id !== 'hero');
    const by = (tier) => all.filter((t) => t.tier === tier).map((t) => t.id);
    return { T1: by('T1'), T2: by('T2'), T3: by('T3') };
  }

  /** A lord's troops at `share` of full strength: the realm's ranks, mixed by standing. */
  function troopsFor(c, pid, share = 1) {
    const p = c.people[pid];
    const n = Math.max(1, Math.round(sizeFor(c, pid) * share));
    const mix = MIX[R().standingOf(pid, c)];
    const pool = ranks(p.realm);
    const troops = {};
    let left = n;
    for (const tier of ['T3', 'T2', 'T1']) {
      const ids = pool[tier].length ? pool[tier] : pool.T1.length ? pool.T1 : pool.T2;
      let k = tier === 'T1' ? left : Math.min(left, Math.round(n * mix[tier]));
      left -= k;
      for (let i = 0; k > 0; i = (i + 1) % ids.length, k--) troops[ids[i]] = (troops[ids[i]] || 0) + 1;
    }
    return troops;
  }

  /** Form a lord's party at their home. */
  function spawn(c, pid, share = 1) {
    const t = templateFor(c.people[pid].realm);
    const home = place(homeOf(c, pid));
    // In the order a loaded save keeps them (js/parties.js sanitize), so a round trip changes nothing.
    const p = { id: c.nextPartyId++, template: t.id, x: home.mapX, y: home.mapY, troops: troopsFor(c, pid, share), tx: null, ty: null, ignoreUntil: 0, alerted: false, lordId: pid, intent: share < 1 ? 'home' : 'rest' };
    c.parties.push(p);
    CL.diag.log('info', 'Lord rides out', { lord: pid, party: p.id, troops: troopCount(p.troops) });
    return p;
  }

  /** Every free lord without a party forms one (their template's spawn timer allowing: tests switch them off). */
  function ensure(c, now = c.day, ignoreTimers = false) {
    if (!c.people || !Array.isArray(c.parties)) return;
    for (const pid of riders(c)) {
      const person = c.people[pid];
      const t = templateFor(person.realm);
      if (person.status !== 'free' || partyOf(c, pid)) continue;
      if (!ignoreTimers && now < (c.partySpawns?.[t.id] || 0)) continue;
      spawn(c, pid, person.regroup ? REGROUP : 1);
      delete person.regroup;
    }
  }

  /** Back home with thin ranks: the household refills to full strength. */
  function refill(c, p) {
    const full = troopsFor(c, p.lordId);
    const need = troopCount(full) - troopCount(p.troops);
    if (need <= 0) return;
    // P8-05: a landed lord pays for their men from their fiefs' treasuries (3 crowns a man); the landless
    // are kept by their kin and the crown. What they can't pay for, they ride without.
    const land = R().fiefsOf(p.lordId, c);
    if (!land.length || !CL.fiefs) {
      p.troops = full;
      return;
    }
    let afford = 0;
    for (const sid of land) {
      const h = c.holdings[sid];
      const n = Math.min(need - afford, Math.floor((h.treasury || 0) / REFILL_COST));
      h.treasury -= n * REFILL_COST;
      afford += n;
      if (afford >= need) break;
    }
    const share = (troopCount(p.troops) + afford) / troopCount(full);
    p.troops = afford >= need ? full : troopsFor(c, p.lordId, Math.max(share, troopCount(p.troops) / troopCount(full)));
  }

  /** Too few to ride on with: below half of full strength. */
  const thin = (c, p) => troopCount(p.troops) < sizeFor(c, p.lordId) * 0.5;

  // ---- Words ----

  /** "Lord Hamon Greymantle, holder of Greywall Fort and Highmere", or for the landless their kin or liege. */
  function whoLine(c, pid) {
    const p = c.people[pid];
    const fiefs = R().fiefsOf(pid, c).map(placeName);
    const name = R().titled(pid, c);
    if (fiefs.length) return `${name}, holder of ${fiefs.length > 1 ? `${fiefs.slice(0, -1).join(', ')} and ${fiefs.at(-1)}` : fiefs[0]}`;
    const kin = p.kin.find((k) => R().fiefsOf(k.person, c).length || R().rules(k.person, c));
    if (kin) return `${name}, ${R().titled(kin.person, c)}’s ${R().tieWord(kin.tie === 'parent' ? 'child' : kin.tie === 'child' ? 'parent' : kin.tie, p)}, landless`;
    return `${name}, sworn to ${R().titled(R().rulerOf(p.realm, c), c)}, landless`;
  }

  /** What a lord's party is doing, in words ("riding home to refill the ranks"). */
  function doingLine(c, p) {
    if (p.intent === 'rest') return `resting at ${placeName(c.people[p.lordId].home)}`;
    if (p.intent === 'ride' && p.kin) return `riding with ${R().titled(p.kin, c)}`;
    return WORDS[p.intent] || WORDS.campaign;
  }

  /** The tap card's lines: who, what they're doing, and their top need (P8-07). */
  const describe = (c, p) => ({ who: whoLine(c, p.lordId), doing: doingLine(c, p), need: CL.nobles?.needLine(c, p.lordId) || '' });

  // ---- Deeds (kept for P8-07) ----

  function deed(c, pid, kind, by = 'player') {
    const p = c.people[pid];
    if (!p) return;
    p.deeds = [...(p.deeds || []), { by, kind, day: c.day }].slice(-DEEDS_MAX);
    CL.nobles?.note(c, pid, by, kind); // and what they think of it (P8-07)
  }

  // ---- Captives ----

  const prisoners = (c) => (c.prisoners ||= []);
  const prisonerOf = (c, pid) => prisoners(c).find((x) => x.lord === pid) || null;
  const roll = (c, [lo, hi]) => lo + A().next(c) * (hi - lo);

  /**
   * A lord's party is beaten (by the player, `by: 'player'`; by a realm's soldiers, `by` that realm;
   * by Reavers, `by: null`, and the lord gets away). Their party is gone; the lord is a captive or
   * rides home to regroup. Returns the prisoner record, or null.
   */
  function beaten(c, p, by, day = c.day) {
    const pid = p.lordId;
    const person = c.people[pid];
    const led = troopCount(p.troops) + (p.fallen || 0);
    const i = c.parties.indexOf(p);
    if (i >= 0) c.parties.splice(i, 1);
    if (!person || person.status === 'captive') return null;
    const at = { x: p.x, y: p.y, faction: person.realm, text: '' };
    if (by === 'player' || R().isRealm(by)) {
      if (by === 'player') CL.nobles?.note(c, pid, 'player', 'beat'); // beaten in the field (P8-07)
      Object.assign(person, { status: 'captive', heldBy: by });
      /** @type {any} */
      const x = { lord: pid, by, since: day, led: Math.max(1, led), offerDay: null, offered: false, checked: Math.floor(day), release: null };
      if (by === 'player') x.offerDay = day + roll(c, RANSOM.offerDays);
      else x.release = day + roll(c, AWAY_DAYS);
      prisoners(c).push(x);
      CL.news?.record(c, 'lord_captured', { ...at, text: `${R().titled(pid, c)} has been taken prisoner by ${by === 'player' ? CL.campaign?.character?.name || 'a free company' : `the ${factionName(by)}`}.` }, day);
      CL.diag.log('info', 'Lord captured', { lord: pid, by });
      return x;
    }
    // Beaten by Reavers: they get away and ride out again from home with what is left.
    person.regroup = true;
    CL.news?.record(c, 'lord_beaten', { ...at, text: `Reavers have broken ${R().titled(pid, c)}’s household on the road.` }, day);
    return null;
  }

  /** What their ransom is: 100 crowns and 25 for each soldier they led. */
  const ransomOf = (x) => RANSOM.base + RANSOM.perTroop * x.led;

  /** Who pays for a lord: a kinsman with land, else their realm's ruler. */
  function payerOf(c, pid) {
    const p = c.people[pid];
    const kin = p.kin.find((k) => c.people[k.person]?.status === 'free' && (R().fiefsOf(k.person, c).length || R().rules(k.person, c)));
    return kin?.person || R().rulerOf(p.realm, c);
  }

  /** The offer due now (for the message with Accept, Hold and Release), or null. */
  function offerDue(c) {
    return prisoners(c).find((x) => x.by === 'player' && x.offerDay != null && c.day >= x.offerDay) || null;
  }

  /** The words of an offer. */
  function offerText(c, x) {
    const payer = payerOf(c, x.lord);
    const lord = c.people[x.lord];
    const tie = lord.kin.find((k) => k.person === payer)?.tie;
    const their = c.people[payer]?.gender === 'female' ? 'her' : 'his'; // the payer's: "for his wife"
    const whose = tie ? `${their} ${R().tieWord(tie === 'parent' ? 'child' : tie === 'child' ? 'parent' : tie, lord)}` : `${their} sworn ${lord.gender === 'female' ? 'lady' : 'lord'}`;
    return `${R().titled(payer, c)} offers ${ransomOf(x)} crowns for ${whose}, ${R().titled(x.lord, c)}, your prisoner since day ${CL.party.dayNumber(x.since)}.`;
  }

  /** Free a captive: they go home and ride out again with a share of their ranks. */
  function free(c, x, news = null) {
    const person = c.people[x.lord];
    const list = prisoners(c);
    const i = list.indexOf(x);
    if (i < 0) return false;
    list.splice(i, 1);
    if (person) {
      Object.assign(person, { status: 'free', heldBy: null, regroup: true });
      if (news) CL.news?.record(c, 'lord_ransomed', { place: homeOf(c, x.lord), faction: person.realm, text: news }, c.day);
    }
    return true;
  }

  /**
   * The player answers an offer: 'accept' (paid, and they go), 'hold' (they stay; another offer in
   * 2–4 days) or 'release' (free for nothing: renown, and their goodwill). Once only per offer.
   */
  function answer(c, pid, choice) {
    const x = prisonerOf(c, pid);
    if (x?.by !== 'player' || x.offerDay == null || c.day < x.offerDay) return null;
    const name = R().titled(pid, c);
    if (choice === 'accept') {
      const n = ransomOf(x);
      const payer = payerOf(c, pid);
      CL.accounts.earn(c, n, `ransom for ${name}`);
      deed(c, pid, 'ransomed');
      if (payer !== pid) deed(c, payer, 'held_kin'); // a kinsman remembers who held them (P8-07)
      free(c, x, `${name} is home again, ransomed for ${n} crowns.`);
      const text = `${name} is ransomed for ${n} crowns.`;
      CL.ui.message(text);
      return { choice, gold: n, text };
    }
    if (choice === 'release') {
      c.renown += RANSOM.freedRenown;
      deed(c, pid, 'freed');
      free(c, x, `${name} is home again, freed without ransom.`);
      const text = `You let ${name} go without a ransom. Word of it travels (+${RANSOM.freedRenown} renown).`;
      CL.ui.message(text);
      return { choice, renown: RANSOM.freedRenown, text };
    }
    if (choice === 'hold') {
      x.offerDay = c.day + roll(c, RANSOM.offerDays);
      deed(c, pid, 'held');
      return { choice, nextOffer: x.offerDay, text: `You keep ${name}. Their kin will write again.` };
    }
    return null;
  }

  /** The player is beaten while holding prisoners: they go free in the confusion. */
  function loseAll(c) {
    const held = prisoners(c).filter((x) => x.by === 'player');
    for (const x of held) free(c, x, `${R().titled(x.lord, c)} got free when their captors were beaten.`);
    return held.map((x) => x.lord);
  }

  /** Day by day: held lords may escape; lords held off-screen come home. */
  function tick(c) {
    for (const x of [...prisoners(c)]) {
      if (x.by !== 'player') {
        if (c.day >= x.release) free(c, x, `${R().titled(x.lord, c)} is home again, ransomed by their own.`);
        continue;
      }
      while (x.checked < Math.floor(c.day)) {
        x.checked++;
        const chance = c.roster.length < RANSOM.weakBelow ? RANSOM.escapeWeak : RANSOM.escape;
        if (A().next(c) < chance) {
          const name = R().titled(x.lord, c);
          free(c, x, `${name} escaped from captivity.`);
          CL.ui.message(`${name} has escaped in the night!`);
          break;
        }
      }
    }
    ensure(c);
    if (offerDue(c) && CL.game.mode === 'map') CL.ui.openRansom?.();
    else if (CL.fiefs?.grantDue(c) && CL.game.mode === 'map') CL.ui.openGrant?.();
    else if (CL.game.mode === 'map') for (const s of CL.sieges?.list(c) || []) if (s.alarmed && !s.alarmSeen && CL.realm.holderOf(s.sid, c) === 'player') {
      s.alarmSeen = true; // shown once, on the map
      CL.ui.openSiegeAlarm?.(s.sid);
      break;
    }
  }

  /** Captured by a lord: the hero is ransomed and let go at that lord's home. Returns the lord's id, or null. */
  function captorOf(c) {
    const g = CL.game;
    const p = g.partyId != null ? CL.parties.find(c, g.partyId) : null;
    return isLordParty(p) ? p.lordId : null;
  }

  /** The lord in battle: the realm's best foot soldier, with their name and more of everything. */
  function leaderFor(c, p) {
    const t = CL.content.get('party_templates', p.template);
    return { troop: t.leader, name: R().titled(p.lordId, c), hp: LEADER.hp, damage: LEADER.damage };
  }

  /** What breaks the lords' rules (P8-01), for the daily invariants: [] when all hold. */
  function invariants(c) {
    const out = [];
    const seen = new Set();
    for (const p of c.parties || []) {
      if (!isLordParty(p)) continue;
      const who = c.people?.[p.lordId];
      if (!who) out.push(`party ${p.id}: no such lord ${p.lordId}`);
      else if (who.status === 'captive') out.push(`${p.lordId}: captive and on the map`);
      if (seen.has(p.lordId)) out.push(`${p.lordId}: rides with two parties`);
      if (R().rules(p.lordId, c)) out.push(`${p.lordId}: a ruler riding`);
      seen.add(p.lordId);
    }
    const held = new Set();
    for (const x of prisoners(c)) {
      if (held.has(x.lord)) out.push(`${x.lord}: held twice`);
      held.add(x.lord);
      if (c.people?.[x.lord]?.status !== 'captive' || c.people[x.lord].heldBy !== x.by) out.push(`${x.lord}: a prisoner record that doesn't match`);
    }
    for (const [id, p] of Object.entries(c.people || {})) if (p.status === 'captive' && !held.has(id)) out.push(`${id}: captive with no record`);
    return out;
  }

  // ---- Saves ----

  /** Repair the prisoners (after people and parties). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    s.prisoners = [];
    const seen = new Set();
    for (const x of Array.isArray(d?.prisoners) ? d.prisoners.slice(0, PRISONERS_MAX) : []) {
      const p = s.people?.[x?.lord];
      if (!p || seen.has(x.lord) || R().rules(x.lord, s) || !(x.by === 'player' || R().isRealm(x.by)) || x.by === p.realm) continue;
      if (s.parties.some((q) => q.lordId === x.lord)) continue; // never both captive and on the map
      seen.add(x.lord);
      s.prisoners.push({
        lord: x.lord,
        by: x.by,
        since: num(x.since) ? x.since : s.day,
        led: Math.max(1, Math.min(99, Math.floor(num(x.led) ? x.led : 1))),
        offerDay: x.by === 'player' ? (num(x.offerDay) ? x.offerDay : s.day + RANSOM.offerDays[0]) : null,
        offered: false,
        checked: Math.floor(num(x.checked) ? x.checked : s.day),
        release: x.by === 'player' ? null : num(x.release) ? x.release : s.day + AWAY_DAYS[0],
      });
      Object.assign(p, { status: 'captive', heldBy: x.by });
    }
    // Nobody is a captive without a record of it.
    for (const [id, p] of Object.entries(s.people || {})) if (p.status === 'captive' && !seen.has(id)) Object.assign(p, { status: 'free', heldBy: null });
  }

  CL.lords = {
    SIZE,
    MIX,
    RANSOM,
    AWAY_DAYS,
    REGROUP,
    LEADER,
    WORDS,
    isLordParty,
    templateFor,
    partyOf,
    riders,
    homeOf,
    sizeFor,
    troopsFor,
    spawn,
    ensure,
    refill,
    thin,
    whoLine,
    doingLine,
    describe,
    deed,
    prisoners,
    prisonerOf,
    beaten,
    ransomOf,
    payerOf,
    offerDue,
    offerText,
    answer,
    loseAll,
    tick,
    captorOf,
    leaderFor,
    invariants,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
