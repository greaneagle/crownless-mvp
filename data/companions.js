/* Crownless content: companions. Plain classic script; no modules, no fetch.
 * GDD §10: one named companion, Mara, a former imperial scout. Recruitable after Q2 for a modest
 * cost or through a short trust dialogue. She fights autonomously, equips a weapon and armour, and
 * gives +1 Pathfinding while conscious. She takes one party slot and eats like anyone else.
 *   hp, armor, speed, reach   her own numbers in battle (armour adds to her body armour)
 *   weaponFactor              share of her weapon's damage she deals (a skilled scout, not a knight)
 *   skills                    bonuses to the hero's skills while she is fit (not wounded)
 *   gearSlots                 what she can be given from the pack
 *   startGear                 what she arrives with (not taken from the player)
 *   woundDays                 how long she is out after going down in battle or a capture */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.companions = {
    mara: {
      id: 'mara',
      name: 'Mara',
      title: 'former imperial scout',
      frames: [124, 125, 126, 127],
      hp: 80,
      armor: 1,
      speed: 100,
      reach: 50,
      weaponFactor: 0.75,
      unarmedDamage: 6,
      skills: { pathfinding: 1 },
      gearSlots: ['weapon', 'body'],
      startGear: { weapon: 'worn_sword', body: 'gambeson' },
      hireCost: 100,
      woundDays: 2
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
