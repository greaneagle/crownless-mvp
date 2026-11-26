// Hero levels, troop upgrades and the party cap (GDD §5, §7; Gate C step 8).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('XP to the next level is round(100 × L^1.35)', () => {
  const { CL } = loadGame();
  const f = CL.character.xpToNext;
  assert.equal(f(1), 100);
  assert.equal(f(2), 255);
  assert.equal(f(9), Math.round(100 * 9 ** 1.35));
});

test('levelling: +1 skill point per level, +1 attribute point every 2nd level', () => {
  const { CL } = loadGame(); // Farmhand, INT 5
  const ch = CL.campaign.character;
  assert.equal(CL.character.gainXp(100), 1);
  assert.deepEqual([ch.level, ch.xp, ch.skillPoints, ch.attributePoints], [2, 0, 1, 1]);
  assert.equal(CL.character.gainXp(254), 0);
  assert.equal(CL.character.gainXp(1), 1);
  assert.deepEqual([ch.level, ch.skillPoints, ch.attributePoints], [3, 2, 1]);
  // From level 3: 441 + 650 + 879 + 1124 + 1383 = 4477 ≤ 5000 < 4477 + 1659
  assert.equal(CL.character.gainXp(5000), 5, 'several levels at once');
  assert.equal(ch.level, 8);
});

test('Intelligence adds 2% XP per point above 5; level 20 is the cap (P11-03)', () => {
  const { CL } = loadGame();
  const ch = CL.campaign.character;
  ch.attributes.int = 10;
  CL.character.gainXp(50);
  assert.equal(ch.xp, 55);
  CL.character.gainXp(1e7);
  assert.equal(ch.level, 20);
  assert.equal(ch.xp, 0);
  assert.equal(CL.character.gainXp(500), 0);
});

test('spending points: skills cap at 10, attributes at 20, and STR raises HP', () => {
  const { CL } = loadGame();
  const ch = CL.campaign.character;
  assert.equal(CL.character.spendSkill('leadership'), false, 'no points');
  ch.skillPoints = 2;
  ch.attributePoints = 1;
  assert.equal(CL.character.spendSkill('leadership'), true);
  assert.equal(ch.skills.leadership, 1);
  assert.equal(CL.character.spendSkill('juggling'), false);
  ch.skills.tactics = 10;
  assert.equal(CL.character.spendSkill('tactics'), false, 'capped');
  const hp = CL.character.heroCombat().hp;
  assert.equal(CL.character.spendAttribute('str'), true);
  assert.equal(CL.character.heroCombat().hp, hp + 5);
  assert.equal(ch.attributePoints, 0);
});

test('the company limit (P9-B3): 8 + 5×Leadership + Renown/20 + 10 an officer + land, at most 200', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  assert.equal(CL.party.partyCap(), 8);
  c.character.skills.leadership = 3;
  assert.equal(CL.party.partyCap(), 23);
  c.renown = 85;
  assert.equal(CL.party.partyCap(), 27, 'renown 85: +4');
  CL.companion.join(c, 'mara');
  assert.equal(CL.party.partyCap(), 37, 'an officer: +10');
  CL.realm.transfer(c, 'oakford', { holder: 'player', reason: 'test' });
  assert.equal(CL.party.partyCap(), 42, 'a village: +5');
  CL.realm.transfer(c, 'westholt_castle', { holder: 'player', reason: 'test' });
  assert.equal(CL.party.partyCap(), 57, 'a fort: +15');
  const parts = CL.party.limitParts(c).parts;
  assert.equal(JSON.stringify(parts), JSON.stringify({ base: 8, leadership: 15, renown: 4, officers: 10, land: 20, friendly: 0 }));
  c.renown = 4000;
  c.character.skills.leadership = 10;
  assert.equal(CL.party.partyCap(), 200, 'the ceiling');
  CL.companion.part?.(c);
  c.companion = null;
  for (const sid of ['oakford', 'westholt_castle']) CL.realm.transfer(c, sid, { holder: CL.realm.rulerOf(CL.realm.owner(sid, c), c), reason: 'test' });
  c.character.skills.leadership = 0;
  c.renown = 0;
  c.gold = 999;
  while (c.roster.length < 8) CL.save.addSoldier(c, 'levy');
  assert.equal(CL.party.recruit('levy'), false, 'full at 8');
});

