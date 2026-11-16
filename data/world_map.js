/* Crownless content: world_map. Plain classic script; no modules, no fetch.
 * The Border March strategic map (GDD §3). Coordinates are map units, the same 0–100 space
 * as settlements' mapX/mapY. Valedorn holds the west, Aurelian the east; the river splits them.
 * Travel speed (GDD §3): baseSpeed map-units/hour × terrain factor. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.world_map = {
    border_march: {
      id: 'border_march',
      name: 'The Border March',
      startSettlement: 'stonebridge',
      baseSpeed: 4,
      terrain: { road: 1.2, grass: 1.0, forest: 0.75 },
      roadWidth: 1.6, // map units either side of a road's centre line
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
