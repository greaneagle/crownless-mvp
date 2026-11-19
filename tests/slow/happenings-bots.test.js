// P7-08: 90 days of a bot company with the world sim and its events running: events come and go, each
// resolves once, within MAX_OPEN and their cooldowns, and nothing loops. (The rules of each kind are in
// tests/happenings.test.js.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('../helpers/load');

function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
const def = (CL, k) => CL.content.get('world_events', k);

test('90 days of a bot company: events come and go, each once, within their limits, and no loop', () => {
  const { CL } = loadGame({ random: () => 0.5, worldEvents: true, worldParties: true, seed: 7 });
  const c = CL.campaign;
  const H = CL.happenings;
  go(CL, c, 'stonebridge');
  c.food = 400;
  c.gold = 2000;
  const started = new Map(); // id → event, as first seen
  const t0 = Date.now();
  let most = 0;
  for (let step = 0; step < 90 * 4; step++) {
    CL.party.advanceDays(0.25);
    if (c.food < 50) c.food = 400;
    const open = H.state(c).open;
    most = Math.max(most, open.length);
    for (const e of open) if (!started.has(e.id)) started.set(e.id, { ...e });
    // Every other event: the bot rides there and takes part if it can.
    const e = open.find((x) => x.id % 2 === 0 && !x.taken);
    if (e) {
      go(CL, c, e.place);
      H.onArrive(c, e.place);
      const o = H.options(c, e).find((x) => !x.reason);
      if (o) H.choose(c, e.id, o.id);
    }
  }
  const past = H.state(c).past;
  assert.ok(Date.now() - t0 < 60000, 'in good time');
  assert.ok(started.size >= 6, `events started: ${started.size}`);
  assert.ok(most <= H.MAX_OPEN);
  const kinds = new Set([...started.values()].map((e) => e.kind));
  assert.ok(kinds.size >= 3, `kinds: ${[...kinds]}`);
  assert.equal(new Set(past.map((p) => p.id)).size, past.length, 'each resolves once');
  for (const p of past) assert.ok(H.RESULTS[p.kind].includes(p.result));
  assert.ok(past.some((p) => p.result !== 'ignored' && p.result !== 'others'), 'the bot took part in some');
  // Cooldowns: no two of a kind in one region within its cooldown.
  const region = (sid) => CL.world.regionAt(CL.content.get('settlements', sid).mapX, CL.content.get('settlements', sid).mapY)?.id;
  const list = [...started.values()].sort((a, b) => a.start - b.start);
  for (const [i, a] of list.entries()) {
    for (const b of list.slice(i + 1)) {
      if (a.kind === b.kind && region(a.place) === region(b.place)) assert.ok(b.start - a.start >= def(CL, a.kind).cooldown - 1e-9, `${a.kind} twice in ${region(a.place)}`);
    }
  }
  assert.equal(c.news.lines.length > 0, true);
});