test('upgrade trees follow the GDD, including the cavalry branches', () => {
  const { CL } = loadGame();
  const opts = (id) => Array.from(CL.party.upgradeOptions(id), (o) => `${o.to}:${o.cost}:${o.xp}:${o.locked ? 'locked' : 'ok'}`);
  assert.deepEqual(opts('levy'), ['footman:25:40:ok', 'hunter:25:40:ok']);
  assert.deepEqual(opts('footman'), ['guard:60:100:ok', 'rider:90:100:ok']);
  assert.deepEqual(opts('spearman'), ['legionary:60:100:ok', 'horse_scout:90:100:ok']);
  assert.deepEqual(opts('recruit'), ['spearman:25:40:ok', 'skirmisher:25:40:ok']);
  assert.deepEqual(opts('hunter'), ['longbowman:60:100:ok']);
  assert.deepEqual(opts('guard'), []);
});

test('upgrading spends XP and gold, skips the wounded and the unready, stops when gold runs out', () => {
  const { CL } = loadGame(); // fixture soldiers 1–3 levies, 4–5 hunters
  const c = CL.campaign;
  const [a, b, d] = c.roster;
  a.xp = 50;
  b.xp = 45;
  b.woundedUntil = 3;
  d.xp = 10;
  c.gold = 40; // enough for one
  assert.equal(CL.party.upgrade('levy', 'footman'), 1);
  assert.deepEqual([a.troop, a.xp, c.gold], ['footman', 10, 15]);
  assert.equal(b.troop, 'levy', 'wounded');
  assert.equal(d.troop, 'levy', 'not enough XP');
  b.woundedUntil = null;
  assert.equal(CL.party.upgrade('levy', 'hunter'), 0, 'not enough gold');
  c.gold = 100;
  assert.equal(CL.party.upgrade('levy', 'hunter'), 1);
  assert.equal(b.troop, 'hunter');
  assert.equal(CL.party.upgrade('footman', 'rider'), 0, 'not enough XP yet');
});

test('battle XP: hero by result and kills; soldiers who fought, half if wounded, plus their kills', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  const r = CL.party.applyBattleResult(c, {
    battleId: 1,
    encounterId: 'looter_band',
    win: true,
    kills: 7,
    killed: [],
    wounded: [2],
    participants: [1, 2, 3],
    soldierKills: { 1: 2 },
  });
  assert.equal(r.xp.heroXp, 25 + 8 * 7);
  const xp = Object.fromEntries(c.roster.map((s) => [s.id, s.xp]));
  assert.deepEqual(xp, { 1: 20 + 10, 2: 10, 3: 20, 4: 0, 5: 0 });
  assert.equal(r.xp.troopXp, 60);

  const r2 = CL.party.applyBattleResult(c, {
    battleId: 2,
    encounterId: 'looter_band',
    win: false,
    kills: 2,
    killed: [],
    wounded: [],
    participants: [4],
  });
  assert.equal(r2.xp.heroXp, 5 + 4 * 2);
  assert.equal(c.roster.find((s) => s.id === 4).xp, 8);
});

test('a real battle credits deployed soldiers and their own kills', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  CL.combat.startBattle('looter_band');
  const ally = CL.game.allies[0];
  const foe = CL.game.enemies[0];
  CL.combat.hit(foe, 999, ally);
  assert.equal(ally.kills, 1);
  CL.debugTools.endBattleNow(true);
  const s = CL.campaign.roster.find((x) => x.id === ally.soldierId);
  assert.equal(s.xp, 20 + 5);
  assert.match(CL.game.result.html, /\+\d+ XP/);
});

test('auto-resolve gives XP to the soldiers who took part', () => {
  const { CL } = loadGame();
  CL.game.siteId = 'looter_camp';
  CL.game.partyId = null;
  CL.parties.autoResolve();
  assert.ok(CL.campaign.roster.some((s) => s.xp > 0));
  assert.ok(CL.campaign.character.xp > 0 || CL.campaign.character.level > 1);
});

test('saved level and points are validated', () => {
  const { CL } = loadGame();
  const ch = CL.character.sanitize({ origin: 'scout', level: 50, xp: 30, skillPoints: 3, attributePoints: -1 });
  assert.equal(ch.level, 1, 'out of range → 1');
  assert.equal(ch.xp, 30);
  assert.equal(ch.skillPoints, 3);
  assert.equal(ch.attributePoints, 0);
});

// ---- P11-03: the budget (D-P11b) ----

