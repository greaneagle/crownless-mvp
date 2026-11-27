# CLAUDE.md

The rules for every agent on this repository are in `AGENTS.md` (shared with Codex, so the two stay interchangeable); the parallel-work procedure is in `docs/AGENTS-WORKFLOW.md`.

@AGENTS.md

Claude-specific:
- Private memory is a convenience, never the only place a rule lives: anything another agent would need goes into `AGENTS.md` or the docs.
- Ports: dev server 8123 (`.claude/launch.json`, "crownless"), Playwright 8131, benchmark 8139, screenshots 8141 (`docs/AGENTS-WORKFLOW.md` §6).
- Branches are `claude/<task-id>-<slug>`.
