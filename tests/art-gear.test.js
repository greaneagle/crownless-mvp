// P11-04: the equipment you see. Every item's look is valid; the hero is drawn from the kit they carry
// (the weapon in hand by its family, the shield in hand or slung on the back, the helmet or a bare
// head); a switch in battle changes the look's signature and the look; companions and tournament
// fighters wear their gear; mounted is a state; the bake keys of a big battle stay bounded; a troop's
// look is checked against its family.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A 2D context that draws nothing and counts what it is asked to paint (and in what colours). */
function fakeCtx() {
  const calls = { fill: 0, stroke: 0, drawImage: 0, colours: new Set() };
  const gradient = { addColorStop() {} };
  const target = {
    calls,
    canvas: { width: 960, height: 540 },
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    fillText: () => calls.fill++,
    drawImage: () => calls.drawImage++,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') calls.colours.add(v);
      o[k] = v;
      return true;
    },
  });
}

/** A game whose art can bake (an offscreen canvas that draws nothing). */
function game(opts = {}) {
  const loaded = loadGame(opts);
  loaded.sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  return loaded;
}

const paint = (F, L, P = {}) => {
  const ctx = fakeCtx();
  F.figure(ctx, 0, 0, L, { t: 1, face: 'down', ...P });
  return ctx.calls;
};
const cost = (c) => c.fill + c.stroke;
const plain = (v) => JSON.parse(JSON.stringify(v)); // out of the game's sandbox, to compare

/** Test setup: a two-handed sword (the game sells none until P11-16) that needs nothing. */
const withGreatsword = (C) => {
  C.items.test_greatsword = { id: 'test_greatsword', name: 'Test Greatsword', type: 'weapon', slot: 'weapon', family: 'greatsword', tier: 2, rarity: 'uncommon', value: 120, weight: 4, stats: { damage: 28 }, req: {}, look: { weapon: 'greatsword' }, questItem: false };
};

