# AGENTS.md — how any coding agent works on Crownless

This is the one rulebook for every agent on this repository: Claude Code (which reads it through `CLAUDE.md`), OpenAI Codex (which reads this file), or a person. The agents are meant to be **interchangeable**: any agent can pick up any task, continue another's branch, or merge it, using only what is in the repository. Nothing an agent needs may live only in its private memory or chat. Owner's decision, 2026-11-27 (D-AG1).

## 1. The project in a minute

Crownless is a browser medieval sandbox RPG: vanilla JavaScript classic scripts on an HTML5 canvas, no build step, no runtime dependencies; Playwright is the only dev dependency. Everything is drawn in code (no image files). Start with:

| Read | For |
|---|---|
| `README.md` | What is playable, the layout, how to run and test |
| `docs/NEXT-TASKS.md` | Every task's specification and **Brief**; "How each task runs from P9-L1" is the way of working |
| `docs/NEXT-PLAN.md` §6c, §8 | The phase's order, versions and owner decisions |
| `docs/PHASE-11-PLAN.md` | Phase 11's design; `docs/PHASE-12-ROADMAP.md` the next |
| `docs/ART-STYLE.md`, `docs/STORYBOOK-INTEGRATION.md` | The art rules (the approved storybook look) |
| `docs/PENDING-CHECKS.md` | Long checks waiting for the owner's night run |
| `docs/AGENTS-WORKFLOW.md` | Branches, worktrees, claiming, merging (§4 below in full) |

Read the task's own section and the files its Brief names, not everything.

## 2. The owner's standing rules (all agents)

- **Gameplay and art stay apart.** A graphical change never changes a rule, timing, hitbox, layout or save; a gameplay change never rides in an art commit.
- **Old saves are ignored** (D-P10g, D-P11a): no migrations, fixture folders or old-save tests; new saved state gets defaults through `sanitize`.
- **Art is drawn in code** (D-P10k) in the approved storybook look (D-P11m): no image files, sprites or generated art; `tests/assets.test.js` guards it. Every person has a short neck joining head and collar (owner, 2026-11-27: not a long one).
- **Long runs need the owner's yes** (D-P10a, D-P10f): nothing over 20 minutes and nothing overnight without asking. A check that needs one is written in `docs/PENDING-CHECKS.md` with exactly what to run and what to look for.
- **Tests by tier** (NEXT-PLAN "The test tiers"): every task runs `npm test`, `npm run lint` and its own browser specs (desktop and phone); the full browser suite when shared UI changes; only the slow files the task reaches.
- **Tuning is time-boxed:** two tries a number, then ship the better and record the rest as open.
- **Honest reports:** never claim a check, a phone result or an owner's approval that did not happen. Failures outside the task are run once alone, then noted, not fixed.
- **Owner gates stay:** a milestone or an art gate waits for the owner's word.
- **Never push, tag, open pull requests or publish** unless the owner asks in so many words. Everything happens in the local repository.
- **Commits:** agents commit their own validated work on their own branch, and merge into `main` as §4 says. Message: `Title (version, task-id)`, a blank line, short bullets, and the agent's own attribution trailer (for example `Co-Authored-By: Claude …` or Codex's).
- **Files:** LF line endings (`.gitattributes`); plain, short sentences in docs and player text.

## 3. Commands

| Command | What |
|---|---|
| `npm test` | Fast Node tests (about 3 min) |
| `npm run lint` | Biome, then the type checker |
| `npx playwright test tests/browser/<file>.spec.js` | One browser spec, both projects (needs `npx playwright install chromium` once) |
| `npm run serve` | The game at http://localhost:8123 (use your agent's port, §4.4) |
| `npm run agents` | Every agent branch and worktree: who, which task, ahead/behind `main`, files touched, overlaps |

## 4. Working in parallel (summary; details in `docs/AGENTS-WORKFLOW.md`)

1. **One task, one branch, one worktree.** Branch `<agent>/<task-id>-<slug>` from the current `main` (`claude/p11-13-formations`, `codex/p11-16-regional-arms`), in its own worktree beside the repository (`git worktree add ../crownless-wt/codex-p11-16 -b codex/p11-16-regional-arms main`). Never work in another agent's worktree, and never on `main` directly.
2. **Claim before you build:** run `npm run agents`. A task already on some branch is taken; pick another, or continue that branch only if the owner says so. Creating your branch is the claim.
3. **Only parallel-safe tasks run side by side:** both tasks' "Needs" are done on `main`, and their Briefs' files don't overlap (`docs/AGENTS-WORKFLOW.md` §3 lists the pairs; `npm run agents` shows the overlap of live branches). If two branches must touch the same file, the second waits or coordinates through the owner.
4. **Ports apart:** each agent its own (Claude: serve 8123, tests 8131; Codex: serve 8124, tests 8133; set `CROWNLESS_TEST_PORT`, `CROWNLESS_BENCH_PORT`, `CROWNLESS_SHOTS_PORT`).
5. **On the branch, write only your task's own lines:** code, tests, the task's Done paragraph in `docs/NEXT-TASKS.md`, and a change note `docs/changes/<task-id>.md` (release notes, ROADMAP line, pending checks). **Do not** bump the version or edit the shared tables (RELEASE-NOTES, ROADMAP, the readiness tables, PENDING-CHECKS): those are written once, at merge, so two branches never fight over them.
6. **Merge when the task is validated and the owner has accepted it (or its gate needs none):** bring `main` in (`git merge main`), re-run the task's checks, then on `main`: `git merge --no-ff <branch>`, fold the change note into the shared files, give the version (the next in merge order, §5 of the workflow), run `npm test` and `npm run lint` on `main`, commit, and remove the worktree and branch. Any agent may merge any validated branch; whoever merges is the integrator for it.

## 5. Continuing someone else's work

Everything a successor needs is in the branch: the task's Brief, its Done paragraph so far (write it as you go), the change note, and the commit messages. Before stopping mid-task, commit what is there (even if unfinished, with `WIP` in the title on the branch only) and write in the change note what is done, what is next and what is broken. Nothing goes in private memory that another agent would need.
