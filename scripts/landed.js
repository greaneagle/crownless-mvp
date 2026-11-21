// P8-06a: the landed world alone. `npm run landed [days=180] [seeds=3]` plays the world with nobody
// in it but its own lords and parties (the company parked in a town, fed and paid), after the story's
// ending, on several seeds,
// and reports wars, sieges begun, lifted, surrendered and stormed; forts per realm over time; grants;
// how many lords are landless, hold one place or several; and the invariants (design §25.3).
// P8-07: the lords' changes of realm (per realm, and the grumbling first), refused summonses,
// revocations, the friendships, rivalries and feuds that formed, land gained and lost, and the
// riding lords each realm has at the end (none may empty).
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
  const tally = { wars: 0, begun: 0, lifted: 0, surrendered: 0, stormed: 0, relieved: 0, abandoned: 0, grants: 0, fell: 0, problems: [], left: {}, joined: {}, grumbled: 0, refused: 0, revoked: 0, gained: 0, lost: 0 };
  // Counted as they happen (the diagnostic log keeps only the latest lines).
  const log = CL.diag.log;
  CL.diag.log = (level, msg, data) => {
    if (msg === 'Siege planned') tally.begun++;
    if (msg === 'Siege ended' && tally[data?.how] != null) tally[data.how]++;
    if (msg === 'Lord changes realm') {
      tally.left[data.from] = (tally.left[data.from] || 0) + 1;
      tally.joined[data.to] = (tally.joined[data.to] || 0) + 1;
    }
    return log.call(CL.diag, level, msg, data);
  };
  CL.events.on('HoldingChanged', (e) => {
    if (e.reason === 'grant') tally.grants++;
    if (e.reason === 'revoked') tally.revoked++;
    if (e.from.controller !== e.to.controller) tally.fell++;
    const lord = (id) => Boolean(c.people[id]) && !CL.realm.rules(id, c);
    if (e.from.holder !== e.to.holder && lord(e.to.holder)) tally.gained++;
    if (e.from.holder !== e.to.holder && lord(e.from.holder)) tally.lost++;
  });
  const record = CL.news.record;
  CL.news.record = (cc, kind, ...rest) => {
    if (kind === 'lord_grumbles') tally.grumbled++;
    if (kind === 'summons_refused') tally.refused++;
    return record.call(CL.news, cc, kind, ...rest);
  };
  const seen = new Set();
  const timeline = [];
  // P8-T: who held land at the start, to see who won it and who lost it all.
  const startLand = Object.fromEntries(Object.keys(c.people).filter((id) => !CL.realm.rules(id, c)).map((id) => [id, CL.realm.fiefsOf(id, c).length]));
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
  // Friendships, rivalries and feuds between lords, read from what happened.
  const ties = { friend: 0, rival: 0, feud: 0 };
  for (let i = 0; i < lords.length; i++) for (let j = i + 1; j < lords.length; j++) {
    const t = CL.nobles.tie(c, lords[i], lords[j]);
    if (t) ties[t]++;
  }
  // P8-T: landless lords who won land, landed lords who lost it all, and the most of a realm's land
  // one lord holds (no lord gathers a realm's land).
  const won = Object.keys(startLand).filter((id) => !startLand[id] && land(id) > 0).length;
  const wereLandless = Object.values(startLand).filter((n) => !n).length;
  const lostAll = Object.keys(startLand).filter((id) => startLand[id] && !land(id)).length;
  let most = 0;
  for (const f of CL.realm.realms()) {
    const all = Object.values(c.holdings).filter((h) => h.sovereign === f.id).length;
    for (const id of lords) if (c.people[id].realm === f.id && all) most = Math.max(most, land(id) / all);
  }
  const riders = Object.fromEntries(CL.realm.realms().map((f) => [f.id, CL.lords.riders(c).filter((id) => c.people[id].realm === f.id).length]));
  return { seed, days, ...tally, forts: forts(), timeline, lords: lordsBy, ties, riders, won, wereLandless, lostAll, most: Math.round(most * 100) };
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
    const per = (o) => Object.entries(o).map(([f, n]) => `${f} ${n}`).join(', ') || 'none';
    console.log(`  land: ${r.won} of ${r.wereLandless} landless lords won land; ${r.lostAll} landed lords lost it all; the most of a realm's holdings one lord holds: ${r.most}%`);
    console.log(`  nobles: land gained ${r.gained}, lost ${r.lost}; ${r.grumbled} grumbled; left: ${per(r.left)}; joined: ${per(r.joined)}; summonses refused ${r.refused}; revoked ${r.revoked}; friends ${r.ties.friend}, rivals ${r.ties.rival}, feuds ${r.ties.feud}; riding lords: ${per(r.riders)}`);
  }
}
