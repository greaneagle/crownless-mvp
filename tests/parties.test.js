// World parties, auto-resolve and encounter choices (GDD §7–8; Gate C step 6).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const kinds = (CL) => CL.campaign.parties.map((p) => CL.content.get('party_templates', p.template).kind);
const count = (list, k) => list.filter((x) => x === k).length;

/** Put a band right next to the player on open ground and make it notice them. */
function ambushSetup(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 }); // open grass, north-east
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 5, reaver: 2 }, tx: null, ty: null });
  CL.game.partyId = p.id;
  CL.game.siteId = null;
  return { ...env, p };
}

test('a new world has its bands, patrols by holdings and caravans (W-05b)', () => {
  const { CL } = loadGame({ worldParties: true });
  const k = kinds(CL);
  const want = (kind) => Object.values(CL.content.table('party_templates')).filter((t) => t.kind === kind).reduce((n, t) => n + t.count, 0);
  assert.equal(count(k, 'bandit'), want('bandit'));
  assert.equal(count(k, 'patrol'), want('patrol'));
  assert.equal(count(k, 'caravan'), want('caravan'));
  assert.deepEqual([want('bandit'), want('patrol'), want('caravan')], [11, 13, 5]);
  for (const p of CL.campaign.parties) {
    const t = CL.content.get('party_templates', p.template);
    for (const [id, n] of Object.entries(p.troops)) {
      const [lo, hi] = t.troops[id];
      assert.ok(n >= Math.max(1, lo) && n <= hi, `${t.id} ${id}=${n}`);
    }
  }
});

test('the seeded RNG makes worlds reproducible', () => {
  const a = loadGame({ worldParties: true, seed: 777 }).CL.campaign.parties;
  const b = loadGame({ worldParties: true, seed: 777 }).CL.campaign.parties;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = loadGame({ worldParties: true, seed: 778 }).CL.campaign.parties;
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test('GDD §7 power: tier powers, the hero (from real stats), and Tactics', () => {
  const { CL } = loadGame(); // fixture: Farmhand + 3 levies (T1) + 2 hunters (T2)
  const A = CL.autoresolve;
  assert.ok(Math.abs(A.troopsPower({ looter: 3, reaver: 2 }) - (3 + 2 * 1.7)) < 1e-9);
  const hero = ((90 * 17 * 1.03) / (45 * 7)) * 1.5; // HP 90, damage 17×1.03, shield
  assert.ok(Math.abs(A.heroPower() - hero) < 1e-9);
  const k = A.COMPANY_FACTOR; // the company's soldiers fight in ranks (V2-T2)
  assert.equal(k, 1.5);
  assert.ok(Math.abs(A.playerPower() - (hero + (3 + 3.4) * k)) < 1e-9);
  CL.campaign.roster[0].woundedUntil = 5;
  assert.ok(Math.abs(A.playerPower() - (hero + (2 + 3.4) * k)) < 1e-9, 'wounded do not fight');
  CL.character.unequip('offhand');
  assert.ok(Math.abs(A.heroPower() - hero / 1.5) < 1e-9, 'no shield, less power');
  CL.character.equip('oak_shield');
  CL.campaign.character.skills.tactics = 10;
  assert.ok(Math.abs(A.playerPower() - (hero + (2 + 3.4) * k) * 1.3) < 1e-9);
  assert.equal(A.winChance(1, 100), 0.1);
  assert.equal(A.winChance(100, 1), 0.9);
  assert.equal(A.winChance(5, 5), 0.5);
});

test('off-screen fights: the loser is destroyed and the winner always takes losses', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  for (let i = 0; i < 20; i++) {
    const a = { troops: { footman: 4, hunter: 3 } };
    const b = { troops: { looter: 3 } };
    const r = CL.autoresolve.resolveParties(c, a, b);
    assert.ok(r.winnerLosses >= 1);
  }
});

test('a winner left with no troops is removed too (no empty parties on the map)', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const caravan = CL.parties.spawn(c, 'valedorn_caravan');
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(caravan, { x: 30, y: 30, troops: { levy: 1 } });
  Object.assign(band, { x: 30, y: 30, troops: { looter: 1 } });
  c.world.location = 'stonebridge';
  CL.parties.tick(c, 0.25);
  assert.ok(c.parties.every((p) => CL.parties.troopCount(p) > 0), 'no empty party left behind');
  assert.ok(!c.parties.includes(caravan) || !c.parties.includes(band), 'one side lost');
});

