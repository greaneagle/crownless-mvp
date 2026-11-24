// P10-03: every capital and free city can be walked, and no two are laid out alike.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const TOWNS = (CL) => Object.values(CL.content.table('settlements')).filter((s) => s.type === 'town');

/** Every 8 px cell a walker can stand on, reached from the gate (the same collision as walking). */
function reach(CL, hub) {
  CL.game.battleMap = hub;
  const B = { minX: 47, maxX: 908, minY: 65, maxY: 490 };
  const S = 8;
  const key = (x, y) => `${x},${y}`;
  const snap = (v) => Math.round(v / S) * S;
  const start = [snap(hub.spawn.x), snap(hub.spawn.y)];
  const seen = new Set([key(...start)]);
  const cells = [start];
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = cells[i];
    for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < B.minX || nx > B.maxX || ny < B.minY || ny > B.maxY || seen.has(key(nx, ny)) || CL.units.blocked(nx, ny)) continue;
      seen.add(key(nx, ny));
      cells.push([nx, ny]);
    }
  }
  return cells;
}

test('every capital and free city has walkable streets; villages and forts have none', () => {
  const { CL } = loadGame();
  const towns = TOWNS(CL);
  assert.equal(towns.length, 8, 'the six capitals, Merrow and Gullhaven');
  for (const s of towns) {
    assert.ok(CL.town.hubFor(s.id), `${s.id} has streets`);
    assert.equal(s.explorable, true, s.id);
  }
  for (const s of Object.values(CL.content.table('settlements')).filter((x) => x.type !== 'town')) assert.equal(CL.town.hubFor(s.id), null, s.id);
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('each town has its innkeeper, merchant, recruiter and an elder or official, for the story to cast', () => {
  const { CL } = loadGame();
  for (const s of TOWNS(CL)) {
    for (const role of ['innkeeper', 'merchant', 'recruiter', 'elder', 'official']) {
      const n = CL.town.cast(s.id, role);
      assert.ok(n, `${s.id} ${role}`);
      assert.ok(['elder', 'official'].includes(role) ? ['elder', 'official'].includes(n.role) : n.role === role, `${s.id} ${role}`);
    }
  }
  assert.equal(CL.town.cast('stonebridge', 'recruiter').id, 'sergeant');
  assert.equal(CL.town.cast('oakford', 'innkeeper'), null, 'a village has no streets');
  // Names are each town's own.
  const names = TOWNS(CL).flatMap((s) => CL.town.hubFor(s.id).npcs.filter((n) => n.role && n.role !== 'guard').map((n) => n.name));
  assert.equal(new Set(names).size, names.length, 'nobody is in two towns');
  const nobles = new Set(Object.values(CL.world.map().nobles).map((n) => n.name));
  for (const n of names) assert.equal(nobles.has(n), false, `${n} is a lord's name`);
});

test('from the gate, every person can be walked up to and talked with, and the way out is open', () => {
  const { CL } = loadGame();
  for (const s of TOWNS(CL)) {
    const hub = CL.town.hubFor(s.id);
    const cells = reach(CL, hub);
    for (const n of hub.npcs) {
      for (const [x, y] of [[n.x, n.y], ...(n.pace ? [n.pace] : [])]) {
        assert.ok(cells.some(([cx, cy]) => Math.hypot(cx - x, cy - y) <= CL.town.TALK_RANGE - 6), `${s.id}: ${n.id} at ${x},${y} out of reach`);
      }
      if (n.pace) {
        // The pacing line is clear all the way along.
        for (let k = 0; k <= 20; k++) {
          const [x, y] = [n.x + ((n.pace[0] - n.x) * k) / 20, n.y + ((n.pace[1] - n.y) * k) / 20];
          assert.equal(CL.units.blocked(x, y), false, `${s.id}: ${n.id} paces through a wall at ${x},${y}`);
        }
      }
    }
    const z = hub.exitZone;
    assert.ok(cells.some(([x, y]) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h), `${s.id}: the exit can be reached`);
    const [sx, sy] = [hub.spawn.x, hub.spawn.y];
    assert.equal(sx >= z.x && sx <= z.x + z.w && sy >= z.y && sy <= z.y + z.h, false, `${s.id}: you do not arrive in the exit`);
  }
});

test('nobody to tap and no gate under the controls: the joystick, TALK and the top bar', () => {
  const { CL } = loadGame();
  // The joystick sits bottom left, TALK/attack bottom right and the status and buttons along the top
  // (style.css); a tap there never reaches the street.
  const CORNERS = [{ x0: 0, x1: 200, y0: 380, y1: 540 }, { x0: 630, x1: 960, y0: 380, y1: 540 }, { x0: 0, x1: 960, y0: 0, y1: 95 }];
  const under = (x, y) => CORNERS.some((k) => x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1);
  for (const s of TOWNS(CL)) {
    const hub = CL.town.hubFor(s.id);
    for (const n of hub.npcs) {
      assert.equal(under(n.x, n.y - 16), false, `${s.id}: ${n.id}`);
      if (n.pace) assert.equal(under(n.pace[0], n.pace[1] - 16), false, `${s.id}: ${n.id} paces under a control`);
    }
    const z = hub.exitZone;
    assert.equal(under(z.x + z.w / 2, z.y + z.h / 2), false, `${s.id}: the gate`);
  }
});

test('no building, stall, well or tree stands in another', () => {
  const { CL } = loadGame();
  const box = (o) => (o.shape === 'circle' ? [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r] : [o.x, o.y, o.x + o.w, o.y + o.h]);
  for (const s of TOWNS(CL)) {
    const seen = CL.town.hubFor(s.id).obstacles.filter((o) => o.look);
    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        const [a, b] = [box(seen[i]), box(seen[j])];
        const apart = a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1];
        assert.ok(apart, `${s.id}: ${seen[i].label || seen[i].look} at ${a} and ${seen[j].label || seen[j].look} at ${b}`);
      }
    }
  }
});

