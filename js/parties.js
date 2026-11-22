/* Crownless world parties (GDD §8): patrols, caravans and Road Reaver bands moving on the map,
 * off-screen fights between them, caravans shifting market prices, and the player's encounter
 * choices — Attack, Auto-resolve, Negotiate, Retreat — for both bands and lair sites.
 * State: CL.campaign.parties (saved). Time advances through CL.party.advanceDays → tick().
 *
 * W-07, a simulation that scales: each step builds a spatial grid (js/spatial.js), so sight, chases,
 * contacts and clashes look only at nearby parties. Every party first chooses where to go, then all
 * move. Parties far from the player act once a game hour instead of every quarter hour; contacts are
 * swept (the closest approach of two parties' moves within the step, not just where they end), so a
 * coarse step never carries two parties through each other. Patrols of kingdoms at peace meet without
 * a fight, and may cause a border incident; in tension or at war they clash (js/realm.js). */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const A = () => CL.autoresolve;

  const STEP_HOURS = 0.25;
  const CONTACT = 1.6; // map units: parties this close meet
  const ARRIVE = 0.3;
  const EDGE = 2; // map units: parties keep this far inside the map's edges (W-04: from its bounds)
  const CHASE_RATIO = 0.5; // bandits only hunt a player at least this weak relative to them
  const INTIMIDATE_RATIO = 2.5; // a player this much stronger scares bandits off
  const IGNORE_AFTER = { retreat: 0.25, toll: 1, intimidate: 1, capture: 1 }; // days
  const CARAVAN_EFFECT = 0.08; // scarcity change at the destination (GDD: ±0.05–0.1)
  const WAVE_SIZE = 8;
  const AMBUSH_RANGE = 3.5; // map units: a contract ambush springs only on travellers passing close
  const SKIRMISH_LOSS = { loser: [1, 2], winnerChance: 0.5 }; // frontier clashes: men lost
  // P7-04: a party that loses sight of the company rides to where it last saw it, searches around
  // there for a while, then gives up.
  const SEARCH = { hours: 3, radius: 3 };
  const NEAR_PLAYER = 25; // map units: parties within this of the player act every step (W-07)…
  const COARSE_HOURS = 1; // …the rest once their time adds up to this
  /** Switches for tests: `grid: false` makes every search a full scan (the grid must change nothing). */
  const options = { grid: true };

  // One step's working state (W-07): the grid of where parties stood when they chose, each mover's
  // start point and hours, and time saved up by far parties (not saved: it only shapes the steps).
  let stepGrid = null;
  let moved = new Map();
  const banked = new WeakMap();

  // The world sim runs in steps inside a span of time the clock has already advanced, so it keeps
  // its own "now" for spawn timers, deaths and cooldowns (null outside a tick → the campaign day).
  let simDay = null;
  const now = (c) => simDay ?? c.day;

  const tpl = (id) => CL.content.get('party_templates', id);
  const settlement = (id) => CL.content.get('settlements', id);
  const W = () => CL.world;
  const dist = (a, b) => W().mapDist(a.x, a.y, b.x, b.y);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const pick = (c, list) => list[A().int(c, 0, list.length - 1)];
  const troopCount = (p) => Object.values(p.troops).reduce((a, b) => a + b, 0);
  const find = (c, id) => c.parties.find((p) => p.id === id) || null;
  /** Bands are always hostile; a kingdom's parties turn on the player once that kingdom is Hostile. */
  const hostileTo = (c, t) => t.hostile || CL.realm.isHostile(c, t.faction);

  // ---- Spawning ----

  function spawn(c, templateId) {
    const t = tpl(templateId);
    const troops = {};
    for (const [id, [lo, hi]] of Object.entries(t.troops)) {
      const n = A().int(c, lo, hi);
      if (n > 0) troops[id] = n;
    }
    if (!Object.keys(troops).length) troops[Object.keys(t.troops)[0]] = 1;
    const [mx, my] = [W().bounds().w / 2, W().bounds().h / 2]; // the map's middle until placed below
    const p = { id: c.nextPartyId++, template: t.id, x: mx, y: my, troops, tx: null, ty: null, ignoreUntil: 0, alerted: false };
    if (t.kind === 'bandit') {
      p.lair = pick(c, t.lairs);
      const s = W().map().sites[p.lair];
      Object.assign(p, { x: s.mapX, y: s.mapY });
    } else if (t.kind === 'patrol') {
      // Patrols muster at their home fort, or wherever their kingdom still holds if it has fallen.
      const h = CL.realm.owner(t.home, c) === t.faction ? settlement(t.home) : CL.realm.holdings(c, t.faction)[0] || settlement(t.home);
      Object.assign(p, { x: h.mapX, y: h.mapY });
    } else {
      p.routeIndex = A().int(c, 0, t.route.length - 1);
      const s = settlement(t.route[p.routeIndex]);
      Object.assign(p, { x: s.mapX, y: s.mapY, good: pick(c, t.goods) });
    }
    c.parties.push(p);
    CL.diag.log('info', 'Party spawned', { id: p.id, template: t.id, troops: p.troops });
    return p;
  }

  function remove(c, p) {
    const i = c.parties.indexOf(p);
    if (i >= 0) c.parties.splice(i, 1);
    if (p.contractId || p.questTag || p.eventId || p.lordId) return; // contract, quest and event bands are extra, and a lord rides again when free (P8-01): none holds up respawns
    const t = tpl(p.template);
    c.partySpawns[t.id] = Math.max(c.partySpawns[t.id] || 0, now(c) + t.respawnDays);
  }

  /** Is a newly spawned party one too many for its region (the world's simulation budget)? */
  function crowded(c, p) {
    const cap = W().map().simulation?.partiesPerRegion;
    const region = cap ? W().regionAt(p.x, p.y)?.id : null;
    if (!region) return false;
    const here = c.parties.filter((o) => !o.contractId && !o.questTag && !o.eventId && !o.lordId && W().regionAt(o.x, o.y)?.id === region).length; // lords ride beside the regular parties (P8-01)
    return here > cap;
  }

  /** Keep each template at its target count once its respawn timer has passed. */
  function ensure(c, ignoreTimers = false) {
    for (const t of Object.values(CL.content.table('party_templates'))) {
      if (t.kind === 'lord') continue; // one a lord, not a count (js/lords.js)
      let active = c.parties.filter((p) => p.template === t.id && !p.contractId && !p.questTag && !p.eventId).length;
      while (active < t.count && (ignoreTimers || now(c) >= (c.partySpawns[t.id] || 0))) {
        const p = spawn(c, t.id);
        active++;
        if (!ignoreTimers) c.partySpawns[t.id] = now(c) + t.respawnDays;
        if (crowded(c, p)) {
          // W-07: the region is full; this one never sets out, and the template tries again later.
          c.parties.splice(c.parties.indexOf(p), 1);
          c.partySpawns[t.id] = now(c) + t.respawnDays;
          CL.diag.log('info', 'Spawn skipped: region full', { template: t.id });
          break;
        }
      }
    }
    CL.lords?.ensure(c, now(c), ignoreTimers); // every free lord rides with their household (P8-01)
    CL.story?.ensureBands(c); // bands the story needs right now (re-spawned if lost)
  }

  /**
   * A band the story needs (data/quests.js stage `band`): fixed troops at a fixed spot, keeping
   * near it. Tagged so quest triggers can recognise it; story.js keeps it alive while needed.
   */
  function spawnQuestBand(c, spec, x, y) {
    const p = spawn(c, spec.template);
    if (spec.troops) p.troops = { ...spec.troops };
    Object.assign(p, { x, y, tx: null, ty: null, anchor: { x, y }, questTag: spec.tag });
    if (spec.camp) p.camp = true;
    CL.diag.log('info', 'Quest band spawned', { tag: spec.tag, troops: p.troops });
    return p;
  }

  // ---- Behaviour ----

  const playerOnMap = (c) => !c.world.location && CL.game.mode === 'map';

  function wantsPlayer(c, p) {
    const t = tpl(p.template);
    const hunting = t.kind === 'lord' && CL.allegiance?.hunted(c, t.faction); // after a defection, its lords ride you down (P8-04)
    if ((!hostileTo(c, t) && !hunting) || !playerOnMap(c) || now(c) < p.ignoreUntil) return false;
    if (!CL.sight.partySees(c, p, now(c))) return false; // P7-04: night, ground, forest, size, Hide
    if (p.questTag) return !p.camp; // a story ambush springs whatever the odds; a camp waits to be found
    if (p.ambush) return dist(p, c.world) <= AMBUSH_RANGE; // lies still on the escort road and springs as you pass
    return A().troopsPower(p.troops) >= CHASE_RATIO * A().playerPower(c);
  }

  /** The parties near (x, y) within `range`: through this step's grid, or all of them. */
  function around(c, x, y, range) {
    return stepGrid && options.grid ? CL.spatial.near(stepGrid, x, y, range) : c.parties;
  }

  /** The nearest party of a kind (or of any of a list of kinds) within range. */
  function nearest(c, p, kind, range) {
    const kinds = Array.isArray(kind) ? kind : [kind];
    let best = null;
    for (const o of around(c, p.x, p.y, range)) {
      // Quest bands are the story's: patrols leave them be and they leave caravans alone.
      if (o === p || o.questTag || o.ambush || o.escortTo || !kinds.includes(tpl(o.template).kind)) continue;
      const d = dist(p, o);
      if (d <= range && (!best || d < best.d)) best = { o, d };
    }
    return best?.o || null;
  }

  /** A rival kingdom's regular patrol or lord in sight, of a kingdom at war or in tension with its own (W-07, P8-01). */
  function rival(c, p, t) {
    let best = null;
    for (const o of around(c, p.x, p.y, t.detection)) {
      const ot = tpl(o.template);
      if (o.questTag || (ot.kind !== 'patrol' && ot.kind !== 'lord') || ot.faction === t.faction || !CL.realm.atOdds(c, t.faction, ot.faction)) continue;
      const d = dist(p, o);
      if (d <= t.detection && (!best || d < best.d)) best = { o, d };
    }
    return best?.o || null;
  }

  const reached = (p) => p.tx === null || W().mapDist(p.x, p.y, p.tx, p.ty) <= ARRIVE;

  /** P7-04: a party chasing the company notes where it saw it (story bands and ambushes don't hunt). */
  function remember(c, p) {
    if (p.questTag || p.ambush || p.anchor) return;
    p.lastSeen = { x: c.world.x, y: c.world.y, until: null };
  }

  /**
   * P7-04: a party that has lost sight of the company rides to where it last saw it, then searches
   * around there for SEARCH.hours, then gives up. Returns true while it is busy with that.
   */
  function lostYou(c, p, t) {
    const s = p.lastSeen;
    if (!s) return false;
    if (p.alerted) {
      p.alerted = false;
      if (playerOnMap(c)) CL.ui.message(`${t.name} have lost sight of you.`);
    }
    if (s.until == null) {
      if (W().mapDist(p.x, p.y, s.x, s.y) > ARRIVE * 3) {
        [p.tx, p.ty] = [s.x, s.y];
        p.chasing = 'search';
        return true;
      }
      s.until = now(c) + SEARCH.hours / 24;
    }
    if (now(c) > s.until) {
      p.lastSeen = null;
      CL.diag.log('info', 'Search given up', { id: p.id, template: p.template });
      return false;
    }
    if (reached(p)) [p.tx, p.ty] = W().clampToMap(s.x + (A().next(c) * 2 - 1) * SEARCH.radius, s.y + (A().next(c) * 2 - 1) * SEARCH.radius, EDGE);
    p.chasing = 'search';
    return true;
  }

  function chooseTarget(c, p) {
    const t = tpl(p.template);
    p.chasing = null;
    if (t.kind === 'detachment') return CL.detachments.chooseTarget(c, p, now(c)); // your own (P7-05)
    if (p.questTag && t.kind !== 'bandit') {
      // A story column (a kingdom's patrol) keeps to its post; the player comes to it.
      if (reached(p)) {
        [p.tx, p.ty] = W().clampToMap(p.anchor.x + (A().next(c) * 2 - 1) * 3, p.anchor.y + (A().next(c) * 2 - 1) * 3, EDGE);
      }
      return;
    }
    if (t.kind === 'lord') return chooseLordTarget(c, p, t);
    if (t.kind === 'patrol' && wantsPlayer(c, p)) {
      // A Hostile kingdom's patrols ride the player down.
      p.chasing = 'player';
      [p.tx, p.ty] = [c.world.x, c.world.y];
      remember(c, p);
      if (!p.alerted) {
        p.alerted = true;
        CL.ui.message(`A ${t.name} is riding for you!`);
      }
      return;
    }
    if (t.kind === 'patrol' && lostYou(c, p, t)) return; // P7-04: searching where they last saw you
    if (p.ambush && !wantsPlayer(c, p)) {
      p.tx = p.ty = null; // waiting in the ditch
      return;
    }
    if (t.kind === 'bandit') {
      if (wantsPlayer(c, p)) {
        p.chasing = 'player';
        [p.tx, p.ty] = [c.world.x, c.world.y];
        remember(c, p);
        if (!p.alerted) {
          p.alerted = true;
          CL.ui.message(`${t.name} have spotted you!`);
        }
        return;
      }
      if (lostYou(c, p, t)) return; // P7-04: searching where they last saw you
      p.alerted = false;
      // Bands keep clear of patrols they can see (quest bands hold their ground).
      const threat = p.questTag || p.ambush ? null : nearest(c, p, ['patrol', 'lord'], t.detection);
      if (threat && A().troopsPower(threat.troops) > A().troopsPower(p.troops)) {
        p.chasing = 'fleeing';
        [p.tx, p.ty] = W().clampToMap(p.x * 2 - threat.x, p.y * 2 - threat.y, EDGE);
        return;
      }
      const prey = p.questTag || p.ambush ? null : nearest(c, p, 'caravan', t.detection);
      if (prey) {
        p.chasing = prey.id;
        [p.tx, p.ty] = [prey.x, prey.y];
        return;
      }
      if (reached(p)) {
        // Contract bands keep close to their camp so the player can find them.
        const lair = W().map().sites[p.lair];
        const [ax, ay] = p.anchor ? [p.anchor.x, p.anchor.y] : [lair.mapX, lair.mapY];
        const roam = p.anchor ? 4 : t.roam;
        [p.tx, p.ty] = W().clampToMap(ax + (A().next(c) * 2 - 1) * roam, ay + (A().next(c) * 2 - 1) * roam, EDGE);
      }
    } else if (t.kind === 'patrol') {
      const quarry = nearest(c, p, 'bandit', t.detection) || (CL.news.clashReady(c, now(c)) ? rival(c, p, t) : null);
      if (quarry) {
        p.chasing = quarry.id;
        [p.tx, p.ty] = [quarry.x, quarry.y];
        return;
      }
      if (reached(p)) {
        p.alerted = false;
        const f = t.frontier;
        if (f && A().next(c) < f.chance) {
          // The border beat, where rival patrols meet (GDD §12 frontier clashes).
          [p.tx, p.ty] = W().clampToMap(f.x + (A().next(c) * 2 - 1) * f.jitter, f.y + (A().next(c) * 2 - 1) * f.jitter, EDGE);
        } else {
          const s = pick(c, CL.realm.holdings(c, t.faction));
          [p.tx, p.ty] = [s.mapX, s.mapY];
        }
      }
    } else if (p.escortTo) {
      // An escorted caravan rolls toward its destination only while the player rides with it.
      const s = settlement(p.escortTo);
      const range = CL.content.get('contracts', 'escort').escortRange;
      if (dist(p, c.world) <= range) [p.tx, p.ty] = [s.mapX, s.mapY];
      else p.tx = p.ty = null;
      if (W().mapDist(p.x, p.y, s.mapX, s.mapY) <= ARRIVE) CL.contracts.onCaravanArrived(c, p);
    } else {
      const s = settlement(t.route[(p.routeIndex + 1) % t.route.length]);
      [p.tx, p.ty] = [s.mapX, s.mapY];
      if (reached(p)) caravanArrives(c, p);
    }
  }

  /**
   * A lord's intention (P8-01): ride down a company their realm counts Hostile; search where they lost
   * it; go home to refill when the ranks are thin, and rest there; hunt Reavers in sight; ride against
   * soldiers of a realm at odds with theirs; else ride the bounds of their lands (landed), or campaign
   * along the realm's borders or with a kinsman (landless, or with nothing of their own to guard).
   */
  function chooseLordTarget(c, p, t) {
    const L = CL.lords;
    const person = c.people?.[p.lordId];
    if (!person) return;
    // P8-06a: a lord in a siege rides to the camp (gathering, besieging) or to the fort (relief).
    if (p.siegeId) {
      const post = CL.sieges?.postFor(c, p);
      if (post) {
        [p.tx, p.ty] = W().clampToMap(post[0], post[1], EDGE);
        return;
      }
      p.siegeId = null;
      p.intent = 'home';
    }
    // P8-07: a lord who agreed to ride with you keeps beside you for their days.
    if (CL.nobles?.ridesWith(c, p.lordId)) {
      p.intent = 'escort';
      [p.tx, p.ty] = W().clampToMap(c.world.x + 2, c.world.y + 2, EDGE);
      return;
    }
    if (wantsPlayer(c, p)) {
      p.chasing = 'player';
      p.intent = 'chase';
      [p.tx, p.ty] = [c.world.x, c.world.y];
      remember(c, p);
      if (!p.alerted) {
        p.alerted = true;
        CL.ui.message(`${CL.realm.titled(p.lordId, c)} is riding for you!`);
      }
      return;
    }
    if (lostYou(c, p, t)) {
      p.intent = 'search';
      return;
    }
    p.alerted = false;
    const home = settlement(L.homeOf(c, p.lordId));
    const atHome = W().mapDist(p.x, p.y, home.mapX, home.mapY) <= ARRIVE * 3;
    if (L.thin(c, p) || p.intent === 'home') {
      if (!atHome) {
        p.intent = 'home';
        [p.tx, p.ty] = [home.mapX, home.mapY];
        return;
      }
      L.refill(c, p);
      p.intent = 'rest';
      p.restUntil = now(c) + 0.5;
      p.tx = p.ty = null;
      return;
    }
    if (p.intent === 'rest' && atHome && now(c) < (p.restUntil || 0)) {
      p.tx = p.ty = null;
      return;
    }
    // P8-07: their needs lean it: short of men they avoid fights; fearing for their lands they leave
    // other realms' soldiers be; after glory or spoils they look further for a fight.
    const lean = CL.nobles?.leaning(c, p.lordId) || { avoid: false, stay: false, seek: 1 };
    const quarry = lean.avoid ? null : nearest(c, p, 'bandit', t.detection * lean.seek) || (!lean.stay && CL.news.clashReady(c, now(c)) ? rival(c, p, t) : null);
    if (quarry) {
      p.chasing = quarry.id;
      p.intent = tpl(quarry.template).kind === 'bandit' ? 'hunt' : 'clash';
      [p.tx, p.ty] = [quarry.x, quarry.y];
      return;
    }
    if (!reached(p) && (p.intent === 'patrol' || p.intent === 'campaign' || p.intent === 'ride')) {
      if (p.intent === 'ride') {
        const kin = L.partyOf(c, p.kin);
        if (kin) [p.tx, p.ty] = [kin.x, kin.y];
      }
      return;
    }
    // Something new to do.
    const own = CL.realm.fiefsOf(p.lordId, c).filter((sid) => CL.realm.owner(sid, c) === person.realm);
    if (own.length) {
      p.intent = 'patrol';
      const s = settlement(pick(c, own));
      [p.tx, p.ty] = W().clampToMap(s.mapX + (A().next(c) * 2 - 1) * 3, s.mapY + (A().next(c) * 2 - 1) * 3, EDGE);
      return;
    }
    const kin = person.kin.map((k) => L.partyOf(c, k.person)).find((q) => q && q.intent !== 'home' && q.intent !== 'rest');
    if (kin && A().next(c) < 0.4) {
      p.intent = 'ride';
      p.kin = kin.lordId;
      [p.tx, p.ty] = [kin.x, kin.y];
      return;
    }
    p.intent = 'campaign';
    p.kin = null;
    const lands = CL.realm.controlled(c, person.realm);
    // The realm's borders: its places nearest another realm's.
    const others = Object.values(CL.content.table('settlements')).filter((s) => CL.realm.isRealm(CL.realm.owner(s.id, c)) && CL.realm.owner(s.id, c) !== person.realm);
    const edge = (s) => Math.min(...others.map((o) => W().mapDist(s.mapX, s.mapY, o.mapX, o.mapY)));
    const border = others.length ? [...lands].sort((a, b) => edge(a) - edge(b)).slice(0, 3) : lands;
    const s = pick(c, border.length ? border : [home]);
    [p.tx, p.ty] = W().clampToMap(s.mapX + (A().next(c) * 2 - 1) * 5, s.mapY + (A().next(c) * 2 - 1) * 5, EDGE);
  }

  /** GDD §9: caravan deliveries lower scarcity of the good they carry at the destination. */
  function caravanArrives(c, p) {
    const t = tpl(p.template);
    p.routeIndex = (p.routeIndex + 1) % t.route.length;
    const sid = t.route[p.routeIndex];
    if (c.markets[sid]) {
      c.markets[sid][p.good] = clamp(c.markets[sid][p.good] - CARAVAN_EFFECT, CL.trade.SCARCITY.min, CL.trade.SCARCITY.max);
    }
    CL.diag.log('info', 'Caravan arrived', { at: sid, good: p.good });
    CL.news.record(c, 'caravan_arrived', { dest: sid, good: p.good, faction: t.faction }, now(c));
    p.good = pick(c, t.goods);
    p.tx = null;
  }

  /**
   * Swept contact distance (W-07): the closest two parties came during this step, each moving in a
   * straight line from where it started the step to where it is now (gameplay distance).
   */
  function sweptDist(a, b) {
    const [ax, ay] = moved.get(a) || [a.x, a.y];
    const [bx, by] = moved.get(b) || [b.x, b.y];
    const k = W().map().aspect ?? 1;
    const rx = ax - bx;
    const ry = (ay - by) * k;
    const dx = a.x - ax - (b.x - bx);
    const dy = (a.y - ay - (b.y - by)) * k;
    const dd = dx * dx + dy * dy;
    const t = dd > 0 ? clamp(-(rx * dx + ry * dy) / dd, 0, 1) : 0;
    return Math.hypot(rx + t * dx, ry + t * dy);
  }

  /** How far parties may have moved this step, for the contact search's reach. */
  function reach() {
    let m = 0;
    for (const [p, [x, y]] of moved) m = Math.max(m, W().mapDist(x, y, p.x, p.y));
    return CONTACT + 2 * m;
  }

  function move(p, hours) {
    if (p.tx === null) return;
    const t = tpl(p.template);
    const m = W().map();
    const speed = t.speed * m.terrain[W().terrainAt(p.x, p.y)];
    const d = W().mapDist(p.x, p.y, p.tx, p.ty);
    const step = speed * hours;
    if (step >= d) [p.x, p.y] = [p.tx, p.ty];
    else {
      p.x += ((p.tx - p.x) * step) / d;
      p.y += ((p.ty - p.y) * step) / d;
    }
  }

  /** Bandits vs caravans and patrols vs bandits fight it out off-screen. */
  function resolveContacts(c) {
    const all = [...c.parties];
    const grid = options.grid ? CL.spatial.build(all) : null;
    const r0 = reach();
    for (const a of all) {
      if (!c.parties.includes(a) || a.questTag || a.ambush || tpl(a.template).kind !== 'bandit' || CL.reinforce?.locked(a)) continue;
      for (const b of grid ? CL.spatial.near(grid, a.x, a.y, r0) : all) {
        const kb = tpl(b.template).kind;
        if (b === a || b.questTag || b.escortTo || !c.parties.includes(b) || (kb !== 'caravan' && kb !== 'patrol' && kb !== 'detachment' && kb !== 'lord') || CL.reinforce?.locked(b)) continue;
        if (sweptDist(a, b) > CONTACT) continue;
        if (kb === 'detachment') {
          // One of your detachments meets a band (P7-05): its own fight, its soldiers' fates recorded once.
          if (CL.detachments.fight(c, b, a, now(c)) === a || !c.parties.includes(a)) break;
          continue;
        }
        const r = A().resolveParties(c, a, b);
        const lt = tpl(r.loser.template);
        if (lt.kind === 'caravan') {
          // GDD §9: bandit losses make the caravan's goods scarcer where it was heading.
          const sid = lt.route[(r.loser.routeIndex + 1) % lt.route.length];
          if (c.markets[sid]) {
            c.markets[sid][r.loser.good] = clamp(c.markets[sid][r.loser.good] + CARAVAN_EFFECT, CL.trade.SCARCITY.min, CL.trade.SCARCITY.max);
          }
          CL.news.record(c, 'caravan_lost', { x: r.loser.x, y: r.loser.y, dest: sid, good: r.loser.good, faction: lt.faction }, now(c));
        } else if (lt.kind === 'patrol') {
          CL.news.record(c, 'patrol_beaten', { x: r.loser.x, y: r.loser.y, faction: lt.faction }, now(c));
        } else if (lt.kind === 'lord') {
          // Reavers broke a lord's household (P8-01): the lord gets away and rides out again from home.
          CL.lords.beaten(c, r.loser, null, now(c));
          if (!troopCount(r.winner)) remove(c, r.winner);
          if (r.loser === a || r.winner === a) break;
          continue;
        } else {
          CL.news.record(c, 'reavers_broken', { x: r.loser.x, y: r.loser.y, faction: tpl(r.winner.template).faction }, now(c));
        }
        CL.diag.log('info', 'Off-screen battle', { winner: r.winner.template, loser: r.loser.template, losses: r.winnerLosses });
        if (r.loser.contractId) CL.contracts.onTargetLost(c, r.loser);
        remove(c, r.loser);
        // A pyrrhic win: if the winner lost its last troops too, it is gone as well.
        if (!troopCount(r.winner) && r.winner.lordId) {
          CL.lords.beaten(c, r.winner, null, now(c)); // a lord left with nobody rides home (P8-01)
          if (r.winner === a) break;
        } else if (!troopCount(r.winner)) {
          if (r.winner.contractId) CL.contracts.onTargetLost(c, r.winner);
          remove(c, r.winner);
          if (r.winner === a) break;
        }
        if (r.loser === a) break;
      }
    }
    frontierClash(c);
  }

  /** Two patrols of kingdoms at peace that touch: no fight, but perhaps a border incident (W-07). */
  function borderIncidents(c, patrols, grid, r0) {
    for (const a of patrols) {
      const fa = tpl(a.template).faction;
      for (const b of grid ? CL.spatial.near(grid, a.x, a.y, r0) : patrols) {
        const fb = tpl(b.template).faction;
        if (!patrols.includes(b) || fa >= fb || CL.realm.relation(c, fa, fb) !== 'peace' || sweptDist(a, b) > CONTACT) continue;
        CL.realm.incident(c, fa, fb, { x: b.x, y: b.y }, now(c));
      }
    }
  }

  /**
   * GDD §12 "recurring small frontier clashes": rival kingdoms' patrols that meet skirmish, at
   * most once every few days: a few men fall and the loser limps home, so no road is stripped bare.
   * Story columns keep out.
   */
  function frontierClash(c) {
    // Patrols and lords (P8-01) alike.
    const patrols = c.parties.filter((p) => !p.questTag && (tpl(p.template).kind === 'patrol' || tpl(p.template).kind === 'lord') && !CL.reinforce?.locked(p));
    const grid = options.grid ? CL.spatial.build(patrols) : null;
    const r0 = reach();
    borderIncidents(c, patrols, grid, r0);
    if (!CL.news.clashReady(c, now(c))) return;
    for (const a of patrols) {
      for (const b of grid ? CL.spatial.near(grid, a.x, a.y, r0) : patrols) {
        const [fa, fb] = [tpl(a.template).faction, tpl(b.template).faction];
        if (fa >= fb || !CL.realm.atOdds(c, fa, fb) || sweptDist(a, b) > CONTACT) continue;
        // A skirmish, not a war: the loser loses a man or two and falls back home, the winner at
        // most one, so the border fights never strip either kingdom's roads of patrols.
        const aWins = A().next(c) < A().winChance(A().troopsPower(a.troops), A().troopsPower(b.troops));
        const [winner, loser] = aWins ? [a, b] : [b, a];
        const lost = A().expand(loser.troops).slice(0, SKIRMISH_LOSS.loser[A().int(c, 0, 1)]);
        const won = A().next(c) < SKIRMISH_LOSS.winnerChance ? A().expand(winner.troops).slice(0, 1) : [];
        A().removeTroops(loser.troops, lost);
        A().removeTroops(winner.troops, won);
        const [fw, fl] = [tpl(winner.template).faction, tpl(loser.template).faction];
        CL.news.record(c, 'frontier_clash', { x: loser.x, y: loser.y, winner: fw, loser: fl }, now(c));
        CL.news.clashed(c, now(c));
        CL.realm.clashed(c, fw, fl, won.length + lost.length, { x: loser.x, y: loser.y }, now(c));
        CL.diag.log('info', 'Frontier clash', { winner: winner.template, loser: loser.template, losses: [won.length, lost.length] });
        // A lord's household broken in the skirmish: the lord is the other realm's prisoner (P8-01).
        for (const p of [winner, loser]) if (!troopCount(p)) p.lordId ? CL.lords.beaten(c, p, p === loser ? fw : fl, now(c)) : remove(c, p);
        if (c.parties.includes(loser)) {
          if (loser.lordId) loser.intent = 'home';
          const home = settlement(loser.lordId ? CL.lords.homeOf(c, loser.lordId) : tpl(loser.template).home);
          [loser.tx, loser.ty] = [home.mapX, home.mapY];
        }
        return;
      }
    }
  }

  /**
   * Advance the world parties by `hours`. Returns the id of a band that has caught the player
   * (also stored in CL.game.contactParty), or null.
   */
  function tick(c, hours) {
    if (!c.parties || hours <= 0) return null;
    const steps = Math.ceil(hours / STEP_HOURS);
    const h = hours / steps;
    const start = c.day - hours / 24; // advanceDays has already moved the clock to the end
    try {
      return runSteps(c, steps, h, start);
    } finally {
      simDay = null;
    }
  }

  /**
   * How long a party acts for this step (W-07): the whole step near the player or on business of the
   * player's (a quest, a contract, an escort, a chase), else nothing until its saved-up time reaches
   * an hour, then all of it at once.
   */
  function hoursFor(c, p, h) {
    if (p.questTag || p.contractId || p.escortTo || p.ambush || p.chasing || dist(p, c.world) <= NEAR_PLAYER) {
      banked.delete(p);
      return h;
    }
    const t = (banked.get(p) || 0) + h;
    if (t + 1e-9 < COARSE_HOURS) {
      banked.set(p, t);
      return 0;
    }
    banked.delete(p);
    return t;
  }

  function runSteps(c, steps, h, start) {
    try {
      for (let i = 0; i < steps; i++) {
        simDay = start + ((i + 1) * h) / 24;
        ensure(c);
        // Everyone chooses from where things stand, then everyone moves (W-07).
        const acting = [];
        for (const p of c.parties) {
          if (CL.reinforce?.locked(p)) continue; // in the battle being committed: it waits (V2-09, §9.5)
          const hours = hoursFor(c, p, h);
          if (hours > 0) acting.push([p, hours]);
        }
        stepGrid = options.grid ? CL.spatial.build(c.parties) : null;
        for (const [p] of acting) chooseTarget(c, p);
        stepGrid = null;
        moved = new Map();
        for (const [p, hours] of acting) {
          moved.set(p, [p.x, p.y]);
          move(p, hours);
        }
        resolveContacts(c);
        CL.detachments.step(c); // returning detachments that reach the company rejoin it (P7-05)
        CL.sight.look(c, simDay); // what the company sees now (P7-04)
        if (playerOnMap(c)) CL.scout?.warn(c, simDay); // and what the scout says about it (P7-02)
        for (const p of c.parties) {
          if (CL.reinforce?.locked(p)) continue;
          if (wantsPlayer(c, p) && sweptToPlayer(c, p) <= CONTACT) {
            CL.game.contactParty = p.id;
            return p.id;
          }
        }
      }
      return null;
    } finally {
      stepGrid = null;
      moved = new Map();
    }
  }

  /** The closest a party came to the (standing) player during the step. */
  function sweptToPlayer(c, p) {
    const w = c.world;
    return sweptDist(p, { x: w.x, y: w.y });
  }

  // ---- Encounters with the player (bands and lair sites share one flow) ----

  /** The open encounter: { kind: 'site'|'party', name, text, troops, hostile, def, party? }. */
  function current(c = CL.campaign) {
    const g = CL.game;
    if (g.partyId != null) {
      const p = find(c, g.partyId);
      if (!p) return null;
      const t = tpl(p.template);
      const hostile = hostileTo(c, t);
      const spec = p.questTag ? CL.story.bandSpec(p.questTag, c) : null;
      const map = spec?.map || W().battleMapAt(c.world.x, c.world.y); // a story battle may name its field
      const ambushText = p.ambush ? 'Reavers burst from cover and go for the caravan you are escorting. Keep them off the wagon: if it burns, or you lose, the caravan is lost.' : null;
      const lord = p.lordId && c.people?.[p.lordId] ? CL.lords.describe(c, p) : null; // P8-01: who, and what they're doing
      const words = (hostile && t.hostileText ? t.hostileText : t.text).replace('{lord}', lord ? CL.realm.titled(p.lordId, c) : t.name);
      const text = spec?.text || ambushText || (lord ? `${lord.who}, ${lord.doing}. ${words}` : words);
      const def = battleDef(t, p.troops, map, { share: !p.questTag }); // a story band keeps its waves (P9-B2)
      if (p.ambush) def.objective = 'wagon'; // protect the escort's wagon (P7-11, js/objective.js)
      if (lord) {
        def.name = CL.realm.titled(p.lordId, c);
        def.leader = CL.lords.leaderFor(c, p); // the lord fights in person
      }
      return { kind: 'party', name: spec?.name || (lord ? CL.realm.titled(p.lordId, c) : t.name), text, troops: p.troops, hostile, def, party: p, t, lord };
    }
    if (g.siteId) {
      const st = W().map().sites[g.siteId];
      const enc = CL.content.encounter(st.encounter);
      const troops = {};
      for (const w of enc.waves) for (const [id, n] of Object.entries(w)) troops[id] = (troops[id] || 0) + n;
      return { kind: 'site', name: st.name, text: st.text, troops, hostile: true, def: enc };
    }
    return null;
  }

  /**
   * A battle definition for a party on the map: its actual troops on the local map. From 3.2.0 (P9-B2,
   * D-P9c) it is one army (`share`): the two sides share the field by their numbers and both feed in
   * reserves as men fall. `share: false` (a story band) keeps the waves of up to 8 it always had.
   * @param {any} t @param {Record<string, number>} troops @param {string} [map] @param {{ share?: boolean }} [opts]
   */
  function battleDef(t, troops, map = 'open_country', { share = true } = {}) {
    const list = A().expand(troops);
    const waves = [];
    if (share) waves.push(A().collapse(list));
    else for (let i = 0; i < list.length; i += WAVE_SIZE) waves.push(A().collapse(list.slice(i, i + WAVE_SIZE)));
    const loot = t.lootBySize?.find(([max]) => list.length <= max)?.[1] || 'low';
    return { id: `party_${t.id}`, name: t.name, map, waves, reward: t.reward, loot, ...(share ? { share: true } : {}) };
  }

  /** Open the encounter with a band. `caught`: it came at you (an ambush: a small deployment zone, V2-07). */
  function open(partyId, { caught = false } = {}) {
    const g = CL.game;
    g.partyId = partyId;
    g.siteId = null;
    g.caught = caught;
    g.travel = null;
    CL.encounter.begin(); // whatever the player chooses commits under this result ID
    CL.ui.changeMode('encounter');
  }

  function negotiation(c, e) {
    if (e.kind !== 'party' || !e.hostile || !e.t.toll) return null; // only Reavers take tolls
    if (A().playerPower(c) >= INTIMIDATE_RATIO * A().troopsPower(e.troops)) return { kind: 'intimidate' };
    return { kind: 'toll', cost: e.t.toll.base + e.t.toll.perTroop * troopCount(e.party) };
  }

  /** GDD §8: clamp(0.5 + 0.1 × (SpeedPlayer − SpeedEnemy), 0.15, 0.85). */
  function retreatChance(c, e) {
    if (e.kind !== 'party') return null;
    const w = c.world;
    const enemy = e.t.speed * W().map().terrain[W().terrainAt(e.party.x, e.party.y)];
    return clamp(0.5 + 0.1 * (W().speedAt(w.x, w.y) - enemy), 0.15, 0.85);
  }

  function leaveAlone(e, days) {
    e.party.ignoreUntil = CL.campaign.day + days;
    e.party.alerted = false;
  }

  function negotiate() {
    const c = CL.campaign;
    const e = current(c);
    const n = e && CL.encounter.isOpen(c) && negotiation(c, e);
    if (!n) return false;
    if (n.kind === 'toll' && c.gold < n.cost) return false;
    const done = CL.encounter.resolve(c, {
      kind: 'parley',
      detail: n.kind,
      commit: () => {
        if (n.kind === 'intimidate') {
          leaveAlone(e, IGNORE_AFTER.intimidate);
          // Send them scurrying away from the player.
          [e.party.tx, e.party.ty] = W().clampToMap(e.party.x * 2 - c.world.x, e.party.y * 2 - c.world.y, EDGE);
        } else {
          CL.accounts.spend(c, n.cost, `toll to the ${e.name}`);
          leaveAlone(e, IGNORE_AFTER.toll);
          CL.retinue?.onEvent(c, 'toll_paid'); // some companions mind this (P7-06)
        }
      },
    });
    if (!done) return false; // already settled (a double tap)
    CL.ui.changeMode('map');
    CL.ui.message(n.kind === 'intimidate' ? `The ${e.name} take one look at your company and melt away.` : `You pay ${n.cost} crowns. The ${e.name} let you pass.`);
    CL.diag.log('info', 'Negotiated', { party: e.party.id, outcome: n.kind, cost: n.cost || 0 });
    CL.story.emit('parley', { party: e.party.template, tag: e.party.questTag || null, outcome: n.kind }, c);
    return true;
  }

  function retreat() {
    const c = CL.campaign;
    const e = current(c);
    if (e?.kind !== 'party' || !CL.encounter.isOpen(c)) return false;
    const chance = retreatChance(c, e);
    const ok = A().next(c) < chance;
    CL.diag.log('info', 'Retreat', { party: e.party.id, chance, ok });
    if (ok) {
      CL.encounter.resolve(c, { kind: 'retreat', commit: () => leaveAlone(e, IGNORE_AFTER.retreat) });
      CL.ui.changeMode('map');
      CL.ui.message('You slip away before they can close in.');
    } else {
      CL.ui.message('They cut off your escape — you must fight!');
      attack();
    }
    return ok;
  }

  /** Attacking a kingdom's patrol or caravan that wasn't after you: GDD §10 −15 reputation; a lord, −25 (P8-01). */
  const LORD_ATTACK = -25;
  function assaultPenalty(c, e) {
    if (e.kind !== 'party' || e.hostile || !e.t.faction || e.t.kind === 'bandit') return;
    CL.realm.adjust(c, e.t.faction, e.t.kind === 'lord' ? LORD_ATTACK : CL.realm.REP.attack, `attacked ${e.t.id}`);
    CL.allegiance?.onAttack(c, e.t.faction); // attacking those you serve breaks the contract or oath (P8-04)
  }

  /** Fight the open encounter. `plan`: the setup chosen on the preparation screen (V2-07), if any. */
  function attack(plan = null) {
    const e = current();
    if (!e) return;
    assaultPenalty(CL.campaign, e);
    CL.combat.startBattle(e.def, { plan });
  }

  /** GDD §7 auto-resolve for the player's encounter, applied through the normal result path. */
  function autoResolve() {
    const c = CL.campaign;
    const g = CL.game;
    const e = current(c);
    if (!e || !CL.encounter.isOpen(c)) return null; // nothing to fight, or already settled (a double tap)
    assaultPenalty(c, e);
    // Nearby parties that would ride in count here too (V2-09): the same ones a fought battle gets.
    const help = CL.reinforce.forAuto(c, e);
    const pp = A().playerPower(c) + help.allyPower;
    const pe = A().troopsPower(e.troops) + help.enemyPower;
    const reasons = A().explain(c, e.troops); // before anyone falls (V2-07)
    if (help.list.length) reasons.splice(-1, 1, ...help.lines, `Odds ${Math.round(A().winChance(pp, pe) * 100)}% with them: your side ${pp.toFixed(1)} against ${pe.toFixed(1)}, kept between 10% and 90%.`);
    const win = A().next(c) < A().winChance(pp, pe);
    const healthy = CL.party.healthySoldiers().map((s) => s.id);
    const enemyList = A().expand(e.troops);
    const traitFall = (id) => CL.traits.fall(c.roster.find((s) => s.id === id)); // traits (P7-07)
    const fallen = win
      ? A().rollFallen(c, healthy, A().lossChance(A().WINNER_LOSS, pp, pe), true, traitFall)
      : A().rollFallen(c, healthy, A().lossChance(A().LOSER_LOSS, pp, pe), false, traitFall);
    const enemyFallen = win ? enemyList : A().rollFallen(c, enemyList, A().lossChance(A().WINNER_LOSS, pe, pp), true);
    // The surgeon's triage (P7-01), one roll each from the world stream as before.
    const { killed, wounded, saved, medicineUsed } = CL.surgeon.triage(
      c,
      fallen.map((id) => ({ id, roll: A().next(c) })),
    );
    // Those who rode in lose men by the same rule as the side they fought on.
    const joined = help.list.map((j) => {
      const list = A().expand(j.troops);
      const ownWin = j.side === 'ally' ? win : !win;
      const [own, other] = j.side === 'ally' ? [pp, pe] : [pe, pp];
      const lost = j.side === 'enemy' && win ? list : A().rollFallen(c, list, A().lossChance(ownWin ? A().WINNER_LOSS : A().LOSER_LOSS, own, other), false);
      return { id: j.id, side: j.side, arrived: true, fallen: lost };
    });
    const kills = enemyFallen.length + joined.filter((j) => j.side === 'enemy').reduce((n, j) => n + j.fallen.length, 0);
    g.battleId = c.battles + 1;
    const outcome = { battleId: g.battleId, encounter: e.def, win, kills, killed, wounded, saved, medicineUsed, participants: healthy, reinforced: help.list.some((j) => j.side === 'ally') };
    const names = CL.party.rosterNames(c); // before the fallen leave the roster
    // The one commit path (V2-02): result, companion, map, band, events and the save, exactly once.
    CL.reinforce.lock(g, [e.party?.id, ...joined.map((j) => j.id)]); // they wait while the hours pass (§9.5)
    let r;
    try {
      // An escort ambush lost is the caravan lost too (P7-11): the wagon has nobody to stand by it.
      r = /** @type {BattleResult | null} */ (CL.encounter.resolve(c, { kind: 'auto', outcome, fallenEnemies: enemyFallen, enemyTroops: Object.keys(e.troops), reinforcements: joined, wagonLost: e.def.objective === 'wagon' && !win }));
    } finally {
      g.lock = null;
    }
    if (!r) return null; // already applied (a double tap)
    g.result = {
      win,
      auto: true, // drawn over the world map, not a battlefield
      ...r,
      html: CL.party.resultHtml({ win, r, kills, killed, wounded, saved, medicineUsed, survivors: healthy.length - fallen.length, auto: { pp, pe, reasons }, names, wagon: e.def.objective === 'wagon' ? (win ? 'saved' : 'lost') : null }),
    };
    CL.diag.log('info', 'Auto-resolved', { ...outcome, encounter: e.def.id, pp, pe });
    CL.ui.changeMode('result');
    return g.result;
  }

  /** After a battle with a band: a win destroys it; a loss leaves it weakened but alive. */
  function onBattleResolved(win, partyId, fallenEnemyTroops, { wagonLost = false } = {}) {
    const c = CL.campaign;
    const p = partyId != null ? find(c, partyId) : null;
    // An escort ambush (P7-11): the wagon burned, or the fight was lost, and the caravan with it.
    if (p?.ambush && (wagonLost || !win)) CL.contracts.onCaravanLost(c, p);
    // GDD §10: beating Road Reavers helps whoever holds the land.
    if (win && (CL.game.siteId || (p && tpl(p.template).kind === 'bandit'))) {
      CL.realm.onBanditsBeaten(c);
      CL.news.record(c, 'player_deed', { x: c.world.x, y: c.world.y });
    }
    if (!p || !c.parties.includes(p)) return; // gone with the failed contract
    if (p.lordId) {
      // P8-01: a lord beaten by the player is their prisoner; a lord who wins keeps the field, thinner.
      const name = CL.realm.titled(p.lordId, c);
      if (win) {
        p.fallen = (fallenEnemyTroops || []).length;
        CL.news.record(c, 'lord_beaten', { x: c.world.x, y: c.world.y, text: `${name}’s household was broken in the field by ${c.character?.name || 'a free company'}.` });
        CL.lords.beaten(c, p, 'player');
        CL.ui.message(`${name} yields and is your prisoner. Their kin will send word of a ransom.`);
        return;
      }
      A().removeTroops(p.troops, fallenEnemyTroops);
      if (!troopCount(p)) CL.lords.beaten(c, p, null); // both sides broken: the lord gets away home
      else p.ignoreUntil = c.day + IGNORE_AFTER.capture;
      return;
    }
    if (win && p.contractId) CL.contracts.onTargetDefeated(c, p);
    if (win && p.eventId) CL.happenings.onBandBeaten(c, p); // a village's bounty (P7-08)
    if (win) remove(c, p);
    else {
      A().removeTroops(p.troops, fallenEnemyTroops);
      if (!troopCount(p)) {
        // A pyrrhic loss: the player was beaten but took the whole band down with them.
        if (p.contractId) CL.contracts.onTargetDefeated(c, p);
        if (p.eventId) CL.happenings.onBandBeaten(c, p);
        remove(c, p);
      } else p.ignoreUntil = c.day + IGNORE_AFTER.capture;
    }
  }

  // ---- Save ----

  function sanitize(s, d) {
    s.rngSeed = Number.isInteger(d?.rngSeed) && d.rngSeed >= 0 ? d.rngSeed >>> 0 : A().newSeed();
    s.parties = [];
    s.partySpawns = {};
    s.nextPartyId = 1;
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    for (const p of Array.isArray(d?.parties) ? d.parties : []) {
      const t = CL.content.table('party_templates')[p?.template];
      if (!t || !Number.isInteger(p.id) || !num(p.x) || !num(p.y)) continue;
      const troops = {};
      for (const [id, n] of Object.entries(p.troops || {})) {
        if (CL.content.table('troops')[id] && Number.isInteger(n) && n > 0) troops[id] = Math.min(n, 99);
      }
      if (!Object.keys(troops).length) continue;
      const q = {
        id: p.id,
        template: t.id,
        x: W().clampToMap(p.x, p.y)[0],
        y: W().clampToMap(p.x, p.y)[1],
        troops,
        tx: num(p.tx) && num(p.ty) ? W().clampToMap(p.tx, p.ty)[0] : null,
        ty: num(p.tx) && num(p.ty) ? W().clampToMap(p.tx, p.ty)[1] : null,
        ignoreUntil: num(p.ignoreUntil) ? p.ignoreUntil : 0,
        alerted: false,
      };
      if (t.kind === 'bandit') q.lair = t.lairs.includes(p.lair) ? p.lair : t.lairs[0];
      if (Number.isInteger(p.contractId)) q.contractId = p.contractId;
      if (Number.isInteger(p.eventId)) q.eventId = p.eventId; // a world event's band (P7-08): checked against its event later
      if (typeof p.questTag === 'string' && /^[a-z0-9_]{1,40}$/.test(p.questTag)) q.questTag = p.questTag;
      if (q.questTag && p.camp === true) q.camp = true;
      if (p.ambush === true) q.ambush = true;
      if (t.kind === 'caravan' && CL.content.table('settlements')[p.escortTo]) q.escortTo = p.escortTo;
      if (t.kind === 'detachment') {
        if (!Number.isInteger(p.detachment)) continue; // a detachment party without its detachment
        q.detachment = p.detachment;
      }
      if (t.kind === 'lord') {
        // P8-01: a free lord of this template's realm, riding once, never a ruler.
        const who = s.people?.[p.lordId];
        if (!who || who.realm !== t.faction || who.status !== 'free' || CL.realm.rules(p.lordId, s) || s.parties.some((o) => o.lordId === p.lordId)) continue;
        q.lordId = p.lordId;
        q.intent = Object.hasOwn(CL.lords.WORDS, p.intent) || p.intent === 'ride' ? p.intent : 'campaign';
        if (q.intent === 'ride' && s.people[p.kin]) q.kin = p.kin;
        else if (q.intent === 'ride') q.intent = 'campaign';
        if (num(p.restUntil)) q.restUntil = p.restUntil;
      }
      // P7-04: where it last saw the company (and until when it searches there), and where the
      // company last saw it.
      if (num(p.lastSeen?.x) && num(p.lastSeen?.y)) {
        const [lx, ly] = W().clampToMap(p.lastSeen.x, p.lastSeen.y);
        q.lastSeen = { x: lx, y: ly, until: num(p.lastSeen.until) ? p.lastSeen.until : null };
      }
      if (num(p.seenAt?.x) && num(p.seenAt?.y) && num(p.seenAt?.day)) {
        const [sx, sy] = W().clampToMap(p.seenAt.x, p.seenAt.y);
        q.seenAt = { x: sx, y: sy, day: p.seenAt.day };
      }
      if (num(p.anchor?.x) && num(p.anchor?.y)) {
        const [ax, ay] = W().clampToMap(p.anchor.x, p.anchor.y);
        q.anchor = { x: ax, y: ay };
      }
      if (t.kind === 'caravan') {
        q.routeIndex = Number.isInteger(p.routeIndex) ? clamp(p.routeIndex, 0, t.route.length - 1) : 0;
        q.good = t.goods.includes(p.good) ? p.good : t.goods[0];
      }
      if (q.tx === null || q.ty === null) [q.tx, q.ty] = [null, null];
      s.parties.push(q);
      s.nextPartyId = Math.max(s.nextPartyId, q.id + 1);
    }
    for (const [tid, day] of Object.entries(d?.partySpawns || {})) {
      if (CL.content.table('party_templates')[tid] && num(day)) s.partySpawns[tid] = day;
    }
    if (!Array.isArray(d?.parties)) ensure(s, true); // older saves: populate the world
    else CL.lords?.ensure(s, s.day); // the lords ride (P8-01: a v19 save had none on the map)
  }

  CL.parties = {
    CONTACT,
    SEARCH,
    NEAR_PLAYER,
    COARSE_HOURS,
    options,
    CHASE_RATIO,
    INTIMIDATE_RATIO,
    CARAVAN_EFFECT,
    spawn,
    spawnQuestBand,
    remove,
    ensure,
    find,
    troopCount,
    hostileTo,
    wantsPlayer,
    tick,
    current,
    battleDef,
    open,
    negotiation,
    retreatChance,
    negotiate,
    retreat,
    attack,
    autoResolve,
    onBattleResolved,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
