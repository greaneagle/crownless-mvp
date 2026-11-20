// P8-02 · Holdings model: people of the realms, holdings, `realm.transfer`, story forts, villages that
// follow their seat, men's names for soldiers, and the 18 → 19 migration of 2.23.0's saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');
const { makeBot } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));
const FIX = path.join(__dirname, 'fixtures', 'saves-2.23');
const index = JSON.parse(fs.readFileSync(path.join(FIX, 'index.json'), 'utf8'));
const fixture = (file) => fs.readFileSync(path.join(FIX, file), 'utf8');
const byKey = (c, key) => Object.keys(c.people).find((id) => c.people[id].key === key);
const events = (CL, type) => CL.events.recent.filter((e) => e.type === type);

test('people: a ruler and about six lords per kingdom, landless, one place and several; men and women; a queen', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const R = CL.realm;
  assert.deepEqual(plain(R.invariants(c)), []);
  assert.deepEqual(Object.keys(c.rulers).sort(), ['aurelian', 'hrothmark', 'valedorn', 'vessaro'], 'every realm but the free city');
  assert.equal(Object.values(c.people).some((p) => p.realm === 'merrow'), false, 'Merrow has no persons');
  assert.equal(R.holding('merrow', c), null, 'nor holdings');
  for (const f of Object.keys(c.rulers)) {
    const lords = Object.values(c.people).filter((p) => p.realm === f && p.id !== c.rulers[f]);
    assert.ok(lords.length >= 5 && lords.length <= 7, `${f}: ${lords.length} lords`);
    const counts = lords.map((p) => R.fiefsOf(p.id, c).length);
    assert.ok(counts.includes(0), `${f}: a landless lord`);
    assert.ok(counts.includes(1), `${f}: a lord of one place`);
    assert.ok(counts.some((n) => n >= 2), `${f}: a lord of several`);
    assert.ok(lords.some((p) => p.gender === 'female') && lords.some((p) => p.gender === 'male'), `${f}: lords and ladies`);
    assert.ok(lords.every((p) => R.fiefsOf(p.id, c).length <= R.FIEF_CAP));
  }
  const queens = Object.entries(c.rulers).filter(([, id]) => c.people[id].gender === 'female');
  assert.ok(queens.length >= 1, 'at least one realm has a queen');
  assert.match(R.titled(queens[0][1], c), /^Queen /);
  // Rank is never stored: it is what they hold now.
  const hamon = byKey(c, 'hamon_greymantle');
  assert.equal(R.standingOf(hamon, c), 'great');
  assert.equal(R.standingOf(byKey(c, 'hawise_greymantle'), c), 'lesser');
  assert.equal(R.standingOf(byKey(c, 'tancred_greymantle'), c), 'landless');
  for (const p of Object.values(c.people)) for (const k of ['rank', 'great', 'landless', 'ruler']) assert.equal(k in p, false, `${p.id}.${k}`);
  // Kin: symmetric, with words from the tie and the gender.
  for (const p of Object.values(c.people)) {
    for (const k of p.kin) assert.ok(c.people[k.person].kin.some((x) => x.person === p.id), `${p.id} ↔ ${k.person}`);
  }
  const tancred = c.people[byKey(c, 'tancred_greymantle')];
  assert.equal(R.tieWord('child', tancred), 'son');
  assert.equal(R.tieWord('sibling', c.people[byKey(c, 'hawise_greymantle')]), 'sister');
  assert.match(R.personLine(hamon, c), /Hawise Greymantle \(sister\).*Tancred Greymantle \(son\)/);
  assert.equal(c.nextPersonId, Object.keys(c.people).length + 1);
});

test('holdings: every settlement of a kingdom, each with a holder, a controller and (villages) a seat', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const R = CL.realm;
  const all = Object.values(CL.content.table('settlements')).filter((s) => R.isRealm(s.ownerFaction));
  assert.equal(Object.keys(c.holdings).length, all.length);
  assert.equal(all.length, 30, '31 settlements, less the free city');
  for (const s of all) {
    const h = c.holdings[s.id];
    assert.equal(h.kind, s.type);
    assert.equal(h.sovereign, s.ownerFaction);
    assert.equal(h.controller, s.ownerFaction);
    assert.ok(c.people[h.holder], `${s.id} has a holder`);
    assert.equal(h.administrator, null);
    assert.deepEqual(plain(h.claims), []);
    if (s.type === 'village') assert.equal(h.seat, s.seat, `${s.id}'s seat`);
    else assert.equal(h.seat, null);
  }
  // The seats as the owner decided: the nearest fort or town of the kingdom (2026-11-20).
  assert.deepEqual(plain(R.villagesOf('greywall_fort', c)).sort(), ['brackenfield', 'highmere']);
  assert.deepEqual(plain(R.villagesOf('stonebridge', c)), ['oakford']);
  assert.deepEqual(plain(R.villagesOf('skarnwall', c)).sort(), ['kettleby', 'thornvik']);
  // A village held by a different lord from its seat's (acceptance).
  assert.notEqual(R.holderOf('brackenfield', c), R.holderOf('greywall_fort', c));
  assert.equal(R.owner('brackenfield', c), 'valedorn');
  assert.equal(R.owner('merrow', c), 'merrow', 'the free city keeps its content owner');
});

