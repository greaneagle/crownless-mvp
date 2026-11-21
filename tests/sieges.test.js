// P8-06a · Sieges on the map: the AI's lords gather and besiege at war; encirclement, ladders and ram,
// food, surrender, storm, lift and relief; the fort's fall through realm.transfer once; your own siege;
// SC-20 (your fort falls while you are elsewhere) and SC-16 (the mill's law on a real change of hands).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.28');

/** A world with the lords riding, Valedorn at war with Aurelia; Valedorn's lords about Castra Nova. */
function war({ lords = 3, random, strength = 0.55 } = {}) {
  const env = loadGame({ party: true, ...(random ? { random } : {}) });
  const { CL } = env;
  const c = CL.campaign;
  Object.assign(c, { gold: 2000, food: 400 });
  for (const t of Object.values(CL.content.table('party_templates'))) c.partySpawns[t.id] = t.kind === 'lord' ? 0 : 1e9;
  CL.lords.ensure(c, c.day, true);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  const fort = CL.content.get('settlements', 'castra_nova');
  const mine = c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn').slice(0, lords);
  // Each lord brings about half the garrison: together enough to encircle it (1.5×), not to storm it.
  const g = c.holdings.castra_nova.garrison;
  const share = Object.fromEntries(Object.entries(g).map(([id, n]) => [id, Math.max(1, Math.round(n * strength))]));
  for (const q of mine) Object.assign(q, { x: fort.mapX + 2, y: fort.mapY + 2, tx: null, ty: null, troops: { ...share } });
  // Valedorn's other lords and Aurelia's far away (no more besiegers, no relief unless a test asks for it).
  for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'valedorn' && !mine.includes(p))) Object.assign(q, { x: 10, y: 10, tx: null, ty: null });
  // Aurelia's lords far away (no relief unless a test asks for it).
  for (const q of c.parties.filter((p) => p.lordId && c.people[p.lordId].realm === 'aurelian')) Object.assign(q, { x: 10, y: 190, tx: null, ty: null });
  CL.game.mode = 'map';
  Object.assign(c.world, { x: 30, y: 30, location: null });
  return { ...env, c, S: CL.sieges, R: CL.realm, mine };
}
const hours = (CL, n) => {
  for (let i = 0; i < n; i++) {
    CL.party.advanceDays(1 / 24);
    CL.game.contactParty = null;
  }
};
const events = (CL, type) => CL.events.recent.filter((e) => e.type === type).length;

test('a realm at war gathers two or more lords against the nearest fort it may besiege, never a story fort', () => {
  const { CL, c, S } = war();
  const s = S.plan(c, 'valedorn');
  assert.ok(s, 'planned');
  assert.equal(s.phase, 'gathering');
  assert.notEqual(s.sid, 'ashgate_fort', 'never a story fort before Q4 ends');
  assert.notEqual(s.sid, 'eastwatch', 'never a capital');
  assert.ok(s.lords.length >= 2);
  assert.equal(S.plan(c, 'valedorn'), null, 'one siege a realm');
  for (const pid of s.lords) assert.equal(CL.lords.partyOf(c, pid).intent, 'gather');
  assert.equal(CL.lords.doingLine(c, CL.lords.partyOf(c, s.lords[0])), 'gathering for a siege');
  // At peace, no siege.
  const quiet = war();
  quiet.CL.realm.setRelation(quiet.c, 'valedorn', 'aurelian', 'tension', 'test');
  assert.equal(quiet.S.plan(quiet.c, 'valedorn'), null);
});

test('encirclement shuts the fort and its villages; ladders after a day, a ram after three; the defenders eat', () => {
  const { CL, c, S } = war();
  const s = S.plan(c, 'valedorn');
  hours(CL, 24);
  assert.equal(s.phase, 'encircled', 'the lords arrived and the power was enough');
  assert.ok(c.news.events.some((e) => e.kind === 'siege_begun'));
  const fort = c.holdings[s.sid];
  const village = Object.keys(c.holdings).find((v) => c.holdings[v].seat === s.sid);
  const right = CL.rights.may(c, 'player', 'recruit', village);
  assert.match(right.why, /is under siege: its gates and markets are shut/);
  assert.equal(CL.rights.may(c, 'player', 'trade', s.sid).ok, false);
  const food = fort.food;
  hours(CL, 24);
  assert.ok(Math.abs(fort.food - (food - 1)) < 0.1, `a day's food: ${food} → ${fort.food}`);
  assert.ok(S.odds(c, s) > 0, 'ladders ready');
  const before = S.defence(c, s).wall;
  hours(CL, 48);
  if (S.at(c, s.sid)) assert.ok(S.defence(c, s).wall < before, 'a ram makes the walls count for less');
});

