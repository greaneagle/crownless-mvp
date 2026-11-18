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
      return { title: g.result.practice.arena ? 'CAMERA TEST' : 'STRESS TEST', text: 'How this device handled the battle:', button: 'Continue' };
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
      const owner = CL.content.get('factions', holder);
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
        text: `${e.text}${them} You have ${ready} soldier${ready === 1 ? '' : 's'} fit to fight.`,
        button: null,
      };
    }
    if (mode === 'create') {
      return {
        title: g.newGame ? 'A NEW WANDERER' : 'WHO ARE YOU?',
        text: g.newGame
          ? 'You arrive outside Stonebridge with little more than a sword. Who were you before the road?'
          : 'Your party remembers your deeds, but not your name. Tell them who leads them.',
        button: 'Begin',
        secondary: g.newGame ? 'Back' : null,
      };
    }
    if (mode === 'talk') {
      const t = g.talk;
      return { title: t.npc.name.toUpperCase(), text: `“${t.line}”`, button: null };
    }
    if (mode === 'journal') {
      return { title: 'JOURNAL', text: '', button: 'Back' };
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
    if (mode === 'trade') {
      const s = CL.party.currentSettlement();
      return {
        title: `${s.name.toUpperCase()} MARKET`,
        text: 'Buy where goods are cheap, sell where they are dear. Prices move as you trade and settle back over the days.',
        button: 'Back',
      };
    }
    if (mode === 'character') {
      const ch = CL.campaign.character;
      const bg = CL.content.get('backgrounds', ch.background);
      return { title: ch.name.toUpperCase(), text: `Level ${ch.level} ${bg.name}. ${CL.world.clockLabel()}.`, button: 'Back' };
    }
    const existed = CL.save.existed;
    return {
      title: 'CROWNLESS',
      text: 'The Border March: travel between towns, hire soldiers, and break the Road Reavers who prey on the roads.',
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

  function changeMode(mode) {
    const g = CL.game;
    g.mode = mode;
    $('#stage').dataset.mode = mode;
    requestAnimationFrame(fitHud); // the top-right buttons change with the mode
    CL.audio?.onMode(mode);
    // A tip belongs to the screen it explains: a new screen closes it, then may bring its own.
    if (CL.tips?.showing()) hideTip();
    setTimeout(() => CL.tips?.check(), 400);
    if (mode === 'result') CL.audio?.play(g.result?.win ? 'win' : 'capture');
    $('#attackBtn').textContent = mode === 'town' ? 'TALK' : 'ATTACK';
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
    $('#prep').classList.toggle('hidden', mode !== 'settlement');
    $('#result').classList.toggle('hidden', mode !== 'result');
    $('#create').classList.toggle('hidden', mode !== 'create');
    $('#sheet').classList.toggle('hidden', mode !== 'character');
    $('#tradeScreen').classList.toggle('hidden', mode !== 'trade');
    $('#encounterOptions').classList.toggle('hidden', mode !== 'encounter');
    $('#contractsScreen').classList.toggle('hidden', mode !== 'contracts');
    $('#journalScreen').classList.toggle('hidden', mode !== 'journal');
    $('#savesScreen').classList.toggle('hidden', mode !== 'saves');
    $('#talkOptions').classList.toggle('hidden', mode !== 'talk');
    $('#titleExtras').classList.toggle('hidden', mode !== 'title');
    $('#overlayText').classList.toggle('hidden', mode === 'saves' || mode === 'journal');
    const screen = screenFor(mode);
    if (mode === 'result') $('#result').innerHTML = g.result.html;
    $('#overlayTitle').textContent = screen.title;
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
    if (mode === 'saves') renderSaves();
    if (mode === 'talk') renderTalk();
    if (mode === 'journal') renderJournal();
  }

  // ---- Talking to people in town (GDD §8: interaction opens dialogue menus) ----

  function renderTalk() {
    const c = CL.campaign;
    const P = CL.party;
    const U = CL.upkeep;
    const n = CL.game.talk.npc;
    const opts = [];
    const opt = (label, onClick, disabled = false, note = '') => {
      const b = Object.assign(document.createElement('button'), { type: 'button', disabled });
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
        opt(`Hire a ${t.name} · ${t.recruitCost} crowns`, () => P.recruit(id) && redo(), !P.canRecruit(c, id), `${t.tier} ${t.role} · wage ${t.wage}/week`);
      }
      opt('Review my troops', () => openSheet(), false, `${c.roster.length + CL.companion.slots(c)}/${P.partyCap()} in the company`);
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
      opt('Save & export', () => openSaves());
    }
    opt('Goodbye', () => CL.town.backToPlace());
    $('#talkOptions').replaceChildren(...opts);
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
    const fill = (text, o) => text.replace('{giver}', name(o.giver)).replace('{to}', o.to ? name(o.to) : '');
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
    if (!offers.length && !CL.realm.welcomes(c, sid)) {
      const f = CL.content.get('factions', CL.realm.owner(sid, c));
      cards.push(
        contractCard('No work for enemies', [`The ${f.name} count you Hostile and post nothing for you. Win back their favour by fighting Road Reavers on their land.`], []),
      );
    } else if (!offers.length) {
      cards.push(contractCard('Nothing posted', ['The board is bare for now. New work goes up every few days.'], []));
    }
    $('#contractsScreen').replaceChildren(...cards);
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
    if (e.hostile) {
      const odds = Math.round(A.winChance(A.playerPower(c), A.troopsPower(e.troops)) * 100);
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
      const f = e.kind === 'party' && e.t.faction && e.t.kind !== 'bandit' && !e.party.escortTo ? CL.content.get('factions', e.t.faction) : null;
      buttons.push(choice('Leave', 'Go on your way', () => changeMode('map')));
      if (f) {
        const odds = Math.round(A.winChance(A.playerPower(c), A.troopsPower(e.troops)) * 100);
        const cost = `−${-CL.realm.REP.attack} reputation with the ${f.name}`;
        buttons.push(choice('Attack them', cost, prepareBattle));
        buttons.push(choice('Attack (auto-resolve)', `About ${odds}% to win · ${cost}`, () => P.autoResolve()));
      }
    }
    box.replaceChildren(...buttons);
  }

  // ---- Battle preparation (V2-07; js/prep.js) ----

  const PRESET_NAMES = { balanced: 'Balanced', defensive: 'Defensive', aggressive: 'Aggressive', custom: 'Custom' };
  const PRESET_ABOUT = {
    balanced: 'Infantry in front and following you, archers behind, cavalry on a flank. Archers and cavalry hold until the enemy comes close.',
    defensive: 'A tight block. Everyone holds and fights what comes to them.',
    aggressive: 'Infantry and cavalry forward and charging, archers following you.',
    custom: 'Drag the flags on the map to place each group, and choose each group’s starting order below.',
  };
  const GROUP_NAMES = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' };

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
    box.replaceChildren(
      Object.assign(document.createElement('h2'), { textContent: 'Prepare for battle' }),
      Object.assign(document.createElement('p'), { textContent: `${e.name}: ${foes} against your ${own} fit soldier${own === 1 ? '' : 's'}.${p.ambush ? ' Ambush! Little room to form up.' : ''}` }),
      actions, // first, so Fight is always in reach (two taps from the encounter)
      presets,
      Object.assign(document.createElement('p'), { className: 'setNote', textContent: PRESET_ABOUT[p.plan.preset] }),
      ...rows,
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
          Object.assign(document.createElement('b'), { textContent: `${g.icon} ${g.name}` }),
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
        return li(`${it.name}${itemSummary(it)}${vs}`, `Buy · ${price}`, () => {
          tradeAction(() => T.buyGear(c, sid, id));
          if (it.slot) message(`Bought ${it.name} — equip it from Character & gear.`);
        });
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
            ),
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
  const draft = { cloak: 'crimson', background: 'farmhand' };

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
      ...Object.values(CL.content.table('backgrounds')).map((bg) => {
        const title = Object.assign(document.createElement('b'), {
          textContent: `${bg.name} · +1 ${CL.character.ATTRIBUTE_NAMES[bg.attribute]}, +1 ${CL.content.get('skills', bg.skill).name}`,
        });
        return choiceButton(bg.name, draft.background === bg.id, () => {
          draft.background = bg.id;
          renderCreator();
        }, [title, bg.description]);
      }),
    );
    const kit = CL.content.get('backgrounds', draft.background).kit;
    const gear = Object.values(kit.equipment).map((id) => CL.content.item(id).name);
    $('#createNote').textContent = CL.game.newGame
      ? `You start with ${kit.gold} crowns, ${gear.join(', ')} and ${CL.party.describeItems(kit.items)}. No soldiers — yet.`
      : 'Your gold, soldiers and gear are kept.';
    drawPreview();
  }

  function drawPreview() {
    const cv = $('#heroPreview');
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, cv.width, cv.height);
    const sprite = CL.assets.heroSprite(CL.assets.key('u', CL.assets.heroFrames.down[0]), draft.cloak);
    if (sprite) x.drawImage(sprite, 8, 6, 56, 80);
    else setTimeout(drawPreview, 200); // sprite still loading
  }

  function creatorChoices() {
    return { name: $('#heroName').value, gender: $('#heroGender').value, cloak: draft.cloak, background: draft.background };
  }

  // ---- Character sheet ----

  function li(text, buttonLabel, onClick) {
    const row = document.createElement('li');
    row.append(Object.assign(document.createElement('span'), { textContent: text }));
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
  function renderCompanion() {
    const c = CL.campaign;
    const M = CL.companion;
    const m = M.get(c);
    $('#companionHead').classList.toggle('hidden', !m);
    $('#sheetCompanion').classList.toggle('hidden', !m);
    if (!m) return;
    const d = M.def(m.id);
    const s = M.combat(c);
    const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text || '' });
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
    const rows = [el('p', `${d.name}, ${d.title} · ${status} · HP ${s.hp} · Damage ${Math.round(s.damage * 10) / 10} · Armor ${s.armor}${bonus ? ` · ${bonus} while fit` : ''}`)];
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
    $('#sheetCompanion').replaceChildren(...rows);
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
    const levelText =
      ch.level >= C.MAX_LEVEL ? `Level ${ch.level} (max)` : `Level ${ch.level} · XP ${ch.xp}/${next}`;
    const points = [
      ch.skillPoints ? `${ch.skillPoints} skill point${ch.skillPoints > 1 ? 's' : ''} to spend` : '',
      ch.attributePoints ? `${ch.attributePoints} attribute point${ch.attributePoints > 1 ? 's' : ''} to spend` : '',
    ].filter(Boolean);
    const cap = CL.party.partyCap(c);
    const lead = C.skill('leadership', c);
    stats.replaceChildren(
      line([levelText, ...points]),
      spendLine(
        C.ATTRIBUTES.map((a) =>
          spendable(`${C.ATTRIBUTE_NAMES[a]} ${C.attribute(a)}`, ch.attributePoints > 0 && C.attribute(a) < C.MAX_ATTRIBUTE, () =>
            C.spendAttribute(a),
          ),
        ),
      ),
      line([
        `HP ${hero.hp}`,
        `Damage ${Math.round(hero.damage * 10) / 10}`,
        `Armor ${hero.armor}`,
        hero.canBlock ? 'Can block' : 'No shield — cannot block',
        `Travel ×${C.travelFactor().toFixed(2)}`,
      ]),
      spendLine(
        Object.values(CL.content.table('skills')).map((sk) =>
          spendable(`${sk.name} ${C.skill(sk.id)}`, ch.skillPoints > 0 && ch.skills[sk.id] < C.MAX_SKILL, () => C.spendSkill(sk.id)),
        ),
      ),
      line([
        `Party size ${c.roster.length + CL.companion.slots(c)}/${cap} (8 + 2×Leadership ${lead} + Renown ${c.renown}/40${CL.realm.capBonus(c) ? ` + ${CL.realm.capBonus(c)} Friendly` : ''}${cap === 20 ? ', max 20' : ''})`,
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
    $('#sheetEquip').replaceChildren(
      ...C.SLOTS.map((slot) => {
        const id = c.equipment[slot];
        const it = id ? CL.content.item(id) : null;
        return li(`${C.SLOT_NAMES[slot]}: ${it ? it.name + itemSummary(it) : '—'}`, it ? 'Remove' : null, () => {
          C.unequip(slot);
          CL.save.write();
          renderSheet();
        });
      }),
    );
    const pack = Object.entries(c.inventory);
    $('#sheetPack').replaceChildren(
      ...(pack.length
        ? pack.map(([id, n]) => {
            const it = CL.content.item(id);
            const equippable = it.slot && C.SLOTS.includes(it.slot);
            return li(`${n > 1 ? `${n}× ` : ''}${it.name}${itemSummary(it)}`, equippable ? 'Equip' : null, () => {
              C.equip(id);
              CL.save.write();
              renderSheet();
            });
          })
        : [li('Empty')]),
    );
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
    const view = ['types', 'tree'].includes(g.troopView) ? g.troopView : 'soldiers';
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
    const tabs = el('div', { className: 'viewTabs' }, tab('soldiers', 'Soldiers'), tab('types', 'By type'), tab('tree', 'Troop tree'));
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
        el('b', { textContent: s.name }),
        el('span', { textContent: `${t.name} · ${t.tier} ${t.role} · ${xpText(s)}${status}${ready}` }),
      );
    });
    $('#sheetTroops').replaceChildren(
      tabs,
      upgradeAllBlock(),
      el('label', { className: 'soldierFilter' }, 'Show ', select),
      ...(rows.length ? rows : [el('p', { textContent: 'Nobody matches.' })]),
    );
  }

  /** One soldier's profile card: who they are, their record and notes, rename and upgrade. */
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
    const portrait = s.portrait ? el('img', { className: 'portrait', src: `assets/${s.portrait}`, alt: '' }) : null;
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
      el('div', { className: 'soldierHead' }, portrait, el('div', {}, nameRow, el('p', { textContent: `${t.name} · ${t.tier} ${t.role} · ${xpText(s)}` }), el('p', { textContent: `${status} · ${culture} · ${joined}` }))),
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
      el('ul', { className: 'soldierNotes' }, ...s.notes.map((n) => el('li', { textContent: `Day ${P.dayNumber(n.day)}: ${CL.soldiers.noteText(n)}` }))),
      upgrades.length ? el('div', { className: 'soldierUpgrades' }, ...upgrades) : el('p', { className: 'muted', textContent: `${t.name} is at max tier; experience still counts toward the record.` }),
    );
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
      if (n.level === 'seen') return el('li', { className: 'treeNode seen' }, el('b', { textContent: n.name }), el('span', { className: 'muted', textContent: ' · seen, not yet known' }), kids);
      const st = n.stats;
      const company = n.count ? `In your company: ${n.count}${n.ready ? ` (${n.ready} ready)` : ''}` : 'None in your company';
      const ways = n.maxTier
        ? 'Max tier'
        : n.paths.map((p) => `→ ${CL.troopTree.level(c, p.to) ? CL.content.troop(p.to).name : '?'}: ${p.xp} XP and ${p.cost} crowns`).join(' · ');
      const list = c.roster.filter((s) => s.troop === n.id);
      return el(
        'li',
        { className: 'treeNode owned' },
        el('b', { textContent: n.name }),
        el('span', { textContent: ` · ${n.tier} ${n.role} · HP ${st.hp} · damage ${st.damage} · armour ${st.armor} · wage ${st.wage}/week` }),
        el('div', { className: 'muted', textContent: `${company} · ${ways}` }),
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
    $('#rosterSummary').textContent =
      `Day ${p.dayNumber()} · ${c.gold} crowns · ${c.renown} renown · ` +
      `${c.roster.length + CL.companion.slots(c)}/${p.partyCap()} in the company · ${c.victories} wins`;

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

    // Recruit buttons: one per troop the settlement's owner offers (hidden when none).
    const offers = p.recruitsHere();
    ['#recruitA', '#recruitB', '#recruitC'].forEach((sel, i) => {
      const b = $(sel);
      const id = offers[i];
      b.classList.toggle('hidden', !id);
      if (!id) return;
      const t = CL.content.troop(id);
      b.dataset.troop = id;
      b.textContent = `Hire ${t.name} · ${t.recruitCost} crowns`;
      b.disabled = !p.canRecruit(c, id);
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
      ...CL.story.peopleAt(c.world.location, c).map((t) => ({ id: t.id, name: t.speaker })),
    ].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
    $('#peopleHere').replaceChildren(
      ...people.map((t) => {
        const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `Talk to ${t.name}` });
        b.onclick = () => talkTo(t.id);
        return b;
      }),
    );
    const barred = !CL.realm.welcomes(c, c.world.location);
    $('#serviceNote').textContent = barred
      ? `The ${CL.content.get('factions', CL.realm.owner(c.world.location, c)).name} will not hire out soldiers or work to an enemy.`
      : offers.length
        ? ''
        : 'No one here is looking to take up arms.';
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
        wages > c.gold,
      ),
    ];
  }

  function hideBattleOverlays() {
    $('#stage').dataset.mode = 'battle';
    if (CL.tips?.showing()) hideTip();
    setTimeout(() => CL.tips?.check('battle'), 0); // at once: the first battle waits on its card (battles don't start through changeMode)
    requestAnimationFrame(fitHud);
    $('#attackBtn').textContent = 'ATTACK';
    $('#blockBtn').disabled = CL.game.hero?.canBlock === false; // no shield, no block
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

  function showSelectedGroup(group) {
    const state = CL.game.groupState?.[group]; // forming · formed · advancing · engaged (V2-08a)
    const mood = CL.morale?.word(CL.game, 'ally', group); // wavering · falling back · routing (V2-08b)
    $('#selectedGroup').textContent = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' }[group] + (state && mood !== 'routing' ? ` · ${state}` : '') + (mood ? ` · ${mood}` : '');
    const wait = CL.game.mode === 'battle' ? Math.ceil(CL.morale?.rallyIn(CL.game) || 0) : 0;
    const rb = $('#rallyBtn');
    if (rb) {
      rb.textContent = wait ? `Rally in ${wait} s` : 'R Rally';
      rb.disabled = Boolean(wait) || !CL.game.hero?.alive;
    }
    // GDD §7: unit sets without cavalry show cavalry as unavailable.
    const hasCav = CL.game.allies?.some((a) => a.role === 'cavalry' && a.alive);
    const cavBtn = document.querySelector('[data-group="cavalry"]');
    if (cavBtn) cavBtn.disabled = !hasCav;
    const current = CL.game.orders[group];
    for (const b of document.querySelectorAll('[data-group]')) b.classList.toggle('active', b.dataset.group === group);
    for (const b of document.querySelectorAll('[data-order]')) b.classList.toggle('active', b.dataset.order === current);
  }

  function setPaused(paused, reason) {
    const g = CL.game;
    if (g.mode !== 'battle' || g.paused === paused) return;
    g.paused = paused;
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
      assets: CL.diag.assets,
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
    CL.game.talk = { npc: { id: dialogueId, name: conv.speaker, action: 'talk' }, conv, line: conv.text };
    changeMode('talk');
  }

  function openJournal() {
    if (!CL.campaign.character) return;
    const m = CL.game.mode;
    CL.game.journalReturn = m === 'map' ? 'map' : 'place';
    changeMode('journal');
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
    if (!rows.length) {
      $('#journalScreen').replaceChildren(el('p', '', 'No quests yet. People in Stonebridge may have work for a stranger — try the Elder.'), newsCard);
      return;
    }
    const label = { active: 'In progress', done: 'Complete', failed: 'Failed' };
    $('#journalScreen').replaceChildren(
      ...rows.map((r) => {
        const card = el('div', `questCard ${r.status}`);
        card.append(el('h3', '', `${r.title} — ${label[r.status]}`));
        if (r.summary) card.append(el('p', '', r.summary));
        if (r.objective) card.append(el('p', 'objective', `▸ ${r.objective}`));
        if (r.notes.length) {
          const ul = el('ul');
          for (const n of r.notes) ul.append(el('li', '', n));
          card.append(ul);
        }
        return card;
      }),
      newsCard,
    );
  }

  // ---- Settings panel (GDD screen 12) ----

  let settingsPaused = false;

  function openSettings() {
    const s = CL.settings.all();
    $('#setMusic').value = String(s.music);
    $('#setSfx').value = String(s.sfx);
    $('#setBattleSize').value = String(s.battleSize);
    $('#setBattlefield').value = s.battlefield;
    $('#setPrepSkip').value = s.prepSkip ? 'skip' : 'prepare';
    $('#setHealthBars').checked = s.healthBars;
    $('#setReduced').checked = s.reducedEffects;
    $('#setTips').checked = s.tips;
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
    $('#setBattleSize').onchange = () => CL.settings.set('battleSize', Number($('#setBattleSize').value));
    $('#setBattlefield').onchange = () => CL.settings.set('battlefield', $('#setBattlefield').value);
    $('#setPrepSkip').onchange = () => CL.settings.set('prepSkip', $('#setPrepSkip').value === 'skip');
    $('#setHealthBars').onchange = () => CL.settings.set('healthBars', $('#setHealthBars').checked);
    $('#setReduced').onchange = () => CL.settings.set('reducedEffects', $('#setReduced').checked);
  }

  // ---- First-time tips and How to play (Gate E tutorial; data/help.js) ----

  function showTip(t) {
    $('#tipTitle').textContent = t.title;
    $('#tipText').textContent = t.text;
    $('#tipMore').dataset.topic = t.help;
    $('#tipCard').classList.remove('hidden');
  }

  function hideTip() {
    $('#tipCard').classList.add('hidden');
    CL.tips?.dismiss();
  }

  function openHelp(topic) {
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    const topics = Object.values(CL.content.table('help_topics')).sort((a, b) => a.order - b.order);
    $('#helpTopics').replaceChildren(
      ...topics.map((h) => {
        const d = el('details', 'helpTopic');
        d.open = h.id === (topic || 'start');
        d.append(el('summary', '', h.title), ...h.body.map((p) => el('p', '', p)));
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
        return d;
      }),
    );
    if (!$('#settingsPanel').classList.contains('hidden')) $('#settingsPanel').classList.add('hidden');
    // A battle waits while you read.
    helpPaused = CL.game.mode === 'battle' && !CL.game.paused;
    if (helpPaused) setPaused(true, 'help');
    $('#helpPanel').classList.remove('hidden');
    // Start at the chosen topic, not wherever the panel was last scrolled to.
    const open = $('#helpTopics .helpTopic[open]');
    $('#helpPanel').scrollTop = open && topic && topic !== 'start' ? open.offsetTop - 8 : 0;
  }

  let helpPaused = false;

  function closeHelp() {
    $('#helpPanel').classList.add('hidden');
    if (helpPaused) setPaused(false, 'help');
    helpPaused = false;
  }

  function bindHelp() {
    $('#tipOk').onclick = hideTip;
    $('#tipMore').onclick = () => {
      const topic = $('#tipMore').dataset.topic;
      hideTip();
      openHelp(topic);
    };
    $('#titleHelpBtn').onclick = () => openHelp('start');
    $('#settingsHelp').onclick = () => {
      closeSettings();
      openHelp('start');
    };
    $('#closeHelp').onclick = closeHelp;
    $('#doneHelp').onclick = closeHelp;
    $('#setTips').onchange = () => CL.settings.set('tips', $('#setTips').checked);
    $('#resetTips').onclick = () => {
      CL.tips.reset();
      CL.settings.set('tips', true);
      $('#setTips').checked = true;
      message('Tips will show again.');
    };
  }

  /** Another tab took over the save: say so plainly, once. */
  function showStale() {
    message('This game is open in another tab, so this one has stopped saving. Reload to carry on here.');
    if (CL.game.mode === 'saves') renderSaves();
  }

  CL.ui = {
    refreshFullscreen,
    showStale,
    showTip,
    hideTip,
    openHelp,
    closeHelp,
    bindHelp,
    fitHud,
    openSettings,
    closeSettings,
    bindSettings,
    showEnding,
    closeEnding,
    talkTo,
    openJournal,
    closeJournal,
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
