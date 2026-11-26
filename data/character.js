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
    one_handed: { id: 'one_handed', name: 'One-Handed', effect: '+3% damage a point with a one-handed weapon. From 5.5.0, a quicker recovery after each blow too' },
    two_handed: { id: 'two_handed', name: 'Two-Handed', effect: 'From 5.5.0: harder blows and a quicker recovery with greatswords and greataxes' },
    polearm: { id: 'polearm', name: 'Polearm', effect: 'From 5.5.0: spears and pikes keep their reach and brace against a charge' },
    shield: { id: 'shield', name: 'Shield', effect: 'From 5.5.0: a block that recovers sooner and takes more before it breaks' },
    archery: { id: 'archery', name: 'Archery', effect: 'From 5.7.0: a steadier aim and a quicker draw with a bow; a crossbow’s aim' },
    riding: { id: 'riding', name: 'Riding', effect: 'From 5.8.0: fighting from the saddle, and the better horses' },
    leadership: { id: 'leadership', name: 'Leadership', effect: 'Five more soldiers in your company a point' },
    tactics: { id: 'tactics', name: 'Tactics', effect: 'Better odds when you simulate a battle' },
    pathfinding: { id: 'pathfinding', name: 'Pathfinding', effect: '+3% map travel speed a point' },
    trade: { id: 'trade', name: 'Trade', effect: '-1% prices a point' }
  };
  C.attributes = {
    str: { id: 'str', name: 'Strength', effect: '+5 health a point; what heavy weapons, armour and crossbows need. From 5.6.0, what you carry easily' },
    agi: { id: 'agi', name: 'Agility', effect: 'From 5.5.0: a quicker recovery after each blow; from 5.6.0, less slowed by armour' },
    int: { id: 'int', name: 'Intelligence', effect: '+2% experience a point above 5' },
    cha: { id: 'cha', name: 'Charisma', effect: 'Opens what some people in the story ask of you' }
  };
  C.budget = { cap: 20, middle: 10, late: 15 };
})(typeof window !== 'undefined' ? window : globalThis);
