// P8-07 · Named nobles: needs (computed from state), opinions with kin remembering, requests answered by
// relationship, obligation, interest and fear (the player's, the ruler's summons, calls for relief),
// friends, rivals and feuds read from what happened, changing realm by the player's rules, revocation,
// petitions, your summons, SC-24 and the saves (v24, 2.30.0's fixtures).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.30');

/** The world with only the lords riding, everyone in their halls; the company at Stonebridge. */
function world() {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  Object.assign(c, { gold: 2000, food: 400 });
  CL.game.mode = 'map';
  const id = (k) => Object.keys(c.people).find((x) => c.people[x].key === k);
  return { ...env, c, N: CL.nobles, R: CL.realm, L: CL.lords, F: CL.fiefs, S: CL.sieges, id };
}
const vassal = (c, f = 'valedorn') => Object.assign(c.allegiance, { kind: 'vassal', realm: f, since: c.day, window: { start: c.day, days: 10 } });
/** A siege record as js/sieges.js keeps one (for the needs and requests: nothing steps it here). */
const siege = (c, sid, realm, by = 'ai', phase = 'encircled') => {
  const s = { id: 90 + c.sieges.length, sid, realm, by, lords: [], relief: [], phase, began: c.day, gatherBy: c.day + 5, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
  c.sieges.push(s);
  return s;
};

test('needs come from state: land, coin, men, safety, standing; they lean the lords’ riding', () => {
  const { c, N, R, L, id } = world();
  const tancred = id('tancred_greymantle');
  const hamon = id('hamon_greymantle');
  assert.deepEqual(plain(N.topNeed(c, tancred)), { need: 'land', score: 0.8, why: 'wants land of his own' }, 'landless (and hungry for land)');
  R.addClaim(c, 'oakford', { by: tancred, realm: 'valedorn', kind: 'old' });
  assert.equal(N.needLine(c, tancred), 'wants Oakford back');
  assert.equal(N.needLine(c, hamon), 'content');
  // His sister taken: a ransom to raise.
  L.beaten(c, L.partyOf(c, id('hawise_greymantle')), 'aurelian');
  assert.equal(N.needLine(c, hamon), 'must raise a ransom for Lady Hawise Greymantle');
  // Thin ranks: short of men, and he avoids a fight.
  L.partyOf(c, hamon).troops = { footman: 3 };
  assert.equal(N.topNeed(c, hamon).need, 'men');
  assert.equal(N.leaning(c, hamon).avoid, true);
  // A fort besieged: safety, and she stays home.
  const avice = id('avice_westmere');
  siege(c, 'westholt_castle', 'aurelian');
  assert.equal(N.needLine(c, avice), 'fears for Westholt Castle');
  assert.equal(N.leaning(c, avice).stay, true);
  // Beaten in the field: standing.
  const decimo = id('decimo_vatro');
  N.note(c, decimo, 'player', 'beat');
  assert.deepEqual(plain(N.needs(c, decimo).map((n) => n.need)), ['land', 'standing']);
  assert.equal(N.needs(c, decimo)[1].why, 'wants to win back his name');
  // Rulers have no needs here; needs are never saved.
  assert.deepEqual(plain(N.needs(c, R.rulerOf('valedorn', c))), []);
  assert.equal(JSON.stringify(c.nobles).includes('"need'), false);
});

test('holdings shape answers: a landless lord near you and a landed one whose fort is threatened answer differently, and say why', () => {
  const { c, N, id } = world();
  vassal(c);
  const tancred = id('tancred_greymantle');
  const avice = id('avice_westmere');
  siege(c, 'westholt_castle', 'aurelian');
  const a = N.consider(c, tancred, { by: 'player', kind: 'ride' });
  const b = N.consider(c, avice, { by: 'player', kind: 'ride' });
  assert.equal(a.answer, 'negotiate');
  assert.ok(a.price > 0, 'a price in crowns');
  assert.equal(b.answer, 'refuse');
  assert.match(N.reasonLine(b), /She is sworn to the same crown \(\+\)\. .*Westholt Castle is threatened \(−\)\. You are 2 days from her lands \(−\)\./);
  assert.match(N.reasonLine(a), /You are close to his lands \(\+\)\. He is hungry for glory \(\+\)\./);
});

test('kin remember: a deed to one lord moves their close kin by half', () => {
  const { c, N, id } = world();
  const hamon = id('hamon_greymantle');
  N.note(c, hamon, 'player', 'freed');
  assert.equal(N.opinion(c, hamon, 'player'), 20);
  assert.equal(N.opinion(c, id('hawise_greymantle'), 'player'), 10, 'his sister');
  assert.equal(N.opinion(c, id('tancred_greymantle'), 'player'), 10, 'his son');
  assert.equal(N.opinion(c, id('avice_westmere'), 'player'), 0, 'no kin of his');
  assert.equal(N.deeds(c, id('hawise_greymantle'), 'player').length, 0, 'kin hear of it: not their own deed');
  assert.match(N.opinionLine(c, hamon), /^He thinks well of you \(\+20\): you freed him without ransom on day \d+\.$/);
  assert.equal(c.nobles.debts.length, 1, 'a waived ransom is a debt');
});

test('between lords: a grant makes a rival; friends back each other’s grants', () => {
  const { c, N, R, F, id } = world();
  const ruler = R.rulerOf('valedorn', c);
  const tancred = id('tancred_greymantle');
  const alys = id('alys_ardane');
  // Fernley comes back to the crown, and the crown grants it.
  R.transfer(c, 'fernley', { holder: ruler, reason: 'test' });
  const g = F.offer(c, 'fernley');
  g.day = c.day;
  const serlo = id('serlo_fernby');
  const order = () => F.candidates(c, g);
  assert.deepEqual(plain(order().slice(0, 3)), [alys, serlo, tancred], 'the king’s kin first (his goodwill), then by id');
  // Friends at court: Tancred fought beside two lords of the realm, who back him.
  N.note(c, id('hawise_greymantle'), tancred, 'fought_beside', { kin: false });
  N.note(c, id('avice_westmere'), tancred, 'fought_beside', { kin: false });
  assert.equal(N.tie(c, tancred, id('avice_westmere')), 'friend');
  assert.deepEqual(plain(order().slice(0, 3)), [tancred, alys, serlo], 'his friends back him, ahead of the king’s goodwill to his kin');
  F.decideGrants(c);
  assert.equal(R.holderOf('fernley', c), tancred);
  assert.equal(N.tie(c, alys, tancred), 'rival', 'she wanted it, he got it');
  assert.equal(N.tie(c, serlo, tancred), 'rival', 'and Serlo, who held it before');
  assert.ok(N.deeds(c, alys, ruler).some((x) => x[0] === 'passed_over'));
  assert.ok(N.deeds(c, tancred, ruler).some((x) => x[0] === 'granted'));
  assert.deepEqual(plain(N.ties(c, tancred, 'rival').sort()), [serlo, alys].sort());
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('between lords: a taken fief makes a feud and a claim; feuding lords won’t ride together', () => {
  const { c, N, R, S, L, id } = world();
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const avice = id('avice_westmere');
  const cassian = id('cassian_vatro');
  const s = siege(c, 'westholt_castle', 'aurelian');
  s.lords.push(cassian);
  S.take(c, s, 'stormed');
  assert.equal(R.owner('westholt_castle', c), 'aurelian');
  assert.equal(N.tie(c, avice, cassian), 'feud');
  assert.ok(R.claimsOn('westholt_castle', c).some((k) => k.by === avice), 'the loser keeps a claim');
  // Within a realm: Hamon took Hawise's fief (as the record says); she won't ride beside him.
  const hamon = id('hamon_greymantle');
  const hawise = id('hawise_greymantle');
  N.note(c, hawise, hamon, 'took_fief', { kin: false });
  const fort = 'castra_nova';
  const { come, refused } = N.summon(c, 'valedorn', fort, [hamon, hawise]);
  assert.deepEqual(plain(come), [hamon]);
  assert.equal(refused[0].pid, hawise);
  assert.match(N.reasonLine(refused[0].r), /She won't ride beside Lord Hamon Greymantle: they are at feud \(−\)\./);
  assert.ok(L.partyOf(c, hawise));
});

test('a feud’s claim is pressed in war: the realm besieges the fort its lord claims', () => {
  const { CL, c, R, S, id } = world();
  R.setRelation(c, 'valedorn', 'hrothmark', 'war', 'test');
  // Torvald (Hrothmark) once held Westholt (as the record says): Hrothmark goes for it first.
  R.addClaim(c, 'westholt_castle', { by: id('torvald_skarn'), realm: 'hrothmark', kind: 'old' });
  for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'hrothmark')) {
    const w = CL.content.get('settlements', 'westholt_castle');
    Object.assign(q, { x: w.mapX + 3, y: w.mapY + 3 });
  }
  const s = S.plan(c, 'hrothmark');
  assert.equal(s?.sid, 'westholt_castle');
});

test('changing sides: an unhappy lord grumbles, then leaves by the player’s rules; fiefs go back, claims kept; once in 60 days', () => {
  const { c, N, R, L, id } = world();
  const alys = id('alys_ardane');
  const ruler = R.rulerOf('valedorn', c);
  R.transfer(c, 'oakford', { holder: alys, willing: true, reason: 'test' });
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  N.note(c, alys, ruler, 'revoked', { kin: false });
  N.note(c, alys, ruler, 'revoked', { kin: false });
  N.note(c, alys, R.rulerOf('hrothmark', c), 'helped', { kin: false }); // she thinks best of Hrothmark's king
  N.weekly(c, alys);
  assert.equal(c.people[alys].realm, 'valedorn', 'a warning first');
  assert.match(c.news.events.at(-1).text, /Lady Alys Ardane grumbles at the court of King Godric Ardane\./);
  c.day += 7;
  N.weekly(c, alys);
  assert.equal(c.people[alys].realm, 'hrothmark');
  assert.equal(R.holderOf('oakford', c), ruler, 'her fief goes back to the crown');
  assert.deepEqual(plain(R.claimsOn('oakford', c).find((k) => k.by === alys)), { by: alys, realm: 'valedorn', since: c.day, kind: 'granted' }, 'at war: a defection, the claim kept');
  assert.match(c.news.events.at(-1).text, /Lady Alys Ardane breaks with the Valedorn Crown for Hrothmark\./);
  assert.ok(N.deeds(c, ruler, alys).some((x) => x[0] === 'defected'));
  L.ensure(c, c.day, true);
  assert.equal(L.partyOf(c, alys).template, L.templateFor('hrothmark').id, 'she rides for Hrothmark now');
  assert.deepEqual(plain(R.invariants(c)), []);
  // Unhappy again at once: she doesn't change twice in 60 days.
  for (let i = 0; i < 4; i++) N.note(c, alys, R.rulerOf('hrothmark', c), 'revoked', { kin: false });
  for (let w = 0; w < 4; w++) {
    c.day += 7;
    N.weekly(c, alys);
  }
  assert.equal(c.people[alys].realm, 'hrothmark');
  // At peace it is a release: the fief goes back with no claim.
  const { c: c2, N: N2, R: R2, id: id2 } = world();
  const tancred = id2('tancred_greymantle');
  R2.transfer(c2, 'oakford', { holder: tancred, willing: true, reason: 'test' });
  N2.note(c2, tancred, R2.rulerOf('valedorn', c2), 'revoked', { kin: false });
  N2.note(c2, tancred, R2.rulerOf('valedorn', c2), 'revoked', { kin: false });
  N2.weekly(c2, tancred);
  c2.day += 7;
  N2.weekly(c2, tancred);
  assert.notEqual(c2.people[tancred].realm, 'valedorn');
  assert.equal(R2.claimsOn('oakford', c2).some((k) => k.by === tancred), false, 'released: no claim');
  assert.match(c2.news.events.at(-1).text, /Lord Tancred Greymantle leaves the Valedorn Crown for /);
  assert.deepEqual(plain(R2.invariants(c2)), []);
});

test('no realm empties: a lord does not leave a realm of three riders; never while at a siege', () => {
  const { CL, c, N, R } = world();
  const ruler = R.rulerOf('hrothmark', c);
  const riders = () => CL.lords.riders(c).filter((p) => c.people[p].realm === 'hrothmark');
  // Two of Hrothmark's five leave (one a month), then no more.
  const unhappy = riders();
  for (const pid of unhappy) for (let i = 0; i < 3; i++) N.note(c, pid, ruler, 'revoked', { kin: false });
  for (let w = 0; w < 30; w++) {
    c.day += 7;
    for (const pid of unhappy) N.weekly(c, pid);
  }
  assert.equal(riders().length, 3);
  // At a siege: after it ends.
  const { c: c2, N: N2, R: R2, id: id2 } = world();
  const hamon = id2('hamon_greymantle');
  const s = siege(c2, 'castra_nova', 'valedorn');
  s.lords.push(hamon);
  for (let i = 0; i < 3; i++) N2.note(c2, hamon, R2.rulerOf('valedorn', c2), 'revoked', { kin: false });
  for (let w = 0; w < 3; w++) {
    c2.day += 7;
    N2.weekly(c2, hamon);
  }
  assert.equal(c2.people[hamon].realm, 'valedorn');
  assert.equal(c2.nobles.warned[hamon], undefined, 'not even a grumble while at the siege');
});

test('revocation: a lord who keeps refusing summons loses a fief, which the crown grants to another', () => {
  const { c, N, R, F, id } = world();
  const avice = id('avice_westmere');
  const ruler = R.rulerOf('valedorn', c);
  N.note(c, ruler, avice, 'refused_summons', { kin: false });
  N.note(c, ruler, avice, 'refused_summons', { kin: false });
  N.weekly(c, avice);
  assert.equal(R.holderOf('ashby', c), ruler, 'her village first');
  assert.equal(R.holderOf('westholt_castle', c), avice);
  assert.match(c.news.events.at(-1).text, /King Godric Ardane takes Ashby back from Lady Avice Westmere, who would not answer the summons\./);
  assert.ok(N.deeds(c, avice, ruler).some((x) => x[0] === 'revoked'));
  const g = c.grants.find((x) => x.sid === 'ashby');
  g.day = c.day;
  F.decideGrants(c);
  assert.notEqual(R.holderOf('ashby', c), ruler);
  assert.notEqual(R.holderOf('ashby', c), avice);
  N.weekly(c, avice);
  assert.equal(R.holderOf('westholt_castle', c), avice, 'answered for: the same refusals don’t count twice');
});

test('determinism, and each factor’s effect on the answer', () => {
  const { c, N, L, id, CL } = world();
  const tancred = id('tancred_greymantle');
  const ask = { by: 'player', kind: 'ride' };
  const base = N.consider(c, tancred, ask);
  assert.deepEqual(plain(N.consider(c, tancred, ask)), plain(base), 'the same state, the same answer');
  const up = (fn, label) => {
    const before = N.consider(c, tancred, ask).score;
    fn();
    const after = N.consider(c, tancred, ask).score;
    assert.ok(after > before, `${label}: ${before} → ${after}`);
  };
  up(() => vassal(c), 'obligation: sworn to the same crown');
  up(() => N.note(c, tancred, 'player', 'freed'), 'relationship (and the debt)');
  const before = N.consider(c, tancred, ask).score;
  const troops = L.partyOf(c, tancred).troops;
  L.partyOf(c, tancred).troops = { footman: 2 };
  assert.ok(N.consider(c, tancred, ask).score < before, 'interest: his ranks are thin');
  assert.equal(N.consider(c, tancred, ask).answer, 'delay', 'a reason time will mend');
  L.partyOf(c, tancred).troops = troops;
  up(() => {
    for (let i = 0; i < 12; i++) CL.save.addSoldier(c, 'footman');
    c.renown = 400;
  }, 'fear');
});

test('SC-24: a noble refuses an unreasonable order: the reasons are his to know, and it shows', () => {
  const { c, N, id } = world();
  vassal(c);
  const hamon = id('hamon_greymantle');
  siege(c, 'castra_nova', 'valedorn', 'player');
  const r = N.ask(c, hamon, 'siege');
  assert.equal(r.answer, 'refuse');
  assert.equal(r.words, 'Lord Hamon Greymantle refuses.');
  assert.match(r.line, /Castra Nova is 2 days from his lands, and he guards his lands \(−\)\./);
  assert.match(r.line, /The walls of Castra Nova are strong against those besieging it \(−\)\./);
  for (const x of r.reasons) assert.ok(['+', '−', ''].includes(x.sign) && x.text.length > 0);
  // The consequence is visible: he holds to it for a week.
  assert.match(N.askable(c, hamon).siege.why, /has given you an answer; ask again on day \d+/);
  // No hidden omniscience: your purse is not his to know.
  const { c: c2, N: N2, id: id2 } = world();
  vassal(c2);
  siege(c2, 'castra_nova', 'valedorn', 'player');
  c2.gold = 0;
  const poor = N2.consider(c2, id2('hamon_greymantle'), { by: 'player', kind: 'siege', sid: 'castra_nova' });
  c2.gold = 1e6;
  const rich = N2.consider(c2, id2('hamon_greymantle'), { by: 'player', kind: 'siege', sid: 'castra_nova' });
  assert.deepEqual(plain(rich), plain(poor));
  assert.equal(/crowns|gold|purse/.test(N2.reasonLine(rich)), false);
});

test('no spamming: a 3-day cooldown per lord; negotiated payment is paid once', () => {
  const { CL, c, N, id } = world();
  vassal(c);
  const tancred = id('tancred_greymantle');
  const r = N.ask(c, tancred, 'ride');
  assert.equal(r.answer, 'negotiate');
  assert.equal(r.words, `Lord Tancred Greymantle will, for ${r.price} crowns.`);
  assert.equal(N.askable(c, tancred).ride.ok, false);
  assert.match(N.askable(c, tancred).ride.why, /You asked him lately; ask again on day \d+/);
  const gold = c.gold;
  assert.equal(N.pay(c, tancred).ok, true);
  assert.equal(c.gold, gold - r.price);
  assert.equal(N.pay(c, tancred), null, 'once');
  assert.equal(c.gold, gold - r.price);
  assert.equal(N.ridesWith(c, tancred), true);
  c.day += 3;
  assert.equal(N.ridesWith(c, tancred), false, 'three days');
  assert.match(N.askable(c, tancred).ride.why, /has given you his word already/);
  CL.party.advanceDays(0.1);
  assert.equal(N.askable(c, tancred).ride.ok, true, 'the promise kept, the cooldown over');
});

test('ride with me: the lord keeps beside you and takes your side against bandits, never against his own', () => {
  const { CL, c, N, id } = world();
  vassal(c);
  const tancred = id('tancred_greymantle');
  N.note(c, tancred, 'player', 'freed');
  for (let i = 0; i < 12; i++) CL.save.addSoldier(c, 'footman');
  const r = N.ask(c, tancred, 'ride');
  assert.equal(r.answer, 'obey', r.line);
  assert.equal(c.nobles.debts.length, 0, 'his debt is paid by it');
  CL.party.advanceDays(1 / 24);
  CL.game.contactParty = null;
  const q = CL.lords.partyOf(c, tancred);
  assert.equal(q.intent, 'escort');
  assert.equal(CL.lords.doingLine(c, q), 'riding with you');
  assert.equal(CL.reinforce.sideOf(c, q, { kind: 'bandit', faction: CL.realm.outlaws() }), 'ally');
  assert.equal(CL.reinforce.sideOf(c, q, { kind: 'patrol', faction: 'valedorn' }), 'enemy', 'a patrol of his own realm you attack: he is theirs');
});

test('a lord who joins your siege: his promise ends with it, without a word of lapsing', () => {
  const { CL, c, N, S, id, uiCalls } = world();
  vassal(c);
  const avice = id('avice_westmere');
  N.note(c, avice, 'player', 'freed');
  // A company of 12 in the world's scale (P9-B3: households three times the data's).
  for (let i = 0; i < 12 * CL.world.armies().households; i++) CL.save.addSoldier(c, 'footman');
  const s = siege(c, 'castra_nova', 'valedorn', 'player');
  assert.equal(N.ask(c, avice, 'siege').answer, 'obey');
  assert.ok(s.lords.includes(avice));
  S.end(c, s, 'lifted');
  CL.nobles.tick(c);
  assert.equal(c.nobles.pledges.length, 0);
  assert.equal(uiCalls.some((u) => u[0] === 'message' && /promise lapses/.test(u[1])), false);
});

test('a lord who agrees and is captured on the way: you are told, and the promise lapses', () => {
  const { CL, c, N, L, id, uiCalls } = world();
  vassal(c);
  const tancred = id('tancred_greymantle');
  L.partyOf(c, tancred).troops = { footman: 2 };
  const r = N.ask(c, tancred, 'ride');
  assert.equal(r.answer, 'delay');
  assert.equal(c.nobles.pledges.length, 1);
  L.beaten(c, L.partyOf(c, tancred), 'aurelian');
  CL.party.advanceDays(1 / 24);
  assert.equal(c.nobles.pledges.length, 0);
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /Lord Tancred Greymantle was taken on the way: his promise lapses\./.test(u[1])));
});

