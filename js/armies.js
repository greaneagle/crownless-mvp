/* Crownless armies and campaigns (P9-05, design §20.1–20.7): several lords' parties under one
 * commander, raised by a realm at war, marching as one, eating, fighting and breaking up.
 *
 * - **An army** (`c.armies`): `{ id, realm, commander, members, objective, target, rally, since, food }`.
 *   `members` are lords (their parties carry `armyId`); each party keeps its own troops, wages and
 *   losses. The commander is the marshal if they come, else the nearest lord who does.
 * - **Raising** (`plan`, `raise`): a realm at war with no army and no siege calls up to 6 lords
 *   (`nobles.summon`: each answers by the model). The rally is the realm's holding nearest the target.
 *   The army marches when half have come, or after 7 days.
 * - **Moving:** the members follow the commander's party, which rides at the slowest one's pace.
 * - **Objectives** (`choose`): regroup (worn out, starving, or a month on campaign), pursue (an enemy
 *   army within 30 map units, not much stronger), relieve (a fort of ours besieged), defend (a holding
 *   an enemy army marches on), besiege (P8-06a's siege, gathered by the army: forts first, a capital
 *   only by an army), raid (a village: prosperity −20, a week of its tax as spoils, its lord's opinion
 *   of the raiders −20), else regroup. Your realm's marshal policy says which realms (P9-03).
 * - **Supply:** food in days: 5 at the start, +1 a day in friendly land (10 at most); in enemy land the
 *   army forages (the nearest village −2 prosperity a day) or eats a day; at 0 the furthest party
 *   loses a tenth of its troops a day.
 * - **Upkeep:** 1 crown a soldier a week from the realm's treasury; broke for 7 days, it disbands.
 * - **Battles of armies** (`battle`): two armies of realms at war that meet fight by the square law;
 *   losses fall on every party; the loser retreats, or breaks up if it lost half (each lord captured
 *   at even odds).
 * - **Capitals** (`onTaken`): taken by an army, the ruler's seat moves to their next holding; a realm
 *   with no holding left is gone, and its lords seek service elsewhere.
 * - **Anti-snowball:** one army a realm, a week's rest after it disbands, none while a fort it took is
 *   weak, armies cost the treasury every week, a capital needs twice the odds when it is the last. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    maxLords: 6,
    minLords: 2,
    marchShare: 0.5, // of those called, there, and it marches
    rallyDays: 7,
    food: { start: 5, max: 10, friendly: 1 },
    forage: 2, // prosperity a day from the nearest village
    forageReach: 15,
    starve: 0.1, // of the furthest party's troops a day
    upkeep: 1, // crowns a soldier a week
    brokeDays: 7,
    raid: { prosperity: 20, opinion: -20, days: 30 },
    pursue: 30,
    pursueRatio: 0.8, // pursues an army no stronger than this over its own power
    contact: 5,
    breakAt: 0.5,
    capture: 0.5,
    capital: { garrison: 1.5, food: 1.5 },
    campaignDays: 30,
    worn: 0.5, // of its strength when it marched: it regroups
    arrive: 3,
    spread: 2.2, // map units between the members around the commander
    rest: 7, // days after an army disbands before the realm raises another
    defendDays: 7,
    logMax: 12,
  };
  const PLAYER = 'player';

  const R = () => CL.realm;
  const A = () => CL.autoresolve;
  const L = () => CL.lords;
  const place = (id) => CL.content.table('settlements')[id] || null;
  const placeName = (id) => place(id)?.name || id;
  const factionName = (f) => (R().faction(f)?.name || 'a realm').replace(/^The /, ''); // "the Greymantle Rising", never "the The …"
  const dist = (a, b) => CL.world.mapDist(a.x, a.y, b.x, b.y);
  const at = (sid) => {
    const s = place(sid);
    return s ? { x: s.mapX, y: s.mapY } : null;
  };
  const troopCount = (t) => Object.values(t || {}).reduce((a, b) => a + b, 0);
  const tpl = (id) => CL.content.table('party_templates')[id];

  const list = (c) => (c.armies ||= []);
  const byId = (c, id) => list(c).find((a) => a.id === id) || null;
  /** The army a lord rides in, or null. */
  const of = (c, pid) => list(c).find((a) => a.members.includes(pid)) || null;
  /** The army a realm has in the field, or null. */
  const ofRealm = (c, f) => list(c).find((a) => a.realm === f) || null;
  const parties = (c, a) => a.members.map((pid) => L().partyOf(c, pid)).filter(Boolean);
  /** The commander's party (or, when you command it, your company on the map). */
  const lead = (c, a) => (a.commander === PLAYER ? { id: null, x: c.world.x, y: c.world.y, player: true } : L().partyOf(c, a.commander));
  /** An army's power: every member party's troops (and your company, when you command it). */
  const powerOf = (c, a) => parties(c, a).reduce((n, q) => n + A().troopsPower(q.troops), a.commander === PLAYER ? A().playerPower(c) : 0);
  /** Your own army (you command it), or null. */
  const mine = (c) => list(c).find((a) => a.commander === PLAYER) || null;
  const soldiers = (c, a) => parties(c, a).reduce((n, q) => n + troopCount(q.troops), 0);
  const log = (a, day, text) => {
    a.log = [...(a.log || []), { day, text }].slice(-RULES.logMax);
  };
  const busy = (c, pid) => Boolean(CL.sieges?.of(c, pid) || of(c, pid) || CL.nobles?.ridesWith?.(c, pid));

  // ---- Land ----

  /** Who holds the land here: the nearest place's controller. */
  function landAt(c, x, y) {
    let best = null;
    for (const s of Object.values(CL.content.table('settlements'))) {
      if (!c.holdings?.[s.id]) continue;
      const d = CL.world.mapDist(x, y, s.mapX, s.mapY);
      if (!best || d < best.d) best = { d, sid: s.id };
    }
    return best ? R().owner(best.sid, c) : null;
  }
  const enemies = (c, f, g) => Boolean(g) && g !== f && R().siegeWar(c, f, g);
  /** A holding (not a village) of realm `f`, nearest a point. */
  function nearestOwn(c, f, pt) {
    const own = Object.keys(c.holdings || {}).filter((sid) => c.holdings[sid].controller === f && c.holdings[sid].kind !== 'village' && place(sid));
    return own.sort((a, b) => dist(at(a), pt) - dist(at(b), pt))[0] || null;
  }
  /** A capital's garrison when an army comes for it: its realm's standard one, half again (P9-05). */
  function capitalGarrison(c, sid) {
    const h = c.holdings[sid];
    const base = R().faction(h.controller)?.garrison || {};
    const k = (CL.fiefs?.garrisonScale?.() || 1) * RULES.capital.garrison;
    return Object.fromEntries(Object.entries(base).map(([id, n]) => [id, Math.max(1, Math.round(n * k))]));
  }
  /** Ready a town for a siege: a garrison and food, if it has none. */
  function readyTown(c, sid) {
    const h = c.holdings[sid];
    if (h?.kind !== 'town') return;
    if (!troopCount(h.garrison)) h.garrison = capitalGarrison(c, sid);
    if (h.food == null) h.food = Math.round((h.policies?.food ?? 14) * RULES.capital.food);
    if (h.walls == null) h.walls = 100;
  }
  /** Is this holding the last its realm has (not a village)? */
  const lastOf = (c, sid) => {
    const f = c.holdings[sid].controller;
    return Object.values(c.holdings).filter((x) => x.controller === f && x.kind !== 'village').length <= 1;
  };
  /** The garrison's power realm f's army must beat to begin a siege here. */
  function needed(c, sid, f) {
    const h = c.holdings[sid];
    const g = h.kind === 'town' && !troopCount(h.garrison) ? capitalGarrison(c, sid) : h.garrison || {};
    // P10-00: an overstretched realm (past a third of the land) needs more (CL.sieges.gatherNeed).
    return A().troopsPower(g) * CL.sieges.gatherNeed(c, f, lastOf(c, sid));
  }

  // ---- Raising ----

  /** Realm `f` at war raises an army, if it may: one a realm, rested, holding what it took. */
  function plan(c, f) {
    if (ofRealm(c, f) || CL.sieges.list(c).some((s) => s.realm === f)) return null;
    if ((c.armyRest?.[f] ?? -1) > c.day) return null;
    if (CL.founding && f === CL.founding.mine(c) && !R().realms().some((k) => CL.founding.mayPlan(c, f, k.id))) return null;
    if (Object.values(c.holdings).some((x) => x.controller === f && x.weakUntil > c.day)) return null;
    const target = targets(c, f)[0];
    if (!target) return null;
    return raise(c, f, target);
  }

  /** P9-T: a rising's crown (the realm it rose against), or null: a civil war is fought against it first. */
  const risenAgainst = (c, f) => CL.rebellion?.ofRising(c, f)?.realm || null;

  /** The forts (then capitals) an army of `f` might besiege, best first: a rising's crown's, claimed, then forts, then nearest. */
  function targets(c, f, from = null) {
    const ruler = R().rulerOf(f, c);
    const home = from || at(R().capitalOf(f, c)) || at(c.people?.[ruler]?.home);
    if (!home) return [];
    const may = (g) => !CL.founding || CL.founding.mayPlan(c, f, g);
    const sids = Object.keys(c.holdings).filter((sid) => {
      const h = c.holdings[sid];
      if (h.kind === 'village' || !place(sid) || !enemies(c, f, h.controller) || !may(h.controller)) return false;
      if (R().locked(c, sid) || CL.sieges.at(c, sid)) return false;
      return h.kind === 'fort' || h.kind === 'town';
    });
    const ours = (k) => c.people[k.by]?.realm === f && c.people[k.by].status === 'free';
    const claimed = (sid) => (CL.claims?.pressedFor?.(c, sid, f) ? 0 : R().claimsOn(sid, c).some(ours) ? 0.5 : 1);
    const town = (sid) => (c.holdings[sid].kind === 'town' ? 1 : 0);
    const crown = risenAgainst(c, f);
    const civil = (sid) => (crown && c.holdings[sid].controller === crown ? 0 : 1);
    return sids.sort((a, b) => civil(a) - civil(b) || claimed(a) - claimed(b) || town(a) - town(b) || dist(home, at(a)) - dist(home, at(b)));
  }

  /** Call the lords: the marshal first, then the nearest; each answers by the model. */
  function raise(c, f, target, { objective = 'besiege' } = {}) {
    const rally = nearestOwn(c, f, at(target)) || R().capitalOf(f, c);
    if (!rally || !place(rally)) return null;
    const marshal = CL.crowns?.holder(c, f, 'marshal');
    const free = L()
      .riders(c)
      .filter((pid) => c.people[pid].realm === f && c.people[pid].status === 'free' && !busy(c, pid))
      .map((pid) => L().partyOf(c, pid))
      .filter((q) => q && !L().thin(c, q));
    const r = at(rally);
    free.sort((a, b) => (a.lordId === marshal ? 0 : 1) - (b.lordId === marshal ? 0 : 1) || dist(a, r) - dist(b, r));
    const answer = CL.nobles ? CL.nobles.summon(c, f, target, free.map((q) => q.lordId), RULES.maxLords) : { come: free.map((q) => q.lordId).slice(0, RULES.maxLords), refused: [] };
    CL.nobles?.refusals(c, f, target, answer.refused); // why not: the ruler remembers, and the news tells one
    if (answer.come.length < RULES.minLords) return null;
    c.nextArmyId = (c.nextArmyId || 0) + 1;
    const commander = answer.come.includes(marshal) ? marshal : answer.come[0];
    const a = { id: c.nextArmyId, realm: f, commander, members: [...answer.come], objective, target, rally, since: c.day, food: RULES.food.start, phase: 'rally', strength: 0, fedDay: Math.floor(c.day), log: [] };
    list(c).push(a);
    for (const q of parties(c, a)) Object.assign(q, { armyId: a.id, intent: 'army', tx: null, ty: null });
    pace(c, a);
    log(a, c.day, `${R().titled(commander, c)} calls the ${factionName(f)}'s lords to ${placeName(rally)}.`);
    CL.news?.record(c, 'army_raised', { place: rally, faction: f, text: `The ${factionName(f)} raise an army at ${placeName(rally)} under ${R().titled(commander, c)}.` });
    summonPlayer(c, a);
    CL.diag.log('info', 'Army raised', { realm: f, rally, target, members: a.members });
    return a;
  }

  /** The commander rides at the slowest member's pace. */
  function pace(c, a) {
    const qs = parties(c, a);
    const slow = Math.min(...qs.map((q) => tpl(q.template)?.speed ?? Infinity));
    for (const q of qs) delete q.pace;
    const cq = a.commander === PLAYER ? null : lead(c, a);
    if (cq && Number.isFinite(slow)) cq.pace = slow;
  }

  // ---- You, commanding ----

  /** You raise your realm's army: your vassals answer by the model and gather where you are. */
  function raiseMine(c) {
    const f = R().rules(PLAYER, c);
    if (!f) return { ok: false, why: 'You rule no realm' };
    if (ofRealm(c, f)) return { ok: false, why: 'Your realm has an army in the field already' };
    const rally = nearestOwn(c, f, c.world);
    if (!rally) return { ok: false, why: 'Your realm holds no fort or town to gather at' };
    const free = L()
      .riders(c)
      .filter((pid) => c.people[pid].realm === f && c.people[pid].status === 'free' && !busy(c, pid))
      .map((pid) => L().partyOf(c, pid))
      .filter((q) => q && !L().thin(c, q))
      .sort((a, b) => dist(a, at(rally)) - dist(b, at(rally)));
    const answer = CL.nobles ? CL.nobles.summon(c, f, rally, free.map((q) => q.lordId), RULES.maxLords) : { come: free.map((q) => q.lordId).slice(0, RULES.maxLords), refused: [] };
    CL.nobles?.refusals(c, f, rally, answer.refused);
    if (!answer.come.length) return { ok: false, why: free.length ? 'None of your lords answers the call' : 'You have no lords free to call' };
    c.nextArmyId = (c.nextArmyId || 0) + 1;
    const a = { id: c.nextArmyId, realm: f, commander: PLAYER, members: [...answer.come], objective: 'follow', target: rally, rally, since: c.day, food: RULES.food.start, phase: 'rally', strength: 0, fedDay: Math.floor(c.day), log: [] };
    list(c).push(a);
    for (const q of parties(c, a)) Object.assign(q, { armyId: a.id, intent: 'army', tx: null, ty: null });
    log(a, c.day, `You call your lords to ${placeName(rally)}.`);
    CL.news?.record(c, 'army_raised', { place: rally, faction: f, text: `The ${factionName(f)} raise an army at ${placeName(rally)}.` });
    CL.diag.log('info', 'Army raised', { realm: f, rally, members: a.members, you: true });
    const refused = answer.refused.length ? ` ${answer.refused.length} refuse.` : '';
    CL.ui.message(`${answer.come.length} of your lords answer and gather at ${placeName(rally)}.${refused}`);
    return { ok: true, army: a };
  }
  /** Your orders to your army: besiege or raid a place, ride with you, or go home. */
  function order(c, objective, target = null) {
    const a = mine(c);
    if (!a) return { ok: false, why: 'You command no army' };
    if (objective === 'home') {
      disband(c, a, 'sent home');
      CL.ui.message('You send your lords home.');
      return { ok: true };
    }
    if (objective === 'follow') {
      set(c, a, 'follow', a.rally, 'It rides with you.');
      return { ok: true };
    }
    const ok = objective === 'besiege' ? targets(c, a.realm, c.world).includes(target) : objective === 'raid' ? raidable(c, a, c.world).includes(target) : false;
    if (!ok) return { ok: false, why: `Your army cannot ${objective} ${placeName(target)} now` };
    set(c, a, objective, target, `You order it to ${objective} ${placeName(target)}.`);
    return { ok: true };
  }

  // ---- You, summoned ----

  const call = (c) => c.armyCall || null;
  /** A vassal of the realm is summoned to ride with its army. */
  function summonPlayer(c, a) {
    if (CL.allegiance?.sworn(c) !== a.realm || R().rules(PLAYER, c) || call(c)) return;
    c.armyCall = { army: a.id, day: c.day, answered: false };
    CL.ui.message(`${R().titled(R().rulerOf(a.realm, c), c)} summons you to ride with the army at ${placeName(a.rally)}.`);
  }
  /** Do you ride with this army now? (Answered, and near its banner.) */
  const riding = (c, a) => call(c)?.army === a.id && call(c).answered && lead(c, a) && dist(c.world, lead(c, a)) <= RULES.contact * 2;
  function tickCall(c) {
    const m = call(c);
    if (!m) return;
    const a = byId(c, m.army);
    const q = a && lead(c, a);
    if (a && q && dist(c.world, q) <= RULES.contact * 2 && !m.answered) {
      m.answered = true;
      CL.nobles?.note(c, R().rulerOf(a.realm, c), PLAYER, 'answered', { kin: false });
      CL.ui.message(`You ride with the ${factionName(a.realm)}'s army under ${R().titled(a.commander, c)}.`);
    }
    if (m.answered && a) CL.allegiance?.serve?.(c);
    if (a && CL.allegiance?.sworn(c) === a.realm) return;
    c.armyCall = null;
    if (!m.answered && a == null && CL.allegiance?.sworn(c) && c.day - m.day >= RULES.rallyDays) {
      CL.allegiance.missed?.(c);
      CL.ui.message('You did not ride with the army you were summoned to. It is marked.');
    }
  }

  // ---- Where they ride ----

  /** Where a lord of an army rides (js/parties.js): the rally, the commander's banner, or the target. */
  function postFor(c, p) {
    const a = byId(c, p.armyId);
    if (!a?.members.includes(p.lordId)) return null;
    const k = (a.members.indexOf(p.lordId) + 1) * 2.1;
    const ring = (pt) => [pt.x + Math.cos(k) * RULES.spread, pt.y + Math.sin(k) * RULES.spread];
    if (a.phase === 'rally') return ring(at(a.rally));
    const cq = lead(c, a);
    if (p.lordId !== a.commander && cq) return ring(cq);
    const goal = goalOf(c, a);
    return goal ? [goal.x, goal.y] : null;
  }
  /** The commander's goal: the target, the army pursued, or the place to regroup. */
  function goalOf(c, a) {
    if (a.objective === 'pursue') {
      const b = byId(c, a.target);
      return (b && lead(c, b)) || null;
    }
    return at(a.target);
  }

  // ---- Time ----

  /** Hour by hour (from js/sieges.js step): battles, arrivals, objectives; once a day, food and the rally. */
  function step(c) {
    tickCall(c);
    for (const a of [...list(c)]) {
      if (!list(c).includes(a)) continue;
      if (!muster(c, a)) continue;
      if (a.phase === 'rally') {
        rally(c, a);
        continue;
      }
      if (!list(c).includes(a)) continue;
      daily(c, a);
      if (!list(c).includes(a)) continue;
      meet(c, a);
      if (!list(c).includes(a)) continue;
      pursueObjective(c, a);
    }
  }

  /**
   * The members still with it: free, of its realm, with a party that rides with it. A captured
   * commander: the next takes over. P10-00 (the long run): a lord whose household was broken rides out
   * again from home with a new party before the next muster; that party is not the army's, so they
   * have left it.
   */
  function muster(c, a) {
    const leaving = a.members.filter((pid) => c.people[pid]?.status !== 'free' || c.people[pid].realm !== a.realm || L().partyOf(c, pid)?.armyId !== a.id);
    for (const pid of leaving) {
      const q = L().partyOf(c, pid);
      if (q && (q.armyId === a.id || q.armyId == null)) release(c, q); // never another army's
    }
    a.members = a.members.filter((pid) => !leaving.includes(pid));
    if (a.commander === PLAYER) {
      // Yours: while you rule its realm, and a lord rides with you.
      if (R().rules(PLAYER, c) !== a.realm || !a.members.length) return disband(c, a, a.members.length ? 'you no longer rule' : 'your lords have gone') && false;
      return true;
    }
    if (a.members.length < RULES.minLords && a.phase !== 'rally') return disband(c, a, 'broken') && false;
    if (!a.members.length) return disband(c, a, 'broken') && false;
    if (!a.members.includes(a.commander)) {
      const next = [...a.members].sort((x, y) => A().troopsPower(L().partyOf(c, y).troops) - A().troopsPower(L().partyOf(c, x).troops))[0];
      log(a, c.day, `${R().titled(next, c)} takes command.`);
      a.commander = next;
      pace(c, a);
    }
    return true;
  }
  const release = (c, q) => {
    delete q.armyId;
    delete q.pace;
    q.tx = q.ty = null;
    if (q.intent === 'army' && q.lordId) CL.lords.sendHome(c, q); // P10-02: home, or rest if already there
  };

  /** P9-T: a lord who changes realm (or declares one) leaves their army at once, not at its next muster. */
  function leave(c, pid) {
    for (const a of list(c)) {
      if (!a.members.includes(pid)) continue;
      a.members = a.members.filter((x) => x !== pid);
      const q = L().partyOf(c, pid);
      if (q) release(c, q);
      if (a.commander === pid && a.members.length) a.commander = a.members[0];
      if (!a.members.length && a.commander !== PLAYER) disband(c, a, 'broken');
    }
  }

  /** Gathering at the rally: it marches when half have come, or after 7 days. */
  function rally(c, a) {
    const pt = at(a.rally);
    const there = parties(c, a).filter((q) => dist(q, pt) <= RULES.arrive * 2);
    if (there.length < Math.max(RULES.minLords, Math.ceil(a.members.length * RULES.marchShare)) && c.day - a.since < RULES.rallyDays) return;
    if (there.length < RULES.minLords) return disband(c, a, 'never gathered');
    a.phase = 'march';
    a.strength = powerOf(c, a);
    a.marched = c.day;
    log(a, c.day, `The army marches from ${placeName(a.rally)}.`);
    choose(c, a);
  }

  /** Once a day: food and foraging, hunger, a month on campaign. */
  function daily(c, a) {
    const today = Math.floor(c.day);
    if (a.fedDay === today) return;
    const days = Math.max(1, today - (a.fedDay ?? today));
    a.fedDay = today;
    const cq = lead(c, a);
    if (!cq) return;
    for (let i = 0; i < Math.min(days, 7); i++) supply(c, a, cq);
    if (!list(c).includes(a)) return;
    const worn = c.day - (a.marched ?? a.since) >= RULES.campaignDays || powerOf(c, a) < a.strength * RULES.worn;
    if (worn && a.commander === PLAYER) {
      CL.ui.message('Your army is worn out: your lords ride home.');
      disband(c, a, 'worn out');
    } else if (worn && a.objective !== 'regroup') regroup(c, a, 'worn out');
  }
  function supply(c, a, cq) {
    const land = landAt(c, cq.x, cq.y);
    if (land === a.realm) {
      a.food = Math.min(RULES.food.max, a.food + RULES.food.friendly);
      return;
    }
    if (enemies(c, a.realm, land)) {
      const v = Object.keys(c.holdings).filter((sid) => c.holdings[sid].kind === 'village' && enemies(c, a.realm, c.holdings[sid].controller) && place(sid) && dist(at(sid), cq) <= RULES.forageReach && (c.holdings[sid].prosperity ?? 0) > 0);
      const sid = v.sort((x, y) => dist(at(x), cq) - dist(at(y), cq))[0];
      if (sid) {
        CL.fiefs?.ensure(c, sid);
        const h = c.holdings[sid];
        h.prosperity = Math.max(0, h.prosperity - RULES.forage);
        h.foraged = Math.floor(c.day);
        return;
      }
    }
    if (a.food > 0) {
      a.food = Math.max(0, a.food - 1);
      return;
    }
    // Starving: the furthest party loses a tenth of its men a day.
    const far = parties(c, a).sort((x, y) => dist(y, cq) - dist(x, cq))[0];
    if (!far) return;
    const n = Math.max(1, Math.round(troopCount(far.troops) * RULES.starve));
    A().removeTroops(far.troops, A().expand(far.troops).slice(-n));
    log(a, c.day, `Hungry men desert ${R().titled(far.lordId, c)}.`);
    if (!troopCount(far.troops)) L().beaten(c, far, null);
  }

  /** Once a week (the payday): 1 crown a soldier from the realm's treasury; broke for a week, it disbands. */
  function weekly(c) {
    for (const a of [...list(c)]) {
      if (a.phase === 'rally' && c.day - a.since < 1) continue;
      const n = Math.round(soldiers(c, a) * RULES.upkeep);
      const paid = CL.crowns ? CL.crowns.pay(c, CL.crowns.side(a.realm), 'world', n, 'wages', { partial: true }) : n;
      a.paid = (a.paid || 0) + paid;
      if (paid >= n) {
        delete a.broke;
        continue;
      }
      a.broke ??= c.day;
      if (c.day - a.broke >= RULES.brokeDays) disband(c, a, 'unpaid');
    }
  }

  // ---- Objectives ----

  function set(c, a, objective, target, text) {
    a.objective = objective;
    a.target = target;
    a.set = c.day;
    log(a, c.day, text);
  }
  /** The marshal chooses: by the army's state, the war's, and (your realm) the marshal's policy. */
  function choose(c, a) {
    const cq = lead(c, a);
    if (!cq) return;
    if (a.commander === PLAYER) return set(c, a, 'follow', a.rally, 'It rides with you, awaiting your orders.'); // your orders, not the marshal's
    const f = a.realm;
    const power = powerOf(c, a);
    if (a.food <= 0 && landAt(c, cq.x, cq.y) !== f) return regroup(c, a, 'hungry');
    const foes = list(c).filter((b) => b !== a && b.phase !== 'rally' && R().relation(c, f, b.realm) === 'war' && lead(c, b));
    const foe = foes.filter((b) => dist(cq, lead(c, b)) <= RULES.pursue && powerOf(c, b) * RULES.pursueRatio <= power).sort((x, y) => dist(cq, lead(c, x)) - dist(cq, lead(c, y)))[0];
    if (foe) return set(c, a, 'pursue', foe.id, `It rides after the ${factionName(foe.realm)}'s army.`);
    const besieged = CL.sieges
      .list(c)
      .filter((s) => c.holdings[s.sid]?.controller === f && s.realm && s.realm !== f && !s.army)
      .sort((x, y) => dist(cq, at(x.sid)) - dist(cq, at(y.sid)))[0];
    if (besieged) return set(c, a, 'relieve', besieged.sid, `It rides to relieve ${placeName(besieged.sid)}.`);
    const threat = foes.find((b) => ['besiege', 'raid'].includes(b.objective) && R().owner(b.target, c) === f);
    if (threat && threat.target !== a.target) return set(c, a, 'defend', nearestOwn(c, f, at(threat.target)) || threat.target, `It rides to defend against the ${factionName(threat.realm)}.`);
    const tried = a.tried || [];
    const sid = targets(c, f, cq).find((x) => !tried.includes(x) && power >= needed(c, x, f));
    if (sid) return set(c, a, 'besiege', sid, `It marches on ${placeName(sid)}.`);
    const v = raidable(c, a, cq)[0];
    if (v) return set(c, a, 'raid', v, `It rides to raid ${placeName(v)}.`);
    regroup(c, a, 'nothing to do');
  }
  /** Enemy villages it might raid: nearest first, none raided this month. */
  function raidable(c, a, from) {
    return Object.keys(c.holdings)
      .filter((sid) => {
        const h = c.holdings[sid];
        return h.kind === 'village' && place(sid) && enemies(c, a.realm, h.controller) && (!CL.founding || CL.founding.mayPlan(c, a.realm, h.controller)) && !R().locked(c, sid) && !(h.raided > c.day - RULES.raid.days);
      })
      .sort((x, y) => {
        const crown = risenAgainst(c, a.realm);
        const civil = (sid) => (crown && c.holdings[sid].controller === crown ? 0 : 1);
        return civil(x) - civil(y) || dist(from, at(x)) - dist(from, at(y));
      });
  }
  function regroup(c, a, why) {
    const cq = lead(c, a);
    const home = nearestOwn(c, a.realm, cq || at(a.rally)) || a.rally;
    set(c, a, 'regroup', home, `It falls back to ${placeName(home)} (${why}).`);
  }
  /** Is the objective still worth riding for? */
  function valid(c, a) {
    const h = c.holdings[a.target];
    switch (a.objective) {
      case 'besiege':
        return Boolean(h) && enemies(c, a.realm, h.controller) && (!CL.sieges.at(c, a.target) || CL.sieges.at(c, a.target).army === a.id);
      case 'raid':
        return Boolean(h) && enemies(c, a.realm, h.controller) && !(h.raided > c.day - RULES.raid.days);
      case 'relieve':
        return Boolean(CL.sieges.at(c, a.target)) && h?.controller === a.realm;
      case 'pursue':
        return Boolean(byId(c, a.target)) && R().relation(c, a.realm, byId(c, a.target).realm) === 'war';
      case 'defend':
        return h?.controller === a.realm && c.day - a.set < RULES.defendDays;
      case 'follow':
        return true;
      default:
        return true;
    }
  }
  /** Riding for the objective, and what it does on arrival. */
  function pursueObjective(c, a) {
    const cq = lead(c, a);
    if (!cq) return;
    if (!valid(c, a)) {
      if (a.siegeId && !CL.sieges.list(c).some((s) => s.id === a.siegeId)) delete a.siegeId;
      return choose(c, a);
    }
    const goal = goalOf(c, a);
    if (!goal || dist(cq, goal) > RULES.arrive * 2) return;
    if (a.objective === 'besiege') {
      if (a.commander === PLAYER && c.world.location !== a.target) return; // you lay the siege at its gates
      if (!CL.sieges.at(c, a.target)) {
        const s = CL.sieges.byArmy(c, a, a.target);
        if (s) a.siegeId = s.id;
        else {
          a.tried = [...(a.tried || []), a.target];
          choose(c, a);
        }
      }
    } else if (a.objective === 'relieve') {
      const s = CL.sieges.at(c, a.target);
      for (const q of parties(c, a)) {
        if (s.relief.includes(q.lordId)) continue;
        s.relief.push(q.lordId);
        Object.assign(q, { siegeId: s.id });
      }
    } else if (a.objective === 'raid') raid(c, a, a.target);
    else if (a.objective === 'regroup') disband(c, a, 'home');
    else if (a.objective === 'follow') return;
  }
  /** A siege the army laid is over (js/sieges.js end): it chooses again. */
  function onSiegeEnd(c, s, how) {
    for (const a of list(c)) {
      if (a.siegeId === s.id || (a.objective === 'relieve' && a.target === s.sid)) {
        delete a.siegeId;
        if (how === 'abandoned' || how === 'lifted') a.tried = [...(a.tried || []), s.sid];
        for (const q of parties(c, a)) {
          q.siegeId = null;
          q.intent = 'army';
        }
        if (list(c).includes(a) && a.phase !== 'rally') choose(c, a);
      }
    }
  }

  /** A raid: the village's prosperity falls, the raiders take a week of its tax, its lord thinks less of them. */
  function raid(c, a, sid) {
    CL.fiefs?.ensure(c, sid);
    const h = c.holdings[sid];
    const tax = Math.round((CL.fiefs?.RULES?.tax?.village ?? 10) * ((h.prosperity ?? 50) / 50));
    h.prosperity = Math.max(0, (h.prosperity ?? 50) - RULES.raid.prosperity);
    h.raided = Math.floor(c.day);
    const spoils = CL.crowns ? CL.crowns.pay(c, 'world', CL.crowns.side(a.realm), tax, 'tribute') : 0;
    a.spoils = (a.spoils || 0) + spoils;
    const lord = h.holder;
    if (lord && lord !== PLAYER && c.people[lord]) for (const pid of a.members) CL.nobles?.note(c, lord, pid, 'raided', { kin: false });
    if (lord === PLAYER) CL.ui.message(`The ${factionName(a.realm)} have raided ${placeName(sid)}!`);
    R().clashed?.(c, a.realm, h.controller, 1, at(sid));
    log(a, c.day, `${placeName(sid)} is raided: ${spoils} crowns in spoils.`);
    CL.diag.log('info', 'Village raided', { realm: a.realm, village: sid, spoils });
    CL.news?.record(c, 'village_raided', { place: sid, faction: a.realm, other: h.controller, text: `The ${factionName(a.realm)} have raided ${placeName(sid)}.` });
    choose(c, a);
  }

  // ---- Battles of armies ----

  /** Two armies of realms at war that meet fight it out. */
  function meet(c, a) {
    const cq = lead(c, a);
    if (!cq) return;
    for (const b of list(c)) {
      if (b === a || b.phase === 'rally' || R().relation(c, a.realm, b.realm) !== 'war') continue;
      const bq = lead(c, b);
      if (!bq || dist(cq, bq) > RULES.contact) continue;
      const f = c.armyFight;
      if (f && [f.ours, f.foe].includes(a.id) && [f.ours, f.foe].includes(b.id) && c.day < f.until) return; // you are fighting it, or let it go
      const yours = youIn(c, a) ? a : youIn(c, b) ? b : null;
      if (yours) return engage(c, yours, yours === a ? b : a);
      battle(c, a, b);
      return;
    }
  }
  /** Are you in this army now: commanding it, or riding beside its banner? */
  const youIn = (c, a) => a.commander === PLAYER || riding(c, a);
  /**
   * You are in an army that meets another: the shared battle (P9-B2). The enemy commander's party is the
   * encounter; both armies' lords near enough ride in (js/reinforce.js). `afterBattle` settles the armies.
   */
  function engage(c, ours, foe) {
    const fq = lead(c, foe);
    if (!fq?.id || CL.game.contactParty || !['map'].includes(CL.game.mode)) return null;
    c.armyFight = { ours: ours.id, foe: foe.id, until: c.day + 1, power: powerOf(c, foe) };
    CL.game.contactParty = fq.id;
    CL.ui.message(`The ${factionName(foe.realm)}'s army under ${R().titled(foe.commander, c)} offers battle!`);
    log(ours, c.day, `It meets the ${factionName(foe.realm)}'s army.`);
    return c.armyFight;
  }
  /** Is this party the one leading an army you are fighting (js/reinforce.js: more of its lords ride in)? */
  const fighting = (c, partyId) => {
    const f = c.armyFight;
    return Boolean(f && c.day < f.until && lead(c, byId(c, f.foe) || { commander: null })?.id === partyId);
  };
  /** After your battle with an army (js/parties.js onBattleResolved, before its commander's party is settled). */
  function afterBattle(c, partyId, win) {
    const f = c.armyFight;
    if (!f) return null;
    const ours = byId(c, f.ours);
    const foe = byId(c, f.foe);
    const fq = foe && lead(c, foe);
    if (!foe || fq?.id !== partyId) return null;
    c.armyFight = null;
    const left = powerOf(c, foe) - (win ? A().troopsPower(fq.troops) : 0);
    const broken = win && left < f.power * RULES.breakAt;
    const [wr, lr] = win ? [ours?.realm, foe.realm] : [foe.realm, ours?.realm];
    CL.diag.log('info', 'Army battle', { winner: wr, loser: lr, broken, you: true });
    CL.news?.record(c, 'army_battle', { x: c.world.x, y: c.world.y, faction: wr, other: lr, text: `The ${factionName(wr)}'s army beats the ${factionName(lr)}'s${broken ? ' and breaks it' : ''}.` });
    if (broken) {
      for (const q of parties(c, foe)) {
        if (q === fq) continue; // yours: js/parties.js takes them prisoner
        if (A().next(c) < RULES.capture) L().beaten(c, q, ours?.realm || 'player');
        else release(c, q);
      }
      foe.members = foe.members.filter((pid) => pid === foe.commander);
      disband(c, foe, 'broken');
    } else if (win) regroup(c, foe, 'beaten');
    if (!win && ours && ours.commander !== PLAYER) regroup(c, ours, 'beaten');
    if (!win && ours?.commander === PLAYER) CL.ui.message('Your army falls back with you.');
    return { broken };
  }

  /** Off-screen by the square law on both armies' power; losses fall on every party. */
  function battle(c, a, b) {
    const pa = powerOf(c, a);
    const pb = powerOf(c, b);
    const aWins = A().next(c) < A().winChance(pa, pb);
    const [w, l, pw, pl] = aWins ? [a, b, pa, pb] : [b, a, pb, pa];
    let lost = 0;
    for (const q of parties(c, w)) {
      const fallen = A().rollFallen(c, A().expand(q.troops), A().lossChance(A().WINNER_LOSS, pw, pl), true);
      A().removeTroops(q.troops, fallen);
      lost += fallen.length;
    }
    for (const q of parties(c, l)) {
      const fallen = A().rollFallen(c, A().expand(q.troops), A().lossChance(A().LOSER_LOSS, pl, pw), true);
      A().removeTroops(q.troops, fallen);
      lost += fallen.length;
    }
    const pt = { x: lead(c, l)?.x ?? lead(c, w).x, y: lead(c, l)?.y ?? lead(c, w).y };
    R().clashed(c, w.realm, l.realm, lost, pt);
    const after = powerOf(c, l);
    const broken = after < pl * RULES.breakAt;
    log(w, c.day, `It beats the ${factionName(l.realm)}'s army.`);
    log(l, c.day, broken ? 'It is broken in battle.' : 'It is beaten and falls back.');
    CL.news?.record(c, 'army_battle', { ...pt, faction: w.realm, other: l.realm, text: `The ${factionName(w.realm)}'s army beats the ${factionName(l.realm)}'s${broken ? ' and breaks it' : ''}.` });
    CL.diag.log('info', 'Army battle', { winner: w.realm, loser: l.realm, lost, broken });
    for (const x of [w, l]) for (const q of parties(c, x)) if (!troopCount(q.troops)) L().beaten(c, q, x === w ? l.realm : w.realm);
    if (broken) {
      for (const q of parties(c, l)) {
        if (A().next(c) < RULES.capture) L().beaten(c, q, w.realm);
        else release(c, q);
      }
      l.members = [];
      disband(c, l, 'broken');
    } else if (list(c).includes(l)) regroup(c, l, 'beaten');
    if (list(c).includes(w) && muster(c, w)) choose(c, w);
    return { winner: w, loser: l, broken };
  }

  // ---- The end of an army ----

  function disband(c, a, why) {
    const i = list(c).indexOf(a);
    if (i < 0) return true;
    list(c).splice(i, 1);
    for (const q of parties(c, a)) release(c, q);
    if (a.siegeId) {
      const s = CL.sieges.list(c).find((x) => x.id === a.siegeId);
      if (s) s.army = null;
    }
    c.armyRest ||= {};
    c.armyRest[a.realm] = c.day + RULES.rest;
    if (call(c)?.army === a.id && call(c).answered) c.armyCall = null;
    CL.news?.record(c, 'army_disbanded', { place: a.rally, faction: a.realm, text: `The ${factionName(a.realm)}'s army breaks up (${why}).` });
    CL.diag.log('info', 'Army disbanded', { realm: a.realm, why });
    return true;
  }

  // ---- Capitals and realms ----

  /** A holding taken by an army: the ruler's seat moves; a realm with nothing left is gone. */
  function onTaken(c, sid, from) {
    if (!R().isRealm(from, c)) return;
    if (Object.values(c.holdings).some((x) => x.controller === from)) {
      if (c.realms?.[from]?.capital === sid) c.realms[from].capital = nearestOwn(c, from, at(sid));
      return;
    }
    gone(c, from);
  }
  /** A realm with no holdings is gone: its lords seek service elsewhere; a founded realm is removed. */
  function gone(c, f) {
    if (R().rules(PLAYER, c) === f) return; // your own realm ends by your hand (P9-T)
    // P10-00 (the long run): a rising that holds nothing has lost its civil war; it ends by the
    // rebellion's own rules (its lords home to their realm, its record gone with it).
    const rising = CL.rebellion?.ofRising(c, f);
    if (rising) {
      CL.rebellion.end(c, rising, 'crown');
      CL.diag.log('info', 'Realm gone', { realm: f });
      return;
    }
    const lords = Object.keys(c.people).filter((pid) => c.people[pid].realm === f && pid !== R().rulerOf(f, c) && c.people[pid].status === 'free');
    const other = R()
      .realms()
      .find((k) => k.id !== f && L().templateFor(k.id));
    for (const pid of lords) {
      const to = CL.nobles?.destination(c, pid) || other?.id;
      if (to) CL.nobles?.changeRealm(c, pid, to);
    }
    for (const a of list(c).filter((x) => x.realm === f)) disband(c, a, 'its realm is gone');
    for (const s of [...CL.sieges.list(c)]) if (s.realm === f) CL.sieges.end(c, s, 'lifted');
    CL.diag.log('info', 'Realm gone', { realm: f });
    CL.news?.record(c, 'realm_gone', { faction: f, text: `The ${factionName(f)} are no more: they hold nothing.` });
    if (c.realms?.[f]) {
      const dest = Object.fromEntries(Object.keys(c.people).filter((pid) => c.people[pid].realm === f && pid !== PLAYER).map((pid) => [pid, CL.nobles?.destination(c, pid) || other?.id]));
      for (const p of L().prisoners(c)) if (p.by === f) L().free(c, p, null);
      delete c.realms[f];
      delete c.rulers[f];
      if (c.crowns) delete c.crowns[f];
      for (const k of Object.keys(c.relations || {})) if (k.split('|').includes(f)) delete c.relations[k];
      c.treaties = (c.treaties || []).filter((t) => !t.between.includes(f));
      for (const [x, row] of Object.entries(c.trust || {})) {
        if (x === f) delete c.trust[x];
        else delete row[f];
      }
      // Its founder, and any of its people still held or away: to the realm they think best of, else another.
      for (const [pid, p] of Object.entries(c.people)) {
        if (p.realm !== f || pid === PLAYER) continue;
        p.realm = dest[pid] || other?.id || p.realm;
        p.home = R().capitalOf(p.realm, c) || p.home;
        p.regroup = true;
        const q = L().partyOf(c, pid);
        if (q) c.parties.splice(c.parties.indexOf(q), 1);
      }
    } else if (c.crowns?.[f]) c.crowns[f].gone = c.day;
    L().ensure(c, c.day, true);
  }
  const isGone = (c, f) => c.crowns?.[f]?.gone != null;

  // ---- Words ----

  const OBJECTIVES = { besiege: 'besieging', relieve: 'riding to relieve', raid: 'riding to raid', pursue: 'pursuing an army', defend: 'defending', regroup: 'falling back to', follow: 'riding with you from' };
  /** What a lord of an army is doing, for their tap card: "riding with the Valedorn Crown's army (5 lords, 180 soldiers), besieging Castra Nova". */
  function doing(c, p) {
    const a = byId(c, p.armyId);
    if (!a) return null;
    const what = a.phase === 'rally' ? `gathering at ${placeName(a.rally)}` : a.objective === 'follow' ? 'riding with you' : a.objective === 'pursue' ? 'pursuing an army' : `${OBJECTIVES[a.objective]} ${placeName(a.target)}`;
    const role = p.lordId === a.commander ? 'leading' : 'riding with';
    return `${role} the ${factionName(a.realm)}'s army (${a.members.length} lords, ${soldiers(c, a)} soldiers), ${what}`;
  }
  /** One line for an army: who, how many, doing what. */
  function line(c, a) {
    const what = a.phase === 'rally' ? `gathering at ${placeName(a.rally)}` : a.objective === 'follow' ? 'riding with you' : a.objective === 'pursue' ? `pursuing the ${factionName(byId(c, a.target)?.realm)}'s army` : `${OBJECTIVES[a.objective] || a.objective} ${placeName(a.target)}`;
    const who = a.commander === PLAYER ? 'you' : R().titled(a.commander, c);
    return `The ${factionName(a.realm)}'s army under ${who}: ${a.members.length} lords, ${soldiers(c, a)} soldiers, ${what}; food for ${a.food} days.`;
  }

  /**
   * How a party of an army is drawn (js/render.js): the army (its banner, on the commander's party, or
   * the first lord's when you command it), false (under the banner), or null (on its own: gathering, or
   * strayed from it).
   */
  function bannerOf(c, p) {
    const a = byId(c, p.armyId);
    if (!a || a.phase === 'rally') return null;
    const flag = a.commander === PLAYER ? L().partyOf(c, a.members[0]) : lead(c, a);
    if (!flag) return null;
    if (flag === p) return a;
    return dist(p, flag) <= RULES.spread * 4 ? false : null;
  }

  /**
   * The phone's army test (Debug → Four armies, scripts/bench-map.js --armies): up to four realms each
   * march an army of up to five of their free lords near a point, defending their capital for a week.
   */
  function testArmies(c, near, n = 4, size = 5) {
    let armies = 0;
    let lords = 0;
    R()
      .realms()
      .filter((k) => L().templateFor(k.id))
      .slice(0, n)
      .forEach((k, i) => {
        if (ofRealm(c, k.id)) return;
        const qs = L()
          .riders(c)
          .filter((pid) => c.people[pid].realm === k.id && c.people[pid].status === 'free')
          .map((pid) => L().partyOf(c, pid))
          .filter((q) => q && q.armyId == null && !q.siegeId)
          .slice(0, size);
        const rally = R().capitalOf(k.id, c);
        if (qs.length < RULES.minLords || !rally) return;
        const [cx, cy] = CL.world.clampToMap(near.x + Math.cos((i * Math.PI) / 2) * 14, near.y + Math.sin((i * Math.PI) / 2) * 14, 2);
        for (const [j, q] of qs.entries()) Object.assign(q, { x: cx + j * 0.8, y: cy, tx: null, ty: null });
        c.nextArmyId = (c.nextArmyId || 0) + 1;
        const a = { id: c.nextArmyId, realm: k.id, commander: qs[0].lordId, members: qs.map((q) => q.lordId), objective: 'defend', target: rally, rally, since: c.day, food: RULES.food.start, phase: 'march', strength: 0, fedDay: Math.floor(c.day), set: c.day, log: [] };
        list(c).push(a);
        for (const q of qs) Object.assign(q, { armyId: a.id, intent: 'army' });
        pace(c, a);
        a.strength = powerOf(c, a);
        armies++;
        lords += qs.length;
      });
    return { armies, lords };
  }

  // ---- Checks and saves ----

  function invariants(c) {
    const bad = [];
    const seen = new Set();
    for (const a of list(c)) {
      if (!R().isRealm(a.realm, c)) bad.push(`army ${a.id} of no realm`);
      if (a.commander !== PLAYER && !a.members.includes(a.commander)) bad.push(`army ${a.id}'s commander is not in it`);
      if (a.commander === PLAYER && R().rules(PLAYER, c) !== a.realm) bad.push(`army ${a.id} is yours, of a realm you do not rule`);
      for (const pid of a.members) {
        if (seen.has(pid)) bad.push(`${pid} in two armies`);
        seen.add(pid);
        const q = L().partyOf(c, pid);
        if (q && q.armyId !== a.id) bad.push(`${pid}'s party does not know its army`);
      }
    }
    for (const q of c.parties || []) if (q.armyId != null && !byId(c, q.armyId)?.members.includes(q.lordId)) bad.push(`party ${q.id} in no army`);
    return bad;
  }

  const migrate = (d) => ({ ...d, version: 29, armies: [], nextArmyId: 0, armyRest: {}, armyCall: null });

  function sanitize(s, d) {
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    s.armies = [];
    s.nextArmyId = Number.isInteger(d?.nextArmyId) ? d.nextArmyId : 0;
    const used = new Set();
    for (const x of Array.isArray(d?.armies) ? d.armies : []) {
      if (!R().isRealm(x?.realm, s) || !Number.isInteger(x.id) || s.armies.some((y) => y.id === x.id || y.realm === x.realm)) continue;
      const members = (Array.isArray(x.members) ? x.members : []).filter((pid) => typeof pid === 'string' && !used.has(pid) && s.people?.[pid]?.status === 'free' && s.people[pid].realm === x.realm && s.parties.some((q) => q.lordId === pid));
      if (!members.length || !place(x.rally)) continue;
      const objective = Object.hasOwn(OBJECTIVES, x.objective) ? x.objective : 'regroup';
      const target = objective === 'pursue' ? (Number.isInteger(x.target) ? x.target : null) : place(x.target) ? x.target : x.rally;
      const a = {
        id: x.id,
        realm: x.realm,
        commander: x.commander === PLAYER && s.rulers?.[x.realm] === PLAYER ? PLAYER : members.includes(x.commander) ? x.commander : members[0],
        members,
        objective: target == null ? 'regroup' : objective,
        target: target == null ? x.rally : target,
        rally: x.rally,
        since: num(x.since) ? x.since : s.day,
        food: num(x.food) ? Math.max(0, Math.min(RULES.food.max, x.food)) : RULES.food.start,
        phase: x.phase === 'rally' ? 'rally' : 'march',
        strength: num(x.strength) ? x.strength : 0,
        fedDay: Number.isInteger(x.fedDay) ? x.fedDay : Math.floor(s.day),
        log: (Array.isArray(x.log) ? x.log : []).filter((l) => l && num(l.day) && typeof l.text === 'string').slice(-RULES.logMax),
      };
      for (const k of ['marched', 'set', 'broke']) if (num(x[k])) a[k] = x[k];
      if (Number.isInteger(x.siegeId) && s.sieges?.some((y) => y.id === x.siegeId)) a.siegeId = x.siegeId;
      if (num(x.paid)) a.paid = x.paid;
      if (num(x.spoils)) a.spoils = x.spoils;
      if (Array.isArray(x.tried)) a.tried = x.tried.filter((sid) => place(sid));
      for (const pid of members) used.add(pid);
      s.nextArmyId = Math.max(s.nextArmyId, a.id);
      s.armies.push(a);
    }
    for (const q of s.parties || []) {
      const a = q.lordId ? s.armies.find((y) => y.members.includes(q.lordId)) : null;
      delete q.pace;
      if (a) {
        q.armyId = a.id;
        if (!q.siegeId) q.intent = 'army';
      } else {
        delete q.armyId;
        if (q.intent === 'army') q.intent = 'home';
      }
    }
    for (const a of s.armies) {
      const cq = s.parties.find((q) => q.lordId === a.commander);
      const slow = Math.min(...a.members.map((pid) => tpl(s.parties.find((q) => q.lordId === pid)?.template)?.speed ?? Infinity));
      if (cq && Number.isFinite(slow)) cq.pace = slow;
    }
    for (const sg of s.sieges || []) if (sg.army != null && !s.armies.some((a) => a.id === sg.army)) delete sg.army;
    s.armyRest = {};
    for (const [f, day] of Object.entries(d?.armyRest || {})) if (R().isRealm(f, s) && num(day) && day > s.day) s.armyRest[f] = day;
    const m = d?.armyCall;
    s.armyFight = null; // a battle is not saved mid-fight
    s.armyCall = m && s.armies.some((a) => a.id === m.army) ? { army: m.army, day: num(m.day) ? m.day : s.day, answered: m.answered === true } : null;
    for (const h of Object.values(s.holdings || {})) {
      if (h.raided != null && !(Number.isInteger(h.raided) && h.raided > s.day - RULES.raid.days)) delete h.raided;
      if (h.foraged != null && !Number.isInteger(h.foraged)) delete h.foraged;
    }
  }

  CL.armies = { RULES, OBJECTIVES, bannerOf, doing, testArmies, list, byId, of, ofRealm, mine, raiseMine, order, leave, engage, fighting, afterBattle, youIn, parties, lead, powerOf, soldiers, landAt, readyTown, needed, plan, targets, raise, pace, summonPlayer, riding, postFor, step, weekly, choose, valid, raidable, raid, battle, disband, onSiegeEnd, onTaken, gone, isGone, line, invariants, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
