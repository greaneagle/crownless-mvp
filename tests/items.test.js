// Item catalogue, tiered loot and armouries (GDD §9; Gate D 4.4).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, loadContent } = require('./helpers/load');

const C = loadContent();
const items = Object.values(C.items);
const bySlot = (slot) => items.filter((i) => i.slot === slot);

test('about 30 definitions including goods and food, covering every gear slot', () => {
  const goods = Object.values(C.markets).filter((g) => g.tradeGood);
  assert.ok(items.length + goods.length >= 30, `${items.length} items + ${goods.length} goods`);
  const want = { weapon: 4, offhand: 3, head: 3, body: 3, hands: 2, feet: 2, horse: 3 };
  for (const [slot, n] of Object.entries(want)) assert.ok(bySlot(slot).length >= n, `${slot}: ${bySlot(slot).length}`);
  assert.ok(items.filter((i) => i.stats.food).length >= 2, 'food');
  assert.equal(items.filter((i) => i.questItem).length, 3, 'quest items');
});

test('within a slot (a weapon: within its family), higher tiers cost more and do more', () => {
  const power = (i) => (i.stats.damage || 0) + (i.stats.armor || 0) + (i.stats.travel || 0) * 10;
  // P11-05 (plan §6.4): weapons of different families trade off reach, tempo and weight against damage,
  // so the ladder is each family's (a greataxe hits harder than a knight's sword, and is slower).
  const ladders = ['offhand', 'head', 'body', 'hands', 'feet'].map((slot) => [slot, bySlot(slot)]);
  // P11-08: horses by what they are for (a warhorse trades travel for the charge).
  const kindOf = (i) => (i.mount?.battle === 'war' ? 'war' : 'riding');
  for (const kind of new Set(bySlot('horse').map(kindOf))) ladders.push([`horse (${kind})`, bySlot('horse').filter((i) => kindOf(i) === kind)]);
  for (const fam of new Set(bySlot('weapon').map((i) => i.family))) ladders.push([`weapon (${fam})`, bySlot('weapon').filter((i) => i.family === fam)]);
  for (const [slot, items] of ladders) {
    const ladder = items.sort((a, b) => a.tier - b.tier || a.value - b.value);
    for (let i = 1; i < ladder.length; i++) {
      assert.ok(ladder[i].value >= ladder[i - 1].value, `${slot}: ${ladder[i].id} cheaper than ${ladder[i - 1].id}`);
      assert.ok(power(ladder[i]) >= power(ladder[i - 1]), `${slot}: ${ladder[i].id} weaker than ${ladder[i - 1].id}`);
    }
  }
  for (const s of bySlot('offhand')) assert.equal(s.stats.block, true, `${s.id} must allow blocking`);
});

test('loot tables get richer with tier and never drop quest items', () => {
  const avg = (id) => {
    const t = C.loot_tables[id].table;
    const w = t.reduce((s, e) => s + e.weight, 0);
    return t.reduce((s, e) => s + C.items[e.item].value * e.weight, 0) / w;
  };
  assert.ok(avg('low') < avg('mid') && avg('mid') < avg('high'), `${avg('low')} < ${avg('mid')} < ${avg('high')}`);
  for (const t of Object.values(C.loot_tables)) for (const e of t.table) assert.equal(C.items[e.item].questItem, false);
  assert.equal(C.encounters.looter_band.loot, 'low');
  assert.equal(C.encounters.captains_trial.loot, 'mid');
});

test('a band’s loot tier follows its size', () => {
  const { CL } = loadGame();
  const t = CL.content.get('party_templates', 'bandits');
  assert.equal(CL.parties.battleDef(t, { looter: 6 }).loot, 'low');
  assert.equal(CL.parties.battleDef(t, { looter: 7 }).loot, 'mid');
  assert.equal(CL.parties.battleDef(t, { looter: 8, reaver: 3 }).loot, 'high');
});

