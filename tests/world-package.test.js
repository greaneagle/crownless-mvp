// W-04: a data-driven world. The world's size, kingdoms, start, regions and view come from its package
// (data/world_map.js); a three-kingdom test world on a 150 × 120 map plays; and js/ names no kingdom
// or world and has no 0–100 bound literals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');
const { testWorld, WORLD, THIRD, THIRD_LANDS } = require('./helpers/test-world'); // the bot plays it in tests/slow/test-world.test.js

const ROOT = path.join(__dirname, '..');

test('the Sundered Realm package (W-05b): its bounds, kingdoms, outlaws, start, regions and view', () => {
  const { CL } = loadGame();
  const m = CL.world.map();
  assert.equal(CL.world.id(), 'sundered_realm');
  assert.deepEqual({ ...CL.world.bounds() }, { w: 200, h: 200 });
  assert.deepEqual(Array.from(CL.realm.kingdoms(), (k) => k.id), ['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'merrow']);
  assert.equal(CL.realm.outlaws(), 'neutral');
  assert.equal(CL.world.start().id, 'stonebridge');
  assert.equal(CL.world.regionAt(70, 100).name, 'the western march');
  assert.equal(CL.world.regionAt(130, 100).name, 'the eastern march');
  assert.equal(CL.world.regionAt(100, 20).name, 'the northern highlands');
  assert.equal(CL.world.regionAt(80, 180).name, 'the southern coast');
  assert.equal(CL.world.regionAt(180, 170).name, 'the Merrow coast');
  assert.equal(m.view.zoom, 1);
  assert.deepEqual(Array.from(CL.world.clampToMap(220, -4, 2)), [198, 2]);
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('validation: places, terrain and parties inside the bounds; owners and parties of this world', () => {
  // Each case edits a fresh copy of the content after the game has loaded, then validates it.
  const problems = (edit) => {
    const { CL, sandbox } = loadGame();
    edit(sandbox.CROWNLESS_CONTENT);
    return Array.from(CL.content.validate()).join('\n');
  };
  assert.match(problems((C) => (C.settlements.redfield.mapX = 204)), /settlement redfield outside the map/);
  assert.match(problems((C) => (C.world_map.sundered_realm.sites.looter_camp.mapY = -1)), /site looter_camp outside the map/);
  assert.match(problems((C) => C.world_map.sundered_realm.river.push([50, 230])), /terrain outside the map/);
  assert.match(problems((C) => (C.world_map.sundered_realm.armies.garrisons = 0.5)), /armies\.garrisons must be/); // P9-B3
  assert.match(problems((C) => (C.world_map.sundered_realm.armies.dragons = 2)), /armies\.dragons must be/);
  assert.match(problems((C) => (C.settlements.oakford.ownerFaction = 'nobody')), /oakford/);
  assert.match(problems((C) => (C.world_map.sundered_realm.factions = ['valedorn', 'ghosts'])), /unknown kingdom ghosts/);
  assert.match(problems((C) => (C.world_map.sundered_realm.start = 'atlantis')), /unknown start atlantis/);
  assert.match(problems((C) => delete C.world_map.sundered_realm.bounds), /needs bounds/);
  assert.match(problems((C) => (C.world_map.sundered_realm.factions = ['valedorn'])), /owned by aurelian, not one of this world's factions/);
});

test('the test world: three kingdoms with other names on a 150 × 120 map', () => {
  const { CL } = loadGame({ content: testWorld, worldParties: true });
  assert.deepEqual(Array.from(CL.content.validate()), []);
  assert.equal(CL.world.id(), WORLD);
  assert.equal(CL.campaign.worldId, WORLD);
  assert.deepEqual({ ...CL.world.bounds() }, { w: 150, h: 120 });
  assert.deepEqual(Array.from(CL.realm.kingdoms(), (k) => k.id), ['northmark', 'sunhold', THIRD]);
  assert.deepEqual({ ...CL.campaign.reputation }, { northmark: 0, sunhold: 0, [THIRD]: 0 });
  for (const id of THIRD_LANDS) assert.equal(CL.realm.owner(id), THIRD);
  // The start is the world's own, at its stretched position.
  const s = CL.world.start();
  assert.deepEqual([CL.campaign.world.x, CL.campaign.world.y], [s.mapX, s.mapY]);
  // The map camera fits it (below 1×), the troop tree is in the factions' order, the banner has its letter.
  assert.ok(CL.mapView.fitZoom() < 1);
  CL.game.revealTree = true;
  // (The Iron Reach fields Sunhold's troops, so it has no line of its own; the lines keep data order.)
  assert.deepEqual(Array.from(CL.troopTree.view(CL.campaign), (line) => line.faction), ['northmark', 'sunhold', 'neutral']);
  assert.equal(CL.content.get('factions', THIRD).emblem, 'I');
  // The Debug panel's "switch owner" goes round all three kingdoms.
  CL.debugTools.toggle = () => {};
  const fort = CL.realm.forts()[0].id;
  const seen = [CL.realm.owner(fort)];
  for (let i = 0; i < 3; i++) {
    const ks = CL.realm.kingdoms().map((k) => k.id);
    CL.realm.setOwner(CL.campaign, fort, ks[(ks.indexOf(CL.realm.owner(fort, CL.campaign)) + 1) % ks.length], 'test');
    seen.push(CL.realm.owner(fort, CL.campaign));
  }
  assert.deepEqual(seen.slice(0, 3).sort(), ['northmark', 'sunhold', THIRD].sort());
  assert.equal(seen[3], seen[0], 'and back');
});

test('a save of the realm and of the test world each loads only where its world exists', () => {
  const march = loadGame();
  march.CL.save.write();
  const text = march.storage.data[march.CL.save.KEY];
  assert.equal(march.CL.save.fromRaw(JSON.parse(text)).campaign.worldId, 'sundered_realm');
  const other = loadGame({ content: testWorld });
  const r = other.CL.save.fromRaw(JSON.parse(text));
  assert.equal(r.campaign, null, 'a save of the realm in a build without that world is refused');
  assert.equal(r.otherWorld, true);
  other.CL.save.write();
  assert.equal(other.CL.save.fromRaw(JSON.parse(other.storage.data[other.CL.save.KEY])).campaign.worldId, WORLD);
  assert.equal(march.CL.save.fromRaw(JSON.parse(other.storage.data[other.CL.save.KEY])).otherWorld, true);
});

test('js/ names no kingdom or world, and has no 0–100 bound literals', () => {
  const dir = path.join(ROOT, 'js');
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    let constants = false; // the 18 → 19 migration's constants (P8-02): the Sundered Realm as 2.24.0 began it
    lines.forEach((line, i) => {
      if (f === 'save.js' && /const V19_SUNDERED = \{/.test(line)) constants = true;
      if (constants && /^ {2}\};/.test(line)) constants = false;
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, ''); // comments may name them
      const at = `${f}:${i + 1}`;
      if (/'(valedorn|aurelian)'/.test(code) && !constants) problems.push(`${at} names a kingdom`);
      // The one exception: the 2 → 3 save migration records that every v2 save was a Border March one.
      if (/'border_march'/.test(code) && !(f === 'save.js' && /version: 3, worldId:/.test(code))) problems.push(`${at} names a world`);
      if (/'neutral'/.test(code) && f !== 'realm.js') problems.push(`${at} names the outlaw faction`);
      if (/\b0, 100\)|\b2, 98\)|\b5, 95\)|\(98,|\b98\)/.test(code)) problems.push(`${at} has a map bound literal`);
    });
  }
  assert.deepEqual(problems, []);
});

