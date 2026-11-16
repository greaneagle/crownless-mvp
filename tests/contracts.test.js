// Contracts (GDD §4 repeatable work; Gate C step 9): the bandit-hunt lifecycle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** Fixture campaign standing in Stonebridge with an accepted bandit hunt. */
function withContract(opts) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  c.food = 999;
  assert.equal(CL.contracts.accept(c, 'stonebridge').ok, true);
  const p = CL.parties.find(c, c.contract.partyId);
  return { ...env, c, p };
}

test('only settlements with a contracts board post offers; offers refresh every 3 days', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  assert.ok(CL.contracts.offerAt(c, 'stonebridge'));
  assert.ok(CL.contracts.offerAt(c, 'eastwatch'));
  assert.equal(CL.contracts.offerAt(c, 'oakford'), null);
  assert.equal(CL.contracts.offerAt(c, null), null);
  const o = CL.contracts.offerAt(c, 'stonebridge');
  assert.equal(CL.contracts.offerAt(c, 'stonebridge'), o, 'stable');
  c.day = 3.1;
  assert.notEqual(CL.contracts.offerAt(c, 'stonebridge').id, o.id, 'refreshed');
});

test('the target band is sized to the player and the reward scales with it', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const t = CL.content.get('contracts', 'bandit_hunt');
  for (let i = 0; i < 30; i++) {
    const troops = CL.contracts.rollTroops(c, t);
    const size = Object.values(troops).reduce((a, b) => a + b, 0);
    assert.ok(size >= t.minTroops && size <= t.maxTroops);
    assert.ok(CL.autoresolve.troopsPower(troops) >= 0.7 * CL.autoresolve.playerPower(c) || size === t.maxTroops);
  }
  const o = CL.contracts.offerAt(c, 'stonebridge');
  const size = Object.values(o.troops).reduce((a, b) => a + b, 0);
  assert.deepEqual({ ...o.reward }, { gold: 40 + 6 * size, renown: 5, xp: 40 + 5 * size });
});

test('accepting spawns the marked band at the offered camp; one contract at a time', () => {
  const { CL, c, p } = withContract();
  assert.equal(c.contract.status, 'active');
  assert.equal(c.contract.deadline, c.day + 4);
  assert.equal(p.contractId, c.contract.id);
  assert.deepEqual({ ...p.troops }, { ...c.contract.troops });
  assert.deepEqual([p.x, p.y], [c.contract.x, c.contract.y]);
  assert.equal('stonebridge' in c.contractOffers, false);
  assert.match(CL.contracts.accept(c, 'eastwatch').reason, /current contract/);
});

test('contract bands do not take a regular bandit slot', () => {
  const { CL } = loadGame({ worldParties: true });
  const c = CL.campaign;
  CL.contracts.accept(c, 'stonebridge');
  CL.parties.ensure(c);
  const bands = c.parties.filter((p) => p.template === 'bandits');
  assert.equal(bands.filter((p) => !p.contractId).length, 3);
  assert.equal(bands.filter((p) => p.contractId).length, 1);
});

test('the marked band keeps near its camp', () => {
  const { CL, c, p } = withContract();
  CL.world.leaveSettlement();
  c.world.location = 'stonebridge'; // keep the player out of reach
  for (let i = 0; i < 40; i++) CL.parties.tick(c, 1);
  assert.ok(CL.world.mapDist(p.x, p.y, c.contract.x, c.contract.y) <= 6);
});

test('beating the band in battle completes the contract; pay is collected at the giver', () => {
  const { CL, c, p } = withContract({ random: () => 0.99 });
  CL.game.partyId = p.id;
  CL.game.siteId = null;
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  assert.equal(c.contract.status, 'done');
  assert.equal(c.parties.includes(p), false);

  c.world.location = 'eastwatch';
  assert.equal(CL.contracts.collect(c), null, 'only at the giver');
  c.world.location = 'stonebridge';
  const gold = c.gold;
  const renown = c.renown;
  const reward = { ...c.contract.reward };
  const r = CL.contracts.collect(c);
  assert.equal(r.gold, reward.gold);
  assert.equal(c.gold, gold + reward.gold);
  assert.equal(c.renown, renown + reward.renown);
  assert.equal(c.contract, null);
  assert.equal(c.contractsDone, 1);
});

test('auto-resolving the band completes the contract too', () => {
  const { CL, c, p } = withContract();
  for (let i = 0; i < 10; i++) CL.save.addSoldier(c, 'guard');
  CL.game.partyId = p.id;
  CL.game.siteId = null;
  let seed = 1;
  for (; seed < 200; seed++) {
    c.rngSeed = seed;
    if (CL.autoresolve.next(c) < 0.9) break;
  }
  c.rngSeed = seed;
  const r = CL.parties.autoResolve();
  assert.equal(r.win, true);
  assert.equal(c.contract.status, 'done');
});

test('missing the deadline fails the contract: −2 renown, the band stays as an ordinary band', () => {
  const { CL, c, p } = withContract();
  c.renown = 10;
  CL.party.advanceDays(4.5);
  assert.equal(c.contract, null);
  assert.equal(c.renown, 8);
  assert.equal(c.parties.includes(p), true);
  assert.equal(p.contractId, undefined);
});

test('abandoning costs 2 renown; a finished contract cannot be abandoned', () => {
  const { CL, c } = withContract();
  c.renown = 1;
  assert.equal(CL.contracts.abandon(c), true);
  assert.equal(c.renown, 0);
  assert.equal(c.contract, null);
  assert.equal(CL.contracts.abandon(c), false);
});

test('a pyrrhic loss that wipes out the marked band still completes the contract', () => {
  const { CL, c, p } = withContract();
  p.troops = { looter: 1 };
  CL.game.partyId = p.id;
  CL.parties.onBattleResolved(false, p.id, ['looter']);
  assert.equal(c.parties.includes(p), false);
  assert.equal(c.contract.status, 'done', 'the band is broken');
});

test('GDD edge case: the target is destroyed off-screen — the contract is void, no penalty', () => {
  const { CL, c, p } = withContract();
  c.renown = 10;
  const patrol = CL.parties.spawn(c, 'valedorn_patrol');
  Object.assign(patrol, { x: p.x, y: p.y, troops: { guard: 20 } });
  p.troops = { looter: 1 };
  c.world.location = 'stonebridge';
  CL.parties.tick(c, 0.25);
  assert.equal(c.parties.includes(p), false);
  assert.equal(c.contract, null);
  assert.equal(c.renown, 10);
});

test('saved contracts are validated; a hunt whose band is gone is voided', () => {
  const { CL, c } = withContract();
  CL.save.write();
  const saved = JSON.parse(JSON.stringify(c));
  const s = CL.save.sanitize(saved);
  assert.equal(s.contract.status, 'active');
  assert.equal(s.contract.partyId, c.contract.partyId);

  saved.parties = saved.parties.filter((p) => p.id !== c.contract.partyId);
  assert.equal(CL.save.sanitize(saved).contract, null);

  const junk = CL.save.sanitize({ version: 2, roster: [], contract: { template: 'dragon_slaying', giver: 'stonebridge' }, contractOffers: { oakford: { id: 1 } } });
  assert.equal(junk.contract, null);
  assert.deepEqual({ ...junk.contractOffers }, {});
});
