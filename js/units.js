/* Crownless units: construction, facing, swing phases and movement. Pure logic, no DOM. */
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
  const FACE_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // GDD §6 arcs, as minimum dot products against the facing vector.
  const ARC = {
    attack: Math.cos(Math.PI / 4), // 90° frontal swing
    block: Math.cos(Math.PI / 3), // 120° frontal shield cover
  };

  // GDD §6 one-handed sword timing (seconds).
  const SWING = { windup: 0.16, active: 0.12, recovery: 0.24 };
  SWING.total = SWING.windup + SWING.active + SWING.recovery;

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
      swing: null, // { t, hit: [ids] } while a melee swing is in progress
      shot: 0, // archer release flash timer
      attackCooldown: rand(0, 0.4),
      guard: false,
      aiTimer: rand(0.05, 0.4),
      target: null,
      flash: 0,
      holdX: x,
      holdY: y,
      ground: false,
      downAt: 0,
    };
  }

  /** True when b lies inside a's frontal arc of the given minimum dot product. */
  function inArc(a, b, minDot) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const f = FACE_VECTORS[a.face];
    return dx * f[0] + dy * f[1] > Math.hypot(dx, dy) * minDot;
  }

  /** 'windup' | 'active' | 'recovery' | null */
  function swingPhase(u) {
    if (!u.swing) return null;
    const t = u.swing.t;
    if (t < SWING.windup) return 'windup';
    if (t < SWING.windup + SWING.active) return 'active';
    if (t < SWING.total) return 'recovery';
    return null;
  }

  /** Windup and active frames commit the unit: facing locks and block is unavailable. */
  function isCommitted(u) {
    const p = swingPhase(u);
    return p === 'windup' || p === 'active';
  }

  function faceFromVector(x, y) {
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  function aim(u, v) {
    if (isCommitted(u)) return;
    u.face = faceFromVector(v.x - u.x, v.y - u.y);
  }

  function move(u, dx, dy, dt) {
    const [vx, vy] = normalize(dx, dy);
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    u.x = clamp(u.x + vx * u.speed * dt, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y + vy * u.speed * dt, BOUNDS.minY, BOUNDS.maxY);
    if (!isCommitted(u)) u.face = faceFromVector(vx, vy);
    u.anim += dt * 6;
  }

  /** Shove u by distance px directly away from point (sx, sy), within the arena. */
  function push(u, sx, sy, distance) {
    const [vx, vy] = normalize(u.x - sx, u.y - sy);
    u.x = clamp(u.x + vx * distance, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y + vy * distance, BOUNDS.minY, BOUNDS.maxY);
  }

  CL.units = { STATS, BOUNDS, ARC, SWING, makeUnit, inArc, swingPhase, isCommitted, aim, move, push };
})(typeof window !== 'undefined' ? window : globalThis);
