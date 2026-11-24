// P8-06a: the landed world alone. `npm run landed [days=180] [seeds=3]` plays the world with nobody
// in it but its own lords and parties (the company parked in a town, fed and paid), after the story's
// ending, on several seeds,
// and reports wars, sieges begun, lifted, surrendered and stormed; forts per realm over time; grants;
// how many lords are landless, hold one place or several; and the invariants (design §25.3).
// P8-07: the lords' changes of realm (per realm, and the grumbling first), refused summonses,
// revocations, the friendships, rivalries and feuds that formed, land gained and lost, and the
// riding lords each realm has at the end (none may empty).
// P9-L1: lords ransomed by their own (and let go unpaid), men asked and lent between lords, claims
// pressed for land-hungry lords, and sieges they rode to unsummoned.
const { loadGame } = require('../tests/helpers/load');

// P9-08: `world` plays another official world (data/worlds/*.js), as `--world <id>` does.
function run(seed, days = 180, { world } = {}) {
  const { CL } = loadGame({ party: true, worldParties: true, worldEvents: true, seed, world });
  const c = CL.campaign;
  const free = CL.realm.kingdoms(c).find((f) => f.freeCity);
  const s = Object.values(CL.content.table('settlements')).find((x) => x.ownerFaction === free?.id) || CL.content.get('settlements', CL.world.map().start);
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: s.id }); // the free city: out of everyone's way
  CL.game.mode = 'settlement';
  // The sandbox after the story (D-W5: until Q4 ends the March pair is held in tension, and the other
  // kingdoms rarely meet), so its wars can come: the story's ending as the Crown holding Greywall.
  CL.story.state(c).flags.ending ||= CL.realm.realms(c)[0].id;
  const forts = () => {
    const out = {};
    for (const f of CL.realm.realms()) out[f.id] = Object.values(c.holdings).filter((h) => h.kind === 'fort' && h.controller === f.id).length;
    return out;
  };
  const tally = { houses: { married: 0, sought: 0, deaths: 0, heirs: {}, noHeir: 0, contested: 0, restored: 0, refusedRestore: 0, ended: 0 }, army: { raised: 0, sieges: 0, battles: 0, broken: 0, raids: 0, disbanded: {}, capitals: [], gone: [] }, rebel: { factions: 0, answers: {}, risings: 0, ended: {}, civilDays: {} }, founded: [], recognised: 0, treaties: { made: {}, kept: 0, broken: 0, declined: 0, warDays: {}, peaceAll: {} }, loose: { ransomed: 0, letGo: 0, menAsked: 0, menLent: 0, pressed: 0, joined: 0 }, wars: 0, begun: 0, lifted: 0, surrendered: 0, stormed: 0, relieved: 0, abandoned: 0, grants: 0, fell: 0, problems: [], left: {}, joined: {}, grumbled: 0, refused: 0, revoked: 0, gained: 0, lost: 0 };
  // Counted as they happen (the diagnostic log keeps only the latest lines).
  const log = CL.diag.log;
  CL.diag.log = (level, msg, data) => {
    if (msg === 'Siege planned') tally.begun++;
    // P9-05: armies raised, their sieges, battles and raids, and why they broke up.
    if (msg === 'Army raised') tally.army.raised++;
    // P9-06: marriages, deaths and successions by law, restorations.
    if (msg === 'Married') tally.houses.married++;
    if (msg === 'Match sought') tally.houses.sought++;
    if (msg === 'Marriage ended') tally.houses.ended++;
    if (msg === 'Lord died') {
      tally.houses.deaths++;
      if (data.heir) tally.houses.heirs[data.law] = (tally.houses.heirs[data.law] || 0) + 1;
      else tally.houses.noHeir++;
      if (data.contested) tally.houses.contested++;
    }
    if (msg === 'Restored') tally.houses.restored++;
    if (msg === 'Restoration refused') tally.houses.refusedRestore++;
    if (msg === 'Siege by an army') {
      tally.army.sieges++;
      tally.begun++;
    }
    if (msg === 'Army battle') {
      tally.army.battles++;
      if (data.broken) tally.army.broken++;
    }
    if (msg === 'Village raided') tally.army.raids++;
    if (msg === 'Army disbanded') tally.army.disbanded[data.why] = (tally.army.disbanded[data.why] || 0) + 1;
    if (msg === 'Realm gone') tally.army.gone.push(`${data.realm} (day ${Math.floor(c.day)})`);
    if (msg === 'Siege ended' && tally[data?.how] != null) tally[data.how]++;
    // P9-L1
    if (msg === 'Kin ransom') tally.loose[data.amount ? 'ransomed' : 'letGo']++;
    if (msg === 'Men asked') {
      tally.loose.menAsked++;
      if (data.lent) tally.loose.menLent++;
    }
    if (msg === 'Claim pressed' && data.agreed) tally.loose.pressed++;
    if (msg === 'Joins a siege unsummoned') tally.loose.joined++;
    // P9-02: treaties made (by kind), kept to their end, and broken.
    if (msg === 'Treaty signed') tally.treaties.made[data.kind] = (tally.treaties.made[data.kind] || 0) + 1;
    if (msg === 'Treaty ended') tally.treaties.kept++;
    if (msg === 'Treaty broken') tally.treaties.broken++;
    if (msg === 'Ally declines') tally.treaties.declined++;
    // P9-03: realms founded in play, by whom and where, and who recognised them.
    if (msg === 'Realm founded') tally.founded.push(`${data.realm} by ${c.people[data.by]?.name || data.by} at ${data.at} (day ${Math.floor(c.day)})`);
    if (msg === 'Realm recognised') tally.recognised++;
    // P9-04: factions, how they were answered, risings and how they ended.
    if (msg === 'Faction formed') tally.rebel.factions++;
    if (msg === 'Faction answered') tally.rebel.answers[data.response] = (tally.rebel.answers[data.response] || 0) + 1;
    if (msg === 'Rising') tally.rebel.risings++;
    if (msg === 'Rebellion ended') tally.rebel.ended[data.how] = (tally.rebel.ended[data.how] || 0) + 1;
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
    if (e.from.controller !== e.to.controller && c.holdings[e.holding]?.kind === 'town') tally.army.capitals.push(`${e.holding} to ${e.to.controller} (day ${Math.floor(c.day)})`);
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
  // P9-01: each realm's treasury at the start, its lowest, and the end (the books are checked daily, in the invariants).
  const crowns = Object.fromEntries(Object.keys(CL.crowns.ensure(c)).map((f) => [f, { start: CL.crowns.treasury(c, f), low: CL.crowns.treasury(c, f), end: 0 }]));
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
    for (const f of Object.keys(crowns)) crowns[f].low = Math.min(crowns[f].low, CL.crowns.treasury(c, f));
    for (const [k, r] of Object.entries(c.relations)) if (r.state === 'war') tally.treaties.warDays[k] = (tally.treaties.warDays[k] || 0) + 1;
    for (const x of c.rebellions?.list || []) if (x.stage === 'rising') tally.rebel.civilDays[x.realm] = (tally.rebel.civilDays[x.realm] || 0) + 1;
    for (const f of CL.realm.realms()) if (CL.realm.realms().every((g) => g.id === f.id || CL.realm.relation(c, f.id, g.id) === 'peace')) tally.treaties.peaceAll[f.id] = (tally.treaties.peaceAll[f.id] || 0) + 1;
  }
  for (const f of Object.keys(crowns)) crowns[f].end = CL.crowns.treasury(c, f);
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
  return { seed, days, ...tally, forts: forts(), timeline, lords: lordsBy, ties, riders, won, wereLandless, lostAll, most: Math.round(most * 100), crowns };
}