test('transfer: conquest carries a seat’s villages, gives the ruler the holding, and leaves claims once; one event', () => {
  const { CL, uiCalls } = loadGame({ party: false });
  const c = CL.campaign;
  const R = CL.realm;
  const hamon = byKey(c, 'hamon_greymantle');
  const hawise = byKey(c, 'hawise_greymantle');
  const before = events(CL, 'HoldingChanged').length;
  assert.equal(R.transfer(c, 'greywall_fort', { controller: 'aurelian', reason: 'test' }), true);
  assert.equal(events(CL, 'HoldingChanged').length, before + 1, 'one event per call');
  const e = events(CL, 'HoldingChanged').at(-1);
  assert.deepEqual(plain(e.villages).sort(), ['brackenfield', 'highmere']);
  assert.equal(e.from.holder, hamon);
  for (const sid of ['greywall_fort', 'highmere', 'brackenfield']) {
    const h = c.holdings[sid];
    assert.equal(h.controller, 'aurelian', sid);
    assert.equal(h.sovereign, 'aurelian', sid);
    assert.equal(h.holder, c.rulers.aurelian, `${sid}: held by the ruler until granted (D-P8f)`);
    assert.equal(R.owner(sid, c), 'aurelian');
  }
  assert.deepEqual(plain(c.holdings.greywall_fort.claims.map((k) => [k.by, k.realm, k.kind])), [[hamon, 'valedorn', 'old']]);
  assert.deepEqual(plain(c.holdings.brackenfield.claims.map((k) => k.by)), [hawise]);
  assert.equal(R.standingOf(hamon, c), 'landless', 'you can leave a lord landless');
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /Greywall Fort now flies the banner of the Aurelian/.test(u[1])));
  assert.equal(c.news.events.at(-1).kind, 'fort_taken');
  // Taken back: Valedorn's ruler holds it; Aurelia's ruler and Hamon both claim it, once each.
  assert.equal(R.setOwner(c, 'greywall_fort', 'valedorn', 'test'), true);
  assert.equal(c.holdings.greywall_fort.holder, c.rulers.valedorn);
  assert.deepEqual(plain(c.holdings.greywall_fort.claims.map((k) => k.by)), [hamon, c.rulers.aurelian]);
  assert.equal(R.setOwner(c, 'greywall_fort', 'valedorn'), false, 'no change, no event');
  // A grant by the crown: no claim from the ruler, and Hamon's claim is made good.
  assert.equal(R.transfer(c, 'greywall_fort', { holder: hamon, reason: 'grant' }), true);
  assert.deepEqual(plain(c.holdings.greywall_fort.claims.map((k) => k.by)), [c.rulers.aurelian]);
  assert.equal(c.news.events.at(-1).kind, 'fief_granted');
  assert.match(c.news.events.at(-1).text, /Greywall Fort has passed to Lord Hamon Greymantle/);
  // Returned to the crown willingly: no claim. Revoked: a claim.
  assert.equal(R.transfer(c, 'highmere', { holder: hamon, reason: 'grant' }), true);
  assert.equal(R.transfer(c, 'highmere', { holder: c.rulers.valedorn, willing: true, reason: 'returned' }), true);
  assert.deepEqual(plain(c.holdings.highmere.claims.map((k) => k.by)), [c.rulers.aurelian], 'his claim was made good by the grant; given back willingly, none');
  assert.equal(R.transfer(c, 'oakford', { holder: hamon, reason: 'grant' }), true);
  assert.equal(R.transfer(c, 'oakford', { holder: c.rulers.valedorn, reason: 'revoked' }), true);
  assert.deepEqual(plain(c.holdings.oakford.claims.map((k) => k.by)), [hamon]);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('transfer: refusals keep every holding with a lawful holder; caps and capitals hold', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const R = CL.realm;
  const hamon = byKey(c, 'hamon_greymantle');
  const cassian = byKey(c, 'cassian_vatro');
  const snap = () => JSON.stringify(c.holdings);
  const was = snap();
  assert.equal(R.transfer(c, 'greywall_fort', { holder: cassian }), false, 'a lord of another realm');
  assert.equal(R.transfer(c, 'greywall_fort', { holder: 'person:999' }), false, 'nobody');
  assert.equal(R.transfer(c, 'highmere', { controller: 'aurelian' }), false, 'a village follows its seat');
  assert.equal(R.transfer(c, 'stonebridge', { controller: 'aurelian' }), false, 'a capital never changes hands (P9-05)');
  assert.equal(R.transfer(c, 'greywall_fort', { controller: 'neutral' }), false, 'not a kingdom');
  assert.equal(R.transfer(c, 'merrow', { controller: 'valedorn' }), false, 'not a holding');
  assert.equal(snap(), was);
  // Hamon holds two; a third is fine, a fourth is over the cap (D-P8d). The ruler is uncapped.
  assert.equal(R.transfer(c, 'oakford', { holder: hamon }), true);
  assert.equal(R.transfer(c, 'fernley', { holder: hamon }), false, 'at most three fiefs');
  assert.equal(R.fiefsOf(hamon, c).length, 3);
  for (const sid of ['greywall_fort', 'highmere', 'oakford']) assert.equal(R.transfer(c, sid, { holder: c.rulers.valedorn, willing: true }), true);
  assert.ok(R.fiefsOf(c.rulers.valedorn, c).length > R.FIEF_CAP);
  // Occupation: one person holds it, another realm controls it, a third claims it (acceptance).
  assert.equal(R.transfer(c, 'greywall_fort', { controller: 'aurelian', sovereign: 'valedorn', reason: 'occupied' }), true);
  assert.equal(R.holderOf('greywall_fort', c), c.rulers.valedorn);
  assert.equal(R.owner('greywall_fort', c), 'aurelian');
  assert.equal(R.addClaim(c, 'greywall_fort', { by: byKey(c, 'astrid_hallsdottir'), realm: 'hrothmark', kind: 'conquest' }), true);
  assert.equal(R.addClaim(c, 'greywall_fort', { by: byKey(c, 'astrid_hallsdottir'), realm: 'hrothmark', kind: 'conquest' }), false, 'once');
  assert.match(R.holdingLine('greywall_fort', c), /King Godric Ardane · gates held by Aurelian · claimed by Lady Astrid Hallsdottir/);
  assert.match(R.tapLine('greywall_fort', c), /^Greywall Fort: held by King Godric Ardane for Valedorn; Aurelian holds its gates\.$/);
  assert.deepEqual(plain(R.invariants(c)), []);
});

