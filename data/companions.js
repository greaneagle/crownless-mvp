/* Crownless content: companions. Plain classic script; no modules, no fetch.
 * GDD §10: one named companion, Mara, a former imperial scout (the story's), and from P7-06 others (below). Recruitable after Q2 for a modest
 * cost or through a short trust dialogue. She fights autonomously, equips a weapon and armour, and
 * gives +1 Pathfinding while conscious. She takes one party slot and eats like anyone else.
 *   hp, armor, speed, reach   her own numbers in battle (armour adds to her body armour)
 *   weaponFactor              share of her weapon's damage she deals (a skilled scout, not a knight)
 *   skills                    bonuses to the hero's skills while she is fit (not wounded)
 *   gearSlots                 what she can be given from the pack
 *   startGear                 what she arrives with (not taken from the player)
 *   woundDays                 how long she is out after going down in battle or a capture */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.companions = {
    mara: {
      id: 'mara',
      name: 'Mara',
      title: 'former imperial scout',
      look: { female: true, skin: '#e2b48c', hair: '#3b2a20', hairStyle: 'tied', tunic: '#6b6a4a', armour: 'leather', cloak: '#5a5a3c', helmet: 'hood', hoodColor: '#5a5a3c', weapon: 'sword' }, // P10-G1: the scout's hood and cloak
      hp: 80,
      armor: 1,
      speed: 100,
      reach: 50,
      weaponFactor: 0.75,
      unarmedDamage: 6,
      skills: { pathfinding: 1 },
      gearSlots: ['weapon', 'body'],
      startGear: { weapon: 'worn_sword', body: 'gambeson' },
      hireCost: 100,
      woundDays: 2
    },
    // P7-06: companions of the wider world (js/retinue.js). Each lives in one land, joins after a small
    // errand of their own, rides with Mara or without her, can captain a patrol (P7-05), draws a weekly
    // wage, and stays only while loyal. Loyalty (0–100, starting at `loyalty.start`) moves with pay,
    // victories and defeats, and their motive: `likes` and `dislikes` name events (bandits_beaten,
    // kingdom_attacked, toll_paid, caravan_saved, paid, unpaid) with how much each moves it.
    // Placeholder characters (data only), like the kingdoms of W-05b.
    sigrun: {
      id: 'sigrun',
      name: 'Sigrun Ashfoot',
      title: 'huntress of the Hrothmark clans',
      retinue: true,
      home: 'hrothgard',
      motive: 'Raiders burned her steading. She wants every band of them broken, and has no patience for paying them off.',
      look: { female: true, skin: '#f1c9a5', hair: '#d9b36a', hairStyle: 'braid', tunic: '#62695a', armour: 'fur', weapon: 'axe' },
      hp: 88,
      armor: 2,
      speed: 96,
      reach: 52,
      weaponFactor: 0.8,
      unarmedDamage: 6,
      skills: { tactics: 1 },
      gearSlots: ['weapon', 'body'],
      startGear: { weapon: 'hand_axe', body: 'leather_chest' },
      wage: 8,
      woundDays: 2,
      loyalty: { start: 60, likes: { bandits_beaten: 4 }, dislikes: { toll_paid: -10 } }
    },
    iacopo: {
      id: 'iacopo',
      name: 'Iacopo Lanza',
      title: 'disgraced crossbow captain of the League',
      retinue: true,
      home: 'vessara',
      motive: 'He sold his sword to pay his debts and will sell it again to whoever pays on time. Coin keeps him; a missed wage loses him fast.',
      look: { skin: '#c98f63', hair: '#2a2421', beard: true, tunic: '#d8c48e', armour: 'gambeson', hat: 'brim', hatColor: '#6a4a2a', band: '#b5862a', cloak: '#8a5a2a', weapon: 'sword' },
      hp: 76,
      armor: 1,
      speed: 98,
      reach: 50,
      weaponFactor: 0.8,
      unarmedDamage: 6,
      skills: { trade: 1 },
      gearSlots: ['weapon', 'body'],
      startGear: { weapon: 'arming_sword', body: 'gambeson' },
      wage: 12,
      woundDays: 2,
      loyalty: { start: 55, likes: { paid: 3 }, dislikes: { unpaid: -15 } }
    },
    livia: {
      id: 'livia',
      name: 'Livia Corvo',
      title: 'legion medic turned deserter',
      retinue: true,
      home: 'tessaro',
      motive: 'She left the legion over what it did to ordinary people. She will follow a captain who protects the roads, never one who preys on them.',
      look: { female: true, skin: '#e2b48c', hair: '#6b4a2e', hairStyle: 'bun', tunic: '#e9dcc0', armour: 'leather', apron: '#b0453a', weapon: 'sword' },
      hp: 80,
      armor: 2,
      speed: 96,
      reach: 50,
      weaponFactor: 0.7,
      unarmedDamage: 6,
      skills: { shield: 1 },
      gearSlots: ['weapon', 'body'],
      startGear: { weapon: 'worn_sword', body: 'leather_chest' },
      wage: 8,
      woundDays: 2,
      loyalty: { start: 60, likes: { caravan_saved: 5, bandits_beaten: 1 }, dislikes: { kingdom_attacked: -15 } }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
