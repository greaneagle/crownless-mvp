// P7-08: dynamic world events. Each starts from the state of the world, is reported, resolves exactly
// once (with a result ID), has a stated consequence when ignored, respects its cooldown per region and
// kind, is kept in saves, feeds the news and the chronicle, and never touches the story. (90 days of a
// bot company: tests/slow/happenings-bots.test.js.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company of soldiers with food and crowns, standing in `at`. */
function camp(at = 'stonebridge', opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.gold = 300;
  c.food = 60;
  go(CL, c, at);
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, H: CL.happenings, messages };
}
function go(CL, c, sid) {
  const s = CL.content.table('settlements')[sid];
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: sid });
}
/** Every kingdom pair of `f` at peace (so nothing is at odds or at war around it). */
function calm(CL, c, f) {
  for (const o of CL.world.map().factions) if (o !== f) CL.realm.setRelation(c, f, o, 'peace');
}
const def = (CL, k) => CL.content.get('world_events', k);
const grain = (c, sid) => c.markets[sid].grain;
const base = (CL, sid) => CL.content.get('settlements', sid).market.grain;

test('content checks out; each kind starts only where the world calls for it', () => {
  const { CL, c, H } = camp();
  assert.deepEqual(Array.from(CL.content.validate()), []);
  assert.deepEqual(Object.keys(CL.content.table('world_events')), plain(H.KINDS));
  const fits = (k, sid) => H.fits(c, def(CL, k), sid);
  calm(CL, c, 'valedorn');
  // Food shortage: a market whose grain is dear (or whose kingdom is at war).
  assert.equal(fits('food_shortage', 'stonebridge'), false, 'grain at its usual, at peace');
  c.markets.stonebridge.grain = base(CL, 'stonebridge') + 0.1;
  assert.equal(fits('food_shortage', 'stonebridge'), true, 'grain dear');
  assert.equal(fits('food_shortage', 'greywall_fort'), false, 'a fort has no market');
  // Infestation: villages only.
  assert.equal(fits('infestation', 'oakford'), true);
  assert.equal(fits('infestation', 'stonebridge'), false);
  // Militia: a town or village whose kingdom is at odds with another.
  assert.equal(fits('militia_request', 'oakford'), false, 'at peace');
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'tension');
  assert.equal(fits('militia_request', 'oakford'), true, 'in tension');
  // Refugees: near a war, or a clash in the region.
  assert.equal(fits('refugees', 'oakford'), false, 'tension is not war, and no clash was heard of');
  CL.news.record(c, 'frontier_clash', { place: 'stonebridge', winner: 'valedorn', loser: 'aurelian' });
  assert.equal(fits('refugees', 'oakford'), true, 'a clash in the same region');
  calm(CL, c, 'valedorn');
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war');
  assert.equal(fits('refugees', 'highmere'), true, 'its kingdom at war');
  // Courier: from a town, to somewhere at the right distance.
  assert.equal(fits('courier', 'stonebridge'), true);
  assert.equal(fits('courier', 'oakford'), false);
  // Nothing before FIRST_DAY, at most MAX_OPEN at once, one at a time in a place.
  assert.equal(H.daily(c, H.FIRST_DAY - 1), null);
  assert.ok(H.start(c, 'infestation', 'oakford'));
  assert.equal(H.start(c, 'refugees', 'oakford'), null, 'oakford already has something going on');
  assert.ok(!H.candidates(c).some((x) => x.place === 'oakford'));
});

test('each resolves exactly once, with its result; the news and the chronicle are told', () => {
  const { CL, c, H, messages } = camp();
  const e = H.start(c, 'food_shortage', 'stonebridge');
  assert.ok(e.seen, 'happening where you stand: told at once');
  assert.match(messages().at(-1), /^Food shortage in Stonebridge: Bread is short/);
  assert.ok(grain(c, 'stonebridge') >= base(CL, 'stonebridge') + def(CL, 'food_shortage').rise - 1e-9, 'grain goes dear');
  assert.equal(c.news.events.at(-1).kind, 'happening');
  assert.equal(CL.news.bulletin(c).text, 'Hunger in Stonebridge: grain is short and its price climbs by the day.');
  const [food, gold] = [c.food, c.gold];
  const r = H.choose(c, e.id, 'sell');
  assert.equal(r.ok, true, r.reason);
  assert.equal(c.food, food - 20);
  assert.equal(c.gold, gold + 20 * CL.content.get('markets', 'food_ration').basePrice);
  assert.equal(H.state(c).open.length, 0);
  assert.deepEqual(plain(H.state(c).past.map((p) => [p.kind, p.result])), [['food_shortage', 'eased']]);
  // Once: the choice is gone, a second resolve and the end of its time do nothing.
  assert.equal(H.choose(c, e.id, 'sell').ok, false);
  assert.equal(H.resolve(c, e, 'ignored'), false);
  assert.equal(CL.news.bulletin(c).text, 'A company sold food to Stonebridge at the old price, and its bread is back.');
  CL.party.advanceDays(10);
  assert.equal(H.state(c).past.length, 1);
  const ch = c.chronicle.filter((x) => x.kind === 'happening');
  assert.equal(ch.length, 1);
  assert.equal(CL.chronicle.text(ch[0]), 'Sold 20 rations to hungry Stonebridge at the old price.');
});

