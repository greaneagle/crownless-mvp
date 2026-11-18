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
    kind: 'joined' | 'veteran' | 'wounded' | 'promoted' | 'captured' | 'notable';
    place?: string | null;
    foe?: string | null;
    to?: ContentId;
    kills?: number;
  }

  /** One soldier in the player's company: a named person (save schema v5). IDs are never reused. */
  interface Soldier {
    id: number;
    troop: ContentId;
    xp: number;
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
    camp?: boolean;
    anchor?: string;
    ambush?: boolean;
    escortTo?: ContentId;
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
    owners: Record<ContentId, ContentId>;
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
    followers: { quartermaster: Quartermaster | null };
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

  /** A hired quartermaster (V2-11, js/quartermaster.js). */
  interface Quartermaster {
    name: string;
    culture: string | null;
    origin: string | null;
    hired: number;
    reserveDays: number;
    budget: number;
    coverWages: boolean;
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
    killed: number[];
    wounded: number[];
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
  }

  interface SaveAPI {
    VERSION: number;
    KEY: string;
    BACKUP_KEY: string;
    LEGACY_KEY: string;
    WOUND_DAYS: number;
    AUTOSAVE_DAYS: number;
    MIGRATIONS: Record<number, (d: Record<string, any>) => Record<string, any>>;
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
    UPGRADE_XP: Record<string, number>;
    XP: Record<string, number>;
    partyCap(camp?: Campaign): number;
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
    fallenEnemies?: ContentId[];
    /** battle and auto: the enemy troops met (they become 'seen' on the troop tree). */
    enemyTroops?: ContentId[];
    /** battle and auto: parties that rode in to the fight (V2-09): who fell, whether they arrived. */
    reinforcements?: Array<{ id: number; side: string; arrived: boolean; fallen: string[] }>;
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
