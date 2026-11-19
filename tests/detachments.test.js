// P7-05: officers and detached patrols (SC-17, SC-18). A captain leads part of the company away with an
// order; each soldier is in exactly one party; it fights by the world's rules and reports; it turns back
// for its reasons; meeting the company it rejoins it, everything reconciled once; beaten, its captain
// comes back wounded with the survivors. Saves mid-order, pay and desertion, and Q3's call on the companion.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company in Stonebridge with a veteran guard (tier 3, 12 battles) and six others, food and crowns. */
function company(opts = {}) {
  const env = loadGame(opts);
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of ['guard', 'footman', 'footman', 'footman', 'hunter', 'hunter', 'levy']) CL.save.addSoldier(c, t);
  c.roster[0].record.battles = 12;
  c.gold = 500;
  c.food = 100;
  return { ...env, c, D: CL.detachments, vet: c.roster[0] };
}

/** Every soldier ID in the company and its detachments: each in exactly one party. */
function everyone(c) {
  return [...c.roster.map((s) => s.id), ...c.detachments.filter((d) => d.status !== 'back').flatMap((d) => d.soldiers.map((s) => s.id))];
}

function sendHunt(_CL, c, D, vet, ids, extra = {}) {
  return D.send(c, { captain: { kind: 'soldier', id: vet.id }, soldierIds: ids, order: { objective: 'hunt', days: 5, ...extra } });
}

test('captains: a veteran of tier 3 with 10 battles, or a fit companion; nobody else', () => {
  const { CL, c, D, vet } = company();
  assert.deepEqual(plain(D.captains(c).map((k) => k.id)), [vet.id]);
  vet.record.battles = 9;
  assert.deepEqual(plain(D.captains(c)), []);
  vet.record.battles = 10;
  vet.woundedUntil = c.day + 1;
  assert.deepEqual(plain(D.captains(c)), [], 'not while wounded');
  vet.woundedUntil = null;
  c.companion = { id: 'mara', woundedUntil: null, equipment: {} };
  assert.deepEqual(plain(D.captains(c).map((k) => k.kind)), ['companion', 'soldier']);
  assert.equal(CL.companion.fit(c), true);
});

test('sending: the soldiers leave the company for the detachment (each in exactly one party), with food and pay', () => {
  const { CL, c, D, vet } = company();
  const before = everyone(c).sort();
  const headcount = CL.party.headcount(c);
  const [food, money] = [c.food, c.gold + c.accounts.chest];
  const ids = c.roster.slice(1, 4).map((s) => s.id);
  const r = sendHunt(CL, c, D, vet, ids);
  assert.equal(r.ok, true, r.reason);
  const d = r.detachment;
  assert.deepEqual(plain(d.soldiers.map((s) => s.id)).sort(), [vet.id, ...ids].sort());
  assert.equal(c.roster.some((s) => s.id === vet.id || ids.includes(s.id)), false, 'gone from the company');
  assert.deepEqual(everyone(c).sort(), before, 'nobody lost, nobody twice');
  assert.equal(CL.party.headcount(c), headcount, 'they still take their places in the party cap');
  assert.ok(d.food > 0 && c.food === food - d.food);
  assert.ok(d.purse > 0 && c.gold + c.accounts.chest === money - d.purse);
  assert.equal(CL.accounts.balance(c, D.ACCOUNT), d.purse);
  const p = D.partyOf(c, d);
  assert.ok(p && p.detachment === d.id);
  assert.deepEqual(plain(p.troops), { guard: 1, footman: 3 });
  assert.equal(CL.sight.playerSees(c, p), true, 'your own always show');
  // Wounded soldiers stay home; a captain must be one of yours.
  c.roster[0].woundedUntil = c.day + 1;
  assert.equal(D.send(c, { captain: { kind: 'soldier', id: c.roster[1].id }, soldierIds: [c.roster[0].id] }).ok, false);
});

test('a hunt: it rides out, fights a band in its area by the world’s rules, and records it once (Prototype C)', () => {
  const { CL, c, D, vet } = company();
  const ids = c.roster.slice(1, 5).map((s) => s.id);
  const d = sendHunt(CL, c, D, vet, ids).detachment;
  CL.world.leaveSettlement();
  const p = D.partyOf(c, d);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: p.x + 4, y: p.y, troops: { looter: 3 }, tx: null, ty: null });
  const battles = d.soldiers.map((s) => s.record.battles);
  for (let i = 0; i < 40 && c.parties.includes(band) && d.tally.battles === 0; i++) {
    CL.parties.tick(c, 0.25);
    c.day += 0.25 / 24;
  }
  assert.equal(d.tally.battles, 1, 'one fight');
  assert.deepEqual(
    d.soldiers.map((s) => s.record.battles),
    battles.slice(0, d.soldiers.length).map((n) => n + 1),
    'each soldier who fought counts it once',
  );
  if (d.tally.won) {
    assert.equal(c.parties.includes(band), false);
    assert.ok(d.purse > 0 && d.tally.spoils > 0);
    assert.ok(d.log.some((e) => /broke/.test(e.text)));
  }
});

