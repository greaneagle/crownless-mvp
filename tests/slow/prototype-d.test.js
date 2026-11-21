// P8-08 (slow): Prototype D, "the dispossessed lord" (design §28.1, §17.6), on the real campaign, with
// the world's parties riding:
//   1. a sworn vassal of Valedorn holds Westholt Castle and its village Ashby, with a warband and a mill;
//   2. Hrothmark, at war, takes Westholt while you are at Stonebridge;
//   3. your remaining office goes (the Crown casts you out);
//   4. you play on as a landless captain for 15 days;
//   5. you serve, then swear to Aurelia, the enemy's enemy;
//   6. you besiege and retake Westholt: Aurelia backs your claim and it is yours again, Ashby too,
//      without any quest-specific reset.
// Every step's state is checked against the invariants; nothing is doubled (land, soldiers).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('../helpers/load');

test('Prototype D: lose the fort while away, lose the office, live landless, change crowns, retake it', () => {
  const { CL } = loadGame({ party: true, worldParties: true, seed: 3 });
  const c = CL.campaign;
  const R = CL.realm;
  const ok = (step) => assert.deepEqual(JSON.parse(JSON.stringify(R.invariants(c))), [], step);
  const holdings = Object.keys(c.holdings).length;
  const unique = (step) => assert.equal(new Set(c.roster.map((x) => x.id)).size, c.roster.length, `${step}: no soldier twice`);
  const hours = (n) => {
    for (let i = 0; i < n; i++) {
      c.food = Math.max(c.food, 60);
      CL.party.advanceDays(1 / 24);
      CL.game.contactParty = null;
    }
  };
  CL.game.mode = 'settlement';

  // 1. A fort and its village, a warband, a mill; the enemy gathers.
  const r = CL.claims.prototypeD(c);
  assert.equal(r.siege, 'westholt_castle');
  assert.equal(r.mill, 'ashby');
  const warband = c.roster.map((x) => x.id);
  ok('1');

  // 2. Westholt falls while you are at Stonebridge.
  for (let d = 0; d < 20 && R.holderOf('westholt_castle', c) === 'player'; d++) hours(24);
  assert.equal(R.owner('westholt_castle', c), 'hrothmark', 'taken');
  assert.deepEqual(JSON.parse(JSON.stringify(R.fiefsOf('player', c))), [], 'Ashby went with it');
  assert.ok(CL.claims.mine(c).some((x) => x.sid === 'westholt_castle'), 'a claim kept');
  assert.equal(CL.business.get(c)?.place, 'ashby', 'the mill is still yours');
  assert.ok(warband.every((id) => c.roster.some((x) => x.id === id)), 'the warband is still yours (it was elsewhere)');
  unique('2');
  ok('2');

  // 3. The remaining office: cast out by the Crown.
  CL.allegiance.expel(c, 'the Crown wants no landless vassal who lost its border fort');
  assert.equal(c.allegiance.kind, 'independent');
  assert.equal(CL.claims.mine(c).find((x) => x.sid === 'westholt_castle').claim.kind, 'old', 'the claim travels with you');
  ok('3');

  // 4. A landless captain for 15 days: the claims view, no chores; recruiting at Stonebridge.
  const card = CL.claims.card(c, 'westholt_castle');
  assert.match(card.lines[0], /^Westholt Castle \(fort\): held for the Valedorn Crown until it was taken on day \d+\.$/);
  for (let i = 0; i < 10; i++) CL.save.addSoldier(c, i % 2 ? 'footman' : 'hunter');
  for (let d = 0; d < 15; d++) hours(24);
  assert.equal(R.fiefsOf('player', c).length, 0);
  unique('4');
  ok('4');

  // 5. The enemy's enemy: Aurelia goes to war with Hrothmark; you serve them, then swear.
  R.setRelation(c, 'aurelian', 'hrothmark', 'war', 'test');
  R.adjust(c, 'aurelian', 40, 'test: you helped them');
  c.renown = Math.max(c.renown, 160);
  const cap = CL.content.get('settlements', R.capitalOf('aurelian'));
  Object.assign(c.world, { x: cap.mapX, y: cap.mapY, location: cap.id });
  assert.ok(CL.allegiance.act(c, 'serve', 'aurelian'), 'take service with Aurelia');
  for (let d = 0; d < 21; d++) hours(24);
  if (CL.allegiance.state(c).kind !== 'mercenary') CL.allegiance.act(c, 'serve', 'aurelian');
  Object.assign(c.world, { x: cap.mapX, y: cap.mapY, location: cap.id });
  const sworn = CL.allegiance.act(c, 'swear', 'aurelian');
  assert.ok(sworn, `swear to Aurelia: ${CL.rights.why(c, 'player', 'swear', 'aurelian')}`);
  assert.equal(CL.allegiance.sworn(c), 'aurelian');
  ok('5');

  // 6. Retake Westholt: besiege it, storm it (simulated) until it falls.
  R.setRelation(c, 'aurelian', 'hrothmark', 'war', 'test'); // still at war
  c.sieges = c.sieges.filter((x) => x.realm !== 'aurelian'); // Aurelia's lords' own siege elsewhere doesn't hold up yours
  const w = CL.content.get('settlements', 'westholt_castle');
  Object.assign(c.world, { x: w.mapX, y: w.mapY, location: 'westholt_castle' });
  CL.game.mode = 'settlement';
  for (let i = 0; i < 12; i++) CL.save.addSoldier(c, 'footman');
  const s = CL.sieges.begin(c, 'westholt_castle');
  assert.ok(s, `besiege: ${CL.rights.why(c, 'player', 'besiege', 'westholt_castle')}`);
  for (let d = 0; d < 20 && CL.sieges.at(c, 'westholt_castle'); d++) {
    hours(24);
    Object.assign(c.world, { x: w.mapX, y: w.mapY, location: 'westholt_castle' });
    if (CL.sieges.at(c, 'westholt_castle') && CL.sieges.odds(c, CL.sieges.at(c, 'westholt_castle')) > 0.5) CL.sieges.playerAssault(c);
  }
  assert.equal(R.owner('westholt_castle', c), 'aurelian', 'retaken for Aurelia');
  assert.equal(R.holderOf('westholt_castle', c), 'player', 'Aurelia backs your claim: it is yours again');
  assert.equal(R.holderOf('ashby', c), 'player', 'and the village you held');
  assert.equal(CL.claims.mine(c).some((x) => x.sid === 'westholt_castle'), false);
  assert.equal(Object.keys(c.holdings).length, holdings, 'no holding doubled');
  unique('6');
  ok('6');
});
