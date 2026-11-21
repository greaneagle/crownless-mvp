// P8-06a: the landed world alone. `npm run landed [days=180] [seeds=3]` plays the world with nobody
// in it but its own lords and parties (the company parked in a town, fed and paid), after the story's
// ending, on several seeds,
// and reports wars, sieges begun, lifted, surrendered and stormed; forts per realm over time; grants;
// how many lords are landless, hold one place or several; and the invariants (design §25.3).
const { loadGame } = require('../tests/helpers/load');

function run(seed, days = 180) {
  const { CL } = loadGame({ party: true, worldParties: true, worldEvents: true, seed });
  const c = CL.campaign;
  const s = CL.content.get('settlements', 'merrow');
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'merrow' }); // the free city: out of everyone's way
  CL.game.mode = 'settlement';
  // The sandbox after the story (D-W5: until Q4 ends the March pair is held in tension, and the other
  // kingdoms rarely meet), so its wars can come: the story's ending as the Crown holding Greywall.
  CL.story.state(c).flags.ending = 'valedorn';
  const forts = () => {
    const out = {};
    for (const f of CL.realm.realms()) out[f.id] = Object.values(c.holdings).filter((h) => h.kind === 'fort' && h.controller === f.id).length;
    return out;
  };
  const tally = { wars: 0, begun: 0, lifted: 0, surrendered: 0, stormed: 0, relieved: 0, abandoned: 0, grants: 0, fell: 0, problems: [] };
  // Counted as they happen (the diagnostic log keeps only the latest lines).
  const log = CL.diag.log;
  CL.diag.log = (level, msg, data) => {
    if (msg === 'Siege planned') tally.begun++;
    if (msg === 'Siege ended' && tally[data?.how] != null) tally[data.how]++;
    return log.call(CL.diag, level, msg, data);
  };
  CL.events.on('HoldingChanged', (e) => {
    if (e.reason === 'grant') tally.grants++;
    if (e.from.controller !== e.to.controller) tally.fell++;
  });
  const seen = new Set();
  const timeline = [];
  for (let d = 1; d <= days; d++) {
    Object.assign(c, { food: 1e4, gold: 1e4 });
    CL.party.advanceDays(1);
    CL.game.contactParty = null;
    for (const [k, r] of Object.entries(c.relations)) {
      if (r.state === 'war' && !seen.has(`${k}@${r.since}`)) {
        seen.add(`${k}@${r.since}`);
        tally.wars++;
      }
    }
    for (const p of CL.realm.invariants(c)) if (tally.problems.length < 10) tally.problems.push(`day ${d}: ${p}`);
    if (d % 30 === 0) timeline.push({ day: d, forts: forts() });
  }
  const lords = Object.keys(c.people).filter((id) => !CL.realm.rules(id, c));
  const land = (id) => CL.realm.fiefsOf(id, c).length;
  const lordsBy = { landless: lords.filter((id) => !land(id)).length, one: lords.filter((id) => land(id) === 1).length, several: lords.filter((id) => land(id) > 1).length };
  return { seed, days, ...tally, forts: forts(), timeline, lords: lordsBy };
}

module.exports = { run };

if (require.main === module) {
  const [days = 180, seeds = 3] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  for (let i = 1; i <= seeds; i++) {
    const r = run(i, days);
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(r));
      continue;
    }
    console.log(`seed ${r.seed}, ${r.days} days: ${r.wars} wars; sieges planned ${r.begun}; forts taken ${r.fell} (stormed ${r.stormed}, surrendered ${r.surrendered}, lifted ${r.lifted}, relieved ${r.relieved}, abandoned ${r.abandoned}); ${r.grants} grants`);
    console.log(`  forts at the end: ${Object.entries(r.forts).map(([f, n]) => `${f} ${n}`).join(', ')}; by month: ${r.timeline.map((t) => Object.values(t.forts).join('/')).join(' ')}`);
    console.log(`  lords: ${r.lords.landless} landless, ${r.lords.one} with one place, ${r.lords.several} with several; invariants: ${r.problems.length ? r.problems.join('; ') : 'all held'}`);
  }
}