test('rejoining: soldiers, purse and food back to the company, exactly once (SC-17)', () => {
  const { CL, c, D, vet } = company();
  const before = everyone(c).sort();
  const d = sendHunt(CL, c, D, vet, c.roster.slice(1, 3).map((s) => s.id)).detachment;
  const [chest, food, purse, rations] = [c.accounts.chest, c.food, d.purse, d.food];
  assert.equal(D.canMeet(c, d), true, 'still at the company’s side');
  assert.equal(D.merge(c, d), true);
  assert.deepEqual(everyone(c).sort(), before);
  assert.equal(c.accounts.chest, chest + purse);
  assert.equal(c.food, food + rations);
  assert.equal(CL.accounts.balance(c, D.ACCOUNT), 0);
  assert.equal(D.partyOf(c, d), null, 'off the map');
  assert.equal(D.merge(c, d), false, 'never twice');
  assert.equal(c.accounts.chest, chest + purse);
  assert.match(d.report, /patrol is back after/);
});

test('beaten: the captain comes back wounded with the survivors, the fallen remembered (SC-18)', () => {
  const { CL, c, D, vet } = company({ random: () => 0.99 });
  const d = sendHunt(CL, c, D, vet, [c.roster[6].id]).detachment; // the guard and a levy
  CL.world.leaveSettlement();
  const p = D.partyOf(c, d);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { troops: { reaver: 12 } });
  c.rngSeed = 7;
  let loser = null;
  for (let tries = 0; tries < 30 && !d.tally.lost; tries++) {
    if (!d.soldiers.length) break;
    const won = d.tally.won;
    loser = D.fight(c, p, band);
    if (d.tally.won > won) {
      d.status = 'out'; // a lucky win: try again for the loss this test is about
      if (!c.parties.includes(band)) c.parties.push(Object.assign(band, { troops: { reaver: 12 } }));
    }
  }
  assert.ok(d.tally.lost >= 1, 'beaten by twelve reavers');
  if (d.soldiers.length) {
    assert.equal(loser, p);
    assert.equal(d.status, 'returning');
    const cap = d.soldiers.find((s) => s.id === vet.id);
    if (cap) assert.ok(cap.woundedUntil !== null, 'the captain comes back wounded');
    assert.ok(d.log.at(-1).text.includes('beaten'));
  }
  for (const name of d.tally.fallen) assert.ok(c.honour.list.some((h) => h.name === name && h.how === 'fell'), `${name} on the roll of honour`);
});

test('it turns back: when its time is up, when your courier reaches it, out of food, below strength', () => {
  const { CL, c, D, vet } = company();
  const d = sendHunt(CL, c, D, vet, c.roster.slice(1, 5).map((s) => s.id), { days: 2 });
  const det = d.detachment;
  const p = D.partyOf(c, det);
  D.chooseTarget(c, p, c.day + 2.01);
  assert.equal(det.status, 'returning');
  assert.match(det.log.at(-1).text, /time is up/);
  // A courier: it rides at its own speed.
  det.status = 'out';
  Object.assign(p, { x: c.world.x + 12, y: c.world.y });
  const at = D.recall(c, det);
  assert.ok(Math.abs(at - (c.day + 12 / D.COURIER_SPEED / 24)) < 1e-9);
  D.chooseTarget(c, p, at - 0.001);
  assert.equal(det.status, 'out');
  D.chooseTarget(c, p, at);
  assert.equal(det.status, 'returning');
  det.status = 'out';
  det.recallAt = null;
  det.food = 0;
  D.chooseTarget(c, p, c.day);
  assert.match(det.log.at(-1).text, /out of food/);
  det.status = 'out';
  det.food = 5;
  for (const s of det.soldiers.slice(0, 3)) s.woundedUntil = c.day + 2;
  D.chooseTarget(c, p, c.day);
  assert.match(det.log.at(-1).text, /too few of us fit/);
  // Returning, it rides to the company and rejoins it on meeting.
  Object.assign(p, { x: c.world.x + 1, y: c.world.y });
  D.step(c);
  assert.equal(det.status, 'back');
});

