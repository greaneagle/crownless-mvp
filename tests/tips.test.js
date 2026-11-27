// First-time tips and How to play (Gate E 5.4; GDD §11 "initial mappings are documented in Help";
// GDD §4: Q1 stays the playable tutorial).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function setup(opts) {
  const env = loadGame(opts);
  const { CL } = env;
  const shown = [];
  CL.ui.showTip = (t) => shown.push(t);
  CL.ui.setPaused = (p) => {
    CL.game.paused = p;
  };
  CL.settings.load();
  return { ...env, shown };
}

test('help documents every control the GDD lists, and every tip points at a real topic', () => {
  const { CL } = setup();
  assert.deepEqual(Array.from(CL.content.validate()), []);
  const battle = CL.content.get('help_topics', 'battle').controls.map((r) => r[1]).join(' | ');
  for (const k of ['WASD', 'Space', 'left click', 'Shift', 'right click', '1 / 2 / 3', 'F / H / C', 'Esc']) assert.match(battle, new RegExp(k.replace(/[/]/g, '\\/')), k);
  const map = CL.content.get('help_topics', 'map').controls.map((r) => r[1]).join(' | ');
  assert.match(map, /Click the map/);
  for (const t of Object.values(CL.content.table('tips'))) assert.ok(CL.content.get('help_topics', t.help));
});

test('a tip shows once per device — not again later, nor in a new campaign on the same phone', () => {
  const { CL, shown, storage } = setup();
  Object.assign(CL.campaign, { food: 100 });
  Object.assign(CL.campaign.character, { skillPoints: 0, attributePoints: 0 }); // no situation tips due
  CL.game.mode = 'map';
  assert.equal(CL.tips.check().id, 'map');
  assert.equal(shown[0].title, 'The map');
  assert.equal(CL.tips.check(), null, 'one at a time');
  CL.tips.dismiss();
  assert.equal(CL.tips.check(), null, 'already seen');
  assert.equal('crownless_tips_seen' in JSON.parse(JSON.stringify(CL.campaign)), false, 'not in the save');
  const again = setup({ storage });
  again.CL.game.mode = 'map';
  assert.notEqual(again.CL.tips.check()?.id, 'map', 'the same device remembers');
});

test('tips can be turned off, and shown again from Settings', () => {
  const { CL } = setup();
  CL.game.mode = 'map';
  CL.settings.set('tips', false);
  assert.equal(CL.tips.check(), null);
  CL.settings.set('tips', true);
  assert.equal(CL.tips.check().id, 'map');
  CL.tips.dismiss();
  CL.tips.reset();
  assert.equal(CL.tips.check().id, 'map', 'shown again after a reset');
});

test('situation tips wait for their moment: low food, points to spend, wounded', () => {
  const { CL } = setup();
  const c = CL.campaign;
  CL.game.mode = 'map';
  CL.tips.check();
  CL.tips.dismiss(); // the map tip
  c.food = 100;
  c.character.skillPoints = 0;
  c.character.attributePoints = 0;
  assert.equal(CL.tips.check(), null, 'nothing to say yet');
  c.food = 1;
  assert.equal(CL.tips.check().id, 'lowFood');
  CL.tips.dismiss();
  c.character.skillPoints = 1;
  assert.equal(CL.tips.check().id, 'points');
  CL.tips.dismiss();
  c.roster[0].woundedUntil = c.day + 1;
  assert.equal(CL.tips.check().id, 'wounded');
});

