// @ts-check
/* Crownless divisions (P9-B4, decision D-P9e): the company in battle as up to six named divisions, each
 * with its own orders, formation, captain, place and facing. Command comes in layers, every one optional:
 *   1  no orders: a plan chosen for you (js/prep.js, the Auto setup), and the enemy's chosen the same way
 *   2  orders by division (the Orders panel: Follow, Hold, Charge, and the formation row)
 *   3  captains and placement on the Prepare screen, and plans of your own
 *   4  live command on the tactical map (js/tactics.js): move, charge, fall back, face; orders timed
 *      together (after a few seconds, or on the archers' first volley)
 *
 * The six slots are `infantry`, `archer`, `cavalry` and a second of each (`infantry2`, …). By default a
 * soldier is in their role's division, and a role of more than SPLIT soldiers splits into two, one each
 * in turn. A soldier still fights as their role does (archers shoot, riders charge); the division is who
 * they take orders with. Your choices (a troop's division, a soldier's, a division's name) are kept with
 * the campaign (`c.divisions`, optional fields, no schema step), and a company that never changed them
 * fights exactly as before: its divisions are its roles.
 *
 * Formations (js/formations.js applies them): loose, shield wall, wedge (P7-11), and line, column and
 * square (new). `shape` gives each soldier's place in their division's block, facing the enemy (+x). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const SLOTS = ['infantry', 'archer', 'cavalry', 'infantry2', 'archer2', 'cavalry2'];
  const NAMES = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry', infantry2: 'Second foot', archer2: 'Second archers', cavalry2: 'Second horse' };
  const COLORS = { infantry: '#8fb8ff', archer: '#9be07f', cavalry: '#ffd36b', infantry2: '#c79bff', archer2: '#5fd3c6', cavalry2: '#ff9f7a' };
  const SPLIT = 30; // a role of more soldiers than this splits into two divisions by default
  const NAME_MAX = 20;
  /** Which formations a division of a role may take. */
  const FORMATIONS = { infantry: ['loose', 'wall', 'wedge', 'line', 'column', 'square'], archer: ['loose', 'line', 'column'], cavalry: ['loose', 'wedge', 'line', 'column'] };
  /** A captain (layer 3): a veteran or a companion steadies their division and quickens it a little. */
  const CAPTAIN = { tier: 'T3', battles: 10, morale: 8, speed: 1.05 };
  const FACINGS = ['right', 'up', 'down', 'left'];

  const roleOf = (div) => String(div).replace(/2$/, '');
  const blank = () => ({ names: {}, troops: {}, soldiers: {} });
  /** The campaign's choices (made on first use). @param {Campaign} c */
  const chosen = (c) => {
    c.divisions ??= blank();
    return c.divisions;
  };
  /** A division's name: the player's, or its slot's. @param {Campaign | null} c @param {string} div */
  const name = (c, div) => c?.divisions?.names?.[div] || NAMES[div] || div;
  const color = (div) => COLORS[div] || '#ffffff';

  /**
   * Each soldier's division for a battle: their own (chosen), their troop's (chosen), or the default
   * split. @param {Campaign} c @param {{ id: number | null, troop: string }[]} soldiers
   * @returns {Map<number | null, string>} by soldier id (practice soldiers, with no id, by their index)
   */
  function plan(c, soldiers) {
    const pick = c?.divisions || blank();
    const out = new Map();
    const byRole = {};
    for (const s of soldiers) {
      const role = CL.content.troop(s.troop).role;
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(s);
    }
    for (const [role, list] of Object.entries(byRole)) {
      list.forEach((s, i) => {
        const own = s.id != null ? pick.soldiers[s.id] : null;
        const div = (own && SLOTS.includes(own) && own) || (SLOTS.includes(pick.troops[s.troop]) && pick.troops[s.troop]) || (list.length > SPLIT && i % 2 ? `${role}2` : role);
        out.set(s.id ?? `#${soldiers.indexOf(s)}`, div);
      });
    }
    return out;
  }

  /** The divisions a battle has (soldiers of the company standing in them), in slot order. @param {any} g */
  const present = (g) => SLOTS.filter((d) => g.allies?.some((a) => a.div === d && a.alive && !a.companion && !a.outside));
  /** The soldiers of a division on the field. @param {any} g @param {string} div */
  const members = (g, div) => g.allies.filter((a) => a.div === div && a.alive && !a.companion && !a.outside);
  /** A soldier's orders: their division's, or (before divisions) their role's. @param {any} g @param {Unit} u */
  const orderOf = (g, u) => g.orders?.[u.div] ?? g.orders?.[u.role];

  /** The orders every division starts with: its role's (Follow for foot, Hold for archers, Charge for horse). */
  function startOrders() {
    const base = { infantry: 'follow', archer: 'hold', cavalry: 'charge' };
    return Object.fromEntries(SLOTS.map((d) => [d, base[roleOf(d)]]));
  }

  // ---- Choices kept with the campaign (layer 2's divisions, set on the Prepare or Party screen) ----

  /** Put a troop type, or one soldier, in a division (null: back to the default). @param {Campaign} c */
  function assign(c, kind, key, div) {
    if (div !== null && !SLOTS.includes(div)) return false;
    const pick = chosen(c);
    const map = kind === 'troop' ? pick.troops : kind === 'soldier' ? pick.soldiers : null;
    if (!map) return false;
    if (div === null) delete map[key];
    else map[key] = div;
    return true;
  }

  /** Rename a division (blank: its own name again). @param {Campaign} c @param {string} div @param {string} text */
  function rename(c, div, text) {
    if (!SLOTS.includes(div)) return false;
    const clean = String(text || '').replace(/[<>]/g, '').trim().slice(0, NAME_MAX);
    if (clean) chosen(c).names[div] = clean;
    else delete chosen(c).names[div];
    return true;
  }

  /** The company's divisions as they would form up now (for the Prepare and Party screens): { div, soldiers }. @param {Campaign} c */
  function preview(c) {
    const fit = CL.party.healthySoldiers();
    const map = plan(c, fit);
    const by = new Map();
    for (const s of fit) {
      const d = map.get(s.id);
      if (!by.has(d)) by.set(d, []);
      by.get(d).push(s);
    }
    return SLOTS.filter((d) => by.has(d)).map((d) => ({ div: d, name: name(c, d), soldiers: by.get(d) }));
  }

  // ---- Captains (layer 3) ----

  /** Who may captain a division: veterans of tier 3 with 10 battles, and the companions with you. @param {Campaign} c */
  function captains(c) {
    const vets = c.roster.filter((s) => s.woundedUntil === null && CL.content.troop(s.troop).tier === CAPTAIN.tier && (s.record?.battles || 0) >= CAPTAIN.battles).map((s) => ({ kind: 'soldier', id: s.id, name: s.name }));
    const comps = [];
    if (CL.companion.fit(c)) comps.push({ kind: 'companion', id: CL.companion.get(c).id, name: CL.companion.def(CL.companion.get(c).id).name });
    for (const m of CL.retinue?.present(c) || []) comps.push({ kind: 'companion', id: m.id, name: CL.retinue.name(m) });
    return [...comps, ...vets];
  }

  /** Is a division's captain on the field and standing? @param {any} g @param {string} div */
  function led(g, div) {
    const k = g.captains?.[div];
    if (!k) return false;
    return g.allies.some((a) => a.alive && !a.routing && (k.kind === 'soldier' ? a.soldierId === k.id : a.companion === k.id));
  }
  /** A captain's quickening for a soldier (1 without). @param {any} g @param {Unit} u */
  const speedOf = (g, u) => (u.div && led(g, u.div) ? CAPTAIN.speed : 1);

  // ---- Shapes (formations, js/formations.js) ----

  /**
   * Where the i-th of n soldiers stands in a formation, relative to its centre, facing +x (the enemy).
   * @param {string} kind @param {number} i @param {number} n @returns {{ dx: number, dy: number }}
   */
  function shape(kind, i, n) {
    const block = (files, fileGap, rankGap) => {
      const f = Math.min(files, n);
      const rank = Math.floor(i / f);
      const file = i % f;
      return { dx: -rank * rankGap, dy: (file - (f - 1) / 2) * fileGap };
    };
    if (kind === 'wall') return block(6, 22, 26);
    if (kind === 'line') return block(Math.max(5, Math.ceil(n / 2)), 30, 30);
    if (kind === 'column') return block(3, 28, 30);
    if (kind === 'square') {
      // A ring, facing every way; a second ring inside when there are many.
      const ring = Math.min(n, 24);
      const inner = i >= ring;
      const k = inner ? n - ring : ring;
      const j = inner ? i - ring : i;
      const r = (inner ? 0.55 : 1) * Math.max(40, (k * 26) / (2 * Math.PI));
      const a = (j / Math.max(1, k)) * Math.PI * 2;
      return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
    }
    if (kind === 'wedge') {
      const k = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 ? -1 : 1;
      return { dx: -k * 26, dy: side * k * 26 };
    }
    return block(5, 28, 30); // loose ranks
  }

  /** Turn a shape offset (made facing +x) to a facing. @param {{ dx: number, dy: number }} o @param {string} facing */
  function turn(o, facing) {
    if (facing === 'left') return { dx: -o.dx, dy: -o.dy };
    if (facing === 'up') return { dx: o.dy, dy: -o.dx };
    if (facing === 'down') return { dx: -o.dy, dy: o.dx };
    return o;
  }

  /** Keep only well-formed choices (a loaded save). @param {any} raw */
  function sanitize(raw) {
    const out = blank();
    if (!raw || typeof raw !== 'object') return out;
    for (const [d, n] of Object.entries(raw.names || {})) if (SLOTS.includes(d) && typeof n === 'string' && n.trim()) out.names[d] = n.replace(/[<>]/g, '').trim().slice(0, NAME_MAX);
    for (const [t, d] of Object.entries(raw.troops || {})) if (SLOTS.includes(d) && CL.content.table('troops')[t]) out.troops[t] = d;
    for (const [id, d] of Object.entries(raw.soldiers || {})) if (SLOTS.includes(d) && Number.isInteger(Number(id))) out.soldiers[id] = d;
    return out;
  }

  CL.divisions = { SLOTS, NAMES, COLORS, SPLIT, FORMATIONS, CAPTAIN, FACINGS, roleOf, name, color, plan, present, members, orderOf, startOrders, assign, rename, preview, captains, led, speedOf, shape, turn, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
