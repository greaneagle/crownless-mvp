/* Crownless content: town_hubs. Plain classic script; no modules, no fetch.
 * GDD §8: Stonebridge is the one explorable town — market stall, tavern, recruiter and exit.
 * NPCs stand in place or pace a short loop; talking opens their menu. Other settlements stay
 * menu-driven. The scene uses the battle-map format (ground, decor, obstacles) on the same
 * 960×540 canvas, so the same collision and drawing code applies.
 *   npcs[].frames: unit sprite frames (u####) for their idle/walk cycle
 *   npcs[].pace:   optional [x, y] the NPC walks to and back from
 *   npcs[].action: 'trade' | 'recruit' | 'tavern' | 'talk' | 'leave'
 *   npcs[].lines:  what they say (one is picked each time you talk)
 *   npcs[].tag:    short title shown under their feet
 *   npcs[].visible: optional story condition for appearing at all (js/story.js vocabulary)
 *   entry: 'menu' (default) or 'streets': what arriving opens. Menu first, with "Walk the streets"
 *          one tap away (owner playtest finding F-3); people with conversations are also listed there. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  var tree = function (x, y) {
    return { shape: 'circle', x: x, y: y, r: 20, blocksArrows: true, look: { tile: 'w0132', w: 92, h: 97 } };
  };
  C.town_hubs = {
    stonebridge: {
      id: 'stonebridge',
      settlement: 'stonebridge',
      name: 'Stonebridge',
      entry: 'menu',
      ground: {
        base: '#6f8f4e',
        tiles: ['w0000', 'w0001', 'w0002'],
        roads: [
          { x: 30, y: 270, w: 470, h: 56 },
          { x: 440, y: 120, w: 70, h: 330 },
          { x: 440, y: 230, w: 330, h: 60 }
        ],
        plaza: { x: 475, y: 290, rx: 120, ry: 70 }
      },
      decor: [['w0147', 560, 360, 40, 31], ['w0167', 380, 210, 36, 28], ['w0147', 300, 330, 40, 31], ['w0167', 640, 180, 36, 28]],
      obstacles: [
        { shape: 'rect', x: 110, y: 80, w: 220, h: 120, look: 'tavern', label: 'The Grey Ford Inn' },
        { shape: 'rect', x: 520, y: 100, w: 110, h: 60, look: 'stall', label: 'Market' },
        { shape: 'rect', x: 690, y: 80, w: 200, h: 120, look: 'barracks', label: 'Muster Hall' },
        { shape: 'rect', x: 680, y: 350, w: 190, h: 110, look: 'house', label: "Elder's House" },
        { shape: 'rect', x: 130, y: 370, w: 150, h: 95, look: 'house' },
        { shape: 'circle', x: 470, y: 330, r: 22, look: 'well' },
        tree(60, 120), tree(370, 470), tree(900, 300), tree(620, 470)
      ],
      spawn: { x: 90, y: 298 },
      exitZone: { x: 47, y: 262, w: 20, h: 72 },
      npcs: [
        {
          id: 'innkeeper',
          name: 'Hilde the Innkeeper',
          tag: 'Innkeeper',
          frames: [64, 65, 66, 67],
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
          frames: [96, 97, 98, 99],
          x: 575,
          y: 190,
          pace: [640, 190],
          action: 'trade',
          lines: ['Grain from Oakford, salt from the coast — buy cheap, sell dear.', 'Prices rise when the caravans stop coming. Mark my words.']
        },
        {
          id: 'sergeant',
          name: 'Sergeant Brun',
          tag: 'Recruiter',
          frames: [76, 77, 78, 79],
          x: 760,
          y: 238,
          pace: [850, 238],
          action: 'recruit',
          dialogue: 'sergeant_brun',
          lines: ['Strong backs and steady hands wanted. Coin up front.', 'A levy with a full belly fights twice as hard.']
        },
        {
          id: 'elder',
          name: 'Elder Maren',
          tag: 'Elder',
          frames: [288, 289, 290, 291],
          x: 775,
          y: 318,
          action: 'talk',
          dialogue: 'stonebridge_elder',
          lines: ['Stonebridge has stood at this ford since before the empire. It will stand after.']
        },
        {
          id: 'captain',
          name: 'Captain Aldric',
          tag: 'Captain',
          frames: [72, 73, 74, 75],
          x: 330,
          y: 300,
          pace: [400, 300],
          action: 'talk',
          dialogue: 'valedorn_agent',
          lines: ['Keep the roads clear and the Crown keeps your purse full.']
        },
        {
          id: 'mara',
          name: 'Mara',
          tag: 'Scout',
          frames: [124, 125, 126, 127],
          x: 300,
          y: 238,
          action: 'talk',
          dialogue: 'mara',
          // She turns up after Q2, until she joins (or is gone for good).
          visible: [{ quest: 'q2', is: 'done' }, { not: { companion: 'mara' } }, { not: { flag: 'mara_gone' } }, { not: { flag: 'mara_scouting' } }],
          lines: ['I have walked every road between the forts.']
        },
        {
          id: 'guard',
          name: 'Gate Guard',
          tag: 'Gate',
          frames: [80, 81, 82, 83],
          x: 70,
          y: 250,
          action: 'leave',
          lines: ['Mind the road out there.']
        }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
