// W-05b: the bigger region's content. The Sundered Realm (200 × 200): the Border March whole in the
// middle; Valedorn and Aurelian reaching west and east; Hrothmark in the northern highlands and the
// Vessaro League on the southern coast (decision D-W3: placeholder names, data only); the Free City of
// Merrow; Reaver lairs in every region. Saves from before it grew are refused and kept safe (decision
// D-W2, owner 2026-11-19).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');

const NEW_KINGDOMS = ['hrothmark', 'vessaro'];
const plain = (v) => JSON.parse(JSON.stringify(v));

test('six kingdoms, two free cities and the Reavers; each kingdom a capital, two forts and three to five villages', () => {
  const { CL } = loadGame();
  assert.deepEqual(Array.from(CL.content.validate()), []);
  const all = Object.values(CL.content.table('settlements'));
  assert.equal(all.length, 44); // P10-02: the coast's 13 too
  for (const k of ['valedorn', 'aurelian', ...NEW_KINGDOMS, 'ostrand', 'saltreach']) {
    const own = all.filter((s) => s.ownerFaction === k);
    const n = (type) => own.filter((s) => s.type === type).length;
    assert.equal(n('town'), 1, `${k}: one capital`);
    assert.equal(n('fort'), 2, `${k}: two forts or castles`);
    assert.ok(n('village') >= 3 && n('village') <= 5, `${k}: ${n('village')} villages`);
  }
  const city = all.filter((s) => s.ownerFaction === 'merrow');
  assert.deepEqual(plain(city.map((s) => [s.id, s.type])), [['merrow', 'town']]);
  assert.deepEqual(plain(CL.content.get('factions', 'merrow').recruits), ['mercenary'], 'the free city hires sell-swords');
  assert.deepEqual(plain(all.filter((s) => s.ownerFaction === 'gullhaven').map((s) => [s.id, s.type])), [['gullhaven', 'town']]);
  // Every region has two lairs.
  const lairs = {};
  for (const st of Object.values(CL.world.map().sites)) {
    const r = CL.world.regionAt(st.mapX, st.mapY).id.replace(/^(west|east)_march$/, 'march');
    lairs[r] = (lairs[r] || 0) + 1;
  }
  for (const r of ['march', 'north', 'south', 'west', 'east', 'fells', 'cliffs', 'flats']) assert.equal(lairs[r], 2, r);
  assert.equal(lairs.merrow_coast, undefined);
  assert.equal(lairs.gull_shore, undefined, 'the free ports keep their shores clear');
});

test('every settlement has a market or a reason not to; the free city has the best market and armoury; boards in every capital', () => {
  const { CL } = loadGame();
  const all = Object.values(CL.content.table('settlements'));
  for (const s of all) {
    if (s.type === 'fort') assert.equal(CL.trade.hasMarket(s.id), false, `${s.id}: a fort keeps its stores to itself`);
    else assert.equal(CL.trade.hasMarket(s.id), true, `${s.id}: towns and villages trade`);
  }
  const towns = all.filter((s) => s.type === 'town');
  for (const t of towns) assert.ok(t.services.includes('contracts') && t.services.includes('recruit'), `${t.id}: a contract board and recruits`);
  const avg = (s) => Object.values(s.market).reduce((a, b) => a + b, 0) / Object.keys(s.market).length;
  const best = [...towns].sort((a, b) => avg(a) - avg(b))[0];
  assert.equal(best.id, 'merrow');
  assert.ok(towns.every((t) => t.gear.length <= CL.content.get('settlements', 'merrow').gear.length));
  // Timber is cheap in the northern forests, wine on the southern coast.
  assert.ok(CL.content.get('settlements', 'hrothgard').market.timber < CL.content.get('settlements', 'vessara').market.timber);
  assert.ok(CL.content.get('settlements', 'vessara').market.wine < CL.content.get('settlements', 'hrothgard').market.wine);
});

test('the new kingdoms have full tier 1–3 troop trees in their own style, with names of their own culture', () => {
  const { CL } = loadGame();
  const T = CL.content.table('troops');
  for (const k of NEW_KINGDOMS) {
    const line = Object.values(T).filter((t) => t.faction === k && t.gender !== 'female'); // P10-09: the women's lines are their own
    assert.equal(line.length, 6, k);
    assert.deepEqual(plain(line.map((t) => t.tier).sort()), ['T1', 'T2', 'T2', 'T3', 'T3', 'T3']);
    assert.ok(line.some((t) => t.role === 'cavalry'), `${k}: a cavalry branch`);
    assert.ok(line.some((t) => t.shield), `${k}: shields`);
    for (const r of CL.content.get('factions', k).recruits) assert.equal(T[r].faction, k);
    // Every troop is reachable from the recruits by upgrades.
    const seen = new Set(CL.content.get('factions', k).recruits);
    for (let grew = true; grew; ) {
      grew = false;
      for (const id of [...seen]) for (const u of [T[id].upgradeTo, T[id].altUpgradeTo]) if (u && !seen.has(u)) grew = seen.add(u);
    }
    assert.equal(seen.size, 6, `${k}: the whole tree grows from its recruits`);
    assert.ok(CL.content.table('cultures')[CL.content.get('factions', k).culture], `${k}: its own culture`);
  }
  const avg = (k, stat, role) => {
    const l = Object.values(T).filter((t) => t.faction === k && t.role === role);
    return l.reduce((a, t) => a + t[stat], 0) / l.length;
  };
  assert.ok(avg('hrothmark', 'armor', 'infantry') > avg('vessaro', 'armor', 'infantry'), 'northern heavy infantry');
  assert.ok(T.crossbowman.damage > T.hunter.damage && T.crossbowman.ranged.cooldown > T.hunter.ranged.cooldown, 'crossbows hit hard, load slowly');
  assert.ok(T.light_horse.speed > T.rider.speed && T.light_horse.armor < T.rider.armor, 'light horse');
  // Hrothgard hires its own.
  const { CL: G } = loadGame();
  Object.assign(G.campaign.world, { location: 'hrothgard' });
  assert.deepEqual(plain(G.party.recruitsHere()).slice(0, 2), ['clansman', 'fell_archer']);
});