test('the chronicle only when you are a party to it', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const n = c.chronicle.length;
  CL.realm.setOwner(c, 'westholt_castle', 'aurelian');
  assert.equal(c.chronicle.length, n, 'two realms and their lords: not your history');
  CL.realm.addClaim(c, 'castra_nova', { by: 'player', realm: null, kind: 'old' });
  CL.realm.setOwner(c, 'castra_nova', 'valedorn');
  assert.equal(c.chronicle.at(-1).kind, 'holding');
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), 'Castra Nova changed hands.');
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.chronicle.at(-1)), plain(c.chronicle.at(-1)));
});

test('story forts: only the story moves Greywall and Ashgate until Q4 ends; the Q4 effect goes through transfer', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const R = CL.realm;
  assert.equal(R.locked(c, 'greywall_fort'), true);
  assert.equal(R.locked(c, 'ashgate_fort'), true);
  assert.equal(R.locked(c, 'westholt_castle'), false);
  const before = events(CL, 'HoldingChanged').length;
  CL.story.apply([{ owner: 'greywall_fort', to: 'aurelian' }], c, { reason: 'test' });
  assert.equal(events(CL, 'HoldingChanged').length, before + 1, 'the story moves it, through transfer');
  assert.equal(R.holderOf('highmere', c), c.rulers.aurelian, 'its villages with it');
  CL.story.state(c).flags.ending = 'aurelian';
  assert.equal(R.locked(c, 'greywall_fort'), false, 'after the ending, as any fort');
});

