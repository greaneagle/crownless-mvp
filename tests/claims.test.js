// P8-08 · Losing and retaking land: every loss path ends in a defined state (holder, controller, claim,
// castellan); the landless view has no chores; a claim never pays; pressing a claim (by siege with your
// liege's backing, asking your liege, buying it back); a claim on your liege's own land becomes a grant;
// the liege's revocation with a warning first; the edges of design §27.2; SC-20 to SC-23; the same for
// AI lords; saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A sworn vassal of Valedorn holding Westholt Castle and Ashby (Prototype D's start, without the siege). */
function landed({ siege = false } = {}) {
  const env = loadGame({ party: true });
  const { CL } = env;
  const c = CL.campaign;
  c.partySpawns = {};
  for (const t of Object.values(CL.content.table('party_templates'))) if (t.kind !== 'lord') c.partySpawns[t.id] = 1e9;
  CL.game.mode = 'map';
  const r = CL.claims.prototypeD(c);
  if (!siege) c.sieges.length = 0;
  return { ...env, c, r, C: CL.claims, R: CL.realm, S: CL.sieges, F: CL.fiefs, AL: CL.allegiance };
}
const id = (c, k) => Object.keys(c.people).find((x) => c.people[x].key === k);
/** The enemy takes a fort of yours by a siege that ends `how`. */
function fall(CL, c, sid, realm, how = 'stormed') {
  const s = { id: 77, sid, realm, by: 'ai', lords: CL.lords.riders(c).filter((p) => c.people[p].realm === realm).slice(0, 2), relief: [], phase: 'encircled', began: c.day, log: [] };
  c.sieges.push(s);
  return CL.sieges.take(c, s, how);
}
/** A veteran castellan at Westholt. */
function castellan(_CL, c) {
  const s = c.roster[0];
  const h = c.holdings.westholt_castle;
  c.roster.splice(0, 1);
  h.castellan = { kind: 'soldier', id: s.id, name: s.name, soldier: s };
  return s;
}

