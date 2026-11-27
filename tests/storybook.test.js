// P11-12b (D-P11m): the storybook character system and the Stonebridge slice. The approved v0.7 rules the
// tests can see: no ear in a profile (the front keeps its small ears), every look part and item draws in
// every facing and pose (on foot and mounted), one set of features for the figure and the portrait, the
// street figure and the dialogue portrait the same person, the hero's face from their name, and the towns'
// layouts exactly as they were (P11-12c will turn the other seven; their geometry is pinned here too).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { loadGame } = require('./helpers/load');

/** A 2D context that draws nothing and records ellipses and the colours it is asked for. */
function recCtx() {
  const calls = { fill: 0, stroke: 0, ellipses: [], colours: new Set() };
  const gradient = { addColorStop() {} };
  const target = {
    calls,
    canvas: { width: 960, height: 540 },
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    fillText: () => calls.fill++,
    ellipse: (x, y, rx, ry) => calls.ellipses.push([x, y, rx, ry]),
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

/** The small ears of the front view: ellipses of about 3 × 4.4 units beside the jaw. */
const ears = (calls) => calls.ellipses.filter(([, y, rx, ry]) => Math.abs(y + 76) < 0.01 && rx >= 2.6 && rx <= 3.1 && ry >= 4.1 && ry <= 4.5).length;

test('no ear in a profile: east and west draw none, the front its two small ones', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  for (const L of [F.heroLook(), F.townLook('merchant', 3), F.townLook('innkeeper', 4), F.troopLook('footman', 'valedorn', 2)]) {
    for (const face of ['left', 'right']) {
      const ctx = recCtx();
      F.figure(ctx, 0, 0, { ...L, helmet: null, hat: null }, { face, t: 1 });
      assert.equal(ears(ctx.calls), 0, `${face}: no ear`);
    }
    const front = recCtx();
    F.figure(front, 0, 0, { ...L, helmet: null, hat: null }, { face: 'down', t: 1 });
    assert.equal(ears(front.calls), 2, 'the front shows two small ears');
  }
});

test('every helmet, hat, weapon, shield and armour draws in every facing and pose, on foot and mounted', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  const V = CL.content.LOOK;
  const poses = [{}, { move: 1, walk: 1.2 }, { atk: { phase: 'windup', k: 0.4 } }, { atk: { phase: 'active', k: 0.5 } }, { atk: { phase: 'recovery', k: 0.6 } }, { guard: true }, { guard: true, press: 0.6 }, { broken: true }, { stagger: 0.5 }, { draw: 0.8 }, { draw: 1, shot: 0.5 }, { hit: 0.7 }, { talk: 0.6 }, { work: true }];
  const base = { tunic: '#8a7a5a', seed: 5 };
  for (const [part, values] of Object.entries({ armour: V.armour, helmet: V.helmet, hat: V.hat, shield: V.shield, weapon: V.weapon })) {
    for (const v of values) {
      for (const face of ['down', 'up', 'left', 'right']) {
        for (const P of poses) {
          const ctx = recCtx();
          F.figure(ctx, 0, 0, { ...base, [part]: v }, { face, t: 1, ...P });
          assert.ok(ctx.calls.fill > 10, `${part} ${v} ${face}`);
        }
        const m = recCtx();
        F.horse(m, 0, 0, { coat: '#8a5a3a', cloth: 'valedorn' }, { face, t: 1, move: 1, walk: 2 }, () => F.figure(m, 0, 0, { ...base, [part]: v }, { face, t: 1, mounted: true }));
        assert.ok(m.calls.fill > 20, `${part} ${v} ${face} mounted`);
      }
    }
  }
  // A two-handed grip, a slung shield, a quiver, gloves, a dress, a cloak with its trim, a crown.
  for (const extra of [{ weapon: 'greatsword', twoHanded: true, shieldBack: 'kite' }, { weapon: 'bow', quiver: true, shieldBack: 'round' }, { gloves: '#6a4a30' }, { dress: true, female: true, apron: '#efe6d2' }, { cloak: '#355783', cloakTrim: '#d8b25a' }, { crown: true, helmet: 'nasal' }]) {
    for (const face of ['down', 'up', 'left', 'right']) {
      const ctx = recCtx();
      F.figure(ctx, 0, 0, { ...base, ...extra }, { face, t: 1 });
      assert.ok(ctx.calls.fill > 8, `${JSON.stringify(extra)} ${face}`);
    }
  }
});

