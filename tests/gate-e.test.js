// Gate E acceptance (GDD §14: "complete core loop with no critical data loss or unavoidable
// progression blocker"; §15 "no … repeatable infinite-money exploit in basic QA"). Same-town trade
// round trips, gear resale and once-only quest rewards are covered in trade, items and story tests;
// these probes cover the paths added since: deliveries with deposits, contract pay, battle results.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const S = (CL, id) => CL.content.get('settlements', id);

test('a delivery is worth more delivered than stolen: selling the load and abandoning never beats doing the job', () => {
  for (const good of ['grain', 'salt', 'wool', 'iron', 'cloth', 'tools']) {
    const { CL } = loadGame();
    const c = CL.campaign;
    c.gold = 5000;
    const o = CL.contracts.offerAt(c, 'stonebridge', 'delivery');
    Object.assign(o, { to: 'oakford', letter: undefined, good, qty: 5, deposit: CL.content.get('markets', good).basePrice * 5 });
    o.reward = { ...o.reward, gold: 40 + o.deposit };
    // The thief: take the load, sell it where it fetches the most, abandon the job.
    assert.equal(CL.contracts.accept(c, 'stonebridge', 'delivery').ok, true);
    const before = c.gold + o.deposit; // gold before paying the deposit
    // Worst case for the game: the good at its dearest everywhere (scarcity cap 1.4). The pay used
    // here (40) is below the smallest real reward (20 + 2 per league, 12 leagues minimum).
    for (const sid of Object.keys(c.markets)) c.markets[sid][good] = CL.trade.SCARCITY.max;
    const best = Object.keys(c.markets).reduce((m, sid) => Math.max(m, CL.trade.quote(c, sid, good, 5, 'sell').total), 0);
    const thief = before - o.deposit + best;
    // The honest carrier: deposit back plus pay.
    const honest = before - o.deposit + o.reward.gold;
    assert.ok(thief < honest, `${good}: stealing ${thief} vs delivering ${honest}`);
    const renown = c.renown;
    CL.contracts.abandon(c);
    assert.ok(c.renown <= renown, 'abandoning never pays in renown');
  }
});

test('contract pay is collected once, even if collect is pressed twice or the game reloads in between', () => {
  const { CL, storage } = loadGame();
  const c = CL.campaign;
  c.food = 999;
  const o = CL.contracts.offerAt(c, 'stonebridge', 'delivery');
  Object.assign(o, { to: 'oakford', letter: true, good: undefined, qty: undefined, deposit: undefined });
  CL.contracts.accept(c, 'stonebridge', 'delivery');
  const gold = c.gold;
  c.world.location = 'oakford';
  CL.contracts.onArrive(c, 'oakford');
  const paid = c.gold - gold;
  assert.ok(paid > 0);
  assert.equal(CL.contracts.collect(c, true), null, 'nothing more to collect');
  CL.save.write();
  const again = loadGame({ storage });
  assert.equal(again.CL.campaign.gold, c.gold);
  assert.equal(again.CL.campaign.contract, null);
  assert.equal(again.CL.contracts.collect(again.CL.campaign, true), null);
});

test('a battle result is applied once: a second end-of-battle or a replayed result changes nothing', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.combat.startBattle({ id: 't', name: 'T', map: 'grass_field', waves: [{ looter: 2 }], reward: { goldBase: 30, goldPerKill: 3, renown: 2 }, loot: 'low' });
  CL.debugTools.endBattleNow(true);
  const after = { gold: c.gold, renown: c.renown, day: c.day, battles: c.battles };
  CL.party.endBattle(true); // a stray second call
  const replay = CL.party.applyBattleResult(c, { battleId: c.lastResolvedBattle, encounter: CL.game.encounterDef, win: true, kills: 2, killed: [], wounded: [] });
  assert.equal(replay, null);
  assert.deepEqual({ gold: c.gold, renown: c.renown, day: c.day, battles: c.battles }, after);
});

test('auto-resolving the same band twice is impossible: it is gone, and its reward was paid once', () => {
  const { CL } = loadGame({ random: () => 0.01 });
  const c = CL.campaign;
  for (const t of ['footman', 'footman', 'footman', 'hunter']) CL.save.addSoldier(c, t);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { troops: { looter: 2 } });
  const sb = S(CL, 'stonebridge');
  Object.assign(c.world, { x: sb.mapX + 5, y: sb.mapY, location: null });
  CL.parties.open(band.id);
  CL.parties.autoResolve();
  assert.equal(CL.game.result.win, true);
  const gold = c.gold;
  assert.equal(c.parties.includes(band), false);
  CL.game.partyId = band.id;
  assert.equal(CL.parties.current(), null, 'no encounter left to resolve');
  assert.equal(c.gold, gold);
});
