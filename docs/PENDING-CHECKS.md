# Crownless — checks for the next long run

_The owner's rule (D-P10f, 2026-11-24). A task that needs a run over 20 minutes asks: run it now, or add it to the next run? Each "add it" lands here, with exactly what to run and what to look for. The night run (asked for by the owner) does everything below, with P10-00. Afterwards, what ran is moved to "Done", and the next task fixes what it found first._

## Pending

**For P11-09 to fix first** (the owner's rule: the next task fixes what a run found). Found by the night run of 2026-11-27 on 5.7.0 and still open on 5.8.0 after its fixes (below, "Done"); each needs a measured retune, not a guess:

| Found | What | Where it goes |
|---|---|---|
| `battle-parity` | **The siege defence: fought 0% against odds of 65** (5.0.0: +5); storming +29 (over the band's 25). Bisected: 4 of 5 defences won on 5.4.0, 2 on 5.5.0 (P11-05), 1 on 5.6.0, 0 on 5.7.0 and 5.8.0. The defence's fight is over in 50 s (127 s on 5.4.0) and the attackers' archers survive; of P11-05's rules, shield pressure matters most (without it 2 of 5); arrows now press a shield a quarter as hard (5.8.0), which didn't change it | P11-09 first (P11-18 retunes the walls as a whole) |
| `battle-extras` | **The escort's wagon is never saved** (5.4.0: 45% of won fights; since 5.5.0, 0%): the four raiders take it in about two seconds and its guards leave it as they arrive. Neither 80 HP, the old tempo, moving while committed nor sweeping blows changes it | P11-09 first |
| `battle-parity` | **close: fought 100% against Simulate 73%** (a gap of 27 against the band's 25). The auto-resolve doesn't read Phase 11's profiles yet | P11-09 if cheap, else P11-20 |
| `phase7-exit` seed 2 | **The bot's company earns less** (565 crowns at day 100 against 1,079 on 5.5.0, no merchant hired) as it loses more battles than in 5.5.0 (20 against 14) | P11-20 (economy) |
| `long-run` (30 years, seeds 1–3) and `long-run.test.js` | **A realm past half the land** (seed 1: Aurelian 55% from day 2,467, 69% at most; seed 2: Hrothmark 62%; seed 3: Valedorn 55%). **Not Phase 11's:** the 10-year test fails identically on 5.0.0 (1,184 problems from the same day). Every other invariant held every day on all three; saves under 200 KB | Phase 12 (plan §15.5: inherited political tuning) |

## Done

| Ran | What | Result |
|---|---|---|
| Night run, 2026-11-27 (5.7.0, a worktree of 375dd1e; asked by the owner with P11-08) | The visual baselines (Docker, then `--check`); the three 30-year long runs side by side; `long-run.test.js`; the whole `battle-parity`; the 360-day XP pace (`progression.js 360 3`); the siege parity (`--siege 30`); every other slow test; `npm test` (the browser suite failed to start in the worktree and ran on 5.8.0 instead) | **Visual baselines:** 28 written and checked; recorded again on 5.8.0 with the version labels masked (they had baked "v5.7" in), checked, reviewed and kept in `tests/browser/screenshots/`. **Siege parity:** storming +29, defending −65 (for P11-09, above). **battle-parity:** close's gap 27, the sieges (above). **XP pace:** hands-off level 20 on day 281–340 on all three seeds (P11-03's aim); presets seed 3 and expert seed 2 stalled at 15–16, their company losing battles (fixed below). **Long runs:** only the half-the-land invariant, inherited (above). **Slow suite, fixed on 5.8.0:** the Phase 7 exit's company lost 38 of 70 battles (armour's poise from P11-06 made mailed troops unstaggerable by a sword: now mail +0.5, leather +0.25, a gambeson +0.1, and a sword's stagger 1.3: 63 won, 20 lost, 20 soldiers); high ground lengthened when archers may shoot but not their arrows' flight (P11-07: fixed); `battle-extras`'s knoll at 20 seeds was noise (now 40: 25% on against 17.5% off); the events bot's 120 s guard tripped under the run's load (passes alone); `look.spec` counted the sheet's stats before P11-06's Load line. **Browser suite on 5.8.0:** 293 passed, the 2 `look.spec` failures fixed and passing |
| P10-T, 2026-11-26 (5.0.0) | `gate-d-campaigns`, 42 campaigns, 7 a kingdom (asked by P10-04), about 41 min | Passes, after the story bot was taught to play a kept packet (the compromise ending had come by chance once in 42) |
| P10-T, 2026-11-26 (5.0.0) | The full browser suite (asked by P10-G6), beside one slow file | 269 passed, 9 skipped, none failed (4.5 min): the five that failed under load (`ford`, text size, `world-map.spec.js:93`) pass |
| P10-00, 2026-11-25 (4.3.1) | `npm run long-run` (30 years) on seeds 1–3, about 45–55 min each side by side | Every invariant held, every day, on all three. A runaway realm on seeds 2 and 3 (past half the land in year 19 and year 9). Faults found and fixed: a landless realm's patrols (the day threw), the army muster, a founder's village, a landless rising. `docs/PHASE-9-VALIDATION.md` |
| P10-00 | `tests/slow/long-run.test.js` (10 years, seed 1), about 20 min | Passes |
| P10-00 | The whole slow suite (`battle-parity` 30 seeds, `gate-d-campaigns` 40) | 14 of 22 pass. For P10-T: siege defence under the odds; the Phase 7 exit's money (seed 2); `landed`, the Phase 8 and 9 exits, Prototypes D and F as before |
| P10-00 | The full browser suite | 244 passed, 9 skipped; the tourney and `lords` flakes fixed |
