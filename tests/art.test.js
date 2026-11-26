// P10-G1 (D-P10k): the art kit in the game. Every troop and companion has a look the kit can draw and
// that agrees with what the troop does; every part of the look vocabulary really draws something; looks
// are stable and follow the troop's gender and its side's colours; the Sharpness setting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

/** A 2D context that draws nothing and counts what it is asked to paint. */
function fakeCtx() {
  const calls = { fill: 0, stroke: 0, paths: 0, drawImage: 0, colours: new Set() };
  const gradient = { addColorStop() {} };
  const target = {
    calls,
    canvas: { width: 960, height: 540 },
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    fillText: () => calls.fill++,
    drawImage: () => calls.drawImage++,
    beginPath: () => calls.paths++,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') calls.colours.add(v);
      o[k] = v;
      return true;
    },
  });
}

const POSES = [
  { face: 'down' },
  { face: 'up' },
  { face: 'left', move: 1, walk: 1.3 },
  { face: 'right', atk: { phase: 'windup', k: 0.5 } },
  { face: 'down', atk: { phase: 'active', k: 0.5 } },
  { face: 'up', atk: { phase: 'recovery', k: 0.5 } },
  { face: 'right', guard: true },
  { face: 'left', draw: 0.7 },
  { face: 'right', draw: 1, shot: 0.5, hit: 0.8 },
];

test('every troop (but the hero) and every companion has a look in the vocabulary, agreeing with the troop', () => {
  const { CL } = loadGame();
  for (const t of Object.values(CL.content.table('troops'))) {
    if (t.role === 'hero') continue;
    assert.ok(t.look, `${t.id} has a look`);
    assert.equal(CL.content.checkLook(t.look, t.id).join('; '), '', t.id);
    assert.equal(CL.content.lookAgrees(t).join('; '), '', t.id);
  }
  for (const m of Object.values(CL.content.table('companions'))) assert.equal(CL.content.checkLook(m.look, m.id).join('; '), '', m.id);
  assert.equal(CL.content.validate().join('; '), '');
});

test('the checks refuse a look that is not the kit’s, or that disagrees with the troop', () => {
  const { CL } = loadGame();
  const footman = CL.content.troop('footman');
  assert.match(CL.content.checkLook({ ...footman.look, helmet: 'tophat' }, 'x')[0], /unknown helmet 'tophat'/);
  assert.match(CL.content.checkLook({ wings: true }, 'x')[0], /'wings' is not part of a look/);
  assert.match(CL.content.checkLook({ tunic: 'blue' }, 'x')[0], /tunic must be a colour/);
  assert.match(CL.content.lookAgrees({ ...footman, look: { ...footman.look, shield: null } })[0], /needs a shield/);
  assert.match(CL.content.lookAgrees({ ...CL.content.troop('levy'), look: { weapon: 'club', shield: 'round' } })[0], /may not have a shield/);
  // P11-04: by the troop's family, not its shot's speed or its reach.
  assert.ok(CL.content.lookAgrees({ ...CL.content.troop('hunter'), look: { weapon: 'crossbow' } }).some((e) => /a shortbow is drawn as bow, not crossbow/.test(e)));
  assert.ok(CL.content.lookAgrees({ ...CL.content.troop('pikeman'), look: { weapon: 'sword' } }).some((e) => /needs a spear, pike or lance/.test(e)));
  assert.ok(CL.content.lookAgrees({ ...CL.content.troop('rider'), look: { weapon: 'lance' } }).some((e) => /needs a mount/.test(e)));
  assert.ok(CL.content.lookAgrees({ ...CL.content.troop('shieldmaiden'), look: { ...CL.content.troop('shieldmaiden').look, female: true } }).some((e) => /gender/.test(e)));
});