test('the first battle waits on its controls card; reserves and capture get their own tips', () => {
  const { CL } = setup();
  CL.combat.setActiveCap(20);
  for (let i = 0; i < 15; i++) CL.save.addSoldier(CL.campaign, 'levy');
  CL.combat.startBattle({ id: 't', name: 'T', map: 'grass_field', waves: [{ looter: 8 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  assert.equal(CL.tips.check().id, 'battle');
  assert.equal(CL.game.paused, true, 'the battle waits');
  CL.tips.dismiss();
  assert.equal(CL.game.paused, false, 'and resumes');
  assert.equal(CL.tips.check().id, 'reserves');
  CL.tips.dismiss();
  CL.debugTools.endBattleNow(false);
  assert.equal(CL.tips.check('result').id, 'captured');
});

test('a stress battle shows no tips', () => {
  const { CL } = setup();
  CL.debugTools.stressBattle(20);
  assert.equal(CL.tips.check(), null);
  assert.equal(CL.game.paused, false);
});

test('W-05c: leaving the March shows "Beyond the March" once, and How to Play describes the lands', () => {
  const { CL } = setup();
  const c = CL.campaign;
  CL.game.mode = 'map';
  CL.tips.check();
  CL.tips.dismiss(); // the map tip
  c.food = 100;
  const at = (id) => {
    const s = CL.content.get('settlements', id);
    Object.assign(c.world, { x: s.mapX, y: s.mapY });
  };
  for (const id of ['stonebridge', 'eastwatch', 'saltmere']) {
    at(id);
    assert.equal(CL.tips.check(), null, `${id} is in the March`);
  }
  at('hrothgard');
  const t = CL.tips.check();
  assert.equal(t.id, 'beyond');
  assert.equal(t.help, 'lands');
  CL.tips.dismiss();
  at('merrow');
  assert.equal(CL.tips.check(), null, 'once only');
  // How to Play: the lands, after the map, naming every power and the zoom out to the whole realm.
  const topics = Object.values(CL.content.table('help_topics')).sort((a, b) => a.order - b.order).map((h) => h.id);
  assert.equal(topics[topics.indexOf('map') + 1], 'lands');
  const lands = CL.content.get('help_topics', 'lands').body.join(' ');
  for (const k of CL.realm.kingdoms()) assert.ok(lands.includes(k.short), `${k.short} in the lands topic`);
  assert.match(lands, /timber is cheap in the north/);
  assert.match(CL.content.get('help_topics', 'map').body.join(' '), /zoom all the way out to see the whole realm/);
  assert.equal(new Set(topics.map((id) => CL.content.get('help_topics', id).order)).size, topics.length, 'no two topics share a place');
});

test('P11-09: the fighting hints come one at a time, each once, when first relevant, and pause nothing', () => {
  const { CL } = setup();
  const start = (setup2) => {
    setup2?.();
    CL.combat.startBattle({ id: 't', name: 'T', map: 'grass_field', waves: [{ looter: 2 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  };
  start();
  assert.equal(CL.tips.check().id, 'battle', 'the first fight: the controls card first');
  CL.tips.dismiss();
  assert.equal(CL.tips.check(), null, 'nothing new is relevant yet');
  // Each when it comes, once; none pauses the battle.
  const hint = (id, make) => {
    make();
    const t = CL.tips.check();
    assert.equal(t?.id, id);
    assert.equal(CL.game.paused, false, `${id} pauses nothing`);
    CL.tips.dismiss();
    assert.equal(CL.tips.check(), null, `${id}: once`);
  };
  hint('whiff', () => (CL.game.whiffed = true));
  hint('shieldPressure', () => (CL.game.brokeGuard = true));
  // A second weapon carried: the next battle has one to bring to hand.
  CL.campaign.equipment.weapon2 = 'hunting_spear' in CL.content.table('items') ? 'hunting_spear' : 'ash_spear';
  start();
  hint('switch', () => assert.equal(CL.game.loadout.can, true));
  hint('riders', () => CL.game.enemies.push(Object.assign(CL.units.makeUnit(400, 300, 'enemy', 'looter'), { mounted: true, mount: { speed: 140 } })));
  CL.game.hero.ranged = { range: 200 };
  assert.equal(CL.tips.check()?.id, 'draw');
  CL.tips.dismiss();
  // Never again, in a later battle.
  start();
  assert.equal(CL.tips.check(), null);
  // The new hints have touch and key wording, and their topics exist.
  for (const id of ['switch', 'riders', 'draw', 'whiff', 'shieldPressure']) {
    const t = CL.content.get('tips', id);
    assert.ok(t.text || (t.textTouch && t.textKeys), id);
    assert.ok(CL.content.get('help_topics', t.help), id);
  }
});

test('P11-09: How to Play has Fighting by stage: the first fight, the second weapon, bows, horses', () => {
  const { CL } = setup();
  const f = CL.content.get('help_topics', 'fighting');
  assert.deepEqual(JSON.parse(JSON.stringify(f.sections.map((s) => s.title))), ['Your first fight', 'Your second weapon', 'Bows', 'Horses']);
  assert.match(f.sections[1].body.join(' '), /badge on ATTACK.*Q/);
  assert.deepEqual(Array.from(CL.content.validate()), []);
});
