// Regional news and trade-world interactions (GDD §4 status bulletin, §9 caravans and prices,
// §12 sandbox frontier clashes; Gate D 4.14).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const S = (CL, id) => CL.content.get('settlements', id);
const news = (CL) => CL.campaign.news;

test('quiet roads: every two days a news line about the border, announced and kept in the Journal', () => {
  const { CL, uiCalls } = loadGame();
  const c = CL.campaign;
  CL.party.advanceDays(1.5);
  assert.equal(news(CL).lines.length, 0, 'not yet');
  CL.party.advanceDays(0.6);
  assert.equal(news(CL).lines.length, 1);
  assert.equal(news(CL).lines[0].kind, 'tensions');
  assert.match(news(CL).lines[0].text, /Greywall still flies the banner of the Valedorn Crown/);
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /^News: /.test(x[1])));
  // A long wait writes at most two bulletins at once, and the clock stays on its two-day beat.
  CL.party.advanceDays(10);
  assert.equal(news(CL).lines.length, 3);
  assert.ok(news(CL).next > c.day && news(CL).next <= c.day + 2);
  assert.equal(CL.news.recent(c)[0], news(CL).lines.at(-1), 'newest first');
  // Lines take turns rather than repeating.
  const texts = news(CL).lines.map((l) => l.text);
  assert.equal(new Set(texts).size, texts.length);
});

test('the bulletin tells the most important untold event; each event is told once', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const sb = S(CL, 'stonebridge');
  CL.news.record(c, 'caravan_arrived', { dest: 'oakford', good: 'grain', faction: 'valedorn' });
  CL.news.record(c, 'caravan_lost', { x: sb.mapX + 1, y: sb.mapY, dest: 'highmere', good: 'wool', faction: 'valedorn' });
  CL.news.record(c, 'reavers_broken', { x: 10, y: 10, faction: 'aurelian' });
  let l = CL.news.bulletin(c);
  assert.equal(l.kind, 'caravan_lost');
  assert.equal(l.text, 'Road Reavers fell on Valedorn wagons near Stonebridge. Wool will cost more in Highmere for a while.');
  assert.equal(CL.news.bulletin(c).kind, 'reavers_broken');
  assert.equal(CL.news.bulletin(c).kind, 'caravan_arrived');
  l = CL.news.bulletin(c);
  assert.equal(l.kind, 'tensions', 'nothing left untold');
  assert.equal(CL.news.record(c, 'no_such_kind', {}), null);
});

test('Reavers rob a caravan off-screen: dearer goods where it was going, news and market talk', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  const caravan = CL.parties.spawn(c, 'valedorn_caravan');
  const t = CL.content.get('party_templates', 'valedorn_caravan');
  const dest = t.route[(caravan.routeIndex + 1) % t.route.length];
  const before = c.markets[dest][caravan.good];
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(band, { x: caravan.x, y: caravan.y, troops: { reaver: 30 } });
  c.world.location = 'eastwatch';
  CL.parties.tick(c, 0.25);
  assert.equal(c.parties.includes(caravan), false, 'the caravan is taken');
  assert.ok(c.markets[dest][caravan.good] > before);
  const e = news(CL).events.find((x) => x.kind === 'caravan_lost');
  assert.equal(e.dest, dest);
  assert.equal(e.faction, 'valedorn');
  assert.match(CL.news.marketTalk(c, dest), /Reavers took the Valedorn caravan bound here/);
  assert.equal(CL.news.marketTalk(c, 'eastwatch'), null, 'other towns heard nothing');
  c.day += 5;
  assert.equal(CL.news.marketTalk(c, dest), null, 'old talk fades');
});

test('a caravan that arrives eases prices and is talked about at that market', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const caravan = CL.parties.spawn(c, 'aurelian_caravan');
  const t = CL.content.get('party_templates', 'aurelian_caravan');
  const dest = t.route[(caravan.routeIndex + 1) % t.route.length];
  const good = caravan.good;
  const s = S(CL, dest);
  Object.assign(caravan, { x: s.mapX, y: s.mapY });
  c.world.location = 'stonebridge';
  CL.parties.tick(c, 0.25);
  assert.match(CL.news.marketTalk(c, dest), new RegExp(`came in with ${CL.content.get('markets', good).name.toLowerCase()}`));
});