test('starved out: at no food the garrison surrenders; the fort passes once, its villages with it, claims kept', () => {
  const { CL, c, S, R } = war();
  const s = S.plan(c, 'valedorn');
  hours(CL, 24);
  const fort = s.sid;
  const was = R.holderOf(fort, c);
  c.holdings[fort].food = 0.5;
  const n = events(CL, 'HoldingChanged');
  hours(CL, 30);
  assert.equal(c.sieges.includes(s), false, 'over');
  assert.equal(R.owner(fort, c), 'valedorn', 'taken');
  assert.equal(events(CL, 'HoldingChanged'), n + 1, 'transferred once');
  for (const v of R.villagesOf(fort, c)) assert.equal(R.owner(v, c), 'valedorn', `${v} followed its seat`);
  assert.ok(R.claimsOn(fort, c).some((k) => k.by === was), 'the old holder keeps a claim');
  const h = c.holdings[fort];
  assert.equal(h.unrest >= 60, true, 'restless');
  assert.ok(h.walls < 100);
  assert.ok(h.weakUntil > c.day);
  assert.ok(CL.fiefs.count(h.garrison) <= 11, 'half a garrison');
  assert.ok(c.news.events.some((e) => e.kind === 'fort_fell' && /surrendered/.test(e.text)));
  // The conqueror asked; the crown will grant it, the commander first.
  const g = c.grants.find((x) => x.sid === fort);
  assert.ok(g && s.lords.includes(g.helper), 'the conqueror asked the liege');
  // Lords go home to refill.
  for (const pid of s.lords) {
    const q = CL.lords.partyOf(c, pid);
    if (q) assert.ok(['home', 'rest'].includes(q.intent) || !q.siegeId, pid);
  }
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('stormed or thrown back: a strong host storms it; a weak one loses two in five and lifts', () => {
  // Strong enough to storm it (odds over 60%), not so strong the garrison gives up first (90%).
  const strong = war({ strength: 0.75 });
  strong.CL.autoresolve.next = () => 0.01; // the assault's roll goes their way
  const s = strong.S.plan(strong.c, 'valedorn');
  hours(strong.CL, 50);
  assert.equal(strong.R.owner(s.sid, strong.c), 'valedorn', 'stormed');
  assert.ok(strong.c.news.events.some((e) => e.kind === 'fort_fell' && /stormed/.test(e.text)));
  const weak = war();
  weak.CL.autoresolve.next = () => 0.99; // and this one doesn't
  const w = weak.S.plan(weak.c, 'valedorn');
  hours(weak.CL, 24);
  assert.equal(w.phase, 'encircled');
  const party = weak.CL.lords.partyOf(weak.c, w.lords[0]);
  const men = weak.CL.parties.troopCount(party);
  const r = weak.S.assault(weak.c, w);
  assert.equal(r.win, false);
  assert.equal(weak.S.at(weak.c, w.sid), null, 'lifted');
  assert.ok(weak.CL.parties.troopCount(party) < men, 'losses');
  assert.equal(weak.R.owner(w.sid, weak.c), 'aurelian');
});

test('lifted when the war ends; relieved when the defenders’ lords ride in and win', () => {
  const { CL, c, S, R } = war();
  const s = S.plan(c, 'valedorn');
  hours(CL, 24);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'tension', 'test');
  hours(CL, 2);
  assert.equal(c.sieges.includes(s), false, 'lifted at once');
  assert.ok(c.news.events.some((e) => e.kind === 'siege_lifted'));
  // Relief.
  const r = war();
  const s2 = r.S.plan(r.c, 'valedorn');
  hours(r.CL, 24);
  const fort = r.CL.content.get('settlements', s2.sid);
  const helper = r.c.parties.find((p) => p.lordId && r.c.people[p.lordId].realm === 'aurelian');
  Object.assign(helper, { x: fort.mapX + 8, y: fort.mapY, troops: { legionary: 40 } });
  r.S.callRelief(r.c, s2);
  assert.ok(s2.relief.includes(helper.lordId));
  assert.equal(helper.intent, 'relief');
  r.CL.autoresolve.next = () => 0.01; // the relief's fight goes its way
  hours(r.CL, 12);
  assert.equal(r.c.sieges.includes(s2), false, 'relieved');
  assert.ok(r.c.news.events.some((e) => e.kind === 'siege_relieved'));
  assert.equal(R.owner(s2.sid, r.c), 'aurelian');
  assert.deepEqual(plain(r.R.invariants(r.c)), []);
});

test('SC-20: your fort falls while you are elsewhere: the revenue, control and garrison go; you are warned; you go on', () => {
  const { CL, c, S, R, uiCalls } = war();
  // You: a vassal of Aurelia holding Castra Nova, far away.
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'aurelian', since: c.day, window: { start: c.day, days: 10 } });
  CL.realm.transfer(c, 'castra_nova', { holder: 'player', willing: true });
  const acct = CL.fiefs.account('castra_nova');
  assert.ok(CL.accounts.balance(c, acct) > 0);
  const s = S.plan(c, 'valedorn');
  assert.equal(s.sid, 'castra_nova', 'they come for it');
  hours(CL, 24);
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /Castra Nova is besieged by the Valedorn Crown!/.test(u[1])), 'warned');
  assert.equal(s.alarmed, true, 'the urgent message (the Ride back / Leave it screen in the browser)');
  CL.game.mode = 'map';
  c.holdings.castra_nova.food = 0.2;
  hours(CL, 30);
  assert.equal(R.owner('castra_nova', c), 'valedorn', 'fallen');
  assert.notEqual(R.holderOf('castra_nova', c), 'player');
  assert.equal(CL.accounts.balance(c, acct), 0, 'its revenue is no longer yours');
  assert.ok(R.claimsOn('castra_nova', c).some((k) => k.by === 'player'), 'you keep a claim');
  assert.equal(c.allegiance.kind, 'vassal', 'still sworn');
  // You go on: travel, trade, recruit where welcome.
  CL.party.advanceDays(1);
  assert.ok(c.roster.length > 0);
  assert.equal(CL.rights.may(c, 'player', 'recruit', 'eastwatch').ok, true);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('SC-16: a mill under a fort that falls answers to the new owner’s law, and you are told', () => {
  const { CL, c, S, uiCalls } = war();
  const s = CL.content.get('settlements', 'calvinum');
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'calvinum' });
  assert.ok(CL.business.buy(c, 'calvinum'));
  Object.assign(c.world, { x: 30, y: 30, location: null });
  const siege = S.plan(c, 'valedorn');
  assert.equal(siege.sid, 'castra_nova');
  hours(CL, 24);
  c.holdings.castra_nova.food = 0.2;
  hours(CL, 30);
  assert.equal(CL.realm.owner('calvinum', c), 'valedorn');
  CL.business.tick(c);
  assert.equal(CL.business.get(c).owner, 'valedorn');
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /^Your mill: Calvinum is now held by Valedorn/.test(u[1])));
});

