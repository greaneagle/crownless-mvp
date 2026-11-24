// P8-01 · Lords on the map: a party a lord, sized by what they hold; intentions; encounters, sides,
// capture and ransom both ways, off-screen captivity; save v20 and 2.25.0's saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');
const { makeBot } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));
const byKey = (c, key) => Object.keys(c.people).find((id) => c.people[id].key === key);
const count = (troops) => Object.values(troops).reduce((a, b) => a + b, 0);

/** A world with the lords riding (and the other parties too, unless `only`). */
function world({ only = true, ...opts } = {}) {
  const env = loadGame({ party: true, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  if (only) for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.lords.ensure(c, c.day, true);
  return { ...env, c, L: CL.lords };
}

test('every free lord rides with their household, formed at home; rulers keep to their halls', () => {
  const { CL, c, L } = world();
  const lords = c.parties.filter((p) => p.lordId);
  assert.equal(lords.length, 32, 'every lord but the six rulers (P10-02: the coast’s ten too)');
  for (const id of Object.values(c.rulers)) assert.equal(L.partyOf(c, id), null);
  for (const p of lords) {
    const home = CL.content.table('settlements')[c.people[p.lordId].home];
    assert.deepEqual([p.x, p.y], [home.mapX, home.mapY], `${p.lordId} at home`);
    assert.equal(CL.content.get('party_templates', p.template).faction, c.people[p.lordId].realm);
  }
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
  // Idempotent: nobody rides twice.
  L.ensure(c, c.day, true);
  assert.equal(c.parties.filter((p) => p.lordId).length, 32);
});

test('party sizes follow what a lord holds, and change as land is granted and lost', () => {
  const { CL, c, L } = world();
  const size = (key) => L.sizeFor(c, byKey(c, key));
  const k = CL.world.armies().households; // P9-B3: the world's households (data/world_map.js `armies`)
  assert.equal(size('tancred_greymantle'), 12 * k, 'landless');
  assert.equal(size('hawise_greymantle'), 16 * k, 'a village');
  assert.equal(size('hamon_greymantle'), 24 * k, 'a fort and a village');
  for (const key of ['tancred_greymantle', 'hawise_greymantle', 'hamon_greymantle']) assert.equal(count(L.partyOf(c, byKey(c, key)).troops), size(key), key);
  // More veterans with a higher standing.
  const share = (key) => {
    const t = L.partyOf(c, byKey(c, key)).troops;
    const T3 = Object.entries(t).filter(([id]) => CL.content.troop(id).tier === 'T3').reduce((n, [, k]) => n + k, 0);
    return T3 / count(t);
  };
  assert.ok(share('hamon_greymantle') > share('tancred_greymantle'));
  // A grant: Tancred is given Oakford and leads more; Hamon loses Greywall and leads fewer.
  const tancred = byKey(c, 'tancred_greymantle');
  CL.realm.transfer(c, 'oakford', { holder: tancred, reason: 'test' });
  assert.equal(L.sizeFor(c, tancred), 16 * k);
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian', 'test');
  assert.equal(size('hamon_greymantle'), 12 * k, 'landless now');
  // Back home, the household refills to what they hold now.
  const p = L.partyOf(c, tancred);
  L.refill(c, p);
  assert.equal(count(p.troops), 16 * k);
});

test('intentions follow the state: landless lords campaign, nobody rides home from home, the thin go home', () => {
  const { CL, c, L } = world();
  const seen = new Set();
  for (let day = 0; day < 20; day++) {
    CL.party.advanceDays(1);
    for (const p of c.parties.filter((q) => q.lordId)) {
      seen.add(p.intent);
      const home = CL.content.table('settlements')[c.people[p.lordId].home];
      const atHome = CL.world.mapDist(p.x, p.y, home.mapX, home.mapY) <= 0.9;
      if (!CL.realm.fiefsOf(p.lordId, c).length) assert.notEqual(p.intent, 'patrol', `${p.lordId}: landless lords never ride the bounds of their lands`);
      assert.ok(!(p.intent === 'home' && atHome && p.tx === null), `${p.lordId}: "riding home" while at home`);
      assert.ok(Object.hasOwn(L.WORDS, p.intent) || p.intent === 'ride', p.intent);
    }
    assert.deepEqual(plain(CL.realm.invariants(c)), [], `day ${day}`);
  }
  assert.ok(seen.has('patrol') && (seen.has('campaign') || seen.has('ride')), [...seen].join());
  // A thinned household turns for home and refills there.
  const away = (q) => {
    const h = CL.content.table('settlements')[L.homeOf(c, q.lordId)];
    return CL.world.mapDist(q.x, q.y, h.mapX, h.mapY) > 3;
  };
  const p = c.parties.find((q) => q.lordId && q.intent !== 'chase' && away(q)); // one away from home
  p.troops = { [Object.keys(p.troops)[0]]: 2 };
  Object.assign(p, { tx: null, intent: 'campaign' });
  for (let i = 0; i < 12 && p.intent !== 'home'; i++) CL.party.advanceDays(1 / 24); // a party far from you acts once its hour comes (W-07)
  assert.equal(p.intent, 'home');
  assert.equal(L.doingLine(c, p), 'riding home to refill the ranks');
  for (let i = 0; i < 40 && p.intent === 'home'; i++) CL.party.advanceDays(0.25);
  assert.equal(p.intent, 'rest');
  assert.equal(count(p.troops), L.sizeFor(c, p.lordId), 'refilled');
});

test('the tap card: who the lord is, what they are doing, and their top need', () => {
  const { c, L } = world();
  const hamon = L.partyOf(c, byKey(c, 'hamon_greymantle'));
  const tancred = L.partyOf(c, byKey(c, 'tancred_greymantle'));
  const bastiano = L.partyOf(c, byKey(c, 'bastiano_lanza'));
  assert.deepEqual(plain(L.describe(c, hamon)), { who: 'Lord Hamon Greymantle, holder of Greywall Fort and Highmere', doing: 'resting at Greywall Fort', need: 'content' }); // P8-07: and their top need
  assert.equal(L.whoLine(c, tancred.lordId), 'Lord Tancred Greymantle, Lord Hamon Greymantle’s son, landless');
  assert.equal(L.whoLine(c, bastiano.lordId), 'Lord Bastiano Lanza, sworn to Queen Lucrezia Salviati, landless');
  hamon.intent = 'home';
  assert.equal(L.doingLine(c, hamon), 'riding home to refill the ranks');
});

test('meeting a lord: their words, a −25 reputation cost to attack, sides like a patrol', () => {
  const { CL, c, L } = world();
  const p = L.partyOf(c, byKey(c, 'hamon_greymantle'));
  CL.parties.open(p.id);
  const e = CL.parties.current(c);
  assert.equal(e.name, 'Lord Hamon Greymantle');
  assert.match(e.text, /^Lord Hamon Greymantle, holder of Greywall Fort and Highmere, resting at Greywall Fort\. "Hold there\. You ride on Lord Hamon Greymantle’s land/);
  assert.deepEqual(plain(e.def.leader), { troop: 'guard', name: 'Lord Hamon Greymantle', hp: 2, damage: 1.35 });
  const rep = c.reputation.valedorn;
  CL.parties.attack();
  assert.equal(c.reputation.valedorn, rep - 25);
  const lead = CL.game.enemies.find((u) => u.named);
  assert.equal(lead.named, 'Lord Hamon Greymantle');
  assert.equal(lead.troop, 'guard');
  assert.equal(lead.maxhp, Math.round(CL.content.troop('guard').hp * 2));
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
  // Sides: a lord stands with their realm, as a patrol does.
  const R = CL.reinforce;
  const tancred = L.partyOf(c, byKey(c, 'tancred_greymantle'));
  assert.equal(R.sideOf(c, tancred, { kind: 'lord', faction: 'valedorn' }), 'enemy', 'against their own realm');
  assert.equal(R.sideOf(c, tancred, { kind: 'bandit', faction: 'neutral' }), null, 'only a friend gets help');
  CL.realm.adjust(c, 'valedorn', 100);
  assert.equal(R.sideOf(c, tancred, { kind: 'bandit', faction: 'neutral' }), 'ally');
  assert.equal(R.sideOf(c, tancred, { kind: 'lord', faction: 'aurelian' }), 'ally');
});

test('capture once, ransom once: kin with land pay 100 and 25 a soldier; Hold waits; Release earns renown', () => {
  const { CL, c, L, uiCalls } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  const p = L.partyOf(c, hamon);
  const led = count(p.troops);
  CL.parties.open(p.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  CL.world.returnToMap();
  assert.equal(c.people[hamon].status, 'captive');
  assert.equal(c.people[hamon].heldBy, 'player');
  assert.equal(L.partyOf(c, hamon), null, 'not on the map');
  assert.equal(L.prisoners(c).length, 1);
  assert.ok(c.news.events.some((e) => e.kind === 'lord_captured'));
  assert.ok(c.news.events.some((e) => e.kind === 'lord_beaten'));
  assert.equal(CL.parties.find(c, p.id), null);
  L.ensure(c, c.day, true);
  assert.equal(L.partyOf(c, hamon), null, 'a captive forms no party');
  // The offer comes after 2–4 days.
  const x = L.prisonerOf(c, hamon);
  assert.ok(x.offerDay >= x.since + 2 && x.offerDay <= x.since + 4);
  assert.equal(L.answer(c, hamon, 'accept'), null, 'no offer yet');
  c.day = x.offerDay;
  assert.equal(L.offerDue(c), x);
  assert.equal(L.ransomOf(x), 100 + 25 * x.led);
  assert.ok(x.led >= led, 'the soldiers they led');
  assert.match(L.offerText(c, x), /^Lady Hawise Greymantle offers \d+ crowns for her brother, Lord Hamon Greymantle, your prisoner since day \d+\.$/, 'kin with land pay');
  // Hold: another offer in 2–4 days.
  const held = L.answer(c, hamon, 'hold');
  assert.ok(held.nextOffer >= c.day + 2 && held.nextOffer <= c.day + 4);
  assert.equal(L.offerDue(c), null);
  c.day = held.nextOffer;
  const gold = c.gold;
  assert.deepEqual(plain(L.answer(c, hamon, 'accept')), { choice: 'accept', gold: L.ransomOf(x), text: `Lord Hamon Greymantle is ransomed for ${L.ransomOf(x)} crowns.` });
  assert.equal(c.gold, gold + L.ransomOf(x));
  assert.equal(L.answer(c, hamon, 'accept'), null, 'never twice');
  assert.equal(c.people[hamon].status, 'free');
  assert.deepEqual(plain(c.people[hamon].deeds.map((d) => d.kind)), ['held', 'ransomed']);
  assert.equal(c.people[byKey(c, 'hawise_greymantle')].deeds.at(-1).kind, 'held_kin', 'a kinsman remembers who held them');
  assert.ok(c.news.events.some((e) => e.kind === 'lord_ransomed'));
  L.ensure(c, c.day, true);
  const back = L.partyOf(c, hamon);
  assert.equal(count(back.troops), Math.round(L.sizeFor(c, hamon) * L.REGROUP), 'home again with a share of the ranks');
  assert.equal(back.intent, 'home');
  // Release for nothing: renown and goodwill; their realm's ruler pays for one with no landed kin.
  const bastiano = byKey(c, 'bastiano_lanza');
  L.beaten(c, L.partyOf(c, bastiano), 'player');
  const y = L.prisonerOf(c, bastiano);
  c.day = y.offerDay;
  assert.match(L.offerText(c, y), /^Queen Lucrezia Salviati offers .* for her sworn lord, Lord Bastiano Lanza/);
  const renown = c.renown;
  L.answer(c, bastiano, 'release');
  assert.equal(c.renown, renown + L.RANSOM.freedRenown);
  assert.equal(c.people[bastiano].deeds.at(-1).kind, 'freed');
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /without a ransom/.test(u[1])));
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
});

test('escape ends a ransom: 3% a day, 8% with under six soldiers', () => {
  const { CL, c, L } = world({ random: () => 0.05 });
  const hamon = byKey(c, 'hamon_greymantle');
  L.beaten(c, L.partyOf(c, hamon), 'player');
  c.roster = c.roster.slice(0, 5); // under six: 8%
  let days = 0;
  while (L.prisonerOf(c, hamon) && days++ < 400) CL.party.advanceDays(1);
  assert.equal(L.prisonerOf(c, hamon), null, 'escaped in the end');
  assert.equal(c.people[hamon].status, 'free');
  c.day += 5;
  assert.equal(L.answer(c, hamon, 'accept'), null, 'no ransom once they are gone');
  assert.ok(c.news.events.some((e) => e.kind === 'lord_ransomed' && /escaped/.test(e.text)));
  // The chances themselves.
  assert.equal(L.RANSOM.escape, 0.03);
  assert.equal(L.RANSOM.escapeWeak, 0.08);
});

test('off-screen: a lord beaten by a rival realm is ransomed by their own after 5–15 days, then rides again; Reavers only send them home', () => {
  const { CL, c, L } = world();
  const tancred = byKey(c, 'tancred_greymantle');
  L.beaten(c, L.partyOf(c, tancred), 'aurelian');
  const x = L.prisonerOf(c, tancred);
  assert.equal(c.people[tancred].heldBy, 'aurelian');
  assert.ok(x.release >= c.day + 5 && x.release <= c.day + 15, 'their kin first offer');
  assert.equal(x.offerDay, null, 'no offer to you');
  // P9-L1: who pays, from their fiefs, into the captor crown's treasury (P9-01) (test setup: enough in one fief).
  const payer = L.payerOf(c, tancred);
  const purse = CL.realm.fiefsOf(payer, c).map((sid) => c.holdings[sid]);
  for (const h of purse) h.treasury = 0;
  purse[0].treasury = L.ransomOf(x) + 40;
  const before = CL.crowns.treasury(c, 'aurelian');
  c.day = x.release; // test setup: their offer's day
  assert.equal(L.kinRansom(c, x), 'paid');
  assert.equal(purse[0].treasury, 40, 'paid from the payer’s fief');
  assert.equal(CL.crowns.treasury(c, 'aurelian'), before + L.ransomOf(x), 'into the captor crown’s treasury: no money from nowhere');
  assert.equal(CL.crowns.record(c, 'aurelian').book.at(-1).in.ransom, L.ransomOf(x), 'on its book');
  assert.equal(L.prisonerOf(c, tancred), null);
  assert.ok(CL.nobles.opinion(c, tancred, CL.realm.rulerOf('aurelian', c)) < 0, 'they remember who held them');
  CL.party.advanceDays(2);
  assert.ok(L.partyOf(c, tancred), 'riding again');
  const hawise = byKey(c, 'hawise_greymantle');
  assert.equal(L.beaten(c, L.partyOf(c, hawise), null), null);
  assert.equal(c.people[hawise].status, 'free');
  L.ensure(c, c.day, true);
  assert.ok(L.partyOf(c, hawise), 'home again at once, thinner');
});

test('beaten by a lord: ransomed, not robbed, and let go at their home; your prisoners get free', () => {
  const { CL, c, L } = world();
  const avice = byKey(c, 'avice_westmere');
  const tancred = byKey(c, 'tancred_greymantle');
  L.beaten(c, L.partyOf(c, tancred), 'player');
  c.inventory = { bandage: 3 };
  c.gold = 500;
  const p = L.partyOf(c, avice);
  CL.parties.open(p.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(false);
  assert.equal(CL.game.result.ransomedBy, avice);
  assert.equal(c.gold, 400, 'you keep at least 80%');
  assert.deepEqual(plain(c.inventory), { bandage: 3 }, 'nothing taken from your pack');
  assert.deepEqual(plain(CL.game.result.freedPrisoners), [tancred]);
  assert.equal(c.people[tancred].status, 'free');
  CL.world.returnToMap();
  const home = CL.content.table('settlements')[c.people[avice].home];
  assert.deepEqual([c.world.x, c.world.y], [home.mapX, home.mapY], 'let go at Westholt');
  assert.ok(L.partyOf(c, avice), 'the lord keeps the field');
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
});

test('saves: prisoners and lords’ parties round-trip; a captive on the map, or held twice, is repaired', () => {
  const { CL, c, L } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  L.beaten(c, L.partyOf(c, hamon), 'player');
  L.beaten(c, L.partyOf(c, byKey(c, 'decimo_vatro')), 'valedorn');
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.prisoners), plain(c.prisoners));
  assert.deepEqual(plain(back.parties.filter((p) => p.lordId)), plain(c.parties.filter((p) => p.lordId)));
  const d = plain(c);
  d.prisoners.push({ ...d.prisoners[0] }, { lord: 'person:999', by: 'player' }, { lord: byKey(c, 'tancred_greymantle'), by: 'valedorn' });
  d.parties.push({ ...d.parties.find((p) => p.lordId), id: 999 });
  d.parties.push({ id: 1000, template: 'lord_valedorn', lordId: hamon, x: 10, y: 10, troops: { levy: 3 } });
  const fixed = CL.save.fromRaw(d).campaign;
  assert.equal(fixed.prisoners.length, 2, 'held twice, nobody, and by their own realm: dropped');
  assert.equal(fixed.parties.filter((p) => p.lordId === hamon).length, 0, 'a captive never rides');
  assert.deepEqual(plain(CL.realm.invariants(fixed)), []);
  // v19 → v20: no prisoners.
  const v19 = plain(c);
  v19.version = 19;
  delete v19.prisoners;
  assert.deepEqual(plain(CL.save.migrate(v19).prisoners), []);
});

test('90 days of a bot company with the lords: the invariants hold every day', () => {
  const { CL } = newCampaign(13);
  const bot = makeBot(CL);
  for (let day = 1; day <= 90; day++) {
    bot.play(1);
    assert.deepEqual(plain(CL.realm.invariants(CL.campaign)), [], `day ${day}`);
  }
  assert.deepEqual(plain(bot.stats.invariants), []);
  assert.ok(CL.campaign.parties.filter((p) => p.lordId).length >= 18, 'most lords still riding');
});

test('P9-L1 kin ransom: short of money they wait a week; after 30 days the ruler pays; after 60 unpaid they are let go', () => {
  const { CL, c, L } = world();
  const tancred = byKey(c, 'tancred_greymantle');
  L.beaten(c, L.partyOf(c, tancred), 'aurelian');
  const x = L.prisonerOf(c, tancred);
  const ruler = CL.realm.rulerOf('valedorn', c);
  const broke = () => {
    for (const h of Object.values(c.holdings)) if (h.holder !== 'player') h.treasury = 0; // test setup: nobody can pay
    for (const f of Object.keys(CL.crowns.ensure(c))) CL.crowns.pay(c, CL.crowns.side(f), 'world', CL.crowns.treasury(c, f), 'debug'); // nor any crown
  };
  broke();
  c.day = x.release;
  assert.equal(L.kinRansom(c, x), 'wait');
  assert.equal(x.release, c.day + L.KIN_RANSOM.retry);
  // Day 30: the ruler's turn, and they pay from the realm's treasury (P9-01).
  c.day = x.since + L.KIN_RANSOM.rulerAfter;
  assert.ok(ruler);
  CL.crowns.pay(c, 'world', CL.crowns.side('valedorn'), L.ransomOf(x), 'debug');
  assert.equal(L.kinRansom(c, x), 'paid');
  assert.equal(CL.crowns.treasury(c, 'valedorn'), 0);
  assert.equal(CL.crowns.treasury(c, 'aurelian'), L.ransomOf(x));
  // Another, never paid: let go after 60 days.
  const hawise = byKey(c, 'hawise_greymantle');
  L.beaten(c, L.partyOf(c, hawise), 'aurelian');
  const y = L.prisonerOf(c, hawise);
  broke();
  c.day = y.since + L.KIN_RANSOM.letGo;
  assert.equal(L.kinRansom(c, y), 'let go');
  assert.equal(c.people[hawise].status, 'free');
  assert.equal(L.invariants(c).length, 0, L.invariants(c).join('; '));
});
