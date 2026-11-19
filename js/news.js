/* Crownless regional news (GDD §4 "post-story status bulletin", §12 sandbox): the world sim
 * records notable events (caravan losses and arrivals, patrol defeats, frontier clashes, forts
 * changing hands, the player's deeds); every INTERVAL days one news line is written from the most
 * important event not yet told, or a line about the border's tensions when the roads were quiet.
 * The Trade screen also shows "market talk": the latest recent event that moved that town's prices.
 * P7-08: world events (js/happenings.js) record a line already written (`text`), told as it is.
 * State: CL.campaign.news = { events, lines, next, clashUntil, turns } (saved). Lines take turns,
 * never from the world RNG, so news never changes how the simulation plays out. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const INTERVAL = 2; // days between bulletins
  const KEEP_DAYS = 6; // events older than this are forgotten
  const MAX_EVENTS = 24;
  const MAX_LINES = 8;
  const MARKET_DAYS = 4; // how long a price-moving event is talked about at the market
  const MAX_CATCH_UP = 2; // after a long wait, at most this many bulletins at once
  const REPEAT_PENALTY = 3; // priority lost by the kind told in the last bulletin
  const MAX_TEXT = 300; // a line written by its teller: world events (P7-08)

  const kinds = () => CL.content.table('news');
  const settlement = (id) => CL.content.table('settlements')[id];
  const factionName = (f) => CL.content.table('factions')[f]?.name || 'unknown';
  const factionShort = (f) => CL.content.table('factions')[f]?.short || factionName(f);
  const num = (n) => typeof n === 'number' && Number.isFinite(n);

  function blank(day = 0) {
    return { events: [], lines: [], next: day + INTERVAL, clashUntil: 0 };
  }

  const state = (c) => {
    if (!c.news) c.news = blank(c.day);
    return c.news;
  };

  /** The settlement nearest a map point (its id). */
  function nearestPlace(x, y) {
    let best = null;
    for (const s of Object.values(CL.content.table('settlements'))) {
      const d = CL.world.mapDist(x, y, s.mapX, s.mapY);
      if (!best || d < best.d) best = { id: s.id, d };
    }
    return best?.id || null;
  }

  /** The name of the region a settlement lies in (the world's `regions`), or null. */
  function regionOf(id) {
    const s = settlement(id);
    return s ? CL.world.regionAt(s.mapX, s.mapY)?.name || null : null;
  }

  /**
   * Note something that happened. data: { x, y } (→ the nearest place), dest, good, faction,
   * winner, loser, fort, owner. Unknown kinds are ignored.
   */
  function record(c, kind, data = {}, day = c.day) {
    if (!kinds()[kind]) return null;
    const n = state(c);
    const e = { day, kind };
    if (num(data.x) && num(data.y)) e.place = nearestPlace(data.x, data.y);
    for (const k of ['place', 'dest', 'good', 'faction', 'other', 'winner', 'loser', 'fort', 'owner']) {
      if (typeof data[k] === 'string') e[k] = data[k];
    }
    if (typeof data.text === 'string' && data.text) e.text = data.text.slice(0, MAX_TEXT); // a line written by its teller (P7-08)
    n.events.push(e);
    prune(c);
    return e;
  }

  function prune(c) {
    const n = state(c);
    n.events = n.events.filter((e) => e.day >= c.day - KEEP_DAYS).slice(-MAX_EVENTS);
  }

  function fill(text, e, c) {
    const good = e.good ? CL.content.table('markets')[e.good]?.name || e.good : 'goods';
    const fort = e.fort || CL.realm.forts()[0]?.id; // the fort the news is about, or the world's first
    const owner = e.owner || (fort ? CL.realm.owner(fort, c) : null);
    const vars = {
      place: settlement(e.place)?.name || 'the border',
      dest: settlement(e.dest)?.name || 'town',
      good: good.toLowerCase(),
      faction: factionShort(e.faction),
      other: factionShort(e.other), // W-07: the other kingdom in a relations line
      winner: factionShort(e.winner),
      loser: factionShort(e.loser),
      fort: settlement(e.fort)?.name || 'a fort',
      owner: factionName(owner),
      hero: c.character?.name || 'a wanderer',
      region: regionOf(e.place) || 'the border', // W-05b: the named area the place lies in
    };
    const out = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, a, b) => a + b.toUpperCase()); // sentence starts
  }

  /** Pick a kind's line in turn (by how many lines have been written), never from the RNG. */
  function lineFor(c, kindId, e) {
    if (e.text) return e.text; // already written (world events, P7-08)
    const k = kinds()[kindId];
    const ending = CL.story.state(c).flags.ending;
    const pool = k.byEnding?.[ending] || k.lines; // after an ending, some news reads differently
    const n = state(c);
    return fill(pool[(n.turns?.[kindId] || 0) % pool.length], e, c);
  }

  /**
   * Write one bulletin now: the most important untold event (latest first on ties), or tensions.
   * The kind told last time counts for less, so one busy road does not fill every bulletin.
   */
  function bulletin(c, day = c.day) {
    const n = state(c);
    const last = n.lines.at(-1)?.kind;
    const score = (e) => kinds()[e.kind].priority - (e.kind === last ? REPEAT_PENALTY : 0);
    let best = null;
    for (const e of n.events) {
      if (!e.told && (!best || score(e) >= score(best))) best = e;
    }
    const e = best || { day, kind: 'tensions' };
    if (best) best.told = true;
    const line = { day, kind: e.kind, text: lineFor(c, e.kind, e) };
    n.turns = n.turns || {};
    n.turns[e.kind] = (n.turns[e.kind] || 0) + 1;
    n.lines.push(line);
    n.lines = n.lines.slice(-MAX_LINES);
    return line;
  }

  /** From the campaign clock: write the bulletins that are due and announce the latest. */
  function tick(c) {
    const n = state(c);
    prune(c);
    if (c.day < n.next) return null;
    let line = null;
    let written = 0;
    while (c.day >= n.next) {
      if (written < MAX_CATCH_UP) {
        line = bulletin(c, n.next);
        written++;
      }
      n.next += INTERVAL;
    }
    if (line) {
      CL.ui.message(`News: ${line.text}`);
      CL.diag.log('info', 'Regional news', { kind: line.kind, text: line.text });
    }
    return line;
  }

  /** Recent bulletins, newest first, for the Journal. */
  function recent(c = CL.campaign) {
    return [...state(c).lines].reverse();
  }

  /** What the market here is talking about: the latest recent event that moved its prices. */
  function marketTalk(c, sid) {
    const n = state(c);
    for (let i = n.events.length - 1; i >= 0; i--) {
      const e = n.events[i];
      const k = kinds()[e.kind];
      if (e.dest === sid && k.market && e.day >= c.day - MARKET_DAYS) return fill(k.market, e, c);
    }
    return null;
  }

  /** Off-screen frontier clashes are rare: at most one per CLASH_EVERY days. */
  const CLASH_EVERY = 4;
  function clashReady(c, day) {
    return day >= (state(c).clashUntil || 0);
  }
  function clashed(c, day) {
    state(c).clashUntil = day + CLASH_EVERY;
  }

  // ---- Save ----

  function sanitize(s, d) {
    const raw = d?.news;
    const n = blank(s.day);
    if (raw && typeof raw === 'object') {
      if (num(raw.next)) n.next = raw.next;
      if (num(raw.clashUntil)) n.clashUntil = raw.clashUntil;
      const turns = {};
      for (const [k, v] of Object.entries(raw.turns && typeof raw.turns === 'object' ? raw.turns : {})) {
        if (kinds()[k] && Number.isInteger(v) && v >= 0) turns[k] = v;
      }
      if (Object.keys(turns).length) n.turns = turns;
      const id = (v, table) => typeof v === 'string' && Boolean(CL.content.table(table)[v]);
      for (const e of Array.isArray(raw.events) ? raw.events.slice(-MAX_EVENTS) : []) {
        if (!kinds()[e?.kind] || !num(e.day)) continue;
        const q = { day: e.day, kind: e.kind };
        for (const k of ['place', 'dest', 'fort']) if (id(e[k], 'settlements')) q[k] = e[k];
        for (const k of ['faction', 'winner', 'loser', 'owner']) if (id(e[k], 'factions')) q[k] = e[k];
        if (id(e.good, 'markets')) q.good = e.good;
        if (e.told === true) q.told = true;
        if (typeof e.text === 'string' && e.text && e.text.length <= MAX_TEXT) q.text = e.text;
        n.events.push(q);
      }
      for (const l of Array.isArray(raw.lines) ? raw.lines.slice(-MAX_LINES) : []) {
        if (!num(l?.day) || typeof l.text !== 'string' || !l.text || l.text.length > 300) continue;
        n.lines.push({ day: l.day, kind: kinds()[l.kind] ? l.kind : 'tensions', text: l.text });
      }
    }
    s.news = n;
  }

  /** Content checks (from content.validate). */
  function validate(C, err) {
    const known = new Set(['place', 'region', 'dest', 'good', 'faction', 'other', 'winner', 'loser', 'fort', 'owner', 'hero']);
    const check = (where, text) => {
      if (typeof text !== 'string' || !text) return err(`${where}: needs text`);
      for (const [, k] of text.matchAll(/\{(\w+)\}/g)) if (!known.has(k)) err(`${where}: unknown placeholder {${k}}`);
    };
    if (!C.news?.tensions) err('news: needs a "tensions" kind for quiet days');
    for (const k of Object.values(C.news || {})) {
      if (!num(k.priority)) err(`news ${k.id}: needs a priority`);
      if (!Array.isArray(k.lines) || !k.lines.length) err(`news ${k.id}: needs lines`);
      for (const l of k.lines || []) check(`news ${k.id}`, l);
      if (k.market != null) check(`news ${k.id} market`, k.market);
      for (const [end, ls] of Object.entries(k.byEnding || {})) for (const l of ls) check(`news ${k.id} ${end}`, l);
    }
  }

  CL.news = {
    INTERVAL,
    KEEP_DAYS,
    MAX_LINES,
    CLASH_EVERY,
    blank,
    record,
    bulletin,
    tick,
    recent,
    marketTalk,
    nearestPlace,
    clashReady,
    clashed,
    sanitize,
    validate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
