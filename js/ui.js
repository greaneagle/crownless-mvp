/* Crownless DOM UI: overlays, roster, messages, pause and the diagnostics panel. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const $ = (s) => document.querySelector(s);

  const MESSAGE_MS = 2500;

  const TYPE_LABEL = { town: 'Market town', fort: 'Fortress', village: 'Village' };

  /** Overlay copy for each mode. Map and battle hide the overlay entirely. */
  function screenFor(mode) {
    const g = CL.game;
    if (mode === 'result' && g.result.practice) {
      if (g.result.practice.bench) return { title: 'BATTLE BENCHMARK', text: 'How this device handled each battle size:', button: 'Continue' };
      return { title: g.result.practice.arena ? 'CAMERA TEST' : 'STRESS TEST', text: 'How this device handled the battle:', button: 'Continue' };
    }
    if (mode === 'result' && g.result.duel) {
      return { title: g.result.win ? 'BOUT WON' : 'BOUT LOST', text: 'The lists:', button: 'Continue' };
    }
    if (mode === 'result') {
      return {
        title: g.result.win ? 'VICTORY' : 'CAPTURED',
        text: g.result.win
          ? 'The enemy has been routed. Your surviving soldiers gather the spoils.'
          : 'Your party was broken. You were held for half a day, then released without some of your crowns and gear.',
        button: 'Continue',
      };
    }
    if (mode === 'settlement') {
      const s = CL.party.currentSettlement();
      const c = CL.campaign;
      const holder = CL.realm.owner(s.id, c);
      const owner = CL.realm.faction(holder);
      const st = CL.realm.standing(c, holder);
      const mood = st ? ` They are ${CL.realm.STANDING_LABEL[st].toLowerCase()} to you.` : '';
      // GDD §8: forts show their garrison (the holder's troops).
      const gar = CL.realm.garrison(s.id, c);
      const garrison = gar
        ? ` Garrison: ${Object.values(gar).reduce((a, b) => a + b, 0)} (${Object.entries(gar)
            .map(([id, n]) => `${n} ${plural(CL.content.troop(id).name, n)}`)
            .join(', ')}).`
        : '';
      return {
        title: s.name.toUpperCase(),
        text: `${TYPE_LABEL[s.type] || s.type} of the ${owner.name}.${mood} ${CL.world.clockLabel()}.${garrison}`,
        button: 'Leave',
        secondary: CL.town.hubFor(s.id) ? 'Walk the streets' : null,
      };
    }
    if (mode === 'encounter') {
      const e = CL.parties.current();
      const ready = CL.party.healthySoldiers().length;
      const count = Object.values(e.troops).reduce((a, b) => a + b, 0);
      const them = e.hostile ? ` They number ${count}.` : '';
      return {
        title: e.name.toUpperCase(),
        text: `${g.waitCut ? `${g.waitCut} ` : ''}${e.text}${them} You have ${ready} soldier${ready === 1 ? '' : 's'} fit to fight.${e.hostile ? CL.reinforce.note(CL.campaign, e) : ''}`,
        button: null,
      };
    }
    if (mode === 'create') {
      return {
        title: g.newGame ? 'A NEW WANDERER' : 'WHO ARE YOU?',
        text: g.newGame
          ? 'You come with little more than a sword. Where do you begin, and who were you before the road?' // P10-04: any kingdom
          : 'Your party remembers your deeds, but not your name. Tell them who leads them.',
        button: 'Begin',
        secondary: g.newGame ? 'Back' : null,
      };
    }
    if (mode === 'talk') {
      const t = g.talk;
      // P10-08 (reference 05): the speaker's own name, and what they are beneath it.
      return { title: t.npc.name, sub: t.npc.tag || null, text: `“${t.line}”`, button: null };
    }
    if (mode === 'journal') {
      return { title: 'JOURNAL', text: '', button: 'Back' };
    }
    if (mode === 'wait') {
      return { title: 'WAIT', text: 'How long should the company wait here? The world goes on meanwhile, and anyone who comes for you will find you.', button: 'Wait', secondary: 'Back' };
    }
    if (mode === 'realm') {
      return { title: 'THE REALMS', text: '', button: 'Back' };
    }
    if (mode === 'grant') {
      const g = CL.fiefs.grantDue(CL.campaign);
      return { title: 'A GRANT OF LAND', text: g ? CL.fiefs.grantLines(CL.campaign, g).join(' ') : 'The messenger has gone.', button: null };
    }
    if (mode === 'siegeAlarm') {
      const sid = CL.game.siegeAlarm;
      const s = sid ? CL.sieges.at(CL.campaign, sid) : null;
      return { title: 'UNDER SIEGE', text: sid ? `${CL.content.get('settlements', sid).name} is besieged${s ? ` by the ${CL.realm.faction(s.realm)?.name}` : ''}. It has food for ${Math.ceil(CL.realm.holding(sid, CL.campaign).food)} days.` : '', button: null };
    }
    if (mode === 'conquest') {
      const sid = CL.game.conquest;
      return { title: 'THE CONQUEROR’S CHOICE', text: sid ? `${CL.content.get('settlements', sid).name} is taken for the ${CL.realm.faction(CL.realm.sovereignOf(sid, CL.campaign)).name}. What becomes of it is yours to ask.` : '', button: null };
    }
    if (mode === 'ransom') {
      const x = CL.lords.offerDue(CL.campaign);
      return { title: 'A RANSOM OFFER', text: x ? CL.lords.offerText(CL.campaign, x) : 'The messenger has gone.', button: null };
    }
    if (mode === 'ending') {
      return { title: g.ending.title.toUpperCase(), text: g.ending.text, button: 'Return to the March' };
    }
    if (mode === 'saves') {
      return { title: 'SAVE & EXPORT', text: '', button: 'Back' };
    }
    if (mode === 'contracts') {
      const s = CL.party.currentSettlement();
      return {
        title: `${s.name.toUpperCase()} — CONTRACTS`,
        text: 'Paid work for a sword and a band of soldiers. One contract at a time.',
        button: 'Back',
      };
    }
    if (mode === 'detachments') {
      return {
        title: 'DETACHMENTS',
        text: 'Send part of the company out under a captain, with orders, food and pay. They report back, and rejoin you when you meet.',
        button: 'Back',
      };
    }
    if (mode === 'accounts') {
      return {
        title: 'ACCOUNTS',
        text: 'Your purse, the company chest and your followers. Wages are paid from the chest first, then from your purse.',
        button: 'Back',
      };
    }
    if (mode === 'trade') {
      const s = CL.party.currentSettlement();
      return {
        title: `${s.name.toUpperCase()} MARKET`,
        text: 'Buy where goods are cheap, sell where they are dear. Prices move as you trade and settle back over the days.',
        button: 'Back',
      };
    }
    if (mode === 'character') {
      // P10-08: the name and level are on the hero's card below.
      return { title: 'PARTY', text: `${CL.world.clockLabel()}.`, button: 'Back' };
    }
    const existed = CL.save.existed;
    return {
      title: 'CROWNLESS',
      // A save that could not be opened (SC-33, or W-05b's old world) is explained here, where it can't
      // be missed, as well as in the passing message.
      text: CL.save.notice || 'Six kingdoms and the ruins of an empire. Choose where you begin and who you were, hire soldiers, take a side or none, and make a name.',
      button: existed ? 'Continue' : 'New game',
      secondary: existed ? (g.confirmNew ? 'Erase save and start over?' : 'New game') : null,
    };
  }

  function message(text) {
    CL.game.message = text;
    CL.game.messageUntil = performance.now() + MESSAGE_MS;
    $('#message').textContent = text;
    fitHud();
    CL.audio?.play('note', 0.7);
    CL.diag.log('info', text);
  }

  /**
   * Phone layout: the HUD panel may only be as wide as the space the top-right buttons leave (its
   * text wraps rather than hiding under them), and announcements sit just below it, not over it.
   */
  function fitHud() {
    const stage = $('#stage')?.getBoundingClientRect();
    const left = $('#topLeft');
    const right = $('#topRight')?.getBoundingClientRect();
    if (!stage || !left || !right) return;
    const room = (right.width ? right.left : stage.right - stage.width * 0.02) - left.getBoundingClientRect().left - 8;
    left.style.maxWidth = `${Math.max(150, Math.floor(room))}px`;
    $('#message').style.top = `${Math.ceil(left.getBoundingClientRect().bottom - stage.top + 6)}px`;
  }

  /**
   * W-01: the player's text size. Every HTML size in style.css is written against --ui-scale, and
   * touch targets against --ui-grow (never below 1, so a tap area grows with the text but never
   * shrinks); the stage's data-text-size lets CSS shorten what would otherwise crowd. Applied at once,
   * mid-battle included (nothing pauses); open panels simply re-flow.
   */
  function applyTextScale(scale) {
    const root = document.documentElement.style;
    root.setProperty('--ui-scale', String(scale));
    root.setProperty('--ui-grow', String(Math.max(1, scale)));
    const stage = $('#stage');
    if (stage) stage.dataset.textSize = CL.settings?.get('textSize') || 'normal';
    requestAnimationFrame(fitHud); // the top-left panel and the message line move with the text
  }

  function changeMode(mode) {
    const g = CL.game;
    g.mode = mode;
    $('#stage').dataset.mode = mode;
    $('#stage').dataset.art = mode === 'town' ? 'storybook' : ''; // P11-12b/c: the storybook town HUD (P11-12d: every screen)
    if (mode !== 'encounter') g.waitCut = null; // P10-01: the note belongs to the encounter it led to
    requestAnimationFrame(fitHud); // the top-right buttons change with the mode
    CL.audio?.onMode(mode);
    // A tip belongs to the screen it explains: a new screen closes it, then may bring its own.
    if (CL.tips?.showing()) hideTip();
    setTimeout(() => CL.tips?.check(), 400);
    if (mode === 'result') CL.audio?.play(g.result?.win ? 'win' : 'capture');
    $('#attackBtn .btnLabel').textContent = mode === 'town' ? 'TALK' : 'ATTACK';
    if (mode === 'town') $('#attackBtn').setAttribute('aria-label', 'Talk');
    CL.input?.releaseHeld?.(); // P11-09: nothing stays held across a change of screen (a battle's end among them)
    $('#ordersPanel').classList.add('hidden');
    $('#prepPanel').classList.toggle('hidden', mode !== 'prepare');
    if (mode === 'prepare') renderPrep();
    if (mode === 'map' || mode === 'town' || mode === 'prepare') {
      $('#overlay').classList.add('hidden');
      g.messageUntil = 0; // drop leftover battle/menu messages
      $('#message').textContent = '';
      return;
    }
    $('#overlay').classList.remove('hidden');
    const modal = $('#overlay .modal');
    if (modal) modal.scrollTop = 0; // a new screen starts at its top (not where a long one was scrolled to)
    $('#prep').classList.toggle('hidden', mode !== 'settlement');
    $('#result').classList.toggle('hidden', mode !== 'result');
    $('#create').classList.toggle('hidden', mode !== 'create');
    $('#sheet').classList.toggle('hidden', mode !== 'character');
    $('#tradeScreen').classList.toggle('hidden', mode !== 'trade');
    $('#encounterOptions').classList.toggle('hidden', mode !== 'encounter');
    $('#contractsScreen').classList.toggle('hidden', mode !== 'contracts');
    $('#accountsScreen').classList.toggle('hidden', mode !== 'accounts');
    $('#detachScreen').classList.toggle('hidden', mode !== 'detachments');
    $('#journalScreen').classList.toggle('hidden', mode !== 'journal');
    $('#realmScreen').classList.toggle('hidden', mode !== 'realm');
    $('#savesScreen').classList.toggle('hidden', mode !== 'saves');
    $('#talkOptions').classList.toggle('hidden', mode !== 'talk');
    $('#talkPortrait')?.classList.toggle('hidden', mode !== 'talk');
    $('#ransomOptions').classList.toggle('hidden', !['ransom', 'grant', 'conquest', 'siegeAlarm'].includes(mode)); // the decisions that interrupt the map
    $('#titleExtras').classList.toggle('hidden', mode !== 'title');
    $('#waitScreen').classList.toggle('hidden', mode !== 'wait');
    $('#overlayText').classList.toggle('hidden', mode === 'saves' || mode === 'journal' || mode === 'realm');
    const screen = screenFor(mode);
    if (mode === 'result') {
      $('#result').innerHTML = g.result.html;
      if (g.result.slowOffer) $('#result').append(slowOfferBox(g.result.slowOffer));
    }
    $('#overlayTitle').textContent = screen.title;
    $('#overlaySub').textContent = screen.sub || '';
    $('#overlaySub').classList.toggle('hidden', !screen.sub);
    $('#overlayText').textContent = screen.text;
    $('#primaryBtn').classList.toggle('hidden', !screen.button);
    if (screen.button) $('#primaryBtn').textContent = screen.button;
    $('#secondaryBtn').classList.toggle('hidden', !screen.secondary);
    if (screen.secondary) $('#secondaryBtn').textContent = screen.secondary;
    if (mode === 'settlement') refreshRoster();
    if (mode === 'create') renderCreator();
    if (mode === 'character') renderSheet();
    if (mode === 'trade') renderTrade();
    if (mode === 'encounter') renderEncounter();
    if (mode === 'contracts') renderContracts();
    if (mode === 'accounts') renderAccounts();
    if (mode === 'detachments') renderDetachments();
    if (mode === 'saves') renderSaves();
    if (mode === 'talk') renderTalk();
    if (mode === 'journal') renderJournal();
    if (mode === 'wait') renderWait();
    if (mode === 'realm') renderRealm();
    if (mode === 'ransom') renderRansom();
    if (mode === 'grant') renderGrant();
    if (mode === 'conquest') renderConquest();
    if (mode === 'siegeAlarm') renderSiegeAlarm();
  }

  /**
   * P9-B1: after a battle that ran slowly, the offer of a smaller battle size (never forced).
   * @param {{ fps: number, size: number }} o
   */
  function slowOfferBox(o) {
    const box = Object.assign(document.createElement('p'), { id: 'slowOffer', className: 'slowOffer' });
    box.append(`This battle ran at ${o.fps} frames a second on this device. A battle size of ${o.size} at once would run smoother (Settings → Battle size). `);
    const b = Object.assign(document.createElement('button'), { type: 'button', id: 'slowOfferUse', textContent: `Use ${o.size}` });
    b.onclick = () => {
      CL.settings.set('battleSize', o.size);
      box.textContent = `Battle size set to ${o.size} at once. You can change it in Settings.`;
    };
    box.append(b);
    return box;
  }

  /** A decision's button: a bold label and a short note. */
  function decision(id, label, note, onClick) {
    const b = Object.assign(document.createElement('button'), { type: 'button', id });
    b.append(Object.assign(document.createElement('b'), { textContent: label }), Object.assign(document.createElement('small'), { textContent: note }));
    b.onclick = onClick;
    return b;
  }

  // ---- P10-01: the Wait screen, the fade while time passes, and the map's speed ----

  const WAIT_MAX_DAYS = 30;

  function openWait() {
    const g = CL.game;
    if (g.mode !== 'map' || g.waitPlan) return;
    g.travel = null;
    changeMode('wait');
  }

  /** The chosen days and hours, kept within 1 hour to 30 days. */
  function setWaitPick(days, hours) {
    let total = Math.round(days) * 24 + Math.round(hours);
    total = Math.max(1, Math.min(WAIT_MAX_DAYS * 24, total));
    CL.game.waitPick = { days: Math.floor(total / 24), hours: total % 24 };
    renderWait();
  }

  function renderWait() {
    const p = CL.game.waitPick;
    $('#waitDays').textContent = String(p.days);
    $('#waitHours').textContent = String(p.hours);
    $('#waitDaysDown').disabled = p.days === 0 || p.days * 24 + p.hours <= 24;
    $('#waitDaysUp').disabled = p.days >= WAIT_MAX_DAYS;
    $('#waitHoursDown').disabled = p.days === 0 && p.hours <= 1;
    $('#waitHoursUp').disabled = p.days >= WAIT_MAX_DAYS;
    $('#primaryBtn').textContent = `Wait ${CL.world.span(p.days * 24 + p.hours)}`;
  }

  function confirmWait() {
    const p = CL.game.waitPick;
    changeMode('map');
    CL.world.beginWait(p.days * 24 + p.hours);
  }

  function bindWait() {
    const pick = (dd, dh) => () => {
      const p = CL.game.waitPick;
      setWaitPick(p.days + dd, p.hours + dh);
    };
    $('#waitDaysDown').onclick = pick(-1, 0);
    $('#waitDaysUp').onclick = pick(1, 0);
    $('#waitHoursDown').onclick = pick(0, -1);
    $('#waitHoursUp').onclick = pick(0, 1);
    for (const b of document.querySelectorAll('#waitScreen [data-wait]')) b.onclick = () => setWaitPick(0, Number(b.dataset.wait));
    $('#speedBtn').onclick = toggleSpeed;
    refreshSpeed();
  }

  /** The screen darkens while a wait passes (0 clear, 1 dark), with the clock in the middle. */
  function setFade(opacity, text = '') {
    const f = $('#fade');
    if (!f) return;
    f.classList.toggle('hidden', !(opacity > 0));
    f.style.opacity = String(opacity);
    $('#fadeText').textContent = opacity >= 1 ? text : '';
  }

  /** The speed button shows the map's speed: ▶ Normal, ▶▶ Fast. */
  function refreshSpeed() {
    const fast = CL.settings.get('mapSpeed') === 'fast';
    const b = $('#speedBtn');
    if (!b) return;
    b.textContent = fast ? '▶▶' : '▶';
    b.classList.toggle('fast', fast);
    b.setAttribute('aria-label', `Map speed: ${fast ? 'Fast' : 'Normal'}`);
    b.title = fast ? 'Map speed: Fast, four hours a second (tap for Normal)' : 'Map speed: Normal, an hour a second (tap for Fast)';
    if ($('#setMapSpeed')) $('#setMapSpeed').value = fast ? 'fast' : 'normal';
  }

  function toggleSpeed() {
    const fast = CL.settings.get('mapSpeed') !== 'fast';
    CL.settings.set('mapSpeed', fast ? 'fast' : 'normal');
    refreshSpeed();
    message(fast ? 'Map speed: Fast, four hours a second.' : 'Map speed: Normal, an hour a second.');
  }

  // ---- A grant of land (P8-05): Accept or Decline ----

  function openGrant() {
    if (CL.game.mode !== 'map' || !CL.fiefs.grantDue(CL.campaign)) return;
    changeMode('grant');
  }

  function renderGrant() {
    const c = CL.campaign;
    const g = CL.fiefs.grantDue(c);
    if (!g) return changeMode('map');
    const done = (choice) => () => {
      const r = CL.fiefs.answer(c, choice);
      CL.save.write();
      changeMode('map');
      if (r?.text) message(r.text);
    };
    $('#ransomOptions').replaceChildren(
      decision('grant_accept', 'Accept', 'The holding is yours: its tax, its costs, a day there counts as service', done('accept')),
      decision('grant_decline', 'Decline', 'The crown grants it to someone else', done('decline')),
    );
  }

  // ---- The conqueror's choice (P8-05, D-P8f): ask, suggest, hand over or keep ----

  function openConquest(sid) {
    CL.game.conquest = sid;
    changeMode('conquest');
  }

  function renderConquest() {
    const c = CL.campaign;
    const sid = CL.game.conquest;
    if (!sid) return changeMode('map');
    const f = CL.realm.sovereignOf(sid, c);
    // The lord you'd name: the one who thinks best of you, else the realm's first landless lord.
    const g = { sid, helper: null, declined: [], offeredTo: null };
    const pick = CL.fiefs.candidates(c, g).find((id) => id !== 'player');
    const choose = (choice, who = null) => () => {
      const r = CL.fiefs.conquered(c, sid, 'player', choice, who);
      CL.game.conquest = null;
      CL.save.write();
      changeMode('map');
      const words = { ask: 'You ask the crown for it.', suggest: `You name ${who ? CL.realm.titled(who, c) : 'a lord'} for it.`, hand: 'You hand it to the crown outright.', keep: r?.accepted ? 'You keep it, and the crown lets it stand.' : 'You keep it, and the crown casts you out for it.' };
      message(words[choice]);
    };
    const name = CL.realm.titled(CL.realm.rulerOf(f, c), c);
    $('#ransomOptions').replaceChildren(
      decision('conquest_ask', 'Ask the liege for it', `${name} decides; you did most in its taking (the default)`, choose('ask')),
      ...(pick ? [decision('conquest_suggest', `Suggest ${CL.realm.titled(pick, c)}`, 'If granted, they will remember it', choose('suggest', pick))] : []),
      decision('conquest_hand', 'Hand it to the crown', 'More influence with the ruler', choose('hand')),
      decision('conquest_keep', 'Keep it unasked', 'The ruler may accept it, or cast you out', choose('keep')),
    );
  }

  // ---- A ransom offer (P8-01): Accept, Hold or Release; it interrupts the map ----

  function openRansom() {
    if (CL.game.mode !== 'map' || !CL.lords.offerDue(CL.campaign)) return;
    changeMode('ransom');
  }

  function renderRansom() {
    const c = CL.campaign;
    const x = CL.lords.offerDue(c);
    const box = $('#ransomOptions');
    if (!x) {
      box.replaceChildren();
      return changeMode('map');
    }
    const choice = (id, label, note) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', id: `ransom_${id}` });
      b.append(Object.assign(document.createElement('b'), { textContent: label }), Object.assign(document.createElement('small'), { textContent: note }));
      b.onclick = () => {
        const r = CL.lords.answer(c, x.lord, id);
        CL.save.write();
        changeMode('map');
        if (r?.text) message(r.text); // after the map is back, so it stays on screen
        if (CL.lords.offerDue(c)) openRansom(); // another waiting
      };
      return b;
    };
    box.replaceChildren(
      choice('accept', `Accept · ${CL.lords.ransomOf(x)} crowns`, 'They go home, and you are paid'),
      choice('hold', 'Hold', 'Keep them for now: another offer in a few days, and they may escape'),
      choice('release', 'Release', `Let them go for nothing: renown, and their goodwill`),
    );
  }

  // ---- Talking to people in town (GDD §8: interaction opens dialogue menus) ----

  function renderTalk() {
    const c = CL.campaign;
    const P = CL.party;
    const U = CL.upkeep;
    const n = CL.game.talk.npc;
    const opts = [];
    const opt = (label, onClick, disabled = false, note = '', troop = null) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', disabled });
      if (troop) b.append(troopImg(troop, null, 'troopFig btn')); // P10-G5
      b.append(Object.assign(document.createElement('b'), { textContent: label }));
      if (note) b.append(Object.assign(document.createElement('small'), { textContent: note }));
      b.onclick = onClick;
      opts.push(b);
    };
    const redo = () => {
      CL.save.write();
      changeMode('talk');
    };
    // The conversation's own choices come first (data/dialogue.js via the story interpreter).
    const conv = CL.game.talk.conv;
    for (const o of conv?.options || []) {
      opt(o.text, () => {
        const next = CL.story.choose(conv, o.index);
        CL.save.write();
        if (next) {
          CL.game.talk = { ...CL.game.talk, conv: next, line: next.text };
          changeMode('talk');
        } else if (CL.game.mode !== 'ending') CL.town.backToPlace(); // an ending panel stays up
      });
    }
    const services = !conv || conv.services;
    if (!services) {
      // a story moment: no shop menu here
    } else if (n.action === 'trade') {
      opt('See my wares', () => changeMode('trade'), false, `${c.gold} crowns · cargo ${CL.trade.cargoWeight(c)}/${CL.trade.capacity(c)}`);
    } else if (n.action === 'recruit') {
      for (const id of P.recruitsHere()) {
        const t = CL.content.troop(id);
        opt(`Hire a ${t.name} · ${t.recruitCost} crowns`, () => P.recruit(id) && redo(), !P.canRecruit(c, id), `${t.tier} ${t.role} · wage ${t.wage}/week`, id);
        // P9-B3: five at once, for a company that has room for many.
        if (P.partyCap(c) - P.headcount(c) >= HIRE_MANY) opt(`Hire ${HIRE_MANY} ${plural(t.name, HIRE_MANY)} · ${HIRE_MANY * t.recruitCost} crowns`, () => P.recruitMany(id, HIRE_MANY) && redo(), P.canHireMany(c, id, HIRE_MANY) < HIRE_MANY, `wages ${HIRE_MANY * t.wage}/week`);
      }
      opt('Review my troops', () => openSheet(), false, `${CL.party.headcount(c)}/${P.partyCap()} in the company${CL.detachments.away(c) ? ` (${CL.detachments.away(c)} away)` : ''}`);
    } else if (n.action === 'tavern') {
      const price = U.rationPrice(c);
      for (const [days, label] of [
        [3, "3 days' food"],
        [7, "a week's food"],
      ]) {
        const rations = U.dailyRations(c) * days;
        opt(`Buy ${label} · ${rations * price} crowns`, () => U.buyFood(c, rations) && redo(), c.gold < rations * price);
      }
      opt('Rest a day by the fire', () => {
        P.rest();
        redo();
      }, false, `${P.woundedSoldiers().length} wounded · food ${U.foodDays(c).toFixed(1)} days`);
      const k = c.contract;
      const pay = k?.status === 'done' && k.giver === c.world.location;
      opt(pay ? 'Notice board — collect pay!' : 'Read the notice board', () => changeMode('contracts'));
      opt('Detachments', () => {
        CL.game.returnMode = 'place';
        changeMode('detachments');
      }, false, CL.detachments.active(c).length ? `${CL.detachments.active(c).length} out` : 'Send part of the company out under a captain');
      opt('Accounts and followers', () => changeMode('accounts'), false, 'Your money and your followers: quartermaster, merchant, surgeon, blacksmith, scout');
      opt('Save & export', () => openSaves());
    }
    opt('Goodbye', () => CL.town.backToPlace());
    $('#talkOptions').replaceChildren(...opts);
    talkPortrait(n);
  }

  /** P10-G5: who you are talking to, as a portrait beside their name (a companion, a lord, a townsperson). */
  function talkPortrait(n) {
    let img = $('#talkPortrait');
    if (!img) {
      img = Object.assign(document.createElement('img'), { id: 'talkPortrait', className: 'portrait', alt: '' });
      $('#overlayTitle').before(img);
    }
    const tree = CL.content.table('dialogue')[n.dialogue || n.id];
    const cast = !n.role && !n.companion && tree ? CL.story.lookOf(tree) : {};
    const L = CL.gfx.ui.speakerLook({ ...cast, ...n, role: n.role || cast.role, companion: n.companion || cast.companion, gender: n.gender || cast.gender }, CL.campaign);
    img.classList.toggle('hidden', !L);
    if (L) img.src = CL.gfx.ui.portraitUrl(L, 72, { helm: false });
  }

  // ---- Save & export (GDD §13) ----

  function ago(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
  }

  function renderSaves(result) {
    const S = CL.save;
    const inGame = S.existed && Boolean(CL.campaign.character);
    const status = $('#saveStatus');
    status.className = S.lastError ? 'warn' : '';
    status.textContent = S.lastError
      ? `This browser refused the last save (${S.lastError}). Export your game to keep it.`
      : inGame
        ? `${CL.campaign.character.name}, ${CL.world.clockLabel()}. Last saved ${S.lastSavedAt ? ago(S.lastSavedAt) : 'when this session started'}.`
        : 'No game in progress — you can import a save from another browser or device.';
    if (inGame) {
      const last = CL.portable.lastExport();
      status.textContent += ` ${last ? `Last copy exported ${ago(last.at)}.` : 'No copy exported from this browser yet.'}`;
      if (S.persisted === true) status.textContent += ' This browser has agreed not to clear the game on its own.';
    }
    if (S.stale) {
      status.className = 'warn';
      status.textContent = 'This game is open in another tab, so this one has stopped saving. Reload the page to carry on here.';
    }
    for (const id of ['#saveNowBtn', '#exportBtn', '#copySaveBtn']) $(id).disabled = !inGame;
    $('#restoreBtn').classList.toggle('hidden', !CL.portable.hasPreImport());
    const box = $('#importResult');
    box.replaceChildren();
    if (result) {
      box.className = result.ok ? 'ok' : 'warn';
      box.append(Object.assign(document.createElement('p'), { textContent: result.text }));
      if (result.problems?.length) {
        const ul = document.createElement('ul');
        for (const p of result.problems) ul.append(Object.assign(document.createElement('li'), { textContent: p }));
        box.append(ul);
      }
    }
  }

  function openSaves() {
    const m = CL.game.mode;
    CL.game.savesReturn = m === 'title' ? 'title' : 'place';
    changeMode('saves');
  }

  /** After a successful import: go straight into the imported game. */
  function importDone(r) {
    $('#importText').value = '';
    $('#pasteBox').open = false;
    message(r.migrated ? 'Old save converted and loaded.' : 'Save imported.');
    if (!CL.campaign.character) changeMode('create');
    else if (CL.party.currentSettlement()) CL.town.enterPlace();
    else changeMode('map');
  }

  // ---- Contracts board ----

  function describeTroops(troops) {
    return Object.entries(troops)
      .map(([id, n]) => `${n} ${CL.content.troop(id).name}${n > 1 ? 's' : ''}`)
      .join(', ');
  }

  /** A trade good's name with its icon (P10-G5: drawn, or a pack's own emoji when it has no drawing). */
  function goodName(g) {
    const b = document.createElement('b');
    if (CL.gfx.ui.ICONS[g.id]) b.append(Object.assign(document.createElement('span'), { className: `ico ico-${g.id}` }), g.name);
    else b.textContent = `${g.icon || ''} ${g.name}`.trim();
    return b;
  }

  function contractCard(title, lines, buttons) {
    const card = Object.assign(document.createElement('div'), { className: 'contractCard' });
    card.append(Object.assign(document.createElement('h3'), { textContent: title }));
    for (const l of lines) card.append(Object.assign(document.createElement('p'), { textContent: l }));
    const row = Object.assign(document.createElement('div'), { className: 'row' });
    for (const [label, onClick, disabled] of buttons) {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label, disabled: Boolean(disabled) });
      b.onclick = onClick;
      row.append(b);
    }
    if (buttons.length) card.append(row);
    return card;
  }

  function renderContracts() {
    const c = CL.campaign;
    const K = CL.contracts;
    const sid = c.world.location;
    const cards = [];
    const k = c.contract;
    const name = (id) => CL.content.get('settlements', id).name;
    const leagues = (a, b) => {
      const [x, y] = [CL.content.get('settlements', a), CL.content.get('settlements', b)];
      return Math.round(CL.world.mapDist(x.mapX, x.mapY, y.mapX, y.mapY));
    };
    const fill = (text, o) => CL.contracts.fill(text, o); // the board's words: giver, destination and (P9-02) the envoy's treaty
    const rewardLine = (o) => `Reward: ${o.reward.gold} crowns${o.deposit ? ` (${o.deposit} of it your deposit back)` : ''} · +${o.reward.renown} renown · +${o.reward.xp} XP`;
    const after = (fn) => () => {
      const r = fn();
      if (r?.ok === false) message(r.reason);
      CL.save.write();
      renderContracts();
    };
    /** What the job asks, for offers and the active card alike. */
    const task = (o) => {
      const t = CL.content.get('contracts', o.template);
      if (t.kind === 'escort') {
        return [`Ride beside the caravan to ${name(o.to)}, ${leagues(o.giver, o.to)} leagues away. It only rolls while you stay within ${t.escortRange} leagues of it.`, `Reavers (${describeTroops(o.troops)}) lie in wait on the road.`];
      }
      if (t.kind === 'delivery') {
        return o.letter
          ? [`Carry a sealed letter to ${name(o.to)}, ${leagues(o.giver, o.to)} leagues away.`]
          : [`Carry ${o.qty} ${CL.content.get('markets', o.good).name} to ${name(o.to)}, ${leagues(o.giver, o.to)} leagues away. Deposit: ${o.deposit} crowns, paid back on delivery.`];
      }
      return [`Destroy the marked band (${describeTroops(o.troops)}).`];
    };
    if (k) {
      const t = CL.content.get('contracts', k.template);
      if (k.status === 'done') {
        const here = sid === (k.payAt || k.giver);
        cards.push(
          contractCard(`${t.name} — complete`, [here ? 'The band is broken. Your employer counts out your pay.' : `Return to ${name(k.payAt || k.giver)} to collect.`, rewardLine(k)], [
            [
              'Collect payment',
              after(() => {
                const r = K.collect(c);
                if (r) message(`Paid ${r.gold} crowns${r.levels ? ' — level up!' : ''}`);
              }),
              !here,
            ],
          ]),
        );
      } else {
        const where = t.kind === 'hunt' ? [`It is camped about ${Math.round(CL.world.mapDist(CL.content.get('settlements', k.giver).mapX, CL.content.get('settlements', k.giver).mapY, k.x, k.y))} leagues from ${name(k.giver)}.`] : [];
        cards.push(
          contractCard(
            `${t.name} — for ${name(k.giver)}`,
            [...task(k), ...where, `Time left: ${K.daysLeft(c).toFixed(1)} days.`, rewardLine(k)],
            [['Abandon (−2 renown)', after(() => K.abandon(c))]],
          ),
        );
      }
    }
    const offers = K.offersAt(c, sid);
    for (const o of offers) {
      const t = CL.content.get('contracts', o.template);
      const intro = fill(o.letter ? t.offerLetter : t.offer, o);
      const short = o.deposit && c.gold < o.deposit;
      cards.push(
        contractCard(
          `Offer: ${t.name}`,
          [intro, ...task(o), `Time limit: ${o.days} days.`, rewardLine(o)],
          [[k ? 'Finish your current contract first' : short ? `Need ${o.deposit} crowns for the deposit` : 'Accept contract', after(() => K.accept(c, sid, o.template)), Boolean(k) || short]],
        ),
      );
    }
    const work = CL.rights.may(c, 'player', 'contract', sid); // P8-03
    if (!offers.length && !work.ok) {
      cards.push(contractCard('No work for enemies', [`${work.why}. Win back their favour by fighting Road Reavers on their land.`], []));
    } else if (!offers.length) {
      cards.push(contractCard('Nothing posted', ['The board is bare for now. New work goes up every few days.'], []));
    }
    cards.push(...allegianceCards(c, sid, renderContracts)); // service and fealty at a capital (P8-04)
    $('#contractsScreen').replaceChildren(...cards);
  }

  /**
   * P8-04: a change of allegiance as a card: what it is, the preview's lines (what changes and what
   * stays), and the one button that does exactly that. A refusal shows its reason on the card.
   */
  function allegianceCard(c, action, realm, title, label, redo) {
    const AL = CL.allegiance;
    const p = AL.preview(c, action, realm);
    const card = contractCard(title, p.ok ? p.lines : [p.why], [
      [
        label,
        () => {
          if (AL.act(c, action, realm)) CL.save.write();
          redo();
        },
        !p.ok,
      ],
    ]);
    card.classList.add('allegianceCard');
    card.dataset.action = action;
    return card;
  }

  /**
   * P9-03: the Realms screen's Your realm tab. Not ruling: a realm to declare from a fort you hold (or
   * why not). Ruling: its treasury, laws, offices, vassals and treaties; lords asking to swear to you;
   * your three officers' policies, a line each; a grant and a summons.
   */
  function ruleCards(c, redo) {
    const F = CL.founding;
    const R = CL.realm;
    const name = (sid) => CL.content.get('settlements', sid).name;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const act = (fn) => () => {
      if (fn()) CL.save.write();
      redo();
    };
    const f = F.mine(c);
    if (!f) {
      const forts = R.fiefsOf('player', c).filter((sid) => c.holdings[sid].kind !== 'village');
      if (!forts.length) return [contractCard('Your realm', ['You rule nothing yet. Hold a fort (granted, or a claim taken back with no crown behind you), win 600 renown and gather 40 soldiers, and you may declare a realm of your own there.'], [])];
      return forts.map((sid) => {
        const r = CL.rights.may(c, 'player', 'declare', sid);
        const card = contractCard(`Declare a realm at ${name(sid)}`, r.ok ? [`Your holdings leave the ${R.faction(c.holdings[sid].sovereign)?.name || 'realm they were held of'} and become a realm of your own. The old crown keeps a claim on each, and has ${F.RULES.acceptDays} days to accept it or go to war.`] : [r.why], [['Declare', act(() => F.declare(c, 'player', sid)), !r.ok]]);
        card.classList.add('ruleCard');
        card.dataset.declare = sid;
        return card;
      });
    }
    const cards = [];
    const head = contractCard(R.faction(f).name, F.lines(c), []);
    head.classList.add('ruleCard');
    head.dataset.realm = f;
    cards.push(head);
    for (const a of F.rule(c).asks) {
      const card = contractCard(`${R.titled(a.lord, c)} asks to swear to you`, [CL.nobles.opinionLine(c, a.lord)], [
        ['Accept', act(() => F.answerAsk(c, a.lord, true))],
        ['Decline', act(() => F.answerAsk(c, a.lord, false))],
      ]);
      card.classList.add('ruleCard');
      card.dataset.ask = a.lord;
      cards.push(card);
    }
    // The policies: a line each.
    const pol = el('div', 'contractCard ruleCard');
    pol.dataset.policies = '1';
    pol.append(el('h3', '', 'Your officers’ policies'));
    const others = R.realms().filter((k) => k.id !== f);
    const rows = [
      ['steward', 'Steward', [['grow', 'Grow: light taxes on your land'], ['hold', 'Hold: normal taxes'], ['hoard', 'Hoard: heavy taxes']]],
      ['marshal', 'Marshal', [['defend', 'Defend: no sieges of your own'], ['peace', 'Peace: no sieges'], ...others.map((k) => [`expand:${k.id}`, `Expand toward ${k.short}`])]],
      ['chancellor', 'Chancellor', [['peace', 'Peace: accept truces, peace and trade'], ['allies', 'Allies: alliances too'], ['none', 'None: decline every offer']]],
    ];
    for (const [office, label, options] of rows) {
      const row = el('label', 'setRow ruleRow', `${label} `);
      const sel = el('select', '');
      sel.dataset.policy = office;
      sel.setAttribute('aria-label', `${label}'s policy`);
      for (const [v, t] of options) sel.append(Object.assign(el('option', '', t), { value: v, selected: F.rule(c)[office] === v }));
      sel.onchange = act(() => F.setPolicy(c, office, sel.value));
      row.append(sel);
      pol.append(row);
    }
    cards.push(pol);
    // P9-T (SC-25): your own treaties: an offer to each realm, answered at once, and a treaty to break.
    const WORD = { truce: 'a truce', peace: 'peace', alliance: 'an alliance', trade: 'trade', nonaggression: 'a pact' };
    const tell = (fn) => act(() => fn().ok);
    for (const k of others) {
      const buttons = F.offers(c, k.id).slice(0, 3).map((o) => [o.kind === 'alliance' ? `Ally against ${R.faction(o.against).short}` : `Offer ${WORD[o.kind]}`, tell(() => F.propose(c, o.kind, k.id, o.against || null))]);
      for (const t of (c.treaties || []).filter((x) => x.between.includes(f) && x.between.includes(k.id) && x.kind !== 'peace')) buttons.push([`Break the ${t.kind}`, act(() => F.renounce(c, t.id))]);
      if (!buttons.length) continue;
      const card = contractCard(`Treaties with ${k.short}`, [`You are ${({ war: 'at war', tension: 'in tension', peace: 'at peace' })[R.relation(c, f, k.id)]}. Their ruler answers by their trust in you and what they think of you. A broken treaty is heard in every court.`], buttons);
      card.classList.add('ruleCard');
      card.dataset.treaties = k.id;
      cards.push(card);
    }
    // P9-04: a faction in your realm: answer it, then its demands.
    const RB = CL.rebellion;
    const x = RB?.active(c, f);
    if (x && x.warned >= 1 && x.stage !== 'rising') {
      const say = (fn) => act(() => {
        const r = fn();
        CL.ui.message(r.text);
        return r.ok;
      });
      const buttons = x.stage === 'demands'
        ? [['Meet the demands', say(() => RB.meet(c, x.id))], ['Refuse', say(() => RB.refuse(c, x.id))]]
        : [['Concede', say(() => RB.respond(c, x.id, 'concession'))], ['A mediator', say(() => RB.respond(c, x.id, 'mediator'))], ['Divide them', say(() => RB.respond(c, x.id, 'divide'))], ['Arrest the claimant', say(() => RB.respond(c, x.id, 'arrest'))], ['Prepare', say(() => RB.respond(c, x.id, 'prepare'))]];
      const card = contractCard('A faction at your court', [RB.line(c, x), x.stage === 'demands' ? 'Met, they disperse. Refused, they rise.' : 'Concede land, a lower share or an office; send a mediator; win one of them over; arrest the claimant (they may rise at once); or prepare for war.'], buttons);
      card.classList.add('ruleCard');
      card.dataset.faction = String(x.id);
      cards.push(card);
    }
    return cards;
  }

  /**
   * P9-05: armies. Summoned (the Allegiance tab): the army, and a button to ride to its banner. Ruling
   * (Your realm): raise your army, or give it its orders: besiege or raid a place, ride with you, go home.
   */
  function armyCards(c, redo, { ruling = false } = {}) {
    const AR = CL.armies;
    if (!AR) return [];
    const name = (sid) => CL.content.get('settlements', sid).name;
    const cards = [];
    const card = (title, lines, buttons, key) => {
      const x = contractCard(title, lines, buttons);
      x.classList.add('armyCard');
      x.dataset.army = key;
      cards.push(x);
    };
    if (!ruling) {
      const m = c.armyCall;
      const a = m && AR.byId(c, m.army);
      if (!a) return [];
      const q = AR.lead(c, a);
      const ride = () => {
        if (!q?.id) return;
        CL.ui.changeMode('map');
        CL.world.travelTo({ type: 'army', id: a.id, x: q.x, y: q.y }); // you keep beside its banner until you ride elsewhere
      };
      const lines = [AR.line(c, a), m.answered ? (AR.riding(c, a) ? 'You ride with it: its battles are yours.' : 'You answered: keep near its banner.') : 'Ride to its banner to answer. Not answered, it is marked against you.', 'Riding to its banner, you keep beside it until you ride elsewhere.'];
      card('Summoned to the army', lines, [['Ride to its banner', ride, !q?.id]], 'summons');
      return cards;
    }
    const a = AR.mine(c);
    const say = (fn) => () => {
      const r = fn();
      if (r?.why) CL.ui.message(r.why);
      if (r?.ok) CL.save.write();
      redo();
    };
    if (!a) {
      card('Your army', ['Call your vassals to ride with you. Each answers by what they think of you. The army eats, and costs your treasury a crown a soldier a week.'], [['Raise an army', say(() => AR.raiseMine(c))]], 'raise');
      return cards;
    }
    const lines = [AR.line(c, a)];
    if (a.phase === 'rally') lines.push(`It marches once half your lords have come to ${name(a.rally)}, or after a week.`);
    const buttons = [];
    if (a.phase !== 'rally') {
      for (const sid of AR.targets(c, a.realm, c.world).slice(0, 3)) buttons.push([`Besiege ${name(sid)}`, say(() => AR.order(c, 'besiege', sid))]);
      for (const sid of AR.raidable(c, a, c.world).slice(0, 2)) buttons.push([`Raid ${name(sid)}`, say(() => AR.order(c, 'raid', sid))]);
      buttons.push(['Ride with me', say(() => AR.order(c, 'follow'))]);
      lines.push('To besiege, ride to its gates: your lords come with you.');
    }
    buttons.push(['Send them home', say(() => AR.order(c, 'home'))]);
    card('Your army', lines, buttons, 'mine');
    return cards;
  }

  /** P9-04: the Allegiance tab's civil war: summoned by both sides; deposed, a refuge offered. */
  function risingCards(c, redo) {
    const RB = CL.rebellion;
    const st = RB?.state(c);
    if (!st) return [];
    const say = (fn) => () => {
      const r = fn();
      CL.ui.message(r.text);
      if (r.ok) CL.save.write();
      redo();
    };
    const cards = [];
    const x = st.summons && RB.byId(c, st.summons.id);
    if (x) {
      const card = contractCard('Civil war: both sides summon you', [RB.line(c, x), `Stand with the crown and keep your oath; or ride with the rising, which breaks it (your fiefs go with you).`], [
        ['Stand with the crown', say(() => RB.chooseSide(c, 'crown'))],
        ['Ride with the rising', say(() => RB.chooseSide(c, 'rebels'))],
      ]);
      card.classList.add('risingCard');
      cards.push(card);
    }
    if (st.refuge && c.day <= st.refuge.until) {
      const card = contractCard(`Refuge in ${CL.realm.faction(st.refuge.realm)?.name}`, [`Their ruler offers you a place at court, until day ${CL.party.dayNumber(st.refuge.until)}.`], [['Accept the refuge', say(() => RB.acceptRefuge(c))]]);
      card.classList.add('risingCard');
      cards.push(card);
    }
    return cards;
  }

  /**
   * P8-05: the Realm screen's Fief tab: each of your holdings with who runs it, its garrison or militia,
   * policies, money and last week; policies change in place, money and the castellan at the holding.
   */
  function fiefCards(c) {
    const F = CL.fiefs;
    const R = CL.realm;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const mine = R.fiefsOf('player', c);
    // P8-08: landless, the tab is your claims: no empty chores (SC-21).
    if (!mine.length) return claimCards(c, true);
    const redo = () => renderRealm();
    const btn = (label, fn, disabled = false, title = '') => {
      const b = el('button', '', label);
      Object.assign(b, { type: 'button', disabled, title });
      b.onclick = () => {
        fn();
        CL.save.write();
        redo();
      };
      return b;
    };
    const next = (list, v) => list[(list.indexOf(v) + 1) % list.length];
    return mine.map((sid) => {
      const h = F.ensure(c, sid);
      const s = CL.content.get('settlements', sid);
      const card = el('div', 'contractCard fiefCard');
      card.dataset.fief = sid;
      card.append(el('h3', '', `${s.name} · ${F.adminName(c, sid)}`));
      const men = h.kind === 'fort' ? `Garrison ${F.count(h.garrison)} (target ${F.garrisonTarget(h)})${h.walls < 100 ? ` · walls ${h.walls}%` : ''}` : `Militia ${h.militia}`;
      card.append(el('p', '', `${men} · prosperity ${h.prosperity} · unrest ${h.unrest}${h.unrest > F.RULES.unrest.stop ? ' (pays and recruits nothing)' : ''} · treasury ${F.cash(c, sid)} crowns`));
      const r = h.report;
      card.append(el('p', 'fiefReport', r ? `Last week: tax ${r.tax}, due ${r.due}, wages ${r.wages}${r.unpaid ? ` (${r.unpaid} unpaid)` : ''}${r.steward ? `, steward ${r.steward}` : ''}${r.repairs ? `, repairs ${r.repairs}` : ''}${r.refill ? `, recruits ${r.refill}` : ''}.` : 'No week run yet: the first report comes on payday.'));
      const pol = el('div', 'row');
      if (h.kind === 'fort') pol.append(btn(`Garrison: ${h.policies.garrison}`, () => F.setPolicy(c, sid, 'garrison', next(F.GARRISONS, h.policies.garrison))));
      pol.append(btn(`Tax: ${h.policies.tax}`, () => F.setPolicy(c, sid, 'tax', next(F.STANCES, h.policies.tax))));
      if (h.kind === 'fort') pol.append(btn(`Repairs: ${h.policies.repairs ? 'on' : 'off'}`, () => F.setPolicy(c, sid, 'repairs', !h.policies.repairs)));
      card.append(pol);
      const here = c.world?.location === sid;
      const money = el('div', 'row');
      money.append(btn('Put in 50', () => F.fund(c, sid, 50), !here || c.gold < 50, here ? '' : 'At the holding'));
      money.append(btn('Draw 50', () => F.fund(c, sid, -50), !here || F.cash(c, sid) < 50, here ? '' : 'At the holding'));
      if (h.castellan) money.append(btn(h.castellanLeaving ? 'Castellan: coming back' : 'Dismiss castellan', () => F.dismiss(c, sid), h.castellanLeaving));
      else {
        const vet = CL.detachments.captains(c).find((k) => k.kind === 'soldier');
        money.append(btn(vet ? `Make ${vet.name} castellan` : 'No veteran to be castellan', () => F.appoint(c, sid, vet.id), !vet || !here, here ? '' : 'At the holding'));
      }
      card.append(money);
      // P8-08: give it back to the crown yourself, after a word of what that means.
      const back = el('div', 'row handBackRow');
      if (CL.game.handBack === sid) {
        back.append(el('p', 'handBackNote', `${s.name} returns to ${R.titled(R.rulerOf(h.sovereign, c), c)}, and you keep no claim to it.`));
        const yes = btn('Yes, give it back', () => {
          const r = CL.claims.handBack(c, sid);
          CL.game.handBack = null;
          message(r.text);
        });
        yes.id = 'handBackYes';
        const no = btn('Keep it', () => {
          CL.game.handBack = null;
        });
        back.append(yes, no);
      } else {
        const give = btn('Give it back', () => {
          CL.game.handBack = sid;
        });
        give.classList.add('handBackBtn');
        back.append(give);
      }
      card.append(back);
      return card;
    }).concat(claimCards(c, false));
  }

  /**
   * P8-08: your claims, each with how it came about, who holds it now, and what could press it (ask your
   * liege, buy it back; a siege from the fort's own card). Landless, this is the whole tab.
   */
  function claimCards(c, landless) {
    const C = CL.claims;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const list = C.mine(c);
    const out = [];
    if (landless) out.push(el('p', 'realmNote', list.length ? 'You hold no land. Your company, money, mill and followers are yours; these are the places you have a claim to. A claim pays nothing until it is made good.' : 'You hold no land. A sworn vassal may be granted a holding by their liege: a village first, a fort with more renown and service.'));
    else if (list.length) out.push(el('h3', 'claimsHead', 'Your claims'));
    for (const { sid } of list) {
      const k = C.card(c, sid);
      const card = el('div', 'contractCard claimCard');
      card.dataset.claim = sid;
      card.append(el('h3', '', k.title), ...k.lines.map((l) => el('p', '', l)));
      const row = el('div', 'row');
      const act = (id, label, can, fn) => {
        const b = el('button', '', label);
        Object.assign(b, { type: 'button', disabled: !can.ok, title: can.why || '' });
        b.dataset.act = id;
        b.onclick = () => {
          const r = fn();
          message(r.text);
          CL.save.write();
          renderRealm();
        };
        return b;
      };
      if (R_kind(c, sid) !== 'village') {
        row.append(act('liege', 'Ask your liege to press it', k.liege, () => C.askLiege(c, sid)));
        row.append(act('buy', `Buy it back (${k.buy.price} crowns)`, k.buy, () => C.buyBack(c, sid)));
        row.append(act('serve', 'Serve for it', k.serve, () => C.serveBack(c, sid))); // P9-L1
      }
      if (row.children.length) card.append(row);
      const why = [k.liege, k.buy, k.serve].find((x) => !x.ok && x.why)?.why;
      if (why && R_kind(c, sid) !== 'village') card.append(el('p', 'claimWhy', `${why}.`));
      out.push(card);
    }
    return out;
  }
  const R_kind = (c, sid) => CL.realm.holding(sid, c)?.kind;

  /**
   * P8-06a: at a fort, the siege card. Not besieged: Besiege, with the preview (odds, time, cost), or
   * why not. Your siege: food, ladders and ram, the odds, and the day's choice (Assault, Wait a day, Lift).
   * Someone else's: what is going on.
   */
  function siegeCard(c, sid) {
    const S = CL.sieges;
    const h = CL.realm.holding(sid, c);
    if (h?.kind !== 'fort' || h.holder === 'player') return [];
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const s = S.at(c, sid);
    const card = el('div', 'contractCard siegeCard');
    const redo = () => {
      CL.save.write();
      refreshRoster();
    };
    const btn = (id, label, fn, disabled = false) => {
      const b = el('button', '', label);
      Object.assign(b, { type: 'button', id, disabled });
      b.onclick = () => {
        fn();
        redo();
      };
      return b;
    };
    if (s?.by === 'player') {
      card.dataset.siege = 'yours';
      const days = Math.floor(c.day - s.began);
      const odds = S.odds(c, s);
      card.append(el('h3', '', `Your siege of ${CL.content.get('settlements', sid).name} · day ${days + 1}`));
      card.append(el('p', '', `Food for ${Math.ceil(h.food)} days · garrison ${CL.fiefs.count(h.garrison)} · ${days >= S.RULES.ram ? 'a ram and ladders ready' : days >= S.RULES.ladders ? `ladders ready; a ram in ${S.RULES.ram - days} days` : 'ladders by tomorrow'}.`));
      // P8-07: the lords who answered your request: in camp, or on the road.
      const camp = s.lords.map((pid) => {
        const q = CL.lords.partyOf(c, pid);
        const f = CL.content.get('settlements', s.sid);
        return q ? `${CL.realm.titled(pid, c)} ${CL.world.mapDist(q.x, q.y, f.mapX, f.mapY) <= S.RULES.camp * 2 ? 'is in camp' : 'is on the road'}` : null;
      }).filter(Boolean);
      if (camp.length) card.append(el('p', 'siegeLords', `${camp.join('; ')}.`));
      card.append(el('p', '', odds ? `Storm it now: about ${Math.round(odds * 100)}%.` : 'No assault until the ladders are ready.'));
      const row = el('div', 'row');
      row.append(
        btn('siegeStorm', 'Storm the walls', () => S.storm(c), !odds),
        btn('siegeAssault', 'Simulate', () => S.playerAssault(c), !odds),
        btn('siegeWait', 'Wait a day', () => CL.party.advanceDays(1)),
        btn('siegeLift', 'Lift the siege', () => S.lift(c)),
      );
      card.append(row);
      return [card];
    }
    if (s) {
      card.dataset.siege = 'theirs';
      card.append(el('h3', '', `${CL.content.get('settlements', sid).name} is ${s.phase === 'gathering' ? 'about to be besieged' : 'under siege'}`));
      card.append(el('p', '', `By the ${CL.realm.faction(s.realm)?.name}: ${s.lords.map((id) => CL.realm.titled(id, c)).join(', ')}.`));
      return [card];
    }
    const p = S.preview(c, sid);
    card.dataset.siege = 'none';
    card.append(el('h3', '', `Besiege ${CL.content.get('settlements', sid).name}`));
    for (const l of p.ok ? p.lines : [p.why]) card.append(el('p', '', l));
    const row = el('div', 'row');
    row.append(btn('siegeBegin', 'Besiege', () => S.begin(c, sid), !p.ok));
    card.append(row);
    return [card];
  }

  /** P8-06a: your fort is besieged: ride back, or leave it to its castellan. */
  function openSiegeAlarm(sid) {
    CL.game.siegeAlarm = sid;
    changeMode('siegeAlarm');
  }
  function renderSiegeAlarm() {
    const c = CL.campaign;
    const sid = CL.game.siegeAlarm;
    if (!sid) return changeMode('map');
    const s = CL.content.get('settlements', sid);
    $('#ransomOptions').replaceChildren(
      decision('alarm_ride', 'Ride back', `Set off for ${s.name} now`, () => {
        CL.game.siegeAlarm = null;
        changeMode('map');
        CL.world.travelTo({ type: 'settlement', id: sid, x: s.mapX, y: s.mapY });
      }),
      decision('alarm_leave', `Leave it to ${CL.fiefs.adminName(c, sid)}`, 'They hold while the food lasts and the odds are not hopeless', () => {
        CL.game.siegeAlarm = null;
        changeMode('map');
      }),
    );
  }

  /** At a kingdom's capital: Service (a mercenary contract, or its renewal), and Swear fealty to its ruler. */
  function allegianceCards(c, sid, redo) {
    const R = CL.realm;
    const f = R.owner(sid, c);
    if (!R.isRealm(f) || R.capitalOf(f) !== sid) return [];
    const a = CL.allegiance.state(c);
    const name = CL.realm.faction(f)?.name;
    const out = [];
    if (a.kind === 'mercenary' && a.realm === f) out.push(allegianceCard(c, 'renew', f, `Renew your service with the ${name}`, 'Renew for 30 days', redo));
    else if (!(a.kind === 'vassal' && a.realm === f)) out.push(allegianceCard(c, 'serve', f, `Service with the ${name}`, 'Take service', redo));
    if (!(a.kind === 'vassal' && a.realm === f)) out.push(allegianceCard(c, 'swear', f, `Swear fealty to ${R.titled(R.rulerOf(f, c), c)}`, 'Swear fealty', redo));
    return out;
  }

  // ---- Encounter choices (GDD §8): Attack, Auto-resolve, Negotiate, Retreat ----

  function renderEncounter() {
    const c = CL.campaign;
    const P = CL.parties;
    const A = CL.autoresolve;
    const e = P.current();
    const box = $('#encounterOptions');
    const choice = (label, note, onClick, disabled = false) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', disabled });
      b.append(Object.assign(document.createElement('b'), { textContent: label }));
      if (note) b.append(Object.assign(document.createElement('small'), { textContent: note }));
      b.onclick = onClick;
      return b;
    };
    const buttons = [];
    const help = CL.reinforce.forAuto(c, e); // nearby parties that would ride in count too (V2-09)
    const oddsNow = () => Math.round(A.winChance(A.playerPower(c) + help.allyPower, A.troopsPower(e.troops) + help.enemyPower) * 100);
    if (e.hostile) {
      const odds = oddsNow();
      buttons.push(choice('Attack', 'Fight the battle yourself', prepareBattle));
      buttons.push(choice('Auto-resolve', `About ${odds}% to win`, () => P.autoResolve()));
      const n = P.negotiation(c, e);
      if (n?.kind === 'intimidate') buttons.push(choice('Intimidate', 'They are badly outmatched', () => P.negotiate()));
      else if (n) buttons.push(choice(`Pay ${n.cost} crowns`, 'They let you pass', () => P.negotiate(), c.gold < n.cost));
      const r = P.retreatChance(c, e);
      if (r != null) buttons.push(choice('Retreat', `${Math.round(r * 100)}% to get away`, () => P.retreat()));
      else buttons.push(choice('Leave', 'Come back another time', () => changeMode('map')));
    } else {
      // A kingdom's patrol or caravan: you may still fall on them, at a price (GDD §10).
      const f = e.kind === 'party' && e.t.faction && e.t.kind !== 'bandit' && !e.party.escortTo ? CL.realm.faction(e.t.faction) : null;
      buttons.push(choice('Leave', 'Go on your way', () => changeMode('map')));
      if (f) {
        const odds = oddsNow();
        const cost = `−${-CL.realm.REP.attack} reputation with the ${f.name}`;
        buttons.push(choice('Attack them', cost, prepareBattle));
        buttons.push(choice('Attack (auto-resolve)', `About ${odds}% to win · ${cost}`, () => P.autoResolve()));
      }
    }
    box.replaceChildren(...buttons);
  }

  // ---- Accounts and the quartermaster (V2-11; js/accounts.js, js/quartermaster.js) ----

  function renderAccounts() {
    const c = CL.campaign;
    const A = CL.accounts;
    const Q = CL.quartermaster;
    const q = Q.get(c);
    const mk = (tag, props = {}, ...kids) => {
      const n = Object.assign(document.createElement(tag), props);
      n.append(...kids.filter(Boolean));
      return n;
    };
    const btn = (text, onClick, disabled = false) => mk('button', { type: 'button', textContent: text, disabled, onclick: () => {
        onClick();
        CL.save.write();
        renderAccounts();
        refreshRoster();
      } });
    const chest = A.balance(c, 'chest');
    const move = (from, to, n, why) => A.transfer(c, from, to, Math.min(n, A.balance(c, from)), why);
    const money = mk(
      'div',
      { className: 'contractCard' },
      mk('h3', { textContent: `Purse ${c.gold} · Company chest ${chest}` }),
      mk('p', { textContent: `Next wages: ${Q.wagesDue(c)} crowns on day ${CL.party.dayNumber(c.nextWagesDay)}. The chest pays first, then your purse. Captors take a share of both.` }),
      mk(
        'div',
        { className: 'row' },
        btn('Put 50 in the chest', () => move('purse', 'chest', 50, 'put in the chest'), c.gold <= 0),
        btn('Put all in the chest', () => move('purse', 'chest', c.gold, 'put in the chest'), c.gold <= 0),
        btn('Take 50 out', () => move('chest', 'purse', 50, 'taken from the chest'), chest <= 0),
        btn('Take all out', () => move('chest', 'purse', chest, 'taken from the chest'), chest <= 0),
      ),
    );
    let qm;
    if (!q) {
      const here = Q.sellsFood(c.world.location);
      qm = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: 'Quartermaster' }),
        mk('p', { textContent: `Keeps the next wages in the chest and food in stock, buying only food, within a weekly budget, and warns you before shortages. ${Q.HIRE} crowns to hire, ${Q.WAGE} a week.` }),
        mk('div', { className: 'row' }, btn(here ? `Hire a quartermaster · ${Q.HIRE} crowns` : 'Hire one in a town or village with a market', () => Q.hire(c) && message('A quartermaster joins the company'), !Q.canHire(c))),
      );
    } else {
      const step = (key, d, lo, hi) => btn(d > 0 ? '+' : '−', () => Q.setRule(c, key, q[key] + d), q[key] + d < lo || q[key] + d > hi);
      qm = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: `Quartermaster ${q.name}` }),
        mk('p', { textContent: `Spent ${q.spent} of ${Q.budgetOf(c)} crowns this week. Paid ${Q.WAGE} a week.` }),
        mk('div', { className: 'row qmRule' }, mk('span', { textContent: `Keep food for ${q.reserveDays} days` }), step('reserveDays', -1, ...Q.LIMITS.reserveDays), step('reserveDays', 1, ...Q.LIMITS.reserveDays)),
        mk(
          'div',
          { className: 'row qmRule' },
          mk('span', { textContent: q.budget === null ? `Spend at most ${Q.budgetOf(c)} a week (automatic: a week’s food and a quarter)` : `Spend at most ${q.budget} a week` }),
          btn('−', () => Q.setRule(c, 'budget', Q.budgetOf(c) - 20), Q.budgetOf(c) - 20 < Q.LIMITS.budget[0]),
          btn('+', () => Q.setRule(c, 'budget', Q.budgetOf(c) + 20), Q.budgetOf(c) + 20 > Q.LIMITS.budget[1]),
          q.budget === null ? null : btn('Automatic', () => Q.setRule(c, 'budget', null)),
        ),
        mk(
          'div',
          { className: 'row qmRule' },
          mk('span', { textContent: q.coverWages ? 'Keeps the next wages in the chest' : 'Does not set wages aside' }),
          btn(q.coverWages ? 'Stop' : 'Start', () => Q.setRule(c, 'coverWages', !q.coverWages)),
        ),
        mk(
          'div',
          { className: 'row qmRule' },
          mk('span', { textContent: q.medicine ? `Keep ${q.medicine} medicine while a surgeon rides with us` : 'Buys no medicine' }),
          step('medicine', -1, ...Q.LIMITS.medicine),
          step('medicine', 1, ...Q.LIMITS.medicine),
        ),
        q.log.length ? mk('ul', { className: 'soldierNotes' }, ...q.log.slice(-6).reverse().map((e) => mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${e.text}` }))) : null,
        mk('div', { className: 'row' }, btn('Buy now', () => Q.act(c), !Q.sellsFood(c.world.location)), btn('Let them go', () => Q.dismiss(c) && message('The quartermaster leaves the company'))),
      );
    }
    const M = CL.merchant;
    const m = M.get(c);
    let mc;
    if (!m) {
      mc = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: 'Merchant' }),
        mk('p', { textContent: `Trades a budget you give them at the markets you visit, at the same prices as you, and tells you what they did and why. They know only the prices they have seen. ${M.HIRE} crowns to hire, ${M.WAGE} a week.` }),
        mk('div', { className: 'row' }, btn(CL.trade.hasMarket(c.world.location) ? `Hire a merchant · ${M.HIRE} crowns` : 'Hire one in a market settlement', () => M.hire(c) && message('A merchant joins the company'), !M.canHire(c))),
      );
    } else {
      const budget = A.balance(c, M.ACCOUNT);
      const stock = Object.entries(m.stock).map(([g, n]) => `${n} ${CL.content.get('markets', g).name.toLowerCase()} (cost ${Math.round(m.paid[g])})`).join(', ');
      mc = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: `Merchant ${m.name}${m.active ? '' : ' · stopped'}` }),
        mk('p', { textContent: `Budget ${budget} crowns in hand${stock ? `; goods: ${stock}` : ''}. Knows prices in ${Object.keys(m.prices).length} market${Object.keys(m.prices).length === 1 ? '' : 's'}. Paid ${M.WAGE} a week.` }),
        mk(
          'div',
          { className: 'row' },
          btn('Give 50', () => M.fund(c, Math.min(50, c.gold)), c.gold <= 0),
          btn('Give 200', () => M.fund(c, Math.min(200, c.gold)), c.gold <= 0),
          btn('Take 50 back', () => M.fund(c, -Math.min(50, budget)), budget <= 0),
        ),
        mk(
          'div',
          { className: 'row qmRule' },
          mk('span', { textContent: m.preset === 'bold' ? 'Bold: thinner margins, all of the budget' : 'Cautious: good margins only, at most 70% in goods' }),
          btn(m.preset === 'bold' ? 'Be cautious' : 'Be bold', () => M.setPreset(c, m.preset === 'bold' ? 'cautious' : 'bold')),
        ),
        m.log.length ? mk('ul', { className: 'soldierNotes' }, ...m.log.slice(-6).reverse().map((e) => mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${e.text}` }))) : null,
        mk(
          'div',
          { className: 'row' },
          btn('Trade now', () => M.visit(c), !m.active || !CL.trade.hasMarket(c.world.location)),
          btn(m.active ? 'Stop trading' : 'Start trading', () => M.setActive(c, !m.active)),
          btn('Stop and recover all', () => {
            const r = M.recover(c);
            if (r) message(`Recovered ${r.cash} crowns${r.goods ? ` and ${r.goods} goods` : ''} from the merchant`);
          }),
          btn('Let them go', () => M.dismiss(c) && message('The merchant leaves; budget and goods handed back')),
        ),
      );
    }
    // The surgeon and medicine (P7-01; js/surgeon.js).
    const S = CL.surgeon;
    const doc = S.get(c);
    const medPrice = S.medicinePrice(c);
    const buyMed = (n) => btn(`Buy ${n} · ${n * medPrice}`, () => S.buyMedicine(c, n), !S.sellsMedicine(c) || c.gold < n * medPrice || c.medicine + n > S.MEDICINE_MAX);
    const medRow = mk('div', { className: 'row' }, mk('span', { textContent: `Medicine: ${c.medicine}` }), buyMed(1), buyMed(5));
    const sc = doc
      ? mk(
          'div',
          { className: 'contractCard' },
          mk('h3', { textContent: `Surgeon ${doc.name}` }),
          mk('p', { textContent: `After each battle saves those who would otherwise die, one medicine each (a few even without), and wounds heal in a day and a half. Has saved ${doc.saved}. Paid ${S.WAGE} a week.` }),
          medRow,
          doc.log.length ? mk('ul', { className: 'soldierNotes' }, ...doc.log.slice(-4).reverse().map((e) => mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${e.text}` }))) : null,
          mk('div', { className: 'row' }, btn('Let them go', () => S.dismiss(c) && message('The surgeon leaves the company'))),
        )
      : mk(
          'div',
          { className: 'contractCard' },
          mk('h3', { textContent: 'Surgeon' }),
          mk('p', { textContent: `Fewer of your soldiers die after a battle: about a third fewer with medicine (one each, ${medPrice} crowns at a market), and wounds heal faster. ${S.HIRE} crowns to hire in a town, ${S.WAGE} a week.` }),
          mk('div', { className: 'row' }, btn(S.canHire(c) || CL.content.table('settlements')[c.world.location]?.type === 'town' ? `Hire a surgeon · ${S.HIRE} crowns` : 'Hire one in a town', () => S.hire(c) && message('A surgeon joins the company'), !S.canHire(c))),
          c.medicine ? medRow : null,
        );
    // The blacksmith (P7-03; js/blacksmith.js): forging the hero's gear, fine kit for soldiers.
    const B = CL.blacksmith;
    const smith = B.get(c);
    const F = B.rules();
    const iron = c.cargo?.[B.IRON] || 0;
    let bc;
    if (!smith) {
      bc = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: 'Blacksmith' }),
        mk('p', { textContent: `Improves your weapon and armour (at most ${F.maxLevel} times each) and fits up to ${F.kit.max} soldiers with fine kit, for crowns and iron from your cargo. ${B.HIRE} crowns to hire in a town, ${B.WAGE} a week.` }),
        mk('div', { className: 'row' }, btn(CL.content.table('settlements')[c.world.location]?.type === 'town' ? `Hire a blacksmith · ${B.HIRE} crowns` : 'Hire one in a town', () => B.hire(c) && message('A blacksmith joins the company'), !B.canHire(c))),
      );
    } else {
      const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Shield', head: 'Head', body: 'Body', hands: 'Hands', feet: 'Feet' };
      const forgeRows = Object.keys(SLOT_NAMES)
        .map((slot) => B.forgeOffer(c, slot))
        .filter((o) => o.from && !/not something/.test(o.reason || ''))
        .map((o) => {
          const name = CL.content.item(o.from).name;
          if (o.reason) return mk('div', { className: 'row qmRule' }, mk('span', { textContent: `${name}: ${o.reason}` }));
          return mk(
            'div',
            { className: 'row qmRule' },
            withIco(mk('span', { textContent: `${name} → ${CL.content.item(o.to).name}` }, ...findingRows(CL.gear.unmet(c, o.to), 'span')), o.from), // P11-03: forging keeps requirements; P11-04: its icon
            btn(`Forge · ${o.crowns} crowns, ${o.iron} iron`, () => {
              const r = B.forge(c, o.slot);
              message(r.ok ? `${CL.content.item(o.to).name} is ready` : `Can't forge: ${r.reason}`);
            }, c.gold < o.crowns || iron < o.iron),
          );
        });
      const fit = c.roster
        .filter((s) => !s.kit)
        .sort((a, b) => CL.content.troop(b.troop).tier.localeCompare(CL.content.troop(a.troop).tier) || a.id - b.id)
        .slice(0, 6);
      const kitRows = fit.map((s) =>
        mk(
          'div',
          { className: 'row qmRule' },
          mk('span', { textContent: `${s.name} (${CL.content.troop(s.troop).name})` }),
          btn(`Fine kit · ${F.kit.cost} crowns, ${F.kit.iron} iron`, () => {
            const r = B.giveKit(c, s.id);
            message(r.ok ? `${s.name} has fine kit` : `Can't: ${r.reason}`);
          }, Boolean(B.kitBlocked(c, s.id))),
        ),
      );
      const withKit = c.roster.filter((s) => s.kit).map((s) => s.name);
      bc = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: `Blacksmith ${smith.name}` }),
        mk('p', { textContent: `Iron in your cargo: ${iron} (buy it at a market). Paid ${B.WAGE} a week.` }),
        ...forgeRows,
        mk('p', { textContent: `Fine kit (+${F.kit.armor} armour, +${F.kit.hp} hit points): ${withKit.length ? withKit.join(', ') : 'nobody yet'} · ${B.kitted(c)} of ${F.kit.max}` }),
        ...(B.kitted(c) < F.kit.max ? kitRows : []),
        smith.log.length ? mk('ul', { className: 'soldierNotes' }, ...smith.log.slice(-4).reverse().map((e) => mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${e.text}` }))) : null,
        mk('div', { className: 'row' }, btn('Let them go', () => B.dismiss(c) && message('The blacksmith leaves the company'))),
      );
    }
    // The scout (P7-02; js/scout.js).
    const SC = CL.scout;
    const sct = SC.get(c);
    const scc = sct
      ? mk(
          'div',
          { className: 'contractCard' },
          mk('h3', { textContent: `Scout ${sct.name}` }),
          mk('p', { textContent: `Your company sees half as far again. They warn you of hostile parties as soon as they are seen, with their numbers and heading, tell you how long a ride will take and what is known on the way, and give you more ground to set up on when you attack. Paid ${SC.WAGE} a week.` }),
          sct.log.length ? mk('ul', { className: 'soldierNotes' }, ...sct.log.slice(-4).reverse().map((e) => mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${e.text}` }))) : null,
          mk('div', { className: 'row' }, btn('Let them go', () => SC.dismiss(c) && message('The scout leaves the company'))),
        )
      : mk(
          'div',
          { className: 'contractCard' },
          mk('h3', { textContent: 'Scout' }),
          mk('p', { textContent: `Sees further, warns you early of hostile parties ("about 8 Reavers to the north-east, riding this way"), and estimates each ride. ${SC.HIRE} crowns to hire in a town, ${SC.WAGE} a week.` }),
          mk('div', { className: 'row' }, btn(CL.content.table('settlements')[c.world.location]?.type === 'town' ? `Hire a scout · ${SC.HIRE} crowns` : 'Hire one in a town', () => SC.hire(c) && message('A scout joins the company'), !SC.canHire(c))),
        );
    const lines = A.recent(c, 12).map((e) => {
      const sign = e.to === A.WORLD ? '−' : e.from === A.WORLD ? '+' : '';
      const route = e.from === A.WORLD ? `into ${A.label(e.to)}` : e.to === A.WORLD ? `from ${A.label(e.from)}` : `${A.label(e.from)} → ${A.label(e.to)}`;
      return mk('li', { textContent: `Day ${CL.party.dayNumber(e.day)}: ${sign}${e.amount} ${route} · ${e.why}` });
    });
    const ledger = mk('div', { className: 'contractCard' }, mk('h3', { textContent: 'Ledger' }), lines.length ? mk('ul', { className: 'soldierNotes' }, ...lines) : mk('p', { textContent: 'Nothing yet.' }));
    $('#accountsScreen').replaceChildren(money, ...millCard(c, null), qm, sc, bc, scc, mc, ledger);
  }

  // ---- Detachments (P7-05; js/detachments.js) ----

  function renderDetachments() {
    const c = CL.campaign;
    const D = CL.detachments;
    const g = CL.game;
    const mk = (tag, props = {}, ...kids) => {
      const n = Object.assign(document.createElement(tag), props);
      n.append(...kids.filter(Boolean));
      return n;
    };
    const btn = (text, onClick, disabled = false, extra = {}) =>
      mk('button', {
        type: 'button',
        textContent: text,
        disabled,
        ...extra,
        onclick: () => {
          onClick();
          CL.save.write();
          renderDetachments();
          refreshRoster();
        },
      });
    const day = (d) => CL.party.dayNumber(d);
    const out = D.active(c).map((d) => {
      const o = d.order;
      const what = o.objective === 'road' ? `the road between ${CL.content.get('settlements', o.road[0]).name} and ${CL.content.get('settlements', o.road[1]).name}` : 'hunting bands';
      const fit = d.soldiers.filter((s) => s.woundedUntil === null).length;
      return mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: `${d.captainName}’s patrol · ${d.status === 'out' ? 'out' : 'coming back'}` }),
        mk('p', { textContent: `${what}, back by day ${day(o.until)}. ${d.soldiers.length} soldiers (${fit} fit), ${d.food} rations, ${d.purse} crowns. Won ${d.tally.won}, lost ${d.tally.lost}${d.tally.fallen.length ? `, ${d.tally.fallen.length} fell` : ''}.` }),
        d.log.length ? mk('ul', { className: 'soldierNotes' }, ...d.log.slice(-5).reverse().map((e) => mk('li', { textContent: `Day ${day(e.day)}: ${e.text}` }))) : null,
        mk(
          'div',
          { className: 'row' },
          d.status === 'out' ? btn(d.recallAt != null ? 'Courier on the way' : 'Send a courier to call them back', () => D.recall(c, d), d.recallAt != null) : null,
          D.canMeet(c, d) ? btn('Rejoin the company here', () => D.merge(c, d)) : null,
        ),
      );
    });
    const back = D.list(c)
      .filter((d) => d.status === 'back' && d.report)
      .slice(-3)
      .reverse()
      .map((d) => mk('p', { className: 'soldierNotes', textContent: `Day ${day(d.ended.day)}: ${d.report}` }));
    // A new one: captain, soldiers, order (presets), and the expert's constraints.
    const caps = D.captains(c);
    g.detachDraft ??= { captain: null, soldiers: [], objective: 'hunt', days: D.DEFAULTS.days, retreatBelow: D.DEFAULTS.retreatBelow, avoidStronger: true, autonomy: 'judgement' };
    const draft = g.detachDraft;
    if (draft.captain && !caps.some((k) => k.kind === draft.captain.kind && k.id === draft.captain.id)) draft.captain = null;
    draft.soldiers = draft.soldiers.filter((id) => c.roster.some((s) => s.id === id && s.woundedUntil === null));
    let form;
    if (!caps.length) {
      form = mk('div', { className: 'contractCard' }, mk('h3', { textContent: 'Send a patrol' }), mk('p', { textContent: `A patrol needs a captain: a veteran of tier 3 with ${D.CAPTAIN.battles} battles behind them, or your companion. You have none fit to lead.` }));
    } else {
      const near = Object.values(CL.content.table('settlements'))
        .map((s) => ({ s, d: CL.world.mapDist(c.world.x, c.world.y, s.mapX, s.mapY) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .map((x) => x.s);
      const road = near.length === 2 ? [near[0].id, near[1].id] : null;
      const pick = (k) => btn(k.name, () => (draft.captain = { kind: k.kind, id: k.id }), false, { className: draft.captain?.kind === k.kind && draft.captain?.id === k.id ? 'active' : '' });
      const fitSoldiers = c.roster.filter((s) => s.woundedUntil === null && !(draft.captain?.kind === 'soldier' && s.id === draft.captain.id));
      const toggle = (s) =>
        btn(`${s.name} (${CL.content.troop(s.troop).name})`, () => (draft.soldiers = draft.soldiers.includes(s.id) ? draft.soldiers.filter((x) => x !== s.id) : [...draft.soldiers, s.id]), false, { className: draft.soldiers.includes(s.id) ? 'active' : '' });
      const going = c.roster.filter((s) => draft.soldiers.includes(s.id) || (draft.captain?.kind === 'soldier' && s.id === draft.captain.id));
      const need = D.needs(going, draft.days);
      const retreatText = { 0.5: 'below half', 0.34: 'below a third', 0: 'never' }[draft.retreatBelow];
      form = mk(
        'div',
        { className: 'contractCard' },
        mk('h3', { textContent: 'Send a patrol' }),
        mk('p', { textContent: 'Captain:' }),
        mk('div', { className: 'row' }, ...caps.map(pick)),
        mk('p', { textContent: `Soldiers going (${going.length}):` }),
        mk('div', { className: 'row' }, btn('Half the company', () => (draft.soldiers = fitSoldiers.slice(0, Math.floor(fitSoldiers.length / 2)).map((s) => s.id))), btn('None', () => (draft.soldiers = []))),
        mk('div', { className: 'row' }, ...fitSoldiers.slice(0, 16).map(toggle)),
        // P9-B3: a big company chooses by troop, five at a time.
        ...(fitSoldiers.length > 16 ? [mk('div', { className: 'row detachByTroop' }, ...byTroopPicks(fitSoldiers, draft))] : []),
        mk('p', { textContent: 'Orders:' }),
        mk(
          'div',
          { className: 'row' },
          btn('Hunt bands around here', () => (draft.objective = 'hunt'), false, { className: draft.objective === 'hunt' ? 'active' : '' }),
          road ? btn(`Patrol ${CL.content.get('settlements', road[0]).name}–${CL.content.get('settlements', road[1]).name}`, () => (draft.objective = 'road'), false, { className: draft.objective === 'road' ? 'active' : '' }) : null,
        ),
        mk('div', { className: 'row qmRule' }, mk('span', { textContent: `Back within ${draft.days} days` }), btn('−', () => draft.days--, draft.days <= D.LIMITS.days[0]), btn('+', () => draft.days++, draft.days >= D.LIMITS.days[1])),
        mk('div', { className: 'row qmRule' }, mk('span', { textContent: `Turn back ${retreatText} strength` }), btn('Change', () => (draft.retreatBelow = D.RETREATS[(D.RETREATS.indexOf(draft.retreatBelow) + 1) % D.RETREATS.length]))),
        mk('div', { className: 'row qmRule' }, mk('span', { textContent: draft.avoidStronger ? 'Keeps clear of stronger parties' : 'Does not avoid stronger parties' }), btn('Change', () => (draft.avoidStronger = !draft.avoidStronger))),
        mk('div', { className: 'row qmRule' }, mk('span', { textContent: draft.autonomy === 'exact' ? 'Exact: takes on any band its order names' : 'Judgement: only fights it expects to win' }), btn('Change', () => (draft.autonomy = draft.autonomy === 'exact' ? 'judgement' : 'exact'))),
        mk('p', { textContent: going.length ? `Takes ${Math.min(need.rations, Math.floor(c.food))} rations from your stores and ${need.wages} crowns for their pay.` : 'Choose a captain and soldiers.' }),
        mk(
          'div',
          { className: 'row' },
          btn('Send them', () => {
            const r = D.send(c, { captain: draft.captain, soldierIds: draft.soldiers, order: { objective: draft.objective, road, days: draft.days, retreatBelow: draft.retreatBelow, avoidStronger: draft.avoidStronger, autonomy: draft.autonomy } });
            if (r.ok) g.detachDraft = null;
            else message(`Can't send them: ${r.reason}`);
          }, !draft.captain),
        ),
      );
    }
    $('#detachScreen').replaceChildren(...out, form, back.length ? mk('div', { className: 'contractCard' }, mk('h3', { textContent: 'Back from patrol' }), ...back) : null);
  }

  // ---- Battle preparation (V2-07; js/prep.js) ----

  const PRESET_NAMES = { auto: 'Auto', balanced: 'Balanced', defensive: 'Defensive', aggressive: 'Aggressive', custom: 'Custom' };
  const PRESET_ABOUT = {
    auto: 'A plan chosen for you from the odds: forward and charging when you are much the stronger, a shield wall that holds when you are the weaker, Balanced between. You need give no orders.',
    balanced: 'Infantry in front, archers behind, cavalry on a flank, and all of them go with you: the archers keep behind you, the cavalry rides out at anything close.',
    defensive: 'A tight block. Everyone holds and fights what comes to them, the infantry in a shield wall.',
    aggressive: 'Infantry and cavalry forward and charging, archers following you.',
    custom: 'Drag the flags on the map to place each group, and choose each group’s starting order below.',
  };
  const GROUP_NAMES = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' };

  /**
   * P9-B4, layer 3: the company's divisions on the Prepare screen, folded away by default. Each division:
   * its captain, formation and facing, and a new name; each troop type: which division it is in; and
   * plans of your own (three, on this device). Every choice is optional: the plan works without them.
   * @param {any} p the preparation state (g.prep) @param {() => void} redo
   */
  function divisionsBox(p, redo) {
    const c = CL.campaign;
    const D = CL.divisions;
    const P = CL.prep;
    const el2 = (tag, props = {}, ...kids) => {
      const n = Object.assign(document.createElement(tag), props);
      n.append(...kids.filter(Boolean));
      return n;
    };
    const select = (label, options, value, onchange, extra = {}) => {
      const sel = el2('select', { ariaLabel: label, onchange: (e) => { onchange(e.target.value); redo(); }, ...extra }, ...options.map(([v, t]) => el2('option', { value: v, textContent: t, selected: v === value })));
      return el2('label', { className: 'divField' }, `${label} `, sel);
    };
    const divs = D.preview(c);
    const caps = D.captains(c);
    const box = el2('details', { className: 'divisions', open: Boolean(p.divisionsOpen), ontoggle: (e) => (p.divisionsOpen = e.target.open) });
    box.append(el2('summary', { textContent: `Divisions (${divs.length}) · captains, formations, your plans` }));
    for (const d of divs) {
      const role = D.roleOf(d.div);
      const capKey = (k) => `${k.kind}:${k.id}`;
      const cur = p.plan.captains?.[d.div];
      box.append(
        el2(
          'div',
          { className: 'divRow' },
          el2('b', { textContent: `${d.name} (${d.soldiers.length})`, style: `color:${D.color(d.div)}` }),
          select('Captain', [['', 'None'], ...caps.map((k) => [capKey(k), k.name])], cur ? capKey(cur) : '', (v) => P.setCaptain(p.plan, d.div, caps.find((k) => capKey(k) === v) || null), { className: 'divCaptain' }),
          select('Formation', D.FORMATIONS[role].map((f) => [f, CL.formations.NAMES[f]]), p.plan.formations?.[d.div] || (d.div === 'infantry' ? p.plan.formation : 'loose') || 'loose', (v) => P.setFormation(p.plan, d.div, v), { className: 'divFormation' }),
          select('Facing', D.FACINGS.map((f) => [f, { right: 'The enemy', up: 'North', down: 'South', left: 'Back' }[f]]), p.plan.facings?.[d.div] || 'right', (v) => P.setFacing(p.plan, d.div, v)),
          el2('label', { className: 'divField' }, 'Name ', el2('input', { className: 'divName', value: d.name, maxLength: 20, ariaLabel: `A name for ${d.name}`, spellcheck: false, autocomplete: 'off', onchange: (e) => { D.rename(c, d.div, e.target.value); CL.save.write(); redo(); } })),
        ),
      );
    }
    // Which division each troop type is in (soldiers one by one: their card on the Party screen).
    const types = [...new Set(CL.party.healthySoldiers().map((s) => s.troop))];
    const moveRow = el2('div', { className: 'divRow' }, el2('b', { textContent: 'Troops' }));
    for (const t of types) {
      const role = CL.content.troop(t).role;
      const options = D.SLOTS.filter((x) => D.roleOf(x) === role || x === role).map((x) => [x, D.name(c, x)]);
      const now = c.divisions?.troops?.[t] || '';
      moveRow.append(select(CL.content.troop(t).name, [['', 'By default'], ...options], now, (v) => {
        D.assign(c, 'troop', t, v || null);
        CL.save.write();
        // The divisions' places again (a new division may now have soldiers), keeping what was chosen for them.
        const kept = { captains: p.plan.captains, formations: p.plan.formations, facings: p.plan.facings, formation: p.plan.formation };
        p.plan = { ...P.plan(p.plan.preset === 'custom' ? 'custom' : p.plan.preset, p.map, { ambush: p.ambush, custom: CL.settings.get('prepCustom') }), ...kept };
      }, { className: 'divTroop' }));
    }
    box.append(moveRow);
    // Plans of your own (the device's).
    const plans = CL.settings.get('prepPlans') || [];
    const planRow = el2('div', { className: 'divRow' }, el2('b', { textContent: 'Your plans' }));
    for (let i = 0; i < P.PLANS_MAX; i++) {
      const saved = plans[i];
      planRow.append(
        el2('button', { type: 'button', textContent: saved ? `Use ${saved.name}` : `Plan ${i + 1}: empty`, disabled: !saved, className: p.plan.plan === i ? 'active' : '', onclick: () => { const q = P.loadPlan(i, p.map, p.ambush); if (q) p.plan = q; redo(); } }),
        el2('button', { type: 'button', textContent: `Save as ${i + 1}`, onclick: () => { P.savePlan(p.plan, p.map, i); redo(); } }),
      );
    }
    box.append(planRow);
    return box;
  }

  /** The fit soldiers by group, for the setup (Mara stands with the hero). */
  function fitByGroup() {
    const out = { infantry: 0, archer: 0, cavalry: 0 };
    for (const s of CL.party.healthySoldiers()) out[CL.content.troop(s.troop).role]++;
    return out;
  }

  /** Attack pressed: the preparation screen, or straight in with the remembered setup. */
  function prepareBattle() {
    const g = CL.game;
    const e = CL.parties.current();
    if (!e) return;
    const map = CL.arena.mapFor(e.def.map || 'open_country');
    const ambush = Boolean(g.caught && e.hostile);
    const plan = CL.prep.remembered(map, ambush);
    if (CL.settings.get('prepSkip')) return CL.parties.attack(plan);
    g.prep = { map, plan, ambush, remember: CL.settings.get('prepPreset') !== 'balanced', skip: false, drag: null };
    changeMode('prepare');
  }

  const HIRE_MANY = 5; // P9-B3: the recruiter's "Hire 5"

  /**
   * P9-B3: a detachment's soldiers chosen by troop, five more at a time ("Footman +5 · 10/24"); the
   * draft re-renders through the button helper's redraw. @param {any[]} fit @param {any} draft
   */
  function byTroopPicks(fit, draft) {
    const by = new Map();
    for (const s of fit) {
      if (!by.has(s.troop)) by.set(s.troop, []);
      by.get(s.troop).push(s);
    }
    return [...by.entries()].map(([id, list]) => {
      const chosen = list.filter((s) => draft.soldiers.includes(s.id)).length;
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `${CL.content.troop(id).name} +${HIRE_MANY} · ${chosen}/${list.length}`, disabled: chosen === list.length });
      b.dataset.troop = id;
      b.onclick = () => {
        const more = list.filter((s) => !draft.soldiers.includes(s.id)).slice(0, HIRE_MANY).map((s) => s.id);
        draft.soldiers = [...draft.soldiers, ...more];
        renderDetachments();
      };
      return b;
    });
  }

  /**
   * P9-B3: how the company's limit is made up, in words: "8 + Leadership 3 ×5 + renown 4 + 1 officer 10
   * + land 15 + Friendly 2", and the ceiling when it is reached. @param {Campaign} c
   */
  function limitWords(c) {
    const { parts: p, sum } = CL.party.limitParts(c);
    const L = CL.party.LIMIT;
    const officers = p.officers / L.officer;
    const words = [
      `${p.base}`,
      `Leadership ${CL.character.skill('leadership', c)} ×${L.leadership}`,
      `renown ${p.renown} (1 per ${L.renownPer})`,
      officers ? `${officers} officer${officers === 1 ? '' : 's'} ${p.officers}` : '',
      p.land ? `land ${p.land}` : '',
      p.friendly ? `Friendly ${p.friendly}` : '',
    ].filter(Boolean);
    return `${words.join(' + ')}${sum > L.ceiling ? `, at most ${L.ceiling}` : ''}`;
  }

  /**
   * P9-B2: how the field is shared ("You: 300, 60 on the field. Them: 200, 40."), or that everyone fits.
   * @param {any} def
   */
  function shareLine(def) {
    const s = CL.combat.fieldShare(def);
    if (s.mine + s.theirs <= CL.combat.BATTLE.activeCap) return `Everyone fits on the field at once (battle size ${CL.combat.BATTLE.activeCap}).`;
    return `You: ${s.mine}, ${s.allies} on the field. Them: ${s.theirs}, ${s.enemies}. The rest step in as men fall.`;
  }

  function renderPrep() {
    const g = CL.game;
    const p = g.prep;
    const e = CL.parties.current();
    if (!p || !e) return;
    const fit = fitByGroup();
    const box = $('#prepPanel');
    const btn = (label, onclick, extra = {}) => Object.assign(document.createElement('button'), { type: 'button', textContent: label, onclick, ...extra });
    const foes = Object.values(e.troops).reduce((a, b) => a + b, 0);
    const own = fit.infantry + fit.archer + fit.cavalry;
    const odds = Math.round(CL.autoresolve.winChance(CL.autoresolve.playerPower(), CL.autoresolve.troopsPower(e.troops)) * 100);
    const presets = document.createElement('div');
    presets.className = 'prepPresets';
    for (const id of CL.prep.PRESETS) {
      presets.append(
        btn(PRESET_NAMES[id], () => {
          const custom = id === 'custom' && p.plan.preset !== 'custom' ? CL.settings.get('prepCustom') : null;
          p.plan = id === 'custom' && p.plan.preset !== 'custom' && !custom ? { ...p.plan, preset: 'custom' } : CL.prep.plan(id, p.map, { ambush: p.ambush, custom });
          renderPrep();
        }, { className: p.plan.preset === id ? 'active' : '' }),
      );
    }
    const rows = [];
    if (p.plan.preset === 'custom') {
      for (const grp of CL.prep.GROUPS) {
        if (!fit[grp]) continue;
        const row = document.createElement('div');
        row.className = 'prepGroup';
        row.append(Object.assign(document.createElement('span'), { textContent: `${GROUP_NAMES[grp]} (${fit[grp]})` }));
        for (const o of CL.prep.ORDERS) {
          row.append(btn(o[0].toUpperCase() + o.slice(1), () => { CL.prep.setOrder(p.plan, grp, o); renderPrep(); }, { className: p.plan.orders[grp] === o ? 'active' : '' }));
        }
        rows.push(row);
      }
    }
    const check = (label, key) => {
      const l = document.createElement('label');
      l.className = 'setCheck';
      const i = Object.assign(document.createElement('input'), { type: 'checkbox', checked: p[key] });
      i.onchange = () => {
        p[key] = i.checked;
        if (key === 'skip' && i.checked) p.remember = true;
        renderPrep();
      };
      l.append(i, ` ${label}`);
      return l;
    };
    const actions = document.createElement('div');
    actions.className = 'prepActions';
    actions.append(
      btn('Fight', () => {
        if (p.remember || p.skip) CL.prep.remember(p.plan, p.map, p.skip);
        const plan = p.plan;
        g.prep = null;
        CL.parties.attack(plan);
      }, { className: 'primary' }),
      btn(`Simulate · ${odds}%`, () => {
        g.prep = null;
        CL.parties.autoResolve();
      }),
      btn('Back', () => {
        g.prep = null;
        changeMode('encounter');
      }),
    );
    const auto = p.plan.preset === 'auto' && p.plan.auto ? ` (${PRESET_NAMES[p.plan.auto]} for this fight)` : '';
    box.replaceChildren(
      Object.assign(document.createElement('h2'), { textContent: 'Prepare for battle' }),
      Object.assign(document.createElement('p'), { textContent: `${e.name}: ${foes} against your ${own} fit soldier${own === 1 ? '' : 's'}.${p.ambush ? ' Ambush! Little room to form up.' : ''}` }),
      ...(e.def.share ? [Object.assign(document.createElement('p'), { id: 'prepShare', className: 'setNote', textContent: shareLine(e.def) })] : []),
      actions, // first, so Fight is always in reach (two taps from the encounter)
      gearLine(), // P11-02: the loadout you fight with, and what the gear check finds
      presets,
      Object.assign(document.createElement('p'), { className: 'setNote', textContent: PRESET_ABOUT[p.plan.preset] + auto }),
      ...rows,
      divisionsBox(p, () => renderPrep()),
      check('Remember this setup', 'remember'),
      check('Skip this screen next time', 'skip'),
    );
  }

  // ---- Market ----

  function tradeAction(fn) {
    const r = fn();
    if (r.ok) CL.save.write();
    else message(r.reason);
    renderTrade();
  }

  function renderTrade() {
    const c = CL.campaign;
    const T = CL.trade;
    const sid = c.world.location;
    const weight = T.cargoWeight(c);
    const cap = T.capacity(c);
    const slow = Math.round((1 - T.loadFactor(c)) * 100);
    $('#tradeHeader').textContent =
      `${c.gold} crowns · Cargo ${weight}/${cap} weight${slow ? ` (travel ${slow}% slower)` : ''}`;
    const talk = CL.news.marketTalk(c, sid);
    $('#tradeTalk').textContent = talk ? `Market talk: ${talk}` : '';
    $('#tradeTalk').classList.toggle('hidden', !talk);

    const btn = (label, disabled, onClick) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label, disabled });
      b.onclick = onClick;
      return b;
    };
    $('#tradeGoods').replaceChildren(
      ...T.goods().map((g) => {
        const have = c.cargo[g.id] || 0;
        const buyP = T.unitBuyPrice(c, sid, g.id);
        const sellP = T.unitSellPrice(c, sid, g.id);
        const card = Object.assign(document.createElement('div'), { className: 'tradeCard' });
        const word = T.priceWord(T.scarcity(c, sid, g.id));
        const head = Object.assign(document.createElement('div'), { className: 'tradeHead' });
        head.append(
          goodName(g),
          Object.assign(document.createElement('span'), { className: `tag ${word}`, textContent: word }),
        );
        const info = Object.assign(document.createElement('div'), {
          className: 'tradeInfo',
          textContent: `Buy ${buyP} · Sell ${sellP} · You have ${have} (wt ${g.weight} each)`,
        });
        const row = Object.assign(document.createElement('div'), { className: 'tradeBtns' });
        row.append(
          btn('Buy 1', c.gold < buyP, () => tradeAction(() => T.buy(c, sid, g.id, 1))),
          btn('Buy 5', c.gold < T.quote(c, sid, g.id, 5, 'buy').total, () => tradeAction(() => T.buy(c, sid, g.id, 5))),
          btn('Sell 1', !have, () => tradeAction(() => T.sell(c, sid, g.id, 1))),
          btn(`Sell all`, !have, () => tradeAction(() => T.sell(c, sid, g.id, have))),
        );
        card.append(head, info, row);
        return card;
      }),
    );

    // Armoury: what this place sells, with how it compares to what you're wearing.
    const stock = T.gearStock(sid);
    $('#armouryHead').classList.toggle('hidden', !stock.length);
    $('#tradeArmoury').replaceChildren(
      ...stock.map((id) => {
        const it = CL.content.item(id);
        const price = T.gearBuyPrice(c, id);
        const worn = it.slot ? c.equipment[it.slot] : null;
        const vs = worn ? ` — wearing ${CL.content.item(worn).name}` : it.slot ? ' — slot empty' : '';
        // P11-02: what the gear check finds before you buy. A piece you couldn't use can still be bought,
        // after a second tap that says why.
        const findings = CL.gear.checkItem(c, id);
        const stop = CL.gear.stops(findings) ? findings.find((f) => f.kind === 'incompatible' || f.kind === 'requirement') : null;
        const row = li(`${it.name}${itemSummary(it)}${vs}`, `Buy · ${price}`, null, id);
        const b = row.querySelector('button');
        b.onclick = () => {
          if (stop && !b.dataset.confirm) {
            b.dataset.confirm = '1';
            b.textContent = `Buy anyway · ${price}`;
            message(`${stop.text} Tap again to buy it.`);
            return;
          }
          tradeAction(() => T.buyGear(c, sid, id));
          if (it.slot) message(`Bought ${it.name} — equip it from Character & gear.`);
        };
        if (it.slot === 'weapon') row.append(el('small', { className: 'compare muted', textContent: CL.gear.compare(c, id, c.equipment.weapon) }));
        row.append(...findingRows(findings, 'span'));
        return row;
      }),
    );
    for (const b of document.querySelectorAll('#tradeArmoury button')) {
      const id = stock[[...document.querySelectorAll('#tradeArmoury button')].indexOf(b)];
      b.disabled = c.gold < T.gearBuyPrice(c, id);
    }

    const gear = Object.entries(c.inventory).filter(([id]) => T.gearPrice(c, id) > 0);
    $('#tradeGear').replaceChildren(
      ...(gear.length
        ? gear.map(([id, n]) =>
            li(`${n > 1 ? `${n}× ` : ''}${CL.content.item(id).name}`, `Sell · ${T.gearPrice(c, id)}`, () =>
              tradeAction(() => T.sellGear(c, sid, id)),
            id),
          )
        : [li('Nothing to sell. Equipped gear must be removed first; quest items cannot be sold.')]),
    );
  }

  /** Re-render whichever menu screen is open (after a debug change, equip, etc.). */
  function refresh() {
    const m = CL.game.mode;
    if (m !== 'battle' && m !== 'map') changeMode(m);
  }

  // ---- Character creator ----

  const CLOAK_LABELS = { crimson: 'Crimson', forest: 'Forest', violet: 'Violet', ash: 'Ash grey' };
  const CLOAK_SWATCH = { crimson: '#9b2c2c', forest: '#2f6b35', violet: '#6b3a9b', ash: '#7c7c78' };
  const draft = { cloak: 'crimson', origin: 'farmhand', realm: null };

  function choiceButton(label, checked, onPick, html) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    if (html) b.append(...html);
    else b.textContent = label;
    b.onclick = onPick;
    return b;
  }

  function renderCreator() {
    // P10-04: which kingdom you begin in, at a new game: you start in its start town, and the story
    // is told from there.
    const realms = CL.story.startRealms();
    if (!realms.includes(draft.realm)) draft.realm = CL.story.defaultRealm();
    $('#realmPick').classList.toggle('hidden', !(CL.game.newGame && realms.length > 1));
    $('#realmChoices').replaceChildren(
      ...realms.map((id) => {
        const f = CL.realm.faction(id);
        const town = CL.story.startOf(id);
        const b = choiceButton(f.name, draft.realm === id, () => {
          draft.realm = id;
          renderCreator();
        }, [Object.assign(document.createElement('b'), { textContent: f.short }), `from ${town.name}`]);
        b.title = `${f.name}: ${f.description}`;
        return b;
      }),
    );
    const chosen = CL.realm.faction(draft.realm);
    $('#realmNote').textContent = chosen ? `${chosen.name}: ${chosen.description}` : '';
    $('#cloakChoices').replaceChildren(
      ...CL.character.CLOAKS.map((id) => {
        const sw = Object.assign(document.createElement('span'), { className: 'swatch' });
        sw.style.background = CLOAK_SWATCH[id];
        return choiceButton(CLOAK_LABELS[id], draft.cloak === id, () => {
          draft.cloak = id;
          renderCreator();
        }, [sw, CLOAK_LABELS[id]]);
      }),
    );
    $('#bgChoices').replaceChildren(
      ...Object.values(CL.content.table('origins')).map((bg) => {
        // P10-05: a short card each (as the kingdoms'); the chosen one's story is in the note below.
        const title = Object.assign(document.createElement('b'), { textContent: bg.name });
        return choiceButton(bg.name, draft.origin === bg.id, () => {
          draft.origin = bg.id;
          renderCreator();
        }, [title, `+1 ${CL.character.ATTRIBUTE_NAMES[bg.attribute]}, +1 ${CL.content.get('skills', bg.skill).name}`]);
      }),
    );
    const o = CL.content.get('origins', draft.origin);
    const kit = o.kit;
    const gear = Object.values(kit.equipment).map((id) => CL.content.item(id).name);
    // P10-05: an origin's start is its opening quest; its edge is what it keeps.
    const plus = `${CL.content.get('attributes', o.attribute).name}: ${CL.content.get('attributes', o.attribute).effect}. ${CL.content.get('skills', o.skill).name}: ${CL.content.get('skills', o.skill).effect}.`; // P11-03
    $('#createNote').textContent = CL.game.newGame
      ? `${o.description} ${plus} You start with ${kit.gold} crowns, ${gear.join(', ')} and ${CL.party.describeItems(kit.items)}.${o.quest ? ` Your first steps are your own story; then the common one. Its edge: ${o.edge}` : ' Your story begins with the common quest.'}`
      : 'Your gold, soldiers and gear are kept.';
    drawPreview();
  }

  /** P10-G5: the hero in the creator, drawn by the art kit: the cloak, presentation and a shield. */
  function drawPreview() {
    const cv = $('#heroPreview');
    $('#heroGender').onchange = drawPreview; // a man or a woman shows at once
    const k = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
    [cv.width, cv.height] = [72 * k, 92 * k];
    const x = cv.getContext('2d');
    x.setTransform(k, 0, 0, k, 0, 0);
    x.clearRect(0, 0, 72, 92);
    // P11-04: in the chosen origin's starting kit.
    const L = CL.gfx.fig.heroFrom({ cloak: draft.cloak, gender: $('#heroGender')?.value }, CL.content.get('origins', draft.origin)?.kit?.equipment || {}, { campaign: null });
    CL.gfx.ui.figure(x, 72, 92, L);
  }

  function creatorChoices() {
    // CL.game.plainStart (debug, and the browser tests): the bare start, without the opening quest.
    return { name: $('#heroName').value, gender: $('#heroGender').value, cloak: draft.cloak, origin: draft.origin, realm: draft.realm, plain: Boolean(CL.game.plainStart) };
  }

  // ---- Character sheet ----

  /** P11-04: an item's icon, drawn in code, named in words for a screen reader (none for goods). */
  function itemIco(id) {
    const ic = id ? CL.gfx.ui.itemIcon(id) : null;
    return ic ? el('span', { className: `ico itemIco ico-${ic.name}`, role: 'img', ariaLabel: ic.label, title: ic.label }) : null;
  }

  /** P11-04: an element with an item's icon in front. */
  function withIco(node, id) {
    const ic = itemIco(id);
    if (ic) node.prepend(ic);
    return node;
  }

  /** A row: its words (after an item's icon, when `itemId` names one), and a button. */
  function li(text, buttonLabel, onClick, itemId = null) {
    const row = document.createElement('li');
    const words = Object.assign(document.createElement('span'), { textContent: text });
    const ic = itemIco(itemId);
    if (ic) words.prepend(ic);
    row.append(words);
    if (buttonLabel) {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: buttonLabel });
      b.onclick = onClick;
      row.append(b);
    }
    return row;
  }

  function itemSummary(it) {
    const s = it.stats;
    const bits = [];
    if (s.damage) bits.push(`${s.damage} dmg`);
    if (s.armor) bits.push(`+${s.armor} armor`);
    if (s.block) bits.push('can block');
    if (s.travel) bits.push(`+${Math.round(s.travel * 100)}% travel`);
    for (const k of Object.keys(CL.content.table('skills'))) if (s[k]) bits.push(`+${s[k]} ${CL.content.get('skills', k).name}`);
    if (s.food) bits.push(`${s.food} days' food`);
    return bits.length ? ` (${bits.join(', ')})` : '';
  }

  /** The companion's card on the Party sheet: her numbers, her gear, and what you can give her. */
  /** A companion's portrait (P10-G5), in their own look. */
  function companionPic(id) {
    if (!CL.content.table('companions')[id]) return document.createTextNode('');
    return Object.assign(document.createElement('img'), { className: 'portrait small companionPic', src: CL.gfx.ui.portraitUrl(CL.gfx.fig.companionLook(id, companySide()), 64), alt: '' });
  }

  function renderCompanion() {
    const c = CL.campaign;
    const M = CL.companion;
    const m = M.get(c);
    const others = CL.retinue.list(c);
    $('#companionHead').classList.toggle('hidden', !m && !others.length);
    $('#sheetCompanion').classList.toggle('hidden', !m && !others.length);
    const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text || '' });
    const retinueRows = others.map((r) => {
      const R = CL.retinue;
      const rd = R.def(r.id);
      const rs = R.combat(r);
      const where = r.detached ? 'leading a patrol' : r.woundedUntil !== null ? `wounded — back in ${Math.max(0, r.woundedUntil - c.day).toFixed(1)} days` : 'fit to fight';
      const lend = Object.entries(rd.skills || {})
        .map(([k, n]) => `+${n} ${CL.content.get('skills', k).name}`)
        .join(', ');
      const card = el('div');
      card.className = 'retinueCard';
      card.dataset.companion = r.id;
      card.append(companionPic(r.id));
      card.append(
        el('p', `${rd.name}, ${rd.title} · ${R.mood(r)} (${r.loyalty}) · ${where} · HP ${rs.hp} · Damage ${Math.round(rs.damage * 10) / 10} · Armor ${rs.armor}${lend ? ` · ${lend} while fit` : ''} · ${rd.wage} crowns a week`),
        el('p', `Cares about: ${rd.motive}${r.loyalty < R.WARN_BELOW && r.why ? `. Unhappy: ${R.REASONS[r.why] || r.why}` : ''}`),
      );
      return card;
    });
    if (!m) {
      $('#sheetCompanion').replaceChildren(...retinueRows);
      return;
    }
    const d = M.def(m.id);
    const s = M.combat(c);
    const btn = (label, onClick) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
      b.onclick = () => {
        onClick();
        CL.save.write();
        renderSheet();
      };
      return b;
    };
    const status = m.away ? 'scouting ahead' : M.fit(c) ? 'fit to fight' : `wounded — back in ${Math.max(0, m.woundedUntil - c.day).toFixed(1)} days`;
    const bonus = Object.entries(d.skills || {})
      .map(([k, n]) => `+${n} ${CL.content.get('skills', k).name}`)
      .join(', ');
    const rows = [companionPic(m.id), el('p', `${d.name}, ${d.title} · ${status} · HP ${s.hp} · Damage ${Math.round(s.damage * 10) / 10} · Armor ${s.armor}${bonus ? ` · ${bonus} while fit` : ''}`)];
    for (const slot of d.gearSlots) {
      const id = m.equipment[slot];
      const row = el('div', `${CL.character.SLOT_NAMES[slot]}: ${id ? CL.content.item(id).name + itemSummary(CL.content.item(id)) : '—'}`);
      row.className = 'statLine';
      if (id) row.append(btn('Take back', () => M.takeBack(c, slot)));
      for (const [pid] of Object.entries(c.inventory)) {
        const it = CL.content.item(pid);
        if (it.slot === slot) row.append(btn(`Give ${it.name}`, () => M.give(c, pid)));
      }
      rows.push(row);
    }
    rows.push(btn(`Talk to ${d.name}`, () => talkTo(m.id)));
    $('#sheetCompanion').replaceChildren(...rows, ...retinueRows);
  }

  /** P11-06: the load you carry, its band in words, and a bar to the capacity (a mark at heavy). */
  const BAND_WORDS = { light: 'light', medium: 'medium', heavy: 'heavy: slower', overloaded: 'too heavy: much slower' };
  function loadStat(c) {
    const e = CL.profile.encumbrance(c, c.equipment);
    const share = Math.min(1, e.load / (e.capacity * 1.4));
    const bar = el('span', { className: `loadBar load-${e.band.id}`, role: 'img', ariaLabel: `Load ${e.load} of ${Math.round(e.capacity)}, ${BAND_WORDS[e.band.id]}` }, Object.assign(document.createElement('span'), { style: `width:${Math.round(share * 100)}%` }));
    return el('div', { className: 'loadStat' }, el('span', { className: 'ico ico-boot' }), 'Load', el('b', { textContent: `${e.load} / ${Math.round(e.capacity)} · ${BAND_WORDS[e.band.id]}` }), bar);
  }

  /** P11-03: "Your points would unlock: War Mace (Strength 6)", or '' when they unlock nothing you have. */
  function unlockWords(c) {
    const u = CL.gear.unlocks(c);
    return u.length ? `Your points would unlock: ${u.map((x) => `${CL.content.item(x.item).name} (${x.needs})`).join(', ')}` : '';
  }

  /** P11-03: what each attribute and skill does, folded away (data/character.js `effect`). */
  function statHelp() {
    const rows = [...Object.values(CL.content.table('attributes')), ...Object.values(CL.content.table('skills'))].map((s) => el('li', {}, el('b', { textContent: `${s.name}: ` }), s.effect));
    return el('details', { className: 'statHelp' }, el('summary', { textContent: 'What each attribute and skill does' }), el('ul', {}, ...rows));
  }

  function renderSheet() {
    const c = CL.campaign;
    const C = CL.character;
    const hero = C.heroCombat();
    const stats = $('#sheetStats');
    const line = (parts) => {
      const d = Object.assign(document.createElement('div'), { className: 'statLine' });
      d.append(...parts.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
      return d;
    };
    const ch = c.character;
    // A stat with a "+" button while there are points to spend.
    const spendable = (label, canSpend, onSpend) => {
      const span = Object.assign(document.createElement('span'), { textContent: label });
      if (canSpend) {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'plus', textContent: '+' });
        b.setAttribute('aria-label', `Raise ${label}`);
        b.onclick = () => {
          onSpend();
          CL.save.write();
          renderSheet();
        };
        span.append(b);
      }
      return span;
    };
    const spendLine = (parts) => {
      const d = Object.assign(document.createElement('div'), { className: 'statLine' });
      d.append(...parts);
      return d;
    };
    const next = C.xpToNext(ch.level);
    const points = [
      ch.skillPoints ? `${ch.skillPoints} skill point${ch.skillPoints > 1 ? 's' : ''} to spend` : '',
      ch.attributePoints ? `${ch.attributePoints} attribute point${ch.attributePoints > 1 ? 's' : ''} to spend` : '',
    ].filter(Boolean);
    const cap = CL.party.partyCap(c);
    // P10-08 (reference 04): a framed portrait, the name, level and origin, the road to the next level.
    // P10-G5: the hero's portrait, drawn by the art kit from the creator's choices and what they carry.
    const heroL = { ...CL.gfx.ui.heroLook(ch, c.equipment, { which: CL.gear.bestLoadout(c), campaign: c }), realm: { color: CL.gfx.fig.CLOAKS[ch.cloak] || CL.gfx.fig.CLOAKS.crimson, dark: '#3a2a22', trim: '#d8b25a', device: 'coin' } };
    const portrait = CL.gfx.ui.canvas(64, 80, (x) => {
      CL.gfx.ui.portrait(x, -8, 0, 80, heroL);
    });
    portrait.className = 'heroPortrait';
    portrait.dataset.sig = heroL.sig || ''; // P11-04: the kit it is drawn in (a test hook, and nothing else reads it)
    const origin = CL.content.get('origins', ch.origin);
    const toNext = ch.level >= C.MAX_LEVEL ? 1 : ch.xp / next;
    const card = el('div', { className: 'heroCard' },
      el('div', { className: 'frame' }, portrait),
      el('div', { className: 'who' },
        el('b', { textContent: ch.name }),
        el('i', { textContent: `Level ${ch.level} ${origin?.name || ''}` }),
        el('div', { className: 'xpBar' }, Object.assign(document.createElement('span'), { style: `width:${Math.round(toNext * 100)}%` })),
        el('div', { className: 'xpText', textContent: ch.level >= C.MAX_LEVEL ? 'Highest level' : `${ch.xp} / ${next} XP` }),
      ),
    );
    const stat = (icon, label, value) => el('div', {}, el('span', { className: `ico ico-${icon}` }), label, el('b', { textContent: String(value) }));
    const grid = el('div', { className: 'statGrid' },
      stat('heart', 'Health', hero.hp),
      stat('sword', 'Damage', Math.round(hero.damage * 10) / 10),
      stat('shield', 'Armour', `${hero.armor}${hero.canBlock ? '' : ' · no block'}`),
      stat('boot', 'Travel', `×${C.travelFactor().toFixed(2)}`),
      loadStat(c),
      stat('people', 'Company', `${CL.party.headcount(c)} / ${cap}`),
      stat('star', 'Renown', c.renown),
      stat('coin', 'Crowns', c.gold),
    );
    stats.replaceChildren(
      card,
      grid,
      line(points),
      spendLine(
        C.ATTRIBUTES.map((a) =>
          spendable(`${C.ATTRIBUTE_NAMES[a]} ${C.attribute(a)}`, ch.attributePoints > 0 && C.attribute(a) < C.MAX_ATTRIBUTE, () =>
            C.spendAttribute(a),
          ),
        ),
      ),
      spendLine(
        Object.values(CL.content.table('skills')).map((sk) =>
          spendable(`${sk.name} ${C.skill(sk.id)}`, ch.skillPoints > 0 && ch.skills[sk.id] < C.MAX_SKILL, () => C.spendSkill(sk.id)),
        ),
      ),
      // P11-03: what the points you have would let you use, of the gear you have (Guided).
      line(unlockWords(c) ? [unlockWords(c)] : []),
      statHelp(),
      line([
        `Party size ${CL.party.headcount(c)}/${cap} (${limitWords(c)})`,
      ]),
      line(
        CL.realm.kingdoms().map((f) => {
          const st = CL.realm.standing(c, f.id);
          return `${f.name}: ${CL.realm.STANDING_LABEL[st]} (${CL.realm.score(c, f.id)})`;
        }),
      ),
      Object.assign(document.createElement('div'), { className: 'statLine' }),
    );
    renderTroops();
    renderCompanion();
    stats.lastChild.append(...supplyParts(c));
    const after = () => {
      CL.save.write();
      renderSheet();
    };
    // P11-02: the slots (a second weapon and a quiver among them), the loadout a battle starts with,
    // and what the gear check finds, in words with a mark for each kind.
    const G = CL.gear;
    const starts = G.bestLoadout(c);
    $('#sheetEquip').replaceChildren(
      ...C.SLOTS.filter((slot) => slot !== 'ammo' || c.equipment.ammo).map((slot) => {
        const id = c.equipment[slot];
        const it = id ? CL.content.item(id) : null;
        return li(`${C.SLOT_NAMES[slot]}: ${it ? it.name + itemSummary(it) : '—'}`, it ? 'Remove' : null, () => {
          C.unequip(slot);
          after();
        }, id);
      }),
      loadoutRow(c, starts, after),
    );
    $('#sheetFindings').replaceChildren(...findingRows(G.checkAll(c))); // full width: two lines at most
    const pack = Object.entries(c.inventory);
    $('#sheetPack').replaceChildren(
      ...(pack.length
        ? pack.map(([id, n]) => {
            const it = CL.content.item(id);
            const equippable = it.slot && C.SLOTS.includes(it.slot);
            const row = li(`${n > 1 ? `${n}× ` : ''}${it.name}${itemSummary(it)}`, equippable ? 'Equip' : null, () => {
              C.equip(id);
              after();
            }, id);
            if (it.slot === 'weapon') {
              // A weapon can also be carried second; the compare line says how it differs from yours.
              row.append(el('button', { type: 'button', className: 'carrySecond', textContent: 'Carry second', onclick: () => C.equip(id, c, 'weapon2') && after() }));
              row.append(el('small', { className: 'compare muted', textContent: G.compare(c, id, c.equipment.weapon) }));
              row.append(...findingRows(G.checkItem(c, id), 'span'));
            }
            return row;
          })
        : [li('Empty')]),
    );
  }

  /** P11-09: a battle button's icon (one of the kit's, or none), named in its label. */
  function setBtnIcon(btn, name) {
    const ic = btn.querySelector('.btnIco');
    if (!ic) return;
    ic.className = `btnIco ico${name ? ` ico-${name}` : ''}`;
    ic.classList.toggle('hidden', !name);
  }

  /**
   * P11-02, P11-09: the battle's gear buttons. ATTACK's icon is the weapon in hand (sword, axe, bow,
   * lance...); BLOCK's the shield, or the weapon that guards (disabled with neither). The switch control
   * sits on ATTACK's edge with the other weapon's icon, only when there is one to bring to hand (with the
   * swipe setting, it is hidden and a swipe across ATTACK switches).
   */
  function gearButtons() {
    const g = CL.game;
    const h = g.hero;
    $('#dismountBtn').classList.toggle('hidden', !h?.mounted); // P11-08: only while riding
    const guard = h?.guardKind || (h?.canBlock === false ? 'none' : 'shield');
    const block = $('#blockBtn');
    block.disabled = guard === 'none'; // P11-05: a weapon guard blocks too
    const L = g.loadout;
    const inHand = L?.kit ? (L.which === 'secondary' ? L.kit.weapon2 : L.kit.weapon) : CL.campaign?.equipment?.weapon;
    const weaponIcon = (id) => (id ? CL.gfx?.ui?.itemIcon?.(id) : null);
    const lance = h?.profile?.family === 'lance';
    const atk = weaponIcon(inHand);
    setBtnIcon($('#attackBtn'), lance ? 'lance' : atk?.name || 'fist');
    const atkName = inHand ? CL.content.item(inHand)?.name : 'your fists';
    $('#attackBtn').setAttribute('aria-label', g.mode === 'town' ? 'Talk' : `Attack with ${atkName}${h?.ranged ? ' (hold to draw)' : ''}`);
    setBtnIcon(block, guard === 'none' ? null : guard === 'shield' ? 'shield' : lance ? 'lance' : atk?.name);
    block.setAttribute('aria-label', guard === 'none' ? 'Block (nothing to block with)' : guard === 'shield' ? 'Block with your shield' : `Guard with ${atkName}`);
    const sw = $('#switchBtn');
    const swipe = CL.settings?.get?.('switchControl') === 'swipe';
    sw.classList.toggle('hidden', !L?.can || swipe);
    $('#attackWrap').classList.toggle('canSwitch', Boolean(L?.can));
    if (L?.can) {
      const other = L.which === 'primary' ? L.kit?.weapon2 : L.kit?.weapon;
      sw.disabled = Boolean(L.switching);
      setBtnIcon(sw, weaponIcon(other)?.name || 'fist');
      sw.setAttribute('aria-label', `Switch to ${other ? CL.content.item(other).name : 'fists'} (Q)`);
    }
  }

  /** P11-02: Prepare's line: the loadout this battle starts with, and any finding (the full work is P11-15). */
  function gearLine() {
    const c = CL.campaign;
    const lo = CL.gear.battleLoadout(c);
    const line = el('p', { textContent: `You fight with your ${CL.gear.LOADOUT_NAMES[lo.which]}: ${CL.gear.describe(c, c.equipment, lo.which)}.${lo.message ? ` ${lo.message}` : ''}` });
    const ic = itemIco(CL.gear.active(c, c.equipment, lo.which).weapon); // P11-04: what's in hand, drawn
    if (ic) line.prepend(ic);
    const box = el('div', { id: 'prepGear', className: 'setNote' }, line);
    box.append(...findingRows(CL.gear.check(c, c.equipment, { which: lo.which }), 'p'));
    // P11-08: on horse or foot this battle, and the choice (remembered).
    if (c.equipment.horse && CL.gear.mountOf(c.equipment.horse)?.battle !== 'no') {
      const map = CL.game.prep?.map;
      const st = CL.gear.rideState({ ...c, loadout: { ...c.loadout, ride: true } }, c.equipment, lo.which, map);
      const name = CL.content.item(c.equipment.horse).name;
      // Measured (P11-08): a hero who gallops ahead of a company on foot arrives alone; say so.
      const foot = c.roster.length && c.roster.every((s) => CL.content.troop(s.troop)?.role !== 'cavalry');
      const words = !st.ride ? st.reason : c.loadout.ride === false ? `You will fight on foot (your ${name} waits with the baggage).` : `You will ride your ${name}.${foot ? ' Your soldiers are on foot: gallop ahead and you arrive alone.' : ''}`;
      const row = el('p', { className: 'rideRow', textContent: words });
      if (st.ride) {
        row.append(' ', el('button', { type: 'button', id: 'prepRide', textContent: c.loadout.ride === false ? 'Ride' : 'Fight on foot', onclick: () => {
          c.loadout.ride = c.loadout.ride === false;
          CL.save.write();
          renderPrep();
        } }));
      }
      box.append(row);
    }
    return box;
  }

  /**
   * P11-02: the loadout a battle starts with, in words, and the choice of the other one (with a swap of
   * the two weapons) when a second weapon is carried. @param {any} c @param {string} starts @param {() => void} after
   */
  function loadoutRow(c, starts, after) {
    const G = CL.gear;
    const row = el('li', { className: 'loadoutRow' }, el('span', { textContent: `Battles start with your ${G.LOADOUT_NAMES[starts]}: ${G.describe(c, c.equipment, starts)}` }));
    if (c.equipment.weapon2) {
      const other = starts === 'primary' ? 'secondary' : 'primary';
      row.append(
        el('button', { type: 'button', className: 'startWith', textContent: `Start with ${G.LOADOUT_NAMES[other]}`, onclick: () => {
          c.loadout.start = other;
          after();
        } }),
        el('button', { type: 'button', className: 'swapWeapons', textContent: 'Swap weapons', onclick: () => CL.character.swapWeapons(c) && after() }),
      );
    }
    return row;
  }

  /**
   * The gear check's findings as rows: a mark (a shape, not a colour) and the words.
   * @param {any[]} findings @param {string} [tag] 'li' in a list, 'span' inside a row
   */
  function findingRows(findings, tag = 'li') {
    const G = CL.gear;
    return findings.map((f) => el(tag, { className: `finding finding-${f.kind}`, title: G.KIND_NAMES[f.kind] }, el('b', { className: 'findingMark', ariaHidden: 'true', textContent: G.ICONS[f.kind] }), el('span', { className: 'findingText' }, el('span', { className: 'visuallyHidden', textContent: `${G.KIND_NAMES[f.kind]}: ` }), f.text)));
  }

  /** Levy → Levies, Footman → Footmen, Hunter → Hunters. */
  function plural(name, n) {
    if (n === 1) return name;
    if (name.endsWith('man')) return `${name.slice(0, -3)}men`;
    if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
    return `${name}s`;
  }

  /** Make an element: el('p', { className: 'x' }, child, 'text'). */
  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((x) => x != null && x !== false));
    return node;
  }

  /** "XP 32/100", or "XP 285 · max tier" at the end of a troop's path (finding F-1). */
  function xpText(s) {
    const need = CL.party.UPGRADE_XP[CL.content.troop(s.troop).tier];
    return need && CL.party.upgradeOptions(s.troop).length ? `XP ${s.xp}/${need}` : `XP ${s.xp} · max tier`;
  }

  const FILTER_LABELS = { all: 'Everyone', fit: 'Fit', wounded: 'Wounded', ready: 'Ready to upgrade', infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' };

  /**
   * The company (V2-03): the soldiers as people (a list with a filter, then a profile card), or the
   * older view grouped by troop type. Which one shows is remembered for the session.
   */
  function renderTroops() {
    const g = CL.game;
    const c = CL.campaign;
    const view = ['types', 'tree', 'honour'].includes(g.troopView) ? g.troopView : 'soldiers';
    const tab = (id, label) =>
      el('button', {
        type: 'button',
        textContent: label,
        className: view === id ? 'active' : '',
        ariaPressed: String(view === id),
        onclick: () => {
          g.troopView = id;
          g.soldierProfile = null;
          renderTroops();
        },
      });
    const detach = el('button', { type: 'button', textContent: `Detachments${CL.detachments.active(c).length ? ` (${CL.detachments.active(c).length} out)` : ''}`, onclick: () => changeMode('detachments') }); // P7-05 (Back returns here)
    const tabs = el('div', {}, el('div', { className: 'viewTabs' }, tab('soldiers', 'Soldiers'), tab('types', 'By type'), tab('tree', 'Troop tree'), tab('honour', 'Roll of honour')), el('div', { className: 'row' }, detach));
    if (view === 'honour') {
      $('#sheetTroops').replaceChildren(tabs, ...honourRoll());
      return;
    }
    if (view === 'tree') {
      $('#sheetTroops').replaceChildren(tabs, upgradeAllBlock(), ...troopTree());
      return;
    }
    if (!c.roster.length) {
      g.soldierProfile = null;
      $('#sheetTroops').replaceChildren(tabs, el('p', { textContent: 'No soldiers yet. Hire some in a town.' }));
      return;
    }
    if (view === 'types') {
      $('#sheetTroops').replaceChildren(tabs, upgradeAllBlock(), ...troopTypeRows());
      return;
    }
    const profile = g.soldierProfile != null && c.roster.find((s) => s.id === g.soldierProfile);
    if (profile) {
      $('#sheetTroops').replaceChildren(tabs, soldierCard(profile));
      return;
    }
    g.soldierProfile = null;
    const filter = CL.soldiers.FILTERS.includes(g.soldierFilter) ? g.soldierFilter : 'all';
    const select = el(
      'select',
      {
        ariaLabel: 'Show soldiers',
        onchange: (e) => {
          g.soldierFilter = e.target.value;
          renderTroops();
        },
      },
      ...CL.soldiers.FILTERS.map((f) => el('option', { value: f, selected: f === filter, textContent: `${FILTER_LABELS[f]} (${CL.soldiers.list(c, f).length})` })),
    );
    const shown = CL.soldiers.list(c, filter);
    const rows = shown.map((s) => {
      const t = CL.content.troop(s.troop);
      const status = s.woundedUntil !== null ? ` · wounded until day ${CL.party.dayNumber(s.woundedUntil)}` : '';
      const ready = CL.party.soldierUpgrades(s, c).some((o) => o.can) ? ' · ready to upgrade' : '';
      return el(
        'button',
        {
          type: 'button',
          className: 'soldierRow',
          onclick: () => {
            g.soldierProfile = s.id;
            renderTroops();
          },
        },
        portraitImg(s, 'portrait small'), // P10-09
        el('b', { textContent: s.name }),
        el('span', { textContent: `${t.name} · ${t.tier} ${t.role}${CL.traits.def(s.trait) ? ` · ${CL.traits.def(s.trait).name}` : ''} · ${xpText(s)}${status}${ready}` }),
      );
    });
    $('#sheetTroops').replaceChildren(
      tabs,
      upgradeAllBlock(),
      el('label', { className: 'soldierFilter' }, 'Show ', select),
      ...(rows.length ? (shown.length > GROUP_FROM ? soldierGroups(shown, rows) : rows) : [el('p', { textContent: 'Nobody matches.' })]),
    );
  }

  const GROUP_FROM = 20; // P9-B3: a longer list is grouped by troop, each group opened by a tap

  /**
   * P9-B3: the soldiers grouped by troop, with counts (wounded, ready to upgrade), each group's rows
   * shown on a tap and remembered while the screen is open. @param {any[]} shown @param {HTMLElement[]} rows
   */
  function soldierGroups(shown, rows) {
    const g = CL.game;
    const c = CL.campaign;
    g.soldierOpen ??= {};
    const by = new Map();
    shown.forEach((s, i) => {
      if (!by.has(s.troop)) by.set(s.troop, []);
      by.get(s.troop).push([s, rows[i]]);
    });
    return [...by.entries()].map(([id, list]) => {
      const t = CL.content.troop(id);
      const hurt = list.filter(([s]) => s.woundedUntil !== null).length;
      const ready = list.filter(([s]) => CL.party.soldierUpgrades(s, c).some((o) => o.can)).length;
      const box = el('details', { className: 'soldierGroup', open: Boolean(g.soldierOpen[id]) });
      box.dataset.troop = id;
      box.ontoggle = () => {
        g.soldierOpen[id] = box.open;
      };
      box.append(el('summary', { textContent: `${t.name} ×${list.length} · ${t.tier} ${t.role}${hurt ? ` · ${hurt} wounded` : ''}${ready ? ` · ${ready} ready to upgrade` : ''}` }), ...list.map(([, row]) => row));
      return box;
    });
  }

  /** P9-B4: a soldier's division (theirs, their troop's, or by default), chosen on their card. @param {any} s */
  function divisionLine(s) {
    const c = CL.campaign;
    const D = CL.divisions;
    const role = CL.content.troop(s.troop).role;
    const now = c.divisions?.soldiers?.[s.id] || '';
    const sel = el(
      'select',
      { ariaLabel: 'Division', className: 'soldierDivision', onchange: (e) => { D.assign(c, 'soldier', s.id, e.target.value || null); CL.save.write(); renderTroops(); } },
      el('option', { value: '', textContent: `As their troop (${D.name(c, c.divisions?.troops?.[s.troop] || role)})`, selected: !now }),
      ...D.SLOTS.filter((x) => D.roleOf(x) === role).map((x) => el('option', { value: x, textContent: D.name(c, x), selected: x === now })),
    );
    return el('label', { className: 'soldierDivisionRow' }, 'Division ', sel);
  }

  /** The roll of honour (V2-10): those who fell or left, newest first, then how many before them. */
  function honourRoll() {
    const h = CL.campaign.honour || CL.chronicle.blankHonour();
    const rows = [...h.list].reverse().map((e) => {
      const t = CL.chronicle.honourText(e);
      return el('div', { className: `honourRow ${e.how}` }, el('b', { textContent: t.title }), el('span', { textContent: t.line }));
    });
    const before = h.earlier;
    const older = (before.fell || 0) + (before.deserted || 0) + (before.retired || 0);
    const out = [el('p', { className: 'muted', textContent: 'Those who fell, deserted or retired. They are remembered here.' })];
    if (!rows.length && !older) out.push(el('p', { textContent: 'Nobody yet. May it stay that way.' }));
    out.push(...rows);
    if (older) out.push(el('p', { className: 'muted', textContent: `And ${older} before them: ${before.fell || 0} fallen, ${before.deserted || 0} deserted, ${before.retired || 0} retired.` }));
    return out;
  }

  /** One soldier's profile card: who they are, their record and notes, rename and upgrade. */
  // ---- Soldiers' portraits (P10-09's faces, drawn by the art kit from P10-G5) ----

  /** The colours a soldier of the company wears: your realm's when sworn or serving, else your own banner. */
  const companySide = () => {
    const c = CL.campaign;
    return (c && (CL.allegiance?.sworn?.(c) || CL.allegiance?.serves?.(c))) || 'player';
  };
  const portraitSrc = (s) => CL.gfx.ui.portraitUrl(CL.gfx.ui.soldierLook(s, companySide()), 64);
  const portraitImg = (s, cls = 'portrait') => (s.portrait ? el('img', { className: cls, src: portraitSrc(s), alt: '' }) : null);
  /** A troop's small figure (P10-G5): in the recruit screens, the troop tree and the soldiers' cards. */
  const troopImg = (id, side, cls = 'troopFig') => el('img', { className: cls, src: CL.gfx.ui.troopUrl(id, side), alt: '' });

  function soldierCard(s) {
    const g = CL.game;
    const c = CL.campaign;
    const P = CL.party;
    const t = CL.content.troop(s.troop);
    const culture = CL.content.table('cultures')[s.culture]?.name || '';
    const joined = s.joined === null ? 'Served before the company kept records' : `Joined ${s.origin ? `at ${CL.soldiers.placeName(s.origin)} ` : ''}on day ${P.dayNumber(s.joined)}`;
    const status = s.woundedUntil === null ? 'Fit' : `Wounded until day ${P.dayNumber(s.woundedUntil)}`;
    const r = s.record;
    const back = el('button', {
      type: 'button',
      textContent: '‹ The company',
      onclick: () => {
        g.soldierProfile = null;
        renderTroops();
      },
    });
    const nameRow = el('div', { className: 'soldierName' }, el('h3', { textContent: s.name }));
    const renameBtn = el('button', { type: 'button', textContent: 'Rename' });
    renameBtn.onclick = () => {
      const input = el('input', { value: s.name, maxLength: CL.soldiers.NAME_MAX, ariaLabel: 'New name', spellcheck: false, autocomplete: 'off' });
      const save = () => {
        if (CL.soldiers.rename(c, s.id, input.value)) CL.save.write();
        renderTroops();
      };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') renderTroops();
      };
      nameRow.replaceChildren(input, el('button', { type: 'button', textContent: 'Save', onclick: save }), el('button', { type: 'button', textContent: 'Cancel', onclick: renderTroops }));
      input.focus();
      input.select();
    };
    nameRow.append(renameBtn);
    const portrait = el('div', { className: 'soldierPics' }, portraitImg(s), troopImg(s.troop, companySide())); // P10-09, P10-G5
    const stat = (label, n) => el('span', {}, el('b', { textContent: String(n) }), ` ${label}`);
    const upgrades = P.soldierUpgrades(s, c).map((o) => {
      const to = CL.content.troop(o.to);
      return el('button', {
        type: 'button',
        disabled: !o.can,
        textContent: o.can ? `Upgrade to ${to.name} · ${o.cost} crowns` : `${to.name}: ${o.why}`,
        onclick: () => {
          if (P.upgradeSoldier(c, s.id, o.to)) {
            CL.save.write();
            message(`${s.name} is now a ${to.name}`);
          }
          renderSheet();
        },
      });
    });
    return el(
      'div',
      { className: 'soldierCard' },
      back,
      el('div', { className: 'soldierHead' }, portrait, el('div', {}, nameRow, el('p', { textContent: `${t.name} · ${t.tier} ${t.role} · ${xpText(s)}` }), el('p', { textContent: `${status} · ${culture} · ${joined}` }), CL.styles?.card(t.id) ? el('p', { className: 'soldierStyle muted', textContent: CL.styles.card(t.id) }) : null)), // P11-10, P11-11: its weapon, armour and style
      el(
        'p',
        { className: 'soldierStats' },
        stat('battles', r.battles),
        stat('victories', r.victories),
        stat('kills', r.kills),
        stat('assists', r.assists),
        stat('wounds', r.wounds),
        stat('captures', r.captures),
        stat('crowns paid', r.wagesPaid),
      ),
      traitLine(s),
      divisionLine(s),
      el('ul', { className: 'soldierNotes' }, ...s.notes.map((n) => el('li', { textContent: `Day ${P.dayNumber(n.day)}: ${CL.soldiers.noteText(n)}` }))),
      upgrades.length ? el('div', { className: 'soldierUpgrades' }, ...upgrades) : el('p', { className: 'muted', textContent: `${t.name} is at max tier; experience still counts toward the record.` }),
      retireButton(s),
    );
  }

  /** A soldier's trait (P7-07), or how far they are from each milestone. */
  function traitLine(s) {
    const T = CL.traits;
    const t = T.def(s.trait);
    if (t) return el('p', { className: 'soldierTrait', textContent: `${t.name}: ${t.text}` });
    const next = T.ORDER.map((id) => T.TRAITS[id])
      .map((x) => `${x.name} at ${x.at} ${x.record}`)
      .join(', ');
    return el('p', { className: 'soldierTrait muted', textContent: `No trait yet (${next}).` });
  }

  /** Retire with honour (V2-10): a second tap confirms; it can't be undone. */
  function retireButton(s) {
    const b = el('button', { type: 'button', className: 'retireBtn', textContent: 'Retire with honour' });
    b.onclick = () => {
      if (!b.dataset.confirm) {
        b.dataset.confirm = '1';
        b.textContent = `Retire ${s.name}? They leave the company for good. Tap again`;
        return;
      }
      if (CL.party.retireSoldier(CL.campaign, s.id)) {
        CL.save.write();
        message(`${s.name} retires from the company with honour`);
        CL.game.soldierProfile = null;
      }
      renderSheet();
    };
    return b;
  }

  /** "3× Levy (T1 infantry) · 1 wounded · best XP 30/40 · 1 ready", or "… · max tier" (F-1). */
  function troopTypeInfo(id, list) {
    const P = CL.party;
    const t = CL.content.troop(id);
    const opts = P.upgradeOptions(id);
    const wounded = list.filter((s) => s.woundedUntil !== null).length;
    const head = `${list.length}× ${t.name} (${t.tier} ${t.role})${wounded ? ` · ${wounded} wounded` : ''}`;
    if (!opts.length) return `${head} · max tier`;
    const ready = list.filter(P.readyFor).length;
    const best = Math.max(...list.map((s) => s.xp));
    return `${head} · best XP ${best}/${opts[0].xp}${ready ? ` · ${ready} ready` : ''}`;
  }

  /** One button per upgrade path of a troop type, each saying why when it can't be pressed. */
  function typeUpgradeButtons(id, list) {
    const P = CL.party;
    const c = CL.campaign;
    const t = CL.content.troop(id);
    const ready = list.filter(P.readyFor).length;
    return P.upgradeOptions(id).map((o) => {
      const to = CL.content.troop(o.to);
      let why = o.locked;
      if (!why && !list.length) why = 'none in the company';
      if (!why && !ready) why = list.some((s) => s.xp >= o.xp) ? 'the ready ones are wounded' : `needs ${o.xp} XP`;
      if (!why && c.gold < o.cost) why = `needs ${o.cost} crowns`;
      return el('button', {
        type: 'button',
        disabled: Boolean(why),
        textContent: why ? `→ ${to.name} · ${o.cost} each (${why})` : `→ ${to.name} · ${o.cost} each`,
        onclick: () => {
          const n = P.upgrade(id, o.to);
          if (n) {
            CL.save.write();
            message(`Upgraded ${n} ${plural(t.name, n)} to ${plural(to.name, n)}`);
          }
          renderSheet();
        },
      });
    });
  }

  /**
   * "Upgrade all ready" (V2-03b, F-1): the total cost first, then a confirmation that says exactly
   * what will happen, including who waits (wounded) and who can't be afforded.
   */
  function upgradeAllBlock() {
    const g = CL.game;
    const c = CL.campaign;
    const P = CL.party;
    const plan = P.upgradeAllPlan(c);
    const box = el('div', { className: 'upgradeAll' });
    const waiting = [
      plan.wounded ? `${plan.wounded} wounded wait${plan.wounded === 1 ? 's' : ''}` : '',
      plan.unaffordable ? `${plan.unaffordable} more need${plan.unaffordable === 1 ? 's' : ''} crowns` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (!plan.items.length) {
      if (waiting) box.append(el('span', { className: 'muted', textContent: `Ready to upgrade: ${waiting}.` }));
      return box;
    }
    const n = plan.items.length;
    if (!g.confirmUpgradeAll) {
      box.append(
        el('button', {
          type: 'button',
          textContent: `Upgrade all ready · ${n} for ${plan.total} crowns`,
          onclick: () => {
            g.confirmUpgradeAll = true;
            renderTroops();
          },
        }),
        ...(waiting ? [el('span', { className: 'muted', textContent: waiting })] : []),
      );
      return box;
    }
    const groups = {};
    for (const it of plan.items) groups[`${it.from}>${it.to}`] = (groups[`${it.from}>${it.to}`] || 0) + 1;
    const what = Object.entries(groups)
      .map(([k, k2]) => {
        const [from, to] = k.split('>');
        return `${k2} ${plural(CL.content.troop(from).name, k2)} → ${plural(CL.content.troop(to).name, k2)}`;
      })
      .join(', ');
    const twoPath = plan.items.some((it) => P.upgradeOptions(it.from).length > 1);
    box.append(
      el('p', {
        textContent: `Upgrade ${n} soldier${n === 1 ? '' : 's'} for ${plan.total} crowns: ${what}.${waiting ? ` (${waiting}.)` : ''}${twoPath ? ' Troops with two paths take the first; choose the other on a soldier’s card.' : ''}`,
      }),
      el('button', {
        type: 'button',
        textContent: 'Upgrade',
        onclick: () => {
          g.confirmUpgradeAll = false;
          const r = P.upgradeAll(c);
          if (r.done) {
            CL.save.write();
            message(`Upgraded ${r.done} soldier${r.done === 1 ? '' : 's'} for ${r.cost} crowns`);
          }
          renderSheet();
        },
      }),
      el('button', {
        type: 'button',
        textContent: 'Cancel',
        onclick: () => {
          g.confirmUpgradeAll = false;
          renderTroops();
        },
      }),
    );
    return box;
  }

  /** The troop tree as the company knows it (V2-03b): unknown troops hidden, seen ones named, owned ones in full. */
  function troopTree() {
    const c = CL.campaign;
    const lines = CL.troopTree.view(c);
    if (!lines.length) return [el('p', { textContent: 'You have not met any troops yet. The tree fills in as you hire, train and fight them.' })];
    const node = (n) => {
      const kids = n.children.length ? el('ul', {}, ...n.children.map(node)) : null;
      if (n.level === 'unknown') return el('li', { className: 'treeNode unknown' }, el('span', { textContent: '? An unknown troop' }), kids);
      if (n.level === 'seen') return el('li', { className: 'treeNode seen' }, troopImg(n.id, null, 'troopFig small'), el('b', { textContent: n.name }), el('span', { className: 'muted', textContent: ' · seen, not yet known' }), kids);
      const st = n.stats;
      const company = n.count ? `In your company: ${n.count}${n.ready ? ` (${n.ready} ready)` : ''}` : 'None in your company';
      const ways = n.maxTier
        ? 'Max tier'
        : n.paths.map((p) => `→ ${CL.troopTree.level(c, p.to) ? CL.content.troop(p.to).name : '?'}: ${p.xp} XP and ${p.cost} crowns`).join(' · ');
      const list = c.roster.filter((s) => s.troop === n.id);
      return el(
        'li',
        { className: 'treeNode owned' },
        troopImg(n.id, companySide(), 'troopFig small'),
        el('b', { textContent: n.name }),
        el('span', { textContent: ` · ${n.tier} ${n.role} · HP ${st.hp} · damage ${st.damage} · armour ${st.armor} · wage ${st.wage}/week` }),
        el('div', { className: 'muted', textContent: `${company} · ${ways}` }),
        CL.styles?.card(n.id) ? el('div', { className: 'muted treeStyle', textContent: CL.styles.card(n.id) }) : null, // P11-10, P11-11
        n.count && !n.maxTier ? el('div', { className: 'treeButtons' }, ...typeUpgradeButtons(n.id, list)) : null,
        kids,
      );
    };
    return lines.map((line) => el('div', { className: 'treeLine' }, el('h4', { textContent: line.name }), el('ul', {}, ...line.nodes.map(node))));
  }

  /** Troops grouped by type, with XP progress and upgrade buttons (GDD §7). */
  function troopTypeRows() {
    const c = CL.campaign;
    const groups = {};
    for (const s of c.roster) {
      groups[s.troop] ||= [];
      groups[s.troop].push(s);
    }
    const rows = Object.entries(groups).map(([id, list]) => {
      const row = Object.assign(document.createElement('div'), { className: 'troopRow' });
      row.append(el('span', { textContent: troopTypeInfo(id, list) }), ...typeUpgradeButtons(id, list));
      return row;
    });
    return rows;
  }

  function openSheet() {
    if (!CL.campaign.character) return;
    const m = CL.game.mode;
    if (m === 'map' || m === 'settlement' || m === 'town' || m === 'talk') CL.game.returnMode = m === 'map' ? 'map' : 'place';
    changeMode('character');
  }

  function refreshRoster() {
    const c = CL.campaign;
    const p = CL.party;
    // P10-08: the company's numbers with their icons (the words stay for screen readers and tests).
    const sum = (icon, text) => el('span', { className: 'sumItem' }, el('span', { className: `ico ico-${icon}` }), text);
    $('#rosterSummary').replaceChildren(
      sum('book', `Day ${p.dayNumber()}`),
      sum('coin', `${c.gold} crowns`),
      sum('star', `${c.renown} renown`),
      sum('people', `${CL.party.headcount(c)}/${p.partyCap()} soldiers`),
      sum('sword', `${c.victories} wins`),
    );

    // One line per troop type: ready count, plus wounded and when they return.
    const groups = {};
    for (const s of c.roster) {
      groups[s.troop] ||= { ready: 0, wounded: [] };
      const g = groups[s.troop];
      if (s.woundedUntil === null) g.ready++;
      else g.wounded.push(p.dayNumber(s.woundedUntil));
    }
    const list = $('#rosterList');
    list.replaceChildren(
      ...Object.entries(groups).map(([id, g]) => {
        const t = CL.content.troop(id);
        const li = document.createElement('li');
        const back = g.wounded.length ? ` · ${g.wounded.length} wounded (back day ${Math.min(...g.wounded)})` : '';
        li.textContent = `${t.name} (${t.tier} ${t.role}) — ${g.ready} ready${back}`;
        return li;
      }),
    );
    if (!c.roster.length) list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'No soldiers — the hero fights alone.' }));

    const items = p.describeItems(c.inventory);
    $('#inventory').textContent = items ? `Pack: ${items}` : 'Pack: empty';

    $('#supplies').replaceChildren(...supplyParts(c));

    // Food: sold wherever the settlement trades (GDD §9: food is bought through settlement menus).
    const sellsFood = p.currentSettlement()?.services.includes('trade');
    const U = CL.upkeep;
    const price = U.rationPrice(c);
    [
      ['#buyFoodA', 3, "3 days'"],
      ['#buyFoodB', 7, "a week's"],
    ].forEach(([sel, days, label]) => {
      const b = $(sel);
      b.classList.toggle('hidden', !sellsFood);
      const rations = U.dailyRations(c) * days;
      b.dataset.rations = rations;
      b.textContent = `Buy ${label} food · ${rations * price} crowns`;
      b.disabled = c.gold < rations * price;
    });

    // Recruit buttons: one per troop the settlement's owner offers (hidden when none). A refusal
    // (P8-03) leaves them shown but disabled, with the reason on them and in the note below.
    const offers = p.troopsOffered();
    const hire = CL.rights.may(c, 'player', 'recruit', c.world.location);
    ['#recruitA', '#recruitB', '#recruitC'].forEach((sel, i) => {
      const b = $(sel);
      const id = offers[i];
      b.classList.toggle('hidden', !id);
      if (!id) return;
      const t = CL.content.troop(id);
      b.dataset.troop = id;
      b.replaceChildren(troopImg(id, null, 'troopFig btn'), `Hire ${t.name} · ${t.recruitCost} crowns`); // P10-G5: the troop's figure
      b.disabled = !hire.ok || !p.canRecruit(c, id);
      b.title = hire.ok ? '' : hire.why;
    });
    $('#restBtn').classList.toggle('hidden', !p.canRest());
    $('#tradeBtn').classList.toggle('hidden', !CL.trade.hasMarket(c.world.location));
    const board = CL.contracts.offersContracts(c.world.location);
    $('#contractsBtn').classList.toggle('hidden', !board);
    const payday = c.contract?.status === 'done' && c.contract.giver === c.world.location;
    $('#contractsBtn').textContent = payday ? 'Contracts — collect pay!' : 'Contracts';
    // People to talk to: those in a walkable place's streets (so the menu, where you arrive, reaches
    // them too), then dialogues placed at this settlement.
    const people = [
      ...CL.town.streetPeople(c.world.location),
      ...CL.story.peopleAt(c.world.location, c).map((t) => ({ id: t.id, name: CL.story.speakerOf(t, c) })),
    ].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
    $('#peopleHere').replaceChildren(
      ...people.map((t) => {
        const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `Talk to ${t.name}` });
        b.onclick = () => talkTo(t.id);
        return b;
      }),
    );
    $('#happeningsHere').replaceChildren(...happeningCards(c, c.world.location));
    $('#tourneyHere').replaceChildren(...tourneyCard(c, c.world.location));
    $('#businessHere').replaceChildren(...millCard(c, c.world.location));
    $('#siegeHere').replaceChildren(...siegeCard(c, c.world.location)); // P8-06a
    $('#serviceNote').textContent = !hire.ok
      ? `${hire.why}.`
      : offers.length
        ? ''
        : 'No one here is looking to take up arms.';
  }

  /**
   * World events here (P7-08): what is going on, what happens if no one helps, and the one decision
   * (take part or not); a choice that cannot be made says why.
   */
  function happeningCards(c, sid) {
    const H = CL.happenings;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    return H.here(c, sid).map((e) => {
      const d = CL.content.get('world_events', e.kind);
      const card = el('div', 'happening');
      card.dataset.happening = e.kind;
      const left = Math.max(0, e.until - c.day);
      card.append(el('b', '', `${d.name} · ${left < 1 ? 'today only' : `${Math.floor(left)} days left`}`));
      card.append(el('p', '', H.fill(d.text, e, c)));
      const taken = H.takenText(e);
      if (taken) card.append(el('p', 'taken', taken));
      else card.append(el('p', 'ignored', H.fill(d.ignored, e, c)));
      const row = el('div', 'row');
      for (const o of H.options(c, e)) {
        const b = el('button', '', o.text);
        b.type = 'button';
        b.dataset.choice = o.id;
        b.disabled = Boolean(o.reason);
        if (o.reason) b.title = o.reason;
        b.onclick = () => {
          const r = H.choose(c, e.id, o.id);
          if (!r.ok) message(r.reason);
          CL.save.write();
          refreshRoster();
        };
        row.append(b);
        if (o.reason) row.append(el('span', 'why', o.reason));
      }
      if (row.childElementCount) card.append(row);
      return card;
    });
  }

  /** The tournament here (P7-09): its prizes and fee and Enter, or your place in the bracket and Fight. */
  function tourneyCard(c, sid) {
    const v = CL.tourney.view(c, sid);
    if (!v) return [];
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const card = el('div', 'happening tourney');
    card.dataset.tourney = v.kind;
    card.append(el('b', '', v.title));
    for (const l of v.lines) card.append(el('p', '', l));
    // P11-02: the lists' loaner kit, through the gear check (what you fight with, and anything it finds).
    const kit = CL.content.get('tournaments', 'lists').kit;
    card.append(...findingRows(CL.gear.check(c, kit, { loaner: true }), 'p'));
    const row = el('div', 'row');
    const button = (text, id, fn, reason = '') => {
      const b = el('button', '', text);
      b.type = 'button';
      b.id = id;
      b.disabled = Boolean(reason);
      if (reason) b.title = reason;
      b.onclick = fn;
      row.append(b);
      if (reason) row.append(el('span', 'why', reason));
    };
    if (v.kind === 'open') {
      button(v.enter, 'tourneyEnter', () => {
        const r = CL.tourney.enter(c, sid);
        if (!r.ok) message(r.reason);
        CL.save.write();
        refreshRoster();
      }, v.reason);
    } else {
      button(v.fight, 'tourneyFight', () => CL.tourney.fight(c));
      button('Withdraw', 'tourneyWithdraw', () => {
        CL.tourney.withdraw(c);
        CL.save.write();
        refreshRoster();
      });
    }
    card.append(row);
    return [card];
  }

  /**
   * The mill (P7-10): for sale here, with what it would make at today's prices and the one decision
   * (buy); or yours, with its money, who runs it, its weekly reports, a seizure warning, money in and
   * out and the manager (at the mill only), the expert price rules, and Sell (from anywhere: the
   * Accounts screen shows it too). Selling asks for a second tap.
   * @param {Campaign} c @param {string | null} sid the settlement you are in, or null on the Accounts screen
   */
  function millCard(c, sid) {
    const B = CL.business;
    const R = B.rules();
    const mine = B.get(c);
    const v = sid ? B.view(c, sid) : mine ? { kind: 'owned', b: mine } : null;
    if (!v) return [];
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const redraw = () => {
      CL.save.write();
      refreshRoster();
      if (c === CL.campaign && CL.game.mode === 'accounts') renderAccounts();
    };
    const card = el('div', 'happening mill');
    card.dataset.mill = v.kind;
    const row = el('div', 'row');
    const button = (text, id, fn, reason = '') => {
      const b = el('button', '', text);
      b.type = 'button';
      b.id = id;
      b.disabled = Boolean(reason);
      if (reason) b.title = reason;
      b.onclick = () => {
        if (fn(b) !== false) redraw();
      };
      row.append(b);
      if (reason) row.append(el('span', 'why', reason));
      return b;
    };
    const signed = (n) => (n >= 0 ? `+${n}` : `−${-n}`);
    const guess = (where, id) => {
      const e = B.estimate(c, where, id);
      return e.n ? `about ${e.n} sacks a week, for ${signed(e.profit)} crowns after the wage and the lord's due` : `nothing: ${e.why}`;
    };
    if (v.kind === 'forSale') {
      card.append(el('b', '', `A mill for sale · ${v.price} crowns`));
      card.append(el('p', '', `A miller grinds grain into flour and sells it here every week, paying for grain and wages from the mill's own money; the owner of ${CL.soldiers.placeName(sid)} takes ${Math.round(R.due * 100)}% of the sales. You decide only to buy or to sell.`));
      card.append(el('p', 'estimate', `At today's prices the village miller would grind ${guess(sid, 'miller')}.`));
      button(`Buy the mill · ${v.price}`, 'millBuy', () => {
        const b = B.buy(c, sid);
        message(b ? `You own the mill at ${CL.soldiers.placeName(sid)}. Put crowns in for grain and wages.` : B.blocked(c, sid) || 'Cannot buy it');
      }, v.why || '');
      card.append(row);
      return [card];
    }
    const b = v.b;
    const m = B.manager(b);
    const here = B.atMill(c);
    const money = B.cash(c);
    card.append(el('b', '', `Your mill at ${CL.soldiers.placeName(b.place)} · its money ${money} crowns`));
    card.append(el('p', '', `Run by ${m.name} (${m.wage} a week). ${b.weeks ? `${b.weeks} week${b.weeks === 1 ? '' : 's'} run, ${signed(b.profit)} crowns in all. ` : ''}Each payday it runs a week on its own.`));
    if (b.seizeOn !== null) card.append(el('p', 'warn', `${CL.realm.faction(b.owner)?.name || 'The owner'} will seize it on day ${CL.party.dayNumber(b.seizeOn)} unless you sell it or mend relations first.`));
    if (here) card.append(el('p', 'estimate', `At today's prices: ${guess(b.place, b.manager)}.`));
    if (b.log.length) {
      const ul = el('ul', 'soldierNotes millLog');
      for (const e of b.log.slice(-4).reverse()) ul.append(el('li', e.bad ? 'bad' : '', `Day ${CL.party.dayNumber(e.day)}: ${e.text}`));
      card.append(ul);
    }
    const away = here ? '' : 'At the mill only';
    button('Put in 50', 'millFund', () => B.fund(c, Math.min(50, c.gold)), away || (c.gold <= 0 ? 'Your purse is empty' : ''));
    button('Put in 200', 'millFund200', () => B.fund(c, Math.min(200, c.gold)), away || (c.gold <= 0 ? 'Your purse is empty' : ''));
    button('Take all out', 'millTake', () => B.fund(c, -money), away || (money <= 0 ? 'Nothing in it' : ''));
    const other = b.manager === 'master' ? 'miller' : 'master';
    const om = R.managers[other];
    button(other === 'master' ? `Hire ${om.name} · ${om.hire}` : `Back to ${om.name}`, 'millManager', () => B.setManager(c, other), away || (om.hire > c.gold ? `You need ${om.hire} crowns` : ''));
    const sale = B.saleValue(b);
    button(`Sell · ${sale} crowns`, 'millSell', (btn) => {
      if (!btn.dataset.confirm) {
        btn.dataset.confirm = '1';
        btn.textContent = `Sell for ${sale} and its ${money} crowns? It can't be undone. Tap again`;
        return false;
      }
      const r = B.sell(c);
      if (r) message(`Sold the mill for ${r.price} crowns${r.cash ? `, and took its ${r.cash} crowns` : ''}`);
    });
    card.append(row);
    // The expert layer: price rules.
    const rules = el('details', 'millRules');
    rules.append(el('summary', '', 'Price rules (expert)'));
    const pick = (key, label, words) => {
      const lab = el('label', '', `${label} `);
      const sel = Object.assign(document.createElement('select'), { id: key === 'maxInput' ? 'millMaxGrain' : 'millMinFlour' });
      for (const x of R.rules[key]) sel.append(Object.assign(document.createElement('option'), { value: x === null ? '' : String(x), textContent: x === null ? 'no limit' : words(x), selected: b.rules[key] === x }));
      sel.onchange = () => {
        B.setRule(c, key, sel.value === '' ? null : Number(sel.value));
        redraw();
      };
      lab.append(sel);
      return lab;
    };
    rules.append(pick('maxInput', 'Pay for grain at most', (x) => `${x} a sack`), pick('minOutput', 'Sell flour for at least', (x) => `${x} a sack`));
    rules.append(el('p', '', 'Without rules the miller grinds while each sack leaves a crown after the lord’s due.'));
    card.append(rules);
    return [card];
  }

  /** Food / morale / wages readout, with warnings highlighted (GDD §11). */
  function supplyParts(c) {
    const U = CL.upkeep;
    const days = U.foodDays(c);
    const wages = U.weeklyWages(c);
    const span = (text, warn) => Object.assign(document.createElement('span'), { textContent: text, className: warn ? 'warn' : '' });
    const moraleWord = c.morale >= 60 ? 'steady' : c.morale >= U.MORALE.desertBelow ? 'shaken' : 'mutinous';
    return [
      span(`Food: ${days >= 10 ? Math.floor(days) : days.toFixed(1)} days (${U.dailyRations(c)}/day)`, days < 1),
      span(` · Morale: ${Math.round(c.morale)} ${moraleWord}`, c.morale < U.MORALE.desertBelow),
      span(
        wages ? ` · Wages: ${wages} crowns due day ${CL.party.dayNumber(c.nextWagesDay)}` : ' · No wages owed',
        wages > c.gold + CL.accounts.balance(c, 'chest'),
      ),
      span(CL.accounts.balance(c, 'chest') ? ` · Chest: ${CL.accounts.balance(c, 'chest')} crowns` : ''),
    ];
  }

  function hideBattleOverlays() {
    $('#stage').dataset.mode = 'battle';
    $('#stage').toggleAttribute('data-duel', Boolean(CL.game.duel)); // a tournament bout: no orders (P7-09)
    if (CL.tips?.showing()) hideTip();
    setTimeout(() => CL.tips?.check('battle'), 0); // at once: the first battle waits on its card (battles don't start through changeMode)
    requestAnimationFrame(fitHud);
    $('#attackBtn .btnLabel').textContent = 'ATTACK';
    CL.input?.releaseHeld?.(); // P11-09: a battle starts with nothing held
    gearButtons();
    $('#overlay').classList.add('hidden');
    $('#ordersPanel').classList.add('hidden');
    $('#prepPanel').classList.add('hidden'); // the battle starts from the preparation screen (V2-07)
  }

  /** Show the selected group and highlight it plus that group's current order. */
  /** The tactical overview opened or closed (V2-06): the Orders panel comes with it, to pick a group. */
  function showOverview(on) {
    $('#mapBtn')?.classList.toggle('active', on);
    $('#ordersPanel').classList.toggle('hidden', !on);
    if (on) showSelectedGroup(CL.game.group);
  }

  /**
   * The Orders panel for the selected division (P9-B4: a button for each division the battle has, its
   * formations, and on the tactical map what a tap does and when).
   */
  function showSelectedGroup(group) {
    const g = CL.game;
    const D = CL.divisions;
    const c = CL.campaign;
    const role = D.roleOf(group);
    const state = g.groupState?.[group]; // forming · formed · advancing · engaged (V2-08a)
    const mood = CL.morale?.word(g, 'ally', role); // wavering · falling back · routing (V2-08b)
    // P11-13: the order's state (moving, holding, engaged, done, can't: why) and a formation's ranks.
    const os = g.orderState?.[group];
    const ranks = os?.cohesion != null ? ` · ranks ${Math.round(os.cohesion * 100)}%` : '';
    const doing = os ? (os.state === 'cant' ? `can't: ${os.reason}` : os.word) : state;
    $('#selectedGroup').textContent = D.name(c, group) + (doing && !(os?.state === 'cant' && mood) && mood !== 'routing' ? ` · ${doing}` : '') + (os?.state !== 'cant' ? ranks : '') + (mood ? ` · ${mood}` : '');
    $('#selectedGroup').dataset.state = os?.state || state || '';
    for (const b of document.querySelectorAll('#groupRow [data-group]')) b.dataset.state = g.orderState?.[b.dataset.group]?.state || '';
    const wait = g.mode === 'battle' ? Math.ceil(CL.morale?.rallyIn(g) || 0) : 0;
    const rb = $('#rallyBtn');
    if (rb) {
      rb.textContent = wait ? `Rally in ${wait} s` : 'R Rally';
      rb.disabled = Boolean(wait) || !g.hero?.alive;
    }
    // The divisions: the three of the roles always (one without soldiers shown unavailable, GDD §7), and the others the battle has.
    const here = new Set(D.present(g));
    const shown = D.SLOTS.filter((d, i) => i < 3 || here.has(d));
    const row = $('#groupRow');
    if (row && row.childElementCount !== shown.length) {
      row.replaceChildren(
        ...shown.map((d) => {
          const btn = Object.assign(document.createElement('button'), { type: 'button' });
          btn.dataset.group = d;
          btn.onclick = () => CL.combat.order(d, null);
          return btn;
        }),
      );
    }
    for (const b of row ? row.querySelectorAll('[data-group]') : []) {
      b.textContent = `${D.SLOTS.indexOf(b.dataset.group) + 1} ${D.name(c, b.dataset.group)}`;
      b.disabled = !g.allies?.some((a) => a.alive && (a.div || a.role) === b.dataset.group && !a.companion && !a.outside) && D.roleOf(b.dataset.group) !== 'infantry';
      b.classList.toggle('active', b.dataset.group === group);
    }
    const current = g.orders?.[group];
    for (const b of document.querySelectorAll('[data-order]')) b.classList.toggle('active', b.dataset.order === current);
    // The selected division's formation: only those its soldiers can take (P7-11, P9-B4).
    const can = D.FORMATIONS[role] || ['loose'];
    const has = D.members(g, group).length > 0;
    for (const b of document.querySelectorAll('[data-formation]')) {
      b.classList.toggle('hidden', !can.includes(b.dataset.formation));
      b.classList.toggle('active', b.dataset.formation === CL.formations.chosenFor(g, group));
      b.disabled = !has;
    }
    // Layer 4: on the tactical map, what a tap does and when.
    for (const id of ['#mapActionRow', '#mapTimingRow']) $(id)?.classList.toggle('hidden', !g.overview);
    $('#ordersPanel').classList.toggle('onMap', Boolean(g.overview)); // on the map: the divisions, the action and when, out of the field's way
    for (const b of document.querySelectorAll('[data-map-action]')) b.classList.toggle('active', b.dataset.mapAction === (g.mapAction || 'move'));
    for (const b of document.querySelectorAll('[data-map-timing]')) b.classList.toggle('active', b.dataset.mapTiming === String(g.mapTiming ?? 'now'));
  }

  function setPaused(paused, reason) {
    const g = CL.game;
    if (g.mode !== 'battle' || g.paused === paused) return;
    g.paused = paused;
    if (paused) CL.input?.releaseHeld?.(); // P11-09: a pause (or a card, Help, Settings) lets go of everything
    $('#pauseBtn').textContent = paused ? 'Resume' : 'Pause';
    CL.diag.log('info', paused ? 'Paused' : 'Resumed', reason ? { reason } : undefined);
  }

  function togglePause() {
    setPaused(!CL.game.paused);
  }

  /** Pause for a lifecycle reason (tab hidden, rotation). Never auto-resumes. */
  function autoPause(reason) {
    setPaused(true, reason);
  }

  function showRotatePrompt(show) {
    $('#rotate').classList.toggle('hidden', !show);
  }

  // ---- Diagnostics panel ----

  function report() {
    const g = CL.game;
    return {
      build: CL.BUILD,
      time: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      game: {
        mode: g.mode,
        paused: g.paused,
        hero: g.hero ? { hp: g.hero.hp, x: g.hero.x, y: g.hero.y, alive: g.hero.alive } : null,
        wave: g.wave,
        kills: g.kills,
        allies: g.allies.length,
        liveAllies: g.allies.filter((x) => x.alive).length,
        enemies: g.enemies.length,
        liveEnemies: g.enemies.filter((x) => x.alive).length,
        orders: g.orders,
        group: g.group,
        campaign: CL.campaign,
      },
      fps: CL.diag.fps,
      events: CL.diag.events,
    };
  }

  function download(name, type, data) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([data], { type }));
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function renderDebug() {
    const r = report();
    $('#debugStats').textContent = JSON.stringify(
      {
        build: r.build,
        mode: r.game.mode,
        hero: r.game.hero,
        units: { allies: r.game.liveAllies, enemies: r.game.liveEnemies },
        fps: r.fps,
        frameMs: { simulation: Number(CL.diag.simMs.toFixed(2)), drawing: Number(CL.diag.drawMs.toFixed(2)) },
        battleSize: CL.combat.BATTLE.activeCap,
        assets: r.assets,
        campaign: CL.campaign,
      },
      null,
      2,
    );
    $('#debugEvents').textContent = CL.diag.events
      .slice(-150)
      .map((e) => `${e.date} [${e.level}] ${e.msg} ${e.data ? JSON.stringify(e.data) : ''}`)
      .join('\n');
  }

  const isDebugOpen = () => !$('#debugPanel').classList.contains('hidden');

  function toggleDebug() {
    $('#debugPanel').classList.toggle('hidden');
    if (isDebugOpen()) renderDebug();
  }

  // ---- Conversations from a settlement menu, and the Quest Journal (GDD screen 10) ----

  /** The story's ending panel; afterwards the sandbox carries on (GDD §10). */
  function showEnding(view) {
    CL.game.ending = view;
    CL.save.write();
    changeMode('ending');
  }

  function closeEnding() {
    CL.game.ending = null;
    if (CL.campaign.world.location) CL.town.backToPlace();
    else changeMode('map');
  }

  function talkTo(dialogueId) {
    const conv = CL.story.talk(dialogueId);
    if (!conv) return;
    // P10-08: what they are, under their name: their tag in the streets, or the story person's own.
    const street = CL.town.peopleOf(CL.campaign.world.location).find((n) => n.dialogue === dialogueId);
    const tree = CL.content.table('dialogue')[dialogueId];
    const tag = street?.tag || (tree?.tag || tree?.cast ? CL.story.lookOf(tree).tag : null);
    CL.game.talk = { npc: { id: dialogueId, name: conv.speaker, tag, action: 'talk' }, conv, line: conv.text };
    changeMode('talk');
  }

  function openJournal() {
    if (!CL.campaign.character) return;
    const m = CL.game.mode;
    CL.game.journalReturn = m === 'map' ? 'map' : 'place';
    changeMode('journal');
  }

  // ---- The Realm screen (P8-02): who holds what, and the lords; read-only for now ----

  // It opens from the Journal (on the map and in every settlement): the phone's top row and the
  // settlement menu have no room for another button. Back returns to the Journal.
  function openRealm() {
    if (!CL.campaign.character) return;
    changeMode('realm');
  }

  function closeRealm() {
    changeMode('journal');
  }

  /** P10-G5: a lord's portrait and their house's arms, drawn by the art kit. */
  function lordPics(c, pid) {
    const box = Object.assign(document.createElement('span'), { className: 'lordPics' });
    box.append(Object.assign(document.createElement('img'), { className: 'portrait small', src: CL.gfx.ui.portraitUrl(CL.gfx.ui.lordLook(c, pid), 64, { helm: false }), alt: '' }));
    const h = CL.houses?.houseOf(c, pid);
    const arms = h && CL.gfx.ui.houseArms(c, h);
    if (arms) box.append(armsPic(arms, h));
    return box;
  }
  /** A house's shield as a small image. */
  function armsPic(arms, h, size = 26) {
    const img = Object.assign(document.createElement('img'), { className: 'arms', alt: '', src: CL.gfx.ui.url(`arms|${arms.house}|${arms.device}|${arms.trim}|${arms.color}`, size, size + 4, (x) => CL.gfx.ui.arms(x, size / 2, size / 2 + 1, size * 0.4, arms)) });
    img.dataset.house = h.id;
    img.title = CL.houses.name(h);
    return img;
  }

  function renderRealm() {
    const c = CL.campaign;
    const R = CL.realm;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const S = (id) => CL.content.get('settlements', id);
    const tab = ['lords', 'allegiance', 'fief', 'diplomacy', 'rule'].includes(CL.game.realmTab) ? CL.game.realmTab : 'holdings';
    const tabs = el('div', 'row realmTabs');
    for (const [id, label] of [
      ['holdings', 'Holdings'],
      ['lords', 'Lords'],
      ['allegiance', 'Allegiance'],
      ['fief', CL.realm.fiefsOf('player', c).length || !CL.claims?.mine(c).length ? 'Fief' : 'Claims'], // P8-08: landless with claims
      ['diplomacy', 'Diplomacy'], // P9-02
      ['rule', 'Your realm'], // P9-03
    ]) {
      const b = el('button', id === tab ? 'on' : '', label);
      b.type = 'button';
      b.dataset.tab = id;
      b.setAttribute('aria-pressed', String(id === tab));
      b.onclick = () => {
        CL.game.realmTab = id;
        renderRealm();
        CL.tips?.check('realm'); // P9-02: the Diplomacy tab's first-time tip
      };
      tabs.append(b);
    }
    const cards = [];
    if (tab === 'fief') {
      $('#realmScreen').replaceChildren(tabs, ...fiefCards(c));
      return;
    }
    if (tab === 'rule') {
      $('#realmScreen').replaceChildren(tabs, ...ruleCards(c, () => renderRealm()), ...(CL.founding?.mine(c) ? armyCards(c, () => renderRealm(), { ruling: true }) : []));
      return;
    }
    if (tab === 'diplomacy') {
      // P9-02: each pair of realms, at peace, in tension or at war, their treaties and trust.
      const pairs = CL.diplomacy.pairLines(c).map((p) => {
        const card = el('div', 'contractCard realmCard diplomacyCard');
        card.dataset.pair = p.pair;
        card.append(el('h3', '', p.title), ...p.lines.map((l) => el('p', '', l)));
        return card;
      });
      $('#realmScreen').replaceChildren(tabs, ...pairs);
      return;
    }
    if (tab === 'allegiance') {
      // P8-04: what you are, its term or service, what is owed, and leaving, each with its preview.
      const s = CL.allegiance.summary(c);
      const me = el('div', 'contractCard realmCard');
      me.dataset.realm = 'you';
      me.append(el('h3', '', s.title), ...s.lines.map((l) => el('p', '', l)));
      const a = CL.allegiance.state(c);
      const redo = () => renderRealm();
      const leave = [];
      if (a.kind === 'mercenary') leave.push(allegianceCard(c, 'release', a.realm, 'Leave their service', 'Leave now', redo));
      if (a.kind === 'vassal') {
        leave.push(allegianceCard(c, 'release', a.realm, 'Ask for release', 'Ask for release', redo));
        leave.push(allegianceCard(c, 'defect', a.realm, 'Break your oath', 'Defect', redo));
      }
      $('#realmScreen').replaceChildren(tabs, me, ...leave, ...armyCards(c, redo), ...risingCards(c, redo));
      return;
    }
    for (const f of R.realms()) {
      const card = el('div', 'contractCard realmCard');
      card.dataset.realm = f.id;
      card.append(el('h3', '', `${f.name} · ${R.titled(R.rulerOf(f.id, c), c)}`));
      if (tab === 'holdings') {
        // P9-01: its treasury and trend, its laws, its offices.
        for (const line of CL.crowns?.cardLines(c, f.id) || []) card.append(el('p', 'realmCrown', line));
        const reb = CL.rebellion?.active(c, f.id);
        if (reb && reb.warned >= 1) card.append(el('p', 'realmCrown', CL.rebellion.line(c, reb))); // P9-04: what the court hears
        const army = CL.armies?.ofRealm(c, f.id);
        if (army) card.append(el('p', 'realmCrown', CL.armies.line(c, army))); // P9-05: its army in the field
        const list = el('ul', 'realmList');
        const ids = Object.keys(c.holdings).filter((sid) => c.holdings[sid].sovereign === f.id);
        const order = { town: 0, fort: 1, village: 2 };
        ids.sort((a, b) => order[c.holdings[a].kind] - order[c.holdings[b].kind] || S(a).name.localeCompare(S(b).name));
        for (const sid of ids) list.append(el('li', '', R.holdingLine(sid, c)));
        card.append(list);
      } else {
        // P8-07: each lord with what they hold, their kin, friends and rivals, their top need, where they
        // are, and what they think of you; Ask… opens the request card at the top.
        const list = el('ul', 'realmList lordList');
        for (const p of Object.values(c.people).filter((x) => x.realm === f.id)) {
          const li = el('li', 'lordRow');
          li.dataset.person = p.id;
          const [first, ...rest] = CL.nobles.lordLines(c, p.id);
          li.append(lordPics(c, p.id), el('b', '', first), ...rest.map((l) => el('span', 'lordLine', l)));
          if (!R.rules(p.id, c) && p.status !== 'dead') {
            const b = el('button', 'lordAskBtn', 'Ask…');
            b.type = 'button';
            b.onclick = () => {
              CL.game.realmLord = p.id;
              CL.game.lordAnswer = null;
              renderRealm();
              $('#realmScreen').scrollTop = 0;
            };
            li.append(b);
          }
          list.append(li);
        }
        card.append(list);
      }
      cards.push(card);
    }
    const free = R.kingdoms().filter((f) => f.freeCity);
    const note = free.length ? el('p', 'realmNote', `${free.map((f) => f.name).join(', ')}: ${free.length > 1 ? 'free cities' : 'a free city'}, with no lords and no fiefs.`) : null;
    const top = tab === 'lords' ? lordsTop(c) : [];
    $('#realmScreen').replaceChildren(tabs, ...top, ...cards, ...(note ? [note] : []));
  }

  /**
   * P9-06: your house at the top of the Lords tab: its line and name; your spouse, with their orders
   * (ride with me, run a holding, end the marriage, a ransom); petitions for restoration.
   */
  function houseCards(c, redo) {
    const H = CL.houses;
    const h = H?.mine(c);
    if (!h) return [];
    const R = CL.realm;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const say = (fn) => () => {
      const r = fn();
      const t = r?.text || r?.why || r?.line;
      if (t) CL.ui.message(t);
      if (r?.ok) CL.save.write();
      redo();
    };
    const buttons = [];
    const sp = H.spouseOf(c);
    const lines = [H.line(c, h)];
    if (sp) {
      lines.push(`You are married to ${R.titled(sp, c)}, since day ${CL.party.dayNumber(c.people[sp].married ?? c.day)}.`);
      if (c.people[sp].status === 'captive') buttons.push([`Ransom them (${H.RULES.ransom} crowns)`, say(() => H.ransomSpouse(c))]);
      else {
        buttons.push(['Ride with me', say(() => H.askSpouse(c, 'ride'))]);
        const fief = R.fiefsOf('player', c)[0];
        if (fief) buttons.push([`Run ${CL.content.get('settlements', fief).name}`, say(() => H.askSpouse(c, 'run', fief))]);
      }
      buttons.push(['End the marriage', say(() => H.end(c, 'player'))]);
    } else lines.push('Unmarried. Ask a lord of another house on the Lords tab: Ask…, then Propose marriage.');
    for (const sid of H.restorable(c, 'player').slice(0, 2)) buttons.push([`Petition for ${CL.content.get('settlements', sid).name}`, say(() => H.petition(c, 'player', sid))]);
    const card = contractCard(H.name(h), lines, buttons);
    card.classList.add('houseCard');
    const myArms = CL.gfx.ui.houseArms(c, h);
    if (myArms) card.querySelector('h3').prepend(armsPic(myArms, h, 30)); // P10-G5: your house's arms
    card.dataset.house = h.id;
    // Its name: yours to choose.
    const row = el('div', 'row');
    const input = Object.assign(el('input', ''), { value: h.name, maxLength: 24 });
    input.setAttribute('aria-label', 'Your house’s name');
    const save = el('button', '', 'Rename');
    save.type = 'button';
    save.onclick = say(() => (H.rename(c, input.value) ? { ok: true, text: `Your house is ${H.name(h)} now.` } : { why: 'Give it a name' }));
    row.append(input, save);
    card.append(row);
    return [card];
  }

  /**
   * P8-07: the top of the Lords tab: the open petition (Accept or Decline), and the lord you chose to
   * ask (four requests, each with why not; the answer with its reasons, and Pay for a price).
   */
  function lordsTop(c) {
    const N = CL.nobles;
    const R = CL.realm;
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const out = [];
    const redo = () => renderRealm();
    const btn = (label, fn, disabled = false, title = '') => {
      const b = el('button', '', label);
      Object.assign(b, { type: 'button', disabled, title });
      b.onclick = fn;
      return b;
    };
    const x = N.petition(c);
    if (x) {
      const card = el('div', 'contractCard petitionCard');
      card.dataset.petition = x.kind;
      card.append(el('h3', '', `A petition from ${R.titled(x.lord, c)}`), el('p', '', `${N.petitionText(c, x)}.`.replace(/^./, (m) => m.toUpperCase())));
      card.append(el('p', '', x.accepted ? `You have promised it: by day ${CL.party.dayNumber(x.until)}.` : `Answer by day ${CL.party.dayNumber(x.until)}.`));
      if (CL.game.petitionNote) card.append(el('p', 'petitionNote', CL.game.petitionNote));
      if (!x.accepted) {
        const row = el('div', 'row');
        const go = (choice) => () => {
          const r = N.answerPetition(c, choice);
          CL.game.petitionNote = r.ok ? null : r.text;
          if (r.ok) CL.ui.message(r.text);
          CL.save.write();
          redo();
        };
        const accept = btn('Accept', go('accept'));
        accept.id = 'petitionAccept';
        const decline = btn('Decline', go('decline'));
        decline.id = 'petitionDecline';
        row.append(accept, decline);
        card.append(row);
      }
      out.push(card);
    }
    out.push(...houseCards(c, redo));
    const pid = CL.game.realmLord;
    if (!pid || !c.people[pid] || R.rules(pid, c)) return out;
    const card = el('div', 'contractCard lordAskCard');
    card.dataset.person = pid;
    card.append(el('h3', '', `Ask ${R.titled(pid, c)}`), ...N.lordLines(c, pid).slice(1).map((l) => el('p', '', l)));
    const can = N.askable(c, pid);
    const labels = { siege: 'Join my siege', relief: 'Relieve my fort', ride: 'Ride with me', back: 'Back my claim' };
    const row = el('div', 'row');
    for (const kind of ['siege', 'relief', 'ride', 'back']) {
      const b = btn(
        labels[kind],
        () => {
          CL.game.lordAnswer = { pid, ...N.ask(c, pid, kind) };
          CL.save.write();
          redo();
          ($('#realmScreen .lordAnswer') || $('#realmScreen .lordAskCard .lordWhyNot'))?.scrollIntoView({ block: 'nearest' }); // the answer, in sight on a phone
        },
        !can[kind].ok,
        can[kind].why,
      );
      b.dataset.ask = kind;
      row.append(b);
    }
    card.append(row);
    // P9-06: a marriage, proposed by you (with a dowry, if you will); answered by the same model.
    if (CL.houses) {
      const may = CL.houses.canMarry(c, 'player', pid);
      const wed = el('div', 'row lordMarry');
      for (const dowry of [0, 200]) {
        const b = btn(
          dowry ? `Propose, with ${dowry} crowns` : 'Propose marriage',
          () => {
            CL.game.lordAnswer = { pid, offered: dowry, ...CL.houses.propose(c, 'player', pid, { dowry }) };
            CL.save.write();
            redo();
            $('#realmScreen .lordAnswer')?.scrollIntoView({ block: 'nearest' });
          },
          !may.ok,
          may.why,
        );
        b.dataset.ask = dowry ? 'marryDowry' : 'marry';
        wed.append(b);
      }
      card.append(wed);
    }
    const why = Object.values(can).find((k) => !k.ok && k.why)?.why;
    if (why && !Object.values(can).some((k) => k.ok)) card.append(el('p', 'lordWhyNot', `${why}.`));
    // A price named earlier and not yet paid stays open until the lord's answer runs out.
    const open = N.state(c).asks[pid];
    const r = CL.game.lordAnswer?.pid === pid ? CL.game.lordAnswer : open?.price && !open.paid && c.day < open.until ? { pid, answer: 'negotiate', price: open.price, words: `${R.titled(pid, c)} will, for ${open.price} crowns (until day ${CL.party.dayNumber(open.until)}).`, line: '' } : null;
    if (r && r.pid === pid && r.answer) {
      const ans = el('div', 'lordAnswer');
      ans.dataset.answer = r.answer;
      ans.append(el('b', '', r.words), ...(r.line ? [el('p', '', r.line)] : []));
      const a = N.state(c).asks[pid];
      if (r.answer === 'negotiate' && r.price && a && !a.paid) {
        const pay = btn(`Pay ${r.price} crowns`, () => {
          const done = N.pay(c, pid);
          if (done?.ok) CL.ui.message(done.text);
          else if (done) CL.ui.message(done.why);
          CL.game.lordAnswer = null;
          CL.save.write();
          redo();
        });
        pay.id = 'lordPay';
        ans.append(pay);
      } else if (r.answer === 'negotiate' && r.favour) ans.append(el('p', '', 'Their petition is open above.'));
      else if (r.answer === 'negotiate' && r.dowry && CL.houses) {
        // P9-06: the dowry that would do it, offered in one tap.
        const n = r.dowry + (r.offered || 0);
        const again = btn(`Propose, with ${n} crowns`, () => {
          CL.game.lordAnswer = { pid, offered: n, ...CL.houses.propose(c, 'player', pid, { dowry: n }) };
          CL.save.write();
          redo();
        });
        again.dataset.ask = 'marryAgain';
        ans.append(again);
      }
      card.append(ans);
    } else if (r && r.pid === pid && r.why) card.append(el('p', 'lordWhyNot', `${r.why}.`));
    const close = btn('Close', () => {
      CL.game.realmLord = null;
      CL.game.lordAnswer = null;
      redo();
    });
    close.id = 'lordAskClose';
    card.append(close);
    out.push(card);
    return out;
  }

  function closeJournal() {
    if (CL.game.journalReturn === 'map') changeMode('map');
    else CL.town.backToPlace();
  }

  function renderJournal() {
    const rows = CL.story.journal();
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    // Regional news (GDD §12): the latest bulletins, newest first.
    const news = CL.news.recent();
    const newsCard = el('div', 'newsCard');
    newsCard.append(el('h3', '', 'Regional news'));
    if (news.length) {
      const ul = el('ul');
      for (const n of news) {
        const li = el('li');
        li.append(el('span', 'day', `Day ${CL.party.dayNumber(n.day)}`), document.createTextNode(n.text));
        ul.append(li);
      }
      newsCard.append(ul);
    } else newsCard.append(el('p', '', 'No news yet. Word travels every couple of days.'));
    // The company chronicle (V2-10): the company's own history, newest first, beside the news.
    const chronCard = el('div', 'newsCard chronicleCard');
    chronCard.append(el('h3', '', 'Company chronicle'));
    const cl = el('ul');
    for (const e of CL.chronicle.recent(CL.campaign, 15)) {
      const li = el('li');
      li.append(el('span', 'day', `Day ${CL.party.dayNumber(e.day)}`), document.createTextNode(CL.chronicle.text(e)));
      cl.append(li);
    }
    chronCard.append(cl);
    // World events the company knows of first-hand (P7-08): where, what, and how long they have.
    const known = CL.happenings.journal();
    const eventsCard = el('div', 'newsCard happeningsCard');
    if (known.length) {
      eventsCard.append(el('h3', '', 'Happenings'));
      const ul = el('ul');
      for (const k of known) {
        const li = el('li');
        li.append(el('b', '', `${k.title} (${k.left}). `), document.createTextNode(`${k.text} `), el('i', '', k.ignored));
        ul.append(li);
      }
      eventsCard.append(ul);
    }
    const extra = known.length ? [eventsCard] : [];
    // The Realm screen (P8-02): who holds what, and the lords.
    const realmRow = el('div', 'row journalRealm');
    const realmBtn = el('button', '', 'The Realms: who holds what');
    realmBtn.type = 'button';
    realmBtn.id = 'journalRealmBtn';
    realmBtn.onclick = openRealm;
    realmRow.append(realmBtn);
    if (!rows.length) {
      $('#journalScreen').replaceChildren(realmRow, el('p', '', CL.world.map().sandbox ? 'No story in this world: take contracts, serve a realm or found your own.' : 'No quests yet. People in Stonebridge may have work for a stranger — try the Elder.'), ...extra, chronCard, newsCard);
      return;
    }
    const label = { active: 'In progress', done: 'Complete', failed: 'Failed' };
    $('#journalScreen').replaceChildren(
      realmRow,
      ...rows.map((r) => {
        const card = el('div', `questCard ${r.status}`);
        card.append(el('h3', '', `${r.title}${r.side ? ' (errand)' : ''} — ${label[r.status]}`));
        if (r.summary) card.append(el('p', '', r.summary));
        if (r.objective) card.append(el('p', 'objective', `▸ ${r.objective}`));
        if (r.notes.length) {
          const ul = el('ul');
          for (const n of r.notes) ul.append(el('li', '', n));
          card.append(ul);
        }
        return card;
      }),
      ...extra,
      chronCard,
      newsCard,
    );
  }

  // ---- Settings panel (GDD screen 12) ----

  let settingsPaused = false;

  function openSettings() {
    const s = CL.settings.all();
    $('#setMusic').value = String(s.music);
    $('#setSfx').value = String(s.sfx);
    $('#setTextSize').value = s.textSize;
    $('#setBattleSize').value = String(s.battleSize);
    $('#setBattlefield').value = s.battlefield;
    $('#setSharpness').value = s.sharpness;
    $('#setPrepSkip').value = s.prepSkip ? 'skip' : 'prepare';
    $('#setHealthBars').checked = s.healthBars;
    $('#setReduced').checked = s.reducedEffects;
    $('#setParry').checked = s.parry; // P11-05 (D-P11j)
    $('#setAimMouse').checked = s.aimMouse; // P11-07
    $('#setAimAssist').checked = s.aimAssist; // P11-09
    $('#setGlint').checked = s.glint;
    $('#setSwitch').value = s.switchControl;
    $('#setAimTouch').checked = s.aimTouch;
    $('#setTips').checked = s.tips;
    $('#setMapSpeed').value = s.mapSpeed;
    $('#packResult').textContent = '';
    renderPacks();
    refreshFullscreen();
    showVolumes();
    // A battle waits while you change settings.
    settingsPaused = CL.game.mode === 'battle' && !CL.game.paused;
    if (settingsPaused) setPaused(true, 'settings');
    $('#settingsPanel').classList.remove('hidden');
  }

  function closeSettings() {
    $('#settingsPanel').classList.add('hidden');
    if (settingsPaused) setPaused(false, 'settings');
    settingsPaused = false;
  }

  function showVolumes() {
    $('#setMusicOut').textContent = `${$('#setMusic').value}%`;
    $('#setSfxOut').textContent = `${$('#setSfx').value}%`;
  }

  /** The full-screen row: a switch where the browser allows it, otherwise how to get there. */
  function refreshFullscreen() {
    const F = CL.fullscreen;
    const canSwitch = F.supported() && !F.installed();
    $('#setFullscreenRow').classList.toggle('hidden', !canSwitch);
    $('#setFullscreen').checked = Boolean(CL.settings.get('fullscreen'));
    $('#setFullscreenNote').textContent = F.installed()
      ? 'Running from your home screen, so there are no browser bars.'
      : canSwitch
        ? 'If you leave full screen, the next tap brings it back. For no bars at all, add Crownless to your home screen (browser menu → Add to Home screen).'
        : 'This browser can’t hide its bars for a web page. To play full screen, add Crownless to your home screen: Share → Add to Home Screen on iPhone, or the ⋮ menu → Add to Home screen on Android.';
  }

  function bindSettings() {
    $('#setFullscreen').onchange = () => {
      const on = $('#setFullscreen').checked;
      CL.settings.set('fullscreen', on);
      CL.fullscreen.setWanted(on);
    };
    $('#settingsBtn').onclick = openSettings;
    $('#titleSettingsBtn').onclick = openSettings;
    $('#closeSettings').onclick = closeSettings;
    $('#doneSettings').onclick = closeSettings;
    $('#setMusic').oninput = () => {
      CL.settings.set('music', Number($('#setMusic').value));
      showVolumes();
    };
    $('#setSfx').oninput = () => {
      CL.settings.set('sfx', Number($('#setSfx').value));
      showVolumes();
    };
    $('#setSfx').onchange = () => CL.audio?.play('coin'); // a sample at the new level
    $('#setTextSize').onchange = () => CL.settings.set('textSize', $('#setTextSize').value);
    $('#setBattleSize').onchange = () => CL.settings.set('battleSize', Number($('#setBattleSize').value));
    $('#setBattlefield').onchange = () => CL.settings.set('battlefield', $('#setBattlefield').value);
    $('#setSharpness').onchange = () => CL.settings.set('sharpness', $('#setSharpness').value); // P10-G1
    $('#setPrepSkip').onchange = () => CL.settings.set('prepSkip', $('#setPrepSkip').value === 'skip');
    $('#setHealthBars').onchange = () => CL.settings.set('healthBars', $('#setHealthBars').checked);
    $('#setReduced').onchange = () => CL.settings.set('reducedEffects', $('#setReduced').checked);
    $('#setParry').onchange = () => CL.settings.set('parry', $('#setParry').checked);
    $('#setAimMouse').onchange = () => CL.settings.set('aimMouse', $('#setAimMouse').checked);
    $('#setAimAssist').onchange = () => CL.settings.set('aimAssist', $('#setAimAssist').checked); // P11-09
    $('#setGlint').onchange = () => CL.settings.set('glint', $('#setGlint').checked);
    $('#setSwitch').onchange = () => {
      CL.settings.set('switchControl', $('#setSwitch').value);
      if (CL.game.mode === 'battle') gearButtons();
    };
    $('#setAimTouch').onchange = () => CL.settings.set('aimTouch', $('#setAimTouch').checked);
    // P9-07: content packs (js/packs.js), kept in this browser.
    $('#packImportBtn').onclick = () => $('#packFile').click();
    $('#packFile').onchange = async () => {
      const f = $('#packFile').files?.[0];
      $('#packFile').value = '';
      if (!f) return;
      if (f.size > CL.packs.LIMIT) return packResult([`${f.name}: ${Math.ceil(f.size / 1024)} KB is over the 2 MB a pack may be`]);
      const r = await CL.packs.importText(await f.text(), f.name);
      packResult(r.ok ? [] : r.errors, r.ok ? `${f.name} is kept in this browser. Turn it on below; it takes effect on a new game or a reload.` : '');
      renderPacks();
    };
  }

  /** What an import said: the first problems, each naming the file, the entry and what is wrong. */
  function packResult(errors, ok = '') {
    const box = $('#packResult');
    box.textContent = '';
    if (ok) box.textContent = ok;
    else {
      box.append(el('b', { textContent: 'Not imported:' }), el('ul', {}, ...errors.slice(0, 8).map((e) => el('li', { textContent: e }))));
      if (errors.length > 8) box.append(`and ${errors.length - 8} more.`);
    }
  }

  /** The packs kept in this browser, each with on and off, and Remove. */
  async function renderPacks() {
    const box = $('#packList');
    let rows = [];
    try {
      rows = await CL.packs.list();
    } catch (e) {
      box.textContent = `Packs can't be kept in this browser (${String(e.message || e)}).`;
      return;
    }
    const playing = CL.packs.applied().map((p) => p.id);
    box.textContent = rows.length ? '' : 'No packs yet. A pack is a .json file in the world format.';
    for (const r of rows) {
      const on = el('input', { type: 'checkbox', checked: r.on });
      on.setAttribute('aria-label', `${r.title} on`);
      on.onchange = () => {
        CL.packs.setOn(r.id, on.checked);
        renderPacks();
      };
      const now = playing.includes(r.id) ? 'in this game' : r.on ? 'on from the next new game or reload' : 'off';
      const remove = el('button', { textContent: 'Remove' });
      remove.onclick = async () => {
        await CL.packs.remove(r.id);
        renderPacks();
      };
      const row = el('div', { className: 'packRow' }, el('label', { className: 'setCheck' }, on), el('span', { className: 'packName' }, el('b', { textContent: r.title }), ' ', el('small', { textContent: `${r.version} · ${r.author} · ${now}` })), remove);
      row.dataset.pack = r.id;
      box.append(row);
    }
  }

  // ---- First-time tips and How to play (Gate E tutorial; data/help.js) ----

  function showTip(t) {
    // P10-07: a guide step says it is one (not its number: some steps never come for some starts),
    // and the whole guide can be skipped.
    $('#tipTitle').textContent = t.guide ? `${t.title} · guide` : t.title;
    $('#tipSkip').classList.toggle('hidden', !t.guide);
    $('#tipText').textContent = t.text;
    $('#tipMore').dataset.topic = t.help;
    $('#tipCard').classList.remove('hidden');
  }

  function hideTip() {
    $('#tipCard').classList.add('hidden');
    CL.tips?.dismiss();
  }

  const STAGE_NAMES = { captain: 'As a captain', vassal: 'As a vassal', lord: 'As a lord', ruler: 'As a ruler', other: 'And more' };

  function openHelp(topic) {
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    // P10-07: How to Play by stage; yours first, its first topic open (unless a tip asked for one).
    const playing = Boolean(CL.campaign?.character);
    const mine = playing ? CL.tips.stage(CL.campaign) : 'captain';
    const stages = [mine, ...CL.tips.STAGES.filter((x) => x !== mine), 'other'];
    const byOrder = Object.values(CL.content.table('help_topics')).sort((a, b) => a.order - b.order);
    const topics = stages.flatMap((st) => byOrder.filter((h) => (h.stage || 'other') === st));
    const first = topic || topics[0]?.id || 'start';
    let shown = null;
    $('#helpTopics').replaceChildren(
      ...topics.flatMap((h) => {
        const st = h.stage || 'other';
        const head = st !== shown ? [el('h3', 'setH helpStage', `${STAGE_NAMES[st]}${playing && st === mine ? ' (you)' : ''}`)] : [];
        shown = st;
        const d = el('details', 'helpTopic');
        d.open = h.id === first;
        d.append(el('summary', '', h.title), ...h.body.map((p) => el('p', '', p)));
        for (const s of h.sections || []) d.append(el('h4', 'helpSection', s.title), ...s.body.map((p) => el('p', '', p))); // P11-09: a topic by stage
        if (h.controls?.length) {
          const table = el('table', 'helpKeys');
          const head = el('tr');
          for (const c of ['Touch', 'Keyboard / mouse', '']) head.append(el('th', '', c));
          table.append(head);
          for (const row of h.controls) {
            const tr = el('tr');
            for (const c of row) tr.append(el('td', '', c));
            table.append(tr);
          }
          d.append(table);
        }
        return [...head, d];
      }),
    );
    if (!$('#settingsPanel').classList.contains('hidden')) $('#settingsPanel').classList.add('hidden');
    // A battle waits while you read.
    helpPaused = CL.game.mode === 'battle' && !CL.game.paused;
    if (helpPaused) setPaused(true, 'help');
    $('#helpPanel').classList.remove('hidden');
    // Start at the chosen topic, not wherever the panel was last scrolled to.
    const open = $('#helpTopics .helpTopic[open]');
    $('#helpPanel').scrollTop = open && topic && topic !== topics[0]?.id ? open.offsetTop - 8 : 0;
  }

  let helpPaused = false;

  function closeHelp() {
    $('#helpPanel').classList.add('hidden');
    if (helpPaused) setPaused(false, 'help');
    helpPaused = false;
  }

  function bindHelp() {
    $('#tipOk').onclick = hideTip;
    $('#tipSkip').onclick = () => {
      CL.tips.skipGuide();
      $('#tipCard').classList.add('hidden');
      message('Guide skipped. Hints still show the first time something comes up.');
    };
    $('#tipMore').onclick = () => {
      const topic = $('#tipMore').dataset.topic;
      hideTip();
      openHelp(topic);
    };
    $('#titleHelpBtn').onclick = () => openHelp(); // P10-07: at your stage
    $('#settingsHelp').onclick = () => {
      closeSettings();
      openHelp();
    };
    $('#closeHelp').onclick = closeHelp;
    $('#doneHelp').onclick = closeHelp;
    $('#setTips').onchange = () => CL.settings.set('tips', $('#setTips').checked);
    $('#setMapSpeed').onchange = () => {
      CL.settings.set('mapSpeed', $('#setMapSpeed').value);
      refreshSpeed();
    };
    bindWait();
    $('#resetTips').onclick = () => {
      CL.tips.reset();
      CL.settings.set('tips', true);
      $('#setTips').checked = true;
      message('The guide and hints will show again.');
    };
  }

  /** Another tab took over the save: say so plainly, once. */
  function showStale() {
    message('This game is open in another tab, so this one has stopped saving. Reload to carry on here.');
    if (CL.game.mode === 'saves') renderSaves();
  }

  CL.ui = {
    gearButtons, // P11-02
    refreshFullscreen,
    showStale,
    showTip,
    hideTip,
    openHelp,
    closeHelp,
    bindHelp,
    fitHud,
    applyTextScale,
    font: (px, opts) => CL.settings.font(px, opts),
    openSettings,
    closeSettings,
    bindSettings,
    showEnding,
    closeEnding,
    talkTo,
    openJournal,
    closeJournal,
    openRealm,
    closeRealm,
    openRansom,
    openGrant,
    openConquest,
    openSiegeAlarm,
    openWait,
    confirmWait,
    setWaitPick,
    setFade,
    toggleSpeed,
    refreshSpeed,
    $,
    message,
    changeMode,
    refresh,
    refreshRoster,
    supplyParts,
    creatorChoices,
    openSheet,
    openSaves,
    renderSaves,
    importDone,
    hideBattleOverlays,
    showSelectedGroup,
    groupStates: () => {
      if (!$('#ordersPanel').classList.contains('hidden')) showSelectedGroup(CL.game.group);
    },
    showOverview,
    prepareBattle,
    renderPrep,
    setPaused,
    togglePause,
    autoPause,
    showRotatePrompt,
    report,
    download,
    renderDebug,
    isDebugOpen,
    toggleDebug,
  };
})(typeof window !== 'undefined' ? window : globalThis);
