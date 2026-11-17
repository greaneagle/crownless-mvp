// @ts-check
/* Crownless party & campaign operations: recruiting, the day clock, wounded recovery,
 * battle results (casualties, rewards, loot) applied as a single exactly-once transaction. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  // XP a soldier needs before it can be upgraded from its tier (gold cost comes from data).
  const UPGRADE_XP = { T1: 40, T2: 100 };
  // Battle XP. Hero: per battle + per enemy defeated. Soldiers: per battle they fought in (half if
  // wounded) + per enemy they personally felled in a real battle.
  const XP = { heroWin: 25, heroLoss: 5, heroPerKill: 8, heroPerKillLoss: 4, troopWin: 20, troopLoss: 8, troopPerKill: 5 };
  const DEATH_CHANCE = 0.35; // otherwise wounded (GDD §7)
  const BATTLE_DAYS = 0.25; // a battle and its aftermath take about six hours
  const DEFEAT_GOLD_KEPT = 0.8; // GDD §6: lose ~20% of carried crowns

  const c = () => CL.campaign;
  /** @param {Soldier} s */
  const troopOf = (s) => CL.content.troop(s.troop);
  /** @param {Soldier} s */
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
    if (!offers(s, 'recruit') || !CL.realm.welcomes(camp, s.id)) return []; // Hostile owners won't let you recruit
    const own = CL.content.get('factions', CL.realm.owner(s.id, camp)).recruits || [];
    // Towns also have sell-swords for hire: the neutral Mercenary (the 15th troop type).
    return s.type === 'town' ? [...own, 'mercenary'] : own;
  }

  const canRest = (camp = c()) => offers(currentSettlement(camp), 'rest');

  /**
   * GDD §5 party cap: min(20, 8 + 2×Leadership + floor(Renown/40) + faction_bonus), the faction bonus
   * being +2 while Friendly with a kingdom. Wounded soldiers take slots too (GDD §7).
   */
  function partyCap(camp = c()) {
    return Math.min(20, 8 + 2 * CL.character.skill('leadership', camp) + Math.floor(camp.renown / 40) + CL.realm.capBonus(camp));
  }

  function canRecruit(camp, troopId) {
    return camp.gold >= CL.content.troop(troopId).recruitCost && camp.roster.length + CL.companion.slots(camp) < partyCap(camp);
  }

  // ---- Troop upgrades (GDD §7) ----

  /** Upgrade paths from a troop: main and alternate branch (Footman → Rider, Spearman → Horse Scout). */
  function upgradeOptions(troopId) {
    const t = CL.content.troop(troopId);
    return [
      [t.upgradeTo, t.upgradeCost],
      [t.altUpgradeTo, t.altUpgradeCost],
    ]
      .filter(([to]) => to)
      .map(([to, cost]) => ({ to, cost, xp: UPGRADE_XP[t.tier], locked: null }));
  }

  /** @param {Soldier} s */
  const readyFor = (s) => s.woundedUntil === null && s.xp >= (UPGRADE_XP[CL.content.troop(s.troop).tier] ?? Infinity);

  /**
   * Upgrade up to max ready soldiers of one troop type along one branch. All-or-nothing per soldier.
   * @param {ContentId} fromId @param {ContentId} toId @param {number} [max] @param {Campaign} [camp]
   * @returns {number} soldiers upgraded
   */
  function upgrade(fromId, toId, max = Infinity, camp = c()) {
    const opt = upgradeOptions(fromId).find((o) => o.to === toId);
    if (!opt || opt.locked) return 0;
    let done = 0;
    for (const s of camp.roster) {
      if (done >= max || camp.gold < opt.cost) break;
      if (s.troop !== fromId || !readyFor(s)) continue;
      camp.gold -= opt.cost;
      s.xp -= opt.xp;
      s.troop = toId;
      CL.events.emit(camp, 'SoldierPromoted', { soldierId: s.id, from: fromId, to: toId, cost: opt.cost });
      done++;
    }
    if (done) CL.diag.log('info', 'Troops upgraded', { from: fromId, to: toId, count: done, cost: done * opt.cost });
    return done;
  }

  /**
   * One soldier's upgrade paths, each with whether it can be taken now and, if not, why (V2-03 profile
   * card). Same rules and costs as `upgrade`.
   * @param {Soldier} s @param {Campaign} [camp]
   * @returns {Array<UpgradeOption & { can: boolean, why: string | null }>}
   */
  function soldierUpgrades(s, camp = c()) {
    return upgradeOptions(s.troop).map((o) => {
      let why = o.locked;
      if (!why && s.woundedUntil !== null) why = `Wounded until day ${dayNumber(s.woundedUntil)}`;
      if (!why && s.xp < o.xp) why = `Needs ${o.xp} XP (has ${s.xp})`;
      if (!why && camp.gold < o.cost) why = `Needs ${o.cost} crowns`;
      return { ...o, can: !why, why };
    });
  }

  /**
   * Upgrade one named soldier along one path. Returns true when done.
   * @param {Campaign} camp @param {number} soldierId @param {ContentId} toId
   */
  function upgradeSoldier(camp, soldierId, toId) {
    const s = camp.roster.find((x) => x.id === soldierId);
    const opt = s && soldierUpgrades(s, camp).find((o) => o.to === toId);
    if (!opt?.can) return false;
    const from = s.troop;
    camp.gold -= opt.cost;
    s.xp -= opt.xp;
    s.troop = toId;
    CL.events.emit(camp, 'SoldierPromoted', { soldierId: s.id, from, to: toId, cost: opt.cost });
    CL.diag.log('info', 'Soldier upgraded', { id: s.id, from, to: toId, cost: opt.cost });
    return true;
  }

  /**
   * Award battle XP to the hero and to the soldiers who took part.
   * @param {Campaign} camp @param {BattleOutcome} outcome @returns {XpAward}
   */
  function awardXp(camp, { win, kills, wounded, participants = [], soldierKills = {} }) {
    const heroXp = win ? XP.heroWin + XP.heroPerKill * kills : XP.heroLoss + XP.heroPerKillLoss * kills;
    const levels = CL.character.gainXp(heroXp, camp);
    let troopXp = 0;
    for (const s of camp.roster) {
      if (!participants.includes(s.id)) continue;
      let xp = win ? XP.troopWin : XP.troopLoss;
      if (wounded.includes(s.id)) xp = Math.round(xp / 2);
      xp += XP.troopPerKill * (soldierKills[s.id] || 0);
      s.xp += xp;
      troopXp += xp;
    }
    return { heroXp, levels, troopXp, ready: camp.roster.filter(readyFor).length };
  }

  function recruit(troopId) {
    if (!recruitsHere().includes(troopId) || !canRecruit(c(), troopId)) return false;
    const price = CL.content.troop(troopId).recruitCost;
    c().gold -= price;
    const s = CL.save.addSoldier(c(), troopId);
    CL.events.emit(c(), 'SoldierRecruited', { soldierId: s.id, troop: troopId, settlement: c().world.location, via: 'hire' });
    CL.save.write();
    CL.ui.refreshRoster();
    CL.diag.log('info', 'Soldier recruited', { troop: troopId, cost: price });
    CL.story.emit('recruit', { troop: troopId, settlement: c().world.location });
    return true;
  }

  /**
   * Advance the campaign clock; wounded soldiers whose time is up return to duty.
   * The one way campaign time passes (upkeep, markets, world parties, contracts, story, news).
   * @param {number} days @param {Campaign} [camp] @returns {number[]} IDs of soldiers who healed
   */
  function advanceDays(days, camp = c()) {
    const from = camp.day;
    camp.day += days;
    CL.upkeep.tick(camp, from, camp.day); // eat, morale, desertion, weekly wages
    CL.trade.drift(camp, days); // markets restock toward their baseline
    CL.parties.tick(camp, days * 24); // patrols, caravans and bands move; may catch the player
    CL.contracts.tick(camp); // deadlines
    const healed = [];
    for (const s of camp.roster) {
      if (isWounded(s) && s.woundedUntil <= camp.day + 1e-9) {
        s.woundedUntil = null;
        healed.push(s.id);
      }
    }
    if (healed.length) CL.diag.log('info', 'Wounded recovered', { soldiers: healed, day: camp.day });
    CL.companion.heal(camp);
    CL.story.tick(camp); // quest stage deadlines
    CL.news.tick(camp); // a regional news line every couple of days
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

  /**
   * Roll each fallen ally as killed or wounded (the seeded casualties stream). Returns soldier-id lists.
   * @param {Unit[]} allies @param {Campaign} [camp] @returns {{ killed: number[], wounded: number[] }}
   */
  function rollCasualties(allies, camp = c()) {
    const killed = [];
    const wounded = [];
    for (const a of allies) {
      if (a.alive || a.soldierId == null) continue;
      if (CL.autoresolve.roll(camp, 'casualties') < DEATH_CHANCE) killed.push(a.soldierId);
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
  function rollLoot(enc, kills, camp = c()) {
    /** @type {Record<ContentId, number>} */
    const loot = {};
    const lt = CL.content.lootTable(enc.loot);
    const table = lt?.table || [];
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    if (!total) return loot;
    for (let i = 0; i < kills; i++) {
      if (CL.autoresolve.roll(camp, 'loot') >= lt.chancePerKill) continue;
      const entry = weightedPick(table, CL.autoresolve.roll(camp, 'loot') * total);
      loot[entry.item] = (loot[entry.item] || 0) + 1;
    }
    return loot;
  }

  /** On capture, one random non-quest item is taken (GDD §6 "some non-essential loot"). */
  function loseItemOnCapture(camp) {
    const losable = Object.keys(camp.inventory).filter((id) => !CL.content.item(id).questItem);
    if (!losable.length) return null;
    const id = losable[Math.floor(CL.autoresolve.roll(camp, 'loot') * losable.length)];
    camp.inventory[id] -= 1;
    if (camp.inventory[id] <= 0) delete camp.inventory[id];
    return id;
  }

  /**
   * Apply one battle's outcome to the campaign. Pure with respect to the DOM.
   * Guarded by battleId so a battle can never pay out twice.
   * @param {Campaign} camp @param {BattleOutcome} outcome
   * @returns {BattleResult | null} null when this battle was already applied
   */
  function applyBattleResult(camp, outcome) {
    const { battleId, encounterId, encounter, win, kills, killed, wounded } = outcome;
    if (battleId <= camp.lastResolvedBattle) return null;
    const enc = encounter || CL.content.encounter(encounterId);
    camp.lastResolvedBattle = battleId;
    camp.roster = camp.roster.filter((s) => !killed.includes(s.id));
    advanceDays(BATTLE_DAYS, camp);
    for (const s of camp.roster) if (wounded.includes(s.id)) s.woundedUntil = camp.day + CL.save.WOUND_DAYS;
    camp.battles++;
    CL.upkeep.onBattle(camp, win);
    const result = { gold: 0, renown: 0, loot: {}, lostItem: null, xp: awardXp(camp, outcome) };
    if (win) {
      result.gold = enc.reward.goldBase + kills * enc.reward.goldPerKill;
      result.renown = enc.reward.renown;
      result.loot = rollLoot(enc, kills, camp);
      camp.victories++;
      camp.gold += result.gold;
      camp.renown += result.renown;
      for (const [id, n] of Object.entries(result.loot)) camp.inventory[id] = (camp.inventory[id] || 0) + n;
      CL.upkeep.stowFood(camp); // looted food goes into the ration stock
    } else {
      const kept = Math.floor(camp.gold * DEFEAT_GOLD_KEPT);
      result.gold = kept - camp.gold;
      camp.gold = kept;
      result.lostItem = loseItemOnCapture(camp);
    }
    const g = CL.game;
    const band = g.partyId != null ? CL.parties?.find(camp, g.partyId) : null;
    CL.story?.emit('battle', { win, encounter: enc.id, site: g.siteId || null, party: band?.template || null, tag: band?.questTag || null, contract: Boolean(band?.contractId) }, camp);
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
    if (g.practice) return endPractice(win);
    const { killed, wounded } = rollCasualties(g.allies);
    const deployed = g.allies.filter((a) => a.soldierId != null);
    const outcome = {
      battleId: g.battleId,
      encounter: g.encounterDef,
      win,
      kills: g.kills,
      killed,
      wounded,
      participants: deployed.map((a) => a.soldierId),
      soldierKills: Object.fromEntries(deployed.map((a) => [a.soldierId, a.kills || 0])),
      soldierAssists: Object.fromEntries(deployed.map((a) => [a.soldierId, a.assists || 0])),
    };
    const names = rosterNames(CL.campaign); // before the fallen leave the roster
    // The one commit path (V2-02): result, companion, map, band, events and the save, exactly once.
    const r = /** @type {BattleResult | null} */ (
      CL.encounter.resolve(CL.campaign, {
        kind: 'battle',
        outcome,
        companionDown: g.allies.some((a) => a.companion && !a.alive),
        fallenEnemies: g.enemies.filter((e) => !e.alive).map((e) => e.troop),
      })
    );
    const html = resultHtml({
      win,
      r,
      kills: g.kills,
      killed,
      wounded,
      survivors: g.allies.filter((u) => u.alive).length,
      waves: `${g.wave}/${g.totalWaves}`,
      names,
    });
    g.result = { win, html, ...r };
    CL.diag.log('info', 'Battle ended', { ...outcome, result: r, day: CL.campaign.day });
    CL.ui.changeMode('result');
  }

  /** A stress test is over: report how it ran; nothing in the campaign changes and nothing is saved. */
  function endPractice(win) {
    const g = CL.game;
    const p = g.practice;
    const secs = Math.max(0.001, (performance.now() - p.started) / 1000);
    const avg = (x) => (p.frames ? x / p.frames : 0).toFixed(1);
    const stats = {
      cap: CL.combat.BATTLE.activeCap,
      peak: p.peak,
      seconds: Number(secs.toFixed(1)),
      fps: Math.round(p.frames / secs),
      simMs: Number(avg(p.sim)),
      drawMs: Number(avg(p.draw)),
      worstFrameMs: Math.round(p.worst),
    };
    const html = [
      `<strong>${stats.fps} fps average over ${stats.seconds} s</strong>`,
      `Up to ${stats.peak} units on the field (battle size ${stats.cap})`,
      `Per frame: simulation ${stats.simMs} ms · drawing ${stats.drawMs} ms`,
      `Slowest frame: ${stats.worstFrameMs} ms`,
      'Nothing in your campaign changed.',
    ].join('<br>');
    g.result = { win, practice: stats, html };
    CL.diag.log('info', 'Stress battle', stats);
    CL.ui.changeMode('result');
  }

  /** Soldier names by ID (V2-03), for result screens. @param {Campaign} camp @returns {Record<number, string>} */
  const rosterNames = (camp) => Object.fromEntries(camp.roster.map((s) => [s.id, s.name]));

  /** @param {string} text */
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

  /**
   * Result screen text for a fought or auto-resolved battle. Only numbers and data names are interpolated.
   * @param {{ win: boolean, r: BattleResult | null, kills: number, killed: number[], wounded: number[],
   *   survivors: number, waves?: string, auto?: { pp: number, pe: number }, names?: Record<number, string> }} info
   *   names: soldier names by ID, taken before the battle (soldiers can be renamed, so they are escaped)
   */
  function resultHtml({ win, r, kills, killed, wounded, survivors, waves, auto, names }) {
    const recoverDay = dayNumber(CL.campaign.day + CL.save.WOUND_DAYS);
    const lines = [
      `<strong>${win ? `+${r.gold} crowns · +${r.renown} renown` : `${-r.gold} crowns lost (20%)`}</strong>`,
    ];
    if (auto) {
      const odds = Math.round(CL.autoresolve.winChance(auto.pp, auto.pe) * 100);
      lines.push(`Auto-resolved: your strength ${auto.pp.toFixed(1)} vs ${auto.pe.toFixed(1)} (${odds}% odds)`);
    }
    lines.push(`Enemies defeated: ${kills}`, `Killed: ${killed.length} · Wounded: ${wounded.length}`);
    const who = (ids) => ids.map((id) => escapeHtml(names?.[id] || '')).filter(Boolean).join(', ');
    if (who(killed)) lines.push(`Fallen: ${who(killed)}`);
    if (who(wounded)) lines.push(`Wounded: ${who(wounded)}`);
    lines.push(`Survivors: ${survivors}${waves ? ` · Battle waves reached: ${waves}` : ''}`);
    if (r.xp) {
      const lv = r.xp.levels ? ` · <strong>Level up! Now level ${CL.campaign.character.level}</strong>` : '';
      const ready = r.xp.ready ? ` · ${r.xp.ready} soldier${r.xp.ready === 1 ? '' : 's'} ready to upgrade` : '';
      lines.push(`+${r.xp.heroXp} XP${lv}${r.xp.troopXp ? ` · troops +${r.xp.troopXp} XP` : ''}${ready}`);
    }
    if (win) lines.push(`Loot: ${describeItems(r.loot) || 'nothing of value'}`);
    else if (r.lostItem) lines.push(`Taken by your captors: ${CL.content.item(r.lostItem).name}`);
    lines.push(
      wounded.length
        ? `<small>Wounded soldiers can't fight until day ${recoverDay}. Travel or rest in a settlement to pass the time.</small>`
        : '<small>No soldiers wounded.</small>',
    );
    return lines.join('<br>');
  }

  CL.party = {
    UPGRADE_XP,
    XP,
    partyCap,
    upgradeOptions,
    readyFor,
    upgrade,
    soldierUpgrades,
    upgradeSoldier,
    awardXp,
    resultHtml,
    rosterNames,
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
