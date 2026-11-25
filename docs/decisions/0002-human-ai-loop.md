# 0002 — Develop in a human-AI loop with delegation (amends 0001)

- **Status:** accepted
- **Date:** 2026-11-25

## Context

0001 set up an Orchestrator that delegates to Planner/Implementer/Reviewer profiles with a human-approved plan per task. For this solo learning project (ALEPH task 6) one round is too heavy, and the human wants to conceive while agents build.

## Decision

- The human throws one chunk at a time. The Orchestrator vets it (accept / partially accept / reject / other opinion), they discuss, and only after explicit confirmation the chunk is applied. Then repeat until deployable.
- The confirmed chunk replaces the per-task approved plan. The Orchestrator delegates implementation to Implementer and screens to UI, writes all docs, and reports. It does not write non-trivial code.
- Planner for big design decisions, Reviewer on demand (different provider than the author), Free worker off by default.
- `AGENTS.md` §3-§4 and `CLAUDE.md` are rewritten accordingly.

## Alternatives considered

- Keep the full Planner → approve → Implementer → Reviewer flow per task: safer, but slow per chunk.
- Orchestrator implements directly: tried first, rejected by the human, who wants implementation done by other agents.
- Remove all rules: faster, but loses tests, STATUS tracking and secret hygiene.

## Consequences

- Delegation prompts must be self-contained; workers cannot see the conversation.
- Reviews are not automatic; the Orchestrator proposes one when the risk warrants it, at the latest before deployment.
