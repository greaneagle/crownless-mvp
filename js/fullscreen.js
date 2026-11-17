/* Crownless full screen (owner request after phone testing: the browser's address bar takes room).
 *
 * Android Chrome and desktop browsers: the Fullscreen API. Browsers only allow it from a tap or click,
 * so with the "Full screen" setting on (the default on phones) the game goes full screen on the first
 * tap of a session, and again on the next tap after the player leaves it. While full screen it also
 * asks to lock landscape. Turning the setting off leaves full screen and stops asking.
 *
 * iPhone browsers don't offer full screen to web pages. There, and anywhere, launching from the home
 * screen (the web app manifest) opens the game without browser bars; Settings explains how. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const doc = () => root.document;

  /** Does this browser let a page go full screen? (No on iPhone.) */
  function supported() {
    const d = doc();
    return Boolean(d && (d.fullscreenEnabled || d.webkitFullscreenEnabled));
  }

  /** Already running without browser bars: full screen now, or launched from the home screen. */
  function active() {
    const d = doc();
    if (d?.fullscreenElement || d?.webkitFullscreenElement) return true;
    return installed();
  }

  /** Launched from the home screen as an app (no address bar to hide). */
  function installed() {
    try {
      return Boolean(root.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches || root.navigator?.standalone);
    } catch {
      return false;
    }
  }

  /** Go full screen (call from a tap or click). Resolves true if it worked. */
  function enter() {
    const d = doc();
    const el = d?.documentElement;
    const req = el?.requestFullscreen || el?.webkitRequestFullscreen;
    if (!req || active()) return Promise.resolve(active());
    let p;
    try {
      p = Promise.resolve(req.call(el, { navigationUI: 'hide' }));
    } catch (e) {
      p = Promise.reject(e);
    }
    return p
      .then(() => {
        // Landscape only while full screen (Android); ignored where unsupported.
        root.screen?.orientation?.lock?.('landscape')?.catch?.(() => {});
        CL.diag.log('info', 'Full screen on');
        return true;
      })
      .catch((e) => {
        CL.diag.log('warn', 'Full screen refused', { error: String(e) });
        return false;
      });
  }

  function exit() {
    const d = doc();
    if (!(d?.fullscreenElement || d?.webkitFullscreenElement)) return Promise.resolve();
    root.screen?.orientation?.unlock?.();
    const fn = d.exitFullscreen || d.webkitExitFullscreen;
    return Promise.resolve(fn?.call(d)).catch(() => {});
  }

  /** On every tap: with the setting on, go (back) full screen if we aren't. */
  function onTap() {
    if (CL.settings?.get('fullscreen') && supported() && !active()) enter();
  }

  /** The Settings checkbox changed (itself a tap, so entering is allowed right away). */
  function setWanted(on) {
    return on ? enter() : exit();
  }

  function bind() {
    const d = doc();
    if (!d) return;
    // Browsers allow full screen only from "activating" input: on a phone that is the END of a tap
    // (pointerup), not its start; on a desktop a click or key press. Capture phase, so the tap that
    // starts the game is the same tap that goes full screen.
    d.addEventListener('pointerup', onTap, true);
    d.addEventListener('keydown', (e) => e.key !== 'Escape' && onTap(), true); // Esc leaves full screen; don't fight it
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
      d.addEventListener(ev, () => {
        CL.ui?.fitHud?.();
        CL.ui?.refreshFullscreen?.();
      });
    }
  }

  CL.fullscreen = { supported, active, installed, enter, exit, onTap, setWanted, bind };
})(typeof window !== 'undefined' ? window : globalThis);