test('frontier clashes: rival patrols that meet skirmish, at most once every few days', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const men = (p) => CL.parties.troopCount(p);
  const pair = () => {
    const v = CL.parties.spawn(c, 'valedorn_patrol');
    const a = CL.parties.spawn(c, 'aurelian_patrol');
    Object.assign(v, { x: 50, y: 40, tx: null, ty: null });
    Object.assign(a, { x: 50.5, y: 40, tx: null, ty: null });
    return [v, a];
  };
  const clashes = () => news(CL).events.filter((x) => x.kind === 'frontier_clash');
  c.world.location = 'stonebridge';
  const [v, a] = pair();
  const before = men(v) + men(a);
  CL.parties.tick(c, 0.25);
  assert.equal(clashes().length, 1);
  const e = clashes()[0];
  assert.ok(e.winner !== e.loser && ['valedorn', 'aurelian'].includes(e.winner));
  // A skirmish, not a massacre: a man or three fall, and the beaten patrol rides for home.
  assert.ok(c.parties.includes(v) && c.parties.includes(a));
  const lost = before - men(v) - men(a);
  assert.ok(lost >= 1 && lost <= 3, `${lost} fell`);
  const loser = e.loser === 'valedorn' ? v : a;
  const home = S(CL, CL.content.get('party_templates', loser.template).home);
  assert.deepEqual([loser.tx, loser.ty], [home.mapX, home.mapY]);
  // Another pair meeting the next day does not fight yet; days later they do.
  for (const p of [v, a]) CL.parties.remove(c, p);
  const [v2, a2] = pair();
  const fresh = men(v2) + men(a2);
  c.day += 1;
  CL.parties.tick(c, 0.25);
  assert.equal(clashes().length, 1);
  assert.equal(men(v2) + men(a2), fresh);
  c.day += 4;
  Object.assign(v2, { x: 50, y: 40, tx: null, ty: null });
  Object.assign(a2, { x: 50.5, y: 40, tx: null, ty: null });
  CL.parties.tick(c, 0.25);
  assert.equal(clashes().length, 2);
});

test('a fort changing hands and the player’s own fights make the news; endings colour quiet days', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian', 'test');
  assert.match(CL.news.bulletin(c).text, /^Greywall Fort has changed hands\. The banner of the Aurelian Remnant/);
  const band = CL.parties.spawn(c, 'bandits');
  Object.assign(c.world, { x: S(CL, 'oakford').mapX, y: S(CL, 'oakford').mapY });
  CL.parties.onBattleResolved(true, band.id, {});
  assert.match(CL.news.bulletin(c).text, /Tester.*near Oakford|near Oakford.*Tester/);
  CL.story.state(c).flags.ending = 'compromise';
  assert.match(CL.news.bulletin(c).text, /road peace at Greywall holds/);
  // Border clashes go on, but under the road peace the news calls them what they are.
  CL.news.record(c, 'frontier_clash', { x: 110, y: 90, winner: 'valedorn', loser: 'aurelian' });
  assert.match(CL.news.bulletin(c).text, /^The road peace frays: Valedorn and Aurelian patrols came to blows near Eastwatch\.$/);
});

test('escorts and deliveries feed the market they reach, and the road hears of them', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.gold = 500;
  c.food = 999;
  const o = CL.contracts.offerAt(c, 'stonebridge', 'delivery');
  Object.assign(o, { to: 'oakford', letter: undefined, good: 'iron', qty: 3, deposit: 84 });
  assert.equal(CL.contracts.accept(c, 'stonebridge', 'delivery').ok, true);
  const before = c.markets.oakford.iron;
  c.world.location = null;
  CL.contracts.onArrive(c, 'oakford');
  assert.equal(c.contract, null, 'delivered and paid');
  assert.ok(c.markets.oakford.iron < before, 'iron is a little cheaper in Oakford now');
  assert.match(CL.news.marketTalk(c, 'oakford'), /Your load of iron has reached the stalls/);
  assert.equal(news(CL).events.at(-1).kind, 'delivered');
});

test('news survives a save, unknown news is rejected on import, and old saves start fresh', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.news.record(c, 'caravan_lost', { x: 50, y: 55, dest: 'oakford', good: 'salt', faction: 'valedorn' });
  CL.party.advanceDays(2.1);
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(JSON.parse(JSON.stringify(s.news)), JSON.parse(JSON.stringify(c.news)));
  const bad = JSON.parse(JSON.stringify(c));
  bad.news.events.push({ day: 1, kind: 'dragon_sighted' });
  const r = CL.portable.parse(JSON.stringify(bad));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => /unknown news kind "dragon_sighted"/.test(p)));
  const old = JSON.parse(JSON.stringify(c));
  delete old.news;
  const o = CL.save.sanitize(old);
  assert.deepEqual(Array.from(o.news.lines), []);
  assert.ok(o.news.next > o.day);
});
