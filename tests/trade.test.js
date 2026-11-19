// Trading (GDD §9; Gate C step 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const GOODS = ['grain', 'salt', 'wool', 'iron', 'cloth', 'tools', 'timber', 'wine']; // W-05b: timber and wine

test('eight trade goods; every trading settlement has a market, forts do not', () => {
  const { CL } = loadGame();
  assert.deepEqual(
    Array.from(CL.trade.goods(), (g) => g.id),
    GOODS,
  );
  for (const id of ['stonebridge', 'eastwatch', 'oakford', 'highmere', 'brackenfield', 'dunmarsh', 'redfield', 'saltmere']) {
    assert.equal(CL.trade.hasMarket(id), true, id);
  }
  assert.equal(CL.trade.hasMarket('greywall_fort'), false);
  assert.equal(CL.trade.hasMarket(null), false);
});

test('GDD price formula with Trade helping both buying and selling', () => {
  const { CL } = loadGame(); // Farmhand: Trade 0
  const c = CL.campaign;
  const T = CL.trade;
  // Stonebridge grain: base 10 × scarcity 0.95
  assert.equal(T.unitBuyPrice(c, 'stonebridge', 'grain'), 10); // round(9.5)
  assert.equal(T.unitSellPrice(c, 'stonebridge', 'grain'), 7); // round(7.125)
  c.character.skills.trade = 10;
  assert.equal(T.unitBuyPrice(c, 'stonebridge', 'grain'), 9); // round(8.55)
  // round(7.84) = 8; the rounding guard (sell < buy one step earlier = 9) allows it
  assert.equal(T.unitSellPrice(c, 'stonebridge', 'grain'), 8);
});

test('no buy/sell exploit in the same town — any good, any town, any Trade level', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  for (const trade of [0, 5, 10]) {
    c.character.skills.trade = trade;
    for (const sid of Object.keys(c.markets)) {
      for (const g of GOODS) {
        for (const qty of [1, 5, 20]) {
          c.markets = T.defaultMarkets();
          const spent = T.quote(c, sid, g, qty, 'buy');
          c.markets[sid][g] = spent.scarcity;
          const earned = T.quote(c, sid, g, qty, 'sell');
          assert.ok(earned.total < spent.total, `${sid} ${g} ×${qty} trade ${trade}: ${spent.total} → ${earned.total}`);
        }
      }
    }
  }
});

test('carrying goods between towns can turn a profit', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  // Cloth is cheap at the Eastwatch river port and dear in Brackenfield.
  const buy = T.quote(c, 'eastwatch', 'cloth', 10, 'buy').total;
  const sell = T.quote(c, 'brackenfield', 'cloth', 10, 'sell').total;
  assert.ok(sell > buy, `cloth: buy ${buy}, sell ${sell}`);
});

test('each unit moves the price; scarcity stays within 0.8–1.4; days restock toward baseline', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  c.gold = 99999;
  c.cargo = {};
  assert.equal(T.buy(c, 'oakford', 'grain', 5).ok, true);
  assert.ok(Math.abs(c.markets.oakford.grain - 0.815) < 1e-9, '+0.003 per unit');
  T.drift(c, 1);
  assert.ok(Math.abs(c.markets.oakford.grain - 0.8135) < 1e-3, 'closes 10% of the gap per day');
  T.drift(c, 60);
  assert.ok(Math.abs(c.markets.oakford.grain - 0.8) < 0.001);
  c.roster.push(...Array.from({ length: 60 }, (_, i) => ({ id: 100 + i, troop: 'levy', xp: 0, woundedUntil: null })));
  T.buy(c, 'saltmere', 'tools', 100);
  assert.equal(c.markets.saltmere.tools, 1.4, 'clamped at the top');
  c.markets.saltmere.tools = 0.85;
  T.sell(c, 'saltmere', 'tools', 100);
  assert.equal(c.markets.saltmere.tools, 0.8, 'clamped at the bottom');
});

test('the campaign clock restocks markets', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.food = 100;
  c.markets.oakford.grain = 1.0;
  CL.party.advanceDays(3);
  assert.ok(c.markets.oakford.grain < 1.0 && c.markets.oakford.grain > 0.8);
});

test('transactions are all-or-nothing', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  const snapshot = () => JSON.stringify([c.gold, c.cargo, c.markets]);
  c.gold = 5;
  let before = snapshot();
  assert.equal(T.buy(c, 'stonebridge', 'tools', 1).reason, 'Not enough crowns');
  assert.equal(snapshot(), before);

  c.gold = 99999;
  before = snapshot();
  assert.match(T.buy(c, 'stonebridge', 'tools', 30).reason, /cannot carry/);
  assert.equal(snapshot(), before);

  assert.equal(T.sell(c, 'stonebridge', 'salt', 1).reason, 'You have none to sell');
  assert.equal(T.buy(c, 'greywall_fort', 'salt', 1).reason, 'No market here');
  assert.equal(snapshot(), before);
});

test('cargo capacity grows with soldiers and a horse; a full load slows travel to 70%', () => {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const T = CL.trade;
  assert.equal(T.capacity(c), 20, 'hero alone');
  for (let i = 0; i < 5; i++) CL.save.addSoldier(c, 'levy');
  assert.equal(T.capacity(c), 70);
  c.equipment.horse = 'nag';
  assert.equal(T.capacity(c), 100);
  c.equipment.horse = null;
  assert.equal(T.loadFactor(c), 1);
  c.cargo = { tools: 10, iron: 20 }; // 30 + 40 = 70
  assert.equal(T.cargoWeight(c), 70);
  assert.ok(Math.abs(T.loadFactor(c) - 0.7) < 1e-9);
  assert.ok(Math.abs(CL.world.speedAt(75, 20) - 4 * 0.7) < 1e-9, 'world travel uses the load factor');
});

test('selling gear: half value, quest items protected, equipped gear not in the pack', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const T = CL.trade;
  c.inventory = { worn_sword: 2, courier_packet: 1 };
  assert.equal(T.gearPrice(c, 'worn_sword'), 6);
  assert.equal(T.gearPrice(c, 'courier_packet'), 0);
  const gold = c.gold;
  assert.equal(T.sellGear(c, 'stonebridge', 'worn_sword').ok, true);
  assert.equal(c.gold, gold + 6);
  assert.equal(c.inventory.worn_sword, 1);
  assert.equal(T.sellGear(c, 'stonebridge', 'courier_packet').ok, false);
  assert.equal(T.sellGear(c, 'stonebridge', 'oak_shield').ok, false, 'equipped, so not in the pack');
  assert.equal(T.sellGear(c, 'greywall_fort', 'worn_sword').ok, false, 'no market at a fort');
});

test('saved markets and cargo are validated; older saves get default markets', () => {
  const { CL } = loadGame();
  const s = CL.save.sanitize({
    version: 2,
    roster: [],
    markets: { oakford: { grain: 5, salt: 1.1 }, atlantis: { grain: 1 } },
    cargo: { grain: 4, silk: 3, iron: -2, salt: 1.5 },
  });
  assert.equal(s.markets.oakford.grain, 1.4, 'clamped');
  assert.equal(s.markets.oakford.salt, 1.1);
  assert.equal(s.markets.oakford.wool, 0.9, 'baseline for missing values');
  assert.equal('atlantis' in s.markets, false);
  assert.deepEqual({ ...s.cargo }, { grain: 4 });
  const old = CL.save.sanitize({ version: 2, roster: [] });
  assert.equal(old.markets.saltmere.salt, 0.8);
  assert.deepEqual({ ...old.cargo }, {});
});
