/* Crownless content: news. Plain classic script; no modules, no fetch.
 * GDD §4/§12 "regional news": at a fixed interval one news line is written from recent simulated
 * events (caravan losses, patrol defeats, frontier clashes, forts changing hands, the player's
 * deeds). Each kind has a priority (the bulletin tells the most important recent event) and one or
 * more lines, picked in turn. `market` is the line the Trade screen shows at the town concerned.
 * Placeholders: {place} nearest settlement, {dest} destination, {good}, {faction} / {winner} /
 * {loser} (a kingdom's short name: "Valedorn"), {owner} (its full name), {fort}, {hero}.
 * `tensions` is the quiet-days fallback, varied by ending. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.news = {
    fort_taken: {
      id: 'fort_taken',
      priority: 6,
      lines: ['{fort} has changed hands. The banner of the {owner} flies over its gate now.']
    },
    frontier_clash: {
      id: 'frontier_clash',
      priority: 5,
      lines: [
        '{winner} and {loser} patrols came to blows near {place}. The {winner} riders held the field.',
        'Blood on the border near {place}: {winner} riders drove {loser} soldiers off the road.'
      ],
      // Clashes go on after every ending (GDD §12); under the road peace they read as it fraying.
      byEnding: {
        compromise: [
          'The road peace frays: {winner} and {loser} patrols came to blows near {place}.',
          'Hotheads on both sides: {winner} riders chased {loser} soldiers off the road near {place}, peace or no peace.'
        ]
      }
    },
    caravan_lost: {
      id: 'caravan_lost',
      priority: 4,
      lines: [
        'Road Reavers fell on {faction} wagons near {place}. {good} will cost more in {dest} for a while.',
        'The {faction} caravan bound for {dest} never arrived. Reavers took it near {place}.'
      ],
      market: 'Traders grumble: Reavers took the {faction} caravan bound here, and {good} costs more for it.'
    },
    patrol_beaten: {
      id: 'patrol_beaten',
      priority: 4,
      lines: ['Road Reavers cut up {faction} soldiers near {place}. The roads there are not safe.']
    },
    escort_arrived: {
      id: 'escort_arrived',
      priority: 3,
      lines: ['{hero} brought {faction} wagons safely into {dest}, Reavers or no Reavers.'],
      market: 'The caravan you guarded came in with {good}. Its price has eased.'
    },
    player_deed: {
      id: 'player_deed',
      priority: 3,
      lines: [
        'Travellers talk of {hero}, who broke a band of Road Reavers near {place}.',
        'Word on the road: a band of Reavers near {place} met {hero} and did not walk away.'
      ]
    },
    reavers_broken: {
      id: 'reavers_broken',
      priority: 2,
      lines: ['{faction} soldiers broke a band of Road Reavers near {place}.']
    },
    delivered: {
      id: 'delivered',
      priority: 1,
      lines: ['{hero} delivered {good} to {dest}, as promised.'],
      market: 'Your load of {good} has reached the stalls. It sells a little cheaper now.'
    },
    caravan_arrived: {
      id: 'caravan_arrived',
      priority: 1,
      lines: ['{faction} wagons reached {dest} with {good}. Prices there have eased.'],
      market: 'The {faction} caravan came in with {good}. It is cheaper here for now.'
    },
    tensions: {
      id: 'tensions',
      priority: 0,
      lines: [
        'Greywall still flies the banner of the {owner}, and both crowns watch it.',
        'Both claimants are said to be counting swords along the border.',
        'Quiet days on the road. Merchants do not trust them.'
      ],
      byEnding: {
        valedorn: ['The Crown’s hold on Greywall is firm. Aurelian riders still watch it from the east.'],
        aurelian: ['The Remnant’s magistrates sit in Greywall now. Valedorn has not forgotten.'],
        compromise: ['The road peace at Greywall holds, for now. Both banners fly over its gate.']
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
