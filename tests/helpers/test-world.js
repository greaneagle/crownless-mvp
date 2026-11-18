// The W-04 test world (tests only): the real content turned into a different world, to prove nothing
// in js/ assumes the Border March, two kingdoms or a 100 × 100 square. Use it as
//   loadGame({ content: testWorld })
// - three kingdoms with other names: Valedorn becomes Northmark, Aurelian becomes Sunhold, and a
//   third, the Iron Reach, takes Redfield and Saltmere;
// - a 150 × 120 map (bigger than 100 and not square): every place and terrain point is stretched
//   1.5× east–west and 1.2× north–south;
// - its own world id.

const RENAME = { valedorn: 'northmark', aurelian: 'sunhold' };
const SX = 1.5;
const SY = 1.2;
const WORLD = 'test_reaches';
const THIRD = 'ironreach';
const THIRD_LANDS = ['redfield', 'saltmere'];

/** Every string equal to an old kingdom id, and every key that is one, renamed. Prose is untouched. */
function renameIds(v) {
  if (typeof v === 'string') return RENAME[v] ?? v;
  if (Array.isArray(v)) return v.map(renameIds);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[RENAME[k] ?? k] = renameIds(x);
    return out;
  }
  return v;
}

const scalePoint = ([x, y]) => [x * SX, y * SY];

/** @param {Record<string, any>} content CROWNLESS_CONTENT, as the data files built it */
function testWorld(content) {
  const C = renameIds(content);
  // The third kingdom: Sunhold's troops, its own name, banner and lands.
  const sun = C.factions.sunhold;
  C.factions[THIRD] = { ...sun, id: THIRD, name: 'Iron Reach Compact', short: 'Iron Reach', emblem: 'I', order: 3, color: '#6b6b2a', description: 'Hill clans of the far south-east (test world).' };
  C.factions.northmark = { ...C.factions.northmark, name: 'Northmark Crown', short: 'Northmark' };
  C.factions.sunhold = { ...sun, name: 'Sunhold League', short: 'Sunhold' };
  for (const id of THIRD_LANDS) C.settlements[id].ownerFaction = THIRD;
  // Stretch the map.
  for (const s of Object.values(C.settlements)) [s.mapX, s.mapY] = scalePoint([s.mapX, s.mapY]);
  for (const t of Object.values(C.party_templates)) if (t.frontier) [t.frontier.x, t.frontier.y] = scalePoint([t.frontier.x, t.frontier.y]);
  const [march] = Object.values(C.world_map);
  const m = {
    ...march,
    id: WORLD,
    name: 'The Test Reaches',
    bounds: { w: 100 * SX, h: 100 * SY },
    factions: ['northmark', 'sunhold', THIRD],
    river: march.river.map(scalePoint),
    forests: march.forests.map((f) => f.map(scalePoint)),
    hills: march.hills.map(scalePoint),
    regions: {
      north: { name: 'the north', x: 0, y: 0, w: 150, h: 60 },
      south: { name: 'the south', x: 0, y: 60, w: 150, h: 60 },
    },
    view: { zoom: 1 },
  };
  m.sites = {};
  for (const [id, st] of Object.entries(march.sites)) {
    const [x, y] = scalePoint([st.mapX, st.mapY]);
    m.sites[id] = { ...st, mapX: x, mapY: y };
  }
  C.world_map = { [WORLD]: m };
  return C;
}

module.exports = { testWorld, WORLD, THIRD, THIRD_LANDS, SX, SY };
