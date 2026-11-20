// P7-09: tournaments. Announced on a schedule, an eight-fighter bracket of three bouts, each a duel on
// the battle engine in loaner gear (the hero's own never moved, even across a reload mid-bracket),
// results to the bracket only; fees, prizes and their bounds; the anti-farm rules; the difficulty curve;
// a named rival; saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company in a host town, with crowns, and a tournament open there. */
function lists(at = 'stonebridge', opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.gold = 1000;
  go(CL, c, at);
  const T = CL.tourney;
  c.tourney = T.blank(c.day);
  open(CL, c, at);
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, T, messages };
}
function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
function open(CL, c, sid) {
  const h = c.tourney.hosts[sid];
  h.next = c.day;
  CL.tourney.tick(c);
}
/** Fight the next bout to an end: won or lost. */
function bout(CL, c, win) {
  assert.equal(CL.tourney.fight(c), true, 'a bout to fight');
  assert.equal(CL.game.mode, 'battle');
  CL.debugTools.endBattleNow(win);
  assert.equal(CL.game.mode, 'result');
  assert.ok(CL.game.result.duel);
  return CL.game.result.duel.text;
}

test('content checks out; each host town holds one every two weeks, staggered, told in the news', () => {
  const { CL, c, T } = lists();
  assert.deepEqual(Array.from(CL.content.validate()), []);
  const R = T.rules();
  const fresh = T.blank(0);
  assert.deepEqual(plain(Object.values(fresh.hosts).map((h) => h.next)), plain(R.hosts.map((_, i) => R.first + R.stagger * i)));
  c.tourney = fresh;
  c.news.events = [];
  CL.party.advanceDays(R.first + 0.01);
  assert.deepEqual(plain(T.state(c).open.map((o) => o.host)), ['stonebridge']);
  assert.equal(T.state(c).open[0].fighters.length, 7);
  assert.match(c.news.events.at(-1).text, /^A tournament at Stonebridge: eight fighters on foot\. Entries close on day \d+\.$/);
  CL.party.advanceDays(R.openDays);
  assert.equal(T.openAt(c, 'stonebridge'), null, 'entries closed');
  assert.equal(T.state(c).hosts.stonebridge.next, R.first + R.every);
  // A long wait never announces what is long over, and never loops.
  CL.party.advanceDays(200);
  assert.ok(T.state(c).open.length <= R.hosts.length);
  for (const h of Object.values(T.state(c).hosts)) assert.ok(h.next > c.day);
});

test('fees rise with renown within their bounds; prizes fall with each win in the same town', () => {
  const { c, T } = lists();
  const R = T.rules();
  c.renown = 0;
  assert.equal(T.fee(c), R.fee.min);
  c.renown = 100;
  assert.equal(T.fee(c), R.fee.base + 50);
  c.renown = 100000;
  assert.equal(T.fee(c), R.fee.max);
  const h = T.state(c).hosts.stonebridge;
  const gold = (w) => {
    h.wins = w;
    return T.prizes(c, 'stonebridge').champion.gold;
  };
  assert.deepEqual([0, 1, 2, 3].map(gold), [150, 90, 54, 32]);
  assert.equal(gold(50), Math.round(150 * R.repeat.floor), 'never below the floor');
  h.wins = 0;
  assert.ok(T.prizes(c, 'eastwatch').champion.gold === 150, 'each town counts its own');
});

test('the bracket: three bouts against the right fighters; the champion is paid once, and makes a rival', () => {
  const { CL, c, T, messages } = lists();
  const r = T.enter(c, 'stonebridge');
  assert.equal(r.ok, true, r.reason);
  assert.equal(c.gold, 1000 - T.rules().fee.min);
  const b = T.state(c).bracket;
  assert.deepEqual(plain(b.rounds), [[0, 1, 2, 3, 4, 5, 6, 7]]);
  assert.equal(T.opponentSlot(b), 1, 'first, the one drawn beside you');
  const first = b.fighters[0].name;
  assert.match(bout(CL, c, true), new RegExp(`^You beat ${first} in the first bout\\. Next, the semi-final: `));
  assert.equal(b.rounds[1].length, 4);
  assert.equal(b.rounds[1][0], 0);
  assert.ok([2, 3].includes(b.rounds[1][1]), 'then the winner of the next pair');
  bout(CL, c, true);
  assert.ok([4, 5, 6, 7].includes(b.rounds[2][1]), 'and in the final, one from the other half');
  const finalist = b.fighters[b.rounds[2][1] - 1].name;
  const [gold, renown, rep] = [c.gold, c.renown, CL.realm.score(c, 'valedorn')];
  assert.match(bout(CL, c, true), /^You beat .* in the final! Champion of Stonebridge! 150 crowns and 5 renown\.$/);
  assert.equal(c.gold, gold + 150);
  assert.equal(c.renown, renown + 5);
  assert.equal(CL.realm.score(c, 'valedorn'), rep + T.rules().prize.rep.champion);
  assert.equal(T.state(c).bracket, null);
  assert.equal(T.state(c).hosts.stonebridge.wins, 1);
  assert.equal(T.state(c).rival.name, finalist, 'the finalist you beat swears to beat you');
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), `Won the tournament at Stonebridge, beating ${finalist} in the final.`);
  assert.equal(T.fight(c), false, 'nothing more to fight');
  assert.ok(messages().length > 0);
});

