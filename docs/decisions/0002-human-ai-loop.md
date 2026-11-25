# 0002 — Develop in a human-AI loop (supersedes the delegation part of 0001)

- **Status:** accepted
- **Date:** 2026-11-25

## Context

0001 set up an Orchestrator that delegates to Planner/Implementer/Reviewer profiles with a human-approved plan per task. For this project (ALEPH task 6, a solo learning project) one round is too heavy, and the human wants to conceive while the agent builds.

## Decision

- The human throws one chunk at a time. The agent vets it (accept / partially accept / reject / other opinion), they discuss, and only after explicit confirmation the agent applies everything (code, tests, docs, commit) and reports. Then repeat until deployable.
- The agent implements directly. No Paseo delegation unless asked.
- `AGENTS.md` §3-§4 and `CLAUDE.md` are rewritten accordingly. `docs/agents/*` and the 0001 delegation parts are kept as history but no longer apply.

## Alternatives considered

- Keep the Planner → approve → Implementer → Reviewer flow: safer, but slow per chunk and not what the human wants.
- Remove all rules: faster, but loses tests, STATUS tracking and secret hygiene.

## Consequences

- No independent review per chunk; at most one before deployment.
- Safety rules kept: tests run and reported, small commits, STATUS.md, no secrets in git, ask before merging to `main` or deploying.
