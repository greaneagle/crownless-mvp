/* Crownless party upkeep (GDD §9 "Food and wages"): rations eaten as time passes, wages every
 * 7 days, morale, and desertion when morale collapses. Driven by CL.party.advanceDays, so travel,
 * resting, battles and captivity all cost food. Pure logic — messages go through CL.ui hooks. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PEOPLE_PER_RATION = 5; // GDD: one ration feeds 5 people for one day
  const RATION_ITEM = 'food_ration'; // market good holding the base price (8 crowns)
  const WAGE_INTERVAL = 7; // days
  const MORALE = {
    start: 70,
    baseline: 70, // fed troops recover toward this
    max: 100,
    recoverPerDay: 5,
    starvingPerDay: 15,
    unpaid: 20,
    victory: 5,
    defeat: 10,
    desertBelow: 25,
    maxDesertChance: 0.6, // per day, at 0 morale
  };
  const LOW_FOOD_DAYS = 1;

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /** Hero + every soldier, wounded included (they still eat). */
  const partySize = (c) => 1 + c.roster.length + CL.companion.slots(c) - (c.companion?.detached ? 1 : 0) + (CL.retinue?.present(c).length || 0); // hero, soldiers and companions all eat (a detachment eats its own, P7-05)
  const dailyRations = (c) => Math.ceil(partySize(c) / PEOPLE_PER_RATION);
  const foodDays = (c) => c.food / dailyRations(c);
  /** GDD §7: wounded troops still count toward wages. */
  const weeklyWages = (c) => c.roster.reduce((sum, s) => sum + CL.content.troop(s.troop).wage, 0);

  /**
   * GDD §9: LocalBuyPrice = round(BasePrice × Scarcity × (1 − 0.01 × Trade)). W-08: a ration's scarcity
   * follows the local grain, half as strongly (so food is a little cheaper among the farms and dearer
   * in the highlands: 0.9–1.2 of the base); 1 where there is no market.
   */
  function rationPrice(c) {
    const base = CL.content.get('markets', RATION_ITEM).basePrice;
    const grain = c.markets?.[c.world?.location]?.grain;
    const scarcity = typeof grain === 'number' ? 0.5 + 0.5 * grain : 1;
    return Math.max(1, Math.round(base * scarcity * (1 - 0.01 * CL.character.skill('trade', c))));
  }

  /** Move food items (e.g. "Three Days of Food") from the pack into the ration stock. */
  function stowFood(c) {
    for (const [id, n] of Object.entries(c.inventory)) {
      const per = CL.content.table('items')[id]?.stats?.food;
      if (!per) continue;
      c.food += per * n;
      delete c.inventory[id];
    }
  }

  /** Buy rations from an account (your purse; the quartermaster uses the company chest, V2-11). */
  function buyFood(c, rations, from = 'purse') {
    const cost = rations * rationPrice(c);
    if (rations <= 0 || CL.accounts.balance(c, from) < cost) return false;
    if (!CL.accounts.spend(c, cost, `${rations} rations`, from)) return false;
    c.food += rations;
    CL.diag.log('info', 'Food bought', { rations, cost, from });
    return true;
  }

  function changeMorale(c, delta) {
    c.morale = clamp(c.morale + delta, 0, MORALE.max);
  }

  function payWages(c) {
    const owed = weeklyWages(c);
    if (!owed) return { owed: 0, paid: 0 };
    const paid = CL.accounts.pay(c, owed, 'weekly wages'); // the company chest first, then your purse (V2-11)
    CL.events.emit(c, 'WagesPaid', { owed, paid, shares: CL.soldiers.wageShares(c, paid) });
    if (paid < owed) {
      changeMorale(c, -MORALE.unpaid);
      CL.ui.message(`Wages short: paid ${paid} of ${owed} crowns. Your soldiers grumble.`);
    } else {
      CL.ui.message(`Paid ${paid} crowns in weekly wages.`);
    }
    CL.diag.log(paid < owed ? 'warn' : 'info', 'Wages', { owed, paid, morale: c.morale });
    return { owed, paid };
  }

  /** Once a day: below the desertion threshold a soldier may slip away in the night. */
  function desertionCheck(c) {
    if (c.morale >= MORALE.desertBelow || !c.roster.length) return null;
    const chance = ((MORALE.desertBelow - c.morale) / MORALE.desertBelow) * MORALE.maxDesertChance;
    if (CL.autoresolve.roll(c, 'upkeep') >= chance) return null;
    const i = Math.floor(CL.autoresolve.roll(c, 'upkeep') * c.roster.length);
    const [s] = c.roster.splice(i, 1);
    CL.events.emit(c, 'SoldierDeserted', { soldierId: s.id, troop: s.troop, morale: c.morale, soldier: s });
    const name = CL.content.troop(s.troop).name;
    CL.ui.message(`A ${name} deserted in the night. Morale is dangerously low.`);
    CL.diag.log('warn', 'Desertion', { troop: s.troop, morale: c.morale });
    return s;
  }

  /**
   * Advance upkeep from day `from` to day `to`: eat, adjust morale, and run the daily
   * desertion check and the weekly payday at each midnight crossed.
   */
  function tick(c, from, to) {
    const days = to - from;
    if (days <= 0) return;
    const daysBefore = foodDays(c);
    const need = dailyRations(c) * days;
    let fedDays = days;
    if (c.food >= need) {
      c.food -= need;
    } else {
      fedDays = c.food / dailyRations(c);
      c.food = 0;
    }
    const starvedDays = days - fedDays;
    if (fedDays > 0 && c.morale < MORALE.baseline) {
      c.morale = Math.min(MORALE.baseline, c.morale + MORALE.recoverPerDay * fedDays);
    }
    if (starvedDays > 0) {
      changeMorale(c, -MORALE.starvingPerDay * starvedDays);
      if (!c.starving) CL.ui.message('Your party has run out of food! Morale is falling.');
      c.starving = true;
    } else {
      c.starving = false;
      if (daysBefore >= LOW_FOOD_DAYS && foodDays(c) < LOW_FOOD_DAYS) {
        CL.ui.message('Food is running low — buy rations in a town or village.');
      }
    }
    for (let d = Math.floor(from) + 1; d <= Math.floor(to + 1e-9); d++) {
      if (d >= c.nextWagesDay) {
        payWages(c);
        CL.quartermaster?.payday(c);
        CL.merchant?.payday(c);
        CL.surgeon?.payday(c);
        CL.blacksmith?.payday(c);
        CL.scout?.payday(c);
        CL.detachments?.payday(c);
        CL.retinue?.payday(c); // companions' wages, and how they feel about them (P7-06)
        CL.business?.payday(c, d); // your mill runs a week: the law first, then wage, grinding, due (P7-10)
        c.nextWagesDay += WAGE_INTERVAL;
      }
      desertionCheck(c);
      CL.quartermaster?.daily(c); // buys in a market town, otherwise warns before shortages
      CL.detachments?.daily(c); // detachments eat their own food (P7-05)
    }
  }

  function onBattle(c, win) {
    changeMorale(c, win ? MORALE.victory : -MORALE.defeat);
  }

  /** Fill upkeep fields on a saved campaign (older saves have none). */
  function sanitize(s, d) {
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    s.food = num(d?.food) && d.food >= 0 ? Math.min(d.food, 9999) : s.food;
    s.morale = num(d?.morale) ? clamp(d.morale, 0, MORALE.max) : MORALE.start;
    s.nextWagesDay = num(d?.nextWagesDay) && d.nextWagesDay > s.day ? d.nextWagesDay : Math.floor(s.day) + WAGE_INTERVAL;
    s.starving = Boolean(d?.starving) && s.food === 0;
    stowFood(s);
  }

  CL.upkeep = {
    MORALE,
    WAGE_INTERVAL,
    partySize,
    dailyRations,
    foodDays,
    weeklyWages,
    rationPrice,
    stowFood,
    buyFood,
    changeMorale,
    payWages,
    desertionCheck,
    tick,
    onBattle,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
