// Mara, the companion (GDD §10; Gate D 4.8–4.12): recruitment, party slot, Pathfinding, battle, wounds.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

function say(CL, conv, re) {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
}

/** A campaign that has finished Q2 with the given choice. */
function afterQ2(choice = 'crown', opts) {
  const env = loadGame(opts);
  const { CL } = env;
  const s = CL.story.state(CL.campaign);
  s.quests.q2 = { status: 'done', stage: null, notes: [], startedDay: 0, endedDay: 0 };
  s.flags.q2_choice = choice;
  return env;
}

/** Walk Mara's questions with the given packet answer. */
function interview(CL, answer) {
  let v = CL.story.talk('mara');
  assert.equal(v.node, 'meet');
  v = say(CL, v, /ask me/);
  v = say(CL, v, answer);
  assert.equal(v.node, 'why');
  return say(CL, v, /people on these roads/);
}

const npcIds = (CL) => {
  CL.town.enter('stonebridge');
  return CL.game.town.npcs.map((n) => n.id);
};

test('Mara waits by the inn in Stonebridge only after Q2, and leaves the street once she joins', () => {
  const { CL } = loadGame();
  assert.equal(npcIds(CL).includes('mara'), false, 'not before Q2');
  const s = CL.story.state(CL.campaign);
  s.quests.q2 = { status: 'done', stage: null, notes: [], startedDay: 0 };
  s.flags.q2_choice = 'kept';
  assert.ok(npcIds(CL).includes('mara'));
  CL.companion.join(CL.campaign, 'mara');
  CL.town.backToPlace();
  assert.equal(
    CL.game.town.npcs.some((n) => n.id === 'mara'),
    false,
  );
});

test('the trust dialogue: an honest answer and she joins for nothing', () => {
  const { CL } = afterQ2('rival');
  const c = CL.campaign;
  const gold = c.gold;
  let v = interview(CL, /Magistrate Vell/);
  assert.match(v.text, /no coin/);
  v = say(CL, v, /Welcome to the company/);
  assert.equal(v.node, 'joined');
  assert.equal(CL.companion.has(c, 'mara'), true);
  assert.equal(c.gold, gold);
  assert.equal(CL.story.talk('mara').node, 'with_us');
});

test('lie to her, or keep your counsel, and she wants 100 crowns', () => {
  for (const [answer, lied] of [
    [/Captain Aldric/, true],
    [/my business/, false],
  ]) {
    const { CL } = afterQ2('kept');
    const c = CL.campaign;
    c.gold = 150;
    const v = interview(CL, answer);
    assert.equal(Boolean(CL.story.state(c).flags.mara_lied), lied);
    assert.match(v.text, /hundred crowns/);
    assert.equal(
      v.options.some((o) => /Welcome/.test(o.text)),
      false,
    );
    say(CL, v, /Pay 100/);
    assert.equal(c.gold, 50);
    assert.equal(CL.companion.has(c), true);
  }
});

test('no money or no room: she waits, and the offer stands', () => {
  const { CL } = afterQ2('kept');
  const c = CL.campaign;
  c.gold = 10;
  let v = interview(CL, /my business/);
  assert.equal(
    v.options.some((o) => /Pay 100/.test(o.text)),
    false,
  );
  assert.equal(say(CL, v, /Not now/), null);
  c.gold = 500;
  while (c.roster.length < CL.party.partyCap(c)) CL.save.addSoldier(c, 'levy');
  v = CL.story.talk('mara');
  assert.equal(v.node, 'verdict', 'she remembers the interview');
  assert.ok(v.options.some((o) => /company is full/.test(o.text)));
  assert.equal(CL.companion.join(c, 'mara'), false);
  c.roster.pop();
  say(CL, CL.story.talk('mara'), /Pay 100/);
  assert.equal(CL.companion.has(c), true);
});

test('she takes a party slot and eats', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const eaters = CL.upkeep.partySize(c);
  const cap = CL.party.partyCap(c);
  while (c.roster.length < cap - 1) CL.save.addSoldier(c, 'levy');
  c.gold = 999;
  assert.equal(CL.party.canRecruit(c, 'levy'), true);
  CL.companion.join(c, 'mara');
  // P9-B3: she takes the last slot, but as an officer she brings ten more.
  assert.equal(CL.party.headcount(c), cap, 'the last slot is hers');
  assert.equal(CL.party.partyCap(c), cap + CL.party.LIMIT.officer);
  assert.equal(CL.party.canRecruit(c, 'levy'), true, 'and room for more under her');
  assert.equal(CL.upkeep.partySize(c), eaters + (cap - 1 - 5) + 1, 'the new soldiers and Mara all eat');
});

