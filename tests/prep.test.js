// Battle preparation (V2-07; design §7, SC-06, SC-07, SC-36): presets that work without thought,
// Custom placement inside a legal zone, a smaller zone when ambushed, Simulate with its reasons, and a
// remembered setup that can skip the screen. None of it is required.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');


/** A Reaver band beside the player on open grass, its encounter open, with a mixed company. */
function band({ caught = false, opts = {} } = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['footman', 'footman', 'footman', 'footman', 'hunter', 'hunter', 'hunter', 'rider', 'rider']) CL.save.addSoldier(c, t);
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 4, reaver: 2 }, tx: null, ty: null });
  CL.parties.open(p.id, { caught });
  const map = CL.arena.mapFor(CL.parties.current().def.map);
  return { ...env, c, p, map };
}

const centre = (units) => ({ x: units.reduce((n, u) => n + u.x, 0) / units.length, y: units.reduce((n, u) => n + u.y, 0) / units.length });

test('SC-06: Balanced in two taps: infantry in front, archers behind, cavalry on a flank, useful orders', () => {
  const { CL, map } = band();
  const plan = CL.prep.plan('balanced', map); // Attack → (Balanced is preselected) → Fight
  CL.parties.attack(plan);
  const g = CL.game;
  assert.equal(g.mode, 'battle');
  const hero = CL.prep.anchorOf(map);
  const by = (role) => g.allies.filter((u) => u.role === role);
  assert.ok(centre(by('infantry')).x > hero.x, 'infantry in front of the hero');
  assert.ok(centre(by('archer')).x < hero.x, 'archers behind');
  assert.ok(centre(by('cavalry')).y < hero.y - 100, 'cavalry out on a flank');
  const { infantry, archer, cavalry } = g.orders; // the three divisions this company has (P9-B4: six slots)
  assert.deepEqual({ infantry, archer, cavalry }, { infantry: 'follow', archer: 'follow', cavalry: 'hold' }, 'foot and archers go with the hero (V2-T2); the horse waits on the flank (P11-14)');
  assert.equal(g.formation, 'loose', 'P11-14: loose ranks in front of the archers (a line was tried: it cost the big battles)');
  assert.equal(JSON.stringify(g.timed.map((t) => [t.div, t.kind, t.volley, t.at])), JSON.stringify([['cavalry', 'charge', -1, CL.prep.AUTO.cavalryBy]]), 'the horse goes in on the first volley, or after a few seconds');
  for (const u of g.allies) assert.equal(CL.units.blocked(u.x, u.y), false, `${u.troop} placed clear`);
  const z = CL.prep.zone(map);
  for (const u of g.allies) assert.ok(u.x >= z.x0 - 70 && u.x <= z.x1 && u.y >= z.y0 - 70 && u.y <= z.y1 + 70, 'inside the deployment zone (ranks may step back a little)');
});

test('the presets differ: Defensive holds tight, Aggressive goes forward and charges', () => {
  const { CL, map } = band();
  const d = CL.prep.plan('defensive', map);
  const a = CL.prep.plan('aggressive', map);
  const roles = (o) => ({ infantry: o.infantry, archer: o.archer, cavalry: o.cavalry }); // P9-B4: the second divisions follow their first
  assert.deepEqual(roles(d.orders), { infantry: 'hold', archer: 'hold', cavalry: 'hold' });
  assert.deepEqual(roles(a.orders), { infantry: 'charge', archer: 'follow', cavalry: 'charge' });
  assert.equal(d.orders.infantry2, 'hold');
  assert.ok(a.anchors.infantry.x > d.anchors.infantry.x + 100, 'aggressive infantry starts further forward');
  assert.equal(CL.prep.plan('nonsense', map).preset, 'balanced');
});

