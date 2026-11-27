// P11-03: equipment requirements and the progression budget (docs/PHASE-11-PLAN.md §7). The rule over
// every item, family and pack item; requirements read base values only (never an item's, a companion's
// or the retinue's bonus); a piece you don't meet is kept, and stays with the baggage in battle; the
// gear check says what it needs, what you have and how to get there; the budget fits ten skills.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'sample', 'sample.json'), 'utf8'));

/** The game's content as plain tables, to edit and check. */
function content(CL) {
  const out = {};
  for (const t of [...CL.content.TABLES, 'forge', 'gear_text', 'attributes', 'budget']) out[t] = CL.content.table(t);
  return JSON.parse(JSON.stringify(out));
}

test('the budget: the cap is data/character.js’s, levels 1–10 are 5.0.0’s, and it fits ten skills', () => {
  const { CL } = loadGame();
  const C = CL.character;
  const B = CL.content.table('budget');
  assert.equal(B.cap, C.MAX_LEVEL);
  assert.ok(B.middle < B.late && B.late < B.cap);
  assert.equal(Object.keys(CL.content.table('skills')).length, 10, 'D-P11c: the eight, Two-Handed and Polearm');
  for (let L = 1; L < 10; L++) assert.equal(C.xpToNext(L), Math.round(100 * L ** 1.35), `level ${L} costs what it did`);
  assert.equal(C.xpTotal(10), 8428, 'level 10 comes when it did (P11-00: day 49 to 55)');
  // The points at the cap: enough for the dearest piece in each of the combat skills' lines at once
  // (P11-08's horses ask Riding 3: half the cap's points no longer hold them all, the cap's do).
  const pts = C.pointsAt(B.cap);
  assert.deepEqual(plain(pts), { skills: 19, attributes: 10 });
  const items = Object.values(CL.content.table('items')).filter((it) => it.slot);
  const dearest = {};
  for (const it of items) for (const [k, n] of Object.entries(CL.gear.reqOf(it.id)?.skills || {})) dearest[k] = Math.max(dearest[k] || 0, n);
  const all = Object.values(dearest).reduce((a, b) => a + b, 0);
  assert.ok(all <= pts.skills, `every skill requirement at once (${all}) fits the cap's ${pts.skills} points`);
  // Nothing needs more than the cap can give.
  const top = 5 + 1 + pts.attributes;
  for (const it of items) {
    const r = CL.gear.reqOf(it.id) || {};
    for (const a of ['str', 'agi']) assert.ok(!(r[a] > top), `${it.id}: ${a} ${r[a]} unreachable`);
    for (const n of Object.values(r.skills || {})) assert.ok(n <= C.MAX_SKILL, `${it.id}: a skill past ${C.MAX_SKILL}`);
  }
});

test('the rule holds over every item and family: ordinary gear needs nothing, the rest what its level reaches', () => {
  const { CL } = loadGame();
  const G = CL.gear;
  assert.deepEqual(plain(G.ruleProblems(content(CL))), []);
  // Every class is in the game, and the pieces with requirements are where the rule allows them.
  const C = content(CL);
  const cls = (id) => G.classOf(C.items[id], C);
  assert.deepEqual(['hand_axe', 'arming_sword', 'kite_shield', 'war_mace', 'knights_sword', 'mail_hauberk'].map(cls), ['ordinary', 'ordinary', 'ordinary', 'advanced', 'elite', 'elite']);
  assert.equal(cls('knights_sword+2'), 'elite', 'a forged piece is its base’s');
  assert.deepEqual(plain(G.reqOf('knights_sword+1')), { skills: { one_handed: 3 } }, 'forging keeps requirements');
  // A starting kit, the loaner kit and the village armouries need nothing.
  const start = CL.campaign;
  for (const id of [...Object.values(start.equipment).filter(Boolean), ...Object.values(C.tournaments.lists.kit)]) assert.ok(G.meets(start, id), `${id}: needs nothing of a new character`);
  for (const s of Object.values(C.settlements)) if (s.type === 'village') for (const id of s.gear || []) assert.ok(G.meets(start, id), `${s.id} sells ${id}, which a new character can't use`);
});

