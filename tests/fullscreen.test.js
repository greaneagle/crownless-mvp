// Full screen on phones (owner request after phone testing: Chrome's address bar takes room).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const ROOT = path.join(__dirname, '..');

/** A stand-in document and screen that record full-screen requests. */
function fakeBrowser(sandbox, { enabled = true, installed = false } = {}) {
  const log = { requests: [], exits: 0, locks: [] };
  const document = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    exitFullscreen() {
      log.exits++;
      document.fullscreenElement = null;
      return Promise.resolve();
    },
  };
  document.documentElement = {
    requestFullscreen(opts) {
      log.requests.push(opts);
      document.fullscreenElement = document.documentElement;
      return Promise.resolve();
    },
  };
  Object.assign(sandbox, {
    document,
    screen: {
      orientation: {
        lock(o) {
          log.locks.push(o);
          return Promise.resolve();
        },
        unlock() {},
      },
    },
    matchMedia: (q) => ({ matches: installed && /display-mode/.test(q) }),
  });
  return { document, log };
}

const tick = () => new Promise((r) => setImmediate(r));

test('with the setting on, the first tap goes full screen (and locks landscape); later taps leave it be', async () => {
  const { CL, sandbox } = loadGame();
  const { document, log } = fakeBrowser(sandbox);
  CL.settings.load();
  CL.settings.set('fullscreen', true);
  CL.fullscreen.bind();
  document.listeners.pointerup();
  await tick();
  assert.equal(log.requests.length, 1);
  assert.equal(log.requests[0].navigationUI, 'hide');
  assert.deepEqual(log.locks, ['landscape']);
  document.listeners.pointerup();
  await tick();
  assert.equal(log.requests.length, 1, 'already full screen');
  // The player swipes out of full screen: the next tap brings it back.
  document.fullscreenElement = null;
  document.listeners.pointerup();
  await tick();
  assert.equal(log.requests.length, 2);
});

test('with the setting off nothing happens; turning it off leaves full screen', async () => {
  const { CL, sandbox } = loadGame();
  const { document, log } = fakeBrowser(sandbox);
  CL.settings.load();
  CL.settings.set('fullscreen', false);
  CL.fullscreen.bind();
  document.listeners.pointerup();
  await tick();
  assert.equal(log.requests.length, 0);
  await CL.fullscreen.setWanted(true);
  assert.equal(log.requests.length, 1, 'the Settings switch enters at once');
  await CL.fullscreen.setWanted(false);
  assert.equal(log.exits, 1);
});

test('launched from the home screen, or on a browser without full screen (iPhone): no requests, no errors', async () => {
  for (const opts of [{ installed: true }, { enabled: false }]) {
    const { CL, sandbox } = loadGame();
    const { document, log } = fakeBrowser(sandbox, opts);
    CL.settings.load();
    CL.settings.set('fullscreen', true);
    CL.fullscreen.bind();
    document.listeners.pointerup();
    await tick();
    assert.equal(log.requests.length, 0, JSON.stringify(opts));
  }
  // And in a place with no document at all (Node), nothing throws.
  const { CL } = loadGame();
  assert.equal(CL.fullscreen.supported(), false);
  CL.fullscreen.onTap();
});

test('phones default to full screen; desktops do not; the choice is kept on the device', () => {
  const desktop = loadGame();
  assert.equal(desktop.CL.settings.load().fullscreen, false);
  const phone = loadGame();
  phone.sandbox.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' });
  assert.equal(phone.CL.settings.load().fullscreen, true);
  phone.CL.settings.set('fullscreen', false);
  assert.equal(JSON.parse(phone.storage.data[phone.CL.settings.KEY]).fullscreen, false);
});

test('add to home screen: a full-screen landscape web app manifest with real icons', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.start_url, './');
  const sizes = new Set();
  for (const ic of m.icons) {
    const b = fs.readFileSync(path.join(ROOT, ic.src));
    const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, ic.sizes, ic.src);
    sizes.add(ic.sizes);
  }
  assert.ok(sizes.has('192x192') && sizes.has('512x512'), 'Android needs 192 and 512');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon.png">/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(fs.readFileSync(path.join(ROOT, 'docs', 'ASSETS.md'), 'utf8'), /icons\//, 'the icons are in the provenance record');
});
