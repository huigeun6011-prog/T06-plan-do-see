# 0004 — Data model: plans of three kinds, versioned plans and registrations, derived done state

- **Status:** accepted
- **Date:** 2026-11-26

## Context

The diary must keep plan, todo, run record and retro linked in a server database (T06-C34), keep the original plan after edits (T06-C08), block duplicate completion at the database (T06-C21), give exact aggregates that trace back to records (T06-C28 to C32, C83) and use Seoul-time dates. The human's real use: weekly and monthly recurring bosses per character, hunting with a weekly target count, and events with several missions, a shared period and deadlines such as 02:00. The human tracks weekly, monthly and each event separately.

## Decision

The full design is `docs/plans/0001-core-schema.md`. In short:

- Five tables (`game_character`, `entry`, `plan`, `todo`, `run_record`) and one view (`todo_state`). Plain SQL (ADR 0003).
- `plan` and `entry` keep history: an edit adds a row with the same `root_id` and flips the old row to `use_yn='N'`. Todos and run records edit in place with soft delete only.
- Plans are `weekly`, `monthly` or `event`; boundaries are clean KST instants with an exclusive end. Weekly and monthly plans and their todos are created lazily on access, guarded by unique constraints, with no cron.
- Done is derived from run records (sum of daily `units` against `target_count`). The partial unique index on `(todo_id, run_date)` is the double-completion guard.
- Recurring tasks are `entry` rows; a non-repeating task is a hand-made todo in an event plan.
- Retro numbers are computed on read from the view; the AI never computes them.
- Development and tests use the Neon branches `dev` and `test`; `production` holds the real data.

## Alternatives considered

- One table plus `root_id` for every table, or a history table filled by a trigger — more tables or logic than the task needs; todos and run records do not need history for this use.
- A `done` flag on the todo — two sources of truth, and it cannot express cumulative targets.
- Vercel cron for generation — Hobby plan limits and an extra moving part; lazy generation is idempotent anyway.
- Date-only deadlines — cannot express 02:00 deadlines; instants with clean boundaries cover both.
- Event missions inside the weekly plan — would mix achievement of different periods; rejected by the human.

## Consequences

- Reads filter `use_yn='Y'`; the original plan is the first row of its `root_id`.
- `plan_id` and `entry_id` on todos must hold the root id (one test covers it).
- Multi-statement writes use `sql.transaction([...])`.
- The DDL has not been run yet; chunk 1 is its first check. Revisit if a table needs history later; additive `ALTER` files are the migration path.