test('P11-03: the curve is unchanged to level 10, then a flatter line; the grants to the cap', () => {
  const { CL } = loadGame();
  const C = CL.character;
  for (let L = 1; L < 10; L++) assert.equal(C.xpToNext(L), Math.round(100 * L ** 1.35));
  assert.equal(C.xpToNext(10), Math.round(100 * 10 ** 1.35), "10 to 11 costs what the old formula's 10 did");
  for (let L = 11; L < C.MAX_LEVEL; L++) assert.equal(C.xpToNext(L) - C.xpToNext(L - 1), C.CURVE_STEP, `level ${L}: ${C.CURVE_STEP} more than the one before`);
  assert.deepEqual([C.xpTotal(10), C.xpTotal(15), C.xpTotal(20)], [8428, 25123, 55568]);
  const ch = CL.campaign.character;
  const pts = [ch.skillPoints, ch.attributePoints];
  CL.character.gainXp(C.xpTotal(20));
  assert.equal(ch.level, 20);
  assert.deepEqual([ch.skillPoints - pts[0], ch.attributePoints - pts[1]], [19, 10], 'a skill point a level, an attribute point each even one');
  assert.deepEqual([ch.xp, CL.character.gainXp(1e6)], [0, 0], 'nothing past the cap');
});

test('P11-03: a character at the old cap starts gaining again', () => {
  const { CL } = loadGame();
  const ch = CL.campaign.character;
  CL.character.gainXp(CL.character.xpTotal(10));
  Object.assign(ch, { level: 10, xp: 0 }); // as 5.2.0 left one at its cap
  assert.equal(CL.character.gainXp(CL.character.xpToNext(10)), 1);
  assert.equal(ch.level, 11);
});

test('P11-03: retraining gives back every point spent, and only those; never in battle', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const ch = c.character;
  const start = JSON.parse(JSON.stringify({ a: ch.attributes, s: ch.skills }));
  ch.skillPoints = 4;
  ch.attributePoints = 2;
  for (const k of ['one_handed', 'one_handed', 'polearm', 'leadership']) assert.ok(CL.character.spendSkill(k));
  for (const a of ['str', 'agi']) assert.ok(CL.character.spendAttribute(a));
  ch.attributes.cha += 1; // a story's grant (js/story.js): stays
  CL.game.mode = 'battle';
  assert.equal(CL.character.retrain(c), null, 'not in battle');
  CL.game.mode = 'map';
  assert.deepEqual(JSON.parse(JSON.stringify(CL.character.retrain(c))), { attributes: 2, skills: 4 });
  assert.deepEqual([ch.skillPoints, ch.attributePoints], [4, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(ch.skills)), start.s, 'the origin’s +1 stays');
  assert.deepEqual(JSON.parse(JSON.stringify(ch.attributes)), { ...start.a, cha: start.a.cha + 1 }, 'the story’s grant stays');
  assert.deepEqual(JSON.parse(JSON.stringify(CL.character.retrain(c))), { attributes: 0, skills: 0 }, 'nothing twice');
});

test('P11-03: the save: the two new skills at 0, spent and training repaired, no migration', () => {
  const { CL } = loadGame();
  const C = CL.character;
  const ch = CL.campaign.character;
  ch.skillPoints = 2;
  C.spendSkill('two_handed');
  ch.training.sword_school = true;
  const back = C.sanitize(JSON.parse(JSON.stringify(ch)));
  assert.equal(back.skills.two_handed, 1);
  assert.deepEqual(JSON.parse(JSON.stringify([back.spent, back.training])), [{ attributes: {}, skills: { two_handed: 1 } }, { sword_school: true }]);
  // An older character: no new skills, no spent, no training; and junk.
  const old = JSON.parse(JSON.stringify(ch));
  delete old.skills.two_handed;
  delete old.skills.polearm;
  delete old.spent;
  delete old.training;
  const o = C.sanitize(old);
  assert.deepEqual([o.skills.two_handed, o.skills.polearm], [0, 0]);
  assert.deepEqual(JSON.parse(JSON.stringify([o.spent, o.training])), [{ attributes: {}, skills: {} }, {}]);
  const junk = C.sanitize({ ...old, level: 20, spent: { attributes: { str: 99 }, skills: { trade: -1, polearm: 'x' } }, training: { '<b>': true, ok_one: 'yes', fine: true } });
  assert.equal(junk.level, 20);
  assert.deepEqual(JSON.parse(JSON.stringify([junk.spent, junk.training])), [{ attributes: {}, skills: {} }, { fine: true }]);
});
