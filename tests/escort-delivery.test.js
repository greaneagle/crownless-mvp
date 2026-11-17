// Escort and delivery contracts (GDD §4 repeatable work; Gate D 4.13). The bandit hunt is in contracts.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const S = (CL, id) => CL.content.get('settlements', id);

/** Travel on the real world map until arrival (or an encounter stops us). */
function travel(CL, sid) {
  const s = S(CL, sid);
  if (CL.game.mode !== 'map') CL.world.leaveSettlement();
  CL.world.travelTo({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY });
  for (let i = 0; i < 8000 && CL.game.travel && CL.game.mode === 'map'; i++) CL.world.update(0.05);
}

/** Point a posted offer at Oakford (a short, road-bound trip from Stonebridge) and take it. */
function take(CL, template, tweak = {}) {
  const c = CL.campaign;
  c.food = 999;
  const o = CL.contracts.offerAt(c, 'stonebridge', template);
  assert.ok(o, `${template} is posted`);
  const sb = S(CL, 'stonebridge');
  const of = S(CL, 'oakford');
  Object.assign(o, { to: 'oakford' }, template === 'escort' ? { x: (sb.mapX + of.mapX) / 2, y: (sb.mapY + of.mapY) / 2 } : {}, tweak);
  const r = CL.contracts.accept(c, 'stonebridge', template);
  assert.equal(r.ok, true, r.reason);
  return c.contract;
}

test('each town board posts all three kinds of work; escort and delivery name a destination', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  for (const sid of ['stonebridge', 'eastwatch']) {
    const offers = CL.contracts.offersAt(c, sid);
    assert.deepEqual(
      Array.from(offers.map((o) => o.template)),
      ['bandit_hunt', 'escort', 'delivery'],
    );
    for (const o of offers.filter((x) => x.template !== 'bandit_hunt')) {
      assert.notEqual(o.to, sid);
      assert.ok(CL.content.get('settlements', o.to));
    }
  }
  assert.deepEqual(Array.from(CL.contracts.offersAt(c, 'oakford')), [], 'villages have no board');
  // Rewards grow with distance.
  const esc = CL.contracts.offerAt(c, 'stonebridge', 'escort');
  const t = CL.content.get('contracts', 'escort');
  const a = S(CL, 'stonebridge');
  const b = S(CL, esc.to);
  assert.equal(esc.reward.gold, t.reward.goldBase + t.reward.goldPerLeague * Math.round(CL.world.mapDist(a.mapX, a.mapY, b.mapX, b.mapY)));
});

test('escort: the caravan rolls only while you ride with it, survives the ambush with you, and pays on arrival', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  const gold = c.gold;
  const k = take(CL, 'escort');
  const caravan = CL.parties.find(c, k.partyId);
  const ambush = CL.parties.find(c, k.ambushId);
  assert.equal(caravan.escortTo, 'oakford');
  assert.equal(ambush.ambush, true);
  assert.match(CL.contracts.summary(c), /escort to Oakford/);
  // Left behind, it waits.
  Object.assign(c.world, { x: 90, y: 10, location: null });
  CL.game.mode = 'map';
  // Riding up to it does not open an encounter.
  Object.assign(c.world, { x: caravan.x + 3, y: caravan.y });
  CL.world.travelTo({ type: 'party', id: caravan.id, x: caravan.x, y: caravan.y });
  for (let i = 0; i < 4000 && CL.game.travel; i++) CL.world.update(0.05);
  assert.equal(CL.game.mode, 'map');
  Object.assign(c.world, { x: 90, y: 10, location: null });
  const at = [caravan.x, caravan.y];
  CL.parties.tick(c, 6);
  assert.deepEqual([caravan.x, caravan.y], at, 'it does not roll without you');
  // Ride together from Stonebridge: the ambush springs on the road.
  Object.assign(c.world, { x: S(CL, 'stonebridge').mapX, y: S(CL, 'stonebridge').mapY, location: null });
  travel(CL, 'oakford');
  assert.equal(CL.game.mode, 'encounter');
  assert.equal(CL.game.partyId, ambush.id, 'the Reavers spring the ambush');
  assert.match(CL.parties.current().text, /caravan you are escorting/);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
  assert.equal(c.parties.includes(ambush), false);
  assert.equal(c.contract.status, 'active', 'the escort goes on');
  travel(CL, 'oakford');
  if (c.contract) {
    // The caravan is a little slower; wait for it at the gate.
    for (let i = 0; i < 200 && c.contract; i++) CL.party.advanceDays(0.02);
  }
  assert.equal(c.contract, null, 'paid and closed');
  assert.ok(c.gold > gold + k.reward.gold - 1, 'paid on arrival');
  assert.equal(c.contractsDone, 1);
  assert.equal(c.reputation.valedorn, 10 + 2, 'friendly reputation with the giver (+10), plus +2 for beating Reavers on its land');
  assert.equal(c.parties.includes(caravan), false, 'the caravan has gone its way');
});

