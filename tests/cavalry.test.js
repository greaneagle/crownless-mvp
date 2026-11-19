// AI cavalry and the full troop roster (GDD §6–7; Gate D 4.5).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { mulberry } = require('../scripts/simulate-campaign');

const ENC = (waves, map = 'grass_field') => ({ id: 't', name: 't', map, waves, reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });

function cavalryBattle(riders, waves, opts) {
  const env = loadGame(opts);
  const { CL } = env;
  CL.campaign.roster = [];
  for (let i = 0; i < riders; i++) CL.save.addSoldier(CL.campaign, 'rider');
  CL.combat.startBattle(ENC(waves, opts?.map));
  return env;
}

test('cavalry deploy on the left wing, up to 6, clear of obstacles', () => {
  const { CL } = cavalryBattle(8, [{ looter: 1 }], { map: 'forest_clearing' });
  const cav = CL.game.allies.filter((a) => a.role === 'cavalry');
  assert.equal(cav.length, 6);
  for (const u of cav) {
    assert.ok(u.x < CL.game.hero.x, 'behind the hero, on the left');
    assert.equal(CL.units.blocked(u.x, u.y) && CL.game.battleMap.obstacles.some((o) => CL.units.inside(o, u.x, u.y, CL.units.UNIT_RADIUS - 0.5)), false);
  }
  assert.equal(CL.game.orders.cavalry, 'charge');
});

test('a charging rider builds momentum and strikes with the GDD 1.2× bonus', () => {
  const { CL } = cavalryBattle(1, [{ looter: 1 }]);
  const g = CL.game;
  const r = g.allies[0];
  const e = g.enemies[0];
  Object.assign(e, { x: r.x + 220, y: r.y, aiTimer: 99, attackCooldown: 99 });
  Object.assign(g.hero, { x: 100, y: 470 }); // out of the way
  let hitAt = null;
  for (let i = 0; i < 200 && hitAt === null; i++) {
    CL.combat.update(0.02);
    if (e.hp < e.maxhp) hitAt = e.maxhp - e.hp;
  }
  // Rider damage 14 × 1.2 vs looter armour 1 → round(16.8 × 100 / 104) = 16 (13 without the bonus).
  assert.equal(hitAt, CL.combat.mitigate(14 * 1.2, 1));
  assert.equal(r.chargeBonus, 1.2);
});

test('riders pass through their target and wheel round for another run', () => {
  const { CL } = cavalryBattle(1, [{ guard: 1 }]);
  const g = CL.game;
  const r = g.allies[0];
  const e = g.enemies[0];
  Object.assign(e, { x: r.x + 200, y: r.y, aiTimer: 99, attackCooldown: 99 });
  Object.assign(g.hero, { x: 100, y: 470 });
  let maxPast = -Infinity;
  let cameBack = false;
  for (let i = 0; i < 300; i++) {
    CL.combat.update(0.02);
    const past = r.x - e.x;
    if (past > maxPast) maxPast = past;
    if (maxPast > 30 && past < maxPast - 20) cameBack = true;
  }
  assert.ok(maxPast > 30, `rode past the target (${maxPast.toFixed(0)} px)`);
  assert.ok(cameBack, 'turned for another run');
});

test('Hold keeps cavalry in place until enemies come close; Follow keeps them near the hero', () => {
  const { CL } = cavalryBattle(2, [{ looter: 2 }]);
  const g = CL.game;
  for (const e of g.enemies) Object.assign(e, { x: 880, aiTimer: 99, attackCooldown: 99, speed: 0 });
  CL.combat.order('cavalry', 'hold');
  const r = g.allies[0];
  const start = [r.x, r.y];
  for (let i = 0; i < 100; i++) CL.combat.update(0.02);
  assert.ok(Math.hypot(r.x - start[0], r.y - start[1]) < 6, 'held');
  CL.combat.order('cavalry', 'follow');
  Object.assign(g.hero, { x: 450, y: 450 });
  for (let i = 0; i < 200; i++) CL.combat.update(0.02);
  assert.ok(Math.hypot(r.x - 450, r.y - 450) < 120, 'followed the hero');
});

