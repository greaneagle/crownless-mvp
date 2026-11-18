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
  // Ready = fit, with a path to take and the XP for it. A troop at max tier is never "ready" (finding F-1).
  const readyFor = (s) => s.woundedUntil === null && upgradeOptions(s.troop).length > 0 && s.xp >= (UPGRADE_XP[CL.content.troop(s.troop).tier] ?? Infinity);

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
      CL.accounts.spend(camp, opt.cost, 'training');
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
  /**
   * Retire a soldier from the company with honour (V2-10): they leave the roster for the roll of
   * honour. Not while a battle is on. Returns the soldier, or null. @param {Campaign} camp @param {number} soldierId
   */
  function retireSoldier(camp, soldierId) {
    const i = camp.roster.findIndex((x) => x.id === soldierId);
    if (i < 0 || CL.game.mode === 'battle') return null;
    const [s] = camp.roster.splice(i, 1);
    CL.events.emit(camp, 'SoldierRetired', { soldierId: s.id, troop: s.troop, soldier: s });
    CL.diag.log('info', 'Soldier retired', { id: s.id, troop: s.troop });
    return s;
  }

  function upgradeSoldier(camp, soldierId, toId) {
    const s = camp.roster.find((x) => x.id === soldierId);
    const opt = s && soldierUpgrades(s, camp).find((o) => o.to === toId);
    if (!opt?.can) return false;
    const from = s.troop;
    CL.accounts.spend(camp, opt.cost, 'training');
    s.xp -= opt.xp;
    s.troop = toId;
    CL.events.emit(camp, 'SoldierPromoted', { soldierId: s.id, from, to: toId, cost: opt.cost });
    CL.diag.log('info', 'Soldier upgraded', { id: s.id, from, to: toId, cost: opt.cost });
    return true;
  }

  /**
   * What "Upgrade all ready" would do (V2-03b, F-1), for the confirmation: every soldier with enough XP
   * takes their troop's first path, in the order they joined, while the crowns last. A troop with a
   * second path (Levy → Hunter) takes that one only from the soldier's card or the By type view.
   * @param {Campaign} [camp]
   * @returns {{ items: Array<{ soldierId: number, from: ContentId, to: ContentId, cost: number }>, total: number,
   *   wounded: number, unaffordable: number }}
   */
  function upgradeAllPlan(camp = c()) {
    const items = [];
    let total = 0;
    let wounded = 0;
    let unaffordable = 0;
    for (const s of camp.roster) {
      const o = upgradeOptions(s.troop)[0];
      if (!o || o.locked || s.xp < o.xp) continue; // max tier, or not enough XP yet
      if (s.woundedUntil !== null) wounded++;
      else if (total + o.cost > camp.gold) unaffordable++;
      else {
        items.push({ soldierId: s.id, from: s.troop, to: o.to, cost: o.cost });
        total += o.cost;
      }
    }
    return { items, total, wounded, unaffordable };
  }

  /**
   * Carry out "Upgrade all ready": the plan above, each soldier through the same per-soldier upgrade
   * (same cost, same events). Returns how many were upgraded and what it cost.
   * @param {Campaign} [camp] @returns {{ done: number, cost: number }}
   */
  function upgradeAll(camp = c()) {
    let done = 0;
    let cost = 0;
    for (const it of upgradeAllPlan(camp).items) {
      if (!upgradeSoldier(camp, it.soldierId, it.to)) continue;
      done++;
      cost += it.cost;
    }
    if (done) CL.diag.log('info', 'Upgraded all ready', { done, cost });
    return { done, cost };
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
    CL.accounts.spend(c(), price, `hiring a ${CL.content.troop(troopId).name}`);
    const s = CL.save.addSoldier(c(), troopId);
    CL.events.emit(c(), 'SoldierRecruited', { soldierId: s.id, troop: troopId, settlement: c().world.location, via: 'hire' });
    CL.save.write();
    CL.ui.refreshRoster();
    CL.diag.log('info', 'Soldier recruited', { troop: troopId, cost: price });
    CL.story.emit('recruit', { troop: troopId, settlement: c().world.location });
    return true;
  }

  /**
   * Advance the campaign clock; wounded soldiers whose time is up return to duty. Game code moves
   * time through CL.clock (js/clock.js), which calls this; tests and tools may call it directly.
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
    const healed = CL.clock.pass(c(), 'rest');
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
      if (a.alive || a.routed || a.soldierId == null) continue; // those who fled come back unhurt (V2-08b)
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
    const { battleId, encounterId, encounter, win, kills, killed, wounded, routed = 0 } = outcome;
    if (battleId <= camp.lastResolvedBattle) return null;
    const enc = encounter || CL.content.encounter(encounterId);
    camp.lastResolvedBattle = battleId;
    camp.roster = camp.roster.filter((s) => !killed.includes(s.id));
    CL.clock.pass(camp, 'battle'); // a fixed amount of overworld time per battle (V2-04)
    for (const s of camp.roster) if (wounded.includes(s.id)) s.woundedUntil = camp.day + CL.save.WOUND_DAYS;
    camp.battles++;
    CL.upkeep.onBattle(camp, win);
    const result = { gold: 0, renown: 0, loot: {}, lostItem: null, xp: awardXp(camp, outcome) };
    if (win) {
      // Enemies who fled (V2-08b) count as beaten but leave half the spoils of a kill, and no kill credit.
      const spoils = kills + Math.floor(routed / 2);
      result.gold = enc.reward.goldBase + spoils * enc.reward.goldPerKill;
      result.renown = enc.reward.renown;
      result.loot = rollLoot(enc, spoils, camp);
      camp.victories++;
      CL.accounts.earn(camp, result.gold, `spoils: ${enc.name}`);
      camp.renown += result.renown;
      for (const [id, n] of Object.entries(result.loot)) camp.inventory[id] = (camp.inventory[id] || 0) + n;
      CL.upkeep.stowFood(camp); // looted food goes into the ration stock
    } else {
      // Captors take a share of every account, the company chest included (V2-11).
      result.gold = -CL.accounts.seize(camp, DEFEAT_GOLD_KEPT, 'taken by captors');
      result.lostItem = loseItemOnCapture(camp);
    }
    const g = CL.game;
    const band = g.partyId != null ? CL.parties?.find(camp, g.partyId) : null;
    // V2-Q: whether it was fought in person, with which setup, and whether help rode in.
    CL.story?.emit('battle', { win, encounter: enc.id, site: g.siteId || null, party: band?.template || null, tag: band?.questTag || null, contract: Boolean(band?.contractId), fought: Boolean(outcome.fought), preset: outcome.fought ? outcome.preset || null : null, reinforced: Boolean(outcome.reinforced) }, camp);
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
      routed: g.routed || 0,
      fought: true,
      preset: g.prepPlan || null,
      reinforced: (g.joining || []).some((j) => j.side === 'ally' && j.arrived),
      killed,
      wounded,
      participants: deployed.map((a) => a.soldierId),
      soldierKills: Object.fromEntries(deployed.map((a) => [a.soldierId, a.kills || 0])),
      soldierAssists: Object.fromEntries(deployed.map((a) => [a.soldierId, a.assists || 0])),
    };
    const names = rosterNames(CL.campaign); // before the fallen leave the roster
    const joined = CL.reinforce.outcome(g); // parties that rode in (V2-09)
    // The band and every party that rode in stay put while the battle's hours pass on the map (§9.5).
    CL.reinforce.lock(g, [g.partyId, ...joined.filter((j) => j.arrived).map((j) => j.id)]);
    // The one commit path (V2-02): result, companion, map, band, events and the save, exactly once.
    let r;
    try {
      r = /** @type {BattleResult | null} */ (
      CL.encounter.resolve(CL.campaign, {
        kind: 'battle',
        reinforcements: joined,
        outcome,
        companionDown: g.allies.some((a) => a.companion && !a.alive),
        fallenEnemies: g.enemies.filter((e) => !e.alive && !e.routed).map((e) => e.troop), // those who fled live on
        enemyTroops: [...new Set(g.enemies.map((e) => e.troop))], // the troops that took the field
      })
      );
    } finally {
      g.lock = null;
    }
    const html = resultHtml({
      win,
      r,
      kills: g.kills,
      routed: g.routed || 0,
      fled: g.allyRouted || 0,
      helped: g.helpKills || 0,
      standouts: CL.chronicle.standouts(g, names),
      killed,
      wounded,
      survivors: g.allies.filter((u) => (u.alive || u.routed) && !u.outside).length,
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
    // The camera test (PROTO-A) also reports the arena and how long the armies took to meet.
    const big = CL.camera.scrolls(g);
    if (big) {
      const { w, h } = CL.camera.worldSize(g.battleMap);
      Object.assign(stats, { arena: `${w}×${h}`, contactS: p.firstHit == null ? null : Number(p.firstHit.toFixed(1)), firstDownS: p.firstDown == null ? null : Number(p.firstDown.toFixed(1)), battleS: Number(g.t.toFixed(1)) });
    }
    const html = [
      `<strong>${stats.fps} fps average over ${stats.seconds} s</strong>`,
      `Up to ${stats.peak} units on the field (battle size ${stats.cap})`,
      `Per frame: simulation ${stats.simMs} ms · drawing ${stats.drawMs} ms`,
      `Slowest frame: ${stats.worstFrameMs} ms`,
      ...(big ? [`Arena ${stats.arena}: first contact after ${stats.contactS ?? '–'} s, first fall after ${stats.firstDownS ?? '–'} s, battle ${stats.battleS} s of play`] : []),
      ...(g.joining?.length ? [`Parties that rode in: ${g.joining.filter((j) => j.arrived).map((j) => `${j.name} (${j.size}) at ${Math.round(j.arriveAt)} s`).join(', ') || 'none (the battle ended first)'}`] : []),
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
   * @param {{ win: boolean, r: BattleResult | null, kills: number, routed?: number, fled?: number, helped?: number, standouts?: string[], killed: number[], wounded: number[],
   *   survivors: number, waves?: string, auto?: { pp: number, pe: number, reasons?: string[] }, names?: Record<number, string> }} info
   *   names: soldier names by ID, taken before the battle (soldiers can be renamed, so they are escaped)
   */
  function resultHtml({ win, r, kills, routed = 0, fled = 0, helped = 0, standouts = [], killed, wounded, survivors, waves, auto, names }) {
    const recoverDay = dayNumber(CL.campaign.day + CL.save.WOUND_DAYS);
    const lines = [
      `<strong>${win ? `+${r.gold} crowns · +${r.renown} renown` : `${-r.gold} crowns lost (20%)`}</strong>`,
    ];
    if (auto) {
      const odds = Math.round(CL.autoresolve.winChance(auto.pp, auto.pe) * 100);
      lines.push(`Auto-resolved: your strength ${auto.pp.toFixed(1)} vs ${auto.pe.toFixed(1)} (${odds}% odds)`);
      // Why those odds (V2-07): strength part by part, from before the fight.
      if (auto.reasons?.length) lines.push(`<small>${auto.reasons.map(escapeHtml).join('<br>')}</small>`);
    }
    lines.push(`Enemies defeated: ${kills}${routed ? ` · ${routed} fled the field` : ''}${helped ? ` · ${helped} felled by those who came to help` : ''}`, `Killed: ${killed.length} · Wounded: ${wounded.length}${fled ? ` · ${fled} ran but came back` : ''}`);
    const who = (ids) => ids.map((id) => escapeHtml(names?.[id] || '')).filter(Boolean).join(', ');
    if (standouts.length) lines.push(`Who did what: ${standouts.map(escapeHtml).join(' · ')}`); // V2-10
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
    retireSoldier,
    upgradeAllPlan,
    upgradeAll,
    awardXp,
    resultHtml,
    rosterNames,
    currentSettlement,
    recruitsHere,
    canRest,
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