test('Prototype D’s start: a vassal with a fort and its village, a warband of 12, a mill; the enemy gathers', () => {
  const { c, r, R } = landed({ siege: true });
  assert.deepEqual(plain(r), { fort: 'westholt_castle', village: 'ashby', enemy: 'hrothmark', siege: 'westholt_castle', mill: 'ashby' });
  assert.deepEqual(plain(R.fiefsOf('player', c)), ['westholt_castle', 'ashby']);
  assert.equal(c.roster.length, 12);
  assert.equal(c.allegiance.kind, 'vassal');
  assert.equal(R.relation(c, 'valedorn', 'hrothmark'), 'war');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('each loss path ends in a defined state: siege stormed or surrendered, revocation, release, defection, handing back', () => {
  // Stormed: control to the taker, held by its ruler; you keep an old claim (on its village too); your castellan is taken.
  {
    const { CL, c, R } = landed();
    const k = castellan(CL, c);
    fall(CL, c, 'westholt_castle', 'hrothmark', 'stormed');
    const h = c.holdings.westholt_castle;
    assert.deepEqual([h.controller, h.sovereign, h.holder], ['hrothmark', 'hrothmark', R.rulerOf('hrothmark', c)]);
    assert.deepEqual(plain(R.claimsOn('westholt_castle', c).find((x) => x.by === 'player')).kind, 'old');
    assert.equal(c.holdings.ashby.controller, 'hrothmark');
    assert.ok(R.claimsOn('ashby', c).some((x) => x.by === 'player'));
    assert.equal(h.heldCastellan.id, k.id, 'taken with the fort');
    assert.equal(c.roster.some((x) => x.id === k.id), false);
    assert.deepEqual(plain(R.invariants(c)), []);
  }
  // Surrendered: the same, but the castellan walks out to you.
  {
    const { CL, c } = landed();
    const k = castellan(CL, c);
    fall(CL, c, 'westholt_castle', 'hrothmark', 'surrendered');
    assert.equal(c.holdings.westholt_castle.heldCastellan ?? null, null);
    assert.ok(c.roster.some((x) => x.id === k.id));
  }
  // Revoked (a second missed call, after a warning): back to the crown, no claim; the fort's gates unchanged.
  {
    const { CL, c, R, AL, uiCalls } = landed();
    assert.equal(AL.missed(c), 'warned');
    assert.ok(uiCalls.some((u) => u[0] === 'message' && /King Godric Ardane warns you: miss another call and the crown takes back Ashby\./.test(u[1])));
    assert.equal(R.holderOf('ashby', c), 'player', 'a warning first');
    assert.equal(AL.missed(c), 'revoked');
    assert.equal(R.holderOf('ashby', c), R.rulerOf('valedorn', c));
    assert.equal(R.claimsOn('ashby', c).some((x) => x.by === 'player'), false, 'the liege’s right: no claim');
    assert.equal(c.holdings.ashby.controller, 'valedorn');
    void CL;
  }
  // Released at peace: no claim. Defected: a granted claim.
  {
    const { CL, c, R, AL } = landed();
    R.setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test');
    AL.state(c).window.days = 10;
    AL.act(c, 'release');
    assert.equal(R.claimsOn('westholt_castle', c).some((x) => x.by === 'player'), false);
    void CL;
  }
  {
    const { c, R, AL } = landed();
    AL.act(c, 'defect');
    assert.equal(R.claimsOn('westholt_castle', c).find((x) => x.by === 'player').kind, 'granted');
  }
  // Handed back: no claim; a castellan comes home.
  {
    const { CL, c, C, R } = landed();
    const k = castellan(CL, c);
    assert.equal(C.handBack(c, 'westholt_castle').ok, true);
    assert.equal(R.holderOf('westholt_castle', c), R.rulerOf('valedorn', c));
    assert.equal(R.claimsOn('westholt_castle', c).some((x) => x.by === 'player'), false);
    assert.ok(c.roster.some((x) => x.id === k.id));
    assert.deepEqual(plain(R.invariants(c)), []);
  }
});

test('SC-20 and SC-21: the fort falls while you are away; landless, the tab is your claims, with no chores; a claim never pays', () => {
  const { CL, c, C, R, F } = landed();
  F.setPolicy(c, 'westholt_castle', 'tax', 'heavy');
  const gold = c.gold;
  const roster = plain(c.roster.map((x) => x.id));
  fall(CL, c, 'westholt_castle', 'hrothmark');
  assert.deepEqual(plain(R.fiefsOf('player', c)), []);
  assert.equal(c.gold, gold, 'your money stays');
  assert.deepEqual(plain(c.roster.map((x) => x.id)), roster, 'your warband stays');
  assert.equal(CL.business.get(c)?.place, 'ashby', 'your mill stays yours (under the new law)');
  // The claims view.
  const list = C.mine(c);
  assert.deepEqual(plain(list.map((x) => x.sid).sort()), ['ashby', 'westholt_castle']);
  const k = C.card(c, 'westholt_castle');
  assert.match(k.lines[0], /^Westholt Castle \(fort\): held for the Valedorn Crown until it was taken on day \d+\.$/);
  assert.equal(k.lines[1], 'Now held for the Kingdom of Hrothmark by King Hakon Ulfring. A claim gives no income and no control.');
  assert.deepEqual(plain(c.holdings.westholt_castle.claims.find((x) => x.by === 'player').policies), { garrison: 'normal', tax: 'heavy', food: 14, repairs: true }, 'your policies kept with the claim');
  // A claim never pays.
  const before = CL.accounts.balance(c, 'purse');
  F.payday(c);
  assert.equal(CL.accounts.balance(c, 'purse'), before);
  assert.equal(CL.accounts.balance(c, F.account('westholt_castle')), 0);
});

test('pressing a claim: ask your liege in their war; buy it back at peace; refused against your own liege', () => {
  const { CL, c, C, R, S } = landed();
  fall(CL, c, 'westholt_castle', 'hrothmark');
  // At war: your liege presses it, and its next siege goes for it.
  CL.nobles.note(c, R.rulerOf('valedorn', c), 'player', 'helped', { kin: false });
  const r = C.askLiege(c, 'westholt_castle');
  assert.equal(r.agreed, true, r.text);
  assert.match(r.text, /King Godric Ardane will press your claim: the Valedorn lords go for Westholt Castle next\./);
  assert.equal(C.canAskLiege(c, 'westholt_castle').ok, false, 'not twice');
  assert.equal(C.pressedFor(c, 'westholt_castle', 'valedorn'), true);
  c.holdings.westholt_castle.weakUntil = c.day; // (a fort just taken: the takers consolidate; here the attackers do)
  for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn')) Object.assign(q, { x: 30, y: 60 });
  const s = S.plan(c, 'valedorn');
  assert.equal(s?.sid, 'westholt_castle');
  // At peace: buy it back from the realm holding it.
  c.sieges.length = 0;
  R.setRelation(c, 'valedorn', 'hrothmark', 'peace', 'test');
  const can = C.canBuyBack(c, 'westholt_castle');
  assert.equal(can.ok, true, can.why);
  assert.equal(can.price, 800);
  const gold = c.gold;
  assert.equal(C.buyBack(c, 'westholt_castle').ok, true);
  assert.equal(c.gold, gold - 800);
  assert.deepEqual(plain(R.fiefsOf('player', c).sort()), ['ashby', 'westholt_castle'], 'its village with it');
  assert.equal(c.holdings.westholt_castle.policies.tax, 'normal');
  assert.deepEqual(plain(R.invariants(c)), []);
  // A claim on land a lord of your own realm holds: refused while sworn.
  const { CL: CL2, c: c2, C: C2, R: R2 } = landed();
  fall(CL2, c2, 'westholt_castle', 'hrothmark');
  R2.setRelation(c2, 'valedorn', 'hrothmark', 'peace', 'test');
  R2.transfer(c2, 'westholt_castle', { controller: 'valedorn', sovereign: 'valedorn', holder: id(c2, 'hamon_greymantle'), reason: 'test' });
  assert.match(C2.canAskLiege(c2, 'westholt_castle').why, /a claim against them is refused while you are sworn/);
  assert.match(C2.canBuyBack(c2, 'westholt_castle').why, /a claim against them is refused while you are sworn/);
});

test('SC-22 and SC-23: you change kingdom after losing land, and retake it: yours again, villages too, no land or troops doubled', () => {
  const { CL, c, R, S, AL } = landed();
  const k = castellan(CL, c);
  fall(CL, c, 'westholt_castle', 'hrothmark');
  AL.expel(c, 'test');
  assert.equal(AL.state(c).kind, 'independent');
  assert.equal(R.claimsOn('westholt_castle', c).find((x) => x.by === 'player').kind, 'old', 'the claim travels with you');
  // Sworn to Aurelia (test values for the oath), at war with Hrothmark.
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'aurelian', since: c.day, window: { start: c.day, days: 10 } });
  R.setRelation(c, 'aurelian', 'hrothmark', 'war', 'test');
  const w = CL.content.get('settlements', 'westholt_castle');
  Object.assign(c.world, { x: w.mapX, y: w.mapY, location: 'westholt_castle' });
  CL.game.mode = 'settlement';
  const s = S.begin(c, 'westholt_castle');
  assert.ok(s);
  const ids = c.roster.map((x) => x.id);
  S.take(c, s, 'stormed');
  assert.equal(R.holderOf('westholt_castle', c), 'player', 'your new liege backs your claim');
  assert.equal(R.sovereignOf('westholt_castle', c), 'aurelian');
  assert.equal(R.holderOf('ashby', c), 'player', 'the village you held, too');
  assert.equal(R.claimsOn('westholt_castle', c).some((x) => x.by === 'player'), false, 'a claim made good is a claim no more');
  assert.ok(c.roster.some((x) => x.id === k.id), 'your castellan freed with the fort');
  assert.equal(new Set(c.roster.map((x) => x.id)).size, c.roster.length, 'no soldier twice');
  assert.ok(ids.every((x) => c.roster.some((y) => y.id === x)));
  assert.equal(Object.keys(c.holdings).length, Object.keys(landed().c.holdings).length, 'no holding twice');
  assert.equal(CL.game.mode, 'settlement', 'no conqueror’s choice: it was yours');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('a claim on land your liege’s crown holds becomes a grant offered to you, once', () => {
  const { CL, c, R, AL } = landed();
  fall(CL, c, 'westholt_castle', 'hrothmark');
  AL.expel(c, 'test');
  // You swear to Hrothmark, whose crown now holds Westholt.
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'hrothmark', since: c.day, window: { start: c.day, days: 10 } });
  c.grants.length = 0; // its taker handed it to the crown: no grant asked for yet
  CL.game.mode = 'battle'; // (no prompt in this test)
  CL.claims.tick(c);
  const g = c.grants.find((x) => x.sid === 'westholt_castle');
  assert.ok(g, 'offered');
  assert.equal(g.helper, 'player');
  g.day = c.day;
  CL.fiefs.decideGrants(c);
  assert.equal(CL.fiefs.grantDue(c)?.sid, 'westholt_castle');
  CL.fiefs.answer(c, 'decline');
  CL.claims.tick(c);
  assert.equal(c.grants.filter((x) => x.sid === 'westholt_castle' && x.offeredTo === 'player').length, 0, 'declined: not again');
  void R;
});

