// P11-15: the battle report. It only counts what combat already does (the golden battles hold that);
// the result screen shows a summary line and the rest under More.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const REWARD = { goldBase: 0, goldPerKill: 0, renown: 0 };

function battle(waves = [{ looter: 4 }], troops = ['footman', 'footman', 'footman', 'hunter', 'hunter']) {
  const env = loadGame({ random: () => 0.5 });
  const { CL } = env;
  const c = CL.campaign;
  c.roster = [];
  for (const t of troops) CL.save.addSoldier(c, t);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves, reward: REWARD });
  return { ...env, c, g: CL.game };
}

test('the hero’s blows, blocks, staggers, shots and hits are counted', () => {
  const { CL, g } = battle();
  const foe = g.enemies[0];
  const r = g.report;
  assert.ok(r, 'a fresh tally each battle');
  CL.combat.hit(foe, 1, g.hero);
  CL.combat.hit(foe, 1, g.hero, true);
  CL.report.onShot(g, g.hero);
  CL.report.onShot(g, g.hero);
  CL.report.onSwing(g, g.hero);
  CL.report.onStagger(g, foe, g.hero);
  g.hero.guard = true;
  g.hero.face = foe.x > g.hero.x ? 'right' : 'left';
  const blocked = CL.combat.hit(g.hero, 1, foe);
  assert.deepEqual({ ...r.hero }, { swings: 1, landed: 1, blocks: blocked === 'blocked' ? 1 : 0, staggers: 1, shots: 2, shotHits: 1, felled: 0 });
  const line = CL.report.heroLine(r.hero);
  assert.match(line, /^You: 1 blow, 1 landed/);
  assert.match(line, /2 shots, 1 hit \(50%\)/);
  assert.equal(CL.report.heroLine({ swings: 0, landed: 0, blocks: 0, staggers: 0, shots: 0, shotHits: 0, felled: 0 }), 'You: no blow struck');
});

test('kills and losses by division, and the notable moments in words', () => {
  const { CL, g } = battle();
  const [foot, foe] = [g.allies.find((u) => u.role === 'infantry'), g.enemies[0]];
  CL.combat.hit(foe, 9999, foot);
  CL.combat.hit(foot, 9999, g.enemies[1]);
  assert.deepEqual({ ...g.report.divs.ally.infantry }, { kills: 1, losses: 1, broke: 0 });
  assert.deepEqual({ ...g.report.divs.enemy.infantry }, { kills: 1, losses: 1, broke: 0 });
  const r = { wallArrows: { ally: 12, enemy: 0 }, braced: { ally: 2, enemy: 1 }, flankRouts: { ally: 0, enemy: 5 } };
  assert.equal(JSON.stringify(CL.report.notable(r)), JSON.stringify(['Your shield wall held against 12 arrows.', 'Your spears stopped 2 charges.', 'Their spears stopped 1 of your charges.', 'Struck in the flank, 5 of them broke and ran.']));
  assert.equal(CL.report.notable({ wallArrows: { ally: 4, enemy: 0 }, braced: { ally: 0, enemy: 0 }, flankRouts: { ally: 1, enemy: 1 } }).length, 0, 'only what stood out');
});

test('a rout soon after a flank blow is a flank that broke them', () => {
  const { CL, g } = battle();
  const [a, b] = g.enemies;
  g.t = 10;
  a.formFlankedAt = 8;
  CL.report.onRout(g, a);
  b.flankedAt = 1;
  CL.report.onRout(g, b);
  assert.equal(g.report.flankRouts.enemy, 1);
  assert.ok(g.report.divs.enemy.infantry.broke >= 1);
});

test('a fought battle ends on the summary line, with More holding the rest', () => {
  const { CL, g } = battle();
  for (let i = 0; i < 30 * 120 && g.mode === 'battle'; i++) CL.combat.update(1 / 30);
  assert.equal(g.mode, 'result');
  const html = g.result.html;
  assert.match(html, /<span class="reportSummary">(Victory|Defeat) in \d+ (s|min \d\d s)\. You lost (no one|\d+ \()[^<]*they lost \d+/);
  assert.match(html, /<details class="reportMore"><summary>▸ More: your divisions, you, who did what<\/summary>/);
  const more = html.slice(html.indexOf('<details'));
  for (const bit of ['Enemies defeated', 'Infantry: ', 'You: ', 'Survivors: ']) assert.ok(more.includes(bit), `${bit} under More`);
  assert.ok(html.indexOf('reportSummary') < html.indexOf('<details'), 'the summary first');
  const r = g.report.divs.ally;
  const felled = Object.values(r).reduce((n, s) => n + s.kills, 0) + g.report.hero.felled;
  assert.ok(felled <= g.kills, 'kills by division and the hero are the battle’s own (a companion’s are not a division’s)');
});

test('the summary in words: time, losses each side', () => {
  const { CL } = battle();
  assert.equal(CL.report.duration(42.4), '42 s');
  assert.equal(CL.report.duration(125), '2 min 05 s');
  assert.equal(CL.report.summary({ win: true, t: 42, fallen: 1, wounded: 3, felled: 28, fled: 12 }), 'Victory in 42 s. You lost 4 (1 fallen, 3 wounded); they lost 40 (12 fled).');
  assert.equal(CL.report.summary({ win: false, t: 61, fallen: 0, wounded: 0, felled: 2, fled: 0 }), 'Defeat in 1 min 01 s. You lost no one; they lost 2.');
});

test('auto-resolve keeps its result screen as it was (no report, nothing folded away)', () => {
  const { CL } = battle();
  const html = CL.party.resultHtml({ win: true, r: { gold: 5, renown: 1, loot: {}, xp: null }, kills: 3, killed: [], wounded: [], survivors: 5, auto: { pp: 2, pe: 1 }, names: {} });
  assert.doesNotMatch(html, /details/);
  assert.match(html, /Enemies defeated: 3/);
});
