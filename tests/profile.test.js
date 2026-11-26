// P11-01: one combat profile for every fighter (js/profile.js, data/weapons.js). Every family and weapon
// resolves; every troop, the hero in each weapon and in the tournament's kit, Mara, each retinue
// companion and a lord in person start a battle with exactly 5.0.0's numbers (recorded on 5.0.1 before
// the profile: tests/fixtures/golden/fighters.json); forged pieces keep their family; the content and
// pack checks cover the new data; and nothing outside the profile keeps a timing of its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/load');
const { PROFILES, LORD_BATTLE, companyGame, fighters } = require('./helpers/golden');
const { spread } = require('../scripts/parity');

const want = JSON.parse(fs.readFileSync(PROFILES, 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));

test('every family and every weapon resolves, each with 5.0.0 timing for now', () => {
  const { CL } = loadGame();
  const P = CL.profile;
  const F = CL.content.table('weapon_families');
  assert.ok(Object.keys(F).length >= 12);
  for (const id of Object.keys(F)) {
    const { family } = P.weaponOf(id);
    assert.equal(family.id, id);
  }
  const weapons = Object.values(CL.content.table('items')).filter((it) => it.slot === 'weapon');
  assert.ok(weapons.length >= 5);
  for (const it of weapons) {
    const p = P.resolve({ hero: CL.campaign, equipment: { ...CL.campaign.equipment, weapon: it.id } });
    assert.equal(p.family, it.family, it.id);
    assert.deepEqual(plain(p.timing), plain(P.DEFAULT_TIMING), it.id);
    assert.deepEqual([p.cooldown.hero, p.cooldown.ai, p.maxTargets, p.miss], [0.52, 0.86, Infinity, 0], it.id);
    assert.equal(p.arc, Math.cos(Math.PI / 4), it.id);
  }
  assert.deepEqual(plain(P.DEFAULT_TIMING), { windup: 0.16, active: 0.12, recovery: 0.24, total: 0.52 });
  assert.equal(CL.units.SWING, P.DEFAULT_TIMING, 'SWING is only the sword family default');
});

test("every troop's unit has 5.0.0's numbers, and the weapon its look carries", () => {
  const { CL } = loadGame({ seed: 1 });
  for (const [id, w] of Object.entries(want.troops)) {
    const u = CL.units.makeUnit(0, 0, 'enemy', id);
    assert.deepEqual(plain({ role: u.role, hp: u.hp, damage: u.damage, armor: u.armor, reach: u.reach, speed: u.speed, ranged: u.ranged }), w, id);
    assert.equal(CL.profile.of(u), u.profile);
    const t = CL.content.troop(id);
    assert.equal(u.profile.family, t.weapon, id);
    if (t.look?.weapon) assert.equal(CL.profile.familyOfLook(t.look), t.weapon, id);
  }
  assert.equal(CL.content.troop('hunter').weapon, 'shortbow');
  assert.equal(CL.content.troop('longbowman').weapon, 'longbow');
  assert.equal(CL.content.troop('levy').weapon, 'mace');
  assert.equal(CL.content.troop('hero').weapon, 'unarmed');
});

test("the hero in each weapon, unarmed and in the tournament's kit, Mara and the retinue: 5.0.0's numbers", () => {
  const { CL } = loadGame({ seed: 1 });
  const c = CL.campaign;
  for (const w of ['unarmed', 'worn_sword', 'hand_axe', 'arming_sword', 'war_mace', 'knights_sword']) {
    assert.deepEqual(plain(CL.character.heroCombat(c, { ...c.equipment, weapon: w === 'unarmed' ? null : w })), want.hero[w], w);
  }
  assert.deepEqual(plain(CL.character.heroCombat(c, CL.content.get('tournaments', 'lists').kit)), want.hero.kit, 'kit');
  assert.equal(CL.autoresolve.heroPower(c), want.heroPower);
  const G = companyGame(spread(6));
  assert.deepEqual(plain(G.companion.combat(G.campaign)), want.mara);
  for (const [id, w] of Object.entries(want.retinue)) assert.deepEqual(plain(G.retinue.combat({ id, equipment: { ...G.content.table('companions')[id].startGear } })), w, id);
});