test('edges: revoked while inside; a village of another seat keeps you landed; captured twice; standing warned first', () => {
  // Revoked while you are inside the fort: you stay, the gates unchanged.
  {
    const { c, R, AL } = landed();
    R.transfer(c, 'ashby', { holder: R.rulerOf('valedorn', c), willing: true, reason: 'test' });
    const w = c.holdings.westholt_castle;
    c.world.location = 'westholt_castle';
    AL.missed(c);
    AL.missed(c);
    assert.equal(R.holderOf('westholt_castle', c), R.rulerOf('valedorn', c));
    assert.equal(w.controller, 'valedorn');
    assert.equal(c.world.location, 'westholt_castle');
    assert.deepEqual(plain(R.invariants(c)), []);
  }
  // You lose the fort but keep a village of another seat: still landed.
  {
    const { CL, c, R } = landed();
    R.transfer(c, 'brackenfield', { holder: 'player', willing: true, reason: 'test' });
    fall(CL, c, 'westholt_castle', 'hrothmark');
    assert.deepEqual(plain(R.fiefsOf('player', c)), ['brackenfield']);
  }
  // Captured twice in quick succession: the claims kept, none twice.
  {
    const { CL, c, R } = landed();
    fall(CL, c, 'westholt_castle', 'hrothmark');
    R.setRelation(c, 'aurelian', 'hrothmark', 'war', 'test');
    fall(CL, c, 'westholt_castle', 'aurelian');
    const claims = R.claimsOn('westholt_castle', c);
    assert.ok(claims.some((x) => x.by === 'player'));
    assert.ok(claims.some((x) => x.by === R.rulerOf('hrothmark', c)), 'Hrothmark’s king, who lost it, claims it too (P8-02)');
    assert.equal(new Set(claims.map((x) => x.by)).size, claims.length);
    assert.deepEqual(plain(R.invariants(c)), []);
  }
  // Your standing with your liege falling: a warning before you are cast out.
  {
    const { c, R, AL, uiCalls } = landed();
    c.reputation.valedorn = -20;
    AL.standingWarning(c);
    assert.ok(uiCalls.some((u) => u[0] === 'message' && /The Valedorn Crown think less and less of you/.test(u[1])));
    assert.equal(R.fiefsOf('player', c).length, 2);
    assert.equal(c.allegiance.warnings.standing != null, true);
  }
});

