// P7-03: the blacksmith. Capped, targeted upgrades of the hero's gear and fine kit for up to five
// soldiers, for crowns and iron; no durability; no buying, forging and selling for profit; wages and saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** In Stonebridge with a blacksmith, crowns and iron. */
function smithy(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  c.gold = 2000;
  assert.ok(CL.blacksmith.hire(c));
  c.cargo = { iron: 20 };
  return { ...env, c, B: CL.blacksmith };
}

test('forged pieces are items of their own, made from the rules; no armoury sells them', () => {
  const { CL } = loadGame();
  const items = CL.content.table('items');
  const sword = CL.content.item('arming_sword+1');
  assert.equal(sword.name, 'Arming Sword +1');
  assert.equal(sword.stats.damage, items.arming_sword.stats.damage + 2);
  assert.equal(sword.forgedFrom, 'arming_sword');
  assert.equal(CL.content.item('mail_hauberk+2').stats.armor, items.mail_hauberk.stats.armor + 4);
  assert.equal(CL.content.item('heater_shield+1').stats.block, true, 'a shield still blocks');
  assert.equal(items['arming_sword+3'], undefined, 'twice at most');
  assert.equal(items['nag+1'], undefined, 'horses are not forged');
  assert.equal(items['charter_fragment+1'], undefined, 'nor quest items');
  for (const s of Object.values(CL.content.table('settlements'))) for (const g of s.gear || []) assert.equal(CL.content.item(g).forgedFrom, undefined, `${s.id} sells ${g}`);
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('forging the hero’s weapon: crowns and iron, twice at most, and it hits harder', () => {
  const { CL, c, B } = smithy();
  const before = CL.character.heroCombat(c).damage;
  const was = c.equipment.weapon;
  const o = B.forgeOffer(c, 'weapon');
  assert.equal(o.to, `${was}+1`);
  const [gold, iron] = [c.gold, c.cargo.iron];
  assert.equal(B.forge(c, 'weapon').ok, true);
  assert.equal(c.equipment.weapon, `${was}+1`);
  assert.equal(c.gold, gold - o.crowns);
  assert.equal(c.cargo.iron, iron - o.iron);
  assert.ok(CL.character.heroCombat(c).damage >= before + 2, 'hits harder (at least the 2 forged on, before strength)');
  const o2 = B.forgeOffer(c, 'weapon');
  assert.ok(o2.crowns >= o.crowns && o2.iron === 2 * o.iron, 'the second time costs more');
  assert.equal(B.forge(c, 'weapon').ok, true);
  assert.equal(c.equipment.weapon, `${was}+2`);
  const third = B.forge(c, 'weapon');
  assert.equal(third.ok, false);
  assert.match(third.reason, /already improved 2 times/);
  // Body armour stops more; no iron, no forging; no blacksmith, none at all.
  c.cargo = {};
  assert.match(B.forge(c, 'body').reason, /iron/);
  c.cargo = { iron: 5 };
  const armor = CL.character.heroCombat(c).armor;
  assert.equal(B.forge(c, 'body').ok, true);
  assert.equal(CL.character.heroCombat(c).armor, armor + 2);
  assert.equal(B.forgeOffer(c, 'horse').reason ?? 'none', c.equipment.horse ? 'not something a smith improves' : 'nothing equipped');
  B.dismiss(c);
  assert.match(B.forge(c, 'head').reason, /no blacksmith/);
});

test('no money loop: forged gear always sells for less than the plain piece costs, let alone the forging', () => {
  const { CL, c, B } = smithy();
  const T = CL.trade;
  c.character.skills.trade = 10; // the best prices a player gets both ways
  for (const it of Object.values(CL.content.table('items')).filter((x) => x.forgedFrom)) {
    const base = CL.content.item(it.forgedFrom);
    const buy = T.gearBuyPrice(c, base.id);
    assert.ok(T.gearPrice(c, it.id) < buy, `${it.id}: sells for ${T.gearPrice(c, it.id)}, the plain one costs ${buy}`);
  }
  // Forging what you wear and selling it never beats what it cost.
  c.equipment.weapon = 'war_mace';
  const paid = T.gearBuyPrice(c, 'war_mace') + B.forgeOffer(c, 'weapon').crowns;
  B.forge(c, 'weapon');
  assert.ok(T.gearPrice(c, c.equipment.weapon) < paid);
});

test('fine kit: five soldiers at most, crowns and iron, tougher in battle and a little stronger in auto-resolve', () => {
  const { CL, c, B } = smithy();
  const F = B.rules();
  while (c.roster.length < 7) CL.save.addSoldier(c, 'footman');
  const power = CL.autoresolve.playerPower(c);
  const [gold, iron] = [c.gold, c.cargo.iron];
  const first = c.roster[5]; // a footman, to compare with the other footman below
  assert.equal(B.giveKit(c, first.id).ok, true);
  assert.equal(first.kit, true);
  assert.equal(c.gold, gold - F.kit.cost);
  assert.equal(c.cargo.iron, iron - F.kit.iron);
  assert.ok(CL.autoresolve.playerPower(c) > power);
  assert.match(B.giveKit(c, first.id).reason, /already/);
  for (const s of c.roster.slice(0, 4)) assert.equal(B.giveKit(c, s.id).ok, true);
  assert.equal(B.kitted(c), F.kit.max);
  assert.match(B.giveKit(c, c.roster[6].id).reason, /5 soldiers already/);
  // In battle: more armour and hit points than the same troop without.
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const units = CL.game.allies;
  const kitted = units.find((u) => u.soldierId === first.id);
  const plainOne = units.find((u) => u.soldierId === c.roster[6].id);
  assert.equal(kitted.armor, plainOne.armor + F.kit.armor);
  assert.equal(kitted.maxhp, plainOne.maxhp + F.kit.hp);
});

test('hired in towns; wages with the rest; unpaid twice, they leave', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.gold = 500;
  c.world.location = 'oakford';
  assert.equal(CL.blacksmith.canHire(c), false);
  c.world.location = 'stonebridge';
  assert.ok(CL.blacksmith.hire(c));
  assert.equal(CL.quartermaster.wagesDue(c), CL.upkeep.weeklyWages(c) + CL.blacksmith.WAGE);
  c.gold = 0;
  c.accounts.chest = 0;
  CL.blacksmith.payday(c);
  CL.blacksmith.payday(c);
  assert.equal(CL.blacksmith.get(c), null);
});

test('saves: forged gear, fine kit and the blacksmith kept; junk dropped; a v11 save migrates to v12', () => {
  const storage = memoryStorage();
  const { CL, c, B } = smithy({ storage });
  B.forge(c, 'weapon');
  B.giveKit(c, c.roster[0].id);
  c.inventory['iron_helm+1'] = 1;
  CL.save.write();
  const back = loadGame({ storage }).CL.campaign;
  assert.equal(back.equipment.weapon, c.equipment.weapon);
  assert.equal(back.inventory['iron_helm+1'], 1);
  assert.equal(back.roster[0].kit, true);
  assert.equal(back.roster[1].kit, undefined);
  assert.equal(back.followers.blacksmith.name, c.followers.blacksmith.name);
  assert.equal(JSON.stringify(back.roster), JSON.stringify(c.roster), 'a save and a reload give the same soldiers, fine kit included');
  const junk = CL.save.sanitize({ ...plain(c), inventory: { 'iron_helm+9': 1, 'atlantis+1': 2 } });
  assert.deepEqual(plain(junk.inventory), {});
  const v11 = plain(c);
  v11.version = 11;
  delete v11.followers.blacksmith;
  const r = CL.save.fromRaw(v11);
  assert.equal(r.campaign.version, 14);
  assert.equal(r.campaign.followers.blacksmith, null);
});