test("a lord's battle: the hero, Mara, a retinue companion, the lord and his men start as in 5.0.0", () => {
  const G = companyGame(spread(6));
  G.combat.startBattle(LORD_BATTLE);
  assert.deepEqual(plain(fighters(G)), want.lordBattle);
  const g = G.game;
  const lord = g.enemies.find((u) => u.named);
  assert.equal(lord.profile.family, 'sword');
  assert.equal(lord.profile.hp, lord.maxhp, "the lord's profile carries his numbers");
  assert.equal(g.hero.profile.family, G.content.item(G.campaign.equipment.weapon).family);
  for (const u of g.allies.filter((a) => a.companion)) {
    const eq = u.companion === 'mara' ? G.campaign.companion.equipment : G.retinue.list(G.campaign).find((m) => m.id === u.companion).equipment;
    assert.equal(u.profile.family, G.content.item(eq.weapon).family, u.companion);
  }
});

test("a tournament bout: the hero in the loaner kit, the round's fighter from its profile", () => {
  const { CL } = loadGame({ seed: 4 });
  const c = CL.campaign;
  c.gold = 1000;
  const s = CL.content.table('settlements').stonebridge;
  Object.assign(c.world, { x: s.mapX, y: s.mapY, location: 'stonebridge' });
  c.tourney = CL.tourney.blank(c.day);
  c.tourney.hosts.stonebridge.next = c.day;
  CL.tourney.tick(c);
  assert.ok(CL.tourney.enter(c, 'stonebridge').ok && CL.tourney.fight(c));
  const g = CL.game;
  const kit = CL.content.get('tournaments', 'lists').kit;
  assert.equal(g.hero.profile.family, CL.content.item(kit.weapon).family);
  assert.deepEqual([g.hero.hp, g.hero.damage, g.hero.armor, g.hero.canBlock], [want.hero.kit.hp, want.hero.kit.damage, want.hero.kit.armor, want.hero.kit.canBlock]);
  const f = g.enemies[0];
  assert.deepEqual([f.hp, f.maxhp, f.damage, f.armor], [g.duel.opponent.hp, g.duel.opponent.hp, g.duel.opponent.damage, g.duel.opponent.armor]);
  assert.equal(f.profile.damage, f.damage);
});

test('the art reads a swing through attackProgress, from the unit’s own timing', () => {
  const { CL } = loadGame();
  const u = CL.units.makeUnit(0, 0, 'ally', 'footman');
  assert.equal(CL.profile.attackProgress(u), null);
  for (const [t, phase, k] of [
    [0.08, 'windup', 0.5],
    [0.22, 'active', 0.5],
    [0.4, 'recovery', 0.5],
  ]) {
    u.swing = { t, hit: [] };
    const a = CL.profile.attackProgress(u);
    assert.equal(a.phase, phase);
    assert.ok(Math.abs(a.k - k) < 1e-9, `${phase} ${a.k}`);
    assert.equal(CL.units.swingPhase(u), phase);
  }
  u.swing = { t: 0.53, hit: [] };
  assert.equal(CL.profile.attackProgress(u), null);
  // A slower weapon (a pack's override) is drawn and fought on its own timing.
  u.profile = { ...u.profile, timing: { windup: 0.4, active: 0.1, recovery: 0.5, total: 1 } };
  u.swing = { t: 0.3, hit: [] };
  assert.equal(CL.units.swingPhase(u), 'windup');
  assert.ok(Math.abs(CL.profile.attackProgress(u).k - 0.75) < 1e-9);
});

test('forged pieces keep their family and their own copy of the combat block', () => {
  const { CL } = loadGame();
  const items = CL.content.table('items');
  assert.equal(items['arming_sword+1'].family, 'sword');
  assert.equal(items['war_mace+2'].family, 'mace');
  const p = CL.profile.resolve({ hero: CL.campaign, equipment: { ...CL.campaign.equipment, weapon: 'war_mace+1' } });
  assert.equal(p.family, 'mace');
  // A weapon with overrides: its forged pieces carry them too.
  const { CL: L2 } = loadGame({
    content: (C) => {
      C.items.war_mace.combat = { recovery: 0.3 };
    },
  });
  const t = L2.content.table('items');
  assert.deepEqual(plain(t['war_mace+1'].combat), { recovery: 0.3 });
  assert.notEqual(t['war_mace+1'].combat, t.war_mace.combat);
  const q = L2.profile.resolve({ hero: L2.campaign, equipment: { ...L2.campaign.equipment, weapon: 'war_mace+1' } });
  assert.deepEqual([q.timing.recovery, q.timing.total], [0.3, 0.16 + 0.12 + 0.3]);
});

