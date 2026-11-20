// @ts-check
/* Crownless accounts (V2-11; design §12, §25.1 "every money transfer has a source and destination",
 * SC-02).
 *
 * Money lives in separate accounts:
 *   purse      your own crowns (c.gold, as before): loot, rewards, hiring, training, the market
 *   chest      the company chest (c.accounts.chest): money set aside for the company. Wages are paid
 *              from it first, then from your purse; the quartermaster buys from it
 *   budget:X   a follower's own budget (c.accounts.budgets[X]): the merchant's (V2-12); a business's
 *              money (`budget:mill`, P7-10), which keeps its own ledger and stays at the mill
 * and the world outside ('world') is where income comes from and spending goes.
 *
 * Every change of money goes through `transfer` (or its shorthands `earn`, `spend`, `pay`, `seize`):
 * a source, a destination, a whole number of crowns, and a reason. Accounts never go below zero and
 * nothing is created from thin air except income from the world. The newest LEDGER_MAX transfers are
 * kept in the ledger (c.ledger, saved) for the Accounts screen. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LEDGER_MAX = 60;
  const WORLD = 'world';

  /** @returns {Accounts} */
  const blank = () => ({ chest: 0, budgets: {} });

  /** @param {Campaign} c @param {string} acct */
  function balance(c, acct) {
    if (acct === 'purse') return c.gold;
    if (acct === 'chest') return c.accounts?.chest || 0;
    if (acct.startsWith('budget:')) return c.accounts?.budgets?.[acct.slice(7)] || 0;
    return Number.POSITIVE_INFINITY; // the world
  }

  /** @param {Campaign} c @param {string} acct @param {number} n */
  function set(c, acct, n) {
    if (acct === 'purse') c.gold = n;
    else if (acct === 'chest') c.accounts.chest = n;
    else if (acct.startsWith('budget:')) c.accounts.budgets[acct.slice(7)] = n;
  }

  const known = (acct) => acct === WORLD || acct === 'purse' || acct === 'chest' || /^budget:[a-z_]+$/.test(acct);

  /**
   * Move `amount` crowns from one account to another, with a reason. Refused (false) if the amount
   * isn't a positive whole number, an account is unknown, or the source hasn't enough.
   * @param {Campaign} c @param {string} from @param {string} to @param {number} amount @param {string} why
   */
  function transfer(c, from, to, amount, why) {
    if (!Number.isInteger(amount) || amount <= 0 || from === to || !known(from) || !known(to)) return false;
    if (!c.accounts) c.accounts = blank();
    if (balance(c, from) < amount) return false;
    if (from !== WORLD) set(c, from, balance(c, from) - amount);
    if (to !== WORLD) set(c, to, balance(c, to) + amount);
    const line = { day: c.day, from, to, amount, why: String(why).slice(0, 60) };
    // A business's money keeps its own ledger (P7-10), so a mill's weekly trade never pushes your own
    // lines out; money between it and your purse or chest is in both.
    const book = CL.business?.bookFor(c, from, to);
    if (book) book.push({ ...line });
    if (!book || [from, to].some((a) => a === 'purse' || a === 'chest')) {
      if (!Array.isArray(c.ledger)) c.ledger = [];
      c.ledger.push(line);
      if (c.ledger.length > LEDGER_MAX) c.ledger.splice(0, c.ledger.length - LEDGER_MAX);
    }
    return true;
  }

  /** Income from the world into an account (the purse by default). @param {Campaign} c */
  const earn = (c, amount, why, to = 'purse') => amount > 0 && transfer(c, WORLD, to, Math.round(amount), why);
  /** Spending to the world from an account (the purse by default). @param {Campaign} c */
  const spend = (c, amount, why, from = 'purse') => amount > 0 && transfer(c, from, WORLD, Math.round(amount), why);

  /**
   * Pay up to `amount` to the world from accounts in order (by default the chest, then the purse).
   * Returns how much was paid (partial pay is possible). @param {Campaign} c
   */
  function pay(c, amount, why, order = ['chest', 'purse']) {
    let paid = 0;
    for (const acct of order) {
      const n = Math.min(amount - paid, balance(c, acct));
      if (n > 0 && transfer(c, acct, WORLD, n, why)) paid += n;
      if (paid >= amount) break;
    }
    return paid;
  }

  /** Captors take a share of every account you carry (only `keep` of each is kept); a business's money
   * stays at the business (P7-10). Returns the total taken. @param {Campaign} c */
  function seize(c, keep, why) {
    let taken = 0;
    const accts = ['purse', 'chest', ...Object.keys(c.accounts?.budgets || {}).map((k) => `budget:${k}`)].filter((a) => !CL.business?.isAccount(a));
    for (const acct of accts) {
      const n = balance(c, acct) - Math.floor(balance(c, acct) * keep);
      if (n > 0 && transfer(c, acct, WORLD, n, why)) taken += n;
    }
    return taken;
  }

  /** Everything you have: purse, chest and budgets. @param {Campaign} c */
  const total = (c) => c.gold + (c.accounts?.chest || 0) + Object.values(c.accounts?.budgets || {}).reduce((a, b) => a + b, 0);

  /** The newest ledger lines first. @param {Campaign} c */
  const recent = (c, n = 12) => (c.ledger || []).slice(-n).reverse();

  /** An account's name for people. */
  const label = (acct) => CL.business?.label(acct) || (acct === 'purse' ? 'your purse' : acct === 'chest' ? 'the company chest' : acct === WORLD ? 'outside' : `${acct.slice(7)}'s budget`);

  // ---- Saves ----

  const count = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(9999999, Math.floor(n)) : 0);

  /** Repair the saved accounts and ledger onto `s`. @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.accounts = blank();
    s.accounts.chest = count(d?.accounts?.chest);
    for (const [k, v] of Object.entries(d?.accounts?.budgets || {})) if (/^[a-z_]+$/.test(k)) s.accounts.budgets[k] = count(v);
    s.ledger = [];
    for (const e of Array.isArray(d?.ledger) ? d.ledger.slice(-LEDGER_MAX) : []) {
      if (!e || !known(e.from) || !known(e.to) || !Number.isInteger(e.amount) || e.amount <= 0 || typeof e.day !== 'number' || !Number.isFinite(e.day)) continue;
      s.ledger.push({ day: e.day, from: e.from, to: e.to, amount: e.amount, why: typeof e.why === 'string' ? e.why.slice(0, 60) : '' });
    }
  }

  CL.accounts = { LEDGER_MAX, WORLD, known, blank, balance, transfer, earn, spend, pay, seize, total, recent, label, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
