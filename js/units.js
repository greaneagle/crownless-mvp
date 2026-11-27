// @ts-check
/* Crownless units: construction, facing, swing phases and movement. Pure logic, no DOM. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, clamp, normalize } = CL.util;

  const BOUNDS = { minX: 47, maxX: 908, minY: 65, maxY: 490 };
  // A larger arena (PROTO-A, V2-05) brings its own movement bounds; one-screen maps use BOUNDS.
  const bounds = () => CL.game?.battleMap?.bounds || BOUNDS;
  const FACE_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // GDD §6 arcs, as minimum dot products against the facing vector.
  const ARC = {
    attack: Math.cos(Math.PI / 4), // 90° frontal swing
    block: Math.cos(Math.PI / 3), // 120° frontal shield cover
  };

  // GDD §6 one-handed sword timing (seconds): only the sword family's default now. Every unit's own
  // timing is its combat profile's (js/profile.js, P11-01).
  const SWING = CL.profile.DEFAULT_TIMING;

  let uid = 0;

  /**
   * Build a battle unit from a troop definition (data/troops.js).
   * `soldierId` links an allied unit back to its campaign roster entry.
   * @param {number} x @param {number} y @param {'ally' | 'enemy'} team @param {ContentId} troopId
   * @param {number | null} [soldierId] @returns {Unit}
   */
  function makeUnit(x, y, team, troopId, soldierId = null) {
    const t = CL.content.troop(troopId);
    const p = CL.profile.resolve({ troop: t.id }); // P11-01: the troop's combat profile
    return {
      id: ++uid,
      x,
      y,
      team,
      troop: t.id,
      role: t.role, // 'hero' | 'infantry' | 'archer' | 'cavalry'
      // P11-04: on a horse is a state, not a role (cavalry troops ride; the hero doesn't yet, P11-08).
      mounted: t.role === 'cavalry',
      mount: t.role === 'cavalry' ? t.look?.mount || null : null,
      soldierId,
      alive: true,
      hp: p.hp,
      maxhp: p.maxhp,
      speed: p.speed,
      damage: p.damage,
      armor: p.armor,
      reach: p.reach,
      ranged: p.ranged,
      profile: p,
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
    return CL.profile.phaseOf(u); // the unit's own timing (P11-01)
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

  // Large arenas (PROTO-A, V2-05) have a hundred or more obstacles: a uniform grid finds the few near a
  // point instead of checking them all. Each cell keeps obstacles in their original order, so results
  // are exactly those of the full scan. Small maps (the three battle maps, the town) skip the grid.
  const GRID_CELL = 128;
  const GRID_FROM = 30; // obstacles before a map gets a grid
  const GRID_PAD = UNIT_RADIUS + 4; // queries reach this far past a point
  const grids = new WeakMap();
  function gridOf(map) {
    let grid = grids.get(map);
    if (grid) return grid;
    grid = new Map();
    for (const o of map.obstacles) {
      const [x0, y0, x1, y1] = o.shape === 'circle' ? [o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r] : [o.x, o.y, o.x + o.w, o.y + o.h];
      for (let cy = Math.floor((y0 - GRID_PAD) / GRID_CELL); cy <= Math.floor((y1 + GRID_PAD) / GRID_CELL); cy++) {
        for (let cx = Math.floor((x0 - GRID_PAD) / GRID_CELL); cx <= Math.floor((x1 + GRID_PAD) / GRID_CELL); cx++) {
          const k = cx * 65536 + cy;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(o);
        }
      }
    }
    grids.set(map, grid);
    return grid;
  }
  const NONE = [];
  /** The obstacles that could touch a unit or arrow at (x, y). */
  function obstaclesNear(x, y) {
    const map = CL.game?.battleMap;
    const all = map?.obstacles || NONE;
    if (all.length < GRID_FROM) return all;
    return gridOf(map).get(Math.floor(x / GRID_CELL) * 65536 + Math.floor(y / GRID_CELL)) || NONE;
  }

  /** Is (x, y) inside obstacle o grown by pad? Rectangles grow with rounded corners, matching collision. */
  function inside(o, x, y, pad = 0) {
    if (o.shape === 'circle') return Math.hypot(x - o.x, y - o.y) < o.r + pad;
    const dx = Math.max(o.x - x, 0, x - (o.x + o.w));
    const dy = Math.max(o.y - y, 0, y - (o.y + o.h));
    return Math.hypot(dx, dy) < pad || (dx === 0 && dy === 0);
  }

  /** Would a unit standing at (x, y) overlap any obstacle? */
  const blocked = (x, y) => obstaclesNear(x, y).some((o) => inside(o, x, y, UNIT_RADIUS));

  /**
   * Push a unit out of every obstacle it overlaps (so movement slides along edges). Repeats a few
   * times: where two walls meet, leaving one can put the unit inside the other.
   */
  function resolveObstacles(u) {
    for (let pass = 0; pass < 4; pass++) {
      resolveOnce(u);
      if (!obstaclesNear(u.x, u.y).some((o) => inside(o, u.x, u.y, UNIT_RADIUS - 0.01))) return;
    }
  }

  function resolveOnce(u) {
    for (const o of obstaclesNear(u.x, u.y)) {
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
    u.x = clamp(u.x, bounds().minX, bounds().maxX);
    u.y = clamp(u.y, bounds().minY, bounds().maxY);
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

  // ---- Bodies: soldiers crowd but don't stack (owner playtest finding F-2) ----

  // Two living units closer than SPACING push apart. SPACING is half of two footprints (12 px):
  // shoulder to shoulder, with plenty of overlap in a melee scrum (owner request after 0.36.0's
  // 0.7 felt too loose), but twenty soldiers can no longer share one spot.
  const SPACING = UNIT_RADIUS * 2 * 0.5;
  const PUSH = 0.5; // share of an overlap removed each frame: firm but smooth, no jitter
  // Heavier units give way less: the hero isn't shoved around by their own soldiers, riders less than footmen.
  /** P11-04: is this fighter on a horse? (A state: `u.mounted`, from the troop for now.) */
  const mounted = (u) => Boolean(u?.mounted);
  const mass = (u) => (u.role === 'hero' ? 3 : mounted(u) ? 2 : 1);
  const GOLDEN = 2.399963; // spreads units that stand on exactly the same point, deterministically
  // GDD §7: cavalry "accelerate toward a target, pass through, and turn for another run". A rider at
  // charge speed (or riding on after a pass) goes through enemy bodies; it still keeps clear of its own side.
  const CHARGE_THROUGH = 0.6; // = CAVALRY.chargeMomentum in combat.js
  const charging = (u) => mounted(u) && (u.overrun > 0 || (u.momentum || 0) >= CHARGE_THROUGH);
  const passesThrough = (u, v) => u.team !== v.team && (charging(u) || charging(v));

  /**
   * One separation step over the living units. A uniform grid with SPACING-sized cells means each
   * unit only checks its own and neighbouring cells, so the cost grows with the number of units, not
   * with every pair. Returns how many pairs were pushed apart.
   * @param {Unit[]} units @returns {number}
   */
  function separate(units) {
    const live = units.filter((u) => u?.alive);
    if (live.length < 2) return 0;
    const cellOf = (v) => Math.floor(v / SPACING);
    const grid = new Map();
    live.forEach((u, i) => {
      const k = `${cellOf(u.x)},${cellOf(u.y)}`;
      const entry = { u, i };
      const bucket = grid.get(k);
      if (bucket) bucket.push(entry);
      else grid.set(k, [entry]);
    });
    const moved = new Set();
    let pushes = 0;
    live.forEach((u, i) => {
      const cx = cellOf(u.x);
      const cy = cellOf(u.y);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const { u: v, i: j } of grid.get(`${gx},${gy}`) || []) {
            if (j <= i || passesThrough(u, v)) continue; // each pair once; charging riders ride through
            let dx = v.x - u.x;
            let dy = v.y - u.y;
            let d = Math.hypot(dx, dy);
            if (d >= SPACING) continue;
            if (d < 1e-6) {
              const a = (i * GOLDEN + j * 1.3) % (Math.PI * 2);
              [dx, dy, d] = [Math.cos(a), Math.sin(a), 1];
            }
            const shove = (SPACING - Math.min(d, SPACING)) * PUSH;
            const [nx, ny] = [dx / d, dy / d];
            const [mu, mv] = [mass(u), mass(v)];
            u.x -= nx * shove * (mv / (mu + mv));
            u.y -= ny * shove * (mv / (mu + mv));
            v.x += nx * shove * (mu / (mu + mv));
            v.y += ny * shove * (mu / (mu + mv));
            moved.add(u).add(v);
            pushes++;
          }
        }
      }
    });
    for (const u of moved) {
      u.x = clamp(u.x, bounds().minX, bounds().maxX);
      u.y = clamp(u.y, bounds().minY, bounds().maxY);
      resolveObstacles(u); // a crowd never squeezes anyone into a wall
    }
    return pushes;
  }

  /**
   * P9-B1: "is any of these within r of a point?" without testing every one: the list goes into a grid
   * of `cell`-sized squares once, and a query looks only at the squares that reach the point. The
   * answer is exactly the plain test's (a distance strictly under r). For the checks that ran every
   * fighter against every opponent: morale's regrouping and giving up, the group states, sight.
   * @param {{ x: number, y: number }[]} list @param {number} [cell]
   */
  function proximity(list, cell = 128) {
    const cells = new Map();
    const keyOf = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
    for (const v of list) {
      const k = keyOf(Math.floor(v.x / cell), Math.floor(v.y / cell));
      const bucket = cells.get(k);
      if (bucket) bucket.push(v);
      else cells.set(k, [v]);
    }
    return {
      /** Is any within `r` of (x, y)? @param {number} x @param {number} y @param {number} r */
      any(x, y, r) {
        if (!cells.size) return false;
        const [x0, x1, y0, y1] = [Math.floor((x - r) / cell), Math.floor((x + r) / cell), Math.floor((y - r) / cell), Math.floor((y + r) / cell)];
        for (let cx = x0; cx <= x1; cx++) {
          for (let cy = y0; cy <= y1; cy++) {
            for (const v of cells.get(keyOf(cx, cy)) || NONE) if (Math.hypot(v.x - x, v.y - y) < r) return true;
          }
        }
        return false;
      },
    };
  }

  /** Does a flying arrow at (x, y) hit cover that stops arrows (trees, walls, crates)? */
  const arrowBlocked = (x, y) => obstaclesNear(x, y).some((o) => o.blocksArrows !== false && inside(o, x, y));

  /**
   * How fast a unit can move where it stands: a map's `slow` ground (a ford's shallows, W-05a) gives
   * its factor; anywhere else 1.
   */
  function groundFactor(x, y) {
    for (const z of CL.game?.battleMap?.slow || []) if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.factor;
    return 1;
  }

  function move(u, dx, dy, dt) {
    let [vx, vy] = normalize(dx, dy);
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    if (u.role !== 'hero') [vx, vy] = steer(u, vx, vy); // the player steers the hero
    const speed = u.speed * groundFactor(u.x, u.y);
    u.x = clamp(u.x + vx * speed * dt, bounds().minX, bounds().maxX);
    u.y = clamp(u.y + vy * speed * dt, bounds().minY, bounds().maxY);
    resolveObstacles(u);
    if (!isCommitted(u)) u.face = faceFromVector(vx, vy);
    u.anim += dt * 6;
  }

  /** Shove u by distance px directly away from point (sx, sy), within the arena. */
  function push(u, sx, sy, distance) {
    const [vx, vy] = normalize(u.x - sx, u.y - sy);
    u.x = clamp(u.x + vx * distance, bounds().minX, bounds().maxX);
    u.y = clamp(u.y + vy * distance, bounds().minY, bounds().maxY);
    resolveObstacles(u);
  }

  CL.units = {
    mounted,
    charging, // P11-08: the mounted hero rides through foot by the same rule
    passesThrough,
    FACE_VECTORS,
    BOUNDS,
    proximity,
    ARC,
    SWING,
    UNIT_RADIUS,
    SPACING,
    separate,
    makeUnit,
    inArc,
    swingPhase,
    isCommitted,
    aim,
    move,
    groundFactor,
    push,
    inside,
    blocked,
    resolveObstacles,
    steer,
    arrowBlocked,
  };
})(typeof window !== 'undefined' ? window : globalThis);
