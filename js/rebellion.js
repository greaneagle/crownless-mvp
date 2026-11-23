// @ts-check
/* Crownless rebellion (P9-04, design §18.5–18.6): factions from grievances, warnings, the ruler's
 * responses, demands, the rising, its outcomes, and deposition (the player's too).
 *
 * - **A faction** forms in a realm when three or more of its riding lords think −30 or worse of the
 *   ruler and +10 or better of one another. Its claimant: one of them with a claim to the crown (kin of
 *   the ruler), else the strongest by riding troops. No roll: grievances alone.
 * - **Warnings,** a week apart: a rumour in the news; a companion's word (if one rides with you and you
 *   serve or rule that realm); a faction lord who thinks well of you tells you. The AI ruler hears them
 *   too, and answers after the second.
 * - **Responses** (an AI ruler by what it has to give; you from the Your realm tab): a concession (a
 *   village of the crown's own, the share 2 points lower, or an office: the faction +15), a mediator (a
 *   lord liked by both: +10 and 30 days' pause), divide (a village to one member: they leave), arrest
 *   (the claimant held: half the time they rise at once), prepare (the rising starts a quarter weaker).
 * - **Demands,** 14 days: met, the faction breaks up; refused, it rises as a realm of its own (P9-03)
 *   at war with the crown, and every other lord of the realm chooses a side by opinion. You, sworn to
 *   it, are summoned by both.
 * - **Outcomes,** when that war ends: peace (or the war worn out) is a compromise (the claimant pardoned
 *   with a concession, the rebels home again); all the rebels' forts taken, the crown wins (their fiefs
 *   revoked); the crown left no fort, the rebels win (the claimant rules; the old ruler keeps their own
 *   land as a lord). After any of them, 90 days of peace in that realm; a ruler who conceded gains +10
 *   with all its lords.
 * - **Deposed** (SC-26, SC-27): you keep your person, company, companions, businesses and a claim to
 *   the crown; your land goes to the new ruler. An old enemy who thinks well of you may offer refuge. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    grudge: -10, // members' opinion of their ruler, at most (P9-T tunes; the Brief's -30 formed none in a year)
    bond: 0, // members' opinion of one another, at least (P9-T tunes)
    least: 3, // lords to form a faction
    warnEvery: 7,
    warnings: 3,
    demandDays: 14,
    pauseDays: 30, // a mediator's
    quietDays: 90, // after a rebellion, in that realm
    share: 0.02, // a concession of the crown's share
    side: 10, // a lord joins the rising who thinks this much better of the claimant than of the ruler
    prepared: 0.75, // a rising the crown prepared for starts with this much of its strength
    fear: 0.5, // an AI ruler meets demands when the faction rides with this share of the loyal's strength
    refuge: 0, // an old enemy's ruler's opinion of you, less half its trust in your old realm, at least this
  };
  const RESPONSES = ['concession', 'mediator', 'divide', 'arrest', 'prepare'];
  const PLAYER = 'player';

  const R = () => CL.realm;
  const N = () => CL.nobles;
  const placeName = (sid) => CL.content.table('settlements')[sid]?.name || sid;
  const short = (f) => R().faction(f)?.short || f;
  const opinion = (c, a, b) => (N() ? N().opinion(c, a, b) : 0);
  const titled = (c, pid) => (pid === PLAYER ? c.character?.name || 'you' : R().titled(pid, c));

  const blank = () => ({ list: [], quiet: {}, nextId: 0, summons: null, refuge: null, deposed: null });
  const state = (c) => (c.rebellions ||= blank());
  const active = (c, f) => state(c).list.find((x) => x.realm === f) || null;
  const byId = (c, id) => state(c).list.find((x) => x.id === id) || null;
  /** The rebellion a rising realm belongs to. */
  const ofRising = (c, rid) => state(c).list.find((x) => x.rising === rid) || null;

  // ---- Who ----

  const riders = (c, f) => (CL.lords?.riders(c) || []).filter((pid) => c.people[pid]?.realm === f && c.people[pid].status === 'free');
  const men = (c, pid) => Object.values(CL.lords?.partyOf(c, pid)?.troops || {}).reduce((a, b) => a + b, 0);
  const strength = (c, pids) => pids.reduce((n, pid) => n + CL.autoresolve.troopsPower(CL.lords?.partyOf(c, pid)?.troops || {}), 0);

  /** The largest group of the realm's aggrieved lords who all think well of one another (3 or more). */
  function grievances(c, f) {
    const ruler = R().rulerOf(f, c);
    const angry = riders(c, f).filter((pid) => opinion(c, pid, ruler) <= RULES.grudge);
    let best = [];
    const n = angry.length;
    for (let mask = 1; mask < 1 << n && n <= 12; mask++) {
      const g = angry.filter((_, i) => mask & (1 << i));
      if (g.length <= best.length || g.length < RULES.least) continue;
      if (g.every((a) => g.every((b) => a === b || opinion(c, a, b) >= RULES.bond))) best = g;
    }
    return best;
  }
  /** The faction's claimant: kin of the ruler, else the strongest. */
  function claimantOf(c, f, members) {
    const ruler = R().rulerOf(f, c);
    const kin = members.find((pid) => c.people[pid].kin.some((k) => k.person === ruler));
    return kin || [...members].sort((a, b) => men(c, b) - men(c, a) || a.localeCompare(b))[0] || null;
  }

  // ---- Forming and warning ----

  /** A faction forms where grievances are (the realm's first in its quiet days, one at a time). */
  function form(c, f, { force = false } = {}) {
    if (active(c, f) || ofRising(c, f) || (!force && (state(c).quiet[f] || 0) > c.day)) return null;
    let members = grievances(c, f);
    if (force && members.length < RULES.least) {
      const ruler = R().rulerOf(f, c);
      members = riders(c, f).sort((a, b) => opinion(c, a, ruler) - opinion(c, b, ruler)).slice(0, RULES.least); // Debug: the unhappiest
    }
    if (members.length < RULES.least) return null;
    const s = state(c);
    s.nextId += 1;
    const x = { id: s.nextId, realm: f, claimant: claimantOf(c, f, members), members, formed: Math.floor(c.day), stage: 'faction', warned: 0, nextWarn: c.day, pausedUntil: null, demand: null, prepared: false, responded: null, conceded: false, rising: null, rose: null };
    s.list.push(x);
    CL.diag.log('info', 'Faction formed', { realm: f, claimant: x.claimant, members });
    return x;
  }

  /** The player hears: you serve or rule this realm. */
  const touches = (c, f) => R().rules(PLAYER, c) === f || CL.allegiance?.serves(c) === f;
  /** One warning, a week after the last: the rumour, the companion's word, a friendly lord's. */
  function warn(c, x) {
    x.warned += 1;
    const n = x.warned;
    x.nextWarn = c.day + RULES.warnEvery;
    const ruler = R().rulerOf(x.realm, c);
    const text = n === 1 ? `Whispers at the court of ${R().faction(x.realm)?.name}: some of its lords meet behind ${titled(c, ruler)}'s back.` : n === 2 ? `It is said ${titled(c, x.claimant)} gathers friends against ${titled(c, ruler)}.` : `${x.members.length} lords of ${short(x.realm)} stand with ${titled(c, x.claimant)}. They will make demands.`;
    CL.news?.record(c, 'faction_rumour', { faction: x.realm, place: c.people[x.claimant]?.home, text });
    if (c === CL.campaign && touches(c, x.realm)) {
      if (n === 2) {
        const mate = c.companion ? 'Mara' : c.retinue?.length ? CL.retinue.name(c.retinue[0]) : null;
        if (mate) CL.ui.message(`${mate}: "There's talk among ${short(x.realm)}'s lords. ${titled(c, x.claimant)} is gathering friends. It may come to blood."`);
      }
      if (n === 3) {
        const friend = x.members.find((pid) => opinion(c, pid, PLAYER) >= 20);
        if (friend) CL.ui.message(`${titled(c, friend)} tells you: "We will put our demands to ${titled(c, ruler)}. Stand with us, or out of the way."`);
      }
    }
    CL.diag.log('info', 'Faction warning', { realm: x.realm, warning: n });
  }

  // ---- Responses ----

  /** A village of the crown's own, to give. */
  const crownVillage = (c, f) => Object.keys(c.holdings).find((sid) => c.holdings[sid].kind === 'village' && c.holdings[sid].sovereign === f && c.holdings[sid].holder === R().rulerOf(f, c) && !R().locked(c, sid) && !R().locked(c, c.holdings[sid].seat));
  /** A lord liked by both the ruler and the claimant (not in the faction). */
  function mediatorFor(c, x) {
    const ruler = R().rulerOf(x.realm, c);
    return riders(c, x.realm).find((pid) => !x.members.includes(pid) && opinion(c, ruler, pid) >= RULES.bond && opinion(c, x.claimant, pid) >= RULES.bond) || null;
  }
  /** Give: a village to `pid`, else an office (the marshal's), else the crown's share. Returns what. */
  function give(c, f, pid, { share = true } = {}) {
    const v = crownVillage(c, f);
    if (v && R().fiefsOf(pid, c).length < R().fiefCap(f, c) && R().transfer(c, v, { holder: pid, willing: true, reason: 'concession' })) return `${placeName(v)} for ${titled(c, pid)}`;
    const k = CL.crowns?.record(c, f);
    if (k && k.offices.marshal !== pid && 'marshal' in k.offices && R().fiefsOf(pid, c).length) {
      k.offices.marshal = pid;
      return `the marshal's office for ${titled(c, pid)}`;
    }
    if (share && k) {
      k.laws = { ...(k.laws || {}), share: Math.max(0, Math.round((CL.crowns.laws(c, f).share - RULES.share) * 100) / 100) };
      return `the crown's share lowered to ${Math.round(CL.crowns.laws(c, f).share * 100)}%`;
    }
    return null;
  }
  /** Those still aggrieved stay; the faction breaks below three. */
  function settle(c, x) {
    const ruler = R().rulerOf(x.realm, c);
    x.members = x.members.filter((pid) => opinion(c, pid, ruler) <= RULES.grudge);
    if (!x.members.includes(x.claimant)) x.claimant = claimantOf(c, x.realm, x.members);
    if (x.members.length < RULES.least) return end(c, x, 'dispersed');
    return null;
  }

  /** The ruler's answer to a faction (AI or you): one of RESPONSES. Returns { ok, text }. */
  function respond(c, id, kind) {
    const x = byId(c, id);
    if (!x || x.stage === 'rising' || !RESPONSES.includes(kind)) return { ok: false, text: 'Nothing to answer' };
    const f = x.realm;
    const ruler = R().rulerOf(f, c);
    x.responded = kind;
    let text = '';
    if (kind === 'concession') {
      const what = give(c, f, x.claimant);
      if (!what) return { ok: false, text: 'The crown has nothing left to give' };
      for (const pid of x.members) N()?.note(c, pid, ruler, 'conceded', { kin: false });
      x.conceded = true;
      text = `A concession: ${what}.`;
    } else if (kind === 'mediator') {
      const m = mediatorFor(c, x);
      if (!m) return { ok: false, text: 'Nobody both sides trust' };
      for (const pid of x.members) N()?.note(c, pid, ruler, 'mediated', { kin: false });
      x.pausedUntil = c.day + RULES.pauseDays;
      text = `${titled(c, m)} mediates: the faction waits ${RULES.pauseDays} days.`;
    } else if (kind === 'divide') {
      const pid = x.members.filter((p) => p !== x.claimant).sort((a, b) => opinion(c, b, ruler) - opinion(c, a, ruler))[0];
      const v = crownVillage(c, f);
      if (!pid || !v || !R().transfer(c, v, { holder: pid, willing: true, reason: 'favour' })) return { ok: false, text: 'Nothing to win one of them with' };
      N()?.note(c, pid, ruler, 'granted', { kin: false });
      x.members = x.members.filter((p) => p !== pid);
      text = `${titled(c, pid)} is won over with ${placeName(v)}, and leaves the faction.`;
    } else if (kind === 'arrest') {
      const who = x.claimant;
      if (c.people[who]?.status !== 'free' || !CL.lords?.arrest(c, who, f)) return { ok: false, text: 'The claimant is out of reach' };
      for (const pid of x.members) if (pid !== who) N()?.note(c, pid, ruler, 'abandoned', { kin: false });
      x.members = x.members.filter((p) => p !== who);
      x.claimant = claimantOf(c, f, x.members);
      const rises = CL.autoresolve.next(c) < 0.5;
      text = `${titled(c, who)} is arrested.${rises ? ' The faction rises at once.' : ''}`;
      CL.news?.record(c, 'faction_rumour', { faction: f, text: `${titled(c, ruler)} has ${titled(c, who)} arrested.` });
      if (rises && x.members.length) {
        rise(c, x);
        return { ok: true, text };
      }
    } else if (kind === 'prepare') {
      x.prepared = true;
      text = `${titled(c, ruler)} calls the loyal lords to arms: if it comes to war, the faction starts weaker.`;
    }
    CL.diag.log('info', 'Faction answered', { realm: f, response: kind });
    settle(c, x);
    return { ok: true, text };
  }

  /** An AI ruler's answer: confident (its loyal lords twice the faction), it prepares; else a mediator, a gift, readiness, the cell. */
  function aiResponse(c, x) {
    const loyal = riders(c, x.realm).filter((pid) => !x.members.includes(pid));
    if (strength(c, loyal) >= 2 * strength(c, x.members)) return 'prepare';
    if (mediatorFor(c, x)) return 'mediator';
    if (crownVillage(c, x.realm)) return R().fiefsOf(x.claimant, c).length ? 'divide' : 'concession';
    return x.members.length >= 4 ? 'prepare' : 'arrest';
  }

  // ---- Demands and the rising ----

  /** The demands are met: what the claimant asked is given, and the faction breaks up. */
  function meet(c, id) {
    const x = byId(c, id);
    if (x?.stage !== 'demands') return { ok: false, text: 'No demands to meet' };
    const what = give(c, x.realm, x.claimant) || 'their grievances heard';
    x.conceded = true;
    for (const pid of x.members) N()?.note(c, pid, R().rulerOf(x.realm, c), 'conceded', { kin: false });
    end(c, x, 'met');
    return { ok: true, text: `The demands are met: ${what}. The faction breaks up.` };
  }
  /** Refused: they rise. */
  function refuse(c, id) {
    const x = byId(c, id);
    if (x?.stage !== 'demands') return { ok: false, text: 'No demands to refuse' };
    rise(c, x);
    return { ok: true, text: `You refuse. ${titled(c, x.claimant)} raises the banner of revolt.` };
  }

  /** The faction rises: a realm of its own (P9-03), at war with the crown; the others choose by opinion. */
  function rise(c, x) {
    const f = x.realm;
    const ruler = R().rulerOf(f, c);
    const claimant = x.claimant;
    if (!claimant || !c.people[claimant]) return end(c, x, 'dispersed');
    // The others choose a side by what they think of the claimant and the ruler.
    for (const pid of riders(c, f)) if (!x.members.includes(pid) && opinion(c, pid, claimant) > opinion(c, pid, ruler) + RULES.side) x.members.push(pid);
    c.nextRealmId = (c.nextRealmId || 0) + 1;
    const id = `r${c.nextRealmId}`;
    const base = R().faction(f);
    const palette = CL.content.table('realm_palette').banners?.colors || [];
    const used = new Set(R().kingdoms(c).map((k) => k.color));
    const name = c.people[claimant].name.split(' ').at(-1);
    const seat = x.members.flatMap((pid) => R().fiefsOf(pid, c)).find((sid) => c.holdings[sid].kind !== 'village') || null;
    c.realms ||= {};
    c.realms[id] = { id, name: `The ${name} Rising`, short: `${name} rebels`.slice(0, 20), emblem: name[0].toUpperCase(), color: palette.find((p) => !used.has(p)) || '#888888', culture: base.culture, troops: base.troops || f, capital: seat, laws: {}, founded: Math.floor(c.day), by: claimant, recognised: [], pending: null, rising: f };
    R().ensureTemplates(c);
    c.rulers[id] = claimant;
    for (const pid of x.members) c.people[pid].realm = id;
    for (const pid of x.members) {
      // Forts and towns first (their villages go with them); a village under a loyal seat stays with the
      // crown, and its holder keeps a claim to it.
      const fiefs = R().fiefsOf(pid, c).sort((a, b) => (c.holdings[a].kind === 'village') - (c.holdings[b].kind === 'village'));
      for (const sid of fiefs) {
        if (c.holdings[sid].sovereign === id) continue;
        if (!R().locked(c, sid) && R().transfer(c, sid, { controller: id, sovereign: id, holder: pid, willing: true, reason: 'rising', quiet: true })) {
          if (ruler) R().addClaim(c, sid, { by: ruler, realm: f, kind: 'old' });
        } else if (ruler) R().transfer(c, sid, { holder: ruler, reason: 'rising', quiet: true });
      }
      const q = CL.lords?.partyOf(c, pid);
      if (pid === claimant && q) c.parties.splice(c.parties.indexOf(q), 1); // the claimant keeps to their seat, as a ruler does
      else if (q) {
        q.template = `lord_${id}`;
        if (x.prepared) for (const t of Object.keys(q.troops)) q.troops[t] = Math.max(1, Math.floor(q.troops[t] * RULES.prepared));
      }
    }
    CL.crowns?.ensure(c);
    Object.assign(x, { stage: 'rising', rising: id, rose: Math.floor(c.day), demand: null });
    R().setRelation(c, f, id, 'war', 'rising', null, c.day, id);
    const text = `${titled(c, claimant)} rises against ${titled(c, ruler)}: ${x.members.length} lords of ${short(f)} ride under ${c.realms[id].name}'s banner.`;
    CL.news?.record(c, 'rising', { faction: id, other: f, place: seat, text });
    CL.diag.log('info', 'Rising', { realm: f, rising: id, claimant, members: x.members });
    // You, sworn to the realm or in its pay, are summoned by both.
    if (c === CL.campaign && CL.allegiance?.serves(c) === f && R().rules(PLAYER, c) !== f) {
      state(c).summons = { id: x.id, day: Math.floor(c.day) };
      CL.ui.message(`Civil war in ${short(f)}: ${titled(c, ruler)} and ${titled(c, claimant)} both summon you. Choose a side on the Realms screen, Allegiance tab.`);
    } else if (c === CL.campaign && R().rules(PLAYER, c) === f) CL.ui.message(`${text} It is war.`);
    return x;
  }

  /** Your side in a rising you were summoned to: 'crown' or 'rebels'. */
  function chooseSide(c, side) {
    const s = state(c);
    const x = s.summons && byId(c, s.summons.id);
    if (x?.stage !== 'rising' || !['crown', 'rebels'].includes(side)) return { ok: false, text: 'No summons to answer' };
    s.summons = null;
    const f = x.realm;
    if (side === 'crown') {
      N()?.note(c, R().rulerOf(f, c), PLAYER, 'answered', { kin: false });
      R().adjust(c, f, R().REP.help, 'stood with the crown');
      return { ok: true, text: `You stand with ${titled(c, R().rulerOf(f, c))}.` };
    }
    CL.allegiance?.joinRising(c, f, x.rising);
    N()?.note(c, x.claimant, PLAYER, 'backed', { kin: false });
    return { ok: true, text: `You ride with ${titled(c, x.claimant)}'s rising.` };
  }

  // ---- Outcomes ----

  const forts = (c, f) => Object.keys(c.holdings).filter((sid) => c.holdings[sid].controller === f && c.holdings[sid].kind === 'fort');

  /** End a rebellion: 'met', 'dispersed', 'compromise', 'crown' or 'rebels'. */
  function end(c, x, how) {
    const s = state(c);
    const i = s.list.indexOf(x);
    if (i < 0) return null;
    s.list.splice(i, 1);
    const f = x.realm;
    if (x.rising) settleRising(c, x, how);
    s.quiet[f] = c.day + RULES.quietDays;
    if (x.conceded || how === 'met') for (const pid of Object.keys(c.people)) if (c.people[pid].realm === f && !R().rules(pid, c)) N()?.note(c, pid, R().rulerOf(f, c), 'kept_peace', { kin: false }); // a ruler who conceded is trusted more
    if (s.summons?.id === x.id) s.summons = null;
    const words = { met: 'Its demands met, the faction breaks up.', dispersed: 'The faction melts away.', compromise: 'The civil war ends in a compromise: the claimant is pardoned.', crown: 'The crown has won the civil war.', rebels: `The rebels have won: ${titled(c, R().rulerOf(f, c))} rules now.` }[how];
    CL.news?.record(c, 'rebellion_ended', { faction: f, text: `${short(f)}: ${words}` });
    CL.diag.log('info', 'Rebellion ended', { realm: f, how, days: x.rose != null ? Math.floor(c.day) - x.rose : 0 });
    return how;
  }

  /** The rising's realm ends; its lords and land go home, by the outcome. */
  function settleRising(c, x, how) {
    const f = x.realm;
    const id = x.rising;
    const oldRuler = R().rulerOf(f, c);
    if (how === 'rebels') {
      // The claimant takes the crown; the old ruler rides on as a lord (you: deposed).
      c.rulers[f] = x.claimant;
      if (oldRuler === PLAYER) depose(c, f);
      else if (c.people[oldRuler]) {
        c.people[oldRuler].realm = f;
        for (const sid of R().fiefsOf(oldRuler, c).slice(R().fiefCap(f, c))) c.holdings[sid].holder = x.claimant;
      }
    }
    // Its land goes home to the crown: kept by its holders, or (the crown won) revoked from the rebels.
    for (const sid of Object.keys(c.holdings)) {
      const h = c.holdings[sid];
      if (h.sovereign !== id && h.controller !== id) continue;
      const revoke = how === 'crown' && (x.members.includes(h.holder) || h.holder === PLAYER);
      Object.assign(h, { controller: h.controller === id ? f : h.controller, sovereign: f, holder: revoke ? R().rulerOf(f, c) : h.holder });
      h.claims = h.claims.filter((k) => k.by !== h.holder);
    }
    for (const pid of Object.keys(c.people)) {
      if (c.people[pid].realm !== id) continue;
      c.people[pid].realm = f;
      if (how === 'crown') N()?.note(c, pid, R().rulerOf(f, c), 'revoked', { kin: false });
      if (how === 'compromise') N()?.note(c, pid, R().rulerOf(f, c), 'pardoned', { kin: false });
      const q = CL.lords?.partyOf(c, pid);
      if (q) c.parties.splice(c.parties.indexOf(q), 1);
      c.people[pid].regroup = true;
      c.people[pid].home = R().fiefsOf(pid, c)[0] || R().capitalOf(f, c);
    }
    // No lord home again holds more than the realm's law allows: the rest to the crown, to grant.
    for (const pid of x.members) for (const sid of R().fiefsOf(pid, c).slice(R().fiefCap(f, c))) c.holdings[sid].holder = R().rulerOf(f, c);
    for (const h of Object.values(c.holdings)) if (h.sovereign === f) h.claims = h.claims.filter((k) => k.by !== h.holder); // a claim made good is a claim no more
    if (how === 'compromise' && c.people[x.claimant]) give(c, f, x.claimant, { share: false });
    for (const p of CL.lords?.prisoners(c) || []) if (p.by === id || (p.arrested && p.by === f && how !== 'crown')) CL.lords.free(c, p, null);
    for (const sg of [...(CL.sieges?.list(c) || [])]) if (sg.realm === id) CL.sieges.end(c, sg, 'lifted');
    // Its treasury goes to the realm, and the realm itself is gone.
    const left = CL.crowns?.treasury(c, id) || 0;
    if (left) CL.crowns.pay(c, CL.crowns.side(id), CL.crowns.side(f), left, 'tribute');
    if (CL.allegiance?.serves(c) === id) CL.allegiance.joinRising(c, id, f, { home: true, keep: how !== 'crown' });
    delete c.realms[id];
    delete c.rulers[id];
    if (c.crowns) delete c.crowns[id];
    for (const k of Object.keys(c.relations || {})) if (k.split('|').includes(id)) delete c.relations[k];
    c.treaties = (c.treaties || []).filter((t) => !t.between.includes(id));
    for (const [a, row] of Object.entries(c.trust || {})) {
      if (a === id) delete c.trust[a];
      else delete row[id];
    }
    CL.lords?.ensure(c, c.day, true);
  }

  /** You lose your crown: your land to the new ruler, a claim to the crown kept, perhaps a refuge offered. */
  function depose(c, f) {
    const s = state(c);
    const seat = c.realms?.[f]?.capital || R().capitalOf(f, c);
    const newRuler = R().rulerOf(f, c);
    for (const sid of R().fiefsOf(PLAYER, c)) {
      const h = c.holdings[sid];
      h.holder = newRuler;
      R().addClaim(c, sid, { by: PLAYER, realm: f, kind: 'old' });
    }
    if (seat && !c.holdings[seat]?.claims.some((k) => k.by === PLAYER)) R().addClaim(c, seat, { by: PLAYER, realm: f, kind: 'old' });
    s.deposed = { realm: f, day: Math.floor(c.day) };
    if (c.rule) c.rule.asks = [];
    CL.diag.log('info', 'Deposed', { realm: f, by: newRuler });
    if (c === CL.campaign) CL.ui.message(`You are deposed: ${titled(c, newRuler)} rules ${R().faction(f)?.name}. Your company, companions and businesses are yours still, and so is your claim to the crown.`);
    offerRefuge(c, f);
  }

  /** Take the refuge offered: you swear to that realm, without the usual years of service. */
  function acceptRefuge(c) {
    const r = state(c).refuge;
    if (!r || c.day > r.until || !R().isRealm(r.realm)) return { ok: false, text: 'No refuge is offered' };
    state(c).refuge = null;
    CL.allegiance?.refuge(c, r.realm);
    return { ok: true, text: `You swear to ${titled(c, R().rulerOf(r.realm, c))} of ${short(r.realm)}, who takes you in.` };
  }

  /** SC-27: an old enemy of the realm that deposed you, whose ruler thinks well of you, offers refuge. */
  function offerRefuge(c, from) {
    const D = CL.diplomacy;
    const best = R()
      .realms(c)
      .map((k) => k.id)
      .filter((g) => g !== from && !c.realms?.[g]?.rising && R().rulerOf(g, c) !== PLAYER)
      .map((g) => ({ g, score: opinion(c, R().rulerOf(g, c), PLAYER) - (D ? D.trust(c, g, from) : 0) / 2 + (R().relation(c, g, from) === 'war' ? 10 : 0) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < RULES.refuge) return null;
    state(c).refuge = { realm: best.g, until: Math.floor(c.day) + 30 };
    if (c === CL.campaign) CL.ui.message(`${titled(c, R().rulerOf(best.g, c))} of ${short(best.g)} offers you refuge: take service at their capital within 30 days, and their court will hear your claim.`);
    CL.diag.log('info', 'Refuge offered', { realm: best.g });
    return best.g;
  }

  /** Did a rising end? Peace (or the war worn out) is a compromise; the rebels' forts all taken, the crown's win; the crown's, theirs. */
  function outcome(c, x) {
    const f = x.realm;
    const id = x.rising;
    if (!c.realms?.[id]) return end(c, x, 'compromise');
    if (R().relation(c, f, id) !== 'war') return end(c, x, 'compromise');
    if (!forts(c, id).length && !riders(c, id).length) return end(c, x, 'crown');
    if (!forts(c, id).length && c.day - x.rose >= RULES.demandDays) return end(c, x, 'crown');
    if (!forts(c, f).length && c.day - x.rose >= RULES.demandDays) return end(c, x, 'rebels');
    return null;
  }

  // ---- Time ----

  /** Weekly (the payday): factions form, warn, are answered, make demands, rise and end. */
  function weekly(c) {
    for (const k of R().realms(c)) if (!c.realms?.[k.id]?.rising) form(c, k.id);
    for (const x of [...state(c).list]) step(c, x);
  }
  function step(c, x) {
    const f = x.realm;
    const ruler = R().rulerOf(f, c);
    if (x.stage === 'rising') return outcome(c, x);
    x.members = x.members.filter((pid) => c.people[pid]?.realm === f && c.people[pid].status === 'free' && !R().rules(pid, c));
    if (!x.members.includes(x.claimant)) x.claimant = claimantOf(c, f, x.members);
    if (x.members.length < RULES.least || !x.claimant) return end(c, x, 'dispersed');
    if (x.pausedUntil != null && c.day < x.pausedUntil) return null;
    if (x.stage === 'faction') {
      if (x.warned < RULES.warnings) {
        if (c.day >= x.nextWarn) warn(c, x);
        if (x.warned === 2 && !x.responded && ruler !== PLAYER) respond(c, x.id, aiResponse(c, x));
        return null;
      }
      x.stage = 'demands';
      x.demand = { kind: R().fiefsOf(x.claimant, c).length ? 'office' : 'land', until: Math.floor(c.day) + RULES.demandDays };
      CL.news?.record(c, 'faction_rumour', { faction: f, text: `${titled(c, x.claimant)} and ${x.members.length - 1} lords put their demands to ${titled(c, ruler)}.` });
      if (ruler === PLAYER && c === CL.campaign) CL.ui.message(`${titled(c, x.claimant)} and ${x.members.length - 1} lords make demands of you: ${x.demand.kind === 'land' ? 'land for the claimant' : 'an office for the claimant'}. Meet them or refuse on the Your realm tab within ${RULES.demandDays} days.`);
      if (ruler !== PLAYER) {
        const loyal = riders(c, f).filter((pid) => !x.members.includes(pid));
        if (strength(c, x.members) >= RULES.fear * strength(c, loyal)) return meet(c, x.id);
      }
      return null;
    }
    if (x.stage === 'demands' && c.day >= x.demand.until) return rise(c, x);
    return null;
  }

  /** Debug: the chosen realm's unhappiest lords form a faction now; or its faction rises now. */
  const factionNow = (c, f) => form(c, f, { force: true });
  function riseNow(c, f) {
    const x = active(c, f);
    if (!x || x.stage === 'rising') return null;
    return rise(c, x);
  }

  // ---- Words ----

  /** A rebellion in a line, for the Realms screen. */
  function line(c, x) {
    const f = x.realm;
    if (x.stage === 'rising') return `Civil war: ${R().faction(x.rising)?.name || 'the rising'} (${titled(c, x.claimant)}, ${x.members.length} lords) against ${titled(c, R().rulerOf(f, c))}, since day ${CL.party.dayNumber(x.rose)}.`;
    if (x.stage === 'demands') return `${titled(c, x.claimant)} and ${x.members.length - 1} lords demand ${x.demand.kind === 'land' ? 'land' : 'an office'} by day ${CL.party.dayNumber(x.demand.until)}.`;
    return x.warned >= 2 ? `${titled(c, x.claimant)} gathers friends at court (${x.members.length} lords).` : 'Whispers at court.';
  }

  // ---- Checks and saves ----

  function invariants(c) {
    const out = [];
    const seen = new Set();
    for (const x of c.rebellions?.list || []) {
      if (seen.has(x.realm)) out.push(`${x.realm}: two rebellions at once`);
      seen.add(x.realm);
      if (x.stage === 'rising' && !c.realms?.[x.rising]) out.push(`rebellion ${x.id}: its rising is gone`);
    }
    return out;
  }

  /** 27 → 28 (build 3.10.0, P9-04): no factions or risings yet. */
  const migrate = (d) => ({ ...d, version: 28, rebellions: blank() });

  function sanitize(s, d) {
    const o = d?.rebellions && typeof d.rebellions === 'object' ? d.rebellions : {};
    s.rebellions = blank();
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    const seen = new Set();
    for (const x of Array.isArray(o.list) ? o.list : []) {
      if (!x || !Number.isInteger(x.id) || !R().isRealm(x.realm) || seen.has(x.realm) || !['faction', 'demands', 'rising'].includes(x.stage)) continue;
      const members = (Array.isArray(x.members) ? x.members : []).filter((pid) => s.people?.[pid]);
      if (!members.length || !s.people[x.claimant]) continue;
      if (x.stage === 'rising' && !s.realms?.[x.rising]) continue;
      seen.add(x.realm);
      s.rebellions.list.push({
        id: x.id,
        realm: x.realm,
        claimant: x.claimant,
        members: [...new Set(members)],
        formed: num(x.formed) ? x.formed : s.day,
        stage: x.stage,
        warned: Number.isInteger(x.warned) ? Math.max(0, Math.min(RULES.warnings, x.warned)) : 0,
        nextWarn: num(x.nextWarn) ? x.nextWarn : s.day,
        pausedUntil: num(x.pausedUntil) ? x.pausedUntil : null,
        demand: x.stage === 'demands' && num(x.demand?.until) ? { kind: x.demand.kind === 'office' ? 'office' : 'land', until: x.demand.until } : x.stage === 'demands' ? { kind: 'land', until: s.day + RULES.demandDays } : null,
        prepared: x.prepared === true,
        responded: RESPONSES.includes(x.responded) ? x.responded : null,
        conceded: x.conceded === true,
        rising: x.stage === 'rising' ? x.rising : null,
        rose: x.stage === 'rising' && num(x.rose) ? x.rose : null,
      });
    }
    s.rebellions.nextId = Math.max(Number.isInteger(o.nextId) ? o.nextId : 0, ...s.rebellions.list.map((x) => x.id), 0);
    for (const [f, v] of Object.entries(o.quiet && typeof o.quiet === 'object' ? o.quiet : {})) if (R().isRealm(f) && num(v)) s.rebellions.quiet[f] = v;
    if (o.summons && s.rebellions.list.some((x) => x.id === o.summons.id && x.stage === 'rising')) s.rebellions.summons = { id: o.summons.id, day: num(o.summons.day) ? o.summons.day : s.day };
    if (o.refuge && R().isRealm(o.refuge.realm) && num(o.refuge.until)) s.rebellions.refuge = { realm: o.refuge.realm, until: o.refuge.until };
    if (o.deposed && R().isRealm(o.deposed.realm) && num(o.deposed.day)) s.rebellions.deposed = { realm: o.deposed.realm, day: o.deposed.day };
  }

  CL.rebellion = { RULES, RESPONSES, blank, state, active, byId, ofRising, grievances, claimantOf, form, warn, respond, aiResponse, meet, refuse, rise, chooseSide, end, depose, offerRefuge, acceptRefuge, outcome, weekly, step, factionNow, riseNow, line, invariants, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
