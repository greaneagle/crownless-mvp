/* Crownless canvas rendering and battle HUD text. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { W, H } = CL;
  // W-01: every canvas font comes from the player's text size (CL.settings.font); `fixed` is only for
  // letters that are part of an icon's art (the emblem on a flag or a party marker).
  const font = (px, opts) => CL.settings?.font(px, opts) ?? `bold ${px}px Georgia`;
  const ts = () => CL.settings?.textScale() ?? 1;
  /** The top-left HUD's short form, at the Larger text size. */
  const compactHud = () => ts() >= 1.3;

  let ctx = null;


  let backing = 1; // canvas pixels per game pixel (P10-G1: from the Sharpness setting and the screen)

  function init(canvas) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    fit();
    root.addEventListener?.('resize', () => fit());
  }

  /**
   * P10-G1 (D-P10k): the canvas at the screen's real pixels, so the art drawn in code is crisp. The game
   * still works in 960×540 units: every frame starts from this scale, and input maps taps through the
   * canvas's on-screen size, so no rule or coordinate changes. The Sharpness setting caps the pixels per
   * CSS pixel (Sharp 3, Balanced 2); never fewer than the classic 960×540, which Fast keeps, scaled up
   * pixel by pixel as before. Called at start, on a resize and when the setting changes.
   * @returns {number} the backing scale
   */
  function fit() {
    if (!ctx) return backing;
    const cap = CL.settings?.SHARPNESS?.[CL.settings.get('sharpness')] ?? 2;
    const css = ctx.canvas.getBoundingClientRect?.().width || W;
    const k = cap ? Math.max(1, Math.round(((css * Math.min(root.devicePixelRatio || 1, cap)) / W) * 100) / 100) : 1;
    ctx.canvas.style.imageRendering = cap ? 'auto' : 'pixelated';
    if (k !== backing || ctx.canvas.width !== Math.round(W * k)) setBackingScale(k);
    return backing;
  }

  /** Set the backing scale directly (fit() chooses it; tests and the benchmark may set it). */
  function setBackingScale(k) {
    backing = k;
    ctx.canvas.width = Math.round(W * k);
    ctx.canvas.height = Math.round(H * k);
    ctx.imageSmoothingEnabled = false; // a resize resets the context
    return backing;
  }


  /** Battle ground for the current map: base colour, tiled texture, patches, decor (no collision). */
  /**
   * The battle ground, in world pixels (drawn through the camera). A one-screen map draws exactly as
   * before; a larger arena (PROTO-A) draws only the part in view.
   */
  /**
   * P9-B1: in a big battle (more than `from` at once) the drawing is thinned, as the Reduced effects
   * setting does: no hit rings, health bars only on the badly hurt, and the fallen fade from the field
   * after `bodyLasts` seconds (the hero and the companions never fade).
   */
  const BUSY = { from: 80, bodyLasts: 20, bodyFade: 3, hurt: 0.5 };
  const busyBattle = () => (CL.combat?.BATTLE.activeCap ?? 0) > BUSY.from;
  /** How visible a fallen body is now: 0.5 once settled, fading after a while in a big battle. @param {Unit} u */
  function bodyAlpha(u) {
    const age = CL.game.t - u.downAt;
    if (age < 0.25) return 0.9 - age * 1.6;
    if (!busyBattle() || u.role === 'hero' || u.companion) return 0.5;
    return 0.5 * Math.max(0, Math.min(1, (BUSY.bodyLasts + BUSY.bodyFade - age) / BUSY.bodyFade));
  }

  function updateHud() {
    const g = CL.game;
    const $ = CL.ui.$;
    const maxHp = g.hero.maxhp;
    // P11-07: the quiver's count beside the health, while a bow or crossbow is in hand.
    const shots = g.loadout?.ammo?.[g.loadout.which];
    const quiver = shots != null && g.hero.ranged ? ` · ${g.hero.ranged.crossbow ? 'Bolts' : 'Arrows'} ${shots}` : '';
    $('#hptext').textContent = `Hero HP: ${Math.max(0, Math.ceil(g.hero.hp))} / ${maxHp}${quiver}`;
    $('#hpfill').style.width = `${(g.hero.hp / maxHp) * 100}%`;
    const [allies, enemies] = [g.allies.filter((x) => x.alive).length, g.enemies.filter((x) => x.alive).length];
    const reserves = g.allyReserve?.length || g.enemyReserve?.length ? [g.allyReserve?.length || 0, g.enemyReserve?.length || 0] : null;
    // At the largest text size the line is shortened rather than crowding the field (W-01); numbers stay whole.
    $('#summary').textContent = compactHud()
      ? `${allies} v ${enemies} · Wave ${g.wave}/${g.totalWaves}${reserves ? ` · Res ${reserves[0]}/${reserves[1]}` : ''}`
      : `Allies ${allies} · Enemies ${enemies} · Wave ${g.wave}/${g.totalWaves}${reserves ? ` · Reserves ${reserves[0]}/${reserves[1]}` : ''}`;
    // P7-11: the escort's wagon, while there is one.
    if (g.wagon) $('#summary').textContent += g.wagon.alive ? ` · Wagon ${Math.round((100 * g.wagon.hp) / g.wagon.maxhp)}%` : ' · Wagon lost';
    // W-03: the zoom button shows the current zoom.
    const z = `${Math.round(CL.camera.zoomOf(g) * 100) / 100}×`;
    if ($('#zoomBtn').textContent !== z) $('#zoomBtn').textContent = z;
  }

  // ---- Walkable towns (P10-03: every capital and free city) ----

  const TALK_VERB = { trade: 'Trade', recruit: 'Hire troops', tavern: 'Inn', talk: 'Talk', leave: 'Leave town' };

  /**
   * A town's streets (P10-G3), drawn by the art kit (js/art/town.js): its buildings, people and light.
   * The hero's label and the map HUD as before.
   */
  function drawTown() {
    const g = CL.game;
    ctx.imageSmoothingEnabled = true;
    CL.gfx.town.draw(ctx, g.town, { font, verbs: TALK_VERB, k: backing, canBlock: CL.character?.heroCombat?.(CL.campaign, CL.campaign?.equipment)?.canBlock ?? true });
    ctx.imageSmoothingEnabled = false;
    updateMapHud();
  }

  // ---- Strategic map ----



  // On the world map, labels are queued while icons are drawn and placed last, most important first,
  // so names don't pile on top of each other (see placeLabels). Null outside the world map.
  let mapLabels = null;
  const LABEL_PRIORITY = { quest: 0, settlement: 1, site: 2, hostile: 3, party: 4 };

  /** Draw a label now, or (on the world map) queue it with its icon's position and priority. */
  function label(text, x, y, color = '#f8ecd0', place = null) {
    if (mapLabels && place) {
      mapLabels.push({ text, x, y, color, ...place });
      return;
    }
    drawLabel(text, x, y, color);
  }

  function drawLabel(text, x, y, color) {
    ctx.font = font(14); // stays legible when the canvas is scaled down on phones
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1b2417';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  /** Settlement icon: shape by type, faction colour plus a letter emblem (not colour alone). */
  function drawSettlement(s, here) {
    if (!CL.mapView.inView(s.mapX, s.mapY, 60)) return; // culled: off the screen (W-02)
    const [x, y] = CL.mapView.toScreen(s.mapX, s.mapY);
    const holder = CL.realm.owner(s.id);
    ctx.save();
    // P8-06a: a fort under siege: the besiegers' camp round it (P10-G4: tents, a ram, ladders), and the words.
    const siege = CL.sieges?.at(CL.campaign, s.id);
    if (siege?.phase === 'encircled') {
      ctx.font = font(10);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb3a1';
      ctx.fillText('under siege', x, y + 34); // below the fort: its name is above it
      ctx.textAlign = 'left';
    }
    // P10-G4: the settlement's miniature (by type and culture), its holder's banner, an occupier's pennant.
    // The banner is the realm it belongs to; a pennant beside it shows who holds the gates, when another does.
    const sovereign = CL.realm.sovereignOf?.(s.id, CL.campaign) || holder;
    CL.gfx.worldmap.settlement(ctx, x, y, s, backing, { holder: sovereign, controller: holder, t: performance.now() / 1000, siege: siege?.phase === 'encircled' ? siege.realm || true : null });
    if (here) {
      ctx.strokeStyle = '#ffe7a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // Far out, only towns and capitals keep their names (W-02; from "fit" on today's map, all do).
    if (s.type === 'town' || s.capital || CL.mapView.showMinorLabels()) label(s.name, x, y + 24, undefined, { prio: LABEL_PRIORITY.settlement, iy: y });
  }

  function drawSite(st) {
    if (!CL.mapView.inView(st.mapX, st.mapY, 60)) return;
    const [x, y] = CL.mapView.toScreen(st.mapX, st.mapY);
    const active = CL.world.siteActive(st.id);
    CL.gfx.worldmap.site(ctx, x, y, active, backing, performance.now() / 1000); // P10-G4: a camp, a fire while it is active
    if (CL.mapView.showMinorLabels()) label(active ? st.name : `${st.name} (cleared)`, x, y + 22, active ? '#ffb3a1' : '#c9bda8', { prio: LABEL_PRIORITY.site, iy: y });
  }

  /** A world party: banner in its faction colour, a shape by kind, and its size (P9-05: an army's, on its commander's banner). */
  function drawParty(p, army = null) {
    const t = CL.content.get('party_templates', p.template);
    const { x, y, crowded } = CL.world.partyDrawPos(p); // beside a landmark, not on its name
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return; // culled: off the screen (W-02)
    if ((p.contractId && !p.ambush) || p.questTag) {
      // Contract or quest target (or the caravan you escort): pulsing gold ring.
      const pulse = 17 + Math.sin(performance.now() / 250) * 2;
      ctx.save();
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 2, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const n = army ? CL.armies.soldiers(CL.campaign, army) : CL.parties.troopCount(p);
    const hostile = CL.parties.hostileTo(CL.campaign, t);
    ctx.save();
    // P10-G4: the party as a miniature: its figures and banner by kind, a ring by stance.
    const friendly = !hostile && (t.kind === 'detachment' || CL.realm.faction(t.faction)?.id === (CL.allegiance?.sworn?.(CL.campaign) || CL.allegiance?.serves?.(CL.campaign)));
    const arms = p.lordId ? CL.gfx.ui.houseArms(CL.campaign, CL.houses?.houseOf(CL.campaign, p.lordId)) : null; // P10-G5: a lord's house
    CL.gfx.worldmap.party(ctx, x, y, p, { kind: t.kind, realm: t.kind === 'bandit' ? 'reavers' : t.faction, template: t, hostile, friendly, army: Boolean(army), arms }, backing, performance.now() / 1000);
    if (p.chasing === 'player') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(16);
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 16);
      ctx.textAlign = 'left';
    }
    if (crowded) countBadge(x, y, n, hostile);
    ctx.restore();
    if (!crowded && !CL.mapView.showMinorLabels()) countBadge(x, y, n, hostile);
    else if (!crowded) {
      const marked = (p.contractId && !p.ambush) || p.questTag || p.escortTo;
      const own = t.kind === 'detachment' ? CL.detachments.find(CL.campaign, p.detachment) : null;
      const name = army ? `${CL.realm.faction(army.realm)?.short || 'An'} army` : own ? `${own.captainName}${own.status === 'returning' ? ' (coming back)' : ''}` : p.lordId ? CL.realm.titled(p.lordId, CL.campaign) : p.escortTo ? 'Escort' : p.contractId && !p.ambush ? 'Contract target' : p.questTag ? questName(p, t) : t.kind === 'bandit' ? 'Reavers' : t.kind === 'patrol' ? 'Patrol' : 'Caravan';
      const prio = marked ? LABEL_PRIORITY.quest : hostile ? LABEL_PRIORITY.hostile : LABEL_PRIORITY.party;
      // If there is no room for its name, the party keeps its size as a badge on the icon.
      label(`${name} ${n}`, x, y + 20, marked ? '#ffd34d' : hostile ? '#ffb3a1' : '#e8f0ff', { prio, iy: y, fallback: () => countBadge(x, y, n, hostile) });
    }
  }

  /** A party's troop count on its icon (when it is crowded or its name has no room). */
  function countBadge(x, y, n, hostile) {
    ctx.save();
    ctx.fillStyle = hostile ? '#7a1e16' : '#1b2a3a';
    ctx.beginPath();
    ctx.arc(x + 11, y + 4, 7 * ts(), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = font(9, { family: 'system-ui' }); // a count is information: it grows with the text
    ctx.textAlign = 'center';
    ctx.fillText(String(n), x + 11, y + 4 + 3 * ts());
    ctx.restore();
  }

  /**
   * Place the queued map labels, most important first: each tries below its icon, then above, right
   * and left, avoiding labels already placed and `blockers` (the hero). Quest marks, settlements and
   * sites always get their name (in the least crowded spot); ordinary parties without room fall back
   * to a count badge.
   */
  function placeLabels(blockers) {
    const queue = mapLabels;
    mapLabels = null;
    ctx.font = font(14);
    const k = ts();
    const placed = [...blockers];
    const overlap = (b) => placed.reduce((n, o) => n + (b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h ? 1 : 0), 0);
    queue.sort((a, b) => a.prio - b.prio);
    for (const l of queue) {
      const w = ctx.measureText(l.text).width + 6;
      const spots = [
        [l.x, l.y],
        [l.x, l.iy - 20 * k],
        [l.x + w / 2 + 14, l.iy + 5],
        [l.x - w / 2 - 14, l.iy + 5],
      ].map(([cx, cy]) => ({ cx, cy, box: { x: cx - w / 2, y: cy - 13 * k, w, h: 17 * k } }));
      const inside = spots.filter((s) => s.box.x >= 0 && s.box.x + s.box.w <= W && s.box.y >= 0 && s.box.y + s.box.h <= H);
      let spot = inside.find((s) => !overlap(s.box));
      if (!spot) {
        if (l.fallback) {
          l.fallback();
          continue;
        }
        spot = (inside.length ? inside : spots).reduce((a, b) => (overlap(b.box) < overlap(a.box) ? b : a));
      }
      placed.push(spot.box);
      drawLabel(l.text, spot.cx, spot.cy, l.color);
    }
  }

  // ---- The terrain layer (W-02): the static ground drawn once per zoom step, then copied each frame ----

  const terrainLayers = new Map(); // scale → layer, one per zoom step (a pinch crosses steps back and forth)
  let terrainLayersOf = null; // the map they were drawn for
  const LAYER_MAX_PX = 4096; // a canvas side limit that phones accept

  /** The terrain in world pixels (map coordinates), in the art kit (P10-G4, js/art/worldmap.js). */
  function drawTerrain(m, e, k) {
    CL.gfx.worldmap.terrain(ctx, m, e, k);
  }

  /**
   * The terrain at a zoom step ("fit", 1×, 1.6× or 2.4×: the smallest at or above the current zoom, so
   * it is only ever scaled down). Each step's layer is kept (about 19 MB for all three today) and they
   * are all redrawn when the map changes; the canvas density makes its own.
   */
  function terrainLayer(zoom) {
    const V = CL.mapView;
    const m = CL.world.map();
    const step = V.levels().find((l) => l >= zoom - 1e-6) ?? V.maxZoom();
    const e = V.extent();
    const k = Math.min(step * backing, LAYER_MAX_PX / e.w, LAYER_MAX_PX / e.h);
    if (terrainLayersOf !== m) {
      terrainLayers.clear();
      terrainLayersOf = m;
    }
    const kept = terrainLayers.get(k);
    if (kept) return kept;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(e.w * k);
    canvas.height = Math.round(e.h * k);
    const layer = canvas.getContext('2d');
    layer.setTransform(k, 0, 0, k, 0, 0);
    const main = ctx;
    ctx = layer;
    try {
      drawTerrain(m, e, k);
    } finally {
      ctx = main;
    }
    const made = { k, canvas };
    if (terrainLayers.size >= 6) terrainLayers.delete(terrainLayers.keys().next().value); // oldest first
    terrainLayers.set(k, made);
    CL.diag?.log('info', 'Map terrain layer drawn', { step, scale: k, size: `${canvas.width}×${canvas.height}` });
    return made;
  }

  /**
   * P7-04: where the company last saw a party it can't see now: a faded banner and a question mark
   * (a contract target's stays, however old, so it can always be found again).
   */
  function drawLastSeen(p, at) {
    const [x, y] = CL.world.toScreen(at.x, at.y);
    const t = CL.content.get('party_templates', p.template);
    ctx.save();
    CL.gfx.worldmap.ghost(ctx, x, y, { kind: t.kind, realm: t.faction }); // P10-G4: its banner, faded
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff3cf';
    ctx.font = font(13);
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y + 3);
    if (p.contractId && !p.ambush) {
      ctx.strokeStyle = '#ffd34d';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y - 2, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Arrows on the screen's edge toward what matters off it: contract and quest targets, and you. */
  function drawEdgeMarkers(w) {
    const V = CL.mapView;
    const marks = [];
    for (const p of CL.campaign.parties || []) {
      if (!((p.contractId && !p.ambush) || p.questTag)) continue;
      const at = CL.sight.shown(CL.campaign, p); // where you know it is (P7-04)
      if (at) marks.push([at.x, at.y, '#ffd34d']);
    }
    marks.push([w.x, w.y, '#fff3cf']);
    for (const [mx, my, color] of marks) {
      const e = V.edgeMarker(mx, my);
      if (!e) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#1b1208';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /** P10-08: a story band on the map, by its own name ("Horse Thieves"); a generic mark if it has none. */
  const questName = (p, t = CL.content.get('party_templates', p.template)) => CL.story.bandSpec(p.questTag, CL.campaign)?.name || (t.kind === 'bandit' ? 'Quest: Reavers' : 'Quest: Column');

  // P10-08: the fog of sight. Where none of your eyes reach (js/sight.js `sources`), the map is a
  // little darker; inside, it is as drawn, with a soft edge. Night and high ground scale each circle
  // as they scale sight. Off with reduced effects.
  let fogCanvas = null;
  const FOG = { color: 'rgba(8, 14, 26, 0.32)', edge: 0.75 };
  function drawFog() {
    const c = CL.campaign;
    const V = CL.mapView;
    if (!fogCanvas) fogCanvas = document.createElement('canvas');
    const cw = Math.round(W * backing);
    const ch = Math.round(H * backing);
    if (fogCanvas.width !== cw || fogCanvas.height !== ch) Object.assign(fogCanvas, { width: cw, height: ch });
    const f = fogCanvas.getContext('2d');
    f.setTransform(backing, 0, 0, backing, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = FOG.color;
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    const k = CL.world.aspect();
    for (const s of CL.sight.sources(c)) {
      const r = s.r * CL.sight.factor(c.day, s, s);
      const [sx, sy] = V.toScreen(s.x, s.y);
      const rx = Math.abs(V.toScreen(s.x + r, s.y)[0] - sx);
      const ry = Math.abs(V.toScreen(s.x, s.y + r / k)[1] - sy); // gameplay distance counts north–south by the aspect
      if (!(rx > 1 && ry > 1) || sx + rx < 0 || sx - rx > W || sy + ry < 0 || sy - ry > H) continue;
      f.save();
      f.translate(sx, sy);
      f.scale(1, ry / rx);
      const grad = f.createRadialGradient(0, 0, rx * FOG.edge, 0, 0, rx);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = grad;
      f.beginPath();
      f.arc(0, 0, rx, 0, Math.PI * 2);
      f.fill();
      f.restore();
    }
    ctx.drawImage(fogCanvas, 0, 0, W, H);
  }

  function drawWorld() {
    const { map } = CL.world;
    const V = CL.mapView;
    const m = map();
    const w = CL.campaign.world;
    const g = CL.game;

    // The ground: one copy of the cached layer, placed and scaled by the camera (W-02).
    const z = V.state.zoom;
    const layer = terrainLayer(z);
    const [ox, oy] = V.toScreen(...CL.world.fromPx(0, 0));
    const scale = z / layer.k;
    ctx.fillStyle = CL.gfx.PAL.grass; // the map's own ground beyond its edge, when it is smaller than the view
    ctx.fillRect(0, 0, W, H);
    const exact = Math.abs(scale * backing - 1) < 1e-6;
    ctx.imageSmoothingEnabled = !exact;
    ctx.drawImage(layer.canvas, exact ? Math.round(ox * backing) / backing : ox, exact ? Math.round(oy * backing) / backing : oy, layer.canvas.width * scale, layer.canvas.height * scale);
    ctx.imageSmoothingEnabled = false;

    if (!CL.settings?.get('reducedEffects') && CL.sight.options.rules) drawFog(); // P10-08: under the places and parties

    mapLabels = [];
    // W-07: only what the camera can see (with room for labels and banners at the edge).
    const seen = (x, y) => V.inView(x, y, 90);
    for (const st of Object.values(m.sites)) if (seen(st.mapX, st.mapY)) drawSite(st);
    for (const s of Object.values(CL.content.table('settlements'))) if (seen(s.mapX, s.mapY)) drawSettlement(s, s.id === w.location);
    // P7-04: the parties the company can see, and a faded mark where it last saw the others.
    for (const p of CL.campaign.parties || []) {
      const at = CL.sight.shown(CL.campaign, p);
      if (!at || !seen(at.x, at.y)) continue;
      // P9-05: a marching army is one banner, on its commander's party; its lords riding with it are under it.
      const army = p.armyId != null ? CL.armies?.bannerOf(CL.campaign, p) : null;
      if (army === false) continue;
      if (at.live) drawParty(p, army);
      else drawLastSeen(p, at);
    }
    if (CL.sight.isNight(CL.campaign.day)) {
      // Night: the map darkens (sight is shorter, P7-04).
      ctx.fillStyle = '#0b1530';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Journey line.
    const [px, py] = V.toScreen(w.x, w.y);
    if (g.travel) {
      const [tx, ty] = V.toScreen(g.travel.x, g.travel.y);
      ctx.save();
      ctx.strokeStyle = '#fff3cf';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#fff3cf';
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Your company (P10-G4): you, two of your soldiers, your banner; walking while travelling; beside a
    // settlement's icon when you are at one.
    const [mx, my] = w.location ? [px - 26, py + 6] : [px, py];
    const box = CL.gfx.worldmap.company(ctx, mx, my, Boolean(g.travel), g.travel ? g.travelFace : 'down', backing, performance.now() / 1000);
    placeLabels([box]);
    drawEdgeMarkers(w);

    updateMapHud();
  }

  function updateMapHud() {
    const c = CL.campaign;
    const w = c.world;
    const $ = CL.ui.$;
    const here = w.location ? CL.content.get('settlements', w.location).name : null;
    const ground = { road: 'on the road', grass: 'open country', forest: 'in the forest' }[CL.world.terrainAt(w.x, w.y)];
    $('#hptext').textContent = here
      ? `At ${here}`
      : CL.game.travel
        ? `Travelling, ${ground}`
        : CL.game.waiting
          ? `Waiting, ${ground}`
          : `Camped, ${ground}`;
    const wounded = CL.party.woundedSoldiers().length;
    const food = CL.upkeep.foodDays(c);
    const short = compactHud();
    $('#summary').textContent =
      (short
        ? `${CL.world.clockLabel()} · ${c.gold} cr · ${c.roster.length} men${wounded ? ` (${wounded} hurt)` : ''}`
        : `${CL.world.clockLabel()} · ${c.gold} crowns · ${c.roster.length} soldiers${wounded ? ` (${wounded} wounded)` : ''}`) +
      (c.companion ? ` + ${CL.companion.def(c.companion.id).name}${c.companion.away ? ' (scouting ahead)' : CL.companion.fit(c) ? '' : ' (wounded)'}` : '') +
      ` · food ${food >= 10 ? Math.floor(food) : food.toFixed(1)}d · ${short ? 'mor.' : 'morale'} ${Math.round(c.morale)}` +
      (Object.keys(c.cargo).length ? ` · cargo ${CL.trade.cargoWeight(c)}/${CL.trade.capacity(c)}` : '') +
      (c.contract ? ` · ${CL.contracts.summary(c)}` : '') +
      (CL.story.currentQuest(c) ? ` · ▸ ${CL.story.currentQuest(c).title}` : '');
    $('#topLeft').classList.toggle('warn', food < 1 || c.morale < CL.upkeep.MORALE.desertBelow);
    $('#waitBtn').textContent = CL.game.waiting ? 'Stop waiting' : 'Wait';
    // P7-04: Hide, only in a forest and standing still.
    const hideBtn = $('#hideBtn');
    const canHide = CL.sight.canHide(c);
    if (hideBtn.classList.contains('hidden') === canHide) hideBtn.classList.toggle('hidden', !canHide);
    const hideText = CL.sight.hidden(c) ? 'Stop hiding' : 'Hide';
    if (hideBtn.textContent !== hideText) hideBtn.textContent = hideText;
    // W-02: − stops at "fit" and + at 2.4×; Centre is lit while the view has wandered off the party.
    const V = CL.mapView;
    const z = V.state.zoom;
    const outOff = z <= V.minZoom() + 1e-3;
    const inOff = z >= V.maxZoom() - 1e-3;
    if ($('#zoomOutBtn').disabled !== outOff) $('#zoomOutBtn').disabled = outOff;
    if ($('#zoomInBtn').disabled !== inOff) $('#zoomInBtn').disabled = inOff;
    $('#centreBtn').classList.toggle('away', !V.state.following);
  }

  // ---- Minimap and tactical overview (V2-06; js/tactics.js) ----

  const GROUP_COLOR = { infantry: '#8fb8ff', archer: '#9be07f', cavalry: '#ffd36b' };

  /** The field's terrain at a small fixed scale, drawn once per map: ground, glades, trees, cover. */
  /** The field as a small painted map, for the minimap, the overview and Prepare (P10-G2: the art kit's). */
  const terrainImage = (m) => CL.gfx.battle.miniature(m);

  /** Draw the field into a screen rectangle r: terrain, view, company, detected enemies. */
  function drawField(g, r, dot) {
    const T = CL.tactics;
    ctx.drawImage(terrainImage(g.battleMap), r.x, r.y, r.w, r.h);
    const cam = g.camera || { x: 0, y: 0 };
    const v = T.toScreen(r, cam.x, cam.y);
    const vz = CL.camera.zoomOf(g); // the view box is the zoomed view (W-03)
    ctx.strokeStyle = '#f8ecd0cc';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.x, v.y, (W / vz) * r.scale, (H / vz) * r.scale);
    const pip = (x, y, color, size, hollow) => {
      const p = T.toScreen(r, x, y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      if (hollow) {
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
    for (const k of T.knownEnemies(g)) pip(k.x, k.y, k.live ? '#ff5a4a' : '#ff5a4a99', dot, !k.live);
    for (const a of g.allies) if (a.alive) pip(a.x, a.y, (a.div && CL.divisions.COLORS[a.div]) || GROUP_COLOR[a.role] || '#8fb8ff', dot);
    if (g.hero?.alive) {
      pip(g.hero.x, g.hero.y, '#1b1208', dot + 1.5);
      pip(g.hero.x, g.hero.y, '#fff3c4', dot);
    }
  }

  /**
   * The preparation screen's preview (V2-07): the field, the deployment zone, the hero's start, a flag
   * per group (drag them in Custom) and the side the enemy comes from.
   */
  function drawPrepare(g) {
    const p = g.prep;
    const map = p.map;
    const r = CL.prep.previewRect(map, p.ambush);
    const box = r.box;
    ctx.fillStyle = '#06101a';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip(); // the preview shows the area around the deployment zone
    const { w: fw, h: fh } = CL.camera.worldSize(map);
    ctx.drawImage(terrainImage(map), r.x, r.y, fw * r.scale, fh * r.scale);
    const T = CL.tactics;
    const z = CL.prep.zone(map, p.ambush);
    const z0 = T.toScreen(r, z.x0, z.y0);
    const z1 = T.toScreen(r, z.x1, z.y1);
    ctx.fillStyle = p.ambush ? '#e0503c33' : '#9be07f2e';
    ctx.fillRect(z0.x, z0.y, z1.x - z0.x, z1.y - z0.y);
    ctx.strokeStyle = p.ambush ? '#e0503c' : '#9be07f';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(z0.x, z0.y, z1.x - z0.x, z1.y - z0.y);
    ctx.setLineDash([]);
    // The enemy comes from the east.
    const eb = map.spawn.enemies;
    const raw = T.toScreen(r, (eb.x0 + eb.x1) / 2, (eb.y0 + eb.y1) / 2);
    const ec = { x: Math.min(raw.x, box.x + box.w - 44), y: raw.y }; // at the edge when off the preview
    ctx.fillStyle = '#ff5a4a';
    ctx.font = font(15);
    ctx.textAlign = 'center';
    ctx.fillText('enemy', ec.x, ec.y - 12);
    ctx.beginPath();
    ctx.moveTo(ec.x - 12, ec.y);
    ctx.lineTo(ec.x + 6, ec.y - 7);
    ctx.lineTo(ec.x + 6, ec.y + 7);
    ctx.closePath();
    ctx.fill();
    // The hero's start.
    const h = T.toScreen(r, CL.prep.anchorOf(map).x, CL.prep.anchorOf(map).y);
    ctx.fillStyle = '#1b1208';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // One flag per division that has soldiers fit to fight (P9-B4: by division, in its colour).
    const fit = Object.fromEntries(CL.divisions.preview(CL.campaign).map((d) => [d.div, d.soldiers.length]));
    const letters = { infantry: 'I', archer: 'A', cavalry: 'C', infantry2: 'I²', archer2: 'A²', cavalry2: 'C²' };
    for (const grp of CL.divisions.SLOTS) {
      if (!fit[grp] || !p.plan.anchors[grp]) continue;
      const a = T.toScreen(r, p.plan.anchors[grp].x, p.plan.anchors[grp].y);
      ctx.strokeStyle = '#1b1208';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 10);
      ctx.lineTo(a.x, a.y - 16);
      ctx.stroke();
      ctx.fillStyle = CL.divisions.color(grp);
      const [fw, fh] = [22 * ts(), 14 * ts()]; // the flag grows with its label
      ctx.fillRect(a.x, a.y - 2 - fh, fw, fh);
      ctx.strokeRect(a.x, a.y - 2 - fh, fw, fh);
      ctx.fillStyle = '#1b1208';
      ctx.font = font(11);
      ctx.fillText(`${letters[grp]}${fit[grp]}`, a.x + fw / 2, a.y - 2 - 3 * ts());
    }
    ctx.textAlign = 'left';
    ctx.restore();
    ctx.strokeStyle = '#c9a85c';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
  }

  /** The minimap: always on in a large battle, top centre, tap to look there. */
  function drawMinimap(g) {
    const r = CL.tactics.minimapRect(g);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#0c1823';
    ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    ctx.globalAlpha = 1;
    drawField(g, r, 2);
    ctx.strokeStyle = '#c9a85c';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.restore();
  }

  /** The tactical overview: the whole field, the battle held, groups sent by tapping. */
  function drawOverview(g) {
    const r = CL.tactics.overviewRect(g);
    ctx.save();
    ctx.fillStyle = '#06101add';
    ctx.fillRect(0, 0, W, H);
    drawField(g, r, 4);
    ctx.strokeStyle = '#c9a85c';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    // Where each held group was sent: a flag at the middle of its spots.
    for (const group of CL.divisions.present(g)) {
      if (g.orders[group] !== 'hold') continue;
      const units = CL.divisions.members(g, group);
      if (!units.length) continue;
      const hx = units.reduce((n, u) => n + u.holdX, 0) / units.length;
      const hy = units.reduce((n, u) => n + u.holdY, 0) / units.length;
      const p = CL.tactics.toScreen(r, hx, hy);
      ctx.strokeStyle = CL.divisions.color(group);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 14);
      ctx.stroke();
      ctx.fillStyle = CL.divisions.color(group);
      ctx.fillRect(p.x, p.y - 14, 9, 6);
    }
    ctx.restore(); // the instructions are in the message line (CL.tactics.overview), clear of the HUD
  }

  /** Enemies off screen but in sight in a large arena: a red marker on the screen edge, pointing their way. */
  function drawEdgeThreats(g) {
    const cam = g.camera || { x: 0, y: 0 };
    const [cx, cy] = [W / 2, H / 2];
    ctx.save();
    ctx.fillStyle = '#e0503c';
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    for (const e of g.enemies) {
      // Only enemies the company can see right now (V2-06: nothing unseen is given away).
      if (!e.alive || !e.seen || CL.camera.visible(g, e.x, e.y, 0)) continue;
      const z = CL.camera.zoomOf(g);
      const [dx, dy] = [(e.x - cam.x) * z - cx, (e.y - cam.y) * z - cy];
      const k = Math.min((cx - 18) / Math.abs(dx || 1e-6), (cy - 18) / Math.abs(dy || 1e-6));
      const [x, y] = [cx + dx * k, cy + dy * k];
      const a = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
      ctx.lineTo(x + Math.cos(a + 2.4) * 8, y + Math.sin(a + 2.4) * 8);
      ctx.lineTo(x + Math.cos(a - 2.4) * 8, y + Math.sin(a - 2.4) * 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Approaching parties (V2-09): a banner on the side of the screen they ride in from, with who they
   * are, how many, and about how long until they arrive. Only once they are known (seen, or close).
   */
  function drawApproaching(g) {
    const list = (g.joining || []).filter((j) => j.warned && !j.arrived);
    if (!list.length) return;
    const [cx, cy] = [W / 2, H / 2];
    ctx.save();
    ctx.font = font(13, { family: 'system-ui, sans-serif' });
    const k = ts();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach((j, i) => {
      const text = `${j.side === 'ally' ? 'Aid' : 'Foes'}: ${j.name} (${j.size}) · ${Math.max(1, Math.round(j.arriveAt - g.t))} s`;
      const w = ctx.measureText(text).width + 20;
      const x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, cx + j.dir.x * (cx - w / 2 - 8)));
      const y = Math.max(124, Math.min(H - 130, cy + j.dir.y * (cy - 60))) + i * 34 * k; // below the minimap and the HUD
      ctx.fillStyle = '#101a23d9';
      ctx.strokeStyle = j.side === 'ally' ? '#4bc4dc' : '#e76860';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(x - w / 2, y - 14 * k, w, 28 * k);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f4efe2';
      ctx.fillText(text, x, y + 1);
    });
    ctx.restore();
  }

  function draw() {
    const g = CL.game;
    ctx.setTransform(backing, 0, 0, backing, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (g.town && ['town', 'talk', 'trade', 'contracts', 'saves', 'character', 'settlement', 'journal', 'ending'].includes(g.mode)) {
      drawTown();
      if (performance.now() > g.messageUntil) CL.ui.$('#message').textContent = '';
      return;
    }
    if (g.mode === 'prepare' && g.prep) {
      drawPrepare(g);
      return;
    }
    if ((g.mode !== 'battle' && g.mode !== 'result') || (g.mode === 'result' && g.result?.auto)) {
      drawWorld();
      if (performance.now() > g.messageUntil) CL.ui.$('#message').textContent = '';
      return;
    }
    // The battlefield is drawn in world pixels through the camera (PROTO-A; a one-screen map keeps it at 0,0),
    // in the art kit (P10-G2, js/art/battle.js): the ground, obstacles, units, the fallen, arrows, effects.
    const cam = g.camera || { x: 0, y: 0 };
    const zoom = CL.camera.zoomOf(g); // W-03: 0.75×–1.5× on a large field
    ctx.save();
    ctx.imageSmoothingEnabled = true; // the baked frames are drawn smooth
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(cam.x * zoom) / zoom, -Math.round(cam.y * zoom) / zoom);
    CL.gfx.battle.draw(ctx, g, CL.camera.view(g), backing * zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
    if (CL.camera.scrolls(g) && g.mode === 'battle') {
      drawEdgeThreats(g);
      if (g.overview) drawOverview(g);
      else drawMinimap(g);
    }
    if (g.mode === 'battle' && !g.overview) drawApproaching(g); // over the minimap's corner, never under it
    const field = CL.camera.scrolls(g) ? 'large' : 'small';
    if (CL.ui.$('#stage').dataset.field !== field) CL.ui.$('#stage').dataset.field = field; // shows the MAP button

    if (g.mode === 'battle' || (g.mode === 'result' && g.hero)) updateHud(); // the final tally, not the frame before
    if (performance.now() > g.messageUntil) CL.ui.$('#message').textContent = '';

    if (g.paused) {
      ctx.fillStyle = '#06101a99';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f8e9c5';
      ctx.font = font(38);
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, 265);
      ctx.textAlign = 'left';
    }
  }

  CL.render = { BUSY, busyBattle, bodyAlpha, init, fit, draw, setBackingScale, backingScale: () => backing, questName };
})(typeof window !== 'undefined' ? window : globalThis);
