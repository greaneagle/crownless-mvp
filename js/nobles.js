/* Crownless named nobles (P8-07, design §18.4, §28, Prototype F): the lords of P8-01 given needs,
 * motives and opinions, who answer requests (the player's, each other's and their ruler's summons) by
 * one model, and change realm by the player's rules (P8-04). `c.nobles` holds what they remember.
 *
 * - **Needs** (computed, never stored): land, coin, men, safety, standing, each with a score and the
 *   words for it; the top one shows on a lord's tap card and drives their intentions (js/parties.js)
 *   and their answers.
 * - **Motives** (stable, from the trait line): guards their lands, hungry for glory, loyal to the
 *   Crown, owes the realm nothing, minds the coin. They weigh the factors; they never change daily.
 * - **Opinions** (sparse: only pairs with a history): `opinions[from][to] = { rel, log }`. `rel` moves
 *   by deeds (DEEDS), half of it to the doer's close kin, and drifts a point a week toward nothing;
 *   `log` keeps the last deeds behind it (friendships, rivalries and feuds are read from it, never
 *   scripted). A lord's view of their own ruler starts from their motives.
 * - **Requests** (`consider`): relationship, obligation, interest and fear, each in plain words, give
 *   obey, negotiate (a price in crowns, or a favour: their petition), delay (a day) or refuse. The
 *   player asks from the Lords tab; the ruler's summons to a siege and a besieged lord's call for
 *   relief go through the same model. A request has a 3-day cooldown per lord, a refusal holds 7 days.
 * - **Between lords:** friends (fought together, relieved one another), rivals (one got the grant
 *   both wanted), feuds (one took the other's fief, or holds their kin): feuding lords won't ride
 *   together; friends back each other's grants (js/fiefs.js weighs it); a feud's claim is pressed
 *   in war (js/sieges.js aims at a fort its lords claim).
 * - **Changing realm:** a lord who thinks badly of their ruler grumbles at court (the news), and a
 *   week later leaves: asked release at peace (their fiefs go back to the crown), defects at war (lost,
 *   with a `granted` claim kept). Once in 60 days at most; never while at a siege; never leaving a realm
 *   with fewer than three riding lords. A lord who keeps refusing summons has a fief revoked.
 * - **Petitions:** a lord who thinks well of you (+10 or more) may ask a favour by their top need (clear bandits
 *   from their lands, lend coin, ransom their kin, back their claim, support them for a grant): one
 *   open at a time, with a reward paid once and a deadline.
 * - **Your summons:** a vassal is summoned to their realm's sieges; being there answers it (a day of
 *   service each day), staying away until it ends is a missed summons (P8-04). */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const PLAYER = 'player';

  const RULES = {
    obey: 30,
    negotiate: 10,
    delayGap: 25, // a temporary reason (thin ranks, busy) that would be met in time: delay rather than refuse
    cooldown: 3, // days between requests to one lord
    hardened: 7, // days a refusal holds
    rideDays: 3,
    backDays: 60,
    kinShare: 0.5,
    friend: 8, // a friendly deed and this much goodwill make a friend
    drift: 1, // a week, toward nothing
    logMax: 6,
    leaveBelow: -30, // a lord who thinks this little of their ruler grumbles, then leaves
    leaveAfter: 7, // days from the grumbling to leaving
    moveGap: 60, // days between changes of realm
    minRiders: 3, // a realm keeps at least this many riding lords
    revokeAfter: 2, // summonses refused in 60 days before a fief is revoked
    petition: { goodwill: 10, chance: 0.12, gap: 5, days: 10, loan: 100, interest: 30, loanDays: 14, bandits: 80, reach: 25 },
    price: { base: 50, perPoint: 8 },
  };
  // How each deed moves the doer in the eyes of the one it was done to.
  const DEEDS = {
    fought_beside: 8,
    relieved: 15,
    freed: 20,
    ransomed: 4,
    held: -6,
    held_kin: -8,
    ransomed_kin: 15,
    took_fief: -40,
    beat: -10,
    grant_won: -15,
    passed_over: -8,
    granted: 20,
    suggested: 15,
    handed: 8,
    defected: -25,
    left_kin: -10,
    refused: -4,
    refused_summons: -10,
    answered: 4,
    helped: 10,
    backed: 10,
    revoked: -30,
    neglected: -2,
    abandoned: -20,
    paid: 6,
  };
  const FRIENDLY_DEEDS = ['fought_beside', 'relieved', 'freed', 'ransomed_kin', 'helped', 'backed', 'suggested'];
  const CLOSE = ['parent', 'child', 'sibling', 'spouse'];
  const NEEDS = ['land', 'coin', 'men', 'safety', 'standing'];
  const KINDS = ['siege', 'relief', 'ride', 'back', 'summons'];
  const ANSWERS = ['obey', 'negotiate', 'delay', 'refuse'];
  const PETITIONS = ['bandits', 'loan', 'ransom', 'claim', 'grant'];
  // Motives from the trait line: the first words that match decide (a few per lord, stable).
  const MOTIVES = [
    ['guard', /watchful|cautious|careful|wary|walls|border/],
    ['glory', /reckless|eager|ambitious|brave|bold|fierce|rider|shieldmaiden|veteran/],
    ['loyal', /loyal|dutiful|sworn|keeps (?:his|her) word|law|pious|steady/],
    ['restless', /restless|proud|vain|cunning|sharp|grudge|slow to forgive|gambler/],
    ['coin', /thrifty|trader|debt|rich|gambler/],
    ['land', /hungry for land/],
  ];

  const R = () => CL.realm;
  const A = () => CL.autoresolve;
  const place = (id) => (typeof id === 'string' && CL.content.table('settlements')[id]) || null;
  const placeName = (id) => place(id)?.name || 'their lands';
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'the realm';
  const short = (f) => CL.content.table('factions')[f]?.short || factionName(f);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  const isPerson = (c, id) => id === PLAYER || Boolean(c.people?.[id]);
  const he = (c, id) => (R().person(id, c)?.gender === 'female' ? 'she' : 'he');
  const his = (c, id) => (R().person(id, c)?.gender === 'female' ? 'her' : 'his');
  const him = (c, id) => (R().person(id, c)?.gender === 'female' ? 'her' : 'him');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** `o[k]`, made first if missing. */
  const slot = (o, k, make) => {
    if (!o[k]) o[k] = make();
    return o[k];
  };

  /** @returns {any} */
  const blank = () => ({ opinions: {}, debts: [], petitions: [], asks: {}, pledges: [], moved: {}, warned: {}, summons: null, nextPetition: 1, petitionAfter: 0, week: 0 });
  /** @returns {any} */
  const state = (c) => (c.nobles ||= blank());

  // ---- Motives ----

  /** A lord's motives, from their trait line (stable). @param {Campaign} c @param {string} pid @returns {string[]} */
  function motives(c, pid) {
    const t = (c.people?.[pid]?.traits || '').toLowerCase();
    return MOTIVES.filter(([, re]) => re.test(t)).map(([m]) => m).slice(0, 2);
  }
  const has = (c, pid, m) => motives(c, pid).includes(m);

  /** "guards her lands, owes the Aurelians nothing" */
  function motiveLine(c, pid) {
    const p = c.people[pid];
    const words = {
      guard: `guards ${his(c, pid)} lands`,
      glory: 'hungry for glory',
      loyal: `loyal to the ${short(p.realm)} crown`,
      restless: `owes the ${short(p.realm)} crown nothing`,
      coin: 'minds the coin',
      land: 'hungry for land',
    };
    return motives(c, pid).map((m) => words[m]).join(', ');
  }

  // ---- Opinions ----

  /** The record of what `from` thinks of `to`, or null. */
  const entry = (c, from, to) => state(c).opinions[from]?.[to] || null;

  /** Where a lord's view of someone starts before any deed: their ruler by their motives, their kin warmly. */
  function base(c, from, to) {
    const p = c.people?.[from];
    if (!p) return 0;
    let n = 0;
    if (to === R().rulerOf(p.realm, c)) n += (has(c, from, 'loyal') ? 15 : 0) + (has(c, from, 'restless') ? -10 : 0);
    if (p.kin.some((k) => k.person === to)) n += 10;
    return n;
  }

  /** What `from` thinks of `to`, −100…100. @param {Campaign} c @param {string} from @param {string} to */
  const opinion = (c, from, to) => clamp(Math.round((entry(c, from, to)?.rel || 0) + base(c, from, to)), -100, 100);

  /**
   * `from` remembers a deed of `to`'s (DEEDS[kind]); half of it carries to `from`'s close kin. Only
   * people (or the player) of a real history: the ruler of a realm too.
   */
  function note(c, from, to, kind, { kin = true, day = c.day } = {}) {
    if (!DEEDS[kind] || from === to || from === PLAYER || !c.people?.[from] || !isPerson(c, to)) return;
    add(c, from, to, kind, DEEDS[kind], day, false);
    // A ransom waived is a debt (an obligation, paid by doing what is asked once).
    if (kind === 'freed' && !state(c).debts.some((x) => x.from === from && x.to === to && x.kind === 'freed')) state(c).debts.push({ from, to, kind: 'freed', day: c.day });
    if (!kin) return;
    for (const k of c.people[from].kin) if (CLOSE.includes(k.tie) && k.person !== to && c.people[k.person]) add(c, k.person, to, kind, DEEDS[kind] * RULES.kinShare, day, true);
  }
  function add(c, from, to, kind, delta, day, viaKin) {
    const e = slot(slot(state(c).opinions, from, () => ({})), to, () => ({ rel: 0, log: [] }));
    e.rel = clamp(Math.round((e.rel + delta) * 10) / 10, -100, 100);
    e.log = [...e.log, viaKin ? [kind, Math.floor(day), 1] : [kind, Math.floor(day)]].slice(-RULES.logMax);
  }

  /** The deeds behind an opinion, direct ones only. */
  const deeds = (c, from, to) => (entry(c, from, to)?.log || []).filter((x) => !x[2]);

  /** Between two people: 'feud', 'rival', 'friend' or null (read from their history, either way). */
  function tie(c, a, b) {
    const one = (x, y) => {
      const d = deeds(c, x, y).map((e) => e[0]);
      if (d.includes('took_fief') || holdsKin(c, y, x)) return 'feud';
      if (d.includes('grant_won')) return 'rival';
      if (opinion(c, x, y) >= RULES.friend && d.some((k) => FRIENDLY_DEEDS.includes(k))) return 'friend';
      return null;
    };
    const t = [one(a, b), one(b, a)];
    for (const k of ['feud', 'rival', 'friend']) if (t.includes(k)) return k;
    return null;
  }
  /** Does `who` (the player) hold a kinsman of `of`'s captive? */
  function holdsKin(c, who, of) {
    const p = c.people?.[of];
    if (!p) return false;
    return (c.prisoners || []).some((x) => x.by === who && p.kin.some((k) => k.person === x.lord));
  }
  /** Everyone a person has a tie of `kind` with. */
  function ties(c, pid, kind) {
    const out = new Set();
    for (const id of Object.keys(state(c).opinions[pid] || {})) if (tie(c, pid, id) === kind) out.add(id);
    for (const [from, o] of Object.entries(state(c).opinions)) if (o[pid] && from !== pid && tie(c, from, pid) === kind) out.add(from);
    return [...out];
  }

  /** The most telling deed behind an opinion, in words: "you freed him on day 12". */
  function deedWords(c, from, to) {
    const d = deeds(c, from, to).at(-1);
    const you = to === PLAYER ? 'you' : R().titled(to, c);
    if (!d) {
      // Only what was done to their kin: said as such.
      const k = (entry(c, from, to)?.log || []).at(-1);
      if (!k) return '';
      const verb = { freed: 'freed', ransomed: 'ransomed', held: 'held', held_kin: 'held', beat: 'beat', took_fief: 'took the fief of', fought_beside: 'fought beside', helped: 'helped', ransomed_kin: 'ransomed' }[k[0]] || 'dealt with';
      return `${you} ${verb} ${his(c, from)} kin on day ${CL.party.dayNumber(k[1])}`;
    }
    const h = him(c, from);
    const words = {
      fought_beside: `${you} fought beside ${h}`,
      relieved: `${you} relieved ${his(c, from)} fort`,
      freed: `${you} freed ${h} without ransom`,
      ransomed: `${you} took ${his(c, from)} ransom`,
      held: `${you} kept ${h} prisoner`,
      held_kin: `${you} held ${his(c, from)} kin`,
      ransomed_kin: `${you} ransomed ${his(c, from)} kin`,
      took_fief: `${you} took ${his(c, from)} fief`,
      beat: `${you} beat ${h} in the field`,
      grant_won: `${you} got the grant ${he(c, from)} wanted`,
      passed_over: `${you} passed ${h} over`,
      granted: `${you} granted ${h} land`,
      suggested: `${you} named ${h} for a fief`,
      handed: `${you} handed ${h} a conquest`,
      defected: `${you} broke faith`,
      left_kin: `${you} left ${his(c, from)} kin's realm`,
      refused: `${you} refused ${h}`,
      refused_summons: `${you} refused ${his(c, from)} summons`,
      answered: `${you} answered ${his(c, from)} call`,
      helped: `${you} did ${h} a favour`,
      backed: `${you} backed ${h}`,
      revoked: `${you} took back ${his(c, from)} fief`,
      neglected: `${you} left ${h} landless`,
      abandoned: `${you} left ${h} in a cell`,
      paid: `${you} paid ${his(c, from)} price`,
    };
    return `${words[d[0]] || 'they have a history'} on day ${CL.party.dayNumber(d[1])}`;
  }

  /** "He thinks well of you (+18): you freed him without ransom on day 12." */
  function opinionLine(c, from, to = PLAYER) {
    const n = opinion(c, from, to);
    const H = cap(he(c, from));
    const words = n >= 40 ? `${H} is your friend` : n >= 10 ? `${H} thinks well of you` : n > -10 ? `${H} hardly knows you` : n > -40 ? `${H} thinks ill of you` : `${H} hates you`;
    const why = deedWords(c, from, to);
    return `${words} (${n > 0 ? '+' : ''}${n})${why ? `: ${why}` : ''}.`;
  }

  // ---- Needs (computed from state, never stored) ----

  const troopCount = (t) => Object.values(t || {}).reduce((a, b) => a + b, 0);

  /** The holdings of this lord that are threatened: besieged, or gathered against. */
  const threatened = (c, pid) => (CL.sieges?.list(c) || []).filter((s) => R().holderOf(s.sid, c) === pid || R().holding(s.sid, c)?.seat && R().holderOf(R().holding(s.sid, c).seat, c) === pid);

  /** A lord's needs now, highest first: [{ need, score, why }]. @param {Campaign} c @param {string} pid */
  function needs(c, pid) {
    const p = c.people?.[pid];
    if (!p || R().rules(pid, c)) return [];
    const out = [];
    const fiefs = R().fiefsOf(pid, c);
    const claims = Object.keys(c.holdings || {}).filter((sid) => c.holdings[sid].claims.some((k) => k.by === pid));
    const motive = (m, n) => (has(c, pid, m) ? n : 0);
    if (!fiefs.length) out.push({ need: 'land', score: 0.6 + (claims.length ? 0.2 : 0) + motive('land', 0.2), why: claims.length ? `wants ${placeName(claims[0])} back` : `wants land of ${his(c, pid)} own` });
    else if (claims.length) out.push({ need: 'land', score: 0.45 + motive('land', 0.2), why: `wants ${placeName(claims[0])} back` });
    const kinHeld = p.kin.find((k) => c.people[k.person]?.status === 'captive');
    const q = CL.lords?.partyOf(c, pid);
    const size = CL.lords?.sizeFor(c, pid) || 1;
    const count = q ? troopCount(q.troops) : 0;
    const purse = fiefs.reduce((n, sid) => n + (c.holdings[sid].treasury || 0), 0);
    if (kinHeld) out.push({ need: 'coin', score: 0.7, why: `must raise a ransom for ${R().titled(kinHeld.person, c)}` });
    else if (fiefs.length && purse < Math.max(30, (size - count) * 3)) out.push({ need: 'coin', score: 0.45 + motive('coin', 0.2), why: 'is short of coin' });
    else if (has(c, pid, 'coin')) out.push({ need: 'coin', score: 0.3, why: 'minds the coin' });
    if (p.status === 'free' && q && count < size * 0.55) out.push({ need: 'men', score: 0.4 + 0.6 * (1 - count / size), why: 'is short of men' });
    const danger = threatened(c, pid);
    if (danger.length) out.push({ need: 'safety', score: danger[0].phase === 'encircled' ? 1 : 0.8, why: `fears for ${placeName(danger[0].sid)}` });
    else if (fiefs.length && atWar(c, p.realm)) out.push({ need: 'safety', score: 0.3 + motive('guard', 0.2), why: `watches over ${his(c, pid)} lands in the war` });
    const lately = (kinds) => Object.values(state(c).opinions[pid] || {}).some((e) => e.log.some((x) => !x[2] && kinds.includes(x[0]) && c.day - x[1] <= 30));
    if (lately(['beat', 'passed_over', 'grant_won'])) out.push({ need: 'standing', score: 0.55 + motive('glory', 0.2), why: `wants to win back ${his(c, pid)} name` });
    else if (has(c, pid, 'glory')) out.push({ need: 'standing', score: 0.35, why: 'wants to make a name' });
    return out.sort((a, b) => b.score - a.score || NEEDS.indexOf(a.need) - NEEDS.indexOf(b.need));
  }
  const atWar = (c, f) => R().realms().some((k) => k.id !== f && R().relation(c, f, k.id) === 'war');
  /** A lord's top need, or null when content. */
  const topNeed = (c, pid) => needs(c, pid).find((n) => n.score >= 0.3) || null;
  /** "short of men" / "content" for the tap card. */
  const needLine = (c, pid) => topNeed(c, pid)?.why || 'content';

  /**
   * How a lord's needs lean their riding (js/parties.js): `avoid` fights (short of men), `stay` near
   * home (fears for their lands), `seek`: a wider eye for a fight (glory, coin).
   */
  function leaning(c, pid) {
    const n = topNeed(c, pid);
    return { avoid: n?.need === 'men', stay: n?.need === 'safety' && n.score >= 0.8, seek: n?.need === 'standing' || (n?.need === 'coin' && !c.people[pid]?.kin.some((k) => c.people[k.person]?.status === 'captive')) ? 1.4 : 1 };
  }

  // ---- Requests and answers ----

  const powerOf = (troops) => A().troopsPower(troops || {});
  /** The asker's company power, as the lord would judge it (what they can see: men and name). */
  function askerPower(c, by) {
    if (by === PLAYER) return A().playerPower(c);
    const q = CL.lords?.partyOf(c, by);
    return q ? powerOf(q.troops) : 0;
  }
  /** Map distance from a lord's home to a place, and in words of riding. */
  function farness(c, pid, x, y) {
    const home = place(CL.lords?.homeOf(c, pid) || c.people[pid].home);
    const d = home ? CL.world.mapDist(home.mapX, home.mapY, x, y) : 0;
    const t = CL.lords?.templateFor(c.people[pid].realm);
    const perDay = (t?.speed || 3.8) * 12; // a day's riding (half the day in the saddle)
    const days = d / perDay;
    const their = his(c, pid);
    return { d, days, words: days < 0.6 ? `close to ${their} lands` : days < 1.4 ? `a day from ${their} lands` : `${Math.round(days)} days from ${their} lands` };
  }

  /** What a request is about: its place and the people in it. */
  function subject(c, ask) {
    const s = ask.sid ? CL.sieges?.at(c, ask.sid) : null;
    const others = s ? [...s.lords, ...s.relief, ...(s.by === PLAYER ? [PLAYER] : [])] : [];
    if (ask.by && !others.includes(ask.by)) others.push(ask.by);
    return { s, others };
  }

  /**
   * How a lord answers a request: { answer, score, reasons: [{ text, sign }], price?, favour?, day? }.
   * `ask`: { by: who asks ('player', a lord, or their ruler), kind: 'siege' | 'relief' | 'ride' |
   * 'back' | 'summons', sid?: the fort, with?: others riding (a summons), grant?: the grant's place }.
   * Only what the lord could know goes in (SC-24): the asker's men and name, their own lands and
   * needs, the place, and their history. Never the asker's purse.
   */
  function consider(c, pid, ask) {
    const p = c.people[pid];
    const reasons = [];
    let score = 0;
    let block = false; // a reason no price moves
    let temporary = false; // a reason time will mend
    const say = (text, pts) => {
      reasons.push({ text, sign: pts > 0 ? '+' : pts < 0 ? '−' : '' });
      score += pts;
    };
    const H = cap(he(c, pid));
    const by = ask.by;
    const ruler = R().rulerOf(p.realm, c);
    const military = ['siege', 'relief', 'ride', 'summons'].includes(ask.kind);
    // Can't: a captive, or busy at a siege already.
    if (p.status !== 'free') return { answer: 'refuse', score: -100, reasons: [{ text: `${H} is a captive`, sign: '−' }] };
    const busy = (CL.sieges?.list(c) || []).find((s) => s.lords.includes(pid) || s.relief.includes(pid));
    // 1. Obligation.
    const sworn = by === PLAYER ? CL.allegiance?.sworn(c) : c.people[by]?.realm;
    const serving = by === PLAYER ? CL.allegiance?.serves(c) : sworn;
    if (by === PLAYER && (CL.rights.enemyOf(c, PLAYER, p.realm) || (serving && R().relation(c, serving, p.realm) === 'war'))) {
      say(`You are an enemy of the ${factionName(p.realm)}`, -60);
      block = true;
    }
    if (by === ruler) {
      const k = has(c, pid, 'loyal') ? 1.3 : has(c, pid, 'restless') ? 0.8 : 1;
      say(`${H} is sworn to ${R().titled(ruler, c)}`, Math.round(35 * k));
    } else if (sworn === p.realm) say(`${H} is sworn to the same crown`, by === PLAYER && CL.allegiance?.state(c).kind === 'mercenary' ? 8 : 15);
    const asker = by === PLAYER ? 'you' : R().titled(by, c);
    if (p.kin.some((k) => k.person === by)) say(`${cap(asker)} ${by === PLAYER ? 'are' : 'is'} ${his(c, pid)} kin`, 20);
    const debt = state(c).debts.find((x) => x.from === pid && x.to === by);
    if (debt) say(`${H} owes ${asker} for ${debt.kind === 'loan' ? 'a loan' : debt.kind === 'freed' ? `${his(c, pid)} freedom` : 'help given'}`, 15);
    // 2. Relationship: what they did to each other, and where a lord stands with their ruler by nature.
    const lean = by && by !== PLAYER ? base(c, pid, by) : 0;
    const rel = opinion(c, pid, by) - lean;
    if (Math.abs(rel) >= 5) {
      const why = deedWords(c, pid, by);
      say(`${H} thinks ${rel > 0 ? 'well' : 'ill'} of ${asker}${why ? `: ${why}` : ''}`, Math.round(rel * 0.6));
    } else if (by === PLAYER && !debt) say(`${H} owes you nothing`, 0);
    if (by === ruler && has(c, pid, 'loyal')) say(`${H} is loyal to the crown`, Math.round(lean * 0.4));
    else if (by === ruler && has(c, pid, 'restless')) say(`${H} owes the ${short(p.realm)} crown nothing`, Math.round(lean * 0.4));
    // 3. Interest: their lands, their needs, the place and the company.
    const top = topNeed(c, pid);
    const danger = threatened(c, pid);
    const target = ask.sid ? place(ask.sid) : null;
    const at = target ? { x: target.mapX, y: target.mapY } : by === PLAYER ? { x: c.world.x, y: c.world.y } : null;
    if (military && danger.length && !(ask.kind === 'relief' && danger.some((s) => s.sid === ask.sid))) {
      say(`${placeName(danger[0].sid)} is threatened`, -35);
      temporary = true;
    }
    if (ask.kind === 'relief' && danger.some((s) => s.sid === ask.sid)) say(`It is ${his(c, pid)} own fort`, 40);
    else if (ask.kind === 'relief' && target && R().owner(ask.sid, c) === p.realm) say(`It is a fort of ${his(c, pid)} own realm`, 10);
    if (at && military) {
      const f = farness(c, pid, at.x, at.y);
      const k = has(c, pid, 'guard') ? 1.5 : 1;
      // Summoned to war, a lord expects to ride: the road counts for less than in a favour asked.
      const pts = f.days < 0.6 ? 5 : -Math.round(Math.min(20, f.d / (ask.kind === 'summons' ? 12 : 8)) * k);
      say(`${target ? `${target.name} is` : by === PLAYER ? 'You are' : `${asker} is`} ${f.words}${has(c, pid, 'guard') && pts < 0 ? `, and ${he(c, pid)} guards ${his(c, pid)} lands` : ''}`, pts);
    }
    if (military && ask.kind !== 'summons' && top?.need === 'men') {
      say(`${cap(his(c, pid))} ranks are thin`, -25);
      temporary = true;
    }
    if (busy && military && !(ask.sid && busy.sid === ask.sid)) {
      say(`${H} is at the siege of ${placeName(busy.sid)}`, -30);
      temporary = true;
    }
    // The crown's own war: a siege for their realm (a loyal lord most of all).
    const war = ask.kind === 'siege' && CL.sieges?.at(c, ask.sid)?.realm === p.realm;
    if (war) say(`It is the ${short(p.realm)} crown's war${has(c, pid, 'loyal') ? `, and ${he(c, pid)} is loyal` : ''}`, has(c, pid, 'loyal') ? 15 : 10);
    if ((ask.kind === 'siege' || ask.kind === 'summons') && target) {
      const claim = R().claimsOn(ask.sid, c).some((k) => k.by === pid);
      if (claim) say(`${H} claims ${target.name}`, 25);
      else if (top?.need === 'land') say(`${H} hopes to win land`, 15);
      // The risk, as anyone can see it: the garrison behind its walls against those besieging.
      const s = CL.sieges?.at(c, ask.sid);
      const theirs = s ? CL.sieges.defence(c, s).power : powerOf(R().holding(ask.sid, c)?.garrison) * 1.6;
      const ours = ask.host ?? (s ? CL.sieges.attack(c, s) : askerPower(c, by)) + powerOf(CL.lords?.partyOf(c, pid)?.troops);
      if (ours < theirs * 0.6) say(`The walls of ${target.name} are far too strong for those besieging it`, -25);
      else if (ours < theirs) say(`The walls of ${target.name} are strong against those besieging it`, -12);
    }
    if (military && top?.need === 'standing') say(`A chance to make ${his(c, pid)} name`, 10);
    if (military && has(c, pid, 'glory') && top?.need !== 'standing') say(`${H} is hungry for glory`, 5);
    if (ask.kind === 'back') {
      const g = ask.grant ? (c.grants || []).find((x) => x.sid === ask.grant) : null;
      const wants = g && CL.fiefs?.candidates(c, g).slice(0, 3).includes(pid) && top?.need === 'land';
      if (wants) say(`${H} wants ${placeName(ask.grant)} for ${him(c, pid)}self`, -30);
      else say(`It costs ${him(c, pid)} little`, 5);
    }
    // Feuds and rivals: never beside a feud; a rival is a cold companion.
    const { others } = subject(c, ask);
    for (const o of others.concat(ask.with || [])) {
      if (o === pid) continue;
      const t = tie(c, pid, o);
      if (t === 'feud') {
        say(`${H} won't ride beside ${o === PLAYER ? 'you' : R().titled(o, c)}: they are at feud`, -50);
        block = true;
        break;
      }
      if (t === 'rival' && military) say(`${o === PLAYER ? 'You are' : `${R().titled(o, c)} is`} ${his(c, pid)} rival`, -10);
    }
    // 4. Fear.
    if (by === ruler) say(`The crown's displeasure`, 10);
    else if (by && by !== PLAYER) {
      const ratio = askerPower(c, by) / Math.max(1, powerOf(CL.lords?.partyOf(c, pid)?.troops));
      if (ratio >= 1.5) say(`${H} fears ${R().titled(by, c)}`, 5);
    } else if (by === PLAYER) {
      const ratio = askerPower(c, PLAYER) / Math.max(1, powerOf(CL.lords?.partyOf(c, pid)?.troops));
      const pts = Math.round(clamp((ratio - 1) * 10, 0, 15) + clamp(c.renown / 100, 0, 10));
      if (pts >= 8) say(`${H} fears you`, pts);
      else if (pts >= 3) say(`${H} respects your company`, pts);
      else say(`${H} doesn't fear you`, 0);
    }
    // The answer.
    let answer;
    if (block || (score < RULES.negotiate && !(temporary && score + RULES.delayGap >= RULES.obey))) answer = 'refuse';
    else if (temporary) answer = 'delay'; // thin ranks, a siege of their own, their lands threatened: not now
    else if (score >= RULES.obey) answer = 'obey';
    else answer = 'negotiate';
    /** @type {any} */
    const out = { answer, score, reasons };
    if (answer === 'negotiate') {
      // Men for a siege or a relief cost money: a price in crowns. Otherwise a favour, unless they want coin.
      const coin = top?.need === 'coin' || has(c, pid, 'coin') || ask.kind === 'siege' || ask.kind === 'relief' || !petitionFor(c, pid);
      if (coin) out.price = Math.round((RULES.price.base + (RULES.obey - score) * RULES.price.perPoint) / 10) * 10;
      else out.favour = petitionFor(c, pid)?.kind;
    }
    if (answer === 'delay') out.day = Math.floor(c.day) + (busy ? 4 : 3);
    return out;
  }

  /** "Obeys" / "Negotiates: 120 crowns" — the answer's first words. */
  function answerWords(c, pid, r) {
    const H = R().titled(pid, c);
    if (r.answer === 'obey') return `${H} agrees.`;
    if (r.answer === 'negotiate') return r.price ? `${H} will, for ${r.price} crowns.` : `${H} will, if you do ${him(c, pid)} a favour first.`;
    if (r.answer === 'delay') return `${H} will come, but not before day ${CL.party.dayNumber(r.day)}.`;
    return `${H} refuses.`;
  }
  /** The reasons in one line: "He's sworn to the same crown (+). Ashgate is two days from his lands (−)." */
  const reasonLine = (r) => r.reasons.map((x) => `${x.text}${x.sign ? ` (${x.sign})` : ''}.`).join(' ');

  // ---- The player's requests ----

  /** What the player could ask this lord, with why not: { kind: { ok, why, sid?, grant? } }. */
  function askable(c, pid) {
    const right = CL.rights.may(c, PLAYER, 'askHelp', pid);
    const a = state(c).asks[pid];
    const q = CL.lords?.partyOf(c, pid);
    const wait = a && c.day < a.until ? (a.answer === 'refuse' ? `${R().titled(pid, c)} has given you an answer; ask again on day ${CL.party.dayNumber(a.until)}` : `You asked ${him(c, pid)} lately; ask again on day ${CL.party.dayNumber(a.until)}`) : '';
    const pledged = state(c).pledges.some((x) => x.lord === pid && x.kind !== 'backLord'); // your word for them isn't theirs to you
    const why = !right.ok ? right.why : !q ? `${R().titled(pid, c)} has no household riding` : pledged ? `${R().titled(pid, c)} has given you ${his(c, pid)} word already` : wait;
    const mine = (CL.sieges?.list(c) || []).find((s) => s.by === PLAYER);
    const besieged = (CL.sieges?.list(c) || []).find((s) => R().holderOf(s.sid, c) === PLAYER && s.phase === 'encircled');
    const grant = (c.grants || []).find((g) => CL.allegiance?.sworn(c) === R().sovereignOf(g.sid, c) && CL.fiefs?.candidates(c, g).includes(PLAYER));
    const claim = Object.keys(c.holdings || {}).find((sid) => R().claimsOn(sid, c).some((k) => k.by === PLAYER));
    const ok = (extra) => ({ ok: !why, why, ...extra });
    return {
      siege: mine ? ok({ sid: mine.sid }) : { ok: false, why: why || 'You are besieging nothing' },
      relief: besieged ? ok({ sid: besieged.sid }) : { ok: false, why: why || 'None of your forts is besieged' },
      ride: ok({}),
      back: grant || claim ? ok({ grant: grant?.sid, sid: grant ? grant.sid : claim }) : { ok: false, why: why || 'You have no claim or bid to back' },
    };
  }

  /**
   * The player asks a lord (from the Lords tab): the answer, its reasons, and what follows. Obey: done
   * at once. Negotiate: a price (pay with `pay`) or a favour (their petition opens). Delay: done on its
   * day. Refuse: holds 7 days. Every ask has a 3-day cooldown.
   */
  function ask(c, pid, kind) {
    const can = askable(c, pid)[kind];
    if (!can?.ok) return { answer: null, why: can?.why || 'You cannot ask that' };
    const r = consider(c, pid, { by: PLAYER, kind, sid: can.sid, grant: can.grant });
    const until = Math.floor(c.day) + (r.answer === 'refuse' ? RULES.hardened : RULES.cooldown);
    state(c).asks[pid] = { kind, answer: r.answer, day: c.day, until, sid: can.sid || null, grant: can.grant || null, ...(r.price ? { price: r.price } : {}), ...(r.day != null ? { from: r.day } : {}) };
    if (r.answer === 'obey') carry(c, pid, kind, can, c.day);
    else if (r.answer === 'delay') pledge(c, pid, kind, can, r.day);
    else if (r.answer === 'negotiate' && r.favour) {
      const p = openPetition(c, pid, r.favour);
      if (p) p.forAsk = kind;
    }
    CL.diag.log('info', 'Asked a lord', { lord: pid, kind, answer: r.answer, score: r.score });
    return { ...r, words: answerWords(c, pid, r), line: reasonLine(r) };
  }

  /** Pay a negotiated price (once): the lord does it. */
  function pay(c, pid) {
    const a = state(c).asks[pid];
    if (!a?.price || a.paid || c.day >= a.until) return null;
    if (c.gold < a.price) return { ok: false, why: `You have only ${c.gold} crowns` };
    CL.accounts.spend(c, a.price, `${R().titled(pid, c)}'s price`);
    a.paid = true;
    note(c, pid, PLAYER, 'paid', { kin: false });
    carry(c, pid, a.kind, { sid: a.sid, grant: a.grant }, c.day);
    return { ok: true, text: `${R().titled(pid, c)} takes your ${a.price} crowns and keeps ${his(c, pid)} word.` };
  }

  /** A promise for later (a delay): kept on its day, or lapsing if they're taken on the way. */
  function pledge(c, pid, kind, can, from) {
    state(c).pledges.push({ lord: pid, kind, by: PLAYER, sid: can.sid || null, grant: can.grant || null, from, until: from + (kind === 'back' ? RULES.backDays : RULES.rideDays) });
  }

  /** Carry out an agreed request: a debt to you, if any, is paid by it. */
  function carry(c, pid, kind, can, from) {
    const q = CL.lords?.partyOf(c, pid);
    const owed = state(c).debts.find((x) => x.from === pid && x.to === PLAYER && x.kind !== 'loan');
    if (owed) state(c).debts = state(c).debts.filter((x) => x !== owed);
    const S = CL.sieges;
    const list = state(c).pledges.filter((x) => !(x.lord === pid && x.kind === kind));
    state(c).pledges = list;
    if (kind === 'siege' || kind === 'relief') {
      const s = can.sid ? S?.at(c, can.sid) : null;
      if (!s || !q) return lapse(c, pid, kind, 'the siege is over');
      if (kind === 'siege') {
        if (!s.lords.includes(pid)) s.lords.push(pid);
        Object.assign(q, { intent: s.phase === 'encircled' ? 'besiege' : 'gather', siegeId: s.id });
      } else {
        if (!s.relief.includes(pid)) s.relief.push(pid);
        Object.assign(q, { intent: 'relief', siegeId: s.id });
      }
      list.push({ lord: pid, kind, by: PLAYER, sid: can.sid, grant: null, from, until: from + 30, begun: true });
      CL.ui.message(`${R().titled(pid, c)} rides to ${kind === 'siege' ? 'join your siege of' : 'relieve'} ${placeName(can.sid)}.`);
    } else if (kind === 'ride') {
      if (!q) return lapse(c, pid, kind, 'no household');
      list.push({ lord: pid, kind, by: PLAYER, sid: null, grant: null, from, until: from + RULES.rideDays });
      CL.ui.message(`${R().titled(pid, c)} rides with you for ${RULES.rideDays} days.`);
    } else if (kind === 'back') {
      list.push({ lord: pid, kind, by: PLAYER, sid: can.sid || null, grant: can.grant || null, from, until: from + RULES.backDays });
      CL.ui.message(`${R().titled(pid, c)} will speak for you at court.`);
    }
    return true;
  }

  /** A promise that can't be kept: told, and gone. */
  function lapse(c, pid, kind, why) {
    state(c).pledges = state(c).pledges.filter((x) => !(x.lord === pid && x.kind === kind));
    CL.ui.message(`${R().titled(pid, c)}'s promise lapses: ${why}.`);
    return false;
  }

  /** Is this lord riding with the player now (js/parties.js follows; js/reinforce.js sides)? */
  const ridesWith = (c, pid) => state(c).pledges.some((x) => x.lord === pid && x.kind === 'ride' && c.day >= x.from && c.day < x.until);

  /** Who backs someone for a grant: lords pledged to the player, friends and rivals at court. */
  function court(c, g, id) {
    const h = R().holding(g.sid, c);
    const f = h.sovereign;
    const ruler = R().rulerOf(f, c);
    let n = opinion(c, ruler, id) / 10;
    for (const pid of Object.keys(c.people)) {
      if (pid === id || c.people[pid].realm !== f || pid === ruler) continue;
      const t = tie(c, pid, id);
      if (t === 'friend') n += 1;
      else if (t === 'rival' || t === 'feud') n -= 1;
    }
    if (id === PLAYER) {
      n += (c.influence?.[f] || 0) / 10;
      n += 2 * state(c).pledges.filter((x) => x.kind === 'back' && c.day >= x.from && (x.grant === g.sid || !x.grant)).length;
    } else if (state(c).pledges.some((x) => x.kind === 'backLord' && x.lord === id && x.grant === g.sid)) n += 2;
    return n;
  }

  // ---- The ruler's summons and calls for relief (the AI's lords and the player) ----

  /**
   * A realm gathers lords for a siege (js/sieges.js plan): each answers its ruler's summons by the
   * same model, nearest first, until `max` come. Nothing changes here: `refusals` records the refusals
   * once the siege is called. Returns { come, refused }.
   */
  function summon(c, f, sid, pids, max = 4) {
    const ruler = R().rulerOf(f, c);
    const come = [];
    const refused = [];
    // The host as each lord sees it: everyone summoned (their banners are on the road together).
    const host = pids.reduce((n, pid) => n + powerOf(CL.lords?.partyOf(c, pid)?.troops), 0);
    for (const pid of pids) {
      if (come.length >= max) break;
      const r = consider(c, pid, { by: ruler, kind: 'summons', sid, with: come, host });
      if (r.answer === 'obey' || r.answer === 'negotiate') come.push(pid);
      else if (r.answer === 'refuse') refused.push({ pid, r });
    }
    return { come, refused };
  }

  /** The siege is called: the ruler remembers who refused (once a week each), and the news tells one. */
  function refusals(c, f, sid, refused) {
    const ruler = R().rulerOf(f, c);
    let told = false;
    for (const { pid, r } of refused) {
      if (deeds(c, ruler, pid).some((x) => x[0] === 'refused_summons' && c.day - x[1] < 7)) continue;
      note(c, ruler, pid, 'refused_summons', { kin: false });
      if (told) continue;
      told = true;
      const why = r.reasons.find((x) => x.sign === '−')?.text || '';
      CL.news?.record(c, 'summons_refused', { place: sid, faction: f, text: `${R().titled(pid, c)} refuses ${R().titled(ruler, c)}'s summons to ${placeName(sid)}${why ? `: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : ''}.` });
    }
  }

  /** A besieged fort's call for relief: by its holder (or ruler), each lord answering by the model. */
  function answersRelief(c, pid, sid) {
    const holder = R().holderOf(sid, c);
    const by = holder && holder !== pid && holder !== PLAYER ? holder : R().rulerOf(c.people[pid].realm, c);
    const r = consider(c, pid, { by, kind: 'relief', sid });
    return r.answer === 'obey' || r.answer === 'negotiate';
  }

  /** The player is summoned (a vassal of the realm that besieges). */
  function summonPlayer(c, f, s) {
    if (CL.allegiance?.sworn(c) !== f || state(c).summons) return;
    state(c).summons = { realm: f, sid: s.sid, siegeId: s.id, day: c.day, answered: false };
    CL.ui.message(`${R().titled(R().rulerOf(f, c), c)} summons you to the siege of ${placeName(s.sid)}.`);
    CL.news?.record(c, 'summons', { place: s.sid, faction: f, text: `${R().titled(R().rulerOf(f, c), c)} summons the ${short(f)} lords to ${placeName(s.sid)}.` });
  }

  /** Your summons: answered by being at the siege; missed if it ends first. */
  function tickSummons(c) {
    const m = state(c).summons;
    if (!m) return;
    const s = (CL.sieges?.list(c) || []).find((x) => x.id === m.siegeId);
    const fort = place(m.sid);
    if (s && fort && CL.world.mapDist(c.world.x, c.world.y, fort.mapX, fort.mapY) <= (CL.sieges.RULES.camp || 4) * 4) {
      if (!m.answered) {
        m.answered = true;
        note(c, R().rulerOf(m.realm, c), PLAYER, 'answered', { kin: false });
        CL.ui.message(`You answer the summons to ${fort.name}.`);
      }
      CL.allegiance?.serve(c);
    }
    if (s && CL.allegiance?.sworn(c) === m.realm) return;
    state(c).summons = null;
    if (!m.answered && CL.allegiance?.sworn(c) === m.realm) {
      CL.allegiance.missed(c); // a warning, a fief revoked, or cast out (P8-08)
      note(c, R().rulerOf(m.realm, c), PLAYER, 'refused_summons', { kin: false });
      CL.ui.message(`You did not answer the summons to ${fort?.name || 'the siege'}. ${R().titled(R().rulerOf(m.realm, c), c)} marks it.`);
    }
  }

  // ---- What a lord does with a conquest (D-P8f: the AI's choice) ----

  /** The choice an AI lord makes with a fief they took: [choice, suggest]. */
  function conquerorChoice(c, pid, _sid) {
    const p = c.people[pid];
    if (!p) return ['ask', null];
    const ruler = R().rulerOf(p.realm, c);
    const n = R().fiefsOf(pid, c).length;
    if (has(c, pid, 'restless') && n < R().FIEF_CAP && opinion(c, pid, ruler) < -10) return ['keep', null];
    const kin = p.kin.find((k) => c.people[k.person]?.realm === p.realm && c.people[k.person].status === 'free' && !R().fiefsOf(k.person, c).length && !R().rules(k.person, c));
    if (kin && n >= 1) return ['suggest', kin.person];
    if (has(c, pid, 'loyal') && n >= 2) return ['hand', null];
    return ['ask', null];
  }

  // ---- Between lords: what follows from what happened ----

  /** A siege ended: who fought beside whom, who relieved whom, who took whose fief. */
  function onSiegeEnd(c, s, how, ctx = {}) {
    // Promises to join or relieve it are kept: they end with it.
    state(c).pledges = state(c).pledges.filter((x) => !((x.kind === 'siege' || x.kind === 'relief') && x.sid === s.sid));
    const fighters = [...s.lords.filter((pid) => CL.lords?.partyOf(c, pid)), ...(s.by === PLAYER ? [PLAYER] : [])];
    if (how === 'stormed' || how === 'surrendered') {
      for (const a of fighters) for (const b of fighters) if (a !== b) note(c, a, b, 'fought_beside', { kin: false });
      if (ctx.was && ctx.was !== R().rulerOf(ctx.wasRealm, c) && ctx.commander) note(c, ctx.was, ctx.commander, 'took_fief');
      if (ctx.was && ctx.wasRealm && c.people[ctx.was]) note(c, ctx.was, R().rulerOf(ctx.wasRealm, c), 'neglected', { kin: false }); // the crown didn't hold it
    }
    if (how === 'relieved') {
      const holder = R().holderOf(s.sid, c);
      for (const pid of s.relief) if (CL.lords?.partyOf(c, pid)) note(c, holder, pid, 'relieved');
    }
  }

  /** A grant given: the rivals it makes, and the thanks. */
  function onGrant(c, sid, who, rivals) {
    const f = R().sovereignOf(sid, c);
    const ruler = R().rulerOf(f, c);
    if (who !== PLAYER) note(c, who, ruler, 'granted', { kin: false });
    for (const pid of rivals) {
      if (pid === who || pid === PLAYER || !c.people[pid] || topNeed(c, pid)?.need !== 'land') continue;
      note(c, pid, who, 'grant_won', { kin: false });
      note(c, pid, ruler, 'passed_over', { kin: false });
    }
    // A lord pledged to back the player for it has kept their word.
    state(c).pledges = state(c).pledges.filter((x) => !(x.kind === 'back' && x.grant === sid) && !(x.kind === 'backLord' && x.grant === sid));
  }

  // ---- Changing realm, and revocation ----

  /** The riding lords of a realm. */
  const ridersOf = (c, f) => (CL.lords?.riders(c) || []).filter((pid) => c.people[pid].realm === f);

  /** Where an unhappy lord would go: the realm whose ruler they think best of, if better than their own. */
  function destination(c, pid) {
    const p = c.people[pid];
    const own = opinion(c, pid, R().rulerOf(p.realm, c));
    let best = null;
    for (const k of R().realms()) {
      if (k.id === p.realm || !CL.lords?.templateFor(k.id)) continue;
      const n = opinion(c, pid, R().rulerOf(k.id, c));
      if (n > own + 15 && (!best || n > best.n)) best = { f: k.id, n };
    }
    return best?.f || null;
  }

  /** A lord leaves their realm for another: release at peace, defection at war (P8-04's rules). */
  function changeRealm(c, pid, to) {
    const p = c.people[pid];
    const from = p.realm;
    const ruler = R().rulerOf(from, c);
    const war = atWar(c, from);
    for (const sid of R().fiefsOf(pid, c)) R().transfer(c, sid, { holder: ruler, willing: !war, claimKind: 'granted', reason: war ? 'defection' : 'released', quiet: true });
    // Fiefs that didn't move (a story lock) stay with the old crown all the same.
    for (const sid of R().fiefsOf(pid, c)) c.holdings[sid].holder = ruler;
    const q = CL.lords?.partyOf(c, pid);
    if (q) c.parties.splice(c.parties.indexOf(q), 1);
    p.realm = to;
    p.home = R().capitalOf(to);
    p.regroup = true;
    state(c).moved[pid] = Math.floor(c.day);
    delete state(c).warned[pid];
    note(c, ruler, pid, 'defected', { kin: false });
    for (const k of p.kin) if (c.people[k.person]?.realm === from) note(c, k.person, pid, 'left_kin', { kin: false });
    for (const g of c.grants || []) g.declined = g.declined.filter((x) => x !== pid);
    const text = `${R().titled(pid, c)} ${war ? 'breaks with' : 'leaves'} the ${factionName(from)} for ${short(to)}.`;
    CL.news?.record(c, 'lord_left', { place: R().capitalOf(to), faction: to, text });
    CL.diag.log('info', 'Lord changes realm', { lord: pid, from, to, how: war ? 'defect' : 'release' });
    return true;
  }

  /** Each week, staggered: grumbling, leaving and revocation. */
  function weekly(c, pid) {
    const p = c.people[pid];
    if (p?.status !== 'free' || R().rules(pid, c)) return;
    const ruler = R().rulerOf(p.realm, c);
    const n = state(c);
    // Landless and wanting it: the crown's neglect is felt.
    if (!R().fiefsOf(pid, c).length && topNeed(c, pid)?.need === 'land') note(c, pid, ruler, 'neglected', { kin: false });
    // A lord who keeps refusing summons loses a fief to someone else.
    const refusals = deeds(c, ruler, pid).filter((x) => x[0] === 'refused_summons' && c.day - x[1] <= 60).length;
    const fiefs = R().fiefsOf(pid, c).filter((sid) => !R().locked(c, sid) && !R().locked(c, c.holdings[sid].seat));
    if (refusals >= RULES.revokeAfter && fiefs.length) {
      const sid = fiefs.find((x) => c.holdings[x].kind === 'village') || fiefs[0];
      if (R().transfer(c, sid, { holder: ruler, willing: true, reason: 'revoked', quiet: true })) { // the liege's right: no claim (as yours, P8-08)
        note(c, pid, ruler, 'revoked');
        // The refusals are answered: they don't count again.
        const e = entry(c, ruler, pid);
        if (e) e.log = e.log.filter((x) => x[0] !== 'refused_summons');
        CL.news?.record(c, 'fief_revoked', { place: sid, faction: p.realm, text: `${R().titled(ruler, c)} takes ${placeName(sid)} back from ${R().titled(pid, c)}, who would not answer the summons.` });
        CL.fiefs?.offer(c, sid, null);
      }
    }
    // Leaving: a warning first, then a week later.
    const low = opinion(c, pid, ruler) < RULES.leaveBelow;
    if (!low) {
      delete n.warned[pid];
      return;
    }
    if (n.moved[pid] != null && c.day - n.moved[pid] < RULES.moveGap) return;
    if ((CL.sieges?.list(c) || []).some((s) => s.lords.includes(pid) || s.relief.includes(pid))) return; // after the siege
    if (n.warned[pid] == null) {
      n.warned[pid] = Math.floor(c.day);
      CL.news?.record(c, 'lord_grumbles', { place: R().capitalOf(p.realm), faction: p.realm, text: `${R().titled(pid, c)} grumbles at the court of ${R().titled(ruler, c)}.` });
      return;
    }
    if (c.day - n.warned[pid] < RULES.leaveAfter) return;
    const to = destination(c, pid);
    if (!to || ridersOf(c, p.realm).length <= RULES.minRiders) return;
    // One a realm a month: no stampede.
    if (Object.entries(n.moved).some(([id, d]) => id !== pid && c.day - d < 30 && c.people[id] && (c.people[id].realm === p.realm || ridersOf(c, p.realm).includes(id)))) return;
    changeRealm(c, pid, to);
  }

  // ---- Petitions to the player ----

  /** The petition a lord would make by their top need, or null: { kind, sid?, kin?, amount? }. */
  function petitionFor(c, pid) {
    const p = c.people[pid];
    const need = needs(c, pid);
    for (const n of need) {
      if (n.score < 0.3) break;
      if (n.need === 'safety' || n.need === 'standing') {
        const sid = R().fiefsOf(pid, c)[0];
        if (sid) return { kind: 'bandits', sid };
      }
      if (n.need === 'coin') {
        const held = p.kin.map((k) => (c.prisoners || []).find((x) => x.lord === k.person && x.by !== PLAYER)).find(Boolean);
        if (held) return { kind: 'ransom', kin: held.lord, amount: CL.lords.ransomOf(held) };
        return { kind: 'loan', amount: RULES.petition.loan };
      }
      if (n.need === 'land') {
        const g = (c.grants || []).find((x) => R().sovereignOf(x.sid, c) === p.realm && CL.fiefs?.candidates(c, x).includes(pid));
        if (g) return { kind: 'grant', sid: g.sid };
        const claim = Object.keys(c.holdings || {}).find((sid) => c.holdings[sid].claims.some((k) => k.by === pid));
        if (claim) return { kind: 'claim', sid: claim };
      }
    }
    return null;
  }

  /** Open a lord's petition to the player (one at a time). */
  function openPetition(c, pid, kind = null) {
    const n = state(c);
    if (n.petitions.length) return null;
    const p = petitionFor(c, pid);
    if (!p || (kind && p.kind !== kind)) return null;
    const x = { id: n.nextPetition++, lord: pid, ...p, day: c.day, until: Math.floor(c.day) + RULES.petition.days, accepted: false };
    n.petitions.push(x);
    CL.ui.message(`${R().titled(pid, c)} sends you a petition: ${petitionText(c, x)} (the Lords tab).`);
    return x;
  }

  /** The petition's words. */
  function petitionText(c, x) {
    const pid = x.lord;
    if (x.kind === 'bandits') return `clear the bandits from about ${placeName(x.sid)}, for ${RULES.petition.bandits} crowns`;
    if (x.kind === 'loan') return `lend ${him(c, pid)} ${x.amount} crowns, to be repaid ${x.amount + RULES.petition.interest} in ${RULES.petition.loanDays} days`;
    if (x.kind === 'ransom') return `pay the ${x.amount}-crown ransom of ${R().titled(x.kin, c)}`;
    if (x.kind === 'claim') return `back ${his(c, pid)} claim to ${placeName(x.sid)}`;
    return `support ${him(c, pid)} for the grant of ${placeName(x.sid)}`;
  }

  /** The open petition, or null. */
  const petition = (c) => state(c).petitions[0] || null;

  /** Close a petition: done (reward once), declined or lapsed. */
  function closePetition(c, x, how) {
    const n = state(c);
    n.petitions = n.petitions.filter((y) => y !== x);
    n.petitionAfter = Math.floor(c.day) + RULES.petition.gap;
    if (how === 'done') {
      note(c, x.lord, PLAYER, 'helped');
      if (x.kind === 'bandits') CL.accounts.earn(c, RULES.petition.bandits, `${R().titled(x.lord, c)}'s thanks`);
      // A favour asked as the price of a request: the request is granted.
      if (x.forAsk) {
        const can = askable(c, x.lord)[x.forAsk];
        state(c).asks[x.lord] = { ...(state(c).asks[x.lord] || {}), until: c.day };
        if (can?.sid || x.forAsk === 'ride' || can?.grant) carry(c, x.lord, x.forAsk, can, c.day);
      }
    } else if (how === 'declined') note(c, x.lord, PLAYER, 'refused', { kin: false });
    else if (how === 'lapsed') note(c, x.lord, PLAYER, 'refused', { kin: false });
  }

  /** Answer the open petition: 'accept' or 'decline'. Returns { ok, text }. */
  function answerPetition(c, choice) {
    const x = petition(c);
    if (!x) return { ok: false, text: 'No petition is open.' };
    const name = R().titled(x.lord, c);
    if (choice === 'decline') {
      closePetition(c, x, 'declined');
      return { ok: true, text: `You turn down ${name}'s petition.` };
    }
    if (x.kind === 'bandits') {
      x.accepted = true;
      return { ok: true, text: `You promise ${name} to clear the bandits about ${placeName(x.sid)} by day ${CL.party.dayNumber(x.until)}.` };
    }
    if (x.kind === 'loan' || x.kind === 'ransom') {
      if (c.gold < x.amount) return { ok: false, text: `You have only ${c.gold} crowns.` };
      CL.accounts.spend(c, x.amount, x.kind === 'loan' ? `a loan to ${name}` : `${R().titled(x.kin, c)}'s ransom`);
      if (x.kind === 'loan') state(c).debts.push({ from: x.lord, to: PLAYER, kind: 'loan', amount: x.amount + RULES.petition.interest, day: c.day, due: Math.floor(c.day) + RULES.petition.loanDays });
      else {
        const held = (c.prisoners || []).find((y) => y.lord === x.kin);
        if (held) CL.lords.free(c, held, `${R().titled(x.kin, c)} is home again, ransomed by ${c.character?.name || 'a free company'}.`);
        note(c, x.kin, PLAYER, 'ransomed_kin');
        state(c).debts.push({ from: x.lord, to: PLAYER, kind: 'help', day: c.day });
      }
      closePetition(c, x, 'done');
      return { ok: true, text: x.kind === 'loan' ? `You lend ${name} ${x.amount} crowns.` : `You pay ${R().titled(x.kin, c)}'s ransom. ${name} won't forget it.` };
    }
    // Backing a claim or a grant: your word at court.
    if (x.kind === 'grant') state(c).pledges.push({ lord: x.lord, kind: 'backLord', by: PLAYER, sid: x.sid, grant: x.sid, from: c.day, until: Math.floor(c.day) + RULES.backDays });
    note(c, x.lord, PLAYER, 'backed');
    const kind = x.kind;
    closePetition(c, x, 'backed');
    return { ok: true, text: kind === 'grant' ? `You will speak for ${name} for ${placeName(x.sid)}.` : `You back ${name}'s claim to ${placeName(x.sid)}.` };
  }

  /** A battle won: bandits beaten near a petitioner's lands (a lord beaten by you is noted in js/lords.js). */
  function afterBattle(c, { win, kind }) {
    if (!win) return;
    const x = petition(c);
    if (x?.kind === 'bandits' && x.accepted && kind === 'bandit') {
      const s = place(x.sid);
      if (s && CL.world.mapDist(c.world.x, c.world.y, s.mapX, s.mapY) <= RULES.petition.reach) {
        CL.ui.message(`${R().titled(x.lord, c)} thanks you for clearing the road: ${RULES.petition.bandits} crowns.`);
        closePetition(c, x, 'done');
      }
    }
  }

  // ---- Day by day ----

  function tick(c) {
    if (!c.people) return;
    const n = state(c);
    const today = Math.floor(c.day);
    // Promises: kept, begun on their day, or lapsing (taken on the way).
    for (const x of [...n.pledges]) {
      const p = c.people[x.lord];
      if (p?.status !== 'free') {
        n.pledges = n.pledges.filter((y) => y !== x);
        if (p && x.by === PLAYER) CL.ui.message(`${R().titled(x.lord, c)} was taken on the way: ${his(c, x.lord)} promise lapses.`);
        continue;
      }
      if (c.day >= x.until) {
        n.pledges = n.pledges.filter((y) => y !== x);
        continue;
      }
      if (x.kind !== 'ride' && x.kind !== 'back' && x.kind !== 'backLord' && c.day >= x.from && !x.begun && !(CL.sieges?.list(c) || []).some((s) => s.lords.includes(x.lord) || s.relief.includes(x.lord))) {
        x.begun = true;
        carry(c, x.lord, x.kind, { sid: x.sid, grant: x.grant }, c.day);
      }
    }
    // Loans fall due: repaid from the lord's fiefs if they can.
    for (const d of [...n.debts]) {
      if (d.kind !== 'loan' || c.day < d.due) continue;
      const sids = R().fiefsOf(d.from, c);
      const purse = sids.reduce((k, sid) => k + (c.holdings[sid].treasury || 0), 0);
      if (purse >= d.amount || !sids.length) {
        let left = d.amount;
        for (const sid of sids) {
          const take = Math.min(left, c.holdings[sid].treasury || 0);
          c.holdings[sid].treasury -= take;
          left -= take;
        }
        CL.accounts.earn(c, d.amount, `${R().titled(d.from, c)} repays a loan`);
        n.debts = n.debts.filter((y) => y !== d);
        note(c, d.from, PLAYER, 'helped', { kin: false });
      } else d.due += 7; // a week's grace
    }
    tickSummons(c);
    // Petitions: lapse at their deadline; a new one now and then.
    const open = petition(c);
    if (open && c.day >= open.until) {
      CL.ui.message(`${R().titled(open.lord, c)}'s petition has lapsed.`);
      closePetition(c, open, 'lapsed');
    }
    if (!petition(c) && today >= n.petitionAfter && n.lastPetitionCheck !== today) {
      n.lastPetitionCheck = today;
      if (CL.campaign === c && A().next(c) < RULES.petition.chance) {
        const who = Object.keys(c.people).filter((pid) => !R().rules(pid, c) && c.people[pid].status === 'free' && opinion(c, pid, PLAYER) >= RULES.petition.goodwill && !CL.rights.enemyOf(c, PLAYER, c.people[pid].realm) && petitionFor(c, pid));
        if (who.length) openPetition(c, who[Math.floor(A().next(c) * who.length)]);
      }
    }
    // Weekly: drift toward nothing, and each lord's grumbling, leaving or revocation (staggered by id).
    const week = Math.floor(c.day / 7);
    if (n.week !== week) {
      n.week = week;
      for (const o of Object.values(n.opinions)) {
        for (const [to, e] of Object.entries(o)) {
          e.rel = e.rel > 0 ? Math.max(0, e.rel - RULES.drift) : Math.min(0, e.rel + RULES.drift);
          if (!e.rel && !e.log.length) delete o[to];
        }
      }
      for (const pid of Object.keys(c.people)) weekly(c, pid);
    }
  }

  // ---- The Lords tab ----

  /** What the Lords tab shows of a lord: the lines, in order. */
  function lordLines(c, pid) {
    const p = c.people[pid];
    const fiefs = R().fiefsOf(pid, c);
    const name = (id) => (id === PLAYER ? 'you' : R().titled(id, c));
    const list = (ids) => ids.map(name).join(', ');
    const lines = [];
    const ruler = R().rules(pid, c);
    lines.push(`${R().titled(pid, c)} · ${short(p.realm)}${ruler ? ' · rules' : ''} · ${fiefs.length ? `holds ${fiefs.map(placeName).join(', ')}` : 'landless'}`);
    const kin = p.kin.map((k) => `${c.people[k.person]?.name || 'someone'} (${R().tieWord(k.tie, c.people[k.person])}${c.people[k.person]?.realm !== p.realm ? `, ${short(c.people[k.person]?.realm)}` : ''})`);
    const friends = ties(c, pid, 'friend');
    const rivals = ties(c, pid, 'rival');
    const feuds = ties(c, pid, 'feud');
    const social = [kin.length ? `Kin: ${kin.join(', ')}` : '', friends.length ? `Friends: ${list(friends)}` : '', rivals.length ? `Rivals: ${list(rivals)}` : '', feuds.length ? `Feuds: ${list(feuds)}` : ''].filter(Boolean);
    if (social.length) lines.push(social.join(' · '));
    if (!ruler) {
      const q = CL.lords?.partyOf(c, pid);
      const where = p.status === 'captive' ? (p.heldBy === PLAYER ? 'your prisoner' : `a prisoner of the ${factionName(p.heldBy)}`) : q ? CL.lords.doingLine(c, q) : `at ${placeName(p.home)}`;
      const m = motiveLine(c, pid);
      lines.push(`${cap(needLine(c, pid))} · ${where}${m ? ` · ${m}` : ''}`);
    }
    lines.push(opinionLine(c, pid, PLAYER));
    return lines;
  }

  // ---- Checks ----

  function invariants(c) {
    const out = [];
    const n = c.nobles;
    if (!n) return out;
    if (n.petitions.length > 1) out.push('more than one petition open');
    for (const x of n.pledges) if (c.people?.[x.lord]?.status !== 'free') out.push(`${x.lord}: a promise while not free`);
    for (const [from, o] of Object.entries(n.opinions)) for (const [to, e] of Object.entries(o)) if (!(Math.abs(e.rel) <= 100)) out.push(`${from} of ${to}: an opinion out of bounds`);
    return out;
  }

  // ---- Saves ----

  /** v23 → v24: the deeds kept on people since P8-01 become their opinions. Pure. */
  function migrate(d) {
    const n = blank();
    for (const [id, p] of Object.entries(d.people && typeof d.people === 'object' ? d.people : {})) {
      for (const x of Array.isArray(p?.deeds) ? p.deeds : []) {
        if (!x || !DEEDS[x.kind] || typeof x.by !== 'string' || !num(x.day) || x.by === id) continue;
        const e = slot(slot(n.opinions, id, () => ({})), x.by, () => ({ rel: 0, log: [] }));
        e.rel = clamp(e.rel + DEEDS[x.kind], -100, 100);
        e.log = [...e.log, [x.kind, Math.floor(x.day)]].slice(-RULES.logMax);
      }
    }
    return { ...d, version: 24, nobles: n };
  }

  /** Repair the nobles' memory onto `s` (after people, prisoners, parties and sieges). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const x = d?.nobles && typeof d.nobles === 'object' ? d.nobles : null;
    const n = blank();
    s.nobles = n;
    if (!x) return;
    const who = (id) => typeof id === 'string' && isPerson(s, id);
    for (const [from, o] of Object.entries(x.opinions && typeof x.opinions === 'object' ? x.opinions : {})) {
      if (!s.people[from] || !o || typeof o !== 'object') continue;
      for (const [to, e] of Object.entries(o)) {
        if (!who(to) || to === from || !e || typeof e !== 'object' || !num(e.rel)) continue;
        const log = (Array.isArray(e.log) ? e.log : []).filter((l) => Array.isArray(l) && DEEDS[l[0]] && num(l[1])).slice(-RULES.logMax).map((l) => (l[2] ? [l[0], Math.floor(l[1]), 1] : [l[0], Math.floor(l[1])]));
        slot(n.opinions, from, () => ({}))[to] = { rel: clamp(Math.round(e.rel * 10) / 10, -100, 100), log };
      }
    }
    n.debts = (Array.isArray(x.debts) ? x.debts : []).filter((y) => y && who(y.from) && who(y.to) && ['loan', 'freed', 'help'].includes(y.kind) && num(y.day)).slice(-40).map((y) => ({ from: y.from, to: y.to, kind: y.kind, day: y.day, ...(y.kind === 'loan' ? { amount: Math.max(0, Math.floor(num(y.amount) ? y.amount : 0)), due: num(y.due) ? y.due : s.day } : {}) }));
    const pet = (Array.isArray(x.petitions) ? x.petitions : [])[0];
    if (pet && s.people[pet.lord] && PETITIONS.includes(pet.kind) && num(pet.until) && Number.isInteger(pet.id)) {
      const ok = (pet.kind === 'loan' || pet.kind === 'ransom' ? num(pet.amount) : true) && (pet.kind === 'ransom' ? Boolean(s.people[pet.kin]) : true) && (['bandits', 'claim', 'grant'].includes(pet.kind) ? Boolean(s.holdings?.[pet.sid]) : true);
      if (ok) n.petitions.push({ id: pet.id, lord: pet.lord, kind: pet.kind, ...(pet.sid ? { sid: pet.sid } : {}), ...(pet.kin ? { kin: pet.kin } : {}), ...(num(pet.amount) ? { amount: Math.floor(pet.amount) } : {}), day: num(pet.day) ? pet.day : s.day, until: pet.until, accepted: pet.accepted === true, ...(KINDS.includes(pet.forAsk) ? { forAsk: pet.forAsk } : {}) });
    }
    for (const [pid, a] of Object.entries(x.asks && typeof x.asks === 'object' ? x.asks : {})) {
      if (!s.people[pid] || !a || !KINDS.includes(a.kind) || !ANSWERS.includes(a.answer) || !num(a.until) || !num(a.day)) continue;
      n.asks[pid] = { kind: a.kind, answer: a.answer, day: a.day, until: a.until, sid: s.holdings?.[a.sid] ? a.sid : null, grant: s.holdings?.[a.grant] ? a.grant : null, ...(num(a.price) ? { price: Math.max(0, Math.floor(a.price)) } : {}), ...(num(a.from) ? { from: a.from } : {}), ...(a.paid === true ? { paid: true } : {}) };
    }
    n.pledges = (Array.isArray(x.pledges) ? x.pledges : [])
      .filter((y) => y && s.people[y.lord]?.status === 'free' && [...KINDS, 'backLord'].includes(y.kind) && num(y.from) && num(y.until) && y.until > s.day)
      .slice(0, 30)
      .map((y) => ({ lord: y.lord, kind: y.kind, by: PLAYER, sid: s.holdings?.[y.sid] ? y.sid : null, grant: s.holdings?.[y.grant] ? y.grant : null, from: y.from, until: y.until, ...(y.begun === true ? { begun: true } : {}) }));
    for (const k of ['moved', 'warned']) for (const [pid, day] of Object.entries(x[k] && typeof x[k] === 'object' ? x[k] : {})) if (s.people[pid] && num(day)) n[k][pid] = Math.floor(day);
    const m = x.summons;
    if (m && R().isRealm(m.realm) && s.holdings?.[m.sid] && Number.isInteger(m.siegeId) && num(m.day)) n.summons = { realm: m.realm, sid: m.sid, siegeId: m.siegeId, day: m.day, answered: m.answered === true };
    n.nextPetition = Number.isInteger(x.nextPetition) && x.nextPetition > 0 ? x.nextPetition : 1;
    if (n.petitions[0]) n.nextPetition = Math.max(n.nextPetition, n.petitions[0].id + 1);
    n.petitionAfter = num(x.petitionAfter) ? x.petitionAfter : 0;
    n.week = Number.isInteger(x.week) ? x.week : Math.floor(s.day / 7);
    if (Number.isInteger(x.lastPetitionCheck)) n.lastPetitionCheck = x.lastPetitionCheck;
  }

  CL.nobles = {
    RULES,
    DEEDS,
    NEEDS,
    KINDS,
    ANSWERS,
    PETITIONS,
    blank,
    state,
    motives,
    motiveLine,
    entry,
    opinion,
    note,
    deeds,
    tie,
    ties,
    deedWords,
    opinionLine,
    needs,
    topNeed,
    needLine,
    leaning,
    consider,
    answerWords,
    reasonLine,
    askable,
    ask,
    pay,
    ridesWith,
    court,
    summon,
    refusals,
    answersRelief,
    summonPlayer,
    conquerorChoice,
    onSiegeEnd,
    onGrant,
    destination,
    changeRealm,
    weekly,
    petitionFor,
    openPetition,
    petitionText,
    petition,
    answerPetition,
    afterBattle,
    tick,
    lordLines,
    invariants,
    migrate,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
