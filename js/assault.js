// @ts-check
/* Crownless assault battle (P8-06b, decision D-P8a): a siege's assault fought on a fort's wall
 * (js/arena.js `assault`), attacking your own siege's fort or defending a fort you are in.
 *
 * - **The map:** the wall across the field, a gate (shut unless the ram broke it), one to three ladder
 *   points (more with longer preparation: a ladder a day, three at most), the walkway behind it (high
 *   ground: archers there shoot 25% further) and the courtyard. Defending, it is mirrored.
 * - **The ram** (after three days of preparation): attackers at the gate break it after 25 seconds
 *   there; then the gate is open to everyone. On a defence, a third of the attackers go for the gate.
 * - **Ways up:** only the ladders and a broken gate. A soldier whose way is across the wall goes to the
 *   nearest gap first (`arena.wayThrough`); without one open, they wait at the wall. P9-B5: a ladder
 *   takes two climbers at a time, slowly (slow ground, so ranks break as in a ford), and a climber
 *   cannot strike; the others wait at its foot.
 * - **The armies (P9-B5):** one army a side sharing the field, with reserves (P9-B2), no longer waves
 *   of 8. Storming, you meet the part of the garrison on the stretch of wall you strike (58%); the rest
 *   hold the other walls. Defending, the garrison runs to where the enemy climbs (95% of it beside you; P10-T),
 *   counted on your side of the field, the rest waiting in reserve.
 * - **Winning:** the attackers win by routing the defenders, or by holding the courtyard: three or more
 *   of them in it, outnumbering the defenders still standing there 1.5 to one, for 12 seconds. The
 *   defenders win by routing the attackers, or breaking their morale. The result feeds the siege
 *   (js/sieges.js): taken, thrown back, or held.
 * - **Setups on the walls:** Balanced puts the infantry at the ladders and the archers behind them;
 *   Defensive (defending) puts the archers on the walkway and the infantry at the gate.
 * - **A lost assault isn't a capture:** you are thrown back with your losses, and keep your money. A
 *   lost defence is: the fort falls with you in it. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const RULES = { ramSeconds: 25, ramReach: 70, hold: { seconds: 12, min: 3, ratio: 1.5 }, ramEvery: 3, garrisonShare: { attack: 0.58, defend: 0.95 }, ladder: { at: 2, foot: 20, wait: 30 } };

  /**
   * The battle definition for an assault on (or defence of) a fort. `side`: 'attack' or 'defend'.
   * @param {any} c @param {string} sid @param {string} side @param {{ ladders?: number, ram?: boolean, enemyTroops?: Record<string, number> }} [opts]
   */
  function encounter(c, sid, side, { ladders = 1, ram = false, enemyTroops = undefined } = {}) {
    const h = CL.realm.holding(sid, c);
    const troops = enemyTroops || h.garrison || {};
    const all = CL.autoresolve.expand(troops);
    const list = enemyTroops ? all : onThisWall(all, 'attack'); // storming: the part of the garrison on this stretch of wall
    const waves = [list.length ? CL.autoresolve.collapse(list) : { levy: 1 }];
    const name = CL.content.get('settlements', sid).name;
    return {
      id: `assault_${sid}`,
      name: side === 'attack' ? `The walls of ${name}` : `The defence of ${name}`,
      map: 'assault',
      mapDef: CL.arena.assault({ ladders, gateOpen: false, defend: side === 'defend' }),
      waves,
      reward: { goldBase: 60, goldPerKill: 4, renown: 15 },
      loot: 'high',
      siege: { sid, side, ladders, ram },
      share: true,
    };
  }

  /**
   * The part of a garrison on the stretch of wall under assault; the rest hold the other walls. Storming,
   * you choose where to strike (P9-B5: 58%); defending, the garrison runs to where the enemy climbs (95%;
   * P10-T: at 90% a fought defence came out 12 under the odds, at 100% 21 over).
   * @param {string[]} list @param {'attack' | 'defend'} side
   */
  const onThisWall = (list, side) => list.slice(0, Math.ceil(list.length * RULES.garrisonShare[side]));

  /** At the start of an assault battle: the gate, the ram, the hold timer. Called by combat.startBattle. @param {any} g @param {any} enc */
  function begin(g, enc) {
    g.siege = null;
    if (!enc?.siege) return;
    g.siege = { ...enc.siege, ramT: 0, holdT: 0, gateOpen: Boolean(g.battleMap.gateOpen), noted: false };
    // This battle's own copy of the map: the gate comes down in this one only.
    g.battleMap = { ...g.battleMap, obstacles: [...g.battleMap.obstacles] };
  }

  /** The assault's first words, once the defenders stand on the wall (after the first wave's line). @param {any} g */
  function announce(g) {
    const s = g.siege;
    if (s) CL.ui.message(s.side === 'attack' ? `To the walls! ${s.ladders} ladder${s.ladders > 1 ? 's' : ''} up${s.ram ? ', and the ram for the gate' : ''}.` : 'They are coming over the walls!');
  }

  /** The attackers' units in this battle. @param {any} g */
  const attackers = (g) => (g.siege.side === 'attack' ? [g.hero, ...g.allies] : g.enemies);
  const defenders = (g) => (g.siege.side === 'attack' ? g.enemies : [g.hero, ...g.allies]);

  /** Where the gate is. @param {any} g */
  function gatePoint(g) {
    const w = g.battleMap.wall;
    const gate = w.gaps.find((x) => x.kind === 'gate');
    return { x: w.centre + w.outside * 20, y: gate.y };
  }

  /** Is a point in the courtyard? @param {any} g */
  const inCourtyard = (g, u) => u.x >= g.battleMap.wall.courtyard.x0 && u.x <= g.battleMap.wall.courtyard.x1;

  /** Each step: the ram at the gate, and the attackers holding the courtyard. Returns 'attackers' or 'defenders' when that decides it, else null. @param {any} g @param {number} dt */
  function update(g, dt) {
    const s = g.siege;
    if (!s) return null;
    if (s.ram && !s.gateOpen) {
      const at = gatePoint(g);
      const there = attackers(g).some((u) => u?.alive && !u.routing && Math.hypot(u.x - at.x, u.y - at.y) < RULES.ramReach);
      if (there) {
        s.ramT += dt;
        if (!s.noted) {
          s.noted = true;
          CL.ui.message('The ram is at the gate!');
        }
      }
      if (s.ramT >= RULES.ramSeconds) breakGate(g);
    }
    const mine = attackers(g).filter((u) => u?.alive && !u.routing && inCourtyard(g, u)).length;
    const theirs = defenders(g).filter((u) => u?.alive && !u.routing && inCourtyard(g, u)).length;
    if (mine >= RULES.hold.min && mine >= RULES.hold.ratio * theirs) s.holdT += dt;
    else s.holdT = Math.max(0, s.holdT - dt);
    if (s.holdT >= RULES.hold.seconds) return 'attackers';
    return null;
  }

  /** Is a unit on the attackers' side of this assault? @param {any} g @param {any} u */
  const attacking = (g, u) => (g.siege.side === 'attack' ? u.team === 'ally' : u.team === 'enemy');

  /** The ladder a unit is on, if any (in the wall's gap or at its very foot). @param {any} g @param {any} u */
  function ladderAt(g, u) {
    const w = g.battleMap?.wall;
    if (!w || Math.abs(u.x - w.centre) > w.w / 2 + RULES.ladder.foot) return null;
    return w.gaps.find((x) => x.kind === 'ladder' && Math.abs(u.y - x.y) < x.h / 2) || null;
  }

  /** P9-B5: an attacker on a ladder is climbing: slow (the ground's), and unable to strike. @param {any} g @param {any} u */
  const climbing = (g, u) => Boolean(g.siege && attacking(g, u) && ladderAt(g, u));

  /** The top of the ladder a climber is on: inside the wall, where they step off. Null if not climbing. @param {any} g @param {any} u */
  function ladderTop(g, u) {
    if (!climbing(g, u)) return null;
    const w = g.battleMap.wall;
    return { x: w.centre - w.outside * (w.w / 2 + RULES.ladder.foot + 16), y: ladderAt(g, u).y };
  }

  /**
   * P9-B5: a ladder takes two climbers at a time. An attacker at its foot while two are on it waits
   * their turn. @param {any} g @param {any} u @param {{ x: number, y: number }} via where they are heading
   */
  function waitAtLadder(g, u, via) {
    const w = g.battleMap?.wall;
    if (!g.siege || !w || !attacking(g, u) || ladderAt(g, u)) return false;
    if (Math.hypot(u.x - via.x, u.y - via.y) > RULES.ladder.wait) return false;
    const gap = w.gaps.find((x) => x.kind === 'ladder' && Math.abs(via.y - x.y) < 2);
    if (!gap) return false;
    return [g.hero, ...g.allies, ...g.enemies].filter((v) => v?.alive && !v.routing && attacking(g, v) && ladderAt(g, v) === gap).length >= RULES.ladder.at;
  }

  /** The gate breaks: open to everyone from now on. @param {any} g */
  function breakGate(g) {
    const s = g.siege;
    s.gateOpen = true;
    g.battleMap.gateOpen = true;
    g.battleMap.obstacles = g.battleMap.obstacles.filter((o) => !o.gate);
    g.effects.push({ ...gatePoint(g), t: 0.8, color: '#f7c86a', kind: 'hit' });
    CL.ui.message('The gate gives way!');
  }

  /**
   * Where an attacker on a defence goes, if not their target: every third one carries the ram to the
   * gate while it stands. Null for the rest. @param {any} g @param {any} u
   */
  function ramPost(g, u) {
    const s = g.siege;
    if (!s?.ram || s.gateOpen || s.side !== 'defend' || u.team !== 'enemy') return null;
    u.ramIndex ??= (g.ramCount = (g.ramCount || 0) + 1);
    return u.ramIndex % RULES.ramEvery === 0 ? gatePoint(g) : null;
  }

  /**
   * Defenders hold the wall (P8-06b): one whose foe is outside doesn't sally out after them but stands
   * at the inner head of the nearest ladder or gate, and fights whoever comes up. Null when it doesn't
   * apply (not a defender, or the foe is inside already). @param {any} g @param {any} u @param {any} target
   */
  function holdWall(g, u, target) {
    const s = g.siege;
    const w = g.battleMap?.wall;
    if (!s || !w || !target) return null;
    const defender = s.side === 'attack' ? u.team === 'enemy' : u.team === 'ally' && u.outside;
    if (!defender || !inCourtyard(g, u) || inCourtyard(g, target)) return null;
    const open = w.gaps.filter((x) => x.kind !== 'gate' || g.battleMap.gateOpen || x.kind === 'gate');
    const gap = open.reduce((a, b) => (Math.abs(target.y - b.y) < Math.abs(target.y - a.y) ? b : a));
    return { x: w.centre - w.outside * 34, y: gap.y };
  }

  /**
   * The setup on the walls (P8-06b): Balanced with the infantry at the ladders and archers behind them
   * (attacking), Defensive with the archers on the walkway and the infantry at the gate (defending).
   * Null for any other battle. @param {string} preset @param {any} map
   */
  function anchors(preset, map) {
    const w = map?.wall;
    if (!w || preset === 'custom') return null;
    const out = w.outside;
    const ladder = w.gaps.find((g) => g.kind === 'ladder') || w.gaps[0];
    const gate = w.gaps.find((g) => g.kind === 'gate');
    const defending = !(map.spawn.hero.x * out > w.centre * out);
    if (!defending) {
      // Attacking: from outside (out = -1, the west): infantry at the first ladder, archers behind.
      return { infantry: { x: w.centre + out * 120, y: ladder.y }, archer: { x: w.centre + out * 300, y: ladder.y }, cavalry: { x: w.centre + out * 260, y: gate.y } };
    }
    // Defending, inside: archers on the walkway, infantry at the gate.
    return { archer: { x: w.centre - out * 48, y: gate.y }, infantry: { x: w.centre - out * 90, y: gate.y }, cavalry: { x: w.centre - out * 260, y: gate.y } };
  }

  /**
   * The assault's result for the siege (js/encounter.js, after the battle commits): attacking, won →
   * the fort is taken, lost → thrown back (the siege lifted); defending, won → the siege lifted, lost →
   * the fort falls. `fallen`: the enemy troops that fell. @param {any} c @param {any} siege @param {boolean} win @param {string[]} fallen
   */
  function resolve(c, siege, win, fallen = []) {
    const S = CL.sieges;
    const s = S.at(c, siege.sid);
    const h = CL.realm.holding(siege.sid, c);
    if (siege.side === 'attack') {
      if (s?.by !== 'player') return null;
      if (!win) CL.autoresolve.removeTroops(h.garrison || {}, fallen);
      return win ? S.take(c, s, 'stormed') : S.end(c, s, 'lifted');
    }
    // A defence: fallen attackers come off the besiegers' parties.
    if (s) {
      for (const pid of s.lords) {
        const q = CL.lords.partyOf(c, pid);
        if (q) CL.autoresolve.removeTroops(q.troops, fallen.splice(0, CL.parties.troopCount(q)));
      }
      return win ? S.end(c, s, 'lifted') : S.take(c, s, 'stormed');
    }
    return null;
  }

  /** A practice assault (Debug: Siege assault 30, attack or defence), changing nothing in the campaign. */
  function practice(n = 30, side = 'attack') {
    const per = Math.floor(n / 2);
    const company = Array.from({ length: per }, (_, i) => (i % 3 === 2 ? 'hunter' : 'footman'));
    const enemy = {};
    for (let i = 0; i < n - per; i++) {
      const t = i % 3 === 2 ? 'skirmisher' : 'spearman';
      enemy[t] = (enemy[t] || 0) + 1;
    }
    const waves = [enemy]; // P9-B5: one army, as the campaign's assaults
    return {
      id: `practice_assault_${side}`,
      name: side === 'attack' ? 'Siege assault (practice)' : 'Siege defence (practice)',
      mapDef: CL.arena.assault({ ladders: 2, defend: side === 'defend' }),
      waves,
      practice: company,
      reward: { goldBase: 0, goldPerKill: 0, renown: 0 },
      siege: { sid: null, side, ladders: 2, ram: true },
    };
  }

  CL.assault = { RULES, onThisWall, climbing, ladderTop, waitAtLadder, encounter, begin, announce, update, breakGate, gatePoint, inCourtyard, ramPost, holdWall, anchors, resolve, practice };
})(typeof window !== 'undefined' ? window : globalThis);
