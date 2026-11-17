// One result path, domain events and named random streams (V2-02; design §24.3–24.5, §24.8).
// Every way an encounter ends commits once through CL.encounter.resolve; repeats change nothing;
// events carry unique IDs; and campaign outcomes replay the same from the same save.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

/** The player on open grass with a Reaver band beside them, its encounter opened as the map would. */
function bandEncounter(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 5, reaver: 2 }, tx: null, ty: null });
  CL.parties.open(p.id);
  return { ...env, c, p };
}

/** Game values come from the test sandbox's realm; compare them as plain JSON. */
const plain = (x) => JSON.parse(JSON.stringify(x));

/** Everything a commit could change, for "nothing happened" checks. */
const snapshot = (CL) => JSON.stringify({ c: CL.campaign, events: CL.events.recent.length });

test('a fought battle commits once: a repeated commit of the same result changes nothing', () => {
  const { CL, c } = bandEncounter({ random: () => 0.99 });
  const id = CL.game.resultId;
  assert.equal(id, c.nextResultId, 'opening the encounter gave it the next result ID');
  CL.parties.attack();
  assert.equal(CL.game.resultId, id, 'the battle keeps the encounter’s ID');
  CL.party.endBattle(true);
  assert.equal(c.nextResultId, id + 1);
  assert.equal(c.battles, 1);
  const before = snapshot(CL);
  // A stray callback replays the same commit.
  const again = CL.encounter.resolve(c, { kind: 'battle', resultId: id, outcome: { battleId: 1, encounter: CL.game.encounterDef, win: true, kills: 7, killed: [], wounded: [] } });
  assert.equal(again, null);
  assert.equal(snapshot(CL), before);
  assert.ok(CL.diag.events.some((e) => e.msg === 'Encounter result ignored (already applied)'));
});

test('auto-resolve tapped twice: one result, and the second tap draws no random numbers', () => {
  const { CL, c } = bandEncounter();
  for (let i = 0; i < 4; i++) CL.save.addSoldier(c, 'footman');
  const r = CL.parties.autoResolve();
  assert.ok(r);
  const before = snapshot(CL);
  assert.equal(CL.parties.autoResolve(), null);
  assert.equal(snapshot(CL), before, 'no battle, no rolls, no save');
  assert.equal(c.battles, 1);
});

test('a successful retreat commits through the same path, once', () => {
  const { CL, c, p } = bandEncounter();
  c.rngSeed = 7;
  let seed = 1;
  for (; seed < 500; seed++) {
    c.rngSeed = seed;
    if (CL.autoresolve.next(c) < CL.parties.retreatChance(c, CL.parties.current())) break;
  }
  c.rngSeed = seed;
  const id = CL.game.resultId;
  assert.equal(CL.parties.retreat(), true);
  assert.equal(c.nextResultId, id + 1);
  assert.ok(p.ignoreUntil > c.day);
  const e = CL.events.recent.at(-1);
  assert.deepEqual([e.type, e.kind, e.resultId], ['EncounterResolved', 'retreat', id]);
  const before = snapshot(CL);
  assert.equal(CL.parties.retreat(), false, 'a second tap does nothing');
  assert.equal(snapshot(CL), before);
});

test('a failed retreat becomes a battle under the same result ID', () => {
  const { CL, c } = bandEncounter({ random: () => 0.99 });
  let seed = 1;
  for (; seed < 500; seed++) {
    c.rngSeed = seed;
    if (CL.autoresolve.next(c) >= CL.parties.retreatChance(c, CL.parties.current())) break;
  }
  c.rngSeed = seed;
  const id = CL.game.resultId;
  assert.equal(CL.parties.retreat(), false);
  assert.equal(CL.game.mode, 'battle');
  assert.equal(c.nextResultId, id, 'nothing committed yet');
  CL.party.endBattle(false);
  assert.equal(c.nextResultId, id + 1);
  const resolved = CL.events.recent.filter((e) => e.type === 'EncounterResolved');
  assert.deepEqual(plain(resolved.map((e) => [e.resultId, e.kind])), [[id, 'battle']]);
});

test('a toll is paid once, however often the button is pressed', () => {
  const { CL, c, p } = bandEncounter();
  c.roster = [];
  p.troops = { reaver: 12 };
  c.gold = 500;
  const n = CL.parties.negotiation(c, CL.parties.current());
  assert.equal(n.kind, 'toll');
  assert.equal(CL.parties.negotiate(), true);
  assert.equal(c.gold, 500 - n.cost);
  assert.equal(CL.parties.negotiate(), false);
  assert.equal(c.gold, 500 - n.cost);
  const e = CL.events.recent.filter((x) => x.type === 'EncounterResolved');
  assert.deepEqual(plain(e.map((x) => [x.kind, x.outcome])), [['parley', 'toll']]);
});

test('a new encounter after a commit gets the next ID, and a lost battle (capture) commits once', () => {
  const { CL, c } = bandEncounter({ random: () => 0.99 });
  CL.parties.attack();
  CL.party.endBattle(true);
  const first = c.nextResultId;
  CL.combat.startBattle('captains_trial'); // a fresh battle with no encounter screen
  assert.equal(CL.game.resultId, first);
  CL.party.endBattle(false);
  assert.equal(c.nextResultId, first + 1);
  assert.ok(CL.game.releasedAt, 'captured and released');
  const day = c.day;
  assert.equal(CL.encounter.resolve(c, { kind: 'battle', resultId: first, outcome: { battleId: 2, encounterId: 'captains_trial', win: false, kills: 0, killed: [], wounded: [] } }), null);
  assert.equal(c.day, day, 'no second captivity');
});

// ---- Events ----

