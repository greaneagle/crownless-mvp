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
          ? 'The reavers have been routed. Your surviving soldiers gather the spoils.'
          : 'Your party was broken. You were held for half a day, then released without some of your crowns and gear.',
        button: 'Continue',
      };
    }
    if (mode === 'settlement') {
      const s = CL.party.currentSettlement();
      const owner = CL.content.get('factions', s.ownerFaction);
      return {
        title: s.name.toUpperCase(),
        text: `${TYPE_LABEL[s.type] || s.type} of the ${owner.name}. ${CL.world.clockLabel()}.`,
        button: 'Leave',
      };
    }
    if (mode === 'encounter') {
      const st = CL.world.map().sites[g.siteId];
      const ready = CL.party.healthySoldiers().length;
      return {
        title: st.name.toUpperCase(),
        text: `${st.text} You have ${ready} soldier${ready === 1 ? '' : 's'} fit to fight.`,
        button: 'Attack',
        secondary: 'Leave',
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
    $('#ordersPanel').classList.add('hidden');
    if (mode === 'map') {
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
    const screen = screenFor(mode);
    if (mode === 'result') $('#result').innerHTML = g.result.html;
    $('#overlayTitle').textContent = screen.title;
    $('#overlayText').textContent = screen.text;
    $('#primaryBtn').textContent = screen.button;
    $('#secondaryBtn').classList.toggle('hidden', !screen.secondary);
    if (screen.secondary) $('#secondaryBtn').textContent = screen.secondary;
    if (mode === 'settlement') refreshRoster();
    if (mode === 'create') renderCreator();
    if (mode === 'character') renderSheet();
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
    const skills = Object.values(CL.content.table('skills')).map((sk) => `${sk.name} ${C.skill(sk.id)}`);
    stats.replaceChildren(
      line(C.ATTRIBUTES.map((a) => `${C.ATTRIBUTE_NAMES[a]} ${C.attribute(a)}`)),
      line([
        `HP ${hero.hp}`,
        `Damage ${Math.round(hero.damage * 10) / 10}`,
        `Armor ${hero.armor}`,
        hero.canBlock ? 'Can block' : 'No shield — cannot block',
        `Travel ×${C.travelFactor().toFixed(2)}`,
      ]),
      line(skills),
      Object.assign(document.createElement('div'), { className: 'statLine' }),
    );
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

  function openSheet() {
    if (!CL.campaign.character) return;
    const m = CL.game.mode;
    if (m === 'map' || m === 'settlement') CL.game.returnMode = m;
    changeMode('character');
  }

  function refreshRoster() {
    const c = CL.campaign;
    const p = CL.party;
    $('#rosterSummary').textContent =
      `Day ${p.dayNumber()} · ${c.gold} crowns · ${c.renown} renown · ` +
      `${c.roster.length}/${p.PARTY_CAP} soldiers · ${c.victories} wins`;

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
    ['#recruitA', '#recruitB'].forEach((sel, i) => {
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
    $('#serviceNote').textContent = offers.length ? '' : 'No one here is looking to take up arms.';
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
    $('#blockBtn').disabled = CL.game.hero?.canBlock === false; // no shield, no block
    $('#overlay').classList.add('hidden');
    $('#ordersPanel').classList.add('hidden');
  }

  /** Show the selected group and highlight it plus that group's current order. */
  function showSelectedGroup(group) {
    $('#selectedGroup').textContent = group === 'infantry' ? 'Infantry' : 'Archers';
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

  CL.ui = {
    $,
    message,
    changeMode,
    refresh,
    refreshRoster,
    supplyParts,
    creatorChoices,
    openSheet,
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