test('Custom: flags dragged on the preview land inside the zone and clear of trees; orders per group', () => {
  const { CL, map } = band();
  const plan = CL.prep.plan('balanced', map);
  const r = CL.prep.previewRect(map);
  const hero = CL.prep.anchorOf(map);
  const s = CL.tactics.toScreen(r, hero.x - 200, hero.y + 150);
  const at = CL.prep.moveFlag(plan, map, 'archer', s.x, s.y);
  assert.equal(plan.preset, 'custom');
  assert.ok(Math.hypot(at.x - (hero.x - 200), at.y - (hero.y + 150)) < 60, 'where it was dropped');
  // Dragged deep into enemy ground: stopped at the zone's edge.
  const far = CL.tactics.toScreen(r, map.width - 100, hero.y);
  const z = CL.prep.zone(map);
  assert.ok(CL.prep.moveFlag(plan, map, 'cavalry', far.x, far.y).x <= z.x1);
  assert.equal(CL.prep.setOrder(plan, 'archer', 'charge'), true);
  assert.equal(CL.prep.setOrder(plan, 'archer', 'dance'), false);
  CL.parties.attack(plan);
  const archers = CL.game.allies.filter((u) => u.role === 'archer');
  assert.ok(Math.hypot(centre(archers).x - at.x, centre(archers).y - at.y) < 40);
  assert.equal(CL.game.orders.archer, 'charge');
  // Picking the flag up: a tap near it finds it, a tap far away does not.
  const fp = CL.tactics.toScreen(r, plan.anchors.infantry.x, plan.anchors.infantry.y);
  assert.equal(CL.prep.flagAt(plan, map, CL.prep.GROUPS, fp.x + 5, fp.y - 5), 'infantry');
  assert.equal(CL.prep.flagAt(plan, map, CL.prep.GROUPS, fp.x + 200, fp.y), null);
});

test('an ambush (they caught you) gives a much smaller zone; attacking them gives the full one', () => {
  const { CL, map } = band({ caught: true });
  const small = CL.prep.zone(map, true);
  const full = CL.prep.zone(map, false);
  assert.ok((small.x1 - small.x0) * (small.y1 - small.y0) < 0.3 * (full.x1 - full.x0) * (full.y1 - full.y0));
  assert.equal(CL.game.caught, true);
  const p = CL.prep.plan('aggressive', map, { ambush: true });
  for (const a of Object.values(p.anchors)) assert.ok(a.x >= small.x0 && a.x <= small.x1 && a.y >= small.y0 && a.y <= small.y1);
  const mine = band();
  assert.equal(mine.CL.game.caught, false, 'riding at them is no ambush');
});

test('remember and skip: the setup is kept on the device and used straight away next time', () => {
  const storage = memoryStorage();
  const { CL, map } = band({ opts: { storage } });
  const plan = CL.prep.plan('balanced', map);
  const r = CL.prep.previewRect(map);
  const hero = CL.prep.anchorOf(map);
  const s = CL.tactics.toScreen(r, hero.x - 150, hero.y + 200);
  CL.prep.moveFlag(plan, map, 'infantry', s.x, s.y);
  CL.prep.setOrder(plan, 'cavalry', 'charge');
  CL.prep.remember(plan, map, true);
  assert.equal(CL.settings.get('prepSkip'), true);
  assert.equal(CL.settings.get('prepPreset'), 'custom');
  // Another session, another map: the same layout relative to the hero's start.
  const next = loadGame({ storage });
  next.CL.settings.load(); // the game reads its device settings at boot
  const small = next.CL.content.get('battle_maps', 'grass_field');
  const again = next.CL.prep.remembered(small);
  assert.equal(again.preset, 'custom');
  assert.equal(again.orders.cavalry, 'charge');
  const off = { x: again.anchors.infantry.x - small.spawn.hero.x, y: again.anchors.infantry.y - small.spawn.hero.y };
  assert.ok(Math.abs(off.x - (plan.anchors.infantry.x - hero.x)) < 40, 'same place relative to the hero');
  // Garbage in the stored setup falls back to nothing (Balanced positions).
  assert.equal(next.CL.settings.set('prepCustom', { infantry: { dx: 'far' } }), false);
});

test('SC-07: a reload during preparation loses nothing: the encounter is still open and costs nothing', () => {
  const storage = memoryStorage();
  const { CL, c } = band({ opts: { storage } });
  CL.save.write();
  const before = { day: c.day, next: c.nextResultId, gold: c.gold };
  CL.game.prep = { plan: CL.prep.plan('defensive', CL.arena.mapFor('open_country')) }; // on the screen, then the page closes
  const saved = JSON.parse(storage.data[CL.save.KEY]); // what a reload reads
  assert.deepEqual({ day: saved.day, next: saved.nextResultId, gold: saved.gold }, before);
  assert.ok(saved.parties.some((x) => x.template === 'bandits'), 'the band is still there to fight');
  assert.equal(loadGame({ storage }).CL.campaign.nextResultId, before.next, 'no result was committed');
});

test('Simulate explains the odds: each side part by part, from before the fight', () => {
  const { CL, c, p } = band();
  const lines = CL.autoresolve.explain(c, p.troops);
  assert.match(lines[0], /^Your side [\d.]+: your hero [\d.]+, 7 T2 soldiers 17\.9, 2 T3 soldiers 7\.5\. Soldiers count half as much again for fighting in ranks\.$/);
  assert.match(lines.join(' '), /Their side [\d.]+: 4 Looters, 2 Reavers\./);
  assert.match(lines.at(-1), /^Odds \d+%/);
  const r = CL.parties.autoResolve();
  assert.match(r.html, /Your side .*Their side .*Odds/s);
});

