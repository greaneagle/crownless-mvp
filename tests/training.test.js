// P11-17: specialist lessons, the safe practice yard, and paid retraining.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { fly } = require('./helpers/pilots');

function setup(content) {
  const { CL } = loadGame({ content });
  const c = CL.campaign;
  Object.assign(c.character.attributes, { str: 8, agi: 6 });
  Object.assign(c.character.skills, { riding: 3, archery: 3, two_handed: 3, polearm: 3 });
  c.gold = 300;
  return { CL, c, T: CL.training };
}

const plain = (v) => JSON.parse(JSON.stringify(v));

function enroll(T, c, m) {
  c.world.location = m.place;
  assert.equal(T.hear(c, m), true);
  const gold = c.gold;
  assert.equal(T.pay(c, m), true);
  assert.equal(T.pay(c, m), false);
  assert.equal(c.gold, gold - m.fee);
}

for (const id of ['hrolf', 'alda', 'verrin', 'selim']) {
  test(`${id}: the specialist drills finish in one or two sessions and grant the unlock once`, (t) => {
    const { CL, c, T } = setup();
    const m = T.table()[id];
    enroll(T, c, m);
    const drills = m.steps.slice(2);
    for (const step of drills) {
      assert.equal(T.done(c, m), false);
      assert.equal(T.lesson(c, m), true);
      assert.equal(Boolean(CL.game.hero.mounted), step.kind === 'course');
      const pilot = step.kind === 'bout' ? 'masher' : step.weapon === 'war_lance' ? 'rider' : 'archer';
      const result = fly(CL, pilot, { maxSteps: 1200 });
      t.diagnostic(`${step.kind}: ${result.seconds.toFixed(2)} seconds`);
      assert.equal(result.win, true);
    }
    assert.equal(T.done(c, m), true);
    assert.equal(T.lesson(c, m), false);
    assert.equal(T.end(true), undefined);
    assert.equal(c.chronicle.filter((e) => e.kind === 'practice').length, drills.length);
    const copy = CL.save.sanitize(plain(c));
    assert.equal(T.done(copy, m), true);
    assert.equal(T.entry(copy, m).step, m.steps.length);
  });
}

test('failure and interrupted attempts wait a day, retry on the fee, and abandoning resets the steps', () => {
  const { CL, c, T } = setup();
  const m = T.table().hrolf;
  enroll(T, c, m);
  assert.equal(T.lesson(c, m), true);
  const restored = CL.save.sanitize(plain(c));
  assert.equal(T.entry(restored, m).retryAt, c.day + 1);
  assert.equal(T.entry(restored, m).attempt, undefined);
  CL.party.endBattle(false);
  const paid = c.gold;
  assert.equal(T.lesson(c, m), false);
  c.day++;
  assert.equal(T.lesson(c, m), true);
  assert.equal(c.gold, paid);
  CL.party.endBattle(false);
  assert.equal(T.abandon(c, m), true);
  assert.equal(T.entry(c, m).step, 0);
  assert.equal(T.hear(c, m), true);
  assert.equal(T.entry(c, m).step, 1);
  assert.equal(c.gold, paid);
});

test('ownership keeps the local master and war moves the lesson and gear hint to a free port', () => {
  const { CL, c, T } = setup();
  const m = T.table().hrolf;
  enroll(T, c, m);
  assert.deepEqual(Array.from(T.locations(c, m)), [m.place]);
  assert.equal(CL.realm.transfer(c, m.place, { controller: 'aurelian', capital: true }), true);
  assert.deepEqual(Array.from(T.locations(c, m)), [m.place]);
  CL.realm.adjust(c, 'aurelian', -100);
  const [port] = T.locations(c, m);
  assert.notEqual(port, m.place);
  assert.equal(CL.realm.faction(CL.realm.owner(port, c)).freeCity, true);
  const finding = CL.gear.unmet(c, 'hrothmark_longaxe').find((x) => x.code === 'training');
  assert.ok(finding.text.includes(CL.content.table('settlements')[port].name));
  assert.equal(T.lesson(c, m), false);
  c.world.location = port;
  assert.equal(T.lesson(c, m), true);
  assert.equal(fly(CL, 'masher', { maxSteps: 1200 }).win, true);
  assert.equal(T.done(c, m), true);
  assert.deepEqual(Array.from(T.locations(c, T.table().selim)), ['merrow', 'gullhaven']);
});