// P9-08: the second official world, the Sundered Coast (data/worlds/sundered_coast.js).
test('the Sundered Coast: two realms and a free port on 150 × 120, its own people and troops, a sandbox', () => {
  const { CL } = loadGame({ world: 'sundered_coast', party: false });
  assert.deepEqual(Array.from(CL.content.validate()), []);
  assert.deepEqual(JSON.parse(JSON.stringify(CL.worlds.installed().map((w) => w.id))), ['sundered_realm', 'sundered_coast']);
  assert.equal(CL.world.id(), 'sundered_coast');
  assert.equal(CL.packs.official(), 'sundered_coast', 'the world in play is the one ids resolve against');
  assert.deepEqual({ ...CL.world.bounds() }, { w: 150, h: 120 });
  assert.deepEqual(Array.from(CL.realm.realms(), (k) => k.id), ['ostrand', 'saltreach']);
  assert.ok(CL.realm.kingdoms().find((k) => k.id === 'gullhaven').freeCity);
  assert.equal(CL.world.start().id, 'gullhaven');
  // Its own cultures, troop lines (three a realm) and eight lords, one ruler a realm.
  const T = Object.values(CL.content.table('troops'));
  for (const f of ['ostrand', 'saltreach']) {
    assert.equal(T.filter((t) => t.faction === f).length, 3, `${f}: three troops`);
    assert.equal(CL.content.get('factions', f).culture, f, `${f}: its own culture`);
    assert.equal(CL.realm.forts().filter((s) => s.ownerFaction === f).length, 2, `${f}: two forts`);
  }
  const nobles = CL.world.map().nobles;
  assert.equal(nobles.length, 8);
  assert.deepEqual(Array.from(nobles.filter((n) => n.ruler), (n) => n.realm), ['ostrand', 'saltreach']);
  // The shared tables stay the game's; merge changed only what it names.
  assert.ok(CL.content.get('items', 'arming_sword'));
  assert.equal(CL.content.get('companions', 'sigrun').home, 'harrowgate');
  assert.deepEqual(Array.from(CL.content.get('tournaments', 'lists').hosts), ['gullhaven', 'harrowgate', 'calder']);
  // A sandbox: no story, and a new campaign begins as the others are after theirs.
  assert.equal(Object.keys(CL.content.table('quests')).length, 0);
  CL.game.newGame = true;
  CL.character.begin({ name: 'Coaster', background: 'farmhand' });
  const c = CL.campaign;
  assert.deepEqual([c.worldId, c.world.location, CL.story.state(c).flags.ending], ['sundered_coast', 'gullhaven', 'sandbox']);
  assert.equal(Object.keys(c.people).length, 8);
  assert.equal(CL.realm.invariants(c).length, 0);
});

