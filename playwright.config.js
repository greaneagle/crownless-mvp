// Browser regression tests (W-00; docs/NEXT-TASKS.md). Chromium only, two projects: a desktop with a
// mouse and a landscape phone with touch. Behaviour specs run everywhere; screenshot specs (tagged
// @visual) compare only against baselines made on CI's Linux Chromium (decision D-T2).
// The game is served by scripts/static-server.js (no dependencies, no cache).
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.CROWNLESS_TEST_PORT || 8131);
const CI = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: 'tests/browser',
  testMatch: '**/*.spec.js',
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/screenshots/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 812, height: 375 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `node scripts/static-server.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !CI,
    timeout: 20_000,
  },
});
