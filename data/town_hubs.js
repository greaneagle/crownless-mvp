/* Crownless content: town_hubs. Plain classic script; no modules, no fetch.
 * Walkable towns (GDD §8; P10-03): every capital and free city has streets to walk, each laid out
 * its own way (a ford town, a forum, a hill town, harbours, a river city, a cliff town, a salt
 * market). Villages and forts stay menu-only. NPCs stand in place or pace a short loop; talking
 * opens their menu. The scene uses the battle-map format (ground, decor, obstacles) on the same
 * 960×540 canvas, so the same collision and drawing code applies. People walk inside x 47–908,
 * y 65–490 (js/units.js BOUNDS); an obstacle with no `look` is an unseen wall (the sea, a river).
 *   npcs[].gender: 'female' for a woman (the art kit draws the people from their role, P10-G3)
 *   npcs[].pace:   optional [x, y] the NPC walks to and back from
 *   npcs[].action: 'trade' | 'recruit' | 'tavern' | 'talk' | 'leave'
 *   npcs[].role:   'innkeeper' | 'merchant' | 'recruiter' | 'elder' | 'official' | 'guard': who they
 *                  are in the town, so the story can cast them (CL.town.cast). Every hub has an
 *                  innkeeper, a merchant, a recruiter and an elder or official.
 *   npcs[].lines:  what they say (one is picked each time you talk)
 *   npcs[].tag:    short title shown under their feet
 *   npcs[].visible: optional story condition for appearing at all (js/story.js vocabulary)
 *   npcs[].short:  the name the story calls them by ('Maren'), for those it casts (P10-04)
 *   spots:         [{ x, y }]: where the story's people stand when it casts them here (P10-04: your
 *                  realm's envoy and Mara in your start town, the rival's envoy and caravan master in
 *                  its town). The elder and recruiter of your start town speak the story in person.
 *   obstacles[].colors: optional { wall, roof, door } for a building, in the town's own style
 *   obstacles[].spec:   optional art-kit building spec (js/art/kit.js `building`) over the one made from
 *                       its kind and its realm's culture: a landmark's tower, its roof form, its sign
 *   ground.road / ground.plaza.color: optional street and square colours
 *   every town is drawn with the storybook kit (P11-12c, js/art/story.js); drawing only
 *   entry: 'menu' (default) or 'streets': what arriving opens. Menu first, with "Walk the streets"
 *          one tap away (owner playtest finding F-3); people with conversations are also listed there. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var tree = function (x, y) {
    return { shape: 'circle', x: x, y: y, r: 20, blocksArrows: true, look: 'tree' };
  };
  var building = function (look, x, y, w, h, label, colors, spec) {
    var o = { shape: 'rect', x: x, y: y, w: w, h: h, look: look };
    if (label) o.label = label;
    if (colors) o.colors = colors;
    if (spec) o.spec = spec;
    return o;
  };
  var stall = function (x, y, label) {
    return { shape: 'rect', x: x, y: y, w: 100, h: 50, look: 'stall', label: label };
  };
  // Water and cliff edges: walls you cannot see (the water is drawn by the ground).
  var unseen = function (x, y, w, h) {
    return { shape: 'rect', x: x, y: y, w: w, h: h };
  };
  // A run of the same decor tile along a line.
  var row = function (tile, x0, x1, y, w, h) {
    var out = [];
    var px;
    for (px = x0; px < x1; px += w) out.push([tile, px, y, w, h]);
    return out;
  };
  // Building styles by culture.
  var IMPERIAL = { wall: '#e6dcc4', roof: '#a5452c', door: '#5a3a22' };
  var NORTH = { wall: '#7a5a3a', roof: '#56663f', door: '#2a1d12' };
  var NORTH_STONE = { wall: '#8d8778', roof: '#3e4a3a', door: '#2a1d12' };
  var SOUTH = { wall: '#e0b77a', roof: '#b5532e', door: '#5a3a22' };
  var RIVER = { wall: '#cdb896', roof: '#5d4a6a', door: '#3a2614' };
  var PORT = { wall: '#b89e78', roof: '#3f5f6f', door: '#3a2614' };
  var CLIFF = { wall: '#a49a88', roof: '#3d4650', door: '#2a2620' };
  var SALT = { wall: '#efe6cf', roof: '#6e8a9a', door: '#4a3a2a' };

  C.town_hubs = {
    // A ford town at a crossroads: inn, stall, muster hall and the elder round a cobbled square.
    stonebridge: {
      id: 'stonebridge',
      settlement: 'stonebridge',
      name: 'Stonebridge',
      entry: 'menu',
      ground: {
        base: '#6f8f4e',
        roads: [
          { x: 30, y: 270, w: 470, h: 56 },
          { x: 440, y: 120, w: 70, h: 330 },
          { x: 440, y: 230, w: 330, h: 60 }
        ],
        plaza: { x: 475, y: 290, rx: 120, ry: 70 }
      },
      decor: [['ferns', 560, 360, 40, 31], ['leaves', 380, 210, 36, 28], ['ferns', 300, 330, 40, 31], ['leaves', 640, 180, 36, 28]],
      obstacles: [
        { shape: 'rect', x: 110, y: 80, w: 220, h: 120, look: 'tavern', label: 'The Grey Ford Inn' },
        { shape: 'rect', x: 520, y: 100, w: 110, h: 60, look: 'stall', label: 'Market' },
        { shape: 'rect', x: 690, y: 80, w: 200, h: 120, look: 'barracks', label: 'Muster Hall' },
        { shape: 'rect', x: 680, y: 350, w: 190, h: 110, look: 'house', label: "Elder's House", spec: { wall: 'plaster', base: true, beams: true, roof: 'slate', form: 'hip', tower: 'right', windows: 3 } },
        { shape: 'rect', x: 130, y: 370, w: 150, h: 95, look: 'house', spec: { wall: 'plaster', base: true, beams: false, roof: 'thatch', form: 'gable', door: 'center', windows: 2, chimney: -0.45 } },
        { shape: 'circle', x: 470, y: 330, r: 22, look: 'well' },
        tree(60, 120), tree(370, 470), tree(900, 300), tree(620, 470)
      ],
      spawn: { x: 90, y: 298 },
      spots: [{ x: 330, y: 300 }, { x: 300, y: 238 }, { x: 592, y: 360 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 47, y: 262, w: 20, h: 72 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Hilde the Innkeeper',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 220,
          y: 228,
          action: 'tavern',
          lines: [
            'A bed, a bowl and a fire. Sit, rest your feet.',
            'Merchants say the Eastwatch road is thick with reavers this season.',
            'The notice by my door has paid work, if your sword wants feeding.'
          ]
        },
        {
          id: 'merchant',
          name: 'Ottmar the Merchant',
          tag: 'Merchant',
          role: 'merchant',
          x: 575,
          y: 190,
          pace: [640, 190],
          action: 'trade',
          lines: ['Grain from Oakford, salt from the coast — buy cheap, sell dear.', 'Prices rise when the caravans stop coming. Mark my words.']
        },
        {
          id: 'sergeant',
          name: 'Sergeant Brun',
          short: 'Brun',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 760,
          y: 238,
          pace: [850, 238],
          action: 'recruit',
          lines: ['Strong backs and steady hands wanted. Coin up front.', 'A levy with a full belly fights twice as hard.']
        },
        {
          id: 'elder',
          name: 'Elder Maren',
          short: 'Maren',
          tag: 'Elder',
          role: 'elder',
          gender: 'female',
          x: 775,
          y: 318,
          action: 'talk',
          lines: ['Stonebridge has stood at this ford since before the empire. It will stand after.']
        },
        {
          id: 'guard',
          name: 'Gate Guard',
          tag: 'Gate',
          role: 'guard',
          x: 70,
          y: 250,
          action: 'leave',
          lines: ['Mind the road out there.']
        }
      ]
    },

    // The Aurelian forum: a walled square of white stone round a fountain, the basilica at its head,
    // red-tiled halls on both sides. You come in by the south gate.
    eastwatch: {
      id: 'eastwatch',
      settlement: 'eastwatch',
      name: 'Eastwatch',
      ground: {
        base: '#7d8a5a',
        road: '#b7a07a',
        roads: [{ x: 445, y: 410, w: 70, h: 130 }, { x: 120, y: 300, w: 140, h: 40 }, { x: 700, y: 300, w: 140, h: 40 }],
        stone: { x: 250, y: 196, w: 460, h: 224, color: '#c4b99e' }
      },
      decor: [['leaves', 270, 440, 36, 28], ['leaves', 650, 440, 36, 28], ['ferns', 230, 150, 40, 31], ['ferns', 700, 150, 40, 31]],
      obstacles: [
        building('wall', 24, 50, 912, 20),
        building('house', 380, 80, 200, 100, 'Basilica', IMPERIAL, { wall: 'whitewash', base: true, beams: false, form: 'hip', tower: 'right', windows: 4, door: 'center' }),
        building('tavern', 60, 170, 180, 110, 'The Ninth Mile', IMPERIAL),
        building('barracks', 730, 170, 190, 115, 'Legion Muster', { wall: '#d9cdb2', roof: '#8e3a26', door: '#3a2a1a' }),
        stall(290, 330, 'Grain'),
        stall(570, 330, 'Cloth'),
        { shape: 'circle', x: 480, y: 300, r: 24, look: 'well' },
        building('house', 60, 400, 150, 95, null, IMPERIAL),
        building('house', 760, 400, 150, 95, null, IMPERIAL),
        tree(300, 130),
        tree(660, 130)
      ],
      spawn: { x: 480, y: 445 },
      spots: [{ x: 496, y: 360 }, { x: 608, y: 264 }, { x: 352, y: 264 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 440, y: 475, w: 80, h: 20 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Prisca the Innkeeper',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 150,
          y: 305,
          action: 'tavern',
          lines: [
            'Nine miles from the old milestone, and the wine is older still.',
            'Legion men drink here. Mind your tongue about the emperor.',
            'A bed upstairs, a bath out back. Both cost the same.'
          ]
        },
        {
          id: 'merchant',
          name: 'Marcel Rufo',
          tag: 'Merchant',
          role: 'merchant',
          x: 340,
          y: 405,
          pace: [620, 405],
          action: 'trade',
          lines: ['Cloth from the south, grain from the river farms. All weighed by imperial measure.', 'The forum sets the price. I only whisper it.']
        },
        {
          id: 'recruiter',
          name: 'Optio Varo Lupo',
          short: 'Varo',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 820,
          y: 310,
          pace: [745, 310],
          action: 'recruit',
          lines: ['The legion still takes men who can hold a line. Sign, and eat.', 'Spear, shield, sandals. The rest we teach.']
        },
        {
          id: 'magistrate',
          name: 'Magistrate Oren Stellan',
          short: 'Oren',
          tag: 'Magistrate',
          role: 'official',
          x: 480,
          y: 212,
          action: 'talk',
          lines: [
            'Eastwatch keeps the old laws, written down. That is what makes us an empire still.',
            'The Remnant holds the east because it remembers. Do not forget that here.'
          ]
        },
        {
          id: 'guard',
          name: 'Gate Legionary',
          tag: 'Gate',
          role: 'guard',
          x: 400,
          y: 455,
          action: 'leave',
          lines: ['The south gate shuts at dusk. Ride on.']
        }
      ]
    },

    // A hill town in the snow: the path climbs from the west gate past the mead hall to the jarl's
    // hall at the top, with the huscarls' yard below it.
    hrothgard: {
      id: 'hrothgard',
      settlement: 'hrothgard',
      name: 'Hrothgard',
      ground: {
        base: '#b9c2c0',
        road: '#8a7a66',
        patches: [{ x: 300, y: 470, rx: 160, ry: 40, color: '#a7afab' }, { x: 820, y: 280, rx: 90, ry: 50, color: '#c9d0cd' }],
        roads: [
          { x: 24, y: 330, w: 486, h: 56 },
          { x: 450, y: 180, w: 60, h: 206 },
          { x: 450, y: 180, w: 380, h: 56 }
        ]
      },
      decor: [['fence', 200, 300, 52, 37], ['fence', 252, 300, 52, 37], ['fence', 520, 250, 52, 37], ['turf', 30, 180, 58, 36], ['turf', 860, 370, 58, 36]],
      obstacles: [
        building('barracks', 600, 40, 300, 130, "Jarl's Hall", NORTH, { form: 'long', beams: true, door: 'center', sign: null, shields: true, banner: true, chimney: -0.5 }),
        building('tavern', 180, 180, 220, 110, 'The Horn and Hearth', NORTH),
        stall(560, 280, 'Furs & Iron'),
        building('barracks', 700, 400, 200, 105, 'Huscarl Yard', NORTH_STONE),
        building('house', 220, 400, 130, 90, null, NORTH),
        building('house', 30, 60, 140, 95, null, NORTH),
        building('house', 330, 40, 120, 90, null, NORTH),
        tree(900, 300),
        tree(40, 260),
        tree(520, 110)
      ],
      spawn: { x: 90, y: 358 },
      spots: [{ x: 480, y: 288 }, { x: 600, y: 216 }, { x: 440, y: 168 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 47, y: 330, w: 20, h: 56 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Tove of the Hearth',
          tag: 'Alewife',
          role: 'innkeeper',
          gender: 'female',
          x: 290,
          y: 315,
          action: 'tavern',
          lines: [
            'Mead, mutton and a seat by the fire. Snow off your boots first.',
            'The skalds sing of the old jarls here every winter night.',
            'When the passes close, every sword in Hrothgard drinks at my tables.'
          ]
        },
        {
          id: 'merchant',
          name: 'Orm Netter',
          tag: 'Trader',
          role: 'merchant',
          x: 615,
          y: 385,
          pace: [688, 385],
          action: 'trade',
          lines: ['Furs, iron and timber go south. Wine and salt come north, dear.', 'The wolves take the cheap furs. I sell the rest.']
        },
        {
          id: 'recruiter',
          name: 'Halvar Axehand',
          short: 'Halvar',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 600,
          y: 450,
          pace: [470, 450],
          action: 'recruit',
          lines: ['Can you swing an axe in the cold? Then the jarl will feed you.', 'Huscarls are made, not born. Mostly made of bruises.']
        },
        {
          id: 'lawspeaker',
          name: 'Gudrun Lawspeaker',
          short: 'Gudrun',
          tag: 'Lawspeaker',
          role: 'official',
          gender: 'female',
          x: 750,
          y: 208,
          action: 'talk',
          lines: [
            'I hold the law of the mark in my head, every word. The jarl listens when I speak it.',
            'Hrothgard was a clan camp on this hill before it was a town. The hill remembers.'
          ]
        },
        {
          id: 'guard',
          name: 'Gate Warden',
          tag: 'Gate',
          role: 'guard',
          x: 90,
          y: 310,
          action: 'leave',
          lines: ['Keep to the road down. The drifts eat strangers.']
        }
      ]
    },

    // A southern harbour: the land gate on the east road, a brick square, the quay along the water and
    // two jetties out into the sea.
    vessara: {
      id: 'vessara',
      settlement: 'vessara',
      name: 'Vessara',
      ground: {
        base: '#8f9a5a',
        road: '#c0a678',
        patches: [{ x: 480, y: 420, rx: 540, ry: 34, color: '#d8c48a' }],
        waters: [{ x: 0, y: 428, w: 960, h: 112 }],
        roads: [{ x: 445, y: 90, w: 70, h: 194 }, { x: 540, y: 220, w: 396, h: 52 }],
        plaza: { x: 480, y: 300, rx: 110, ry: 55, color: '#c2a67a' },
        stone: { x: 24, y: 368, w: 912, h: 60, color: '#b9a98a' }
      },
      decor: [['planks', 300, 424, 86, 61], ['planks', 620, 424, 86, 61], ['leaves', 280, 300, 36, 28], ['ferns', 650, 300, 40, 31]],
      obstacles: [
        unseen(0, 430, 960, 110),
        building('tavern', 60, 100, 200, 110, 'The Lantern', SOUTH),
        building('house', 700, 100, 220, 110, 'Salt Guild', SOUTH, { base: true, form: 'hip', tower: 'left', windows: 3, sign: { kind: 'guild', at: 'right' } }),
        building('barracks', 60, 250, 190, 100, 'Company House', { wall: '#d6a96a', roof: '#8a3a22', door: '#3a2614' }),
        building('house', 730, 284, 170, 76, 'Harbour Office', SOUTH),
        building('house', 280, 30, 100, 60, null, SOUTH),
        building('house', 540, 120, 130, 85, null, SOUTH),
        stall(560, 300, 'Fish'),
        tree(340, 330)
      ],
      spawn: { x: 860, y: 246 },
      spots: [{ x: 472, y: 248 }, { x: 328, y: 240 }, { x: 504, y: 112 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 890, y: 220, w: 25, h: 52 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Rosa of the Lantern',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 160,
          y: 235,
          action: 'tavern',
          lines: [
            'The lamp in my window brings the boats home. And their thirsty crews.',
            'Wine from the hills, fish from the bay. Sit where you can see the sea.',
            'The League pays its captains well, and they spend it here.'
          ]
        },
        {
          id: 'merchant',
          name: 'Tommaso Remari',
          tag: 'Merchant',
          role: 'merchant',
          x: 615,
          y: 385,
          pace: [500, 385],
          action: 'trade',
          lines: ['Everything that floats comes through Vessara, and pays the Guild.', 'Buy wine here. Sell it in the north. Thank me later.']
        },
        {
          id: 'recruiter',
          name: 'Captain Salvo Ferraro',
          short: 'Salvo',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 155,
          y: 374,
          pace: [270, 374],
          action: 'recruit',
          lines: ['Crossbows and pikes for hire, and men who know both. Contracts by the season.', 'The League pays in silver. My company fights in good order.']
        },
        {
          id: 'harbourmaster',
          name: 'Vanna Pescara',
          short: 'Vanna',
          tag: 'Harbourmaster',
          role: 'official',
          gender: 'female',
          x: 815,
          y: 378,
          pace: [710, 378],
          action: 'talk',
          lines: [
            'Every hull in this harbour is written in my book, and every tax it owes.',
            'Vessara was built on the sea, not on land. The League never forgets it.'
          ]
        },
        {
          id: 'guard',
          name: 'Gate Guard',
          tag: 'Gate',
          role: 'guard',
          x: 700,
          y: 264,
          action: 'leave',
          lines: ['The land gate. Safe travels, and pay your tolls.']
        }
      ]
    },

    // A river city: the road from the west crosses the bridge into a market square of stalls under
    // the guildhall. Neither crown rules here.
    merrow: {
      id: 'merrow',
      settlement: 'merrow',
      name: 'Merrow',
      ground: {
        base: '#6f8a52',
        road: '#9c8460',
        waters: [{ x: 440, y: 0, w: 100, h: 540 }],
        roads: [{ x: 24, y: 250, w: 420, h: 60 }, { x: 420, y: 250, w: 140, h: 60 }],
        plaza: { x: 720, y: 300, rx: 150, ry: 90, color: '#a39c88' }
      },
      // The bridge: planks over the road where it crosses the river.
      decor: [['planks', 424, 248, 70, 64], ['planks', 486, 248, 70, 64], ['ferns', 150, 360, 40, 31], ['leaves', 600, 200, 36, 28], ['ferns', 300, 190, 40, 31]],
      obstacles: [
        unseen(450, 0, 80, 248),
        unseen(450, 312, 80, 228),
        building('tavern', 250, 330, 180, 110, 'The Ferry House', RIVER),
        building('barracks', 60, 60, 170, 110, 'Free Company', RIVER),
        stall(590, 150, 'Wool'),
        stall(700, 150, 'Salt'),
        building('house', 790, 40, 140, 90, 'Guildhall', { wall: '#b3aa98', roof: '#5d4a6a', door: '#3a2614' }, { base: true, form: 'end', tower: 'left', sign: { kind: 'guild', at: 'right' } }),
        { shape: 'circle', x: 720, y: 320, r: 22, look: 'well' },
        building('house', 580, 420, 130, 90, null, RIVER),
        building('house', 760, 420, 150, 90, null, RIVER),
        tree(395, 130),
        tree(110, 430)
      ],
      spawn: { x: 90, y: 280 },
      exitZone: { x: 47, y: 250, w: 20, h: 60 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Bet Ferryman',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 340,
          y: 465,
          action: 'tavern',
          lines: [
            'My grandfather ran the ferry before the bridge. Now I run the beer.',
            'Valedorn men, Aurelian men, Vessaro men. In Merrow they all pay the same.',
            'Rooms by the river. You will sleep to the sound of it.'
          ]
        },
        {
          id: 'merchant',
          name: 'Kit Saltback',
          tag: 'Merchant',
          role: 'merchant',
          x: 650,
          y: 230,
          pace: [790, 230],
          action: 'trade',
          lines: ['Three roads and a river meet here. So does every bargain in the March.', 'No crown takes a cut in Merrow. Only the guild, and the guild is us.']
        },
        {
          id: 'recruiter',
          name: 'Rook Two-Knives',
          short: 'Rook',
          tag: 'Sellsword',
          role: 'recruiter',
          x: 145,
          y: 200,
          pace: [280, 200],
          action: 'recruit',
          lines: ['The Free Company fights for whoever pays. Today that could be you.', 'Hire by the season. We stay as long as your silver does.']
        },
        {
          id: 'reeve',
          name: 'Reeve Corrie',
          short: 'Corrie',
          tag: 'Reeve',
          role: 'official',
          gender: 'female',
          x: 860,
          y: 165,
          action: 'talk',
          lines: [
            'The council keeps Merrow free. The walls and the bridge toll help.',
            'Kings come to us for loans and leave with debts. That is our crown.'
          ]
        },
        {
          id: 'guard',
          name: 'Bridge Watch',
          tag: 'Gate',
          role: 'guard',
          x: 90,
          y: 232,
          action: 'leave',
          lines: ['West road. The bridge toll is paid on the way in, not out.']
        }
      ]
    },

    // A free port on the eastern sea: the road runs straight to the shore past the inn, the
    // warehouses and the marines' hall. The portwarden works out on the jetty.
    gullhaven: {
      id: 'gullhaven',
      settlement: 'gullhaven',
      name: 'Gullhaven',
      ground: {
        base: '#7f8d5e',
        road: '#a8916a',
        patches: [{ x: 690, y: 270, rx: 60, ry: 300, color: '#d6c28a' }],
        waters: [{ x: 700, y: 0, w: 260, h: 540 }],
        roads: [{ x: 24, y: 240, w: 690, h: 60 }]
      },
      decor: [
        ['planks', 700, 128, 86, 61], ['planks', 786, 128, 86, 61],
        ['planks', 700, 298, 86, 61], ['planks', 786, 298, 86, 61],
        ['ferns', 180, 380, 40, 31]
      ],
      obstacles: [
        unseen(712, 0, 248, 130),
        unseen(712, 186, 248, 114),
        unseen(712, 356, 248, 184),
        unseen(870, 130, 90, 56),
        unseen(870, 300, 90, 56),
        building('tavern', 80, 60, 220, 120, 'The Gull and Anchor', PORT),
        building('barracks', 280, 370, 190, 110, "Marines' Hall", PORT),
        stall(340, 140, 'Spices'),
        building('barracks', 500, 40, 180, 110, 'Warehouse', { wall: '#9a8466', roof: '#4b5a5e', door: '#2e2a22' }, { wall: 'timber', beams: true, door: 'wide', sign: null, shields: false, banner: false, windows: 1 }),
        building('barracks', 520, 370, 160, 100, 'Chandlery', PORT, { form: 'gable', sign: { kind: 'guild', at: 'left' }, shields: false, banner: false, awning: '#3f5f6f' }),
        building('crate', 640, 195, 34, 30),
        building('crate', 640, 330, 32, 28),
        tree(130, 430)
      ],
      spawn: { x: 90, y: 270 },
      exitZone: { x: 47, y: 240, w: 20, h: 60 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Wenna of the Anchor',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 190,
          y: 205,
          action: 'tavern',
          lines: [
            'Sailors, wreckers and kings’ men all drink here. I serve the ones who pay.',
            'Fish stew and a dry bed. The gulls are free.',
            'Ships come in from the whole coast. So do the rumours.'
          ]
        },
        {
          id: 'merchant',
          name: 'Hob Mudlark',
          tag: 'Merchant',
          role: 'merchant',
          x: 395,
          y: 215,
          pace: [520, 215],
          action: 'trade',
          lines: ['Salt from the flats, wool from the cliffs, spice from who knows where.', 'A free port means no crown’s tax. Only mine.']
        },
        {
          id: 'recruiter',
          name: 'Jory Crowfoot',
          short: 'Jory',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 375,
          y: 340,
          pace: [220, 340],
          action: 'recruit',
          lines: ['Marines fight on a deck or a beach. A road is easy after that.', 'Gullhaven pays its watch well. Hire a few and see why.']
        },
        {
          id: 'portwarden',
          name: 'Portwarden Ysolt',
          short: 'Ysolt',
          tag: 'Portwarden',
          role: 'official',
          gender: 'female',
          x: 800,
          y: 158,
          pace: [740, 158],
          action: 'talk',
          lines: [
            'Ostrand and Saltreach both want this harbour. Neither will have it while I keep the jetty.',
            'Every ship pays at my jetty. That is how a free port stays free.'
          ]
        },
        {
          id: 'old_netter',
          name: 'Old Abe',
          short: 'Abe',
          tag: 'Elder',
          role: 'elder',
          x: 790,
          y: 328,
          action: 'talk',
          lines: [
            'Sixty years I have mended nets on this jetty. Gullhaven was a fishing hamlet then.',
            'Watch for false lights on the cliffs. The wreckers still lure ships onto the rocks.'
          ]
        },
        {
          id: 'guard',
          name: 'Watchman',
          tag: 'Gate',
          role: 'guard',
          x: 90,
          y: 222,
          action: 'leave',
          lines: ['The road west, then. Mind the moors.']
        }
      ]
    },

    // A walled town on a sea cliff: the wall's gate at the bottom, the steward's keep under the
    // cliff, a cobbled market square inside. Grey stone and slate against the wind.
    harrowgate: {
      id: 'harrowgate',
      settlement: 'harrowgate',
      name: 'Harrowgate',
      ground: {
        base: '#6f7f62',
        road: '#8f8676',
        waters: [{ x: 0, y: 0, w: 960, h: 104 }],
        roads: [{ x: 424, y: 250, w: 70, h: 240 }, { x: 110, y: 250, w: 630, h: 46 }],
        stone: { x: 300, y: 310, w: 380, h: 140, color: '#8d8a80' }
      },
      decor: row('turf', 0, 960, 90, 58, 36).concat([['fence', 240, 440, 52, 37], ['fence', 900, 440, 52, 37]]),
      obstacles: [
        unseen(0, 0, 960, 118),
        building('wall', 24, 470, 400, 24),
        building('wall', 494, 470, 442, 24),
        building('barracks', 380, 132, 220, 92, "Steward's Keep", CLIFF, { wall: 'stone', form: 'hip', tower: 'left', sign: null, shields: true, banner: true }),
        building('tavern', 60, 320, 200, 100, 'The Salt Kettle', CLIFF),
        building('barracks', 760, 300, 160, 110, 'Shield Hall', { wall: '#8a8478', roof: '#2e3640', door: '#22201c' }),
        stall(310, 330, 'Fish'),
        stall(540, 330, 'Salt'),
        building('house', 90, 134, 110, 76, null, CLIFF),
        building('house', 750, 134, 150, 80, null, CLIFF)
      ],
      spawn: { x: 459, y: 440 },
      spots: [{ x: 352, y: 272 }, { x: 488, y: 360 }, { x: 600, y: 288 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 430, y: 474, w: 58, h: 22 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Thora Salter',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 230,
          y: 445,
          action: 'tavern',
          lines: [
            'Shut the door, the wind comes off the sea like a blade. Soup is hot.',
            'The king’s men say Saltreach will pay for the last raid. They always say that.',
            'You can hear the waves from every bed. Some guests even sleep.'
          ]
        },
        {
          id: 'merchant',
          name: 'Vidar Cooper',
          tag: 'Merchant',
          role: 'merchant',
          x: 380,
          y: 410,
          pace: [600, 410],
          action: 'trade',
          lines: ['Salt fish in barrels, my own barrels. They keep a whole winter.', 'The war makes iron dear and fish cheap. Buy what the soldiers do not.']
        },
        {
          id: 'recruiter',
          name: 'Ulf Ironhand',
          short: 'Ulf',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 715,
          y: 350,
          pace: [715, 262],
          action: 'recruit',
          lines: ['The king needs shields on the wall and in the field. Stand with Ostrand.', 'Cliff folk hold. That is all a shieldman has to do.']
        },
        {
          id: 'steward',
          name: 'Steward Liv',
          short: 'Liv',
          tag: 'Steward',
          role: 'official',
          gender: 'female',
          x: 490,
          y: 244,
          action: 'talk',
          lines: [
            'I keep the king’s keep, his ledgers and his patience. The last is thinnest.',
            'Harrowgate has never fallen from the sea side. The cliff sees to that.'
          ]
        },
        {
          id: 'guard',
          name: 'Gate Warden',
          tag: 'Gate',
          role: 'guard',
          x: 395,
          y: 440,
          action: 'leave',
          lines: ['Through the gate and down the hill. The road to Brindle is clear.']
        }
      ]
    },

    // The salt market: one long street of stalls between the salt exchange and the pike yard, with
    // white salt pans drying beyond. You come in from the east road.
    calder: {
      id: 'calder',
      settlement: 'calder',
      name: 'Calder',
      ground: {
        base: '#a3a27a',
        road: '#c9b892',
        patches: [
          { x: 740, y: 430, rx: 150, ry: 55, color: '#ebe8dc' },
          { x: 500, y: 465, rx: 90, ry: 35, color: '#e2ddca' },
          { x: 560, y: 110, rx: 60, ry: 30, color: '#e2ddca' }
        ],
        roads: [{ x: 24, y: 245, w: 912, h: 60 }]
      },
      decor: [['leaves', 300, 420, 36, 28], ['ferns', 620, 410, 40, 31]],
      obstacles: [
        building('house', 60, 50, 200, 120, 'Salt Exchange', SALT, { base: true, form: 'hip', tower: 'right', windows: 4, door: 'center', sign: { kind: 'guild', at: 'left' } }),
        building('tavern', 620, 60, 220, 110, 'The Salt Cellar', SALT),
        building('house', 300, 60, 120, 85, null, SALT),
        building('house', 440, 60, 120, 85, null, SALT),
        stall(300, 175, 'Salt'),
        stall(420, 175, 'Cloth'),
        stall(540, 175, 'Wine'),
        stall(360, 325, 'Fish'),
        stall(480, 325, 'Grain'),
        building('barracks', 60, 370, 200, 110, 'Pike Yard', { wall: '#ddd3b8', roof: '#4f6a7a', door: '#3a2a1a' }),
        { shape: 'circle', x: 780, y: 420, r: 22, look: 'well' },
        tree(560, 470),
        tree(900, 380)
      ],
      spawn: { x: 860, y: 275 },
      spots: [{ x: 480, y: 416 }, { x: 512, y: 304 }, { x: 352, y: 480 }], // P10-04: where the story's envoys and Mara stand, when they are here
      exitZone: { x: 890, y: 245, w: 25, h: 60 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Serena of the Cellar',
          tag: 'Innkeeper',
          role: 'innkeeper',
          gender: 'female',
          x: 730,
          y: 198,
          action: 'tavern',
          lines: [
            'Everything here tastes of salt, even the wine. You get used to it.',
            'The panners drink at dusk. Sit near the door if you dislike singing.',
            'The League sends its pikemen through every month. They empty my cellar.'
          ]
        },
        {
          id: 'merchant',
          name: 'Cosimo Mercante',
          tag: 'Merchant',
          role: 'merchant',
          x: 420,
          y: 275,
          pace: [600, 275],
          action: 'trade',
          lines: ['White gold, they call it. Calder salt seasons half the realm.', 'Buy salt here, carry it north, and come back rich. Or come back.']
        },
        {
          id: 'recruiter',
          name: 'Emilio il Rosso',
          short: 'Emilio',
          tag: 'Recruiter',
          role: 'recruiter',
          x: 160,
          y: 345,
          pace: [300, 345],
          action: 'recruit',
          lines: ['Pikes and crossbows, the League way. Long poles keep riders honest.', 'Salt pays the soldiers here. Plenty of salt, plenty of soldiers.']
        },
        {
          id: 'factor',
          name: 'Factor Donata',
          short: 'Donata',
          tag: 'Factor',
          role: 'official',
          gender: 'female',
          x: 160,
          y: 200,
          action: 'talk',
          lines: [
            'I weigh every cart of salt that leaves Calder. The League lives on my scales.',
            'Ostrand raids the pans in a bad year. This is becoming a bad year.'
          ]
        },
        {
          id: 'elder',
          name: 'Old Benedetto',
          short: 'Benedetto',
          tag: 'Elder',
          role: 'elder',
          x: 700,
          y: 368,
          action: 'talk',
          lines: ['I raked these pans as a boy, and my father before me. The sea gives salt to the patient.']
        },
        {
          id: 'guard',
          name: 'Gate Guard',
          tag: 'Gate',
          role: 'guard',
          x: 860,
          y: 228,
          action: 'leave',
          lines: ['East road. The pans end where the moor begins.']
        }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