test('a master refunds spent points for crowns, preserves unlocks, and caps the teaching bonus', () => {
  const { CL, c, T } = setup();
  const m = T.table().hrolf;
  c.world.location = m.place;
  c.character.training.longaxe = true;
  c.character.skills.two_handed = CL.character.MAX_SKILL;
  assert.equal(CL.character.baseSkill('two_handed', c), CL.character.MAX_SKILL);
  c.character.skills.two_handed = 3;
  assert.equal(CL.character.skill('two_handed', c), 4);
  c.character.skillPoints = 1;
  c.character.attributePoints = 1;
  CL.character.spendSkill('two_handed', c);
  CL.character.spendAttribute('str', c);
  assert.deepEqual(plain(T.retrain(c, m)), { attributes: 1, skills: 1 });
  assert.equal(c.gold, 200);
  assert.equal(c.character.training.longaxe, true);
  assert.equal(CL.character.skill('two_handed', c), 4);
  assert.equal(T.retrain(c, m), false);
});

test('the practice yard uses your kit and leaves the campaign alone except for the record', () => {
  const { CL, c, T } = setup();
  c.world.location = 'hrothgard';
  c.equipment.weapon = 'short_bow';
  const snapshot = () => {
    const { chronicle, ...rest } = c;
    return plain(rest);
  };
  const before = snapshot();
  assert.equal(T.practice(c, 'range'), true);
  assert.ok(CL.game.enemies.every((u) => u.drillTarget && u.speed === 0));
  assert.equal(fly(CL, 'archer', { maxSteps: 1200 }).win, true);
  assert.deepEqual(snapshot(), before);
  assert.equal(c.chronicle.at(-1).kind, 'practice');
  const copy = CL.save.sanitize(plain(c));
  assert.equal(copy.chronicle.at(-1).event, 'range');
  assert.equal(CL.chronicle.text(copy.chronicle.at(-1)), 'Completed: Archery range at Hrothgard.');
});

test('a mounted course cannot pass after dismounting', () => {
  const { CL, c, T } = setup();
  const m = T.table().alda;
  enroll(T, c, m);
  assert.equal(T.lesson(c, m), true);
  CL.combat.dismount();
  CL.party.endBattle(true);
  assert.equal(T.done(c, m), false);
  assert.equal(CL.game.result.win, false);
});

test('news and the Journal tell a qualified hero where their master is', () => {
  const { c, T } = setup();
  T.tick(c);
  const news = c.news.events.at(-1);
  assert.equal(news.kind, 'master_training');
  assert.match(news.text, /Master Hrolf.*Hrothgard/);
  assert.match(T.journal(c)[0], /Speak to the master/);
  assert.match(T.townRumour(c, 'merrow'), /Master Selim.*Merrow/);
  assert.ok(T.journal(c).some((line) => /Master Selim/.test(line)));
});

test('the content checker catches bad instructor roles, unlocks and drill items', () => {
  const { CL } = setup((C) => {
    Object.assign(C.training.hrolf, { role: 'fool', teaches: ['missing'], steps: [{ kind: 'talk' }, { kind: 'pay' }, { kind: 'range', weapon: 'boots' }] });
  });
  const errors = Array.from(CL.content.validate());
  assert.ok(errors.some((s) => s.includes('training hrolf: needs a master, role')));
  assert.ok(errors.some((s) => s.includes('training hrolf: invalid drill')));
  assert.ok(errors.some((s) => s.includes('regional unlock longaxe has no instructor')));
});

test('an authored lesson advances on the right tournament round and contract reward', () => {
  const { CL, c, T } = setup((C) => {
    Object.assign(C.training.alda, { steps: [
      { kind: 'talk' }, { kind: 'pay' },
      { kind: 'challenge', host: 'stonebridge', round: 2 },
      { kind: 'favour', template: 'bandit_hunt' }
    ] });
  });
  assert.deepEqual(Array.from(CL.content.validate()), []);
  const m = T.table().alda;
  enroll(T, c, m);
  c.tourney.hosts.stonebridge.next = c.day;
  CL.tourney.tick(c);
  assert.equal(CL.tourney.enter(c, 'stonebridge').ok, true);
  assert.equal(T.entry(c, m).step, 2);
  assert.equal(CL.tourney.fight(c), true);
  CL.debugTools.endBattleNow(true);
  assert.equal(T.entry(c, m).step, 3);
  assert.equal(T.done(c, m), false);
  assert.equal(CL.contracts.accept(c, 'stonebridge').ok, true);
  CL.contracts.onTargetDefeated(c, CL.parties.find(c, c.contract.partyId));
  assert.ok(CL.contracts.collect(c));
  assert.equal(T.done(c, m), true);
  assert.equal(CL.contracts.collect(c), null);
});
