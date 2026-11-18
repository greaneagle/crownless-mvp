// W-02: the world-map camera (CL.mapView). Exact conversions, hit-testing and clamping at every zoom,
// 2.0's projection at 1×, centring below "fit", and zoom-independence: the same journey and the same
// contacts whatever the view.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const ZOOMS = [1, 1.3, 1.6, 2, 2.4];
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** Put the camera somewhere: a zoom and a map point to look at (clamped as the game would). */
function look(CL, zoom, cx = 50, cy = 50) {
  Object.assign(CL.mapView.state, { zoom, cx, cy, following: false });
  CL.mapView.clamp();
}

test('toMap is the exact inverse of toScreen at every zoom and pan', () => {
  const { CL } = loadGame();
  const V = CL.mapView;
  for (const z of ZOOMS) {
    for (const [cx, cy] of [
      [50, 50],
      [10, 90],
      [85, 20],
    ]) {
      look(CL, z, cx, cy);
      for (const [mx, my] of [
        [0, 0],
        [37.5, 61.25],
        [100, 100],
      ]) {
        const [sx, sy] = V.toScreen(mx, my);
        const [bx, by] = V.toMap(sx, sy);
        assert.ok(close(bx, mx) && close(by, my), `zoom ${z} at ${cx},${cy}: ${mx},${my} → ${bx},${by}`);
      }
    }
  }
});

test("at 1× the projection is 2.0's for every settlement and site, and the camera cannot move", () => {
  const { CL } = loadGame();
  const V = CL.mapView;
  assert.deepEqual([...V.levels()], [1, 1.6, 2.4], '"fit" is 1× on today\'s map');
  look(CL, 1);
  const places = [...Object.values(CL.content.table('settlements')), ...Object.values(CL.world.map().sites)];
  for (const p of places) {
    const [sx, sy] = V.toScreen(p.mapX, p.mapY);
    assert.ok(close(sx, 40 + p.mapX * 8.8) && close(sy, 22 + p.mapY * 4.96), `${p.id} at ${sx},${sy}`);
  }
  V.panBy(300, -200);
  assert.ok(close(V.state.cx, 50) && close(V.state.cy, 50), 'the whole map is in view: nothing to pan');
  V.zoomAt(0.5, 100, 100);
  assert.equal(V.state.zoom, 1, 'no zoom out below "fit"');
});

test('clamping keeps the view on the map; zoom keeps the point under the fingers still', () => {
  const { CL } = loadGame();
  const V = CL.mapView;
  look(CL, 2.4);
  V.panBy(-1e5, -1e5); // drag far toward the south-east
  let r = V.visibleRect();
  const e = V.extent();
  const [ex, ey] = CL.world.fromPx(e.w, e.h);
  assert.ok(close(r.x1, ex, 1e-6) && close(r.y1, ey, 1e-6), 'stops at the far edge');
  V.panBy(1e5, 1e5);
  r = V.visibleRect();
  const [ox, oy] = CL.world.fromPx(0, 0);
  assert.ok(close(r.x0, ox, 1e-6) && close(r.y0, oy, 1e-6), 'and at the near edge');
  look(CL, 1.6, 50, 50);
  const before = V.toMap(300, 200);
  V.zoomAt(1.25, 300, 200);
  const after = V.toMap(300, 200);
  assert.ok(close(before[0], after[0]) && close(before[1], after[1]), 'the pinched point stays put');
  V.zoomAt(10, 300, 200);
  assert.equal(V.state.zoom, 2.4, 'no zoom in past 2.4×');
});