test('the rule fails what it should: too much, the wrong class, unreachable, untaught, bad shapes, rule 5', () => {
  const { CL } = loadGame();
  const errs = (edit) => {
    const C = content(CL);
    edit(C);
    return plain(CL.gear.ruleProblems(C)).join('\n');
  };
  assert.match(errs((C) => {
    C.items.hand_axe.req = { str: 6 };
  }), /item hand_axe: ordinary gear/);
  assert.match(errs((C) => {
    C.items.war_mace.req = { str: 8 };
  }), /item war_mace: an advanced piece may need 2 attribute points of level 10's 5, not 3/);
  assert.match(errs((C) => {
    C.items.war_mace.req = { skills: { one_handed: 5 } };
  }), /item war_mace: an advanced piece may need 4 skill points of level 10's 9, not 5/);
  assert.match(errs((C) => {
    C.items.knights_sword.req = { str: 9 };
  }), /item knights_sword: an elite piece may need 3 attribute points of level 15's 7, not 4/);
  assert.match(errs((C) => {
    C.items.knights_sword.req = { str: 17 };
  }), /req.str must be a whole number from 6 to 16/);
  assert.match(errs((C) => {
    C.items.knights_sword.req = { skills: { juggling: 1 } };
  }), /unknown skill juggling/);
  assert.match(errs((C) => {
    C.items.knights_sword.req = { training: 'hrolf' };
  }), /no one teaches the training hrolf/);
  assert.match(errs((C) => {
    C.items.knights_sword.req = { cha: 6 };
  }), /req can't name cha/);
  assert.match(errs((C) => {
    C.items.war_mace.req = { training: 'hrolf' };
    C.training = { hrolf: { id: 'hrolf' } };
  }), /only an elite piece may need training/);
  assert.equal(errs((C) => {
    C.items.knights_sword.req = { skills: { one_handed: 3 }, training: 'hrolf' };
    C.training = { hrolf: { id: 'hrolf' } };
  }), '', 'an elite piece with training someone teaches');
  assert.match(errs((C) => {
    C.weapon_families.axe.req = { str: 'six' };
  }), /weapon family axe: req.str/);
  // A family's default applies to its items, and an item's own {} overrides it.
  assert.match(errs((C) => {
    C.items.hand_axe.family = 'greatsword';
  }), /item hand_axe: ordinary gear/);
  assert.equal(errs((C) => Object.assign(C.items.hand_axe, { family: 'greatsword', req: {} })), '');
  // Rule 5: a sword, a shield and a horse that need nothing, whatever you spend.
  assert.match(errs((C) => { for (const it of Object.values(C.items)) if (it.slot === 'offhand') it.req = { skills: { shield: 1 } }; }), /no shield needs nothing/);
  assert.match(errs((C) => {
    C.budget = { cap: 12, middle: 10, late: 11 };
  }), /budget: the cap 12 isn't the game's 20/);
  assert.match(errs((C) => {
    C.budget = { cap: 20, middle: 15, late: 10 };
  }), /budget: needs whole levels/);
});

test('packs: an item’s requirement is checked by the same rule', () => {
  const { CL } = loadGame();
  const pack = (req, tier = 3) => {
    const p = JSON.parse(JSON.stringify(SAMPLE));
    p.items = { 'sample:cairn_blade': { id: 'sample:cairn_blade', family: 'sword', name: 'Cairn Blade', type: 'weapon', slot: 'weapon', tier, rarity: 'rare', value: 200, weight: 2, stats: { damage: 24 }, req, questItem: false } };
    return CL.packs.parse(JSON.stringify(p), { file: 'p.json' }).errors;
  };
  assert.deepEqual(plain(pack({ str: 7, skills: { one_handed: 2 } })), []);
  assert.ok(pack({ str: 12 }).some((e) => /cairn_blade: an elite piece may need 3 attribute points/.test(e)), 'too much for an elite piece');
  assert.ok(pack({ str: 6 }, 1).some((e) => /cairn_blade: ordinary gear/.test(e)), 'tier 1 needs nothing');
});

test('requirements read base values: never an item’s, a companion’s or the retinue’s bonus', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const C = CL.character;
  c.character.skills.pathfinding = 1;
  c.equipment.ring = 'ring_of_roads';
  assert.equal(C.skill('pathfinding', c), 2, 'the ring counts for what the skill does');
  assert.equal(C.baseSkill('pathfinding', c), 1, 'but not for what it meets');
  // Training adds to a base skill once a master teaches it (P11-17's data; a test master here).
  c.character.training.test_drill = true;
  const { CL: CL2 } = loadGame({
    content: (X) => {
      X.training = { test_drill: { id: 'test_drill', skills: { one_handed: 1 } } };
    },
  });
  const c2 = CL2.campaign;
  c2.character.training.test_drill = true;
  assert.equal(CL2.character.baseSkill('one_handed', c2), c2.character.skills.one_handed + 1);
  assert.equal(C.baseSkill('one_handed', c), c.character.skills.one_handed, 'no such training here: nothing');
  assert.equal(C.baseAttribute('str', c), c.character.attributes.str);
  // A companion's lent skill doesn't meet the Knight's Sword.
  c.character.skills.one_handed = 2;
  CL.companion.skillBonus = (id) => (id === 'one_handed' ? 3 : 0);
  assert.equal(C.skill('one_handed', c), 5);
  assert.equal(CL.gear.meets(c, 'knights_sword'), false);
  c.character.skills.one_handed = 3;
  assert.equal(CL.gear.meets(c, 'knights_sword'), true);
});

test('the gear check: what it needs, what you have, how to get it; kept, but left with the baggage in battle', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const G = CL.gear;
  const ch = c.character; // a Farmhand: Strength 6; One-Handed 0 here
  ch.skills.one_handed = 0;
  ch.skillPoints = 1;
  c.inventory.knights_sword = 1;
  const f = G.checkItem(c, 'knights_sword');
  assert.deepEqual(plain(f.map((x) => [x.kind, x.code, x.have, x.need])), [['requirement', 'skill', 0, 3]]);
  assert.equal(f[0].text, "The Knight's Sword needs One-Handed 3; you have 0. More points come as you level.");
  assert.equal(G.stops(f), true, 'so buying it takes a second tap');
  ch.skillPoints = 3;
  assert.equal(G.checkItem(c, 'knights_sword')[0].text, "The Knight's Sword needs One-Handed 3; you have 0. Spend 3 skill points on it.");
  const mail = G.checkItem(c, 'mail_hauberk');
  assert.equal(mail[0].text, 'The Mail Hauberk needs Strength 7; you have 6. More points come as you level.');
  // Worn without meeting it: kept, said on the sheet, and left behind in battle (never removed).
  const before = c.equipment.weapon;
  assert.ok(CL.character.equip('knights_sword', c));
  assert.equal(c.equipment.weapon, 'knights_sword');
  assert.equal(c.inventory[before], 1, 'the old weapon in the pack');
  assert.ok(G.checkAll(c).some((x) => x.code === 'skill' && x.item === 'knights_sword'));
  assert.equal(CL.character.heroCombat(c).damage, CL.profile.resolve({ hero: c, equipment: { ...c.equipment, weapon: null } }).damage, 'fists, not the sword');
  const start = G.battleLoadout(c);
  assert.equal(start.message, "You can’t wield your Knight's Sword yet: you fight with your fists.");
  // A second weapon you can wield is used instead, and that's said too.
  CL.character.equip(before, c, 'weapon2');
  const b = G.battleLoadout(c);
  assert.equal(b.which, 'secondary');
  assert.match(b.message, /^Your first weapon can’t be used here: you start with your /);
  // Armour you don't meet doesn't stop a loadout: it stays behind, and the armour is counted without it.
  c.equipment.body = 'mail_hauberk';
  const armour = CL.character.heroCombat(c, { ...c.equipment, weapon: before, weapon2: null }).armor;
  ch.attributes.str = 7;
  assert.equal(CL.character.heroCombat(c, { ...c.equipment, weapon: before, weapon2: null }).armor, armour + 5);
  assert.equal(G.bestLoadout(c), 'secondary');
  // Meet it, and the sword is in hand.
  ch.skills.one_handed = 3;
  assert.equal(G.bestLoadout(c), 'primary');
  assert.equal(G.battleLoadout(c).message, null);
  // Every item is still where it was: a requirement never moves one.
  assert.deepEqual([c.equipment.weapon, c.equipment.weapon2, c.equipment.body], ['knights_sword', before, 'mail_hauberk']);
});

test('what your points would unlock: the pieces you have, by the points you have to spend', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const ch = c.character;
  Object.assign(ch.skills, { one_handed: 0 });
  ch.attributes.str = 5;
  c.inventory.war_mace = 1;
  c.inventory.knights_sword = 1;
  assert.deepEqual(plain(CL.gear.unlocks(c)), [], 'no points: nothing to say');
  ch.skillPoints = 2;
  ch.attributePoints = 0;
  assert.deepEqual(plain(CL.gear.unlocks(c)), [], 'the mace needs Strength, the sword three points');
  ch.skillPoints = 3;
  assert.deepEqual(plain(CL.gear.unlocks(c)), [{ item: 'knights_sword', needs: 'One-Handed 3' }]);
  ch.attributePoints = 1;
  assert.deepEqual(plain(CL.gear.unlocks(c).map((u) => u.item)), ['knights_sword', 'war_mace']);
});