test('no two towns are alike: their buildings, their gates and their ground differ', () => {
  const { CL } = loadGame();
  const hubs = TOWNS(CL).map((s) => CL.town.hubFor(s.id));
  const side = (h) => {
    const z = h.exitZone;
    const [cx, cy] = [z.x + z.w / 2, z.y + z.h / 2];
    return Math.min(cx, 960 - cx) < Math.min(cy, 540 - cy) ? (cx < 480 ? 'west' : 'east') : cy < 270 ? 'north' : 'south';
  };
  // No gate on the north side: the top bar covers it.
  assert.deepEqual([...new Set(hubs.map(side))].sort(), ['east', 'south', 'west'], 'gates on every open side of town');
  assert.ok(new Set(hubs.map((h) => h.ground.base)).size === hubs.length, 'each its own ground');
  assert.ok(hubs.filter((h) => h.ground.waters?.length).length >= 4, 'harbours, a river and a cliff');
  const boxes = (h) => h.obstacles.filter((o) => o.look && o.shape === 'rect').map((o) => [o.x, o.y, o.w, o.h]);
  const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const area = (bs) => bs.reduce((t, b) => t + b[2] * b[3], 0);
  for (let i = 0; i < hubs.length; i++) {
    for (let j = i + 1; j < hubs.length; j++) {
      const [a, b] = [boxes(hubs[i]), boxes(hubs[j])];
      let shared = 0;
      for (const p of a) for (const q of b) shared += overlap(p, q);
      // Buildings standing in the same places would make the same town with new names.
      assert.ok(shared < 0.5 * Math.min(area(a), area(b)), `${hubs[i].id} and ${hubs[j].id} share ${Math.round(shared)} px² of buildings`);
    }
  }
});

test('in every town: arrive at the gate, tap the innkeeper, talk, and walk back out to the road', () => {
  for (const id of ['eastwatch', 'hrothgard', 'vessara', 'merrow', 'gullhaven', 'harrowgate', 'calder']) {
    const { CL } = loadGame();
    CL.campaign.world.location = id;
    assert.equal(CL.town.enter(id), true, id);
    const t = CL.game.town;
    const inn = t.npcs.find((n) => n.role === 'innkeeper');
    CL.town.tap(inn.x, inn.y - 16);
    for (let i = 0; i < 600 && CL.game.mode === 'town'; i++) CL.town.update(0.05);
    assert.equal(CL.game.mode, 'talk', `${id}: reached the innkeeper`);
    assert.equal(CL.game.talk.npc.id, inn.id);
    CL.town.backToPlace();
    const z = t.hub.exitZone;
    // Walk back the way you came, then through the gate.
    for (const [x, y] of [[t.hub.spawn.x, t.hub.spawn.y], [z.x + z.w / 2, z.y + z.h / 2]]) {
      CL.town.tap(x, y);
      for (let i = 0; i < 600 && CL.game.mode === 'town' && t.walkTo; i++) CL.town.update(0.05);
    }
    for (let i = 0; i < 40 && CL.game.mode === 'town'; i++) CL.town.update(0.05);
    assert.equal(CL.game.mode, 'map', `${id}: out on the road`);
    assert.equal(CL.campaign.world.location, null);
  }
});
