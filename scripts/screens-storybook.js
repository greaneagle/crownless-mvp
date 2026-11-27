// P11-12 (D-P11m): the storybook overhaul's before-and-after screenshots of the real game, in headless
// Chromium (Playwright, the browser tests' own), for review beside the references. Not a test: it writes
// PNGs to docs/graphics-demo/p11-12/<label>/ (git-ignored, as the graphics demo's), at 960×540 and as a
// landscape phone (812×375, device scale 3).
//   node scripts/screens-storybook.js <label> [--scenes stonebridge-day,battle-40,…] [--profiles desktop,phone]
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CROWNLESS_SHOTS_PORT || 8141);
const PROFILES = {
  desktop: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 },
  hires: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 }, // for close review
  phone: { viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const SETTINGS = { music: 0, sfx: 0, tips: false, fullscreen: false, battleSizeChosen: true, prepSkip: true, sharpness: 'sharp' };

/** Each scene: get there from a fresh game in Stonebridge's menu, then wait a moment. */
const SCENES = {
  'stonebridge-day': (CL) => town(CL, 'stonebridge', 13),
  'stonebridge-dusk': (CL) => town(CL, 'stonebridge', 19),
  'stonebridge-night': (CL) => town(CL, 'stonebridge', 23),
  'stonebridge-talk': (CL) => {
    town(CL, 'stonebridge', 13);
    const n = CL.game.town.npcs.find((x) => x.id === 'innkeeper');
    Object.assign(CL.game.town.hero, { x: n.x + 30, y: n.y + 10, face: 'left' });
  },
  'stonebridge-dialogue': (CL) => {
    town(CL, 'stonebridge', 13);
    CL.town.open(CL.game.town.npcs.find((x) => x.id === 'innkeeper'));
  },
  'eastwatch-day': (CL) => town(CL, 'eastwatch', 13),
  'hrothgard-day': (CL) => town(CL, 'hrothgard', 13),
  'battle-40': (CL) => battle(CL, 40),
  'battle-200': (CL) => battle(CL, 200),
  'battle-mounted': (CL) => {
    Object.assign(CL.campaign.equipment, { horse: 'rouncey' });
    CL.campaign.character.skills.riding = 3;
    battle(CL, 40);
  },
  'battle-archer': (CL) => {
    Object.assign(CL.campaign.equipment, { weapon: 'short_bow', offhand: null });
    battle(CL, 40);
  },
  'siege-60': (CL) => {
    CL.combat.setActiveCap(60);
    CL.combat.startBattle(CL.assault.practice(60, 'attack'));
    CL.game.godMode = true;
  },
  map: (CL) => CL.ui.changeMode('map'),
  party: () => document.querySelector('#partyBtn')?.click(),
  gallery: () => gallery([]),
  'gallery-east': () => gallery(['ArrowRight']),
  'gallery-back': () => gallery(['ArrowRight', 'ArrowRight']),
  'gallery-west': () => gallery(['ArrowLeft']),
  'gallery-attack': () => gallery(['ArrowRight', 'Space', 'Space']),
  'gallery-mounted': () => gallery(['Tab', 'ArrowRight', 'Space', 'Space']),
};

// P11-12c: every walkable town by day and night, and every battlefield with a fight on it.
for (const id of ['vessara', 'merrow', 'gullhaven', 'harrowgate', 'calder']) SCENES[`${id}-day`] = new Function('CL', `town(CL, '${id}', 13)`);
for (const id of ['stonebridge', 'eastwatch', 'hrothgard', 'vessara', 'merrow', 'gullhaven', 'harrowgate', 'calder']) SCENES[`${id}-night`] = new Function('CL', `town(CL, '${id}', 23)`);
for (const id of ['grass_field', 'forest_clearing', 'forest_wilds', 'river_ford', 'hill_slopes', 'tourney_lists', 'greywall_courtyard']) SCENES[`field-${id}`] = new Function('CL', `fieldOn(CL, '${id}')`);

function fieldOn(CL, id) {
  const m = CL.content.get('battle_maps', id);
  CL.combat.setActiveCap(40);
  const def = CL.debugTools.benchDef(40, { reserve: 0 });
  CL.combat.startBattle({ ...def, mapDef: m.generate ? CL.arena.build(m, 40) : m });
  CL.game.godMode = true;
  for (const grp of ['infantry', 'archer', 'cavalry']) CL.game.orders[grp] = 'charge';
}
function town(CL, id, hour) {
  const c = CL.campaign;
  c.day = Math.floor(c.day) + hour / 24;
  c.world.location = id;
  CL.town.enter(id);
}
/** The Art gallery (Debug → Art gallery), then keys: ← → turn, Space the next pose, Tab the next page. */
function gallery(keys) {
  document.querySelector('#stage').dataset.dev = 'on';
  document.querySelector('#cheatBtn').click();
  document.querySelector('#artGalleryBtn').click();
  setTimeout(() => {
    for (const code of keys) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
    document.querySelector('#stage').dataset.dev = 'off';
  }, 700);
}
function battle(CL, size) {
  CL.combat.setActiveCap(size);
  CL.combat.startBattle(CL.debugTools.benchDef(size, { reserve: 0 }));
  CL.game.godMode = true;
  for (const grp of ['infantry', 'archer', 'cavalry']) CL.game.orders[grp] = 'charge';
}

async function waitMode(page, mode, timeout = 30_000) {
  await page.waitForFunction((m) => window.Crownless?.game?.mode === m, mode, { timeout });
}

async function shoot(browser, profile, scene, dir) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  const page = await ctx.newPage();
  await page.addInitScript((settings) => {
    localStorage.clear();
    localStorage.setItem('crownless_settings', JSON.stringify(settings));
    let s = 77;
    Math.random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }, SETTINGS);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await waitMode(page, 'title');
  await page.locator('#primaryBtn').click();
  await waitMode(page, 'create');
  await page.locator('#heroName').fill('Aldo');
  await page.evaluate(() => (window.Crownless.game.plainStart = true));
  await page.locator('#primaryBtn').click();
  await waitMode(page, 'settlement');
  // The scene and its helpers run in the page (they are plain functions of CL).
  await page.evaluate(`(() => { document.querySelector('#stage').dataset.dev = 'off'; const town = ${town}; const battle = ${battle}; const gallery = ${gallery}; const fieldOn = ${fieldOn}; (${SCENES[scene]})(window.Crownless); })()`);
  await page.waitForTimeout(scene.startsWith('battle') || scene.startsWith('siege') || scene.startsWith('field') ? 6000 : 1500);
  const file = path.join(dir, `${profile}-${scene}.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  return file;
}

async function run(label, scenes, profiles) {
  const dir = path.join(ROOT, 'docs', 'graphics-demo', 'p11-12', label);
  fs.mkdirSync(dir, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts/static-server.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const out = [];
  try {
    for (const profile of profiles) for (const scene of scenes) out.push(await shoot(browser, profile, scene, dir));
  } finally {
    await browser.close();
    server.kill();
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const label = args[0] && !args[0].startsWith('--') ? args[0] : 'shots';
  const scenes = opt('--scenes') ? opt('--scenes').split(',') : Object.keys(SCENES);
  const profiles = opt('--profiles') ? opt('--profiles').split(',') : ['desktop', 'phone'];
  run(label, scenes, profiles).then((files) => console.log(files.map((f) => path.relative(ROOT, f)).join('\n')));
}

module.exports = { run, SCENES };
