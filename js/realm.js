/* Crownless realm: faction reputation and fort ownership (GDD §10 Reputation, §12 Territory).
 *
 * Reputation: one hidden score per kingdom in [-100, 100], shown as Friendly / Neutral / Hostile
 * (hostile below -25, friendly above +24). Helping a faction +10, attacking its patrols or
 * caravans -15, major story decisions ±25. The Road Reavers are not a diplomatic faction.
 *
 * Holdings (P8-02, design §17.1, decisions D-P8b–D-P8g): every settlement of a kingdom (not the free
 * city) is a holding in `c.holdings`: { kind, sovereign, holder, controller, seat, administrator,
 * claims }. The sovereign is the realm that claims it, the holder the person granted it (a lord, or
 * the ruler when no lord holds it: never vacant), the controller who has its gates now (a village:
 * its seat's), and claims the grievances of those who lost it. `realm.transfer` is the one way a
 * holding changes hands; a seat's villages go with it. `owner(sid)` keeps its old meaning: who
 * controls it now. Recruits, garrison, patrols, markets and the map follow the owner.
 *
 * People (P8-02): the world package's `nobles` become `c.people` (`person:<n>`), with their realm,
 * home, kin and traits. A ruler is an office (`c.rulers[realm]`), not a kind of person, and rank is
 * never stored: a lord is "great", "lesser" or "landless" by what they hold now (`fiefsOf`).
 *
 * Relations (W-07): every pair of kingdoms is at 'peace', in 'tension' or at 'war' (`c.relations`,
 * keyed "a|b" with the ids in order: { state, since, heat, losses, lastClash, incidentUntil }).
 * Patrols of kingdoms at peace that meet may cause a border incident, which can sour it to tension;
 * in tension or at war their patrols clash (js/parties.js), each clash heating tension towards war;
 * quiet days cool tension back to peace, and a long or costly war ends in an exhausted truce. The
 * world's data sets the starting states; a pair marked `story` keeps its state until the story's
 * ending, which sets it (decision D-W5: the March pair stays in tension until Q4 ends). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const REP = { min: -100, max: 100, hostileBelow: -25, friendlyAbove: 24, help: 10, bandits: 2, attack: -15, story: 25 };
  const FRIENDLY_CAP_BONUS = 2; // GDD §5 party cap: faction_bonus 0 or 2 for Friendly status
  const STANDING_LABEL = { friendly: 'Friendly', neutral: 'Neutral', hostile: 'Hostile' };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const settlement = (id) => CL.content.get('settlements', id);
  /** A settlement, or null when this world has none of that id (the people's data may name places of a bigger world). */
  const place = (id) => (typeof id === 'string' && CL.content.table('settlements')[id]) || null;
  /** This world's kingdoms (W-04: the world package's `factions`, in order). */
  const kingdoms = () => (CL.world.map().factions || []).map((id) => CL.content.get('factions', id));
  /** The faction of road bands and sell-swords (the world's `outlaws`): never a kingdom. */
  const outlaws = () => CL.world.map().outlaws;
  const isKingdom = (id) => kingdoms().some((f) => f.id === id);
  const forts = () => Object.values(CL.content.table('settlements')).filter((s) => s.type === 'fort');

  const STATES = ['peace', 'tension', 'war'];
  // Days and counts for the relations rules (W-07).
  const RELATIONS = {
    incidentChance: 0.25, // a meeting of patrols at peace sours it to tension
    incidentEvery: 1, // days between incidents a pair can have
    warHeat: 4, // clashes in tension that tip it into war
    coolDays: 8, // quiet days that take one clash off the heat
    calmDays: 30, // a quiet tension this long, with no heat, eases to peace
    minWar: 12, // a war lasts at least this many days…
    exhaustion: 12, // …and ends once this many soldiers have fallen in its clashes
    maxWar: 45, // or after this long, whatever the losses
    truce: 30, // P8-06a: days after a war ends before the next can begin
  };
  function defaultReputation() {
    const r = {};
    for (const f of kingdoms()) r[f.id] = clamp(f.initialReputation || 0, REP.min, REP.max);
    return r;
  }

  function defaultOwners() {
    const o = {};
    for (const s of forts()) o[s.id] = s.ownerFaction;
    return o;
  }

  // ---- Reputation ----

  const score = (c, f) => c.reputation?.[f] ?? 0;

  /** 'friendly' | 'neutral' | 'hostile'; null for the Road Reavers (always hostile, never diplomatic). */
  function standing(c, f) {
    if (!isKingdom(f)) return null;
    const s = score(c, f);
    if (s < REP.hostileBelow) return 'hostile';
    if (s > REP.friendlyAbove) return 'friendly';
    return 'neutral';
  }

  const isHostile = (c, f) => standing(c, f) === 'hostile';

  /** Change a kingdom's opinion of the player. Announces a change of standing. Returns the new score. */
  function adjust(c, f, delta, reason = '') {
    if (!isKingdom(f) || !delta) return score(c, f);
    const before = standing(c, f);
    c.reputation[f] = clamp(score(c, f) + delta, REP.min, REP.max);
    const after = standing(c, f);
    const name = CL.content.get('factions', f).name;
    CL.diag.log('info', 'Reputation', { faction: f, delta, score: c.reputation[f], reason });
    if (after !== before) {
      const text = {
        friendly: `The ${name} now count you a friend.`,
        neutral: `The ${name} regard you as neutral again.`,
        hostile: `The ${name} now treat you as an enemy!`,
      }[after];
      CL.ui.message(text);
    }
    return c.reputation[f];
  }

  /** GDD §5: +2 party slots while Friendly with any kingdom. */
  const capBonus = (c) => (kingdoms().some((f) => standing(c, f.id) === 'friendly') ? FRIENDLY_CAP_BONUS : 0);

  // ---- Territory ----

  // ---- People (P8-02) ----

  const TIES = ['parent', 'child', 'sibling', 'cousin', 'spouse'];
  const RETURN_TIE = { parent: 'child', child: 'parent', sibling: 'sibling', cousin: 'cousin', spouse: 'spouse' };
  const STATUS = ['free', 'captive', 'wounded'];
  const FIEF_CAP = 3; // holdings a lord may have (D-P8d); the ruler's office is not capped
  const PLAYER = 'player';
  const TIE_WORD = {
    parent: { male: 'father', female: 'mother' },
    child: { male: 'son', female: 'daughter' },
    sibling: { male: 'brother', female: 'sister' },
    cousin: { male: 'cousin', female: 'cousin' },
    spouse: { male: 'husband', female: 'wife' },
  };

  /** Kingdoms with land and lords: every kingdom but a free city (Merrow). */
  const realms = () => kingdoms().filter((f) => !f.freeCity);
  const isRealm = (id) => realms().some((f) => f.id === id);
  /** The world's nobles (data/world_map.js `nobles`), of this world's realms. */
  const nobles = () => (CL.world.map().nobles || []).filter((n) => isRealm(n.realm));
  const realmSettlements = (f) => Object.values(CL.content.table('settlements')).filter((s) => s.ownerFaction === f);
  /** A realm's capital: its town (else its first fort). */
  const capitalOf = (f) => {
    const own = realmSettlements(f);
    return (own.find((s) => s.type === 'town') || own.find((s) => s.type === 'fort') || own[0] || null)?.id || null;
  };

  /**
   * The people at the start of a campaign, from the world data: `person:1`… in the data's order, and
   * a plain ruler for any realm whose data names none (a test world's third kingdom).
   * @returns {{ people: Record<string, any>, rulers: Record<string, string>, nextPersonId: number, byKey: Record<string, string> }}
   */
  function startingPeople() {
    const list = nobles().map((n) => ({ ...n }));
    for (const f of realms()) {
      if (list.some((n) => n.realm === f.id && n.ruler)) continue;
      const k = CL.content.table('cultures')[f.culture] || Object.values(CL.content.table('cultures'))[0];
      list.push({ id: `${f.id}_ruler`, name: `${k.given[0]} of ${place(capitalOf(f))?.placeName || f.short || f.name}`, gender: 'male', realm: f.id, ruler: true, home: capitalOf(f), holds: [], kin: [], traits: '' });
    }
    /** @type {Record<string, string>} */
    const byKey = {};
    list.forEach((n, i) => {
      byKey[n.id] = `person:${i + 1}`;
    });
    /** @type {Record<string, any>} */
    const people = {};
    /** @type {Record<string, string>} */
    const rulers = {};
    for (const n of list) {
      const id = byKey[n.id];
      people[id] = {
        id,
        key: n.id,
        name: n.name,
        gender: n.gender === 'female' ? 'female' : 'male',
        realm: n.realm,
        home: place(n.home) ? n.home : capitalOf(n.realm),
        kin: (n.kin || []).filter((k) => byKey[k.id]).map((k) => ({ person: byKey[k.id], tie: k.tie })),
        traits: typeof n.traits === 'string' ? n.traits : '',
        status: 'free',
        heldBy: null,
      };
      if (n.ruler && !rulers[n.realm]) rulers[n.realm] = id;
    }
    return { people, rulers, nextPersonId: list.length + 1, byKey };
  }

  /** @param {string} id @param {Campaign} [c] */
  const person = (id, c = CL.campaign) => (id === PLAYER ? playerPerson(c) : c?.people?.[id] || null);
  /** The hero as a person of the realms: no realm yet (allegiance comes in P8-04). @param {Campaign} c */
  const playerPerson = (c) => ({ id: PLAYER, name: c?.character?.name || 'You', gender: ['woman', 'female'].includes(c?.character?.gender) ? 'female' : 'male', realm: null, home: null, kin: [], traits: '', status: 'free', heldBy: null });
  /** Who holds a realm's ruler's office now. @param {string} f @param {Campaign} [c] */
  const rulerOf = (f, c = CL.campaign) => c?.rulers?.[f] || null;
  /** The realm a person rules, or null. @param {string} id @param {Campaign} [c] */
  const rules = (id, c = CL.campaign) => Object.keys(c?.rulers || {}).find((f) => c.rulers[f] === id) || null;
  /** "lord" or "lady", "son" or "daughter"… @param {string} tie @param {any} p */
  const tieWord = (tie, p) => TIE_WORD[tie]?.[p?.gender === 'female' ? 'female' : 'male'] || tie;
  /** "Lord Hamon Greymantle", "Queen Lucrezia Salviati". @param {string} id @param {Campaign} [c] */
  function titled(id, c = CL.campaign) {
    const p = person(id, c);
    if (!p) return 'someone';
    if (id === PLAYER) return p.name;
    const f = p.gender === 'female';
    const realm = rules(id, c);
    if (realm) return `${CL.content.table('factions')[realm]?.ruler?.[p.gender] || (f ? 'Queen' : 'King')} ${p.name}`;
    return `${f ? 'Lady' : 'Lord'} ${p.name}`;
  }

  // ---- Holdings (P8-02) ----

  /** The holdings at the start, from the world data. @param {Record<string, string>} byKey @param {Record<string, string>} rulers */
  function startingHoldings(byKey, rulers) {
    /** @type {Record<string, string>} */
    const given = {};
    for (const n of nobles()) for (const sid of n.holds || []) if (place(sid)?.ownerFaction === n.realm && !given[sid]) given[sid] = byKey[n.id];
    /** @type {Record<string, Holding>} */
    const h = {};
    for (const f of realms()) {
      for (const s of realmSettlements(f.id)) {
        const seat = s.type === 'village' && place(s.seat)?.ownerFaction === f.id ? s.seat : null;
        h[s.id] = { kind: s.type, sovereign: f.id, holder: given[s.id] || rulers[f.id], controller: f.id, seat, administrator: null, claims: [] };
      }
    }
    return h;
  }

  /** @param {string} sid @param {Campaign} [c] @returns {Holding | null} */
  const holding = (sid, c = CL.campaign) => c?.holdings?.[sid] || null;
  const holderOf = (sid, c = CL.campaign) => holding(sid, c)?.holder || null;
  const sovereignOf = (sid, c = CL.campaign) => holding(sid, c)?.sovereign || null;
  const claimsOn = (sid, c = CL.campaign) => holding(sid, c)?.claims || [];
  /** The villages tied to a seat. @param {string} seat @param {Campaign} [c] @returns {string[]} */
  const villagesOf = (seat, c = CL.campaign) => Object.keys(c?.holdings || {}).filter((sid) => c.holdings[sid].seat === seat);
  /** The holdings a person holds now (rank is only this). @param {string} id @param {Campaign} [c] @returns {string[]} */
  const fiefsOf = (id, c = CL.campaign) => Object.keys(c?.holdings || {}).filter((sid) => c.holdings[sid].holder === id);
  /** "great" (a fort or town), "lesser" (villages only) or "landless": a description, never stored. */
  function standingOf(id, c = CL.campaign) {
    const f = fiefsOf(id, c);
    if (!f.length) return 'landless';
    return f.some((sid) => c.holdings[sid].kind !== 'village') ? 'great' : 'lesser';
  }
  /** A story fort the story alone moves until Q4 ends: grants, sieges and debug check this. */
  const locked = (c, sid) => Boolean(place(sid)?.story) && !CL.story?.state(c).flags.ending;
  /** A realm's capital never changes controller in Phase 8 (P9-05). */
  const isCapital = (sid) => place(sid)?.type === 'town';

  /** Who controls a settlement now: a holding's controller (a village's is its seat's), else the content owner. */
  function owner(sid, c = CL.campaign) {
    const h = c?.holdings?.[sid];
    if (h) return h.controller;
    return c?.owners?.[sid] || settlement(sid).ownerFaction; // a save not yet migrated (pure migrations)
  }

  /** Add a claim on a holding, once per claimant. @param {Campaign} c @param {string} sid @param {{ by: string, realm: string | null, kind: 'granted' | 'conquest' | 'old' }} claim */
  function addClaim(c, sid, claim) {
    const h = holding(sid, c);
    if (!h || !claim?.by || h.holder === claim.by || h.claims.some((x) => x.by === claim.by)) return false;
    h.claims.push({ by: claim.by, realm: claim.realm ?? null, since: c.day, kind: claim.kind || 'old' });
    return true;
  }

  /**
   * The one way a holding changes hands (P8-02). `controller`: who takes its gates; `sovereign`: the
   * realm that now claims it (with the controller when it is a realm and nothing else is said);
   * `holder`: the person granted it (default: unchanged, or the new sovereign's ruler when the
   * sovereign changes: never vacant, D-P8f). A holder who loses it against their will keeps an `old`
   * claim. A seat's villages go with its controller. One `HoldingChanged` event per call.
   * The story lock (`locked`) is the caller's to check: grants, sieges and debug do; the story doesn't.
   * @param {Campaign} c @param {string} sid
   * @param {{ controller?: string, sovereign?: string, holder?: string, reason?: string, willing?: boolean, by?: string }} change
   * @returns {boolean} true when anything changed
   */
  function transfer(c, sid, { controller, sovereign, holder, reason = '', willing = false, by, claimKind = 'old', quiet = false } = {}) {
    const h = holding(sid, c);
    if (!h) return false;
    const toController = controller ?? h.controller;
    if (!isKingdom(toController)) return false;
    if (toController !== h.controller && (h.seat || isCapital(sid))) return false; // villages follow their seat; capitals hold (P9-05)
    const toSovereign = sovereign ?? (toController !== h.controller && isRealm(toController) ? toController : h.sovereign);
    if (!isRealm(toSovereign)) return false;
    const toHolder = holder ?? (toSovereign !== h.sovereign ? rulerOf(toSovereign, c) : h.holder);
    const p = person(toHolder, c);
    if (!p || (toHolder !== PLAYER && p.realm !== toSovereign)) return false; // sworn to its sovereign, or its ruler
    if (toHolder !== rulerOf(toSovereign, c) && toHolder !== h.holder && fiefsOf(toHolder, c).length >= FIEF_CAP) return false;
    if (toController === h.controller && toSovereign === h.sovereign && toHolder === h.holder) return false;
    const before = { controller: h.controller, sovereign: h.sovereign, holder: h.holder };
    const changed = [move(c, h, sid, toController, toSovereign, toHolder, willing, claimKind)];
    // A seat's villages go with its gates: to the new controller and sovereign, held by its ruler until granted.
    if (toController !== before.controller) {
      for (const v of villagesOf(sid, c)) {
        const vh = c.holdings[v];
        const vs = toSovereign !== vh.sovereign ? toSovereign : vh.sovereign;
        changed.push(move(c, vh, v, toController, vs, vs !== vh.sovereign ? rulerOf(vs, c) : vh.holder, false));
      }
    }
    const s = place(sid);
    CL.diag.log('info', 'Holding changed', { holding: sid, ...before, to: { controller: toController, sovereign: toSovereign, holder: toHolder }, reason });
    if (toController !== before.controller) {
      CL.ui.message(`${s.name} now flies the banner of the ${CL.content.get('factions', toController).name}.`);
      CL.news?.record(c, 'fort_taken', { fort: sid, owner: toController, place: sid });
    } else if (toHolder !== before.holder && !quiet) {
      CL.news?.record(c, 'fief_granted', { place: sid, text: `${s.name} has passed to ${titled(toHolder, c)}.` });
    }
    const involved = [before.holder, toHolder, by, ...changed.map((x) => x.from)].includes(PLAYER) || h.claims.some((k) => k.by === PLAYER);
    if (involved) CL.chronicle?.add(c, { day: c.day, kind: 'holding', place: sid, event: toHolder === PLAYER ? 'gained' : before.holder === PLAYER ? 'lost' : 'changed', by: toController });
    CL.events?.emit(c, 'HoldingChanged', { holding: sid, from: before, to: { controller: toController, sovereign: toSovereign, holder: toHolder }, villages: changed.slice(1).map((x) => x.sid), reason });
    return true;
  }
  /** One holding's change, with the claim of a holder who lost it unwillingly. */
  function move(c, h, sid, controller, sovereign, holder, willing, claimKind = 'old') {
    const from = h.holder;
    if (from !== holder && !willing && (sovereign !== h.sovereign || from !== rulerOf(h.sovereign, c))) addClaimRaw(c, h, { by: from, realm: h.sovereign, kind: claimKind });
    h.claims = h.claims.filter((x) => x.by !== holder); // a claim made good is a claim no more
    Object.assign(h, { controller, sovereign, holder });
    return { sid, from };
  }
  function addClaimRaw(c, h, claim) {
    if (!claim.by || h.claims.some((x) => x.by === claim.by)) return;
    h.claims.push({ by: claim.by, realm: claim.realm, since: c.day, kind: claim.kind });
  }

  /** Move a fort to another kingdom (story or world event): the kingdom takes sovereignty and the
   * gates, and its ruler holds it until it's granted. Returns true when it changed hands. */
  function setOwner(c, sid, f, reason = '') {
    const s = place(sid);
    if (s?.type !== 'fort' || !isRealm(f) || owner(sid, c) === f) return false;
    return transfer(c, sid, { controller: f, sovereign: f, holder: rulerOf(f, c), reason });
  }

  /** A fort's garrison: its own when held by the original owner, else the holder's standard garrison. */
  function garrison(sid, c = CL.campaign) {
    const s = settlement(sid);
    if (!s.garrison) return null;
    const tracked = c?.holdings?.[sid]?.garrison; // P8-05: the garrison as it stands
    if (tracked) return tracked;
    const f = owner(sid, c);
    return f === s.ownerFaction ? s.garrison : CL.content.get('factions', f).garrison || s.garrison;
  }

  /** Settlements a kingdom controls now (named `holdings` before P8-02; kept as an alias). */
  function controlled(c, f) {
    return Object.values(CL.content.table('settlements')).filter((s) => owner(s.id, c) === f);
  }

  /** Will this settlement deal with the player? Kept for older callers; the right is CL.rights's (P8-03). */
  const welcomes = (c, sid) => CL.rights.may(c, 'player', 'contract', sid).ok;

  /**
   * GDD §10 "helping a faction": a won fight against Road Reavers helps whoever holds the nearest
   * settlement (+2); finished contracts help the giver's owner (+10, in contracts.js).
   */
  function onBanditsBeaten(c) {
    const w = c.world;
    let best = null;
    for (const s of Object.values(CL.content.table('settlements'))) {
      const d = CL.world.mapDist(w.x, w.y, s.mapX, s.mapY);
      if (!best || d < best.d) best = { s, d };
    }
    if (best) adjust(c, owner(best.s.id, c), REP.bandits, 'bandits beaten');
  }

  // ---- Relations between kingdoms (W-07) ----

  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  /** The world's starting relations (data/world_map.js `relations`), or peace. */
  const worldPair = (a, b) => (CL.world.map().relations || []).find((r) => pairKey(...r.between) === pairKey(a, b)) || null;

  function blankRelation(a, b, day = 0) {
    return { state: worldPair(a, b)?.state || 'peace', since: day, heat: 0, losses: 0, lastClash: null, incidentUntil: 0 };
  }

  function defaultRelations(day = 0) {
    const r = {};
    const ks = kingdoms().map((f) => f.id);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) r[pairKey(ks[i], ks[j])] = blankRelation(ks[i], ks[j], day);
    return r;
  }

  function record(c, a, b) {
    if (!c.relations) c.relations = defaultRelations(c.day);
    const k = pairKey(a, b);
    if (!c.relations[k]) c.relations[k] = blankRelation(a, b, c.day);
    return c.relations[k];
  }

  /** 'peace' | 'tension' | 'war' between two kingdoms (null if either isn't one, or they are one). */
  function relation(c, a, b) {
    if (a === b || !isKingdom(a) || !isKingdom(b)) return null;
    return record(c, a, b).state;
  }

  /** Do their patrols fight? At war or in tension. */
  const atOdds = (c, a, b) => ['war', 'tension'].includes(relation(c, a, b));

  /** A pair the story holds still until its ending (D-W5). */
  const storyHeld = (c, a, b) => Boolean(worldPair(a, b)?.story) && !CL.story?.state(c).flags.ending;

  const NEWS = { war: 'war_declared', tension: 'tension_rising', peace: 'peace_made' };

  /** Set two kingdoms' relation, with a news line (`at`: where it happened, for the news). */
  function setRelation(c, a, b, state, reason = '', at = null, day = c.day) {
    if (!STATES.includes(state) || relation(c, a, b) === null) return false;
    const r = record(c, a, b);
    if (r.state === state) return false;
    const from = r.state;
    Object.assign(r, { state, since: day, heat: 0, losses: 0 });
    // P8-06a: a war that ends leaves a truce: no new war between them for a while (anti-snowball, §20.7).
    if (from === 'war') r.truceUntil = day + RELATIONS.truce;
    CL.diag.log('info', 'Relations', { a, b, from, to: state, reason });
    const kind = from === 'war' && state === 'tension' ? 'truce' : NEWS[state];
    CL.news?.record(c, kind, { ...(at || {}), faction: a, other: b }, day);
    return true;
  }

  /** Patrols of two kingdoms at peace met (js/parties.js): a border incident may sour it. */
  function incident(c, a, b, at, day = c.day) {
    if (relation(c, a, b) !== 'peace' || storyHeld(c, a, b)) return false;
    const r = record(c, a, b);
    if (day < r.incidentUntil) return false;
    r.incidentUntil = day + RELATIONS.incidentEvery;
    if (CL.autoresolve.next(c) >= RELATIONS.incidentChance) return false;
    return setRelation(c, a, b, 'tension', 'border incident', at, day);
  }

  /** Their patrols clashed (js/parties.js), and `lost` soldiers fell: tension heats, war wears out. */
  function clashed(c, a, b, lost, at, day = c.day) {
    if (!atOdds(c, a, b)) return;
    const r = record(c, a, b);
    r.heat++;
    r.lastClash = day;
    if (r.state === 'war') r.losses += lost;
    else if (r.heat >= RELATIONS.warHeat && !storyHeld(c, a, b) && day >= (r.truceUntil || 0)) setRelation(c, a, b, 'war', 'border clashes', at, day);
  }

  /** Time passing (CL.party.advanceDays): tension cools, wars wear themselves out. */
  function tickRelations(c, day = c.day) {
    for (const [k, r] of Object.entries(c.relations || {})) {
      const [a, b] = k.split('|');
      if (!isKingdom(a) || !isKingdom(b) || storyHeld(c, a, b)) continue;
      const quiet = day - (r.lastClash ?? r.since);
      if (r.state === 'tension') {
        if (r.heat > 0 && quiet >= RELATIONS.coolDays) {
          r.heat--;
          r.lastClash = day; // the next cooling counts from now
        } else if (r.heat === 0 && day - r.since >= RELATIONS.calmDays && quiet >= RELATIONS.calmDays) {
          setRelation(c, a, b, 'peace', 'quiet border', null, day);
        }
      } else if (r.state === 'war') {
        const long = day - r.since;
        if ((long >= RELATIONS.minWar && r.losses >= RELATIONS.exhaustion) || long >= RELATIONS.maxWar) setRelation(c, a, b, 'tension', 'exhaustion', null, day);
      }
    }
  }

  // ---- Save ----

  function sanitize(s, d) {
    s.reputation = defaultReputation();
    for (const f of kingdoms()) {
      const n = d?.reputation?.[f.id];
      if (typeof n === 'number' && Number.isFinite(n)) s.reputation[f.id] = clamp(Math.round(n), REP.min, REP.max);
    }
    sanitizeHoldings(s, d);
    // Relations (W-07, schema v10): every pair of this world's kingdoms, from the save where valid.
    s.relations = defaultRelations(s.day);
    const num = (n, fallback) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);
    for (const [k, r] of Object.entries(s.relations)) {
      const old = d?.relations?.[k];
      if (!old || typeof old !== 'object' || !STATES.includes(old.state)) continue;
      Object.assign(r, {
        state: old.state,
        since: num(old.since, r.since),
        heat: Math.max(0, Math.floor(num(old.heat, 0))),
        losses: Math.max(0, Math.floor(num(old.losses, 0))),
        lastClash: old.lastClash == null ? null : num(old.lastClash, null),
        incidentUntil: num(old.incidentUntil, 0),
        ...(num(old.truceUntil, 0) > s.day ? { truceUntil: old.truceUntil } : {}),
      });
    }
  }

  const num = (n, fallback) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);
  const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

  /**
   * People, rulers and holdings (P8-02, schema v19), repaired onto `s`. A save of this world's
   * kingdoms keeps its own; anything missing is completed from the world data. A partial holding
   * (a v19 migration of a world other than the Sundered Realm keeps only its owner overrides) gets
   * its holder and villages from the data, as a change of hands would.
   * @param {Campaign} s @param {any} d
   */
  function sanitizeHoldings(s, d) {
    const start = startingPeople();
    s.people = {};
    const saved = d?.people && typeof d.people === 'object' ? d.people : null;
    const ids = new Set([...Object.keys(start.people), ...Object.keys(saved || {})].filter((id) => /^person:\d{1,6}$/.test(id)));
    for (const id of ids) {
      const e = saved ? saved[id] : start.people[id];
      if (!e || typeof e !== 'object' || !isRealm(e.realm)) continue;
      const base = start.people[id];
      s.people[id] = {
        id,
        key: typeof e.key === 'string' ? e.key.slice(0, 40) : base?.key || null,
        name: text(e.name, 40).trim() || base?.name || 'A noble',
        gender: e.gender === 'female' ? 'female' : 'male',
        realm: e.realm,
        home: place(e.home) ? e.home : capitalOf(e.realm),
        kin: [],
        traits: text(e.traits, 80),
        status: STATUS.includes(e.status) ? e.status : 'free',
        heldBy: typeof e.heldBy === 'string' ? e.heldBy.slice(0, 40) : null,
      };
      // P8-01: what the player did to them or their kin (kept for P8-07), and a lord riding out again thin.
      const deeds = (Array.isArray(e.deeds) ? e.deeds : []).filter((x) => x && ['freed', 'ransomed', 'held', 'held_kin', 'suggested', 'handed'].includes(x.kind) && typeof x.day === 'number' && Number.isFinite(x.day) && typeof x.by === 'string');
      if (deeds.length) s.people[id].deeds = deeds.slice(-12).map((x) => ({ by: x.by.slice(0, 40), kind: x.kind, day: x.day }));
      if (e.regroup === true) s.people[id].regroup = true;
    }
    if (saved) for (const [id, p] of Object.entries(start.people)) if (!s.people[id] && !saved[id]) s.people[id] = { ...p, kin: [] };
    // Kin: only to people who exist, of a known tie, once.
    for (const [id, p] of Object.entries(s.people)) {
      const e = saved ? saved[id] : start.people[id];
      const seen = new Set();
      for (const k of Array.isArray(e?.kin) ? e.kin : start.people[id]?.kin || []) {
        if (!k || !s.people[k.person] || k.person === id || !TIES.includes(k.tie) || seen.has(k.person)) continue;
        seen.add(k.person);
        p.kin.push({ person: k.person, tie: k.tie });
      }
    }
    s.rulers = {};
    for (const f of realms()) {
      const r = d?.rulers?.[f.id];
      s.rulers[f.id] = s.people[r]?.realm === f.id ? r : s.people[start.rulers[f.id]] ? start.rulers[f.id] : Object.keys(s.people).find((id) => s.people[id].realm === f.id) || null;
      if (!s.rulers[f.id]) {
        // A realm with nobody at all: its data ruler comes back.
        const id = start.rulers[f.id];
        s.people[id] = { ...start.people[id], kin: [] };
        s.rulers[f.id] = id;
      }
    }
    const most = Object.keys(s.people).reduce((m, id) => Math.max(m, Number(id.slice(7))), 0);
    s.nextPersonId = Math.max(most + 1, Number.isInteger(d?.nextPersonId) ? d.nextPersonId : 1);

    // Holdings.
    const byKey = {};
    for (const [id, p] of Object.entries(s.people)) if (p.key) byKey[p.key] = id;
    const base = startingHoldings(byKey, s.rulers);
    const old = d?.holdings && typeof d.holdings === 'object' ? d.holdings : {};
    const legal = (who, f) => who === PLAYER || s.people[who]?.realm === f;
    s.holdings = {};
    for (const [sid, b] of Object.entries(base)) {
      const e = old[sid];
      const h = { ...b, claims: [] };
      // A partial record (a migrated owner override) only ever moved a fort.
      if (e && typeof e === 'object' && (e.kind || b.kind === 'fort')) {
        if (isRealm(e.sovereign)) h.sovereign = e.sovereign;
        if (isKingdom(e.controller)) h.controller = e.controller;
        if (typeof e.holder === 'string' && legal(e.holder, h.sovereign)) h.holder = e.holder;
        else if (h.sovereign !== b.sovereign) {
          h.holder = s.rulers[h.sovereign]; // a partial record: taken by a realm, held by its ruler
          h.claims.push({ by: b.holder, realm: b.sovereign, since: num(d?.day, 0), kind: 'old' });
        }
        if (typeof e.administrator === 'string' && s.people[e.administrator]) h.administrator = e.administrator;
        for (const k of Array.isArray(e.claims) ? e.claims : []) {
          if (!k || !(k.by === PLAYER || s.people[k.by]) || k.by === h.holder || h.claims.some((x) => x.by === k.by)) continue;
          if (!['granted', 'conquest', 'old'].includes(k.kind)) continue;
          h.claims.push({ by: k.by, realm: isKingdom(k.realm) ? k.realm : null, since: num(k.since, 0), kind: k.kind });
        }
      }
      if (!legal(h.holder, h.sovereign)) h.holder = s.rulers[h.sovereign];
      s.holdings[sid] = h;
    }
    // Villages follow their seat: its controller always; its sovereign and holder when the save had
    // no record of the village (a partial migration), as a change of hands would have done.
    for (const [sid, h] of Object.entries(s.holdings)) {
      if (!h.seat) continue;
      const seat = s.holdings[h.seat];
      h.controller = seat.controller;
      if (!old[sid] && seat.sovereign !== h.sovereign) {
        h.claims.push({ by: h.holder, realm: h.sovereign, since: num(d?.day, 0), kind: 'old' });
        h.sovereign = seat.sovereign;
        h.holder = s.rulers[seat.sovereign];
      }
    }
    // A lord over the cap gives the extra back to the crown (newest last).
    for (const id of Object.keys(s.people)) {
      if (rules(id, s)) continue;
      for (const sid of fiefsOf(id, s).slice(FIEF_CAP)) s.holdings[sid].holder = s.rulers[s.holdings[sid].sovereign];
    }
    delete s.owners;
  }

  /** The kingdoms a v19+ save's holdings name that this build doesn't have (SC-33). @param {any} d @returns {string[]} */
  function unknownRealms(d) {
    const out = new Set();
    for (const [sid, h] of Object.entries(d?.holdings && typeof d.holdings === 'object' ? d.holdings : {})) {
      if (!h || typeof h !== 'object') continue;
      for (const f of [h.sovereign, h.controller]) if (typeof f === 'string' && !isKingdom(f)) out.add(`${f} (at ${place(sid)?.name || sid})`);
    }
    return [...out];
  }

  // ---- Words for the Realm screen and the map (P8-02) ----

  const placeNameOf = (sid) => place(sid)?.name || sid;
  const factionShort = (f) => CL.content.table('factions')[f]?.short || f;
  const KIND = { town: 'town', fort: 'fort', village: 'village' };

  /** "Greywall Fort (fort): Lord Hamon Greymantle · gates Valedorn · claimed by …". @param {string} sid @param {Campaign} [c] */
  function holdingLine(sid, c = CL.campaign) {
    const h = holding(sid, c);
    if (!h) return placeNameOf(sid);
    const seat = h.seat ? `, under ${place(h.seat)?.placeName || placeNameOf(h.seat)}` : '';
    const parts = [`${placeNameOf(sid)} (${KIND[h.kind]}${seat}): ${titled(h.holder, c)}`];
    if (h.controller !== h.sovereign) parts.push(`gates held by ${factionShort(h.controller)}`);
    if (h.claims.length) parts.push(`claimed by ${h.claims.map((k) => titled(k.by, c)).join(', ')}`);
    if (locked(c, sid)) parts.push('the story decides it');
    return parts.join(' · ');
  }

  /** "Lord Hamon Greymantle: holds Greywall Fort, Highmere · brother of …". @param {string} id @param {Campaign} [c] */
  function personLine(id, c = CL.campaign) {
    const p = person(id, c);
    if (!p) return 'someone';
    const fiefs = fiefsOf(id, c);
    const parts = [`${titled(id, c)}: ${fiefs.length ? `holds ${fiefs.map(placeNameOf).join(', ')}` : 'landless'}`];
    const kin = p.kin.map((k) => `${person(k.person, c)?.name || 'someone'} (${tieWord(k.tie, person(k.person, c))})`);
    if (kin.length) parts.push(`kin: ${kin.join(', ')}`);
    if (p.home) parts.push(`home ${place(p.home)?.placeName || placeNameOf(p.home)}`);
    // P8-01: where they are now.
    if (p.status === 'captive') parts.push(p.heldBy === PLAYER ? 'your prisoner' : `a prisoner of the ${CL.content.table('factions')[p.heldBy]?.name || 'enemy'}`);
    else if (rules(id, c)) parts.push('keeps to their hall');
    else {
      const q = CL.lords?.partyOf(c, id);
      if (q) parts.push(CL.lords.doingLine(c, q));
    }
    if (p.traits) parts.push(p.traits);
    return parts.join(' · ');
  }

  /** What a tap on a settlement tells: its holder, and who has its gates when that's another realm. */
  function tapLine(sid, c = CL.campaign) {
    const h = holding(sid, c);
    if (!h) return null;
    const gates = h.controller !== h.sovereign ? `; ${factionShort(h.controller)} holds its gates` : '';
    return `${placeNameOf(sid)}: held by ${titled(h.holder, c)} for ${factionShort(h.sovereign)}${gates}.`;
  }

  /**
   * The design's invariants (§25.3) for holdings and people, as a list of what is wrong (empty when
   * all hold). The bots check it after every world day.
   * @param {Campaign} c @returns {string[]}
   */
  function invariants(c) {
    const out = [];
    for (const [sid, h] of Object.entries(c.holdings || {})) {
      const p = person(h.holder, c);
      if (!p) out.push(`${sid}: no holder`);
      else if (h.holder !== PLAYER && p.realm !== h.sovereign && rules(h.holder, c) !== h.sovereign) out.push(`${sid}: its holder is not sworn to ${h.sovereign}`);
      else if (h.holder === PLAYER && CL.allegiance && CL.allegiance.sworn(c) !== h.sovereign) out.push(`${sid}: you hold it but are not sworn to ${h.sovereign}`); // P8-04
      if (!isRealm(h.sovereign)) out.push(`${sid}: no sovereign`);
      if (!isKingdom(h.controller)) out.push(`${sid}: no controller`);
      if (h.seat && h.controller !== c.holdings[h.seat]?.controller) out.push(`${sid}: not controlled with its seat`);
      if (h.claims.some((k) => k.by === h.holder)) out.push(`${sid}: its holder also claims it`);
      if (new Set(h.claims.map((k) => k.by)).size !== h.claims.length) out.push(`${sid}: a claim recorded twice`);
    }
    const seen = new Set();
    for (const f of realms()) {
      const r = c.rulers?.[f.id];
      if (!r || c.people?.[r]?.realm !== f.id) out.push(`${f.id}: no ruler`);
      else if (seen.has(r)) out.push(`${r} holds two rulers' offices`);
      seen.add(r);
    }
    for (const [id, p] of Object.entries(c.people || {})) {
      if (!rules(id, c) && fiefsOf(id, c).length > FIEF_CAP) out.push(`${id}: more than ${FIEF_CAP} fiefs`);
      for (const k of p.kin) if (!c.people[k.person]?.kin.some((x) => x.person === id && x.tie === RETURN_TIE[k.tie])) out.push(`${id}: kin tie to ${k.person} not returned`);
    }
    out.push(...(CL.lords?.invariants(c) || [])); // the lords on the map and their captivity (P8-01)
    out.push(...(CL.nobles?.invariants(c) || [])); // promises, petitions and opinions (P8-07)
    return out;
  }

  /** A chronicle line for a holding entry (js/chronicle.js). */
  function chronicleText(e) {
    const at = place(e.place)?.name || 'a holding';
    if (e.event === 'gained') return `Granted ${at}.`;
    if (e.event === 'lost') return `Lost ${at} to the ${CL.content.get('factions', e.by)?.name || 'enemy'}.`;
    return `${at} changed hands.`;
  }

  /**
   * Content checks (P8-02): villages' seats, the nobles' realms, homes, holdings, caps and kin.
   * @param {Record<string, any>} C @param {(msg: string) => void} err
   */
  function validate(C, err) {
    const S = C.settlements || {};
    const F = C.factions || {};
    for (const s of Object.values(S)) {
      if (s.type !== 'village' || !F[s.ownerFaction] || F[s.ownerFaction].freeCity || s.ownerFaction === 'neutral') continue;
      const own = Object.values(S).filter((x) => x.ownerFaction === s.ownerFaction && x.type !== 'village');
      if (!s.seat) {
        if (own.length) err(`settlement ${s.id}: a village needs a seat (a fort or town of ${s.ownerFaction})`);
      } else if (!S[s.seat] || S[s.seat].type === 'village' || S[s.seat].ownerFaction !== s.ownerFaction) err(`settlement ${s.id}: seat ${s.seat} is not a fort or town of ${s.ownerFaction}`);
    }
    for (const s of Object.values(S)) if (s.story && s.type !== 'fort') err(`settlement ${s.id}: only a fort can be a story fort`);
    for (const m of Object.values(C.world_map || {})) {
      const list = m.nobles || [];
      const byId = Object.fromEntries(list.map((n) => [n.id, n]));
      const held = {};
      const rulers = {};
      for (const n of list) {
        const w = `world_map ${m.id}: noble ${n.id}`;
        if (!(m.factions || []).includes(n.realm) || F[n.realm]?.freeCity) err(`${w}: unknown realm ${n.realm}`);
        if (!['male', 'female'].includes(n.gender)) err(`${w}: gender must be male or female`);
        if (typeof n.name !== 'string' || !n.name.trim()) err(`${w}: needs a name`);
        if (!S[n.home]) err(`${w}: unknown home ${n.home}`);
        if (n.ruler) {
          if (rulers[n.realm]) err(`${w}: ${n.realm} already has a ruler (${rulers[n.realm]})`);
          rulers[n.realm] = n.id;
        }
        const holds = n.holds || [];
        if (!n.ruler && holds.length > FIEF_CAP) err(`${w}: holds ${holds.length} fiefs; a lord holds at most ${FIEF_CAP}`);
        for (const sid of holds) {
          if (!S[sid] || S[sid].ownerFaction !== n.realm) err(`${w}: holds ${sid}, not a settlement of ${n.realm}`);
          if (held[sid]) err(`${w}: ${sid} is already held by ${held[sid]}`);
          held[sid] = n.id;
        }
        for (const k of n.kin || []) {
          const other = byId[k.id];
          if (!other) err(`${w}: kin ${k.id} is nobody`);
          else if (!TIES.includes(k.tie)) err(`${w}: unknown tie ${k.tie}`);
          else if (!(other.kin || []).some((x) => x.id === n.id && x.tie === RETURN_TIE[k.tie])) err(`${w}: kin tie to ${k.id} (${k.tie}) isn't returned`);
        }
      }
    }
  }

  CL.realm = {
    REP,
    FRIENDLY_CAP_BONUS,
    STANDING_LABEL,
    kingdoms,
    outlaws,
    isKingdom,
    forts,
    defaultReputation,
    defaultOwners,
    realms,
    isRealm,
    capitalOf,
    TIES,
    FIEF_CAP,
    PLAYER,
    startingPeople,
    startingHoldings,
    person,
    rulerOf,
    rules,
    tieWord,
    titled,
    holding,
    holderOf,
    sovereignOf,
    claimsOn,
    villagesOf,
    fiefsOf,
    standingOf,
    locked,
    isCapital,
    addClaim,
    transfer,
    unknownRealms,
    invariants,
    holdingLine,
    personLine,
    tapLine,
    sanitizeHoldings,
    chronicleText,
    validate,
    score,
    standing,
    isHostile,
    adjust,
    capBonus,
    owner,
    setOwner,
    garrison,
    controlled,
    holdings: controlled,
    welcomes,
    onBanditsBeaten,
    STATES,
    RELATIONS,
    pairKey,
    defaultRelations,
    relation,
    atOdds,
    storyHeld,
    setRelation,
    incident,
    clashed,
    tickRelations,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
