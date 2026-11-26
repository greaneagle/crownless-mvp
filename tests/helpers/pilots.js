// P11-00: the hero's pilots, for measuring how much the way you fight matters (scripts/duel-lab.js,
// scripts/tactics-lab.js, tests/pilots.test.js). Each pilot drives the hero only through the inputs a
// player has (`g.joystick`, `g.attackHeld`, `g.blockHeld`), exactly as the touch controls and the
// keyboard set them, so later input changes are measured by the same code. A pilot reads only what the
// screen shows: where everyone is, which way they face and the phase of their swing (the pose); never
// a cooldown, a future roll or anything else hidden.
//
//   masher   today's campaign bot (tests/helpers/campaign-bot.js `drive`): walk at the nearest enemy and
//            hold Attack inside 70 px.
//   timer    keeps at the edge of its own reach (reach − 4), out of the opponent's; strikes into the
//            opponent's recovery (or within 0.1 s after its active window, if the pose has already
//            cleared), never into a windup. If the opponent hasn't swung for 1.5 s (a stand-off),
//            it steps in and strikes anyway.
//   turtle   walks in; holds Block while an opponent within reach is winding up or striking; strikes
//            when nobody near is (a hero without a shield can't block, and only strikes in the gaps).
//   passive  (tactics-lab's `--hero passive`) a commander who stays back: walks to the rear of the
//            company and holds there, swinging only at what comes within 70 px.
//   archer   P11-07: a bow or crossbow in hand: keeps its distance (steps back from anyone closer than
//            the keep), draws to full (it sees the ring fill) and lets go; a crossbow loads standing still.
//            With a melee weapon in hand (out of arrows) it fights as the masher.

const STEP = 0.02; // the same step as scripts/parity.js and the campaign bot
const TIMER = { edge: 4, band: 5, after: 0.1, stale: 1.5 };
const TURTLE = { threat: 22 }; // px beyond the opponent's reach at which their swing is a threat
const PASSIVE = { back: 160, fight: 70 };
const ARCHER = { keep: 130, close: 70 };

const KINDS = ['masher', 'timer', 'turtle', 'passive', 'archer'];

/** The nearest opponent still fighting (or any left alive). */
function nearestFoe(g, h) {
  let best = null;
  let bd = Infinity;
  for (const x of g.enemies) {
    if (!x.alive || x.routing) continue;
    const d = Math.hypot(x.x - h.x, x.y - h.y);
    if (d < bd) [best, bd] = [x, d];
  }
  return best || g.enemies.find((x) => x.alive) || null;
}

/**
 * A pilot of a kind. `step(CL)` sets the inputs for the next frame.
 * @param {any} CL @param {'masher' | 'timer' | 'turtle' | 'passive'} kind
 */
