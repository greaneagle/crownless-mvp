/* Crownless houses, marriage, deaths and succession (P9-06, design §19, decision D-P9g).
 *
 * - **Houses** (`c.houses[id] = { id, name, colors, head, members, alliances, rivals, rel }`): built
 *   from the people's kin (parents, children and siblings; the eldest's surname names it). What a
 *   person thinks of a house is their average opinion of its members, plus the house's own `rel`
 *   (moved by deeds against the house). A house that loses all its land keeps its members and name.
 * - **Your house:** founded when you first hold land, in your name (you may rename it).
 * - **Marriage:** between unmarried people of two houses, you included. The one asked answers by the
 *   P8-07 model (`nobles.consider`, kind `marriage`: what they think of the suitor and the house, the
 *   houses' interests, a dowry). Married: each shares the other's claims, the houses are allied (each
 *   answers the other's call with +20). After 90 days either may end it: a feud, and the houses rivals.
 *   Your spouse may ride with you or run one of your holdings, and may refuse.
 * - **Deaths:** a lord beaten in battle dies of wounds 3% of the time; old age only with `RULES.oldAge`
 *   (off). You never die. The dead keep their record (`status: 'dead'`).
 * - **Succession** by the realm's law (P9-01): eldest child; the kin the realm's lords think best of;
 *   or the council's choice. The heir takes the fiefs and the office (a ruler's crown too). Two heirs
 *   within 10: the other keeps claims, and a faction (P9-04) if three lords back them. No heir: the
 *   crown takes the land and grants it (P8-05).
 * - **Claims through houses:** a claim passes to the heir, else to the house, when its holder dies; a
 *   claimant may petition their liege for restoration (§19.6).
 * - No births and no ageing (§19.3's founding-house model). */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = {
    woundDeath: 0.12, // P10-T: 0.06 (P9-T; 0.03 before) gave 0–2 deaths a year of the world alone (the target 2–6)
    oldAge: false, // a setting, off by default (D-P9g)
    oldAgeWeekly: 0.002,
    contested: 10,
    backers: 3,
    ally: 20,
    rival: -10,
    rivalAt: -30, // a house's regard for another, at or below it: rivals
    marriageChance: 0.25, // each week, one match sought somewhere in the world
    dowry: 100, // crowns: a dowry's worth in the answer, per 100
    endAfter: 90,
    endOpinion: -30, // your spouse leaves you below it
    endRel: -40,
    refusedRel: -5,
    restoreOpinion: 10,
    rideDays: 14,
    ransom: 200,
  };
  const PLAYER = 'player';
  const COLORS = ['#7a2e2e', '#2e5a7a', '#5a7a2e', '#7a6a2e', '#5a2e7a', '#2e7a6a', '#7a4a2e', '#3a3a6a', '#6a3a4a', '#3a6a3a'];
  const CLOSE = ['parent', 'child', 'sibling'];

  const R = () => CL.realm;
  const N = () => CL.nobles;
  const placeName = (id) => CL.content.table('settlements')[id]?.name || id;
  const surname = (name) => String(name || '').trim().split(/\s+/).at(-1) || 'Nameless';
  const num = (n) => typeof n === 'number' && Number.isFinite(n);
  const alive = (c, pid) => pid === PLAYER || (c.people?.[pid] && c.people[pid].status !== 'dead');

  const all = (c) => (c.houses ||= {});
  const list = (c) => Object.values(all(c));
  const byId = (c, id) => all(c)[id] || null;
  /** The house a person is of (you, once you hold land), or null. */
  const houseOf = (c, pid) => list(c).find((h) => h.members.includes(pid)) || null;
  const mine = (c) => houseOf(c, PLAYER);
  const name = (h) => `House ${h.name}`;
  const titled = (c, pid) => (pid === PLAYER ? c.character?.name || 'You' : R().titled(pid, c));

  // ---- Houses ----

  /** Houses from kin: parents, children and siblings together, and one surname one house. */
  function build(c) {
    const people = Object.keys(c.people || {}).filter((pid) => alive(c, pid));
    const group = {};
    const find = (x) => {
      while (group[x] !== x) x = group[x];
      return x;
    };
    for (const pid of people) group[pid] = pid;
    const join = (a, b) => {
      const [x, y] = [find(a), find(b)];
      if (x === y) return;
      const [lo, hi] = Number(x.slice(7)) < Number(y.slice(7)) ? [x, y] : [y, x];
      group[hi] = lo; // the eldest (lowest id) leads
    };
    for (const pid of people) for (const k of c.people[pid].kin) if (CLOSE.includes(k.tie) && group[k.person]) join(pid, k.person);
    const bySurname = {};
    for (const pid of people) {
      const s = surname(c.people[pid].name);
      if (bySurname[s]) join(bySurname[s], pid);
      else bySurname[s] = pid;
    }
    const sets = {};
    for (const pid of people) {
      const k = find(pid);
      sets[k] ||= [];
      sets[k].push(pid);
    }
    c.houses = {};
    c.nextHouseId = 0;
    const order = (a, b) => Number(a.slice(7)) - Number(b.slice(7));
    for (const members of Object.values(sets).sort((a, b) => order(a.sort(order)[0], b.sort(order)[0]))) {
      members.sort(order);
      const ruler = members.find((pid) => R().rules(pid, c));
      c.nextHouseId += 1;
      const id = `house:${c.nextHouseId}`;
      c.houses[id] = { id, name: surname(c.people[members[0]].name), colors: [COLORS[(c.nextHouseId - 1) % COLORS.length], '#c9a24a'], head: ruler || members[0], members, alliances: [], rivals: [], rel: {} };
    }
    return c.houses;
  }

  /** What a person thinks of a house: their average opinion of its members, and their house's regard. */
  function regard(c, pid, hid) {
    const h = byId(c, hid);
    if (!h || !N()) return 0;
    const others = h.members.filter((m) => m !== pid && alive(c, m));
    const avg = others.length ? others.reduce((n, m) => n + N().opinion(c, pid, m), 0) / others.length : 0;
    const own = houseOf(c, pid);
    return Math.round(avg + (own && own.id !== hid ? own.rel[hid] || 0 : 0));
  }
  /** A deed against a house: it thinks less (or more) of the doer's house, and may count it a rival. */
  function wronged(c, hid, by, n) {
    const h = byId(c, hid);
    const doer = houseOf(c, by);
    if (!h || !doer || doer.id === hid) return;
    h.rel[doer.id] = Math.max(-100, Math.min(100, (h.rel[doer.id] || 0) + n));
    if (h.rel[doer.id] <= RULES.rivalAt) {
      if (!h.rivals.includes(doer.id)) h.rivals.push(doer.id);
      h.alliances = h.alliances.filter((x) => x !== doer.id);
      doer.alliances = doer.alliances.filter((x) => x !== hid);
    }
  }
  const allied = (c, a, b) => {
    const [x, y] = [houseOf(c, a), houseOf(c, b)];
    return Boolean(x && y && x !== y && x.alliances.includes(y.id));
  };
  const rivals = (c, a, b) => {
    const [x, y] = [houseOf(c, a), houseOf(c, b)];
    return Boolean(x && y && x !== y && (x.rivals.includes(y.id) || y.rivals.includes(x.id)));
  };

  /** Your house: founded when you first hold land (your name, unless you choose another). */
  function found(c, chosen = null) {
    if (mine(c)) return mine(c);
    if (!R().fiefsOf(PLAYER, c).length && !chosen) return null;
    c.nextHouseId = (c.nextHouseId || 0) + 1;
    const id = `house:${c.nextHouseId}`;
    all(c)[id] = { id, name: (chosen || surname(c.character?.name || 'Wanderer')).slice(0, 24), colors: ['#c9a24a', '#1b2a3a'], head: PLAYER, members: [PLAYER], alliances: [], rivals: [], rel: {}, founded: Math.floor(c.day) };
    CL.ui?.message?.(`You found ${name(all(c)[id])}.`);
    CL.diag.log('info', 'House founded', { house: id, you: true });
    return all(c)[id];
  }
  function rename(c, text) {
    const h = mine(c);
    const t = String(text || '').trim().slice(0, 24);
    if (!h || !t) return false;
    h.name = t.replace(/^House\s+/i, '');
    return true;
  }

  // ---- Deaths and succession ----

  /** A lord beaten in battle (js/lords.js beaten): dies of their wounds, now and then. */
  function woundsKill(c, pid, by) {
    if (!c.people?.[pid] || R().rules(pid, c) || CL.autoresolve.next(c) >= RULES.woundDeath) return false;
    die(c, pid, 'wounds', by);
    return true;
  }

  /** A person dies: their record kept, their land and office to their heir by the realm's law. */
  function die(c, pid, cause = 'wounds', by = null) {
    const p = c.people?.[pid];
    if (!p || p.status === 'dead' || pid === PLAYER) return null;
    const f = p.realm;
    const wasRuler = R().rules(pid, c);
    const q = CL.lords?.partyOf(c, pid);
    if (q) c.parties.splice(c.parties.indexOf(q), 1);
    const held = (CL.lords?.prisoners(c) || []).find((x) => x.lord === pid);
    if (held) c.prisoners.splice(c.prisoners.indexOf(held), 1);
    const s = succession(c, pid);
    Object.assign(p, { status: 'dead', heldBy: null, died: Math.floor(c.day), cause });
    delete p.regroup;
    const spouse = p.spouse;
    if (spouse) {
      if (spouse === PLAYER) CL.ui.message(`Your spouse ${p.name} has died.`);
      else if (c.people[spouse]) delete c.people[spouse].spouse;
      delete p.spouse; // P9-T: the dead are married no more (the invariant caught a widow's spouse kept)
      delete p.married;
    }
    const h = houseOf(c, pid);
    if (h) {
      h.members = h.members.filter((m) => m !== pid);
      if (h.head === pid) h.head = s.heir && h.members.includes(s.heir) ? s.heir : h.members.find((m) => alive(c, m)) || null;
      if (by && by !== pid) wronged(c, h.id, by, -20);
    }
    const words = cause === 'age' ? 'has died, full of years' : 'has died of wounds taken in battle';
    const after = s.heir ? `${R().titled(s.heir, c)} inherits${wasRuler ? ` the crown of ${R().faction(f)?.name}` : ''}.` : s.fiefs ? 'The crown takes their land.' : '';
    CL.news?.record(c, 'lord_died', { place: p.home, faction: f, text: `${p.name} ${words}. ${after}`.trim() });
    CL.diag.log('info', 'Lord died', { lord: pid, cause, heir: s.heir || null, contested: s.contested || false, law: s.law, ruler: Boolean(wasRuler) });
    return s;
  }

  /** The realm's law of succession, and who stands to inherit from `pid`, best first. */
  function heirs(c, pid) {
    const p = c.people[pid];
    const f = p.realm;
    const law = CL.crowns?.laws(c, f).succession || 'eldest';
    const ok = (x) => alive(c, x) && x !== PLAYER && c.people[x]?.status !== 'dead' && c.people[x].realm === f;
    const kin = p.kin.filter((k) => ok(k.person));
    const lords = (CL.lords?.riders(c) || []).filter((x) => ok(x) && x !== pid);
    const court = (x) => {
      const by = lords.filter((y) => y !== x);
      return by.length ? by.reduce((n, y) => n + N().opinion(c, y, x), 0) / by.length : 0;
    };
    let cands = [];
    if (law === 'eldest') cands = kin.filter((k) => k.tie === 'child').map((k) => ({ pid: k.person, score: -Number(k.person.slice(7)) }));
    else if (law === 'kin') cands = kin.map((k) => ({ pid: k.person, score: court(k.person) }));
    else cands = (kin.length ? kin.map((k) => k.person) : lords).map((x) => ({ pid: x, score: court(x) }));
    // A crown is never left empty: with no heir by the law, the council chooses among the lords.
    if (!cands.length && R().rules(pid, c)) cands = lords.map((x) => ({ pid: x, score: court(x) }));
    cands.sort((a, b) => b.score - a.score || a.pid.localeCompare(b.pid));
    return { law, cands, court };
  }

  /** The heir takes the fiefs and the office; a close second keeps claims (and perhaps raises a faction). */
  function succession(c, pid) {
    const p = c.people[pid];
    const f = p.realm;
    const { law, cands, court } = heirs(c, pid);
    const heir = cands[0]?.pid || null;
    const fiefs = R().fiefsOf(pid, c);
    const ruler = R().rulerOf(f, c);
    const wasRuler = ruler === pid;
    const out = { law, heir, fiefs: fiefs.length, contested: false, rival: null };
    // A ruler's crown first: the heir rules, and rides no more.
    if (wasRuler && heir) {
      c.rulers[f] = heir;
      const hq = CL.lords?.partyOf(c, heir);
      if (hq) c.parties.splice(c.parties.indexOf(hq), 1);
      if (c.realms?.[f]) c.realms[f].by = heir;
    }
    const newRuler = R().rulerOf(f, c);
    for (const sid of fiefs) {
      const to = heir && R().transfer(c, sid, { holder: heir, willing: true, reason: 'inherited', quiet: true }) ? heir : null;
      if (!to && R().holderOf(sid, c) === pid) R().transfer(c, sid, { holder: newRuler !== pid ? newRuler : heir, willing: true, reason: 'escheat', quiet: true }); // no heir, or over the cap: the crown takes it, and grants it (P8-05)
      if (R().holderOf(sid, c) === pid) c.holdings[sid].holder = newRuler; // never left with the dead
      CL.fiefs?.offer(c, sid);
    }
    // The office.
    const k = c.crowns?.[f];
    for (const [o, x] of Object.entries(k?.offices || {})) if (x === pid) k.offices[o] = heir && !R().rules(heir, c) && R().fiefsOf(heir, c).length ? heir : null;
    // Claims outlive their holder: to the heir, else to the house.
    const house = houseOf(c, pid);
    const next = heir || house?.members.find((m) => m !== pid && alive(c, m)) || null;
    for (const h of Object.values(c.holdings || {})) {
      const i = h.claims.findIndex((x) => x.by === pid);
      if (i < 0) continue;
      if (next && h.holder !== next && !h.claims.some((x) => x.by === next)) h.claims[i] = { ...h.claims[i], by: next, through: house?.id || null };
      else h.claims.splice(i, 1);
    }
    // Contested: a second within reach keeps a claim on each, and three lords behind them make a faction.
    const second = cands[1];
    if (heir && second && law !== 'eldest' && cands[0].score - second.score <= RULES.contested) {
      out.contested = true;
      out.rival = second.pid;
      for (const sid of fiefs) R().addClaim(c, sid, { by: second.pid, realm: f, kind: 'old' });
      const backers = (CL.lords?.riders(c) || []).filter((y) => y !== heir && y !== second.pid && c.people[y]?.realm === f && c.people[y].status === 'free' && N().opinion(c, y, second.pid) > N().opinion(c, y, heir));
      if (backers.length >= RULES.backers) out.faction = CL.rebellion?.form(c, f, { force: true, members: [second.pid, ...backers].slice(0, 6), claimant: second.pid }) || null;
      CL.news?.record(c, 'succession_contested', { faction: f, text: `${R().titled(second.pid, c)} disputes ${R().titled(heir, c)}'s inheritance.` });
    }
    out.court = court;
    return out;
  }

  // ---- Marriage ----

  const married = (c, pid) => (pid === PLAYER ? spouseOf(c) : c.people[pid]?.spouse) || null;
  /** Your spouse, or null. */
  const spouseOf = (c) => Object.keys(c.people || {}).find((pid) => c.people[pid].spouse === PLAYER && c.people[pid].status !== 'dead') || null;
  /** May these two marry? { ok, why }. */
  function canMarry(c, a, b) {
    if (a === b) return { ok: false, why: 'Not to themselves' };
    if (a === PLAYER && !mine(c)) return { ok: false, why: 'You have no house yet: hold land first' };
    for (const x of [a, b]) {
      if (x !== PLAYER && !c.people[x]) return { ok: false, why: 'Nobody' };
      if (x !== PLAYER && c.people[x].status !== 'free') return { ok: false, why: `${R().titled(x, c)} is ${c.people[x].status === 'dead' ? 'dead' : 'not free'}` };
      if (married(c, x)) return { ok: false, why: `${titled(c, x)} ${x === PLAYER ? 'are' : 'is'} married already` };
      if (!houseOf(c, x)) return { ok: false, why: `${titled(c, x)} ${x === PLAYER ? 'have' : 'has'} no house` };
    }
    if (houseOf(c, a) === houseOf(c, b)) return { ok: false, why: 'They are of one house' };
    if (b !== PLAYER && c.people[b].kin.some((k) => k.person === a && CLOSE.includes(k.tie))) return { ok: false, why: 'They are close kin' };
    return { ok: true, why: '' };
  }
  /** The answer to a proposal from `from` (you or a house's head) to `to`: by the P8-07 model. */
  function answer(c, from, to, { dowry = 0 } = {}) {
    const can = canMarry(c, from, to);
    if (!can.ok) return { answer: 'refuse', score: -100, reasons: [{ text: can.why, sign: '−' }] };
    return N().consider(c, to, { by: from, kind: 'marriage', dowry });
  }
  /** The marriage's interests, for `consider`: the houses' regard, land, a common rival, a dowry. */
  function interests(c, pid, ask) {
    const out = [];
    const theirs = houseOf(c, ask.by);
    const own = houseOf(c, pid);
    if (!theirs || !own) return out;
    const r = regard(c, pid, theirs.id) - N().opinion(c, pid, ask.by);
    if (Math.abs(r) >= 5) out.push([`${r > 0 ? 'Thinks well' : 'Thinks ill'} of ${name(theirs)}`, Math.round(r * 0.5)]);
    const land = theirs.members.reduce((n, m) => n + R().fiefsOf(m, c).length, 0);
    const mineLand = own.members.reduce((n, m) => n + R().fiefsOf(m, c).length, 0);
    if (land > mineLand) out.push([`${name(theirs)} holds more land than ${name(own)}`, 10]);
    else if (!land) out.push([`${name(theirs)} holds no land`, -15]);
    const common = own.rivals.find((x) => theirs.rivals.includes(x));
    if (common) out.push([`Both houses are rivals of ${name(byId(c, common))}`, 15]);
    if (own.rivals.includes(theirs.id) || theirs.rivals.includes(own.id)) out.push([`${name(theirs)} is a rival house`, -40]);
    const theirRealm = ask.by === PLAYER ? R().rules(PLAYER, c) || CL.allegiance?.sworn(c) : c.people[ask.by]?.realm;
    if (theirRealm !== c.people[pid].realm) out.push(['It would tie the house to another realm', -5]);
    if (ask.dowry > 0) out.push([`A dowry of ${ask.dowry} crowns`, Math.round((ask.dowry / RULES.dowry) * 8)]);
    out.push([`A marriage is for life, not a favour`, -15]);
    return out;
  }
  /** A proposal: answered, and if accepted, the marriage. Returns the answer with its words. */
  function propose(c, from, to, { dowry = 0 } = {}) {
    const r = answer(c, from, to, { dowry });
    if (from === PLAYER && dowry > c.gold) return { ...r, answer: 'refuse', words: `You have only ${c.gold} crowns`, line: '' };
    const yes = r.answer === 'obey';
    if (yes) marry(c, from, to, { dowry });
    else {
      const h = houseOf(c, from);
      if (h && houseOf(c, to)) wronged(c, h.id, to, RULES.refusedRel); // a refusal is felt
    }
    if (from === PLAYER) CL.diag.log('info', 'Proposal', { to, answer: r.answer, score: r.score, dowry });
    const words = yes ? `${R().titled(to, c)} accepts.` : r.answer === 'negotiate' ? `${R().titled(to, c)} would accept with a dowry of ${(r.dowry || 0) + dowry} crowns.` : `${R().titled(to, c)} refuses.`;
    return { ...r, words, line: N().reasonLine(r) };
  }
  /** Married: spouses, kin, shared claims, allied houses, the dowry paid. */
  function marry(c, a, b, { dowry = 0 } = {}) {
    const ha = houseOf(c, a);
    const hb = houseOf(c, b);
    if (a === PLAYER) {
      if (dowry > 0) CL.accounts.spend(c, dowry, `a dowry for ${R().titled(b, c)}`);
      c.people[b].spouse = PLAYER;
      c.people[b].married = Math.floor(c.day);
    } else {
      for (const [x, y] of [
        [a, b],
        [b, a],
      ]) {
        c.people[x].spouse = y;
        c.people[x].married = Math.floor(c.day);
        if (!c.people[x].kin.some((k) => k.person === y)) c.people[x].kin.push({ person: y, tie: 'spouse' });
      }
    }
    // Their claims are shared.
    for (const h of Object.values(c.holdings || {})) {
      const sid = Object.keys(c.holdings).find((k) => c.holdings[k] === h);
      for (const [x, y] of [
        [a, b],
        [b, a],
      ])
        if (h.claims.some((k) => k.by === x)) R().addClaim(c, sid, { by: y, realm: y === PLAYER ? null : c.people[y].realm, kind: 'old' });
    }
    if (ha && hb) {
      if (!ha.alliances.includes(hb.id)) ha.alliances.push(hb.id);
      if (!hb.alliances.includes(ha.id)) hb.alliances.push(ha.id);
      ha.rivals = ha.rivals.filter((x) => x !== hb.id);
      hb.rivals = hb.rivals.filter((x) => x !== ha.id);
    }
    const text = `${titled(c, a)} ${a === PLAYER ? 'marry' : 'marries'} ${R().titled(b, c)}${ha && hb ? `: ${name(ha)} and ${name(hb)} are allied` : ''}.`;
    CL.news?.record(c, 'married', { place: c.people[b].home, faction: c.people[b].realm, text });
    if (a === PLAYER) CL.ui.message(text);
    CL.diag.log('info', 'Married', { a, b, dowry });
    return true;
  }
  /** End a marriage (after 90 days), by `by` (you or a spouse): the other remembers it, and the houses are rivals. */
  function end(c, by) {
    const other = by === PLAYER ? spouseOf(c) : c.people[by]?.spouse;
    if (!other) return { ok: false, why: 'Not married' };
    const since = c.people[by === PLAYER ? other : by].married ?? 0;
    if (c.day - since < RULES.endAfter) return { ok: false, why: `Not before day ${CL.party.dayNumber(since + RULES.endAfter)}` };
    for (const y of [by, other]) {
      if (y === PLAYER) continue;
      delete c.people[y].spouse;
      delete c.people[y].married;
      c.people[y].kin = c.people[y].kin.filter((k) => !(k.tie === 'spouse' && [by, other].includes(k.person)));
    }
    if (other !== PLAYER) N().note(c, other, by, 'marriage_ended', { kin: false });
    const hw = houseOf(c, other);
    if (hw && houseOf(c, by)) wronged(c, hw.id, by, RULES.endRel);
    const text = by === PLAYER ? `You end your marriage to ${R().titled(other, c)}.` : `${R().titled(by, c)} ends the marriage to ${titled(c, other)}.`;
    CL.news?.record(c, 'marriage_ended', { place: c.people[by === PLAYER ? other : by]?.home, text });
    CL.diag.log('info', 'Marriage ended', { by, other });
    return { ok: true, text };
  }

  // ---- Your spouse ----

  /** Ask your spouse to ride with you, or to run a holding of yours: they may refuse (the model). */
  function askSpouse(c, kind, sid = null) {
    const pid = spouseOf(c);
    if (!pid) return { ok: false, why: 'You are not married' };
    if (c.people[pid].status !== 'free') return { ok: false, why: `${R().titled(pid, c)} is not free` };
    const r = N().consider(c, pid, { by: PLAYER, kind: kind === 'ride' ? 'ride' : 'back', sid: null });
    const bonus = 20; // a spouse is kin to you
    const yes = r.score + bonus >= N().RULES.obey && !r.reasons.some((x) => /enemy/.test(x.text));
    const line = N().reasonLine(r);
    if (!yes) return { ok: false, why: `${R().titled(pid, c)} refuses. ${line}`, line };
    if (kind === 'ride') {
      N().state(c).pledges.push({ lord: pid, kind: 'ride', by: PLAYER, sid: null, grant: null, from: c.day, until: c.day + RULES.rideDays });
      CL.ui.message(`${R().titled(pid, c)} rides with you for ${RULES.rideDays} days.`);
      return { ok: true, line };
    }
    const h = c.holdings?.[sid];
    if (!h || h.holder !== PLAYER) return { ok: false, why: 'Not a holding of yours' };
    h.administrator = pid;
    CL.ui.message(`${R().titled(pid, c)} runs ${placeName(sid)} for you.`);
    return { ok: true, line };
  }
  /** Your spouse held: a ransom to pay (P8-01's flow, the other way). */
  function ransomSpouse(c) {
    const pid = spouseOf(c);
    const x = pid && (CL.lords?.prisoners(c) || []).find((y) => y.lord === pid && y.by !== PLAYER);
    if (!x) return { ok: false, why: 'Your spouse is free' };
    if (c.gold < RULES.ransom) return { ok: false, why: `The ransom is ${RULES.ransom} crowns; you have ${c.gold}` };
    CL.accounts.spend(c, RULES.ransom, `ransom for ${R().titled(pid, c)}`);
    if (R().isRealm(x.by)) CL.crowns?.pay(c, 'world', CL.crowns.side(x.by), RULES.ransom, 'ransom');
    CL.lords.free(c, x, `${R().titled(pid, c)} is ransomed by ${c.character?.name || 'their spouse'}.`);
    N().note(c, pid, PLAYER, 'ransomed_kin', { kin: false });
    return { ok: true, text: `You ransom ${R().titled(pid, c)} for ${RULES.ransom} crowns.` };
  }

  // ---- Restoration (§19.6) ----

  /** The holdings a person (or you) may petition for: claimed, and held by their own liege's crown. */
  function restorable(c, pid) {
    const f = pid === PLAYER ? CL.allegiance?.sworn(c) : c.people[pid]?.realm;
    if (!f) return [];
    const ruler = R().rulerOf(f, c);
    return Object.keys(c.holdings || {}).filter((sid) => {
      const h = c.holdings[sid];
      return h.sovereign === f && h.holder === ruler && h.claims.some((k) => k.by === pid) && !R().locked(c, sid) && (h.kind === 'village' || !h.seat);
    });
  }
  /** A claimant petitions their liege for a holding back: granted by what the ruler thinks of them and their house. */
  function petition(c, pid, sid) {
    if (!restorable(c, pid).includes(sid)) return { ok: false, why: 'Nothing to petition for there' };
    const f = pid === PLAYER ? CL.allegiance.sworn(c) : c.people[pid].realm;
    const ruler = R().rulerOf(f, c);
    const h = houseOf(c, pid);
    const score = N().opinion(c, ruler, pid) + (h ? Math.round((regard(c, ruler, h.id) - N().opinion(c, ruler, pid)) * 0.5) : 0) + (R().fiefsOf(pid, c).length ? -5 : 5);
    const why = `${R().titled(ruler, c)} thinks ${score >= 0 ? 'well' : 'ill'} of ${pid === PLAYER ? 'you' : R().titled(pid, c)}${h ? ` and ${name(h)}` : ''}`;
    if (score < RULES.restoreOpinion) {
      CL.diag.log('info', 'Restoration refused', { claimant: pid, sid, score });
      return { ok: false, why: `${R().titled(ruler, c)} refuses: ${why.charAt(0).toLowerCase()}${why.slice(1)} (${score}).` };
    }
    if (!R().transfer(c, sid, { holder: pid, willing: true, reason: 'restored' })) return { ok: false, why: 'The law does not allow it (too many fiefs)' };
    const text = `${R().titled(ruler, c)} restores ${placeName(sid)} to ${pid === PLAYER ? 'you' : R().titled(pid, c)}${h ? ` of ${name(h)}` : ''}.`;
    CL.news?.record(c, 'restored', { place: sid, faction: f, text });
    CL.diag.log('info', 'Restored', { claimant: pid, sid });
    return { ok: true, text };
  }

  // ---- The week ----

  /** Each week (the payday): your house founded, a marriage sought, old age (if on), petitions, your spouse. */
  function weekly(c) {
    if (!c.houses || !Object.keys(c.houses).length) build(c);
    found(c);
    const A = CL.autoresolve;
    // Old age, only with the setting on.
    if (RULES.oldAge) for (const pid of Object.keys(c.people)) if (c.people[pid].status === 'free' && A.next(c) < RULES.oldAgeWeekly) die(c, pid, 'age');
    // A match sought: the head of a house finds an unmarried member a spouse of another house.
    if (A.next(c) < RULES.marriageChance) seekMatch(c);
    // Land-hungry claimants petition their liege for restoration.
    for (const pid of Object.keys(c.people)) {
      const p = c.people[pid];
      if (p.status !== 'free' || R().rules(pid, c) || R().fiefsOf(pid, c).length >= R().fiefCapOf(pid, c)) continue;
      const sid = restorable(c, pid)[0];
      if (sid && A.next(c) < 0.25) petition(c, pid, sid);
    }
    // Your spouse: held (a ransom to pay), or leaving you.
    const sp = spouseOf(c);
    if (sp && c.people[sp].status === 'captive' && c.people[sp].heldBy !== PLAYER) CL.ui.message(`Your spouse ${R().titled(sp, c)} is held by the ${R().faction(c.people[sp].heldBy)?.name || 'enemy'}: the ransom is ${RULES.ransom} crowns (Lords tab).`);
    if (sp && c.people[sp].status === 'free' && N().opinion(c, sp, PLAYER) < RULES.endOpinion && c.day - (c.people[sp].married ?? 0) >= RULES.endAfter) {
      const r = end(c, sp);
      if (r.ok) CL.ui.message(`${R().titled(sp, c)} has left you.`);
    }
  }
  /** One match sought in the world: an unmarried lord, proposed to by the head of another house. */
  function seekMatch(c) {
    const free = Object.keys(c.people).filter((pid) => c.people[pid].status === 'free' && !c.people[pid].spouse && houseOf(c, pid));
    if (free.length < 2) return null;
    const A = CL.autoresolve;
    const a = free[Math.floor(A.next(c) * free.length)];
    const best = free
      .filter((b) => b !== a && canMarry(c, a, b).ok && c.people[b].gender !== c.people[a].gender)
      .map((b) => ({ b, r: answer(c, a, b) }))
      .sort((x, y) => y.r.score - x.r.score)[0];
    if (!best) return null;
    const ok = best.r.answer === 'obey';
    if (ok) marry(c, a, best.b);
    CL.diag.log('info', 'Match sought', { a, b: best.b, answer: best.r.answer, score: best.r.score });
    return { a, b: best.b, ok };
  }

  // ---- Words ----

  /** A house in a line: "House Greymantle: Lord Hamon (head), Lady Hawise, Lord Tancred; allied with House Ardane". */
  function line(c, h) {
    const who = h.members.filter((m) => alive(c, m)).map((m) => `${titled(c, m)}${m === h.head ? ' (head)' : ''}`);
    const land = h.members.reduce((n, m) => n + R().fiefsOf(m, c).length, 0);
    const allies = h.alliances.map((x) => byId(c, x)).filter(Boolean).map(name);
    const foes = h.rivals.map((x) => byId(c, x)).filter(Boolean).map(name);
    return `${name(h)}: ${who.join(', ') || 'nobody left'}; ${land ? `${land} holding${land > 1 ? 's' : ''}` : 'no land'}${allies.length ? `; allied with ${allies.join(', ')}` : ''}${foes.length ? `; rivals of ${foes.join(', ')}` : ''}.`;
  }

  // ---- Checks and saves ----

  function invariants(c) {
    const bad = [];
    const seen = new Set();
    for (const h of list(c)) {
      for (const m of h.members) {
        if (seen.has(m)) bad.push(`${m} in two houses`);
        seen.add(m);
        if (m !== PLAYER && c.people?.[m]?.status === 'dead') bad.push(`${m} is dead but still of ${h.id}`);
      }
    }
    for (const [sid, h] of Object.entries(c.holdings || {})) if (c.people?.[h.holder]?.status === 'dead') bad.push(`${sid} held by the dead ${h.holder}`);
    for (const [f, pid] of Object.entries(c.rulers || {})) if (c.people?.[pid]?.status === 'dead') bad.push(`${f} ruled by the dead ${pid}`);
    for (const [pid, p] of Object.entries(c.people || {})) {
      if (!p.spouse) continue;
      if (p.spouse !== PLAYER && c.people[p.spouse]?.spouse !== pid) bad.push(`${pid}'s marriage is one-sided`);
      if (p.status === 'dead') bad.push(`${pid} is dead but married`);
    }
    return bad;
  }

  const migrate = (d) => ({ ...d, version: 30, houses: {}, nextHouseId: 0 });

  /** Repair houses onto `s` (after the people): built from kin when there are none. */
  function sanitize(s, d) {
    const saved = d?.houses && typeof d.houses === 'object' ? d.houses : null;
    for (const p of Object.values(s.people || {})) {
      const e = d?.people?.[p.id];
      if (e?.status === 'dead') {
        p.status = 'dead';
        if (Number.isInteger(e.died)) p.died = e.died;
        if (typeof e.cause === 'string') p.cause = e.cause.slice(0, 12);
      }
      if (p.status !== 'dead' && (e?.spouse === PLAYER || (typeof e?.spouse === 'string' && s.people[e.spouse]))) p.spouse = e.spouse;
      if (p.spouse && Number.isInteger(e?.married)) p.married = e.married;
    }
    // One-sided or impossible marriages are undone; you have one spouse at most.
    let yours = 0;
    for (const p of Object.values(s.people || {})) {
      if (!p.spouse) continue;
      const other = s.people[p.spouse];
      if ((p.spouse === PLAYER && ++yours > 1) || (p.spouse !== PLAYER && (other?.spouse !== p.id || other.status === 'dead'))) {
        delete p.spouse;
        delete p.married;
      }
    }
    if (!saved || !Object.keys(saved).length) {
      build(s);
      yoursIfLanded(s);
      return;
    }
    s.houses = {};
    s.nextHouseId = Number.isInteger(d.nextHouseId) ? d.nextHouseId : 0;
    const seen = new Set();
    for (const [id, x] of Object.entries(saved)) {
      if (!/^house:\d{1,6}$/.test(id) || !x || typeof x !== 'object') continue;
      const members = (Array.isArray(x.members) ? x.members : []).filter((m) => !seen.has(m) && (m === PLAYER || (s.people[m] && s.people[m].status !== 'dead')));
      for (const m of members) seen.add(m);
      if (!members.length && !(typeof x.name === 'string')) continue;
      s.houses[id] = {
        id,
        name: typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 24) : 'Nameless',
        colors: Array.isArray(x.colors) && x.colors.every((k) => /^#[0-9a-f]{6}$/i.test(k)) ? x.colors.slice(0, 2) : [COLORS[0], '#c9a24a'],
        head: members.includes(x.head) ? x.head : members[0] || null,
        members,
        alliances: [],
        rivals: [],
        rel: {},
      };
      if (Number.isInteger(x.founded)) s.houses[id].founded = x.founded;
      s.nextHouseId = Math.max(s.nextHouseId, Number(id.slice(6)));
    }
    for (const [id, x] of Object.entries(saved)) {
      const h = s.houses[id];
      if (!h) continue;
      h.alliances = (Array.isArray(x.alliances) ? x.alliances : []).filter((y) => y !== id && s.houses[y]);
      h.rivals = (Array.isArray(x.rivals) ? x.rivals : []).filter((y) => y !== id && s.houses[y] && !h.alliances.includes(y));
      for (const [y, n] of Object.entries(x.rel || {})) if (s.houses[y] && y !== id && num(n)) h.rel[y] = Math.max(-100, Math.min(100, Math.round(n)));
    }
    // Anyone alive of no house gets one of their own name.
    for (const [pid, p] of Object.entries(s.people || {})) {
      if (p.status === 'dead' || seen.has(pid)) continue;
      s.nextHouseId += 1;
      const id = `house:${s.nextHouseId}`;
      s.houses[id] = { id, name: surname(p.name), colors: [COLORS[s.nextHouseId % COLORS.length], '#c9a24a'], head: pid, members: [pid], alliances: [], rivals: [], rel: {} };
    }    yoursIfLanded(s);
  }
  /** A save that holds land and has no house of yours: it is founded, quietly. */
  function yoursIfLanded(s) {
    if (mine(s) || !Object.values(s.holdings || {}).some((h) => h.holder === PLAYER)) return;
    s.nextHouseId = (s.nextHouseId || 0) + 1;
    const id = `house:${s.nextHouseId}`;
    s.houses[id] = { id, name: surname(s.character?.name || 'Wanderer').slice(0, 24), colors: ['#c9a24a', '#1b2a3a'], head: PLAYER, members: [PLAYER], alliances: [], rivals: [], rel: {}, founded: Math.floor(s.day || 0) };
  }

  // Your house is founded the moment you first hold land.
  CL.events?.on?.('HoldingChanged', (e) => {
    const c = CL.campaign;
    if (c?.houses && e?.to?.holder === PLAYER && !mine(c)) found(c);
  });

  CL.houses = { RULES, all, list, byId, houseOf, mine, name, surname, build, regard, wronged, allied, rivals, found, rename, woundsKill, die, heirs, succession, married, spouseOf, canMarry, answer, interests, propose, marry, end, askSpouse, ransomSpouse, restorable, petition, weekly, seekMatch, line, invariants, migrate, sanitize };
})(typeof window !== 'undefined' ? window : globalThis);
