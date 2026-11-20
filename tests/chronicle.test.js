// The company chronicle and roll of honour (V2-10; design §10.5, §10.8, §21.4, SC-03): soldiers who
// fall, desert or retire are remembered with their history; the company's own story is kept short
// and bounded; the result screen says who did what.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');
const { preHoldings } = require('./helpers/pre-holdings');

const plain = (x) => JSON.parse(JSON.stringify(x));

/** A company in Stonebridge (which hires Levies) with money to spend. */
function company(opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  c.gold = 2000;
  return { ...env, c };
}

/** Commit a fought battle's outcome through the one result path. */
function battle(CL, c, { win = true, kills = 3, killed = [], wounded = [], soldierKills = {} } = {}) {
  CL.encounter.begin(c);
  return CL.encounter.resolve(c, {
    kind: 'battle',
    outcome: { battleId: c.battles + 1, encounterId: 'looter_band', win, kills, killed, wounded, participants: c.roster.map((s) => s.id), soldierKills },
  });
}

test('§10.8 / SC-03: a soldier’s history survives save and reload, and when they fall the roll of honour keeps it', () => {
  const storage = memoryStorage();
  const { CL, c } = company({ storage });
  assert.equal(CL.party.recruit('levy'), true);
  const s = c.roster[0];
  const id = s.id;
  for (let i = 0; i < 3; i++) battle(CL, c, { soldierKills: { [id]: 2 } });
  s.xp = 60;
  assert.equal(CL.party.upgradeSoldier(c, id, CL.party.upgradeOptions('levy')[0].to), true);
  battle(CL, c, { wounded: [id] });
  CL.party.advanceDays(8); // payday: wages actually paid
  assert.equal(CL.save.write(), true);
  const back = loadGame({ storage }).CL.campaign.roster.find((x) => x.id === id);
  assert.equal(back.name, s.name);
  assert.equal(back.origin, 'stonebridge');
  assert.equal(back.record.battles, 4);
  assert.equal(back.record.kills, 6);
  assert.equal(back.record.wounds, 1);
  assert.ok(back.record.wagesPaid > 0);
  // Now they fall, felling one more on the way.
  const before = plain(s.record);
  battle(CL, c, { win: false, killed: [id], soldierKills: { [id]: 1 } });
  assert.equal(c.roster.some((x) => x.id === id), false);
  const h = c.honour.list.at(-1);
  assert.equal(h.name, s.name);
  assert.equal(h.how, 'fell');
  assert.equal(h.origin, 'stonebridge');
  assert.equal(h.battles, before.battles + 1, 'their last battle counts');
  assert.equal(h.kills, before.kills + 1);
  assert.equal(h.wounds, before.wounds);
  assert.equal(h.wagesPaid, before.wagesPaid);
  assert.equal(h.foe, 'Looter Band');
  assert.equal('hp' in h || 'x' in h || 'notes' in h, false, 'a summary, not the live soldier');
  const fell = c.chronicle.at(-1);
  assert.equal(fell.kind, 'battle');
  assert.equal(JSON.stringify(fell.fallen), JSON.stringify([s.name]));
  assert.match(CL.chronicle.text(fell), new RegExp(`^Defeat against the Looter Band: 3 enemies defeated\\. Fallen: ${s.name}\\.$`));
  assert.match(CL.chronicle.honourText(h).line, /^Fell fighting the Looter Band on day \d+ · served \d+ days · 5 battles · 7 kills · 1 wound · \d+ crowns paid$/);
});

test('the chronicle keeps notable things only, and folds same-day recruits and promotions into one line', () => {
  const { CL, c } = company();
  for (let i = 0; i < 3; i++) CL.party.recruit('levy');
  const rec = c.chronicle.at(-1);
  assert.equal(rec.kind, 'recruited');
  assert.equal(rec.n, 3);
  assert.match(CL.chronicle.text(rec), / joined the company at Stonebridge\.$/);
  const n = c.chronicle.length;
  battle(CL, c, { kills: 3 }); // an ordinary win
  assert.equal(c.chronicle.length, n, 'not worth a line');
  battle(CL, c, { kills: CL.chronicle.NOTABLE_KILLS }); // a big one
  battle(CL, c, { win: false }); // any defeat
  assert.equal(JSON.stringify(c.chronicle.slice(-2).map((e) => [e.kind, e.win])), JSON.stringify([['battle', true], ['battle', false]]));
  for (const s of c.roster) s.xp = 60;
  assert.equal(CL.party.upgrade('levy', CL.party.upgradeOptions('levy')[0].to), 3);
  const pro = c.chronicle.at(-1);
  assert.equal(pro.kind, 'promoted');
  assert.equal(pro.n, 3);
  assert.match(CL.chronicle.text(pro), / were promoted to /);
});

