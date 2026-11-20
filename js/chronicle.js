// @ts-check
/* Crownless company chronicle and roll of honour (V2-10; design §10.5, §21.4, SC-03).
 *
 * The chronicle (c.chronicle, saved, newest last, at most CHRONICLE_MAX entries) is the company's own
 * history, beside the regional news in the Journal. It keeps short entries with stable IDs, never a
 * log of every decision:
 *   founded    a new campaign begins                 begun      an older save starts keeping it
 *   recruited  soldiers who joined at a place on a day (merged: one entry per place and day)
 *   promoted   soldiers trained to a new troop (merged: one entry per troop and day)
 *   battle     a notable battle: any loss, any battle where someone of yours fell, or one with at
 *              least NOTABLE_KILLS enemies defeated (with who fell)
 *   deserted   a soldier who slipped away             retired    a soldier you retired with honour
 *   quest      a story quest (Q1–Q4) completed or failed
 *   happening  a world event the company had a hand in (P7-08: took part, or was there and rode on)
 *   tourney    a tournament you fought in (P7-09): champion, finalist or out, and to whom
 *   business   your mill bought, sold or seized, and by whom (P7-10)
 *
 * The roll of honour (c.honour, saved) remembers soldiers who left the company: who they were, where
 * they came from, how long they served and their record, and how they left (fell, deserted, retired).
 * It keeps the newest HONOUR_MAX in full; older ones are only counted (`earlier`), so a long campaign
 * can't swell the save. A fallen soldier's last battle is counted in their record.
 *
 * Both are filled by listening to domain events (js/events.js), like the service records:
 *   SoldierRecruited, SoldierPromoted, BattleResolved, SoldierKilled, SoldierDeserted, SoldierRetired;
 * quests call `quest` directly (js/story.js). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const CHRONICLE_MAX = 80;
  const HONOUR_MAX = 60;
  const NOTABLE_KILLS = 8;
  const NAMES_MAX = 6; // names kept on one entry
  const KINDS = ['founded', 'begun', 'recruited', 'promoted', 'battle', 'deserted', 'retired', 'quest', 'happening', 'tourney', 'business'];
  const HOW = ['fell', 'deserted', 'retired'];

  /** @returns {HonourRoll} */
  const blankHonour = () => ({ list: [], earlier: { fell: 0, deserted: 0, retired: 0 } });
  /** A new campaign's chronicle. @returns {ChronicleEntry[]} */
  const blank = () => [{ day: 0, kind: 'founded' }];

  /** Add an entry; the oldest go first once the chronicle is full (the first entry stays). @param {Campaign} c @param {ChronicleEntry} e */
  function add(c, e) {
    if (!Array.isArray(c.chronicle)) c.chronicle = [];
    c.chronicle.push(e);
    while (c.chronicle.length > CHRONICLE_MAX) c.chronicle.splice(1, 1);
    return e;
  }

  const troopName = (id) => CL.content.table('troops')[id]?.name || 'soldier';
  const place = (id) => CL.soldiers.placeName(id);
  const short = (s, n = 40) => (typeof s === 'string' ? s.slice(0, n) : null);

  /**
   * Put a soldier on the roll of honour. `last`: their final battle's share, when they fell in it.
   * @param {Campaign} c @param {Soldier} s @param {string} how one of HOW
   * @param {{ foe?: string | null, kills?: number, assists?: number, win?: boolean }} [last]
   */
  function honour(c, s, how, last = {}) {
    if (!c.honour) c.honour = blankHonour();
    const r = s.record || CL.soldiers.blankRecord();
    const fell = how === 'fell';
    /** @type {HonourEntry} */
    const entry = {
      id: s.id,
      name: s.name,
      troop: s.troop,
      culture: s.culture ?? null,
      origin: s.origin ?? null,
      joined: s.joined ?? null,
      left: c.day,
      how,
      foe: short(last.foe ?? null),
      battles: r.battles + (fell ? 1 : 0),
      victories: r.victories + (fell && last.win ? 1 : 0),
      kills: r.kills + (fell ? last.kills || 0 : 0),
      wounds: r.wounds,
      wagesPaid: r.wagesPaid,
    };
    if (s.trait) entry.trait = s.trait; // P7-07
    c.honour.list.push(entry);
    while (c.honour.list.length > HONOUR_MAX) {
      const old = c.honour.list.shift();
      c.honour.earlier[old.how] = (c.honour.earlier[old.how] || 0) + 1;
    }
    return entry;
  }

  // ---- Listening ----

  const nameOf = (c, id) => c.roster.find((s) => s.id === id)?.name || null;

  CL.events.on('SoldierRecruited', (e, c) => {
    const name = nameOf(c, /** @type {number} */ (e.soldierId));
    if (!name) return;
    const at = /** @type {string | null} */ (e.settlement ?? null);
    const last = c.chronicle?.at(-1);
    if (last?.kind === 'recruited' && last.place === at && Math.floor(last.day) === Math.floor(c.day)) {
      last.n = (last.n || 1) + 1;
      if (last.names.length < NAMES_MAX) last.names.push(name);
      return;
    }
    add(c, { day: c.day, kind: 'recruited', place: at, names: [name], n: 1 });
  });

  CL.events.on('SoldierPromoted', (e, c) => {
    const name = nameOf(c, /** @type {number} */ (e.soldierId)) || 'A soldier';
    const to = /** @type {string} */ (e.to);
    const last = c.chronicle?.at(-1);
    if (last?.kind === 'promoted' && last.to === to && Math.floor(last.day) === Math.floor(c.day)) {
      last.n = (last.n || 1) + 1;
      if (last.names.length < NAMES_MAX) last.names.push(name);
      return;
    }
    add(c, { day: c.day, kind: 'promoted', names: [name], n: 1, to });
  });

  CL.events.on('BattleResolved', (e, c) => {
    const killed = /** @type {number[]} */ (e.killed || []);
    const kills = Number(e.kills) || 0;
    if (e.win && !killed.length && kills < NOTABLE_KILLS) return; // an ordinary win
    const fallen = /** @type {string[]} */ (e.fallenNames || []).slice(0, NAMES_MAX);
    add(c, { day: c.day, kind: 'battle', foe: short(e.encounterName ?? null), win: Boolean(e.win), kills, fallen, lost: killed.length, auto: e.kind === 'auto' });
  });

  CL.events.on('SoldierKilled', (e, c) => {
    const s = /** @type {Soldier | undefined} */ (e.soldier);
    if (s) honour(c, s, 'fell', { foe: /** @type {string} */ (e.encounterName ?? null), kills: Number(e.kills) || 0, win: Boolean(e.win) });
  });

  CL.events.on('SoldierDeserted', (e, c) => {
    const s = /** @type {Soldier | undefined} */ (e.soldier);
    if (!s) return;
    honour(c, s, 'deserted');
    add(c, { day: c.day, kind: 'deserted', id: s.id, name: s.name });
  });

  CL.events.on('SoldierRetired', (e, c) => {
    const s = /** @type {Soldier | undefined} */ (e.soldier);
    if (!s) return;
    honour(c, s, 'retired');
    add(c, { day: c.day, kind: 'retired', id: s.id, name: s.name });
  });

  /** A story quest ended (js/story.js). @param {Campaign} c @param {string} id @param {string} status */
  function quest(c, id, status) {
    add(c, { day: c.day, kind: 'quest', quest: id, status });
  }

  // ---- Reading ----

  const list = (names, n) => {
    const shown = names.join(', ');
    return n > names.length ? `${shown} and ${n - names.length} more` : shown;
  };

  /** An entry as a sentence. @param {ChronicleEntry} e */
  function text(e) {
    switch (e.kind) {
      case 'founded':
        return 'You took to the road with a sword and a few crowns.';
      case 'begun':
        return 'The company began keeping its chronicle.';
      case 'recruited': {
        const n = e.n || e.names.length;
        return `${list(e.names, n)} joined the company${e.place ? ` at ${place(e.place)}` : ''}.`;
      }
      case 'promoted': {
        const n = e.n || e.names.length;
        return `${list(e.names, n)} ${n === 1 ? 'was' : 'were'} promoted to ${troopName(e.to)}.`;
      }
      case 'battle': {
        const how = e.win ? 'Victory' : 'Defeat';
        const against = e.foe ? ` against the ${e.foe.replace(/^The /, '')}` : '';
        const fell = e.lost ? ` Fallen: ${list(e.fallen, e.lost)}.` : '';
        return `${how}${against}: ${e.kills} enemies defeated${e.auto ? ' (auto-resolved)' : ''}.${fell}`;
      }
      case 'deserted':
        return `${e.name} deserted in the night.`;
      case 'retired':
        return `${e.name} retired from the company with honour.`;
      case 'quest': {
        const q = CL.content.table('quests')[e.quest];
        return `${e.status === 'done' ? 'Completed' : 'Failed'}: ${q?.title || e.quest}.`;
      }
      case 'tourney':
        return CL.tourney.chronicleText(e);
      case 'business':
        return CL.business.chronicleText(e);
      case 'happening': {
        const t = CL.content.table('world_events')[e.event]?.chronicle?.[e.result];
        return t ? CL.happenings.fill(t, { kind: e.event, place: e.place, dest: e.dest }, CL.campaign, { n: e.n }) : '';
      }
      default:
        return '';
    }
  }

  /** Newest first, at most `n`. @param {Campaign} c */
  const recent = (c, n = 15) => (c.chronicle || []).slice(-n).reverse();

  /** One line about a soldier on the roll: how they left, and their service. @param {HonourEntry} h */
  function honourText(h) {
    const P = CL.party;
    const how = { fell: `Fell${h.foe ? ` fighting the ${h.foe.replace(/^The /, '')}` : ' in battle'}`, deserted: 'Deserted', retired: 'Retired with honour' }[h.how];
    const from = h.origin ? ` of ${place(h.origin)}` : '';
    const served = h.joined === null ? 'served before the records' : `served ${Math.max(0, Math.round(h.left - h.joined))} days`;
    const stats = [`${h.battles} battle${h.battles === 1 ? '' : 's'}`, `${h.kills} kill${h.kills === 1 ? '' : 's'}`, `${h.wounds} wound${h.wounds === 1 ? '' : 's'}`, `${h.wagesPaid} crowns paid`].join(' · ');
    const trait = CL.traits?.def(h.trait);
    return { title: `${h.name}${from}, ${troopName(h.troop)}${trait ? ` · ${trait.name}` : ''}`, line: `${how} on day ${P.dayNumber(h.left)} · ${served} · ${stats}` };
  }

  // ---- Who did what (the result screen) ----

  /**
   * The battle's standouts, for the result screen: the hero's tally and up to three soldiers by kills,
   * then assists. Plain text lines. @param {any} g @param {Record<number, string>} names
   */
  function standouts(g, names) {
    const out = [];
    if (g.hero?.kills) out.push(`You felled ${g.hero.kills}`);
    const mine = g.allies
      .filter((u) => u.soldierId != null && ((u.kills || 0) > 0 || (u.assists || 0) > 0))
      .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.assists || 0) - (a.assists || 0))
      .slice(0, 3);
    for (const u of mine) {
      const bits = [];
      if (u.kills) bits.push(`${u.kills} felled`);
      if (u.assists) bits.push(`${u.assists} helped down`);
      out.push(`${names[u.soldierId] || 'A soldier'} ${bits.join(', ')}`);
    }
    const mara = g.allies.find((u) => u.companion && (u.kills || 0) > 0);
    if (mara) out.push(`${CL.companion.def(mara.companion)?.name || 'Your companion'} ${mara.kills} felled`);
    return out;
  }

  // ---- Saves ----

  const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const count = (n) => (isNum(n) ? Math.min(99999, Math.floor(n)) : 0);
  const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : null);
  const names = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, NAMES_MAX).map((x) => x.slice(0, 24)) : []);

  /** Repair the saved chronicle and roll of honour onto `s`. @param {Campaign} s @param {any} d */
  function sanitize(s, d) {
    const settlements = CL.content.table('settlements');
    const troops = CL.content.table('troops');
    s.chronicle = [];
    for (const e of Array.isArray(d?.chronicle) ? d.chronicle.slice(-CHRONICLE_MAX) : []) {
      if (!e || !KINDS.includes(e.kind) || !isNum(e.day)) continue;
      /** @type {ChronicleEntry} */
      const out = { day: e.day, kind: e.kind };
      if (e.kind === 'recruited') Object.assign(out, { place: settlements[e.place] ? e.place : null, names: names(e.names), n: Math.max(1, count(e.n)) });
      if (e.kind === 'promoted') {
        if (!troops[e.to]) continue;
        Object.assign(out, { names: names(e.names), n: Math.max(1, count(e.n)), to: e.to });
      }
      if (e.kind === 'battle') Object.assign(out, { foe: str(e.foe), win: Boolean(e.win), kills: count(e.kills), fallen: names(e.fallen), lost: count(e.lost), auto: Boolean(e.auto) });
      if (e.kind === 'deserted' || e.kind === 'retired') Object.assign(out, { id: count(e.id), name: str(e.name, 24) || 'A soldier' });
      if (e.kind === 'quest') {
        if (!CL.content.table('quests')[e.quest] || !['done', 'failed'].includes(e.status)) continue;
        Object.assign(out, { quest: e.quest, status: e.status });
      }
      if (e.kind === 'tourney') {
        if (!settlements[e.place] || !['champion', 'final', 'out'].includes(e.result)) continue;
        Object.assign(out, { place: e.place, result: e.result, foe: str(e.foe) || 'a fighter', round: Math.min(2, count(e.round)) });
      }
      if (e.kind === 'business') {
        if (!settlements[e.place] || !['bought', 'sold', 'seized'].includes(e.event)) continue;
        Object.assign(out, { event: e.event, place: e.place });
        if (e.event === 'seized' && CL.content.table('factions')[e.by]) out.by = e.by;
      }
      if (e.kind === 'happening') {
        if (!CL.content.table('world_events')[e.event]?.chronicle?.[e.result] || !settlements[e.place]) continue;
        Object.assign(out, { event: e.event, result: e.result, place: e.place });
        if (settlements[e.dest]) out.dest = e.dest;
        if (isNum(e.n)) out.n = count(e.n);
      }
      s.chronicle.push(out);
    }
    if (!s.chronicle.length) s.chronicle = blank();
    s.honour = blankHonour();
    const h = d?.honour;
    for (const k of HOW) s.honour.earlier[k] = count(h?.earlier?.[k]);
    for (const e of Array.isArray(h?.list) ? h.list.slice(-HONOUR_MAX) : []) {
      if (!e || !troops[e.troop] || !HOW.includes(e.how) || !isNum(e.left)) continue;
      s.honour.list.push({
        id: count(e.id),
        name: str(e.name, 24) || 'A soldier',
        troop: e.troop,
        culture: CL.content.table('cultures')[e.culture] ? e.culture : null,
        origin: settlements[e.origin] ? e.origin : null,
        joined: isNum(e.joined) ? e.joined : null,
        left: e.left,
        how: e.how,
        foe: str(e.foe),
        battles: count(e.battles),
        victories: count(e.victories),
        kills: count(e.kills),
        wounds: count(e.wounds),
        wagesPaid: count(e.wagesPaid),
        ...(CL.traits?.def(e.trait) ? { trait: e.trait } : {}),
      });
    }
  }

  /** Save migration 6 → 7 (pure): an empty roll of honour, and a chronicle that begins now. @param {Record<string, any>} d */
  const migrate = (d) => ({ ...d, version: 7, chronicle: [{ day: Number.isFinite(d.day) && d.day >= 0 ? d.day : 0, kind: 'begun' }], honour: blankHonour() });

  CL.chronicle = { CHRONICLE_MAX, HONOUR_MAX, NOTABLE_KILLS, KINDS, HOW, blank, blankHonour, add, honour, quest, text, recent, honourText, standouts, sanitize, migrate };
})(typeof window !== 'undefined' ? window : globalThis);
