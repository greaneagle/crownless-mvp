/* Crownless content: businesses (P7-10). Plain classic script; no modules, no fetch.
 * Decision D-P7b: the first business is a mill (an inn later). One record per kind, used by
 * js/business.js:
 *   price        what it costs to buy, by the settlement's type (only these types sell one)
 *   sellBack     the share of the price paid you get back when you sell (below 1: no money loop)
 *   input/output the good it buys and the good it makes of it, in the same market
 *   managers     who runs it: the default comes with it (no hiring fee); a better one costs a fee.
 *                Each has a weekly wage (from the business's own money), how many units they work a
 *                week, the flour they make of each sack of grain (`yield`: a master wastes less and
 *                grinds finer), and the least profit a sack must leave after the owner's due (`margin`)
 *   rules        the price limits you may set (expert): the most they pay for the input, the least
 *                they sell the output for; null means "no limit"
 *   due          the share of each week's sales the settlement's owner takes (the lord's due)
 *   seizeDays    days of warning before a Hostile owner seizes it (sell before then)
 *   repairs      the weekly chance of a breakdown, and what mending it costs (no work that week)
 *   limit        how many of this kind you may own */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;
  C.businesses = {
    mill: {
      id: 'mill',
      name: 'Mill',
      price: { village: 300, town: 600 },
      sellBack: 0.6,
      input: 'grain',
      output: 'flour',
      managers: {
        miller: { name: 'the village miller', hire: 0, wage: 6, perWeek: 20, yield: 1, margin: 1 },
        master: { name: 'a master miller', hire: 60, wage: 12, perWeek: 30, yield: 1.2, margin: 1 }
      },
      rules: { maxInput: [null, 8, 10, 12, 14], minOutput: [null, 11, 13, 15, 17] },
      due: 0.1,
      seizeDays: 7,
      repairs: { chance: 0.08, cost: 20 },
      limit: 1
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
