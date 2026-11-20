/* Crownless trading (GDD §9): six goods, local scarcity, cargo weight, selling gear.
 *
 *   LocalBuyPrice  = round(BasePrice × Scarcity × (1 − 0.01 × Trade))
 *   LocalSellPrice = round(BasePrice × Scarcity × 0.75 × (1 + 0.01 × Trade))
 *   Scarcity ∈ [0.8, 1.4]
 *
 * (The GDD derives the sell price from the discounted buy price, which would make Trade lower
 * your sale prices; here Trade helps both ways.) Each unit bought nudges that town's scarcity up
 * and each unit sold nudges it down, so buying and re-selling in one town always loses money;
 * scarcity drifts back to the town's baseline day by day. Every transaction is all-or-nothing.
 * State: CL.campaign.markets[settlementId][good] and CL.campaign.cargo[good]. Pure logic. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SCARCITY = { min: 0.8, max: 1.4 };
  const SELL_FACTOR = 0.75;
  const UNIT_IMPACT = 0.003; // scarcity change per unit traded (30 units ≈ 0.09)
  const DRIFT_PER_DAY = 0.1; // share of the gap to baseline closed each day
  const GEAR_SELL_FACTOR = 0.5; // gear sells for half its listed value (before Trade)
  const GEAR_BUY_FACTOR = 1.3; // the armoury's markup; always above the sell price, so no flipping
  const CARRY = { base: 20, perSoldier: 10, horse: 30 };
  const HEAVY_SPEED = 0.7; // GDD §3: heavy party modifier between 0.7 and 1.0

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round2 = (n) => Math.round(n * 1000) / 1000;
  const goods = () => Object.values(CL.content.table('markets')).filter((g) => g.tradeGood);
  const settlement = (id) => CL.content.get('settlements', id);
  const tradeSkill = (c) => CL.character.skill('trade', c);

  /** Settlements with a market, and their baseline scarcity table. */
  const baseline = (id) => settlement(id).market || null;
  const hasMarket = (id) => Boolean(id && settlement(id).services.includes('trade') && baseline(id));

  function defaultMarkets() {
    const out = {};
    for (const s of Object.values(CL.content.table('settlements'))) if (s.market) out[s.id] = { ...s.market };
    return out;
  }

  const scarcity = (c, sid, good) => c.markets[sid]?.[good] ?? baseline(sid)?.[good] ?? 1;

  function unitBuyPrice(c, sid, good, s = scarcity(c, sid, good)) {
    const base = CL.content.get('markets', good).basePrice;
    return Math.max(1, Math.round(base * s * (1 - 0.01 * tradeSkill(c))));
  }

  function unitSellPrice(c, sid, good, s = scarcity(c, sid, good)) {
    const base = CL.content.get('markets', good).basePrice;
    const raw = Math.round(base * s * SELL_FACTOR * (1 + 0.01 * tradeSkill(c)));
    // Rounding guard: selling a unit never returns what buying it one step earlier cost, so
    // every buy-then-sell round trip in one town loses at least a crown per unit.
    const boughtFor = unitBuyPrice(c, sid, good, s - UNIT_IMPACT);
    return Math.max(1, Math.min(raw, boughtFor - 1));
  }

  /** Price `qty` units one at a time as the town's scarcity moves. Returns {total, scarcity}. */
  function quote(c, sid, good, qty, side) {
    let s = scarcity(c, sid, good);
    let total = 0;
    for (let i = 0; i < qty; i++) {
      total += side === 'buy' ? unitBuyPrice(c, sid, good, s) : unitSellPrice(c, sid, good, s);
      s = clamp(round2(s + (side === 'buy' ? UNIT_IMPACT : -UNIT_IMPACT)), SCARCITY.min, SCARCITY.max);
    }
    return { total, scarcity: s };
  }

  // ---- Cargo ----

  /** Weight of a hold of goods. @param {Record<string, number>} hold */
  const holdWeight = (hold) => Object.entries(hold || {}).reduce((w, [id, n]) => w + n * CL.content.get('markets', id).weight, 0);
  /** Everything the company carries: your cargo and the merchant's stock (V2-12) share the wagons. */
  const cargoWeight = (c) => holdWeight(c.cargo) + holdWeight(c.followers?.merchant?.stock);

  function capacity(c) {
    return CARRY.base + CARRY.perSoldier * c.roster.length + (c.equipment?.horse ? CARRY.horse : 0);
  }

  /** GDD §3 PartyLoadFactor: 1.0 empty, down to 0.7 at full capacity. */
  function loadFactor(c) {
    const cap = capacity(c);
    return 1 - (1 - HEAVY_SPEED) * clamp(cargoWeight(c) / cap, 0, 1);
  }

  // ---- Transactions (atomic: validate everything, then apply everything) ----

  /**
   * Buy goods at a market: the same prices and scarcity for everyone. By default with your purse into
   * your cargo; the merchant (V2-12) passes its own budget account and stock. A mill (P7-10) passes
   * `carry: false`: what it buys stays at the mill, never in the company's wagons.
   * @param {{ account?: string, hold?: Record<string, number>, by?: string, carry?: boolean }} [opts]
   */
  function buy(c, sid, good, qty = 1, { account = 'purse', hold = c.cargo, by = null, carry = true } = {}) {
    if (!hasMarket(sid) || !(qty > 0)) return { ok: false, reason: 'No market here' };
    const q = quote(c, sid, good, qty, 'buy');
    if (CL.accounts.balance(c, account) < q.total) return { ok: false, reason: 'Not enough crowns' };
    if (carry && cargoWeight(c) + qty * CL.content.get('markets', good).weight > capacity(c)) {
      return { ok: false, reason: 'Your party cannot carry that much' };
    }
    if (!CL.accounts.spend(c, q.total, `${by ? `${by}: ` : 'market: '}bought ${qty} ${good}`, account)) return { ok: false, reason: 'Not enough crowns' };
    hold[good] = (hold[good] || 0) + qty;
    c.markets[sid][good] = q.scarcity;
    CL.diag.log('info', 'Bought goods', { at: sid, good, qty, cost: q.total, by });
    if (!by) {
      CL.audio?.play('coin');
      CL.story.emit('trade', { settlement: sid, good, side: 'buy', qty }, c);
    }
    return { ok: true, total: q.total };
  }

  /** Sell goods at a market (see `buy`). @param {{ account?: string, hold?: Record<string, number>, by?: string }} [opts] */
  function sell(c, sid, good, qty = 1, { account = 'purse', hold = c.cargo, by = null } = {}) {
    if (!hasMarket(sid) || !(qty > 0)) return { ok: false, reason: 'No market here' };
    if ((hold[good] || 0) < qty) return { ok: false, reason: 'You have none to sell' };
    const q = quote(c, sid, good, qty, 'sell');
    CL.accounts.earn(c, q.total, `${by ? `${by}: ` : 'market: '}sold ${qty} ${good}`, account);
    hold[good] -= qty;
    if (!hold[good]) delete hold[good];
    c.markets[sid][good] = q.scarcity;
    CL.diag.log('info', 'Sold goods', { at: sid, good, qty, earned: q.total, by });
    if (!by) {
      CL.audio?.play('coin');
      CL.story.emit('trade', { settlement: sid, good, side: 'sell', qty }, c);
    }
    return { ok: true, total: q.total };
  }

  /** Gear and loot from the pack. Quest items are protected (GDD §9); equipped gear is not in the pack. */
  function gearPrice(c, itemId) {
    const it = CL.content.item(itemId);
    if (it.questItem || !it.value) return 0;
    return Math.max(1, Math.round(it.value * GEAR_SELL_FACTOR * (1 + 0.01 * tradeSkill(c))));
  }

  /** What a settlement's armoury stocks (only where there is a market). */
  const gearStock = (sid) => (hasMarket(sid) ? settlement(sid).gear || [] : []);

  function gearBuyPrice(c, itemId) {
    const it = CL.content.item(itemId);
    return Math.max(1, Math.round(it.value * GEAR_BUY_FACTOR * (1 - 0.01 * tradeSkill(c))));
  }

  /** Buy one item from the local armoury into the pack (food goes to the ration stock). */
  function buyGear(c, sid, itemId) {
    if (!gearStock(sid).includes(itemId)) return { ok: false, reason: 'Not sold here' };
    const price = gearBuyPrice(c, itemId);
    if (c.gold < price) return { ok: false, reason: 'Not enough crowns' };
    CL.accounts.spend(c, price, `armoury: ${CL.content.item(itemId).name}`);
    c.inventory[itemId] = (c.inventory[itemId] || 0) + 1;
    CL.upkeep.stowFood(c);
    CL.diag.log('info', 'Bought gear', { at: sid, item: itemId, cost: price });
    CL.audio?.play('coin');
    return { ok: true, total: price };
  }

  function sellGear(c, sid, itemId) {
    if (!hasMarket(sid)) return { ok: false, reason: 'No market here' };
    const price = gearPrice(c, itemId);
    if (!price || !(c.inventory[itemId] > 0)) return { ok: false, reason: 'Cannot sell that' };
    c.inventory[itemId] -= 1;
    if (!c.inventory[itemId]) delete c.inventory[itemId];
    CL.accounts.earn(c, price, `sold ${CL.content.item(itemId).name}`);
    CL.diag.log('info', 'Sold gear', { at: sid, item: itemId, earned: price });
    CL.audio?.play('coin');
    return { ok: true, total: price };
  }

  // ---- Time ----

  /**
   * Restock: every market drifts back toward its baseline as days pass. Kept to a millionth, not the
   * thousandth a trade rounds to (P7-10): on the map time passes a few minutes a frame, and rounding
   * each tiny step to a thousandth threw the restocking away, so markets hardly recovered on the road.
   */
  function drift(c, days) {
    if (days <= 0) return;
    const k = 1 - (1 - DRIFT_PER_DAY) ** days;
    for (const [sid, table] of Object.entries(c.markets)) {
      const base = baseline(sid);
      if (!base) continue;
      for (const g of Object.keys(table)) if (g in base) table[g] = Math.round((table[g] + (base[g] - table[g]) * k) * 1e6) / 1e6;
    }
  }

  /** Cheap / fair / dear compared with the good's base price. */
  function priceWord(s) {
    if (s <= 0.9) return 'cheap';
    if (s >= 1.2) return 'dear';
    return 'fair';
  }

  function sanitize(s, d) {
    const markets = defaultMarkets();
    for (const [sid, table] of Object.entries(markets)) {
      for (const g of Object.keys(table)) {
        const v = d?.markets?.[sid]?.[g];
        if (typeof v === 'number' && Number.isFinite(v)) table[g] = clamp(v, SCARCITY.min, SCARCITY.max);
      }
    }
    s.markets = markets;
    s.cargo = {};
    const known = new Set(goods().map((g) => g.id));
    for (const [g, n] of Object.entries(d?.cargo || {})) {
      if (known.has(g) && Number.isInteger(n) && n > 0) s.cargo[g] = Math.min(n, 9999);
    }
  }

  CL.trade = {
    SCARCITY,
    CARRY,
    goods,
    hasMarket,
    defaultMarkets,
    scarcity,
    unitBuyPrice,
    unitSellPrice,
    quote,
    holdWeight,
    cargoWeight,
    capacity,
    loadFactor,
    buy,
    sell,
    gearPrice,
    sellGear,
    gearStock,
    gearBuyPrice,
    buyGear,
    drift,
    priceWord,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
