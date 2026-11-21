// P8-04 · Allegiance: independent, a realm's mercenary, or its vassal; leaving by release, defection or
// expulsion; the preview of every change; save v21 and 2.26.0's saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.26');

function camp(opts = {}) {
  const env = loadGame({ party: true, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.gold = 500;
  c.food = 200;
  const AL = CL.allegiance;
  return { ...env, c, AL, R: CL.realm };
}
/** What a change of allegiance must never touch. */
function personal(_CL, c) {
  return JSON.stringify({ roster: c.roster.map((s) => [s.id, s.troop, s.xp]), inventory: c.inventory, followers: c.followers, retinue: c.retinue, businesses: c.businesses.owned.map((b) => b.place), equipment: c.equipment });
}
/** A vassal of Vessaro holding Marenna, with `served` days this month. */
function vassalWithFief(AL, c, CL, served) {
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'vessaro', since: c.day, window: { start: c.day, days: served } });
  CL.realm.transfer(c, 'marenna', { holder: 'player', willing: true });
}
const days = (CL, n) => {
  for (let i = 0; i < n; i++) CL.party.advanceDays(1);
};

test('the design’s §16.5: a mercenary contract, a vassal, a castle, released on terms, the soldiers kept', () => {
  const { CL, c, AL, R } = camp();
  const keep = personal(CL, c);
  // A mercenary contract at Stonebridge (Neutral standing is enough).
  const serve = AL.preview(c, 'serve', 'valedorn');
  assert.equal(serve.ok, true);
  assert.match(serve.lines[0], /^You serve the Valedorn Crown for 30 days, at \d+ crowns a week/);
  assert.equal(serve.lines.at(-1), 'Your soldiers and money stay yours.');
  assert.ok(AL.act(c, 'serve', 'valedorn'));
  assert.equal(AL.state(c).kind, 'mercenary');
  // Not yet a vassal: they don't know you well enough.
  assert.match(AL.preview(c, 'swear', 'valedorn').why, /must count you a friend/);
  days(CL, 21);
  CL.realm.adjust(c, 'valedorn', 40);
  c.renown = 160;
  assert.ok(AL.mercenaryDays(c, 'valedorn') >= 20);
  // Sworn.
  const swear = AL.preview(c, 'swear', 'valedorn');
  assert.equal(swear.ok, true, swear.why);
  assert.ok(swear.lines.includes('Your contract with them ends, served.'));
  AL.act(c, 'swear', 'valedorn');
  assert.equal(AL.sworn(c), 'valedorn');
  assert.equal(CL.rights.allegiance(c, 'player'), 'valedorn');
  // Receives a castle (P8-05's grant; here the crown's transfer, as the Debug panel does).
  CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true, reason: 'granted' });
  assert.deepEqual(plain(R.fiefsOf('player', c)), ['westholt_castle']);
  assert.deepEqual(plain(R.invariants(c)), []);
  // Leaves under negotiated terms: service met, the realm at peace.
  AL.serve(c);
  AL.state(c).window.days = 10;
  const release = AL.preview(c, 'release');
  assert.equal(release.ok, true);
  assert.deepEqual(plain(release.lines), [
    'King Godric Ardane releases you from your oath, with their thanks.',
    'Westholt Castle returns to the crown. You keep no claim to it.',
    'Your soldiers and money stay yours.',
  ]);
  const rep = c.reputation.valedorn;
  AL.act(c, 'release');
  assert.equal(AL.state(c).kind, 'independent');
  assert.equal(c.reputation.valedorn, rep, 'released on terms: no cost');
  assert.equal(R.holderOf('westholt_castle', c), c.rulers.valedorn, 'the castle back with the crown');
  assert.equal(R.claimsOn('westholt_castle', c).some((k) => k.by === 'player'), false, 'and no claim');
  // Retains personal soldiers; only titles and obligations changed.
  assert.equal(personal(CL, c), keep);
  assert.deepEqual(plain(AL.state(c).history.map((h) => [h.kind, h.realm, h.end])), [
    ['mercenary', 'valedorn', 'term'],
    ['vassal', 'valedorn', 'release'],
  ]);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('a mercenary’s pay: weekly, from the realm, and every crown of it in the ledger', () => {
  const { CL, c, AL } = camp();
  AL.act(c, 'serve', 'aurelian');
  const pay = AL.weeklyPay(c);
  assert.equal(pay, Math.round(20 + 3 * c.roster.length + 0.1 * c.renown));
  const gold = c.gold;
  days(CL, 15);
  const lines = c.ledger.filter((l) => l.why === 'pay from the Aurelian Remnant');
  assert.equal(lines.length, 2, 'two paydays in 15 days');
  assert.ok(lines.every((l) => l.from === 'world' && l.to === 'purse'));
  const paid = lines.reduce((n, l) => n + l.amount, 0);
  const wages = c.ledger.filter((l) => l.to === 'world' && l.from === 'purse').reduce((n, l) => n + l.amount, 0);
  assert.equal(c.gold, gold + paid - wages, 'the purse reconciles to the ledger');
  // The term ends at 30 days; renewing adds 30.
  days(CL, 16);
  assert.equal(AL.state(c).kind, 'independent');
  assert.equal(AL.state(c).history.at(-1).end, 'term');
  assert.equal(AL.state(c).history.at(-1).serviceDays, 30);
  AL.act(c, 'serve', 'aurelian');
  const until = AL.state(c).until;
  assert.ok(AL.act(c, 'renew', 'aurelian'));
  assert.equal(AL.state(c).until, until + 30);
});

