// A randomized story player for the Gate D acceptance check ("each ending is reachable, no quest
// soft-locks"). It plays the real game logic from a fresh GDD start. Each step it does one of:
//   - work on the current quest stage's triggers: ride to the place, find the band, win (or lose)
//     the fight, threaten or pay, recruit
//   - ride to someone it may talk to and answer at random
//   - wait a while (so deadlines can run out)
//   - ride somewhere at random
// Now and then it saves and reloads, like closing the browser. Travel is real map travel (with
// whatever bands get in the way). Only the outcome of a battle is rolled rather than fought.
const STONEBRIDGE_HUB = 'stonebridge';

function makeStoryBot(CL, rnd, { winChance = 0.85, reloadChance = 0.04 } = {}) {
  const c = () => CL.campaign;
  const g = CL.game;
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const S = (id) => CL.content.get('settlements', id);
  const stats = { steps: 0, talks: 0, choices: 0, fights: 0, losses: 0, waits: 0, travels: 0, reloads: 0, stuck: 0, stages: new Set() };
  const trace = [];
  const note = (s) => {
    trace.push(`d${c().day.toFixed(1)} ${s}`);
    if (trace.length > 40) trace.shift();
  };

  // ---- Fights ----

  function fight() {
    const e = CL.parties.current();
    // Story columns are kingdom patrols, not hostile on their own; the player chooses Attack.
    if (!e || (!e.hostile && !e.party?.questTag)) return CL.ui.changeMode('map');
    // Sometimes threaten or pay instead, when the game offers it (Q2's thieves can be cowed).
    const n = CL.parties.negotiation(c(), e);
    if (n && rnd() < 0.3) {
      CL.parties.negotiate();
      note(`negotiated (${n.kind})`);
      if (g.mode !== 'encounter') {
        if (g.mode !== 'map') CL.world.returnToMap();
        return;
      }
    }
    CL.parties.attack();
    const win = rnd() < winChance;
    CL.debugTools.endBattleNow(win);
    stats.fights++;
    if (!win) stats.losses++;
    note(`${win ? 'won' : 'lost'} a fight with ${e.name || e.def?.id}`);
    CL.world.returnToMap();
  }

  /** Finish whatever screen we are on (a band caught us, a result is up). */
  function settle() {
    for (let i = 0; i < 10; i++) {
      if (g.mode === 'encounter') fight();
      else if (g.mode === 'battle') CL.debugTools.endBattleNow(rnd() < winChance);
      else if (g.mode === 'result') CL.world.returnToMap();
      else return;
    }
  }

  // ---- Travel on the real map ----

  function ride(target, done) {
    stats.travels++;
    if (g.mode !== 'map') CL.world.leaveSettlement();
    for (let i = 0; i < 30000; i++) {
      if (done()) return true;
      if (g.mode !== 'map') {
        settle();
        if (g.mode !== 'map') return false;
        continue;
      }
      if (!g.travel) CL.world.travelTo(target());
      CL.world.update(0.1);
    }
    stats.stuck++;
    note('travel never arrived');
    return false;
  }

  function goTo(sid) {
    if (c().world.location === sid) return true;
    const s = S(sid);
    return ride(
      () => ({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY }),
      () => c().world.location === sid,
    );
  }

  function goToParty(p) {
    return ride(
      () => ({ type: 'party', id: p.id, x: p.x, y: p.y }),
      () => g.mode === 'encounter' || !c().parties.includes(p),
    );
  }

  function goToSite(id) {
    const st = CL.world.map().sites[id];
    return ride(
      () => ({ type: 'site', id, x: st.mapX, y: st.mapY }),
      () => g.mode === 'encounter',
    );
  }

  // ---- Conversations ----

  /** The March's settlements: those in its regions (`*_march`) of the world's data. */
  function marchPlaces() {
    return Object.values(CL.content.table('settlements'))
      .filter((s) => /_march$/.test(CL.world.regionAt(s.mapX, s.mapY)?.id || ''))
      .map((s) => s.id);
  }

  /** Everyone the player could talk to right now, and where. */
  function people() {
    const out = [];
    const hub = CL.content.table('town_hubs')[STONEBRIDGE_HUB];
    for (const n of hub.npcs) if (n.dialogue && CL.story.test(n.visible)) out.push({ id: n.dialogue, at: STONEBRIDGE_HUB });
    for (const sid of Object.keys(CL.content.table('settlements'))) {
      for (const t of CL.story.peopleAt(sid)) out.push({ id: t.id, at: sid });
    }
    if (CL.companion.has(c())) out.push({ id: c().companion.id, at: null }); // she rides with you
    return out;
  }

  function converse(who) {
    if (who.at && !goTo(who.at)) return;
    let conv = CL.story.talk(who.id);
    stats.talks++;
    note(`talk ${who.id}@${conv?.node}`);
    // The bot plays the main story: it leaves the optional errands (V2-Q, quests with side: true) alone,
    // so the story simulation keeps measuring the story.
    const quests = CL.content.table('quests');
    const errand = (o) => String(o.next || '').startsWith('sq_') || (o.do || []).some((e) => e.start && quests[e.start]?.side);
    for (let i = 0; conv && i < 14; i++) {
      const options = conv.options.filter((o) => !errand(o));
      if (!options.length) break;
      const o = pick(options);
      stats.choices++;
      note(`  → ${o.text.slice(0, 50)}`);
      conv = CL.story.choose(conv, o.index);
    }
    settle();
  }

  // ---- Quest work ----

  function activeStages() {
    const out = [];
    for (const [id, r] of Object.entries(CL.story.state(c()).quests)) {
      if (r.status !== 'active') continue;
      const st = CL.content.get('quests', id).stages.find((s) => s.id === r.stage);
      if (st) out.push(st);
    }
    return out;
  }

  function work(st) {
    const triggers = st.on || [];
    if (!triggers.length) return false;
    const t = pick(triggers);
    const m = t.match || {};
    if (t.event === 'enter') {
      note(`ride to ${m.settlement} for ${st.id}`);
      goTo(m.settlement);
      return true;
    }
    if (t.event === 'recruit') {
      if (!goTo('stonebridge')) return true;
      const id = pick(CL.party.recruitsHere());
      if (id) CL.party.recruit(id);
      note(`recruit ${id} for ${st.id}`);
      return true;
    }
    if (t.event === 'battle' || t.event === 'parley') {
      if (m.tag) {
        const p = c().parties.find((x) => x.questTag === m.tag);
        if (!p) return false; // not on the map right now (the story re-spawns it)
        note(`hunt ${m.tag}`);
        if (goToParty(p) && g.mode === 'encounter') fight();
        return true;
      }
      if (m.site) {
        if (!CL.world.siteActive(m.site)) return false;
        note(`attack ${m.site}`);
        if (goToSite(m.site) && g.mode === 'encounter') fight();
        return true;
      }
      // Any band (or any fight at all): meet one on the road.
      const p = c().parties.find((x) => CL.content.get('party_templates', x.template).kind === 'bandit' && !x.questTag && !x.contractId);
      if (!p) return false;
      note(`hunt any band for ${st.id}`);
      if (goToParty(p) && g.mode === 'encounter') fight();
      return true;
    }
    return false;
  }

  // ---- Save and reload, like closing the browser ----

  function reload() {
    CL.save.write();
    CL.campaign = CL.save.load();
    Object.assign(g, { travel: null, siteId: null, partyId: null, contactParty: null, waiting: false, town: null, talk: null });
    CL.ui.changeMode('map');
    stats.reloads++;
    note('reloaded');
  }

  // ---- The loop ----

  const finished = () => CL.story.questStatus(c(), 'q4') === 'done';

  function play(maxSteps = 600) {
    for (; stats.steps < maxSteps && !finished(); stats.steps++) {
      settle();
      const r = rnd();
      const stages = activeStages();
      if (r < 0.45 && stages.length && work(pick(stages))) {
        // worked on the story
      } else if (r < 0.85) {
        const all = people();
        if (all.length) converse(pick(all));
      } else if (r < 0.95) {
        const days = 0.2 + rnd() * 1.3;
        if (g.mode !== 'map' && !c().world.location) settle();
        CL.party.advanceDays(days);
        stats.waits++;
        note(`waited ${days.toFixed(1)}d`);
      } else {
        // The story is the Border March's: wander among its places (W-05b: the March is two regions
        // in the middle of a bigger world; Gate D's checks stay there).
        const sid = pick(marchPlaces());
        note(`ride to ${sid}`);
        goTo(sid);
      }
      if (rnd() < reloadChance) reload();
      for (const st of activeStages()) stats.stages.add(st.id);
    }
    return { finished: finished(), stats, trace };
  }

  return { play, stats, trace, people };
}

module.exports = { makeStoryBot };