test('a choice that cannot be made says why: away, no food, a full company, an enemy town', () => {
  const { CL, c, H } = camp('oakford');
  const e = H.start(c, 'refugees', 'oakford');
  c.food = 3;
  assert.match(H.options(c, e).find((o) => o.id === 'feed').reason, /^You need 15 rations/);
  while (CL.party.headcount(c) < CL.party.partyCap(c)) CL.save.addSoldier(c, 'levy');
  assert.equal(H.options(c, e).find((o) => o.id === 'take').reason, 'Your company is full');
  go(CL, c, 'stonebridge');
  assert.equal(H.choose(c, e.id, 'feed').reason, 'You must be in Oakford');
  go(CL, c, 'oakford');
  c.reputation.valedorn = -80;
  assert.match(H.choose(c, e.id, 'feed').reason, /will not deal with an enemy/);
  assert.equal(H.state(c).open.length, 1, 'still open');
});

test('ignored, each has the consequence its text states', () => {
  // Food shortage: grain stays dear.
  {
    const { CL, c, H } = camp('oakford');
    const e = H.start(c, 'food_shortage', 'stonebridge');
    assert.match(H.fill(def(CL, 'food_shortage').ignored, e, c), /grain stays dear in Stonebridge/);
    CL.party.advanceDays(def(CL, 'food_shortage').days + 0.01);
    assert.equal(H.state(c).past.at(-1).result, 'ignored');
    assert.ok(grain(c, 'stonebridge') > base(CL, 'stonebridge') + 0.15, `grain ${grain(c, 'stonebridge')}`);
    assert.equal(c.chronicle.some((x) => x.kind === 'happening'), false, 'never there: not the company’s history');
  }
  // Infestation: the band plunders and leaves.
  {
    const { CL, c, H } = camp('stonebridge');
    const e = H.start(c, 'infestation', 'oakford');
    const band = CL.parties.find(c, e.partyId);
    assert.ok(band && band.eventId === e.id && band.anchor, 'a band, kept near the village');
    const wool = c.markets.oakford.wool;
    CL.party.advanceDays(def(CL, 'infestation').days + 0.01);
    assert.equal(H.state(c).past.at(-1).result, 'ignored');
    assert.equal(CL.parties.find(c, e.partyId), null, 'the band is gone');
    assert.ok(c.markets.oakford.wool > wool);
  }
  // Militia: a little reputation, only if you were there and rode on.
  {
    const { CL, c, H } = camp('oakford');
    CL.realm.setRelation(c, 'valedorn', 'aurelian', 'tension');
    const rep = CL.realm.score(c, 'valedorn');
    H.start(c, 'militia_request', 'highmere'); // never seen
    H.start(c, 'militia_request', 'oakford'); // seen: you are here
    CL.party.advanceDays(def(CL, 'militia_request').days + 0.01);
    assert.equal(CL.realm.score(c, 'valedorn'), rep - def(CL, 'militia_request').snub, 'only the one you were asked');
    assert.equal(c.chronicle.filter((x) => x.kind === 'happening' && x.result === 'ignored').length, 1);
  }
  // Courier: taken and too late, the sender holds it against you; never taken, nothing.
  {
    const { CL, c, H } = camp('stonebridge');
    const e = H.start(c, 'courier', 'stonebridge', { dest: 'highmere' });
    H.choose(c, e.id, 'carry');
    const rep = CL.realm.score(c, 'valedorn');
    CL.party.advanceDays(def(CL, 'courier').days + 0.01);
    assert.equal(H.state(c).past.at(-1).result, 'late');
    assert.equal(CL.realm.score(c, 'valedorn'), rep - def(CL, 'courier').late);
  }
  // Refugees: they move on, and grain is dearer.
  {
    const { CL, c, H } = camp('stonebridge');
    const g = grain(c, 'oakford');
    H.start(c, 'refugees', 'oakford');
    CL.party.advanceDays(def(CL, 'refugees').days + 0.01);
    assert.equal(H.state(c).past.at(-1).result, 'ignored');
    assert.ok(grain(c, 'oakford') > g - 0.2 && grain(c, 'oakford') >= base(CL, 'oakford') + def(CL, 'refugees').burden - 1e-9);
  }
});

