// @ts-check
/* Crownless save service.
 *
 * Schema v6 (key `crownless_save`, from build 1.5.0; v5 1.4.0, v4 1.3.0, v3 1.2.0; docs/SAVE-FORMAT.md): named soldiers with
 * troop IDs, XP and wound timers, the item inventory, the campaign day clock and every system's state,
 * plus the world the save belongs to (`worldId`) and the build that wrote it (`contentVersion`), and
 * (v4) the named random streams (`rng`), the encounter result counter and the event ID counter, and
 * (v6) what the company knows of each troop (`troopKnowledge`, the troop tree).
 *
 * Loading (design §24.7, V2-01). Anything read back from storage or a file goes through `fromRaw`:
 *   1. structural check for its own schema version: a save missing the fields its version always
 *      had (for example a near-empty `{ "version": 2 }`) is rejected, not filled with defaults;
 *   2. the save must belong to this world;
 *   3. migrations step it up one schema version at a time (MIGRATIONS), each a pure function;
 *   4. `sanitize` repairs it field by field: unknown IDs and bad values fall back to safe defaults.
 * A save migrated on load is also kept, as it was, in `crownless_save_v<n>` (written once).
 *
 * Writing. Every write keeps the last known good save: the previous save is copied to
 * `crownless_save_backup` only if it is itself complete, and a write only counts once the stored text
 * reads back unchanged. A corrupt or partial main save falls back to the backup.
 *
 * Schema v1 (key `crownless_v03_party`, build 0.3.x) held aggregate counts. It is migrated on
 * first load (infantry → levy, archers → hunter) and left untouched as a further backup.
 * All storage goes through CL.storage (js/storage.js). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const VERSION = 21;
  const KEY = 'crownless_save';
  const BACKUP_KEY = 'crownless_save_backup';
  const LEGACY_KEY = 'crownless_v03_party';
  // V2-13 (SC-33): a save that needs content this build doesn't have is kept here, untouched.
  const INCOMPATIBLE_KEY = 'crownless_save_incompatible';
  // W-05b (decision D-W2, owner 2026-11-19): a save of a world this build doesn't have (the Border
  // March of 2.0–2.6, before the world grew) is refused, and kept here untouched.
  const OTHER_WORLD_KEY = 'crownless_save_other_world';
  /** @param {number} version @returns {string} key holding a save exactly as it was before migrating */
  const preMigrationKey = (version) => `crownless_save_v${version}`;
  const MAX_VALUE = 99999;
  const MAX_ROSTER = 200;
  const V1_TROOP = { infantry: 'levy', archer: 'hunter' };
  const WOUND_DAYS = 2;
  const AUTOSAVE_DAYS = 1; // while travelling or waiting on the map, save once per game day

  /** @param {unknown} n @returns {n is number} */
  const isCount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  /** @param {unknown} n @param {number} fallback */
  const count = (n, fallback) => (isCount(n) ? Math.min(MAX_VALUE, Math.floor(n)) : fallback);
  /** @param {unknown} v @returns {v is Record<string, any>} */
  const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  /** The world a new campaign starts in (W-04: the first in the content). */
  const worldId = () => CL.world.defaultId();
  /** Does this build have the world a save belongs to? */
  const knownWorld = (id) => typeof id === 'string' && Boolean(CL.content.table('world_map')[id]);

  /**
   * A brand-new campaign (GDD §5): the background's kit — 60 crowns, worn sword, clothing,
   * oak shield, food — and no soldiers. The character itself is filled in by the creator.
   * @param {ContentId} [background] @returns {Campaign}
   */
  function starter(background = 'farmhand') {
    const seed = CL.autoresolve.newSeed();
    /** @type {Campaign} */
    const c = {
      version: VERSION,
      worldId: worldId(), // the world (content package) this campaign belongs to
      contentVersion: CL.BUILD, // the build that last wrote it
      gold: 0,
      renown: 0,
      battles: 0,
      victories: 0,
      day: 0, // campaign days elapsed (fractional)
      nextSoldierId: 1,
      roster: [],
      inventory: {},
      lastResolvedBattle: 0,
      world: CL.world.defaultState(), // map position, current settlement, site timers
      character: null, // set by the character creator
      equipment: CL.character.blankEquipment(),
      food: 0, // rations; one feeds 5 people for a day
      morale: CL.upkeep.MORALE.start,
      nextWagesDay: CL.upkeep.WAGE_INTERVAL,
      starving: false,
      markets: CL.trade.defaultMarkets(), // current scarcity per settlement and good
      cargo: {}, // trade goods carried
      rngSeed: seed, // the world random stream: world parties, contracts, auto-resolve, retreat
      rng: CL.autoresolve.streamSeeds(seed), // the other named random streams: casualties, loot, upkeep
      nextResultId: 1, // the next encounter result to commit (exactly once; js/encounter.js)
      nextEventId: 1, // the next domain event ID (js/events.js)
      parties: [], // patrols, caravans and bands on the map
      partySpawns: {}, // template id → day its next party may appear
      nextPartyId: 1,
      contract: null, // the one active contract
      contractOffers: {}, // settlement id → posted offer
      nextContractId: 1,
      contractsDone: 0,
      reputation: CL.realm.defaultReputation(), // kingdom → score [-100, 100] (GDD §10)
      people: {}, // the people of the realms: rulers and lords (P8-02), filled in below
      rulers: {}, // realm → the person holding its ruler's office (P8-02)
      nextPersonId: 1,
      holdings: {}, // settlement → { kind, sovereign, holder, controller, seat, administrator, claims } (P8-02)
      prisoners: [], // lords held captive: by you, or off-screen by a realm (P8-01)
      allegiance: CL.allegiance.blank(), // independent, a realm's mercenary, or its vassal (P8-04)
      relations: CL.realm.defaultRelations(), // kingdom pair → peace, tension or war (W-07)
      story: CL.story.blank(), // quest progress, story flags, conversation visits (GDD §13)
      companion: null, // Mara, once she joins (GDD §10)
      news: CL.news.blank(), // recent world events and regional news lines
      troopKnowledge: {}, // troop → 'seen' | 'owned': the troop tree as discovered (js/troops.js)
      chronicle: CL.chronicle.blank(), // the company's own history (js/chronicle.js)
      honour: CL.chronicle.blankHonour(), // the roll of honour: soldiers who fell or left
      accounts: CL.accounts.blank(), // the company chest and follower budgets; `gold` is your purse (js/accounts.js)
      ledger: [], // the newest money transfers, each with a source, a destination and a reason
      followers: { quartermaster: null, merchant: null, surgeon: null, blacksmith: null, scout: null }, // camp followers (js/quartermaster.js, js/merchant.js, js/surgeon.js, js/blacksmith.js, js/scout.js)
      medicine: 0, // the surgeon's supply (P7-01)
      detachments: [], // parts of the company sent off under a captain (P7-05)
      retinue: [], // companions of the wider world (P7-06)
      happenings: CL.happenings.blank(0), // world events: open, past, cooldowns (P7-08)
      tourney: CL.tourney.blank(0), // tournaments: each host's next, the open ones, your bracket and rival (P7-09)
      businesses: CL.business.blank(), // your mill, and those sold or seized (P7-10)
    };
    CL.realm.sanitizeHoldings(c, null); // the world's people and holdings as its data begins them
    CL.character.applyKit(c, background);
    CL.upkeep.stowFood(c);
    CL.parties.ensure(c, true);
    return c;
  }

  /**
   * Enlist a new soldier with the next unused ID: a named person (js/soldiers.js) who joined here.
   * @param {Campaign} c @param {ContentId} troop @param {number | null} [woundedUntil]
   * @param {{ origin?: string | null, veteran?: boolean }} [opts] where they joined (default: here)
   * @returns {Soldier}
   */
  function addSoldier(c, troop, woundedUntil = null, opts = {}) {
    /** @type {Soldier} */
    const s = { id: c.nextSoldierId++, troop, xp: 0, woundedUntil, ...CL.soldiers.fresh(c, troop, opts) };
    c.roster.push(s);
    return s;
  }

  /** @param {unknown} id */
  const knownTroop = (id) => typeof id === 'string' && Boolean(CL.content.table('troops')[id]) && id !== 'hero';
  /** @param {string} id */
  const knownItem = (id) => Boolean(CL.content.table('items')[id]);

  // ---- Structure: what every save of a schema version always had ----

  // Each check is [field, kind]. A v2 save may come from any build since 0.5.0, so only the fields
  // v2 had from the start are required; later v2 fields get their defaults. A v3 save is always
  // written whole by 1.2.0 or later, so all of it is required.
  /** @type {Array<[string, string]>} */
  const V2_FIELDS = [
    ['gold', 'number'],
    ['renown', 'number'],
    ['battles', 'number'],
    ['victories', 'number'],
    ['day', 'number'],
    ['nextSoldierId', 'number'],
    ['roster', 'array'],
    ['inventory', 'object'],
    ['lastResolvedBattle', 'number'],
  ];
  /** @type {Array<[string, string]>} */
  const V3_FIELDS = [
    ...V2_FIELDS,
    ['worldId', 'string'],
    ['contentVersion', 'string'],
    ['world', 'object'],
    ['character', 'object|null'],
    ['equipment', 'object'],
    ['food', 'number'],
    ['morale', 'number'],
    ['nextWagesDay', 'number'],
    ['markets', 'object'],
    ['cargo', 'object'],
    ['rngSeed', 'number'],
    ['parties', 'array'],
    ['partySpawns', 'object'],
    ['nextPartyId', 'number'],
    ['contract', 'object|null'],
    ['contractOffers', 'object'],
    ['reputation', 'object'],
    ['owners', 'object'],
    ['story', 'object'],
    ['companion', 'object|null'],
    ['news', 'object'],
  ];
  /** @type {Record<number, Array<[string, string]>>} */
  const REQUIRED = {
    1: [['gold', 'number']],
    2: V2_FIELDS,
    3: V3_FIELDS,
    4: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number']],
    5: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number']],
    6: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object']],
    7: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object']],
    8: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object']],
    9: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object']],
    10: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object']],
    11: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number']],
    12: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number']],
    13: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number']],
    14: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array']],
    15: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array']],
    16: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object']],
    17: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object'], ['tourney', 'object']],
    18: [...V3_FIELDS, ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object'], ['tourney', 'object'], ['businesses', 'object']],
    19: [...V3_FIELDS.filter(([f]) => f !== 'owners'), ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object'], ['tourney', 'object'], ['businesses', 'object'], ['people', 'object'], ['rulers', 'object'], ['nextPersonId', 'number'], ['holdings', 'object']],
    20: [...V3_FIELDS.filter(([f]) => f !== 'owners'), ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object'], ['tourney', 'object'], ['businesses', 'object'], ['people', 'object'], ['rulers', 'object'], ['nextPersonId', 'number'], ['holdings', 'object'], ['prisoners', 'array']],
    21: [...V3_FIELDS.filter(([f]) => f !== 'owners'), ['rng', 'object'], ['nextResultId', 'number'], ['nextEventId', 'number'], ['troopKnowledge', 'object'], ['chronicle', 'array'], ['honour', 'object'], ['accounts', 'object'], ['ledger', 'array'], ['followers', 'object'], ['relations', 'object'], ['medicine', 'number'], ['detachments', 'array'], ['retinue', 'array'], ['happenings', 'object'], ['tourney', 'object'], ['businesses', 'object'], ['people', 'object'], ['rulers', 'object'], ['nextPersonId', 'number'], ['holdings', 'object'], ['prisoners', 'array'], ['allegiance', 'object']],
  };

  /** @param {unknown} v @param {string} kind */
  function isKind(v, kind) {
    if (kind === 'number') return typeof v === 'number' && Number.isFinite(v);
    if (kind === 'string') return typeof v === 'string';
    if (kind === 'array') return Array.isArray(v);
    if (kind === 'object') return isObject(v);
    if (kind === 'object|null') return v === null || isObject(v);
    return false;
  }

  /**
   * Is this a complete save of a version this build can read? Never changes `d`.
   * @param {unknown} d parsed JSON
   * @returns {{ problems: string[], newer?: boolean, otherWorld?: boolean }}
   */
  function check(d) {
    if (!isObject(d)) return { problems: ['it is not a saved campaign'] };
    const v = d.version;
    if (!Number.isInteger(v) || v < 1) return { problems: ['it has no save version'] };
    if (v > VERSION) return { problems: [`it uses save version ${v}; this build reads up to ${VERSION}`], newer: true };
    const problems = [];
    for (const [field, kind] of REQUIRED[v]) {
      if (!(field in d)) problems.push(`"${field}" is missing`);
      else if (!isKind(d[field], kind)) problems.push(`"${field}" is not a valid ${kind.replace('|null', '')}`);
    }
    if (problems.length) return { problems };
    if (v >= 3 && !knownWorld(d.worldId)) return { problems: [`it belongs to another world ("${d.worldId}")`], otherWorld: true };
    return { problems: [] };
  }

  // ---- Migrations: one pure step per schema version ----

  // The Sundered Realm's people and holdings as build 2.24.0 began them (P8-02): constants, so the
  // 18 → 19 migration stays pure (NEXT-PLAN §9) whatever later builds do to the world's data.
  // People: [id, key, name, gender, realm, home, kin ('person:n:tie' …), traits]; holdings:
  // [settlement, kind, sovereign, holder, seat].
  const V19_SUNDERED = {
    people: [
      ['person:1', 'godric_ardane', 'Godric Ardane', 'male', 'valedorn', 'stonebridge', 'person:7:child', 'stern, pious, slow to forgive'],
      ['person:2', 'hamon_greymantle', 'Hamon Greymantle', 'male', 'valedorn', 'greywall_fort', 'person:4:sibling person:6:child', 'proud, watchful, a hard border lord'],
      ['person:3', 'avice_westmere', 'Avice Westmere', 'female', 'valedorn', 'westholt_castle', 'person:5:cousin', 'shrewd, patient, keeps her word'],
      ['person:4', 'hawise_greymantle', 'Hawise Greymantle', 'female', 'valedorn', 'brackenfield', 'person:2:sibling', 'blunt, generous, quick to anger'],
      ['person:5', 'serlo_fernby', 'Serlo Fernby', 'male', 'valedorn', 'fernley', 'person:3:cousin', 'cautious, thrifty'],
      ['person:6', 'tancred_greymantle', 'Tancred Greymantle', 'male', 'valedorn', 'greywall_fort', 'person:2:parent', 'eager, reckless, hungry for land'],
      ['person:7', 'alys_ardane', 'Alys Ardane', 'female', 'valedorn', 'stonebridge', 'person:1:parent', 'clever, restless, her father’s favourite'],
      ['person:8', 'severin_aquila', 'Severin Aquila', 'male', 'aurelian', 'eastwatch', 'person:14:child', 'learned, cold, bound by the law'],
      ['person:9', 'cassian_vatro', 'Cassian Vatro', 'male', 'aurelian', 'ashgate_fort', 'person:13:child', 'ambitious, a veteran of the frontier'],
      ['person:10', 'domitia_celer', 'Domitia Celer', 'female', 'aurelian', 'castra_nova', 'person:12:sibling', 'proud, exacting, old imperial blood'],
      ['person:11', 'marcia_corvo', 'Marcia Corvo', 'female', 'aurelian', 'saltmere', '', 'practical, a trader at heart'],
      ['person:12', 'faustin_celer', 'Faustin Celer', 'male', 'aurelian', 'tessaro', 'person:10:sibling', 'easygoing, fond of wine'],
      ['person:13', 'decimo_vatro', 'Decimo Vatro', 'male', 'aurelian', 'ashgate_fort', 'person:9:parent', 'dutiful, in his father’s shadow'],
      ['person:14', 'junia_aquila', 'Junia Aquila', 'female', 'aurelian', 'eastwatch', 'person:8:parent', 'sharp-tongued, a rider of note'],
      ['person:15', 'hakon_ulfring', 'Hakon Ulfring', 'male', 'hrothmark', 'hrothgard', 'person:19:spouse', 'bold, open-handed, loves a feast'],
      ['person:16', 'astrid_hallsdottir', 'Astrid Hallsdottir', 'female', 'hrothmark', 'ulfstead_hold', 'person:18:cousin', 'fierce, honest, holds a grudge'],
      ['person:17', 'torvald_skarn', 'Torvald Skarn', 'male', 'hrothmark', 'skarnwall', 'person:20:child', 'grim, careful, old and wary'],
      ['person:18', 'kettil_brandsson', 'Kettil Brandsson', 'male', 'hrothmark', 'kettleby', 'person:16:cousin', 'loyal, plain-spoken'],
      ['person:19', 'ingrid_ulfring', 'Ingrid Ulfring', 'female', 'hrothmark', 'hrothgard', 'person:15:spouse', 'wise, watchful, the hall’s true voice'],
      ['person:20', 'ragna_skarn', 'Ragna Skarn', 'female', 'hrothmark', 'skarnwall', 'person:17:parent', 'restless, a shieldmaiden of the hills'],
      ['person:21', 'lucrezia_salviati', 'Lucrezia Salviati', 'female', 'vessaro', 'vessara', 'person:25:child', 'cunning, rich, never in a hurry'],
      ['person:22', 'ottavio_morosco', 'Ottavio Morosco', 'male', 'vessaro', 'torre_salina', 'person:24:sibling', 'vain, brave, deep in debt'],
      ['person:23', 'ruggero_canale', 'Ruggero Canale', 'male', 'vessaro', 'castel_verro', '', 'careful, a builder of walls'],
      ['person:24', 'chiara_morosco', 'Chiara Morosco', 'female', 'vessaro', 'marenna', 'person:22:sibling', 'quiet, clever, pays her brother’s debts'],
      ['person:25', 'matteo_salviati', 'Matteo Salviati', 'male', 'vessaro', 'vessara', 'person:21:parent', 'charming, idle, a gambler'],
      ['person:26', 'bastiano_lanza', 'Bastiano Lanza', 'male', 'vessaro', 'vessara', '', 'the Queen’s household knight; steady, sworn'],
    ],
    rulers: {'valedorn': 'person:1', 'aurelian': 'person:8', 'hrothmark': 'person:15', 'vessaro': 'person:21'},
    holdings: [
      ['stonebridge', 'town', 'valedorn', 'person:1', null],
      ['greywall_fort', 'fort', 'valedorn', 'person:2', null],
      ['oakford', 'village', 'valedorn', 'person:1', 'stonebridge'],
      ['highmere', 'village', 'valedorn', 'person:2', 'greywall_fort'],
      ['brackenfield', 'village', 'valedorn', 'person:4', 'greywall_fort'],
      ['westholt_castle', 'fort', 'valedorn', 'person:3', null],
      ['ashby', 'village', 'valedorn', 'person:3', 'westholt_castle'],
      ['fernley', 'village', 'valedorn', 'person:5', 'westholt_castle'],
      ['eastwatch', 'town', 'aurelian', 'person:8', null],
      ['ashgate_fort', 'fort', 'aurelian', 'person:9', null],
      ['dunmarsh', 'village', 'aurelian', 'person:9', 'ashgate_fort'],
      ['redfield', 'village', 'aurelian', 'person:8', 'eastwatch'],
      ['saltmere', 'village', 'aurelian', 'person:11', 'ashgate_fort'],
      ['castra_nova', 'fort', 'aurelian', 'person:10', null],
      ['calvinum', 'village', 'aurelian', 'person:10', 'castra_nova'],
      ['tessaro', 'village', 'aurelian', 'person:12', 'castra_nova'],
      ['hrothgard', 'town', 'hrothmark', 'person:15', null],
      ['ulfstead_hold', 'fort', 'hrothmark', 'person:16', null],
      ['skarnwall', 'fort', 'hrothmark', 'person:17', null],
      ['birkholm', 'village', 'hrothmark', 'person:16', 'ulfstead_hold'],
      ['eldmoor', 'village', 'hrothmark', 'person:15', 'hrothgard'],
      ['thornvik', 'village', 'hrothmark', 'person:17', 'skarnwall'],
      ['kettleby', 'village', 'hrothmark', 'person:18', 'skarnwall'],
      ['vessara', 'town', 'vessaro', 'person:21', null],
      ['torre_salina', 'fort', 'vessaro', 'person:22', null],
      ['castel_verro', 'fort', 'vessaro', 'person:23', null],
      ['lucco', 'village', 'vessaro', 'person:22', 'torre_salina'],
      ['marenna', 'village', 'vessaro', 'person:24', 'torre_salina'],
      ['pellio', 'village', 'vessaro', 'person:21', 'vessara'],
      ['sorra', 'village', 'vessaro', 'person:23', 'castel_verro'],
    ],
  };

  /**
   * 18 → 19 (build 2.24.0, P8-02): the holdings model. `owners` (fort → kingdom) becomes `holdings`
   * (every settlement of a kingdom), with the people of the realms and the rulers' offices. A fort
   * whose owner had changed (Q4's Greywall) passes to the new kingdom as sovereign and controller,
   * held by its ruler, with its villages; the original holders keep `old` claims. A save of another
   * world (only the tests' worlds) keeps just its owner overrides; `sanitize` completes it from that
   * world's data.
   * @param {Record<string, any>} d @returns {Record<string, any>}
   */
  function migrateHoldings(d) {
    const { owners, ...rest } = d;
    const over = isObject(owners) ? owners : {};
    if (d.worldId !== 'sundered_realm') {
      /** @type {Record<string, any>} */
      const partial = {};
      for (const [sid, f] of Object.entries(over)) if (typeof f === 'string') partial[sid] = { controller: f, sovereign: f };
      return { ...rest, version: 19, holdings: partial, rulers: {}, nextPersonId: 1 };
    }
    /** @type {Record<string, any>} */
    const people = {};
    for (const [id, key, name, gender, realm, home, kin, traits] of V19_SUNDERED.people) {
      const ties = kin ? kin.split(' ').map((k) => k.split(':')) : [];
      people[id] = { id, key, name, gender, realm, home, kin: ties.map(([a, n, tie]) => ({ person: `${a}:${n}`, tie })), traits, status: 'free', heldBy: null };
    }
    /** @type {Record<string, any>} */
    const holdings = {};
    for (const [sid, kind, sovereign, holder, seat] of V19_SUNDERED.holdings) holdings[sid] = { kind, sovereign, holder, controller: sovereign, seat, administrator: null, claims: [] };
    const day = typeof d.day === 'number' && Number.isFinite(d.day) ? d.day : 0;
    for (const [fort, f] of Object.entries(over)) {
      const h = holdings[fort];
      const ruler = /** @type {Record<string, string>} */ (V19_SUNDERED.rulers)[f];
      if (h?.kind !== 'fort' || f === h.sovereign || !ruler) continue;
      for (const sid of [fort, ...Object.keys(holdings).filter((v) => holdings[v].seat === fort)]) {
        const x = holdings[sid];
        x.claims = [{ by: x.holder, realm: x.sovereign, since: day, kind: 'old' }];
        Object.assign(x, { sovereign: f, controller: f, holder: ruler });
      }
    }
    return { ...rest, version: 19, people, rulers: { ...V19_SUNDERED.rulers }, holdings, nextPersonId: V19_SUNDERED.people.length + 1 };
  }

  /** Steps from schema n to n + 1, applied in order. v1 → v2 is `migrateV1` (it rebuilds the roster). */
  /** @type {Record<number, (d: Record<string, any>) => Record<string, any>>} */
  const MIGRATIONS = {
    // 2 → 3 (build 1.2.0, V2-01): the save names its world and the build that wrote it. Every v2
    // save was a Border March campaign; which build wrote it was never recorded. (The one world id
    // in js/: a fixed fact about old saves, W-04.)
    2: (d) => ({ ...d, version: 3, worldId: 'border_march', contentVersion: 'unknown' }),
    // 3 → 4 (build 1.3.0, V2-02): named random streams seeded from the world seed, the encounter
    // result counter (exactly-once commits) and the event ID counter. Both counters start fresh:
    // nothing before v4 used them.
    3: (d) => ({
      ...d,
      version: 4,
      rng: CL.autoresolve.streamSeeds(Number.isInteger(d.rngSeed) ? d.rngSeed : 0),
      nextResultId: 1,
      nextEventId: 1,
    }),
    // 4 → 5 (build 1.4.0, V2-03): every soldier becomes a named person with a service record
    // (js/soldiers.js). Names come from a names stream seeded by the save's own seed; where they
    // joined and when was never recorded, so they start as veterans with an empty record.
    4: (d) => ({ ...CL.soldiers.migrateRoster(d), version: 5 }),
    // 5 → 6 (build 1.5.0, V2-03b): what the company knows of each troop (the troop tree). An older
    // company knows the troops it has and what they were trained from; nothing was ever seen.
    5: (d) => ({ ...CL.troopTree.migrateKnowledge(d), version: 6 }),
    // 6 → 7 (build 1.14.0, V2-10): the company chronicle (it begins on the day of the migration) and
    // an empty roll of honour; nobody who left before was remembered.
    6: (d) => CL.chronicle.migrate(d),
    // 7 → 8 (build 1.15.0, V2-11): separate accounts (an empty company chest, no follower budgets), an
    // empty ledger, and no followers yet. Your purse is the old `gold`.
    7: (d) => ({ ...d, version: 8, accounts: CL.accounts.blank(), ledger: [], followers: { quartermaster: null } }),
    // 8 → 9 (build 1.16.0, V2-12): room for a merchant follower (none yet).
    8: (d) => ({ ...d, version: 9, followers: { ...(d.followers || {}), merchant: null } }),
    // 9 → 10 (build 2.9.0, W-07): relations between kingdoms. None were recorded before, so every pair
    // starts as the world's data says (sanitize fills them in): an empty record here.
    9: (d) => ({ ...d, version: 10, relations: {} }),
    // 10 → 11 (build 2.12.0, P7-01): room for a surgeon (none yet) and no medicine.
    10: (d) => ({ ...d, version: 11, medicine: 0, followers: { ...(d.followers || {}), surgeon: null } }),
    // 11 → 12 (build 2.13.0, P7-03): room for a blacksmith (none yet). Nobody had fine kit or forged gear.
    11: (d) => ({ ...d, version: 12, followers: { ...(d.followers || {}), blacksmith: null } }),
    // 12 → 13 (build 2.15.0, P7-02): room for a scout (none yet).
    12: (d) => ({ ...d, version: 13, followers: { ...(d.followers || {}), scout: null } }),
    // 13 → 14 (build 2.16.0, P7-05): no detachments yet.
    13: (d) => ({ ...d, version: 14, detachments: [] }),
    // 14 → 15 (build 2.17.0, P7-06): no other companions yet.
    14: (d) => ({ ...d, version: 15, retinue: [] }),
    // 15 → 16 (build 2.19.0, P7-08): world events, none yet.
    15: (d) => CL.happenings.migrate(d),
    // 16 → 17 (build 2.20.0, P7-09): tournaments, none fought yet.
    16: (d) => CL.tourney.migrate(d),
    // 17 → 18 (build 2.21.0, P7-10): businesses, none owned yet.
    17: (d) => CL.business.migrate(d),
    // 18 → 19 (build 2.24.0, P8-02): holdings, people and the rulers' offices replace `owners`.
    18: migrateHoldings,
    // 19 → 20 (build 2.26.0, P8-01): no prisoners yet; the lords' parties form at their homes on load.
    19: (d) => ({ ...d, version: 20, prisoners: [] }),
    // 20 → 21 (build 2.27.0, P8-04): everyone was independent.
    20: (d) => ({ ...d, version: 21, allegiance: { kind: 'independent', realm: null, since: typeof d.day === 'number' ? d.day : 0, until: null, serviceDays: 0, summonsMissed: 0, history: [], window: null, lastOath: null, nextPay: null, served: null, hunt: null } }),
  };

  /**
   * Step a v2+ save up to the current schema. Pure: returns a new object, `d` is unchanged.
   * @param {Record<string, any>} d @returns {Record<string, any> | null} null if a step is missing
   */
  function migrate(d) {
    let x = d;
    while (x.version < VERSION) {
      const step = MIGRATIONS[x.version];
      if (!step) return null;
      x = step(x);
    }
    return x;
  }

  /**
   * Repair a parsed save field by field: unknown IDs and malformed entries are dropped and missing
   * fields get their defaults (GDD §13). Older schema versions (v2) are migrated first. This does not
   * check that the save is complete; loading and importing do that first (`check`, `fromRaw`).
   * @param {any} d parsed JSON of unknown shape @returns {Campaign | null} null if it isn't a v2+ save
   */
  function sanitize(d) {
    if (!isObject(d) || !Number.isInteger(d.version) || d.version < 2 || d.version > VERSION) return null;
    d = migrate(d);
    if (!d) return null;
    const s = starter();
    if (knownWorld(d.worldId)) s.worldId = d.worldId; // its own world (W-04), when this build has it
    for (const k of /** @type {const} */ (['gold', 'renown', 'battles', 'victories', 'lastResolvedBattle'])) s[k] = count(d[k], s[k]);
    s.day = isCount(d.day) ? Math.min(MAX_VALUE, d.day) : 0;
    const seen = new Set(); // soldier IDs: unique across the company and its detachments (P7-05)
    if (Array.isArray(d.roster)) {
      s.roster = [];
      for (const e of d.roster.slice(0, MAX_ROSTER)) {
        const soldier = soldierOf(e, seen, s);
        if (soldier) s.roster.push(soldier);
      }
    }
    const maxId = s.roster.reduce((m, e) => Math.max(m, e.id), 0);
    s.nextSoldierId = Math.max(maxId + 1, count(d.nextSoldierId, 1));
    s.world = CL.world.sanitize(d.world);
    s.character = CL.character.sanitize(d.character);
    s.equipment = CL.character.sanitizeEquipment(d.equipment);
    s.inventory = {};
    if (isObject(d.inventory)) {
      for (const [id, n] of Object.entries(d.inventory)) {
        if (knownItem(id) && isCount(n) && n >= 1) s.inventory[id] = Math.min(MAX_VALUE, Math.floor(n));
      }
    }
    CL.upkeep.sanitize(s, d); // food, morale, payday (and stows any food items)
    CL.trade.sanitize(s, d); // market scarcity and cargo
    CL.realm.sanitize(s, d); // reputation, people, rulers and holdings (P8-02), relations
    CL.story.sanitize(s, d); // quests and flags: unknown quests and stages are dropped
    CL.companion.sanitize(s, d); // companion and her gear
    CL.news.sanitize(s, d); // recent events and news lines
    CL.parties.sanitize(s, d); // world parties and the RNG seed
    CL.lords.sanitize(s, d); // prisoners (P8-01), after the people and the lords' parties
    CL.allegiance.sanitize(s, d); // your allegiance (P8-04)
    CL.contracts.sanitize(s, d); // after parties: an active hunt needs its band
    CL.happenings.sanitize(s, d); // world events (P7-08), after parties: an infestation needs its band
    CL.tourney.sanitize(s, d); // tournaments and your rival (P7-09)
    CL.troopTree.sanitize(s, d); // what the company knows of each troop
    CL.chronicle.sanitize(s, d); // the chronicle and the roll of honour
    CL.accounts.sanitize(s, d); // the company chest, budgets and the ledger
    CL.quartermaster.sanitize(s, d); // camp followers
    CL.merchant.sanitize(s, d); // the merchant and their goods, prices and log
    CL.business.sanitize(s, d); // your mill, its money's ledger and log (P7-10), after accounts
    CL.surgeon.sanitize(s, d); // the surgeon and the medicine (P7-01)
    CL.blacksmith.sanitize(s, d); // the blacksmith, and fine kit within its cap (P7-03)
    CL.scout.sanitize(s, d); // the scout (P7-02)
    CL.retinue.sanitize(s, d); // the other companions (P7-06), before the detachments some may lead
    // Detachments (P7-05): their soldiers (IDs unique across every party), then their map parties and
    // purses, once the companion, the parties and the accounts are in place.
    CL.detachments.sanitize(s, d, (e) => soldierOf(e, seen, s));
    CL.detachments.relink(s);
    const awayMax = s.detachments.reduce((m, x) => Math.max(m, ...x.soldiers.map((e) => e.id)), 0);
    s.nextSoldierId = Math.max(s.nextSoldierId, awayMax + 1);
    // Named random streams (after parties, which restores rngSeed) and the result and event counters.
    const seeds = CL.autoresolve.streamSeeds(s.rngSeed);
    for (const name of CL.autoresolve.STREAMS) {
      const v = d.rng?.[name];
      s.rng[name] = Number.isInteger(v) && v >= 0 ? v >>> 0 : seeds[name];
    }
    s.nextResultId = Math.max(1, Number.isInteger(d.nextResultId) ? d.nextResultId : 1);
    s.nextEventId = Math.max(1, Number.isInteger(d.nextEventId) ? d.nextEventId : 1);
    return s; // contentVersion: this build, from starter()
  }

  /**
   * One saved soldier, repaired, or null if unusable (unknown troop, bad or repeated ID).
   * @param {any} e @param {Set<number>} seen IDs taken so far @param {Campaign} s the campaign being built
   * @returns {Soldier | null}
   */
  function soldierOf(e, seen, s) {
    if (!e || !knownTroop(e.troop) || !Number.isInteger(e.id) || e.id < 1 || seen.has(e.id)) return null;
    seen.add(e.id);
    /** @type {Soldier} */
    const soldier = /** @type {any} */ ({
      id: e.id,
      troop: e.troop,
      xp: count(e.xp, 0),
      woundedUntil: isCount(e.woundedUntil) ? e.woundedUntil : null,
    });
    CL.soldiers.sanitize(e, soldier, s); // name, culture, origin, joined, portrait, record, notes
    return soldier;
  }

  /**
   * Convert a 0.3.x aggregate save into a current campaign.
   * @param {any} d @returns {Campaign | null}
   */
  function migrateV1(d) {
    if (d?.version !== 1) return null;
    const c = starter();
    c.roster = [];
    c.nextSoldierId = 1;
    for (const k of /** @type {const} */ (['gold', 'renown', 'battles', 'victories'])) c[k] = count(d[k], c[k]);
    /** @param {'infantry' | 'archer'} role @param {unknown} n @param {boolean} wounded */
    const add = (role, n, wounded) => {
      for (let i = 0; i < Math.min(count(n, 0), MAX_ROSTER); i++) {
        addSoldier(c, V1_TROOP[role], wounded ? WOUND_DAYS : null, { origin: null, veteran: true });
      }
    };
    add('infantry', d.infantry, false);
    add('archer', d.archer, false);
    add('infantry', d.woundedInfantry, true);
    add('archer', d.woundedArcher, true);
    c.lastResolvedBattle = c.battles;
    return c;
  }

  /**
   * The load path for any saved campaign (storage, a file, the pre-import slot): check its structure
   * and world, migrate it, repair it. Never touches storage.
   * @param {unknown} d parsed JSON
   * @returns {{ campaign: Campaign | null, problems: string[], from?: number, newer?: boolean, otherWorld?: boolean, incompatible?: boolean }}
   */
  function fromRaw(d) {
    const r = check(d);
    if (r.problems.length) return { campaign: null, ...r };
    const raw = /** @type {Record<string, any>} */ (d);
    // SC-33: named soldiers of troops this build doesn't know (a removed or modded troop) are never
    // dropped quietly: the save is refused, saying who and what.
    if (raw.version >= 2 && Array.isArray(raw.roster)) {
      const unknown = raw.roster.filter((e) => e && typeof e === 'object' && !knownTroop(e.troop));
      if (unknown.length) {
        const who = unknown.slice(0, 3).map((e) => `${typeof e.name === 'string' && e.name ? e.name : `soldier #${e.id}`} (${String(e.troop).slice(0, 30)})`);
        const more = unknown.length > 3 ? ` and ${unknown.length - 3} more` : '';
        return { campaign: null, problems: [`it needs troops this version of the game does not have: ${who.join(', ')}${more}`], incompatible: true };
      }
    }
    // SC-33 (P8-02): holdings of a kingdom this build doesn't have are refused, saying which.
    if (raw.version >= 19) {
      const gone = CL.realm.unknownRealms(raw);
      if (gone.length) return { campaign: null, problems: [`it needs kingdoms this version of the game does not have: ${gone.slice(0, 3).join(', ')}${gone.length > 3 ? ` and ${gone.length - 3} more` : ''}`], incompatible: true };
    }
    const campaign = raw.version === 1 ? migrateV1(raw) : sanitize(raw);
    if (!campaign) return { campaign: null, problems: ['it could not be read'] };
    return { campaign, problems: [], from: raw.version };
  }

  /**
   * Read and load one storage key. A save migrated on the way in is also kept as it was.
   * @param {string} key @returns {Campaign | null}
   */
  function loadKey(key) {
    const text = CL.storage.get(key);
    if (text == null) return null;
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      CL.diag.log('warn', 'Cannot read save', { key, error: String(e) });
      return null;
    }
    const r = fromRaw(d);
    if (!r.campaign) {
      CL.diag.log('warn', 'Save rejected', { key, problems: r.problems });
      if (r.incompatible && key === KEY) {
        // Kept exactly as it was, so a later version (or the right mod) can still open it (SC-33).
        if (CL.storage.get(INCOMPATIBLE_KEY) == null) CL.storage.set(INCOMPATIBLE_KEY, text);
        CL.save.notice = `Your save could not be opened: ${r.problems[0]}. It has been kept safe and nothing will overwrite it.`;
      }
      if (r.otherWorld && key === KEY) {
        if (CL.storage.get(OTHER_WORLD_KEY) == null) CL.storage.set(OTHER_WORLD_KEY, text);
        CL.save.notice = 'The world has grown: new kingdoms lie beyond the March, and campaigns begun before cannot continue in it, so a new one begins. Your old save has been kept safe and nothing will overwrite it.';
      }
      return null;
    }
    if (r.from >= 2 && r.from < VERSION) {
      const keep = preMigrationKey(r.from);
      if (CL.storage.get(keep) == null) CL.storage.set(keep, text);
      CL.diag.log('info', 'Save migrated', { key, from: r.from, to: VERSION, keptAs: keep });
    }
    return r.campaign;
  }

  /** Load the best available save. Sets CL.save.existed so the title can offer Continue. */
  function load() {
    CL.save.existed = true;
    let c = loadKey(KEY);
    if (!c) {
      c = loadKey(BACKUP_KEY);
      if (c) {
        CL.diag.log('warn', 'Main save unreadable; restored backup');
        // Tell the player rather than quietly losing their last few minutes.
        CL.save.notice ??= 'Your latest save could not be read, so the one before it was loaded. You may have lost a few minutes.';
      }
    }
    if (!c) {
      const text = CL.storage.get(LEGACY_KEY);
      let d = null;
      try {
        d = text == null ? null : JSON.parse(text);
      } catch {
        d = null;
      }
      c = d?.version === 1 ? fromRaw(d).campaign : null;
      if (c) CL.diag.log('info', 'Migrated 0.3 save', { soldiers: c.roster.length });
    }
    if (!c) {
      CL.save.existed = false;
      c = starter();
    }
    CL.save.lastSavedDay = c.day;
    return c;
  }

  /**
   * Another tab of this game wrote the save (the `storage` event only fires in the other tabs). This
   * tab's copy is now out of date: it stops saving, so it can't overwrite newer progress, and says so.
   */
  function bindTabs() {
    root.addEventListener?.('storage', (e) => {
      if (e.key !== KEY || CL.save.stale) return;
      CL.save.stale = true;
      CL.diag.log('warn', 'Save changed in another tab; this tab stopped saving');
      CL.ui?.showStale?.();
    });
  }

  /** Is this stored text a complete save (good enough to keep as the backup)? @param {string} text */
  function isComplete(text) {
    try {
      return check(JSON.parse(text)).problems.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Save the current campaign. The previous save becomes the backup only if it is complete, and the
   * write only counts once the stored text reads back unchanged.
   * @returns {boolean} true when the campaign is safely stored
   */
  function write() {
    if (CL.save.stale) {
      CL.ui?.message?.('This game is open in another tab. Reload this page to carry on here.');
      return false;
    }
    const c = CL.campaign;
    c.contentVersion = CL.BUILD;
    const text = JSON.stringify(c);
    const previous = CL.storage.get(KEY);
    if (previous && isComplete(previous) && !CL.storage.set(BACKUP_KEY, previous)) {
      CL.diag.log('warn', 'Backup not updated; the older backup is kept');
    }
    if (!CL.storage.set(KEY, text) || CL.storage.get(KEY) !== text) {
      const error = CL.storage.lastError || 'the save did not read back';
      // GDD §13: browser storage can fail or be cleared — tell the player to export.
      if (!CL.save.lastError) CL.ui?.message?.('Could not save in this browser — use Save & export to keep your progress.');
      CL.save.lastError = error;
      CL.diag.log('error', 'Save failed', { error });
      return false;
    }
    CL.save.lastSavedAt = Date.now();
    CL.save.lastSavedDay = c.day;
    CL.save.lastError = null;
    CL.diag.log('info', 'Campaign saved', { day: c.day, soldiers: c.roster.length });
    return true;
  }

  /**
   * Periodic autosave while time passes on the map (design §24.7): once per game day since the last
   * save. Called by the world map's update; a battle, a settlement or the page closing save anyway.
   * @returns {boolean} true if it saved now
   */
  function autosave() {
    const c = CL.campaign;
    if (!c?.character) return false;
    if (CL.save.lastSavedDay == null) CL.save.lastSavedDay = c.day;
    if (c.day - CL.save.lastSavedDay < AUTOSAVE_DAYS) return false;
    return write();
  }

  CL.save = {
    VERSION,
    KEY,
    BACKUP_KEY,
    LEGACY_KEY,
    INCOMPATIBLE_KEY,
    OTHER_WORLD_KEY,
    WOUND_DAYS,
    AUTOSAVE_DAYS,
    MIGRATIONS,
    migrateHoldings,
    V19_SUNDERED,
    preMigrationKey,
    starter,
    addSoldier,
    check,
    migrate,
    sanitize,
    migrateV1,
    fromRaw,
    existed: false,
    lastSavedAt: null,
    lastSavedDay: null,
    lastError: null,
    stale: false,
    notice: null,
    load,
    write,
    autosave,
    bindTabs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
