// A headless player for acceptance runs: plays the real campaign logic (no DOM) with simple,
// sensible choices, and records what happened. Used by tests/acceptance.test.js and by
// scripts/simulate-campaign.js for multi-seed balance checks.

function makeBot(CL, { log = () => {} } = {}) {
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
    foodBought: 0,
    minGold: Infinity,
    stuck: 0,
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
        CL.debugTools.endBattleNow(CL.autoresolve.next(camp) < p);
        tally();
      }
      return;
    }
    CL.ui.changeMode('map'); // a site we can't take yet
  }

  function resolve() {
    CL.parties.autoResolve();
    tally();
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
        CL.debugTools.endBattleNow(true);
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
