// The troop tree, discovered as you play, and "Upgrade all ready" (V2-03b; settles finding F-1:
// Mercenaries with 285/100 XP and no way to spend it).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');
const { preHoldings } = require('./helpers/pre-holdings');

/** Game values come from the test sandbox's realm; compare them as plain JSON. */
const plain = (x) => JSON.parse(JSON.stringify(x));

// ---- F-1 ----

test('F-1: every troop either has a path or is at max tier, and the Mercenary now trains into a Sellsword', () => {
  const { CL } = loadGame();
  const troops = Object.keys(CL.content.table('troops')).filter((id) => id !== 'hero');
  for (const id of troops) {
    const paths = CL.party.upgradeOptions(id).length;
    assert.ok(paths > 0 || CL.troopTree.maxTier(id), id);
    assert.equal(CL.troopTree.maxTier(id), paths === 0, id);
  }
  assert.deepEqual(plain(CL.party.upgradeOptions('mercenary').map((o) => [o.to, o.cost, o.xp])), [['sellsword', 60, 100]]);
  const s = CL.content.troop('sellsword');
  assert.deepEqual([s.faction, s.tier, s.role], ['neutral', 'T3', 'infantry']);
  assert.ok(!CL.content.table('factions').neutral.recruits.includes('sellsword'), 'trained, never hired');
});

test('F-1: a soldier at max tier is never "ready", however much XP they have, and keeps earning it', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const g = CL.save.addSoldier(c, 'guard');
  g.xp = 285;
  assert.equal(CL.party.readyFor(g), false);
  assert.deepEqual(plain(CL.party.soldierUpgrades(g, c)), []);
  assert.equal(CL.soldiers.list(c, 'ready').includes(g), false);
  const m = CL.save.addSoldier(c, 'mercenary');
  m.xp = 285; // the soldiers from the playtest: now they have somewhere to go
  c.gold = 100;
  assert.equal(CL.party.readyFor(m), true);
  assert.equal(CL.party.upgradeSoldier(c, m.id, 'sellsword'), true);
  assert.deepEqual([m.troop, m.xp, c.gold], ['sellsword', 185, 40]);
});

// ---- Upgrade all ready ----

test('Upgrade all ready: mixed ready, wounded, unaffordable, not ready and max tier', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.roster = [];
  const add = (troop, xp, wounded = null) => Object.assign(CL.save.addSoldier(c, troop), { xp, woundedUntil: wounded });
  const a = add('levy', 40); // ready → Footman, 25
  const b = add('mercenary', 285); // ready → Sellsword, 60
  const w = add('levy', 90, 3); // ready but wounded: waits
  const d = add('hunter', 100); // ready → Longbowman, 60, but the money runs out first
  const n = add('levy', 10); // not ready
  const top = add('guard', 999); // max tier
  c.gold = 100; // enough for the first two (85), not the third (60 more)
  const plan = CL.party.upgradeAllPlan(c);
  assert.deepEqual(plain(plan.items.map((x) => [x.soldierId, x.from, x.to, x.cost])), [
    [a.id, 'levy', 'footman', 25],
    [b.id, 'mercenary', 'sellsword', 60],
  ]);
  assert.deepEqual([plan.total, plan.wounded, plan.unaffordable], [85, 1, 1]);
  const seen = [];
  CL.events.on('SoldierPromoted', (e) => seen.push(e.soldierId));
  assert.deepEqual(plain(CL.party.upgradeAll(c)), { done: 2, cost: 85 });
  assert.equal(c.gold, 15);
  assert.deepEqual(plain(seen), [a.id, b.id], 'each upgrade is a promotion event (service notes, the tree)');
  assert.deepEqual(plain([a, b, w, d, n, top].map((s) => s.troop)), ['footman', 'sellsword', 'levy', 'hunter', 'levy', 'guard']);
  assert.deepEqual(plain(CL.party.upgradeAll(c)), { done: 0, cost: 0 }, 'nothing left that can be paid for');
  assert.equal(c.gold, 15);
});

test('Upgrade all takes the first of two paths; the second stays a choice on the card', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.gold = 1000;
  for (const s of c.roster) s.xp = 100; // enough for Levies (40) and Hunters (100)
  const plan = CL.party.upgradeAllPlan(c);
  assert.deepEqual(plain([...new Set(plan.items.map((x) => `${x.from}>${x.to}`))]), ['levy>footman', 'hunter>longbowman']);
});

// ---- What the company knows ----

test('a new company knows nothing; entering a town shows who is for hire, by name only', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  assert.deepEqual(plain(c.troopKnowledge), {});
  assert.deepEqual(plain(CL.troopTree.view(c)), []);
  CL.town.enterPlace('stonebridge');
  assert.deepEqual(plain(c.troopKnowledge), { levy: 'seen', hunter: 'seen', mercenary: 'seen' });
  const levy = CL.troopTree.view(c)[0].nodes[0];
  assert.deepEqual([levy.id, levy.level, levy.name, levy.stats], ['levy', 'seen', 'Levy', undefined], 'seen: a name and a place, no details');
});

