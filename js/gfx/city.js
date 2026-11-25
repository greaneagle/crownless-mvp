/* Crownless graphics demonstration (experimental, debug only): Stonebridge, a walkable city.
 *
 * A new layout of the demo's own (the real Stonebridge in data/town_hubs.js is untouched): a south gate,
 * a main street up to a cobbled square with a well and market stalls, the guildhall and its bell tower,
 * the tavern, the smithy, the barracks, houses, gardens, trees and walls. People stand at their work or
 * walk loops; the smith hammers, chimneys smoke, banners move, and at night windows and lamps glow.
 *
 * Walking uses the game's own collision (CL.units.resolveObstacles) on the sandbox CL.game.battleMap,
 * in the battle-map format (rectangles and circles). Everything else is the demo's. Buildings are drawn
 * at 1.7× the gallery scale so doors suit the figures. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const G = CL.gfx;
  const { PAL, STYLE, ellipse, fill, tone } = G;
  G.scenes = G.scenes || {};

  const CW = 1920;
  const CH = 1220;
  const BS = 1.7; // building scale
  const SPEED = 150;
  const TALK_REACH = 52;

  /** The buildings: the gallery's vocabulary, placed. x, y: the front wall's foot (street side). */
  const BUILDINGS = [
    { id: 'guildhall', name: 'Guildhall', x: 930, y: 450, w: 150, h: 44, d: 54, wall: 'plaster', base: true, roof: 'terracotta', form: 'hip', beams: true, windows: 4, sign: { kind: 'guild', at: 'left' }, chimney: -0.6 },
    { id: 'tavern', name: 'The Gilded Ford (tavern)', x: 1330, y: 690, w: 104, h: 40, d: 44, wall: 'plaster', base: true, roof: 'terracotta', form: 'gable', beams: true, sign: { kind: 'tavern', at: 'left' }, awning: '#a54f3a', chimney: 0.7, door: 'left', windows: 3 },
    { id: 'smithy', name: 'Smithy', x: 600, y: 700, w: 82, h: 30, d: 38, wall: 'stone', roof: 'slate', form: 'hip', door: 'wide', sign: { kind: 'smith', at: 'right' }, chimney: -0.5, windows: 1 },
    { id: 'barracks', name: 'Barracks (recruiter)', x: 520, y: 440, w: 118, h: 32, d: 40, wall: 'stone', roof: 'slate', form: 'long', sign: { kind: 'barracks', at: 'right' }, windows: 3 },
    { id: 'manor', name: 'Merchant house', x: 1520, y: 450, w: 92, h: 46, d: 42, wall: 'plaster', base: true, roof: 'slate', form: 'end', beams: true, chimney: 0.4, windows: 2 },
    { id: 'h1', x: 1260, y: 420, w: 64, h: 32, d: 36, wall: 'plaster', roof: 'terracotta', form: 'end', beams: true, chimney: 0.5, windows: 2 },
    { id: 'h2', x: 1700, y: 760, w: 70, h: 30, d: 38, wall: 'whitewash', roof: 'thatch', form: 'gable', windows: 2 },
    { id: 'h3', x: 1560, y: 930, w: 66, h: 34, d: 36, wall: 'plaster', roof: 'terracotta', form: 'end', beams: true, windows: 1, chimney: -0.4 },
    { id: 'h4', x: 300, y: 690, w: 72, h: 30, d: 38, wall: 'plaster', roof: 'thatch', form: 'gable', beams: true, windows: 2, chimney: 0.6 },
    { id: 'h5', x: 330, y: 960, w: 64, h: 32, d: 36, wall: 'whitewash', roof: 'terracotta', form: 'end', windows: 1 },
    { id: 'h6', x: 690, y: 1000, w: 70, h: 34, d: 38, wall: 'plaster', base: true, roof: 'slate', form: 'gable', beams: true, windows: 2, chimney: 0.6 },
    { id: 'h7', x: 1230, y: 1000, w: 68, h: 32, d: 36, wall: 'plaster', roof: 'terracotta', form: 'end', beams: true, windows: 1 },
    { id: 'h8', x: 1820, y: 520, w: 56, h: 28, d: 34, wall: 'whitewash', roof: 'thatch', form: 'end', windows: 1 },
    { id: 'stable', name: 'Stable', x: 300, y: 430, w: 74, h: 26, d: 40, wall: 'timber', roof: 'thatch', form: 'end', door: 'wide', windows: 0 },
  ];
  const TOWER = { x: 1112, y: 452, h: 112, r: 20 };
  const SQUARE = { x: 960, y: 640, rx: 235, ry: 132 };
  const GATE = { x: 960, y: 1170, w: 110 };

  const STREETS = [
    [[960, 1220], [960, 1100], [960, 780]],
    [[330, 760], [600, 740], [700, 690]],
    [[1220, 690], [1450, 760], [1700, 800], [1860, 800]],
    [[520, 460], [600, 560], [740, 600]],
    [[1300, 440], [1220, 520], [1150, 560]],
    [[1520, 470], [1420, 560], [1260, 600]],
    [[690, 1010], [800, 1000], [960, 980], [1120, 1010], [1230, 1010]],
    [[330, 980], [500, 1010], [690, 1010]],
    [[1230, 1010], [1560, 950]],
  ];

  /** Props (drawn and solid where they should be). */
  const PROPS = [
    ['well', 960, 650],
    ['stall', 780, 590, '#3b6ea5'],
    ['stall', 820, 720, '#a54f3a', ['#e8d58a', '#9c6b3a', '#d9d2c4']],
    ['stall', 1110, 735, '#6b8a4a', ['#b84d3a', '#e6a24a', '#7fa055']],
    ['forge', 500, 740],
    ['anvil', 560, 760],
    ['rack', 610, 470],
    ['dummy', 660, 510],
    ['barrel', 1225, 715], ['barrel', 1243, 722], ['barrel', 1420, 715],
    ['crate', 1450, 722], ['crate', 870, 760], ['crate', 1155, 760],
    ['bench', 1290, 730],
    ['lamp', 760, 680], ['lamp', 1160, 680], ['lamp', 920, 1060], ['lamp', 1000, 1060], ['lamp', 1250, 470],
    ['cart', 1640, 830],
    ['hay', 360, 470], ['hay', 382, 488],
    ['tree', 1150, 560, 'broad', 3], ['tree', 760, 520, 'broad', 6], ['tree', 220, 560, 'broad', 2], ['tree', 1720, 600, 'birch', 5],
    ['tree', 1800, 1000, 'broad', 8], ['tree', 140, 830, 'pine', 4], ['tree', 450, 1100, 'broad', 9], ['tree', 1400, 1110, 'broad', 1],
    ['tree', 1740, 300, 'pine', 7], ['tree', 180, 300, 'broad', 12], ['tree', 1880, 1090, 'pine', 2],
    ['bush', 1600, 470], ['bush', 1440, 480], ['bush', 420, 720, '#b0453a'], ['bush', 1780, 820], ['bush', 260, 1000], ['bush', 1090, 1030, '#c9c2e8'], ['bush', 820, 1050],
    ['fence', 230, 1030, 420, 1030], ['fence', 240, 770, 240, 900], ['fence', 1620, 990, 1780, 990], ['fence', 1500, 530, 1640, 530],
    ['garden', 360, 860], ['garden', 1650, 1060],
    ['banner', 860, 470, 'valedorn'], ['banner', 1000, 470, 'valedorn'], ['banner', 900, 1150, 'valedorn'], ['banner', 1020, 1150, 'valedorn'],
    ['flowers', 1040, 470], ['flowers', 1400, 700],
  ];

  /** Who lives here: role, name, what they say, and where they stand or walk. */
  const PEOPLE = [
    { id: 'merchant', role: 'merchant', name: 'Wenna', title: 'cloth merchant', x: 790, y: 625, face: 'down', lines: ['Wool from Oakford, salt from Saltwick, and dye all the way from the coast.', 'Blue sells best this year. Everyone wants to look loyal to the Crown.'], ask: ['What sells?', 'Grain is cheap after the harvest, iron dear since the passes closed. (Demonstration: no trade happens here.)'] },
    { id: 'smith', role: 'smith', name: 'Garrick', title: 'blacksmith', x: 540, y: 735, face: 'right', work: true, lines: ['Mind the sparks.', 'Every footman in the march carries one of my blades, or wishes he did.'], ask: ['Can you mend my blade?', 'Leave it by the anvil. Tomorrow, if the coal holds out. (Demonstration: nothing is mended.)'] },
    { id: 'innkeeper', role: 'innkeeper', name: 'Matilde', title: 'innkeeper', x: 1290, y: 712, face: 'down', lines: ['Welcome to the Gilded Ford. Ale, stew, and a dry bed.', 'The Hrothmark raiders were seen at Hartford ford. Travel the bridge road.'], ask: ['Any news?', 'A lord rode in from Greywall this morning, Ardane by his banner. There’s talk of the passes.'] },
    { id: 'recruiter', role: 'recruiter', name: 'Sergeant Rowe', title: 'recruiter', x: 590, y: 495, face: 'down', lines: ['Strong arms wanted for the Crown. Spears found, boots not.', 'Hunters and levies, mostly. The good ones come back footmen.'], ask: ['Who can I hire?', 'Levies, hunters, and two Aurelian spearmen who need the coin. (Demonstration: nobody joins.)'] },
    { id: 'elder', role: 'elder', name: 'Reeve Haldane', title: 'reeve of Stonebridge', x: 930, y: 488, face: 'down', lines: ['The bridge tolls keep this city fed. Keep the road safe and you’ll always be welcome.'], ask: ['What needs doing?', 'Reavers in the western woods. Bring me their banner and the guild will pay. (Demonstration: no quest starts.)'] },
    { id: 'guard1', role: 'guard', name: 'Aldo', title: 'gate guard', x: 900, y: 1125, face: 'down', lines: ['Gate closes at dusk.', 'Keep your blade sheathed inside the walls.'] },
    { id: 'guard2', role: 'guard', name: 'Isolde', title: 'gate guard', x: 1022, y: 1125, face: 'down', female: true, lines: ['Papers? Never mind. You look honest enough.'] },
    { id: 'guard3', role: 'guard', name: 'Piers', title: 'watchman', x: 1180, y: 560, face: 'left', pace: [[1180, 560], [1180, 640]], lines: ['All quiet on the square.'] },
    { id: 'monk', role: 'monk', name: 'Brother Anselm', title: 'traveller', x: 1450, y: 760, face: 'left', lines: ['I walk to the coast. The gulls are better company than the lords.'] },
    { id: 'noble', role: 'noble', name: 'Lady Mirel', title: 'merchant’s widow', x: 1490, y: 490, face: 'down', lines: ['My late husband built this house with salt money. The roof is slate; the gossip is free.'] },
    // Walkers: no business, just the city going about its day.
    { id: 'w1', role: 'townswoman', name: 'Townswoman', x: 860, y: 600, loop: [[860, 600], [1060, 600], [1100, 700], [880, 760]], speed: 40, lines: ['Fresh bread at the guildhall corner, if you’re quick.'] },
    { id: 'w2', role: 'townsman', name: 'Townsman', x: 960, y: 900, loop: [[960, 900], [960, 760], [1200, 690], [960, 760]], speed: 46, lines: ['Busy day. The bridge toll went up again.'] },
    { id: 'w3', role: 'farmer', name: 'Farmer', x: 700, y: 990, loop: [[700, 1040], [1200, 1040], [1500, 970], [1200, 1040]], speed: 34, lines: ['Market day tomorrow. My cart’s already full.'] },
    { id: 'w4', role: 'townsman', name: 'Porter', x: 1450, y: 790, loop: [[1450, 790], [1700, 810], [1450, 790], [1240, 700]], speed: 42, lines: ['Barrels for the tavern. Out of the way!'] },
    { id: 'child', role: 'child', name: 'Child', x: 1010, y: 660, circle: { x: 960, y: 660, r: 62 }, speed: 70, lines: ['Can I see your sword? Please?'] },
    { id: 'w5', role: 'townswoman', name: 'Washerwoman', x: 360, y: 760, loop: [[360, 760], [600, 760], [700, 690], [600, 760]], speed: 36, lines: ['The river’s cold this morning.'] },
  ];

  const CHICKENS = [[400, 880], [420, 900], [380, 905]];

  // ---- Building the city (once) ----

  function obstacles() {
    const o = [];
    for (const b of BUILDINGS) {
      const w = b.w * BS;
      const depth = (b.d * 0.55 + b.h * 0.35) * BS;
      o.push({ shape: 'rect', x: b.x - w / 2, y: b.y - depth, w, h: depth - 4, blocksArrows: true, id: b.id });
    }
    o.push({ shape: 'circle', x: TOWER.x, y: TOWER.y - 6, r: TOWER.r * BS * 0.75, blocksArrows: true });
    for (const p of PROPS) {
      const [kind, x, y] = p;
      if (kind === 'well') o.push({ shape: 'circle', x, y: y - 8, r: 28 });
      else if (kind === 'stall') o.push({ shape: 'rect', x: x - 38, y: y - 16, w: 76, h: 16 });
      else if (kind === 'tree') o.push({ shape: 'circle', x, y: y - 4, r: 13 });
      else if (kind === 'forge') o.push({ shape: 'rect', x: x - 24, y: y - 18, w: 48, h: 18 });
      else if (kind === 'barrel' || kind === 'crate' || kind === 'anvil' || kind === 'lamp' || kind === 'dummy') o.push({ shape: 'circle', x, y: y - 4, r: kind === 'lamp' ? 5 : 10 });
      else if (kind === 'cart') o.push({ shape: 'rect', x: x - 34, y: y - 16, w: 68, h: 16 });
      else if (kind === 'rack') o.push({ shape: 'rect', x: x - 22, y: y - 8, w: 44, h: 8 });
      else if (kind === 'fence') {
        const [, x1, y1, x2, y2] = p;
        o.push({ shape: 'rect', x: Math.min(x1, x2) - 3, y: Math.min(y1, y2) - 6, w: Math.abs(x2 - x1) + 6, h: Math.abs(y2 - y1) + 6 });
      }
    }
    // The walls: north, south (with the gate), west and east.
    o.push({ shape: 'rect', x: 0, y: 0, w: CW, h: 170 });
    o.push({ shape: 'rect', x: 0, y: GATE.y - 20, w: GATE.x - GATE.w / 2, h: 80 });
    o.push({ shape: 'rect', x: GATE.x + GATE.w / 2, y: GATE.y - 20, w: CW - GATE.x - GATE.w / 2, h: 80 });
    o.push({ shape: 'rect', x: 0, y: 0, w: 70, h: CH });
    o.push({ shape: 'rect', x: CW - 70, y: 0, w: 70, h: CH });
    return o;
  }

  function init(S) {
    const r = G.rng(1189);
    const cobbles = [];
    for (let i = 0; i < 240; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      cobbles.push([SQUARE.x + Math.cos(a) * d * SQUARE.rx * 0.95, SQUARE.y + Math.sin(a) * d * SQUARE.ry * 0.95, 2 + r() * 2.5]);
    }
    const tufts = [];
    for (let i = 0; i < 160; i++) tufts.push([90 + r() * (CW - 180), 190 + r() * (CH - 300), r() < 0.2 ? ['#f2e2a0', '#e9a6a0', '#c9c2e8'][Math.floor(r() * 3)] : null]);
    S.cityLand = { cobbles, tufts, map: cityMap() };
    S.city = freshCity();
  }

  function cityMap() {
    return {
      id: 'gfx_city',
      name: 'Stonebridge (demo)',
      width: CW,
      height: CH,
      bounds: { minX: 80, maxX: CW - 80, minY: 180, maxY: CH - 18 },
      obstacles: obstacles(),
      spawn: { hero: { x: GATE.x, y: GATE.y - 40 }, enemies: { x0: 0, x1: 0, y0: 0, y1: 0 } },
      ground: { base: PAL.grass, tiles: ['w0000'], patches: [] },
    };
  }

  function freshCity() {
    const people = PEOPLE.map((p, i) => ({ ...p, x0: p.x, y0: p.y, walk: 0, move: 0, leg: 0, t0: i * 0.7, look: G.fig.townLook(p.role, i + 11, 'valedorn'), facing: p.face || 'down' }));
    for (const p of people) if (p.female != null) p.look = { ...p.look, female: p.female, hairStyle: 'braid' };
    return {
      hero: { x: GATE.x, y: GATE.y - 50, face: 'up', walk: 0, move: 0, target: null, talkTo: null },
      people,
      near: null,
      talking: null,
      cam: { x: GATE.x - 480, y: CH - 540, zoom: 1 },
      atGate: false,
    };
  }

  // ---- Update ----

  function enter(S, api, opts) {
    if (opts.fresh) S.city = freshCity();
    if (opts.from === 'map' || opts.fresh) Object.assign(S.city.hero, { x: GATE.x, y: GATE.y - 50, face: 'up', target: null });
    // The sandbox game's battle map is the city, so the game's own collision code walks its streets.
    CL.game.battleMap = S.cityLand.map;
    S.city.talking = null;
    api.dialog(null);
    follow(S.city, 10);
  }
  function leave(S, api) {
    api?.dialog?.(null);
    api?.prompt?.('');
    if (CL.game.battleMap === S.cityLand?.map) CL.game.battleMap = null;
  }

  function update(S, dt, api) {
    const C = S.city;
    const h = C.hero;
    const m = api.move();
    let vx = 0;
    let vy = 0;
    if (!C.talking) {
      if (m.m > 0.1) {
        h.target = null;
        h.talkTo = null;
        [vx, vy] = [m.x * m.m, m.y * m.m];
      } else if (h.target) {
        const dx = h.target.x - h.x;
        const dy = h.target.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d < 6 || (h.talkTo && near(h, h.talkTo) < TALK_REACH - 6)) {
          h.target = null;
          if (h.talkTo) talk(S, h.talkTo, api);
          h.talkTo = null;
        } else [vx, vy] = [dx / d, dy / d];
      }
    }
    if (vx || vy) {
      const bx = h.x;
      const by = h.y;
      h.x += vx * SPEED * dt;
      h.y += vy * SPEED * dt;
      CL.units.resolveObstacles(h); // the game's own collision, on the city's obstacles
      const b = S.cityLand.map.bounds;
      h.x = Math.max(b.minX, Math.min(b.maxX, h.x));
      h.y = Math.max(b.minY, Math.min(b.maxY, h.y));
      if (h.target && Math.hypot(h.x - bx, h.y - by) < SPEED * dt * 0.15) {
        // Stuck on a wall: stop, and talk if the person sought is in reach anyway.
        h.target = null;
        if (h.talkTo && near(h, h.talkTo) < TALK_REACH) talk(S, h.talkTo, api);
        h.talkTo = null;
      }
      h.face = Math.abs(vx) > Math.abs(vy) * 0.8 ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      h.move = Math.min(1, h.move + dt * 6);
      h.walk += dt * 11;
    } else h.move = Math.max(0, h.move - dt * 6);
    for (const p of C.people) person(p, S.t, dt, C);
    // Who is in reach to talk to.
    let best = null;
    let bd = TALK_REACH;
    for (const p of C.people) {
      const d = near(h, p);
      if (d < bd) [best, bd] = [p, d];
    }
    C.near = best;
    C.atGate = h.y > GATE.y - 40 && Math.abs(h.x - GATE.x) < GATE.w / 2;
    if (CL.game.attackHeld && !C.talking && C.near) {
      CL.game.attackHeld = false;
      talk(S, C.near, api);
    }
    follow(C, dt);
  }

  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function person(p, t, dt, C) {
    const talking = C.talking === p;
    if (talking) {
      // Turn to the hero while speaking.
      const h = C.hero;
      p.facing = Math.abs(h.x - p.x) > Math.abs(h.y - p.y) ? (h.x < p.x ? 'left' : 'right') : h.y < p.y ? 'up' : 'down';
      p.move = 0;
      return;
    }
    let tx = null;
    let ty = null;
    if (p.loop) {
      p.i ??= 1;
      [tx, ty] = p.loop[p.i];
      if (Math.hypot(tx - p.x, ty - p.y) < 4) {
        p.i = (p.i + 1) % p.loop.length;
        [tx, ty] = p.loop[p.i];
      }
    } else if (p.circle) {
      const a = t * (p.speed / p.circle.r) + p.t0;
      [tx, ty] = [p.circle.x + Math.cos(a) * p.circle.r, p.circle.y + Math.sin(a) * p.circle.r * 0.6];
    } else if (p.pace) {
      const k = (Math.sin(t * 0.35 + p.t0) + 1) / 2;
      [tx, ty] = [p.pace[0][0] + (p.pace[1][0] - p.pace[0][0]) * k, p.pace[0][1] + (p.pace[1][1] - p.pace[0][1]) * k];
    }
    if (tx == null) {
      p.move = 0;
      // Idle: look about now and then.
      if (!p.work && Math.floor(t / 4 + p.t0) % 5 === 0) p.facing = Math.sin(t + p.t0) > 0 ? 'right' : p.face;
      else p.facing = p.face;
      return;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const v = (p.speed || 40) * dt;
    if (d > 0.01) {
      const k = Math.min(1, v / d);
      p.x += dx * k;
      p.y += dy * k;
      p.facing = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    }
    p.move = d > 0.5 ? (p.circle ? 1 : 0.8) : 0;
    p.walk += dt * (p.circle ? 13 : 9);
  }

  function talk(S, p, api) {
    const C = S.city;
    C.talking = p;
    C.hero.target = null;
    C.hero.face = Math.abs(p.x - C.hero.x) > Math.abs(p.y - C.hero.y) ? (p.x < C.hero.x ? 'left' : 'right') : p.y < C.hero.y ? 'up' : 'down';
    p.said = ((p.said ?? -1) + 1) % p.lines.length;
    const close = () => {
      C.talking = null;
      api.dialog(null);
    };
    const choices = [];
    if (p.ask) choices.push({ label: p.ask[0], onClick: () => api.dialog({ name: p.name, role: p.title, text: p.ask[1], choices: [{ label: 'Farewell', onClick: close }] }) });
    choices.push({ label: 'Farewell', onClick: close });
    api.dialog({ name: p.name, role: p.title || null, text: p.lines[p.said], choices });
    api.note('city talk', { who: p.id });
  }

  function follow(C, dt) {
    const c = C.cam;
    const vw = 960 / c.zoom;
    const vh = 540 / c.zoom;
    const tx = Math.max(0, Math.min(CW - vw, C.hero.x - vw / 2));
    const ty = Math.max(0, Math.min(CH - vh, C.hero.y - vh / 2 - 20));
    const k = 1 - Math.exp(-6 * dt);
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
  }

  // ---- Drawing ----

  function draw(ctx, S, api) {
    const C = S.city;
    const c = C.cam;
    const t = S.t;
    const night = api.night;
    ctx.save();
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-c.x, -c.y);
    const v = { x: c.x, y: c.y, w: 960 / c.zoom, h: 540 / c.zoom };
    const seen = (x, y, m) => x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    // Ground: soft lighter grass, streets, the square's cobbles.
    ctx.globalAlpha = 0.5;
    for (const [x, y, rx, ry] of [[480, 860, 260, 140], [1480, 860, 280, 150], [960, 320, 380, 90], [1500, 330, 200, 90]]) {
      ellipse(ctx, x, y, rx, ry);
      fill(ctx, PAL.grassLight);
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, color] of [[46, PAL.roadEdge], [38, PAL.road]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const st of STREETS) {
        ctx.moveTo(st[0][0], st[0][1]);
        for (let i = 1; i < st.length; i++) ctx.lineTo(st[i][0], st[i][1]);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ellipse(ctx, SQUARE.x, SQUARE.y, SQUARE.rx + 8, SQUARE.ry + 6);
    fill(ctx, PAL.roadEdge);
    ellipse(ctx, SQUARE.x, SQUARE.y, SQUARE.rx, SQUARE.ry);
    fill(ctx, PAL.cobble);
    ctx.strokeStyle = PAL.cobbleLine;
    ctx.lineWidth = 1.2;
    for (const k of [0.38, 0.68]) {
      ellipse(ctx, SQUARE.x, SQUARE.y + 6, SQUARE.rx * k, SQUARE.ry * k);
      ctx.stroke();
    }
    ctx.fillStyle = tone(PAL.cobble, -0.08);
    for (const [x, y, r] of S.cityLand.cobbles) if (seen(x, y, 4)) {
      ellipse(ctx, x, y, r, r * 0.6);
      ctx.fill();
    }
    for (const [x, y, f] of S.cityLand.tufts) if (seen(x, y, 8) && !onStreet(x, y)) G.tuft(ctx, x, y, 1, PAL.grassDark, f);
    // Side walls, behind everything.
    for (const x of [40, CW - 40]) {
      ctx.fillStyle = PAL.stoneShade;
      ctx.fillRect(x - 22, 150, 44, CH - 150);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x - 22, 150, 44, 14);
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = STYLE.line;
      ctx.strokeRect(x - 22, 150, 44, CH - 150);
    }

    // Everything standing, sorted by its foot.
    const items = [];
    items.push([170, () => northWall(ctx, t)]);
    for (const b of BUILDINGS) if (seen(b.x, b.y - 60, b.w * BS)) items.push([b.y, () => G.building(ctx, { ...b, s: BS, seed: b.x }, t, night)]);
    items.push([TOWER.y, () => G.tower(ctx, TOWER.x, TOWER.y, BS, TOWER.h / BS, TOWER.r, 'terracotta', 'cone', t, 'valedorn')]);
    for (const p of PROPS) if (seen(p[1], p[2], 80)) items.push([p[0] === 'fence' ? Math.max(p[2], p[4]) : p[2], () => prop(ctx, p, t, night)]);
    for (const [i, [x, y]] of CHICKENS.entries()) items.push([y, () => chicken(ctx, x + Math.sin(t * 0.7 + i) * 8, y, t + i)]);
    for (const p of S.city.people) {
      if (!seen(p.x, p.y, 40)) continue;
      items.push([p.y, () => G.fig.figure(ctx, p.x, p.y, { ...p.look, talk: S.city.talking === p ? (Math.sin(t * 12) + 1) / 2 : 0 }, { face: p.facing, walk: p.walk, move: p.move, t: t + p.t0, work: p.work && S.city.talking !== p })]);
    }
    const h = C.hero;
    items.push([h.y, () => {
      ctx.strokeStyle = 'rgba(216,178,90,0.8)';
      ctx.lineWidth = 1.6;
      ellipse(ctx, h.x, h.y + 1, 12, 4.5);
      ctx.stroke();
      G.fig.figure(ctx, h.x, h.y, G.fig.heroLook(CL.campaign?.character?.cloak), { face: h.face, walk: h.walk, move: h.move, t });
    }]);
    items.push([GATE.y + 30, () => southWall(ctx, t)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, paint] of items) paint();
    smoke(ctx, t, seen);
    // Where a tap is taking the hero.
    if (h.target) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      ellipse(ctx, h.target.x, h.target.y, 8, 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function onStreet(x, y) {
    if (((x - SQUARE.x) / SQUARE.rx) ** 2 + ((y - SQUARE.y) / SQUARE.ry) ** 2 < 1.1) return true;
    for (const st of STREETS) for (let i = 1; i < st.length; i++) {
      const [ax, ay] = st[i - 1];
      const [bx, by] = st[i];
      const dx = bx - ax;
      const dy = by - ay;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - ax - dx * k, y - ay - dy * k) < 26) return true;
    }
    return false;
  }

  function northWall(ctx, t) {
    G.cityWall(ctx, 0, 170, CW, BS * 0.9, 40);
    for (const x of [40, 520, 960, 1400, CW - 40]) G.tower(ctx, x, 178, BS * 0.9, 62, 18, 'slate', x === 960 ? 'cone' : 'flat', t, x === 960 ? 'valedorn' : null);
  }
  function southWall(ctx, t) {
    const y = GATE.y + 30;
    G.cityWall(ctx, 0, y, GATE.x - GATE.w / 2 - 20, BS * 0.9, 36);
    G.cityWall(ctx, GATE.x + GATE.w / 2 + 20, y, CW, BS * 0.9, 36);
    for (const x of [40, 480, 1440, CW - 40]) G.tower(ctx, x, y + 6, BS * 0.9, 56, 17, 'slate', 'flat');
    // The gate towers, an open arch between them.
    G.tower(ctx, GATE.x - GATE.w / 2 - 16, y + 8, BS * 0.9, 70, 20, 'slate', 'cone', t, 'valedorn');
    G.tower(ctx, GATE.x + GATE.w / 2 + 16, y + 8, BS * 0.9, 70, 20, 'slate', 'cone', t + 1, 'valedorn');
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(GATE.x - GATE.w / 2 - 4, y - 58);
    ctx.quadraticCurveTo(GATE.x, y - 96, GATE.x + GATE.w / 2 + 4, y - 58);
    ctx.stroke();
    ctx.strokeStyle = PAL.stone;
    ctx.lineWidth = 7;
    ctx.stroke();
  }

  function prop(ctx, p, t, night) {
    const [kind, x, y] = p;
    if (kind === 'well') G.well(ctx, x, y, 1.6);
    else if (kind === 'stall') G.stall(ctx, x, y, 1.5, p[3], p[4]);
    else if (kind === 'forge') G.forge(ctx, x, y, 1.4, t, night);
    else if (kind === 'anvil') G.anvil(ctx, x, y, 1.3);
    else if (kind === 'rack') G.rack(ctx, x, y, 1.3, 'valedorn');
    else if (kind === 'barrel') G.barrel(ctx, x, y, 1.3);
    else if (kind === 'crate') G.crate(ctx, x, y, 1.3);
    else if (kind === 'tree') G.tree(ctx, x, y, 1.25, p[4], p[3], Math.sin(t * 0.8 + x) * 0.025);
    else if (kind === 'bush') G.bush(ctx, x, y, 1.3, x, p[3]);
    else if (kind === 'fence') G.fence(ctx, p[1], p[2], p[3], p[4], 1.2);
    else if (kind === 'banner') G.banner(ctx, x, y, 1.4, p[3], t + x * 0.01, 46);
    else if (kind === 'cart') G.wagon(ctx, x, y, 1.4, -1, 0, '#d9c9a2');
    else if (kind === 'hay') hay(ctx, x, y);
    else if (kind === 'lamp') lamp(ctx, x, y, night);
    else if (kind === 'bench') bench(ctx, x, y);
    else if (kind === 'dummy') dummy(ctx, x, y);
    else if (kind === 'garden') garden(ctx, x, y);
    else if (kind === 'flowers') for (let i = 0; i < 5; i++) G.tuft(ctx, x + i * 9 - 18, y + (i % 2) * 4, 1.2, PAL.forestLight, ['#e9a6a0', '#f2e2a0', '#c9c2e8'][i % 3]);
  }

  function hay(ctx, x, y) {
    G.shadow(ctx, x + 4, y, 16, 5, 8);
    G.rrect(ctx, x - 15, y - 16, 30, 16, 5);
    G.fillLine(ctx, PAL.thatch);
    ctx.strokeStyle = PAL.thatchShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const yy of [-11, -6]) {
      ctx.moveTo(x - 13, y + yy);
      ctx.lineTo(x + 13, y + yy);
    }
    ctx.stroke();
  }
  function lamp(ctx, x, y, night) {
    G.shadow(ctx, x + 3, y, 6, 2.5, 10);
    ctx.strokeStyle = STYLE.outline;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 40);
    ctx.stroke();
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 2;
    ctx.stroke();
    G.rrect(ctx, x - 4.5, y - 49, 9, 10, 2);
    G.fillLine(ctx, night > 0.3 ? PAL.windowLit : '#d8d0b8');
    G.poly(ctx, [x - 6, y - 49, x, y - 55, x + 6, y - 49]);
    G.fillLine(ctx, PAL.timber);
  }
  function bench(ctx, x, y) {
    G.shadow(ctx, x + 3, y, 20, 3, 4);
    G.rrect(ctx, x - 20, y - 9, 40, 5, 2);
    G.fillLine(ctx, PAL.wood);
    ctx.fillStyle = PAL.woodShade;
    ctx.fillRect(x - 17, y - 4, 3, 4);
    ctx.fillRect(x + 14, y - 4, 3, 4);
  }
  function dummy(ctx, x, y) {
    G.shadow(ctx, x + 3, y, 9, 3, 14);
    ctx.strokeStyle = PAL.timber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 34);
    ctx.moveTo(x - 13, y - 24);
    ctx.lineTo(x + 13, y - 24);
    ctx.stroke();
    G.rrect(ctx, x - 7, y - 30, 14, 18, 5);
    G.fillLine(ctx, PAL.thatch);
    ellipse(ctx, x, y - 36, 6, 6);
    G.fillLine(ctx, PAL.cloth);
  }
  function garden(ctx, x, y) {
    G.rrect(ctx, x - 50, y - 24, 100, 48, 6);
    fill(ctx, '#8a6a48');
    ctx.fillStyle = '#7fa055';
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) {
      ellipse(ctx, x - 42 + i * 14, y - 13 + r * 14, 4.5, 3.4);
      ctx.fill();
    }
  }
  function chicken(ctx, x, y, t) {
    const peck = Math.max(0, Math.sin(t * 3)) > 0.8 ? 2 : 0;
    G.shadow(ctx, x + 1, y, 5, 2, 0);
    ellipse(ctx, x, y - 5, 5, 4);
    G.fillLine(ctx, '#f0e8d8', 1);
    ellipse(ctx, x + 4, y - 9 + peck, 2.6, 2.6);
    G.fillLine(ctx, '#f0e8d8', 1);
    ctx.fillStyle = PAL.crimson;
    ctx.fillRect(x + 3.5, y - 12.5 + peck, 2, 1.6);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + 6, y - 9 + peck, 2, 1.2);
  }

  /** Chimney smoke: a few soft puffs rising and fading on a loop (positions from time, not stored). */
  function smoke(ctx, t, seen) {
    for (const b of BUILDINGS) {
      if (b.chimney == null || !seen(b.x, b.y - 100, 140)) continue;
      const w = b.w * BS;
      const cx = b.x + b.chimney * w * 0.3;
      const top = b.y - b.h * BS - (b.d * BS) + b.d * BS * 0.1;
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.25 + i / 4 + b.x * 0.001) % 1;
        ctx.globalAlpha = 0.35 * (1 - k);
        ellipse(ctx, cx + Math.sin(k * 3 + i) * 6 + k * 14, top - k * 60, 6 + k * 10, 5 + k * 8);
        fill(ctx, '#efeae0');
      }
    }
    // The forge's.
    const k0 = t * 0.4;
    for (let i = 0; i < 3; i++) {
      const k = (k0 + i / 3) % 1;
      ctx.globalAlpha = 0.3 * (1 - k);
      ellipse(ctx, 500 + k * 10, 718 - k * 50, 5 + k * 8, 4 + k * 6);
      fill(ctx, '#d9d4cc');
    }
    ctx.globalAlpha = 1;
  }

  function labels(ctx, S, api) {
    const C = S.city;
    const c = C.cam;
    const ts = api.textScale();
    ctx.font = `600 ${Math.round(11.5 * ts)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // A building's name only when the hero is close to it: the look should tell you what it is first.
    for (const b of BUILDINGS) {
      if (!b.name || C.near) continue; // a person's name in reach comes first
      const d = Math.hypot(C.hero.x - b.x, C.hero.y - b.y);
      if (d > 170) continue;
      const sx = (b.x - c.x) * c.zoom;
      const sy = (b.y + 16 - c.y) * c.zoom;
      const w = ctx.measureText(b.name).width + 12;
      ctx.globalAlpha = Math.min(1, (170 - d) / 50);
      ctx.fillStyle = 'rgba(19,35,51,0.78)';
      G.rrect(ctx, sx - w / 2, sy - 9 * ts, w, 18 * ts, 9 * ts);
      ctx.fill();
      ctx.fillStyle = '#f3e3b5';
      ctx.fillText(b.name, sx, sy + 0.5);
    }
    ctx.globalAlpha = 1;
    // The person in reach: name and role over their head.
    const p = C.near;
    if (p && !C.talking) {
      const sx = (p.x - c.x) * c.zoom;
      const sy = (p.y - 50 - c.y) * c.zoom;
      const text = p.title ? `${p.name}, ${p.title}` : p.name;
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(19,35,51,0.86)';
      G.rrect(ctx, sx - w / 2, sy - 9 * ts, w, 18 * ts, 9 * ts);
      ctx.fill();
      ctx.fillStyle = '#ffe7a8';
      ctx.fillText(text, sx, sy + 0.5);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function lights(ctx, S, api) {
    const C = S.city;
    const c = C.cam;
    ctx.save();
    ctx.setTransform(api.k * c.zoom, 0, 0, api.k * c.zoom, -c.x * api.k * c.zoom, -c.y * api.k * c.zoom);
    ctx.globalCompositeOperation = 'lighter';
    const n = api.night;
    for (const p of PROPS) if (p[0] === 'lamp') {
      G.glow(ctx, p[1], p[2] - 44, 26, 0.55 * n);
      G.glow(ctx, p[1], p[2] - 6, 46, 0.16 * n);
    }
    G.glow(ctx, 500, 724, 44, 0.4 * n, '255,150,70');
    G.glow(ctx, C.hero.x, C.hero.y - 16, 40, 0.14 * n);
    ctx.restore();
  }

  function hud(S, api) {
    const C = S.city;
    if (C.talking) return api.prompt('');
    if (C.atGate) return api.prompt('The south gate', [{ label: 'Leave for the map', id: 'gfxLeaveCity', onClick: () => api.go('map', { from: 'city' }) }]);
    if (C.near) return api.prompt(`${C.near.name}${C.near.title ? `, ${C.near.title}` : ''}`, [{ label: 'Talk (E)', id: 'gfxTalk', onClick: () => talk(S, C.near, api) }]);
    api.prompt('Walk with WASD, the arrows or the stick, or tap where to go · tap someone to talk · the gate is south', []);
  }

  // ---- Input ----

  function pointer(S, kind, p, api) {
    const C = S.city;
    if (kind !== 'up' || C.talking) return;
    const w = { x: C.cam.x + p.x / C.cam.zoom, y: C.cam.y + p.y / C.cam.zoom };
    // A tap on a person walks to them and talks; elsewhere, walk there.
    let who = null;
    for (const q of C.people) if (Math.hypot(q.x - w.x, q.y - 18 - w.y) < 26) who = q;
    if (who && near(C.hero, who) < TALK_REACH) return talk(S, who, api);
    C.hero.target = who ? { x: who.x, y: who.y + 24 } : w;
    C.hero.talkTo = who;
  }
  function key(S, code, down, api) {
    const C = S.city;
    if ((code === 'KeyE' || code === 'Enter' || code === 'Space') && down) {
      if (C.talking) {
        C.talking = null;
        api.dialog(null);
      } else if (C.near) talk(S, C.near, api);
      else if (C.atGate) api.go('map', { from: 'city' });
    }
  }
  function onEscape(S, api) {
    if (S.city.talking) {
      S.city.talking = null;
      api.dialog(null);
      return true;
    }
    return false;
  }
  function wheel(S, dy) {
    const c = S.city.cam;
    c.zoom = Math.max(0.75, Math.min(1.4, c.zoom * (dy > 0 ? 0.92 : 1.08)));
  }
  function pinch(S, ratio) {
    const c = S.city.cam;
    c.zoom = Math.max(0.75, Math.min(1.4, c.zoom * ratio));
  }

  G.scenes.city = { init, enter, leave, update, draw, overlay: labels, hud, pointer, key, escape: onEscape, wheel, pinch, lights, BUILDINGS, PEOPLE, GATE, cityMap };
})(typeof window !== 'undefined' ? window : globalThis);
