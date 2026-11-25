// P10-00 (SC-29, D-P9i): the long run. The world alone for years, with nobody in it but its own
// rulers and lords (every realm's ruler is the AI's; the company is parked in a free city, fed and
// paid, out of everyone's way, after the story's ending, as `npm run landed` plays it). Every day it
// checks every invariant (CL.realm.invariants), and four of its own:
//   - no negative money: realms' and holdings' treasuries, detachments' purses, any gold in the save;
//   - no repeated ownership collision: a holding changing hands back and forth within a day;
//   - no endless event loop: a day that logs or emits without end, or takes too long;
//   - no runaway realm: one realm controlling more than half the land.
// It reports each year: the day's time, the save's size, the realms, wars, people and parties.
//   npm run long-run [years=30] [--seed n] [--json] [--trace]  (owner, 2026-11-25: 30 years, not 100)
// --trace prints each new kind of problem when it first happens.
// tests/slow/long-run.test.js plays 10 years of it in the slow suite.
const { loadGame } = require('../tests/helpers/load');

const LIMITS = {
  dayMs: 30_000, // one day of the world alone takes about a second; thirty is a loop
  logsADay: 20_000, // diagnostic lines in one day
  emitsADay: 20_000, // game events in one day
  flipsADay: 2, // a holding changing controller more often than this in a day
  share: 0.5, // the most of the land one realm may control
  keep: 30, // problems kept for the report
};
const MONEY = /^(gold|treasury|purse|balance)$/;

/** Every negative or broken sum of money anywhere in the campaign, with its path. */
function badMoney(c) {
  const out = [];
  const walk = (x, path, depth) => {
    if (!x || typeof x !== 'object' || depth > 8 || out.length >= 5) return;
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'number' && MONEY.test(k) && (!Number.isFinite(v) || v < 0)) out.push(`${path}.${k} = ${v}`);
      else if (v && typeof v === 'object') walk(v, `${path}.${k}`, depth + 1);
    }
  };
  walk(c, 'campaign', 0);
  return out;
}

function run(seed = 1, years = 30, { onYear, onProblem } = {}) {
  const { CL } = loadGame({ party: true, worldParties: true, worldEvents: true, seed });
  const c = CL.campaign;
  const free = CL.realm.kingdoms(c).find((f) => f.freeCity);
  const s = Object.values(CL.content.table('settlements')).find((x) => x.ownerFaction === free?.id) || CL.content.get('settlements', CL.world.map().start);
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: s.id });
  CL.game.mode = 'settlement';
  CL.story.state(c).flags.ending ||= CL.realm.realms(c)[0].id;

  const problems = [];
  let total = 0;
  const kinds = new Set();
  const problem = (d, text) => {
    total++;
    if (problems.length < LIMITS.keep && !problems.some((p) => p.endsWith(text))) problems.push(`day ${d}: ${text}`);
    // --trace: each new kind of problem as it first happens (the text without its numbers).
    const kind = text.replace(/\d+/g, '#');
    if (onProblem && !kinds.has(kind)) {
      kinds.add(kind);
      onProblem(d, text);
    }
  };
  // Counted as they happen.
  let logs = 0;
  let emits = 0;
  const flips = {};
  const log = CL.diag.log;
  CL.diag.log = (...a) => {
    logs++;
    return log.apply(CL.diag, a);
  };
  const emit = CL.events.emit;
  CL.events.emit = (...a) => {
    emits++;
    return emit.apply(CL.events, a);
  };
  CL.events.on('HoldingChanged', (e) => {
    if (e.from.controller !== e.to.controller) flips[e.holding] = (flips[e.holding] || 0) + 1;
  });

  const yearsOut = [];
  const DAYS = 365;
  let yearMs = 0;
  let slowest = 0;
  let worstShare = { share: 0 };
  for (let d = 1; d <= years * DAYS; d++) {
    Object.assign(c, { food: 1e4, gold: 1e4 });
    logs = 0;
    emits = 0;
    for (const k of Object.keys(flips)) delete flips[k];
    const t0 = performance.now();
    try {
      CL.party.advanceDays(1);
    } catch (err) {
      problem(d, `the day threw: ${err?.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
      break;
    }
    CL.game.contactParty = null;
    const ms = performance.now() - t0;
    yearMs += ms;
    slowest = Math.max(slowest, ms);
    if (ms > LIMITS.dayMs) problem(d, `a day took ${Math.round(ms)} ms`);
    if (logs > LIMITS.logsADay) problem(d, `${logs} log lines in one day`);
    if (emits > LIMITS.emitsADay) problem(d, `${emits} events in one day`);
    for (const [h, n] of Object.entries(flips)) if (n > LIMITS.flipsADay) problem(d, `${h} changed hands ${n} times in a day`);
    for (const p of CL.realm.invariants(c)) problem(d, p);
    // Money, every week (the walk is the whole campaign).
    if (d % 7 === 0) for (const m of badMoney(c)) problem(d, `money: ${m}`);
    // A runaway realm.
    const all = Object.values(c.holdings);
    for (const f of CL.realm.realms(c)) {
      const share = all.filter((h) => h.controller === f.id).length / all.length;
      if (share > worstShare.share) worstShare = { share, realm: f.id, day: d };
      if (share > LIMITS.share) problem(d, `${f.id} controls ${Math.round(share * 100)}% of the land`);
    }
    if (d % DAYS === 0) {
      const y = {
        year: d / DAYS,
        msADay: Math.round(yearMs / DAYS),
        slowestMs: Math.round(slowest),
        saveKB: Math.round(JSON.stringify(c).length / 1024),
        realms: CL.realm.realms(c).length,
        wars: Object.values(c.relations).filter((r) => r.state === 'war').length,
        people: Object.keys(c.people).length,
        parties: (c.parties?.list || c.parties || []).length,
        forts: Object.fromEntries(CL.realm.realms(c).map((f) => [f.id, all.filter((h) => h.kind === 'fort' && h.controller === f.id).length])),
        problems: total,
      };
      yearsOut.push(y);
      if (onYear) onYear(y);
      yearMs = 0;
      slowest = 0;
    }
  }
  return { seed, years, problems, total, years_: yearsOut, worstShare: { ...worstShare, share: Math.round(worstShare.share * 100) } };
}

module.exports = { run, badMoney, LIMITS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--seed');
  const seed = at >= 0 ? Number(args[at + 1]) : 1;
  const years = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--seed') || 30);
  const json = args.includes('--json');
  const t = Date.now();
  const r = run(seed, years, {
    onProblem: args.includes('--trace') ? (d, text) => console.log(`  day ${d} (year ${Math.ceil(d / 365)}): ${text}`) : undefined,
    onYear: (y) => {
      if (json) return;
      const forts = Object.entries(y.forts).map(([f, n]) => `${f} ${n}`).join(', ');
      console.log(`year ${y.year}: ${y.msADay} ms a day (slowest ${y.slowestMs}); save ${y.saveKB} KB; ${y.realms} realms, ${y.wars} wars; ${y.people} people, ${y.parties} parties; forts ${forts}; problems so far ${y.problems}`);
    },
  });
  if (json) console.log(JSON.stringify(r));
  else {
    console.log(`seed ${seed}, ${years} years in ${Math.round((Date.now() - t) / 60000)} min. The most land one realm held: ${r.worstShare.share}% (${r.worstShare.realm}, day ${r.worstShare.day}).`);
    console.log(r.total ? `${r.total} problems:\n  ${r.problems.join('\n  ')}` : 'Every invariant held, every day.');
  }
  process.exitCode = r.total ? 1 : 0;
}
