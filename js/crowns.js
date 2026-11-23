// @ts-check
/* Crownless crowns (P9-01, design §18.1): a realm's treasury, its laws and its offices.
 *
 * - **Treasury:** `c.crowns[id].treasury`, a whole number of crowns, never below nothing. Money moves
 *   only through `pay(c, from, to, n, line)`, where a side is a realm (`realm:<id>`), a holding (its
 *   settlement id), the player's purse, or `world`. A holding of yours keeps its fief account; anyone
 *   else's its `treasury`. Your ledger sees only what touches you.
 * - **In:** the crown's due from every fief (the law's share, a twentieth more with a steward); the whole
 *   tax of the ruler's own land (whose costs the crown pays too); ransoms paid to it; a free city's
 *   trade. **Out:** a mercenary's pay, the garrisons of the ruler's land, ransoms for its lords after a
 *   month, office wages. A realm that can't pay doesn't: no hiring, no ransom, unpaid garrisons.
 * - **Book:** each realm keeps the last 12 weeks, each week's start and its lines in and out.
 *   `invariants` checks that every week's start, plus what came in, less what went out, is the next
 *   week's start (or the treasury now).
 * - **Laws** (data/factions.js `laws`, else `DEFAULT_LAWS`): power, the crown's share, succession, fiefs
 *   a lord may hold, and who makes war (the ruler, or a council: the realm's riding lords, by their
 *   average opinion of the other realm's ruler).
 * - **Offices:** marshal, steward and chancellor, filled within 3 days of a vacancy by the lord the ruler
 *   thinks best of among riding lords with land (standing breaks ties). The runner-up remembers being
 *   passed over. A free city has a treasury and no offices. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    startWeeks: 4, // a realm's treasury at the start: this many weeks of its income
    bookWeeks: 12,
    wage: 10, // an office's wage, crowns a week
    steward: 0.05, // a steward adds this much to the crown's due
    vacancyDays: 3,
    councilWar: -20, // a council goes to war when its lords' average opinion of the other ruler is below this
    hireWeeks: 2, // a realm hires a company only with this many weeks of its pay in hand
  };
  const OFFICES = ['marshal', 'steward', 'chancellor'];
  const DEFAULT_LAWS = { power: 'crown', share: 0.1, succession: 'eldest', fiefCap: 3, war: 'ruler' };
  const LINES = ['due', 'tax', 'trade', 'ransom', 'wages', 'steward', 'repairs', 'recruits', 'militia', 'mercenary', 'office', 'debug'];
  const PLAYER = 'player';
  const PREFIX = 'realm:';

  const R = () => CL.realm;
  const A = () => CL.accounts;
  const F = () => CL.fiefs;
  const faction = (id) => CL.content.table('factions')[id] || null;
  const realmOf = (side) => (typeof side === 'string' && side.startsWith(PREFIX) ? side.slice(PREFIX.length) : null);
  const side = (f) => `${PREFIX}${f}`;
  const weekOf = (day) => Math.floor(day / 7);

  // ---- Laws ----

  /** A realm's laws: the data's, with a save's changes on top. @param {Campaign} c @param {string} f */
  function laws(c, f) {
    return { ...DEFAULT_LAWS, ...(faction(f)?.laws || {}), ...(c?.crowns?.[f]?.laws || {}) };
  }
  /** Is a law's value well formed? (the content's own check, js/content.js) */
  const validLaw = (k, v) => Boolean(CL.content.LAWS[k]?.(v));

  // ---- The records ----

  /** The realms (and free cities) of this world that keep a treasury. */
  const ids = () => R().kingdoms().map((f) => f.id);
  const hasOffices = (f) => R().isRealm(f);

  function blank(f) {
    return { treasury: 0, book: [], offices: hasOffices(f) ? Object.fromEntries(OFFICES.map((o) => [o, null])) : {}, vacant: {} };
  }

  /** A realm's weekly income by the rules, for its start money. */
  function income(c, f) {
    let n = faction(f)?.freeCity ? F().RULES.tax.town : 0;
    const share = laws(c, f).share;
    for (const sid of Object.keys(c.holdings || {})) {
      const h = F().ensure(c, sid);
      if (h.sovereign !== f) continue;
      const tax = Math.round(F().RULES.tax[h.kind] * (h.prosperity / 50));
      n += crownLand(c, sid) ? tax : Math.round(tax * share);
    }
    return n;
  }

  /** Fill in every realm's record (new games, old saves): four weeks of income, offices filled. */
  function ensure(c) {
    c.crowns ||= {};
    for (const f of ids()) {
      if (c.crowns[f]) continue;
      const k = blank(f);
      c.crowns[f] = k;
      k.treasury = RULES.startWeeks * income(c, f);
      k.book = [{ week: weekOf(c.day || 0), start: k.treasury, in: {}, out: {} }];
      for (const o of Object.keys(k.offices)) k.offices[o] = choose(c, f, o)?.[0] || null;
    }
    return c.crowns;
  }
  /** @param {Campaign} c @param {string} f */
  const record = (c, f) => ensure(c)[f] || null;
  /** A realm's treasury now. */
  const treasury = (c, f) => record(c, f)?.treasury || 0;

  /** Is this holding the ruler's own land (its money is the crown's)? Never yours. */
  function crownLand(c, sid) {
    const h = c.holdings?.[sid];
    return Boolean(h && h.holder !== PLAYER && h.holder && h.holder === R().rulerOf(h.sovereign, c));
  }

  // ---- Money ----

  /** The week's page of a realm's book. */
  function page(c, f) {
    const k = record(c, f);
    const w = weekOf(c.day || 0);
    let p = k.book.at(-1);
    if (!p || p.week !== w) {
      p = { week: w, start: k.treasury, in: {}, out: {} };
      k.book.push(p);
      if (k.book.length > RULES.bookWeeks) k.book.splice(0, k.book.length - RULES.bookWeeks);
    }
    return p;
  }
  function book(c, f, dir, line, n) {
    const p = page(c, f);
    const key = LINES.includes(line) ? line : 'debug';
    p[dir][key] = (p[dir][key] || 0) + n;
  }

  /** What a side has. */
  function balance(c, s) {
    const f = realmOf(s);
    if (f) return treasury(c, f);
    if (s === 'world') return Number.POSITIVE_INFINITY;
    if (s === 'purse' || s === 'chest') return A().balance(c, s);
    const h = c.holdings?.[s];
    if (!h) return 0;
    if (crownLand(c, s)) return treasury(c, h.sovereign);
    return h.holder === PLAYER ? A().balance(c, F().account(s)) : h.treasury || 0;
  }
  function take(c, s, n, why) {
    const f = realmOf(s) || (crownLand(c, s) ? c.holdings[s].sovereign : null);
    if (f) {
      book(c, f, 'out', why, n); // the week's page first: it opens with the treasury before this
      record(c, f).treasury -= n;
    } else if (s === 'purse' || s === 'chest') A().transfer(c, s, 'world', n, why);
    else if (s !== 'world') {
      const h = c.holdings[s];
      if (h.holder === PLAYER) A().transfer(c, F().account(s), 'world', n, why);
      else h.treasury -= n;
    }
  }
  function give(c, s, n, why) {
    const f = realmOf(s) || (crownLand(c, s) ? c.holdings[s].sovereign : null);
    if (f) {
      book(c, f, 'in', why, n);
      record(c, f).treasury += n;
    } else if (s === 'purse' || s === 'chest') A().transfer(c, 'world', s, n, why);
    else if (s !== 'world') {
      const h = c.holdings[s];
      if (h.holder === PLAYER) A().transfer(c, 'world', F().account(s), n, why);
      else h.treasury = (h.treasury || 0) + n;
    }
  }
  const known = (c, s) => s === 'world' || s === 'purse' || s === 'chest' || (realmOf(s) ? Boolean(record(c, realmOf(s))) : Boolean(c.holdings?.[s]));

  /**
   * Move `n` crowns from one side to another. `line` names the book's line (LINES); `text` is the
   * ledger's words when you are a side. All or nothing, unless `partial`: then what is there. Returns
   * what moved. Never below nothing.
   * @param {Campaign} c @param {string} from @param {string} to @param {number} n @param {string} line
   */
  function pay(c, from, to, n, line, { partial = false, text = null } = {}) {
    if (!known(c, from) || !known(c, to)) return 0;
    const want = Math.floor(n);
    if (!(want > 0)) return 0;
    const have = Math.floor(balance(c, from));
    const amount = partial ? Math.min(want, have) : have >= want ? want : 0;
    if (amount <= 0) return 0;
    const words = text || line;
    // One side is a person's account (your purse, chest or fief): a single ledger line with its words.
    const fromRealm = realmOf(from) || (crownLand(c, from) ? c.holdings[from].sovereign : null);
    const toRealm = realmOf(to) || (crownLand(c, to) ? c.holdings[to].sovereign : null);
    if (fromRealm && toRealm && fromRealm === toRealm) return amount; // the crown paying itself
    take(c, from, amount, fromRealm ? line : words);
    give(c, to, amount, toRealm ? line : words);
    return amount;
  }

  /** Can a realm pay this much now? */
  const canPay = (c, f, n) => treasury(c, f) >= n;
  /** Can a realm hire a company at this weekly pay? */
  const canHire = (c, f, weekly) => canPay(c, f, Math.round(weekly * RULES.hireWeeks));

  // ---- War by council ----

  /** The riding lords of a realm, free now. */
  const riders = (c, f) => (CL.lords?.riders(c) || []).filter((pid) => c.people[pid]?.realm === f && c.people[pid].status === 'free');

  /** Does realm `f` agree to go to war with `g`? A crown's ruler does; a council by its lords' opinions. */
  function wantsWar(c, f, g) {
    if (!R().isRealm(f) || laws(c, f).war !== 'council' || !CL.nobles) return true;
    const ruler = R().rulerOf(g, c);
    const lords = riders(c, f);
    if (!ruler || !lords.length) return true;
    const avg = lords.reduce((n, pid) => n + CL.nobles.opinion(c, pid, ruler), 0) / lords.length;
    return avg < RULES.councilWar;
  }
  /** Both realms agree to war (a crown always; a council only by its lords). */
  const mayWar = (c, a, b) => wantsWar(c, a, b) && wantsWar(c, b, a);

  // ---- Offices ----

  /** Who could hold an office: riding lords with land, of the realm, free, in no other office. */
  function choose(c, f, office) {
    const ruler = R().rulerOf(f, c);
    if (!ruler || !hasOffices(f)) return [];
    const held = new Set(Object.entries(c.crowns?.[f]?.offices || {}).filter(([o]) => o !== office).map(([, pid]) => pid));
    const rank = { great: 2, lesser: 1, landless: 0 };
    const score = (pid) => (CL.nobles ? CL.nobles.opinion(c, ruler, pid) : 0);
    return riders(c, f)
      .filter((pid) => !held.has(pid) && R().fiefsOf(pid, c).length)
      .sort((a, b) => score(b) - score(a) || rank[R().standingOf(b, c)] - rank[R().standingOf(a, c)] || a.localeCompare(b));
  }
  /** Who holds an office now (null if vacant). */
  const holder = (c, f, office) => record(c, f)?.offices?.[office] || null;
  /** The offices a person holds: [{ realm, office }]. */
  const officesOf = (c, pid) =>
    Object.entries(ensure(c)).flatMap(([f, k]) =>
      Object.entries(k.offices || {})
        .filter(([, p]) => p === pid)
        .map(([office]) => ({ realm: f, office })),
    );
  /** Can this person go on holding an office of `f`? */
  const fit = (c, f, pid) => Boolean(pid && c.people?.[pid] && c.people[pid].realm === f && c.people[pid].status === 'free' && !R().rules(pid, c) && R().fiefsOf(pid, c).length);

  /** Day by day: offices fall vacant, and are filled within a few days. */
  function tick(c) {
    for (const f of ids()) {
      const k = record(c, f);
      for (const o of Object.keys(k.offices)) {
        if (k.offices[o] && !fit(c, f, k.offices[o])) {
          CL.diag.log('info', 'Office vacant', { realm: f, office: o, was: k.offices[o] });
          k.offices[o] = null;
        }
        if (k.offices[o]) {
          delete k.vacant[o];
          continue;
        }
        if (k.vacant[o] == null) k.vacant[o] = Math.floor(c.day);
        if (c.day - k.vacant[o] < RULES.vacancyDays) continue;
        const [pick, next] = choose(c, f, o);
        if (!pick) continue;
        k.offices[o] = pick;
        delete k.vacant[o];
        const ruler = R().rulerOf(f, c);
        if (next) CL.nobles?.note(c, next, ruler, 'passed_over', { kin: false });
        CL.diag.log('info', 'Office filled', { realm: f, office: o, by: pick, passedOver: next || null });
      }
    }
  }

  /** The week (on the payday, after the holdings): a free city's trade, and office wages. */
  function week(c) {
    for (const f of ids()) {
      if (faction(f)?.freeCity) pay(c, 'world', side(f), F().RULES.tax.town, 'trade');
      for (const pid of Object.values(record(c, f).offices)) {
        if (!pid) continue;
        const to = R().fiefsOf(pid, c)[0] || 'world'; // into the holder's first fief
        pay(c, side(f), to, RULES.wage, 'office');
      }
      page(c, f); // every week has its page, if nothing moved
    }
  }

  /** The crown's due on a tax: the law's share, a twentieth more with a steward. */
  const due = (c, f, tax) => Math.round(tax * laws(c, f).share * (holder(c, f, 'steward') ? 1 + RULES.steward : 1));

  // ---- Words ----

  const WORD = {
    power: { crown: 'a crown', league: 'a league' },
    succession: { eldest: 'the eldest child inherits', kin: 'the kin elect an heir', council: 'the council chooses an heir' },
    war: { ruler: 'the ruler makes war', council: 'the council makes war' },
  };
  /** The trend over the book: rising, falling or steady. */
  function trend(c, f) {
    const b = record(c, f).book;
    const first = b[Math.max(0, b.length - 4)]?.start ?? treasury(c, f);
    const d = treasury(c, f) - first;
    return d > 0 ? 'rising' : d < 0 ? 'falling' : 'steady';
  }
  /** A realm's card lines: its treasury and trend, its laws, its offices. */
  function cardLines(c, f) {
    const L = laws(c, f);
    const lines = [`Treasury: ${treasury(c, f)} crowns, ${trend(c, f)}.`, `Laws: ${WORD.power[L.power]}; ${Math.round(L.share * 100)}% to the crown; ${WORD.succession[L.succession]}; ${L.fiefCap} fiefs a lord; ${WORD.war[L.war]}.`];
    const k = record(c, f);
    if (Object.keys(k.offices).length) {
      const name = (o) => `${o[0].toUpperCase()}${o.slice(1)}: ${k.offices[o] ? R().titled(k.offices[o], c) : 'vacant'}`;
      lines.push(`Offices: ${Object.keys(k.offices).map(name).join(' · ')}.`);
    }
    return lines;
  }

  // ---- Checks ----

  /** What breaks the books: a treasury below nothing or not whole, a week that doesn't add up. */
  function invariants(c) {
    const out = [];
    if (!c.crowns) return out;
    for (const [f, k] of Object.entries(c.crowns)) {
      if (!Number.isInteger(k.treasury) || k.treasury < 0) out.push(`${f}: treasury ${k.treasury}`);
      for (let i = 0; i < k.book.length; i++) {
        const p = k.book[i];
        const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        const end = i + 1 < k.book.length ? k.book[i + 1].start : k.treasury;
        if (p.start + sum(p.in) - sum(p.out) !== end) out.push(`${f}: week ${p.week} doesn't balance`);
      }
      for (const [o, pid] of Object.entries(k.offices || {})) if (pid && !c.people?.[pid]) out.push(`${f}: ${o} held by unknown ${pid}`);
    }
    return out;
  }

  // ---- Saves ----

  /** 24 → 25 (build 3.7.0, P9-01): realm treasuries begin on load, from four weeks of their income. */
  const migrate = (d) => ({ ...d, version: 25, crowns: {} });

  const whole = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(99999999, Math.floor(n)) : null);

  /** Repair the saved crowns onto `s` (after the people and holdings); missing realms start afresh. */
  function sanitize(s, d) {
    s.crowns = {};
    const saved = d?.crowns && typeof d.crowns === 'object' ? d.crowns : {};
    for (const f of ids()) {
      const old = saved[f];
      if (!old || typeof old !== 'object' || whole(old.treasury) == null) continue;
      const k = blank(f);
      k.treasury = whole(old.treasury);
      for (const p of Array.isArray(old.book) ? old.book.slice(-RULES.bookWeeks) : []) {
        if (!p || !Number.isInteger(p.week) || whole(p.start) == null) continue;
        const lines = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([key, n]) => LINES.includes(key) && whole(n) != null).map(([key, n]) => [key, whole(n)]));
        k.book.push({ week: p.week, start: whole(p.start), in: lines(p.in), out: lines(p.out) });
      }
      // A book that doesn't add up (junk) starts again from today.
      const broken = k.book.some((p, i) => p.start + Object.values(p.in).reduce((a, b) => a + b, 0) - Object.values(p.out).reduce((a, b) => a + b, 0) !== (i + 1 < k.book.length ? k.book[i + 1].start : k.treasury));
      if (broken || !k.book.length) k.book = [{ week: weekOf(s.day || 0), start: k.treasury, in: {}, out: {} }];
      for (const o of Object.keys(k.offices)) {
        const pid = old.offices?.[o];
        if (typeof pid === 'string' && s.people?.[pid]?.realm === f) k.offices[o] = pid;
        if (Number.isInteger(old.vacant?.[o])) k.vacant[o] = old.vacant[o];
      }
      if (old.laws && typeof old.laws === 'object') {
        const L = Object.fromEntries(Object.entries(old.laws).filter(([key, v]) => key in DEFAULT_LAWS && validLaw(key, v)));
        if (Object.keys(L).length) k.laws = L;
      }
      s.crowns[f] = k;
    }
    ensure(s);
  }

  CL.crowns = { RULES, OFFICES, DEFAULT_LAWS, LINES, laws, validLaw, ensure, record, treasury, income, crownLand, balance, pay, canPay, canHire, side, wantsWar, mayWar, choose, holder, officesOf, tick, week, due, trend, cardLines, invariants, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