test('a mercenary’s side: their patrols and lords stand with you; attacking theirs breaks the contract', () => {
  const { CL, c, AL } = camp();
  AL.act(c, 'serve', 'valedorn');
  const lord = { template: 'lord_valedorn', lordId: 'person:2', troops: { levy: 3 } };
  assert.equal(CL.reinforce.sideOf(c, lord, { kind: 'bandit', faction: 'neutral' }), 'ally', 'Neutral, but you serve them');
  assert.equal(CL.reinforce.sideOf(c, { template: 'valedorn_patrol', troops: { levy: 3 } }, { kind: 'patrol', faction: 'aurelian' }), 'ally');
  const p = CL.parties.spawn(c, 'valedorn_patrol');
  CL.parties.open(p.id);
  CL.parties.attack();
  assert.equal(AL.state(c).kind, 'independent', 'the contract is broken');
  assert.equal(AL.state(c).history.at(-1).end, 'breach');
});

test('a vassal’s obligations: 10 days of service in every 30; three short months and you are cast out', () => {
  const { CL, c, AL, R } = camp();
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
  CL.realm.transfer(c, 'fernley', { holder: 'player', willing: true });
  assert.equal(AL.owed(c), 10);
  // A battle won against Reavers is a day of service, once a day.
  AL.afterBattle(c, { win: true, kind: 'bandit', faction: 'neutral' });
  AL.afterBattle(c, { win: true, kind: 'bandit', faction: 'neutral' });
  assert.equal(AL.state(c).window.days, 1);
  // A day at your own fief is one too.
  const s = CL.content.table('settlements').fernley;
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'fernley' });
  CL.party.advanceDays(1);
  assert.equal(AL.state(c).window.days, 2);
  Object.assign(c.world, { location: null });
  days(CL, 29);
  assert.equal(AL.state(c).summonsMissed, 1, 'a month short');
  days(CL, 60);
  assert.equal(AL.state(c).kind, 'independent', 'cast out after three');
  assert.equal(AL.state(c).history.at(-1).end, 'expelled');
  assert.equal(R.holderOf('fernley', c), c.rulers.valedorn);
  assert.equal(R.claimsOn('fernley', c).find((k) => k.by === 'player')?.kind, 'granted', 'you keep a granted claim');
  assert.equal(AL.state(c).hunt, null, 'no hunt after an expulsion');
});

test('defecting: −40 standing, the fief lost with a claim, and their lords hunt you for 10 days, then stop', () => {
  const { CL, c, AL, R } = camp();
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
  CL.realm.adjust(c, 'valedorn', 40); // a friend before: Neutral after the −40
  CL.realm.transfer(c, 'westholt_castle', { holder: 'player', willing: true });
  const keep = personal(CL, c);
  const p = AL.preview(c, 'defect');
  assert.deepEqual(plain(p.lines), [
    'You break with the Valedorn Crown without leave: you lose 40 standing with them.',
    'You will lose Westholt Castle. You keep a claim to it.',
    "Valedorn's lords will hunt you for 10 days.",
    'The Valedorn lords will remember it.', // P8-07: none thinks well of you yet
    'Your soldiers and money stay yours.',
  ]);
  const rep = c.reputation.valedorn;
  AL.act(c, 'defect');
  // What it said happened.
  assert.equal(c.reputation.valedorn, rep - 40);
  assert.equal(R.holderOf('westholt_castle', c), c.rulers.valedorn);
  assert.equal(R.claimsOn('westholt_castle', c).find((k) => k.by === 'player')?.kind, 'granted');
  assert.equal(AL.hunted(c, 'valedorn'), true);
  assert.equal(personal(CL, c), keep);
  // Their lords hunt you, if strong enough, even though Valedorn counts you only Neutral.
  assert.equal(CL.realm.isHostile(c, 'valedorn'), false);
  CL.game.mode = 'map';
  c.world.location = null;
  const lord = CL.lords.spawn(c, Object.keys(c.people).find((k) => c.people[k].key === 'hamon_greymantle'));
  Object.assign(lord, { x: c.world.x + 1, y: c.world.y });
  c.roster = c.roster.slice(0, 1);
  assert.equal(CL.parties.wantsPlayer(c, lord), true);
  c.day += 11; // (riding on would bring the lord down on the company: the clock stops for the encounter)
  AL.tick(c);
  assert.equal(AL.hunted(c, 'valedorn'), false, 'the hunt ends');
  assert.equal(CL.parties.wantsPlayer(c, lord), false);
});