test('petitions come only from lords who think well of you: none in a new game', () => {
  const { CL, c, N } = world();
  for (let d = 0; d < 20; d++) CL.party.advanceDays(1);
  assert.equal(N.petition(c), null);
});

test('petitions: one open at a time, chosen by need; the reward is paid once; a loan is repaid', () => {
  const { CL, c, N, id } = world();
  const avice = id('avice_westmere');
  siege(c, 'westholt_castle', 'aurelian');
  const x = N.openPetition(c, avice);
  assert.equal(x.kind, 'bandits');
  assert.equal(N.openPetition(c, id('tancred_greymantle')), null, 'one at a time');
  assert.equal(N.petitionText(c, x), 'clear the bandits from about Westholt Castle, for 80 crowns');
  assert.equal(N.answerPetition(c, 'accept').ok, true);
  const w = CL.content.get('settlements', 'westholt_castle');
  Object.assign(c.world, { x: w.mapX, y: w.mapY });
  const gold = c.gold;
  N.afterBattle(c, { win: true, kind: 'bandit' });
  assert.equal(c.gold, gold + 80);
  N.afterBattle(c, { win: true, kind: 'bandit' });
  assert.equal(c.gold, gold + 80, 'once');
  assert.equal(N.petition(c), null);
  assert.ok(N.opinion(c, avice, 'player') >= 10);
  // A loan: lent now, repaid with interest when due.
  c.sieges.length = 0;
  c.nobles.petitionAfter = 0;
  const serlo = id('serlo_fernby');
  const loan = N.openPetition(c, serlo);
  assert.equal(loan.kind, 'loan');
  const before = c.gold;
  N.answerPetition(c, 'accept');
  assert.equal(c.gold, before - 100);
  c.holdings.fernley.treasury = 500;
  CL.party.advanceDays(14.1);
  assert.deepEqual(plain(c.ledger.filter((l) => /repays a loan/.test(l.why)).map((l) => l.amount)), [130], 'repaid once, with interest');
  assert.equal(c.nobles.debts.length, 0);
  void before;
});

