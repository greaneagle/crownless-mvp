/* Crownless input: keyboard, mouse, on-screen buttons and the virtual joystick. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const PREVENT_DEFAULT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const KEY_ORDERS = {
    Digit1: ['infantry', null],
    Digit2: ['archer', null],
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
      if (game.mode === 'title') ui.changeMode('camp');
      else if (game.mode === 'camp') combat.startBattle();
      else if (game.mode === 'result') {
        ui.changeMode('camp');
      }
    };
    $('#recruitInf').onclick = () => party.recruit(party.RECRUITABLE[0]);
    $('#recruitArch').onclick = () => party.recruit(party.RECRUITABLE[1]);
    $('#restBtn').onclick = () => party.rest();
    $('#ordersBtn').onclick = () => {
      $('#ordersPanel').classList.toggle('hidden');
      combat.order(game.group, null);
    };
    $('#closeOrders').onclick = () => $('#ordersPanel').classList.add('hidden');
    for (const b of document.querySelectorAll('[data-group]')) b.onclick = () => combat.order(b.dataset.group, null);
    for (const b of document.querySelectorAll('[data-order]')) b.onclick = () => combat.order(null, b.dataset.order);
  }

  function bindKeyboardAndMouse($, canvas) {
    const g = CL.game;
    root.addEventListener('keydown', (e) => {
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
      if (e.code === 'Space' && !e.repeat) CL.combat.queueAttack();
      g.hold[e.code] = true;
    });
    root.addEventListener('keyup', (e) => {
      g.hold[e.code] = false;
    });
    root.addEventListener('blur', releaseAll);
    canvas.addEventListener('pointerdown', (e) => {
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
