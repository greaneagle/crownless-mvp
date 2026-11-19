// P7-01: the surgeon. Triage after every battle, fought or auto-resolved: one roll per fallen soldier
// as before, a lower line for death, one medicine per life saved (a few saved without); faster healing;
// medicine bought at markets and kept in stock by the quartermaster; wages, capture and saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company of five in Stonebridge (a town with a market), with crowns to spare. */
function company(opts = {}) {
  const env = loadGame(opts);
  const c = env.CL.campaign;
  c.gold = 1000;
  return { ...env, c };
}

test('triage: without a surgeon below 0.35 dies; with one, 0.22–0.35 is saved with medicine, 0.30–0.35 without', () => {
  const { CL, c } = company();
  const S = CL.surgeon;
  const fallen = [0.1, 0.25, 0.32, 0.34, 0.5].map((roll, i) => ({ id: i + 1, roll }));
  assert.deepEqual(plain(S.triage(c, fallen)), { killed: [1, 2, 3, 4], wounded: [5], saved: [], medicineUsed: 0 });
  assert.ok(S.hire(c));
  c.medicine = 2;
  assert.deepEqual(plain(S.triage(c, fallen)), { killed: [1], wounded: [2, 3, 4, 5], saved: [2, 3, 4], medicineUsed: 2 }, 'the third saved needs no medicine (0.34)');
  c.medicine = 0;
  assert.deepEqual(plain(S.triage(c, fallen)), { killed: [1, 2], wounded: [3, 4, 5], saved: [3, 4], medicineUsed: 0 });
  assert.equal(c.medicine, 0, 'triage only counts; the result spends');
});

test('deaths measured: about 35 in 100 of the fallen die without a surgeon, about 22 with medicine, about 30 without', () => {
  const { CL, c } = company();
  const S = CL.surgeon;
  const fallen = Array.from({ length: 600 }, (_, i) => ({ id: i, roll: CL.autoresolve.roll(c, 'casualties') }));
  const rate = () => S.triage(c, fallen).killed.length / fallen.length;
  const none = rate();
  S.hire(c);
  c.medicine = 99;
  const doc = S.triage(c, fallen);
  const withMed = doc.killed.length / fallen.length;
  c.medicine = 0;
  const bare = rate();
  assert.ok(Math.abs(none - 0.35) < 0.04 && Math.abs(withMed - 0.22) < 0.04 && Math.abs(bare - 0.3) < 0.04, `${none} ${withMed} ${bare}`);
  assert.ok(doc.medicineUsed < 99, 'enough medicine for all of them');
  assert.equal(doc.medicineUsed, Math.min(99, doc.saved.length));
});

test('one roll per fallen soldier, surgeon or not: the casualties stream moves on exactly as before', () => {
  const draws = (hire) => {
    const { CL, c } = company({ seed: 7 });
    if (hire) {
      CL.surgeon.hire(c);
      c.medicine = 5;
    }
    const allies = c.roster.map((s) => ({ soldierId: s.id, alive: false, routed: false }));
    const out = CL.party.rollCasualties(allies, c);
    return { stream: c.rng.casualties, fallen: out.killed.length + out.wounded.length };
  };
  const a = draws(false);
  const b = draws(true);
  assert.equal(a.stream, b.stream);
  assert.equal(a.fallen, b.fallen);
});

