/* Crownless audio (GDD §12 "12–18 reusable SFX … and 3 music loops (menu, world/town, battle)").
 * Everything is synthesized with the Web Audio API — no sound files — so it is original by
 * construction and adds nothing to download. The context starts on the first tap or key press
 * (browsers require a gesture), falls silent while the page is hidden, and does nothing at all
 * where Web Audio is missing (Node tests, very old browsers).
 *
 * Effects are rate-limited per sound and capped in total, so a 40-unit melee stays readable:
 * the hero's own swings and hits are loudest, everyone else's are quieter. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const MAX_VOICES = 10; // effects sounding at once
  const MUSIC_LEVEL = 0.22; // music sits under the effects at equal slider positions
  const SFX_LEVEL = 0.6;

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noise = null;
  let voices = 0;
  const lastPlayed = {};
  let volumes = { music: 50, sfx: 70 };

  // ---- Setup ----

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    // One second of white noise, reused by every noisy sound.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647; // fixed seed: the same hiss every time
      d[i] = (s / 2147483647) * 2 - 1;
    }
    setVolumes(volumes.music, volumes.sfx);
    CL.diag?.log('info', 'Audio started', { sampleRate: ctx.sampleRate });
    return ctx;
  }

  /** Volumes 0–100 from Settings (squared, so the slider feels even). */
  function setVolumes(music, sfx) {
    volumes = { music, sfx };
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime((music / 100) ** 2 * MUSIC_LEVEL, t, 0.05);
    sfxBus.gain.setTargetAtTime((sfx / 100) ** 2 * SFX_LEVEL, t, 0.05);
  }

  /** First gesture: start (or wake) the context and the music for the current screen. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (wanted && !playing) startTrack(wanted);
  }

  // ---- Building blocks ----

  /** Gain envelope: attack to `peak`, then exponential decay over `len` seconds. */
  function env(t, peak, len, attack = 0.005) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + len);
    return g;
  }

  function tone(out, t, { type = 'triangle', from, to = from, len, peak = 0.5, attack }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = env(t, peak, len, attack);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  function hiss(out, t, { len, peak = 0.5, filter = 'bandpass', from = 1200, to = from, q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = env(t, peak, len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.05);
    return src;
  }

  function notes(out, t, list, step, opts) {
    for (let i = 0; i < list.length; i++) tone(out, t + i * step, { from: list[i], ...opts });
  }

  // ---- The effects (GDD §12 list) ----
  // gap: the shortest time between two plays of the same sound, so crowds don't machine-gun.
  const SFX = {
    swing: { gap: 0.06, len: 0.14, play: (o, t) => hiss(o, t, { len: 0.13, peak: 0.5, from: 600, to: 2400, q: 2 }) },
    hit: {
      gap: 0.05,
      len: 0.12,
      play: (o, t) => {
        hiss(o, t, { len: 0.07, peak: 0.6, filter: 'lowpass', from: 2200, to: 400 });
        return tone(o, t, { type: 'sine', from: 160, to: 70, len: 0.1, peak: 0.6 });
      },
    },
    block: {
      gap: 0.06,
      len: 0.2,
      play: (o, t) => {
        tone(o, t, { type: 'square', from: 920, len: 0.16, peak: 0.12 });
        tone(o, t, { type: 'triangle', from: 1390, len: 0.18, peak: 0.18 });
        return hiss(o, t, { len: 0.03, peak: 0.4, filter: 'highpass', from: 3000 });
      },
    },
    down: { gap: 0.12, len: 0.3, play: (o, t) => tone(o, t, { type: 'sine', from: 140, to: 45, len: 0.28, peak: 0.7 }) },
    bow: {
      gap: 0.08,
      len: 0.2,
      play: (o, t) => {
        hiss(o, t, { len: 0.03, peak: 0.3, filter: 'highpass', from: 2500 });
        return tone(o, t, { type: 'triangle', from: 240, to: 190, len: 0.18, peak: 0.35 });
      },
    },
    thunk: { gap: 0.08, len: 0.08, play: (o, t) => tone(o, t, { type: 'sine', from: 320, to: 140, len: 0.07, peak: 0.4 }) },
    horse: {
      gap: 0.5,
      len: 0.5,
      play: (o, t) => {
        for (const dt of [0, 0.11, 0.2, 0.36]) hiss(o, t + dt, { len: 0.06, peak: 0.45, filter: 'lowpass', from: 500 });
        return null;
      },
    },
    coin: { gap: 0.1, len: 0.2, play: (o, t) => notes(o, t, [1320, 1760], 0.07, { type: 'square', len: 0.09, peak: 0.12 }) },
    select: { gap: 0.04, len: 0.05, play: (o, t) => tone(o, t, { type: 'sine', from: 700, to: 560, len: 0.04, peak: 0.2 }) },
    note: { gap: 0.5, len: 0.35, play: (o, t) => notes(o, t, [587, 880], 0.09, { type: 'triangle', len: 0.25, peak: 0.25 }) },
    quest: { gap: 1, len: 1, play: (o, t) => notes(o, t, [523, 659, 784, 1047], 0.12, { type: 'triangle', len: 0.45, peak: 0.3 }) },
    level: { gap: 1, len: 0.8, play: (o, t) => notes(o, t, [392, 523, 659, 784, 1047], 0.07, { type: 'square', len: 0.2, peak: 0.1 }) },
    win: {
      gap: 1,
      len: 1.4,
      play: (o, t) => {
        notes(o, t, [392, 494, 587], 0.13, { type: 'triangle', len: 0.4, peak: 0.3 });
        return tone(o, t + 0.39, { type: 'triangle', from: 784, len: 1, peak: 0.3 });
      },
    },
    capture: {
      gap: 1,
      len: 1.4,
      play: (o, t) => {
        notes(o, t, [440, 392, 349], 0.2, { type: 'triangle', len: 0.4, peak: 0.28 });
        return tone(o, t + 0.6, { type: 'sine', from: 147, to: 110, len: 0.9, peak: 0.4 });
      },
    },
  };

  /**
   * Play an effect. `vol` 0–1 scales it (other soldiers' swings are quieter than the hero's).
   * Returns true if it sounded.
   */
  function play(name, vol = 1) {
    const s = SFX[name];
    if (!s || !ctx || ctx.state !== 'running' || volumes.sfx <= 0) return false;
    const now = ctx.currentTime;
    if (now - (lastPlayed[name] ?? -1) < s.gap || voices >= MAX_VOICES) return false;
    lastPlayed[name] = now;
    const out = ctx.createGain();
    out.gain.value = Math.max(0.05, Math.min(1, vol));
    out.connect(sfxBus);
    s.play(out, now);
    voices++;
    setTimeout(
      () => {
        voices--;
        out.disconnect();
      },
      (s.len + 0.1) * 1000,
    );
    return true;
  }

  // ---- Music: three short loops, sequenced ahead of time ----
  // Each step is an eighth note. lead/bass are semitone offsets from root (null = rest); drum: 'k' kick, 's' hiss.
  const TRACKS = {
    menu: {
      bpm: 66,
      root: 146.83, // D
      pad: [0, 7],
      lead: [12, null, 14, null, 15, null, 14, 12, 10, null, 12, null, 7, null, null, null, 12, null, 14, null, 17, null, 15, 14, 12, null, 10, null, 12, null, null, null],
      bass: [0, null, null, null, null, null, null, null, -2, null, null, null, -5, null, null, null],
    },
    world: {
      bpm: 92,
      root: 196, // G
      pad: [0, 7],
      lead: [7, 12, 14, 12, 7, 12, 16, 14, 12, 7, 5, 7, 9, 7, 5, 2, 7, 12, 14, 12, 16, 17, 16, 14, 12, 14, 12, 9, 7, null, 7, null],
      bass: [0, null, 7, null, 0, null, 7, null, -2, null, 5, null, -5, null, 2, null],
    },
    battle: {
      bpm: 132,
      root: 110, // A
      pad: [0],
      lead: [12, null, 12, 15, null, 12, 10, null, 12, null, 12, 15, 17, 15, 12, 10, 7, null, 7, 10, null, 7, 5, null, 7, null, 8, 10, 8, 7, 5, 3],
      bass: [0, 0, 12, 0, 0, 0, 12, 0, -4, -4, 8, -4, -2, -2, 10, -2],
      drum: ['k', null, 's', null, 'k', 'k', 's', null],
    },
  };

  let wanted = null; // the track the current screen asks for
  let playing = null;
  let trackGain = null;
  let step = 0;
  let nextAt = 0;
  let timer = null;

  const freq = (base, semis) => base * 2 ** (semis / 12);

  function scheduleStep(tr, t) {
    const len = 60 / tr.bpm / 2;
    const lead = tr.lead[step % tr.lead.length];
    if (lead != null) tone(trackGain, t, { type: 'triangle', from: freq(tr.root, lead), len: len * 1.6, peak: 0.22, attack: 0.01 });
    const bass = tr.bass[step % tr.bass.length];
    if (bass != null) tone(trackGain, t, { type: 'sine', from: freq(tr.root / 2, bass), len: len * 1.8, peak: 0.35, attack: 0.01 });
    const drum = tr.drum?.[step % tr.drum.length];
    if (drum === 'k') tone(trackGain, t, { type: 'sine', from: 110, to: 45, len: 0.18, peak: 0.5 });
    if (drum === 's') hiss(trackGain, t, { len: 0.08, peak: 0.18, filter: 'highpass', from: 4000 });
    // A soft drone every bar keeps the key.
    if (step % 8 === 0) for (const p of tr.pad) tone(trackGain, t, { type: 'sine', from: freq(tr.root, p), len: len * 8, peak: 0.08, attack: 0.4 });
    step++;
  }

  function startTrack(name) {
    if (!ensure() || ctx.state !== 'running') return;
    stopTrack();
    const tr = TRACKS[name];
    playing = name;
    trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    trackGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2); // fade in
    trackGain.connect(musicBus);
    step = 0;
    nextAt = ctx.currentTime + 0.1;
    // Look-ahead scheduler: queue the next ~0.2 s of notes every 50 ms.
    timer = setInterval(() => {
      while (nextAt < ctx.currentTime + 0.2) {
        scheduleStep(tr, nextAt);
        nextAt += 60 / tr.bpm / 2;
      }
    }, 50);
  }

  function stopTrack() {
    if (timer) clearInterval(timer);
    timer = null;
    if (trackGain) {
      const g = trackGain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); // fade out
      setTimeout(() => g.disconnect(), 1500);
    }
    trackGain = null;
    playing = null;
  }

  /** Which loop a screen wants: the menu loop before the game starts, battle in battle, else the world. */
  function trackFor(mode) {
    if (mode === 'title' || mode === 'create') return 'menu';
    if (mode === 'battle') return 'battle';
    if (mode === 'result') return playing; // let the battle loop fade under the result sting
    return 'world';
  }

  /** Called on every screen change. */
  function onMode(mode) {
    wanted = trackFor(mode);
    if (ctx?.state !== 'running' || wanted === playing) return;
    if (wanted) startTrack(wanted);
    else stopTrack();
  }

  function bind() {
    for (const ev of ['pointerdown', 'keydown']) root.addEventListener(ev, unlock, { passive: true });
    root.document?.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (root.document.hidden) ctx.suspend();
      else ctx.resume().then(() => wanted && !playing && startTrack(wanted));
    });
  }

  CL.audio = { SFX, TRACKS, MAX_VOICES, setVolumes, play, onMode, trackFor, unlock, bind, stop: stopTrack, playing: () => playing };
})(typeof window !== 'undefined' ? window : globalThis);
