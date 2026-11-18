// @ts-check
/* Crownless merchant follower (V2-12; design §12.3, §12.7, SC-13, SC-14, SC-39, Prototype E).
 *
 * A camp follower you can hire in a market settlement: HIRE crowns once and WAGE a week, paid with the
 * wages. You give them a budget from your purse (their own account, `budget:merchant`, V2-11) and they
 * trade it when the company reaches a market, through the *same* market functions as you
 * (CL.trade.buy / sell: the same prices, scarcity and per-unit price movement). Their goods are their
 * own stock, never your cargo or food, but they ride in the same wagons (they count toward what the
 * company can carry).
 *
 * What they know: only prices they have seen, in markets the company has visited with them (each visit
 * records that market's prices). An old price is trusted less: its expected sale price is lowered by
 * 1% a day since it was seen, up to 15% (a bounded estimate). They never know an unvisited market.
 *
 * At each market, in order:
 *   1. note the prices here
 *   2. sell stock, a unit at a time, while the price here beats what it cost by the preset's margin
 *   3. buy goods, a unit at a time, whose best known sale price elsewhere beats the price here by the
 *      margin, within the preset's share of the budget invested, the cash in the budget, the room in
 *      the wagons, and a few units of each good per visit
 *   4. report what they did and why ("Sold 4 salt for 68, bought 3 iron for 27; skipped wool, cargo
 *      full"), or that no safe trade was found (SC-14: capital kept, nothing invented)
 * Presets: Cautious (default: 10% margin, at most 70% of the budget in goods, 6 units a good) and Bold
 * (4%, all of it, 12 units). They never sell in the market where they just bought (selling comes
 * first), and a round trip in one market always loses (js/trade.js), so there is no same-town loop.
 *
 * Stop any time: trading pauses. Recover: the budget's cash goes back to your purse and their stock
 * into your cargo. Unpaid twice, or let go, they leave the same way. State: c.followers.merchant (saved)
 * with the cash in c.accounts.budgets.merchant. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const HIRE = 50;
  const WAGE = 8;
  const ACCOUNT = 'budget:merchant';
  const PRESETS = {
    cautious: { margin: 0.1, invest: 0.7, perGood: 6 },
    bold: { margin: 0.04, invest: 1, perGood: 12 },
  };
  const DECAY = { perDay: 0.01, max: 0.15 };
  const LOG_MAX = 20;
  const BY = 'merchant';

  const T = () => CL.trade;
  const A = () => CL.accounts;
  const get = (c) => c.followers?.merchant || null;
  const cash = (c) => A().balance(c, ACCOUNT);
  const goodName = (id) => CL.content.get('markets', id).name.toLowerCase();

  function log(c, text) {
    const m = get(c);
    if (!m) return;
    m.log.push({ day: c.day, text: text.slice(0, 160) });
    if (m.log.length > LOG_MAX) m.log.splice(0, m.log.length - LOG_MAX);
  }

  /** What their goods cost them, in all. @param {Merchant} m */
  const stockCost = (m) => Object.values(m.paid).reduce((a, b) => a + b, 0);

  // ---- Hiring, budget, stopping ----

  const canHire = (c) => !get(c) && T().hasMarket(c.world?.location) && c.gold >= HIRE;

  /** Hire a merchant from your purse. @param {Campaign} c */
  function hire(c) {
    if (!canHire(c)) return null;
    if (!A().spend(c, HIRE, 'hiring a merchant')) return null;
    const place = c.world.location;
    const culture = CL.soldiers.cultureFor('levy', place, c);
    const taken = new Set([...c.roster.map((s) => s.name), c.followers?.quartermaster?.name].filter(Boolean));
    const name = CL.soldiers.makeName(culture, place, () => CL.autoresolve.roll(c, 'names'), taken);
    c.followers ??= { quartermaster: null, merchant: null };
    c.accounts.budgets.merchant ??= 0;
    /** @type {Merchant} */
    const m = { name, culture, origin: place, hired: c.day, preset: 'cautious', active: true, stock: {}, paid: {}, prices: {}, unpaid: 0, log: [] };
    c.followers.merchant = m;
    log(c, `Hired at ${CL.soldiers.placeName(place)}.`);
    note(c, place);
    CL.diag.log('info', 'Merchant hired', { name, place });
    CL.story?.emit('hire', { follower: 'merchant' }, c);
    return m;
  }

  /** Give the merchant crowns from your purse, or (negative) take them back. @param {Campaign} c */
  function fund(c, amount) {
    if (!get(c) || !Number.isInteger(amount) || !amount) return false;
    return amount > 0 ? A().transfer(c, 'purse', ACCOUNT, amount, 'merchant’s budget') : A().transfer(c, ACCOUNT, 'purse', -amount, 'taken from the merchant’s budget');
  }

  /** @param {Campaign} c @param {string} preset */
  function setPreset(c, preset) {
    const m = get(c);
    if (!m || !(preset in PRESETS)) return false;
    m.preset = preset;
    return true;
  }

  /** Stop or start trading. @param {Campaign} c */
  function setActive(c, on) {
    const m = get(c);
    if (!m) return false;
    m.active = Boolean(on);
    log(c, on ? 'Back to trading.' : 'Stopped trading on your word.');
    return true;
  }

  /** Recover everything: the cash to your purse, the stock to your cargo. Returns { cash, goods }. @param {Campaign} c */
  function recover(c) {
    const m = get(c);
    if (!m) return null;
    const money = cash(c);
    if (money > 0) A().transfer(c, ACCOUNT, 'purse', money, 'recovered from the merchant');
    let goods = 0;
    for (const [g, n] of Object.entries(m.stock)) {
      c.cargo[g] = (c.cargo[g] || 0) + n;
      goods += n;
    }
    m.stock = {};
    m.paid = {};
    m.active = false;
    log(c, `Handed back ${money} crowns${goods ? ` and ${goods} goods (now in your cargo)` : ''}.`);
    return { cash: money, goods };
  }

  /** Let them go: everything comes back first. @param {Campaign} c */
  function dismiss(c, why = 'dismissed') {
    const m = get(c);
    if (!m) return false;
    recover(c);
    c.followers.merchant = null;
    delete c.accounts.budgets.merchant;
    CL.diag.log('info', 'Merchant left', { name: m.name, why });
    return true;
  }

  // ---- What they know ----

  /** Note this market's prices. @param {Campaign} c @param {string} sid */
  function note(c, sid) {
    const m = get(c);
    if (!m || !T().hasMarket(sid)) return;
    const row = {};
    for (const g of T().goods()) row[g.id] = { buy: T().unitBuyPrice(c, sid, g.id), sell: T().unitSellPrice(c, sid, g.id), day: c.day };
    m.prices[sid] = row;
  }

  /** The best price they expect to sell a good for somewhere other than `here`, and where. @param {Campaign} c */
  function bestElsewhere(c, good, here) {
    const m = get(c);
    let best = null;
    for (const [sid, row] of Object.entries(m?.prices || {})) {
      if (sid === here || !row[good]) continue;
      const age = Math.max(0, c.day - row[good].day);
      const est = row[good].sell * (1 - Math.min(DECAY.max, DECAY.perDay * age));
      if (!best || est > best.price) best = { sid, price: est };
    }
    return best;
  }

  // ---- Trading ----

  /**
   * Trade at the market the company is in, by the preset's rules. Returns the report, or null when
   * there is nothing to do (no merchant, stopped, no market). @param {Campaign} c
   */
  function visit(c) {
    const m = get(c);
    const sid = c.world?.location;
    if (!m?.active || !T().hasMarket(sid)) return null;
    note(c, sid);
    const p = PRESETS[m.preset] || PRESETS.cautious;
    const opts = { account: ACCOUNT, hold: m.stock, by: BY };
    const sold = {};
    const bought = {};
    let profit = 0;
    /** @type {Record<string, string>} */
    const skipped = {};
    // 1. Sell what pays here.
    for (const g of Object.keys(m.stock)) {
      while (m.stock[g] > 0) {
        const each = m.paid[g] / m.stock[g];
        const price = T().unitSellPrice(c, sid, g);
        if (price < each * (1 + p.margin)) break;
        const r = T().sell(c, sid, g, 1, opts);
        if (!r.ok) break;
        profit += r.total - each;
        m.paid[g] -= each;
        if (!m.stock[g]) delete m.paid[g];
        sold[g] ??= { n: 0, total: 0 };
        sold[g].n++;
        sold[g].total += r.total;
      }
      if (m.stock[g] && !sold[g]) skipped[g] = 'keeping it for a better price';
    }
    // 2. Buy what should sell better elsewhere.
    for (const good of T().goods().map((x) => x.id)) {
      if (sold[good]) continue; // never buy back what was just sold here
      let n = 0;
      let why = null;
      while (n < p.perGood) {
        const best = bestElsewhere(c, good, sid);
        const price = T().unitBuyPrice(c, sid, good);
        if (!best) {
          why = 'no better price known';
          break;
        }
        if (best.price < price * (1 + p.margin)) {
          why = null; // not worth it: too common to report good by good
          break;
        }
        const capital = cash(c) + stockCost(m);
        if (stockCost(m) + price > capital * p.invest) {
          why = 'budget invested';
          break;
        }
        if (cash(c) < price) {
          why = 'budget spent';
          break;
        }
        const r = T().buy(c, sid, good, 1, opts);
        if (!r.ok) {
          why = r.reason === 'Your party cannot carry that much' ? 'cargo full' : 'budget spent';
          break;
        }
        m.paid[good] = (m.paid[good] || 0) + r.total;
        bought[good] ??= { n: 0, total: 0, to: best.sid };
        bought[good].n++;
        bought[good].total += r.total;
        n++;
      }
      if (why && why !== 'no better price known' && !bought[good]) skipped[good] = why;
    }
    for (const g of Object.keys(m.paid)) m.paid[g] = Math.round(m.paid[g] * 100) / 100;
    for (const g of Object.keys(bought)) delete skipped[g]; // holding some and buying more is one story
    const where = CL.soldiers.placeName(sid);
    const list = (o) => Object.entries(o).map(([g, x]) => `${x.n} ${goodName(g)} for ${x.total}`).join(', ');
    const parts = [];
    if (Object.keys(sold).length) parts.push(`Sold ${list(sold)}`);
    if (Object.keys(bought).length) parts.push(`${parts.length ? 'bought' : 'Bought'} ${list(bought)}`);
    const skips = Object.entries(skipped).map(([g, why]) => `skipped ${goodName(g)}, ${why}`);
    const none = Object.keys(m.prices).length < 2 ? 'no other market known yet' : 'no price elsewhere beats this one by enough';
    const text = parts.length ? `At ${where}: ${parts.join('; ')}${skips.length ? `; ${skips.join('; ')}` : ''}. Cash ${cash(c)}.` : `At ${where}: no safe trade (${skips.length ? skips.join('; ') : none}). Cash ${cash(c)} kept.`;
    log(c, text);
    CL.ui.message(`Merchant ${m.name}: ${text}`);
    if (profit > 0) CL.story?.emit('venture', { profit: true }, c);
    return { sold, bought, skipped, text };
  }

  /** Payday: their wage, from the chest then your purse. Unpaid twice and they leave. @param {Campaign} c */
  function payday(c) {
    const m = get(c);
    if (!m) return;
    if (A().pay(c, WAGE, 'merchant’s wage') >= WAGE) {
      m.unpaid = 0;
      return;
    }
    m.unpaid++;
    if (m.unpaid >= 2) {
      CL.ui.message(`Merchant ${m.name} has gone unpaid twice and leaves, handing back the budget and goods.`);
      dismiss(c, 'unpaid');
    } else {
      log(c, 'Went unpaid this week.');
      CL.ui.message(`Merchant ${m.name} went unpaid. Unpaid again next week, they will leave.`);
    }
  }

  /** Their whole worth: cash, and goods at what they cost. @param {Campaign} c */
  const worth = (c) => (get(c) ? cash(c) + stockCost(get(c)) : 0);

  // ---- Saves ----

  /** Repair the saved merchant onto `s` (after accounts and the quartermaster). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.followers.merchant = null;
    const m = d?.followers?.merchant;
    const name = m && CL.soldiers.cleanName(m.name);
    if (!name) {
      delete s.accounts.budgets.merchant;
      return;
    }
    const goods = new Set(T().goods().map((g) => g.id));
    const num = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    /** @type {Record<string, number>} */
    const stock = {};
    /** @type {Record<string, number>} */
    const paid = {};
    for (const [g, n] of Object.entries(m.stock || {})) {
      if (!goods.has(g) || !Number.isInteger(n) || n <= 0) continue;
      stock[g] = Math.min(n, 9999);
      paid[g] = num(m.paid?.[g]) ? m.paid[g] : 0;
    }
    /** @type {Record<string, Record<string, { buy: number, sell: number, day: number }>>} */
    const prices = {};
    for (const [sid, row] of Object.entries(m.prices || {})) {
      if (!T().hasMarket(sid) || !row || typeof row !== 'object') continue;
      prices[sid] = {};
      for (const [g, e] of Object.entries(row)) if (goods.has(g) && num(e?.buy) && num(e?.sell) && num(e?.day)) prices[sid][g] = { buy: e.buy, sell: e.sell, day: e.day };
    }
    s.followers.merchant = {
      name,
      culture: CL.content.table('cultures')[m.culture] ? m.culture : null,
      origin: CL.content.table('settlements')[m.origin] ? m.origin : null,
      hired: num(m.hired) ? m.hired : 0,
      preset: m.preset in PRESETS ? m.preset : 'cautious',
      active: m.active !== false,
      stock,
      paid,
      prices,
      unpaid: Number.isInteger(m.unpaid) ? Math.max(0, Math.min(1, m.unpaid)) : 0,
      log: (Array.isArray(m.log) ? m.log : [])
        .filter((e) => e && typeof e.text === 'string' && num(e.day))
        .slice(-LOG_MAX)
        .map((e) => ({ day: e.day, text: e.text.slice(0, 160) })),
    };
    s.accounts.budgets.merchant ??= 0;
  }

  CL.merchant = { HIRE, WAGE, ACCOUNT, PRESETS, DECAY, get, canHire, hire, fund, setPreset, setActive, recover, dismiss, note, bestElsewhere, visit, payday, worth, stockCost, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
