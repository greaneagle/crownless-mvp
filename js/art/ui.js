/* Crownless art kit: the UI's pictures (P10-G5, D-P10k). Portraits drawn from the figure parts at a larger
 * scale with a face (P11-12b: the storybook figure's own bust and features, so a portrait is the same
 * person as the figure in the streets and on the field), small troop figures, house arms and banners, and the vector icons (the stats and the
 * trade goods). Everything here is drawn in code; a screen asks for a canvas or an image URL, cached. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, tone, ellipse } = G;

  const num = (seed) => {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  };

  // ---- Faces ----

  /** What a face is made of (js/art/figures.js faceOf): the figures and the portraits share it. */
  const faceOf = (seed, shape) => G.fig.faceOf(seed, shape);

  /**
   * A portrait: a bust in a 100×100 box at (x, y), w wide. `L` is a figure look (`js/art/figures.js`); its
   * features (`face` from faceOf, `beardKind` 0 none, 1 stubble, 2 short, 3 full, `eyes`) and `crown` come
   * through `G.fig.features`, as the figure's.
   * `helm` false shows the face bare; a portrait keeps its look's helmet otherwise.
   */
  function portrait(ctx, x, y, w, L, { helm = true, back = true } = {}) {
    const R = G.realm(L.realm || 'neutral');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / 100, w / 100);
    ctx.beginPath();
    ctx.rect(0, 0, 100, 100);
    ctx.clip();
    if (back) {
      // The backdrop: a dark wash of the realm's colour, and a lighter disc behind the head (one light).
      ctx.fillStyle = tone(R.color, -0.62);
      ctx.fillRect(0, 0, 100, 100);
      ellipse(ctx, 47, 42, 39, 39);
      ctx.fillStyle = tone(R.color, -0.45);
      ctx.fill();
    }
    G.fig.bust(ctx, L, { helm });
    ctx.restore();
  }

  /** A soldier's look for their portrait: their troop's clothes and their own face (P10-09's `portrait` id). */
  const SKIN_OF = [1, 2, 3];
  const HAIR_OF = [5, 1, 6, 3, 4]; // black, brown, auburn, fair, grey
  function soldierLook(s, side) {
    const t = CL.content.troop(s.troop);
    const realm = side || t?.faction || 'neutral';
    const L = { ...G.fig.troopLook(s.troop, realm, s.id || 1) };
    const [sex, skin, face, hair, extra] = String(s.portrait || 'm-0-0-0-0').split('-');
    const female = sex === 'f';
    Object.assign(L, {
      female,
      skin: G.fig.SKINS[SKIN_OF[+skin] ?? 1],
      hair: G.fig.HAIRS[HAIR_OF[+hair] ?? 1],
      face: faceOf(`${s.id}|${s.troop}`, +face || 0),
      hairStyle: female ? (+extra ? 'braid' : 'long') : 'short',
      beardKind: female ? 0 : +extra || 0,
      beard: null,
      seed: s.id,
    });
    return L;
  }

  /** A lord's or ruler's look: their realm's colours and culture, a face from their id, a crown when they rule. */
  function lordLook(c, pid) {
    const p = CL.realm.person?.(pid, c) || c?.people?.[pid] || {};
    const f = CL.realm.faction?.(p.realm);
    const n = num(pid);
    const female = p.gender === 'female';
    const north = f?.culture === 'hrothmark' || f?.culture === 'ostrand';
    const R = G.realm(p.realm || 'neutral');
    return {
      seed: n % 997,
      realm: p.realm || 'neutral',
      female,
      skin: G.fig.SKINS[(north ? 0 : 1) + (n % 2)],
      hair: G.fig.HAIRS[[0, 1, 2, 3, 4, 5][(n >>> 4) % 6]],
      hairStyle: female ? ['long', 'braid', 'bun'][(n >>> 7) % 3] : (n >>> 7) % 5 ? 'short' : 'bald',
      beardKind: female ? 0 : [0, 2, 3, 2][(n >>> 9) % 4],
      face: faceOf(pid),
      tunic: R.color,
      cloak: R.dark,
      cloakTrim: PAL.gold,
      fur: north,
      crown: Boolean(CL.realm.rules?.(pid, c)),
    };
  }

  /** Whoever speaks in a conversation: a companion, a lord, a townsperson by role. */
  function speakerLook(npc, c) {
    if (!npc) return null;
    if (npc.companion || CL.content.table('companions')[npc.id]) return G.fig.companionLook(npc.companion || npc.id);
    if (npc.person && c?.people?.[npc.person]) return lordLook(c, npc.person);
    const realm = CL.realm.owner?.(c?.world?.location, c) || 'valedorn';
    const role = G.town?.ROLE_LOOK?.[npc.role] || npc.role || 'townsman';
    if (!G.fig.ROLE_LOOKS[role]) return null;
    if (G.town?.personLook) return { ...G.town.personLook(npc, realm) }; // P11-12b: the streets' own look
    const L = G.fig.townLook(role, num(npc.id) % 997, realm);
    L.female = npc.gender === 'female'; // as in the streets: a woman only when the data says so
    if (L.female) Object.assign(L, { beard: null, beardKind: 0, hairStyle: L.hairStyle === 'short' || L.hairStyle === 'bald' ? 'long' : L.hairStyle });
    L.face = faceOf(npc.id);
    return L;
  }

  /** The hero's portrait look: the creator's choices, in their gear (P11-04: `kit` and `ctx` as G.fig.heroFrom). */
  function heroLook(ch, kit = CL.campaign?.equipment || {}, ctx = {}) {
    const L = G.fig.heroFrom(ch, kit, ctx);
    return { ...L, face: faceOf(`hero|${ch?.name || ''}`, 0), beardKind: 0 };
  }

  // ---- House arms ----

  const DEVICES = ['chevron', 'pale', 'bar', 'quarter', 'lozenge', 'wave', 'cross', 'coin', 'chief', 'slash', 'roundels'];
  const TINCTURES = ['#ecdfbd', '#d8b25a', '#2d2620'];
  const armsCache = new Map();
  /**
   * A house's arms (asset row 8): its realm's colour for the field, a charge and a tincture of its own, by
   * the house's place among its realm's houses (so a realm's houses never share arms). Returns a realm-like
   * colours object for `shieldShape`, `banner` and `device`.
   */
  function houseArms(c, house) {
    const h = typeof house === 'string' ? CL.houses?.list?.(c)?.find((x) => x.id === house) : house;
    if (!h) return null;
    const pid = h.members?.[0];
    const realm = pid === 'player' ? CL.allegiance?.sworn?.(c) || 'player' : CL.realm.person?.(pid, c)?.realm || 'neutral';
    const all = (CL.houses?.list?.(c) || []).filter((x) => {
      const m = x.members?.[0];
      const r = m === 'player' ? CL.allegiance?.sworn?.(c) || 'player' : CL.realm.person?.(m, c)?.realm || 'neutral';
      return r === realm;
    });
    const i = Math.max(0, all.findIndex((x) => x.id === h.id));
    const key = `${h.id}|${realm}|${i}`;
    if (armsCache.has(key)) return armsCache.get(key);
    const base = realm === 'player' ? { color: PAL.gold, dark: tone(PAL.gold, -0.3), culture: 'border', shield: 'heater' } : G.realm(realm);
    const d = (num(realm) + i * 4) % DEVICES.length;
    const trim = TINCTURES[(i + (num(h.id) % 2)) % TINCTURES.length];
    const shield = base.shield === 'round' || base.shield === 'wood' || !base.shield ? 'heater' : base.shield === 'pavise' ? 'heater' : base.shield;
    const R = { color: base.color, dark: base.dark || tone(base.color, -0.25), trim: trim === base.color ? '#ecdfbd' : trim, device: DEVICES[d], shield, culture: base.culture, house: h.id };
    armsCache.set(key, R);
    return R;
  }

  /** A house's shield, at (x, y) with radius r. */
  function arms(ctx, x, y, r, R) {
    G.shieldShape(ctx, x, y, r, R.shield || 'heater', R);
  }

  // ---- Canvases and image URLs for the screens ----

  const urls = new Map();
  const DPR = () => Math.min(3, Math.max(2, Math.ceil(root.devicePixelRatio || 1)));
  /** A canvas w×h CSS px, drawn at the screen's resolution. `paint(ctx)` draws in CSS px. */
  function canvas(w, h, paint) {
    const k = DPR();
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) });
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext('2d');
    ctx.scale(k, k);
    paint(ctx);
    return cv;
  }
  /** The same as an image URL, cached by key (lists of soldiers draw each face once). */
  function url(key, w, h, paint) {
    const id = `${key}@${w}x${h}`;
    let u = urls.get(id);
    if (u) return u;
    u = canvas(w, h, paint).toDataURL();
    if (urls.size > 400) urls.delete(urls.keys().next().value);
    urls.set(id, u);
    return u;
  }

  const lookKey = (L) => JSON.stringify(L, (k, v) => (typeof v === 'object' && v && k === 'realm' ? v.color : v));
  /** A portrait image URL, `size` CSS px square. */
  function portraitUrl(L, size = 64, opts) {
    return url(`p|${lookKey(L)}|${opts?.helm ?? 1}`, size, size, (ctx) => portrait(ctx, 0, 0, size, L, opts));
  }

  /** A full figure standing, drawn to fit a w×h box (the creator's preview, a troop's small figure). */
  function figure(ctx, w, h, L, pose = {}) {
    const mounted = Boolean(L.mount);
    const tall = mounted ? 66 : 50; // the figure with its helmet and weapon
    const s = Math.min((h * 0.9) / tall, (w * 0.95) / (mounted ? 70 : 36));
    ctx.save();
    ctx.translate(w / 2, h - 3);
    ctx.scale(s, s);
    G.shadow(ctx, 2, 0, mounted ? 22 : 11, 3, 6);
    const P = { face: 'down', t: 0, ...pose };
    if (mounted) G.fig.horse(ctx, 0, 0, { ...L.mount, cloth: L.realm }, { face: 'right', t: 0 }, () => G.fig.figure(ctx, 0, 0, L, { face: 'right', t: 0, mounted: true }));
    else G.fig.figure(ctx, 0, 0, L, P);
    ctx.restore();
  }
  /** A troop's small figure as an image URL, in its own realm's colours (or a side's). */
  function troopUrl(troopId, side, w = 40, h = 48) {
    const t = CL.content.troop(troopId);
    const realm = side || t?.faction || 'neutral';
    const L = G.fig.troopLook(troopId, realm, 3);
    return url(`t|${troopId}|${typeof realm === 'string' ? realm : realm.color}`, w, h, (ctx) => {
      try {
        figure(ctx, w, h, L);
      } catch (e) {
        CL.diag?.log('warn', 'Troop figure failed', { troop: troopId, error: String(e) });
      }
    });
  }

  // ---- Icons: small vector shapes, gold on navy, with the one outline and one light ----

  const GOLD = '#d8b45a';
  const GOLD_LO = '#8a6a2c';
  const LINE = '#2a1d10';
  const HI = '#f3dc9a';
  // Each icon in a 24×24 box: its paths ([d, fill]), outlined, then its highlight strokes.
  const ICONS = {
    heart: [['M12 21 C5 15 2 11.5 2 8 C2 5 4.3 3 7 3 C9 3 11 4.3 12 6 C13 4.3 15 3 17 3 C19.7 3 22 5 22 8 C22 11.5 19 15 12 21 Z', GOLD]],
    sword: [['M19.5 2.5 L21.5 4.5 L10 16 L8 14 Z', GOLD], ['M5 13 L11 19 L9.6 20.4 L3.6 14.4 Z', GOLD_LO], ['M6 17.5 L3 20.5 L4.5 22 L7.5 19 Z', GOLD_LO]],
    bow: [['M6 2.5 C15 4 20 9 21.5 18 L19.5 18.4 C18.2 10.5 13.8 6.2 5.6 4.5 Z', GOLD], ['M5.5 3.5 L20.5 18.2 L20 18.9 L4.8 4.2 Z', HI], ['M4 11 L13 11 L13 12.6 L4 12.6 Z', GOLD_LO]],
    shield: [['M4 3.5 L20 3.5 L20 10 C20 15.5 16.5 19.5 12 21.5 C7.5 19.5 4 15.5 4 10 Z', GOLD], ['M12 3.5 L20 3.5 L20 10 C20 15.5 16.5 19.5 12 21.5 Z', GOLD_LO]],
    boot: [['M7 2.5 L14 2.5 L14 13 L20 15.5 C21.5 16.2 22 17.5 22 19 L22 21.5 L5 21.5 L5 18 L7 15 Z', GOLD], ['M5 19 L22 19 L22 21.5 L5 21.5 Z', GOLD_LO]],
    people: [['M16 4 A3.4 3.4 0 1 1 15.99 4 Z', GOLD_LO], ['M10.5 13 C10.5 10.5 13 9.5 16 9.5 C19 9.5 21.5 10.5 21.5 13 L21.5 18 L10.5 18 Z', GOLD_LO], ['M8.5 5 A3.8 3.8 0 1 1 8.49 5 Z', GOLD], ['M2 15 C2 12 5 11 8.5 11 C12 11 15 12 15 15 L15 21 L2 21 Z', GOLD]],
    coin: [['M12 2.5 A9.5 9.5 0 1 1 11.99 2.5 Z', GOLD], ['M12 6 A6 6 0 1 1 11.99 6 Z', GOLD_LO], ['M10.5 8.5 L13.5 8.5 L13.5 15.5 L10.5 15.5 Z', GOLD]],
    star: [['M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z', GOLD]],
    banner: [['M4 2 L5.8 2 L5.8 22 L4 22 Z', GOLD_LO], ['M5.8 3 L20 3 L20 15 L13 12.5 L5.8 15 Z', GOLD], ['M10 6.5 L12.9 9 L10 11.5 L7.1 9 Z', GOLD_LO]],
    book: [['M2.5 4 C6 3 9.5 3.5 12 5.5 C14.5 3.5 18 3 21.5 4 L21.5 19.5 C18 18.5 14.5 19 12 21 C9.5 19 6 18.5 2.5 19.5 Z', GOLD], ['M12 5.5 L12 21 C14.5 19 18 18.5 21.5 19.5 L21.5 4 C18 3 14.5 3.5 12 5.5 Z', GOLD_LO]],
    // The trade goods (asset row 7, once emoji).
    grain: [['M11 22 L13 22 L13 8 L11 8 Z', GOLD_LO], ['M12 2 C14.5 4 14.5 7 12 9 C9.5 7 9.5 4 12 2 Z', GOLD], ['M6.5 7 C9.5 7.5 11 10 10.5 12.5 C7.5 12 6 9.8 6.5 7 Z', GOLD], ['M17.5 7 C14.5 7.5 13 10 13.5 12.5 C16.5 12 18 9.8 17.5 7 Z', GOLD], ['M6.5 12.5 C9.5 13 11 15.5 10.5 18 C7.5 17.5 6 15.3 6.5 12.5 Z', GOLD], ['M17.5 12.5 C14.5 13 13 15.5 13.5 18 C16.5 17.5 18 15.3 17.5 12.5 Z', GOLD]],
    salt: [['M7 9 L17 9 L19 21 L5 21 Z', GOLD], ['M12 9 L17 9 L19 21 L12 21 Z', GOLD_LO], ['M8 4 L16 4 L17 9 L7 9 Z', GOLD_LO], ['M10 13 L14 13 L14 15 L10 15 Z', HI]],
    wool: [['M4 14 A5 5 0 0 1 8 6 A5 5 0 0 1 16 6 A5 5 0 0 1 20 14 A4 4 0 0 1 16 19 L8 19 A4 4 0 0 1 4 14 Z', GOLD], ['M8 19 L8 22 L10 22 L10 19 Z M14 19 L14 22 L16 22 L16 19 Z', GOLD_LO]],
    iron: [['M3 13 L7 9 L21 9 L21 14 L17 18 L3 18 Z', GOLD_LO], ['M3 13 L7 9 L21 9 L17 13 Z', GOLD]],
    cloth: [['M3 6 L18 6 C20 6 21 7.5 21 9.5 L21 18 L6 18 C4 18 3 16.5 3 14.5 Z', GOLD], ['M18 6 C20 6 21 7.5 21 9.5 C21 11.5 20 13 18 13 C16 13 15 11.5 15 9.5 C15 7.5 16 6 18 6 Z', GOLD_LO], ['M6 10 L13 10 M6 14 L13 14', null]],
    tools: [['M13.5 9 L16 11.5 L6 21.5 L3.5 19 Z', GOLD_LO], ['M10 3.5 L16 3 L21 8 L18.5 10.5 L15.5 8 L12.5 8.5 Z', GOLD]],
    timber: [['M3 9 L17 9 L17 18 L3 18 Z', GOLD_LO], ['M3 9 L17 9 L17 11.5 L3 11.5 Z', GOLD], ['M17 9 A3 4.5 0 1 1 16.99 9 Z', GOLD], ['M18 12 A1.2 1.6 0 1 1 17.99 12 Z', GOLD_LO]],
    wine: [['M6 3 L18 3 C18 9 16 13 12.8 13.6 L12.8 19 L16.5 20 L16.5 21.5 L7.5 21.5 L7.5 20 L11.2 19 L11.2 13.6 C8 13 6 9 6 3 Z', GOLD], ['M6.6 6.5 L17.4 6.5 C17 10 15 12.3 12 12.3 C9 12.3 7 10 6.6 6.5 Z', '#8b3d2e']],
    flour: [['M6 7 C6 5 8 4.5 12 4.5 C16 4.5 18 5 18 7 L19.5 19 C19.5 21 17 21.5 12 21.5 C7 21.5 4.5 21 4.5 19 Z', GOLD], ['M12 4.5 C16 4.5 18 5 18 7 L19.5 19 C19.5 21 17 21.5 12 21.5 Z', GOLD_LO], ['M8 4 L16 4 L15 2.5 L9 2.5 Z', GOLD_LO]],
    food_ration: [['M3 14 C3 8.5 7 5.5 12 5.5 C17 5.5 21 8.5 21 14 L21 17 C21 18.5 20 19 18.5 19 L5.5 19 C4 19 3 18.5 3 17 Z', GOLD], ['M8 9 L9.5 12.5 M12 8.5 L13 12 M16 9 L16.5 12.5', null]],
    medicine: [['M9 3 L15 3 L15 9 L21 9 L21 15 L15 15 L15 21 L9 21 L9 15 L3 15 L3 9 L9 9 Z', GOLD], ['M12 3 L15 3 L15 9 L21 9 L21 15 L15 15 L15 21 L12 21 Z', GOLD_LO]],
    // P11-04: items by what they are (a weapon by its family, armour by its class), for the gear lists.
    axe: [['M5 21 L7 22.5 L18 6 L16 4.5 Z', GOLD_LO], ['M13 3 C17 1.5 21 3.5 22 7.5 L17.5 10 L12.5 6.5 Z', GOLD]],
    mace: [['M5 21.5 L7 22.5 L14.5 11 L12.5 10 Z', GOLD_LO], ['M16 2.5 A5 5 0 1 1 15.99 2.5 Z', GOLD], ['M16 2.5 L16 0.8 M21 7.5 L22.8 7.5 M11 7.5 L9.2 7.5', null]],
    spear: [['M3.5 21.5 L5 23 L16.5 10 L15 8.5 Z', GOLD_LO], ['M14.5 8.5 L22 2 L17.5 11 Z', GOLD]],
    crossbow: [['M2.5 12.5 L17 12.5 L17 15 L2.5 15 Z', GOLD_LO], ['M15 3 C19.5 6.5 19.5 20.5 15 22 L17 22.5 C22 20.5 22 4.5 17 2.5 Z', GOLD], ['M16 3.5 L9 13.7 L16 21.5', null]],
    helmet: [['M4 15 C4 8 7.5 4 12 4 C16.5 4 20 8 20 15 Z', GOLD], ['M3 14.5 L21 14.5 L21 17 L3 17 Z', GOLD_LO], ['M11 14.5 L13 14.5 L13 21 L11 21 Z', GOLD_LO]],
    tunic: [['M8 3 L16 3 L21 7 L18.5 10.5 L17 9.5 L17 21 L7 21 L7 9.5 L5.5 10.5 L3 7 Z', GOLD], ['M12 3 L16 3 L21 7 L18.5 10.5 L17 9.5 L17 21 L12 21 Z', GOLD_LO]],
    jerkin: [['M8 3 L16 3 L21 7 L18.5 10.5 L17 9.5 L17 21 L7 21 L7 9.5 L5.5 10.5 L3 7 Z', GOLD_LO], ['M7 13 L17 13 L17 15 L7 15 Z', GOLD], ['M12 3 L12 13', null]],
    mail: [['M8 3 L16 3 L21 7 L18.5 10.5 L17 9.5 L17 21 L7 21 L7 9.5 L5.5 10.5 L3 7 Z', GOLD], ['M8 9 L16 9 M8 12 L16 12 M8 15 L16 15 M8 18 L16 18', null]],
    glove: [['M7 21.5 L7 11 L5 8 L6.5 6.8 L9 9.5 L9 3.5 L11 3.5 L11 9 L12.5 2.5 L14.5 2.5 L13.5 9 L15.5 3.5 L17.5 4 L15.5 10 L18 7.5 L19.5 8.5 L16.5 14 L16.5 21.5 Z', GOLD]],
    horse: [['M5 21.5 L8 13 C6 11 6 7.5 9 5.5 L11 2.5 L12.5 5 C16 5 19 8 21 13 L18.5 14.5 L15 11.5 L14 21.5 Z', GOLD], ['M9 5.5 L11 2.5 L12.5 5 Z', GOLD_LO]],
    ring: [['M12 6 A7.5 7.5 0 1 1 11.99 6 Z M12 9 A4.5 4.5 0 1 0 12.01 9 Z', GOLD], ['M9.5 2 L14.5 2 L13.5 5.5 L10.5 5.5 Z', HI]],
    quiver: [['M8 6 L14 6 L15.5 21.5 L9.5 21.5 Z', GOLD_LO], ['M9 6 L10 1.5 M11.5 6 L12 1.5 M13.5 6 L14.5 2', null], ['M8.5 10 L14.5 10', null]],
    // P11-09: the battle buttons' own: a lance (long, with its hand guard) and a fist (no weapon).
    lance: [['M2.5 22.5 L3.8 23.5 L19 5.5 L17.7 4.5 Z', GOLD_LO], ['M17 4 L22.5 1.5 L20 7 Z', GOLD], ['M5.5 13.5 C8 13 11 16 10.5 18.5 L7.5 18 L6 16.5 Z', GOLD]],
    fist: [['M6 10 C6 7.5 8 7 9 8 C9.5 6 12 6 12.5 8 C13 6.3 15.5 6.3 16 8.3 C16.8 7 19 7.6 19 9.8 L19 15 C19 19 16.5 21.5 12.5 21.5 C9 21.5 6 19 6 15.5 Z', GOLD], ['M6 12 C8 11 10.5 11.5 11 13.5', null]],
  };

  /** P11-04: the icon for each weapon family. */
  const FAMILY_ICON = { sword: 'sword', greatsword: 'greatsword', axe: 'axe', greataxe: 'greataxe', mace: 'mace', spear: 'spear', pike: 'pike', lance: 'spear', shortbow: 'bow', longbow: 'longbow', composite: 'bow', crossbow: 'crossbow' };
  /** And for each slot (body armour by its class). */
  const SLOT_ICON = { offhand: 'shield', head: 'helmet', hands: 'glove', feet: 'boot', horse: 'horse', ring: 'ring', ammo: 'quiver' };
  const ARMOUR_ICON = { cloth: 'tunic', gambeson: 'tunic', leather: 'jerkin', mail: 'mail' };
  /** What each item icon is called (its accessible name). */
  const ICON_NAMES = { sword: 'Sword', axe: 'Axe', mace: 'Mace', spear: 'Spear', bow: 'Bow', crossbow: 'Crossbow', shield: 'Shield', helmet: 'Helmet', tunic: 'Clothing', jerkin: 'Leather armour', mail: 'Mail', glove: 'Gloves', boot: 'Boots', horse: 'Horse', ring: 'Ring', quiver: 'Quiver', lance: 'Lance', fist: 'Fists', greatsword: 'Greatsword', greataxe: 'Greataxe', pike: 'Pike', longbow: 'Longbow', round_shield: 'Round shield', kettle: 'Kettle hat', greathelm: 'Great helm' };

  /**
   * P11-12d (D-P11m): items and goods in colour, 32×32, from the handoff's family icons (steel, wood,
   * leather, cloth, a gold accent, the people's warm ink), with variants by the item's look. The stats
   * and the HUD keep the gold icons above.
   */
  const C32 = { steel: '#c3cdd4', dark: '#788694', wood: '#a77949', leather: '#a06b42', gold: '#e4bc66', cloth: '#e6d6b4', blue: '#547ba4', red: '#ad5945', ink: '#49352a' };
  const p32 = (d, f) => `<path d="${d}" fill="${f}" stroke="${C32.ink}" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round"/>`;
  const e32 = (x, y, rx, ry, f) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${C32.ink}" stroke-width="1.2"/>`;
  const l32 = (d) => p32(d, 'none');
  const { steel, dark, wood, leather, gold, cloth, blue, red } = C32;
  const COLOUR = {
    sword: p32('M27 3 L29 5 L13 22 L10 19 Z', steel) + p32('M27 3 L29 5 L13 22 L12 20 Z', dark) + p32('M7 16 L16 25 L14 27 L5 18 Z', gold) + p32('M10 22 L5 28 L3 26 L8 20 Z', leather),
    greatsword: p32('M29 1 L31 3 L13 21 L11 19 Z', steel) + p32('M29 1 L31 3 L13 21 L12 20 Z', dark) + p32('M6 15 L17 26 L15 28 L4 17 Z', gold) + p32('M11 21 L3 30 L1 28 L9 19 Z', leather),
    axe: p32('M12 11 L15 12 L7 29 L4 27 Z', wood) + p32('M13 6 Q22 8 26 3 L29 13 Q25 20 13 15 Z', steel) + p32('M26 4 L29 13 L25 16 L23 8 Z', dark),
    greataxe: p32('M14 8 L17 9 L6 31 L3 29 Z', wood) + p32('M12 2 Q22 5 27 0 L31 14 Q26 22 12 15 Z', steel) + p32('M27 1 L31 14 L26 17 L24 6 Z', dark),
    mace: p32('M12 13 L16 14 L9 29 L5 27 Z', wood) + p32('M14 4 L21 2 L27 7 L27 14 L20 19 L13 15 L11 9 Z', steel) + p32('M14 4 L18 8 L17 14 L13 15 L11 9 Z', dark) + l32('M21 2 L21 8 L27 7 M21 8 L20 19'),
    spear: p32('M7 28 L21 9 L23 11 L9 30 Z', wood) + p32('M29 2 L26 14 L20 12 L18 8 Z', steel) + p32('M29 2 L26 14 L23 11 Z', dark),
    pike: p32('M2 31 L23 7 L25 9 L4 32 Z', wood) + p32('M31 0 L29 10 L24 9 L22 5 Z', steel) + p32('M31 0 L29 10 L26 8 Z', dark),
    bow: p32('M6 3 Q28 4 28 26 L25 27 Q23 10 5 6 Z', wood) + l32('M6 5 L27 26 M5 23 L22 7 M18 7 L22 7 L22 12'),
    longbow: p32('M3 2 Q31 2 30 29 L27 30 Q26 6 2 5 Z', wood) + l32('M3 4 L29 29 M4 25 L23 6 M19 6 L23 6 L23 11'),
    crossbow: p32('M4 28 L22 8 L25 11 L8 30 Z', wood) + p32('M4 6 Q20 1 28 23 L25 25 Q18 9 5 10 Z', dark) + l32('M5 9 L26 24 M10 22 L25 7'),
    shield: p32('M5 4 Q16 7 27 4 L26 16 Q23 25 16 29 Q9 25 6 16 Z', blue) + p32('M16 7 L26 5 L25 16 Q23 24 16 28 Z', '#3e6287') + p32('M7 12 L16 7 L25 12 L25 16 L16 12 L7 17 Z', cloth),
    round_shield: e32(16, 16, 13, 13, wood) + l32('M9 5 L9 27 M16 3 L16 29 M23 5 L23 27') + e32(16, 16, 13, 13, 'none') + e32(16, 16, 4, 4, steel),
    helmet: p32('M5 17 Q5 4 16 3 Q27 4 27 17 L25 22 L7 22 Z', steel) + p32('M5 17 L27 17 L27 22 L5 22 Z', dark) + p32('M14 16 L18 16 L18 28 L14 28 Z', steel) + l32('M11 10 Q13 6 17 6'),
    kettle: p32('M8 18 Q8 6 16 6 Q24 6 24 18 Z', steel) + p32('M2 18 Q16 14 30 18 L29 22 Q16 19 3 22 Z', dark) + l32('M12 11 Q14 8 17 8'),
    greathelm: p32('M6 6 Q6 3 16 3 Q26 3 26 6 L26 27 L6 27 Z', steel) + p32('M17 3 Q26 3 26 6 L26 27 L17 27 Z', dark) + p32('M8 13 L24 13 L24 15.5 L8 15.5 Z', '#2f343b') + p32('M15 15.5 L17 15.5 L17 24 L15 24 Z', '#2f343b'),
    tunic: p32('M11 5 L6 7 L2 15 L8 19 L10 15 L9 28 L23 28 L22 15 L24 19 L30 15 L26 7 L21 5 L16 10 Z', blue) + l32('M11 5 L16 12 L21 5 M10 22 L22 22'),
    jerkin: p32('M11 4 L6 6 L7 15 L10 17 L9 28 L23 28 L22 17 L25 15 L26 6 L21 4 L16 10 Z', leather) + l32('M16 10 L16 28 M10 21 L22 21'),
    mail: p32('M10 4 L5 7 L2 15 L8 19 L10 15 L9 28 L23 28 L22 15 L24 19 L30 15 L27 7 L22 4 L16 8 Z', dark) + [0, 1, 2, 3].map((i) => [0, 1, 2].map((j) => e32(12 + j * 4 + (i % 2), 12 + i * 4, 1.35, 1.35, steel)).join('')).join(''),
    boot: p32('M9 3 L18 3 L18 17 L27 22 Q30 24 28 28 L5 28 L5 23 L9 17 Z', leather) + p32('M5 25 L29 25 L28 29 L5 29 Z', '#61452f') + l32('M10 7 L17 7 M10 12 L17 12'),
    glove: p32('M8 29 L6 19 L3 13 Q4 10 7 13 L10 16 L9 5 Q11 2 13 5 L14 13 L15 3 Q18 1 19 4 L19 13 L21 5 Q24 4 24 7 L23 15 L25 10 Q28 10 27 14 L23 24 L22 29 Z', leather) + l32('M8 24 L23 24'),
    horse: p32('M7 28 L8 14 L14 7 L14 2 L18 7 L23 4 L22 10 L29 18 L24 23 L17 20 L18 28 Z', wood) + p32('M7 28 L8 14 L14 7 L16 10 L12 18 L12 28 Z', '#60432f') + e32(21, 13, 1.5, 1.5, C32.ink),
    ring: e32(16, 19, 10, 10, gold) + e32(16, 19, 6.4, 6.4, '#263746') + p32('M10 8 L13 3 L19 3 L22 8 L16 13 Z', '#6fa1ad'),
    quiver: p32('M10 10 L23 10 L20 29 L12 29 Z', leather) + l32('M12 10 L9 2 M17 10 L18 2 M21 10 L25 2') + p32('M9 9 L24 9 L23 13 L10 13 Z', gold),
    grain: p32('M9 29 L22 4 L23 5 L11 29 Z', wood) + [0, 1, 2, 3].map((i) => e32(19 - i * 2, 8 + i * 4, 4, 2.5, gold) + e32(23 - i * 2, 12 + i * 4, 4, 2.5, gold)).join(''),
    salt: p32('M5 27 L4 16 L10 9 L11 4 L21 4 L22 9 L28 16 L27 27 Q16 31 5 27 Z', cloth) + l32('M10 9 L22 9') + e32(16, 18, 5, 3, '#f4f0df'),
    wool: e32(11, 14, 7, 7, cloth) + e32(20, 13, 7, 7, '#eee4cd') + e32(19, 21, 8, 7, cloth) + e32(10, 21, 7, 7, '#f0e5ce'),
    iron: p32('M4 20 L10 8 L25 8 L29 20 L23 26 L5 26 Z', steel) + p32('M4 20 L29 20 L23 26 L5 26 Z', dark),
    cloth: p32('M4 10 L25 5 L29 23 L8 28 Z', red) + p32('M8 28 L4 10 L9 8 L13 26 Z', '#874634') + l32('M12 9 L16 26 M21 7 L25 24'),
    tools: p32('M5 27 L19 11 L22 13 L8 30 Z', wood) + p32('M13 5 L26 3 L29 8 L17 15 L12 11 Z', steel) + p32('M3 14 L7 10 L18 26 L14 29 Z', dark),
    timber: p32('M4 10 L23 4 L28 9 L25 23 L6 29 Z', wood) + e32(6, 20, 5, 9, '#c29760') + e32(6, 20, 2.5, 5, wood) + l32('M12 12 L25 8 M12 19 L26 15'),
    wine: p32('M13 3 L19 3 L19 10 Q26 14 25 24 Q23 29 16 29 Q9 29 7 24 Q6 14 13 10 Z', '#754b56') + p32('M12 3 L20 3 L20 7 L12 7 Z', gold) + p32('M8 17 L24 17 L24 23 L8 23 Z', cloth),
    flour: p32('M5 27 L4 17 L11 8 L10 4 L22 4 L21 8 L28 17 L27 27 Q16 31 5 27 Z', cloth) + l32('M11 8 L21 8 M12 24 L20 24'),
    food_ration: p32('M3 22 Q2 7 16 7 Q30 7 29 22 Q26 28 5 27 Z', '#d3a15e') + l32('M8 12 L12 17 M15 10 L19 16 M22 11 L26 17'),
    medicine: p32('M12 3 L20 3 L20 10 L25 15 L25 28 L7 28 L7 15 L12 10 Z', '#6e9b83') + p32('M11 3 L21 3 L21 7 L11 7 Z', wood) + p32('M9 17 L23 17 L23 25 L9 25 Z', cloth) + p32('M14 18 L18 18 L18 20 L21 20 L21 23 L18 23 L18 25 L14 25 L14 23 L11 23 L11 20 L14 20 Z', red),
  };
  for (const k of ['greatsword', 'greataxe', 'pike', 'longbow', 'round_shield', 'kettle', 'greathelm']) if (!ICONS[k]) ICONS[k] = ICONS[{ greatsword: 'sword', greataxe: 'axe', pike: 'spear', longbow: 'bow', round_shield: 'shield', kettle: 'helmet', greathelm: 'helmet' }[k]];

  /** P11-04: an item's icon: its name in ICONS, and what it shows in words. @param {string} id */
  function itemIcon(id) {
    const it = CL.content.table('items')[id];
    if (!it?.slot) return null;
    const lk = G.fig.itemLook(id);
    // P11-12d: variants by the item's look (a round shield, a kettle hat, a great helm).
    const variant = it.slot === 'offhand' && (lk.shield === 'round' || lk.shield === 'wood') ? 'round_shield' : it.slot === 'head' && lk.helmet === 'kettle' ? 'kettle' : it.slot === 'head' && lk.helmet === 'great' ? 'greathelm' : null;
    const name = variant || (it.slot === 'weapon' ? FAMILY_ICON[it.family] || 'sword' : it.slot === 'body' ? ARMOUR_ICON[lk.armour] || 'tunic' : SLOT_ICON[it.slot]);
    return name ? { name, label: ICON_NAMES[name] } : null;
  }

  /** An icon as SVG markup: its shapes in gold, the one dark outline, a small highlight on the upper left. */
  function iconSvg(name) {
    const parts = ICONS[name];
    if (!parts) return null;
    const body = parts
      .map(([d, fill]) => (fill ? `<path d="${d}" fill="${fill}" stroke="${LINE}" stroke-width="1.3" stroke-linejoin="round"/>` : `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="1.3" stroke-linecap="round"/>`))
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}<path d="M6 6.5 Q7.5 4.8 9.5 4.6" fill="none" stroke="${HI}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/></svg>`;
  }
  const iconUrl = (name) => {
    const svg = iconSvg(name);
    return svg ? `url("data:image/svg+xml,${encodeURIComponent(svg)}")` : null;
  };
  /** P11-12d: an item's or a good's icon in colour (32×32), or null. @param {string} name */
  function colourSvg(name) {
    return COLOUR[name] ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${COLOUR[name]}</svg>` : null;
  }
  const GOODS = ['grain', 'salt', 'wool', 'iron', 'cloth', 'tools', 'timber', 'wine', 'flour', 'food_ration', 'medicine'];
  /**
   * The stylesheet for `.ico-<name>` (installed once at boot, so the icons live in one place): the gold
   * icons of the stats and the HUD; P11-12d: items (`.itemIco`) and trade goods in colour.
   */
  function iconCss() {
    const colour = (n) => `url("data:image/svg+xml,${encodeURIComponent(colourSvg(n))}")`;
    return [
      ...Object.keys(ICONS).map((n) => `.ico-${n}{background-image:${GOODS.includes(n) && COLOUR[n] ? colour(n) : iconUrl(n)}}`),
      ...Object.keys(COLOUR)
        .filter((n) => !GOODS.includes(n))
        .map((n) => `.itemIco.ico-${n}{background-image:${colour(n)}}`),
    ].join('\n');
  }
  function installIcons(doc = root.document) {
    if (!doc || doc.getElementById('artIcons')) return;
    const st = doc.createElement('style');
    st.id = 'artIcons';
    st.textContent = iconCss();
    doc.head.append(st);
  }

  G.ui = { itemIcon, ICON_NAMES, faceOf, portrait, soldierLook, lordLook, speakerLook, heroLook, houseArms, arms, DEVICES, canvas, url, portraitUrl, figure, troopUrl, ICONS, iconSvg, colourSvg, iconCss, installIcons };
})(typeof window !== 'undefined' ? window : globalThis);
