// Named soldiers and service records (V2-03; design §10, SC-01–03, Prototype C "Edric's Career").
// Every soldier is a person with a name from their culture, an origin, a joining day, a record kept by
// listening to events, and bounded notes; and they survive saves, exports, imports and migrations.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');
const { preHoldings } = require('./helpers/pre-holdings');

/** Game values come from the test sandbox's realm; compare them as plain JSON. */
const plain = (x) => JSON.parse(JSON.stringify(x));

/** A campaign with no soldiers, standing in a settlement with money to hire. */
function at(place, opts = {}) {
  const env = loadGame(opts);
  const c = env.CL.campaign;
  c.roster = [];
  c.gold = 5000;
  c.world.location = place;
  return { ...env, c };
}

const hire = (CL, troop) => {
  assert.ok(CL.party.recruit(troop), `hire ${troop}`);
  return CL.campaign.roster.at(-1);
};

// ---- Names ----

test('a recruit is named from where they joined: Valedorn, Aurelian, or border folk for sell-swords', () => {
  const { CL } = at('stonebridge');
  const K = CL.content.table('cultures');
  const levy = hire(CL, 'levy');
  assert.equal(levy.culture, 'valedorn');
  assert.equal(levy.origin, 'stonebridge');
  assert.ok(K.valedorn.given.includes(levy.name.split(' ')[0]), levy.name);
  const merc = hire(CL, 'mercenary');
  assert.equal(merc.culture, 'border', 'Mercenaries are border folk wherever they are hired');
  CL.campaign.world.location = 'eastwatch';
  CL.campaign.reputation.aurelian = 0;
  const recruit = hire(CL, 'recruit');
  assert.equal(recruit.culture, 'aurelian');
  assert.ok(K.aurelian.given.includes(recruit.name.split(' ')[0]), recruit.name);
  assert.equal(recruit.joined, CL.campaign.day);
  assert.deepEqual(plain(recruit.record), { battles: 0, victories: 0, kills: 0, assists: 0, wounds: 0, captures: 0, wagesPaid: 0 });
  assert.deepEqual(plain(recruit.notes), [{ day: CL.campaign.day, kind: 'joined', place: 'eastwatch' }]);
  assert.equal(recruit.portrait, null, 'a portrait slot, empty until there is art');
});

test('a fort recruits under its owner: when Greywall changes hands, so do the names', () => {
  const { CL } = at('greywall_fort');
  assert.equal(hire(CL, 'levy').culture, 'valedorn');
  CL.realm.setOwner(CL.campaign, 'greywall_fort', 'aurelian', 'test');
  CL.campaign.reputation.aurelian = 0;
  const r = hire(CL, 'recruit');
  assert.equal(r.culture, 'aurelian');
  assert.doesNotMatch(r.name, /Greywall Fort/, 'bynames use the short place name ("of Greywall")');
});

test('names are seeded: the same save names the same soldiers, and nobody in the roster shares a name', () => {
  const base = at('stonebridge');
  base.CL.save.write();
  const runs = [0, 1].map(() => {
    const { CL } = loadGame({ storage: memoryStorage({ ...base.storage.data }) });
    CL.campaign.world.location = 'stonebridge';
    for (let i = 0; i < 8; i++) hire(CL, i % 2 ? 'hunter' : 'levy'); // a full company at the starting cap
    return CL.campaign.roster.map((s) => s.name);
  });
  assert.deepEqual(plain(runs[0]), plain(runs[1]));
  assert.equal(new Set(runs[0]).size, runs[0].length, runs[0].join(', '));
});

test('a soldier who joins on the open road gets no "of nowhere" byname', () => {
  const { CL, c } = at(null);
  for (let i = 0; i < 40; i++) {
    const s = CL.save.addSoldier(c, 'levy');
    assert.equal(s.origin, null);
    assert.doesNotMatch(s.name, / of /);
    c.roster = [];
  }
});

