// Save schema v3 and migrations (V2-01; design §24.7, SC-30–32; docs/SAVE-FORMAT.md).
// Partial or damaged saves are rejected instead of being filled in, and nothing reports success until
// it is really stored. (P10-02: saves of real old builds are refused, not migrated: tests/old-saves.test.js.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame: loadAny, memoryStorage } = require('./helpers/load');
const { oldMarch } = require('./helpers/old-march');
// Saves from before W-05b belong to the Border March as it was; the real build refuses them
// (tests/world-grown.test.js). Their migrations are proved on the March as it was.
const loadGame = (o = {}) => loadAny({ content: oldMarch, ...o });

const KEY = 'crownless_save';
const BACKUP = 'crownless_save_backup';


test('migrations are pure steps, one schema version at a time', () => {
  const { CL } = loadGame();
  const v2 = { ...JSON.parse(JSON.stringify(CL.campaign)), version: 2 };
  delete v2.worldId;
  delete v2.contentVersion;
  for (const k of ['rng', 'nextResultId', 'nextEventId']) delete v2[k];
  const frozen = JSON.stringify(v2);
  // 2 → 3 (1.2.0): the world and the writing build.
  const v3 = CL.save.MIGRATIONS[2](v2);
  assert.equal(JSON.stringify(v2), frozen, 'the input is not changed');
  assert.equal(v3.version, 3);
  assert.equal(v3.worldId, 'border_march');
  assert.equal(v3.contentVersion, 'unknown', 'which build wrote a v2 save was never recorded');
  // 3 → 4 (1.3.0): named random streams from the world seed, and fresh result and event counters.
  const v3text = JSON.stringify(v3);
  const v4 = CL.save.MIGRATIONS[3](v3);
  assert.equal(JSON.stringify(v3), v3text, 'the input is not changed');
  assert.equal(v4.version, 4);
  assert.deepEqual({ ...v4.rng }, { ...CL.autoresolve.streamSeeds(v2.rngSeed) }, 'same seed, same streams');
  assert.equal(v4.nextResultId, 1);
  assert.equal(v4.nextEventId, 1);
  // All steps in a row.
  const all = CL.save.migrate(v2);
  assert.equal(all.version, CL.save.VERSION);
  assert.equal(CL.save.migrate(all), all, 'a current save needs no steps');
  for (let v = 2; v < CL.save.VERSION; v++) assert.equal(typeof CL.save.MIGRATIONS[v], 'function', `step from v${v}`);
});

// ---- SC-31: partial or damaged saves are rejected, never filled in ----

test('import rejects a partial save, says what is missing, and leaves the current game alone', () => {
  const { CL, storage } = loadGame();
  CL.save.write();
  const before = storage.data[KEY];
  for (const partial of [{ version: 2 }, { version: 2, gold: 10, roster: [] }, { version: 3, gold: 1 }]) {
    const r = CL.portable.importText(JSON.stringify(partial));
    assert.equal(r.ok, false);
    assert.match(r.reason, /incomplete or damaged/);
    assert.ok(r.problems.some((p) => /missing/.test(p)), r.problems.join('; '));
  }
  // A whole v3 save with one part gone, or of the wrong kind.
  const full = JSON.parse(JSON.stringify(CL.campaign));
  delete full.news;
  assert.ok(CL.portable.parse(JSON.stringify(full)).problems.includes('"news" is missing'));
  const wrong = { ...JSON.parse(JSON.stringify(CL.campaign)), roster: 'everyone' };
  assert.ok(CL.portable.parse(JSON.stringify(wrong)).problems.includes('"roster" is not a valid array'));
  assert.equal(storage.data[KEY], before);
  assert.equal(storage.data.crownless_save_pre_import, undefined);
});

test('a save from another world, or a newer save schema, is refused by name', () => {
  const { CL } = loadGame();
  const other = { ...JSON.parse(JSON.stringify(CL.campaign)), worldId: 'far_isles' };
  const r = CL.portable.parse(JSON.stringify(other));
  assert.equal(r.ok, false);
  assert.match(r.reason, /world this version no longer has/);
  assert.match(r.problems[0], /far_isles/);
  assert.match(CL.portable.parse(JSON.stringify({ ...CL.campaign, version: CL.save.VERSION + 1 })).reason, /newer version/);
});

test('a partial save in the browser is not loaded: the backup is, with a notice', () => {
  const first = loadGame();
  first.CL.campaign.gold = 321;
  first.CL.save.write();
  first.CL.save.write();
  first.storage.data[KEY] = '{"version":2}';
  const { CL } = loadGame({ storage: first.storage });
  assert.equal(CL.campaign.gold, 321);
  assert.match(CL.save.notice, /could not be read/);
  assert.ok(CL.diag.events.some((e) => e.msg === 'Save rejected'));
});

// ---- Last known good, and writes that must really land (SC-32) ----

test('the backup only ever holds a complete save', () => {
  const { CL, storage } = loadGame();
  CL.campaign.gold = 111;
  CL.save.write();
  CL.save.write(); // backup: gold 111
  storage.data[KEY] = '{"version":2}'; // the main save is damaged behind the game's back
  CL.campaign.gold = 222;
  assert.equal(CL.save.write(), true);
  assert.equal(JSON.parse(storage.data[BACKUP]).gold, 111, 'the damaged save did not replace the good backup');
  assert.equal(JSON.parse(storage.data[KEY]).gold, 222);
});

