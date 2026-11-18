// Settings and audio (GDD §11 "Separate Music/SFX volumes; toggle … reduced particles", "HP bars
// optional"; §12 "12–18 reusable SFX … 3 music loops"; Gate E 5.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');

test('settings: defaults, validation, saved on the device and applied to the battle size', () => {
  const { CL, storage } = loadGame();
  const S = CL.settings;
  assert.deepEqual({ ...S.load() }, { music: 50, sfx: 70, battleSize: 40, battlefield: 'large', prepPreset: 'balanced', prepSkip: false, prepCustom: null, reducedEffects: false, healthBars: true, tips: true, fullscreen: false, textSize: 'normal', mapZoom: 1, battleZoom: 1 });
  assert.equal(S.set('battleSize', 20), true);
  assert.equal(CL.combat.BATTLE.activeCap, 20, 'applied at once');
  assert.equal(S.set('battleSize', 25), false, 'only the offered sizes');
  assert.equal(S.set('music', 150), false);
  assert.equal(S.set('sfx', 35), true);
  assert.equal(S.set('nonsense', 1), false);
  assert.deepEqual(JSON.parse(storage.data[S.KEY]), { music: 50, sfx: 35, battleSize: 20, battlefield: 'large', prepPreset: 'balanced', prepSkip: false, prepCustom: null, reducedEffects: false, healthBars: true, tips: true, fullscreen: false, textSize: 'normal', mapZoom: 1, battleZoom: 1 });
  // Junk in storage falls back to the defaults, setting by setting.
  storage.data[S.KEY] = JSON.stringify({ music: 'loud', sfx: -20, battleSize: 99, reducedEffects: 'yes', healthBars: false });
  assert.deepEqual({ ...S.load() }, { music: 50, sfx: 0, battleSize: 40, battlefield: 'large', prepPreset: 'balanced', prepSkip: false, prepCustom: null, reducedEffects: false, healthBars: false, tips: true, fullscreen: false, textSize: 'normal', mapZoom: 1, battleZoom: 1 });
  storage.data[S.KEY] = '{not json';
  assert.equal(S.load().music, 50);
});

test('settings belong to the device, not the campaign: not in the save, untouched by an import', () => {
  const { CL, storage } = loadGame();
  CL.settings.load();
  CL.settings.set('music', 10);
  CL.save.write();
  assert.equal('music' in JSON.parse(storage.data[CL.save.KEY]), false);
  const text = CL.portable.serialize();
  CL.portable.importText(text);
  assert.equal(CL.settings.get('music'), 10);
});

/** A minimal Web Audio stand-in that records what the synthesizer builds. */
function fakeAudio(sandbox) {
  const log = { oscillators: 0, sources: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (extra = {}) => ({ connect: (n) => n, disconnect() {}, ...extra });
  class FakeContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = node();
    }
    createGain() {
      return node({ gain: param() });
    }
    createOscillator() {
      log.oscillators++;
      return node({ type: '', frequency: param(), start() {}, stop() {} });
    }
    createBufferSource() {
      log.sources++;
      return node({ buffer: null, start() {}, stop() {} });
    }
    createBiquadFilter() {
      return node({ type: '', Q: param(), frequency: param() });
    }
    createBuffer(_ch, n) {
      const data = new Float32Array(n);
      return { getChannelData: () => data };
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {}
  }
  Object.assign(sandbox, { AudioContext: FakeContext, setTimeout, clearTimeout, setInterval, clearInterval });
  return log;
}

test('audio: silent and harmless without Web Audio (old browsers, Node)', () => {
  const { CL } = loadGame();
  assert.equal(CL.audio.play('hit'), false);
  CL.audio.unlock();
  CL.audio.onMode('battle');
  assert.equal(CL.audio.playing(), null);
});

test('audio: 14 synthesized effects, rate-limited per sound and capped overall', () => {
  const { CL, sandbox } = loadGame();
  const log = fakeAudio(sandbox);
  CL.audio.unlock();
  const names = Object.keys(CL.audio.SFX);
  assert.ok(names.length >= 12 && names.length <= 18, `GDD asks for 12–18 effects, have ${names.length}`);
  assert.equal(CL.audio.play('hit'), true);
  assert.equal(CL.audio.play('hit'), false, 'the same sound again at once is skipped');
  const played = names.filter((n) => n !== 'hit' && CL.audio.play(n)).length;
  assert.equal(played, CL.audio.MAX_VOICES - 1, 'never more than the voice cap at once');
  assert.ok(log.oscillators + log.sources > 0, 'built from oscillators and noise, no files');
  CL.settings.set('sfx', 0);
  assert.equal(CL.audio.play('select'), false, 'muted effects stay silent');
});

test('audio: three loops follow the screen — menu, world, battle', () => {
  const { CL, sandbox } = loadGame();
  fakeAudio(sandbox);
  assert.equal(Object.keys(CL.audio.TRACKS).length, 3);
  CL.audio.onMode('title');
  CL.audio.unlock(); // the first tap starts the music the screen wants
  assert.equal(CL.audio.playing(), 'menu');
  CL.audio.onMode('map');
  assert.equal(CL.audio.playing(), 'world');
  CL.audio.onMode('town');
  assert.equal(CL.audio.playing(), 'world', 'town keeps the world loop going');
  CL.audio.onMode('battle');
  assert.equal(CL.audio.playing(), 'battle');
  CL.audio.onMode('result');
  assert.equal(CL.audio.playing(), 'battle', 'the battle loop fades under the result sting');
  CL.audio.stop();
  assert.equal(CL.audio.playing(), null);
});

test('a battle with sound on runs as before: swings, hits, arrows and falls make noise', () => {
  const { CL, sandbox } = loadGame();
  fakeAudio(sandbox);
  CL.audio.unlock();
  const calls = [];
  const play = CL.audio.play;
  CL.audio.play = (n, v) => {
    calls.push([n, v]);
    return play(n, v);
  };
  for (const t of ['footman', 'hunter', 'rider']) CL.save.addSoldier(CL.campaign, t);
  CL.combat.startBattle({ id: 't', name: 'T', map: 'forest_clearing', waves: [{ looter: 5 }], reward: { goldBase: 0, goldPerKill: 0, renown: 0 }, loot: 'low' });
  Object.assign(CL.game, { hold: {}, joystick: { x: 0, y: 0 }, godMode: true });
  assert.equal(CL.audio.playing(), 'battle', 'the battle loop starts with the battle');
  for (let i = 0; i < 60 * 20 && CL.game.mode === 'battle'; i++) CL.combat.update(1 / 60);
  const kinds = new Set(calls.map(([n]) => n));
  for (const k of ['swing', 'hit', 'down']) assert.ok(kinds.has(k), `${k} heard`);
  assert.ok(calls.every(([, v]) => v === 1 || v === 0.4), 'the hero loud, the rest quieter');
  CL.audio.stop();
});
