/* Crownless content: origins (P10-05; GDD §5's backgrounds, rewritten). Plain classic script; no
 * modules, no fetch. An origin is who you were before the road, and how your game begins: a
 * situation in the kingdom you chose, an opening quest that teaches the basics on the way (its
 * quest in data/quests.js, its people in data/dialogue.js), and a hand-off into the common quest
 * (Q1, `common` in data/quests.js), and from it into the open world.
 *   attribute, skill  +1 to each, as the old backgrounds gave
 *   kit               the start: { gold, equipment, items }; everyone begins poor (GDD §5: 60 crowns)
 *   start             where you stand when the game begins: a story role ('@home', '@village'; js/story.js)
 *   begin             story effects at the start (js/story.js), e.g. the village's willing men
 *   quest             the opening quest, which ends by starting the common quest; none: Q1 at once
 *   situation         a line shown as the game begins
 *   edge              the small advantage it keeps (the owner's rule: balanced, not equal in kind)
 * Every origin ends its opening quest within `origin_rules.band` (tests/origins.test.js), so all of
 * them reach the common quest in about the same place. Nobody starts sworn, landed or at court. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var kit = function (gold) {
    return {
      gold: gold,
      equipment: { weapon: 'worn_sword', body: 'clothing', offhand: 'oak_shield' },
      items: { food_3_days: 1 }
    };
  };
  C.origins = {
    traveller: {
      id: 'traveller',
      name: 'Unhorsed Traveller',
      description: 'You rode a long road alone, until bandits threw you from your horse and rode off with it.',
      attribute: 'agi',
      skill: 'tactics',
      kit: kit(60),
      start: '@home',
      quest: 'o_traveller',
      situation: 'You limp up to the gate of {cast:home}, bruised and on foot. Somewhere out there, bandits are riding your horse.',
      edge: 'Your horse, once you take it back: a little faster on the roads.'
    },
    noble: {
      id: 'noble',
      name: 'Impoverished Noble',
      description: 'An old name and an empty purse. Your late father’s debts have come due, and your brother is paying for them.',
      attribute: 'cha',
      skill: 'leadership',
      kit: kit(60),
      start: '@home',
      quest: 'o_noble',
      situation: 'You come home to {cast:home} to find the family’s last retainer waiting, grim-faced. The moneylender’s men have taken your brother.',
      edge: 'Your grandfather’s axe, well kept: it hits harder than a worn sword.'
    },
    farmhand: {
      id: 'farmhand',
      name: 'Farmhand',
      description: 'Years behind a plough left you strong and handy with a blade. Then raiders came to your village.',
      attribute: 'str',
      skill: 'one_handed',
      kit: kit(60),
      start: '@village',
      begin: [{ recruit: '@crown', n: 3 }],
      quest: 'o_farmhand',
      situation: 'Smoke over {cast:village}. Raiders have been through your village, and three of its men have taken up their tools to go after them, if you will lead.',
      edge: 'Three of your village’s men, who follow you without a recruit’s fee.'
    },
    // P10-06 rewrites these two as origins with their own opening quests; until then they begin with the common quest.
    scout: {
      id: 'scout',
      name: 'Scout',
      description: 'You ran messages along the borders and know every shortcut.',
      attribute: 'agi',
      skill: 'pathfinding',
      kit: kit(60),
      start: '@home'
    },
    peddler: {
      id: 'peddler',
      name: 'Peddler',
      description: 'You hawked wares town to town and can talk a price down.',
      attribute: 'cha',
      skill: 'trade',
      kit: kit(60),
      start: '@home'
    }
  };
  // Where every opening quest ends (the owner's rule: about the same gold, soldiers, gear, level and
  // renown, within a small band). gear: the worth of what you wear, in crowns (loot in the pack is money).
  C.origin_rules = {
    band: { id: 'band', gold: [30, 130], soldiers: [2, 3], gear: [40, 90], level: [1, 2], renown: [3, 12] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
