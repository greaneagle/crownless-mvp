// P9-03 · Founding or taking a kingdom: a realm founded in play everywhere a data realm is, land held of
// no realm, declaring (the old crown's claim, its answer, war), recognition, a vassal sworn, a grant and
// a summons, the officers' policies and their alerts (SC-41: ten days of riding while ruling, no screen
// forced), an AI lord declaring, and the save step (v26 → v27).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FORT = 'westholt_castle'; // a Valedorn fort of the wider world, not the story's

function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  CL.crowns.ensure(c);
  CL.story.state(c).flags.ending = 'valedorn'; // the March's story over (D-W5)
  Object.assign(c, { gold: 2000, food: 400 });
  CL.game.mode = 'map';
  const messages = [];
  CL.ui.message = (t) => messages.push(t);
  return { ...env, c, F: CL.founding, R: CL.realm, D: CL.diplomacy, messages };
}
/** Test setup: Westholt is yours (held of Valedorn), and you may declare there. */
const holdFort = (CL, c) => {
  if (c.holdings[FORT].holder !== 'player') assert.ok(CL.realm.transfer(c, FORT, { holder: 'player', willing: true, reason: 'test' }));
  c.renown = 600;
  while (c.roster.length < 40) c.roster.push({ ...(c.roster[0] || { name: 'Test', troopId: 'levy', xp: 0 }), id: 9000 + c.roster.length });
};
const opinionOf = (CL, c, from, to, deed, n) => {
  for (let i = 0; i < n; i++) CL.nobles.note(c, from, to, deed, { kin: false });
};