test('hiring and training make a troop known in full (and what it can become, by name); battles show the enemy; knowledge never shrinks', () => {
  const { CL } = loadGame({ party: false, random: () => 0.99 });
  const c = CL.campaign;
  c.gold = 500;
  c.world.location = 'stonebridge';
  assert.ok(CL.party.recruit('levy'));
  assert.equal(CL.troopTree.level(c, 'levy'), 'owned');
  assert.equal(CL.troopTree.level(c, 'footman'), 'seen', 'the paths of a Levy are known by name');
  assert.equal(CL.troopTree.level(c, 'guard'), null, 'but not the paths after those');
  const s = c.roster[0];
  s.xp = 40;
  assert.ok(CL.party.upgradeSoldier(c, s.id, 'footman'));
  assert.equal(CL.troopTree.level(c, 'footman'), 'owned');
  CL.combat.startBattle('captains_trial');
  CL.party.endBattle(true);
  for (const id of new Set(CL.content.encounter('captains_trial').waves.flatMap((w) => Object.keys(w)))) {
    assert.ok(CL.troopTree.level(c, id), `${id} met in battle`);
  }
  CL.troopTree.learn(c, 'levy', 'seen');
  assert.equal(CL.troopTree.level(c, 'levy'), 'owned', 'seeing again does not forget');
});

test('auto-resolve also shows the enemy troops', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  CL.world.leaveSettlement();
  Object.assign(c.world, { x: 75, y: 20 });
  const p = CL.parties.spawn(c, 'bandits');
  Object.assign(p, { x: 76, y: 20, troops: { looter: 2, reaver: 1 }, tx: null, ty: null });
  CL.parties.open(p.id);
  CL.parties.autoResolve();
  assert.equal(CL.troopTree.level(c, 'looter'), 'seen');
  assert.equal(CL.troopTree.level(c, 'reaver'), 'seen');
});

test('the tree: owned troops in full with paths and the company, unknown ones in between shown as unknown', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  c.troopKnowledge = { guard: 'owned' }; // a Guard from somewhere, without knowing the Levy or Footman
  const [line] = CL.troopTree.view(c);
  assert.equal(line.faction, 'valedorn');
  const levy = line.nodes.find((n) => n.id === 'levy');
  assert.equal(levy.level, 'unknown');
  assert.equal(levy.name, undefined);
  const footman = levy.children.find((n) => n.id === 'footman');
  assert.equal(footman.level, 'unknown');
  assert.deepEqual(plain(footman.children.map((n) => n.id)), ['guard'], 'the Rider branch is unknown, so it is left out');
  const guard = footman.children[0];
  assert.deepEqual([guard.level, guard.name, guard.maxTier, guard.count], ['owned', 'Guard', true, 0]);
  assert.deepEqual(plain(guard.stats), { hp: 80, damage: 14, armor: 6, wage: 12 });
  assert.equal(line.nodes.some((n) => n.id === 'hunter'), false);
});

test('Reveal troop tree (debug) shows everything without changing what the campaign knows', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  CL.game.revealTree = true;
  const lines = CL.troopTree.view(c);
  assert.deepEqual(plain(lines.map((l) => l.faction)), ['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'ostrand', 'saltreach', 'neutral']);
  const count = (nodes) => nodes.reduce((n, x) => n + 1 + count(x.children), 0);
  assert.equal(lines.reduce((n, l) => n + count(l.nodes), 0), 34, 'every troop, the Sellsword and the new kingdoms’ (and P10-02 the coast’s) included');
  assert.deepEqual(plain(c.troopKnowledge), {});
  CL.game.revealTree = false;
});

// ---- Saves ----

test('what the company knows is saved, and junk is dropped on load', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  const c = CL.campaign;
  c.troopKnowledge = { levy: 'owned', reaver: 'seen', dragon: 'owned', hunter: 'befriended' };
  CL.save.write();
  assert.deepEqual(plain(loadGame({ storage }).CL.campaign.troopKnowledge), { levy: 'owned', reaver: 'seen' });
});

test('migrating a v5 save: the company knows its troops and what they were trained from', () => {
  const { CL } = loadGame();
  const v5 = plain(CL.campaign);
  v5.version = 5;
  preHoldings(v5);
  delete v5.troopKnowledge;
  v5.roster[0].troop = 'rider';
  v5.roster[1].troop = 'mercenary';
  const frozen = JSON.stringify(v5);
  const v6 = CL.save.MIGRATIONS[5](v5);
  assert.equal(JSON.stringify(v5), frozen, 'the input is not changed');
  assert.equal(v6.version, 6);
  const knownAs = (k) => Object.keys(v6.troopKnowledge).filter((id) => v6.troopKnowledge[id] === k).sort();
  assert.deepEqual(knownAs('owned'), ['footman', 'hunter', 'levy', 'mercenary', 'rider']);
  assert.deepEqual(knownAs('seen'), ['guard', 'longbowman', 'sellsword'], 'and what those can be trained into, by name');
});

test('a soldier hired at a fort is "of Greywall", not "of Greywall Fort"', () => {
  const { CL } = loadGame();
  // rand 0 picks the first form, "{given} of {origin}", and the first given name.
  assert.equal(CL.soldiers.makeName('valedorn', 'greywall_fort', () => 0, new Set()), 'Edric of Greywall');
  assert.equal(CL.soldiers.makeName('valedorn', 'oakford', () => 0, new Set()), 'Edric of Oakford');
});
