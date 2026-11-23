// @ts-check
/* Crownless troop tree, discovered as you play (V2-03b; owner idea 2026-11-17; settles finding F-1).
 *
 * One tree for every troop line (Valedorn, Aurelian, and the neutral and hireable troops), built from
 * the upgrade paths in data/troops.js. What the player knows of each troop is saved in the campaign
 * (`c.troopKnowledge[troopId]`):
 *   (missing)  never met: not shown (an unknown troop between two known ones shows as "?")
 *   'seen'     met in battle, or offered for hire: name and place on the tree only
 *   'owned'    hired, trained or upgraded into: full stats, upgrade costs and XP targets; what it
 *              can be trained into is then at least 'seen' (knowing a troop includes its paths)
 * A faction may name its line on the tree (`lineName` in data/factions.js). Knowledge only grows. It is learned by listening to events (BattleResolved's enemy troops,
 * SoldierRecruited, SoldierPromoted) and from the troops a settlement offers for hire. A debug toggle
 * (CL.game.revealTree, not saved) shows everything for testing.
 *
 * A troop at the end of its path is at its "max tier" (F-1): its XP keeps counting for its record. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const LEVELS = ['seen', 'owned'];
  /** Factions in troop-tree order (W-04: data/factions.js `order`, then by id). */
  const factionOrder = () =>
    Object.values(CL.realm.factionTable())
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || (a.id < b.id ? -1 : 1))
      .map((f) => f.id);

  const troops = () => CL.content.table('troops');
  /** @param {string} id */
  const isTroop = (id) => Boolean(troops()[id]) && id !== 'hero';
  /** Upgrade targets of a troop, main path first. @param {string} id @returns {string[]} */
  const paths = (id) => [troops()[id]?.upgradeTo, troops()[id]?.altUpgradeTo].filter((x) => x && isTroop(x));
  /** Troops that upgrade into this one. @param {string} id */
  const parentsOf = (id) => Object.keys(troops()).filter((t) => isTroop(t) && paths(t).includes(id));
  /** The start of each line: troops nothing upgrades into. */
  const roots = () => Object.keys(troops()).filter((id) => isTroop(id) && !parentsOf(id).length);
  /** At the end of its path (F-1: "max tier"). @param {string} id */
  const maxTier = (id) => paths(id).length === 0;

  /** What the player knows of a troop: 'owned', 'seen' or null. @param {Campaign} c @param {string} id */
  function level(c, id) {
    if (CL.game?.revealTree && isTroop(id)) return 'owned';
    const k = c.troopKnowledge?.[id];
    return LEVELS.includes(k) ? k : null;
  }

  /**
   * Learn about a troop. Knowledge only grows: 'seen' never replaces 'owned'.
   * @param {Campaign} c @param {string} id @param {'seen' | 'owned'} how @returns {boolean} true if this was new
   */
  function learn(c, id, how) {
    if (!isTroop(id) || !LEVELS.includes(how)) return false;
    if (!c.troopKnowledge) c.troopKnowledge = {};
    const was = c.troopKnowledge[id];
    if (was === 'owned' || was === how) return false;
    c.troopKnowledge[id] = how;
    if (how === 'owned') for (const to of paths(id)) learn(c, to, 'seen');
    return true;
  }

  /** The troops a settlement offers for hire are seen (their names are on the hiring buttons). @param {Campaign} c */
  function seeOffers(c) {
    for (const id of CL.party.recruitsHere(c)) learn(c, id, 'seen');
  }

  CL.events.on('BattleResolved', (e, c) => {
    for (const id of /** @type {string[]} */ (e.enemyTroops || [])) learn(c, id, 'seen');
  });
  CL.events.on('SoldierRecruited', (e, c) => learn(c, /** @type {string} */ (e.troop), 'owned'));
  CL.events.on('SoldierPromoted', (e, c) => {
    learn(c, /** @type {string} */ (e.from), 'owned');
    learn(c, /** @type {string} */ (e.to), 'owned');
  });

  /**
   * The tree as the player knows it: one line per faction, each a list of root nodes. Branches with
   * nothing known are left out; an unknown troop above a known one shows as unknown.
   * @param {Campaign} c
   * @returns {Array<{ faction: string, name: string, nodes: TreeNode[] }>}
   */
  function view(c) {
    /** @param {string} id @returns {TreeNode | null} */
    const node = (id) => {
      const kids = paths(id).map(node).filter(Boolean);
      const known = level(c, id);
      if (!known && !kids.length) return null;
      const t = troops()[id];
      /** @type {TreeNode} */
      const n = { id, level: known || 'unknown', children: kids };
      if (known) n.name = t.name;
      if (known === 'owned') {
        const mine = c.roster.filter((s) => s.troop === id);
        Object.assign(n, {
          tier: t.tier,
          role: t.role,
          stats: { hp: t.hp, damage: t.damage, armor: t.armor, wage: t.wage },
          maxTier: maxTier(id),
          paths: CL.party.upgradeOptions(id).map((o) => ({ to: o.to, cost: o.cost, xp: o.xp })),
          count: mine.length,
          ready: mine.filter((s) => CL.party.readyFor(s)).length,
        });
      }
      return n;
    };
    const lines = [];
    for (const f of factionOrder()) {
      const nodes = roots()
        .filter((id) => troops()[id].faction === f)
        .map(node)
        .filter(Boolean);
      const fd = CL.realm.faction(f);
      if (nodes.length) lines.push({ faction: f, name: fd?.lineName || fd?.name || f, nodes });
    }
    return lines;
  }

  // ---- Saves ----

  /** Keep only known troops and valid levels. @param {Campaign} s the campaign being built @param {any} d */
  function sanitize(s, d) {
    s.troopKnowledge = {};
    const k = d?.troopKnowledge;
    if (!k || typeof k !== 'object') return;
    for (const [id, how] of Object.entries(k)) if (isTroop(id) && LEVELS.includes(how)) s.troopKnowledge[id] = how;
  }

  /**
   * Save migration 5 → 6 (pure): an older company knows the troops it has now, and what they were
   * trained from (a Footman was a Levy once). Nothing else was ever recorded.
   * @param {Record<string, any>} d @returns {Record<string, any>}
   */
  function migrateKnowledge(d) {
    /** @type {Record<string, string>} */
    const known = {};
    const own = (id) => {
      if (!isTroop(id) || known[id] === 'owned') return;
      known[id] = 'owned';
      for (const p of parentsOf(id)) own(p);
    };
    for (const s of Array.isArray(d.roster) ? d.roster : []) own(s?.troop);
    for (const id of Object.keys(known)) for (const to of paths(id)) if (!known[to]) known[to] = 'seen';
    return { ...d, troopKnowledge: known };
  }

  CL.troopTree = { LEVELS, paths, parentsOf, roots, maxTier, level, learn, seeOffers, view, sanitize, migrateKnowledge };
})(typeof window !== 'undefined' ? window : globalThis);
