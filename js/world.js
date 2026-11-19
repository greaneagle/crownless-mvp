// @ts-check
/* Crownless strategic world map: travel, terrain, campaign time, settlements and sites.
 * State lives in CL.campaign.world (saved); the current journey is CL.game.travel (transient).
 * Pure logic — DOM only through CL.ui hooks. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { clamp } = CL.util;

  // Map units → world pixels: the 2.0 projection, which the map camera (js/mapview.js, W-02) pans
  // and zooms. 1 map unit = 8.8 px across and 4.96 px down, inside a margin of 40 × 22 px.
  const VIEW = { x0: 40, y0: 22, sx: 8.8, sy: 4.96 };
  const HOURS_PER_SECOND = 4; // game hours that pass per real second of travel
  const HIT_RADIUS_PX = 28; // ≈ 38 CSS px wide on a small landscape phone
  const ARRIVE_EPSILON = 0.05;

  /**
   * The world being played (W-04): the campaign's own (its saved worldId) when this build has it,
   * otherwise the first world in the content, which a new game starts in.
   */
  const defaultId = () => Object.keys(CL.content.table('world_map'))[0];
  function id() {
    const w = CL.campaign?.worldId;
    return w && CL.content.table('world_map')[w] ? w : defaultId();
  }
  const map = () => CL.content.get('world_map', id());
  /** The map's size in map units: { w, h } (100 × 100 for the Border March). */
  const bounds = () => map().bounds || { w: 100, h: 100 };
  /** A map point kept inside the map, `margin` units from its edges. @returns {[number, number]} */
  function clampToMap(x, y, margin = 0) {
    const b = bounds();
    return [clamp(x, margin, b.w - margin), clamp(y, margin, b.h - margin)];
  }
  /** Is a map point inside the map? */
  const inBounds = (x, y) => x >= 0 && y >= 0 && x <= bounds().w && y <= bounds().h;
  /** The world's start settlement (a new game begins there; fallbacks point at it). */
  const start = () => settlement(map().start);
  /** The named area holding a map point (data `regions`), or null. */
  function regionAt(x, y) {
    for (const [rid, r] of Object.entries(map().regions || {})) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { id: rid, name: r.name };
    return null;
  }
  const world = () => CL.campaign.world;
  const settlement = (id) => CL.content.get('settlements', id);
  const site = (id) => map().sites[id];
  const settlements = () => Object.values(CL.content.table('settlements'));

  /** Map units → world pixels (the whole map at 1×; on today's map, the canvas itself). */
  const toPx = (x, y) => [VIEW.x0 + x * VIEW.sx, VIEW.y0 + y * VIEW.sy];
  const fromPx = (px, py) => [(px - VIEW.x0) / VIEW.sx, (py - VIEW.y0) / VIEW.sy];
  /** Map units → canvas pixels through the map camera (2.0's toPx until the player pans or zooms). */
  const toScreen = (x, y) => (CL.mapView ? CL.mapView.toScreen(x, y) : toPx(x, y));
  const fromScreen = (px, py) => (CL.mapView ? CL.mapView.toMap(px, py) : fromPx(px, py));
  /**
   * Gameplay distance (W-02: separate from the view). A unit north–south counts MAP_ASPECT of one
   * east–west, as 2.0's drawing had it (4.96 / 8.8), but it comes with the map's data, so no zoom,
   * pan or drawing change can alter a journey, a contact or any rule.
   */
  const MAP_ASPECT_DEFAULT = 4.96 / 8.8;
  const aspect = () => map().aspect ?? MAP_ASPECT_DEFAULT;
  const mapDist = (ax, ay, bx, by) => Math.hypot(bx - ax, (by - ay) * aspect());

  function defaultState() {
    const m = map();
    const s = settlement(m.start);
    const sites = {};
    for (const id of Object.keys(m.sites)) sites[id] = { clearedUntil: 0 };
    return { x: s.mapX, y: s.mapY, location: s.id, sites };
  }

  // ---- Terrain ----

  function distToSegment(px, py, ax, ay, bx, by) {
    const k = aspect();
    const [dx, dy] = [bx - ax, (by - ay) * k];
    const [qx, qy] = [px - ax, (py - ay) * k];
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

  /** Is (x, y) within `width` map units of a polyline? */
  function nearLine(x, y, line, width) {
    for (let i = 1; i < line.length; i++) if (distToSegment(x, y, ...line[i - 1], ...line[i]) <= width) return true;
    return false;
  }

  /**
   * The kind of ground at a map point (W-05a; every kind has a speed factor in the world's `terrain`):
   * a ford or bridge first (they are where rivers are crossed, roads too); then a road (it runs
   * through forests and is the pass through mountains); a river; an area of hills, mountain or marsh;
   * a forest; otherwise grass. The Border March has roads, forests and grass only.
   */
  function terrainAt(x, y) {
    const m = map();
    const waters = m.waters || [];
    for (const w of waters) for (const c of w.crossings || []) if (mapDist(x, y, c.x, c.y) <= c.r) return c.kind;
    if (roadSegments().some((s) => distToSegment(x, y, ...s) <= m.roadWidth)) return 'road';
    for (const w of waters) if (nearLine(x, y, w.line, w.width)) return 'river';
    for (const a of m.areas || []) if (inPolygon(x, y, a.poly)) return a.kind;
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
   * Which battle map a fight at (x, y) uses (W-05a: the world's `battleMaps`): the one for the ground
   * there (forest, a river or ford, hills, marsh, mountain), otherwise the fort approach near a fort,
   * otherwise open country. On the Border March: the forest wilds in woodland, the courtyard near
   * Greywall or Ashgate, the open country elsewhere.
   */
  const FORT_RADIUS = 6;
  function battleMapAt(x, y) {
    // Large battlefields (V2-05); js/arena.js swaps in the one-screen maps with Battlefield: Small.
    const maps = map().battleMaps;
    const kind = maps[terrainAt(x, y)];
    if (kind) return kind;
    const nearFort = settlements().some((s) => s.type === 'fort' && mapDist(x, y, s.mapX, s.mapY) <= FORT_RADIUS);
    return nearFort ? maps.fort : maps.open;
  }

  // ---- Sites ----

  function siteActive(id) {
    return CL.campaign.day >= (world().sites[id]?.clearedUntil ?? 0);
  }

  // ---- Travel ----

  /** True when a map point sits on a settlement or site (whose label would collide). */
  function onLandmark(mx, my) {
    const near = (x, y) => mapDist(mx, my, x, y) < 3;
    return settlements().some((s) => near(s.mapX, s.mapY)) || Object.values(map().sites).some((s) => near(s.mapX, s.mapY));
  }

  /** Where a party is drawn on the canvas: beside a landmark it stands on, otherwise at its position. */
  function partyDrawPos(p) {
    const [x, y] = toScreen(p.x, p.y);
    return onLandmark(p.x, p.y) ? { x: x + 20, y: y - 14, crowded: true } : { x, y, crowded: false };
  }

  /**
   * What is under canvas pixel (px, py), through the map camera: icons are drawn at a fixed size, so
   * the hit radius is the same 28 px at every zoom.
   */
  function targetAt(px, py) {
    // Moving parties first: they can stand on top of places.
    for (const p of CL.campaign.parties || []) {
      if (!CL.sight.playerSees(CL.campaign, p)) continue; // only parties the company can see (P7-04)
      const { x: sx, y: sy } = partyDrawPos(p);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX * 0.8) return { type: 'party', id: p.id, x: p.x, y: p.y };
    }
    for (const s of settlements()) {
      const [sx, sy] = toScreen(s.mapX, s.mapY);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX) return { type: 'settlement', id: s.id, x: s.mapX, y: s.mapY };
    }
    for (const st of Object.values(map().sites)) {
      const [sx, sy] = toScreen(st.mapX, st.mapY);
      if (Math.hypot(px - sx, py - sy) <= HIT_RADIUS_PX) return { type: 'site', id: st.id, x: st.mapX, y: st.mapY };
    }
    const [x, y] = fromScreen(px, py);
    const [cx, cy] = clampToMap(x, y);
    return { type: 'point', id: null, x: cx, y: cy };
  }

  /** Start travelling toward a target. Clicking where you already stand arrives at once. */
  function travelTo(target) {
    const w = world();
    w.location = null;
    delete w.hidden; // setting off breaks the Hide stance (P7-04)
    CL.game.waiting = false;
    CL.game.travel = target;
    if (mapDist(w.x, w.y, target.x, target.y) <= ARRIVE_EPSILON) arrive(target);
    else CL.scout?.onSetOff(CL.campaign, target); // how long, and what is known on the way (P7-02)
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
    g.travelFace = Math.abs(t.x - w.x) > Math.abs((t.y - w.y) * aspect()) ? (t.x < w.x ? 'left' : 'right') : t.y < w.y ? 'up' : 'down';
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
      CL.merchant?.visit(CL.campaign); // the merchant trades its budget here (V2-12)
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

  /** P7-04: take or break the Hide stance (in a forest, standing still). */
  function toggleHide() {
    const c = CL.campaign;
    const on = CL.sight.setHidden(c, !CL.sight.hidden(c));
    CL.ui.message(on ? 'Your company hides among the trees: much harder to spot until you set off.' : CL.sight.canHide(c) ? 'You come out of hiding.' : 'Hide in a forest, standing still.');
    return on;
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
        nearestSettlement(w.x, w.y, (x) => CL.realm.isKingdom(CL.realm.owner(x.id, c)) && CL.realm.welcomes(c, x.id)) ||
        nearestSettlement(w.x, w.y, (x) => CL.realm.isKingdom(CL.realm.owner(x.id, c))) ||
        start();
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
      [s.x, s.y] = clampToMap(d.x, d.y);
    }
    s.location = d.location && CL.content.table('settlements')[d.location] ? d.location : null;
    if (d.hidden === true && !s.location) s.hidden = true; // the Hide stance (P7-04)
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
    id,
    defaultId,
    bounds,
    clampToMap,
    inBounds,
    start,
    regionAt,
    VIEW,
    HIT_RADIUS_PX,
    HOURS_PER_SECOND,
    map,
    toPx,
    fromPx,
    toScreen,
    fromScreen,
    aspect,
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
    toggleHide,
    checkContact,
    nearestSettlement,
    onBattleResolved,
    returnToMap,
    clockLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
