// The Art gallery (Debug → Art gallery; js/gfx/): the parts that need no screen. While it is open the
// save is never written; normal play never loads it; and its files are the gallery and its viewer only
// (P10-G6: the graphics demo's map, city and battle are retired, their scenes now the game itself).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, memoryStorage } = require('./helpers/load');

const ROOT = path.join(__dirname, '..');

test('while the gallery is open the save is never written; otherwise it is', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  assert.equal(CL.save.write(), true);
  const before = JSON.stringify(storage.data);
  CL.artGallery = { active: true };
  CL.campaign.gold += 500;
  assert.equal(CL.save.write(), false);
  assert.equal(CL.save.autosave(), false);
  assert.equal(JSON.stringify(storage.data), before);
  CL.artGallery = { active: false };
  assert.equal(CL.save.write(), true);
});

test('normal play does not load the gallery; the Debug panel loads its two files on demand; the demo is gone', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /js\/gfx\//);
  assert.match(html, /data-cheat="artGallery"[^>]*>Art gallery</);
  assert.doesNotMatch(html, /gfxDemo|Graphics Demo/);
  const debug = fs.readFileSync(path.join(ROOT, 'js', 'debug.js'), 'utf8');
  const files = debug.match(/GALLERY_FILES = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(files, ['gallery', 'viewer']);
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'js', 'gfx')).sort(), ['gallery.js', 'viewer.css', 'viewer.js']);
  assert.match(fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8'), /if \(CL\.artGallery\?\.active\) \{\s+CL\.artGallery\.frame\(dt\);/);
});

test('every gallery page draws in the kit', () => {
  const { CL, sandbox } = loadGame();
  const vm = require('node:vm');
  const file = path.join(ROOT, 'js', 'gfx', 'gallery.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  const scene = CL.gfx.scenes.gallery;
  const S = {};
  scene.init(S);
  const calls = { fill: 0, drawImage: 0 };
  const ctx = new Proxy(
    { fill: () => calls.fill++, fillRect: () => calls.fill++, drawImage: () => calls.drawImage++, measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) },
    {
      get: (o, k) => (k in o ? o[k] : () => {}),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    },
  );
  const api = { W: 960, H: 540, k: 1, prompt() {}, textScale: () => 1 };
  for (let p = 0; p < scene.pages().length; p++) {
    S.gallery.page = p;
    const n = calls.fill;
    scene.draw(ctx, S, api);
    assert.ok(calls.fill - n > 50, `page ${p} draws`);
  }
});
