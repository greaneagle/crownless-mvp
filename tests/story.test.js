// Quest and dialogue interpreter (GDD §4, §13 event-driven quest flags; Gate D 4.7).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, loadContent } = require('./helpers/load');

/** A game with a fixture quest and conversation added to the content tables. */
function withFixture(opts) {
  const env = loadGame(opts);
  const { CL } = env;
  CL.content.table('quests').tq = {
    id: 'tq',
    title: 'Test Quest',
    giver: 'tq_giver',
    summary: 'A quest for tests.',
    stages: [
      {
        id: 'tq_fight',
        journal: 'Clear the looter camp.',
        on: [{ event: 'battle', match: { win: true, site: 'looter_camp' }, do: [{ stage: 'tq_return' }, { note: 'The camp is cleared.' }] }],
      },
      {
        id: 'tq_return',
        journal: 'Return to Eastwatch.',
        on: [{ event: 'enter', match: { settlement: ['eastwatch'] }, if: { flag: 'allowed' }, do: [{ complete: 'tq' }] }],
      },
    ],
    rewards: { gold: 30, renown: 4, rep: { aurelian: 5 } },
  };
  CL.content.table('dialogue').tq_giver = {
    id: 'tq_giver',
    speaker: 'Quest Giver',
    place: 'eastwatch',
    visible: { not: { quest: 'tq', is: 'done' } },
    start: [{ if: { quest: 'tq', is: 'active' }, node: 'waiting' }, 'offer'],
    nodes: {
      offer: {
        text: 'Will you help?',
        options: [
          { text: 'Yes', do: [{ start: 'tq' }], next: 'thanks' },
          { text: 'Pay me first', if: { gold: 1000 }, next: 'thanks' },
          { text: 'No' },
        ],
      },
      thanks: { text: 'Thank you, {name}.', services: false },
      waiting: { text: 'The camp, {name}.' },
    },
  };
  return env;
}

test('conditions: flags, numbers, quests, kingdoms, the hero and the world', () => {
  const { CL } = loadGame();
  const S = CL.story;
  const c = CL.campaign;
  c.gold = 100;
  c.inventory.charter_fragment = 1;
  S.state(c).flags.seen = 'yes';
  const yes = [
    { flag: 'seen' },
    { flag: 'seen', is: 'yes' },
    { not: { flag: 'other' } },
    { gold: 100 },
    { gold: { gte: 50, lte: 150 } },
    { any: [{ gold: 999 }, { renown: 0 }] },
    [{ gold: 1 }, { flag: 'seen' }],
    { quest: 'q1', is: 'unstarted' },
    { rep: 'valedorn', gte: 0 },
    { standing: 'aurelian', is: 'neutral' },
    { background: 'farmhand' },
    { has: 'charter_fragment' },
    { has: 'worn_sword' }, // equipped counts
    { owner: 'greywall_fort', is: 'valedorn' },
    { at: 'stonebridge' },
    { level: 1 },
    { soldiers: 5 },
    { skill: 'trade', gte: 0 },
    { attribute: 'str', gte: 1 },
  ];
  for (const cond of yes) assert.equal(S.test(cond, c), true, JSON.stringify(cond));
  const no = [{ flag: 'other' }, { flag: 'seen', is: 'no' }, { gold: 101 }, { gold: { lte: 99 } }, { all: [{ gold: 1 }, { gold: 1000 }] }, { quest: 'q1' }, { background: 'scout' }, { has: 'mara_token' }, { soldiers: 6 }];
  for (const cond of no) assert.equal(S.test(cond, c), false, JSON.stringify(cond));
});

test('effects change the campaign, never below zero; recruits respect the party cap', () => {
  const { CL } = loadGame();
  const S = CL.story;
  const c = CL.campaign;
  c.gold = 10;
  S.apply([{ set: 'a' }, { set: 'b', to: 3 }, { gold: -50 }, { renown: 5 }, { give: 'courier_packet' }, { rep: 'aurelian', by: 30 }, { owner: 'ashgate_fort', to: 'valedorn' }], c);
  assert.deepEqual({ ...S.state(c).flags }, { a: true, b: 3 });
  assert.equal(c.gold, 0);
  assert.equal(c.renown, 5);
  assert.equal(c.inventory.courier_packet, 1);
  assert.equal(CL.realm.standing(c, 'aurelian'), 'friendly');
  assert.equal(CL.realm.owner('ashgate_fort', c), 'valedorn');
  S.apply([{ take: 'courier_packet' }, { clear: 'a' }], c);
  assert.equal('courier_packet' in c.inventory, false);
  assert.equal('a' in S.state(c).flags, false);
  const cap = CL.party.partyCap(c);
  S.apply([{ recruit: 'levy', n: 50 }], c);
  assert.equal(c.roster.length, cap);
});

