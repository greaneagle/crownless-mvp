// @ts-check
/* Crownless battle extras (P7-11): the infantry's formations and the lie of the land.
 *
 * Formations (the infantry's; picked in Orders, or by the battle setup: Defensive starts in a shield
 * wall, the others loose):
 *   loose       as before: loose ranks on Follow, break ranks to fight what comes close
 *   shield wall on Hold and Follow: the infantry close up (files 22 px apart instead of 28) and walk at
 *               70%. Shields stay up whenever a foe is in front and near (not only when one swings),
 *               and they strike over them, the shield dropping only for the blow itself; they raise
 *               them against archers in front too; and a raised shield covers the soldier on either
 *               side and a little further (46 px instead of 34, one side only). On Charge it breaks up
 *   wedge       on Follow and Charge: a point toward the enemy, 15% quicker on the move, and the first blow
 *               after closing with a new foe lands harder (×1.3) and shakes them as a blow from the
 *               flank does (their group's morale, js/morale.js). No shield cover in a wedge, given or
 *               taken. On Hold it falls back to loose
 * The lie of the land (W-05a's maps):
 *   high ground the hills battle map has rises (`high`, ellipses): an archer standing on one shoots 25%
 *               further, whichever side they are on. Archers who start on one (Balanced, Defensive and
 *               Aggressive put them on the company's knoll) hold it (js/prep.js)
 *   a ford      wading breaks a formation: in the shallows (`slow` ground) everyone is loose
 * `USE` switches each one off for measuring it on its own (scripts/extras.js, as B-01's ENEMY.use).
 * Nothing here is saved: a formation lasts one battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const KINDS = ['loose', 'wall', 'wedge', 'line', 'column', 'square'];
  const NAMES = { loose: 'Loose', wall: 'Shield wall', wedge: 'Wedge', line: 'Line', column: 'Column', square: 'Square' };
  // P9-B4: a line is wide and a little slower; a column narrow and quicker on the march; a square braces
  // against horse on every side (as spears do in front, js/groups.js) and is slow. Each forms on Hold and
  // Follow; on Charge it breaks up (a column marches on Charge too).
  const MARCH = { line: 0.9, column: 1.1, square: 0.5 };
  const WALL = { fileGap: 22, rankGap: 26, perRank: 6, speed: 0.7, cover: 46, lookout: 1.6, arrowSlack: 30 };
  const WEDGE = { speed: 1.15, firstBlow: 1.3, rearm: 120, step: 26, fileGap: 26, ahead: 60 };
  const HILL = { range: 1.25 };
  const USE = { wall: true, wedge: true, hill: true, fordBreaks: true };

  // P11-13: formations that hold (docs/NEXT-TASKS.md P11-13).
  //   leash     on Hold a formed soldier fights only what comes within its leash (+ its reach) of its slot,
  //             never steps further than the leash from it, and goes back; on Follow it breaks ranks only
  //             for what comes that close to its slot. Loose keeps the old rules (85 px, chasing)
  //   frontage  a blow that sweeps several meets one soldier of a formed line, wall or square from the front
  //   flanks    a blow from a formed division's side or rear lands harder (`FLANK`) and shakes it more
  //   wedge     its first blow into a formed line breaks the struck soldiers' ranks for `WEDGE.breaks` s
  //   loose     wider ranks (arrows find fewer: spread targets)
  //   wall      a blocked blow's pressure is shared with the shields beside (a wall holds longer than one)
  //   cohesion  the share of a division in its slots, every 0.25 s; under `COHESION.formed` its effects lapse
  //   terrain   fords (kept) and dense forest break formations; a column marches through the forest
  //   too few   a division of fewer than `MIN_SIZE` stays loose, and says so
  const LEASH = { wall: 22, line: 36, square: 24, column: 46, wedge: 60 };
  const FLANK = { wall: 1.35, column: 1.35, line: 1.25, wedge: 1.15, square: 1, front: 0.5, morale: 0.6 };
  const COHESION = { every: 0.25, slack: 1.8, formed: 0.5 };
  const LOOSE = { fileGap: 36, rankGap: 36 };
  const FOREST = { radius: 56, trees: 3 };
  const MIN_SIZE = 4;
  const BAY = { longer: 12, inside: 0.6, margin: 4 }; // the points hold them off (atBay)
  const SHARE = { neighbours: 2, keep: 0.5 }; // a wall's blocked blow: half on the shield struck, half beside
  Object.assign(WEDGE, { breaks: 3, breakRadius: 44 });
  Object.assign(USE, { bay: true, leash: true, frontage: true, flanks: true, cohesion: true, share: true, forest: true });

  const isSoldier = (u) => u && u.team === 'ally' && !u.companion && !u.outside;
  /** P11-13: an enemy that takes its army's formation (its plan's, js/combat.js enemyPlan). */
  const isFormedEnemy = (g, u) => u && u.team === 'enemy' && Boolean(g.enemyFormations) && !u.raider && !u.wagon && !u.mounted;
  const divOf = (u) => (u.team === 'enemy' ? u.role : u.div || u.role);
  /** A division's chosen formation (P9-B4: each division its own; before, the infantry's only). @param {any} g @param {string} div */
  const chosenFor = (g, div, team = 'ally') => (team === 'enemy' ? g.enemyFormations?.[div] : g.formations?.[div] || (div === 'infantry' ? g.formation : null)) || 'loose';
  /** A division's order: the company's, or the enemy plan's. */
  const orderFor = (g, u) => (u.team === 'enemy' ? g.enemyOrders?.[u.role] : g.orders?.[divOf(u)]);
  /** P11-13: the division's last measure (the size, the cohesion), or null before the first. */
  const stateOf = (g, u) => g.formState?.[u.team]?.[divOf(u)] || null;

  /** Which formation a soldier is in right now: their division's, if the order suits it and the ground allows. @param {any} g @param {Unit} u */
  function of(g, u) {
    const enemy = isFormedEnemy(g, u);
    if ((!isSoldier(u) && !enemy) || !u.alive || u.routing || u.morale === 'fallback') return 'loose';
    const div = divOf(u);
    const f = chosenFor(g, div, u.team);
    if (f === 'loose' || !(CL.divisions?.FORMATIONS[u.role] || ['loose']).includes(f)) return 'loose';
    if (USE.fordBreaks && CL.units.groundFactor(u.x, u.y) < 1) return 'loose'; // wading breaks ranks
    if (USE.forest && u.dense && f !== 'column') return 'loose'; // P11-13: thick trees break ranks, not a column's
    const st = stateOf(g, u);
    if (st && st.n < MIN_SIZE) return 'loose'; // P11-13: too few to form
    const order = orderFor(g, u);
    if (f === 'wall') return USE.wall && order !== 'charge' ? 'wall' : 'loose';
    if (f === 'wedge') return USE.wedge && order !== 'hold' ? 'wedge' : 'loose';
    if (f === 'column') return 'column';
    return order !== 'charge' ? f : 'loose';
  }

  /**
   * P11-13: is a soldier formed: in a formation (not loose), their division's ranks holding together
   * (cohesion), and their own place not broken by a wedge? The formation's effects need it.
   * @param {any} g @param {Unit} u
   */
  function formed(g, u) {
    const f = of(g, u);
    if (f === 'loose') return null;
    if ((u.ranksBrokenUntil ?? -1) > g.t) return null;
    const st = stateOf(g, u);
    if (USE.cohesion && st && st.cohesion < COHESION.formed) return null;
    return f;
  }

  /** P11-13: how far from their slot a formed soldier may fight (null: loose, no leash). @param {any} g @param {Unit} u */
  function leash(g, u) {
    if (!USE.leash) return null;
    const f = of(g, u);
    return f === 'loose' ? null : LEASH[f] ?? null;
  }

  /** The way a formed division faces: the company's chosen facing (right by default), the enemy's left. */
  const facingOf = (g, u) => (u.team === 'enemy' ? 'left' : g.facings?.[divOf(u)] || 'right');
  const FACE = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

  /**
   * P11-13: a blow from a formed division's side or rear: how much harder it lands (1: from the front,
   * or not formed, or a square, which has no flank). @param {any} g @param {Unit} target @param {Unit} source
   */
  function flankOf(g, target, source) {
    if (!USE.flanks || !source || source.team === target.team) return 1;
    const f = formed(g, target);
    if (!f || !(FLANK[f] > 1)) return 1;
    const [fx, fy] = FACE[facingOf(g, target)];
    const dx = source.x - target.x;
    const dy = source.y - target.y;
    const d = Math.hypot(dx, dy) || 1;
    return (dx * fx + dy * fy) / d >= FLANK.front ? 1 : FLANK[f];
  }

  /**
   * P11-13: frontage. May a blow that already struck someone strike this one too? Not a formed soldier
   * of a line, a wall or a square met from the front: the front meets one blow a slot. @param {any} g
   */
  function frontage(g, v, source) {
    if (!USE.frontage) return true;
    const f = formed(g, v);
    if (f !== 'line' && f !== 'wall' && f !== 'square') return true;
    if (f === 'square') return false;
    const [fx, fy] = FACE[facingOf(g, v)];
    const d = Math.hypot(source.x - v.x, source.y - v.y) || 1;
    return ((source.x - v.x) * fx + (source.y - v.y) * fy) / d < FLANK.front;
  }

  /**
   * P11-13: the points hold them off. A formed soldier's blow from a weapon longer than the foe's
   * (`BAY.longer` px or more) that lands before the foe is inside its own reach pushes it back to the
   * striker's reach: a held line of spears or pikes keeps swords and axes at bay (one against one or in a
   * crowd: the crowd effect P11-11 found). @param {any} g @param {Unit} u @param {Unit} v
   */
  function atBay(g, u, v) {
    if (!USE.bay || !v.alive || v.mounted || !formed(g, u)) return false;
    const theirs = v.ranged ? 0 : v.reach || 30;
    if (u.reach < theirs + BAY.longer) return false;
    const d = Math.hypot(v.x - u.x, v.y - u.y);
    if (d < theirs * BAY.inside || d >= u.reach - BAY.margin) return false;
    CL.units.push(v, u.x, u.y, u.reach - BAY.margin - d);
    return true;
  }

  /** P11-13: a wedge's first blow into a formed line breaks the struck soldiers' ranks for a time. @param {any} g */
  function breakRanks(g, v) {
    if (!formed(g, v)) return 0;
    let n = 0;
    const until = g.t + WEDGE.breaks;
    for (const w of v.team === 'enemy' ? g.enemies : g.allies) {
      if (!w.alive || divOf(w) !== divOf(v) || Math.hypot(w.x - v.x, w.y - v.y) > WEDGE.breakRadius) continue;
      w.ranksBrokenUntil = until;
      n++;
    }
    g.effects.push({ x: v.x, y: v.y - 30, t: 0.5, color: '#f6daa6', kind: 'break' });
    return n;
  }

  /**
   * P11-13: a shield wall shares a blocked blow's pressure with the shields beside it. Returns the share
   * the struck shield keeps (1: alone). @param {any} g @param {Unit} u @param {number} amount
   */
  function sharePressure(g, u, amount, capacity) {
    if (!USE.share || formed(g, u) !== 'wall') return 1;
    const beside = [];
    for (const w of u.team === 'enemy' ? g.enemies : g.allies) {
      if (w === u || !w.alive || divOf(w) !== divOf(u) || !CL.groups.hasShield(w) || formed(g, w) !== 'wall') continue;
      const d = Math.hypot(w.x - u.x, w.y - u.y);
      if (d <= WALL.cover) beside.push([d, w]);
    }
    if (!beside.length) return 1;
    beside.sort((a, b) => a[0] - b[0]);
    const take = beside.slice(0, SHARE.neighbours);
    const each = (amount * (1 - SHARE.keep)) / take.length;
    for (const [, w] of take) w.press = Math.min(capacity - 0.01, (w.press || 0) + each); // the neighbour's shield takes it, never broken by it
    return SHARE.keep;
  }

  /** Where a formed soldier's slot is now: on Hold its place, on Follow its slot beside the hero. @param {any} g @param {Unit} u */
  function slotOf(g, u) {
    const order = orderFor(g, u);
    if (order === 'hold' || u.team === 'enemy') return { x: u.holdX, y: u.holdY };
    if (order === 'follow') return CL.groups.followSlot(g, u);
    return null;
  }

  /** Is (x, y) among thick trees (P11-13: FOREST.trees within FOREST.radius)? */
  function denseAt(x, y) {
    let n = 0;
    for (const o of CL.game?.battleMap?.obstacles || []) {
      if (o.look !== 'tree') continue;
      if (Math.hypot(o.x - x, o.y - y) < FOREST.radius && ++n >= FOREST.trees) return true;
    }
    return false;
  }

  /**
   * P11-13: every 0.25 s, each formed division's size and cohesion (the share of its soldiers within
   * `COHESION.slack` leashes of their slot), the soldiers among thick trees, and the company's order
   * states for the flags and the Orders panel. @param {any} g
   */
  function tick(g, dt) {
    g.formIn = (g.formIn ?? 0) - dt;
    if (g.formIn > 0) return g.formState;
    g.formIn = COHESION.every;
    const out = { ally: {}, enemy: {} };
    const forest = USE.forest && (g.battleMap?.obstacles || []).some((o) => o.look === 'tree');
    const lists = [
      ['ally', g.allies.filter((a) => isSoldier(a) && a.alive)],
      ['enemy', g.enemyFormations ? g.enemies.filter((e) => e.alive && isFormedEnemy(g, e)) : []],
    ];
    for (const [team, list] of lists) {
      const by = {};
      for (const u of list) {
        const d = divOf(u);
        if (!by[d]) by[d] = [];
        by[d].push(u);
      }
      for (const [div, units] of Object.entries(by)) {
        const st = { n: units.length, cohesion: 1, kind: 'loose', chosen: chosenFor(g, div, team), cx: 0, cy: 0, top: Number.POSITIVE_INFINITY };
        out[team][div] = st;
        for (const u of units) {
          st.cx += u.x / units.length;
          st.cy += u.y / units.length;
          st.top = Math.min(st.top, u.y);
          u.dense = forest && denseAt(u.x, u.y);
        }
      }
      // Cohesion once the sizes are known (of() reads them).
      g.formState = { ...(g.formState || {}), [team]: out[team] };
      for (const [div, units] of Object.entries(by)) {
        const st = out[team][div];
        const shaped = units.filter((u) => !u.routing && of(g, u) !== 'loose');
        st.kind = shaped.length * 2 >= units.length ? of(g, shaped[0] || units[0]) : 'loose';
        if (st.kind === 'loose') continue;
        const L = LEASH[st.kind] ?? 40;
        let inPlace = 0;
        for (const u of shaped) {
          const s = slotOf(g, u);
          if (!s || Math.hypot(s.x - u.x, s.y - u.y) <= L * COHESION.slack) inPlace++;
        }
        st.cohesion = inPlace / units.length;
      }
    }
    g.formState = out;
    orderStates(g);
    return out;
  }

  // ---- P11-13: order states (the flags on the field and the minimap, the Orders panel) ----

  const STATE_WORDS = { moving: 'moving', holding: 'holding', following: 'following', charging: 'charging', engaged: 'engaged', waiting: 'waiting', done: 'done', cant: "can't" };
  const NOTE_SECONDS = 4;
  const DONE_SECONDS = 3;

  /** Say why an order or formation can't be carried out (shown by the flag and the Orders panel). @param {any} g */
  function note(g, div, text) {
    g.orderNotes ??= {};
    g.orderNotes[div] = { text, at: g.t ?? 0 };
  }

  /** Why a division's chosen formation isn't forming, if it isn't. */
  function whyNot(g, div, st) {
    const chosen = st.chosen;
    if (chosen === 'loose' || st.kind !== 'loose') return null;
    if (st.n < MIN_SIZE) return `too few to form a ${NAMES[chosen].toLowerCase()}`;
    const units = g.allies.filter((a) => isSoldier(a) && a.alive && divOf(a) === div);
    if (units.some((u) => CL.units.groundFactor(u.x, u.y) < 1)) return 'the ford breaks their ranks';
    if (units.some((u) => u.dense)) return 'the trees break their ranks';
    const order = g.orders?.[div];
    if (chosen === 'wedge' && order === 'hold') return 'a wedge forms on Follow or Charge';
    if (order === 'charge' && chosen !== 'column') return `a ${NAMES[chosen].toLowerCase()} forms on Hold or Follow`;
    return null;
  }

  /** Each of the company's divisions: its order's state, and why not when it can't be. @param {any} g */
  function orderStates(g) {
    const out = {};
    const engaged = g.groupState || {};
    for (const div of CL.divisions?.present(g) || []) {
      const st = g.formState?.ally?.[div] || { n: 0, cohesion: 1, kind: 'loose', chosen: 'loose', cx: 0, cy: 0, top: 0 };
      const order = g.orders?.[div];
      const mood = CL.morale?.word(g, 'ally', CL.divisions.roleOf(div));
      const n = g.orderNotes?.[div];
      let state;
      let reason = null;
      if (mood === 'routing' || mood === 'falling back') [state, reason] = ['cant', mood === 'routing' ? 'routing: rally them' : 'falling back: they obey once steadied'];
      else if (n && (g.t ?? 0) - n.at < NOTE_SECONDS) [state, reason] = ['cant', n.text];
      else if (g.timed?.some((t) => t.div === div)) state = 'waiting';
      else if (engaged[div] === 'engaged') state = 'engaged';
      else if (g.falling?.[div]) state = 'moving';
      else if (g.doneAt?.[div] != null && (g.t ?? 0) - g.doneAt[div] < DONE_SECONDS) state = 'done';
      else if (order === 'charge') state = 'charging';
      else if (engaged[div] === 'forming' || (st.kind !== 'loose' && st.cohesion < COHESION.formed)) state = 'moving';
      else state = order === 'hold' ? 'holding' : 'following';
      if (state !== 'cant') reason = whyNot(g, div, st);
      if (reason && state !== 'engaged') state = 'cant';
      out[div] = { state, word: STATE_WORDS[state], reason, cohesion: st.kind === 'loose' ? null : st.cohesion, kind: st.kind, chosen: st.chosen, cx: st.cx, cy: st.cy, top: st.top };
    }
    g.orderState = out;
    return out;
  }

  /** How fast a soldier moves in their formation (and with their division's captain, P9-B4). @param {any} g @param {Unit} u */
  function speed(g, u) {
    const f = of(g, u);
    const k = f === 'wall' ? WALL.speed : f === 'wedge' ? WEDGE.speed : MARCH[f] || 1;
    return k * (CL.divisions?.speedOf(g, u) || 1);
  }

  /** Does a soldier in a square brace against a rider from any side? @param {any} g @param {Unit} u */
  const squared = (g, u) => formed(g, u) === 'square';

  /**
   * In a shield wall the shields stay up whenever a foe is in front and near, or an archer in front is in
   * range (not only when someone swings). @param {any} g @param {Unit} u @param {Unit[]} opponents
   */
  function guard(g, u, opponents) {
    if (!CL.groups.hasShield(u) || formed(g, u) !== 'wall' || CL.units.isCommitted(u)) return false;
    for (const o of opponents) {
      if (!o?.alive || o.routing || !CL.units.inArc(u, o, CL.units.ARC.block)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < (o.ranged ? rangeOf(o) + WALL.arrowSlack : (o.reach || 48) * WALL.lookout)) return true;
    }
    return false;
  }

  /** A shield wall strikes over its shields: may this soldier swing with the shield up? @param {any} g @param {Unit} u */
  const strikesOver = (g, u) => formed(g, u) === 'wall';

  /** The shield cover a raised shield gives (js/groups.js): how far, and whether on both sides. Null: none. @param {any} g @param {Unit} blocker @param {Unit} target */
  function cover(g, blocker, target) {
    if (of(g, blocker) === 'wedge' || of(g, target) === 'wedge') return null;
    return formed(g, blocker) === 'wall' ? { reach: WALL.cover, bothSides: true } : { reach: CL.groups.COVER_REACH, bothSides: false };
  }

  /** Each frame: a soldier in a wedge with no foe near is ready to strike the first blow again. @param {any} g @param {Unit} u */
  function arm(g, u) {
    if (of(g, u) !== 'wedge') u.wedgeArmed = false;
    else if (!u.target?.alive || Math.hypot(u.target.x - u.x, u.target.y - u.y) > WEDGE.rearm) u.wedgeArmed = true;
  }

  /** The blow's weight from the formation: the wedge's first blow (used once). @param {any} g @param {Unit} u */
  function blow(g, u) {
    if (!u.wedgeArmed || of(g, u) !== 'wedge') return 1;
    return WEDGE.firstBlow;
  }

  /**
   * Where a soldier stands on Follow in a formed division (a wall, a wedge, a line, a column, a square),
   * around their division's place beside the hero. Null: the loose ranks (js/groups.js). @param {any} g @param {Unit} u
   */
  function slot(g, u) {
    const f = of(g, u);
    if (f === 'loose') return null;
    const div = u.div || u.role;
    const mates = g.allies.filter((a) => isSoldier(a) && a.alive && (a.div || a.role) === div);
    const i = Math.max(0, mates.indexOf(u));
    const h = g.hero;
    const at = CL.groups.followAnchor(g, div);
    // A wall and a wedge as before (P7-11): the wall a step ahead of the hero, the wedge's point further.
    const base = f === 'wedge' ? { x: h.x + WEDGE.ahead, y: at.y } : f === 'wall' ? { x: h.x + CL.groups.FORM.infantryAhead, y: at.y } : at;
    const o = CL.divisions.turn(CL.divisions.shape(f, i, mates.length), g.facings?.[div] || 'right');
    return { x: base.x + o.dx, y: base.y + o.dy };
  }

  /** On Hold, a formed division closes up into its shape where it stands. @param {any} g @param {string} [div] */
  function closeUp(g, div = 'infantry') {
    const f = chosenFor(g, div);
    if (f === 'loose' || f === 'wedge' || g.orders?.[div] !== 'hold') return;
    const units = g.allies.filter((a) => isSoldier(a) && a.alive && !a.routing && (a.div || a.role) === div && (CL.divisions?.FORMATIONS[a.role] || []).includes(f));
    if (!units.length) return;
    const cx = units.reduce((n, u) => n + u.holdX, 0) / units.length;
    const cy = units.reduce((n, u) => n + u.holdY, 0) / units.length;
    [...units]
      .sort((a, b) => a.holdY - b.holdY)
      .forEach((u, i) => {
        const o = CL.divisions.turn(CL.divisions.shape(f, i, units.length), g.facings?.[div] || 'right');
        u.holdX = cx + o.dx;
        u.holdY = cy + o.dy;
      });
  }

  /** Choose a division's formation (Orders, or the battle setup); the selected division by default. @param {any} g @param {string} kind */
  function set(g, kind, quiet = false, div = g.group || 'infantry') {
    if (!KINDS.includes(kind)) return false;
    const role = CL.divisions?.roleOf(div) || 'infantry';
    if (!(CL.divisions?.FORMATIONS[role] || KINDS).includes(kind)) {
      if (!quiet) CL.ui.message(`${CL.divisions.name(CL.campaign, div)} can't form a ${NAMES[kind].toLowerCase()}`);
      note(g, div, `can't form a ${NAMES[kind].toLowerCase()}`);
      return false;
    }
    g.formations ??= {};
    g.formations[div] = kind;
    // P11-13: too few to form: it stays loose, and says so (the flag and the Orders panel).
    const few = kind !== 'loose' && CL.divisions?.members(g, div).length < MIN_SIZE;
    if (few) note(g, div, `too few to form a ${NAMES[kind].toLowerCase()}`);
    if (g.formIn != null) g.formIn = 0; // measured again at once
    if (div === 'infantry') g.formation = kind; // the infantry's, as before P9-B4 (older code and tests read it)
    closeUp(g, div);
    if (!quiet) {
      const order = g.orders?.[div];
      const why = few ? `: too few to form one (${MIN_SIZE} or more), so they stay loose` : kind === 'wall' && order === 'charge' ? ': it forms on Hold or Follow' : kind === 'wedge' && order === 'hold' ? ': it forms on Follow or Charge' : ['line', 'square'].includes(kind) && order === 'charge' ? ': it forms on Hold or Follow' : '';
      CL.ui.message(`${CL.divisions?.name(CL.campaign, div) || 'Infantry'}: ${NAMES[kind].toLowerCase()}${why}`);
    }
    CL.diag.log('info', 'Formation', { formation: kind, division: div });
    return true;
  }

  // ---- The lie of the land ----

  /** Is (x, y) on a rise of the battle map (the hills map's `high` ground)? */
  function highAt(x, y) {
    for (const r of CL.game?.battleMap?.high || []) if (((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 <= 1) return true;
    return false;
  }

  /** An archer's range where they stand: 25% further from high ground. @param {Unit} u */
  function rangeOf(u) {
    if (!u.ranged) return 0;
    return u.ranged.range * (USE.hill && highAt(u.x, u.y) ? HILL.range : 1);
  }

  CL.formations = { KINDS, NAMES, MARCH, WALL, WEDGE, HILL, USE, LEASH, FLANK, COHESION, LOOSE, FOREST, MIN_SIZE, SHARE, BAY, STATE_WORDS, atBay, chosenFor, squared, of, formed, leash, flankOf, frontage, breakRanks, sharePressure, slotOf, denseAt, tick, note, orderStates, speed, guard, strikesOver, cover, arm, blow, slot, closeUp, set, highAt, rangeOf };
})(typeof window !== 'undefined' ? window : globalThis);
