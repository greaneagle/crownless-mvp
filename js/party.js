/* Crownless party/campaign operations: recruiting, battle results, recovery. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RECRUIT_PRICE = { infantry: 20, archer: 25 };
  const PARTY_CAP = 15;
  const DEATH_CHANCE = 0.35; // otherwise wounded
  const VICTORY_RENOWN = 4;
  const DEFEAT_GOLD_KEPT = 0.8;
  const WOUNDED_KEY = { infantry: 'woundedInfantry', archer: 'woundedArcher' };

  const victoryGold = (kills) => 52 + kills * 3;
  const partySize = (c) => c.infantry + c.archer;
  const canRecruit = (c, role) => c.gold >= RECRUIT_PRICE[role] && partySize(c) < PARTY_CAP;

  function recruit(role) {
    const c = CL.campaign;
    const price = RECRUIT_PRICE[role];
    if (!canRecruit(c, role)) return;
    c.gold -= price;
    c[role]++;
    CL.save.write();
    CL.ui.refreshRoster();
    CL.diag.log('info', 'Soldier recruited', { role, cost: price });
  }

  /** Roll each fallen ally as killed or wounded. */
  function rollCasualties(allies) {
    const lost = { infantry: 0, archer: 0 };
    const wounded = { infantry: 0, archer: 0 };
    for (const a of allies) {
      if (a.alive) continue;
      if (Math.random() < DEATH_CHANCE) lost[a.role]++;
      else wounded[a.role]++;
    }
    return { lost, wounded };
  }

  /** Apply casualties and rewards to a campaign object (mutates it). */
  function applyBattleResult(c, win, kills, lost, wounded) {
    for (const k of ['infantry', 'archer']) {
      c[k] = Math.max(0, c[k] - lost[k] - wounded[k]);
      c[WOUNDED_KEY[k]] += wounded[k];
    }
    c.battles++;
    if (win) {
      c.victories++;
      c.renown += VICTORY_RENOWN;
      c.gold += victoryGold(kills);
    } else {
      c.gold = Math.max(0, Math.floor(c.gold * DEFEAT_GOLD_KEPT));
    }
  }

  function endBattle(win) {
    const g = CL.game;
    if (g.mode !== 'battle') return;
    g.mode = 'result';
    const { lost, wounded } = rollCasualties(g.allies);
    applyBattleResult(CL.campaign, win, g.kills, lost, wounded);
    CL.save.write();
    const casualties = `Killed: ${lost.infantry + lost.archer} · Wounded: ${wounded.infantry + wounded.archer}`;
    const reward = win ? `+${victoryGold(g.kills)} crowns · +${VICTORY_RENOWN} renown` : '20% crowns lost';
    g.result = {
      win,
      html:
        `<strong>${reward}</strong><br>Enemies defeated: ${g.kills}<br>${casualties}<br>` +
        `Survivors: ${g.allies.filter((u) => u.alive).length} · Battle waves reached: ${g.wave}/2<br>` +
        '<small>Wounded soldiers are recovering and currently unavailable. Returning to camp recovers them.</small>',
    };
    CL.diag.log('info', 'Battle ended', { win, lost, wounded, campaign: CL.campaign });
    CL.ui.changeMode('result');
  }

  /** Return all wounded troops to active duty. */
  function recover() {
    const c = CL.campaign;
    for (const k of ['infantry', 'archer']) {
      c[k] += c[WOUNDED_KEY[k]];
      c[WOUNDED_KEY[k]] = 0;
    }
    CL.save.write();
  }

  CL.party = {
    RECRUIT_PRICE,
    PARTY_CAP,
    canRecruit,
    recruit,
    rollCasualties,
    applyBattleResult,
    endBattle,
    recover,
  };
})(typeof window !== 'undefined' ? window : globalThis);
