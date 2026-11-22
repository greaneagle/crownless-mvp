// P9-B1: the battle size from 20 to 150 (D-P9a): the setting and its default, the deployment and the
// field growing with the size, the benchmark's battle, and big battles that end by the same rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { bench, SIZES } = require('../scripts/bench-battle');

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the battle size: 20 to 200 in steps of 10, nothing else', () => {
  const { CL } = loadGame();
  const same = (a, b, note) => assert.equal(JSON.stringify(a), JSON.stringify(b), note); // the game's arrays are of its own sandbox
  same(CL.combat.BATTLE.capChoices, [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
  same(CL.settings.BATTLE_SIZES, CL.combat.BATTLE.capChoices, 'the setting offers what the battle takes');
  for (const n of [20, 90, 200, 150]) assert.equal(CL.combat.setActiveCap(n), true);
  for (const n of [10, 45, 210, 'x']) assert.equal(CL.combat.setActiveCap(n), false, `${n} refused`);
  assert.equal(CL.combat.BATTLE.activeCap, 150);
  CL.combat.setActiveCap(40);
  assert.equal(CL.combat.scaleOf(), 1);
  same([CL.combat.deployCap('infantry'), CL.combat.deployCap('archer'), CL.combat.deployCap('cavalry')], [12, 8, 6], 'at 40 as before');
  CL.combat.setActiveCap(150);
  same([CL.combat.deployCap('infantry'), CL.combat.deployCap('archer'), CL.combat.deployCap('cavalry')], [45, 30, 23]);
});

test('the default: a device that never chose follows the default; one that chose keeps its size', () => {
  const { CL, storage } = loadGame();
  const S = CL.settings;
  const put = (v) => {
    storage.data[S.KEY] = JSON.stringify(v);
    return S.load();
  };
  assert.equal(S.load().battleSize, S.BATTLE_DEFAULT.desktop, 'a new device (Node has no touch screen)');
  assert.equal(CL.combat.BATTLE.activeCap, S.BATTLE_DEFAULT.desktop, 'applied');
  // Before 3.1.0 there was no flag: the old default (40 on a desktop) was never chosen, anything else was.
  assert.deepEqual([put({ battleSize: 40 }).battleSize, S.get('battleSizeChosen')], [S.BATTLE_DEFAULT.desktop, false]);
  assert.deepEqual([put({ battleSize: 30 }).battleSize, S.get('battleSizeChosen')], [30, true]);
  assert.deepEqual([put({ battleSize: 40, battleSizeChosen: true }).battleSize, S.get('battleSizeChosen')], [40, true]);
  assert.deepEqual([put({ battleSize: 70, battleSizeChosen: false }).battleSize, S.get('battleSizeChosen')], [S.BATTLE_DEFAULT.desktop, false], 'not chosen: the default');
  assert.deepEqual([put({ battleSize: 45 }).battleSize, S.get('battleSizeChosen')], [S.BATTLE_DEFAULT.desktop, false], 'junk');
  put({});
  assert.equal(S.set('battleSize', 50), true);
  assert.deepEqual([S.get('battleSize'), S.get('battleSizeChosen')], [50, true], 'choosing keeps it');
  assert.equal(S.load().battleSize, 50, 'and it is kept on the device');
});

test('a slow battle offers a smaller size once, never by itself, and not to one who chose', () => {
  const { CL, storage } = loadGame();
  const S = CL.settings;
  S.load();
  assert.equal(S.slowerOffer(45, 60), null, 'fast enough');
  assert.equal(S.slowerOffer(12, 5), null, 'too short to judge');
  assert.equal(S.slowerOffer(15, 60), Math.floor(S.BATTLE_DEFAULT.desktop / 20) * 10, 'half the frame rate wanted: half the size, to the step below');
  assert.equal(S.get('battleSize'), S.BATTLE_DEFAULT.desktop, 'only offered');
  assert.equal(S.slowerOffer(15, 60), null, 'once');
  assert.equal(JSON.parse(storage.data[S.KEY]).slowOffered, true, 'remembered on the device');
  storage.data[S.KEY] = JSON.stringify({ battleSize: 120, battleSizeChosen: true });
  S.load();
  assert.equal(S.slowerOffer(10, 60), null, 'a chosen size is the player’s');
});

