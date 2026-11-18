// A headless player for acceptance runs: plays the real campaign logic (no DOM) with simple,
// sensible choices, and records what happened. Used by tests/acceptance.test.js and by
// scripts/simulate-campaign.js for multi-seed balance checks.
//
// style (V2-13, Prototype G: the same campaign played three ways):
//   'hands-off'  auto-resolves every fight and never changes a setting (the default)
//   'presets'    fights in person, choosing only a preset: Defensive when the odds are close, else Balanced
//   'expert'     fights in person with Aggressive, Defensive or Balanced as the odds suggest, rallies its
//                soldiers, and keeps a quartermaster and a merchant
// The in-person fights use a simple hero (walk at the nearest enemy, swing); a real player does better.

function makeBot(CL, { log = () => {}, style = 'hands-off' } = {}) {
  const c = () => CL.campaign;
  const g = CL.game;
  const stats = {
    battles: 0,
    wins: 0,
    losses: 0,
    autoResolves: 0,
    retreats: 0,
    tolls: 0,
    contractsTaken: 0,
    contractsDone: 0,
    hired: 0,
    upgraded: 0,
    gearBought: 0,
    foodBought: 0,
    minGold: Infinity,
    stuck: 0,
    fought: 0,
    heroDown: 0,
    rallies: 0,
    presets: {},
    screens: 0, // non-default screens visited (the Prepare screen's choice, Accounts)
  };
  const U = () => CL.upkeep;
  const odds = (e) => CL.autoresolve.winChance(CL.autoresolve.playerPower(c()), CL.autoresolve.troopsPower(e.troops));

  function spendPoints() {
    const ch = c().character;
    const order = ['leadership', 'tactics', 'one_handed', 'pathfinding', 'trade', 'shield'];
    while (ch.skillPoints > 0) {
      const id = order.find((s) => ch.skills[s] < 10);
      if (!id || !CL.character.spendSkill(id)) break;
    }
    while (ch.attributePoints > 0) if (!CL.character.spendAttribute(ch.attributes.str < 12 ? 'str' : 'int')) break;
  }

  function settlementTurn() {
    const camp = c();
    const sid = camp.world.location;
    const k = camp.contract;
    if (k?.status === 'done' && k.giver === sid && CL.contracts.collect(camp)) {
      stats.contractsDone++;
      log(`day ${camp.day.toFixed(1)}: contract collected`);
    }
    spendPoints();
    const s = CL.party.currentSettlement();
    if (s.services.includes('trade')) {
      const want = Math.ceil(U().dailyRations(camp) * 6 - camp.food);
      const afford = Math.floor(camp.gold / U().rationPrice(camp)) - 2;
      const n = Math.min(want, afford);
      if (n > 0 && U().buyFood(camp, n)) stats.foodBought += n;
    }
    // Shop for better gear when there's money to spare after a safety reserve.
    const score = (id) => {
      const it = id ? CL.content.item(id) : null;
      return it ? (it.stats.damage || 0) + (it.stats.armor || 0) * 3 + (it.stats.travel || 0) * 10 : -1;
    };
    for (const id of CL.trade.gearStock(sid)) {
      const it = CL.content.item(id);
      if (!it.slot || score(id) <= score(camp.equipment[it.slot])) continue;
      const reserve = U().weeklyWages(camp) * 2 + 8 * U().dailyRations(camp) + 80;
      if (camp.gold < CL.trade.gearBuyPrice(camp, id) + reserve) continue;
      if (CL.trade.buyGear(camp, sid, id).ok && CL.character.equip(id)) stats.gearBought++;
    }
    for (const t of [...new Set(camp.roster.map((x) => x.troop))]) {
      for (const o of CL.party.upgradeOptions(t)) {
        if (o.locked || camp.gold < o.cost + 60) continue;
        stats.upgraded += CL.party.upgrade(t, o.to, Math.floor((camp.gold - 60) / o.cost));
      }
    }
    const recruits = CL.party.recruitsHere();
    const reserve = () => U().weeklyWages(camp) + 8 * U().dailyRations(camp) + 20;
    for (let i = 0; i < 20; i++) {
      const id = recruits[i % Math.max(1, recruits.length)];
      if (!id) break;
      if (camp.gold < CL.content.troop(id).recruitCost + reserve() || !CL.party.recruit(id)) break;
      stats.hired++;
    }
    if (!camp.contract && CL.contracts.offersContracts(sid)) {
      const o = CL.contracts.offerAt(camp, sid);
      if (o && CL.autoresolve.winChance(CL.autoresolve.playerPower(camp), CL.autoresolve.troopsPower(o.troops)) >= 0.5 && CL.contracts.accept(camp, sid).ok) {
        stats.contractsTaken++;
        log(`day ${camp.day.toFixed(1)}: contract accepted at ${sid}`);
      }
    }
    if (style === 'expert') followers(camp);
    const wounded = CL.party.woundedSoldiers().length;
    if (wounded && wounded * 2 >= camp.roster.length && CL.party.canRest() && camp.food >= U().dailyRations(camp)) {
      CL.party.rest();
      return;
    }
    CL.world.leaveSettlement();
    chooseDestination();
  }

  function chooseDestination() {
    const camp = c();
    const k = camp.contract;
    const town = (id) => {
      const s = CL.content.get('settlements', id);
      return { type: 'settlement', id, x: s.mapX, y: s.mapY };
    };
    if (k?.status === 'done') return CL.world.travelTo(town(k.giver));
    // Low on food: head for the nearest market — unless we are standing in it and can't pay,
    // in which case go and earn something.
    const market = CL.world.nearestSettlement(camp.world.x, camp.world.y, (x) => x.services.includes('trade'));
    const atMarket = CL.world.mapDist(camp.world.x, camp.world.y, market.mapX, market.mapY) < 0.5;
    if (U().foodDays(camp) < 1.5 && !atMarket) return CL.world.travelTo(town(market.id));
    if (k?.status === 'active') {
      const p = CL.parties.find(camp, k.partyId);
      if (p) return CL.world.travelTo({ type: 'party', id: p.id, x: p.x, y: p.y });
    }
    // Otherwise: clear a lair we can beat, or go look for work.
    for (const [id, st] of Object.entries(CL.world.map().sites)) {
      if (!CL.world.siteActive(id)) continue;
      g.siteId = id;
      g.partyId = null;
      const e = CL.parties.current();
      g.siteId = null;
      if (e && odds(e) >= 0.6) return CL.world.travelTo({ type: 'site', id, x: st.mapX, y: st.mapY });
    }
    const boards = ['stonebridge', 'eastwatch'];
    const here = CL.world.nearestSettlement(camp.world.x, camp.world.y);
    // Nothing worth doing nearby: walk to the other contracts board (time passes, things happen).
    return CL.world.travelTo(town(here.id === boards[0] ? boards[1] : boards[0]));
  }

  function encounterTurn() {
    const camp = c();
    const e = CL.parties.current();
    if (!e) return CL.ui.changeMode('map');
    if (!e.hostile) return CL.ui.changeMode('map');
    const p = odds(e);
    const n = CL.parties.negotiation(camp, e);
    if (p >= 0.55 || n?.kind === 'intimidate') {
      if (n?.kind === 'intimidate' && !e.party?.contractId) {
        CL.parties.negotiate();
        return;
      }
      stats.autoResolves++;
      resolve();
      return;
    }
    if (n?.kind === 'toll' && camp.gold >= n.cost + 40 && !e.party?.contractId) {
      stats.tolls++;
      CL.parties.negotiate();
      return;
    }
    if (e.kind === 'party') {
      stats.retreats++;
      if (!CL.parties.retreat()) {
        // Failed retreat → a real battle started; settle it.
        if (style === 'hands-off') CL.debugTools.endBattleNow(CL.autoresolve.next(camp) < p);
        else drive();
        tally();
      }
      return;
    }
    CL.ui.changeMode('map'); // a site we can't take yet
  }

  function resolve() {
    if (style === 'hands-off') CL.parties.autoResolve();
    else fightInPerson();
    tally();
  }

  /** The expert keeps a quartermaster and a merchant (V2-11, V2-12), funded from what is spare. */
  function followers(camp) {
    if (!CL.quartermaster.get(camp) && CL.quartermaster.canHire(camp) && camp.gold >= 160) {
      CL.quartermaster.hire(camp);
      stats.screens++;
    }
    if (!CL.merchant.get(camp) && CL.merchant.canHire(camp) && camp.gold >= 400) {
      CL.merchant.hire(camp);
      CL.merchant.fund(camp, 150);
      stats.screens++;
    }
  }

  /** Which setup to fight with. */
  function presetFor(e) {
    const p = odds(e);
    if (style === 'presets') return p < 0.65 ? 'defensive' : 'balanced';
    return p < 0.6 ? 'defensive' : p > 0.75 ? 'aggressive' : 'balanced';
  }

  /** Fight the open encounter in person with a chosen setup, to the end. */
  function fightInPerson() {
    const e = CL.parties.current();
    const preset = presetFor(e);
    stats.presets[preset] = (stats.presets[preset] || 0) + 1;
    if (preset !== 'balanced') stats.screens++;
    CL.parties.attack(CL.prep.plan(preset, CL.arena.mapFor(e.def.map)));
    drive();
  }

  /** The bot hero: walk at the nearest enemy and swing; the expert rallies anyone running. */
  function drive() {
    stats.fought++;
    for (let i = 0; i < 30000 && g.mode === 'battle'; i++) {
      const h = g.hero;
      const foe = g.enemies.filter((x) => x.alive && !x.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] || g.enemies.find((x) => x.alive);
      if (foe && h.alive) {
        const [dx, dy] = [foe.x - h.x, foe.y - h.y];
        const L = Math.hypot(dx, dy) || 1;
        g.joystick = L > 45 || !CL.units.inArc(h, foe, CL.units.ARC.attack) ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
        g.attackHeld = L < 70;
      }
      if (style === 'expert' && h.alive && !CL.morale.rallyIn(g) && g.allies.some((a) => a.alive && a.routing) && CL.morale.rally(g)) stats.rallies++;
      CL.combat.update(0.02);
    }
    if (g.mode === 'battle') CL.debugTools.endBattleNow(true); // never: battles end (V2-T2); just in case
    if (!g.hero.alive) stats.heroDown++;
  }

  function tally() {
    stats.battles++;
    if (g.result?.win) stats.wins++;
    else stats.losses++;
  }

  /** Play until `days` of campaign time have passed (or the step budget runs out). */
  function play(days, maxSteps = 200000) {
    const end = c().day + days;
    let lastDay = c().day;
    let idle = 0;
    for (let step = 0; step < maxSteps && c().day < end; step++) {
      stats.minGold = Math.min(stats.minGold, c().gold);
      const m = g.mode;
      if (m === 'result') CL.world.returnToMap();
      else if (m === 'encounter') encounterTurn();
      else if (m === 'settlement' || m === 'town' || m === 'talk') settlementTurn(); // Stonebridge's streets too
      else if (m === 'map') {
        if (!g.travel) chooseDestination();
        CL.world.update(0.1);
      } else if (m === 'battle') {
        // A failed retreat: the battle has begun.
        if (style === 'hands-off') CL.debugTools.endBattleNow(true);
        else drive();
        tally();
      } else CL.ui.changeMode('map');
      if (c().day > lastDay) {
        lastDay = c().day;
        idle = 0;
      } else if (++idle > 400) {
        // Nothing advanced the clock for a long time: count it and nudge time forward.
        stats.stuck++;
        idle = 0;
        CL.party.advanceDays(0.1);
      }
    }
    return stats;
  }

  return { play, stats };
}

/**
 * UI stub for headless runs: changeMode just records the mode; messages are collected.
 * Matches the subset of CL.ui the game logic calls.
 */
function headlessUi(CL, messages = []) {
  return {
    message: (t) => messages.push(t),
    changeMode: (m) => {
      CL.game.mode = m;
    },
    refresh: () => {},
    refreshRoster: () => {},
    hideBattleOverlays: () => {},
    showSelectedGroup: () => {},
  };
}

module.exports = { makeBot, headlessUi };
