// P8-05 · Fiefs and castellans: each holding's week (tax, wages, due, refill, drift), its own book,
// policies, desertion, castellans, the crown's grants, the conqueror's choice, SC-19 and SC-44.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');
const { makeBot } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));
const byKey = (c, key) => Object.keys(c.people).find((id) => c.people[id].key === key);
const FIX = path.join(__dirname, 'fixtures', 'saves-2.27');

function vassal(realm = 'valedorn', opts = {}) {
  const env = loadGame({ party: true, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  Object.assign(c, { gold: 1000, food: 300 });
  Object.assign(c.allegiance, { kind: 'vassal', realm, since: c.day, window: { start: c.day, days: 10 } });
  return { ...env, c, F: CL.fiefs, R: CL.realm };
}
const grantMe = (CL, c, sid) => CL.realm.transfer(c, sid, { holder: 'player', willing: true, reason: 'test' });
const weeks = (CL, n) => {
  for (let i = 0; i < n * 7; i++) {
    CL.party.advanceDays(1);
    CL.game.contactParty = null;
  }
};

test('every holding has its state: prosperity, unrest, policies; forts a garrison, villages a militia', () => {
  const { c, F, R } = vassal();
  for (const [sid, h] of Object.entries(c.holdings)) {
    assert.ok(h.prosperity >= 0 && h.unrest >= 0, sid);
    assert.deepEqual(plain(h.policies), plain(F.policies()), sid);
    if (h.kind === 'fort') assert.equal(F.count(h.garrison), 22, `${sid}: its garrison`);
    if (h.kind === 'village') assert.equal(h.militia, 6, sid);
    assert.ok(h.treasury > 0, `${sid}: something in hand`);
  }
  assert.equal(c.holdings.stonebridge.crownLand, true, 'the crown’s own land');
  assert.equal(c.holdings.oakford.crownLand, true);
  assert.equal(c.holdings.greywall_fort.crownLand, false);
  assert.deepEqual(plain(R.garrison('greywall_fort', c)), plain(c.holdings.greywall_fort.garrison), 'the garrison as it stands');
});

test('a fief of yours: its own book, exact against its weekly reports over 90 days; one line for all your fiefs', () => {
  const { CL, c, F, uiCalls } = vassal();
  grantMe(CL, c, 'westholt_castle');
  grantMe(CL, c, 'fernley');
  const acct = (sid) => CL.accounts.balance(c, F.account(sid));
  assert.ok(acct('westholt_castle') > 0, 'its treasury came with it');
  CL.game.mode = 'map';
  // 13 weeks, each one's account change checked against its book and its report.
  for (let w = 0; w < 13; w++) {
    const before = { westholt_castle: acct('westholt_castle'), fernley: acct('fernley') };
    weeks(CL, 1);
    for (const sid of ['westholt_castle', 'fernley']) {
      const h = c.holdings[sid];
      const r = h.report;
      const net = r.tax - r.due - r.wages - r.steward - r.repairs - r.refill - (h.kind === 'village' ? (h.book.filter((l) => l.day === r.day && /^militia at/.test(l.why)).reduce((n, l) => n + l.amount, 0)) : 0);
      assert.equal(acct(sid) - before[sid], net, `week ${w + 1}, ${sid}: the account against its report`);
      const week = h.book.filter((l) => l.day === r.day);
      assert.equal(week.reduce((n, l) => n + (l.to === F.account(sid) ? l.amount : -l.amount), 0), net, `week ${w + 1}, ${sid}: and against its book`);
    }
  }
  for (const sid of ['westholt_castle', 'fernley']) {
    const h = c.holdings[sid];
    const last = h.report;
    const fromBook = h.book.filter((l) => l.day === last.day);
    assert.equal(fromBook.filter((l) => /^tax of/.test(l.why)).reduce((n, l) => n + l.amount, 0), last.tax, `${sid}: the last week's tax`);
    assert.equal(fromBook.filter((l) => /^wages at/.test(l.why)).reduce((n, l) => n + l.amount, 0), last.wages);
    assert.equal(fromBook.filter((l) => /due from/.test(l.why)).reduce((n, l) => n + l.amount, 0), last.due);
    assert.ok(acct(sid) >= 0, 'never below nothing');
    assert.equal(last.due, Math.round(last.tax * 0.1), 'a tenth to the crown');
  }
  const lines = uiCalls.filter((u) => u[0] === 'message' && /^Your fiefs this week: /.test(u[1]));
  assert.equal(lines.length, 13, 'one line a week');
  assert.match(lines.at(-1)[1], /^Your fiefs this week: Westholt Castle [+−]\d+ \(\d+ in hand\) · Fernley [+−]\d+ \(\d+ in hand\)\.$/);
  // Your purse never pays for a fief: its money is its own.
  assert.ok(c.ledger.every((l) => !/wages at|steward of/.test(l.why)));
});

test('the due is never taken twice in a week', () => {
  const { CL, c, F } = vassal();
  grantMe(CL, c, 'fernley');
  const a = F.week(c, 'fernley', 5);
  const b = F.week(c, 'fernley', 5);
  assert.ok(a.due > 0);
  assert.equal(b.due, 0);
});

test('SC-42: every policy makes a measured difference under the same rules', () => {
  const run = (setup) => {
    const { CL, c, F } = vassal();
    grantMe(CL, c, 'westholt_castle');
    CL.accounts.earn(c, 2000, 'test', F.account('westholt_castle'));
    setup(F, c);
    let tax = 0;
    let wages = 0;
    for (let w = 0; w < 8; w++) {
      const r = F.week(c, 'westholt_castle', w);
      tax += r.tax;
      wages += r.wages;
    }
    const h = c.holdings.westholt_castle;
    return { tax, wages, unrest: h.unrest, prosperity: h.prosperity, garrison: F.count(h.garrison), walls: h.walls };
  };
  const light = run((F, c) => F.setPolicy(c, 'westholt_castle', 'tax', 'light'));
  const normal = run(() => {});
  const heavy = run((F, c) => F.setPolicy(c, 'westholt_castle', 'tax', 'heavy'));
  assert.ok(heavy.tax > normal.tax * 1.25 && normal.tax > light.tax, `tax ${light.tax} / ${normal.tax} / ${heavy.tax}`);
  assert.ok(heavy.unrest > normal.unrest && normal.unrest >= light.unrest, `unrest ${light.unrest} / ${normal.unrest} / ${heavy.unrest}`);
  assert.ok(light.prosperity > normal.prosperity && normal.prosperity > heavy.prosperity, 'prosperity');
  const strong = run((F, c) => F.setPolicy(c, 'westholt_castle', 'garrison', 'strong'));
  const thin = run((F, c) => F.setPolicy(c, 'westholt_castle', 'garrison', 'light'));
  assert.equal(strong.garrison, 32);
  assert.equal(thin.garrison, 12);
  assert.ok(strong.wages > normal.wages && normal.wages > thin.wages, `wages ${thin.wages} / ${normal.wages} / ${strong.wages}`);
  const mended = run((_F, c) => {
    c.holdings.westholt_castle.walls = 40;
  });
  const left = run((F, c) => {
    c.holdings.westholt_castle.walls = 40;
    F.setPolicy(c, 'westholt_castle', 'repairs', false);
  });
  assert.equal(mended.walls, 100);
  assert.equal(left.walls, 40);
});

test('unrest over 80: the lands pay nothing and recruit nothing until it falls; over 60, a warning', () => {
  const { CL, c, F, uiCalls } = vassal();
  grantMe(CL, c, 'fernley');
  c.holdings.fernley.unrest = 85;
  c.holdings.fernley.militia = 3;
  const r = F.week(c, 'fernley', 1);
  assert.equal(r.tax, 0);
  assert.equal(c.holdings.fernley.militia, 3, 'no recruits');
  c.holdings.fernley.unrest = 70;
  F.week(c, 'fernley', 2);
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /Fernley is restless/.test(u[1])));
});

