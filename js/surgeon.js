// @ts-check
/* Crownless surgeon (P7-01; design §12): a camp follower who saves lives after battle.
 *
 * Hired in a town (Accounts): HIRE crowns once and WAGE a week, paid with the wages; unpaid two
 * paydays running, they leave (warned after the first).
 *
 * Triage, after every battle, fought or auto-resolved. Each fallen soldier still gets exactly one roll
 * (from the same stream as before), so the surgeon changes where the line falls, not how many rolls
 * are made, and seeded results stay comparable:
 *   roll < DEATH.base (0.35)      without a surgeon: killed
 *   with a surgeon:
 *     roll < DEATH.medicine (0.22)            killed
 *     DEATH.medicine ≤ roll < DEATH.base      saved with one medicine, while there is any;
 *                                             without medicine only above DEATH.bare (0.30)
 *   everyone else fallen                      wounded
 * The saved are wounded instead; the result screen names them. Medicine is spent when the result is
 * committed (once). With a surgeon wounds heal in WOUND_DAYS (1.5 days, not 2).
 *
 * Medicine is a supply like food: bought at any market (Accounts), and by the quartermaster to a
 * reserve while a surgeon rides with the company (js/quartermaster.js). Captors take half of it.
 * State: c.followers.surgeon (saved) or null; c.medicine (saved, schema v11). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const HIRE = 60;
  const WAGE = 10;
  const DEATH = { base: 0.35, bare: 0.3, medicine: 0.22 };
  const WOUND_DAYS = 1.5;
  const MEDICINE = 'medicine'; // its price lives in data/markets.js
  const MEDICINE_MAX = 99;
  const LOG_MAX = 20;

  const get = (c) => c.followers?.surgeon || null;
  const isTown = (id) => CL.content.table('settlements')[id]?.type === 'town';
  const hasMarket = (id) => Boolean(id && CL.content.table('settlements')[id]?.services?.includes('trade'));

  function log(c, text) {
    const s = get(c);
    if (!s) return;
    s.log.push({ day: c.day, text: text.slice(0, 120) });
    if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
  }

  /** Can one be hired here (a town)? @param {Campaign} c */
  const canHire = (c) => !get(c) && isTown(c.world?.location) && c.gold >= HIRE;

  /** Hire a surgeon from your purse. Returns them, or null. @param {Campaign} c */
  function hire(c) {
    if (!canHire(c)) return null;
    if (!CL.accounts.spend(c, HIRE, 'hiring a surgeon')) return null;
    const place = c.world.location;
    const culture = CL.soldiers.cultureFor('levy', place, c);
    const taken = new Set([...c.roster.map((s) => s.name), c.followers?.quartermaster?.name, c.followers?.merchant?.name].filter(Boolean));
    const name = CL.soldiers.makeName(culture, place, () => CL.autoresolve.roll(c, 'names'), taken, 'any');
    c.followers ??= { quartermaster: null, merchant: null, surgeon: null };
    /** @type {any} */
    const s = { name, culture, origin: place, hired: c.day, unpaid: 0, saved: 0, log: [] };
    c.followers.surgeon = s;
    log(c, `Hired at ${CL.soldiers.placeName(place)}.`);
    CL.diag.log('info', 'Surgeon hired', { name, place });
    CL.story?.emit('hire', { follower: 'surgeon' }, c);
    return s;
  }

  /** Let them go (no refund). @param {Campaign} c */
  function dismiss(c, why = 'dismissed') {
    const s = get(c);
    if (!s) return false;
    c.followers.surgeon = null;
    CL.diag.log('info', 'Surgeon left', { name: s.name, why });
    return true;
  }

  /** Payday: their wage, from the chest then your purse. Two unpaid weeks and they leave. @param {Campaign} c */
  function payday(c) {
    const s = get(c);
    if (!s) return;
    if (CL.accounts.pay(c, WAGE, 'surgeon’s wage') >= WAGE) {
      s.unpaid = 0;
      return;
    }
    s.unpaid++;
    if (s.unpaid >= 2) {
      CL.ui.message(`Surgeon ${s.name} has gone unpaid twice and leaves the company.`);
      dismiss(c, 'unpaid');
    } else {
      log(c, 'Went unpaid this week.');
      CL.ui.message(`Surgeon ${s.name} went unpaid. Unpaid again next week, they will leave.`);
    }
  }

  // ---- Medicine ----

  /** A unit of medicine here (base price, less 1% per Trade point, like rations). @param {Campaign} c */
  function medicinePrice(c) {
    const base = CL.content.get('markets', MEDICINE).basePrice;
    return Math.max(1, Math.round(base * (1 - 0.01 * CL.character.skill('trade', c))));
  }

  /** Can medicine be bought where the company stands? @param {Campaign} c */
  const sellsMedicine = (c) => hasMarket(c.world?.location);

  /** Buy `n` medicine from an account (your purse, or the chest for the quartermaster). @param {Campaign} c */
  function buyMedicine(c, n, account = 'purse') {
    n = Math.min(Math.floor(n), MEDICINE_MAX - (c.medicine || 0));
    if (!(n > 0) || !sellsMedicine(c)) return false;
    const cost = n * medicinePrice(c);
    if (CL.accounts.balance(c, account) < cost) return false;
    if (!CL.accounts.spend(c, cost, `${n} medicine`, account)) return false;
    c.medicine = (c.medicine || 0) + n;
    CL.diag.log('info', 'Medicine bought', { n, cost, account });
    return true;
  }

  // ---- Triage ----

  /**
   * Sort the fallen: each `{ id, roll }` (one roll each, in [0, 1)) becomes killed, saved or wounded,
   * by whether a surgeon rides with the company and how much medicine there is. Pure: medicine is only
   * counted here, and spent when the result commits.
   * @param {Campaign} c @param {Array<{ id: number, roll: number }>} fallen
   * @returns {{ killed: number[], wounded: number[], saved: number[], medicineUsed: number }}
   */
  function triage(c, fallen) {
    const out = { killed: [], wounded: [], saved: [], medicineUsed: 0 };
    const s = get(c);
    let medicine = Math.max(0, Math.floor(c.medicine || 0));
    for (const { id, roll } of fallen) {
      if (roll >= DEATH.base) out.wounded.push(id);
      else if (!s || roll < DEATH.medicine) out.killed.push(id);
      else if (medicine > 0) {
        medicine--;
        out.medicineUsed++;
        out.saved.push(id);
        out.wounded.push(id);
      } else if (roll >= DEATH.bare) {
        out.saved.push(id);
        out.wounded.push(id);
      } else out.killed.push(id);
    }
    return out;
  }

  /**
   * The result committed (once, from CL.party.applyBattleResult): medicine spent, lives counted, the
   * surgeon's log. @param {Campaign} c @param {{ saved?: number[], medicineUsed?: number }} outcome
   */
  function onResult(c, outcome) {
    const used = Math.max(0, Math.floor(outcome.medicineUsed || 0));
    if (used) c.medicine = Math.max(0, (c.medicine || 0) - used);
    const s = get(c);
    const saved = outcome.saved?.length || 0;
    if (s && saved) {
      s.saved += saved;
      log(c, `Saved ${saved} after a battle${used ? `, using ${used} medicine` : ' (no medicine left)'}.`);
    }
  }

  /** Days a wound takes to heal. @param {Campaign} c */
  const woundDays = (c) => (get(c) ? WOUND_DAYS : CL.save.WOUND_DAYS);

  /** Captured: the captors take half the medicine (rounded up). Returns how much. @param {Campaign} c */
  function onCapture(c) {
    const n = Math.ceil((c.medicine || 0) / 2);
    if (n) c.medicine -= n;
    return n;
  }

  // ---- Saves ----

  /** Repair the surgeon and the medicine onto `s` (after the quartermaster). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const n = d?.medicine;
    s.medicine = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(MEDICINE_MAX, Math.floor(n))) : 0;
    s.followers.surgeon = null;
    const x = d?.followers?.surgeon;
    if (!x || typeof x !== 'object') return;
    const name = CL.soldiers.cleanName(x.name);
    if (!name) return;
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    s.followers.surgeon = {
      name,
      culture: CL.content.table('cultures')[x.culture] ? x.culture : null,
      origin: CL.content.table('settlements')[x.origin] ? x.origin : null,
      hired: Math.max(0, num(x.hired, 0)),
      unpaid: Math.max(0, Math.min(1, Math.floor(num(x.unpaid, 0)))),
      saved: Math.max(0, Math.floor(num(x.saved, 0))),
      log: (Array.isArray(x.log) ? x.log : [])
        .filter((e) => e && typeof e.text === 'string' && typeof e.day === 'number' && Number.isFinite(e.day))
        .slice(-LOG_MAX)
        .map((e) => ({ day: e.day, text: e.text.slice(0, 120) })),
    };
  }

  CL.surgeon = { HIRE, WAGE, DEATH, WOUND_DAYS, MEDICINE, MEDICINE_MAX, get, canHire, hire, dismiss, payday, medicinePrice, sellsMedicine, buyMedicine, triage, onResult, woundDays, onCapture, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
