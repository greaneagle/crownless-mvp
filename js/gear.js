// @ts-check
/* Crownless gear: carried and wielded (P11-02; docs/PHASE-11-PLAN.md §8). The hero carries two weapons
 * (`weapon`, `weapon2`), a shield and a quiver; a **loadout** is the one in hand: `primary` (the first
 * weapon) or `secondary` (the second), each with the shield if the weapon leaves a hand free for it
 * (a two-handed weapon or a bow slings it on the back). **One gear check** says, in words, what a kit
 * means: every screen, the shops, Prepare, the lists and the battle ask it, so they say the same.
 * Findings: { kind, code, item, text, have, need, fix }; kinds `incompatible` (can't be used, or not
 * here), `requirement` (not yet met: P11-03's attribute, skill and training needs, on base values), `penalty` (works, but worse), `note` (a consequence you
 * may not expect), `advice`. Text from data/gear_text.js. Pure logic except `switchWeapon`/`tick`,
 * which drive the hero in battle. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LOADOUTS = ['primary', 'secondary'];
  /** The findings' codes (data/gear_text.js has a line for each, and no other). */
  const CODES = ['two_hands', 'shoots', 'unarmed', 'no_second', 'fallback', 'loaner', 'mounted', 'heavy', 'attribute', 'skill', 'training', 'no_weapon'];
  /** P11-03: the ways to meet a requirement, the last sentence of its finding (data/gear_text.js too). */
  const FIXES = ['fix_spend', 'fix_level', 'fix_untaught', 'fix_teacher'];
  /** Every line data/gear_text.js has, and no other. */
  const LINES = [...CODES, ...FIXES];
  /** What a requirement may name (P11-03): two attributes, skills by id, a master's training. */
  const REQ_KEYS = ['str', 'agi', 'skills', 'training'];
  /** The requirement rule's classes of gear (docs/PHASE-11-PLAN.md §7.3). */
  const CLASSES = ['ordinary', 'advanced', 'elite'];
  /** Families the rule keeps a piece of that needs nothing, whatever a character spends (§7.3 rule 5). */
  const ALWAYS = ['sword', 'spear', 'shortbow', 'crossbow'];
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

  // ---- Requirements (P11-03) ----

  /** A piece's requirement: its own `req` (`{}` for none), else its family's (a weapon), else none. @param {string | null} id */
  function reqOf(id) {
    const it = item(id);
    if (!it) return null;
    if (it.req) return it.req;
    return it.slot === 'weapon' ? CL.content.table('weapon_families')[it.family]?.req || null : null;
  }

  const plural = (n, what) => `${n} ${what} point${n === 1 ? '' : 's'}`;

  /** How to meet a need of `gap` more: spend the points you have, or the points to come. */
  function fixFor(ch, kind, gap) {
    const have = kind === 'attribute' ? ch.attributePoints : ch.skillPoints;
    return have >= gap ? words('fix_spend', { n: plural(gap, kind) }) : words('fix_level');
  }

  /**
   * What a character doesn't yet meet of a piece's requirement, as findings (base values only, plan
   * §7.4). None for a piece that needs nothing, or with no hero. @param {any} c @param {string | null} id
   */
  function unmet(c, id) {
    const r = reqOf(id);
    const ch = c?.character;
    if (!r || !ch) return [];
    const C = CL.character;
    const out = [];
    const name = nameOf(id);
    for (const a of ['str', 'agi']) {
      if (r[a] == null) continue;
      const have = C.baseAttribute(a, c);
      if (have >= r[a]) continue;
      const fix = fixFor(ch, 'attribute', r[a] - have);
      out.push(finding('requirement', 'attribute', id, { item: name, stat: C.ATTRIBUTE_NAMES[a], need: String(r[a]), have: String(have), fix }, { have, need: r[a], fix, stat: a }));
    }
    for (const [k, n] of Object.entries(r.skills || {})) {
      const have = C.baseSkill(k, c);
      if (have >= n) continue;
      const fix = fixFor(ch, 'skill', n - have);
      out.push(finding('requirement', 'skill', id, { item: name, stat: CL.content.table('skills')[k]?.name || k, need: String(n), have: String(have), fix }, { have, need: n, fix, stat: k }));
    }
    if (r.training && !ch.training?.[r.training]) {
      const t = CL.content.table('training')[r.training];
      const fix = t?.master ? words('fix_teacher', { master: t.master, place: CL.content.table('settlements')[t.place]?.name || t.place }) : words('fix_untaught');
      out.push(finding('requirement', 'training', id, { item: name, fix }, { have: 0, need: 1, fix, stat: r.training }));
    }
    return out;
  }

  /** Does the character meet a piece's requirement (so it's used in battle)? */
  const meets = (c, id) => !id || unmet(c, id).length === 0;

  /**
   * The pieces a character has (worn or in the pack) that the points they have to spend now would
   * unlock (no training needed): what the sheet and a level-up name. @param {any} c
   * @returns {{ item: string, needs: string }[]}
   */
  function unlocks(c) {
    const ch = c?.character;
    if (!ch || (!ch.attributePoints && !ch.skillPoints)) return [];
    const ids = new Set([...Object.values(c.equipment || {}).filter(Boolean), ...Object.keys(c.inventory || {})]);
    const out = [];
    for (const id of ids) {
      const u = unmet(c, id);
      if (!u.length || u.some((f) => f.code === 'training')) continue;
      const gapA = u.filter((f) => f.code === 'attribute').reduce((n, f) => n + f.need - f.have, 0);
      const gapS = u.filter((f) => f.code === 'skill').reduce((n, f) => n + f.need - f.have, 0);
      if (gapA > ch.attributePoints || gapS > ch.skillPoints) continue;
      const needs = u.map((f) => `${f.code === 'attribute' ? CL.character.ATTRIBUTE_NAMES[f.stat] : CL.content.table('skills')[f.stat]?.name || f.stat} ${f.need}`).join(', ');
      out.push({ item: id, needs });
    }
    return out.sort((a, b) => nameOf(a.item).localeCompare(nameOf(b.item)));
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
    const out = { ...kit, weapon: a.weapon, weapon2: null, offhand: a.shield };
    // P11-03: a piece whose requirement isn't met stays with the baggage (it's never taken away).
    for (const s of Object.keys(out)) if (out[s] && !meets(c, out[s])) out[s] = null;
    return out;
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
    // P11-03: what the hero doesn't yet meet, of what's in hand and worn.
    for (const s of ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'horse', 'ring', 'ammo']) {
      const id = s === 'weapon' ? a.weapon : s === 'offhand' ? a.shield : kit?.[s];
      if (id) out.push(...unmet(c, id));
    }
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
    return !blocked(c, kit, which, context);
  }

  /** Does something stop the weapon this loadout holds (a piece of armour not met doesn't: it stays behind)? */
  function blocked(c, kit, which, context = {}) {
    const w = weaponIn(kit, which);
    return check(c, kit, { ...context, which }).some((f) => (f.kind === 'incompatible' || f.kind === 'requirement') && f.item === w);
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
      if (!blocked(c, kit, which, context)) return which;
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
    const w = weaponIn(kit, which);
    // P11-03: neither weapon can be wielded yet: fists, and say so.
    const message = w && !meets(c, w) ? words('no_weapon', { item: nameOf(w) }) : which !== pref ? words('fallback', { loadout: LOADOUT_NAMES[pref], other: nameOf(w) }) : null;
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
      for (const f of check(c, kit, { ...context, which })) if (!out.some((g) => g.code === f.code && g.item === f.item && g.text === f.text)) out.push({ ...f, loadout: which });
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

  // ---- The requirement rule (P11-03; docs/PHASE-11-PLAN.md §7.3) ----

  /**
   * A piece's class for the rule: `ordinary` (tier 1, sold in a village, an origin's kit or a
   * tournament's), `elite` (tier 3, or a region's own, P11-16), else `advanced` (a town's). A forged
   * piece is its base's. @param {any} it @param {any} C the content
   */
  function classOf(it, C) {
    const base = it.forgedFrom ? C.items?.[it.forgedFrom] || it : it;
    const id = base.id;
    const kits = [...Object.values(C.origins || {}).flatMap((o) => [...Object.values(o.kit?.equipment || {}), ...Object.keys(o.kit?.items || {})]), ...Object.values(C.tournaments || {}).flatMap((t) => Object.values(t.kit || {}))];
    const village = Object.values(C.settlements || {}).some((s) => s.type === 'village' && (s.gear || []).includes(id));
    if ((base.tier ?? 1) <= 1 || village || kits.includes(id)) return 'ordinary';
    if ((base.tier ?? 1) >= 3 || base.region) return 'elite';
    return 'advanced';
  }

  /**
   * Everything wrong with the requirements of a content set: their shape, and the rule (an ordinary
   * piece needs nothing; an advanced one no more than the middle level reaches with half its points;
   * an elite one the late level's, plus training that someone teaches; nothing past the cap; and a
   * piece of each everyday family, a shield and a horse that need nothing). @param {any} C @returns {string[]}
   */
  function ruleProblems(C) {
    const errs = [];
    const err = (m) => errs.push(m);
    const CH = CL.character;
    // A content set without a budget (a world or pack checked on its own) is held to the game's.
    const own = CL.content.table('budget');
    const B = C.budget || (own.cap ? own : { cap: CH?.MAX_LEVEL ?? 20, middle: 10, late: 15 });
    const isInt = (n) => Number.isInteger(n);
    if (!(isInt(B.cap) && isInt(B.middle) && isInt(B.late) && B.middle > 1 && B.middle < B.late && B.late <= B.cap)) err('budget: needs whole levels with 1 < middle < late ≤ cap');
    else if (CH && B.cap !== CH.MAX_LEVEL) err(`budget: the cap ${B.cap} isn't the game's ${CH.MAX_LEVEL}`);
    if (errs.length) return errs;
    const BASE = 5;
    const top = BASE + 1 + Math.floor(B.cap / 2); // the most an attribute can be: start, origin, every point
    const maxSkill = CH?.MAX_SKILL ?? 10;
    const shape = (r, where) => {
      if (r == null) return;
      if (typeof r !== 'object' || Array.isArray(r)) return err(`${where}: req must be an object`);
      for (const k of Object.keys(r)) if (!REQ_KEYS.includes(k)) err(`${where}: req can't name ${k}`);
      for (const a of ['str', 'agi']) if (r[a] != null && !(isInt(r[a]) && r[a] > BASE && r[a] <= top)) err(`${where}: req.${a} must be a whole number from ${BASE + 1} to ${top}`);
      for (const [k, n] of Object.entries(r.skills || {})) {
        if (!C.skills?.[k]) err(`${where}: req names an unknown skill ${k}`);
        if (!(isInt(n) && n >= 1 && n <= maxSkill)) err(`${where}: req.skills.${k} must be from 1 to ${maxSkill}`);
      }
      if (r.training != null && !C.training?.[r.training]) err(`${where}: no one teaches the training ${r.training}`);
    };
    for (const fam of Object.values(C.weapon_families || {})) shape(fam.req, `weapon family ${fam.id}`);
    const reqOfIn = (it) => it.req ?? (it.slot === 'weapon' ? C.weapon_families?.[it.family]?.req : null) ?? null;
    const needsNothing = (it) => {
      const r = reqOfIn(it);
      return !r || (!r.str && !r.agi && !r.training && !Object.keys(r.skills || {}).length);
    };
    for (const it of Object.values(C.items || {})) {
      if (!it.slot) continue;
      const where = `item ${it.id}`;
      if (it.req != null) shape(it.req, where);
      const r = reqOfIn(it);
      if (!r || needsNothing(it)) continue;
      const cls = classOf(it, C);
      if (cls === 'ordinary') {
        err(`${where}: ordinary gear (sold in a village, a kit, or tier 1) must need nothing`);
        continue;
      }
      const level = cls === 'advanced' ? B.middle : B.late;
      const pts = CH ? CH.pointsAt(level) : { skills: level - 1, attributes: Math.floor(level / 2) };
      const attrs = Math.max(0, (r.str || BASE) - BASE) + Math.max(0, (r.agi || BASE) - BASE);
      const skills = Object.values(r.skills || {}).reduce((a, b) => a + b, 0);
      if (attrs > Math.floor(pts.attributes / 2)) err(`${where}: an ${cls} piece may need ${Math.floor(pts.attributes / 2)} attribute points of level ${level}'s ${pts.attributes}, not ${attrs}`);
      if (skills > Math.floor(pts.skills / 2)) err(`${where}: an ${cls} piece may need ${Math.floor(pts.skills / 2)} skill points of level ${level}'s ${pts.skills}, not ${skills}`);
      if (r.training && cls !== 'elite') err(`${where}: only an elite piece may need training`);
    }
    // Rule 5: basic play never depends on points.
    const items = Object.values(C.items || {}).filter((it) => it.slot && !it.questItem);
    for (const fam of ALWAYS) {
      const of = items.filter((it) => it.slot === 'weapon' && it.family === fam);
      if (of.length && !of.some(needsNothing)) err(`items: no ${fam} needs nothing (a character who spends nothing on fighting must have one)`);
    }
    for (const [slot, what] of [['offhand', 'shield'], ['horse', 'horse']]) {
      const of = items.filter((it) => it.slot === slot);
      if (of.length && !of.some(needsNothing)) err(`items: no ${what} needs nothing`);
    }
    return errs;
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

  CL.gear = { FIXES, LINES, REQ_KEYS, CLASSES, ALWAYS, reqOf, unmet, meets, unlocks, classOf, ruleProblems, blocked, LOADOUTS, CODES, TEXT_MAX, KINDS, ICONS, KIND_NAMES, LOADOUT_NAMES, words, active, kitFor, check, checkAll, checkItem, usable, bestLoadout, battleLoadout, stops, describe, speedWord, compare, begin, switchWeapon, tick, switching, sanitize, repair };
})(typeof window !== 'undefined' ? window : globalThis);
