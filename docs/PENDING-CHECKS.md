# Crownless — checks for the next long run

_The owner's rule (D-P10f, 2026-11-24). A task that needs a run over 20 minutes asks: run it now, or add it to the next run? Each "add it" lands here, with exactly what to run and what to look for. The night run (asked for by the owner) does everything below, with P10-00. Afterwards, what ran is moved to "Done", and the next task fixes what it found first._

## Pending

| Added by | Run | Look for | About |
|---|---|---|---|
| P9-T | `tests/slow/long-run.test.js` (20 years, built in P10-00) | Every invariant every day; no negative money, ownership collision, endless event loop or runaway realm | 60–90 min |
| P9-T | `npm run long-run` (100 years, built in P10-00) | The same, over 100 years; save size; time per year | 5–8 h |
| P9-T | The whole slow suite, `npm run test:slow` | Pass or fail per file. Known failures to record, not fix (P10-T): `landed` (Aurelia's last fort, seed 2; seed 3 before; from 4.2.0 a founded realm with one riding lord, seed 1), `phase8-exit`, `phase9-exit` (from 4.2.0), `prototype-d`, `prototype-f` | 44 min |
| P9-T | `battle-parity` (in the slow suite) | Fought against Simulate's odds after 4.0.0's sharper big-battle odds | 26 min |
| P10-02 | `tests/slow/gate-d-campaigns.test.js` | Every quest and ending from a fresh start in the one world, with the coast added (the March itself is unchanged) | 27 min |
| P9-T | The full browser suite, `npx playwright test` | Pass or fail; known flakes (tourney "BOUT LOST", battle-zoom pinch, ford on the phone, the battle-size spec's slow offer) | 3–5 min |

## Done

_Nothing yet._