test('caravans deliver goods (cheaper at the destination); robbed caravans make them scarcer', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.food = 999;
  const car = CL.parties.spawn(c, 'valedorn_caravan');
  const t = CL.content.get('party_templates', 'valedorn_caravan');
  const dest = t.route[(car.routeIndex + 1) % t.route.length];
  const good = car.good;
  const before = c.markets[dest][good];
  for (let i = 0; i < 200 && car.routeIndex !== t.route.indexOf(dest); i++) CL.parties.tick(c, 0.5);
  assert.ok(c.markets[dest][good] < before, `${dest} ${good}: ${before} → ${c.markets[dest][good]}`);

  // Now a band intercepts the next leg.
  const next = t.route[(car.routeIndex + 1) % t.route.length];
  const g2 = car.good;
  c.markets[next][g2] = 1.0;
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: car.x, y: car.y, troops: { reaver: 9 } });
  CL.parties.tick(c, 0.25);
  assert.equal(c.parties.includes(car), false, 'caravan robbed');
  assert.ok(c.markets[next][g2] > 1.0);
});

test('bands hunt a weak player on the open map and catch them', () => {
  const { CL, p } = ambushSetup();
  CL.campaign.roster = []; // a lone hero is easy prey
  CL.game.mode = 'map';
  assert.equal(CL.parties.wantsPlayer(CL.campaign, p), true);
  const id = CL.parties.tick(CL.campaign, 0.5);
  assert.equal(id, p.id);
  assert.equal(CL.game.contactParty, p.id);
});

test('bands leave strong parties, players inside settlements, and recently escaped players alone', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  CL.game.mode = 'map';
  for (let i = 0; i < 20; i++) CL.save.addSoldier(c, 'guard');
  assert.equal(CL.parties.wantsPlayer(c, p), false, 'too strong');
  c.roster = [];
  c.world.location = 'stonebridge';
  assert.equal(CL.parties.wantsPlayer(c, p), false, 'safe in town');
  c.world.location = null;
  p.ignoreUntil = c.day + 1;
  assert.equal(CL.parties.wantsPlayer(c, p), false, 'cooldown');
});

test('an ambush interrupts travel and opens the encounter', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  c.roster = [];
  CL.game.partyId = null;
  CL.game.mode = 'map';
  CL.world.click(...CL.world.toPx(90, 20));
  for (let t = 0; t < 30 && CL.game.mode === 'map'; t += 0.05) CL.world.update(0.05);
  assert.equal(CL.game.mode, 'encounter');
  assert.equal(CL.game.partyId, p.id);
  assert.equal(CL.game.travel, null);
});

test('negotiate: pay the toll, or intimidate a much weaker band', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  const e = CL.parties.current();
  const n = CL.parties.negotiation(c, e);
  assert.equal(n.kind, 'toll');
  assert.equal(n.cost, 20 + 4 * 7);
  const gold = c.gold;
  assert.equal(CL.parties.negotiate(), true);
  assert.equal(c.gold, gold - 48);
  assert.ok(p.ignoreUntil > c.day);
  assert.equal(CL.game.mode, 'map');

  p.troops = { looter: 1 };
  CL.game.partyId = p.id;
  assert.equal(CL.parties.negotiation(c, CL.parties.current()).kind, 'intimidate');
  const g2 = c.gold;
  CL.parties.negotiate();
  assert.equal(c.gold, g2, 'free');
});

test('retreat odds follow the GDD speed formula', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  const e = CL.parties.current();
  // Open grass: player 4.0 vs band 3.8.
  assert.ok(Math.abs(CL.parties.retreatChance(c, e) - 0.52) < 1e-9);
  c.cargo = { tools: 23 }; // 69/70 weight: heavily laden
  assert.ok(CL.parties.retreatChance(c, e) < 0.45);
  Object.assign(p, { x: 70, y: 80 }); // band in the forest (slow)
  c.cargo = {};
  assert.ok(Math.abs(CL.parties.retreatChance(c, CL.parties.current()) - (0.5 + 0.1 * (4 - 3.8 * 0.75))) < 1e-9);
});

test('a failed retreat forces the battle against exactly that band', () => {
  const { CL, p } = ambushSetup();
  CL.campaign.rngSeed = 1;
  // Find a seed whose first roll fails a 52% retreat.
  let seed = 1;
  for (; seed < 500; seed++) {
    CL.campaign.rngSeed = seed;
    if (CL.autoresolve.next(CL.campaign) >= 0.52) break;
  }
  CL.campaign.rngSeed = seed;
  assert.equal(CL.parties.retreat(), false);
  assert.equal(CL.game.mode, 'battle');
  const looters = CL.game.enemies.filter((x) => x.troop === 'looter').length;
  const reavers = CL.game.enemies.filter((x) => x.troop === 'reaver').length;
  assert.deepEqual([looters, reavers], [p.troops.looter, p.troops.reaver]);
});

test('bands larger than 8 fight in waves of up to 8', () => {
  const { CL } = loadGame();
  const t = CL.content.get('party_templates', 'bandits');
  const def = CL.parties.battleDef(t, { looter: 7, reaver: 4 });
  assert.equal(def.waves.length, 2);
  const size = (w) => Object.values(w).reduce((a, b) => a + b, 0);
  assert.deepEqual(Array.from(def.waves, size), [8, 3]);
});

