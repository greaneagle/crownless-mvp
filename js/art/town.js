/* Crownless art: the walkable towns (P10-G3, D-P10k). What js/render.js calls to draw a town's streets
 * in the art kit: the ground (streets, squares, flagstones, water), every building, stall, well and
 * tree, the townsfolk and the hero, life (smoke, banners, gulls or hens, a child at the well), the
 * light of the campaign's own hour, and the few words on screen.
 *
 * The layouts are the towns' own (data/town_hubs.js, P10-03): every footprint and collision is as it
 * was. A building is drawn inside its footprint from a spec: its `spec` in the data when it has one
 * (a landmark), else one made from its kind (tavern, barracks, house), its town's colours (`colors`)
 * and its realm's culture (CULTURES in js/art/kit.js). A person is drawn from their role (and gender),
 * a companion from their look.
 *
 * P11-12b (D-P11m): a town marked `art: 'storybook'` in its hub (Stonebridge, the vertical slice) is drawn
 * with the storybook kit (js/art/story.js): the approved concept's palette, buildings, cobbles, trees and
 * props, in the same footprints. P11-12c brings the other towns over. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, ellipse, fill } = G;

  /** P11-12b: people in a storybook town are drawn at the concept's size (about 48 px); drawing only. */
  const STORY_FIG = 1.25;
  const TALK_VERB = { trade: 'trade', recruit: 'recruit', tavern: 'drink', talk: 'talk', leave: 'leave' };
  /** A townsperson's role (town hubs and the story) to the kit's role looks. */
  const ROLE_LOOK = { innkeeper: 'innkeeper', merchant: 'merchant', recruiter: 'recruiter', elder: 'elder', official: 'noble', guard: 'guard', caravan: 'merchant', agent: 'recruiter' };

  /** P11-12b: is this town drawn in the storybook look (the slice)? */
  const story = (hub) => hub.art !== 'classic' && Boolean(G.story); // P11-12c: every town

  const culture = (hub) => {
    const s = CL.content.table('settlements')[hub.settlement];
    const f = s && (CL.realm?.faction?.(s.ownerFaction) || CL.content.table('factions')[s.ownerFaction]);
    return { realm: s?.ownerFaction || 'valedorn', culture: G.CULTURES[f?.culture] ? f.culture : 'border' };
  };

  // ---- Buildings ----

  /**
   * A building's spec inside its footprint (o.x, o.y, o.w, o.h: the old picture's box, which is also its
   * collision): the front wall's foot on the box's bottom edge, the roof up to its top.
   */
  function specOf(o, i, C) {
    const S = G.CULTURES[C.culture];
    const kind = o.look;
    const pick = (list, k) => list[k % list.length];
    const wall = pick(S.walls, i);
    const timber = wall === 'timber' || wall === 'plaster';
    const base = {
      x: o.x + o.w / 2,
      y: o.y + o.h,
      w: o.w,
      h: o.h * 0.46,
      d: o.h * 0.5,
      wall,
      roof: pick(S.roofs, i),
      form: pick(S.forms, i + 1),
      beams: timber,
      chimney: i % 2 ? 0.55 : -0.5,
      windows: Math.max(1, Math.round(o.w / 45)),
      seed: i * 31 + o.x,
    };
    if (kind === 'tavern') Object.assign(base, { form: S.forms.includes('long') ? 'long' : 'gable', base: wall !== 'stone', beams: true, sign: { kind: 'tavern', at: 'left' }, awning: '#a54f3a', door: 'left', chimney: 0.6 });
    if (kind === 'barracks') Object.assign(base, { wall: C.culture === 'hrothmark' ? 'timber' : 'stone', roof: pick(S.roofs, 1), form: 'long', beams: C.culture === 'hrothmark', sign: { kind: 'barracks', at: 'right' }, door: 'center', chimney: null, shields: true, banner: true });
    if (o.colors) Object.assign(base, { wallColor: o.colors.wall, roofColor: o.colors.roof, doorColor: o.colors.door });
    const b = { ...base, ...(o.spec || {}) };
    if (C.story && b.banner) Object.assign(b, { banner: false, hanging: true, realm: C.realm });
    return b;
  }

  /** Small things on a building's front: shields by the barracks door, a banner on its roof. */
  function trimmings(ctx, b, realm, t) {
    if (b.shields) {
      for (const dx of [-0.32, 0.32]) G.shieldShape(ctx, b.x + dx * b.w, b.y - b.h * 0.55, 6, G.realm(realm).shield, G.realm(realm));
    }
    if (b.banner) G.banner(ctx, b.x + b.w * 0.42, b.y - b.h - b.d * 0.35, 0.9, realm, t, 30);
  }

  /** Where a building's chimney smokes from (or null). */
  function chimneyTop(b, storybook = false) {
    if (b.chimney == null || b.form === 'end') return null;
    if (storybook) return { x: b.x + b.chimney * b.w * 0.3, y: b.y - b.h - b.d * 0.85 - 11 };
    return { x: b.x + b.chimney * b.w * 0.3, y: b.y - b.h - b.d + b.d * 0.2 - 8 };
  }

  // ---- The ground ----

  /** P11-12b: the storybook ground: the meadow, soft patches, sandy roads with an edge, single cobbles. */
  function storyGround(ctx, hub) {
    const S = G.story;
    const P = S.SPAL;
    const gr = hub.ground || {};
    // The meadow, leaning toward the town's own ground (Hrothgard's snow, Calder's salt): its identity kept.
    const mix = (x, y, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(x.slice(i, i + 2), 16) * (1 - k) + parseInt(y.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
    ctx.fillStyle = gr.base ? mix(P.meadow, G.tone(gr.base, 0.28), 0.5) : P.meadow;
    ctx.fillRect(0, 0, 960, 540);
    ctx.globalAlpha = 0.35;
    for (const p of gr.patches || []) {
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, P.meadowLight);
    }
    ctx.globalAlpha = 1;
    for (const w of gr.waters || []) G.battle.water(ctx, w, { x: 0, y: 0, w: 960, h: 540 }, 0);
    if (gr.stone) S.paving(ctx, gr.stone, gr.stone.color || P.cobble);
    for (const [pad, colour] of [[3, P.roadEdge], [0, gr.road ? G.tone(gr.road, 0.3) : P.road]]) {
      for (const r of gr.roads || []) {
        G.rrect(ctx, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 12);
        fill(ctx, colour);
      }
    }
    if (gr.plaza) S.plaza(ctx, gr.plaza, gr.plaza.color ? G.tone(gr.plaza.color, 0.3) : P.cobble);
    for (const [kind, x, y, w, h] of hub.decor || []) {
      const cx = x + w / 2;
      const cy = y + h * 0.8;
      if (kind === 'fence') G.fence(ctx, x + 4, cy, x + w - 4, cy, 1);
      else if (kind === 'planks') planks(ctx, x, y, w, h);
      else if (kind === 'turf') turf(ctx, x, y, w, h);
      else if (kind === 'ferns') for (let i = 0; i < 3; i++) S.tuft(ctx, cx + (i - 1) * 7, cy + (i % 2) * 3, 1.4, P.crownDark);
      else for (let i = 0; i < 4; i++) S.tuft(ctx, cx + (i - 1.5) * 8, cy + (i % 2) * 4, 1.2, P.meadowDark, ['#f2e2a0', '#e9a6a0', '#ffffff', '#c9c2e8'][(i + x) % 4]);
    }
    // Grass tufts scattered off the streets and clear of the buildings (seeded: never flicker).
    const r = G.rng(hub.id.length * 977 + 13);
    const inBox = (x, y) => hub.obstacles.some((o) => (o.shape === 'rect' ? x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 8 : Math.hypot(x - o.x, y - o.y) < (o.r || 0) + 6));
    for (let i = 0; i < 110; i++) {
      const x = 14 + r() * 932;
      const y = 14 + r() * 512;
      if (onStreet(gr, x, y) || inBox(x, y)) continue;
      S.tuft(ctx, x, y, 0.65 + r() * 0.45, P.meadowDark, i % 11 === 0 ? ['#efe5b7', '#f3d0c8', '#ffffff'][i % 3] : null);
    }
  }

  function ground(ctx, hub) {
    if (story(hub)) return storyGround(ctx, hub);
    const gr = hub.ground || {};
    ctx.fillStyle = G.tone(gr.base || PAL.grass, 0.28);
    ctx.fillRect(0, 0, 960, 540);
    ctx.globalAlpha = 0.3;
    for (const p of gr.patches || []) {
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, PAL.grassLight);
    }
    ctx.globalAlpha = 1;
    for (const w of gr.waters || []) G.battle.water(ctx, w, { x: 0, y: 0, w: 960, h: 540 }, 0);
    if (gr.stone) {
      const st = gr.stone;
      G.rrect(ctx, st.x, st.y, st.w, st.h, 6);
      fill(ctx, PAL.cobble);
      ctx.strokeStyle = PAL.cobbleLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = st.y + 20; y < st.y + st.h; y += 20) {
        ctx.moveTo(st.x + 4, y);
        ctx.lineTo(st.x + st.w - 4, y);
        for (let x = st.x + ((y / 20) % 2) * 16; x < st.x + st.w; x += 32) {
          ctx.moveTo(x, y - 20);
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    const road = gr.road ? G.tone(gr.road, 0.3) : PAL.road;
    for (const [pad, colour] of [[4, G.tone(road, -0.12)], [0, road]]) {
      for (const r of gr.roads || []) {
        G.rrect(ctx, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 10);
        fill(ctx, colour);
      }
    }
    if (gr.plaza) {
      const p = gr.plaza;
      ellipse(ctx, p.x, p.y, p.rx + 6, p.ry + 5);
      fill(ctx, PAL.cobbleLine);
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, gr.plaza.color ? G.tone(gr.plaza.color, 0.3) : PAL.cobble);
      ctx.strokeStyle = PAL.cobbleLine;
      ctx.lineWidth = 1.2;
      for (const k of [0.45, 0.75]) {
        ellipse(ctx, p.x, p.y + 4, p.rx * k, p.ry * k);
        ctx.stroke();
      }
    }
    for (const [kind, x, y, w, h] of hub.decor || []) {
      const cx = x + w / 2;
      const cy = y + h * 0.8;
      if (kind === 'fence') G.fence(ctx, x + 4, cy, x + w - 4, cy, 1);
      else if (kind === 'planks') planks(ctx, x, y, w, h);
      else if (kind === 'turf') turf(ctx, x, y, w, h);
      else if (kind === 'ferns') for (let i = 0; i < 3; i++) G.tuft(ctx, cx + (i - 1) * 7, cy + (i % 2) * 3, 1.4, PAL.forestDark);
      else for (let i = 0; i < 4; i++) G.tuft(ctx, cx + (i - 1.5) * 8, cy + (i % 2) * 4, 1.2, PAL.grassDark, ['#f2e2a0', '#e9a6a0', '#ffffff', '#c9c2e8'][(i + x) % 4]);
    }
    for (let i = 0; i < 40; i++) {
      const x = (i * 167 + 53) % 960;
      const y = 70 + ((i * 113 + 39) % 420);
      if (!onStreet(gr, x, y)) G.tuft(ctx, x, y, 1, PAL.grassDark);
    }
  }
  /** A boardwalk or pier of planks over the water (a town's own decor), with its posts. */
  function planks(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(40,60,70,0.25)';
    ctx.fillRect(x + 4, y + 6, w, h);
    G.rrect(ctx, x, y, w, h, 3);
    G.fillLine(ctx, PAL.wood);
    ctx.strokeStyle = PAL.woodShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let yy = y + 7; yy < y + h - 2; yy += 7) {
      ctx.moveTo(x + 2, yy);
      ctx.lineTo(x + w - 2, yy);
    }
    ctx.stroke();
    for (const px of [x + 3, x + w - 7]) for (const py of [y + 2, y + h - 6]) {
      G.rrect(ctx, px, py, 4, 5, 1);
      G.fillLine(ctx, PAL.woodShade, 0.8);
    }
  }
  /** A grassy earth bank (a cliff's or a terrace's edge): green on top, earth on its face. */
  function turf(ctx, x, y, w, h) {
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(x, y + h * 0.45, w + 1, h * 0.55);
    ctx.fillStyle = PAL.grassDark;
    ctx.fillRect(x, y, w + 1, h * 0.5);
    ctx.fillStyle = G.tone('#8a6a48', -0.18);
    ctx.fillRect(x, y + h - 4, w + 1, 4);
  }

  function onStreet(gr, x, y) {
    const inR = (r) => x > r.x - 8 && x < r.x + r.w + 8 && y > r.y - 8 && y < r.y + r.h + 8;
    if ((gr.roads || []).some(inR) || (gr.waters || []).some(inR) || (gr.stone && inR(gr.stone))) return true;
    const p = gr.plaza;
    return Boolean(p && ((x - p.x) / (p.rx + 10)) ** 2 + ((y - p.y) / (p.ry + 10)) ** 2 < 1);
  }

  // ---- People ----

  const looks = new WeakMap();
  /** A townsperson's look: a companion's own, else their role's (seeded by their id), in the town's colours. */
  function personLook(n, realm) {
    let L = looks.get(n);
    if (L) return L;
    // P11-12b: the portrait's own seed and face (js/art/ui.js speakerLook), so the street and the dialogue agree.
    const seed = G.fig.num(n.id || n.name);
    if (n.companion && CL.content.table('companions')[n.companion]) L = G.fig.companionLook(n.companion, realm);
    else {
      // A woman when the data says so (`gender`), else a man: never left to chance.
      const base = G.fig.townLook(ROLE_LOOK[n.role] || n.role || 'townsman', seed % 997, realm);
      const female = n.gender === 'female';
      L = { ...base, female, dress: female && base.dress !== false && !base.armour, beard: female ? null : base.beard, hairStyle: female ? (base.female ? base.hairStyle : seed % 2 ? 'bun' : 'braid') : ['bun', 'braid', 'long'].includes(base.hairStyle) ? 'short' : base.hairStyle, apron: base.apron && !female && n.role === 'innkeeper' ? '#e9dcc0' : base.apron, face: G.fig.faceOf(n.id || n.name) };
    }
    looks.set(n, L);
    return L;
  }

  /** The walk of a person in the streets, from how they moved since the last frame. */
  const tracks = new WeakMap();
  function stride(p, dt) {
    let tr = tracks.get(p);
    if (!tr) {
      tr = { x: p.x, y: p.y, walk: 0, move: 0 };
      tracks.set(p, tr);
    }
    const sp = dt > 0 ? Math.hypot(p.x - tr.x, p.y - tr.y) / dt : 0;
    tr.move += (Math.min(1, sp / 50) - tr.move) * Math.min(1, dt * 12);
    tr.walk += dt * 10 * Math.min(1.4, sp / 60);
    tr.x = p.x;
    tr.y = p.y;
    return tr;
  }

  // ---- Life ----

  /** Gulls over a harbour's water, a few hens by the houses of a northern or salt town, a child at the well. */
  function life(ctx, hub, C, t, items) {
    const gr = hub.ground || {};
    const wellO = hub.obstacles.find((o) => o.look === 'well');
    if (wellO) {
      const a = t * 1.1;
      const x = wellO.x + Math.cos(a) * (wellO.r + 34);
      const y = wellO.y + Math.sin(a) * (wellO.r + 20) * 0.6 + 4;
      const face = Math.abs(Math.cos(a + Math.PI / 2)) > 0.6 ? (Math.cos(a + Math.PI / 2) < 0 ? 'left' : 'right') : Math.sin(a + Math.PI / 2) < 0 ? 'up' : 'down';
      items.push([y, () => G.fig.figure(ctx, x, y, G.fig.townLook('child', hub.id.length), { face, move: 1, walk: t * 12, t, scale: C.story ? STORY_FIG : 1 })]);
    }
    if (['hrothmark', 'ostrand', 'saltreach'].includes(C.culture)) {
      const house = hub.obstacles.find((o) => o.look === 'house');
      if (house) {
        for (let i = 0; i < 3; i++) {
          const x = house.x + 20 + i * 16 + Math.sin(t * 0.7 + i) * 6;
          const y = house.y + house.h + 14 + (i % 2) * 6;
          items.push([y, () => hen(ctx, x, y, t + i)]);
        }
      }
    }
    return (gr.waters || []).length > 0;
  }
  function hen(ctx, x, y, t) {
    const peck = Math.max(0, Math.sin(t * 3)) > 0.8 ? 2 : 0;
    G.shadow(ctx, x + 1, y, 5, 2, 0);
    ellipse(ctx, x, y - 5, 5, 4);
    G.fillLine(ctx, '#f0e8d8', 1);
    ellipse(ctx, x + 4, y - 9 + peck, 2.6, 2.6);
    G.fillLine(ctx, '#f0e8d8', 1);
    ctx.fillStyle = PAL.crimson;
    ctx.fillRect(x + 3.5, y - 12.5 + peck, 2, 1.6);
  }
  function gulls(ctx, t) {
    ctx.strokeStyle = 'rgba(250,250,245,0.9)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = ((t * (22 + i * 7) + i * 300) % 1100) - 70;
      const y = 90 + i * 34 + Math.sin(t * 1.3 + i) * 8;
      const flap = Math.sin(t * 6 + i) * 3;
      ctx.moveTo(x - 7, y - flap);
      ctx.quadraticCurveTo(x - 3, y - 4, x, y);
      ctx.quadraticCurveTo(x + 3, y - 4, x + 7, y - flap);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  function smoke(ctx, tops, t) {
    for (const [j, p] of tops.entries()) {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.25 + i / 4 + j * 0.17) % 1;
        ctx.globalAlpha = 0.32 * (1 - k);
        ellipse(ctx, p.x + Math.sin(k * 3 + i) * 5 + k * 12, p.y - k * 46, 5 + k * 8, 4 + k * 6);
        fill(ctx, '#efeae0');
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Light ----

  /** How dark it is at the campaign's hour: 0 by day, 0.5 at dusk and dawn, 1 at night. */
  function nightOf(day) {
    if (day == null || !CL.sight?.hourOf) return 0;
    const h = CL.sight.hourOf(day);
    if (h >= 20 || h < 5) return 1;
    if (h >= 18 || h < 7) return 0.5;
    return 0;
  }

  // ---- The whole street, from js/render.js ----

  /**
   * Draw the town (`t` is CL.game.town). The caller has set the 960×540 transform; labels are drawn last,
   * above the night's shade. `font(px)` is the player's text size.
   */
  function draw(ctx, t, opts) {
    const hub = t.hub;
    const C = culture(hub);
    C.story = story(hub);
    const time = performance.now() / 1000;
    const last = draw.last || time;
    const dt = Math.min(0.1, Math.max(0, time - last));
    draw.last = time;
    const night = opts.night ?? nightOf(CL.campaign?.day);
    // The ground never changes: drawn once per town and scale, then stamped (P10-G3's budget).
    if (opts.k && root.document) ctx.drawImage(G.cached(`town-ground:${hub.id}${story(hub) ? ':sb' : ''}`, opts.k, 960, 540, 0, 0, (c) => ground(c, hub)), 0, 0, 960, 540);
    else ground(ctx, hub);
    const items = [];
    const chimneys = [];
    let i = 0;
    for (const o of hub.obstacles) {
      if (!o.look) continue; // the sea and the cliffs: walls you cannot see
      if (['tavern', 'barracks', 'house'].includes(o.look)) {
        const idx = i++;
        const b = specOf(o, idx, C);
        const top = chimneyTop(b, C.story);
        if (top) chimneys.push(top);
        const paint = (c, at) => {
          if (C.story) {
            if (b.tower) G.story.tower(c, b.x + (b.tower === 'left' ? -1 : 1) * b.w * 0.4, b.y - b.h * 0.1, 1, b.h + b.d * 0.9 + 22, 14, b.roof === 'thatch' ? 'slate' : b.roof, at, null);
            G.story.building(c, b, at, night);
            trimmings(c, { ...b, banner: false }, C.realm, at);
            return;
          }
          if (b.tower) G.tower(c, b.x + (b.tower === 'left' ? -1 : 1) * b.w * 0.36, b.y - b.h * 0.2, 1, b.h + b.d + 30, 13, b.roof === 'thatch' ? 'slate' : b.roof, 'cone', at, C.realm);
          G.building(c, b, at, night);
          trimmings(c, { ...b, banner: false }, C.realm, at);
        };
        const lit = night > 0.3 ? 'n' : 'd';
        const [bx, by, bw, bh] = [o.x - 40, o.y - 110, o.w + o.h * 0.5 + 70, o.h + 140];
        items.push([o.y + o.h, () => {
          // A building is still: drawn once per town, scale and light, then stamped; its banner moves.
          if (opts.k && root.document) ctx.drawImage(G.cached(`town-bld:${hub.id}:${idx}:${lit}${C.story ? ':sb' : ''}`, opts.k, bw, bh, -bx, -by, (c) => paint(c, 0)), bx, by, bw, bh);
          else paint(ctx, time);
          if (b.banner) G.banner(ctx, b.x + b.w * 0.42, b.y - b.h - b.d * 0.35, 0.9, C.realm, time, 30);
        }]);
      } else if (o.look === 'stall') {
        const s = o.w / 52;
        const awnings = { valedorn: '#3b6ea5', aurelian: '#a54f3a', hrothmark: '#6b8a4a', vessaro: '#c08a3e', border: '#8a5a8a', ostrand: '#5a6a7a', saltreach: '#b0782a' };
        const kit = C.story ? G.story : G;
        items.push([o.y + o.h, () => kit.stall(ctx, o.x + o.w / 2, o.y + o.h, s, awnings[C.culture] || PAL.crimson)]);
      } else if (o.look === 'well') items.push([o.y + o.r * 0.5, () => (C.story ? G.story : G).well(ctx, o.x, o.y + o.r * 0.6, o.r / 15)]);
      else if (C.story && (o.look === 'tree' || o.look === 'bush')) {
        const seed = Math.round(o.x * 7 + o.y * 13);
        if (o.look === 'tree') items.push([o.y + o.r * 0.5, () => G.story.tree(ctx, o.x, o.y + o.r * 0.5, (o.r / 20) * 1.25, seed, 'broad', Math.sin(time * 0.7 + o.x) * 0.02)]);
        else items.push([o.y + o.r * 0.5, () => G.story.bush(ctx, o.x, o.y + o.r * 0.5, (o.r / 14) * 1.15, seed)]);
      } else items.push([G.battle.baseOf(o), () => G.battle.obstacle(ctx, o, time, CL.game)]);
    }
    const hasWater = life(ctx, hub, C, time, items);
    for (const n of t.npcs) {
      const tr = stride(n, dt);
      items.push([n.y, () => G.fig.figure(ctx, n.x, n.y + 4, personLook(n, C.realm), { face: n.face || 'down', walk: n.pace ? n.anim || tr.walk : tr.walk, move: tr.move, t: time + (n.x % 7), scale: C.story ? STORY_FIG : 1 })]);
    }
    const h = t.hero;
    const htr = stride(h, dt);
    // P11-04: the hero in their own gear (the loadout they'd fight in), the look kept while it is the same.
    const heroInTown = () => {
      const c = CL.campaign;
      const which = c ? CL.gear.bestLoadout(c) : 'primary';
      const L = c ? G.fig.heroFrom(c.character, c.equipment, { which, campaign: c }) : G.fig.heroLook();
      if (t.heroLook?.sig === L.sig && t.heroLook.cloak === L.cloak) return t.heroLook;
      t.heroLook = L;
      return L;
    };
    items.push([h.y, () => {
      ctx.strokeStyle = 'rgba(216,178,90,0.85)';
      ctx.lineWidth = 1.6;
      ellipse(ctx, h.x, h.y + 5, C.story ? 14 : 11, C.story ? 5.2 : 4.2);
      ctx.stroke();
      G.fig.figure(ctx, h.x, h.y + 5, heroInTown(), { face: h.face || 'down', walk: htr.walk, move: htr.move, t: time, scale: C.story ? STORY_FIG * 1.04 : 1.05 });
    }]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, paint] of items) paint();
    smoke(ctx, chimneys, time);
    if (hasWater) gulls(ctx, time);
    if (night > 0) shade(ctx, hub, night, chimneys);
    labels(ctx, t, hub, opts);
  }

  /** Dusk and night: a cool shade over the street, then warm light at the doors and the well. */
  function shade(ctx, hub, night) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = night >= 1 ? '#5a6890' : '#c9a98e';
    ctx.fillRect(0, 0, 960, 540);
    ctx.globalCompositeOperation = 'lighter';
    for (const o of hub.obstacles) {
      if (['tavern', 'barracks', 'house'].includes(o.look)) G.glow(ctx, o.x + o.w / 2, o.y + o.h - 8, 36, 0.28 * night);
      if (o.look === 'well') G.glow(ctx, o.x, o.y, 30, 0.12 * night);
    }
    ctx.restore();
  }

  /** The few words: a building's name and the people's titles when near; who is in reach, and how to talk. */
  function labels(ctx, t, hub, opts) {
    const font = opts.font || ((px) => `bold ${px}px Georgia`);
    const pill = (text, x, y, colour, strong) => {
      ctx.font = font(strong ? 14 : 12);
      const w = ctx.measureText(text).width + 14;
      const hh = strong ? 22 : 18;
      const px = Math.max(w / 2 + 8, Math.min(952 - w / 2, x));
      ctx.fillStyle = strong ? 'rgba(12,26,38,0.92)' : 'rgba(19,35,51,0.78)';
      G.rrect(ctx, px - w / 2, y - hh / 2, w, hh, hh / 2);
      ctx.fill();
      if (strong) {
        ctx.strokeStyle = '#ffe7a8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = colour;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px, y + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };
    const h = t.hero;
    for (const o of hub.obstacles) {
      if (!o.label || t.near) continue;
      const cx = o.x + (o.w || 0) / 2;
      const cy = o.y + (o.h || 0);
      if (Math.hypot(h.x - cx, h.y - cy) > 190) continue;
      // P11-12b: in the storybook look a building's name sits on its front (the concept's), clear of the people.
      pill(o.label, cx, story(hub) && o.shape === 'rect' ? o.y + o.h * (o.look === 'stall' ? 0.15 : 0.5) : cy + 12, '#f3e3b5', false);
    }
    for (const n of t.npcs) {
      if (t.near === n) continue;
      if (Math.hypot(h.x - n.x, h.y - n.y) > 230) continue;
      pill(n.tag || n.name, n.x, story(hub) ? n.y - 52 : n.y + 22, '#e8f0ff', false);
    }
    if (t.near) {
      const n = t.near;
      pill(`${n.name} — TALK: ${(opts.verbs || TALK_VERB)[n.action]}`, n.x, n.y - 58, '#ffe7a8', true);
    }
    // "To the road" by the exit, pointing out of the town on whichever side the gate is.
    const z = hub.exitZone;
    const [cx, cy] = [z.x + z.w / 2, z.y + z.h / 2];
    const side = Math.min(cx, 960 - cx) < Math.min(cy, 540 - cy) ? (cx < 480 ? 'left' : 'right') : cy < 270 ? 'up' : 'down';
    const [text, lx, ly] = {
      left: ['◀ To the road', z.x + 60, z.y + z.h + 16],
      right: ['To the road ▶', z.x - 46, z.y + z.h + 16],
      up: ['▲ To the road', cx, z.y + z.h + 18],
      down: ['▼ To the road', cx, z.y - 10],
    }[side];
    pill(text, lx, ly, '#ffe7a8', false);
  }

  G.town = { TALK_VERB, ROLE_LOOK, draw, specOf, personLook, nightOf, culture };
})(typeof window !== 'undefined' ? window : globalThis);