test('quests start once, move through stages and pay their rewards once', () => {
  const { CL } = withFixture();
  const S = CL.story;
  const c = CL.campaign;
  assert.equal(S.start(c, 'tq'), true);
  assert.equal(S.start(c, 'tq'), false, 'already started');
  assert.equal(S.test({ quest: 'tq', stage: 'tq_fight' }, c), true);
  assert.equal(S.setStage(c, 'tq', 'nope'), false);
  const gold = c.gold;
  assert.equal(S.finish(c, 'tq', 'done'), true);
  assert.equal(S.finish(c, 'tq', 'done'), false, 'paid once');
  assert.equal(c.gold, gold + 30);
  assert.equal(c.reputation.aurelian, 5);
  assert.equal(S.questStatus(c, 'tq'), 'done');
});

test('a won battle at the right site moves the quest on; the wrong event or a loss does not', () => {
  const { CL } = withFixture({ random: () => 0.99 });
  const S = CL.story;
  const c = CL.campaign;
  S.start(c, 'tq');
  assert.equal(S.emit('battle', { win: true, site: 'reaver_hideout' }), 0);
  assert.equal(S.emit('battle', { win: false, site: 'looter_camp' }), 0);
  assert.equal(S.emit('enter', { settlement: 'eastwatch' }), 0, 'not the current stage');
  // The real battle path emits the event.
  CL.game.siteId = 'looter_camp';
  CL.game.partyId = null;
  CL.combat.startBattle(CL.content.encounter('looter_band'));
  CL.debugTools.endBattleNow(true);
  assert.equal(S.state(c).quests.tq.stage, 'tq_return');
  assert.deepEqual(Array.from(S.state(c).quests.tq.notes), ['The camp is cleared.']);
  // A trigger with a failing condition waits.
  assert.equal(S.emit('enter', { settlement: 'eastwatch' }), 0);
  S.state(c).flags.allowed = true;
  assert.equal(S.emit('enter', { settlement: 'stonebridge' }), 0, 'match lists are any-of');
  assert.equal(S.emit('enter', { settlement: 'eastwatch' }), 1);
  assert.equal(S.questStatus(c, 'tq'), 'done');
});

test('game actions emit story events: arriving, recruiting, trading, collecting a contract', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const seen = [];
  const emit = CL.story.emit;
  CL.story.emit = (name, payload, camp) => {
    seen.push([name, payload]);
    return emit(name, payload, camp);
  };
  c.gold = 1000;
  CL.party.recruit('levy');
  CL.trade.buy(c, 'stonebridge', 'grain');
  CL.trade.sell(c, 'stonebridge', 'grain');
  c.food = 99;
  CL.contracts.accept(c, 'stonebridge');
  const p = CL.parties.find(c, c.contract.partyId);
  CL.contracts.onTargetDefeated(c, p);
  CL.contracts.collect(c);
  const names = seen.map((s) => s[0]);
  for (const n of ['recruit', 'trade', 'contract']) assert.ok(names.includes(n), n);
  assert.deepEqual({ ...seen.find((s) => s[0] === 'trade')[1] }, { settlement: 'stonebridge', good: 'grain', side: 'buy', qty: 1 });
});

test('Elder Maren: background lines compose, choices set flags, the start node follows them', () => {
  const { CL } = loadGame();
  const S = CL.story;
  const c = CL.campaign;
  let v = S.talk('story_elder');
  assert.equal(v.node, 'first');
  assert.match(v.text, /Welcome to Stonebridge, .*farmer’s hands/);
  assert.doesNotMatch(v.text, /peddler/);
  assert.deepEqual(
    Array.from(v.options.map((o) => o.text)),
    ['Is there work for me?', 'What troubles Stonebridge?', 'Only passing through.'],
  );
  v = S.choose(v, 1);
  assert.equal(v.node, 'troubles');
  assert.equal(v.services, false, 'no shop menu during the story beat');
  assert.equal(S.state(c).flags.met_elder, true);
  v = S.choose(v, 0);
  assert.match(v.text, /Crown’s blue/);
  CL.realm.setOwner(c, 'greywall_fort', 'aurelian');
  v = S.view('story_elder', 'greywall');
  assert.match(v.text, /Aurelian red/);
  assert.equal(S.choose(v, 0), null, 'the talk ends');
  assert.equal(S.state(c).flags.heard_charter, true);
  v = S.talk('story_elder');
  assert.equal(v.node, 'again');
  assert.ok(v.options.some((o) => /Greywall/.test(o.text)), 'the follow-up question unlocks');
});

