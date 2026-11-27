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
  assert.deepEqual(plain(guard.stats), { hp: 70, damage: 14, armor: 7, wage: 12 }); // P11-11: a T3 by its kit (armour) more than its HP
  assert.equal(line.nodes.some((n) => n.id === 'hunter'), false);
});

test('Reveal troop tree (debug) shows everything without changing what the campaign knows', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  CL.game.revealTree = true;
  const lines = CL.troopTree.view(c);
  assert.deepEqual(plain(lines.map((l) => l.faction)), ['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'ostrand', 'saltreach', 'neutral']);
  const count = (nodes) => nodes.reduce((n, x) => n + 1 + count(x.children), 0);
  assert.equal(lines.reduce((n, l) => n + count(l.nodes), 0), 41, 'every troop, the Sellsword and the new kingdoms’ (and P10-02 the coast’s, P10-09 the women’s lines) included');
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

// ---- P11-11: troops by their weapons ----

test('P11-11: a troop’s weapon is authoritative: its family’s reach, shot and brace; the row its own damage, HP and armour', () => {
  const { CL } = loadGame();
  const F = CL.content.table('weapon_families');
  for (const t of Object.values(CL.content.table('troops'))) {
    if (t.role === 'hero') continue;
    assert.ok(F[t.weapon], `${t.id} names its weapon`);
    assert.equal(t.reach, undefined, `${t.id}: no reach of its own`);
    assert.equal(t.ranged, undefined, `${t.id}: no shot of its own`);
    const u = CL.units.makeUnit(0, 0, 'ally', t.id);
    assert.equal(u.reach, F[t.weapon].reach, `${t.id}: its ${t.weapon}'s reach`);
    assert.deepEqual([u.hp, u.damage, u.armor], [t.hp, t.damage, t.armor], t.id);
    if (F[t.weapon].ranged) assert.equal(u.ranged.range, F[t.weapon].ranged.range, `${t.id}: its ${t.weapon}'s range`);
  }
  // Valedorn's longbows outrange the hunters' shortbows; crossbows fly fastest and go through armour.
  const shot = (id) => CL.units.makeUnit(0, 0, 'ally', id);
  assert.ok(shot('longbowman').ranged.range > shot('hunter').ranged.range);
  assert.ok(shot('crossbowman').ranged.projectileSpeed > shot('hunter').ranged.projectileSpeed && shot('crossbowman').profile.pierce > 0);
});

test('P11-11: capabilities: spears and pikes brace by their weapon; the shield lines keep theirs; a pike guards with the weapon', () => {
  const { CL } = loadGame();
  const u = (id) => CL.units.makeUnit(0, 0, 'ally', id);
  for (const id of ['spearman', 'pikeman', 'saltreach_pikeman']) assert.equal(CL.groups.braces(u(id)), true, id);
  for (const id of ['legionary', 'pavisier']) assert.equal(CL.groups.braces(u(id)), true, `${id}: a shield line's skill (reviewed: no look changes)`);
  for (const id of ['footman', 'huscarl', 'reaver']) assert.equal(CL.groups.braces(u(id)), false, id);
  assert.equal(u('pikeman').profile.guardKind, 'weapon');
  assert.equal(CL.groups.canGuard(u('pikeman')), true, 'the AI raises a pike (plan §10.2)');
  assert.equal(CL.groups.canGuard(u('spearman')), false, 'a one-handed spear with no shield has no guard');
  assert.equal(u('footman').profile.guardKind, 'shield');
});

test('P11-11: tiers by kit before HP: a T3 has more armour than its T2, and its HP rises less than it did', () => {
  const { CL } = loadGame();
  const T = CL.content.table('troops');
  for (const t of Object.values(T)) {
    const from = Object.values(T).find((x) => x.upgradeTo === t.id || x.altUpgradeTo === t.id);
    if (t.tier !== 'T3' || !from || from.tier !== 'T2' || from.role !== t.role) continue;
    assert.ok(t.armor > from.armor, `${from.id} → ${t.id}: more armour`);
    assert.ok(t.hp / from.hp < 80 / 60, `${from.id} → ${t.id}: HP up by less than 5.10's third (${t.hp} from ${from.hp})`);
  }
});

test('P11-11: the women’s lines are unchanged in shape: their trees, shares and gender', () => {
  const { CL } = loadGame();
  const T = CL.content.table('troops');
  const line = (id) => {
    const out = [];
    for (let x = T[id]; x; x = T[x.upgradeTo]) out.push(x.id);
    return out;
  };
  assert.deepEqual(plain(line('shieldmaiden')), ['shieldmaiden', 'shield_sister', 'hearth_maiden']);
  assert.deepEqual(plain(line('popolana')), ['popolana', 'balestriera', 'arbalestriera']);
  for (const id of ['shieldmaiden', 'shield_sister', 'hearth_maiden', 'popolana', 'balestriera', 'arbalestriera', 'outlaw_huntress']) assert.equal(T[id].gender, 'female', id);
  assert.deepEqual(plain(T.clansman.women), { troop: 'shieldmaiden', share: 0.15 });
  assert.deepEqual(plain(T.militia.women), { troop: 'popolana', share: 0.15 });
});

test('P11-11: fine kit is a better weapon and an armour step; a lord fights in the best kit, as a veteran', () => {
  const { CL } = loadGame();
  const K = CL.content.table('forge').kit;
  const u = CL.units.makeUnit(0, 0, 'ally', 'footman');
  const [hp, dmg, arm] = [u.hp, u.damage, u.armor];
  CL.blacksmith.applyKit(u, { kit: true });
  assert.deepEqual([u.hp - hp, Number((u.damage / dmg).toFixed(2)), u.armor - arm], [K.hp, K.damage, K.armor]);
  assert.ok(K.hp < 8, 'less HP than it was: the kit is gear');
  const L = CL.lords.LEADER;
  const p = CL.profile.resolve({ troop: 'guard' }, { leader: L });
  assert.equal(p.armor, CL.content.troop('guard').armor + L.armor);
  assert.equal(L.style, 'veteran');
  assert.ok(L.hp < 2, 'their HP multiplier came down');
});

test('P11-11: companions on profiles: their weapon’s reach; a shield blocks, none no guard', () => {
  const { CL } = loadGame();
  const d = CL.content.table('companions').mara;
  const p = (equipment) => CL.profile.resolve({ companion: d, equipment });
  assert.equal(p({ weapon: 'arming_sword' }).reach, CL.content.table('weapon_families').sword.reach);
  assert.equal(p({ weapon: 'ash_spear' }).reach, CL.content.table('weapon_families').spear.reach);
  assert.equal(p({ weapon: 'arming_sword', offhand: 'oak_shield' }).canBlock, true);
  assert.equal(p({ weapon: 'arming_sword' }).canBlock, false);
});

test('P11-11: the troop card says its weapon, armour and style', () => {
  const { CL } = loadGame();
  assert.equal(CL.styles.card('legionary'), 'Sword and shield, mail. In battle: fights patiently, guards well, strikes when you miss');
  assert.equal(CL.styles.card('pikeman'), 'Pike, a gambeson. In battle: keeps you at the end of its spear');
  assert.equal(CL.styles.card('hero'), '');
});

test('P11-11: a pack troop with no weapon gets one from its look or role, with a warning; an unknown one is refused by name', () => {
  const { CL } = loadGame({
    content: (C) => {
      C.troops.levy = { ...C.troops.levy, weapon: undefined };
    },
  });
  const before = CL.diag.events.length;
  assert.equal(CL.units.makeUnit(0, 0, 'ally', 'levy').profile.family, 'mace', 'from its look');
  assert.ok(CL.diag.events.slice(before).some((e) => e.level === 'warn' && /without a weapon/.test(e.msg)));
  const errs = [];
  const C = JSON.parse(JSON.stringify({ troops: CL.content.table('troops'), weapon_families: CL.content.table('weapon_families'), items: CL.content.table('items') }));
  C.troops.levy.weapon = 'flail';
  for (const e of CL.content.validate({ ...C, factions: CL.content.table('factions') })) errs.push(e);
  assert.ok(errs.some((e) => /troop levy: unknown weapon flail/.test(e)));
});
