/* Crownless shared types (V2-00). Used only by the type checker (`npm run typecheck`); the browser
 * never loads this file and nothing is built from it.
 *
 * The game's modules are classic scripts that attach to `window.Crownless` (CL). This file says what
 * CL holds and what the saved campaign looks like, so the modules marked `// @ts-check` are checked
 * against one shape. Modules not described here yet are typed `any` (the index signature below) and
 * get their own interface when a task converts them.
 *
 * A module's interface is also checked where the module assigns itself (`CL.save = { … }`), so an
 * interface that drifts from its module fails the check. */

export {};

declare global {
  // ---- Saved campaign (schema v2; docs/SAVE-FORMAT.md) ----

  /** A content ID (troop, item, settlement, faction, quest, …). Checked against data/ at load. */
  type ContentId = string;

  /** A soldier's service record (V2-03): counts kept by listening to events. */
  interface SoldierRecord {
    battles: number;
    victories: number;
    kills: number;
    assists: number;
    wounds: number;
    captures: number;
    /** Crowns actually received (SC-02), not wages owed. */
    wagesPaid: number;
  }

  /** One service note; shown as a sentence by CL.soldiers.noteText. */
  interface SoldierNote {
    day: number;
    kind: 'joined' | 'veteran' | 'wounded' | 'promoted' | 'captured' | 'notable' | 'feted' | 'trait';
    place?: string | null;
    foe?: string | null;
    to?: ContentId;
    kills?: number;
    trait?: string;
  }

  /** One soldier in the player's company: a named person (save schema v5). IDs are never reused. */
  interface Soldier {
    id: number;
    troop: ContentId;
    xp: number;
    /** P7-03: fitted with fine kit by the blacksmith (only present when true). */
    kit?: boolean;
    /** P7-07: earned at a milestone of their record (js/traits.js). */
    trait?: string;
    /** Campaign day the wound heals, or null when fit. */
    woundedUntil: number | null;
    name: string;
    /** The name culture (data/names.js). */
    culture: string;
    /** Settlement they joined at, or null (on the road, or before records were kept). */
    origin: string | null;
    /** Campaign day they joined, or null when it was never recorded. */
    joined: number | null;
    /** Art slot for a later portrait; null until there is one. */
    portrait: string | null;
    record: SoldierRecord;
    notes: SoldierNote[];
  }

  interface WorldState {
    x: number;
    y: number;
    /** Settlement ID while inside one, null on the open map. */
    location: ContentId | null;
    sites: Record<string, { clearedUntil: number }>;
    /** P7-04: the Hide stance, kept only while true (in a forest, standing still). */
    hidden?: boolean;
  }

  interface Character {
    name: string;
    gender: 'man' | 'woman' | 'unspecified';
    cloak: string;
    background: ContentId;
    attributes: Record<string, number>;
    skills: Record<string, number>;
    level: number;
    xp: number;
    skillPoints: number;
    attributePoints: number;
  }

  type EquipmentSlot = 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'feet' | 'horse' | 'ring';
  type Equipment = Record<EquipmentSlot, ContentId | null>;

  /** A patrol, caravan or Reaver band on the map. Optional fields depend on the kind. */
  interface WorldParty {
    id: number;
    template: ContentId;
    x: number;
    y: number;
    troops: Record<ContentId, number>;
    tx?: number;
    ty?: number;
    ignoreUntil?: number;
    alerted?: boolean;
    lair?: string;
    routeIndex?: number;
    good?: ContentId;
    contractId?: number;
    questTag?: string;
    /** P7-08: the world event (an infestation) this band belongs to. */
    eventId?: number;
    camp?: boolean;
    anchor?: string;
    ambush?: boolean;
    escortTo?: ContentId;
    /** P7-04: where it last saw the company, and until when it searches there (null: riding there). */
    lastSeen?: { x: number; y: number; until: number | null };
    /** P7-05: one of your own detachments (its id in c.detachments). */
    detachment?: number;
    /** P7-04: where the company last saw it. */
    seenAt?: { x: number; y: number; day: number };
    [extra: string]: unknown;
  }

  interface QuestRecord {
    status: 'active' | 'done' | 'failed';
    stage: string | null;
    notes: string[];
    startedDay: number;
    stageDay?: number;
    endedDay?: number;
    /** The stage whose deadline already ran out (its expire effects ran once). */
    expired?: string;
  }

  interface StoryState {
    flags: Record<string, boolean | string | number>;
    quests: Record<ContentId, QuestRecord>;
    visits: Record<string, number>;
  }

  interface CompanionState {
    id: ContentId;
    woundedUntil: number | null;
    equipment: Partial<Equipment>;
    away?: boolean;
    /** P7-05: the detachment she leads, while she leads one. */
    detached?: number;
  }

  interface NewsState {
    events: Array<Record<string, unknown>>;
    lines: Array<Record<string, unknown>>;
    next: number;
    clashUntil: number;
    turns?: Record<string, number>;
  }

  /** The persistent campaign: the thing that is saved (CL.campaign). */
  interface Campaign {
    /** Save schema version (3 from build 1.2.0). */
    version: number;
    /** P9-B4: the company's division choices (optional): names, a troop type's division, a soldier's. */
    divisions?: { names: Record<string, string>; troops: Record<string, string>; soldiers: Record<string, string> };
    /** The world (content package) this campaign belongs to, e.g. "border_march". */
    worldId: string;
    /** The build that last wrote this save ("unknown" right after migrating a v2 save). */
    contentVersion: string;
    gold: number;
    renown: number;
    battles: number;
    victories: number;
    /** Campaign days elapsed (fractional); 6 game hours = 0.25. */
    day: number;
    nextSoldierId: number;
    roster: Soldier[];
    inventory: Record<ContentId, number>;
    /** Battle IDs at or below this one are already applied (exactly once). */
    lastResolvedBattle: number;
    world: WorldState;
    character: Character | null;
    equipment: Equipment;
    food: number;
    morale: number;
    nextWagesDay: number;
    starving: boolean;
    markets: Record<ContentId, Record<ContentId, number>>;
    cargo: Record<ContentId, number>;
    /** The world random stream's state (world parties, contracts, auto-resolve, retreat). */
    rngSeed: number;
    /** v4: the other named random streams' states (CL.autoresolve.STREAMS). */
    rng: Record<'casualties' | 'loot' | 'upkeep' | 'names', number>;
    /** v4: the next encounter result ID to commit (js/encounter.js). */
    nextResultId: number;
    /** v4: the next domain event ID (js/events.js). */
    nextEventId: number;
    parties: WorldParty[];
    partySpawns: Record<ContentId, number>;
    nextPartyId: number;
    contract: Record<string, any> | null;
    contractOffers: Record<ContentId, Record<string, any>>;
    nextContractId: number;
    contractsDone: number;
    reputation: Record<ContentId, number>;
    /** v3–v18: fort → owning kingdom; replaced by `holdings` in v19 (P8-02). Only an unmigrated save has it. */
    owners?: Record<ContentId, ContentId>;
    /** v19 (P8-02): the people of the realms, by id ("person:<n>"). */
    people: Record<string, Person>;
    /** v19 (P8-02): realm → the person holding its ruler's office (an office, not a kind of person). */
    rulers: Record<ContentId, string>;
    /** v19 (P8-02): the next person id. */
    nextPersonId: number;
    /** v19 (P8-02): every settlement of a kingdom (not the free city), by settlement id. */
    holdings: Record<ContentId, Holding>;
    /** v20 (P8-01): lords held captive, by the player or off-screen by a realm. */
    /** v23 (P8-06a): forts besieged, and by whom. */
    sieges: any[];
    /** v24 (P8-07): the lords' opinions (sparse: `opinions[from][to] = { rel, log }`), debts, your requests and their promises, petitions, changes of realm and your summons. */
    nobles: {
      opinions: Record<string, Record<string, { rel: number; log: (string | number)[][] }>>;
      debts: { from: string; to: string; kind: 'loan' | 'freed' | 'help'; day: number; amount?: number; due?: number }[];
      petitions: any[];
      asks: Record<string, any>;
      pledges: any[];
      moved: Record<string, number>;
      warned: Record<string, number>;
      summons: { realm: ContentId; sid: ContentId; siegeId: number; day: number; answered: boolean } | null;
      nextPetition: number;
      petitionAfter: number;
      week: number;
      lastPetitionCheck?: number;
    };
    nextSiegeId?: number;
    siegePlanned?: number | null;
    /** v22 (P8-05): the crown's grants waiting to be made. */
    grants: { sid: ContentId; helper: string | null; day: number; declined: string[]; offeredTo: string | null; suggestedBy?: string }[];
    /** v22 (P8-05): realm → your influence with its ruler (for P8-07). */
    influence: Record<ContentId, number>;
    /** v21 (P8-04): independent, a realm's mercenary, or its vassal. */
    allegiance: { kind: 'independent' | 'mercenary' | 'vassal'; realm: ContentId | null; since: number; until: number | null; serviceDays: number; summonsMissed: number; history: any[]; window: { start: number; days: number } | null; lastOath: number | null; nextPay: number | null; served: number | null; hunt: { realm: ContentId; until: number } | null };
    prisoners: { lord: string; by: string; since: number; led: number; offerDay: number | null; offered: boolean; checked: number; release: number | null }[];
    /** v10 (W-07): each pair of kingdoms ("a|b", ids in order): peace, tension or war, and its counters. */
    relations: Record<string, { state: 'peace' | 'tension' | 'war'; since: number; heat: number; losses: number; lastClash: number | null; incidentUntil: number }>;
    story: StoryState;
    companion: CompanionState | null;
    news: NewsState;
    /** v6: what the company knows of each troop: 'seen' (name only) or 'owned' (full details). */
    troopKnowledge: Record<ContentId, 'seen' | 'owned'>;
    /** v7: the company chronicle, oldest first (js/chronicle.js). */
    chronicle: ChronicleEntry[];
    /** v7: the roll of honour: soldiers who fell or left the company. */
    honour: HonourRoll;
    /** v8: the company chest and follower budgets; `gold` is the player's purse (js/accounts.js). */
    accounts: Accounts;
    /** v8: the newest money transfers. */
    ledger: LedgerEntry[];
    /** v8: camp followers. */
    followers: { quartermaster: Quartermaster | null; merchant?: Merchant | null; surgeon?: any; blacksmith?: any; scout?: any };
    /** v14 (P7-05): detachments sent off under a captain (js/detachments.js), and the last few back. */
    detachments: any[];
    /** v15 (P7-06): companions of the wider world (js/retinue.js). */
    retinue: { id: ContentId; woundedUntil: number | null; equipment: Record<string, string | null>; loyalty: number; unpaid: number; warned: boolean; why: string | null; warnedDay?: number; detached?: number }[];
    /** v11 (P7-01): medicine in the company's stores (0–99). */
    medicine: number;
    /** v16 (P7-08): world events: those open, the last few ended, cooldowns per kind and region. */
    /** v17 (P7-09): tournaments: each host's schedule and wins, those open, your bracket, your rival. */
    tourney: { hosts: Record<string, { next: number; wins: number; entered: number | null }>; open: any[]; bracket: any; rival: { name: string; culture: string; skill: number; from: string; beatYou: number; beaten: number } | null };
    /** v18 (P7-10): your mill, and those sold or seized. */
    businesses: Businesses;
    happenings: { open: Happening[]; past: { id: number; kind: ContentId; place: string; day: number; result: string; dest?: string }[]; cool: Record<string, number>; next: number; nextId: number };
  }

  /** A person of the realms (P8-02): a ruler or a lord. Rank is never stored: it is what they hold. */
  interface Person {
    id: string;
    /** Their id in the world data's `nobles`, when they come from it. */
    key: string | null;
    name: string;
    gender: 'male' | 'female';
    realm: ContentId;
    home: ContentId | null;
    kin: { person: string; tie: 'parent' | 'child' | 'sibling' | 'cousin' | 'spouse' }[];
    traits: string;
    status: 'free' | 'captive' | 'wounded';
    heldBy: string | null;
  }

  /** A holding (P8-02, design §17.1): who claims it, who is granted it, who has its gates. */
  interface Holding {
    kind: 'village' | 'fort' | 'town';
    sovereign: ContentId;
    /** A person id, or 'player'; never null (D-P8f): the ruler when no lord holds it. */
    holder: string;
    controller: ContentId;
    /** Villages: the fort or town they follow. */
    seat: ContentId | null;
    administrator: string | null;
    /** v22 (P8-05): how it stands and runs. */
    prosperity?: number;
    unrest?: number;
    garrison?: Record<ContentId, number> | null;
    militia?: number | null;
    policies?: { garrison: 'light' | 'normal' | 'strong'; tax: 'light' | 'normal' | 'heavy'; food: number; repairs: boolean };
    walls?: number | null;
    treasury?: number;
    unpaid?: number;
    deserting?: boolean;
    desertDay?: number;
    dueWeek?: number | null;
    report?: any;
    reports?: any[];
    book?: any[];
    castellan?: { kind: 'soldier'; id: number; name: string; soldier: any } | null;
    castellanLeaving?: boolean;
    crownLand?: boolean;
    /** v23 (P8-06a): days of food in the stores (forts), when it was last counted, weak and restless until. */
    food?: number | null;
    fedTo?: number;
    weakUntil?: number;
    claims: { by: string; realm: ContentId | null; since: number; kind: 'granted' | 'conquest' | 'old' }[];
  }

  interface Accounts {
    chest: number;
    budgets: Record<string, number>;
  }

  interface LedgerEntry {
    day: number;
    /** 'purse', 'chest', 'budget:<name>' or 'world'. */
    from: string;
    to: string;
    amount: number;
    why: string;
  }

  /** A hired merchant (V2-12, js/merchant.js). Their cash is accounts.budgets.merchant. */
  interface Merchant {
    name: string;
    culture: string | null;
    origin: string | null;
    hired: number;
    preset: string;
    active: boolean;
    /** Their own goods (not your cargo). */
    stock: Record<string, number>;
    /** What each good in stock cost them, in all. */
    paid: Record<string, number>;
    /** The day they first bought each good now in stock (V2-T1: old stock sells at cost, then at a small loss). */
    since: Record<string, number>;
    /** Prices seen: settlement → good → { buy, sell, day }. */
    prices: Record<string, Record<string, { buy: number; sell: number; day: number }>>;
    unpaid: number;
    log: Array<{ day: number; text: string }>;
  }

  /** A hired quartermaster (V2-11, js/quartermaster.js). */
  interface Quartermaster {
    name: string;
    culture: string | null;
    origin: string | null;
    hired: number;
    reserveDays: number;
    /** Fixed weekly limit, or null for automatic (V2-T1). */
    budget: number | null;
    coverWages: boolean;
    /** P7-01: keep this much medicine while a surgeon rides with the company (0–20). */
    medicine: number;
    weekStart: number;
    spent: number;
    unpaid: number;
    warnedDay: number;
    log: Array<{ day: number; text: string }>;
  }

  /** One line of the company chronicle (V2-10). Fields beyond day and kind depend on the kind. */
  interface ChronicleEntry {
    day: number;
    kind: string;
    /** allegiance (P8-04): what you were when it ended. */
    as?: 'mercenary' | 'vassal';
    place?: string | null;
    names?: string[];
    n?: number;
    to?: ContentId;
    id?: number;
    name?: string;
    foe?: string | null;
    win?: boolean;
    kills?: number;
    fallen?: string[];
    lost?: number;
    auto?: boolean;
    quest?: string;
    status?: string;
    /** P7-08 'happening': the world event's kind, its result and the courier's destination. */
    event?: ContentId;
    result?: string;
    /** P7-09 'tourney': the round you went out in (0–2). */
    round?: number;
    dest?: string;
    /** P7-10 'business' (event bought / sold / seized): who seized it. */
    by?: string;
  }

  /** P7-10: a week at the mill (js/business.js). */
  interface MillWeek {
    day: number;
    ground: number;
    made: number;
    sales: number;
    grain: number;
    wage: number;
    repairs: number;
    due: number;
    profit: number;
    cause: string | null;
    /** Why it stopped short of the week in a good week. */
    stop: string | null;
  }

  /** P7-10: your mill. Its money is the account `budget:mill`; `book` is its own ledger. */
  interface Mill {
    kind: 'mill';
    place: string;
    bought: number;
    paid: number;
    owner: string;
    manager: string;
    rules: { maxInput: number | null; minOutput: number | null };
    seizeOn: number | null;
    weeks: number;
    profit: number;
    log: { day: number; text: string; bad?: boolean }[];
    book: LedgerEntry[];
  }

  interface Businesses {
    owned: Mill[];
    past: { kind: string; place: string; day: number; end: string; by?: string }[];
  }

  /** P7-08: an open world event (js/happenings.js). */
  interface Happening {
    id: number;
    kind: ContentId;
    place: string;
    start: number;
    until: number;
    seen: boolean;
    taken: boolean;
    gold?: number;
    dest?: string;
    partyId?: number;
  }

  /** A soldier remembered on the roll of honour (V2-10). */
  interface HonourEntry {
    id: number;
    name: string;
    troop: ContentId;
    culture: string | null;
    origin: string | null;
    joined: number | null;
    left: number;
    how: string;
    foe: string | null;
    battles: number;
    victories: number;
    kills: number;
    wounds: number;
    wagesPaid: number;
    /** P7-07: their trait, if they had earned one. */
    trait?: string;
  }

  interface HonourRoll {
    list: HonourEntry[];
    /** Older entries, only counted: fell, deserted, retired. */
    earlier: Record<string, number>;
  }

  /** A troop on the troop tree as the player knows it (js/troops.js). */
  interface TreeNode {
    id: ContentId;
    level: 'owned' | 'seen' | 'unknown';
    name?: string;
    tier?: string;
    role?: string;
    stats?: { hp: number; damage: number; armor: number; wage: number };
    maxTier?: boolean;
    paths?: Array<{ to: ContentId; cost: number; xp: number }>;
    count?: number;
    ready?: number;
    children: TreeNode[];
  }

  // ---- Battles ----

  /** A unit on the battlefield (hero, ally or enemy). Built by CL.units.makeUnit. */
  interface Unit {
    id: number;
    /** Battle position in canvas pixels (screen space until V2-05). */
    x: number;
    y: number;
    team: 'ally' | 'enemy';
    troop: ContentId;
    role: 'hero' | 'infantry' | 'archer' | 'cavalry';
    /** The roster soldier this unit is, or null (the hero, enemies, Mara). */
    soldierId: number | null;
    alive: boolean;
    hp: number;
    maxhp: number;
    speed: number;
    damage: number;
    armor: number;
    reach: number;
    ranged: Record<string, number> | null;
    face: 'up' | 'down' | 'left' | 'right';
    kills?: number;
    companion?: ContentId;
    /** Combat state (swing, cooldowns, AI timers, cavalry charge, …) kept by combat.js. */
    [extra: string]: any;
  }

  /** What a finished battle hands to CL.party.applyBattleResult. */
  interface BattleOutcome {
    battleId: number;
    encounterId?: ContentId;
    encounter?: any;
    win: boolean;
    kills: number;
    /** Enemies who fled the field (V2-08b): beaten, half the spoils of a kill, no kill credit. */
    routed?: number;
    /** V2-Q: fought in person (not auto-resolved), the setup used, and whether help rode in. */
    fought?: boolean;
    preset?: string | null;
    reinforced?: boolean;
    killed: number[];
    wounded: number[];
    /** P7-01: soldiers the surgeon saved (also in `wounded`), and the medicine that took. */
    saved?: number[];
    medicineUsed?: number;
    participants?: number[];
    soldierKills?: Record<number, number>;
    /** Enemies each soldier helped down without the final blow (V2-03). */
    soldierAssists?: Record<number, number>;
  }

  interface XpAward {
    heroXp: number;
    levels: number;
    troopXp: number;
    ready: number;
  }

  /** What applyBattleResult returns (null when the battle was already applied). */
  interface BattleResult {
    gold: number;
    renown: number;
    loot: Record<ContentId, number>;
    lostItem: ContentId | null;
    /** P7-01: medicine your captors took. */
    medicineTaken?: number;
    xp: XpAward;
  }

  interface UpgradeOption {
    to: ContentId;
    cost: number;
    xp: number;
    locked: string | null;
  }

  // ---- Module interfaces ----

  interface DiagEvent {
    date: string;
    level: 'info' | 'warn' | 'error';
    msg: string;
    data?: unknown;
  }

  interface DiagAPI {
    events: DiagEvent[];
    errors: unknown[];
    assets: { requested: number; loaded: number; failed: string[] };
    fps: number;
    frames: number;
    simMs: number;
    drawMs: number;
    lastFps: number;
    started: string;
    log(level: DiagEvent['level'], msg: string, data?: unknown): void;
  }

  interface UtilAPI {
    rand(a: number, b: number): number;
    clamp(n: number, a: number, b: number): number;
    dist(a: { x: number; y: number }, b: { x: number; y: number }): number;
    normalize(x: number, y: number): [number, number];
  }

  /** Result of CL.save.check: why a parsed save can't be loaded (empty when it can). */
  interface SaveCheck {
    problems: string[];
    /** Made by a newer build with a later save schema. */
    newer?: boolean;
    /** Belongs to another world (content package). */
    otherWorld?: boolean;
    /** Needs content this build does not have, e.g. a removed troop (V2-13, SC-33). */
    incompatible?: boolean;
  }

  interface SaveAPI {
    VERSION: number;
    KEY: string;
    BACKUP_KEY: string;
    LEGACY_KEY: string;
    /** Where an incompatible save is kept untouched (SC-33). */
    INCOMPATIBLE_KEY: string;
    /** Where a save of a world this build no longer has is kept untouched (W-05b). */
    OTHER_WORLD_KEY: string;
    WOUND_DAYS: number;
    AUTOSAVE_DAYS: number;
    MIGRATIONS: Record<number, (d: Record<string, any>) => Record<string, any>>;
    /** 18 → 19 (P8-02): owners become holdings, with the people of the realms. */
    migrateHoldings(d: Record<string, any>): Record<string, any>;
    /** The Sundered Realm's people and holdings as 2.24.0 began them (the 18 → 19 migration's constants). */
    V19_SUNDERED: { people: string[][]; rulers: Record<string, string>; holdings: (string | null)[][] };
    preMigrationKey(version: number): string;
    starter(background?: ContentId): Campaign;
    addSoldier(c: Campaign, troop: ContentId, woundedUntil?: number | null, opts?: { origin?: string | null; veteran?: boolean }): Soldier;
    check(d: unknown): SaveCheck;
    migrate(d: Record<string, any>): Record<string, any> | null;
    sanitize(d: any): Campaign | null;
    migrateV1(d: any): Campaign | null;
    fromRaw(d: unknown): SaveCheck & { campaign: Campaign | null; from?: number };
    existed: boolean;
    lastSavedAt: number | null;
    /** Campaign day of the last successful save (drives the travel autosave). */
    lastSavedDay: number | null;
    lastError: string | null;
    stale: boolean;
    notice: string | null;
    load(): Campaign;
    write(): boolean;
    autosave(): boolean;
    bindTabs(): void;
  }

  /** Where saves are kept: localStorage today, another store in a packaged build. Synchronous. */
  interface StorageBackend {
    name: string;
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  }

  interface StorageAPI {
    /** null if missing or unreadable. */
    get(key: string): string | null;
    /** false if the value could not be stored. */
    set(key: string, value: string): boolean;
    remove(key: string): boolean;
    use(backend?: StorageBackend): void;
    backendName(): string;
    lastError: string | null;
  }

  interface PartyAPI {
    /** Everyone taking a slot in the party cap, detachments included (P7-05). */
    headcount(camp?: Campaign): number;
    UPGRADE_XP: Record<string, number>;
    XP: Record<string, number>;
    partyCap(camp?: Campaign): number;
    /** P9-B3: how many of a troop can be hired here at once, up to `n`. */
    canHireMany(camp: Campaign, troopId: ContentId, n: number): number;
    /** P9-B3: hire several of a troop at once; how many were hired. */
    recruitMany(troopId: ContentId, n: number): number;
    /** P9-B3: the company limit's rules. */
    LIMIT: { base: number; leadership: number; renownPer: number; officer: number; seat: number; village: number; ceiling: number };
    /** P9-B3: the limit's parts, their sum and the total (at most the ceiling). */
    limitParts(camp?: Campaign): { parts: Record<string, number>; sum: number; total: number };
    upgradeOptions(troopId: ContentId): UpgradeOption[];
    readyFor(s: Soldier): boolean;
    upgrade(fromId: ContentId, toId: ContentId, max?: number, camp?: Campaign): number;
    soldierUpgrades(s: Soldier, camp?: Campaign): Array<UpgradeOption & { can: boolean; why: string | null }>;
    upgradeSoldier(camp: Campaign, soldierId: number, toId: ContentId): boolean;
    /** Retire a soldier with honour (V2-10): off the roster, onto the roll of honour. */
    retireSoldier(camp: Campaign, soldierId: number): Soldier | null;
    upgradeAllPlan(camp?: Campaign): { items: Array<{ soldierId: number; from: ContentId; to: ContentId; cost: number }>; total: number; wounded: number; unaffordable: number };
    upgradeAll(camp?: Campaign): { done: number; cost: number };
    awardXp(camp: Campaign, outcome: BattleOutcome): XpAward;
    resultHtml(info: Record<string, any>): string;
    rosterNames(camp: Campaign): Record<number, string>;
    currentSettlement(camp?: Campaign): any;
    recruitsHere(camp?: Campaign): ContentId[];
    /** The troops the owner offers, whether or not they hire to you (P8-03: the UI shows why not). */
    troopsOffered(camp?: Campaign): ContentId[];
    canRest(camp?: Campaign): boolean;
    canRecruit(camp: Campaign, troopId: ContentId): boolean;
    recruit(troopId: ContentId): boolean;
    healthySoldiers(): Soldier[];
    woundedSoldiers(): Soldier[];
    troopOf(s: Soldier): any;
    dayNumber(day?: number): number;
    advanceDays(days: number, camp?: Campaign): number[];
    rest(): number[];
    rollCasualties(allies: Unit[], camp?: Campaign): { killed: number[]; wounded: number[] };
    rollLoot(enc: any, kills: number, camp?: Campaign): Record<ContentId, number>;
    applyBattleResult(camp: Campaign, outcome: BattleOutcome): BattleResult | null;
    describeItems(map: Record<ContentId, number>): string;
    endBattle(win: boolean): void;
  }

  /** A domain event (js/events.js): unique ID within the campaign, type, day, and its own data. */
  interface GameEvent {
    id: number;
    type: string;
    day: number;
    [data: string]: unknown;
  }

  interface EventsAPI {
    TYPES: string[];
    on(type: string, fn: (e: GameEvent) => void): () => void;
    emit(c: Campaign, type: string, data?: Record<string, unknown>): GameEvent;
    /** The last few events, in memory only (diagnostics). */
    recent: GameEvent[];
  }

  /** What CL.encounter.resolve commits. */
  interface EncounterCommit {
    kind: 'battle' | 'auto' | 'retreat' | 'parley';
    /** Defaults to the current encounter's ID. */
    resultId?: number;
    /** battle and auto: the outcome for party.applyBattleResult. */
    outcome?: BattleOutcome;
    companionDown?: boolean;
    /** P7-06: the retinue companions who went down. */
    companionsDown?: string[];
    fallenEnemies?: ContentId[];
    /** battle and auto: the enemy troops met (they become 'seen' on the troop tree). */
    enemyTroops?: ContentId[];
    /** battle and auto: parties that rode in to the fight (V2-09): who fell, whether they arrived. */
    reinforcements?: Array<{ id: number; side: string; arrived: boolean; fallen: string[] }>;
    /** battle and auto (P7-11): an escort ambush's wagon burned, or the fight was lost. */
    wagonLost?: boolean;
    siteId?: string | null;
    partyId?: number | null;
    /** retreat and parley: the change to make, run once inside the commit. */
    commit?: () => void;
    /** parley: 'toll' or 'intimidate'. */
    detail?: string;
  }

  interface EncounterAPI {
    KINDS: string[];
    begin(c?: Campaign): number;
    beginIfClosed(c?: Campaign): number;
    currentId(c?: Campaign): number;
    isOpen(c?: Campaign): boolean;
    resolve(c: Campaign, x: EncounterCommit): BattleResult | true | null;
  }

  /** The campaign clock (js/clock.js): the one authority for campaign time. */
  interface ClockAPI {
    KINDS: string[];
    DEFAULTS: Record<string, number>;
    hours(kind: string): number;
    advance(c: Campaign, hours: number, reason: string): number[];
    pass(c: Campaign, kind: string): number[];
  }

  /** window.Crownless. Modules without an interface yet are `any`. */
  interface CrownlessNS {
    BUILD: string;
    dev: boolean;
    SAVEKEY: string;
    W: number;
    H: number;
    util: UtilAPI;
    diag: DiagAPI;
    /** The persistent campaign; null only before boot. */
    campaign: Campaign;
    /** The live, transient state (battle, journey, town walk). */
    game: Record<string, any>;
    storage: StorageAPI;
    clock: ClockAPI;
    events: EventsAPI;
    encounter: EncounterAPI;
    save: SaveAPI;
    party: PartyAPI;
    [module: string]: any;
  }

  interface Window {
    Crownless: CrownlessNS;
    CROWNLESS_CONTENT: Record<string, any>;
  }
  var Crownless: CrownlessNS;
  var CROWNLESS_CONTENT: Record<string, any>;
}
