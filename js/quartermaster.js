// @ts-check
/* Crownless quartermaster (V2-11; design §12.2, §12.6, Part 2 §27 "a quartermaster spends nearly all
 * funds just before wages are due").
 *
 * A camp follower you can hire in a town's tavern (or from Accounts in any settlement with a market):
 * HIRE crowns once and WAGE a week, paid with the soldiers' wages. They buy only necessities (food),
 * always from the company chest. Their rules, set on the Accounts screen:
 *   reserve days  keep this many days of food (default 5; 0 turns buying off)
 *   weekly budget the most they spend on food in a week (default 60)
 *   cover wages   keep the next wages in the chest, topping it up from your purse when you reach a
 *                 settlement (default on), and never spend that money on food
 * In a settlement that sells food they first set the wages aside, then buy food up to the reserve,
 * through the same food purchase and price as you. If the chest holds too little beyond the wages,
 * they draw what the food needs from your purse into the chest first (never more than the budget
 * allows), so the default works without setting anything up. Every move and purchase is in their log
 * and the ledger.
 * Once a day they warn before shortages: food for under 2 days, or the chest and your purse together
 * short of wages due within 2 days. Unpaid for two paydays running, they leave (warned after the first).
 * State: c.followers.quartermaster (saved) or null. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const HIRE = 40;
  const WAGE = 6;
  const DEFAULTS = { reserveDays: 5, budget: 60, coverWages: true };
  /** @type {Record<string, [number, number]>} */
  const LIMITS = { reserveDays: [0, 14], budget: [0, 500] };
  const LOG_MAX = 20;
  const WARN_FOOD_DAYS = 2;
  const WARN_WAGES_DAYS = 2;

  const U = () => CL.upkeep;
  const get = (c) => c.followers?.quartermaster || null;
  /** @param {number} n @param {number[]} range */
  const clamp = (n, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(n)));

  /** A settlement selling food (its market). @param {string | null} id */
  const sellsFood = (id) => Boolean(id && CL.content.table('settlements')[id]?.services?.includes('trade'));

  /** Wages owed at the next payday (the soldiers', plus the quartermaster's own). @param {Campaign} c */
  const wagesDue = (c) => U().weeklyWages(c) + (get(c) ? WAGE : 0);

  function log(c, text) {
    const q = get(c);
    if (!q) return;
    q.log.push({ day: c.day, text: text.slice(0, 120) });
    if (q.log.length > LOG_MAX) q.log.splice(0, q.log.length - LOG_MAX);
  }

  /** Can one be hired here? @param {Campaign} c */
  const canHire = (c) => !get(c) && sellsFood(c.world?.location) && c.gold >= HIRE;

  /** Hire a quartermaster from your purse. Returns them, or null. @param {Campaign} c */
  function hire(c) {
    if (!canHire(c)) return null;
    if (!CL.accounts.spend(c, HIRE, 'hiring a quartermaster')) return null;
    const place = c.world.location;
    const culture = CL.soldiers.cultureFor('levy', place, c);
    const name = CL.soldiers.makeName(culture, place, () => CL.autoresolve.roll(c, 'names'), new Set(c.roster.map((s) => s.name)));
    c.followers ??= { quartermaster: null };
    /** @type {Quartermaster} */
    const q = { name, culture, origin: place, hired: c.day, ...DEFAULTS, weekStart: Math.floor(c.day), spent: 0, unpaid: 0, warnedDay: -1, log: [] };
    c.followers.quartermaster = q;
    log(c, `Hired at ${CL.soldiers.placeName(place)}.`);
    CL.diag.log('info', 'Quartermaster hired', { name, place });
    act(c);
    return q;
  }

  /** Let them go (no refund). @param {Campaign} c */
  function dismiss(c, why = 'dismissed') {
    const q = get(c);
    if (!q) return false;
    c.followers.quartermaster = null;
    CL.diag.log('info', 'Quartermaster left', { name: q.name, why });
    return true;
  }

  /** Change a rule; values are kept within limits. @param {Campaign} c @param {'reserveDays' | 'budget' | 'coverWages'} key */
  function setRule(c, key, value) {
    const q = get(c);
    if (!q) return false;
    if (key === 'coverWages') q.coverWages = Boolean(value);
    else if (key in LIMITS && Number.isFinite(value)) q[key] = clamp(value, LIMITS[key]);
    else return false;
    return true;
  }

  /** Start a new spending week when one has passed. */
  function rollWeek(c, q) {
    if (c.day - q.weekStart >= 7) {
      q.weekStart = Math.floor(c.day);
      q.spent = 0;
    }
  }

  /**
   * Do the job in a settlement with a market: set the next wages aside, then buy food up to the
   * reserve within the budget, from the chest only. Returns what was done (for tests and the report).
   * @param {Campaign} c
   */
  function act(c) {
    const q = get(c);
    if (!q || !sellsFood(c.world?.location)) return null;
    rollWeek(c, q);
    const A = CL.accounts;
    const done = { setAside: 0, drawn: 0, rations: 0, cost: 0, short: 0 };
    const due = wagesDue(c);
    if (q.coverWages && A.balance(c, 'chest') < due && c.gold > 0) {
      const n = Math.min(due - A.balance(c, 'chest'), c.gold);
      if (A.transfer(c, 'purse', 'chest', n, 'set aside for wages')) {
        done.setAside = n;
        log(c, `Set ${n} crowns aside in the chest for wages.`);
      }
    }
    const need = Math.ceil(q.reserveDays * U().dailyRations(c) - c.food);
    if (need > 0) {
      const price = U().rationPrice(c);
      const reserved = q.coverWages ? due : 0;
      const left = Math.max(0, q.budget - q.spent);
      const want = Math.min(need, Math.floor(left / price)) * price; // what the budget allows
      const lack = want - Math.max(0, A.balance(c, 'chest') - reserved);
      if (lack > 0 && c.gold > 0 && A.transfer(c, 'purse', 'chest', Math.min(lack, c.gold), 'drawn for food')) {
        done.drawn = Math.min(lack, A.balance(c, 'chest'));
      }
      const free = A.balance(c, 'chest') - reserved;
      const room = Math.max(0, Math.min(free, left));
      const n = Math.min(need, Math.floor(room / price));
      if (n > 0 && U().buyFood(c, n, 'chest')) {
        done.rations = n;
        done.cost = n * price;
        q.spent += done.cost;
      }
      done.short = need - n;
      const where = CL.soldiers.placeName(c.world.location);
      if (n > 0) log(c, `Bought ${n} rations at ${where} for ${done.cost} from the chest${done.short ? `; ${done.short} short (${free < price ? 'no more money' : 'weekly budget spent'})` : ''}.`);
      else log(c, `Needed ${need} rations at ${where} but bought none: ${free < price ? 'no money beyond the wages' : 'the weekly budget is spent'}.`);
    }
    if (done.setAside || done.rations) {
      CL.ui.message(`Quartermaster ${q.name}: ${[done.setAside ? `${done.setAside} set aside for wages` : '', done.rations ? `bought ${done.rations} rations for ${done.cost}` : ''].filter(Boolean).join(', ')}`);
    }
    return done;
  }

  /**
   * Once a day: work in a market town, otherwise warn before shortages (once per day).
   * Called at each midnight by CL.upkeep. @param {Campaign} c
   */
  function daily(c) {
    const q = get(c);
    if (!q) return;
    if (sellsFood(c.world?.location)) {
      act(c);
      return;
    }
    const day = Math.floor(c.day);
    if (q.warnedDay === day) return;
    const days = U().foodDays(c);
    const due = wagesDue(c);
    const soon = c.nextWagesDay - c.day <= WARN_WAGES_DAYS;
    let warn = null;
    if (days < WARN_FOOD_DAYS) warn = `food for ${days.toFixed(1)} days; we need a market`;
    else if (soon && CL.accounts.balance(c, 'chest') + c.gold < due) warn = `wages of ${due} due on day ${CL.party.dayNumber(c.nextWagesDay)}, and we have ${CL.accounts.balance(c, 'chest') + c.gold}`;
    if (warn) {
      q.warnedDay = day;
      log(c, `Warned: ${warn}.`);
      CL.ui.message(`Quartermaster ${q.name}: ${warn}.`);
    }
  }

  /** Payday: their wage, from the chest then your purse. Two unpaid weeks and they leave. @param {Campaign} c */
  function payday(c) {
    const q = get(c);
    if (!q) return;
    const paid = CL.accounts.pay(c, WAGE, 'quartermaster’s wage');
    if (paid >= WAGE) {
      q.unpaid = 0;
      return;
    }
    q.unpaid++;
    if (q.unpaid >= 2) {
      CL.ui.message(`Quartermaster ${q.name} has gone unpaid twice and leaves the company.`);
      dismiss(c, 'unpaid');
    } else {
      log(c, 'Went unpaid this week.');
      CL.ui.message(`Quartermaster ${q.name} went unpaid. Unpaid again next week, they will leave.`);
    }
  }

  // ---- Saves ----

  /** Repair the saved followers onto `s`. @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.followers = { quartermaster: null };
    const q = d?.followers?.quartermaster;
    if (!q || typeof q !== 'object') return;
    const num = (n, dflt) => (typeof n === 'number' && Number.isFinite(n) ? n : dflt);
    const name = CL.soldiers.cleanName(q.name);
    if (!name) return;
    s.followers.quartermaster = {
      name,
      culture: CL.content.table('cultures')[q.culture] ? q.culture : null,
      origin: CL.content.table('settlements')[q.origin] ? q.origin : null,
      hired: Math.max(0, num(q.hired, 0)),
      reserveDays: clamp(num(q.reserveDays, DEFAULTS.reserveDays), LIMITS.reserveDays),
      budget: clamp(num(q.budget, DEFAULTS.budget), LIMITS.budget),
      coverWages: q.coverWages === undefined ? DEFAULTS.coverWages : Boolean(q.coverWages),
      weekStart: Math.max(0, num(q.weekStart, 0)),
      spent: Math.max(0, Math.floor(num(q.spent, 0))),
      unpaid: Math.max(0, Math.min(1, Math.floor(num(q.unpaid, 0)))),
      warnedDay: Math.floor(num(q.warnedDay, -1)),
      log: (Array.isArray(q.log) ? q.log : [])
        .filter((e) => e && typeof e.text === 'string' && typeof e.day === 'number' && Number.isFinite(e.day))
        .slice(-LOG_MAX)
        .map((e) => ({ day: e.day, text: e.text.slice(0, 120) })),
    };
  }

  CL.quartermaster = { HIRE, WAGE, DEFAULTS, LIMITS, get, canHire, hire, dismiss, setRule, act, daily, payday, wagesDue, sellsFood, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
