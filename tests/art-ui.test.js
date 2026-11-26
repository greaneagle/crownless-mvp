// P10-G5 (D-P10k): the UI's pictures in the art kit. Every kind of portrait draws (the soldiers' faces, the
// hero, the companions, the lords and rulers, whoever speaks) and a soldier's stays the same over a save and
// load; every troop has a small figure; every house's arms differ from the other houses of its realm; the
// stat and goods icons are vectors in the kit's style; nothing here uses a sprite.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, memoryStorage } = require('./helpers/load');

function fakeCtx() {
  const calls = { fill: 0, stroke: 0, drawImage: 0, fills: [] };
  const target = {
    calls,
    canvas: { width: 100, height: 100 },
    fill: () => {
      calls.fill++;
      calls.fills.push(target.fillStyle);
    },
    stroke: () => calls.stroke++,
    fillRect: () => calls.fill++,
    strokeRect: () => calls.stroke++,
    drawImage: () => calls.drawImage++,
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  });
}

const draws = (fn) => {
  const ctx = fakeCtx();
  fn(ctx);
  return ctx.calls;
};

test('every kind of soldier’s face draws, men’s and women’s, in their troop’s clothes', () => {
  const { CL } = loadGame();
  const U = CL.gfx.ui;
  const P = CL.soldiers.PORTRAIT;
  const seen = new Set();
  for (const sex of ['m', 'f']) {
    for (let skin = 0; skin < P.skins; skin++) {
      for (let face = 0; face < P.faces; face++) {
        for (let hair = 0; hair < P.hair; hair++) {
          for (let extra = 0; extra < (sex === 'f' ? P.styles : P.beards); extra++) {
            const s = { id: 7, troop: sex === 'f' ? 'shieldmaiden' : 'levy', portrait: `${sex}-${skin}-${face}-${hair}-${extra}` };
            if (!CL.content.troop(s.troop)) s.troop = 'levy';
            const L = U.soldierLook(s, 'player');
            assert.equal(L.female, sex === 'f', s.portrait);
            const c = draws((ctx) => U.portrait(ctx, 0, 0, 64, L));
            assert.ok(c.fill > 10 && c.stroke > 5, `${s.portrait} draws`);
            assert.equal(c.drawImage, 0, `${s.portrait}: no sprite`);
            seen.add(JSON.stringify([L.skin, L.hair, L.face.shape, L.beardKind, L.hairStyle]));
          }
        }
      }
    }
  }
  assert.ok(seen.size >= 100, `the faces differ (${seen.size})`);
});

test('a soldier’s portrait is the same after a save and load, and from their id', () => {
  const { CL } = loadGame({ party: true, storage: memoryStorage() });
  const c = CL.campaign;
  const man = CL.save.addSoldier(c, 'clansman');
  const woman = CL.save.addSoldier(c, 'shieldmaiden');
  const looks = (roster) => roster.filter((s) => s.id === man.id || s.id === woman.id).map((s) => JSON.stringify(CL.gfx.ui.soldierLook(s, 'player')));
  const before = looks(c.roster);
  assert.equal(before.length, 2);
  CL.save.write();
  const back = CL.save.load();
  assert.deepEqual(looks(back.roster), before);
  assert.equal(JSON.parse(before[1]).female, true, 'the shieldmaiden as a woman');
});

test('the hero, every companion, every lord and ruler, and the town’s speakers have portraits', () => {
  const { CL } = loadGame({ party: true });
  const U = CL.gfx.ui;
  const c = CL.campaign;
  for (const cloak of Object.keys(CL.gfx.fig.CLOAKS)) {
    for (const gender of ['man', 'woman', 'unspecified']) {
      const L = U.heroLook({ cloak, gender, name: 'Aldric' });
      assert.equal(L.female, gender === 'woman');
      assert.ok(draws((ctx) => U.portrait(ctx, 0, 0, 80, L)).fill > 10, `${cloak} ${gender}`);
    }
  }
  for (const id of Object.keys(CL.content.table('companions'))) {
    const L = CL.gfx.fig.companionLook(id);
    assert.ok(draws((ctx) => U.portrait(ctx, 0, 0, 64, L)).fill > 10, id);
  }
  CL.lords.ensure(c, c.day, true);
  const people = Object.keys(c.people);
  assert.ok(people.length > 30, 'the lords are there');
  const faces = new Set();
  for (const pid of people) {
    const L = U.lordLook(c, pid);
    assert.equal(L.female, c.people[pid].gender === 'female', pid);
    if (CL.realm.rules(pid, c)) assert.equal(L.crown, true, `${pid} rules: a crown`);
    assert.ok(draws((ctx) => U.portrait(ctx, 0, 0, 64, L, { helm: false })).fill > 10, pid);
    faces.add(JSON.stringify([L.skin, L.hair, L.face, L.beardKind, L.hairStyle]));
  }
  assert.ok(faces.size > people.length * 0.8, 'the lords look different from one another');
  // The town's people and the story's cast, by role, a woman as one.
  for (const hub of Object.values(CL.content.table('town_hubs'))) {
    for (const n of hub.npcs) {
      const L = U.speakerLook(n, c);
      assert.ok(L, `${hub.id} ${n.id}`);
      assert.equal(Boolean(L.female), n.gender === 'female', `${hub.id} ${n.id}`);
    }
  }
  assert.ok(U.speakerLook({ id: 'mara', companion: 'mara' }, c), 'a companion speaks in their own look');
});

