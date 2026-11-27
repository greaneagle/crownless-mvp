/* Crownless Art gallery (Debug → Art gallery; P10-G1). Every part of the art kit (js/art/) on screen:
 * each realm's troops from their data looks, at the size a battle uses (1×) and enlarged, the hero,
 * the companions and townsfolk, buildings by culture, nature and props. It turns and cycles poses,
 * so the owner can judge a piece and an agent can see what exists before adding more. It runs in its
 * own viewer (js/gfx/viewer.js): it shows nothing of the campaign and saves nothing. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  G.scenes = G.scenes || {};

  const FOLK = ['merchant', 'smith', 'innkeeper', 'guard', 'recruiter', 'elder', 'farmer', 'townswoman', 'townsman', 'child', 'monk', 'noble'];
  const FACES = ['down', 'right', 'up', 'left'];
  const POSES = ['idle', 'walk', 'attack', 'guard', 'hit'];

  /** The pages: one per realm that has troops (data order), then people, buildings, nature and props. */
  function pages() {
    const troops = Object.values(CL.content.table('troops')).filter((t) => t.role !== 'hero');
    const realms = [...new Set(troops.map((t) => t.faction))];
    const regional = Object.values(CL.content.table('items')).filter((it) => it.region && !it.forgedFrom);
    return [{ kind: 'storybook' }, { kind: 'mounted' }, ...realms.map((f) => ({ kind: 'troops', realm: f, troops: troops.filter((t) => t.faction === f) })), { kind: 'people' }, { kind: 'arms' }, ...(regional.length ? [{ kind: 'regional', items: regional }] : []), { kind: 'buildings' }, { kind: 'props' }];
  }

  const scene = {
    init(S) {
      S.gallery = { face: 0, pose: 0, auto: true, t: 0, page: 0 };
    },
    enter(_S, api) {
      api.prompt(''); // the bottom line says how to use it
    },
    leave(_S, api) {
      api?.prompt?.('');
    },
    update(S, dt) {
      const q = S.gallery;
      q.t += dt;
      if (q.auto && Math.floor(q.t / 2.4) !== Math.floor((q.t - dt) / 2.4)) q.pose = (q.pose + 1) % POSES.length;
    },
    key(S, code, _down, _api, e) {
      const q = S.gallery;
      const n = pages().length;
      if (code === 'ArrowRight' || code === 'KeyD') q.face = (q.face + 1) % 4;
      if (code === 'ArrowLeft' || code === 'KeyA') q.face = (q.face + 3) % 4;
      if (code === 'Space') {
        q.auto = false;
        q.pose = (q.pose + 1) % POSES.length;
      }
      if (code === 'Tab') q.page = (q.page + (e?.shiftKey ? n - 1 : 1)) % n;
    },
    pointer(S, kind, p) {
      if (kind !== 'up') return;
      const q = S.gallery;
      if (p.y > 470) q.page = (q.page + 1) % pages().length;
      else q.face = (q.face + 1) % 4;
    },
    draw(ctx, S, api) {
      const q = S.gallery;
      ctx.fillStyle = G.PAL.grass;
      ctx.fillRect(0, 0, api.W, api.H);
      const all = pages();
      q.page = Math.min(q.page, all.length - 1);
      const pg = all[q.page];
      const face = FACES[q.face];
      const pose = POSES[q.pose];
      if (pg.kind === 'storybook') storybookPage(ctx, q, face, pose, api);
      else if (pg.kind === 'mounted') mountedPage(ctx, q, face, pose, api);
      else if (pg.kind === 'troops') troopsPage(ctx, q, pg, face, pose, api);
      else if (pg.kind === 'people') peoplePage(ctx, q, face, pose, api);
      else if (pg.kind === 'arms') armsPage(ctx, q, face, pose, api);
      else if (pg.kind === 'regional') regionalPage(ctx, q, pg.items, face, pose, api);
      else if (pg.kind === 'buildings') buildingsPage(ctx, q, api);
      else propsPage(ctx, q, api);
      label(ctx, `Page ${q.page + 1} of ${all.length}: ${title(pg)} · pose ${pose}, facing ${face}`, 480, 506, api);
      label(ctx, 'Tap here or Tab: next page (Shift+Tab back) · tap above or ← →: turn · Space: next pose', 480, 524, api);
    },
    pages,
  };

  function title(pg) {
    if (pg.kind === 'troops') return `${CL.content.table('factions')[pg.realm]?.name || pg.realm}'s troops`;
    return { storybook: 'the Stonebridge slice (P11-12b): its people, faces and parts', mounted: 'riders and horses, every weapon', people: 'the hero, companions and townsfolk', arms: 'arms and armour', regional: 'regional arms', buildings: 'buildings by culture', props: 'nature and props' }[pg.kind];
  }

  /** A pose for the gallery: the same parts a battle drives from its state, cycled by time. */
  function poseFor(pose, face, t, L) {
    const P = { face, t, aim: face };
    if (pose === 'walk') Object.assign(P, { move: 1, walk: t * 9 });
    if (pose === 'attack') {
      const c = (t * 1.2) % 1;
      if (G.fig.SHOOTS.includes(L.weapon)) Object.assign(P, { draw: Math.min(1, c * 1.3), shot: c > 0.8 ? (1 - c) * 5 : 0 });
      else {
        const k = c * 1.4;
        const SW = CL.units?.SWING || { windup: 0.16, active: 0.12, recovery: 0.24, total: 0.52 };
        const [w, a] = [SW.windup / SW.total, SW.active / SW.total];
        if (k < w) P.atk = { phase: 'windup', k: k / w };
        else if (k < w + a) P.atk = { phase: 'active', k: (k - w) / a };
        else if (k < 1) P.atk = { phase: 'recovery', k: (k - w - a) / (1 - w - a) };
      }
    }
    if (pose === 'guard') P.guard = true;
    if (pose === 'hit') P.hit = Math.max(0, 1 - ((t * 2) % 1) * 3);
    return P;
  }

  /** One soldier (and their horse) at x, y, scale k. */
  function soldier(ctx, troop, side, seed, x, y, k, face, pose, t) {
    const L = G.fig.troopLook(troop.id, side, seed);
    const P = poseFor(pose === 'guard' && !L.shield ? 'idle' : pose, face, t, L);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (L.mount) {
      const sideFace = face === 'left' ? 'left' : 'right';
      G.fig.horse(ctx, 0, 0, { ...L.mount, cloth: side }, P, () => G.fig.figure(ctx, 0, 0, L, { ...P, face: sideFace, mounted: true }));
    } else G.fig.figure(ctx, 0, 0, L, P);
    ctx.restore();
  }

  function troopsPage(ctx, q, pg, face, pose, api) {
    const side = pg.realm === 'neutral' ? 'reavers' : pg.realm;
    const list = pg.troops;
    label(ctx, `${title(pg)} at battle size (1×), in their realm's colours`, 480, 70, api);
    const step = Math.min(78, 880 / list.length);
    list.forEach((tr, i) => {
      const x = 480 + (i - (list.length - 1) / 2) * step;
      soldier(ctx, tr, side, i + 1, x, 160, 1.12, face, pose, q.t + i * 0.13);
      small(ctx, tr.name, x, 182, api);
    });
    label(ctx, 'Enlarged 2.2× (the same parts)', 480, 222, api);
    const big = list.slice(0, 6);
    const bstep = Math.min(150, 900 / big.length);
    big.forEach((tr, i) => {
      const x = 480 + (i - (big.length - 1) / 2) * bstep;
      soldier(ctx, tr, side, i + 1, x, 340, 2.2, face, pose, q.t + i * 0.1);
      small(ctx, `${tr.name} · ${tr.role}${tr.shield ? ', shield' : ''}${tr.gender === 'female' ? ', woman' : ''}`, x, 362, api);
    });
    if (list.length > 6) {
      const rest = list.slice(6);
      const rstep = Math.min(150, 900 / rest.length);
      rest.forEach((tr, i) => {
        const x = 480 + (i - (rest.length - 1) / 2) * rstep;
        soldier(ctx, tr, side, i + 7, x, 478, 2.2, face, pose, q.t + i * 0.1);
        small(ctx, tr.name, x, 496, api);
      });
    }
  }

  /** P11-04: kits to dress the hero in (the gallery's own: no campaign, no requirements). */
  const KITS = [
    { weapon: 'arming_sword', offhand: 'kite_shield', head: 'iron_helm', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves' },
    { weapon: 'hand_axe', offhand: 'oak_shield', head: 'leather_cap', body: 'gambeson', feet: 'boots' },
    { weapon: 'war_mace', offhand: 'heater_shield', head: 'bascinet', body: 'leather_chest', hands: 'gloves', feet: 'boots' },
    { weapon: 'worn_sword', body: 'clothing' },
  ];

  /**
   * P11-04: "Arms and armour": every weapon part and helmet the kit draws, a two-handed weapon with the
   * shield slung, the bows and crossbows, and the hero in each kit (docs/ART-STYLE.md "Items").
   */
  function armsPage(ctx, q, face, pose, api) {
    const t = q.t;
    const who = { cloak: 'crimson', gender: 'man' };
    const parts = ['sword', 'axe', 'mace', 'club', 'hammer', 'greatsword', 'greataxe', 'spear', 'pike', 'lance', 'bow', 'recurve', 'crossbow', 'arbalest'];
    label(ctx, 'Weapon parts (a two-handed one slings the shield; bows and crossbows carry a quiver)', 480, 70, api);
    parts.forEach((w, i) => {
      const L = { ...G.fig.heroFrom(who, KITS[1], { campaign: null }), weapon: w, twoHanded: ['greatsword', 'greataxe', 'pike'].includes(w), quiver: G.fig.SHOOTS.includes(w) };
      if (L.twoHanded || G.fig.SHOOTS.includes(w)) [L.shield, L.shieldBack] = [null, 'round'];
      const x = 45 + i * 63;
      ctx.save();
      ctx.translate(x, 160);
      ctx.scale(1.12, 1.12);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.2, L));
      ctx.restore();
      small(ctx, w, x, 182, api);
    });
    const helms = ['cap', 'nasal', 'plumed', 'kettle', 'bascinet', 'great', 'sallet', 'spangen', 'hood', null];
    label(ctx, 'Helmets (the hero bare-headed last); the hero in four kits', 480, 222, api);
    helms.forEach((h, i) => {
      const L = { ...G.fig.heroFrom(who, KITS[0], { campaign: null }), helmet: h };
      const x = 60 + i * 52;
      ctx.save();
      ctx.translate(x, 300);
      ctx.scale(1.5, 1.5);
      G.fig.figure(ctx, 0, 0, L, poseFor('idle', face, t, L));
      ctx.restore();
      small(ctx, h || 'bare', x, 322, api);
    });
    KITS.forEach((k, i) => {
      const L = G.fig.heroFrom({ cloak: 'forest', gender: i % 2 ? 'woman' : 'man' }, k, { campaign: null });
      const x = 600 + i * 90;
      ctx.save();
      ctx.translate(x, 300);
      ctx.scale(1.5, 1.5);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.3, L));
      ctx.restore();
      small(ctx, CL.content.item(k.weapon).name, x, 322, api);
    });
    label(ctx, 'Enlarged 2.2×: greatsword (shield slung), arbalest, recurve bow, mace and heater', 480, 360, api);
    const big = [
      { ...G.fig.heroFrom(who, KITS[0], { campaign: null }), weapon: 'greatsword', twoHanded: true, shield: null, shieldBack: 'kite' },
      { ...G.fig.heroFrom(who, KITS[1], { campaign: null }), weapon: 'arbalest', shield: null, shieldBack: 'round', quiver: true },
      { ...G.fig.heroFrom(who, KITS[3], { campaign: null }), weapon: 'recurve', quiver: true },
      G.fig.heroFrom({ cloak: 'violet', gender: 'woman' }, KITS[2], { campaign: null }),
    ];
    big.forEach((L, i) => {
      ctx.save();
      ctx.translate(180 + i * 200, 490);
      ctx.scale(2.2, 2.2);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.4, L));
      ctx.restore();
    });
  }

  function peoplePage(ctx, q, face, pose, api) {
    const t = q.t;
    label(ctx, 'The hero: each cloak colour, a man and a woman, with and without a shield', 480, 70, api);
    const cloaks = Object.keys(G.fig.CLOAKS);
    cloaks.forEach((c, i) => {
      for (const [j, gender] of [[0, 'man'], [1, 'woman']].entries()) {
        const L = G.fig.heroFrom({ cloak: c, gender: gender[1] }, i === 3 && j === 1 ? { ...KITS[0], offhand: null } : KITS[(i * 2 + j) % KITS.length], { campaign: null });
        const x = 120 + (i * 2 + j) * 52;
        ctx.save();
        ctx.translate(x, 158);
        ctx.scale(1.12, 1.12);
        G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i, L));
        ctx.restore();
      }
    });
    label(ctx, 'Companions', 740, 70, api);
    Object.keys(CL.content.table('companions')).forEach((id, i) => {
      const L = G.fig.companionLook(id, 'valedorn');
      ctx.save();
      ctx.translate(620 + i * 80, 158);
      ctx.scale(1.12, 1.12);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.3, L));
      ctx.restore();
      small(ctx, CL.content.table('companions')[id].name, 620 + i * 80, 182, api);
    });
    label(ctx, 'Townsfolk by role (seeded faces and clothes)', 480, 222, api);
    FOLK.forEach((role, i) => {
      const L = G.fig.townLook(role, i + 3);
      const x = 70 + i * 74;
      G.fig.figure(ctx, x, 290, L, { face, t: t + i * 0.2, move: pose === 'walk' ? 1 : 0, walk: t * 8, work: role === 'smith' && pose !== 'walk', talk: pose === 'idle' ? (Math.sin(t * 9) + 1) / 2 : 0 });
      small(ctx, role, x, 310, api);
    });
    label(ctx, 'Enlarged 2.4×', 480, 350, api);
    const big = [G.fig.heroFrom({ cloak: 'crimson', gender: 'man' }, KITS[0], { campaign: null }), G.fig.companionLook('mara', 'valedorn'), G.fig.companionLook('iacopo', 'valedorn'), G.fig.townLook('smith', 4), G.fig.townLook('innkeeper', 5), G.fig.townLook('noble', 14)];
    big.forEach((L, i) => {
      ctx.save();
      ctx.translate(110 + i * 148, 490);
      ctx.scale(2.4, 2.4);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.1, L));
      ctx.restore();
    });
  }

  /**
   * P11-12b (D-P11m): the vertical slice's people enlarged (the hero and Stonebridge's five), their portraits
   * from the same features, the same people at 1× (as the town draws them), and the storybook kit's parts.
   */
  function storybookPage(ctx, q, face, pose, api) {
    const t = q.t;
    const hub = CL.content.table('town_hubs')?.stonebridge;
    const who = { cloak: 'crimson', gender: 'man', name: 'Aldo' };
    const hero = G.fig.heroFrom(who, { weapon: 'worn_sword', offhand: 'oak_shield', body: 'clothing' }, { campaign: null });
    hero.cloak = '#355783';
    const folk = (hub?.npcs || []).map((n) => G.town.personLook(n, 'valedorn'));
    const child = G.fig.townLook('child', 6);
    const all = [hero, ...folk, child];
    label(ctx, 'Stonebridge’s people, enlarged ×2.2: four facings (← →), every pose (Space)', 480, 28, api);
    all.forEach((L, i) => {
      const x = 70 + i * 117;
      ctx.save();
      ctx.translate(x, 205);
      ctx.scale(2.2, 2.2);
      G.fig.figure(ctx, 0, 0, L, poseFor(pose, face, t + i * 0.2, L));
      ctx.restore();
      if (G.ui?.portrait) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, 262, 26, 0, Math.PI * 2);
        ctx.clip();
        G.ui.portrait(ctx, x - 26, 236, 52, L);
        ctx.restore();
      }
      G.fig.figure(ctx, x, 330, L, poseFor(pose, face, t + i * 0.2, L));
    });
    small(ctx, 'their portraits (the same features) · and at 1×, as the streets draw them', 480, 350, api);
    const S = G.story;
    if (!S) return;
    S.building(ctx, { x: 120, y: 470, s: 0.5, w: 220, h: 55, d: 60, wall: 'plaster', base: true, beams: true, roof: 'terracotta', form: 'gable', sign: { kind: 'tavern', at: 'right' }, awning: '#a64d3f', door: 'left', chimney: 0.6, windows: 3, seed: 2 }, t, 0);
    S.building(ctx, { x: 300, y: 470, s: 0.5, w: 200, h: 55, d: 60, wall: 'stone', roof: 'slate', form: 'long', door: 'center', windows: 4, hanging: true, realm: 'valedorn', seed: 4 }, t, 0);
    S.building(ctx, { x: 450, y: 470, s: 0.5, w: 150, h: 44, d: 48, wall: 'plaster', base: true, roof: 'thatch', form: 'gable', door: 'center', windows: 2, chimney: -0.4, seed: 6 }, t, 0);
    S.tower(ctx, 560, 470, 0.6, 70, 14, 'slate', t);
    S.building(ctx, { x: 545, y: 470, s: 0.5, w: 190, h: 50, d: 55, wall: 'plaster', base: true, beams: true, roof: 'slate', form: 'hip', door: 'center', windows: 3, seed: 8 }, t, 0);
    S.well(ctx, 660, 470, 1);
    S.stall(ctx, 730, 470, 1, '#3b6ea5');
    S.tree(ctx, 810, 470, 1, 3, 'broad', Math.sin(t) * 0.03);
    S.bush(ctx, 860, 470, 1, 4, '#b0453a');
    S.barrel(ctx, 895, 470, 1);
    S.crate(ctx, 925, 470, 1);
  }

  /** P11-12b: riders on horseback with every weapon, in the facing and pose chosen (the rig's mounted poses). */
  function mountedPage(ctx, q, face, pose, api) {
    const t = q.t;
    label(ctx, 'Mounted: the rider’s seat and weapon on the storybook horse, enlarged ×1.8 and at 1×', 480, 40, api);
    const who = { cloak: 'forest', gender: 'man', name: 'Aldo' };
    const kits = [
      { weapon: 'arming_sword', offhand: 'kite_shield', body: 'mail_hauberk', head: 'iron_helm', horse: 'rouncey' },
      { weapon: 'war_lance', body: 'mail_hauberk', head: 'iron_helm', horse: 'destrier' },
      { weapon: 'short_bow', body: 'clothing', horse: 'courser' },
    ];
    kits.forEach((kit, i) => {
      const L = G.fig.heroFrom(who, kit, { campaign: null });
      const H = L.mount || { coat: '#8a5a3a', mane: '#2e2119' };
      const x = 170 + i * 310;
      const side = face === 'left' || face === 'right' ? face : 'right';
      const P = { ...poseFor(pose, face, t + i * 0.4, L), hface: side };
      ctx.save();
      ctx.translate(x, 270);
      ctx.scale(1.8, 1.8);
      G.fig.horse(ctx, 0, 0, { ...H, cloth: 'valedorn' }, P, () => G.fig.figure(ctx, 0, 0, L, { ...P, face: side, mounted: true }));
      ctx.restore();
      G.fig.horse(ctx, x, 400, { ...H, cloth: 'valedorn' }, P, () => G.fig.figure(ctx, x, 400, L, { ...P, face: side, mounted: true }));
      small(ctx, ['sword and shield', 'lance', 'bow from the saddle'][i], x, 430, api);
    });
  }

  function regionalPage(ctx, q, items, face, pose, api) {
    const who = { cloak: 'ash', name: 'Aldo' };
    const columns = 6;
    const rows = Math.ceil(items.length / columns);
    items.forEach((it, i) => {
      const kit = { body: 'gambeson', [it.slot]: it.id };
      const L = G.fig.heroFrom(who, kit, { campaign: null });
      const x = (i % columns + 0.5) * (960 / columns);
      const y = 75 + (Math.floor(i / columns) + 0.65) * (360 / rows);
      const P = poseFor(pose, face, q.t + i * 0.2, L);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.45, 1.45);
      if (L.mount) {
        G.fig.horse(ctx, 0, 0, L.mount, P, () => G.fig.figure(ctx, 0, 0, L, { ...P, mounted: true }));
      } else {
        G.fig.figure(ctx, 0, 0, L, P);
      }
      ctx.restore();
      small(ctx, it.name, x, y + 22, api);
    });
  }

  function buildingsPage(ctx, q, api) {
    const t = q.t;
    label(ctx, 'One building function, each culture its own walls, roofs and roof forms (js/art/kit.js CULTURES)', 480, 70, api);
    const cultures = Object.keys(G.CULTURES);
    const colW = 960 / cultures.length;
    cultures.forEach((c, i) => {
      const C = G.CULTURES[c];
      const cx = colW * (i + 0.5);
      for (let j = 0; j < 3; j++) {
        const y = 170 + j * 120;
        G.building(ctx, { x: cx, y, s: 0.62, w: 100 + j * 12, h: 36, d: 44, wall: C.walls[j], base: j === 2 && C.walls[j] !== 'stone', roof: C.roofs[j], form: C.forms[j], beams: C.walls[j] !== 'stone', chimney: j === 1 ? 0.5 : null, windows: 2, door: j === 0 ? 'center' : j === 1 ? 'left' : 'right', seed: i * 7 + j }, t, 0);
      }
      small(ctx, c, cx, 470, api);
      G.banner(ctx, cx - 30, 500, 0.8, CL.content.table('factions')[c]?.id || Object.values(CL.content.table('factions')).find((f) => f.culture === c)?.id, t + i, 30);
    });
  }

  function propsPage(ctx, q, api) {
    const t = q.t;
    label(ctx, 'Nature', 480, 70, api);
    G.tree(ctx, 70, 170, 1.2, 3, 'broad', Math.sin(t) * 0.03);
    G.tree(ctx, 140, 170, 1.2, 8, 'pine');
    G.tree(ctx, 210, 170, 1.2, 5, 'birch', Math.sin(t + 1) * 0.03);
    G.bush(ctx, 270, 170, 1.3, 4, '#b0453a');
    G.bush(ctx, 320, 170, 1.3, 9);
    G.rock(ctx, 370, 170, 1.3, 5);
    G.rock(ctx, 410, 170, 1, 9);
    for (let i = 0; i < 6; i++) G.tuft(ctx, 450 + i * 14, 168, 1.2, G.PAL.grassDark, i % 2 ? '#f2e2a0' : null);
    label(ctx, 'Props', 480, 220, api);
    G.barrel(ctx, 60, 320, 1.3);
    G.crate(ctx, 110, 320, 1.3);
    G.fence(ctx, 140, 320, 230, 320, 1.2);
    G.stoneWall(ctx, 250, 320, 350, 1.2);
    G.well(ctx, 400, 320, 1.2);
    G.stall(ctx, 480, 320, 1.2, '#3b6ea5');
    G.anvil(ctx, 545, 320, 1.3);
    G.forge(ctx, 595, 320, 1.2, t);
    G.rack(ctx, 660, 320, 1.2, 'valedorn');
    G.wagon(ctx, 740, 320, 1.1, 1, t);
    G.tower(ctx, 830, 330, 1, 54, 15, 'slate', 'cone', t, 'valedorn');
    G.tower(ctx, 900, 330, 1, 44, 14, 'slate', 'flat');
    label(ctx, 'Shields, devices and banners: every culture', 480, 380, api);
    const shapes = ['kite', 'round', 'heater', 'pavise'];
    for (const [i, sh] of shapes.entries()) G.shieldShape(ctx, 70 + i * 44, 460, 13, sh, G.realm(['valedorn', 'hrothmark', 'aurelian', 'vessaro'][i]));
    Object.keys(G.CULTURES).forEach((c, i) => {
      const f = Object.values(CL.content.table('factions')).find((x) => x.culture === c);
      if (f) G.banner(ctx, 290 + i * 70, 490, 1.1, f.id, t + i, 44);
    });
    G.banner(ctx, 290 + 7 * 70, 490, 1.1, 'reavers', t + 8, 44);
    G.cityWall(ctx, 830, 500, 940, 0.9);
  }

  function label(ctx, text, x, y, api) {
    ctx.font = `600 ${Math.round(12 * api.textScale())}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(30,40,26,0.78)';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }
  function small(ctx, text, x, y, api) {
    ctx.font = `600 ${Math.round(9.5 * api.textScale())}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(30,40,26,0.7)';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  G.scenes.gallery = scene;
})(typeof window !== 'undefined' ? window : globalThis);
