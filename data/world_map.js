/* Crownless content: world_map. Plain classic script; no modules, no fetch.
 * A world package (W-04): its size, kingdoms, start, regions and default view are data, so nothing in
 * js/ assumes the Border March, two kingdoms or a 100 × 100 map. The game plays the campaign's world
 * (its saved worldId), and a new game the first world listed here.
 * The Border March strategic map (GDD §3). Coordinates are map units inside `bounds`, the same space
 * as settlements' mapX/mapY. Valedorn holds the west, Aurelian the east; the river splits them.
 * Travel speed (GDD §3): baseSpeed map-units/hour × terrain factor. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.world_map = {
    border_march: {
      id: 'border_march',
      name: 'The Border March',
      start: 'stonebridge',
      bounds: { w: 100, h: 100 }, // map units; every place, road and party stays inside
      factions: ['valedorn', 'aurelian'], // this world's kingdoms (data/factions.js)
      outlaws: 'neutral', // the faction of road bands and sell-swords: not a kingdom, never diplomatic
      // Named areas, for news and text: rectangles in map units (x, y, w, h); the first that holds a
      // point names it.
      regions: {
        west_march: { name: 'the western march', x: 0, y: 0, w: 56, h: 100 },
        east_march: { name: 'the eastern march', x: 56, y: 0, w: 44, h: 100 }
      },
      view: { zoom: 1 }, // the map's opening zoom until the player picks their own
      baseSpeed: 4,
      terrain: { road: 1.2, grass: 1.0, forest: 0.75 },
      roadWidth: 1.6, // map units either side of a road's centre line
      // Gameplay distance (W-02): a unit north–south counts this much of one east–west, so a journey
      // takes as long as it looks on 2.0's map. Part of the world, not the view: zoom never changes it.
      aspect: 4.96 / 8.8,
      // Fixed campaign time, in game hours, for things that happen off the map clock (V2-04, owner
      // decision 2026-11-17: a battle takes a fixed amount of overworld time, however long it is
      // fought). js/clock.js applies them; nothing else charges time.
      time: { battle: 4, capture: 12, rest: 24 },
      // Two roads (GDD §3): west–east trade road and the north–south fort road.
      roads: [
        ['oakford', 'stonebridge', 'eastwatch', 'redfield'],
        ['greywall_fort', 'stonebridge', 'ashgate_fort', 'saltmere']
      ],
      river: [[55, 0], [58, 18], [61, 38], [60, 52], [58, 66], [61, 82], [58, 100]],
      forests: [
        [[8, 18], [30, 12], [38, 26], [33, 40], [18, 44], [6, 34]],
        [[64, 78], [82, 84], [78, 98], [62, 99], [58, 90]]
      ],
      hills: [[44, 22], [49, 18], [38, 28], [86, 30], [90, 38]],
      // Non-settlement points of interest that start a battle.
      sites: {
        looter_camp: {
          id: 'looter_camp',
          name: 'Looter Camp',
          mapX: 40,
          mapY: 47,
          encounter: 'looter_band',
          respawnDays: 2,
          text: 'A handful of ragged looters squat by the road, waiting for easy prey. A fair first test for a lone sword.'
        },
        reaver_hideout: {
          id: 'reaver_hideout',
          name: 'Reaver Hideout',
          mapX: 46,
          mapY: 74,
          encounter: 'captains_trial',
          respawnDays: 3,
          text: 'Road Reavers have dug in among the stones here. Clear them out and claim what they have stolen.'
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
