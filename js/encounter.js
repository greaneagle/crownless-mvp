// @ts-check
/* Crownless encounter results (V2-02, design §24.3–24.5): ONE commit path for every way an encounter
 * can end, applied exactly once.
 *
 *   battle   a fought battle (party.endBattle), win or loss; a loss is a capture
 *   auto     auto-resolve (parties.autoResolve)
 *   retreat  a successful retreat (a failed one becomes a battle with the same result ID)
 *   parley   a toll paid, or bandits intimidated (parties.negotiate)
 *
 * Each encounter gets a result ID when it opens (`begin`: the campaign's `nextResultId`, saved). The
 * commit (`resolve`) only goes through for that exact ID, then moves `nextResultId` on, so a repeated
 * or stale callback, a double click or a replayed result changes nothing. Inside the commit, in order:
 * the campaign result (party.applyBattleResult: casualties, time, rewards, XP), the companion, the
 * map (site cleared, or capture and release), the band, the events, then one save.
 *
 * State: c.nextResultId (saved); CL.game.resultId, the current encounter's ID (transient). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['battle', 'auto', 'retreat', 'parley'];

  /** Start an encounter: it will commit under this result ID. @param {Campaign} [c] @returns {number} */
  function begin(c = CL.campaign) {
    CL.game.resultId = c.nextResultId;
    return c.nextResultId;
  }

  /**
   * The current encounter's result ID. After a commit it stays the committed (now stale) ID, so a
   * repeated choice is refused; only `begin` (opening an encounter, starting a battle) moves it on.
   * With none at all (a fresh page), one is started. @param {Campaign} [c] @returns {number}
   */
  function currentId(c = CL.campaign) {
    return CL.game.resultId ?? begin(c);
  }

  /** Is the current encounter still waiting for its result? @param {Campaign} [c] */
  const isOpen = (c = CL.campaign) => currentId(c) === c.nextResultId;

  /** Start a new encounter unless one is already open (a failed retreat keeps its encounter). @param {Campaign} [c] */
  function beginIfClosed(c = CL.campaign) {
    return isOpen(c) ? CL.game.resultId : begin(c);
  }

  /**
   * Commit an encounter's outcome once. Returns the campaign result (for battles), `true` (for
   * retreat and parley), or null when this result was already applied or is stale.
   * @param {Campaign} c
   * @param {EncounterCommit} x
   * @returns {BattleResult | true | null}
   */
  function resolve(c, x) {
    if (!KINDS.includes(x.kind)) throw new Error(`Unknown encounter result kind: ${x.kind}`);
    const g = CL.game;
    const resultId = x.resultId ?? currentId(c);
    if (resultId !== c.nextResultId) {
      CL.diag.log('warn', 'Encounter result ignored (already applied)', { resultId, kind: x.kind, next: c.nextResultId });
      return null;
    }
    /** @type {BattleResult | true | null} */
    let r = true;
    if (x.kind === 'battle' || x.kind === 'auto') {
      const o = x.outcome;
      const troopOf = Object.fromEntries(c.roster.map((s) => [s.id, s.troop]));
      r = CL.party.applyBattleResult(c, o);
      if (!r) {
        CL.diag.log('warn', 'Battle result ignored (already applied)', { resultId, battleId: o.battleId });
        return null;
      }
      c.nextResultId = resultId + 1;
      CL.companion.afterBattle(c, { win: o.win, down: Boolean(x.companionDown) });
      CL.world.onBattleResolved(o.win, x.siteId ?? g.siteId);
      CL.parties.onBattleResolved(o.win, x.partyId ?? g.partyId, x.fallenEnemies || []);
      CL.events.emit(c, 'BattleResolved', {
        resultId,
        battleId: o.battleId,
        kind: x.kind,
        encounter: o.encounter?.id ?? o.encounterId ?? null,
        win: o.win,
        kills: o.kills,
        killed: [...o.killed],
        wounded: [...o.wounded],
      });
      for (const id of o.killed) CL.events.emit(c, 'SoldierKilled', { soldierId: id, troop: troopOf[id], resultId });
      for (const s of c.roster) {
        if (o.wounded.includes(s.id)) CL.events.emit(c, 'SoldierWounded', { soldierId: s.id, troop: s.troop, until: s.woundedUntil, resultId });
      }
    } else {
      c.nextResultId = resultId + 1;
      x.commit?.();
    }
    g.resultId = resultId; // now stale: a repeat of this choice is refused
    CL.events.emit(c, 'EncounterResolved', {
      resultId,
      kind: x.kind,
      ...(x.outcome ? { win: x.outcome.win } : {}),
      ...(x.detail ? { outcome: x.detail } : {}),
    });
    CL.save.write();
    CL.diag.log('info', 'Encounter resolved', { resultId, kind: x.kind });
    return r;
  }

  CL.encounter = { KINDS, begin, beginIfClosed, currentId, isOpen, resolve };
})(typeof window !== 'undefined' ? window : globalThis);
