// Soldiers have bodies (owner playtest finding F-2): they may crowd and overlap a little, but can
// never stack on one spot; charging riders still ride through the enemy (GDD §7).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { setup } = require('../scripts/bench-battle');

const pairs = (list) => {
  const out = [];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) out.push([list[a], list[b], Math.hypot(list[a].x - list[b].x, list[a].y - list[b].y)]);
  return out;
};

function crowd(n, x = 400, y = 300) {
  const { CL } = loadGame();
  CL.game.battleMap = CL.content.get('battle_maps', 'grass_field');
  const hero = CL.units.makeUnit(x, y, 'ally', 'hero');
  const allies = Array.from({ length: n }, () => CL.units.makeUnit(x, y, 'ally', 'footman'));
  return { CL, hero, allies, all: [hero, ...allies] };
}

test('twenty soldiers on exactly one spot spread out into a crowd, deterministically', () => {
  const { CL, all } = crowd(20);
  const S = CL.units.SPACING;
  for (let i = 0; i < 120; i++) CL.units.separate(all);
  const closest = Math.min(...pairs(all).map(([, , d]) => d));
  assert.ok(closest >= S * 0.9, `closest pair ${closest.toFixed(1)} px, spacing ${S.toFixed(1)}`);
  assert.ok(all.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y)));
  // Same start, same result.
  const again = crowd(20);
  for (let i = 0; i < 120; i++) again.CL.units.separate(again.all);
  assert.deepEqual(
    again.all.map((u) => [u.x, u.y]),
    all.map((u) => [u.x, u.y]),
  );
});

test('a little overlap is allowed and eased out softly; units already apart are left alone', () => {
  const { CL } = loadGame();
  CL.game.battleMap = CL.content.get('battle_maps', 'grass_field');
  const S = CL.units.SPACING;
  assert.ok(S < 2 * CL.units.UNIT_RADIUS, 'spacing is less than two full bodies: a scrum may overlap');
  const a = CL.units.makeUnit(400, 300, 'ally', 'levy');
  const b = CL.units.makeUnit(400 + S * 0.5, 300, 'enemy', 'looter');
  CL.units.separate([a, b]);
  const d1 = b.x - a.x;
  assert.ok(d1 > S * 0.5 && d1 < S, 'pushed apart, but not all at once');
  const far = CL.units.makeUnit(500, 300, 'ally', 'levy');
  const far2 = CL.units.makeUnit(500 + S + 1, 300, 'ally', 'levy');
  assert.equal(CL.units.separate([far, far2]), 0);
  assert.ok(Math.abs(far2.x - far.x - (S + 1)) < 1e-9, 'not moved');
  // The fallen don't push anyone.
  const down = CL.units.makeUnit(600, 300, 'enemy', 'looter');
  down.alive = false;
  const standing = CL.units.makeUnit(600, 300, 'ally', 'levy');
  assert.equal(CL.units.separate([down, standing]), 0);
});

test('the hero is not shoved around by their own soldiers', () => {
  const { CL, hero, allies } = crowd(6);
  const start = [hero.x, hero.y];
  for (let i = 0; i < 60; i++) CL.units.separate([hero, ...allies]);
  const heroMoved = Math.hypot(hero.x - start[0], hero.y - start[1]);
  const allyMoved = Math.max(...allies.map((u) => Math.hypot(u.x - start[0], u.y - start[1])));
  assert.ok(heroMoved < allyMoved / 2, `hero ${heroMoved.toFixed(1)} px vs soldiers up to ${allyMoved.toFixed(1)} px`);
});

test('a crowd never squeezes anyone into a wall or out of the arena', () => {
  const { CL } = loadGame();
  CL.game.battleMap = CL.content.get('battle_maps', 'greywall_courtyard');
  const wall = CL.game.battleMap.obstacles.find((o) => o.shape !== 'circle');
  const x = wall.x - CL.units.UNIT_RADIUS - 1;
  const y = wall.y + Math.min(30, wall.h / 2);
  const all = Array.from({ length: 12 }, () => CL.units.makeUnit(x, y, 'enemy', 'looter'));
  for (let i = 0; i < 120; i++) CL.units.separate(all);
  assert.equal(all.filter((u) => CL.units.blocked(u.x, u.y)).length, 0, 'nobody inside the wall');
  const B = CL.units.BOUNDS;
  assert.ok(all.every((u) => u.x >= B.minX && u.x <= B.maxX && u.y >= B.minY && u.y <= B.maxY));
});

test('in real 40-unit battles on every map, soldiers on foot never stack (riders still charge through)', () => {
  for (const map of ['grass_field', 'forest_clearing', 'greywall_courtyard']) {
    const CL = setup(40, map);
    const g = CL.game;
    let closest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 60 * 15 && g.mode === 'battle'; i++) {
      CL.combat.update(1 / 60);
      const live = [g.hero, ...g.allies, ...g.enemies].filter((u) => u.alive);
      for (const [u, v, d] of pairs(live)) {
        const riderThrough = u.team !== v.team && (u.role === 'cavalry' || v.role === 'cavalry');
        if (!riderThrough) closest = Math.min(closest, d);
      }
    }
    // Shoulder to shoulder is fine; a third of a body apart (4 px) or closer would be stacking.
    assert.ok(closest >= CL.units.UNIT_RADIUS / 3, `${map}: closest pair on foot ${closest.toFixed(1)} px`);
  }
});
