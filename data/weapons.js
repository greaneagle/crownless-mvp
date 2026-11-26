/* Crownless content: weapon families (P11-01; docs/PHASE-11-PLAN.md §6). Plain classic script; no modules, no fetch.
 * A family is the default for a kind of weapon; an item (data/items.js `family`, an optional `combat`
 * block of overrides) or a troop (data/troops.js `weapon`, with its own damage, reach and ranged, which
 * still override the family) picks one, and js/profile.js resolves a fighter's combat profile from it.
 * Every family's timing equals the one-handed sword of 5.0.0 for now (P11-05 to P11-08 set their own):
 *   hands       1 or 2
 *   reach       the far edge of a blow (px) when nothing else gives one
 *   windup, active, recovery   the swing's three parts (s); the blow lands in `active`
 *   miss        extra recovery when a swing hits nothing (s); 0 for now
 *   arc         the cone of a blow (degrees, the whole cone); 90 for now
 *   maxTargets  how many a blow can strike; 0 = every one in reach and arc (as now)
 *   cooldown    from one attack's start to the next (s): `hero` for the hero, `ai` for everyone else
 *   shield      whether a shield can be carried with it (a two-handed weapon or a bow slings it on the back)
 *   switch      seconds to bring it to hand from the other weapon (P11-02; 0.4 for every family until P11-05)
 *   ranged      a bow's or crossbow's shot (range, projectileSpeed, cooldown, accuracy) when the troop gives none
 *   look        the art kit's weapon part
 *   req         P11-03: what a piece of the family needs unless it says (`req` on the item; `{}` for nothing):
 *               { str?, agi?, skills?: { id: n }, training? }, held to the budget's rule (js/gear.js) */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var SWING = { windup: 0.16, active: 0.12, recovery: 0.24 };
  var COOLDOWN = { hero: 0.52, ai: 0.86 };
  function family(id, name, hands, reach, look, more) {
    var f = { id: id, name: name, hands: hands, reach: reach, windup: SWING.windup, active: SWING.active, recovery: SWING.recovery, miss: 0, arc: 90, maxTargets: 0, cooldown: { hero: COOLDOWN.hero, ai: COOLDOWN.ai }, shield: hands === 1, switch: 0.4, look: look };
    for (var k in more || {}) f[k] = more[k];
    return f;
  }
  C.weapon_families = {
    sword: family('sword', 'Sword', 1, 48, 'sword'),
    axe: family('axe', 'Axe', 1, 48, 'axe'),
    mace: family('mace', 'Mace', 1, 48, 'mace'),
    greatsword: family('greatsword', 'Greatsword', 2, 60, 'greatsword', { req: { str: 7, skills: { two_handed: 1 } } }),
    greataxe: family('greataxe', 'Greataxe', 2, 56, 'greataxe', { req: { str: 7, skills: { two_handed: 1 } } }),
    spear: family('spear', 'Spear', 1, 70, 'spear'),
    pike: family('pike', 'Pike', 2, 72, 'pike', { req: { str: 6, skills: { polearm: 1 } } }),
    lance: family('lance', 'Lance', 1, 70, 'lance', { req: { skills: { riding: 2 } } }),
    shortbow: family('shortbow', 'Shortbow', 2, 48, 'bow', { shield: false, ranged: { range: 225, projectileSpeed: 240, cooldown: 1.6, accuracy: 0.6 } }),
    longbow: family('longbow', 'Longbow', 2, 48, 'bow', { req: { str: 6, skills: { archery: 1 } }, shield: false, ranged: { range: 225, projectileSpeed: 240, cooldown: 1.6, accuracy: 0.6 } }),
    composite: family('composite', 'Composite bow', 2, 48, 'recurve', { req: { skills: { archery: 2 } }, shield: false, ranged: { range: 215, projectileSpeed: 240, cooldown: 1.6, accuracy: 0.6 } }),
    crossbow: family('crossbow', 'Crossbow', 2, 48, 'crossbow', { req: { str: 6 }, shield: false, ranged: { range: 240, projectileSpeed: 300, cooldown: 2.2, accuracy: 0.7 } }),
    unarmed: family('unarmed', 'Unarmed', 1, 48, null)
  };
})(typeof window !== 'undefined' ? window : globalThis);
