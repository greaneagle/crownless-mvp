// @ts-check
/* Crownless scout (P7-02): a camp follower who looks ahead (design §12; built on P7-04's sight rules).
 *
 * Hired in a town (Accounts): HIRE crowns once and WAGE a week, paid with the wages; unpaid two
 * paydays running, they leave (warned after the first). While a scout rides with the company:
 *   sight     the company sees SIGHT times as far (js/sight.js)
 *   warnings  the first sight of a hostile party (a band, or the patrol of a kingdom that counts you an
 *             enemy) is reported with its size, as a scout would judge it ("about 8 Reavers"), where it
 *             is and whether it is coming this way; again at most every WARN_EVERY days for the same party
 *   routes    setting off, how long the ride should take and the hostile parties known near the way
 *             (seen now or last seen there): "about 6 hours to Eastwatch; about 5 Reavers seen near the way"
 *   ground    attacking a band you caught gives a wider deployment zone (js/prep.js; not when ambushed)
 * Estimates are honest: sizes and times are rounded the way a scout would say them, never exact.
 * State: c.followers.scout (saved, schema v13) or null. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const HIRE = 45;
  const WAGE = 8;
  const SIGHT = 1.5;
  const WARN_EVERY = 0.5; // days between warnings about the same party
  const DANGER_RADIUS = 6; // map units either side of the way
  const ZONE = 1.25; // the deployment zone when you catch a band
  const LOG_MAX = 20;
  const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

  const get = (c) => c?.followers?.scout || null;
  const isTown = (id) => CL.content.table('settlements')[id]?.type === 'town';
  const tpl = (p) => CL.content.get('party_templates', p.template);

  function log(c, text) {
    const s = get(c);
    if (!s) return;
    s.log.push({ day: c.day, text: text.slice(0, 120) });
    if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
  }

  /** Can one be hired here (a town)? @param {Campaign} c */
  const canHire = (c) => !get(c) && isTown(c.world?.location) && c.gold >= HIRE;

  /** Hire a scout from your purse. Returns them, or null. @param {Campaign} c */
  function hire(c) {
    if (!canHire(c)) return null;
    if (!CL.accounts.spend(c, HIRE, 'hiring a scout')) return null;
    const place = c.world.location;
    const culture = CL.soldiers.cultureFor('levy', place, c);
    const f = /** @type {any} */ (c.followers || {});
    const taken = new Set([...c.roster.map((s) => s.name), f.quartermaster?.name, f.merchant?.name, f.surgeon?.name, f.blacksmith?.name].filter(Boolean));
    const name = CL.soldiers.makeName(culture, place, () => CL.autoresolve.roll(c, 'names'), taken, 'any');
    c.followers ??= { quartermaster: null, merchant: null };
    /** @type {any} */
    const s = { name, culture, origin: place, hired: c.day, unpaid: 0, log: [] };
    c.followers.scout = s;
    log(c, `Hired at ${CL.soldiers.placeName(place)}.`);
    CL.diag.log('info', 'Scout hired', { name, place });
    CL.story?.emit('hire', { follower: 'scout' }, c);
    return s;
  }

  /** Let them go (no refund). @param {Campaign} c */
  function dismiss(c, why = 'dismissed') {
    const s = get(c);
    if (!s) return false;
    c.followers.scout = null;
    CL.diag.log('info', 'Scout left', { name: s.name, why });
    return true;
  }

  /** Payday: their wage, from the chest then your purse. Two unpaid weeks and they leave. @param {Campaign} c */
  function payday(c) {
    const s = get(c);
    if (!s) return;
    if (CL.accounts.pay(c, WAGE, 'scout’s wage') >= WAGE) {
      s.unpaid = 0;
      return;
    }
    s.unpaid++;
    if (s.unpaid >= 2) {
      CL.ui.message(`Scout ${s.name} has gone unpaid twice and leaves the company.`);
      dismiss(c, 'unpaid');
    } else {
      log(c, 'Went unpaid this week.');
      CL.ui.message(`Scout ${s.name} went unpaid. Unpaid again next week, they will leave.`);
    }
  }

  // ---- What a scout says ----

  /** How far the company sees, with a scout. @param {Campaign} c */
  const sightFactor = (c) => (get(c) ? SIGHT : 1);

  /** A head count as a scout gives it: "a few", "about 6", "about 15". @param {number} n */
  function about(n) {
    if (n <= 3) return 'a few';
    if (n < 10) return `about ${Math.max(4, Math.round(n / 2) * 2)}`;
    return `about ${Math.round(n / 5) * 5}`;
  }

  /** A ride's length as a scout gives it: "about 3 hours", "about half a day", "about 2 days". @param {number} hours */
  function howLong(hours) {
    if (hours < 1) return 'under an hour';
    if (hours < 10) return `about ${Math.round(hours * 2) / 2} hours`;
    if (hours < 36) return `about ${Math.round(hours)} hours`;
    return `about ${Math.round((hours / 24) * 2) / 2} days`;
  }

  /** The eight-way direction from (ax, ay) to (bx, by) on the map. */
  function compass(ax, ay, bx, by) {
    const a = Math.atan2(by - ay, bx - ax);
    return COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }

  /** What to call a party: "Reavers", "Valedorn soldiers". */
  function callThem(p) {
    const t = tpl(p);
    return t.kind === 'bandit' ? t.name.replace(/^Road /, '') : `${CL.content.get('factions', t.faction).short} soldiers`;
  }

  /** Is this party a threat worth a word (it would fight the company)? @param {Campaign} c */
  const threat = (c, p) => CL.parties.hostileTo(c, tpl(p)) && !p.escortTo;

  /**
   * Each step on the map (js/parties.js): report hostile parties the company now sees, once for each
   * until WARN_EVERY days have passed. Returns the warnings given. @param {Campaign} c
   */
  function warn(c, day = c.day) {
    const s = get(c);
    if (!s || c.world.location) return [];
    const said = [];
    for (const p of c.parties || []) {
      if (!threat(c, p) || !CL.sight.playerSees(c, p, day) || p.questTag) continue;
      if (typeof p.warnedAt === 'number' && day - p.warnedAt < WARN_EVERY) continue;
      p.warnedAt = day;
      const coming = p.chasing === 'player' || (p.tx != null && Math.hypot(p.tx - c.world.x, p.ty - c.world.y) < Math.hypot(p.x - c.world.x, p.y - c.world.y) - 1);
      const text = `${about(CL.parties.troopCount(p))} ${callThem(p)} to the ${compass(c.world.x, c.world.y, p.x, p.y)}${coming ? ', riding this way' : ''}`;
      said.push(text);
      log(c, `Saw ${text}.`);
    }
    if (said.length) CL.ui.message(`Scout ${s.name}: ${said.slice(0, 2).join('; ')}${said.length > 2 ? `, and ${said.length - 2} more` : ''}.`);
    return said;
  }

  /** The closest a point comes to the straight way from a to b (gameplay distance). */
  function offTheWay(ax, ay, bx, by, px, py) {
    const k = CL.world.map().aspect ?? 1;
    const [dx, dy] = [bx - ax, (by - ay) * k];
    const [qx, qy] = [px - ax, (py - ay) * k];
    const L = dx * dx + dy * dy;
    const t = L > 0 ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / L)) : 0;
    return Math.hypot(qx - t * dx, qy - t * dy);
  }

  /**
   * A route estimate to a map point: { hours, text, dangers: [{ name, about }] } from the scout's
   * knowledge (parties seen, or last seen, near the way), or null without a scout.
   * @param {Campaign} c @param {{ x: number, y: number, id?: string | null, type?: string }} target
   */
  function estimate(c, target) {
    const s = get(c);
    if (!s) return null;
    const w = c.world;
    const hours = CL.world.estimateHours(target.x, target.y);
    const dangers = [];
    for (const p of c.parties || []) {
      if (!threat(c, p) || (target.type === 'party' && String(p.id) === String(target.id))) continue;
      const at = CL.sight.shown(c, p);
      if (!at || offTheWay(w.x, w.y, target.x, target.y, at.x, at.y) > DANGER_RADIUS) continue;
      dangers.push({ name: callThem(p), about: about(CL.parties.troopCount(p)), live: at.live });
    }
    const place = target.type === 'settlement' ? ` to ${CL.content.get('settlements', target.id).name}` : '';
    const risk = dangers.length ? `; ${dangers.slice(0, 2).map((d) => `${d.about} ${d.name}${d.live ? '' : ' (last seen)'}`).join(', ')}${dangers.length > 2 ? ` and ${dangers.length - 2} more` : ''} near the way` : '; the way looks clear, as far as I know';
    return { hours, dangers, text: `Scout ${s.name}: ${howLong(hours)}${place}${risk}.` };
  }

  /** Setting off: the scout's estimate of the ride, as a message. @param {Campaign} c */
  function onSetOff(c, target) {
    const e = estimate(c, target);
    if (!e || e.hours < 0.5) return null;
    CL.ui.message(e.text);
    return e;
  }

  // ---- Saves ----

  /** Repair the scout onto `s` (after the other followers). @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    s.followers.scout = null;
    const x = d?.followers?.scout;
    if (!x || typeof x !== 'object') return;
    const name = CL.soldiers.cleanName(x.name);
    if (!name) return;
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    s.followers.scout = {
      name,
      culture: CL.content.table('cultures')[x.culture] ? x.culture : null,
      origin: CL.content.table('settlements')[x.origin] ? x.origin : null,
      hired: Math.max(0, num(x.hired, 0)),
      unpaid: Math.max(0, Math.min(1, Math.floor(num(x.unpaid, 0)))),
      log: (Array.isArray(x.log) ? x.log : [])
        .filter((e) => e && typeof e.text === 'string' && typeof e.day === 'number' && Number.isFinite(e.day))
        .slice(-LOG_MAX)
        .map((e) => ({ day: e.day, text: e.text.slice(0, 120) })),
    };
  }

  CL.scout = { HIRE, WAGE, SIGHT, WARN_EVERY, DANGER_RADIUS, ZONE, get, canHire, hire, dismiss, payday, sightFactor, about, howLong, compass, warn, estimate, onSetOff, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
