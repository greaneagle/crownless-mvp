// One version everywhere: package.json, CL.BUILD, the page title, the HUD and the footer. (A stale
// "0.38.1" footer slipped through blanket find-and-replace version bumps before 1.0.0.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const ROOT = path.join(__dirname, '..');

test('package.json, CL.BUILD and every version shown on the page agree', () => {
  const { CL } = loadGame();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(CL.BUILD, pkg.version);
  const [major, minor] = CL.BUILD.split('.');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, new RegExp(`<title>Crownless ${major}\\.${minor} · `), 'title');
  assert.match(html, new RegExp(`<small>v${major}\\.${minor}[ <]`), 'HUD');
  assert.match(html, new RegExp(`<div id="version">[^<]*(?<![\\d.])${CL.BUILD.replace(/\./g, '\\.')}(?![\\d.])`), 'footer shows the full build');
  // No other version-like number in the shown strings.
  const shown = [...html.matchAll(/<title>([^<]*)<\/title>|<small>([^<]*)<\/small>|<div id="version">([^<]*)<\/div>/g)].map((m) => m[1] || m[2] || m[3]).join(' ');
  for (const v of shown.match(/\d+\.\d+(\.\d+)?/g) || []) assert.ok(CL.BUILD.startsWith(v), `stray version ${v}`);
});