test('release: owing service costs 15; at war it is refused; seven days between oaths; a contract left early costs 10', () => {
  const { CL, c, AL } = camp();
  Object.assign(AL.state(c), { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 0 } });
  const owing = AL.preview(c, 'release');
  assert.match(owing.lines[0], /but you owe service: you lose 15 standing/);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  assert.match(AL.preview(c, 'release').why, /at war: King Godric Ardane will not release you now/);
  assert.equal(AL.act(c, 'release'), null, 'refused, so nothing happens');
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'tension', 'test');
  const rep = c.reputation.valedorn;
  AL.act(c, 'release');
  assert.equal(c.reputation.valedorn, rep - 15);
  // Seven days before the next oath.
  assert.match(AL.preview(c, 'serve', 'aurelian').why, /changed your allegiance lately/);
  days(CL, 7);
  assert.equal(AL.preview(c, 'serve', 'aurelian').ok, true);
  AL.act(c, 'serve', 'aurelian');
  const early = AL.preview(c, 'release');
  assert.match(early.lines[0], /days early, and lose 10 standing/);
  const before = c.reputation.aurelian;
  AL.act(c, 'release');
  assert.equal(c.reputation.aurelian, before - 10);
  assert.equal(AL.state(c).history.at(-1).end, 'early');
});

test('switching: swearing elsewhere ends a contract (previewed); a vassal must ask for release first', () => {
  const { CL, c, AL } = camp();
  AL.act(c, 'serve', 'aurelian');
  CL.realm.adjust(c, 'valedorn', 40);
  c.renown = 200;
  CL.story.state(c).flags.q4_side = 'valedorn'; // the story's favour
  const p = AL.preview(c, 'swear', 'valedorn');
  assert.equal(p.ok, true, p.why);
  assert.ok(p.lines.includes('Your contract with the Aurelian Remnant ends.'));
  AL.act(c, 'swear', 'valedorn');
  assert.equal(AL.sworn(c), 'valedorn');
  assert.equal(AL.state(c).history.at(-1).end, 'switched');
  assert.match(AL.preview(c, 'serve', 'aurelian').why, /ask for release first/);
  assert.match(AL.preview(c, 'swear', 'aurelian').why, /already sworn/);
});

test('every preview matches what happens, and nothing personal is ever lost', () => {
  for (const [setup, action, realm] of [
    [() => {}, 'serve', 'hrothmark'],
    [(AL, c) => AL.act(c, 'serve', 'hrothmark'), 'release', null],
    [(AL, c, CL) => vassalWithFief(AL, c, CL, 10), 'release', null],
    [(AL, c, CL) => vassalWithFief(AL, c, CL, 0), 'defect', null],
  ]) {
    const { CL, c, AL, R } = camp();
    CL.business.state(c).owned.push({ kind: 'mill', place: 'oakford', bought: 0, paid: 300, owner: 'valedorn', manager: 'miller', rules: { maxInput: null, minOutput: null }, seizeOn: null, weeks: 0, profit: 0, log: [], book: [] });
    setup(AL, c, CL);
    const keep = personal(CL, c);
    const before = { rep: { ...c.reputation }, fiefs: R.fiefsOf('player', c) };
    const p = AL.preview(c, action, realm);
    assert.ok(p.lines.at(-1).includes('mill'), 'the mill is named among what stays');
    AL.act(c, action, realm);
    const f = p.effects.realm;
    assert.equal(c.reputation[f] - before.rep[f], p.effects.rep, `${action}: the standing it said`);
    for (const sid of p.effects.lose) assert.notEqual(R.holderOf(sid, c), 'player', `${action}: ${sid} lost as it said`);
    assert.equal(p.effects.lose.length, before.fiefs.length - R.fiefsOf('player', c).length);
    assert.equal(AL.hunted(c, f), p.effects.hunt);
    assert.equal(personal(CL, c), keep, `${action}: nothing personal lost`);
    assert.deepEqual(plain(R.invariants(c)), []);
  }
});

test('saves: allegiance round-trips; junk is repaired; v20 saves migrate; 2.26.0’s saves load independent', () => {
  const { CL, c, AL } = camp();
  AL.act(c, 'serve', 'valedorn');
  days(CL, 3);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.allegiance), plain(c.allegiance));
  const d = plain(c);
  d.allegiance = { kind: 'king', realm: 'atlantis', history: [{ kind: 'vassal', realm: 'nowhere' }, 'x'] };
  assert.deepEqual(plain(CL.save.fromRaw(d).campaign.allegiance), plain(AL.blank()));
  const v20 = plain(c);
  v20.version = 20;
  delete v20.allegiance;
  assert.equal(CL.save.migrate(v20).allegiance.kind, 'independent');
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    assert.equal(f.expect.build, '2.26.0');
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, G.save.VERSION);
    assert.equal(G.campaign.allegiance.kind, 'independent');
    for (const k of ['gold', 'renown', 'battles', 'victories']) assert.equal(G.campaign[k], f.expect[k], `${f.file} ${k}`);
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign), JSON.stringify(G.campaign), `${f.file}: stable`);
  }
});