test('a battle emits BattleResolved, then one event per soldier killed or wounded', () => {
  const { CL, c } = bandEncounter();
  for (let i = 0; i < 6; i++) CL.save.addSoldier(c, 'levy');
  CL.parties.attack();
  for (const a of CL.game.allies) if (a.soldierId != null) a.alive = false; // everyone deployed falls
  const fallen = CL.game.allies.filter((a) => a.soldierId != null).map((a) => a.soldierId);
  const troopOf = Object.fromEntries(c.roster.map((s) => [s.id, s.troop]));
  const seen = [];
  CL.events.on('BattleResolved', (e) => seen.push(e));
  CL.events.on('SoldierKilled', (e) => seen.push(e));
  CL.events.on('SoldierWounded', (e) => seen.push(e));
  CL.party.endBattle(true);
  const [battle, ...soldiers] = seen;
  assert.equal(battle.type, 'BattleResolved');
  assert.equal(battle.win, true);
  assert.deepEqual([...battle.killed, ...battle.wounded].sort(), [...fallen].sort());
  assert.deepEqual(soldiers.map((e) => e.soldierId).sort(), [...fallen].sort());
  for (const e of soldiers) {
    assert.equal(e.resultId, battle.resultId);
    if (e.type === 'SoldierWounded') assert.ok(e.until > c.day);
    assert.equal(e.troop, troopOf[e.soldierId]);
  }
});

test('event IDs are unique and keep counting across a save and a load', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  const c = CL.campaign;
  c.world.location = 'stonebridge';
  c.gold = 500;
  assert.ok(CL.party.recruit('levy'));
  assert.ok(CL.party.recruit('hunter'));
  const ids = CL.events.recent.map((e) => e.id);
  assert.deepEqual(plain(ids), [1, 2]);
  assert.deepEqual(
    plain(CL.events.recent.map((e) => [e.type, e.troop, e.via])),
    [
      ['SoldierRecruited', 'levy', 'hire'],
      ['SoldierRecruited', 'hunter', 'hire'],
    ],
  );
  CL.save.write();
  const back = loadGame({ storage });
  back.CL.campaign.world.location = 'stonebridge';
  back.CL.party.recruit('levy');
  assert.equal(back.CL.events.recent.at(-1).id, 3);
});

test('promotions and desertions are events too', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.gold = 500;
  const s = c.roster[0];
  s.xp = 100;
  assert.equal(CL.party.upgrade('levy', 'footman', 1), 1);
  const promoted = CL.events.recent.at(-1);
  assert.deepEqual([promoted.type, promoted.soldierId, promoted.from, promoted.to], ['SoldierPromoted', s.id, 'levy', 'footman']);
  c.morale = 0;
  let deserted = null;
  for (let i = 0; i < 50 && !deserted; i++) deserted = CL.upkeep.desertionCheck(c);
  assert.ok(deserted);
  assert.deepEqual([CL.events.recent.at(-1).type, CL.events.recent.at(-1).soldierId], ['SoldierDeserted', deserted.id]);
});

test('a listener that fails is logged and cannot undo or block the commit', () => {
  const { CL, c } = bandEncounter({ random: () => 0.99 });
  CL.events.on('BattleResolved', () => {
    throw new Error('broken listener');
  });
  let after = 0;
  CL.events.on('BattleResolved', () => after++);
  CL.parties.attack();
  CL.party.endBattle(true);
  assert.equal(c.victories, 1);
  assert.equal(after, 1, 'later listeners still run');
  assert.ok(CL.diag.events.some((e) => e.msg === 'Event listener failed'));
});

test('unknown event types are refused', () => {
  const { CL } = loadGame();
  assert.throws(() => CL.events.on('DragonSlain', () => {}), /Unknown event type/);
  assert.throws(() => CL.events.emit(CL.campaign, 'DragonSlain'), /Unknown event type/);
});

// ---- Named random streams: same save, same outcomes ----

test('from the same save, the same fight has the same casualties and loot', () => {
  const base = loadGame();
  for (let i = 0; i < 8; i++) base.CL.save.addSoldier(base.CL.campaign, 'levy');
  base.CL.save.write();
  const outcomes = [];
  for (let run = 0; run < 2; run++) {
    const { CL } = loadGame({ storage: memoryStorage({ ...base.storage.data }) });
    CL.combat.startBattle('captains_trial');
    for (const a of CL.game.allies) if (a.soldierId != null) a.alive = false;
    CL.game.kills = 6;
    CL.party.endBattle(true);
    const c = CL.campaign;
    outcomes.push(JSON.stringify({ roster: c.roster, inventory: c.inventory, rng: c.rng }));
  }
  assert.equal(outcomes[0], outcomes[1]);
});

test('the streams are independent: loot rolls never shift who dies', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const a = { ...c.rng };
  const first = CL.autoresolve.roll(c, 'casualties');
  c.rng = { ...a };
  for (let i = 0; i < 25; i++) CL.autoresolve.roll(c, 'loot');
  CL.autoresolve.roll(c, 'upkeep');
  assert.equal(CL.autoresolve.roll(c, 'casualties'), first);
  const world = c.rngSeed;
  CL.autoresolve.roll(c, 'loot');
  assert.equal(c.rngSeed, world, 'the world stream is untouched');
});

test('stream seeds come from the campaign seed and differ by name', () => {
  const { CL } = loadGame();
  const s = CL.autoresolve.streamSeeds(12345);
  assert.deepEqual({ ...s }, { ...CL.autoresolve.streamSeeds(12345) });
  assert.equal(new Set(Object.values(s)).size, CL.autoresolve.STREAMS.length);
  assert.notDeepEqual({ ...s }, { ...CL.autoresolve.streamSeeds(12346) });
});