test('the content and pack checks cover families, item overrides and troop weapons', () => {
  const { CL } = loadGame();
  const copy = () => JSON.parse(JSON.stringify(rawContent(CL)));
  const errors = (edit) => {
    const C = copy();
    edit(C);
    return plain(CL.content.validate(C)); // a plain copy: the game's arrays belong to its own realm
  };
  assert.deepEqual(errors(() => {}), []);
  // A pack may add a family and give an item overrides.
  assert.deepEqual(
    errors((C) => {
      C.weapon_families.flail = { ...C.weapon_families.mace, id: 'flail', name: 'Flail', recovery: 0.4 };
      C.items.war_mace.combat = { recovery: 0.3, maxTargets: 1 };
    }),
    [],
  );
  const one = (edit, re) => {
    const e = errors(edit);
    assert.ok(e.some((x) => re.test(x)), `${re} in ${JSON.stringify(e)}`);
  };
  one((C) => delete C.items.hand_axe.family, /item hand_axe: a weapon needs a known family \(none\)/);
  one((C) => (C.items.hand_axe.family = 'flail'), /item hand_axe: a weapon needs a known family \(flail\)/);
  one((C) => (C.items.boots.family = 'sword'), /item boots: only a weapon has a family/);
  one((C) => (C.items.war_mace.combat = { windup: -1 }), /item war_mace: combat: bad windup/);
  one((C) => (C.items.war_mace.combat = { stagger: 1 }), /item war_mace: combat: unknown field stagger/);
  one((C) => delete C.weapon_families.axe.recovery, /weapon family axe: needs recovery/);
  one((C) => (C.weapon_families.axe.hands = 3), /weapon family axe: bad hands/);
  one((C) => (C.weapon_families.axe.look = 'halberd'), /weapon family axe: bad look/);
  one((C) => (C.troops.footman.weapon = 'axe'), /troop footman: its weapon \(axe\) isn't what its look carries \(sword\)/);
  one((C) => (C.troops.footman.weapon = 'trebuchet'), /troop footman: unknown weapon trebuchet/);
  one((C) => (C.troops.hunter.weapon = 'sword'), /troop hunter: an archer's weapon must shoot/);
  // A pack's troop without a weapon gets one from its look or role.
  const { CL: L3 } = loadGame({
    content: (C) => {
      C.troops.footman = { ...C.troops.footman, weapon: undefined, look: undefined };
      C.troops.spearman = { ...C.troops.spearman, weapon: undefined, look: undefined };
      C.troops.hunter = { ...C.troops.hunter, weapon: undefined, look: undefined };
      C.troops.rider = { ...C.troops.rider, weapon: undefined, look: undefined };
    },
  });
  assert.deepEqual(['footman', 'spearman', 'hunter', 'rider'].map((id) => L3.units.makeUnit(0, 0, 'enemy', id).profile.family), ['sword', 'spear', 'shortbow', 'lance']);
});

/** The game's content tables as plain data (a pack is checked on a copy). */
function rawContent(CL) {
  const out = {};
  for (const t of [...CL.content.TABLES, 'forge']) out[t] = CL.content.table(t);
  return out;
}

test('nothing outside the profile keeps a timing, a cooldown or a strike range of its own', () => {
  const dir = path.join(__dirname, '..', 'js');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.js')) files.push(path.join(d, e.name));
    }
  };
  walk(dir);
  const found = [];
  for (const f of files) {
    if (path.basename(f) === 'profile.js') continue;
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/\bSWING\.|\bCOOLDOWN\.|\.reach - 1\b/.test(line)) found.push(`${path.relative(dir, f)}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(found, []);
});
