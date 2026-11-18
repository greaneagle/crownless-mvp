// W-02: the gesture recogniser. Synthetic pointer sequences: a tap travels, a drag pans, a pinch zooms,
// and nothing but a clean tap ever reaches onTap (so a drag or pinch can never start travel).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A recogniser that records what it reports. */
function setup() {
  const { CL } = loadGame();
  const log = [];
  const r = CL.gestures.recognizer({
    onTap: (x, y) => log.push(['tap', x, y]),
    onPan: (dx, dy) => log.push(['pan', dx, dy]),
    onPinch: (f, x, y) => log.push(['pinch', f, x, y]),
    onZoom: (f, x, y) => log.push(['zoom', f, x, y]),
    onEnd: (kind) => log.push(['end', kind]),
  });
  const ev = (id, x, y, type = 'touch', button = 0) => ({ pointerId: id, clientX: x, clientY: y, pointerType: type, button });
  const kinds = () => log.map((l) => l[0]);
  return { CL, r, ev, log, kinds };
}

test('a tap: down and up within the threshold taps once, where the finger lifted', () => {
  const { r, ev, log } = setup();
  r.down(ev(1, 100, 100));
  assert.equal(r.state, 'press');
  r.move(ev(1, 105, 103)); // under 8 px: still a tap
  r.up(ev(1, 105, 103));
  assert.deepEqual(
    log.map((l) => [...l]),
    [
      ['tap', 105, 103],
      ['end', 'tap'],
    ],
  );
  assert.equal(r.state, 'idle');
});

test('a drag past the threshold pans (catching up with the finger) and never taps', () => {
  const { r, ev, log, kinds } = setup();
  r.down(ev(1, 100, 100));
  r.move(ev(1, 112, 100)); // 12 px: a pan
  assert.equal(r.state, 'pan');
  r.move(ev(1, 130, 90));
  r.up(ev(1, 130, 90)); // even if it ends on a settlement
  assert.deepEqual(kinds(), ['pan', 'pan', 'end']);
  assert.deepEqual([...log[0]], ['pan', 12, 0]);
  assert.deepEqual([...log[1]], ['pan', 18, -10]);
  assert.deepEqual([...log[2]], ['end', 'pan']);
});

test('a pinch zooms around the fingers and never taps, even ending with one finger', () => {
  const { r, ev, log, kinds } = setup();
  r.down(ev(1, 100, 100));
  r.down(ev(2, 200, 100));
  assert.equal(r.state, 'pinch');
  r.move(ev(2, 300, 100)); // the fingers spread from 100 to 200 px apart
  const pinch = log.find((l) => l[0] === 'pinch');
  assert.equal(pinch[1], 2);
  assert.deepEqual([pinch[2], pinch[3]], [200, 100], 'around the midpoint');
  r.up(ev(2, 300, 100)); // one finger lifts: the other may pan, but never taps
  assert.equal(r.state, 'pan');
  r.move(ev(1, 101, 100));
  r.up(ev(1, 101, 100));
  assert.ok(!kinds().includes('tap'));
  assert.equal(kinds().at(-1), 'end');
  // A second finger that touches and lifts without moving still spoils the tap.
  log.length = 0;
  r.down(ev(3, 50, 50));
  r.down(ev(4, 60, 60));
  r.up(ev(4, 60, 60));
  r.up(ev(3, 50, 50));
  assert.ok(!kinds().includes('tap'));
});

test('cancel, lost capture and a window blur end the interaction with nothing', () => {
  const { r, ev, kinds } = setup();
  r.down(ev(1, 100, 100));
  r.cancel(); // pointercancel or blur
  r.up(ev(1, 100, 100)); // a late pointerup for a pointer no longer tracked
  assert.deepEqual(kinds(), ['end']);
  r.down(ev(2, 10, 10));
  r.lost({ pointerId: 2 });
  r.up(ev(2, 10, 10));
  assert.deepEqual(kinds(), ['end', 'end']);
  // A capture lost after the pointer went up (the browser always does that) changes nothing.
  r.down(ev(3, 10, 10));
  r.up(ev(3, 10, 10));
  r.lost({ pointerId: 3 });
  assert.deepEqual(kinds(), ['end', 'end', 'tap', 'end']);
});

test('the mouse: a click taps, a drag pans, the wheel zooms at the cursor, other buttons are ignored', () => {
  const { r, ev, log, kinds } = setup();
  r.down(ev(1, 10, 10, 'mouse'));
  r.up(ev(1, 10, 10, 'mouse'));
  r.down(ev(1, 10, 10, 'mouse'));
  r.move(ev(1, 40, 10, 'mouse'));
  r.up(ev(1, 40, 10, 'mouse'));
  assert.equal(r.down(ev(1, 10, 10, 'mouse', 2)), false, 'right button');
  r.up(ev(1, 10, 10, 'mouse', 2));
  assert.deepEqual(kinds(), ['tap', 'end', 'pan', 'end']);
  log.length = 0;
  r.wheel({ deltaY: -100, clientX: 300, clientY: 200 });
  r.wheel({ deltaY: 100, clientX: 300, clientY: 200 });
  const [inn, out] = log;
  assert.equal(inn[0], 'zoom');
  assert.ok(inn[1] > 1 && out[1] < 1, 'wheel up zooms in, down zooms out');
  assert.ok(Math.abs(inn[1] * out[1] - 1) < 1e-12, 'symmetric');
  assert.deepEqual([inn[2], inn[3]], [300, 200]);
});
