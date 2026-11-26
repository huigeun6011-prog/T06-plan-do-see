# Architecture

Update this file whenever structure, components or conventions change.

## Repository layout

```text
.
├── AGENTS.md          # instructions for all AI agents (CLAUDE.md points here)
├── README.md          # for humans
├── neon.ts            # Neon project config (Postgres only)
├── app/               # Next.js App Router: pages, route handlers, styles
├── db/                # server-side SQL and queries (plain SQL, parameterized)
├── tests/             # Vitest tests
├── docs/              # project memory: status, plans, decisions, architecture, task text
│   ├── STATUS.md  PROJECT.md  ARCHITECTURE.md  ROADMAP.md  TASK.md
│   ├── agents/        # roles and handoff formats
│   ├── plans/         # one file per planned piece of work
│   └── decisions/     # ADRs
├── scripts/           # dev and maintenance scripts
└── .github/           # issue and PR templates, CI
```

## Components

| Component | Responsibility | Location |
|---|---|---|
| Connection check page (throwaway) | Proves save and read against Neon from Vercel; delete when the real app exists | `app/page.tsx`, `app/ping/route.ts`, `app/note.ts`, `db/ping.ts`, `db/ping.sql` |

The real app (plans, todos, run records, retro) is not built yet; see `docs/PROJECT.md` and `docs/ROADMAP.md`.

## Data flow

Browser -> Vercel (Next.js server code) -> Neon Postgres over HTTP (`@neondatabase/serverless`). Server code reads `DATABASE_URL`; the browser never sees it. Forms post to a route handler, which validates, inserts with a parameterized query and redirects; pages are rendered on demand from the database, so data survives refresh and restart.

## Conventions

- Naming: TypeScript, files in lowercase.
- SQL: plain SQL, values only as query parameters, never concatenated. Table DDL lives in `db/*.sql` and is idempotent.
- Error handling: validate input on the server; show text as text (React escapes it); never return connection details.
- Testing: Vitest in `tests/` (`npm test`); change behavior, add or update a test.
- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`; one worktree per branch. Merge to `main` only with the human's OK.
- Secrets: `.env.local` and Vercel environment variables only; `.env*` is git-ignored except `.env.example`.

## External dependencies

| Dependency | Why | Decision |
|---|---|---|
| Next.js, React, TypeScript | App framework with server code in one project | ADR 0003 |
| `@neondatabase/serverless` | Postgres driver for the serverless runtime (HTTP) | ADR 0003, chosen by Implementer per Neon guidance |
| Neon (Postgres) | Server database | ADR 0003 |
| Vercel (Hobby) | Hosting; connected to the GitHub repo, a push to `main` deploys to production | ADR 0003 |
| Vitest | Tests | ADR 0003 |