test('villages follow their seat: recruits, contracts and markets read who controls it', () => {
  const { CL } = loadGame({ party: false, random: () => 0.5 });
  const c = CL.campaign;
  const s = CL.content.table('settlements').brackenfield;
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'brackenfield' });
  const valedorn = CL.content.get('factions', 'valedorn').recruits;
  assert.deepEqual(plain(CL.party.recruitsHere(c)), plain(valedorn));
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian');
  assert.deepEqual(plain(CL.party.recruitsHere(c)), plain(CL.content.get('factions', 'aurelian').recruits), 'Aurelian recruits now');
  CL.realm.adjust(c, 'aurelian', -60);
  assert.equal(CL.realm.welcomes(c, 'brackenfield'), false, 'its new owner’s standing bars you');
  assert.equal(CL.realm.welcomes(c, 'oakford'), true);
  // A soldier raised there before keeps the culture they were raised in.
  const old = CL.save.addSoldier(c, 'levy', null, { origin: 'oakford' });
  assert.equal(old.culture, 'valedorn');
  assert.equal(CL.soldiers.cultureFor('recruit', 'brackenfield', c), 'aurelian', 'a new one, the new owner’s');
});

test('soldiers are men: every new soldier has a man’s name; followers, rivals and nobles may be either', () => {
  const K = loadGame({ party: false }).CL.content.table('cultures');
  const women = new Set(Object.values(K).flatMap((k) => k.givenFemale));
  const men = new Set(Object.values(K).flatMap((k) => k.given));
  for (const n of women) assert.equal(men.has(n), false, n);
  const first = (name) => name.split(' ')[0];
  let followers = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const { CL } = loadGame({ party: false, seed });
    const c = CL.campaign;
    for (const [i, t] of ['levy', 'hunter', 'recruit', 'skirmisher', 'clansman', 'militia', 'mercenary', 'footman'].entries()) {
      const at = ['stonebridge', 'eastwatch', 'hrothgard', 'vessara', 'merrow', 'oakford', null, 'ashby'][i];
      const sold = CL.save.addSoldier(c, t, null, { origin: at });
      assert.ok(men.has(first(sold.name)), `seed ${seed}: ${sold.name} (${t})`);
    }
    // Followers draw from both lists, as before.
    c.gold = 5000;
    Object.assign(c.world, { location: 'stonebridge' });
    CL.quartermaster.hire(c);
    const q = c.followers.quartermaster;
    if (q && women.has(first(q.name))) followers++;
  }
  assert.ok(followers > 0, 'a follower may be a woman');
  // A troop of women soldiers would say so (the content checker allows only male or female).
  const womenLevies = (C) => {
    C.troops.levy = { ...C.troops.levy, gender: 'female' };
  };
  const { CL } = loadGame({ party: false, content: womenLevies });
  assert.ok(women.has(first(CL.save.addSoldier(CL.campaign, 'levy', null, { origin: 'stonebridge' }).name)));
});

test('the 4 → 5 migration names old soldiers from both lists, as before the split', () => {
  const { CL } = loadGame({ party: false });
  const K = CL.content.table('cultures');
  // The old single list was the men's then the women's names, in that order.
  for (const k of Object.values(K)) assert.ok(k.given.length && k.givenFemale.length);
  const d = { version: 4, rngSeed: 99, day: 3, roster: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, troop: 'levy', xp: 0 })) };
  const named = CL.soldiers.migrateRoster(d).roster.map((s) => s.name.split(' ')[0]);
  assert.ok(named.some((n) => K.valedorn.givenFemale.includes(n)), 'old saves keep the names they always migrated to');
});

test('content checks: a village with no seat or another kingdom’s, over the cap, a tie not returned', () => {
  const problems = (edit) => {
    const { CL } = loadGame({ party: false });
    const errs = [];
    const T = (name) => plain(CL.content.table(name));
    const D = { settlements: T('settlements'), factions: T('factions'), world_map: T('world_map') };
    edit(D);
    CL.realm.validate(D, (m) => errs.push(m));
    return errs;
  };
  assert.deepEqual(problems(() => {}), []);
  assert.match(problems((D) => delete D.settlements.highmere.seat).join(), /highmere: a village needs a seat/);
  assert.match(problems((D) => (D.settlements.highmere.seat = 'eastwatch')).join(), /highmere: seat eastwatch is not a fort or town of valedorn/);
  assert.match(
    problems((D) => D.world_map.sundered_realm.nobles.find((n) => n.id === 'hamon_greymantle').holds.push('oakford', 'fernley')).join(),
    /hamon_greymantle: holds 4 fiefs; a lord holds at most 3/,
  );
  assert.match(
    problems((D) => (D.world_map.sundered_realm.nobles.find((n) => n.id === 'hawise_greymantle').kin = [])).join(),
    /hamon_greymantle: kin tie to hawise_greymantle \(sibling\) isn't returned/,
  );
  assert.match(problems((D) => (D.settlements.oakford.story = true)).join(), /oakford: only a fort can be a story fort/);
});

