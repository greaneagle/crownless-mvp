// P11-01: golden battles. Each scenario is a seeded battle fought to its end (or a fixed time), and every
// frame's state (each fighter's position, HP, facing, swing and cooldown; each arrow) goes into one
// SHA-256 digest, so two builds that fight even one frame differently disagree. The expected digests
// were recorded on 5.0.1 (the same play as 5.0.0) before the combat profile (tests/fixtures/golden/).
//   node tests/helpers/golden.js            print each scenario's digest and summary
//   node tests/helpers/golden.js --write    record them as the expected values (only on purpose)
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./load');
const { headlessUi } = require('./campaign-bot');
const { makePilot } = require('./pilots');
const { setup: paritySetup, SCENARIOS, spread } = require('../../scripts/parity');
const { setupBench } = require('../../scripts/bench-battle');

const FILE = path.join(__dirname, '..', 'fixtures', 'golden', 'battles.json');
const PROFILES = path.join(__dirname, '..', 'fixtures', 'golden', 'fighters.json');

/** The digest of every frame: a fighter's numbers, then each arrow's. */
function tracer() {
  const h = crypto.createHash('sha256');
  const buf = new Float64Array(9);
  const bytes = new Uint8Array(buf.buffer);
  const FACE = { up: 1, down: 2, left: 3, right: 4 };
  let frames = 0;
  return {
    frame(g) {
      frames++;
      for (const u of [g.hero, ...g.allies, ...g.enemies]) {
        if (!u) continue;
        buf[0] = u.id;
        buf[1] = u.x;
        buf[2] = u.y;
        buf[3] = u.hp;
        buf[4] = (u.alive ? 1 : 0) + (u.guard ? 2 : 0) + (u.routing ? 4 : 0);
        buf[5] = FACE[u.face] || 0;
        buf[6] = u.swing ? u.swing.t : -1;
        buf[7] = u.attackCooldown;
        buf[8] = u.swing ? u.swing.hit.length : -1;
        h.update(bytes);
      }
      for (const a of g.arrows) {
        buf.fill(0);
        [buf[0], buf[1], buf[2], buf[3]] = [a.x, a.y, a.life, a.damage];
        h.update(bytes);
      }
    },
    done: () => ({ frames, digest: h.digest('hex') }),
  };
}

/** Fight the battle in progress with a pilot, tracing each frame, to its end or `maxFrames`. */
function trace(CL, { pilot = 'masher', maxFrames = 30000, dt = 0.02 } = {}) {
  const g = CL.game;
  const p = pilot ? makePilot(CL, pilot) : null;
  const t = tracer();
  for (let i = 0; i < maxFrames && g.mode === 'battle'; i++) {
    p?.step();
    CL.combat.update(dt);
    t.frame(g);
  }
  const live = (l) => l.filter((u) => u.alive).length;
  return { ...t.done(), mode: g.mode, win: g.mode === 'battle' ? null : Boolean(g.result?.win), heroHp: Math.round(g.hero.hp * 1000) / 1000, allies: live(g.allies), enemies: live(g.enemies), t: Math.round(g.t * 1000) / 1000 };
}

