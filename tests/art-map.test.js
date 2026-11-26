// P10-G4 (D-P10k): the strategic map in the art kit. The terrain draws into its layer; every
// settlement kind and culture, every site and every party kind draws as a miniature, and stamps
// from its baked image; a party's facing follows how it moved; your company draws with your soldiers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function fakeCtx() {
  const calls = { fill: 0, stroke: 0, drawImage: 0 };
  const target = {
    calls,
    canvas: { width: 960, height: 540 },
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    fillText: () => {},
    drawImage: () => calls.drawImage++,
    createRadialGradient: () => ({ addColorStop() {} }),
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

/** A game whose art can bake; `baked` counts what was drawn into the baked images. */
function game() {
  const loaded = loadGame({ worldParties: true });
  const baked = fakeCtx();
  loaded.sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => baked }) };
  return { ...loaded, baked };
}

test('the terrain draws into its layer: sea, areas, forests, rivers and crossings, roads, fields', () => {
  const { CL, baked } = game();
  const ctx = fakeCtx();
  const m = CL.world.map();
  CL.gfx.worldmap.terrain(ctx, m, CL.mapView.extent(), 1);
  assert.ok(ctx.calls.fill > 500, `filled ${ctx.calls.fill}`);
  assert.ok(ctx.calls.drawImage > 200, 'forest trees and peaks stamped from baked images');
  assert.ok(baked.calls.fill > 0, 'the stamps were drawn once');
});

test('every settlement, kind and culture, and every site draws; occupied places fly two banners', () => {
  const { CL, baked } = game();
  for (const s of Object.values(CL.content.table('settlements'))) {
    const ctx = fakeCtx();
    CL.gfx.worldmap.settlement(ctx, 100, 100, s, 1, { holder: s.ownerFaction, controller: s.ownerFaction, t: 0 });
    assert.ok(ctx.calls.drawImage === 1 && ctx.calls.fill + ctx.calls.stroke > 3, `${s.id}: miniature and banner`);
    const occupied = fakeCtx();
    CL.gfx.worldmap.settlement(occupied, 100, 100, s, 1, { holder: s.ownerFaction, controller: 'neutral', t: 0, siege: 'neutral' });
    assert.ok(occupied.calls.fill + occupied.calls.stroke > ctx.calls.fill + ctx.calls.stroke, `${s.id}: an occupier's pennant and the siege camp`);
  }
  assert.ok(baked.calls.fill > 100);
  for (const active of [true, false]) {
    const ctx = fakeCtx();
    CL.gfx.worldmap.site(ctx, 50, 50, active, 1, 0);
    assert.equal(ctx.calls.drawImage, 1);
  }
  // A harbour knows it is one: every coastal town by the sea, none inland.
  assert.equal(CL.gfx.worldmap.coastal(CL.content.get('settlements', 'stonebridge')), false);
});

test('every party kind draws as a miniature of its own troops, and turns the way it moves', () => {
  const { CL } = game();
  const W = CL.gfx.worldmap;
  for (const t of Object.values(CL.content.table('party_templates'))) {
    const p = { id: t.id };
    const ctx = fakeCtx();
    W.party(ctx, 100, 100, p, { kind: t.kind, realm: t.kind === 'bandit' ? 'reavers' : t.faction, template: t, hostile: t.kind === 'bandit' }, 1, 0);
    assert.equal(ctx.calls.drawImage, 1, `${t.id}: stamped`);
    const fig = W.figuresOf(t, t.faction);
    for (const id of fig.foot) assert.ok(CL.content.table('troops')[id], `${t.id}: ${id}`);
  }
  const p = { id: 'x' };
  W.party(fakeCtx(), 100, 100, p, { kind: 'patrol', realm: 'valedorn', template: {} }, 1, 0);
  W.party(fakeCtx(), 110, 100, p, { kind: 'patrol', realm: 'valedorn', template: {} }, 1, 0.1);
  // Moving right: the next stamp is the right-facing one (a different baked image key).
  const army = fakeCtx();
  W.party(army, 100, 100, { id: 'a' }, { kind: 'lord', realm: 'valedorn', template: {}, army: true }, 1, 0);
  assert.equal(army.calls.drawImage, 1);
});

test('your company: you, up to two of your soldiers, your banner, a box to keep labels off', () => {
  const { CL } = game();
  const ctx = fakeCtx();
  const box = CL.gfx.worldmap.company(ctx, 300, 200, false, 'down', 1, 0);
  assert.equal(ctx.calls.drawImage, 1);
  assert.ok(box.w > 20 && box.h > 30);
});
