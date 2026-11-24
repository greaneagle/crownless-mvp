// The Border March as its own world, as builds 2.0–2.6 had it (tests only). W-05b grew the world to
// 200 × 200 with the March whole in the middle (+50, +50), and old saves of the March are refused
// (decision D-W2, owner 2026-11-19). The migrations that brought every earlier save up to date are
// still in js/save.js; their tests load the March as it was to prove they still work:
//   loadGame({ content: oldMarch })
// It keeps only what lies inside the March, moves it back by the offset, and restores 2.6.0's
// kingdoms, goods, roads and party counts. The W-04 test world is built on it.

const OFFSET = 50; // the March's placement in the bigger world, on both axes
const SIZE = 100;
const OLD_GOODS = ['grain', 'salt', 'wool', 'iron', 'cloth', 'tools'];
const KINGDOMS = ['valedorn', 'aurelian'];
const OUTLAWS = 'neutral';
const PATROLS = 2;

const inMarch = (x, y) => x >= OFFSET && x <= OFFSET + SIZE && y >= OFFSET && y <= OFFSET + SIZE;
const back = ([x, y]) => [x - OFFSET, y - OFFSET];

function marchNobles(list, settlements) {
  const kept = list.filter((n) => KINGDOMS.includes(n.realm) && settlements[n.home]);
  const ids = new Set(kept.map((n) => n.id));
  return kept.map((n) => ({ ...n, holds: (n.holds || []).filter((id) => settlements[id]), kin: (n.kin || []).filter((k) => ids.has(k.id)) }));
}

/** @param {Record<string, any>} content CROWNLESS_CONTENT, as the data files built it */
function oldMarch(content) {
  const C = { ...content };
  const ours = new Set([...KINGDOMS, OUTLAWS]);
  C.factions = Object.fromEntries(Object.entries(C.factions).filter(([id]) => ours.has(id)));
  C.troops = Object.fromEntries(Object.entries(C.troops).filter(([, t]) => ours.has(t.faction)));
  const cultures = new Set(Object.values(C.factions).map((f) => f.culture));
  for (const t of Object.values(C.troops)) if (t.culture) cultures.add(t.culture);
  C.cultures = Object.fromEntries(Object.entries(C.cultures).filter(([id]) => cultures.has(id)));
  C.markets = Object.fromEntries(Object.entries(C.markets).filter(([id, g]) => !g.tradeGood || OLD_GOODS.includes(id)));
  const settlements = {};
  for (const [id, s] of Object.entries(C.settlements)) {
    if (!inMarch(s.mapX, s.mapY)) continue;
    const t = { ...s, mapX: s.mapX - OFFSET, mapY: s.mapY - OFFSET };
    if (s.market) t.market = Object.fromEntries(OLD_GOODS.map((g) => [g, s.market[g]]));
    settlements[id] = t;
  }
  C.settlements = settlements;
  // P10-03: only the walkable towns that lie in the March.
  C.town_hubs = Object.fromEntries(Object.entries(C.town_hubs || {}).filter(([, h]) => settlements[h.settlement]));
  const [world] = Object.values(C.world_map);
  const sites = {};
  for (const [id, st] of Object.entries(world.sites)) if (inMarch(st.mapX, st.mapY)) sites[id] = { ...st, mapX: st.mapX - OFFSET, mapY: st.mapY - OFFSET };
  const inside = (poly) => poly.every(([x, y]) => inMarch(x, y));
  C.world_map = {
    border_march: {
      ...world,
      id: 'border_march',
      name: 'The Border March',
      bounds: { w: SIZE, h: SIZE },
      factions: KINGDOMS,
      outlaws: OUTLAWS,
      regions: {
        west_march: { name: 'the western march', x: 0, y: 0, w: 56, h: 100, home: true },
        east_march: { name: 'the eastern march', x: 56, y: 0, w: 44, h: 100, home: true },
      },
      areas: [],
      waters: [],
      coast: [],
      roads: world.roads.map((r) => r.filter((id) => settlements[id])).filter((r) => r.length > 1),
      river: world.river.map(back),
      forests: world.forests.filter(inside).map((f) => f.map(back)),
      hills: world.hills.filter(([x, y]) => inMarch(x, y)).map(back), // P10-02: not the coast's
      // P10-02: only relations between the March's own kingdoms (the coast's realms begin at war).
      relations: (world.relations || []).filter((r) => r.between.every((f) => KINGDOMS.includes(f))),
      sites,
      // The people of the realms (P8-02): only those of these kingdoms whose home lies in the March,
      // holding what lies in it, with kin among themselves.
      nobles: marchNobles(world.nobles || [], settlements),
    },
  };
  const templates = {};
  for (const [id, t] of Object.entries(C.party_templates)) {
    if (!ours.has(t.faction)) continue;
    if ((t.lairs || []).some((l) => !sites[l]) || (t.route || []).some((s) => !settlements[s]) || (t.home && !settlements[t.home])) continue;
    const u = { ...t };
    if (t.kind === 'patrol') u.count = PATROLS;
    if (t.frontier) u.frontier = { ...t.frontier, x: t.frontier.x - OFFSET, y: t.frontier.y - OFFSET };
    templates[id] = u;
  }
  C.party_templates = templates;
  // People and errands of the lands beyond the March (W-05c) go with them.
  C.dialogue = Object.fromEntries(Object.entries(C.dialogue).filter(([, t]) => !t.place || settlements[t.place]));
  C.quests = Object.fromEntries(Object.entries(C.quests).filter(([, q]) => C.dialogue[q.giver]));
  C.companions = Object.fromEntries(Object.entries(C.companions).filter(([, m]) => !m.home || settlements[m.home])); // P7-06: the wider world's companions
  return C;
}

module.exports = { oldMarch, OFFSET };