test('cooldown per region and kind', () => {
  const { CL, c, H } = camp();
  const e = H.start(c, 'infestation', 'oakford');
  const region = CL.world.regionAt(CL.content.get('settlements', 'oakford').mapX, CL.content.get('settlements', 'oakford').mapY).id;
  H.resolve(c, e, 'others');
  const sameRegion = (x) => x.kind === 'infestation' && CL.world.regionAt(CL.content.get('settlements', x.place).mapX, CL.content.get('settlements', x.place).mapY)?.id === region;
  assert.equal(H.candidates(c).some(sameRegion), false, 'no infestation in that region for a while');
  assert.ok(H.candidates(c).some((x) => x.kind === 'infestation' && !sameRegion(x)), 'other regions may have one');
  assert.ok(H.candidates(c).some((x) => x.kind === 'courier' || x.kind === 'food_shortage' || x.kind === 'refugees' || x.kind === 'militia_request'), 'other kinds are not held up');
  c.day += def(CL, 'infestation').cooldown + 0.01;
  assert.ok(H.candidates(c).some(sameRegion), 'after its cooldown');
});

test('the bounty: beat the band and it is paid, once; beaten by others, it is over without pay', () => {
  const { CL, c, H, messages } = camp('oakford');
  const e = H.start(c, 'infestation', 'oakford');
  const r = H.choose(c, e.id, 'take');
  assert.equal(r.ok, true, r.reason);
  const band = CL.parties.find(c, e.partyId);
  assert.ok(band.seenAt, 'marked on the map');
  assert.equal(H.options(c, e).length, 0, 'taken: no more to decide');
  assert.match(H.takenText(e), /^You have taken the bounty/);
  const gold = c.gold;
  Object.assign(c.world, { x: band.x, y: band.y, location: null });
  CL.parties.open(band.id);
  CL.parties.attack();
  CL.debugTools.endBattleNow(true);
  assert.ok(c.gold >= gold + e.gold, 'the bounty, besides the battle’s own pay');
  assert.ok(messages().some((m) => /The bounty of \d+ crowns is yours/.test(m)));
  assert.equal(H.state(c).past.at(-1).result, 'cleared');
  assert.equal(c.chronicle.filter((x) => x.kind === 'happening' && x.result === 'cleared').length, 1);
  // Another band, seen to by someone else.
  const o = camp('stonebridge');
  const e2 = o.H.start(o.c, 'infestation', 'oakford');
  o.c.parties.splice(o.c.parties.indexOf(o.CL.parties.find(o.c, e2.partyId)), 1);
  const g2 = o.c.gold;
  o.CL.party.advanceDays(0.1);
  assert.equal(o.H.state(o.c).past.at(-1).result, 'others');
  assert.equal(o.c.gold, g2);
});

test('the courier: the letter handed over on arrival, before its time, pays', () => {
  const { CL, c, H } = camp();
  const e = H.start(c, 'courier', 'stonebridge', { dest: 'highmere' });
  assert.ok(e.gold > def(CL, 'courier').gold.base);
  H.choose(c, e.id, 'carry');
  assert.match(H.takenText(e), /^You carry the letter: take it to Highmere by day \d+\.$/);
  const [gold, renown] = [c.gold, c.renown];
  CL.party.advanceDays(1);
  go(CL, c, 'highmere');
  H.onArrive(c, 'highmere');
  assert.equal(c.gold, gold + e.gold);
  assert.equal(c.renown, renown + def(CL, 'courier').renown);
  assert.equal(H.state(c).past.at(-1).result, 'delivered');
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), 'Carried a letter from Stonebridge to Highmere in time.');
});

