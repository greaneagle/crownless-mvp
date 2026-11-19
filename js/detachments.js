// @ts-check
/* Crownless detachments (P7-05; design §11.3, SC-17, SC-18): part of the company sent off under a captain.
 *
 * A captain is a veteran (tier 3, at least CAPTAIN.battles battles) or the companion. A detachment
 * takes chosen fit soldiers out of the company: each soldier is in exactly one party, the company or one
 * detachment, and takes their name, record and notes along. It is a party on the world map (template
 * `company_detachment`, kind 'detachment') that moves and fights by the world simulation's rules
 * (auto-resolved, like any off-screen fight), carrying its own food and pay.
 *
 * The order package (presets in ORDERS; the details are the expert's):
 *   objective    hunt: bands within HUNT_RADIUS of a spot; road: ride between two settlements, taking on
 *                bands it meets
 *   constraints  avoid stronger parties; turn back below `retreatBelow` of its fit strength; be back by
 *                `until` (day)
 *   resources    food (days of rations, from the company's stores) and a purse for wages, from the chest
 *   autonomy     judgement: only fights at JUDGEMENT odds or better; exact: takes on any band its order names
 * It reports in its log (events, and a quiet day's line), and sends word when something happens.
 * It turns back when its time is up, its food runs out, it falls below strength, it is beaten, or a
 * courier you send reaches it (at COURIER_SPEED). It rejoins the company when they meet: a returning
 * detachment rides to you; you can also ride to one and merge. Everything reconciles once, at the merge:
 * soldiers (with what happened to them), the purse back to the chest, the food back to the stores.
 * Pay and desertion are its own: wages from its purse each payday; unpaid, one soldier slips away.
 * State: c.detachments (saved, schema v14): active ones, and the last few that came back (reports). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const TEMPLATE = 'company_detachment';
  const ACCOUNT = 'budget:detachments'; // their purses, together; each detachment's share is its `purse`
  const CAPTAIN = { tier: 'T3', battles: 10 };
  const HUNT_RADIUS = 15;
  const JUDGEMENT = 0.55; // odds a captain using judgement needs to start a fight
  const SIGHT = 9; // map units: how far a detachment looks for bands
  const COURIER_SPEED = 6; // map units an hour
  const MEET = 2.5; // map units: close enough to merge
  const DEATH = 0.35;
  const LOG_MAX = 30;
  const KEEP_FINISHED = 3;
  const XP = { win: 20, loss: 8 };
  const DEFAULTS = { days: 5, retreatBelow: 0.5, avoidStronger: true, autonomy: 'judgement', foodDays: 6 };
  const LIMITS = { days: [1, 14], foodDays: [1, 14] };
  const RETREATS = [0.5, 0.34, 0];

  const A = () => CL.autoresolve;
  const W = () => CL.world;
  const tpl = (p) => CL.content.get('party_templates', p.template);
  const list = (c) => (c.detachments ||= []);
  const active = (c) => list(c).filter((d) => d.status !== 'back');
  const find = (c, id) => list(c).find((d) => d.id === id) || null;
  const partyOf = (c, d) => (c.parties || []).find((p) => p.detachment === d.id) || null;
  const fit = (d) => d.soldiers.filter((s) => s.woundedUntil === null);
  const tierPower = (s) => A().TIER_POWER?.[CL.content.troop(s.troop).tier] ?? { T1: 1, T2: 1.7, T3: 2.5 }[CL.content.troop(s.troop).tier];
  const settlement = (id) => CL.content.table('settlements')[id];

  /** Soldiers away on detachments now (for the party cap: they are still the company's). @param {Campaign} c */
  const away = (c) => active(c).reduce((n, d) => n + d.soldiers.length, 0);

  /** The companion leading it (Mara, or one of the retinue, P7-06), or null. @param {Campaign} c */
  function memberOf(c, cap) {
    if (cap?.kind !== 'companion') return null;
    if (c.companion && c.companion.id === cap.id) return c.companion;
    return CL.retinue?.find(c, cap.id) || null;
  }

  /** Its companion captain is hurt (beaten, or the patrol lost). */
  function woundCaptain(c, d) {
    const m = memberOf(c, d.captain);
    if (!m) return;
    if (m === c.companion) CL.companion.wound(c, 'down');
    else CL.retinue.wound(c, m);
  }

  /** The captain's name. */
  function captainName(_c, d) {
    if (d.captain.kind === 'companion') return CL.content.table('companions')[d.captain.id]?.name || 'the companion';
    return d.soldiers.find((s) => s.id === d.captain.id)?.name || d.captainName || 'its sergeant';
  }

  function log(c, d, text) {
    d.log.push({ day: c.day, text: text.slice(0, 140) });
    if (d.log.length > LOG_MAX) d.log.splice(0, d.log.length - LOG_MAX);
  }

  function say(c, d, text) {
    log(c, d, text);
    CL.ui.message(`${captainName(c, d)}’s patrol: ${text}`);
  }

  // ---- Captains and sending ----

  /** Who can lead one: { kind, id, name } for each eligible veteran and a fit, present companion. @param {Campaign} c */
  function captains(c) {
    /** @type {any[]} */
    const out = c.roster
      .filter((s) => s.woundedUntil === null && CL.content.troop(s.troop).tier === CAPTAIN.tier && s.record.battles >= CAPTAIN.battles)
      .map((s) => ({ kind: 'soldier', id: s.id, name: s.name }));
    const m = c.companion;
    if (m && CL.companion.fit(c) && !m.detached) out.unshift({ kind: 'companion', id: m.id, name: CL.companion.def(m.id).name });
    for (const r of CL.retinue?.fighters(c) || []) out.push({ kind: 'companion', id: r.id, name: CL.retinue.name(r) }); // the other companions (P7-06)
    return out;
  }

  /** Food and pay a detachment of `n` people needs for `days`. */
  function needs(soldiers, days, foodDays = days + 1) {
    const people = soldiers.length;
    const rations = Math.ceil(people / 5) * foodDays;
    const wages = Math.ceil(soldiers.reduce((sum, s) => sum + CL.content.troop(s.troop).wage, 0) * Math.ceil(days / 7) * 1.25);
    return { rations, wages };
  }

  /**
   * Send a detachment. `spec`: { captain: { kind, id }, soldierIds, order: { objective: 'hunt' | 'road',
   * x?, y?, road?: [a, b], days, retreatBelow, avoidStronger, autonomy }, foodDays?, wages? }.
   * Returns { ok, reason?, detachment? }. @param {Campaign} c
   */
  function send(c, spec) {
    const cap = captains(c).find((k) => k.kind === spec.captain?.kind && k.id === spec.captain?.id);
    if (!cap) return { ok: false, reason: 'no such captain' };
    const ids = new Set(spec.soldierIds || []);
    if (cap.kind === 'soldier') ids.add(cap.id);
    const soldiers = c.roster.filter((s) => ids.has(s.id) && s.woundedUntil === null);
    if (!soldiers.length) return { ok: false, reason: 'no fit soldiers chosen' };
    if (soldiers.length !== ids.size) return { ok: false, reason: 'only fit soldiers of the company can go' };
    const o = { ...DEFAULTS, ...(spec.order || {}) };
    o.days = Math.max(LIMITS.days[0], Math.min(LIMITS.days[1], Math.round(o.days)));
    if (!RETREATS.includes(o.retreatBelow)) o.retreatBelow = DEFAULTS.retreatBelow;
    o.autonomy = o.autonomy === 'exact' ? 'exact' : 'judgement';
    o.avoidStronger = o.avoidStronger !== false;
    if (o.objective === 'road') {
      if (!Array.isArray(o.road) || o.road.length !== 2 || !o.road.every(settlement)) return { ok: false, reason: 'the road needs two places' };
    } else {
      o.objective = 'hunt';
      o.x = Number.isFinite(o.x) ? o.x : c.world.x;
      o.y = Number.isFinite(o.y) ? o.y : c.world.y;
    }
    const foodDays = Math.max(LIMITS.foodDays[0], Math.min(LIMITS.foodDays[1], spec.foodDays ?? o.days + 1));
    const need = needs(soldiers, o.days, foodDays);
    const food = Math.min(need.rations, Math.floor(c.food));
    const wages = Math.min(spec.wages ?? need.wages, CL.accounts.balance(c, 'chest') + c.gold);
    // The purse comes from the chest first, then your purse (through the chest, so the ledger shows it).
    const fromChest = Math.min(wages, CL.accounts.balance(c, 'chest'));
    if (wages - fromChest > 0) CL.accounts.transfer(c, 'purse', 'chest', wages - fromChest, 'for a patrol’s pay');
    if (wages > 0 && !CL.accounts.transfer(c, 'chest', ACCOUNT, wages, 'a patrol’s pay')) return { ok: false, reason: 'no money for their pay' };
    c.food -= food;
    c.roster = c.roster.filter((s) => !ids.has(s.id));
    const id = (list(c).reduce((m, d) => Math.max(m, d.id), 0) || 0) + 1;
    /** @type {any} */
    const d = {
      id,
      captain: { kind: cap.kind, id: cap.id },
      captainName: cap.name,
      soldiers,
      order: { ...o, until: c.day + o.days },
      status: 'out',
      since: c.day,
      start: soldiers.length,
      purse: wages,
      food,
      unpaid: 0,
      leg: 0,
      recallAt: null,
      log: [],
      tally: { battles: 0, won: 0, lost: 0, kills: 0, fallen: [], wounded: 0, spoils: 0, deserted: 0 },
    };
    const member = memberOf(c, cap);
    if (member) member.detached = id;
    list(c).push(d);
    const p = /** @type {any} */ ({ id: c.nextPartyId++, template: TEMPLATE, x: c.world.x, y: c.world.y, troops: troopsOf(d), tx: null, ty: null, ignoreUntil: 0, alerted: false, detachment: id });
    c.parties.push(p);
    const what = o.objective === 'road' ? `patrol the road between ${settlement(o.road[0]).name} and ${settlement(o.road[1]).name}` : 'hunt bands around here';
    log(c, d, `Set out with ${soldiers.length} soldier${soldiers.length === 1 ? '' : 's'}, ${food} rations and ${wages} crowns, to ${what} for ${o.days} days.`);
    CL.ui.message(`${cap.name} sets out with ${soldiers.length} to ${what}, back by day ${CL.party.dayNumber(d.order.until)}.`);
    CL.diag.log('info', 'Detachment sent', { id, captain: cap.name, soldiers: soldiers.length, order: o.objective });
    return { ok: true, detachment: d };
  }

  /** The troop table its fit soldiers make. @returns {Record<string, number>} */
  function troopsOf(d) {
    /** @type {Record<string, number>} */
    const t = {};
    for (const s of fit(d)) t[s.troop] = (t[s.troop] || 0) + 1;
    if (!Object.keys(t).length && d.soldiers.length) t[d.soldiers[0].troop] = 1; // the wounded still march
    return t;
  }

  /** Its strength, the way auto-resolve counts a company (in ranks), with the companion if she leads it. */
  function power(c, d) {
    let p = fit(d).reduce((n, s) => n + tierPower(s) * A().COMPANY_FACTOR, 0);
    const m = memberOf(c, d.captain);
    if (m && m === c.companion && m.woundedUntil === null) p += CL.companion.power({ ...c, companion: { ...c.companion, detached: null, away: false } }) || 0;
    else if (m && m.woundedUntil === null) p += CL.retinue.powerOf(m);
    return p;
  }

  // ---- On the map (called by js/parties.js) ----

  /** Turn back, with the reason in its log. */
  function turnBack(c, d, why) {
    if (d.status !== 'out') return;
    d.status = 'returning';
    say(c, d, `turning back: ${why}.`);
  }

  /** Where it rides now. @param {Campaign} c @param {any} p its world party */
  function chooseTarget(c, p, day) {
    const d = find(c, p.detachment);
    if (!d) return;
    const o = d.order;
    if (d.status === 'out') {
      if (d.recallAt != null && day >= d.recallAt) turnBack(c, d, 'your courier found us');
      else if (day >= o.until) turnBack(c, d, 'our time is up');
      else if (d.food <= 0) turnBack(c, d, 'out of food');
      else if (fit(d).length < Math.ceil(d.start * o.retreatBelow)) turnBack(c, d, 'too few of us fit to fight');
    }
    if (d.status !== 'out') {
      // Back to the company, wherever it is.
      [p.tx, p.ty] = [c.world.x, c.world.y];
      return;
    }
    const mine = power(c, d);
    const bands = (c.parties || []).filter((b) => b !== p && !b.questTag && !b.contractId && tpl(b).kind === 'bandit' && W().mapDist(p.x, p.y, b.x, b.y) <= SIGHT);
    if (o.avoidStronger) {
      const danger = bands.filter((b) => A().troopsPower(b.troops) > mine).sort((a, b) => W().mapDist(p.x, p.y, a.x, a.y) - W().mapDist(p.x, p.y, b.x, b.y))[0];
      if (danger) {
        [p.tx, p.ty] = W().clampToMap(p.x * 2 - danger.x, p.y * 2 - danger.y, 2);
        p.chasing = 'fleeing';
        return;
      }
    }
    const inArea = (b) => (o.objective === 'hunt' ? W().mapDist(o.x, o.y, b.x, b.y) <= HUNT_RADIUS : true);
    const prey = bands
      .filter((b) => inArea(b) && (o.autonomy === 'exact' || A().winChance(mine, A().troopsPower(b.troops)) >= JUDGEMENT))
      .sort((a, b) => W().mapDist(p.x, p.y, a.x, a.y) - W().mapDist(p.x, p.y, b.x, b.y))[0];
    if (prey) {
      [p.tx, p.ty] = [prey.x, prey.y];
      p.chasing = prey.id;
      return;
    }
    const reached = p.tx == null || W().mapDist(p.x, p.y, p.tx, p.ty) <= 0.3;
    if (!reached) return;
    if (o.objective === 'road') {
      const s = settlement(o.road[d.leg % 2]);
      if (W().mapDist(p.x, p.y, s.mapX, s.mapY) <= 0.5) d.leg++;
      const t = settlement(o.road[d.leg % 2]);
      [p.tx, p.ty] = [t.mapX, t.mapY];
    } else {
      [p.tx, p.ty] = W().clampToMap(o.x + (A().next(c) * 2 - 1) * HUNT_RADIUS * 0.7, o.y + (A().next(c) * 2 - 1) * HUNT_RADIUS * 0.7, 2);
    }
  }

  /**
   * A band and a detachment meet (js/parties.js resolveContacts): an off-screen fight, auto-resolved by
   * the same rules as any other, with the named soldiers' fates recorded once. Returns the loser party.
   * @param {Campaign} c @param {any} p the detachment's party @param {any} band
   */
  function fight(c, p, band, day = c.day) {
    const d = find(c, p.detachment);
    if (!d) return null;
    const bt = tpl(band);
    const mine = power(c, d);
    const theirs = A().troopsPower(band.troops);
    const win = A().next(c) < A().winChance(mine, theirs);
    const ready = fit(d);
    const fallen = A().rollFallen(c, ready.map((s) => s.id), A().lossChance(win ? A().WINNER_LOSS : A().LOSER_LOSS, mine, theirs), win);
    const killed = [];
    const wounded = [];
    for (const id of fallen) (A().next(c) < DEATH ? killed : wounded).push(id);
    const foe = bt.name;
    const place = CL.news?.nearestPlace?.(band.x, band.y);
    const near = place ? ` near ${settlement(place)?.name}` : '';
    for (const s of ready) {
      s.record.battles++;
      if (win) s.record.victories++;
      if (!killed.includes(s.id)) s.xp += win ? XP.win : XP.loss;
    }
    for (const s of d.soldiers.filter((x) => wounded.includes(x.id))) {
      s.woundedUntil = day + CL.save.WOUND_DAYS;
      s.record.wounds++;
    }
    for (const s of d.soldiers.filter((x) => killed.includes(x.id))) {
      CL.events.emit(c, 'SoldierKilled', { soldierId: s.id, troop: s.troop, soldier: s, encounterName: `${foe} (with ${captainName(c, d)})`, win, kills: 0 });
      d.tally.fallen.push(s.name);
    }
    d.soldiers = d.soldiers.filter((s) => !killed.includes(s.id));
    d.tally.battles++;
    d.tally.wounded += wounded.length;
    const enemies = A().expand(band.troops).length;
    const losses = `${killed.length ? `${killed.length} fell` : 'none fell'}${wounded.length ? `, ${wounded.length} wounded` : ''}`;
    if (win) {
      d.tally.won++;
      d.tally.kills += enemies;
      const spoils = bt.reward.goldBase + enemies * bt.reward.goldPerKill;
      if (CL.accounts.transfer(c, CL.accounts.WORLD, ACCOUNT, spoils, `spoils: ${captainName(c, d)}’s patrol`)) {
        d.purse += spoils;
        d.tally.spoils += spoils;
      }
      c.renown += Math.floor((bt.reward.renown || 0) / 2);
      say(c, d, `broke ${CL.scout?.about?.(enemies) ?? enemies} ${foe}${near} (${losses}).`);
      CL.parties.remove(c, band);
    } else {
      d.tally.lost++;
      const theirLoss = A().rollFallen(c, A().expand(band.troops), A().lossChance(A().WINNER_LOSS, theirs, mine), true);
      A().removeTroops(band.troops, theirLoss);
      if (!Object.values(band.troops).some((n) => n > 0)) CL.parties.remove(c, band);
      // Beaten: the captain comes back wounded, with whoever is left (SC-18).
      if (d.captain.kind === 'soldier') {
        const cap = d.soldiers.find((s) => s.id === d.captain.id);
        if (cap && cap.woundedUntil === null) {
          cap.woundedUntil = day + CL.save.WOUND_DAYS;
          cap.record.wounds++;
        }
      } else woundCaptain(c, d);
      d.status = 'returning';
      say(c, d, `beaten by ${foe}${near} (${losses}). Coming back.`);
    }
    if (!d.soldiers.length) {
      // Nobody left: the detachment is gone; what it carried is lost with it.
      lose(c, d);
      return p;
    }
    p.troops = troopsOf(d);
    return win ? band : p;
  }

  /** Every one of them fell: the detachment is gone (its purse and food with it). */
  function lose(c, d) {
    CL.accounts.transfer(c, ACCOUNT, CL.accounts.WORLD, d.purse, 'lost with a patrol');
    d.purse = 0;
    d.food = 0;
    const m = memberOf(c, d.captain);
    if (m) {
      delete m.detached; // they make their way back alone
      woundCaptain(c, d);
    }
    finish(c, d, 'lost');
    CL.ui.message(`${d.captainName}’s patrol was wiped out. ${d.tally.fallen.length} fell.`);
  }

  /** Remove its party and keep it as a report. */
  function finish(c, d, how) {
    const p = partyOf(c, d);
    if (p) c.parties.splice(c.parties.indexOf(p), 1);
    d.status = 'back';
    d.ended = { day: c.day, how };
    const done = list(c).filter((x) => x.status === 'back');
    for (const x of done.slice(0, Math.max(0, done.length - KEEP_FINISHED))) list(c).splice(list(c).indexOf(x), 1);
  }

  /**
   * It rejoins the company: soldiers back with what happened to them, its purse to the chest, its food
   * to the stores, a final report. Exactly once (it is gone from the map and marked back).
   * @param {Campaign} c
   */
  function merge(c, d) {
    if (!d || d.status === 'back') return false;
    c.roster.push(...d.soldiers);
    c.roster.sort((a, b) => a.id - b.id);
    if (d.purse > 0) CL.accounts.transfer(c, ACCOUNT, 'chest', d.purse, `back from ${d.captainName}’s patrol`);
    c.food += d.food;
    const m = memberOf(c, d.captain);
    if (m?.detached === d.id) delete m.detached;
    const t = d.tally;
    const days = Math.max(0, c.day - d.since);
    const report = `${d.captainName}’s patrol is back after ${days.toFixed(1)} days: ${t.won} won, ${t.lost} lost, ${t.kills} enemies beaten, ${t.fallen.length} fell${t.fallen.length ? ` (${t.fallen.join(', ')})` : ''}, ${t.wounded} wounded${t.deserted ? `, ${t.deserted} deserted` : ''}; ${d.purse} crowns and ${d.food} rations returned${t.spoils ? `, ${t.spoils} in spoils` : ''}.`;
    log(c, d, report);
    d.report = report;
    d.purse = 0;
    d.food = 0;
    d.soldiers = [];
    finish(c, d, 'merged');
    CL.ui.message(report);
    CL.diag.log('info', 'Detachment back', { id: d.id, ...t });
    return true;
  }

  /** Each step: returning detachments that reach the company rejoin it. @param {Campaign} c */
  function step(c) {
    for (const d of active(c)) {
      const p = partyOf(c, d);
      if (!p) continue;
      if (d.status === 'returning' && W().mapDist(p.x, p.y, c.world.x, c.world.y) <= MEET) merge(c, d);
    }
  }

  /** Is this one close enough to merge now (you rode to it)? @param {Campaign} c */
  function canMeet(c, d) {
    const p = partyOf(c, d);
    return Boolean(p) && d.status !== 'back' && W().mapDist(p.x, p.y, c.world.x, c.world.y) <= MEET;
  }

  /** Send a courier: it turns back when the courier reaches it. Returns the day it should. @param {Campaign} c */
  function recall(c, d) {
    const p = partyOf(c, d);
    if (!p || d.status !== 'out') return null;
    const hours = W().mapDist(p.x, p.y, c.world.x, c.world.y) / COURIER_SPEED;
    d.recallAt = c.day + hours / 24;
    log(c, d, 'A courier is on the way with your order to come back.');
    CL.ui.message(`A courier rides for ${captainName(c, d)}’s patrol; they should turn back by ${CL.world.clockLabel(d.recallAt)}.`);
    return d.recallAt;
  }

  // ---- Daily: food, a quiet day's line; payday ----

  /** Once a day (js/upkeep.js): food, and a line in the log when nothing happened. @param {Campaign} c */
  function daily(c) {
    for (const d of active(c)) {
      const eat = Math.ceil((d.soldiers.length + (d.captain.kind === 'companion' ? 1 : 0)) / 5);
      d.food = Math.max(0, d.food - eat);
      const last = d.log.at(-1);
      if (!last || c.day - last.day >= 1) {
        const p = partyOf(c, d);
        const place = p && CL.news?.nearestPlace?.(p.x, p.y);
        log(c, d, `${d.status === 'out' ? 'Patrolling' : 'Riding back'}${place ? ` near ${settlement(place).name}` : ''}; ${fit(d).length} fit, ${d.food} rations, ${d.purse} crowns.`);
      }
    }
  }

  /** Payday (js/upkeep.js): wages from its purse; unpaid, one soldier slips away. @param {Campaign} c */
  function payday(c) {
    for (const d of active(c)) {
      const owed = d.soldiers.reduce((n, s) => n + CL.content.troop(s.troop).wage, 0);
      const paid = Math.min(owed, d.purse);
      if (paid > 0 && CL.accounts.transfer(c, ACCOUNT, CL.accounts.WORLD, paid, `wages: ${captainName(c, d)}’s patrol`)) d.purse -= paid;
      if (paid >= owed) {
        d.unpaid = 0;
        for (const s of d.soldiers) s.record.wagesPaid += CL.content.troop(s.troop).wage;
        continue;
      }
      d.unpaid++;
      const leaver = [...d.soldiers].filter((s) => !(d.captain.kind === 'soldier' && s.id === d.captain.id)).sort((a, b) => CL.content.troop(a.troop).tier.localeCompare(CL.content.troop(b.troop).tier) || b.id - a.id)[0];
      if (leaver) {
        d.soldiers = d.soldiers.filter((s) => s !== leaver);
        d.tally.deserted++;
        CL.events.emit(c, 'SoldierDeserted', { soldierId: leaver.id, troop: leaver.troop, morale: null, soldier: leaver });
        say(c, d, `${leaver.name} went unpaid and slipped away.`);
        const p = partyOf(c, d);
        if (p) p.troops = troopsOf(d);
      }
      turnBack(c, d, 'the pay ran out');
    }
  }

  // ---- The story and the companion ----

  /** The story needs the companion (Q3's `send`): called back from her patrol first. @param {Campaign} c */
  function callBackCompanion(c) {
    const m = c.companion;
    const d = m?.detached ? find(c, m.detached) : null;
    if (!d) return false;
    delete m.detached;
    d.captain = { kind: 'none', id: null };
    turnBack(c, d, `${CL.companion.def(m.id).name} has been called away`);
    CL.ui.message(`${CL.companion.def(m.id).name} is called back from her patrol: she is needed. The patrol heads home without her.`);
    return true;
  }

  /** A companion of the retinue leaves the company while leading a patrol: it heads home without them. @param {Campaign} c */
  function loseCaptain(c, id, name) {
    const d = find(c, id);
    if (!d || d.status === 'back') return false;
    d.captain = { kind: 'none', id: null };
    turnBack(c, d, `${name} has left the company`);
    return true;
  }

  // ---- Saves ----

  /**
   * Repair the detachments onto `s`. `soldierOf` repairs one soldier (shared with the roster, so IDs stay
   * unique across all parties). Their map parties are linked in `relink` after the parties load.
   * @param {Campaign} s @param {any} d @param {(e: any) => Soldier | null} soldierOf
   */
  function sanitize(s, d, soldierOf) {
    s.detachments = [];
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    const text = (x, n = 140) => (typeof x === 'string' ? x.slice(0, n) : '');
    for (const x of Array.isArray(d?.detachments) ? d.detachments.slice(0, 12) : []) {
      if (!x || typeof x !== 'object' || !Number.isInteger(x.id) || s.detachments.some((y) => y.id === x.id)) continue;
      const status = ['out', 'returning', 'back'].includes(x.status) ? x.status : 'returning';
      const soldiers = status === 'back' ? [] : (Array.isArray(x.soldiers) ? x.soldiers : []).map(soldierOf).filter(Boolean);
      if (status !== 'back' && !soldiers.length) continue;
      const o = x.order || {};
      const road = Array.isArray(o.road) && o.road.length === 2 && o.road.every((id) => CL.content.table('settlements')[id]) ? [...o.road] : null;
      const order = {
        objective: road && o.objective === 'road' ? 'road' : 'hunt',
        x: num(o.x, s.world.x),
        y: num(o.y, s.world.y),
        road,
        days: Math.max(1, Math.min(14, Math.round(num(o.days, DEFAULTS.days)))),
        until: num(o.until, s.day),
        retreatBelow: RETREATS.includes(o.retreatBelow) ? o.retreatBelow : DEFAULTS.retreatBelow,
        avoidStronger: o.avoidStronger !== false,
        autonomy: o.autonomy === 'exact' ? 'exact' : 'judgement',
      };
      const leader = x.captain?.kind === 'companion' && status !== 'back' ? memberOf(s, x.captain) : null;
      const cap = leader && !leader.detached ? { kind: 'companion', id: leader.id } : x.captain?.kind === 'companion' && status === 'back' && s.companion && x.captain.id === s.companion.id ? { kind: 'companion', id: s.companion.id } : x.captain?.kind === 'soldier' && soldiers.some((y) => y.id === x.captain.id) ? { kind: 'soldier', id: x.captain.id } : { kind: 'none', id: null };
      const t = x.tally || {};
      s.detachments.push({
        id: x.id,
        captain: cap,
        captainName: text(x.captainName, 60) || 'its sergeant',
        soldiers,
        order,
        status,
        since: num(x.since, s.day),
        start: Math.max(soldiers.length, Math.floor(num(x.start, soldiers.length))),
        purse: Math.max(0, Math.floor(num(x.purse, 0))),
        food: Math.max(0, Math.floor(num(x.food, 0))),
        unpaid: Math.max(0, Math.floor(num(x.unpaid, 0))),
        leg: Math.max(0, Math.floor(num(x.leg, 0))),
        recallAt: num(x.recallAt, null),
        log: (Array.isArray(x.log) ? x.log : []).filter((e) => e && typeof e.text === 'string' && Number.isFinite(e.day)).slice(-LOG_MAX).map((e) => ({ day: e.day, text: text(e.text) })),
        tally: {
          battles: Math.max(0, Math.floor(num(t.battles, 0))),
          won: Math.max(0, Math.floor(num(t.won, 0))),
          lost: Math.max(0, Math.floor(num(t.lost, 0))),
          kills: Math.max(0, Math.floor(num(t.kills, 0))),
          fallen: (Array.isArray(t.fallen) ? t.fallen : []).filter((n) => typeof n === 'string').slice(0, 40).map((n) => n.slice(0, 60)),
          wounded: Math.max(0, Math.floor(num(t.wounded, 0))),
          spoils: Math.max(0, Math.floor(num(t.spoils, 0))),
          deserted: Math.max(0, Math.floor(num(t.deserted, 0))),
        },
        ...(typeof x.report === 'string' ? { report: text(x.report, 400) } : {}),
        ...(x.ended && Number.isFinite(x.ended.day) ? { ended: { day: x.ended.day, how: x.ended.how === 'lost' ? 'lost' : 'merged' } } : {}),
      });
      if (leader && cap.kind === 'companion') leader.detached = x.id;
    }
  }

  /**
   * After the world parties load: every active detachment has its party (re-made at the company if
   * missing), no party belongs to one that isn't out, and their purses add up to the account.
   * @param {Campaign} s
   */
  function relink(s) {
    const live = new Set(active(s).map((d) => d.id));
    s.parties = s.parties.filter((p) => p.detachment == null || live.has(p.detachment));
    for (const d of active(s)) {
      let p = s.parties.find((q) => q.detachment === d.id);
      if (!p) {
        p = /** @type {any} */ ({ id: s.nextPartyId++, template: TEMPLATE, x: s.world.x, y: s.world.y, troops: {}, tx: null, ty: null, ignoreUntil: 0, alerted: false, detachment: d.id });
        s.parties.push(p);
      }
      p.troops = troopsOf(d);
    }
    const held = active(s).reduce((n, d) => n + d.purse, 0);
    s.accounts.budgets.detachments = held; // the account is just their purses together
    if (!held) delete s.accounts.budgets.detachments;
  }

  CL.detachments = { TEMPLATE, ACCOUNT, CAPTAIN, HUNT_RADIUS, JUDGEMENT, COURIER_SPEED, MEET, DEFAULTS, LIMITS, RETREATS, list, active, find, partyOf, away, captainName, captains, needs, send, troopsOf, power, chooseTarget, fight, merge, step, canMeet, recall, daily, payday, callBackCompanion, loseCaptain, memberOf, sanitize, relink };
})(typeof window !== 'undefined' ? window : globalThis);
