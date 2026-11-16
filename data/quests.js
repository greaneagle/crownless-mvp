/* Crownless content: quests. Plain classic script; no modules, no fetch. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.quests = {
    q1: {
      id:'q1',
      title:"A Stranger's Wage",
      giver:'stonebridge_elder',
      stages:[
        {id:'q1_escort_wagon',description:'Escort a wagon to Stonebridge',objective:'escort'},
        {id:'q1_clear_bandits',description:'Clear bandits from the road',objective:'clear'},
        {id:'q1_help_recruiter',description:'Help the recruiter',objective:'assist'}
      ],
      rewards:{gold:50,renown:15}
    },
    q2: {
      id:'q2',
      title:'The Broken Seal',
      giver:'caravan_master',
      stages:[
        {id:'q2_ambush',description:'Survive the caravan ambush',objective:'survive'},
        {id:'q2_recover_packet',description:'Recover the courier packet',objective:'recover'},
        {id:'q2_choose_faction',description:'Show or keep the packet',objective:'choice'}
      ],
      rewards:{gold:80,renown:15}
    },
    q3: {
      id:'q3',
      title:'Two Banners',
      giver:'valedorn_agent',
      stages:[
        {id:'q3_choose_contract',description:"Take one claimant's contract",objective:'choice'},
        {id:'q3_linked_encounter',description:'Resolve the linked patrol/caravan clash',objective:'resolve'},
        {id:'q3_mara_survival',description:'Keep Mara alive',objective:'protect'}
      ],
      rewards:{gold:120,renown:15}
    },
    q4: {
      id:'q4',
      title:'The Greywall Verdict',
      giver:'aurelian_agent',
      stages:[
        {id:'q4_field_battle',description:'Win the deciding battle',objective:'battle'},
        {id:'q4_negotiation',description:'Choose the settlement terms',objective:'choice'},
        {id:'q4_ending',description:'Resolve Valedorn/Aurelian/compromise',objective:'choice'}
      ],
      rewards:{gold:200,renown:15}
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
