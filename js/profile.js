// @ts-check
/* Crownless combat profiles (P11-01; docs/PHASE-11-PLAN.md §6.1–§6.2): one place that says what a
 * fighter's weapon does. A profile is resolved from a weapon family (data/weapons.js), the item or the
 * troop's weapon reference that overrides it, and the wielder (a troop, the hero, a companion; a lord in
 * person or a tournament fighter scale it). The simulation, the AI, the art and the auto-resolve read
 * the profile; nothing else holds a swing's timing, a cooldown or a blow's arc.
 * In 5.1.0 every profile reproduced 5.0.0's numbers exactly. P11-05 (5.5.0): each family's rhythm, a
 * whiff's cost, the targets a blow strikes, stagger and poise, shield pressure, knockback, the guard, and
 * the hero's body from the weapon in hand and data/character.js `body` (D-P11d). Pure logic, no DOM. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  /** The one-handed sword's timing (GDD §6), the default when a fighter has no profile (the wagon). */
  const SWORD = { windup: 0.16, active: 0.12, recovery: 0.24 };
  const DEFAULT_TIMING = { ...SWORD, total: SWORD.windup + SWORD.active + SWORD.recovery };
  const DEFAULT_COOLDOWN = { hero: DEFAULT_TIMING.total, ai: 0.86 };
  const DEFAULT_ARC = Math.cos(Math.PI / 4);

  /** A look's weapon part to its family (troops, and a pack troop's look). */
  const LOOK_FAMILY = { sword: 'sword', axe: 'axe', greataxe: 'greataxe', longaxe: 'greataxe', spear: 'spear', pike: 'pike', lance: 'lance', crossbow: 'crossbow', hammer: 'mace', club: 'mace', staff: 'mace', mace: 'mace', greatsword: 'greatsword', recurve: 'composite', arbalest: 'crossbow' }; // P11-04: the new parts

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
  const warned = new Set();
  function troopWeapon(t) {
    if (t.weapon) return t.weapon;
    if (t.role === 'hero') return 'unarmed';
    // P11-11: every troop names its weapon; an old pack's that doesn't gets one from its look or role, with a warning.
    if (!warned.has(t.id)) {
      warned.add(t.id);
      CL.diag?.log?.('warn', 'Troop without a weapon: one from its look or role', { troop: t.id });
    }
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
      // P11-05: interruption, shields, the push, moving while committed, the guard and the skill.
      stagger: pick('stagger') ?? 1,
      poise: pick('poise') ?? 1,
      shieldPressure: pick('shieldPressure') ?? 1,
      knockback: pick('knockback') ?? 6,
      moveDuringAttack: pick('moveDuringAttack') ?? 1,
      guardKind: pick('guard') || 'none',
      skill: pick('skill') || null,
      skillRecovery: pick('skillRecovery') || 0,
      pierce: pick('pierce') || 0, // P11-06: the share of armour a blow ignores
      // 90° is cos(π/4) exactly as 5.0.0's ARC.attack (not cos of 45° in degrees, which differs in the last bit).
      arc: arcDeg === 90 ? DEFAULT_ARC : Math.cos(((arcDeg / 2) * Math.PI) / 180),
      maxTargets: pick('maxTargets') || Infinity,
      cooldown: { hero: cd.hero, ai: cd.ai },
      shield: pick('shield'),
      brace: Boolean(pick('brace')), // P11-11: spears and pikes brace against a charge
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
      // P11-11: the weapon is the troop's: its family's timing, reach, shot and brace; the row gives its own
      // damage, HP, armour and pace, a shield (its kit), and a reach or shot only where deliberately different.
      const ranged = part.familyRanged ? { ...part.familyRanged, ...(t.ranged || {}) } : t.ranged || null;
      p = { ...part, hp: t.hp, maxhp: t.hp, damage: t.damage, armor: t.armor, speed: t.speed, reach: t.reach ?? part.familyReach, ranged, canBlock: Boolean(t.shield), guardKind: t.shield ? 'shield' : part.guardKind === 'weapon' ? 'weapon' : 'none', brace: t.brace ?? part.brace }; // a pike or two-hander guards with the weapon (plan §10.2), as the hero's does
      if (ranged) for (const k of ['draw', 'ammo']) delete ranged[k]; // the hero's own (a troop shoots by its cooldown)
      p.poise += armourPoise(t.look?.armour); // P11-06: armour steadies (troops keep their data's speed)
    } else if (source.hero) {
      const c = source.hero;
      const eq = source.equipment;
      const w = weaponOf(eq?.weapon || null);
      const part = weaponPart(w.family, w.item);
      const H = CL.character;
      const shield = eq?.offhand ? CL.content.item(eq.offhand) : null;
      const hp = 60 + 5 * H.attribute('str', c);
      const baseDamage = w.item ? w.item.stats.damage : H.UNARMED_DAMAGE;
      // P11-05: the weapon's own skill trains it: +3% damage a point (One-Handed did for every weapon),
      // and a little less recovery (the family's skillRecovery a point, at most a third).
      const trained = part.skill ? H.skill(part.skill, c) : 0;
      // P11-06: the load carried (the whole kit, not only what's in hand) slows the recovery when heavy.
      const enc = encumbrance(c, source.carried || eq);
      const slower = part.timing.recovery * (enc.recovery - 1);
      const rec0 = part.timing.recovery + slower;
      const quicker = Math.min(rec0 / 3, rec0 * part.skillRecovery * trained);
      const timing = { ...part.timing, recovery: rec0 - quicker, total: part.timing.total + slower - quicker };
      const cd = Math.max(timing.total, part.cooldown.hero + slower - quicker);
      const canBlock = Boolean(shield?.stats.block);
      // P11-07: a bow or crossbow in hand: the hero's own shot. Archery draws a bow faster and aims
      // truer; Strength loads a crossbow (Archery only aims it); a heavy load and armour heavier than the
      // bow allows draw slower.
      let ranged = null;
      if (part.familyRanged) {
        const fr = { ...part.familyRanged, ...(w.item?.combat?.ranged || {}) };
        const archery = H.skill('archery', c);
        const crossbow = part.family === 'crossbow';
        let draw = fr.draw ?? fr.cooldown;
        draw *= crossbow ? Math.max(0.6, 1 - 0.04 * (H.baseAttribute('str', c) - 6)) : Math.max(0.6, 1 - 0.03 * archery);
        draw *= enc.draw;
        const limit = w.item?.combat?.armourLimit ?? w.family.armourLimit;
        const body = eq?.body ? CL.content.table('items')[eq.body] : null;
        if (limit != null && (body?.stats.armor || 0) > limit) draw *= 1.25;
        // The hero aims (assisted, or by hand): truer than a troop's volley, 75% at the least.
        ranged = { ...fr, draw, maxRange: fr.maxRange ?? fr.range * 1.5, accuracy: Math.min(0.95, Math.max(0.75, fr.accuracy) + 0.03 * archery), crossbow };
      }
      p = {
        ...part,
        timing,
        cooldown: { hero: cd, ai: cd },
        hp,
        maxhp: hp,
        damage: baseDamage * (1 + H.SKILL_DAMAGE * trained),
        armor: H.equippedItems(c, eq).reduce((sum, it) => sum + (it.stats.armor || 0), 0),
        // D-P11d: the body is the hero's own, not the `hero` troop's: reach from the weapon, speed from a
        // walking pace, Agility and (until P11-06's load) the armour's class.
        speed: heroSpeed(c, source.carried || eq),
        reach: part.familyReach,
        ranged,
        poise: part.poise + armourPoise(armourClass(eq?.body)),
        load: enc.load,
        capacity: enc.capacity,
        band: enc.band.id,
        ramp: enc.ramp,
        drawFactor: enc.draw, // P11-07's bows
        canBlock,
        guardKind: canBlock ? 'shield' : part.guardKind === 'weapon' ? 'weapon' : 'none',
        // The Shield skill: more a shield takes before it breaks, a quicker recovery, a little wider.
        shieldSkill: H.skill('shield', c),
      };
    } else if (source.companion) {
      // (A companion keeps their own body: data/companions.js; their guard is none, as before.)
      const d = source.companion;
      const eq = source.equipment || {};
      const item = (slot) => (eq[slot] ? CL.content.item(eq[slot]) : null);
      const weapon = item('weapon');
      const w = weaponOf(eq.weapon || null);
      const part = weaponPart(w.family, w.item);
      const armor = d.armor + d.gearSlots.reduce((sum, slot) => sum + (item(slot)?.stats.armor || 0), 0);
      // P11-06: their gear is a load like anyone's (no attributes: the base capacity, no Agility).
      const enc = encumbrance(null, eq);
      const slower = part.timing.recovery * (enc.recovery - 1);
      const timing = { ...part.timing, recovery: part.timing.recovery + slower, total: part.timing.total + slower };
      // P11-11: their reach is their weapon's; a shield they carry blocks (none, no guard).
      const shield = Boolean(item('offhand')?.stats?.block);
      p = { ...part, timing, cooldown: { hero: part.cooldown.hero + slower, ai: part.cooldown.ai + slower }, hp: d.hp, maxhp: d.hp, damage: weapon ? weapon.stats.damage * d.weaponFactor : d.unarmedDamage, armor, speed: d.speed * enc.speed, reach: weapon ? part.familyReach : d.reach, ranged: null, canBlock: shield, guardKind: shield ? 'shield' : 'none', poise: part.poise + armourPoise(armourClass(eq.body)), load: enc.load, capacity: enc.capacity, band: enc.band.id };
    } else throw new Error('A profile needs a troop, the hero or a companion');
    if (ctx.leader) Object.assign(p, { hp: Math.round(p.hp * ctx.leader.hp), maxhp: Math.round(p.maxhp * ctx.leader.hp), damage: p.damage * ctx.leader.damage, armor: p.armor + (ctx.leader.armor || 0) }); // P11-11: and the realm's best kit
    if (ctx.duel) Object.assign(p, { hp: ctx.duel.hp, maxhp: ctx.duel.hp, damage: ctx.duel.damage, armor: ctx.duel.armor });
    delete p.familyReach;
    delete p.familyRanged;
    return p;
  }

  /** P11-06: a body armour piece's class (its look's, a forged piece its base's; by tier without one). */
  function armourClass(id) {
    const items = CL.content.table('items');
    let it = id ? items[id] : null;
    if (!it) return 'cloth';
    if (it.forgedFrom && items[it.forgedFrom]) it = items[it.forgedFrom];
    return it.look?.armour || ['cloth', 'gambeson', 'leather', 'mail'][Math.min(3, it.tier || 1)];
  }

  /** P11-06: the poise an armour class adds. */
  const armourPoise = (cls) => CL.content.table('encumbrance').poise?.[cls] || 0;

  /** P11-06: the weight a kit puts on its wearer: every slot but the horse (the pack and cargo never). */
  function loadOf(kit) {
    const items = CL.content.table('items');
    let n = 0;
    for (const [slot, id] of Object.entries(kit || {})) if (id && slot !== 'horse') n += items[id]?.weight || 0;
    return n;
  }

  /** P11-06: what a character carries easily, from base Strength (the base capacity with no character). */
  function capacityOf(c) {
    const E = CL.content.table('encumbrance');
    const str = c?.character ? CL.character.baseAttribute('str', c) : 5;
    return E.capacity.base + E.capacity.perStr * (str - 5);
  }

  /**
   * P11-06: a kit's load on a character: its band and what the band does, less Agility's share. Speed,
   * the walk's ramp, the recovery and the draw are factors (1: unchanged). @param {any} c @param {any} kit
   */
  function encumbrance(c, kit) {
    const E = CL.content.table('encumbrance');
    const load = loadOf(kit);
    const capacity = capacityOf(c);
    const ratio = load / capacity;
    const band = E.bands.find((b) => b.upTo == null || ratio <= b.upTo + 1e-9) || E.bands[E.bands.length - 1];
    const agi = c?.character ? CL.character.attribute('agi', c) - 5 : 0;
    const eased = Math.max(0, 1 - (E.agility || 0) * agi); // Agility lessens what the load costs
    return {
      load,
      capacity,
      ratio,
      band,
      speed: Math.max(E.floor ?? 0.6, 1 - (1 - band.speed) * eased),
      ramp: band.ramp * eased,
      recovery: 1 + (band.recovery - 1) * eased,
      draw: 1 + (band.draw - 1) * eased,
    };
  }

  /**
   * P11-05 (D-P11d): the hero's walking speed: data/character.js `body`'s pace and Agility's share a point
   * above 5; P11-06: under the load of what they carry. @param {any} c @param {any} kit
   */
  function heroSpeed(c, kit) {
    const B = CL.content.table('body');
    const agi = CL.character.attribute('agi', c) - 5;
    return (B.speed || 100) * (1 + (B.agility || 0) * agi) * encumbrance(c, kit).speed;
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
    if (t < T.total + (u.swing.miss || 0)) return 'recovery'; // P11-05: a whiff recovers longer
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
    const k = ph === 'windup' ? st / T.windup : ph === 'active' ? (st - T.windup) / T.active : (st - T.windup - T.active) / (T.recovery + (u.swing.miss || 0));
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

  CL.profile = { heroSpeed, loadOf, capacityOf, encumbrance, armourClass, armourPoise, SWORD, DEFAULT_TIMING, DEFAULT_COOLDOWN, LOOK_FAMILY, UNIT_FIELDS, familyOfLook, troopWeapon, weaponOf, resolve, apply, of, timingOf, phaseOf, attackProgress, cooldownOf, arcOf, targetsOf, strikeRange };
})(typeof window !== 'undefined' ? window : globalThis);