test('desertion: unpaid, two warnings, then the garrison deserts a man a day until paid', () => {
  const { CL, c, F, uiCalls } = vassal();
  grantMe(CL, c, 'westholt_castle');
  const acct = F.account('westholt_castle');
  CL.accounts.transfer(c, acct, 'world', CL.accounts.balance(c, acct), 'emptied');
  c.holdings.westholt_castle.policies.repairs = false;
  const h = c.holdings.westholt_castle;
  const men = F.count(h.garrison);
  for (let w = 1; w <= 2; w++) {
    CL.accounts.transfer(c, acct, 'world', CL.accounts.balance(c, acct), 'emptied');
    F.week(c, 'westholt_castle', w);
    assert.equal(h.deserting, false, `warning ${w}`);
  }
  assert.equal(uiCalls.filter((u) => u[0] === 'message' && /is owed \d+ crowns \(warning/.test(u[1])).length, 2);
  CL.accounts.transfer(c, acct, 'world', CL.accounts.balance(c, acct), 'emptied');
  F.week(c, 'westholt_castle', 3);
  assert.equal(h.deserting, true);
  for (let d = 0; d < 3; d++) {
    c.day += 1;
    F.tick(c);
  }
  assert.equal(F.count(h.garrison), men - 3, 'one a day');
  CL.accounts.earn(c, 500, 'paid', acct);
  F.week(c, 'westholt_castle', 4);
  assert.equal(h.deserting, false, 'paid, they stay');
});

test('castellans: a veteran stays behind, the steward goes; dismissed, they rejoin at the holding (SC-44: and when it is lost)', () => {
  const { CL, c, F } = vassal();
  grantMe(CL, c, 'westholt_castle');
  const s = CL.save.addSoldier(c, 'guard');
  s.record.battles = 12;
  const at = (sid) => {
    const p = CL.content.table('settlements')[sid];
    Object.assign(c.world, { x: p.mapX, y: p.mapY, location: sid });
  };
  assert.equal(F.appoint(c, 'westholt_castle', s.id), false, 'at the holding only');
  at('westholt_castle');
  assert.equal(F.appoint(c, 'westholt_castle', s.id), true);
  assert.equal(c.roster.some((x) => x.id === s.id), false, 'out of the company');
  assert.equal(F.adminName(c, 'westholt_castle'), `Castellan ${s.name}`);
  assert.equal(F.week(c, 'westholt_castle', 1).steward, 0, 'no steward to pay');
  // Saved and loaded, still there.
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.holdings.westholt_castle.castellan.id, s.id);
  assert.equal(back.roster.some((x) => x.id === s.id), false);
  // Dismissed away from the holding: back when you are there.
  c.world.location = null;
  F.dismiss(c, 'westholt_castle');
  assert.equal(c.roster.some((x) => x.id === s.id), false);
  at('westholt_castle');
  F.tick(c);
  assert.ok(c.roster.some((x) => x.id === s.id), 'rejoined');
  // SC-44: appointed again, policies set, and the holding lost: the policies are cancelled safely and the castellan comes back.
  F.appoint(c, 'westholt_castle', s.id);
  F.setPolicy(c, 'westholt_castle', 'tax', 'heavy');
  c.world.location = null;
  CL.realm.setOwner(c, 'westholt_castle', 'aurelian', 'test');
  assert.ok(c.roster.some((x) => x.id === s.id), 'the castellan is back with the company');
  assert.equal(c.holdings.westholt_castle.castellan, null);
  assert.deepEqual(plain(c.holdings.westholt_castle.policies), plain(F.policies()));
  assert.equal(CL.accounts.balance(c, F.account('westholt_castle')), 0, 'its money stayed with it');
  assert.ok(c.holdings.westholt_castle.treasury > 0);
  assert.equal(F.count(c.holdings.westholt_castle.garrison), 22, 'the taker’s own garrison');
  assert.deepEqual(plain(CL.realm.invariants(c)), []);
});

