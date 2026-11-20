// Faction reputation and fort ownership (GDD §10 Reputation, §12 Territory; Gate D 4.6).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('three visible states from a hidden score: hostile below −25, friendly above +24', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const R = CL.realm;
  assert.deepEqual({ ...c.reputation }, { valedorn: 0, aurelian: 0, hrothmark: 0, vessaro: 0, merrow: 0 });
  for (const [score, st] of [
    [-26, 'hostile'],
    [-25, 'neutral'],
    [24, 'neutral'],
    [25, 'friendly'],
  ]) {
    c.reputation.valedorn = score;
    assert.equal(R.standing(c, 'valedorn'), st, `score ${score}`);
  }
  assert.equal(R.standing(c, 'neutral'), null, 'the Reavers are not a diplomatic faction');
  c.reputation.valedorn = 95;
  assert.equal(R.adjust(c, 'valedorn', 20), 100, 'clamped to 100');
  assert.equal(R.adjust(c, 'valedorn', -300), -100, 'clamped to −100');
});

test('a change of standing is announced', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  CL.realm.adjust(c, 'aurelian', -30);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Aurelian Remnant now treat you as an enemy/.test(x[1])));
});

test('Friendly status adds 2 party slots (GDD §5 faction_bonus)', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const base = CL.party.partyCap(c);
  c.reputation.aurelian = 30;
  assert.equal(CL.party.partyCap(c), base + 2);
  c.reputation.valedorn = 30;
  assert.equal(CL.party.partyCap(c), base + 2, 'not stacked per kingdom');
});

test('collecting a contract helps the giver’s kingdom by +10', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.food = 999;
  CL.contracts.accept(c, 'stonebridge');
  const p = CL.parties.find(c, c.contract.partyId);
  CL.contracts.onTargetDefeated(c, p);
  CL.parties.remove(c, p);
  CL.contracts.collect(c);
  assert.equal(c.reputation.valedorn, 10);
  assert.equal(c.reputation.aurelian, 0);
});

test('beating Road Reavers helps whoever holds the nearest settlement (+2)', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  const band = CL.parties.spawn(c, 'bandits');
  const ew = CL.content.get('settlements', 'eastwatch');
  Object.assign(c.world, { x: ew.mapX + 1, y: ew.mapY, location: null });
  CL.game.partyId = band.id;
  CL.game.siteId = null;
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  assert.equal(c.reputation.aurelian, 2);
  assert.equal(c.reputation.valedorn, 0);
});

test('attacking a patrol costs 15 reputation; a Hostile kingdom’s patrols hunt you', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const patrol = CL.parties.spawn(c, 'valedorn_patrol');
  CL.game.partyId = patrol.id;
  CL.game.siteId = null;
  let e = CL.parties.current(c);
  assert.equal(e.hostile, false);
  assert.equal(CL.parties.negotiation(c, e), null);
  CL.parties.attack();
  assert.equal(c.reputation.valedorn, -15);
  assert.equal(CL.game.mode, 'battle');
  assert.equal(CL.game.encounterDef.reward.renown, 6, 'GDD: patrol win +6 renown');

  c.reputation.valedorn = -40;
  CL.game.mode = 'map';
  e = CL.parties.current(c);
  assert.equal(e.hostile, true);
  assert.match(e.text, /Take them/);
  Object.assign(c.world, { x: patrol.x + 2, y: patrol.y, location: null });
  patrol.ignoreUntil = 0;
  assert.equal(CL.parties.wantsPlayer(c, patrol), true, 'hostile patrols give chase');
  c.reputation.valedorn = 0;
  assert.equal(CL.parties.wantsPlayer(c, patrol), false, 'neutral patrols leave you be');
});

test('attacking an already-hostile patrol costs nothing more', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.reputation.aurelian = -50;
  const patrol = CL.parties.spawn(c, 'aurelian_patrol');
  CL.game.partyId = patrol.id;
  CL.parties.attack();
  assert.equal(c.reputation.aurelian, -50);
});

test('Hostile owners refuse recruits and contracts; trade and rest stay open', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  assert.ok(CL.party.recruitsHere().length);
  assert.ok(CL.contracts.offerAt(c, 'stonebridge'));
  c.reputation.valedorn = -30;
  assert.deepEqual(Array.from(CL.party.recruitsHere()), []);
  assert.equal(CL.contracts.offerAt(c, 'stonebridge'), null);
  assert.ok(CL.trade.hasMarket('stonebridge'));
  assert.equal(CL.party.canRest(), true);
  assert.ok(CL.contracts.offerAt(c, 'eastwatch'), 'the other kingdom still deals with you');
});

