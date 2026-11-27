// P11-12a (the original P11-12, D-P11m): the art never changes a battle. The same seeded battles, drawn
// through the art every frame at each Sharpness (the canvas's pixels per CSS pixel) and at the battle
// zooms 1× and 0.75×, end exactly alike: the winner, every fighter's HP, the kills and the time. It guards
// the storybook overhaul (P11-12b to P11-12e), which changes how everything is drawn and nothing else.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

/** A 2D context that draws nothing (the art's calls all succeed). */
function fakeCtx() {
  const gradient = { addColorStop() {} };
  const target = { canvas: { width: 960, height: 540 }, createRadialGradient: () => gradient, createLinearGradient: () => gradient, measureText: (t) => ({ width: String(t).length * 6 }) };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  });
}

/** The scenarios: who fights, and how the bot hero plays them. */
const SCENES = {
  field: (CL, c) => {
    for (const t of ['footman', 'footman', 'spearman', 'hunter', 'hunter', 'levy', 'rider']) CL.save.addSoldier(c, t);
    return { id: 'parity-field', name: 'field', map: 'open_country', waves: [{ looter: 6, reaver: 4 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } };
  },
  mounted: (CL, c) => {
    Object.assign(c.equipment, { weapon: 'arming_sword', horse: 'rouncey' });
    c.character.skills.riding = 3;
    for (const t of ['footman', 'hunter']) CL.save.addSoldier(c, t);
    return { id: 'parity-ride', name: 'ride', map: 'grass_field', waves: [{ looter: 5 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } };
  },
  archer: (CL, c) => {
    Object.assign(c.equipment, { weapon: 'short_bow', offhand: null });
    for (const t of ['footman', 'footman', 'hunter']) CL.save.addSoldier(c, t);
    return { id: 'parity-bow', name: 'bow', map: 'open_country', waves: [{ looter: 6 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 } };
  },
  siege: (CL) => CL.assault.practice(20, 'attack'),
};

/** Fight one scene to the end (or 40 s), drawing every other frame at the Sharpness's scale and the zoom. */
function fight(scene, sharpness, zoom) {
  const loaded = loadGame({ seed: 11 });
  const { CL } = loaded;
  loaded.sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  // js/render.js isn't loaded in Node: its big-battle rule, as it has it.
  CL.render = { BUSY: { from: 80, hurt: 0.5 }, busyBattle: () => (CL.combat.BATTLE.activeCap ?? 0) > 80, bodyAlpha: () => 0.5 };
  CL.settings.set('sharpness', sharpness);
  CL.settings.set('battleZoom', zoom);
  const c = CL.campaign;
  c.roster = [];
  CL.combat.startBattle(SCENES[scene](CL, c));
  const g = CL.game;
  const k = Math.max(1, CL.settings.SHARPNESS[sharpness]);
  let steps = 0;
  for (; steps < 2000 && g.mode === 'battle'; steps++) {
    const h = g.hero;
    const foe = g.enemies.filter((e) => e.alive && !e.routing).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (foe && h.alive) {
      const [dx, dy] = [foe.x - h.x, foe.y - h.y];
      const L = Math.hypot(dx, dy) || 1;
      g.joystick = L > 45 ? { x: dx / L, y: dy / L } : { x: 0, y: 0 };
      g.attackHeld = L < 70 || (h.ranged && L < 260);
    }
    CL.combat.update(0.02);
    if (steps % 2 === 0) {
      const m = g.arena || { width: 960, height: 540 };
      const cam = g.camera || { x: 0, y: 0, zoom };
      CL.gfx.battle.draw(fakeCtx(), g, { x: cam.x || 0, y: cam.y || 0, w: (m.width || 960) / (cam.zoom || 1), h: (m.height || 540) / (cam.zoom || 1) }, k * (cam.zoom || 1));
    }
  }
  const hp = (list) => Array.from(list, (u) => (u.alive ? Math.round(u.hp * 1000) / 1000 : 0));
  return { mode: g.mode, win: g.result?.win ?? null, steps, kills: g.kills, hero: g.hero.alive ? Math.round(g.hero.hp * 1000) / 1000 : 0, mounted: Boolean(g.hero.mounted), allies: hp(g.allies), enemies: hp(g.enemies) };
}

for (const scene of Object.keys(SCENES)) {
  test(`${scene}: the same seeded battle ends alike at every Sharpness and zoom`, () => {
    const base = fight(scene, 'balanced', 1);
    assert.ok(base.steps > 50, `${scene} ran`);
    if (scene === 'mounted') assert.equal(base.mounted, true, 'the hero rode');
    for (const [s, z] of [['sharp', 1], ['fast', 1], ['balanced', 0.75], ['sharp', 0.75], ['fast', 0.75]]) assert.deepEqual(fight(scene, s, z), base, `${scene} at ${s}, zoom ${z}`);
  });
}