test('your summons: answered by being at the siege; missed when it ends without you', () => {
  const { CL, c, S, R, uiCalls, id } = world();
  vassal(c);
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const fort = CL.content.get('settlements', 'castra_nova');
  for (const k of ['hamon_greymantle', 'avice_westmere', 'hawise_greymantle']) Object.assign(CL.lords.partyOf(c, id(k)), { x: fort.mapX + 2, y: fort.mapY + 2 });
  const s = S.plan(c, 'valedorn');
  assert.equal(s.sid, 'castra_nova');
  assert.equal(c.nobles.summons.siegeId, s.id);
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /King Godric Ardane summons you to the siege of Castra Nova\./.test(u[1])));
  S.end(c, s, 'lifted');
  CL.nobles.tick(c);
  assert.equal(c.nobles.summons, null);
  assert.equal(c.allegiance.summonsMissed, 1);
  // Answered: you ride to it.
  c.nobles.summons = null;
  const s2 = S.plan(c, 'valedorn');
  Object.assign(c.world, { x: fort.mapX + 1, y: fort.mapY + 1, location: null });
  const served = c.allegiance.serviceDays;
  CL.nobles.tick(c);
  assert.equal(c.nobles.summons.answered, true);
  assert.equal(c.allegiance.serviceDays, served + 1, 'a day of service');
  S.end(c, s2, 'lifted');
  CL.nobles.tick(c);
  assert.equal(c.allegiance.summonsMissed, 1, 'answered: not missed');
});

