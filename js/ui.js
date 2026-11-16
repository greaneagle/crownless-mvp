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
      return { title: 'QUEST JOURNAL', text: '', button: 'Back' };
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
    CL.diag.log('info', text);
  }

  function changeMode(mode) {
    const g = CL.game;
    g.mode = mode;
    $('#stage').dataset.mode = mode;
    $('#attackBtn').textContent = mode === 'town' ? 'TALK' : 'ATTACK';
    $('#ordersPanel').classList.add('hidden');
    if (mode === 'map' || mode === 'town') {
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
        } else CL.town.backToPlace();
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
      opt('Review my troops', () => openSheet(), false, `${c.roster.length}/${P.partyCap()} soldiers`);
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
    const after = (fn) => () => {
      const r = fn();
      if (r?.ok === false) message(r.reason);
      CL.save.write();
      renderContracts();
    };
    if (k) {
      const t = CL.content.get('contracts', k.template);
      const giver = CL.content.get('settlements', k.giver).name;
      const reward = `Reward: ${k.reward.gold} crowns · +${k.reward.renown} renown · +${k.reward.xp} XP`;
      if (k.status === 'done') {
        const here = sid === k.giver;
        cards.push(
          contractCard(`${t.name} — complete`, [here ? 'The band is broken. Your employer counts out your pay.' : `Return to ${giver} to collect.`, reward], [
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
        const left = K.daysLeft(c);
        cards.push(
          contractCard(
            `${t.name} — for ${giver}`,
            [
              `Destroy the marked band (${describeTroops(k.troops)}). It is camped about ${Math.round(CL.world.mapDist(CL.content.get('settlements', k.giver).mapX, CL.content.get('settlements', k.giver).mapY, k.x, k.y))} leagues from ${giver}.`,
              `Time left: ${left.toFixed(1)} days.`,
              reward,
            ],
            [['Abandon (−2 renown)', after(() => K.abandon(c))]],
          ),
        );
      }
    }
    const offer = K.offerAt(c, sid);
    if (offer && !k) {
      const t = CL.content.get('contracts', offer.template);
      cards.push(
        contractCard(
          `Offer: ${t.name}`,
          [
            t.offer,
            `Target: ${describeTroops(offer.troops)}. Time limit: ${offer.days} days.`,
            `Reward: ${offer.reward.gold} crowns · +${offer.reward.renown} renown · +${offer.reward.xp} XP`,
          ],
          [['Accept contract', after(() => K.accept(c, sid))]],
        ),
      );
    } else if (offer && k) {
      cards.push(contractCard('More work posted', ['Finish your current contract before taking another.'], []));
    } else if (!CL.realm.welcomes(c, sid)) {
      const f = CL.content.get('factions', CL.realm.owner(sid, c));
      cards.push(
        contractCard('No work for enemies', [`The ${f.name} count you Hostile and post nothing for you. Win back their favour by fighting Road Reavers on their land.`], []),
      );
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
      buttons.push(choice('Attack', 'Fight the battle yourself', () => P.attack()));
      buttons.push(choice('Auto-resolve', `About ${odds}% to win`, () => P.autoResolve()));
      const n = P.negotiation(c, e);
      if (n?.kind === 'intimidate') buttons.push(choice('Intimidate', 'They are badly outmatched', () => P.negotiate()));
      else if (n) buttons.push(choice(`Pay ${n.cost} crowns`, 'They let you pass', () => P.negotiate(), c.gold < n.cost));
      const r = P.retreatChance(c, e);
      if (r != null) buttons.push(choice('Retreat', `${Math.round(r * 100)}% to get away`, () => P.retreat()));
      else buttons.push(choice('Leave', 'Come back another time', () => changeMode('map')));
    } else {
      // A kingdom's patrol or caravan: you may still fall on them, at a price (GDD §10).
      const f = e.kind === 'party' && e.t.faction && e.t.kind !== 'bandit' ? CL.content.get('factions', e.t.faction) : null;
      buttons.push(choice('Leave', 'Go on your way', () => changeMode('map')));
      if (f) {
        const odds = Math.round(A.winChance(A.playerPower(c), A.troopsPower(e.troops)) * 100);
        const cost = `−${-CL.realm.REP.attack} reputation with the ${f.name}`;
        buttons.push(choice('Attack them', cost, () => P.attack()));
        buttons.push(choice('Attack (auto-resolve)', `About ${odds}% to win · ${cost}`, () => P.autoResolve()));
      }
    }
    box.replaceChildren(...buttons);
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
        `Party size ${c.roster.length}/${cap} (8 + 2×Leadership ${lead} + Renown ${c.renown}/40${CL.realm.capBonus(c) ? ` + ${CL.realm.capBonus(c)} Friendly` : ''}${cap === 20 ? ', max 20' : ''})`,
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

  /** Troops grouped by type, with XP progress and upgrade buttons (GDD §7). */
  function renderTroops() {
    const c = CL.campaign;
    const P = CL.party;
    const groups = {};
    for (const s of c.roster) {
      groups[s.troop] ||= [];
      groups[s.troop].push(s);
    }
    const rows = Object.entries(groups).map(([id, list]) => {
      const t = CL.content.troop(id);
      const need = P.UPGRADE_XP[t.tier];
      const ready = list.filter(P.readyFor).length;
      const wounded = list.filter((s) => s.woundedUntil !== null).length;
      const best = Math.max(...list.map((s) => s.xp));
      const row = Object.assign(document.createElement('div'), { className: 'troopRow' });
      const info = need
        ? `${list.length}× ${t.name} (${t.tier} ${t.role})${wounded ? ` · ${wounded} wounded` : ''} · best XP ${best}/${need}${ready ? ` · ${ready} ready` : ''}`
        : `${list.length}× ${t.name} (${t.tier} ${t.role})${wounded ? ` · ${wounded} wounded` : ''} · top tier`;
      row.append(Object.assign(document.createElement('span'), { textContent: info }));
      for (const o of P.upgradeOptions(id)) {
        const to = CL.content.troop(o.to);
        const b = Object.assign(document.createElement('button'), { type: 'button' });
        b.textContent = o.locked ? `→ ${to.name}: ${o.locked}` : `→ ${to.name} · ${o.cost} each`;
        b.disabled = Boolean(o.locked) || !ready || c.gold < o.cost;
        b.onclick = () => {
          const n = P.upgrade(id, o.to);
          if (n) {
            CL.save.write();
            message(`Upgraded ${n} ${plural(t.name, n)} to ${plural(to.name, n)}`);
          }
          renderSheet();
        };
        row.append(b);
      }
      return row;
    });
    $('#sheetTroops').replaceChildren(
      ...(rows.length ? rows : [Object.assign(document.createElement('p'), { textContent: 'No soldiers yet. Hire some in a town.' })]),
    );
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
      `${c.roster.length}/${p.partyCap()} soldiers · ${c.victories} wins`;

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
    // People to talk to at menu-only settlements (dialogues with a place).
    $('#peopleHere').replaceChildren(
      ...CL.story.peopleAt(c.world.location, c).map((t) => {
        const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `Talk to ${t.speaker}` });
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
    $('#attackBtn').textContent = 'ATTACK';
    $('#blockBtn').disabled = CL.game.hero?.canBlock === false; // no shield, no block
    $('#overlay').classList.add('hidden');
    $('#ordersPanel').classList.add('hidden');
  }

  /** Show the selected group and highlight it plus that group's current order. */
  function showSelectedGroup(group) {
    $('#selectedGroup').textContent = { infantry: 'Infantry', archer: 'Archers', cavalry: 'Cavalry' }[group];
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
    if (!rows.length) {
      $('#journalScreen').replaceChildren(el('p', '', 'No quests yet. People in Stonebridge may have work for a stranger — try the Elder.'));
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
    );
  }

  CL.ui = {
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