/** A lord's battle: his men and the lord himself (js/lords.js `leaderFor`'s numbers). */
const LORD_BATTLE = { id: 'golden_lord', name: 'Golden lord', map: 'grass_field', waves: [{ footman: 4, hunter: 2, rider: 1 }], leader: { troop: 'footman', name: 'Lord Golden', hp: 2, damage: 1.35, house: null }, reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' };

/** A seeded game whose company has Mara and Sigrun (a retinue companion) beside the fixture's soldiers. */
function companyGame(seed) {
  const { CL } = loadGame({ seed });
  CL.ui = headlessUi(CL);
  const c = CL.campaign;
  c.character.skills.leadership = 2; // room for both
  if (!CL.companion.join(c, 'mara') || !CL.retinue.join(c, 'sigrun')) throw new Error('companions did not join');
  return CL;
}

/** Every fighter's numbers as a battle starts them, for the profile tests (tests/profile.test.js). */
function fighters(CL) {
  const g = CL.game;
  const pick = (u) => ({ troop: u.troop, role: u.role, companion: u.companion || null, named: u.named || null, hp: u.hp, maxhp: u.maxhp, damage: u.damage, armor: u.armor, reach: u.reach, speed: u.speed, ranged: u.ranged ? { ...u.ranged } : null, canBlock: u.canBlock ?? null });
  return [g.hero, ...g.allies, ...g.enemies].map(pick);
}

/** The numbers every kind of fighter starts a battle with (5.0.1, before the profile). */
function snapshot() {
  const out = {};
  // Every troop, as makeUnit builds it.
  const { CL } = loadGame({ seed: 1 });
  out.troops = Object.fromEntries(
    Object.keys(CL.content.table('troops')).map((id) => {
      const u = CL.units.makeUnit(0, 0, 'enemy', id);
      return [id, { role: u.role, hp: u.hp, damage: u.damage, armor: u.armor, reach: u.reach, speed: u.speed, ranged: u.ranged ? { ...u.ranged } : null }];
    }),
  );
  // The hero in each weapon (the fixture's gear otherwise), unarmed, and in the tournament's loaner kit.
  const C = CL.character;
  const c = CL.campaign;
  out.hero = {};
  // P11-03: what each weapon gives, from the profile itself (requirements, which decide whether it's used, are tests/requirements.test.js's).
  const own = (equipment) => {
    const p = CL.profile.resolve({ hero: c, equipment });
    return { hp: p.hp, maxhp: p.maxhp, damage: p.damage, armor: p.armor, canBlock: p.canBlock };
  };
  for (const w of [null, 'worn_sword', 'hand_axe', 'arming_sword', 'war_mace', 'knights_sword']) out.hero[w || 'unarmed'] = own({ ...c.equipment, weapon: w });
  out.hero.kit = { ...C.heroCombat(c, CL.content.get('tournaments', 'lists').kit) };
  out.heroPower = CL.autoresolve.heroPower(c);
  // Mara, a retinue companion and a lord in person, as the lord's battle starts them.
  const G = companyGame(spread(6));
  out.mara = { ...G.companion.combat(G.campaign) };
  out.retinue = Object.fromEntries(Object.keys(G.content.table('companions')).filter((id) => id !== 'mara').map((id) => [id, { ...G.retinue.combat({ id, equipment: { ...G.content.table('companions')[id].startGear } }) }]));
  G.combat.startBattle(LORD_BATTLE);
  out.lordBattle = fighters(G);
  return out;
}

/** The golden scenarios: name → a function that fights it and returns the trace. */
const SCENARIOS_GOLDEN = {
  // The benchmark's battle at 40 for 30 s (foot, archers and riders a side; the hero can't fall).
  'bench@40': () => {
    const CL = setupBench(40);
    return trace(CL, { pilot: null, maxFrames: 30 * 60, dt: 1 / 60 });
  },
  // Each of parity.js's five scenarios, fought by the masher (Balanced).
  ...Object.fromEntries(
    SCENARIOS.map((s) => [
      `parity:${s.id}`,
      () => {
        const CL = paritySetup(s, spread(3));
        const e = CL.parties.current();
        CL.parties.attack(CL.prep.plan('balanced', CL.arena.mapFor(e.def.map)));
        return trace(CL);
      },
    ]),
  ),
  // A tournament's first bout, in the loaner kit (the hero won't win it: a shield stops every frontal blow).
  'tourney:bout': () => {
    const { CL } = loadGame({ seed: spread(4) });
    CL.ui = headlessUi(CL);
    const c = CL.campaign;
    c.gold = 1000;
    const s = CL.content.table('settlements').stonebridge;
    Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
    c.tourney = CL.tourney.blank(c.day);
    c.tourney.hosts.stonebridge.next = c.day;
    CL.tourney.tick(c);
    if (!CL.tourney.enter(c, 'stonebridge').ok || !CL.tourney.fight(c)) throw new Error('no bout');
    return trace(CL);
  },
  // The company with Mara and a retinue companion against a lord in person at the head of his men.
  'company:lord': () => {
    const CL = companyGame(spread(6));
    CL.combat.startBattle(LORD_BATTLE);
    return trace(CL);
  },
  // An assault on the walls (Debug's practice assault: 40 a side, attacking).
  'assault:attack': () => {
    const { CL } = loadGame({ seed: spread(5) });
    CL.ui = headlessUi(CL);
    CL.combat.setActiveCap(40);
    CL.combat.startBattle(CL.assault.practice(40, 'attack'));
    return trace(CL, { maxFrames: 9000 });
  },
};

function record() {
  return Object.fromEntries(Object.entries(SCENARIOS_GOLDEN).map(([k, f]) => [k, f()]));
}

if (require.main === module) {
  const out = record();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, `${JSON.stringify({ recordedOn: require('../../package.json').version, scenarios: out }, null, 2)}\n`);
    fs.writeFileSync(PROFILES, `${JSON.stringify({ recordedOn: require('../../package.json').version, ...snapshot() }, null, 2)}\n`);
    console.log(`Wrote ${FILE} and ${PROFILES}`);
  }
  for (const [k, r] of Object.entries(out)) console.log(`${k.padEnd(20)} ${r.digest.slice(0, 16)} frames ${r.frames} ${r.mode} win ${r.win} hero ${r.heroHp} allies ${r.allies} enemies ${r.enemies}`);
}

module.exports = { FILE, PROFILES, SCENARIOS_GOLDEN, LORD_BATTLE, record, trace, tracer, snapshot, fighters, companyGame };