test('an AI lord chooses what to do with a conquest by their motives', () => {
  const { c, N, R, id } = world();
  const hamon = id('hamon_greymantle');
  assert.deepEqual(plain(N.conquerorChoice(c, hamon, 'castra_nova')), ['suggest', id('tancred_greymantle')], 'his landless son');
  const avice = id('avice_westmere');
  assert.deepEqual(plain(N.conquerorChoice(c, avice, 'castra_nova')), ['hand', null], 'loyal, with land enough');
  const domitia = id('domitia_celer');
  N.note(c, domitia, R.rulerOf('aurelian', c), 'revoked', { kin: false });
  assert.equal(N.conquerorChoice(c, domitia, 'westholt_castle')[0], 'keep', 'proud, and out of love with the crown');
});

test('saves: the nobles round-trip; junk is repaired; v23 migrates the deeds; 2.30.0’s saves load', () => {
  const { CL, c, N, id } = world();
  vassal(c);
  const tancred = id('tancred_greymantle');
  N.note(c, tancred, 'player', 'freed');
  N.ask(c, tancred, 'ride');
  siege(c, 'westholt_castle', 'aurelian');
  N.openPetition(c, id('avice_westmere'));
  c.sieges.length = 0;
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.nobles), plain(c.nobles));
  const d = plain(c);
  d.nobles.opinions['person:999'] = { player: { rel: 5, log: [] } };
  d.nobles.opinions[tancred].nobody = { rel: 5, log: [] };
  d.nobles.opinions[tancred].player.rel = 900;
  d.nobles.opinions[tancred].player.log.push(['flattered', 3]);
  d.nobles.petitions.push({ id: 9, lord: tancred, kind: 'loan', amount: 5, until: 99, day: 0 });
  d.nobles.pledges.push({ lord: 'person:999', kind: 'ride', from: 0, until: 99 });
  d.nobles.asks.nobody = { kind: 'ride', answer: 'obey', day: 0, until: 3 };
  const fixed = CL.save.fromRaw(d).campaign.nobles;
  assert.equal(fixed.opinions['person:999'], undefined);
  assert.equal(fixed.opinions[tancred].nobody, undefined);
  assert.equal(fixed.opinions[tancred].player.rel, 100);
  assert.equal(fixed.opinions[tancred].player.log.some((x) => x[0] === 'flattered'), false);
  assert.equal(fixed.petitions.length, 1, 'one petition at a time');
  assert.equal(fixed.pledges.some((x) => x.lord === 'person:999'), false);
  assert.equal(fixed.asks.nobody, undefined);
  // v23 → v24: the deeds kept on people become their opinions.
  const v23 = plain(c);
  v23.version = 23;
  delete v23.nobles;
  v23.people[tancred].deeds = [{ by: 'player', kind: 'freed', day: 2 }];
  const m = CL.save.migrate(v23);
  assert.equal(m.version, CL.save.VERSION); // and on through the later steps
  assert.deepEqual(plain(m.nobles.opinions[tancred].player), { rel: 20, log: [['freed', 2]] });
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    assert.equal(f.expect.build, '2.30.0');
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, G.save.VERSION);
    for (const k of ['gold', 'renown', 'battles', 'victories']) assert.equal(G.campaign[k], f.expect[k], `${f.file} ${k}`);
    assert.equal(typeof G.campaign.nobles.opinions, 'object');
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign), JSON.stringify(G.campaign), `${f.file}: stable`);
  }
});

