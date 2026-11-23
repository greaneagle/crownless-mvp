// P8-03 · Permissions: CL.rights.may(c, who, action, target) → { ok, why }, worked out only from the
// state (standing, holdings, allegiance, war and peace, story locks), and the one place rights live.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');

const byKey = (c, key) => Object.keys(c.people).find((id) => c.people[id].key === key);
const verdict = (r) => (r.ok ? 'ok' : 'no');

function world() {
  const { CL } = loadGame({ party: false });
  const c = CL.campaign;
  const may = (who, action, target) => CL.rights.may(c, who, action, target);
  return { CL, c, may };
}

test('place actions: an independent company is welcome; a Hostile owner refuses, saying why', () => {
  const { CL, c, may } = world();
  const PLACES = ['recruit', 'contract', 'trade', 'rest', 'buyBusiness', 'enterFort', 'enterTourney', 'joinEvent', 'shelter'];
  for (const a of PLACES) assert.deepEqual({ ...may('player', a, 'stonebridge') }, { ok: true, why: '' }, a);
  CL.realm.adjust(c, 'valedorn', -60);
  const table = Object.fromEntries(PLACES.map((a) => [a, verdict(may('player', a, 'stonebridge'))]));
  assert.deepEqual(table, { recruit: 'no', contract: 'no', trade: 'ok', rest: 'ok', buyBusiness: 'no', enterFort: 'no', enterTourney: 'no', joinEvent: 'no', shelter: 'no' }, 'markets and beds stay open, as before');
  assert.equal(may('player', 'recruit', 'stonebridge').why, "The Valedorn Crown won't let you recruit here: they count you Hostile");
  assert.match(may('player', 'buyBusiness', 'oakford').why, /will not sell to you$/);
  assert.equal(may('player', 'recruit', 'eastwatch').ok, true, 'another kingdom still deals with you');
  assert.equal(may('player', 'recruit', 'nowhere').ok, false);
  // Who controls the gates decides, not who claims it (P8-02): Greywall's village follows it.
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian');
  assert.equal(may('player', 'recruit', 'brackenfield').ok, true, 'Aurelia holds its gates now');
  CL.realm.adjust(c, 'aurelian', -60);
  assert.match(may('player', 'recruit', 'brackenfield').why, /Aurelian Remnant won't let you recruit/);
});

test('lords: their own realm’s places are open; a realm at war with theirs bars them', () => {
  const { CL, c, may } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  assert.equal(may(hamon, 'recruit', 'stonebridge').ok, true);
  assert.equal(may(hamon, 'recruit', 'eastwatch').ok, true, 'Valedorn and Aurelia are in tension, not at war');
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  assert.equal(may(hamon, 'recruit', 'eastwatch').why, "Aurelian won't let Lord Hamon Greymantle recruit here: their realms are at war");
  assert.equal(may(hamon, 'trade', 'eastwatch').ok, true);
  assert.equal(may('person:999', 'trade', 'stonebridge').ok, false, 'nobody');
});

test('running a holding (P8-05): its holder or administrator; the occupier’s crown', () => {
  const { CL, c, may } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  for (const a of ['appoint', 'setPolicy', 'drawTreasury']) {
    assert.equal(may(hamon, a, 'greywall_fort').ok, true, `${a}: the holder`);
    assert.equal(may('player', a, 'greywall_fort').why, "You don't hold Greywall Fort: Lord Hamon Greymantle does", `${a}: not yours`);
  }
  c.holdings.westholt_castle.administrator = hamon;
  assert.equal(may(hamon, 'appoint', 'westholt_castle').ok, true, 'an administrator');
  CL.realm.transfer(c, 'westholt_castle', { controller: 'aurelian', sovereign: 'valedorn' });
  assert.equal(may(c.rulers.aurelian, 'drawTreasury', 'westholt_castle').ok, true, 'occupied: the occupier’s crown runs it');
  assert.equal(may('player', 'appoint', 'merrow').ok, false);
});

test('grant: rulers only, never a story fort before its ending, never what an enemy occupies', () => {
  const { CL, c, may } = world();
  const king = c.rulers.valedorn;
  const hamon = byKey(c, 'hamon_greymantle');
  assert.equal(may(king, 'grant', 'westholt_castle').ok, true);
  assert.match(may(hamon, 'grant', 'westholt_castle').why, /^Only the ruler of the Valedorn Crown grants Westholt Castle$/);
  assert.equal(may(c.rulers.aurelian, 'grant', 'westholt_castle').ok, false, 'another realm’s ruler');
  assert.equal(may('player', 'grant', 'westholt_castle').ok, false, 'the player is never a ruler in Phase 8');
  assert.match(may(king, 'grant', 'greywall_fort').why, /story/, 'story-locked');
  assert.match(may(king, 'grant', 'highmere').why, /story/, 'its villages too');
  CL.story.state(c).flags.ending = 'valedorn';
  assert.equal(may(king, 'grant', 'greywall_fort').ok, true, 'after the ending');
  CL.realm.transfer(c, 'fernley', { holder: king, willing: true });
  CL.realm.transfer(c, 'westholt_castle', { controller: 'aurelian', sovereign: 'valedorn' });
  assert.match(may(king, 'grant', 'westholt_castle').why, /Aurelian Remnant hold its gates/);
});

test('seize and besiege: forts only, story locks and capitals hold; a siege needs a realm at war', () => {
  const { CL, c, may } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  assert.equal(may('player', 'seize', 'westholt_castle').ok, true);
  assert.match(may('player', 'seize', 'greywall_fort').why, /story/);
  assert.match(may('player', 'seize', 'stonebridge').why, /capital/);
  assert.match(may('player', 'seize', 'highmere').why, /follows its seat/);
  assert.equal(may('player', 'besiege', 'castra_nova').ok, true, 'an independent may, at the cost of attacking that realm (P8-06a)');
  assert.match(may(hamon, 'besiege', 'castra_nova').why, /not at war/);
  CL.realm.setRelation(c, 'valedorn', 'aurelian', 'war', 'test');
  assert.equal(may(hamon, 'besiege', 'castra_nova').ok, true, 'at war');
  assert.match(may(hamon, 'besiege', 'ashgate_fort').why, /story/, 'story-locked');
  assert.match(may(hamon, 'besiege', 'eastwatch').why, /capital/);
  assert.match(may(hamon, 'besiege', 'westholt_castle').why, /already your realm/);
  assert.match(may(hamon, 'besiege', 'redfield').why, /fort or a town/);
});

test('allegiance: swear, serve, leave, ask for help, ransom', () => {
  const { CL, c, may } = world();
  const hamon = byKey(c, 'hamon_greymantle');
  assert.equal(CL.rights.allegiance(c, 'player'), null);
  assert.equal(CL.rights.allegiance(c, hamon), 'valedorn');
  // P8-04: a vassal's oath needs Friendly standing, renown and service first (tests/allegiance.test.js).
  assert.match(may('player', 'swear', 'stonebridge').why, /must count you a friend/);
  assert.equal(may('player', 'serve', 'vessaro').ok, true, 'a realm by name');
  assert.match(may('player', 'swear', 'merrow').why, /no crown/, 'the free city has none');
  assert.match(may(hamon, 'swear', 'eastwatch').why, /already sworn to the Valedorn Crown/);
  assert.match(may('player', 'leave').why, /sworn to no realm/);
  assert.equal(may(hamon, 'leave').ok, true);
  assert.match(may(c.rulers.valedorn, 'leave').why, /ruler/);
  assert.equal(may('player', 'askHelp', hamon).ok, true);
  CL.realm.adjust(c, 'valedorn', -60);
  assert.match(may('player', 'swear', 'stonebridge').why, /Hostile/);
  assert.match(may('player', 'serve', 'stonebridge').why, /will not hire you/);
  assert.match(may('player', 'askHelp', hamon).why, /will not help an enemy of the Valedorn Crown/);
  // Captives (P8-01).
  assert.match(may('player', 'ransom', hamon).why, /no one’s captive/);
  Object.assign(c.people[hamon], { status: 'captive', heldBy: 'player' });
  assert.equal(may('player', 'ransom', hamon).ok, true);
  assert.equal(may('player', 'release', hamon).ok, true);
  assert.match(may(byKey(c, 'cassian_vatro'), 'ransom', hamon).why, /not your captive/);
  assert.match(may('player', 'askHelp', hamon).why, /captive/);
  assert.match(may('player', 'fly').why, /Unknown action/);
  for (const a of CL.rights.ACTIONS) assert.equal(typeof may('player', a, 'stonebridge').why, 'string', a);
});

test('every existing check goes through CL.rights: no right is decided anywhere else in js/', () => {
  const dir = path.join(__dirname, '..', 'js');
  // Who fights whom (parties, reinforcements) and the mill's owner's law are not rights: they are the
  // world acting on its own, and stay where they are.
  const NOT_RIGHTS = {
    'parties.js': /hostileTo = /,
    'reinforce.js': /hostileTo = /,
    'business.js': /they are Hostile to you|const hostile = CL\.realm\.isHostile/,
  };
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && !['rights.js', 'realm.js'].includes(x))) {
    fs.readFileSync(path.join(dir, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (!/realm\.(welcomes|isHostile|locked|isCapital)\(/.test(code)) return;
        if (NOT_RIGHTS[f]?.test(code)) return;
        problems.push(`${f}:${i + 1}: ${code.trim().slice(0, 100)}`);
      });
  }
  assert.deepEqual(problems, []);
});

test('P9-03: every realm is looked up through CL.realm: no faction table read anywhere else in js/', () => {
  // A realm founded in play (`c.realms`) is a realm everywhere a data realm is only if nobody reads
  // the content's factions directly: realm.faction, realm.kingdoms and realm.realms know both.
  const dir = path.join(__dirname, '..', 'js');
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && !['content.js', 'realm.js'].includes(x))) {
    fs.readFileSync(path.join(dir, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/table\('factions'\)|get\('factions'/.test(line.replace(/\/\/.*$/, ''))) problems.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
  }
  assert.deepEqual(problems, []);
});
