// A headless player for acceptance runs: plays the real campaign logic (no DOM) with simple,
// sensible choices, and records what happened. Used by tests/acceptance.test.js and by
// scripts/simulate-campaign.js for multi-seed balance checks.
//
// style (V2-13, Prototype G: the same campaign played three ways):
//   'hands-off'  auto-resolves every fight and never changes a setting (the default)
//   'presets'    fights in person, choosing only a preset: Defensive when the odds are close, else Balanced
//   'expert'     fights in person with Aggressive, Defensive or Balanced as the odds suggest, rallies its
//                soldiers, and keeps a quartermaster and a merchant; from 2.23.0 (P7-T) also a surgeon, a
//                scout and a blacksmith, sends a detachment out hunting when the company is big enough,
//                buys a mill where one would pay, and takes part in the world's events
// The in-person fights use a simple hero (walk at the nearest enemy, swing); a real player does better.
//
// roam (W-08): tour the realm, walking to every contract board in turn instead of the nearest other
// one, and taking on lairs further afield. Without it the bot works where it is: lairs within about a
// day's ride (LAIR_REACH), and the nearest other board.

const LAIR_REACH = 30; // map units: about a day's ride; further lairs aren't worth the trip
const ROAM_REACH = 60;

function makeBot(CL, { log = () => {}, style = 'hands-off', roam = false } = {}) {
  const recentBoards = []; // roam: the boards visited lately, so it moves on round the realm
  const c = () => CL.campaign;
  const g = CL.game;
  const stats = {
    invariants: [], // what broke the design's invariants, by day (P8-02)
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
    hiredFollowers: [], // P7-T: who the expert took on
    detachmentsSent: 0,
    millsBought: 0,
    eventsJoined: 0,
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
    // The "landed" style (P8-05): it serves the kingdom whose capital it is in, swears when it may,
    // takes the grants it is offered, and leaves the steward and the policies as they are.
    if (style === 'landed') {
      const f = CL.realm.owner(sid, camp);
      const AL = CL.allegiance;
      if (CL.realm.isRealm(f) && CL.realm.capitalOf(f) === sid) {
        if (AL.preview(camp, 'swear', f).ok) AL.act(camp, 'swear', f);
        else if (AL.state(camp).kind === 'independent' && AL.preview(camp, 'serve', f).ok) AL.act(camp, 'serve', f);
        else if (AL.state(camp).kind === 'mercenary' && AL.state(camp).realm === f && AL.state(camp).until - camp.day < 5) AL.act(camp, 'renew', f);
      }
    }
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
    if (style === 'expert') followers(camp); // P7-T: the company's roles come before more recruits
    const recruits = CL.party.recruitsHere();
    // P9-B3: with room for 200, a company is held back by its pay, not its limit. Like a careful
    // captain, past 20 soldiers the bot hires only while it keeps three weeks of wages in hand, the
    // newcomer's included (up to 20, one week, as it always did); and the expert gets its property (a
    // mill) before it grows past 20.
    const big = camp.roster.length >= 20;
    const reserve = (id) => (big ? 3 * (U().weeklyWages(camp) + CL.content.troop(id).wage) : U().weeklyWages(camp)) + 8 * U().dailyRations(camp) + 20;
    const saving = big && style === 'expert' && !CL.business.get(camp);
    for (let i = 0; i < (saving ? 0 : 20); i++) {
      const id = recruits[i % Math.max(1, recruits.length)];
      if (!id) break;
      if (camp.gold < CL.content.troop(id).recruitCost + reserve(id) || !CL.party.recruit(id)) break;
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
      // P7-04: ride to where the target was last seen (it may have moved on); the map shows that.
      const p = CL.parties.find(camp, k.partyId);
      const at = p && CL.sight.shown(camp, p);
      if (p && at && !at.live && CL.world.mapDist(camp.world.x, camp.world.y, at.x, at.y) < 1) {
        if (!g.waiting) CL.world.toggleWait(); // there, and it has moved on: wait and watch for it
        return;
      }
      if (g.waiting) CL.world.toggleWait();
      if (p && at) return CL.world.travelTo(at.live ? { type: 'party', id: p.id, x: p.x, y: p.y } : { type: 'point', id: null, x: at.x, y: at.y });
      if (p) return CL.world.travelTo({ type: 'party', id: p.id, x: p.x, y: p.y });
    }
    // Otherwise: clear a lair we can beat (the nearest first: W-05b's world is big), or go look for work.
    const near = (a, b) => CL.world.mapDist(camp.world.x, camp.world.y, a.mapX, a.mapY) - CL.world.mapDist(camp.world.x, camp.world.y, b.mapX, b.mapY);
    const reachOf = roam ? ROAM_REACH : LAIR_REACH;
    for (const [id, st] of Object.entries(CL.world.map().sites).sort(([, a], [, b]) => near(a, b))) {
      if (!CL.world.siteActive(id) || CL.world.mapDist(camp.world.x, camp.world.y, st.mapX, st.mapY) > reachOf) continue;
      g.siteId = id;
      g.partyId = null;
      const e = CL.parties.current();
      g.siteId = null;
      if (e && odds(e) >= lairNerve(camp)) return CL.world.travelTo({ type: 'site', id, x: st.mapX, y: st.mapY });
    }
    // Contract boards: every settlement offering contracts (W-04: read from the world, not named).
    const here = CL.world.nearestSettlement(camp.world.x, camp.world.y);
    const boards = Object.values(CL.content.table('settlements'))
      .filter((s) => s.services?.includes('contracts') && s.id !== here.id)
      .sort(near);
    // Nothing worth doing nearby: walk to the nearest other contracts board (time passes, things happen),
    // or when roaming the nearest one not visited lately.
    const next = (roam && boards.find((b) => !recentBoards.includes(b.id))) || boards[0];
    if (roam) {
      recentBoards.push(next.id);
      if (recentBoards.length > Math.max(1, boards.length - 1)) recentBoards.shift();
    }
    return CL.world.travelTo(town(next.id));
  }

  /**
   * The odds it fights at: 55%, or an even fight for a broke lone rider (no soldiers and nothing to
   * hire them with), who has nothing else to do. Lairs it rides to need 60% (or this, if lower).
   */
  const broke = (camp) => !camp.roster.length && camp.gold < 30;
  const nerve = (camp) => (broke(camp) ? 0.5 : 0.55);
  const lairNerve = (camp) => (broke(camp) ? 0.5 : 0.6);

  function encounterTurn() {
    const camp = c();
    const e = CL.parties.current();
    if (!e) return CL.ui.changeMode('map');
    if (!e.hostile) return CL.ui.changeMode('map');
    const p = odds(e);
    const n = CL.parties.negotiation(camp, e);
    // A lair it chose to ride to is fought (its own threshold already passed).
    if (p >= nerve(camp) || n?.kind === 'intimidate' || (e.kind === 'site' && p >= lairNerve(camp))) {
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

  /**
   * The expert keeps a quartermaster and a merchant (V2-11, V2-12), funded from what is spare; and from
   * P7-T the Phase 7 roles: a surgeon, a scout and a blacksmith (each when there's money to keep them),
   * a detachment out hunting, a mill where it would pay, and the world's events where it can help.
   */
  function followers(camp) {
    const took = (who) => {
      stats.hiredFollowers.push(who);
      stats.screens++;
    };
    if (!CL.quartermaster.get(camp) && CL.quartermaster.canHire(camp) && camp.gold >= 160) {
      CL.quartermaster.hire(camp);
      took('quartermaster');
    }
    const spare = () => camp.gold - U().weeklyWages(camp) - 40;
    for (const [who, F] of [['surgeon', CL.surgeon], ['scout', CL.scout], ['blacksmith', CL.blacksmith]]) {
      if (!F.get(camp) && F.canHire(camp) && camp.roster.length >= 6 && spare() >= F.HIRE + 2 * F.WAGE && F.hire(camp)) took(who);
    }
    if (!CL.merchant.get(camp) && CL.merchant.canHire(camp) && camp.gold >= 400) {
      CL.merchant.hire(camp);
      CL.merchant.fund(camp, 150);
      took('merchant');
    }
    const sid = camp.world.location;
    const B = CL.business;
    if (!B.get(camp) && !B.blocked(camp, sid) && spare() >= B.priceAt(sid) + 150 && B.estimate(camp, sid).profit >= 15 && B.buy(camp, sid)) {
      B.fund(camp, 150);
      stats.millsBought++;
      stats.screens++;
    }
    sendDetachment(camp);
    for (const e of CL.happenings.state(camp).open.filter((x) => x.place === sid && !x.taken)) {
      const o = CL.happenings.options(camp, e).find((x) => !x.reason);
      if (o && CL.happenings.choose(camp, e.id, o.id).ok) stats.eventsJoined++;
    }
  }

  /** With ten or more fit soldiers and a captain, send four out to hunt bands round here for four days. */
  function sendDetachment(camp) {
    const D = CL.detachments;
    if (D.active(camp).length) return;
    const fit = camp.roster.filter((x) => x.woundedUntil === null);
    const cap = D.captains(camp).find((k) => k.kind === 'soldier');
    if (fit.length < 10 || !cap) return;
    const ids = fit.filter((x) => x.id !== cap.id).slice(0, 3).map((x) => x.id);
    const r = D.send(camp, { captain: cap, soldierIds: ids, order: { objective: 'hunt', x: camp.world.x, y: camp.world.y, days: 4 } });
    if (r.ok) {
      stats.detachmentsSent++;
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
      // P8-T: a headless page never opens the prompts, so a decision waiting is answered as the screen
      // would ask it (and counted as a forced screen).
      if (g.mode === 'map' && CL.fiefs?.grantDue(c())) g.mode = 'grant';
      else if (g.mode === 'map' && CL.lords?.offerDue(c())) g.mode = 'ransom';
      const m = g.mode;
      // The decisions that interrupt the map (P8-01, P8-05): a bot takes the default.
      if (m === 'ransom') {
        const x = CL.lords.offerDue(c());
        if (x) CL.lords.answer(c(), x.lord, 'accept');
        CL.ui.changeMode('map');
        stats.decisions = (stats.decisions || 0) + 1;
      } else if (m === 'grant') {
        CL.fiefs.answer(c(), 'accept');
        CL.ui.changeMode('map');
        stats.decisions = (stats.decisions || 0) + 1;
      } else if (m === 'conquest') {
        if (g.conquest) CL.fiefs.conquered(c(), g.conquest, 'player', 'ask');
        g.conquest = null;
        CL.ui.changeMode('map');
        stats.decisions = (stats.decisions || 0) + 1;
      } else if (m === 'siegeAlarm') {
        // P8-06a: your fort besieged: the default, leave it to the steward.
        CL.ui.changeMode('map');
        stats.decisions = (stats.decisions || 0) + 1;
      } else if (m === 'result') CL.world.returnToMap();
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
        // The design's invariants (§25.3, P8-02), after every world day: anything wrong is kept.
        if (Math.floor(c().day) > Math.floor(lastDay)) for (const p of CL.realm.invariants?.(c()) || []) if (stats.invariants.length < 20) stats.invariants.push(`day ${Math.floor(c().day)}: ${p}`);
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
