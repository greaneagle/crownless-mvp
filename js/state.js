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
    travel: null, // current journey target on the world map
    travelFace: 'down',
    siteId: null, // map site whose encounter is open or being fought
    partyId: null, // world party whose encounter is open or being fought
    contactParty: null, // set by the world sim when a band catches the player
    waiting: false, // map: time passes without travelling
    releasedAt: null, // settlement id after a capture, for the release message
    godMode: false, // debug panel: the hero takes no damage
    newGame: false, // true while the creator is making a fresh campaign
    confirmNew: false, // title screen: second press of New game erases the save
    returnMode: 'map', // where the character sheet goes back to
  };

  CL.campaign = null;
})(typeof window !== 'undefined' ? window : globalThis);
