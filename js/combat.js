// @ts-check
/* Crownless battle simulation: waves, swings, blocks, AI, arrows, win/loss checks.
 * Touches the DOM only through CL.ui hooks so it can run under Node tests. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { rand, dist, normalize } = CL.util;
  const { ARC, makeUnit, inArc, swingPhase, isCommitted, aim, move, push } = CL.units;
  const P = CL.profile; // P11-01: each fighter's timing, cooldown, arc and targets come from its profile

  // Time from one melee attack start to the next (archers use their troop's ranged.cooldown): each
  // fighter's profile (`P.cooldownOf`). These are the defaults of a fighter without one.
  const COOLDOWN = { hero: P.DEFAULT_COOLDOWN.hero, melee: P.DEFAULT_COOLDOWN.ai };
  const ARROW = { life: 1.6, hitRadius: 19, rangeSlack: 20, aimHeight: 16 };
  // P11-07 (docs/PHASE-11-PLAN.md §10.6): a shot's flight. Past its effective range its damage falls to
  // `farDamage` at the far end, where it drops; a troop's far end is its range × `far` unless it says.
  const FLIGHT = { far: 1.5, farDamage: 0.5, cell: 64 };
  // The hero's bow: walking while drawing, the arc a target is chosen in, how far a shot may lead.
  const BOW = { drawWalk: 0.5, cone: Math.cos(Math.PI / 3), leadMax: 0.9 };
  // A missed shot (1 - accuracy) is thrown off by 0.12–0.25 rad: enough to miss a standing target.
  const MISS_ANGLE = [0.12, 0.25];
  const SHOT_FLASH = 0.2;
  const KNOCKBACK = 6; // a blow's push when the striker has no profile (the family's `knockback` otherwise)
  // P11-05 (docs/PHASE-11-PLAN.md §10.1–§10.4): the melee rhythm's limits. The numbers are measured
  // (scripts/duel-lab.js), each with its test in tests/melee.test.js.
  const MELEE = {
    second: 0.7, // a blow's second and later targets take this share of its damage (nearest first; measured: 0.6 left the outnumbered company 20 points under the odds)
  };
  const STAGGER = {
    sway: 0.3, // a staggered fighter's swing is lost, and they can't start another for this long (s)
    immune: 0.9, // then no stagger again for this long: at most one in a window, no stunlock
  };
  const KNOCK = { window: 1.2, shrink: 0.5 }; // repeated pushes on one fighter in a window halve each time
  const SHIELD = {
    capacity: 4, // the pressure a raised shield takes before the guard breaks (a sword's blow is 1)
    recover: 1.5, // pressure shed a second while the shield is down
    broken: 1.0, // seconds the shield stays down once the guard breaks
    skill: 0.1, // the Shield skill: +10% capacity and recovery a point
    arcPerPoint: 2, // and a degree either side wider a point (from the 120° cover)
    shot: 0.25, // an arrow or bolt stopped presses a shield a quarter as hard as a sword's blow (measured: the night run of 5.7.0, the walls' defenders' shields broken by volleys)
  };
  const WEAPON_GUARD = { arc: Math.cos(Math.PI / 4), take: 0.45 }; // a 90° guard that lets 45% through
  // P11-09 (the night run of 5.7.0): a soldier on a ladder is off balance: no guard, and a blow lands
  // harder. The walls' edge for their defenders, once the hero no longer sweeps the ladder heads alone.
  const CLIMB = { exposed: 3.2 }; // measured: defending 13 of 15 against odds of 65, storming 8 of 15 against 41
  const PARRY = { window: 0.15 }; // D-P11j, an experiment behind a setting (off): Block raised this soon before a blow
  const GUARD_DELAY = { T1: 0.2, T2: 0.13, T3: 0.1 }; // an AI shield's reaction (by tier; by style from P11-10)
  const FEEDBACK = { every: 1.5 }; // the hero's own whiff and out-of-reach words, at most this often (s)
  const INPUT_BUFFER = 0.1; // GDD §6: a press up to 100 ms before recovery ends still swings
  const DEPLOY_CAP = { infantry: 12, archer: 8, cavalry: 6 };
  // GDD §7: cavalry accelerate toward a target, pass through, and turn for another run.
  // P11-08 (docs/PHASE-11-PLAN.md §10.7): the hero in the saddle. A horse's pace, gallop and turning are
  // its own (data/items.js `mount`); Riding turns and gathers it faster and eases a weapon's or a bow's
  // penalty from the saddle; half of each blow that lands on a mounted hero falls on the horse.
  const SADDLE = { turnPerRiding: 0.08, accelPerRiding: 0.05, penaltyPerRiding: 0.04, penalty: 0.2, bowDraw: 1.2, gallopSpread: 0.25, horseShare: 0.5, slowest: 0.25, unhorsed: 0.6, lanceStill: 0.15, reared: 0.5, braceWound: 2 };
  const CAVALRY = {
    rampSeconds: 0.8, // from half to full speed while charging straight
    chargeBonus: 1.2, // GDD §6 AttackModifier for a simple cavalry charge (AI only)
    chargeMomentum: 0.6, // momentum needed for the bonus
    passDistance: 22, // this close, the rider rides on through
    overrunSeconds: 0.6, // how long they keep going before wheeling round
    followRange: 180, // on Follow, engage enemies this close
    holdRange: 160, // on Hold, engage enemies this close
    followGap: 80, // otherwise stay this near the hero
  };
  /**
   * GDD §6 scaling: at most `activeCap` units fight at once (hero, companion, soldiers and enemies
   * together). Each side's share is fixed when the battle starts; the rest wait in reserve and step in
   * as others fall, a stack at a time. The cap is a device setting, 20 to 200 in steps of 10 (P9-B1,
   * D-P9a; 20 / 30 / 40 before 3.1.0, up to 150 in 3.1.0). `base` is the size the battle's numbers were tuned at: above it,
   * the deployment grows with the size (`scaleOf`).
   */
  const BATTLE = { activeCap: 40, capChoices: Array.from({ length: 19 }, (_, i) => 20 + i * 10), base: 40, stack: 3, minEnemies: 6, minShare: 10, stall: 45 }; // stall: seconds without a blow (V2-T2)
  // P9-B2: in a shared battle, reserves come in groups that grow with the size (3 at 40, 8 at 200), and
  // say so at most every few seconds a side.
  const RESERVES = { groupPer: 25, noteEvery: 6, behind: 150 };
  /** How many reserves step in at once. */
  const stackOf = (g) => (g?.share ? Math.max(BATTLE.stack, Math.round(BATTLE.activeCap / RESERVES.groupPer)) : BATTLE.stack);

  /**
   * P9-B2 (D-P9c, as in Mount & Blade): each side's places on the field are its share of all the
   * fighters. If everyone fits, everyone fights; otherwise each side gets the size in proportion to its
   * numbers (300 against 200 at 100: 60 and 40), never fewer than 10 (or all of a smaller side).
   * @param {number} size @param {number} mine @param {number} theirs
   * @returns {{ allies: number, enemies: number }}
   */
  function shareOf(size, mine, theirs) {
    if (mine + theirs <= size) return { allies: mine, enemies: theirs };
    const least = (n) => Math.min(n, BATTLE.minShare);
    const a = Math.max(least(mine), Math.min(size - least(theirs), Math.round((size * mine) / (mine + theirs))));
    return { allies: a, enemies: size - a };
  }

  /**
   * Both sides' numbers for a shared battle about to start from the campaign (the Prepare screen's
   * line): yours are the hero, the companions who are fit and the healthy soldiers.
   * @param {any} enc @returns {{ mine: number, theirs: number, allies: number, enemies: number }}
   */
  function fieldShare(enc) {
    const withMara = (CL.companion.fit() ? 1 : 0) + CL.retinue.fighters(CL.campaign).length;
    const mine = 1 + withMara + CL.party.healthySoldiers().length;
    const theirs = (enc.waves || []).reduce((n, w) => n + Object.values(w).reduce((a, b) => a + b, 0), 0);
    return { mine, theirs, ...shareOf(BATTLE.activeCap, mine, theirs) };
  }
  /** How much bigger than the tuned size this battle is: 1 up to 40, 5 at 200. */
  const scaleOf = () => Math.max(1, BATTLE.activeCap / BATTLE.base);
  const ARMY = { from: 20 }; // P9-B4: an enemy of more than this plans as an army (enemyPlan)
  /** How many of a role may stand on the field at the start (the rest wait in reserve). @param {string} role */
  const deployCap = (role) => Math.round(DEPLOY_CAP[role] * scaleOf());
  const DEFAULT_ENCOUNTER = 'captains_trial';
  const GUARD_SPEED = 0.65;
  const USE_AIM = { on: true }; // P11-13: soldiers' blows aimed at their foe (off: the four facings, for measuring)
  const MAX_DT = 0.05;

  // AI distances (px). goal = stopping distance from destination.
  const AI = {
    archer: { chase: 145, followGoal: 98, followEngage: 205, followFight: 143, holdEngage: 218, holdFight: 150 },
    melee: { chase: 38, followGoal: 62, followEngage: 75, followFight: 37, holdEngage: 85, holdFight: 37 },
  };

  // B-01: how the enemy fights. Its foot keeps a loose line until close instead of streaming in one by
  // one (a soldier this far ahead of the rest's middle, and not yet near its target, slows to wait),
  // unless it already has the numbers (then it just swarms: the line made such fights hopeless); and
  // it picks on the exposed: archers, the badly wounded, a hero standing alone.
  // P9-B2: a band on the map now fights as one army, not in waves of 8, which made B-01's line too
  // strong in equal fights (10 against 10: fought 35% against odds of 79%) and its swarm too weak when
  // the enemy had the numbers. The line is looser and always kept: scripts/parity.js 5–15 points over again.
  const ENEMY = {
    lineSlack: 175, // px a soldier may run ahead of the line before waiting for it (55 before 3.2.0)
    lineEngage: 150, // px from its target: from here on it closes at full speed
    lineWait: 0.3, // its speed while waiting for the line
    lineOutnumber: Number.POSITIVE_INFINITY, // no line once the enemy outnumbers the company by more than this (1.25 before 3.2.0: now always a line)
    preferRange: 90, // px: an exposed target this much further than the nearest is still chosen
    prefer: { archer: 60, wounded: 45, heroAlone: 75 }, // how much further each is worth going
    woundedAt: 0.5, // hp share below which a soldier counts as wounded
    aloneRadius: 110, // px: a hero with no soldier of theirs this close is alone
    use: { line: true, target: true }, // for measuring each on its own (scripts/parity.js)
  };

  const game = () => CL.game;
  // The wagon of an escort ambush (P7-11, js/objective.js) is one more thing for the enemy to go for.
  const opponentsOf = (u) => (u.team === 'enemy' ? (game().wagon?.alive ? [game().hero, ...game().allies, game().wagon] : [game().hero, ...game().allies]) : game().enemies);
  /**
   * The nearest living one of a list (the first of equals, as a stable sort would give). One pass, no
   * sort: with 150 fighters the sort was a quarter of the battle's cost (P9-B1).
   */
  function nearestAlive(u, list) {
    let best;
    let bd = Number.POSITIVE_INFINITY;
    for (const v of list) {
      if (!v?.alive) continue;
      const d = (v.x - u.x) ** 2 + (v.y - u.y) ** 2;
      if (d < bd) [best, bd] = [v, d];
    }
    return best;
  }
  // Start a swing just inside reach; archers loose at their troop range.
  // An archer on high ground shoots further (P7-11, js/formations.js).
  const fireRange = (u) => (u.ranged ? CL.formations.rangeOf(u) : P.strikeRange(u));

  /** GDD §6: Damage = max(1, round(Raw × 100 / (100 + 4 × Armor))). */
  /** Battle sounds: the hero's own are loudest, everyone else's quieter (js/audio.js rate-limits them). */
  const sound = (name, ...units) => CL.audio?.play(name, units.some((u) => u?.role === 'hero') ? 1 : 0.4);

  /** P11-06: `pierce`, the share of the armour a blow ignores (a mace, a crossbow's bolt). */
  function mitigate(raw, armor, pierce = 0) {
    return Math.max(1, Math.round((raw * 100) / (100 + 4 * (armor || 0) * (1 - pierce))));
  }

  /** Deploy the hero plus healthy roster soldiers and start the encounter's first wave. */
  /** Start a battle from an encounter id (data/encounters.js) or a ready-made definition (a band). */
  /**
   * @param {any} [encounter] an encounter id or a ready-made definition
   * @param {{ plan?: any }} [opts] plan: a battle setup from the preparation screen (js/prep.js, V2-07)
   */
  function startBattle(encounter = DEFAULT_ENCOUNTER, opts = {}) {
    const g = game();
    const enc = typeof encounter === 'string' ? CL.content.encounter(encounter) : encounter;
    g.encounter = enc.id;
    g.encounterDef = enc;
    g.lairDefence = Boolean(g.siteId); // B-01: a band fighting for its own lair is steadier
    g.battleId = CL.campaign.battles + 1;
    if (!enc.practice && !enc.duel) CL.encounter.beginIfClosed(); // a failed retreat keeps its encounter; a fresh battle starts one
    g.totalWaves = enc.waves.length;
    g.mode = 'battle';
    CL.audio?.onMode('battle'); // battles don't start through ui.changeMode, so tell the music here
    g.paused = false;
    g.t = 0;
    g.wave = 0;
    g.kills = 0;
    g.lastBlowAt = 0;
    g.heroDownNote = false;
    g.helpKills = 0; // enemies cut down by parties that rode in to help (V2-09): theirs, not yours
    delete g.prepPlan; // set again by the preparation screen's plan, if any (V2-07)
    Object.assign(g, { routed: 0, allyRouted: 0, morale: {}, moraleState: {}, moraleIn: 0, routEvents: [], rallyReadyAt: 0, concededNote: false });
    g.allies = [];
    g.enemies = [];
    g.arrows = [];
    g.effects = [];
    g.attackQueuedAt = null;
    g.frameTally = { frames: 0, ms: 0 }; // this device's frame rate in this battle (js/main.js; P9-B1's slow offer)
    g.allyReserve = [];
    g.enemyReserve = [];
    g.share = Boolean(enc.share) && !enc.practice && !enc.duel; // P9-B2: one army a side, sharing the field
    g.reserveNoteAt = {};
    // A practice battle (the debug panel's stress test) brings its own soldiers and changes nothing.
    g.practice = Array.isArray(enc.practice) ? { started: performance.now(), frames: 0, sim: 0, draw: 0, worst: 0, peak: 0, frameList: [], simList: [], drawList: [], cache: CL.gfx?.cacheStats?.() ?? null } : null;
    // A tournament bout (P7-09): the hero alone, in the loaner kit, against one fighter; its result goes
    // to the bracket (js/tourney.js), never the encounter commit path.
    g.duel = enc.duel ? { opponent: { ...enc.duel.opponent }, kit: { ...enc.duel.kit } } : null;
    g.group = 'infantry';
    g.orders = CL.divisions.startOrders(); // per division (P9-B4): its role's to start with
    Object.assign(g, { formations: {}, facings: {}, captains: {}, timed: [] }); // P9-B4: each division's formation, facing and captain; layer 4's timed orders
    // A ready-made arena (the debug camera test, PROTO-A) or a battle map from the content.
    g.battleMap = enc.mapDef || CL.arena.mapFor(enc.map || 'open_country');
    g.formation = 'loose'; // the infantry's formation (P7-11): the battle setup or Orders may change it
    g.wagonLost = false;
    CL.objective.begin(g, enc); // an escort ambush's wagon (P7-11), before the company forms up round it
    CL.assault?.begin(g, enc); // a siege's assault (P8-06b): the gate, the ram, the courtyard
    const anchor = g.battleMap.spawn.hero;
    g.hero = makeUnit(anchor.x, anchor.y, 'ally', 'hero');
    // HP, damage, armour, shield and weapon from the character (and the kit worn): the hero's profile (P11-01).
    // P11-02: in the loadout you prefer if it can be used here, else the other (said, never silent).
    const kit = g.duel ? g.duel.kit : CL.campaign?.equipment;
    const lo = CL.gear.battleLoadout(CL.campaign, kit, { loaner: Boolean(g.duel) });
    const heroProfile = P.resolve({ hero: CL.campaign, equipment: CL.gear.kitFor(CL.campaign, kit, lo.which), carried: kit }); // P11-06: the whole kit is carried
    P.apply(g.hero, heroProfile);
    g.hero.canBlock = heroProfile.canBlock;
    g.hero.guardKind = heroProfile.guardKind; // P11-05: a shield, a weapon guard or none
    // P11-08: in the saddle when the horse can fight, the field allows it, the weapon can be used from it
    // and you chose to ride; said when you can't.
    const rides = CL.gear.rideState(CL.campaign, kit, lo.which, g.battleMap);
    if (rides.ride) mountHero(g.hero, kit.horse, rides.mount);
    else if (rides.reason) CL.ui.message(rides.reason);
    CL.gear.begin(g, CL.campaign, kit, lo.which);
    if (lo.message) CL.ui.message(lo.message);
    g.hero.face = 'right';
    // Units start with a random cooldown so the AI's first blows are staggered; the player's hero must
    // be ready at once, or an Attack pressed in the first moments outlasts the 100 ms input buffer and
    // is lost (found by the W-00 browser tests). The random draw is kept, so seeded battles are unchanged.
    g.hero.attackCooldown = 0;
    // Share the field: the enemies get room for their biggest wave (up to half the cap), the
    // company the rest. Soldiers beyond their formation slots or that share wait in reserve.
    const alone = Boolean(g.practice || g.duel); // nobody of the company's own comes along
    const soldiers = g.practice ? enc.practice.map((troop) => ({ troop, id: null })) : g.duel ? [] : CL.party.healthySoldiers();
    const retinue = alone ? [] : CL.retinue.fighters(CL.campaign); // the other companions (P7-06)
    const withMara = (!alone && CL.companion.fit() ? 1 : 0) + retinue.length;
    const biggestWave = Math.max(...enc.waves.map((w) => Object.values(w).reduce((a, b) => a + b, 0)));
    // P8-06b: defending a fort, its garrison fights beside you, for itself (most of it; the rest hold the other
    // walls). P9-B5: it counts on your side of the shared field, and what doesn't fit waits in reserve.
    const guard = g.siege?.side === 'defend' && enc.garrison ? CL.assault.onThisWall(CL.autoresolve.expand(enc.garrison), 'defend') : [];
    if (g.share) {
      // P9-B2: the field shared by the armies' numbers (both sides feed in reserves to keep their share).
      const s = shareOf(BATTLE.activeCap, 1 + withMara + soldiers.length + guard.length, biggestWave);
      g.allyCap = Math.max(1 + withMara, s.allies);
      g.enemyCap = Math.max(1, BATTLE.activeCap - g.allyCap);
    } else {
      // A fixed encounter's waves: the enemies get room for their biggest wave (up to half the cap), the company the rest.
      const enemyShare = Math.max(Math.min(biggestWave, Math.floor(BATTLE.activeCap / 2)), BATTLE.minEnemies);
      g.allyCap = Math.max(1 + withMara, Math.min(1 + withMara + soldiers.length, BATTLE.activeCap - enemyShare));
      g.enemyCap = BATTLE.activeCap - g.allyCap;
    }
    const placed = { infantry: 0, archer: 0, cavalry: 0 };
    // How many of each role will form up at the start: a block no bigger than before 3.1.0 forms up as it always did.
    const forming = { infantry: 0, archer: 0, cavalry: 0 };
    for (const s of soldiers) {
      const role = CL.content.troop(s.troop).role;
      if (role in forming) forming[role]++;
    }
    for (const role of Object.keys(forming)) forming[role] = Math.min(forming[role], deployCap(role));
    const divs = CL.divisions.plan(alone ? null : CL.campaign, soldiers); // P9-B4: each soldier's division
    const divOf = (s) => divs.get(s.id ?? `#${soldiers.indexOf(s)}`);
    for (const s of soldiers) {
      const role = CL.content.troop(s.troop).role;
      if (!(role in placed)) continue;
      if (placed[role] >= deployCap(role) || 1 + withMara + g.allies.length >= g.allyCap) {
        g.allyReserve.push({ troop: s.troop, soldierId: s.id, div: divOf(s) });
        continue;
      }
      const big = forming[role] > DEPLOY_CAP[role];
      let [x, y] = startSpot(anchor, role, placed[role]++, big);
      if (big) {
        // A big company on a small field: kept inside it (separation spreads any crowd).
        const b = g.battleMap.bounds || CL.units.BOUNDS;
        [x, y] = [Math.max(b.minX, Math.min(b.maxX, x)), Math.max(b.minY, Math.min(b.maxY, y))];
      }
      const u = CL.traits.apply(CL.blacksmith.applyKit(makeUnit(x, y, 'ally', s.troop, s.id), s), s); // fine kit (P7-03), trait (P7-07)
      u.div = divOf(s);
      CL.units.resolveObstacles(u); // form up around trees and walls
      g.allies.push(u);
    }
    // The companion fights beside the hero (GDD §10), with the infantry's orders.
    if (!alone && CL.companion.fit()) {
      const m = CL.companion.get();
      const u = makeUnit(anchor.x - 40, anchor.y + 34, 'ally', 'mercenary');
      P.apply(u, P.resolve({ companion: CL.content.table('companions')[m.id], equipment: m.equipment }));
      Object.assign(u, { companion: m.id, role: 'infantry', div: 'infantry' });
      CL.units.resolveObstacles(u);
      g.allies.push(u);
    }
    retinue.forEach((m, i) => {
      const u = makeUnit(anchor.x - 40 - (i + 1) * 30, anchor.y + 34 + ((i % 2) * 2 - 1) * 26, 'ally', 'mercenary');
      P.apply(u, P.resolve({ companion: CL.content.table('companions')[m.id], equipment: m.equipment }));
      Object.assign(u, { companion: m.id, role: 'infantry', div: 'infantry' });
      CL.units.resolveObstacles(u);
      g.allies.push(u);
    });
    for (const a of g.allies) {
      a.holdX = a.x;
      a.holdY = a.y;
    }
    if (opts.plan && !alone) CL.prep.place(g, opts.plan); // the chosen setup (V2-07)
    if (guard.length) {
      const w = g.battleMap.wall;
      const room = Math.max(0, Math.min(g.allyCap ?? BATTLE.activeCap, BATTLE.activeCap) - g.allies.length - 1);
      guard.slice(0, room).forEach((troopId, i) => {
        const u = makeUnit(w.centre - w.outside * (50 + (i % 3) * 30), w.gaps[0].y + ((i * 47) % (g.battleMap.height - 200)), 'ally', troopId);
        u.outside = true;
        CL.units.resolveObstacles(u);
        g.allies.push(u);
      });
      for (const troop of guard.slice(room)) g.allyReserve.push({ troop, soldierId: null, garrison: true });
    }
    spawnWave();
    enemyPlan(g); // P9-B4: the enemy's own plan (layer 1, and layer 3's placement), in a battle with an army
    // P8-01: a lord fights in person, at the head of the first wave: their realm's best foot soldier, stronger, with their name.
    const lead = enc.leader && !g.duel ? g.enemies.find((u) => u.troop === enc.leader.troop) || g.enemies[0] : null;
    if (lead) {
      P.apply(lead, P.resolve({ troop: lead.troop }, { leader: enc.leader }), ['hp', 'maxhp', 'damage', 'armor']); // a lord's profile: their troop's, stronger, in the best kit (P11-11)
      if (enc.leader.style) lead.styleId = enc.leader.style; // P11-11: a lord fights as a veteran
      Object.assign(lead, { named: enc.leader.name, house: enc.leader.house || null });
    }
    if (g.wagon) CL.ui.message('Keep the Reavers off the wagon: if it burns, the caravan is lost');
    CL.assault?.announce(g); // the walls (P8-06b)
    if (g.duel) {
      const f = g.enemies[0];
      P.apply(f, P.resolve({ troop: f.troop }, { duel: g.duel.opponent }), ['hp', 'maxhp', 'damage', 'armor']); // the round's fighter (js/tourney.js)
      f.duelist = g.duel.opponent.name;
      if (g.duel.opponent.style) f.styleId = g.duel.opponent.style; // P11-10: the bout's style (a rival keeps theirs)
    }
    CL.reinforce.begin(g); // nearby parties that will join, and when (V2-09)
    Object.assign(g, { overview: false, cameraFocus: null, scanIn: 0 });
    CL.camera.snap(g); // one-screen maps keep the camera at 0,0
    CL.tactics.scan(g, 0); // what the company can see from the start
    CL.ui.hideBattleOverlays();
    CL.diag.log('info', 'Battle begun', { encounter: enc.id, battleId: g.battleId, deployed: placed, reserve: g.allyReserve.length, cap: BATTLE.activeCap });
  }

  /**
   * Where the i-th soldier of a role forms up when the battle starts (before any setup moves them):
   * infantry ahead, archers behind and below, cavalry on the left wing. A block no bigger than before
   * 3.1.0 (DEPLOY_CAP) forms up as it always did; a bigger one (`big`, P9-B1) is wider, so a big
   * company forms a line rather than a long column.
   * @param {{ x: number, y: number }} anchor @param {string} role @param {number} i @param {boolean} big
   */
  function startSpot(anchor, role, i, big) {
    if (!big) {
      if (role === 'infantry') return [anchor.x - 95 + (i % 3) * 42, anchor.y - 85 + Math.floor(i / 3) * 47];
      if (role === 'archer') return [anchor.x - 166 + (i % 3) * 40, anchor.y + 58 + Math.floor(i / 3) * 44];
      return [anchor.x - 210 + (i % 2) * 52, anchor.y - 120 + Math.floor(i / 2) * 56];
    }
    // Ranks run front to back (x), files across (y): the files grow with the block, so ranks stay few.
    const filesOf = (n) => Math.max(3, Math.ceil(Math.sqrt(n * 2)));
    const files = filesOf(deployCap(role));
    const [rank, file] = [Math.floor(i / files), i % files];
    if (role === 'infantry') return [anchor.x - 10 - rank * 42, anchor.y + (file - (files - 1) / 2) * 40];
    if (role === 'archer') return [anchor.x - 230 - rank * 40, anchor.y + (file - (files - 1) / 2) * 38];
    // Cavalry wait on the left wing (up the field, -y), clear of the infantry's line.
    const cols = Math.max(2, Math.ceil(Math.sqrt(deployCap(role))));
    const top = ((filesOf(deployCap('infantry')) - 1) / 2) * 40;
    return [anchor.x - 200 + (i % cols) * 52, anchor.y - top - 70 - Math.floor(i / cols) * 50];
  }

  function spawnWave() {
    const g = game();
    g.wave++;
    const wave = g.encounterDef.waves[g.wave - 1];
    const troops = Object.entries(wave).flatMap(([id, n]) => Array(n).fill(id));
    const room = enemyCapOf(g);
    for (const troopId of troops.slice(0, room)) addEnemy(g, troopId);
    g.enemyReserve = troops.slice(room);
    if (g.share) CL.ui.message(`${g.encounterDef.name}: ${troops.length} · ${g.enemies.length} on the field, the rest in reserve`);
    else if (!g.duel) CL.ui.message(`Enemy wave ${g.wave} / ${g.totalWaves}${g.enemyReserve.length ? ` · ${g.enemyReserve.length} more waiting` : ''}`);
    CL.diag.log('info', 'Enemy wave spawned', { wave: g.wave, enemies: wave, reserve: g.enemyReserve.length });
  }

  const enemyCapOf = (g) => g.enemyCap ?? Number.POSITIVE_INFINITY; // older battle states have no cap
  // Those running from the field (V2-08b) no longer hold a place in it: reserves can step in.
  const aliveCount = (list) => list.reduce((n, u) => n + (u.alive && !u.routing ? 1 : 0), 0);

  /** Put an enemy on the field: a troop id (in its spawn area), or { troop, join } for one riding in with a party (V2-09). */
  function addEnemy(g, spec) {
    const troopId = typeof spec === 'string' ? spec : spec.troop;
    const box = g.battleMap.spawn.enemies;
    let [x, y] = [rand(box.x0, box.x1), rand(box.y0, box.y1)];
    for (let tries = 0; tries < 30 && CL.units.blocked(x, y); tries++) [x, y] = [rand(box.x0, box.x1), rand(box.y0, box.y1)];
    const e = makeUnit(x, y, 'enemy', troopId);
    CL.units.resolveObstacles(e);
    e.face = 'left';
    const j = typeof spec === 'string' ? null : g.joining?.find((x) => x.id === spec.join);
    if (j) CL.reinforce.place(g, j, e);
    CL.objective.onEnemy(g, e, Boolean(j)); // every second one goes for an escort's wagon (P7-11)
    g.enemies.push(e);
    return e;
  }

  function addAlly(g, r) {
    const a = g.battleMap.spawn.hero;
    const u = makeUnit(a.x - 150 + rand(-30, 30), a.y + rand(-90, 90), 'ally', r.troop, r.soldierId);
    if (r.soldierId != null) {
      const s = CL.campaign.roster.find((x) => x.id === r.soldierId);
      CL.traits.apply(CL.blacksmith.applyKit(u, s), s); // fine kit (P7-03), trait (P7-07)
    }
    CL.units.resolveObstacles(u);
    u.face = 'right';
    u.holdX = u.x;
    u.holdY = u.y;
    if (r.garrison) u.outside = true; // a fort's garrison (P9-B5) fights for itself, as helpers do
    else if (r.join == null) u.div = r.div || u.role; // their division (P9-B4); helpers who ride in fight for themselves
    const j = r.join != null ? g.joining?.find((x) => x.id === r.join) : null;
    if (j) CL.reinforce.place(g, j, u); // a helper waiting in reserve rides in from its party's side
    g.allies.push(u);
    return u;
  }

  /**
   * Reserves step in as others fall: a stack at a time (or the last few), each side up to its
   * share of the field. Called every frame; cheap when nothing waits.
   */
  function reinforce(g) {
    const sides = [
      { team: /** @type {'enemy'} */ ('enemy'), reserve: g.enemyReserve, alive: aliveCount(g.enemies), cap: enemyCapOf(g), add: (t) => addEnemy(g, t), who: 'Enemy reserves' },
      { team: /** @type {'ally'} */ ('ally'), reserve: g.allyReserve, alive: (g.hero.alive ? 1 : 0) + aliveCount(g.allies), cap: g.allyCap ?? Number.POSITIVE_INFINITY, add: (r) => addAlly(g, r), who: 'Your reserves' },
    ];
    const stack = stackOf(g);
    for (const s of sides) {
      if (!s.reserve?.length) continue;
      const free = s.cap - s.alive;
      if (free < Math.min(stack, s.reserve.length)) continue;
      const n = Math.min(free, s.reserve.length);
      const entry = g.share ? reserveEntry(g, s.team) : null; // P9-B2: in a group, from behind their own line
      s.reserve.splice(0, n).forEach((r, i) => {
        const u = s.add(r);
        if (entry && r?.join == null) formAt(u, entry, i);
      });
      // A shared battle's reserves come often: a word at most every few seconds a side.
      const quiet = g.share && g.t - (g.reserveNoteAt?.[s.team] ?? -99) < RESERVES.noteEvery;
      if (!quiet) {
        if (g.reserveNoteAt) g.reserveNoteAt[s.team] = g.t;
        CL.ui.message(`${s.who}: ${n} join the fight${s.reserve.length ? ` (${s.reserve.length} still waiting)` : ''}`);
      }
      CL.diag.log('info', 'Reinforcements', { side: s.who, joined: n, waiting: s.reserve.length });
    }
  }

  /**
   * P9-B4: the enemy plans by the same rules as the company's Auto setup (js/prep.js): clearly the weaker
   * by the odds Simulate would state (the company's at 75% or better), it holds its ground and waits;
   * otherwise it comes on, as it always did. Either way it forms up in blocks on its side: foot in front,
   * archers behind, horse on the flanks. Only for an army (more than ARMY.from in it, so big battles have
   * shape on both sides: a band's small fight is as B-01 tuned it) met on the map (P9-B2's shared
   * battles; not an escort's ambush, whose raiders burst from cover); a lair, a story fight, the
   * tournament and the walls keep their own. @param {any} g
   */
  function enemyPlan(g) {
    g.enemyOrders = null;
    g.enemyFormations = null;
    if (!g.share || !g.enemies.length || g.wagon || g.siege || g.enemies.length + g.enemyReserve.length <= ARMY.from) return;
    const A = CL.autoresolve;
    const theirs = {};
    for (const e of [...g.enemies, ...g.enemyReserve.map((t) => ({ troop: t.troop || t }))]) theirs[e.troop] = (theirs[e.troop] || 0) + 1;
    const odds = A.winChance(A.playerPower(CL.campaign), A.troopsPower(theirs));
    const weak = odds >= CL.prep.AUTO.strong;
    g.enemyOrders = { infantry: weak ? 'hold' : 'charge', archer: weak ? 'hold' : 'charge', cavalry: weak ? 'hold' : 'charge' };
    // P11-13: by the same rules as the company's: its foot in a line (formed on Hold; on Charge it breaks up).
    g.enemyFormations = { infantry: 'line' };
    // Blocks on their side (facing the company, -x): foot in front, archers behind, horse on the flanks.
    const box = g.battleMap.spawn.enemies;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const at = { infantry: { x: box.x0 + 30, y: cy }, archer: { x: cx + 60, y: cy }, cavalry: { x: cx, y: box.y0 } };
    for (const role of ['infantry', 'archer', 'cavalry']) {
      const list = g.enemies.filter((e) => e.role === role);
      list.forEach((e, i) => {
        const o = CL.divisions.turn(CL.divisions.shape(g.enemyFormations[role] || 'loose', i, list.length), 'left');
        const flank = role === 'cavalry' && i % 2 ? box.y1 - box.y0 : 0;
        e.x = at[role].x + o.dx;
        e.y = at[role].y + flank + o.dy;
        CL.units.resolveObstacles(e);
        Object.assign(e, { holdX: e.x, holdY: e.y, face: 'left' });
      });
    }
    CL.diag.log('info', 'Enemy plan', { odds: Math.round(odds * 100), orders: g.enemyOrders });
  }

  /**
   * P9-B2: where a side's reserves come in: behind its own standing line (its rearmost fighter, a little
   * further back toward its own edge), level with its middle, slid along until no opponent is close;
   * with nobody of theirs standing, at their own start. @param {any} g @param {'ally' | 'enemy'} team
   */
  function reserveEntry(g, team) {
    const b = g.battleMap.bounds || CL.units.BOUNDS;
    const own = (team === 'ally' ? [g.hero, ...g.allies.filter((a) => !a.outside)] : g.enemies).filter((u) => u?.alive && !u.routing);
    const foes = (team === 'ally' ? g.enemies : [g.hero, ...g.allies]).filter((u) => u?.alive);
    const back = team === 'ally' ? -1 : 1;
    let x;
    let y;
    if (own.length) {
      x = team === 'ally' ? Math.min(...own.map((u) => u.x)) - RESERVES.behind : Math.max(...own.map((u) => u.x)) + RESERVES.behind;
      y = own.reduce((n, u) => n + u.y, 0) / own.length;
    } else if (team === 'ally') [x, y] = [g.battleMap.spawn.hero.x - RESERVES.behind, g.battleMap.spawn.hero.y];
    else {
      const box = g.battleMap.spawn.enemies;
      [x, y] = [box.x1, (box.y0 + box.y1) / 2];
    }
    const inset = 40;
    x = Math.max(b.minX + inset, Math.min(b.maxX - inset, x));
    for (let i = 0; i < 12; i++) {
      const yy = Math.max(b.minY + inset, Math.min(b.maxY - inset, y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 80));
      if (!foes.some((u) => Math.hypot(u.x - x, u.y - yy) < 120)) return { x, y: yy, back };
    }
    return { x, y: Math.max(b.minY + inset, Math.min(b.maxY - inset, y)), back };
  }

  /** Put the i-th of an incoming group in its place: files of five across, ranks going back. */
  function formAt(u, entry, i) {
    u.x = entry.x + entry.back * Math.floor(i / 5) * 30;
    u.y = entry.y + ((i % 5) - 2) * 30;
    CL.units.resolveObstacles(u);
    u.face = entry.back < 0 ? 'right' : 'left';
    u.holdX = u.x;
    u.holdY = u.y;
  }

  /**
   * Apply raw damage, reduced by the target's armor. A guarding target absorbs it entirely
   * when the source is inside its 120° shield arc (GDD §6); hits from behind or the flanks land.
   * Returns 'blocked' | 'hit' | 'down' | null.
   */
  /** P11-05: a fighter's guard: 'shield', 'weapon' (two-handed and spears with no shield) or 'none'. */
  const guardOf = (u) => u.guardKind || P.of(u)?.guardKind || (u.canBlock ? 'shield' : 'none');
  /** A raised shield's cover: 120°, a degree wider either side a point of the Shield skill. */
  const blockArc = (u) => (P.of(u)?.shieldSkill ? Math.cos(Math.PI / 3 + (P.of(u).shieldSkill * SHIELD.arcPerPoint * Math.PI) / 180) : ARC.block);
  /** Is a fighter's guard broken (the shield down for a moment)? */
  const broken = (u) => (u.guardBrokenUntil ?? -1) > game().t;
  /** The hero's own words in a fight (whiff, out of reach, blocked …), at most once in a while each. */
  function feedback(kind, text) {
    const g = game();
    g.feedbackAt = g.feedbackAt || {};
    if (g.t - (g.feedbackAt[kind] ?? -99) < FEEDBACK.every) return;
    g.feedbackAt[kind] = g.t;
    CL.ui.message(text);
  }

  /**
   * P11-05: a blocked blow presses the shield by its weapon's `shieldPressure`; at the shield's capacity
   * (more with the Shield skill) the guard breaks: the shield goes down for a moment and any windup is
   * lost. The pressure drains while the shield is down (`tickTimers`).
   */
  function press(u, source, shot = false) {
    const g = game();
    const skill = 1 + SHIELD.skill * (P.of(u)?.shieldSkill || 0);
    const amount = shot ? SHIELD.shot : (P.of(source)?.shieldPressure ?? 1);
    // P11-13: in a shield wall the shields beside take part of it (a wall holds longer than one shield).
    u.press = (u.press || 0) + amount * CL.formations.sharePressure(g, u, amount, SHIELD.capacity * skill);
    if (u.press < SHIELD.capacity * skill) return false;
    u.press = 0;
    u.guard = false;
    u.guardBrokenUntil = g.t + SHIELD.broken;
    if (swingPhase(u) === 'windup') u.swing = null;
    sound('guardBreak', u, source);
    g.effects.push({ x: u.x, y: u.y - 17, t: 0.45, color: '#f6daa6', kind: 'break' });
    if (u.role === 'hero') feedback('broken', 'Your guard is broken!');
    else if (source?.role === 'hero') {
      feedback('break', 'You broke their guard');
      g.brokeGuard = true; // the tip about shield pressure (data/help.js)
    }
    return true;
  }

  /**
   * P11-05: a blow that lands during the target's windup interrupts it when its `stagger` beats the
   * target's `poise`; then the target is immune for a while (no stunlock). A blow during the target's
   * own active window doesn't (both land).
   */
  function stagger(target, source) {
    const g = game();
    if (!source || !target.alive || swingPhase(target) !== 'windup') return false;
    if ((target.staggerUntil ?? -1) > g.t) return false;
    if ((P.of(source)?.stagger ?? 1) <= (P.of(target)?.poise ?? 1)) return false;
    target.swing = null;
    target.attackCooldown = Math.max(target.attackCooldown, STAGGER.sway);
    target.staggeredAt = g.t;
    target.staggerUntil = g.t + STAGGER.immune;
    sound('stagger', target, source);
    g.effects.push({ x: target.x, y: target.y - 26, t: 0.35, color: '#efe4c4', kind: 'stagger' });
    if (target.role === 'hero') feedback('staggered', 'Interrupted!');
    else if (source.role === 'hero') feedback('stagger', 'You staggered them');
    return true;
  }

  /** P11-05: the push of a landed blow, halving on each repeat inside a window (no knockback chains). */
  function knock(target, source) {
    const g = game();
    const k = target.knock && g.t - target.knock.at < KNOCK.window ? target.knock : { n: 0, at: g.t };
    const d = (P.of(source)?.knockback ?? KNOCKBACK) * KNOCK.shrink ** k.n;
    target.knock = { n: k.n + 1, at: g.t };
    if (d > 0.5) push(target, source.x, source.y, d);
  }

  function hit(target, raw, source, shot = false) {
    const g = game();
    if (!target.alive) return null;
    if (target === g.hero && g.godMode) return 'blocked'; // debug panel
    const climbing = Boolean(CL.assault?.climbing?.(g, target));
    if (climbing) raw *= CLIMB.exposed;
    const guard = target.guard && !climbing ? guardOf(target) : 'none';
    // D-P11j (an experiment, off by default): Block raised just before the blow lands deflects it.
    if (target === g.hero && source && guard !== 'none' && CL.settings?.get?.('parry') && g.t - (g.blockPressedAt ?? -99) <= PARRY.window && inArc(target, source, ARC.block)) {
      sound('block', target, source);
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.3, color: '#f6daa6', kind: 'block' });
      if (source.swing) source.swing = null;
      source.attackCooldown = Math.max(source.attackCooldown, STAGGER.sway * 1.5);
      feedback('parry', 'Parried!');
      return 'blocked';
    }
    if (guard === 'shield' && source && inArc(target, source, blockArc(target))) {
      sound('block', target, source);
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.2, color: '#f6daa6', kind: 'block' });
      if (source.role === 'hero' && !shot) feedback('blocked', 'Blocked');
      press(target, source, shot);
      return 'blocked';
    }
    // Shield cover (V2-08a, owner idea): a raised shield beside the target, on its shield side, takes a
    // frontal blow meant for it.
    const cover = !target.guard && source ? CL.groups.coverFor(target, source, target.team === 'ally' ? [g.hero, ...g.allies] : g.enemies) : null;
    if (cover) {
      sound('block', cover, source);
      g.effects.push({ x: cover.x, y: cover.y - 17, t: 0.2, color: '#f6daa6', kind: 'block' });
      press(cover, source, shot);
      return 'blocked';
    }
    // P11-05: a weapon guard takes part of a frontal blow, in a narrower arc, and isn't interrupted.
    const parried = guard === 'weapon' && source && inArc(target, source, WEAPON_GUARD.arc);
    if (parried) {
      raw *= WEAPON_GUARD.take;
      g.effects.push({ x: target.x, y: target.y - 17, t: 0.15, color: '#e8eef2', kind: 'block' });
    }
    if (g.practice && g.practice.firstHit == null) g.practice.firstHit = g.t; // camera test: time to contact
    // P11-13: a blow from a formed division's side or rear lands harder and shakes it more (morale).
    const flank = source ? CL.formations.flankOf(g, target, source) : 1;
    if (flank > 1) {
      raw *= flank;
      target.formFlankedAt = g.t;
    }
    const dealt = mitigate(CL.traits.blow(raw, source, target), target.armor, P.of(source)?.pierce || 0); // traits (P7-07); P11-06: pierce
    if (target.mounted && target.steed) {
      // P11-08 (D-P11f): half of it falls on the horse; if the horse falls, the rider is thrown.
      const horse = Math.round(dealt * SADDLE.horseShare);
      target.steed.hp = Math.max(0, target.steed.hp - horse);
      target.hp = Math.max(0, target.hp - (dealt - horse));
      if (!target.steed.hp) unhorse(target, true);
    } else target.hp = Math.max(0, target.hp - dealt);
    if (source && !inArc(target, source, ARC.block)) target.flankedAt = g.t; // hit from the flank or behind (morale, V2-08b)
    if (source && source.team !== target.team) {
      if (!target.hitBy) target.hitBy = new Set();
      target.hitBy.add(source);
    }
    target.flash = 0.14;
    g.lastBlowAt = g.t; // the stall guard (V2-T2)
    if (source && !target.wagon) knock(target, source); // a wagon doesn't budge
    if (source && !parried) stagger(target, source);
    g.effects.push({
      x: target.x,
      y: target.y - 23,
      t: 0.35,
      color: target.team === 'ally' ? '#f4bb72' : '#f77864',
      kind: 'hit',
    });
    if (target.hp) {
      sound('hit', target, source);
      return 'hit';
    }
    sound('down', target, source);
    target.alive = false;
    target.ground = true;
    target.downAt = g.t;
    target.swing = null;
    target.guard = false;
    target.press = 0; // no stagger or pressure left over on the fallen
    if (target.wagon) {
      CL.objective.onDown(g); // the caravan is lost (P7-11)
      return 'down';
    }
    if (target.team === 'enemy') {
      if (source?.outside) g.helpKills = (g.helpKills || 0) + 1;
      else g.kills++;
    }
    if (target.join != null) CL.reinforce.onDown(g, target);
    if (g.practice && g.practice.firstDown == null) g.practice.firstDown = g.t; // camera test: time to first blood
    if (source) source.kills = (source.kills || 0) + 1; // soldier XP for their own kills
    // Everyone else who wounded it earns an assist (soldiers' service records, V2-03).
    for (const u of target.hitBy || []) if (u !== source) u.assists = (u.assists || 0) + 1;
    target.hitBy = null;
    CL.diag.log('info', 'Unit down', { role: target.role, team: target.team, id: target.id });
    return 'down';
  }

  /** Begin an attack if the unit is ready. Returns true when an attack started. */
  function startAttack(u) {
    if (!u.alive || u.attackCooldown > 1e-6 || u.swing) return false;
    if (u.ranged) {
      const r = u.ranged;
      u.attackCooldown = r.cooldown;
      u.shot = SHOT_FLASH;
      sound('bow', u);
      const target = nearestAlive(u, opponentsOf(u));
      if (target && dist(u, target) < fireRange(u) + ARROW.rangeSlack) {
        let [dx, dy] = normalize(target.x - u.x, target.y - u.y);
        if (Math.random() > r.accuracy) {
          const off = rand(MISS_ANGLE[0], MISS_ANGLE[1]) * (Math.random() < 0.5 ? -1 : 1);
          [dx, dy] = [dx * Math.cos(off) - dy * Math.sin(off), dx * Math.sin(off) + dy * Math.cos(off)];
        }
        loose(u, dx, dy, u.damage * (u.moraleMul || 1));
        if (u.team === 'ally' && !u.outside) game().lastVolley = game().t; // the company's archers loose (P9-B4's timed orders)
      }
      return true;
    }
    // AI soldiers turn to their target as they wind up; the hero swings where they face.
    if (u.role !== 'hero' && u.target?.alive) aim(u, u.target);
    u.attackCooldown = P.cooldownOf(u);
    u.swing = { t: 0, hit: [] };
    // P11-13: a soldier's blow goes along the line to its foe, not only along one of the four facings
    // (a spear's 40° thrust at a foe standing at an angle missed: the crowd effect P11-11 found).
    if (u.role !== 'hero' && USE_AIM.on && u.target?.alive) u.swing.dir = normalize(u.target.x - u.x, u.target.y - u.y);
    sound('swing', u);
    return true;
  }

  /** During the active window, hit every opponent in reach and arc — each at most once per swing. */
  function resolveSwing(u) {
    const wedge = CL.formations.blow(game(), u); // a wedge's first blow lands harder (P7-11)
    const arc = P.arcOf(u);
    const most = P.targetsOf(u); // how many one blow can strike (P11-05: the family's, nearest first)
    if (u.swing.hit.length >= most) return;
    // P11-05: who is in reach and in the arc, nearest first; the second and later take less.
    const near = [];
    for (const v of opponentsOf(u)) {
      if (!v?.alive || u.swing.hit.includes(v.id)) continue;
      const d = dist(u, v);
      if (d > u.reach || !(u.swing.dir ? alongArc(u, v, u.swing.dir, d, arc) : inArc(u, v, arc))) continue;
      near.push([d, v]);
    }
    if (near.length > 1) near.sort((a, b) => a[0] - b[0]);
    for (const [, v] of near) {
      if (u.swing.hit.length >= most) break;
      if (u.swing.hit.length && !CL.formations.frontage(game(), v, u)) continue; // P11-13: a formed front meets one blow a slot
      const share = u.swing.hit.length ? MELEE.second : 1;
      u.swing.hit.push(v.id);
      const landed = hit(v, u.damage * (u.chargeBonus || 1) * (u.moraleMul || 1) * wedge * share, u);
      if (landed === 'hit') CL.formations.atBay(game(), u, v); // P11-13: a formed line's longer weapons hold the foe off
      if (wedge > 1) {
        v.flankedAt = game().t; // the wedge's blow shakes them as a flank blow does
        CL.formations.breakRanks(game(), v); // P11-13: and breaks a formed line's ranks where it lands
      }
      u.wedgeArmed = false;
      if (!u.swing) return; // the striker fell or was interrupted by what it struck (a guard broken back)
    }
  }

  /** P11-13: is v inside the cone of a blow aimed along dir? */
  const alongArc = (u, v, dir, d, arc) => (v.x - u.x) * dir[0] + (v.y - u.y) * dir[1] > d * arc;

  function advanceSwing(u, dt) {
    if (!u.swing) return;
    u.swing.t += dt;
    const phase = swingPhase(u);
    // P11-13: through the windup the aimed blow follows its foe (it is fixed once it lands).
    if (phase === 'windup' && u.swing.dir && u.target?.alive) u.swing.dir = normalize(u.target.x - u.x, u.target.y - u.y);
    if (phase === 'active') resolveSwing(u);
    else if (phase === 'recovery' && !u.swing.done) whiff(u);
    else if (phase === null) u.swing = null;
  }

  /**
   * P11-05: as the active window closes: a swing that struck nobody recovers longer (the family's
   * `miss`), so a held Attack against a patient opponent gives openings. The hero hears and reads it.
   */
  function whiff(u) {
    u.swing.done = true;
    if (u.swing.hit.length || u.ranged) return;
    u.swing.miss = P.of(u)?.miss || 0;
    if (!u.swing.miss) return;
    const g = game();
    if (u.role !== 'hero') return;
    sound('whiff', u);
    g.effects.push({ x: u.x, y: u.y - 8, t: 0.3, color: '#d9c8a2', kind: 'whiff', face: u.face });
    const foe = nearestAlive(u, opponentsOf(u));
    const close = foe && dist(u, foe) < u.reach + 30 && inArc(u, foe, P.arcOf(u));
    feedback('whiff', close ? 'Out of reach: step in, or wait for an opening' : 'Missed');
    g.whiffed = true; // the tip about whiffs (data/help.js)
  }

  function tickTimers(u, dt) {
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    if (u.press && !u.guard) u.press = Math.max(0, u.press - SHIELD.recover * (1 + SHIELD.skill * (P.of(u)?.shieldSkill || 0)) * dt); // P11-05
    u.shot = Math.max(0, u.shot - dt);
    u.flash = Math.max(0, u.flash - dt);
    if (u.alive) advanceSwing(u, dt);
  }

  /** Move along a direction at a fraction of the unit's speed (charging cavalry). */
  function ride(u, dx, dy, dt, factor) {
    const s = u.speed;
    u.speed = s * factor;
    move(u, dx, dy, dt);
    u.speed = s;
  }

  function cavalryAi(u, dt) {
    tickTimers(u, dt);
    u.aiTimer -= dt;
    if (u.aiTimer <= 0 || (u.target && !u.target.alive)) {
      u.aiTimer = rand(0.17, 0.41);
      u.target = CL.styles.riderTarget(game(), u, opponentsOf(u)) || nearestAlive(u, opponentsOf(u)) || null; // P11-10: archers first, braced spears last
    }
    u.momentum ??= 0;
    const target = u.target;
    const g = game();
    if (u.routing) return; // running: js/morale.js moves them
    let cmd = u.team === 'ally' && !u.outside ? CL.divisions.orderOf(g, u) : (u.team === 'enemy' && g.enemyOrders?.[u.role]) || 'charge'; // helpers fight for themselves; the enemy by its plan (P9-B4)
    if (u.morale === 'fallback') cmd = 'fallback'; // giving ground (V2-08b)
    // Braced spears in front stop the charge and hurt the rider (V2-08a).
    if (CL.groups.braceAgainst(g, u, opponentsOf(u), CAVALRY.chargeMomentum)) return;
    // Hold and Follow keep the horsemen back until enemies come close.
    if (!target || (cmd === 'hold' && dist(u, target) > CAVALRY.holdRange) || (cmd === 'follow' && dist(u, target) > CAVALRY.followRange) || (cmd === 'fallback' && dist(u, target) > u.reach + 20)) {
      u.momentum = 0;
      u.overrun = 0;
      const home = cmd === 'fallback' ? CL.morale.fallbackPoint(g, u) : cmd === 'hold' ? { x: u.holdX, y: u.holdY } : g.hero;
      const gap = cmd === 'hold' ? 5 : cmd === 'fallback' ? 30 : CAVALRY.followGap;
      if ((u.team === 'ally' || cmd === 'fallback') && home && dist(u, home) > gap + 5) move(u, home.x - u.x, home.y - u.y, dt);
      return;
    }
    if (u.overrun > 0) {
      // Riding on through after the pass, then wheel round for another run.
      u.overrun -= dt;
      ride(u, u.runDir[0], u.runDir[1], dt, 0.5 + 0.5 * u.momentum);
      if (u.overrun <= 0) u.momentum *= 0.4;
      return;
    }
    if (CL.styles.rideOut(g, u, target, dt)) return; // P11-10: ground down among foot: ride out to charge again
    const way = CL.arena.wayThrough(g.battleMap, u.x, u.y, target.x, target.y) || target; // P8-06b: through a gap in the wall
    const [dx, dy] = normalize(way.x - u.x, way.y - u.y);
    u.runDir = [dx, dy];
    const was = u.momentum;
    u.momentum = Math.min(1, u.momentum + dt / CAVALRY.rampSeconds);
    if (was < CAVALRY.chargeMomentum && u.momentum >= CAVALRY.chargeMomentum) sound('horse', u); // hooves at full gallop
    ride(u, dx, dy, dt, 0.5 + 0.5 * u.momentum);
    if (dist(u, target) < P.strikeRange(u) && !u.swing && u.attackCooldown <= 1e-6) {
      u.chargeBonus = u.momentum >= CAVALRY.chargeMomentum ? CAVALRY.chargeBonus : 1;
      startAttack(u);
    }
    if (dist(u, target) < CAVALRY.passDistance) u.overrun = CAVALRY.overrunSeconds;
  }

  function ai(u, dt) {
    if (CL.units.mounted(u) && u.alive) return cavalryAi(u, dt); // P11-04: a rider's way of fighting
    if (!u.alive) return;
    tickTimers(u, dt);
    u.aiTimer -= dt;
    // Retarget at once when the current target falls, instead of swinging at a body.
    if (u.aiTimer <= 0 || (u.target && !u.target.alive)) {
      u.aiTimer = rand(0.17, 0.41);
      const foes = u.trait ? opponentsOf(u).filter((o) => CL.traits.pursues(u, o)) : opponentsOf(u); // a cautious soldier lets runners go (P7-07)
      // Your soldiers mind the escort's wagon unasked (P7-11).
      const focus = u.team === 'ally' && u.div ? game().focusAt?.[u.div] : null; // P9-B4: a charge at a spot on the tactical map
      u.target = (u.team === 'enemy' && ENEMY.use.target ? enemyTarget(u) : (u.team === 'ally' && CL.objective.pick(game(), u, foes)) || nearestAlive(focus || u, foes)) || null;
    }
    const target = u.target;
    if (u.routing) return; // running: js/morale.js moves them (V2-08b)
    if (u.team === 'ally') CL.formations.arm(game(), u); // a wedge ready for its first blow (P7-11)
    // Shield troops raise their shields against a swing coming at them (V2-08a), and a shield wall
    // against archers too (P7-11).
    u.guard = !broken(u) && (CL.groups.shouldGuard(u, opponentsOf(u)) || (u.team === 'ally' && CL.formations.guard(game(), u, opponentsOf(u))));
    if (!target) return;
    const p = u.role === 'archer' ? AI.archer : AI.melee;
    let dest = target;
    let goal = p.chase;

    // P11-13: a formed soldier on Hold fights only what comes within its leash of its slot (and never
    // steps further than the leash from it); on Follow it breaks ranks only for that. Loose as before.
    const tether = u.outside || u.companion || u.morale === 'fallback' ? null : CL.formations.leash(game(), u);
    const given = u.team === 'ally' ? CL.divisions.orderOf(game(), u) : game().enemyOrders?.[u.role];
    const home = tether == null ? null : given === 'hold' ? { x: u.holdX, y: u.holdY } : given === 'follow' && u.team === 'ally' ? CL.groups.followSlot(game(), u) : null;
    const inLeash = home ? dist(home, target) < tether + (u.reach || 40) + 6 : false;
    if (u.team === 'enemy' && game().enemyOrders?.[u.role] === 'hold' && (home ? !inLeash : dist(u, target) >= p.holdEngage)) {
      // P9-B4: an enemy on Hold (its plan) keeps its place until the company comes within reach.
      dest = { x: u.holdX, y: u.holdY };
      goal = 5;
    }
    if (u.team === 'ally' && !u.outside) {
      const cmd = CL.divisions.orderOf(game(), u);
      if (cmd === 'follow') {
        // Loose ranks around the hero (V2-08a); break ranks to fight anything close.
        dest = u.companion ? game().hero : home || CL.groups.followSlot(game(), u);
        goal = u.companion ? p.followGoal : 6;
        if (home ? inLeash : dist(u, target) < CL.objective.reach(game(), target, p.followEngage * CL.traits.engage(u))) {
          dest = target;
          goal = p.followFight;
        }
      } else if (cmd === 'hold') {
        if (home ? inLeash : dist(u, target) < CL.objective.reach(game(), target, p.holdEngage * CL.traits.engage(u))) {
          dest = target;
          goal = p.holdFight;
        } else {
          dest = { x: u.holdX, y: u.holdY };
          goal = 5;
        }
      }
      // 'charge': chase the nearest enemy (defaults above).
      if (u.div && game().falling?.[u.div]) {
        // P9-B4: falling back to a spot (the tactical map): there first, fighting only what reaches them.
        dest = { x: u.holdX, y: u.holdY };
        goal = 5;
      }
    }
    if (u.morale === 'fallback' && dist(u, target) > fireRange(u) + 10) {
      // Falling back (V2-08b): give ground toward their own side, fighting only what reaches them.
      dest = CL.morale.fallbackPoint(game(), u);
      goal = 30;
    }

    // P11-10: by style, against the one it fights: hold at a longer weapon's reach, wait outside a ready
    // opponent's, strike into an opening; an archer keeps its distance and steps back from foot.
    let strike = true;
    let backFrom = null;
    const plan = dest === target && u.morale !== 'fallback' ? (u.ranged ? null : CL.styles.melee(game(), u, target, dt)) : null;
    if (plan) [goal, strike] = [plan.goal, plan.strike];
    if (u.ranged && u.morale !== 'fallback') {
      const A = CL.styles.archer(game(), u);
      if (A?.range && dest === target) goal = A.range;
      backFrom = A?.back || null;
    }
    // P9-B5: a climber keeps climbing: up and off the ladder before anything else.
    const top = CL.assault?.ladderTop(game(), u);
    if (top) [dest, goal, backFrom] = [top, 0, null];
    const d = dist(u, dest);
    const was = home && given === 'hold' ? dist(u, home) : null; // P11-13: the leash (below)
    if (backFrom || (plan?.keep && dest === target && d < goal - CL.styles.OPEN.keepBack)) {
      // Step back: from the foot soldier at an archer, or to the edge it keeps.
      const from = backFrom || target;
      const s = u.speed;
      u.speed *= CL.styles.OPEN.back * (u.guard ? GUARD_SPEED : 1);
      if (isCommitted(u)) u.speed *= P.of(u)?.moveDuringAttack ?? 1;
      move(u, u.x - from.x, u.y - from.y, dt);
      u.speed = s;
      if (!backFrom) aim(u, target);
    } else if (d > goal + 5) {
      const s = u.speed;
      if (u.guard) u.speed *= GUARD_SPEED; // a raised shield slows you, as it does the hero
      if (isCommitted(u)) u.speed *= P.of(u)?.moveDuringAttack ?? 1; // P11-05: committed to a swing
      if (u.team === 'ally') u.speed *= CL.formations.speed(game(), u); // a wall walks slower, a wedge quicker (P7-11)
      if (u.team === 'enemy' && ENEMY.use.line && aheadOfLine(u, target)) u.speed *= ENEMY.lineWait; // B-01: wait for the line
      if (u.raider && !CL.objective.sprung(game())) u.speed *= CL.objective.WAGON.lurk; // P7-T: lie in wait for the front to close
      // P8-06b: on the walls, the way across is through a ladder or the gate; some attackers carry the ram.
      const post = CL.assault?.ramPost(game(), u) || (dest === target ? CL.assault?.holdWall(game(), u, target) : null);
      const to = post && dest === target && dist(u, target) > fireRange(u) + 40 ? post : dest;
      const via = CL.arena.wayThrough(game().battleMap, u.x, u.y, to.x, to.y) || to;
      if (!CL.assault?.waitAtLadder(game(), u, via)) move(u, via.x - u.x, via.y - u.y, dt); // P9-B5: two on a ladder at a time
      u.speed = s;
    } else if (dest === target) aim(u, target);
    if (was != null && !top) {
      // P11-13: the leash: a formed soldier on Hold never steps further than it from their slot (going
      // back is always allowed: a crowd's shove beyond it is walked back, not followed). Hold holds.
      const away = dist(u, home);
      const most = Math.max(tether, was);
      if (away > most) {
        u.x = home.x + ((u.x - home.x) * most) / away;
        u.y = home.y + ((u.y - home.y) * most) / away;
        if (dest === target) aim(u, target);
      }
    }
    if (dist(u, target) < fireRange(u)) {
      if (u.ranged && !CL.groups.clearShot(u, target)) {
        // A tree or wall in the way: step aside for a clear shot instead of wasting arrows (V2-08a).
        CL.groups.seekShot(u, target, dt);
        if (u.team === 'ally' && game().t - (game().losNoteAt ?? -99) > 10) {
          game().losNoteAt = game().t;
          CL.ui.message('Archers: no clear shot, moving to find one');
        }
      } else {
        u.losBlocked = 0;
        if (strike && (!u.guard || CL.formations.strikesOver(game(), u)) && !CL.assault?.climbing(game(), u)) startAttack(u); // no swinging behind a raised shield, except over a shield wall (P7-11)
      }
    }
  }

  /**
   * B-01: who an enemy goes for. The nearest, unless someone exposed is not much further: an archer, a
   * badly wounded soldier, or the hero with none of the company close by.
   * @param {Unit} u
   */
  function enemyTarget(u) {
    const g = game();
    const foes = opponentsOf(u).filter((v) => v?.alive);
    if (!foes.length) return null;
    const h = g.hero;
    const heroAlone = h?.alive && !g.allies.some((a) => a.alive && !a.routing && Math.hypot(a.x - h.x, a.y - h.y) < ENEMY.aloneRadius);
    let best = null;
    let score = Number.POSITIVE_INFINITY;
    const nearest = Math.min(...foes.map((v) => dist(u, v)));
    for (const v of foes) {
      const d = dist(u, v);
      // The escort's wagon (P7-11) is worth going a long way round for.
      if (v.wagon) {
        const pull = CL.objective.enemyPull(u, v, Math.min(...foes.filter((f) => !f.wagon).map((f) => dist(u, f))));
        if (d - pull < score) [best, score] = [v, d - pull];
        continue;
      }
      if (d > nearest + ENEMY.preferRange) continue;
      let pull = 0;
      if (v.role === 'archer') pull = Math.max(pull, ENEMY.prefer.archer);
      if (v.hp < v.maxhp * ENEMY.woundedAt) pull = Math.max(pull, ENEMY.prefer.wounded);
      if (v === h && heroAlone) pull = Math.max(pull, ENEMY.prefer.heroAlone);
      if (d - pull < score) [best, score] = [v, d - pull];
    }
    return best;
  }

  /**
   * B-01: is this enemy foot soldier running ahead of its line (and not yet near its target)? The line
   * is the middle of the enemy's standing foot; ahead means nearer the target by more than the slack.
   * @param {Unit} u @param {Unit} target
   */
  function aheadOfLine(u, target) {
    if (u.role !== 'infantry' || u.raider || u.morale === 'fallback' || dist(u, target) < ENEMY.lineEngage) return false;
    const line = game().enemyLine;
    if (!line) return false;
    return Math.hypot(line.x - target.x, line.y - target.y) - dist(u, target) > ENEMY.lineSlack;
  }

  /** Where the enemy's standing foot is, on average (each frame, for the loose line). @param {any} g */
  function markLine(g) {
    const foot = g.enemies.filter((e) => e.alive && !e.routing && e.role === 'infantry' && !e.raider); // wagon-raiders keep no line (P7-11)
    const mine = [g.hero, ...g.allies].filter((a) => a?.alive && !a.routing).length;
    const swarm = g.enemies.filter((e) => e.alive && !e.routing).length > mine * ENEMY.lineOutnumber;
    g.enemyLine = foot.length > 1 && !swarm ? { x: foot.reduce((n, e) => n + e.x, 0) / foot.length, y: foot.reduce((n, e) => n + e.y, 0) / foot.length } : null;
  }

  /** P11-08: put the hero on their horse for this battle. */
  function mountHero(h, horseId, m) {
    const look = CL.gfx?.fig?.itemLook?.(horseId) || {};
    Object.assign(h, { mounted: true, mount: { coat: look.coat || '#8a5a3a', mane: look.mane || '#2e2119' }, footSpeed: h.speed, heading: { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.face] ?? 0, momentum: 0 });
    h.steed = { id: horseId, ...m, maxhp: m.hp };
    h.speed = m.speed;
  }

  /** P11-08: off the horse, for the rest of the battle (no remount, D-P11k): thrown (a stagger) or by choice. */
  function unhorse(h, thrown) {
    const g = game();
    if (!h.mounted) return false;
    h.mounted = false;
    h.momentum = 0;
    h.overrun = 0;
    h.speed = h.footSpeed || h.speed;
    if (thrown) {
      h.swing = null;
      h.staggeredAt = g.t;
      h.attackCooldown = Math.max(h.attackCooldown, SADDLE.unhorsed);
      g.effects.push({ x: h.x, y: h.y - 26, t: 0.35, color: '#efe4c4', kind: 'stagger' });
      sound('down', h);
      CL.ui.message(CL.gear.words('horse_down', { item: CL.content.item(h.steed.id).name }));
    } else CL.ui.message('You dismount: you fight on foot');
    CL.ui.gearButtons?.();
    return true;
  }

  /** P11-08: Dismount (Orders, or X): no remount in a battle. */
  function dismount() {
    const g = game();
    if (g.mode !== 'battle' || !g.hero?.alive) return false;
    return unhorse(g.hero, false);
  }

  /**
   * P11-08: steering a horse: the stick sets a heading the horse turns toward at its turning rate, and
   * holding a direction gathers speed (a light touch turns it, letting go slows it). It rides through
   * foot at a gallop, as cavalry do, and braced spears stop it.
   */
  function rideHero(h, x, y, dt) {
    const g = game();
    const S = h.steed;
    const riding = CL.character.skill('riding', CL.campaign);
    const turn = S.turn * (1 + SADDLE.turnPerRiding * riding);
    const accel = S.accel / (1 + SADDLE.accelPerRiding * riding);
    if (x || y) {
      const want = Math.atan2(y, x);
      let d = want - h.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      h.heading += Math.max(-turn * dt, Math.min(turn * dt, d));
      // Turning hard sheds a little speed; going straight gathers it.
      h.momentum = Math.max(0, Math.min(1, h.momentum + (Math.abs(d) < 0.6 ? dt / accel : -dt / (accel * 2))));
    } else h.momentum = Math.max(0, h.momentum - dt / (accel * 0.7));
    const speed = h.momentum;
    const brace = CL.groups.braceAgainst(g, h, g.enemies, CAVALRY.chargeMomentum);
    if (brace) {
      // A braced spear stops the charge (as anyone's), and the horse rears: the blow is lost and the
      // horse takes a wound by how fast it hit the spears (AI riders: P11-10).
      h.swing = null;
      h.attackCooldown = Math.max(h.attackCooldown, SADDLE.reared);
      h.staggeredAt = g.t;
      if (h.mounted && h.steed) {
        h.steed.hp = Math.max(0, h.steed.hp - Math.round(brace.damage * SADDLE.braceWound * speed * (h.steed.charge || 1)));
        if (!h.steed.hp) unhorse(h, true);
      }
      return;
    }
    if (h.momentum < 0.01 && !(x || y)) return;
    const old = h.speed;
    h.speed = S.speed * (SADDLE.slowest + (1 - SADDLE.slowest) * h.momentum);
    move(h, Math.cos(h.heading), Math.sin(h.heading), dt);
    h.speed = old;
    if (h.momentum >= CAVALRY.chargeMomentum && !h.gallopHeard) {
      h.gallopHeard = true;
      sound('horse', h);
    } else if (h.momentum < CAVALRY.chargeMomentum) h.gallopHeard = false;
  }

  /** P11-08: a blow from the saddle: a charge lands harder, a lance by momentum alone, a weapon with a penalty less. */
  function saddleBlow(h) {
    const S = h.steed;
    const fam = P.of(h)?.family;
    const use = CL.content.table('weapon_families')[fam]?.mounted || 'yes';
    const riding = CL.character.skill('riding', CL.campaign);
    const pen = use === 'penalty' ? 1 - SADDLE.penalty * Math.max(0, 1 - SADDLE.penaltyPerRiding * riding) : 1;
    const charge = fam === 'lance' ? (SADDLE.lanceStill + (1 - SADDLE.lanceStill) * h.momentum) * S.charge * 1.5 : h.momentum >= CAVALRY.chargeMomentum ? CAVALRY.chargeBonus * S.charge : 1;
    return pen * charge;
  }

  /**
   * Record an attack press so a tap during late recovery is not lost. P11-05: the window is measured to
   * when the hero is next ready (the swing's end or the cooldown, whichever is later): a press up to
   * 100 ms before that swings as soon as it can; an earlier one is dropped after 100 ms.
   */
  function queueAttack() {
    const g = game();
    const h = g.hero;
    g.attackQueuedAt = g.t;
    const left = h ? Math.max(h.attackCooldown || 0, h.swing ? Math.max(0, P.timingOf(h).total + (h.swing.miss || 0) - h.swing.t) : 0) : 0;
    g.attackQueuedUntil = g.t + (left <= INPUT_BUFFER ? left + 0.05 : INPUT_BUFFER);
  }

  function updateHero(h, dt) {
    const g = game();
    const k = g.hold;
    tickTimers(h, dt);
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + g.joystick.x;
    const y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0) + g.joystick.y;
    // Block input cannot interrupt a committed swing (GDD §6); it takes effect in recovery.
    const blockInput = Boolean(g.blockHeld || k.ShiftLeft || k.ShiftRight);
    // P11-02: bringing the other weapon to hand: no blow and no block until it is.
    if (g.loadout?.wanted && !h.swing) CL.gear.switchWeapon(g); // P11-09: a switch asked for mid-swing
    if (g.loadout?.switching) CL.gear.tick(g);
    const drawing = CL.gear.switching(g);
    // GDD §6: blocking needs a shield equipped; P11-05: or a weapon that guards (two-handed, a spear).
    if (blockInput && !g.blockWasHeld) g.blockPressedAt = g.t; // for the parry experiment (D-P11j)
    g.blockWasHeld = blockInput;
    h.guard = h.alive && blockInput && guardOf(h) !== 'none' && !(h.mounted && guardOf(h) === 'weapon') && !isCommitted(h) && !drawing && !broken(h);
    if (g.attackQueuedAt !== null && g.t > (g.attackQueuedUntil ?? g.attackQueuedAt + INPUT_BUFFER)) g.attackQueuedAt = null;
    if (!h.alive) return;
    // P11-06: a loaded hero takes a moment to reach full pace (the band's ramp, less with Agility).
    const ramp = P.of(h)?.ramp || 0;
    h.walkFor = x || y ? (h.walkFor || 0) + dt : 0;
    if (h.mounted) rideHero(h, x, y, dt); // P11-08
    else if (x || y) {
      const old = h.speed;
      if (ramp > 0) h.speed *= Math.min(1, 0.4 + (0.6 * h.walkFor) / ramp);
      if (h.guard) h.speed *= GUARD_SPEED;
      if (isCommitted(h)) h.speed *= P.of(h)?.moveDuringAttack ?? 1; // P11-05: a committed swing slows your feet
      if (h.ranged && !h.ranged.crossbow && (h.drawT || 0) > 0) h.speed *= BOW.drawWalk; // P11-07: drawing a bow
      move(h, x, y, dt);
      h.speed = old;
    }
    const wantsAttack = g.attackHeld || k.Space || g.attackQueuedAt !== null;
    if (h.ranged) {
      // P11-07: the bow or crossbow in hand (a tap queues a loose; Space held draws like the button).
      if (g.attackQueuedAt !== null && !g.attackHeld && !k.Space) {
        g.looseQueued = true;
        g.attackQueuedAt = null;
      }
      if (!drawing) heroShoot(h, dt, Boolean(g.attackHeld || k.Space), Boolean(x || y));
      return;
    }
    if (h.mounted) h.chargeBonus = saddleBlow(h); // P11-08: set as the swing starts (resolveSwing reads it)
    if (wantsAttack && !h.guard && !drawing && startAttack(h)) g.attackQueuedAt = null;
  }

  /**
   * P11-07: a shot leaves `u` along (dx, dy): it carries its effective and far range, so how far it flies
   * decides its damage, not the moment it was loosed. @param {Unit} u
   */
  function loose(u, dx, dy, damage) {
    const r = u.ranged;
    // High ground (P7-11: a quarter further) lengthens the flight too, not only when they may shoot.
    const k = u.role === 'hero' ? 1 : Math.max(1, CL.formations.rangeOf(u) / (r.range || 1));
    const far = (r.maxRange ?? r.range * FLIGHT.far) * k;
    game().arrows.push({ x: u.x, y: u.y - 20, dx, dy, speed: r.projectileSpeed, team: u.team, life: far / r.projectileSpeed + 0.2, source: u, damage, flown: 0, range: r.range * k, far, shot: true });
  }

  /** The units of a list in a grid of cells (P9-B1's idea), for the shots' swept test. */
  function gridOf(list) {
    const cells = new Map();
    for (const v of list) {
      if (!v?.alive) continue;
      const k = Math.floor(v.x / FLIGHT.cell) * 4096 + Math.floor((v.y - ARROW.aimHeight) / FLIGHT.cell);
      const b = cells.get(k);
      if (b) b.push(v);
      else cells.set(k, [v]);
    }
    return cells;
  }

  /**
   * Where along a segment (0 to 1) it first passes within r of a point, or null. @returns {number | null}
   */
  function sweep(x0, y0, x1, y1, cx, cy, r) {
    const [dx, dy] = [x1 - x0, y1 - y0];
    const [fx, fy] = [x0 - cx, y0 - cy];
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    if (c < 0) return 0; // already inside
    if (a === 0) return null;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  /**
   * P11-07: shots fly their path each step, swept (a segment against each target's circle, through a
   * grid), so no speed passes through anyone; past the effective range their damage falls, and after the
   * far range they drop. Terrain stops them along the way, as before.
   */
  function updateArrows(h, dt) {
    const g = game();
    const grids = { ally: null, enemy: null };
    const gridFor = (team) => {
      if (!grids[team]) grids[team] = gridOf(team === 'ally' ? g.enemies : g.wagon?.alive ? [h, ...g.allies, g.wagon] : [h, ...g.allies]);
      return grids[team];
    };
    for (const a of g.arrows) {
      const step = a.speed * dt;
      const [x0, y0] = [a.x, a.y];
      const left = (a.far ?? Infinity) - (a.flown || 0);
      const len = Math.min(step, Math.max(0, left));
      const [x1, y1] = [x0 + a.dx * len, y0 + a.dy * len];
      a.life -= dt;
      // Terrain along the way (GDD §6: trees, walls and crates stop them).
      let stopAt = null;
      for (let d = 10; d < len + 10; d += 10) {
        const k = Math.min(1, d / Math.max(len, 1e-9));
        if (CL.units.arrowBlocked(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) {
          stopAt = k;
          break;
        }
      }
      // The first fighter the path crosses before that.
      const cells = gridFor(a.team);
      let best = null;
      let bt = stopAt ?? 1;
      const [cx0, cx1] = [Math.floor((Math.min(x0, x1) - ARROW.hitRadius) / FLIGHT.cell), Math.floor((Math.max(x0, x1) + ARROW.hitRadius) / FLIGHT.cell)];
      const [cy0, cy1] = [Math.floor((Math.min(y0, y1) - ARROW.hitRadius) / FLIGHT.cell), Math.floor((Math.max(y0, y1) + ARROW.hitRadius) / FLIGHT.cell)];
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          for (const v of cells.get(cx * 4096 + cy) || []) {
            if (!v.alive) continue;
            const t = sweep(x0, y0, x1, y1, v.x, v.y - ARROW.aimHeight, ARROW.hitRadius);
            if (t != null && t <= bt) [best, bt] = [v, t];
          }
        }
      }
      a.x = x0 + (x1 - x0) * bt;
      a.y = y0 + (y1 - y0) * bt;
      a.flown = (a.flown || 0) + len * bt;
      if (best) {
        const past = Math.max(0, a.flown - (a.range ?? Infinity));
        const span = Math.max(1, (a.far ?? Infinity) - (a.range ?? 0));
        hit(best, a.damage * (1 - (1 - FLIGHT.farDamage) * Math.min(1, past / span)), a.source, true);
        a.life = 0;
        continue;
      }
      if (stopAt != null) {
        a.life = 0;
        sound('thunk');
        g.effects.push({ x: a.x, y: a.y, t: 0.15, color: '#d9c8a2', kind: 'thunk' });
        continue;
      }
      if (a.far != null && a.flown >= a.far - 1e-6) {
        a.life = 0; // spent: it falls
        g.effects.push({ x: a.x, y: a.y + 14, t: 0.15, color: '#d9c8a2', kind: 'thunk' });
      }
    }
    g.arrows = g.arrows.filter((a) => a.life > 0);
  }

  // ---- P11-07: the hero's bow and crossbow ----

  /** The best target for an assisted shot: in the facing cone, in reach of the far range, a clear shot; the last struck first. */
  function aimTarget(h) {
    const g = game();
    const r = h.ranged;
    const far = r.maxRange ?? r.range * FLIGHT.far;
    const ok = (v) => v?.alive && !v.wagon && dist(h, v) <= far && inArc(h, v, BOW.cone) && CL.groups.clearShot(h, v);
    if (CL.settings?.get?.('aimAssist') === false) return null; // P11-09: assisted aim off: where you face
    if (ok(h.lastShot)) return h.lastShot;
    let best = null;
    let bd = Infinity;
    for (const v of g.enemies) {
      if (!ok(v)) continue;
      const d = dist(h, v);
      if (d < bd) [best, bd] = [v, d];
    }
    return best;
  }

  /** Where to aim at a moving target: ahead by its pace over the flight (a little short of it). */
  function lead(h, v) {
    const g = game();
    const tr = g.aimTrack;
    let [vx, vy] = [0, 0];
    if (tr && tr.id === v.id && g.t > tr.t) [vx, vy] = [(v.x - tr.x) / (g.t - tr.t), (v.y - tr.y) / (g.t - tr.t)];
    const t = Math.min(BOW.leadMax, dist(h, v) / h.ranged.projectileSpeed);
    return { x: v.x + vx * t, y: v.y + vy * t };
  }

  /** The hero's quiver for the weapon in hand (null for a melee weapon). */
  const quiver = (g) => (g.loadout?.ammo ? g.loadout.ammo[g.loadout.which] : null);

  /** Out of arrows: the other weapon to hand, or fists if there's none (and it's said). */
  function outOfArrows(g, h) {
    if (g.outOfArrowsAt === g.t) return;
    g.outOfArrowsAt = g.t;
    const L = g.loadout;
    const other = L.which === 'primary' ? 'secondary' : 'primary';
    const otherAmmo = L.ammo?.[other];
    const switched = L.can && otherAmmo !== 0 && CL.gear.switchWeapon(g);
    // One line, after the switch's own: what happened and what comes to hand.
    CL.ui.message(switched ? `Out of arrows: drawing your ${CL.content.item(other === 'secondary' ? L.kit.weapon2 : L.kit.weapon).name}` : 'Out of arrows: you fight with your fists');
    g.feedbackAt = g.feedbackAt || {};
    g.feedbackAt.whiff = g.t; // a held Attack's first swing with the other weapon doesn't talk over it
    if (switched) return;
    // Nothing else to use: fists.
    L.empty = true;
    P.apply(h, P.resolve({ hero: CL.campaign, equipment: { ...CL.gear.kitFor(CL.campaign, L.kit, L.which), weapon: null }, carried: L.kit }), ['damage', 'reach', 'ranged']);
    h.guardKind = 'none';
  }

  /**
   * P11-07: the hero with a bow or crossbow. A bow draws while Attack is held and looses when it's let go
   * (a tap looses as soon as the draw is full); walking is slower while drawing. A crossbow loads itself
   * on the spot (not while walking), then Attack held aims it and letting go looses. Assisted aim picks
   * the target (the ring shows it) and leads it; with manual aim the shot goes where you point.
   */
  function heroShoot(h, dt, held, moving) {
    const g = game();
    const r = h.ranged;
    const n = quiver(g);
    if (n != null && n <= 0) return outOfArrows(g, h);
    const released = g.attackWas && !held;
    g.attackWas = held;
    if (held && !g.attackWasDown) g.looseQueued = false;
    g.attackWasDown = held;
    if (r.crossbow) {
      if (!h.loaded) {
        if (!moving) h.drawT = Math.min(r.draw, (h.drawT || 0) + dt); // on the spot
        if (h.drawT >= r.draw) h.loaded = true;
      }
      if (released) g.looseQueued = true;
      if (h.loaded && g.looseQueued) return shootNow(h);
    } else {
      if (released) {
        if (h.drawT >= r.draw - 1e-9) return shootNow(h); // let go at full draw: it flies
        g.looseQueued = true; // let go early (a tap): it flies as soon as the draw is full
      }
      const pace = h.mounted && CL.content.table('weapon_families')[P.of(h)?.family]?.mounted === 'penalty' ? 1 / SADDLE.bowDraw : 1; // P11-08: a bow with a penalty draws slower from the saddle
      if (held || g.looseQueued) h.drawT = Math.min(r.draw, (h.drawT || 0) + dt * pace);
      else h.drawT = Math.max(0, (h.drawT || 0) - dt * 2); // eased off
      if (g.looseQueued && h.drawT >= r.draw - 1e-9) return shootNow(h);
    }
    // The target the shot would go to, for the ring (and its pace, for the lead).
    const v = manualAim(g) ? null : aimTarget(h);
    g.aimTarget = v;
    if (v) {
      if (!g.aimTrack || g.aimTrack.id !== v.id || g.t - g.aimTrack.t > 0.25) g.aimTrack = { id: v.id, x: v.x, y: v.y, t: g.t };
    }
  }

  /** Manual aim: where the pointer (desktop) or the aiming finger (phone, a setting) is, if anywhere. */
  function manualAim(g) {
    if (!g.aimPoint) return null;
    const on = g.aimPoint.touch ? CL.settings?.get?.('aimTouch') : CL.settings?.get?.('aimMouse') !== false;
    return on ? g.aimPoint : null;
  }

  function shootNow(h) {
    const g = game();
    const r = h.ranged;
    g.looseQueued = false;
    const point = manualAim(g);
    const v = point ? null : aimTarget(h);
    let to = point || (v ? lead(h, v) : null);
    if (!to) {
      // Nothing in the cone in reach: say why (too far, or nothing to shoot at), and shoot ahead.
      const near = CL.settings?.get?.('aimAssist') === false ? null : nearestAlive(h, g.enemies);
      if (near && inArc(h, near, BOW.cone)) {
        const far = r.maxRange ?? r.range * FLIGHT.far;
        feedback('far', dist(h, near) > far ? 'Too far' : 'No clear shot');
      }
      const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[h.face] || [1, 0];
      to = { x: h.x + f[0] * 100, y: h.y + f[1] * 100 };
    }
    let [dx, dy] = normalize(to.x - h.x, to.y - h.y);
    // P11-08: from the saddle a gallop throws the aim (Riding steadies it).
    const gallop = h.mounted ? SADDLE.gallopSpread * h.momentum * Math.max(0, 1 - SADDLE.penaltyPerRiding * CL.character.skill('riding', CL.campaign)) : 0;
    if (Math.random() > r.accuracy - gallop) {
      const off = rand(MISS_ANGLE[0], MISS_ANGLE[1]) * (Math.random() < 0.5 ? -1 : 1);
      [dx, dy] = [dx * Math.cos(off) - dy * Math.sin(off), dx * Math.sin(off) + dy * Math.cos(off)];
    }
    h.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    loose(h, dx, dy, h.damage * (h.moraleMul || 1));
    h.shot = SHOT_FLASH;
    h.drawT = 0;
    h.loaded = false;
    if (v) h.lastShot = v;
    if (g.loadout?.ammo && g.loadout.ammo[g.loadout.which] != null) g.loadout.ammo[g.loadout.which]--;
    sound('bow', h);
    CL.ui.quiverCount?.();
    g.drew = true; // the tip about drawing (data/help.js)
    return true;
  }

  function update(dt) {
    const g = game();
    if (g.mode !== 'battle' || g.paused || g.overview) return; // the tactical overview holds the battle still (V2-06)
    dt = Math.min(dt, MAX_DT);
    g.t += dt;
    const h = g.hero;
    updateHero(h, dt);
    markLine(g);
    for (const u of [...g.allies, ...g.enemies]) ai(u, dt);
    CL.units.separate([h, ...g.allies, ...g.enemies]); // bodies: crowd, but never stack on one spot
    updateArrows(h, dt);
    for (const e of g.effects) e.t -= dt;
    g.effects = g.effects.filter((e) => e.t > 0);
    CL.morale.update(g, dt); // hold · waver · fall back · rout (V2-08b)
    CL.reinforce.update(g); // nearby parties riding in (V2-09)
    reinforce(g);
    CL.tactics.scan(g, dt); // what the company can see (V2-06)
    CL.tactics.tickOrders(g); // timed orders, and divisions falling back (P9-B4)
    const before = g.groupState;
    const states = CL.groups.updateStates(g, dt) !== before; // forming · formed · advancing · engaged
    const formedNow = CL.formations.tick(g, dt) !== g.formWas; // P11-13: cohesion and the orders' states, every 0.25 s
    g.formWas = g.formState;
    if (states || formedNow) CL.ui.groupStates?.(g.groupState);
    CL.camera.follow(g, dt);
    heroDownOrders(g);
    stallGuard(g);

    // P8-06b: the attackers holding the courtyard decide an assault.
    const held = CL.assault?.update(g, dt);
    if (held) return CL.party.endBattle(g.siege.side === 'attack');
    // GDD §15 edge case: the battle only ends when no one is left waiting to step in.
    if (g.enemies.every((e) => !e.alive) && !g.enemyReserve?.length) {
      if (g.wave < g.totalWaves) {
        g.enemies = [];
        spawnWave();
      } else CL.party.endBattle(true);
    } else if (!h.alive && g.allies.every((a) => !a.alive) && !g.allyReserve?.length) CL.party.endBattle(false);
  }

  /**
   * V2-T2: when the hero falls, nobody is left to give orders or to follow, so the company fights on
   * by itself: every group charges (once; the player may still give new orders). Before this, soldiers
   * on Follow formed up round the fallen hero and those on Hold stayed put, and a battle could stall.
   * @param {any} g
   */
  function heroDownOrders(g) {
    if (g.hero.alive || g.heroDownNote || !g.allies.some((a) => a.alive && !a.outside)) return;
    g.heroDownNote = true;
    for (const grp of Object.keys(g.orders)) g.orders[grp] = 'charge';
    CL.ui.message('You are down! Your sergeants take over: the company charges');
    CL.diag.log('info', 'Hero down: the company charges');
  }

  /**
   * V2-T2 safety net: if nobody has landed a blow for STALL seconds and nobody is left to come, the
   * battle can't go on: the enemies still standing slip away (beaten, no kill credit, as when they rout).
   * @param {any} g
   */
  function stallGuard(g) {
    if (g.duel) return; // a bout is fought out: nobody slips away (or keeping away would win it)
    // P9-B5: in a shared battle the whole army withdraws, its reserves with it (they could wait for ever).
    if (g.t - (g.lastBlowAt ?? 0) < BATTLE.stall || (g.enemyReserve?.length && !g.share)) return;
    const left = g.enemies.filter((e) => e.alive);
    if (!left.length || !(g.hero.alive || g.allies.some((a) => a.alive))) return;
    for (const e of left) CL.morale.leave(g, e);
    if (g.share) g.enemyReserve = [];
    // B-01: also with waves still to come (before, a stuck pair could hold the next wave back for ever).
    g.lastBlowAt = g.t;
    CL.ui.message(g.wave < g.totalWaves ? 'Neither side will close. Those ones slip away, and more come on' : 'Neither side will close. The enemy slips away');
    CL.diag.log('warn', 'Battle stalled: the enemy withdrew', { left: left.length, t: g.t });
  }

  /** Change the active-unit cap (Settings / debug panel); takes effect from the next battle. */
  function setActiveCap(n) {
    if (!BATTLE.capChoices.includes(n)) return false;
    BATTLE.activeCap = n;
    CL.diag.log('info', 'Battle size set', { activeCap: n });
    return true;
  }

  /** Select a unit group and/or issue an order to the selected group. */
  /**
   * Select a division and/or give it an order (layer 2, P9-B4: by division; the default divisions are the
   * roles, so a company that never changed them commands its infantry, archers and cavalry as before).
   */
  function order(group, cmd) {
    const g = game();
    if (group) g.group = group;
    const D = CL.divisions;
    const div = g.group;
    const role = D.roleOf(div);
    const plain = { infantry: 'infantry', archer: 'archers', cavalry: 'cavalry' };
    const named = D.name(CL.campaign, div);
    if (cmd && !D.members(g, div).length) {
      // An order nobody can carry out says so (V2-08a; GDD §7 shows cavalry as unavailable).
      CL.ui.message(div === role ? `No ${plain[role]} in this battle` : `Nobody in ${named} in this battle`);
      return;
    }
    if (cmd) {
      g.orders[div] = cmd;
      if (cmd === 'hold') {
        for (const a of D.members(g, div)) {
          a.holdX = a.x;
          a.holdY = a.y;
        }
        CL.formations.closeUp(g, div); // a formed division closes up (P7-11, P9-B4)
      }
      // A shaken group takes the order but can't carry it out yet (V2-08b; design §8.5).
      const mood = CL.morale.word(g, 'ally', role);
      if (mood === 'routing') CL.ui.message(`${named} are routing: Rally them first (R)`);
      else if (mood === 'falling back') CL.ui.message(`${named} are falling back: they obey once steadied`);
      else CL.ui.message(`${div === role ? div.toUpperCase() : named.toUpperCase()} — ${cmd.toUpperCase()}`);
      CL.diag.log('info', 'Command issued', { group: div, cmd });
    }
    CL.ui.showSelectedGroup(div);
  }

  CL.combat = {
    CLIMB,
    SADDLE,
    dismount,
    unhorse,
    saddleBlow,
    FLIGHT,
    BOW,
    sweep,
    aimTarget,
    lead,
    MELEE,
    USE_AIM,
    STAGGER,
    KNOCK,
    SHIELD,
    WEAPON_GUARD,
    PARRY,
    GUARD_DELAY,
    guardOf,
    blockArc,
    ENEMY,
    AI,
    BATTLE,
    RESERVES,
    shareOf,
    fieldShare,
    stackOf,
    scaleOf,
    deployCap,
    setActiveCap,
    reinforce,
    CAVALRY,
    COOLDOWN,
    INPUT_BUFFER,
    DEPLOY_CAP,
    mitigate,
    startBattle,
    spawnWave,
    addEnemy,
    hit,
    startAttack,
    queueAttack,
    ai,
    update,
    order,
  };
})(typeof window !== 'undefined' ? window : globalThis);
