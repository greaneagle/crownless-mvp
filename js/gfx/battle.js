/* Crownless graphics demonstration (experimental, debug only): a playable battle.
 *
 * The fighting is the game's own: CL.combat.startBattle with a practice definition (its soldiers are its
 * own, nothing is rewarded, nothing reaches the roster), run each frame by CL.combat.update on the
 * sandbox CL.game. Movement, blows, blocks, arrows, orders, morale and the AI are all unchanged. This
 * file only draws what that state says, so the animation can never change a hitbox or a timing:
 *   u.face            the body's facing (front, back or side view)
 *   u.swing / phases  the blade rises in the windup, sweeps in the active part, returns in recovery;
 *                     a spear levels and thrusts along its line instead
 *   u.guard           the shield comes across the body
 *   u.ranged, cooldown, u.shot  the bow is drawn while reloading and released on the shot
 *   u.flash           a brief pale flash and a small recoil when struck
 *   u.ground, downAt  the fallen lie still and fade like the game's (CL.render.bodyAlpha)
 *   u.routing, morale a pale pennant over those running, an amber mark on the shaken
 * Movement (for the walk cycle and dust) is read from each unit's change of position.
 *
 * "Current art" draws the same live battle with the game's own renderer (js/render.js), for comparison:
 * every obstacle here also carries the old renderer's look. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, fill } = G;
  G.scenes = G.scenes || {};

  const ARMY = ['levy', 'levy', 'levy', 'footman', 'footman', 'footman', 'footman', 'guard', 'guard', 'spearman', 'spearman', 'spearman', 'hunter', 'hunter', 'hunter', 'longbowman', 'rider', 'rider'];
  const FOES = {
    hrothmark: { name: 'Hrothmark Raiders', side: 'hrothmark', wave: { clansman: 3, shieldmaiden: 2, axeman: 4, huscarl: 2, fell_archer: 3, hill_rider: 2 } },
    reavers: { name: 'Road Reavers', side: 'reavers', wave: { looter: 5, reaver: 6, mercenary: 2, outlaw_huntress: 2 } },
  };
  const CAP = 40; // everyone on the field at once (this battle is 35)
  const FIG = 1.12; // figures a touch larger than the town's, for the battlefield at phone size

  // ---- The field ----

  /** The battle map, in the game's format, with the demo's look and the old renderer's look on each obstacle. */
  function field() {
    const W = 1920;
    const H = 1080;
    const r = G.rng(4242);
    const o = [];
    const tree = (x, y, kind = 'broad') => o.push({ shape: 'circle', x, y, r: 18, blocksArrows: true, look: { tile: 'w0132', w: 92, h: 97 }, demo: kind, seed: Math.floor(r() * 99) });
    const bush = (x, y) => o.push({ shape: 'circle', x, y, r: 13, blocksArrows: false, look: { tile: 'w0001', w: 38, h: 30 }, demo: 'bush', seed: Math.floor(r() * 99) });
    const rock = (x, y) => o.push({ shape: 'circle', x, y, r: 14, blocksArrows: false, look: { tile: 'w0012', w: 40, h: 30 }, demo: 'rock', seed: Math.floor(r() * 99) });
    const rect = (x, y, w, h, demo, look = 'crate') => o.push({ shape: 'rect', x, y, w, h, blocksArrows: demo === 'wall', look, demo });
    // The forest edge along the north, with a gap or two.
    for (let x = 60; x < W - 60; x += 64 + r() * 40) {
      if (x > 820 && x < 940) continue;
      tree(x, 95 + r() * 60, r() < 0.3 ? 'pine' : 'broad');
      if (r() < 0.45) tree(x + 30, 170 + r() * 50, r() < 0.3 ? 'pine' : 'broad');
    }
    // A copse to the south-east, a few lone trees.
    for (const [x, y] of [[1500, 900], [1560, 940], [1450, 960], [1620, 880], [1530, 1000], [260, 1000], [1180, 1010], [700, 980]]) tree(x, y, r() < 0.25 ? 'birch' : 'broad');
    // Trees and bushes near the company's start, so the first view has a place to it.
    for (const [x, y] of [[110, 330], [170, 300], [90, 410], [560, 310], [610, 345], [140, 790], [90, 860], [980, 330], [930, 860]]) tree(x, y, r() < 0.3 ? 'pine' : 'broad');
    for (const [x, y] of [[220, 360], [520, 360], [200, 760], [640, 1000]]) bush(x, y);
    for (const [x, y] of [[620, 300], [980, 260], [1300, 330], [400, 760], [880, 900], [1650, 640], [1350, 820], [160, 260]]) bush(x, y);
    for (const [x, y] of [[1050, 420], [1110, 690], [760, 640], [1400, 470], [300, 400], [1750, 420]]) rock(x, y);
    // A low dry-stone wall across part of the field, and a field fence.
    rect(640, 380, 150, 14, 'wall', 'wall');
    rect(700, 760, 130, 14, 'wall', 'wall');
    rect(150, 820, 210, 8, 'fence', 'wall');
    // An abandoned wagon with crates and barrels.
    rect(470, 880, 70, 26, 'wagon');
    rect(560, 890, 26, 22, 'crate');
    rect(440, 920, 22, 20, 'barrel');
    const stream = { x: 1210, y: 0, w: 70, h: H };
    const patches = [];
    for (let i = 0; i < 16; i++) patches.push({ color: r() < 0.6 ? PAL.grassLight : PAL.meadow, x: r() * W, y: 200 + r() * (H - 260), rx: 110 + r() * 160, ry: 60 + r() * 80 });
    const tufts = [];
    for (let i = 0; i < 220; i++) {
      const x = r() * W;
      const y = 200 + r() * (H - 220);
      if (x > stream.x - 10 && x < stream.x + stream.w + 10) continue;
      tufts.push([x, y, r() < 0.15 ? ['#f2e2a0', '#e9a6a0', '#ffffff'][Math.floor(r() * 3)] : null]);
    }
    return {
      id: 'gfx_field',
      name: 'Hartford meadow (demo)',
      tileset: '16x16',
      width: W,
      height: H,
      bounds: { minX: 47, maxX: W - 52, minY: 65, maxY: H - 50 },
      obstacles: o,
      spawn: { hero: { x: 346, y: 560 }, enemies: { x0: 1460, x1: 1760, y0: 330, y1: 760 } },
      // The old renderer's ground (for "Current art"), and the stream's shallows (the game's ford rule).
      ground: { base: '#71904e', tiles: ['w0000', 'w0001', 'w0002'], patches: patches.map((p) => ({ ...p, color: '#6f8a4c' })), waters: [stream] },
      slow: [{ ...stream, factor: CL.arena?.FORD_SLOW ?? 0.5 }],
      decor: [],
      demo: { patches, tufts, stream },
    };
  }

  // ---- Start, update, end ----

  function init(S) {
    S.battle = null;
    S.battleField = S.battleField || field();
  }

  function start(S, enemy, api) {
    const foe = FOES[enemy] || FOES.hrothmark;
    const g = CL.game;
    Object.assign(g, { siteId: null, partyId: null, prepPlan: null });
    CL.combat.BATTLE.activeCap = CAP;
    CL.combat.startBattle({ id: `gfx_${enemy}`, name: foe.name, mapDef: S.battleField, waves: [{ ...foe.wave }], practice: ARMY.slice(), reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
    S.battle = { enemy, foe, looks: new WeakMap(), track: new WeakMap(), dust: [], done: false, startedAt: S.t, sparks: [] };
    root.document.querySelector('#stage').dataset.mode = 'battle';
    api.card(null);
    api.note('battle started', { enemy, allies: g.allies.length + 1, enemies: g.enemies.length });
  }

  function enter(S, api, opts) {
    start(S, opts.enemy || S.battleFrom?.enemy || 'hrothmark', api);
    if (opts.from !== 'map') S.battleFrom = null;
  }
  function leave(S, api) {
    const g = CL.game;
    if (g.mode === 'battle' || g.mode === 'result') {
      Object.assign(g, { mode: 'gfxdemo', allies: [], enemies: [], arrows: [], effects: [], hero: null, practice: null, paused: false, overview: false });
    }
    root.document.querySelector('#ordersPanel')?.classList.add('hidden');
    api?.card?.(null);
    S.battle = null;
  }

  function update(S, dt, api) {
    const B = S.battle;
    if (!B) return;
    const g = CL.game;
    if (g.mode === 'battle') CL.combat.update(dt); // the game's battle, unchanged
    // How each unit moved this frame (for the walk cycle and dust), never written back to the unit.
    const all = [...g.allies, ...g.enemies];
    if (g.hero) all.push(g.hero);
    for (const u of all) {
      let tr = B.track.get(u);
      if (!tr) {
        tr = { x: u.x, y: u.y, walk: G.hash(u.id, 3) * 6, move: 0, dustAt: 0 };
        B.track.set(u, tr);
      }
      const d = Math.hypot(u.x - tr.x, u.y - tr.y);
      const speed = dt > 0 ? d / dt : 0;
      tr.move += (Math.min(1, speed / 60) - tr.move) * Math.min(1, dt * 12);
      tr.walk += dt * (u.role === 'cavalry' ? 11 : 10) * Math.min(1.4, speed / 70);
      tr.x = u.x;
      tr.y = u.y;
      if (u.alive && speed > 80 && !api.reduced() && S.t > tr.dustAt) {
        tr.dustAt = S.t + (u.role === 'cavalry' ? 0.12 : 0.3);
        if (B.dust.length < 50) B.dust.push({ x: u.x + (G.hash(u.id, S.t) - 0.5) * 8, y: u.y + 2, t: 0 });
      }
    }
    for (const p of B.dust) p.t += dt;
    B.dust = B.dust.filter((p) => p.t < 0.7);
    if (!B.done && g.mode === 'result') {
      B.done = true;
      const win = Boolean(g.result?.win);
      S.battleResult = { win };
      const fallen = g.allies.filter((u) => !u.alive).length;
      const left = g.enemies.filter((u) => u.alive && !u.routing).length;
      api.note('battle ended', { win, kills: g.kills, fallen });
      api.card({
        title: win ? 'Victory' : 'Defeat',
        lines: [win ? `${B.foe.name} are broken: ${g.kills} down${g.routed ? `, ${g.routed} fled` : ''}.` : `Your company is beaten${left ? `; ${left} of them still stand` : ''}.`, `Your side lost ${fallen} of ${g.allies.length}${g.hero?.alive ? '' : ' and the hero fell'}.`, 'A demonstration battle: nothing in your campaign changed and nothing was saved.'],
        buttons: [
          { label: 'Back to the map', primary: true, onClick: () => api.go('map', { from: 'battle' }) },
          { label: 'Fight again', onClick: () => start(S, B.enemy, api) },
          { label: 'Look at the field', onClick: () => api.card(null) },
        ],
      });
    }
  }

  // ---- Drawing ----

  function lookOf(B, u) {
    let L = B.looks.get(u);
    if (L) return L;
    if (u.role === 'hero') {
      const ch = CL.campaign?.character;
      L = G.fig.heroLook(ch?.cloak, ch?.gender === 'female');
      if (!u.canBlock) L.shield = null;
    } else {
      const side = u.team === 'ally' ? 'valedorn' : B.foe.side;
      L = G.fig.troopLook(u.troop, side, u.id);
    }
    B.looks.set(u, L);
    return L;
  }

  function poseOf(u, tr, t, reduced) {
    const SW = CL.units.SWING;
    if (tr && (u.face === 'left' || u.face === 'right')) tr.hface = u.face;
    const P = { face: u.face, walk: tr?.walk || 0, move: tr?.move || 0, t: t + (u.id % 7), reduced, scale: FIG, hface: tr?.hface || (u.team === 'ally' ? 'right' : 'left'), aim: u.face };
    const ph = CL.units.swingPhase(u);
    if (ph) {
      const st = u.swing.t;
      const k = ph === 'windup' ? st / SW.windup : ph === 'active' ? (st - SW.windup) / SW.active : (st - SW.windup - SW.active) / SW.recovery;
      P.atk = { phase: ph, k: Math.max(0, Math.min(1, k)) };
    }
    P.guard = Boolean(u.guard);
    if (u.ranged) {
      const cd = u.ranged.cooldown || 1.6;
      const aiming = u.target?.alive || u.role === 'hero';
      P.draw = aiming ? Math.max(0, Math.min(1, 1 - u.attackCooldown / cd)) : 0;
      P.shot = Math.min(1, (u.shot || 0) / 0.2);
      if (P.shot > 0.2) P.draw = 0;
    }
    P.hit = u.flash > 0 ? Math.min(1, u.flash / 0.14) : 0;
    return P;
  }

  function drawUnit(ctx, B, u, t, reduced) {
    const L = lookOf(B, u);
    const tr = B.track.get(u);
    const P = poseOf(u, tr, t, reduced);
    const hero = u.role === 'hero';
    const ally = u.team === 'ally';
    // Who is whose, beneath the feet: blue for the company, red for the foe, gold for the hero.
    ctx.lineWidth = hero ? 2.2 : 1.6;
    ctx.strokeStyle = hero ? 'rgba(216,178,90,0.95)' : ally ? 'rgba(76,130,196,0.75)' : 'rgba(186,72,58,0.75)';
    ellipse(ctx, u.x, u.y + 5, u.role === 'cavalry' ? 17 : 11, u.role === 'cavalry' ? 6 : 4.2);
    ctx.stroke();
    if (u.role === 'cavalry') {
      const M = L.mount || { coat: '#8a5a3a' };
      const side = u.face === 'left' || u.face === 'right' ? u.face : P.hface;
      G.fig.horse(ctx, u.x, u.y + 5, { ...M, cloth: ally ? 'valedorn' : B.foe.side }, P, () => G.fig.figure(ctx, u.x, u.y + 5, L, { ...P, face: side, mounted: true }));
    } else G.fig.figure(ctx, u.x, u.y + 5, L, P);
    const top = u.y + 5 - (u.role === 'cavalry' ? 56 : hero ? 46 : 44);
    if (u.hp < u.maxhp && (hero || CL.settings?.get?.('healthBars') !== false)) {
      ctx.fillStyle = 'rgba(39,25,26,0.75)';
      G.rrect(ctx, u.x - 11, top - 4, 22, 3.6, 1.8);
      ctx.fill();
      ctx.fillStyle = ally ? '#8bc3a9' : '#d07468';
      G.rrect(ctx, u.x - 11, top - 4, (22 * Math.max(0, u.hp)) / u.maxhp, 3.6, 1.8);
      ctx.fill();
    }
    if (u.routing) {
      // Running: a pale pennant (the game's "routing" state).
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(u.x, top - 6);
      ctx.lineTo(u.x, top - 20);
      ctx.stroke();
      G.poly(ctx, [u.x, top - 20, u.x + 9, top - 16, u.x, top - 13]);
      G.fillLine(ctx, '#f4efe2', 1);
    } else if (u.morale === 'fallback' || u.morale === 'waver') {
      ctx.fillStyle = u.morale === 'fallback' ? '#f0b65a' : '#d9c58c';
      ellipse(ctx, u.x, top - 9, 2.4, 2.4);
      ctx.fill();
    }
    if (u.named) {
      ctx.font = '600 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe2a8';
      ctx.fillText(u.named, u.x, top - 10);
      ctx.textAlign = 'left';
    }
  }

  function obstacle(ctx, o, t) {
    const k = o.demo;
    if (k === 'broad' || k === 'pine' || k === 'birch') G.tree(ctx, o.x, o.y + 6, 1.15, o.seed, k, Math.sin(t * 0.7 + o.x) * 0.02);
    else if (k === 'bush') G.bush(ctx, o.x, o.y + 6, 1.2, o.seed);
    else if (k === 'rock') G.rock(ctx, o.x, o.y + 6, 1.15, o.seed);
    else if (k === 'wall') G.stoneWall(ctx, o.x, o.y + o.h, o.x + o.w, 1.2, o.x);
    else if (k === 'fence') G.fence(ctx, o.x, o.y + o.h, o.x + o.w, o.y + o.h, 1.2);
    else if (k === 'wagon') {
      G.wagon(ctx, o.x + o.w / 2, o.y + o.h, 1.3, 1, 0, '#cbbf9f');
    } else if (k === 'crate') {
      G.crate(ctx, o.x + o.w / 2, o.y + o.h, 1.25);
    } else if (k === 'barrel') {
      G.barrel(ctx, o.x + 5, o.y + o.h, 1.25);
      G.barrel(ctx, o.x + 17, o.y + o.h - 3, 1.2);
    }
  }
  const baseOf = (o) => (o.shape === 'circle' ? o.y + o.r * 0.5 : o.y + o.h);

  function draw(ctx, S, api) {
    const B = S.battle;
    const g = CL.game;
    if (!B || !g.battleMap) return;
    const m = g.battleMap;
    const cam = g.camera || { x: 0, y: 0, zoom: 1 };
    const z = CL.camera.zoomOf(g);
    const t = S.t;
    const reduced = api.reduced();
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    const v = { x: cam.x, y: cam.y, w: 960 / z, h: 540 / z };
    const seen = (x, y, mg) => x > v.x - mg && x < v.x + v.w + mg && y > v.y - mg && y < v.y + v.h + mg;
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const D = m.demo;
    ctx.globalAlpha = 0.38;
    for (const p of D.patches) if (seen(p.x, p.y, Math.max(p.rx, p.ry))) {
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, p.color);
    }
    ctx.globalAlpha = 1;
    // A cart track across the meadow (looks only).
    ctx.strokeStyle = 'rgba(214,196,157,0.75)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 640);
    ctx.quadraticCurveTo(600, 600, 1000, 560);
    ctx.quadraticCurveTo(1500, 520, 1920, 600);
    ctx.stroke();
    ctx.lineCap = 'butt';
    stream(ctx, D.stream, v, t);
    if (z > 0.6) for (const [x, y, f] of D.tufts) if (seen(x, y, 8)) G.tuft(ctx, x, y, 1, PAL.grassDark, f);
    for (const p of B.dust) {
      ctx.globalAlpha = 0.35 * (1 - p.t / 0.7);
      ellipse(ctx, p.x - p.t * 6, p.y - p.t * 9, 4 + p.t * 9, 2.5 + p.t * 4);
      fill(ctx, '#e8dcc0');
    }
    ctx.globalAlpha = 1;

    const chars = [...g.allies, ...g.enemies];
    if (g.hero) chars.push(g.hero);
    // The fallen first (they lie on the ground), faded as the game fades them.
    for (const u of chars) {
      if (u.alive || !u.ground || !seen(u.x, u.y, 40)) continue;
      const a = CL.render?.bodyAlpha ? CL.render.bodyAlpha(u) : 0.5;
      if (a > 0) G.fig.fallen(ctx, u.x, u.y + 4, lookOf(B, u), a, u.face === 'left' ? -1 : 1);
    }
    const items = [];
    for (const u of chars) if (u.alive && seen(u.x, u.y, 60)) items.push([u.y + 5, () => drawUnit(ctx, B, u, t, reduced)]);
    for (const o of m.obstacles) if (seen(o.x + (o.w || 0) / 2, o.y, 120)) items.push([baseOf(o) + 6, () => obstacle(ctx, o, t)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, paint] of items) paint();

    // Arrows and bolts: a shaft, a head and fletching, so a volley reads as arrows.
    for (const a of g.arrows) {
      if (!seen(a.x, a.y, 30)) continue;
      const ang = Math.atan2(a.dy, a.dx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(1, 0);
      ctx.stroke();
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      G.poly(ctx, [1, -2.2, 6, 0, 1, 2.2]);
      fill(ctx, PAL.steel);
      G.poly(ctx, [-15, 0, -18, -3, -12, 0, -18, 3]);
      fill(ctx, a.team === 'ally' ? '#e9e1cc' : '#b0453a');
      ctx.restore();
    }
    // The game's effects, restrained: a small burst for a hit, a pale arc for a block, a puff for an arrow
    // in the ground, the rally's ring. None with Reduced effects except the rally.
    for (const e of g.effects) {
      if (!seen(e.x, e.y, 60)) continue;
      if (reduced && e.kind !== 'rally') continue;
      const life = e.life || (e.kind === 'hit' ? 0.35 : 0.2);
      const k = 1 - Math.max(0, e.t) / life;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'hit') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          ctx.moveTo(Math.cos(a) * (3 + k * 3), Math.sin(a) * (3 + k * 3));
          ctx.lineTo(Math.cos(a) * (7 + k * 6), Math.sin(a) * (7 + k * 6));
        }
        ctx.stroke();
      } else if (e.kind === 'block') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#e4eef6';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, 9 + k * 5, -2.2, -0.9);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ellipse(ctx, 0, -9 - k * 5, 2.2, 2.2);
        ctx.fill();
      } else if (e.kind === 'thunk') {
        ctx.globalAlpha = 0.5 * (1 - k);
        ellipse(ctx, 0, 0, 4 + k * 6, 2 + k * 3);
        fill(ctx, '#e8dcc0');
      } else if (e.kind === 'rally' || e.kind === 'brace') {
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.strokeStyle = e.kind === 'rally' ? PAL.gold : '#f6daa6';
        ctx.lineWidth = 2.4;
        ellipse(ctx, 0, 20, (e.size || 20) * (0.4 + k * 0.6), (e.size || 20) * (0.4 + k * 0.6) * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    hudCanvas(ctx, S, api);
  }

  function stream(ctx, s, v, t) {
    if (s.x > v.x + v.w || s.x + s.w < v.x) return;
    // A gentle brook: the shallows exactly where the game slows wading feet, with soft banks.
    const y0 = Math.max(0, v.y - 20);
    const y1 = Math.min(1080, v.y + v.h + 20);
    const wob = (y, k) => Math.sin(y * 0.012 + k) * 5;
    ctx.beginPath();
    ctx.moveTo(s.x + wob(y0, 0) - 6, y0);
    for (let y = y0; y <= y1; y += 24) ctx.lineTo(s.x + wob(y, 0) - 6, y);
    for (let y = y1; y >= y0; y -= 24) ctx.lineTo(s.x + s.w + wob(y, 2) + 6, y);
    ctx.closePath();
    fill(ctx, PAL.bank);
    ctx.beginPath();
    ctx.moveTo(s.x + wob(y0, 0), y0);
    for (let y = y0; y <= y1; y += 24) ctx.lineTo(s.x + wob(y, 0), y);
    for (let y = y1; y >= y0; y -= 24) ctx.lineTo(s.x + s.w + wob(y, 2), y);
    ctx.closePath();
    fill(ctx, PAL.water);
    ctx.strokeStyle = PAL.waterLight;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let y = Math.floor(y0 / 40) * 40; y < y1; y += 40) {
      const x = s.x + 16 + ((y / 40) % 2) * 22 + wob(y, 1);
      const dy = (t * 18) % 40;
      ctx.moveTo(x, y + dy);
      ctx.quadraticCurveTo(x + 6, y + dy - 3, x + 12, y + dy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Stepping stones and reeds (looks only).
    for (const [x, y] of [[s.x + 18, 610], [s.x + 38, 630], [s.x + 54, 650]]) {
      ellipse(ctx, x, y, 6, 3.6);
      G.fillLine(ctx, PAL.rock, 1);
    }
    ctx.strokeStyle = PAL.forestLight;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const y of [180, 330, 820, 940]) {
      for (const dx of [-3, 0, 3]) {
        ctx.moveTo(s.x + 4 + dx, y);
        ctx.lineTo(s.x + 2 + dx * 2, y - 12);
      }
    }
    ctx.stroke();
  }

  /** The battle's few words on screen: the hero's health, the sides, the orders. */
  function hudCanvas(ctx, _S, api) {
    const g = CL.game;
    const h = g.hero;
    if (!h) return;
    const ts = api.textScale();
    const x = 12;
    const y = 12;
    ctx.fillStyle = 'rgba(12,26,38,0.78)';
    G.rrect(ctx, x, y, 206 * ts, 66 * ts, 8);
    ctx.fill();
    ctx.font = `700 ${Math.round(12 * ts)}px system-ui, sans-serif`;
    ctx.fillStyle = '#f3e3b5';
    ctx.fillText(`${CL.campaign?.character?.name || 'Hero'}  ${Math.max(0, Math.round(h.hp))} / ${h.maxhp}`, x + 10, y + 17 * ts);
    ctx.fillStyle = '#502a28';
    G.rrect(ctx, x + 10, y + 23 * ts, 176 * ts, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#c95c57';
    G.rrect(ctx, x + 10, y + 23 * ts, (176 * ts * Math.max(0, h.hp)) / h.maxhp, 6, 3);
    ctx.fill();
    const live = (l) => l.filter((u) => u.alive && !u.routing).length;
    ctx.font = `600 ${Math.round(11 * ts)}px system-ui, sans-serif`;
    ctx.fillStyle = '#e8f0ff';
    const orders = g.orders ? [['infantry', 'Foot'], ['archer', 'Bows'], ['cavalry', 'Horse']].map(([d, n]) => `${n} ${g.orders[d] || '–'}`).join(' · ') : '';
    ctx.fillText(`Yours ${live(g.allies) + (h.alive ? 1 : 0)} · Theirs ${live(g.enemies)}`, x + 10, y + 44 * ts);
    ctx.fillStyle = '#c9d3c0';
    ctx.fillText(orders, x + 10, y + 58 * ts);
    if (g.paused) {
      ctx.fillStyle = 'rgba(6,16,26,0.5)';
      ctx.fillRect(0, 0, api.W, api.H);
      ctx.font = '700 30px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8e9c5';
      ctx.fillText('Paused (Esc)', api.W / 2, api.H / 2);
      ctx.textAlign = 'left';
    }
  }

  function hud(S, api) {
    const g = CL.game;
    if (S.battle?.done || g.mode !== 'battle') return api.prompt('');
    api.prompt(S.t - (S.battle?.startedAt || 0) < 8 ? 'Move WASD / stick · Space or ATTACK to strike · Shift or BLOCK · F H C orders · 1 2 3 divisions · R rally · Esc pause' : '', []);
  }

  function onEscape(_S) {
    const g = CL.game;
    if (g.mode === 'battle') g.paused = !g.paused;
    return true;
  }
  function hidden() {
    if (CL.game.mode === 'battle') CL.game.paused = true;
  }
  function wheel(_S, dy) {
    const g = CL.game;
    if (g.mode === 'battle' || g.mode === 'result') CL.camera.setZoom(g, CL.camera.zoomOf(g) * (dy > 0 ? 0.92 : 1.08)); // set, never remembered as a setting
  }
  function pinch(_S, ratio) {
    const g = CL.game;
    CL.camera.setZoom(g, CL.camera.zoomOf(g) * ratio);
  }
  function key(_S, code, down) {
    // Keys pass to the game's own battle controls (js/input.js); nothing to add here.
    return down && code === 'none' ? 'stop' : undefined;
  }

  G.scenes.battle = { init, enter, leave, update, draw, hud, escape: onEscape, hidden, wheel, pinch, key, start, field, ARMY, FOES };
})(typeof window !== 'undefined' ? window : globalThis);
