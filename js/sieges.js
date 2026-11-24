/* Crownless sieges on the map (P8-06a, design §17.3, §20.4–20.7, decision D-P8a): forts change hands in
 * play by rules you can read. `c.sieges` holds at most one siege a fort, and one a realm.
 *
 * - **Who:** a realm at war picks the nearest enemy fort it may besiege (never a story fort before
 *   Q4 ends, never a capital: CL.rights `besiege`) and two or more of its free lords gather there; the
 *   siege begins once their power is 1.5× the garrison's, or is given up after 5 days. The player
 *   besieges from the fort's own card (its realm at war with yours, or as an independent at the
 *   reputation cost of attacking that realm), with a preview of the odds and the time.
 * - **Encirclement:** the fort and its villages close their markets, recruiting and work to everyone
 *   but the besiegers; the defenders eat their food (a day a day; the stock is the fort's food policy,
 *   refilled 2 a day in peace).
 * - **Preparation:** ladders after a day, a ram after three. Each day the commander chooses: assault
 *   (the AI when its odds pass 60%, ladders ready), wait, or lift.
 * - **Assault** (simulated; the fought battle is P8-06b): the defenders behind walls count ×(1.2 + 0.4 ×
 *   walls), less 0.3 with a ram. Won, the fort falls; lost, the besiegers lose two in five and lift.
 * - **Surrender:** at no food, or when the odds are hopeless (90% against them), the garrison walks
 *   out and the castellan goes free.
 * - **Relief:** the defending realm's free lords within reach ride in; when they arrive the two sides
 *   fight it out (by power, as off-screen battles), and beaten besiegers lift.
 * - **Lifted** when the war ends, when the besiegers' power falls below the garrison's, after 20 days, or
 *   when the player commander rides off.
 * - **A fort taken** (`realm.transfer`): control passes and its villages with it; the old holder keeps a
 *   claim; the walls lose 40; it starts with half its taker's garrison and unrest 60 for 30 days; the
 *   conqueror makes the choice of D-P8f (P8-05: AI lords ask; you choose); the news and, if you were in
 *   it, the chronicle record it. A lord left with nothing campaigns on from their kin's seat or the
 *   capital (P8-01). Lords go home to refill after any siege.
 * - **Warnings:** your fort besieged is an urgent message (Ride back or Leave it to the castellan); a
 *   scout who sees the gathering warns you a day before.
 * - **Anti-snowball:** sieges only at war, wars end by exhaustion (siege losses count), one siege a
 *   realm, lords go home after, a taken fort is weak for a month. No free troops for anyone. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    gatherRatio: 1.5,
    lastFortRatio: 2,
    gatherDays: 5,
    minLords: 2,
    reach: 45, // map units: lords this near gather, or ride to relieve
    ladders: 1, // days
    ram: 3,
    assaultOdds: 0.6,
    lastAssaultOdds: 0.85, // P8-T: against a realm's last fort, after the ram (0.75 before 3.3.0: with the world's armies three times bigger, a last fort fell on one seed in six)
    hopeless: 0.9,
    walls: { base: 1.2, perWall: 0.4, ram: -0.3 },
    assaultLoss: { win: 0.3, lose: 0.4 },
    maxDays: 20,
    foodRefill: 2, // days of food a day, in peace
    takenGarrison: 0.5,
    takenUnrest: 60,
    takenWeakDays: 30,
    wallsLost: 40,
    camp: 2.5, // map units: where the besiegers sit
    logMax: 12,
    playerRep: -25, // an independent besieging a realm: as attacking a lord (P8-01)
  };

  const R = () => CL.realm;
  const A = () => CL.autoresolve;
  const place = (id) => CL.content.table('settlements')[id] || null;
  const placeName = (id) => place(id)?.name || id;
  const factionName = (f) => CL.realm.faction(f)?.name || 'a realm';
  const troopsPower = (t) => A().troopsPower(t || {});
  const PLAYER = 'player';

  const list = (c) => (c.sieges ||= []);
  /** The siege at a fort (any phase), or null. */
  const at = (c, sid) => list(c).find((s) => s.sid === sid) || null;
  /** Is a place shut by a siege: the fort encircled, or a village of it? */
  function shut(c, sid) {
    const h = R().holding(sid, c);
    const fort = h?.seat || sid;
    const s = at(c, fort);
    return s?.phase === 'encircled' ? s : null;
  }
  /** The siege a lord is in, or null. */
  const of = (c, pid) => list(c).find((s) => s.lords.includes(pid) || s.relief.includes(pid)) || null;

  const log = (s, day, text) => {
    s.log = [...(s.log || []), { day, text }].slice(-RULES.logMax);
  };

  // ---- Power and odds ----

  /** The defenders: the garrison, and what the walls are worth. */
  const defence = (c, s) => {
    const h = R().holding(s.sid, c);
    const ramDays = s.began != null ? c.day - s.began : 0;
    const wall = RULES.walls.base + RULES.walls.perWall * ((h.walls ?? 100) / 100) + (ramDays >= RULES.ram ? RULES.walls.ram : 0);
    return { power: troopsPower(h.garrison) * Math.max(1, wall), raw: troopsPower(h.garrison), wall: Math.max(1, wall) };
  };
  /** The besiegers: the lords' parties there, and the player's company if they lead it. */
  function attack(c, s) {
    let p = 0;
    for (const pid of s.lords) {
      const q = CL.lords.partyOf(c, pid);
      if (q && near(c, q, s.sid)) p += troopsPower(q.troops);
    }
    if (s.by === PLAYER) p += A().playerPower(c);
    return p;
  }
  const near = (_c, q, sid, r = RULES.camp * 2) => {
    const f = place(sid);
    return CL.world.mapDist(q.x, q.y, f.mapX, f.mapY) <= r;
  };
  /** The odds of an assault now (0 with no ladders yet). */
  function odds(c, s) {
    if (s.phase !== 'encircled' || c.day - s.began < RULES.ladders) return 0;
    return A().winChance(attack(c, s), defence(c, s).power, true);
  }
  /** How many days of food the fort has, and so how long starving it out would take. */
  const foodDays = (c, sid) => Math.max(0, R().holding(sid, c)?.food ?? 0);

  /** What besieging a fort would mean for the player, before they choose: { ok, why, lines }. */
  function preview(c, sid) {
    const right = CL.rights.may(c, PLAYER, 'besiege', sid);
    if (!right.ok) return { ok: false, why: right.why, lines: [] };
    CL.armies?.readyTown(c, sid); // P9-05: a capital's garrison and stores, as your army comes for it
    const h = R().holding(sid, c);
    const s = { sid, phase: 'encircled', began: c.day - RULES.ladders, lords: [], relief: [], by: PLAYER };
    const d = defence(c, s);
    const now = A().winChance(A().playerPower(c), d.power, true);
    const lines = [`The garrison: ${CL.fiefs.count(h.garrison)} soldiers (power ${d.raw.toFixed(1)}), ×${d.wall.toFixed(2)} behind walls at ${h.walls}%.`];
    lines.push(`Storming it with ladders (from tomorrow): about ${Math.round(now * 100)}% against your company's ${A().playerPower(c).toFixed(1)}; a ram after ${RULES.ram} days makes it easier.`);
    lines.push(`Starving it out: about ${Math.ceil(foodDays(c, sid))} days, if no relief comes.`);
    if (!CL.allegiance.serves(c)) lines.push(`You ride for no crown: the ${factionName(h.controller)} will count it an attack (${RULES.playerRep} standing).`);
    lines.push('Leaving the camp lifts the siege.');
    return { ok: true, why: '', lines };
  }

  // ---- Starting, gathering, lifting ----

  /** The player lays siege to a fort here. */
  function begin(c, sid) {
    const p = preview(c, sid);
    if (!p.ok || at(c, sid)) return null;
    const h = R().holding(sid, c);
    if (!CL.allegiance.serves(c)) R().adjust(c, h.controller, RULES.playerRep, 'laid siege');
    const realm = CL.allegiance.serves(c);
    c.nextSiegeId = (c.nextSiegeId || 0) + 1;
    const s = { id: c.nextSiegeId, sid, realm, by: PLAYER, lords: [], relief: [], phase: 'encircled', began: c.day, gatherBy: null, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
    list(c).push(s);
    // P9-05: your own army, with you at the gates, besieges with you.
    const army = CL.armies?.mine(c);
    if (army && army.phase !== 'rally') {
      s.army = army.id;
      s.lords = army.members.filter((pid) => CL.lords.partyOf(c, pid));
      for (const pid of s.lords) Object.assign(CL.lords.partyOf(c, pid), { intent: 'besiege', siegeId: s.id });
      army.siegeId = s.id;
      Object.assign(army, { objective: 'besiege', target: sid, set: c.day });
    }
    log(s, c.day, `You lay siege to ${placeName(sid)}.`);
    CL.news?.record(c, 'siege_begun', { place: sid, faction: h.controller, text: `${c.character?.name || 'A free company'} has laid siege to ${placeName(sid)}.` });
    CL.ui.message(`You lay siege to ${placeName(sid)}. Its gates are shut; its villages stop trading.`);
    return s;
  }

  /** A realm at war plans a siege: the nearest enemy fort it may besiege (or `prefer`, if it may), and its free lords near it. */
  function plan(c, f, prefer = null, { force = false } = {}) {
    if (list(c).some((s) => s.realm === f)) return null;
    // P9-03: your realm's sieges by your marshal's policy (or your own summons, `force`).
    if (!force && CL.founding && f === CL.founding.mine(c) && !R().realms().some((k) => CL.founding.mayPlan(c, f, k.id))) return null;
    // A realm holds what it took before it reaches for more: no new siege while a fort it took is weak (§20.7).
    if (Object.values(c.holdings).some((x) => x.controller === f && x.weakUntil > c.day)) return null;
    // P9-03: and land held of no realm, or of a realm founded in play that it does not recognise.
    const enemies = [...R().realms().map((k) => k.id), R().PLAYER].filter((e) => e !== f && R().siegeWar(c, f, e));
    if (!enemies.length) return null;
    const ruler = R().rulerOf(f, c);
    const home = place(R().capitalOf(f)) || place(c.people?.[ruler]?.home); // P9-04: a rising with no fort plans from its leader's home
    if (!home) return null;
    const forts = Object.keys(c.holdings).filter((sid) => c.holdings[sid].kind === 'fort' && enemies.includes(c.holdings[sid].controller) && (force || !CL.founding || CL.founding.mayPlan(c, f, c.holdings[sid].controller)) && (!force || !prefer || sid === prefer) && !at(c, sid) && CL.rights.may(c, someLord(c, f) || ruler, 'besiege', sid).ok);
    if (!forts.length) return null;
    const d = (sid) => CL.world.mapDist(home.mapX, home.mapY, place(sid).mapX, place(sid).mapY);
    // P8-07: a feud's claim is pressed in war: a fort one of the realm's lords claims comes first.
    // P9-L1: a claim the ruler presses (yours, P8-08, or a land-hungry lord's) before one merely held.
    const ours = (k) => c.people[k.by]?.realm === f && c.people[k.by].status === 'free';
    const claimed = (sid) => (sid === prefer || CL.claims?.pressedFor(c, sid, f) || R().claimsOn(sid, c).some((k) => ours(k) && k.pressed != null && c.day < k.pressed) ? 0 : R().claimsOn(sid, c).some(ours) ? 0.5 : 1);
    const sid = forts.sort((a, b) => claimed(a) - claimed(b) || d(a) - d(b))[0];
    const fort = place(sid);
    const marshal = CL.crowns?.holder(c, f, 'marshal');
    const lead = (q) => (q.lordId === marshal ? 0 : 1); // P9-01: the marshal is named first
    const nearby = CL.lords
      .riders(c)
      .filter((pid) => c.people[pid].realm === f && c.people[pid].status === 'free' && !of(c, pid) && !CL.armies?.of(c, pid))
      .map((pid) => CL.lords.partyOf(c, pid))
      .filter((q) => q && !CL.lords.thin(c, q) && CL.world.mapDist(q.x, q.y, fort.mapX, fort.mapY) <= RULES.reach * 2)
      .sort((a, b) => lead(a) - lead(b) || CL.world.mapDist(a.x, a.y, fort.mapX, fort.mapY) - CL.world.mapDist(b.x, b.y, fort.mapX, fort.mapY));
    // The ruler's summons (P8-07): each lord answers by their needs and opinions; who refuses stays home.
    const answer = CL.nobles ? CL.nobles.summon(c, f, sid, nearby.map((q) => q.lordId)) : { come: nearby.map((q) => q.lordId).slice(0, 4), refused: [] };
    const lords = answer.come.map((pid) => CL.lords.partyOf(c, pid));
    if (lords.length < RULES.minLords) return null;
    CL.nobles?.refusals(c, f, sid, answer.refused);
    c.nextSiegeId = (c.nextSiegeId || 0) + 1;
    const s = { id: c.nextSiegeId, sid, realm: f, by: 'ai', lords: lords.map((q) => q.lordId), relief: [], phase: 'gathering', began: null, gatherBy: c.day + RULES.gatherDays, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
    list(c).push(s);
    for (const q of lords) Object.assign(q, { intent: 'gather', siegeId: s.id });
    log(s, c.day, `The ${factionName(f)} gather their lords against ${placeName(sid)}.`);
    CL.nobles?.summonPlayer(c, f, s); // a vassal of the realm is summoned too
    CL.founding?.onSiege(c, s); // P9-03: your seat besieged is an alert
    CL.diag.log('info', 'Siege planned', { realm: f, fort: sid, lords: s.lords });
    return s;
  }
  const someLord = (c, f) => Object.keys(c.people || {}).find((id) => c.people[id].realm === f && !R().rules(id, c));

  /** P9-05: an army arrived before a fort or a capital lays siege to it: its lords there, gathered at once. */
  function byArmy(c, army, sid) {
    const h = R().holding(sid, c);
    if (!h || h.kind === 'village' || at(c, sid) || list(c).some((s) => s.realm === army.realm) || R().locked(c, sid) || !R().siegeWar(c, army.realm, h.controller)) return null;
    CL.armies.readyTown(c, sid);
    const lords = army.members.filter((pid) => CL.lords.partyOf(c, pid));
    if (lords.length < RULES.minLords) return null;
    c.nextSiegeId = (c.nextSiegeId || 0) + 1;
    const s = { id: c.nextSiegeId, sid, realm: army.realm, by: army.commander === PLAYER ? PLAYER : 'ai', army: army.id, lords, relief: [], phase: 'gathering', began: null, gatherBy: c.day + 2, lastDay: Math.floor(c.day), steppedTo: c.day, log: [] };
    list(c).push(s);
    for (const pid of lords) Object.assign(CL.lords.partyOf(c, pid), { intent: 'gather', siegeId: s.id });
    log(s, c.day, `The ${factionName(army.realm)}'s army comes before ${placeName(sid)}.`);
    if (CL.armies.riding(c, army)) log(s, c.day, 'You ride with it.');
    CL.founding?.onSiege(c, s);
    CL.diag.log('info', 'Siege by an army', { realm: army.realm, fort: sid, army: army.id });
    return s;
  }
  /** A realm's last fort (a fort), or its last holding at all (a capital): the hardest siege (§20.7). */
  function lastHeld(c, sid) {
    const h = R().holding(sid, c);
    if (h.kind === 'town') return Object.values(c.holdings).filter((x) => x.kind !== 'village' && x.controller === h.controller).length <= 1;
    return Object.values(c.holdings).filter((x) => x.kind === 'fort' && x.controller === h.controller).length <= 1;
  }

  /** End a siege: its lords go home to refill (lifted, taken or surrendered). */
  function end(c, s, how, ctx = {}) {
    const i = list(c).indexOf(s);
    if (i >= 0) list(c).splice(i, 1);
    CL.nobles?.onSiegeEnd(c, s, how, ctx); // who fought beside whom, who relieved whom (P8-07)
    for (const pid of [...s.lords, ...s.relief]) {
      const q = CL.lords.partyOf(c, pid);
      if (q) Object.assign(q, { intent: q.armyId != null ? 'army' : 'home', siegeId: null, tx: null, ty: null }); // P9-05: an army's lords stay with it
    }
    CL.armies?.onSiegeEnd(c, s, how);
    if (how === 'lifted') {
      CL.news?.record(c, 'siege_lifted', { place: s.sid, text: `The siege of ${placeName(s.sid)} is lifted.` });
      if (s.by === PLAYER) CL.ui.message(`The siege of ${placeName(s.sid)} is lifted.`);
    }
    CL.diag.log('info', 'Siege ended', { fort: s.sid, how });
    return how;
  }

  // ---- Taking the fort ----

  /** The fort falls (stormed or surrendered): control passes, and everything that follows from it. */
  function take(c, s, how) {
    const h = R().holding(s.sid, c);
    const taker = s.by === PLAYER ? R().rules(PLAYER, c) || CL.allegiance.serves(c) || null : s.realm; // P9-03: your own realm first
    const commander = s.by === PLAYER ? PLAYER : s.lords.find((pid) => CL.lords.partyOf(c, pid)) || s.lords[0];
    const was = { holder: h.holder, controller: h.controller };
    const castellan = h.castellan;
    // P8-08: a castellan of yours walks out of a surrender, but is taken with a fort stormed (freed when it is retaken).
    if (castellan && was.holder === PLAYER && how === 'stormed') {
      h.heldCastellan = castellan;
      h.castellan = null;
      h.castellanLeaving = false;
    }
    if (taker) R().transfer(c, s.sid, { controller: taker, sovereign: taker, by: commander, reason: how === 'stormed' ? 'stormed' : 'surrendered', capital: s.army != null });
    // Weak and restless for a month; the walls broken.
    h.walls = Math.max(0, (h.walls ?? 100) - (how === 'stormed' ? RULES.wallsLost : RULES.wallsLost / 2));
    if (h.garrison) {
      for (const id of Object.keys(h.garrison)) {
        h.garrison[id] = Math.floor(h.garrison[id] * RULES.takenGarrison); // half its taker's garrison
        if (!h.garrison[id]) delete h.garrison[id];
      }
    }
    h.unrest = Math.max(h.unrest, RULES.takenUnrest);
    h.weakUntil = c.day + RULES.takenWeakDays;
    h.food = Math.min(h.food ?? 0, 3);
    end(c, s, how, { was: was.holder, wasRealm: R().person(was.holder, c)?.realm || null, commander });
    if (h.controller !== was.controller) CL.armies?.onTaken(c, s.sid, was.controller); // P9-05: a seat moved, or a realm gone
    const words = `${placeName(s.sid)} has ${how === 'stormed' ? 'been stormed' : 'surrendered'}${taker ? `: the ${factionName(taker)} hold it now` : ''}.`;
    CL.news?.record(c, 'fort_fell', { place: s.sid, faction: taker, text: words });
    if (s.by === PLAYER || was.holder === PLAYER) CL.chronicle?.add(c, { day: c.day, kind: 'holding', place: s.sid, event: was.holder === PLAYER ? 'lost' : s.by === PLAYER ? 'changed' : 'changed', by: taker || was.controller });
    if (castellan && was.holder === PLAYER) CL.ui.message(how === 'surrendered' ? `${castellan.name} walks out with the garrison and rejoins you.` : `${castellan.name} is taken prisoner as ${placeName(s.sid)} falls. Retake it to free them.`);
    // P9-03: with no realm behind you, a fort you claim is yours again, held of no realm.
    if (!taker && s.by === PLAYER) CL.claims?.onRetakeAlone(c, s.sid);
    // The conqueror's choice (D-P8f, P8-05): AI lords ask; you choose. P8-08: a claim your liege backs is yours again at once.
    if (taker) {
      if (s.by === PLAYER && CL.claims?.onRetake(c, s.sid)) return how;
      if (s.by === PLAYER) {
        if (CL.game.mode === 'map' || CL.game.mode === 'settlement') CL.ui.openConquest?.(s.sid);
        else CL.fiefs.conquered(c, s.sid, PLAYER, 'ask');
      } else CL.fiefs.conquered(c, s.sid, commander, ...(CL.nobles?.conquerorChoice(c, commander, s.sid) || ['ask'])); // the lord's own choice (P8-07)
    }
    return how;
  }

  /** The assault, simulated: won, the fort falls; lost, the besiegers lose two in five and lift. */
  function assault(c, s) {
    const pa = attack(c, s);
    const d = defence(c, s);
    const win = A().next(c) < A().winChance(pa, d.power, true);
    const loss = win ? RULES.assaultLoss.win : RULES.assaultLoss.lose;
    let lost = 0;
    for (const pid of s.lords) {
      const q = CL.lords.partyOf(c, pid);
      if (!q) continue;
      const fallen = A().rollFallen(c, A().expand(q.troops), loss, true);
      A().removeTroops(q.troops, fallen);
      lost += fallen.length;
      if (!CL.parties.troopCount(q)) CL.lords.beaten(c, q, R().holding(s.sid, c).controller);
    }
    const h = R().holding(s.sid, c);
    const defenders = A().expand(h.garrison || {});
    const killed = win ? defenders : A().rollFallen(c, defenders, A().lossChance(A().WINNER_LOSS, d.power, pa), true);
    A().removeTroops(h.garrison || {}, killed);
    lost += killed.length;
    if (s.realm && R().isRealm(h.controller)) R().clashed(c, s.realm, h.controller, lost, { x: place(s.sid).mapX, y: place(s.sid).mapY });
    log(s, c.day, win ? `${placeName(s.sid)} is stormed.` : `The assault on ${placeName(s.sid)} is thrown back.`);
    if (win) return { win, how: take(c, s, 'stormed') };
    end(c, s, 'lifted');
    return { win, how: 'repulsed' };
  }

  /** The player's assault: the company's own losses on the roster (a simulated fight, P8-06b fights it). */
  function playerAssault(c) {
    const s = list(c).find((x) => x.by === PLAYER);
    if (!s || odds(c, s) === 0) return null;
    const healthy = CL.party.healthySoldiers().map((x) => x.id);
    const pa = attack(c, s);
    const d = defence(c, s);
    const win = A().next(c) < A().winChance(pa, d.power, true);
    const fallen = A().rollFallen(c, healthy, A().lossChance(win ? A().WINNER_LOSS : A().LOSER_LOSS, pa, d.power), win);
    const { killed, wounded } = CL.surgeon.triage(c, fallen.map((id) => ({ id, roll: A().next(c) })));
    c.roster = c.roster.filter((x) => !killed.includes(x.id));
    for (const x of c.roster) if (wounded.includes(x.id)) x.woundedUntil = c.day + CL.surgeon.woundDays(c);
    const h = R().holding(s.sid, c);
    const defenders = A().expand(h.garrison || {});
    A().removeTroops(h.garrison || {}, win ? defenders : A().rollFallen(c, defenders, A().lossChance(A().WINNER_LOSS, d.power, pa), true));
    c.battles++;
    if (win) {
      c.victories++;
      c.renown += 15;
      take(c, s, 'stormed');
    } else end(c, s, 'lifted');
    const text = win ? `${placeName(s.sid)} is yours: stormed, with ${killed.length} of yours dead and ${wounded.length} wounded.` : `The assault on ${placeName(s.sid)} is thrown back: ${killed.length} dead, ${wounded.length} wounded. The siege is lifted.`;
    CL.ui.message(text);
    return { win, killed, wounded, text };
  }

  /** How far the preparation has come: ladders (one a day, three at most) and the ram (after three days). */
  function prepared(c, s) {
    const days = s.began != null ? c.day - s.began : 0;
    return { ladders: Math.max(1, Math.min(3, Math.floor(days))), ram: days >= RULES.ram };
  }

  /** P8-06b: your assault, fought on the walls (the setup that makes sense there: infantry at the ladders). */
  function storm(c) {
    const s = list(c).find((x) => x.by === PLAYER);
    if (!s || odds(c, s) === 0 || !CL.assault) return null;
    const enc = CL.assault.encounter(c, s.sid, 'attack', prepared(c, s));
    CL.combat.startBattle(enc, { plan: CL.prep.plan('balanced', enc.mapDef) });
    return enc;
  }

  /** P8-06b: the besiegers storm the fort you are in: you defend its walls, the garrison beside you. */
  function defend(c, s) {
    const troops = {};
    for (const pid of s.lords) {
      const q = CL.lords.partyOf(c, pid);
      if (q) for (const [id, n] of Object.entries(q.troops)) troops[id] = (troops[id] || 0) + n;
    }
    const enc = CL.assault.encounter(c, s.sid, 'defend', { ...prepared(c, s), enemyTroops: troops });
    enc.garrison = { ...(R().holding(s.sid, c).garrison || {}) };
    CL.ui.message(`The ${factionName(s.realm)} storm the walls of ${placeName(s.sid)}!`);
    CL.combat.startBattle(enc, { plan: CL.prep.plan('defensive', enc.mapDef) });
    return enc;
  }

  /** The player lifts their own siege. */
  function lift(c) {
    const s = list(c).find((x) => x.by === PLAYER);
    return s ? end(c, s, 'lifted') : null;
  }

  // ---- Relief ----

  /** The defending realm's free lords within reach ride to relieve it. */
  function callRelief(c, s) {
    const f = R().holding(s.sid, c).controller;
    const fort = place(s.sid);
    // A realm's last fort: every free lord of it rides home to save it (§20.7: its lords nearer home).
    const last = Object.values(c.holdings).filter((x) => x.kind === 'fort' && x.controller === f).length <= 1;
    for (const pid of CL.lords.riders(c)) {
      if (c.people[pid].realm !== f || c.people[pid].status !== 'free' || of(c, pid) || CL.armies?.of(c, pid)) continue; // an army relieves as one (P9-05)
      const q = CL.lords.partyOf(c, pid);
      if (!q || CL.lords.thin(c, q) || (!last && CL.world.mapDist(q.x, q.y, fort.mapX, fort.mapY) > RULES.reach)) continue;
      if (!last && CL.nobles && !CL.nobles.answersRelief(c, pid, s.sid)) continue; // the call for relief, answered by the model (P8-07)
      s.relief.push(pid);
      Object.assign(q, { intent: 'relief', siegeId: s.id });
      log(s, c.day, `${R().titled(pid, c)} rides to relieve ${placeName(s.sid)}.`);
    }
  }

  /** Relief that has arrived fights the besiegers: by power, as off-screen battles. */
  function relieve(c, s) {
    const here = s.relief.map((pid) => CL.lords.partyOf(c, pid)).filter((q) => q && near(c, q, s.sid));
    if (!here.length) return false;
    const pr = here.reduce((n, q) => n + troopsPower(q.troops), 0);
    const pb = attack(c, s);
    const reliefWins = A().next(c) < A().winChance(pr, pb);
    const losers = reliefWins ? s.lords.map((pid) => CL.lords.partyOf(c, pid)).filter(Boolean) : here;
    const winners = reliefWins ? here : s.lords.map((pid) => CL.lords.partyOf(c, pid)).filter(Boolean);
    const loserRealm = reliefWins ? s.realm : R().holding(s.sid, c).controller;
    const winnerRealm = reliefWins ? R().holding(s.sid, c).controller : s.realm;
    let lost = 0;
    for (const q of winners) {
      const fallen = A().rollFallen(c, A().expand(q.troops), A().lossChance(A().WINNER_LOSS, reliefWins ? pr : pb, reliefWins ? pb : pr), true);
      A().removeTroops(q.troops, fallen);
      lost += fallen.length;
    }
    for (const q of losers) {
      lost += CL.parties.troopCount(q);
      CL.lords.beaten(c, q, winnerRealm);
    }
    if (R().isRealm(loserRealm) && R().isRealm(winnerRealm)) R().clashed(c, winnerRealm, loserRealm, lost, { x: place(s.sid).mapX, y: place(s.sid).mapY });
    CL.news?.record(c, 'siege_relieved', { place: s.sid, text: reliefWins ? `${placeName(s.sid)} is relieved: the besiegers are broken.` : `The relief of ${placeName(s.sid)} is beaten off.` });
    if (reliefWins) {
      end(c, s, 'relieved');
      return true;
    }
    s.relief = s.relief.filter((pid) => CL.lords.partyOf(c, pid));
    return false;
  }

  // ---- Time ----

  /** Hour by hour (from js/party.js advanceDays): every siege's food, preparation, choices and relief. */
  function step(c) {
    // Food comes back in peace.
    for (const [sid, h] of Object.entries(c.holdings || {})) {
      if (h.kind !== 'fort' && !(h.kind === 'town' && h.food != null)) continue; // P9-05: a town an army came for
      if (h.food == null) h.food = h.policies?.food ?? 14;
      if (at(c, sid)?.phase !== 'encircled') {
        const last = h.fedTo ?? c.day;
        h.food = Math.min(h.policies?.food ?? 14, h.food + Math.max(0, c.day - last) * RULES.foodRefill);
      }
      h.fedTo = c.day;
    }
    for (const s of [...list(c)]) stepOne(c, s);
    CL.armies?.step(c); // P9-05: armies march, eat, fight and lay sieges
    // Realms at war raise an army (P9-05), or (with no armies) plan their next siege (once a day each).
    const today = Math.floor(c.day);
    if (c.siegePlanned !== today) {
      c.siegePlanned = today;
      for (const k of R().realms()) (CL.armies ? CL.armies.plan : plan)(c, k.id);
    }
  }

  function stepOne(c, s) {
    const h = R().holding(s.sid, c);
    const defender = h.controller;
    if (s.realm && !R().siegeWar(c, s.realm, defender) && s.by !== PLAYER) return end(c, s, 'lifted'); // the war is over (P9-03: or the land is recognised)
    if (s.realm === defender) return end(c, s, 'lifted'); // it changed hands some other way
    if (s.by === PLAYER && (c.world.location !== s.sid || (R().rules(PLAYER, c) || CL.allegiance.serves(c)) !== s.realm)) return end(c, s, 'lifted'); // you rode off
    if (s.phase === 'gathering') {
      const there = s.lords.map((pid) => CL.lords.partyOf(c, pid)).filter((q) => q && near(c, q, s.sid));
      // A realm's last fort is harder to besiege: twice its garrison's power, not 1.5× (§20.7).
      const last = lastHeld(c, s.sid);
      if (attack(c, s) >= (last ? RULES.lastFortRatio : RULES.gatherRatio) * defence(c, s).raw && there.length >= RULES.minLords) {
        s.phase = 'encircled';
        s.began = c.day;
        log(s, c.day, `${placeName(s.sid)} is encircled.`);
        CL.news?.record(c, 'siege_begun', { place: s.sid, faction: defender, text: `The ${factionName(s.realm)} have laid siege to ${placeName(s.sid)}.` });
        for (const q of there) q.intent = 'besiege';
        callRelief(c, s);
        if (h.holder === PLAYER) alarm(c, s);
      } else if (c.day >= s.gatherBy) return end(c, s, 'abandoned');
      else warnGathering(c, s);
      return;
    }
    // Encircled: the defenders eat, hour by hour.
    const days = Math.max(0, c.day - (s.steppedTo ?? c.day));
    s.steppedTo = c.day;
    h.food = Math.max(0, (h.food ?? 0) - days); // a day of food a day
    if (relieve(c, s)) return;
    const today = Math.floor(c.day);
    if (s.lastDay === today) return;
    s.lastDay = today;
    // The day's choice. P8-T: a realm's last fort holds out longer: no surrender for hopeless odds
    // (only hunger), and its besiegers wait for the ram and better odds, so the relief can come.
    const o = A().winChance(attack(c, s), defence(c, s).power, true);
    const lastFort = lastHeld(c, s.sid);
    if (h.food <= 0 || (!lastFort && c.day - s.began >= RULES.ladders && o >= RULES.hopeless)) {
      log(s, c.day, `${placeName(s.sid)} surrenders.`);
      return take(c, s, 'surrendered');
    }
    if (s.by === PLAYER) return;
    if (attack(c, s) < defence(c, s).raw || c.day - s.began > RULES.maxDays) return end(c, s, 'lifted');
    if (c.day - s.began >= (lastFort ? RULES.ram : RULES.ladders) && o >= (lastFort ? RULES.lastAssaultOdds : RULES.assaultOdds)) {
      // P8-06b: you are in the fort: the assault is fought, and you defend the walls.
      if (c.world.location === s.sid && ['settlement', 'map', 'town'].includes(CL.game.mode) && CL.assault) return defend(c, s);
      return assault(c, s);
    }
  }

  /** Your fort is besieged: an urgent message (Ride back, or leave it to the castellan). */
  function alarm(c, s) {
    s.alarmed = true;
    CL.ui.message(`${placeName(s.sid)} is besieged by the ${factionName(s.realm)}! It has food for ${Math.ceil(fortOf(c, s).food)} days.`);
    if (CL.game.mode === 'map') {
      s.alarmSeen = true;
      CL.ui.openSiegeAlarm?.(s.sid);
    }
  }
  const fortOf = (c, s) => R().holding(s.sid, c);
  /** A scout who sees lords gathering against your fort warns you a day ahead. */
  function warnGathering(c, s) {
    if (s.warned || fortOf(c, s).holder !== PLAYER || !CL.scout?.get(c)) return;
    if (!s.lords.some((pid) => CL.lords.partyOf(c, pid) && CL.sight.playerSees(c, CL.lords.partyOf(c, pid)))) return;
    s.warned = true;
    CL.ui.message(`Your scout: the ${factionName(s.realm)}'s lords are gathering against ${placeName(s.sid)}.`);
  }

  /** Where a lord in a siege rides (js/parties.js): the camp, or the fort to relieve. */
  function postFor(c, p) {
    const s = list(c).find((x) => x.id === p.siegeId);
    if (!s) return null;
    const f = place(s.sid);
    const k = (s.lords.indexOf(p.lordId) + 1) * 1.7;
    return [f.mapX + Math.cos(k) * RULES.camp, f.mapY + Math.sin(k) * RULES.camp];
  }

  // ---- Saves ----

  function sanitize(s, d) {
    const num = (n) => typeof n === 'number' && Number.isFinite(n);
    s.sieges = [];
    s.nextSiegeId = Number.isInteger(d?.nextSiegeId) ? d.nextSiegeId : 0;
    const lordOK = (pid) => s.people?.[pid]?.status === 'free' && s.parties.some((q) => q.lordId === pid);
    for (const x of Array.isArray(d?.sieges) ? d.sieges : []) {
      const hh = s.holdings?.[x?.sid];
      if ((hh?.kind !== 'fort' && hh?.kind !== 'town') || s.sieges.some((y) => y.sid === x.sid || (x.realm && y.realm === x.realm)) || !['gathering', 'encircled'].includes(x.phase)) continue;
      if (x.by !== PLAYER && x.by !== 'ai') continue;
      if (x.by === 'ai' && !R().isRealm(x.realm)) continue;
      const siege = {
        id: Number.isInteger(x.id) ? x.id : ++s.nextSiegeId,
        sid: x.sid,
        realm: R().isRealm(x.realm) ? x.realm : null,
        by: x.by,
        lords: (Array.isArray(x.lords) ? x.lords : []).filter(lordOK),
        relief: (Array.isArray(x.relief) ? x.relief : []).filter(lordOK),
        phase: x.phase,
        began: num(x.began) ? x.began : x.phase === 'encircled' ? s.day : null,
        gatherBy: num(x.gatherBy) ? x.gatherBy : null,
        lastDay: Number.isInteger(x.lastDay) ? x.lastDay : Math.floor(s.day),
        steppedTo: num(x.steppedTo) ? x.steppedTo : s.day,
        log: (Array.isArray(x.log) ? x.log : []).filter((l) => l && num(l.day) && typeof l.text === 'string').slice(-RULES.logMax),
      };
      if (Number.isInteger(x.army)) siege.army = x.army; // P9-05: checked again by js/armies.js sanitize
      if (x.alarmed === true) siege.alarmed = true;
      if (x.warned === true) siege.warned = true;
      s.nextSiegeId = Math.max(s.nextSiegeId, siege.id);
      s.sieges.push(siege);
    }
    // A lord's party remembers its siege only if the siege remembers it.
    for (const q of s.parties) {
      if (!q.lordId) continue;
      const siege = s.sieges.find((y) => y.lords.includes(q.lordId) || y.relief.includes(q.lordId));
      if (siege) q.siegeId = siege.id;
      else {
        delete q.siegeId;
        if (['gather', 'besiege', 'relief'].includes(q.intent)) q.intent = 'home';
      }
    }
    for (const hh of Object.values(s.holdings || {})) {
      if (hh.kind !== 'fort' && hh.kind !== 'town') continue;
      const e = d?.holdings?.[Object.keys(s.holdings).find((k) => s.holdings[k] === hh)];
      if (hh.kind === 'town' && !num(e?.food)) {
        hh.food = null;
        continue;
      }
      hh.food = num(e?.food) ? Math.max(0, Math.min(60, e.food)) : (hh.policies?.food ?? 14);
      if (num(e?.fedTo)) hh.fedTo = e.fedTo;
      else delete hh.fedTo;
      if (num(e?.weakUntil) && e.weakUntil > s.day) hh.weakUntil = e.weakUntil;
    }
    s.siegePlanned = Number.isInteger(d?.siegePlanned) ? d.siegePlanned : null;
  }

  CL.sieges = { RULES, list, at, shut, of, defence, attack, odds, foodDays, preview, begin, plan, byArmy, lastHeld, end, take, assault, playerAssault, prepared, storm, defend, lift, callRelief, relieve, step, postFor, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
