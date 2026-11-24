// Save export/import (GDD §13; Gate C step 10).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

/** A campaign with some of everything, exported. */
function exported() {
  const env = loadGame({ worldParties: true });
  const { CL } = env;
  const c = CL.campaign;
  c.food = 50;
  c.inventory.boots = 2;
  c.cargo = { salt: 4 };
  CL.contracts.accept(c, 'stonebridge');
  CL.party.advanceDays(1.3);
  return { ...env, c, text: CL.portable.serialize(c) };
}

test('export → import on a fresh device reproduces the campaign exactly', () => {
  const { CL, c, text } = exported();
  const other = loadGame({ storage: memoryStorage() }); // a different browser
  const r = other.CL.portable.importText(text);
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(other.CL.campaign), JSON.stringify(CL.save.sanitize(JSON.parse(JSON.stringify(c)))));
  assert.equal(other.CL.save.existed, true);
  assert.ok(other.storage.data.crownless_save, 'written to the new browser');
});

test('the file has an envelope with format, version, game build, time and checksum', () => {
  const { CL, text } = exported();
  const f = JSON.parse(text);
  assert.equal(f.format, 'crownless-save');
  assert.equal(f.version, CL.save.VERSION); // the current save schema (v4 from 1.3.0)
  assert.equal(f.game, CL.BUILD);
  assert.ok(!Number.isNaN(Date.parse(f.exportedAt)));
  assert.equal(f.checksum, CL.portable.checksum(JSON.stringify(f.campaign)));
});

test('rejected: not JSON, empty, too large, wrong shape', () => {
  const { CL } = loadGame();
  for (const bad of ['', '   ', '{oops', 'null', '42', '"hi"', JSON.stringify({ hello: 1 }), 'x'.repeat(2_000_001)]) {
    const r = CL.portable.parse(bad);
    assert.equal(r.ok, false, bad.slice(0, 20));
    assert.ok(r.reason);
  }
});

test('rejected: a damaged or edited file (checksum)', () => {
  const { CL, text } = exported();
  const f = JSON.parse(text);
  f.campaign.gold = 99999;
  const r = CL.portable.parse(JSON.stringify(f));
  assert.equal(r.ok, false);
  assert.match(r.reason, /damaged or has been edited/);
});

test('rejected: a save from a newer version of the game', () => {
  const { CL, text } = exported();
  const f = JSON.parse(text);
  f.version = CL.save.VERSION + 1;
  f.game = '2.0.0';
  assert.match(CL.portable.parse(JSON.stringify(f)).reason, /newer version of Crownless \(2\.0\.0\)/);
  assert.match(CL.portable.parse(JSON.stringify({ version: 99, gold: 1 })).reason, /newer version/);
});

test('rejected: unknown IDs, listed — and the current save is untouched', () => {
  const { CL, storage, text } = exported();
  const before = storage.data.crownless_save;
  const f = JSON.parse(text);
  f.campaign.roster.push({ id: 999, troop: 'dragon', xp: 0, woundedUntil: null });
  f.campaign.inventory.excalibur = 1;
  f.campaign.equipment.weapon = 'boots';
  f.campaign.world.location = 'atlantis';
  f.campaign.character.background = 'wizard';
  f.campaign.cargo.spice = 3;
  f.checksum = CL.portable.checksum(JSON.stringify(f.campaign));
  const r = CL.portable.importText(JSON.stringify(f));
  assert.equal(r.ok, false);
  const all = r.problems.join(' | ');
  for (const bit of ['troop "dragon"', 'item "excalibur"', '"boots" cannot be worn as weapon', 'settlement "atlantis"', 'background "wizard"', 'trade good "spice"']) {
    assert.ok(all.includes(bit), bit);
  }
  assert.equal(storage.data.crownless_save, before, 'nothing written');
  assert.equal('crownless_save_pre_import' in storage.data, false);
});

test('a raw save object (no envelope) is accepted; an old 0.3 save is refused (P10-02: no old saves)', () => {
  const { CL, c } = exported();
  const raw = CL.portable.parse(JSON.stringify(c));
  assert.equal(raw.ok, true);
  const old = CL.portable.parse(JSON.stringify({ version: 1, gold: 70, infantry: 2, archer: 1 }));
  assert.equal(old.ok, false);
});

test('importing sets the current save aside; it can be restored once', () => {
  const env = loadGame();
  const { CL, storage } = env;
  CL.campaign.gold = 777;
  CL.save.write();
  const { text } = exported();
  assert.equal(CL.portable.importText(text).ok, true);
  assert.notEqual(CL.campaign.gold, 777);
  assert.equal(CL.portable.hasPreImport(), true);
  assert.equal(CL.portable.restorePreImport().ok, true);
  assert.equal(CL.campaign.gold, 777);
  assert.equal(JSON.parse(storage.data.crownless_save).gold, 777);
  assert.equal(CL.portable.hasPreImport(), false);
  assert.equal(CL.portable.restorePreImport().ok, false);
});

test('import clears per-session state from the old campaign', () => {
  const { CL } = loadGame();
  Object.assign(CL.game, { travel: { x: 1, y: 1 }, partyId: 4, waiting: true, godMode: true });
  CL.portable.importText(exported().text);
  assert.deepEqual([CL.game.travel, CL.game.partyId, CL.game.waiting, CL.game.godMode], [null, null, false, false]);
});

test('download names are safe and descriptive', () => {
  const { CL } = loadGame();
  CL.campaign.character.name = 'Edda <of> the March!!';
  CL.campaign.day = 11.2;
  assert.equal(CL.portable.fileName(CL.campaign, new Date('2026-11-16T10:00:00Z')), 'crownless-edda-of-the-march-day12-2026-11-16.json');
  CL.campaign.character = null;
  assert.match(CL.portable.fileName(), /^crownless-wanderer-day12-\d{4}-\d{2}-\d{2}\.json$/);
});

test('when the browser refuses a save, the player is told to export', () => {
  const quota = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const { CL, uiCalls } = loadGame({ storage: quota });
  assert.equal(CL.save.write(), false);
  assert.match(CL.save.lastError, /Quota/);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Save & export/.test(x[1])));
});
