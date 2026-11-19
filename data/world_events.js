/* Crownless content: world_events (P7-08). Plain classic script; no modules, no fetch.
 * Dynamic world events: things that happen at a settlement because of the state of the world, run by
 * js/happenings.js. Each kind is one of the handlers there (its id), and here are its words and numbers:
 *   where     what the world must be like there (checked in js/happenings.js):
 *               hungry      a market whose grain is dear, or whose owner is at war, or whose caravan was lost
 *               farms       a village
 *               threatened  a town or village whose kingdom is at odds with another
 *               towns       a town (the letter goes to another settlement `distance` away)
 *               war         a market near trouble: its kingdom at war, or a clash or a fort taken in its region
 *   weight    how likely it is to be the one that starts, among the kinds that could
 *   days      how long it lasts; then it ends by itself, and `ignored` happens
 *   cooldown  days before the same kind can start again in the same region
 *   text      what you are told in the town; `ignored` is what happens if no one helps (always shown)
 *   news      the news lines: `start`, and one per result
 *   chronicle the company's own line, for each result it had a hand in
 *   choices   what you can do there (one decision: take part or not); numbers are the handler's
 * Placeholders: {place}, {dest} (the courier's destination), {owner} (the kingdom holding {place}),
 * {n} (the amount a choice asks for), {gold} (the pay). */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.world_events = {
    food_shortage: {
      id: 'food_shortage',
      name: 'Food shortage',
      where: 'hungry',
      weight: 3,
      days: 6,
      cooldown: 14,
      rise: 0.15, // grain scarcity held at least this far above the town's usual while it lasts
      after: 0.2, // …and left this far above it when nobody helped (it drifts back from there)
      dearAbove: 0.08, // the condition: grain this far above its usual
      rations: 20, // what selling to the reeve takes
      rep: 3,
      text: 'Bread is short in {place}: the granary is nearly bare and grain costs dear. The reeve will buy {n} rations at the old price.',
      ignored: 'If no one brings food, grain stays dear in {place} for a week more.',
      news: {
        start: 'Hunger in {place}: grain is short and its price climbs by the day.',
        eased: 'A company sold food to {place} at the old price, and its bread is back.',
        ignored: 'No relief came to {place}. Its grain stays dear.'
      },
      chronicle: { eased: 'Sold {n} rations to hungry {place} at the old price.', ignored: 'Rode on from hungry {place}; grain stayed dear there.' },
      choices: [{ id: 'sell', text: 'Sell {n} rations at the old price ({gold} crowns)' }]
    },
    infestation: {
      id: 'infestation',
      name: 'Bandits in the fields',
      where: 'farms',
      weight: 3,
      days: 8,
      cooldown: 16,
      band: 'bandits', // the party template the band is drawn from
      strength: [0.5, 0.9], // its power, against the company's
      troopPool: ['looter', 'looter', 'reaver'],
      minTroops: 3,
      maxTroops: 8,
      distance: [4, 7], // map units from the village
      bounty: { goldBase: 30, goldPerTroop: 6, renown: 2, rep: 3 },
      plunder: 0.15, // scarcity added to the village's grain and wool when the band is left alone
      text: 'Reavers have come down on the fields around {place}, burning ricks and taking sheep. The villagers offer a bounty of {gold} crowns to whoever drives them off.',
      ignored: 'If no one drives them off, they plunder the farms and leave: grain and wool cost more in {place}.',
      news: {
        start: 'Reavers are loose in the fields around {place}. The villagers have put up a bounty.',
        cleared: 'The Reavers around {place} were cut down, and the bounty paid.',
        others: 'The Reavers around {place} are gone: someone else saw to them.',
        ignored: 'The Reavers plundered the farms of {place} and made off. Grain and wool are dear there now.'
      },
      chronicle: { cleared: 'Drove the Reavers from the fields of {place} and took the bounty.', ignored: 'Left the Reavers to plunder {place}.' },
      choices: [{ id: 'take', text: 'Take the bounty (the band is marked on your map)' }]
    },
    militia_request: {
      id: 'militia_request',
      name: 'The militia asks for help',
      where: 'threatened',
      weight: 2,
      days: 5,
      cooldown: 18,
      hours: 24, // drilling takes a day
      gold: 30,
      xp: 12, // to each fit soldier
      rep: 4,
      snub: 2, // reputation lost if you were asked and rode on
      text: 'With the {owner} at odds with their neighbours, the militia of {place} asks your company to drill them for a day. They pay {gold} crowns.',
      ignored: 'If you were here and rode on, the {owner} remember it (a little reputation).',
      news: {
        start: 'The militia of {place} is calling for veterans to drill them, fearing the border.',
        drilled: 'A company of veterans drilled the militia of {place}. The {owner} are grateful.',
        ignored: 'The militia of {place} drilled alone.'
      },
      chronicle: { drilled: 'Spent a day drilling the militia of {place}.', ignored: 'Rode on when the militia of {place} asked for help.' },
      choices: [{ id: 'drill', text: 'Drill the militia (one day, {gold} crowns)' }]
    },
    courier: {
      id: 'courier',
      name: 'A courier on the road',
      where: 'towns',
      weight: 2,
      days: 6,
      cooldown: 12,
      distance: [20, 70],
      gold: { base: 20, perLeague: 1 },
      renown: 1,
      rep: 2,
      late: 2, // reputation lost if you took the letter and it came too late
      text: 'A courier came into {place} with a lame horse and a letter that must reach {dest}. They will pay {gold} crowns to have it carried there in time.',
      ignored: 'If no one carries it, the letter goes by slower hands. If you take it and it comes late, the {owner} hold it against you.',
      news: {
        start: 'A courier is stuck in {place} with a letter for {dest}.',
        delivered: 'The letter from {place} reached {dest} in good time.',
        late: 'The letter from {place} reached {dest} too late, and someone is angry about it.',
        ignored: 'The letter from {place} went on by slower hands.'
      },
      chronicle: { delivered: 'Carried a letter from {place} to {dest} in time.', late: 'A letter from {place} reached {dest} too late in your hands.' },
      choices: [{ id: 'carry', text: 'Carry the letter to {dest} ({gold} crowns on delivery)' }]
    },
    refugees: {
      id: 'refugees',
      name: 'Refugees',
      where: 'war',
      weight: 2,
      days: 5,
      cooldown: 16,
      rations: 15,
      rep: 3,
      renown: 2,
      recruit: 'levy', // those who can fight join as this troop
      recruits: 2,
      burden: 0.1, // grain scarcity they leave behind when nobody helps
      text: 'Refugees from the fighting crowd the gate of {place}, hungry and with nowhere to go. A few of the younger ones would follow a company.',
      ignored: 'If no one helps, they move on and eat the town bare: grain costs more in {place}.',
      news: {
        start: 'Refugees from the fighting are gathering at {place}.',
        fed: 'A company fed the refugees at {place}.',
        took: 'A company took on some of the refugees at {place}.',
        ignored: 'The refugees at {place} moved on, and grain is dearer there for it.'
      },
      chronicle: { fed: 'Fed the refugees at {place}.', took: 'Took on {n} of the refugees at {place} as soldiers.', ignored: 'Passed the refugees at {place} by.' },
      choices: [
        { id: 'feed', text: 'Feed them ({n} rations)' },
        { id: 'take', text: 'Take on those who can fight ({n} levies)' }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
