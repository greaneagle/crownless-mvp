// P7-07: soldier traits. Earned once at a milestone of the soldier's own record (never at random), told,
// noted, kept in saves and on the roll of honour; and each one measurably changes battles, fought and
// simulated.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

const plain = (v) => JSON.parse(JSON.stringify(v));

/** A company of `n` footmen, all with `trait` (or none). */
function company(trait = null, n = 6, opts = {}) {
  const env = loadGame({ random: () => 0.5, ...opts });
  const { CL, uiCalls } = env;
  const c = CL.campaign;
  c.roster = [];
  for (let i = 0; i < n; i++) {
    const s = CL.save.addSoldier(c, 'footman');
    if (trait) s.trait = trait;
  }
  const messages = () => uiCalls.filter((u) => u[0] === 'message').map((u) => u[1]);
  return { ...env, c, T: CL.traits, messages };
}

/** A small seeded random stream (mulberry32), so each fought battle is the same every run. */
const seeded = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A fought battle on open grass, the soldiers charging and the hero standing aside, until it ends. */
function fight(CL, enemies, seconds = 240) {
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [enemies], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  g.godMode = true; // the hero survives, out of the way: the soldiers do the fighting
  Object.assign(g.hero, { x: 60, y: 60 });
  g.orders.infantry = 'charge';
  let t = 0;
  for (; t < seconds && g.mode === 'battle'; t += 0.05) CL.combat.update(0.05);
  return g;
}

test('earned at milestones of their own record, once; the first reached decides, and it is told', () => {
  const { CL, c, T, messages } = company();
  const [a, b, d] = c.roster;
  const battle = (ids, extra = {}) => CL.events.emit(c, 'BattleResolved', { win: true, participants: ids, soldierKills: {}, soldierAssists: {}, encounterName: 'Road Reavers', ...extra });
  for (let i = 0; i < 7; i++) battle([a.id]);
  assert.equal(a.trait, undefined, '7 battles: not yet');
  battle([a.id]);
  assert.equal(a.trait, 'steadfast', 'at 8 battles');
  assert.match(messages().at(-1), / has become Steadfast after 8 battles with the company\.$/);
  assert.equal(CL.soldiers.noteText(a.notes.at(-1)), 'Became Steadfast after 8 battles with the company.');
  // Once: a later milestone changes nothing, and says nothing.
  const said = messages().length;
  battle([a.id], { soldierKills: { [a.id]: 9 } });
  assert.equal(a.trait, 'steadfast');
  assert.equal(messages().length, said);
  assert.equal(a.notes.filter((n) => n.kind === 'trait').length, 1);
  // Wounds: Cautious at the second.
  CL.events.emit(c, 'SoldierWounded', { soldierId: b.id });
  assert.equal(b.trait, undefined);
  CL.events.emit(c, 'SoldierWounded', { soldierId: b.id });
  assert.equal(b.trait, 'cautious');
  // Kills: Impulsive at 8.
  battle([d.id], { soldierKills: { [d.id]: 5 } });
  assert.equal(d.trait, undefined);
  battle([d.id], { soldierKills: { [d.id]: 3 } });
  assert.equal(d.trait, 'impulsive');
  assert.deepEqual(Object.keys(T.TRAITS), ['steadfast', 'cautious', 'impulsive']);
});

test('kept in saves and on the roll of honour; junk dropped', () => {
  const { CL, c } = company();
  const [a, b] = c.roster;
  a.trait = 'impulsive';
  CL.soldiers.note(a, { day: c.day, kind: 'trait', trait: 'impulsive' });
  b.trait = 'bogus';
  const back = CL.save.fromRaw(plain(c)).campaign;
  assert.equal(back.roster[0].trait, 'impulsive');
  assert.equal(back.roster[0].notes.at(-1).trait, 'impulsive');
  assert.equal('trait' in back.roster[1], false, 'an unknown trait is dropped');
  CL.chronicle.honour(c, a, 'retired');
  const h = c.honour.list.at(-1);
  assert.equal(h.trait, 'impulsive');
  assert.match(CL.chronicle.honourText(h).title, /· Impulsive$/);
  assert.equal(CL.save.fromRaw(plain(c)).campaign.honour.list.at(-1).trait, 'impulsive');
});

