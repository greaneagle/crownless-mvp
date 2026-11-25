// P10-G2 (D-P10k): battles in the art kit. Every battle map, arena and the assault draws; each unit is
// drawn from its look on its side (the hero, companions, lords, tournament fighters); standing soldiers
// are baked frames and the drawing never changes a unit; a big battle bakes its blows too.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A 2D context that draws nothing and counts what it is asked to paint. */
function fakeCtx() {
  const calls = { fill: 0, stroke: 0, drawImage: 0 };
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
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  });
}

/** A game whose art can bake (an offscreen canvas that draws nothing). */
function game() {
  const loaded = loadGame();
  loaded.sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  return loaded;
}

const view = (m) => ({ x: 0, y: 0, w: m.width || 960, h: m.height || 540 });

test('every battle map, arena and assault draws: ground, obstacles, the painted minimap', () => {
  const { CL } = game();
  const maps = Object.values(CL.content.table('battle_maps')).map((m) => (m.generate ? CL.arena.build(m) : m));
  maps.push(CL.arena.assault({ ladders: 3 }), CL.arena.assault({ defend: true, gateOpen: true }));
  for (const m of maps) {
    const ctx = fakeCtx();
    CL.gfx.battle.ground(ctx, m, view(m), 1);
    for (const o of m.obstacles) CL.gfx.battle.obstacle(ctx, o, 1, CL.game);
    assert.ok(ctx.calls.fill > m.obstacles.length, m.id);
    assert.ok(CL.gfx.battle.miniature(m), `${m.id} minimap`);
  }
});

test('a battle draws in the kit; the drawing never changes a unit; standing soldiers are baked frames', () => {
  const { CL } = game();
  CL.combat.startBattle('captains_trial');
  const g = CL.game;
  const before = JSON.stringify([g.hero, ...g.allies, ...g.enemies].map((u) => ({ ...u, target: null, hitBy: null, swing: u.swing })));
  const ctx = fakeCtx();
  const all = { x: 0, y: 0, ...(({ w, h }) => ({ w, h }))(CL.camera.worldSize(g.battleMap)) }; // the whole field in view
  CL.gfx.battle.draw(ctx, g, all, 1.33);
  CL.gfx.battle.draw(ctx, g, all, 1.33);
  assert.equal(JSON.stringify([g.hero, ...g.allies, ...g.enemies].map((u) => ({ ...u, target: null, hitBy: null, swing: u.swing }))), before);
  const standing = [...g.allies, ...g.enemies].filter((u) => !u.ranged && !u.swing && !u.guard && !(u.flash > 0)).length;
  assert.ok(standing > 0 && ctx.calls.drawImage >= standing * 2, 'standing soldiers stamped from baked frames');
  // A blow in a small battle is drawn live, in its real phase.
  const e = g.enemies[0];
  e.swing = { t: 0.2, hit: [] };
  const live = fakeCtx();
  CL.gfx.battle.unit(live, e, 1, 1.33, false);
  assert.ok(live.calls.drawImage === 0 && live.calls.fill > 10, 'drawn part by part');
});

test('each side in its colours; the hero, companions, lords and tournament fighters by their own looks', () => {
  const { CL } = game();
  CL.companion.join(CL.campaign, 'mara');
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ footman: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, leader: { troop: 'footman', name: 'Lord Edric', hp: 2, damage: 1.2 }, faction: 'valedorn' });
  const g = CL.game;
  const B = CL.gfx.battle;
  assert.equal(B.lookOf(g.hero).plume, CL.gfx.PAL.gold);
  assert.equal(B.lookOf(g.hero).cloak, CL.gfx.fig.CLOAKS[CL.campaign.character.cloak]);
  const mara = g.allies.find((u) => u.companion === 'mara');
  assert.equal(B.lookOf(mara).helmet, 'hood');
  const lord = g.enemies.find((u) => u.named);
  assert.ok(lord && B.lookOf(lord).lord && B.lookOf(lord).plume === CL.gfx.PAL.gold);
  assert.equal(B.lookOf(g.enemies.find((u) => !u.named)).tabard, 'valedorn');
  assert.equal(B.sides(g).allySide, 'player'); // not sworn: the company's own banner
  const duel = game().CL;
  duel.combat.startBattle({ id: 'tourney_bout', name: 'lists', map: 'tourney_lists', waves: [{ mercenary: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, duel: { opponent: { name: 'Ser Halvard', troop: 'mercenary', hp: 90, damage: 9, armor: 3 }, kit: { weapon: 'arming_sword' } } });
  const L = duel.gfx.battle.lookOf(duel.game.enemies[0]);
  assert.equal(L.helmet, 'plumed');
  assert.equal(typeof L.tabard, 'object');
});

test('a big battle bakes blows too, a few steps to each phase, never off the real phase', () => {
  const { CL } = game();
  CL.combat.setActiveCap(100);
  CL.combat.startBattle(CL.debugTools.benchDef(100));
  const g = CL.game;
  assert.equal(CL.render?.busyBattle?.() ?? CL.combat.BATTLE.activeCap > 80, true);
  const u = g.allies.find((x) => x.role === 'infantry');
  u.swing = { t: 0.05, hit: [] }; // windup
  const ctx = fakeCtx();
  CL.render = { ...(CL.render || {}), busyBattle: () => true, bodyAlpha: () => 0.5, BUSY: { hurt: 0.5 } };
  CL.gfx.battle.lookOf(u); // the battle's state, as its first frame would make it
  CL.gfx.battle.unit(ctx, u, 1, 1.33, false);
  assert.equal(ctx.calls.drawImage, 1, 'stamped');
  assert.ok(ctx.calls.fill < 10, 'not drawn part by part');
});
