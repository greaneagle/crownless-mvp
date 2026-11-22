// P8-07 (slow): Prototype F, "the obedient and disobedient noble" (design §28), on the real campaign.
// A vassal of Valedorn at war besieges Castra Nova and gives two of the Crown's lords the same high-risk
// request: join the siege. Lady Avice (loyal, freed by you without ransom) obeys and rides to the camp;
// Lord Hamon (who guards his lands, two days off) refuses, and the reasons name the factors that decided
// it. You answer politically: freeing his sister, then asking again once his refusal has cooled, he
// names a price; paid once, he comes too.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('../helpers/load');

test('Prototype F: the same order, one obeys and one refuses, for reasons you can read and answer', () => {
  const { CL } = loadGame({ party: true });
  const c = CL.campaign;
  const N = CL.nobles;
  const id = (k) => Object.keys(c.people).find((x) => c.people[x].key === k);
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  Object.assign(c, { gold: 3000, food: 600, renown: 120 });
  // A company Lord Hamon respects: 60 (12 before 3.3.0). With the world's households three times the
  // data's (P9-B3), it takes five times the old company to stand as strong against his (the hero's own
  // share counts for less in bigger armies): about 1.4 times his household's power, as the 12 were.
  for (let i = 0; i < 60; i++) CL.save.addSoldier(c, i % 3 ? 'footman' : 'hunter');
  CL.story.state(c).flags.ending = 'valedorn'; // the sandbox after the story: Castra Nova may be besieged
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  // Your history with them: you once held Lady Avice and let her go without ransom.
  const avice = id('avice_westmere');
  const hamon = id('hamon_greymantle');
  CL.lords.beaten(c, CL.lords.partyOf(c, avice), 'player');
  c.prisoners.find((x) => x.lord === avice).offerDay = c.day;
  CL.lords.answer(c, avice, 'release');
  CL.lords.ensure(c, c.day, true);
  CL.lords.partyOf(c, avice).troops = CL.lords.troopsFor(c, avice); // some time ago: her household is whole again
  // At the gates of Castra Nova: your siege.
  const fort = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: fort.mapX, y: fort.mapY, location: 'castra_nova' });
  CL.game.mode = 'settlement';
  const s = CL.sieges.begin(c, 'castra_nova');
  assert.ok(s, 'the siege begins');
  // The same request to both.
  const a = N.ask(c, avice, 'siege');
  const h = N.ask(c, hamon, 'siege');
  assert.equal(a.answer, 'obey', a.line);
  assert.equal(h.answer, 'negotiate', h.line);
  assert.ok(h.price > 0, 'he names a price');
  assert.equal(h.words, `Lord Hamon Greymantle will, for ${h.price} crowns.`);
  // The reasons name what decided it: obligation, relationship, interest, fear.
  assert.match(a.line, /She is sworn to the same crown \(\+\)\./);
  assert.match(a.line, /She owes you for her freedom \(\+\)\./);
  assert.match(a.line, /She thinks well of you: you freed her without ransom on day \d+ \(\+\)\./);
  assert.match(a.line, /It is the Valedorn crown's war, and she is loyal \(\+\)\./);
  assert.match(h.line, /He is sworn to the same crown \(\+\)\./);
  assert.match(h.line, /He owes you nothing\./);
  assert.match(h.line, /Castra Nova is 2 days from his lands, and he guards his lands \(−\)\./);
  // Avice rides to the camp and stands in the siege.
  assert.ok(s.lords.includes(avice));
  assert.equal(s.lords.includes(hamon), false, 'not without his price');
  const before = CL.sieges.attack(c, s);
  for (let i = 0; i < 48 && CL.sieges.at(c, 'castra_nova'); i++) {
    CL.party.advanceDays(1 / 24);
    CL.game.contactParty = null;
  }
  const still = CL.sieges.at(c, 'castra_nova');
  assert.ok(still, 'the siege holds two days');
  assert.ok(CL.sieges.attack(c, still) > before, 'her household adds to the siege');
  // Answering Hamon politically: you free his sister, whom you hold; asked again, his price falls.
  const hawise = id('hawise_greymantle');
  CL.lords.beaten(c, CL.lords.partyOf(c, hawise), 'player');
  c.prisoners.find((x) => x.lord === hawise).offerDay = c.day;
  const was = N.opinion(c, hamon, 'player');
  CL.lords.answer(c, hawise, 'release');
  assert.equal(N.askable(c, hamon).siege.ok, false, 'asked lately: not yet');
  assert.equal(N.opinion(c, hamon, 'player'), was + 10, 'his sister freed: he thinks better of you (half of what she does)');
  c.nobles.asks[hamon].until = c.day; // the cooldown out
  const again = N.ask(c, hamon, 'siege');
  assert.match(again.line, /He thinks well of you: you freed his kin on day \d+ \(\+\)\./);
  assert.ok(again.answer === 'obey' || (again.answer === 'negotiate' && again.price < h.price), again.line);
  if (again.answer === 'negotiate') {
    const gold = c.gold;
    assert.equal(N.pay(c, hamon).ok, true);
    assert.equal(c.gold, gold - again.price, 'paid once');
    assert.equal(N.pay(c, hamon), null);
  }
  assert.ok(CL.sieges.at(c, 'castra_nova').lords.includes(hamon), 'he comes');
  assert.deepEqual(JSON.parse(JSON.stringify(CL.realm.invariants(c))), []);
});