test('the same for AI lords: a seat taken leaves its lord landless, campaigning, with a claim', () => {
  const { CL, c, R } = landed();
  // Valedorn (you) takes Castra Nova from Lady Domitia.
  const domitia = id(c, 'domitia_celer');
  R.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const f = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: f.mapX, y: f.mapY, location: 'castra_nova' });
  const s = CL.sieges.begin(c, 'castra_nova');
  CL.game.mode = 'battle';
  CL.sieges.take(c, s, 'stormed');
  assert.deepEqual(plain(R.fiefsOf(domitia, c)), [], 'landless');
  assert.ok(R.claimsOn('castra_nova', c).some((x) => x.by === domitia));
  assert.ok(R.claimsOn('calvinum', c).some((x) => x.by === domitia));
  assert.equal(CL.nobles.needLine(c, domitia), 'wants Castra Nova back');
  assert.equal(CL.lords.homeOf(c, domitia), R.capitalOf('aurelian'), 'she rides from the capital now');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('saves: claims with their policies, pressing and asking; a held castellan; the warnings round-trip; junk is dropped', () => {
  const { CL, c, C, AL } = landed();
  castellan(CL, c);
  fall(CL, c, 'westholt_castle', 'hrothmark');
  CL.nobles.note(c, CL.realm.rulerOf('valedorn', c), 'player', 'helped', { kin: false });
  C.askLiege(c, 'westholt_castle');
  CL.realm.transfer(c, 'brackenfield', { holder: 'player', willing: true, reason: 'test' });
  AL.missed(c);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.holdings.westholt_castle.claims), plain(c.holdings.westholt_castle.claims));
  assert.deepEqual(plain(back.holdings.westholt_castle.heldCastellan), plain(c.holdings.westholt_castle.heldCastellan));
  assert.deepEqual(plain(back.allegiance.warnings), plain(c.allegiance.warnings));
  const d = plain(c);
  const k = d.holdings.westholt_castle.claims.find((x) => x.by === 'player');
  Object.assign(k, { pressed: 'soon', policies: { garrison: 'huge', tax: 'heavy' } });
  d.holdings.westholt_castle.heldCastellan = { kind: 'soldier', soldier: { id: c.roster[0].id, troop: 'footman' } }; // the same soldier twice
  const fixed = CL.save.fromRaw(d).campaign;
  const fk = fixed.holdings.westholt_castle.claims.find((x) => x.by === 'player');
  assert.equal(fk.pressed, undefined);
  assert.deepEqual(plain(fk.policies), { garrison: 'normal', tax: 'heavy', food: 14, repairs: true });
  assert.equal(fixed.holdings.westholt_castle.heldCastellan ?? null, null);
});
