/* P11-17: town instructors, short lessons on the duel engine, and the practice yard. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const table = () => CL.content.table('training');
  const towns = () => CL.content.table('settlements');
  const rules = () => CL.content.table('practice');
  const instructors = (T = table()) => Object.values(T).filter((m) => Array.isArray(m.teaches));
  const drillKinds = ['bout', 'range', 'course'];
  const errands = ['challenge', 'favour'];
  const done = (c, m) => m.teaches.every((id) => c.character?.training?.[id]);
  const state = (c) => (c.story.training ||= {});
  const record = (c, m) => c.story.training?.[m.id];
  const entry = (c, m) => record(c, m) || { step: 0, retryAt: 0, heard: false };
  const name = (sid) => towns()[sid]?.name || 'town';

  function hostile(c, sid) {
    const holder = CL.realm.owner(sid, c);
    const allegiance = CL.allegiance.serves(c);
    return CL.rights.enemyOf(c, CL.rights.PLAYER, holder) ||
      Boolean(allegiance && allegiance !== holder && CL.realm.relation(c, allegiance, holder) === 'war');
  }

  /** The home is cultural. Only access changes with the flag over the gate. */
  function locations(c, m) {
    const home = towns()[m.place];
    const local = [m.place, ...(m.alsoAt || [])].filter((id) => towns()[id] && !hostile(c, id));
    if (local.length) return local;
    const townsOpen = Object.values(towns()).filter((s) => s.type === 'town' && !hostile(c, s.id));
    const ports = townsOpen.filter((s) => CL.realm.faction(CL.realm.owner(s.id, c), c)?.freeCity);
    const dist = (s) => home ? Math.hypot(s.mapX - home.mapX, s.mapY - home.mapY) : 0;
    return (ports.length ? ports : townsOpen).sort((a, b) => dist(a) - dist(b) || a.id.localeCompare(b.id)).slice(0, 1).map((s) => s.id);
  }

  const here = (c, sid) => instructors().filter((m) => locations(c, m).includes(sid));
  const npc = (m) => ({
    id: m.id, name: m.master, role: m.role, gender: m.gender, tag: 'Master at arms', action: 'training',
    lines: [m.words], weapon: m.steps.find((step) => step.weapon)?.weapon
  });
  const teacher = (c, id) => {
    const m = instructors().find((x) => x.teaches.includes(id));
    const place = m && locations(c, m)[0];
    return place ? { master: m.master, place } : null;
  };
  const available = (c, m) =>
    Boolean(c.character && m && CL.game.mode !== 'battle' && here(c, c.world.location).includes(m));

  function qualification(c, m) {
    const req = m.needs?.req || {};
    const ch = CL.character;
    if (c.renown < (m.needs?.renown || 0)) return `Requires renown ${m.needs.renown}.`;
    for (const a of ['str', 'agi']) if (ch.baseAttribute(a, c) < (req[a] || 0)) return `Requires ${ch.ATTRIBUTE_NAMES[a]} ${req[a]}.`;
    for (const [id, n] of Object.entries(req.skills || {})) {
      if (ch.baseSkill(id, c) < n) return `Requires ${CL.content.table('skills')[id].name} ${n}.`;
    }
    return '';
  }

  function hear(c, m) {
    if (!available(c, m) || done(c, m) || entry(c, m).step !== 0) return false;
    state(c)[m.id] = { ...entry(c, m), step: 1, heard: true };
    return true;
  }

  function pay(c, m) {
    if (!available(c, m) || done(c, m) || entry(c, m).step !== 1 || qualification(c, m)) return false;
    if (m.fee && !CL.accounts.spend(c, m.fee, `training: ${m.title}`)) return false;
    state(c)[m.id].step = 2;
    return true;
  }

  function abandon(c, m) {
    if (!available(c, m) || done(c, m) || !record(c, m)?.step) return false;
    state(c)[m.id] = { step: 0, heard: true, retryAt: entry(c, m).retryAt };
    return true;
  }

  function canRetrain(c, m) {
    const spent = c.character?.spent;
    return available(c, m) && c.gold >= rules().retrain &&
      Boolean(Object.keys(spent.attributes).length || Object.keys(spent.skills).length);
  }

  function retrain(c, m) {
    if (!canRetrain(c, m) || !CL.accounts.spend(c, rules().retrain, 'retraining')) return false;
    return CL.character.retrain(c);
  }

  function yard(c, sid = c.world.location) {
    if (towns()[sid]?.type !== 'town' || hostile(c, sid)) return false;
    return CL.tourney.rules().hosts.includes(sid) || Boolean(CL.town.cast(sid, 'guard')) || here(c, sid).length > 0;
  }

  function kitFor(c, step, lesson) {
    const kit = lesson ? { ...CL.tourney.rules().kit, weapon: step.weapon, horse: step.horse } : { ...c.equipment };
    if (step.kind !== 'course') delete kit.horse;
    if (step.kind === 'range' || step.kind === 'course') {
      const isFit = (id) => {
        if (!id || !CL.gear.meets(c, id)) return false;
        const { item, family } = CL.profile.weaponOf(id);
        return step.kind === 'range' ? Boolean(family.ranged) : (item?.combat?.mounted ?? family.mounted) !== 'no';
      };
      const weapon = [kit.weapon, kit.weapon2].find(isFit);
      if (!weapon) return null;
      kit.weapon = weapon;
      delete kit.weapon2;
    }
    return kit;
  }

  function readiness(c, step, lesson = false) {
    if (!drillKinds.includes(step?.kind)) return 'There is no drill to begin.';
    const kit = kitFor(c, step, lesson);
    if (!kit) return step.kind === 'range' ? 'Equip a bow or crossbow you can use.' : 'Equip a weapon you can use in the saddle.';
    if (step.kind === 'course' && !CL.gear.rideState(c, kit, 'primary', { mounts: true }).ride) return 'Equip a battle horse you can ride and choose to ride into battle.';
    return '';
  }

  function start(c, step, master = null) {
    const kit = kitFor(c, step, Boolean(master));
    const lists = CL.tourney.rules().map;
    const base = CL.arena.mapFor(lists);
    const map = { ...base, mounts: step.kind === 'course' };
    const targets = step.kind !== 'bout';
    const points = targets ? rules().targets : [];
    const troop = step.troop || 'looter';
    const style = step.style || null;
    const opponent = { name: master?.master || (targets ? 'Target' : 'Sparring partner'), hp: master ? 30 : 46, damage: master ? 9 : 11, armor: 0, style };
    const session = { master: master?.id || null, resultId: master ? c.nextResultId++ : null, step: master ? entry(c, master).step : null, place: c.world.location, kind: step.kind };
    if (master) {
      state(c)[master.id].attempt = session.resultId;
      CL.save.write();
    }
    CL.combat.startBattle({
      id: 'training_drill', name: rules().names[step.kind], lesson: session, mapDef: map,
      waves: [{ [troop]: targets ? points.length : 1 }], duel: { opponent, kit }
    });
    CL.game.enemies.forEach((u, i) => {
      if (targets) {
        const [x, y] = points[i];
        Object.assign(u, { drillTarget: step.kind, x, y, speed: 0, reach: 0, hp: 7, maxhp: 7, damage: 0, armor: 0, ranged: null, canBlock: false, guardKind: 'none' });
      }
    });
    CL.ui.message(targets ? 'Hit all three targets. Leave the yard at any time.' : 'Win the bout or leave the yard to stop.');
    return true;
  }

  function lesson(c, m) {
    if (!available(c, m) || done(c, m) || qualification(c, m)) return false;
    const p = entry(c, m);
    const step = m.steps[p.step];
    if (p.retryAt > c.day || p.attempt || readiness(c, step, true)) return false;
    return start(c, step, m);
  }

  function practice(c, kind, style) {
    if (CL.game.mode === 'battle' || !c.character || !yard(c)) return false;
    const step = { kind, style, troop: style === 'shield_wall' ? 'footman' : 'looter' };
    if (kind === 'bout' && !rules().sparring.includes(style)) return false;
    return !readiness(c, step) && start(c, step);
  }

  function advance(c, m) {
    const p = state(c)[m.id];
    p.step++;
    p.retryAt = 0;
    if (p.step < m.steps.length) return 'Good work. Speak to your master for the next step.';
    for (const id of m.teaches) c.character.training[id] = true;
    return `Training complete. You learned ${m.title.toLowerCase()}.`;
  }

  function report(c, kind, detail) {
    for (const m of instructors()) {
      const p = record(c, m);
      const step = m.steps[p?.step];
      if (step?.kind !== kind || done(c, m) || p.retryAt > c.day) continue;
      const matched = kind === 'challenge' ? (!step.host || detail.host === step.host) && detail.round >= step.round :
        detail.template === step.template && locations(c, m).includes(detail.giver);
      if (matched) CL.ui.message(advance(c, m));
    }
  }

  const objective = (step) => step?.kind === 'challenge' ? `Reach round ${step.round} of the lists${step.host ? ` at ${name(step.host)}` : ''}.` :
    step?.kind === 'favour' ? 'Complete the named contract from the master’s town and collect the reward.' : rules().names[step?.kind];

  function end(win) {
    const g = CL.game;
    const s = g.encounterDef.lesson;
    if (s.finished) return;
    s.finished = true;
    if (s.kind === 'course' && !g.hero.mounted) win = false;
    const c = CL.campaign;
    const m = table()[s.master];
    const p = m && record(c, m);
    let text = win ? 'You finished the drill.' : 'The drill ended.';
    if (p?.attempt && p.attempt === s.resultId && p.step === s.step) {
      delete p.attempt;
      if (!win) {
        p.retryAt = c.day + 1;
        text = 'Rest a day before trying the lesson again. Your fee is paid.';
      } else text = advance(c, m);
    }
    CL.chronicle.add(c, { day: c.day, kind: 'practice', event: s.kind, place: s.place, win });
    g.result = { win, training: { text }, html: '' };
    CL.save.write();
    CL.ui.changeMode('result');
    return g.result;
  }

  function tick(c) {
    if (!c.character) return;
    const m = instructors().find((x) => !done(c, x) && !record(c, x)?.heard && !qualification(c, x) && locations(c, x).length);
    if (!m) return;
    const place = locations(c, m)[0];
    state(c)[m.id] = { ...entry(c, m), heard: true };
    CL.news.record(c, 'master_training', { place, text: rumour(m, place) });
  }

  const rumour = (m, place) => `${m.master} teaches ${m.title.toLowerCase()} at ${name(place)}.`;
  function townRumour(c, sid) {
    const m = instructors().find((x) => !done(c, x) && !qualification(c, x) && locations(c, x).includes(sid));
    if (!m) return '';
    state(c)[m.id] = { ...entry(c, m), heard: true };
    return rumour(m, sid);
  }

  function journal(c) {
    return instructors().filter((m) => record(c, m)?.heard || done(c, m)).map((m) => {
      const p = entry(c, m);
      const place = locations(c, m)[0];
      const next = done(c, m) ? 'Complete' : p.retryAt > c.day ? 'Try again after a day of rest' :
        ['Speak to the master', 'Pay the lesson fee'][p.step] || objective(m.steps[p.step]) || 'Speak to the master';
      return `${m.title} · ${m.master}${place ? ` at ${name(place)}` : ''} · ${next}`;
    });
  }

  function sanitize(c, raw) {
    c.story.training = {};
    for (const m of instructors()) {
      const r = raw?.[m.id];
      if (r?.heard !== true) continue;
      const last = done(c, m) ? m.steps.length : m.steps.length - 1;
      const step = Number.isInteger(r.step) ? Math.max(0, Math.min(last, r.step)) : 0;
      const retryAt = Number.isSafeInteger(r.attempt) && r.attempt > 0 ? c.day + 1 : Number.isFinite(r.retryAt) ? Math.max(0, Math.min(c.day + 1, r.retryAt)) : 0;
      c.story.training[m.id] = { step, retryAt, heard: true };
    }
  }

  function validate(C, err) {
    const T = C.training || {};
    // Partial validation copies omit these global tables. A whole world supplies its own overrides.
    const practice = C.practice === undefined ? rules() : C.practice || {};
    const styles = C.fighting_styles ?? CL.content.table('fighting_styles');
    if (!Number.isInteger(practice.retrain) || practice.retrain < 1 ||
        !Array.isArray(practice.sparring) || !practice.sparring.length || practice.sparring.some((id) => !styles[id]) ||
        !Array.isArray(practice.targets) || practice.targets.length !== 3 ||
        practice.targets.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((x) => !Number.isFinite(x))) ||
        drillKinds.some((k) => typeof practice.names?.[k] !== 'string' || !practice.names[k].trim())) err('practice: invalid yard rules');
    for (const u of Object.values(T)) {
      if (u.teaches != null && !Array.isArray(u.teaches)) err(`training ${u.id}: teaches needs a list of unlocks`);
    }
    const seen = new Set();
    const world = Object.values(C.world_map || {})[0];
    for (const m of instructors(T)) {
      const at = `training ${m.id}`;
      const here = C.settlements?.[m.place];
      if ((here && here.type !== 'town') || (!here && (!world?.sandbox || m.id.includes(':')))) err(`${at}: unknown training town ${m.place}`);
      if (m.alsoAt != null && (!Array.isArray(m.alsoAt) || m.alsoAt.some((id) => C.settlements?.[id]?.type !== 'town' && (!world?.sandbox || m.id.includes(':'))))) err(`${at}: alsoAt needs training towns`);
      if (!CL.town.ROLES.includes(m.role) || typeof m.master !== 'string' || !m.master.trim() ||
          typeof m.title !== 'string' || !m.title.trim() || typeof m.words !== 'string' || !Number.isInteger(m.fee) || m.fee < 0) err(`${at}: needs a master, role, title, words and fee`);
      if (!m.teaches.length) err(`${at}: needs an unlock`);
      for (const id of m.teaches) {
        if (!T[id] || T[id].teaches || seen.has(id)) err(`${at}: unknown or already taught unlock ${id}`);
        seen.add(id);
      }
      if (m.needs?.renown != null && (!Number.isInteger(m.needs.renown) || m.needs.renown < 0)) err(`${at}: invalid renown requirement`);
      for (const a of ['str', 'agi']) {
        const n = m.needs?.req?.[a];
        if (n != null && (!Number.isInteger(n) || n < 5 || n > 16)) err(`${at}: invalid ${a} requirement`);
      }
      for (const [id, n] of Object.entries(m.needs?.req?.skills || {})) if (!C.skills?.[id] || !Number.isInteger(n) || n < 1 || n > CL.character.MAX_SKILL) err(`${at}: invalid skill requirement ${id}`);
      const steps = m.steps;
      if (!Array.isArray(steps) || steps.length < 3 || steps[0]?.kind !== 'talk' || steps[1]?.kind !== 'pay') {
        err(`${at}: needs talk, pay and a drill`);
        continue;
      }
      for (const step of steps.slice(2)) {
        if (step?.kind === 'challenge' && Number.isInteger(step.round) && step.round >= 1 && step.round <= 3 &&
          (!step.host || Object.values(C.tournaments || {}).some((t) => t.hosts.includes(step.host)))) continue;
        if (step?.kind === 'favour' && C.contracts?.[step.template]) continue;
        const item = C.items?.[step?.weapon];
        const family = C.weapon_families?.[item?.family];
        const mount = C.items?.[step?.horse]?.mount;
        if (!step || !drillKinds.includes(step.kind) || item?.slot !== 'weapon' ||
          (step.kind === 'range' && !family?.ranged) ||
          (step.kind === 'course' && (!mount || mount.battle === 'no' || (item?.combat?.mounted ?? family?.mounted) === 'no')) ||
          (step.style && !styles[step.style]) ||
          (step.troop && (!C.troops?.[step.troop] || C.troops[step.troop].role === 'hero'))) err(`${at}: invalid drill`);
      }
    }
    for (const it of Object.values(C.items || {})) {
      const id = it.req?.training;
      if (it.region && id && !seen.has(id)) err(`item ${it.id}: regional unlock ${id} has no instructor`);
    }
    for (const u of Object.values(T)) if (!u.teaches) {
      for (const [id, n] of Object.entries(u.skills || {})) if (!C.skills?.[id] || n !== 1) err(`training ${u.id}: invalid skill grant ${id}`);
    }
  }

  CL.training = { table, instructors, done, entry, locations, here, npc, teacher, qualification, hear, pay, abandon, canRetrain, retrain, yard, readiness, lesson, practice, end, tick, report, objective, errands, townRumour, journal, sanitize, validate };
})(typeof window !== 'undefined' ? window : globalThis);