test('practice and debug battles ignore any plan', () => {
  const { CL, map } = band();
  CL.debugTools.cameraTest(30);
  // A practice battle restarted with a plan: the plan is ignored (no setup is recorded).
  CL.combat.startBattle({ ...CL.game.encounterDef }, { plan: CL.prep.plan('aggressive', map) });
  assert.equal(CL.game.prepPlan, undefined);
  CL.combat.setActiveCap(40);
});

/** A bot hero for whole battles (as in the battle-map tests). */
function fight(CL, maxSeconds = 200) {
  const g = CL.game;
  let steps = 0;
  while (g.mode === 'battle' && steps < maxSeconds * 50) {
    const h = g.hero;
    const e = g.enemies.filter((x) => x.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (e && h.alive) {
      const [dx, dy] = [e.x - h.x, e.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = L > 45 || !CL.units.inArc(h, e, CL.units.ARC.attack) ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70;
    }
    CL.combat.update(0.02);
    steps++;
  }
  return g.mode !== 'battle' && g.result?.win;
}

test('SC-36: ten ordinary fights on the default setup, never opening tactics: they are won', () => {
  let wins = 0;
  for (let k = 0; k < 10; k++) {
    let s = k * 7919 + 13;
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    const { CL, map } = band({ opts: { random: rand } });
    CL.parties.attack(CL.prep.remembered(map)); // Attack, Fight: Balanced
    if (fight(CL)) wins++;
  }
  assert.ok(wins >= 8, `${wins}/10 won`);
});

test('P11-14: the setups choose from what is seen of the foe: Defensive a square against horse, else a wall; Aggressive a wedge; Balanced a line with its horse held for the volley', () => {
  const { CL, map, p } = band();
  const P = CL.prep;
  assert.deepEqual({ ...P.choose('defensive', { horse: 0.4 }) }, { formation: 'square', cavalryWaits: false });
  assert.deepEqual({ ...P.choose('defensive', { horse: 0.1 }) }, { formation: 'wall', cavalryWaits: false });
  assert.deepEqual({ ...P.choose('aggressive', { horse: 0.5 }) }, { formation: 'wedge', cavalryWaits: false });
  assert.deepEqual({ ...P.choose('balanced', { horse: 0 }) }, { formation: 'loose', cavalryWaits: true });
  // What is seen: the band on the map.
  p.troops = { rider: 6, looter: 4 }; // the band on the map (parties.current reads it)
  assert.equal(P.seenFoe().horse, 0.6);
  assert.equal(P.plan('defensive', map).formation, 'square', 'riders seen: a square');
  p.troops = { looter: 10 };
  assert.equal(P.plan('defensive', map).formation, 'wall');
  assert.equal(P.plan('aggressive', map).formation, 'wedge');
  assert.equal(P.plan('custom', map).formation, 'loose', 'Custom is yours');
  assert.equal(P.plan('custom', map).timed.length, 0);
  // Auto picks the setup from the odds, then the same choices.
  const auto = P.plan('auto', map);
  assert.equal(auto.formation, P.choose(auto.auto, P.seenFoe()).formation);
});

// ---- P11-15: what Prepare tells you (only what the company knows) ----

test('P11-15: the foe as known: seen on the map gives about how many and by role; a scout names the weapons', () => {
  const { CL, c, p } = band();
  Object.assign(p, { troops: { reaver: 10, looter: 6, outlaw_huntress: 4 } });
  const seen = CL.prep.known(c, CL.parties.current());
  assert.equal(seen.level, 'seen');
  assert.equal(seen.words, 'about 20, mostly foot and some archers', 'no weapons without a scout');
  assert.equal(seen.bows, null, 'archers among foot are not counted without a scout');
  c.followers.scout = { name: 'Odo', culture: 'valedorn', origin: null, hired: 0, unpaid: 0, log: [] };
  const scouted = CL.prep.known(c, CL.parties.current());
  assert.equal(scouted.level, 'scout');
  assert.equal(scouted.words, 'about 20, mostly axes, some maces and some bows');
  assert.ok(Math.abs(scouted.bows - 0.2) < 1e-9);
  assert.doesNotMatch(scouted.words, /\b(10|6|4)\b/, 'never the exact numbers');
});

test('P11-15: the foe unknown: a lair, a band that bursts from cover, or one that caught you unseen', () => {
  const { CL, c, p } = band({ caught: true });
  const old = CL.sight.playerSees;
  CL.sight.playerSees = () => false; // caught unseen (at night, from the trees)
  assert.equal(CL.prep.known(c, CL.parties.current(), { ambush: true }).level, 'unknown');
  CL.sight.playerSees = old;
  assert.equal(CL.prep.known(c, CL.parties.current(), { ambush: true }).level, 'seen', 'caught by a band in sight: you see them');
  p.ambush = true;
  assert.equal(CL.prep.known(c, CL.parties.current()).words, 'unknown', 'Reavers bursting from cover');
  const site = { kind: 'site', name: 'Looter Camp', troops: { looter: 8 } };
  assert.equal(CL.prep.known(c, site).level, 'unknown', 'what waits in a lair');
  c.followers.scout = { name: 'Odo', culture: 'valedorn', origin: null, hired: 0, unpaid: 0, log: [] };
  assert.equal(CL.prep.known(c, site).words, 'about 8, all maces', 'a scout looks inside');
  assert.equal(CL.prep.against('defensive', { level: 'unknown', horse: null, bows: null }), '', 'nothing said against a foe nothing is known of');
});

test('P11-15: make-up words: mostly, some, a few; riders by name', () => {
  const { CL } = band();
  assert.equal(CL.prep.makeUp({ spearman: 20, crossbowman: 8, rider: 2 }), 'mostly spears, some crossbows and a few riders');
  assert.equal(CL.prep.makeUp({ reaver: 4, looter: 4, hunter: 1 }), 'axes, maces and a few bows');
  assert.equal(CL.prep.makeUp({ rider: 5 }), 'all riders');
  assert.equal(CL.prep.makeUp({}), '');
});

test('P11-15: the field in words: a rise, a ford, trees, open ground, the walls', () => {
  const { CL } = band();
  const notes = (id) => CL.prep.terrainNotes(CL.arena.mapFor(id)).join(' ');
  assert.match(notes('hill_slopes'), /shoot a quarter further/);
  assert.match(notes('river_ford'), /ford between you/);
  assert.match(notes('forest_wilds'), /trees/i);
  assert.match(notes('open_country'), /Open ground/);
  const hills = CL.arena.mapFor('hill_slopes');
  assert.match(CL.prep.terrainNotes(hills, CL.prep.plan('balanced', hills)).join(' '), /your archers start on it/);
});

test('P11-15: the setups against this enemy: a square against riders, a wall under shots', () => {
  const { CL } = band();
  const foe = (horse, bows) => ({ level: 'scout', horse, bows });
  assert.match(CL.prep.against('defensive', foe(0.4, 0)), /square/);
  assert.match(CL.prep.against('defensive', foe(0, 0.4)), /shield wall takes the arrows/);
  assert.match(CL.prep.against('aggressive', foe(0.4, 0)), /no spears braced/);
  assert.match(CL.prep.against('balanced', foe(0, 0.4), { cavalry: 2 }), /ride down their archers/);
  assert.equal(CL.prep.against('balanced', foe(0, 0), { cavalry: 0 }), '');
});

test('P11-15: the loadout chosen on Prepare is remembered for that kind of field, and used with no time to prepare', () => {
  const { CL, c, map } = band();
  c.equipment.weapon2 = 'short_bow';
  assert.equal(CL.prep.kindOf(map), map.id);
  assert.ok(CL.prep.chooseLoadout(c, map, 'secondary'));
  assert.equal(c.loadout.start, 'secondary');
  assert.equal(c.loadout.last[map.id], 'secondary');
  c.loadout.start = 'primary'; // chosen elsewhere since
  CL.parties.attack(); // a failed retreat: straight in, no Prepare
  assert.equal(c.loadout.start, 'secondary', 'the field’s remembered loadout');
  assert.equal(CL.game.loadout.which, 'secondary');
  const other = CL.arena.mapFor('river_ford');
  c.loadout.start = 'primary';
  CL.prep.useRemembered(c, other);
  assert.equal(c.loadout.start, 'primary', 'another kind of field keeps the default');
  c.equipment.weapon2 = null;
  CL.prep.useRemembered(c, map);
  assert.equal(c.loadout.start, 'primary', 'a remembered second weapon no longer carried is not used');
  assert.equal(CL.prep.chooseLoadout(c, map, 'secondary'), false);
  assert.equal(JSON.stringify(CL.gear.sanitize(JSON.parse(JSON.stringify(c.loadout)))), JSON.stringify(c.loadout), 'the saved shape is P11-02’s');
});