test('armouries: towns stock a full range, villages basics, forts nothing', () => {
  const { CL } = loadGame();
  const T = CL.trade;
  const slots = (sid) => new Set(T.gearStock(sid).map((id) => CL.content.item(id).slot).filter(Boolean));
  for (const town of ['stonebridge', 'eastwatch']) assert.ok(slots(town).size >= 6, `${town} sells ${[...slots(town)]}`);
  assert.ok(T.gearStock('oakford').length >= 3 && T.gearStock('oakford').length <= 5);
  assert.deepEqual(Array.from(T.gearStock('greywall_fort')), []);
  assert.ok(T.gearStock('eastwatch').includes('knights_sword'), 'the river port sells the best blades');
});

test('buying gear: priced above its resale value, atomic, Trade discount applies', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  for (const trade of [0, 10]) {
    c.character.skills.trade = trade;
    for (const id of new Set(Object.values(C.settlements).flatMap((s) => s.gear || []))) {
      assert.ok(T.gearBuyPrice(c, id) > T.gearPrice(c, id), `${id} at Trade ${trade}: buy ${T.gearBuyPrice(c, id)} vs sell ${T.gearPrice(c, id)}`);
    }
  }
  c.character.skills.trade = 0;
  c.gold = 1000;
  assert.equal(T.buyGear(c, 'stonebridge', 'mail_hauberk').ok, true);
  assert.equal(c.gold, 1000 - Math.round(220 * 1.3));
  assert.equal(c.inventory.mail_hauberk, 1);
  assert.equal(T.buyGear(c, 'stonebridge', 'knights_sword').reason, 'Not sold here');
  c.gold = 5;
  const before = JSON.stringify([c.gold, c.inventory]);
  assert.equal(T.buyGear(c, 'stonebridge', 'iron_helm').reason, 'Not enough crowns');
  assert.equal(JSON.stringify([c.gold, c.inventory]), before);
  c.gold = 100;
  const food = c.food;
  T.buyGear(c, 'stonebridge', 'smoked_meat');
  assert.equal(c.food, food + 6, 'bought food goes into the ration stock');
});

test('heavy gear makes the hero much harder to hurt (GDD armor formula)', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  // P11-03: what the rare pieces need (the Farmhand starts with Strength 6).
  Object.assign(c.character.attributes, { str: 7 });
  c.character.skills.shield = 2;
  for (const id of ['bascinet', 'mail_hauberk', 'mail_mittens', 'greaves', 'heater_shield']) {
    c.inventory[id] = 1;
    CL.character.equip(id);
  }
  const h = CL.character.heroCombat();
  assert.equal(h.armor, 3 + 5 + 1 + 2 + 2);
  assert.equal(CL.combat.mitigate(7, h.armor), 5, 'a looter hits for 5 instead of 7');
});

test('regional arms stay in their home markets when a town changes hands', () => {
  const { CL } = loadGame();
  const { trade, realm, campaign } = CL;
  const towns = {
    knights_lance: ['stonebridge'],
    valedorn_warhorse: ['stonebridge'],
    valedorn_warbow: ['stonebridge'],
    legion_spear: ['eastwatch'],
    hrothmark_longaxe: ['hrothgard'],
    league_arbalest: ['vessara'],
    league_light_horse: ['vessara'],
    cliff_bow: ['harrowgate'],
    ostrand_kite: ['harrowgate'],
    flats_pike: ['calder'],
    compact_horse_bow: ['merrow', 'gullhaven'],
  };
  const check = () => {
    for (const [id, sellers] of Object.entries(towns)) {
      assert.ok(CL.content.item(id).region, id);
      assert.deepEqual(Array.from(trade.gearTowns(id), (s) => s.id), sellers, id);
      for (const sid of sellers) assert.ok(trade.gearStock(sid).includes(id), sid);
      const high = C.loot_tables.high.table.find((e) => e.item === id);
      assert.ok(high?.weight > 0 && high.weight < 1, `${id}: rare high loot`);
      assert.ok(['low', 'mid'].every((tier) => !C.loot_tables[tier].table.some((e) => e.item === id)), id);
    }
  };
  check();
  assert.equal(realm.transfer(campaign, 'hrothgard', { controller: 'valedorn', capital: true }), true);
  assert.equal(realm.owner('hrothgard', campaign), 'valedorn');
  check();
  campaign.gold = 1000;
  assert.equal(trade.buyGear(campaign, 'hrothgard', 'hrothmark_longaxe').ok, true);
  assert.equal(campaign.inventory.hrothmark_longaxe, 1);
});
