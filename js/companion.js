/* Crownless companion (GDD §10): Mara. One named companion who travels with the hero, takes a party
 * slot, fights autonomously, wears a weapon and body armour from the pack and lends +1 Pathfinding
 * while fit. She is never killed in an ordinary battle: going down, or a capture, wounds her for a
 * couple of days. Her one story consequence (the Q3 incident) is decided by quest data through the
 * `companion` / `part` story effects.
 *
 * State: campaign.companion = null | { id, woundedUntil, away, equipment: { slot: itemId | null } }
 *        away: sent ahead by the story (Q3 scouting); out of battle and lends no skills until recalled.
 *        campaign.story.flags.<id>_gone is set when she leaves for good. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const def = (id) => CL.content.table('companions')[id] || null;
  const camp = () => CL.campaign;

  const get = (c = camp()) => c?.companion || null;
  const has = (c = camp(), id = null) => Boolean(get(c) && (!id || get(c).id === id));
  /** Fit to fight and to lend her skills: present and not wounded. */
  const fit = (c = camp()) => has(c) && get(c).woundedUntil === null && !get(c).away && !get(c).detached; // detached: leading a patrol (P7-05)
  /** Party slots she takes (GDD §5: "companion consumes one slot"). */
  const slots = (c = camp()) => (has(c) ? 1 : 0);

  /** Join the party. Fails when the company is full, someone is already with you, or she is gone. */
  function join(c, id) {
    const d = def(id);
    if (!d || has(c) || CL.story.state(c).flags[`${id}_gone`]) return false;
    if (CL.party.headcount(c) + 1 > CL.party.partyCap(c)) return false;
    c.companion = { id, woundedUntil: null, equipment: { ...d.startGear } };
    CL.story.state(c).flags[`${id}_joined`] = true;
    CL.diag.log('info', 'Companion joined', { id });
    CL.ui.message(`${d.name} joins your company.`);
    return true;
  }

  /** Leave for good (the story decides when). Her gear goes back to the pack. */
  function part(c, id, reason = 'parted') {
    const m = get(c);
    if (!m || m.id !== id) return false;
    for (const it of Object.values(m.equipment)) if (it) c.inventory[it] = (c.inventory[it] || 0) + 1;
    c.companion = null;
    CL.story.state(c).flags[`${id}_gone`] = reason;
    CL.diag.log('info', 'Companion left', { id, reason });
    return true;
  }

  function wound(c, reason) {
    const m = get(c);
    if (!m) return;
    m.woundedUntil = c.day + def(m.id).woundDays;
    CL.diag.log('info', 'Companion wounded', { id: m.id, until: m.woundedUntil, reason });
    CL.ui.message(`${def(m.id).name} is wounded and will rest for ${def(m.id).woundDays} days.`);
  }

  /** Called as the clock moves: she is back on her feet when her time is up. */
  function heal(c) {
    const m = get(c);
    if (m && m.woundedUntil !== null && m.woundedUntil <= c.day + 1e-9) {
      m.woundedUntil = null;
      CL.ui.message(`${def(m.id).name} is back on her feet.`);
    }
  }

  /** Skill points she lends the hero while fit (GDD: +1 Pathfinding while conscious). */
  const skillBonus = (id, c = camp()) => (fit(c) ? def(get(c).id).skills?.[id] || 0 : 0);

  /** Her battle numbers from her own stats and the gear she carries. */
  function combat(c = camp()) {
    const m = get(c);
    const p = CL.profile.resolve({ companion: def(m.id), equipment: m.equipment }); // P11-01: one profile
    return { hp: p.hp, maxhp: p.maxhp, damage: p.damage, armor: p.armor, speed: p.speed, reach: p.reach };
  }

  /** Auto-resolve strength: about one T3 soldier, more with good gear. */
  function power(c = camp()) {
    if (!fit(c)) return 0;
    const s = combat(c);
    return (s.hp * s.damage) / (45 * 7);
  }

  /** Give her an item from the pack; what she had goes back. */
  function give(c, itemId) {
    const m = get(c);
    const it = CL.content.table('items')[itemId];
    if (!m || !it || !def(m.id).gearSlots.includes(it.slot) || !(c.inventory[itemId] > 0)) return false;
    const previous = m.equipment[it.slot];
    c.inventory[itemId] -= 1;
    if (!c.inventory[itemId]) delete c.inventory[itemId];
    if (previous) c.inventory[previous] = (c.inventory[previous] || 0) + 1;
    m.equipment[it.slot] = itemId;
    return true;
  }

  /** Take an item back into the pack. */
  function takeBack(c, slot) {
    const m = get(c);
    const id = m?.equipment[slot];
    if (!id) return false;
    m.equipment[slot] = null;
    c.inventory[id] = (c.inventory[id] || 0) + 1;
    return true;
  }

  /** The story sends her ahead (scouting) or calls her back. */
  function send(c, id) {
    const m = get(c);
    if (!m || m.id !== id) return false;
    m.away = true;
    CL.diag.log('info', 'Companion sent ahead', { id });
    return true;
  }

  function recall(c, id) {
    const m = get(c);
    if (!m || m.id !== id || !m.away) return false;
    m.away = false;
    CL.diag.log('info', 'Companion back', { id });
    return true;
  }

  /** After a battle (fought or auto-resolved): down or captured means wounded. */
  function afterBattle(c, { win, down }) {
    if (!has(c) || get(c).away || get(c).detached) return;
    if (!win || down) wound(c, win ? 'down' : 'captured');
  }

  function sanitize(s, d) {
    s.companion = null;
    const m = d?.companion;
    const cd = def(m?.id);
    if (!cd) return;
    const equipment = {};
    for (const slot of cd.gearSlots) {
      const it = CL.content.table('items')[m.equipment?.[slot]];
      equipment[slot] = it && it.slot === slot ? it.id : null;
    }
    const w = m.woundedUntil;
    s.companion = { id: cd.id, woundedUntil: typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null, equipment };
    if (m.away === true) s.companion.away = true;
  }

  CL.companion = { def, get, has, fit, slots, join, part, send, recall, wound, heal, skillBonus, combat, power, give, takeBack, afterBattle, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
