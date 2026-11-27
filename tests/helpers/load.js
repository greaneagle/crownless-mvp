// Loads the classic-script game modules and content data into a fresh sandbox
// so tests run under plain Node with no DOM and no dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

// Logic modules only (no render/input/main — those need a real DOM).
const LOGIC_MODULES = ['core', 'content', 'worlds', 'state', 'storage', 'packs', 'events', 'clock', 'soldiers', 'traits', 'chronicle', 'accounts', 'quartermaster', 'surgeon', 'blacksmith', 'scout', 'detachments', 'retinue', 'merchant', 'troops', 'save', 'camera', 'arena', 'tactics', 'prep', 'groups', 'formations', 'divisions', 'objective', 'morale', 'reinforce', 'profile', 'units', 'styles', 'combat', 'party', 'upkeep', 'trade', 'autoresolve', 'spatial', 'sight', 'parties', 'contracts', 'realm', 'crowns', 'diplomacy', 'founding', 'rebellion', 'armies', 'houses', 'rights', 'lords', 'allegiance', 'fiefs', 'sieges', 'assault', 'nobles', 'claims', 'story', 'companion', 'news', 'happenings', 'tourney', 'business', 'portable', 'world', 'mapview', 'gestures', 'encounter', 'town', 'character', 'gear', 'art/kit', 'art/story', 'art/figures', 'art/battle', 'art/town', 'art/worldmap', 'art/ui', 'debug', 'settings', 'audio', 'tips', 'fullscreen'];
const CONTENT_MODULES = [
  'factions',
  'settlements',
  'troops',
  'items',
  'weapons',
  'gear_text',
  'markets',
  'quests',
  'dialogue',
  'battle_maps',
  'encounters',
  'world_map',
  'character',
  'origins',
  'world_parties',
  'contracts',
  'town_hubs',
  'companions',
  'news',
  'world_events',
  'tournaments',
  'businesses',
  'help',
  'names',
  'styles', // P11-10
];
// P9-08: the other official worlds (data/worlds/*.js), loaded beside the built-in one.
const WORLD_MODULES = fs
  .readdirSync(path.join(ROOT, 'data', 'worlds'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.slice(0, -3))
  .sort();

/** Mulberry32: a small seeded stand-in for Math.random. */
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

/**
 * Fresh sandbox with the game logic loaded and the UI stubbed.
 * With `party` (default) a brand-new campaign gets a test fixture: a Farmhand hero, 130 crowns,
 * 3 Levies and 2 Hunters (soldier ids 1–5). Pass { party: false } to see the real GDD new game.
 */
/**
 * `packs` (P9-07): content packs (parsed JSON) applied before the save loads, as at boot.
 * `content` (W-04): change the content before the game loads: a function given CROWNLESS_CONTENT (to
 * edit it in place, or return a replacement), or an object of tables that replace those of the same
 * name. The test world (tests/helpers/test-world.js) is one.
 * `world` (P9-08): play another official world (data/worlds/*.js), as choosing it at a new game does.
 */
function loadGame({ storage = memoryStorage(), random, party = true, worldParties = false, worldEvents = false, seed = 12345, content, packs = [], world, mapSpeed = 'fast' } = {}) {
  const uiCalls = [];
  // No `Math` here: the game gets the context's own, so nothing one game does to Math (or that a
  // script does to the host's Math.random) reaches another game in the same process (H-01: the host
  // Math used to be shared, and a run's results depended on what ran before it). Its Math.random is
  // the test's `random`, or else seeded from `seed`, so every test game is reproducible.
  const sandbox = {
    console,
    performance,
    localStorage: storage,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext('Math', sandbox).random = random || mulberry((seed ^ 0x5bd1e995) >>> 0);
  runModules(sandbox, 'data', CONTENT_MODULES);
  runModules(sandbox, path.join('data', 'worlds'), WORLD_MODULES);
  if (world) storage.setItem('crownless_world', world);
  if (typeof content === 'function') sandbox.CROWNLESS_CONTENT = content(sandbox.CROWNLESS_CONTENT) || sandbox.CROWNLESS_CONTENT;
  else if (content) Object.assign(sandbox.CROWNLESS_CONTENT, content);
  for (const m of LOGIC_MODULES) {
    const file = path.join(ROOT, 'js', `${m}.js`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }
  const CL = sandbox.Crownless;
  // A test's `random` also rolls the dice for the named campaign streams (casualties, loot, upkeep),
  // which used Math.random before V2-02, so "0.99 = nobody dies, no loot, no desertion" still holds.
  // The world stream (rngSeed) is never stubbed: it is seeded by `seed` below.
  // Soldiers' names keep their own seeded stream, so scripted rolls go only to the outcomes.
  if (random) {
    const seeded = CL.autoresolve.roll;
    CL.autoresolve.roll = (c, stream) => (stream === 'names' || stream === 'recruits' ? seeded(c, stream) : random()); // P10-09: who answers a hire keeps its seeded stream too
  }
  const record =
    (name) =>
    (...args) =>
      uiCalls.push([name, ...args]);
  CL.ui = {
    message: record('message'),
    changeMode: (mode) => {
      CL.game.mode = mode;
      uiCalls.push(['changeMode', mode]);
    },
    refreshRoster: record('refreshRoster'),
    refresh: record('refresh'),
    hideBattleOverlays: record('hideBattleOverlays'),
    showSelectedGroup: record('showSelectedGroup'),
    showEnding: record('showEnding'),
  };
  // P9-07: content packs, applied as the browser's boot does: after the modules, before the save.
  if (packs.length) {
    const problems = CL.packs.use(packs);
    if (problems.length) throw new Error(`packs: ${problems.join('; ')}`);
  }
  // P10-01: the map runs Fast in tests, as it did before 4.1.0's Normal default, so the bots and the
  // tests that ride in fixed steps keep their results. Pinned without touching the stored settings
  // (tests check those); the first set('mapSpeed') releases it. `mapSpeed: null` keeps the default.
  if (mapSpeed) {
    let pinned = mapSpeed;
    const { get, set } = CL.settings;
    CL.settings.get = (k) => (k === 'mapSpeed' && pinned ? pinned : get(k));
    CL.settings.set = (k, v) => {
      const ok = set(k, v);
      if (ok && k === 'mapSpeed') pinned = null;
      return ok;
    };
  }
  CL.campaign = CL.save.load();
  // Deterministic world: fixed seed, and (unless asked for) no moving parties to interfere.
  CL.campaign.rngSeed = seed;
  CL.campaign.rng = CL.autoresolve.streamSeeds(seed); // the named streams follow the fixed seed too
  // P9-T: a game loaded from a save keeps its parties, as the browser's does (a reload in a test lost
  // every army's lords, and the invariants caught it). A new game gets the test's own world.
  if (!CL.save.existed) {
    CL.campaign.parties = [];
    CL.campaign.partySpawns = {};
    CL.campaign.nextPartyId = 1;
    if (worldParties) CL.parties.ensure(CL.campaign, true);
    else for (const id of Object.keys(CL.content.table('party_templates'))) CL.campaign.partySpawns[id] = 1e9;
  }
  // World events (P7-08) and tournaments (P7-09) are off too unless asked for, like the world parties: tests that pass days
  // see only what they set up.
  if (!worldEvents) {
    CL.campaign.happenings.next = 1e9;
    for (const h of Object.values(CL.campaign.tourney.hosts)) h.next = 1e9; // and no tournaments (P7-09)
  }
  if (party && !CL.save.existed) {
    const c = CL.campaign;
    c.gold = 130;
    c.character = CL.character.create({ name: 'Tester', origin: 'farmhand' });
    // The fixture's soldiers: 3 Levies and 2 Hunters, or in another world its first realm's recruits.
    const T = CL.content.table('troops');
    const first = CL.world.map().factions.map((f) => CL.content.get('factions', f)).find((f) => f.recruits?.length)?.recruits[0];
    for (const t of T.levy && T.hunter ? ['levy', 'levy', 'levy', 'hunter', 'hunter'] : [first, first, first, first, first]) CL.save.addSoldier(c, t);
  }
  return { CL, storage, uiCalls, sandbox };
}

function runModules(sandbox, dir, names) {
  for (const m of names) {
    const file = path.join(ROOT, dir, `${m}.js`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }
}

/** Load data/*.js content modules into a sandbox and return CROWNLESS_CONTENT. */
function loadContent() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  runModules(sandbox, 'data', CONTENT_MODULES);
  return sandbox.CROWNLESS_CONTENT;
}

/** P9-08: the other official worlds' packages (data/worlds/*.js), by id. */
function loadWorlds() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  runModules(sandbox, path.join('data', 'worlds'), WORLD_MODULES);
  return JSON.parse(JSON.stringify(sandbox.CROWNLESS_WORLDS || {}));
}

module.exports = { loadGame, loadContent, loadWorlds, memoryStorage, mulberry, CONTENT_MODULES, WORLD_MODULES };