test('Steadfast: their group holds together, by a stated amount', () => {
  const plainCo = company(null, 6);
  const steady = company('steadfast', 6);
  const target = ({ CL }) => {
    CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 6 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
    CL.combat.update(0.001);
    return CL.morale.targetFor(CL.game, 'ally', 'infantry');
  };
  const [p, s] = [target(plainCo), target(steady)];
  assert.equal(p.parts.steadfast, undefined);
  assert.equal(s.parts.steadfast, steady.T.COHESION_MAX, 'six of them: capped');
  assert.equal(s.total, Math.min(100, p.total + steady.T.COHESION_MAX), 'cohesion is 0–100');
  // Where it counts: a group that has lost half its number holds on the right side of wavering.
  const half = (e) => {
    target(e); // the battle, and its groups' records
    const g = e.CL.game;
    for (const u of g.allies.filter((x) => x.soldierId != null).slice(0, 3)) Object.assign(u, { alive: false, hp: 0 });
    return e.CL.morale.targetFor(g, 'ally', 'infantry').total;
  };
  const [hp, hs] = [half(company(null, 6)), half(company('steadfast', 6))];
  assert.ok(hs - hp >= steady.T.COHESION * 1.5 - 1e-9, `half lost: ${hp.toFixed(1)} plain, ${hs.toFixed(1)} steadfast`);
  assert.equal(steady.T.cohesion([{ trait: 'steadfast' }, {}, {}]), steady.T.COHESION, 'one in three: one share');
});

test('Impulsive and Cautious: what each blow does, and how soon they go in', () => {
  const { CL } = company(null, 1);
  CL.combat.startBattle({ id: 't', name: 't', map: 'grass_field', waves: [{ looter: 1 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } });
  const g = CL.game;
  const [e] = g.enemies;
  const [u] = g.allies;
  const taken = (trait) => {
    u.trait = trait;
    u.hp = u.maxhp;
    Object.assign(u, { x: 400, y: 300, face: 'right', guard: false });
    Object.assign(e, { x: 380, y: 300 });
    CL.combat.hit(u, 30, e);
    return u.maxhp - u.hp;
  };
  const base = taken(undefined);
  assert.ok(taken('impulsive') > base, 'an impulsive soldier takes more');
  assert.ok(taken('cautious') < base, 'a cautious one takes less');
  const dealt = (trait) => {
    u.trait = trait;
    e.hp = e.maxhp = 500;
    e.alive = true;
    e.guard = false;
    Object.assign(e, { x: 420, y: 300, face: 'left' });
    Object.assign(u, { x: 400, y: 300, face: 'right' });
    CL.combat.hit(e, 30, u);
    return 500 - e.hp;
  };
  assert.ok(dealt('impulsive') > dealt(undefined), 'an impulsive soldier hits harder');
  // Engaging on Follow: an enemy 90 px off is fought by the impulsive, not by the others.
  assert.equal(CL.traits.engage({ trait: 'impulsive' }) * CL.combat.AI.melee.followEngage > 90, true);
  assert.equal(CL.combat.AI.melee.followEngage > 90, false);
  assert.ok(CL.traits.engage({ trait: 'cautious' }) < 1);
  // Pursuit: a cautious soldier lets a runner go unless it is close.
  const runner = { routing: true, x: 600, y: 300 };
  assert.equal(CL.traits.pursues({ trait: 'cautious', x: 400, y: 300 }, runner), false);
  assert.equal(CL.traits.pursues({ x: 400, y: 300 }, runner), true);
  assert.equal(CL.traits.pursues({ trait: 'cautious', x: 560, y: 300 }, runner), true, 'close enough to strike');
});

test('whole fought battles change measurably with the company’s traits: wounds taken', () => {
  // Six footmen charge eight looters, over eight seeded battles for each trait.
  const hurt = (trait) => {
    let n = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { CL } = company(trait, 6, { random: seeded(seed) });
      const g = fight(CL, { looter: 8 });
      n += g.allies.filter((a) => a.soldierId != null).reduce((sum, a) => sum + (a.maxhp - Math.max(0, a.hp)), 0);
    }
    return n / 8;
  };
  const [none, impulsive, cautious] = [hurt(null), hurt('impulsive'), hurt('cautious')];
  assert.ok(impulsive > none * 1.1, `impulsive take more: ${impulsive} vs ${none}`);
  assert.ok(cautious < none * 0.9, `cautious take less: ${cautious} vs ${none}`);
});

test('auto-resolve: strength and the chance to fall follow the trait', () => {
  const plainCo = company(null, 6);
  const imp = company('impulsive', 6);
  const cau = company('cautious', 6);
  const P = (e) => e.CL.autoresolve.playerPower(e.c);
  assert.ok(P(imp) > P(plainCo));
  assert.ok(P(cau) < P(plainCo));
  // The fall chance, over many rolls from the same stream.
  const rate = (e) => {
    const ids = Array.from({ length: 4000 }, (_, i) => i);
    const s = e.c.roster[0];
    return e.CL.autoresolve.rollFallen(e.c, ids, 0.2, false, () => e.T.fall(s)).length / ids.length;
  };
  assert.ok(Math.abs(rate(plainCo) - 0.2) < 0.02);
  assert.ok(Math.abs(rate(cau) - 0.15) < 0.02);
  assert.ok(Math.abs(rate(imp) - 0.26) < 0.02);
});