test('the generator gives up on duplicates after a few tries and adds a numeral', () => {
  const { CL } = loadGame();
  const taken = new Set(['Tam']);
  const name = CL.soldiers.makeName('border', null, () => 0.99, new Set());
  taken.add(name);
  assert.equal(CL.soldiers.makeName('border', null, () => 0.99, taken), `${name} II`);
  taken.add(`${name} II`);
  assert.equal(CL.soldiers.makeName('border', null, () => 0.99, taken), `${name} III`);
});

test('content checks: cultures need names and valid forms, and everyone points at a real culture', () => {
  const { CL, sandbox } = loadGame();
  assert.deepEqual(Array.from(CL.content.validate()), []);
  const C = sandbox.CROWNLESS_CONTENT;
  C.factions.valedorn.culture = 'elvish';
  C.cultures.border.forms.push({ pattern: '{given} son of {father}', weight: 1 });
  C.cultures.aurelian.given = [];
  C.troops.levy.culture = 'nowhere';
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /factions valedorn: unknown culture elvish/);
  assert.match(errors, /culture border: .*unknown part \{father\}/);
  assert.match(errors, /culture aurelian: needs a list of given names/);
  assert.match(errors, /troops levy: unknown culture nowhere/);
});

// ---- Records, from events ----

test('a fought battle adds to the record: battles, victories, kills, assists; a big day earns a note', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  CL.combat.startBattle('captains_trial');
  const [a, b] = CL.game.allies.filter((u) => u.soldierId != null);
  const enemy = CL.game.enemies[0];
  CL.combat.hit(enemy, 5, a); // a wounds it…
  CL.combat.hit(enemy, 999, b); // …b finishes it
  assert.equal(a.assists, 1);
  assert.equal(b.kills, 1);
  b.kills = 3; // and two more besides
  CL.party.endBattle(true);
  const A = c.roster.find((s) => s.id === a.soldierId);
  const B = c.roster.find((s) => s.id === b.soldierId);
  assert.deepEqual([A.record.battles, A.record.victories, A.record.kills, A.record.assists], [1, 1, 0, 1]);
  assert.deepEqual([B.record.battles, B.record.victories, B.record.kills], [1, 1, 3]);
  assert.equal(B.notes.at(-1).kind, 'notable');
  assert.match(CL.soldiers.noteText(B.notes.at(-1)), /Felled 3 enemies fighting The Captain's Trial/);
});

test('wounds are counted and noted; a defeat is a capture for the whole company', () => {
  const { CL } = loadGame({ random: () => 0.5 }); // 0.5: every fallen soldier is wounded, not killed
  const c = CL.campaign;
  CL.combat.startBattle('captains_trial');
  const deployed = CL.game.allies.filter((u) => u.soldierId != null);
  deployed[0].alive = false;
  CL.party.endBattle(false);
  const hurt = c.roster.find((s) => s.id === deployed[0].soldierId);
  assert.equal(hurt.record.wounds, 1);
  assert.ok(hurt.notes.some((n) => n.kind === 'wounded' && n.foe === "The Captain's Trial"));
  for (const s of c.roster) {
    assert.equal(s.record.captures, 1, s.name);
    assert.equal(s.notes.at(-1).kind === 'captured' || s.notes.at(-2).kind === 'captured', true);
  }
});

test('auto-resolve counts battles and victories, never invented kills', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 1 }, tx: null, ty: null });
  CL.parties.open(p.id);
  for (const s of c.roster) s.xp = 0;
  const r = CL.parties.autoResolve();
  for (const s of c.roster) {
    assert.equal(s.record.battles, 1);
    assert.equal(s.record.victories, r.win ? 1 : 0);
    assert.equal(s.record.kills, 0);
  }
});

test('SC-02: the record counts wages actually paid, to the crown, even when pay runs short', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const owed = CL.upkeep.weeklyWages(c);
  c.gold = 1000;
  CL.upkeep.payWages(c);
  for (const s of c.roster) assert.equal(s.record.wagesPaid, CL.content.troop(s.troop).wage);
  c.gold = 7; // short: 7 of the week's wages
  CL.upkeep.payWages(c);
  const total = c.roster.reduce((n, s) => n + s.record.wagesPaid, 0);
  assert.equal(total, owed + 7, 'shares add up to exactly what was paid');
  const shares = CL.soldiers.wageShares(c, 7);
  assert.equal(Object.values(shares).reduce((a, b) => a + b, 0), 7);
});

