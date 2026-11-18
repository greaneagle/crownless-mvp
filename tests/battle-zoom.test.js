// W-03: battle zoom. The camera's zoom (0.75×–1.5× on a large field, 1× on one screen) converts both
// ways exactly, culls by the zoomed view, keeps the hero central, is kept as a device setting, and
// changes no rule: what the company sees and how a battle goes are the same at every zoom.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const ZOOMS = [0.75, 1, 1.25, 1.5];
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** A battle on Open Country (a large field) with a mixed company; the enemy two screens away. */
function bigBattle(opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'hunter', 'hunter', 'hunter', 'rider']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [{ looter: 4, reaver: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  return { ...env, g: CL.game };
}

test('the zoom range: 0.75×–1.5× on a large field, 1× on a one-screen field; junk is clamped', () => {
  const { CL, g } = bigBattle();
  const C = CL.camera;
  assert.deepEqual({ ...C.zoomRange(g) }, { min: 0.75, max: 1.5 });
  assert.equal(C.setZoom(g, 0.5), 0.75);
  assert.equal(C.setZoom(g, 3), 1.5);
  assert.equal(C.setZoom(g, Number.NaN), 1);
  const small = loadGame();
  small.CL.combat.startBattle({ ...small.CL.content.encounter('captains_trial'), map: 'forest_clearing' });
  const sg = small.CL.game;
  assert.deepEqual({ ...small.CL.camera.zoomRange(sg) }, { min: 1, max: 1 });
  assert.equal(small.CL.camera.setZoom(sg, 0.75), 1, 'a one-screen field has nothing more to show');
  assert.deepEqual({ ...sg.camera }, { x: 0, y: 0, zoom: 1 });
});

test('toWorld is the exact inverse of toScreen at every zoom, and the view and culling follow it', () => {
  const { CL, g } = bigBattle();
  const C = CL.camera;
  for (const z of ZOOMS) {
    C.setZoom(g, z);
    for (const [x, y] of [
      [0, 0],
      [640.5, 333.25],
      [1500, 900],
    ]) {
      const s = C.toScreen(g, x, y);
      const w = C.toWorld(g, s.x, s.y);
      assert.ok(close(w.x, x, 1e-6) && close(w.y, y, 1e-6), `zoom ${z}: ${x},${y}`);
    }
    const v = C.view(g);
    assert.ok(close(v.w, CL.W / z) && close(v.h, CL.H / z), `zoom ${z}: the view is the canvas over the zoom`);
    // The canvas corners are the view's corners.
    const br = C.toWorld(g, CL.W, CL.H);
    assert.ok(close(br.x, v.x + v.w, 1e-6) && close(br.y, v.y + v.h, 1e-6));
    // Culling: a point just past the 1× view's right edge is drawn only when zoomed out.
    const p = { x: v.x + v.w + 5, y: v.y + v.h / 2 };
    assert.equal(C.visible(g, p.x, p.y, 0), false, `zoom ${z}: off screen`);
    assert.equal(C.visible(g, v.x + v.w - 5, p.y, 0), true);
  }
});

test('the hero stays in the middle at every zoom, and the view stops at the field edges', () => {
  const { CL, g } = bigBattle();
  const C = CL.camera;
  const { w, h } = C.worldSize(g.battleMap);
  for (const z of ZOOMS) {
    C.setZoom(g, z);
    Object.assign(g.hero, { x: w / 2, y: h / 2 });
    for (let i = 0; i < 200; i++) C.follow(g, 0.05);
    const s = C.toScreen(g, g.hero.x, g.hero.y);
    assert.ok(Math.abs(s.x - CL.W / 2) < 2 && Math.abs(s.y - CL.H / 2) < 2, `zoom ${z}: hero at ${s.x},${s.y}`);
    Object.assign(g.hero, { x: 10, y: 10 });
    for (let i = 0; i < 400; i++) C.follow(g, 0.05);
    assert.ok(close(g.camera.x, 0, 0.5) && close(g.camera.y, 0, 0.5), `zoom ${z}: stops at the corner`);
    Object.assign(g.hero, { x: w - 10, y: h - 10 });
    for (let i = 0; i < 400; i++) C.follow(g, 0.05);
    const v = C.view(g);
    assert.ok(close(v.x + v.w, w, 0.5) && close(v.y + v.h, h, 0.5), `zoom ${z}: and at the far corner`);
  }
});

test('what the company sees is judged at 1×: the same enemies are seen at every zoom', () => {
  const runs = ZOOMS.map((z) => {
    const { CL, g } = bigBattle();
    CL.camera.setZoom(g, z);
    // An enemy just beyond the 1× view, within the 0.75× one, and far from every soldier.
    const v = CL.camera.sightView(g);
    const e = g.enemies[0];
    Object.assign(e, { x: v.x + v.w + 120, y: v.y + v.h / 2 });
    CL.tactics.scan(g, 1);
    return Array.from(g.enemies, (x) => Boolean(x.seen));
  });
  for (const r of runs) assert.deepEqual(r, runs[1]);
  assert.equal(runs[1][0], false, 'not seen: it is only on screen when zoomed out');
});

test('a battle goes the same way at 0.75×, 1× and 1.5×', () => {
  const outcome = (z) => {
    const { CL, g } = bigBattle();
    CL.camera.setZoom(g, z);
    CL.combat.order('infantry', 'charge');
    CL.combat.order('archer', 'follow');
    CL.combat.order('cavalry', 'charge');
    for (let i = 0; i < 50 * 40 && g.mode === 'battle'; i++) {
      const h = g.hero;
      const e = g.enemies.filter((x) => x.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (e && h.alive) {
        const [dx, dy] = [e.x - h.x, e.y - h.y];
        const L = Math.hypot(dx, dy) || 1;
        g.joystick = L > 45 ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
        g.attackHeld = L < 70;
      }
      CL.combat.update(0.02);
    }
    const units = [g.hero, ...g.allies, ...g.enemies].map((u) => [u.alive, Math.round(u.hp * 1000), u.x.toFixed(4), u.y.toFixed(4), Boolean(u.seen)]);
    return JSON.stringify({ mode: g.mode, t: g.t.toFixed(4), units });
  };
  const at1 = outcome(1);
  assert.equal(outcome(0.75), at1);
  assert.equal(outcome(1.5), at1);
});

test('minimap and overview taps land on the same field spot at every zoom', () => {
  const { CL, g } = bigBattle();
  const T = CL.tactics;
  const mini = T.minimapRect(g);
  const spot = { x: mini.x + mini.w * 0.7, y: mini.y + mini.h * 0.3 };
  const looks = ZOOMS.map((z) => {
    CL.camera.setZoom(g, z);
    g.cameraFocus = null;
    assert.equal(T.tap(g, spot.x, spot.y), true, `zoom ${z}: the minimap takes the tap`);
    return [g.cameraFocus.x, g.cameraFocus.y];
  });
  for (const l of looks) assert.deepEqual(l, looks[0]);
});

test('the zoom button toggles 1× and 0.75× and the zoom is kept as a device setting for the next battle', () => {
  const { CL, g, storage } = bigBattle();
  const C = CL.camera;
  CL.settings.load();
  assert.equal(C.zoomOf(g), 1);
  assert.equal(C.toggleZoom(g), 0.75);
  assert.equal(JSON.parse(storage.data[CL.settings.KEY]).battleZoom, 0.75);
  assert.equal(C.toggleZoom(g), 1);
  C.setZoom(g, 1.4);
  assert.equal(C.toggleZoom(g), 0.75, 'from anything else, out to 0.75×');
  C.setZoom(g, 1.2);
  C.remember(g);
  // The next battle starts at the kept zoom.
  CL.combat.startBattle({ id: 't2', name: 't2', map: 'open_country', waves: [{ looter: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  assert.equal(C.zoomOf(CL.game), 1.2);
  storage.data[CL.settings.KEY] = JSON.stringify({ battleZoom: 'wide' });
  CL.settings.load();
  assert.equal(CL.settings.get('battleZoom'), 1);
});