test('every item has a valid look, and a pack’s piece without one gets a default', () => {
  const { CL } = game();
  const items = Object.values(CL.content.table('items')).filter((it) => it.slot);
  for (const it of items) {
    assert.deepEqual(plain(CL.content.checkItemLook(it, { weapon_families: CL.content.table('weapon_families') })), [], it.id);
    if (it.slot !== 'ring') assert.ok(Object.keys(CL.gfx.fig.itemLook(it.id)).length, `${it.id} is drawn`);
  }
  assert.deepEqual({ ...CL.gfx.fig.itemLook('knights_sword+2') }, { ...CL.content.item('knights_sword').look }, 'a forged piece wears its base’s');
  const C = { weapon_families: CL.content.table('weapon_families') };
  assert.match(CL.content.checkItemLook({ id: 'x', slot: 'head', look: { weapon: 'sword' } }, C)[0], /a head item's look can't say weapon/);
  assert.match(CL.content.checkItemLook({ id: 'x', slot: 'head', look: { helmet: 'tophat' } }, C)[0], /unknown helmet 'tophat'/);
  assert.match(CL.content.checkItemLook({ id: 'x', slot: 'weapon', family: 'axe', look: { weapon: 'spear' } }, C)[0], /a axe isn't drawn as a spear/);
  assert.match(CL.content.checkItemLook({ id: 'x', slot: 'weapon', family: 'sword', look: { weapon: 'sword', len: 3 } }, C)[0], /len between/);
  assert.deepEqual(plain(CL.content.checkItemLook({ id: 'x', slot: 'weapon', family: 'composite', look: { weapon: 'recurve' } }, C)), []);
  // A pack's piece with no look: from its family, or its slot.
  const { CL: P } = game({ content: (X) => {
    X.items.cairn_axe = { id: 'cairn_axe', family: 'greataxe', name: 'Cairn Axe', type: 'weapon', slot: 'weapon', tier: 2, rarity: 'uncommon', value: 90, weight: 4, stats: { damage: 26 }, req: {}, questItem: false };
    X.items.cairn_helm = { id: 'cairn_helm', name: 'Cairn Helm', type: 'armor', slot: 'head', tier: 3, rarity: 'rare', value: 90, weight: 2, stats: { armor: 3 }, questItem: false };
  } });
  assert.equal(P.gfx.fig.itemLook('cairn_axe').weapon, 'greataxe');
  assert.equal(P.gfx.fig.itemLook('cairn_helm').helmet, 'bascinet');
});

test('the hero is drawn from the kit: each weapon by its family, helmet or bare head, armour, gloves', () => {
  const { CL } = game({ content: withGreatsword });
  const F = CL.gfx.fig;
  const who = { cloak: 'forest', gender: 'woman' };
  const bare = paint(F, F.heroFrom(who, {}, { campaign: null }));
  for (const it of Object.values(CL.content.table('items')).filter((x) => x.slot === 'weapon' && !x.forgedFrom)) {
    const L = F.heroFrom(who, { weapon: it.id }, { campaign: null });
    assert.equal(L.weapon, it.look?.weapon || CL.content.table('weapon_families')[it.family].look, it.id);
    assert.ok(cost(paint(F, L)) > cost(bare), `${it.id}: the weapon is painted`);
  }
  // Nothing in the kit: fists, a bare head, plain clothes.
  const none = F.heroFrom(who, {}, { campaign: null });
  assert.deepEqual([none.weapon, none.shield, none.helmet, none.armour], [null, null, null, null]);
  assert.equal(none.cloak, F.CLOAKS.forest, 'who they are stays the creator’s');
  const full = F.heroFrom(who, { weapon: 'arming_sword', offhand: 'kite_shield', head: 'bascinet', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves', horse: 'courser' }, { campaign: null });
  assert.deepEqual([full.weapon, full.shield, full.helmet, full.armour, full.gloves, full.boots], ['sword', 'kite', 'bascinet', 'mail', '#9aa3ab', '#8a939b']);
  assert.equal(full.mount.coat, CL.content.item('courser').look.coat, 'the horse is in the look (drawn when mounted, P11-08)');
  assert.equal(F.heroFrom(who, { head: 'iron_helm' }, { campaign: null }).helmet, 'plumed', 'the hero’s own plume on a nasal helm');
  assert.equal(full.sig, 'arming_sword|on|bascinet|mail_hauberk|courser');
  // A piece whose requirement isn't met isn't worn (it stays with the baggage).
  const c = CL.campaign;
  c.character.attributes.str = 6;
  assert.equal(F.heroFrom(c.character, { ...c.equipment, body: 'mail_hauberk' }, { campaign: c }).armour, null);
  c.character.attributes.str = 7;
  assert.equal(F.heroFrom(c.character, { ...c.equipment, body: 'mail_hauberk' }, { campaign: c }).armour, 'mail');
});

test('a two-handed weapon slings the shield on the back, drawn in every facing; the other hand on the grip', () => {
  const { CL } = game({ content: withGreatsword });
  const F = CL.gfx.fig;
  const who = { cloak: 'crimson', gender: 'man' };
  const L = F.heroFrom(who, { weapon: 'test_greatsword', offhand: 'kite_shield' }, { campaign: null });
  assert.deepEqual([L.weapon, L.twoHanded, L.shield, L.shieldBack], ['greatsword', true, null, 'kite']);
  assert.equal(L.sig, 'test_greatsword|back|none|none|none');
  const flat = { ...L, shieldBack: null };
  for (const face of ['down', 'up', 'left', 'right']) assert.ok(cost(paint(F, L, { face })) > cost(paint(F, flat, { face })), `${face}: the slung shield shows`);
  // Two hands on the grip (P11-12b: the far arm is drawn in profile as v0.7 draws it; on a two-handed
  // weapon its hand is on the grip, behind the weapon hand).
  const wa = F.weaponArm(L, { face: 'right' }, 'right');
  const grip = [(wa.hx + Math.cos(wa.a) * (wa.ext - 3.5)) / F.K, (wa.hy + Math.sin(wa.a) * (wa.ext - 3.5)) / F.KY];
  const hands = (look) => {
    const at = [];
    const ctx = new Proxy({ ellipse: (x, y, rx) => rx === 3.7 && at.push([x, y]) }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true });
    F.figure(ctx, 0, 0, look, { face: 'right' });
    return at;
  };
  const onGrip = (pts) => pts.some(([x, y]) => Math.hypot(x - grip[0], y - grip[1]) < 0.01);
  assert.ok(onGrip(hands(L)) && !onGrip(hands({ ...L, twoHanded: false })), 'the other hand on the grip');
  // Its back faces the viewer from the front (the wood, not the device), its face from behind.
  const front = paint(F, L, { face: 'down' }).colours;
  const back = paint(F, L, { face: 'up' }).colours;
  assert.ok([...back].some((x) => !front.has(x)) || [...front].some((x) => !back.has(x)));
});

test('in battle: a switch changes the signature and the look; the loaner kit in a bout', () => {
  const { CL } = game({ content: withGreatsword });
  const c = CL.campaign;
  c.inventory.test_greatsword = 1;
  CL.character.equip('test_greatsword', c, 'weapon2');
  c.equipment.offhand = 'oak_shield';
  CL.combat.startBattle('captains_trial');
  const g = CL.game;
  const B = CL.gfx.battle;
  const first = B.lookOf(g.hero);
  assert.equal(first.shield, 'wood');
  assert.equal(B.lookOf(g.hero), first, 'kept while the loadout is the same');
  assert.ok(CL.gear.switchWeapon(g));
  assert.equal(B.lookOf(g.hero), first, 'still the first weapon while drawing the other');
  g.t += 1;
  CL.gear.tick(g);
  const second = B.lookOf(g.hero);
  assert.notEqual(second, first);
  assert.deepEqual([second.weapon, second.shield, second.shieldBack], ['greatsword', null, 'wood']);
  assert.notEqual(second.key, first.key, 'baked apart');
  // A tournament bout: the hero and the opponent in the loaner kit (its helm and gambeson).
  const { CL: T } = game();
  const kit = { ...T.content.get('tournaments', 'lists').kit };
  T.combat.startBattle({ id: 'tourney_bout', name: 'lists', map: 'tourney_lists', waves: [{ mercenary: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, duel: { opponent: { name: 'Ser Halvard', troop: 'mercenary', hp: 90, damage: 9, armor: 3 }, kit } });
  const hero = T.gfx.battle.lookOf(T.game.hero);
  assert.deepEqual([hero.weapon, hero.shield, hero.helmet, hero.armour], ['sword', 'kite', 'plumed', 'gambeson']);
  const foe = T.gfx.battle.lookOf(T.game.enemies[0]);
  assert.deepEqual([foe.weapon, foe.shield, foe.armour], ['sword', 'kite', 'gambeson']);
  assert.equal(foe.helmet, 'plumed', 'the nasal helm with their own plume');
});

test('companions wear their gear over their own look; the portrait follows the helmet', () => {
  const { CL } = game();
  const F = CL.gfx.fig;
  const own = F.companionLook('mara', 'valedorn');
  const geared = F.companionLook('mara', 'valedorn', { weapon: 'war_mace', body: 'mail_hauberk', head: null });
  assert.deepEqual([geared.weapon, geared.armour], ['mace', 'mail']);
  assert.equal(geared.helmet, own.helmet, 'no helmet carried: their own hood');
  const ch = CL.campaign.character;
  assert.equal(CL.gfx.ui.heroLook(ch, { ...CL.campaign.equipment, head: 'bascinet' }, { campaign: null }).helmet, 'bascinet');
  assert.equal(CL.gfx.ui.heroLook(ch, { ...CL.campaign.equipment, head: null }, { campaign: null }).helmet, null, 'a bare head');
});

test('mounted is a state: cavalry troops ride (as before), nobody else; the hero walks', () => {
  const { CL } = game();
  const rider = CL.units.makeUnit(0, 0, 'enemy', 'rider');
  const foot = CL.units.makeUnit(0, 0, 'enemy', 'footman');
  assert.deepEqual([CL.units.mounted(rider), CL.units.mounted(foot)], [true, false]);
  assert.deepEqual({ ...rider.mount }, { ...CL.content.troop('rider').look.mount });
  CL.combat.startBattle('captains_trial');
  assert.equal(CL.units.mounted(CL.game.hero), false, 'the hero rides from P11-08');
  for (const t of Object.values(CL.content.table('troops'))) if (t.role !== 'hero') assert.equal(CL.units.mounted(CL.units.makeUnit(0, 0, 'ally', t.id)), t.role === 'cavalry', t.id);
});

test('a big battle of every realm, with switches: the bake keys stay under 3,000', () => {
  const { CL } = game({ content: withGreatsword });
  const c = CL.campaign;
  c.inventory.test_greatsword = 1;
  CL.character.equip('test_greatsword', c, 'weapon2');
  CL.render = { busyBattle: () => true, bodyAlpha: () => 0.6, BUSY: { hurt: 0.5 } }; // a big battle bakes its blows too (js/render.js isn't loaded here)
  const keys = new Set();
  const real = CL.gfx.cached;
  CL.gfx.cached = (key, ...rest) => {
    if (key.startsWith('u:')) keys.add(`${key}@${rest[0]}`);
    return real(key, ...rest);
  };
  const troops = Object.values(CL.content.table('troops')).filter((t) => t.role !== 'hero');
  const realms = [...new Set(troops.map((t) => t.faction))];
  let fights = 0;
  for (const f of realms) {
    const def = CL.debugTools.benchDef(200);
    const mine = troops.filter((t) => t.faction === f).map((t) => t.id);
    const wave = {};
    for (let i = 0; i < 100; i++) wave[mine[i % mine.length]] = (wave[mine[i % mine.length]] || 0) + 1;
    CL.combat.startBattle({ ...def, waves: [wave], faction: f === 'neutral' ? undefined : f });
    const g = CL.game;
    g.godMode = true;
    const all = { x: 0, y: 0, ...(({ w, h }) => ({ w, h }))(CL.camera.worldSize(g.battleMap)) };
    // 30 s: the sides meet (about 20 s in on this field) and fight, every blow baked; a switch every 2 s.
    for (let i = 0; i < 900; i++) {
      CL.combat.update(1 / 30);
      if (i % 60 === 0) CL.gear.switchWeapon(g);
      if (i % 2 === 0) CL.gfx.battle.draw(fakeCtx(), g, all, 1.33);
    }
    fights += [...g.allies, ...g.enemies].filter((u) => !u.alive).length;
  }
  assert.ok(keys.size > 100, `the battles were drawn (${keys.size})`);
  assert.ok(fights > 10, `and fought (${fights} fell)`);
  assert.ok(keys.size < 3000, `${keys.size} bake keys`);
  if (process.env.SHOW_KEYS) console.log('bake keys', keys.size, 'realms', realms.length, 'fell', fights);
});

test('a troop’s look is checked against its profile’s family (not its shot’s speed or its reach)', () => {
  const { CL } = game();
  const agree = (id, look, extra = {}) => plain(CL.content.lookAgrees({ ...CL.content.troop(id), ...extra, look: { ...CL.content.troop(id).look, ...look } }));
  assert.deepEqual(agree('hunter', {}), []);
  assert.ok(agree('hunter', { weapon: 'sword' }).some((e) => /a shortbow is drawn as bow, not sword/.test(e)));
  assert.ok(agree('footman', { weapon: 'bow' }).some((e) => /only a family that shoots/.test(e)));
  assert.ok(agree('footman', { weapon: 'spear' }).some((e) => /a sword isn't drawn as a spear, pike or lance/.test(e)));
  // A crossbow by its family whatever its shot's speed; an arbalest is a crossbow.
  const xbow = Object.values(CL.content.table('troops')).find((t) => CL.profile.troopWeapon(t) === 'crossbow');
  assert.deepEqual(agree(xbow.id, { weapon: 'arbalest' }, { ranged: { ...xbow.ranged, projectileSpeed: 200 } }), []);
  assert.deepEqual(plain(CL.content.validate()), []);
});
