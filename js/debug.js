/* Crownless debug tools: testing shortcuts behind the "Debug" button (next to Logs).
 * Every action is logged to diagnostics as "Debug: …" so exported reports show it, then saved. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const MAX_GOLD = 99999;
  const log = (action, data) => CL.diag.log('warn', `Debug: ${action}`, data);
  const c = () => CL.campaign;

  function addGold(n) {
    c().gold = Math.max(0, Math.min(MAX_GOLD, c().gold + n));
    log('gold', { change: n, gold: c().gold });
  }

  /** Adds soldiers even past the party cap — it's a test tool. */
  function addSoldiers(troopId, n = 1) {
    CL.content.troop(troopId); // throws on unknown ids
    for (let i = 0; i < n; i++) CL.save.addSoldier(c(), troopId);
    log('soldiers', { troop: troopId, added: n, total: c().roster.length });
  }

  function healAll() {
    let n = 0;
    for (const s of c().roster) {
      if (s.woundedUntil !== null) {
        s.woundedUntil = null;
        n++;
      }
    }
    log('heal', { healed: n });
  }

  function dismissAll() {
    log('dismiss', { removed: c().roster.length });
    c().roster = [];
  }

  function addItem(itemId, n = 1) {
    CL.content.item(itemId);
    c().inventory[itemId] = (c().inventory[itemId] || 0) + n;
    CL.upkeep.stowFood(c());
    log('item', { item: itemId, added: n });
  }

  function addFood(n) {
    c().food = Math.max(0, c().food + n);
    log('food', { change: n, food: c().food });
  }

  function addMorale(n) {
    CL.upkeep.changeMorale(c(), n);
    log('morale', { change: n, morale: c().morale });
  }

  /** Adjust an attribute (str/agi/int/cha) or a skill id by delta, within sane bounds. */
  function adjustStat(stat, delta) {
    const ch = c().character;
    if (!ch) return false;
    if (CL.character.ATTRIBUTES.includes(stat)) {
      ch.attributes[stat] = Math.max(1, Math.min(20, ch.attributes[stat] + delta));
    } else if (stat in ch.skills) {
      ch.skills[stat] = Math.max(0, Math.min(10, ch.skills[stat] + delta));
    } else return false;
    log('stat', { stat, delta });
    return true;
  }

  function toggleGod() {
    CL.game.godMode = !CL.game.godMode;
    log('god mode', { on: CL.game.godMode });
    return CL.game.godMode;
  }

  function passDays(n) {
    CL.party.advanceDays(n);
    log('days', { added: n, day: c().day });
  }

  function resetSites() {
    for (const s of Object.values(c().world.sites)) s.clearedUntil = 0;
    log('sites reset');
  }

  function teleport(settlementId) {
    const s = CL.content.get('settlements', settlementId);
    const w = c().world;
    Object.assign(w, { x: s.mapX, y: s.mapY, location: s.id });
    CL.game.travel = null;
    log('teleport', { to: s.id });
  }

  /** End the current battle immediately (through the normal, exactly-once result path). */
  function endBattleNow(win) {
    const g = CL.game;
    if (g.mode !== 'battle') return false;
    if (win) {
      for (const e of g.enemies) {
        if (e.alive) g.kills++; // credit the kills so rewards and loot match a real win
        e.alive = false;
      }
    }
    else {
      g.hero.alive = false;
      for (const a of g.allies) a.alive = false;
    }
    log(win ? 'win battle' : 'lose battle');
    CL.party.endBattle(win);
    return true;
  }

  function wipeSave() {
    for (const k of [CL.save.KEY, CL.save.BACKUP_KEY, CL.save.LEGACY_KEY]) root.localStorage.removeItem(k);
    log('save wiped');
  }

  // ---- Panel UI ----

  function fillSelect(sel, entries) {
    const el = document.querySelector(sel);
    if (el.options.length) return;
    for (const [value, label] of entries) el.append(new Option(label, value));
  }

  function populate() {
    fillSelect(
      '#cheatTroop',
      Object.values(CL.content.table('troops'))
        .filter((t) => t.id !== 'hero')
        .map((t) => [t.id, `${t.name} (${t.tier} ${t.role})`]),
    );
    fillSelect('#cheatItem', Object.values(CL.content.table('items')).map((i) => [i.id, i.name]));
    fillSelect('#cheatStat', [
      ...CL.character.ATTRIBUTES.map((a) => [a, CL.character.ATTRIBUTE_NAMES[a]]),
      ...Object.values(CL.content.table('skills')).map((s) => [s.id, `Skill: ${s.name}`]),
    ]);
    fillSelect('#cheatPlace', Object.values(CL.content.table('settlements')).map((s) => [s.id, s.name]));
    document.querySelector('#cheatGod').textContent = `God mode: ${CL.game.godMode ? 'on' : 'off'}`;
  }

  let wipeArmed = false;

  function run(btn) {
    const $ = CL.ui.$;
    const act = btn.dataset.cheat;
    const n = Number(btn.dataset.n || 1);
    const mode = CL.game.mode;
    switch (act) {
      case 'gold':
        addGold(n);
        break;
      case 'soldier':
        addSoldiers($('#cheatTroop').value, n);
        break;
      case 'heal':
        healAll();
        break;
      case 'dismiss':
        dismissAll();
        break;
      case 'item':
        addItem($('#cheatItem').value);
        break;
      case 'bandits': {
        const p = CL.parties.spawn(c(), 'bandits');
        [p.x, p.y] = [Math.min(98, c().world.x + 5), c().world.y];
        p.ignoreUntil = 0;
        log('bandits spawned', { id: p.id, troops: p.troops });
        break;
      }
      case 'clearParties':
        c().parties = [];
        for (const id of Object.keys(CL.content.table('party_templates'))) c().partySpawns[id] = c().day + 1;
        log('parties cleared');
        break;
      case 'repopulate':
        c().parties = [];
        c().partySpawns = {};
        CL.parties.ensure(c(), true);
        log('parties repopulated');
        break;
      case 'xp':
        CL.character.gainXp(n);
        log('hero xp', { added: n, level: c().character?.level });
        break;
      case 'troopxp':
        for (const s of c().roster) s.xp += n;
        log('troop xp', { added: n });
        break;
      case 'renown':
        c().renown += n;
        log('renown', { added: n, renown: c().renown });
        break;
      case 'contractDone': {
        const k = c().contract;
        const p = k && CL.parties.find(c(), k.partyId);
        if (!p) {
          CL.ui.message('No active contract target');
          return;
        }
        CL.contracts.onTargetDefeated(c(), p);
        CL.parties.remove(c(), p);
        log('contract target defeated', { id: k.id });
        break;
      }
      case 'contractOffers':
        c().contractOffers = {};
        log('contract offers refreshed');
        break;
      case 'cargo':
        for (const g of CL.trade.goods()) c().cargo[g.id] = (c().cargo[g.id] || 0) + 5;
        log('cargo', { added: 5 });
        break;
      case 'markets':
        c().markets = CL.trade.defaultMarkets();
        log('markets reset');
        break;
      case 'food':
        addFood(n);
        break;
      case 'morale':
        addMorale(n);
        break;
      case 'wages':
        CL.upkeep.payWages(c());
        c().nextWagesDay = Math.floor(c().day) + CL.upkeep.WAGE_INTERVAL;
        break;
      case 'stat':
        if (!adjustStat($('#cheatStat').value, n)) CL.ui.message('Create a character first');
        break;
      case 'god':
        btn.textContent = `God mode: ${toggleGod() ? 'on' : 'off'}`;
        return;
      case 'days':
        passDays(n);
        break;
      case 'sites':
        resetSites();
        break;
      case 'teleport':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        teleport($('#cheatPlace').value);
        CL.save.write();
        CL.ui.changeMode('settlement');
        return;
      case 'win':
      case 'lose':
        if (!endBattleNow(act === 'win')) CL.ui.message('Not in a battle');
        toggle(false);
        return;
      case 'wipe':
        if (!wipeArmed) {
          wipeArmed = true;
          btn.textContent = 'Really wipe? Press again';
          return;
        }
        wipeSave();
        root.location.reload();
        return;
    }
    if (mode !== 'battle') CL.save.write();
    CL.ui.refresh();
    CL.ui.message(`Debug: ${btn.textContent}`);
  }

  function toggle(show) {
    const panel = document.querySelector('#cheatPanel');
    const open = show ?? panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    if (open) populate();
    wipeArmed = false;
    document.querySelector('#cheatWipe').textContent = 'Wipe save…';
  }

  function bind() {
    document.querySelector('#cheatBtn').onclick = () => toggle();
    document.querySelector('#closeCheats').onclick = () => toggle(false);
    for (const b of document.querySelectorAll('[data-cheat]')) b.onclick = () => run(b);
  }

  CL.debugTools = {
    addGold,
    addSoldiers,
    healAll,
    dismissAll,
    addItem,
    addFood,
    addMorale,
    adjustStat,
    toggleGod,
    passDays,
    resetSites,
    teleport,
    endBattleNow,
    wipeSave,
    toggle,
    bind,
  };
})(typeof window !== 'undefined' ? window : globalThis);