test('without cavalry, the cavalry group is unavailable', () => {
  const { CL, uiCalls } = loadGame();
  CL.combat.startBattle(ENC([{ looter: 1 }]));
  CL.combat.order('cavalry', 'charge');
  assert.equal(CL.game.orders.cavalry, 'charge', 'unchanged default');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /No cavalry/.test(x[1])));
});

test('cavalry battles on every map end and nobody gets stuck in scenery', () => {
  for (const map of ['grass_field', 'forest_clearing', 'greywall_courtyard']) {
    for (let k = 0; k < 4; k++) {
      const { CL } = cavalryBattle(4, [{ looter: 5, reaver: 2 }], { map, random: mulberry(300 + k) });
      const g = CL.game;
      let steps = 0;
      let trapped = 0;
      while (g.mode === 'battle' && steps < 9000) {
        CL.combat.update(0.02);
        steps++;
        if (steps % 25 === 0) {
          for (const u of [...g.allies, ...g.enemies]) {
            if (u.alive && g.battleMap.obstacles.some((o) => CL.units.inside(o, u.x, u.y, CL.units.UNIT_RADIUS - 0.5))) trapped++;
          }
        }
      }
      assert.equal(trapped, 0, `${map} #${k}: a unit inside scenery`);
      assert.notEqual(g.mode, 'battle', `${map} #${k}: battle never ended`);
    }
  }
});

test('Footman → Rider and Spearman → Horse Scout are open; riders use their own art', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.roster = [];
  CL.save.addSoldier(c, 'footman').xp = 100;
  c.gold = 500;
  assert.equal(CL.party.upgrade('footman', 'rider'), 1);
  assert.equal(c.roster[0].troop, 'rider');
  assert.deepEqual(Array.from(CL.assets.troopArt.rider), [204, 205, 206, 207]);
  assert.deepEqual(Array.from(CL.assets.troopArt.horse_scout), [210, 211, 212, 213]);
});

test('Mercenaries are for hire in towns, not villages', () => {
  const { CL } = loadGame();
  assert.ok(CL.party.recruitsHere().includes('mercenary'), 'Stonebridge');
  CL.campaign.world.location = 'oakford';
  assert.equal(CL.party.recruitsHere().includes('mercenary'), false);
});

test('every troop type can appear in play (the 15 from the GDD, the Sellsword from 1.5.0, and the two new kingdoms’ 12 from 2.7.0)', () => {
  const { CL } = loadGame();
  const reach = new Set();
  // Hireable: faction recruits wherever recruiting is offered, plus town Mercenaries.
  for (const s of Object.values(CL.content.table('settlements'))) {
    CL.campaign.world.location = s.id;
    for (const id of CL.party.recruitsHere()) reach.add(id);
  }
  // Upgrades from anything reachable.
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...reach]) {
      for (const o of CL.party.upgradeOptions(id)) {
        if (!reach.has(o.to)) {
          reach.add(o.to);
          grew = true;
        }
      }
    }
  }
  // Enemies: encounter waves and bandit bands.
  for (const e of Object.values(CL.content.table('encounters'))) for (const w of e.waves) for (const id of Object.keys(w)) reach.add(id);
  for (const t of Object.values(CL.content.table('party_templates'))) for (const id of Object.keys(t.troops)) reach.add(id);
  const all = Object.keys(CL.content.table('troops')).filter((id) => id !== 'hero');
  assert.equal(all.length, 28); // 15 from the GDD; the Sellsword (V2-03b) is trained from Mercenaries; 6 each for Hrothmark and Vessaro (W-05b)
  assert.deepEqual(all.filter((id) => !reach.has(id)), []);
});
