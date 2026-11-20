// A save from before P8-02 (schema v18 and older) had `owners` (fort → kingdom) and no holdings or
// people. Tests that make an older save out of a current campaign turn it back with this.
/** @param {Record<string, any>} d a plain copy of a campaign, changed in place and returned */
function preHoldings(d) {
  const owners = {};
  for (const [sid, h] of Object.entries(d.holdings || {})) if (h.kind === 'fort') owners[sid] = h.controller;
  for (const k of ['holdings', 'people', 'rulers', 'nextPersonId']) delete d[k];
  d.owners = owners;
  return d;
}

module.exports = { preHoldings };