/** A company of `n` soldiers of the usual mix, in the campaign. */
function company(CL, n, mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard']) {
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < n; i++) CL.save.addSoldier(c, mix[i % mix.length]);
}
const band = (n, troop = 'looter') => ({ id: 'band', name: 'Band', map: 'open_country', waves: [{ [troop]: n }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });

test('a company no bigger than before forms up exactly as before, whatever the battle size', () => {
  const at = (size) => {
    const { CL } = loadGame({ random: mulberry(7) });
    CL.combat.setActiveCap(size);
    company(CL, 18);
    CL.combat.startBattle(band(10));
    const h = CL.game.battleMap.spawn.hero;
    return CL.game.allies.filter((a) => a.soldierId != null).map((a) => [Math.round(a.x - h.x), Math.round(a.y - h.y)]);
  };
  const before = at(40);
  for (const size of [60, 80]) assert.equal(JSON.stringify(at(size)), JSON.stringify(before), `at ${size}: the same field, the same places`);
  for (const size of [100, 150]) {
    // A bigger field (its trees elsewhere): the same places around the hero, but for a few a tree nudged.
    const now = at(size);
    const moved = now.filter(([x, y], i) => Math.hypot(x - before[i][0], y - before[i][1]) > 1).length;
    assert.equal(now.length, before.length);
    assert.ok(moved <= 2, `at ${size}: ${moved} of ${now.length} stand elsewhere`);
  }
});

test('a big company forms a wide line inside the field, and fills its share of a 150 battle', () => {
  const { CL } = loadGame({ random: mulberry(3) });
  CL.combat.setActiveCap(150);
  company(CL, 120);
  CL.combat.startBattle(band(75, 'reaver'));
  const g = CL.game;
  const b = g.battleMap.bounds;
  assert.equal(g.battleMap.width, Math.round(CL.W * Math.round(3 * CL.arena.growth(150) * 100) / 100), 'the field grown for 150');
  assert.ok(g.battleMap.width > 2880);
  assert.equal(1 + g.allies.length, 75, 'the hero and 74 on the field');
  assert.equal(g.allyReserve.length, 120 - 74);
  assert.equal(g.enemies.length, 75);
  assert.ok(g.allies.every((a) => a.x >= b.minX && a.x <= b.maxX && a.y >= b.minY && a.y <= b.maxY), 'inside the field');
  const foot = g.allies.filter((a) => a.role === 'infantry');
  const ys = foot.map((a) => a.y);
  const xs = foot.map((a) => a.x);
  assert.ok(Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs), 'the foot stand in a line, wider than deep');
  const spots = new Set(g.allies.map((a) => `${Math.round(a.x)},${Math.round(a.y)}`));
  assert.equal(spots.size, g.allies.length, 'nobody starts on another’s spot');
});

test('the large field grows with the size above 80; the small field and the courtyard do not', () => {
  const { CL } = loadGame();
  const S = CL.settings;
  S.load();
  CL.combat.setActiveCap(80);
  const m80 = CL.arena.mapFor('open_country');
  assert.equal(m80.width, 2880, 'as before');
  CL.combat.setActiveCap(40);
  assert.equal(CL.arena.mapFor('open_country'), m80, 'the same map at 40 and 80');
  CL.combat.setActiveCap(150);
  const m150 = CL.arena.mapFor('open_country');
  assert.deepEqual([m150.width, m150.height], [3552, 1998]);
  CL.combat.setActiveCap(200);
  assert.equal(CL.arena.mapFor('open_country').width, 4032, '4.2 screens at 200');
  CL.combat.setActiveCap(150);
  assert.equal(CL.arena.mapFor('open_country'), m150, 'built once a size');
  assert.equal(CL.arena.mapFor('greywall_courtyard').width, CL.content.get('battle_maps', 'greywall_courtyard').width);
  S.set('battlefield', 'small');
  assert.equal(CL.arena.mapFor('open_country').id, 'grass_field');
});

test('the benchmark battle at every size runs, keeps its field full, and nobody is stuck', () => {
  for (const size of SIZES) {
    const r = bench(size, 'open_country', 6);
    assert.equal(r.deployed, size, `${size}: the field full from the start`);
    assert.ok(r.onField > size * 0.85, `${size}: reserves keep it full (${r.onField.toFixed(0)} on average)`);
    assert.equal(r.stuck, 0, `${size}: nobody stands idle far from the fight`);
    assert.equal(r.ended, false, `${size}: still fighting after 6 s`);
    // The simulation alone, on this machine; generous, because the fast tests run side by side.
    assert.ok(r.mean < 25, `${size}: ${r.mean.toFixed(2)} ms a frame on average`);
  }
});

/** A plain battle at `size`: half yours, half theirs, no reserves, played to its end. */
function fightOut(size, seed, { mine = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard'], theirs = 'looter' } = {}) {
  const { CL } = loadGame({ random: mulberry(seed) });
  CL.combat.setActiveCap(size);
  const share = Math.floor(size / 2);
  company(CL, share - 1, mine);
  CL.combat.startBattle({ ...band(size - share, theirs), mapDef: CL.arena.build(CL.content.get('battle_maps', 'open_country'), size) });
  const g = CL.game;
  Object.assign(g, { hold: {}, joystick: { x: 0, y: 0 } });
  let t = 0;
  while (g.mode === 'battle' && t < 400) {
    CL.combat.update(0.05);
    t += 0.05;
  }
  const lost = g.allies.filter((a) => a.soldierId != null && !a.alive).length / (share - 1);
  return { ended: g.mode !== 'battle', win: g.result?.win, t, lost };
}

test('battles of 100 and 150 end, by the same rules as at 40: the stronger side wins at every size', () => {
  for (const size of [40, 100, 150]) {
    const strong = fightOut(size, size, { theirs: 'looter' });
    assert.ok(strong.ended, `${size}: ended (after ${strong.t.toFixed(0)} s)`);
    assert.equal(strong.win, true, `${size}: a trained company beats as many looters`);
    const weak = fightOut(size, size + 1, { mine: ['levy', 'recruit'], theirs: 'reaver' });
    assert.ok(weak.ended, `${size}: ended (after ${weak.t.toFixed(0)} s)`);
    assert.equal(weak.win, false, `${size}: levies lose to as many Reavers`);
  }
});