test('your own siege: the preview, the shut villages, a day’s wait, starved out and the conqueror’s choice; riding off lifts it', () => {
  const { CL, c, S, R } = war();
  Object.assign(c.allegiance, { kind: 'vassal', realm: 'valedorn', since: c.day, window: { start: c.day, days: 10 } });
  const fort = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: fort.mapX, y: fort.mapY, location: 'castra_nova' });
  const p = S.preview(c, 'castra_nova');
  assert.equal(p.ok, true, p.why);
  assert.match(p.lines[0], /^The garrison: 22 soldiers \(power [\d.]+\), ×1\.60 behind walls at 100%\.$/);
  assert.match(p.lines[2], /^Starving it out: about 14 days, if no relief comes\.$/);
  assert.equal(p.lines.at(-1), 'Leaving the camp lifts the siege.');
  const s = S.begin(c, 'castra_nova');
  assert.equal(s.by, 'player');
  assert.equal(S.shut(c, 'calvinum'), s, 'its villages are shut');
  assert.equal(CL.rights.may(c, 'player', 'trade', 'calvinum').ok, true, 'but not to the besiegers');
  assert.equal(S.odds(c, s), 0, 'no ladders yet');
  CL.party.advanceDays(1);
  assert.ok(S.odds(c, s) > 0);
  c.holdings.castra_nova.food = 0.3;
  CL.game.mode = 'settlement';
  CL.ui.openConquest = (sid) => Object.assign(CL.game, { conquest: sid, mode: 'conquest' }); // the browser's prompt
  CL.party.advanceDays(1);
  assert.equal(R.owner('castra_nova', c), 'valedorn', 'surrendered to you');
  assert.equal(CL.game.mode, 'conquest', 'and you choose what becomes of it');
  CL.fiefs.conquered(c, 'castra_nova', 'player', 'ask');
  assert.equal(c.grants.find((g) => g.sid === 'castra_nova').helper, 'player');
  // Riding off lifts it.
  const two = war();
  Object.assign(two.c.allegiance, { kind: 'vassal', realm: 'valedorn', since: two.c.day, window: { start: two.c.day, days: 10 } });
  Object.assign(two.c.world, { x: fort.mapX, y: fort.mapY, location: 'castra_nova' });
  two.S.begin(two.c, 'castra_nova');
  two.c.world.location = null;
  two.CL.party.advanceDays(0.1);
  assert.equal(two.c.sieges.some((x) => x.by === 'player'), false, 'your siege is over');
});