test('one person: the figure and the portrait share their features; the face follows the seed, never the frame', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  const L = F.townLook('merchant', 11);
  assert.deepEqual(F.features(L), F.features({ ...L }), 'features by the look, not the object');
  assert.notDeepEqual(F.features(F.townLook('merchant', 11)), F.features(F.townLook('merchant', 12)));
  const eyes = F.features(L).eyes;
  const body = recCtx();
  F.figure(body, 0, 0, L, { face: 'down', t: 0 });
  const bust = recCtx();
  CL.gfx.ui.portrait(bust, 0, 0, 64, L);
  assert.ok(body.calls.colours.has(eyes) && bust.calls.colours.has(eyes), 'the same eyes in both');
  // A woman never gets a beard from her features.
  assert.equal(F.features({ ...L, female: true, beard: '#333333' }).beardKind, 0);
  // The hero's face comes from their name, in the figure and the portrait alike.
  const ch = { cloak: 'forest', gender: 'man', name: 'Aldo' };
  const hero = F.heroFrom(ch, { weapon: 'worn_sword' }, { campaign: null });
  assert.deepEqual(hero.face, CL.gfx.ui.heroLook(ch, { weapon: 'worn_sword' }, { campaign: null }).face);
});

test('the street figure and the dialogue portrait are the same person', () => {
  const { CL } = loadGame();
  const hub = CL.content.table('town_hubs').stonebridge;
  for (const n of hub.npcs) {
    const street = CL.gfx.town.personLook(n, 'valedorn');
    const talk = CL.gfx.ui.speakerLook(n, CL.campaign);
    for (const k of ['skin', 'hair', 'hairStyle', 'female', 'tunic', 'seed']) assert.deepEqual(talk[k], street[k], `${n.id} ${k}`);
    assert.deepEqual(CL.gfx.fig.features(talk), CL.gfx.fig.features(street), `${n.id} features`);
  }
  // The data's women are drawn as women, in a dress unless armoured.
  const hilde = CL.gfx.town.personLook(hub.npcs.find((n) => n.id === 'innkeeper'), 'valedorn');
  assert.equal(hilde.female, true);
  assert.equal(hilde.dress, true);
});

test('every town in the storybook look (P11-12c), its layout exactly as in 5.11', () => {
  const { CL } = loadGame();
  const hubs = CL.content.table('town_hubs');
  for (const [id, h] of Object.entries(hubs)) assert.notEqual(h.art, 'classic', `${id} in the storybook look`);
  assert.equal(CL.gfx.building, CL.gfx.story.building, 'the kit draws the storybook buildings');
  // Footprints, collision, spawns, exits, NPC anchors and streets, fingerprinted at 5.11.0 (ff54781).
  const AT_5_11 = { stonebridge: '9be2fa6461de', eastwatch: '1ad69e8b6f05', hrothgard: '20a9339f59ae', vessara: 'd8543b7db2d4', merrow: '74de2e85dbf4', gullhaven: 'b889f38c0489', harrowgate: '2e4201b6b743', calder: '100176af44bc' };
  for (const h of Object.values(hubs)) {
    const geo = { obs: h.obstacles.map((o) => [o.shape, o.x, o.y, o.w, o.h, o.r, !!o.blocksArrows]), spawn: h.spawn, exit: h.exitZone, npcs: h.npcs.map((n) => [n.id, n.x, n.y, n.pace || null, n.action]), spots: h.spots || null, roads: h.ground?.roads || null, plaza: h.ground?.plaza || null };
    assert.equal(crypto.createHash('sha1').update(JSON.stringify(geo)).digest('hex').slice(0, 12), AT_5_11[h.id], `${h.id}: geometry unchanged`);
  }
});

test('Stonebridge draws in the storybook kit, by day and night, and the drawing changes nothing', () => {
  const loaded = loadGame();
  const { CL } = loaded;
  loaded.sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recCtx() }) };
  CL.campaign.world.location = 'stonebridge';
  assert.equal(CL.town.enter('stonebridge'), true);
  const t = CL.game.town;
  const before = JSON.stringify({ hero: [t.hero.x, t.hero.y], npcs: t.npcs.map((n) => [n.x, n.y]) });
  for (const night of [0, 0.5, 1]) {
    const ctx = recCtx();
    CL.gfx.town.draw(ctx, t, { night });
    assert.ok(ctx.calls.fill > 400, `night ${night}: the streets draw`);
    assert.ok([...ctx.calls.colours].includes(night > 0.3 ? CL.gfx.story.SPAL.glassLit : CL.gfx.story.SPAL.glass), 'the storybook windows');
  }
  assert.equal(JSON.stringify({ hero: [t.hero.x, t.hero.y], npcs: t.npcs.map((n) => [n.x, n.y]) }), before);
});

test('a neck in every view (owner, 2026-11-27): its shaded side shows from the front, the back and the sides', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  for (const L of [F.heroLook(), F.townLook('innkeeper', 4), F.troopLook('footman', 'valedorn', 2)]) {
    const shade = CL.gfx.tone(L.skin, -0.14);
    for (const face of ['down', 'up', 'left', 'right']) {
      const ctx = recCtx();
      F.figure(ctx, 0, 0, { ...L, helmet: null }, { face, t: 1 });
      assert.ok(ctx.calls.colours.has(shade), `${face}: the neck`);
    }
  }
});