test('every troop has a small figure, on foot or mounted, with no sprite', () => {
  const { CL } = loadGame();
  for (const id of Object.keys(CL.content.table('troops'))) {
    const L = CL.gfx.fig.troopLook(id, CL.content.troop(id).faction || 'neutral', 3);
    const c = draws((ctx) => CL.gfx.ui.figure(ctx, 40, 48, L));
    assert.ok(c.fill > 10, `${id} draws`);
    assert.equal(c.drawImage, 0, id);
  }
});

test('house arms: every house its own within its realm, on its realm’s colour; banners of lords carry them', () => {
  const { CL } = loadGame({ party: true });
  const c = CL.campaign;
  CL.lords.ensure(c, c.day, true);
  const houses = CL.houses.list(c);
  assert.ok(houses.length >= 16, `the houses (${houses.length})`);
  const byRealm = {};
  for (const h of houses) {
    const A = CL.gfx.ui.houseArms(c, h);
    assert.ok(A && CL.gfx.ui.DEVICES.includes(A.device), h.id);
    const realm = CL.realm.person(h.members[0], c)?.realm;
    if (realm && realm !== 'player') assert.equal(A.color, CL.gfx.realm(realm).color, `${h.id}: on ${realm}’s colour`);
    byRealm[realm] ||= new Set();
    byRealm[realm].add(`${A.device}|${A.trim}`);
    const n = draws((ctx) => CL.gfx.ui.arms(ctx, 13, 14, 10, A));
    assert.ok(n.fill + n.stroke >= 3, `${h.id}: its shield draws`);
  }
  for (const [realm, set] of Object.entries(byRealm)) {
    const count = houses.filter((h) => CL.realm.person(h.members[0], c)?.realm === realm).length;
    assert.equal(set.size, count, `${realm}: no two houses share arms`);
  }
  // A lord's party flies their house's arms: the banner's colours come from them.
  const lord = c.parties.find((p) => p.lordId && CL.houses.houseOf(c, p.lordId));
  assert.ok(lord, 'a lord riding');
  const A = CL.gfx.ui.houseArms(c, CL.houses.houseOf(c, lord.lordId));
  const leader = CL.lords.leaderFor(c, lord);
  assert.equal(leader.house, CL.houses.houseOf(c, lord.lordId).id, 'in battle too');
  const ctx = fakeCtx();
  CL.gfx.banner(ctx, 0, 0, 1, { ...A, edge: CL.gfx.PAL.gold }, 0, 34);
  assert.ok(ctx.calls.fills.includes(A.color) && ctx.calls.stroke >= 3, 'the banner in the arms’ colour, gold-edged');
});

test('the icons: the ten stats and every trade good as vectors in the kit’s style, nothing pixelated', () => {
  const { CL } = loadGame();
  const U = CL.gfx.ui;
  for (const n of ['heart', 'sword', 'bow', 'shield', 'boot', 'people', 'coin', 'star', 'banner', 'book']) {
    const svg = U.iconSvg(n);
    assert.match(svg, /<svg[^>]+viewBox="0 0 24 24"/, n);
    assert.doesNotMatch(svg, /crispEdges/, `${n}: smooth, not pixels`);
    assert.match(svg, /stroke="#2a1d10"/, `${n}: the one outline`);
  }
  for (const g of Object.values(CL.content.table('markets'))) {
    if (!g?.id) continue;
    assert.ok(U.ICONS[g.id], `${g.id} has an icon, not an emoji`);
  }
  const css = U.iconCss();
  assert.match(css, /\.ico-heart\{background-image:url\("data:image\/svg\+xml,/);
  assert.match(css, /\.ico-wine\{/);
  const fs = require('node:fs');
  const style = fs.readFileSync(require('node:path').join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(style, /pixelated|crispEdges/, 'style.css has no pixel-art rules left');
  assert.doesNotMatch(fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'ui.js'), 'utf8'), /heroSprite|heroFrames|FACE\.faces/, 'no sprite or 16×16 face drawing in the screens');
});
