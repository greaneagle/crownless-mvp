// @ts-check
/* Crownless named soldiers and service records (V2-03; design §10, SC-01–03, Prototype C).
 *
 * Every soldier in the company is a person: a name from their culture (data/names.js), the place
 * they joined at (origin), the day they joined, an optional portrait slot for later art, a service
 * record and a short list of service notes. Status is not stored: a soldier in the roster is serving,
 * fit or wounded (the fallen and retired get their own roll of honour in V2-10).
 *
 * Names: the culture comes from the troop, else the origin settlement, else its owner's faction (see
 * data/names.js). A form is picked by weight and filled from the culture's lists, drawing from the
 * campaign's seeded `names` stream, so the same save always names the same soldiers. A name already
 * in the roster is tried again; after eight tries a numeral is added ("Tam Owl II").
 *
 * Records are kept by listening to domain events (js/events.js), not by the code that fights or pays:
 *   BattleResolved   battles, victories, kills, assists; on a loss, a capture for everyone
 *   SoldierWounded   wounds;  SoldierPromoted  a note;  WagesPaid  wages actually received
 * Notes are bounded (NOTES_MAX): the joining note stays, the oldest of the rest go first.
 *
 * Soldier fields (save schema v5): { id, troop, xp, woundedUntil, name, culture, origin, joined,
 *   portrait, record: { battles, victories, kills, assists, wounds, captures, wagesPaid }, notes }. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const NOTES_MAX = 8;
  const NAME_MAX = 24;
  const NAME_TRIES = 8;
  const NOTABLE_KILLS = 3; // felling this many in one battle earns a note
  const RECORD_KEYS = ['battles', 'victories', 'kills', 'assists', 'wounds', 'captures', 'wagesPaid'];
  const NOTE_KINDS = ['joined', 'veteran', 'wounded', 'promoted', 'captured', 'notable', 'feted', 'trait'];
  const FILTERS = ['all', 'fit', 'wounded', 'ready', 'infantry', 'archer', 'cavalry'];
  const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

  /** @returns {SoldierRecord} */
  const blankRecord = () => ({ battles: 0, victories: 0, kills: 0, assists: 0, wounds: 0, captures: 0, wagesPaid: 0 });
  const cultures = () => CL.content.table('cultures');
  /** @param {string | null | undefined} id */
  const settlement = (id) => (id ? CL.content.table('settlements')[id] || null : null);
  /** "Greywall" for Greywall Fort; the settlement's name otherwise. @param {string | null | undefined} id */
  const placeName = (id) => {
    const s = settlement(id);
    return s ? s.placeName || s.name : null;
  };

  /**
   * The culture a recruit's name comes from: the troop's own, else the origin's, else the origin's
   * owner's (or, with no origin, the troop's faction's), else the first culture.
   * @param {ContentId} troopId @param {string | null} origin @param {any} [c] a campaign (its holdings), or a save being migrated
   */
  function cultureFor(troopId, origin, c = CL.campaign) {
    const K = cultures();
    const t = CL.content.table('troops')[troopId];
    if (t?.culture && K[t.culture]) return t.culture;
    const s = settlement(origin);
    if (s?.culture && K[s.culture]) return s.culture;
    const faction = s ? (CL.realm?.owner(s.id, /** @type {any} */ (c)) ?? s.ownerFaction) : t?.faction;
    const f = CL.realm.faction(faction);
    if (f?.culture && K[f.culture]) return f.culture;
    return Object.keys(K)[0];
  }

  /**
   * A full name from a culture, not already in `taken`. `gender` (D-P8g): 'male' (every soldier: the
   * men's names), 'female', or 'any' (both lists in their old order: followers, the tournament rival
   * and the 4 → 5 migration, so their names are as they were before the lists were split).
   * @param {string} cultureId @param {string | null} origin @param {() => number} rand @param {Set<string>} taken
   * @param {'male' | 'female' | 'any'} [gender]
   */
  function makeName(cultureId, origin, rand, taken, gender = 'male') {
    const k = cultures()[cultureId];
    const women = k.givenFemale || [];
    const given = gender === 'female' && women.length ? women : gender === 'any' ? [...k.given, ...women] : k.given;
    const place = placeName(origin);
    const forms = k.forms.filter((f) => place || !f.pattern.includes('{origin}'));
    const total = forms.reduce((n, f) => n + f.weight, 0);
    /** @param {string[]} list */
    const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
    let name = '';
    for (let i = 0; i < NAME_TRIES; i++) {
      const roll = rand() * total;
      let acc = 0;
      const form =
        forms.find((f) => {
          acc += f.weight;
          return roll < acc;
        }) || forms[forms.length - 1];
      name = form.pattern.replace(/\{(\w+)\}/g, (_, part) => {
        if (part === 'given') return pick(given);
        if (part === 'trade') return pick(k.trades);
        if (part === 'epithet') return pick(k.epithets);
        return place;
      });
      if (!taken.has(name)) return name;
    }
    for (let n = 2; ; n++) {
      const next = `${name}${ROMAN[n] || ` ${n}`}`;
      if (!taken.has(next)) return next;
    }
  }

  /** Names already used in a roster. @param {Array<{ name?: string }>} roster */
  const namesIn = (roster) => new Set(roster.map((s) => s.name).filter(Boolean));

  /**
   * The person fields for a new soldier: name, culture, origin, joining day, an empty record and the
   * joining note. Draws from the campaign's `names` stream.
   * @param {Campaign} c @param {ContentId} troop
   * @param {{ origin?: string | null, veteran?: boolean }} [opts] veteran: served before records were kept
   */
  /**
   * P10-09 (D-P10d): who answers a hire of `troop`: the troop itself, or in its `women.share` of
   * hires (the campaign's 'recruits' roll, so the same seed gives the same recruits) the woman's troop
   * of its line. @param {Campaign} c @param {string} troop
   */
  function answers(c, troop) {
    const w = CL.content.table('troops')[troop]?.women;
    if (!w?.troop || !CL.content.table('troops')[w.troop]) return troop;
    return CL.autoresolve.roll(c, 'recruits') < w.share ? w.troop : troop;
  }

  // P10-09: soldiers' portraits, a few generic faces: a skin, a face, a hair colour, and for men a
  // beard, women a hair style. Chosen once from the soldier's id and kept (`portrait`, 'm-1-2-3').
  const PORTRAIT = { skins: 3, faces: 2, hair: 5, beards: 4, styles: 2 };
  /** @param {{ id: number, troop: string }} s */
  function portraitFor(s) {
    const female = CL.content.table('troops')[s.troop]?.gender === 'female';
    let h = (s.id * 2654435761) >>> 0; // a soldier's own, from its id: the same every time
    const take = (n) => {
      const v = h % n;
      h = Math.floor(h / n) ^ ((h * 40503) >>> 0) % 97;
      return v;
    };
    const parts = [take(PORTRAIT.skins), take(PORTRAIT.faces), take(PORTRAIT.hair), take(female ? PORTRAIT.styles : PORTRAIT.beards)];
    return `${female ? 'f' : 'm'}-${parts.join('-')}`;
  }

  function fresh(c, troop, { origin = c.world?.location ?? null, veteran = false } = {}) {
    const o = settlement(origin) ? origin : null;
    const culture = cultureFor(troop, o, c);
    // Regular soldiers are men (D-P8g); a troop of women soldiers would say `gender: 'female'`.
    const gender = CL.content.table('troops')[troop]?.gender === 'female' ? 'female' : 'male';
    const name = makeName(culture, o, () => CL.autoresolve.roll(c, 'names'), namesIn(c.roster), gender);
    return {
      name,
      culture,
      origin: o,
      joined: veteran ? null : c.day,
      portrait: null,
      record: blankRecord(),
      notes: [veteran ? { day: c.day, kind: 'veteran' } : { day: c.day, kind: 'joined', place: o }],
    };
  }

  // ---- Notes ----

  /** Add a note; the joining note stays, the oldest of the rest go first. @param {Soldier} s @param {SoldierNote} note */
  function note(s, note) {
    s.notes.push(note);
    while (s.notes.length > NOTES_MAX) s.notes.splice(s.notes.length > 1 ? 1 : 0, 1);
  }

  /** A note as a sentence. @param {SoldierNote} n */
  function noteText(n) {
    const troop = (id) => CL.content.table('troops')[id]?.name || 'a new rank';
    switch (n.kind) {
      case 'joined':
        return n.place ? `Joined the company at ${placeName(n.place)}.` : 'Joined the company.';
      case 'veteran':
        return 'Served with the company before it kept records.';
      case 'wounded':
        return n.foe ? `Wounded fighting ${n.foe}.` : 'Wounded in battle.';
      case 'promoted':
        return `Promoted to ${troop(n.to)}.`;
      case 'captured':
        return 'Taken captive with the company, then released.';
      case 'notable':
        return `Felled ${n.kills} enemies${n.foe ? ` fighting ${n.foe}` : ''}.`;
      case 'feted':
        return n.place ? `Feted at home in ${placeName(n.place)}.` : 'Feted at home.';
      case 'trait': {
        const t = CL.traits?.def(n.trait);
        return t ? `Became ${t.name} ${t.why}.` : '';
      }
      default:
        return '';
    }
  }

  // ---- Records, kept by listening to events ----

  /** @param {Campaign} c @param {number} id */
  const find = (c, id) => c.roster.find((s) => s.id === id) || null;

  CL.events.on('BattleResolved', (e, c) => {
    const win = Boolean(e.win);
    const foe = typeof e.encounterName === 'string' ? e.encounterName : null;
    const kills = /** @type {Record<number, number>} */ (e.soldierKills || {});
    const assists = /** @type {Record<number, number>} */ (e.soldierAssists || {});
    for (const id of /** @type {number[]} */ (e.participants || [])) {
      const s = find(c, id);
      if (!s) continue; // fell in this battle
      s.record.battles++;
      if (win) s.record.victories++;
      s.record.kills += kills[id] || 0;
      s.record.assists += assists[id] || 0;
      if ((kills[id] || 0) >= NOTABLE_KILLS) note(s, { day: c.day, kind: 'notable', kills: kills[id], foe });
      CL.traits?.check(c, s); // a milestone reached: a trait, once (P7-07)
    }
    if (!win) {
      for (const s of c.roster) {
        s.record.captures++;
        note(s, { day: c.day, kind: 'captured' });
      }
    }
  });

  CL.events.on('SoldierWounded', (e, c) => {
    const s = find(c, /** @type {number} */ (e.soldierId));
    if (!s) return;
    s.record.wounds++;
    note(s, { day: c.day, kind: 'wounded', foe: typeof e.encounterName === 'string' ? e.encounterName : null });
    CL.traits?.check(c, s); // a milestone reached: a trait, once (P7-07)
  });

  CL.events.on('SoldierPromoted', (e, c) => {
    const s = find(c, /** @type {number} */ (e.soldierId));
    if (s) note(s, { day: c.day, kind: 'promoted', to: /** @type {string} */ (e.to) });
  });

  CL.events.on('WagesPaid', (e, c) => {
    for (const [id, amount] of Object.entries(/** @type {Record<string, number>} */ (e.shares || {}))) {
      const s = find(c, Number(id));
      if (s) s.record.wagesPaid += amount;
    }
  });

  /**
   * Split a wage payment over the soldiers owed it, in proportion to their wages; the shares add up to
   * exactly what was paid (SC-02: the record counts money actually paid).
   * @param {Campaign} c @param {number} paid @returns {Record<number, number>}
   */
  function wageShares(c, paid) {
    const owed = c.roster.map((s) => [s.id, CL.content.troop(s.troop).wage]);
    const total = owed.reduce((n, [, w]) => n + w, 0);
    /** @type {Record<number, number>} */
    const shares = {};
    if (!total || paid <= 0) return shares;
    let given = 0;
    for (const [id, w] of owed) {
      shares[id] = Math.floor((w * paid) / total);
      given += shares[id];
    }
    for (let i = 0; given < paid && owed.length; i = (i + 1) % owed.length) {
      shares[owed[i][0]]++;
      given++;
    }
    return shares;
  }

  // ---- Looking at the company ----

  /**
   * Soldiers matching a roster filter, in the order they joined.
   * @param {Campaign} c @param {string} [filter] one of FILTERS @returns {Soldier[]}
   */
  function list(c, filter = 'all') {
    const role = (s) => CL.content.troop(s.troop).role;
    const keep = {
      all: () => true,
      fit: (s) => s.woundedUntil === null,
      wounded: (s) => s.woundedUntil !== null,
      ready: (s) => CL.party.readyFor(s) && CL.party.upgradeOptions(s.troop).length > 0,
      infantry: (s) => role(s) === 'infantry',
      archer: (s) => role(s) === 'archer',
      cavalry: (s) => role(s) === 'cavalry',
    }[filter] || (() => true);
    return c.roster.filter(keep);
  }

  /** Where they joined, or how they came. @param {Soldier} s */
  const originText = (s) => (s.origin ? placeName(s.origin) : s.joined === null ? 'before the records' : 'on the road');

  /** Give a soldier a new name. Returns the cleaned name, or null if it was empty. @param {Campaign} c @param {number} id @param {string} name */
  function rename(c, id, name) {
    const s = find(c, id);
    const clean = cleanName(name);
    if (!s || !clean) return null;
    s.name = clean;
    CL.diag.log('info', 'Soldier renamed', { id, name: clean });
    return clean;
  }

  /** Printable, single-spaced, at most NAME_MAX characters. @param {unknown} name */
  function cleanName(name) {
    if (typeof name !== 'string') return '';
    // Like the hero's name (js/character.js): no control characters or angle brackets.
    return [...name]
      .filter((ch) => ch >= ' ' && ch !== '\u007f' && ch !== '<' && ch !== '>')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NAME_MAX)
      .trim();
  }

  // ---- Saves ----

  /** @param {unknown} n */
  const count = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(99999, Math.floor(n)) : 0);

  /**
   * Repair a saved soldier's person fields onto `s` (id, troop, xp, woundedUntil already checked).
   * A soldier without a name (a damaged save) gets one from the names stream rather than being lost.
   * @param {any} e the saved entry @param {Soldier} s @param {Campaign} c the campaign being built
   */
  function sanitize(e, s, c) {
    // Same field order as a new recruit (fresh), so a save and a reload give identical JSON; `kit`
    // (P7-03, fine kit) comes last and only when given, as the blacksmith adds it.
    const origin = settlement(e?.origin) ? e.origin : null;
    const culture = cultures()[e?.culture] ? e.culture : cultureFor(s.troop, origin, c);
    s.name = cleanName(e?.name) || makeName(culture, origin, () => CL.autoresolve.roll(c, 'names'), namesIn(c.roster));
    s.culture = culture;
    s.origin = origin;
    s.joined = typeof e?.joined === 'number' && Number.isFinite(e.joined) && e.joined >= 0 ? e.joined : null;
    s.portrait = typeof e?.portrait === 'string' && e.portrait.length <= 64 ? e.portrait : null;
    s.record = blankRecord();
    for (const k of RECORD_KEYS) s.record[k] = count(e?.record?.[k]);
    s.notes = [];
    for (const n of Array.isArray(e?.notes) ? e.notes : []) {
      if (!n || !NOTE_KINDS.includes(n.kind) || typeof n.day !== 'number' || !Number.isFinite(n.day)) continue;
      /** @type {SoldierNote} */
      const out = { day: n.day, kind: n.kind };
      if (n.kind === 'joined' || n.kind === 'feted') out.place = settlement(n.place) ? n.place : null;
      if (n.kind === 'promoted') {
        if (!CL.content.table('troops')[n.to]) continue;
        out.to = n.to;
      }
      if (n.kind === 'wounded' || n.kind === 'notable') out.foe = typeof n.foe === 'string' ? n.foe.slice(0, 40) : null;
      if (n.kind === 'notable') out.kills = count(n.kills);
      if (n.kind === 'trait') {
        if (!CL.traits?.def(n.trait)) continue;
        out.trait = n.trait;
      }
      s.notes.push(out);
      if (s.notes.length >= NOTES_MAX) break;
    }
    if (e?.kit === true) s.kit = true; // fine kit (P7-03; the cap is checked with the blacksmith)
    if (CL.traits?.def(e?.trait)) s.trait = e.trait; // earned at a milestone (P7-07)
  }

  /**
   * Save migration 4 → 5 (pure): name every soldier of an older save, in roster order, from a names
   * stream seeded by the save's own seed. Their origin and joining day were never recorded.
   * @param {Record<string, any>} d @returns {Record<string, any>}
   */
  function migrateRoster(d) {
    const seed = Number.isInteger(d.rngSeed) ? d.rngSeed : 0;
    const names = { rng: { names: CL.autoresolve.streamSeed(seed, 'names') }, rngSeed: seed };
    const owners = d.owners && typeof d.owners === 'object' ? d.owners : {};
    const roster = [];
    for (const e of Array.isArray(d.roster) ? d.roster : []) {
      if (!e || typeof e !== 'object') {
        roster.push(e);
        continue;
      }
      const troop = CL.content.table('troops')[e.troop] ? e.troop : null;
      const culture = troop ? cultureFor(troop, null, { owners }) : Object.keys(cultures())[0];
      const name = makeName(culture, null, () => CL.autoresolve.roll(/** @type {any} */ (names), 'names'), namesIn(roster), 'any');
      roster.push({ ...e, name, culture, origin: null, joined: null, portrait: null, record: blankRecord(), notes: [{ day: Number(d.day) || 0, kind: 'veteran' }] });
    }
    return { ...d, roster, rng: { ...(d.rng || {}), names: names.rng.names } };
  }

  CL.soldiers = { answers, portraitFor, PORTRAIT,
    NOTES_MAX,
    NAME_MAX,
    RECORD_KEYS,
    NOTE_KINDS,
    FILTERS,
    blankRecord,
    cultureFor,
    makeName,
    fresh,
    note,
    noteText,
    wageShares,
    list,
    originText,
    placeName,
    rename,
    cleanName,
    sanitize,
    migrateRoster,
  };
})(typeof window !== 'undefined' ? window : globalThis);
