/* Crownless contracts (GDD §4 repeatable work): one reusable lifecycle for three templates —
 *   offered → accepted (active) → done → paid
 *                               ↘ deadline passed (failed) / abandoned / target lost (void)
 *   hunt:     destroy a marked band; paid when you return to the giver.
 *   escort:   a marked caravan rolls toward its destination only while you stay close; a Reaver
 *             ambush waits on the route. Paid on arrival at the destination.
 *   delivery: carry goods (a refundable deposit at their value) or a sealed message; paid on
 *             arrival at the destination.
 * State: CL.campaign.contract (one at a time), contractOffers[settlementId][templateId], contractsDone. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const A = () => CL.autoresolve;

  const OFFER_REFRESH_DAYS = 3;
  const Y_ASPECT = 0.5636; // the map is wider than tall; offsets look round on screen
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const tpl = (id) => CL.content.get('contracts', id);
  const templates = () => Object.values(CL.content.table('contracts'));
  const settlement = (id) => CL.content.get('settlements', id);
  const offersContracts = (sid) => Boolean(sid && settlement(sid).services.includes('contracts'));
  const fill = (text, k) => text.replace('{giver}', settlement(k.giver).name).replace('{to}', k.to ? settlement(k.to).name : '');
  const between = (lo, hi, r) => lo + (hi - lo) * r;

  // ---- Offers ----

  /** Build a band whose power is the given multiple range of the player's, from a troop pool. */
  function rollTroops(c, t, strength = t.strength) {
    const [lo, hi] = strength;
    const target = A().playerPower(c) * between(lo, hi, A().next(c));
    const troops = {};
    let power = 0;
    let n = 0;
    while (n < t.maxTroops && (n < t.minTroops || power < target)) {
      const id = t.troopPool[Math.floor(A().next(c) * t.troopPool.length)];
      troops[id] = (troops[id] || 0) + 1;
      power += A().TIER_POWER[CL.content.troop(id).tier];
      n++;
    }
    return troops;
  }

  /** A destination for escort and delivery: another settlement within the template's distance. */
  function pickDestination(c, sid, t) {
    const s = settlement(sid);
    const dist = (o) => CL.world.mapDist(s.mapX, s.mapY, o.mapX, o.mapY);
    const all = Object.values(CL.content.table('settlements')).filter((o) => o.id !== sid);
    let pool = all.filter((o) => dist(o) >= t.distance[0] && dist(o) <= t.distance[1]);
    if (!pool.length) pool = all;
    return pool[Math.floor(A().next(c) * pool.length)];
  }

  function makeOffer(c, sid, templateId = 'bandit_hunt') {
    const t = tpl(templateId);
    const s = settlement(sid);
    const base = { id: c.nextContractId++, template: t.id, giver: sid, days: t.timeLimitDays, offeredUntil: c.day + OFFER_REFRESH_DAYS };
    if (t.kind === 'hunt') {
      const troops = rollTroops(c, t);
      const size = Object.values(troops).reduce((a, b) => a + b, 0);
      const angle = A().next(c) * Math.PI * 2;
      const dist = between(t.distance[0], t.distance[1], A().next(c));
      return {
        ...base,
        troops,
        x: clamp(s.mapX + Math.cos(angle) * dist, 5, 95),
        y: clamp(s.mapY + (Math.sin(angle) * dist) / Y_ASPECT, 5, 95),
        reward: { gold: t.reward.goldBase + t.reward.goldPerTroop * size, renown: t.reward.renown, xp: t.reward.xpBase + t.reward.xpPerTroop * size },
      };
    }
    const to = pickDestination(c, sid, t);
    const leagues = Math.round(CL.world.mapDist(s.mapX, s.mapY, to.mapX, to.mapY));
    const reward = { gold: t.reward.goldBase + t.reward.goldPerLeague * leagues, renown: t.reward.renown, xp: t.reward.xpBase + t.reward.xpPerLeague * leagues };
    if (t.kind === 'escort') {
      // The ambush waits 40–70% of the way along the road.
      const f = between(0.4, 0.7, A().next(c));
      return { ...base, to: to.id, troops: rollTroops(c, t, t.ambushStrength), x: s.mapX + (to.mapX - s.mapX) * f, y: s.mapY + (to.mapY - s.mapY) * f, reward };
    }
    // Delivery: goods or a letter.
    if (A().next(c) < t.letterChance) return { ...base, to: to.id, letter: true, reward };
    const goods = CL.trade.goods();
    const good = goods[Math.floor(A().next(c) * goods.length)].id;
    const qty = Math.round(between(t.goodsQty[0], t.goodsQty[1], A().next(c)));
    const deposit = CL.content.get('markets', good).basePrice * qty;
    return { ...base, to: to.id, good, qty, deposit, reward: { ...reward, gold: reward.gold + deposit } };
  }

  /** Every offer on a settlement's board (one per template), refreshed when stale. */
  function offersAt(c, sid) {
    if (!offersContracts(sid) || !CL.realm.welcomes(c, sid)) return []; // no work for enemies
    if (!c.contractOffers[sid]) c.contractOffers[sid] = {};
    const board = c.contractOffers[sid];
    for (const t of templates()) {
      const o = board[t.id];
      if (o === null && c.day < (board[`${t.id}_until`] || 0)) continue; // taken; the board refills later
      if (!o || c.day >= o.offeredUntil) {
        board[t.id] = makeOffer(c, sid, t.id);
        delete board[`${t.id}_until`];
      }
    }
    return templates()
      .map((t) => board[t.id])
      .filter(Boolean);
  }

  /** The offer of one template at a settlement (the bandit hunt by default). Null if none. */
  function offerAt(c, sid, templateId = 'bandit_hunt') {
    return offersAt(c, sid).find((o) => o.template === templateId) || null;
  }

  // ---- Lifecycle ----

  const active = (c = CL.campaign) => c.contract;

  /** A marked party on the map for this contract, placed at x, y. */
  function markParty(c, templateId, troops, x, y, extra) {
    const p = CL.parties.spawn(c, templateId);
    Object.assign(p, { troops: { ...troops }, x, y, tx: null, ty: null, anchor: { x, y }, ...extra });
    return p;
  }

  function accept(c, sid, templateId = 'bandit_hunt') {
    if (c.contract) return { ok: false, reason: 'Finish your current contract first' };
    const o = offerAt(c, sid, templateId);
    if (!o) return { ok: false, reason: 'No contracts here' };
    const t = tpl(o.template);
    if (o.deposit && c.gold < o.deposit) return { ok: false, reason: `You need ${o.deposit} crowns for the deposit` };
    const k = { ...o, status: 'active', deadline: c.day + o.days };
    if (t.kind === 'hunt') {
      k.partyId = markParty(c, t.band, o.troops, o.x, o.y, { contractId: o.id }).id;
    } else if (t.kind === 'escort') {
      const s = settlement(sid);
      const owner = CL.realm.owner(sid, c);
      const caravanTpl = Object.values(CL.content.table('party_templates')).find((x) => x.kind === 'caravan' && x.faction === owner) || Object.values(CL.content.table('party_templates')).find((x) => x.kind === 'caravan');
      const caravan = markParty(c, caravanTpl.id, { levy: 2 }, s.mapX, s.mapY, { contractId: o.id, escortTo: o.to });
      delete caravan.anchor;
      k.partyId = caravan.id;
      k.ambushId = markParty(c, t.band, o.troops, o.x, o.y, { contractId: o.id, ambush: true }).id;
    } else if (o.good) {
      c.gold -= o.deposit;
      c.cargo[o.good] = (c.cargo[o.good] || 0) + o.qty;
    }
    c.contract = k;
    c.contractOffers[sid][templateId] = null; // the board refills when offers refresh
    c.contractOffers[sid][`${templateId}_until`] = o.offeredUntil;
    CL.diag.log('info', 'Contract accepted', { id: o.id, template: o.template, giver: sid, to: o.to, reward: o.reward });
    return { ok: true };
  }

  /** Remove this contract's marked parties from the map (escort caravan and ambush). */
  function clearParties(c, k) {
    for (const id of [k.kind === 'hunt' ? null : k.partyId, k.ambushId]) {
      const p = id != null && CL.parties.find(c, id);
      if (p) c.parties.splice(c.parties.indexOf(p), 1);
    }
  }

  function end(c, status, note) {
    const k = c.contract;
    CL.diag.log(status === 'collected' ? 'info' : 'warn', `Contract ${status}`, { id: k.id, note });
    if (tpl(k.template).kind !== 'hunt') clearParties(c, { ...k, kind: tpl(k.template).kind });
    c.contract = null;
  }

  /** The marked band was destroyed by the player. */
  function onTargetDefeated(c, p) {
    const k = c.contract;
    if (!k || k.partyId !== p.id || k.status !== 'active' || tpl(k.template).kind !== 'hunt') return;
    k.status = 'done';
    CL.ui.message(fill(tpl(k.template).done, k));
    CL.diag.log('info', 'Contract target defeated', { id: k.id });
  }

  /** The marked band was destroyed by someone else (a patrol, off-screen): void, no penalty. */
  function onTargetLost(c, p) {
    const k = c.contract;
    if (!k || k.partyId !== p.id || k.status !== 'active') return;
    CL.ui.message(`Another company broke the band before you could. Your contract from ${settlement(k.giver).name} is void.`);
    end(c, 'void', 'target destroyed by others');
  }

  /** Release the marked band back into the world as an ordinary band. */
  function releaseTarget(c) {
    const k = c.contract;
    if (tpl(k.template).kind !== 'hunt') return;
    const p = CL.parties.find(c, k.partyId);
    if (p) {
      delete p.contractId;
      delete p.anchor;
    }
  }

  function fail(c, reason) {
    const t = tpl(c.contract.template);
    c.renown = Math.max(0, c.renown - t.failRenown);
    releaseTarget(c);
    end(c, 'failed', reason);
  }

  /** Escort and delivery pay on arrival: the job is done and paid in one go. */
  function finishOnArrival(c) {
    const k = c.contract;
    tradeArrives(c, k);
    k.status = 'done';
    k.payAt = k.to;
    CL.ui.message(fill(tpl(k.template).done, k));
    return collect(c, true); // paid on the spot, even if the caravan rolls in a moment before you
  }

  /**
   * Trade-world: what an escort or delivery brings in eases that good's price at the destination
   * (as a regular caravan does, GDD §9), and the road hears of it (regional news).
   */
  function tradeArrives(c, k) {
    const kind = tpl(k.template).kind;
    const p = kind === 'escort' ? CL.parties.find(c, k.partyId) : null;
    const good = kind === 'escort' ? p?.good : k.good;
    const T = CL.trade;
    if (good && c.markets[k.to]?.[good] != null) {
      c.markets[k.to][good] = Math.max(T.SCARCITY.min, Math.round((c.markets[k.to][good] - CL.parties.CARAVAN_EFFECT) * 1000) / 1000);
    }
    if (kind === 'escort') CL.news.record(c, 'escort_arrived', { dest: k.to, good, faction: CL.realm.owner(k.giver, c) });
    else if (good) CL.news.record(c, 'delivered', { dest: k.to, good });
  }

  /**
   * The player entered a settlement. A delivery is handed over; an escort is done if its caravan
   * is close behind.
   */
  function onArrive(c, sid) {
    const k = c.contract;
    if (k?.status !== 'active' || k.to !== sid) return null;
    const kind = tpl(k.template).kind;
    if (kind === 'delivery') {
      if (k.good && (c.cargo[k.good] || 0) < k.qty) {
        CL.ui.message(`You need ${k.qty} ${CL.content.get('markets', k.good).name} to complete the delivery.`);
        return null;
      }
      if (k.good) {
        c.cargo[k.good] -= k.qty;
        if (!c.cargo[k.good]) delete c.cargo[k.good];
      }
      return finishOnArrival(c);
    }
    if (kind === 'escort') {
      const p = CL.parties.find(c, k.partyId);
      const s = settlement(sid);
      if (p && CL.world.mapDist(p.x, p.y, s.mapX, s.mapY) <= tpl(k.template).escortRange) return finishOnArrival(c);
      CL.ui.message('The caravan is not with you. Go back for it.');
    }
    return null;
  }

  /** Called by the world sim: the escorted caravan reached its destination. */
  function onCaravanArrived(c, p) {
    const k = c.contract;
    if (k?.status !== 'active' || k.partyId !== p.id) return;
    const w = c.world;
    const s = settlement(k.to);
    const near = CL.world.mapDist(w.x, w.y, s.mapX, s.mapY) <= tpl(k.template).escortRange;
    if (near) finishOnArrival(c);
  }

  /** Daily check from the campaign clock: an active contract past its deadline fails. */
  function tick(c) {
    const k = c.contract;
    if (k?.status === 'active' && c.day > k.deadline) {
      CL.ui.message(`Your contract from ${settlement(k.giver).name} has run out. Your name suffers for it.`);
      fail(c, 'deadline');
    }
  }

  function abandon(c) {
    if (!c.contract) return false;
    if (c.contract.status === 'done') return false; // just collect it
    fail(c, 'abandoned');
    return true;
  }

  /** Collect the reward where it is paid: the giver for hunts, the destination for escort and delivery. */
  function collect(c, onTheSpot = false) {
    const k = c.contract;
    if (k?.status !== 'done' || (!onTheSpot && c.world.location !== (k.payAt || k.giver))) return null;
    c.gold += k.reward.gold;
    c.renown += k.reward.renown;
    CL.audio?.play('coin');
    const levels = CL.character.gainXp(k.reward.xp, c);
    c.contractsDone += 1;
    CL.story.emit('contract', { template: k.template, giver: k.giver }, c);
    CL.realm.adjust(c, CL.realm.owner(k.giver, c), CL.realm.REP.help, 'contract'); // GDD §10: helping a faction
    end(c, 'collected');
    return { ...k.reward, levels };
  }

  /** Days left (negative once late), for the HUD. */
  const daysLeft = (c = CL.campaign) => (c.contract?.status === 'active' ? c.contract.deadline - c.day : null);

  /** One line for the HUD and the board. */
  function summary(c = CL.campaign) {
    const k = c.contract;
    if (!k) return null;
    if (k.status === 'done') return 'contract done — collect pay';
    const left = `${Math.max(0, daysLeft(c)).toFixed(1)}d left`;
    const kind = tpl(k.template).kind;
    if (kind === 'escort') return `escort to ${settlement(k.to).name} · ${left}`;
    if (kind === 'delivery') return `deliver to ${settlement(k.to).name} · ${left}`;
    return `contract ${left}`;
  }

  // ---- Save ----

  function sanitizeContract(k, d) {
    const t = k && typeof k === 'object' && CL.content.table('contracts')[k.template];
    if (!t || !offersContracts(k.giver) || !Number.isInteger(k.id)) return null;
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    const troops = {};
    for (const [id, n] of Object.entries(k.troops || {})) {
      if (CL.content.table('troops')[id] && Number.isInteger(n) && n > 0) troops[id] = n;
    }
    if (t.kind !== 'delivery' && !Object.keys(troops).length) return null;
    if (t.kind !== 'hunt' && (!CL.content.table('settlements')[k.to] || k.to === k.giver)) return null;
    const r = k.reward || {};
    // Same field order as the game writes them (offer, then accept), so a reload is byte-identical.
    const out = { id: k.id, template: k.template, giver: k.giver, days: num(k.days) ? k.days : t.timeLimitDays, offeredUntil: num(k.offeredUntil) ? k.offeredUntil : d.day };
    if (t.kind !== 'hunt') out.to = k.to;
    if (t.kind === 'delivery') {
      if (k.letter === true) out.letter = true;
      else if (CL.content.table('markets')[k.good]?.tradeGood && Number.isInteger(k.qty) && k.qty > 0) {
        Object.assign(out, { good: k.good, qty: Math.min(k.qty, 99), deposit: num(k.deposit) ? Math.max(0, k.deposit) : 0 });
      } else return null;
    }
    if (Object.keys(troops).length) out.troops = troops;
    if (t.kind !== 'delivery') Object.assign(out, num(k.x) && num(k.y) ? { x: clamp(k.x, 0, 100), y: clamp(k.y, 0, 100) } : { x: 50, y: 50 });
    out.reward = { gold: num(r.gold) ? Math.max(0, r.gold) : 0, renown: num(r.renown) ? r.renown : 0, xp: num(r.xp) ? r.xp : 0 };
    if (k.status) out.status = ['active', 'done'].includes(k.status) ? k.status : 'active';
    if (num(k.deadline)) out.deadline = k.deadline;
    if (Number.isInteger(k.partyId)) out.partyId = k.partyId;
    if (Number.isInteger(k.ambushId)) out.ambushId = k.ambushId;
    if (k.payAt && CL.content.table('settlements')[k.payAt]) out.payAt = k.payAt;
    return out;
  }

  function sanitize(s, d) {
    s.contractOffers = {};
    for (const [sid, raw] of Object.entries(d?.contractOffers || {})) {
      if (!offersContracts(CL.content.table('settlements')[sid] ? sid : null)) continue;
      // Older saves kept one offer object per board; newer ones keep one per template, plus
      // 'taken' markers (template: null, template_until: day) until the board refills.
      const board = {};
      if (raw?.template) {
        const clean = sanitizeContract(raw, s);
        if (clean && clean.giver === sid) board[clean.template] = clean;
      } else {
        for (const t of templates()) {
          const o = raw?.[t.id];
          const untilKey = `${t.id}_until`;
          const until = raw?.[untilKey];
          if (o === null && typeof until === 'number' && Number.isFinite(until)) {
            board[t.id] = null;
            board[untilKey] = until;
            continue;
          }
          const clean = o && sanitizeContract(o, s);
          if (clean && clean.giver === sid && clean.template === t.id) board[t.id] = clean;
        }
      }
      s.contractOffers[sid] = board;
    }
    s.contract = sanitizeContract(d?.contract, s);
    if (s.contract && (!s.contract.status || s.contract.deadline == null)) s.contract = null;
    // An active hunt or escort whose marked party is missing from the saved world can't be completed: void it.
    const kind = s.contract && tpl(s.contract.template).kind;
    if (s.contract?.status === 'active' && kind !== 'delivery' && !s.parties.some((p) => p.id === s.contract.partyId)) s.contract = null;
    s.contractsDone = Number.isInteger(d?.contractsDone) && d.contractsDone >= 0 ? d.contractsDone : 0;
    const ids = [s.contract?.id || 0, ...Object.values(s.contractOffers).flatMap((b) => Object.values(b).map((o) => o?.id || 0))];
    s.nextContractId = Math.max(Number.isInteger(d?.nextContractId) ? d.nextContractId : 1, Math.max(...ids) + 1);
  }

  CL.contracts = {
    OFFER_REFRESH_DAYS,
    offersContracts,
    rollTroops,
    offersAt,
    offerAt,
    active,
    accept,
    onTargetDefeated,
    onTargetLost,
    onArrive,
    onCaravanArrived,
    tick,
    abandon,
    collect,
    daysLeft,
    summary,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