test('losing costs the fee and a little renown, never the company; whoever beat you is your rival', () => {
  const { CL, c, T } = lists();
  c.renown = 10;
  const roster = plain(c.roster);
  T.enter(c, 'stonebridge');
  const foe = T.state(c).bracket.fighters[0];
  const text = bout(CL, c, false);
  assert.match(text, new RegExp(`^${foe.name} beats you in the first bout\\. Out in the first bout: 1 renown lost, and the fee\\. ${foe.name} is your rival now\\.$`));
  assert.equal(c.renown, 9);
  assert.deepEqual(plain(c.roster), roster, 'nobody hurt, nobody lost');
  assert.equal(T.state(c).rival.name, foe.name);
  assert.equal(T.state(c).rival.beatYou, 1);
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), `Fell in the first bout of the tournament at Stonebridge to ${foe.name}.`);
  // Withdrawing between bouts counts as losing the next.
  const o = lists('eastwatch');
  o.T.enter(o.c, 'eastwatch');
  bout(o.CL, o.c, true);
  assert.equal(o.T.withdraw(o.c).ok, true);
  assert.equal(o.T.state(o.c).bracket, null);
  assert.equal(o.c.chronicle.at(-1).result, 'out');
});

test('anti-farm: a cooldown per town, one bracket at a time, and repeat wins soon pay nothing', () => {
  const { CL, c, T } = lists();
  T.enter(c, 'stonebridge');
  go(CL, c, 'eastwatch');
  open(CL, c, 'eastwatch');
  assert.equal(T.blocked(c, 'eastwatch'), 'You are already in a tournament');
  go(CL, c, 'stonebridge');
  for (let i = 0; i < 3; i++) bout(CL, c, true);
  open(CL, c, 'stonebridge');
  assert.match(T.blocked(c, 'stonebridge'), /^You fought here lately: again from day \d+$/);
  go(CL, c, 'eastwatch');
  assert.equal(T.blocked(c, 'eastwatch'), '', 'another town is fine');
  // Win at Stonebridge every time it allows, for years: what it pays per tournament falls to nothing.
  go(CL, c, 'stonebridge');
  const R = T.rules();
  const net = [];
  for (let k = 0; k < 30; k++) {
    c.day = T.state(c).hosts.stonebridge.entered + R.cooldown;
    c.gold = 10000;
    open(CL, c, 'stonebridge');
    const before = c.gold;
    assert.equal(T.enter(c, 'stonebridge').ok, true);
    for (let i = 0; i < 3; i++) bout(CL, c, true);
    net.push(c.gold - before);
  }
  assert.ok(net[0] > 0, 'at first it pays');
  assert.ok(net.slice(-10).every((n) => n <= 0), `in the end it costs: ${net.slice(-10)}`);
  assert.ok(net.reduce((a, b) => a + b, 0) < 500, `all told: ${net.reduce((a, b) => a + b, 0)} crowns over 30 wins`);
});

test('a bout is a duel: the hero alone in loaner gear against one fighter; nothing else changes', () => {
  const { CL, c, T } = lists();
  c.equipment.weapon = 'worn_sword';
  const own = plain({ equipment: c.equipment, inventory: c.inventory });
  const [day, battles, roster, food] = [c.day, c.battles, plain(c.roster), c.food];
  T.enter(c, 'stonebridge');
  T.fight(c);
  const g = CL.game;
  assert.ok(g.duel);
  assert.equal(g.allies.length, 0, 'no soldiers, though the company has five');
  assert.equal(g.allyReserve.length + g.enemyReserve.length, 0, 'no reserves');
  assert.equal(g.joining.length, 0, 'no help riding in');
  assert.equal(g.enemies.length, 1);
  const o = T.boutFighter(c, T.state(c).bracket);
  assert.equal(g.enemies[0].maxhp, o.hp);
  assert.equal(g.enemies[0].duelist, o.name);
  assert.equal(g.hero.armor, 6, 'the loaner kit: helm, gambeson, boots and kite shield');
  assert.ok(g.hero.damage >= 21, 'and an arming sword, not the worn one');
  assert.deepEqual(plain({ equipment: c.equipment, inventory: c.inventory }), own, 'the hero’s own gear is untouched');
  // Nobody routs, and keeping away never wins it.
  g.enemies[0].hp = 1;
  for (let t = 0; t < 40 && g.mode === 'battle'; t += 0.1) {
    Object.assign(g.hero, { x: 170, y: 130 }); // pinned in a corner, never striking
    g.enemies[0].hp = Math.max(1, g.enemies[0].hp);
    CL.combat.update(0.1);
  }
  assert.equal(g.enemies[0].routing ?? false, false);
  CL.debugTools.endBattleNow(true);
  assert.equal(c.day, day, 'no time passes');
  assert.equal(c.battles, battles, 'not a battle of the company');
  assert.deepEqual(plain(c.roster), roster);
  assert.equal(c.food, food);
  assert.deepEqual(plain({ equipment: c.equipment, inventory: c.inventory }), own);
});