test('notes are bounded: the joining note stays, the oldest of the rest go', () => {
  const { CL } = loadGame();
  const s = CL.campaign.roster[0];
  for (let i = 0; i < 20; i++) CL.soldiers.note(s, { day: i, kind: 'wounded', foe: `Foe ${i}` });
  assert.equal(s.notes.length, CL.soldiers.NOTES_MAX);
  assert.equal(s.notes[0].kind, 'joined');
  assert.equal(s.notes.at(-1).foe, 'Foe 19');
  assert.equal(s.notes[1].foe, `Foe ${20 - CL.soldiers.NOTES_MAX + 1}`);
});

// ---- The profile card's actions ----

test('per-soldier upgrade: says why not (wounded, XP, crowns), and charges once when it can', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const s = c.roster.find((x) => x.troop === 'levy');
  const why = () => CL.party.soldierUpgrades(s, c).map((o) => o.why);
  s.xp = 10;
  assert.match(why()[0], /Needs 40 XP \(has 10\)/);
  s.xp = 40;
  s.woundedUntil = 2;
  assert.match(why()[0], /Wounded until day 3/);
  s.woundedUntil = null;
  c.gold = 3;
  assert.match(why()[0], /Needs 25 crowns/);
  c.gold = 100;
  assert.deepEqual(plain(why()), [null, null]);
  assert.equal(CL.party.upgradeSoldier(c, s.id, 'footman'), true);
  assert.deepEqual([s.troop, s.xp, c.gold], ['footman', 0, 75]);
  assert.equal(CL.party.upgradeSoldier(c, s.id, 'guard'), false, 'not ready again');
  assert.equal(c.gold, 75);
  assert.equal(s.notes.at(-1).kind, 'promoted');
  assert.equal(CL.soldiers.noteText(s.notes.at(-1)), 'Promoted to Footman.');
  assert.deepEqual(plain(CL.party.soldierUpgrades(c.roster.find((x) => x.troop === 'hunter'), c).map((o) => o.to)), ['longbowman']);
});

test('renaming: cleaned, bounded, never empty, and kept in the save', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  const c = CL.campaign;
  const s = c.roster[0];
  assert.equal(CL.soldiers.rename(c, s.id, '  Edric   <b>the</b>\u0007 Bold of Oakford and Far Beyond  '), 'Edric bthe/b Bold of Oak');
  assert.equal(CL.soldiers.rename(c, s.id, '   '), null);
  assert.equal(s.name, 'Edric bthe/b Bold of Oak');
  CL.save.write();
  assert.equal(loadGame({ storage }).CL.campaign.roster[0].name, s.name);
});

test('the result screen names the fallen and the wounded, safely escaped', () => {
  const { CL } = loadGame({ random: () => 0.5 });
  const c = CL.campaign;
  CL.soldiers.rename(c, c.roster[0].id, 'Wat & "Kit"');
  CL.combat.startBattle('captains_trial');
  const u = CL.game.allies.find((a) => a.soldierId === c.roster[0].id);
  u.alive = false;
  CL.party.endBattle(true);
  assert.match(CL.game.result.html, /Wounded: Wat &#38; &#34;Kit&#34;/);
});

test('filters: everyone, fit, wounded, ready, and by role', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.roster[0].woundedUntil = 3;
  c.roster[1].xp = 50;
  const ids = (f) => plain(CL.soldiers.list(c, f).map((s) => s.id));
  assert.deepEqual(ids('all'), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids('wounded'), [1]);
  assert.deepEqual(ids('fit'), [2, 3, 4, 5]);
  assert.deepEqual(ids('ready'), [2]);
  assert.deepEqual(ids('infantry'), [1, 2, 3]);
  assert.deepEqual(ids('archer'), [4, 5]);
  assert.deepEqual(ids('cavalry'), []);
});

// ---- Prototype C / SC-01: Edric's career ----

