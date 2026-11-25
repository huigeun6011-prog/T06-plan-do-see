# Architecture

Update this file whenever structure, components or conventions change.

## Repository layout

```text
.
├── AGENTS.md          # instructions for all AI agents (CLAUDE.md points here)
├── README.md          # for humans
├── docs/              # project memory: status, plans, decisions, architecture
│   ├── STATUS.md
│   ├── PROJECT.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── agents/        # roles and handoff formats
│   ├── plans/         # one file per planned piece of work
│   └── decisions/     # ADRs
├── src/               # application code
├── tests/             # tests
├── scripts/           # dev and maintenance scripts
└── .github/           # issue and PR templates, CI
```

Adjust to the real stack during bootstrap.

## Components

| Component | Responsibility | Location |
|---|---|---|
| TBD | TBD | TBD |

## Data flow

TBD — a short description or a diagram.

## Conventions

- Naming: TBD
- Error handling: TBD
- Testing: TBD
- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`; one worktree per branch

## External dependencies

| Dependency | Why | Decision |
|---|---|---|
| TBD | TBD | TBD |