/** Storage that stops accepting writes when told to. `silent` drops them without an error. */
function flakyStorage() {
  const s = memoryStorage();
  const ok = s.setItem;
  s.mode = 'ok';
  s.setItem = (k, v) => {
    if (s.mode === 'full') throw new Error('QuotaExceededError');
    if (s.mode === 'silent') return;
    ok(k, v);
  };
  return s;
}

test('a write only counts once it reads back: a full or silently failing store reports failure', () => {
  const storage = flakyStorage();
  const { CL, uiCalls } = loadGame({ storage });
  assert.equal(CL.save.write(), true);
  for (const mode of ['full', 'silent']) {
    storage.mode = mode;
    CL.campaign.gold += 1;
    assert.equal(CL.save.write(), false, mode);
    assert.ok(CL.save.lastError);
  }
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /Could not save/.test(x[1])));
  storage.mode = 'ok';
  assert.equal(CL.save.write(), true);
  assert.equal(CL.save.lastError, null);
});

test('an import that cannot be stored reports failure and changes nothing (SC-32)', () => {
  const storage = flakyStorage();
  const { CL } = loadGame({ storage });
  CL.campaign.gold = 500;
  CL.save.write();
  storage.data.crownless_save_pre_import = 'an earlier copy';
  const incoming = loadGame();
  incoming.CL.campaign.gold = 9;
  const file = incoming.CL.portable.serialize();
  const before = { ...storage.data };
  const game = CL.campaign;
  storage.mode = 'silent'; // the pre-import copy "succeeds" too, but nothing lands
  const r = CL.portable.importText(file);
  assert.equal(r.ok, false);
  assert.match(r.reason, /could not be saved/);
  assert.equal(CL.campaign, game, 'still playing the same game');
  assert.equal(CL.campaign.gold, 500);
  assert.deepEqual(storage.data, before, 'storage exactly as it was, earlier pre-import copy included');
  storage.mode = 'full';
  assert.equal(CL.portable.importText(file).ok, false);
  assert.deepEqual(storage.data, before);
});

test('restoring the pre-import save keeps its copy until the restore is stored', () => {
  const storage = flakyStorage();
  const { CL } = loadGame({ storage });
  CL.campaign.gold = 700;
  CL.save.write();
  const incoming = loadGame();
  incoming.CL.campaign.gold = 5;
  assert.equal(CL.portable.importText(incoming.CL.portable.serialize()).ok, true);
  assert.equal(CL.campaign.gold, 5);
  storage.mode = 'full';
  const r = CL.portable.restorePreImport();
  assert.equal(r.ok, false);
  assert.equal(CL.campaign.gold, 5);
  assert.ok(storage.data.crownless_save_pre_import, 'the copy is still there to try again');
  storage.mode = 'ok';
  assert.equal(CL.portable.restorePreImport().ok, true);
  assert.equal(CL.campaign.gold, 700);
  assert.equal(storage.data.crownless_save_pre_import, undefined);
});

// ---- Autosave while travelling ----

test('time passing on the map saves once per game day, not every frame', () => {
  const { CL } = loadGame();
  const saves = () => CL.diag.events.filter((e) => e.msg === 'Campaign saved').length;
  CL.save.write();
  const start = saves();
  CL.game.mode = 'map';
  CL.game.waiting = true;
  for (let i = 0; i < 55; i++) CL.world.update(0.1); // 0.1 s of play = 0.4 game hours; 22 hours
  assert.equal(saves(), start, 'less than a day: no save yet');
  for (let i = 0; i < 10; i++) CL.world.update(0.1); // past one day
  assert.equal(saves(), start + 1);
  for (let i = 0; i < 65; i++) CL.world.update(0.1); // another day
  assert.equal(saves(), start + 2);
});

test('the autosave waits for a hero: nothing is saved before character creation', () => {
  const { CL } = loadGame({ party: false });
  CL.campaign.day = 5;
  assert.equal(CL.save.autosave(), false);
});

// ---- The storage layer ----

test('saves go through the storage layer, so another backend can take over', () => {
  const { CL, storage } = loadGame();
  const kept = {};
  CL.storage.use({ name: 'test-files', get: (k) => kept[k] ?? null, set: (k, v) => (kept[k] = v), remove: (k) => delete kept[k] });
  assert.equal(CL.storage.backendName(), 'test-files');
  CL.campaign.gold = 42;
  assert.equal(CL.save.write(), true);
  assert.equal(JSON.parse(kept[KEY]).gold, 42);
  assert.equal(storage.data[KEY], undefined, 'localStorage untouched');
  assert.equal(CL.save.load().gold, 42);
  CL.storage.use();
  assert.equal(CL.storage.backendName(), 'localStorage');
});

test('the storage layer never throws: failed reads give null, failed writes give false', () => {
  const { CL } = loadGame();
  const boom = () => {
    throw new Error('SecurityError');
  };
  CL.storage.use({ name: 'blocked', get: boom, set: boom, remove: boom });
  assert.equal(CL.storage.get(KEY), null);
  assert.equal(CL.storage.set(KEY, 'x'), false);
  assert.equal(CL.storage.remove(KEY), false);
  assert.match(CL.storage.lastError, /SecurityError/);
  CL.storage.use();
});
