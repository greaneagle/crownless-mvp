// @ts-check
/* Crownless founding (P9-03, design §18.2, D-P9f): realms founded in play, ruling, and its delegation.
 *
 * - **Declaring** (CL.rights `declare`): who holds a fort or town (not a capital, not the story's), with
 *   600 renown and 40 soldiers for you (an AI lord: 40 riding troops and a grudge against their ruler),
 *   founds a realm there: `c.realms[r1…]` (js/realm.js), with a name, a banner colour from the palette,
 *   the culture and troops of its land, and a crown's laws. Every holding of the founder moves to it.
 *   The old realm keeps a claim on each and a grievance; unless it accepts in 7 days (by its ruler's
 *   opinion of the founder), it goes to war. At most one new realm in the world in 180 days.
 * - **Recognition:** each realm answers at once and then weekly, by its trust and its ruler's opinion
 *   of the founder; the old realm only once it accepts or makes peace. An unrecognised realm is fair
 *   game for sieges (js/realm.js `siegeWar`), not for battles on the road.
 * - **Vassals:** a lord who thinks −30 or worse of their ruler and +20 or better of you asks to swear
 *   to you (js/nobles.js weekly); you accept or decline on the Your realm tab. You grant them land and
 *   summon them to a siege by the existing flows, as their ruler.
 * - **Delegation (SC-41):** a policy a line for each officer (`c.rule`): steward (hold | grow | hoard:
 *   the tax on your own land), marshal (defend | expand:<realm> | peace: which sieges your realm plans),
 *   chancellor (peace | allies | none: which offers are accepted). Alerts only for a treaty offer, a
 *   vassal's grievance turning to a faction (P9-04), and your capital besieged; no screen is forced. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    renown: 600,
    soldiers: 40,
    lordTroops: 30, // an AI lord's riding troops to declare (P9-T tunes)
    grudge: -30, // a lord's opinion of their ruler, to ask to swear to you
    lordGrudge: -15, // an AI lord's opinion of their ruler, to declare (P9-T tunes)
    goodwill: 20, // a lord's opinion of you, to ask to swear to you
    acceptDays: 7, // the old realm accepts, or goes to war, after this long
    every: 180, // at most one new realm in the world in this many days
    recognise: 0, // trust / 2 + the ruler's opinion of the founder, at least this
    asksMax: 4,
  };
  const STEWARD = { hold: 'normal', grow: 'light', hoard: 'heavy' };
  const CHANCELLOR = { peace: ['truce', 'peace', 'trade'], allies: ['truce', 'peace', 'trade', 'alliance'], none: [] };
  const PLAYER = 'player';

  const R = () => CL.realm;
  const placeName = (sid) => CL.content.table('settlements')[sid]?.name || sid;
  const short = (f) => R().faction(f)?.short || f;

  /** Your rule: the policies, and lords asking to swear to you. */
  const blank = () => ({ steward: 'grow', marshal: 'defend', chancellor: 'peace', asks: [] });
  const rule = (c) => (c.rule ||= blank());
  /** The realm you rule, or null. */
  const mine = (c) => R().rules(PLAYER, c);

  // ---- Declaring ----

  /** The data realm whose land a holding lies in (its troops and culture). */
  function landOf(sid) {
    const f = CL.content.table('settlements')[sid]?.ownerFaction;
    const d = R().factionTable()[f];
    return d && !d.freeCity && d.recruits?.length ? f : null;
  }
  /** The next colour of the palette not flown by a realm already. */
  function colour(c) {
    const used = new Set(R().kingdoms(c).map((f) => f.color));
    return (CL.content.table('realm_palette').banners?.colors || []).find((x) => !used.has(x)) || '#888888';
  }

  /**
   * Found a realm at `sid` for `who` (you, or a lord). The right is checked here (`declare`, with the
   * thresholds unless `free`, for Debug). Returns the new realm's id, or null.
   */
  function declare(c, who, sid, { name = null, free = false } = {}) {
    const right = CL.rights.may(c, who, free ? 'declareFree' : 'declare', sid);
    if (!right.ok) return null;
    const h = R().holding(sid, c);
    const old = h.sovereign === PLAYER ? null : h.sovereign;
    const troops = landOf(sid);
    c.nextRealmId = (c.nextRealmId || 0) + 1;
    const id = `r${c.nextRealmId}`;
    const title = (name || `the Realm of ${placeName(sid)}`).trim().slice(0, 40);
    const shortName = placeName(sid).slice(0, 20);
    c.realms ||= {};
    c.realms[id] = { id, name: title.charAt(0).toUpperCase() + title.slice(1), short: shortName, emblem: shortName[0].toUpperCase(), color: colour(c), culture: R().factionTable()[troops].culture, troops, capital: sid, laws: {}, founded: Math.floor(c.day), by: who, recognised: [], pending: old ? { realm: old, day: c.day + RULES.acceptDays } : null };
    R().ensureTemplates(c);
    c.rulers[id] = who;
    const was = who === PLAYER ? null : c.people[who].realm;
    if (who !== PLAYER) CL.armies?.leave(c, who); // P9-T: a lord who declares leaves the old realm's army
    if (who !== PLAYER) c.people[who].realm = id; // sworn to their own realm before their land moves to it
    // Every holding of the founder leaves its realm, with a claim for the old crown on each.
    const held = R().fiefsOf(who, c);
    for (const x of held) {
      const from = c.holdings[x].sovereign;
      const fromRuler = R().rulerOf(from, c);
      if (!R().transfer(c, x, { controller: id, sovereign: id, holder: who, willing: true, reason: 'founded', quiet: true })) continue;
      if (from !== PLAYER && fromRuler && fromRuler !== who) R().addClaim(c, x, { by: fromRuler, realm: from, kind: 'old' });
    }
    // P10-00 (the long run): what cannot follow (a village whose seat stays with the old realm) is given
    // up to that realm's ruler; the founder keeps an old claim on it. Before, the founder kept holding it
    // for a realm they no longer served.
    for (const x of held) {
      const hx = c.holdings[x];
      if (hx.sovereign === id) continue;
      const crown = R().rulerOf(hx.sovereign, c);
      if (crown && crown !== who) R().transfer(c, x, { holder: crown, reason: 'forfeit', quiet: true });
    }
    const moved = held.filter((x) => c.holdings[x].sovereign === id);
    if (who === PLAYER) CL.allegiance?.crowned(c, old);
    else {
      c.people[who].home = sid;
      const q = CL.lords?.partyOf(c, who);
      if (q) c.parties.splice(c.parties.indexOf(q), 1); // a ruler keeps to their hall
      CL.diag.log('info', 'Lord founds a realm', { lord: who, from: was });
    }
    if (old) CL.nobles?.note(c, R().rulerOf(old, c), who, 'defected', { kin: false }); // the old crown's grievance
    CL.crowns?.ensure(c);
    for (const f of R().realms(c).map((x) => x.id)) if (f !== id && f !== old) answerRecognition(c, f, id);
    const text = `${who === PLAYER ? c.character?.name || 'A captain' : R().titled(who, c)} declares ${c.realms[id].name} at ${placeName(sid)}${old ? `, breaking with the ${R().faction(old)?.name}` : ''}.`;
    CL.news?.record(c, 'realm_founded', { place: sid, faction: id, text });
    CL.chronicle?.add(c, { day: c.day, kind: 'holding', place: sid, event: 'changed', by: id });
    if (who === PLAYER) CL.ui.message(`${text} ${old ? `The ${R().faction(old)?.name} have ${RULES.acceptDays} days to accept it, or it is war.` : ''}`.trim());
    CL.diag.log('info', 'Realm founded', { realm: id, by: who, at: sid, from: old, holdings: moved });
    return id;
  }

  /** Does realm `a` recognise realm `b`? The data's realms recognise each other; a founded realm, those that answered yes. */
  function recognises(c, a, b) {
    if (a === b) return true;
    const r = c.realms?.[b];
    return !r || r.recognised.includes(a);
  }
  /** Realm `f` answers a founded realm's recognition: its trust and its ruler's opinion of the founder. */
  function answerRecognition(c, f, id) {
    const r = c.realms?.[id];
    if (!r || recognises(c, f, id) || r.pending?.realm === f) return false;
    const ruler = R().rulerOf(f, c);
    const score = (CL.diplomacy?.trust(c, f, id) || 0) / 2 + (ruler && CL.nobles ? CL.nobles.opinion(c, ruler, r.by) : 0);
    if (score < RULES.recognise || R().relation(c, f, id) === 'war') return false;
    r.recognised.push(f);
    CL.diag.log('info', 'Realm recognised', { realm: id, by: f });
    return true;
  }

  /** Weekly: the old realm's answer when its days are up; recognition asked again; AI lords declaring. */
  function weekly(c) {
    for (const r of Object.values(c.realms || {})) {
      const p = r.pending;
      if (p && c.day >= p.day) {
        r.pending = null;
        const ruler = R().rulerOf(p.realm, c);
        const ok = ruler && CL.nobles && CL.nobles.opinion(c, ruler, r.by) >= 0;
        if (ok) {
          r.recognised.push(p.realm);
          CL.news?.record(c, 'realm_accepted', { faction: p.realm, other: r.id, text: `The ${R().faction(p.realm)?.name} accepts ${r.name}.` });
        } else if (R().relation(c, p.realm, r.id) !== 'war') R().setRelation(c, p.realm, r.id, 'war', 'founding', null, c.day, p.realm);
        CL.diag.log('info', 'Founding answered', { realm: r.id, by: p.realm, accepted: Boolean(ok) });
        if (r.by === PLAYER) alert(c, ok ? `The ${R().faction(p.realm)?.name} accepts your realm.` : `The ${R().faction(p.realm)?.name} will not accept your realm: it is war.`);
      }
      for (const f of R().realms(c).map((x) => x.id)) if (f !== r.id && !r.pending) answerRecognition(c, f, r.id);
    }
    aiDeclares(c);
  }
  /** A peace made with a founded realm is its recognition too (js/diplomacy.js). */
  function onPeace(c, a, b) {
    for (const [x, y] of [[a, b], [b, a]]) if (c.realms?.[y] && !recognises(c, x, y)) c.realms[y].recognised.push(x);
  }

  /** At most one new realm in the world in 180 days: a lord with land, men and a grudge declares. */
  function aiDeclares(c) {
    const last = Math.max(-Infinity, ...Object.values(c.realms || {}).map((r) => r.founded));
    if (c.day - last < RULES.every || !CL.story?.state(c).flags.ending) return null;
    for (const pid of CL.lords?.riders(c) || []) {
      const sid = R()
        .fiefsOf(pid, c)
        .find((x) => CL.rights.may(c, pid, 'declare', x).ok);
      if (sid) return declare(c, pid, sid);
    }
    return null;
  }

  // ---- Vassals ----

  /** A lord's week (js/nobles.js): one who thinks ill of their ruler and well of you asks to swear to you. */
  function askToSwear(c, pid) {
    const f = mine(c);
    const p = c.people[pid];
    if (!f || !p || p.realm === f || p.status !== 'free' || R().rules(pid, c) || !CL.nobles) return false;
    const r = rule(c);
    if (r.asks.some((x) => x.lord === pid) || r.asks.length >= RULES.asksMax) return false;
    if (CL.nobles.opinion(c, pid, R().rulerOf(p.realm, c)) > RULES.grudge || CL.nobles.opinion(c, pid, PLAYER) < RULES.goodwill) return false;
    r.asks.push({ lord: pid, day: Math.floor(c.day) });
    alert(c, `${R().titled(pid, c)} asks to swear to you. Answer on the Realms screen, Your realm tab.`);
    return true;
  }
  /** Your answer to a lord who asked to swear to you. */
  function answerAsk(c, pid, yes) {
    const r = rule(c);
    const i = r.asks.findIndex((x) => x.lord === pid);
    const f = mine(c);
    if (i < 0 || !f) return false;
    r.asks.splice(i, 1);
    if (!yes) {
      CL.nobles?.note(c, pid, PLAYER, 'refused', { kin: false });
      return true;
    }
    CL.nobles.changeRealm(c, pid, f);
    CL.lords?.ensure(c, c.day, true);
    CL.ui.message(`${R().titled(pid, c)} kneels and rises your vassal.`);
    return true;
  }
  /** Your vassals: the lords of your realm. */
  const vassals = (c) => (mine(c) ? Object.keys(c.people || {}).filter((pid) => c.people[pid].realm === mine(c) && !R().rules(pid, c)) : []);

  /** Grant a holding you hold to a vassal (the crown's right, yours now). */
  function grant(c, sid, pid) {
    const f = mine(c);
    if (!f || R().holderOf(sid, c) !== PLAYER || c.holdings[sid]?.sovereign !== f || c.people[pid]?.realm !== f) return false;
    if (!R().transfer(c, sid, { holder: pid, willing: true, reason: 'grant' })) return false;
    CL.nobles?.onGrant(c, sid, pid, vassals(c));
    CL.ui.message(`You grant ${placeName(sid)} to ${R().titled(pid, c)}.`);
    return true;
  }
  /** Summon your vassals against a fort: your realm's siege, each answering by the model. */
  function summon(c, sid) {
    const f = mine(c);
    if (!f) return null;
    return CL.sieges.plan(c, f, sid, { force: true });
  }

  // ---- Your treaties (P9-T, SC-25) ----

  /** The treaties you may offer a realm now: a truce or peace at war; an alliance against a common enemy; trade or a pact at peace. */
  function offers(c, to) {
    const f = mine(c);
    if (!f || !R().isRealm(to) || to === f) return [];
    const D = CL.diplomacy;
    const out = [];
    if (R().relation(c, f, to) === 'war') out.push({ kind: 'truce' }, { kind: 'peace' });
    else {
      for (const g of R().realms().map((x) => x.id)) if (g !== f && g !== to && R().atOdds(c, f, g) && !D.has(c, f, to, 'alliance')) out.push({ kind: 'alliance', against: g });
      if (!D.has(c, f, to, 'nonaggression')) out.push({ kind: 'nonaggression' });
      if (R().relation(c, f, to) === 'peace' && !D.has(c, f, to, 'trade')) out.push({ kind: 'trade' });
    }
    return out.filter((o) => (c.offers?.[`${f}|${to}|${o.kind}`] ?? -Infinity) <= c.day - D.RULES.again);
  }
  /** Offer a treaty: their ruler answers as realms answer each other (trust, regard, the war's course). */
  function propose(c, kind, to, against = null) {
    const f = mine(c);
    if (!f) return { ok: false, why: 'You rule no realm' };
    const o = offers(c, to).find((x) => x.kind === kind && (kind !== 'alliance' || x.against === against));
    if (!o) return { ok: false, why: `You cannot offer ${short(to)} that now` };
    const r = CL.diplomacy.resolve(c, { kind, from: f, to, terms: kind === 'alliance' ? { against } : {} });
    const text = r.ok ? `${short(to)} accepts your offer of ${kind === 'truce' ? 'a truce' : kind === 'peace' ? 'peace' : kind === 'alliance' ? 'an alliance' : kind === 'trade' ? 'a treaty of trade' : 'a pact of nonaggression'}.` : `${short(to)} declines: ${r.why}.`;
    CL.ui.message(text);
    return { ok: Boolean(r.ok), why: r.ok ? '' : r.why, text, treaty: r.treaty || null };
  }
  /** Break one of your realm's treaties: every court hears of it, and the injured realm trusts you less. */
  function renounce(c, id) {
    const f = mine(c);
    const t = (c.treaties || []).find((x) => x.id === id && x.between.includes(f));
    if (!f || !t || t.kind === 'peace') return false;
    CL.diplomacy.breach(c, t, f, 'renounced');
    CL.ui.message(`You break your ${t.kind} with ${short(t.between.find((x) => x !== f))}. Every court has heard of it.`);
    return true;
  }

  // ---- Delegation ----

  /** Set one officer's policy: steward hold|grow|hoard, marshal defend|expand:<realm>|peace, chancellor peace|allies|none. */
  function setPolicy(c, office, value) {
    const ok = office === 'steward' ? value in STEWARD : office === 'chancellor' ? value in CHANCELLOR : office === 'marshal' ? ['defend', 'peace'].includes(value) || (typeof value === 'string' && value.startsWith('expand:') && R().isRealm(value.slice(7)) && value.slice(7) !== mine(c)) : false;
    if (!ok) return false;
    rule(c)[office] = value;
    return true;
  }
  /** The marshal's policy: may your realm plan a siege of this fort's holder? */
  function mayPlan(c, f, target) {
    if (f !== mine(c)) return true;
    const m = rule(c).marshal;
    return m.startsWith('expand:') && target === m.slice(7);
  }
  /** The chancellor's policy: does your realm accept this offer? An alert says what was done. */
  function chancellorAnswers(c, o) {
    const yes = CHANCELLOR[rule(c).chancellor].includes(o.kind);
    alert(c, `${short(o.from)} offers ${o.kind === 'truce' ? 'a truce' : o.kind === 'peace' ? 'peace' : o.kind === 'alliance' ? 'an alliance' : 'a treaty of trade'}. Your chancellor ${yes ? 'accepts' : 'declines'} (policy: ${rule(c).chancellor}).`);
    return { ok: yes, score: yes ? 1 : -1, why: yes ? '' : `your chancellor declines (${rule(c).chancellor})` };
  }
  /** The steward's policy: the tax stance on your own land, each week. */
  function stewardWeek(c) {
    if (!mine(c)) return;
    for (const sid of R().fiefsOf(PLAYER, c)) {
      const h = c.holdings[sid];
      if (h.policies && h.sovereign === mine(c)) h.policies.tax = STEWARD[rule(c).steward];
    }
  }
  /** Alerts reach you as a message: never a screen. */
  function alert(c, text) {
    if (c !== CL.campaign) return;
    CL.ui.message(text);
    CL.diag.log('info', 'Ruler alert', { text });
  }
  /** Your capital is besieged (js/sieges.js): an alert. */
  function onSiege(c, s) {
    const f = mine(c);
    if (f && s.sid === R().capitalOf(f, c)) alert(c, `Your seat, ${placeName(s.sid)}, is besieged by the ${R().faction(s.realm)?.name}.`);
  }

  // ---- Words (the Your realm tab) ----

  function lines(c) {
    const f = mine(c);
    if (!f) return null;
    const K = CL.crowns;
    const r = R().faction(f);
    const out = [`You rule ${r.name}, from ${placeName(R().capitalOf(f, c))}. ${(c.realms[f].recognised.length ? `Recognised by ${c.realms[f].recognised.map(short).join(', ')}.` : 'No realm recognises it yet.')}`];
    if (K) out.push(...K.cardLines(c, f));
    const v = vassals(c);
    out.push(v.length ? `Vassals: ${v.map((pid) => `${R().titled(pid, c)} (thinks ${CL.nobles.opinion(c, pid, PLAYER)} of you)`).join(', ')}.` : 'No vassals yet: lords who think ill of their own ruler and well of you will ask to swear to you.');
    const ts = (c.treaties || []).filter((t) => t.between.includes(f)).map((t) => `${t.kind} with ${short(t.between.find((x) => x !== f))}`);
    out.push(ts.length ? `Treaties: ${ts.join('; ')}.` : 'No treaties.');
    return out;
  }

  // ---- Saves ----

  /** 26 → 27 (build 3.9.0, P9-03): no realm founded in play, and your rule's defaults. */
  const migrate = (d) => ({ ...d, version: 27, realms: {}, nextRealmId: 0, rule: blank() });

  /** Repair your rule onto `s` (after the people and realms). */
  function sanitize(s, d) {
    const o = d?.rule && typeof d.rule === 'object' ? d.rule : {};
    s.rule = blank();
    if (o.steward in STEWARD) s.rule.steward = o.steward;
    if (o.chancellor in CHANCELLOR) s.rule.chancellor = o.chancellor;
    if (o.marshal === 'defend' || o.marshal === 'peace' || (typeof o.marshal === 'string' && o.marshal.startsWith('expand:') && R().isRealm(o.marshal.slice(7)))) s.rule.marshal = o.marshal;
    for (const a of Array.isArray(o.asks) ? o.asks.slice(0, RULES.asksMax) : []) if (s.people?.[a?.lord] && Number.isInteger(a.day) && !s.rule.asks.some((x) => x.lord === a.lord)) s.rule.asks.push({ lord: a.lord, day: a.day });
  }

  CL.founding = { RULES, landOf, STEWARD, CHANCELLOR, blank, rule, mine, declare, recognises, answerRecognition, weekly, onPeace, aiDeclares, askToSwear, answerAsk, vassals, grant, summon, offers, propose, renounce, setPolicy, mayPlan, chancellorAnswers, stewardWeek, onSiege, lines, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
