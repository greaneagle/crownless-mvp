// @ts-check
/* Crownless strategic world map: travel, terrain, campaign time, settlements and sites.
 * State lives in CL.campaign.world (saved); the current journey is CL.game.travel (transient).
 * Pure logic — DOM only through CL.ui hooks. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { clamp } = CL.util;

  const MAP_ID = 'border_march';
  // Map units → canvas pixels. Distances are measured on screen proportions so the time a
  // journey takes matches how far it looks: 1 map unit = 8.8 px across, 4.96 px down.
  const VIEW = { x0: 40, y0: 22, sx: 8.8, sy: 4.96 };
  const Y_ASPECT = VIEW.sy / VIEW.sx;
  const HOURS_PER_SECOND = 4; // game hours that pass per real second of travel
  const HIT_RADIUS_PX = 28; // ≈ 38 CSS px wide on a small landscape phone
  const ARRIVE_EPSILON = 0.05;

  const map = () => CL.content.get('world_map', MAP_ID);
  const world = () => CL.campaign.world;
  const settlement = (id) => CL.content.get('settlements', id);
  const site = (id) => map().sites[id];
  const settlements = () => Object.values(CL.content.table('settlements'));

  const toPx = (x, y) => [VIEW.x0 + x * VIEW.sx, VIEW.y0 + y * VIEW.sy];
  const fromPx = (px, py) => [(px - VIEW.x0) / VIEW.sx, (py - VIEW.y0) / VIEW.sy];
  const mapDist = (ax, ay, bx, by) => Math.hypot(bx - ax, (by - ay) * Y_ASPECT);

  function defaultState() {
    const m = map();
    const s = settlement(m.startSettlement);
    const sites = {};
    for (const id of Object.keys(m.sites)) sites[id] = { clearedUntil: 0 };
    return { x: s.mapX, y: s.mapY, location: s.id, sites };
  }

  // ---- Terrain ----

  function distToSegment(px, py, ax, ay, bx, by) {
    const [dx, dy] = [bx - ax, (by - ay) * Y_ASPECT];
    const [qx, qy] = [px - ax, (py - ay) * Y_ASPECT];
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp((qx * dx + qy * dy) / len2, 0, 1);
    return Math.hypot(qx - t * dx, qy - t * dy);
  }

  function roadSegments() {
    const segs = [];
    for (const road of map().roads) {
      for (let i = 1; i < road.length; i++) {
        const a = settlement(road[i - 1]);
        const b = settlement(road[i]);
        segs.push([a.mapX, a.mapY, b.mapX, b.mapY]);
      }
    }
    return segs;
  }

  function inPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /** 'road' | 'forest' | 'grass'. Roads run through forests, so road wins. */
  function terrainAt(x, y) {
    const m = map();
    if (roadSegments().some((s) => distToSegment(x, y, ...s) <= m.roadWidth)) return 'road';
    if (m.forests.some((poly) => inPolygon(x, y, poly))) return 'forest';
    return 'grass';
  }

  /**
   * GDD §3: Speed = BaseSpeed × TerrainFactor × PartyLoadFactor (cargo), then × the hero's
   * Pathfinding/horse bonus.
   */
  function speedAt(x, y) {
    const m = map();
    return m.baseSpeed * m.terrain[terrainAt(x, y)] * CL.trade.loadFactor(CL.campaign) * CL.character.travelFactor();
  }

  /**
   * Which battle map a fight at (x, y) uses: the forest clearing in woodland, the fort approach
   * near Greywall or Ashgate, otherwise the open field.
   */
  const FORT_RADIUS = 6;
  function battleMapAt(x, y) {
    // Large battlefields (V2-05); js/arena.js swaps in the one-screen maps with Battlefield: Small.
    if (terrainAt(x, y) === 'forest') return 'forest_wilds';
    const nearFort = settlements().some((s) => s.type === 'fort' && mapDist(x, y, s.mapX, s.mapY) <= FORT_RADIUS);
    return nearFort ? 'greywall_courtyard' : 'open_country';
  }

  // ---- Sites ----

  function siteActive(id) {
    return CL.campaign.day >= (world().sites[id]?.clearedUntil ?? 0);
  }

  // ---- Travel ----

  /** Choose what was clicked at canvas pixel (px, py): a settlement, a site or open ground. */
  /** True when a map point sits on a settlement or site (whose label would collide). */
  function onLandmark(mx, my) {
    const near = (x, y) => mapDist(mx, my, x, y) < 3;
    return settlements().some((s) => near(s.mapX, s.mapY)) || Object.values(map().sites).some((s) => near(s.mapX, s.mapY));
  }

  /** Where a party is drawn: beside a landmark it stands on, otherwise at its position. */
  function partyDrawPos(p) {
    const [x, y] = toPx(p.x, p.y);
    return onLandmark(p.x, p.y) ? { x: x + 20, y: y - 14, crowded: true } : { x, y, crowded: false };
  }

  function targetAt(px, py) {
    // Moving parties first: they can stand on top of places.
    for (const p of CL.campaign.parties || []) {
      const { x: sx, y: sy } = partyDrawPos(p);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX * 0.8) return { type: 'party', id: p.id, x: p.x, y: p.y };
    }
    for (const s of settlements()) {
      const [sx, sy] = toPx(s.mapX, s.mapY);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX) return { type: 'settlement', id: s.id, x: s.mapX, y: s.mapY };
    }
    for (const st of Object.values(map().sites)) {
      const [sx, sy] = toPx(st.mapX, st.mapY);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX) return { type: 'site', id: st.id, x: st.mapX, y: st.mapY };
    }
    const [x, y] = fromPx(px, py);
    return { type: 'point', id: null, x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  }

  /** Start travelling toward a target. Clicking where you already stand arrives at once. */
  function travelTo(target) {
    const w = world();
    w.location = null;
    CL.game.waiting = false;
    CL.game.travel = target;
    if (mapDist(w.x, w.y, target.x, target.y) <= ARRIVE_EPSILON) arrive(target);
  }

  function click(px, py) {
    if (CL.game.mode !== 'map') return;
    travelTo(targetAt(px, py));
  }

  function stop() {
    if (CL.game.travel) {
      CL.game.travel = null;
      CL.ui.message('Halted');
    }
  }

  /** Advance travel by dt real seconds. Returns game hours spent. */
  /** A band caught the player during the last stretch of time: stop and face them. */
  function checkContact() {
    const g = CL.game;
    if (g.contactParty == null) return false;
    const id = g.contactParty;
    g.contactParty = null;
    g.waiting = false;
    CL.parties.open(id, { caught: true }); // they came at you: an ambush (V2-07)
    return true;
  }

  function update(dt) {
    const g = CL.game;
    if (g.mode !== 'map') return 0;
    if (!g.travel) {
      if (!g.waiting) return 0;
      const hours = Math.min(dt, 0.1) * HOURS_PER_SECOND;
      CL.clock.advance(CL.campaign, hours, 'wait');
      CL.save.autosave(); // once per game day on the map
      checkContact();
      return hours;
    }
    const w = world();
    const t = g.travel;
    if (t.type === 'party') {
      // Chase a moving party: aim at where it is now.
      const p = CL.parties.find(CL.campaign, t.id);
      if (!p) {
        g.travel = null;
        CL.ui.message('They have moved on.');
        return 0;
      }
      [t.x, t.y] = [p.x, p.y];
      if (mapDist(w.x, w.y, p.x, p.y) <= CL.parties.CONTACT) {
        arrive(t);
        return 0;
      }
    }
    const remaining = mapDist(w.x, w.y, t.x, t.y);
    const speed = speedAt(w.x, w.y);
    let hours = Math.min(dt, 0.1) * HOURS_PER_SECOND;
    const step = speed * hours;
    if (step >= remaining) {
      hours = remaining / speed;
      w.x = t.x;
      w.y = t.y;
    } else {
      const k = step / remaining;
      w.x += (t.x - w.x) * k;
      w.y += (t.y - w.y) * k;
    }
    g.travelFace = Math.abs(t.x - w.x) > Math.abs((t.y - w.y) * Y_ASPECT) ? (t.x < w.x ? 'left' : 'right') : t.y < w.y ? 'up' : 'down';
    CL.clock.advance(CL.campaign, hours, 'travel');
    CL.save.autosave(); // once per game day on the map
    if (checkContact()) return hours;
    if (w.x === t.x && w.y === t.y) arrive(t);
    return hours;
  }

  /** Hours a journey would take from the current position (for UI hints and tests). */
  function estimateHours(x, y, samples = 40) {
    const w = world();
    let hours = 0;
    for (let i = 0; i < samples; i++) {
      const a = i / samples;
      const b = (i + 1) / samples;
      const [ax, ay] = [w.x + (x - w.x) * a, w.y + (y - w.y) * a];
      const [bx, by] = [w.x + (x - w.x) * b, w.y + (y - w.y) * b];
      hours += mapDist(ax, ay, bx, by) / speedAt((ax + bx) / 2, (ay + by) / 2);
    }
    return hours;
  }

  function arrive(t) {
    const g = CL.game;
    g.travel = null;
    if (t.type === 'settlement') {
      world().location = t.id;
      CL.save.write(); // GDD §13: autosave when entering a settlement
      const nudge = CL.portable.reminder();
      if (nudge) {
        const remind = () => CL.ui.message(nudge);
        if (root.setTimeout) root.setTimeout(remind, 1500); // after the arrival news has been read
        else remind(); // no timers (Node tests)
      }
      CL.diag.log('info', 'Entered settlement', { id: t.id, day: CL.campaign.day });
      CL.story.emit('enter', { settlement: t.id });
      CL.contracts.onArrive(CL.campaign, t.id); // deliveries and escorts are paid on arrival
      CL.quartermaster?.act(CL.campaign); // wages set aside and food bought from the chest (V2-11)
      CL.town.enterPlace(); // the settlement menu; walkable places offer "Walk the streets" from it
    } else if (t.type === 'party') {
      // Riding up to the caravan you escort just puts you at its side.
      if (CL.parties.find(CL.campaign, t.id)?.escortTo) CL.ui.message('You ride beside the caravan.');
      else CL.parties.open(t.id);
    } else if (t.type === 'site') {
      if (siteActive(t.id)) {
        g.siteId = t.id;
        g.partyId = null;
        g.caught = false;
        CL.encounter.begin(); // whatever the player chooses commits under this result ID
        CL.ui.changeMode('encounter');
      } else {
        const back = CL.party.dayNumber(world().sites[t.id].clearedUntil);
        CL.ui.message(`${site(t.id).name} lies empty. The reavers may return by day ${back}.`);
      }
    }
  }

  function leaveSettlement() {
    world().location = null;
    Object.assign(CL.game, { town: null, talk: null });
    CL.ui.changeMode('map');
  }

  function attackSite() {
    CL.parties.attack(); // shared encounter flow for sites and bands
  }

  function toggleWait() {
    const g = CL.game;
    if (g.mode !== 'map') return;
    g.travel = null;
    g.waiting = !g.waiting;
    CL.ui.message(g.waiting ? 'Waiting… time passes.' : 'You break camp.');
  }

  function nearestSettlement(x, y, predicate = () => true) {
    let best = null;
    for (const s of settlements().filter(predicate)) {
      const d = mapDist(x, y, s.mapX, s.mapY);
      if (!best || d < best.d) best = { s, d };
    }
    return best?.s || null;
  }

  /**
   * Called by party.endBattle inside the result transaction (before the save).
   * Victory clears the site for a while; defeat means capture and release near a settlement.
   */
  function onBattleResolved(win, siteId) {
    const w = world();
    if (win && siteId && w.sites[siteId]) {
      w.sites[siteId].clearedUntil = CL.campaign.day + site(siteId).respawnDays;
    }
    if (!win) {
      CL.clock.pass(CL.campaign, 'capture'); // held captive, then released (data/world_map.js time.capture)
      const c = CL.campaign;
      const s =
        nearestSettlement(w.x, w.y, (x) => CL.realm.owner(x.id, c) !== 'neutral' && CL.realm.welcomes(c, x.id)) ||
        nearestSettlement(w.x, w.y, (x) => CL.realm.owner(x.id, c) !== 'neutral');
      w.x = s.mapX;
      w.y = s.mapY;
      w.location = null;
      CL.game.releasedAt = s.id;
    }
  }

  /** After the result screen: back to the map (and its release message after a capture). */
  function returnToMap() {
    const g = CL.game;
    g.siteId = null;
    g.partyId = null;
    CL.ui.changeMode('map');
    if (g.releasedAt) {
      CL.ui.message(`Your captors release you outside ${settlement(g.releasedAt).name}.`);
      g.releasedAt = null;
    }
  }

  /** Validate a saved world block; returns a clean copy or defaults. */
  function sanitize(d) {
    const s = defaultState();
    if (!d || typeof d !== 'object') return s;
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    if (num(d.x) && num(d.y)) {
      s.x = clamp(d.x, 0, 100);
      s.y = clamp(d.y, 0, 100);
    }
    s.location = d.location && CL.content.table('settlements')[d.location] ? d.location : null;
    for (const id of Object.keys(s.sites)) {
      const c = d.sites?.[id]?.clearedUntil;
      if (num(c) && c >= 0) s.sites[id].clearedUntil = c;
    }
    return s;
  }

  function clockLabel(day = CL.campaign.day) {
    const hour = Math.floor((day % 1) * 24);
    return `Day ${CL.party.dayNumber(day)}, ${String(hour).padStart(2, '0')}:00`;
  }

  CL.world = {
    MAP_ID,
    VIEW,
    HOURS_PER_SECOND,
    map,
    toPx,
    fromPx,
    partyDrawPos,
    mapDist,
    defaultState,
    sanitize,
    terrainAt,
    speedAt,
    battleMapAt,
    siteActive,
    targetAt,
    travelTo,
    click,
    stop,
    update,
    estimateHours,
    leaveSettlement,
    attackSite,
    toggleWait,
    checkContact,
    nearestSettlement,
    onBattleResolved,
    returnToMap,
    clockLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
