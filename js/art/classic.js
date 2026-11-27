/* Crownless art: the 5.11 figures, kept for comparison only (P11-12b, D-P11m): Debug → "Old figures" draws the
 * people as 5.11 did, beside the storybook figures (js/art/figures.js), for side-by-side screenshots. Nothing
 * else uses it; P11-12e removes it. The text below is 5.11's.
 *
 * Crownless art: modular miniature characters (P10-G1, D-P10k).
 *
 * One renderer draws every person: soldiers, the hero, townsfolk. A *look* says what they wear and
 * carry; a *pose* says what they are doing this frame. Both are plain objects, so a look can later be
 * built from a character's real equipment, and a pose straight from the battle state (u.face, u.swing,
 * u.guard, u.shot, u.flash) with no sprite sheets.
 *
 * Look (all optional):
 *   skin, hair, hairStyle 'short' | 'long' | 'braid' | 'bun' | 'bald' | 'tied', beard (a colour)
 *   tunic, legs, boots, armour 'gambeson' | 'mail' | 'leather' | 'fur' | 'rags', tabard (a realm key)
 *   helmet 'nasal' | 'kettle' | 'great' | 'cap' | 'hood' | 'spangen' | 'crest' | 'plumed' | 'furhat'
 *   hat 'brim' | 'cap' | 'kerchief' | 'coif' (townsfolk), apron (a colour), cloak (a colour), plume
 *   shield 'kite' | 'round' | 'heater' | 'wood', realm (whose colours the shield and tabard wear)
 *   weapon 'sword' | 'axe' | 'greataxe' | 'spear' | 'bow' | 'hammer' | 'staff' | 'club' | null; quiver
 *   P11-04: weapon also 'mace' | 'greatsword' | 'recurve' | 'arbalest'; len (a blade's length), twoHanded
 *   (the other hand on the grip), shieldBack (a shield slung on the back), helmet 'bascinet', gloves (a
 *   colour), mount (a horse's look, drawn when mounted), sig (the kit's signature, for the caches)
 *   female, scale
 * Pose: face 'down' | 'up' | 'left' | 'right', walk (phase, radians), move (0..1), t (seconds),
 *   atk { phase 'windup' | 'active' | 'recovery', k 0..1 }, guard, draw (bow, 0..1), shot (0..1),
 *   hit (0..1, just struck), mounted, talk (0..1).
 * Coordinates: (x, y) is between the feet on the ground; the figure is about 38 px tall at scale 1. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, rrect, poly, fillLine, fill, tone } = G;

  const SKINS = ['#f1c9a5', '#e2b48c', '#c98f63', '#9c6a45', '#7a4e33'];
  const HAIRS = ['#3b2a20', '#6b4a2e', '#a8743e', '#d9b36a', '#8a8a86', '#2a2421', '#b25a32'];

  /** Proportions (one place to change them all). */
  const BODY = { head: 6.6, headY: -28.5, shoulder: -21.5, hem: -8.5, hip: -10, width: 6.2, leg: 3.2 };

  const steel = PAL.steel;
  /** The look parts that shoot (P11-04: the recurve and the arbalest too). */
  const SHOOTS = ['bow', 'crossbow', 'recurve', 'arbalest'];

  // ---- Small parts ----

  /** An arm from shoulder to hand: a round-capped stroke with the one outline, then the hand. */
  function arm(ctx, sx, sy, hx, hy, sleeve, skin) {
    // P11-04: `skin` is the hand's colour: a glove's when one is worn.
    ctx.lineCap = 'round';
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ellipse(ctx, hx, hy, 1.9, 1.9);
    fillLine(ctx, skin, 0.9);
  }

  /** A weapon held at (hx, hy), pointing along angle `a`. `ext` slides it along its own axis. */
  function weapon(ctx, kind, hx, hy, a, ext = 0, len = 1) {
    if (!kind) return;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.save();
    ctx.translate(hx + c * ext, hy + s * ext);
    ctx.rotate(a);
    ctx.lineCap = 'round';
    const stroke = (x0, x1, w, color) => {
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = w + 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    if (kind === 'sword') {
      stroke(-3, 1, 2.2, PAL.timber); // grip
      rrect(ctx, 0.5, -3.2, 2, 6.4, 1);
      fillLine(ctx, PAL.gold, 0.8); // crossguard
      poly(ctx, [2.5, -1.3, 15 * len, -1.1, 17.5 * len, 0, 15 * len, 1.1, 2.5, 1.3]);
      fillLine(ctx, steel, 0.9);
      ctx.fillStyle = '#e8eef2';
      ctx.fillRect(3, -0.5, 11 * len, 0.7);
    } else if (kind === 'axe' || kind === 'club' || kind === 'hammer') {
      stroke(-3, 13, 2, PAL.wood);
      if (kind === 'axe') {
        poly(ctx, [10, -1, 14, -5.5, 16.5, -4.5, 16, 3.5, 13.5, 4, 10, 1]);
        fillLine(ctx, steel, 0.9);
      } else if (kind === 'hammer') {
        rrect(ctx, 11, -3.5, 5, 7, 1);
        fillLine(ctx, '#6b7179', 0.9);
      } else {
        ellipse(ctx, 12.5, 0, 3.5, 2.6);
        fillLine(ctx, PAL.woodShade, 0.9);
      }
    } else if (kind === 'mace') {
      // P11-04: a flanged iron head on a short haft (the club is wood).
      stroke(-3, 12, 2, PAL.wood);
      ellipse(ctx, 13.5, 0, 3, 3);
      fillLine(ctx, '#7d858d', 0.9);
      for (const [fx, fy] of [[13.5, -3.6], [13.5, 3.6], [16.9, 0]]) {
        poly(ctx, [fx - 1.4, fy * 0.6, fx, fy, fx + 1.4, fy * 0.6]);
        fillLine(ctx, steel, 0.7);
      }
    } else if (kind === 'greatsword') {
      // P11-04: a long two-handed grip, a wide guard and a long blade.
      stroke(-8, 1, 2.3, PAL.timber);
      ellipse(ctx, -8.5, 0, 1.6, 1.6);
      fillLine(ctx, PAL.gold, 0.7);
      rrect(ctx, 0.5, -4.2, 2.2, 8.4, 1);
      fillLine(ctx, PAL.gold, 0.8);
      poly(ctx, [2.8, -1.6, 24 * len, -1.3, 27 * len, 0, 24 * len, 1.3, 2.8, 1.6]);
      fillLine(ctx, steel, 0.9);
      ctx.fillStyle = '#e8eef2';
      ctx.fillRect(3.5, -0.5, 19 * len, 0.7);
    } else if (kind === 'greataxe') {
      stroke(-8, 20, 2.2, PAL.wood);
      poly(ctx, [15, -1, 19, -8, 23, -7, 23, 6, 19, 7, 15, 1]);
      fillLine(ctx, steel, 0.9);
    } else if (kind === 'spear' || kind === 'lance' || kind === 'pike') {
      const L = (kind === 'lance' ? 40 : kind === 'pike' ? 48 : 34) * len;
      stroke(-12 * len, L, 1.8, PAL.wood);
      poly(ctx, [L - 1, -2.3, L + 7, 0, L - 1, 2.3]);
      fillLine(ctx, steel, 0.9);
      if (kind === 'lance') {
        poly(ctx, [L - 6, -1, L - 14, -5, L - 12, -1]);
        fill(ctx, PAL.crimson);
      }
    } else if (kind === 'staff') {
      stroke(-10, 22, 2, PAL.woodShade);
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
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-1, -h);
    if (recurve) {
      // P11-04: the horse archer's short bow: the tips curl forward, away from the archer.
      ctx.moveTo(2, -h - 1.5);
      ctx.quadraticCurveTo(-1.5, -h + 0.5, 1.5, -h * 0.55);
      ctx.quadraticCurveTo(6, 0, 1.5, h * 0.55);
      ctx.quadraticCurveTo(-1.5, h - 0.5, 2, h + 1.5);
    } else ctx.quadraticCurveTo(7, 0, -1, h);
    ctx.stroke();
    ctx.strokeStyle = recurve ? '#6b4a2e' : PAL.wood;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    const sx = -1 - pull * 7;
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, -h);
    ctx.lineTo(sx, 0);
    ctx.lineTo(-1, h);
    ctx.stroke();
    if (pull > 0.15) {
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      poly(ctx, [9, -1.6, 12.5, 0, 9, 1.6]);
      fill(ctx, steel);
    }
    ctx.restore();
  }

  /**
   * A crossbow held level, pointing along +x (local): the stock, the prod across its front, and the
   * string drawn back to the nut while it is loaded (`pull` 1), with the bolt on top. A crossbow loads
   * slowly (the troop's cooldown), so `pull` rises over the whole reload.
   */
  function crossbow(ctx, x, y, pull, dir = 1, windlass = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.lineCap = 'round';
    const line = (x0, y0, x1, y1, w, color) => {
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = w + 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    line(-5, 1.5, 9, 0, 2.6, PAL.wood);
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.quadraticCurveTo(12.5, 0, 10, 7);
    ctx.stroke();
    ctx.strokeStyle = PAL.steelShade;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    const nx = 10 - Math.max(0, Math.min(1, pull)) * 7;
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.lineTo(nx, 0);
    ctx.lineTo(10, 7);
    ctx.stroke();
    if (windlass) {
      // P11-04: the arbalest's windlass at the butt: a drum and its two cranks.
      ellipse(ctx, -6, 1.5, 2.4, 2.4);
      fillLine(ctx, PAL.steelShade, 0.8);
      line(-6, -2.5, -6, 5.5, 1, steel);
    }
    if (pull > 0.95) {
      line(nx, -0.8, 14, -0.8, 1.1, PAL.wood);
      poly(ctx, [14, -2.2, 16.5, -0.8, 14, 0.6]);
      fill(ctx, steel);
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  function shield(ctx, L, x, y, r, back) {
    const R = G.realm(L.realm || 'valedorn');
    const shape = L.shield === 'wood' ? 'round' : L.shield;
    G.shieldShape(ctx, x, y, r, shape, L.shield === 'wood' ? { ...R, wood: true, device: 'none' } : R, back);
  }

  /** The head: skin, a simple face for the facing, hair, then any helmet or hat. */
  function head(ctx, L, face, t) {
    const r = BODY.head;
    const y = BODY.headY;
    const hair = L.hair || HAIRS[0];
    const front = face === 'down';
    const back = face === 'up';
    // Long hair and braids hang behind the head (front and side views).
    if (!back && (L.hairStyle === 'long' || L.hairStyle === 'braid') && !hides(L)) {
      rrect(ctx, -r * 0.95, y - 2, r * 1.9, r * 1.65, 3);
      fillLine(ctx, hair);
    }
    ellipse(ctx, 0, y, r, r * 0.98);
    fillLine(ctx, L.skin || SKINS[0]);
    // Ears / cheeks shade: one flat crescent on the right.
    if (!back) {
      ctx.fillStyle = tone(L.skin || SKINS[0], -0.1);
      ellipse(ctx, r * 0.45, y + 1.2, r * 0.42, r * 0.6);
      ctx.fill();
    }
    if (front) {
      ctx.fillStyle = '#2c211b';
      ellipse(ctx, -2.3, y + 0.6, 0.85, 1.1);
      ctx.fill();
      ellipse(ctx, 2.3, y + 0.6, 0.85, 1.1);
      ctx.fill();
      if (L.beard) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, y + 1.5);
        ctx.quadraticCurveTo(0, y + r * 1.55, r * 0.8, y + 1.5);
        ctx.quadraticCurveTo(0, y + 4.5, -r * 0.8, y + 1.5);
        fillLine(ctx, L.beard, 0.8);
      } else if (L.talk) {
        ctx.fillStyle = '#7a3e2e';
        ellipse(ctx, 0, y + 3.6, 1.2, 0.7 + L.talk * 0.6);
        ctx.fill();
      }
    } else if (!back) {
      // Profile, facing +x: one eye and a small nose.
      ctx.fillStyle = '#2c211b';
      ellipse(ctx, 3, y + 0.4, 0.8, 1.05);
      ctx.fill();
      ctx.fillStyle = tone(L.skin || SKINS[0], -0.06);
      ellipse(ctx, r * 0.95, y + 1.8, 1.4, 1.2);
      ctx.fill();
      if (L.beard) {
        ctx.beginPath();
        ctx.moveTo(r * 0.95, y + 2);
        ctx.quadraticCurveTo(r * 0.7, y + r * 1.4, -1, y + 3);
        ctx.quadraticCurveTo(r * 0.4, y + 3, r * 0.95, y + 2);
        fillLine(ctx, L.beard, 0.8);
      }
    }
    hairTop(ctx, L, face, r, y, hair);
    helmet(ctx, L, face, r, y, t);
  }

  const hides = (L) => ['great', 'hood', 'furhat', 'coif', 'bascinet'].includes(L.helmet) || L.hat === 'coif';

  function hairTop(ctx, L, face, r, y, hair) {
    if (L.hairStyle === 'bald' || hides(L)) return;
    const helmeted = L.helmet && L.helmet !== 'cap';
    if (helmeted && face !== 'up') return; // a helmet covers the top
    ctx.beginPath();
    if (face === 'up') {
      ctx.arc(0, y, r * 1.02, Math.PI * 0.92, Math.PI * 2.08);
      ctx.lineTo(r * 0.9, y + r * 0.8);
      ctx.quadraticCurveTo(0, y + r * 1.15, -r * 0.9, y + r * 0.8);
    } else if (face === 'down') {
      ctx.arc(0, y, r * 1.03, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(r * 0.3, y - r * 0.35, -r * 0.2, y - r * 0.2);
      ctx.quadraticCurveTo(-r * 0.6, y - r * 0.1, -r * 1.0, y + r * 0.15);
    } else {
      ctx.arc(0, y, r * 1.03, Math.PI * 0.85, Math.PI * 1.9);
      ctx.quadraticCurveTo(0, y - r * 0.4, -r * 0.4, y + r * 0.3);
      ctx.lineTo(-r * 0.95, y + r * 0.55);
    }
    ctx.closePath();
    fillLine(ctx, hair, 0.9);
    if (L.hairStyle === 'bun' && face !== 'down') {
      ellipse(ctx, face === 'up' ? 0 : -r * 0.85, y - r * 0.45, 2.6, 2.6);
      fillLine(ctx, hair, 0.8);
    }
    if (L.hairStyle === 'braid' && face === 'up') {
      rrect(ctx, -1.6, y + r * 0.6, 3.2, 8, 1.6);
      fillLine(ctx, hair, 0.8);
    }
    if (L.hairStyle === 'tied' && face !== 'down') {
      ellipse(ctx, face === 'up' ? 0 : -r * 0.95, y + r * 0.2, 1.8, 3);
      fillLine(ctx, hair, 0.8);
    }
  }

  function helmet(ctx, L, face, r, y, t) {
    const kind = L.helmet || null;
    const hat = L.hat || null;
    const side = face === 'left' || face === 'right';
    if (kind === 'nasal' || kind === 'plumed' || kind === 'crest' || kind === 'spangen') {
      // A dome over the top half, a rim, and the nasal bar in front.
      ctx.beginPath();
      if (kind === 'nasal' || kind === 'plumed') {
        ctx.moveTo(-r * 1.08, y + 0.5);
        ctx.quadraticCurveTo(-r * 1.0, y - r * 1.3, 0, y - r * 1.55);
        ctx.quadraticCurveTo(r * 1.0, y - r * 1.3, r * 1.08, y + 0.5);
      } else {
        ctx.moveTo(-r * 1.08, y + 0.5);
        ctx.arc(0, y + 0.5, r * 1.08, Math.PI, Math.PI * 2);
      }
      ctx.closePath();
      fillLine(ctx, steel);
      ctx.fillStyle = PAL.steelShade;
      ellipse(ctx, r * 0.45, y - r * 0.35, r * 0.4, r * 0.6);
      ctx.fill();
      ctx.fillStyle = '#e3e9ee';
      ellipse(ctx, -r * 0.45, y - r * 0.75, r * 0.3, r * 0.18);
      ctx.fill();
      rrect(ctx, -r * 1.12, y - 0.6, r * 2.24, 2.2, 1);
      fillLine(ctx, PAL.steelShade, 0.8);
      if (kind === 'spangen') {
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y - r * 1.05);
        ctx.lineTo(0, y);
        ctx.stroke();
        if (face !== 'up') {
          // Cheek guards.
          ctx.fillStyle = PAL.steelShade;
          ctx.fillRect(side ? -r * 0.2 : -r * 1.0, y + 0.5, 2.2, 4);
          if (!side) ctx.fillRect(r * 0.78, y + 0.5, 2.2, 4);
        }
      }
      if (face === 'down' && kind !== 'spangen') {
        rrect(ctx, -0.9, y - 0.5, 1.8, 4.6, 0.8);
        fillLine(ctx, PAL.steelShade, 0.7);
      } else if (side && kind !== 'spangen') {
        rrect(ctx, r * 0.75, y - 0.5, 1.8, 4.4, 0.8);
        fillLine(ctx, PAL.steelShade, 0.7);
      }
      if (kind === 'plumed' || kind === 'crest') {
        const color = L.plume || PAL.crimson;
        const wave = Math.sin(t * 4) * 0.8;
        ctx.beginPath();
        if (side || kind === 'plumed') {
          ctx.moveTo(-0.5, y - r * 1.45);
          ctx.quadraticCurveTo(-r * 0.9 + wave, y - r * 2.4, -r * 1.7 + wave, y - r * 1.4);
          ctx.quadraticCurveTo(-r * 0.8, y - r * 1.55, -0.5, y - r * 1.2);
        } else {
          rrect(ctx, -1.6, y - r * 1.9, 3.2, r * 0.8, 1.4);
        }
        fillLine(ctx, color, 0.9);
      }
      return;
    }
    if (kind === 'bascinet') {
      // P11-04: a pointed skull drawn down over the ears, an open face, and a mail aventail at the neck.
      ctx.fillStyle = '#9aa3ab';
      rrect(ctx, -r * 1.15, y - 0.5, r * 2.3, 4.2, 1.5);
      fillLine(ctx, '#9aa3ab', 0.8);
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, y + 1.5);
      ctx.quadraticCurveTo(-r * 1.15, y - r * 1.2, 0, y - r * 1.75);
      ctx.quadraticCurveTo(r * 1.15, y - r * 1.2, r * 1.1, y + 1.5);
      if (face === 'down') {
        ctx.lineTo(r * 0.7, y + 1.5);
        ctx.quadraticCurveTo(r * 0.7, y - r * 0.55, 0, y - r * 0.6);
        ctx.quadraticCurveTo(-r * 0.7, y - r * 0.55, -r * 0.7, y + 1.5);
      } else if (side) ctx.lineTo(r * 0.3, y + 1.5);
      ctx.closePath();
      fillLine(ctx, steel);
      ctx.fillStyle = PAL.steelShade;
      ellipse(ctx, r * 0.5, y - r * 0.6, r * 0.3, r * 0.5);
      ctx.fill();
      return;
    }
    if (kind === 'sallet') {
      // The southern sallet: a rounded bowl with a tail sweeping down the back of the neck.
      ctx.beginPath();
      ctx.arc(0, y - 0.3, r * 1.1, Math.PI, Math.PI * 2);
      if (face === 'up' || side) ctx.lineTo(r * 1.1, y + 1);
      ctx.closePath();
      fillLine(ctx, steel);
      if (side || face === 'up') {
        poly(ctx, side ? [-r * 1.1, y - 0.5, -r * 1.75, y + 3.5, -r * 0.6, y + 1.8] : [-r * 1.15, y, r * 1.15, y, r * 0.9, y + 3.5, -r * 0.9, y + 3.5]);
        fillLine(ctx, PAL.steelShade, 0.9);
      }
      ctx.fillStyle = PAL.steelShade;
      ellipse(ctx, r * 0.45, y - r * 0.5, r * 0.38, r * 0.4);
      ctx.fill();
      if (face !== 'up') {
        ctx.fillStyle = '#2c3138';
        ctx.fillRect(side ? r * 0.2 : -r * 0.75, y - 0.4, side ? r * 0.85 : r * 1.5, 1.4);
      }
      return;
    }
    if (kind === 'kettle') {
      ellipse(ctx, 0, y - r * 0.3, r * 1.55, r * 0.42);
      fillLine(ctx, steel);
      ctx.beginPath();
      ctx.arc(0, y - r * 0.35, r * 0.95, Math.PI, Math.PI * 2);
      ctx.closePath();
      fillLine(ctx, steel);
      ctx.fillStyle = PAL.steelShade;
      ellipse(ctx, r * 0.42, y - r * 0.7, r * 0.35, r * 0.3);
      ctx.fill();
      return;
    }
    if (kind === 'great') {
      // A barrel helm: flat top, eye slit, breaths, on the heavy soldier.
      rrect(ctx, -r * 1.05, y - r * 1.15, r * 2.1, r * 2.15, r * 0.45);
      fillLine(ctx, steel);
      ctx.fillStyle = PAL.steelShade;
      ctx.fillRect(r * 0.35, y - r * 1.1, r * 0.65, r * 2.05);
      if (face !== 'up') {
        ctx.fillStyle = '#2c3138';
        ctx.fillRect(side ? r * 0.1 : -r * 0.8, y - r * 0.15, side ? r * 0.9 : r * 1.6, 1.6);
        ctx.fillRect(side ? r * 0.55 : -0.7, y - r * 0.15, 1.4, r * 0.9);
      }
      return;
    }
    if (kind === 'hood' || kind === 'furhat') {
      const col = kind === 'furhat' ? '#8a6a48' : L.hoodColor || '#6c6a4a';
      ctx.beginPath();
      ctx.arc(0, y - 0.5, r * 1.18, Math.PI * 0.78, Math.PI * 2.22);
      ctx.closePath();
      fillLine(ctx, col);
      if (face === 'down') {
        ellipse(ctx, 0, y + 1.4, r * 0.74, r * 0.72);
        fill(ctx, L.skin || SKINS[0]);
        ctx.fillStyle = '#2c211b';
        ellipse(ctx, -2.1, y + 1.2, 0.8, 1);
        ctx.fill();
        ellipse(ctx, 2.1, y + 1.2, 0.8, 1);
        ctx.fill();
        if (L.beard) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.62, y + 2.5);
          ctx.quadraticCurveTo(0, y + r * 1.4, r * 0.62, y + 2.5);
          fillLine(ctx, L.beard, 0.7);
        }
      } else if (side) {
        ellipse(ctx, r * 0.55, y + 1.2, r * 0.45, r * 0.65);
        fill(ctx, L.skin || SKINS[0]);
        ctx.fillStyle = '#2c211b';
        ellipse(ctx, r * 0.6, y + 0.6, 0.75, 1);
        ctx.fill();
      }
      if (kind === 'furhat') {
        ctx.fillStyle = tone(col, 0.18);
        for (let i = -2; i <= 2; i++) {
          ellipse(ctx, i * r * 0.45, y - r * 0.95 + Math.abs(i) * 0.9, r * 0.32, r * 0.24);
          ctx.fill();
        }
      } else if (face === 'up') {
        poly(ctx, [-r * 0.5, y + r * 0.9, 0, y + r * 1.9, r * 0.5, y + r * 0.9]);
        fillLine(ctx, col, 0.8);
      }
      return;
    }
    if (kind === 'cap' || hat === 'cap') {
      ctx.beginPath();
      ctx.arc(0, y - 0.5, r * 1.04, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      fillLine(ctx, L.capColor || PAL.leather || '#8a5f3c');
      return;
    }
    if (hat === 'brim') {
      ellipse(ctx, 0, y - r * 0.55, r * 1.6, r * 0.45);
      fillLine(ctx, L.hatColor || '#7d6a48');
      ellipse(ctx, 0, y - r * 0.95, r * 0.8, r * 0.55);
      fillLine(ctx, L.hatColor || '#7d6a48');
      ctx.fillStyle = L.band || PAL.crimson;
      ctx.fillRect(-r * 0.8, y - r * 0.8, r * 1.6, 1.4);
      return;
    }
    if (hat === 'kerchief') {
      ctx.beginPath();
      ctx.arc(0, y - 0.3, r * 1.08, Math.PI * 1.0, Math.PI * 2.0);
      ctx.quadraticCurveTo(r * 0.6, y + 1, -r * 1.08, y - 0.3);
      fillLine(ctx, L.hatColor || '#c0573f');
      if (face === 'up') {
        poly(ctx, [-2, y + 2, 2, y + 2, 0, y + 6]);
        fillLine(ctx, L.hatColor || '#c0573f', 0.8);
      }
      return;
    }
    if (hat === 'coif') {
      ctx.beginPath();
      ctx.arc(0, y - 0.3, r * 1.12, Math.PI * 0.8, Math.PI * 2.2);
      ctx.closePath();
      fillLine(ctx, '#efe6d2');
      if (face === 'down') {
        ellipse(ctx, 0, y + 1.3, r * 0.72, r * 0.72);
        fill(ctx, L.skin || SKINS[0]);
        ctx.fillStyle = '#2c211b';
        ellipse(ctx, -2.1, y + 1.2, 0.8, 1);
        ctx.fill();
        ellipse(ctx, 2.1, y + 1.2, 0.8, 1);
        ctx.fill();
      } else if (face !== 'up') {
        ellipse(ctx, r * 0.55, y + 1.2, r * 0.45, r * 0.65);
        fill(ctx, L.skin || SKINS[0]);
      }
    }
  }

  /** Torso: tunic or armour, a tabard in the realm's colour, a belt; an apron for townsfolk. */
  function torso(ctx, L, face, breathe) {
    const w = BODY.width * (L.female ? 0.94 : 1) * (L.armour === 'mail' || L.armour === 'fur' ? 1.08 : 1);
    const side = face === 'left' || face === 'right';
    const ww = side ? w * 0.78 : w;
    const top = BODY.shoulder + breathe;
    const hem = BODY.hem;
    const base = L.armour === 'mail' ? '#9aa3ab' : L.armour === 'leather' ? '#8a6240' : L.armour === 'gambeson' ? L.tunic || '#c8b48a' : L.tunic || '#9c8a66';
    ctx.beginPath();
    ctx.moveTo(-ww, top + 1.5);
    ctx.quadraticCurveTo(-ww, top - 0.8, -ww + 2, top - 0.8);
    ctx.lineTo(ww - 2, top - 0.8);
    ctx.quadraticCurveTo(ww, top - 0.8, ww, top + 1.5);
    ctx.lineTo(ww + 1.4, hem);
    ctx.quadraticCurveTo(0, hem + 1.6, -ww - 1.4, hem);
    ctx.closePath();
    fillLine(ctx, base);
    ctx.save();
    ctx.clip();
    // Shade on the right side.
    ctx.fillStyle = tone(base, -0.16);
    ctx.fillRect(ww * 0.35, top - 2, ww, hem - top + 4);
    if (L.armour === 'mail') {
      ctx.strokeStyle = tone(base, -0.25);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let yy = top + 2; yy < hem; yy += 2.6) {
        ctx.moveTo(-ww, yy);
        ctx.lineTo(ww, yy);
      }
      ctx.stroke();
    } else if (L.armour === 'gambeson') {
      ctx.strokeStyle = tone(base, -0.2);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let xx = -ww + 2.5; xx < ww; xx += 3) {
        ctx.moveTo(xx, top);
        ctx.lineTo(xx, hem);
      }
      ctx.stroke();
    } else if (L.armour === 'rags') {
      ctx.fillStyle = tone(base, 0.12);
      ctx.fillRect(-ww + 1, top + 5, 3.5, 3);
      ctx.fillRect(ww - 5, hem - 5, 3, 3);
    }
    if (L.tabard && face !== 'up') {
      const R = G.realm(L.tabard);
      const tw = side ? ww * 0.75 : ww * 0.62;
      const tx = side ? ww * 0.15 : 0;
      ctx.fillStyle = R.color;
      ctx.fillRect(tx - tw, top + 1, tw * 2, hem - top + 2);
      ctx.fillStyle = R.trim;
      ctx.fillRect(tx - tw, hem - 1.6, tw * 2, 1.6);
      if (!side) G.device(ctx, tx, top + 6.5, 2.4, R);
    } else if (L.tabard && face === 'up') {
      ctx.fillStyle = G.realm(L.tabard).color;
      ctx.fillRect(-ww * 0.62, top + 1, ww * 1.24, hem - top + 2);
    }
    if (L.apron && face !== 'up') {
      ctx.fillStyle = L.apron;
      ctx.fillRect(side ? 0 : -ww * 0.6, top + 6, side ? ww + 1 : ww * 1.2, hem - top - 4);
    }
    ctx.restore();
    // Belt.
    ctx.fillStyle = L.belt || '#5a3f2a';
    ctx.fillRect(-ww - 0.6, hem - 5.2, ww * 2 + 1.2, 1.8);
    if (L.armour === 'fur' || L.fur) {
      // A fur collar: three soft lumps across the shoulders (the northern silhouette).
      ctx.beginPath();
      for (const fx of side ? [-1.5, 2] : [-ww * 0.7, 0, ww * 0.7]) {
        ctx.moveTo(fx + 3.2, top + 0.5);
        ctx.arc(fx, top + 0.5, 3.2, 0, Math.PI * 2);
      }
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = '#b39470';
      ctx.fill();
    }
    if (L.armour === 'mail' && L.pauldrons) {
      for (const px of side ? [1] : [-ww, ww]) {
        ellipse(ctx, px, top + 1.5, 3.4, 2.6);
        fillLine(ctx, steel, 0.9);
      }
    }
  }

  /** Legs and boots; a stride from the walk phase (front/back views lift, side views swing). */
  function legs(ctx, L, face, walk, move, mounted) {
    const side = face === 'left' || face === 'right';
    const legC = L.legs || '#6b5a46';
    const boot = L.boots || '#4a3628';
    const st = Math.sin(walk) * move;
    if (mounted) {
      // Seated: the near leg hangs down the horse's side.
      const pairs = side ? [[1.5, 0]] : [[-5.5, 0], [5.5, 0]];
      for (const [lx] of pairs) {
        rrect(ctx, lx - 1.7, BODY.hip, 3.4, 8, 1.6);
        fillLine(ctx, legC, 0.9);
        rrect(ctx, lx - 2, BODY.hip + 6, 4, 3.6, 1.5);
        fillLine(ctx, boot, 0.9);
      }
      return;
    }
    const pairs = side ? [[-st * 3.2, 0], [st * 3.2, 0]] : [[-2.6, Math.max(0, st) * 1.6], [2.6, Math.max(0, -st) * 1.6]];
    for (const [lx, lift] of pairs) {
      rrect(ctx, lx - BODY.leg / 2, BODY.hip, BODY.leg, -BODY.hip - lift - 1.5, 1.4);
      fillLine(ctx, legC, 0.9);
      ellipse(ctx, lx + (side ? 0.8 : 0), -1.6 - lift, 2.3, 1.7);
      fillLine(ctx, boot, 0.9);
    }
  }

  function cloak(ctx, L, face, move, t, over) {
    if (!L.cloak) return;
    const sway = Math.sin(t * 2.2) * 0.6 + move * 1.6;
    const top = BODY.shoulder + 0.5;
    ctx.beginPath();
    if (face === 'left' || face === 'right') {
      if (over) return;
      ctx.moveTo(-2, top - 0.5);
      ctx.lineTo(2.5, top);
      ctx.quadraticCurveTo(0, -12, -5 - sway * 2, -4);
      ctx.lineTo(-10 - sway * 2.4, -6);
      ctx.quadraticCurveTo(-8, -16, -2, top - 0.5);
    } else if (face === 'up') {
      if (!over) return;
      ctx.moveTo(-6, top);
      ctx.lineTo(6, top);
      ctx.lineTo(8 + sway * 0.4, -4.5);
      ctx.quadraticCurveTo(0, -2.8 + sway * 0.3, -8 - sway * 0.4, -4.5);
    } else {
      if (over) return;
      ctx.moveTo(-6, top);
      ctx.lineTo(6, top);
      ctx.lineTo(9 + sway * 0.3, -5);
      ctx.lineTo(-9 - sway * 0.3, -5);
    }
    ctx.closePath();
    fillLine(ctx, L.cloak);
    if (L.cloakTrim && face === 'up') {
      ctx.strokeStyle = L.cloakTrim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7.6 - sway * 0.4, -5.4);
      ctx.quadraticCurveTo(0, -3.6 + sway * 0.3, 7.6 + sway * 0.4, -5.4);
      ctx.stroke();
    }
  }

  // ---- The weapon arm for each facing ----

  /**
   * Where the weapon hand is and where the weapon points, from the pose. Angles: 0 = +x (local
   * right), -π/2 = up. Melee follows the swing's real phases (windup raises, active sweeps through,
   * recovery returns); a spear thrusts along its line instead of sweeping.
   */
  function weaponArm(L, P, face) {
    const side = face === 'left' || face === 'right';
    const up = face === 'up';
    const kind = L.weapon;
    const spear = kind === 'spear' || kind === 'lance' || kind === 'pike';
    // Rest: [hand x, hand y, angle].
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
        // The spear levels at the facing and thrusts out along its line.
        const aim = side ? -0.05 + tilt : up ? -Math.PI / 2 : Math.PI / 2;
        len = side ? 1 : 0.62; // foreshortened toward or away from the viewer
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
      // P11-05: a weapon guard: the weapon raised across the body.
      a = side ? -0.35 : up ? -Math.PI + 0.3 : -0.3;
      hy = -17;
      if (!side) hx = up ? 5 : -5;
    }
    if (P.work) {
      // A smith's hammer or a labourer's tool: a steady downward beat.
      const k = (Math.sin(P.t * 5) + 1) / 2;
      a = side ? -2.2 + k * 2.4 : -2.4 + k * 2.6;
      hy = -14 - (1 - k) * 4;
    }
    return { hx, hy, a, ext, len, spear };
  }

  // ---- The figure ----

  function figure(ctx, x, y, L, P) {
    const s = (L.scale || 1) * (P.scale || 1);
    const face = P.face || 'down';
    const side = face === 'left' || face === 'right';
    const up = face === 'up';
    const t = P.t || 0;
    const move = Math.min(1, P.move || 0);
    const walk = P.walk || 0;
    const bob = move ? Math.abs(Math.sin(walk)) * 1.1 * move : 0;
    const breathe = move ? 0 : Math.sin(t * 1.8 + (L.seed || 0)) * 0.35;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (!P.mounted) G.shadow(ctx, 0.8, 0.5, 8.2, 3.1, 0);
    if (face === 'left') ctx.scale(-1, 1);
    if (P.hit > 0) ctx.translate((face === 'down' ? 0 : -1.4) * P.hit, (face === 'down' ? -1.2 : 0) * P.hit); // a small recoil
    if (P.stagger > 0) ctx.rotate(Math.sin(P.stagger * Math.PI * 3) * 0.12 * P.stagger); // P11-05: a short sway
    ctx.translate(0, -bob - (P.mounted ? 13 : 0));

    const wa = weaponArm(L, P, face);
    const ranged = SHOOTS.includes(L.weapon);
    const shoot = (x, y, pull, dir) => (L.weapon === 'crossbow' || L.weapon === 'arbalest' ? crossbow(ctx, x, y, pull, dir, L.weapon === 'arbalest') : bow(ctx, x, y, pull, dir, L.bowSize || 1, L.weapon === 'recurve'));
    const guard = Boolean(P.guard && L.shield && !P.broken);
    const skin = L.gloves || L.skin || SKINS[0]; // P11-04: a glove's colour on the hands
    // P11-04: a two-handed weapon's other hand sits on the grip, behind the weapon hand.
    const grip = L.twoHanded && !ranged && L.weapon ? { x: wa.hx + Math.cos(wa.a) * (wa.ext - 3.5), y: wa.hy + Math.sin(wa.a) * (wa.ext - 3.5) } : null;
    // P11-04: a shield slung on the back (a two-handed weapon or a bow in hand): its back toward the
    // viewer unless they face away.
    const slung = () => L.shieldBack && shield(ctx, { ...L, shield: L.shieldBack }, side ? -4.5 : 0, -16.5, 6 * 0.92, !up);
    const sleeve = L.armour === 'mail' ? '#9aa3ab' : L.armour === 'leather' ? '#8a6240' : L.tunic || '#9c8a66';

    // Shield position for the facing (character's left arm). P11-05: pressed back toward the body under
    // pressure; lowered when the guard is broken.
    const sh = shieldPos(face, guard, L);
    if (guard && P.press) sh.x *= 1 - 0.35 * P.press;
    if (P.broken && L.shield) sh.y += 4;
    const drawShield = () => L.shield && shield(ctx, L, sh.x, sh.y, sh.r * (guard ? 1.12 : 1), up && !guard);
    const drawWeapon = () => {
      if (ranged || !L.weapon) return;
      weapon(ctx, L.weapon, wa.hx, wa.hy, wa.a, wa.ext, wa.len);
    };
    const drawTrail = () => {
      // A short, restrained arc behind a sweeping blade while the blow is live (not for spears).
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

    // Back layer: what is behind the body for this facing.
    if (!up) slung();
    cloak(ctx, L, face, move, t, false);
    if (up) {
      drawWeapon();
      if (!guard) drawShield();
      if (ranged) shoot(-5.5, -17, P.draw || 0, -1);
    }
    if (side && L.shield && !guard) {
      // The far arm's shield shows behind the body, toward the back.
      shield(ctx, L, -3.5, -15, sh.r * 0.95, false);
    }
    if (L.quiver && !up) {
      rrect(ctx, side ? -6.5 : 3.5, -24, 3.6, 11, 1.4);
      fillLine(ctx, '#7a5434', 0.9);
    }

    legs(ctx, L, face, walk, move, P.mounted);
    torso(ctx, L, face, breathe);
    if (L.quiver && up) {
      rrect(ctx, 1.5, -25, 4, 12, 1.6);
      fillLine(ctx, '#7a5434', 0.9);
      ctx.fillStyle = '#efe6cf';
      ctx.fillRect(2, -27, 3, 2.5);
    }
    cloak(ctx, L, face, move, t, true);
    if (up) slung(); // seen from behind: on the back, over the cloak

    // Arms. The shield arm reaches its shield; the weapon arm its hand.
    const shoulderY = BODY.shoulder + 2 + breathe;
    const swingA = move && !P.atk && !ranged ? Math.sin(walk) * 1.4 * move : 0;
    if (side) {
      if (ranged) {
        const pull = P.draw || 0;
        shoot(6.5, -16.5, pull, 1);
        arm(ctx, 0, shoulderY, 6, -16, sleeve, skin);
        arm(ctx, -1, shoulderY, 5.5 - pull * 7, -16.5, sleeve, skin);
      } else {
        drawTrail();
        if (guard) drawShield();
        if (grip) arm(ctx, -1, shoulderY, grip.x, grip.y, tone(sleeve, -0.12), skin); // the far arm, on the grip
        arm(ctx, 0, shoulderY, wa.hx + swingA * 0.5, wa.hy, sleeve, skin);
        drawWeapon();
      }
    } else if (up) {
      if (grip) arm(ctx, -BODY.width + 0.8, shoulderY, grip.x, grip.y, sleeve, skin);
      else arm(ctx, -BODY.width + 0.8, shoulderY, -6.5 + (ranged ? 1 : 0), ranged ? -17 : -13 + swingA, sleeve, skin);
      arm(ctx, BODY.width - 0.8, shoulderY, ranged ? 2 : wa.hx, ranged ? -18 : wa.hy - swingA, sleeve, skin);
    } else {
      // Facing the viewer.
      if (ranged) {
        arm(ctx, BODY.width - 0.8, shoulderY, 6, -17, sleeve, skin);
        arm(ctx, -BODY.width + 0.8, shoulderY, -1 + (P.draw || 0) * 2, -17.5, sleeve, skin);
      } else {
        if (grip) arm(ctx, BODY.width - 0.8, shoulderY, grip.x, grip.y, sleeve, skin);
        else arm(ctx, BODY.width - 0.8, shoulderY, guard ? 2.5 : 6.6, guard ? -15 : -12.5 + swingA, sleeve, skin);
        arm(ctx, -BODY.width + 0.8, shoulderY, wa.hx, wa.hy - swingA, sleeve, skin);
      }
    }

    head(ctx, L, face, t);

    // Front layer.
    if (!side && !up) {
      drawTrail();
      if (ranged) shoot(6, -17, P.draw || 0, 1);
      drawShield();
      drawWeapon();
    }
    if (up && guard) drawShield();
    if (side && ranged && P.shot > 0 && !P.reduced) {
      ctx.fillStyle = `rgba(255,246,214,${P.shot})`;
      ellipse(ctx, 12, -16.5, 2.4, 1.6);
      ctx.fill();
    }
    if (P.hit > 0 && !P.reduced) {
      // Struck: a brief pale flash over the body, not a splash of colour.
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
    const y = wa.hy + Math.sin(wa.a) * d - (P.mounted ? 13 : 0);
    return { x: face === 'left' ? -x : x, y };
  }

  function shieldPos(face, guard, L) {
    const r = L.shield === 'kite' ? 6.2 : L.shield === 'heater' ? 6 : 6.4;
    if (face === 'down') return guard ? { x: 0.5, y: -15, r } : { x: 7.8, y: -13.5, r };
    if (face === 'up') return guard ? { x: -1, y: -16, r } : { x: -7.6, y: -14, r };
    return guard ? { x: 7.2, y: -15.5, r } : { x: -3.5, y: -15, r };
  }

  // ---- Horses ----

  /**
   * A horse with its rider (the rider is drawn by `figure` with `mounted`). Look: coat, mane,
   * cloth (a realm key for the saddle cloth), pony (shaggier, smaller). Pose as a figure's.
   */
  function horse(ctx, x, y, H, P, rider) {
    // Always in profile: a horse seen end-on reads as a tall man. Facing up or down, it keeps the
    // side it last turned to (P.hface), and the rider's lance tilts toward the real facing (P.aim).
    const face = P.face === 'left' || P.face === 'right' ? P.face : P.hface || 'right';
    const s = (H.scale || 1) * (P.scale || 1) * (H.pony ? 0.9 : 1);
    const coat = H.coat || '#8a5a3a';
    const mane = H.mane || '#3b2a20';
    const move = Math.min(1, P.move || 0);
    const walk = P.walk || 0;
    const R = H.cloth ? G.realm(H.cloth) : null;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    G.shadow(ctx, 1, 0.5, 16, 4, 0);
    if (face === 'left') ctx.scale(-1, 1);
    const bob = Math.abs(Math.sin(walk)) * 1.4 * move;
    ctx.translate(0, -bob);
    const leg = (lx, phase, dark) => {
      const sw = Math.sin(walk + phase) * 0.42 * move;
      ctx.save();
      ctx.translate(lx, -12);
      ctx.rotate(sw);
      rrect(ctx, -1.7, 0, 3.4, 11.5 + bob, 1.4);
      fillLine(ctx, dark ? tone(coat, -0.22) : coat, 0.9);
      ctx.fillStyle = '#3a2f28';
      ctx.fillRect(-1.8, 9.8 + bob, 3.6, 2);
      ctx.restore();
    };
      leg(9.5, Math.PI, true);
      leg(-8, 0, true);
      // Tail.
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.quadraticCurveTo(-18, -14 + Math.sin(P.t * 3) * 1.5, -16, -7);
      ctx.stroke();
      ctx.strokeStyle = mane;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineCap = 'butt';
      ellipse(ctx, 0, -16, 13.5, 6.6);
      fillLine(ctx, coat);
      ctx.fillStyle = tone(coat, -0.16);
      ellipse(ctx, 2, -12.5, 11, 3);
      ctx.fill();
      // Neck and head.
      poly(ctx, [7, -20, 12.5, -29, 17, -27.5, 13, -13.5]);
      fillLine(ctx, coat);
      ctx.save();
      ctx.translate(17.5, -27);
      ctx.rotate(0.55);
      ellipse(ctx, 1.5, 0, 6.4, 3.3);
      fillLine(ctx, coat);
      ctx.restore();
      poly(ctx, [12.5, -30.5, 13.5, -34, 15, -30]);
      fillLine(ctx, coat, 0.8);
      ctx.fillStyle = '#2c211b';
      ellipse(ctx, 16.6, -27.6, 0.8, 0.9);
      ctx.fill();
      ctx.strokeStyle = mane;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(7, -21);
      ctx.lineTo(12, -30);
      ctx.stroke();
      if (R) {
        rrect(ctx, -6.5, -21, 12, 9, 2);
        fillLine(ctx, R.color, 0.9);
        ctx.fillStyle = R.trim;
        ctx.fillRect(-6, -13.6, 11, 1.4);
      } else {
        rrect(ctx, -5, -22, 9, 6, 2);
        fillLine(ctx, '#6b4a30', 0.9);
      }
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
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    G.shadow(ctx, 0, 1, 15, 3.5, 0);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.translate(-2 * dir, 6);
    figure(ctx, 0, 0, { ...L, cloak: L.cloak }, { face: 'right', t: 0 });
    ctx.restore();
  }

  // ---- Looks: troops (data/troops.js `look`), the hero, companions and townsfolk ----

  /**
   * A troop's look on a side. The parts come from the troop's own `look` (data/troops.js; packs may
   * give theirs), whether it is a woman from the troop's `gender`, and the colours from `side`: the
   * realm or band it fights for (its army's, so a hired spearman fights in the company's colours).
   * Skin, hair, hair style and beard come from `seed` (the unit's or soldier's id), never per frame.
   */
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
    const L = { ...base, seed: id.length * 31, realm: side, tabard: base.tabard ? side : null, beard: base.beard ? tone(base.hair || HAIRS[0], -0.1) : null };
    if (equipment) dress(L, CL.gear.kitFor(null, equipment, 'primary'), null, { only: true });
    return L;
  }

  // ---- Looks from gear (P11-04; docs/ART-STYLE.md "The hero", "Items") ----

  /** The defaults for a piece with no look of its own (a pack's), by its slot and tier. */
  const SLOT_LOOK = {
    offhand: () => ({ shield: 'round' }),
    head: (it) => ({ helmet: (it.tier || 1) >= 3 ? 'bascinet' : (it.tier || 1) >= 2 ? 'nasal' : 'cap' }),
    body: (it) => ({ armour: [null, 'gambeson', 'leather', 'mail'][Math.min(3, it.tier || 1)] }),
    hands: () => ({ gloves: '#7a5a3a' }),
    feet: () => ({ boots: '#4a3424' }),
    horse: () => ({ coat: '#8a5a3a', mane: '#2e2119' }),
    ammo: () => ({ quiver: true }),
  };

  /**
   * How a piece is drawn: its own `look` (a forged piece its base's), else its family's part (a weapon)
   * or its slot's default. @param {string | null} id @returns {any}
   */
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
   * Put a kit on a look. `used`: the equipment as fought in (js/gear.js `kitFor`: the weapon in hand,
   * the shield only if in hand, nothing whose requirement isn't met); `back`: a shield slung on the
   * back. `only`: change only the slots that hold something (a companion keeps their own look's
   * otherwise). Sets `sig`, the kit's signature: `weapon|shield(on/back/none)|helmet|armour|mount`.
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
      L.helmet = hero && h === 'nasal' ? 'plumed' : h; // the hero's own mark: a plume on a nasal helm
      if (h) L.hat = null;
    }
    if (!only || has('body')) {
      const a = has('body') ? itemLook(used.body).armour || null : null;
      L.armour = a === 'cloth' ? null : a;
      if (hero) L.pauldrons = L.armour === 'mail';
    }
    if (!only || has('hands')) L.gloves = has('hands') ? itemLook(used.hands).gloves || null : null;
    if (has('feet')) L.boots = itemLook(used.feet).boots || L.boots;
    if (!only || has('horse')) L.mount = has('horse') ? { coat: itemLook(used.horse).coat || '#8a5a3a', mane: itemLook(used.horse).mane || '#2e2119' } : null;
    L.sig = [used?.weapon || 'none', L.shield ? 'on' : L.shieldBack ? 'back' : 'none', used?.head || 'none', used?.body || 'none', used?.horse || 'none'].join('|');
    return L;
  }

  /** The hero: the player's own cloak colour, a plumed helm, gold trim, a sword and kite shield. */
  const CLOAKS = { crimson: '#a8423a', forest: '#4f7b4f', violet: '#6b4f8a', ash: '#7f8387' };
  /**
   * P11-04: the hero as they are: who they are from the creator (presentation, skin, hair, cloak and its
   * gold trim), everything else from the kit (`kit`: equipment, the campaign's or a tournament's loaner
   * kit): the weapon in hand (`ctx.which`, the loadout), the shield in hand or slung, the helmet or a
   * bare head, the armour, gloves and boots, the quiver and the horse. A piece whose requirement isn't met
   * isn't worn (it stays with the baggage, js/gear.js). `ctx.campaign`: whose requirements (by default the
   * game's, when `character` is its hero). Replaces 5.3.0's `heroFor`.
   * @param {any} character @param {any} [kit] @param {{ which?: string, campaign?: any }} [ctx]
   */
  function heroFrom(character, kit = {}, ctx = {}) {
    const L = heroLook(character?.cloak, character?.gender === 'woman');
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
      tunic: '#d9c9a2',
      tabard: 'valedorn',
      helmet: 'plumed',
      plume: PAL.gold,
      cloak: CLOAKS[cloak] || CLOAKS.crimson,
      cloakTrim: PAL.gold,
      shield: 'kite',
      realm: 'valedorn',
      weapon: 'sword',
      legs: '#5a4a3a',
      boots: '#3e2e22',
    };
  }

  /** Townsfolk by role, with seeded variety (clothes, hair, skin, a hat or none). */
  const ROLE_LOOKS = {
    merchant: { tunic: '#8a5a8a', apron: '#e9dcc0', hat: 'brim', hatColor: '#6b4a6b', band: PAL.gold, belt: '#5a3f2a' },
    smith: { tunic: '#6e6258', apron: '#4a3a2e', hairStyle: 'bald', beard: true, weapon: 'hammer', work: true },
    innkeeper: { tunic: '#b06a3c', apron: '#f0e6cf', hairStyle: 'bun', female: true },
    guard: { armour: 'mail', tabard: true, helmet: 'kettle', weapon: 'spear', shield: 'kite' },
    recruiter: { armour: 'gambeson', tunic: '#c6b38c', tabard: true, helmet: 'nasal', cloak: '#3b5a7a', weapon: 'staff' },
    elder: { tunic: '#5d6b7a', cloak: '#3d4f62', cloakTrim: PAL.gold, hairStyle: 'short', beard: true, hair: '#d8d4cc', weapon: 'staff' },
    farmer: { tunic: '#9a8a5c', hat: 'brim', hatColor: '#c9a55e', band: '#7a5a37', weapon: null },
    townswoman: { tunic: '#5f7a8a', apron: '#efe6d2', hat: 'kerchief', hatColor: '#c0573f', female: true },
    townsman: { tunic: '#7a8a5c', hat: 'cap', capColor: '#a54f3a' },
    child: { tunic: '#c0855a', scale: 0.74 },
    monk: { tunic: '#8a7458', helmet: 'hood', hoodColor: '#7a6448', weapon: 'staff' },
    noble: { tunic: '#6b4f8a', cloak: '#3b6ea5', cloakTrim: PAL.gold, hat: 'brim', hatColor: '#3b2a40', band: PAL.gold, weapon: 'sword' },
  };
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
    };
  }

  G.figClassic = { figure, horse, fallen, weaponTip, troopLook, companionLook, heroFrom, townLook };
})(typeof window !== 'undefined' ? window : globalThis);
