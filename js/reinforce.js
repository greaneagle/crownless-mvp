// @ts-check
/* Crownless nearby reinforcements (V2-09; design §9, §5.4, SC-08, SC-09, §25.2, §27.3).
 *
 * A battle is an active conflict at a place on the map. When it starts, the game works out which
 * world parties nearby will join it, on which side, and when, from where they are now. Nothing is
 * rolled, so the same battle always brings the same help:
 *
 *   reach      it can ride to the battle within the battle's fixed time (4 hours, V2-04) at its own
 *              speed over the ground it starts on
 *   awareness  it is within 1.5 × its own detection range: it hears the fight
 *   reason     Road Reavers join other Reavers. A kingdom's patrol joins its own kingdom's party if you
 *              attacked it and turns on you if its kingdom is Hostile; it rides to your aid (against bandits
 *              or a rival's patrol) only if its kingdom counts you a friend. Caravans,
 *              story bands, contract bands and escorted caravans keep out, and story battles get no help.
 *   numbers    at most two parties join one battle (the nearest first)
 *
 * In the fight, an hour of riding is ten seconds of battle, so a party two hours away arrives after
 * 20 s (never before 6 s). Parties your company can see (within 6 map units) are known from the start:
 * the encounter screen names them and the battle says when they will come. Others are announced
 * 10 s before they arrive, with a banner on the side they come from. They ride in from the edge of the
 * field that faces them on the map, never into the middle of a formation. When the field is full
 * they wait in reserve. A party still on its way when the battle ends arrives too late and takes no part.
 *
 * Helpers fight for themselves (they charge; the company's orders, ranks and morale are its own),
 * and an enemy they cut down is theirs: no kill credit and no spoils for you. Enemies who join are
 * part of the enemy (waves, morale, spoils).
 *
 * The result commits once, with the battle (CL.encounter.resolve): parties that fought are moved to
 * the battle, lose those who fell, and a beaten enemy party is broken. Every party in a live battle
 * is locked: while the battle's hours pass on the map it neither moves nor fights anyone else, so no
 * party can lose two battles at once (§9.5). Auto-resolve counts the same parties. Nothing is saved:
 * the plan lives only as long as the battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SECONDS_PER_HOUR = 10; // battle seconds for each hour of riding
  const MIN_ARRIVAL = 6; // s
  const WARN = 10; // s: an unseen party is announced this long before it arrives
  const SIGHT = 6; // map units: parties this close to the battle are seen from the start
  const AWARE = 1; // × a party's detection: how far off it hears the fight
  const MAX_PARTIES = 2;
  const AUTO_WINDOW = 20; // s: auto-resolve counts the parties that would be in the fight by then (a typical battle's length)
  const EDGE_INSET = 40; // px in from the edge of the field
  const CLEAR = 120; // px: no opponent this close to an entry point

  const A = () => CL.autoresolve;
  const tpl = (id) => CL.content.get('party_templates', id);
  const troopCount = (troops) => Object.values(troops).reduce((a, b) => a + b, 0);
  const hostileTo = (c, t) => Boolean(t.hostile) || CL.realm.isHostile(c, t.faction);

  /** What the player is fighting: { kind, faction } from the open encounter, or null. @param {any} e */
  function foeOf(e) {
    if (!e) return null;
    if (e.kind === 'site') return { kind: 'bandit', faction: CL.realm.outlaws(), quest: false, partyId: null };
    // A story band's fight gets no help, unless its quest says so (band help: true, V2-Q).
    const spec = e.party.questTag ? CL.story?.bandSpec(e.party.questTag) : null;
    return { kind: e.t.kind, faction: e.t.faction, quest: Boolean(e.party.questTag) && !spec?.help, partyId: e.party.id };
  }

  /**
   * Which side would this party take in a fight against `foe`: 'ally' (yours), 'enemy', or null.
   * @param {Campaign} c @param {any} p @param {{ kind: string, faction: string }} foe
   */
  function sideOf(c, p, foe) {
    // A quest's own helper patrol (band helper: true, V2-Q) comes for the player against bandits.
    if (p.questTag && CL.story?.bandSpec(p.questTag, c)?.helper) return foe.kind === 'bandit' ? 'ally' : null;
    if (p.questTag || p.ambush || p.escortTo || p.contractId) return null;
    const t = tpl(p.template);
    if (t.kind === 'bandit') return foe.kind === 'bandit' ? 'enemy' : null;
    if (t.kind !== 'patrol' && t.kind !== 'lord') return null; // caravans keep clear; a lord is on their realm's side, as patrols (P8-01)
    if (hostileTo(c, t)) return 'enemy';
    if (foe.faction === t.faction) return 'enemy';
    // Only a kingdom that counts you a friend, or that you serve (P8-04), sends its own to your aid (design §9.1).
    if (CL.realm.standing(c, t.faction) !== 'friendly' && CL.allegiance?.serves(c) !== t.faction) return null;
    return foe.kind === 'bandit' || foe.kind === 'patrol' || foe.kind === 'lord' ? 'ally' : null;
  }

  /** A compass word for a direction on the map (y grows southward). */
  function compass(dx, dy) {
    const words = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const a = Math.atan2(dy, dx);
    return words[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }

  /**
   * The parties that will join a battle at the player's position, nearest first.
   * @param {Campaign} c @param {any} e the open encounter (CL.parties.current())
   * @returns {Array<{ id: number, template: string, name: string, side: string, troops: Record<string, number>, size: number, hours: number, arriveAt: number, seen: boolean, dir: { x: number, y: number }, from: string }>}
   */
  function plan(c, e) {
    const foe = foeOf(e);
    if (!foe || foe.quest || !Array.isArray(c.parties)) return [];
    const W = CL.world;
    const at = c.world;
    const limit = CL.clock.hours('battle');
    const out = [];
    // W-07: only parties near enough to hear the fight (the grid narrows the search; the order of
    // the result is by arrival, so it is the same as a full scan's).
    const hear = Math.max(0, ...Object.values(CL.content.table('party_templates')).map((t) => t.detection || 0)) * AWARE;
    for (const p of CL.spatial.near(CL.spatial.build(c.parties), at.x, at.y, hear)) {
      if (p.id === foe.partyId || !troopCount(p.troops)) continue;
      const side = sideOf(c, p, foe);
      if (!side) continue;
      const t = tpl(p.template);
      const d = W.mapDist(p.x, p.y, at.x, at.y);
      if (d > t.detection * AWARE) continue; // they don't hear it
      const speed = t.speed * W.map().terrain[W.terrainAt(p.x, p.y)];
      const hours = speed > 0 ? d / speed : Number.POSITIVE_INFINITY;
      if (hours > limit) continue; // can't get there in time
      const len = d || 1;
      const dir = { x: d ? (p.x - at.x) / len : 0, y: d ? (p.y - at.y) / len : -1 };
      out.push({
        id: p.id,
        template: t.id,
        name: t.name,
        side,
        troops: { ...p.troops },
        size: troopCount(p.troops),
        hours,
        arriveAt: Math.max(MIN_ARRIVAL, hours * SECONDS_PER_HOUR),
        seen: d <= SIGHT,
        dir,
        from: compass(dir.x, dir.y),
      });
    }
    out.sort((a, b) => a.hours - b.hours || a.id - b.id);
    return out.slice(0, MAX_PARTIES);
  }

  /** A sentence for the encounter screen about the parties your company can see. @param {Campaign} c @param {any} e */
  function note(c, e) {
    const seen = plan(c, e).filter((j) => j.seen);
    return seen
      .map((j) => (j.side === 'ally' ? ` A ${j.name} (${j.size}) is close by, to the ${j.from}, and would ride to your aid.` : ` More of them are close by: ${j.name} (${j.size}), to the ${j.from}, would join the fight against you.`))
      .join('');
  }

  // ---- In the battle ----

  /** Start of a battle: the plan for this fight (combat.startBattle). @param {any} g */
  function begin(g) {
    g.joining = [];
    if (g.practice || g.duel || !CL.campaign || !CL.parties) return;
    const e = CL.parties.current(CL.campaign);
    g.joining = plan(CL.campaign, e).map((j) => ({ ...j, warned: false, arrived: false }));
    for (const j of g.joining) if (j.seen) announce(g, j);
  }

  function announce(g, j) {
    j.warned = true;
    const eta = Math.max(1, Math.round(j.arriveAt - g.t));
    CL.ui.message(j.side === 'ally' ? `${j.name} (${j.size}) riding to your aid from the ${j.from} · about ${eta} s` : `${j.name} (${j.size}) coming from the ${j.from} to join the enemy · about ${eta} s`);
    CL.diag.log('info', 'Reinforcements sighted', { party: j.id, side: j.side, arriveAt: j.arriveAt });
  }

  /**
   * Where on the field units coming from map direction `dir` ride in: the edge facing that way, slid
   * along it until no opponent stands close. @param {any} g @param {{ x: number, y: number }} dir
   */
  function entryPoint(g, dir, side) {
    const b = g.battleMap.bounds || CL.units.BOUNDS;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const hx = (b.maxX - b.minX) / 2 - EDGE_INSET;
    const hy = (b.maxY - b.minY) / 2 - EDGE_INSET;
    const k = Math.min(Math.abs(dir.x) > 1e-6 ? hx / Math.abs(dir.x) : Number.POSITIVE_INFINITY, Math.abs(dir.y) > 1e-6 ? hy / Math.abs(dir.y) : Number.POSITIVE_INFINITY);
    const base = { x: cx + dir.x * k, y: cy + dir.y * k };
    const foes = side === 'ally' ? g.enemies : [g.hero, ...g.allies];
    const along = Math.abs(dir.x) * hx >= Math.abs(dir.y) * hy ? { x: 0, y: 1 } : { x: 1, y: 0 }; // slide along the edge
    for (let i = 0; i < 12; i++) {
      const off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 80;
      const x = Math.max(b.minX + EDGE_INSET, Math.min(b.maxX - EDGE_INSET, base.x + along.x * off));
      const y = Math.max(b.minY + EDGE_INSET, Math.min(b.maxY - EDGE_INSET, base.y + along.y * off));
      if (!foes.some((u) => u?.alive && Math.hypot(u.x - x, u.y - y) < CLEAR)) return { x, y, along };
    }
    return { ...base, along };
  }

  /** Put one arriving soldier on the field at its party's entry point. @param {any} g @param {any} j */
  function place(g, j, u) {
    j.entry ??= entryPoint(g, j.dir, j.side);
    const n = j.placed || 0;
    j.placed = n + 1;
    const off = ((n % 5) - 2) * 30;
    const back = Math.floor(n / 5) * 30;
    u.x = j.entry.x + j.entry.along.x * off + j.dir.x * back;
    u.y = j.entry.y + j.entry.along.y * off + j.dir.y * back;
    CL.units.resolveObstacles(u);
    u.face = j.dir.x > 0 ? 'left' : 'right';
    u.join = j.id;
    u.holdX = u.x;
    u.holdY = u.y;
    if (j.side === 'ally') u.outside = true; // fights for itself: no orders, ranks or company morale
    return u;
  }

  /**
   * A party rides onto the field: as many as the whole field has room for (the battle-size cap counts
   * everyone), the rest wait in reserve and step in as others fall. @param {any} g @param {any} j
   */
  function arrive(g, j) {
    j.arrived = true;
    j.warned = true;
    const list = A().expand(j.troops);
    const ally = j.side === 'ally';
    const alive = (arr) => arr.reduce((n, u) => n + (u.alive && !u.routing ? 1 : 0), 0);
    let room = CL.combat.BATTLE.activeCap - alive(g.allies) - (g.hero.alive ? 1 : 0) - alive(g.enemies);
    let waiting = 0;
    for (const troop of list) {
      if (room > 0) {
        room--;
        if (ally) g.allies.push(place(g, j, CL.units.makeUnit(0, 0, 'ally', troop)));
        else CL.combat.addEnemy(g, { troop, join: j.id });
      } else {
        waiting++;
        (ally ? g.allyReserve : g.enemyReserve).push(ally ? { troop, soldierId: null, join: j.id } : { troop, join: j.id });
      }
    }
    // Their side's share of the field grows by those who rode in, so reserves keep to the new size.
    if (ally) g.allyCap = Math.max(g.allyCap ?? 0, alive(g.allies) + (g.hero.alive ? 1 : 0));
    else g.enemyCap = Math.max(g.enemyCap ?? 0, alive(g.enemies));
    CL.ui.message(ally ? `The ${j.name} arrive to fight beside you!${waiting ? ` (${waiting} more waiting)` : ''}` : `More ${j.name} join the fight!${waiting ? ` (${waiting} more waiting)` : ''}`);
    CL.diag.log('info', 'Reinforcements arrived', { party: j.id, side: j.side, troops: j.troops, waiting });
  }

  /** Each frame of a battle: warnings and arrivals. @param {any} g */
  function update(g) {
    if (g.mode !== 'battle' || !g.joining?.length) return;
    for (const j of g.joining) {
      if (j.arrived) continue;
      if (!j.warned && g.t >= j.arriveAt - WARN) announce(g, j);
      if (g.t >= j.arriveAt) arrive(g, j);
    }
  }

  /** One of a party's soldiers fell (combat.hit): kept on the party, since waves clear the field. @param {any} g @param {Unit} u */
  function onDown(g, u) {
    const j = g.joining?.find((x) => x.id === u.join);
    if (!j) return;
    j.fallen ??= [];
    j.fallen.push(u.troop);
  }

  /** Who came and who fell, for the commit (party.endBattle). Those who fled live on. @param {any} g */
  function outcome(g) {
    return (g.joining || []).map((j) => ({ id: j.id, side: j.side, arrived: j.arrived, fallen: [...(j.fallen || [])] }));
  }

  /** Is this party locked in a battle being committed? @param {any} p */
  const locked = (p) => Boolean(CL.game?.lock?.has(p.id));

  /** Lock the parties in this battle until it commits. @param {any} g */
  function lock(g, ids) {
    g.lock = new Set(ids.filter((id) => id != null));
  }

  /**
   * Inside the battle's commit: move the parties that fought to the battle, take out those who fell,
   * and break an enemy party on your victory. @param {Campaign} c @param {boolean} win
   * @param {Array<{ id: number, side: string, arrived: boolean, fallen: string[] }>} list
   */
  function apply(c, win, list) {
    const P = CL.parties;
    for (const r of list || []) {
      if (!r.arrived) continue; // too late: they took no part
      const p = P.find(c, r.id);
      if (!p) continue;
      Object.assign(p, { x: c.world.x, y: c.world.y, tx: null, ty: null, chasing: null });
      A().removeTroops(p.troops, r.fallen);
      const beaten = r.side === 'enemy' && win;
      CL.events.emit(c, 'ReinforcementsArrived', { party: p.template, side: r.side, fallen: r.fallen.length, beaten, resultId: CL.game.resultId });
      if (beaten || !troopCount(p.troops)) P.remove(c, p);
      else if (r.side === 'enemy') p.ignoreUntil = c.day + 1; // they won: they let the company go
      CL.diag.log('info', 'Reinforcements resolved', { party: r.id, side: r.side, fallen: r.fallen.length, beaten });
    }
  }

  /**
   * Auto-resolve with the same parties (all of them arrive within the battle's hours): their strength
   * on each side, and who falls. @param {Campaign} c @param {any} e
   */
  function forAuto(c, e) {
    const list = plan(c, e).filter((j) => j.arriveAt <= AUTO_WINDOW);
    const power = (side) => list.filter((j) => j.side === side).reduce((n, j) => n + A().troopsPower(j.troops), 0);
    const lines = list.map((j) => `${j.side === 'ally' ? 'Riding to your aid' : 'Joining them'}: ${j.name} (${j.size}) ${A().troopsPower(j.troops).toFixed(1)}.`);
    return { list, allyPower: power('ally'), enemyPower: power('enemy'), lines };
  }

  CL.reinforce = { SECONDS_PER_HOUR, MIN_ARRIVAL, WARN, AUTO_WINDOW, SIGHT, MAX_PARTIES, sideOf, plan, note, begin, update, entryPoint, place, arrive, onDown, outcome, lock, locked, apply, forAuto, compass };
})(typeof window !== 'undefined' ? window : globalThis);
