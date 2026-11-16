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
    return {
      title: 'CROWNLESS',
      text: 'The Border March: travel between towns, hire soldiers, and break the Road Reavers who prey on the roads.',
      button: CL.campaign.battles || CL.campaign.day ? 'Continue' : 'Set out',
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
    const screen = screenFor(mode);
    if (mode === 'result') $('#result').innerHTML = g.result.html;
    $('#overlayTitle').textContent = screen.title;
    $('#overlayText').textContent = screen.text;
    $('#primaryBtn').textContent = screen.button;
    $('#secondaryBtn').classList.toggle('hidden', !screen.secondary);
    if (screen.secondary) $('#secondaryBtn').textContent = screen.secondary;
    if (mode === 'settlement') refreshRoster();
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

  function hideBattleOverlays() {
    $('#stage').dataset.mode = 'battle';
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
    refreshRoster,
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
