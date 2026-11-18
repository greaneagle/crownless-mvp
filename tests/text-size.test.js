// W-01: text size. A device setting (Small, Normal, Large, Larger) validated like the others, applied
// at once through CL.ui.applyTextScale, and followed by every font the game sets: the canvas fonts
// through CL.settings.font, the HTML ones through --ui-scale in style.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const ROOT = path.join(__dirname, '..');

test('text size: Normal by default and for settings saved before it existed; only the four sizes', () => {
  const { CL, storage } = loadGame();
  const S = CL.settings;
  assert.deepEqual({ ...S.TEXT_SIZES }, { small: 0.9, normal: 1, large: 1.15, larger: 1.3 });
  assert.equal(S.load().textSize, 'normal');
  assert.equal(S.textScale(), 1);
  // An older build's settings, without the key, keep everything else and get Normal.
  storage.data[S.KEY] = JSON.stringify({ music: 20, sfx: 30, battleSize: 30, tips: false });
  const old = S.load();
  assert.equal(old.textSize, 'normal');
  assert.equal(old.music, 20);
  storage.data[S.KEY] = JSON.stringify({ textSize: 'huge' });
  assert.equal(S.load().textSize, 'normal', 'junk falls back');
  assert.equal(S.set('textSize', 'huge'), false);
  assert.equal(S.set('textSize', 1.3), false, 'by name, not by factor');
  assert.equal(S.set('textSize', 'larger'), true);
  assert.equal(JSON.parse(storage.data[S.KEY]).textSize, 'larger', 'kept on the device');
  assert.equal(S.textScale(), 1.3);
});

test('text size: applied at once to the UI, and every canvas font follows it', () => {
  const { CL } = loadGame();
  const applied = [];
  CL.ui.applyTextScale = (s) => applied.push(s);
  const S = CL.settings;
  S.load();
  assert.deepEqual(applied, [1], 'on load');
  assert.equal(S.font(14), 'bold 14px Georgia');
  for (const [size, px] of [
    ['small', 13],
    ['large', 16],
    ['larger', 18],
  ]) {
    S.set('textSize', size);
    assert.equal(applied.at(-1), S.TEXT_SIZES[size], `${size} applied at once`);
    assert.equal(S.font(14), `bold ${px}px Georgia`);
  }
  assert.equal(S.font(13, { family: 'system-ui, sans-serif' }), 'bold 17px system-ui, sans-serif');
  assert.equal(S.font(10, { weight: 'normal' }), 'normal 13px Georgia');
});

test('text size: the renderer sets no fixed font, and every pixel font size in style.css scales', () => {
  const render = fs.readFileSync(path.join(ROOT, 'js', 'render.js'), 'utf8');
  assert.deepEqual(render.match(/ctx\.font\s*=\s*['"`]/g) || [], [], 'canvas fonts come from font() or, for icon art, fixedFont()');
  assert.ok((render.match(/fixedFont\(/g) || []).length <= 3, 'only the icon emblems are fixed');
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const unscaled = [];
  for (const m of css.matchAll(/(?:font-size|font)\s*:\s*([^;}]+)/g)) {
    const v = m[1];
    if (/px|vw|clamp/.test(v) && !v.includes('var(--ui-scale)')) unscaled.push(m[0]);
  }
  assert.deepEqual(unscaled, [], 'every pixel font size is written against --ui-scale');
});
