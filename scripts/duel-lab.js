// P11-00: the duel lab. The hero against one fighter, flown by each pilot (tests/helpers/pilots.js:
// masher, timer, turtle), from the same seeded games, so what timing and equipment are worth can be
// measured and later tasks can show what they changed (docs/PHASE-11-PLAN.md §9).
//
//   node scripts/duel-lab.js [seeds=40] [--opponents looter,footman,huscarl] [--pilots masher,timer,turtle]
//        [--weapons] [--armour light,medium,heavy] [--field] [--tourney] [--town-wins 0..3]
//        [--series] [--json]
//
//   (default)    every pilot against each opponent in the medium set with the Arming Sword
//   --weapons    every hero weapon (in the medium set) and every armour set (with the Arming Sword)
//   --field      the open field (grass_field) instead of the tournament ground
//   --tourney    the three rounds of the lists (the real bracket, in the loaner kit), with `townWins`
//                from --town-wins (each 0 to 3 by default)
//   --series     five tournaments in a row in one town, each pilot: how often a new character wins, and
//                the fees and prizes
//   --ranged     P11-07: each bow and the crossbow (the archer pilot, and the masher) against foot and a
//                rider, on the open field; with `--wall`, against a shield wall of three footmen
//   --mounted    P11-08: a knight (lance and destrier, or sword and rouncey) and a horse archer (shortbow,
//                rouncey), the rider, archer and circler pilots, against foot, spears, archers and riders
//   --ai         P11-10: each fighting style (data/styles.js) in one body (a footman's, a spearman's for
//                spear and reach_keeper) against each pilot, with its signature: the share of its blows
//                struck into an opening (the hero recovering, staggered or guard broken), the distance it
//                keeps, how often its shield came up against a blow, and blows landed
//   --styles     P11-06: the foot styles of docs/PHASE-11-PLAN.md §10.3 (light duelist, shield infantry,
//                heavy infantry, spearman, two-hander), each in its own weapon and armour
//
// Reports, per pilot: win rate (opponent cut down), left% (no blow for 45 s: the opponent slipped
// away, which the game counts as a win), seconds, HP left (share of the hero's), blows given and taken.
// The hero is the test fixture's (a new Farmhand); every fighter's numbers are the game's own.
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
const { fly } = require(path.join(ROOT, 'tests/helpers/pilots'));
const { spread } = require(path.join(ROOT, 'scripts/parity'));

const PILOTS = ['masher', 'timer', 'turtle'];
const OPPONENTS = ['looter', 'footman', 'huscarl'];
const WEAPONS = ['worn_sword', 'hand_axe', 'arming_sword', 'war_mace', 'knights_sword', 'ash_spear', 'great_sword', 'great_axe']; // P11-05: the new three
/** The three armour sets, each with a shield (the turtle needs one). */
const ARMOUR = {
  light: { offhand: 'oak_shield', head: null, body: 'clothing', hands: null, feet: 'boots' },
  medium: { offhand: 'kite_shield', head: 'leather_cap', body: 'gambeson', hands: 'gloves', feet: 'boots' },
  heavy: { offhand: 'heater_shield', head: 'iron_helm', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves' },
  // P11-06: the styles' own (no shield for the duelist and the two-hander).
  bare: { offhand: null, head: null, body: 'clothing', hands: null, feet: 'boots' },
  // P11-08: the mounted kits (their horse in the set).
  knight: { offhand: 'kite_shield', head: 'iron_helm', body: 'mail_hauberk', hands: 'mail_mittens', feet: 'greaves', horse: 'destrier' },
  lightHorse: { offhand: 'kite_shield', head: 'leather_cap', body: 'gambeson', hands: 'gloves', feet: 'boots', horse: 'rouncey' },
  horseArcher: { offhand: null, head: 'leather_cap', body: 'gambeson', hands: 'gloves', feet: 'boots', horse: 'rouncey' },
  leather: { offhand: null, head: 'iron_helm', body: 'leather_chest', hands: 'gloves', feet: 'boots' },
};
/** P11-06: the foot styles (plan §10.3), each a weapon and an armour set. */
const STYLES = {
  duelist: { weapon: 'arming_sword', armour: 'bare' },
  shield: { weapon: 'arming_sword', armour: 'medium' },
  heavy: { weapon: 'war_mace', armour: 'heavy' },
  spearman: { weapon: 'ash_spear', armour: 'medium' },
  twohander: { weapon: 'great_sword', armour: 'leather' },
};
const DEFAULT = { weapon: 'arming_sword', armour: 'medium' };
const TOURNEY_TOWN = 'stonebridge';

/** A seeded game with the hero in a kit. */
function game(seed, weapon, armour) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  c.roster = [];
  c.companions = c.companions || {};
  Object.assign(c.equipment, { weapon, ...ARMOUR[armour] });
  if (c.equipment.horse) c.character.skills.riding = Math.max(c.character.skills.riding || 0, 1); // P11-08
  // P11-05: what the kit needs (P11-03), given, so each piece is measured as worn (a lab).
  for (const id of Object.values(c.equipment)) {
    const r = id ? CL.gear.reqOf(id) || {} : {};
    for (const a of ['str', 'agi']) if (r[a]) c.character.attributes[a] = Math.max(c.character.attributes[a], r[a]);
    for (const [k, v] of Object.entries(r.skills || {})) c.character.skills[k] = Math.max(c.character.skills[k] || 0, v);
  }
  return CL;
}

