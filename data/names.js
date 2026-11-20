/* Crownless content: name cultures (V2-03). Plain classic script; no modules, no fetch.
 * Every soldier's name comes from a culture here. Factions name their culture (`culture` in
 * factions.js); a settlement or a troop may name its own instead (settlement wins over its owner,
 * troop wins over both; the hireable Mercenary is border folk wherever you hire them).
 *
 * A culture has:
 *   given        men's first names: every soldier (D-P8g, owner 2026-11-20: regular soldiers are men)
 *   givenFemale  women's first names: noblewomen, followers and fighters may be either (P8-02)
 *   trades    occupational bynames ("Fletcher")       optional
 *   epithets  nicknames ("Greyhand", "the Quiet")      optional
 *   forms     how a full name is put together, picked by weight. Placeholders:
 *               {given} {trade} {epithet} {origin}  ({origin} is the place the soldier joined at;
 *               a form whose part is missing is skipped)
 *
 * A mod or a new world adds a culture by adding an entry here and pointing a faction at it: no code.
 * All names are invented for the game's world; none belongs to a real person. Checked at load by
 * js/content.js. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.cultures = {
    valedorn: {
      id: 'valedorn',
      name: 'Valedorn',
      about: 'Knightly border folk of the west: old Anglo-Norman-sounding names and plain trades.',
      given: ['Edric', 'Aldwin', 'Osmer', 'Godric', 'Wymar', 'Hamon', 'Rannulf', 'Gilbert', 'Walter', 'Baldric', 'Thurstan', 'Ivo', 'Roger', 'Alard', 'Serlo', 'Odo', 'Herve', 'Tancred'],
      givenFemale: ['Aelis', 'Maud', 'Edith', 'Isolde', 'Hawise', 'Emma', 'Avice', 'Rohese', 'Sibyl', 'Alys', 'Petronel', 'Joliet'],
      trades: ['Fletcher', 'Thatcher', 'Cooper', 'Mason', 'Tanner', 'Carter', 'Fowler', 'Miller', 'Dyer', 'Chandler', 'Reeve', 'Wheeler'],
      epithets: ['Greyhand', 'Oakheart', 'the Quiet', 'Halfpenny', 'Redbeard', 'the Elder', 'Stonejaw', 'Longstride', 'Tallow', 'Brightspur'],
      forms: [
        { pattern: '{given} of {origin}', weight: 4 },
        { pattern: '{given} {trade}', weight: 3 },
        { pattern: '{given} {epithet}', weight: 2 },
        { pattern: '{given}', weight: 1 },
      ],
    },
    aurelian: {
      id: 'aurelian',
      name: 'Aurelian',
      about: 'Heirs of the old empire in the east: Latin-imperial given names and family names.',
      given: ['Cassian', 'Decimo', 'Severin', 'Corvin', 'Tullio', 'Aurel', 'Varo', 'Lucan', 'Quintil', 'Marcel', 'Faustin', 'Oren', 'Silvan', 'Drusian'],
      givenFemale: ['Livia', 'Octavia', 'Junia', 'Calla', 'Fausta', 'Marcia', 'Valeria', 'Sabina', 'Aelia', 'Domitia', 'Lucia', 'Prisca'],
      trades: ['Ferox', 'Corvo', 'Lupo', 'Rufo', 'Celer', 'Vatro', 'Aquila', 'Pertinax', 'Sabo', 'Crasso', 'Stellan', 'Magno'],
      epithets: ['the Scribe', 'Ironsandal', 'of the Ninth', 'the Younger', 'Half-Legion', 'the Cartographer'],
      forms: [
        { pattern: '{given} {trade}', weight: 5 },
        { pattern: '{given} of {origin}', weight: 2 },
        { pattern: '{given} {epithet}', weight: 1 },
      ],
    },
    hrothmark: {
      id: 'hrothmark',
      name: 'Hrothmark',
      about: 'Highland clans of the north (W-05b placeholder): Norse-sounding given names and clan bynames.',
      given: ['Ulfar', 'Hakon', 'Brand', 'Eirik', 'Torvald', 'Ragnar', 'Sten', 'Orm', 'Kettil', 'Halvar', 'Gunnar', 'Asbjorn', 'Vigge', 'Thrand'],
      givenFemale: ['Ingrid', 'Sigrun', 'Astrid', 'Hilde', 'Ragna', 'Tove', 'Gudrun', 'Solveig', 'Freydis', 'Runa'],
      trades: ['Axehand', 'Smith', 'Skinner', 'Woodcutter', 'Netter', 'Boatwright', 'Charcoaler', 'Herder'],
      epithets: ['the Bear', 'Frostbeard', 'Ironside', 'the Tall', 'Wolfskin', 'Ashfoot', 'the Silent', 'Stormborn', 'Hollowcheek'],
      forms: [
        { pattern: '{given} {epithet}', weight: 4 },
        { pattern: '{given} of {origin}', weight: 3 },
        { pattern: '{given} {trade}', weight: 2 },
        { pattern: '{given}', weight: 1 },
      ],
    },
    vessaro: {
      id: 'vessaro',
      name: 'Vessaro',
      about: 'Merchant towns of the southern coast (W-05b placeholder): Italianate given names and family names.',
      given: ['Matteo', 'Lorenzo', 'Piero', 'Bastiano', 'Nero', 'Tommaso', 'Iacopo', 'Ottavio', 'Ruggero', 'Andrea', 'Salvo', 'Dario'],
      givenFemale: ['Gianna', 'Lucrezia', 'Bettina', 'Chiara', 'Fiora', 'Nella', 'Orsola', 'Rosa', 'Vanna', 'Simona'],
      trades: ['Salviati', 'Morosco', 'Bellini', 'Ferraro', 'Vescovo', 'Canale', 'Remari', 'Torrigo', 'Pescara', 'Lanza'],
      epithets: ['the Quick', 'Saltwater', 'Two-Bolts', 'the Fox', 'Redsleeve', 'the Lucky'],
      forms: [
        { pattern: '{given} {trade}', weight: 5 },
        { pattern: '{given} of {origin}', weight: 2 },
        { pattern: '{given} {epithet}', weight: 1 },
      ],
    },
    border: {
      id: 'border',
      name: 'Border folk',
      about: 'River people, drovers and sell-swords of the march: short plain names and nicknames.',
      given: ['Tam', 'Wat', 'Hob', 'Jory', 'Bran', 'Kit', 'Dell', 'Rook', 'Fenn', 'Corrie', 'Abe', 'Lew'],
      givenFemale: ['Nell', 'Moll', 'Tess', 'Bet', 'Wenna', 'Ysolt', 'Gwen', 'Pell'],
      epithets: ['Crowfoot', 'Mudlark', 'Two-Knives', 'Ferryman', 'Fenrunner', 'Saltback', 'No-Thumbs', 'Lucky', 'Ditchwater', 'Owl'],
      forms: [
        { pattern: '{given} {epithet}', weight: 5 },
        { pattern: '{given} of {origin}', weight: 2 },
        { pattern: '{given}', weight: 2 },
      ],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
