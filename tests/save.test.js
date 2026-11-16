const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const KEY = 'crownless_v03_party';

test('a fresh browser starts with the starter party', () => {
  const { CL } = loadGame();
  assert.deepEqual({ ...CL.campaign }, { ...CL.save.starter() });
  assert.equal(CL.campaign.gold, 130);
  assert.equal(CL.campaign.infantry, 3);
  assert.equal(CL.campaign.archer, 2);
});

test('a valid v1 save round-trips', () => {
  const { CL, storage } = loadGame();
  CL.campaign.gold = 77;
  CL.campaign.victories = 3;
  CL.save.write();
  const reloaded = loadGame({ storage }).CL.campaign;
  assert.equal(reloaded.gold, 77);
  assert.equal(reloaded.victories, 3);
});

test('corrupt JSON falls back to starter and logs a warning', () => {
  const { CL } = loadGame({ storage: memoryStorage({ [KEY]: '{not json' }) });
  assert.equal(CL.campaign.gold, 130);
  assert.ok(CL.diag.events.some((e) => e.level === 'warn' && e.msg === 'Cannot read save'));
});

test('unknown save versions are ignored', () => {
  const { CL } = loadGame({ storage: memoryStorage({ [KEY]: JSON.stringify({ version: 2, gold: 9999 }) }) });
  assert.equal(CL.campaign.gold, 130);
});

test('sanitize drops invalid fields, floors and clamps numbers', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({
    version: 1,
    gold: 12.9,
    infantry: -4,
    archer: 'lots',
    renown: Number.POSITIVE_INFINITY,
    victories: 1e9,
    extra: 5,
  });
  assert.equal(s.gold, 12);
  assert.equal(s.infantry, 3, 'negative ignored → default');
  assert.equal(s.archer, 2, 'non-number ignored → default');
  assert.equal(s.renown, 0, 'infinite ignored → default');
  assert.equal(s.victories, 99999, 'clamped to max');
  assert.equal('extra' in s, false, 'unknown keys dropped');
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