test('SC-01 / Prototype C: recruit, earn, promote, wound, save, export and import: the same person', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage, random: () => 0.5 });
  const c = CL.campaign;
  c.roster = [];
  c.gold = 500;
  c.world.location = 'brackenfield';
  const edric = hire(CL, 'levy');
  const { id, name, origin, culture, joined } = edric;
  for (let i = 0; i < 3; i++) {
    CL.combat.startBattle('captains_trial');
    CL.party.endBattle(true);
  }
  CL.upkeep.payWages(c);
  assert.ok(CL.party.upgradeSoldier(c, id, 'footman'));
  CL.combat.startBattle('captains_trial');
  CL.game.allies.find((a) => a.soldierId === id).alive = false; // wounded (0.5 never kills)
  CL.party.endBattle(true);
  const before = plain(c.roster.find((s) => s.id === id));
  assert.deepEqual([before.record.battles, before.record.victories, before.record.wounds], [4, 4, 1]);
  assert.ok(before.record.wagesPaid > 0);
  assert.deepEqual(
    before.notes.map((n) => n.kind),
    ['joined', 'promoted', 'wounded'],
  );
  CL.save.write();
  const reloaded = loadGame({ storage }).CL.campaign.roster.find((s) => s.id === id);
  assert.deepEqual(plain(reloaded), before);
  const other = loadGame({ party: false });
  assert.equal(other.CL.portable.importText(CL.portable.serialize(c)).ok, true);
  const imported = plain(other.CL.campaign.roster.find((s) => s.id === id));
  assert.deepEqual(imported, before);
  assert.deepEqual([imported.name, imported.origin, imported.culture, imported.joined], [name, origin, culture, joined]);
});

// ---- Older saves ----

test('migrating a v4 save names every soldier: the same save always gets the same names', () => {
  const { CL } = loadGame();
  const v4 = plain(CL.campaign);
  v4.version = 4;
  preHoldings(v4);
  v4.roster = v4.roster.map(({ id, troop, xp, woundedUntil }) => ({ id, troop, xp, woundedUntil }));
  delete v4.rng.names;
  const frozen = JSON.stringify(v4);
  const a = CL.save.MIGRATIONS[4](v4);
  assert.equal(JSON.stringify(v4), frozen, 'the input is not changed');
  const b = CL.save.MIGRATIONS[4](JSON.parse(frozen));
  assert.equal(a.version, 5);
  assert.deepEqual(plain(a.roster.map((s) => s.name)), plain(b.roster.map((s) => s.name)));
  for (const s of a.roster) {
    assert.ok(s.name, 'named');
    assert.equal(s.culture, s.troop === 'levy' || s.troop === 'hunter' ? 'valedorn' : s.culture);
    assert.equal(s.joined, null, 'joining day never recorded');
    assert.deepEqual(plain(s.notes.map((n) => n.kind)), ['veteran']);
  }
  const loaded = CL.save.sanitize(v4);
  assert.deepEqual(plain(loaded.roster.map((s) => s.name)), plain(a.roster.map((s) => s.name)));
});

test('a damaged soldier entry is repaired, not lost: a missing name is drawn, bad notes dropped', () => {
  const { CL } = loadGame();
  const raw = plain(CL.campaign);
  raw.roster[0].name = '';
  raw.roster[0].culture = 'atlantean';
  raw.roster[0].record = { kills: -4, battles: 'many', wagesPaid: 12 };
  raw.roster[0].notes = [{ day: 1, kind: 'dragon' }, { day: 'x', kind: 'joined' }, { day: 2, kind: 'promoted', to: 'archmage' }, { day: 3, kind: 'captured' }];
  const s = CL.save.sanitize(raw).roster[0];
  assert.ok(s.name.length > 0);
  assert.equal(s.culture, 'valedorn');
  assert.deepEqual(plain(s.record), { battles: 0, victories: 0, kills: 0, assists: 0, wounds: 0, captures: 0, wagesPaid: 12 });
  assert.deepEqual(plain(s.notes), [{ day: 3, kind: 'captured' }]);
});
