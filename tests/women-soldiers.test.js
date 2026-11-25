// P10-09 (D-P10d): women soldiers, in two realms and one band, mixed into the normal recruits at 15%;
// their own progression and names; and soldiers' portraits, chosen once and kept.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (x) => JSON.parse(JSON.stringify(x));

/** A company in Hrothgard (Hrothmark's town), rich enough to hire many. */
function inHrothgard(opts = {}) {
  const env = loadGame({ party: false, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  const s = CL.content.get('settlements', 'hrothgard');
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: s.id });
  c.character = CL.character.create({ name: 'Tester', origin: 'farmhand' });
  c.gold = 1e6;
  return { ...env, c };
}

/** Hire `n` clansmen (one at a time, dismissing to keep room); the troops that answered. */
function hireMany(CL, c, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    assert.ok(CL.party.recruit('clansman', { write: false }), 'hired');
    out.push(c.roster.at(-1).troop);
    c.roster.length = 0;
  }
  return out;
}

test('women soldiers: in two realms’ lines and one band, by data; nowhere else', () => {
  const { CL } = loadGame({ party: false });
  const T = Object.values(CL.content.table('troops'));
  const women = T.filter((t) => t.gender === 'female');
  assert.deepEqual(plain([...new Set(women.map((t) => t.faction))].sort()), ['hrothmark', 'neutral', 'vessaro']);
  const lines = T.filter((t) => t.women);
  assert.deepEqual(plain(lines.map((t) => [t.id, t.women.troop, t.women.share])), [['clansman', 'shieldmaiden', 0.15], ['militia', 'popolana', 0.15]]);
  const band = CL.content.get('party_templates', 'western_outlaws');
  assert.ok(band.troops.outlaw_huntress, 'the western outlaws ride with huntresses');
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('about 15 in 100 hires answer as a woman of the line; the same seed gives the same recruits', () => {
  const a = inHrothgard({ seed: 4242 });
  const got = hireMany(a.CL, a.c, 1000);
  const share = got.filter((t) => t === 'shieldmaiden').length / got.length;
  assert.ok(share > 0.12 && share < 0.18, `share ${share}`);
  assert.ok(got.every((t) => t === 'clansman' || t === 'shieldmaiden'));
  // The same seed: the same answers, hire for hire.
  const b = inHrothgard({ seed: 4242 });
  assert.deepEqual(hireMany(b.CL, b.c, 200), got.slice(0, 200));
  // A troop without a women's line always answers as itself.
  const v = loadGame({ party: false });
  assert.equal(new Set(Array.from({ length: 200 }, () => v.CL.soldiers.answers(v.CL.campaign, 'levy'))).size, 1);
});

test('a woman soldier has a woman’s name from her culture, and upgrades in her own line', () => {
  const { CL, c } = inHrothgard();
  const s = CL.save.addSoldier(c, 'shieldmaiden');
  const K = CL.content.table('cultures')[s.culture];
  assert.ok(K.givenFemale.includes(s.name.split(' ')[0]), s.name);
  assert.deepEqual(plain(CL.party.upgradeOptions('shieldmaiden').map((o) => o.to)), ['shield_sister']);
  assert.deepEqual(plain(CL.party.upgradeOptions('shield_sister').map((o) => o.to)), ['hearth_maiden']);
  assert.deepEqual(plain(CL.party.upgradeOptions('popolana').map((o) => o.to)), ['balestriera']);
  s.xp = 1000;
  assert.ok(CL.party.upgradeSoldier(c, s.id, 'shield_sister'));
  assert.equal(c.roster.find((x) => x.id === s.id).troop, 'shield_sister');
  // The checks hold every woman's line to itself.
  const T = CL.content.table('troops');
  T.shield_sister.upgradeTo = 'huscarl';
  assert.match(Array.from(CL.content.validate()).join('\n'), /shield_sister: a woman's line upgrades into her own line, not huscarl/);
});

test('portraits: a face of each soldier’s own, men’s and women’s, chosen once and the same after a save and load', () => {
  const storage = memoryStorage();
  const { CL, c } = inHrothgard({ storage });
  const man = CL.save.addSoldier(c, 'clansman');
  const woman = CL.save.addSoldier(c, 'shieldmaiden');
  assert.match(man.portrait, /^m-\d-\d-\d-\d$/);
  assert.match(woman.portrait, /^f-\d-\d-\d-\d$/);
  assert.equal(CL.soldiers.portraitFor(man), man.portrait, 'from the id, every time');
  const faces = new Set(Array.from({ length: 60 }, (_, i) => CL.soldiers.portraitFor({ id: i + 1, troop: 'levy' })));
  assert.ok(faces.size >= 30, `a few generic faces, not one: ${faces.size}`);
  CL.save.write();
  const back = CL.save.load();
  assert.deepEqual(plain(back.roster.map((s) => [s.id, s.portrait])), plain(c.roster.map((s) => [s.id, s.portrait])));
});

test('a pack’s troop may say gender: female, and its line follows the same rules', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'sample', 'sample.json'), 'utf8'));
  for (const id of ['sample:cairn_herder', 'sample:cairn_spear', 'sample:cairn_warden']) sample.troops[id].gender = 'female';
  const { CL } = loadGame({ party: false, packs: [sample] });
  assert.equal(CL.content.get('troops', 'sample:cairn_herder').gender, 'female');
  const c = CL.campaign;
  const s = CL.save.addSoldier(c, 'sample:cairn_herder');
  assert.match(s.portrait, /^f-/);
  assert.ok(CL.content.table('cultures')[s.culture].givenFemale.includes(s.name.split(' ')[0]));
  // A pack whose woman's line turns into a man's is refused with the game's own words.
  const bad = JSON.parse(JSON.stringify(sample));
  delete bad.troops['sample:cairn_spear'].gender;
  assert.throws(() => loadGame({ party: false, packs: [bad] }), /a woman's line upgrades into her own line/);
});