test('reachable: a journey between the farthest capitals arrives in well under four days', () => {
  const { CL } = loadGame();
  const caps = Object.values(CL.content.table('settlements')).filter((s) => s.type === 'town');
  let far = null;
  for (const a of caps) {
    for (const b of caps) {
      const d = CL.world.mapDist(a.mapX, a.mapY, b.mapX, b.mapY);
      if (!far || d > far.d) far = { a, b, d };
    }
  }
  const w = CL.campaign.world;
  CL.world.leaveSettlement();
  Object.assign(w, { x: far.a.mapX, y: far.a.mapY, location: null });
  CL.campaign.parties = []; // nobody in the way: this is about the road, not the Reavers
  CL.campaign.food = 999;
  const day0 = CL.campaign.day;
  CL.game.mode = 'map';
  CL.world.travelTo({ type: 'settlement', id: far.b.id, x: far.b.mapX, y: far.b.mapY });
  for (let i = 0; i < 20000 && CL.game.travel; i++) CL.world.update(0.05);
  assert.equal(w.location, far.b.id, `${far.a.id} → ${far.b.id} arrives`);
  const days = CL.campaign.day - day0;
  assert.ok(days > 0.5 && days < 4, `${far.a.id} → ${far.b.id}: ${days.toFixed(2)} days`);
});

test('the world fills with bands, patrols and caravans, and nothing ever leaves the map', () => {
  const { CL } = loadGame({ worldParties: true });
  const c = CL.campaign;
  const tpl = (p) => CL.content.get('party_templates', p.template);
  for (const k of NEW_KINGDOMS) assert.ok(c.parties.some((p) => tpl(p).faction === k && tpl(p).kind === 'patrol'), `${k} patrols`);
  // Caravans run between each capital and a free city (P10-02: Merrow, or the coast's Gullhaven).
  const routes = Object.values(CL.content.table('party_templates')).filter((t) => t.kind === 'caravan');
  const free = Object.values(CL.content.table('settlements')).filter((s) => CL.content.get('factions', s.ownerFaction).freeCity).map((s) => s.id);
  for (const town of Object.values(CL.content.table('settlements')).filter((s) => s.type === 'town' && !free.includes(s.id))) {
    assert.ok(
      routes.some((t) => t.route.includes(town.id) && t.route.some((id) => free.includes(id))),
      `a caravan between ${town.id} and a free city`,
    );
  }
  assert.ok(routes.some((t) => t.route.includes('gullhaven') && t.route.includes('merrow')), 'Gullhaven trades with Merrow');
  c.food = 9999;
  c.gold = 9999;
  const b = CL.world.bounds();
  for (let d = 0; d < 10; d++) {
    CL.parties.tick(c, 24);
    for (const p of c.parties) assert.ok(p.x >= 0 && p.x <= b.w && p.y >= 0 && p.y <= b.h, `${p.template} at ${p.x},${p.y}`);
  }
  assert.ok(c.parties.length > 15, 'the world stays populated');
});

test('news names the region: Reavers in the northern highlands', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const at = CL.content.get('settlements', 'thornvik');
  CL.news.record(c, 'patrol_beaten', { x: at.mapX, y: at.mapY, faction: 'hrothmark' });
  assert.match(CL.news.bulletin(c).text, /Hrothmark soldiers near Thornvik/);
  CL.news.record(c, 'patrol_beaten', { x: at.mapX, y: at.mapY, faction: 'hrothmark' });
  c.day += 3;
  assert.match(CL.news.bulletin(c).text, /^The roads of the northern highlands are not safe: Reavers cut up Hrothmark soldiers near Thornvik\.$/);
});

// ---- Saves from before the world grew (decision D-W2) ----

const FIXTURE = path.join(__dirname, 'fixtures', 'saves-2.0', 'campaign-day20.json');

test('a save from before the world grew is refused on load, kept safe untouched, and a new campaign begins', () => {
  const old = JSON.stringify(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).campaign);
  const storage = memoryStorage({ crownless_save: old });
  const { CL, uiCalls } = loadGame({ storage, party: false });
  assert.equal(CL.save.existed, false, 'nothing to continue');
  assert.equal(CL.campaign.worldId, CL.world.id());
  assert.equal(CL.campaign.day, 0, 'a new campaign');
  assert.equal(storage.data[CL.save.OTHER_WORLD_KEY], old, 'the old save, exactly as it was');
  assert.match(CL.save.notice, /^The world has grown: new kingdoms lie beyond the March/);
  // Playing on never overwrites the kept copy.
  CL.party.advanceDays(2);
  assert.equal(CL.save.write(), true);
  assert.equal(CL.save.write(), true);
  assert.equal(storage.data[CL.save.OTHER_WORLD_KEY], old);
  const back = loadGame({ storage, party: false });
  assert.equal(back.CL.save.existed, true, 'the new campaign continues');
  assert.equal(back.CL.save.notice ?? null, null, 'and the message is not repeated');
  assert.ok(Array.isArray(uiCalls));
});

test('an exported save from before the world grew is refused by name', () => {
  const { CL } = loadGame({ party: false });
  const r = CL.portable.importText(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(r.ok, false);
  assert.match(r.reason, /world this version no longer has/);
});

