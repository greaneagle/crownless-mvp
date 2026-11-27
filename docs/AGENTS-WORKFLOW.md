# Crownless — several agents at once (branches, worktrees, claiming, merging)

_The owner's decision D-AG1 (2026-11-27): Claude Code and OpenAI Codex (or any agent) work at the same time on different tasks, each on its own branch, and either can merge. `AGENTS.md` is the rulebook; this is the procedure in full._

## 1. Why the old way needed changing

Until 5.12.3 one agent worked on `main`, one task at a time, and several files changed in every task: the version in five places, the top of `RELEASE-NOTES.md`, the ROADMAP list, the readiness tables in NEXT-TASKS, NEXT-PLAN and PHASE-11-PLAN, `docs/PENDING-CHECKS.md`. Two branches editing those same lines conflict every time. And some rules lived only in one agent's private memory. So:
- **Shared files are written once, at merge** (§4), from a per-task change note.
- **Versions are given at merge**, in merge order (§5).
- **Every standing rule is in `AGENTS.md`**, readable by any agent.

## 2. Start a task

```
git switch main
npm run agents                      # what is taken, what overlaps
git worktree add ../crownless-wt/<agent>-<task> -b <agent>/<task-id>-<slug> main
cd ../crownless-wt/<agent>-<task>
npm ci                              # a worktree has its own node_modules
npx playwright install chromium     # once per machine
```

- `<agent>` is `claude` or `codex` (or a person's name); `<task-id>` the lowercase id (`p11-13`).
- The branch is the claim. If `npm run agents` already shows a branch for the task, it is taken.
- Create `docs/changes/<task-id>.md` from `docs/changes/TEMPLATE.md` in the first commit.
- Local folders that are git-ignored (`art-reference/`, `docs/graphics-demo/`, the handoff zip) are not in a new worktree: reach them in the main checkout by path when a task needs them.

## 3. Which tasks can run side by side

Two tasks run in parallel only if (a) both tasks' **Needs** are done on `main`, and (b) their Briefs' "Start from" files don't overlap. Nearly every Phase 11 task touches `js/combat.js` or `js/profile.js` (plan §5), so few pairs qualify:

| Pair | Why it is safe | Watch |
|---|---|---|
| **P11-13** (formations) ∥ **P11-16** (regional arms) | 13 is `js/formations.js`, `js/divisions.js`, `js/groups.js`, `js/combat.js`'s order code; 16 is `data/items.js`, `data/weapons.js`, `data/troops.js` looks, shops | Both may touch `data/troops.js`: 16 owns it; 13 only reads it |
| Any task ∥ a docs-only or tools-only task (a new script, a lab, a Phase 12 specification) | No game file in common | The change note, not the shared files |
| P11-17 ∥ P11-18 (after 13 and 16 are merged) | Training (`js/` trainer, the practice yard) against the walls (`js/assault.js`, `js/arena.js`) | `js/combat.js`: whichever merges second re-runs the parity checks |

Anything else waits, or the owner decides. `npm run agents` prints, for each pair of live branches, the files both have changed; any overlap means stop and ask.

## 4. On the branch: what to write and what not

| Write on your branch | Leave for the merge |
|---|---|
| Code, data, tests (new test files rather than long edits to shared ones where it is natural) | `CL.BUILD`, `package.json`, `package-lock.json`, `index.html`'s version, README's title |
| The task's own section in `docs/NEXT-TASKS.md`: its heading's state and its Done paragraph | The readiness tables (NEXT-TASKS's phase table, NEXT-PLAN §6c, PHASE-11-PLAN §5) |
| Docs that belong to the task alone (`docs/ART-STYLE.md` sections for a new part, `docs/WORLD-FORMAT.md` for new content fields, `data/help.js` topics) | `docs/RELEASE-NOTES.md`, `docs/ROADMAP.md`, `docs/PENDING-CHECKS.md`, `docs/PHASE-11-VALIDATION.md` |
| `docs/changes/<task-id>.md`: the release notes, the ROADMAP line, the validation numbers, pending checks, handover notes | |

Golden fixtures (`tests/fixtures/`, golden battles) and browser screenshot baselines: re-record them only after bringing `main` in, so they match what will be merged.

Commit as often as useful on the branch. Stopping mid-task: commit (`WIP:` in the title is fine on a branch), and fill the change note's "State" so another agent can carry on.

## 5. Merge

When the task's checks pass and the owner has accepted it (milestones, art gates), or it needs no acceptance:

```
# in the task's worktree: bring main in and re-check
git merge main                      # resolve conflicts in your own files
npm test && npm run lint            # plus the task's browser specs
# in the main checkout
git switch main
git merge --no-ff <agent>/<task-id>-<slug>
```

Then, on `main`, the integrator (whoever merges):
1. **Version:** the next one in merge order: a task takes the next minor (`5.13.0`, `5.14.0`, …) whatever its number in the plan; a fix or docs-only work the next patch. Set it in `js/core.js` (`CL.BUILD`), `package.json`, `package-lock.json` (twice), `index.html` (the title, the `<small>`, the version line).
2. **Fold the change note:** its release notes at the top of `docs/RELEASE-NOTES.md` under the version; its line into `docs/ROADMAP.md`; its numbers into `docs/PHASE-11-VALIDATION.md`; its pending checks into `docs/PENDING-CHECKS.md`; mark the task ✅ in the readiness tables. Then delete `docs/changes/<task-id>.md`.
3. **Check main:** `npm test` and `npm run lint`; the merged task's browser specs. If both parallel tasks touch combat, also `node scripts/parity.js 40`.
4. **Commit** the merge-time edits: `Merge <task-id>: <title> (<version>)` with the agent's trailer.
5. **Clean up:** `git worktree remove ../crownless-wt/<agent>-<task>` and `git branch -d <agent>/<task-id>-<slug>`.

A conflict in a file another task owns: stop and ask the owner which way, unless the resolution is mechanical (both added lines to a list).

## 6. Ports and processes

Two agents on one machine must not share ports or kill each other's servers.

| | Claude | Codex |
|---|---|---|
| Dev server (`npx http-server -p <port> -c-1`) | 8123 | 8124 |
| Playwright (`CROWNLESS_TEST_PORT`) | 8131 | 8133 |
| `scripts/bench-browser.js` (`CROWNLESS_BENCH_PORT`) | 8139 | 8140 |
| `scripts/screens-storybook.js` (`CROWNLESS_SHOTS_PORT`) | 8141 | 8142 |

Heavy runs (the full browser suite, benchmarks, slow tests) slow the other agent's tests too: their timing flakes (NEXT-TASKS "Failures outside the task") are more likely; re-run a failure alone before believing it, and don't measure performance while the other agent is running a suite.

## 7. Agent-specific notes

- **Claude Code** reads `CLAUDE.md` (which imports `AGENTS.md`). Its private memory is a convenience, never the source of a rule. Its preview server is `.claude/launch.json` ("crownless", port 8123).
- **Codex** reads `AGENTS.md` at the repository root (and in a worktree, the worktree's copy).
- Either may use its own tools; the procedure above is the same.