test('every part in the vocabulary draws something, in every facing and pose', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  const V = CL.content.LOOK;
  const paint = (look, pose) => {
    const ctx = fakeCtx();
    F.figure(ctx, 0, 0, look, { t: 1, ...pose });
    return ctx.calls;
  };
  const cost = (look, pose) => {
    const c = paint(look, pose);
    return c.fill + c.stroke;
  };
  /** A part shows when it paints more, or in colours the bare figure doesn't use. */
  const shows = (look, pose) => {
    const [a, b] = [paint(look, pose), paint(bare, pose)];
    return a.fill + a.stroke > b.fill + b.stroke || [...a.colours].some((c) => !b.colours.has(c));
  };
  const bare = { tunic: '#8a7a5a' };
  for (const [part, values] of Object.entries({ armour: V.armour, helmet: V.helmet, hat: V.hat, shield: V.shield, weapon: V.weapon })) {
    for (const v of values) {
      for (const pose of POSES.slice(0, 3)) {
        const drawn = cost({ ...bare, [part]: v }, pose);
        assert.ok(drawn >= cost(bare, pose), `${part} ${v} facing ${pose.face}`);
      }
      // Seen from some side, each part adds strokes or fills of its own.
      assert.ok(POSES.some((pose) => shows({ ...bare, [part]: v }, pose)), `${part} ${v} shows`);
    }
  }
  // Every troop draws in every facing and pose, on foot or mounted, without failing.
  for (const t of Object.values(CL.content.table('troops'))) {
    if (t.role === 'hero') continue;
    const L = F.troopLook(t.id, t.faction, 3);
    for (const pose of POSES) {
      const ctx = fakeCtx();
      if (L.mount) F.horse(ctx, 0, 0, { ...L.mount, cloth: t.faction }, pose, () => F.figure(ctx, 0, 0, L, { ...pose, mounted: true }));
      else F.figure(ctx, 0, 0, L, pose);
      assert.ok(ctx.calls.fill > 10, `${t.id} ${pose.face}`);
    }
  }
});

test('looks: stable by seed, a woman’s troop is drawn as a woman, colours from the side fought for', () => {
  const { CL } = loadGame();
  const F = CL.gfx.fig;
  assert.deepEqual(F.troopLook('footman', 'valedorn', 7), F.troopLook('footman', 'valedorn', 7));
  assert.notDeepEqual(F.troopLook('footman', 'valedorn', 7), F.troopLook('footman', 'valedorn', 8));
  for (let seed = 1; seed < 30; seed++) {
    assert.equal(F.troopLook('shieldmaiden', 'hrothmark', seed).female, true);
    assert.equal(F.troopLook('axeman', 'hrothmark', seed).female, false);
    assert.equal(F.troopLook('axeman', 'hrothmark', seed).beard !== null, true); // the axemen's beards are in their look
  }
  // A hired spearman wears the company's colours: the side, not the troop's realm.
  assert.equal(F.troopLook('spearman', 'valedorn', 2).tabard, 'valedorn');
  assert.equal(CL.gfx.realm('valedorn').color, CL.content.table('factions').valedorn.color);
  assert.equal(CL.gfx.realm('hrothmark').device, 'quarter');
  for (const f of Object.values(CL.content.table('factions'))) assert.ok(CL.gfx.realm(f.id).color && CL.gfx.realm(f.id).device, f.id);
  // A pack's troop with no look gets one from what it does.
  const d = F.defaultLook({ role: 'archer', tier: 'T2', faction: 'vessaro', ranged: { projectileSpeed: 300 } });
  assert.equal(d.weapon, 'crossbow');
  assert.equal(CL.content.lookAgrees({ id: 'x', role: 'cavalry', reach: 70, look: F.defaultLook({ role: 'cavalry', reach: 70, tier: 'T3', faction: 'valedorn' }) }).length, 0);
  assert.equal(CL.content.lookAgrees({ id: 'y', role: 'infantry', reach: 48, shield: true, look: F.defaultLook({ role: 'infantry', reach: 48, shield: true, tier: 'T2', faction: 'aurelian' }) }).length, 0);
  // The hero: the creator's cloak and presentation; a shield only when one is carried (P11-04: heroFrom).
  const kit = { weapon: 'arming_sword', offhand: 'kite_shield' };
  assert.equal(F.heroFrom({ cloak: 'forest', gender: 'woman' }, kit, { campaign: null }).cloak, F.CLOAKS.forest);
  assert.equal(F.heroFrom({ cloak: 'forest', gender: 'woman' }, kit, { campaign: null }).female, true);
  assert.equal(F.heroFrom({ cloak: 'ash' }, { weapon: 'arming_sword' }, { campaign: null }).shield, null);
});

test('Sharpness is a device setting: Balanced by default, kept, and only its three values', () => {
  const storage = memoryStorage();
  const { CL } = loadGame({ storage });
  assert.equal(CL.settings.get('sharpness'), 'balanced');
  assert.deepEqual(Object.keys(CL.settings.SHARPNESS), ['sharp', 'balanced', 'fast']);
  assert.equal(CL.settings.set('sharpness', 'sharp'), true);
  assert.equal(JSON.parse(storage.data.crownless_settings).sharpness, 'sharp');
  assert.equal(CL.settings.set('sharpness', 'ultra'), false);
  assert.equal(CL.settings.sanitize({ sharpness: 'ultra' }).sharpness, 'balanced');
  const again = loadGame({ storage }).CL;
  again.settings.load(); // as the page does at boot
  assert.equal(again.settings.get('sharpness'), 'sharp');
});
