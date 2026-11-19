// Content validation: every data/*.js module loads, IDs are consistent and
// cross-references resolve. Canon checks follow Crownless_MVP_GDD_v1.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadContent, CONTENT_MODULES } = require('./helpers/load');

const C = loadContent();
const ASSET_DIR = path.join(__dirname, '..', 'assets');

test('every content module loads and every table is non-empty', () => {
  assert.equal(CONTENT_MODULES.length, 19); // 1.4.0 added data/names.js (V2-03); 2.19.0 data/world_events.js (P7-08)
  for (const [name, table] of Object.entries(C)) {
    assert.ok(Object.keys(table).length > 0, `empty table: ${name}`);
  }
});

test('record keys match their id fields', () => {
  for (const m of Object.keys(C)) {
    if (m === 'forge') continue; // the blacksmith's rules (P7-03), not a table of records
    for (const [key, rec] of Object.entries(C[m])) {
      assert.equal(rec.id, key, `${m}.${key} has id '${rec.id}'`);
    }
  }
});

test('troops reference known factions and upgrade targets', () => {
  for (const t of Object.values(C.troops)) {
    assert.ok(C.factions[t.faction], `${t.id}: unknown faction ${t.faction}`);
    for (const u of [t.upgradeTo, t.altUpgradeTo]) {
      if (u) assert.ok(C.troops[u], `${t.id}: unknown upgrade ${u}`);
    }
    for (const stat of ['hp', 'damage', 'armor', 'speed', 'reach']) {
      assert.ok(Number.isFinite(t[stat]) && t[stat] >= 0, `${t.id}.${stat} invalid`);
    }
  }
});

test('the 15 GDD troop definitions exist', () => {
  const required = [
    'levy', 'footman', 'guard', 'hunter', 'longbowman', 'rider',
    'recruit', 'spearman', 'legionary', 'skirmisher', 'marksman', 'horse_scout',
    'looter', 'reaver', 'mercenary',
  ];
  for (const id of required) assert.ok(C.troops[id], `missing troop ${id}`);
});

// The Border March: since W-05b at + 50, + 50 in the middle of the bigger world.
const inMarch = (s) => s.mapX >= 50 && s.mapX <= 150 && s.mapY >= 50 && s.mapY <= 150;

test('the Border March matches GDD geography: 2 towns, 2 forts, 6 villages', () => {
  const list = Object.values(C.settlements).filter(inMarch);
  assert.equal(list.length, 10);
  const count = (type) => list.filter((s) => s.type === type).length;
  assert.equal(count('town'), 2);
  assert.equal(count('fort'), 2);
  assert.equal(count('village'), 6);
  for (const s of list) {
    assert.ok(C.factions[s.ownerFaction], `${s.id}: unknown owner ${s.ownerFaction}`);
    assert.notEqual(s.ownerFaction, 'neutral', `${s.id}: settlements belong to a kingdom, not the bandits`);
  }
});

test('settlement owners match GDD §3', () => {
  const expected = {
    stonebridge: 'valedorn', eastwatch: 'aurelian', greywall_fort: 'valedorn', ashgate_fort: 'aurelian',
    oakford: 'valedorn', highmere: 'valedorn', brackenfield: 'valedorn',
    dunmarsh: 'aurelian', redfield: 'aurelian', saltmere: 'aurelian',
  };
  for (const [id, owner] of Object.entries(expected)) {
    assert.equal(C.settlements[id]?.ownerFaction, owner, id);
  }
  assert.equal(C.settlements.stonebridge.explorable, true, 'Stonebridge is the explorable hub');
});

test('quest givers have dialogue', () => {
  for (const q of Object.values(C.quests)) {
    assert.ok(C.dialogue[q.giver], `${q.id}: no dialogue for giver ${q.giver}`);
    assert.ok(q.stages.length > 0, `${q.id}: no stages`);
  }
});

test('market lists the six GDD trade goods', () => {
  for (const id of ['grain', 'salt', 'wool', 'iron', 'cloth', 'tools']) {
    assert.ok(C.markets[id]?.basePrice > 0, `missing good ${id}`);
  }
});

test('quest items are flagged and worthless to sell', () => {
  for (const it of Object.values(C.items)) {
    if (it.type === 'quest') {
      assert.equal(it.questItem, true, it.id);
      assert.equal(it.value, 0, it.id);
    }
  }
});

test('battle map sprites point at existing tile images', () => {
  // Generated maps (V2-05) are built in code; tests/arena.test.js checks their sprites.
  for (const m of Object.values(C.battle_maps).filter((x) => !x.generate)) {
    const tiles = [...m.ground.tiles, ...m.decor.map((d) => d[0]), ...m.obstacles.filter((o) => o.look?.tile).map((o) => o.look.tile)];
    for (const tile of tiles) {
      assert.ok(fs.existsSync(path.join(ASSET_DIR, `${tile}.png`)), `${m.id}: missing assets/${tile}.png`);
    }
  }
});

test('the in-game ContentDB validator reports no problems', () => {
  const { loadGame } = require('./helpers/load');
  const { CL } = loadGame();
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('the ContentDB validator catches broken references', () => {
  const { loadGame } = require('./helpers/load');
  const { CL } = loadGame();
  const raw = CL.content.table('encounters').captains_trial;
  raw.waves[0].dragon = 2;
  CL.content.table('loot_tables').mid.table.push({ item: 'courier_packet', weight: 1 });
  CL.content.table('troops').levy.upgradeTo = 'nobody';
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /unknown troop dragon/);
  assert.match(errors, /loot_table mid: quest item courier_packet/);
  assert.match(errors, /levy: unknown upgrade nobody/);
});

test('camp recruits and starting enemies exist as troop definitions', () => {
  assert.equal(C.troops.levy.recruitCost, 15);
  assert.equal(C.troops.hunter.recruitCost, 25);
  assert.equal(C.troops.hunter.role, 'archer');
  assert.ok(C.encounters.captains_trial.waves.every((w) => Object.keys(w).every((id) => C.troops[id])));
});