test('escort: arriving without the caravan does not count; abandoning or running out of time cleans up', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  const k = take(CL, 'escort');
  c.world.location = null;
  Object.assign(c.world, { x: S(CL, 'oakford').mapX, y: S(CL, 'oakford').mapY });
  assert.equal(CL.contracts.onArrive(c, 'oakford'), null);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /caravan is not with you/.test(x[1])));
  c.renown = 10;
  CL.party.advanceDays(k.days + 0.1);
  assert.equal(c.contract, null);
  assert.equal(c.renown, 8);
  assert.equal(
    c.parties.some((p) => p.contractId === k.id),
    false,
    'caravan and ambush removed',
  );
});

test('escort parties stay out of off-screen fights and patrols leave the ambush be', () => {
  const { CL } = loadGame({ worldParties: true });
  const c = CL.campaign;
  const k = take(CL, 'escort');
  const caravan = CL.parties.find(c, k.partyId);
  const ambush = CL.parties.find(c, k.ambushId);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: caravan.x, y: caravan.y, troops: { reaver: 20 } });
  const patrol = CL.parties.spawn(c, 'valedorn_patrol');
  Object.assign(patrol, { x: ambush.x, y: ambush.y, troops: { guard: 20 } });
  c.world.location = 'stonebridge';
  CL.parties.tick(c, 1);
  assert.ok(c.parties.includes(caravan));
  assert.ok(c.parties.includes(ambush));
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.parties.find((p) => p.id === caravan.id).escortTo, 'oakford');
  assert.equal(s.parties.find((p) => p.id === ambush.id).ambush, true);
  assert.equal(s.contract.ambushId, ambush.id);
});

test('delivery of goods: a deposit up front, the load in your cargo, all paid back on delivery', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.gold = 500;
  const k = take(CL, 'delivery', { letter: undefined, good: 'salt', qty: 4, deposit: 4 * 12, reward: { gold: 60 + 48, renown: 2, xp: 30 } });
  assert.equal(c.gold, 500 - 48);
  assert.equal(c.cargo.salt, 4);
  assert.match(CL.contracts.summary(c), /deliver to Oakford/);
  // Sold some on the way? Then it can't be delivered until you have them again.
  c.cargo.salt = 2;
  assert.equal(CL.contracts.onArrive(c, 'oakford'), null);
  assert.equal(c.contract.status, 'active');
  c.cargo.salt = 4;
  travel(CL, 'oakford');
  assert.equal(c.contract, null);
  assert.equal(c.gold, 500 - 48 + k.reward.gold);
  assert.equal('salt' in c.cargo, false);
});

test('delivery of a letter: nothing to carry, paid on arrival; a deposit you cannot pay blocks a goods job', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const gold = c.gold;
  const k = take(CL, 'delivery', { letter: true, good: undefined, qty: undefined, deposit: undefined });
  travel(CL, 'oakford');
  assert.equal(c.contract, null);
  assert.equal(c.gold, gold + k.reward.gold);

  const { CL: CL2 } = loadGame();
  const c2 = CL2.campaign;
  const o = CL2.contracts.offerAt(c2, 'stonebridge', 'delivery');
  Object.assign(o, { letter: undefined, good: 'iron', qty: 5, deposit: 9999 });
  assert.match(CL2.contracts.accept(c2, 'stonebridge', 'delivery').reason, /deposit/);
});

test('taking one job leaves the others on the board until the next refresh; old single-offer saves load', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  take(CL, 'delivery', { letter: true });
  assert.equal(CL.contracts.offerAt(c, 'stonebridge', 'delivery'), null);
  assert.ok(CL.contracts.offerAt(c, 'stonebridge', 'bandit_hunt'));
  c.day += 3.1;
  assert.ok(CL.contracts.offerAt(c, 'stonebridge', 'delivery'), 'refilled');
  const old = CL.save.sanitize({ version: 2, roster: [], contractOffers: { stonebridge: { id: 7, template: 'bandit_hunt', giver: 'stonebridge', troops: { looter: 3 }, x: 40, y: 40, reward: { gold: 50, renown: 5, xp: 50 }, days: 4, offeredUntil: 2 } } });
  assert.equal(old.contractOffers.stonebridge.bandit_hunt.id, 7);
});
