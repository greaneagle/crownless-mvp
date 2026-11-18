const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const KEY = 'crownless_save';
const BACKUP = 'crownless_save_backup';
const LEGACY = 'crownless_v03_party';

const troops = (c) => Array.from(c.roster, (s) => s.troop);

test('a new game follows GDD §5: 60 crowns, sword, clothing, shield, food, no soldiers', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  assert.equal(CL.save.existed, false);
  assert.equal(c.version, 9); // save schema v9 from 1.16.0 (V2-12)
  assert.equal(c.worldId, 'border_march');
  assert.equal(c.contentVersion, CL.BUILD);
  assert.equal(c.gold, 60);
  assert.equal(c.roster.length, 0);
  assert.equal(c.nextSoldierId, 1);
  assert.equal(c.day, 0);
  assert.equal(c.character, null, 'filled in by the creator');
  assert.equal(c.equipment.weapon, 'worn_sword');
  assert.equal(c.equipment.body, 'clothing');
  assert.equal(c.equipment.offhand, 'oak_shield');
  assert.deepEqual({ ...c.inventory }, {}, 'the food item became rations');
  assert.equal(c.food, 3, 'three days for a lone hero');
  assert.equal(c.morale, 70);
  assert.equal(c.nextWagesDay, 7);
});

test('old saves without equipment get the starting kit equipped; character stays null', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({ version: 2, gold: 300, roster: [{ id: 1, troop: 'levy' }] });
  assert.equal(s.gold, 300);
  assert.equal(s.equipment.weapon, 'worn_sword');
  assert.equal(s.equipment.offhand, 'oak_shield');
  assert.equal(s.character, null);
});

test('a v2 save round-trips, and each write keeps the previous save as backup', () => {
  const { CL, storage } = loadGame();
  CL.save.write();
  const first = storage.data[KEY];
  CL.campaign.gold = 77;
  CL.campaign.inventory.boots = 2;
  CL.campaign.roster[0].woundedUntil = 1.5;
  CL.save.write();
  assert.equal(storage.data[BACKUP], first);
  const reloaded = loadGame({ storage }).CL.campaign;
  assert.equal(reloaded.gold, 77);
  assert.equal(reloaded.inventory.boots, 2);
  assert.equal(reloaded.roster[0].woundedUntil, 1.5);
});

test('a corrupt main save falls back to the backup', () => {
  const { CL, storage } = loadGame();
  CL.campaign.gold = 444;
  CL.save.write();
  CL.save.write(); // backup now holds gold 444 as well
  storage.data[KEY] = '{broken';
  const { CL: CL2 } = loadGame({ storage });
  assert.equal(CL2.campaign.gold, 444);
  assert.ok(CL2.diag.events.some((e) => e.msg === 'Main save unreadable; restored backup'));
});

test('a 0.3 save migrates: infantry → levy, archers → hunter, wounded heal on day 3', () => {
  const v1 = { version: 1, gold: 210, infantry: 4, archer: 1, woundedInfantry: 1, woundedArcher: 2, battles: 5, victories: 3, renown: 12 };
  const { CL, storage } = loadGame({ storage: memoryStorage({ [LEGACY]: JSON.stringify(v1) }) });
  const c = CL.campaign;
  assert.equal(c.gold, 210);
  assert.equal(c.renown, 12);
  assert.equal(c.battles, 5);
  assert.equal(c.lastResolvedBattle, 5);
  assert.deepEqual(troops(c), ['levy', 'levy', 'levy', 'levy', 'hunter', 'levy', 'hunter', 'hunter']);
  assert.equal(c.roster.filter((s) => s.woundedUntil === 2).length, 3);
  assert.ok(CL.diag.events.some((e) => e.msg === 'Migrated 0.3 save'));
  CL.save.write();
  assert.equal(storage.data[LEGACY], JSON.stringify(v1), 'legacy save left untouched');
});

test('sanitize drops unknown troops, duplicate ids, unknown items and bad numbers', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({
    version: 2,
    gold: 12.9,
    renown: -3,
    day: 4.5,
    nextSoldierId: 2,
    roster: [
      { id: 7, troop: 'footman', xp: 30, woundedUntil: null },
      { id: 7, troop: 'levy' }, // duplicate id
      { id: 8, troop: 'dragon' }, // unknown troop
      { id: 9, troop: 'hero' }, // the hero is not a roster soldier
      { id: 'x', troop: 'levy' },
      { id: 10, troop: 'hunter', xp: -5, woundedUntil: 6 },
    ],
    inventory: { boots: 2, excalibur: 1, gloves: 0, clothing: 1.7 },
  });
  assert.equal(s.gold, 12);
  assert.equal(s.renown, 0);
  assert.equal(s.day, 4.5);
  assert.deepEqual(
    Array.from(s.roster, (e) => [e.id, e.troop, e.xp, e.woundedUntil]),
    [
      [7, 'footman', 30, null],
      [10, 'hunter', 0, 6],
    ],
  );
  assert.equal(s.nextSoldierId, 11, 'never reuses an existing soldier id');
  assert.deepEqual({ ...s.inventory }, { boots: 2, clothing: 1 });
});

test('unknown or future save versions are ignored', () => {
  const { CL } = loadGame({ storage: memoryStorage({ [KEY]: JSON.stringify({ version: 3, gold: 9999 }) }) });
  assert.equal(CL.campaign.gold, 130);
});

test('storage failures are logged, not thrown', () => {
  const throwing = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  const { CL } = loadGame({ storage: throwing });
  assert.equal(CL.campaign.gold, 130);
  assert.doesNotThrow(() => CL.save.write());
  assert.ok(CL.diag.events.some((e) => e.level === 'error' && e.msg === 'Save failed'));
});
