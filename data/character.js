/* Crownless content: character creation (GDD §5). Plain classic script; no modules, no fetch.
 * attributes: str, agi, int, cha (all start at 5). Skills start at 0. A background adds +1 to one
 * attribute and +1 to one skill, and supplies the starting kit (GDD: everyone begins poor). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var kit = {
    gold: 60,
    equipment: { weapon: 'worn_sword', body: 'clothing', offhand: 'oak_shield' },
    items: { food_3_days: 1 }
  };
  C.skills = {
    one_handed: { id: 'one_handed', name: 'One-Handed', effect: '+3% melee damage per point' },
    shield: { id: 'shield', name: 'Shield', effect: 'Block recovery (later update)' },
    archery: { id: 'archery', name: 'Archery', effect: 'Companions and AI (later update)' },
    riding: { id: 'riding', name: 'Riding', effect: 'Cavalry (later update)' },
    leadership: { id: 'leadership', name: 'Leadership', effect: 'Party size (Gate C step 8)' },
    tactics: { id: 'tactics', name: 'Tactics', effect: 'Auto-resolve odds (Gate C step 6)' },
    pathfinding: { id: 'pathfinding', name: 'Pathfinding', effect: '+3% map travel speed per point' },
    trade: { id: 'trade', name: 'Trade', effect: '-1% prices per point (Gate C step 5)' }
  };
  C.backgrounds = {
    farmhand: {
      id: 'farmhand',
      name: 'Farmhand',
      description: 'Years behind a plough left you strong and handy with a blade.',
      attribute: 'str',
      skill: 'one_handed',
      kit: kit
    },
    scout: {
      id: 'scout',
      name: 'Scout',
      description: 'You ran messages along the march and know every shortcut.',
      attribute: 'agi',
      skill: 'pathfinding',
      kit: kit
    },
    peddler: {
      id: 'peddler',
      name: 'Peddler',
      description: 'You hawked wares town to town and can talk a price down.',
      attribute: 'cha',
      skill: 'trade',
      kit: kit
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