test('auto-resolve win: band destroyed, reward paid, someone always falls, exactly once', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  for (let i = 0; i < 6; i++) CL.save.addSoldier(c, 'footman');
  // Find a seed that wins.
  let seed = 1;
  for (; seed < 500; seed++) {
    c.rngSeed = seed;
    const pp = CL.autoresolve.playerPower(c);
    const pe = CL.autoresolve.troopsPower(p.troops);
    if (CL.autoresolve.next(c) < CL.autoresolve.winChance(pp, pe)) break;
  }
  c.rngSeed = seed;
  const soldiers = c.roster.length;
  const wounded = CL.party.woundedSoldiers().length;
  const r = CL.parties.autoResolve();
  assert.equal(r.win, true);
  assert.equal(c.parties.includes(p), false);
  assert.equal(c.victories, 1);
  assert.ok(r.gold >= 15);
  const lost = soldiers - c.roster.length + (CL.party.woundedSoldiers().length - wounded);
  assert.ok(lost >= 1, 'never a zero-casualty victory');
  assert.equal(CL.game.mode, 'result');
  assert.match(r.html, /Auto-resolved/);
  assert.equal(CL.party.applyBattleResult(c, { battleId: CL.game.battleId, encounter: CL.parties.battleDef(CL.content.get('party_templates', 'bandits'), { looter: 1 }), win: true, kills: 0, killed: [], wounded: [] }), null);
});

test('auto-resolve loss: captured and released; the band survives, weakened', () => {
  const { CL, p } = ambushSetup();
  const c = CL.campaign;
  c.roster = [];
  p.troops = { reaver: 20 };
  let seed = 1;
  for (; seed < 500; seed++) {
    c.rngSeed = seed;
    if (CL.autoresolve.next(c) >= 0.1) break; // lone hero vs 20 reavers: 10% to win
  }
  c.rngSeed = seed;
  const r = CL.parties.autoResolve();
  assert.equal(r.win, false);
  assert.ok(c.parties.includes(p));
  assert.ok(CL.parties.troopCount(p) < 20);
  assert.ok(p.ignoreUntil > c.day - 1);
  assert.ok(CL.game.releasedAt);
});

test('lair sites offer auto-resolve too', () => {
  const { CL } = loadGame();
  CL.game.siteId = 'looter_camp';
  CL.game.partyId = null;
  const e = CL.parties.current();
  assert.equal(e.kind, 'site');
  assert.deepEqual({ ...e.troops }, { looter: 7 });
  assert.equal(CL.parties.retreatChance(CL.campaign, e), null);
  const r = CL.parties.autoResolve();
  assert.equal(typeof r.win, 'boolean');
  if (r.win) assert.ok(CL.campaign.world.sites.looter_camp.clearedUntil > CL.campaign.day);
});

test('winning a real battle against a band removes it', () => {
  const { CL, p } = ambushSetup();
  CL.parties.attack();
  assert.equal(CL.game.mode, 'battle');
  CL.debugTools.endBattleNow(true);
  assert.equal(CL.campaign.parties.includes(p), false);
});

test('saved parties are validated; older saves get a populated world', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({
    version: 2,
    roster: [],
    rngSeed: 42,
    parties: [
      { id: 3, template: 'bandits', x: 50, y: 60, troops: { looter: 4, dragon: 2 }, lair: 'nowhere' },
      { id: 4, template: 'ghosts', x: 1, y: 1, troops: { looter: 1 } },
      { id: 5, template: 'valedorn_caravan', x: 300, y: 10, troops: { levy: 0 } },
      { id: 6, template: 'aurelian_caravan', x: 300, y: -10, troops: { recruit: 2 }, routeIndex: 9, good: 'gold' },
    ],
  });
  assert.equal(s.rngSeed, 42);
  assert.deepEqual(
    Array.from(s.parties, (p) => p.id),
    [3, 6],
  );
  assert.deepEqual({ ...s.parties[0].troops }, { looter: 4 });
  assert.equal(s.parties[0].lair, 'looter_camp');
  assert.deepEqual([s.parties[1].x, s.parties[1].y, s.parties[1].routeIndex, s.parties[1].good], [200, 0, 3, 'salt']);
  assert.equal(s.nextPartyId, 7);
  const old = CL.save.sanitize({ version: 2, roster: [] });
  assert.equal(old.parties.length, 29); // W-05b: 11 bands, 13 patrols, 5 caravans
});

test('waiting on the map passes time', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.food = 100;
  CL.world.leaveSettlement();
  CL.world.toggleWait();
  for (let i = 0; i < 60; i++) CL.world.update(0.05);
  assert.ok(Math.abs(c.day * 24 - 60 * 0.05 * CL.world.HOURS_PER_SECOND) < 1e-6);
  CL.world.toggleWait();
  CL.world.update(0.05);
  assert.ok(Math.abs(c.day * 24 - 12) < 1e-6, 'stopped');
});
