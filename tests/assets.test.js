// The asset guard (P10-G6, D-P10k): everything the game shows is drawn in code by the art kit (js/art/).
// It ships no raster art but the home-screen icons (made by scripts/make-icons.js), no code or data names
// an image file, and the page pulls nothing from other sites. The browser half (tests/browser/art.spec.js)
// checks that no screen requests an image.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|avif|ico)$/i;
const ICONS = ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
// Never shipped: dependencies, test output, and the owner's local, git-ignored art folders.
const LOCAL = /^(node_modules|test-results|playwright-report|blob-report|art-reference|art-work|docs\/graphics-demo|\.git)(\/|$)/;

/** Every file the site would publish (the deploy uploads the checkout): git's list, or a walk without it. */
function shippedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return fs
      .readdirSync(ROOT, { recursive: true })
      .map((f) => String(f).replaceAll('\\', '/'))
      .filter((f) => !LOCAL.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
  }
}

const sources = () => [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'style.css'),
  ...['js', 'data', 'packs'].flatMap((d) =>
    fs.existsSync(path.join(ROOT, d))
      ? fs
          .readdirSync(path.join(ROOT, d), { recursive: true })
          .map((f) => path.join(ROOT, d, String(f)))
          .filter((f) => /\.(js|css|json|html)$/.test(f))
      : [],
  ),
];

test('the game ships no raster art except the home-screen icons', () => {
  // The screenshot baselines (tests/browser/screenshots/, D-T2) are test data the game never loads.
  const images = shippedFiles().filter((f) => IMAGE.test(f) && !LOCAL.test(f) && !f.startsWith('tests/browser/screenshots/'));
  assert.deepEqual(images.sort(), ICONS, 'only icons/ holds images; everything else is drawn by js/art/');
  assert.equal(fs.existsSync(path.join(ROOT, 'assets')), false, 'assets/ is gone (P10-G6)');
  for (const f of ['js/assets.js', 'scripts/asset-manifest.js']) assert.equal(fs.existsSync(path.join(ROOT, f)), false, `${f} is gone`);
});

test('no code or data names an image file, a sprite tile or sprite frames', () => {
  for (const file of sources()) {
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    const text = fs.readFileSync(file, 'utf8');
    // The home-screen icons are named only by the page's head and the web manifest.
    const named = [...text.matchAll(/["'`(]([^"'`()\s]*\.(?:png|jpe?g|gif|webp|avif))["'`)]/gi)].map((m) => m[1]).filter((u) => !(rel === 'index.html' && u.startsWith('icons/')));
    assert.deepEqual(named, [], `${rel} names an image`);
    assert.doesNotMatch(text, /\b[uw]0\d{3}\b/, `${rel}: a sprite id`);
    assert.doesNotMatch(text, /new Image\(|\btile:\s*['"]/, `${rel}: an image or sprite tile`);
  }
  const webManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const i of webManifest.icons || []) assert.ok(ICONS.includes(i.src.replace(/^\.?\//, '')), `manifest icon ${i.src}`);
});

test('no runtime dependencies: the page loads only its own files', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(m[1]) || m[1].startsWith('data:'), `external resource ${m[1]}`);
  }
  for (const file of sources().filter((f) => !f.endsWith('index.html'))) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /https?:\/\/(?!www\.w3\.org)/, `${path.basename(file)} reaches another site`);
    assert.doesNotMatch(text, /@import|fonts\.googleapis/, `${path.basename(file)} loads web fonts`);
  }
});