test('saves: people, rulers and holdings round-trip; junk is repaired; a kingdom the build lacks is refused', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  CL.realm.setOwner(c, 'westholt_castle', 'aurelian');
  CL.realm.addClaim(c, 'skarnwall', { by: 'player', realm: null, kind: 'old' });
  const back = CL.save.fromRaw(plain(c)).campaign;
  for (const k of ['people', 'rulers', 'holdings', 'nextPersonId']) assert.deepEqual(plain(back[k]), plain(c[k]), k);
  assert.equal('owners' in back, false);
  const d = plain(c);
  d.people['person:2'].kin.push({ person: 'person:404', tie: 'child' }, { person: 'person:3', tie: 'lover' });
  d.people['person:2'].gender = 'dragon';
  d.people['person:77'] = { realm: 'nowhere' };
  d.rulers.valedorn = 'person:9';
  d.holdings.highmere.holder = byKey(c, 'cassian_vatro');
  const fixed = CL.save.fromRaw(d).campaign;
  assert.equal(fixed.people['person:2'].kin.length, 2, 'unknown kin and ties dropped');
  assert.equal(fixed.people['person:2'].gender, 'male');
  assert.equal(fixed.people['person:77'], undefined);
  assert.equal(fixed.rulers.valedorn, c.rulers.valedorn, 'a ruler of the wrong realm falls back');
  assert.equal(fixed.holdings.highmere.holder, c.holdings.highmere.holder, 'a holder not sworn to it falls back');
  assert.deepEqual(plain(CL.realm.invariants(fixed)), []);
  const gone = plain(c);
  gone.holdings.greywall_fort.controller = 'atlantis';
  const r = CL.save.fromRaw(gone);
  assert.equal(r.campaign, null);
  assert.equal(r.incompatible, true);
  assert.match(r.problems[0], /kingdoms this version of the game does not have: atlantis \(at Greywall Fort\)/);
});

test('2.23.0 saves (fixtures from 9826a3e) load with the same world, and the story reads the same', () => {
  assert.deepEqual(index.map((f) => f.expect.build), index.map(() => '2.23.0'));
  assert.ok(index.length >= 4);
  for (const f of index) {
    const text = fixture(f.file);
    const { CL } = loadGame({ party: false });
    const r = CL.portable.importText(text);
    assert.equal(r.ok, true, `${f.file}: ${r.reason}`);
    assert.equal(r.migrated, true);
    const c = CL.campaign;
    assert.equal(c.version, CL.save.VERSION);
    assert.equal(c.character.name, f.expect.name);
    for (const k of ['gold', 'renown', 'battles', 'victories']) assert.equal(c[k], f.expect[k], `${f.file} ${k}`);
    assert.deepEqual(plain(c.roster.map((s) => s.id)), f.expect.soldierIds);
    assert.deepEqual(plain(c.roster.map((s) => s.name)), JSON.parse(text).campaign.roster.map((s) => s.name), 'soldiers keep their names');
    assert.equal(c.world.location, f.expect.location);
    for (const [q, st] of Object.entries(f.expect.quests || {})) assert.equal(c.story.quests[q]?.status, st, q);
    // Every fort's owner, and every story `owner` condition, read as before.
    for (const [fort, o] of Object.entries(f.expect.owners)) {
      assert.equal(CL.realm.owner(fort, c), o, `${f.file}: ${fort}`);
      for (const k of CL.realm.kingdoms()) assert.equal(CL.story.test({ owner: fort, is: k.id }, c), o === k.id);
    }
    assert.deepEqual(plain(CL.realm.invariants(c)), [], f.file);
    assert.equal(JSON.stringify(c.people), JSON.stringify(CL.realm.startingPeople().people), 'the people as 2.24.0 begins them');
    assert.deepEqual(plain(c.followers ? Object.keys(c.followers).filter((k) => c.followers[k]).sort() : []), f.expect.followers);
    assert.deepEqual(plain(c.retinue.map((m) => m.id)), f.expect.retinue);
    assert.deepEqual(plain(c.businesses.owned.map((b) => ({ place: b.place, owner: b.owner, seizeOn: b.seizeOn }))), f.expect.mills);
    // Stable: export and import again changes nothing.
    const again = loadGame({ party: false }).CL;
    assert.equal(again.portable.importText(CL.portable.serialize(c)).ok, true);
    assert.equal(JSON.stringify(again.campaign), JSON.stringify(c));
    CL.party.advanceDays(2);
    assert.equal(CL.save.write(), true);
  }
});

