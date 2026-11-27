/* P11-17. Unlock records keep their own ids so gear and packs can refer to them. */
(function (root) {
  const C = root.CROWNLESS_CONTENT;
  C.training = {
    lance_couching: { id: 'lance_couching', skills: { riding: 1 } },
    longaxe: { id: 'longaxe', skills: { two_handed: 1 } },
    pike_brace: { id: 'pike_brace' },
    mounted_archery: { id: 'mounted_archery', skills: { archery: 1 } },
    hrolf: {
      id: 'hrolf', master: 'Master Hrolf', title: 'The longaxe', place: 'hrothgard', role: 'guard',
      teaches: ['longaxe'], fee: 45, needs: { req: { str: 7, skills: { two_handed: 1 } } },
      steps: [{ kind: 'talk' }, { kind: 'pay' }, { kind: 'bout', style: 'counter', weapon: 'great_axe' }],
      words: 'Give me one clean opening. That huge axe will do the rest.'
    },
    alda: {
      id: 'alda', master: 'Master Alda', gender: 'female', title: 'The couched lance', place: 'stonebridge', role: 'guard',
      teaches: ['lance_couching'], fee: 55, needs: { req: { skills: { riding: 2 } } },
      steps: [{ kind: 'talk' }, { kind: 'pay' }, { kind: 'course', weapon: 'war_lance', horse: 'rouncey' }],
      words: 'Let the horse gather speed before you strike. Take all three posts.'
    },
    verrin: {
      id: 'verrin', master: 'Master Verrin', title: 'The flats pike', place: 'calder', role: 'guard',
      teaches: ['pike_brace'], fee: 40, needs: { req: { str: 6, skills: { polearm: 2 } } },
      steps: [{ kind: 'talk' }, { kind: 'pay' }, { kind: 'bout', style: 'rider', troop: 'rider', weapon: 'ash_spear' }],
      words: 'Meet my horse with the point. Give yourself room to set it.'
    },
    selim: {
      id: 'selim', master: 'Master Selim', title: 'The horse bow', place: 'merrow', alsoAt: ['gullhaven'], role: 'guard',
      teaches: ['mounted_archery'], fee: 60, needs: { req: { skills: { riding: 2, archery: 1 } } },
      steps: [{ kind: 'talk' }, { kind: 'pay' }, { kind: 'range', weapon: 'short_bow' }, { kind: 'course', weapon: 'short_bow', horse: 'rouncey' }],
      words: 'I learned across the sea. Show me you can shoot on foot, then take the bow into the saddle.'
    }
  };
  C.practice = {
    retrain: 100,
    sparring: ['brawler', 'counter', 'shield_wall'],
    targets: [[486, 251], [598, 301], [708, 251]],
    names: { bout: 'Sparring bout', range: 'Archery range', course: 'Riding course' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
