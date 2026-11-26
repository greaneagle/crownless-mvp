// P11-06: armour, weight and movement (docs/PHASE-11-PLAN.md §10.3). The load (worn and wielded gear's
// weight, never the pack or the horse) against a capacity from base Strength; the bands and what they
// change; Agility's relief; a speed floor; armour's poise; pierce; the gear check's words; the origins'
// kits light; the walk's ramp in battle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const HEAVY = { weapon: 'arming_sword', offhand: 'heater_shield', head: 'iron_helm', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves' };

test('the load is what you wear and wield, the carried second weapon and slung shield too; never the pack or the horse', () => {
  const { CL } = loadGame();
  const P = CL.profile;
  const w = (id) => CL.content.item(id).weight;
  assert.equal(P.loadOf({ weapon: 'arming_sword', offhand: 'oak_shield' }), w('arming_sword') + w('oak_shield'));
  assert.equal(P.loadOf({ weapon: 'arming_sword', weapon2: 'great_axe', horse: 'courser' }), w('arming_sword') + w('great_axe'), 'the second weapon counts; the horse carries itself');
  assert.equal(P.loadOf({ weapon: 'arming_sword+2' }), w('arming_sword'), 'a forged piece weighs its base’s');
  const c = CL.campaign;
  const before = P.encumbrance(c, c.equipment).load;
  c.inventory.mail_hauberk = 3;
  c.cargo = { iron: 50 };
  assert.equal(P.encumbrance(c, c.equipment).load, before, 'the pack and the cargo never');
});

test('capacity from base Strength; four bands by load against it; a speed floor', () => {
  const { CL } = loadGame();
  const P = CL.profile;
  const E = CL.content.table('encumbrance');
  const c = CL.campaign;
  c.character.attributes.str = 5;
  assert.equal(P.capacityOf(c), E.capacity.base);
  c.character.attributes.str = 8;
  assert.equal(P.capacityOf(c), E.capacity.base + 3 * E.capacity.perStr);
  c.equipment.ring = 'ring_of_roads';
  assert.equal(P.capacityOf(c), E.capacity.base + 3 * E.capacity.perStr, 'base Strength only');
  c.character.attributes.str = 5;
  c.character.attributes.agi = 5;
  const band = (kit) => P.encumbrance(c, kit).band.id;
  assert.equal(band({ weapon: 'arming_sword', body: 'clothing' }), 'light');
  assert.equal(band({ weapon: 'arming_sword', offhand: 'kite_shield', head: 'leather_cap', body: 'gambeson', hands: 'gloves', feet: 'boots' }), 'medium');
  assert.equal(band({ ...HEAVY, head: 'leather_cap', feet: 'boots' }), 'heavy');
  assert.equal(band({ ...HEAVY, weapon2: 'great_axe' }), 'overloaded');
  const e = P.encumbrance(c, { ...HEAVY, weapon2: 'great_axe', head: 'bascinet' });
  assert.ok(e.speed >= E.floor, 'you can always walk');
  const light = P.encumbrance(c, { weapon: 'arming_sword' });
  assert.deepEqual([light.speed, light.ramp, light.recovery, light.draw], [1, 0, 1, 1], 'light costs nothing');
  const over = P.encumbrance(c, { ...HEAVY, weapon2: 'great_axe' });
  assert.ok(over.speed < 1 && over.ramp > 0 && over.recovery > 1 && over.draw > 1);
});

test('Agility lessens what the load costs; the hero walks, starts and recovers by it', () => {
  const { CL } = loadGame();
  const P = CL.profile;
  const c = CL.campaign;
  Object.assign(c.character.attributes, { str: 7, agi: 5 });
  const kit = { ...c.equipment, ...HEAVY };
  const stiff = P.encumbrance(c, kit);
  c.character.attributes.agi = 9;
  const nimble = P.encumbrance(c, kit);
  assert.equal(stiff.band.id, nimble.band.id, 'the same band');
  assert.ok(nimble.speed > stiff.speed && nimble.ramp < stiff.ramp && nimble.recovery < stiff.recovery);
  // In the profile: a heavy kit walks slower and recovers slower than a light one.
  c.character.attributes.agi = 5;
  const resolve = (eq) => P.resolve({ hero: c, equipment: CL.gear.kitFor(c, eq, 'primary'), carried: eq });
  const heavy = resolve(kit);
  const light = resolve({ ...c.equipment, weapon: 'arming_sword', offhand: null, body: 'clothing' });
  assert.ok(heavy.speed < light.speed);
  assert.ok(heavy.timing.recovery > light.timing.recovery && heavy.cooldown.hero > light.cooldown.hero);
  assert.equal(heavy.band, 'heavy');
  assert.ok(heavy.ramp > 0 && light.ramp === 0);
  // A carried second weapon weighs on you even while the first is in hand.
  assert.ok(resolve({ ...c.equipment, weapon: 'arming_sword', weapon2: 'great_axe', offhand: null, body: 'clothing' }).load > light.load);
});

