/* Crownless units: construction, facing, swing phases and movement. Pure logic, no DOM. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, clamp, normalize } = CL.util;

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

  /**
   * Build a battle unit from a troop definition (data/troops.js).
   * `soldierId` links an allied unit back to its campaign roster entry.
   */
  function makeUnit(x, y, team, troopId, soldierId = null) {
    const t = CL.content.troop(troopId);
    return {
      id: ++uid,
      x,
      y,
      team,
      troop: t.id,
      role: t.role, // 'hero' | 'infantry' | 'archer' | 'cavalry'
      soldierId,
      alive: true,
      hp: t.hp,
      maxhp: t.hp,
      speed: t.speed,
      damage: t.damage,
      armor: t.armor,
      reach: t.reach,
      ranged: t.ranged || null,
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

  // ---- Battle-map obstacles (GDD §8: shared collision system) ----

  const UNIT_RADIUS = 12; // a unit's footprint
  const FEELER = 34; // how far ahead AI soldiers look for obstacles
  const STEER_ANGLES = [0.5, 1.0, 1.5, 2.1];

  const obstacles = () => CL.game?.battleMap?.obstacles || [];

  /** Is (x, y) inside obstacle o grown by pad? Rectangles grow with rounded corners, matching collision. */
  function inside(o, x, y, pad = 0) {
    if (o.shape === 'circle') return Math.hypot(x - o.x, y - o.y) < o.r + pad;
    const dx = Math.max(o.x - x, 0, x - (o.x + o.w));
    const dy = Math.max(o.y - y, 0, y - (o.y + o.h));
    return Math.hypot(dx, dy) < pad || (dx === 0 && dy === 0);
  }

  /** Would a unit standing at (x, y) overlap any obstacle? */
  const blocked = (x, y) => obstacles().some((o) => inside(o, x, y, UNIT_RADIUS));

  /**
   * Push a unit out of every obstacle it overlaps (so movement slides along edges). Repeats a few
   * times: where two walls meet, leaving one can put the unit inside the other.
   */
  function resolveObstacles(u) {
    for (let pass = 0; pass < 4; pass++) {
      resolveOnce(u);
      if (!obstacles().some((o) => inside(o, u.x, u.y, UNIT_RADIUS - 0.01))) return;
    }
  }

  function resolveOnce(u) {
    for (const o of obstacles()) {
      if (o.shape === 'circle') {
        const dx = u.x - o.x;
        const dy = u.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = o.r + UNIT_RADIUS;
        if (d >= min) continue;
        const [nx, ny] = d < 1e-6 ? [1, 0] : [dx / d, dy / d];
        u.x = o.x + nx * min;
        u.y = o.y + ny * min;
      } else {
        const cx = clamp(u.x, o.x, o.x + o.w);
        const cy = clamp(u.y, o.y, o.y + o.h);
        const dx = u.x - cx;
        const dy = u.y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= UNIT_RADIUS) continue;
        if (d > 1e-6) {
          u.x = cx + (dx / d) * UNIT_RADIUS;
          u.y = cy + (dy / d) * UNIT_RADIUS;
        } else {
          // Centre inside the rectangle: leave through the nearest side.
          const exits = [
            [u.x - o.x, -1, 0],
            [o.x + o.w - u.x, 1, 0],
            [u.y - o.y, 0, -1],
            [o.y + o.h - u.y, 0, 1],
          ].sort((a, b) => a[0] - b[0]);
          const [dist, ex, ey] = exits[0];
          u.x += ex * (dist + UNIT_RADIUS);
          u.y += ey * (dist + UNIT_RADIUS);
        }
      }
    }
    u.x = clamp(u.x, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y, BOUNDS.minY, BOUNDS.maxY);
  }

  /**
   * AI steering: if the way ahead is blocked, turn by increasing angles toward the side that is
   * free, remembering the chosen side so the unit doesn't dither.
   */
  function steer(u, vx, vy) {
    if (!obstacles().length || !blocked(u.x + vx * FEELER, u.y + vy * FEELER)) {
      u.steerSide = 0;
      return [vx, vy];
    }
    const sides = u.steerSide ? [u.steerSide, -u.steerSide] : [1, -1];
    for (const a of STEER_ANGLES) {
      for (const s of sides) {
        const c = Math.cos(a * s);
        const sn = Math.sin(a * s);
        const rx = vx * c - vy * sn;
        const ry = vx * sn + vy * c;
        if (!blocked(u.x + rx * FEELER, u.y + ry * FEELER) && !blocked(u.x + rx * FEELER * 0.5, u.y + ry * FEELER * 0.5)) {
          u.steerSide = s;
          return [rx, ry];
        }
      }
    }
    return [vx, vy];
  }

  /** Does a flying arrow at (x, y) hit cover that stops arrows (trees, walls, crates)? */
  const arrowBlocked = (x, y) => obstacles().some((o) => o.blocksArrows !== false && inside(o, x, y));

  function move(u, dx, dy, dt) {
    let [vx, vy] = normalize(dx, dy);
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    if (u.role !== 'hero') [vx, vy] = steer(u, vx, vy); // the player steers the hero
    u.x = clamp(u.x + vx * u.speed * dt, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y + vy * u.speed * dt, BOUNDS.minY, BOUNDS.maxY);
    resolveObstacles(u);
    if (!isCommitted(u)) u.face = faceFromVector(vx, vy);
    u.anim += dt * 6;
  }

  /** Shove u by distance px directly away from point (sx, sy), within the arena. */
  function push(u, sx, sy, distance) {
    const [vx, vy] = normalize(u.x - sx, u.y - sy);
    u.x = clamp(u.x + vx * distance, BOUNDS.minX, BOUNDS.maxX);
    u.y = clamp(u.y + vy * distance, BOUNDS.minY, BOUNDS.maxY);
    resolveObstacles(u);
  }

  CL.units = {
    BOUNDS,
    ARC,
    SWING,
    UNIT_RADIUS,
    makeUnit,
    inArc,
    swingPhase,
    isCommitted,
    aim,
    move,
    push,
    inside,
    blocked,
    resolveObstacles,
    steer,
    arrowBlocked,
  };
})(typeof window !== 'undefined' ? window : globalThis);
