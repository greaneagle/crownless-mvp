// P9-07: content packs in the world format (docs/WORLD-FORMAT.md). The sample pack adds a troop line and
// a settlement without code, and the game plays with it; a save begun with it is refused, untouched,
// where the pack is missing; every check rejects a bad pack with a precise message; and the official
// world written out in the format loads exactly as data/*.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, loadContent, memoryStorage } = require('./helpers/load');
const { exportWorld } = require('../scripts/export-world');

const ROOT = path.join(__dirname, '..');
const SAMPLE_TEXT = fs.readFileSync(path.join(ROOT, 'packs', 'sample', 'sample.json'), 'utf8');
const sample = () => JSON.parse(SAMPLE_TEXT);
const PLACE = 'sample:highcairn';

test('the sample pack: a troop line of three and a settlement, and the game plays with them', () => {
  const { CL } = loadGame({ packs: [sample()] });
  assert.deepEqual(Array.from(CL.content.validate()), []);
  assert.deepEqual(JSON.parse(JSON.stringify(CL.packs.forSave())), [{ id: 'sample', version: '1.0.0' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(CL.campaign.packs)), [{ id: 'sample', version: '1.0.0' }], 'a new save records its packs');
  // The line: Herder → Spear → Warden.
  const line = ['sample:cairn_herder', 'sample:cairn_spear', 'sample:cairn_warden'];
  assert.deepEqual(line.map((id) => CL.content.troop(id).upgradeTo), ['sample:cairn_spear', 'sample:cairn_warden', null]);
  // The place is on the map, held for its realm under its seat, and recruits its own troop.
  const s = CL.content.get('settlements', PLACE);
  assert.equal(CL.realm.owner(PLACE, CL.campaign), 'valedorn');
  assert.ok(CL.campaign.holdings[PLACE], 'it is a holding like any other');
  const c = CL.campaign;
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: PLACE });
  CL.game.mode = 'settlement';
  assert.ok(CL.party.recruitsHere().includes('sample:cairn_herder'));
  c.gold = 500;
  assert.ok(CL.party.recruit('sample:cairn_herder'));
  const herder = c.roster.find((e) => e.troop === 'sample:cairn_herder');
  assert.ok(herder, 'hired');
  herder.xp = 1000;
  assert.ok(CL.party.upgradeSoldier(c, herder.id, 'sample:cairn_spear'));
  assert.equal(c.roster.find((e) => e.id === herder.id).troop, 'sample:cairn_spear');
  // A save and reload keep it all; then a week passes in the world with the new place in it.
  CL.save.write();
  const again = CL.save.load();
  assert.ok(again.roster.some((e) => e.troop === 'sample:cairn_spear'));
  assert.deepEqual(JSON.parse(JSON.stringify(again.packs)), [{ id: 'sample', version: '1.0.0' }]);
  CL.party.advanceDays(7);
  assert.deepEqual(Array.from(CL.realm.invariants(CL.campaign)), []);
});

test('a save begun with the pack, opened without it: a precise error, and the save is untouched', () => {
  const storage = memoryStorage();
  const withPack = loadGame({ storage, packs: [sample()] });
  withPack.CL.campaign.gold = 777;
  withPack.CL.save.write();
  const KEY = withPack.CL.save.KEY;
  const text = storage.data[KEY];
  const backup = storage.data[withPack.CL.save.BACKUP_KEY];
  const without = loadGame({ storage });
  assert.match(without.CL.save.notice, /This save needs the pack sample \(version 1\.0\.0\)/);
  assert.notEqual(without.CL.campaign.gold, 777, 'a new game, not the save');
  assert.equal(storage.data[KEY], text, 'the save is as it was');
  assert.equal(storage.data[withPack.CL.save.BACKUP_KEY], backup);
  const r = without.CL.save.fromRaw(JSON.parse(text));
  assert.equal(r.campaign, null);
  assert.deepEqual(Array.from(r.problems), ['This save needs the pack sample (version 1.0.0)']);
  // A file of it is refused at import the same way, and nothing changes.
  const file = without.CL.portable.parse(withPack.CL.portable.serialize(withPack.CL.campaign));
  assert.equal(file.ok, false);
  assert.match(file.reason, /This save needs the pack sample \(version 1\.0\.0\)/);
  // With the pack back on, it opens (and nothing was dropped).
  const back = loadGame({ storage, packs: [sample()] });
  assert.equal(back.CL.campaign.gold, 777);
  // A save of the official world alone opens with or without the pack.
  const plain = loadGame();
  plain.CL.save.write();
  const plainText = plain.storage.data[plain.CL.save.KEY];
  assert.ok(loadGame({ packs: [sample()] }).CL.save.fromRaw(JSON.parse(plainText)).campaign);
});

