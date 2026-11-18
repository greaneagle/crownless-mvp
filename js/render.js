/* Crownless canvas rendering and battle HUD text. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { W, H } = CL;
  // W-01: every canvas font comes from the player's text size (CL.settings.font); `fixed` is only for
  // letters that are part of an icon's art (the emblem on a flag or a party marker).
  const font = (px, opts) => CL.settings?.font(px, opts) ?? `bold ${px}px Georgia`;
  const ts = () => CL.settings?.textScale() ?? 1;
  const fixedFont = (px, family = 'system-ui') => `bold ${px}px ${family}`;
  /** The top-left HUD's short form, at the Larger text size. */
  const compactHud = () => ts() >= 1.3;

  let ctx = null;

  const FACE_ANGLE = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI };

  let backing = 1; // canvas pixels per game pixel (decision D-R1: 1 unless the Debug panel's test is on)

  function init(canvas) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  /**
   * D-R1 measurement only (W-01, Debug panel "Sharp canvas"): draw into a backing store of
   * min(devicePixelRatio, 2) × 960×540 so enlarged canvas text is sharper, to time it on a phone.
   * The game still works in 960×540 units: every frame starts from this scale, and input maps taps
   * through the canvas's on-screen size, so nothing else changes. Not saved.
   */
  function setBackingScale(k) {
    backing = k;
    ctx.canvas.width = Math.round(W * k);
    ctx.canvas.height = Math.round(H * k);
    ctx.imageSmoothingEnabled = false; // a resize resets the context
    return backing;
  }

  function drawImage(key, x, y, w, h) {
    const im = CL.assets.imgs[key];
    if (im?.complete && im.naturalWidth) ctx.drawImage(im, Math.round(x), Math.round(y), w, h);
  }

  /** Hero frames are drawn with the player's chosen cloak colour. */
  function drawHeroFrame(key, x, y, w, h) {
    const sprite = CL.assets.heroSprite(key, CL.campaign?.character?.cloak);
    if (sprite) ctx.drawImage(sprite, Math.round(x), Math.round(y), w, h);
  }

  /** Battle ground for the current map: base colour, tiled texture, patches, decor (no collision). */
  /**
   * The battle ground, in world pixels (drawn through the camera). A one-screen map draws exactly as
   * before; a larger arena (PROTO-A) draws only the part in view.
   */
  function drawGround() {
    const g = CL.game;
    const m = g.battleMap || CL.content.get('battle_maps', 'grass_field');
    const gr = m.ground;
    const { w: WW, h: WH } = CL.camera.worldSize(m);
    const v = CL.camera.view(g);
    ctx.fillStyle = gr.base;
    ctx.fillRect(v.x, v.y, W, H);

    ctx.save();
    ctx.globalAlpha = 0.24;
    const tiles = gr.tiles;
    const [x0, y0] = [Math.floor(v.x / 64) * 64, Math.floor(v.y / 64) * 64];
    for (let y = y0; y < Math.min(WH, v.y + H); y += 64) {
      for (let x = x0; x < Math.min(WW, v.x + W); x += 64) {
        const k = (x * 3 + y * 7) % 5 === 0 ? tiles[1 % tiles.length] : (x + y) % 3 === 0 ? tiles[2 % tiles.length] : tiles[0];
        drawImage(k, x, y, 65, 65);
      }
    }
    ctx.restore();

    for (const p of gr.patch ? [gr.patch, ...(gr.patches || [])] : gr.patches || []) {
      if (!CL.camera.visible(g, p.x, p.y, Math.max(p.rx, p.ry))) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of gr.roads || []) {
      // Packed-earth streets.
      ctx.fillStyle = '#a58c62';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#00000014';
      for (let i = 0; i < (r.w * r.h) / 900; i++) ctx.fillRect(r.x + ((i * 53) % r.w), r.y + ((i * 31) % r.h), 5, 3);
    }
    if (gr.plaza) {
      // Cobbled market square.
      const p = gr.plaza;
      ctx.fillStyle = '#9c9583';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00000022';
      ctx.lineWidth = 1;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * p.rx, p.y + Math.sin(a) * p.ry);
        ctx.stroke();
      }
    }
    if (gr.stone) {
      // Flagstones inside the courtyard.
      const st = gr.stone;
      ctx.fillStyle = st.color;
      ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.strokeStyle = '#00000022';
      ctx.lineWidth = 1;
      for (let y = st.y; y < st.y + st.h; y += 20) {
        for (let x = st.x + ((y / 20) % 2) * 16; x < st.x + st.w; x += 32) ctx.strokeRect(x, y, 32, 20);
      }
    }

    // Grass speckles.
    ctx.fillStyle = '#ffffff12';
    const speckles = Math.round((60 * WW * WH) / (W * H));
    for (let i = 0; i < speckles; i++) {
      const [sx, sy] = [(i * 167 + 53) % WW, (i * 113 + 39) % WH];
      if (CL.camera.visible(g, sx, sy, 4)) ctx.fillRect(sx, sy, 4, 2);
    }

    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const [tile, x, y, w, h] of m.decor || []) if (CL.camera.visible(g, x + w / 2, y + h / 2, Math.max(w, h))) drawImage(tile, x, y, w, h);
    ctx.restore();

    ctx.strokeStyle = '#2c3c2e';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, WW - 24, WH - 24);
  }

  /** Where an obstacle sits in the depth order: its base line. */
  const obstacleBase = (o) => (o.shape === 'circle' ? o.y + o.r * 0.5 : o.y + o.h);

  /** Town buildings: walls, a pitched roof, a door, and an optional sign. */
  const BUILDING = {
    tavern: { wall: '#c9b48a', roof: '#7a3b2a', door: '#4a2e1c' },
    barracks: { wall: '#9a937f', roof: '#3b5a7a', door: '#2e2a22' },
    house: { wall: '#d7c7a0', roof: '#6f4a2a', door: '#4a2e1c' },
  };

  function drawBuilding(o) {
    const s = BUILDING[o.look];
    const roofH = Math.min(46, o.h * 0.5);
    const wallTop = o.y + roofH - 6;
    ctx.fillStyle = '#00000033';
    ctx.fillRect(o.x + 6, o.y + o.h - 4, o.w, 10);
    ctx.fillStyle = s.wall;
    ctx.fillRect(o.x, wallTop, o.w, o.y + o.h - wallTop);
    ctx.fillStyle = s.roof;
    ctx.beginPath();
    ctx.moveTo(o.x - 8, wallTop + 4);
    ctx.lineTo(o.x + o.w * 0.15, o.y);
    ctx.lineTo(o.x + o.w * 0.85, o.y);
    ctx.lineTo(o.x + o.w + 8, wallTop + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeRect(o.x, wallTop, o.w, o.y + o.h - wallTop);
    // Door and two windows.
    ctx.fillStyle = s.door;
    ctx.fillRect(o.x + o.w / 2 - 11, o.y + o.h - 30, 22, 30);
    ctx.fillStyle = '#f2d98a';
    ctx.fillRect(o.x + o.w * 0.2, wallTop + 14, 16, 12);
    ctx.fillRect(o.x + o.w * 0.8 - 16, wallTop + 14, 16, 12);
    if (o.label) {
      ctx.fillStyle = '#3a2614';
      ctx.fillRect(o.x + o.w / 2 - 60, o.y + o.h - 52, 120, 18);
      label(o.label, o.x + o.w / 2, o.y + o.h - 38, '#f3e3b5');
    }
  }

  function drawStall(o) {
    ctx.fillStyle = '#8a6a3c';
    ctx.fillRect(o.x, o.y + 20, o.w, o.h - 20);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#e9dcc0' : '#b5452f';
      ctx.fillRect(o.x - 6 + (i * (o.w + 12)) / 6, o.y, (o.w + 12) / 6, 22);
    }
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x - 6, o.y, o.w + 12, 22);
    ctx.strokeRect(o.x, o.y + 22, o.w, o.h - 22);
    // Wares on the counter.
    for (const [dx, c] of [[12, '#d9b04f'], [36, '#e9e3d0'], [60, '#7f5a3b'], [84, '#4f6f9a']]) {
      ctx.fillStyle = c;
      ctx.fillRect(o.x + dx, o.y + 26, 14, 10);
    }
    if (o.label) label(o.label, o.x + o.w / 2, o.y + o.h + 14, '#f3e3b5');
  }

  function drawWell(o) {
    ctx.fillStyle = '#7d7a70';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f4f6a';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(o.x - o.r, o.y - o.r - 18, 4, 20);
    ctx.fillRect(o.x + o.r - 4, o.y - o.r - 18, 4, 20);
    ctx.fillRect(o.x - o.r, o.y - o.r - 20, o.r * 2, 4);
  }

  function drawObstacle(o) {
    if (BUILDING[o.look]) return drawBuilding(o);
    if (o.look === 'stall') return drawStall(o);
    if (o.look === 'well') return drawWell(o);
    if (o.look === 'wall' || o.look === 'crate') {
      const wall = o.look === 'wall';
      // Front face plus a lighter top edge, with block/plank lines.
      ctx.fillStyle = wall ? '#6e675b' : '#8a6a3c';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = wall ? '#9a937f' : '#a8844f';
      ctx.fillRect(o.x, o.y - (wall ? 10 : 6), o.w, wall ? 10 : 6);
      ctx.strokeStyle = '#00000044';
      ctx.lineWidth = 1;
      if (wall) {
        for (let y = o.y; y < o.y + o.h; y += 11) {
          for (let x = o.x + ((y / 11) % 2) * 9; x < o.x + o.w; x += 18) ctx.strokeRect(x, y, 18, 11);
        }
      } else {
        ctx.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
        ctx.beginPath();
        ctx.moveTo(o.x + 3, o.y + 3);
        ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
        ctx.stroke();
      }
      ctx.strokeStyle = '#1b1208';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x, o.y - (wall ? 10 : 6), o.w, o.h + (wall ? 10 : 6));
      return;
    }
    if (o.look?.tile) {
      const { tile, w, h } = o.look;
      // Shadow, then the sprite standing on the obstacle's base.
      ctx.fillStyle = '#00000033';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.4, o.r * 1.2, o.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      drawImage(tile, o.x - w / 2, o.y + o.r * 0.5 - h, w, h);
    }
  }

  function unitFrames(u) {
    const { heroFrames, allyArt } = CL.assets;
    if (u.frames) return u.frames; // the companion's own look
    if (u.role === 'hero') return heroFrames[u.face];
    if (u.role === 'infantry') return allyArt.infantry;
    if (u.role === 'archer') return allyArt.archer;
    if (u.role === 'cavalry') return CL.assets.troopArt[u.troop] || CL.assets.troopArt.rider;
    return [u.art || 92];
  }

  /** Fallen unit: sprite laid on its side, faded. */
  function drawDowned(u) {
    const hero = u.role === 'hero';
    const mounted = u.role === 'cavalry';
    const sh = hero ? 74 : mounted ? 62 : 43;
    const sw = hero ? 58 : mounted ? 42 : 37;
    const frames = unitFrames(u);
    const age = CL.game.t - u.downAt;
    ctx.save();
    ctx.globalAlpha = age < 0.25 ? 0.9 - age * 1.6 : 0.5;
    ctx.translate(u.x, u.y - 6);
    ctx.rotate(u.face === 'left' ? -Math.PI / 2 : Math.PI / 2);
    (hero ? drawHeroFrame : drawImage)(CL.assets.key('u', frames[0]), -sh / 2, -sw / 2, sw, sh);
    ctx.restore();
  }

  /** Swing arc: thin telegraph in windup, bright slash when active, fading in recovery. */
  function drawSwing(u, hero) {
    const phase = CL.units.swingPhase(u);
    if (!phase) return;
    const { SWING } = CL.units;
    const a = FACE_ANGLE[u.face];
    const half = Math.PI / 4; // 90° arc
    const r = hero ? 42 : 27;
    const ally = u.team === 'ally';
    ctx.save();
    ctx.beginPath();
    if (phase === 'windup') {
      const k = u.swing.t / SWING.windup;
      // Enemy windups are the player's cue to block, so they read strongest.
      ctx.globalAlpha = ally ? 0.35 + 0.35 * k : 0.6 + 0.4 * k;
      ctx.strokeStyle = ally ? '#f9e4b3' : '#ff5a3c';
      ctx.lineWidth = ally ? 2 : 4;
      ctx.setLineDash([6, 3]);
      ctx.arc(u.x, u.y - 18, r * (1 + 0.3 * k), a - half, a + half);
    } else if (phase === 'active') {
      ctx.strokeStyle = ally ? '#fff3cf' : '#ff9d84';
      ctx.lineWidth = 6;
      ctx.arc(u.x, u.y - 18, r, a - half, a + half);
    } else {
      const k = (u.swing.t - SWING.windup - SWING.active) / SWING.recovery;
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.strokeStyle = ally ? '#f9e4b3' : '#f0a18c';
      ctx.lineWidth = 3;
      ctx.arc(u.x, u.y - 18, r, a - half, a + half);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawUnit(u) {
    if (!u?.alive) return;
    const hero = u.role === 'hero';
    const mounted = u.role === 'cavalry';
    const sh = hero ? 74 : mounted ? 62 : 43;
    const sw = hero ? 58 : mounted ? 42 : 37;
    const x = u.x - sw / 2;
    const y = u.y - sh + 8;

    // Shadow.
    ctx.fillStyle = '#172b1f66';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 4, sw * 0.4, 8, 0, 0, 7);
    ctx.fill();

    const frames = unitFrames(u);
    const frame = frames[Math.floor(u.anim) % frames.length];
    if (u.flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
    }
    if (hero) drawHeroFrame(CL.assets.key('u', frame), x, y, sw, sh);
    else drawImage(CL.assets.key('u', frame), x, y, sw, sh);
    if (u.flash > 0) ctx.restore();

    drawSwing(u, hero);
    if (u.shot > 0) {
      // Archer release flash toward facing.
      const a = FACE_ANGLE[u.face];
      ctx.fillStyle = '#f6e8b4';
      ctx.fillRect(u.x + Math.cos(a) * 14 - 2, u.y - 20 + Math.sin(a) * 14 - 2, 4, 4);
    }
    if (u.guard) {
      // Frontal 120° shield cover.
      const a = FACE_ANGLE[u.face];
      ctx.strokeStyle = '#e5bd83';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(u.x, u.y - 13, 26, a - Math.PI / 3, a + Math.PI / 3);
      ctx.stroke();
    }
    if (u.hp < u.maxhp && (hero || CL.settings?.get('healthBars') !== false)) {
      ctx.fillStyle = '#27191a';
      ctx.fillRect(u.x - 18, y - 9, 36, 5);
      ctx.fillStyle = u.team === 'ally' ? '#8bc3a9' : '#cd6762';
      ctx.fillRect(u.x - 18, y - 9, (36 * u.hp) / u.maxhp, 5);
    }
    if (!hero) {
      // Team marker.
      ctx.fillStyle = u.team === 'ally' ? '#4bc4dc' : '#e76860';
      ctx.fillRect(u.x - 3, y - 13, 6, 3);
    }
    if (u.routing) {
      // Running (V2-08b): a white mark over the head.
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(u.x - 1.5, y - 25, 3, 8);
      ctx.fillRect(u.x - 1.5, y - 15, 3, 3);
    } else if (u.morale === 'fallback' || u.morale === 'waver') {
      // Shaken: a short amber mark (brighter when falling back).
      ctx.fillStyle = u.morale === 'fallback' ? '#f0b65a' : '#d9c58c';
      ctx.fillRect(u.x - 1.5, y - 22, 3, 6);
    }
  }

  function updateHud() {
    const g = CL.game;
    const $ = CL.ui.$;
    const maxHp = g.hero.maxhp;
    $('#hptext').textContent = `Hero HP: ${Math.max(0, Math.ceil(g.hero.hp))} / ${maxHp}`;
    $('#hpfill').style.width = `${(g.hero.hp / maxHp) * 100}%`;
    const [allies, enemies] = [g.allies.filter((x) => x.alive).length, g.enemies.filter((x) => x.alive).length];
    const reserves = g.allyReserve?.length || g.enemyReserve?.length ? [g.allyReserve?.length || 0, g.enemyReserve?.length || 0] : null;
    // At the largest text size the line is shortened rather than crowding the field (W-01); numbers stay whole.
    $('#summary').textContent = compactHud()
      ? `${allies} v ${enemies} · Wave ${g.wave}/${g.totalWaves}${reserves ? ` · Res ${reserves[0]}/${reserves[1]}` : ''}`
      : `Allies ${allies} · Enemies ${enemies} · Wave ${g.wave}/${g.totalWaves}${reserves ? ` · Reserves ${reserves[0]}/${reserves[1]}` : ''}`;
  }

  // ---- Walkable town (Stonebridge) ----

  const TALK_VERB = { trade: 'Trade', recruit: 'Hire troops', tavern: 'Inn', talk: 'Talk', leave: 'Leave town' };

  function drawNpc(n) {
    const sw = 37;
    const sh = 43;
    ctx.fillStyle = '#172b1f66';
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 4, sw * 0.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const frame = n.frames[Math.floor(n.anim) % n.frames.length];
    drawImage(CL.assets.key('u', frame), n.x - sw / 2, n.y - sh + 8, sw, sh);
  }

  function drawTown() {
    const g = CL.game;
    const t = g.town;
    drawGround();
    const scene = [
      [t.hero.y, () => drawUnit(t.hero)],
      ...t.npcs.map((n) => [n.y, () => drawNpc(n)]),
      ...t.hub.obstacles.map((o) => [obstacleBase(o), () => drawObstacle(o)]),
    ].sort((p, q) => p[0] - q[0]);
    for (const [, paint] of scene) paint();
    // Short titles under people's feet (clear of building signs); full name + action for whoever is in reach.
    for (const n of t.npcs) {
      label(n.tag || n.name, n.x, n.y + 20, '#e8f0ff');
      if (t.near === n) {
        const text = `${n.name} — TALK: ${TALK_VERB[n.action]}`;
        ctx.font = font(14);
        const w = ctx.measureText(text).width + 16;
        const x = Math.max(w / 2 + 14, Math.min(W - w / 2 - 14, n.x));
        const h = Math.round(22 * ts());
        ctx.fillStyle = '#0c1a26e8';
        ctx.fillRect(x - w / 2, n.y - 52 - h, w, h);
        ctx.strokeStyle = '#ffe7a8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - w / 2, n.y - 52 - h, w, h);
        label(text, x, n.y - 52 - 6 * ts(), '#ffe7a8');
      }
    }
    const z = t.hub.exitZone;
    label('◀ To the road', z.x + 44, z.y + z.h + 16, '#ffe7a8');
    updateMapHud();
  }

  // ---- Strategic map ----

  const FACTION_EMBLEM = { valedorn: 'V', aurelian: 'A', neutral: 'R' };

  function polyPath(points) {
    const { toPx } = CL.world;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const [px, py] = toPx(x, y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
  }

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
    const [x, y] = CL.world.toPx(s.mapX, s.mapY);
    const holder = CL.realm.owner(s.id);
    const color = CL.content.get('factions', holder).color;
    ctx.save();
    ctx.fillStyle = '#00000044';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9dcc0';
    ctx.strokeStyle = '#2a2116';
    ctx.lineWidth = 2;
    if (s.type === 'fort') {
      ctx.fillRect(x - 11, y - 12, 22, 20);
      ctx.strokeRect(x - 11, y - 12, 22, 20);
      for (const dx of [-11, -4, 3]) ctx.fillRect(x + dx, y - 17, 5, 5);
    } else {
      const houses = s.type === 'town' ? [[-9, 0], [3, -4], [-2, 4]] : [[-5, 0]];
      for (const [dx, dy] of houses) {
        ctx.fillRect(x + dx, y + dy - 5, 11, 9);
        ctx.strokeRect(x + dx, y + dy - 5, 11, 9);
        ctx.beginPath();
        ctx.moveTo(x + dx - 1, y + dy - 5);
        ctx.lineTo(x + dx + 5.5, y + dy - 11);
        ctx.lineTo(x + dx + 12, y + dy - 5);
        ctx.closePath();
        ctx.fillStyle = '#8b4a32';
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e9dcc0';
      }
    }
    // Banner with faction letter.
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y - 22, 11, 9);
    ctx.fillStyle = '#2a2116';
    ctx.fillRect(x + 9, y - 22, 2, 18);
    ctx.fillStyle = '#fff';
    ctx.font = fixedFont(8); // the flag's emblem: part of the icon
    ctx.fillText(FACTION_EMBLEM[holder] || '?', x + 13, y - 14.5);
    if (here) {
      ctx.strokeStyle = '#ffe7a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    label(s.name, x, y + 24, undefined, { prio: LABEL_PRIORITY.settlement, iy: y });
  }

  function drawSite(st) {
    const [x, y] = CL.world.toPx(st.mapX, st.mapY);
    const active = CL.world.siteActive(st.id);
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.45;
    ctx.fillStyle = '#5b2a20';
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 7);
    ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 12, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = active ? '#ff6a4a' : '#9b8a78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
    ctx.restore();
    label(active ? st.name : `${st.name} (cleared)`, x, y + 22, active ? '#ffb3a1' : '#c9bda8', { prio: LABEL_PRIORITY.site, iy: y });
  }

  /** A world party: banner in its faction colour, a shape by kind, and its size. */
  function drawParty(p) {
    const t = CL.content.get('party_templates', p.template);
    const { x, y, crowded } = CL.world.partyDrawPos(p); // beside a landmark, not on its name
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
    const color = t.kind === 'bandit' ? '#7a1e16' : CL.content.get('factions', t.faction).color;
    const n = CL.parties.troopCount(p);
    const hostile = CL.parties.hostileTo(CL.campaign, t);
    ctx.save();
    ctx.fillStyle = '#00000055';
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    if (t.kind === 'caravan') {
      // Wagon with two wheels.
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(x - 10, y - 6, 20, 9);
      ctx.strokeRect(x - 10, y - 6, 20, 9);
      ctx.fillStyle = '#e9dcc0';
      ctx.fillRect(x - 8, y - 12, 16, 6);
      for (const dx of [-6, 6]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + 4, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#3b2a18';
        ctx.fill();
      }
    } else {
      // Shield for patrols, jagged pennant for bandits.
      ctx.fillStyle = color;
      ctx.beginPath();
      if (t.kind === 'patrol') {
        ctx.moveTo(x - 8, y - 10);
        ctx.lineTo(x + 8, y - 10);
        ctx.lineTo(x + 8, y - 1);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 8, y - 1);
      } else {
        ctx.moveTo(x - 9, y - 10);
        ctx.lineTo(x + 9, y - 10);
        ctx.lineTo(x + 4, y - 3);
        ctx.lineTo(x + 9, y + 5);
        ctx.lineTo(x - 9, y + 5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = fixedFont(9); // the marker's emblem: part of the icon
      ctx.textAlign = 'center';
      ctx.fillText(t.kind === 'bandit' ? 'R' : FACTION_EMBLEM[t.faction], x - 1, y - 1);
      ctx.textAlign = 'left';
    }
    if (p.chasing === 'player') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(16);
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 16);
      ctx.textAlign = 'left';
    }
    if (crowded) countBadge(x, y, n, hostile);
    ctx.restore();
    if (!crowded) {
      const marked = (p.contractId && !p.ambush) || p.questTag || p.escortTo;
      const name = p.escortTo ? 'Escort' : p.contractId && !p.ambush ? 'Contract target' : p.questTag ? (t.kind === 'bandit' ? 'Quest: Reavers' : 'Quest: Column') : t.kind === 'bandit' ? 'Reavers' : t.kind === 'patrol' ? 'Patrol' : 'Caravan';
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

  function drawWorld() {
    const { toPx, map } = CL.world;
    const m = map();
    const w = CL.campaign.world;
    const g = CL.game;

    ctx.fillStyle = '#6f8f4e';
    ctx.fillRect(0, 0, W, H);
    // Grass mottling.
    ctx.fillStyle = '#7d9a59';
    for (let i = 0; i < 140; i++) ctx.fillRect((i * 211 + 37) % W, (i * 97 + 11) % H, 7, 3);

    // Forests.
    for (const poly of m.forests) {
      polyPath(poly);
      ctx.closePath();
      ctx.fillStyle = '#3f6334';
      ctx.fill();
      ctx.fillStyle = '#2f5128';
      const xs = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 3.2) {
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += 5) {
          if (CL.world.terrainAt(x, y) !== 'forest') continue;
          const [px, py] = toPx(x + ((y * 7) % 2), y);
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Hills.
    ctx.strokeStyle = '#5b5236';
    ctx.lineWidth = 3;
    for (const [hx, hy] of m.hills) {
      const [px, py] = toPx(hx, hy);
      ctx.beginPath();
      ctx.arc(px, py + 8, 14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    // River.
    polyPath(m.river);
    ctx.strokeStyle = '#3c6f93';
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#5d93b5';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Roads.
    for (const road of m.roads) {
      const pts = road.map((id) => {
        const s = CL.content.get('settlements', id);
        return [s.mapX, s.mapY];
      });
      polyPath(pts);
      ctx.strokeStyle = '#4a3a24';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#b39a6a';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    mapLabels = [];
    for (const st of Object.values(m.sites)) drawSite(st);
    for (const s of Object.values(CL.content.table('settlements'))) drawSettlement(s, s.id === w.location);
    for (const p of CL.campaign.parties || []) drawParty(p);

    // Journey line.
    const [px, py] = toPx(w.x, w.y);
    if (g.travel) {
      const [tx, ty] = toPx(g.travel.x, g.travel.y);
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
    // Party marker: the hero sprite, walking while travelling; stands beside a settlement's icon.
    const [mx, my] = w.location ? [px - 22, py + 4] : [px, py];
    const frames = CL.assets.heroFrames[g.travel ? g.travelFace : 'down'];
    const frame = g.travel ? frames[Math.floor(performance.now() / 160) % frames.length] : frames[0];
    ctx.fillStyle = '#00000055';
    ctx.beginPath();
    ctx.ellipse(mx, my + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    drawHeroFrame(CL.assets.key('u', frame), mx - 13, my - 32, 26, 33);
    placeLabels([{ x: mx - 13, y: my - 32, w: 26, h: 33 }]);

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
  }

  // ---- Minimap and tactical overview (V2-06; js/tactics.js) ----

  const GROUP_COLOR = { infantry: '#8fb8ff', archer: '#9be07f', cavalry: '#ffd36b' };
  const terrainCache = new WeakMap();

  /** The field's terrain at a small fixed scale, drawn once per map: ground, glades, trees, cover. */
  function terrainImage(m) {
    let img = terrainCache.get(m);
    if (img) return img;
    const { w, h } = CL.camera.worldSize(m);
    const k = 0.125; // 2880×1620 → 360×203
    img = document.createElement('canvas');
    img.width = Math.ceil(w * k);
    img.height = Math.ceil(h * k);
    const c = img.getContext('2d');
    c.fillStyle = m.ground.base;
    c.fillRect(0, 0, img.width, img.height);
    for (const p of m.ground.patches || (m.ground.patch ? [m.ground.patch] : [])) {
      c.fillStyle = p.color;
      c.beginPath();
      c.ellipse(p.x * k, p.y * k, p.rx * k, p.ry * k, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (const o of m.obstacles) {
      c.fillStyle = o.blocksArrows ? '#24361f' : '#5d6b49';
      c.beginPath();
      c.arc(o.x * k, o.y * k, Math.max(2, (o.r || 12) * k * 1.6), 0, Math.PI * 2);
      c.fill();
    }
    terrainCache.set(m, img);
    return img;
  }

  /** Draw the field into a screen rectangle r: terrain, view, company, detected enemies. */
  function drawField(g, r, dot) {
    const T = CL.tactics;
    ctx.drawImage(terrainImage(g.battleMap), r.x, r.y, r.w, r.h);
    const cam = g.camera || { x: 0, y: 0 };
    const v = T.toScreen(r, cam.x, cam.y);
    ctx.strokeStyle = '#f8ecd0cc';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.x, v.y, W * r.scale, H * r.scale);
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
    for (const a of g.allies) if (a.alive) pip(a.x, a.y, GROUP_COLOR[a.role] || '#8fb8ff', dot);
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
    // One flag per group that has soldiers fit to fight.
    const fit = { infantry: 0, archer: 0, cavalry: 0 };
    for (const s of CL.party.healthySoldiers()) fit[CL.content.troop(s.troop).role]++;
    const letters = { infantry: 'I', archer: 'A', cavalry: 'C' };
    for (const grp of CL.prep.GROUPS) {
      if (!fit[grp]) continue;
      const a = T.toScreen(r, p.plan.anchors[grp].x, p.plan.anchors[grp].y);
      ctx.strokeStyle = '#1b1208';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 10);
      ctx.lineTo(a.x, a.y - 16);
      ctx.stroke();
      ctx.fillStyle = GROUP_COLOR[grp];
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
    for (const group of ['infantry', 'archer', 'cavalry']) {
      if (g.orders[group] !== 'hold') continue;
      const units = g.allies.filter((a) => a.alive && a.role === group);
      if (!units.length) continue;
      const hx = units.reduce((n, u) => n + u.holdX, 0) / units.length;
      const hy = units.reduce((n, u) => n + u.holdY, 0) / units.length;
      const p = CL.tactics.toScreen(r, hx, hy);
      ctx.strokeStyle = GROUP_COLOR[group];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 14);
      ctx.stroke();
      ctx.fillStyle = GROUP_COLOR[group];
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
      const [dx, dy] = [e.x - cam.x - cx, e.y - cam.y - cy];
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
    // The battlefield is drawn in world pixels through the camera (PROTO-A; a one-screen map keeps it at 0,0).
    const cam = g.camera || { x: 0, y: 0 };
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    drawGround();

    const seen = (x, y, margin) => CL.camera.visible(g, x, y, margin);
    const chars = [...g.allies, ...g.enemies];
    if (g.hero) chars.push(g.hero);
    chars.sort((a, b) => a.y - b.y); // painter's order by depth
    for (const u of chars) if (u.ground && seen(u.x, u.y, 60)) drawDowned(u);
    // Living units and obstacles share one depth order, so units can pass behind trees and walls.
    const scene = [
      ...chars.filter((u) => u.alive && seen(u.x, u.y, 80)).map((u) => [u.y, () => drawUnit(u)]),
      ...(g.battleMap?.obstacles || [])
        .filter((o) => seen(o.x + (o.w || 0) / 2, o.y + (o.h || 0) / 2, 120 + Math.max(o.w || 0, o.h || 0)))
        .map((o) => [obstacleBase(o), () => drawObstacle(o)]),
    ].sort((p, q) => p[0] - q[0]);
    for (const [, paint] of scene) paint();

    for (const a of g.arrows) {
      ctx.strokeStyle = a.team === 'ally' ? '#f6e8b4' : '#eec19e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.dx * 17, a.y - a.dy * 17);
      ctx.stroke();
    }
    for (const e of CL.settings?.get('reducedEffects') ? [] : g.effects) {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // A ring that grows as it fades; an effect may bring its own length and size (the Rally ring).
      ctx.arc(e.x, e.y, Math.max(0, (e.size || 15) * (1 - e.t / (e.life || 0.4))), 0, Math.PI * 2);
      ctx.stroke();
    }
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

  CL.render = { init, draw, setBackingScale, backingScale: () => backing };
})(typeof window !== 'undefined' ? window : globalThis);
