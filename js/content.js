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
  ];

  const raw = () => root.CROWNLESS_CONTENT || {};

  function table(name) {
    return raw()[name] || {};
  }

  /** Look up a record; throws on unknown IDs so bad references fail loudly. */
  function get(name, id) {
    const rec = table(name)[id];
    if (!rec) throw new Error(`Unknown ${name} id: ${id}`);
    return rec;
  }

  const troop = (id) => get('troops', id);
  const item = (id) => get('items', id);
  const encounter = (id) => get('encounters', id);

  /** Return a list of human-readable problems; empty means the content is consistent. */
  function validate() {
    const errors = [];
    const C = raw();
    const err = (msg) => errors.push(msg);
    for (const t of TABLES) if (!C[t] || !Object.keys(C[t]).length) err(`missing table: ${t}`);

    for (const t of TABLES) {
      if (t === 'dialogue' || !C[t]) continue;
      for (const [key, rec] of Object.entries(C[t])) if (rec.id !== key) err(`${t}.${key}: id is '${rec.id}'`);
    }

    for (const t of Object.values(C.troops || {})) {
      if (!C.factions?.[t.faction]) err(`troop ${t.id}: unknown faction ${t.faction}`);
      for (const u of [t.upgradeTo, t.altUpgradeTo]) if (u && !C.troops[u]) err(`troop ${t.id}: unknown upgrade ${u}`);
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

    for (const s of Object.values(C.settlements || {})) {
      if (!C.factions?.[s.ownerFaction]) err(`settlement ${s.id}: unknown owner ${s.ownerFaction}`);
    }
    const tradeGoods = Object.values(C.markets || {}).filter((g) => g.tradeGood);
    if (tradeGoods.length !== 6) err(`markets: expected 6 trade goods, found ${tradeGoods.length}`);
    for (const s of Object.values(C.settlements || {})) {
      if (!s.services?.includes('trade')) continue;
      for (const g of tradeGoods) {
        const v = s.market?.[g.id];
        if (!(v >= 0.8 && v <= 1.4)) err(`settlement ${s.id}: market scarcity for ${g.id} must be 0.8–1.4`);
      }
    }
    for (const f of Object.values(C.factions || {})) {
      for (const t of f.recruits || []) if (!C.troops?.[t]) err(`faction ${f.id}: unknown recruit ${t}`);
    }
    for (const m of Object.values(C.world_map || {})) {
      if (!C.settlements?.[m.startSettlement]) err(`world_map ${m.id}: unknown start ${m.startSettlement}`);
      for (const road of m.roads || []) {
        for (const id of road) if (!C.settlements?.[id]) err(`world_map ${m.id}: road through unknown ${id}`);
      }
      for (const k of ['road', 'grass', 'forest']) if (!(m.terrain?.[k] > 0)) err(`world_map ${m.id}: bad terrain ${k}`);
      for (const [key, st] of Object.entries(m.sites || {})) {
        if (st.id !== key) err(`world_map ${m.id}: site ${key} has id ${st.id}`);
        if (!C.encounters?.[st.encounter]) err(`world_map ${m.id}: site ${key} unknown encounter ${st.encounter}`);
      }
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
      if (!['bandit', 'patrol', 'caravan'].includes(t.kind)) err(`party_template ${t.id}: bad kind ${t.kind}`);
      if (!C.factions?.[t.faction]) err(`party_template ${t.id}: unknown faction ${t.faction}`);
      if (!(t.speed > 0) || !(t.count >= 1)) err(`party_template ${t.id}: needs speed and count`);
      for (const [id, range] of Object.entries(t.troops || {})) {
        if (!C.troops?.[id]) err(`party_template ${t.id}: unknown troop ${id}`);
        if (!Array.isArray(range) || !(range[0] >= 0 && range[1] >= range[0])) err(`party_template ${t.id}: bad range for ${id}`);
      }
      const sites = Object.values(C.world_map || {})[0]?.sites || {};
      for (const l of t.lairs || []) if (!sites[l]) err(`party_template ${t.id}: unknown lair ${l}`);
      if (t.home && !C.settlements?.[t.home]) err(`party_template ${t.id}: unknown home ${t.home}`);
      for (const s of t.route || []) if (!C.settlements?.[s]) err(`party_template ${t.id}: unknown route stop ${s}`);
      for (const g of t.goods || []) if (!C.markets?.[g]?.tradeGood) err(`party_template ${t.id}: unknown good ${g}`);
      if (t.kind === 'bandit' && !(t.toll && t.reward && t.loot)) err(`party_template ${t.id}: bandits need toll, reward and loot`);
    }
    for (const k of Object.values(C.contracts || {})) {
      if (!C.party_templates?.[k.band]) err(`contract ${k.id}: unknown band ${k.band}`);
      for (const id of k.troopPool || []) if (!C.troops?.[id]) err(`contract ${k.id}: unknown troop ${id}`);
      if (!(k.timeLimitDays > 0) || !(k.minTroops >= 1 && k.maxTroops >= k.minTroops)) err(`contract ${k.id}: bad limits`);
      if (!(k.reward?.goldBase >= 0)) err(`contract ${k.id}: needs a reward`);
    }
    for (const q of Object.values(C.quests || {})) {
      if (!C.dialogue?.[q.giver]) err(`quest ${q.id}: no dialogue for giver ${q.giver}`);
    }
    for (const e of Object.values(C.encounters || {})) {
      if (!C.battle_maps?.[e.map]) err(`encounter ${e.id}: unknown map ${e.map}`);
      if (!e.waves?.length) err(`encounter ${e.id}: no waves`);
      for (const w of e.waves || []) {
        for (const [tid, n] of Object.entries(w)) {
          if (!C.troops?.[tid]) err(`encounter ${e.id}: unknown troop ${tid}`);
          if (!(Number.isInteger(n) && n > 0)) err(`encounter ${e.id}: bad count for ${tid}`);
        }
      }
      for (const entry of e.loot?.table || []) {
        if (!C.items?.[entry.item]) err(`encounter ${e.id}: unknown loot item ${entry.item}`);
        else if (C.items[entry.item].questItem) err(`encounter ${e.id}: quest item ${entry.item} in random loot`);
        if (!(entry.weight > 0)) err(`encounter ${e.id}: bad weight for ${entry.item}`);
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

  CL.content = { TABLES, table, get, troop, item, encounter, validate, init };
})(typeof window !== 'undefined' ? window : globalThis);