test('take part: drill the militia (a day passes) and take on refugees', () => {
  const { CL, c, H } = camp('oakford');
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'tension');
  const e = H.start(c, 'militia_request', 'oakford');
  const [day, xp, rep] = [c.day, c.roster[0].xp, CL.realm.score(c, 'valedorn')];
  assert.equal(H.choose(c, e.id, 'drill').ok, true);
  assert.ok(Math.abs(c.day - day - 1) < 1e-9, 'one day');
  assert.equal(c.roster[0].xp, xp + def(CL, 'militia_request').xp);
  assert.equal(CL.realm.score(c, 'valedorn'), rep + def(CL, 'militia_request').rep);
  const r = H.start(c, 'refugees', 'oakford');
  const head = CL.party.headcount(c);
  assert.equal(H.choose(c, r.id, 'take').ok, true);
  assert.equal(CL.party.headcount(c), head + 2);
  assert.equal(c.roster.at(-1).troop, 'levy');
  assert.equal(CL.chronicle.text(c.chronicle.at(-1)), 'Took on 2 of the refugees at Oakford as soldiers.');
});

test('saves: kept; junk repaired; a band’s event needs its band; a v15 save migrates on (v16 and later)', () => {
  const storage = memoryStorage();
  const { CL, c, H } = camp('stonebridge', { storage });
  const a = H.start(c, 'courier', 'stonebridge', { dest: 'highmere' });
  H.choose(c, a.id, 'carry');
  const b = H.start(c, 'infestation', 'oakford');
  CL.save.write();
  assert.deepEqual(plain(loadGame({ storage }).CL.campaign.happenings.open.map((e) => e.id)), [a.id, b.id], 'written and read back');
  const back = CL.save.fromRaw(plain(c)).campaign; // (the test loader clears the map's parties; this keeps them)
  assert.deepEqual(plain(back.happenings.open.map((e) => [e.kind, e.place, e.taken])), [
    ['courier', 'stonebridge', true],
    ['infestation', 'oakford', false],
  ]);
  assert.equal(back.parties.find((p) => p.id === b.partyId).eventId, b.id);
  // Junk.
  const junk = plain(c);
  junk.happenings.open.push({ id: 99, kind: 'bogus', place: 'oakford', start: 0, until: 5 }, { id: 100, kind: 'refugees', place: 'nowhere', start: 0, until: 5 }, null);
  junk.happenings.open[1].partyId = 9999; // its band is missing
  junk.happenings.past = [{ id: 7, kind: 'courier', place: 'stonebridge', day: 1, result: 'cheered' }];
  junk.happenings.cool = { 'nonsense|x': 3, 'courier|west_march': 'soon' };
  junk.parties.push({ ...plain(c.parties.find((p) => p.id === b.partyId)), id: 500, eventId: 77 });
  const s = CL.save.fromRaw(junk).campaign;
  assert.deepEqual(plain(s.happenings.open.map((e) => e.kind)), ['courier']);
  assert.deepEqual(plain(s.happenings.past), []);
  assert.deepEqual(plain(s.happenings.cool), {});
  assert.equal('eventId' in s.parties.find((p) => p.id === 500), false, 'a band whose event is gone is an ordinary band');
  assert.ok(s.happenings.nextId > a.id);
  // v15 → v16.
  const v15 = plain(c);
  v15.version = 15;
  delete v15.happenings;
  const m = CL.save.fromRaw(v15);
  assert.equal(m.campaign.version, 18);
  assert.deepEqual(plain(m.campaign.happenings.open), []);
  assert.ok(m.campaign.happenings.next > c.day);
});

test('never touches the story: flags, quests, owners and talk are as they were', () => {
  const { CL, c, H } = camp('stonebridge', { worldEvents: true });
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war');
  const story = JSON.stringify(CL.story.state(c));
  const owners = JSON.stringify(c.owners);
  const people = (sid) => CL.story.peopleAt(sid, c).map((t) => t.id);
  const before = people('stonebridge');
  for (const k of H.KINDS) H.start(c, k, { food_shortage: 'stonebridge', infestation: 'oakford', militia_request: 'highmere', courier: 'eastwatch', refugees: 'redfield' }[k]);
  for (const e of [...H.state(c).open]) for (const o of H.options(c, e)) if (!o.reason) H.choose(c, e.id, o.id);
  CL.party.advanceDays(20);
  assert.equal(JSON.stringify(CL.story.state(c)), story);
  assert.equal(JSON.stringify(c.owners), owners);
  assert.deepEqual(people('stonebridge'), before);
});