test('every check rejects a bad pack with a precise message (which file, which entry, what is wrong)', () => {
  const { CL } = loadGame();
  const cases = [
    ['not JSON', '{ "manifest": ', /^bad\.json: not JSON/],
    ['too big', `{"x":"${'a'.repeat(2 * 1024 * 1024)}"}`, /over the 2 MB a pack may be/],
    ['no manifest', (p) => delete p.manifest, /bad\.json › manifest: missing/],
    ['bad pack id', (p) => (p.manifest.id = 'Sample Pack'), /manifest: id must be 1–40 of a–z/],
    ['the official id', (p) => (p.manifest.id = 'sundered_realm'), /id sundered_realm is the official world's/],
    ['no version', (p) => (p.manifest.version = 'one'), /manifest: version must look like 1\.0\.0/],
    ['bad engine range', (p) => (p.manifest.engine = 'soon'), /manifest: engine must be a version range/],
    ['engine too new', (p) => (p.manifest.engine = '>=9.0.0'), /needs the game at >=9\.0\.0; this is 3\.13\.0/],
    ['a missing required pack', (p) => (p.manifest.requires = ['other']), /requires the pack other, which is not loaded/],
    ['an unknown table', (p) => (p.dragons = {}), /bad\.json › dragons: not a table of the world format/],
    ['an id outside the namespace', (p) => (p.troops.cairn_x = { ...p.troops['sample:cairn_herder'], id: 'cairn_x' }), /troops › cairn_x: a new entry's id must be sample:<name>/],
    ['an id field that differs', (p) => (p.troops['sample:cairn_herder'].id = 'sample:other'), /troops › sample:cairn_herder: its id field must be "sample:cairn_herder"/],
    ['text where text belongs', (p) => (p.settlements[PLACE].name = 7), /settlements › sample:highcairn: name must be text/],
    ['code in a string', (p) => (p.settlements[PLACE].name = 'javascript:alert(1)'), /settlements\.sample:highcairn\.name: looks like code/],
    ['a script tag', (p) => (p.troops['sample:cairn_herder'].name = '<script>x</script>'), /looks like code/],
    ['a path out of the pack', (p) => (p.settlements[PLACE].icon = '../../etc/x.png'), /a path must stay inside the pack/],
    ['a link', (p) => (p.settlements[PLACE].icon = 'https://example.com/x.png'), /a path must stay inside the pack/],
    ['a prototype key', () => null, /the key "__proto__" is not allowed/, '{"manifest":{"__proto__":{"x":1}}}'],
    ['an unknown reference', (p) => (p.troops['sample:cairn_spear'].upgradeTo = 'sample:nobody'), /bad\.json › sample:cairn_spear: troop sample:cairn_spear: unknown upgrade sample:nobody/],
    ['an unknown faction', (p) => (p.troops['sample:cairn_herder'].faction = 'ghosts'), /troop sample:cairn_herder: unknown faction ghosts/],
    ['a place off the map', (p) => (p.settlements[PLACE].mapX = 400), /settlement sample:highcairn outside the map/],
    ['a bad seat', (p) => (p.settlements[PLACE].seat = 'oakford'), /seat oakford is not a fort or town of valedorn/],
    ['recruits that do not exist', (p) => (p.settlements[PLACE].recruits = ['sample:nobody']), /settlement sample:highcairn: recruits must be a list of known troops/],
    ['merge of nothing', (p) => (p.merge = { troops: { dragon: { hp: 9 } } }), /merge › troops › dragon: there is no troops entry dragon to change/],
    ['merge changes an id', (p) => (p.merge = { troops: { levy: { id: 'x' } } }), /merge › troops › levy: an entry's id cannot change/],
    ['merge with the wrong type', (p) => (p.merge = { troops: { levy: { hp: 'lots' } } }), /merge › troops › levy: hp must be a number, as it is now \(got text\)/],
    ['merge to a bad value', (p) => (p.merge = { troops: { levy: { hp: -5 } } }), /bad\.json › levy: troop levy: bad hp/],
  ];
  for (const [what, edit, want, text] of cases) {
    let body = text;
    if (!body) {
      if (typeof edit === 'string') body = edit;
      else {
        const p = sample();
        edit(p);
        body = JSON.stringify(p);
      }
    }
    const { pack, errors } = CL.packs.parse(body, { file: 'bad.json' });
    assert.equal(pack, null, `${what}: refused`);
    assert.ok(errors.some((e) => want.test(e)), `${what}: ${errors.join(' | ')}`);
  }
  // A good merge: an official entry by its short id or its namespaced one.
  for (const key of ['levy', 'sundered_realm:levy']) {
    const p = sample();
    p.merge = { troops: { [key]: { hp: 50 } } };
    assert.deepEqual(Array.from(CL.packs.parse(JSON.stringify(p)).errors), [], key);
  }
  assert.equal(CL.content.get('troops', 'sundered_realm:levy').id, 'levy', 'a namespaced official id reads as the short one');
  // Versions.
  assert.ok(CL.packs.satisfies('3.13.0', '>=3.13.0 <4.0.0'));
  assert.ok(CL.packs.satisfies('3.14.2', '^3.13.0'));
  assert.ok(!CL.packs.satisfies('4.0.0', '^3.13.0'));
  assert.ok(!CL.packs.satisfies('3.12.9', '>=3.13.0'));
});

test('a merge changes fields of existing entries and never deletes; nothing in a pack is run', () => {
  const p = sample();
  p.merge = { troops: { levy: { hp: 50, name: 'Shire Levy' } }, factions: { valedorn: { recruits: ['levy', 'hunter', 'sample:cairn_herder'] } } };
  const { CL } = loadGame({ packs: [p] });
  assert.equal(CL.content.troop('levy').hp, 50);
  assert.equal(CL.content.troop('levy').name, 'Shire Levy');
  assert.equal(CL.content.troop('levy').damage, 7, 'other fields are kept');
  assert.deepEqual(Array.from(CL.content.get('factions', 'valedorn').recruits), ['levy', 'hunter', 'sample:cairn_herder']);
  assert.deepEqual(Array.from(CL.content.validate()), []);
  // packs.js reads JSON only: no eval, no Function, no script tags, no imports.
  const src = fs.readFileSync(path.join(ROOT, 'js', 'packs.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /\beval\(|new Function|createElement\(['"]script|import\(|importScripts/);
});

test('the official world from the format equals data/*.js, table by table, and plays the same', () => {
  const data = loadContent();
  const world = JSON.parse(JSON.stringify(exportWorld()));
  assert.equal(world.manifest.id, 'sundered_realm');
  assert.equal(world.manifest.kind, 'world');
  const tables = Object.keys(world).filter((t) => t !== 'manifest');
  assert.deepEqual(tables.sort(), Object.keys(data).sort());
  for (const t of tables) assert.deepEqual(world[t], JSON.parse(JSON.stringify(data[t])), `table ${t}`);
  // Nothing in data/*.js is lost in JSON: no functions, no undefined, no NaN.
  const odd = [];
  const walk = (v, at) => {
    if (typeof v === 'function' || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) odd.push(at);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
  };
  walk(data, 'content');
  assert.deepEqual(odd, []);
  // A game on the world from JSON: the same content, valid, and the same first days.
  const a = loadGame({ seed: 7, worldParties: true });
  const b = loadGame({ seed: 7, worldParties: true, content: () => Object.fromEntries(tables.map((t) => [t, JSON.parse(JSON.stringify(world[t]))])) });
  assert.deepEqual(Array.from(b.CL.content.validate()), []);
  for (const t of tables) assert.deepEqual(JSON.parse(JSON.stringify(b.sandbox.CROWNLESS_CONTENT[t])), JSON.parse(JSON.stringify(a.sandbox.CROWNLESS_CONTENT[t])), `loaded table ${t}`);
  for (const g of [a, b]) g.CL.party.advanceDays(3);
  const view = (g) => JSON.stringify({ day: g.CL.campaign.day, parties: g.CL.campaign.parties, holdings: g.CL.campaign.holdings });
  assert.equal(view(b), view(a), 'three days play out the same');
});

test('ids: every id check and save key takes a colon', () => {
  const { CL } = loadGame({ packs: [sample()] });
  const c = CL.campaign;
  // A business budget, a quest tag and a story flag of a pack's namespace survive a save.
  c.accounts.budgets['sample:mill'] = 40;
  CL.save.write();
  const again = CL.save.load();
  assert.equal(again.accounts.budgets['sample:mill'], 40);
  assert.equal(CL.accounts.balance(again, 'budget:sample:mill'), 40);
});