test('Greywall can change hands: recruits, garrison, patrols and the owner list follow', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  const R = CL.realm;
  assert.equal(R.owner('greywall_fort', c), 'valedorn');
  assert.equal(R.setOwner(c, 'greywall_fort', 'valedorn'), false, 'already held');
  assert.equal(R.setOwner(c, 'stonebridge', 'aurelian'), false, 'only forts change hands');
  assert.equal(R.setOwner(c, 'greywall_fort', 'aurelian', 'test'), true);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Greywall Fort now flies the banner of the Aurelian Remnant/.test(x[1])));
  assert.equal(R.owner('greywall_fort', c), 'aurelian');
  assert.deepEqual({ ...R.garrison('greywall_fort', c) }, { spearman: 10, legionary: 4, skirmisher: 6, marksman: 2 });
  c.world.location = 'greywall_fort';
  assert.deepEqual(Array.from(CL.party.recruitsHere()), ['recruit', 'skirmisher']);
  assert.ok(R.holdings(c, 'aurelian').some((s) => s.id === 'greywall_fort'));
  assert.equal(R.holdings(c, 'valedorn').some((s) => s.id === 'greywall_fort'), false);
  // Valedorn patrols now muster somewhere Valedorn still holds.
  const p = CL.parties.spawn(c, 'valedorn_patrol');
  const home = CL.content.get('settlements', 'greywall_fort');
  assert.notDeepEqual([p.x, p.y], [home.mapX, home.mapY]);
  assert.equal(R.owner(R.holdings(c, 'valedorn')[0].id, c), 'valedorn');
});

test('reputation and holdings persist through save and reload, and bad values are rejected', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.reputation = { valedorn: 33, aurelian: -60 };
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian');
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.deepEqual({ ...s.reputation }, { valedorn: 33, aurelian: -60, hrothmark: 0, vessaro: 0, merrow: 0 });
  assert.equal(s.owners, undefined, 'owners became holdings (P8-02)');
  assert.deepEqual(JSON.parse(JSON.stringify(s.holdings)), JSON.parse(JSON.stringify(c.holdings)));
  assert.equal(CL.realm.owner('greywall_fort', s), 'aurelian');
  assert.equal(CL.realm.owner('ashgate_fort', s), 'aurelian');

  const junk = CL.save.sanitize({
    version: 2,
    roster: [],
    reputation: { valedorn: 'lots', aurelian: 900, neutral: 50, dragons: 5 },
    owners: { greywall_fort: 'neutral', ashgate_fort: 'dragons', stonebridge: 'aurelian' },
  });
  assert.deepEqual({ ...junk.reputation }, { valedorn: 0, aurelian: 100, hrothmark: 0, vessaro: 0, merrow: 0 });
  // Bad owners fall back to each settlement's own, and only a fort ever moved (W-05b, P8-02).
  for (const st of Object.values(CL.content.table('settlements'))) if (junk.holdings[st.id]) assert.equal(junk.holdings[st.id].controller, st.ownerFaction, st.id);
  const v19 = JSON.parse(JSON.stringify(c));
  v19.holdings.greywall_fort = { ...v19.holdings.greywall_fort, sovereign: 'dragons', holder: 'person:999', claims: [{ by: 'nobody', kind: 'old' }, 'x'] };
  v19.holdings.highmere.controller = 'valedorn'; // a village's controller is always its seat's
  const fixed = CL.save.sanitize(v19);
  assert.equal(fixed.holdings.greywall_fort.sovereign, 'valedorn', 'an unknown sovereign falls back to the data’s');
  assert.equal(fixed.holdings.greywall_fort.controller, 'aurelian', 'the gates are still Aurelia’s');
  assert.equal(fixed.holdings.greywall_fort.holder, fixed.people['person:2'] && 'person:2', 'a nobody as holder: the world data’s holder holds it');
  assert.equal(fixed.people['person:2'].key, 'hamon_greymantle');
  assert.equal(CL.save.fromRaw(v19).incompatible, true, 'loading refuses a kingdom it doesn’t have (SC-33)');
  assert.match(CL.save.fromRaw(v19).problems[0], /kingdoms this version of the game does not have: dragons \(at Greywall Fort\)/);
  assert.equal(fixed.holdings.highmere.controller, 'aurelian');
  assert.ok(fixed.holdings.greywall_fort.claims.every((k) => fixed.people[k.by]));

  const old = CL.save.sanitize({ version: 2, roster: [] });
  assert.deepEqual({ ...old.reputation }, { valedorn: 0, aurelian: 0, hrothmark: 0, vessaro: 0, merrow: 0 }, 'older saves start neutral');
});

test('captured heroes are released at a settlement that will have them', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.reputation.valedorn = -50;
  const sb = CL.content.get('settlements', 'stonebridge');
  Object.assign(c.world, { x: sb.mapX, y: sb.mapY, location: null });
  CL.world.onBattleResolved(false, null);
  assert.equal(CL.realm.owner(CL.game.releasedAt, c), 'aurelian');
});
