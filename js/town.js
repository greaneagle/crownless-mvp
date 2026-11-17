/* Crownless walkable town hub (GDD §8: Stonebridge). Walk the hero around with the battle controls
 * (or tap a spot / a person to walk there); talk to people to open their menus; leave by the gate.
 * Time does not pass in town. Buildings are battle-map obstacles, so collision is shared with battle.
 * State: CL.game.town (transient; you always re-enter at the gate). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TALK_RANGE = 46; // px from the hero to an NPC
  const TAP_RADIUS = 28; // px around an NPC that counts as tapping them
  const NPC_SPEED = 40;
  const NPC_PAUSE = 1.5; // seconds at each end of a pacing loop
  const ARRIVE = 6;

  const g = () => CL.game;
  const hubFor = (sid) => (sid ? Object.values(CL.content.table('town_hubs')).find((h) => h.settlement === sid) || null : null);

  /** Enter a settlement's town scene (if it has one). Returns false for menu-only settlements. */
  function enter(sid = CL.campaign.world.location) {
    const hub = hubFor(sid);
    if (!hub) return false;
    const hero = CL.units.makeUnit(hub.spawn.x, hub.spawn.y, 'ally', 'hero');
    hero.face = 'right';
    g().town = {
      hub,
      hero,
      // People with a `visible` condition only appear when the story allows (e.g. Mara after Q2).
      npcs: hub.npcs.filter((n) => CL.story.test(n.visible)).map((n) => ({ ...n, home: { x: n.x, y: n.y }, face: 'down', anim: 0, leg: 0, wait: 0, lineIndex: 0 })),
      near: null,
      walkTo: null,
    };
    g().battleMap = hub; // buildings collide like battle obstacles
    g().placeMode = 'town';
    CL.ui.changeMode('town');
    return true;
  }

  /** Go to a settlement: its town scene if it has one, otherwise its menu. */
  function enterPlace() {
    if (!enter()) {
      g().placeMode = 'settlement';
      CL.ui.changeMode('settlement');
    }
  }

  function npcAt(px, py) {
    const t = g().town;
    return t?.npcs.find((n) => Math.hypot(n.x - px, n.y - 16 - py) <= TAP_RADIUS) || null;
  }

  /** Tap/click in the scene: walk to that spot, or up to that person and talk. */
  function tap(px, py) {
    const t = g().town;
    if (!t || g().mode !== 'town') return;
    const n = npcAt(px, py);
    t.walkTo = n ? { x: n.x, y: n.y + 24, npc: n.id } : { x: px, y: py, npc: null };
  }

  function nearest(t) {
    let best = null;
    for (const n of t.npcs) {
      const d = Math.hypot(n.x - t.hero.x, n.y - t.hero.y);
      if (d <= TALK_RANGE && (!best || d < best.d)) best = { n, d };
    }
    return best?.n || null;
  }

  function inExit(t) {
    const z = t.hub.exitZone;
    return t.hero.x >= z.x && t.hero.x <= z.x + z.w && t.hero.y >= z.y && t.hero.y <= z.y + z.h;
  }

  function paceNpc(n, dt) {
    if (!n.pace) return;
    if (n.wait > 0) {
      n.wait -= dt;
      return;
    }
    const [tx, ty] = n.leg ? [n.home.x, n.home.y] : n.pace;
    const d = Math.hypot(tx - n.x, ty - n.y);
    if (d <= ARRIVE) {
      n.leg = 1 - n.leg;
      n.wait = NPC_PAUSE;
      n.face = 'down';
      return;
    }
    const step = Math.min(d, NPC_SPEED * dt);
    n.x += ((tx - n.x) / d) * step;
    n.y += ((ty - n.y) / d) * step;
    n.face = Math.abs(tx - n.x) > Math.abs(ty - n.y) ? (tx < n.x ? 'left' : 'right') : ty < n.y ? 'up' : 'down';
    n.anim += dt * 6;
  }

  function update(dt) {
    const t = g().town;
    if (!t || g().mode !== 'town') return;
    dt = Math.min(dt, 0.05);
    const k = g().hold;
    const jx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + g().joystick.x;
    const jy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0) + g().joystick.y;
    if (jx || jy) {
      t.walkTo = null; // manual control cancels tap-to-walk
      CL.units.move(t.hero, jx, jy, dt);
    } else if (t.walkTo) {
      const w = t.walkTo;
      const target = w.npc && t.npcs.find((n) => n.id === w.npc);
      if (target) [w.x, w.y] = [target.x, target.y + 24]; // follow a pacing person
      const d = Math.hypot(w.x - t.hero.x, w.y - t.hero.y);
      const before = [t.hero.x, t.hero.y];
      if (d > ARRIVE) {
        // Tap-to-walk steers round the well and buildings as soldiers do, instead of grinding along them.
        const [vx, vy] = CL.units.steer(t.hero, (w.x - t.hero.x) / d, (w.y - t.hero.y) / d);
        CL.units.move(t.hero, vx, vy, dt);
      }
      const stuck = Math.hypot(t.hero.x - before[0], t.hero.y - before[1]) < 0.2;
      const npc = w.npc && t.npcs.find((n) => n.id === w.npc);
      if (npc && Math.hypot(npc.x - t.hero.x, npc.y - t.hero.y) <= TALK_RANGE) {
        t.walkTo = null;
        open(npc);
        return;
      }
      if (d <= ARRIVE || stuck) t.walkTo = null;
    }
    for (const n of t.npcs) paceNpc(n, dt);
    t.near = nearest(t);
    if (inExit(t)) leave();
  }

  /** Talk to whoever is in range (Space / E / Enter / the TALK button). */
  function interact() {
    const t = g().town;
    if (g().mode !== 'town' || !t?.near) return false;
    open(t.near);
    return true;
  }

  function open(n) {
    if (n.action === 'leave') return leave();
    if (n.dialogue) {
      // A dialogue tree, run by the story interpreter.
      const conv = CL.story.talk(n.dialogue);
      g().talk = { npc: n, conv, line: conv.text };
    } else {
      const line = n.lines[n.lineIndex % n.lines.length];
      n.lineIndex++;
      g().talk = { npc: n, line };
    }
    CL.diag.log('info', 'Talk', { npc: n.id });
    CL.ui.changeMode('talk');
  }

  function leave() {
    g().town = null;
    g().talk = null;
    g().battleMap = null;
    CL.world.leaveSettlement();
  }

  /** Back to the place you were in: the town streets or the settlement menu. */
  function backToPlace() {
    if (g().placeMode === 'town' && g().town) {
      g().town.npcs = g().town.npcs.filter((n) => CL.story.test(n.visible)); // e.g. Mara, once she has joined
      CL.ui.changeMode('town');
    }
    else if (g().placeMode === 'town') enter();
    else CL.ui.changeMode('settlement');
  }

  CL.town = { TALK_RANGE, hubFor, enter, enterPlace, tap, npcAt, update, interact, open, leave, backToPlace };
})(typeof window !== 'undefined' ? window : globalThis);