test('a map wider than the view: "fit" below 1×, centred along the axis it does not fill', () => {
  const { CL } = loadGame();
  const V = CL.mapView;
  const m = CL.world.map();
  const bounds = m.bounds;
  m.bounds = { w: 200, h: 100 }; // W-05's bigger map, in shape only
  try {
    const fit = V.fitZoom();
    assert.ok(fit < 0.55 && fit > 0.5, `fit ${fit}`);
    assert.deepEqual([...V.levels()], [fit, 1, 1.6, 2.4]);
    look(CL, fit, 20, 20);
    assert.ok(close(V.state.cx, 100, 1e-6) && close(V.state.cy, 50, 1e-6), 'the whole map in view, centred');
    V.panBy(0, 400);
    assert.ok(close(V.state.cy, 50, 1e-6), 'no pan along the axis the map does not fill');
    const r = V.visibleRect();
    assert.ok(r.y0 < 0 && r.y1 > 100, 'the margin is filled with ground');
    look(CL, 1, 0, 50);
    V.panBy(-400, 0);
    assert.ok(V.state.cx > 0 && V.state.cx < 100, 'at 1× the camera pans east–west');
  } finally {
    m.bounds = bounds;
  }
});

test('hit-testing reaches the same settlements, sites and parties at every zoom', () => {
  const { CL } = loadGame({ worldParties: true });
  const V = CL.mapView;
  const parties = CL.campaign.parties;
  CL.campaign.parties = []; // places first (a band standing on a town is hit before it, below)
  const places = [
    ...Object.values(CL.content.table('settlements')).map((s) => ['settlement', s]),
    ...Object.values(CL.world.map().sites).map((s) => ['site', s]),
  ];
  for (const z of ZOOMS) {
    for (const [type, p] of places) {
      look(CL, z, p.mapX, p.mapY); // each in turn in view
      const [sx, sy] = V.toScreen(p.mapX, p.mapY);
      const hit = CL.world.targetAt(sx + 10, sy - 8); // a finger's width off centre, at every zoom
      assert.deepEqual({ type: hit.type, id: hit.id }, { type, id: p.id }, `zoom ${z}: ${p.id}`);
    }
    CL.campaign.parties = parties;
    for (const p of CL.campaign.parties) {
      look(CL, z, p.x, p.y);
      const d = CL.world.partyDrawPos(p);
      const hit = CL.world.targetAt(d.x + 6, d.y - 4);
      assert.equal(hit.type, 'party', `zoom ${z}: party ${p.id}`); // parties come first: they stand on places
    }
    CL.campaign.parties = [];
    // Open ground comes back as the map point under the finger.
    look(CL, z, 75, 20);
    const [px, py] = V.toScreen(75, 20);
    const ground = CL.world.targetAt(px, py);
    assert.equal(ground.type, 'point');
    const [gx, gy] = V.toMap(px, py);
    assert.ok(close(ground.x, gx) && close(ground.y, gy));
  }
  assert.equal(CL.world.HIT_RADIUS_PX, 28, 'the same radius in canvas px at every zoom');
});

/**
 * One journey east across open country toward a band that comes for a lone rider, with the camera at
 * `zoom` looking at `pan`: the tap lands wherever the view puts the destination.
 */
function journey(zoom, pan) {
  const { CL } = loadGame({ worldParties: true, seed: 4242 });
  CL.world.leaveSettlement();
  CL.game.mode = 'map';
  CL.campaign.roster = []; // a lone rider: the band comes for him
  Object.assign(CL.campaign.world, { x: 62, y: 20 });
  const band = CL.parties.spawn(CL.campaign, 'bandits');
  Object.assign(band, { x: 82, y: 20, troops: { looter: 5, reaver: 2 }, tx: null, ty: null });
  const V = CL.mapView;
  look(CL, zoom, ...pan);
  CL.world.click(...V.toScreen(96, 20)); // a tap on open ground, wherever the view puts it
  const target = CL.game.travel && { type: CL.game.travel.type, x: CL.game.travel.x.toFixed(9), y: CL.game.travel.y.toFixed(9) };
  const path = [];
  for (let i = 0; i < 2400 && CL.game.mode === 'map' && CL.game.travel; i++) {
    CL.world.update(0.05);
    V.update(0.05); // the camera follows, as in the game
    path.push([CL.campaign.world.x.toFixed(6), CL.campaign.world.y.toFixed(6), band.x.toFixed(6), band.y.toFixed(6)]);
  }
  return { target, path, mode: CL.game.mode, party: CL.game.partyId === band.id, day: CL.campaign.day.toFixed(8) };
}

