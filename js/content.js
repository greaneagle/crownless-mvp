/* Crownless ContentDB: typed access to window.CROWNLESS_CONTENT (data/*.js) plus
 * load-time reference validation. One authoritative source per ID (GDD §13). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

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
    'backgrounds',
    'party_templates',
    'contracts',
    'town_hubs',
    'loot_tables',
    'companions',
    'news',
    'help_topics',
    'cultures',
    'tips',
  ];

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
    const rec = table(name)[id];
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

  /** Return a list of human-readable problems; empty means the content is consistent. */
  function validate() {
    const errors = [];
    const C = raw();
    const err = (msg) => errors.push(msg);
    for (const t of TABLES) if (!C[t] || !Object.keys(C[t]).length) err(`missing table: ${t}`);

    for (const t of TABLES) {
      if (!C[t]) continue;
      for (const [key, rec] of Object.entries(C[t])) if (rec.id !== key) err(`${t}.${key}: id is '${rec.id}'`);
    }

    for (const t of Object.values(C.troops || {})) {
      if (!C.factions?.[t.faction]) err(`troop ${t.id}: unknown faction ${t.faction}`);
      for (const u of [t.upgradeTo, t.altUpgradeTo]) if (u && !C.troops[u]) err(`troop ${t.id}: unknown upgrade ${u}`);
      for (const k of ['shield', 'brace']) if (t[k] != null && typeof t[k] !== 'boolean') err(`troop ${t.id}: ${k} must be true or false`);
      if (t.shield && t.role === 'archer') err(`troop ${t.id}: archers carry no shield`);
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
      if (!['forest', 'field', 'ford'].includes(gen.kind)) err(`battle_map ${m.id}: unknown generator ${gen.kind}`);
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
    for (const b of Object.values(C.backgrounds || {})) {
      if (!['str', 'agi', 'int', 'cha'].includes(b.attribute)) err(`background ${b.id}: bad attribute ${b.attribute}`);
      if (!C.skills?.[b.skill]) err(`background ${b.id}: unknown skill ${b.skill}`);
      if (!(b.kit?.gold >= 0)) err(`background ${b.id}: kit needs gold`);
      for (const [slot, id] of Object.entries(b.kit?.equipment || {})) {
        if (C.items?.[id]?.slot !== slot) err(`background ${b.id}: kit item ${id} does not fit ${slot}`);
      }
      for (const id of Object.keys(b.kit?.items || {})) if (!C.items?.[id]) err(`background ${b.id}: unknown kit item ${id}`);
    }
    for (const t of Object.values(C.party_templates || {})) {
      if (!['bandit', 'patrol', 'caravan', 'detachment'].includes(t.kind)) err(`party_template ${t.id}: bad kind ${t.kind}`);
      if (!C.factions?.[t.faction]) err(`party_template ${t.id}: unknown faction ${t.faction}`);
      if (!(t.speed > 0) || !(t.count >= (t.kind === 'detachment' ? 0 : 1))) err(`party_template ${t.id}: needs speed and count`);
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
      }
    }
    for (const h of Object.values(C.town_hubs || {})) {
      if (!C.settlements?.[h.settlement]?.explorable) err(`town_hub ${h.id}: settlement ${h.settlement} is not explorable`);
      if (!h.spawn || !h.exitZone) err(`town_hub ${h.id}: needs a spawn and an exit`);
      if (h.entry != null && !['menu', 'streets'].includes(h.entry)) err(`town_hub ${h.id}: entry must be 'menu' or 'streets'`);
      for (const n of h.npcs || []) {
        if (!['trade', 'recruit', 'tavern', 'talk', 'leave'].includes(n.action)) err(`town_hub ${h.id}: ${n.id} has unknown action ${n.action}`);
        if (!n.frames?.length) err(`town_hub ${h.id}: ${n.id} needs sprite frames`);
        if (n.dialogue && !C.dialogue?.[n.dialogue]) err(`town_hub ${h.id}: ${n.id} unknown dialogue ${n.dialogue}`);
        if (!n.dialogue && !n.lines?.length) err(`town_hub ${h.id}: ${n.id} has nothing to say`);
        if (n.dialogue && n.action === 'leave') err(`town_hub ${h.id}: ${n.id} leaves, so cannot hold a conversation`);
      }
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
      if (!m.frames?.length || !(m.hp > 0) || !(m.weaponFactor > 0)) err(`companion ${m.id}: needs frames, hp and weaponFactor`);
      for (const [slot, id] of Object.entries(m.startGear || {})) {
        if (!m.gearSlots.includes(slot) || C.items?.[id]?.slot !== slot) err(`companion ${m.id}: bad start gear ${id}`);
      }
      for (const sk of Object.keys(m.skills || {})) if (!C.skills?.[sk]) err(`companion ${m.id}: unknown skill ${sk}`);
    }
    for (const h of Object.values(C.town_hubs || {})) {
      for (const n of h.npcs || []) if (n.visible) CL.story?.checkCondition(n.visible, C, `town_hub ${h.id}: ${n.id}`, err);
    }
    // Dialogue trees and quests: node links, conditions, effects and triggers (js/story.js).
    CL.story?.validate(C, err);
    CL.news?.validate(C, err);
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

  /** Validate once at boot and log every problem to diagnostics. */
  function init() {
    const errors = validate();
    for (const e of errors) CL.diag.log('error', 'Content error', { error: e });
    if (!errors.length) CL.diag.log('info', 'Content validated', { tables: TABLES.length });
    return errors;
  }

  CL.content = { TABLES, table, get, troop, item, encounter, lootTable, validate, init };
})(typeof window !== 'undefined' ? window : globalThis);
