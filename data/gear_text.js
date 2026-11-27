/* Crownless content: what the gear check says (P11-02; docs/PHASE-11-PLAN.md §8.2). Plain classic script; no modules, no fetch.
 * One line a finding of js/gear.js, by its code, in the player's words. {item} is the item's name,
 * {shield} the shield's, {other} the other weapon's, {loadout} a loadout in words. Each line fits two
 * lines of the sheet at 812×375 with Larger text (tests/gear.test.js holds it under 120 letters with
 * the longest names). The codes are the gear check's own: a pack can't add or remove one.
 * P11-03: a requirement's lines also have {stat} (an attribute's or skill's name), {need}, {have} and
 * {fix}, its last sentence: one of the fix_ lines ({n} the points to spend; {master} and {place} a
 * master's, from P11-17). P11-06: the load's lines have {load} and {capacity}. P11-08: {place} where horses can't go. */
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
    heavy: 'Your armour is heavy for the {item}: it works less well.',
    attribute: 'The {item} needs {stat} {need}; you have {have}. {fix}',
    skill: 'The {item} needs {stat} {need}; you have {have}. {fix}',
    training: 'The {item} needs a master’s training. {fix}',
    no_weapon: 'You can’t wield your {item} yet: you fight with your fists.',
    horse_travel: 'Your {item} isn’t trained for battle: you fight on foot.',
    horse_field: 'Horses can’t go onto {place}: you fight on foot.',
    ride_weapon: 'Your {item} can’t be used from horseback: you fight on foot.',
    horse_down: 'Your {item} is down: you fight on foot.',
    lance: 'The {item} does damage only from a moving horse.',
    load_heavy: 'Your gear is heavy ({load} of {capacity}): you move and recover slower.',
    load_over: 'Your gear is too heavy ({load} of {capacity}): you move and recover much slower.',
    fix_spend: 'Spend {n} on it.',
    fix_level: 'More points come as you level.',
    fix_untaught: 'No one teaches it yet.',
    fix_teacher: '{master} teaches it in {place}.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
