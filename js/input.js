/* Crownless input: keyboard, mouse, on-screen buttons, the virtual joystick and the map's gestures. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PREVENT_DEFAULT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const KEY_ORDERS = {
    Digit1: ['infantry', null],
    Digit2: ['archer', null],
    Digit3: ['cavalry', null],
    Digit4: ['infantry2', null], // P9-B4: the second divisions
    Digit5: ['archer2', null],
    Digit6: ['cavalry2', null],
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
    $('#leavePracticeBtn').onclick = () => {
      if (game.mode === 'battle' && game.encounterDef?.lesson) party.endBattle(false);
    };
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
      } else if (game.mode === 'trade' || game.mode === 'contracts' || game.mode === 'accounts') CL.town.backToPlace();
      else if (game.mode === 'detachments') {
        if (game.returnMode === 'map') ui.changeMode('map');
        else CL.town.backToPlace();
      }
      else if (game.mode === 'saves') {
        if (game.savesReturn === 'title') ui.changeMode('title');
        else CL.town.backToPlace();
      } else if (game.mode === 'talk') CL.town.backToPlace();
      else if (game.mode === 'journal') ui.closeJournal();
      else if (game.mode === 'wait') ui.confirmWait();
      else if (game.mode === 'realm') ui.closeRealm();
      else if (game.mode === 'ending') ui.closeEnding();
      else if (game.mode === 'settlement') world.leaveSettlement();
      else if (game.mode === 'encounter') world.attackSite();
      else if (game.mode === 'result' && game.result?.training) CL.town.backToPlace();
      else if (game.mode === 'result' && game.result?.duel) CL.town.enterPlace(); // a tournament bout: back to the town (P7-09)
      else if (game.mode === 'result') world.returnToMap();
    };
    $('#secondaryBtn').onclick = () => {
      if (game.mode === 'encounter' || game.mode === 'wait') ui.changeMode('map');
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
    $('#waitBtn').onclick = () => (CL.game.waiting ? CL.world.toggleWait() : ui.openWait()); // P10-01: the Wait screen
    $('#hideBtn').onclick = () => CL.world.toggleHide(); // P7-04
    $('#tradeBtn').onclick = () => ui.changeMode('trade');
    $('#contractsBtn').onclick = () => ui.changeMode('contracts');
    $('#accountsBtn').onclick = () => ui.changeMode('accounts');
    $('#detachBtn').onclick = () => {
      game.returnMode = 'place';
      ui.changeMode('detachments');
    };
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
    // V2-06: the tactical overview on phones (a toggle; desktops hold Tab or press M).
    $('#mapBtn').onclick = () => CL.tactics.overview(game);
    for (const b of document.querySelectorAll('[data-group]')) b.onclick = () => combat.order(b.dataset.group, null);
    for (const b of document.querySelectorAll('[data-order]')) b.onclick = () => combat.order(null, b.dataset.order);
    // P9-B4, layer 4: what a tap on the tactical map does, and when.
    for (const b of document.querySelectorAll('[data-map-action]')) {
      b.onclick = () => {
        game.mapAction = b.dataset.mapAction;
        ui.showSelectedGroup(game.group);
      };
    }
    for (const b of document.querySelectorAll('[data-map-timing]')) {
      b.onclick = () => {
        game.mapTiming = b.dataset.mapTiming === 'now' || b.dataset.mapTiming === 'volley' ? b.dataset.mapTiming : Number(b.dataset.mapTiming);
        ui.showSelectedGroup(game.group);
      };
    }
    // P7-11: the selected division's formation (P9-B4).
    for (const b of document.querySelectorAll('[data-formation]')) {
      b.onclick = () => {
        CL.formations.set(game, b.dataset.formation);
        ui.showSelectedGroup(game.group);
      };
    }
    $('#dismountBtn').onclick = () => CL.combat.dismount(); // P11-08
    $('#rallyBtn').onclick = () => {
      CL.morale.rally(game);
      ui.showSelectedGroup(game.group);
    };
    // P11-09: the switch control on ATTACK's edge (or a swipe across ATTACK, a setting; PC Q).
    $('#switchBtn').onclick = () => CL.gear.switchWeapon(game);
    // P11-09: the battle's tap buttons act on a finger's release, so a second finger works while the
    // first holds the joystick or ATTACK (the browser makes no click of a second finger's tap).
    for (const sel of ['#switchBtn', '#mapBtn', '#ordersBtn', '#pauseBtn']) tapOnRelease($(sel));
  }

  /** Save & export screen: manual save, export file, copy text, import file/text, restore. */
  function bindSaves($) {
    const { ui } = CL;
    const P = () => CL.portable;
    $('#savesBtn').onclick = ui.openSaves;
    $('#titleSavesBtn').onclick = ui.openSaves;
    $('#saveNowBtn').onclick = () => {
      P().persist().then((p) => (CL.save.persisted = p));
      const ok = CL.save.write();
      const why = CL.save.stale ? 'Not saved: this game is open in another tab. Reload this page to carry on here.' : 'Saving failed — export your game instead.';
      ui.renderSaves({ ok, text: ok ? 'Saved.' : why });
    };
    $('#exportBtn').onclick = () => {
      P().persist().then((p) => (CL.save.persisted = p));
      ui.download(P().fileName(), 'application/json', P().serialize());
      P().markExported();
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
        .then(() => {
          P().markExported();
          ui.renderSaves({ ok: true, text: 'Save text copied. Paste it into "Paste save text" on the other device.' });
        })
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
      if (g.mode === 'battle' && (e.code === 'Tab' || e.code === 'KeyM')) {
        // Tactical overview (V2-06): hold Tab to look, or press M to toggle it.
        e.preventDefault();
        if (!e.repeat) CL.tactics.overview(g, e.code === 'Tab' ? true : undefined);
        return;
      }
      if (e.code === 'Escape') {
        if (g.overview) CL.tactics.overview(g, false);
        else if (!$('#ordersPanel').classList.contains('hidden')) $('#ordersPanel').classList.add('hidden');
        else CL.ui.togglePause();
        return;
      }
      if (g.mode === 'map' && !e.ctrlKey && !e.metaKey && (e.code in MAP_KEYS || e.code === 'KeyC')) {
        // W-02: + and − zoom the map, C centres it on the party.
        e.preventDefault();
        if (e.code === 'KeyC') CL.mapView.centre(true);
        else if (!e.repeat) CL.mapView.step(MAP_KEYS[e.code]);
        return;
      }
      if (g.mode === 'map' && e.code === 'KeyH' && !e.repeat) CL.world.toggleHide(); // P7-04
      if (g.mode === 'battle' && e.code === 'KeyZ' && !e.repeat && CL.camera.scrolls(g)) CL.camera.toggleZoom(g); // W-03
      if (g.mode === 'battle' && e.code === 'KeyR' && !e.repeat) CL.morale.rally(g); // V2-08b
      if (g.mode === 'battle' && e.code === 'KeyQ' && !e.repeat) CL.gear.switchWeapon(g); // P11-02: the other weapon to hand
      if (g.mode === 'battle' && e.code === 'KeyX' && !e.repeat) CL.combat.dismount(); // P11-08: off the horse (no remount)
      const o = KEY_ORDERS[e.code];
      if (o) CL.combat.order(o[0], o[1]);
      if (g.mode === 'town' && ['Space', 'Enter', 'KeyE'].includes(e.code) && !e.repeat) {
        CL.town.interact();
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        if (g.mode === 'map') {
          if (g.travel) CL.world.stop();
          else if (!g.waitPlan) CL.ui.openWait(); // P10-01
        }
        else CL.combat.queueAttack();
      }
      g.hold[e.code] = true;
    });
    root.addEventListener('keyup', (e) => {
      g.hold[e.code] = false;
      if (e.code === 'Tab' && g.overview) CL.tactics.overview(g, false); // Tab is held to look
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
        // W-02: a press on the map only begins an interaction; a tap travels on release (GDD §3).
        if (mapGestures.down(e)) canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      if (g.mode === 'prepare' && g.prep) {
        // Battle preparation (V2-07): pick up a group's flag to drag it.
        const r = canvas.getBoundingClientRect();
        const [sx, sy] = [((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height];
        const groups = CL.divisions.preview(CL.campaign).map((d) => d.div).filter((d) => g.prep.plan.anchors[d]); // every division's flag (P9-B4)
        g.prep.drag = CL.prep.flagAt(g.prep.plan, g.prep.map, groups, sx, sy);
        if (g.prep.drag) canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      if (g.mode === 'battle' && e.pointerType !== 'mouse') {
        // W-03: a finger on the field is tracked, so two make a pinch; the minimap and overview taps
        // (V2-06) come on release, and only from a clean tap, so a pinch never sends a group anywhere.
        if (battleGestures.down(e)) canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      if (g.mode === 'battle') {
        // The minimap (tap to look) and the tactical overview (tap to send a group), V2-06.
        const r = canvas.getBoundingClientRect();
        if (CL.tactics.tap(g, ((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height)) return;
      }
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) {
        g.attackHeld = true;
        CL.combat.queueAttack();
      }
      if (e.button === 2) g.blockHeld = true;
    });
    root.addEventListener('pointerup', (e) => {
      // The mouse's hold on the field ends wherever it is let go. P11-09: only the mouse's, and not a
      // button's: a finger lifted from the joystick no longer lets go of ATTACK held by the other thumb.
      if (e.pointerType !== 'mouse' || [...holding.values()].some((s) => s.has(e.pointerId))) return;
      g.attackHeld = false;
      g.blockHeld = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      // P11-07: manual aim: the mouse pointer on the field, or (a setting) one finger dragged on it.
      if (g.mode === 'battle' && (e.pointerType === 'mouse' || (battleGestures.count === 1 && CL.settings.get('aimTouch')))) {
        const r = canvas.getBoundingClientRect();
        const w = CL.camera.toWorld(g, ((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height);
        g.aimPoint = { x: w.x, y: w.y, touch: e.pointerType !== 'mouse' };
      }
      if (battleGestures.count) {
        if (g.mode === 'battle') battleGestures.move(e);
        else battleGestures.cancel();
      }
      if (mapGestures.count) {
        if (g.mode === 'map') mapGestures.move(e);
        else mapGestures.cancel(); // the map closed under the fingers
        return;
      }
      if (g.mode !== 'prepare' || !g.prep?.drag) return;
      const r = canvas.getBoundingClientRect();
      CL.prep.moveFlag(g.prep.plan, g.prep.map, g.prep.drag, ((e.clientX - r.left) * CL.W) / r.width, ((e.clientY - r.top) * CL.H) / r.height);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse' && g.aimPoint?.touch) g.aimPoint = null; // the aiming finger lifted
      if (battleGestures.count) battleGestures.up(e);
      if (mapGestures.count) {
        if (g.mode === 'map') mapGestures.up(e);
        else mapGestures.cancel();
        return;
      }
      if (g.mode === 'prepare' && g.prep?.drag) {
        g.prep.drag = null;
        CL.ui.renderPrep(); // the setup is now Custom
      }
    });
    // A finger moving over the map is the game's: tell the browser, or it treats the drag as a scroll
    // and swallows the next tap anywhere (the first press of Centre after a pan did nothing).
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (g.mode === 'map' || g.mode === 'battle') e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener('pointercancel', () => {
      mapGestures.cancel();
      battleGestures.cancel();
    });
    canvas.addEventListener('lostpointercapture', (e) => {
      mapGestures.lost(e);
      battleGestures.lost(e);
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (g.mode !== 'map' && g.mode !== 'battle') return;
        e.preventDefault(); // the page itself never scrolls or zooms
        if (g.mode === 'map') mapGestures.wheel(e);
        else if (!g.overview) battleGestures.wheel(e);
      },
      { passive: false },
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // W-02: the strategic map's taps, drags, pinches and wheel, told apart by CL.gestures. Every other
  // mode keeps the handlers above.
  let mapGestures = { count: 0, down: () => false, move() {}, up() {}, cancel() {}, lost() {}, wheel() {} };

  function bindMapGestures(canvas) {
    const g = CL.game;
    const V = () => CL.mapView;
    const stage = CL.ui.$('#stage');
    const rect = () => canvas.getBoundingClientRect();
    const toCanvas = (x, y) => {
      const r = rect();
      return [((x - r.left) * CL.W) / r.width, ((y - r.top) * CL.H) / r.height];
    };
    const scale = () => CL.W / (rect().width || CL.W);
    let wheelTimer = null;
    mapGestures = CL.gestures.recognizer({
      onTap: (x, y) => {
        if (g.mode === 'map') CL.world.click(...toCanvas(x, y));
      },
      onPan: (dx, dy) => {
        V().release();
        V().panBy(dx * scale(), dy * scale());
        stage.classList.add('panning');
      },
      onPinch: (f, x, y) => {
        V().release();
        V().zoomAt(f, ...toCanvas(x, y));
      },
      onZoom: (f, x, y) => {
        V().release();
        V().zoomAt(f, ...toCanvas(x, y));
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => V().remember(), 300); // keep the zoom once the wheel rests
      },
      onEnd: () => {
        stage.classList.remove('panning');
        V().remember();
      },
    });
  }

  // W-03: battle zoom. A pinch on the field (never the joystick, buttons or panels, which are other
  // elements) zooms between 0.75× and 1.5×; one finger on the field does nothing new; the view keeps
  // following the hero. Spreading the fingers on the overview goes back to the field; closing them in a
  // pinch that starts at the widest zoom opens it (a pinch that only reaches the widest zoom doesn't).
  let battleGestures = { count: 0, down: () => false, move() {}, up() {}, cancel() {}, lost() {}, wheel() {} };

  function bindBattleGestures() {
    const g = CL.game;
    const C = () => CL.camera;
    let pinched = 1;
    let startZoom = null; // the zoom when this pinch began
    let wheelTimer = null;
    battleGestures = CL.gestures.recognizer({
      onTap: (x, y) => {
        if (g.mode !== 'battle') return;
        const r = CL.ui.$('#game').getBoundingClientRect();
        CL.tactics.tap(g, ((x - r.left) * CL.W) / r.width, ((y - r.top) * CL.H) / r.height);
      },
      onPinch: (f) => {
        if (startZoom == null) startZoom = C().zoomOf(g);
        pinched *= f;
        if (!g.overview) C().setZoom(g, C().zoomOf(g) * f);
      },
      onZoom: (f) => {
        C().setZoom(g, C().zoomOf(g) * f);
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => C().remember(g), 300);
      },
      onEnd: (kind) => {
        if (kind === 'pinch' || kind === 'pan') {
          if (g.overview && pinched > 1.3) CL.tactics.overview(g, false);
          else if (!g.overview && pinched < 0.8 && startZoom != null && startZoom <= C().zoomRange(g).min + 1e-3 && CL.camera.scrolls(g)) CL.tactics.overview(g, true);
          C().remember(g);
        }
        pinched = 1;
        startZoom = null;
      },
    });
  }

  /** W-02: the map's +, − and Centre buttons, and + − C on the keyboard (arrow keys pan: js/mapview.js). */
  function bindMapView($) {
    const V = () => CL.mapView;
    $('#zoomInBtn').onclick = () => V().step(1);
    $('#zoomOutBtn').onclick = () => V().step(-1);
    $('#centreBtn').onclick = () => V().centre(true);
    $('#zoomBtn').onclick = () => {
      if (CL.game.mode === 'battle') CL.camera.toggleZoom(CL.game);
    };
    tapOnRelease($('#zoomBtn')); // P11-09: with a thumb on the joystick too
  }

  const MAP_KEYS = { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1 };

  /**
   * P11-09: a button that acts when a finger (or the mouse) lifts on it, as well as on a keyboard click;
   * the click that follows a pointer's own release is not counted twice. @param {HTMLElement} b
   */
  function tapOnRelease(b) {
    const handler = b.onclick;
    if (!handler) return;
    const down = new Set();
    let tapped = 0;
    b.addEventListener('pointerdown', (e) => down.add(e.pointerId));
    b.addEventListener('pointercancel', (e) => down.delete(e.pointerId));
    b.addEventListener('pointerup', (e) => {
      if (!down.delete(e.pointerId) || b.disabled) return;
      const r = b.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; // slid off: no tap
      tapped = performance.now();
      handler.call(b, e);
    });
    b.onclick = (e) => {
      if (tapped && performance.now() - tapped < 700) {
        tapped = 0;
        return; // the pointer's own release already acted
      }
      handler.call(b, e);
    };
  }

  /** The fingers (or the mouse) down on each hold button: it stays held until the last is lifted. */
  const holding = new Map();

  /**
   * Press-and-hold touch button with pointer capture. A second finger on it adds to the hold; lifting
   * one of two keeps it held; a cancelled or lost pointer lets go (P11-09). `onMove` sees each move.
   */
  function bindHold($, selector, start, end, onMove) {
    const b = $(selector);
    const down = new Set();
    holding.set(selector, down);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      down.add(e.pointerId);
      start(e);
    });
    const up = (e) => {
      if (!down.delete(e.pointerId) || down.size) return;
      end(e);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    if (onMove) b.addEventListener('pointermove', (e) => down.has(e.pointerId) && onMove(e));
  }

  /** P11-09: a swipe across ATTACK, this far sideways (a share of its width), switches weapons. */
  const SWIPE = { across: 0.55, straight: 0.6 };

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

  /**
   * P11-09: let go of Attack: the button, Space, the queued tap, and a bow's draw (let down, not loosed;
   * a crossbow keeps its load). For a weapon switch, and with everything else below.
   */
  function releaseAttack() {
    const g = CL.game;
    g.attackHeld = false;
    g.attackQueuedAt = null;
    g.attackWas = false;
    g.attackWasDown = false;
    g.looseQueued = false;
    if (g.hold) g.hold.Space = false;
    const h = g.hero;
    if (h?.ranged && !h.ranged.crossbow) h.drawT = 0;
    holding.get('#attackBtn')?.clear();
  }

  /**
   * P11-09: drop every held battle input (Attack and the draw, Block, the keys, the joystick): on a pause,
   * a modal, the overview, a mode change (a battle starting or ending) — the plan's §12 stuck-input cases.
   */
  function releaseHeld() {
    const g = CL.game;
    releaseAttack();
    g.hold = {};
    g.blockHeld = false;
    g.blockWasHeld = false;
    for (const s of holding.values()) s.clear();
    resetJoystick();
  }

  /** Drop every held input and any gesture: on blur, the page hidden and an orientation change. */
  function releaseAll() {
    releaseHeld();
    mapGestures.cancel(); // a lost window ends a drag or pinch with no tap
    battleGestures.cancel();
  }

  /** Pause when the page is hidden; pause and ask to rotate when a touch device is portrait. */
  function bindLifecycle() {
    const coarse = root.matchMedia?.('(pointer: coarse)');
    const onHidden = () => {
      releaseAll();
      CL.ui.autoPause('page hidden');
      // Phones may close a hidden tab without warning: keep what happened on the map since the last
      // settlement. (A battle in progress isn't part of the save; it is fought again on return.)
      if (CL.campaign?.character && CL.game.mode !== 'battle' && CL.game.mode !== 'title' && CL.game.mode !== 'create') CL.save.write();
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
    bindMapGestures(canvas);
    bindBattleGestures();
    bindMapView($);
    let swipe = null; // P11-09: where a press on ATTACK began, for the swipe that switches
    bindHold(
      $,
      '#attackBtn',
      (e) => {
        if (g.mode === 'town') {
          CL.town.interact(); // the ATTACK button reads TALK in town
          return;
        }
        swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
        g.attackHeld = true;
        CL.combat.queueAttack();
      },
      () => {
        g.attackHeld = false;
        swipe = null;
      },
      (e) => {
        if (!swipe || swipe.done || swipe.id !== e.pointerId || CL.settings.get('switchControl') !== 'swipe') return;
        const w = $('#attackBtn').getBoundingClientRect().width || 1;
        const [dx, dy] = [e.clientX - swipe.x, e.clientY - swipe.y];
        if (Math.abs(dx) < w * SWIPE.across || Math.abs(dy) > Math.abs(dx) * SWIPE.straight) return;
        swipe.done = true; // one switch a swipe (after the swing it began, if any)
        CL.input.releaseAttack();
        CL.gear.switchWeapon(g);
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

  CL.input = { bind, releaseAll, releaseHeld, releaseAttack, SWIPE };
})(typeof window !== 'undefined' ? window : globalThis);
