/* Crownless art: the storybook people (P11-12b, D-P11m; first built in P10-G1, D-P10k).
 *
 * One renderer draws every person: soldiers, the hero, companions, lords, townsfolk. A *look* says what
 * they are and wear and carry; a *pose* says what they are doing this frame. Both are plain objects: the
 * look from the data and the real equipment, the pose straight from the battle state (u.face, the swing's
 * phase from CL.profile.attackProgress, u.guard, u.shot, u.flash, mounted).
 *
 * The shapes are the approved character workshop v0.7's (art-reference/storybook-v07/, docs/ART-STYLE.md):
 * full bodies (neck, rounded shoulders, two-segment arms with hands, hips, separate legs and boots), soft
 * heads with tiny features, profiles with one eye, the nose in the outline and no ear, the west view the
 * east one mirrored, and a slightly raised view (the drawing is foreshortened by 0.875, never a position).
 * The body is drawn in v0.7's 100-unit space inside `ctx.scale(K, KY)`; hands, weapons, shields and the
 * horse stay in the rig's own pixels (`weaponArm`, `weaponTip`, `shieldPos`), so the weapon, its tip, the
 * glint and the hand always agree, and the rig is still about 38 px tall at scale 1.
 *
 * Look (all optional):
 *   skin, hair, hairStyle 'short' | 'long' | 'braid' | 'bun' | 'bald' | 'tied', beard (a colour)
 *   tunic, legs, boots, armour 'gambeson' | 'mail' | 'leather' | 'fur' | 'rags', tabard (a realm key)
 *   helmet 'nasal' | 'kettle' | 'great' | 'cap' | 'hood' | 'spangen' | 'crest' | 'plumed' | 'furhat' |
 *     'sallet' | 'bascinet'; hat 'brim' | 'cap' | 'kerchief' | 'coif'; apron, cloak, cloakTrim, plume
 *   shield 'kite' | 'round' | 'heater' | 'wood' | 'pavise', realm (whose colours the shield and tabard wear)
 *   weapon 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'mace' | 'club' | 'hammer' | 'spear' | 'pike' |
 *     'lance' | 'staff' | 'bow' | 'recurve' | 'crossbow' | 'arbalest' | null; quiver, len, twoHanded,
 *     shieldBack, gloves, mount, sig; female, dress (a long dress, townsfolk), scale, crown
 *   features (P11-12b, all from `features(L)`): face { shape, brow, nose, mouth } (a portrait's faceOf),
 *     beardKind 0..3, eyes (a colour)
 * Pose: face 'down' | 'up' | 'left' | 'right', walk (phase, radians), move (0..1), t (seconds),
 *   atk { phase 'windup' | 'active' | 'recovery', k 0..1 }, guard, press, broken, stagger, draw (0..1),
 *   shot (0..1), hit (0..1), mounted, talk (0..1), work, reduced.
 * Coordinates: (x, y) is between the feet on the ground. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, ellipse, rrect, poly, fillLine, fill, tone } = G;

  const SKINS = ['#f1c9a5', '#e2b48c', '#c98f63', '#9c6a45', '#7a4e33'];
  const HAIRS = ['#3b2a20', '#6b4a2e', '#a8743e', '#d9b36a', '#8a8a86', '#2a2421', '#b25a32'];
  const EYES = ['#493427', '#59734e', '#638399', '#8d6b41', '#4a3630'];

  /** The rig's proportions in its own pixels (the anchors the rest of the game knows). */
  const BODY = { head: 6.6, headY: -30.5, shoulder: -21.5, hem: -8.5, hip: -10, width: 6.2, leg: 3.2 };
  /** v0.7's 100-unit person to the rig: 0.45 across, foreshortened by 0.875 for the raised view. */
  const K = 0.45;
  const KY = K * 0.875;
  /** The people's warm outline (v0.7's ink), and its width in v0.7 units. */
  const INK = '#403025';
  const LINE = 2.1;

  /** The storybook horse is drawn a little larger than 5.11's (drawing only), the rider's seat raised to its saddle. */
  const HORSE = 1.14;
  const SEAT = 15;
  const steel = '#b8c2c8';
  const steelDark = '#8a97a1';
  const SHOOTS = ['bow', 'crossbow', 'recurve', 'arbalest'];

  // ---- Paths in v0.7's units ----

  /**
   * A path from SVG-style commands (M L H V Q C Z, absolute or relative), as canvas calls: no Path2D, so
   * Node's counting contexts see the drawing and nothing is parsed twice (static paths are kept parsed).
   */
  const parsed = new Map();
  function parse(d) {
    let ops = parsed.get(d);
    if (ops) return ops;
    ops = [];
    const tok = d.match(/[MLHVQCZmlhvqcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
    let i = 0;
    let cmd = 'M';
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    const num = () => Number(tok[i++]);
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === 'Z') {
        ops.push(['Z']);
        x = sx;
        y = sy;
        continue;
      }
      if (C === 'M' || C === 'L') {
        const nx = num() + (rel ? x : 0);
        const ny = num() + (rel ? y : 0);
        ops.push([C === 'M' ? 'M' : 'L', nx, ny]);
        [x, y] = [nx, ny];
        if (C === 'M') {
          [sx, sy] = [x, y];
          cmd = rel ? 'l' : 'L';
        }
      } else if (C === 'H') {
        x = num() + (rel ? x : 0);
        ops.push(['L', x, y]);
      } else if (C === 'V') {
        y = num() + (rel ? y : 0);
        ops.push(['L', x, y]);
      } else if (C === 'Q') {
        const a = [num(), num(), num(), num()];
        if (rel) [a[0], a[1], a[2], a[3]] = [a[0] + x, a[1] + y, a[2] + x, a[3] + y];
        ops.push(['Q', ...a]);
        [x, y] = [a[2], a[3]];
      } else if (C === 'C') {
        const a = [num(), num(), num(), num(), num(), num()];
        if (rel) for (let j = 0; j < 6; j++) a[j] += j % 2 ? y : x;
        ops.push(['C', ...a]);
        [x, y] = [a[4], a[5]];
      } else i++;
    }
    if (parsed.size < 4000) parsed.set(d, ops);
    return ops;
  }
  function trace(ctx, d) {
    ctx.beginPath();
    for (const o of parse(d)) {
      if (o[0] === 'M') ctx.moveTo(o[1], o[2]);
      else if (o[0] === 'L') ctx.lineTo(o[1], o[2]);
      else if (o[0] === 'Q') ctx.quadraticCurveTo(o[1], o[2], o[3], o[4]);
      else if (o[0] === 'C') ctx.bezierCurveTo(o[1], o[2], o[3], o[4], o[5], o[6]);
      else ctx.closePath();
    }
  }
  /** Fill a path and outline it in the people's ink (`w` 0: no outline). */
  function sh(ctx, d, color, w = LINE, ink = INK) {
    trace(ctx, d);
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (w) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  /** A line along a path (detail: a seam, a brow, a mouth). */
  function ln(ctx, d, color = INK, w = 1.4) {
    trace(ctx, d);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function ov(ctx, x, y, rx, ry, color, w = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (w) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }
  /** Draw `fn` in v0.7's space (the body), inside the rig's pixels. */
  function storybook(ctx, fn) {
    ctx.save();
    ctx.scale(K, KY);
    fn();
    ctx.restore();
  }
  const toV = (x, y) => [x / K, y / KY]; // rig pixels → v0.7 units

  // ---- Who a person is: their features (one function for the body and the portrait) ----

  /** A stable number from anything (FNV-1a), for seeded features. */
  function num(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  /**
   * What a face is made of, by kind: its shape (0 round, 1 long, 2 broad), brows (0 straight, 1 arched,
   * 2 heavy), nose (0 straight, 1 broad, 2 hooked) and mouth (0 level, 1 wide, 2 small). (P10-G5's; the
   * portraits' and now the figures'.)
   */
  function faceOf(seed, shape) {
    const n = num(seed);
    return { shape: shape ?? n % 3, brow: (n >>> 3) % 3, nose: (n >>> 6) % 3, mouth: (n >>> 9) % 3 };
  }
  const featureCache = new WeakMap();
  /**
   * A person's features from their look: the face (the look's own `face`, else one from its seed), the eye
   * colour, the beard's kind (0 none, 1 stubble, 2 short with a moustache, 3 full; a woman's always 0) and
   * colour. The body in every view, the portrait and the creator all read this, so they agree.
   */
  function features(L) {
    let F = featureCache.get(L);
    if (F) return F;
    const seed = L.seed ?? 1;
    const f = L.face && typeof L.face === 'object' ? L.face : faceOf(`p|${seed}`);
    const n = num(`f|${seed}`);
    const hair = L.hair || HAIRS[0];
    const beardKind = L.female ? 0 : (L.beardKind ?? (L.beard ? 2 + (n % 2) : 0));
    F = {
      shape: ['round', 'oval', 'broad'][f.shape % 3],
      brow: ['stern', 'soft', 'heavy'][f.brow % 3],
      nose: ['button', 'broad', 'long'][f.nose % 3],
      mouth: ['smile', 'smile', 'neutral'][f.mouth % 3],
      eyes: L.eyes || EYES[n % EYES.length],
      beardKind,
      moustache: beardKind >= 2 || (beardKind === 0 && !L.female && Boolean(L.beard) && n % 5 === 0),
      beard: typeof L.beard === 'string' ? L.beard : tone(hair, -0.1),
      old: L.hair === '#d8d4cc' || L.hair === '#8a8a86' || L.old,
    };
    if (L && typeof L === 'object') featureCache.set(L, F);
    return F;
  }

  // ---- Heads (v0.7 units: the head's centre at (0, -78)) ----

  const HIDES_HAIR = ['great', 'hood', 'furhat', 'bascinet', 'sallet', 'nasal', 'kettle', 'plumed', 'crest', 'spangen', 'cap'];
  const covered = (L) => HIDES_HAIR.includes(L.helmet) || L.hat === 'coif' || L.hat === 'brim' || L.hat === 'cap' || L.hat === 'kerchief';
  const longHair = (L) => ['long', 'braid', 'bun', 'tied'].includes(L.hairStyle);
  /** Long hair, braids and buns still show under an open helm; a closed one hides them. */
  const hairShows = (L) => !['great', 'hood', 'furhat', 'bascinet', 'sallet'].includes(L.helmet) && L.hat !== 'coif';
  const widthOf = (F) => (F.shape === 'broad' ? 2 : F.shape === 'oval' ? -1 : 0);

  /** The head seen from the front (`face` 'down') or the back ('up'). */
  function headFront(ctx, L, F, back, P) {
    const wide = widthOf(F);
    const rx = 12 + wide;
    const skin = L.skin || SKINS[1];
    const hair = L.hair || HAIRS[0];
    // Hair at the back frames the face (long, braid, bun, tied), never a cap-shaped shell.
    if (longHair(L) && hairShows(L) && !back) {
      sh(ctx, 'M-12 -89 Q-17 -82 -14 -67 Q-10 -62 -6 -65 L9 -64 Q16 -65 15 -77 Q16 -87 9 -91 Q0 -96 -12 -89Z', hair);
      if (L.hairStyle === 'long') sh(ctx, 'M-12 -77 Q-18 -68 -14 -52 Q-9 -50 -5 -56 L8 -57 Q15 -50 17 -56 L13 -80Z', hair);
    }
    if (back) {
      // The back of the head: skin under, then the hair over it (or a bare crown).
      sh(ctx, `M${-rx} -80 Q${-rx} -93 0 -93 Q${rx} -93 ${rx} -80 Q${rx - 1} -68 0 -66 Q${-rx + 1} -68 ${-rx} -80Z`, skin);
      if (L.hairStyle !== 'bald' && !covered(L)) {
        sh(ctx, `M${-rx - 0.5} -81 Q-14 -95 0 -95 Q14 -95 ${rx + 0.5} -81 L${rx - 1} -71 Q0 -64 ${-rx + 1} -71Z`, hair);
        ln(ctx, 'M-8 -88 Q-2 -92 5 -90', tone(hair, 0.2), 1.4);
      }
      if (hairShows(L) && L.hairStyle === 'braid') sh(ctx, 'M-2.5 -70 Q-4 -62 -2 -54 L2 -54 Q4 -62 2.5 -70Z', hair, 1.4);
      if (hairShows(L) && L.hairStyle === 'long') sh(ctx, `M${-rx + 1} -74 Q${-rx - 1} -60 -8 -54 L8 -54 Q${rx + 1} -60 ${rx - 1} -74Z`, hair);
      if (hairShows(L) && L.hairStyle === 'tied') sh(ctx, 'M-2 -72 Q-3 -64 0 -60 Q3 -64 2 -72Z', hair, 1.3);
      if (hairShows(L) && L.hairStyle === 'bun') ov(ctx, 0, -90, 6, 5, hair, 1.8);
      return;
    }
    // Small ears tucked behind the jaw (the front only; never in profile).
    ov(ctx, -rx + 1, -76, 3, 4.4, skin, 1.2);
    ov(ctx, rx - 1, -76, 2.7, 4.2, tone(skin, -0.06), 1.2);
    // A soft tapered jaw.
    sh(ctx, `M${-rx} -83 Q${-rx} -91 0 -92 Q${rx} -91 ${rx} -82 L${rx} -77 Q${rx - 2} -67 1 -65 Q${-rx + 2} -66 ${-rx} -75Z`, skin);
    sh(ctx, `M${rx - 3} -82 Q${rx} -72 1 -66 Q8 -68 ${rx - 1} -74Z`, tone(skin, -0.13), 0);
    if (F.old) ln(ctx, 'M-9 -74 l2 1 M7 -74 l2 -1', tone(skin, -0.28), 0.9);
    // The beard under the features: a shape around the jaw.
    if (F.beardKind === 1) {
      ctx.globalAlpha = 0.4;
      sh(ctx, `M${-rx + 1} -76 Q-8 -66 0 -65 Q8 -66 ${rx - 1} -76 L${rx - 2} -71 Q0 -68 ${-rx + 2} -71Z`, F.beard, 0);
      ctx.globalAlpha = 1;
    } else if (F.beardKind >= 2) {
      const low = F.beardKind === 3 ? -59 : -63;
      sh(ctx, `M${-rx + 1} -76 Q-8 -73 -5 -72 Q0 -75 5 -72 Q9 -73 ${rx - 1} -76 L${rx - 2} -69 Q2 ${low} -8 -67Z`, F.beard, 1.35);
    }
    // Eyes: a dark iris of the eye colour with a catch-light; the blink shuts them.
    const blink = P && !P.reduced && Math.sin((P.t || 0) * 1.3 + (L.seed || 0)) > 0.985;
    for (const ex of [-5, 5.2]) {
      if (blink) ln(ctx, `M${ex - 1.5} -78 h3`, INK, 1.3);
      else {
        ov(ctx, ex, -78, 1.45, 1.9, F.eyes);
        ov(ctx, ex - 0.4, -78.6, 0.45, 0.55, '#fff2da');
      }
    }
    const browC = tone(hair, -0.12);
    if (F.brow === 'stern') ln(ctx, 'M-8 -82 L-3 -81 M3 -81 L8 -82', browC, 1.3);
    else if (F.brow === 'heavy') ln(ctx, 'M-8.5 -82.5 L-2.5 -81.3 M2.5 -81.3 L8.5 -82.5', browC, 2);
    else ln(ctx, 'M-8 -82 Q-5 -83.5 -2.5 -82 M2.8 -82 Q5.5 -83.4 8 -82', browC, 1.25);
    const nose = F.nose === 'long' ? 'M.5 -77 Q-.3 -73 2 -72' : F.nose === 'broad' ? 'M-1.5 -74 Q0 -71 2 -74' : 'M0 -75 Q1.6 -74 .5 -73';
    ln(ctx, nose, tone(skin, -0.35), 1.15);
    if (F.moustache) sh(ctx, 'M-6 -71 Q-3 -74 0 -71.8 Q3 -74 6 -71 Q3 -69.5 0 -71 Q-3 -69.5 -6 -71Z', F.beard, 0.65);
    const speak = P?.talk || L.talk || 0;
    if (speak > 0.15) ov(ctx, 0, -69.6, 2.1, 0.6 + speak * 1.9, '#70412f');
    else if (!(F.beardKind === 3)) {
      const m = F.mouth === 'neutral' ? 'M-2.7 -69.2 L2.7 -69.2' : 'M-2.7 -70 Q0 -67.5 2.7 -70';
      ln(ctx, m, '#70412f', 1.15);
    }
    // The hair over the brow (none under a helm or a hat that hides it).
    if (L.hairStyle !== 'bald' && !covered(L)) {
      sh(ctx, 'M-13 -79 Q-17 -84 -10 -91 Q-11 -94 -6 -94 Q1 -98 9 -93 Q16 -92 15 -85 L11 -79 L9 -85 Q5 -81 2 -86 Q-2 -82 -5 -86 Q-9 -81 -10 -77Z', hair);
      ln(ctx, 'M-9 -90 Q-3 -94 4 -92', tone(hair, 0.23), 1.2);
      if (L.hairStyle === 'bun') ov(ctx, 6, -94, 6.3, 5.3, hair, 1.8);
      if (L.hairStyle === 'braid') {
        sh(ctx, 'M10 -70 Q16 -68 13 -63 Q17 -59 13 -54 L9 -56 Q11 -60 9 -64Z', hair, 1.3);
        ln(ctx, 'M10 -61 l4 2', PAL.gold, 1.7);
      }
    }
  }

  /** The head in profile, facing east (+x): one eye, the nose in the outline, no ear. */
  function headSide(ctx, L, F, P) {
    const wide = F.shape === 'broad' ? 1.5 : F.shape === 'oval' ? -1 : 0;
    const rear = -13 - wide;
    const front = 10 + wide * 0.3;
    const jaw = F.shape === 'broad' ? 5 : 3.5;
    const tip = front + (F.nose === 'long' ? 5.8 : F.nose === 'broad' ? 4.5 : 3.1);
    const skin = L.skin || SKINS[1];
    const hair = L.hair || HAIRS[0];
    const cov = covered(L);
    if (longHair(L) && hairShows(L)) {
      if (L.hairStyle === 'bun') ov(ctx, rear - 2, -87, 6.2, 5.7, hair, 1.5);
      if (L.hairStyle === 'long') sh(ctx, `M${rear} -88 Q-19 -79 -15 -65 Q-18 -53 -7 -55 L-2 -76Z`, hair);
      if (L.hairStyle === 'tied') sh(ctx, `M${rear} -82 Q-20 -76 -17 -66 Q-14 -64 -12 -68 L-9 -79Z`, hair, 1.4);
      if (L.hairStyle === 'braid') {
        sh(ctx, `M${rear} -81 Q-18 -73 -13 -69 Q-17 -65 -11 -61 Q-15 -56 -10 -52 L-6 -55 Q-8 -61 -7 -66 L-8 -79Z`, hair, 1.4);
        ln(ctx, 'M-13 -67 l5 2 M-12 -60 l4 2 M-12 -55 l5 1', tone(hair, 0.25), 1.2);
      }
    }
    const outline = `M${rear} -79 Q${rear - 1} -91 -3 -93 Q6 -96 ${front - 1} -88 Q${front + 1} -85 ${front} -81 Q${front - 0.6} -79 ${tip} -75.5 Q${tip + 0.4} -74 ${front + 1} -73.6 L${front + 0.3} -71.5 Q${front + 2.1} -70.5 ${front + 0.2} -69.4 Q${front + 1.1} -68 ${front - 1} -66 Q${jaw} -63 -3 -66 Q${rear + 2} -69 ${rear} -79Z`;
    sh(ctx, outline, skin);
    sh(ctx, `M-9 -76 Q-6 -69 ${front - 1} -66 Q${jaw} -63 -3 -66 Q${rear + 2} -69 ${rear} -79Z`, tone(skin, -0.13), 0);
    if (L.hairStyle !== 'bald' && !cov) {
      sh(ctx, `M${rear} -74 Q${rear - 4} -82 ${rear} -89 Q-10 -96 0 -96 Q9 -97 ${front + 1} -88 L${front - 1} -84 Q6 -88 1 -89 Q-2 -84 -5 -83 L-7 -77 L-10 -76 L-11 -70 Q${rear - 1} -71 ${rear} -74Z`, hair);
      ln(ctx, 'M-11 -89 Q-6 -94 2 -93', tone(hair, 0.24), 1.3);
    }
    // No ear in profile (the approved v0.7 correction): a clean hair-and-jaw silhouette.
    const ex = front - 4.8;
    const browC = tone(hair, -0.12);
    ln(ctx, F.brow === 'stern' || F.brow === 'heavy' ? `M${ex - 3} -83 L${ex + 2.5} -81.8` : `M${ex - 3} -82.3 Q${ex} -84 ${ex + 2.4} -82`, browC, F.brow === 'heavy' ? 2 : 1.4);
    const blink = P && !P.reduced && Math.sin((P.t || 0) * 1.3 + (L.seed || 0)) > 0.985;
    if (blink) ln(ctx, `M${ex - 1.8} -78.5 q1.7 .7 3.5 0`, INK, 1.2);
    else {
      ov(ctx, ex + 0.1, -78.5, 1.9, 1.55, '#fff0d6', 0.65);
      ov(ctx, ex + 0.75, -78.5, 0.95, 1.3, F.eyes);
    }
    ln(ctx, `M${front + 0.1} -74.9 q1.2 .25 1.9 -.35`, tone(skin, -0.34), 0.95);
    if (F.beardKind === 1) {
      ctx.globalAlpha = 0.4;
      sh(ctx, `M-7 -74 Q-3 -70 ${front - 1} -66 Q${jaw} -63 -3 -66Z`, F.beard, 0);
      ctx.globalAlpha = 1;
    } else if (F.beardKind >= 2) {
      const low = F.beardKind === 3 ? -60 : -64;
      sh(ctx, `M-7 -74 Q-3 -72 0 -69 Q4 -67 ${front - 2} -70 L${front + 0.2} -69 Q${front + 2} -63 ${front - 2} ${low} Q1 ${low + 1} -5 -67Z`, F.beard, 1.25);
    }
    if (F.moustache) sh(ctx, `M${front - 6} -71.5 Q${front - 3} -74 ${front + 0.5} -72.7 Q${front + 2} -70.5 ${front - 0.3} -70.3 Q${front - 3} -71.3 ${front - 6} -70Z`, F.beard, 0.75);
    const mx = front - 2.1;
    const speak = P?.talk || L.talk || 0;
    if (speak > 0.15) ov(ctx, mx, -69.5, 1.6, 0.6 + speak * 1.25, '#70412f');
    else if (F.beardKind !== 3) ln(ctx, F.mouth === 'neutral' ? `M${mx - 2} -69.7 L${front + 0.1} -69.7` : `M${mx - 2} -70 Q${mx} -68.8 ${front + 0.1} -69.5`, '#70412f', 1);
    if (F.old) ln(ctx, `M${ex - 3} -76 l1.6 .6 M${ex - 4} -74 l1.5 .4`, tone(skin, -0.26), 0.85);
    return { rear, front };
  }

  /** Helmets and hats in a view: 'front', 'back' or 'side' (east; west is mirrored with the body). */
  function headgear(ctx, L, F, view, t) {
    const k = L.helmet || null;
    const hat = k ? null : L.hat || null;
    const side = view === 'side';
    const back = view === 'back';
    const rear = side ? -13 - (F.shape === 'broad' ? 1.5 : 0) : -14;
    const front = side ? 10 : 14;
    const dome = (pointed) =>
      side
        ? pointed
          ? `M${rear - 1} -82 Q-13 -93 -3 -102 Q8 -97 ${front + 3} -83Z`
          : `M${rear - 2} -83 Q-13 -99 -2 -100 Q10 -100 ${front + 2} -83Z`
        : pointed
          ? 'M-14.5 -81 Q-13 -92 0 -102 Q12 -92 14.5 -81Z'
          : 'M-14 -82 Q-13 -98 0 -99 Q13 -98 14 -82Z';
    const rim = side ? `M${rear - 2} -84 Q-1 -86 ${front + 4} -83 L${front + 3} -79 L${rear - 2} -80Z` : 'M-15.5 -84 Q0 -86 15.5 -84 L15 -79.5 Q0 -81 -15 -79.5Z';
    const shine = side ? 'M-6 -96 Q-2 -99 3 -97' : 'M-8 -91 Q-4 -96 1 -97';
    const metalShade = side ? `M-3 -100 Q-12 -92 ${rear - 1} -83 L-6 -83 Q-7 -92 -3 -100Z` : 'M0 -99 Q11 -93 14 -82 L7 -82Z';
    if (k === 'nasal' || k === 'plumed' || k === 'crest' || k === 'spangen') {
      sh(ctx, dome(k !== 'spangen'), steel);
      sh(ctx, metalShade, steelDark, 0);
      ln(ctx, shine, '#eef2f2', 1.6);
      sh(ctx, rim, '#c9d0d2', 1.6);
      if (k === 'spangen') {
        ln(ctx, side ? 'M-3 -100 L-3 -84' : 'M0 -99 L0 -84', PAL.gold, 2.2);
        if (!back) sh(ctx, side ? 'M-2 -80 L4 -80 L3 -70 L-1 -71Z' : 'M-14 -80 L-9 -80 L-10 -70 L-13 -71Z M14 -80 L9 -80 L10 -70 L13 -71Z', steelDark, 1.2);
      } else if (!back) sh(ctx, side ? `M${front + 1} -82 L${front + 4} -82 L${front + 4} -74 Q${front + 2} -72 ${front + 1} -74Z` : 'M-1.6 -81 h3.2 v7 q-1.6 2 -3.2 0Z', steel, 1);
      if (k === 'plumed' || k === 'crest') {
        const wave = Math.sin(t * 4) * 1.6;
        const color = L.plume || PAL.crimson;
        if (k === 'crest' && !side) sh(ctx, 'M-2.5 -101 Q0 -110 2.5 -101 L2 -97 L-2 -97Z', color, 1.4);
        else sh(ctx, side || back ? `M-2 -100 Q${-12 + wave} -112 ${-22 + wave} -100 Q-12 -103 -2 -97Z` : `M-1 -101 Q${8 + wave} -113 ${19 + wave} -101 Q9 -104 1 -97Z`, color, 1.5);
      }
      return;
    }
    if (k === 'kettle') {
      sh(ctx, dome(false), steel);
      sh(ctx, metalShade, steelDark, 0);
      ln(ctx, shine, '#eef2f2', 1.6);
      sh(ctx, side ? `M${rear - 6} -84 Q-1 -88 ${front + 9} -83 L${front + 7} -79 L${rear - 6} -80Z` : 'M-20 -83.5 Q0 -88 20 -83.5 L19 -79 Q0 -82 -19 -79Z', '#c9d0d2', 1.6);
      return;
    }
    if (k === 'bascinet') {
      // A pointed skull over the ears, an open face, a mail aventail at the neck.
      sh(ctx, side ? `M${rear - 2} -66 Q${rear - 4} -76 ${rear} -82 L${front - 2} -80 L${front - 3} -68 Q0 -60 ${rear - 2} -66Z` : 'M-15 -66 Q-17 -76 -14 -82 L14 -82 Q17 -76 15 -66 Q0 -58 -15 -66Z', '#9aa3ab');
      ln(ctx, side ? `M${rear} -72 Q-2 -66 ${front - 4} -70` : 'M-13 -72 Q0 -66 13 -72', tone('#9aa3ab', -0.2), 1);
      sh(ctx, side ? `M${rear - 1} -78 Q-12 -95 -1 -104 Q7 -94 ${front + 2} -80Z` : 'M-14.5 -78 Q-14 -94 0 -104 Q14 -94 14.5 -78Z', steel);
      sh(ctx, metalShade, steelDark, 0);
      ln(ctx, shine, '#eef2f2', 1.6);
      if (!back && !side) sh(ctx, 'M-9 -82 Q0 -85 9 -82 L9 -79 L-9 -79Z', steelDark, 0);
      return;
    }
    if (k === 'sallet') {
      sh(ctx, side ? `M${rear - 6} -76 Q${rear - 3} -80 ${rear - 1} -86 Q-10 -100 0 -100 Q10 -99 ${front + 3} -84 L${front + 3} -78 L${rear + 4} -80Z` : back ? 'M-15 -76 Q-17 -98 0 -99 Q17 -98 15 -76 Q0 -73 -15 -76Z' : 'M-15 -82 Q-15 -98 0 -99 Q15 -98 15 -82 L14 -77 L-14 -77Z', steel);
      sh(ctx, metalShade, steelDark, 0);
      ln(ctx, shine, '#eef2f2', 1.6);
      if (!back) ln(ctx, side ? `M${front - 6} -81 L${front + 2} -81` : 'M-10 -81 L10 -81', '#2c3138', 1.8);
      return;
    }
    if (k === 'great') {
      sh(ctx, side ? `M${rear - 1} -66 L${rear - 1} -92 Q${rear} -100 -2 -101 Q${front + 2} -100 ${front + 3} -92 L${front + 3} -66 Q0 -63 ${rear - 1} -66Z` : 'M-15 -66 L-15 -92 Q-15 -101 0 -101 Q15 -101 15 -92 L15 -66 Q0 -63 -15 -66Z', steel);
      sh(ctx, side ? `M${rear - 1} -92 L${rear - 1} -66 Q-6 -64 -6 -64 L-6 -100 Q${rear} -100 ${rear - 1} -92Z` : 'M6 -100 Q15 -100 15 -92 L15 -66 Q10 -64 6 -64Z', steelDark, 0);
      if (!back) {
        ln(ctx, side ? `M${front - 7} -82 L${front + 3} -82` : 'M-11 -82 L11 -82', '#2c3138', 2.2);
        ln(ctx, side ? `M${front - 1} -82 L${front - 1} -70` : 'M0 -82 L0 -70', INK, 1.3);
        for (const dy of [-76, -72]) ov(ctx, side ? front - 3 : 5, dy, 0.8, 0.8, '#2c3138');
      }
      return;
    }
    if (k === 'hood' || hat === 'coif') {
      const c = k === 'hood' ? L.hoodColor || '#6c6a4a' : '#efe6d2';
      if (back) sh(ctx, 'M-15 -68 Q-20 -90 0 -99 Q20 -90 15 -68 Q8 -62 0 -60 Q-8 -62 -15 -68Z', c);
      else if (side) sh(ctx, `M${rear - 4} -66 Q${rear - 8} -85 -6 -98 Q5 -103 ${front + 3} -86 L${front} -82 Q3 -93 -4 -90 Q-11 -83 -7 -72 L-3 -65Z`, c);
      else sh(ctx, 'M-15 -68 Q-21 -89 0 -99 Q20 -89 15 -68 L10 -69 Q15 -88 0 -91 Q-15 -88 -10 -69Z', c);
      if (k === 'hood') {
        // The hood's short cape over the shoulders, and its fold round the face.
        sh(ctx, side ? `M${rear - 3} -67 Q${rear - 6} -58 -8 -55 Q4 -53 9 -57 Q6 -63 -2 -65Z` : 'M-15 -68 Q-21 -60 -18 -55 Q0 -50 18 -55 Q21 -60 15 -68 Q0 -62 -15 -68Z', c, 1.4);
        if (back) sh(ctx, 'M-4 -64 Q0 -54 4 -64Z', c, 1.4);
        else ln(ctx, side ? `M${front - 1} -82 Q2 -91 -5 -88` : 'M-10 -70 Q-14 -86 0 -90 Q14 -86 10 -70', tone(c, -0.2), 1.2);
      } else if (back) {
        // The coif from behind: its seam and the knot of its tie.
        ln(ctx, 'M0 -98 Q-1 -84 0 -70', tone(c, -0.15), 1.1);
        sh(ctx, 'M-3 -67 Q0 -61 3 -67 Q0 -69 -3 -67Z', c, 1.2);
      } else {
        // The coif: its fold round the face and the tie under the chin.
        ln(ctx, side ? `M${front - 1} -82 Q2 -91 -5 -88` : 'M-10 -70 Q-14 -86 0 -90 Q14 -86 10 -70', tone(c, -0.15), 1.1);
        ln(ctx, side ? `M-6 -66 Q0 -63 ${front - 2} -66` : 'M-10 -69 Q0 -61 10 -69', tone(c, -0.12), 1.6);
      }
      return;
    }
    if (k === 'furhat') {
      const c = '#8a6a48';
      sh(ctx, side ? `M${rear - 1} -82 Q${rear - 2} -98 -2 -100 Q10 -99 ${front + 2} -82Z` : 'M-15 -82 Q-15 -99 0 -100 Q15 -99 15 -82Z', c);
      for (let i = -2; i <= 2; i++) ov(ctx, (side ? -2 : 0) + i * 6, -84 + Math.abs(i) * 0.6, 4.2, 3.4, tone(c, 0.18), 1.2);
      return;
    }
    if (k === 'cap' || hat === 'cap' || hat === 'brim') {
      const c = k === 'cap' ? L.capColor || '#8a5f3c' : hat === 'brim' ? L.hatColor || '#7d6a48' : L.capColor || L.hatColor || '#9e4b38';
      if (side) {
        sh(ctx, `M${rear - 1} -84 Q${rear - 2} -96 -2 -99 Q9 -99 ${front + 2} -87 L${front + 2} -84Z`, c);
        sh(ctx, hat === 'brim' ? `M${rear - 4} -85 Q0 -89 ${front + 8} -84 Q${front + 8} -81 ${front + 3} -81 L${rear - 3} -82Z` : `M${rear - 2} -85 Q0 -88 ${front + 3} -85 L${front + 3} -82 Q-1 -85 ${rear - 2} -82Z`, tone(c, -0.15));
        ln(ctx, 'M-9 -94 Q-3 -98 3 -96', tone(c, 0.23), 1.3);
      } else {
        sh(ctx, 'M-13 -83 Q-15 -96 -2 -98 Q10 -99 14 -87 L14 -83Z', c);
        sh(ctx, hat === 'brim' ? 'M-18 -84 Q0 -89 18 -84 Q17 -80 0 -80 Q-16 -80 -18 -84Z' : 'M-14 -84 Q0 -89 15 -84 L15 -81 Q0 -85 -14 -81Z', tone(c, -0.18));
        ln(ctx, 'M-7 -94 Q0 -97 6 -94', tone(c, 0.22), 1.4);
      }
      if (hat === 'brim' && L.band) ln(ctx, side ? `M${rear} -86 Q0 -89 ${front + 1} -86` : 'M-13 -86 Q0 -89 13 -86', L.band, 1.8);
      return;
    }
    if (hat === 'kerchief') {
      const c = L.hatColor || '#c0573f';
      if (side) {
        sh(ctx, `M${rear - 1} -76 Q${rear - 5} -91 -2 -96 Q8 -97 ${front + 1} -87 L${front - 1} -83 Q-1 -88 -7 -84 L-10 -76Z`, c);
        sh(ctx, `M${rear} -79 l-7 10 6 -2 3 -7Z`, c, 1.4);
      } else if (back) {
        sh(ctx, 'M-14 -79 Q-18 -94 0 -95 Q18 -94 14 -79 Q0 -76 -14 -79Z', c);
        sh(ctx, 'M-3 -78 L0 -68 L3 -78Z', c, 1.4);
      } else {
        sh(ctx, 'M-14 -79 Q-18 -92 0 -95 Q16 -94 15 -80 L11 -84 Q0 -89 -11 -84Z', c);
        sh(ctx, 'M11 -82 l7 12 -7 -3 -3 -7Z', c, 1.4);
      }
    }
  }

  /** A ruler's circlet over whatever the head wears. */
  function crown(ctx, view) {
    if (view === 'side') sh(ctx, 'M-14 -88 L-13 -97 L-8 -92 L-3 -99 L2 -92 L7 -97 L9 -88 Q-2 -86 -14 -88Z', PAL.gold, 1.3);
    else sh(ctx, 'M-13 -88 L-14 -98 L-7 -93 L0 -101 L7 -93 L14 -98 L13 -88 Q0 -86 -13 -88Z', PAL.gold, 1.3);
  }

  /** P11-12c (owner, 2026-11-27): the head sits a little higher, on a neck that shows. */
  const NECK = 3.5;
  function head(ctx, L, F, face, P) {
    const view = face === 'up' ? 'back' : face === 'down' ? 'front' : 'side';
    ctx.save();
    ctx.translate(0, -NECK);
    if (view === 'side') headSide(ctx, L, F, P);
    else headFront(ctx, L, F, view === 'back', P);
    headgear(ctx, L, F, view, P.t || 0);
    if (L.crown) crown(ctx, view);
    ctx.restore();
  }

  /**
   * The neck (owner, 2026-11-27: "no necks"): skin from under the jaw down into the collar, shaded on
   * the right, in every view; drawn before the torso so the collar laps over it. A closed helm's mail
   * or a hood hides it as before.
   */
  function neck(ctx, L, face) {
    const skin = L.skin || SKINS[1];
    const side = face === 'left' || face === 'right';
    const x = side ? -1.5 : 0;
    sh(ctx, `M${x - 4.6} -72 L${x + 4.6} -72 L${x + 5.4} -59 Q${x} -56 ${x - 5.4} -59Z`, face === 'up' ? tone(skin, -0.04) : skin, 1.6);
    sh(ctx, `M${x + 1.6} -72 L${x + 4.6} -72 L${x + 5.4} -59 L${x + 2} -58Z`, tone(skin, -0.14), 0);
    if (face === 'down') ln(ctx, `M${x - 3} -66 Q${x} -64.5 ${x + 3} -66`, tone(skin, -0.22), 0.9);
  }

  // ---- Bodies (v0.7 units) ----

  /** The clothes' colours: the coat (tunic, armour, a tabard over mail), the sleeves, the trim. */
  function clothes(L) {
    const R = L.tabard ? G.realm(L.tabard) : null;
    const tunic = L.tunic || '#9c8a66';
    const a = L.armour || null;
    const mail = '#9aa3ab';
    const coat = R && (a === 'mail' || a === 'gambeson' || !a || a === 'leather') ? R.color : a === 'mail' ? mail : a === 'leather' ? '#8a6240' : a === 'gambeson' ? L.tunic || '#c8b48a' : a === 'fur' ? tone(tunic, -0.05) : tunic;
    const sleeve = a === 'mail' ? mail : L.sleeves || (a === 'leather' ? tone(tunic, -0.08) : a === 'gambeson' ? L.tunic || '#c8b48a' : coat === tunic ? tunic : tone(tunic, -0.05));
    return { R, coat, sleeve, a, trim: R ? R.trim : tone(coat, 0.35) };
  }

  /** Legs and boots, front or back view, with the stride; seated on a horse when mounted. */
  function legsFront(ctx, L, P, _coat, dress) {
    const legC = L.legs || '#6b5a46';
    const boot = L.boots || '#4a3628';
    if (P.mounted) {
      for (const x of [-14, 14]) {
        if (!dress) sh(ctx, `M${x * 0.5 - 5} -28 L${x * 0.5 + 5} -28 L${x + 4} -14 L${x + 3} -6 L${x - 3} -6 L${x - 4} -14Z`, tone(legC, x < 0 ? 0 : -0.1));
        sh(ctx, `M${x - 4} -8 L${x + 4} -8 L${x + 4.5} 0 L${x - 4.5} 0Z`, boot);
      }
      return;
    }
    const gait = Math.min(1, P.move || 0);
    const w = P.walk || 0;
    for (const [x, k] of [[-7, -1], [7, 1]]) {
      const step = Math.sin(w) * k * gait;
      const lift = Math.max(0, Math.cos(w) * k) * gait;
      const dx = step * 2.8;
      const dy = step * 4 - lift * 3;
      const fx = x + dx;
      const fy = dy;
      const kx = x + dx * 0.46;
      const ky = -15 + dy * 0.42;
      if (!dress) sh(ctx, `M${x - 5} -28 L${x + 5} -28 L${kx + 4.6} ${ky} L${fx + 4} ${fy - 8} Q${fx} ${fy - 5} ${fx - 4} ${fy - 8} L${kx - 4.6} ${ky}Z`, x > 0 ? tone(legC, -0.12) : legC);
      ctx.save();
      ctx.translate(fx, fy);
      sh(ctx, 'M-4.8 -13 Q0 -11 4.5 -13 L5 -5 Q9 -2 6 0 L-5 0 Q-7 -1 -5 -5Z', boot);
      ln(ctx, 'M-3 -11 l5 0', tone(boot, 0.2), 1.2);
      ctx.restore();
    }
  }

  /** Legs in profile (east): separate near and far tracks; the far foot higher on the screen. */
  function legSide(ctx, L, P, near, dress) {
    const legC = L.legs || '#6b5a46';
    const boot = L.boots || '#4a3628';
    if (P.mounted) {
      if (!near) return;
      if (!dress) sh(ctx, 'M-6 -29 L5 -30 Q12 -29 12 -24 L10 -10 L4 -10 L4 -22 L-5 -21Z', legC);
      sh(ctx, 'M3 -12 L11 -12 L11 -4 Q17 -3 16 0 L3 0Z', boot);
      return;
    }
    const w = P.walk || 0;
    const m = Math.min(1, P.move || 0);
    const run = m > 0.9;
    const stride = Math.sin(w) * m * (run ? 15 : 11);
    const k = near ? 1 : -1;
    const x = near ? -2 : 3;
    const depth = near ? 2 : -4;
    const dx = k * stride;
    const lift = Math.max(0, k * Math.cos(w)) * m * (run ? 7 : 5);
    const fx = x + dx;
    const fy = depth - lift;
    const midx = x + dx * 0.48;
    const midy = -15 + fy * 0.35;
    if (!dress) sh(ctx, `M${x - 4.7} -29 L${x + 4.5} -29 Q${midx + 5} -20 ${midx + 4.1} ${midy} L${fx + 3.6} ${fy - 7} L${fx - 4} ${fy - 7} L${midx - 4.7} ${midy}Z`, near ? legC : tone(legC, -0.2));
    ctx.save();
    ctx.translate(fx, fy);
    sh(ctx, 'M-4.4 -13 Q0 -11 4 -13 L4 -5 Q11 -4 10 -1 Q7 2 -4 0 Q-6 -1 -4.5 -5Z', near ? boot : tone(boot, -0.22));
    ln(ctx, 'M-2.8 -10 L2.5 -10', tone(boot, 0.2), 1);
    ctx.restore();
  }

  /** The torso seen from the front or the back: coat, armour, tabard, apron, belt; a dress to the ground. */
  function torsoFront(ctx, L, P, C, back, dress, breathe) {
    const bottom = dress ? -3 : -24;
    const top = -62 + breathe;
    const sw = Math.sin((P.walk || 0) * 2) * Math.min(1, P.move || 0) * (dress ? 1.2 : 0);
    sh(ctx, `M-8 ${top} Q-15 ${top} -17 -54 Q-14 -45 -13 -40 Q-15 -31 ${dress ? -21 - sw : -17} ${bottom} Q0 ${bottom + 5} ${dress ? 21 + sw : 17} ${bottom} Q14 -34 13 -40 L17 -54 Q15 ${top} 8 ${top} Q0 ${top + 6} -8 ${top}Z`, C.coat);
    sh(ctx, `M11 -59 Q17 -57 15 -48 L11 -40 Q14 -27 ${dress ? 20 + sw : 16} ${bottom} Q12 ${bottom + 3} 6 ${bottom + 2} L7 -39Z`, tone(C.coat, -0.17), 0);
    const a = C.a;
    if (a === 'mail' && !C.R) {
      for (let y = -56; y < bottom - 2; y += 4.5) ln(ctx, `M-13 ${y} Q0 ${y + 2} 13 ${y}`, tone(C.coat, -0.22), 0.9);
    }
    if (a === 'mail' && C.R) {
      // Mail under a tabard: the skirt of rings below the tabard's hem, steel at the shoulders.
      sh(ctx, `M-16 ${bottom - 1} Q0 ${bottom + 4} 16 ${bottom - 1} L15 ${bottom + 4} Q0 ${bottom + 8} -15 ${bottom + 4}Z`, '#9aa3ab', 1.2);
    }
    if (a === 'gambeson') for (const x of [-9, -4, 1, 6, 11]) ln(ctx, `M${x} -57 L${x * 1.05} ${bottom}`, tone(C.coat, -0.18), 1);
    if (a === 'leather') ln(ctx, 'M-12 -49 Q0 -46 12 -49 M-12 -32 Q0 -29 12 -32', tone(C.coat, -0.25), 1.1);
    if (a === 'rags') {
      sh(ctx, `M-17 ${bottom} L-12 ${bottom + 4} L-7 ${bottom} L-2 ${bottom + 4} L3 ${bottom} L8 ${bottom + 4} L13 ${bottom} L17 ${bottom}`, null, 1.2);
      ov(ctx, -7, -46, 3, 2.5, tone(C.coat, 0.14));
      ov(ctx, 8, -32, 2.6, 2.2, tone(C.coat, -0.2));
    }
    if (!back) {
      if (C.R && !L.apron) {
        // The tabard: the side's colour (the coat) with its trim and device.
        ln(ctx, 'M-7 -52 L0 -47 L7 -52', C.trim, 2);
        G.device(ctx, 0, -41, 4.5, C.R);
      } else if (L.apron) {
        sh(ctx, `M-9 -53 Q0 -49 9 -53 L8 -41 Q12 -25 14 ${dress ? -9 : bottom + 3} Q0 ${dress ? -5 : bottom + 6} -14 ${dress ? -9 : bottom + 3} L-8 -41Z`, L.apron, 1.5);
        ln(ctx, 'M-9 -45 L-10 -55 M9 -45 L10 -55', L.apron, 2.3);
      } else sh(ctx, `M-8 ${top + 1} Q0 -54 8 ${top + 1} L6 -55 Q0 -51 -6 -55Z`, tone(C.coat, 0.3), 1.2);
      if (a === 'mail' && (L.pauldrons || C.R)) {
        sh(ctx, 'M-17 -56 Q-11 -62 -7 -59 L-6 -52 L-16 -48Z', '#aeb7ba', 1.4);
        sh(ctx, 'M17 -56 Q11 -62 7 -59 L6 -52 L16 -48Z', '#929fa7', 1.4);
      }
    } else if (C.R) sh(ctx, `M-11 -58 L11 -58 L12 ${bottom + 1} L-12 ${bottom + 1}Z`, C.coat, 1.1);
    if (!dress) {
      sh(ctx, 'M-13 -42 Q0 -39 13 -42 L14 -36 Q0 -33 -14 -36Z', L.belt || '#65452e', 1.3);
      if (!back) {
        sh(ctx, 'M-3.5 -41 h7 v5.8 h-7Z', PAL.gold, 1.1);
        sh(ctx, 'M-1.5 -39.5 h3 v2.5 h-3Z', L.belt || '#65452e', 0);
      }
    } else if (!back) ln(ctx, 'M-12 -41 Q0 -38 12 -41', tone(C.coat, -0.3), 1.6);
    if (a === 'fur' || L.fur) for (const x of [-11, 0, 11]) ov(ctx, x, -61, 6, 4.4, '#b39470', 1.5);
  }

  /** The torso in profile (east). */
  function torsoSide(ctx, L, _P, C, dress, breathe) {
    const bottom = dress ? -3 : -24;
    const top = -62 + breathe;
    sh(ctx, `M-5 ${top} Q-13 -61 -14 -52 Q-11 -46 -10 -40 Q-12 -30 ${dress ? -17 : -12} ${bottom} Q-1 ${bottom + 5} ${dress ? 15 : 12} ${bottom} Q11 -34 10 -41 Q17 -50 13 -56 Q9 ${top - 1} 5 ${top} Q1 -57 -5 ${top}Z`, C.coat);
    sh(ctx, `M-10 -57 Q-12 -50 -9 -40 L${dress ? -16 : -11} ${bottom} Q-8 ${bottom + 2} -4 ${bottom + 2} L-4 -39Z`, tone(C.coat, -0.17), 0);
    const a = C.a;
    if (a === 'mail' && !C.R) for (let y = -56; y < bottom - 2; y += 4.5) ln(ctx, `M-11 ${y} Q0 ${y + 2} 11 ${y}`, tone(C.coat, -0.22), 0.9);
    if (a === 'mail' && C.R) sh(ctx, `M-12 ${bottom - 1} Q0 ${bottom + 4} 12 ${bottom - 1} L11 ${bottom + 4} Q0 ${bottom + 8} -11 ${bottom + 4}Z`, '#9aa3ab', 1.2);
    if (a === 'gambeson') for (const x of [-6, -1, 4, 8]) ln(ctx, `M${x} -57 L${x} ${bottom}`, tone(C.coat, -0.18), 1);
    if (a === 'mail' && (L.pauldrons || C.R)) sh(ctx, 'M-8 -59 Q-2 -63 4 -58 L3 -51 L-7 -50Z', '#aeb7ba', 1.4);
    if (L.apron) sh(ctx, `M5 -55 L11 -52 L9 -42 L13 ${dress ? -9 : bottom + 3} Q9 ${dress ? -5 : bottom + 6} 1 ${dress ? -8 : bottom + 2} L3 -41Z`, L.apron, 1.25);
    else if (C.R) {
      ln(ctx, 'M5 -53 L10 -49', C.trim, 2);
      G.device(ctx, 4, -42, 3.6, C.R);
    } else sh(ctx, `M-4 ${top} Q4 -56 9 -59 L9 -54 Q3 -51 -4 -57Z`, tone(C.coat, 0.3), 1.2);
    if (!dress) {
      sh(ctx, 'M-10 -41 Q0 -37 11 -42 L12 -36 Q1 -33 -11 -36Z', L.belt || '#65452e', 1.2);
      sh(ctx, 'M5 -41 L10 -42 L10 -36 L5 -35Z', PAL.gold, 1);
    }
    if (a === 'fur' || L.fur) for (const x of [-7, 3]) ov(ctx, x, -61, 6, 4.4, '#b39470', 1.5);
  }

  /** The cloak: behind the body (and, from the front, its edges and clasp over the shoulders). */
  function cloakBehind(ctx, L, face, move, t) {
    if (!L.cloak) return;
    const sway = Math.sin(t * 2.2) * 0.8 + move * 3;
    if (face === 'left' || face === 'right') {
      sh(ctx, `M-3 -63 Q-16 -63 -19 -49 L${-25 - sway} -13 Q-14 -6 -4 -12 L6 -24 L9 -55Z`, L.cloak);
      ln(ctx, `M-14 -51 L${-22 - sway} -15`, tone(L.cloak, -0.23), 1.6);
    } else if (face === 'down') sh(ctx, `M-10 -62 Q-20 -60 -22 -45 L${-26 - sway * 0.6} -14 Q-15 -5 1 -10 Q19 -7 ${23 + sway * 0.6} -14 L17 -51 Q14 -59 10 -62Z`, L.cloak);
  }
  function cloakOver(ctx, L, face, move, t) {
    if (!L.cloak) return;
    const trim = L.cloakTrim || null;
    const sway = Math.sin(t * 2.2) * 0.8 + move * 2;
    if (face === 'up') {
      sh(ctx, `M-11 -62 Q0 -65 11 -62 Q17 -58 19 -44 L${22 + sway * 0.4} -15 Q0 ${-7 + sway * 0.3} ${-22 - sway * 0.4} -15 L-19 -44 Q-17 -58 -11 -62Z`, L.cloak);
      ln(ctx, 'M-5 -58 Q-4 -36 -6 -16 M6 -58 Q5 -36 7 -16', tone(L.cloak, -0.18), 1.3);
      if (trim) ln(ctx, `M${-21 - sway * 0.4} -15.5 Q0 ${-7.5 + sway * 0.3} ${21 + sway * 0.4} -15.5`, trim, 1.8);
    } else if (face === 'down') {
      sh(ctx, 'M-10 -62 Q-15 -62 -18 -57 L-22 -18 L-17 -16 L-9 -48 L0 -55 L9 -48 L17 -16 L22 -18 L18 -57 Q15 -62 10 -62 L0 -56Z', L.cloak);
      if (trim) ln(ctx, 'M-18 -18 L-9 -48 L0 -55 L9 -48 L18 -18', trim, 1.7);
      ov(ctx, 0, -55, 3.4, 3.4, PAL.gold, 1.25);
    } else {
      sh(ctx, 'M-5 -61 Q-11 -63 -14 -55 L-17 -20 L-11 -16 L-4 -47 L6 -56Z', L.cloak);
      if (trim) ln(ctx, 'M-11 -18 L-4 -47 L6 -56', trim, 1.5);
      ov(ctx, 6, -55, 3, 3, PAL.gold, 1.1);
    }
  }

  /**
   * An arm from the shoulder (v0.7 units) to the hand (rig pixels, from `weaponArm`): upper and lower arm
   * with a bent elbow, the sleeve over the ink, the hand (a glove's colour when worn). `out` says which
   * way the elbow bends: away from the body.
   */
  function limb(ctx, sx, sy, hand, sleeve, skin, out = [-1, 0.4], width = 1) {
    const [hx, hy] = toV(hand[0], hand[1]);
    const dx = hx - sx;
    const dy = hy - sy;
    const d = Math.hypot(dx, dy) || 1;
    const seg = 12.5;
    const off = d < seg * 2 ? Math.sqrt(seg * seg - (d / 2) * (d / 2)) : 0;
    let px = -dy / d;
    let py = dx / d;
    if (px * out[0] + py * out[1] < 0) [px, py] = [-px, -py];
    const ex = (sx + hx) / 2 + px * off;
    const ey = (sy + hy) / 2 + py * off;
    const path = `M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`;
    ln(ctx, path, INK, 9 * width);
    ln(ctx, path, sleeve, 6.4 * width);
    ov(ctx, hx, hy, 3.7, 3.5, skin, 1.2);
  }

  // ---- Weapons, bows and shields (the rig's pixels, the people's ink) ----

  /** A weapon held at (hx, hy), pointing along angle `a`. `ext` slides it along its own axis. */
  function weapon(ctx, kind, hx, hy, a, ext = 0, len = 1) {
    if (!kind) return;
    ctx.save();
    ctx.translate(hx + Math.cos(a) * ext, hy + Math.sin(a) * ext);
    ctx.rotate(a);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (x0, x1, w, color) => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = w + 1.3;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const out = (color, w = 0.85) => {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const blade = (L0, L1, half) => {
      poly(ctx, [L0, -half, L1 - 2.5, -half * 0.85, L1, 0, L1 - 2.5, half * 0.85, L0, half]);
      out('#c6cece');
      ctx.fillStyle = '#eff0dc';
      ctx.fillRect(L0 + 0.5, -0.35, (L1 - L0) * 0.78, 0.6);
    };
    if (kind === 'sword') {
      stroke(-3, 1, 2, '#62442e');
      ellipse(ctx, -3.6, 0, 1.2, 1.2);
      out(PAL.gold, 0.6);
      rrect(ctx, 0.4, -3.2, 1.9, 6.4, 0.9);
      out(PAL.gold, 0.7);
      blade(2.4, 17.5 * len, 1.25);
    } else if (kind === 'greatsword') {
      stroke(-8, 1, 2.2, '#62442e');
      ellipse(ctx, -8.6, 0, 1.6, 1.6);
      out(PAL.gold, 0.7);
      rrect(ctx, 0.5, -4.2, 2.2, 8.4, 1);
      out(PAL.gold, 0.8);
      blade(2.8, 27 * len, 1.55);
    } else if (kind === 'axe' || kind === 'club' || kind === 'hammer' || kind === 'mace') {
      stroke(-3, kind === 'mace' ? 12 : 13, 1.9, PAL.wood);
      if (kind === 'axe') {
        ctx.beginPath();
        ctx.moveTo(10, -1);
        ctx.quadraticCurveTo(12, -6, 16.5, -5.2);
        ctx.quadraticCurveTo(18, 0, 16, 4.2);
        ctx.quadraticCurveTo(12, 4.5, 10, 1.2);
        ctx.closePath();
        out('#c6cece');
      } else if (kind === 'hammer') {
        rrect(ctx, 11, -3.6, 5, 7.2, 1.2);
        out('#7d858d');
      } else if (kind === 'mace') {
        ellipse(ctx, 13.5, 0, 3, 3);
        out('#7d858d');
        for (const [fx, fy] of [[13.5, -3.6], [13.5, 3.6], [16.9, 0]]) {
          poly(ctx, [fx - 1.4, fy * 0.6, fx, fy, fx + 1.4, fy * 0.6]);
          out('#c6cece', 0.6);
        }
      } else {
        ellipse(ctx, 12.5, 0, 3.6, 2.7);
        out(PAL.woodShade);
      }
    } else if (kind === 'greataxe') {
      stroke(-8, 20, 2.1, PAL.wood);
      ctx.beginPath();
      ctx.moveTo(15, -1);
      ctx.quadraticCurveTo(17, -8.5, 23, -7.5);
      ctx.quadraticCurveTo(25.5, 0, 23, 6.5);
      ctx.quadraticCurveTo(17, 7.5, 15, 1.2);
      ctx.closePath();
      out('#c6cece');
    } else if (kind === 'spear' || kind === 'lance' || kind === 'pike') {
      const L = (kind === 'lance' ? 40 : kind === 'pike' ? 48 : 34) * len;
      stroke(-12 * len, L, kind === 'lance' ? 2.2 : 1.7, '#9a7048');
      poly(ctx, [L - 1.5, -2.5, L + 7, 0, L - 1.5, 2.5, L - 3, 0]);
      out('#c6cece');
      if (kind === 'lance') {
        poly(ctx, [L - 6, -1, L - 14, -5.5, L - 12, -1]);
        out(PAL.crimson, 0.6);
        poly(ctx, [-2, -2.8, 2, -2.8, 2, 2.8, -2, 2.8]);
        out('#7d858d', 0.6);
      }
    } else if (kind === 'staff') {
      stroke(-10, 22, 1.9, PAL.woodShade);
    }
    ctx.restore();
  }

  /** A bow held upright at (x, y); `pull` 0..1 draws the string back toward -x (local), with an arrow. */
  function bow(ctx, x, y, pull, dir = 1, size = 1, recurve = false) {
    const h = 13 * size;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -h);
    if (recurve) {
      ctx.moveTo(2, -h - 1.5);
      ctx.quadraticCurveTo(-1.5, -h + 0.5, 1.5, -h * 0.55);
      ctx.quadraticCurveTo(6, 0, 1.5, h * 0.55);
      ctx.quadraticCurveTo(-1.5, h - 0.5, 2, h + 1.5);
    } else ctx.quadraticCurveTo(8, 0, -1, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.1;
    ctx.stroke();
    ctx.strokeStyle = recurve ? '#6b4a2e' : '#987044';
    ctx.lineWidth = 1.9;
    ctx.stroke();
    const sx = -1 - pull * 7;
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-1, -h);
    ctx.lineTo(sx, 0);
    ctx.lineTo(-1, h);
    ctx.stroke();
    if (pull > 0.15) {
      ctx.strokeStyle = '#6d492e';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      poly(ctx, [9, -1.6, 12.5, 0, 9, 1.6]);
      fill(ctx, '#c6cece');
    }
    ctx.restore();
  }

  /** A crossbow held level along +x: stock, prod, the string drawn back while loaded, the bolt on top. */
  function crossbow(ctx, x, y, pull, dir = 1, windlass = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.lineCap = 'round';
    const line = (x0, y0, x1, y1, w, color) => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = w + 1.3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    line(-5, 1.5, 9, 0, 2.6, '#9a7048');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.quadraticCurveTo(12.5, 0, 10, 7);
    ctx.stroke();
    ctx.strokeStyle = steelDark;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    const nx = 10 - Math.max(0, Math.min(1, pull)) * 7;
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.lineTo(nx, 0);
    ctx.lineTo(10, 7);
    ctx.stroke();
    if (windlass) {
      ellipse(ctx, -6, 1.5, 2.4, 2.4);
      fillLine(ctx, steelDark, 0.8);
      line(-6, -2.5, -6, 5.5, 1, steel);
    }
    if (pull > 0.95) {
      line(nx, -0.8, 14, -0.8, 1.1, '#9a7048');
      poly(ctx, [14, -2.2, 16.5, -0.8, 14, 0.6]);
      fill(ctx, '#c6cece');
    }
    ctx.restore();
  }

  function shield(ctx, L, x, y, r, back) {
    const R = G.realm(L.realm || 'valedorn');
    const shape = L.shield === 'wood' ? 'round' : L.shield;
    G.shieldShape(ctx, x, y, r, shape, L.shield === 'wood' ? { ...R, wood: true, device: 'none' } : R, back);
  }

  /** The quiver: on the hip in front and side views, across the back seen from behind (v0.7 units). */
  function quiver(ctx, view) {
    if (view === 'back') {
      sh(ctx, 'M4 -66 L11 -64 L7 -36 L0 -38Z', '#7a5434', 1.4);
      for (const dx of [5, 7.5, 10]) ln(ctx, `M${dx} -65 L${dx + 1} -70`, '#efe6cf', 1.4);
    } else if (view === 'side') sh(ctx, 'M-16 -48 L-9 -50 L-7 -22 L-13 -21Z', '#7a5434', 1.4);
    else sh(ctx, 'M8 -50 L15 -51 L16 -26 L10 -25Z', '#7a5434', 1.4);
  }

  // ---- The weapon arm for each facing (the rig's pixels; P11-01's real phases) ----

  /**
   * Where the weapon hand is and where the weapon points, from the pose. Angles: 0 = +x (local right),
   * -π/2 = up. Melee follows the swing's real phases (windup raises, active sweeps through, recovery
   * returns); a spear thrusts along its line instead of sweeping.
   */
  function weaponArm(L, P, face) {
    const side = face === 'left' || face === 'right';
    const up = face === 'up';
    const kind = L.weapon;
    const spear = kind === 'spear' || kind === 'lance' || kind === 'pike';
    let hx = side ? 2.5 : up ? 7.2 : -7.2;
    let hy = -13;
    let a = side ? -1.15 : up ? -1.3 : -1.85;
    let ext = 0;
    let len = 1;
    if (spear) a = side ? -1.25 : -Math.PI / 2;
    if (kind === 'staff') a = -Math.PI / 2;
    if (P.mounted && spear) a = side ? -0.35 : up ? -1.4 : -1.75;
    const tilt = P.mounted && side ? (P.aim === 'up' ? -0.6 : P.aim === 'down' ? 0.5 : 0) : 0;
    if (kind === 'greataxe' || kind === 'greatsword') {
      a = side ? -1.0 : up ? -1.0 : -2.1;
      hy = -14;
    }
    const atk = P.atk;
    if (atk && kind) {
      const k = atk.k;
      const ease = (v) => v * v * (3 - 2 * v);
      if (spear) {
        const aim = side ? -0.05 + tilt : up ? -Math.PI / 2 : Math.PI / 2;
        len = side ? 1 : 0.62;
        if (atk.phase === 'windup') {
          a = a + (aim - a) * ease(k);
          ext = -5 * ease(k);
        } else if (atk.phase === 'active') {
          a = aim;
          ext = -5 + 17 * ease(Math.min(1, k * 1.6));
        } else {
          a = aim + (a - aim) * ease(k);
          ext = 12 * (1 - ease(k));
        }
      } else {
        const back = side ? -2.55 : up ? -0.35 : -2.75;
        const through = side ? 0.65 : up ? -2.6 : 0.55;
        if (atk.phase === 'windup') {
          a = a + (back - a) * ease(k);
          hy -= 5 * ease(k);
          if (side) hx -= 2 * ease(k);
        } else if (atk.phase === 'active') {
          a = back + (through - back) * ease(k);
          hy -= 5 * (1 - k);
          if (side) hx += 3 * k;
        } else {
          a = through + (a - through) * ease(k);
          if (side) hx += 3 * (1 - k);
        }
      }
    }
    if (P.guard && !L.shield && kind && !atk) {
      a = side ? -0.35 : up ? -Math.PI + 0.3 : -0.3;
      hy = -17;
      if (!side) hx = up ? 5 : -5;
    }
    if (P.work) {
      const k = (Math.sin(P.t * 5) + 1) / 2;
      a = side ? -2.2 + k * 2.4 : -2.4 + k * 2.6;
      hy = -14 - (1 - k) * 4;
    }
    return { hx, hy, a, ext, len, spear };
  }

  function shieldPos(face, guard, L) {
    const r = L.shield === 'kite' ? 6.2 : L.shield === 'heater' ? 6 : 6.4;
    if (face === 'down') return guard ? { x: 0.5, y: -15, r } : { x: 7.8, y: -13.5, r };
    if (face === 'up') return guard ? { x: -1, y: -16, r } : { x: -7.6, y: -14, r };
    return guard ? { x: 7.2, y: -15.5, r } : { x: -3.5, y: -15, r };
  }

  // ---- The figure ----

  /** Debug → Old figures (P11-12b): the 5.11 renderer, for side-by-side screenshots until P11-12e. */
  const classic = () => Boolean(G.fig?.classic && G.figClassic);

  function figure(ctx, x, y, L, P) {
    if (classic()) return G.figClassic.figure(ctx, x, y, L, P);
    const s = (L.scale || 1) * (P.scale || 1);
    const face = P.face || 'down';
    const side = face === 'left' || face === 'right';
    const up = face === 'up';
    const t = P.t || 0;
    const move = Math.min(1, P.move || 0);
    const walk = P.walk || 0;
    const bob = move ? Math.abs(Math.sin(walk)) * 1.1 * move : 0;
    const breathe = move || P.reduced ? 0 : Math.sin(t * 1.8 + (L.seed || 0)) * 0.7;
    const F = features(L);
    const C = clothes(L);
    const dress = Boolean(L.dress) && !L.armour && !P.mounted;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (!P.mounted) G.shadow(ctx, 0.8, 0.5, 8.6, 3.1, 0);
    if (face === 'left') ctx.scale(-1, 1);
    if (P.hit > 0) ctx.translate((face === 'down' ? 0 : -1.4) * P.hit, (face === 'down' ? -1.2 : 0) * P.hit);
    if (P.stagger > 0) ctx.rotate(Math.sin(P.stagger * Math.PI * 3) * 0.12 * P.stagger);
    ctx.translate(0, -bob - (P.mounted ? SEAT : 0));

    const wa = weaponArm(L, P, face);
    const ranged = SHOOTS.includes(L.weapon);
    const shoot = (sx, sy, pull, dir) => (L.weapon === 'crossbow' || L.weapon === 'arbalest' ? crossbow(ctx, sx, sy, pull, dir, L.weapon === 'arbalest') : bow(ctx, sx, sy, pull, dir, L.bowSize || 1, L.weapon === 'recurve'));
    const guard = Boolean(P.guard && L.shield && !P.broken);
    const skin = L.gloves || L.skin || SKINS[1];
    const grip = L.twoHanded && !ranged && L.weapon ? [wa.hx + Math.cos(wa.a) * (wa.ext - 3.5), wa.hy + Math.sin(wa.a) * (wa.ext - 3.5)] : null;
    const slung = () => L.shieldBack && shield(ctx, { ...L, shield: L.shieldBack }, side ? -4.5 : 0, -16.5, 6 * 0.92, !up);
    const sh0 = shieldPos(face, guard, L);
    if (guard && P.press) sh0.x *= 1 - 0.35 * P.press;
    if (P.broken && L.shield) sh0.y += 4;
    const drawShield = () => L.shield && shield(ctx, L, sh0.x, sh0.y, sh0.r * (guard ? 1.12 : 1), up && !guard);
    const drawWeapon = () => {
      if (ranged || !L.weapon) return;
      weapon(ctx, L.weapon, wa.hx, wa.hy, wa.a, wa.ext, wa.len * (L.len || 1));
    };
    const drawTrail = () => {
      if (P.atk?.phase !== 'active' || wa.spear || !L.weapon || ranged || P.reduced) return;
      ctx.save();
      ctx.strokeStyle = P.trail || 'rgba(255,248,226,0.55)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      const r = L.weapon === 'greataxe' || L.weapon === 'greatsword' ? 22 : 15;
      const back = side ? -2.55 : up ? -0.35 : -2.75;
      ctx.beginPath();
      ctx.arc(wa.hx, wa.hy, r, Math.min(back, wa.a), Math.max(back, wa.a));
      ctx.stroke();
      ctx.restore();
    };
    const swing = move && !P.atk && !ranged ? Math.sin(walk) * move : 0;
    const body = (fn) => storybook(ctx, fn);

    if (side) {
      // East (west is mirrored): far things first, then the near leg, the body, the near arm, the head.
      if (!guard && L.shield) shield(ctx, L, -3.5, -15, sh0.r * 0.95, false);
      slung();
      body(() => {
        cloakBehind(ctx, L, face, move, t);
        if (L.quiver) quiver(ctx, 'side');
        legSide(ctx, L, P, false, dress);
        // The far arm: on the grip, on the bow's string, or swinging behind.
        if (grip) limb(ctx, 4, -58, grip, tone(C.sleeve, -0.18), skin, [-0.3, 1]);
        else if (ranged) limb(ctx, 4, -58, [5.5 - (P.draw || 0) * 7, -16.5], tone(C.sleeve, -0.18), skin, [-0.6, 1]);
        else if (L.shield) limb(ctx, 4, -58, guard ? [sh0.x - 1, sh0.y] : [-3.5, -15], tone(C.sleeve, -0.18), skin, guard ? [-0.4, 1] : [0.3, 1]); // the shield arm, holding it
        else limb(ctx, 4, -58, [3 - swing * 3, -13.5], tone(C.sleeve, -0.18), skin, [-0.3, 1]);
        legSide(ctx, L, P, true, dress);
        neck(ctx, L, face);
        torsoSide(ctx, L, P, C, dress, breathe);
        cloakOver(ctx, L, face, move, t);
      });
      if (ranged) {
        shoot(6.5, -16.5, P.draw || 0, 1);
        body(() => limb(ctx, 0, -55, [6, -16], C.sleeve, skin, [-0.4, 1]));
      } else {
        drawTrail();
        if (guard) drawShield();
        body(() => limb(ctx, 0, -55, [wa.hx + swing * 1.2, wa.hy], C.sleeve, skin, wa.hy < -19 ? [-1, 0.2] : [-0.5, 1]));
        drawWeapon();
      }
      body(() => head(ctx, L, F, face, P));
      if (ranged && P.shot > 0 && !P.reduced) {
        ctx.fillStyle = `rgba(255,246,214,${P.shot})`;
        ellipse(ctx, 12, -16.5, 2.4, 1.6);
        ctx.fill();
      }
    } else if (up) {
      // Seen from behind: the weapon and shield in front of the body are behind it now.
      drawWeapon();
      if (!guard) drawShield();
      if (ranged) shoot(-5.5, -17, P.draw || 0, -1);
      body(() => {
        legsFront(ctx, L, P, C.coat, dress);
        neck(ctx, L, face);
        torsoFront(ctx, L, P, C, true, dress, breathe);
        if (L.quiver) quiver(ctx, 'back');
        cloakOver(ctx, L, face, move, t);
      });
      slung();
      body(() => {
        if (grip) limb(ctx, -14, -56, grip, C.sleeve, skin, [-1, 0.3]);
        else limb(ctx, -14, -56, [-6.5 + (ranged ? 1 : 0), ranged ? -17 : -13 + swing * 1.4], C.sleeve, skin, [-1, 0.3]);
        limb(ctx, 14, -56, ranged ? [2, -18] : [wa.hx, wa.hy - swing * 1.4], C.sleeve, skin, [1, 0.3]);
        head(ctx, L, F, face, P);
      });
      if (guard) drawShield();
    } else {
      // Facing the viewer.
      slung();
      body(() => {
        cloakBehind(ctx, L, face, move, t);
        legsFront(ctx, L, P, C.coat, dress);
        neck(ctx, L, face);
        torsoFront(ctx, L, P, C, false, dress, breathe);
        if (L.quiver) quiver(ctx, 'front');
        cloakOver(ctx, L, face, move, t);
        if (dress && !L.weapon && !L.shield) {
          // Hands clasped in front (the innkeeper, the elder): not two arms hanging loose.
          sh(ctx, 'M-17 -45 Q-15 -40 -7 -37 L-2 -35 L-3 -31 Q-13 -31 -19 -39Z', C.sleeve);
          sh(ctx, 'M17 -45 Q15 -40 7 -37 L2 -35 L3 -31 Q13 -31 19 -39Z', C.sleeve);
          ov(ctx, -2.5, -34, 4.1, 3.2, skin, 1.2);
          ov(ctx, 2.6, -33.7, 4, 3.1, skin, 1.2);
        } else if (ranged) {
          limb(ctx, 14, -56, [6, -17], C.sleeve, skin, [1, 0.3]);
          limb(ctx, -14, -56, [-1 + (P.draw || 0) * 2, -17.5], C.sleeve, skin, [-1, 0.3]);
        } else {
          if (grip) limb(ctx, 14, -56, grip, C.sleeve, skin, [1, 0.3]);
          else limb(ctx, 14, -56, guard ? [2.5, -15] : [6.6, -12.5 + swing * 1.4], C.sleeve, skin, [1, 0.3]);
          limb(ctx, -14, -56, [wa.hx, wa.hy - swing * 1.4], C.sleeve, skin, wa.hy < -19 ? [-1, -0.2] : [-1, 0.3]);
        }
        head(ctx, L, F, face, P);
      });
      drawTrail();
      if (ranged) shoot(6, -17, P.draw || 0, 1);
      drawShield();
      drawWeapon();
    }
    if (P.hit > 0 && !P.reduced) {
      ctx.globalAlpha = 0.45 * P.hit;
      ctx.fillStyle = '#fff6e6';
      ellipse(ctx, 0, -17, 8, 13);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /**
   * P11-05: where a look's weapon tip is in a pose (figure coordinates, before its scale and mirror), for
   * the windup glint. Null for no weapon or a bow. @param {any} L @param {any} P
   */
  function weaponTip(L, P) {
    if (!L.weapon || SHOOTS.includes(L.weapon)) return null;
    const face = P.face || 'down';
    const wa = weaponArm(L, P, face);
    const long = { greatsword: 27, greataxe: 23, spear: 41, pike: 55, lance: 47 }[L.weapon] || 17;
    const d = wa.ext + long * (wa.len || 1) * (L.len || 1);
    const x = wa.hx + Math.cos(wa.a) * d;
    const y = wa.hy + Math.sin(wa.a) * d - (P.mounted ? SEAT : 0);
    return { x: face === 'left' ? -x : x, y };
  }

  /**
   * A bust for a portrait (P11-12b): the same body, head and features as the figure, seen from the front,
   * framed for a 100-unit square at (0, 0). `helm` false shows the head bare. Weapons and shields stay out.
   */
  function bust(ctx, L, { helm = true } = {}) {
    const look = helm ? L : { ...L, helmet: L.helmet === 'hood' ? 'hood' : null, hat: L.hat === 'coif' ? null : L.hat };
    const F = features(L);
    const C = clothes(look);
    ctx.save();
    ctx.translate(50, 192);
    ctx.scale(100 / 53, 100 / 53);
    if (look.cloak) sh(ctx, 'M-10 -62 Q-24 -60 -27 -40 L-28 -20 L28 -20 L27 -40 Q24 -60 10 -62Z', look.cloak);
    neck(ctx, look, 'down');
    torsoFront(ctx, look, { t: 0 }, C, false, false, 0);
    for (const k of [-1, 1]) sh(ctx, `M${k * 12} -60 Q${k * 20} -57 ${k * 21} -47 L${k * 21} -30 L${k * 13} -30 L${k * 13} -46 L${k * 9} -52Z`, C.sleeve);
    cloakOver(ctx, look, 'down', 0, 0);
    head(ctx, look, F, 'down', { t: 0, reduced: true, talk: look.talk });
    ctx.restore();
  }

  // ---- Horses (the rig's pixels, always in profile) ----

  /**
   * A horse with its rider (the rider is drawn by `figure` with `mounted`). Look: coat, mane, cloth (a
   * realm key for the saddle cloth), pony (shaggier, smaller). Pose as a figure's. Facing up or down it
   * keeps the side it last turned to (P.hface).
   */
  function horse(ctx, x, y, H, P, rider) {
    if (classic()) return G.figClassic.horse(ctx, x, y, H, P, rider);
    const face = P.face === 'left' || P.face === 'right' ? P.face : P.hface || 'right';
    const s = (H.scale || 1) * (P.scale || 1) * (H.pony ? 0.9 : 1) * HORSE;
    const coat = H.coat || '#8a5a3a';
    const mane = H.mane || '#3b2a20';
    const dark = tone(coat, -0.2);
    const move = Math.min(1, P.move || 0);
    const walk = P.walk || 0;
    const R = H.cloth ? G.realm(H.cloth) : null;
    const line = 1.15;
    const out = (color, w = line) => {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    G.shadow(ctx, 1, 0.5, 16, 4, 0);
    if (face === 'left') ctx.scale(-1, 1);
    const bob = Math.abs(Math.sin(walk)) * 1.4 * move;
    ctx.translate(0, -bob);
    const leg = (lx, phase, far) => {
      const sw = Math.sin(walk + phase) * 0.42 * move;
      ctx.save();
      ctx.translate(lx, -12);
      ctx.rotate(sw);
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-2.1, 5, -1.4, 9.4 + bob);
      ctx.lineTo(1.6, 9.4 + bob);
      ctx.quadraticCurveTo(2.2, 5, 2, 0);
      ctx.closePath();
      out(far ? tone(coat, -0.26) : coat, 0.9);
      ctx.beginPath();
      ctx.moveTo(-1.9, 9.2 + bob);
      ctx.lineTo(2.1, 9.2 + bob);
      ctx.lineTo(2.3, 11.8 + bob);
      ctx.lineTo(-2.1, 11.8 + bob);
      ctx.closePath();
      out('#3a2f28', 0.8);
      ctx.restore();
    };
    leg(9.5, Math.PI, true);
    leg(-8, 0, true);
    // The tail, a soft sweep.
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(-12.5, -18.5);
    ctx.quadraticCurveTo(-19, -15 + Math.sin((P.t || 0) * 3) * 1.5, -16.5, -6.5);
    ctx.stroke();
    ctx.strokeStyle = mane;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    // The barrel: a rounded body, the belly in shade.
    ctx.beginPath();
    ctx.moveTo(-13.5, -17);
    ctx.quadraticCurveTo(-14.5, -23, -6, -22.6);
    ctx.quadraticCurveTo(3, -22.4, 8.5, -21.5);
    ctx.quadraticCurveTo(14.5, -20.5, 13, -14);
    ctx.quadraticCurveTo(11.5, -9.4, 4, -10);
    ctx.lineTo(-7, -10);
    ctx.quadraticCurveTo(-14, -10.5, -13.5, -17);
    ctx.closePath();
    out(coat);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.quadraticCurveTo(0, -9, 11, -13);
    ctx.quadraticCurveTo(10, -10, 4, -10.2);
    ctx.lineTo(-7, -10.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tone(coat, 0.14);
    ellipse(ctx, -5, -20, 4.5, 1.2);
    ctx.fill();
    // The neck and the head.
    ctx.beginPath();
    ctx.moveTo(6.5, -21);
    ctx.quadraticCurveTo(10, -29.5, 14.5, -31.5);
    ctx.lineTo(17.5, -28.5);
    ctx.quadraticCurveTo(14.5, -23, 13, -14);
    ctx.closePath();
    out(coat);
    ctx.save();
    ctx.translate(17.4, -27.4);
    ctx.rotate(0.6);
    ctx.beginPath();
    ctx.moveTo(-3.4, -2.6);
    ctx.quadraticCurveTo(2.5, -3.6, 7.2, -1.4);
    ctx.quadraticCurveTo(8.6, 0.6, 7, 2.2);
    ctx.quadraticCurveTo(1.5, 3.4, -3.2, 2.6);
    ctx.quadraticCurveTo(-4.6, 0, -3.4, -2.6);
    ctx.closePath();
    out(coat);
    ctx.fillStyle = INK;
    ellipse(ctx, 6.4, 0.4, 0.5, 0.5);
    ctx.fill();
    ctx.restore();
    poly(ctx, [13.2, -31.2, 13.8, -35, 15.6, -31]);
    out(coat, 0.8);
    ctx.fillStyle = INK;
    ellipse(ctx, 16.8, -28.4, 0.75, 0.85);
    ctx.fill();
    // The mane along the crest of the neck.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(6.5, -21.5);
    ctx.quadraticCurveTo(9.5, -28.5, 13.6, -31.4);
    ctx.stroke();
    ctx.strokeStyle = mane;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.lineCap = 'butt';
    // The saddle cloth in the rider's colours, or a plain saddle.
    if (R) {
      rrect(ctx, -6.5, -21.5, 12.5, 9.5, 2.2);
      out(R.color, 0.9);
      ctx.fillStyle = R.trim;
      ctx.fillRect(-6, -13.8, 11.5, 1.4);
    }
    rrect(ctx, -4.5, -23, 8.5, 4.2, 1.8);
    out('#6b4a30', 0.9);
    leg(8, 0, false);
    leg(-9.5, Math.PI, false);
    if (H.pony) {
      ctx.fillStyle = tone(coat, 0.15);
      for (const fx of [-11, 10]) {
        ellipse(ctx, fx, -3, 2.6, 1.6);
        ctx.fill();
      }
    }
    ctx.restore();
    if (rider) rider();
  }

  /** A fallen figure: lying on its side, faded and still. No blood: the game stays accessible. */
  function fallen(ctx, x, y, L, alpha, dir = 1) {
    if (classic()) return G.figClassic.fallen(ctx, x, y, L, alpha, dir);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    G.shadow(ctx, 0, 1, 15, 3.5, 0);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.translate(-2 * dir, 6);
    figure(ctx, 0, 0, L, { face: 'right', t: 0, reduced: true });
    ctx.restore();
  }

  // ---- Looks: troops (data/troops.js `look`), the hero, companions and townsfolk ----

  /**
   * A troop with no look of its own (a pack may leave it out): one from what it does, so it still agrees
   * with the troop: a bow or crossbow by its shot, a spear for a long reach, a shield if it blocks, a
   * horse for cavalry, a helmet and armour by tier.
   */
  function defaultLook(t) {
    const tier = Number(String(t?.tier || 'T1').slice(1)) || 1;
    const L = { armour: [null, 'gambeson', 'leather', 'mail'][Math.min(3, tier)] || null, tabard: tier > 1, helmet: tier > 2 ? 'nasal' : tier > 1 ? 'kettle' : 'cap' };
    if (t?.role === 'archer') Object.assign(L, { weapon: t.ranged?.projectileSpeed >= 300 ? 'crossbow' : 'bow', quiver: true, helmet: tier > 2 ? 'kettle' : 'hood' });
    else L.weapon = t?.reach >= 70 ? (t.role === 'cavalry' ? 'lance' : 'spear') : 'sword';
    if (t?.shield) L.shield = G.realm(t.faction).shield || 'round';
    if (t?.role === 'cavalry') L.mount = { coat: '#8a5a3a', mane: '#2e2119' };
    return L;
  }

  /**
   * A troop's look on a side. The parts come from the troop's own `look` (data/troops.js; packs may
   * give theirs), whether it is a woman from the troop's `gender`, and the colours from `side`: the
   * realm or band it fights for (its army's, so a hired spearman fights in the company's colours).
   * Skin, hair, hair style and beard come from `seed` (the unit's or soldier's id), never per frame.
   */
  function troopLook(troopId, side, seed = 1) {
    const t = CL.content.table('troops')[troopId] || null;
    const base = t?.look || defaultLook(t);
    const female = t?.gender === 'female';
    const r = G.rng(seed * 7 + 3);
    const culture = G.realm(side).culture;
    const hair = base.hair || HAIRS[Math.floor(r() * HAIRS.length)];
    const pale = culture === 'hrothmark' || culture === 'ostrand';
    const L = {
      ...base,
      seed,
      female,
      realm: side,
      tabard: base.tabard ? side : null,
      skin: base.skin || SKINS[Math.floor(r() * (pale ? 3 : SKINS.length))],
      hair,
      hairStyle: base.hairStyle || (female ? (r() < 0.5 ? 'braid' : 'bun') : r() < 0.15 ? 'bald' : 'short'),
      beard: female ? null : base.beard ? tone(hair, -0.1) : r() < 0.25 ? tone(hair, -0.1) : null,
      legs: base.legs || (pale ? '#5a5048' : '#6b5a46'),
    };
    return L;
  }

  /**
   * A companion's look (data/companions.js), on the side they fight for; P11-04: over it, what they
   * carry (`equipment`, their gear slots): a slot with an item is drawn from it, an empty one keeps
   * their own look's.
   */
  function companionLook(id, side = 'player', equipment = null) {
    const m = CL.content.table('companions')[id];
    const base = m?.look || {};
    const L = { ...base, seed: id.length * 31, realm: side, tabard: base.tabard ? side : null, beard: base.beard ? tone(base.hair || HAIRS[0], -0.1) : null, face: faceOf(`companion|${id}`) };
    if (equipment) dress(L, CL.gear.kitFor(null, equipment, 'primary'), null, { only: true });
    return L;
  }

  // ---- Looks from gear (P11-04; docs/ART-STYLE.md "The hero", "Items") ----

  const SLOT_LOOK = {
    offhand: () => ({ shield: 'round' }),
    head: (it) => ({ helmet: (it.tier || 1) >= 3 ? 'bascinet' : (it.tier || 1) >= 2 ? 'nasal' : 'cap' }),
    body: (it) => ({ armour: [null, 'gambeson', 'leather', 'mail'][Math.min(3, it.tier || 1)] }),
    hands: () => ({ gloves: '#7a5a3a' }),
    feet: () => ({ boots: '#4a3424' }),
    horse: () => ({ coat: '#8a5a3a', mane: '#2e2119' }),
    ammo: () => ({ quiver: true }),
  };

  /** How a piece is drawn: its own `look` (a forged piece its base's), else its family's part or its slot's default. */
  function itemLook(id) {
    const items = CL.content.table('items');
    let it = id ? items[id] : null;
    if (!it) return {};
    if (it.forgedFrom && items[it.forgedFrom]) it = items[it.forgedFrom];
    if (it.look) return it.look;
    if (it.slot === 'weapon') return { weapon: CL.content.table('weapon_families')[it.family]?.look ?? 'sword' };
    return SLOT_LOOK[it.slot]?.(it) || {};
  }

  /**
   * Put a kit on a look. `used`: the equipment as fought in (js/gear.js `kitFor`); `back`: a shield slung
   * on the back. `only`: change only the slots that hold something. Sets `sig`, the kit's signature.
   */
  function dress(L, used, back, { only = false, hero = false } = {}) {
    const has = (slot) => Boolean(used?.[slot]);
    if (!only || has('weapon')) {
      const w = used?.weapon || null;
      const p = CL.profile.weaponOf(w);
      const hands = p.item?.combat?.hands ?? p.family.hands;
      const shoots = Boolean(p.item?.combat?.ranged ?? p.family.ranged);
      const wl = itemLook(w);
      L.weapon = w ? wl.weapon || p.family.look || 'sword' : null;
      L.len = wl.len || 1;
      L.twoHanded = Boolean(w) && hands === 2 && !shoots;
      L.bowSize = p.family.id === 'longbow' ? 1.2 : undefined;
      L.quiver = shoots || has('ammo') || (only ? Boolean(L.quiver) : false);
    }
    if (!only || has('offhand') || back) {
      L.shield = has('offhand') ? itemLook(used.offhand).shield || 'round' : null;
      L.shieldBack = back ? itemLook(back).shield || 'round' : null;
    }
    if (!only || has('head')) {
      const h = has('head') ? itemLook(used.head).helmet || 'cap' : null;
      L.helmet = hero && h === 'nasal' ? 'plumed' : h;
      if (h) L.hat = null;
    }
    if (!only || has('body')) {
      const a = has('body') ? itemLook(used.body).armour || null : null;
      L.armour = a === 'cloth' ? null : a;
      if (hero) L.pauldrons = L.armour === 'mail';
      if (hero && !L.armour) L.tabard = null; // P11-12b: plain clothes show as clothes (the concept's hero)
    }
    if (!only || has('hands')) L.gloves = has('hands') ? itemLook(used.hands).gloves || null : null;
    if (has('feet')) L.boots = itemLook(used.feet).boots || L.boots;
    if (!only || has('horse')) L.mount = has('horse') ? { coat: itemLook(used.horse).coat || '#8a5a3a', mane: itemLook(used.horse).mane || '#2e2119' } : null;
    L.sig = [used?.weapon || 'none', L.shield ? 'on' : L.shieldBack ? 'back' : 'none', used?.head || 'none', used?.body || 'none', used?.horse || 'none'].join('|');
    return L;
  }

  /** The hero's cloak colours (the creator's choice). */
  const CLOAKS = { crimson: '#a8423a', forest: '#4f7b4f', violet: '#6b4f8a', ash: '#7f8387' };
  /**
   * P11-04: the hero as they are: who they are from the creator (presentation, skin, hair, cloak and its
   * gold trim; P11-12b: their face, from their name, the portrait's), everything else from the kit (the
   * weapon in hand, the shield in hand or slung, the helmet or a bare head, the armour, gloves and boots,
   * the quiver and the horse). A piece whose requirement isn't met isn't worn (js/gear.js).
   * @param {any} character @param {any} [kit] @param {{ which?: string, campaign?: any }} [ctx]
   */
  function heroFrom(character, kit = {}, ctx = {}) {
    const L = heroLook(character?.cloak, character?.gender === 'woman');
    L.face = faceOf(`hero|${character?.name || ''}`, 0);
    L.beardKind = 0;
    const c = 'campaign' in ctx ? ctx.campaign : CL.campaign?.character && CL.campaign.character === character ? CL.campaign : null;
    const which = ctx.which || 'primary';
    const a = CL.gear.active(c, kit || {}, which);
    const used = CL.gear.kitFor(c, kit || {}, which);
    const back = a.stowed && CL.gear.meets(c, kit.offhand) ? kit.offhand : null;
    return dress(L, used, back, { hero: true });
  }
  function heroLook(cloak = 'crimson', female = false) {
    return {
      seed: 99,
      skin: SKINS[1],
      hair: HAIRS[2],
      hairStyle: female ? 'braid' : 'short',
      female,
      armour: 'mail',
      pauldrons: true,
      tunic: '#8d7650',
      tabard: 'valedorn',
      helmet: 'plumed',
      plume: PAL.gold,
      cloak: CLOAKS[cloak] || CLOAKS.crimson,
      cloakTrim: PAL.gold,
      shield: 'kite',
      realm: 'valedorn',
      weapon: 'sword',
      legs: '#5a4a3a',
      boots: '#63462e',
      eyes: '#5a6e48',
    };
  }

  /** Townsfolk by role, with seeded variety (clothes, hair, skin, a hat or none). */
  const ROLE_LOOKS = {
    merchant: { tunic: '#748654', sleeves: '#eddfbe', hat: 'cap', capColor: '#9e4b38', belt: '#5a3f2a', legs: '#5d6b3f', beard: true },
    smith: { tunic: '#6e6258', apron: '#4a3a2e', hairStyle: 'bald', beard: true, weapon: 'hammer', work: true },
    innkeeper: { tunic: '#965744', apron: '#f0dfbc', hairStyle: 'bun', female: true },
    guard: { armour: 'mail', tabard: true, helmet: 'kettle', weapon: 'spear', shield: 'kite' },
    recruiter: { armour: 'mail', tabard: true, helmet: 'nasal', weapon: 'spear' },
    elder: { tunic: '#79566b', cloak: null, hairStyle: 'bun', hair: '#d8d4cc', female: true, weapon: null },
    farmer: { tunic: '#9a8a5c', hat: 'brim', hatColor: '#c9a55e', band: '#7a5a37', weapon: null },
    townswoman: { tunic: '#5f7a8a', apron: '#efe6d2', hat: 'kerchief', hatColor: '#c0573f', female: true },
    townsman: { tunic: '#7a8a5c', hat: 'cap', capColor: '#a54f3a' },
    child: { tunic: '#b28c55', scale: 0.7 },
    monk: { tunic: '#8a7458', helmet: 'hood', hoodColor: '#7a6448', weapon: 'staff' },
    noble: { tunic: '#6b4f8a', cloak: '#3b6ea5', cloakTrim: PAL.gold, hat: 'brim', hatColor: '#3b2a40', band: PAL.gold, weapon: 'sword' },
  };
  /** The roles that wear a dress when a woman (P11-12b: v0.7's innkeeper and elder). */
  const DRESSED = ['innkeeper', 'elder', 'townswoman', 'farmer', 'merchant', 'noble', 'townsman', 'monk'];
  function townLook(role, seed = 1, realm = 'valedorn') {
    const base = ROLE_LOOKS[role] || ROLE_LOOKS.townsman;
    const r = G.rng(seed * 13 + 5);
    const female = base.female ?? r() < 0.45;
    const hair = base.hair || HAIRS[Math.floor(r() * HAIRS.length)];
    const tunics = ['#7a8a5c', '#5f7a8a', '#9a6a4a', '#8a5a6a', '#6a6a8a', '#a08a5a'];
    return {
      seed,
      realm,
      skin: SKINS[Math.floor(r() * SKINS.length)],
      hair,
      hairStyle: female ? ['bun', 'long', 'braid'][Math.floor(r() * 3)] : r() < 0.2 ? 'bald' : 'short',
      beard: !female && (base.beard || r() < 0.3) ? tone(hair, -0.12) : null,
      legs: '#6b5a46',
      ...base,
      tunic: base.tunic && !['townsman', 'townswoman', 'farmer', 'child'].includes(role) ? base.tunic : tunics[Math.floor(r() * tunics.length)],
      tabard: base.tabard ? realm : null,
      female,
      dress: female && DRESSED.includes(role),
      face: faceOf(`town|${role}|${seed}`),
    };
  }

  G.fig = { K, KY, INK, weaponTip, weaponArm, shieldPos, SKINS, HAIRS, EYES, BODY, CLOAKS, ROLE_LOOKS, SHOOTS, figure, horse, fallen, bust, features, faceOf, num, defaultLook, troopLook, companionLook, heroLook, heroFrom, itemLook, dress, townLook, weapon, bow, crossbow, classic: false };
})(typeof window !== 'undefined' ? window : globalThis);
