// @ts-check
/* Crownless diplomacy (P9-02, design §18.3): treaties between realms, trust, and the AI's offers.
 *
 * - **Treaties** (`c.treaties`): `{ id, kind, between: [a, b], since, until, terms, kept, broken }`.
 *   Kinds: peace (ends a war; no end day), truce (30 days, after a war wears out), nonaggression (90),
 *   alliance (180), access (90), trade (120), tribute (one pays the other weekly from its treasury, as
 *   long as the peace that made it, else 90). Today's peace, tension and war stay as they were; treaties
 *   sit on top. A nonaggression pact or an alliance holds a border's clashes short of war, unless a
 *   side whose rulers think ill of the other breaks it. War between partners breaks every treaty
 *   between them, by the realm that went to war.
 * - **Trust** (`c.trust[a][b]`, what a thinks of b's word, sparse): a treaty kept +5 a month to both;
 *   one broken −40 with the injured realm and −15 with every other. Under −30, a realm won't sign.
 * - **Alliances:** when a realm is attacked, its allies join if they can afford a war; asked to join
 *   its ally's attack, an ally weighs it like any offer and may decline. A refusal costs a little trust.
 * - **The AI,** once a week, one offer a realm at most, from what its ruler can know: at war on two
 *   fronts, having lost a fort in 30 days, or short of money → a truce (or, beaten, peace with tribute);
 *   a neighbour twice as strong → an alliance with that neighbour's rival; rich and at peace → trade.
 *   Answers weigh what the deciders (the ruler; a league's council) think of the other ruler, trust,
 *   and the realm's interests. A realm's chancellor makes its offers a little better.
 * - **The envoy:** while you are a vassal of the realm making an offer, it waits three days on its
 *   capital's board as an errand: carry it to the other capital, and the offer is answered a little
 *   better (+10), for 60 crowns and +5 standing. Left on the board, it goes without you. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TRUST = { min: -100, max: 100, kept: 5, broken: -40, heard: -15, refuse: -30, declined: -5 };
  const DAYS = { truce: 30, nonaggression: 90, alliance: 180, access: 90, trade: 120, tribute: 90 };
  const KINDS = ['peace', 'truce', 'nonaggression', 'alliance', 'access', 'trade', 'tribute'];
  /** Treaties that hold clashes short of war. */
  const HOLDS = ['nonaggression', 'alliance'];
  const RULES = {
    month: 30,
    hostile: -20, // deciders who think this ill of the other ruler break a pact rather than keep it
    lostDays: 30, // a fort lost this recently is a reason to seek a truce
    poorWeeks: 2, // a treasury under this many weeks of its costs
    richWeeks: 12,
    strength: 2, // a neighbour this many times stronger is a threat
    beaten: 2, // forts lost in this war: beaten
    tributeShare: 0.1, // of the payer's weekly income
    again: 30, // days before the same offer is made to the same realm again
    chancellor: 5,
    envoy: { bonus: 10, days: 3, gold: 60, standing: 5 },
    offersMax: 60,
  };

  const R = () => CL.realm;
  const K = () => CL.crowns;
  const short = (f) => CL.content.table('factions')[f]?.short || f;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const key = (a, b) => [a, b].sort().join('|');
  const realms = () => R().realms().map((f) => f.id);
  const dayNo = (d) => Math.floor(d) + 1;

  // ---- Trust ----

  /** What `a` thinks of `b`'s word, −100…100 (0 unless something happened). */
  const trust = (c, a, b) => c.trust?.[a]?.[b] || 0;
  function addTrust(c, a, b, n) {
    if (a === b || !n) return;
    c.trust ||= {};
    c.trust[a] ||= {};
    c.trust[a][b] = clamp(Math.round(trust(c, a, b) + n), TRUST.min, TRUST.max);
  }

  // ---- Treaties ----

  const list = (c) => (c.treaties ||= []);
  /** The treaties in force between two realms (of one kind, if given). */
  const between = (c, a, b, kind = null) => list(c).filter((t) => t.between.includes(a) && t.between.includes(b) && (!kind || t.kind === kind));
  const has = (c, a, b, kind) => between(c, a, b, kind).length > 0;
  const allies = (c, f) => list(c).filter((t) => t.kind === 'alliance' && t.between.includes(f)).map((t) => t.between.find((x) => x !== f));
  const other = (t, f) => t.between.find((x) => x !== f);

  /** Make a treaty (one of a kind between a pair: a new one replaces the old). */
  function sign(c, kind, a, b, terms = {}, { day = c.day, quiet = false } = {}) {
    if (!KINDS.includes(kind) || a === b || !R().isRealm(a) || !R().isRealm(b)) return null;
    for (const t of between(c, a, b, kind)) list(c).splice(list(c).indexOf(t), 1);
    c.nextTreatyId = (c.nextTreatyId || 0) + 1;
    const length = kind === 'tribute' ? terms.days || DAYS.tribute : DAYS[kind];
    const t = { id: c.nextTreatyId, kind, between: [a, b], since: day, until: kind === 'peace' ? null : day + length, terms: { ...terms }, kept: 0, broken: null };
    delete t.terms.days;
    list(c).push(t);
    CL.diag.log('info', 'Treaty signed', { kind, between: t.between, until: t.until, terms: t.terms });
    if (!quiet) CL.news?.record(c, 'treaty_signed', { faction: a, other: b, text: signedText(t) }, day);
    return t;
  }
  const WORD = { peace: 'peace', truce: 'a truce', nonaggression: 'a pact of nonaggression', alliance: 'an alliance', access: 'a treaty of passage', trade: 'a treaty of trade', tribute: 'a tribute' };
  function signedText(t) {
    const [a, b] = t.between;
    if (t.kind === 'tribute') return `${short(t.terms.from)} will pay ${short(t.terms.to)} ${t.terms.amount} crowns a week in tribute.`;
    return `${short(a)} and ${short(b)} have made ${WORD[t.kind]}${t.until ? `, until day ${dayNo(t.until)}` : ''}.`;
  }

  /** A treaty broken by `by`: it ends; the injured realm and everyone who hears of it trust `by` less. */
  function breach(c, t, by, why = '') {
    const i = list(c).indexOf(t);
    if (i < 0) return;
    list(c).splice(i, 1);
    t.broken = by;
    const injured = other(t, by);
    addTrust(c, injured, by, TRUST.broken);
    for (const f of realms()) if (f !== by && f !== injured) addTrust(c, f, by, TRUST.heard);
    CL.diag.log('info', 'Treaty broken', { kind: t.kind, between: t.between, by, why });
    CL.news?.record(c, 'treaty_broken', { faction: by, other: injured, text: `${short(by)} has broken ${WORD[t.kind]} with ${short(injured)}. Every court has heard of it.` });
  }

  // ---- War and the treaties ----

  /** Who decides for a realm: its ruler; in a league, its council's riding lords. */
  function deciders(c, f) {
    const ruler = R().rulerOf(f, c);
    if (K().laws(c, f).power !== 'league') return ruler ? [ruler] : [];
    const council = (CL.lords?.riders(c) || []).filter((p) => c.people[p]?.realm === f && c.people[p].status === 'free');
    return council.length ? council : ruler ? [ruler] : [];
  }
  /** What a realm's deciders think of another realm's ruler, on average. */
  function regard(c, f, g) {
    const ruler = R().rulerOf(g, c);
    const who = deciders(c, f);
    if (!ruler || !who.length || !CL.nobles) return 0;
    return who.reduce((n, p) => n + CL.nobles.opinion(c, p, ruler), 0) / who.length;
  }
  /** A realm's riding lords' strength. */
  function power(c, f) {
    let n = 0;
    for (const pid of CL.lords?.riders(c) || []) {
      if (c.people[pid]?.realm !== f || c.people[pid].status !== 'free') continue;
      const q = CL.lords.partyOf(c, pid);
      if (q) n += CL.autoresolve.troopsPower(q.troops);
    }
    return n;
  }

  /**
   * Border clashes have heated a pair to the brink (js/realm.js `clashed`). Who goes to war, or null
   * if a pact holds them back: with a nonaggression pact or an alliance, only a side that thinks ill
   * of the other's ruler breaks it. Otherwise the side that thinks less of the other goes first
   * (the stronger, if they think the same).
   */
  function goesToWar(c, a, b) {
    const ra = regard(c, a, b);
    const rb = regard(c, b, a);
    const first = ra < rb ? a : rb < ra ? b : power(c, a) >= power(c, b) ? a : b;
    if (!between(c, a, b).some((t) => HOLDS.includes(t.kind))) return first;
    const breaks = [a, b].filter((f) => regard(c, f, other({ between: [a, b] }, f)) < RULES.hostile);
    return breaks.includes(first) ? first : breaks[0] || null;
  }

  /**
   * Two realms went to war (js/realm.js `setRelation`). `by` went first: every treaty between them is
   * broken by it. The attacked realm's allies join if they can afford it; the attacker's are asked.
   */
  function onWar(c, a, b, by, reason) {
    const attacker = by === b ? b : a;
    const defender = other({ between: [a, b] }, attacker);
    for (const t of between(c, a, b)) breach(c, t, attacker, 'war');
    if (reason === 'ally') return; // no chains of calls
    for (const f of allies(c, defender)) {
      if (f === attacker || R().relation(c, f, attacker) === 'war' || R().storyHeld(c, f, attacker)) continue;
      if (poor(c, f)) {
        addTrust(c, defender, f, TRUST.declined);
        CL.diag.log('info', 'Ally declines', { ally: f, for: defender, against: attacker, why: 'cannot afford a war' });
        continue;
      }
      R().setRelation(c, f, attacker, 'war', 'ally', null, c.day, f);
      CL.news?.record(c, 'ally_joins', { faction: f, other: attacker, text: `${short(f)} keeps faith with ${short(defender)} and marches against ${short(attacker)}.` });
    }
    for (const f of allies(c, attacker)) {
      if (f === defender || R().relation(c, f, defender) === 'war' || R().storyHeld(c, f, defender)) continue;
      const ans = answer(c, 'join', attacker, f, { against: defender });
      if (!ans.ok) {
        addTrust(c, attacker, f, TRUST.declined);
        CL.diag.log('info', 'Ally declines', { ally: f, for: attacker, against: defender, why: ans.why });
        continue;
      }
      R().setRelation(c, f, defender, 'war', 'ally', null, c.day, f);
      CL.news?.record(c, 'ally_joins', { faction: f, other: defender, text: `${short(f)} joins ${short(attacker)}'s war on ${short(defender)}.` });
    }
  }

  /** A war worn out into a truce (js/realm.js): the truce is a treaty with its end day. */
  function truceAfterWar(c, a, b, until, day = c.day) {
    if (!R().isRealm(a) || !R().isRealm(b)) return null;
    const t = sign(c, 'truce', a, b, {}, { day, quiet: true });
    if (t) t.until = until;
    return t;
  }

  // ---- What a realm can know of itself ----

  /** A week's costs: the average of its book's whole weeks out (else its income). */
  function costs(c, f) {
    const book = K().record(c, f)?.book || [];
    const weeks = book.slice(0, -1);
    const out = weeks.map((p) => Object.values(p.out).reduce((x, y) => x + y, 0));
    const avg = out.length ? out.reduce((x, y) => x + y, 0) / out.length : 0;
    return Math.max(1, Math.round(avg || K().income(c, f)));
  }
  const poor = (c, f) => K().treasury(c, f) < RULES.poorWeeks * costs(c, f);
  const rich = (c, f) => K().treasury(c, f) > RULES.richWeeks * costs(c, f);
  /** Forts of `f` taken by others since `day`: the old holders' claims say when. */
  const lostSince = (c, f, day) => Object.values(c.holdings || {}).filter((h) => h.kind === 'fort' && h.controller !== f && h.claims.some((k) => k.realm === f && k.kind === 'old' && k.since >= day)).length;
  const warSince = (c, a, b) => (R().relation(c, a, b) === 'war' ? c.relations[R().pairKey(a, b)].since : null);

  // ---- Offers and answers ----

  /**
   * How a realm answers an offer from another: what its deciders think of the other ruler, its trust,
   * and its interests (kind: truce, peace, alliance, trade, join). Returns { ok, score, why }.
   */
  function answer(c, kind, from, to, terms = {}, bonus = 0) {
    const t = trust(c, to, from);
    if (t < TRUST.refuse) return { ok: false, score: -100, why: `${short(to)} does not trust ${short(from)}'s word` };
    let score = regard(c, to, from) + t / 2 + bonus + (K().holder(c, from, 'chancellor') ? RULES.chancellor : 0);
    let why = '';
    const since = warSince(c, from, to);
    if (kind === 'truce' || kind === 'peace') {
      if (since == null) return { ok: false, score: -100, why: 'they are not at war' };
      score += Math.min(20, (c.day - since) / 2); // weariness
      const lostTo = lostSince(c, to, since);
      const lostFrom = lostSince(c, from, since);
      if (lostTo > lostFrom) score += 20;
      else if (lostFrom > lostTo) {
        score -= 15;
        why = 'they are winning';
      }
      if (terms.amount && terms.to === to) score += 15;
    } else if (kind === 'alliance') {
      const common = R().atOdds(c, to, terms.against);
      score += common ? 20 : -15;
      if (!common) why = `they have no quarrel with ${short(terms.against)}`;
      if (poor(c, to)) score -= 20;
    } else if (kind === 'trade') {
      score += R().relation(c, from, to) === 'peace' ? 10 : -30;
    } else if (kind === 'join') {
      const common = R().atOdds(c, to, terms.against);
      score += common ? 20 : -20;
      if (!common) why = `they won't start a war with ${short(terms.against)}`;
      if (poor(c, to)) {
        score -= 20;
        why = 'they cannot afford a war';
      }
    }
    const ok = score >= 0;
    return { ok, score: Math.round(score), why: ok ? '' : why || `${short(to)} thinks too little of the offer` };
  }

  /** What a realm would offer this week, if anything: { kind, from, to, terms }. */
  function nextOffer(c, f) {
    const again = (g, kind) => (c.offers?.[`${f}|${g}|${kind}`] ?? -Infinity) > c.day - RULES.again;
    const ok = (g) => R().isRealm(g) && g !== f && !R().storyHeld(c, f, g) && trust(c, f, g) >= TRUST.refuse;
    const enemies = realms().filter((g) => ok(g) && R().relation(c, f, g) === 'war');
    if (enemies.length && (enemies.length >= 2 || lostSince(c, f, c.day - RULES.lostDays) > 0 || poor(c, f))) {
      const g = enemies.sort((x, y) => warSince(c, f, x) - warSince(c, f, y))[0];
      const beaten = lostSince(c, f, warSince(c, f, g)) >= RULES.beaten;
      const kind = beaten ? 'peace' : 'truce';
      if (!again(g, kind)) return { kind, from: f, to: g, terms: beaten ? { from: f, to: g, amount: Math.max(1, Math.round(K().income(c, f) * RULES.tributeShare)) } : {} };
    }
    const mine = power(c, f);
    for (const g of realms().filter((x) => ok(x) && power(c, x) >= RULES.strength * Math.max(1, mine))) {
      const h = realms().find((x) => ok(x) && x !== g && R().atOdds(c, x, g) && !has(c, f, x, 'alliance') && !again(x, 'alliance'));
      if (h) return { kind: 'alliance', from: f, to: h, terms: { against: g } };
    }
    if (!enemies.length && rich(c, f)) {
      const g = realms()
        .filter((x) => ok(x) && R().relation(c, f, x) === 'peace' && !has(c, f, x, 'trade') && !again(x, 'trade'))
        .sort((x, y) => regard(c, f, y) - regard(c, f, x))[0];
      if (g) return { kind: 'trade', from: f, to: g, terms: {} };
    }
    return null;
  }

  /** An offer answered now: signed if accepted, with what it brings (a war ended, a tribute). */
  function resolve(c, o, bonus = 0) {
    c.offers ||= {};
    c.offers[`${o.from}|${o.to}|${o.kind}`] = Math.floor(c.day);
    trimOffers(c);
    const ans = answer(c, o.kind, o.from, o.to, o.terms, bonus);
    CL.diag.log('info', 'Treaty offer', { kind: o.kind, from: o.from, to: o.to, accepted: ans.ok, score: ans.score, why: ans.why });
    if (!ans.ok) return { ...ans, treaty: null };
    let t;
    if (o.kind === 'truce') {
      R().setRelation(c, o.from, o.to, 'tension', 'truce');
      t = list(c).find((x) => x.kind === 'truce' && x.between.includes(o.from) && x.between.includes(o.to)) || sign(c, 'truce', o.from, o.to);
      CL.news?.record(c, 'treaty_signed', { faction: o.from, other: o.to, text: signedText(t) });
    } else if (o.kind === 'peace') {
      R().setRelation(c, o.from, o.to, 'peace', 'peace treaty');
      for (const x of between(c, o.from, o.to, 'truce')) list(c).splice(list(c).indexOf(x), 1); // peace is more than a truce
      t = sign(c, 'peace', o.from, o.to);
      if (o.terms.amount) sign(c, 'tribute', o.from, o.to, { from: o.terms.from, to: o.terms.to, amount: o.terms.amount });
    } else t = sign(c, o.kind, o.from, o.to, o.kind === 'alliance' ? { against: o.terms.against } : {});
    return { ...ans, treaty: t };
  }
  function trimOffers(c) {
    const keys = Object.keys(c.offers);
    for (const k of keys) if (c.offers[k] < c.day - RULES.again) delete c.offers[k];
    for (const k of Object.keys(c.offers).slice(0, -RULES.offersMax)) delete c.offers[k];
  }

  /** A realm makes its offer: through you as envoy while you are its vassal, else at once. */
  function offer(c, o) {
    if (CL.allegiance?.sworn(c) === o.from && !c.contract && envoy(c, o)) return { envoy: true };
    return resolve(c, o);
  }

  /** The envoy's errand on the realm's capital board; false if it can't be posted. */
  function envoy(c, o) {
    const from = R().capitalOf(o.from);
    const to = R().capitalOf(o.to);
    if (!from || !to || !CL.contracts?.postEnvoy) return false;
    return Boolean(CL.contracts.postEnvoy(c, from, to, { ...o, terms: { ...o.terms } }, RULES.envoy));
  }
  /** The errand ended (js/contracts.js): carried, the offer gains; failed or left, it goes as it is. */
  function onEnvoy(c, o, carried) {
    if (!o || !R().isRealm(o.from) || !R().isRealm(o.to)) return null;
    return resolve(c, o, carried ? RULES.envoy.bonus : 0);
  }

  // ---- Time ----

  /** Once a week (the payday): tribute paid, months kept, treaties run out, and each realm's offer. */
  function weekly(c, day = c.day) {
    for (const t of [...list(c)]) {
      if (!list(c).includes(t)) continue;
      if (t.between.some((f) => !R().isRealm(f))) {
        list(c).splice(list(c).indexOf(t), 1); // a realm gone: the treaty ends
        continue;
      }
      if (t.kind === 'tribute') {
        const paid = K().pay(c, K().side(t.terms.from), K().side(t.terms.to), t.terms.amount, 'tribute');
        if (!paid) {
          breach(c, t, t.terms.from, 'tribute unpaid');
          continue;
        }
      }
      const months = Math.floor((day - t.since) / RULES.month);
      if (months > t.kept) {
        for (const f of t.between) addTrust(c, f, other(t, f), TRUST.kept * (months - t.kept));
        t.kept = months;
      }
      if (t.until != null && day >= t.until) {
        list(c).splice(list(c).indexOf(t), 1);
        CL.diag.log('info', 'Treaty ended', { kind: t.kind, between: t.between, kept: true });
      }
    }
    for (const f of realms()) {
      const o = nextOffer(c, f);
      if (o) offer(c, o);
    }
  }

  /** Make the chosen realm's next offer now (Debug). */
  function offerNow(c, f) {
    const o = nextOffer(c, f);
    return o ? { offer: o, result: offer(c, o) } : null;
  }

  // ---- Words ----

  const STATE = { peace: 'at peace', tension: 'in tension', war: 'at war' };
  /** The Diplomacy tab's lines: each pair of realms, their state, treaties and trust. */
  function pairLines(c) {
    const out = [];
    const ids = realms();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]];
        const r = c.relations?.[key(a, b)];
        const ts = between(c, a, b).map((t) => (t.kind === 'tribute' ? `tribute, ${short(t.terms.from)} pays ${t.terms.amount} a week until day ${dayNo(t.until)}` : `${t.kind}${t.until ? ` until day ${dayNo(t.until)}` : ''}`));
        out.push({
          pair: key(a, b),
          title: `${short(a)} and ${short(b)}: ${STATE[r?.state] || 'at peace'}${r ? ` since day ${dayNo(r.since)}` : ''}`,
          lines: [ts.length ? `Treaties: ${ts.join('; ')}.` : 'No treaties.', `Trust: ${short(a)} in ${short(b)} ${trust(c, a, b)}, ${short(b)} in ${short(a)} ${trust(c, b, a)}.`],
        });
      }
    }
    return out;
  }

  // ---- Checks and saves ----

  function invariants(c) {
    const out = [];
    const seen = new Set();
    for (const t of c.treaties || []) {
      if (!KINDS.includes(t.kind) || t.between.length !== 2 || t.between[0] === t.between[1]) out.push(`treaty ${t.id}: malformed`);
      const k = `${key(...t.between)}|${t.kind}`;
      if (seen.has(k)) out.push(`treaty ${t.id}: two of a kind`);
      seen.add(k);
      if (t.until != null && t.until < c.day - 7) out.push(`treaty ${t.id}: ran out on day ${t.until} but stands`);
    }
    for (const [a, row] of Object.entries(c.trust || {})) for (const [b, n] of Object.entries(row)) if (!(n >= TRUST.min && n <= TRUST.max)) out.push(`trust ${a}→${b}: ${n}`);
    return out;
  }

  /** 25 → 26 (build 3.8.0, P9-02): no treaties but today's truces (each a truce treaty), no trust. */
  function migrate(d) {
    const treaties = [];
    const day = typeof d.day === 'number' ? d.day : 0;
    let id = 0;
    for (const [k, r] of Object.entries(d.relations || {})) {
      if (!(typeof r?.truceUntil === 'number' && r.truceUntil > day)) continue;
      const between = k.split('|');
      treaties.push({ id: ++id, kind: 'truce', between, since: typeof r.since === 'number' ? r.since : day, until: r.truceUntil, terms: {}, kept: 0, broken: null });
    }
    return { ...d, version: 26, treaties, nextTreatyId: id, trust: {}, offers: {} };
  }

  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  /** Repair the saved treaties, trust and recent offers onto `s` (after the realms and crowns). */
  function sanitize(s, d) {
    s.treaties = [];
    const seen = new Set();
    let top = 0;
    for (const t of Array.isArray(d?.treaties) ? d.treaties : []) {
      if (!t || !KINDS.includes(t.kind) || !Number.isInteger(t.id) || !Array.isArray(t.between) || t.between.length !== 2) continue;
      const [a, b] = t.between;
      if (a === b || !R().isRealm(a) || !R().isRealm(b) || !num(t.since)) continue;
      if (t.kind !== 'peace' && !(num(t.until) && t.until > s.day - 7)) continue;
      const k = `${key(a, b)}|${t.kind}`;
      if (seen.has(k)) continue;
      const terms = {};
      if (t.kind === 'tribute') {
        const x = t.terms || {};
        if (!(t.between.includes(x.from) && t.between.includes(x.to) && x.from !== x.to && Number.isInteger(x.amount) && x.amount > 0)) continue;
        Object.assign(terms, { from: x.from, to: x.to, amount: Math.min(x.amount, 99999) });
      }
      if (t.kind === 'alliance' && R().isRealm(t.terms?.against)) terms.against = t.terms.against;
      seen.add(k);
      top = Math.max(top, t.id);
      s.treaties.push({ id: t.id, kind: t.kind, between: [a, b], since: t.since, until: t.kind === 'peace' ? null : t.until, terms, kept: Number.isInteger(t.kept) && t.kept >= 0 ? t.kept : 0, broken: null });
    }
    s.nextTreatyId = Math.max(top, Number.isInteger(d?.nextTreatyId) ? d.nextTreatyId : 0);
    s.trust = {};
    for (const [a, row] of Object.entries(d?.trust && typeof d.trust === 'object' ? d.trust : {})) {
      if (!R().isRealm(a) || !row || typeof row !== 'object') continue;
      for (const [b, n] of Object.entries(row)) {
        if (!R().isRealm(b) || a === b || !num(n) || n === 0) continue;
        s.trust[a] ||= {};
        s.trust[a][b] = clamp(Math.round(n), TRUST.min, TRUST.max);
      }
    }
    s.offers = {};
    for (const [k, v] of Object.entries(d?.offers && typeof d.offers === 'object' ? d.offers : {})) {
      const [a, b, kind] = k.split('|');
      if (R().isRealm(a) && R().isRealm(b) && ['truce', 'peace', 'alliance', 'trade'].includes(kind) && Number.isInteger(v) && v <= s.day) s.offers[k] = v;
    }
  }

  CL.diplomacy = { TRUST, DAYS, KINDS, RULES, trust, addTrust, list, between, has, allies, sign, breach, deciders, regard, power, goesToWar, onWar, truceAfterWar, costs, poor, rich, lostSince, answer, nextOffer, resolve, offer, onEnvoy, weekly, offerNow, pairLines, invariants, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
