// @ts-check
/* Crownless story interpreter (GDD §4 quests, §13 "event-driven updates notify quest flags when
 * battles, trades and conversations resolve"; the QuestTracker service).
 *
 * Everything story-shaped is data: dialogue trees in data/dialogue.js and quests in data/quests.js.
 * This module only interprets them. Three small vocabularies:
 *
 *  Conditions (`if`): an object with one test, or an array meaning "all of these".
 *    { flag: 'x' }  { flag: 'x', is: v }  { flag: 'n', gte: 3 }  { not: cond }  { all: [..] }  { any: [..] }
 *    { quest: 'q1', is: 'unstarted'|'active'|'done'|'failed' }  { quest: 'q1', stage: 's' }
 *    { gold: n }  { renown: n }  { level: n }  { soldiers: n }  — "at least n", or { gte, lte }
 *    { rep: 'valedorn', gte: n }  { standing: 'aurelian', is: 'friendly' }
 *    { skill: 'trade', gte: n }  { attribute: 'cha', gte: n }  { background: 'scout' }
 *    { has: 'item' }  { owner: 'greywall_fort', is: 'valedorn' }  { at: 'stonebridge' }
 *    { companion: 'mara' } (with you)  { companion: 'mara', is: 'fit' }  { room: 1 } (free party slots)
 *    { veteran: 3 } (a soldier born where you are, with at least 3 battles; V2-Q)
 *    { follower: 'quartermaster' | 'merchant' } (hired; V2-Q)
 *
 *  Effects (`do`): a list, applied in order.
 *    { set: 'flag', to: v = true }  { clear: 'flag' }  { add: 'counter', by: 1 }
 *    { gold: n }  { renown: n }  { xp: n }  { food: n }  { rep: 'valedorn', by: n }
 *    { give: 'item', n = 1 }  { take: 'item', n = 1 }  { recruit: 'levy', n = 1 }
 *    { start: 'q1' }  { stage: 's', quest: 'q1' }  { complete: 'q1' }  { fail: 'q1' }
 *    { owner: 'greywall_fort', to: 'aurelian' }  { message: 'text' }  { note: 'text', quest: 'q1' }
 *    { companion: 'mara' } (joins)  { part: 'mara', reason: 'fell' } (leaves for good)
 *    { send: 'mara' } (rides ahead; out of the company until recalled)  { recall: 'mara' }
 *    { ending: 'key', quest: 'q4' } (sets flag ending and shows that quest's ending panel)
 *    { honourVeteran: xp } (the most-travelled soldier born here gains xp and a 'feted' service note; V2-Q)
 *    Any effect may carry its own `if` condition and is skipped when it fails.
 *
 *  Stages may also have: begin (effects when the stage starts), deadline (days) with expire
 *  (effects once, if the stage is still current when the time runs out).
 *
 *  Events: game code calls `emit(name, payload)`; quest stages react with
 *    on: [{ event, match: { key: value | [values] }, if, do }]
 *    Events: battle {win, encounter, site, party, contract}, enter {settlement}, recruit {troop,
 *    settlement}, trade {settlement, good, side}, contract {template, giver}, talk {dialogue, node},
 *    parley {party, tag, outcome: 'intimidate' | 'toll'}.
 *    From V2-Q: battle also has {fought, preset, reinforced}; hire {follower}; stores {rations} (the
 *    quartermaster bought food); venture {profit: true} (the merchant sold at a profit).
 *
 * A stage may also need a band on the map: band: { template, tag, troops, name?, text?, camp?, map?, near | between: [a, b], along? }
 * (along: how far from a to b, 0–1, default halfway; W-05c: a band in a mountain pass)
 * (camp: true holds its ground and only fights if the player goes to it; otherwise it ambushes)
 * (settlement or site ids). It is spawned when the stage begins, re-spawned if lost while the stage
 * is active (so nothing soft-locks), and removed once no active stage needs it. Battles against it
 * carry its tag: match: { tag: 'q1_ambush' }. A stage may have several: bands: [spec, …] (V2-Q). A band
 * with help: true lets nearby parties join its fight (story battles get none otherwise, V2-09); one
 * with helper: true is a kingdom patrol that rides to the player's aid against bandits, whatever the
 * kingdom thinks of them.
 *
 * Text may use {name}, {gold}, {renown}, {settlement}, {veteran} and {flag:some_flag}.
 *
 * The cast (P10-04): the main story is told from whichever kingdom you chose (`c.startRealm`), so its
 * places, realms and people are roles, cast from the map at a new game (`c.story.cast`, see `castFor`):
 *   realms  crown (yours), rival (the realm next to yours)
 *   places  home (your start town), village (your village nearest it: the grain wagon), border (your
 *           village nearest the fort), fort (your fort facing the rival: the contested fort),
 *           rival_fort (the rival's fort nearest you), rival_town (the rival's town), fence_town (the
 *           village nearest it), camp (the outlaws' lair nearest home)
 *   (each fort is its side's nearest the other side's land; the rival is the realm whose town is nearest yours)
 *   people  elder and recruiter (your town's, by their role in its streets), crown_agent and
 *           rival_agent (each realm's envoy), caravan (the rival town's caravan master); data/factions.js `story`
 * In conditions, effects, matches, bands and places a role is written '@role' (e.g. { rep: '@crown' },
 * { owner: '@fort', is: '@rival' }, between: ['@village', '@home']). A band may name `realm` and `force`
 * ('column' | 'host') instead of a template and troops: that realm's patrol, with its story troops.
 * In text, {cast:role} is a role's name and {cast:role.field} one of its words: realms short, a (with
 * its article: "an Aurelian"), name, banner, colour, court ("the King’s hall"); places name, place, dir (the compass from home);
 * people name, short, title ("the magistrate"), he, his, him.
 * {Cast:…} capitalizes it. A dialogue with `cast: 'elder' | 'recruiter'` is spoken by that person in
 * the home town's streets; one whose `place` is a role is also met in its town's streets (a hub's
 * `spots`). The contested forts stay locked and the two realms in tension until an ending.
 * A quest with side: true is an errand (V2-Q): optional, shown as such in the Journal. Story state lives in `campaign.story`. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const EVENTS = ['battle', 'enter', 'recruit', 'trade', 'contract', 'talk', 'parley', 'hire', 'stores', 'venture'];
  const QUEST_STATUS = ['active', 'done', 'failed'];
  const MAX_FLAGS = 200;
  const MAX_NOTES = 20;
  const PLACE_ROLES = ['home', 'village', 'border', 'fort', 'rival_fort', 'rival_town', 'fence_town'];
  const REALM_ROLES = ['crown', 'rival'];
  const PEOPLE_ROLES = ['elder', 'recruiter', 'crown_agent', 'rival_agent', 'caravan'];
  const ROLES = [...REALM_ROLES, ...PLACE_ROLES, 'camp', ...PEOPLE_ROLES];
  const COND_KEYS = ['flag', 'not', 'all', 'any', 'quest', 'gold', 'renown', 'level', 'soldiers', 'rep', 'standing', 'skill', 'attribute', 'background', 'has', 'owner', 'at', 'companion', 'room', 'veteran', 'follower'];
  const EFFECT_KEYS = ['set', 'clear', 'add', 'gold', 'renown', 'xp', 'food', 'rep', 'give', 'take', 'recruit', 'start', 'stage', 'complete', 'fail', 'owner', 'message', 'note', 'companion', 'part', 'send', 'recall', 'ending', 'honourVeteran', 'retinue'];

  const camp = () => CL.campaign;
  const quest = (id) => CL.content.table('quests')[id] || null;
  const tree = (id) => CL.content.table('dialogue')[id] || null;
  const isFlagValue = (v) => ['boolean', 'string'].includes(typeof v) || (typeof v === 'number' && Number.isFinite(v));

  /** A new campaign's story. P9-08: a sandbox world (no story) begins as the others are after theirs. */
  function blank(realm = null) {
    return { flags: CL.world?.map().sandbox ? { ending: 'sandbox' } : {}, quests: {}, visits: {}, cast: castFor(realm) };
  }

  const state = (c = camp()) => {
    if (!c.story) c.story = blank(c.startRealm);
    return c.story;
  };

  // ---- The cast (P10-04) ----

  const F = (id) => CL.realm.faction(id); // P9-03: every realm through CL.realm
  const realmsOf = () => {
    const m = CL.world.map();
    return (m.factions || []).filter((f) => F(f) && !F(f).freeCity && f !== m.outlaws);
  };
  const settlements = () => Object.values(CL.content.table('settlements'));
  /** A realm's start town: its `start` (data/factions.js), else its first town, else the world's start. */
  function startOf(realm) {
    const f = F(realm);
    const S = CL.content.table('settlements');
    if (f?.start && S[f.start]) return S[f.start];
    return settlements().find((s) => s.ownerFaction === realm && s.type === 'town') || null;
  }
  /** The kingdoms a new game may begin in: every realm of the world with a start town. */
  const startRealms = () => realmsOf().filter((f) => startOf(f));
  /** The realm a new game begins in when none is chosen: the one holding the world's start. */
  const defaultRealm = () => CL.content.table('settlements')[CL.world.map().start]?.ownerFaction || startRealms()[0] || null;

  /**
   * The story's cast for a game begun in `realm`, from the map as its data begins it (so the same
   * realm always gives the same cast; Valedorn gives the original March story's). Null if the world
   * cannot cast it (no rival, fort or village).
   */
  function castFor(realm) {
    if (!CL.world || !CL.content.table('settlements')) return null;
    if (!realm) realm = defaultRealm();
    const home = startOf(realm);
    if (!home) return null;
    const d = (a, b) => Math.hypot(a.mapX - b.mapX, a.mapY - b.mapY);
    const nearest = (list, score) => list.slice().sort((a, b) => score(a) - score(b) || (a.id < b.id ? -1 : 1))[0] || null;
    const own = (f, type) => settlements().filter((s) => s.ownerFaction === f && s.type === type);
    const rival = nearest(realmsOf().filter((f) => f !== realm && startOf(f)).map((id) => ({ id, town: startOf(id) })), (r) => d(home, r.town));
    if (!rival) return null;
    const rt = rival.town;
    // Each side's fort nearest the other's land: the one it holds against it.
    const facing = (f) => (s) => Math.min(...settlements().filter((x) => x.ownerFaction === f).map((x) => d(s, x)));
    const fort = nearest(own(realm, 'fort'), facing(rival.id));
    const rivalFort = nearest(own(rival.id, 'fort'), facing(realm));
    const village = nearest(own(realm, 'village'), (s) => d(s, home));
    if (!fort || !rivalFort || !village) return null;
    const fence = nearest(settlements().filter((s) => s.type === 'village' && s.id !== village.id), (s) => d(s, rt));
    const border = nearest(own(realm, 'village').filter((s) => s.id !== village.id && s.id !== fence?.id), (s) => d(s, fort)) || village;
    const sites = Object.values(CL.world.map().sites || {}).filter((s) => s.encounter);
    const lair = nearest(sites, (s) => d(s, home));
    return {
      crown: realm,
      rival: rival.id,
      home: home.id,
      village: village.id,
      border: border.id,
      fort: fort.id,
      rival_fort: rivalFort.id,
      rival_town: rt.id,
      fence_town: (fence || village).id,
      camp: lair?.id || null,
    };
  }

  const castOf = (c = camp()) => c?.story?.cast || null;
  const isRole = (v) => typeof v === 'string' && v[0] === '@';
  /** A value with its role resolved: '@fort' → 'greywall_fort'. Anything else is itself. */
  function resolve(v, c = camp()) {
    if (Array.isArray(v)) return v.map((x) => resolve(x, c));
    if (!isRole(v)) return v;
    return castOf(c)?.[v.slice(1)] ?? null;
  }

  /** A cast person: { name, short, he, his, him, tag?, frames? }, from a town's streets or a realm's story people. */
  function person(role, c = camp()) {
    const k = castOf(c);
    if (!k) return null;
    if (role === 'elder' || role === 'recruiter') {
      const n = CL.town?.cast(k.home, role);
      return n ? { name: n.name, short: n.short || n.name, he: 'they', his: 'their', him: 'them', npc: n.id } : null;
    }
    const realm = role === 'crown_agent' ? k.crown : k.rival;
    const p = F(realm)?.story?.[role === 'caravan' ? 'caravan' : 'agent'];
    const words = { he: ['he', 'his', 'him'], she: ['she', 'her', 'her'], they: ['they', 'their', 'them'] }[p?.he] || ['they', 'their', 'them'];
    return p ? { ...p, he: words[0], his: words[1], him: words[2] } : null;
  }

  const COMPASS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  /** The word for a role in text: {cast:role} or {cast:role.field}. */
  function castWord(c, role, field) {
    const k = castOf(c);
    if (!k || !ROLES.includes(role)) return role;
    if (PEOPLE_ROLES.includes(role)) {
      const p = person(role, c);
      return String(p?.[field || 'name'] ?? p?.name ?? role);
    }
    const id = k[role];
    if (REALM_ROLES.includes(role)) {
      const f = F(id);
      if (!f) return role;
      if (field === 'name') return f.name;
      if (field === 'banner' || field === 'colour' || field === 'court') return f.story?.[field] || f.short;
      if (field === 'a') return `${/^[AEIOU]/.test(f.short) ? 'an' : 'a'} ${f.short}`;
      return f.short;
    }
    const s = role === 'camp' ? CL.world.map().sites?.[id] : CL.content.table('settlements')[id];
    if (!s) return role;
    if (field === 'dir') {
      const h = CL.content.table('settlements')[k.home];
      const a = Math.atan2(-(s.mapY - h.mapY), s.mapX - h.mapX);
      return COMPASS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
    }
    if (field === 'place') return s.placeName || s.name;
    return s.name;
  }

  /** The regions the story is told in (its `home` land: the gentler bands, the "Beyond" tip). */
  const homeLands = new WeakMap();
  function homeLand(rid, c = camp()) {
    const k = castOf(c);
    if (!k) return undefined;
    if (!homeLands.has(k)) {
      const S = CL.content.table('settlements');
      homeLands.set(k, new Set([k.home, k.rival_town, k.fort].map((id) => S[id] && CL.world.regionIdAt(S[id].mapX, S[id].mapY)).filter(Boolean)));
    }
    return homeLands.get(k).has(rid);
  }

  /** The forts the story decides (no siege or grant) until an ending: the contested fort and the rival's. */
  function locksFort(c, sid) {
    const k = castOf(c);
    return Boolean(k) && (sid === k.fort || sid === k.rival_fort) && !state(c).flags.ending;
  }

  /** Are realms a and b the story's pair, held in tension until an ending? */
  function holdsPair(c, a, b) {
    const k = castOf(c);
    return Boolean(k) && ((a === k.crown && b === k.rival) || (a === k.rival && b === k.crown)) && !state(c).flags.ending;
  }

  /** The story dialogue a town's person speaks (a tree with `cast`), or null. */
  function streetDialogue(sid, npcId, c = camp()) {
    const k = castOf(c);
    if (!k || sid !== k.home) return null;
    for (const t of Object.values(CL.content.table('dialogue'))) if (t.cast && (t.cast === 'elder' || t.cast === 'recruiter') && person(t.cast, c)?.npc === npcId) return t.id;
    return null;
  }

  // ---- Conditions ----

  /** A number test: a bare number means "at least"; otherwise { gte, lte, eq }. */
  function compare(v, t) {
    if (typeof t === 'number') return v >= t;
    if (t == null || typeof t !== 'object') return false;
    if ('gte' in t && !(v >= t.gte)) return false;
    if ('lte' in t && !(v <= t.lte)) return false;
    if ('eq' in t && v !== t.eq) return false;
    return true;
  }

  function questStatus(c, id) {
    return state(c).quests[id]?.status || 'unstarted';
  }

  function test(cond, c = camp()) {
    if (cond == null) return true;
    if (Array.isArray(cond)) return cond.every((x) => test(x, c));
    const s = state(c);
    if ('all' in cond) return cond.all.every((x) => test(x, c));
    if ('any' in cond) return cond.any.some((x) => test(x, c));
    if ('not' in cond) return !test(cond.not, c);
    if ('flag' in cond) {
      if ('is' in cond) return s.flags[cond.flag] === cond.is;
      if ('gte' in cond || 'lte' in cond || 'eq' in cond) return compare(Number(s.flags[cond.flag]) || 0, cond);
      return Boolean(s.flags[cond.flag]);
    }
    if ('quest' in cond) {
      if ('stage' in cond) return s.quests[cond.quest]?.status === 'active' && s.quests[cond.quest].stage === cond.stage;
      return questStatus(c, cond.quest) === (cond.is || 'active');
    }
    if ('gold' in cond) return compare(c.gold, cond.gold);
    if ('renown' in cond) return compare(c.renown, cond.renown);
    if ('level' in cond) return compare(c.character?.level || 1, cond.level);
    if ('soldiers' in cond) return compare(c.roster.filter((x) => x.woundedUntil === null).length, cond.soldiers);
    if ('rep' in cond) return compare(CL.realm.score(c, resolve(cond.rep, c)), cond);
    if ('standing' in cond) return CL.realm.standing(c, resolve(cond.standing, c)) === cond.is;
    if ('skill' in cond) return compare(CL.character.skill(cond.skill, c), cond);
    if ('attribute' in cond) return compare(CL.character.attribute(cond.attribute, c), cond);
    if ('background' in cond) return c.character?.background === cond.background;
    if ('has' in cond) return (c.inventory[cond.has] || 0) > 0 || Object.values(c.equipment || {}).includes(cond.has);
    if ('owner' in cond) return CL.realm.owner(resolve(cond.owner, c), c) === resolve(cond.is, c);
    if ('at' in cond) return c.world.location === resolve(cond.at, c);
    if ('companion' in cond) return cond.is === 'fit' ? CL.companion.fit(c) && CL.companion.has(c, cond.companion) : CL.companion.has(c, cond.companion);
    if ('room' in cond) return CL.party.partyCap(c) - CL.party.headcount(c) >= cond.room;
    if ('veteran' in cond) return Boolean(veteranHere(c, cond.veteran));
    if ('follower' in cond) return Boolean(c.followers?.[cond.follower]);
    return false;
  }

  /** The most-travelled soldier born where the company is, with at least `n` battles (V2-Q). @param {Campaign} c */
  function veteranHere(c, n = 1) {
    const here = c.world?.location;
    if (!here) return null;
    const born = c.roster.filter((s) => s.origin === here && s.record.battles >= n);
    return born.sort((a, b) => b.record.battles - a.record.battles || a.id - b.id)[0] || null;
  }

  // ---- Effects ----

  function apply(effects, c = camp(), ctx = {}) {
    for (const e of effects || []) if (!e.if || test(e.if, c)) applyOne(e, c, ctx);
  }

  function applyOne(e, c, ctx) {
    const s = state(c);
    if ('set' in e) s.flags[e.set] = 'to' in e ? e.to : true;
    else if ('clear' in e) delete s.flags[e.clear];
    else if ('add' in e) s.flags[e.add] = (Number(s.flags[e.add]) || 0) + ('by' in e ? e.by : 1);
    else if ('gold' in e) {
      if (e.gold > 0) CL.accounts.earn(c, e.gold, 'story');
      else CL.accounts.spend(c, Math.min(c.gold, -e.gold), 'story');
    }
    else if ('renown' in e) c.renown = Math.max(0, c.renown + e.renown);
    else if ('xp' in e) CL.character.gainXp(e.xp, c);
    else if ('food' in e) c.food = Math.max(0, c.food + e.food);
    else if ('rep' in e) CL.realm.adjust(c, resolve(e.rep, c), e.by, ctx.reason || 'story');
    else if ('give' in e) c.inventory[e.give] = (c.inventory[e.give] || 0) + (e.n || 1);
    else if ('take' in e) {
      const left = (c.inventory[e.take] || 0) - (e.n || 1);
      if (left > 0) c.inventory[e.take] = left;
      else delete c.inventory[e.take];
    } else if ('recruit' in e) {
      for (let i = 0; i < (e.n || 1) && CL.party.headcount(c) < CL.party.partyCap(c); i++) {
        const s = CL.save.addSoldier(c, e.recruit);
        CL.events.emit(c, 'SoldierRecruited', { soldierId: s.id, troop: e.recruit, settlement: c.world?.location ?? null, via: 'story' });
      }
    } else if ('start' in e) start(c, e.start);
    else if ('stage' in e) setStage(c, e.quest || ctx.quest, e.stage);
    else if ('complete' in e) finish(c, e.complete, 'done');
    else if ('fail' in e) finish(c, e.fail, 'failed');
    else if ('owner' in e) CL.realm.setOwner(c, resolve(e.owner, c), resolve(e.to, c), ctx.reason || 'story');
    else if ('message' in e) CL.ui.message(format(e.message, c));
    else if ('note' in e) note(c, e.quest || ctx.quest, format(e.note, c));
    else if ('companion' in e) CL.companion.join(c, e.companion);
    else if ('part' in e) CL.companion.part(c, e.part, e.reason || 'parted');
    else if ('retinue' in e) CL.retinue.join(c, e.retinue); // a companion of the wider world joins (P7-06)
    else if ('send' in e) {
      CL.detachments?.callBackCompanion(c); // away leading a patrol: called back first (P7-05)
      CL.companion.send(c, e.send);
    }
    else if ('recall' in e) CL.companion.recall(c, e.recall);
    else if ('ending' in e) showEnding(c, e.quest || ctx.quest, e.ending);
    else if ('honourVeteran' in e) {
      const v = veteranHere(c);
      if (v) {
        v.xp += e.honourVeteran;
        CL.soldiers.note(v, { day: c.day, kind: 'feted', place: c.world.location });
      }
    }
  }

  // ---- Endings (GDD §4 Q4: "show a brief ending panel, return to sandbox") ----

  /** The ending's title and words, with its conditional lines resolved. */
  function endingView(c, questId, key) {
    const e = quest(questId)?.endings?.[key];
    if (!e) return null;
    return { key, title: format(e.title, c), text: nodeText({ text: e.text }, c) };
  }

  function showEnding(c, questId, key) {
    const v = endingView(c, questId, key);
    if (!v) return;
    state(c).flags.ending = key;
    CL.diag.log('info', 'Ending', { quest: questId, ending: key });
    // W-07 (D-W5): the ending sets the kingdoms' relation it names; the usual rules take over after.
    const rel = quest(questId).endings[key].relations;
    if (rel) CL.realm.setRelation(c, resolve(rel.between[0], c), resolve(rel.between[1], c), rel.to, `ending ${key}`);
    CL.ui.showEnding?.(v);
  }

  // ---- Quests ----

  function start(c, id) {
    const q = quest(id);
    if (!q || questStatus(c, id) !== 'unstarted') return false;
    state(c).quests[id] = { status: 'active', stage: q.stages[0].id, notes: [], startedDay: c.day, stageDay: c.day };
    CL.diag.log('info', 'Quest started', { quest: id });
    apply(q.stages[0].begin, c, { quest: id, reason: `quest ${id}` });
    ensureBands(c);
    CL.ui.message(`New quest: ${format(q.title, c)}`);
    return true;
  }

  function setStage(c, id, stageId) {
    const q = quest(id);
    const r = state(c).quests[id];
    if (!q || r?.status !== 'active' || !q.stages.some((st) => st.id === stageId)) return false;
    r.stage = stageId;
    r.stageDay = c.day;
    delete r.expired;
    CL.diag.log('info', 'Quest stage', { quest: id, stage: stageId });
    apply(q.stages.find((st) => st.id === stageId).begin, c, { quest: id, reason: `quest ${id}` });
    ensureBands(c);
    return true;
  }

  /** Close a quest. A finished quest pays its rewards (gold, renown, xp, reputation). */
  function finish(c, id, status) {
    const q = quest(id);
    const r = state(c).quests[id];
    if (!q || r?.status !== 'active') return false;
    r.status = status;
    r.stage = null;
    r.endedDay = c.day;
    if (status === 'done') {
      CL.audio?.play('quest');
      const w = q.rewards || {};
      if (w.gold) CL.accounts.earn(c, w.gold, `quest: ${q.title}`);
      if (w.renown) c.renown += w.renown;
      if (w.xp) CL.character.gainXp(w.xp, c);
      for (const [f, n] of Object.entries(w.rep || {})) CL.realm.adjust(c, resolve(f, c), n, `quest ${id}`);
      CL.ui.message(`Quest complete: ${format(q.title, c)}${w.gold ? ` · +${w.gold} crowns` : ''}${w.renown ? ` · +${w.renown} renown` : ''}`);
    } else CL.ui.message(`Quest failed: ${format(q.title, c)}`);
    CL.diag.log('info', 'Quest ended', { quest: id, status });
    CL.chronicle?.quest(c, id, status); // the company chronicle (V2-10)
    ensureBands(c);
    return true;
  }

  /**
   * A new game's opening (P10-04): the common quest (`common: true`, Q1) begins at once, so the plain
   * start leads straight into the story. P10-05's origins lead into it instead.
   */
  function opening(c = camp()) {
    if (state(c).flags.ending) return;
    for (const q of Object.values(CL.content.table('quests') || {})) if (q.common) start(c, q.id);
  }

  function note(c, id, text) {
    const r = state(c).quests[id];
    if (!r || !text) return;
    r.notes.push(text);
    if (r.notes.length > MAX_NOTES) r.notes.shift();
  }

  /** Where a stage band stands: beside a settlement or site, or between two of them (halfway, or `along`). */
  function placeOf(id) {
    id = resolve(id);
    const s = CL.content.table('settlements')[id] || CL.world.map().sites[id];
    return s ? { x: s.mapX, y: s.mapY } : null;
  }

  function bandSpot(spec) {
    if (spec.between) {
      const [a, b] = spec.between.map(placeOf);
      const t = spec.along ?? 0.5;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    const p = placeOf(spec.near);
    const [x, y] = CL.world.clampToMap(p.x + 3, p.y + 2, 2); // beside the place, inside the map (W-04)
    return { x, y };
  }

  /** A band spec as cast: a `realm` and `force` become that realm's patrol and its story troops. */
  function bandOf(spec, c = camp()) {
    const out = { ...spec };
    if (spec.name) out.name = format(spec.name, c);
    if (spec.text) out.text = format(spec.text, c);
    if (!spec.realm) return out;
    const f = F(resolve(spec.realm, c));
    return { ...out, template: f?.story?.patrol, troops: { ...(f?.story?.[spec.force] || {}) } };
  }

  /** A stage's bands: its `band` and any `bands`. */
  const stageBands = (st) => [st?.band, ...(st?.bands || [])].filter(Boolean);

  /** The stage band spec behind a quest band's tag (for its encounter text). */
  function bandSpec(tag, c = camp()) {
    for (const [id, r] of Object.entries(state(c).quests)) {
      if (r.status !== 'active') continue;
      const band = stageBands(quest(id)?.stages.find((st) => st.id === r.stage)).find((b) => b.tag === tag);
      if (band) return bandOf(band, c);
    }
    return null;
  }

  /** Keep exactly the bands that active quest stages need on the map. */
  function ensureBands(c = camp()) {
    if (!c?.parties || !c.story) return;
    const wanted = new Map();
    for (const [id, r] of Object.entries(c.story.quests)) {
      if (r.status !== 'active') continue;
      for (const band of stageBands(quest(id)?.stages.find((st) => st.id === r.stage))) wanted.set(band.tag, band);
    }
    for (const p of [...c.parties]) {
      if (p.questTag && !wanted.has(p.questTag)) c.parties.splice(c.parties.indexOf(p), 1);
    }
    for (const [tag, spec] of wanted) {
      if (c.parties.some((p) => p.questTag === tag)) continue;
      const at = bandSpot(spec);
      CL.parties.spawnQuestBand(c, bandOf(spec, c), at.x, at.y);
    }
  }

  /** As the clock moves: a stage whose deadline has passed runs its expire effects, once. */
  function tick(c = camp()) {
    if (!c?.story) return;
    for (const [id, r] of Object.entries(c.story.quests)) {
      if (r.status !== 'active' || r.expired === r.stage) continue;
      const st = quest(id)?.stages.find((x) => x.id === r.stage);
      if (!st?.deadline || c.day < (r.stageDay ?? r.startedDay) + st.deadline) continue;
      r.expired = r.stage;
      CL.diag.log('info', 'Quest deadline passed', { quest: id, stage: r.stage });
      apply(st.expire, c, { quest: id, reason: `quest ${id}` });
    }
  }

  /** Days left on the current stage's deadline, or null. */
  function deadlineLeft(c, id) {
    const r = state(c).quests[id];
    const st = r?.status === 'active' && quest(id)?.stages.find((x) => x.id === r.stage);
    if (!st?.deadline || r.expired === r.stage) return null;
    return (r.stageDay ?? r.startedDay) + st.deadline - c.day;
  }

  const matches = (match, payload, c = camp()) =>
    Object.entries(match || {}).every(([k, v]) => {
      const want = resolve(v, c);
      return Array.isArray(want) ? want.includes(payload[k]) : payload[k] === want;
    });

  /**
   * Something happened in the world. Every active quest's current stage gets a look; the first
   * matching trigger of a stage fires. Returns the number of triggers that fired.
   */
  function emit(name, payload = {}, c = camp()) {
    if (!c?.story) return 0;
    let fired = 0;
    for (const [id, r] of Object.entries(state(c).quests)) {
      if (r.status !== 'active') continue;
      const stage = quest(id)?.stages.find((st) => st.id === r.stage);
      const hit = (stage?.on || []).find((t) => t.event === name && matches(t.match, payload, c) && test(t.if, c));
      if (!hit) continue;
      apply(hit.do, c, { quest: id, reason: `quest ${id}` });
      fired++;
    }
    if (fired) CL.diag.log('info', 'Story event', { event: name, payload, fired });
    return fired;
  }

  // ---- Dialogue ----

  function format(text, c = camp()) {
    const here = c.world?.location ? CL.content.get('settlements', c.world.location).name : 'the road';
    return String(text)
      .replace(/\{name\}/g, c.character?.name || 'wanderer')
      .replace(/\{gold\}/g, String(c.gold))
      .replace(/\{renown\}/g, String(c.renown))
      .replace(/\{settlement\}/g, here)
      .replace(/\{veteran\}/g, veteranHere(c)?.name || 'your veteran')
      .replace(/\{([Cc])ast:([a-z_]+)(?:\.([a-z]+))?\}/g, (_, k, role, field) => {
        const w = castWord(c, role, field);
        return k === 'C' ? w.charAt(0).toUpperCase() + w.slice(1) : w;
      })
      .replace(/\{flag:([a-z0-9_:]+)\}/g, (_, f) => String(state(c).flags[f] ?? 0));
  }

  /**
   * A node's words. `text` is a string or a list of entries (strings or { if, text }); every
   * matching entry is joined, so conditional lines compose. With `cycle`, one matching entry is
   * shown per visit instead, rotating.
   */
  function nodeText(node, c = camp(), visit = 0) {
    const entries = (Array.isArray(node.text) ? node.text : [node.text]).filter((x) => typeof x === 'string' || test(x.if, c));
    const words = entries.map((x) => (typeof x === 'string' ? x : x.text));
    if (!words.length) return '';
    return format(node.cycle ? words[visit % words.length] : words.join(' '), c);
  }

  /** The node a conversation opens on: the first `start` entry whose condition holds. */
  function startNode(t, c = camp()) {
    if (typeof t.start === 'string') return t.start;
    for (const s of t.start) {
      if (typeof s === 'string') return s;
      if (test(s.if, c)) return s.node;
    }
    return Object.keys(t.nodes)[0];
  }

  /** Begin talking: returns a conversation { dialogue, node, text, options }. */
  function talk(dialogueId, c = camp()) {
    const t = tree(dialogueId);
    if (!t) return null;
    const s = state(c);
    const visit = s.visits[dialogueId] || 0;
    s.visits[dialogueId] = visit + 1;
    const conv = view(dialogueId, startNode(t, c), c, visit);
    emit('talk', { dialogue: dialogueId, node: conv.node }, c);
    return conv;
  }

  function view(dialogueId, nodeId, c = camp(), visit = state(c).visits[dialogueId] || 0) {
    const t = tree(dialogueId);
    const node = t.nodes[nodeId];
    const options = (node.options || [])
      .map((o, i) => ({ ...o, index: i, text: format(o.text, c) }))
      .filter((o) => test(o.if, c));
    return { dialogue: dialogueId, speaker: format(t.speaker, c), node: nodeId, text: nodeText(node, c, Math.max(0, visit)), options, services: node.services !== false };
  }

  /** Pick an option: apply its effects and move on. Returns the next view, or null when the talk ends. */
  function choose(conv, index, c = camp()) {
    const t = tree(conv.dialogue);
    const o = t.nodes[conv.node].options?.[index];
    if (!o || !test(o.if, c)) return conv;
    apply(o.do, c, { quest: o.quest, reason: `dialogue ${conv.dialogue}` });
    CL.diag.log('info', 'Dialogue choice', { dialogue: conv.dialogue, node: conv.node, option: index });
    if (!o.next) return null;
    const next = view(conv.dialogue, o.next, c);
    emit('talk', { dialogue: conv.dialogue, node: o.next }, c);
    return next;
  }

  /** Conversations on offer at a settlement (dialogues with `place`, a settlement or a place role). */
  function peopleAt(sid, c = camp()) {
    return Object.values(CL.content.table('dialogue')).filter((t) => t.place && resolve(t.place, c) === sid && test(t.visible, c));
  }

  /** A dialogue's speaker, as cast. */
  const speakerOf = (t, c = camp()) => format(t.speaker, c);

  /** A cast dialogue's look in the streets: its own, else its person's, else a traveller's. */
  function lookOf(t, c = camp()) {
    const p = typeof t.cast === 'string' ? person(t.cast, c) : null;
    return { tag: t.tag || p?.tag || 'Traveller', frames: t.frames || p?.frames || [72, 73, 74, 75] };
  }

  // ---- Journal ----

  /** Quest Journal rows (GDD screen 10): active first, then finished. */
  function journal(c = camp()) {
    const rows = [];
    for (const [id, r] of Object.entries(state(c).quests)) {
      const q = quest(id);
      if (!q) continue;
      const stage = q.stages.find((st) => st.id === r.stage);
      const left = deadlineLeft(c, id);
      const objective = stage ? format(stage.journal, c) + (left !== null ? ` (${Math.max(0, left).toFixed(1)} days left)` : '') : null;
      rows.push({ id, title: format(q.title, c), status: r.status, objective, notes: r.notes.slice(), summary: format(q.summary || '', c), side: Boolean(q.side) });
    }
    const order = { active: 0, done: 1, failed: 2 };
    return rows.sort((a, b) => order[a.status] - order[b.status]);
  }

  /** The quest to show in the HUD strip: the most recently started active one. */
  function currentQuest(c = camp()) {
    const active = Object.entries(state(c).quests).filter(([, r]) => r.status === 'active');
    if (!active.length) return null;
    active.sort((a, b) => b[1].startedDay - a[1].startedDay);
    const [id, r] = active[0];
    const q = quest(id);
    const left = deadlineLeft(c, id);
    const objective = format(q.stages.find((st) => st.id === r.stage)?.journal || '', c) + (left !== null ? ` (${Math.max(0, left).toFixed(1)} days left)` : '');
    return { id, title: format(q.title, c), objective };
  }

  // ---- Content checks (called by ContentDB.validate) ----

  // A realm, place or site, or a role of its kind (P10-04).
  const roleOf = (v) => (isRole(v) ? v.slice(1) : null);
  const realmKnown = (v, C) => (roleOf(v) ? REALM_ROLES.includes(roleOf(v)) : Boolean(C.factions?.[v]));
  const placeKnown = (v, C) => (roleOf(v) ? PLACE_ROLES.includes(roleOf(v)) : Boolean(C.settlements?.[v]));
  const fortKnown = (v, C) => (roleOf(v) ? ['fort', 'rival_fort'].includes(roleOf(v)) : C.settlements?.[v]?.type === 'fort');
  const spotKnown = (v, C) => {
    const map = Object.values(C.world_map || {})[0];
    return roleOf(v) ? [...PLACE_ROLES, 'camp'].includes(roleOf(v)) : Boolean(C.settlements?.[v] || map?.sites?.[v]);
  };

  function checkCond(cond, C, where, err) {
    if (cond == null) return;
    if (Array.isArray(cond)) {
      for (const x of cond) checkCond(x, C, where, err);
      return;
    }
    if (typeof cond !== 'object') {
      err(`${where}: condition must be an object`);
      return;
    }
    const k = COND_KEYS.find((key) => key in cond);
    if (!k) {
      err(`${where}: unknown condition ${JSON.stringify(cond)}`);
      return;
    }
    if (k === 'all' || k === 'any') {
      if (!Array.isArray(cond[k])) err(`${where}: ${k} needs a list`);
      else for (const x of cond[k]) checkCond(x, C, where, err);
      return;
    }
    if (k === 'not') {
      checkCond(cond.not, C, where, err);
      return;
    }
    if (k === 'quest') {
      if (!C.quests?.[cond.quest]) err(`${where}: unknown quest ${cond.quest}`);
      else if ('stage' in cond && !C.quests[cond.quest].stages.some((s) => s.id === cond.stage)) err(`${where}: unknown stage ${cond.stage}`);
      if ('is' in cond && !['unstarted', ...QUEST_STATUS].includes(cond.is)) err(`${where}: bad quest status ${cond.is}`);
    }
    if ((k === 'rep' || k === 'standing') && !realmKnown(cond[k], C)) err(`${where}: unknown faction ${cond[k]}`);
    if (k === 'has' && !C.items?.[cond.has]) err(`${where}: unknown item ${cond.has}`);
    if ((k === 'owner' || k === 'at') && !placeKnown(cond[k], C)) err(`${where}: unknown settlement ${cond[k]}`);
    if (k === 'owner' && 'is' in cond && !realmKnown(cond.is, C)) err(`${where}: unknown faction ${cond.is}`);
    if (k === 'background' && !C.backgrounds?.[cond.background]) err(`${where}: unknown background ${cond.background}`);
    if (k === 'skill' && !C.skills?.[cond.skill]) err(`${where}: unknown skill ${cond.skill}`);
    if (k === 'companion' && !C.companions?.[cond.companion]) err(`${where}: unknown companion ${cond.companion}`);
    if (k === 'veteran' && !(Number.isInteger(cond.veteran) && cond.veteran >= 0)) err(`${where}: veteran needs a number of battles`);
    if (k === 'follower' && !['quartermaster', 'merchant'].includes(cond.follower)) err(`${where}: unknown follower ${cond.follower}`);
  }

  function checkEffects(list, C, where, err, questId) {
    if (list == null) return;
    if (!Array.isArray(list)) return err(`${where}: effects must be a list`);
    for (const e of list) {
      const k = EFFECT_KEYS.find((key) => e && key in e);
      if (!k) {
        err(`${where}: unknown effect ${JSON.stringify(e)}`);
        continue;
      }
      if (k === 'set' && 'to' in e && !isFlagValue(e.to)) err(`${where}: flag ${e.set} needs a simple value`);
      if (k === 'add' && 'by' in e && !Number.isFinite(e.by)) err(`${where}: add needs a number`);
      if (['gold', 'renown', 'xp', 'food'].includes(k) && !Number.isFinite(e[k])) err(`${where}: ${k} needs a number`);
      if (k === 'rep' && (!realmKnown(e.rep, C) || !Number.isFinite(e.by))) err(`${where}: bad rep effect`);
      if ((k === 'give' || k === 'take') && !C.items?.[e[k]]) err(`${where}: unknown item ${e[k]}`);
      if (k === 'recruit' && !C.troops?.[e.recruit]) err(`${where}: unknown troop ${e.recruit}`);
      if (['start', 'complete', 'fail'].includes(k) && !C.quests?.[e[k]]) err(`${where}: unknown quest ${e[k]}`);
      if (k === 'stage') {
        const q = C.quests?.[e.quest || questId];
        if (!q) err(`${where}: stage effect needs a quest`);
        else if (!q.stages.some((s) => s.id === e.stage)) err(`${where}: unknown stage ${e.stage}`);
      }
      if (k === 'owner' && (!fortKnown(e.owner, C) || !realmKnown(e.to, C))) err(`${where}: bad owner effect`);
      if (['companion', 'part', 'send', 'recall'].includes(k) && !C.companions?.[e[k]]) err(`${where}: unknown companion ${e[k]}`);
      if (k === 'retinue' && !C.companions?.[e.retinue]?.retinue) err(`${where}: unknown retinue companion ${e.retinue}`);
      if (k === 'ending' && !C.quests?.[e.quest || questId]?.endings?.[e.ending]) err(`${where}: unknown ending ${e.ending}`);
      if (k === 'honourVeteran' && !Number.isFinite(e.honourVeteran)) err(`${where}: honourVeteran needs a number`);
      if (e.if) checkCond(e.if, C, where, err);
    }
  }

  function validate(C, err) {
    // P10-04: every realm that can be cast has its story people, banner and forces.
    for (const f of Object.values(C.factions || {})) {
      const st = f.story;
      if (!st) continue;
      for (const k of ['agent', 'caravan']) if (!st[k]?.name || !st[k]?.short || !['he', 'she', 'they'].includes(st[k]?.he)) err(`faction ${f.id}: story ${k} needs a name, short and he/she/they`);
      if (!st.banner || !st.colour || !st.court) err(`faction ${f.id}: story needs a banner, a colour and a court`);
      if (/s$/.test(st.banner || '')) err(`faction ${f.id}: story banner is one thing ("the Crown"), for the text's verbs`);
      if (!st.agent?.title) err(`faction ${f.id}: story agent needs a title`);
      if (C.party_templates?.[st.patrol]?.kind !== 'patrol' || C.party_templates[st.patrol].faction !== f.id) err(`faction ${f.id}: story patrol must be its own patrol`);
      for (const force of ['column', 'host']) {
        const t = st[force] || {};
        if (!Object.keys(t).length || Object.entries(t).some(([id, n]) => !C.troops?.[id] || !(Number.isInteger(n) && n > 0))) err(`faction ${f.id}: bad story ${force}`);
      }
    }
    for (const [id, t] of Object.entries(C.dialogue || {})) {
      const w = `dialogue ${id}`;
      if (t.id !== id) err(`${w}: id is '${t.id}'`);
      if (!t.speaker) err(`${w}: needs a speaker`);
      if (!t.nodes || !Object.keys(t.nodes).length) {
        err(`${w}: no nodes`);
        continue;
      }
      if (t.place && !placeKnown(t.place, C)) err(`${w}: unknown place ${t.place}`);
      if (t.cast != null && !PEOPLE_ROLES.includes(t.cast)) err(`${w}: unknown cast role ${t.cast}`);
      checkCond(t.visible, C, w, err);
      const starts = typeof t.start === 'string' ? [t.start] : t.start || [];
      for (const s of starts) {
        const n = typeof s === 'string' ? s : s.node;
        if (!t.nodes[n]) err(`${w}: start goes to unknown node ${n}`);
        if (typeof s !== 'string') checkCond(s.if, C, w, err);
      }
      if (!starts.length) err(`${w}: needs a start`);
      for (const [nid, node] of Object.entries(t.nodes)) {
        const wn = `${w}.${nid}`;
        const entries = Array.isArray(node.text) ? node.text : [node.text];
        if (!entries.length || entries.some((x) => typeof x !== 'string' && typeof x?.text !== 'string')) err(`${wn}: needs text`);
        for (const x of entries) if (typeof x === 'object') checkCond(x.if, C, wn, err);
        for (const o of node.options || []) {
          if (!o.text) err(`${wn}: option needs text`);
          if (o.next && !t.nodes[o.next]) err(`${wn}: option goes to unknown node ${o.next}`);
          if (o.quest && !C.quests?.[o.quest]) err(`${wn}: unknown quest ${o.quest}`);
          checkCond(o.if, C, wn, err);
          checkEffects(o.do, C, wn, err, o.quest);
        }
      }
    }
    for (const [id, q] of Object.entries(C.quests || {})) {
      const w = `quest ${id}`;
      if (!q.title || !q.stages?.length) {
        err(`${w}: needs a title and stages`);
        continue;
      }
      if (!C.dialogue?.[q.giver]) err(`${w}: no dialogue for giver ${q.giver}`);
      const ids = new Set();
      for (const st of q.stages) {
        if (!st.id || ids.has(st.id)) err(`${w}: missing or repeated stage id ${st.id}`);
        ids.add(st.id);
        if (!st.journal) err(`${w}.${st.id}: needs a journal line`);
        checkEffects(st.begin, C, `${w}.${st.id} begin`, err, id);
        checkEffects(st.expire, C, `${w}.${st.id} expire`, err, id);
        if (st.expire && !(st.deadline > 0)) err(`${w}.${st.id}: expire needs a deadline`);
        for (const b of stageBands(st)) {
          const known = (x) => spotKnown(x, C);
          if (b.realm) {
            if (!realmKnown(b.realm, C) || !['column', 'host'].includes(b.force) || b.template || b.troops) err(`${w}.${st.id}: a realm's band needs a force (column or host), and no template or troops`);
          } else if (!['bandit', 'patrol'].includes(C.party_templates?.[b.template]?.kind)) err(`${w}.${st.id}: band needs a bandit or patrol template`);
          if (b.map && !C.battle_maps?.[b.map]) err(`${w}.${st.id}: unknown battle map ${b.map}`);
          if (!/^[a-z0-9_:]{1,81}$/.test(b.tag || '')) err(`${w}.${st.id}: band needs a tag`);
          if (b.between ? !(b.between.length === 2 && b.between.every(known)) : !known(b.near)) err(`${w}.${st.id}: band needs a known place`);
          if (b.along != null && !(b.between && typeof b.along === 'number' && b.along >= 0 && b.along <= 1)) err(`${w}.${st.id}: along must be 0–1, between two places`);
          for (const [tid, n] of Object.entries(b.troops || {})) {
            if (!C.troops?.[tid] || !(Number.isInteger(n) && n > 0)) err(`${w}.${st.id}: bad band troop ${tid}`);
          }
        }
        for (const t of st.on || []) {
          if (!EVENTS.includes(t.event)) err(`${w}.${st.id}: unknown event ${t.event}`);
          checkCond(t.if, C, `${w}.${st.id}`, err);
          checkEffects(t.do, C, `${w}.${st.id}`, err, id);
        }
      }
      for (const f of Object.keys(q.rewards?.rep || {})) if (!realmKnown(f, C)) err(`${w}: unknown faction ${f} in rewards`);
      for (const [key, e] of Object.entries(q.endings || {})) {
        if (!e.title || !e.text) err(`${w}: ending ${key} needs a title and text`);
        if (e.relations) {
          const r = e.relations;
          const ok = Array.isArray(r.between) && r.between.length === 2 && r.between[0] !== r.between[1] && r.between.every((f) => realmKnown(f, C)) && ['peace', 'tension', 'war'].includes(r.to);
          if (!ok) err(`${w}: ending ${key} relations need two kingdoms and peace, tension or war`);
        }
        for (const x of Array.isArray(e.text) ? e.text : [e.text]) if (typeof x === 'object') checkCond(x.if, C, `${w}: ending ${key}`, err);
      }
    }
  }

  // ---- Save ----

  function sanitize(s, d) {
    s.story = blank(s.startRealm); // the cast: from the realm the game began in, as the data casts it
    const src = d?.story;
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src.flags || {}).slice(0, MAX_FLAGS)) {
      if (typeof k === 'string' && k.length <= 60 && isFlagValue(v)) s.story.flags[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
    for (const [id, r] of Object.entries(src.quests || {})) {
      const q = quest(id);
      if (!q || !QUEST_STATUS.includes(r?.status)) continue;
      const stage = r.status === 'active' ? (q.stages.some((st) => st.id === r.stage) ? r.stage : q.stages[0].id) : null;
      const day = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0);
      s.story.quests[id] = {
        status: r.status,
        stage,
        notes: Array.isArray(r.notes) ? r.notes.filter((n) => typeof n === 'string').slice(-MAX_NOTES).map((n) => n.slice(0, 300)) : [],
        startedDay: day(r.startedDay),
        stageDay: day(r.stageDay ?? r.startedDay),
      };
      if (r.status === 'active' && r.expired === stage) s.story.quests[id].expired = stage;
      if (r.status !== 'active') s.story.quests[id].endedDay = day(r.endedDay);
    }
    for (const [id, n] of Object.entries(src.visits || {})) {
      if (tree(id) && Number.isInteger(n) && n >= 0) s.story.visits[id] = Math.min(n, 99999);
    }
  }

  CL.story = {
    EVENTS,
    ROLES,
    blank,
    castFor,
    castOf,
    startRealms,
    startOf,
    defaultRealm,
    resolve,
    person,
    homeLand,
    locksFort,
    holdsPair,
    streetDialogue,
    speakerOf,
    lookOf,
    bandOf,
    state,
    test,
    apply,
    start,
    setStage,
    finish,
    opening,
    questStatus,
    ensureBands,
    bandSpec,
    tick,
    deadlineLeft,
    endingView,
    emit,
    format,
    nodeText,
    talk,
    view,
    choose,
    peopleAt,
    journal,
    currentQuest,
    validate,
    checkCondition: checkCond,
    sanitize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
