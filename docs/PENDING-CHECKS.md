# Crownless — checks for the next long run

_The owner's rule (D-P10f, 2026-11-24). A task that needs a run over 20 minutes asks: run it now, or add it to the next run? Each "add it" lands here, with exactly what to run and what to look for. The night run (asked for by the owner) does everything below, with P10-00. Afterwards, what ran is moved to "Done", and the next task fixes what it found first._

## Pending

**Phase 11 (planned 2026-11-26):** the five rows below run at the night run, **whenever the owner chooses during Phase 11** (owner, 2026-11-26), on the build current then; P11-01 doesn't wait for them. P11-00's short runs are the 5.0.0 reference; if 5.0.0's own `battle-parity` or long-run numbers are wanted, run them from a worktree of commit 4c0a044 (`git worktree add ../crownless-5.0 4c0a044`) beside the rest (`docs/PHASE-11-PLAN.md` §4, §9). P11-00 added its own: the long XP pace (below). The duel and tactics labs at 80 seeds are not needed (P11-00: the duels are deterministic; the tactics lab's spread is in `docs/PHASE-11-VALIDATION.md`). Nothing was run by the planning task.

| From | Run | Look for |
|---|---|---|
| P10-G6 (4.15.0) | The screenshot baselines. Docker Desktop must be running. `npm run test:visual:docker` (`scripts/visual-baselines.js`) runs `npx playwright test --grep @visual --update-snapshots=all` inside `mcr.microsoft.com/playwright:v<pinned>-noble`: about 2 GB to download the first time, then about 5 min. Then `npm run test:visual:docker -- --check` must pass, and the new `tests/browser/screenshots/` are reviewed and committed. Without Docker: the "Browser tests" workflow by hand with "update screenshots" ticked, and the baselines from its artifact | Every key screen in the new art at desktop and phone, Normal and Larger text: nothing clipped or misplaced, no blank canvas, no missing picture. Until they are committed the `@visual` tests skip. The asset guard (`tests/assets.test.js`) already allows `tests/browser/screenshots/` |
| P10-T (5.0.0) | The long runs on the tuned world: `npm run long-run -- --seed 1`, `--seed 2`, `--seed 3` side by side (30 years, about 50 min each), and `node --test tests/slow/long-run.test.js` (10 years, about 20 min) | Every invariant every day. Runaway realms (P10-00: past half the land on seeds 2 and 3): does the last-fort rule (`lastFortRatio` 3) slow them further? Lords' deaths (12% of wounds) over 30 years: houses that die out, heirs, the save's size |
| P10-T (5.0.0) | The whole `battle-parity` (`node --test tests/slow/battle-parity.test.js`, about 30–45 min) | The open-field scenarios as at P10-00; the siege defence with 95% of the garrison beside you (P10-T: +4.8 at 30 seeds) inside −5 to +25 |
| P11-00 (5.0.1) | The XP pace over a long campaign: `npm run progression -- 360 3` (the four bot styles, three seeds, 360 days; about 45–60 min, it was 1 seed of 180 days at P11-00) | The day of each level and the XP at days 60, 120, 180 and 360 for every style and seed, into `docs/PHASE-11-VALIDATION.md` ("XP pace"). P11-03 (5.3.0) set the curve to 20 from the 180-day run: on this run, does level 20 come by day 280–325 on every seed, and does no style stall past 16? |
| P11-00 (5.0.1) | The siege parity on 5.0.1: `node scripts/parity.js --siege 30` (storming and defending, 30 seeds, about 15 min) | Fought against simulated over the odds: 5.0.0's were +19 storming and +5 defending (P10-T). Into `docs/PHASE-11-VALIDATION.md` ("Sieges"), the reference P11-18 measures against |
| P11-05 (5.5.0) | The whole `battle-parity` on the new melee rules (`node --test tests/slow/battle-parity.test.js`, about 30–45 min; the same run as P10-T's row above, so one run answers both) | Which of its bands the new rhythm moves: the open-field scenarios against P11-05's `parity.js 40` (+14, +11, +21, +21, +6 over the odds, the masher); the siege defence and storming inside their bands. Anything outside goes to the next combat task (P11-06) or, for the auto-resolve, P11-20 |

## Done

| Ran | What | Result |
|---|---|---|
| P10-T, 2026-11-26 (5.0.0) | `gate-d-campaigns`, 42 campaigns, 7 a kingdom (asked by P10-04), about 41 min | Passes, after the story bot was taught to play a kept packet (the compromise ending had come by chance once in 42) |
| P10-T, 2026-11-26 (5.0.0) | The full browser suite (asked by P10-G6), beside one slow file | 269 passed, 9 skipped, none failed (4.5 min): the five that failed under load (`ford`, text size, `world-map.spec.js:93`) pass |
| P10-00, 2026-11-25 (4.3.1) | `npm run long-run` (30 years) on seeds 1–3, about 45–55 min each side by side | Every invariant held, every day, on all three. A runaway realm on seeds 2 and 3 (past half the land in year 19 and year 9). Faults found and fixed: a landless realm's patrols (the day threw), the army muster, a founder's village, a landless rising. `docs/PHASE-9-VALIDATION.md` |
| P10-00 | `tests/slow/long-run.test.js` (10 years, seed 1), about 20 min | Passes |
| P10-00 | The whole slow suite (`battle-parity` 30 seeds, `gate-d-campaigns` 40) | 14 of 22 pass. For P10-T: siege defence under the odds; the Phase 7 exit's money (seed 2); `landed`, the Phase 8 and 9 exits, Prototypes D and F as before |
| P10-00 | The full browser suite | 244 passed, 9 skipped; the tourney and `lords` flakes fixed |
