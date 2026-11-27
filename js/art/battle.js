/* Crownless art: battles (P10-G2, D-P10k). What js/render.js calls to draw a battle in the art kit:
 * the ground, the obstacles, every unit, the fallen, arrows and effects, and the small painted map the
 * minimap, the tactical overview and the Prepare screen show.
 *
 * The drawing only reads the battle (js/combat.js, js/units.js). It never changes a unit:
 *   u.face            front, back or side view (horses always in profile, P.hface)
 *   u.swing           windup raises the blade, active sweeps it, recovery returns it; a spear thrusts
 *   u.guard           the shield across the body
 *   u.ranged          a bow drawn (a crossbow loaded) over the reload, released on the shot (u.shot)
 *   u.flash           a pale flash and a small recoil when struck
 *   u.ground, downAt  the fallen, faded as the game fades them (CL.render.bodyAlpha)
 *   u.routing, morale a pale pennant over the running, an amber mark on the shaken
 * Movement (the walk cycle, dust) comes from each unit's change of position between frames, kept here.
 *
 * Speed (P10-G2): a soldier standing or walking is a baked frame, drawn once per look, facing, step and
 * scale and then stamped; one striking, blocking, struck, shooting or running is drawn live. In a big
 * battle (CL.render.busyBattle) there is no dust or blade trail. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, fill } = G;

  const FIG = 1.12; // soldiers a touch larger than townsfolk, for the field at phone size
  const WALK_FRAMES = 6;
  const BAKE_MAX = 3000;
  const ACT_FRAMES = 3; // in a big battle, a swing's phase, a draw and a guard are baked too, in this many steps
  const TEAM = { ally: 'rgba(76,130,196,0.78)', enemy: 'rgba(186,72,58,0.78)', hero: 'rgba(216,178,90,0.95)' };

  // ---- Per battle ----

  let battle = null; // { g, looks, track, dust, allySide, enemySide, last }

  /** The sides' colours: yours (your realm when sworn or serving, else your own banner) and the foe's. */
  function sides(g) {
    const c = CL.campaign;
    const mine = (c && (CL.allegiance?.sworn?.(c) || CL.allegiance?.serves?.(c))) || 'player';
    let foe = g.encounterDef?.faction || null;
    const p = g.partyId != null ? c?.parties?.find?.((x) => x.id === g.partyId) : null;
    if (p) foe = CL.content.table('party_templates')[p.template]?.faction || foe;
    if (!foe) {
      const e = g.enemies?.[0];
      foe = e ? CL.content.table('troops')[e.troop]?.faction : 'neutral';
    }
    return { allySide: mine === 'player' ? 'player' : mine, enemySide: foe === 'neutral' ? 'reavers' : foe };
  }

  function state(g) {
    if (!battle || battle.g !== g || battle.id !== g.battleId || battle.map !== g.battleMap) {
      battle = { g, id: g.battleId, map: g.battleMap, looks: new WeakMap(), track: new WeakMap(), dust: [], last: performance.now(), ...sides(g) };
    }
    return battle;
  }

  /** The tournament's colours: each fighter their own, from their name. */
  const TOURNEY = ['#8a3b5a', '#2d6a6a', '#7a5a2a', '#4a4a8a', '#6a7a3a', '#8a4a2a'];

  /** P11-04: is a unit on a horse (a state, js/units.js)? */
  const mounted = (u) => CL.units.mounted(u);

  /** A companion's gear (yours, or one of the retinue's), for their look. */
  function companionGear(u) {
    const c = CL.campaign;
    if (!c) return null;
    if (c.companion?.id === u.companion) return c.companion.equipment || null;
    return CL.retinue?.find?.(c, u.companion)?.equipment || null;
  }

  /**
   * What a unit's look depends on that can change in a battle (P11-04): the hero's loadout in hand (a
   * switch rebuilds the look the next frame). Everyone else's gear is fixed for the battle (a soldier's
   * look is their troop's), so theirs is ''.
   */
  const sigOf = (B, u) => (u.role === 'hero' ? B.g.loadout?.which || 'primary' : '');

  /** A unit's look: the hero, a companion, a lord in person, a tournament fighter, or a soldier of a side. */
  function lookOf(B, u) {
    const sig = sigOf(B, u);
    let L = B.looks.get(u);
    if (L && L.sigKey === sig) return L;
    const side = u.team === 'ally' ? B.allySide : B.enemySide;
    const c = CL.campaign;
    // P11-04: the hero in the kit they fight in (a tournament's loaner kit in a bout), the weapon in hand.
    if (u.role === 'hero') L = G.fig.heroFrom(c?.character, B.g.loadout?.kit || c?.equipment || {}, { which: sig, campaign: c || null });
    else if (u.companion && CL.content.table('companions')[u.companion]) L = G.fig.companionLook(u.companion, side, companionGear(u));
    else {
      L = G.fig.troopLook(u.troop, side, ((u.soldierId ?? u.id) % 4) + 1);
      if (u.named) Object.assign(L, { helmet: L.helmet === 'great' ? 'great' : 'plumed', plume: PAL.gold, cloak: G.realm(side).color, cloakTrim: PAL.gold, lord: true });
      if (u.duelist) {
        // P11-04: a tournament fighter in the format's kit (the loaner kit), in colours of their own.
        if (B.g.duel?.kit) G.fig.dress(L, CL.gear.kitFor(null, B.g.duel.kit, 'primary'), null);
        const n = [...String(u.duelist)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const colour = TOURNEY[n % TOURNEY.length];
        Object.assign(L, { realm: { color: colour, trim: '#efe4c4', device: ['chevron', 'bar', 'lozenge', 'cross'][n % 4], shield: 'heater' }, tabard: { color: colour, trim: '#efe4c4', device: 'bar' }, plume: '#efe4c4' });
        if (!L.helmet || L.helmet === 'nasal') L.helmet = 'plumed';
      }
    }
    // P11-04: the key carries the kit's signature, so a look in other gear is baked apart.
    L.key = `${u.role === 'hero' ? 'hero' : u.companion || u.troop}|${typeof L.realm === 'object' ? L.realm.color : L.realm}|${L.seed}${L.lord ? `|lord${u.house || ''}` : ''}${L.sig ? `|${L.sig}` : ''}`;
    L.sigKey = sig;
    B.looks.set(u, L);
    B.lookCount = (B.lookCount || 0) + 1; // P11-00: looks built this battle (Debug → Battle benchmark)
    return L;
  }

  /** How each unit moved since the last frame (the walk cycle and dust only). */
  function track(B, units, reduced, busy) {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - B.last) / 1000));
    B.last = now;
    for (const u of units) {
      let tr = B.track.get(u);
      if (!tr) {
        tr = { x: u.x, y: u.y, walk: G.hash(u.id, 3) * 6, move: 0, dustAt: 0, hface: u.team === 'ally' ? 'right' : 'left' };
        B.track.set(u, tr);
      }
      const d = Math.hypot(u.x - tr.x, u.y - tr.y);
      const speed = dt > 0 ? d / dt : 0;
      tr.move += (Math.min(1, speed / 55) - tr.move) * Math.min(1, dt * 12);
      tr.walk += dt * (mounted(u) ? 11 : 10) * Math.min(1.4, speed / 70);
      tr.x = u.x;
      tr.y = u.y;
      if (u.face === 'left' || u.face === 'right') tr.hface = u.face;
      if (u.alive && speed > 80 && !reduced && !busy && now > tr.dustAt && B.dust.length < 40) {
        tr.dustAt = now + (mounted(u) ? 120 : 300);
        B.dust.push({ x: u.x + (G.hash(u.id, now) - 0.5) * 8, y: u.y + 4, t: 0 });
      }
    }
    for (const p of B.dust) p.t += dt;
    B.dust = B.dust.filter((p) => p.t < 0.7);
  }

  // ---- Poses ----

  function poseOf(u, tr, t, reduced) {
    const P = { face: u.face, walk: tr?.walk || 0, move: tr?.move || 0, t: t + (u.id % 7), reduced, scale: FIG, hface: tr?.hface || 'right', aim: u.face };
    const atk = CL.profile.attackProgress(u); // the unit's own timing (P11-01): nothing else in the art reads it
    if (atk) P.atk = atk;
    P.guard = Boolean(u.guard);
    if (u.ranged && u.role === 'hero') {
      // P11-07: the hero's own draw (held at full until loosed) and a crossbow wound back once loaded.
      const r = u.ranged;
      P.draw = r.crossbow && u.loaded ? 1 : Math.min(1, (u.drawT || 0) / (r.draw || 1));
      P.shot = Math.min(1, (u.shot || 0) / 0.2);
      if (P.shot > 0.2) P.draw = 0;
    } else if (u.ranged) {
      const cd = u.ranged.cooldown || 1.6;
      const aiming = u.target?.alive || u.role === 'hero';
      P.draw = aiming ? Math.max(0, Math.min(1, 1 - u.attackCooldown / cd)) : 0;
      P.shot = Math.min(1, (u.shot || 0) / 0.2);
      if (P.shot > 0.2) P.draw = 0;
    }
    P.hit = u.flash > 0 ? Math.min(1, u.flash / 0.14) : 0;
    // P11-05: a shield under pressure, a broken guard, a stagger.
    const g = CL.game;
    if (u.press) P.press = Math.min(1, u.press / ((CL.combat?.SHIELD?.capacity || 4) * (1 + (CL.combat?.SHIELD?.skill || 0) * (u.profile?.shieldSkill || 0))));
    if ((u.guardBrokenUntil ?? -1) > g.t) P.broken = true;
    if (u.staggeredAt != null && g.t - u.staggeredAt < 0.35) P.stagger = 1 - (g.t - u.staggeredAt) / 0.35;
    return P;
  }

  /** Can this pose be a baked frame (nothing in it but standing or walking)? */
  const still = (P) => !P.atk && !P.guard && !P.hit && !(P.draw > 0.05) && !(P.shot > 0) && !P.broken && !P.stagger;

  /** Draw a unit's body (figure, or horse and rider) at 0,0 in the current transform. */
  function body(ctx, u, L, P) {
    const horse = mounted(u) && (u.mount || L.mount);
    if (horse) {
      const sideFace = u.face === 'left' || u.face === 'right' ? u.face : P.hface;
      G.fig.horse(ctx, 0, 0, { ...horse, cloth: L.realm }, P, () => G.fig.figure(ctx, 0, 0, L, { ...P, face: sideFace, mounted: true }));
    } else G.fig.figure(ctx, 0, 0, L, P);
  }

  /** The team ring under the feet: blue for yours, red for theirs, gold for the hero. */
  function ring(ctx, u) {
    const hero = u.role === 'hero';
    const cav = mounted(u);
    ctx.lineWidth = hero ? 2.2 : 1.6;
    ctx.strokeStyle = hero ? TEAM.hero : TEAM[u.team] || TEAM.enemy;
    ellipse(ctx, 0, 0, cav ? 17 : 11, cav ? 6 : 4.2);
    ctx.stroke();
  }

  /**
   * A unit as an image, baked once per look, facing, step and scale (a standing or walking soldier). In a
   * big battle (`act`), a blow, a draw and a raised shield are baked too, a few steps to each phase; the
   * real phase still decides which step is shown, so a blow is never drawn late or early by more than a
   * step. A struck soldier's flash is laid over the image.
   */
  function baked(ctx, u, L, P, k, act = false) {
    const cav = mounted(u);
    const step = P.move > 0.35 && !P.atk ? Math.floor((((P.walk % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / WALK_FRAMES)) : -1;
    const face = cav && (u.face === 'up' || u.face === 'down') ? `${u.face}${P.hface}` : u.face;
    const kq = Math.round(k * 10) / 10;
    const q = (v) => Math.min(ACT_FRAMES - 1, Math.floor(v * ACT_FRAMES));
    const pose = act ? `${P.atk ? `${P.atk.phase}${q(P.atk.k)}` : ''}${P.guard ? 'g' : ''}${P.draw > 0.05 ? `d${q(P.draw)}` : ''}${P.shot > 0 ? 's' : ''}${P.broken ? 'b' : ''}` : '';
    const key = `u:${L.key}|${face}|${step}|${u.team}|${pose}|${kq}`;
    const Qa = act ? { atk: P.atk ? { phase: P.atk.phase, k: (q(P.atk.k) + 0.5) / ACT_FRAMES } : null, guard: P.guard, draw: P.draw > 0.05 ? (q(P.draw) + 0.5) / ACT_FRAMES : 0, shot: P.shot > 0 ? 0.6 : 0, broken: P.broken, press: 0, stagger: 0 } : {};
    const [w, h, ox, oy] = cav ? [52, 70, 26, 62] : [40, 58, 20, 50];
    const img = G.cached(key, kq, w * FIG, h * FIG, ox * FIG, oy * FIG, (c) => {
      ring(c, u);
      const Q = { ...P, ...Qa, hit: 0, reduced: true, t: 0, move: step >= 0 ? 1 : 0, walk: step >= 0 ? ((step + 0.5) * Math.PI * 2) / WALK_FRAMES : 0, scale: FIG };
      body(c, u, L, Q);
    }, BAKE_MAX);
    ctx.drawImage(img, -ox * FIG, -oy * FIG, w * FIG, h * FIG);
    if (P.hit > 0 && !P.reduced) {
      ctx.globalAlpha = 0.45 * P.hit;
      ctx.fillStyle = '#fff6e6';
      ellipse(ctx, 0, (cav ? -30 : -17) * FIG, 8 * FIG, 13 * FIG);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** Draw one living unit at its place (feet at u.y + 5, as the soldiers have always stood). */
  function unit(ctx, u, t, k, reduced) {
    const B = battle;
    const L = lookOf(B, u);
    const tr = B.track.get(u);
    const P = poseOf(u, tr, t, reduced);
    // P11-09: the glint is a setting (on); with Reduced effects it stays, as a still mark on the windup's
    // weapon (part of the pose), not one that grows to the strike.
    P.glint = CL.settings?.get?.('glint') !== false;
    P.reducedGlint = reduced;
    const busy = CL.render?.busyBattle?.();
    if (busy) P.reduced = true; // no blade trail in a big battle
    const y = u.y + 5;
    ctx.save();
    ctx.translate(u.x, y);
    if (u.role !== 'hero' && !u.routing && (still(P) || busy)) baked(ctx, u, L, P, k, busy);
    else {
      ring(ctx, u);
      body(ctx, u, L, P);
      if (L.lord) pennant(ctx, u, t);
    }
    if (P.atk?.phase === 'windup' && P.glint && glints(B, u)) glint(ctx, L, P, P.reducedGlint ? 0.6 : P.atk.k);
    ctx.restore();
    marks(ctx, u, y);
  }

  /** P11-05: does this fighter's windup get the glint: aimed at the hero, or the hero's opponent? */
  function glints(B, u) {
    const h = B.g.hero;
    if (!h?.alive || u.team === h.team) return false;
    return u.target === h || B.heroFoe === u;
  }

  /** A small four-pointed glint at the weapon's tip: a shape, not a colour (it grows to the strike). */
  function glint(ctx, L, P, k) {
    const tip = G.fig.weaponTip(L, P);
    if (!tip) return;
    const s = FIG * (L.scale || 1);
    const r = 2 + 2.5 * k;
    ctx.save();
    ctx.translate(tip.x * s, tip.y * s);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const d = i % 2 ? r * 0.3 : r;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = '#fffbe8';
    ctx.strokeStyle = 'rgba(40,30,20,0.7)';
    ctx.lineWidth = 0.8;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** A lord's pennant on a staff behind them (P8-01's lords in person). */
  function pennant(ctx, u, t) {
    // Their house's arms when they have a house (P10-G5), else their realm's colours with a gold device.
    const H = u.house && CL.gfx.ui?.houseArms(CL.campaign, u.house);
    const R = H || G.realm(lookOf(battle, u).realm);
    G.banner(ctx, -10, -2, 0.85, H ? { ...H, edge: PAL.gold } : { color: R.color, trim: PAL.gold, device: R.device }, t, mounted(u) ? 70 : 56);
  }

  /** Health, morale and a lord's name over the head. */
  function marks(ctx, u, y) {
    const hero = u.role === 'hero';
    const top = y - (mounted(u) ? 58 : 46);
    const busy = CL.render?.busyBattle?.();
    const hurt = u.hp < u.maxhp && (hero || (CL.settings?.get('healthBars') !== false && (!busy || u.hp < u.maxhp * (CL.render?.BUSY?.hurt ?? 0.5) || u.companion)));
    if (hurt) {
      ctx.fillStyle = 'rgba(39,25,26,0.75)';
      G.rrect(ctx, u.x - 11, top - 4, 22, 3.6, 1.8);
      ctx.fill();
      ctx.fillStyle = u.team === 'ally' ? '#8bc3a9' : '#d07468';
      G.rrect(ctx, u.x - 11, top - 4, (22 * Math.max(0, u.hp)) / u.maxhp, 3.6, 1.8);
      ctx.fill();
    }
    if (u.routing) {
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
    const name = u.named || u.duelist;
    if (name) {
      ctx.font = CL.settings?.font?.(10) ?? 'bold 10px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe2a8';
      ctx.fillText(name, u.x, top - (u.routing ? 24 : 12));
      ctx.textAlign = 'left';
    }
  }

  /** A fallen unit: lying still and faded (no blood), baked once per look and side it fell to. */
  function fallen(ctx, u, alpha, k) {
    const L = lookOf(battle, u);
    const dir = u.face === 'left' ? -1 : 1;
    const kq = Math.round(k * 10) / 10;
    const img = G.cached(`f:${L.key}|${dir}|${kq}`, kq, 60, 30, 30, 18, (c) => G.fig.fallen(c, 0, 0, L, 1, dir), BAKE_MAX);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, u.x - 30, u.y + 4 - 18, 60, 30);
    ctx.restore();
  }

  // ---- The ground ----

  /** An obstacle's look by name (P10-G6: there are no sprite tiles; the content checks refuse anything else). */
  const lookName = (o) => (typeof o.look === 'string' ? o.look : 'rock');

  /** The field under everyone, in view: grass, its soft patches, rises, water, a courtyard, decor. */
  function ground(ctx, m, v, t) {
    const gr = m.ground || {};
    const seen = (x, y, r) => x + r > v.x && x - r < v.x + v.w && y + r > v.y && y - r < v.y + v.h;
    ctx.fillStyle = gr.forest ? '#86a466' : PAL.grass;
    if (m.forest || gr.base === '#4f7140') ctx.fillStyle = '#8aa96a';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.globalAlpha = 0.22;
    for (const p of gr.patch ? [gr.patch, ...(gr.patches || [])] : gr.patches || []) {
      if (!seen(p.x, p.y, Math.max(p.rx, p.ry))) continue;
      ellipse(ctx, p.x, p.y, p.rx, p.ry);
      fill(ctx, isDirt(p.color) ? PAL.road : PAL.grassLight);
    }
    ctx.globalAlpha = 1;
    for (const r of gr.rises || []) {
      // A rise (the hills map's, the walls' walkway): soft rings of lighter grass, brightest on top.
      if (!seen(r.x, r.y, Math.max(r.rx, r.ry))) continue;
      ctx.fillStyle = STYLE.shadow;
      ellipse(ctx, r.x + 10, r.y + 8, r.rx, r.ry);
      ctx.fill();
      for (const [k, color] of [[1, '#93b271'], [0.7, '#a2bf7e'], [0.4, '#b1cb8b']]) {
        ellipse(ctx, r.x, r.y - (1 - k) * 14, r.rx * k, r.ry * k);
        fill(ctx, color);
      }
    }
    for (const w of gr.waters || []) water(ctx, w, v, t);
    if (gr.stone) {
      // A courtyard: flagstones, lit and plain.
      const st = gr.stone;
      ctx.fillStyle = PAL.cobble;
      ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.strokeStyle = PAL.cobbleLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const [x0, x1] = [Math.max(st.x, v.x), Math.min(st.x + st.w, v.x + v.w)];
      for (let y = Math.max(st.y, Math.floor(v.y / 22) * 22); y < Math.min(st.y + st.h, v.y + v.h); y += 22) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        for (let x = st.x + ((y / 22) % 2) * 18; x < x1; x += 36) {
          if (x < x0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 22);
        }
      }
      ctx.stroke();
    }
    for (const r of gr.roads || []) {
      ctx.fillStyle = PAL.road;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Decor: flowers and ferns where the map puts them; tufts of grass everywhere, from fixed spots.
    for (const [kind, x, y, w, h] of m.decor || []) {
      if (!seen(x + w / 2, y + h / 2, 40)) continue;
      const k = kind;
      const cx = x + w / 2;
      const cy = y + h * 0.8;
      if (k === 'ferns') for (let i = 0; i < 3; i++) G.tuft(ctx, cx + (i - 1) * 7, cy + (i % 2) * 3, 1.4, PAL.forestDark);
      else if (k === 'leaves') {
        ctx.fillStyle = '#b08a52';
        for (let i = 0; i < 5; i++) {
          ellipse(ctx, cx + ((i * 37) % 20) - 10, cy + ((i * 23) % 10) - 5, 2.4, 1.4);
          ctx.fill();
        }
      } else if (k === 'fence') G.fence(ctx, x + 4, y + h * 0.8, x + w - 4, y + h * 0.8, 1);
      else if (k === 'stones') {
        for (let i = 0; i < 3; i++) {
          ellipse(ctx, cx + (i - 1) * 7, cy + (i % 2) * 2, 3, 2);
          G.fillLine(ctx, PAL.rock, 0.8);
        }
      } else for (let i = 0; i < 4; i++) G.tuft(ctx, cx + (i - 1.5) * 8, cy + (i % 2) * 4, 1.2, PAL.grassDark, ['#f2e2a0', '#e9a6a0', '#ffffff', '#c9c2e8'][(i + x) % 4]);
    }
    const { w: WW, h: WH } = CL.camera.worldSize(m);
    const n = Math.round((70 * WW * WH) / (960 * 540));
    for (let i = 0; i < n; i++) {
      const x = (i * 167 + 53) % WW;
      const y = (i * 113 + 39) % WH;
      if (x > v.x - 6 && x < v.x + v.w + 6 && y > v.y - 6 && y < v.y + v.h + 6 && !inWater(gr, x, y)) G.tuft(ctx, x, y, 1, PAL.grassDark);
    }
    // The field's edge, as before, so the bounds read.
    ctx.strokeStyle = 'rgba(58,72,42,0.55)';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, WW - 24, WH - 24);
  }
  /** Is a patch's colour (the maps' own) dirt or sand rather than grass? Redder than green is. */
  function isDirt(c) {
    const n = Number.parseInt(String(c || '').slice(1, 7), 16);
    return Number.isFinite(n) && ((n >> 16) & 255) > ((n >> 8) & 255);
  }
  const inWater = (gr, x, y) => (gr.waters || []).some((w) => x > w.x - 6 && x < w.x + w.w + 6 && y > w.y && y < w.y + w.h) || (gr.stone && x > gr.stone.x && x < gr.stone.x + gr.stone.w && y > gr.stone.y && y < gr.stone.y + gr.stone.h);

  /** Water (a ford's shallows, a stream): the game's own rectangle, with soft banks and ripples. */
  function water(ctx, w, v, t) {
    const [y0, y1] = [Math.max(w.y, v.y - 20), Math.min(w.y + w.h, v.y + v.h + 20)];
    if (y1 <= y0 || w.x > v.x + v.w || w.x + w.w < v.x) return;
    const wob = (y, k) => Math.sin(y * 0.012 + k) * 4;
    const band = (pad, colour) => {
      ctx.beginPath();
      ctx.moveTo(w.x - pad + wob(y0, 0), y0);
      for (let y = y0; y <= y1; y += 24) ctx.lineTo(w.x - pad + wob(y, 0), y);
      ctx.lineTo(w.x - pad + wob(y1, 0), y1);
      ctx.lineTo(w.x + w.w + pad + wob(y1, 2), y1);
      for (let y = y1; y >= y0; y -= 24) ctx.lineTo(w.x + w.w + pad + wob(y, 2), y);
      ctx.closePath();
      fill(ctx, colour);
    };
    band(7, PAL.bank);
    band(0, PAL.water);
    ctx.strokeStyle = PAL.waterLight;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = Math.floor(y0 / 40) * 40; y < y1; y += 40) {
      for (let x = w.x + 14 + ((y / 40) % 2) * 20; x < w.x + w.w - 14; x += 44) {
        const yy = y + ((t * 16) % 40);
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo(x + 6, yy - 3, x + 12, yy);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Where an obstacle sits in the depth order (as the game's). */
  const baseOf = (o) => (o.shape === 'circle' ? o.y + o.r * 0.5 : o.y + o.h);

  /** An obstacle in the kit: trees, bushes, rocks, walls, crates, the gate, the wagon. */
  function obstacle(ctx, o, t, g) {
    const k = lookName(o);
    const seed = o.seed ?? Math.abs(Math.round(o.x * 7 + o.y * 13)) % 997;
    if (k === 'tree' || k === 'pine' || k === 'birch') {
      // P11-12e: a tree is still (its sway was a hair's breadth): stamped from the bake cache at the
      // canvas's scale, drawn live only where there is no canvas to bake on (Node's tests).
      const sc = (o.r / 20) * 1.2;
      const kind = k === 'tree' ? 'broad' : k;
      const m = ctx.getTransform?.();
      const px = m && m.a ? Math.round(Math.hypot(m.a, m.b) * 10) / 10 : 0;
      if (px && root.document) ctx.drawImage(G.cached(`tree:${kind}:${seed}:${sc.toFixed(2)}`, px, 70 * sc, 72 * sc, 35 * sc, 62 * sc, (c) => G.tree(c, 0, 0, sc, seed, kind, 0), BAKE_MAX), o.x - 35 * sc, o.y + o.r * 0.5 - 62 * sc, 70 * sc, 72 * sc);
      else G.tree(ctx, o.x, o.y + o.r * 0.5, sc, seed, kind, 0);
    }
    else if (k === 'bush') G.bush(ctx, o.x, o.y + o.r * 0.5, (o.r / 14) * 1.15, seed);
    else if (k === 'rock') G.rock(ctx, o.x, o.y + o.r * 0.5, (o.r / 15) * 1.1, seed);
    else if (k === 'wall') wallBlock(ctx, o, seed);
    else if (k === 'fence') {
      if (o.w >= o.h) G.fence(ctx, o.x, o.y + o.h, o.x + o.w, o.y + o.h, 1.2);
      else G.fence(ctx, o.x + o.w / 2, o.y, o.x + o.w / 2, o.y + o.h, 1.2);
    }
    else if (k === 'wagon') wagon(ctx, o, g, t);
    else if (o.gate) gate(ctx, o, g);
    else crates(ctx, o, seed);
  }

  /** A stone wall as a block seen from above: a lit top with coursing, a front face, merlons on a big one. */
  function wallBlock(ctx, o, seed) {
    const face = Math.min(12, Math.max(6, o.h * 0.6));
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(o.x + 4, o.y + 4, o.w, o.h + 4);
    // A tall curtain wall casts a band of shadow to the lower right, so its height reads from above.
    if (o.h > o.w * 3 && o.w >= 22) ctx.fillRect(o.x + o.w, o.y + 6, 14, o.h);
    G.rrect(ctx, o.x, o.y - face, o.w, o.h + face, 2);
    G.fillLine(ctx, PAL.stoneShade);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(o.x + 1, o.y - face + 1, o.w - 2, Math.max(2, o.h - 1));
    const r = G.rng(seed);
    ctx.strokeStyle = G.tone(PAL.stoneShade, -0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (o.w >= o.h) {
      for (let x = o.x + 8; x < o.x + o.w - 4; x += 10 + r() * 8) {
        ctx.moveTo(x, o.y + o.h - face + 2);
        ctx.lineTo(x, o.y + o.h - 2);
      }
    } else {
      for (let y = o.y - face + 10; y < o.y + o.h - 4; y += 12 + r() * 6) {
        ctx.moveTo(o.x + 2, y);
        ctx.lineTo(o.x + o.w - 2, y);
      }
    }
    ctx.stroke();
    if (o.w >= 22 && o.h >= 22) {
      // A curtain wall (the assault's): merlons along its top.
      for (let y = o.y - face + 3; y < o.y + o.h - 8; y += 16) {
        G.rrect(ctx, o.x + 2, y, 7, 9, 1.5);
        G.fillLine(ctx, PAL.stone, STYLE.line * 0.8);
      }
    }
  }

  /** The assault's gate: heavy planks and iron bands across the gap (shut until the ram breaks it). */
  function gate(ctx, o) {
    const face = 12;
    ctx.fillStyle = STYLE.shadow;
    ctx.fillRect(o.x + 4, o.y + 4, o.w, o.h + 4);
    G.rrect(ctx, o.x, o.y - face, o.w, o.h + face, 2);
    G.fillLine(ctx, PAL.woodShade);
    ctx.strokeStyle = PAL.wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = o.y - face + 6; y < o.y + o.h; y += 8) {
      ctx.moveTo(o.x + 3, y);
      ctx.lineTo(o.x + o.w - 3, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#5d636b';
    for (const f of [0.25, 0.75]) ctx.fillRect(o.x + 1, o.y - face + (o.h + face) * f - 2, o.w - 2, 4);
  }

  /** Crates and a barrel or two (the courtyard's cover, the keep line). */
  function crates(ctx, o, seed) {
    const n = Math.max(1, Math.round((o.w * o.h) / 900));
    const r = G.rng(seed);
    const s = Math.min(1.6, Math.max(0.9, o.w / 26));
    for (let i = 0; i < n; i++) {
      const x = o.x + o.w * ((i + 0.5) / n) + (r() - 0.5) * 4;
      const y = o.y + o.h - (i % 2) * Math.min(10, o.h * 0.3);
      if (r() < 0.25) G.barrel(ctx, x, y, s);
      else G.crate(ctx, x, y, s, Math.min(22, o.w / n + 4));
    }
  }

  /** The escort's wagon (P7-11): a covered wagon, charred once it burns, with its health while it stands. */
  function wagon(ctx, o, g, t) {
    const w = g?.wagon;
    const burnt = w && !w.alive;
    G.wagon(ctx, o.x + o.w / 2, o.y + o.h, 1.4, 1, 0, burnt ? '#4a4038' : PAL.cloth);
    if (burnt) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.3 + i / 3) % 1;
        ctx.globalAlpha = 0.35 * (1 - k);
        ellipse(ctx, o.x + o.w / 2 + Math.sin(k * 4 + i) * 6, o.y - 30 - k * 50, 6 + k * 10, 5 + k * 8);
        fill(ctx, '#6a6460');
      }
      ctx.globalAlpha = 1;
    } else if (w && w.hp < w.maxhp) {
      ctx.fillStyle = 'rgba(39,25,26,0.75)';
      G.rrect(ctx, o.x + o.w / 2 - 20, o.y - 46, 40, 5, 2);
      ctx.fill();
      ctx.fillStyle = '#e3b062';
      G.rrect(ctx, o.x + o.w / 2 - 20, o.y - 46, (40 * w.hp) / w.maxhp, 5, 2);
      ctx.fill();
    }
  }

  /** The assault's ladders against the wall's gaps, and the ram at the gate while it works (ground level). */
  function siegeworks(ctx, g, seen) {
    const wall = g.battleMap?.wall;
    if (!wall) return;
    for (const gap of wall.gaps) {
      if (gap.kind !== 'ladder' || !seen(wall.centre, gap.y, 80)) continue;
      const x0 = wall.x - 14;
      const x1 = wall.x + wall.w + 14;
      for (const dy of [-gap.h * 0.32, gap.h * 0.32]) {
        ctx.strokeStyle = STYLE.outline;
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(x0, gap.y + dy);
        ctx.lineTo(x1, gap.y + dy);
        ctx.stroke();
        ctx.strokeStyle = PAL.wood;
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }
      ctx.strokeStyle = PAL.woodShade;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = x0 + 5; x < x1; x += 8) {
        ctx.moveTo(x, gap.y - gap.h * 0.32);
        ctx.lineTo(x, gap.y + gap.h * 0.32);
      }
      ctx.stroke();
    }
    const s = g.siege;
    if (s?.ram && !s.gateOpen && !wall.gateOpen) {
      const gp = wall.gaps.find((x) => x.kind === 'gate');
      const x = wall.outside < 0 ? wall.x - 34 : wall.x + wall.w + 34;
      if (gp && seen(x, gp.y, 60)) ram(ctx, x, gp.y + 18, wall.outside < 0 ? 1 : -1);
    }
  }
  function ram(ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    G.shadow(ctx, 2, 2, 26, 7, 10);
    for (const wx of [-16, 14]) {
      ellipse(ctx, wx, -4, 6, 6);
      G.fillLine(ctx, PAL.woodShade);
    }
    // The shed: a sloped roof of hides over the beam, the iron head toward the gate.
    G.poly(ctx, [-24, -8, -18, -30, 16, -30, 22, -8]);
    G.fillLine(ctx, '#8a6a48');
    ctx.fillStyle = G.tone('#8a6a48', -0.15);
    ctx.fillRect(4, -29, 16, 20);
    G.rrect(ctx, 18, -18, 14, 7, 2);
    G.fillLine(ctx, '#5d636b');
    ctx.restore();
  }

  // ---- Arrows and effects ----

  function arrows(ctx, list, seen) {
    for (const a of list) {
      if (!seen(a.x, a.y, 30)) continue;
      const bolt = a.speed >= 300; // a crossbow's bolt: short and thick
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(Math.atan2(a.dy, a.dx));
      const L = bolt ? 10 : 15;
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = bolt ? 3.2 : 2.6;
      ctx.beginPath();
      ctx.moveTo(-L, 0);
      ctx.lineTo(1, 0);
      ctx.stroke();
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = bolt ? 1.8 : 1.3;
      ctx.stroke();
      G.poly(ctx, [1, -2.2, 6, 0, 1, 2.2]);
      fill(ctx, PAL.steel);
      G.poly(ctx, [-L, 0, -L - 3, -3, -L + 3, 0, -L - 3, 3]);
      fill(ctx, a.team === 'ally' ? '#e9e1cc' : '#b0453a');
      ctx.restore();
    }
  }

  /**
   * The game's effects, restrained: a burst for a hit, a pale arc for a block, a puff for an arrow in the
   * ground, the rally's and a brace's ring. Reduced effects and big battles keep the rally and (P11-09)
   * the hero's own fight's cues: a miss, a block, a broken guard, a stagger, within reach of the hero.
   */
  /** P11-09: the cues the hero always sees, near the hero (px): their own fight's. */
  const ESSENTIAL = new Set(['whiff', 'block', 'break', 'stagger']);
  const ESSENTIAL_NEAR = 90;
  function effects(ctx, list, seen, only) {
    for (const e of list) {
      if (!seen(e.x, e.y, 60)) continue;
      if (only && !only(e)) continue;
      const life = e.life || { hit: 0.35, rally: 0.6, whiff: 0.3, break: 0.45, stagger: 0.35 }[e.kind] || 0.2;
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
      } else if (e.kind === 'whiff') {
        // P11-05: a small dust arc where the swing cut empty air.
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = 2;
        const f = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[e.face] ?? 0;
        ctx.beginPath();
        ctx.arc(0, 0, 14 + k * 6, f - 0.7, f + 0.7);
        ctx.stroke();
      } else if (e.kind === 'break') {
        // A broken guard: the shield's arc split, two shards falling.
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#e4eef6';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(-2 - k * 4, k * 6, 10, -2.4, -1.65);
        ctx.moveTo(2 + k * 4, k * 6);
        ctx.arc(2 + k * 4, k * 6, 10, -1.45, -0.7);
        ctx.stroke();
      } else if (e.kind === 'stagger') {
        // A stagger: three short marks wheeling over the head.
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#efe4c4';
        for (let i = 0; i < 3; i++) {
          const a = k * 4 + (i * Math.PI * 2) / 3;
          ellipse(ctx, Math.cos(a) * 7, Math.sin(a) * 2.5, 1.6, 1.6);
          ctx.fill();
        }
      } else if (e.kind === 'thunk') {
        ctx.globalAlpha = 0.5 * (1 - k);
        ellipse(ctx, 0, 0, 4 + k * 6, 2 + k * 3);
        fill(ctx, '#e8dcc0');
      } else {
        ctx.globalAlpha = 0.65 * (1 - k);
        ctx.strokeStyle = e.kind === 'rally' ? PAL.gold : '#f6daa6';
        ctx.lineWidth = 2.6;
        const r = (e.size || 22) * (0.4 + k * 0.6);
        ellipse(ctx, 0, 20, r, r * 0.42);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * P11-07: while the hero draws, a ring round them filling with the draw (gold at full), and a ring
   * of four marks under the target the shot would go to: shapes, not colours.
   */
  function aimRings(ctx, g) {
    const h = g.hero;
    const r = h?.ranged;
    if (!r || !h.alive) return;
    const k = r.crossbow && h.loaded ? 1 : Math.min(1, (h.drawT || 0) / (r.draw || 1));
    if (k > 0) {
      ctx.save();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(30,22,14,0.55)';
      ctx.beginPath();
      ctx.arc(h.x, h.y + 5, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = k >= 1 ? PAL.gold : '#efe4c4';
      ctx.stroke();
      ctx.restore();
    }
    const v = g.aimTarget;
    if (v?.alive) {
      ctx.save();
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.4;
        ctx.beginPath();
        ctx.arc(v.x, v.y + 5, 13, a, a + 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** P11-05: the enemy the hero is facing and close to (for the glint). */
  function heroFoe(g) {
    const h = g.hero;
    if (!h?.alive) return null;
    let best = null;
    let bd = 110;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - h.x, e.y - h.y);
      if (d < bd && CL.units.inArc(h, e, CL.units.ARC.block)) [best, bd] = [e, d];
    }
    return best;
  }

  // ---- The whole field, from js/render.js ----

  /**
   * Draw the battle in world pixels (the caller has set the camera transform). `k` is device pixels per
   * world pixel (the canvas's backing scale × zoom), for the baked frames.
   */
  function draw(ctx, g, v, k) {
    const B = state(g);
    const t = performance.now() / 1000;
    const reduced = Boolean(CL.settings?.get('reducedEffects'));
    const busy = Boolean(CL.render?.busyBattle?.());
    const seen = (x, y, mg) => x > v.x - mg && x < v.x + v.w + mg && y > v.y - mg && y < v.y + v.h + mg;
    const chars = [...g.allies, ...g.enemies];
    if (g.hero) chars.push(g.hero);
    track(B, chars, reduced, busy);
    B.heroFoe = heroFoe(g);
    ground(ctx, g.battleMap, v, t);
    siegeworks(ctx, g, seen);
    for (const p of B.dust) {
      ctx.globalAlpha = 0.35 * (1 - p.t / 0.7);
      ellipse(ctx, p.x - p.t * 6, p.y - p.t * 9, 4 + p.t * 9, 2.5 + p.t * 4);
      fill(ctx, '#e8dcc0');
    }
    ctx.globalAlpha = 1;
    const bodies = chars.filter((u) => !u.alive && u.ground && seen(u.x, u.y, 60)).sort((a, b) => a.y - b.y);
    for (const u of bodies) {
      const a = CL.render.bodyAlpha(u);
      if (a > 0) fallen(ctx, u, a, k);
    }
    const scene = [];
    for (const u of chars) if (u.alive && seen(u.x, u.y, 80)) scene.push([u.y, u]);
    for (const o of g.battleMap?.obstacles || []) if (seen(o.x + (o.w || 0) / 2, o.y + (o.h || 0) / 2, 120 + Math.max(o.w || 0, o.h || 0))) scene.push([baseOf(o), o]);
    scene.sort((p, q) => p[0] - q[0]);
    for (const [, x] of scene) {
      if (x.team) unit(ctx, x, t, k, reduced);
      else obstacle(ctx, x, t, g);
    }
    aimRings(ctx, g);
    arrows(ctx, g.arrows, seen);
    const h = g.hero;
    const mine = (e) => e.kind === 'rally' || (ESSENTIAL.has(e.kind) && h && Math.hypot(e.x - h.x, e.y - h.y) < ESSENTIAL_NEAR);
    effects(ctx, g.effects, seen, reduced || busy ? mine : null);
  }

  /** The small painted field for the minimap, the overview and the Prepare screen (cached per map). */
  const minis = new WeakMap();
  function miniature(m) {
    let img = minis.get(m);
    if (img) return img;
    const { w, h } = CL.camera.worldSize(m);
    const k = 0.125;
    img = root.document.createElement('canvas');
    img.width = Math.ceil(w * k);
    img.height = Math.ceil(h * k);
    const c = img.getContext('2d');
    c.scale(k, k);
    const v = { x: 0, y: 0, w, h };
    const gr = m.ground || {};
    c.fillStyle = PAL.grass;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.45;
    for (const p of gr.patch ? [gr.patch, ...(gr.patches || [])] : gr.patches || []) {
      ellipse(c, p.x, p.y, p.rx, p.ry);
      fill(c, isDirt(p.color) ? PAL.road : PAL.grassLight);
    }
    c.globalAlpha = 1;
    for (const r of gr.rises || []) {
      ellipse(c, r.x, r.y, r.rx, r.ry);
      fill(c, '#b1cb8b');
    }
    for (const wt of gr.waters || []) {
      c.fillStyle = PAL.water;
      c.fillRect(wt.x, wt.y, wt.w, wt.h);
    }
    if (gr.stone) {
      c.fillStyle = PAL.cobble;
      c.fillRect(gr.stone.x, gr.stone.y, gr.stone.w, gr.stone.h);
    }
    for (const o of m.obstacles) {
      const kind = lookName(o);
      if (o.shape === 'rect') {
        c.fillStyle = kind === 'wall' ? PAL.stoneShade : PAL.woodShade;
        c.fillRect(o.x, o.y, o.w, o.h);
      } else {
        c.fillStyle = kind === 'rock' ? PAL.rock : kind === 'bush' ? PAL.forestLight : PAL.forestDark;
        ellipse(c, o.x, o.y, o.r * 1.6, o.r * 1.6);
        c.fill();
      }
    }
    void v;
    minis.set(m, img);
    return img;
  }

  G.battle = { poseOf: (u) => poseOf(u, battle?.track.get(u), 0, false), FIG, TEAM, water, draw, unit, fallen, ground, obstacle, arrows, effects, miniature, lookOf: (u) => lookOf(state(CL.game), u), lookCount: () => (battle && battle.g === CL.game ? battle.lookCount || 0 : 0), sides, baseOf, lookName };
})(typeof window !== 'undefined' ? window : globalThis);
