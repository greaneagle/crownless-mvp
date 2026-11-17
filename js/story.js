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
 *
 * A stage may also need a band on the map: band: { template, tag, troops, name?, text?, camp?, map?, near | between: [a, b] }
 * (camp: true holds its ground and only fights if the player goes to it; otherwise it ambushes)
 * (settlement or site ids). It is spawned when the stage begins, re-spawned if lost while the stage
 * is active (so nothing soft-locks), and removed once no active stage needs it. Battles against it
 * carry its tag: match: { tag: 'q1_ambush' }.
 *
 * Text may use {name}, {gold}, {renown}, {settlement} and {flag:some_flag}. Story state lives in `campaign.story`. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const EVENTS = ['battle', 'enter', 'recruit', 'trade', 'contract', 'talk', 'parley'];
  const QUEST_STATUS = ['active', 'done', 'failed'];
  const MAX_FLAGS = 200;
  const MAX_NOTES = 20;
  const COND_KEYS = ['flag', 'not', 'all', 'any', 'quest', 'gold', 'renown', 'level', 'soldiers', 'rep', 'standing', 'skill', 'attribute', 'background', 'has', 'owner', 'at', 'companion', 'room'];
  const EFFECT_KEYS = ['set', 'clear', 'add', 'gold', 'renown', 'xp', 'food', 'rep', 'give', 'take', 'recruit', 'start', 'stage', 'complete', 'fail', 'owner', 'message', 'note', 'companion', 'part', 'send', 'recall', 'ending'];

  const camp = () => CL.campaign;
  const quest = (id) => CL.content.table('quests')[id] || null;
  const tree = (id) => CL.content.table('dialogue')[id] || null;
  const isFlagValue = (v) => ['boolean', 'string'].includes(typeof v) || (typeof v === 'number' && Number.isFinite(v));

  function blank() {
    return { flags: {}, quests: {}, visits: {} };
  }

  const state = (c = camp()) => {
    if (!c.story) c.story = blank();
    return c.story;
  };

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
    if ('rep' in cond) return compare(CL.realm.score(c, cond.rep), cond);
    if ('standing' in cond) return CL.realm.standing(c, cond.standing) === cond.is;
    if ('skill' in cond) return compare(CL.character.skill(cond.skill, c), cond);
    if ('attribute' in cond) return compare(CL.character.attribute(cond.attribute, c), cond);
    if ('background' in cond) return c.character?.background === cond.background;
    if ('has' in cond) return (c.inventory[cond.has] || 0) > 0 || Object.values(c.equipment || {}).includes(cond.has);
    if ('owner' in cond) return CL.realm.owner(cond.owner, c) === cond.is;
    if ('at' in cond) return c.world.location === cond.at;
    if ('companion' in cond) return cond.is === 'fit' ? CL.companion.fit(c) && CL.companion.has(c, cond.companion) : CL.companion.has(c, cond.companion);
    if ('room' in cond) return CL.party.partyCap(c) - c.roster.length - CL.companion.slots(c) >= cond.room;
    return false;
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
    else if ('gold' in e) c.gold = Math.max(0, c.gold + e.gold);
    else if ('renown' in e) c.renown = Math.max(0, c.renown + e.renown);
    else if ('xp' in e) CL.character.gainXp(e.xp, c);
    else if ('food' in e) c.food = Math.max(0, c.food + e.food);
    else if ('rep' in e) CL.realm.adjust(c, e.rep, e.by, ctx.reason || 'story');
    else if ('give' in e) c.inventory[e.give] = (c.inventory[e.give] || 0) + (e.n || 1);
    else if ('take' in e) {
      const left = (c.inventory[e.take] || 0) - (e.n || 1);
      if (left > 0) c.inventory[e.take] = left;
      else delete c.inventory[e.take];
    } else if ('recruit' in e) {
      for (let i = 0; i < (e.n || 1) && c.roster.length + CL.companion.slots(c) < CL.party.partyCap(c); i++) {
        const s = CL.save.addSoldier(c, e.recruit);
        CL.events.emit(c, 'SoldierRecruited', { soldierId: s.id, troop: e.recruit, settlement: c.world?.location ?? null, via: 'story' });
      }
    } else if ('start' in e) start(c, e.start);
    else if ('stage' in e) setStage(c, e.quest || ctx.quest, e.stage);
    else if ('complete' in e) finish(c, e.complete, 'done');
    else if ('fail' in e) finish(c, e.fail, 'failed');
    else if ('owner' in e) CL.realm.setOwner(c, e.owner, e.to, ctx.reason || 'story');
    else if ('message' in e) CL.ui.message(format(e.message, c));
    else if ('note' in e) note(c, e.quest || ctx.quest, format(e.note, c));
    else if ('companion' in e) CL.companion.join(c, e.companion);
    else if ('part' in e) CL.companion.part(c, e.part, e.reason || 'parted');
    else if ('send' in e) CL.companion.send(c, e.send);
    else if ('recall' in e) CL.companion.recall(c, e.recall);
    else if ('ending' in e) showEnding(c, e.quest || ctx.quest, e.ending);
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
    CL.ui.message(`New quest: ${q.title}`);
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
      if (w.gold) c.gold += w.gold;
      if (w.renown) c.renown += w.renown;
      if (w.xp) CL.character.gainXp(w.xp, c);
      for (const [f, n] of Object.entries(w.rep || {})) CL.realm.adjust(c, f, n, `quest ${id}`);
      CL.ui.message(`Quest complete: ${q.title}${w.gold ? ` · +${w.gold} crowns` : ''}${w.renown ? ` · +${w.renown} renown` : ''}`);
    } else CL.ui.message(`Quest failed: ${q.title}`);
    CL.diag.log('info', 'Quest ended', { quest: id, status });
    ensureBands(c);
    return true;
  }

  function note(c, id, text) {
    const r = state(c).quests[id];
    if (!r || !text) return;
    r.notes.push(text);
    if (r.notes.length > MAX_NOTES) r.notes.shift();
  }

  /** Where a stage band stands: beside a settlement or site, or halfway between two of them. */
  function placeOf(id) {
    const s = CL.content.table('settlements')[id] || CL.world.map().sites[id];
    return s ? { x: s.mapX, y: s.mapY } : null;
  }

  function bandSpot(spec) {
    if (spec.between) {
      const [a, b] = spec.between.map(placeOf);
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    const p = placeOf(spec.near);
    return { x: Math.min(98, p.x + 3), y: Math.min(98, p.y + 2) };
  }

  /** The stage band spec behind a quest band's tag (for its encounter text). */
  function bandSpec(tag, c = camp()) {
    for (const [id, r] of Object.entries(state(c).quests)) {
      const band = r.status === 'active' && quest(id)?.stages.find((st) => st.id === r.stage)?.band;
      if (band?.tag === tag) return band;
    }
    return null;
  }

  /** Keep exactly the bands that active quest stages need on the map. */
  function ensureBands(c = camp()) {
    if (!c?.parties || !c.story) return;
    const wanted = new Map();
    for (const [id, r] of Object.entries(c.story.quests)) {
      if (r.status !== 'active') continue;
      const band = quest(id)?.stages.find((st) => st.id === r.stage)?.band;
      if (band) wanted.set(band.tag, band);
    }
    for (const p of [...c.parties]) {
      if (p.questTag && !wanted.has(p.questTag)) c.parties.splice(c.parties.indexOf(p), 1);
    }
    for (const [tag, spec] of wanted) {
      if (c.parties.some((p) => p.questTag === tag)) continue;
      const at = bandSpot(spec);
      CL.parties.spawnQuestBand(c, spec, at.x, at.y);
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

  const matches = (match, payload) =>
    Object.entries(match || {}).every(([k, v]) => (Array.isArray(v) ? v.includes(payload[k]) : payload[k] === v));

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
      const hit = (stage?.on || []).find((t) => t.event === name && matches(t.match, payload) && test(t.if, c));
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
      .replace(/\{flag:([a-z0-9_]+)\}/g, (_, f) => String(state(c).flags[f] ?? 0));
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
    return { dialogue: dialogueId, speaker: t.speaker, node: nodeId, text: nodeText(node, c, Math.max(0, visit)), options, services: node.services !== false };
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

  /** Conversations on offer at a menu-only settlement (dialogues with `place`). */
  function peopleAt(sid, c = camp()) {
    return Object.values(CL.content.table('dialogue')).filter((t) => t.place === sid && test(t.visible, c));
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
      rows.push({ id, title: q.title, status: r.status, objective, notes: r.notes.slice(), summary: q.summary });
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
    return { id, title: q.title, objective };
  }

  // ---- Content checks (called by ContentDB.validate) ----

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
    if ((k === 'rep' || k === 'standing') && !C.factions?.[cond[k]]) err(`${where}: unknown faction ${cond[k]}`);
    if (k === 'has' && !C.items?.[cond.has]) err(`${where}: unknown item ${cond.has}`);
    if ((k === 'owner' || k === 'at') && !C.settlements?.[cond[k]]) err(`${where}: unknown settlement ${cond[k]}`);
    if (k === 'background' && !C.backgrounds?.[cond.background]) err(`${where}: unknown background ${cond.background}`);
    if (k === 'skill' && !C.skills?.[cond.skill]) err(`${where}: unknown skill ${cond.skill}`);
    if (k === 'companion' && !C.companions?.[cond.companion]) err(`${where}: unknown companion ${cond.companion}`);
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
      if (k === 'rep' && (!C.factions?.[e.rep] || !Number.isFinite(e.by))) err(`${where}: bad rep effect`);
      if ((k === 'give' || k === 'take') && !C.items?.[e[k]]) err(`${where}: unknown item ${e[k]}`);
      if (k === 'recruit' && !C.troops?.[e.recruit]) err(`${where}: unknown troop ${e.recruit}`);
      if (['start', 'complete', 'fail'].includes(k) && !C.quests?.[e[k]]) err(`${where}: unknown quest ${e[k]}`);
      if (k === 'stage') {
        const q = C.quests?.[e.quest || questId];
        if (!q) err(`${where}: stage effect needs a quest`);
        else if (!q.stages.some((s) => s.id === e.stage)) err(`${where}: unknown stage ${e.stage}`);
      }
      if (k === 'owner' && (C.settlements?.[e.owner]?.type !== 'fort' || !C.factions?.[e.to])) err(`${where}: bad owner effect`);
      if (['companion', 'part', 'send', 'recall'].includes(k) && !C.companions?.[e[k]]) err(`${where}: unknown companion ${e[k]}`);
      if (k === 'ending' && !C.quests?.[e.quest || questId]?.endings?.[e.ending]) err(`${where}: unknown ending ${e.ending}`);
      if (e.if) checkCond(e.if, C, where, err);
    }
  }

  function validate(C, err) {
    for (const [id, t] of Object.entries(C.dialogue || {})) {
      const w = `dialogue ${id}`;
      if (t.id !== id) err(`${w}: id is '${t.id}'`);
      if (!t.speaker) err(`${w}: needs a speaker`);
      if (!t.nodes || !Object.keys(t.nodes).length) {
        err(`${w}: no nodes`);
        continue;
      }
      if (t.place && !C.settlements?.[t.place]) err(`${w}: unknown place ${t.place}`);
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
        if (st.band) {
          const b = st.band;
          const map = Object.values(C.world_map || {})[0];
          const known = (x) => Boolean(C.settlements?.[x] || map?.sites?.[x]);
          if (!['bandit', 'patrol'].includes(C.party_templates?.[b.template]?.kind)) err(`${w}.${st.id}: band needs a bandit or patrol template`);
          if (b.map && !C.battle_maps?.[b.map]) err(`${w}.${st.id}: unknown battle map ${b.map}`);
          if (!/^[a-z0-9_]{1,40}$/.test(b.tag || '')) err(`${w}.${st.id}: band needs a tag`);
          if (b.between ? !(b.between.length === 2 && b.between.every(known)) : !known(b.near)) err(`${w}.${st.id}: band needs a known place`);
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
      for (const f of Object.keys(q.rewards?.rep || {})) if (!C.factions?.[f]) err(`${w}: unknown faction ${f} in rewards`);
      for (const [key, e] of Object.entries(q.endings || {})) {
        if (!e.title || !e.text) err(`${w}: ending ${key} needs a title and text`);
        for (const x of Array.isArray(e.text) ? e.text : [e.text]) if (typeof x === 'object') checkCond(x.if, C, `${w}: ending ${key}`, err);
      }
    }
  }

  // ---- Save ----

  function sanitize(s, d) {
    s.story = blank();
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
    blank,
    state,
    test,
    apply,
    start,
    setStage,
    finish,
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
