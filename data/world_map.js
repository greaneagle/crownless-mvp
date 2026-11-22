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
      // P9-B3 (D-P9b): the size of the world's armies, to match a company of up to 200. `households`:
      // a lord's household, by what they hold (12–27 at 1; 36–81 here, as the garrisons, so every ratio of Phase 8's sieges holds); `garrisons`: a fort's garrison,
      // its target and refill (at the same cost a week: each soldier draws that much less of a wage);
      // `beyondHome`: bands, patrols and caravans that form outside the story's own land (a region marked
      // `home`), which stays as it was for a gentle start.
      armies: { households: 3, garrisons: 3, beyondHome: 2.5 },
      // P8-08: Prototype D's start (design §28.1, Debug → Prototype D start): the player holds `fort` and
      // its `village` for `realm` at `home`; `enemy` goes to war with it and gathers against the fort.
      prototypeD: { realm: 'valedorn', fort: 'westholt_castle', village: 'ashby', enemy: 'hrothmark', home: 'stonebridge' },
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
      // The people of the realms (P8-02, decision D-P8c, owner 2026-11-20): per kingdom a ruler and
      // about six lords. Rank is never stored: a "great", "lesser" or "landless" lord is only what
      // they hold now. `holds`: the holdings they are granted at the start (at most three for a lord;
      // the ruler's office is not capped, and holds every holding nobody else is given). `home`: their
      // own seat, or for the landless their kin's seat or the capital. `kin` ties are returned on both
      // sides (parent ↔ child, sibling, cousin, spouse). `traits`: a short line for P8-07. Men and women
      // (D-P8g): noblewomen hold land and can rule. Merrow, a free city, has no lords. All invented.
      nobles: [
        // Valedorn: the King at Stonebridge; the Greymantles hold Greywall (and Hawise a village under it).
        { id: 'godric_ardane', name: 'Godric Ardane', gender: 'male', realm: 'valedorn', ruler: true, home: 'stonebridge', holds: ['stonebridge', 'oakford'], kin: [{ id: 'alys_ardane', tie: 'child' }], traits: 'stern, pious, slow to forgive' },
        { id: 'hamon_greymantle', name: 'Hamon Greymantle', gender: 'male', realm: 'valedorn', home: 'greywall_fort', holds: ['greywall_fort', 'highmere'], kin: [{ id: 'hawise_greymantle', tie: 'sibling' }, { id: 'tancred_greymantle', tie: 'child' }], traits: 'proud, watchful, a hard border lord' },
        { id: 'avice_westmere', name: 'Avice Westmere', gender: 'female', realm: 'valedorn', home: 'westholt_castle', holds: ['westholt_castle', 'ashby'], kin: [{ id: 'serlo_fernby', tie: 'cousin' }], traits: 'shrewd, patient, keeps her word' },
        { id: 'hawise_greymantle', name: 'Hawise Greymantle', gender: 'female', realm: 'valedorn', home: 'brackenfield', holds: ['brackenfield'], kin: [{ id: 'hamon_greymantle', tie: 'sibling' }], traits: 'blunt, generous, quick to anger' },
        { id: 'serlo_fernby', name: 'Serlo Fernby', gender: 'male', realm: 'valedorn', home: 'fernley', holds: ['fernley'], kin: [{ id: 'avice_westmere', tie: 'cousin' }], traits: 'cautious, thrifty' },
        { id: 'tancred_greymantle', name: 'Tancred Greymantle', gender: 'male', realm: 'valedorn', home: 'greywall_fort', holds: [], kin: [{ id: 'hamon_greymantle', tie: 'parent' }], traits: 'eager, reckless, hungry for land' },
        { id: 'alys_ardane', name: 'Alys Ardane', gender: 'female', realm: 'valedorn', home: 'stonebridge', holds: [], kin: [{ id: 'godric_ardane', tie: 'parent' }], traits: 'clever, restless, her father’s favourite' },
        // Aurelia: the First Magistrate at Eastwatch; Marcia Corvo holds a village under Cassian's Ashgate.
        { id: 'severin_aquila', name: 'Severin Aquila', gender: 'male', realm: 'aurelian', ruler: true, home: 'eastwatch', holds: ['eastwatch', 'redfield'], kin: [{ id: 'junia_aquila', tie: 'child' }], traits: 'learned, cold, bound by the law' },
        { id: 'cassian_vatro', name: 'Cassian Vatro', gender: 'male', realm: 'aurelian', home: 'ashgate_fort', holds: ['ashgate_fort', 'dunmarsh'], kin: [{ id: 'decimo_vatro', tie: 'child' }], traits: 'ambitious, a veteran of the frontier' },
        { id: 'domitia_celer', name: 'Domitia Celer', gender: 'female', realm: 'aurelian', home: 'castra_nova', holds: ['castra_nova', 'calvinum'], kin: [{ id: 'faustin_celer', tie: 'sibling' }], traits: 'proud, exacting, old imperial blood' },
        { id: 'marcia_corvo', name: 'Marcia Corvo', gender: 'female', realm: 'aurelian', home: 'saltmere', holds: ['saltmere'], kin: [], traits: 'practical, a trader at heart' },
        { id: 'faustin_celer', name: 'Faustin Celer', gender: 'male', realm: 'aurelian', home: 'tessaro', holds: ['tessaro'], kin: [{ id: 'domitia_celer', tie: 'sibling' }], traits: 'easygoing, fond of wine' },
        { id: 'decimo_vatro', name: 'Decimo Vatro', gender: 'male', realm: 'aurelian', home: 'ashgate_fort', holds: [], kin: [{ id: 'cassian_vatro', tie: 'parent' }], traits: 'dutiful, in his father’s shadow' },
        { id: 'junia_aquila', name: 'Junia Aquila', gender: 'female', realm: 'aurelian', home: 'eastwatch', holds: [], kin: [{ id: 'severin_aquila', tie: 'parent' }], traits: 'sharp-tongued, a rider of note' },
        // Hrothmark: the King at Hrothgard and his wife Ingrid; Kettil holds a village under Torvald's Skarnwall.
        { id: 'hakon_ulfring', name: 'Hakon Ulfring', gender: 'male', realm: 'hrothmark', ruler: true, home: 'hrothgard', holds: ['hrothgard', 'eldmoor'], kin: [{ id: 'ingrid_ulfring', tie: 'spouse' }], traits: 'bold, open-handed, loves a feast' },
        { id: 'astrid_hallsdottir', name: 'Astrid Hallsdottir', gender: 'female', realm: 'hrothmark', home: 'ulfstead_hold', holds: ['ulfstead_hold', 'birkholm'], kin: [{ id: 'kettil_brandsson', tie: 'cousin' }], traits: 'fierce, honest, holds a grudge' },
        { id: 'torvald_skarn', name: 'Torvald Skarn', gender: 'male', realm: 'hrothmark', home: 'skarnwall', holds: ['skarnwall', 'thornvik'], kin: [{ id: 'ragna_skarn', tie: 'child' }], traits: 'grim, careful, old and wary' },
        { id: 'kettil_brandsson', name: 'Kettil Brandsson', gender: 'male', realm: 'hrothmark', home: 'kettleby', holds: ['kettleby'], kin: [{ id: 'astrid_hallsdottir', tie: 'cousin' }], traits: 'loyal, plain-spoken' },
        { id: 'ingrid_ulfring', name: 'Ingrid Ulfring', gender: 'female', realm: 'hrothmark', home: 'hrothgard', holds: [], kin: [{ id: 'hakon_ulfring', tie: 'spouse' }], traits: 'wise, watchful, the hall’s true voice' },
        { id: 'ragna_skarn', name: 'Ragna Skarn', gender: 'female', realm: 'hrothmark', home: 'skarnwall', holds: [], kin: [{ id: 'torvald_skarn', tie: 'parent' }], traits: 'restless, a shieldmaiden of the hills' },
        // Vessaro: Queen Lucrezia at Vessara; Chiara Morosco holds a village under her brother's Salina.
        { id: 'lucrezia_salviati', name: 'Lucrezia Salviati', gender: 'female', realm: 'vessaro', ruler: true, home: 'vessara', holds: ['vessara', 'pellio'], kin: [{ id: 'matteo_salviati', tie: 'child' }], traits: 'cunning, rich, never in a hurry' },
        { id: 'ottavio_morosco', name: 'Ottavio Morosco', gender: 'male', realm: 'vessaro', home: 'torre_salina', holds: ['torre_salina', 'lucco'], kin: [{ id: 'chiara_morosco', tie: 'sibling' }], traits: 'vain, brave, deep in debt' },
        { id: 'ruggero_canale', name: 'Ruggero Canale', gender: 'male', realm: 'vessaro', home: 'castel_verro', holds: ['castel_verro', 'sorra'], kin: [], traits: 'careful, a builder of walls' },
        { id: 'chiara_morosco', name: 'Chiara Morosco', gender: 'female', realm: 'vessaro', home: 'marenna', holds: ['marenna'], kin: [{ id: 'ottavio_morosco', tie: 'sibling' }], traits: 'quiet, clever, pays her brother’s debts' },
        { id: 'matteo_salviati', name: 'Matteo Salviati', gender: 'male', realm: 'vessaro', home: 'vessara', holds: [], kin: [{ id: 'lucrezia_salviati', tie: 'parent' }], traits: 'charming, idle, a gambler' },
        { id: 'bastiano_lanza', name: 'Bastiano Lanza', gender: 'male', realm: 'vessaro', home: 'vessara', holds: [], kin: [], traits: 'the Queen’s household knight; steady, sworn' }
      ],
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