function makePilot(CL, kind = 'masher') {
  if (!KINDS.includes(kind)) throw new Error(`Unknown pilot: ${kind}`);
  const U = CL.units;
  const seen = new Map(); // opponent → { phase, activeEnd, swungAt }: what the pilot has watched
  let start = null;
  let post = null; // passive: where it stands

  /** Remember each opponent's pose: when its last active window ended, when it last swung. */
  function watch(g) {
    for (const x of g.enemies) {
      if (!x.alive) continue;
      const ph = U.swingPhase(x);
      const m = seen.get(x) || { phase: null, activeEnd: -99, swungAt: -99 };
      if (m.phase === 'active' && ph !== 'active') m.activeEnd = g.t;
      if (ph === 'windup' || ph === 'active') m.swungAt = g.t;
      m.phase = ph;
      seen.set(x, m);
    }
  }

  const toward = (h, x, y) => {
    const L = Math.hypot(x - h.x, y - h.y) || 1;
    return { x: (x - h.x) / L, y: (y - h.y) / L };
  };
  const still = { x: 0, y: 0 };

  function masher(g, h, foe) {
    const [dx, dy] = [foe.x - h.x, foe.y - h.y];
    const L = Math.hypot(dx, dy) || 1;
    g.joystick = L > 45 || !U.inArc(h, foe, U.ARC.attack) ? { x: dx / L, y: dy / L } : still;
    g.attackHeld = L < 70;
    g.blockHeld = false;
  }

  /** Step in (or turn) and strike if in reach. */
  function strike(g, h, foe, d) {
    const facing = U.inArc(h, foe, U.ARC.attack);
    g.joystick = d > h.reach - 10 || !facing ? toward(h, foe.x, foe.y) : still;
    g.attackHeld = d < h.reach - 2 && facing;
  }

  function timer(g, h, foe) {
    const d = Math.hypot(foe.x - h.x, foe.y - h.y);
    const m = seen.get(foe) || { phase: null, activeEnd: -99, swungAt: -99 };
    const ph = U.swingPhase(foe);
    g.blockHeld = false;
    const open = ph === 'recovery' || (ph === null && g.t - m.activeEnd <= TIMER.after) || (ph === null && g.t - Math.max(m.swungAt, start) > TIMER.stale);
    if (open) return strike(g, h, foe, d);
    g.attackHeld = false;
    const keep = h.reach - TIMER.edge;
    const threat = (ph === 'windup' || ph === 'active') && d < foe.reach + TURTLE.threat;
    if (threat || d < keep - TIMER.band) {
      g.joystick = toward(h, 2 * h.x - foe.x, 2 * h.y - foe.y); // give ground
    } else if (d > keep + TIMER.band) g.joystick = toward(h, foe.x, foe.y);
    else if (!U.inArc(h, foe, U.ARC.attack)) {
      // Turn to face them without closing in: a short step toward, the next frame holds.
      g.joystick = toward(h, foe.x, foe.y);
    } else g.joystick = still;
  }

  function turtle(g, h, foe) {
    const d = Math.hypot(foe.x - h.x, foe.y - h.y);
    const threat = g.enemies.some((x) => {
      if (!x.alive || x.routing) return false;
      const ph = U.swingPhase(x);
      return (ph === 'windup' || ph === 'active') && Math.hypot(x.x - h.x, x.y - h.y) < x.reach + TURTLE.threat;
    });
    if (threat && h.canBlock !== false) {
      g.blockHeld = true;
      g.attackHeld = false;
      g.joystick = U.inArc(h, foe, U.ARC.attack) ? still : toward(h, foe.x, foe.y); // shield toward them
      return;
    }
    g.blockHeld = false;
    if (threat) {
      // No shield: wait out the blow at the edge of its reach.
      g.attackHeld = false;
      g.joystick = d < foe.reach + TURTLE.threat ? toward(h, 2 * h.x - foe.x, 2 * h.y - foe.y) : still;
      return;
    }
    strike(g, h, foe, d);
  }

  function passive(g, h, foe) {
    if (!post) {
      const mine = g.allies.filter((a) => a.alive);
      const minX = mine.length ? Math.min(...mine.map((a) => a.x)) : h.x;
      const b = g.battleMap.bounds || U.BOUNDS;
      post = { x: Math.max(b.minX + 10, Math.min(h.x, minX) - PASSIVE.back), y: h.y };
    }
    const d = Math.hypot(foe.x - h.x, foe.y - h.y);
    if (d < PASSIVE.fight) return masher(g, h, foe);
    g.attackHeld = false;
    g.blockHeld = false;
    g.joystick = Math.hypot(post.x - h.x, post.y - h.y) > 12 ? toward(h, post.x, post.y) : still;
  }

  function archer(g, h, foe) {
    const r = h.ranged;
    if (!r) return masher(g, h, foe);
    const d = Math.hypot(foe.x - h.x, foe.y - h.y);
    const full = r.crossbow ? Boolean(h.loaded) : (h.drawT || 0) >= r.draw - 1e-9; // the ring is full
    g.blockHeld = false;
    // Too close: step back (a crossbow keeps loading only while still, so it backs off only when pressed).
    const back = d < (r.crossbow && !h.loaded ? ARCHER.close : ARCHER.keep);
    g.joystick = back ? toward(h, 2 * h.x - foe.x, 2 * h.y - foe.y) : d > (r.range || 200) * 0.9 ? toward(h, foe.x, foe.y) : U.inArc(h, foe, U.ARC.block) ? still : toward(h, foe.x, foe.y);
    // Hold to draw and let go at full; a crossbow: a press once it is loaded, let go the next frame.
    g.attackHeld = r.crossbow ? full && !g.attackHeld : !full;
  }

  const drive = { masher, timer, turtle, passive, archer }[kind];

  return {
    kind,
    /** Set the inputs for the next frame. */
    step() {
      const g = CL.game;
      const h = g.hero;
      if (start === null) start = g.t;
      watch(g);
      const foe = h?.alive ? nearestFoe(g, h) : null;
      if (!foe) {
        g.joystick = still;
        g.attackHeld = false;
        g.blockHeld = false;
        return;
      }
      drive(g, h, foe);
    },
  };
}

/**
 * Fight the battle in progress to its end with a pilot. Returns what the hero did and how it ended.
 * @param {any} CL @param {string} kind @param {{ maxSteps?: number, dt?: number, each?: (g: any) => void }} [opts]
 */
function fly(CL, kind, { maxSteps = 30000, dt = STEP, each } = {}) {
  const g = CL.game;
  const pilot = makePilot(CL, /** @type {any} */ (kind));
  const h0 = g.hero;
  const hp0 = h0.hp;
  // Blows given and taken by the hero: counted from the effects the hit leaves (what the screen shows).
  let given = 0;
  let taken = 0;
  let blocked = 0;
  let t = 0;
  for (; t < maxSteps && g.mode === 'battle'; t++) {
    pilot.step();
    each?.(g);
    const h = g.hero;
    const hp = h.hp;
    const swing = h.swing;
    const struck = swing ? swing.hit.length : 0;
    const before = new Map(g.enemies.map((e) => [e.id, e.hp]));
    const guarded = h.guard;
    const blocks = g.effects.length;
    CL.combat.update(dt);
    if (h.hp < hp) taken++;
    // The hero's blows that landed this frame: opponents newly in the swing's list who lost HP.
    if (swing && swing === h.swing) for (const id of swing.hit.slice(struck)) if (g.enemies.find((e) => e.id === id)?.hp < before.get(id)) given++;
    if (guarded && h.hp === hp && g.effects.slice(blocks).some((e) => e.kind === 'block' && Math.hypot(e.x - h.x, e.y - (h.y - 17)) < 2)) blocked++;
  }
  const ended = g.mode !== 'battle';
  // A win with an opponent never cut down: they slipped away (the stall guard, 45 s without a blow).
  const withdrew = Boolean(g.result?.win) && g.enemies.some((e) => !e.ground);
  return { win: Boolean(g.result?.win), withdrew, ended, seconds: t * dt, heroAlive: h0.alive, hpLeft: Math.max(0, h0.hp), hpShare: Math.max(0, h0.hp) / (h0.maxhp || hp0), given, taken, blocked };
}

module.exports = { makePilot, fly, KINDS, STEP, TIMER, TURTLE };
