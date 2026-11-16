/* Crownless runtime state: the live battle/game object.
 * CL.campaign (persistent party data) is assigned at boot by main.js. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  CL.game = {
    mode: 'title', // 'title' | 'camp' | 'battle' | 'result'
    hero: null,
    allies: [],
    enemies: [],
    arrows: [],
    effects: [],
    wave: 0,
    totalWaves: 2,
    kills: 0,
    t: 0,
    paused: false,
    group: 'infantry',
    orders: { infantry: 'follow', archer: 'hold' },
    result: null,
    hold: {}, // keyboard codes currently held
    joystick: { x: 0, y: 0 },
    attackHeld: false,
    attackQueuedAt: null, // battle time of the last attack press (input buffer)
    blockHeld: false,
    message: '',
    messageUntil: 0,
    nextEnemyId: 1,
  };

  CL.campaign = null;
})(typeof window !== 'undefined' ? window : globalThis);