/** One duel on the ground: the hero alone against one fighter (a practice battle: nothing in the campaign changes). */
function duel({ seed, pilot, opponent, weapon = DEFAULT.weapon, armour = DEFAULT.armour, field = false, count = 1 }) {
  const CL = game(seed, weapon, armour);
  CL.combat.startBattle({ id: 'duel_lab', name: 'Duel lab', map: field ? 'grass_field' : 'tourney_lists', waves: [{ [opponent]: count }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  return fly(CL, pilot);
}

/** P11-10: the opponent's style's signature, sampled each frame of a duel. */
function watchStyle(CL) {
  const g = CL.game;
  const m = { blows: 0, intoOpening: 0, dist: 0, frames: 0, threats: 0, guarded: 0 };
  const update = CL.combat.update;
  let was = null;
  let threat = false;
  CL.combat.update = (dt) => {
    update(dt);
    const e = g.enemies[0];
    const h = g.hero;
    if (!e?.alive || !h?.alive) return;
    if (e.swing && e.swing !== was) {
      m.blows++;
      if (CL.styles.open(g, h)) m.intoOpening++;
    }
    was = e.swing;
    m.dist += Math.hypot(e.x - h.x, e.y - h.y);
    m.frames++;
    const coming = Boolean(h.swing && CL.units.swingPhase(h) === 'active');
    if (coming && !threat) {
      m.threats++;
      if (e.guard) m.guarded++;
    }
    threat = coming;
  };
  return m;
}

/** P11-10: one duel against a fighter of this body fighting in this style. */
function styleDuel({ seed, pilot, body, style }) {
  const CL = game(seed, DEFAULT.weapon, DEFAULT.armour);
  CL.combat.startBattle({ id: 'duel_lab', name: 'Duel lab', map: 'tourney_lists', waves: [{ [body]: 1 }], practice: [], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  for (const e of CL.game.enemies) e.styleId = style;
  const m = watchStyle(CL);
  return { ...fly(CL, pilot), sig: m };
}

/** The three rounds of the lists (the real bracket and loaner kit), with `townWins` earlier wins in the town. */
function tourney({ seed, pilot, townWins = 0 }) {
  const CL = game(seed, DEFAULT.weapon, DEFAULT.armour);
  const c = CL.campaign;
  c.gold = 1000;
  const s = CL.content.table('settlements')[TOURNEY_TOWN];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: TOURNEY_TOWN });
  c.tourney = CL.tourney.blank(c.day);
  const h = c.tourney.hosts[TOURNEY_TOWN];
  h.wins = townWins;
  h.next = c.day;
  CL.tourney.tick(c);
  const r = CL.tourney.enter(c, TOURNEY_TOWN);
  if (!r.ok) throw new Error(`Couldn't enter: ${r.reason}`);
  const rounds = [];
  for (let i = 0; i < 3; i++) {
    if (!CL.tourney.fight(c)) break;
    const f = fly(CL, pilot);
    rounds.push(f);
    if (!f.win) break;
  }
  return rounds;
}

/** Five tournaments in a row in one town: what a new character wins, pays and earns. */
function series({ seed, pilot, count = 5 }) {
  const CL = game(seed, DEFAULT.weapon, DEFAULT.armour);
  const c = CL.campaign;
  c.gold = 1000;
  const s = CL.content.table('settlements')[TOURNEY_TOWN];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: TOURNEY_TOWN });
  c.tourney = CL.tourney.blank(c.day);
  const out = [];
  for (let k = 0; k < count; k++) {
    const h = c.tourney.hosts[TOURNEY_TOWN];
    h.entered = null; // the cooldown passed (the days between aren't played)
    h.next = c.day;
    c.tourney.open = [];
    CL.tourney.tick(c);
    const gold = c.gold;
    const r = CL.tourney.enter(c, TOURNEY_TOWN);
    if (!r.ok) throw new Error(`Couldn't enter tournament ${k + 1}: ${r.reason}`);
    const fee = gold - c.gold;
    let won = 0;
    for (let i = 0; i < 3; i++) {
      if (!CL.tourney.fight(c)) break;
      const f = fly(CL, pilot);
      if (!f.win) break;
      won++;
    }
    c.tourney.bracket = null;
    out.push({ fee, won, champion: won === 3, net: c.gold - gold });
  }
  return out;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Summarise duels. */
function sum(rows) {
  return {
    n: rows.length,
    win: (100 * rows.filter((r) => r.win && !r.withdrew).length) / rows.length,
    withdrew: (100 * rows.filter((r) => r.withdrew).length) / rows.length,
    seconds: mean(rows.map((r) => r.seconds)),
    hpLeft: 100 * mean(rows.filter((r) => r.win && !r.withdrew).map((r) => r.hpShare)),
    given: mean(rows.map((r) => r.given)),
    taken: mean(rows.map((r) => r.taken)),
    blocked: mean(rows.map((r) => r.blocked)),
    unfinished: rows.filter((r) => !r.ended).length,
  };
}

function runDuels({ seeds = 40, pilots = PILOTS, opponents = OPPONENTS, kits = [DEFAULT], field = false, wall = false } = {}) {
  const out = [];
  for (const kit of kits) {
    for (const opponent of opponents) {
      for (const pilot of pilots) {
        const rows = [];
        for (let i = 1; i <= seeds; i++) rows.push(duel({ seed: spread(i), pilot, opponent, weapon: kit.weapon, armour: kit.armour, field, count: wall ? 3 : 1 }));
        out.push({ style: kit.style, weapon: kit.weapon, armour: kit.armour, opponent, pilot, ...sum(rows) });
      }
    }
  }
  return out;
}

const AI_STYLES = [['brawler', 'footman'], ['soldier', 'footman'], ['veteran', 'footman'], ['heavy', 'footman'], ['spear', 'spearman'], ['brawler', 'spearman'], ['rusher', 'footman'], ['shield_wall', 'footman'], ['counter', 'footman'], ['reach_keeper', 'spearman']];

function runStyles({ seeds = 40, pilots = PILOTS, styles = AI_STYLES } = {}) {
  const out = [];
  for (const [style, body] of styles) {
    for (const pilot of pilots) {
      const rows = [];
      for (let i = 1; i <= seeds; i++) rows.push(styleDuel({ seed: spread(i), pilot, body, style }));
      const tot = (k) => rows.reduce((n, r) => n + r.sig[k], 0);
      out.push({ style, body, pilot, ...sum(rows), intoOpening: tot('blows') ? (100 * tot('intoOpening')) / tot('blows') : 0, keeps: tot('frames') ? tot('dist') / tot('frames') : 0, guarded: tot('threats') ? (100 * tot('guarded')) / tot('threats') : 0 });
    }
  }
  return out;
}

function runTourney({ seeds = 40, pilots = PILOTS, townWins = [0, 1, 2, 3] } = {}) {
  const out = [];
  for (const tw of townWins) {
    for (const pilot of pilots) {
      const brackets = [];
      for (let i = 1; i <= seeds; i++) brackets.push(tourney({ seed: spread(i), pilot, townWins: tw }));
      const rounds = [0, 1, 2].map((k) => {
        const reached = brackets.filter((b) => b.length > k);
        return { reached: reached.length, win: reached.length ? (100 * reached.filter((b) => b[k].win).length) / reached.length : null, seconds: mean(reached.map((b) => b[k].seconds)), hpLeft: 100 * mean(reached.filter((b) => b[k].win).map((b) => b[k].hpShare)) };
      });
      out.push({ townWins: tw, pilot, champion: (100 * brackets.filter((b) => b.length === 3 && b[2].win).length) / seeds, rounds });
    }
  }
  return out;
}

function runSeries({ seeds = 40, pilots = PILOTS } = {}) {
  return pilots.map((pilot) => {
    const all = [];
    for (let i = 1; i <= seeds; i++) all.push(series({ seed: spread(i), pilot }));
    const nth = (k) => all.map((s) => s[k]);
    return {
      pilot,
      first: (100 * nth(0).filter((x) => x.champion).length) / seeds, // a new character's first tournament
      champion: [0, 1, 2, 3, 4].map((k) => (100 * nth(k).filter((x) => x.champion).length) / seeds),
      fee: [0, 1, 2, 3, 4].map((k) => mean(nth(k).map((x) => x.fee))),
      net: mean(all.map((s) => s.reduce((n, x) => n + x.net, 0))),
    };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const list = (name, d) => (opt(name) ? opt(name).split(',') : d);
  const seeds = Number(args.find((a, i) => /^\d+$/.test(a) && !String(args[i - 1]).startsWith('--')) ?? 40);
  const pilots = list('--pilots', PILOTS);
  const json = args.includes('--json');
  const f = (n, d = 0) => (n == null ? '–' : n.toFixed(d)).padStart(6);
  const t0 = Date.now();
  if (args.includes('--ai')) {
    const out = runStyles({ seeds, pilots });
    if (json) console.log(JSON.stringify({ seeds, styles: out }, null, 2));
    else {
      console.log(`Fighting styles against the pilots, the tournament ground, ${seeds} seeds each (the hero: Arming Sword, medium)`);
      console.log(`${'style'.padEnd(13)}${'body'.padEnd(9)}${'pilot'.padEnd(8)}  win%  secs  hp-left%  taken  into-opening%  keeps-px  guarded%`);
      for (const r of out) console.log(`${r.style.padEnd(13)}${r.body.padEnd(9)}${r.pilot.padEnd(8)}${f(r.win)}${f(r.seconds, 1)}${f(r.hpLeft).padStart(10)}${f(r.taken, 1).padStart(7)}${f(r.intoOpening).padStart(15)}${f(r.keeps).padStart(10)}${f(r.guarded).padStart(10)}`);
    }
  } else if (args.includes('--series')) {
    const out = runSeries({ seeds, pilots });
    if (json) console.log(JSON.stringify({ seeds, series: out }, null, 2));
    else {
      console.log(`Five tournaments in a row at ${TOURNEY_TOWN}, a new character, ${seeds} seeds`);
      for (const r of out) console.log(`${r.pilot.padEnd(8)} champion of the first ${f(r.first)}%  each: ${r.champion.map((x) => `${x.toFixed(0)}%`).join(' ')}  fees ${r.fee.map((x) => x.toFixed(0)).join(' ')}  net over five ${f(r.net)} crowns`);
    }
  } else if (args.includes('--tourney')) {
    const tw = opt('--town-wins') != null ? opt('--town-wins').split(',').map(Number) : [0, 1, 2, 3];
    const out = runTourney({ seeds, pilots, townWins: tw });
    if (json) console.log(JSON.stringify({ seeds, tourney: out }, null, 2));
    else {
      console.log(`The lists at ${TOURNEY_TOWN} (loaner kit), ${seeds} seeds; per round: reached, win%, seconds, HP left% when won`);
      for (const r of out) console.log(`town wins ${r.townWins}  ${r.pilot.padEnd(8)} champion ${f(r.champion)}%   ${r.rounds.map((x, k) => `R${k + 1} ${String(x.reached).padStart(2)} ${f(x.win)}% ${f(x.seconds)}s ${f(x.hpLeft)}%`).join('  ')}`);
    }
  } else {
    const opponents = list('--opponents', OPPONENTS);
    const armours = list('--armour', null);
    const ranged = args.includes('--ranged');
    const mounted = args.includes('--mounted');
    const kits = mounted ? [{ weapon: 'war_lance', armour: 'knight', style: 'lance knight' }, { weapon: 'arming_sword', armour: 'lightHorse', style: 'sword rider' }, { weapon: 'short_bow', armour: 'horseArcher', style: 'horse archer' }] : ranged ? ['short_bow', 'hunting_longbow', 'light_crossbow'].map((weapon) => ({ weapon, armour: 'light' })) : args.includes('--styles') ? Object.entries(STYLES).map(([style, k]) => ({ ...k, style })) : args.includes('--weapons') ? [...WEAPONS.map((weapon) => ({ weapon, armour: DEFAULT.armour })), ...Object.keys(ARMOUR).filter((a) => a !== DEFAULT.armour).map((armour) => ({ weapon: DEFAULT.weapon, armour }))] : (armours || [DEFAULT.armour]).map((armour) => ({ weapon: DEFAULT.weapon, armour }));
    const out = runDuels({ seeds, pilots: mounted && !opt('--pilots') ? ['rider', 'circler'] : ranged && !opt('--pilots') ? ['archer', 'masher'] : pilots, opponents: mounted && !opt('--opponents') ? ['looter', 'footman', 'spearman', 'hunter', 'rider'] : ranged && !opt('--opponents') ? (args.includes('--wall') ? ['footman'] : ['looter', 'footman', 'huscarl', 'hunter', 'rider']) : opponents, kits, field: ranged || mounted || args.includes('--field'), wall: args.includes('--wall') });
    if (json) console.log(JSON.stringify({ seeds, field: args.includes('--field'), duels: out }, null, 2));
    else {
      console.log(`Duels on the ${args.includes('--field') ? 'open field' : 'tournament ground'}, ${seeds} seeds each`);
      console.log(`${'weapon'.padEnd(14)}${'armour'.padEnd(8)}${'opponent'.padEnd(9)}${'pilot'.padEnd(8)}  win%  left%  secs  hp-left%  given  taken  blocked`);
      for (const r of out) console.log(`${(r.style || r.weapon).padEnd(14)}${r.armour.padEnd(8)}${r.opponent.padEnd(9)}${r.pilot.padEnd(8)}${f(r.win)}${f(r.withdrew).padStart(7)}${f(r.seconds, 1)}${f(r.hpLeft).padStart(10)}${f(r.given, 1).padStart(7)}${f(r.taken, 1).padStart(7)}${f(r.blocked, 1).padStart(9)}${r.unfinished ? `  (${r.unfinished} never ended)` : ''}`);
    }
  }
  if (!json) console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

module.exports = { AI_STYLES, styleDuel, runStyles, STYLES, PILOTS, OPPONENTS, WEAPONS, ARMOUR, DEFAULT, duel, tourney, series, runDuels, runTourney, runSeries };
