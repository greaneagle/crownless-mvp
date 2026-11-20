/* Crownless content: world_map. Plain classic script; no modules, no fetch.
 * A world package (W-04): its size, kingdoms, start, regions and default view are data, so nothing in
 * js/ assumes the Border March, two kingdoms or a 100 × 100 map. The game plays the campaign's world
 * (its saved worldId), and a new game the first world listed here.
 * The Sundered Realm (W-05b): the Border March (GDD §3) in the middle of four kingdoms and a free city.
 * Coordinates are map units inside `bounds`, the same space as settlements' mapX/mapY.
 * Travel speed (GDD §3): baseSpeed map-units/hour × terrain factor. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.world_map = {
    sundered_realm: {
      id: 'sundered_realm',
      name: 'The Sundered Realm',
      start: 'stonebridge',
      // W-05b (decision D-W1): about four times the Border March's area. The March sits whole in the
      // middle (its old coordinates + 50, + 50), so its layout, roads, story distances and lairs are as
      // they were; the kingdoms around it fill the rest. Old saves (the 100 × 100 March) are refused
      // (decision D-W2, owner 2026-11-19): this is a different world.
      bounds: { w: 200, h: 200 }, // map units; every place, road and party stays inside
      factions: ['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'merrow'], // this world's kingdoms (data/factions.js)
      outlaws: 'neutral', // the faction of road bands and sell-swords: not a kingdom, never diplomatic
      // Relations between kingdoms at the start (W-07); any pair not listed is at peace. `story`: the
      // story holds it until its ending, which sets it (decision D-W5: the March pair stays in
      // tension, its frontier clashes going on, until Q4 ends).
      relations: [{ between: ['valedorn', 'aurelian'], state: 'tension', story: true }],
      // The world simulation's budget (W-07): no more than this many regular parties spawn in one region.
      simulation: { partiesPerRegion: 16 },
      // Named areas, for news and text: rectangles in map units (x, y, w, h); the first that holds a
      // point names it. `home` marks the story's own land (W-05c: the Border March): leaving it shows
      // the "Beyond the March" tip, and the story bot keeps to it.
      regions: {
        merrow_coast: { name: 'the Merrow coast', x: 160, y: 152, w: 40, h: 48 },
        west_march: { name: 'the western march', x: 50, y: 50, w: 56, h: 100, home: true },
        east_march: { name: 'the eastern march', x: 106, y: 50, w: 44, h: 100, home: true },
        north: { name: 'the northern highlands', x: 0, y: 0, w: 200, h: 50 },
        south: { name: 'the southern coast', x: 0, y: 150, w: 200, h: 50 },
        west: { name: 'the western shires', x: 0, y: 50, w: 50, h: 100 },
        east: { name: 'the eastern provinces', x: 150, y: 50, w: 50, h: 100 }
      },
      view: { zoom: 1 }, // the map's opening zoom until the player picks their own: the March's scale
      baseSpeed: 4,
      // Travel speed factor of each kind of ground (W-05a). Every kind is passable (decision D-W4):
      // routes differ by cost, never by walls. A river is slow to cross except at a ford or bridge;
      // a mountain pass is a road through the mountains.
      terrain: { road: 1.2, grass: 1.0, forest: 0.75, hills: 0.8, mountain: 0.4, marsh: 0.5, river: 0.3, ford: 0.8, bridge: 1.0 },
      // The battle map for a fight on each kind of ground (W-05a); anything else is `open`, or `fort`
      // within a few units of a fort. Hills and marsh borrow the open and forest maps until their art
      // exists.
      battleMaps: { forest: 'forest_wilds', hills: 'hill_slopes', mountain: 'hill_slopes', marsh: 'forest_wilds', river: 'river_ford', ford: 'river_ford', open: 'open_country', fort: 'greywall_courtyard' },
      // Terrain features (W-05a): `areas` of hills, mountain or marsh ({ kind, poly }), `waters` that
      // cost travel ({ line, width, crossings: [{ kind: 'ford' | 'bridge', x, y, r }] }) and `coast`
      // (the sides of the map that meet the sea). The March's own river and hills (`river`, `hills`
      // below) stay drawn only, so travel inside the March is as it was.
      areas: [
        // The Hrothmark range between the north and the March; the Hrothgard–Greywall road is its pass.
        { kind: 'mountain', poly: [[56, 38], [80, 41], [100, 36], [125, 40], [148, 36], [150, 46], [125, 49], [100, 47], [80, 49], [58, 47]] },
        { kind: 'hills', poly: [[8, 4], [44, 4], [48, 28], [22, 34], [6, 26]] },
        { kind: 'hills', poly: [[186, 36], [198, 36], [198, 72], [186, 72]] },
        { kind: 'marsh', poly: [[4, 148], [44, 150], [40, 166], [18, 172], [4, 166]] }
      ],
      waters: [
        {
          // The Vess, from the March's river down to the sea, between Vessara and Castel Verro.
          line: [[108, 151.5], [106, 164], [102, 180], [100, 200]],
          width: 1.2,
          crossings: [
            { kind: 'ford', x: 106, y: 164, r: 2 },
            { kind: 'bridge', x: 101.8, y: 181.9, r: 2.5 } // the coast road
          ]
        }
      ],
      coast: ['south'],
      roadWidth: 1.6, // map units either side of a road's centre line
      // Gameplay distance (W-02): a unit north–south counts this much of one east–west, so a journey
      // takes as long as it looks on 2.0's map. Part of the world, not the view: zoom never changes it.
      aspect: 4.96 / 8.8,
      // Fixed campaign time, in game hours, for things that happen off the map clock (V2-04, owner
      // decision 2026-11-17: a battle takes a fixed amount of overworld time, however long it is
      // fought). js/clock.js applies them; nothing else charges time.
      time: { battle: 4, capture: 12, rest: 24 },
      // Roads, as chains of settlements. The March's two (GDD §3: the west–east trade road and the
      // north–south fort road) run on into the kingdoms beyond; the rest are new (W-05b).
      roads: [
        ['ashby', 'oakford', 'stonebridge', 'eastwatch', 'redfield', 'tessaro'],
        ['hrothgard', 'greywall_fort', 'stonebridge', 'ashgate_fort', 'saltmere', 'castel_verro'],
        ['lucco', 'torre_salina', 'vessara', 'pellio', 'castel_verro', 'sorra', 'merrow'],
        ['birkholm', 'ulfstead_hold', 'hrothgard', 'skarnwall', 'kettleby'],
        ['eldmoor', 'hrothgard'],
        ['thornvik', 'skarnwall'],
        ['ulfstead_hold', 'westholt_castle', 'ashby', 'fernley', 'torre_salina'],
        ['skarnwall', 'calvinum', 'castra_nova', 'tessaro', 'merrow']
      ],
      river: [[105, 50], [108, 68], [111, 88], [110, 102], [108, 116], [111, 132], [108, 150]],
      forests: [
        [[58, 68], [80, 62], [88, 76], [83, 90], [68, 94], [56, 84]],
        [[114, 128], [132, 134], [128, 148], [112, 149], [108, 140]],
        [[56, 4], [70, 2], [72, 20], [58, 24]],
        [[4, 60], [30, 56], [34, 68], [14, 72]],
        [[182, 100], [196, 104], [194, 140], [184, 136]]
      ],
      hills: [[94, 72], [99, 68], [88, 78], [136, 80], [140, 88]],
      // Non-settlement points of interest that start a battle: two lairs in each region.
      sites: {
        looter_camp: {
          id: 'looter_camp',
          name: 'Looter Camp',
          mapX: 90,
          mapY: 97,
          encounter: 'looter_band',
          respawnDays: 2,
          text: 'A handful of ragged looters squat by the road, waiting for easy prey. A fair first test for a lone sword.'
        },
        reaver_hideout: {
          id: 'reaver_hideout',
          name: 'Reaver Hideout',
          mapX: 96,
          mapY: 124,
          encounter: 'captains_trial',
          respawnDays: 3,
          text: 'Road Reavers have dug in among the stones here. Clear them out and claim what they have stolen.'
        },
        raider_steading: {
          id: 'raider_steading',
          name: 'Raider Steading',
          mapX: 44,
          mapY: 40,
          encounter: 'raider_warband',
          respawnDays: 3,
          text: 'A burned-out steading under the mountains, where clanless raiders winter on stolen sheep.'
        },
        broken_tower: {
          id: 'broken_tower',
          name: 'Broken Tower',
          mapX: 170,
          mapY: 44,
          encounter: 'captains_trial',
          respawnDays: 3,
          text: 'An old watchtower with half its stones gone. Someone has lit a fire in what is left of it.'
        },
        outlaw_glade: {
          id: 'outlaw_glade',
          name: 'Outlaw Glade',
          mapX: 10,
          mapY: 92,
          encounter: 'looter_band',
          respawnDays: 2,
          text: 'Smoke rises from a clearing in the western woods. Outlaws, and not many of them.'
        },
        burnt_mill: {
          id: 'burnt_mill',
          name: 'Burnt Mill',
          mapX: 40,
          mapY: 142,
          encounter: 'captains_trial',
          respawnDays: 3,
          text: 'A mill burned in some forgotten feud. Reavers use its walls to watch the road south.'
        },
        deserter_camp: {
          id: 'deserter_camp',
          name: 'Deserters’ Camp',
          mapX: 192,
          mapY: 84,
          encounter: 'deserter_band',
          respawnDays: 3,
          text: 'Men who left the eastern legions with their arms and none of their discipline.'
        },
        old_watchtower: {
          id: 'old_watchtower',
          name: 'Old Watchtower',
          mapX: 160,
          mapY: 142,
          encounter: 'looter_band',
          respawnDays: 2,
          text: 'An imperial signal tower, long abandoned. Looters have made it their own.'
        },
        wreckers_cove: {
          id: 'wreckers_cove',
          name: 'Wreckers’ Cove',
          mapX: 40,
          mapY: 194,
          encounter: 'raider_warband',
          respawnDays: 3,
          text: 'False lights on the rocks and a beach full of other people’s cargo.'
        },
        marsh_hideout: {
          id: 'marsh_hideout',
          name: 'Marsh Hideout',
          mapX: 24,
          mapY: 158,
          encounter: 'deserter_band',
          respawnDays: 3,
          text: 'Stilt huts deep in the reeds, where the League’s deserters hide from its magistrates.'
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
