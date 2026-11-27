// @ts-check
/* Crownless tournaments (P7-09; decision D-P7c: foot-melee duels in the great towns). The rules and
 * numbers are in data/tournaments.js.
 *
 * Each host town holds a tournament every `every` days, announced in the news; entries stay open for
 * `openDays`. Eight fighters on foot: the hero and seven named fighters of the town's people (your
 * rival among them, if you have one, seeded to meet you only in the final). Three bouts: the first,
 * the semi-final and the final, each harder. The other fighters' bouts are settled by their skill.
 *
 * A bout is a duel on the battle engine (js/combat.js, `duel`): the hero alone against one fighter on a
 * one-screen tourney ground, no soldiers, reserves, help, morale or orders. The hero fights in the
 * tournament's loaner kit: their own gear is never moved (so nothing can be lost, even by reloading
 * mid-bracket). A bout's result goes to the bracket, never the encounter commit path: no casualties,
 * loot, time or reputation from bouts themselves.
 *
 * Entry costs a fee that rises with renown. The champion wins crowns, renown, standing with the host's
 * kingdom and a chronicle line; the finalist less; falling in the first bout costs a little renown,
 * never the company. Whoever beats you becomes your named rival (or, if you win, the finalist you beat).
 * Anti-farm: a cooldown per town, prizes that fall with each earlier win in that town (never below a
 * floor) and fees that rise with renown, so winning again and again in one town soon pays nothing.
 *
 * A bout left unfinished (the page reloaded mid-fight) counts as lost: the bracket keeps `bout` until the
 * bout ends, and `settle` forfeits it outside a battle.
 * State: c.tourney = { hosts, open, bracket, rival } (saved, schema v17). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RIVAL_SKILL_MAX = 1.5;
  const RESULTS = ['champion', 'final', 'out'];

  const rules = () => Object.values(CL.content.table('tournaments'))[0];
  const settlement = (id) => CL.content.table('settlements')[id] || null;
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const short = (s, n = 40) => (typeof s === 'string' ? s.slice(0, n) : '');

  /** @param {number} [day] */
  function blank(day = 0) {
    const R = rules();
    /** @type {Record<string, { next: number, wins: number, entered: number | null }>} */
    const hosts = {};
    (R?.hosts || []).forEach((sid, i) => {
      if (!settlement(sid)) return; // a world without this town (the old March, in tests): no lists there
      const first = R.first + R.stagger * i;
      const next = day <= first ? first : first + Math.ceil((day - first) / R.every) * R.every;
      hosts[sid] = { next, wins: 0, entered: null };
    });
    return { hosts, open: [], bracket: null, rival: null };
  }
  /** @param {Campaign} c */
  const state = (c) => {
    if (!c.tourney) c.tourney = blank(c.day);
    return c.tourney;
  };

  /** The tournament's own roll in [0, 1): from the campaign's seed, a day and a salt; never the world stream. */
  function roll(c, day, salt) {
    let h = (Math.imul((c.rngSeed >>> 0) ^ 0x7f4a7c15, 0x85ebca6b) + Math.imul(Math.floor(day) + 3, 0xc2b2ae35) + Math.imul(salt + 7, 0x27d4eb2f)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  const hostName = (sid) => settlement(sid)?.name || 'the town';
  const ownerOf = (c, sid) => CL.realm.owner(sid, c);

  // ---- Schedule ----

  /** The seven fighters of a tournament: the host's people, and your rival perhaps. */
  function fighters(c, sid, day) {
    const R = rules();
    const salt = R.hosts.indexOf(sid) * 101;
    const culture = CL.soldiers.cultureFor('', sid, c);
    const rival = state(c).rival;
    const taken = new Set([c.character?.name, rival?.name].filter(Boolean));
    let k = 0;
    const rand = () => roll(c, day, salt + 50 + k++);
    const out = [];
    for (let i = 0; i < R.entrants - 1; i++) {
      const name = CL.soldiers.makeName(culture, sid, rand, taken, 'any');
      taken.add(name);
      out.push({ name, culture, skill: Number((R.skill[0] + (R.skill[1] - R.skill[0]) * roll(c, day, salt + i)).toFixed(2)) });
    }
    // The rival takes the last place, in the other half of the draw: you meet only in the final.
    if (rival && roll(c, day, salt + 99) < R.rivalChance) out[out.length - 1] = { name: rival.name, culture: rival.culture, skill: rival.skill, rival: true };
    return out;
  }

  /** From the campaign clock: open each host's tournament when it is due; close those past. */
  function tick(c) {
    const R = rules();
    const t = state(c);
    for (const [sid, h] of Object.entries(t.hosts)) {
      let guard = 0;
      while (c.day >= h.next && guard++ < 50) {
        const day = h.next;
        h.next += R.every;
        if (c.day >= day + R.openDays) continue; // long past (a long wait): never announced
        t.open = t.open.filter((o) => o.host !== sid);
        t.open.push({ host: sid, start: day, until: day + R.openDays, fighters: fighters(c, sid, day) });
        const text = `A tournament at ${hostName(sid)}: eight fighters on foot. Entries close on day ${CL.party.dayNumber(day + R.openDays)}.`;
        CL.news.record(c, 'tourney', { place: sid, text });
        CL.diag.log('info', 'Tournament announced', { host: sid, day });
      }
    }
    t.open = t.open.filter((o) => c.day < o.until);
    settle(c);
  }

  /** The tournament open at a town now, or null. */
  const openAt = (c, sid) => state(c).open.find((o) => o.host === sid && c.day < o.until) || null;

  // ---- Entering ----

  /** The entry fee: rises with renown, within its bounds. */
  function fee(c) {
    const f = rules().fee;
    return Math.round(clamp(f.base + f.perRenown * Math.max(0, c.renown || 0), f.min, f.max));
  }

  /** What a win is worth in this town: each earlier win here takes a share off, down to the floor. */
  function prizeFactor(c, sid) {
    const r = rules().repeat;
    return Math.max(r.floor, r.factor ** (state(c).hosts[sid]?.wins || 0));
  }

  /** The prizes on offer in this town now. */
  function prizes(c, sid) {
    const p = rules().prize;
    const f = prizeFactor(c, sid);
    return {
      champion: { gold: Math.round(p.champion * f), renown: Math.max(1, Math.round(p.renown.champion * f)), rep: p.rep.champion },
      finalist: { gold: Math.round(p.finalist * f), renown: Math.max(0, Math.round(p.renown.finalist * f)), rep: p.rep.finalist },
    };
  }

  /** Why the company cannot enter here now, or ''. */
  function blocked(c, sid) {
    const t = state(c);
    const o = openAt(c, sid);
    if (!o) return 'No tournament here now';
    if (c.world?.location !== sid) return `You must be in ${hostName(sid)}`;
    if (t.bracket) return 'You are already in a tournament';
    const h = t.hosts[sid];
    const R = rules();
    if (h?.entered != null && c.day < h.entered + R.cooldown) return `You fought here lately: again from day ${CL.party.dayNumber(h.entered + R.cooldown)}`;
    const right = CL.rights.may(c, 'player', 'enterTourney', sid); // P8-03
    if (!right.ok) return right.why;
    if (!c.character) return 'Create your hero first';
    if (c.gold < fee(c)) return `The fee is ${fee(c)} crowns`;
    return '';
  }

  /** Enter the tournament here: pay the fee and take your place in the draw. */
  function enter(c, sid) {
    const why = blocked(c, sid);
    if (why) return { ok: false, reason: why };
    const t = state(c);
    const o = openAt(c, sid);
    const paid = fee(c);
    CL.accounts.spend(c, paid, `tournament entry at ${hostName(sid)}`);
    t.hosts[sid].entered = c.day;
    t.bracket = { host: sid, start: o.start, fee: paid, fighters: o.fighters.map((f) => ({ ...f })), rounds: [[0, 1, 2, 3, 4, 5, 6, 7]], round: 0, bout: null };
    CL.diag.log('info', 'Tournament entered', { host: sid, fee: paid });
    CL.ui.message(`You pay ${paid} crowns and take your place in the lists of ${hostName(sid)}.`);
    return { ok: true };
  }

  // ---- The bracket ----

  /** A slot's fighter: 0 is the hero, 1–7 the others. */
  const fighterAt = (b, slot) => (slot === 0 ? null : b.fighters[slot - 1]);

  /** The fighter you meet in this round (the other one of your pair). */
  function opponentSlot(b) {
    return b.rounds[b.round]?.[1] ?? null;
  }

  /**
   * The fighter of a bout: a troop's body, made harder each round and by each earlier win in this town,
   * then by the fighter's own skill.
   */
  function boutFighter(c, b, round = b.round, slot = opponentSlot(b)) {
    const R = rules();
    const r = R.rounds[round];
    const f = fighterAt(b, slot);
    const t = CL.content.troop(r.troop);
    const town = 1 + R.townWins * (state(c).hosts[b.host]?.wins || 0);
    const sk = f?.skill ?? 1;
    return {
      name: f?.name || 'a fighter',
      rival: Boolean(f?.rival),
      troop: r.troop,
      round: r.name,
      hp: Math.round(t.hp * r.hp * town * sk),
      damage: Number((t.damage * r.damage * town * (0.5 + 0.5 * sk)).toFixed(2)),
      armor: t.armor + r.armor,
      style: f?.rival ? rivalStyle(f.name) : r.style || null, // P11-10: by round; a rival keeps theirs
    };
  }

  /** P11-10: a rival's own style, the same every time (from their name), among the tournament styles. */
  function rivalStyle(name) {
    const duel = Object.values(CL.content.table('fighting_styles')).filter((s) => s.duel).map((s) => s.id);
    if (!duel.length) return null;
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return duel[h % duel.length];
  }

  /** Settle the other bouts of a round by skill, once the hero's is decided; returns the winners. */
  function settleRound(c, b, heroWon) {
    const list = b.rounds[b.round];
    const next = [];
    for (let i = 0; i < list.length; i += 2) {
      const [a, z] = [list[i], list[i + 1]];
      if (a === 0) {
        next.push(heroWon ? 0 : z);
        continue;
      }
      const [sa, sz] = [fighterAt(b, a).skill, fighterAt(b, z).skill];
      next.push(roll(c, b.start, b.round * 10 + i) < sa / (sa + sz) ? a : z);
    }
    b.rounds[b.round + 1] = next;
    return next;
  }

  /** The battle definition of the next bout (the duel). */
  function encounter(c) {
    const b = state(c).bracket;
    const R = rules();
    const o = boutFighter(c, b);
    return {
      id: 'tourney_bout',
      name: `${hostName(b.host)} lists: ${o.round}`,
      map: R.map,
      waves: [{ [o.troop]: 1 }],
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      duel: { opponent: o, kit: { ...R.kit } },
    };
  }

  /** Step into the lists for the next bout. Returns false if there is no bout to fight. */
  function fight(c) {
    const b = state(c).bracket;
    if (!b || b.bout || c.world?.location !== b.host) return false;
    b.bout = { round: b.round };
    CL.save.write(); // the bout is on: reloading now forfeits it, never replays it
    CL.combat.startBattle(encounter(c));
    const o = boutFighter(c, b);
    CL.ui.message(`The ${o.round}: you face ${o.name}${o.rival ? ', your rival' : ''}.`);
    return true;
  }

  /**
   * A bout ended (from CL.party.endBattle). The bracket moves on; the result screen says how.
   * @param {boolean} win
   */
  function endBout(win) {
    const c = CL.campaign;
    const g = CL.game;
    const text = decide(c, win);
    g.result = { win, duel: { text }, html: `<p>${text}</p>` };
    CL.save.write();
    CL.ui.changeMode('result');
    return g.result;
  }

  /** Record the bout's result in the bracket; returns what happened, in words. */
  function decide(c, win) {
    const t = state(c);
    const b = t.bracket;
    if (!b?.bout) return 'The bout is over.';
    const o = boutFighter(c, b);
    b.bout = null;
    settleRound(c, b, win);
    const lines = [];
    if (win && o.rival && t.rival) {
      t.rival.beaten += 1;
      c.renown += rules().rivalRenown;
      lines.push(`You have bested your rival, ${o.name}.`);
    }
    if (!win) {
      lines.unshift(`${o.name} beats you in the ${o.round}.`);
      lines.push(finish(c, b.round === 2 ? 'final' : 'out', o));
    } else if (b.round === 2) {
      lines.unshift(`You beat ${o.name} in the final!`);
      lines.push(finish(c, 'champion', o));
    } else {
      lines.unshift(`You beat ${o.name} in the ${o.round}.`);
      b.round += 1;
      const n = boutFighter(c, b);
      lines.push(`Next, the ${n.round}: ${n.name}${n.rival ? ', your rival' : ''}.`);
    }
    CL.diag.log('info', 'Tournament bout', { host: b.host, round: o.round, win, foe: o.name });
    return lines.filter(Boolean).join(' ');
  }

  /** The bracket is over for you: prizes or losses, the rival, the chronicle and the news. */
  function finish(c, result, foe) {
    const t = state(c);
    const b = t.bracket;
    const sid = b.host;
    const p = prizes(c, sid);
    let text = '';
    if (result === 'champion') {
      CL.accounts.earn(c, p.champion.gold, `the tournament at ${hostName(sid)}`);
      c.renown += p.champion.renown;
      CL.realm.adjust(c, ownerOf(c, sid), p.champion.rep, 'tournament champion');
      t.hosts[sid].wins += 1;
      text = `Champion of ${hostName(sid)}! ${p.champion.gold} crowns and ${p.champion.renown} renown.`;
      if (!t.rival) t.rival = { name: foe.name, culture: fighterAt(b, opponentSlotOf(b, foe.name))?.culture || CL.soldiers.cultureFor('', sid, c), skill: 1, from: sid, beatYou: 0, beaten: 1 };
    } else if (result === 'final') {
      CL.accounts.earn(c, p.finalist.gold, `the tournament at ${hostName(sid)}`);
      c.renown += p.finalist.renown;
      CL.realm.adjust(c, ownerOf(c, sid), p.finalist.rep, 'tournament finalist');
      text = `Finalist: ${p.finalist.gold} crowns and ${p.finalist.renown} renown.`;
    } else if (b.round === 0) {
      const lost = Math.min(c.renown, rules().lossRenown);
      c.renown -= lost;
      text = lost ? `Out in the first bout: ${lost} renown lost, and the fee.` : 'Out in the first bout, and the fee lost.';
    } else text = 'Out in the semi-final. The fee is gone, but you fought well.';
    if (result !== 'champion') {
      const f = fighterAt(b, opponentSlotOf(b, foe.name));
      const same = t.rival?.name === foe.name;
      const skill = Math.min(RIVAL_SKILL_MAX, (same ? t.rival.skill : f?.skill || 1) + 0.05);
      t.rival = { name: foe.name, culture: f?.culture || t.rival?.culture || CL.soldiers.cultureFor('', sid, c), skill: Number(skill.toFixed(2)), from: sid, beatYou: (same ? t.rival.beatYou : 0) + 1, beaten: same ? t.rival.beaten : 0 };
      text += ` ${foe.name} is your rival now.`;
    }
    CL.chronicle.add(c, { day: c.day, kind: 'tourney', place: sid, result, foe: short(foe.name), round: b.round });
    const hero = c.character?.name || 'A wanderer';
    const news = { champion: `${hero} won the tournament at ${hostName(sid)}, beating ${foe.name} in the final.`, final: `${foe.name} won the tournament at ${hostName(sid)}, beating ${hero} in the final.`, out: `The tournament at ${hostName(sid)} is over; ${hero} went out early.` }[result];
    CL.news.record(c, 'tourney_end', { place: sid, text: news });
    t.bracket = null;
    CL.diag.log('info', 'Tournament over', { host: sid, result });
    return text;
  }

  /** The slot of a fighter by name (for their culture and skill). */
  function opponentSlotOf(b, name) {
    const i = b.fighters.findIndex((f) => f.name === name);
    return i < 0 ? null : i + 1;
  }

  /** Leave the bracket between bouts: it counts as losing the next bout. */
  function withdraw(c) {
    const b = state(c).bracket;
    if (!b || b.bout) return { ok: false, reason: 'Not now' };
    b.bout = { round: b.round };
    const text = decide(c, false);
    CL.ui.message(text);
    return { ok: true, text };
  }

  /** A bout left unfinished (the page reloaded mid-fight) counts as lost. Outside a battle only. */
  function settle(c) {
    const b = state(c).bracket;
    if (!b?.bout || CL.game?.mode === 'battle' || CL.game?.mode === 'result') return null;
    const text = `Your bout was left unfinished: it counts as lost. ${decide(c, false)}`;
    CL.ui.message(text);
    return text;
  }

  /** For the town screen: the tournament here, as text and the buttons it offers. */
  function view(c, sid) {
    settle(c);
    const t = state(c);
    const b = t.bracket;
    if (b && b.host === sid) {
      const o = boutFighter(c, b);
      const done = b.rounds
        .slice(1)
        .map((list, r) => `${rules().rounds[r].name}: ${list.includes(0) ? 'you won' : 'others went on'}`)
        .join(' · ');
      return {
        kind: 'bracket',
        title: `Tournament at ${hostName(sid)} · the ${o.round}`,
        lines: [
          `Next: the ${o.round} against ${o.name}${o.rival ? ', your rival' : ''}.${done ? ` ${done}.` : ''}`,
          'You fight in tournament gear; your own stays in your pack.',
        ],
        fight: `Fight the ${o.round}`,
      };
    }
    const o = openAt(c, sid);
    if (!o) return null;
    const p = prizes(c, sid);
    const rival = o.fighters.find((f) => f.rival);
    return {
      kind: 'open',
      title: `Tournament at ${hostName(sid)} · entries close day ${CL.party.dayNumber(o.until)}`,
      lines: [
        `Eight fighters on foot, three bouts. Champion: ${p.champion.gold} crowns and ${p.champion.renown} renown; finalist: ${p.finalist.gold} crowns. Falling in the first bout costs a little renown.`,
        ...(rival ? [`Your rival ${rival.name} is in the draw.`] : []),
      ],
      enter: `Enter (${fee(c)} crowns)`,
      reason: blocked(c, sid),
    };
  }

  // ---- Save ----

  /** Repair the saved tournaments onto `s`. */
  function sanitize(s, d) {
    const raw = d?.tourney;
    const t = blank(s.day);
    const R = rules();
    const fighter = (f) => (f && typeof f.name === 'string' && f.name ? { name: short(f.name, 24), culture: CL.content.table('cultures')[f.culture] ? f.culture : Object.keys(CL.content.table('cultures'))[0], skill: num(f.skill) ? clamp(f.skill, 0.5, RIVAL_SKILL_MAX) : 1, ...(f.rival === true ? { rival: true } : {}) } : null);
    if (raw && typeof raw === 'object') {
      for (const sid of Object.keys(t.hosts)) {
        const h = raw.hosts?.[sid];
        if (!h) continue;
        if (num(h.next)) t.hosts[sid].next = h.next;
        if (Number.isInteger(h.wins) && h.wins >= 0) t.hosts[sid].wins = Math.min(h.wins, 999);
        if (num(h.entered)) t.hosts[sid].entered = h.entered;
      }
      for (const o of Array.isArray(raw.open) ? raw.open.slice(0, R.hosts.length) : []) {
        if (!t.hosts[o?.host] || !num(o.start) || !num(o.until) || t.open.some((x) => x.host === o.host)) continue;
        const fs = (Array.isArray(o.fighters) ? o.fighters : []).map(fighter).filter(Boolean);
        if (fs.length !== R.entrants - 1) continue;
        t.open.push({ host: o.host, start: o.start, until: o.until, fighters: fs });
      }
      const b = raw.bracket;
      if (b && t.hosts[b.host] && num(b.start) && Array.isArray(b.rounds) && Number.isInteger(b.round) && b.round >= 0 && b.round < R.rounds.length) {
        const fs = (Array.isArray(b.fighters) ? b.fighters : []).map(fighter).filter(Boolean);
        const rounds = b.rounds.slice(0, b.round + 1).map((l) => (Array.isArray(l) ? l.filter((x) => Number.isInteger(x) && x >= 0 && x < R.entrants) : []));
        const sizes = rounds.every((l, r) => l.length === R.entrants >> r && l[0] === 0);
        if (fs.length === R.entrants - 1 && rounds.length === b.round + 1 && sizes) {
          t.bracket = { host: b.host, start: b.start, fee: num(b.fee) ? Math.max(0, Math.round(b.fee)) : 0, fighters: fs, rounds, round: b.round, bout: b.bout && Number.isInteger(b.bout.round) ? { round: b.round } : null };
        }
      }
      const r = fighter(raw.rival);
      if (r && t.hosts[raw.rival.from]) {
        t.rival = { name: r.name, culture: r.culture, skill: r.skill, from: raw.rival.from, beatYou: Number.isInteger(raw.rival.beatYou) ? clamp(raw.rival.beatYou, 0, 999) : 0, beaten: Number.isInteger(raw.rival.beaten) ? clamp(raw.rival.beaten, 0, 999) : 0 };
      }
    }
    s.tourney = t;
  }

  /** Save migration 16 → 17 (pure): no tournaments fought yet; the first are announced as they come due. */
  const migrate = (d) => ({ ...d, version: 17, tourney: blank(Number.isFinite(d.day) ? d.day : 0) });

  /** Content checks (from content.validate). */
  function validate(C, err) {
    const all = Object.values(C.tournaments || {});
    if (all.length !== 1) return err('tournaments: needs exactly one set of rules');
    const R = all[0];
    // A host this world lacks is skipped (a world package may leave some out); one it has must be a town.
    for (const sid of R.hosts || []) if (C.settlements?.[sid] && C.settlements[sid].type !== 'town') err(`tournaments: host ${sid} is not a town`);
    for (const [slot, id] of Object.entries(R.kit || {})) if (C.items?.[id]?.slot !== slot) err(`tournaments: kit ${slot} is not a ${slot} item: ${id}`);
    if (!C.battle_maps?.[R.map] || C.battle_maps[R.map].generate) err(`tournaments: map ${R.map} must be a one-screen battle map`);
    if (R.entrants !== 8 || (R.rounds || []).length !== 3) err('tournaments: eight entrants, three rounds');
    for (const r of R.rounds || []) if (!C.troops?.[r.troop]) err(`tournaments: unknown troop ${r.troop}`);
    for (const k of ['every', 'openDays', 'cooldown']) if (!(num(R[k]) && R[k] > 0)) err(`tournaments: needs a positive ${k}`);
    if (!(R.repeat?.factor > 0 && R.repeat.factor < 1 && R.repeat.floor > 0 && R.repeat.floor <= 1)) err('tournaments: repeat factor and floor must be between 0 and 1');
  }

  /** A chronicle entry in words (js/chronicle.js). */
  function chronicleText(e) {
    const at = hostName(e.place);
    if (e.result === 'champion') return `Won the tournament at ${at}, beating ${e.foe} in the final.`;
    if (e.result === 'final') return `Lost the final of the tournament at ${at} to ${e.foe}.`;
    return `Fell in the ${rules().rounds[e.round]?.name || 'first bout'} of the tournament at ${at} to ${e.foe}.`;
  }

  CL.tourney = {
    RESULTS,
    rules,
    blank,
    state,
    roll,
    tick,
    openAt,
    fee,
    prizeFactor,
    prizes,
    blocked,
    enter,
    boutFighter,
    opponentSlot,
    encounter,
    fight,
    endBout,
    decide,
    withdraw,
    settle,
    view,
    chronicleText,
    sanitize,
    migrate,
    validate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