test('an independent may besiege, at the cost of attacking that realm; the story forts never', () => {
  const { CL, c, S } = war();
  const fort = CL.content.get('settlements', 'castra_nova');
  Object.assign(c.world, { x: fort.mapX, y: fort.mapY, location: 'castra_nova' });
  const p = S.preview(c, 'castra_nova');
  assert.ok(p.lines.some((l) => /You ride for no crown: the Aurelian Remnant will count it an attack \(-25 standing\)/.test(l)));
  const rep = c.reputation.aurelian;
  S.begin(c, 'castra_nova');
  assert.equal(c.reputation.aurelian, rep - 25);
  assert.match(S.preview(c, 'greywall_fort').why, /story/);
  assert.match(S.preview(c, 'eastwatch').why, /capital|fort or a town/);
});

test('saves: sieges round-trip; junk is repaired; v22 migrates; 2.28.0’s saves load', () => {
  const { CL, c, S } = war();
  const s = S.plan(c, 'valedorn');
  hours(CL, 24);
  assert.equal(s.phase, 'encircled');
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.sieges), plain(c.sieges));
  for (const pid of s.lords) assert.equal(back.parties.find((q) => q.lordId === pid).siegeId, s.id);
  assert.equal(back.holdings[s.sid].food, c.holdings[s.sid].food);
  const d = plain(c);
  d.sieges.push({ ...d.sieges[0] }, { sid: 'oakford', phase: 'encircled', by: 'ai', realm: 'valedorn' }, { sid: 'westholt_castle', phase: 'storming', by: 'ai', realm: 'hrothmark' });
  const fixed = CL.save.fromRaw(d).campaign;
  assert.equal(fixed.sieges.length, 1, 'a second at the fort, a village, an unknown phase: dropped');
  const v22 = plain(c);
  v22.version = 22;
  delete v22.sieges;
  assert.deepEqual(plain(CL.save.migrate(v22).sieges), []);
  const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
  for (const f of index) {
    assert.equal(f.expect.build, '2.28.0');
    const { CL: G } = loadGame({ party: false });
    const r = G.portable.importText(fs.readFileSync(path.join(FIX, f.file), 'utf8'));
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(G.campaign.version, G.save.VERSION);
    for (const k of ['gold', 'renown', 'battles', 'victories']) assert.equal(G.campaign[k], f.expect[k], `${f.file} ${k}`);
    assert.deepEqual(plain(G.campaign.sieges), []);
    assert.ok(Object.values(G.campaign.holdings).every((h) => h.kind !== 'fort' || h.food > 0));
    assert.deepEqual(plain(G.realm.invariants(G.campaign)), [], f.file);
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(G.portable.serialize(G.campaign)).ok, true);
    assert.equal(JSON.stringify(again.campaign), JSON.stringify(G.campaign), `${f.file}: stable`);
  }
});
