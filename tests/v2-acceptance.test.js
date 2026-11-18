// v2.0 acceptance (V2-13): the design's scenarios that no feature test covered on its own. The short
// Prototype G is a slow test, in tests/slow/campaign-bots.test.js (H-01). The full map of scenarios
// to tests and measurements is docs/V2-VALIDATION.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

test('SC-33: a save naming a troop this version lacks is refused by name and kept, never quietly thinned', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  const c = CL.campaign;
  c.roster = [];
  CL.save.addSoldier(c, 'footman');
  const edric = CL.save.addSoldier(c, 'footman');
  assert.equal(CL.save.write(), true);
  const d = JSON.parse(storage.data[CL.save.KEY]);
  d.roster.find((s) => s.id === edric.id).troop = 'war_elephant'; // a modded or removed troop
  const text = JSON.stringify(d);
  storage.data[CL.save.KEY] = text;
  storage.data[CL.save.BACKUP_KEY] = text;
  // Import: rejected, naming what is unknown.
  const other = loadGame().CL;
  const f = JSON.parse(CL.portable.serialize(c));
  f.campaign = d;
  f.checksum = other.portable.checksum(JSON.stringify(d));
  const r = other.portable.importText(JSON.stringify(f));
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' | '), /war_elephant/);
  // Loading from the browser: refused with a precise notice, and the save kept exactly as it was.
  const back = loadGame({ storage }).CL;
  assert.match(back.save.notice, new RegExp(`needs troops this version of the game does not have: ${edric.name} \\(war_elephant\\)`));
  assert.equal(storage.data[back.save.INCOMPATIBLE_KEY], text);
  assert.equal(back.save.existed, false, 'a fresh start is offered…');
  back.campaign.gold = 1;
  back.save.write();
  assert.equal(storage.data[back.save.INCOMPATIBLE_KEY], text, '…and starting it erases nothing');
});

test('SC-34 (headless): the big forest battle with cavalry and parties riding in runs to its end', () => {
  const { CL } = loadGame({ random: () => 0.37 });
  CL.debugTools.cameraTest(40, { help: true });
  const g = CL.game;
  assert.equal(g.joining.length, 2);
  for (let i = 0; i < 20 * 400 && g.mode === 'battle'; i++) {
    const h = g.hero;
    const e = g.enemies.filter((x) => x.alive && !x.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (e && h.alive) {
      const [dx, dy] = [e.x - h.x, e.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = { x: dx / L, y: dy / L };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.05);
  }
  assert.equal(g.mode, 'result');
  assert.ok(g.joining.some((j) => j.arrived), 'help rode in');
  assert.match(g.result.html, /Parties that rode in: /);
  assert.ok(g.result.practice.peak <= 40 + 1, 'the battle size cap held (help waited in reserve)');
  CL.combat.setActiveCap(40);
});

test('SC-35: a long gap (a backgrounded app) is one short step: no strategic catch-up, no battle lurch', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  // In battle: an hour away advances one capped frame.
  CL.combat.startBattle('looter_band');
  const g = CL.game;
  g.attackHeld = false;
  const t0 = g.t;
  CL.combat.update(3600);
  assert.ok(g.t - t0 <= 0.05 + 1e-9);
  // Paused (the app pauses when hidden): nothing moves at all.
  g.paused = true;
  CL.combat.update(3600);
  assert.ok(g.t - t0 <= 0.05 + 1e-9);
  // On the map, travelling: an hour away advances one capped step of campaign time.
  g.mode = 'map';
  g.paused = false;
  CL.world.leaveSettlement();
  const day = c.day;
  const s = CL.content.table('settlements').eastwatch;
  CL.world.travelTo({ type: 'settlement', id: 'eastwatch', x: s.mapX, y: s.mapY });
  CL.world.update(3600);
  assert.ok((c.day - day) * 24 <= 0.1 * CL.world.HOURS_PER_SECOND + 1e-9, 'at most a tenth of a second of map time');
});

