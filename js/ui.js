/* Crownless DOM UI: overlays, roster, messages, pause and the diagnostics panel. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const $ = (s) => document.querySelector(s);

  const MESSAGE_MS = 2500;

  const SCREENS = {
    camp: {
      title: 'THE CAPTAIN’S CAMP',
      text: 'Recruit soldiers, then lead your party against Road Reavers. Your gold and surviving troops persist between battles.',
      button: 'Begin Battle',
    },
    title: {
      title: 'CROWNLESS',
      text: 'Gate B: Lead a band of infantry and archers, issue tactical commands, and win two waves of battle.',
      button: 'Prepare Party',
    },
  };

  function message(text) {
    CL.game.message = text;
    CL.game.messageUntil = performance.now() + MESSAGE_MS;
    $('#message').textContent = text;
    CL.diag.log('info', text);
  }

  function changeMode(mode) {
    const g = CL.game;
    g.mode = mode;
    $('#overlay').classList.remove('hidden');
    $('#prep').classList.toggle('hidden', mode !== 'camp');
    $('#result').classList.toggle('hidden', mode !== 'result');
    $('#secondaryBtn').classList.add('hidden');

    let screen;
    if (mode === 'result') {
      screen = {
        title: g.result.win ? 'VICTORY' : 'CAPTURED',
        text: g.result.win
          ? 'The reavers have been routed. Your surviving soldiers gather the spoils.'
          : 'Your party was broken. You escaped captivity, but lost supplies and crowns.',
        button: 'Return to Camp',
      };
      $('#result').innerHTML = g.result.html;
    } else {
      screen = SCREENS[mode] || SCREENS.title;
    }
    $('#overlayTitle').textContent = screen.title;
    $('#overlayText').textContent = screen.text;
    $('#primaryBtn').textContent = screen.button;
    if (mode === 'camp') refreshRoster();
  }

  function refreshRoster() {
    const c = CL.campaign;
    $('#rosterSummary').textContent =
      `${c.gold} crowns · ${c.infantry} infantry · ${c.archer} archers · ` +
      `${c.woundedInfantry + c.woundedArcher} wounded · ${c.victories} wins`;
    $('#recruitInf').disabled = !CL.party.canRecruit(c, 'infantry');
    $('#recruitArch').disabled = !CL.party.canRecruit(c, 'archer');
  }

  function hideBattleOverlays() {
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