test('pay and desertion are its own: wages from its purse; unpaid, one soldier slips away', () => {
  const { CL, c, D, vet } = company();
  const d = sendHunt(CL, c, D, vet, c.roster.slice(1, 4).map((s) => s.id)).detachment;
  const purse = d.purse;
  const owed = d.soldiers.reduce((n, s) => n + CL.content.troop(s.troop).wage, 0);
  D.payday(c);
  assert.equal(d.purse, purse - owed);
  d.purse = 0;
  CL.accounts.transfer(c, D.ACCOUNT, CL.accounts.WORLD, CL.accounts.balance(c, D.ACCOUNT), 'test');
  const n = d.soldiers.length;
  D.payday(c);
  assert.equal(d.soldiers.length, n - 1);
  assert.ok(d.soldiers.some((s) => s.id === vet.id), 'not the captain');
  assert.equal(d.status, 'returning');
  assert.equal(c.honour.list.at(-1).how, 'deserted');
});

test('the companion as captain; when the story sends her (Q3), she is called back from her patrol first', () => {
  const { CL, c, D } = company();
  c.companion = { id: 'mara', woundedUntil: null, equipment: {} };
  const r = D.send(c, { captain: { kind: 'companion', id: 'mara' }, soldierIds: c.roster.slice(0, 3).map((s) => s.id) });
  assert.equal(r.ok, true, r.reason);
  assert.equal(c.companion.detached, r.detachment.id);
  assert.equal(CL.companion.fit(c), false, 'not in your battles while she leads');
  CL.story.apply([{ send: 'mara' }], c, {});
  assert.equal(c.companion.detached, undefined);
  assert.equal(c.companion.away, true, 'sent ahead by the story');
  assert.equal(r.detachment.status, 'returning', 'the patrol heads home without her');
});

test('saves: mid-order, every soldier still in exactly one party, records and the map party kept; junk repaired', () => {
  const storage = memoryStorage();
  const { CL, c, D, vet } = company({ storage });
  const d = sendHunt(CL, c, D, vet, c.roster.slice(1, 4).map((s) => s.id)).detachment;
  d.soldiers[1].record.kills = 3;
  CL.save.write();
  const back = CL.save.fromRaw(JSON.parse(storage.data[CL.save.KEY])).campaign;
  assert.deepEqual(everyone(back).sort(), everyone(c).sort());
  const bd = back.detachments[0];
  assert.equal(bd.soldiers[1].record.kills, 3);
  assert.ok(back.parties.some((p) => p.detachment === bd.id));
  assert.equal(back.accounts.budgets.detachments, d.purse);
  assert.ok(back.nextSoldierId > Math.max(...everyone(back)));
  // A soldier in both the company and a detachment (a hand-edited save) keeps only one place.
  const raw = plain(c);
  raw.roster.push(plain(raw.detachments[0].soldiers[0]));
  const fixed = CL.save.fromRaw(raw).campaign;
  assert.equal(new Set(everyone(fixed)).size, everyone(fixed).length);
  // A detachment's party lost from the save is made again at the company.
  const lost = plain(c);
  lost.parties = lost.parties.filter((p) => p.detachment == null);
  assert.ok(CL.save.fromRaw(lost).campaign.parties.some((p) => p.detachment === d.id));
  // v13 → v14.
  const v13 = plain(c);
  v13.version = 13;
  delete v13.detachments;
  assert.deepEqual(plain(CL.save.fromRaw(v13).campaign.detachments), []);
});

test('a patrol hunts for a week in a living world and comes back with consistent records', () => {
  const { CL, c, D, vet } = company({ worldParties: true });
  const start = everyone(c).length;
  const ids = c.roster.slice(1, 6).map((s) => s.id);
  const d = sendHunt(CL, c, D, vet, ids, { days: 7 }).detachment;
  const battlesBefore = new Map([vet, ...c.roster, ...d.soldiers].map((s) => [s.id, s.record.battles]));
  c.food = 200;
  for (let day = 0; day < 9 && d.status !== 'back'; day++) CL.party.advanceDays(1);
  assert.equal(d.status, 'back', 'back by its day, or sooner');
  const t = d.tally;
  assert.equal(everyone(c).length + t.fallen.length + t.deserted, start, 'every soldier accounted for');
  for (const s of c.roster) assert.ok(s.record.battles - (battlesBefore.get(s.id) || 0) <= t.battles, `${s.name}: no fight counted twice`);
  assert.equal(CL.accounts.balance(c, D.ACCOUNT), 0, 'every crown back in the chest');
  assert.ok(d.log.length >= 7, 'a report a day at least');
  assert.match(d.report, /patrol is back after/);
});