test('the Q4 fixture: Aurelia’s ruler holds Greywall and its villages, with Valedorn claims; the mill’s law is told', () => {
  const { CL, uiCalls } = loadGame({ party: false });
  assert.equal(CL.portable.importText(fixture('q4-aurelia.json')).ok, true);
  const c = CL.campaign;
  const R = CL.realm;
  assert.equal(CL.story.state(c).flags.ending, 'aurelian');
  for (const sid of ['greywall_fort', 'highmere', 'brackenfield']) {
    const h = c.holdings[sid];
    assert.equal(h.sovereign, 'aurelian', sid);
    assert.equal(h.controller, 'aurelian', sid);
    assert.equal(h.holder, c.rulers.aurelian, sid);
    assert.deepEqual(plain(h.claims.map((k) => [c.people[k.by].key, k.realm, k.kind])), [[sid === 'brackenfield' ? 'hawise_greymantle' : 'hamon_greymantle', 'valedorn', 'old']], sid);
  }
  assert.equal(R.locked(c, 'greywall_fort'), false, 'the story has ended');
  // The same as the ending would give in this build: play Q4 to the end here and compare.
  const fresh = loadGame({ party: false }).CL;
  fresh.realm.setOwner(fresh.campaign, 'greywall_fort', 'aurelian', 'story');
  for (const sid of ['greywall_fort', 'highmere', 'brackenfield']) {
    const a = plain(c.holdings[sid]);
    const b = plain(fresh.campaign.holdings[sid]);
    for (const k of a.claims.concat(b.claims)) delete k.since;
    assert.deepEqual(a, b, sid);
  }
  // Brackenfield followed its seat, so the mill there now answers to Aurelia's law, and you are told.
  const mill = c.businesses.owned[0];
  assert.equal(mill.owner, 'valedorn', 'as the old build left it');
  CL.business.tick(c);
  assert.equal(mill.owner, 'aurelian');
  assert.ok(uiCalls.some((u) => u[0] === 'message' && /^Your mill: Brackenfield is now held by Aurel/.test(u[1])));
});

test('the migration is pure, and a save of another world keeps just its owner overrides', () => {
  const { CL } = loadGame({ party: false });
  const v18 = JSON.parse(fixture('q4-aurelia.json')).campaign;
  const copy = JSON.stringify(v18);
  const a = CL.save.migrateHoldings(v18);
  assert.equal(JSON.stringify(v18), copy, 'unchanged input');
  assert.equal(JSON.stringify(CL.save.migrateHoldings(JSON.parse(copy))), JSON.stringify(a), 'the same output every time');
  assert.equal(a.version, 19);
  assert.equal('owners' in a, false);
  const other = CL.save.migrateHoldings({ version: 18, worldId: 'test_reaches', owners: { greywall_fort: 'sunhold' } });
  assert.deepEqual(plain(other.holdings), { greywall_fort: { controller: 'sunhold', sovereign: 'sunhold' } });
});

test('invariants hold after every world day of a 90-day campaign', () => {
  const { CL } = newCampaign(11);
  const bot = makeBot(CL);
  const c = () => CL.campaign;
  // World events now and then: forts that may change hands do (the story forts stay put).
  const movable = CL.realm.forts().filter((s) => !CL.realm.locked(c(), s.id));
  for (let day = 1; day <= 90; day++) {
    bot.play(1);
    if (day % 15 === 0) {
      const fort = movable[(day / 15) % movable.length];
      const ks = CL.realm.realms().map((k) => k.id);
      CL.realm.setOwner(c(), fort.id, ks[(ks.indexOf(CL.realm.owner(fort.id, c())) + 1) % ks.length], 'test');
    }
    assert.deepEqual(plain(CL.realm.invariants(c())), [], `day ${day}`);
  }
  assert.ok(c().day >= 90);
  assert.deepEqual(plain(bot.stats.invariants), [], 'and the bot found none on its own days');
});
