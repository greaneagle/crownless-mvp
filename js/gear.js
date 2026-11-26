// @ts-check
/* Crownless gear: carried and wielded (P11-02; docs/PHASE-11-PLAN.md §8). The hero carries two weapons
 * (`weapon`, `weapon2`), a shield and a quiver; a **loadout** is the one in hand: `primary` (the first
 * weapon) or `secondary` (the second), each with the shield if the weapon leaves a hand free for it
 * (a two-handed weapon or a bow slings it on the back). **One gear check** says, in words, what a kit
 * means: every screen, the shops, Prepare, the lists and the battle ask it, so they say the same.
 * Findings: { kind, code, item, text, have, need, fix }; kinds `incompatible` (can't be used, or not
 * here), `requirement` (not yet met, P11-03), `penalty` (works, but worse), `note` (a consequence you
 * may not expect), `advice`. Text from data/gear_text.js. Pure logic except `switchWeapon`/`tick`,
 * which drive the hero in battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LOADOUTS = ['primary', 'secondary'];
  /** The findings' codes (data/gear_text.js has a line for each, and no other). */
  const CODES = ['two_hands', 'shoots', 'unarmed', 'no_second', 'fallback', 'loaner', 'mounted', 'heavy'];
  /** The most letters a finding may have once its names are in: two lines at 812×375, Larger text. */
  const TEXT_MAX = 120;
  const KINDS = ['incompatible', 'requirement', 'penalty', 'note', 'advice'];
  /** Each kind's mark: a shape as well as a word, never colour alone. */
  const ICONS = { incompatible: '✕', requirement: '🔒', penalty: '↓', note: 'i', advice: '✦' };
  const KIND_NAMES = { incompatible: "Can't be used", requirement: 'Not yet', penalty: 'Works less well', note: 'Note', advice: 'Advice' };
  const LOADOUT_NAMES = { primary: 'first weapon', secondary: 'second weapon' };
  /** A kind's order when findings are shown: the ones that stop you first. */
  const ORDER = Object.fromEntries(KINDS.map((k, i) => [k, i]));

  const item = (id) => (id ? CL.content.table('items')[id] || null : null);
  const nameOf = (id) => item(id)?.name || 'fists';

  /** The words of a finding, from data/gear_text.js. @param {string} code @param {Record<string, string>} [fill] */
  function words(code, fill = {}) {
    const t = CL.content.table('gear_text')[code] || code;
    return t.replace(/\{(\w+)\}/g, (_, k) => fill[k] ?? '');
  }

  /** The weapon a loadout holds. @param {any} kit equipment @param {string} which */
  const weaponIn = (kit, which) => (which === 'secondary' ? kit?.weapon2 : kit?.weapon) || null;

  /** The profile of a weapon in the hand (or the fists). */
  const weaponProfile = (id) => CL.profile.weaponOf(id || null);

  /** Can a shield be carried with this weapon? (A family's `shield`: one hand free, not a bow.) */
  function shieldFree(weaponId) {
    const { family, item: it } = weaponProfile(weaponId);
    return (it?.combat?.shield ?? family.shield) !== false;
  }

  /**
   * What a loadout puts in the hand: the weapon, the shield if the weapon leaves a hand for it, the ammo,
   * and whether the shield is slung (stowed) instead. @param {any} c @param {any} kit @param {string} which
   */
  function active(c, kit = c.equipment, which = 'primary') {
    const weapon = weaponIn(kit, which);
    const free = shieldFree(weapon);
    return { which, weapon, shield: free ? kit?.offhand || null : null, stowed: Boolean(kit?.offhand) && !free, ammo: kit?.ammo || null };
  }

  /**
   * The equipment a loadout fights in: the weapon in hand in `weapon`, no second weapon, the shield only
   * if it's in hand (a slung shield doesn't protect). What the hero's profile is resolved from.
   * @param {any} c @param {any} kit @param {string} which
   */
  function kitFor(c, kit = c.equipment, which = 'primary') {
    const a = active(c, kit, which);
    return { ...kit, weapon: a.weapon, weapon2: null, offhand: a.shield };
  }

  const finding = (kind, code, itemId, fill, extra = {}) => ({ kind, code, item: itemId || null, text: words(code, fill), have: null, need: null, fix: null, ...extra });

  /**
   * The findings for one loadout of a kit. `context`: `which` (the loadout; the best one by default),
   * `mounted` (on horseback), `loaner` (a tournament's kit). Sorted: what stops you first.
   * @param {any} c @param {any} [kit] @param {{ which?: string, mounted?: boolean, loaner?: boolean }} [context]
   */
  function check(c, kit = c.equipment, context = {}) {
    const which = context.which || bestLoadout(c, kit, context);
    const out = [];
    const a = active(c, kit, which);
    const w = weaponProfile(a.weapon);
    const shield = kit?.offhand || null;
    if (!a.weapon) out.push(finding('note', 'unarmed', null, {}));
    if (a.stowed) {
      const ranged = Boolean(w.family.ranged);
      out.push(finding('note', ranged ? 'shoots' : 'two_hands', a.weapon, { item: nameOf(a.weapon), shield: nameOf(shield) }));
    }
    // From horseback (P11-08 gives families their use there; none refuses it yet).
    const mounted = w.item?.combat?.mounted ?? w.family.mounted ?? 'yes';
    if (context.mounted && mounted === 'no') out.push(finding('incompatible', 'mounted', a.weapon, { item: nameOf(a.weapon) }));
    if (context.mounted && mounted === 'penalty') out.push(finding('penalty', 'mounted', a.weapon, { item: nameOf(a.weapon) }));
    // Armour heavier than the weapon works well with (P11-06 sets limits; none yet).
    const limit = w.item?.combat?.armourLimit ?? w.family.armourLimit;
    const body = item(kit?.body);
    if (limit != null && body && (body.stats.armor || 0) > limit) out.push(finding('penalty', 'heavy', a.weapon, { item: nameOf(a.weapon) }, { have: body.stats.armor || 0, need: limit }));
    if (context.loaner) out.push(finding('note', 'loaner', a.weapon, { item: nameOf(kit?.weapon), shield: nameOf(kit?.offhand) }));
    return out.sort((x, y) => ORDER[x.kind] - ORDER[y.kind]);
  }

  /** Can this loadout fight? (It holds a weapon, or both slots are empty, and nothing makes it unusable.) */
  function usable(c, kit, which, context = {}) {
    if (which === 'secondary' && !kit?.weapon2) return false;
    return !check(c, kit, { ...context, which }).some((f) => f.kind === 'incompatible' || f.kind === 'requirement');
  }

  /**
   * The loadout to fight with: the one you prefer (`c.loadout.start`), else the other, else the first
   * (with fists if nothing fits). @param {any} c @param {any} [kit] @param {any} [context]
   */
  function bestLoadout(c, kit = c.equipment, context = {}) {
    const pref = context.loaner ? 'primary' : c?.loadout?.start === 'secondary' ? 'secondary' : 'primary';
    const order = pref === 'secondary' ? ['secondary', 'primary'] : ['primary', 'secondary'];
    for (const which of order) {
      if (which === 'secondary' && !kit?.weapon2) continue;
      if (!check(c, kit, { ...context, which }).some((f) => f.kind === 'incompatible' || f.kind === 'requirement')) return which;
    }
    return 'primary';
  }

  /**
   * The loadout a battle starts with, and the message if the one you prefer can't be used (never silent).
   * @param {any} c @param {any} kit @param {any} [context] @returns {{ which: string, message: string | null }}
   */
  function battleLoadout(c, kit = c.equipment, context = {}) {
    const which = bestLoadout(c, kit, context);
    const pref = context.loaner ? 'primary' : c?.loadout?.start === 'secondary' && kit?.weapon2 ? 'secondary' : 'primary';
    const message = which !== pref ? words('fallback', { loadout: LOADOUT_NAMES[pref], other: nameOf(weaponIn(kit, which)) }) : null;
    return { which, message };
  }

  /**
   * What buying (or carrying) an item would mean: the findings of the kit with it in its slot (a weapon
   * as the first weapon), that concern it. @param {any} c @param {string} itemId @param {any} [context]
   */
  function checkItem(c, itemId, context = {}) {
    const it = item(itemId);
    if (!it?.slot) return [];
    const kit = { ...c.equipment, [it.slot]: itemId };
    const which = it.slot === 'weapon' ? 'primary' : bestLoadout(c, kit, context);
    return check(c, kit, { ...context, which }).filter((f) => f.item === itemId || (it.slot === 'offhand' && (f.code === 'two_hands' || f.code === 'shoots')));
  }

  /** Every finding of both loadouts a kit can use, each marked with its loadout (the character sheet). */
  function checkAll(c, kit = c.equipment, context = {}) {
    const out = [];
    for (const which of LOADOUTS) {
      if (which === 'secondary' && !kit?.weapon2) continue;
      for (const f of check(c, kit, { ...context, which })) if (!out.some((g) => g.code === f.code && g.item === f.item)) out.push({ ...f, loadout: which });
    }
    return out.sort((x, y) => ORDER[x.kind] - ORDER[y.kind]);
  }

  /** Does any finding stop you (so buying needs a confirmation)? */
  const stops = (findings) => findings.some((f) => f.kind === 'incompatible' || f.kind === 'requirement');

  /** A loadout in words: "Arming Sword and Kite Shield", "Hand Axe (Kite Shield slung)". */
  function describe(c, kit = c.equipment, which = 'primary') {
    const a = active(c, kit, which);
    const w = nameOf(a.weapon);
    if (a.shield) return `${w} and ${nameOf(a.shield)}`;
    if (a.stowed) return `${w} (${nameOf(kit.offhand)} slung)`;
    return w;
  }

  /** The speed of a weapon in a word: quick, steady or slow (its swing from start to the next). */
  function speedWord(p) {
    const t = p.timing.total;
    return t < 0.45 ? 'quick' : t <= 0.65 ? 'steady' : 'slow';
  }

  /**
   * One line comparing a weapon with another (the sheet and the shops): damage, reach, speed, hands.
   * @param {any} c @param {string} id @param {string | null} against
   */
  function compare(c, id, against) {
    const P = (w) => CL.profile.resolve({ hero: c, equipment: { ...c.equipment, weapon: w, weapon2: null } });
    const a = P(id);
    const parts = [];
    const b = against ? P(against) : null;
    if (b) {
      const d = a.damage - b.damage;
      parts.push(Math.abs(d) < 0.05 ? 'the same damage' : d > 0 ? 'more damage' : 'less damage');
      parts.push(a.reach === b.reach ? 'the same reach' : a.reach > b.reach ? 'longer reach' : 'shorter reach');
    }
    parts.push(speedWord(a));
    parts.push(a.hands === 2 ? 'both hands' : 'one hand');
    const line = parts.join(', ');
    return b ? `Against your ${nameOf(against)}: ${line}` : line[0].toUpperCase() + line.slice(1);
  }

  // ---- In battle: switching weapons ----

  /**
   * The hero's loadout as a battle starts (js/combat.js): which one, and each weapon's "ready at".
   * @param {any} g @param {any} c @param {any} kit @param {string} which
   */
  function begin(g, c, kit, which) {
    g.loadout = { which, kit, ready: { primary: 0, secondary: 0 }, switching: null, can: Boolean(kit?.weapon2) && usable(c, kit, which === 'primary' ? 'secondary' : 'primary', { loaner: kit !== c.equipment }) };
  }

  /**
   * Start bringing the other weapon to hand (Q, or the button). Not while swinging: the swing is
   * committed. Each weapon keeps its own "ready at", so a switch never resets a cooldown.
   * @param {any} g @returns {boolean}
   */
  function switchWeapon(g) {
    const L = g.loadout;
    const h = g.hero;
    if (!L?.can || L.switching || !h?.alive || h.swing || g.mode !== 'battle') return false;
    const to = L.which === 'primary' ? 'secondary' : 'primary';
    L.ready[L.which] = g.t + h.attackCooldown; // this weapon is ready again no sooner than it would have been
    const p = CL.profile.weaponOf(weaponIn(L.kit, to));
    L.switching = { to, at: g.t + (p.item?.combat?.switch ?? p.family.switch ?? 0.4) };
    h.guard = false;
    CL.ui.message(`Drawing your ${nameOf(weaponIn(L.kit, to))}…`);
    CL.ui.gearButtons?.();
    return true;
  }

  /** Each frame while switching: the other weapon in hand when its time is up. @param {any} g */
  function tick(g) {
    const L = g.loadout;
    if (!L?.switching || g.t < L.switching.at) return;
    const to = L.switching.to;
    L.switching = null;
    L.which = to;
    const c = CL.campaign;
    const h = g.hero;
    const p = CL.profile.resolve({ hero: c, equipment: kitFor(c, L.kit, to) });
    CL.profile.apply(h, p, ['damage', 'armor', 'reach', 'speed', 'ranged']); // the body (HP) stays as it is
    h.canBlock = p.canBlock;
    h.attackCooldown = Math.max(0, L.ready[to] - g.t);
    CL.ui.message(`${nameOf(weaponIn(L.kit, to))} in hand`);
    CL.ui.gearButtons?.();
  }

  /** Is the hero bringing a weapon to hand (so can't strike or block)? @param {any} g */
  const switching = (g) => Boolean(g?.loadout?.switching);

  // ---- Saves ----

  /** The loadout preferences in a save, repaired. @param {any} d */
  function sanitize(d) {
    const out = { start: 'primary', ride: true, last: {} };
    if (!d || typeof d !== 'object') return out;
    if (LOADOUTS.includes(d.start)) out.start = d.start;
    if (typeof d.ride === 'boolean') out.ride = d.ride;
    for (const [k, v] of Object.entries(d.last || {})) if (/^[a-z_]{1,24}$/.test(k) && LOADOUTS.includes(/** @type {string} */ (v))) out.last[k] = v;
    return out;
  }

  /**
   * After a load: a preference for a loadout that can't be used (the second weapon gone) falls back to
   * the first, with a message; no item is ever removed. @param {any} c @returns {string | null}
   */
  function repair(c) {
    if (c.loadout?.start !== 'secondary' || c.equipment?.weapon2) return null;
    c.loadout.start = 'primary';
    return 'You carry no second weapon now: battles start with your first.';
  }

  CL.gear = { LOADOUTS, CODES, TEXT_MAX, KINDS, ICONS, KIND_NAMES, LOADOUT_NAMES, words, active, kitFor, check, checkAll, checkItem, usable, bestLoadout, battleLoadout, stops, describe, speedWord, compare, begin, switchWeapon, tick, switching, sanitize, repair };
})(typeof window !== 'undefined' ? window : globalThis);
