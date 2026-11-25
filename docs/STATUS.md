# Status

> The first thing a new agent reads after `AGENTS.md`. Keep it short and true. Owned by the Orchestrator.

- **Phase:** UNINITIALIZED   <!-- UNINITIALIZED → Active → Maintenance -->
- **Last updated:** {{DATE}} by <agent / profile>
- **Branch in use:** `main`

## Summary

{{DESCRIPTION}}
<2-3 lines: where the project stands right now.>

## Next step

<The single most important next action. Specific enough that a stranger could start it.>

## In flight

| Task | Plan | Profile | Workspace / branch | State |
|---|---|---|---|---|
| — | — | — | — | — |

State: `planning` · `awaiting approval` · `implementing` · `in review` · `fixing` · `blocked` · `ready to merge`

## Blockers and questions for the human

- None

## Parked follow-ups

Things noticed but deliberately out of scope.

- None

## How to verify this page

```bash
git status
git log -10 --oneline
git worktree list
```