// ---- P9-L1: the lords' loose ends ----

test('P9-L1 men: a lord short of men asks kin by the model; a quarter rides over; once in 30 days a pair', () => {
  const { c, N, L, id } = world();
  const tancred = id('tancred_greymantle');
  const hamon = id('hamon_greymantle');
  L.partyOf(c, tancred).troops = { footman: 3 };
  const giver = L.partyOf(c, hamon);
  const before = Object.values(giver.troops).reduce((a, b) => a + b, 0);
  assert.equal(N.topNeed(c, tancred).need, 'men');
  const r = N.consider(c, hamon, { by: tancred, kind: 'men' });
  assert.equal(r.answer, 'obey', N.reasonLine(r));
  assert.match(N.reasonLine(r), /It costs him men/);
  const lent = N.askMen(c, tancred);
  assert.equal(lent, Math.min(Math.floor(before / 4), L.sizeFor(c, tancred) - 3));
  assert.equal(Object.values(giver.troops).reduce((a, b) => a + b, 0), before - lent);
  assert.equal(Object.values(L.partyOf(c, tancred).troops).reduce((a, b) => a + b, 0), 3 + lent);
  assert.ok(N.opinion(c, tancred, hamon) > 10, 'thanks');
  // Thin again at once: not the same pair within 30 days (nobody else to ask: none).
  L.partyOf(c, tancred).troops = { footman: 3 };
  assert.equal(N.askMen(c, tancred), null);
  // A giver short of men themselves: not now.
  c.nobles.lent = {};
  giver.troops = { footman: 2 };
  assert.equal(N.consider(c, hamon, { by: tancred, kind: 'men' }).answer, 'delay');
  assert.equal(N.askMen(c, tancred), 0);
});

