// P11-08: fighting from the saddle (docs/PHASE-11-PLAN.md §10.7). Who rides where, and why not; the
// horse's momentum and turning; the lance's momentum; braced spears stop the hero's charge; the horse's
// own HP and the unhorsing; dismounting with no remount; bows from the saddle; Riding; and the mounted
// hero is still the hero.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A battle with the hero on a horse (Riding to meet it), at (300, 300) facing right, foes placed relative. */
function ride({ horse = 'rouncey', weapon = 'arming_sword', map = 'grass_field', foes = [['looter', 1500, 0]], riding = 3, setup } = {}) {
  const env = loadGame();
  const { CL } = env;
  const c = CL.campaign;
  Object.assign(c.equipment, { weapon, horse });
  Object.assign(c.character.attributes, { str: 7 });
  c.character.skills.riding = riding;
  setup?.(CL, c);
  const said = [];
  CL.ui.message = (t) => said.push(t);
  CL.combat.startBattle({ id: 'ride', name: 'ride', map, waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  const g = CL.game;
  const h = g.hero;
  Object.assign(h, { x: 300, y: 300, face: 'right' });
  if (h.mounted) h.heading = 0;
  g.allies = [];
  g.enemies = foes.map(([id, dx, dy]) => Object.assign(CL.units.makeUnit(300 + dx, 300 + dy, 'enemy', id), { face: 'left', aiTimer: 99, attackCooldown: 99 }));
  return { ...env, g, h, said };
}
const step = (CL, s, dt = 0.02) => {
  for (let t = 0; t < s - 1e-9; t += dt) CL.combat.update(dt);
};

test('who rides: a battle horse, met, on a field that allows it, a weapon for the saddle, and the choice', () => {
  assert.equal(ride().h.mounted, true, 'a rouncey on the open field');
  const nag = ride({ horse: 'nag' });
  assert.equal(nag.h.mounted, false);
  assert.ok(nag.said.includes('Your Nag isn’t trained for battle: you fight on foot.'));
  const lists = ride({ map: 'tourney_lists' });
  assert.equal(lists.h.mounted, false);
  assert.ok(lists.said.includes('Horses can’t go onto the lists: you fight on foot.'));
  const green = ride({ riding: 0 });
  assert.equal(green.h.mounted, false, 'Riding 1 needed');
  assert.ok(green.said.some((t) => /needs Riding 1; you have 0/.test(t)));
  const axe = ride({ weapon: 'great_axe', setup: (CL) => (CL.content.table('items').great_axe.req = {}) });
  assert.equal(axe.h.mounted, false);
  assert.ok(axe.said.includes('Your Greataxe can’t be used from horseback: you fight on foot.'));
  const foot = ride({ setup: (_CL, c) => (c.loadout.ride = false) });
  assert.equal(foot.h.mounted, false, 'chosen: on foot');
  // The walls, by their map's rule.
  const { CL } = loadGame();
  assert.equal(CL.arena.assault({ ladders: 1 }).mounts, false);
  assert.equal(CL.content.get('battle_maps', 'greywall_courtyard').mounts, false);
});

test('the horse keeps momentum: speed builds while you hold a direction, it turns at its rate, it slows when let go', () => {
  const { CL, g, h } = ride();
  const S = h.steed;
  g.hold.KeyD = true;
  CL.combat.update(0.02);
  const early = h.momentum;
  step(CL, S.accel);
  assert.ok(h.momentum > early && h.momentum > 0.9, 'a gallop after its acceleration');
  // A half turn takes time.
  g.hold.KeyD = false;
  g.hold.KeyA = true;
  const turn = S.turn * (1 + CL.combat.SADDLE.turnPerRiding * 3);
  CL.combat.update(0.02);
  assert.ok(Math.abs(Math.cos(h.heading) - 1) < 0.5, 'not about at once');
  step(CL, Math.PI / turn + 0.1);
  assert.ok(Math.cos(h.heading) < -0.9, 'round after π ÷ its turning rate');
  g.hold.KeyA = false;
  const m = h.momentum;
  step(CL, 0.5);
  assert.ok(h.momentum < m, 'let go: it slows');
});

test('Riding turns and gathers the horse faster', () => {
  const turned = (riding) => {
    const { CL, g, h } = ride({ riding });
    g.hold.KeyS = true;
    step(CL, 0.3);
    return h.heading;
  };
  assert.ok(turned(6) > turned(1), 'more of a quarter turn in the same time');
});

test('a charge lands harder; a lance only from a moving horse', () => {
  const { CL, h } = ride({ weapon: 'war_lance', horse: 'destrier', setup: (_L, c) => (c.character.skills.riding = 3) });
  h.momentum = 0;
  const still = CL.combat.saddleBlow(h);
  h.momentum = 1;
  const gallop = CL.combat.saddleBlow(h);
  assert.ok(still < 0.35 && gallop > 1.5 && gallop > still * 6, `${still} standing, ${gallop} at a gallop`);
  const { CL: L2, h: h2 } = ride();
  h2.momentum = 1;
  const sword = L2.combat.saddleBlow(h2);
  h2.momentum = 0;
  assert.ok(sword > L2.combat.saddleBlow(h2) && L2.combat.saddleBlow(h2) === 1, 'a sword: the charge’s bonus, none standing');
  // On foot a lance says so.
  const { CL: L3 } = loadGame();
  const c = L3.campaign;
  c.character.skills.riding = 2;
  assert.ok(L3.gear.check(c, { ...c.equipment, weapon: 'war_lance' }).some((f) => f.code === 'lance'));
});

test('braced spears stop the hero’s charge and hurt the horse and rider', () => {
  const { CL, g, h } = ride({ foes: [['spearman', 30, 0]] });
  const spear = g.enemies[0];
  Object.assign(spear, { face: 'left' });
  h.momentum = 1;
  const [hp, horse] = [h.hp, h.steed.hp];
  g.hold.KeyD = true;
  CL.combat.update(0.02);
  assert.equal(h.momentum, 0, 'stopped');
  assert.ok(h.hp < hp || h.steed.hp < horse, 'and hurt');
});

test('at a gallop the hero rides through foot, as cavalry do; the mounted hero is still the hero', () => {
  const { CL, h } = ride({ foes: [['looter', 40, 0]] });
  const foot = CL.game.enemies[0];
  h.momentum = 1;
  assert.equal(CL.units.mounted(h), true);
  assert.equal(h.role, 'hero', 'the hero for morale, orders, the stall guard and hero-down');
  assert.equal(CL.units.charging(h), true);
  assert.equal(CL.units.passesThrough(h, foot), true);
  h.momentum = 0;
  assert.equal(CL.units.passesThrough(h, foot), false, 'not at a walk');
});

test('half of a blow falls on the horse; at 0 the hero is thrown (a stagger) and fights on; the horse is fine next battle', () => {
  const { CL, g, h, said } = ride({ foes: [['huscarl', 30, 0]] });
  const foe = g.enemies[0];
  const [hp, horse] = [h.hp, h.steed.hp];
  CL.combat.hit(h, 20, foe);
  const dealt = hp - h.hp + (horse - h.steed.hp);
  assert.ok(Math.abs(horse - h.steed.hp - dealt * CL.combat.SADDLE.horseShare) <= 1, 'about half on the horse');
  h.steed.hp = 1;
  CL.combat.hit(h, 40, foe);
  assert.equal(h.mounted, false, 'thrown');
  assert.ok(h.attackCooldown > 0 && h.staggeredAt === g.t);
  assert.ok(said.includes('Your Rouncey is down: you fight on foot.'));
  assert.ok(h.alive);
  CL.combat.startBattle({ id: 'ride', name: 'ride', map: 'grass_field', waves: [{ looter: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  assert.equal(CL.game.hero.mounted, true, 'the horse is fine after the battle');
  assert.equal(CL.game.hero.steed.hp, CL.content.item('rouncey').mount.hp);
});

test('Dismount (X, or Orders): on foot for the rest of the battle, no remount', () => {
  const { CL, g, h, said } = ride();
  const foot = h.footSpeed;
  assert.equal(CL.combat.dismount(), true);
  assert.equal(h.mounted, false);
  assert.equal(h.speed, foot, 'your own pace again');
  assert.ok(said.includes('You dismount: you fight on foot'));
  assert.equal(CL.combat.dismount(), false, 'nothing to get off');
  step(CL, 1);
  assert.equal(h.mounted, false, 'no getting back on (D-P11k)');
  void g;
});

test('bows from the saddle: a shortbow draws slower; a gallop throws the aim; a longbow can’t be used', () => {
  const { CL, g, h } = ride({ weapon: 'short_bow', setup: (_L, c) => (c.equipment.offhand = null) });
  assert.equal(h.mounted, true, 'a shortbow can be used from the saddle');
  g.attackHeld = true;
  step(CL, h.ranged.draw);
  assert.ok(h.drawT < h.ranged.draw, 'slower than on foot (a penalty)');
  const lb = ride({ weapon: 'hunting_longbow', setup: (_L, c) => (c.equipment.offhand = null) });
  assert.equal(lb.h.mounted, false);
  assert.ok(lb.said.includes('Your Hunting Longbow can’t be used from horseback: you fight on foot.'));
});

test('the horses differ: the courser fastest and frailest, the destrier heaviest and slowest to turn', () => {
  const { CL } = loadGame();
  const m = (id) => CL.content.item(id).mount;
  assert.equal(m('nag').battle, 'no');
  assert.ok(m('courser').speed > m('rouncey').speed && m('courser').speed > m('destrier').speed);
  assert.ok(m('courser').hp < m('rouncey').hp && m('destrier').hp > m('rouncey').hp);
  assert.ok(m('destrier').turn < m('rouncey').turn && m('destrier').charge > m('courser').charge);
  assert.deepEqual(JSON.parse(JSON.stringify(CL.content.validate())), []);
});