test('zoom-independence: the same journey, path, time and contacts at "fit" (1× today), 1.6× and 2.4×', () => {
  const runs = [journey(1, [50, 50]), journey(1.6, [80, 20]), journey(2.4, [90, 25]), journey(2.4, [70, 15])];
  const [a, ...rest] = runs;
  assert.deepEqual(a.target, { type: 'point', x: (96).toFixed(9), y: (20).toFixed(9) });
  assert.ok(a.path.length > 5, 'a real journey');
  assert.equal(a.mode, 'encounter', 'caught on the way');
  assert.equal(a.party, true, 'by that band');
  for (const r of rest) assert.deepEqual(r, a);
});

test('following keeps the party in a central box; Centre returns to it; edge markers point off screen', () => {
  const { CL } = loadGame();
  const V = CL.mapView;
  look(CL, 2.4, 50, 50);
  V.state.following = true;
  const p = { x: 80, y: 30 };
  for (let i = 0; i < 200; i++) V.follow(p, 0.05);
  const [sx, sy] = V.toScreen(p.x, p.y);
  assert.ok(Math.abs(sx - 480) <= 960 * 0.2 + 1 && Math.abs(sy - 270) <= 540 * 0.2 + 1, `kept near the centre: ${sx},${sy}`);
  // A pan stops following; the edge marker points toward the party.
  V.release();
  V.panBy(2000, 0);
  const m = V.edgeMarker(p.x, p.y);
  assert.ok(m, 'off screen');
  assert.ok(m.x > 900 && m.y >= 0 && m.y <= 540, `on the right edge: ${m.x},${m.y}`);
  assert.equal(V.edgeMarker(...V.toMap(480, 270)), null, 'nothing for a point in view');
  CL.campaign.world.x = p.x;
  CL.campaign.world.y = p.y;
  V.centre(true);
  assert.equal(V.state.following, true);
  assert.equal(V.edgeMarker(p.x, p.y), null);
});

test('the zoom steps through "fit", 1.6× and 2.4×, and is kept as a device setting', () => {
  const { CL, storage } = loadGame();
  const V = CL.mapView;
  CL.settings.load();
  look(CL, 1);
  assert.equal(V.step(-1), false, 'already at "fit"');
  assert.equal(V.step(1), true);
  assert.equal(V.state.zoom, 1.6);
  V.step(1);
  assert.equal(V.state.zoom, 2.4);
  assert.equal(V.step(1), false);
  assert.equal(JSON.parse(storage.data[CL.settings.KEY]).mapZoom, 2.4);
  V.state.zoom = 1.37;
  V.remember();
  assert.equal(CL.settings.get('mapZoom'), 1.37);
  // A new visit to the map restores it, within this map's range; junk falls back to 1×.
  V.state.zoom = 1;
  V.restore();
  assert.equal(V.state.zoom, 1.37);
  storage.data[CL.settings.KEY] = JSON.stringify({ mapZoom: 'far' });
  CL.settings.load();
  assert.equal(CL.settings.get('mapZoom'), null, "junk: the world's own opening zoom");
  storage.data[CL.settings.KEY] = JSON.stringify({ mapZoom: 9 });
  CL.settings.load();
  V.restore();
  assert.equal(V.state.zoom, 2.4);
});

test('gameplay distance comes from the map data, not the view', () => {
  const { CL } = loadGame();
  const m = CL.world.map();
  assert.equal(m.aspect, 4.96 / 8.8);
  assert.equal(CL.world.mapDist(0, 0, 0, 10), 10 * m.aspect);
  const VIEW = CL.world.VIEW;
  const saved = { ...VIEW };
  VIEW.sy = 9; // even redrawing the map taller would not change a distance
  try {
    assert.equal(CL.world.mapDist(0, 0, 0, 10), 10 * m.aspect);
  } finally {
    Object.assign(VIEW, saved);
  }
  assert.deepEqual(Array.from(CL.content.validate()), []);
});
