/* Crownless player character (GDD §5): creation, attributes, skills, equipment and the
 * derived numbers other systems use (hero combat stats, travel speed).
 * State: CL.campaign.character (null until created) and CL.campaign.equipment. Pure logic. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const ATTRIBUTES = ['str', 'agi', 'int', 'cha'];
  const ATTRIBUTE_NAMES = { str: 'Strength', agi: 'Agility', int: 'Intelligence', cha: 'Charisma' };
  const SLOTS = ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'horse', 'ring'];
  const SLOT_NAMES = {
    weapon: 'Weapon',
    offhand: 'Shield',
    head: 'Helmet',
    body: 'Chest',
    hands: 'Gloves',
    feet: 'Boots',
    horse: 'Horse',
    ring: 'Ring',
  };
  const GENDERS = ['man', 'woman', 'unspecified'];
  const CLOAKS = ['crimson', 'forest', 'violet', 'ash'];
  const BASE_ATTRIBUTE = 5;
  const MAX_ATTRIBUTE = 20;
  const MAX_SKILL = 10;
  const MAX_NAME = 20;
  const UNARMED_DAMAGE = 6;
  const SKILL_DAMAGE = 0.03; // GDD §6: × (1 + 0.03 × WeaponSkill)
  const PATHFINDING_SPEED = 0.03; // per point; GDD names the skill, the rate is our starting value

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
  function create({ name, gender, cloak, background }) {
    const bg = CL.content.table('backgrounds')[background] || CL.content.get('backgrounds', 'farmhand');
    const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, BASE_ATTRIBUTE]));
    const skills = Object.fromEntries(skillIds().map((s) => [s, 0]));
    attributes[bg.attribute] += 1;
    skills[bg.skill] += 1;
    return {
      name: cleanName(name),
      gender: GENDERS.includes(gender) ? gender : 'unspecified',
      cloak: CLOAKS.includes(cloak) ? cloak : 'crimson',
      background: bg.id,
      attributes,
      skills,
      level: 1,
      xp: 0,
    };
  }

  /** Apply a background's starting kit to a fresh campaign (gold, equipped gear, pack items). */
  function applyKit(c, backgroundId) {
    const kit = CL.content.get('backgrounds', backgroundId).kit;
    c.gold = kit.gold;
    c.equipment = { ...blankEquipment(), ...kit.equipment };
    c.inventory = { ...kit.items };
  }

  function defaultEquipment() {
    const kit = CL.content.get('backgrounds', 'farmhand').kit;
    return { ...blankEquipment(), ...kit.equipment };
  }

  // ---- Derived numbers ----

  const equippedItems = (c = camp()) =>
    SLOTS.map((s) => c.equipment?.[s])
      .filter(Boolean)
      .map((id) => CL.content.item(id));

  /** Skill level including bonuses from equipped items (e.g. Ring of Roads → pathfinding). */
  function skill(id, c = camp()) {
    const base = c.character?.skills?.[id] ?? 0;
    return base + equippedItems(c).reduce((sum, it) => sum + (it.stats[id] || 0), 0);
  }

  function attribute(id, c = camp()) {
    return c.character?.attributes?.[id] ?? BASE_ATTRIBUTE;
  }

  /** The hero's battle numbers (GDD §5–6). */
  function heroCombat(c = camp()) {
    const weapon = c.equipment?.weapon ? CL.content.item(c.equipment.weapon) : null;
    const shield = c.equipment?.offhand ? CL.content.item(c.equipment.offhand) : null;
    const hp = 60 + 5 * attribute('str', c);
    const baseDamage = weapon ? weapon.stats.damage : UNARMED_DAMAGE;
    return {
      hp,
      maxhp: hp,
      damage: baseDamage * (1 + SKILL_DAMAGE * skill('one_handed', c)),
      armor: equippedItems(c).reduce((sum, it) => sum + (it.stats.armor || 0), 0),
      canBlock: Boolean(shield?.stats.block),
    };
  }

  /** World-map speed multiplier from Pathfinding and a horse. */
  function travelFactor(c = camp()) {
    const horse = c.equipment?.horse ? CL.content.item(c.equipment.horse) : null;
    return (1 + PATHFINDING_SPEED * skill('pathfinding', c)) * (1 + (horse?.stats.travel || 0));
  }

  // ---- Equipment (atomic: an item is always in exactly one place) ----

  function equip(itemId, c = camp()) {
    const it = CL.content.table('items')[itemId];
    if (!it?.slot || !SLOTS.includes(it.slot) || !(c.inventory[itemId] > 0)) return false;
    const previous = c.equipment[it.slot];
    c.inventory[itemId] -= 1;
    if (!c.inventory[itemId]) delete c.inventory[itemId];
    if (previous) c.inventory[previous] = (c.inventory[previous] || 0) + 1;
    c.equipment[it.slot] = itemId;
    CL.diag.log('info', 'Equipped', { item: itemId, replaced: previous });
    return true;
  }

  function unequip(slot, c = camp()) {
    const id = c.equipment?.[slot];
    if (!id) return false;
    c.equipment[slot] = null;
    c.inventory[id] = (c.inventory[id] || 0) + 1;
    CL.diag.log('info', 'Unequipped', { item: id, slot });
    return true;
  }

  /**
   * Finish the creator. A new game replaces the campaign with a fresh one built from the
   * background's kit; an older save that predates characters just gains one.
   */
  function begin(choices) {
    const g = CL.game;
    if (g.newGame) {
      CL.campaign = CL.save.starter(choices.background);
      Object.assign(g, { newGame: false, travel: null, siteId: null, godMode: false });
    }
    CL.campaign.character = create(choices);
    CL.save.existed = true;
    CL.save.write();
    CL.diag.log('info', 'Character created', { name: CL.campaign.character.name, background: choices.background });
    CL.ui.changeMode(CL.party.currentSettlement() ? 'settlement' : 'map');
  }

  // ---- Save validation ----

  const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

  function sanitize(d) {
    if (!d || typeof d !== 'object' || !CL.content.table('backgrounds')[d.background]) return null;
    const ch = create({ name: d.name, gender: d.gender, cloak: d.cloak, background: d.background });
    for (const a of ATTRIBUTES) if (isInt(d.attributes?.[a], 1, MAX_ATTRIBUTE)) ch.attributes[a] = d.attributes[a];
    for (const s of skillIds()) if (isInt(d.skills?.[s], 0, MAX_SKILL)) ch.skills[s] = d.skills[s];
    if (isInt(d.level, 1, 99)) ch.level = d.level;
    if (isInt(d.xp, 0, 1e9)) ch.xp = d.xp;
    return ch;
  }

  /** Keep only real items in the slot they belong to; a missing block means "use the kit". */
  function sanitizeEquipment(d) {
    if (!d || typeof d !== 'object') return defaultEquipment();
    const eq = blankEquipment();
    for (const s of SLOTS) {
      const it = CL.content.table('items')[d[s]];
      if (it && it.slot === s) eq[s] = it.id;
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
    UNARMED_DAMAGE,
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
    sanitize,
    sanitizeEquipment,
  };
})(typeof window !== 'undefined' ? window : globalThis);
