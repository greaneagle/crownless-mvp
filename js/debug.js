/* Crownless debug tools: testing shortcuts behind the "Debug" button (next to Logs).
 * Every action is logged to diagnostics as "Debug: …" so exported reports show it, then saved. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const MAX_GOLD = 99999;
  const log = (action, data) => CL.diag.log('warn', `Debug: ${action}`, data);
  const c = () => CL.campaign;

  function addGold(n) {
    c().gold = Math.max(0, Math.min(MAX_GOLD, c().gold + n));
    log('gold', { change: n, gold: c().gold });
  }

  /** Adds soldiers even past the party cap — it's a test tool. */
  function addSoldiers(troopId, n = 1) {
    CL.content.troop(troopId); // throws on unknown ids
    for (let i = 0; i < n; i++) CL.save.addSoldier(c(), troopId);
    log('soldiers', { troop: troopId, added: n, total: c().roster.length });
  }

  function healAll() {
    let n = 0;
    for (const s of c().roster) {
      if (s.woundedUntil !== null) {
        s.woundedUntil = null;
        n++;
      }
    }
    log('heal', { healed: n });
  }

  function dismissAll() {
    log('dismiss', { removed: c().roster.length });
    c().roster = [];
  }

  function addItem(itemId, n = 1) {
    CL.content.item(itemId);
    c().inventory[itemId] = (c().inventory[itemId] || 0) + n;
    CL.upkeep.stowFood(c());
    log('item', { item: itemId, added: n });
  }

  function addFood(n) {
    c().food = Math.max(0, c().food + n);
    log('food', { change: n, food: c().food });
  }

  function addMorale(n) {
    CL.upkeep.changeMorale(c(), n);
    log('morale', { change: n, morale: c().morale });
  }

  /** Adjust an attribute (str/agi/int/cha) or a skill id by delta, within sane bounds. */
  function adjustStat(stat, delta) {
    const ch = c().character;
    if (!ch) return false;
    if (CL.character.ATTRIBUTES.includes(stat)) {
      ch.attributes[stat] = Math.max(1, Math.min(20, ch.attributes[stat] + delta));
    } else if (stat in ch.skills) {
      ch.skills[stat] = Math.max(0, Math.min(10, ch.skills[stat] + delta));
    } else return false;
    log('stat', { stat, delta });
    return true;
  }

  function toggleGod() {
    CL.game.godMode = !CL.game.godMode;
    log('god mode', { on: CL.game.godMode });
    return CL.game.godMode;
  }

  function passDays(n) {
    CL.clock.advance(c(), n * 24, 'debug');
    log('days', { added: n, day: c().day });
  }

  function resetSites() {
    for (const s of Object.values(c().world.sites)) s.clearedUntil = 0;
    log('sites reset');
  }

  function teleport(settlementId) {
    const s = CL.content.get('settlements', settlementId);
    const w = c().world;
    Object.assign(w, { x: s.mapX, y: s.mapY, location: s.id });
    CL.game.travel = null;
    log('teleport', { to: s.id });
  }

  /** End the current battle immediately (through the normal, exactly-once result path). */
  function endBattleNow(win) {
    const g = CL.game;
    if (g.mode !== 'battle') return false;
    if (win) {
      for (const e of g.enemies) {
        if (e.alive) g.kills++; // credit the kills so rewards and loot match a real win
        e.alive = false;
      }
      g.kills += g.enemyReserve?.length || 0; // and the ones still waiting to step in
      g.enemyReserve = [];
    }
    else {
      g.hero.alive = false;
      for (const a of g.allies) a.alive = false;
    }
    log(win ? 'win battle' : 'lose battle');
    CL.party.endBattle(win);
    return true;
  }

  /**
   * A practice battle of about `total` units on the courtyard map (walls and crates make the AI
   * steer), half yours and half Reavers, to measure a device. Nothing in the campaign changes.
   */
  function stressBattle(total) {
    const allies = Math.floor(total / 2) - 1;
    const mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard', 'longbowman', 'levy'];
    const emix = ['looter', 'reaver', 'looter', 'mercenary'];
    const wave = {};
    for (let i = 0; i < total - allies - 1; i++) wave[emix[i % emix.length]] = (wave[emix[i % emix.length]] || 0) + 1;
    CL.game.siteId = null;
    CL.game.partyId = null;
    CL.combat.startBattle({
      id: `stress_${total}`,
      name: `Stress test (${total})`,
      map: 'greywall_courtyard',
      waves: [wave],
      practice: Array.from({ length: allies }, (_, i) => mix[i % mix.length]),
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      loot: 'low',
    });
    log('stress battle', { total, cap: CL.combat.BATTLE.activeCap });
  }

  /**
   * PROTO-A, the camera test run (docs/V2-PLAN.md): a practice battle of `total` units, all on the
   * field at once, in a generated forest arena three screens across and down, with the camera
   * following the hero and cavalry on both sides. Reports fps, drawing time, the slowest frame and
   * how long the armies took to meet. Nothing in the campaign changes and nothing is saved.
   */
  /**
   * The camera test (PROTO-A); with `help`, the v2.0 phone check (V2-13, SC-34): the same big forest
   * battle with cavalry, plus an allied party riding in from the north at 8 s and an enemy one from
   * the south at 12 s. The field is full, so they wait in reserve and step in as others fall.
   */
  function cameraTest(total, { help = false } = {}) {
    const allies = Math.floor(total / 2) - 1;
    const mix = ['footman', 'rider', 'hunter', 'footman', 'levy', 'rider', 'longbowman', 'guard'];
    const emix = ['reaver', 'horse_scout', 'looter', 'spearman', 'skirmisher', 'reaver'];
    const wave = {};
    for (let i = 0; i < total - allies - 1; i++) wave[emix[i % emix.length]] = (wave[emix[i % emix.length]] || 0) + 1;
    CL.game.siteId = null;
    CL.game.partyId = null;
    CL.combat.setActiveCap(total); // everyone on the field at once: the camera has to cope with all of them
    CL.combat.startBattle({
      id: `camera_${total}`,
      name: `Camera test (${total}, 3× forest)`,
      mapDef: CL.arena.forest(3),
      waves: [wave],
      practice: Array.from({ length: allies }, (_, i) => mix[i % mix.length]),
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      loot: 'low',
    });
    if (help) {
      const g = CL.game;
      const party = (id, name, side, troops, arriveAt, dir) => ({ id, template: 'test', name, side, troops, size: Object.values(troops).reduce((a, b) => a + b, 0), hours: arriveAt / CL.reinforce.SECONDS_PER_HOUR, arriveAt, seen: false, dir, from: dir.y < 0 ? 'north' : 'south', warned: false, arrived: false });
      g.joining = [party(-1, 'Valedorn Patrol', 'ally', { footman: 3, hunter: 2, rider: 1 }, 8, { x: 0, y: -1 }), party(-2, 'Road Reavers', 'enemy', { reaver: 4, horse_scout: 2 }, 12, { x: 0, y: 1 })];
    }
    log('camera test', { total, arena: '3x forest', help });
  }

  /**
   * W-02's map drawing test: the whole map at "fit", then 2.4× while the camera circles the map, four
   * seconds each. Reports fps and drawing time like the Big battle test (for the phone again after
   * W-05a). The view returns to where it was; nothing in the campaign changes.
   */
  function mapTest() {
    const g = CL.game;
    const was = { travel: g.travel, waiting: g.waiting };
    Object.assign(g, { travel: null, waiting: false }); // the party stands still while it runs
    CL.ui.message('Map drawing test: 8 seconds…');
    CL.mapView.startTest((r) => {
      Object.assign(g, was);
      const run = (x) => `${x.zoom}×: ${x.fps} fps, drawing ${x.drawMs} ms, slowest frame ${x.worstFrameMs} ms`;
      const canvas = r.canvas === 1 ? '960×540' : `${r.canvas}× sharp`;
      g.mapTestResult = r;
      log('map drawing test', r);
      CL.ui.message(`Map test: ${r.runs.map(run).join(' · ')} (canvas ${canvas}, text ${r.textSize})`);
      g.messageUntil = performance.now() + 15000; // long enough to read (also in Logs · F3)
    });
    log('map drawing test started', {});
  }

  // ---- P9-B1: the battle benchmark, for the owner's phone ----

  /**
   * The same open-field battle at each size (40 to 200), 30 seconds of fighting each, one after another. Each side
   * has twice its share waiting in reserve, so the field stays full while the fallen are replaced.
   */
  const BENCH = { sizes: [40, 60, 80, 100, 120, 150, 200], seconds: 30, reserve: 2, map: 'open_country', target: 30 };
  let bench = null; // { queue, rows, was } while the benchmark runs

  /**
   * The benchmark's battle at a size: half the field yours, half Reavers, in the usual mix of foot,
   * archers and riders, on the large open field grown for that size (whatever the Battlefield setting).
   * Also used by `scripts/bench-battle.js` and the tests, so Node measures the same battle.
   * @param {number} size @param {{ reserve?: number }} [opts] reserve: each side's reserve, in shares of the field (0: none)
   */
  function benchDef(size, { reserve = BENCH.reserve } = {}) {
    const share = Math.floor(size / 2);
    const allies = (share - 1) * (1 + reserve);
    const enemies = (size - share) * (1 + reserve);
    const mix = ['footman', 'footman', 'hunter', 'levy', 'rider', 'guard', 'longbowman', 'spearman'];
    const emix = ['reaver', 'looter', 'skirmisher', 'reaver', 'horse_scout', 'mercenary'];
    const wave = {};
    for (let i = 0; i < enemies; i++) wave[emix[i % emix.length]] = (wave[emix[i % emix.length]] || 0) + 1;
    return {
      id: `bench_${size}`,
      name: `Battle benchmark (${size})`,
      mapDef: CL.arena.build(CL.content.get('battle_maps', BENCH.map), size),
      waves: [wave],
      practice: Array.from({ length: allies }, (_, i) => mix[i % mix.length]),
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      loot: 'low',
    };
  }

  /**
   * Start one size of the benchmark. The hero can't fall, and the company follows them, so the fight
   * comes to the hero and stays in view (the drawing is measured where the battle is). @param {number} size
   */
  function benchStart(size) {
    CL.game.siteId = null;
    CL.game.partyId = null;
    CL.combat.setActiveCap(size);
    CL.combat.startBattle(benchDef(size));
    CL.game.godMode = true;
    for (const grp of ['infantry', 'archer', 'cavalry']) CL.game.orders[grp] = 'follow';
    CL.ui.message(`Battle benchmark: ${size} at once (${bench.rows.length + 1} of ${BENCH.sizes.length}), ${BENCH.seconds} s…`);
  }

  /** Debug → Battle benchmark: every size in turn; the result screen and the Logs get the numbers. */
  function benchmark() {
    bench = { queue: [...BENCH.sizes], rows: [], was: { cap: CL.combat.BATTLE.activeCap, god: Boolean(CL.game.godMode) } };
    log('battle benchmark started', { sizes: BENCH.sizes, seconds: BENCH.seconds });
    benchStart(bench.queue.shift());
  }

  const benching = () => Boolean(bench);

  /** One frame of the benchmark (from the main loop): a size's time is up, or its battle was left. */
  function benchFrame() {
    if (!bench) return;
    const g = CL.game;
    if (g.mode === 'battle' && g.practice && g.t >= BENCH.seconds) CL.party.endBattle(true);
    else if (g.mode !== 'battle' && g.mode !== 'result') benchStop('left');
  }

  /** A size's battle ended (its time, or one side ran out): record it, then the next or the report. @param {any} stats */
  function benchDone(stats) {
    bench.rows.push(stats);
    if (bench.queue.length) return benchStart(bench.queue.shift());
    const rows = bench.rows;
    benchStop(null);
    const ok = rows.filter((r) => r.fps >= BENCH.target);
    const best = ok.length ? ok[ok.length - 1].cap : null;
    const line = (r) => `${r.cap}: ${r.fps} fps, slowest ${r.worstFrameMs} ms, sim ${r.simMs} + draw ${r.drawMs} ms`;
    const summary = `Battle benchmark: ${rows.map(line).join(' · ')} · best at ${BENCH.target} fps: ${best ?? 'none'} (canvas ${rows[0].canvas === 1 ? '960×540' : `${rows[0].canvas}×`}, text ${rows[0].textSize})`;
    CL.diag.log('info', summary, { rows, best });
    const g = CL.game;
    g.result = {
      win: true,
      practice: { bench: true, rows, best },
      html: [
        `<strong>Largest size at ${BENCH.target} fps or better: ${best ?? 'none of them'}</strong>`,
        ...rows.map((r) => `${r.cap} at once (up to ${r.peak} on the field, those running away included): ${r.fps} fps · slowest frame ${r.worstFrameMs} ms · simulation ${r.simMs} ms, drawing ${r.drawMs} ms a frame`),
        'The same line is in Logs (F3). Nothing in your campaign changed.',
      ].join('<br>'),
    };
    CL.ui.changeMode('result');
  }

  /** The benchmark ends: the battle size and God mode as they were. @param {string | null} why */
  function benchStop(why) {
    if (!bench) return;
    CL.combat.setActiveCap(bench.was.cap);
    CL.game.godMode = bench.was.god;
    if (why) log('battle benchmark stopped', { why, done: bench.rows.length });
    bench = null;
  }

  const STRESS_HOURS_PER_SECOND = 24; // the map stress test runs a game day every second
  const STRESS_PROBE_KEY = 'crownless_stress_probe';

  /**
   * W-07's map stress test, for the owner's phone: the map topped up to `n` parties scattered over
   * the world, time running a day a second, through the map drawing test's two views (all of it,
   * then 2.4× circling). Reports simulation and drawing ms apart, and how long one save of that world
   * takes to write (to a scratch key). The campaign is put back exactly as it was afterwards.
   */
  function mapStress(n) {
    const g = CL.game;
    const c = CL.campaign;
    const snapshot = JSON.stringify(c);
    const was = { travel: g.travel, waiting: g.waiting };
    Object.assign(g, { travel: null, waiting: false });
    const ids = Object.values(CL.content.table('party_templates')).filter((t) => t.count > 0).map((t) => t.id); // not your own detachments
    const b = CL.world.bounds();
    // P8-01: `n` regular parties, and every lord riding on top of them.
    for (let k = 0; c.parties.filter((p) => !p.lordId).length < n; k++) {
      const p = CL.parties.spawn(c, ids[k % ids.length]);
      [p.x, p.y] = CL.world.clampToMap(CL.autoresolve.next(c) * b.w, CL.autoresolve.next(c) * b.h, 2);
    }
    const lords = c.parties.filter((p) => p.lordId).length;
    g.mapStress = { parties: n, days: 0 };
    CL.ui.message(`Map stress test: ${n} parties and ${lords} lords, a day a second, 8 seconds…`);
    log('map stress test started', { parties: n });
    CL.mapView.startTest((r) => {
      const t0 = performance.now();
      const text = JSON.stringify(c);
      CL.storage.set(STRESS_PROBE_KEY, text);
      const saveMs = Number((performance.now() - t0).toFixed(1));
      CL.storage.remove(STRESS_PROBE_KEY);
      const result = { ...r, parties: n, lords, days: Number(g.mapStress.days.toFixed(1)), saveMs, saveKb: Math.round(text.length / 1024) };
      g.mapStress = null;
      g.contactParty = null;
      const back = JSON.parse(snapshot);
      for (const k of Object.keys(c)) delete c[k];
      Object.assign(c, back);
      Object.assign(g, was);
      g.mapStressResult = result;
      if (g.armyTestSnapshot) {
        // P9-05: the army test's armies go too.
        const before = JSON.parse(g.armyTestSnapshot);
        for (const k of Object.keys(c)) delete c[k];
        Object.assign(c, before);
        g.armyTestSnapshot = null;
        result.armies = true;
      }
      log('map stress test', result);
      const run = (x) => `${x.zoom}×: ${x.fps} fps, sim ${x.simMs} ms, drawing ${x.drawMs} ms, slowest ${x.worstFrameMs} ms`;
      CL.ui.message(`Map stress ${n} + ${lords} lords${result.armies ? ', with the four armies' : ''}: ${r.runs.map(run).join(' · ')} · ${result.days} days · save ${saveMs} ms (${result.saveKb} KB)`);
      g.messageUntil = performance.now() + 15000;
    });
  }

  /**
   * P9-05: the phone's army test: four realms' armies of up to five lords each march around you, as one
   * banner each, during the map stress test (40 parties more); your campaign is put back after.
   */
  function fourArmies() {
    const r = CL.armies.testArmies(CL.campaign, CL.campaign.world);
    log('four armies', r);
    return r;
  }

  /** One frame of the map stress test (from the main loop, inside its simulation timing). */
  function stressFrame(dt) {
    const s = CL.game.mapStress;
    if (!s || CL.game.mode !== 'map') return;
    const c = CL.campaign;
    const hours = Math.min(dt, 0.1) * STRESS_HOURS_PER_SECOND;
    for (const p of c.parties) p.ignoreUntil = 1e9; // nobody comes for the player: the test never stops
    c.day += hours / 24;
    CL.parties.tick(c, hours);
    CL.game.contactParty = null;
    s.days += hours / 24;
  }

  /**
   * W-05a: a practice battle of `total` units at the river ford (always the large map, whatever the
   * Battlefield setting): the armies meet in the shallows, which slow everyone. Reports like the camera
   * test; nothing in the campaign changes. P7-11: the same on the hill slopes (`map`), or an escort
   * ambush with its wagon to protect (`objective: 'wagon'`).
   */
  function fordTest(total, map = 'river_ford', objective = null) {
    const allies = Math.floor(total / 2) - 1;
    const mix = ['footman', 'hunter', 'footman', 'rider', 'levy', 'longbowman'];
    const emix = ['reaver', 'looter', 'spearman', 'skirmisher'];
    const wave = {};
    for (let i = 0; i < total - allies - 1; i++) wave[emix[i % emix.length]] = (wave[emix[i % emix.length]] || 0) + 1;
    CL.game.siteId = null;
    CL.game.partyId = null;
    CL.combat.startBattle({
      id: `${map}_${total}`,
      name: `${objective ? 'Wagon ambush' : CL.content.get('battle_maps', map).name} test (${total})`,
      mapDef: CL.arena.build(CL.content.get('battle_maps', map)),
      objective,
      waves: [wave],
      practice: Array.from({ length: allies }, (_, i) => mix[i % mix.length]),
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      loot: 'low',
    });
    log('practice battle', { total, map, objective });
  }

  function wipeSave() {
    const S = CL.save;
    const pre = Array.from({ length: S.VERSION - 2 }, (_, i) => S.preMigrationKey(i + 2)); // crownless_save_v2, …
    for (const k of [S.KEY, S.BACKUP_KEY, S.LEGACY_KEY, S.INCOMPATIBLE_KEY, ...pre]) CL.storage.remove(k);
    log('save wiped');
  }

  // ---- Panel UI ----

  function fillSelect(sel, entries) {
    const el = document.querySelector(sel);
    if (el.options.length) return;
    for (const [value, label] of entries) el.append(new Option(label, value));
  }

  function populate() {
    fillSelect(
      '#cheatTroop',
      Object.values(CL.content.table('troops'))
        .filter((t) => t.id !== 'hero')
        .map((t) => [t.id, `${t.name} (${t.tier} ${t.role})`]),
    );
    fillSelect('#cheatItem', Object.values(CL.content.table('items')).map((i) => [i.id, i.name]));
    fillSelect('#cheatStat', [
      ...CL.character.ATTRIBUTES.map((a) => [a, CL.character.ATTRIBUTE_NAMES[a]]),
      ...Object.values(CL.content.table('skills')).map((s) => [s.id, `Skill: ${s.name}`]),
    ]);
    fillSelect('#cheatQuest', Object.values(CL.content.table('quests')).map((q) => [q.id, q.title]));
    fillSelect('#cheatPlace', Object.values(CL.content.table('settlements')).map((s) => [s.id, s.name]));
    fillSelect('#cheatHolding', Object.keys(c().holdings || {}).map((sid) => [sid, CL.content.get('settlements', sid).name]));
    document.querySelector('#cheatGod').textContent = `God mode: ${CL.game.godMode ? 'on' : 'off'}`;
    document.querySelector('#cheatTree').textContent = `Reveal troop tree: ${CL.game.revealTree ? 'on' : 'off'}`;
    document.querySelector('#cheatCap').value = String(CL.combat.BATTLE.activeCap);
  }

  let wipeArmed = false;

  function run(btn) {
    const $ = CL.ui.$;
    const act = btn.dataset.cheat;
    const n = Number(btn.dataset.n || 1);
    const mode = CL.game.mode;
    switch (act) {
      case 'gold':
        addGold(n);
        break;
      case 'soldier':
        addSoldiers($('#cheatTroop').value, n);
        break;
      case 'heal':
        healAll();
        break;
      case 'dismiss':
        dismissAll();
        break;
      case 'item':
        addItem($('#cheatItem').value);
        break;
      case 'bandits': {
        const p = CL.parties.spawn(c(), 'bandits');
        [p.x, p.y] = CL.world.clampToMap(c().world.x + 5, c().world.y, 2); // beside you, inside the map
        p.ignoreUntil = 0;
        log('bandits spawned', { id: p.id, troops: p.troops });
        break;
      }
      case 'clearParties':
        c().parties = [];
        for (const id of Object.keys(CL.content.table('party_templates'))) c().partySpawns[id] = c().day + 1;
        log('parties cleared');
        break;
      case 'repopulate':
        c().parties = [];
        c().partySpawns = {};
        CL.parties.ensure(c(), true);
        log('parties repopulated');
        break;
      case 'xp':
        CL.character.gainXp(n);
        log('hero xp', { added: n, level: c().character?.level });
        break;
      case 'troopxp':
        for (const s of c().roster) s.xp += n;
        log('troop xp', { added: n });
        break;
      case 'renown':
        c().renown += n;
        log('renown', { added: n, renown: c().renown });
        break;
      case 'contractDone': {
        const k = c().contract;
        const p = k && CL.parties.find(c(), k.partyId);
        if (!p) {
          CL.ui.message('No active contract target');
          return;
        }
        CL.contracts.onTargetDefeated(c(), p);
        CL.parties.remove(c(), p);
        log('contract target defeated', { id: k.id });
        break;
      }
      case 'questStart':
        CL.story.start(c(), $('#cheatQuest').value);
        log('quest started', { quest: $('#cheatQuest').value });
        break;
      case 'questNext': {
        const id = $('#cheatQuest').value;
        const r = CL.story.state(c()).quests[id];
        const stages = CL.content.get('quests', id).stages;
        const i = stages.findIndex((s) => s.id === r?.stage);
        if (i < 0) CL.ui.message('That quest is not active');
        else if (i + 1 < stages.length) CL.story.setStage(c(), id, stages[i + 1].id);
        else CL.story.finish(c(), id, 'done');
        log('quest stage', { quest: id, stage: CL.story.state(c()).quests[id]?.stage });
        break;
      }
      case 'questDone':
        CL.story.finish(c(), $('#cheatQuest').value, 'done');
        log('quest completed', { quest: $('#cheatQuest').value });
        break;
      case 'mara':
        if (!CL.companion.join(c(), 'mara')) CL.ui.message('Mara cannot join (already here, gone, or no room)');
        log('companion', { mara: CL.companion.has(c()) });
        break;
      case 'storyReset':
        c().story = CL.story.blank();
        log('story reset');
        break;
      case 'rep':
        CL.realm.adjust(c(), btn.dataset.f, n, 'debug');
        log('reputation', { faction: btn.dataset.f, score: CL.realm.score(c(), btn.dataset.f) });
        break;
      case 'flipFort':
      case 'holdingController': {
        const fort = btn.dataset.fort || $('#cheatHolding').value;
        // Only the story moves a story fort until Q4 ends, and a capital never moves (P8-02, P8-03).
        const right = CL.rights.may(c(), 'player', 'seize', fort);
        if (!right.ok) return CL.ui.message(right.why);
        // The next of this world's realms (W-04: any number of them).
        const ks = CL.realm.realms().map((k) => k.id);
        const to = ks[(ks.indexOf(CL.realm.owner(fort, c())) + 1) % ks.length];
        CL.realm.setOwner(c(), fort, to, 'debug');
        log('fort owner', { fort, owner: to });
        break;
      }
      case 'holdingHolder': {
        const sid = $('#cheatHolding').value;
        const h = CL.realm.holding(sid, c());
        if (!h) return;
        // The crown grants (P8-03): its ruler must be able to.
        const right = CL.rights.may(c(), CL.realm.rulerOf(h.sovereign, c()), 'grant', sid);
        if (!right.ok) return CL.ui.message(right.why);
        const ids = Object.keys(c().people).filter((id) => c().people[id].realm === h.sovereign);
        for (let i = 1; i <= ids.length; i++) {
          const to = ids[(ids.indexOf(h.holder) + i) % ids.length];
          if (CL.realm.transfer(c(), sid, { holder: to, reason: 'debug' })) {
            log('holding holder', { holding: sid, holder: to });
            break;
          }
        }
        break;
      }
      case 'rights': {
        // P8-03: every right at the chosen holding, with its reason, in the log.
        const sid = $('#cheatHolding').value;
        const out = {};
        for (const a of CL.rights.ACTIONS) {
          const r = CL.rights.may(c(), CL.rights.PLAYER, a, sid);
          out[a] = r.ok ? 'yes' : r.why;
        }
        log('rights', { place: sid, ...out });
        CL.ui.message(`Your rights at ${CL.content.get('settlements', sid).name} are in Logs · F3`);
        break;
      }
      case 'lordNear':
      case 'lordCapture':
      case 'lordAway': {
        // P8-01: the nearest lord's party.
        const w = c().world;
        const lords = c().parties.filter((p) => p.lordId);
        const near = lords.sort((a, b) => CL.world.mapDist(w.x, w.y, a.x, a.y) - CL.world.mapDist(w.x, w.y, b.x, b.y))[0];
        if (!near) return CL.ui.message('No lord is riding');
        const name = CL.realm.titled(near.lordId, c());
        if (act === 'lordNear') {
          Object.assign(near, { x: w.x + 2, y: w.y, tx: null, ty: null });
          log('lord near', { lord: near.lordId });
          CL.ui.message(`${name} rides up beside you`);
        } else if (act === 'lordCapture') {
          CL.lords.beaten(c(), near, 'player');
          log('lord captured', { lord: near.lordId });
          CL.ui.message(`${name} is your prisoner`);
        } else {
          const realm = c().people[near.lordId].realm;
          const rival = CL.realm.realms().map((f) => f.id).find((f) => f !== realm);
          CL.lords.beaten(c(), near, rival);
          log('lord held off-screen', { lord: near.lordId, by: rival });
          CL.ui.message(`${name} is held by the ${CL.realm.faction(rival)?.name}`);
        }
        break;
      }
      case 'serveHere':
      case 'swearHere': {
        // P8-04: an allegiance whatever the requirements (test setup).
        const f = CL.realm.sovereignOf($('#cheatHolding').value, c());
        const a = CL.allegiance.state(c());
        Object.assign(a, act === 'serveHere' ? { kind: 'mercenary', realm: f, since: c().day, until: c().day + 30, serviceDays: 0, summonsMissed: 0, window: null, nextPay: c().day + 7, served: Math.floor(c().day), lastOath: c().day } : { kind: 'vassal', realm: f, since: c().day, until: null, serviceDays: 0, summonsMissed: 0, window: { start: c().day, days: 0 }, nextPay: null, served: null, lastOath: c().day });
        log('allegiance', { kind: a.kind, realm: f });
        CL.ui.message(`You are now ${a.kind === 'vassal' ? 'a vassal' : 'a mercenary'} of the ${CL.realm.faction(f)?.name}`);
        break;
      }
      case 'grantMe': {
        const sid = $('#cheatHolding').value;
        const h = CL.realm.holding(sid, c());
        if (!h || CL.allegiance.sworn(c()) !== h.sovereign) return CL.ui.message('Swear to its realm first');
        if (CL.realm.transfer(c(), sid, { holder: CL.realm.PLAYER, reason: 'debug grant', willing: true })) log('granted to you', { holding: sid });
        break;
      }
      case 'serviceDays': {
        const a = CL.allegiance.state(c());
        if (a.kind === 'independent') return CL.ui.message('You serve no realm');
        a.serviceDays += n;
        if (a.window) a.window.days += n;
        log('service days', { days: n });
        break;
      }
      case 'conquer': {
        // P8-05: the chosen fort taken for your realm, then the conqueror's choice.
        const sid = $('#cheatHolding').value;
        const f = CL.allegiance.sworn(c());
        if (!f) return CL.ui.message('Swear to a realm first');
        const right = CL.rights.may(c(), 'player', 'seize', sid);
        if (!right.ok) return CL.ui.message(right.why);
        if (CL.realm.sovereignOf(sid, c()) === f) return CL.ui.message('It is already your realm’s');
        CL.realm.transfer(c(), sid, { controller: f, sovereign: f, by: 'player', reason: 'taken (debug)' });
        log('conquered', { holding: sid, for: f });
        toggle(false);
        CL.ui.changeMode('map');
        CL.ui.openConquest(sid);
        return;
      }
      case 'siegeAI': {
        // P8-06a: a realm at war with the chosen fort's gathers against it, wherever its lords are.
        const sid = $('#cheatHolding').value;
        const h = CL.realm.holding(sid, c());
        if (h?.kind !== 'fort') return CL.ui.message('Choose a fort');
        const f = CL.realm.realms().map((k) => k.id).find((x) => x !== h.controller);
        CL.realm.setRelation(c(), f, h.controller, 'war', 'debug');
        const fort = CL.content.get('settlements', sid);
        for (const q of c().parties.filter((p) => p.lordId && c().people[p.lordId].realm === f).slice(0, 3)) Object.assign(q, { x: fort.mapX + 3, y: fort.mapY + 3 });
        const s = CL.sieges.plan(c(), f);
        log('siege planned', { fort: s?.sid, by: f });
        CL.ui.message(s ? `The ${CL.realm.faction(f)?.name} gather against ${CL.content.get('settlements', s.sid).name}` : 'No siege could be planned');
        break;
      }
      case 'nobleFriend':
      case 'nobleGrumble':
      case 'nobleLeave': {
        // P8-07: the nearest riding lord thinks well of you; or ill of their ruler (grumbling now); or leaves.
        const w = c().world;
        const near = c()
          .parties.filter((p) => p.lordId)
          .sort((a, b) => CL.world.mapDist(w.x, w.y, a.x, a.y) - CL.world.mapDist(w.x, w.y, b.x, b.y))[0];
        if (!near) return CL.ui.message('No lord is riding');
        const pid = near.lordId;
        const N = CL.nobles;
        const ruler = CL.realm.rulerOf(c().people[pid].realm, c());
        if (act === 'nobleFriend') {
          N.note(c(), pid, 'player', 'helped', { kin: false });
          N.note(c(), pid, 'player', 'helped', { kin: false });
          N.note(c(), pid, 'player', 'helped', { kin: false });
          log('noble friend', { lord: pid, opinion: N.opinion(c(), pid, 'player') });
          CL.ui.message(`${CL.realm.titled(pid, c())} thinks well of you now (${N.opinion(c(), pid, 'player')})`);
        } else if (act === 'nobleGrumble') {
          for (let i = 0; i < 3; i++) N.note(c(), pid, ruler, 'revoked', { kin: false });
          delete c().nobles.warned[pid];
          delete c().nobles.moved[pid];
          N.weekly(c(), pid);
          log('noble grumbles', { lord: pid, opinion: N.opinion(c(), pid, ruler) });
          CL.ui.message(`${CL.realm.titled(pid, c())} grumbles at court: they leave in a week unless it mends`);
        } else {
          const to = N.destination(c(), pid) || CL.realm.realms().map((k) => k.id).find((f) => f !== c().people[pid].realm && CL.lords.templateFor(f));
          N.changeRealm(c(), pid, to);
          CL.lords.ensure(c(), c().day, true);
          log('noble leaves', { lord: pid, to });
          CL.ui.message(`${CL.realm.titled(pid, c())} leaves for ${CL.realm.faction(to)?.name}`);
        }
        break;
      }
      case 'noblePetition': {
        // P8-07: a petition now, from the first lord with something to ask (closing any open one).
        const N = CL.nobles;
        c().nobles.petitions = [];
        const who = Object.keys(c().people).find((pid) => !CL.realm.rules(pid, c()) && c().people[pid].status === 'free' && N.petitionFor(c(), pid));
        const x = who ? N.openPetition(c(), who) : null;
        log('noble petition', { lord: who || null, kind: x?.kind || null });
        if (!x) CL.ui.message('No lord has anything to ask');
        break;
      }
      case 'prototypeD': {
        // P8-08: Prototype D's start: a vassal with a fief, a warband of 12 and a mill; an enemy gathering.
        const r = CL.claims.prototypeD(c());
        log('prototype D', r || { failed: true });
        if (!r) return CL.ui.message('Prototype D could not be set up in this world');
        CL.save.write();
        toggle(false);
        CL.ui.changeMode('map');
        CL.ui.message(`Prototype D: you hold Westholt Castle and Ashby for Valedorn${r.mill ? `, with a mill at ${CL.content.get('settlements', r.mill).name}` : ''}. Hrothmark is at war with Valedorn${r.siege ? ', and its lords gather against Westholt' : ''}.`);
        return;
      }
      case 'nobleWeek':
        for (const pid of Object.keys(c().people)) CL.nobles.weekly(c(), pid);
        log('nobles: a week', { warned: Object.keys(c().nobles.warned).length });
        break;
      case 'siegeDay':
        CL.party.advanceDays(1);
        log('sieges: a day', { sieges: c().sieges.map((s) => [s.sid, s.phase]) });
        break;
      case 'grantsNow':
        for (const g of c().grants) g.day = c().day;
        CL.fiefs.weeklyGrants(c());
        for (const g of c().grants) g.day = c().day;
        CL.fiefs.decideGrants(c());
        log('grants now', { waiting: c().grants.length });
        if (CL.fiefs.grantDue(c())) {
          toggle(false);
          CL.ui.changeMode('map');
          CL.ui.openGrant();
          return;
        }
        break;
      case 'fiefWeek': {
        const line = CL.fiefs.payday(c());
        log('fiefs week', { line });
        break;
      }
      case 'factionNow':
      case 'riseNow': {
        // P9-04: the chosen holding's realm: its unhappiest lords form a faction now, or its faction rises now.
        const f = CL.realm.sovereignOf($('#cheatHolding').value, c());
        const x = btn.dataset.cheat === 'factionNow' ? CL.rebellion.factionNow(c(), f) : CL.rebellion.riseNow(c(), f);
        log(btn.dataset.cheat, { realm: f, rebellion: x ? { id: x.id, stage: x.stage, claimant: x.claimant, members: x.members } : null });
        if (!x) CL.ui.message(btn.dataset.cheat === 'factionNow' ? 'No faction could form there' : 'No faction there to rise');
        break;
      }
      case 'declareHere': {
        // P9-03: a realm of your own at the chosen fort, without the thresholds (made yours first if need be).
        const sid = $('#cheatHolding').value;
        const h = CL.realm.holding(sid, c());
        if (h?.kind !== 'fort') return CL.ui.message('Choose a fort under Holdings');
        if (h.holder !== 'player') CL.realm.transfer(c(), sid, { controller: 'player', sovereign: 'player', holder: 'player', willing: true, reason: 'debug' }) || CL.realm.transfer(c(), sid, { holder: 'player', willing: true, reason: 'debug' });
        CL.story.state(c()).flags.ending ||= CL.realm.realms()[0].id;
        const id = CL.founding.declare(c(), 'player', sid, { free: true });
        log('declare my realm', { realm: id, at: sid, why: id ? '' : CL.rights.may(c(), 'player', 'declareFree', sid).why });
        if (!id) CL.ui.message(CL.rights.may(c(), 'player', 'declareFree', sid).why);
        break;
      }
      case 'treatyNow': {
        // P9-02: the chosen holding's realm makes its next offer now (if it has a reason to).
        const f = CL.realm.sovereignOf($('#cheatHolding').value, c());
        const r = f && CL.diplomacy.offerNow(c(), f);
        log('treaty offer now', { realm: f, offer: r?.offer || null, result: r?.result || null });
        if (!r) CL.ui.message(`${f ? CL.realm.faction(f)?.short : 'That realm'} has no offer to make now.`);
        break;
      }
      case 'realmTreasury': {
        // P9-01: the chosen holding's realm, ±1000 crowns (on its book as debug).
        const f = CL.realm.sovereignOf($('#cheatHolding').value, c());
        if (!f || !CL.crowns.record(c(), f)) return CL.ui.message('Choose a holding of a realm');
        const n = Number(btn.dataset.n);
        const K = CL.crowns;
        const moved = n > 0 ? K.pay(c(), 'world', K.side(f), n, 'debug') : K.pay(c(), K.side(f), 'world', -n, 'debug', { partial: true });
        log('realm treasury', { realm: f, moved: n > 0 ? moved : -moved, treasury: K.treasury(c(), f) });
        break;
      }
      case 'fiefBroke':
        for (const sid of CL.realm.fiefsOf('player', c())) {
          const n = CL.fiefs.cash(c(), sid);
          if (n > 0) CL.accounts.transfer(c(), CL.fiefs.account(sid), 'world', n, 'debug: emptied');
        }
        log('fief treasuries emptied');
        break;
      case 'ransomNow': {
        const x = CL.lords.prisoners(c()).find((p) => p.by === 'player');
        if (!x) return CL.ui.message('You hold no prisoner');
        x.offerDay = c().day;
        log('ransom offer now', { lord: x.lord });
        CL.save.write();
        toggle(false);
        if (CL.game.mode !== 'battle' && CL.game.mode !== 'result') CL.ui.changeMode('map');
        CL.ui.openRansom();
        return;
      }
      case 'holdingClaim': {
        const sid = $('#cheatHolding').value;
        if (CL.realm.addClaim(c(), sid, { by: CL.realm.PLAYER, realm: null, kind: 'old' })) log('holding claim', { holding: sid, by: 'player' });
        else CL.ui.message('You already claim it, or hold it');
        break;
      }
      case 'contractOffers':
        c().contractOffers = {};
        log('contract offers refreshed');
        break;
      case 'cargo':
        for (const g of CL.trade.goods()) c().cargo[g.id] = (c().cargo[g.id] || 0) + 5;
        log('cargo', { added: 5 });
        break;
      case 'markets':
        c().markets = CL.trade.defaultMarkets();
        log('markets reset');
        break;
      case 'food':
        addFood(n);
        break;
      case 'morale':
        addMorale(n);
        break;
      case 'wages':
        CL.upkeep.payWages(c());
        c().nextWagesDay = Math.floor(c().day) + CL.upkeep.WAGE_INTERVAL;
        break;
      case 'stat':
        if (!adjustStat($('#cheatStat').value, n)) CL.ui.message('Create a character first');
        break;
      case 'god':
        btn.textContent = `God mode: ${toggleGod() ? 'on' : 'off'}`;
        return;
      case 'sharp': {
        // D-R1 (W-01): a sharper canvas at min(devicePixelRatio, 2), to measure on a phone with the
        // Big battle and the map. A view switch for testing only: not saved, nothing else changes.
        const k = CL.render.backingScale() > 1 ? 1 : Math.min(root.devicePixelRatio || 1, 2);
        CL.render.setBackingScale(k);
        btn.textContent = `Sharp canvas: ${k > 1 ? `${k}×` : 'off'}`;
        log('sharp canvas', { backing: k });
        return;
      }
      case 'tree':
        // Show every troop on the troop tree with full details (V2-03b). A view switch for testing:
        // the campaign's own knowledge is not changed or saved.
        CL.game.revealTree = !CL.game.revealTree;
        btn.textContent = `Reveal troop tree: ${CL.game.revealTree ? 'on' : 'off'}`;
        log('reveal troop tree', { on: CL.game.revealTree });
        CL.ui.refresh();
        return;
      case 'mapTest':
        if (mode !== 'map') return CL.ui.message('Open the world map first');
        toggle(false);
        mapTest();
        return;
      case 'mapStress':
        if (mode !== 'map') return CL.ui.message('Open the world map first');
        toggle(false);
        mapStress(n);
        return;
      case 'fourArmies': {
        // P9-05: the phone's army test: four armies of up to five lords on the map at once, in the map stress test.
        if (mode !== 'map') return CL.ui.message('Open the world map first');
        toggle(false);
        const snap = JSON.stringify(c());
        const r = fourArmies();
        mapStress(n);
        // The stress test puts the campaign back from its own snapshot, taken with the armies in it: undo them too.
        CL.game.armyTestSnapshot = snap;
        CL.ui.message(`Four armies: ${r.armies} armies of ${r.lords} lords, and ${n} parties, a day a second, 8 seconds…`);
        return;
      }
      case 'raiseArmy': {
        // P9-05: the chosen holding's realm raises an army now (no week's rest), if it is at war and its lords answer.
        const f = CL.realm.sovereignOf($('#cheatHolding').value, c());
        if (c().armyRest) delete c().armyRest[f];
        const a = CL.armies.plan(c(), f);
        log('raise an army', { realm: f, army: a ? { id: a.id, rally: a.rally, target: a.target, members: a.members } : null });
        CL.ui.message(a ? CL.armies.line(c(), a) : `${CL.realm.faction(f)?.name || 'That realm'} raises no army: no war, an army already out, or too few lords answer`);
        break;
      }
      case 'days':
        passDays(n);
        break;
      case 'millWeek': {
        // P7-10: your mill runs a week now, as on a payday (the law first).
        if (!CL.business.get(c())) return CL.ui.message('You own no mill');
        const w = CL.business.payday(c());
        log('mill week', { profit: w?.profit ?? null });
        CL.ui.refresh();
        break;
      }
      case 'millHostile': {
        // P7-10: the owner of your mill's settlement turns Hostile to you (a warning, then seizure).
        const b = CL.business.get(c());
        if (!b) return CL.ui.message('You own no mill');
        const f = CL.realm.owner(b.place, c());
        CL.realm.adjust(c(), f, -100 - CL.realm.score(c(), f), 'debug');
        CL.business.tick(c());
        log('mill owner hostile', { place: b.place, owner: f });
        CL.ui.refresh();
        break;
      }
      case 'tourney': {
        // P7-09: a tournament opens here now (a host town), as if its day had come.
        const sid = c().world.location;
        const t = CL.tourney.state(c());
        if (!t.hosts[sid]) return CL.ui.message('Only the great towns hold tournaments');
        t.hosts[sid].next = c().day;
        t.hosts[sid].entered = null;
        CL.tourney.tick(c());
        log('tournament', { host: sid });
        CL.ui.refresh();
        break;
      }
      case 'happening': {
        // P7-08: a world event where you stand: the first kind the world calls for here, else any.
        const sid = c().world.location;
        if (!sid) return CL.ui.message('Enter a settlement first');
        const H = CL.happenings;
        const kinds = [...H.KINDS.filter((k) => H.fits(c(), CL.content.get('world_events', k), sid)), ...H.KINDS];
        let e = null;
        for (const k of kinds) if (!e) e = H.start(c(), k, sid);
        if (!e) return CL.ui.message('Something is already going on here');
        log('world event', { kind: e.kind, place: sid });
        CL.ui.refresh();
        break;
      }
      case 'sites':
        resetSites();
        break;
      case 'teleport':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        teleport($('#cheatPlace').value);
        Object.assign(CL.game, { town: null, talk: null, battleMap: null }); // leave the old streets behind
        CL.save.write();
        CL.town.enterPlace();
        return;
      case 'stress':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        CL.combat.setActiveCap(Number($('#cheatCap').value));
        toggle(false);
        stressBattle(n);
        return;
      case 'divisionsReset': // P9-B4
        delete c().divisions;
        log('divisions reset', {});
        CL.ui.message('Divisions: back to the default split');
        break;
      case 'benchmark': // P9-B1
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        toggle(false);
        benchmark();
        return;
      case 'camera':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        toggle(false);
        cameraTest(n, { help: btn.dataset.help === '1' });
        return;
      case 'ford':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        toggle(false);
        fordTest(n);
        return;
      case 'assault': // P8-06b
      case 'assaultDefend':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        toggle(false);
        CL.game.siteId = null;
        CL.game.partyId = null;
        CL.combat.startBattle(CL.assault.practice(n, act === 'assault' ? 'attack' : 'defend'));
        log('practice assault', { total: n, side: act === 'assault' ? 'attack' : 'defend' });
        return;
      case 'hills': // P7-11
      case 'wagon':
        if (mode === 'battle' || mode === 'result') return CL.ui.message('Finish the battle first');
        toggle(false);
        fordTest(n, act === 'hills' ? 'hill_slopes' : 'open_country', act === 'wagon' ? 'wagon' : null);
        return;
      case 'win':
      case 'lose':
        if (!endBattleNow(act === 'win')) CL.ui.message('Not in a battle');
        toggle(false);
        return;
      case 'wipe':
        if (!wipeArmed) {
          wipeArmed = true;
          btn.textContent = 'Really wipe? Press again';
          return;
        }
        wipeSave();
        root.location.reload();
        return;
    }
    if (mode !== 'battle') CL.save.write();
    CL.ui.refresh();
    CL.ui.message(`Debug: ${btn.textContent}`);
  }

  function toggle(show) {
    const panel = document.querySelector('#cheatPanel');
    const open = show ?? panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    if (open) populate();
    wipeArmed = false;
    document.querySelector('#cheatWipe').textContent = 'Wipe save…';
  }

  function bind() {
    document.querySelector('#cheatBtn').onclick = () => toggle();
    document.querySelector('#closeCheats').onclick = () => toggle(false);
    for (const b of document.querySelectorAll('[data-cheat]')) b.onclick = () => run(b);
  }

  CL.debugTools = {
    mapStress,
    stressFrame,
    addGold,
    addSoldiers,
    healAll,
    dismissAll,
    addItem,
    addFood,
    addMorale,
    adjustStat,
    toggleGod,
    passDays,
    resetSites,
    teleport,
    endBattleNow,
    stressBattle,
    BENCH,
    benchDef,
    benchmark,
    benching,
    benchFrame,
    benchDone,
    benchStop,
    cameraTest,
    fordTest,
    mapTest,
    wipeSave,
    toggle,
    bind,
  };
})(typeof window !== 'undefined' ? window : globalThis);
