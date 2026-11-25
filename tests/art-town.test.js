// P10-G3 (D-P10k): the walkable towns in the art kit. Every town draws by day and at night; each building
// is drawn from a spec inside its own footprint, and the footprint still stops a walker; every person is
// drawn from their role (a woman as one), stands clear of the buildings and talks; the story's cast takes
// a role or a companion's look, never a sprite.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function fakeCtx() {
  const calls = { fill: 0, stroke: 0, drawImage: 0, text: [] };
  const target = {
    calls,
    canvas: { width: 960, height: 540 },
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    fillText: (t) => calls.text.push(t),
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

const hubs = (CL) => Object.values(CL.content.table('town_hubs'));
const BUILDINGS = ['tavern', 'barracks', 'house'];

test('every town draws by day and at night, with no sprite and its people labelled when near', () => {
  const { CL } = loadGame();
  for (const hub of hubs(CL)) {
    CL.campaign.world.location = hub.settlement;
    assert.equal(CL.town.enter(hub.settlement), true, hub.id);
    const t = CL.game.town;
    for (const night of [0, 1]) {
      const ctx = fakeCtx();
      CL.gfx.town.draw(ctx, t, { night, font: (px) => `bold ${px}px Georgia` });
      assert.ok(ctx.calls.fill > 200, `${hub.id} draws`);
      assert.equal(ctx.calls.drawImage, 0, `${hub.id}: no sprite`);
      assert.ok(ctx.calls.text.some((s) => /To the road/.test(s)), `${hub.id}: the way out`);
    }
    // Next to someone, their name and how to talk to them show.
    const n = t.npcs[0];
    Object.assign(t.hero, { x: n.x + 20, y: n.y });
    t.near = n;
    const ctx = fakeCtx();
    CL.gfx.town.draw(ctx, t, { night: 0, verbs: { trade: 'Trade', recruit: 'Hire troops', tavern: 'Inn', talk: 'Talk', leave: 'Leave town' } });
    assert.ok(ctx.calls.text.some((s) => s.startsWith(`${n.name} — TALK:`)), hub.id);
  }
});

test('each building is drawn from a spec inside its footprint, and the footprint stops a walker', () => {
  const { CL } = loadGame();
  for (const hub of hubs(CL)) {
    CL.town.enter(hub.settlement);
    const C = CL.gfx.town.culture(hub);
    hub.obstacles.filter((o) => BUILDINGS.includes(o.look)).forEach((o, i) => {
      const b = CL.gfx.town.specOf(o, i, C, hub);
      assert.ok(Math.abs(b.x - (o.x + o.w / 2)) < 0.5 && Math.abs(b.y - (o.y + o.h)) < 0.5 && b.w === o.w, `${hub.id} ${o.label || i}: on its footprint`);
      assert.ok(b.h + b.d <= o.h + 0.5, `${hub.id} ${o.label || i}: no taller than its footprint`);
      if (o.spec) for (const [k, v] of Object.entries(o.spec)) assert.deepEqual(b[k], v, `${hub.id} ${o.label}: its spec's ${k}`);
      // Walking at its front door from the street, a step at a time, stops at the wall (a building whose
      // front is past the walkable edge has no street before it).
      if (o.y + o.h + 12 > CL.units.BOUNDS.maxY) return;
      const u = CL.units.makeUnit(o.x + o.w / 2, Math.min(o.y + o.h + 20, 489), 'ally', 'hero');
      for (let k = 0; k < 60; k++) {
        u.y -= 4;
        CL.units.resolveObstacles(u);
      }
      assert.ok(u.y >= o.y + o.h + 11, `${hub.id} ${o.label || i}: a walker stops at the wall (${Math.round(u.y)} vs ${o.y + o.h})`);
    });
    // A landmark in every town but the harbour of warehouses.
    if (hub.id !== 'gullhaven') assert.ok(hub.obstacles.some((o) => o.spec?.tower || o.spec?.form === 'long'), `${hub.id} has a landmark`);
  }
});

test('every person is drawn from their role, stands clear of the buildings, and talks', () => {
  const { CL } = loadGame();
  for (const hub of hubs(CL)) {
    CL.campaign.world.location = hub.settlement;
    CL.town.enter(hub.settlement);
    const t = CL.game.town;
    for (const n of t.npcs) {
      assert.equal(n.frames, undefined, `${hub.id} ${n.id}: no sprite frames`);
      const L = CL.gfx.town.personLook(n, 'valedorn');
      assert.equal(L.female, n.gender === 'female', `${hub.id} ${n.id}: ${n.gender || 'a man'}`);
      for (const o of hub.obstacles) {
        const inside = o.shape === 'circle' ? Math.hypot(n.x - o.x, n.y - o.y) < o.r : n.x > o.x && n.x < o.x + o.w && n.y > o.y && n.y < o.y + o.h;
        assert.equal(inside, false, `${hub.id} ${n.id} stands clear of ${o.label || o.look || 'a wall'}`);
      }
      // Standing beside them, the hero talks to them.
      Object.assign(t.hero, { x: n.x + 10, y: n.y });
      CL.town.update(0.016);
      if (t.near === n) {
        assert.equal(CL.town.interact(), true, `${hub.id} ${n.id} talks`);
        CL.game.mode = 'town';
        CL.game.talk = null;
      }
    }
  }
});

test('the story’s cast in the streets: a role or a companion’s look, a woman as one, never sprite frames', () => {
  const { CL } = loadGame();
  for (const f of Object.values(CL.content.table('factions'))) {
    for (const k of ['agent', 'caravan']) {
      const p = f.story?.[k];
      if (!p) continue;
      assert.equal(p.frames, undefined, `${f.id} ${k}`);
      assert.ok(CL.gfx.fig.ROLE_LOOKS[CL.gfx.town.ROLE_LOOK[p.role] || p.role], `${f.id} ${k}: role ${p.role}`);
    }
  }
  const mara = CL.content.table('dialogue').mara;
  assert.deepEqual({ ...CL.story.lookOf(mara) }, { tag: 'Scout', role: 'townsman', companion: 'mara', gender: null });
});
