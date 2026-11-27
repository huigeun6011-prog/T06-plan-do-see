# Architecture

Update this file whenever structure, components or conventions change.

## Repository layout

```text
.
├── AGENTS.md          # instructions for all AI agents (CLAUDE.md points here)
├── README.md          # for humans
├── neon.ts            # Neon project config (Postgres only)
├── app/               # Next.js App Router: pages, server actions, route handlers, styles
├── db/                # server-side SQL and queries (plain SQL, parameterized)
├── lib/               # pure logic shared by server and screens (time, validation, limits, catalog parser); lib/ui/ holds screen logic with tests
├── data/              # boss-catalog.csv: the boss list (name, difficulty, cycle, max party, crystal price, cubes)
├── contracts/         # pds-schema-v2.json, checked against the database by a test
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
| Schema and DB scripts | DDL, apply script with branch guard (`dev` default, `test` for tests, `production` only with `--production`) | `db/schema.sql`, `scripts/` |
| Seoul time helpers | periods (Thursday and 1st boundaries), deadline display (00:00 shown as 24:00 of the previous day) and input | `lib/time.ts` |
| Validation | typed input checks shared by all data functions | `lib/validate.ts`, `lib/todo-sort.ts` |
| Data access (server only) | plain SQL functions that take an `sql` client first: characters, versioned registrations, plans with idempotent todo generation, todos (CRUD, search, filter, sort, week view), run records, retro numbers and overview, improvement todos, export snapshot | `db/*.ts` |
| Export | `GET /export` downloads one JSON snapshot (all rows including history, derived retro totals) | `app/export/route.ts`, `db/export.ts` |
| Schema contract | tables, columns, relations, date rules, aggregates; a test compares it with the database | `contracts/pds-schema-v2.json` |
| UI shell (mock data) | `/preview`: numbered cards, character cards, boss tiles, icon slot, theme on the wrapper, contrast tested from the CSS. Shared pieces (`Shell` with the nav `주간` / `수정`, the no-login notice slot and the wide container; `IconTile`, `BossTile`, `CharacterCard`, `Section`) are used by the real screens too | `app/preview/`, `app/components/`, `lib/ui/` |
| This-week screen (home page `/`) | server component calls `loadWeek` (a constant number of statements: todos with the current registration, character and run records, grouped per character and per period); client `WeekView` renders tiles; actions `setDoneAction` (explicit desired state, idempotent), `setCountAction` (sets today's units), `setMinutesAction`; pure helpers for strip, filter, box states, minutes parsing | `app/page.tsx`, `app/week/`, `db/week.ts`, `lib/week-logic.ts`, `lib/ui/week-ui.ts` |
| Registration screen (`/register`) | characters, boss picker from the catalog, missions, paste box with preview, edit with expected-version conflict check, reorder, delete; limits (12 weekly bosses per character, account level missions only) enforced on the server inside the insert; Korean messages mapped in `lib/ui/messages.ts` | `app/register/`, `db/register.ts`, `db/entry-limits.ts`, `lib/limits.ts`, `lib/entry-lines.ts`, `lib/catalog.ts`, `lib/ui/register-logic.ts` |
| Boss catalog | CSV in the repository, read on the server by `app/register/page.tsx` and parsed by `lib/catalog.ts`; reward of a catalog entry = crystal price / party size; no image field yet | `data/boss-catalog.csv`, `lib/catalog.ts` |
| Connection check (throwaway) | the page and the public `/ping` route are removed; `db/ping.*` and the production `ping` table are still there and go later | `db/ping.*` |

No screen exists yet for the retro, history, overview, improvement or event plans (server side is built, see `docs/ROADMAP.md`).

Screen conventions: server actions are `'use server'` files next to the screen and return serializable results (`{ ok: true, ... }` or `{ ok: false, field?, message }`) with generic errors; logic that can be tested goes into pure functions under `lib/` or `lib/ui/` because there are no DOM test tools; each screen has its own CSS file with `pd-` prefixed class names that must not repeat across files (Next.js keeps CSS of earlier routes loaded).

## Data model

Five tables (`game_character`, `entry`, `plan`, `todo`, `run_record`) and the view `todo_state`; details in `docs/plans/0001-core-schema.md`, decision in ADR 0004. Versioned: `plan`, `entry`. Done state and retro numbers are derived. The tables exist on the Neon `dev`, `test` and `production` branches (production is empty). Edits to a registration create a new version and change only todos generated afterwards (todos hold a snapshot).

## Data flow

Browser -> Vercel (Next.js server code) -> Neon Postgres over HTTP (`@neondatabase/serverless`). Server code reads `DATABASE_URL`; the browser never sees it. Screens call server actions (and the export is a route handler); the server validates, runs parameterized SQL and returns a result; pages are rendered on demand (`force-dynamic`) from the database, so data survives refresh and restart.

## Conventions

- Naming: TypeScript, files in lowercase.
- SQL: plain SQL, values only as query parameters, never concatenated. Table DDL lives in `db/*.sql` and is idempotent.
- Error handling: validate input on the server; show text as text (React escapes it); never return connection details.
- Testing: Vitest in `tests/` (`npm test`); change behavior, add or update a test.
- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`; one worktree per branch. Merge to `main` only with the human's OK.
- Secrets: `.env.local` and Vercel environment variables only; `.env*` is git-ignored except `.env.example`.
- Neon branches: `production` (real data), `dev` (development), `test` (automated tests, reset by the tests). A worktree's `.env.local` holds `dev` and `test` addresses plus the markers `NEON_BRANCH=dev` and `TEST_NEON_BRANCH=test`; the main folder's file is `production`. The schema script and the DB tests refuse to run unless the markers match, so never run them in the main folder.
- Driver: bigint ids arrive as strings, `text[]` as string arrays, timestamps as `Date`; dates must be selected as text (`date::text`) to avoid time-zone shifts.

## External dependencies

| Dependency | Why | Decision |
|---|---|---|
| Next.js, React, TypeScript | App framework with server code in one project | ADR 0003 |
| `@neondatabase/serverless` | Postgres driver for the serverless runtime (HTTP) | ADR 0003, chosen by Implementer per Neon guidance |
| Neon (Postgres) | Server database | ADR 0003 |
| Vercel (Hobby) | Hosting; connected to the GitHub repo, a push to `main` deploys to production | ADR 0003 |
| Vitest | Tests | ADR 0003 |
| `@anthropic-ai/sdk` (planned) | AI recap, server-side only | ADR 0005 |
