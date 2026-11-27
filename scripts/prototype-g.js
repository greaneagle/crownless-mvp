// Prototype G, "the hands-off campaign" (V2-13; design Part 2 §28): the same small campaign played by
// (a) a player who never opens a setting and auto-resolves every fight, (b) one who fights in person and
// only picks presets, and (c) an expert who chooses setups, rallies, and keeps a quartermaster and a
// merchant (from 2.23.0, P7-T, also a surgeon, a scout and a blacksmith, a detachment out hunting, a
// mill, and the world's events, which run in every style), and (d, from 3.0.0, P8-T) a landed player who
// serves a crown, swears fealty and takes the land it is granted, leaving the steward and the defaults, and (e, from
// 4.0.0, P9-T) a ruler who founds a realm at a fort of its own and leaves it to its officers. Each run also saves at the halfway mark, reloads from that save and plays on (resuming after
// time away). Reports outcomes, forced screens and warnings per style.
//   node scripts/prototype-g.js [days=30] [seeds=6] [style…]
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame, memoryStorage } = require(path.join(ROOT, 'tests/helpers/load'));
const { makeBot, headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WARN = /Wages short|run out of food|deserted|^Quartermaster .*: (food|wages)|went unpaid|leaves the company/;

/**
 * P9-T, the ruler style: test values for a captain who may found a realm at once (what a long
 * campaign earns): the story over, a fort of the wider world held of its realm, 600 renown and 40
 * soldiers. The bot declares there, and its officers rule by their default policies from then on.
 */
function ruleSetup(CL, c) {
  const R = CL.realm;
  CL.story.state(c).flags.ending ||= R.realms()[0].id;
  const sid = Object.keys(c.holdings).find((id) => {
    const h = c.holdings[id];
    return h.kind === 'fort' && R.isRealm(h.sovereign) && R.capitalOf(h.sovereign, c) !== id && !CL.content.get('settlements', id).story && !R.rules(h.holder, c);
  });
  R.transfer(c, sid, { holder: 'player', willing: true, reason: 'test' });
  c.renown = Math.max(c.renown, CL.founding.RULES.renown);
  const troop = c.roster[0]?.troop || Object.values(CL.content.table('troops')).find((t) => t.tier === 'T1')?.id;
  while (c.roster.length < CL.founding.RULES.soldiers) CL.save.addSoldier(c, troop);
  Object.assign(c, { gold: Math.max(c.gold, 1500), food: Math.max(c.food, 200) });
  const s = CL.content.get('settlements', sid);
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
  CL.ui.changeMode('settlement');
}

/** One campaign in one style: play half, save, reload from storage, play the rest. */
// P9-08: `world` plays another official world (data/worlds/*.js), as `--world <id>` does.
function run(seed, style, days, { world, tweak } = {}) {
  const storage = memoryStorage();
  const messages = [];
  const boot = (fresh) => {
    const env = loadGame({ party: false, worldEvents: true, random: mulberry(seed * 7919), seed, storage, world });
    const { CL } = env;
    CL.ui = headlessUi(CL, messages);
    tweak?.(CL); // a measuring switch (P11-10: CL.styles.USE), on every boot
    if (fresh) {
      CL.game.newGame = true;
      CL.character.begin({ name: `G${seed}`, origin: 'farmhand', plain: true });
      const c = CL.campaign;
      c.rngSeed = seed;
      c.rng = CL.autoresolve.streamSeeds(seed); // P8-T: the dice streams too (a new game seeds them from the clock)
      c.parties = [];
      c.partySpawns = {};
      c.nextPartyId = 1;
      CL.parties.ensure(c, true);
      if (style === 'ruler') ruleSetup(CL, c);
    }
    return CL;
  };
  let CL = boot(true);
  const first = makeBot(CL, { style }).play(days / 2);
  if (CL.game.mode === 'battle') CL.debugTools.endBattleNow(true);
  const savedDay = CL.campaign.day;
  const wrote = CL.save.write();
  CL = boot(false); // time away: the page is closed and opened again
  const resumed = Math.abs(CL.campaign.day - savedDay) < 1e-9 && wrote;
  CL.ui.changeMode('map');
  const second = makeBot(CL, { style }).play(days - CL.campaign.day);
  const c = CL.campaign;
  const add = (k) => (first[k] || 0) + (second[k] || 0);
  return {
    money: c.gold + (c.accounts?.chest || 0) + (CL.merchant?.worth(c) || 0),
    soldiers: c.roster.length,
    renown: c.renown,
    level: c.character.level,
    wins: add('wins'),
    losses: add('losses'),
    fought: add('fought'),
    heroDown: add('heroDown'),
    rallies: add('rallies'),
    screens: add('screens'),
    decisions: add('decisions'), // P8-T: the forced screens (a ransom, a grant, a conquest, your fort besieged)
    stuck: add('stuck'),
    warnings: messages.filter((m) => WARN.test(m)).length,
    followers: [CL.quartermaster?.get(c) ? 'QM' : '', CL.merchant?.get(c) ? 'merchant' : '', CL.surgeon.get(c) ? 'surgeon' : '', CL.scout.get(c) ? 'scout' : '', CL.blacksmith.get(c) ? 'smith' : ''].filter(Boolean).join('+') || '-',
    roles: [CL.quartermaster?.get(c), CL.merchant?.get(c), CL.surgeon.get(c), CL.scout.get(c), CL.blacksmith.get(c)].filter(Boolean).length,
    detachments: add('detachmentsSent'),
    detachmentsBack: (c.detachments || []).filter((d) => d.status === 'back').length,
    mill: CL.business.get(c) ? Math.round(CL.business.get(c).profit) : null,
    millsBought: add('millsBought'),
    events: add('eventsJoined'),
    merchantWorth: Math.round(CL.merchant?.worth(c) || 0),
    hired: [...(first.hiredFollowers || []), ...(second.hiredFollowers || [])],
    millWeeks: CL.business.get(c)?.weeks || 0,
    eventsSeen: CL.happenings.state(c).past.length + CL.happenings.state(c).open.length,
    news: c.news?.lines?.length || 0,
    chronicle: Array.isArray(c.chronicle) ? c.chronicle.length : 0,
    titled: CL.realm.fiefsOf('player', c).length > 0,
    fiefs: CL.realm.fiefsOf('player', c).length,
    // P8-T: when the oath came, and the first land (the chronicle's first holding gained).
    swornDay: CL.allegiance.state(c).kind === 'vassal' ? Math.floor(CL.allegiance.state(c).since) : null,
    landedDay: (Array.isArray(c.chronicle) ? c.chronicle : []).find((e) => e.kind === 'holding' && e.event === 'gained')?.day ?? null,
    allegiance: CL.allegiance.state(c).kind,
    // P9-T: the ruler: the realm founded, on what day, its vassals and treasury at the end.
    ruled: Boolean(CL.founding.mine(c)),
    foundedDay: first.founded ?? second.founded ?? null,
    vassals: CL.founding.vassals(c).length,
    treasury: CL.founding.mine(c) ? Math.round(CL.crowns.treasury(c, CL.founding.mine(c))) : null,
    invariants: [...(first.invariants || []), ...(second.invariants || [])].length,
    resumed,
    day: c.day,
  };
}

function main() {
  const days = Number(process.argv[2] || 30);
  const seeds = Number(process.argv[3] || 6);
  const rows = [];
  const w = process.argv.indexOf('--world');
  const world = w > 0 ? process.argv[w + 1] : undefined;
  const only = process.argv.slice(4).filter((a, i, all) => a !== '--world' && all[i - 1] !== '--world'); // optional: the styles to run (default all four)
  for (const style of only.length ? only : ['hands-off', 'presets', 'expert', 'landed']) {
    const all = [];
    for (let seed = 1; seed <= seeds; seed++) all.push(run(seed, style, days, { world }));
    const sum = (k) => all.reduce((n, r) => n + r[k], 0);
    const med = (k) => [...all.map((r) => r[k])].sort((a, b) => a - b)[Math.floor(all.length / 2)];
    rows.push({
      style,
      'money (median)': Math.round(med('money')),
      soldiers: med('soldiers'),
      renown: med('renown'),
      level: med('level'),
      'won/lost': `${sum('wins')}/${sum('losses')}`,
      fought: sum('fought'),
      'hero down': sum('heroDown'),
      rallies: sum('rallies'),
      'extra screens': sum('screens'),
      roles: med('roles'),
      detached: sum('detachments'),
      mills: sum('millsBought'),
      events: sum('events'),
      warnings: sum('warnings'),
      stuck: sum('stuck'),
      resumed: `${all.filter((r) => r.resumed && r.day >= days - 0.01).length}/${seeds}`,
      // P8-T: what the landed style comes to, and the forced screens (design §28: mandatory clicks).
      sworn: all.filter((r) => r.allegiance === 'vassal').length,
      landed: all.filter((r) => r.fiefs > 0).length,
      'sworn on day': all.map((r) => r.swornDay ?? '-').join('/'),
      'land on day': all.map((r) => (r.landedDay == null ? '-' : Math.floor(r.landedDay))).join('/'),
      'forced /10 days': (sum('decisions') / (seeds * days / 10)).toFixed(2),
      invariants: sum('invariants'),
      ruled: all.filter((r) => r.ruled).length, // P9-T
    });
  }
  console.log(`Prototype G: ${seeds} campaigns × ${days} days, each style on the same seeds`);
  console.table(rows);
}

if (require.main === module) main();
module.exports = { run };
