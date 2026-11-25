// P10-05: where an origin's opening quest leaves you, as data/origins.js `origin_rules.band` measures it.

/**
 * gold, soldiers, gear (the worth in crowns of what you wear: loot in the pack is money, not gear),
 * level and renown.
 */
function endState(CL, c) {
  const item = (id) => CL.content.table('items')[id];
  const worn = Object.values(c.equipment).filter(Boolean).reduce((a, id) => a + (item(id)?.value || 0), 0);
  return { gold: c.gold, soldiers: c.roster.length, gear: worn, level: c.character.level, renown: c.renown };
}

module.exports = { endState };
