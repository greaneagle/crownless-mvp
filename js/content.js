/* Crownless ContentDB: typed access to window.CROWNLESS_CONTENT (data/*.js) plus
 * load-time reference validation. One authoritative source per ID (GDD §13). */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  /** P9-01: the laws a realm may have (data/factions.js `laws`), each with its check. */
  const LAWS = {
    power: (v) => ['crown', 'league'].includes(v),
    share: (v) => typeof v === 'number' && v >= 0 && v <= 0.5,
    succession: (v) => ['eldest', 'kin', 'council'].includes(v),
    fiefCap: (v) => Number.isInteger(v) && v >= 1 && v <= 9,
    war: (v) => ['ruler', 'council'].includes(v),
  };

  const TABLES = [
    'factions',
    'settlements',
    'troops',
    'items',
    'markets',
    'quests',
    'dialogue',
    'battle_maps',
    'encounters',
    'world_map',
    'skills',
    'origins',
    'origin_rules',
    'party_templates',
    'contracts',
    'town_hubs',
    'loot_tables',
    'companions',
    'news',
    'help_topics',
    'cultures',
    'tips',
    'world_events',
    'tournaments',
    'businesses',
  ];

  /** P9-08: tables a world may leave empty (a sandbox world has no story or walkable town). */
  const OPTIONAL = ['quests', 'dialogue', 'town_hubs'];

  const raw = () => root.CROWNLESS_CONTENT || {};

  function table(name) {
    const t = raw()[name] || {};
    if (name === 'items' && raw().forge && forgedFor !== t) addForged(t, raw().forge);
    return t;
  }

  // P7-03: forged pieces ("Arming Sword +1") are items made from the blacksmith's rules (data/items.js
  // `forge`) the first time the items are looked at; `forgedFrom` and `forgeLevel` say what they are.
  let forgedFor = null;
  function addForged(items, F) {
    forgedFor = items;
    for (const it of Object.values(items)) {
      if (it.forgedFrom || it.questItem || !F.slots?.[it.slot]) continue;
      for (let n = 1; n <= (F.maxLevel || 0); n++) {
        const id = `${it.id}+${n}`;
        if (items[id]) continue;
        const stats = { ...it.stats };
        for (const [k, v] of Object.entries(F.slots[it.slot])) stats[k] = (stats[k] || 0) + v * n;
        items[id] = { ...it, id, name: `${it.name} +${n}`, value: Math.round(it.value * (1 + F.valuePerLevel * n)), stats, forgedFrom: it.id, forgeLevel: n };
      }
    }
  }

  /** Look up a record; throws on unknown IDs so bad references fail loudly. */
  function get(name, id) {
    const rec = table(name)[id] ?? (typeof id === 'string' && id.includes(':') ? table(name)[CL.packs?.resolve(id)] : undefined); // P9-07: `world:id`
    if (!rec) throw new Error(`Unknown ${name} id: ${id}`);
    return rec;
  }

  const troop = (id) => get('troops', id);
  /** A loot table: an id from loot_tables, or an inline { chancePerKill, table }. */
  const lootTable = (ref) => (typeof ref === 'string' ? get('loot_tables', ref) : ref || null);
  const item = (id) => get('items', id);
  const encounter = (id) => get('encounters', id);

  /**
   * A world package (W-04): its size, kingdoms and start, and everything on its map inside its bounds:
   * settlements, sites, terrain, regions and the patrols' frontier points; every owner, party faction
   * and kingdom recruit list pointing at this world's factions.
   */
  function checkWorld(m, C, err) {
    const w = `world_map ${m.id}`;
    const b = m.bounds;
    if (!(b && b.w > 0 && b.h > 0 && b.w <= 1000 && b.h <= 1000)) return err(`${w}: needs bounds { w, h } in map units`);
    const inside = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= b.w && y <= b.h;
    const kingdoms = Array.isArray(m.factions) ? m.factions : [];
    if (!kingdoms.length) err(`${w}: needs its kingdoms (factions)`);
    for (const f of kingdoms) if (!C.factions?.[f]) err(`${w}: unknown kingdom ${f}`);
    if (!C.factions?.[m.outlaws] || kingdoms.includes(m.outlaws)) err(`${w}: outlaws must be a faction that is not a kingdom`);
    const ours = new Set([...kingdoms, m.outlaws]);
    for (const s of Object.values(C.settlements || {})) {
      if (!inside(s.mapX, s.mapY)) err(`${w}: settlement ${s.id} outside the map`);
      if (!ours.has(s.ownerFaction)) err(`${w}: settlement ${s.id} owned by ${s.ownerFaction}, not one of this world's factions`);
    }
    for (const st of Object.values(m.sites || {})) if (!inside(st.mapX, st.mapY)) err(`${w}: site ${st.id} outside the map`);
    // P9-B3: the world's army sizes, each a factor from 1 to 10 (missing ones are 1).
    // P10-08: sight (js/sight.js).
    if (m.sight != null) {
      const s = m.sight;
      const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
      if (!num(s.base, 1, 60) || !num(s.pathfinding, 0, 1) || !num(s.companion, 0, 2) || !num(s.horse, 0, 2) || !num(s.detachment, 0, 60) || Object.values(s.holdings || {}).some((r) => !num(r, 0, 60))) err(`${w}: sight needs base 1–60, fractions 0–2 and circles 0–60`);
    }
    for (const [k, v] of Object.entries(m.armies || {})) if (!['households', 'garrisons', 'beyondHome'].includes(k) || !(Number.isFinite(v) && v >= 1 && v <= 10)) err(`${w}: armies.${k} must be households, garrisons or beyondHome, a number from 1 to 10`);
    const points = [...(m.river || []), ...(m.forests || []).flat(), ...(m.hills || [])];
    if (points.some(([x, y]) => !inside(x, y))) err(`${w}: terrain outside the map`);
    for (const [id, r] of Object.entries(m.regions || {})) {
      if (!r.name || !inside(r.x, r.y) || !inside(r.x + r.w, r.y + r.h)) err(`${w}: region ${id} needs a name and to lie inside the map`);
    }
    // Terrain (W-05a): every kind of ground has a speed above 0 (D-W4: all of it is passable), the
    // features lie inside the map, and every kind's battle map exists.
    const KINDS = ['road', 'grass', 'forest', 'hills', 'mountain', 'marsh', 'river', 'ford', 'bridge'];
    for (const k of KINDS) if (!(m.terrain?.[k] > 0)) err(`${w}: terrain ${k} needs a speed above 0`);
    for (const a of m.areas || []) {
      if (!['hills', 'mountain', 'marsh'].includes(a.kind)) err(`${w}: unknown area kind ${a.kind}`);
      if (!(Array.isArray(a.poly) && a.poly.length >= 3 && a.poly.every(([x, y]) => inside(x, y)))) err(`${w}: a ${a.kind} area needs 3+ points inside the map`);
    }
    for (const wt of m.waters || []) {
      if (!(Array.isArray(wt.line) && wt.line.length >= 2 && wt.line.every(([x, y]) => inside(x, y)) && wt.width > 0)) err(`${w}: a water needs a line inside the map and a width`);
      for (const c of wt.crossings || []) if (!['ford', 'bridge'].includes(c.kind) || !inside(c.x, c.y) || !(c.r > 0)) err(`${w}: bad crossing ${JSON.stringify(c)}`);
    }
    for (const side of m.coast || []) if (!['north', 'south', 'east', 'west'].includes(side)) err(`${w}: unknown coast ${side}`);
    for (const k of ['open', 'fort']) if (!m.battleMaps?.[k]) err(`${w}: battleMaps needs ${k}`);
    for (const [k, id] of Object.entries(m.battleMaps || {})) if (!C.battle_maps?.[id]) err(`${w}: battle map for ${k} is unknown: ${id}`);
    if (m.view && m.view.zoom !== undefined && !(m.view.zoom > 0 && m.view.zoom <= 2.4)) err(`${w}: view.zoom must be in (0, 2.4]`);
    for (const t of Object.values(C.party_templates || {})) {
      if (!ours.has(t.faction)) err(`${w}: party ${t.id} of ${t.faction}, not one of this world's factions`);
      if (t.frontier && !inside(t.frontier.x, t.frontier.y)) err(`${w}: party ${t.id} frontier outside the map`);
    }
    for (const f of kingdoms) {
      const rec = C.factions?.[f]?.recruits;
      if (!Array.isArray(rec) || !rec.length) err(`${w}: kingdom ${f} has no recruits`);
    }
    // Starting relations between kingdoms (W-07).
    for (const r of m.relations || []) {
      const ok = Array.isArray(r.between) && r.between.length === 2 && r.between[0] !== r.between[1] && r.between.every((f) => kingdoms.includes(f));
      if (!ok) err(`${w}: relations need two of this world's kingdoms`);
      if (!['peace', 'tension', 'war'].includes(r.state)) err(`${w}: relations state must be peace, tension or war`);
    }
    const cap = m.simulation?.partiesPerRegion;
    if (cap != null && !(Number.isInteger(cap) && cap >= 1)) err(`${w}: simulation.partiesPerRegion must be a whole number of at least 1`);
  }

  /**
   * P10-G1 (D-P10k): what a `look` may say (troops, companions; packs too). The art kit (js/art/figures.js)
   * draws every part listed here, and nothing else: a part the kit lacks is added there and here.
   */
  const LOOK = {
    armour: ['gambeson', 'mail', 'leather', 'fur', 'rags'],
    helmet: ['nasal', 'kettle', 'great', 'cap', 'hood', 'spangen', 'crest', 'plumed', 'furhat', 'sallet'],
    hat: ['brim', 'cap', 'kerchief', 'coif'],
    shield: ['kite', 'round', 'heater', 'wood', 'pavise'],
    weapon: ['sword', 'axe', 'greataxe', 'spear', 'pike', 'lance', 'bow', 'crossbow', 'hammer', 'staff', 'club'],
    hairStyle: ['short', 'long', 'braid', 'bun', 'bald', 'tied'],
    colours: ['tunic', 'legs', 'boots', 'hoodColor', 'capColor', 'hatColor', 'band', 'cloak', 'cloakTrim', 'plume', 'apron', 'hair', 'skin'],
    flags: ['tabard', 'quiver', 'fur', 'pauldrons', 'beard', 'female'],
    long: ['spear', 'pike', 'lance'],
  };
  const isColour = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  /** Problems with a look, each starting with `at`. @param {any} look @param {string} at */
  function checkLook(look, at) {
    const out = [];
    if (!look || typeof look !== 'object') return [`${at}: needs a look`];
    for (const [k, v] of Object.entries(look)) {
      if (['armour', 'helmet', 'hat', 'shield', 'weapon', 'hairStyle'].includes(k)) {
        if (v != null && !LOOK[k].includes(v)) out.push(`${at}: unknown ${k} '${v}' (one of ${LOOK[k].join(', ')})`);
      } else if (LOOK.colours.includes(k)) {
        if (!isColour(v)) out.push(`${at}: ${k} must be a colour like '#a59273'`);
      } else if (LOOK.flags.includes(k)) {
        if (typeof v !== 'boolean') out.push(`${at}: ${k} must be true or false`);
      } else if (k === 'bowSize') {
        if (!(v >= 0.8 && v <= 1.4)) out.push(`${at}: bowSize between 0.8 and 1.4`);
      } else if (k === 'mount') {
        if (!v || !isColour(v.coat) || (v.mane != null && !isColour(v.mane)) || (v.pony != null && typeof v.pony !== 'boolean')) out.push(`${at}: mount needs a coat colour (and may give a mane colour and pony)`);
      } else out.push(`${at}: '${k}' is not part of a look`);
    }
    return out;
  }
  /** A troop's look agrees with what it does: shield, reach, shot, mount. @param {any} t */
  function lookAgrees(t) {
    const L = t.look || {};
    const out = [];
    if (Boolean(L.shield) !== Boolean(t.shield)) out.push(`troop ${t.id}: its look ${t.shield ? 'needs' : 'may not have'} a shield (shield: ${Boolean(t.shield)})`);
    if (t.role === 'archer' && L.weapon !== (t.ranged?.projectileSpeed >= 300 ? 'crossbow' : 'bow')) out.push(`troop ${t.id}: an archer whose shot flies at ${t.ranged?.projectileSpeed} carries a ${t.ranged?.projectileSpeed >= 300 ? 'crossbow' : 'bow'}`);
    if (t.role !== 'archer' && ['bow', 'crossbow'].includes(L.weapon)) out.push(`troop ${t.id}: only archers carry a bow or crossbow`);
    if (t.role !== 'archer' && t.reach >= 70 && !LOOK.long.includes(L.weapon)) out.push(`troop ${t.id}: a long reach (${t.reach}) needs a spear, pike or lance`);
    if (t.role !== 'archer' && t.reach < 55 && LOOK.long.includes(L.weapon)) out.push(`troop ${t.id}: a spear, pike or lance needs a reach of 55 or more (${t.reach})`);
    if (L.female != null) out.push(`troop ${t.id}: a troop's look doesn't say female: its gender does`);
    if ((t.role === 'cavalry') !== Boolean(L.mount)) out.push(`troop ${t.id}: ${t.role === 'cavalry' ? 'cavalry needs a mount' : 'only cavalry has a mount'}`);
    return out;
  }

  /** Return a list of human-readable problems; empty means the content is consistent. `C` is the
   * content to check (P9-07: a pack is checked on a copy); by default the game's own. */
  function validate(C = raw()) {
    const errors = [];
    const err = (msg) => errors.push(msg);
    for (const t of TABLES) if (!C[t] || (!OPTIONAL.includes(t) && !Object.keys(C[t]).length)) err(`missing table: ${t}`);

    for (const t of TABLES) {
      if (!C[t]) continue;
      for (const [key, rec] of Object.entries(C[t])) if (rec.id !== key) err(`${t}.${key}: id is '${rec.id}'`);
    }

    for (const t of Object.values(C.troops || {})) {
      if (!C.factions?.[t.faction]) err(`troop ${t.id}: unknown faction ${t.faction}`);
      for (const u of [t.upgradeTo, t.altUpgradeTo]) if (u && !C.troops[u]) err(`troop ${t.id}: unknown upgrade ${u}`);
      for (const k of ['shield', 'brace']) if (t[k] != null && typeof t[k] !== 'boolean') err(`troop ${t.id}: ${k} must be true or false`);
      if (t.gender != null && !['male', 'female'].includes(t.gender)) err(`troop ${t.id}: gender must be male or female (default male, D-P8g)`);
      // P10-09: a woman's line upgrades within itself; a line's women's troop is a woman's, at a share.
      if (t.gender === 'female') for (const u of [t.upgradeTo, t.altUpgradeTo]) if (u && C.troops[u] && C.troops[u].gender !== 'female') err(`troop ${t.id}: a woman's line upgrades into her own line, not ${u}`);
      if (t.women != null && (C.troops[t.women.troop]?.gender !== 'female' || C.troops[t.women.troop].faction !== t.faction || !(t.women.share > 0 && t.women.share < 1))) err(`troop ${t.id}: women needs a woman's troop of its faction and a share between 0 and 1`);
      if (t.shield && t.role === 'archer') err(`troop ${t.id}: archers carry no shield`);
      // P10-G1: a troop's look, when it has one, is the kit's vocabulary and agrees with the troop. A pack's
      // troop may leave it out: the kit then draws one from its role, reach, shot and shield (figures.js).
      if (t.look != null) for (const e of [...checkLook(t.look, `troop ${t.id}`), ...lookAgrees(t)]) err(e);
      for (const s of ['hp', 'damage', 'armor', 'speed', 'reach']) {
        if (!(Number.isFinite(t[s]) && t[s] >= 0)) err(`troop ${t.id}: bad ${s}`);
      }
      if (t.role === 'archer') {
        const r = t.ranged;
        if (!r || !(r.range > 0 && r.projectileSpeed > 0 && r.cooldown > 0 && r.accuracy > 0 && r.accuracy <= 1)) {
          err(`troop ${t.id}: archer needs ranged {range, projectileSpeed, cooldown, accuracy}`);
        }
      }
    }

    // Name cultures (V2-03): who points at them, and that each can make a name.
    const PARTS = ['given', 'trade', 'epithet', 'origin'];
    const LISTS = { given: 'given', trade: 'trades', epithet: 'epithets' };
    for (const k of Object.values(C.cultures || {})) {
      if (!Array.isArray(k.given) || !k.given.length || k.given.some((n) => typeof n !== 'string' || !n.trim())) err(`culture ${k.id}: needs a list of given names`);
      // Men and women (D-P8g, P8-02): `given` are men's names (every soldier), `givenFemale` women's.
      if (!Array.isArray(k.givenFemale) || !k.givenFemale.length || k.givenFemale.some((n) => typeof n !== 'string' || !n.trim())) err(`culture ${k.id}: needs a list of women's names (givenFemale)`);
      else for (const n of k.givenFemale) if (k.given?.includes(n)) err(`culture ${k.id}: ${n} is in both name lists`);
      for (const list of ['trades', 'epithets']) {
        if (k[list] != null && (!Array.isArray(k[list]) || k[list].some((n) => typeof n !== 'string' || !n.trim()))) err(`culture ${k.id}: ${list} must be a list of names`);
      }
      if (!Array.isArray(k.forms) || !k.forms.length) err(`culture ${k.id}: needs name forms`);
      for (const f of k.forms || []) {
        if (typeof f.pattern !== 'string' || !f.pattern.includes('{given}')) err(`culture ${k.id}: form "${f.pattern}" must use {given}`);
        if (!(f.weight > 0)) err(`culture ${k.id}: form "${f.pattern}" needs a weight above 0`);
        for (const [, part] of String(f.pattern).matchAll(/\{(\w+)\}/g)) {
          if (!PARTS.includes(part)) err(`culture ${k.id}: form "${f.pattern}" has unknown part {${part}}`);
          else if (LISTS[part] && !k[LISTS[part]]?.length) err(`culture ${k.id}: form "${f.pattern}" needs ${LISTS[part]}`);
        }
      }
      if (!(k.forms || []).some((f) => !String(f.pattern).includes('{origin}'))) err(`culture ${k.id}: needs a form without {origin}`);
    }
    for (const [table, list] of [
      ['factions', C.factions],
      ['settlements', C.settlements],
      ['troops', C.troops],
    ]) {
      for (const r of Object.values(list || {})) if (r.culture != null && !C.cultures?.[r.culture]) err(`${table} ${r.id}: unknown culture ${r.culture}`);
    }
    for (const f of Object.values(C.factions || {})) if (!f.culture) err(`faction ${f.id}: needs a name culture`);

    // Generated battle maps (V2-05): a known kind, a sensible size, and a one-screen map to fall back to.
    for (const m of Object.values(C.battle_maps || {})) {
      if (!m.generate) continue;
      const gen = m.generate;
      if (!['forest', 'field', 'ford', 'hills'].includes(gen.kind)) err(`battle_map ${m.id}: unknown generator ${gen.kind}`);
      if (!(Number.isInteger(gen.scale) && gen.scale >= 1 && gen.scale <= 4)) err(`battle_map ${m.id}: scale must be 1–4 screens`);
      if (!Number.isInteger(gen.seed)) err(`battle_map ${m.id}: needs a whole-number seed`);
      if (m.small != null && (!C.battle_maps[m.small] || C.battle_maps[m.small].generate)) err(`battle_map ${m.id}: small must be a one-screen map`);
    }

    // Fixed campaign times (V2-04): hours, if given, between 0 and a week.
    for (const m of Object.values(C.world_map || {})) {
      for (const [k, h] of Object.entries(m.time || {})) {
        if (!['battle', 'capture', 'rest'].includes(k)) err(`world_map ${m.id}: unknown time ${k}`);
        else if (!(typeof h === 'number' && h >= 0 && h <= 168)) err(`world_map ${m.id}: time.${k} must be 0–168 hours`);
      }
    }

    for (const s of Object.values(C.settlements || {})) {
      if (!C.factions?.[s.ownerFaction]) err(`settlement ${s.id}: unknown owner ${s.ownerFaction}`);
      if (s.type === 'fort' && !s.garrison) err(`settlement ${s.id}: forts need a garrison`);
      for (const id of s.gear || []) {
        const it = C.items?.[id];
        if (!it || it.questItem || !(it.value > 0)) err(`settlement ${s.id}: armoury cannot sell ${id}`);
      }
      for (const [id, n] of Object.entries(s.garrison || {})) {
        if (!C.troops?.[id] || !(Number.isInteger(n) && n > 0)) err(`settlement ${s.id}: bad garrison entry ${id}`);
      }
      // P9-07: a place's own recruits, offered beside its owner's (a pack's troop line needs no realm).
      if (s.recruits != null && !(Array.isArray(s.recruits) && s.recruits.every((t) => C.troops?.[t]))) err(`settlement ${s.id}: recruits must be a list of known troops`);
      else if (s.recruits?.length && !s.services?.includes('recruit')) err(`settlement ${s.id}: has recruits but no recruit service`);
    }
    const tradeGoods = Object.values(C.markets || {}).filter((g) => g.tradeGood);
    if (!tradeGoods.length) err('markets: needs trade goods');
    for (const s of Object.values(C.settlements || {})) {
      if (!s.services?.includes('trade')) continue;
      for (const g of tradeGoods) {
        const v = s.market?.[g.id];
        if (!(v >= 0.8 && v <= 1.4)) err(`settlement ${s.id}: market scarcity for ${g.id} must be 0.8–1.4`);
      }
    }
    for (const f of Object.values(C.factions || {})) {
      for (const t of f.recruits || []) if (!C.troops?.[t]) err(`faction ${f.id}: unknown recruit ${t}`);
      for (const [id, n] of Object.entries(f.garrison || {})) {
        if (!C.troops?.[id] || !(Number.isInteger(n) && n > 0)) err(`faction ${f.id}: bad garrison entry ${id}`);
      }
      // P9-01: a realm's laws (js/crowns.js reads them).
      if (f.laws !== undefined) {
        if (!f.laws || typeof f.laws !== 'object') err(`faction ${f.id}: laws must be an object`);
        else for (const [k, v] of Object.entries(f.laws)) if (!LAWS[k]?.(v)) err(`faction ${f.id}: bad law ${k}`);
      }
    }
    for (const m of Object.values(C.world_map || {})) {
      if (!C.settlements?.[m.start]) err(`world_map ${m.id}: unknown start ${m.start}`);
      for (const road of m.roads || []) {
        for (const id of road) if (!C.settlements?.[id]) err(`world_map ${m.id}: road through unknown ${id}`);
      }
      for (const k of ['road', 'grass', 'forest']) if (!(m.terrain?.[k] > 0)) err(`world_map ${m.id}: bad terrain ${k}`);
      if (m.aspect !== undefined && !(typeof m.aspect === 'number' && m.aspect > 0 && m.aspect <= 4)) err(`world_map ${m.id}: aspect must be a number in (0, 4]`);
      for (const [key, st] of Object.entries(m.sites || {})) {
        if (st.id !== key) err(`world_map ${m.id}: site ${key} has id ${st.id}`);
        if (!C.encounters?.[st.encounter]) err(`world_map ${m.id}: site ${key} unknown encounter ${st.encounter}`);
      }
      checkWorld(m, C, err);
    }
    const SLOTS = ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'horse', 'ring'];
    for (const it of Object.values(C.items || {})) {
      if (it.slot && !SLOTS.includes(it.slot)) err(`item ${it.id}: unknown slot ${it.slot}`);
      if (it.slot === 'weapon' && !(it.stats?.damage > 0)) err(`item ${it.id}: weapon needs stats.damage`);
    }
    // P10-05: origins (data/origins.js), which replace the backgrounds.
    for (const b of Object.values(C.origins || {})) {
      if (!['str', 'agi', 'int', 'cha'].includes(b.attribute)) err(`origin ${b.id}: bad attribute ${b.attribute}`);
      if (!C.skills?.[b.skill]) err(`origin ${b.id}: unknown skill ${b.skill}`);
      if (!(b.kit?.gold >= 0)) err(`origin ${b.id}: kit needs gold`);
      for (const [slot, id] of Object.entries(b.kit?.equipment || {})) {
        if (C.items?.[id]?.slot !== slot) err(`origin ${b.id}: kit item ${id} does not fit ${slot}`);
      }
      for (const id of Object.keys(b.kit?.items || {})) if (!C.items?.[id]) err(`origin ${b.id}: unknown kit item ${id}`);
      if (b.quest != null && (!C.quests?.[b.quest] || C.quests[b.quest].common)) err(`origin ${b.id}: its quest must be an opening quest`);
      if (b.start != null && !['@home', '@village'].includes(b.start)) err(`origin ${b.id}: start is '@home' or '@village'`);
      if (!b.name || !b.description) err(`origin ${b.id}: needs a name and a description`);
      if (b.quest && (!b.situation || !b.edge)) err(`origin ${b.id}: an opening quest needs a situation and an edge`);
    }
    const band = C.origin_rules?.band;
    if (band) for (const k of ['gold', 'soldiers', 'gear', 'level', 'renown']) if (!(Array.isArray(band[k]) && band[k][0] <= band[k][1])) err(`origin_rules band: ${k} needs [low, high]`);
    for (const t of Object.values(C.party_templates || {})) {
      if (!['bandit', 'patrol', 'caravan', 'detachment', 'lord'].includes(t.kind)) err(`party_template ${t.id}: bad kind ${t.kind}`);
      if (!C.factions?.[t.faction]) err(`party_template ${t.id}: unknown faction ${t.faction}`);
      if (!(t.speed > 0) || !(t.count >= (t.kind === 'detachment' || t.kind === 'lord' ? 0 : 1))) err(`party_template ${t.id}: needs speed and count`);
      if (t.kind === 'lord' && (C.troops?.[t.leader]?.faction !== t.faction || !t.reward || !t.lootBySize)) err(`party_template ${t.id}: a lord's party needs a leader troop of its realm, a reward and lootBySize`);
      for (const [id, range] of Object.entries(t.troops || {})) {
        if (!C.troops?.[id]) err(`party_template ${t.id}: unknown troop ${id}`);
        if (!Array.isArray(range) || !(range[0] >= 0 && range[1] >= range[0])) err(`party_template ${t.id}: bad range for ${id}`);
      }
      const sites = Object.values(C.world_map || {})[0]?.sites || {};
      for (const l of t.lairs || []) if (!sites[l]) err(`party_template ${t.id}: unknown lair ${l}`);
      if (t.home && !C.settlements?.[t.home]) err(`party_template ${t.id}: unknown home ${t.home}`);
      for (const s of t.route || []) if (!C.settlements?.[s]) err(`party_template ${t.id}: unknown route stop ${s}`);
      for (const g of t.goods || []) if (!C.markets?.[g]?.tradeGood) err(`party_template ${t.id}: unknown good ${g}`);
      if (t.kind === 'bandit' && !(t.toll && t.reward && t.lootBySize)) err(`party_template ${t.id}: bandits need toll, reward and lootBySize`);
      for (const [, id] of t.lootBySize || []) if (!C.loot_tables?.[id]) err(`party_template ${t.id}: unknown loot table ${id}`);
    }
    for (const m of Object.values(C.battle_maps || {})) {
      if (m.generate) continue; // generated maps (V2-05) are checked below and in tests
      if (!m.ground?.base || !m.spawn?.hero || !m.spawn?.enemies) err(`battle_map ${m.id}: needs ground and spawns`);
      for (const o of m.obstacles || []) {
        const ok = o.shape === 'circle' ? o.r > 0 : o.shape === 'rect' && o.w > 0 && o.h > 0;
        if (!ok) err(`battle_map ${m.id}: bad obstacle`);
        if (o.look != null && typeof o.look !== 'string') err(`battle_map ${m.id}: an obstacle's look is a name (P10-G6: no sprite tiles)`);
      }
      for (const d of m.decor || []) if (typeof d?.[0] !== 'string') err(`battle_map ${m.id}: decor is [kind, x, y, w, h] with a kind's name (no sprite tiles)`);
    }
    for (const h of Object.values(C.town_hubs || {})) {
      if (!C.settlements?.[h.settlement]?.explorable) err(`town_hub ${h.id}: settlement ${h.settlement} is not explorable`);
      if (!h.spawn || !h.exitZone) err(`town_hub ${h.id}: needs a spawn and an exit`);
      if (h.entry != null && !['menu', 'streets'].includes(h.entry)) err(`town_hub ${h.id}: entry must be 'menu' or 'streets'`);
      for (const n of h.npcs || []) {
        if (!['trade', 'recruit', 'tavern', 'talk', 'leave'].includes(n.action)) err(`town_hub ${h.id}: ${n.id} has unknown action ${n.action}`);
        if (n.gender != null && n.gender !== 'female') err(`town_hub ${h.id}: ${n.id} gender may only be 'female'`); // P10-G3: drawn from the role
        if (n.dialogue && !C.dialogue?.[n.dialogue]) err(`town_hub ${h.id}: ${n.id} unknown dialogue ${n.dialogue}`);
        if (!n.dialogue && !n.lines?.length) err(`town_hub ${h.id}: ${n.id} has nothing to say`);
        if (n.dialogue && n.action === 'leave') err(`town_hub ${h.id}: ${n.id} leaves, so cannot hold a conversation`);
      }
      // P10-03: every town has the people the story casts by role (CL.town.cast).
      const roles = new Set((h.npcs || []).map((n) => n.role));
      for (const n of h.npcs || []) if (n.role != null && !['innkeeper', 'merchant', 'recruiter', 'elder', 'official', 'guard'].includes(n.role)) err(`town_hub ${h.id}: ${n.id} has unknown role ${n.role}`);
      for (const r of ['innkeeper', 'merchant', 'recruiter']) if (!roles.has(r)) err(`town_hub ${h.id}: needs a ${r}`);
      if (!roles.has('elder') && !roles.has('official')) err(`town_hub ${h.id}: needs an elder or an official`);
      const ACT = { innkeeper: 'tavern', merchant: 'trade', recruiter: 'recruit', guard: 'leave' };
      for (const n of h.npcs || []) if (ACT[n.role] && n.action !== ACT[n.role]) err(`town_hub ${h.id}: the ${n.role} ${n.id} should ${ACT[n.role]}`);
      for (const r of h.obstacles || []) if (r.colors && !['tavern', 'barracks', 'house'].includes(r.look)) err(`town_hub ${h.id}: only buildings take colours`);
      for (const r of h.obstacles || []) if (r.look != null && typeof r.look !== 'string') err(`town_hub ${h.id}: an obstacle's look is a name (no sprite tiles)`);
      for (const d of h.decor || []) if (typeof d?.[0] !== 'string') err(`town_hub ${h.id}: decor kinds are names (no sprite tiles)`);
    }
    for (const k of Object.values(C.contracts || {})) {
      if (!['hunt', 'escort', 'delivery'].includes(k.kind)) err(`contract ${k.id}: unknown kind ${k.kind}`);
      if (!(k.distance?.[1] >= k.distance?.[0])) err(`contract ${k.id}: bad distance`);
      if (k.kind === 'delivery') {
        if (!(k.goodsQty?.[0] >= 1 && k.goodsQty[1] >= k.goodsQty[0])) err(`contract ${k.id}: bad goodsQty`);
        if (!(k.timeLimitDays > 0) || !(k.reward?.goldBase >= 0)) err(`contract ${k.id}: needs a time limit and reward`);
        continue;
      }
      if (!C.party_templates?.[k.band]) err(`contract ${k.id}: unknown band ${k.band}`);
      for (const id of k.troopPool || []) if (!C.troops?.[id]) err(`contract ${k.id}: unknown troop ${id}`);
      if (!(k.timeLimitDays > 0) || !(k.minTroops >= 1 && k.maxTroops >= k.minTroops)) err(`contract ${k.id}: bad limits`);
      if (!(k.reward?.goldBase >= 0)) err(`contract ${k.id}: needs a reward`);
    }
    for (const m of Object.values(C.companions || {})) {
      if (!(m.hp > 0) || !(m.weaponFactor > 0)) err(`companion ${m.id}: needs hp and weaponFactor`);
      if (m.look != null) for (const e of checkLook(m.look, `companion ${m.id}`)) err(e); // P10-G1; drawn by the art kit (P10-G2)
      for (const [slot, id] of Object.entries(m.startGear || {})) {
        if (!m.gearSlots.includes(slot) || C.items?.[id]?.slot !== slot) err(`companion ${m.id}: bad start gear ${id}`);
      }
      for (const sk of Object.keys(m.skills || {})) if (!C.skills?.[sk]) err(`companion ${m.id}: unknown skill ${sk}`);
    }
    for (const h of Object.values(C.town_hubs || {})) {
      for (const n of h.npcs || []) if (n.visible) CL.story?.checkCondition(n.visible, C, `town_hub ${h.id}: ${n.id}`, err);
    }
    CL.retinue?.validate(C, err); // the other companions (P7-06)
    // Dialogue trees and quests: node links, conditions, effects and triggers (js/story.js).
    CL.story?.validate(C, err);
    CL.news?.validate(C, err);
    CL.happenings?.validate(C, err); // world events (P7-08)
    CL.tourney?.validate(C, err); // tournaments (P7-09)
    CL.business?.validate(C, err); // businesses: the mill (P7-10)
    CL.realm?.validate(C, err); // seats, story forts and the nobles of the realms (P8-02)
    CL.tips?.validate(C, err);
    for (const e of Object.values(C.encounters || {})) {
      if (!C.battle_maps?.[e.map]) err(`encounter ${e.id}: unknown map ${e.map}`);
      if (!e.waves?.length) err(`encounter ${e.id}: no waves`);
      for (const w of e.waves || []) {
        for (const [tid, n] of Object.entries(w)) {
          if (!C.troops?.[tid]) err(`encounter ${e.id}: unknown troop ${tid}`);
          if (!(Number.isInteger(n) && n > 0)) err(`encounter ${e.id}: bad count for ${tid}`);
        }
      }
      if (typeof e.loot === 'string' && !C.loot_tables?.[e.loot]) err(`encounter ${e.id}: unknown loot table ${e.loot}`);
      const lt = typeof e.loot === 'string' ? C.loot_tables?.[e.loot] : e.loot;
      for (const entry of lt?.table || []) {
        if (!C.items?.[entry.item]) err(`encounter ${e.id}: unknown loot item ${entry.item}`);
        else if (C.items[entry.item].questItem) err(`encounter ${e.id}: quest item ${entry.item} in random loot`);
        if (!(entry.weight > 0)) err(`encounter ${e.id}: bad weight for ${entry.item}`);
      }
    }
    for (const lt of Object.values(C.loot_tables || {})) {
      if (!(lt.chancePerKill > 0 && lt.chancePerKill <= 1)) err(`loot_table ${lt.id}: bad chancePerKill`);
      for (const entry of lt.table || []) {
        if (!C.items?.[entry.item]) err(`loot_table ${lt.id}: unknown item ${entry.item}`);
        else if (C.items[entry.item].questItem) err(`loot_table ${lt.id}: quest item ${entry.item}`);
        if (!(entry.weight > 0)) err(`loot_table ${lt.id}: bad weight for ${entry.item}`);
      }
    }
    return errors;
  }

  /**
   * P9-08: a world package (docs/WORLD-FORMAT.md) over the shared content: the tables it gives replace
   * those of the same name whole; `merge` then changes fields of entries that exist. Pure data.
   * @param {Record<string, any>} base the content as data/*.js built it
   * @param {Record<string, any>} world a world package (manifest, tables, merge)
   */
  function compose(base, world) {
    const C = { ...base };
    for (const [t, v] of Object.entries(world)) if (t !== 'manifest' && t !== 'merge') C[t] = JSON.parse(JSON.stringify(v));
    for (const [t, entries] of Object.entries(world.merge || {})) {
      C[t] = { ...C[t] };
      for (const [id, fields] of Object.entries(entries)) if (C[t][id]) C[t][id] = { ...C[t][id], ...JSON.parse(JSON.stringify(fields)) };
    }
    return C;
  }

  /** Validate once at boot and log every problem to diagnostics. */
  function init() {
    const errors = validate();
    for (const e of errors) CL.diag.log('error', 'Content error', { error: e });
    if (!errors.length) CL.diag.log('info', 'Content validated', { tables: TABLES.length });
    return errors;
  }

  CL.content = { TABLES, OPTIONAL, LAWS, LOOK, checkLook, lookAgrees, table, get, troop, item, encounter, lootTable, validate, compose, init };
})(typeof window !== 'undefined' ? window : globalThis);
