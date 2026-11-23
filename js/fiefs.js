/* Crownless fiefs and castellans (P8-05, design §17.2, decisions D-P8d, D-P8f): what a holding gives and
 * costs, who runs it, the crown's grants, and the conqueror's choice.
 *
 * - **Every holding runs the same weekly rules** (the AI's and the crown's too), on the payday:
 *   - tax: base × prosperity / 50 × the tax stance (light ×0.7, normal ×1, heavy ×1.4), nothing over 80 unrest;
 *   - costs: a fort's garrison (a third of each soldier's wage), a village's militia, the steward,
 *     repairs while the walls are down;
 *   - the liege's due: 10% of the tax to the crown, once a week;
 *   - a fort's garrison refills from its realm's recruits toward its target, three a week, at half
 *     their hire cost; a village's militia by one;
 *   - prosperity and unrest drift with the tax stance; an unpaid garrison raises unrest.
 *   Wages are paid only from what is there: never below nothing. Unpaid twice (two warnings), a
 *   fort's garrison deserts, one soldier a day, until paid.
 * - **Money:** a fief of yours keeps its money in the account `budget:fief_<id>` with its own book
 *   (as the mill does, P7-10); everyone else's in the holding's `treasury`. You put money in or draw it
 *   out at the holding (CL.rights: `drawTreasury`). Each week your fiefs' reports make one line.
 * - **Who runs it:** for your fiefs, the default steward (forts, 6 crowns a week) or reeve (villages,
 *   free), or a castellan from your veterans (as a detachment's captain, P7-05), who leaves the company
 *   while serving and comes back the next time you are at the holding after you dismiss them, or at
 *   once when the holding is lost.
 * - **Policies** (a balanced default): garrison target (light 12, normal 22, strong 32), tax stance,
 *   food reserve (days, for P8-06a), repairs on or off.
 * - **Grants:** the crown grants what it holds and has to give (land taken from someone, land of a lord
 *   held unransomed 30 days, land left by a vassal who left the realm) within a few days. Candidates in
 *   order: who did most in its taking (a conqueror who asked, or the lord they suggested); landless
 *   lords, kin of the realm's lords first; lords with fewer fiefs; service days and renown. You are a
 *   candidate as a sworn vassal (a fort needs 300 renown and 30 days of service); the AI's lords compete.
 *   A vassal of long service (60 days) with no land may be given one of the crown's own villages.
 *   Nobody holds more than three fiefs; a story fort and its villages are never granted before Q4 ends.
 *   Your grant comes as a message with Accept or Decline; declined, it goes to the next candidate.
 * - **The conqueror's choice** (D-P8f): whoever takes a fief, if not its ruler, asks the liege for it,
 *   suggests someone (a granted suggestion is remembered by that lord), hands it to the ruler outright
 *   (influence with the ruler, `c.influence`, for P8-07 to spend), or keeps it (the ruler accepts, or
 *   casts out the taker). You get one prompt, "ask the liege" by default; AI lords ask (P8-07 decides). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    tax: { village: 30, fort: 80, town: 120 }, // P8-T: a fort pays for itself on the defaults (about +10 a week)
    stance: { light: 0.7, normal: 1, heavy: 1.4 },
    garrisonTarget: { light: 12, normal: 22, strong: 32 },
    garrisonWage: 1 / 3, // of each soldier's weekly wage
    refillPerWeek: 3,
    refillCost: 0.5, // of the troop's hire cost
    militia: { size: 6, wage: 5, refill: 3 },
    steward: 6, // crowns a week (the reeve is free)
    due: 0.1,
    repairs: { cost: 10, mend: 15 },
    drift: { light: { prosperity: 1, unrest: -3 }, normal: { prosperity: 0, unrest: -1 }, heavy: { prosperity: -1, unrest: 5 } },
    unrest: { start: 20, warn: 60, stop: 80, unpaid: 10, rest: 20 },
    prosperity: { village: 50, fort: 50, town: 60 }, // P8-T: forts from 40
    warnings: 2,
    grantDays: [2, 4],
    heldDays: 30, // a lord held unransomed this long loses their land to the crown
    fort: { renown: 300, serviceDays: 30 }, // for the player to be granted a fort
    longService: 30, // a landless vassal's service days before the crown gives one of its own villages (P8-T: from 60, so it comes within a season)
    startWeeks: 4, // a holding's treasury at the start: this many weeks of its tax
    reportsMax: 6,
    bookMax: 60,
    grantsMax: 20,
  };
  const STANCES = ['light', 'normal', 'heavy'];
  const GARRISONS = ['light', 'normal', 'strong'];
  const CHOICES = ['ask', 'suggest', 'hand', 'keep'];

  const R = () => CL.realm;
  const PLAYER = 'player';
  const place = (id) => CL.content.table('settlements')[id] || null;
  const placeName = (id) => place(id)?.name || id;
  const troop = (id) => CL.content.table('troops')[id];
  const count = (t) => Object.values(t || {}).reduce((a, b) => a + b, 0);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const FULL = 100; // prosperity, unrest and walls run from 0 to this
  const A = () => CL.accounts;

  const account = (sid) => `budget:fief_${sid}`;
  const accountOf = (acct) => (typeof acct === 'string' && acct.startsWith('budget:fief_') ? acct.slice(12) : null);
  const mine = (c, sid) => R().holderOf(sid, c) === PLAYER;
  /** Your fiefs. */
  const fiefs = (c) => R().fiefsOf(PLAYER, c);

  /** P9-01: the ruler's own land is the crown's: its tax and costs are the realm's treasury. */
  const crownLand = (c, sid) => Boolean(CL.crowns?.crownLand(c, sid));

  /** A holding's money now: your fief's account, the crown's treasury, or its own. */
  const cash = (c, sid) => (mine(c, sid) ? A().balance(c, account(sid)) : crownLand(c, sid) ? CL.crowns.balance(c, sid) : R().holding(sid, c)?.treasury || 0);

  /** Spend from a holding, only what is there. Returns what was paid. `line`: the crown's book line. */
  function pay(c, sid, n, why, line = 'wages') {
    const h = R().holding(sid, c);
    const amount = Math.min(Math.floor(n), Math.floor(cash(c, sid)));
    if (amount <= 0) return 0;
    if (crownLand(c, sid)) CL.crowns.pay(c, sid, 'world', amount, line);
    else if (mine(c, sid)) A().transfer(c, account(sid), 'world', amount, why);
    else h.treasury -= amount;
    return amount;
  }
  function receive(c, sid, n, why) {
    const h = R().holding(sid, c);
    const amount = Math.floor(n);
    if (amount <= 0) return 0;
    if (crownLand(c, sid)) CL.crowns.pay(c, 'world', sid, amount, 'tax');
    else if (mine(c, sid)) A().transfer(c, 'world', account(sid), amount, why);
    else h.treasury += amount;
    return amount;
  }

  /** The book of a fief of yours, for a transfer touching its account (js/accounts.js), or null. */
  function bookFor(c, from, to) {
    const sid = accountOf(from) || accountOf(to);
    const h = sid ? R().holding(sid, c) : null;
    if (!h) return null;
    h.book ||= [];
    if (h.book.length >= RULES.bookMax) h.book.splice(0, h.book.length - RULES.bookMax + 1);
    return h.book;
  }
  const label = (acct) => (accountOf(acct) ? `${placeName(accountOf(acct))}'s treasury` : null);

  // ---- A holding's state ----

  /** The default policies: balanced. */
  const policies = () => ({ garrison: 'normal', tax: 'normal', food: 14, repairs: true });

  /** A fort's starting garrison: its own, from the content (or its controller's standard one). */
  function startGarrison(sid, c) {
    const s = place(sid);
    if (s?.type !== 'fort') return null;
    const base = R().owner(sid, c) === s.ownerFaction ? s.garrison : CL.realm.faction(R().owner(sid, c))?.garrison || s.garrison || {};
    const k = garrisonScale();
    return Object.fromEntries(Object.entries(base).map(([id, n]) => [id, Math.max(1, Math.round(n * k))]));
  }

  /**
   * P9-B3: the world's garrisons (data/world_map.js `armies.garrisons`): the target and the weekly
   * refill grow by it, and each soldier draws that much less of a wage, so a fort's book is as before.
   */
  const garrisonScale = () => CL.world.armies().garrisons;
  const garrisonTarget = (h) => Math.round(RULES.garrisonTarget[h.policies.garrison] * garrisonScale());
  const garrisonWage = () => RULES.garrisonWage / garrisonScale();
  const refillPerWeek = () => Math.round(RULES.refillPerWeek * garrisonScale());

  /** Fill in a holding's running state where it has none (new games, old saves). */
  function ensure(c, sid) {
    const h = R().holding(sid, c);
    if (!h || h.prosperity != null) return h;
    Object.assign(h, {
      prosperity: RULES.prosperity[h.kind] ?? 50,
      unrest: RULES.unrest.start,
      garrison: h.kind === 'fort' ? startGarrison(sid, c) : null,
      militia: h.kind === 'village' ? RULES.militia.size : null,
      policies: policies(),
      walls: h.kind === 'fort' ? FULL : null,
      food: h.kind === 'fort' ? 14 : null, // days of food in the stores (P8-06a): the food policy's
      treasury: RULES.startWeeks * RULES.tax[h.kind], // a few weeks of its tax in hand
      unpaid: 0,
      deserting: false,
      dueWeek: null,
      report: null,
      reports: [],
      book: [],
      castellan: null,
    });
    return h;
  }
  function ensureAll(c) {
    for (const sid of Object.keys(c.holdings || {})) ensure(c, sid);
  }

  /** Who runs it, in words. */
  function adminName(c, sid) {
    const h = R().holding(sid, c);
    if (h.castellan) return `Castellan ${h.castellan.name}`;
    if (h.holder !== PLAYER) return h.kind === 'town' ? 'the crown’s officers' : `${R().titled(h.holder, c)}’s household`;
    return h.kind === 'fort' ? 'the steward' : h.kind === 'village' ? 'the reeve' : 'the officers';
  }

  // ---- The week ----

  /** One holding's week: tax, costs, due, refill, drift. Returns its report. */
  function week(c, sid, weekNo) {
    const h = ensure(c, sid);
    const p = h.policies;
    const r = { day: c.day, tax: 0, wages: 0, due: 0, repairs: 0, steward: 0, refill: 0, unpaid: 0, deserted: 0 };
    const stop = h.unrest > RULES.unrest.stop;
    r.tax = stop ? 0 : Math.round(RULES.tax[h.kind] * (h.prosperity / 50) * RULES.stance[p.tax]);
    receive(c, sid, r.tax, `tax of ${placeName(sid)}`);
    // The liege's due: once a week, into the crown's treasury (P9-01: the law's share), not from its own land.
    if (h.dueWeek !== weekNo && R().rulerOf(h.sovereign, c) !== h.holder) {
      const owed = CL.crowns ? CL.crowns.due(c, h.sovereign, r.tax) : Math.round(r.tax * RULES.due);
      r.due = CL.crowns ? CL.crowns.pay(c, sid, CL.crowns.side(h.sovereign), Math.min(owed, Math.floor(cash(c, sid))), 'due', { text: `the crown's due from ${placeName(sid)}` }) : pay(c, sid, owed, `the crown's due from ${placeName(sid)}`);
      h.dueWeek = weekNo;
    }
    // Wages: the garrison (forts) or militia (villages); the steward of a fort of yours.
    const owe = h.kind === 'fort' ? Math.round(Object.entries(h.garrison || {}).reduce((n, [id, k]) => n + (troop(id)?.wage || 0) * k, 0) * garrisonWage()) : h.kind === 'village' ? RULES.militia.wage : 0;
    r.wages = pay(c, sid, owe, `wages at ${placeName(sid)}`);
    r.unpaid = owe - r.wages;
    if (mine(c, sid) && h.kind === 'fort' && !h.castellan) r.steward = pay(c, sid, RULES.steward, `the steward of ${placeName(sid)}`);
    if (h.kind === 'fort' && p.repairs && h.walls < 100) {
      r.repairs = pay(c, sid, RULES.repairs.cost, `repairs at ${placeName(sid)}`, 'repairs');
      if (r.repairs) h.walls = Math.min(100, h.walls + RULES.repairs.mend);
    }
    // Refill toward the target, from what is left.
    if (h.kind === 'fort' && !stop) r.refill = refillGarrison(c, sid);
    if (h.kind === 'village' && h.militia < RULES.militia.size && !stop && pay(c, sid, RULES.militia.refill, `militia at ${placeName(sid)}`, 'militia')) h.militia++;
    // Unpaid men: warnings, then desertion (forts), and unrest.
    if (r.unpaid > 0) {
      h.unpaid++;
      h.unrest = clamp(h.unrest + RULES.unrest.unpaid, 0, FULL);
      if (h.unpaid > RULES.warnings) h.deserting = true;
      if (mine(c, sid)) CL.ui.message(h.deserting ? `${placeName(sid)}: the garrison is unpaid and deserting. Put crowns in at the fort.` : `${placeName(sid)}: the garrison is owed ${r.unpaid} crowns (warning ${h.unpaid} of ${RULES.warnings}).`);
    } else {
      h.unpaid = 0;
      h.deserting = false;
    }
    const d = RULES.drift[p.tax];
    h.prosperity = clamp(h.prosperity + d.prosperity, 0, FULL);
    h.unrest = clamp(h.unrest + d.unrest, p.tax === 'normal' ? Math.min(h.unrest, RULES.unrest.rest) : 0, FULL);
    if (mine(c, sid) && h.unrest > RULES.unrest.warn && !stop) CL.ui.message(`${placeName(sid)} is restless (${h.unrest}): over ${RULES.unrest.stop} it pays and recruits nothing.`);
    r.cash = cash(c, sid);
    h.report = r;
    h.reports = [...(h.reports || []), r].slice(-RULES.reportsMax);
    return r;
  }

  /** Recruit toward the target, keeping the realm's garrison mix; returns the crowns spent. */
  function refillGarrison(c, sid) {
    const h = R().holding(sid, c);
    const target = garrisonTarget(h);
    const mix = CL.realm.faction(h.controller)?.garrison || {};
    let spent = 0;
    for (let i = 0; i < refillPerWeek() && count(h.garrison) < target; i++) {
      const pick = Object.keys(mix).sort((a, b) => (h.garrison[a] || 0) / mix[a] - (h.garrison[b] || 0) / mix[b])[0];
      if (!pick) break;
      const cost = Math.ceil((troop(pick)?.recruitCost || 20) * RULES.refillCost);
      if (!pay(c, sid, cost, `recruits for ${placeName(sid)}`, 'recruits')) break;
      spent += cost;
      h.garrison[pick] = (h.garrison[pick] || 0) + 1;
    }
    // Over the target (a lower policy): the extra are paid off.
    while (count(h.garrison) > target) {
      const most = Object.keys(h.garrison).sort((a, b) => h.garrison[b] - h.garrison[a])[0];
      h.garrison[most]--;
      if (!h.garrison[most]) delete h.garrison[most];
    }
    return spent;
  }

  /** The payday (js/upkeep.js): every holding's week, and your fiefs' one line. */
  function payday(c, day = c.day) {
    ensureAll(c);
    CL.founding?.stewardWeek(c); // P9-03: your steward's policy sets the tax on your own land
    const weekNo = Math.floor(day / 7);
    const mineNow = fiefs(c);
    CL.crowns?.ensure(c); // the realms' treasuries before the week's due (P9-01)
    for (const sid of Object.keys(c.holdings)) week(c, sid, weekNo);
    CL.crowns?.week(c); // a free city's trade, the offices' wages
    CL.diplomacy?.weekly(c, day); // tribute, treaties kept and run out, the realms' offers (P9-02)
    CL.founding?.weekly(c); // founded realms: the old crown's answer, recognition, AI lords declaring (P9-03)
    weeklyGrants(c, day);
    if (mineNow.length) {
      const parts = mineNow.map((sid) => {
        const r = R().holding(sid, c).report;
        const net = r.tax - r.due - r.wages - r.steward - r.repairs - r.refill;
        return `${placeName(sid)} ${net >= 0 ? '+' : '−'}${Math.abs(net)} (${r.cash} in hand)`;
      });
      const line = `Your fiefs this week: ${parts.join(' · ')}.`;
      CL.ui.message(line);
      return line;
    }
    return null;
  }

  /** Day by day: deserters, castellans home, grants due. */
  function tick(c) {
    ensureAll(c);
    for (const sid of Object.keys(c.holdings)) {
      const h = c.holdings[sid];
      const today = Math.floor(c.day);
      if (h.deserting && h.kind === 'fort' && h.desertDay !== today && count(h.garrison)) {
        h.desertDay = today;
        const who = Object.keys(h.garrison)[0];
        h.garrison[who]--;
        if (!h.garrison[who]) delete h.garrison[who];
        if (mine(c, sid)) CL.ui.message(`${placeName(sid)}: an unpaid soldier of the garrison has deserted.`);
      }
      // A dismissed castellan rejoins the company when you are there.
      if (h.castellanLeaving && h.castellan && c.world?.location === sid) returnCastellan(c, sid);
    }
    for (const x of CL.lords?.prisoners(c) || []) {
      if (c.day - x.since < RULES.heldDays || x.forfeit) continue;
      x.forfeit = true; // a lord held unransomed 30 days: their land goes to the crown, which will grant it
      const had = R().fiefsOf(x.lord, c);
      for (const sid of had) R().transfer(c, sid, { holder: R().rulerOf(R().sovereignOf(sid, c), c), reason: 'held unransomed' });
      if (had.length) CL.nobles?.note(c, x.lord, R().rulerOf(c.people[x.lord].realm, c), 'abandoned'); // left in a cell (P8-07)
    }
    decideGrants(c);
    CL.crowns?.tick(c); // offices fall vacant and are filled (P9-01)
  }

  // ---- Administration ----

  /** Make a veteran of the company castellan here: they leave the company while they serve. */
  function appoint(c, sid, soldierId) {
    if (!CL.rights.may(c, PLAYER, 'appoint', sid).ok || c.world?.location !== sid) return false; // in person, at the holding
    const h = ensure(c, sid);
    const s = c.roster.find((x) => x.id === soldierId);
    if (!s || !CL.detachments.captains(c).some((k) => k.kind === 'soldier' && k.id === soldierId) || h.castellan) return false;
    c.roster.splice(c.roster.indexOf(s), 1);
    h.castellan = { kind: 'soldier', id: s.id, name: s.name, soldier: s };
    h.administrator = null;
    CL.ui.message(`${s.name} stays behind as castellan of ${placeName(sid)}.`);
    return true;
  }
  /** Dismiss the castellan: they rejoin the company the next time you are at the holding. */
  function dismiss(c, sid) {
    const h = R().holding(sid, c);
    if (!h?.castellan || !CL.rights.may(c, PLAYER, 'appoint', sid).ok) return false;
    h.castellanLeaving = true;
    if (c.world?.location === sid) returnCastellan(c, sid);
    return true;
  }
  function returnCastellan(c, sid) {
    const h = R().holding(sid, c);
    if (!h?.castellan) return null;
    const s = h.castellan.soldier;
    if (s && !c.roster.some((x) => x.id === s.id)) c.roster.push(s);
    h.castellan = null;
    h.castellanLeaving = false;
    CL.ui.message(`${s?.name || 'Your castellan'} rejoins the company.`);
    return s;
  }

  /** Set a policy on a fief of yours. */
  function setPolicy(c, sid, key, value) {
    if (!CL.rights.may(c, PLAYER, 'setPolicy', sid).ok) return false;
    const h = ensure(c, sid);
    const ok = { garrison: GARRISONS, tax: STANCES }[key]?.includes(value) || (key === 'food' && Number.isInteger(value) && value >= 0 && value <= 60) || (key === 'repairs' && typeof value === 'boolean');
    if (!ok) return false;
    h.policies[key] = value;
    return true;
  }

  /** Put crowns into a fief's treasury (positive) or draw them out (negative), at the holding. */
  function fund(c, sid, n) {
    if (!CL.rights.may(c, PLAYER, 'drawTreasury', sid).ok || c.world?.location !== sid || !Number.isInteger(n) || !n) return false;
    return n > 0 ? A().transfer(c, 'purse', account(sid), n, `put into ${placeName(sid)}`) : A().transfer(c, account(sid), 'purse', -n, `drawn from ${placeName(sid)}`);
  }

  /** Policies kept with a claim, made safe: anything that no longer applies falls back to the default (SC-44). */
  function keptPolicies(p) {
    const d = policies();
    return {
      garrison: GARRISONS.includes(p?.garrison) ? p.garrison : d.garrison,
      tax: STANCES.includes(p?.tax) ? p.tax : d.tax,
      food: Number.isInteger(p?.food) && p.food >= 0 && p.food <= 60 ? p.food : d.food,
      repairs: typeof p?.repairs === 'boolean' ? p.repairs : d.repairs,
    };
  }

  // ---- A holding changing hands: money, castellans, policies (SC-44) ----

  CL.events?.on('HoldingChanged', (e, c) => {
    for (const sid of [e.holding, ...(e.villages || [])]) {
      const h = R().holding(sid, c);
      if (!h || h.prosperity == null) continue;
      const was = sid === e.holding ? e.from.holder : null;
      // Taken: the new controller garrisons a fort with its own standard garrison (as before P8-05).
      if (h.kind === 'fort' && sid === e.holding && e.from.controller !== e.to.controller) h.garrison = startGarrison(sid, c);
      const nowMine = h.holder === PLAYER;
      const acct = account(sid);
      const inAcct = A().balance(c, acct);
      if (nowMine && h.treasury > 0) {
        A().transfer(c, 'world', acct, Math.floor(h.treasury), `${placeName(sid)}'s treasury, granted with it`);
        h.treasury = 0;
      } else if (!nowMine && inAcct > 0) {
        A().transfer(c, acct, 'world', inAcct, `${placeName(sid)}'s treasury, left with it`);
        h.treasury += inAcct;
      }
      if (!nowMine) {
        if (h.castellan) returnCastellan(c, sid); // they come back to the company
        // P8-08: lost against your will, your policies are kept with your claim, to restore if you get it back.
        const k = h.claims.find((x) => x.by === PLAYER);
        if (k && k.since === c.day && !k.policies && h.policies) k.policies = { ...h.policies };
        h.policies = policies(); // policies cancelled safely: the new holder's are the defaults
        if (c.accounts?.budgets) delete c.accounts.budgets[`fief_${sid}`];
      }
      if (nowMine && was !== PLAYER) h.policies = policies();
      if (nowMine && h.restorePolicies) h.policies = keptPolicies(h.restorePolicies); // your claim made good (P8-08)
      delete h.restorePolicies;
      // P8-08: your castellan, taken with the fort, is freed when it is yours or your realm's again.
      if (h.heldCastellan && sid === e.holding && (nowMine || (CL.allegiance && h.controller === CL.allegiance.serves(c)))) {
        const k = h.heldCastellan;
        h.heldCastellan = null;
        if (k.soldier && !c.roster.some((x) => x.id === k.soldier.id)) c.roster.push(k.soldier);
        CL.ui.message(`${k.name} is freed with ${placeName(sid)} and rejoins the company.`);
      }
    }
  });

  // ---- Grants ----

  const grants = (c) => (c.grants ||= []);

  /** Is this holding the crown's to give (held by the ruler, not of the crown's own land)? */
  function givable(c, sid) {
    const h = R().holding(sid, c);
    if (!h || h.holder !== R().rulerOf(h.sovereign, c) || h.controller !== h.sovereign) return false;
    if (h.kind === 'town' || h.crownLand) return false;
    if (R().locked(c, sid) || (h.seat && R().locked(c, h.seat))) return false;
    return true;
  }

  /** Queue a grant of a holding the crown has to give; `helper`: who did most in its taking. */
  function offer(c, sid, helper = null, day = c.day) {
    // P8-T: a grant already waiting with no one named: whoever did most in its taking is named now.
    const waiting = grants(c).find((g) => g.sid === sid);
    if (waiting && helper && !waiting.helper && waiting.offeredTo !== PLAYER) {
      waiting.helper = helper;
      return waiting;
    }
    if (waiting || !CL.rights.may(c, R().rulerOf(R().sovereignOf(sid, c), c), 'grant', sid).ok) return null;
    const g = { sid, helper, day: day + RULES.grantDays[0] + (CL.autoresolve.next(c) * (RULES.grantDays[1] - RULES.grantDays[0])), declined: [], offeredTo: null };
    grants(c).push(g);
    if (grants(c).length > RULES.grantsMax) grants(c).shift();
    return g;
  }

  /** Each week: the crown's holdings to give are offered, and a long-serving landless vassal may get a village. */
  function weeklyGrants(c, day = c.day) {
    for (const sid of Object.keys(c.holdings || {})) if (givable(c, sid)) offer(c, sid, null, day);
    const a = CL.allegiance?.state(c);
    if (a?.kind === 'vassal' && !fiefs(c).length && a.serviceDays >= RULES.longService) {
      const crown = Object.keys(c.holdings).find((sid) => c.holdings[sid].kind === 'village' && c.holdings[sid].sovereign === a.realm && c.holdings[sid].holder === R().rulerOf(a.realm, c) && c.holdings[sid].crownLand && !grants(c).some((g) => g.sid === sid));
      if (crown) offer(c, crown, PLAYER, day);
    }
  }

  /** The candidates for a grant, in the crown's order. */
  function candidates(c, g) {
    const h = R().holding(g.sid, c);
    const f = h.sovereign;
    const ruler = R().rulerOf(f, c);
    const people = Object.keys(c.people).filter((id) => c.people[id].realm === f && id !== ruler && c.people[id].status === 'free');
    const a = CL.allegiance?.state(c);
    if (CL.allegiance?.sworn(c) === f) {
      const fort = h.kind !== 'village';
      const enough = !fort || g.helper === PLAYER || (c.renown >= RULES.fort.renown && a.serviceDays >= RULES.fort.serviceDays);
      if (enough) people.push(PLAYER);
    }
    const fiefCount = (id) => R().fiefsOf(id, c).length;
    const kinOfLord = (id) => id !== PLAYER && c.people[id].kin.some((k) => R().fiefsOf(k.person, c).length || R().rules(k.person, c));
    const merit = (id) => (id === PLAYER ? (a?.serviceDays || 0) + c.renown / 10 : 0);
    // P8-07: the court weighs opinions: the ruler's of each candidate, friends backing, rivals opposing.
    const court = (id) => Math.round(CL.nobles?.court(c, g, id) || 0);
    return people
      .filter((id) => fiefCount(id) < R().fiefCapOf(id, c) && !g.declined.includes(id))
      .sort((x, y) => {
        // P8-08: after who did most in its taking, you, if you held it and claim it (you first, for what you held).
        const helped = (id) => (id === g.helper ? 0 : id === PLAYER && R().claimsOn(g.sid, c).some((k) => k.by === id) ? 1 : 2);
        const landless = (id) => (fiefCount(id) ? 2 : kinOfLord(id) ? 0 : 1);
        return helped(x) - helped(y) || landless(x) - landless(y) || fiefCount(x) - fiefCount(y) || court(y) - court(x) || merit(y) - merit(x) || x.localeCompare(y);
      });
  }

  /** Grants that are due: the crown chooses; yours comes as a message, the AI's lords accept. */
  function decideGrants(c) {
    for (const g of [...grants(c)]) {
      if (c.day < g.day || g.offeredTo === PLAYER) continue;
      if (!givable(c, g.sid) && !(g.helper === PLAYER && R().holderOf(g.sid, c) === R().rulerOf(R().sovereignOf(g.sid, c), c))) {
        grants(c).splice(grants(c).indexOf(g), 1);
        continue;
      }
      const who = candidates(c, g)[0];
      if (!who) {
        grants(c).splice(grants(c).indexOf(g), 1);
        continue;
      }
      if (who === PLAYER) {
        g.offeredTo = PLAYER;
        if (CL.game.mode === 'map') CL.ui.openGrant?.();
        continue;
      }
      give(c, g, who);
    }
  }

  /** The crown grants it: the holding passes, the news tells it, a suggestion is remembered. */
  function give(c, g, who) {
    const before = R().fiefsOf(who, c).length;
    const rivals = candidates(c, g).slice(0, 3); // who else stood for it (P8-07: rivals)
    const h = R().holding(g.sid, c);
    const ruler = R().rulerOf(h.sovereign, c);
    if (!R().transfer(c, g.sid, { holder: who, willing: true, reason: 'grant', quiet: true })) return false;
    grants(c).splice(grants(c).indexOf(g), 1);
    const name = who === PLAYER ? c.character?.name || 'You' : R().titled(who, c);
    CL.news?.record(c, 'fief_granted', { place: g.sid, text: `${name}${before ? '' : ', landless until now,'} is granted ${placeName(g.sid)} by ${R().titled(ruler, c)}.` });
    if (g.suggestedBy && who === g.helper) CL.lords?.deed(c, who, 'suggested', g.suggestedBy); // the lord named remembers it (P8-07)
    CL.nobles?.onGrant(c, g.sid, who, rivals);
    return true;
  }

  /** The grant offered to you now, or null. */
  const grantDue = (c) => grants(c).find((g) => g.offeredTo === PLAYER) || null;

  /** What accepting a grant would mean: obligations and costs, in lines. */
  function grantLines(c, g) {
    const h = ensure(c, g.sid);
    const lines = [`${R().titled(R().rulerOf(h.sovereign, c), c)} grants you ${placeName(g.sid)} (a ${h.kind}).`];
    const tax = Math.round(RULES.tax[h.kind] * (h.prosperity / 50));
    lines.push(`It pays about ${tax} crowns a week in tax; the crown takes a tenth.`);
    if (h.kind === 'fort') lines.push(`Its garrison of ${count(h.garrison)} costs about ${Math.round(Object.entries(h.garrison || {}).reduce((n, [id, k]) => n + (troop(id)?.wage || 0) * k, 0) * garrisonWage())} a week, and the steward ${RULES.steward}.`);
    else lines.push(`Its militia costs ${RULES.militia.wage} a week; the reeve runs it for nothing.`);
    lines.push(`A day spent there counts as a day of service. You may hold three fiefs at most.`);
    return lines;
  }

  /** Accept or decline your grant. Declined, it goes to the next candidate. */
  function answer(c, choice) {
    const g = grantDue(c);
    if (!g) return null;
    if (choice === 'accept') {
      g.offeredTo = null;
      if (!give(c, g, PLAYER)) return null;
      const text = `You are granted ${placeName(g.sid)}.`;
      CL.ui.message(text);
      return { choice, text };
    }
    g.offeredTo = null;
    g.declined.push(PLAYER);
    decideGrants(c);
    return { choice, text: `You decline ${placeName(g.sid)}. The crown will grant it elsewhere.` };
  }

  // ---- The conqueror's choice (D-P8f) ----

  /**
   * Someone took a fief for their realm: the player (as a sworn vassal) or a lord. `choice` is 'ask',
   * 'suggest' (with `suggest`: a lord's id), 'hand' or 'keep'. Returns what came of it.
   */
  function conquered(c, sid, taker, choice = 'ask', suggest = null) {
    const h = R().holding(sid, c);
    if (!h || !CHOICES.includes(choice)) return null;
    const f = h.sovereign;
    const ruler = R().rulerOf(f, c);
    if (taker === ruler) return { choice: 'ruler' }; // the ruler took it: the ruler decides (a grant, in time)
    c.influence ||= {};
    if (choice === 'ask') return { choice, grant: offer(c, sid, taker) };
    if (choice === 'suggest') {
      const g = offer(c, sid, suggest);
      if (g) g.suggestedBy = taker;
      return { choice, grant: g };
    }
    if (choice === 'hand') {
      if (taker === PLAYER) c.influence[f] = (c.influence[f] || 0) + 5;
      CL.lords?.deed(c, ruler, 'handed', taker);
      h.crownLand = false;
      return { choice, influence: taker === PLAYER ? c.influence[f] : 0, grant: offer(c, sid, null) };
    }
    // Keep it unasked: the ruler accepts, or casts the taker out.
    const accepts = R().fiefsOf(taker, c).length < R().fiefCapOf(taker, c) && (taker !== PLAYER || (R().standing(c, f) === 'friendly' && !CL.allegiance.state(c).summonsMissed));
    R().transfer(c, sid, { holder: taker, willing: true, reason: 'kept by its taker' });
    if (accepts) return { choice, accepted: true };
    if (taker === PLAYER) CL.allegiance.expel(c, 'you kept what was not yours to keep');
    return { choice, accepted: false };
  }

  // ---- Saves ----

  /** Repair the holdings' running state, the grants and influence (after holdings, accounts and allegiance). */
  function sanitize(s, d) {
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    const old = d?.holdings && typeof d.holdings === 'object' ? d.holdings : {};
    const starts = R().startingHoldings(Object.fromEntries(Object.entries(s.people).map(([id, p]) => [p.key, id])), s.rulers);
    for (const [sid, h] of Object.entries(s.holdings)) {
      const e = old[sid] || {};
      h.prosperity = null;
      ensure(s, sid);
      // The crown's own land: what its ruler held at the start.
      h.crownLand = e.crownLand === false ? false : starts[sid]?.holder === s.rulers[h.sovereign] && h.holder === s.rulers[h.sovereign];
      if (num(e.prosperity)) h.prosperity = clamp(Math.round(e.prosperity), 0, FULL);
      if (num(e.unrest)) h.unrest = clamp(Math.round(e.unrest), 0, FULL);
      if (h.kind === 'fort' && e.garrison && typeof e.garrison === 'object') {
        h.garrison = {};
        for (const [id, n] of Object.entries(e.garrison)) if (troop(id) && Number.isInteger(n) && n > 0) h.garrison[id] = Math.min(n, 60);
      }
      if (h.kind === 'village' && num(e.militia)) h.militia = clamp(Math.round(e.militia), 0, RULES.militia.size);
      if (e.policies && typeof e.policies === 'object') {
        if (GARRISONS.includes(e.policies.garrison)) h.policies.garrison = e.policies.garrison;
        if (STANCES.includes(e.policies.tax)) h.policies.tax = e.policies.tax;
        if (Number.isInteger(e.policies.food) && e.policies.food >= 0 && e.policies.food <= 60) h.policies.food = e.policies.food;
        if (typeof e.policies.repairs === 'boolean') h.policies.repairs = e.policies.repairs;
      }
      if (h.kind === 'fort' && num(e.walls)) h.walls = clamp(Math.round(e.walls), 0, FULL);
      if (h.holder === PLAYER) h.treasury = 0; // a fief of yours keeps its money in its account
      else if (num(e.treasury)) h.treasury = Math.max(0, Math.floor(e.treasury));
      h.unpaid = Math.max(0, Math.min(9, Math.floor(num(e.unpaid) ? e.unpaid : 0)));
      h.deserting = e.deserting === true && h.unpaid > RULES.warnings;
      h.dueWeek = Number.isInteger(e.dueWeek) ? e.dueWeek : null;
      h.reports = (Array.isArray(e.reports) ? e.reports : []).filter((r) => r && num(r.day) && num(r.tax)).slice(-RULES.reportsMax);
      h.report = h.reports.at(-1) || null;
      h.book = (Array.isArray(e.book) ? e.book : []).filter((l) => l && A().known(l.from) && A().known(l.to) && Number.isInteger(l.amount) && l.amount > 0 && num(l.day)).slice(-RULES.bookMax);
      const k = e.castellan;
      if (h.holder === PLAYER && k?.kind === 'soldier' && k.soldier && Number.isInteger(k.soldier.id) && CL.content.table('troops')[k.soldier.troop] && !s.roster.some((x) => x.id === k.soldier.id)) {
        h.castellan = { kind: 'soldier', id: k.soldier.id, name: String(k.name || k.soldier.name || 'Castellan').slice(0, 40), soldier: k.soldier };
        if (e.castellanLeaving === true) h.castellanLeaving = true;
        s.nextSoldierId = Math.max(s.nextSoldierId, k.soldier.id + 1);
      }
      // P8-08: your castellan held with a fort that was stormed.
      const kc = e.heldCastellan;
      if (h.holder !== PLAYER && kc?.kind === 'soldier' && kc.soldier && Number.isInteger(kc.soldier.id) && CL.content.table('troops')[kc.soldier.troop] && !s.roster.some((x) => x.id === kc.soldier.id)) {
        h.heldCastellan = { kind: 'soldier', id: kc.soldier.id, name: String(kc.name || kc.soldier.name || 'Castellan').slice(0, 40), soldier: kc.soldier };
        s.nextSoldierId = Math.max(s.nextSoldierId, kc.soldier.id + 1);
      }
      if (h.holder !== PLAYER) delete s.accounts.budgets[`fief_${sid}`];
    }
    s.grants = [];
    for (const g of Array.isArray(d?.grants) ? d.grants.slice(-RULES.grantsMax) : []) {
      if (!g || !s.holdings[g.sid] || !num(g.day) || s.grants.some((x) => x.sid === g.sid)) continue;
      const who = (id) => id === PLAYER || Boolean(s.people[id]);
      s.grants.push({ sid: g.sid, helper: who(g.helper) ? g.helper : null, day: g.day, declined: (Array.isArray(g.declined) ? g.declined : []).filter(who), offeredTo: g.offeredTo === PLAYER ? PLAYER : null, ...(who(g.suggestedBy) ? { suggestedBy: g.suggestedBy } : {}) });
    }
    s.influence = {};
    for (const [f, n] of Object.entries(d?.influence || {})) if (R().isRealm(f) && num(n)) s.influence[f] = clamp(Math.round(n), 0, FULL);
  }

  CL.fiefs = { RULES, garrisonTarget, garrisonScale, STANCES, GARRISONS, CHOICES, keptPolicies, account, accountOf, cash, bookFor, label, policies, ensure, adminName, week, payday, tick, appoint, dismiss, returnCastellan, setPolicy, fund, givable, offer, weeklyGrants, candidates, decideGrants, give, grantDue, grantLines, answer, conquered, sanitize, count };
})(typeof window !== 'undefined' ? window : globalThis);
