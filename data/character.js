/* Crownless content: character creation (GDD §5). Plain classic script; no modules, no fetch.
 * attributes: str, agi, int, cha (all start at 5). Skills start at 0. An origin (data/origins.js,
 * P10-05) adds +1 to one attribute and +1 to one skill, and supplies the starting kit.
 * P11-03: `effect` is what a skill or attribute does, in the player's words; a skill whose work comes
 * with a later task says so ("From 5.5.0"). `budget` (D-P11b): the level cap, and the middle and late
 * levels the requirement rule measures an advanced and an elite piece against (docs/PHASE-11-PLAN.md
 * §7.3; tests/requirements.test.js). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.skills = {
    one_handed: { id: 'one_handed', name: 'One-Handed', effect: '+3% damage and a little quicker recovery a point with a sword, axe or mace' },
    two_handed: { id: 'two_handed', name: 'Two-Handed', effect: '+3% damage and a little quicker recovery a point with a greatsword or greataxe' },
    polearm: { id: 'polearm', name: 'Polearm', effect: '+3% damage and a little quicker recovery a point with a spear or pike' },
    shield: { id: 'shield', name: 'Shield', effect: 'A shield takes 10% more before its guard breaks, recovers 10% sooner and covers a degree wider each side, a point' },
    archery: { id: 'archery', name: 'Archery', effect: 'From 5.7.0: a steadier aim and a quicker draw with a bow; a crossbow’s aim' },
    riding: { id: 'riding', name: 'Riding', effect: 'From 5.8.0: fighting from the saddle, and the better horses' },
    leadership: { id: 'leadership', name: 'Leadership', effect: 'Five more soldiers in your company a point' },
    tactics: { id: 'tactics', name: 'Tactics', effect: 'Better odds when you simulate a battle' },
    pathfinding: { id: 'pathfinding', name: 'Pathfinding', effect: '+3% map travel speed a point' },
    trade: { id: 'trade', name: 'Trade', effect: '-1% prices a point' }
  };
  C.attributes = {
    str: { id: 'str', name: 'Strength', effect: '+5 health and more you carry easily a point; what heavy weapons, armour and crossbows need' },
    agi: { id: 'agi', name: 'Agility', effect: '+2% walking pace a point above 5, and 6% less slowed by a heavy load' },
    int: { id: 'int', name: 'Intelligence', effect: '+2% experience a point above 5' },
    cha: { id: 'cha', name: 'Charisma', effect: 'Opens what some people in the story ask of you' }
  };
  C.budget = { cap: 20, middle: 10, late: 15 };
  // P11-05 (D-P11d): the hero's body: a walking pace (px a second; soldiers walk 82–94) and Agility's
  // share a point above 5.
  C.body = { speed: 100, agility: 0.02 };
  // P11-06 (docs/PHASE-11-PLAN.md §10.3): the load. Worn and wielded gear's `weight` (a carried second
  // weapon and a slung shield too; the pack, the cargo and the horse never) against a capacity from base
  // Strength. Each band (by load / capacity, up to `upTo`) changes walking speed, the start of a walk
  // (`ramp`: seconds to full pace), a swing's recovery and (P11-07) a bow's draw. Agility lessens those
  // penalties by `agility` a point above 5; speed never falls below `floor` of the pace. Armour's class
  // adds poise (resistance to stagger).
  C.encumbrance = {
    capacity: { base: 12, perStr: 1.2 },
    bands: [
      { id: 'light', upTo: 0.6, speed: 1, ramp: 0, recovery: 1, draw: 1 },
      { id: 'medium', upTo: 1, speed: 0.95, ramp: 0.1, recovery: 1, draw: 1 },
      { id: 'heavy', upTo: 1.4, speed: 0.85, ramp: 0.25, recovery: 1.08, draw: 1.1 },
      { id: 'overloaded', upTo: null, speed: 0.7, ramp: 0.4, recovery: 1.18, draw: 1.2 }
    ],
    agility: 0.06,
    floor: 0.6,
    poise: { cloth: 0, rags: 0, gambeson: 0.25, fur: 0.25, leather: 0.5, mail: 1 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