test('+1 Pathfinding while fit, none while wounded', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const base = CL.character.skill('pathfinding', c);
  const speed = CL.character.travelFactor(c);
  CL.companion.join(c, 'mara');
  assert.equal(CL.character.skill('pathfinding', c), base + 1);
  assert.ok(CL.character.travelFactor(c) > speed);
  CL.companion.wound(c, 'test');
  assert.equal(CL.character.skill('pathfinding', c), base);
  CL.party.advanceDays(2.01);
  assert.equal(CL.companion.fit(c), true, 'back after her wound days');
});

test('she fights beside the hero with her own look; her gear sets her numbers', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.companion.join(c, 'mara');
  assert.equal(CL.companion.combat(c).damage, 17 * 0.75, 'worn sword');
  c.inventory.arming_sword = 1;
  c.inventory.iron_helm = 1;
  assert.equal(CL.companion.give(c, 'iron_helm'), false, 'weapon and body armour only');
  assert.equal(CL.companion.give(c, 'arming_sword'), true);
  assert.equal(c.inventory.worn_sword >= 1, true, 'her old sword goes to the pack');
  assert.equal('arming_sword' in c.inventory, false);
  assert.equal(CL.companion.combat(c).damage, 21 * 0.75);
  assert.equal(CL.companion.combat(c).armor, 1 + 2, 'base + gambeson');
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const u = CL.game.allies.find((a) => a.companion === 'mara');
  assert.ok(u);
  assert.equal(u.damage, 21 * 0.75);
  assert.deepEqual(Array.from(u.frames), [124, 125, 126, 127]);
  assert.equal(u.soldierId, null, 'never rolled as a soldier casualty');
  assert.equal(CL.companion.takeBack(c, 'weapon'), true);
  assert.equal(CL.companion.combat(c).damage, 6, 'unarmed');
});

test('going down in battle wounds her; she is never killed; wounded she stays in camp', () => {
  const { CL } = loadGame({ random: () => 0.99 });
  const c = CL.campaign;
  CL.companion.join(c, 'mara');
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  CL.game.allies.find((a) => a.companion).alive = false;
  CL.debugTools.endBattleNow(true);
  assert.equal(CL.companion.has(c), true);
  assert.equal(CL.companion.fit(c), false);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  assert.equal(
    CL.game.allies.some((a) => a.companion),
    false,
  );
});

test('auto-resolve counts her strength; a loss (capture) wounds her', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  const before = CL.autoresolve.playerPower(c);
  CL.companion.join(c, 'mara');
  assert.ok(CL.autoresolve.playerPower(c) > before);
  CL.companion.afterBattle(c, { win: false, down: false });
  assert.equal(CL.companion.fit(c), false);
  assert.equal(CL.autoresolve.playerPower(c), before, 'wounded, she adds nothing');
});

test('saved and reloaded; junk is dropped', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.companion.join(c, 'mara');
  CL.companion.wound(c, 'test');
  const s = CL.save.sanitize(JSON.parse(JSON.stringify(c)));
  assert.equal(s.companion.id, 'mara');
  assert.equal(s.companion.woundedUntil, c.companion.woundedUntil);
  assert.deepEqual({ ...s.companion.equipment }, { weapon: 'worn_sword', body: 'gambeson' });
  const junk = CL.save.sanitize({ version: 2, roster: [], companion: { id: 'mara', woundedUntil: 'x', equipment: { weapon: 'gambeson', body: 'dragon' } } });
  assert.deepEqual({ ...junk.companion.equipment }, { weapon: null, body: null });
  assert.equal(junk.companion.woundedUntil, null);
  assert.equal(CL.save.sanitize({ version: 2, roster: [], companion: { id: 'ghost' } }).companion, null);
});

test('the story can part her for good: her gear comes back and she will not rejoin', () => {
  const { CL } = loadGame();
  const c = CL.campaign;
  CL.companion.join(c, 'mara');
  CL.story.apply([{ part: 'mara', reason: 'fell' }], c);
  assert.equal(CL.companion.has(c), false);
  assert.equal(CL.story.state(c).flags.mara_gone, 'fell');
  assert.ok(c.inventory.gambeson >= 1);
  assert.equal(CL.companion.join(c, 'mara'), false);
  assert.equal(CL.story.test({ companion: 'mara' }, c), false);
});
