// H-01: test games are isolated from each other. A seeded battle gives the same result in a fresh
// process as after other games have run in this one, even while a script has patched the host's
// Math.random. (The V2-T2 leak: every sandbox shared the host Math, so a run depended on what ran
// before it.)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const { loadGame, mulberry } = require('./helpers/load');
const { seededFight } = require('./helpers/seeded-fight');

const SCRIPT = path.join(__dirname, 'helpers', 'seeded-fight.js');
const fresh = (seed) => JSON.parse(execFileSync(process.execPath, [SCRIPT, String(seed)], { encoding: 'utf8' }));

test('a seeded fight gives the same result in a fresh process and after other games in this one', () => {
  const alone = fresh(7);
  assert.equal(alone.mode, 'result', 'the fight ends');

  // Other games first: different seeds, unseeded games, and a host Math.random patched meanwhile.
  const hostRandom = Math.random;
  try {
    Math.random = mulberry(99);
    seededFight(3);
    for (let i = 0; i < 3; i++) {
      const { CL } = loadGame();
      CL.combat.startBattle({ id: 'x', name: 'x', map: 'open_country', waves: [{ looter: 4 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
      for (let s = 0; s < 400 && CL.game.mode === 'battle'; s++) CL.combat.update(0.02);
    }
    assert.deepEqual(seededFight(7), alone, 'with the host Math.random patched');
  } finally {
    Math.random = hostRandom;
  }
  assert.deepEqual(seededFight(7), alone, 'after the other games');
});

test('each game has its own Math: a test game never touches the host one, nor another game’s', () => {
  const a = loadGame({ random: () => 0.25 });
  const b = loadGame();
  const mathOf = (env) => vm.runInContext('Math', env.sandbox);
  assert.notEqual(mathOf(a), Math);
  assert.notEqual(mathOf(b), Math);
  assert.notEqual(mathOf(a), mathOf(b));
  assert.equal(mathOf(a).random(), 0.25);
  assert.notEqual(Math.random, mathOf(a).random, 'the host Math.random is untouched');
  // Without a `random`, a game's Math.random follows its seed.
  const draws = (env) => Array.from({ length: 5 }, () => mathOf(env).random());
  assert.deepEqual(draws(loadGame({ seed: 5 })), draws(loadGame({ seed: 5 })));
  assert.notDeepEqual(draws(loadGame({ seed: 5 })), draws(loadGame({ seed: 6 })));
});
