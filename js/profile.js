// @ts-check
/* Crownless combat profiles (P11-01; docs/PHASE-11-PLAN.md §6.1–§6.2): one place that says what a
 * fighter's weapon does. A profile is resolved from a weapon family (data/weapons.js), the item or the
 * troop's weapon reference that overrides it, and the wielder (a troop, the hero, a companion; a lord in
 * person or a tournament fighter scale it). The simulation, the AI, the art and the auto-resolve read
 * the profile; nothing else holds a swing's timing, a cooldown or a blow's arc.
 * In 5.1.0 every profile reproduces 5.0.0's numbers exactly. Pure logic, no DOM. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** The one-handed sword's timing (GDD §6), the default when a fighter has no profile (the wagon). */
  const SWORD = { windup: 0.16, active: 0.12, recovery: 0.24 };
  const DEFAULT_TIMING = { ...SWORD, total: SWORD.windup + SWORD.active + SWORD.recovery };
  const DEFAULT_COOLDOWN = { hero: DEFAULT_TIMING.total, ai: 0.86 };
  const DEFAULT_ARC = Math.cos(Math.PI / 4);

  /** A look's weapon part to its family (troops, and a pack troop's look). */
  const LOOK_FAMILY = { sword: 'sword', axe: 'axe', greataxe: 'greataxe', spear: 'spear', pike: 'pike', lance: 'lance', crossbow: 'crossbow', hammer: 'mace', club: 'mace', staff: 'mace' };

  const families = () => CL.content.table('weapon_families');

  /** A look's weapon as a family: a bow by its size (1.15 and up a longbow). @param {any} look */
  function familyOfLook(look) {
    const w = look?.weapon;
    if (w === 'bow') return (look.bowSize || 1) >= 1.15 ? 'longbow' : 'shortbow';
    return LOOK_FAMILY[w] || null;
  }

  /**
   * A troop's weapon: its `weapon` (a family or an item id), else from its look, else from what it does
   * (as the art's default look: a bow or crossbow by its shot, a spear or lance for a long reach).
   * @param {any} t a troop record
   */
  function troopWeapon(t) {
    if (t.weapon) return t.weapon;
    if (t.role === 'hero') return 'unarmed';
    const fromLook = familyOfLook(t.look);
    if (fromLook) return fromLook;
    if (t.role === 'archer') return t.ranged?.projectileSpeed >= 300 ? 'crossbow' : 'shortbow';
    return t.reach >= 70 ? (t.role === 'cavalry' ? 'lance' : 'spear') : 'sword';
  }

  /**
   * A weapon reference (a family id or an item id) to its family and the item, if one.
   * @param {string | null | undefined} ref
   */
  function weaponOf(ref) {
    const F = families();
    if (!ref) return { family: F.unarmed, item: null };
    if (F[ref]) return { family: F[ref], item: null };
    const item = CL.content.table('items')[ref];
    if (!item) throw new Error(`Unknown weapon: ${ref}`);
    return { family: F[item.family] || F.unarmed, item };
  }

  /** The weapon's part of a profile: its family's fields, under the item's `combat` overrides. */
  function weaponPart(family, item) {
    const o = item?.combat || {};
    const pick = (k) => (o[k] ?? family[k]);
    const windup = pick('windup');
    const active = pick('active');
    const recovery = pick('recovery');
    const cd = { ...family.cooldown, ...(o.cooldown || {}) };
    const arcDeg = pick('arc');
    return {
      family: family.id,
      hands: pick('hands'),
      timing: { windup, active, recovery, total: windup + active + recovery },
      miss: pick('miss'),
      // 90° is cos(π/4) exactly as 5.0.0's ARC.attack (not cos of 45° in degrees, which differs in the last bit).
      arc: arcDeg === 90 ? DEFAULT_ARC : Math.cos(((arcDeg / 2) * Math.PI) / 180),
      maxTargets: pick('maxTargets') || Infinity,
      cooldown: { hero: cd.hero, ai: cd.ai },
      shield: pick('shield'),
      switch: pick('switch'), // P11-02: seconds to bring this weapon to hand
      look: pick('look'),
      familyReach: pick('reach'),
      familyRanged: family.ranged || null,
    };
  }

  /**
   * Resolve a combat profile. `source` is one of:
   *   { troop }                          a troop's body and weapon (data/troops.js)
   *   { hero: campaign, equipment }      the hero in that gear (theirs, or a tournament's loaner kit)
   *   { companion: def, equipment }      Mara or a retinue companion in their gear (data/companions.js)
   * `ctx` scales it: `leader` (a lord in person: hp and damage factors) or `duel` (a tournament fighter's
   * own hp, damage and armour). The numbers are the 5.0.0 ones each module computed before.
   * @param {any} source @param {any} [ctx]
   * @returns {Profile}
   */
  function resolve(source, ctx = {}) {
    /** @type {any} */
    let p;
    if (source.troop) {
      const t = CL.content.troop(source.troop);
      const w = weaponOf(troopWeapon(t));
      const part = weaponPart(w.family, w.item);
      // A troop's own damage, reach and shot override the family (P11-11 moves troops onto profiles).
      p = { ...part, hp: t.hp, maxhp: t.hp, damage: t.damage, armor: t.armor, speed: t.speed, reach: t.reach, ranged: t.ranged || null, canBlock: Boolean(t.shield) };
    } else if (source.hero) {
      const c = source.hero;
      const eq = source.equipment;
      const body = CL.content.troop('hero');
      const w = weaponOf(eq?.weapon || null);
      const part = weaponPart(w.family, w.item);
      const H = CL.character;
      const shield = eq?.offhand ? CL.content.item(eq.offhand) : null;
      const hp = 60 + 5 * H.attribute('str', c);
      const baseDamage = w.item ? w.item.stats.damage : H.UNARMED_DAMAGE;
      p = {
        ...part,
        hp,
        maxhp: hp,
        damage: baseDamage * (1 + H.SKILL_DAMAGE * H.skill('one_handed', c)),
        armor: H.equippedItems(c, eq).reduce((sum, it) => sum + (it.stats.armor || 0), 0),
        speed: body.speed,
        reach: body.reach,
        ranged: null,
        canBlock: Boolean(shield?.stats.block),
      };
    } else if (source.companion) {
      const d = source.companion;
      const eq = source.equipment || {};
      const item = (slot) => (eq[slot] ? CL.content.item(eq[slot]) : null);
      const weapon = item('weapon');
      const w = weaponOf(eq.weapon || null);
      const part = weaponPart(w.family, w.item);
      const armor = d.armor + d.gearSlots.reduce((sum, slot) => sum + (item(slot)?.stats.armor || 0), 0);
      p = { ...part, hp: d.hp, maxhp: d.hp, damage: weapon ? weapon.stats.damage * d.weaponFactor : d.unarmedDamage, armor, speed: d.speed, reach: d.reach, ranged: null, canBlock: false };
    } else throw new Error('A profile needs a troop, the hero or a companion');
    if (ctx.leader) Object.assign(p, { hp: Math.round(p.hp * ctx.leader.hp), maxhp: Math.round(p.maxhp * ctx.leader.hp), damage: p.damage * ctx.leader.damage });
    if (ctx.duel) Object.assign(p, { hp: ctx.duel.hp, maxhp: ctx.duel.hp, damage: ctx.duel.damage, armor: ctx.duel.armor });
    delete p.familyReach;
    delete p.familyRanged;
    return p;
  }

  /** The body and weapon numbers a profile puts on a unit (what combat reads off the unit). */
  const UNIT_FIELDS = ['hp', 'maxhp', 'damage', 'armor', 'speed', 'reach', 'ranged'];

  /**
   * Put a profile on a unit: its numbers and the profile itself (`of(u)`), as at makeUnit and whenever
   * the fighter's gear changes (the hero, a companion, a lord, a tournament fighter as a battle starts).
   * @param {any} u @param {Profile} p @param {string[]} [fields] which of the numbers to set (all by default)
   */
  function apply(u, p, fields = UNIT_FIELDS) {
    for (const k of fields) u[k] = p[k];
    u.profile = p;
    return u;
  }

  /** A unit's profile (built at makeUnit, rebuilt by `apply`). @param {any} u @returns {Profile | null} */
  const of = (u) => u?.profile || null;

  /** A unit's swing timing (the sword's when it has no profile, as the wagon). @param {any} u */
  const timingOf = (u) => u?.profile?.timing || DEFAULT_TIMING;

  /** The phase of a unit's swing: 'windup' | 'active' | 'recovery' | null. @param {any} u */
  function phaseOf(u) {
    if (!u.swing) return null;
    const T = timingOf(u);
    const t = u.swing.t;
    if (t < T.windup) return 'windup';
    if (t < T.windup + T.active) return 'active';
    if (t < T.total) return 'recovery';
    return null;
  }

  /**
   * Where a unit is in its swing, for the art: the phase and how far through it (0 to 1), from its own
   * timing. Null when it isn't swinging. @param {any} u @returns {{ phase: string, k: number } | null}
   */
  function attackProgress(u) {
    const ph = phaseOf(u);
    if (!ph) return null;
    const T = timingOf(u);
    const st = u.swing.t;
    const k = ph === 'windup' ? st / T.windup : ph === 'active' ? (st - T.windup) / T.active : (st - T.windup - T.active) / T.recovery;
    return { phase: ph, k: Math.max(0, Math.min(1, k)) };
  }

  /** From one melee attack's start to the next: the hero's or everyone else's. @param {any} u */
  function cooldownOf(u) {
    const cd = u?.profile?.cooldown || DEFAULT_COOLDOWN;
    return u.role === 'hero' ? cd.hero : cd.ai;
  }

  /** The cone of a unit's blow, as the minimum dot product against its facing. @param {any} u */
  const arcOf = (u) => u?.profile?.arc ?? DEFAULT_ARC;

  /** How many a unit's blow can strike (Infinity: everyone in reach and arc). @param {any} u */
  const targetsOf = (u) => u?.profile?.maxTargets ?? Infinity;

  /** How close a melee fighter must be to strike: just inside its reach. @param {any} u */
  const strikeRange = (u) => u.reach - 1;

  CL.profile = { SWORD, DEFAULT_TIMING, DEFAULT_COOLDOWN, LOOK_FAMILY, UNIT_FIELDS, familyOfLook, troopWeapon, weaponOf, resolve, apply, of, timingOf, phaseOf, attackProgress, cooldownOf, arcOf, targetsOf, strikeRange };
})(typeof window !== 'undefined' ? window : globalThis);