test('the hero’s own gear is the same after every bout, and after a reload mid-bout (which forfeits it)', () => {
  const { CL, c, T, messages } = lists();
  c.equipment.weapon = 'knights_sword';
  c.inventory.mail_hauberk = 1;
  const own = () => plain({ equipment: c.equipment, inventory: c.inventory });
  const before = own();
  T.enter(c, 'stonebridge');
  bout(CL, c, true);
  assert.deepEqual(own(), before);
  T.fight(c); // mid-bout…
  const saved = plain(c);
  assert.ok(saved.tourney.bracket.bout, 'the bout is in the save');
  const back = CL.save.fromRaw(saved).campaign; // …the page reloads
  assert.deepEqual(plain({ equipment: back.equipment, inventory: back.inventory }), before, 'after the reload too');
  CL.campaign = back;
  CL.game.mode = 'settlement';
  const text = T.settle(back);
  assert.match(text, /^Your bout was left unfinished: it counts as lost\./);
  assert.equal(back.tourney.bracket, null);
  assert.equal(back.chronicle.at(-1).result, 'out');
  assert.equal(T.settle(back), null, 'once');
  assert.ok(messages().some((m) => /left unfinished/.test(m)));
});

test('the difficulty curve: each round’s fighter is stronger, and fells a standing hero sooner', () => {
  const { CL, c, T } = lists();
  T.enter(c, 'stonebridge');
  const b = T.state(c).bracket;
  for (const f of b.fighters) f.skill = 1; // the rounds alone
  const power = [0, 1, 2].map((r) => {
    const o = T.boutFighter(c, b, r, 1);
    return o.hp * o.damage * (1 + o.armor / 10);
  });
  assert.ok(power[0] < power[1] && power[1] < power[2], `power ${power.map((p) => p.toFixed(0))}`);
  // A hero who only stands there: how long each round's fighter takes.
  const fell = (r) => {
    b.round = r;
    b.rounds = [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2, 4, 6], [0, 4]].slice(0, r + 1);
    CL.game.mode = 'settlement';
    T.fight(c);
    const g = CL.game;
    let t = 0;
    for (; t < 300 && g.mode === 'battle'; t += 0.05) CL.combat.update(0.05);
    b.bout = null;
    return t;
  };
  const times = [0, 1, 2].map(fell);
  assert.ok(times[0] > times[2], `seconds to fall: ${times.map((x) => x.toFixed(1))}`);
  // And each win in a town makes its next fighters harder.
  const h = T.state(c).hosts.stonebridge;
  const hp0 = T.boutFighter(c, b, 0, 1).hp;
  h.wins = 3;
  assert.ok(T.boutFighter(c, b, 0, 1).hp > hp0);
});

test('your rival enters later tournaments, seeded to meet you only in the final', () => {
  const { CL, c, T } = lists();
  T.state(c).rival = { name: 'Odo the Grim', culture: T.state(c).open[0].fighters[0].culture, skill: 1.2, from: 'stonebridge', beatYou: 1, beaten: 0 };
  let seen = 0;
  for (let k = 0; k < 10; k++) {
    c.day += 14;
    open(CL, c, 'stonebridge');
    const fs = T.openAt(c, 'stonebridge').fighters;
    if (fs.at(-1).name === 'Odo the Grim') seen++;
    assert.ok(fs.slice(0, -1).every((f) => f.name !== 'Odo the Grim'));
  }
  assert.ok(seen >= 3 && seen <= 9, `the rival entered ${seen} of 10`);
});

test('saves: kept; junk repaired; a v16 save migrates to v17', () => {
  const { CL, c, T } = lists();
  T.enter(c, 'stonebridge');
  bout(CL, c, true);
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.deepEqual(plain(back.tourney.bracket), plain(T.state(c).bracket));
  assert.deepEqual(plain(back.tourney.open), plain(T.state(c).open));
  const junk = plain(c);
  junk.tourney.bracket.rounds = [[0, 1, 2]];
  junk.tourney.open.push({ host: 'nowhere', start: 0, until: 5, fighters: [] });
  junk.tourney.hosts.stonebridge.wins = -4;
  junk.tourney.rival = { name: '', from: 'stonebridge' };
  const s = CL.save.fromRaw(junk).campaign.tourney;
  assert.equal(s.bracket, null, 'a broken bracket is dropped');
  assert.deepEqual(plain(s.open.map((o) => o.host)), ['stonebridge']);
  assert.equal(s.hosts.stonebridge.wins, 0);
  assert.equal(s.rival, null);
  const v16 = plain(c);
  v16.version = 16;
  delete v16.tourney;
  const m = CL.save.fromRaw(v16).campaign;
  assert.equal(m.version, 18); // on through v18 (businesses, P7-10)
  assert.equal(m.tourney.bracket, null);
  for (const h of Object.values(m.tourney.hosts)) assert.ok(h.next >= c.day);
});
