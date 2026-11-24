// P10-02 (D-P10g, owner 2026-11-24: "ignore old saves"): the world changed shape in 4.2.0 (the coast
// joined it, edition 2). Saves begun before are never migrated: on boot each is refused, kept safe
// untouched, and a new campaign begins; on import it is refused by name. One check over the real
// saves of every old build in tests/fixtures, from 0.14 to 2.30.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');

const FIX = path.join(__dirname, 'fixtures');
const saves = [];
// saves-4.2 is this build's own (test data for the browser cases), not an old save.
for (const dir of fs.readdirSync(FIX).filter((d) => d.startsWith('saves-') && d !== 'saves-4.2' && fs.existsSync(path.join(FIX, d, 'index.json')))) {
  for (const f of JSON.parse(fs.readFileSync(path.join(FIX, dir, 'index.json'), 'utf8'))) saves.push({ dir, file: f.file, text: fs.readFileSync(path.join(FIX, dir, f.file), 'utf8') });
}

test('every old build left saves here to check', () => {
  assert.ok(saves.length >= 30, `${saves.length} saves`);
  assert.ok(saves.some((s) => s.dir === 'saves-2.30'));
});

test('a save from before 4.2.0 is refused on import, by name', () => {
  for (const s of saves) {
    const { CL } = loadGame({ party: false });
    const r = CL.portable.importText(s.text);
    assert.equal(r.ok, false, `${s.dir}/${s.file}`);
    assert.match(r.reason, /world this version no longer has|newer version|not a Crownless save/, `${s.dir}/${s.file}: ${r.reason}`);
  }
});

test('a save from before 4.2.0 left in the browser is kept safe untouched, and a new campaign begins', () => {
  for (const s of saves.filter((x) => x.dir >= 'saves-2.')) {
    const data = JSON.parse(s.text);
    const old = JSON.stringify(data.campaign || data);
    const storage = memoryStorage({ crownless_save: old });
    const { CL } = loadGame({ storage, party: false });
    assert.equal(CL.save.existed, false, `${s.dir}/${s.file}: nothing to continue`);
    assert.equal(CL.campaign.day, 0, 'a new campaign');
    assert.equal(CL.campaign.worldEdition, CL.world.map().edition);
    assert.equal(storage.data[CL.save.OTHER_WORLD_KEY], old, `${s.dir}/${s.file}: kept exactly as it was`);
    assert.match(CL.save.notice, /^The world has grown/);
  }
});

test('a save of this edition loads as it was', () => {
  const { CL, storage } = loadGame();
  CL.party.advanceDays(1);
  CL.save.write();
  const back = loadGame({ storage });
  assert.equal(back.CL.save.existed, true);
  assert.equal(back.CL.campaign.worldEdition, 2);
  assert.ok(Math.abs(back.CL.campaign.day - CL.campaign.day) < 1e-9);
});
