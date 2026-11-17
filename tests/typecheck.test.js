// Type checking without a build step (V2-00, docs/V2-PLAN.md): the core modules carry `// @ts-check`
// and JSDoc, checked by `npm run typecheck` (TypeScript's tsc, dev only, no output) as part of
// `npm run lint`. The checker itself runs in lint, not here; these tests keep the setup from being
// quietly switched off.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Modules converted so far. Add a module here when a task converts it; never remove one.
const CHECKED = ['core', 'storage', 'events', 'soldiers', 'encounter', 'save', 'portable', 'party', 'units', 'combat', 'story', 'world'];

test('every converted module opts in to type checking on its first line', () => {
  for (const m of CHECKED) {
    assert.equal(read(`js/${m}.js`).split('\n')[0].trim(), '// @ts-check', `js/${m}.js`);
  }
});

test('lint runs the type checker, with a pinned TypeScript and no build output', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.typecheck, /typescript@\d+\.\d+\.\d+ tsc --noEmit/);
  assert.match(pkg.scripts.lint, /npm run typecheck/);
  assert.equal(pkg.dependencies, undefined, 'the game has no runtime dependencies');
  // tsconfig.json allows comments, so only check its key settings as text.
  const cfg = read('tsconfig.json');
  assert.match(cfg, /"noEmit": true/);
  assert.match(cfg, /"allowJs": true/);
  assert.match(cfg, /"types\/\*\.d\.ts"/);
  assert.match(cfg, /"js\/\*\.js"/);
});

test('the shared types are for the checker only: the page never loads them', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /types\/|\.ts"/);
  assert.match(read('types/crownless.d.ts'), /interface Campaign \{/);
});
