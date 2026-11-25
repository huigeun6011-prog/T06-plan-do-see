# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Getting started

```bash
{{INSTALL_CMD}}
{{RUN_CMD}}
```

Tests: `{{TEST_CMD}}` · Lint: `{{LINT_CMD}}`

## Repository layout

| Path | Contents |
|---|---|
| `src/` | Application code |
| `tests/` | Tests |
| `scripts/` | Dev and maintenance scripts |
| `docs/` | Status, plans, decisions, architecture |
| `.github/` | Issue and PR templates |

## Working on this project with AI agents

This repo is built with an orchestrator plus role-based agents (Planner, Implementer, UI, Reviewer, Free worker) running on Paseo.

- New agent or new session? Read `AGENTS.md`, then `docs/STATUS.md`.
- Roles and profile settings: `docs/agents/ROLES.md`.
- Docs index: `docs/README.md`.
