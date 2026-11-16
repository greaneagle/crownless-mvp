/* Crownless contracts (GDD §4 repeatable work): one reusable lifecycle —
 *   offered → accepted (active) → target defeated (done) → collected at the giver
 *                               ↘ deadline passed (failed) / abandoned / target lost (void)
 * Gate C implements the bandit-hunt template; other kinds plug into start/onTarget hooks.
 * State: CL.campaign.contract (one at a time), contractOffers[settlementId], contractsDone. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const A = () => CL.autoresolve;

  const OFFER_REFRESH_DAYS = 3;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const tpl = (id) => CL.content.get('contracts', id);
  const settlement = (id) => CL.content.get('settlements', id);
  const offersContracts = (sid) => Boolean(sid && settlement(sid).services.includes('contracts'));

  // ---- Offers ----

  /** Build a band whose power is the template's multiple of the player's, from its troop pool. */
  function rollTroops(c, t) {
    const [lo, hi] = t.strength;
    const target = A().playerPower(c) * (lo + (hi - lo) * A().next(c));
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

  function makeOffer(c, sid) {
    const t = tpl('bandit_hunt');
    const s = settlement(sid);
    const troops = rollTroops(c, t);
    const size = Object.values(troops).reduce((a, b) => a + b, 0);
    const angle = A().next(c) * Math.PI * 2;
    const dist = t.distance[0] + (t.distance[1] - t.distance[0]) * A().next(c);
    return {
      id: c.nextContractId++,
      template: t.id,
      giver: sid,
      troops,
      x: clamp(s.mapX + Math.cos(angle) * dist, 5, 95),
      y: clamp(s.mapY + (Math.sin(angle) * dist) / 0.5636, 5, 95), // screen-proportional ring
      reward: {
        gold: t.reward.goldBase + t.reward.goldPerTroop * size,
        renown: t.reward.renown,
        xp: t.reward.xpBase + t.reward.xpPerTroop * size,
      },
      days: t.timeLimitDays,
      offeredUntil: c.day + OFFER_REFRESH_DAYS,
    };
  }

  /** The offer posted at a settlement, refreshed when stale. Null where there is no contracts board. */
  function offerAt(c, sid) {
    if (!offersContracts(sid) || !CL.realm.welcomes(c, sid)) return null; // no work for enemies
    let o = c.contractOffers[sid];
    if (!o || c.day >= o.offeredUntil) {
      o = makeOffer(c, sid);
      c.contractOffers[sid] = o;
    }
    return o;
  }

  // ---- Lifecycle ----

  const active = (c = CL.campaign) => c.contract;

  function accept(c, sid) {
    if (c.contract) return { ok: false, reason: 'Finish your current contract first' };
    const o = offerAt(c, sid);
    if (!o) return { ok: false, reason: 'No contracts here' };
    const t = tpl(o.template);
    // Spawn the marked band at the offer's camp.
    const p = CL.parties.spawn(c, t.band);
    Object.assign(p, { troops: { ...o.troops }, x: o.x, y: o.y, tx: null, ty: null, anchor: { x: o.x, y: o.y }, contractId: o.id });
    c.contract = { ...o, status: 'active', partyId: p.id, deadline: c.day + o.days };
    delete c.contractOffers[sid];
    CL.diag.log('info', 'Contract accepted', { id: o.id, giver: sid, troops: o.troops, reward: o.reward });
    return { ok: true };
  }

  function end(c, status, note) {
    const k = c.contract;
    CL.diag.log(status === 'collected' ? 'info' : 'warn', `Contract ${status}`, { id: k.id, note });
    c.contract = null;
  }

  /** The marked band was destroyed by the player. */
  function onTargetDefeated(c, p) {
    const k = c.contract;
    if (!k || k.partyId !== p.id || k.status !== 'active') return;
    k.status = 'done';
    CL.ui.message(tpl(k.template).done.replace('{giver}', settlement(k.giver).name));
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
    const p = c.contract && CL.parties.find(c, c.contract.partyId);
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

  /** Collect the reward at the settlement that offered the contract. */
  function collect(c) {
    const k = c.contract;
    if (k?.status !== 'done' || c.world.location !== k.giver) return null;
    c.gold += k.reward.gold;
    c.renown += k.reward.renown;
    const levels = CL.character.gainXp(k.reward.xp, c);
    c.contractsDone += 1;
    CL.realm.adjust(c, CL.realm.owner(k.giver, c), CL.realm.REP.help, 'contract'); // GDD §10: helping a faction
    end(c, 'collected');
    return { ...k.reward, levels };
  }

  /** Days left (negative once late), for the HUD. */
  const daysLeft = (c = CL.campaign) => (c.contract?.status === 'active' ? c.contract.deadline - c.day : null);

  // ---- Save ----

  function sanitizeContract(k, d) {
    if (!k || typeof k !== 'object' || !CL.content.table('contracts')[k.template] || !offersContracts(k.giver)) return null;
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    const troops = {};
    for (const [id, n] of Object.entries(k.troops || {})) {
      if (CL.content.table('troops')[id] && Number.isInteger(n) && n > 0) troops[id] = n;
    }
    if (!Object.keys(troops).length || !Number.isInteger(k.id)) return null;
    const r = k.reward || {};
    return {
      id: k.id,
      template: k.template,
      giver: k.giver,
      troops,
      x: clamp(num(k.x) ? k.x : 50, 0, 100),
      y: clamp(num(k.y) ? k.y : 50, 0, 100),
      reward: { gold: num(r.gold) ? Math.max(0, r.gold) : 0, renown: num(r.renown) ? r.renown : 0, xp: num(r.xp) ? r.xp : 0 },
      days: num(k.days) ? k.days : tpl(k.template).timeLimitDays,
      offeredUntil: num(k.offeredUntil) ? k.offeredUntil : d.day,
      ...(k.status ? { status: ['active', 'done'].includes(k.status) ? k.status : 'active' } : {}),
      ...(Number.isInteger(k.partyId) ? { partyId: k.partyId } : {}),
      ...(num(k.deadline) ? { deadline: k.deadline } : {}),
    };
  }

  function sanitize(s, d) {
    s.contractOffers = {};
    for (const [sid, o] of Object.entries(d?.contractOffers || {})) {
      const clean = sanitizeContract(o, s);
      if (clean && clean.giver === sid) s.contractOffers[sid] = clean;
    }
    s.contract = sanitizeContract(d?.contract, s);
    if (s.contract && (!s.contract.status || s.contract.deadline == null)) s.contract = null;
    // An active hunt whose band is missing from the saved world can't be completed: void it.
    if (s.contract?.status === 'active' && !s.parties.some((p) => p.id === s.contract.partyId)) s.contract = null;
    s.contractsDone = Number.isInteger(d?.contractsDone) && d.contractsDone >= 0 ? d.contractsDone : 0;
    const ids = [s.contract?.id || 0, ...Object.values(s.contractOffers).map((o) => o.id)];
    s.nextContractId = Math.max(Number.isInteger(d?.nextContractId) ? d.nextContractId : 1, Math.max(...ids) + 1);
  }

  CL.contracts = {
    OFFER_REFRESH_DAYS,
    offersContracts,
    rollTroops,
    offerAt,
    active,
    accept,
    onTargetDefeated,
    onTargetLost,
    tick,
    abandon,
    collect,
    daysLeft,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
