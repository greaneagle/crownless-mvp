/* Crownless party & campaign operations: recruiting, the day clock, wounded recovery,
 * battle results (casualties, rewards, loot) applied as a single exactly-once transaction. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PARTY_CAP = 15; // all soldiers, wounded included (GDD §7). Formula arrives in Gate C.
  const DEATH_CHANCE = 0.35; // otherwise wounded (GDD §7)
  const BATTLE_DAYS = 0.25; // a battle and its aftermath take about six hours
  const DEFEAT_GOLD_KEPT = 0.8; // GDD §6: lose ~20% of carried crowns

  const c = () => CL.campaign;
  const troopOf = (s) => CL.content.troop(s.troop);
  const isWounded = (s) => s.woundedUntil !== null;
  const healthySoldiers = () => c().roster.filter((s) => !isWounded(s));
  const woundedSoldiers = () => c().roster.filter(isWounded);
  const dayNumber = (day = c().day) => Math.floor(day) + 1;

  /** The settlement the party is standing in, or null on the open map. */
  function currentSettlement(camp = c()) {
    const id = camp.world?.location;
    return id ? CL.content.get('settlements', id) : null;
  }

  const offers = (s, service) => Boolean(s?.services.includes(service));

  /** Troops for hire here: the owner faction's recruits, if the settlement offers recruiting. */
  function recruitsHere(camp = c()) {
    const s = currentSettlement(camp);
    if (!offers(s, 'recruit')) return [];
    return CL.content.get('factions', s.ownerFaction).recruits || [];
  }

  const canRest = (camp = c()) => offers(currentSettlement(camp), 'rest');

  function canRecruit(camp, troopId) {
    return camp.gold >= CL.content.troop(troopId).recruitCost && camp.roster.length < PARTY_CAP;
  }

  function recruit(troopId) {
    if (!recruitsHere().includes(troopId) || !canRecruit(c(), troopId)) return false;
    const price = CL.content.troop(troopId).recruitCost;
    c().gold -= price;
    CL.save.addSoldier(c(), troopId);
    CL.save.write();
    CL.ui.refreshRoster();
    CL.diag.log('info', 'Soldier recruited', { troop: troopId, cost: price });
    return true;
  }

  /** Advance the campaign clock; wounded soldiers whose time is up return to duty. */
  function advanceDays(days, camp = c()) {
    camp.day += days;
    const healed = [];
    for (const s of camp.roster) {
      if (isWounded(s) && s.woundedUntil <= camp.day + 1e-9) {
        s.woundedUntil = null;
        healed.push(s.id);
      }
    }
    if (healed.length) CL.diag.log('info', 'Wounded recovered', { soldiers: healed, day: camp.day });
    return healed;
  }

  function rest() {
    if (!canRest()) return [];
    const healed = advanceDays(1);
    CL.save.write();
    CL.ui.refreshRoster();
    CL.ui.message(
      healed.length ? `Day ${dayNumber()}: ${healed.length} soldier(s) back on their feet` : `Day ${dayNumber()}: the camp rests`,
    );
    return healed;
  }

  /** Roll each fallen ally as killed or wounded. Returns soldier-id lists. */
  function rollCasualties(allies) {
    const killed = [];
    const wounded = [];
    for (const a of allies) {
      if (a.alive || a.soldierId == null) continue;
      if (Math.random() < DEATH_CHANCE) killed.push(a.soldierId);
      else wounded.push(a.soldierId);
    }
    return { killed, wounded };
  }

  /** Entry whose cumulative weight first exceeds `roll` (0 ≤ roll < total weight). */
  function weightedPick(table, roll) {
    let acc = 0;
    for (const e of table) {
      acc += e.weight;
      if (roll < acc) return e;
    }
    return table[table.length - 1];
  }

  /** Weighted loot: one roll per kill at the encounter's chance. Returns { itemId: count }. */
  function rollLoot(enc, kills) {
    const loot = {};
    const table = enc.loot?.table || [];
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    if (!total) return loot;
    for (let i = 0; i < kills; i++) {
      if (Math.random() >= enc.loot.chancePerKill) continue;
      const entry = weightedPick(table, Math.random() * total);
      loot[entry.item] = (loot[entry.item] || 0) + 1;
    }
    return loot;
  }

  /** On capture, one random non-quest item is taken (GDD §6 "some non-essential loot"). */
  function loseItemOnCapture(camp) {
    const losable = Object.keys(camp.inventory).filter((id) => !CL.content.item(id).questItem);
    if (!losable.length) return null;
    const id = losable[Math.floor(Math.random() * losable.length)];
    camp.inventory[id] -= 1;
    if (camp.inventory[id] <= 0) delete camp.inventory[id];
    return id;
  }

  /**
   * Apply one battle's outcome to the campaign. Pure with respect to the DOM.
   * Guarded by battleId so a battle can never pay out twice.
   */
  function applyBattleResult(camp, { battleId, encounterId, win, kills, killed, wounded }) {
    if (battleId <= camp.lastResolvedBattle) return null;
    const enc = CL.content.encounter(encounterId);
    camp.lastResolvedBattle = battleId;
    camp.roster = camp.roster.filter((s) => !killed.includes(s.id));
    advanceDays(BATTLE_DAYS, camp);
    for (const s of camp.roster) if (wounded.includes(s.id)) s.woundedUntil = camp.day + CL.save.WOUND_DAYS;
    camp.battles++;
    const result = { gold: 0, renown: 0, loot: {}, lostItem: null };
    if (win) {
      result.gold = enc.reward.goldBase + kills * enc.reward.goldPerKill;
      result.renown = enc.reward.renown;
      result.loot = rollLoot(enc, kills);
      camp.victories++;
      camp.gold += result.gold;
      camp.renown += result.renown;
      for (const [id, n] of Object.entries(result.loot)) camp.inventory[id] = (camp.inventory[id] || 0) + n;
    } else {
      const kept = Math.floor(camp.gold * DEFEAT_GOLD_KEPT);
      result.gold = kept - camp.gold;
      camp.gold = kept;
      result.lostItem = loseItemOnCapture(camp);
    }
    return result;
  }

  const describeItems = (map) =>
    Object.entries(map)
      .map(([id, n]) => `${n > 1 ? `${n}× ` : ''}${CL.content.item(id).name}`)
      .join(', ');

  function endBattle(win) {
    const g = CL.game;
    if (g.mode !== 'battle') return;
    g.mode = 'result';
    const { killed, wounded } = rollCasualties(g.allies);
    const outcome = { battleId: g.battleId, encounterId: g.encounter, win, kills: g.kills, killed, wounded };
    const r = applyBattleResult(CL.campaign, outcome);
    if (r) CL.world?.onBattleResolved(win, g.siteId);
    CL.save.write();
    const recoverDay = dayNumber(CL.campaign.day + CL.save.WOUND_DAYS);
    const lines = [
      `<strong>${win ? `+${r.gold} crowns · +${r.renown} renown` : `${-r.gold} crowns lost (20%)`}</strong>`,
      `Enemies defeated: ${g.kills}`,
      `Killed: ${killed.length} · Wounded: ${wounded.length}`,
      `Survivors: ${g.allies.filter((u) => u.alive).length} · Battle waves reached: ${g.wave}/${g.totalWaves}`,
    ];
    if (win) lines.push(`Loot: ${describeItems(r.loot) || 'nothing of value'}`);
    else if (r.lostItem) lines.push(`Taken by your captors: ${CL.content.item(r.lostItem).name}`);
    lines.push(
      wounded.length
        ? `<small>Wounded soldiers can't fight until day ${recoverDay}. Travel or rest in a settlement to pass the time.</small>`
        : '<small>No soldiers wounded.</small>',
    );
    g.result = { win, html: lines.join('<br>'), ...r };
    CL.diag.log('info', 'Battle ended', { ...outcome, result: r, day: CL.campaign.day });
    CL.ui.changeMode('result');
  }

  CL.party = {
    PARTY_CAP,
    currentSettlement,
    recruitsHere,
    canRest,
    BATTLE_DAYS,
    canRecruit,
    recruit,
    healthySoldiers,
    woundedSoldiers,
    troopOf,
    dayNumber,
    advanceDays,
    rest,
    rollCasualties,
    rollLoot,
    applyBattleResult,
    describeItems,
    endBattle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
