// P7-06: more companions. Three companions of the wider world (Sigrun, Iacopo, Livia), each in their own
// land, join after an errand of their own; they take a slot, eat, are paid, fight beside the hero (wounded,
// never killed), lend a skill and can captain a patrol. Loyalty moves only for reasons you can see (pay,
// victories and defeats, their motive); unhappy, they warn you and say why, and only after that they leave.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company with money and soldiers, standing in a settlement. */
function camp(at = 'hrothgard', opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.gold = 800;
  c.food = 100;
  c.roster = [];
  for (const t of ['axeman', 'axeman', 'clansman', 'fell_archer', 'fell_archer']) CL.save.addSoldier(c, t, null, { origin: 'hrothgard' });
  go(CL, c, at);
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, R: CL.retinue, messages };
}
function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
/** Talk to someone and pick options by text, in order. */
function say(CL, who, ...picks) {
  let v = CL.story.talk(who);
  for (const p of picks) {
    const o = v?.options.find((x) => p.test(x.text));
    assert.ok(o, `${who}: no option ${p} in ${JSON.stringify(v?.options.map((x) => x.text))}`);
    v = CL.story.choose(v, o.index);
  }
  return v;
}
function beat(CL, c, tag) {
  const band = c.parties.find((p) => p.questTag === tag);
  assert.ok(band, `${tag} on the map`);
  Object.assign(c.world, { x: band.x, y: band.y, location: null });
  CL.parties.open(band.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
}

test('each lives in their own land and is met there; content checks out', () => {
  const { CL } = camp();
  for (const [id, place] of [
    ['sigrun', 'hrothgard'],
    ['iacopo', 'vessara'],
    ['livia', 'tessaro'],
  ]) {
    assert.equal(CL.retinue.def(id).home, place);
    assert.ok(CL.story.peopleAt(place).some((t) => t.id === id), `${id} in ${place}`);
  }
  assert.equal(CL.retinue.def('mara'), null, 'Mara is the story’s companion, not one of these');
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('joining: Sigrun after her errand; she takes a slot, is paid, lends her skill and leaves the tree', () => {
  const { CL, c, R } = camp();
  say(CL, 'sigrun', /ride with my company/, /break them/);
  beat(CL, c, 'sq_sigrun_raiders');
  go(CL, c, 'hrothgard');
  const head = CL.party.headcount(c);
  const wages = CL.quartermaster.wagesDue(c);
  const tactics = CL.character.skill('tactics', c);
  say(CL, 'sigrun', /raiders are broken/, /Ride with us/);
  assert.equal(CL.story.questStatus(c, 'sq_sigrun'), 'done');
  assert.deepEqual(plain(R.list(c).map((m) => m.id)), ['sigrun']);
  assert.equal(CL.party.headcount(c), head + 1);
  assert.equal(CL.quartermaster.wagesDue(c), wages + R.def('sigrun').wage);
  assert.equal(CL.character.skill('tactics', c), tactics + 1);
  assert.equal(CL.story.peopleAt('hrothgard').some((t) => t.id === 'sigrun'), false, 'no longer waiting in town');
  assert.ok(CL.autoresolve.playerPower(c) > 0);
});

test('Iacopo joins when his debt is paid; nobody joins a full company', () => {
  const { CL, c, R } = camp('vessara');
  say(CL, 'iacopo', /keep my company/, /settle it/);
  const gold = c.gold;
  say(CL, 'iacopo', /120 crowns/, /Welcome/);
  assert.equal(c.gold, gold - 120);
  assert.ok(R.find(c, 'iacopo'));
  // A full company: the offer waits.
  const full = camp('tessaro');
  while (full.CL.party.headcount(full.c) < full.CL.party.partyCap(full.c)) full.CL.save.addSoldier(full.c, 'levy');
  full.CL.story.state(full.c).quests.sq_livia = { status: 'active', stage: 'sq_livia_report' };
  const v = say(full.CL, 'livia', /deserters are broken/);
  assert.deepEqual(plain(v.options.map((o) => o.text)), ['My company is full. Wait for me.', 'Not yet.']);
  assert.equal(full.R.join(full.c, 'livia'), false);
});

test('battle: they fight beside you; down, they are wounded, never killed, and heal', () => {
  const { CL, c, R } = camp();
  R.join(c, 'sigrun');
  CL.world.leaveSettlement();
  CL.combat.startBattle({ id: 't', name: 't', map: 'open_country', waves: [{ looter: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const u = CL.game.allies.find((a) => a.companion === 'sigrun');
  assert.ok(u, 'deployed');
  u.alive = false;
  u.hp = 0;
  CL.debugTools.endBattleNow(true);
  const m = R.find(c, 'sigrun');
  assert.ok(m, 'still with you');
  assert.notEqual(m.woundedUntil, null, 'wounded');
  assert.equal(R.fighters(c).length, 0, 'not in the next battle');
  CL.party.advanceDays(R.def('sigrun').woundDays + 0.1);
  assert.equal(m.woundedUntil, null, 'healed');
});

test('loyalty: pay and victories raise it, their motive moves it, and every change has its reason', () => {
  const { c, R } = camp();
  R.join(c, 'sigrun');
  R.join(c, 'iacopo');
  R.join(c, 'livia');
  const L = () => Object.fromEntries(R.list(c).map((m) => [m.id, m.loyalty]));
  const before = L();
  R.payday(c);
  const paid = L();
  assert.equal(paid.sigrun, before.sigrun + R.PAID);
  assert.equal(paid.iacopo, before.iacopo + R.PAID + R.def('iacopo').loyalty.likes.paid, 'Iacopo likes a wage on time');
  R.onEvent(c, 'toll_paid');
  assert.equal(L().sigrun, paid.sigrun + R.def('sigrun').loyalty.dislikes.toll_paid, 'Sigrun hates paying Reavers');
  assert.equal(L().livia, paid.livia, 'Livia does not mind a toll');
  const mid = L();
  R.afterBattle(c, { win: true, down: [], foe: 'patrol', attacked: true });
  assert.equal(L().livia, mid.livia + R.WIN + R.def('livia').loyalty.dislikes.kingdom_attacked, 'Livia hates attacks on a kingdom');
  assert.equal(R.find(c, 'livia').why, 'kingdom_attacked');
  R.afterBattle(c, { win: true, down: [], foe: 'bandit', attacked: false });
  assert.equal(R.mood({ loyalty: 80 }), 'loyal');
  assert.equal(R.mood({ loyalty: 20 }), 'unhappy');
});

test('leaving: warned first, saying why; then gone for good, never without warning', () => {
  const { CL, c, R, messages } = camp('vessara');
  R.join(c, 'iacopo');
  const m = R.find(c, 'iacopo');
  m.loyalty = R.WARN_BELOW + 5;
  c.gold = 0;
  c.accounts.chest = 0;
  R.payday(c); // unpaid: well below the warning line, and below the leaving line too
  assert.ok(m.loyalty < R.LEAVE_BELOW, `loyalty ${m.loyalty}`);
  assert.ok(R.find(c, 'iacopo'), 'not gone without a warning first');
  assert.equal(m.warned, true);
  assert.match(messages().find((t) => /unhappy/.test(t)), /^Iacopo [^:]*is unhappy: their wage did not come/);
  R.onEvent(c, 'unpaid');
  assert.ok(R.find(c, 'iacopo'), 'not on the day of the warning');
  c.day += 7;
  R.payday(c);
  assert.equal(R.find(c, 'iacopo'), null, 'gone');
  assert.match(messages().at(-1), /^Iacopo [^:]*has left the company: their wage did not come, after warning you\./);
  assert.ok(CL.story.state(c).flags.iacopo_gone);
  assert.equal(R.joinBlocked(c, 'iacopo'), 'gone for good');
  assert.equal(R.join(c, 'iacopo'), false, 'they do not come back');
});

test('a companion of the retinue can captain a patrol; leaving while out, the patrol heads home', () => {
  const { CL, c, R } = camp();
  R.join(c, 'sigrun');
  const D = CL.detachments;
  assert.ok(D.captains(c).some((k) => k.kind === 'companion' && k.id === 'sigrun'));
  const head = CL.party.headcount(c);
  const r = D.send(c, { captain: { kind: 'companion', id: 'sigrun' }, soldierIds: c.roster.slice(0, 2).map((s) => s.id) });
  assert.equal(r.ok, true, r.reason);
  assert.equal(R.find(c, 'sigrun').detached, r.detachment.id);
  assert.equal(CL.party.headcount(c), head, 'still takes her slot');
  assert.equal(R.fighters(c).length, 0, 'not in your battles while she leads');
  assert.match(D.captainName(c, r.detachment), /^Sigrun/);
  assert.ok(D.power(c, r.detachment) > 0);
  // Saved and loaded mid-patrol: she still leads it.
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.retinue[0].detached, r.detachment.id);
  assert.deepEqual(plain(back.detachments[0].captain), { kind: 'companion', id: 'sigrun' });
  // She leaves: the patrol turns home without her.
  R.leave(c, 'sigrun', 'test');
  assert.equal(r.detachment.status, 'returning');
  assert.deepEqual(plain(r.detachment.captain), { kind: 'none', id: null });
});

test('saves: kept; junk repaired; the gone stay gone; a v14 save migrates to v15', () => {
  const storage = memoryStorage();
  const { CL, c, R } = camp('hrothgard', { storage });
  R.join(c, 'sigrun');
  R.find(c, 'sigrun').loyalty = 42;
  CL.save.write();
  const loaded = loadGame({ storage }).CL.campaign;
  assert.deepEqual(plain(loaded.retinue.map((m) => [m.id, m.loyalty])), [['sigrun', 42]]);
  const junk = plain(c);
  junk.retinue = [{ id: 'sigrun', loyalty: 900, unpaid: -3, equipment: { weapon: 'nope' }, why: 'bogus' }, { id: 'sigrun' }, { id: 'mara' }, { id: 'nobody' }, null, { id: 'livia' }];
  CL.story.state(c).flags.livia_gone = 'test';
  junk.story = plain(CL.story.state(c));
  const r = CL.save.fromRaw(junk).campaign.retinue;
  assert.deepEqual(plain(r.map((m) => m.id)), ['sigrun'], 'no duplicates, unknowns, Mara or the gone');
  assert.equal(r[0].loyalty, 100);
  assert.equal(r[0].unpaid, 0);
  assert.equal(r[0].equipment.weapon, null);
  assert.equal(r[0].why, null);
  const v14 = plain(c);
  v14.version = 14;
  delete v14.retinue;
  const m = CL.save.fromRaw(v14);
  assert.equal(m.campaign.version, 15);
  assert.deepEqual(plain(m.campaign.retinue), []);
});
