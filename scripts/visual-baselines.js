// Makes the screenshot baselines (W-00, decision D-T2) the way CI sees the game: Linux Chromium inside
// the official Playwright Docker image of the pinned version, with this repository mounted.
//   npm run test:visual:docker              regenerate every baseline (tests/browser/screenshots/)
//   npm run test:visual:docker -- --check   compare against the baselines instead
// Needs Docker. Only regenerate for an intended visual change, and review the new images in the diff.
// Without Docker, run the "Browser tests" workflow by hand with "update screenshots" ticked and commit
// the baselines from its artifact.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const pkg = require('../package.json');

const version = pkg.devDependencies['@playwright/test'];
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const run = `npm ci --no-audit --no-fund && npx playwright test --grep @visual ${check ? '' : '--update-snapshots=all'}`;

console.log(`${check ? 'Comparing' : 'Making'} screenshot baselines in ${image}`);
const r = spawnSync(
  'docker',
  // node_modules gets its own volume so the container's Linux install never touches the host's.
  ['run', '--rm', '--ipc=host', '-e', 'CI=1', '-v', `${root}:/work`, '-v', '/work/node_modules', '-w', '/work', image, 'bash', '-lc', run],
  { stdio: 'inherit' },
);
if (r.error) console.error(`Could not run Docker (${r.error.message}). Is it installed and running?`);
process.exit(r.status ?? 1);
