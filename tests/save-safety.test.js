// Save safety and cross-device export/import (GDD §13; §14 Gate E "export/import cross-platform …
// Pass: complete core loop with no critical data loss"; Gate E 5.5).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { newCampaign, mulberry } = require('../scripts/simulate-campaign');
const { makeStoryBot } = require('./helpers/story-bot');

test('a second tab that saves makes this one stop saving, so it cannot overwrite newer progress', () => {
  const { CL, sandbox, storage, uiCalls } = loadGame();
  const handlers = {};
  sandbox.addEventListener = (type, fn) => {
    handlers[type] = fn;
  };
  CL.save.bindTabs();
  assert.equal(CL.save.write(), true);
  handlers.storage({ key: 'crownless_settings' });
  assert.equal(CL.save.stale, false, 'other keys do not matter');
  storage.data[CL.save.KEY] = '{"newer":"progress from the other tab"}';
  handlers.storage({ key: CL.save.KEY });
  assert.equal(CL.save.stale, true);
  CL.campaign.gold = 1;
  assert.equal(CL.save.write(), false);
  assert.equal(storage.data[CL.save.KEY], '{"newer":"progress from the other tab"}', 'the newer save is untouched');
  assert.ok(uiCalls.some((x) => x[0] === 'message' && /open in another tab/.test(x[1])));
});

test('if the latest save is unreadable, the one before it loads — and the player is told', () => {
  const first = loadGame();
  first.CL.campaign.gold = 777;
  first.CL.save.write();
  first.CL.campaign.gold = 888;
  first.CL.save.write(); // the backup now holds 777
  first.storage.data[first.CL.save.KEY] = '{"broken';
  const { CL } = loadGame({ storage: first.storage });
  assert.equal(CL.campaign.gold, 777);
  assert.match(CL.save.notice, /could not be read/);
});

test('save text that went through a chat app still imports: BOM, blank lines, code fences, a note around it', () => {
  const { CL } = loadGame();
  CL.campaign.gold = 4321;
  const text = CL.portable.serialize();
  for (const wrapped of [`﻿${text}`, `\n\n  ${text}  \n`, `\`\`\`json\n${text}\n\`\`\``, `Here is my save:\n${text}\ncheers`]) {
    const r = CL.portable.parse(wrapped);
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.campaign.gold, 4321);
  }
  // Damage inside the save is still caught.
  assert.match(CL.portable.parse(text.replace('4321', '9999')).reason, /checksum/);
});

test('export reminders: once a session, when no copy was ever taken or the last one is a week old', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  c.day = 1;
  assert.equal(CL.portable.reminder(c), null, 'not in the first days');
  c.day = 3.5;
  assert.match(CL.portable.reminder(c), /lives only in this browser/);
  assert.equal(CL.portable.reminder(c), null, 'once a session');
  const again = loadGame();
  again.CL.campaign.day = 10;
  again.CL.portable.markExported();
  assert.equal(again.CL.portable.reminder(again.CL.campaign), null, 'just exported');
  assert.match(again.CL.portable.reminder(again.CL.campaign, Date.now() + 8 * 86400000), /been a while/);
});

test('cross-device: games at every stage export on one device and import identically on another', () => {
  let checked = 0;
  for (const [seed, steps] of [
    [1, 15],
    [2, 60],
    [3, 800],
    [4, 120],
    [13, 800],
  ]) {
    const { CL } = newCampaign(seed);
    const c = CL.campaign;
    c.gold = 3000;
    c.food = 200;
    for (const id of ['footman', 'hunter', 'levy', 'rider']) CL.save.addSoldier(c, id);
    makeStoryBot(CL, mulberry(seed * 31 + 7)).play(steps);
    const text = CL.portable.serialize();
    const other = loadGame({ party: false }); // another browser, another device
    const r = other.CL.portable.importText(text);
    assert.equal(r.ok, true, `seed ${seed}: ${r.reason} ${r.problems || ''}`);
    assert.equal(JSON.stringify(other.CL.campaign), JSON.stringify(CL.save.sanitize(JSON.parse(JSON.stringify(CL.campaign)))), `seed ${seed} identical`);
    checked++;
  }
  assert.equal(checked, 5);
});

test('a save exported by an older build (before reputation, quests, Mara and news) still imports and plays', () => {
  const { CL } = loadGame();
  const old = JSON.parse(JSON.stringify(CL.campaign));
  for (const k of ['story', 'companion', 'news', 'owners', 'reputation', 'contractOffers']) delete old[k];
  const file = JSON.stringify({ format: 'crownless-save', version: 2, game: '0.14.0', exportedAt: '2026-11-16T10:00:00Z', checksum: CL.portable.checksum(JSON.stringify(old)), campaign: old });
  const other = loadGame({ party: false });
  const r = other.CL.portable.importText(file);
  assert.equal(r.ok, true, r.reason);
  const c = other.CL.campaign;
  assert.deepEqual({ ...c.reputation }, { valedorn: 0, aurelian: 0 });
  assert.equal(other.CL.story.questStatus(c, 'q1'), 'unstarted', 'the story begins as new');
  assert.ok(other.CL.story.talk('stonebridge_elder').options.some((o) => /work for me/.test(o.text)), 'and the Elder offers work');
  assert.ok(c.news && c.news.next > c.day);
});