test('grants: the candidates in the crown’s order; a landless kinsman wins a crown village you did nothing for', () => {
  const { CL, c, F, R } = vassal();
  CL.realm.setOwner(c, 'castra_nova', 'valedorn', 'test'); // a fort and two villages for Valedorn's crown to give
  const g = F.offer(c, 'calvinum', null);
  const order = F.candidates(c, g);
  const tancred = byKey(c, 'tancred_greymantle');
  const alys = byKey(c, 'alys_ardane');
  assert.deepEqual(plain(order.slice(0, 2)).sort(), [alys, tancred].sort(), 'the landless kin first');
  assert.ok(order.indexOf('player') > order.indexOf(tancred), 'you after them');
  assert.ok(order.indexOf('player') < order.indexOf(byKey(c, 'hamon_greymantle')), 'before the landed');
  // Who did most in its taking comes first.
  g.helper = 'player';
  assert.equal(F.candidates(c, g)[0], 'player');
  // A fort needs more renown and service, unless you took it.
  const fort = F.offer(c, 'castra_nova', null);
  assert.equal(F.candidates(c, fort).includes('player'), false);
  fort.helper = 'player';
  assert.equal(F.candidates(c, fort)[0], 'player');
  // Made: an AI lord accepts; the news tells it.
  const h = c.grants.find((x) => x.sid === 'tessaro');
  if (h) c.grants.splice(c.grants.indexOf(h), 1);
  const g2 = F.offer(c, 'tessaro', null);
  g2.day = c.day;
  F.decideGrants(c);
  const winner = R.holderOf('tessaro', c);
  assert.ok([alys, tancred].includes(winner), winner);
  assert.ok(c.news.events.some((e) => e.kind === 'fief_granted' && /landless until now, is granted Tessaro/.test(e.text)));
});