test('a save of one official world, opened in the other, is sent to its own world untouched', () => {
  const coast = loadGame({ world: 'sundered_coast' });
  coast.CL.save.write();
  const coastSave = coast.storage.data[coast.CL.save.KEY];
  const realm = loadGame();
  realm.CL.save.write();
  const realmSave = realm.storage.data[realm.CL.save.KEY];
  const there = loadGame({ storage: memoryStorage({ [coast.CL.save.KEY]: coastSave }) });
  assert.equal(there.CL.save.elsewhere, 'sundered_coast');
  assert.equal(there.CL.save.existed, false);
  assert.equal(there.storage.data[coast.CL.save.KEY], coastSave, 'the save is untouched');
  assert.match(there.CL.save.fromRaw(JSON.parse(coastSave)).problems[0], /belongs to the world The Sundered Coast/);
  // Chosen in storage, the coast opens it.
  const back = loadGame({ storage: memoryStorage({ [coast.CL.save.KEY]: coastSave }), world: 'sundered_coast' });
  assert.equal(back.CL.save.existed, true);
  assert.equal(back.CL.campaign.worldId, 'sundered_coast');
  assert.equal(loadGame({ world: 'sundered_coast', storage: memoryStorage({ [realm.CL.save.KEY]: realmSave }) }).CL.save.elsewhere, 'sundered_realm');
  // A file import names the world to choose instead.
  assert.match(realm.CL.portable.parse(coastSave).reason, /^This save belongs to The Sundered Coast\. Choose that world at a new game, then import it again\.$/);
});
