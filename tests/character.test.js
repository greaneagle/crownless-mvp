// Character creation, derived stats and equipment (GDD §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('backgrounds add +1 attribute and +1 skill to the 5/5/5/5 base', () => {
  const { CL } = loadGame();
  const make = (background) => CL.character.create({ name: 'A', background });
  const f = make('farmhand');
  assert.deepEqual({ ...f.attributes }, { str: 6, agi: 5, int: 5, cha: 5 });
  assert.equal(f.skills.one_handed, 1);
  const s = make('scout');
  assert.equal(s.attributes.agi, 6);
  assert.equal(s.skills.pathfinding, 1);
  const p = make('peddler');
  assert.equal(p.attributes.cha, 6);
  assert.equal(p.skills.trade, 1);
  assert.equal(Object.keys(f.skills).length, 8, 'the 8 MVP skills');
  assert.equal(make('wizard').background, 'farmhand', 'unknown background falls back');
});

test('names are cleaned: control characters and angle brackets dropped, 20 chars max', () => {
  const { CL } = loadGame();
  const name = (n) => CL.character.create({ name: n, background: 'scout' }).name;
  assert.equal(name('  Aldric of Oakford  '), 'Aldric of Oakford');
  assert.equal(name('<b>Mara</b>'), 'bMara/b');
  assert.equal(name('Tab\there'), 'Tabhere');
  assert.equal(name('x'.repeat(40)).length, 20);
  assert.equal(name('   '), 'Wanderer');
  const ch = CL.character.create({ name: 'Q', gender: 'dragon', cloak: 'neon', background: 'scout' });
  assert.equal(ch.gender, 'unspecified');
  assert.equal(ch.cloak, 'crimson');
});

test('hero combat stats: HP = 60 + 5×STR, sword × One-Handed, armor from gear, shield allows block', () => {
  const { CL } = loadGame(); // fixture: Farmhand with the starting kit
  const h = CL.character.heroCombat();
  assert.equal(h.hp, 90);
  assert.ok(Math.abs(h.damage - 17 * 1.03) < 1e-9);
  assert.equal(h.armor, 1, 'clothing');
  assert.equal(h.canBlock, true);
});

test('equip swaps through the pack atomically; unequip returns the item', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.inventory.leather_chest = 1;
  assert.equal(CL.character.equip('leather_chest'), true);
  assert.equal(c.equipment.body, 'leather_chest');
  assert.equal(c.inventory.clothing, 1, 'old chest back in the pack');
  assert.equal('leather_chest' in c.inventory, false);
  assert.equal(CL.character.heroCombat().armor, 2);

  assert.equal(CL.character.equip('leather_chest'), false, 'none left in the pack');
  assert.equal(CL.character.equip('food_3_days'), false, 'not equipment');

  assert.equal(CL.character.unequip('offhand'), true);
  assert.equal(c.inventory.oak_shield, 1);
  assert.equal(CL.character.heroCombat().canBlock, false);
  assert.equal(CL.character.unequip('offhand'), false, 'slot already empty');

  CL.character.unequip('weapon');
  assert.equal(CL.character.heroCombat().damage, CL.character.UNARMED_DAMAGE * 1.03);
});

test('travel factor: +3% per Pathfinding point, a horse and the Ring of Roads stack', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.character = CL.character.create({ name: 'S', background: 'scout' });
  assert.ok(Math.abs(CL.character.travelFactor() - 1.03) < 1e-9);
  c.inventory.nag = 1;
  c.inventory.ring_of_roads = 1;
  CL.character.equip('nag');
  CL.character.equip('ring_of_roads');
  assert.equal(CL.character.skill('pathfinding'), 2);
  assert.ok(Math.abs(CL.character.travelFactor() - 1.06 * 1.1) < 1e-9);
  assert.ok(Math.abs(CL.world.speedAt(75, 20) - 4 * 1.06 * 1.1) < 1e-9, 'world speed uses it');
});

test('a battle hero uses the character; without a shield block never engages', () => {
  const { CL } = loadGame();
  CL.character.unequip('offhand');
  CL.combat.startBattle();
  const h = CL.game.hero;
  assert.equal(h.maxhp, 90);
  assert.equal(h.canBlock, false);
  CL.game.blockHeld = true;
  CL.combat.update(0.02);
  assert.equal(h.guard, false);
});

test('starting a new game builds a fresh campaign from the kit and enters Stonebridge', () => {
  const { CL, storage, uiCalls } = loadGame({ party: false });
  CL.campaign.gold = 999; // must not survive a new game
  CL.game.newGame = true;
  CL.character.begin({ name: 'Edda', gender: 'woman', cloak: 'forest', background: 'peddler' });
  const c = CL.campaign;
  assert.equal(c.gold, 60);
  assert.equal(c.character.name, 'Edda');
  assert.equal(c.character.cloak, 'forest');
  assert.equal(c.roster.length, 0);
  assert.equal(CL.save.existed, true);
  assert.equal(CL.game.newGame, false);
  assert.equal(JSON.parse(storage.data.crownless_save).character.background, 'peddler');
  assert.ok(uiCalls.some((x) => x[0] === 'changeMode' && x[1] === 'town'), 'starts in the streets of Stonebridge');
});

test('an older save gains a character without losing its party or gold', () => {
  const { CL } = loadGame();
  CL.campaign.character = null;
  CL.campaign.gold = 444;
  CL.game.newGame = false;
  CL.character.begin({ name: 'Old Hand', background: 'scout' });
  assert.equal(CL.campaign.gold, 444);
  assert.equal(CL.campaign.roster.length, 5);
  assert.equal(CL.campaign.character.background, 'scout');
});

test('saved characters and equipment are validated', () => {
  const { CL } = loadGame();
  assert.equal(CL.character.sanitize({ background: 'wizard' }), null);
  const ch = CL.character.sanitize({
    name: 'Ok',
    background: 'farmhand',
    attributes: { str: 50, agi: 7, int: 'x' },
    skills: { trade: 3, one_handed: -1, juggling: 5 },
    level: 2,
  });
  assert.equal(ch.attributes.str, 6, 'out of range → background default');
  assert.equal(ch.attributes.agi, 7);
  assert.equal(ch.skills.trade, 3);
  assert.equal(ch.skills.one_handed, 1);
  assert.equal('juggling' in ch.skills, false);
  assert.equal(ch.level, 2);
  const eq = CL.character.sanitizeEquipment({ weapon: 'oak_shield', offhand: 'oak_shield', head: 'crown_of_x' });
  assert.equal(eq.weapon, null, 'a shield is not a weapon');
  assert.equal(eq.offhand, 'oak_shield');
  assert.equal(eq.head, null);
});

test('content validator checks backgrounds and their kits', () => {
  const { CL } = loadGame();
  CL.content.table('backgrounds').scout.kit = { gold: 60, equipment: { weapon: 'boots' }, items: { ghost: 1 } };
  const errors = Array.from(CL.content.validate()).join('\n');
  assert.match(errors, /kit item boots does not fit weapon/);
  assert.match(errors, /unknown kit item ghost/);
});
