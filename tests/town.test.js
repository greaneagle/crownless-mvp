// Walkable Stonebridge (GDD §8; Gate D 4.2).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function inTown(opts) {
  const env = loadGame(opts);
  const { CL } = env;
  assert.equal(CL.town.enter('stonebridge'), true);
  return { ...env, t: CL.game.town };
}

const walk = (CL, keys, seconds) => {
  CL.game.hold = keys;
  for (let s = 0; s < seconds; s += 0.05) CL.town.update(0.05);
  CL.game.hold = {};
};

test('Stonebridge is a walkable town; other settlements stay menus', () => {
  const { CL, uiCalls } = loadGame();
  CL.world.leaveSettlement();
  CL.world.travelTo({ type: 'settlement', id: 'stonebridge', x: 50, y: 55 });
  assert.equal(CL.game.mode, 'town');
  assert.equal(CL.game.placeMode, 'town');
  CL.world.leaveSettlement();
  CL.world.travelTo({ type: 'settlement', id: 'eastwatch', x: 62, y: 40 });
  for (let i = 0; i < 400 && CL.game.travel; i++) CL.world.update(0.05);
  assert.equal(CL.game.mode, 'settlement');
  assert.equal(CL.town.hubFor('eastwatch'), null);
  assert.ok(uiCalls.some((x) => x[0] === 'changeMode' && x[1] === 'town'));
});

test('the hero walks with the battle controls and buildings block the way', () => {
  const { CL, t } = inTown();
  const x0 = t.hero.x;
  walk(CL, { KeyD: true }, 0.5);
  assert.ok(t.hero.x > x0 + 50);
  walk(CL, { KeyW: true }, 3); // straight up into the inn
  const inn = t.hub.obstacles.find((o) => o.label === 'The Grey Ford Inn');
  assert.equal(CL.units.inside(inn, t.hero.x, t.hero.y, CL.units.UNIT_RADIUS - 0.5), false);
  assert.ok(t.hero.y >= inn.y + inn.h, 'stopped at the wall');
});

test('pacing townsfolk walk their loop and pause at the ends', () => {
  const { CL, t } = inTown();
  const sgt = t.npcs.find((n) => n.id === 'sergeant');
  const xs = [];
  for (let i = 0; i < 200; i++) {
    CL.town.update(0.05);
    xs.push(sgt.x);
  }
  assert.ok(Math.max(...xs) >= sgt.pace[0] - 7, 'reached the far end');
  assert.ok(Math.min(...xs) <= sgt.home.x + 7, 'came back');
  assert.equal(t.npcs.find((n) => n.id === 'innkeeper').x, 220, 'the innkeeper stays put');
});

test('talking: in range, Space/TALK opens the person; each opens the right options', () => {
  const { CL, t } = inTown();
  assert.equal(CL.town.interact(), false, 'nobody within talking range of the spawn point');
  Object.assign(t.hero, { x: 220, y: 262 });
  CL.town.update(0.01);
  assert.equal(t.near.id, 'innkeeper');
  assert.equal(CL.town.interact(), true);
  assert.equal(CL.game.mode, 'talk');
  assert.equal(CL.game.talk.npc.action, 'tavern');
  assert.equal(CL.game.talk.line, 'A bed, a bowl and a fire. Sit, rest your feet.');
  CL.ui.changeMode('town');
  CL.town.interact();
  assert.match(CL.game.talk.line, /Eastwatch road/, 'next line next time');
});

test('tap a person to walk up and talk — even while they pace', () => {
  const { CL, t } = inTown();
  const sgt = t.npcs.find((n) => n.id === 'sergeant');
  CL.town.tap(sgt.x, sgt.y - 16);
  assert.equal(t.walkTo.npc, 'sergeant');
  for (let i = 0; i < 400 && CL.game.mode === 'town'; i++) CL.town.update(0.05);
  assert.equal(CL.game.mode, 'talk');
  assert.equal(CL.game.talk.npc.id, 'sergeant');
});

test('tap open ground to walk there; manual input cancels it', () => {
  const { CL, t } = inTown();
  CL.town.tap(300, 300);
  for (let i = 0; i < 100 && t.walkTo; i++) CL.town.update(0.05);
  assert.ok(Math.hypot(t.hero.x - 300, t.hero.y - 300) < 8);
  CL.town.tap(600, 300);
  CL.game.hold = { KeyS: true };
  CL.town.update(0.05);
  CL.game.hold = {};
  assert.equal(t.walkTo, null);
});

test('the gate guard and the exit lead back to the map', () => {
  const { CL, t } = inTown();
  t.walkTo = { x: 50, y: 298, npc: null };
  for (let i = 0; i < 100 && CL.game.mode === 'town'; i++) CL.town.update(0.05);
  assert.equal(CL.game.mode, 'map');
  assert.equal(CL.campaign.world.location, null);
  assert.equal(CL.game.town, null);

  const env2 = inTown();
  env2.CL.town.open(env2.t.npcs.find((n) => n.id === 'guard'));
  assert.equal(env2.CL.game.mode, 'map');
});

test('menus opened from town return to the streets; the classic menu is still there', () => {
  const { CL } = inTown();
  CL.ui.changeMode('trade');
  CL.town.backToPlace();
  assert.equal(CL.game.mode, 'town');
  CL.game.placeMode = 'settlement';
  CL.town.backToPlace();
  assert.equal(CL.game.mode, 'settlement');
});

test('town content is valid: every person stands clear of buildings, actions are known', () => {
  const { CL } = loadGame();
  for (const hub of Object.values(CL.content.table('town_hubs'))) {
    assert.ok(CL.content.get('settlements', hub.settlement).explorable);
    CL.game.battleMap = hub;
    for (const n of hub.npcs) {
      assert.ok(['trade', 'recruit', 'tavern', 'talk', 'leave'].includes(n.action), n.id);
      assert.equal(CL.units.blocked(n.x, n.y), false, `${n.id} inside a building`);
      if (n.pace) assert.equal(CL.units.blocked(...n.pace), false, `${n.id} paces into a building`);
    }
    assert.equal(CL.units.blocked(hub.spawn.x, hub.spawn.y), false, 'spawn clear');
  }
  assert.deepEqual(Array.from(CL.content.validate()), []);
});
