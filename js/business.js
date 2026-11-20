// @ts-check
/* Crownless businesses (P7-10; decision D-P7b: a mill first, an inn later; design §25.1, §27.4,
 * SC-15, SC-16, SC-40). The rules and numbers are in data/businesses.js.
 *
 * You buy a mill in a village or town with a market (not one whose owner is Hostile to you). It comes
 * with a manager, the village miller, and you may hire a master miller instead. The mill has its own
 * money (the account `budget:mill`, js/accounts.js): you put crowns in and take them out at the mill,
 * and it keeps its own ledger. Every payday it runs a week, without any clicks:
 *   1. the law: who holds the settlement now, and whether they are Hostile to you (below)
 *   2. the manager's wage, from the mill's money; with too little, the mill stands idle that week
 *   3. now and then a breakdown: repairs cost crowns and there is no grinding that week
 *   4. grinding: it buys grain and sells the flour (a sack for a sack; a master miller gets more), in the same market and through the
 *      same functions as you (CL.trade.buy / sell, so the same prices and scarcity: each unit bought
 *      makes grain dearer there, each sold makes flour cheaper). It grinds a unit only while that unit
 *      leaves the manager's margin after the owner's due, within your price rules, the mill's money
 *      and the manager's week. So output is limited by the input, the market and time: no magic profit
 *   5. the owner's due (a share of the sales) and a weekly report: what it did, and on a bad week why
 * The owner's law: every owner takes the due. When the settlement changes hands you are told; if its
 * owner is (or becomes) Hostile to you, you are warned and the mill is seized after `seizeDays` unless
 * you sell it first or mend relations. Seizure takes the mill and its money, and is told in a message,
 * the mill's log and the chronicle: it never vanishes silently. Selling returns a share of the price
 * paid (never more than you paid) plus the mill's money, and works from anywhere. The law is checked
 * first in each payday, so a mill seized on payday neither pays nor grinds (§27.4).
 * State: c.businesses = { owned: [mill], past: [{ kind, place, day, end, by? }] } (saved, schema v18). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LOG_MAX = 16;
  const BOOK_MAX = 120; // the mill's own ledger lines (four or so a week: about thirty weeks)
  const PAST_MAX = 12;
  const KIND = 'mill';
  const ACCOUNT = 'budget:mill';
  const ENDS = ['sold', 'seized'];

  const rules = () => CL.content.table('businesses')[KIND];
  const settlement = (id) => CL.content.table('settlements')[id] || null;
  const placeName = (sid) => settlement(sid)?.name || 'the village';
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  const A = () => CL.accounts;
  const T = () => CL.trade;
  const goodName = (id) => CL.content.get('markets', id).name.toLowerCase();
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'its new lord';

  /** @returns {Businesses} */
  const blank = () => ({ owned: [], past: [] });
  /** @param {Campaign} c */
  const state = (c) => {
    if (!c.businesses) c.businesses = blank();
    return c.businesses;
  };
  /** Your mill, or null. @param {Campaign} c @returns {Mill | null} */
  const get = (c) => state(c).owned.find((b) => b.kind === KIND) || null;
  /** The mill's money. @param {Campaign} c */
  const cash = (c) => A().balance(c, ACCOUNT);
  const manager = (b) => rules().managers[b.manager] || rules().managers.miller;

  /** The business's own roll in [0, 1): from the campaign's seed, a day and a salt; never the world stream. */
  function roll(c, day, salt) {
    let h = (Math.imul((c.rngSeed >>> 0) ^ 0x3c6ef372, 0x85ebca6b) + Math.imul(Math.floor(day) + 11, 0xc2b2ae35) + Math.imul(salt + 5, 0x27d4eb2f)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  function log(b, day, text, bad = false) {
    b.log.push({ day, text: text.slice(0, 200), ...(bad ? { bad: true } : {}) });
    if (b.log.length > LOG_MAX) b.log.splice(0, b.log.length - LOG_MAX);
  }

  // ---- The ledger (js/accounts.js hands every transfer touching the mill's money to `book`) ----

  const isAccount = (acct) => acct === ACCOUNT;
  /** The mill's own ledger for a transfer between these accounts, or null when it isn't the mill's. @param {Campaign} c */
  function bookFor(c, from, to) {
    if (!isAccount(from) && !isAccount(to)) return null;
    const b = get(c);
    if (!b) return null;
    return b.book;
  }
  /** Keep the mill's ledger within its length. @param {Campaign} c */
  function trimBook(c) {
    const b = get(c);
    if (b && b.book.length > BOOK_MAX) b.book.splice(0, b.book.length - BOOK_MAX);
  }

  // ---- Buying, money, managers, rules ----

  /** What a mill costs here, or 0 where none is for sale. @param {string} sid */
  const priceAt = (sid) => {
    const s = settlement(sid);
    const goods = CL.content.table('markets');
    return s && T().hasMarket(sid) && goods[rules().input]?.tradeGood && goods[rules().output]?.tradeGood ? rules().price[s.type] || 0 : 0;
  };

  /** Why you can't buy a mill here, or null when you can. @param {Campaign} c @param {string} sid */
  function blocked(c, sid) {
    const price = priceAt(sid);
    if (!price) return 'No mill for sale here';
    if (state(c).owned.filter((b) => b.kind === KIND).length >= rules().limit) return 'You already own a mill';
    const right = CL.rights.may(c, 'player', 'buyBusiness', sid); // P8-03
    if (!right.ok) return right.why;
    if (c.gold < price) return `You need ${price} crowns (you have ${c.gold})`;
    return null;
  }

  /** Buy the mill here from your purse. @param {Campaign} c @param {string} sid */
  function buy(c, sid) {
    if (blocked(c, sid)) return null;
    const price = priceAt(sid);
    if (!A().spend(c, price, `bought the mill at ${placeName(sid)}`)) return null;
    /** @type {Mill} */
    const b = { kind: KIND, place: sid, bought: c.day, paid: price, owner: CL.realm.owner(sid, c), manager: 'miller', rules: { maxInput: null, minOutput: null }, seizeOn: null, weeks: 0, profit: 0, log: [], book: [] };
    state(c).owned.push(b);
    c.accounts.budgets.mill = 0;
    log(b, c.day, `Bought for ${price} crowns. ${cap(manager(b).name)} runs it; put crowns in for grain and wages.`);
    CL.chronicle?.add(c, { day: c.day, kind: 'business', event: 'bought', place: sid });
    CL.diag.log('info', 'Mill bought', { place: sid, price });
    return b;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /** Are you at your mill? @param {Campaign} c */
  const atMill = (c) => Boolean(get(c) && c.world?.location === get(c).place);

  /** Put crowns into the mill (positive) or take them out (negative); only at the mill. @param {Campaign} c */
  function fund(c, amount) {
    if (!atMill(c) || !Number.isInteger(amount) || !amount) return false;
    return amount > 0 ? A().transfer(c, 'purse', ACCOUNT, amount, 'put into the mill') : A().transfer(c, ACCOUNT, 'purse', -amount, 'taken from the mill');
  }

  /** Change who runs the mill (at the mill): a better manager costs their fee from your purse. @param {Campaign} c */
  function setManager(c, id) {
    const b = get(c);
    const m = rules().managers[id];
    if (!b || !m || !atMill(c) || b.manager === id) return false;
    if (m.hire && !A().spend(c, m.hire, `hired ${m.name} for the mill`)) return false;
    b.manager = id;
    log(b, c.day, `${cap(m.name)} runs the mill now.`);
    return true;
  }

  /** Set a price rule (expert): `maxInput` or `minOutput`, a value from the data's list. @param {Campaign} c */
  function setRule(c, key, value) {
    const b = get(c);
    if (!b || !(key in rules().rules) || !rules().rules[key].includes(value)) return false;
    b.rules[key] = value;
    return true;
  }

  /** What selling the mill would bring: a share of what you paid, never more. @param {Mill} b */
  const saleValue = (b) => Math.min(b.paid, Math.floor(b.paid * rules().sellBack));

  function close(c, b, end, extra = {}) {
    const s = state(c);
    s.owned = s.owned.filter((x) => x !== b);
    s.past.push({ kind: b.kind, place: b.place, day: c.day, end, ...extra });
    if (s.past.length > PAST_MAX) s.past.splice(0, s.past.length - PAST_MAX);
    delete c.accounts.budgets.mill;
  }

  /** Sell the mill (from anywhere: your agent finds a buyer). Returns { price, cash } or null. @param {Campaign} c */
  function sell(c) {
    const b = get(c);
    if (!b) return null;
    const price = saleValue(b);
    const money = cash(c);
    if (money > 0) A().transfer(c, ACCOUNT, 'purse', money, 'the mill’s money, on selling it');
    A().earn(c, price, `sold the mill at ${placeName(b.place)}`);
    close(c, b, 'sold');
    CL.chronicle?.add(c, { day: c.day, kind: 'business', event: 'sold', place: b.place });
    CL.diag.log('info', 'Mill sold', { place: b.place, price, cash: money });
    return { price, cash: money };
  }

  // ---- The law ----

  /**
   * Who holds the mill's settlement, and what that means: told when it changes hands; a Hostile owner
   * warns, then seizes it after `seizeDays` unless relations mend. Returns true when it was seized.
   * @param {Campaign} c @param {Mill} b @param {number} day
   */
  function law(c, b, day) {
    const owner = CL.realm.owner(b.place, c);
    const where = placeName(b.place);
    if (owner !== b.owner) {
      b.owner = owner;
      const text = `${where} is now held by ${factionName(owner)}. Their law: they take ${Math.round(rules().due * 100)}% of the mill's sales${CL.realm.isHostile(c, owner) ? ', and they are Hostile to you' : ''}.`;
      log(b, day, text, true);
      CL.ui.message(`Your mill: ${text}`);
    }
    const hostile = CL.realm.isHostile(c, owner);
    if (hostile && b.seizeOn === null) {
      b.seizeOn = Math.floor(day) + rules().seizeDays;
      const text = `${factionName(owner)} is Hostile to you and will seize the mill at ${where} on day ${CL.party.dayNumber(b.seizeOn)} unless you sell it or mend relations first.`;
      log(b, day, text, true);
      CL.ui.message(`Warning: ${text}`);
    } else if (!hostile && b.seizeOn !== null) {
      b.seizeOn = null;
      log(b, day, `${factionName(owner)} no longer threatens the mill.`);
      CL.ui.message(`Your mill at ${where} is no longer under threat of seizure.`);
    }
    if (b.seizeOn !== null && day >= b.seizeOn) {
      seize(c, b, day);
      return true;
    }
    return false;
  }

  /** The owner takes the mill and its money. @param {Campaign} c @param {Mill} b */
  function seize(c, b, day) {
    const money = cash(c);
    if (money > 0) A().transfer(c, ACCOUNT, A().WORLD, money, `the mill seized by ${factionName(b.owner)}`);
    log(b, day, `Seized by ${factionName(b.owner)}${money ? ` with ${money} crowns of its money` : ''}.`, true);
    close(c, b, 'seized', { by: b.owner });
    CL.chronicle?.add(c, { day: Math.floor(day), kind: 'business', event: 'seized', place: b.place, by: b.owner });
    CL.ui.message(`${factionName(b.owner)} has seized your mill at ${placeName(b.place)}${money ? ` and its ${money} crowns` : ''}.`);
    CL.diag.log('warn', 'Mill seized', { place: b.place, by: b.owner, cash: money });
  }

  /** The law each day, outside paydays too (warnings as soon as things change). @param {Campaign} c */
  function tick(c) {
    const b = get(c);
    if (b) law(c, b, c.day);
  }

  // ---- The week ----

  /**
   * How many units to grind this week, and why it stopped short of the manager's week (null when it
   * didn't). A unit is ground only while the flour it makes, after the owner's due, beats its grain by
   * the margin, within the price rules and the mill's money. Prices move with every unit (CL.trade.quote).
   * @param {Campaign} c @param {Mill} b @param {number} money
   */
  function plan(c, b, money) {
    const R = rules();
    const m = manager(b);
    const sid = b.place;
    const made = (k) => Math.floor(k * m.yield + 1e-9); // flour from k grain
    let n = 0;
    let cost = 0;
    let why = null;
    while (n < m.perWeek) {
      const g = T().quote(c, sid, R.input, n + 1, 'buy').total - cost;
      const f = T().quote(c, sid, R.output, made(n + 1), 'sell').total - T().quote(c, sid, R.output, made(n), 'sell').total;
      if (b.rules.maxInput !== null && g > b.rules.maxInput) {
        why = `${goodName(R.input)} dearer than your limit of ${b.rules.maxInput}`;
        break;
      }
      if (b.rules.minOutput !== null && f < b.rules.minOutput) {
        why = `${goodName(R.output)} cheaper than your limit of ${b.rules.minOutput}`;
        break;
      }
      if (f * (1 - R.due) - g < m.margin) {
        why = `${goodName(R.input)} too dear for the price of ${goodName(R.output)} (${g} against ${f})`;
        break;
      }
      if (cost + g > money) {
        why = 'not enough money for more grain';
        break;
      }
      n++;
      cost += g;
    }
    return { n, out: made(n), why };
  }

  /**
   * Payday at the mill (from js/upkeep.js, on each payday crossed, with that day): the law first, then
   * the wage, breakdowns, grinding, the due and the report. Returns the week's report, or null.
   * @param {Campaign} c @param {number} [day]
   */
  function payday(c, day = c.day) {
    const b = get(c);
    if (!b || law(c, b, day)) return null;
    const R = rules();
    const m = manager(b);
    const where = placeName(b.place);
    const before = cash(c);
    /** @type {MillWeek} */
    const w = { day, ground: 0, made: 0, sales: 0, grain: 0, wage: 0, repairs: 0, due: 0, profit: 0, cause: null, stop: null };
    b.weeks++;
    if (!A().transfer(c, ACCOUNT, A().WORLD, m.wage, 'the miller’s wage')) {
      w.cause = `idle: not enough money for ${m.name}'s wage (${m.wage}); put crowns in at the mill`;
    } else {
      w.wage = m.wage;
      if (roll(c, day, b.weeks) < R.repairs.chance) {
        const paid = A().transfer(c, ACCOUNT, A().WORLD, R.repairs.cost, 'mending the mill') ? R.repairs.cost : 0;
        w.repairs = paid;
        w.cause = paid ? `the millstone cracked: ${paid} crowns of repairs and no grinding` : 'the millstone cracked and there was no money to mend it';
      } else {
        const p = plan(c, b, cash(c));
        if (p.n > 0) {
          const opts = { account: ACCOUNT, hold: {}, by: 'mill', carry: false };
          const bought = T().buy(c, b.place, R.input, p.n, opts);
          if (bought.ok) {
            opts.hold = { [R.output]: p.out };
            const sold = p.out > 0 ? T().sell(c, b.place, R.output, p.out, opts) : { ok: false, total: 0 };
            w.ground = p.n;
            w.made = p.out;
            w.grain = bought.total;
            w.sales = sold.ok ? sold.total : 0;
            const due = Math.round(w.sales * R.due);
            if (due > 0 && A().transfer(c, ACCOUNT, A().WORLD, due, `${factionName(b.owner)}’s due`)) w.due = due;
          }
        }
        // Stopping short is reported; it is a bad week when little or nothing was ground.
        if (p.why && (p.n === 0 || p.n < manager(b).perWeek / 2)) w.cause = p.why;
        else if (p.why) w.stop = p.why;
      }
    }
    trimBook(c);
    w.profit = cash(c) - before;
    b.profit += w.profit;
    const text = weekText(w, m);
    log(b, day, text, Boolean(w.cause) || w.profit < 0);
    CL.ui.message(`Mill at ${where}: ${text}`);
    return w;
  }

  /** One week's report in words. @param {MillWeek} w @param {{ name: string }} m the manager */
  function weekText(w, m) {
    const R = rules();
    const sign = (n) => (n >= 0 ? `+${n}` : `−${-n}`);
    const parts = [];
    if (w.ground) parts.push(`ground ${w.ground} ${goodName(R.input)} into ${w.made} ${goodName(R.output)}: sold for ${w.sales}, the grain cost ${w.grain}`);
    if (w.wage) parts.push(`wage ${w.wage}`);
    if (w.repairs) parts.push(`repairs ${w.repairs}`);
    if (w.due) parts.push(`the lord's due ${w.due}`);
    const did = parts.length ? cap(parts.join(', ')) : `${cap(m.name)} did no work`;
    return `${did}. Week ${sign(w.profit)} crowns.${w.cause ? ` Bad week: ${w.cause}.` : w.stop ? ` Stopped short: ${w.stop}.` : ''}`;
  }

  /**
   * A week at today's prices, before you buy or as things stand: how much it would grind and about what
   * it would leave after the wage and the due (no breakdown, no price rules, enough money).
   * @param {Campaign} c @param {string} sid @param {string} [managerId]
   */
  function estimate(c, sid, managerId = 'miller') {
    const R = rules();
    const m = R.managers[managerId] || R.managers.miller;
    /** @type {any} */
    const probe = { place: sid, manager: managerId, rules: { maxInput: null, minOutput: null } };
    const p = plan(c, probe, Number.POSITIVE_INFINITY);
    const grain = T().quote(c, sid, R.input, p.n, 'buy').total;
    const sales = T().quote(c, sid, R.output, p.out, 'sell').total;
    return { n: p.n, out: p.out, grain, sales, profit: sales - Math.round(sales * R.due) - grain - m.wage, why: p.why };
  }

  // ---- For the screens ----

  /** What the town screen shows about mills here. @param {Campaign} c @param {string} sid */
  function view(c, sid) {
    const b = get(c);
    if (b && b.place === sid) return { kind: 'owned', b };
    if (!priceAt(sid)) return null;
    return { kind: 'forSale', price: priceAt(sid), why: blocked(c, sid) };
  }

  /** The chronicle line for a business entry. @param {ChronicleEntry} e */
  function chronicleText(e) {
    const at = placeName(e.place);
    if (e.event === 'bought') return `Bought the mill at ${at}.`;
    if (e.event === 'sold') return `Sold the mill at ${at}.`;
    return `The mill at ${at} was seized by ${factionName(e.by)}.`;
  }

  /** An account's name for people (js/accounts.js). */
  const label = (acct) => (isAccount(acct) ? 'the mill’s money' : null);

  // ---- Saves ----

  /** Repair the saved businesses onto `s` (after accounts). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const raw = d?.businesses;
    const out = blank();
    const R = rules();
    const str = (t, n) => (typeof t === 'string' ? t.slice(0, n) : '');
    const count = (n) => (num(n) ? Math.max(0, Math.min(9999999, Math.round(n))) : 0);
    const mill = (Array.isArray(raw?.owned) ? raw.owned : []).find((b) => b?.kind === KIND && priceAt(b.place));
    if (mill) {
      const line = (e) => e && A().known?.(e.from) && A().known?.(e.to) && Number.isInteger(e.amount) && e.amount > 0 && num(e.day);
      out.owned.push({
        kind: KIND,
        place: mill.place,
        bought: num(mill.bought) ? mill.bought : 0,
        paid: count(mill.paid) || R.price[settlement(mill.place).type],
        owner: CL.content.table('factions')[mill.owner] ? mill.owner : CL.realm.owner(mill.place, s),
        manager: mill.manager in R.managers ? mill.manager : 'miller',
        rules: {
          maxInput: R.rules.maxInput.includes(mill.rules?.maxInput) ? mill.rules.maxInput : null,
          minOutput: R.rules.minOutput.includes(mill.rules?.minOutput) ? mill.rules.minOutput : null,
        },
        seizeOn: num(mill.seizeOn) ? Math.floor(mill.seizeOn) : null,
        weeks: Number.isInteger(mill.weeks) && mill.weeks >= 0 ? Math.min(mill.weeks, 99999) : 0,
        profit: num(mill.profit) ? Math.round(mill.profit) : 0,
        log: (Array.isArray(mill.log) ? mill.log : [])
          .filter((e) => e && typeof e.text === 'string' && num(e.day))
          .slice(-LOG_MAX)
          .map((e) => ({ day: e.day, text: e.text.slice(0, 200), ...(e.bad === true ? { bad: true } : {}) })),
        book: (Array.isArray(mill.book) ? mill.book : [])
          .filter(line)
          .slice(-BOOK_MAX)
          .map((e) => ({ day: e.day, from: e.from, to: e.to, amount: e.amount, why: str(e.why, 60) })),
      });
      s.accounts.budgets.mill ??= 0;
    } else delete s.accounts.budgets.mill;
    for (const p of Array.isArray(raw?.past) ? raw.past.slice(-PAST_MAX) : []) {
      if (!p || p.kind !== KIND || !settlement(p.place) || !ENDS.includes(p.end) || !num(p.day)) continue;
      out.past.push({ kind: KIND, place: p.place, day: p.day, end: p.end, ...(CL.content.table('factions')[p.by] ? { by: p.by } : {}) });
    }
    s.businesses = out;
  }

  /** Save migration 17 → 18 (pure): no businesses yet. */
  const migrate = (d) => ({ ...d, version: 18, businesses: blank() });

  /** Content checks (from content.validate). */
  function validate(C, err) {
    const R = C.businesses?.[KIND];
    if (!R) return err('businesses: needs a mill');
    // A world without its goods (a world package may leave flour out): no mills there, nothing to check.
    if (!C.markets?.[R.input] || !C.markets?.[R.output]) return;
    if (!C.markets?.[R.input]?.tradeGood || !C.markets?.[R.output]?.tradeGood) err('businesses: the mill needs trade goods in and out');
    if (!(R.sellBack > 0 && R.sellBack < 1)) err('businesses: sellBack must be between 0 and 1 (selling never returns more than you paid)');
    if (!(R.due >= 0 && R.due < 1)) err('businesses: due must be between 0 and 1');
    if (R.managers?.miller?.hire !== 0) err('businesses: the mill needs a default manager, the miller, at no fee');
    for (const [id, m] of Object.entries(R.managers || {})) if (!(m.perWeek > 0 && m.wage > 0 && m.margin >= 1)) err(`businesses: manager ${id} needs a week's work, a wage and a margin of at least 1`);
    for (const [k, v] of Object.entries(R.price || {})) if (!['village', 'town'].includes(k) || !(v > 0)) err(`businesses: bad price for ${k}`);
    if (!(R.limit >= 1) || !(R.seizeDays > 0)) err('businesses: needs a limit and seizeDays');
  }

  CL.business = { KIND, ACCOUNT, rules, blank, state, get, cash, manager, roll, isAccount, bookFor, priceAt, blocked, buy, atMill, fund, setManager, setRule, saleValue, sell, law, tick, plan, estimate, payday, weekText, view, chronicleText, label, sanitize, migrate, validate };
})(typeof window !== 'undefined' ? window : globalThis);
