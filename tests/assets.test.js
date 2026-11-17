// Asset provenance (GDD §14 Gate E "original/licensed art"; docs/ASSETS.md; Gate E 5.6): every shipped
// image is accounted for, the manifest is current, and the page pulls nothing from other sites.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { usedFiles } = require('../scripts/asset-manifest');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8'));
const pngs = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.png'));

test('every image in assets/ is in the manifest with a documented source', () => {
  assert.deepEqual(
    pngs.filter((f) => !manifest.files[f]),
    [],
    'run node scripts/asset-manifest.js after adding files',
  );
  assert.deepEqual(
    Object.keys(manifest.files).filter((f) => !pngs.includes(f)),
    [],
    'the manifest lists files that are gone',
  );
  for (const [f, e] of Object.entries(manifest.files)) {
    const s = manifest.sources[e.source];
    assert.ok(s?.origin && s?.rights, `${f}: source "${e.source}" needs an origin and rights`);
  }
});

test('the manifest’s "used" flags match what the game loads, and nothing it loads is missing', () => {
  const used = usedFiles();
  assert.deepEqual(
    [...used].filter((f) => !pngs.includes(f)),
    [],
    'the game asks for files that do not exist',
  );
  const stale = Object.entries(manifest.files).filter(([f, e]) => e.used !== used.has(f));
  assert.deepEqual(
    stale.map(([f]) => f),
    [],
    'run node scripts/asset-manifest.js to refresh the used flags',
  );
});

test('no runtime dependencies: the page loads only its own files', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(m[1]) || m[1].startsWith('data:'), `external resource ${m[1]}`);
  }
  const shipped = [
    ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => path.join(ROOT, 'js', f)),
    ...fs.readdirSync(path.join(ROOT, 'data')).map((f) => path.join(ROOT, 'data', f)),
    path.join(ROOT, 'style.css'),
  ];
  for (const file of shipped) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /https?:\/\/(?!www\.w3\.org)/, `${path.basename(file)} reaches another site`);
    assert.doesNotMatch(text, /@import|fonts\.googleapis/, `${path.basename(file)} loads web fonts`);
  }
});
