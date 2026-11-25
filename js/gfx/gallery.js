/* Crownless graphics demonstration (experimental, debug only): the gallery. Every part of the visual
 * vocabulary on one screen, at the size it is used (1×) and enlarged, turning and animating, so the
 * owner can judge each piece and a future agent can see what exists before adding more. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  G.scenes = G.scenes || {};

  const ROW = [
    ['levy', 'valedorn', 'Levy (recruit)'],
    ['footman', 'valedorn', 'Footman'],
    ['spearman', 'valedorn', 'Spearman'],
    ['guard', 'valedorn', 'Guard (heavy)'],
    ['hunter', 'valedorn', 'Hunter'],
    ['longbowman', 'valedorn', 'Longbowman'],
    ['clansman', 'hrothmark', 'Clansman'],
    ['shieldmaiden', 'hrothmark', 'Shieldmaiden'],
    ['axeman', 'hrothmark', 'Axeman'],
    ['huscarl', 'hrothmark', 'Huscarl'],
    ['fell_archer', 'hrothmark', 'Fell Archer'],
    ['reaver', 'reavers', 'Reaver'],
  ];
  const FOLK = ['merchant', 'smith', 'innkeeper', 'guard', 'recruiter', 'elder', 'farmer', 'townswoman', 'townsman', 'child', 'monk', 'noble'];
  const FACES = ['down', 'right', 'up', 'left'];
  const POSES = ['idle', 'walk', 'attack', 'guard', 'hit'];

  const scene = {
    init(S) {
      S.gallery = { face: 0, pose: 0, auto: true, t: 0, page: 0 };
    },
    enter(_S, api) {
      api.prompt('Gallery: ← → turn · Space: next pose · Tab: next page', []);
    },
    leave(_S, api) {
      api?.prompt?.('');
    },
    update(S, dt) {
      const q = S.gallery;
      q.t += dt;
      if (q.auto && Math.floor(q.t / 2.4) !== Math.floor((q.t - dt) / 2.4)) q.pose = (q.pose + 1) % POSES.length;
    },
    key(S, code) {
      const q = S.gallery;
      if (code === 'ArrowRight' || code === 'KeyD') q.face = (q.face + 1) % 4;
      if (code === 'ArrowLeft' || code === 'KeyA') q.face = (q.face + 3) % 4;
      if (code === 'Space') {
        q.auto = false;
        q.pose = (q.pose + 1) % POSES.length;
      }
      if (code === 'Tab') q.page = (q.page + 1) % 2;
    },
    pointer(S, kind, p) {
      if (kind !== 'up') return;
      const q = S.gallery;
      if (p.y > 470) q.page = (q.page + 1) % 2;
      else q.face = (q.face + 1) % 4;
    },
    draw(ctx, S, api) {
      const q = S.gallery;
      const P = G.PAL;
      ctx.fillStyle = P.grass;
      ctx.fillRect(0, 0, api.W, api.H);
      const face = FACES[q.face];
      const pose = POSES[q.pose];
      label(ctx, `Pose: ${pose} · facing ${face} (tap or ← → to turn)`, 480, 62, api);
      if (q.page === 0) troops(ctx, q, face, pose, api);
      else world(ctx, q, api);
      label(ctx, q.page === 0 ? 'Page 1 of 2: people. Tap here or Tab for buildings, nature and props' : 'Page 2 of 2: buildings, nature, props. Tap here or Tab for people', 480, 520, api);
    },
  };

  function poseFor(pose, face, t, L) {
    const P = { face, t };
    if (pose === 'walk') Object.assign(P, { move: 1, walk: t * 9 });
    if (pose === 'attack') {
      const c = (t * 1.6) % 1;
      const k = c * 1.4;
      if (L.weapon === 'bow') Object.assign(P, { draw: Math.min(1, c * 1.5), shot: c > 0.75 ? (1 - c) * 4 : 0 });
      else if (k < 0.16 / 0.52) P.atk = { phase: 'windup', k: k / (0.16 / 0.52) };
      else if (k < 0.28 / 0.52) P.atk = { phase: 'active', k: (k - 0.16 / 0.52) / (0.12 / 0.52) };
      else if (k < 1) P.atk = { phase: 'recovery', k: (k - 0.28 / 0.52) / (0.24 / 0.52) };
    }
    if (pose === 'guard') P.guard = true;
    if (pose === 'hit') P.hit = Math.max(0, 1 - ((t * 2) % 1) * 3);
    return P;
  }

  function troops(ctx, q, face, pose, api) {
    const t = q.t;
    // Row 1: every troop at true battle size (1×), as a phone shows them.
    label(ctx, 'Soldiers at battle size (1×)', 110, 92, api, 'left');
    ROW.forEach(([id, side], i) => {
      const L = G.fig.troopLook(id, side, i + 1);
      G.fig.figure(ctx, 70 + i * 70, 150, L, poseFor(pose, face, t + i * 0.13, L));
    });
    // Cavalry and the hero.
    const riders = [['rider', 'valedorn'], ['hill_rider', 'hrothmark']];
    riders.forEach(([id, side], i) => {
      const L = G.fig.troopLook(id, side, 40 + i);
      const P = poseFor(pose === 'guard' ? 'idle' : pose, face, t, L);
      const x = 110 + i * 110;
      G.fig.horse(ctx, x, 230, { ...L.mount, cloth: side }, P, () => G.fig.figure(ctx, x, 230, L, { ...P, mounted: true, face: face === 'left' ? 'left' : 'right', aim: face }));
    });
    const hero = G.fig.heroLook(CL.campaign?.character?.cloak);
    G.fig.figure(ctx, 330, 230, hero, poseFor(pose, face, t, hero));
    label(ctx, 'Cavalry · the hero', 220, 258, api);
    // Townsfolk.
    label(ctx, 'Townsfolk', 680, 182, api);
    FOLK.forEach((role, i) => {
      const L = G.fig.townLook(role, i + 3);
      const P = { face, t: t + i * 0.2, move: pose === 'walk' ? 1 : 0, walk: t * 8, work: role === 'smith' && pose !== 'walk', talk: pose === 'idle' ? (Math.sin(t * 9) + 1) / 2 : 0 };
      G.fig.figure(ctx, 440 + (i % 6) * 80, 230 + Math.floor(i / 6) * 60, L, P);
    });
    // Enlarged, so the parts can be inspected (the phone sees row 1).
    label(ctx, 'The same parts, enlarged 2.4×', 480, 330, api);
    const big = [['footman', 'valedorn'], ['spearman', 'valedorn'], ['guard', 'valedorn'], ['longbowman', 'valedorn'], ['axeman', 'hrothmark'], ['huscarl', 'hrothmark']];
    ctx.save();
    big.forEach(([id, side], i) => {
      const L = G.fig.troopLook(id, side, 70 + i);
      ctx.save();
      ctx.translate(95 + i * 150, 470);
      ctx.scale(2.4, 2.4);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.1, L));
      ctx.restore();
    });
    ctx.restore();
  }

  function world(ctx, q, api) {
    const t = q.t;
    const night = 0;
    label(ctx, 'Buildings: one vocabulary, regional materials', 480, 92, api);
    const B = [
      { x: 90, y: 230, w: 86, h: 34, d: 40, wall: 'plaster', roof: 'terracotta', form: 'end', beams: true, chimney: 0.6, windows: 2 },
      { x: 220, y: 230, w: 110, h: 46, d: 44, wall: 'plaster', base: true, roof: 'terracotta', form: 'gable', beams: true, sign: { kind: 'tavern', at: 'right' }, awning: '#a54f3a', chimney: -0.7 },
      { x: 360, y: 230, w: 92, h: 34, d: 40, wall: 'stone', roof: 'slate', form: 'hip', door: 'wide', sign: { kind: 'smith', at: 'left' }, chimney: 0.5 },
      { x: 500, y: 230, w: 100, h: 36, d: 50, wall: 'timber', roof: 'shingle', form: 'long', beams: true, door: 'center', windows: 2 },
      { x: 630, y: 230, w: 70, h: 30, d: 34, wall: 'whitewash', roof: 'thatch', form: 'end', windows: 1 },
      { x: 760, y: 230, w: 84, h: 32, d: 44, wall: 'timber', roof: 'turf', form: 'gable', door: 'left', windows: 1 },
    ];
    for (const b of B) G.building(ctx, b, t, night);
    G.tower(ctx, 880, 230, 1, 58, 15, 'slate', 'cone', t, 'valedorn');
    label(ctx, 'Valedorn: plaster, stone, tile and slate · Hrothmark: timber, shingle and turf', 480, 254, api);
    label(ctx, 'Nature and props', 480, 290, api);
    G.tree(ctx, 60, 380, 1, 3, 'broad', Math.sin(t) * 0.03);
    G.tree(ctx, 110, 380, 1, 8, 'pine');
    G.tree(ctx, 160, 380, 1, 5, 'birch', Math.sin(t + 1) * 0.03);
    G.bush(ctx, 210, 380, 1, 4, '#b0453a');
    G.rock(ctx, 250, 380, 1, 5);
    G.barrel(ctx, 290, 380);
    G.crate(ctx, 325, 380);
    G.fence(ctx, 350, 380, 420, 380);
    G.stoneWall(ctx, 440, 380, 520);
    G.well(ctx, 560, 380);
    G.stall(ctx, 630, 380, 1, '#3b6ea5');
    G.anvil(ctx, 690, 380);
    G.forge(ctx, 730, 380, 1, t);
    G.rack(ctx, 780, 380, 1, 'valedorn');
    G.banner(ctx, 830, 380, 1, 'valedorn', t);
    G.banner(ctx, 860, 380, 1, 'hrothmark', t + 1);
    G.banner(ctx, 890, 380, 1, 'reavers', t + 2);
    G.wagon(ctx, 120, 470, 1, 1, t);
    G.cityWall(ctx, 200, 470, 380);
    G.tower(ctx, 420, 470, 1, 44, 14, 'slate', 'flat');
    for (const [i, s] of [[0, 'kite'], [1, 'round'], [2, 'heater']].entries()) G.shieldShape(ctx, 520 + i * 40, 450, 12, s[1], G.REALMS[['valedorn', 'hrothmark', 'valedorn'][i]]);
    if (G.mapGlyphs) {
      label(ctx, 'Map pieces (×1.6)', 780, 410, api);
      ctx.save();
      ctx.translate(660, 480);
      ctx.scale(1.6, 1.6);
      G.mapGlyphs.city(ctx, 0, 0, 1, t);
      G.mapGlyphs.castle(ctx, 70, 0, 1, t);
      G.mapGlyphs.village(ctx, 130, 0, 1, 3, 'valedorn');
      ctx.restore();
    }
  }

  function label(ctx, text, x, y, api, align = 'center') {
    ctx.font = `600 ${Math.round(12 * api.textScale())}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(30,40,26,0.75)';
    ctx.fillText(text, align === 'left' ? x - 60 : x, y);
    ctx.textAlign = 'left';
  }

  G.scenes.gallery = scene;
})(typeof window !== 'undefined' ? window : globalThis);
