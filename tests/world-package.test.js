// W-04: a data-driven world. The world's size, kingdoms, start, regions and view come from its package
// (data/world_map.js); a three-kingdom test world on a 150 × 120 map plays; and js/ names no kingdom
// or world and has no 0–100 bound literals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');
const { testWorld, WORLD, THIRD, THIRD_LANDS } = require('./helpers/test-world'); // the bot plays it in tests/slow/test-world.test.js

const ROOT = path.join(__dirname, '..');

test('the Border March package: its bounds, kingdoms, outlaws, start, regions and view', () => {
  const { CL } = loadGame();
  const m = CL.world.map();
  assert.equal(CL.world.id(), 'border_march');
  assert.deepEqual({ ...CL.world.bounds() }, { w: 100, h: 100 });
  assert.deepEqual(Array.from(CL.realm.kingdoms(), (k) => k.id), ['valedorn', 'aurelian']);
  assert.equal(CL.realm.outlaws(), 'neutral');
  assert.equal(CL.world.start().id, 'stonebridge');
  assert.equal(CL.world.regionAt(20, 50).name, 'the western march');
  assert.equal(CL.world.regionAt(80, 50).name, 'the eastern march');
  assert.equal(m.view.zoom, 1);
  assert.deepEqual(Array.from(CL.world.clampToMap(120, -4, 2)), [98, 2]);
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('validation: places, terrain and parties inside the bounds; owners and parties of this world', () => {
  // Each case edits a fresh copy of the content after the game has loaded, then validates it.
  const problems = (edit) => {
    const { CL, sandbox } = loadGame();
    edit(sandbox.CROWNLESS_CONTENT);
    return Array.from(CL.content.validate()).join('\n');
  };
  assert.match(problems((C) => (C.settlements.redfield.mapX = 104)), /settlement redfield outside the map/);
  assert.match(problems((C) => (C.world_map.border_march.sites.looter_camp.mapY = -1)), /site looter_camp outside the map/);
  assert.match(problems((C) => C.world_map.border_march.river.push([50, 130])), /terrain outside the map/);
  assert.match(problems((C) => (C.settlements.oakford.ownerFaction = 'nobody')), /oakford/);
  assert.match(problems((C) => (C.world_map.border_march.factions = ['valedorn', 'ghosts'])), /unknown kingdom ghosts/);
  assert.match(problems((C) => (C.world_map.border_march.start = 'atlantis')), /unknown start atlantis/);
  assert.match(problems((C) => delete C.world_map.border_march.bounds), /needs bounds/);
  assert.match(problems((C) => (C.world_map.border_march.factions = ['valedorn'])), /owned by aurelian, not one of this world's factions/);
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

test('a save of the March and of the test world each loads only where its world exists', () => {
  const march = loadGame();
  march.CL.save.write();
  const text = march.storage.data[march.CL.save.KEY];
  assert.equal(march.CL.save.fromRaw(JSON.parse(text)).campaign.worldId, 'border_march');
  const other = loadGame({ content: testWorld });
  const r = other.CL.save.fromRaw(JSON.parse(text));
  assert.equal(r.campaign, null, 'a Border March save in a build without that world is refused');
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
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, ''); // comments may name them
      const at = `${f}:${i + 1}`;
      if (/'(valedorn|aurelian)'/.test(code)) problems.push(`${at} names a kingdom`);
      // The one exception: the 2 → 3 save migration records that every v2 save was a Border March one.
      if (/'border_march'/.test(code) && !(f === 'save.js' && /version: 3, worldId:/.test(code))) problems.push(`${at} names a world`);
      if (/'neutral'/.test(code) && f !== 'realm.js') problems.push(`${at} names the outlaw faction`);
      if (/\b0, 100\)|\b2, 98\)|\b5, 95\)|\(98,|\b98\)/.test(code)) problems.push(`${at} has a map bound literal`);
    });
  }
  assert.deepEqual(problems, []);
});
