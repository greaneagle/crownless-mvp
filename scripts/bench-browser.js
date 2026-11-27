// P11-00: Debug → Battle benchmark in headless Chromium (Playwright, the browser tests' own), for each
// Sharpness on the desktop and the phone profile, so drawing is measured too (scripts/bench-battle.js
// measures the simulation alone). Headless Chromium draws in software: the numbers compare builds on
// this machine; the owner's phone (Debug → Battle benchmark there) is the real measure.
//   node scripts/bench-browser.js [seconds=15] [--sizes 40,100,200] [--sharpness sharp,balanced,fast]
//        [--profiles desktop,phone] [--scenarios mixed,realms,mounted,archer,cavalry,archers,siege] [--zoom 1,0.75] [--json]
// P11-12a: the original P11-12's scenarios (js/debug.js SCENARIOS) at each battle zoom.
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CROWNLESS_BENCH_PORT || 8139);
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const SETTINGS = { music: 0, sfx: 0, tips: false, fullscreen: false, mapSpeed: 'fast', battleSizeChosen: true, prepSkip: true };

async function waitMode(page, mode, timeout = 30_000) {
  await page.waitForFunction((m) => window.Crownless?.game?.mode === m, mode, { timeout });
}

/** One profile and Sharpness: a new game, then the benchmark at the sizes. */
async function one(browser, profile, sharpness, sizes, seconds, scenario = 'mixed', zoom = 1) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  const page = await ctx.newPage();
  await page.addInitScript((settings) => {
    if (!sessionStorage.getItem('bench_ready')) {
      sessionStorage.setItem('bench_ready', '1');
      localStorage.clear();
      localStorage.setItem('crownless_settings', JSON.stringify(settings));
    }
  }, { ...SETTINGS, sharpness });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await waitMode(page, 'title');
  await page.locator('#primaryBtn').click(); // New game
  await waitMode(page, 'create');
  await page.locator('#heroName').fill('Bench');
  await page.evaluate(() => (window.Crownless.game.plainStart = true));
  await page.locator('#primaryBtn').click(); // Begin
  await waitMode(page, 'settlement');
  await page.locator('#primaryBtn', { hasText: 'Leave' }).click();
  await waitMode(page, 'map');
  await page.evaluate(({ sizes, seconds, scenario, zoom }) => {
    const CL = window.Crownless;
    Object.assign(CL.debugTools.BENCH, { sizes, seconds, scenario, zoom });
    CL.debugTools.benchmark();
  }, { sizes, seconds, scenario, zoom });
  await waitMode(page, 'result', (seconds + 30) * sizes.length * 1000);
  const rows = await page.evaluate(() => window.Crownless.game.result.practice.rows);
  await ctx.close();
  return rows.map((r) => ({ profile, sharpness, scenario, zoom, ...r }));
}

async function run({ seconds = 15, sizes = [40, 100, 200], sharpness = ['sharp', 'balanced', 'fast'], profiles = ['desktop', 'phone'], scenarios = ['mixed'], zooms = [1] } = {}) {
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts/static-server.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  const out = [];
  try {
    for (const scenario of scenarios) for (const zoom of zooms) for (const profile of profiles) for (const s of sharpness) out.push(...(await one(browser, profile, s, sizes, seconds, scenario, zoom)));
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
  const seconds = Number(args.find((a, i) => /^\d+$/.test(a) && !String(args[i - 1]).startsWith('--')) ?? 15);
  const sizes = opt('--sizes') ? opt('--sizes').split(',').map(Number) : [40, 100, 200];
  const sharpness = opt('--sharpness') ? opt('--sharpness').split(',') : ['sharp', 'balanced', 'fast'];
  const profiles = opt('--profiles') ? opt('--profiles').split(',') : ['desktop', 'phone'];
  const scenarios = opt('--scenarios') ? opt('--scenarios').split(',') : ['mixed'];
  const zooms = opt('--zoom') ? opt('--zoom').split(',').map(Number) : [1];
  run({ seconds, sizes, sharpness, profiles, scenarios, zooms }).then((rows) => {
    if (args.includes('--json')) return console.log(JSON.stringify(rows, null, 2));
    console.table(rows.map((r) => ({ scene: r.scenario, zoom: r.zoom, profile: r.profile, sharp: r.sharpness, size: r.cap, fps: r.fps, 'sim ms': r.simMs, 'draw ms': r.drawMs, p50: r.frameP50, p95: r.frameP95, p99: r.frameP99, '>16.7': r.over16, '>33': r.over33, 'sim p95': r.simP95, 'draw p95': r.drawP95, cache: r.cacheEntries, 'hit %': r.cacheHitRate == null ? null : Math.round(r.cacheHitRate * 100), looks: r.looks, 'heap MB': r.heapMB })));
    console.log('Headless Chromium draws in software: compare builds on this machine; the phone is the real measure.');
  });
}

module.exports = { run, PROFILES };