module.exports = { run };

if (require.main === module) {
  const [days = 180, seeds = 3] = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  const w = process.argv.indexOf('--world');
  const world = w > 0 ? process.argv[w + 1] : undefined;
  for (let i = 1; i <= seeds; i++) {
    const r = run(i, days, { world });
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
    const L = r.loose;
    console.log(`  treasuries (start/lowest/end): ${Object.entries(r.crowns).map(([f, t]) => `${f} ${t.start}/${t.low}/${t.end}`).join(', ')}`);
    const T = r.treaties;
    console.log(`  treaties: made ${per(T.made)}; kept to their end ${T.kept}; broken ${T.broken}; allies declining ${T.declined}; days at war per pair: ${per(T.warDays)}; days at peace with all: ${per(T.peaceAll)}`);
    const HS = r.houses;
    console.log(`  houses: ${HS.married} marriages (of ${HS.sought} matches sought), ${HS.ended} ended; ${HS.deaths} deaths, heirs by law: ${per(HS.heirs)}, no heir ${HS.noHeir}, contested ${HS.contested}; restorations ${HS.restored} (refused ${HS.refusedRestore})`);
    const M = r.army;
    console.log(`  armies: ${M.raised} raised, ${M.sieges} sieges laid, ${M.battles} battles (${M.broken} broke an army), ${M.raids} raids; broke up: ${per(M.disbanded)}; capitals taken: ${M.capitals.length ? M.capitals.join('; ') : 'none'}; realms gone: ${M.gone.length ? M.gone.join('; ') : 'none'}`);
    const B = r.rebel;
    console.log(`  rebellion: ${B.factions} factions (answered: ${per(B.answers)}), ${B.risings} risings, ended: ${per(B.ended)}; days of civil war per realm: ${per(B.civilDays)}`);
    console.log(`  realms founded: ${r.founded.length ? r.founded.join('; ') : 'none'}; recognitions ${r.recognised}`);
    console.log(`  loose ends: ${L.ransomed} ransomed by their own, ${L.letGo} let go unpaid; men asked ${L.menAsked}, lent ${L.menLent}; claims pressed ${L.pressed}; sieges joined unsummoned ${L.joined}`);
  }
}
