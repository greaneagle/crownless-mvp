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

  /** One soldier in the player's company. IDs are never reused. */
  interface Soldier {
    id: number;
    troop: ContentId;
    xp: number;
    /** Campaign day the wound heals, or null when fit. */
    woundedUntil: number | null;
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
    version: number;
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
    rngSeed: number;
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
    killed: number[];
    wounded: number[];
    participants?: number[];
    soldierKills?: Record<number, number>;
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

  interface SaveAPI {
    VERSION: number;
    KEY: string;
    BACKUP_KEY: string;
    LEGACY_KEY: string;
    WOUND_DAYS: number;
    starter(background?: ContentId): Campaign;
    addSoldier(c: Campaign, troop: ContentId, woundedUntil?: number | null): Soldier;
    sanitize(d: any): Campaign | null;
    migrateV1(d: any): Campaign | null;
    existed: boolean;
    lastSavedAt: number | null;
    lastError: string | null;
    stale: boolean;
    notice: string | null;
    load(): Campaign;
    write(): boolean;
    bindTabs(): void;
  }

  interface PartyAPI {
    UPGRADE_XP: Record<string, number>;
    XP: Record<string, number>;
    BATTLE_DAYS: number;
    partyCap(camp?: Campaign): number;
    upgradeOptions(troopId: ContentId): UpgradeOption[];
    readyFor(s: Soldier): boolean;
    upgrade(fromId: ContentId, toId: ContentId, max?: number, camp?: Campaign): number;
    awardXp(camp: Campaign, outcome: BattleOutcome): XpAward;
    resultHtml(info: Record<string, any>): string;
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
    rollCasualties(allies: Unit[]): { killed: number[]; wounded: number[] };
    rollLoot(enc: any, kills: number): Record<ContentId, number>;
    applyBattleResult(camp: Campaign, outcome: BattleOutcome): BattleResult | null;
    describeItems(map: Record<ContentId, number>): string;
    endBattle(win: boolean): void;
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
