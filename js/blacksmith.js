// @ts-check
/* Crownless blacksmith (P7-03; design §12.4: targeted, capped upgrades; no durability).
 *
 * A camp follower hired in a town (Accounts): HIRE crowns once and WAGE a week, paid with the wages;
 * unpaid two paydays running, they leave (warned after the first). Wherever the company is, they can:
 *   forge   improve a piece the hero has equipped, at most twice (data/items.js `forge`): a better
 *           weapon hits harder, better armour stops more. The piece becomes its forged item
 *           ("Arming Sword +1"). Costs crowns from your purse and iron from your cargo.
 *   kit     fit one named soldier with fine kit (up to five at once): more armour and hit points in
 *           battle, a little more strength in auto-resolve. Crowns and iron again. The kit stays with
 *           the soldier through promotions and is lost with them.
 * Forged pieces sell for half their value like any gear, which never reaches what the plain piece
 * costs at an armoury, so there is no buying, forging and selling for profit.
 * State: c.followers.blacksmith (saved, schema v12) or null; a soldier's `kit: true`. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const HIRE = 50;
  const WAGE = 8;
  const LOG_MAX = 20;
  const IRON = 'iron';

  /** The forging rules (data/items.js `forge`). @returns {any} */
  const rules = () => root.CROWNLESS_CONTENT?.forge || {};
  const get = (c) => c.followers?.blacksmith || null;
  const isTown = (id) => CL.content.table('settlements')[id]?.type === 'town';
  const ironHeld = (c) => c.cargo?.[IRON] || 0;

  function log(c, text) {
    const b = get(c);
    if (!b) return;
    b.log.push({ day: c.day, text: text.slice(0, 120) });
    if (b.log.length > LOG_MAX) b.log.splice(0, b.log.length - LOG_MAX);
  }

  /** Can one be hired here (a town)? @param {Campaign} c */
  const canHire = (c) => !get(c) && isTown(c.world?.location) && c.gold >= HIRE;

  /** Hire a blacksmith from your purse. Returns them, or null. @param {Campaign} c */
  function hire(c) {
    if (!canHire(c)) return null;
    if (!CL.accounts.spend(c, HIRE, 'hiring a blacksmith')) return null;
    const place = c.world.location;
    const culture = CL.soldiers.cultureFor('levy', place, c);
    const f = /** @type {any} */ (c.followers || {});
    const taken = new Set([...c.roster.map((s) => s.name), f.quartermaster?.name, f.merchant?.name, f.surgeon?.name].filter(Boolean));
    const name = CL.soldiers.makeName(culture, place, () => CL.autoresolve.roll(c, 'names'), taken);
    c.followers ??= { quartermaster: null, merchant: null };
    /** @type {any} */
    const b = { name, culture, origin: place, hired: c.day, unpaid: 0, log: [] };
    c.followers.blacksmith = b;
    log(c, `Hired at ${CL.soldiers.placeName(place)}.`);
    CL.diag.log('info', 'Blacksmith hired', { name, place });
    CL.story?.emit('hire', { follower: 'blacksmith' }, c);
    return b;
  }

  /** Let them go (no refund). @param {Campaign} c */
  function dismiss(c, why = 'dismissed') {
    const b = get(c);
    if (!b) return false;
    c.followers.blacksmith = null;
    CL.diag.log('info', 'Blacksmith left', { name: b.name, why });
    return true;
  }

  /** Payday: their wage, from the chest then your purse. Two unpaid weeks and they leave. @param {Campaign} c */
  function payday(c) {
    const b = get(c);
    if (!b) return;
    if (CL.accounts.pay(c, WAGE, 'blacksmith’s wage') >= WAGE) {
      b.unpaid = 0;
      return;
    }
    b.unpaid++;
    if (b.unpaid >= 2) {
      CL.ui.message(`Blacksmith ${b.name} has gone unpaid twice and leaves the company.`);
      dismiss(c, 'unpaid');
    } else {
      log(c, 'Went unpaid this week.');
      CL.ui.message(`Blacksmith ${b.name} went unpaid. Unpaid again next week, they will leave.`);
    }
  }

  // ---- Forging the hero's gear ----

  /**
   * What forging the piece in `slot` once more would make and cost, or why it can't:
   * { slot, from, to, level, crowns, iron } or { slot, from, reason }. @param {Campaign} c @param {string} slot
   */
  function forgeOffer(c, slot) {
    const F = rules();
    const from = c.equipment?.[slot];
    if (!from) return { slot, from: null, reason: 'nothing equipped' };
    const it = CL.content.item(from);
    const base = it.forgedFrom ? CL.content.item(it.forgedFrom) : it;
    if (!F.slots?.[base.slot]) return { slot, from, reason: 'not something a smith improves' };
    const level = (it.forgeLevel || 0) + 1;
    if (level > F.maxLevel) return { slot, from, reason: `already improved ${F.maxLevel} times` };
    const crowns = Math.max(F.minCost || 0, Math.round(base.value * F.costPerLevel * level));
    const iron = (F.iron?.[base.slot] || 1) * level;
    return { slot, from, to: `${base.id}+${level}`, level, crowns, iron };
  }

  /** Forge the hero's piece in `slot`. Returns { ok, reason?, offer }. @param {Campaign} c @param {string} slot */
  function forge(c, slot) {
    const o = forgeOffer(c, slot);
    if (!get(c)) return { ok: false, reason: 'no blacksmith', offer: o };
    if (o.reason) return { ok: false, reason: o.reason, offer: o };
    if (c.gold < o.crowns) return { ok: false, reason: 'not enough crowns', offer: o };
    if (ironHeld(c) < o.iron) return { ok: false, reason: 'not enough iron', offer: o };
    if (!CL.accounts.spend(c, o.crowns, `forging ${CL.content.item(o.from).name}`)) return { ok: false, reason: 'not enough crowns', offer: o };
    takeIron(c, o.iron);
    c.equipment[slot] = o.to;
    const name = CL.content.item(o.to).name;
    log(c, `Forged ${name} for ${o.crowns} crowns and ${o.iron} iron.`);
    CL.diag.log('info', 'Forged', { slot, to: o.to, crowns: o.crowns, iron: o.iron });
    return { ok: true, offer: o };
  }

  function takeIron(c, n) {
    c.cargo[IRON] -= n;
    if (c.cargo[IRON] <= 0) delete c.cargo[IRON];
  }

  // ---- Fine kit for soldiers ----

  const kitted = (c) => c.roster.filter((s) => s.kit).length;

  /** Can this soldier be fitted now? Returns null or the reason not. @param {Campaign} c */
  function kitBlocked(c, soldierId) {
    const K = rules().kit;
    const s = c.roster.find((x) => x.id === soldierId);
    if (!get(c)) return 'no blacksmith';
    if (!s) return 'no such soldier';
    if (s.kit) return 'already fitted';
    if (kitted(c) >= K.max) return `${K.max} soldiers already have fine kit`;
    if (c.gold < K.cost) return 'not enough crowns';
    if (ironHeld(c) < K.iron) return 'not enough iron';
    return null;
  }

  /** Fit a soldier with fine kit. Returns { ok, reason? }. @param {Campaign} c @param {number} soldierId */
  function giveKit(c, soldierId) {
    const K = rules().kit;
    const why = kitBlocked(c, soldierId);
    if (why) return { ok: false, reason: why };
    const s = c.roster.find((x) => x.id === soldierId);
    if (!CL.accounts.spend(c, K.cost, `fine kit for ${s.name}`)) return { ok: false, reason: 'not enough crowns' };
    takeIron(c, K.iron);
    s.kit = true;
    log(c, `Fitted ${s.name} with fine kit.`);
    CL.diag.log('info', 'Fine kit', { soldier: s.id });
    return { ok: true };
  }

  /** A soldier's unit in battle, with fine kit if they have it. @param {Unit} u @param {Soldier | undefined} s */
  function applyKit(u, s) {
    if (!s?.kit) return u;
    const K = rules().kit;
    u.armor += K.armor;
    u.hp += K.hp;
    u.maxhp += K.hp;
    return u;
  }

  /** Auto-resolve strength factor for a soldier. @param {Soldier} s */
  const powerFactor = (s) => (s?.kit ? rules().kit?.power || 1 : 1);

  // ---- Saves ----

  /** Repair the blacksmith onto `s` (after the other followers). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.followers.blacksmith = null;
    const x = d?.followers?.blacksmith;
    if (!x || typeof x !== 'object') return;
    const name = CL.soldiers.cleanName(x.name);
    if (!name) return;
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    s.followers.blacksmith = {
      name,
      culture: CL.content.table('cultures')[x.culture] ? x.culture : null,
      origin: CL.content.table('settlements')[x.origin] ? x.origin : null,
      hired: Math.max(0, num(x.hired, 0)),
      unpaid: Math.max(0, Math.min(1, Math.floor(num(x.unpaid, 0)))),
      log: (Array.isArray(x.log) ? x.log : [])
        .filter((e) => e && typeof e.text === 'string' && typeof e.day === 'number' && Number.isFinite(e.day))
        .slice(-LOG_MAX)
        .map((e) => ({ day: e.day, text: e.text.slice(0, 120) })),
    };
    // Fine kit beyond the cap (a hand-edited save) is taken back, newest soldiers first.
    const max = rules().kit?.max ?? 0;
    for (const sol of s.roster.filter((x) => x.kit).slice(max)) delete sol.kit;
  }

  CL.blacksmith = { HIRE, WAGE, IRON, rules, get, canHire, hire, dismiss, payday, forgeOffer, forge, kitted, kitBlocked, giveKit, applyKit, powerFactor, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
