/* Crownless player character (GDD §5): creation, attributes, skills, equipment and the
 * derived numbers other systems use (hero combat stats, travel speed).
 * State: CL.campaign.character (null until created) and CL.campaign.equipment. Pure logic. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const ATTRIBUTES = ['str', 'agi', 'int', 'cha'];
  const ATTRIBUTE_NAMES = { str: 'Strength', agi: 'Agility', int: 'Intelligence', cha: 'Charisma' };
  // P11-02: `weapon2`, a second weapon carried (any weapon); `ammo`, a quiver or bolt case (P11-07).
  const SLOTS = ['weapon', 'weapon2', 'offhand', 'head', 'body', 'hands', 'feet', 'horse', 'ring', 'ammo'];
  const SLOT_NAMES = {
    weapon: 'Weapon',
    weapon2: 'Second weapon',
    offhand: 'Shield',
    head: 'Helmet',
    body: 'Chest',
    hands: 'Gloves',
    feet: 'Boots',
    horse: 'Horse',
    ring: 'Ring',
    ammo: 'Quiver',
  };
  /** Does an item go in this slot? A weapon also goes in the second weapon's. @param {any} it @param {string} slot */
  const fits = (it, slot) => Boolean(it?.slot) && (it.slot === slot || (slot === 'weapon2' && it.slot === 'weapon'));
  const GENDERS = ['man', 'woman', 'unspecified'];
  const CLOAKS = ['crimson', 'forest', 'violet', 'ash'];
  const BASE_ATTRIBUTE = 5;
  const MAX_ATTRIBUTE = 20;
  const MAX_SKILL = 10;
  const MAX_NAME = 20;
  const UNARMED_DAMAGE = 6;
  const SKILL_DAMAGE = 0.03; // GDD §6: × (1 + 0.03 × WeaponSkill)
  const PATHFINDING_SPEED = 0.03; // per point; GDD names the skill, the rate is our starting value
  // P11-03 (D-P11b): the cap raised from the GDD's 10 so the points fit ten skills (data/character.js
  // `budget.cap`, checked equal by tests/requirements.test.js). Levels 1–10 cost what they did.
  const MAX_LEVEL = 20;
  /** Past level 10 each level costs STEP more than the one before, from 10's own cost (measured, §7). */
  const CURVE_FROM = 10;
  const CURVE_STEP = 550;
  const INT_XP = 0.02; // GDD: INT modestly influences XP — +2% per point above 5

  const camp = () => CL.campaign;
  const skillIds = () => Object.keys(CL.content.table('skills'));
  const blankEquipment = () => Object.fromEntries(SLOTS.map((s) => [s, null]));

  function cleanName(name) {
    // Drop control characters and angle brackets; names are only ever shown via textContent.
    const s = [...String(name ?? '')]
      .filter((ch) => ch >= ' ' && ch !== '<' && ch !== '>')
      .join('')
      .trim()
      .slice(0, MAX_NAME);
    return s || 'Wanderer';
  }

  /** A new character from creator choices. Unknown choices fall back to safe defaults. */
  /** P10-05: the origins a new hero chooses from (data/origins.js); the first is the default. */
  const origins = () => CL.content.table('origins');
  const defaultOrigin = () => (origins().farmhand ? 'farmhand' : Object.keys(origins())[0]);

  function create({ name, gender, cloak, origin }) {
    const bg = origins()[origin] || origins()[defaultOrigin()];
    const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, BASE_ATTRIBUTE]));
    const skills = Object.fromEntries(skillIds().map((s) => [s, 0]));
    attributes[bg.attribute] += 1;
    skills[bg.skill] += 1;
    return {
      name: cleanName(name),
      gender: GENDERS.includes(gender) ? gender : 'unspecified',
      cloak: CLOAKS.includes(cloak) ? cloak : 'crimson',
      origin: bg.id,
      attributes,
      skills,
      level: 1,
      xp: 0, // toward the next level
      skillPoints: 0,
      attributePoints: 0,
      // P11-03: the points spent on each (what retraining gives back), and the training done (P11-17).
      spent: { attributes: {}, skills: {} },
      training: {},
    };
  }

  // ---- Levels (GDD §5) ----

  /**
   * XP needed to go from level L to L + 1: round(100 × L^1.35) to level 10 (as the GDD); from 10, a
   * flatter line, CURVE_STEP more each level (P11-03, set from P11-00's measured pace).
   */
  const xpToNext = (level) => (level < CURVE_FROM ? Math.round(100 * level ** 1.35) : Math.round(100 * CURVE_FROM ** 1.35) + CURVE_STEP * (level - CURVE_FROM));
  /** All the XP from level 1 to `level`. */
  const xpTotal = (level) => {
    let n = 0;
    for (let L = 1; L < level; L++) n += xpToNext(L);
    return n;
  };
  /** The points a character has earned by a level: a skill point each level, an attribute point each even one. */
  const pointsAt = (level) => ({ skills: level - 1, attributes: Math.floor(level / 2) });

  /**
   * Add XP (scaled by Intelligence). Each level: +1 skill point; every 2nd level: +1 attribute
   * point. Returns the number of levels gained.
   */
  function gainXp(amount, c = camp()) {
    const ch = c.character;
    if (!ch || amount <= 0) return 0;
    ch.xp += Math.round(amount * (1 + INT_XP * (attribute('int', c) - BASE_ATTRIBUTE)));
    let gained = 0;
    while (ch.level < MAX_LEVEL && ch.xp >= xpToNext(ch.level)) {
      ch.xp -= xpToNext(ch.level);
      ch.level++;
      ch.skillPoints++;
      if (ch.level % 2 === 0) ch.attributePoints++;
      gained++;
    }
    if (ch.level >= MAX_LEVEL) ch.xp = 0;
    if (gained) CL.audio?.play('level');
    if (gained) CL.diag.log('info', 'Level up', { level: ch.level, skillPoints: ch.skillPoints, attributePoints: ch.attributePoints });
    return gained;
  }

  function spendSkill(id, c = camp()) {
    const ch = c.character;
    if (!ch?.skillPoints || !(id in ch.skills) || ch.skills[id] >= MAX_SKILL) return false;
    ch.skills[id]++;
    ch.skillPoints--;
    ch.spent.skills[id] = (ch.spent.skills[id] || 0) + 1;
    return true;
  }

  function spendAttribute(id, c = camp()) {
    const ch = c.character;
    if (!ch?.attributePoints || !ATTRIBUTES.includes(id) || ch.attributes[id] >= MAX_ATTRIBUTE) return false;
    ch.attributes[id]++;
    ch.attributePoints--;
    ch.spent.attributes[id] = (ch.spent.attributes[id] || 0) + 1;
    return true;
  }

  /**
   * P11-03 (D-P11i): give back every point spent, to spend again. Only a master does it, for crowns
   * (P11-17); never in battle. The origin's and the story's grants stay. Returns the points returned.
   */
  function retrain(c = camp()) {
    const ch = c.character;
    if (!ch || CL.game?.mode === 'battle') return null;
    const back = { attributes: 0, skills: 0 };
    for (const [a, n] of Object.entries(ch.spent.attributes)) {
      ch.attributes[a] -= n;
      back.attributes += n;
    }
    for (const [k, n] of Object.entries(ch.spent.skills)) {
      ch.skills[k] -= n;
      back.skills += n;
    }
    ch.attributePoints += back.attributes;
    ch.skillPoints += back.skills;
    ch.spent = { attributes: {}, skills: {} };
    CL.diag.log('info', 'Retrained', back);
    return back;
  }

  /** Apply an origin's starting kit to a fresh campaign (gold, equipped gear, pack items). */
  function applyKit(c, originId) {
    const kit = (origins()[originId] || origins()[defaultOrigin()]).kit;
    c.gold = kit.gold;
    c.equipment = { ...blankEquipment(), ...kit.equipment };
    c.inventory = { ...kit.items };
  }

  function defaultEquipment() {
    const kit = origins()[defaultOrigin()].kit;
    return { ...blankEquipment(), ...kit.equipment };
  }

  // ---- Derived numbers ----

  const equippedItems = (c = camp(), equipment = c.equipment) =>
    SLOTS.map((s) => equipment?.[s])
      .filter(Boolean)
      .map((id) => CL.content.item(id));

  /**
   * P11-03 (plan §7.4): a skill's **base** value, what requirements read: the points spent, the origin's,
   * the story's and training's grants; never an item's, a companion's or the retinue's bonus.
   */
  function baseSkill(id, c = camp()) {
    const ch = c.character;
    if (!ch) return 0;
    const taught = CL.content.table('training');
    let n = ch.skills?.[id] ?? 0;
    for (const t of Object.keys(ch.training || {})) n += taught[t]?.skills?.[id] || 0;
    return n;
  }

  /** P11-03: an attribute's base value (the same as `attribute`: nothing yet adds to one for a while). */
  const baseAttribute = (id, c = camp()) => c.character?.attributes?.[id] ?? BASE_ATTRIBUTE;

  /** Skill level including bonuses from equipped items (e.g. Ring of Roads → pathfinding): effective, for what a skill does. */
  function skill(id, c = camp()) {
    const base = c.character?.skills?.[id] ?? 0;
    return base + equippedItems(c).reduce((sum, it) => sum + (it.stats[id] || 0), 0) + (CL.companion?.skillBonus(id, c) || 0) + (CL.retinue?.skillBonus(id, c) || 0);
  }

  function attribute(id, c = camp()) {
    return c.character?.attributes?.[id] ?? BASE_ATTRIBUTE;
  }

  /**
   * The hero's battle numbers (GDD §5–6). `equipment`: the gear to fight in (the hero's own, or the
   * tournament's loaner kit, P7-09); the hero's own gear is never moved for it.
   */
  function heroCombat(c = camp(), equipment = c.equipment, which = CL.gear.bestLoadout(c, equipment)) {
    // P11-01: one profile (js/profile.js); P11-02: from the loadout in hand (a slung shield doesn't count).
    const p = CL.profile.resolve({ hero: c, equipment: CL.gear.kitFor(c, equipment, which) });
    return { hp: p.hp, maxhp: p.maxhp, damage: p.damage, armor: p.armor, canBlock: p.canBlock };
  }

  /** World-map speed multiplier from Pathfinding and a horse. */
  function travelFactor(c = camp()) {
    const horse = c.equipment?.horse ? CL.content.item(c.equipment.horse) : null;
    return (1 + PATHFINDING_SPEED * skill('pathfinding', c)) * (1 + (horse?.stats.travel || 0));
  }

  // ---- Equipment (atomic: an item is always in exactly one place) ----

  /** Put an item from the pack in its slot (a weapon in `weapon2` to carry it second); what was there goes to the pack. */
  function equip(itemId, c = camp(), slot = null) {
    const it = CL.content.table('items')[itemId];
    const to = slot || it?.slot;
    if (!fits(it, to) || !SLOTS.includes(to) || !(c.inventory[itemId] > 0)) return false;
    const previous = c.equipment[to];
    c.inventory[itemId] -= 1;
    if (!c.inventory[itemId]) delete c.inventory[itemId];
    if (previous) c.inventory[previous] = (c.inventory[previous] || 0) + 1;
    c.equipment[to] = itemId;
    CL.diag.log('info', 'Equipped', { item: itemId, slot: to, replaced: previous });
    return true;
  }

  function unequip(slot, c = camp()) {
    const id = c.equipment?.[slot];
    if (!id) return false;
    c.equipment[slot] = null;
    c.inventory[id] = (c.inventory[id] || 0) + 1;
    CL.diag.log('info', 'Unequipped', { item: id, slot });
    // P11-02: the active weapon taken off: the second weapon becomes the first.
    if (slot === 'weapon' && c.equipment.weapon2) swapWeapons(c);
    if (c.loadout?.start === 'secondary' && !c.equipment.weapon2) c.loadout.start = 'primary';
    return true;
  }

  /** P11-02: the first and second weapons change places (nothing goes to the pack). */
  function swapWeapons(c = camp()) {
    const eq = c.equipment;
    if (!eq || (!eq.weapon && !eq.weapon2)) return false;
    [eq.weapon, eq.weapon2] = [eq.weapon2 || null, eq.weapon || null];
    if (!eq.weapon2 && c.loadout?.start === 'secondary') c.loadout.start = 'primary';
    CL.diag.log('info', 'Weapons swapped', { weapon: eq.weapon, weapon2: eq.weapon2 });
    return true;
  }

  /**
   * Finish the creator. A new game replaces the campaign with a fresh one built from the
   * background's kit; an older save that predates characters just gains one.
   */
  function begin(choices) {
    const g = CL.game;
    if (g.newGame) {
      // P10-04: the kingdom you chose; P10-05: your origin. `plain` (bots and scripts): the bare GDD
      // start, in the start town with the common quest, whatever the origin.
      CL.campaign = CL.save.starter(choices.origin, choices.realm, { plain: Boolean(choices.plain) });
      Object.assign(g, { newGame: false, travel: null, siteId: null, godMode: false });
    }
    const fresh = !CL.campaign.character;
    CL.campaign.character = create(choices);
    if (fresh) CL.story.opening(CL.campaign, { plain: Boolean(choices.plain) }); // P10-05: your origin's opening quest begins (or the common quest)
    CL.save.existed = true;
    CL.save.write();
    CL.diag.log('info', 'Character created', { name: CL.campaign.character.name, origin: CL.campaign.character.origin });
    if (CL.party.currentSettlement()) CL.town.enterPlace();
    else CL.ui.changeMode('map');
  }

  // ---- Save validation ----

  const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

  function sanitize(d) {
    if (!d || typeof d !== 'object' || !origins()[d.origin]) return null;
    const ch = create({ name: d.name, gender: d.gender, cloak: d.cloak, origin: d.origin });
    for (const a of ATTRIBUTES) if (isInt(d.attributes?.[a], 1, MAX_ATTRIBUTE)) ch.attributes[a] = d.attributes[a];
    for (const s of skillIds()) if (isInt(d.skills?.[s], 0, MAX_SKILL)) ch.skills[s] = d.skills[s];
    if (isInt(d.level, 1, MAX_LEVEL)) ch.level = d.level;
    if (isInt(d.xp, 0, 1e9)) ch.xp = d.xp;
    if (isInt(d.skillPoints, 0, 99)) ch.skillPoints = d.skillPoints;
    if (isInt(d.attributePoints, 0, 99)) ch.attributePoints = d.attributePoints;
    // P11-03: what was spent on each (never more than it holds), and the training done.
    for (const a of ATTRIBUTES) if (isInt(d.spent?.attributes?.[a], 1, ch.attributes[a])) ch.spent.attributes[a] = d.spent.attributes[a];
    for (const k of skillIds()) if (isInt(d.spent?.skills?.[k], 1, ch.skills[k])) ch.spent.skills[k] = d.spent.skills[k];
    if (d.training && typeof d.training === 'object') for (const [t, v] of Object.entries(d.training)) if (v === true && /^[a-z0-9_]{1,32}$/.test(t)) ch.training[t] = true;
    return ch;
  }

  /** Keep only real items in the slot they belong to; a missing block means "use the kit". */
  function sanitizeEquipment(d) {
    if (!d || typeof d !== 'object') return defaultEquipment();
    const eq = blankEquipment();
    for (const s of SLOTS) {
      const it = CL.content.table('items')[d[s]];
      if (fits(it, s)) eq[s] = it.id;
    }
    return eq;
  }

  CL.character = {
    ATTRIBUTES,
    ATTRIBUTE_NAMES,
    SLOTS,
    SLOT_NAMES,
    GENDERS,
    CLOAKS,
    MAX_NAME,
    MAX_LEVEL,
    MAX_SKILL,
    MAX_ATTRIBUTE,
    UNARMED_DAMAGE,
    SKILL_DAMAGE,
    CURVE_FROM,
    CURVE_STEP,
    xpToNext,
    xpTotal,
    pointsAt,
    gainXp,
    retrain,
    baseSkill,
    baseAttribute,
    spendSkill,
    spendAttribute,
    create,
    begin,
    applyKit,
    defaultEquipment,
    blankEquipment,
    equippedItems,
    skill,
    attribute,
    heroCombat,
    travelFactor,
    equip,
    unequip,
    swapWeapons,
    fits,
    sanitize,
    sanitizeEquipment,
  };
})(typeof window !== 'undefined' ? window : globalThis);
