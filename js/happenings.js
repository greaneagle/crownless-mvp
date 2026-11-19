// @ts-check
/* Crownless dynamic world events (P7-08): things that happen at a settlement because of the state of
 * the world. Their words and numbers are in data/world_events.js; each kind's rules are here.
 *
 * Once a day (from day FIRST_DAY) the world may start one event: of the kinds whose conditions hold
 * somewhere (`where`), at a settlement with nothing else going on, and not where the same kind happened
 * in that region within its cooldown. At most MAX_OPEN are open at once. The rolls are the event's own
 * (from the campaign's seed and the day), never the world random stream, so the world sim plays out as
 * before until an event does something.
 *
 * Each event: is reported in the news when it starts; lasts its `days`; offers one decision when you
 * are there (take part or not); and resolves exactly once, with a result ID, which goes to the news and,
 * when the company had a hand in it (took part, or was there and rode on), to the chronicle. Ignoring it
 * has the consequence its text states. Events never touch the story: no flags, quests, owners or
 * services (so they can never block it).
 *   food_shortage    grain dear in a market      sell rations at the old price  → eased    | grain stays dear
 *   infestation      a band near a village       take the bounty (band marked)  → cleared  | the farms plundered
 *                    (the bounty is paid whoever's idea it was; a band beaten by others → others)
 *   militia_request  a kingdom at odds           drill them for a day           → drilled  | a little reputation, if you were asked
 *   courier          a town                      carry the letter               → delivered | late (if you took it) or ignored
 *   refugees         near a war or a clash       feed them, or take some on     → fed / took | grain dearer
 * State: c.happenings = { open, past, cool, next, nextId } (saved, schema v16). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const FIRST_DAY = 2; // nothing starts before this day: the company finds its feet first
  const MAX_OPEN = 3;
  const START_CHANCE = 0.45; // each day, the chance that something starts somewhere
  const PAST_MAX = 20;
  const CATCH_UP = 60; // days of checks at most in one go (a long wait or a debug jump)
  const RECENT_DAYS = 6; // how far back the news counts for conditions (news KEEP_DAYS)
  const KINDS = ['food_shortage', 'infestation', 'militia_request', 'courier', 'refugees'];
  const RESULTS = {
    food_shortage: ['eased', 'ignored'],
    infestation: ['cleared', 'others', 'ignored'],
    militia_request: ['drilled', 'ignored'],
    courier: ['delivered', 'late', 'ignored'],
    refugees: ['fed', 'took', 'ignored'],
  };
  const WHERE = ['hungry', 'farms', 'threatened', 'towns', 'war'];
  const Y_ASPECT = 0.5636; // the map is wider than tall; offsets look round on screen (as contracts)

  const defs = () => CL.content.table('world_events');
  const def = (id) => (typeof id === 'string' && Object.hasOwn(defs(), id) ? defs()[id] : null);
  const settlement = (id) => CL.content.table('settlements')[id] || null;
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /** @param {number} [day] */
  const blank = (day = 0) => ({ open: [], past: [], cool: {}, next: Math.max(FIRST_DAY, Math.floor(day) + 1), nextId: 1 });
  /** @param {Campaign} c */
  const state = (c) => {
    if (!c.happenings) c.happenings = blank(c.day);
    return c.happenings;
  };

  /** The event's own roll in [0, 1): from the campaign's seed, the day and a salt; never the world stream. */
  function roll(c, day, salt) {
    let h = (Math.imul((c.rngSeed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(Math.floor(day) + 1, 0xc2b2ae35) + Math.imul(salt + 1, 0x27d4eb2f)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  // ---- Where ----

  const regionId = (sid) => {
    const s = settlement(sid);
    return (s && CL.world.regionAt(s.mapX, s.mapY)?.id) || 'none';
  };
  const coolKey = (kind, sid) => `${kind}|${regionId(sid)}`;
  const owner = (c, sid) => CL.realm.owner(sid, c);
  const kingdoms = () => CL.world.map().factions || [];
  const atWar = (c, f) => kingdoms().some((o) => o !== f && CL.realm.relation(c, f, o) === 'war');
  const atOdds = (c, f) => kingdoms().some((o) => o !== f && CL.realm.atOdds(c, f, o));
  /** Recent news of these kinds: at this place (`dest` or `place`), or in its region. */
  function heard(c, kinds, test) {
    return (c.news?.events || []).some((e) => kinds.includes(e.kind) && e.day >= c.day - RECENT_DAYS && test(e));
  }
  const baseGrain = (sid) => settlement(sid)?.market?.grain ?? 1;
  const grain = (c, sid) => c.markets?.[sid]?.grain ?? baseGrain(sid);

  /** Does the world, at this settlement, call for this kind of event? */
  function fits(c, d, sid) {
    const s = settlement(sid);
    if (!s) return false;
    const f = owner(c, sid);
    switch (d.where) {
      case 'hungry':
        return Boolean(s.market && s.services.includes('trade')) && (grain(c, sid) >= baseGrain(sid) + d.dearAbove || atWar(c, f) || heard(c, ['caravan_lost'], (e) => e.dest === sid));
      case 'farms':
        return s.type === 'village';
      case 'threatened':
        return (s.type === 'town' || s.type === 'village') && kingdoms().includes(f) && atOdds(c, f);
      case 'towns':
        return s.type === 'town' && destinations(sid, d).length > 0;
      case 'war': {
        if (!s.market) return false;
        const r = regionId(sid);
        return atWar(c, f) || heard(c, ['frontier_clash', 'fort_taken', 'war_declared'], (e) => Boolean(e.place) && regionId(e.place) === r);
      }
      default:
        return false;
    }
  }

  /** Where a courier's letter can go from here. */
  function destinations(sid, d) {
    const s = settlement(sid);
    return Object.values(CL.content.table('settlements')).filter((o) => {
      if (o.id === sid || (o.type !== 'town' && o.type !== 'village')) return false;
      const far = CL.world.mapDist(s.mapX, s.mapY, o.mapX, o.mapY);
      return far >= d.distance[0] && far <= d.distance[1];
    });
  }

  /** Every (kind, place) that could start today. */
  function candidates(c) {
    const h = state(c);
    const busy = new Set(h.open.map((e) => e.place));
    const out = [];
    for (const kind of KINDS) {
      const d = def(kind);
      if (!d) continue;
      for (const sid of Object.keys(CL.content.table('settlements'))) {
        if (busy.has(sid) || (h.cool[coolKey(kind, sid)] || 0) > c.day) continue;
        if (fits(c, d, sid)) out.push({ kind, place: sid, weight: d.weight });
      }
    }
    return out;
  }

  // ---- Words ----

  /** Fill an event's text. `n` and `gold` are the choice's amounts when given. */
  function fill(text, e, c, extra = {}) {
    const d = def(e.kind);
    const f = CL.content.table('factions')[owner(c, e.place)];
    const vars = {
      place: settlement(e.place)?.name || 'the town',
      dest: settlement(e.dest)?.name || 'the next town',
      owner: f?.name || 'lords of the land',
      n: String(extra.n ?? e.n ?? d?.rations ?? ''),
      gold: String(extra.gold ?? e.gold ?? ''),
    };
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  // ---- Starting ----

  /** Start an event now (the daily check, or the debug tools). Returns it, or null if it cannot start. */
  function start(c, kind, place, extra = {}) {
    const d = def(kind);
    const h = state(c);
    if (!d || !settlement(place) || h.open.some((e) => e.place === place)) return null;
    const e = { id: h.nextId++, kind, place, start: c.day, until: c.day + d.days, seen: false, taken: false };
    if (kind === 'food_shortage') {
      e.gold = d.rations * CL.content.get('markets', 'food_ration').basePrice;
      holdGrain(c, place, d.rise);
    } else if (kind === 'courier') {
      const to = extra.dest && settlement(extra.dest) ? settlement(extra.dest) : pick(destinations(place, d), roll(c, c.day, 31 + e.id));
      if (!to) return null;
      e.dest = to.id;
      const s = settlement(place);
      e.gold = d.gold.base + d.gold.perLeague * Math.round(CL.world.mapDist(s.mapX, s.mapY, to.mapX, to.mapY));
    } else if (kind === 'infestation') {
      const band = spawnBand(c, d, e);
      e.partyId = band.id;
      e.gold = bountyFor(d, band);
    }
    h.open.push(e);
    h.cool[coolKey(kind, place)] = c.day + d.cooldown;
    CL.news.record(c, 'happening', { place, dest: e.dest, text: fill(d.news.start, e, c) });
    CL.diag.log('info', 'World event', { id: e.id, kind, place, until: e.until });
    if (c.world?.location === place) see(c, e); // happening where you stand: you hear of it at once
    return e;
  }

  const pick = (list, r) => (list.length ? list[Math.min(list.length - 1, Math.floor(r * list.length))] : null);

  /** The daily check: maybe start one event. */
  function daily(c, day) {
    const h = state(c);
    if (day < FIRST_DAY || h.open.length >= MAX_OPEN || roll(c, day, 1) >= START_CHANCE) return null;
    const all = candidates(c);
    const total = all.reduce((s, x) => s + x.weight, 0);
    if (!total) return null;
    let r = roll(c, day, 2) * total;
    let choice = all[all.length - 1];
    for (const x of all) {
      r -= x.weight;
      if (r < 0) {
        choice = x;
        break;
      }
    }
    return start(c, choice.kind, choice.place);
  }

  /** The grain of a market held at least `rise` above its usual. */
  function holdGrain(c, sid, rise) {
    const m = c.markets?.[sid];
    if (!m || !num(m.grain)) return;
    m.grain = clamp(Math.max(m.grain, baseGrain(sid) + rise), CL.trade.SCARCITY?.min ?? 0.8, CL.trade.SCARCITY?.max ?? 1.4);
  }

  /** Raise a market's scarcity of some goods (a consequence). */
  function dearer(c, sid, goods, by) {
    const m = c.markets?.[sid];
    if (!m) return;
    for (const g of goods) if (num(m[g])) m[g] = clamp(Math.max(m[g], (settlement(sid).market?.[g] ?? 1) + by), 0.8, 1.4);
  }

  /** The infestation's band: near the village, kept near it, sized against the company. */
  function spawnBand(c, d, e) {
    const s = settlement(e.place);
    const troops = CL.contracts.rollTroops(c, d);
    const p = CL.parties.spawn(c, d.band);
    const angle = roll(c, c.day, 41 + e.id) * Math.PI * 2;
    const far = d.distance[0] + (d.distance[1] - d.distance[0]) * roll(c, c.day, 42 + e.id);
    const [x, y] = CL.world.clampToMap(s.mapX + Math.cos(angle) * far, s.mapY + (Math.sin(angle) * far) / Y_ASPECT, 5);
    Object.assign(p, { troops, x, y, tx: null, ty: null, anchor: { x, y }, eventId: e.id });
    return p;
  }

  const troopCount = (p) => Object.values(p.troops).reduce((a, b) => a + b, 0);
  const bountyFor = (d, p) => d.bounty.goldBase + d.bounty.goldPerTroop * troopCount(p);

  // ---- Seeing and choosing ----

  /** The company is at the place while it is open: it knows, and so riding on is a choice it made. */
  function see(c, e) {
    if (e.seen) return;
    e.seen = true;
    CL.ui.message(`${def(e.kind).name} in ${settlement(e.place).name}: ${fill(def(e.kind).text, e, c)}`);
  }

  /** Open events at a settlement. @param {Campaign} c @param {string} sid */
  const here = (c, sid) => state(c).open.filter((e) => e.place === sid);
  const find = (c, id) => state(c).open.find((e) => e.id === id) || null;

  /** What a choice asks for, and pays. */
  function amounts(d, e, choiceId) {
    if (e.kind === 'refugees') return choiceId === 'take' ? { n: d.recruits } : { n: d.rations };
    if (e.kind === 'militia_request') return { gold: d.gold };
    return {};
  }

  /** Can the company make this choice now? Returns the reason it cannot, or ''. */
  function blocked(c, e, choiceId) {
    const d = def(e.kind);
    if (c.world?.location !== e.place) return `You must be in ${settlement(e.place).name}`;
    if (!CL.realm.welcomes(c, e.place)) return `The ${CL.content.table('factions')[owner(c, e.place)]?.name || 'lords here'} will not deal with an enemy`;
    if (e.taken) return 'Already taken on';
    if (e.kind === 'food_shortage' && c.food < d.rations) return `You need ${d.rations} rations (you have ${Math.floor(c.food)})`;
    if (e.kind === 'refugees' && choiceId === 'feed' && c.food < d.rations) return `You need ${d.rations} rations (you have ${Math.floor(c.food)})`;
    if (e.kind === 'refugees' && choiceId === 'take' && CL.party.partyCap(c) - CL.party.headcount(c) < 1) return 'Your company is full';
    if (e.kind === 'militia_request' && !c.roster.some((s) => s.woundedUntil === null)) return 'You have no fit soldiers to drill them';
    return '';
  }

  /** The choices of an event for the town screen: { id, text, reason }. */
  function options(c, e) {
    const d = def(e.kind);
    if (e.taken) return [];
    return d.choices.map((o) => ({ id: o.id, text: fill(o.text, e, c, amounts(d, e, o.id)), reason: blocked(c, e, o.id) }));
  }

  /** What the town screen says of a taken event (the bounty marked, the letter carried), or ''. */
  function takenText(e) {
    if (!e.taken) return '';
    const by = `by day ${CL.party.dayNumber(e.until)}`;
    if (e.kind === 'infestation') return `You have taken the bounty: the band is marked on your map. Drive it off ${by}.`;
    if (e.kind === 'courier') return `You carry the letter: take it to ${settlement(e.dest).name} ${by}.`;
    return '';
  }

  /**
   * Take part: make one of an event's choices. Returns { ok, text } or { ok: false, reason }.
   * @param {Campaign} c @param {number} id @param {string} choiceId
   */
  function choose(c, id, choiceId) {
    const e = find(c, id);
    const d = e && def(e.kind);
    if (!e || !d.choices.some((o) => o.id === choiceId)) return { ok: false, reason: 'Nothing to do here' };
    const why = blocked(c, e, choiceId);
    if (why) return { ok: false, reason: why };
    const f = owner(c, e.place);
    const s = settlement(e.place);
    let text = '';
    switch (e.kind) {
      case 'food_shortage':
        c.food -= d.rations;
        CL.accounts.earn(c, e.gold, `rations sold to ${s.name}`);
        CL.realm.adjust(c, f, d.rep, 'food shortage eased');
        resolve(c, e, 'eased', { n: d.rations });
        text = `You sell ${d.rations} rations to the reeve for ${e.gold} crowns. ${s.name} has bread again.`;
        break;
      case 'infestation': {
        e.taken = true;
        const p = CL.parties.find(c, e.partyId);
        if (p) p.seenAt = { x: p.x, y: p.y, day: c.day }; // the villagers show you where they are
        text = `The villagers point you to the Reavers: their camp is marked on your map. The bounty is ${e.gold} crowns.`;
        break;
      }
      case 'courier':
        e.taken = true;
        text = `You take the letter for ${settlement(e.dest).name}. ${e.gold} crowns when it is handed over, by day ${CL.party.dayNumber(e.until)}.`;
        break;
      case 'militia_request': {
        const fit = c.roster.filter((x) => x.woundedUntil === null);
        for (const x of fit) x.xp += d.xp;
        CL.accounts.earn(c, d.gold, `drilling the militia of ${s.name}`);
        CL.realm.adjust(c, f, d.rep, 'militia drilled');
        resolve(c, e, 'drilled');
        CL.clock.advance(c, d.hours, 'rest'); // a day's drill: time passes (after it is settled)
        text = `A long day on the drill field. The militia of ${s.name} stand straighter, and your soldiers learn from teaching (+${d.xp} XP each). ${d.gold} crowns.`;
        break;
      }
      case 'refugees':
        if (choiceId === 'feed') {
          c.food -= d.rations;
          c.renown += d.renown;
          CL.realm.adjust(c, f, d.rep, 'refugees fed');
          resolve(c, e, 'fed', { n: d.rations });
          text = `You share out ${d.rations} rations. The refugees at ${s.name} bless your company's name.`;
        } else {
          const room = CL.party.partyCap(c) - CL.party.headcount(c);
          const n = Math.min(d.recruits, room);
          for (let i = 0; i < n; i++) {
            const x = CL.save.addSoldier(c, d.recruit);
            CL.events.emit(c, 'SoldierRecruited', { soldierId: x.id, troop: d.recruit, settlement: e.place, via: 'refugees' });
          }
          CL.realm.adjust(c, f, 1, 'refugees taken on');
          resolve(c, e, 'took', { n });
          text = `${n === 1 ? 'One of them joins' : `${n} of them join`} the company, glad of bread and a wage.`;
        }
        break;
      default:
        return { ok: false, reason: 'Nothing to do here' };
    }
    CL.diag.log('info', 'World event choice', { id: e.id, kind: e.kind, choice: choiceId });
    CL.ui.message(text);
    return { ok: true, text };
  }

  // ---- Ending ----

  /**
   * End an event once, with its result: off the open list, into the past, the news and (when the
   * company had a hand in it) the chronicle. A second call does nothing.
   */
  function resolve(c, e, result, extra = {}) {
    const h = state(c);
    const i = h.open.indexOf(e);
    if (i < 0) return false;
    h.open.splice(i, 1);
    const d = def(e.kind);
    const band = e.partyId != null ? CL.parties.find(c, e.partyId) : null;
    if (band) c.parties.splice(c.parties.indexOf(band), 1); // a band left over goes with its event
    const past = { id: e.id, kind: e.kind, place: e.place, day: c.day, result, ...(e.dest ? { dest: e.dest } : {}) };
    h.past.push(past);
    h.past = h.past.slice(-PAST_MAX);
    if (d.news[result]) CL.news.record(c, 'happening_end', { place: e.place, dest: e.dest, text: fill(d.news[result], e, c, extra) });
    const involved = e.taken || e.seen || !['ignored', 'others'].includes(result);
    if (d.chronicle?.[result] && involved && result !== 'others') {
      CL.chronicle.add(c, { day: c.day, kind: 'happening', event: e.kind, result, place: e.place, ...(e.dest ? { dest: e.dest } : {}), ...(extra.n != null ? { n: extra.n } : {}) });
    }
    CL.diag.log('info', 'World event ended', { id: e.id, kind: e.kind, result });
    return true;
  }

  /** Its time ran out: what ignoring it does, as its text says. */
  function expire(c, e) {
    const d = def(e.kind);
    const f = owner(c, e.place);
    switch (e.kind) {
      case 'food_shortage':
        dearer(c, e.place, ['grain'], d.after);
        return resolve(c, e, 'ignored');
      case 'infestation':
        dearer(c, e.place, ['grain', 'wool'], d.plunder);
        return resolve(c, e, 'ignored');
      case 'militia_request':
        if (e.seen) CL.realm.adjust(c, f, -d.snub, 'militia left alone');
        return resolve(c, e, 'ignored');
      case 'courier':
        if (e.taken) {
          CL.realm.adjust(c, f, -d.late, 'letter late');
          CL.ui.message(`The letter for ${settlement(e.dest).name} is too late now. The ${CL.content.table('factions')[f]?.name || 'sender'} will not forget it.`);
          return resolve(c, e, 'late');
        }
        return resolve(c, e, 'ignored');
      case 'refugees':
        dearer(c, e.place, ['grain'], d.burden);
        return resolve(c, e, 'ignored');
      default:
        return resolve(c, e, 'ignored');
    }
  }

  /** From the campaign clock: hold what open events hold, end those whose time is up, start new ones. */
  function tick(c) {
    const h = state(c);
    for (const e of [...h.open]) {
      if (e.kind === 'infestation' && !CL.parties.find(c, e.partyId)) resolve(c, e, 'others'); // a patrol saw to them
      else if (c.day >= e.until) expire(c, e);
      else if (e.kind === 'food_shortage') holdGrain(c, e.place, def(e.kind).rise);
    }
    if (c.day < h.next) return;
    let checks = 0;
    while (c.day >= h.next) {
      if (checks++ < CATCH_UP) daily(c, h.next);
      h.next += 1;
    }
  }

  /** The company entered a settlement: it hears of what is going on there; a letter is handed over. */
  function onArrive(c, sid) {
    for (const e of [...state(c).open]) {
      if (e.kind === 'courier' && e.taken && e.dest === sid) {
        const d = def(e.kind);
        CL.accounts.earn(c, e.gold, `a letter from ${settlement(e.place).name}`);
        c.renown += d.renown;
        CL.realm.adjust(c, owner(c, e.place), d.rep, 'letter delivered');
        CL.ui.message(`You hand over the letter from ${settlement(e.place).name}: ${e.gold} crowns.`);
        resolve(c, e, 'delivered');
      } else if (e.place === sid) see(c, e);
    }
  }

  /** The company beat an event's band: the bounty is paid, whoever's idea it was. */
  function onBandBeaten(c, p) {
    const e = state(c).open.find((x) => x.kind === 'infestation' && x.partyId === p.id);
    if (!e) return false;
    const d = def(e.kind);
    CL.accounts.earn(c, e.gold, `the bounty of ${settlement(e.place).name}`);
    c.renown += d.bounty.renown;
    CL.realm.adjust(c, owner(c, e.place), d.bounty.rep, 'bounty');
    CL.ui.message(`The Reavers of ${settlement(e.place).name} are broken. The bounty of ${e.gold} crowns is yours.`);
    delete e.partyId; // the battle removes the band
    return resolve(c, e, 'cleared');
  }

  /** An open event's line for the Journal: where, what, and how long it has. */
  function journal(c = CL.campaign) {
    return state(c)
      .open.filter((e) => e.seen || e.taken)
      .map((e) => {
        const d = def(e.kind);
        const left = `${Math.max(0, e.until - c.day).toFixed(1)} days left`;
        return { id: e.id, title: `${d.name} · ${settlement(e.place).name}`, text: takenText(e) || fill(d.text, e, c), ignored: fill(d.ignored, e, c), left };
      });
  }

  // ---- Save ----

  /** Repair the saved events onto `s` (after the world parties, so a band's event finds its band). */
  function sanitize(s, d) {
    const raw = d?.happenings;
    const h = blank(s.day);
    if (raw && typeof raw === 'object') {
      if (num(raw.next)) h.next = Math.max(0, raw.next);
      const ids = new Set();
      for (const e of Array.isArray(raw.open) ? raw.open.slice(0, MAX_OPEN * 2) : []) {
        if (!def(e?.kind) || !settlement(e.place) || !Number.isInteger(e.id) || e.id < 1 || ids.has(e.id) || !num(e.start) || !num(e.until)) continue;
        if (h.open.some((o) => o.place === e.place)) continue; // one at a time in a place
        const q = { id: e.id, kind: e.kind, place: e.place, start: e.start, until: e.until, seen: e.seen === true, taken: e.taken === true };
        if (num(e.gold) && e.gold >= 0) q.gold = Math.min(9999, Math.round(e.gold));
        if (e.kind === 'courier') {
          if (!settlement(e.dest) || e.dest === e.place) continue;
          q.dest = e.dest;
        }
        if (e.kind === 'infestation') {
          const band = Number.isInteger(e.partyId) ? s.parties.find((p) => p.id === e.partyId) : null;
          if (!band) continue; // its band is gone: nothing to bounty
          q.partyId = band.id;
          band.eventId = q.id;
        }
        ids.add(q.id);
        h.open.push(q);
      }
      for (const e of Array.isArray(raw.past) ? raw.past.slice(-PAST_MAX) : []) {
        if (!def(e?.kind) || !settlement(e.place) || !RESULTS[e.kind].includes(e.result) || !Number.isInteger(e.id) || !num(e.day)) continue;
        h.past.push({ id: e.id, kind: e.kind, place: e.place, day: e.day, result: e.result, ...(settlement(e.dest) ? { dest: e.dest } : {}) });
      }
      for (const [k, v] of Object.entries(raw.cool && typeof raw.cool === 'object' ? raw.cool : {})) {
        if (KINDS.includes(k.split('|')[0]) && num(v) && Object.keys(h.cool).length < 100) h.cool[k] = v;
      }
      const top = Math.max(0, ...h.open.map((e) => e.id), ...h.past.map((e) => e.id));
      h.nextId = Math.max(top + 1, Number.isInteger(raw.nextId) ? raw.nextId : 1);
    }
    // A band marked for an event that is no longer open is an ordinary band now.
    for (const p of s.parties) if (p.eventId != null && !h.open.some((e) => e.partyId === p.id)) delete p.eventId;
    s.happenings = h;
  }

  /** Save migration 15 → 16 (pure): no events yet; the first check is tomorrow. @param {Record<string, any>} d */
  const migrate = (d) => ({ ...d, version: 16, happenings: blank(Number.isFinite(d.day) ? d.day : 0) });

  /** Content checks (from content.validate). */
  function validate(C, err) {
    const known = new Set(['place', 'dest', 'owner', 'n', 'gold']);
    const check = (where, text) => {
      if (typeof text !== 'string' || !text) return err(`${where}: needs text`);
      for (const [, k] of text.matchAll(/\{(\w+)\}/g)) if (!known.has(k)) err(`${where}: unknown placeholder {${k}}`);
    };
    for (const [id, d] of Object.entries(C.world_events || {})) {
      const at = `world event ${id}`;
      if (!KINDS.includes(id)) err(`${at}: no rules for this kind`);
      if (!WHERE.includes(d.where)) err(`${at}: unknown where ${d.where}`);
      for (const k of ['weight', 'days', 'cooldown']) if (!(num(d[k]) && d[k] > 0)) err(`${at}: needs a positive ${k}`);
      for (const k of ['text', 'ignored']) check(`${at} ${k}`, d[k]);
      check(`${at} news start`, d.news?.start);
      for (const r of RESULTS[id] || []) if (r !== 'others' || d.news?.others) check(`${at} news ${r}`, d.news?.[r]);
      for (const [r, t] of Object.entries(d.chronicle || {})) {
        if (!(RESULTS[id] || []).includes(r)) err(`${at}: chronicle for unknown result ${r}`);
        check(`${at} chronicle ${r}`, t);
      }
      if (!Array.isArray(d.choices) || !d.choices.length) err(`${at}: needs choices`);
      for (const o of d.choices || []) check(`${at} choice ${o.id}`, o.text);
      if (id === 'infestation' && !C.party_templates?.[d.band]) err(`${at}: unknown band ${d.band}`);
      if (id === 'infestation') for (const t of d.troopPool || []) if (!C.troops?.[t]) err(`${at}: unknown troop ${t}`);
      if (id === 'refugees' && !C.troops?.[d.recruit]) err(`${at}: unknown troop ${d.recruit}`);
    }
    for (const k of KINDS) if (!C.world_events?.[k]) err(`world events: missing ${k}`);
  }

  CL.happenings = {
    FIRST_DAY,
    MAX_OPEN,
    START_CHANCE,
    KINDS,
    RESULTS,
    blank,
    state,
    roll,
    fits,
    candidates,
    start,
    daily,
    tick,
    here,
    find,
    options,
    takenText,
    choose,
    resolve,
    expire,
    onArrive,
    onBandBeaten,
    journal,
    fill,
    sanitize,
    migrate,
    validate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
