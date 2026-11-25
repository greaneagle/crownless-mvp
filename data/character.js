/* Crownless content: character creation (GDD §5). Plain classic script; no modules, no fetch.
 * attributes: str, agi, int, cha (all start at 5). Skills start at 0. An origin (data/origins.js,
 * P10-05) adds +1 to one attribute and +1 to one skill, and supplies the starting kit. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
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
})(typeof window !== 'undefined' ? window : globalThis);
