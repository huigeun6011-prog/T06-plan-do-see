# 0003 — Stack: Next.js on Vercel, Postgres on Neon, plain SQL

- **Status:** accepted
- **Date:** 2026-11-26

## Context

The diary needs a server database, a server-side layer so the connection string never reaches the browser (T06-C58), a login-free public URL (T06-C01), and SQL-level guarantees: a unique constraint against duplicate completion (C21), edit history (C08), exact aggregates (C28-C32), Seoul-time dates. Solo project; the human is comfortable with SQL and delegates framework details to the agents. Free tiers only.

## Decision

- **App:** Next.js (React), screens and server code in one project. React is therefore the front end.
- **Hosting:** Vercel Hobby, deployed from the GitHub repo.
- **Database:** Neon Free, Postgres only (no storage, functions, AI gateway, realtime or auth services).
- **Data access:** plain SQL, no ORM. Values always go in as query parameters, never concatenated into SQL strings.
- **Defaults chosen by the Orchestrator** (the human delegated them; revisit if they hurt): TypeScript, plain CSS with no UI library, Vitest for tests. The database driver is chosen by the Implementer following Neon's installed agent skills for the Vercel runtime.

## Alternatives considered

- Vanilla JS with a separate API server — two deployables to build and host, no gain here.
- An ORM (Prisma, Drizzle) — hides the constraints and aggregates the task must show; less readable for a reviewer and for the human.
- Neon Auth / Better Auth — the task forbids login until task 7.

## Consequences

- Connection string lives only in server-side environment variables (`.env.local`, Vercel env); `.env*` stays git-ignored.
- Every query is parameterized; the Reviewer checks this.
- Serverless means a possible cold start on the first request after idle; acceptable for a personal tool.
- Revisit TypeScript, CSS and test runner if the Implementer reports friction; the framework, host and database are the hard-to-reverse parts.