test('deserters and the retired are remembered too; retiring asks nothing of a battle in progress', () => {
  const { CL, c } = company();
  CL.party.recruit('levy');
  CL.party.recruit('levy');
  const [a, b] = c.roster;
  c.morale = 0;
  let deserted = null;
  for (let day = 0; day < 40 && !deserted; day++) deserted = CL.upkeep.desertionCheck?.(c) || null;
  assert.ok(deserted, 'at zero morale someone slips away');
  assert.equal(c.honour.list.at(-1).how, 'deserted');
  assert.equal(c.honour.list.at(-1).name, deserted.name);
  assert.equal(c.chronicle.at(-1).kind, 'deserted');
  const stay = c.roster[0];
  CL.game.mode = 'battle';
  assert.equal(CL.party.retireSoldier(c, stay.id), null, 'not mid-battle');
  CL.game.mode = 'map';
  assert.equal(CL.party.retireSoldier(c, stay.id).id, stay.id);
  assert.equal(c.roster.includes(stay), false);
  const h = c.honour.list.at(-1);
  assert.equal(h.how, 'retired');
  assert.equal(CL.chronicle.honourText(h).line.startsWith('Retired with honour on day'), true);
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), `${stay.name} retired from the company with honour.`);
  assert.ok(a && b);
});

test('story milestones go in the chronicle', () => {
  const { CL, c } = company();
  CL.story.start(c, 'q1');
  CL.story.finish(c, 'q1', 'done');
  const e = c.chronicle.at(-1);
  assert.equal(e.kind, 'quest');
  assert.match(CL.chronicle.text(e), /^Completed: .+\.$/);
});

test('bounded: the chronicle keeps its first line and the newest; the roll keeps the newest and counts the rest', () => {
  const { CL, c } = company();
  for (let i = 0; i < CL.chronicle.CHRONICLE_MAX + 20; i++) CL.chronicle.add(c, { day: i, kind: 'deserted', id: i, name: `N${i}` });
  assert.equal(c.chronicle.length, CL.chronicle.CHRONICLE_MAX);
  assert.equal(c.chronicle[0].kind, 'founded');
  assert.equal(c.chronicle.at(-1).name, `N${CL.chronicle.CHRONICLE_MAX + 19}`);
  const s = CL.save.addSoldier(c, 'levy');
  for (let i = 0; i < CL.chronicle.HONOUR_MAX + 5; i++) CL.chronicle.honour(c, s, i % 2 ? 'fell' : 'deserted');
  assert.equal(c.honour.list.length, CL.chronicle.HONOUR_MAX);
  assert.equal(c.honour.earlier.deserted + c.honour.earlier.fell, 5);
});

test('saves: junk entries are dropped, a round trip is stable, and an older save starts its chronicle on migration', () => {
  const { CL, c } = company();
  CL.party.recruit('levy');
  CL.party.retireSoldier(c, c.roster[0].id);
  const d = plain(c);
  d.chronicle.push({ kind: 'nonsense', day: 1 }, { kind: 'battle', day: -4 }, { kind: 'promoted', day: 2, to: 'dragon' });
  d.honour.list.push({ how: 'vanished', troop: 'levy', left: 1 }, { how: 'fell', troop: 'unicorn', left: 1 });
  const s = CL.save.sanitize(d);
  assert.equal(s.chronicle.length, c.chronicle.length);
  assert.equal(s.honour.list.length, 1);
  assert.equal(JSON.stringify(CL.save.sanitize(plain(s))), JSON.stringify(s));
  const v6 = plain(c);
  v6.version = 6;
  preHoldings(v6);
  delete v6.chronicle;
  delete v6.honour;
  v6.day = 12.5;
  const v7 = CL.save.MIGRATIONS[6](v6);
  assert.equal(v7.version, 7);
  assert.equal(JSON.stringify(v7.chronicle), JSON.stringify([{ day: 12.5, kind: 'begun' }]));
  assert.equal(v7.honour.list.length, 0);
  assert.equal(CL.save.check(v7).problems.length, 0);
});

test('who did what: the result screen names the hero’s tally and the soldiers who stood out', () => {
  const { CL, c } = company();
  for (const t of ['footman', 'footman', 'hunter']) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  g.hero.kills = 2;
  Object.assign(g.allies[0], { kills: 1, assists: 2 });
  Object.assign(g.allies[2], { kills: 3 });
  const names = Object.fromEntries(c.roster.map((s) => [s.id, s.name]));
  const lines = CL.chronicle.standouts(g, names);
  assert.equal(JSON.stringify(lines), JSON.stringify(['You felled 2', `${names[g.allies[2].soldierId]} 3 felled`, `${names[g.allies[0].soldierId]} 1 felled, 2 helped down`]));
  for (const e of g.enemies) e.alive = false;
  g.kills = 2;
  CL.combat.update(0.05);
  assert.match(g.result.html, /Who did what: You felled 2 · /);
});
