// Gate C acceptance (GDD §14): "player can complete a contract, buy food, recruit, fight, level and
// reload with all state intact." A headless bot plays brand-new games on the real game logic.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { makeBot } = require('./helpers/campaign-bot');
const { newCampaign } = require('../scripts/simulate-campaign');

/** The gameplay state a reload must preserve (runtime-only fields like AI targets excluded). */
function gameplayState(c) {
  return JSON.stringify({
    gold: c.gold,
    renown: c.renown,
    day: c.day,
    battles: c.battles,
    victories: c.victories,
    roster: c.roster,
    inventory: c.inventory,
    equipment: c.equipment,
    character: c.character,
    world: c.world,
    food: c.food,
    morale: c.morale,
    nextWagesDay: c.nextWagesDay,
    markets: c.markets,
    cargo: c.cargo,
    contract: c.contract,
    contractsDone: c.contractsDone,
    rngSeed: c.rngSeed,
    parties: c.parties.map((p) => [p.id, p.template, p.x, p.y, p.troops, p.contractId ?? null]),
  });
}

test('GDD Gate C pass: contract, food, recruit, fight, level — then reload intact', () => {
  const { CL, storage } = newCampaign(3);
  const start = { gold: CL.campaign.gold, soldiers: CL.campaign.roster.length, level: CL.campaign.character.level };
  assert.deepEqual(start, { gold: 60, soldiers: 0, level: 1 }, 'a GDD new game');

  const bot = makeBot(CL);
  const s = bot.play(20);
  const c = CL.campaign;

  // Each pass criterion happened.
  assert.ok(c.contractsDone >= 1, 'completed a contract');
  assert.ok(s.foodBought > 0, 'bought food');
  assert.ok(s.hired > 0, 'recruited');
  assert.ok(s.wins >= 1, 'won a fight');
  assert.ok(c.character.level >= 2, 'levelled up');
  assert.equal(s.stuck, 0, 'the loop never stalled');

  // Reload from browser storage: everything that matters survives.
  CL.save.write();
  const other = loadGame({ storage, party: false });
  const reloaded = other.CL.save.load();
  assert.equal(gameplayState(reloaded), gameplayState(c));

  // And through an exported file on another device.
  const device = loadGame({ party: false });
  const r = device.CL.portable.importText(CL.portable.serialize(c));
  assert.equal(r.ok, true);
  assert.equal(gameplayState(device.CL.campaign), gameplayState(c));
});

test('new campaigns do not stall: eight seeds all make progress in 15 days', () => {
  // Every campaign keeps moving and wins something. One unlucky start may still be level 1 by day 15
  // (at 4 h per battle, from 1.6.0, seed 4 of 30 is; on average the bots level faster than at 6 h).
  let levelled = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { CL } = newCampaign(seed);
    const s = makeBot(CL).play(15);
    const c = CL.campaign;
    assert.equal(s.stuck, 0, `seed ${seed} stalled`);
    assert.ok(s.wins >= 1, `seed ${seed} never won`);
    assert.ok(c.day >= 15, `seed ${seed} ran out of steps`);
    if (c.character.level >= 2) levelled++;
  }
  assert.ok(levelled >= 7, `only ${levelled} of 8 seeds levelled`);
});

test('a lone new hero can take on the Looter Camp by auto-resolve, but not the Reaver Hideout', () => {
  const { CL } = newCampaign(1);
  const A = CL.autoresolve;
  const camp = (site) => {
    CL.game.siteId = site;
    CL.game.partyId = null;
    return A.winChance(A.playerPower(), A.troopsPower(CL.parties.current().troops));
  };
  assert.ok(camp('looter_camp') >= 0.45, `looter camp odds ${camp('looter_camp')}`);
  assert.ok(camp('reaver_hideout') <= 0.35, `reaver hideout odds ${camp('reaver_hideout')}`);
});
