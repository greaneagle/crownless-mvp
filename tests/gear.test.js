// P11-02: carried and wielded (js/gear.js, data/gear_text.js). Every rule and finding of the one gear
// check; the loadout a battle starts with and its fallback; the words fit; one place for each item over
// a long random sequence of everything that moves gear; switching weapons in battle never makes a
// weapon ready sooner; the new save fields round trip and junk is repaired.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, mulberry } = require('./helpers/load');
const { headlessUi } = require('./helpers/campaign-bot');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** Two weapons the 5.x game doesn't sell yet: a two-handed sword and a shortbow (test data). The sword
 * needs nothing (`req: {}`, over its family's): requirements are tests/requirements.test.js's. */
function withTestWeapons(C) {
  C.items.test_greatsword = { id: 'test_greatsword', name: 'Test Greatsword', type: 'weapon', slot: 'weapon', family: 'greatsword', tier: 2, rarity: 'uncommon', value: 120, weight: 4, stats: { damage: 28 }, req: {}, questItem: false };
  C.items.test_bow = { id: 'test_bow', name: 'Test Shortbow', type: 'weapon', slot: 'weapon', family: 'shortbow', tier: 1, rarity: 'common', value: 40, weight: 1, stats: { damage: 12 }, questItem: false };
  C.settlements.stonebridge.gear = [...(C.settlements.stonebridge.gear || []), 'test_greatsword', 'test_bow'];
}

function game(opts = {}) {
  const env = loadGame({ content: withTestWeapons, ...opts });
  env.CL.ui = headlessUi(env.CL, env.messages || []);
  return env;
}

const codes = (fs) => plain(fs.map((f) => [f.kind, f.code]));

test('the gear check: a two-handed weapon or a bow slings the shield; fists; the loaner kit; in words', () => {
  const { CL } = game();
  const c = CL.campaign;
  const G = CL.gear;
  const kit = (over) => ({ ...c.equipment, weapon: 'arming_sword', offhand: 'kite_shield', ...over });
  assert.deepEqual(codes(G.check(c, kit({}))), [], 'a sword and a shield: nothing to say');
  const two = G.check(c, kit({ weapon: 'test_greatsword' }));
  assert.deepEqual(codes(two), [['note', 'two_hands']]);
  assert.equal(two[0].text, 'The Test Greatsword needs both hands: your Kite Shield will be slung on your back.');
  assert.equal(two[0].item, 'test_greatsword');
  assert.deepEqual(codes(G.check(c, kit({ weapon: 'test_bow' }))), [['note', 'shoots']]);
  assert.deepEqual(codes(G.check(c, kit({ weapon: 'test_greatsword', offhand: null }))), [], 'no shield to sling');
  assert.deepEqual(codes(G.check(c, kit({ weapon: null }))), [['note', 'unarmed']]);
  const lists = G.check(c, CL.content.get('tournaments', 'lists').kit, { loaner: true });
  assert.deepEqual(codes(lists), [['note', 'loaner']]);
  assert.equal(lists[0].text, 'You fight in the loaner kit: Arming Sword and Kite Shield. Your own gear stays in your pack.');
  // Each finding has every field.
  for (const f of [...two, ...lists]) assert.deepEqual(Object.keys(f).sort(), ['code', 'fix', 'have', 'item', 'kind', 'need', 'text']);
  // What's in hand: the slung shield doesn't protect or block.
  const a = G.active(c, kit({ weapon: 'test_greatsword' }));
  assert.deepEqual([a.weapon, a.shield, a.stowed], ['test_greatsword', null, true]);
  const h = CL.character.heroCombat(c, kit({ weapon: 'test_greatsword' }), 'primary');
  const s = CL.character.heroCombat(c, kit({}), 'primary');
  assert.deepEqual([h.canBlock, s.canBlock], [false, true]);
  assert.equal(s.armor - h.armor, CL.content.item('kite_shield').stats.armor);
  assert.equal(G.describe(c, kit({ weapon: 'test_greatsword' })), 'Test Greatsword (Kite Shield slung)');
  assert.equal(G.describe(c, kit({})), 'Arming Sword and Kite Shield');
});

test('horseback and heavy armour: incompatible, penalty, from the profile (P11-06 and P11-08 fill them in)', () => {
  const { CL } = game({
    content: (C) => {
      withTestWeapons(C);
      C.weapon_families.shortbow.mounted = 'no';
      C.weapon_families.greatsword.mounted = 'penalty';
      C.weapon_families.greatsword.armourLimit = 2;
    },
  });
  const c = CL.campaign;
  c.character.attributes.str = 7; // P11-03: what the hauberk needs
  const G = CL.gear;
  const kit = (w, body = 'gambeson') => ({ ...c.equipment, weapon: w, offhand: null, body });
  assert.deepEqual(codes(G.check(c, kit('test_bow'), { mounted: true, which: 'primary' })), [['incompatible', 'mounted']]);
  assert.deepEqual(codes(G.check(c, kit('test_bow'), { which: 'primary' })), [], 'on foot it is fine');
  assert.deepEqual(codes(G.check(c, kit('test_greatsword'), { mounted: true, which: 'primary' })), [['penalty', 'mounted']]);
  const heavy = G.check(c, kit('test_greatsword', 'mail_hauberk'), { which: 'primary' });
  assert.deepEqual(codes(heavy), [['penalty', 'heavy']]);
  assert.deepEqual([heavy[0].have, heavy[0].need], [5, 2]);
  assert.equal(G.stops(G.check(c, kit('test_bow'), { mounted: true, which: 'primary' })), true);
  assert.equal(G.stops(heavy), false, 'a penalty never stops you');
});

test('the loadout a battle starts with: the one you prefer, else the other, said in words; never silent', () => {
  const { CL } = game({
    content: (C) => {
      withTestWeapons(C);
      C.weapon_families.shortbow.mounted = 'no';
    },
  });
  const c = CL.campaign;
  const G = CL.gear;
  c.equipment.weapon = 'arming_sword';
  c.equipment.weapon2 = 'test_bow';
  assert.equal(G.bestLoadout(c), 'primary');
  c.loadout.start = 'secondary';
  assert.equal(G.bestLoadout(c), 'secondary');
  assert.deepEqual(plain(G.battleLoadout(c)), { which: 'secondary', message: null });
  // From horseback the bow can't be used: the sword, with a message.
  const lo = G.battleLoadout(c, c.equipment, { mounted: true });
  assert.equal(lo.which, 'primary');
  assert.equal(lo.message, 'Your second weapon can’t be used here: you start with your Arming Sword instead.');
  // No second weapon: the first, whatever the preference says (and taking it off clears the preference).
  CL.character.unequip('weapon2', c);
  assert.equal(c.loadout.start, 'primary');
  assert.equal(G.bestLoadout(c), 'primary');
  // A save that prefers a second weapon it no longer has: repaired on load, with a message, no item removed.
  const raw = plain(c);
  raw.loadout = { start: 'secondary', ride: false, last: { contract: 'secondary', '<bad>': 'primary', duel: 'sideways' } };
  const s = CL.save.sanitize(raw);
  assert.deepEqual(plain(s.loadout), { start: 'primary', ride: false, last: { contract: 'secondary' } });
  assert.deepEqual(plain(s.inventory), plain(c.inventory));
});

test('the first weapon taken off: the second becomes the first; swapping moves nothing to the pack', () => {
  const { CL } = game();
  const c = CL.campaign;
  const C = CL.character;
  c.inventory.test_greatsword = 1;
  c.inventory.hand_axe = 1;
  const w1 = c.equipment.weapon;
  assert.equal(C.equip('test_greatsword', c, 'weapon2'), true);
  assert.equal(c.equipment.weapon2, 'test_greatsword');
  assert.equal(C.equip('kite_shield', c, 'weapon2'), false, 'only a weapon goes in the second weapon slot');
  assert.equal(C.swapWeapons(c), true);
  assert.deepEqual([c.equipment.weapon, c.equipment.weapon2], ['test_greatsword', w1]);
  assert.equal(C.unequip('weapon', c), true);
  assert.deepEqual([c.equipment.weapon, c.equipment.weapon2], [w1, null]);
  assert.equal(c.inventory.test_greatsword, 1);
  // Equipping into a full slot sends the old one to the pack: an item is never in two places.
  C.equip('hand_axe', c, 'weapon2');
  C.equip('test_greatsword', c, 'weapon2');
  assert.deepEqual([c.equipment.weapon2, c.inventory.hand_axe, c.inventory.test_greatsword], ['test_greatsword', 1, undefined]);
  // Junk in a save is repaired: a shield as the second weapon, an unknown item, a quiver slot.
  const eq = C.sanitizeEquipment({ ...c.equipment, weapon2: 'kite_shield', ammo: 'nonsense', ring: 'oak_shield' });
  assert.deepEqual([eq.weapon2, eq.ammo, eq.ring], [null, null, null]);
  assert.deepEqual(Object.keys(eq), [...C.SLOTS]);
});

test('every finding fits two lines with the longest names; the words are the game’s own', () => {
  const { CL } = game();
  const G = CL.gear;
  const items = Object.values(CL.content.table('items'));
  const longest = items.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name;
  // P11-03: a requirement's line with the longest skill, numbers and way to meet it.
  const fix = G.FIXES.map((k) => G.words(k, { n: '12 attribute points', master: 'Master Hrolf the Elder', place: 'Castel Verro' })).reduce((a, b) => (b.length > a.length ? b : a));
  const stat = [...Object.values(CL.content.table('skills')).map((s) => s.name), ...Object.values(CL.character.ATTRIBUTE_NAMES)].reduce((a, b) => (b.length > a.length ? b : a));
  for (const code of G.CODES) {
    const text = G.words(code, { item: longest, shield: longest, other: longest, loadout: 'second weapon', stat, need: '10', have: '5', fix });
    assert.ok(text.length <= G.TEXT_MAX, `${code}: ${text.length} letters`);
    assert.ok(!/\{\w+\}/.test(text), `${code}: every name filled`);
  }
  assert.deepEqual(Object.keys(CL.content.table('gear_text')).sort(), [...G.LINES].sort());
  // The checks hold a world's words to the codes and the length.
  const tables = [...CL.content.TABLES, 'forge', 'gear_text', 'fighting_styles', 'practice'];
  const C = plain(Object.fromEntries(tables.map((t) => [t, CL.content.table(t)])));
  assert.deepEqual(plain(CL.content.validate(C)), []);
  C.gear_text.shout = 'Hello';
  C.gear_text.two_hands = 'x'.repeat(120);
  delete C.gear_text.unarmed;
  const e = plain(CL.content.validate(C));
  assert.ok(e.includes('gear_text: unknown code shout'));
  assert.ok(e.includes('gear_text.two_hands: too long for two lines (120)'));
  assert.ok(e.includes('gear_text: needs the line for unarmed'));
});

test('one place for each item: 2,000 random operations, every count accounted for', () => {
  const { CL } = game({ seed: 99 });
  const c = CL.campaign;
  const C = CL.character;
  const T = CL.trade;
  const rnd = mulberry(4242);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const s = CL.content.table('settlements').stonebridge;
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
  c.gold = 1e6;
  CL.blacksmith.hire(c);
  c.cargo.iron = 999;
  for (const id of ['hand_axe', 'war_mace', 'test_greatsword', 'test_bow', 'oak_shield', 'iron_helm']) c.inventory[id] = 1;
  const count = () => {
    const n = {};
    for (const [id, k] of Object.entries(c.inventory)) n[id] = (n[id] || 0) + k;
    for (const id of Object.values(c.equipment)) if (id) n[id] = (n[id] || 0) + 1;
    return n;
  };
  const expect = count();
  const add = (id, k) => {
    expect[id] = (expect[id] || 0) + k;
    if (!expect[id]) delete expect[id];
  };
  const kit = CL.content.get('tournaments', 'lists').kit;
  const moved = { buy: 0, sell: 0, forge: 0, lost: 0, loot: 0 };
  let battleId = c.lastResolvedBattle;
  const ops = {
    equip: () => {
      const id = pick(Object.keys(c.inventory).filter((x) => CL.content.item(x).slot));
      if (id) C.equip(id, c, CL.content.item(id).slot === 'weapon' && rnd() < 0.4 ? 'weapon2' : null);
    },
    unequip: () => C.unequip(pick(C.SLOTS), c),
    swap: () => C.swapWeapons(c),
    buy: () => {
      const id = pick(T.gearStock('stonebridge'));
      if (T.buyGear(c, 'stonebridge', id).ok && !CL.content.item(id).stats.food) {
        add(id, 1);
        moved.buy++;
      }
    },
    sell: () => {
      const id = pick(Object.keys(c.inventory).filter((x) => T.gearPrice(c, x) > 0));
      if (id && T.sellGear(c, 'stonebridge', id).ok) {
        add(id, -1);
        moved.sell++;
      }
    },
    forge: () => {
      const slot = pick(['weapon', 'weapon2', 'offhand', 'head', 'body']);
      const r = CL.blacksmith.forge(c, slot);
      if (r.ok) {
        add(r.offer.from, -1);
        add(r.offer.to, 1);
        moved.forge++;
      }
    },
    battle: () => {
      // A battle's result: a win's loot (in the pack), or a loss and capture (one item from the pack).
      const win = rnd() < 0.6;
      const before = count();
      const r = CL.party.applyBattleResult(c, { battleId: ++battleId, encounterId: 'looter_band', win, kills: 4, killed: [], wounded: [] });
      if (win) for (const [id, n] of Object.entries(r.loot)) if (!CL.content.item(id).stats.food) {
        add(id, n);
        moved.loot++;
      }
      if (r.lostItem) {
        add(r.lostItem, -1);
        moved.lost++;
      }
      // Only the pack changes: what is worn is never taken.
      for (const id of Object.values(c.equipment)) if (id) assert.ok(count()[id] >= 1 && (before[id] || 0) >= 1);
    },
    tourney: () => {
      // A bout in the loaner kit: the hero's own gear never moves.
      c.tourney = CL.tourney.blank(c.day);
      c.tourney.hosts.stonebridge.next = c.day;
      CL.tourney.tick(c);
      if (CL.tourney.enter(c, 'stonebridge').ok && CL.tourney.fight(c)) {
        assert.equal(CL.game.hero.profile.family, CL.content.item(kit.weapon).family);
        CL.debugTools.endBattleNow(rnd() < 0.5);
      }
      c.tourney.bracket = null;
      CL.game.mode = 'settlement';
    },
    roundTrip: () => {
      const r = CL.portable.parse(CL.portable.serialize(c));
      assert.equal(r.ok, true, r.reason);
      CL.campaign = r.campaign;
      Object.assign(c, r.campaign);
    },
  };
  const names = Object.keys(ops);
  const strip = (n) => Object.fromEntries(Object.entries(n).filter(([id]) => !CL.content.item(id).stats.food)); // food goes to rations
  for (let i = 0; i < 2000; i++) {
    const op = names[Math.floor(rnd() * names.length)];
    ops[op]();
    const now = strip(count());
    for (const n of Object.values(now)) assert.ok(n > 0, `${op} #${i}: a count went to zero or below`);
    assert.deepEqual(now, strip(expect), `${op} #${i}`);
    for (const slot of C.SLOTS) {
      const id = c.equipment[slot];
      if (id) assert.ok(C.fits(CL.content.item(id), slot), `${op} #${i}: ${id} in ${slot}`);
    }
  }
  for (const [k, n] of Object.entries(moved)) assert.ok(n > 0, `the run ${k} at least once (${JSON.stringify(moved)})`);
});

test('switching weapons in battle: takes its time, not while swinging, and never makes a weapon ready sooner', () => {
  const { CL } = game({ seed: 5 });
  const c = CL.campaign;
  c.inventory.test_greatsword = 1;
  CL.character.equip('test_greatsword', c, 'weapon2');
  CL.combat.startBattle({ id: 'sw', name: 'sw', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  const h = g.hero;
  const L = g.loadout;
  assert.deepEqual([L.which, L.can, h.canBlock], ['primary', true, true]);
  const swordDamage = h.damage;
  // Not while swinging: asked for mid-swing (P11-09), it waits for the swing to end, then starts by itself.
  CL.combat.startAttack(h);
  assert.equal(CL.gear.switchWeapon(g), false);
  assert.equal(L.wanted, true, 'kept for after the swing');
  assert.equal(CL.gear.switching(g), false);
  // Wait out the swing; the sword's cooldown is still running when the switch starts.
  while (h.swing) CL.combat.update(0.02);
  const left = h.attackCooldown;
  assert.ok(left >= 0);
  const t0 = g.t;
  if (!CL.gear.switching(g)) CL.combat.update(0.02);
  assert.equal(CL.gear.switching(g), true, 'it started as the swing ended');
  assert.equal(L.wanted, false);
  assert.equal(CL.gear.switchWeapon(g), false, 'one at a time');
  g.attackHeld = true;
  // No blow and no block while drawing.
  for (let i = 0; i < 10; i++) {
    g.blockHeld = true;
    CL.combat.update(0.02);
    assert.equal(h.swing, null);
    assert.equal(h.guard, false);
  }
  while (CL.gear.switching(g)) CL.combat.update(0.02);
  assert.ok(g.t - t0 >= 0.4 - 1e-9, 'the switch took its time');
  assert.deepEqual([L.which, h.canBlock], ['secondary', false], 'both hands: no block');
  assert.ok(h.damage > swordDamage);
  g.attackHeld = false;
  g.blockHeld = false;
  // Switch straight back: the sword is ready no sooner than it would have been (its cooldown ran on).
  CL.combat.update(0.02);
  while (h.swing) CL.combat.update(0.02);
  assert.equal(CL.gear.switchWeapon(g), true);
  while (CL.gear.switching(g)) CL.combat.update(0.02);
  assert.equal(L.which, 'primary');
  assert.ok(L.ready.primary <= t0 + left + 1e-9);
  assert.ok(h.attackCooldown >= Math.max(0, L.ready.primary - g.t) - 1e-9);
  assert.equal(h.damage, swordDamage);
  assert.equal(h.canBlock, true);
  // A weapon whose cooldown hasn't run out is not ready on arrival.
  CL.combat.startAttack(h);
  while (h.swing) CL.combat.update(0.02);
  CL.gear.switchWeapon(g);
  const readyAt = L.ready.primary;
  while (CL.gear.switching(g)) CL.combat.update(0.02);
  CL.gear.switchWeapon(g);
  while (CL.gear.switching(g)) CL.combat.update(0.02);
  assert.ok(g.t + h.attackCooldown >= readyAt - 1e-9, 'never ready sooner');
});

test('a battle starts in the loadout you prefer, and auto-resolve counts the hero in it', () => {
  const { CL } = game({ seed: 6 });
  const c = CL.campaign;
  c.inventory.test_greatsword = 1;
  CL.character.equip('test_greatsword', c, 'weapon2');
  c.loadout.start = 'secondary';
  CL.combat.startBattle({ id: 'sw', name: 'sw', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  assert.deepEqual([CL.game.loadout.which, CL.game.hero.profile.family, CL.game.hero.canBlock], ['secondary', 'greatsword', false]);
  // Auto-resolve counts the hero in that loadout too (the greatsword's damage, no shield).
  const p = CL.profile.resolve({ hero: c, equipment: CL.gear.kitFor(c, c.equipment, 'secondary') });
  assert.equal(p.canBlock, false);
  const both = ['primary', 'secondary'].map((start) => CL.autoresolve.heroPower({ ...c, loadout: { ...c.loadout, start } }));
  assert.notEqual(both[0], both[1], 'the loadout counts');
});
