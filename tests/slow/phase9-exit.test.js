// P9-T: the Phase 9 exit (design §18.9) as a scripted campaign, in one save with a reload, the world's
// parties riding:
//   1. you declare a realm at Westholt Castle (600 renown, 40 soldiers: test values for what a long
//      campaign earns), and the old crown accepts it;
//   2. lords who resent their own ruler and think well of you ask to swear to you, and you accept;
//   3. you grant a village, appoint a castellan, make a treaty, and raise and command a vassal army;
//   4. the save, and the page opened again;
//   5. a vassal you wronged declines your summons; the wronged form a faction, warn, demand; you refuse,
//      and they rise;
//   6. you lose the war: the rising's army takes Westholt while you are away, and you are deposed;
//   7. the same save goes on: you are a free claimant with your company and a claim, and play on.
// The §25.3 invariants hold every day; nothing is doubled; the company never stalls.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('../helpers/load');
const { makeBot, headlessUi } = require('../helpers/campaign-bot');

const FORT = 'westholt_castle';
const plain = (v) => JSON.parse(JSON.stringify(v));

test('the Phase 9 exit: rule, command, treat, appoint and grant; a lord declines, a faction rises, you are deposed and play on', () => {
  const storage = memoryStorage();
  const messages = [];
  const boot = (fresh) => {
    const env = loadGame({ party: false, worldParties: true, seed: 9, storage });
    env.CL.ui = headlessUi(env.CL, messages);
    if (fresh) {
      env.CL.game.newGame = true;
      env.CL.character.begin({ name: 'Exit9', background: 'farmhand' });
      const c = env.CL.campaign;
      c.rngSeed = 9;
      c.rng = env.CL.autoresolve.streamSeeds(9);
      Object.assign(c, { parties: [], partySpawns: {}, nextPartyId: 1 });
      env.CL.parties.ensure(c, true);
    }
    return env.CL;
  };
  let CL = boot(true);
  let c = CL.campaign;
  const R = () => CL.realm;
  const F = () => CL.founding;
  const RB = () => CL.rebellion;
  const N = () => CL.nobles;
  const problems = [];
  const check = () => {
    for (const p of R().invariants(c)) if (problems.length < 10) problems.push(`day ${Math.floor(c.day)}: ${p}`);
    assert.equal(new Set(c.roster.map((x) => x.id)).size, c.roster.length, 'no soldier twice');
  };
  const holdings = Object.keys(c.holdings).length;
  const stay = (sid) => {
    const s = CL.content.get('settlements', sid);
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
  };
  /** Days pass with the company at a place (fed and paid: the money is not the point here). */
  const days = (n, at) => {
    for (let i = 0; i < n * 24; i++) {
      stay(at);
      c.food = Math.max(c.food, 120);
      c.gold = Math.max(c.gold, 800);
      CL.party.advanceDays(1 / 24);
      CL.game.contactParty = null;
      if (!['map', 'settlement'].includes(CL.game.mode)) CL.ui.changeMode('settlement');
      if (i % 24 === 23) check();
    }
  };
  const note = (a, b, deed, n) => {
    for (let i = 0; i < n; i++) N().note(c, a, b, deed, { kin: false });
  };

  // 1. A realm of your own at Westholt, accepted by the old crown.
  CL.story.state(c).flags.ending = 'valedorn';
  CL.ui.changeMode('settlement');
  assert.ok(R().transfer(c, FORT, { holder: 'player', willing: true, reason: 'test' }), 'Westholt is yours (test setup: granted)');
  c.renown = F().RULES.renown;
  while (c.roster.length < F().RULES.soldiers) CL.save.addSoldier(c, c.roster.length % 3 ? 'footman' : 'hunter');
  const vet = CL.save.addSoldier(c, 'guard');
  vet.record.battles = CL.detachments.CAPTAIN.battles; // a veteran (test values) to keep the fort
  note(R().rulerOf('valedorn', c), 'player', 'helped', 3); // the old crown thinks well of you: it accepts
  stay(FORT);
  assert.ok(CL.rights.may(c, 'player', 'declare', FORT).ok, CL.rights.why(c, 'player', 'declare', FORT));
  const me = F().declare(c, 'player', FORT, { name: 'the Westmark' });
  assert.ok(me, 'declared');
  // A second fort for your realm (test setup: ceded to it), for a vassal's grant.
  const FORT2 = Object.keys(c.holdings).find((sid) => sid !== FORT && c.holdings[sid].kind === 'fort' && !['hrothmark', 'aurelian'].includes(c.holdings[sid].sovereign) && R().capitalOf(c.holdings[sid].sovereign, c) !== sid && !CL.content.get('settlements', sid).story && !R().locked(c, sid));
  assert.ok(R().transfer(c, FORT2, { controller: me, sovereign: me, holder: 'player', willing: true, reason: 'test' }), `${FORT2} ceded to your realm`);
  days(8, FORT);
  assert.equal(F().mine(c), me);
  assert.notEqual(R().relation(c, me, 'valedorn'), 'war', 'the old crown accepted');
  check();

  // 2. Vassals: Hrothmark's lords who resent their king and think well of you ask to swear.
  const asked = CL.lords.riders(c).filter((p) => c.people[p].realm === 'hrothmark' && c.people[p].status === 'free').slice(0, 4);
  assert.equal(asked.length, 4);
  for (const p of asked) {
    note(p, R().rulerOf('hrothmark', c), 'abandoned', 4);
    note(p, 'player', 'helped', 3);
    for (const q of asked) if (q !== p) note(p, q, 'helped', 2); // they ride together, and think well of one another
  }
  for (let w = 0; w < 4 && asked.some((p) => c.people[p].realm !== me); w++) {
    days(7, FORT);
    for (const a of [...F().rule(c).asks]) if (asked.includes(a.lord)) F().answerAsk(c, a.lord, true);
  }
  const vassals = F().vassals(c);
  assert.ok(asked.every((p) => vassals.includes(p)), `four vassals (asked: ${asked.map((p) => c.people[p].realm).join()})`);

  // 3. Rule: grants, a castellan, a treaty, and an army.
  assert.equal(c.holdings[FORT2].sovereign, me, 'the second fort is of your realm');
  const village = R().fiefsOf('player', c).find((v) => c.holdings[v].kind === 'village');
  assert.ok(village, 'a village of yours');
  assert.ok(F().grant(c, village, asked[0]), 'a land grant');
  assert.equal(R().holderOf(village, c), asked[0]);
  assert.ok(F().grant(c, FORT2, asked[1]), 'a fort granted');
  assert.equal(R().holderOf(FORT2, c), asked[1]);
  stay(FORT);
  assert.ok(CL.fiefs.appoint(c, FORT, vet.id), 'a castellan');
  assert.equal(c.holdings[FORT].castellan?.id, vet.id);
  CL.diplomacy.addTrust(c, 'aurelian', me, 20); // Aurelia has heard well of you (test setup)
  const treaty = F().propose(c, 'trade', 'aurelian');
  assert.ok(treaty.ok, `a treaty: ${treaty.why}`);
  assert.ok(CL.diplomacy.has(c, me, 'aurelian', 'trade'));
  // New vassals come thin (they changed realm) and ride home to fill their ranks first.
  const thin = () => vassals.filter((p) => !CL.lords.partyOf(c, p) || CL.lords.thin(c, CL.lords.partyOf(c, p)));
  for (let w = 0; w < 6 && thin().length > 2; w++) days(7, FORT);
  assert.ok(thin().length <= 2, `vassals ready to ride (${4 - thin().length} of 4)`);
  const raised = CL.armies.raiseMine(c);
  assert.ok(raised.ok, `an army: ${raised.why}`);
  const army = CL.armies.mine(c);
  assert.ok(army?.members.some((p) => vassals.includes(p)), 'your vassals ride in it');
  days(8, FORT);
  if (CL.armies.mine(c)?.phase !== 'rally') assert.ok(CL.armies.order(c, 'follow').ok, 'it rides with you');
  else assert.ok(CL.armies.mine(c), 'it gathers');
  assert.ok(CL.armies.order(c, 'home').ok, 'sent home');
  check();

  // 4. The save, and the page opened again.
  CL.ui.changeMode('map');
  assert.ok(CL.save.write(), 'saved');
  const savedDay = c.day;
  const roster = c.roster.map((x) => x.id).join();
  CL = boot(false);
  c = CL.campaign;
  assert.ok(Math.abs(c.day - savedDay) < 1e-9, 'resumed where it was saved');
  assert.equal(c.roster.map((x) => x.id).join(), roster);
  assert.equal(F().mine(c), me);
  assert.equal(R().rulerOf(me, c), 'player');
  assert.ok(asked.every((p) => c.people[p].realm === me), 'your vassals still');
  assert.equal(c.holdings[FORT].castellan?.id, vet.id, 'the castellan still');
  CL.ui.changeMode('settlement');

  // 5. You wrong three of them (you left them in the field, test setup); one declines your summons, and
  //    the wronged form a faction, warn you, make demands; you refuse and they rise.
  const wronged = asked.slice(1);
  for (const p of wronged) note(p, 'player', 'abandoned', 6);
  const declined = N().summon(c, me, FORT, wronged, 4);
  assert.ok(declined.refused.some((x) => wronged.includes(x.pid)), 'a disloyal lord declines your order');
  const why = declined.refused[0].r.reasons.map((x) => x.text).join('; ');
  assert.ok(why.length > 0, 'with reasons');
  N().refusals(c, me, FORT, declined.refused);
  let x = null;
  for (let w = 0; w < 6 && !x; w++) {
    days(7, FORT);
    x = RB().active(c, me);
  }
  assert.ok(x, 'a faction forms');
  assert.ok(x.members.every((p) => wronged.includes(p)), 'of the lords you wronged');
  for (let w = 0; w < 6 && x.stage !== 'demands'; w++) days(7, FORT);
  assert.equal(x.stage, 'demands', 'warned, then demands');
  assert.match(messages.join(' '), /make demands of you/);
  assert.ok(F().setPolicy(c, 'chancellor', 'none'), 'no truce with rebels: your chancellor declines every offer');
  assert.ok(RB().refuse(c, x.id).ok);
  assert.equal(x.stage, 'rising', 'they rise');
  const rising = x.rising;
  assert.equal(R().relation(c, me, rising), 'war', 'civil war');

  // 6. You lose: the rising's army takes Westholt while you are away at Stonebridge, and you are deposed.
  // Its lords' households grow strong enough (test setup: what a longer civil war would bring them) that
  // the rising's own army, which fights its crown first, marches on Westholt.
  const strong = () => {
    const need = CL.armies.needed(c, FORT);
    for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === rising)) {
      let k = 1.5;
      while (CL.autoresolve.troopsPower(CL.lords.troopsFor(c, q.lordId, k)) < need && k < 12) k += 0.5;
      if (CL.autoresolve.troopsPower(q.troops) < need) q.troops = CL.lords.troopsFor(c, q.lordId, k);
    }
  };
  c.holdings[FORT].weakUntil = Math.min(c.holdings[FORT].weakUntil || 0, c.day);
  const trace = [];
  for (let d = 0; d < 50 && R().rules('player', c); d++) {
    if (c.realms[rising]) strong();
    days(1, 'stonebridge');
    const now = CL.sieges.at(c, FORT);
    const army = CL.armies.ofRealm(c, rising);
    trace.push(now ? `${now.phase}:${now.lords.length}` : R().owner(FORT, c) === me ? (army ? `${army.objective}:${army.target}` : '-') : 'taken');
  }
  assert.equal(R().rules('player', c), null, `deposed (the siege by day: ${trace.join(' ')})`);
  assert.ok(RB().state(c).deposed, 'deposed');
  assert.match(messages.join(' '), /You are deposed/);

  // 7. A free claimant, in the same save: your company, a claim, and the game goes on.
  assert.ok(c.roster.length > 0, 'your company is yours');
  assert.ok(CL.claims.mine(c).some((k) => k.sid === FORT), 'a claim to Westholt');
  assert.equal(CL.allegiance.state(c).kind, 'independent', 'free');
  CL.ui.changeMode('map');
  assert.ok(CL.save.write(), 'saved again');
  CL = boot(false);
  c = CL.campaign;
  assert.equal(R().rules('player', c), null);
  CL.ui.changeMode('map');
  const after = makeBot(CL).play(10);
  assert.equal(after.stuck, 0, 'never stuck');
  assert.deepEqual(plain(after.invariants), [], 'the invariants, after');
  assert.equal(Object.keys(c.holdings).length, holdings, 'no holding doubled');
  assert.deepEqual(plain(problems), [], 'the invariants held every day');
});
