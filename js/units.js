/* Crownless units: construction, facing and movement. Pure logic, no DOM. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, clamp, normalize } = CL.util;

  // Hardcoded 0.3.0 stats. Unknown roles fall back to 'reaver'.
  // TODO(Phase 2.2): replace with data/troops.js definitions.
  const STATS = {
    hero: { hp: 85, speed: 142, damage: 18 },
    infantry: { hp: 70, speed: 94, damage: 11 },
    archer: { hp: 46, speed: 84, damage: 8 },
    brute: { hp: 85, speed: 77, damage: 13 },
    reaver: { hp: 52, speed: 103, damage: 11 },
  };

  const BOUNDS = { minX: 47, maxX: 908, minY: 65, maxY: 490 };
  // Dot-product threshold for the frontal arc (≈ ±67.7°), used by hits and blocks.
  const FACING_DOT = 0.38;
  const FACE_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  let uid = 0;

  function makeUnit(x, y, team, role) {
    const s = STATS[role] || STATS.reaver;
    return {
      id: ++uid,
      x,
      y,
      team,
      role,
      alive: true,
      hp: s.hp,
      maxhp: s.hp,
      speed: s.speed,
      damage: s.damage,
      face: 'down',
      anim: rand(0, 1),
      attack: 0,
      attackCooldown: rand(0, 0.4),
      guard: false,
      aiTimer: rand(0.05, 0.4),
      target: null,
      flash: 0,
      holdX: x,
      holdY: y,
      ground: false,
    };
  }

  /** True when b lies inside a's frontal arc. */
  function facingToward(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const f = FACE_VECTORS[a.face];
    return dx * f[0] + dy * f[1] > Math.hypot(dx, dy) * FACING_DOT;
  }

  function faceFromVector(x, y) {
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  function aim(u, v) {
    u.face = faceFromVector(v.x - u.x, v.y - u.y);
  }

  function move(u, dx, dy, dt) {
    const [vx, vy] = normalize(dx, dy);
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    u.x = clamp(u.x + vx * u.speed * dt, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y + vy * u.speed * dt, BOUNDS.minY, BOUNDS.maxY);
    u.face = faceFromVector(vx, vy);
    u.anim += dt * 6;
  }

  CL.units = { STATS, BOUNDS, FACING_DOT, makeUnit, facingToward, aim, move };
})(typeof window !== 'undefined' ? window : globalThis);
