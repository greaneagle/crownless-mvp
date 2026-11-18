/* Crownless world parties (GDD §8): patrols, caravans and Road Reaver bands moving on the map,
 * off-screen fights between them, caravans shifting market prices, and the player's encounter
 * choices — Attack, Auto-resolve, Negotiate, Retreat — for both bands and lair sites.
 * State: CL.campaign.parties (saved). Time advances through CL.party.advanceDays → tick(). */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const A = () => CL.autoresolve;

  const STEP_HOURS = 0.25;
  const CONTACT = 1.6; // map units: parties this close meet
  const ARRIVE = 0.3;
  const CHASE_RATIO = 0.5; // bandits only hunt a player at least this weak relative to them
  const INTIMIDATE_RATIO = 2.5; // a player this much stronger scares bandits off
  const IGNORE_AFTER = { retreat: 0.25, toll: 1, intimidate: 1, capture: 1 }; // days
  const CARAVAN_EFFECT = 0.08; // scarcity change at the destination (GDD: ±0.05–0.1)
  const WAVE_SIZE = 8;
  const AMBUSH_RANGE = 3.5; // map units: a contract ambush springs only on travellers passing close
  const SKIRMISH_LOSS = { loser: [1, 2], winnerChance: 0.5 }; // frontier clashes: men lost

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
    const p = { id: c.nextPartyId++, template: t.id, x: 50, y: 50, troops, tx: null, ty: null, ignoreUntil: 0, alerted: false };
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
    if (p.contractId || p.questTag) return; // contract and quest bands are extra; they don't hold up regular respawns
    const t = tpl(p.template);
    c.partySpawns[t.id] = Math.max(c.partySpawns[t.id] || 0, now(c) + t.respawnDays);
  }

  /** Keep each template at its target count once its respawn timer has passed. */
  function ensure(c, ignoreTimers = false) {
    for (const t of Object.values(CL.content.table('party_templates'))) {
      let active = c.parties.filter((p) => p.template === t.id && !p.contractId && !p.questTag).length;
      while (active < t.count && (ignoreTimers || now(c) >= (c.partySpawns[t.id] || 0))) {
        spawn(c, t.id);
        active++;
        if (!ignoreTimers) c.partySpawns[t.id] = now(c) + t.respawnDays;
      }
    }
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
    if (!hostileTo(c, t) || !playerOnMap(c) || now(c) < p.ignoreUntil) return false;
    if (dist(p, c.world) > t.detection) return false;
    if (p.questTag) return !p.camp; // a story ambush springs whatever the odds; a camp waits to be found
    if (p.ambush) return dist(p, c.world) <= AMBUSH_RANGE; // lies still on the escort road and springs as you pass
    return A().troopsPower(p.troops) >= CHASE_RATIO * A().playerPower(c);
  }

  function nearest(c, p, kind, range) {
    let best = null;
    for (const o of c.parties) {
      // Quest bands are the story's: patrols leave them be and they leave caravans alone.
      if (o === p || o.questTag || o.ambush || o.escortTo || tpl(o.template).kind !== kind) continue;
      const d = dist(p, o);
      if (d <= range && (!best || d < best.d)) best = { o, d };
    }
    return best?.o || null;
  }

  /** A rival kingdom's regular patrol in sight (story columns keep out of border fights). */
  function rival(c, p, t) {
    let best = null;
    for (const o of c.parties) {
      const ot = tpl(o.template);
      if (o.questTag || ot.kind !== 'patrol' || ot.faction === t.faction) continue;
      const d = dist(p, o);
      if (d <= t.detection && (!best || d < best.d)) best = { o, d };
    }
    return best?.o || null;
  }

  const reached = (p) => p.tx === null || W().mapDist(p.x, p.y, p.tx, p.ty) <= ARRIVE;

  function chooseTarget(c, p) {
    const t = tpl(p.template);
    p.chasing = null;
    if (p.questTag && t.kind !== 'bandit') {
      // A story column (a kingdom's patrol) keeps to its post; the player comes to it.
      if (reached(p)) {
        p.tx = clamp(p.anchor.x + (A().next(c) * 2 - 1) * 3, 2, 98);
        p.ty = clamp(p.anchor.y + (A().next(c) * 2 - 1) * 3, 2, 98);
      }
      return;
    }
    if (t.kind === 'patrol' && wantsPlayer(c, p)) {
      // A Hostile kingdom's patrols ride the player down.
      p.chasing = 'player';
      [p.tx, p.ty] = [c.world.x, c.world.y];
      if (!p.alerted) {
        p.alerted = true;
        CL.ui.message(`A ${t.name} is riding for you!`);
      }
      return;
    }
    if (p.ambush && !wantsPlayer(c, p)) {
      p.tx = p.ty = null; // waiting in the ditch
      return;
    }
    if (t.kind === 'bandit') {
      if (wantsPlayer(c, p)) {
        p.chasing = 'player';
        [p.tx, p.ty] = [c.world.x, c.world.y];
        if (!p.alerted) {
          p.alerted = true;
          CL.ui.message(`${t.name} have spotted you!`);
        }
        return;
      }
      p.alerted = false;
      // Bands keep clear of patrols they can see (quest bands hold their ground).
      const threat = p.questTag || p.ambush ? null : nearest(c, p, 'patrol', t.detection);
      if (threat && A().troopsPower(threat.troops) > A().troopsPower(p.troops)) {
        p.chasing = 'fleeing';
        p.tx = clamp(p.x * 2 - threat.x, 2, 98);
        p.ty = clamp(p.y * 2 - threat.y, 2, 98);
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
        p.tx = clamp(ax + (A().next(c) * 2 - 1) * roam, 2, 98);
        p.ty = clamp(ay + (A().next(c) * 2 - 1) * roam, 2, 98);
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
          p.tx = clamp(f.x + (A().next(c) * 2 - 1) * f.jitter, 2, 98);
          p.ty = clamp(f.y + (A().next(c) * 2 - 1) * f.jitter, 2, 98);
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
    for (const a of [...c.parties]) {
      if (!c.parties.includes(a) || a.questTag || a.ambush || tpl(a.template).kind !== 'bandit' || CL.reinforce?.locked(a)) continue;
      for (const b of [...c.parties]) {
        const kb = tpl(b.template).kind;
        if (b === a || b.questTag || b.escortTo || !c.parties.includes(b) || (kb !== 'caravan' && kb !== 'patrol') || CL.reinforce?.locked(b)) continue;
        if (dist(a, b) > CONTACT) continue;
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
        } else {
          CL.news.record(c, 'reavers_broken', { x: r.loser.x, y: r.loser.y, faction: tpl(r.winner.template).faction }, now(c));
        }
        CL.diag.log('info', 'Off-screen battle', { winner: r.winner.template, loser: r.loser.template, losses: r.winnerLosses });
        if (r.loser.contractId) CL.contracts.onTargetLost(c, r.loser);
        remove(c, r.loser);
        // A pyrrhic win: if the winner lost its last troops too, it is gone as well.
        if (!troopCount(r.winner)) {
          if (r.winner.contractId) CL.contracts.onTargetLost(c, r.winner);
          remove(c, r.winner);
          if (r.winner === a) break;
        }
        if (r.loser === a) break;
      }
    }
    frontierClash(c);
  }

  /**
   * GDD §12 "recurring small frontier clashes": rival kingdoms' patrols that meet skirmish, at
   * most once every few days: a few men fall and the loser limps home, so no road is stripped bare.
   * Story columns keep out.
   */
  function frontierClash(c) {
    if (!CL.news.clashReady(c, now(c))) return;
    const patrols = c.parties.filter((p) => !p.questTag && tpl(p.template).kind === 'patrol' && !CL.reinforce?.locked(p));
    for (const a of patrols) {
      for (const b of patrols) {
        if (tpl(a.template).faction >= tpl(b.template).faction || dist(a, b) > CONTACT) continue;
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
        CL.diag.log('info', 'Frontier clash', { winner: winner.template, loser: loser.template, losses: [won.length, lost.length] });
        for (const p of [winner, loser]) if (!troopCount(p)) remove(c, p);
        const home = settlement(tpl(loser.template).home);
        if (c.parties.includes(loser)) [loser.tx, loser.ty] = [home.mapX, home.mapY];
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

  function runSteps(c, steps, h, start) {
    for (let i = 0; i < steps; i++) {
      simDay = start + ((i + 1) * h) / 24;
      ensure(c);
      for (const p of c.parties) {
        if (CL.reinforce?.locked(p)) continue; // in the battle being committed: it waits (V2-09, §9.5)
        chooseTarget(c, p);
        move(p, h);
      }
      resolveContacts(c);
      for (const p of c.parties) {
        if (CL.reinforce?.locked(p)) continue;
        if (wantsPlayer(c, p) && dist(p, c.world) <= CONTACT) {
          CL.game.contactParty = p.id;
          return p.id;
        }
      }
    }
    return null;
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
      const ambushText = p.ambush ? 'Reavers burst from cover and go for the caravan you are escorting. Stand and fight, or lose it.' : null;
      const text = spec?.text || ambushText || (hostile && t.hostileText ? t.hostileText : t.text);
      return { kind: 'party', name: spec?.name || t.name, text, troops: p.troops, hostile, def: battleDef(t, p.troops, map), party: p, t };
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

  /** A battle definition for a band: its actual troops, in waves of up to 8, on the local map. */
  function battleDef(t, troops, map = 'open_country') {
    const list = A().expand(troops);
    const waves = [];
    for (let i = 0; i < list.length; i += WAVE_SIZE) waves.push(A().collapse(list.slice(i, i + WAVE_SIZE)));
    const loot = t.lootBySize?.find(([max]) => list.length <= max)?.[1] || 'low';
    return { id: `party_${t.id}`, name: t.name, map, waves, reward: t.reward, loot };
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
          [e.party.tx, e.party.ty] = [clamp(e.party.x * 2 - c.world.x, 2, 98), clamp(e.party.y * 2 - c.world.y, 2, 98)];
        } else {
          c.gold -= n.cost;
          leaveAlone(e, IGNORE_AFTER.toll);
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

  /** Attacking a kingdom's patrol or caravan that wasn't after you: GDD §10 −15 reputation. */
  function assaultPenalty(c, e) {
    if (e.kind !== 'party' || e.hostile || !e.t.faction || e.t.kind === 'bandit') return;
    CL.realm.adjust(c, e.t.faction, CL.realm.REP.attack, `attacked ${e.t.id}`);
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
    const fallen = win
      ? A().rollFallen(c, healthy, A().lossChance(A().WINNER_LOSS, pp, pe), true)
      : A().rollFallen(c, healthy, A().lossChance(A().LOSER_LOSS, pp, pe), false);
    const enemyFallen = win ? enemyList : A().rollFallen(c, enemyList, A().lossChance(A().WINNER_LOSS, pe, pp), true);
    const killed = [];
    const wounded = [];
    for (const id of fallen) (A().next(c) < 0.35 ? killed : wounded).push(id);
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
    const outcome = { battleId: g.battleId, encounter: e.def, win, kills, killed, wounded, participants: healthy };
    const names = CL.party.rosterNames(c); // before the fallen leave the roster
    // The one commit path (V2-02): result, companion, map, band, events and the save, exactly once.
    CL.reinforce.lock(g, [e.party?.id, ...joined.map((j) => j.id)]); // they wait while the hours pass (§9.5)
    let r;
    try {
      r = /** @type {BattleResult | null} */ (CL.encounter.resolve(c, { kind: 'auto', outcome, fallenEnemies: enemyFallen, enemyTroops: Object.keys(e.troops), reinforcements: joined }));
    } finally {
      g.lock = null;
    }
    if (!r) return null; // already applied (a double tap)
    g.result = {
      win,
      auto: true, // drawn over the world map, not a battlefield
      ...r,
      html: CL.party.resultHtml({ win, r, kills, killed, wounded, survivors: healthy.length - fallen.length, auto: { pp, pe, reasons }, names }),
    };
    CL.diag.log('info', 'Auto-resolved', { ...outcome, encounter: e.def.id, pp, pe });
    CL.ui.changeMode('result');
    return g.result;
  }

  /** After a battle with a band: a win destroys it; a loss leaves it weakened but alive. */
  function onBattleResolved(win, partyId, fallenEnemyTroops) {
    const c = CL.campaign;
    const p = partyId != null ? find(c, partyId) : null;
    // GDD §10: beating Road Reavers helps whoever holds the land.
    if (win && (CL.game.siteId || (p && tpl(p.template).kind === 'bandit'))) {
      CL.realm.onBanditsBeaten(c);
      CL.news.record(c, 'player_deed', { x: c.world.x, y: c.world.y });
    }
    if (!p) return;
    if (win && p.contractId) CL.contracts.onTargetDefeated(c, p);
    if (win) remove(c, p);
    else {
      A().removeTroops(p.troops, fallenEnemyTroops);
      if (!troopCount(p)) {
        // A pyrrhic loss: the player was beaten but took the whole band down with them.
        if (p.contractId) CL.contracts.onTargetDefeated(c, p);
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
        x: clamp(p.x, 0, 100),
        y: clamp(p.y, 0, 100),
        troops,
        tx: num(p.tx) ? clamp(p.tx, 0, 100) : null,
        ty: num(p.ty) ? clamp(p.ty, 0, 100) : null,
        ignoreUntil: num(p.ignoreUntil) ? p.ignoreUntil : 0,
        alerted: false,
      };
      if (t.kind === 'bandit') q.lair = t.lairs.includes(p.lair) ? p.lair : t.lairs[0];
      if (Number.isInteger(p.contractId)) q.contractId = p.contractId;
      if (typeof p.questTag === 'string' && /^[a-z0-9_]{1,40}$/.test(p.questTag)) q.questTag = p.questTag;
      if (q.questTag && p.camp === true) q.camp = true;
      if (p.ambush === true) q.ambush = true;
      if (t.kind === 'caravan' && CL.content.table('settlements')[p.escortTo]) q.escortTo = p.escortTo;
      if (num(p.anchor?.x) && num(p.anchor?.y)) q.anchor = { x: clamp(p.anchor.x, 0, 100), y: clamp(p.anchor.y, 0, 100) };
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
  }

  CL.parties = {
    CONTACT,
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
