// Debug tools (the "Debug" button next to Logs).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('crowns: add and remove, never below zero; every action is logged', () => {
  const { CL } = loadGame();
  const D = CL.debugTools;
  D.addGold(1000);
  assert.equal(CL.campaign.gold, 1130);
  D.addGold(-5000);
  assert.equal(CL.campaign.gold, 0);
  assert.equal(CL.diag.events.filter((e) => e.msg === 'Debug: gold').length, 2);
});

test('soldiers: add any troop (past the cap), heal all, dismiss all', () => {
  const { CL } = loadGame();
  const D = CL.debugTools;
  D.addSoldiers('legionary', 12);
  assert.equal(CL.campaign.roster.length, 17);
  assert.throws(() => D.addSoldiers('dragon'), /Unknown troops id/);
  CL.campaign.roster[0].woundedUntil = 9;
  CL.campaign.roster[1].woundedUntil = 9;
  D.healAll();
  assert.equal(CL.party.woundedSoldiers().length, 0);
  D.dismissAll();
  assert.equal(CL.campaign.roster.length, 0);
});

test('items and stats', () => {
  const { CL } = loadGame();
  const D = CL.debugTools;
  D.addItem('arming_sword');
  assert.equal(CL.campaign.inventory.arming_sword, 1);
  assert.equal(D.adjustStat('str', 30), true);
  assert.equal(CL.campaign.character.attributes.str, 20, 'clamped');
  D.adjustStat('one_handed', -5);
  assert.equal(CL.campaign.character.skills.one_handed, 0);
  assert.equal(D.adjustStat('luck', 1), false);
});

test('god mode: the hero takes no damage', () => {
  const { CL } = loadGame();
  CL.combat.startBattle();
  CL.debugTools.toggleGod();
  const h = CL.game.hero;
  CL.combat.hit(h, 999, null);
  assert.equal(h.hp, h.maxhp);
  assert.equal(h.alive, true);
  CL.debugTools.toggleGod();
  CL.combat.hit(h, 5, null);
  assert.ok(h.hp < h.maxhp);
});

test('win/lose now go through the normal exactly-once result', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  assert.equal(CL.debugTools.endBattleNow(true), false, 'not in battle');
  CL.combat.startBattle();
  assert.equal(CL.debugTools.endBattleNow(true), true);
  assert.equal(CL.game.result.win, true);
  assert.equal(CL.campaign.victories, 1);
  assert.equal(CL.debugTools.endBattleNow(true), false, 'already resolved');
  CL.combat.startBattle();
  CL.debugTools.endBattleNow(false);
  assert.equal(CL.game.result.win, false);
  assert.equal(CL.campaign.battles, 2);
});

test('world: pass days, reset sites, teleport', () => {
  const { CL } = loadGame();
  const D = CL.debugTools;
  CL.campaign.world.sites.reaver_hideout.clearedUntil = 9;
  D.passDays(2);
  assert.equal(CL.campaign.day, 2);
  D.resetSites();
  assert.equal(CL.world.siteActive('reaver_hideout'), true);
  D.teleport('saltmere');
  assert.deepEqual([CL.campaign.world.x, CL.campaign.world.y, CL.campaign.world.location], [134, 130, 'saltmere']);
});

test('wipe removes the main, backup and legacy saves', () => {
  const { CL, storage } = loadGame();
  CL.save.write();
  CL.save.write();
  storage.data.crownless_v03_party = '{}';
  CL.debugTools.wipeSave();
  assert.deepEqual(Object.keys(storage.data), []);
});
