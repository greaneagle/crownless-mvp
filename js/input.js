/* Crownless input: keyboard, mouse, on-screen buttons and the virtual joystick. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PREVENT_DEFAULT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const KEY_ORDERS = {
    Digit1: ['infantry', null],
    Digit2: ['archer', null],
    Digit3: ['cavalry', null],
    KeyF: [null, 'follow'],
    KeyH: [null, 'hold'],
    KeyC: [null, 'charge'],
  };

  function bindButtons($) {
    const { ui, combat, party, game } = CL;
    const reportJson = () => JSON.stringify(ui.report(), null, 2);

    $('#debugBtn').onclick = ui.toggleDebug;
    $('#closeDebug').onclick = ui.toggleDebug;
    $('#exportJson').onclick = () =>
      ui.download(`crownless-debug-${Date.now()}.json`, 'application/json', reportJson());
    $('#exportTxt').onclick = () => ui.download(`crownless-debug-${Date.now()}.txt`, 'text/plain', reportJson());
    $('#copyLogs').onclick = () => {
      navigator.clipboard
        ?.writeText(reportJson())
        .then(() => ui.message('Report copied'))
        .catch((e) => CL.diag.log('warn', 'Clipboard unavailable', { error: String(e) }));
    };
    $('#clearLogs').onclick = () => {
      CL.diag.events = [];
      ui.renderDebug();
    };
    $('#pauseBtn').onclick = ui.togglePause;
    $('#primaryBtn').onclick = () => {
      const { world } = CL;
      if (game.mode === 'title') {
        if (!CL.save.existed) game.newGame = true;
        if (game.newGame || !CL.campaign.character) ui.changeMode('create');
        else if (party.currentSettlement()) CL.town.enterPlace();
        else ui.changeMode('map');
      } else if (game.mode === 'create') CL.character.begin(ui.creatorChoices());
      else if (game.mode === 'character') {
        if (game.returnMode === 'map') ui.changeMode('map');
        else CL.town.backToPlace();
      } else if (game.mode === 'trade' || game.mode === 'contracts') CL.town.backToPlace();
      else if (game.mode === 'saves') {
        if (game.savesReturn === 'title') ui.changeMode('title');
        else CL.town.backToPlace();
      } else if (game.mode === 'talk') CL.town.backToPlace();
      else if (game.mode === 'journal') ui.closeJournal();
      else if (game.mode === 'ending') ui.closeEnding();
      else if (game.mode === 'settlement') world.leaveSettlement();
      else if (game.mode === 'encounter') world.attackSite();
      else if (game.mode === 'result') world.returnToMap();
    };
    $('#secondaryBtn').onclick = () => {
      if (game.mode === 'encounter') ui.changeMode('map');
      else if (game.mode === 'settlement') CL.town.enter(); // "Walk the streets"
      else if (game.mode === 'create') {
        game.newGame = false;
        ui.changeMode('title');
      } else if (game.mode === 'title') {
        // New game over an existing save needs a second, explicit press (GDD §11 confirmations).
        if (!game.confirmNew) {
          game.confirmNew = true;
          ui.changeMode('title');
        } else {
          game.confirmNew = false;
          game.newGame = true;
          ui.changeMode('create');
        }
      }
    };
    $('#partyBtn').onclick = ui.openSheet;
    $('#journalBtn').onclick = ui.openJournal;
    $('#placeJournalBtn').onclick = ui.openJournal;
    $('#townMenuBtn').onclick = () => {
      CL.game.placeMode = 'town';
      ui.changeMode('settlement'); // the classic list, for anyone who prefers menus
    };
    $('#waitBtn').onclick = () => CL.world.toggleWait();
    $('#tradeBtn').onclick = () => ui.changeMode('trade');
    $('#contractsBtn').onclick = () => ui.changeMode('contracts');
    bindSaves($);
    $('#gearBtn').onclick = ui.openSheet;
    for (const sel of ['#recruitA', '#recruitB', '#recruitC']) $(sel).onclick = (e) => party.recruit(e.currentTarget.dataset.troop);
    for (const sel of ['#buyFoodA', '#buyFoodB']) {
      $(sel).onclick = (e) => {
        if (CL.upkeep.buyFood(CL.campaign, Number(e.currentTarget.dataset.rations))) CL.save.write();
        ui.refreshRoster();
      };
    }
    $('#restBtn').onclick = () => {
      party.rest();
      ui.refresh(); // refresh the clock line too
    };
    $('#ordersBtn').onclick = () => {
      $('#ordersPanel').classList.toggle('hidden');
      combat.order(game.group, null);
    };
    $('#closeOrders').onclick = () => $('#ordersPanel').classList.add('hidden');
    for (const b of document.querySelectorAll('[data-group]')) b.onclick = () => combat.order(b.dataset.group, null);
    for (const b of document.querySelectorAll('[data-order]')) b.onclick = () => combat.order(null, b.dataset.order);
  }

  /** Save & export screen: manual save, export file, copy text, import file/text, restore. */
  function bindSaves($) {
    const { ui } = CL;
    const P = () => CL.portable;
    $('#savesBtn').onclick = ui.openSaves;
    $('#titleSavesBtn').onclick = ui.openSaves;
    $('#saveNowBtn').onclick = () => {
      const ok = CL.save.write();
      ui.renderSaves({ ok, text: ok ? 'Saved.' : 'Saving failed — export your game instead.' });
    };
    $('#exportBtn').onclick = () => {
      ui.download(P().fileName(), 'application/json', P().serialize());
      ui.renderSaves({ ok: true, text: 'Save file exported. Keep it somewhere safe, or open it in Crownless on another device.' });
    };
    $('#copySaveBtn').onclick = () => {
      const text = P().serialize();
      const fallback = () => {
        $('#pasteBox').open = true;
        $('#importText').value = text;
        $('#importText').select();
        ui.renderSaves({ ok: true, text: 'Clipboard unavailable — the save text is in the box below; copy it from there.' });
      };
      if (!navigator.clipboard) return fallback();
      navigator.clipboard
        .writeText(text)
        .then(() => ui.renderSaves({ ok: true, text: 'Save text copied. Paste it into "Paste save text" on the other device.' }))
        .catch(fallback);
    };
    const tryImport = (text) => {
      const r = P().importText(text);
      if (r.ok) ui.importDone(r);
      else ui.renderSaves({ ok: false, text: `Import failed: ${r.reason} Your current game was not changed.`, problems: r.problems });
    };
    $('#importFileBtn').onclick = () => $('#importFile').click();
    $('#importFile').onchange = (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      file
        .text()
        .then(tryImport)
        .catch((err) => ui.renderSaves({ ok: false, text: `Could not read the file (${err}).` }));
    };
    $('#importTextBtn').onclick = () => tryImport($('#importText').value);
    $('#restoreBtn').onclick = () => {
      const r = P().restorePreImport();
      if (r.ok) ui.importDone({});
      else ui.renderSaves({ ok: false, text: r.reason });
    };
  }

  function bindKeyboardAndMouse($, canvas) {
    const g = CL.game;
    root.addEventListener('keydown', (e) => {
      // Let form fields (character name, debug selects) receive keys normally.
      if (e.target.closest?.('input, select, textarea')) return;
      if (PREVENT_DEFAULT.includes(e.code)) e.preventDefault();
      if (e.code === 'F3') {
        e.preventDefault();
        CL.ui.toggleDebug();
        return;
      }
      if (e.code === 'Escape') {
        if (!$('#ordersPanel').classList.contains('hidden')) $('#ordersPanel').classList.add('hidden');
        else CL.ui.togglePause();
        return;
      }
      const o = KEY_ORDERS[e.code];
      if (o) CL.combat.order(o[0], o[1]);
      if (g.mode === 'town' && ['Space', 'Enter', 'KeyE'].includes(e.code) && !e.repeat) {
        CL.town.interact();
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        if (g.mode === 'map') {
          if (g.travel) CL.world.stop();
          else CL.world.toggleWait();
        }
        else CL.combat.queueAttack();
      }
      g.hold[e.code] = true;
    });
    root.addEventListener('keyup', (e) => {
      g.hold[e.code] = false;
    });
    root.addEventListener('blur', releaseAll);
    canvas.addEventListener('pointerdown', (e) => {
      if (g.mode === 'town') {
        // Tap a spot to walk there, or a person to walk up and talk.
        const r = canvas.getBoundingClientRect();
        CL.town.tap(((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height);
        return;
      }
      if (g.mode === 'map') {
        // Click/tap a destination on the strategic map (GDD §3).
        const r = canvas.getBoundingClientRect();
        CL.world.click(((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height);
        return;
      }
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) {
        g.attackHeld = true;
        CL.combat.queueAttack();
      }
      if (e.button === 2) g.blockHeld = true;
    });
    root.addEventListener('pointerup', () => {
      g.attackHeld = false;
      g.blockHeld = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Press-and-hold touch button with pointer capture. */
  function bindHold($, selector, start, end) {
    const b = $(selector);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      start();
    });
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('lostpointercapture', end);
  }

  function bindJoystick($) {
    const g = CL.game;
    const joy = $('#joystick');
    const knob = $('#knob');
    const KNOB_CENTER = 29; // % offset of the knob at rest
    let joyPointer = null;

    function setKnob() {
      knob.style.left = `${KNOB_CENTER + g.joystick.x * KNOB_CENTER}%`;
      knob.style.top = `${KNOB_CENTER + g.joystick.y * KNOB_CENTER}%`;
    }
    function joyMove(e) {
      if (joyPointer !== e.pointerId) return;
      const r = joy.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width * 0.43);
      const y = (e.clientY - r.top - r.height / 2) / (r.height * 0.43);
      const m = Math.max(1, Math.hypot(x, y));
      g.joystick = { x: x / m, y: y / m };
      setKnob();
    }
    function joyEnd(e) {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null;
      g.joystick = { x: 0, y: 0 };
      setKnob();
    }
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joyPointer = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      joyMove(e);
    });
    joy.addEventListener('pointermove', joyMove);
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);
    joy.addEventListener('lostpointercapture', joyEnd);
    resetJoystick = () => {
      joyPointer = null;
      g.joystick = { x: 0, y: 0 };
      setKnob();
    };
  }

  let resetJoystick = () => {};

  /** Drop every held input — used on blur, tab hide and orientation change. */
  function releaseAll() {
    const g = CL.game;
    g.hold = {};
    g.attackHeld = false;
    g.blockHeld = false;
    g.attackQueuedAt = null;
    resetJoystick();
  }

  /** Pause when the page is hidden; pause and ask to rotate when a touch device is portrait. */
  function bindLifecycle() {
    const coarse = root.matchMedia?.('(pointer: coarse)');
    const onHidden = () => {
      releaseAll();
      CL.ui.autoPause('page hidden');
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHidden();
    });
    root.addEventListener('pagehide', onHidden);

    const checkOrientation = () => {
      const portrait = Boolean(coarse?.matches) && root.innerHeight > root.innerWidth;
      CL.ui.showRotatePrompt(portrait);
      if (portrait) {
        releaseAll();
        CL.ui.autoPause('portrait orientation');
      }
    };
    root.addEventListener('resize', checkOrientation);
    root.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  function bind(canvas) {
    const $ = CL.ui.$;
    const g = CL.game;
    bindButtons($);
    bindKeyboardAndMouse($, canvas);
    bindHold(
      $,
      '#attackBtn',
      () => {
        if (g.mode === 'town') {
          CL.town.interact(); // the ATTACK button reads TALK in town
          return;
        }
        g.attackHeld = true;
        CL.combat.queueAttack();
      },
      () => {
        g.attackHeld = false;
      },
    );
    bindHold(
      $,
      '#blockBtn',
      () => {
        g.blockHeld = true;
      },
      () => {
        g.blockHeld = false;
      },
    );
    bindJoystick($);
    bindLifecycle();
  }

  CL.input = { bind, releaseAll };
})(typeof window !== 'undefined' ? window : globalThis);