test('P9-L1 land-hungry: a landless lord has their claim pressed, rides to a siege unsummoned, and the realm aims there first', () => {
  const { c, N, R, S, L, id } = world();
  const tancred = id('tancred_greymantle');
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  R.addClaim(c, 'castra_nova', { by: tancred, realm: 'valedorn', kind: 'old' });
  const ruler = R.rulerOf('valedorn', c);
  assert.ok(N.opinion(c, ruler, tancred) >= 0);
  // No siege yet: the claim pressed.
  assert.equal(N.seekLand(c, tancred), 'pressed');
  const k = c.holdings.castra_nova.claims.find((x) => x.by === tancred);
  assert.equal(k.pressed, Math.floor(c.day) + 30);
  assert.equal(N.seekLand(c, tancred), null, 'once in 30 days');
  // A siege of his realm at his claim: he rides to it unsummoned.
  c.nobles.pressed = {};
  k.pressed = 0;
  const s = siege(c, 'castra_nova', 'valedorn');
  assert.equal(N.seekLand(c, tancred), 'joined');
  assert.ok(s.lords.includes(tancred));
  assert.equal(L.partyOf(c, tancred).siegeId, s.id);
  // A pressed claim leads the realm's next siege, before a claim merely held.
  c.sieges = [];
  R.addClaim(c, 'tessaro', { by: id('alys_ardane'), realm: 'valedorn', kind: 'old' });
  k.pressed = Math.floor(c.day) + 30;
  for (const pid of Object.keys(c.people)) if (L.partyOf(c, pid) && c.people[pid].realm === 'valedorn') Object.assign(L.partyOf(c, pid), { x: 110, y: 100 });
  const plan = S.plan(c, 'valedorn');
  if (plan) assert.equal(plan.sid, 'castra_nova');
  // Saved: the lord's pressed claim and the pause.
  assert.equal(R.holding('castra_nova', c).claims.find((x) => x.by === tancred).pressed, k.pressed);
});

