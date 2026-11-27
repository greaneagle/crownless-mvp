/* Crownless content: weapon families (P11-01; docs/PHASE-11-PLAN.md §6). Plain classic script; no modules, no fetch.
 * A family is the default for a kind of weapon; an item (data/items.js `family`, an optional `combat`
 * block of overrides) or a troop (data/troops.js `weapon`: P11-11, the family's timing, reach, shot and
 * brace are the troop's, a row giving only its own damage, HP and armour, and `reach` or `ranged` where
 * it is deliberately different) picks one, and js/profile.js resolves a fighter's combat profile from it.
 * P11-05: each melee family has its own rhythm (docs/PHASE-11-PLAN.md §10.1–§10.2, the numbers measured
 * with scripts/duel-lab.js); the bows' and the lance's are still 5.0.0's sword (P11-07, P11-08):
 *   hands       1 or 2
 *   reach       the far edge of a blow (px) when nothing else gives one
 *   windup, active, recovery   the swing's three parts (s); the blow lands in `active`
 *   arc         the cone of a blow (degrees, the whole cone)
 *   cooldown    from one attack's start to the next (s): `hero` and `ai` are the same from P11-05 (D-P11d:
 *               the hero obeys the same body rules as everyone)
 *   miss        extra recovery when the active window strikes nobody (s): a whiff costs tempo
 *   maxTargets  how many one blow can strike, nearest first (the second and later at reduced damage);
 *               0 = every one in reach and arc
 *   stagger     how hard a blow interrupts: it stops a windup when it beats the target's `poise`
 *   poise       resistance to stagger while holding it (a two-handed grip is steadier)
 *   shieldPressure  how hard it presses a raised shield (a shield breaks at its capacity)
 *   knockback   how far a landed blow pushes (px), shrinking on repeated hits
 *   moveDuringAttack  the share of walking speed while committed to a swing
 *   guard       'shield' (a shield in the other hand blocks), 'weapon' (Block raises the weapon: it takes
 *               part of a frontal blow, in a narrower arc), 'none'
 *   skill       the skill that trains it (+3% damage a point, and `skillRecovery` less recovery a point)
 *   mounted     P11-08: its use from the saddle: 'yes', 'penalty' (less damage, slower; Riding eases it) or 'no'
 *   pierce      P11-06: the share of the target's armour a blow ignores (a mace's weight, a crossbow's bolt)
 *   brace       P11-11: it braces against a charge (spears and pikes); a troop may add it (a shield line's skill)
 *   shield      whether a shield can be carried with it (a two-handed weapon or a bow slings it on the back)
 *   switch      seconds to bring it to hand from the other weapon (P11-02; 0.4 for every family until P11-05)
 *   ranged      a bow's or crossbow's shot when the troop gives none: `range` (effective: full damage to here),
 *               `maxRange` (it falls after this; damage halves on the way), `projectileSpeed`, `cooldown`
 *               (a troop's between shots), `accuracy` (the chance a shot flies true), and for the hero
 *               (P11-07): `draw` (s to a full draw; a crossbow's reload, on the spot) and `ammo` (a quiver)
 *   look        the art kit's weapon part
 *   req         P11-03: what a piece of the family needs unless it says (`req` on the item; `{}` for nothing):
 *               { str?, agi?, skills?: { id: n }, training? }, held to the budget's rule (js/gear.js) */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  // 5.0.0's one-handed sword: the bows, crossbow and lance keep it until their tasks.
  var OLD = { windup: 0.16, active: 0.12, recovery: 0.24, cooldown: 0.86, miss: 0, arc: 90, maxTargets: 0, stagger: 1, poise: 1, shieldPressure: 1, knockback: 6, moveDuringAttack: 1, guard: 'none', skill: null, skillRecovery: 0, pierce: 0 };
  function family(id, name, hands, reach, look, rhythm, more) {
    var r = rhythm || OLD;
    var f = { id: id, name: name, hands: hands, reach: reach, windup: r.windup, active: r.active, recovery: r.recovery, miss: r.miss, arc: r.arc, maxTargets: r.maxTargets, cooldown: { hero: r.cooldown, ai: r.cooldown }, stagger: r.stagger, poise: r.poise, shieldPressure: r.shieldPressure, knockback: r.knockback, moveDuringAttack: r.moveDuringAttack, guard: r.guard, skill: r.skill, skillRecovery: r.skillRecovery, pierce: r.pierce || 0, shield: hands === 1, switch: 0.4, look: look };
    if (r.brace) f.brace = true; // P11-11: spears and pikes brace against a charge
    for (var k in more || {}) f[k] = more[k];
    return f;
  }
  // P11-05's rhythms: windup, active, recovery and the cooldown in seconds; the rest as the header says.
  var R = {
    // Versatile: middling reach and tempo, up to three targets (the second and third at less), a shield.
    sword: { windup: 0.16, active: 0.12, recovery: 0.26, cooldown: 0.68, miss: 0.2, arc: 90, maxTargets: 3, stagger: 1.3, poise: 1, shieldPressure: 1, knockback: 6, moveDuringAttack: 0.5, guard: 'shield', skill: 'one_handed', skillRecovery: 0.02 },
    // Shield pressure and impact; shorter, one target.
    axe: { windup: 0.2, active: 0.12, recovery: 0.28, cooldown: 0.74, miss: 0.24, arc: 80, maxTargets: 1, stagger: 1.6, poise: 1, shieldPressure: 2.5, knockback: 8, moveDuringAttack: 0.45, guard: 'shield', skill: 'one_handed', skillRecovery: 0.02 },
    // Staggers; short, one target.
    mace: { windup: 0.2, active: 0.12, recovery: 0.28, cooldown: 0.74, miss: 0.24, arc: 70, maxTargets: 1, stagger: 2.6, poise: 1, shieldPressure: 1.5, knockback: 9, moveDuringAttack: 0.45, guard: 'shield', skill: 'one_handed', skillRecovery: 0.02, pierce: 0.3 },
    // Longer reach, a wide arc and three targets; slow to recover; a steady grip; a weapon guard.
    greatsword: { windup: 0.26, active: 0.16, recovery: 0.36, cooldown: 0.92, miss: 0.3, arc: 120, maxTargets: 3, stagger: 2.2, poise: 2.5, shieldPressure: 2, knockback: 10, moveDuringAttack: 0.3, guard: 'weapon', skill: 'two_handed', skillRecovery: 0.02 },
    // Heavy impact and knockback, a long commitment.
    greataxe: { windup: 0.32, active: 0.16, recovery: 0.42, cooldown: 1.04, miss: 0.36, arc: 100, maxTargets: 2, stagger: 3, poise: 2.5, shieldPressure: 3.5, knockback: 14, moveDuringAttack: 0.25, guard: 'weapon', skill: 'two_handed', skillRecovery: 0.02 },
    // Reach and distance control; a quick, narrow thrust; a shield allowed (a weapon guard without one).
    spear: { brace: true, windup: 0.18, active: 0.1, recovery: 0.24, cooldown: 0.68, miss: 0.18, arc: 40, maxTargets: 1, stagger: 1.1, poise: 1, shieldPressure: 1, knockback: 5, moveDuringAttack: 0.5, guard: 'shield', skill: 'polearm', skillRecovery: 0.02 },
    // The longest reach, the narrowest thrust; steady; no shield.
    pike: { brace: true, windup: 0.22, active: 0.12, recovery: 0.3, cooldown: 0.82, miss: 0.22, arc: 30, maxTargets: 1, stagger: 1, poise: 2, shieldPressure: 1, knockback: 4, moveDuringAttack: 0.3, guard: 'weapon', skill: 'polearm', skillRecovery: 0.02 },
    // Fists: quick and weak.
    unarmed: { windup: 0.14, active: 0.1, recovery: 0.2, cooldown: 0.6, miss: 0.15, arc: 90, maxTargets: 1, stagger: 0.5, poise: 1, shieldPressure: 0.5, knockback: 4, moveDuringAttack: 0.6, guard: 'none', skill: null, skillRecovery: 0 },
  };
  C.weapon_families = {
    sword: family('sword', 'Sword', 1, 52, 'sword', R.sword),
    axe: family('axe', 'Axe', 1, 46, 'axe', R.axe),
    mace: family('mace', 'Mace', 1, 46, 'mace', R.mace),
    greatsword: family('greatsword', 'Greatsword', 2, 64, 'greatsword', R.greatsword, { req: { str: 7, skills: { two_handed: 1 } } }),
    greataxe: family('greataxe', 'Greataxe', 2, 60, 'greataxe', R.greataxe, { req: { str: 7, skills: { two_handed: 1 } } }),
    spear: family('spear', 'Spear', 1, 70, 'spear', R.spear),
    pike: family('pike', 'Pike', 2, 72, 'pike', R.pike, { req: { str: 6, skills: { polearm: 1 } } }),
    lance: family('lance', 'Lance', 1, 70, 'lance', null, { req: { skills: { riding: 2 } } }),
    // P11-07: the shortbow quick and light, the longbow far and slow to draw (and poor in heavy armour),
    // the crossbow slow to load (on the spot), flat and fast, piercing, aimed by anyone (Strength loads it).
    shortbow: family('shortbow', 'Shortbow', 2, 48, 'bow', null, { skill: 'archery', armourLimit: 5, shield: false, ranged: { range: 225, maxRange: 330, projectileSpeed: 260, cooldown: 1.6, accuracy: 0.6, draw: 0.55, ammo: 24 } }),
    longbow: family('longbow', 'Longbow', 2, 48, 'bow', null, { skill: 'archery', armourLimit: 3, req: { str: 6, skills: { archery: 1 } }, shield: false, ranged: { range: 270, maxRange: 420, projectileSpeed: 300, cooldown: 1.6, accuracy: 0.6, draw: 0.9, ammo: 20 } }),
    composite: family('composite', 'Composite bow', 2, 48, 'recurve', null, { skill: 'archery', armourLimit: 5, req: { skills: { archery: 2 } }, shield: false, ranged: { range: 215, maxRange: 310, projectileSpeed: 270, cooldown: 1.6, accuracy: 0.6, draw: 0.5, ammo: 24 } }),
    crossbow: family('crossbow', 'Crossbow', 2, 48, 'crossbow', null, { pierce: 0.3, req: { str: 6 }, shield: false, ranged: { range: 260, maxRange: 440, projectileSpeed: 420, cooldown: 2.2, accuracy: 0.7, draw: 2.0, ammo: 16 } }),
    unarmed: family('unarmed', 'Unarmed', 1, 40, null, R.unarmed)
  };
  // P11-08: each family's use from the saddle ('yes', 'penalty': less damage and slower, Riding eases it; 'no').
  var MOUNTED = { sword: 'yes', axe: 'yes', mace: 'yes', greatsword: 'penalty', greataxe: 'no', spear: 'yes', pike: 'no', lance: 'yes', shortbow: 'penalty', longbow: 'no', composite: 'yes', crossbow: 'no', unarmed: 'yes' };
  for (var k in MOUNTED) C.weapon_families[k].mounted = MOUNTED[k];
})(typeof window !== 'undefined' ? window : globalThis);