test('in battle: a loaded hero takes a moment to reach full pace; a light one doesn’t', () => {
  const walked = (kit) => {
    const { CL } = loadGame();
    const c = CL.campaign;
    c.character.attributes.str = 7;
    Object.assign(c.equipment, kit);
    CL.combat.startBattle();
    const h = CL.game.hero;
    CL.game.allies = [];
    CL.game.enemies = [];
    const x0 = h.x;
    CL.game.hold.KeyD = true;
    CL.combat.update(0.05);
    return { first: h.x - x0, speed: h.speed };
  };
  const light = walked({ offhand: null, body: 'clothing' });
  const heavy = walked(HEAVY);
  assert.ok(Math.abs(light.first - light.speed * 0.05) < 0.6, 'light: full pace at once');
  assert.ok(heavy.first < heavy.speed * 0.05 * 0.8, 'heavy: a slower start');
});

test('armour steadies: its class adds poise, for the hero and for troops', () => {
  const { CL } = loadGame();
  const P = CL.profile;
  const c = CL.campaign;
  c.character.attributes.str = 7;
  const poise = (body) => P.resolve({ hero: c, equipment: { ...c.equipment, body } }).poise;
  assert.ok(poise('mail_hauberk') > poise('leather_chest') && poise('leather_chest') > poise('gambeson') && poise('gambeson') > poise('clothing'));
  const mail = Object.values(CL.content.table('troops')).find((t) => t.look?.armour === 'mail');
  const bare = Object.values(CL.content.table('troops')).find((t) => !t.look?.armour && CL.profile.troopWeapon(t) === CL.profile.troopWeapon(mail));
  if (bare) assert.ok(P.resolve({ troop: mail.id }).poise > P.resolve({ troop: bare.id }).poise);
  assert.equal(P.resolve({ troop: mail.id }).poise, CL.content.table('weapon_families')[P.resolve({ troop: mail.id }).family].poise + CL.content.table('encumbrance').poise.mail);
});

test('pierce: a mace’s blow ignores a share of the armour', () => {
  const { CL } = loadGame();
  const m = CL.combat.mitigate;
  assert.equal(m(20, 10), Math.round((20 * 100) / 140));
  assert.equal(m(20, 10, 0.3), Math.round((20 * 100) / (100 + 40 * 0.7)));
  assert.equal(m(20, 0, 0.3), 20);
  const F = CL.content.table('weapon_families');
  assert.ok(F.mace.pierce > 0 && F.crossbow.pierce > 0 && !F.sword.pierce);
  // In a fight: the same blow through mail, from a mace and from a sword.
  CL.combat.startBattle();
  const g = CL.game;
  const target = CL.units.makeUnit(0, 0, 'enemy', 'huscarl');
  const mace = CL.units.makeUnit(30, 0, 'ally', 'levy');
  const sword = CL.units.makeUnit(30, 0, 'ally', 'recruit');
  g.t = 1;
  const hp = target.hp;
  CL.combat.hit(target, 20, sword);
  const bySword = hp - target.hp;
  target.hp = hp;
  CL.combat.hit(target, 20, mace);
  assert.ok(hp - target.hp > bySword, `${hp - target.hp} through the armour against ${bySword}`);
});

test('the gear check says when your gear is heavy, and when a piece would make it so', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const G = CL.gear;
  c.character.attributes.str = 7;
  c.character.skills.shield = 2; // what the heater needs (P11-03), so only the load speaks
  assert.equal(G.check(c, { ...c.equipment, weapon: 'arming_sword', body: 'clothing' }).some((f) => f.code.startsWith('load_')), false);
  const heavy = G.check(c, { ...c.equipment, ...HEAVY });
  const f = heavy.find((x) => x.code === 'load_heavy');
  assert.equal(f.kind, 'penalty');
  assert.match(f.text, /^Your gear is heavy \(\d+ of \d+\): you move and recover slower\.$/);
  assert.equal(G.stops(heavy), false, 'a penalty never stops you');
  // Buying the hauberk on top of a medium kit: the armoury says the load turns heavy.
  Object.assign(c.equipment, { offhand: 'heater_shield', head: 'leather_cap', body: 'leather_chest', hands: 'mail_mittens', feet: 'boots' }); // medium (12 of 14.4)
  assert.ok(G.checkItem(c, 'mail_hauberk').some((x) => x.code === 'load_heavy' || x.code === 'load_over'));
  assert.equal(G.checkItem(c, 'boots').some((x) => x.code.startsWith('load_')), false, 'boots don’t change the band here');
});

test('every origin starts light; item weights are checked (0 to 20)', () => {
  const { CL } = loadGame();
  for (const o of Object.values(CL.content.table('origins'))) {
    const c = { character: { attributes: { str: 5 + (o.attribute === 'str' ? 1 : 0), agi: 5 + (o.attribute === 'agi' ? 1 : 0) } } };
    assert.equal(CL.profile.encumbrance(c, o.kit.equipment).band.id, 'light', o.id);
  }
  const C = {};
  for (const t of [...CL.content.TABLES, 'forge', 'gear_text', 'attributes', 'budget', 'body', 'encumbrance']) C[t] = JSON.parse(JSON.stringify(CL.content.table(t)));
  C.items.boots.weight = 40;
  assert.ok(JSON.parse(JSON.stringify(CL.content.validate(C))).some((e) => /item boots: weight must be from 0 to 20/.test(e)));
});