test('grants: nobody passes three fiefs; a story fort is never granted; declined goes to the next', () => {
  const { CL, c, F, R } = vassal();
  const hamon = byKey(c, 'hamon_greymantle');
  CL.realm.transfer(c, 'oakford', { holder: hamon, willing: true });
  assert.equal(R.fiefsOf(hamon, c).length, 3);
  CL.realm.setOwner(c, 'castra_nova', 'valedorn', 'test');
  const g = F.offer(c, 'calvinum', hamon);
  assert.equal(F.candidates(c, g).includes(hamon), false, 'three already');
  assert.equal(F.offer(c, 'greywall_fort', null), null, 'story-locked');
  // Yours, declined: it goes to the next.
  g.helper = 'player';
  g.day = c.day;
  F.decideGrants(c);
  assert.equal(F.grantDue(c), g);
  assert.equal(R.holderOf('calvinum', c), c.rulers.valedorn, 'held by the crown meanwhile');
  F.answer(c, 'decline');
  assert.notEqual(R.holderOf('calvinum', c), 'player');
  assert.notEqual(R.holderOf('calvinum', c), c.rulers.valedorn, 'the next candidate has it');
  assert.equal(F.grantDue(c), null);
});

test('SC-19: sworn, you are granted a village, then (with renown and service) a fort; nobody else is moved', () => {
  const { CL, c, F, R } = vassal();
  CL.realm.setOwner(c, 'castra_nova', 'valedorn', 'test');
  for (const id of Object.keys(c.people)) if (c.people[id].realm === 'valedorn' && !R.fiefsOf(id, c).length && !R.rules(id, c)) Object.assign(c.people[id], { status: 'captive', heldBy: 'aurelian' }); // the landless kin are away
  for (const x of Object.keys(c.people)) if (c.people[x].status === 'captive') c.prisoners.push({ lord: x, by: 'aurelian', since: c.day, led: 1, offerDay: null, offered: false, checked: Math.floor(c.day), release: c.day + 99 });
  const gv = F.offer(c, 'calvinum', null);
  gv.day = c.day;
  F.decideGrants(c);
  assert.equal(F.grantDue(c)?.sid, 'calvinum', 'a village first');
  assert.ok(F.grantLines(c, gv).some((l) => /pays about \d+ crowns a week/.test(l)));
  F.answer(c, 'accept');
  assert.deepEqual(plain(R.fiefsOf('player', c)), ['calvinum']);
  // The fort, with renown and service.
  c.renown = 320;
  c.allegiance.serviceDays = 40;
  const gf = F.offer(c, 'castra_nova', null);
  gf.day = c.day;
  F.decideGrants(c);
  assert.equal(F.grantDue(c)?.sid, 'castra_nova');
  F.answer(c, 'accept');
  assert.deepEqual(plain(R.fiefsOf('player', c)).sort(), ['calvinum', 'castra_nova']);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('the conqueror’s four choices, for you and for a lord: ask, suggest, hand over, keep', () => {
  const take = () => {
    const env = vassal();
    env.CL.realm.setOwner(env.c, 'castra_nova', 'valedorn', 'test');
    env.c.grants.length = 0;
    return env;
  };
  // Ask: the crown weighs you first.
  {
    const { c, F } = take();
    const r = F.conquered(c, 'castra_nova', 'player', 'ask');
    assert.equal(F.candidates(c, r.grant)[0], 'player');
  }
  // Suggest: the lord you name comes first, and remembers it when granted.
  {
    const { c, F, R } = take();
    const tancred = byKey(c, 'tancred_greymantle');
    const r = F.conquered(c, 'castra_nova', 'player', 'suggest', tancred);
    r.grant.day = c.day;
    F.decideGrants(c);
    assert.equal(R.holderOf('castra_nova', c), tancred);
    assert.equal(c.people[tancred].deeds.at(-1).kind, 'suggested');
  }
  // Hand it over: influence with the ruler.
  {
    const { c, F } = take();
    const r = F.conquered(c, 'castra_nova', 'player', 'hand');
    assert.equal(r.influence, 5);
    assert.equal(c.influence.valedorn, 5);
    assert.equal(c.people[c.rulers.valedorn].deeds.at(-1).kind, 'handed');
  }
  // Keep it: a friend is let be; otherwise cast out, and the fort lost with a claim.
  {
    const { CL, c, F, R } = take();
    CL.realm.adjust(c, 'valedorn', 40);
    assert.equal(F.conquered(c, 'castra_nova', 'player', 'keep').accepted, true);
    assert.equal(R.holderOf('castra_nova', c), 'player');
  }
  {
    const { c, F, R } = take();
    assert.equal(F.conquered(c, 'castra_nova', 'player', 'keep').accepted, false);
    assert.equal(c.allegiance.kind, 'independent', 'cast out');
    assert.notEqual(R.holderOf('castra_nova', c), 'player');
    assert.equal(R.claimsOn('castra_nova', c).find((k) => k.by === 'player')?.kind, 'granted');
  }
  // A lord takes it and asks (AI lords ask until P8-07 weighs it).
  {
    const { c, F } = take();
    const hamon = byKey(c, 'hamon_greymantle');
    const r = F.conquered(c, 'castra_nova', hamon, 'ask');
    assert.equal(F.candidates(c, r.grant)[0], hamon);
  }
});

test('the crown grants what it took within days; a lord held unransomed 30 days loses their land to it', () => {
  const { CL, c, R } = vassal();
  CL.realm.setOwner(c, 'castra_nova', 'valedorn', 'test');
  CL.game.mode = 'map';
  weeks(CL, 2);
  assert.notEqual(R.holderOf('castra_nova', c), c.rulers.valedorn, 'granted');
  const avice = byKey(c, 'avice_westmere');
  CL.lords.beaten(c, CL.lords.partyOf(c, avice) || { lordId: avice, troops: {}, x: 0, y: 0 }, 'aurelian');
  CL.lords.prisonerOf(c, avice).release = c.day + 99;
  weeks(CL, 5);
  assert.equal(R.fiefsOf(avice, c).length, 0, 'forfeit to the crown, and granted on');
  assert.equal(R.claimsOn('westholt_castle', c).some((k) => k.by === avice), true, 'she keeps a claim');
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('the landed bot keeps its fief 60 days hands-off, with no forced screens', () => {
  const { CL } = newCampaign(17);
  const c = CL.campaign;
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
  CL.realm.transfer(c, 'fernley', { holder: 'player', willing: true });
  const bot = makeBot(CL, { style: 'landed' });
  for (let d = 0; d < 60; d++) {
    bot.play(1);
    assert.deepEqual(plain(CL.realm.invariants(c)), [], `day ${d}`);
  }
  assert.ok(CL.realm.fiefsOf('player', c).includes('fernley') || c.allegiance.kind !== 'vassal', 'still held, unless the service fell short');
  assert.equal(c.holdings.fernley.reports.length > 0 || c.allegiance.kind !== 'vassal', true);
  assert.deepEqual(plain(bot.stats.invariants), []);
});

test('saves: the holdings’ state, grants and influence round-trip; v21 migrates; 2.27.0’s saves load', () => {
  const { CL, c, F } = vassal();
  grantMe(CL, c, 'westholt_castle');
  F.setPolicy(c, 'westholt_castle', 'garrison', 'strong');
  F.week(c, 'westholt_castle', 1);
  CL.realm.setOwner(c, 'castra_nova', 'valedorn', 'test');
  F.offer(c, 'castra_nova', 'player');
  c.influence = { valedorn: 5 };
  const back = CL.save.fromRaw(plain(c)).campaign;
  for (const k of ['grants', 'influence']) assert.deepEqual(plain(back[k]), plain(c[k]), k);
  assert.deepEqual(plain(back.holdings), plain(c.holdings));
  assert.equal(CL.accounts.balance(back, F.account('westholt_castle')), CL.accounts.balance(c, F.account('westholt_castle')));
  const d = plain(c);
  d.holdings.westholt_castle.policies = { garrison: 'huge', tax: 'none', food: -4, repairs: 'yes' };
  d.holdings.westholt_castle.unrest = 900;
  d.grants.push({ sid: 'nowhere', day: 1 }, 'x');
  d.influence.atlantis = 9;
  const fixed = CL.save.fromRaw(d).campaign;
  assert.deepEqual(plain(fixed.holdings.westholt_castle.policies), plain(F.policies()));
  assert.equal(fixed.holdings.westholt_castle.unrest, 100);
  assert.equal(fixed.grants.length, 1);
  assert.deepEqual(plain(fixed.influence), { valedorn: 5 });
  const v21 = plain(c);
  v21.version = 21;
  delete v21.grants;
  delete v21.influence;
  const m = CL.save.migrate(v21);
  assert.deepEqual([plain(m.grants), plain(m.influence)], [[], {}]);
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    assert.equal(f.expect.build, '2.27.0');
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, G.save.VERSION);
    for (const k of ['gold', 'renown', 'battles', 'victories']) assert.equal(G.campaign[k], f.expect[k], `${f.file} ${k}`);
    assert.ok(Object.values(G.campaign.holdings).every((h) => h.policies && h.prosperity != null));
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign), JSON.stringify(G.campaign), `${f.file}: stable`);
  }
});
