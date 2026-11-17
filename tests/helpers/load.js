// Loads the classic-script game modules and content data into a fresh sandbox
// so tests run under plain Node with no DOM and no dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

// Logic modules only (no render/input/main — those need a real DOM).
const LOGIC_MODULES = ['core', 'content', 'state', 'storage', 'events', 'clock', 'soldiers', 'troops', 'save', 'assets', 'camera', 'arena', 'tactics', 'prep', 'units', 'combat', 'party', 'upkeep', 'trade', 'autoresolve', 'parties', 'contracts', 'realm', 'story', 'companion', 'news', 'portable', 'world', 'encounter', 'town', 'character', 'debug', 'settings', 'audio', 'tips', 'fullscreen'];
const CONTENT_MODULES = [
  'factions',
  'settlements',
  'troops',
  'items',
  'markets',
  'quests',
  'dialogue',
  'battle_maps',
  'encounters',
  'world_map',
  'character',
  'world_parties',
  'contracts',
  'town_hubs',
  'companions',
  'news',
  'help',
  'names',
];

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
function loadGame({ storage = memoryStorage(), random, party = true, worldParties = false, seed = 12345 } = {}) {
  const uiCalls = [];
  const sandbox = {
    console,
    performance,
    localStorage: storage,
    Math: random ? Object.assign(Object.create(Math), { random }) : Math,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  runModules(sandbox, 'data', CONTENT_MODULES);
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
    CL.autoresolve.roll = (c, stream) => (stream === 'names' ? seeded(c, stream) : random());
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
  CL.campaign = CL.save.load();
  // Deterministic world: fixed seed, and (unless asked for) no moving parties to interfere.
  CL.campaign.rngSeed = seed;
  CL.campaign.rng = CL.autoresolve.streamSeeds(seed); // the named streams follow the fixed seed too
  CL.campaign.parties = [];
  CL.campaign.partySpawns = {};
  CL.campaign.nextPartyId = 1;
  if (worldParties) CL.parties.ensure(CL.campaign, true);
  else for (const id of Object.keys(CL.content.table('party_templates'))) CL.campaign.partySpawns[id] = 1e9;
  if (party && !CL.save.existed) {
    const c = CL.campaign;
    c.gold = 130;
    c.character = CL.character.create({ name: 'Tester', background: 'farmhand' });
    for (const t of ['levy', 'levy', 'levy', 'hunter', 'hunter']) CL.save.addSoldier(c, t);
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

module.exports = { loadGame, loadContent, memoryStorage, CONTENT_MODULES };
