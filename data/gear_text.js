/* Crownless content: what the gear check says (P11-02; docs/PHASE-11-PLAN.md §8.2). Plain classic script; no modules, no fetch.
 * One line a finding of js/gear.js, by its code, in the player's words. {item} is the item's name,
 * {shield} the shield's, {other} the other weapon's, {loadout} a loadout in words. Each line fits two
 * lines of the sheet at 812×375 with Larger text (tests/gear.test.js holds it under 120 letters with
 * the longest names). The codes are the gear check's own: a pack can't add or remove one. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.gear_text = {
    two_hands: 'The {item} needs both hands: your {shield} will be slung on your back.',
    shoots: 'You can’t hold a shield and shoot the {item}: your {shield} will be slung on your back.',
    unarmed: 'You carry no weapon: you will fight with your fists.',
    no_second: 'You carry no second weapon: battles start with your {item}.',
    fallback: 'Your {loadout} can’t be used here: you start with your {other} instead.',
    loaner: 'You fight in the loaner kit: {item} and {shield}. Your own gear stays in your pack.',
    mounted: 'The {item} can’t be used from horseback.',
    heavy: 'Your armour is heavy for the {item}: it works less well.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
