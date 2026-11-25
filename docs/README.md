# Docs index

| File | Read it when | Updated by |
|---|---|---|
| `STATUS.md` | Always, at session start | Orchestrator, continuously |
| `PROJECT.md` | You need purpose, scope or glossary | Orchestrator + human |
| `ARCHITECTURE.md` | You touch structure or conventions | Orchestrator, from worker reports |
| `ROADMAP.md` | You need priorities | Orchestrator + human |
| `agents/ROLES.md` | You need your role's rules or profile settings | Human / Orchestrator |
| `agents/HANDOFF.md` | You delegate or report | Rarely |
| `plans/` | You implement or review planned work | Planner output, saved by Orchestrator |
| `decisions/` | You wonder why something is the way it is | Orchestrator, when a hard-to-reverse decision is made |

## Naming

- Plans: `plans/NNNN-short-slug.md`, numbered in order (`0001`, `0002`, …). Copy `plans/_TEMPLATE.md`.
- Decisions: `decisions/NNNN-short-slug.md`. Copy `decisions/_TEMPLATE.md`. Never delete an ADR; supersede it.
- Files starting with `_` are templates.
