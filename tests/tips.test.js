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
