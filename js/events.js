// @ts-check
/* Crownless domain events (V2-02, design §24.3): a small dispatcher, not an event-sourcing framework.
 *
 * Game code emits an event once per state transition, inside the transaction that made the change;
 * other systems listen instead of being wired into that code (named soldiers' service records, the
 * chronicle and quests will all listen to the same events). Each event gets an ID unique within the
 * campaign (`c.nextEventId`, saved), the campaign day, and its own data.
 *
 *   BattleResolved     { resultId, battleId, kind: 'battle' | 'auto', encounter, encounterName, win, kills,
 *                        killed, wounded, participants, soldierKills, soldierAssists, enemyTroops }
 *   EncounterResolved  { resultId, kind: 'battle' | 'auto' | 'retreat' | 'parley', win?, outcome? }
 *   SoldierRecruited   { soldierId, troop, settlement, via: 'hire' | 'story' }
 *   SoldierPromoted    { soldierId, from, to, cost }
 *   SoldierWounded     { soldierId, troop, until, resultId, encounterName }
 *   SoldierKilled      { soldierId, troop, resultId }
 *   SoldierDeserted    { soldierId, troop, morale }
 *   WagesPaid          { owed, paid, shares: { soldierId: crowns } }  (shares add up to paid)
 *
 * Listeners are called as fn(event, campaign), synchronously, in the order they were added. A
 * listener that throws is logged and skipped, so it can never undo or block the change that emitted the event. Listeners are not
 * saved; modules add theirs when they load. The last few events are kept in memory for diagnostics. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TYPES = ['BattleResolved', 'EncounterResolved', 'SoldierRecruited', 'SoldierPromoted', 'SoldierWounded', 'SoldierKilled', 'SoldierDeserted', 'WagesPaid', 'ReinforcementsArrived'];
  const RECENT = 50;

  /** @type {Record<string, Array<(e: GameEvent, c: Campaign) => void>>} */
  const listeners = {};
  /** @type {GameEvent[]} */
  const recent = [];

  /**
   * Listen for one event type. Returns a function that stops listening.
   * @param {string} type @param {(e: GameEvent, c: Campaign) => void} fn @returns {() => void}
   */
  function on(type, fn) {
    if (!TYPES.includes(type)) throw new Error(`Unknown event type: ${type}`);
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
    return () => {
      const list = listeners[type];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  /**
   * Record that something happened, with a new event ID, and tell the listeners.
   * @param {Campaign} c @param {string} type @param {Record<string, unknown>} [data] @returns {GameEvent}
   */
  function emit(c, type, data = {}) {
    if (!TYPES.includes(type)) throw new Error(`Unknown event type: ${type}`);
    if (!Number.isInteger(c.nextEventId) || c.nextEventId < 1) c.nextEventId = 1;
    /** @type {GameEvent} */
    const e = { ...data, id: c.nextEventId++, type, day: c.day };
    recent.push(e);
    if (recent.length > RECENT) recent.shift();
    for (const fn of [...(listeners[type] || [])]) {
      try {
        fn(e, c);
      } catch (err) {
        CL.diag.log('error', 'Event listener failed', { type, id: e.id, error: String(err) });
      }
    }
    return e;
  }

  CL.events = { TYPES, on, emit, recent };
})(typeof window !== 'undefined' ? window : globalThis);