test('the result commits once: medicine spent once, the saved named, faster healing, the surgeon’s tally', () => {
  const { CL, c } = company();
  const S = CL.surgeon;
  S.hire(c);
  c.medicine = 3;
  const [a, b] = c.roster;
  const outcome = { battleId: c.battles + 1, encounterId: 'looter_band', win: true, kills: 3, killed: [], wounded: [a.id, b.id], saved: [a.id, b.id], medicineUsed: 2 };
  CL.party.applyBattleResult(c, outcome);
  assert.equal(c.medicine, 1);
  assert.ok(Math.abs(a.woundedUntil - (c.day + 1.5)) < 1e-9, 'a day and a half');
  assert.equal(S.get(c).saved, 2);
  assert.equal(CL.party.applyBattleResult(c, outcome), null, 'never twice');
  assert.equal(c.medicine, 1);
  const html = CL.party.resultHtml({ win: true, r: { gold: 0, renown: 0, loot: {}, xp: null }, kills: 3, killed: [], wounded: [a.id], saved: [a.id], medicineUsed: 1, survivors: 4, names: { [a.id]: a.name } });
  assert.match(html, new RegExp(`Surgeon .+ saved ${a.name} \\(1 medicine used, 1 left\\)`));
  assert.match(html, /can't fight until day/);
});

test('auto-resolve uses the same triage', () => {
  const lost = (hire, seed) => {
    const { CL, c } = company({ seed });
    c.roster = [];
    for (let i = 0; i < 12; i++) CL.save.addSoldier(c, 'levy');
    if (hire) {
      CL.surgeon.hire(c);
      c.medicine = 20;
    }
    c.world.location = null;
    CL.game.mode = 'map';
    const p = CL.parties.spawn(c, 'bandits');
    Object.assign(p, { troops: { reaver: 9 }, x: c.world.x, y: c.world.y });
    CL.parties.open(p.id);
    const before = c.roster.length;
    CL.parties.autoResolve();
    return { dead: before - c.roster.length, medicine: c.medicine, html: CL.game.result.html };
  };
  let [dead, deadDoc] = [0, 0];
  let named = false;
  for (let seed = 1; seed <= 30; seed++) {
    dead += lost(false, seed).dead;
    const d = lost(true, seed);
    deadDoc += d.dead;
    named ||= /Surgeon .+ saved/.test(d.html);
  }
  assert.ok(deadDoc < dead * 0.8, `${deadDoc} dead with a surgeon against ${dead} without`);
  assert.ok(named, 'the auto-resolve result names the saved too');
});

test('hired in towns only; wages with the rest; unpaid twice, they leave', () => {
  const { CL, c } = company();
  const S = CL.surgeon;
  c.world.location = 'oakford'; // a village
  assert.equal(S.canHire(c), false);
  c.world.location = 'stonebridge';
  const gold = c.gold;
  assert.ok(S.hire(c));
  assert.equal(c.gold, gold - S.HIRE);
  assert.equal(CL.quartermaster.wagesDue(c), CL.upkeep.weeklyWages(c) + S.WAGE);
  c.gold = 0;
  c.accounts.chest = 0;
  S.payday(c);
  assert.ok(S.get(c), 'warned');
  S.payday(c);
  assert.equal(S.get(c), null, 'gone');
});

test('medicine: bought at markets, kept in stock by the quartermaster while a surgeon rides with you, half taken by captors', () => {
  const { CL, c } = company();
  const S = CL.surgeon;
  const Q = CL.quartermaster;
  assert.equal(S.buyMedicine(c, 2), true);
  assert.equal(c.medicine, 2);
  assert.equal(c.gold, 1000 - 2 * S.medicinePrice(c));
  c.world.location = 'greywall_fort';
  assert.equal(S.buyMedicine(c, 1), false, 'no market at a fort');
  c.world.location = 'stonebridge';
  // The quartermaster's rule: only while a surgeon rides with the company.
  Q.hire(c);
  c.medicine = 0;
  Q.act(c);
  assert.equal(c.medicine, 0, 'no surgeon: no medicine bought');
  S.hire(c);
  Q.act(c);
  assert.equal(c.medicine, Q.DEFAULTS.medicine);
  assert.ok(Q.get(c).log.some((e) => /medicine/.test(e.text)));
  Q.setRule(c, 'medicine', 99);
  assert.equal(Q.get(c).medicine, Q.LIMITS.medicine[1]);
  c.medicine = 5;
  assert.equal(S.onCapture(c), 3);
  assert.equal(c.medicine, 2);
});

test('saves: the surgeon and the medicine are kept; junk repaired; a v10 save migrates to v11', () => {
  const storage = memoryStorage();
  const { CL, c } = company({ storage });
  CL.surgeon.hire(c);
  c.medicine = 7;
  CL.quartermaster.hire(c);
  CL.quartermaster.setRule(c, 'medicine', 9);
  CL.save.write();
  const back = loadGame({ storage }).CL.campaign;
  assert.equal(back.medicine, 7);
  assert.equal(back.followers.surgeon.name, c.followers.surgeon.name);
  assert.equal(back.followers.quartermaster.medicine, 9);
  const junk = CL.save.sanitize({ ...plain(c), medicine: -4, followers: { ...plain(c.followers), surgeon: { name: '', saved: 3 } } });
  assert.equal(junk.medicine, 0);
  assert.equal(junk.followers.surgeon, null);
  // v10: no surgeon field, no medicine.
  const v10 = plain(c);
  v10.version = 10;
  delete v10.medicine;
  delete v10.followers.surgeon;
  delete v10.followers.quartermaster.medicine;
  const r = CL.save.fromRaw(v10);
  assert.equal(r.campaign.version, 12);
  assert.equal(r.campaign.medicine, 0);
  assert.equal(r.campaign.followers.surgeon, null);
  assert.equal(r.campaign.followers.quartermaster.medicine, CL.quartermaster.DEFAULTS.medicine);
});
