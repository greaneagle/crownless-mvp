// P8-T: the Phase 8 exit as a 120-day scripted campaign, in one save with a reload in the middle:
// acquire land, lose it, go landless, change allegiance, retake it (design §28.1, §17.6). With the
// world's parties riding, the company:
//   1. takes service with Valedorn at Stonebridge and serves it (the landed bot plays it, days 0–25),
//      then swears fealty;
//   2. acquires land: Valedorn at war with Hrothmark, it besieges Ulfstead Hold and storms it, asks
//      the crown for it (the conqueror's choice), and is granted it;
//   3. is saved at day 60 and reloaded (the page closed and opened again);
//   4. loses it: Hrothmark's lords retake Ulfstead while the company is away at Stonebridge;
//   5. goes landless (the Claims view), defects from Valedorn, and serves Aurelia, the enemy's enemy,
//      until it may swear;
//   6. retakes Ulfstead for Aurelia, which backs the claim: it is the company's again.
// The invariants hold every day; nothing is doubled; the company never stalls.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('../helpers/load');
const { makeBot, headlessUi } = require('../helpers/campaign-bot');

test('the Phase 8 exit: acquire, lose, go landless, change allegiance, retake, in one save with a reload', () => {
  const storage = memoryStorage();
  const messages = [];
  const boot = (fresh) => {
    const env = loadGame({ party: false, worldParties: true, seed: 8, storage });
    env.CL.ui = headlessUi(env.CL, messages);
    if (fresh) {
      env.CL.game.newGame = true;
      env.CL.character.begin({ name: 'Exit8', background: 'farmhand' });
      const c = env.CL.campaign;
      c.rngSeed = 8;
      c.rng = env.CL.autoresolve.streamSeeds(8); // the dice streams too, or a new game seeds them from the clock
      // The world's parties again, from the fixed seed (the new game spawned them from the clock's).
      Object.assign(c, { parties: [], partySpawns: {}, nextPartyId: 1 });
      env.CL.parties.ensure(c, true);
    }
    return env.CL;
  };
  let CL = boot(true);
  let c = CL.campaign;
  const R = () => CL.realm;
  const problems = [];
  const check = () => {
    for (const p of R().invariants(c)) if (problems.length < 10) problems.push(`day ${Math.floor(c.day)}: ${p}`);
    assert.equal(new Set(c.roster.map((x) => x.id)).size, c.roster.length, 'no soldier twice');
  };
  const holdings = Object.keys(c.holdings).length;
  const FORT = 'ulfstead_hold';
  const stay = (sid) => {
    const s = CL.content.get('settlements', sid);
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
  };
  /** Days pass with the company at a place (fed and paid: the money is not the point here). */
  const days = (n, at = null) => {
    for (let i = 0; i < n * 24; i++) {
      if (at) stay(at);
      c.food = Math.max(c.food, 80);
      c.gold = Math.max(c.gold, 600);
      // The company does its service (this exit is about a siege's loss, not a revocation for missed calls).
      const a = CL.allegiance.state(c);
      if (a.window) a.window.days = Math.max(a.window.days, 10);
      if (c.nobles?.summons) c.nobles.summons.answered = true;
      CL.party.advanceDays(1 / 24);
      CL.game.contactParty = null;
      if (!['map', 'settlement'].includes(CL.game.mode)) CL.ui.changeMode(at ? 'settlement' : 'map');
      if (i % 24 === 23) check();
    }
  };
  /** A war begun now (test setup): a pair already at war keeps its old start, and a long war ends by exhaustion. */
  const war = (a, b) => {
    R().setRelation(c, a, b, 'tension', 'test');
    R().setRelation(c, a, b, 'war', 'test');
  };
  const recruit = (n) => {
    for (let i = 0; i < n; i++) CL.save.addSoldier(c, i % 3 ? 'footman' : 'hunter');
  };

  // 1. Service with Valedorn (the landed bot), then fealty.
  CL.story.state(c).flags.ending = 'valedorn'; // the sandbox after the story: wars can come
  CL.ui.changeMode('settlement');
  recruit(8);
  c.gold = 800;
  const bot = makeBot(CL, { style: 'landed' }).play(25);
  assert.equal(bot.stuck, 0);
  check();
  // Test values to reach the oath in time (standing and renown come from play in a longer campaign).
  R().adjust(c, 'valedorn', Math.max(0, 30 - c.reputation.valedorn), 'test: service');
  c.renown = Math.max(c.renown, 160);
  CL.ui.changeMode('settlement');
  stay('stonebridge');
  if (CL.allegiance.state(c).kind !== 'mercenary' || CL.allegiance.state(c).realm !== 'valedorn') {
    if (CL.allegiance.state(c).kind === 'independent') CL.allegiance.act(c, 'serve', 'valedorn');
    days(21, 'stonebridge');
  }
  assert.ok(CL.allegiance.act(c, 'swear', 'valedorn'), `swear: ${CL.rights.why(c, 'player', 'swear', 'valedorn')}`);
  assert.equal(CL.allegiance.sworn(c), 'valedorn');

  // 2. Acquire: Valedorn at war with Hrothmark; storm Ulfstead Hold, ask the crown for it, accept the grant.
  war('valedorn', 'hrothmark');
  c.sieges = c.sieges.filter((s) => s.realm !== 'valedorn');
  recruit(24);
  stay(FORT);
  CL.ui.changeMode('settlement');
  const s = CL.sieges.begin(c, FORT);
  assert.ok(s, `besiege: ${CL.rights.why(c, 'player', 'besiege', FORT)}`);
  const storm = (n) => {
    const trace = [];
    for (let d = 0; d < n && CL.sieges.at(c, FORT); d++) {
      days(1, FORT);
      const now = CL.sieges.at(c, FORT);
      const o = now ? CL.sieges.odds(c, now) : 1;
      trace.push(`${Math.round(o * 100)}%`);
      // Storm with good odds, or once the ram is ready.
      if (now && (o > 0.5 || c.day - now.began >= CL.sieges.RULES.ram)) CL.sieges.playerAssault(c);
      if (!CL.sieges.at(c, FORT) && R().owner(FORT, c) !== CL.allegiance.serves(c) && c.roster.length >= 12) {
        recruit(6); // thrown back: rest and go again
        CL.sieges.begin(c, FORT);
      }
    }
    return trace.join(' ');
  };
  const t1 = storm(20);
  assert.equal(R().owner(FORT, c), 'valedorn', `Ulfstead taken for Valedorn (odds by day: ${t1})`);
  // The conqueror's choice (a prompt in the game; the test makes its default): ask the crown for it.
  if (!(c.grants || []).some((g) => g.sid === FORT)) CL.fiefs.conquered(c, FORT, 'player', 'ask');
  CL.ui.changeMode('map');
  for (let d = 0; d < 8 && R().holderOf(FORT, c) !== 'player'; d++) {
    days(1, 'stonebridge');
    if (CL.fiefs.grantDue(c)) CL.fiefs.answer(c, 'accept');
  }
  assert.equal(R().holderOf(FORT, c), 'player', 'granted Ulfstead Hold');
  const acquired = Math.floor(c.day);
  R().setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test'); // the war ends with Ulfstead yours

  // 3. The save at day 60, and the page opened again.
  if (c.day < 60) days(60 - c.day, 'stonebridge');
  if (CL.fiefs.grantDue(c)) CL.fiefs.answer(c, 'decline');
  CL.ui.changeMode('map');
  assert.ok(CL.save.write(), 'saved');
  const savedDay = c.day;
  const roster = c.roster.map((x) => x.id).join();
  CL = boot(false);
  c = CL.campaign;
  assert.ok(Math.abs(c.day - savedDay) < 1e-9, 'resumed where it was saved');
  assert.equal(c.roster.map((x) => x.id).join(), roster);
  assert.equal(R().holderOf(FORT, c), 'player');
  CL.ui.changeMode('map');

  // 4. Lose it: Hrothmark's lords take Ulfstead back while the company is at Stonebridge.
  c.holdings[FORT].weakUntil = c.day; // (its month of weakness over)
  const fort = CL.content.get('settlements', FORT);
  // A host strong enough to take it (half again their households): this step is the loss while away, not
  // the odds of one storm (from 3.3.0 the campaign's dice fall differently, and a first storm at 1.3 : 1 failed).
  for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'hrothmark')) Object.assign(q, { x: fort.mapX + 3, y: fort.mapY + 3, tx: null, ty: null, troops: CL.lords.troopsFor(c, q.lordId, 1.5) });
  c.sieges = c.sieges.filter((x) => x.realm !== 'hrothmark');
  war('valedorn', 'hrothmark'); // the war comes again
  for (const h of Object.values(c.holdings)) if (h.controller === 'hrothmark') h.weakUntil = Math.min(h.weakUntil || 0, c.day); // nothing of theirs still settling
  const plan = CL.sieges.plan(c, 'hrothmark', FORT);
  assert.ok(plan, `Hrothmark gathers against it (relation ${R().relation(c, 'valedorn', 'hrothmark')})`);
  const trace = [];
  for (let d = 0; d < 25 && R().holderOf(FORT, c) === 'player'; d++) {
    days(1, 'stonebridge');
    const now = CL.sieges.at(c, FORT);
    trace.push(now ? `${now.phase}:${now.lords.length}/${now.relief.length}` : '-');
  }
  assert.notEqual(R().holderOf(FORT, c), 'player', `lost (the siege by day: ${trace.join(' ')})`);
  assert.equal(R().owner(FORT, c), 'hrothmark');
  R().setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test'); // that war ends: Hrothmark keeps it

  // 5. Landless: the Claims view, no chores; defect, serve Aurelia, swear.
  assert.deepEqual(JSON.parse(JSON.stringify(R().fiefsOf('player', c))), []);
  assert.ok(CL.claims.mine(c).some((x) => x.sid === FORT), 'a claim kept');
  assert.ok(CL.allegiance.act(c, 'defect'), 'defect from Valedorn');
  days(8, 'stonebridge'); // a week between oaths
  war('aurelian', 'hrothmark');
  R().adjust(c, 'aurelian', Math.max(0, 30 - c.reputation.aurelian), 'test: you helped them');
  const cap = R().capitalOf('aurelian');
  stay(cap);
  assert.ok(CL.allegiance.act(c, 'serve', 'aurelian'), `serve Aurelia: ${CL.rights.why(c, 'player', 'serve', 'aurelian')}`);
  days(21, cap);
  if (CL.allegiance.state(c).kind !== 'mercenary') CL.allegiance.act(c, 'serve', 'aurelian');
  stay(cap);
  assert.ok(CL.allegiance.act(c, 'swear', 'aurelian'), `swear to Aurelia: ${CL.rights.why(c, 'player', 'swear', 'aurelian')}`);

  // 6. Retake Ulfstead for Aurelia: the claim backed, it is the company's again.
  war('aurelian', 'hrothmark');
  c.sieges = c.sieges.filter((x) => x.realm !== 'aurelian' && x.sid !== FORT);
  c.holdings[FORT].weakUntil = c.day;
  recruit(16);
  stay(FORT);
  CL.ui.changeMode('settlement');
  const s2 = CL.sieges.begin(c, FORT);
  assert.ok(s2, `besiege again: ${CL.rights.why(c, 'player', 'besiege', FORT)}`);
  const t2 = storm(20);
  assert.equal(R().owner(FORT, c), 'aurelian', `retaken for Aurelia (odds by day: ${t2})`);
  assert.equal(R().holderOf(FORT, c), 'player', 'the claim backed: yours again');
  if (c.day < 120) days(120 - c.day, FORT);
  assert.ok(c.day >= 120 - 1e-6, `120 days played (day ${c.day.toFixed(1)})`);
  assert.ok(acquired < 60, `land acquired by day ${acquired}`);
  assert.equal(Object.keys(c.holdings).length, holdings, 'no holding doubled');
  assert.deepEqual(problems, [], 'the invariants held every day');
});