test('declaring needs a fort of yours, 600 renown and 40 soldiers; then a realm everywhere a data realm is', () => {
  const { CL, c, F, R } = world();
  assert.match(CL.rights.may(c, 'player', 'declare', FORT).why, /not yours/);
  R.transfer(c, FORT, { holder: 'player', willing: true, reason: 'test' });
  c.renown = 100;
  assert.match(CL.rights.may(c, 'player', 'declare', FORT).why, /600 renown/);
  c.renown = 600;
  assert.match(CL.rights.may(c, 'player', 'declare', FORT).why, /40 soldiers/);
  holdFort(CL, c);
  assert.equal(CL.rights.may(c, 'player', 'declare', FORT).ok, true);
  const id = F.declare(c, 'player', FORT, { name: 'the Westmark' });
  assert.equal(id, 'r1');
  // Everywhere a data realm is: a kingdom and a realm, a ruler, a banner, a treasury, relations, news.
  assert.ok(R.isRealm(id) && R.isKingdom(id));
  assert.equal(R.rulerOf(id, c), 'player');
  assert.equal(R.rules('player', c), id);
  assert.equal(R.faction(id).name, 'The Westmark');
  assert.equal(R.faction(id).color, CL.content.table('realm_palette').banners.colors[0]);
  assert.deepEqual(plain(R.faction(id).recruits), plain(R.faction('valedorn').recruits), 'the troops of its land');
  assert.equal(R.capitalOf(id, c), FORT);
  assert.ok(CL.crowns.treasury(c, id) > 0);
  assert.equal(R.relation(c, id, 'valedorn'), 'peace');
  assert.equal(R.standing(c, id), 'friendly');
  assert.ok(c.news.events.some((e) => e.kind === 'realm_founded' && e.faction === id));
  for (const sid of [FORT, ...R.villagesOf(FORT, c)]) {
    assert.equal(c.holdings[sid].sovereign, id);
    assert.equal(c.holdings[sid].controller, id);
    assert.ok(c.holdings[sid].claims.some((k) => k.realm === 'valedorn'), `${sid}: the old crown's claim`);
  }
  assert.ok(R.holdingLine(FORT, c).length);
  assert.equal(c.allegiance.kind, 'independent');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('the old crown answers in 7 days: a ruler who thinks well of you accepts; one who doesn’t goes to war', () => {
  const a = world();
  holdFort(a.CL, a.c);
  opinionOf(a.CL, a.c, a.R.rulerOf('valedorn', a.c), 'player', 'helped', 3);
  const id = a.F.declare(a.c, 'player', FORT);
  assert.equal(a.F.recognises(a.c, 'valedorn', id), false, 'not yet');
  a.c.day += 7;
  a.F.weekly(a.c);
  assert.equal(a.F.recognises(a.c, 'valedorn', id), true);
  assert.notEqual(a.R.relation(a.c, 'valedorn', id), 'war');
  const b = world();
  holdFort(b.CL, b.c);
  const id2 = b.F.declare(b.c, 'player', FORT);
  assert.ok(b.CL.nobles.opinion(b.c, b.R.rulerOf('valedorn', b.c), 'player') < 0, 'a grievance');
  b.c.day += 7;
  b.F.weekly(b.c);
  assert.equal(b.R.relation(b.c, 'valedorn', id2), 'war');
  assert.match(b.messages.join(' '), /will not accept your realm: it is war/);
});

test('recognition: a realm whose ruler thinks well of you recognises you; one that doesn’t may besiege you as if at war', () => {
  const { CL, c, F, R } = world();
  holdFort(CL, c);
  opinionOf(CL, c, R.rulerOf('hrothmark', c), 'player', 'helped', 2);
  opinionOf(CL, c, R.rulerOf('vessaro', c), 'player', 'abandoned', 3);
  const id = F.declare(c, 'player', FORT);
  assert.equal(F.recognises(c, 'hrothmark', id), true);
  assert.equal(F.recognises(c, 'vessaro', id), false);
  assert.equal(R.siegeWar(c, 'vessaro', id), true, 'unrecognised: fair game for sieges');
  assert.equal(R.siegeWar(c, 'hrothmark', id), false);
  assert.equal(R.relation(c, 'vessaro', id), 'peace', 'but not at war on the road');
  // Peace with a founded realm recognises it.
  CL.founding.onPeace(c, 'vessaro', id);
  assert.equal(F.recognises(c, 'vessaro', id), true);
});

test('land held of no realm: a claim taken back with no crown behind you is yours, and any realm may besiege it', () => {
  const { CL, c, R } = world();
  R.addClaim(c, FORT, { by: 'player', realm: 'valedorn', kind: 'old' });
  assert.equal(CL.claims.onRetakeAlone(c, FORT), true);
  const h = c.holdings[FORT];
  assert.deepEqual([h.controller, h.sovereign, h.holder], ['player', 'player', 'player']);
  for (const v of R.villagesOf(FORT, c)) assert.equal(c.holdings[v].controller, 'player', 'its villages with it');
  assert.equal(R.siegeWar(c, 'valedorn', 'player'), true);
  assert.equal(R.siegeWar(c, 'hrothmark', 'player'), true);
  assert.match(CL.rights.may(c, 'player', 'besiege', FORT).why, /yours/);
  assert.deepEqual(plain(R.invariants(c)), []);
  // A save keeps it; and from it a realm can be declared.
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.holdings[FORT].controller, 'player');
  c.renown = 600;
  while (c.roster.length < 40) c.roster.push({ ...(c.roster[0] || { name: 'Test', troopId: 'levy', xp: 0 }), id: 9100 + c.roster.length });
  const id = CL.founding.declare(c, 'player', FORT);
  assert.ok(id);
  assert.equal(c.holdings[FORT].claims.some((k) => k.realm === 'valedorn'), false, 'no old crown to claim it');
});

test('a lord who thinks ill of their ruler and well of you asks to swear; you accept, grant a village and summon them', () => {
  const { CL, c, F, R } = world();
  holdFort(CL, c);
  const id = F.declare(c, 'player', FORT);
  const lord = Object.keys(c.people).find((p) => c.people[p].realm === 'hrothmark' && !R.rules(p, c) && CL.lords.partyOf(c, p));
  opinionOf(CL, c, lord, R.rulerOf('hrothmark', c), 'abandoned', 4);
  opinionOf(CL, c, lord, 'player', 'helped', 3);
  c.nobles.week = -1; // test setup: the week turns
  CL.nobles.tick(c);
  assert.ok(F.rule(c).asks.some((a) => a.lord === lord), 'asks to swear');
  assert.ok(F.answerAsk(c, lord, true));
  assert.equal(c.people[lord].realm, id);
  assert.deepEqual(plain(F.vassals(c)), [lord]);
  assert.equal(CL.lords.partyOf(c, lord)?.template, `lord_${id}`, 'rides under your banner');
  const village = R.villagesOf(FORT, c)[0];
  assert.ok(F.grant(c, village, lord));
  assert.equal(c.holdings[village].holder, lord);
  // Summoned to a siege of a fort of a realm at war with you: they answer by the model.
  R.setRelation(c, id, 'hrothmark', 'war', 'test', null, c.day, id);
  const target = Object.keys(c.holdings).find((s) => c.holdings[s].kind === 'fort' && c.holdings[s].controller === 'hrothmark' && !R.locked(c, s));
  CL.sieges.RULES.minLords = 1;
  const party = CL.lords.partyOf(c, lord);
  const t = CL.content.table('settlements')[target];
  Object.assign(party, { x: t.mapX, y: t.mapY, troops: { [R.faction(id).recruits[0]]: 150 } }); // test setup: near, and strong enough to try
  const s = F.summon(c, target);
  assert.ok(s, 'the siege is called');
  assert.deepEqual(plain(s.lords), [lord]);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('SC-41: ten days of riding while ruling: the officers decide by policy, alerts come as messages, no screen is forced', () => {
  const { CL, c, F, R, D, messages } = world();
  holdFort(CL, c);
  opinionOf(CL, c, R.rulerOf('valedorn', c), 'player', 'helped', 3); // test setup: the old crown accepts, so no war comes
  const id = F.declare(c, 'player', FORT);
  assert.deepEqual(plain(F.rule(c)), { steward: 'grow', marshal: 'defend', chancellor: 'peace', asks: [] });
  assert.equal(F.setPolicy(c, 'marshal', 'expand:hrothmark'), true);
  assert.equal(F.setPolicy(c, 'marshal', 'expand:nowhere'), false);
  assert.equal(F.mayPlan(c, id, 'hrothmark'), true);
  assert.equal(F.mayPlan(c, id, 'aurelian'), false);
  F.setPolicy(c, 'marshal', 'defend');
  // A treaty offer: the chancellor accepts trade by the peace policy, and you hear of it.
  const r = D.resolve(c, { kind: 'trade', from: 'hrothmark', to: id, terms: {} });
  assert.equal(r.ok, true);
  assert.match(messages.join(' '), /Your chancellor accepts \(policy: peace\)/);
  assert.equal(D.answer(c, 'alliance', 'hrothmark', id, { against: 'vessaro' }).ok, false, 'not under peace');
  F.setPolicy(c, 'chancellor', 'allies');
  assert.equal(D.answer(c, 'alliance', 'hrothmark', id, { against: 'vessaro' }).ok, true);
  // Ten days riding: count every screen the game opens on its own.
  const modes = [];
  const was = CL.ui.changeMode;
  CL.ui.changeMode = (m, ...rest) => {
    modes.push(m);
    return was?.call(CL.ui, m, ...rest);
  };
  for (let d = 0; d < 10; d++) {
    CL.party.advanceDays(1);
    CL.game.contactParty = null;
  }
  CL.ui.changeMode = was;
  assert.deepEqual(modes, [], 'no screen forced');
  assert.equal(c.holdings[FORT].policies.tax, 'light', 'the steward grows');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('an AI lord with land, men and a grudge declares; at most one new realm in 180 days', () => {
  const { CL, c, F, R } = world();
  const lord = Object.keys(c.people).find((p) => !R.rules(p, c) && CL.lords.partyOf(c, p) && R.fiefsOf(p, c).some((s) => c.holdings[s].kind === 'fort' && !R.locked(c, s)));
  const realm = c.people[lord].realm;
  const fort = R.fiefsOf(lord, c).find((s) => c.holdings[s].kind === 'fort' && !R.locked(c, s));
  CL.lords.partyOf(c, lord).troops = { [Object.keys(CL.lords.partyOf(c, lord).troops)[0]]: 50 };
  opinionOf(CL, c, lord, R.rulerOf(realm, c), 'abandoned', 4);
  c.day = 200;
  const id = F.aiDeclares(c);
  assert.ok(id, CL.rights.may(c, lord, 'declare', fort).why);
  assert.equal(R.rulerOf(id, c), lord);
  assert.equal(c.people[lord].realm, id);
  assert.equal(c.holdings[fort].sovereign, id);
  assert.ok(c.holdings[fort].claims.some((k) => k.realm === realm));
  assert.equal(CL.lords.riders(c).includes(lord), false, 'a ruler keeps to their hall');
  assert.equal(F.aiDeclares(c), null, 'not another for 180 days');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('saves: v26 → v27, a founded realm round-trips with its holdings, ruler and your rule; junk repaired; 2.30.0’s saves load', () => {
  const { CL, c, F } = world();
  holdFort(CL, c);
  const id = F.declare(c, 'player', FORT);
  F.setPolicy(c, 'chancellor', 'none');
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.realms), plain(c.realms));
  assert.equal(back.rulers[id], 'player');
  assert.equal(back.holdings[FORT].sovereign, id);
  assert.equal(back.rule.chancellor, 'none');
  const d = plain(c);
  d.realms.r9 = { id: 'r9', name: '', troops: 'valedorn' };
  d.realms.bad = { id: 'bad', name: 'Bad', troops: 'valedorn' };
  d.realms.r1.color = 'red';
  d.rule.marshal = 'expand:nowhere';
  const fixed = CL.save.fromRaw(d).campaign;
  assert.deepEqual(Object.keys(fixed.realms), ['r1']);
  assert.equal(fixed.realms.r1.color, '#888888');
  assert.equal(fixed.rule.marshal, 'defend');
  assert.deepEqual(plain(CL.realm.invariants(fixed)), []);
  const v26 = plain(c);
  v26.version = 26;
  delete v26.realms;
  delete v26.rule;
  delete v26.nextRealmId;
  for (const sid of Object.keys(v26.holdings)) if (v26.holdings[sid].sovereign === id) Object.assign(v26.holdings[sid], { sovereign: 'valedorn', controller: 'valedorn' });
  delete v26.rulers[id];
  const m = CL.save.migrate(v26);
  assert.equal(m.version, CL.save.VERSION); // and on through the later steps
  assert.deepEqual(plain(m.realms), {});
  assert.deepEqual(plain(m.rule), plain(F.blank()));
});

test('P9-T, SC-25: a ruler offers treaties, each answered by the other ruler, and a broken alliance is heard in every court', () => {
  const { CL, c, F, R, D, messages } = world();
  holdFort(CL, c);
  const me = F.declare(c, 'player', FORT, { name: 'the Westmark' });
  assert.ok(me);
  // The old crown answers in 7 days; here it accepts at once (the claim stays), so the realm is at peace.
  R.setRelation(c, me, 'valedorn', 'peace', 'test');
  R.setRelation(c, 'valedorn', 'hrothmark', 'war', 'test');
  R.setRelation(c, me, 'hrothmark', 'war', 'test');
  const kinds = F.offers(c, 'valedorn').map((o) => o.kind);
  assert.ok(kinds.includes('alliance') && kinds.includes('trade') && kinds.includes('nonaggression'), kinds.join());
  assert.deepEqual(plain(F.offers(c, 'hrothmark').map((o) => o.kind)), ['truce', 'peace'], 'at war: a truce or peace');
  assert.equal(F.offers(c, me).length, 0, 'not to yourself');
  // Valedorn and you share an enemy: they think well enough of it.
  D.addTrust(c, 'valedorn', me, 40);
  const r = F.propose(c, 'alliance', 'valedorn', 'hrothmark');
  assert.ok(r.ok, r.why);
  assert.ok(D.has(c, me, 'valedorn', 'alliance'));
  assert.match(messages.at(-1), /Valedorn accepts your offer of an alliance/);
  assert.ok(!F.offers(c, 'valedorn').some((o) => o.kind === 'alliance'), 'not offered twice');
  // The same offer again within a month is refused before it is made.
  F.propose(c, 'trade', 'aurelian'); // answered either way
  const again = F.propose(c, 'trade', 'aurelian');
  assert.equal(again.ok, false);
  // Breaking it: Valedorn trusts you less, and so does every other court.
  const t = D.between(c, me, 'valedorn', 'alliance')[0];
  const before = { injured: D.trust(c, 'valedorn', me), other: D.trust(c, 'aurelian', me) };
  assert.ok(F.renounce(c, t.id));
  assert.ok(!D.has(c, me, 'valedorn', 'alliance'));
  assert.ok(D.trust(c, 'valedorn', me) < before.injured, 'the injured realm');
  assert.ok(D.trust(c, 'aurelian', me) < before.other, 'every court has heard');
  assert.match(messages.at(-1), /You break your alliance with Valedorn/);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('P9-T: a reload gives a realm you founded no stand-in ruler (its people as they were, every lord with a home)', () => {
  const { CL, c, F } = world();
  holdFort(CL, c);
  const me = F.declare(c, 'player', FORT);
  assert.ok(me);
  const people = Object.keys(c.people).length;
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.rulers[me], 'player');
  assert.equal(Object.keys(back.people).length, people, 'nobody new');
  assert.deepEqual(Object.values(back.people).filter((p) => p.realm === me).map((p) => p.id), [], 'no lord of your realm made up');
  for (const p of Object.values(back.people)) assert.ok(CL.content.table('settlements')[p.home], `${p.name} has a home`);
});

test('P9-T: your court never grants away your land or your seat (a realm founded at a fort keeps its capital)', () => {
  const { CL, c, F, R } = world();
  holdFort(CL, c);
  const me = F.declare(c, 'player', FORT);
  const lord = Object.keys(c.people).find((p) => c.people[p].realm === 'hrothmark' && !R.rules(p, c) && !R.fiefsOf(p, c).length) || Object.keys(c.people).find((p) => c.people[p].realm === 'hrothmark' && !R.rules(p, c));
  CL.nobles.changeRealm(c, lord, me); // a landless vassal waits for land
  assert.equal(CL.fiefs.givable(c, FORT), false, 'your seat');
  for (const v of R.villagesOf(FORT, c)) assert.equal(CL.fiefs.givable(c, v), false, 'your villages: yours to grant');
  for (let w = 0; w < 6; w++) {
    CL.fiefs.weeklyGrants(c);
    c.day += 7;
    CL.fiefs.decideGrants(c);
  }
  assert.equal(R.holderOf(FORT, c), 'player');
  // An AI lord's realm founded at a fort: its seat is not the crown's to give either.
  const other = Object.keys(c.holdings).find((s) => c.holdings[s].kind === 'fort' && c.holdings[s].sovereign === 'aurelian' && R.capitalOf('aurelian', c) !== s);
  assert.equal(CL.fiefs.givable(c, R.capitalOf('aurelian', c)), false);
  assert.ok(other);
});

test('P9-T: the old crown answers before it besieges: no siege of the new realm while its answer is pending', () => {
  const { CL, c, F, R } = world();
  holdFort(CL, c);
  const me = F.declare(c, 'player', FORT);
  assert.equal(c.realms[me].pending.realm, 'valedorn');
  assert.equal(R.siegeWar(c, 'valedorn', me), false, 'pending');
  assert.equal(R.siegeWar(c, 'hrothmark', me), !F.recognises(c, 'hrothmark', me), 'another realm, by its recognition');
  R.setRelation(c, 'valedorn', me, 'war', 'test');
  assert.equal(R.siegeWar(c, 'valedorn', me), true, 'at war');
});
