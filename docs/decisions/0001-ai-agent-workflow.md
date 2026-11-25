# 0001 — Develop with an orchestrator and role-based agents

- **Status:** accepted
- **Date:** {{DATE}}

## Context

Development is done with AI coding agents. Starting each session by re-explaining instructions, structure and roles is slow and error-prone, and a new agent has no memory of earlier work.

## Decision

- `AGENTS.md` is the single instruction file; `CLAUDE.md` imports it.
- The human talks to an Orchestrator (Claude Code or Codex), which delegates to role-based agents through Paseo agent profiles (Planner, Implementer, UI, Reviewer, Free worker).
- Project memory lives in `docs/`. `docs/STATUS.md` is the handoff point for any new agent.
- Each independent task runs in its own worktree. Plans are approved by the human before implementation; diffs are reviewed independently before merge.

## Alternatives considered

- Re-prompting every session — slow, inconsistent.
- One agent doing everything — no independent review, expensive context.

## Consequences

- Docs must be kept current; a stale `STATUS.md` misleads the next agent.
- Models can change without touching the workflow, since roles are defined separately from models (`docs/agents/ROLES.md`).