test('P9-L1 escort petition: a lord short of coin with a market asks you to escort their caravan; done on arrival, failed lapses', () => {
  const { CL, c, N, R, id } = world();
  const hawise = id('hawise_greymantle');
  const from = R.fiefsOf(hawise, c)[0];
  assert.ok(CL.content.get('settlements', from).services.includes('trade'));
  for (const sid of R.fiefsOf(hawise, c)) c.holdings[sid].treasury = 0; // short of coin
  const p = N.petitionFor(c, hawise);
  assert.equal(p.kind, 'escort');
  assert.equal(c.holdings[p.to].controller, 'valedorn');
  assert.equal(p.amount, Math.round(CL.contracts.escortPay(c, from, p.to) * 1.5));
  const x = N.openPetition(c, hawise);
  assert.match(N.petitionText(c, x), new RegExp(`^escort her caravan from .+ to .+, for ${p.amount} crowns$`));
  // Busy with a contract: not now.
  c.contract = { id: 999 };
  assert.equal(N.answerPetition(c, 'accept').ok, false);
  c.contract = null;
  const r = N.answerPetition(c, 'accept');
  assert.equal(r.ok, true, r.text);
  assert.equal(c.contract.petition, x.id);
  assert.equal(c.contract.reward.gold, p.amount);
  assert.equal(c.contract.giver, from);
  // Saved and loaded: the contract from a lord's fief and the petition.
  const back = CL.save.sanitize(plain(c));
  assert.equal(back.contract.petition, x.id);
  assert.equal(back.nobles.petitions[0].to, p.to);
  // Arrives: paid as an escort, and the petition is done (her thanks).
  const gold = c.gold;
  c.contract.status = 'done';
  c.contract.payAt = p.to;
  c.world.location = p.to;
  CL.contracts.collect(c);
  assert.equal(c.gold, gold + p.amount);
  assert.equal(N.petition(c), null);
  assert.ok(N.opinion(c, hawise, 'player') >= 10);
  // Another, failed: it lapses.
  c.nobles.petitionAfter = 0;
  N.openPetition(c, hawise);
  N.answerPetition(c, 'accept');
  CL.contracts.abandon(c);
  assert.equal(N.petition(c), null);
});

test('a ransom petition accepted frees the kin (P8-07’s path, fixed in 3.6.0)', () => {
  const { c, N, L, id } = world();
  const hamon = id('hamon_greymantle');
  L.beaten(c, L.partyOf(c, id('hawise_greymantle')), 'aurelian');
  N.note(c, hamon, 'player', 'freed', { kin: false });
  const x = N.openPetition(c, hamon, 'ransom');
  assert.ok(x);
  assert.equal(N.answerPetition(c, 'accept').ok, true);
  assert.equal(L.prisonerOf(c, id('hawise_greymantle')), null);
  assert.equal(c.people[id('hawise_greymantle')].status, 'free');
});