test('cycling nodes rotate through their matching lines', () => {
  const { CL } = loadGame();
  const a = CL.story.talk('crown_agent').text;
  const b = CL.story.talk('crown_agent').text;
  assert.notEqual(a, b);
});

test('an option whose condition fails cannot be chosen', () => {
  const { CL } = withFixture();
  const v = CL.story.talk('tq_giver');
  assert.deepEqual(
    Array.from(v.options.map((o) => o.text)),
    ['Yes', 'No'],
  );
  const pay = { ...v, options: v.options };
  assert.equal(CL.story.choose(pay, 1), pay, 'hidden option ignored');
  assert.equal(CL.story.questStatus(CL.campaign, 'tq'), 'unstarted');
});

test('people at menu-only settlements; the journal and HUD show the current quest', () => {
  const { CL } = withFixture();
  const S = CL.story;
  const c = CL.campaign;
  assert.ok(S.peopleAt('eastwatch').some((t) => t.id === 'tq_giver'));
  assert.deepEqual(Array.from(S.peopleAt('stonebridge').map((t) => t.id)), ['crown_agent'], 'P10-04: your realm’s envoy, cast to your start town');
  assert.deepEqual(Array.from(S.journal()), []);
  assert.equal(S.currentQuest(), null);
  const v = S.choose(S.talk('tq_giver'), 0);
  assert.equal(v.text, `Thank you, ${c.character.name}.`);
  assert.equal(S.talk('tq_giver').node, 'waiting');
  assert.deepEqual({ ...S.currentQuest() }, { id: 'tq', title: 'Test Quest', objective: 'Clear the looter camp.' });
  const [row] = S.journal();
  assert.equal(row.status, 'active');
  assert.equal(row.objective, 'Clear the looter camp.');
  S.finish(c, 'tq', 'done');
  assert.equal(
    S.peopleAt('eastwatch').some((t) => t.id === 'tq_giver'),
    false,
    'hidden once done',
  );
  assert.equal(S.journal()[0].status, 'done');
});

test('story state survives save and reload; junk is dropped', () => {
  const { CL } = withFixture();
  const c = CL.campaign;
  CL.story.start(c, 'tq');
  CL.story.setStage(c, 'tq', 'tq_return');
  CL.story.state(c).flags.picked = 'valedorn';
  CL.story.talk('story_elder');
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.story.quests.tq.stage, 'tq_return');
  assert.equal(s.story.flags.picked, 'valedorn');
  assert.equal(s.story.visits.story_elder, 1);

  const junk = CL.save.sanitize({
    version: 2,
    roster: [],
    story: {
      flags: { ok: 1, bad: { x: 1 }, worse: [1] },
      quests: { tq: { status: 'active', stage: 'gone' }, nope: { status: 'active' }, q2: { status: 'weird' } },
      visits: { nobody: 3, mara: -1 },
    },
  });
  assert.deepEqual({ ...junk.story.flags }, { ok: 1 });
  assert.deepEqual(Object.keys(junk.story.quests), ['tq']);
  assert.equal(junk.story.quests.tq.stage, 'tq_fight', 'an unknown stage falls back to the first');
  assert.deepEqual({ ...junk.story.visits }, {});
  assert.deepEqual({ ...CL.save.sanitize({ version: 2, roster: [] }).story.quests }, {}, 'older saves start blank');
});

test('content checks catch broken dialogue and quests', () => {
  const { CL } = loadGame();
  const C = loadContent();
  C.dialogue.broken = {
    id: 'broken',
    speaker: 'X',
    start: 'nowhere',
    nodes: { a: { text: 'hi', options: [{ text: 'go', next: 'missing', if: { dragons: 1 }, do: [{ give: 'unicorn' }, { explode: true }] }] } },
  };
  C.quests.bad = { id: 'bad', title: 'Bad', giver: 'nobody', stages: [{ id: 's', journal: 'x', on: [{ event: 'sneeze', do: [{ stage: 'zzz' }] }] }] };
  const errors = [];
  CL.story.validate(C, (e) => errors.push(e));
  for (const want of [/start goes to unknown node/, /unknown node missing/, /unknown condition/, /unknown item unicorn/, /unknown effect/, /no dialogue for giver/, /unknown event sneeze/, /unknown stage zzz/]) {
    assert.ok(
      errors.some((e) => want.test(e)),
      `${want} in ${errors.join(' | ')}`,
    );
  }
  assert.deepEqual(Array.from(CL.content.validate()), [], 'the shipped content is clean');
});
