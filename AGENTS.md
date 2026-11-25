# {{PROJECT_NAME}} — Agent Instructions

Single source of truth for every AI agent in this repo (Claude Code, Codex, Antigravity, …).
`CLAUDE.md` only points here. Talk to the human in the language they use; write repo files in English unless told otherwise.

> **Not bootstrapped?** If `docs/STATUS.md` says `Phase: UNINITIALIZED`, stop and follow `docs/BOOTSTRAP.md` first.
> After bootstrap, delete this callout.

## 1. Cold start (every new session, every agent)

1. Read this file.
2. Read `docs/STATUS.md`: current state, work in flight, next step, blockers. (Reviewers skip this: they get only the diff and the plan, to stay independent.)
3. Run `git status`, `git log -10 --oneline`, `git worktree list`. If they disagree with STATUS.md, **trust git**, then fix STATUS.md.
4. Read `docs/PROJECT.md` (purpose/scope) and `docs/ARCHITECTURE.md` (structure) only if your task needs them.
5. Find your role (§3), then read your section in `docs/agents/ROLES.md`.

## 2. Project snapshot

- **What:** {{DESCRIPTION}}
- **Stack:** {{STACK}}
- **Install:** `{{INSTALL_CMD}}`
- **Test:** `{{TEST_CMD}}`
- **Lint/format:** `{{LINT_CMD}}`
- **Run:** `{{RUN_CMD}}`

A command that does not apply to this project (for example lint for a novel) is written `N/A`; skip it, do not invent one.

## 3. Roles

You are the **Orchestrator** unless your prompt assigns another role. The Orchestrator is the agent the human talks to (Claude Code or Codex). Worker roles are launched through Paseo agent profiles.

| Role | Does | Must not |
|---|---|---|
| Orchestrator | Talks to the human, plans the work split, delegates, integrates, keeps docs current | Write non-trivial code itself |
| Planner | Architecture, root-cause analysis, option comparison → a plan | Edit code |
| Implementer | Builds from an approved plan, fixes bugs, makes tests pass | Change scope or the plan |
| UI | Components, layout, styling, visual polish | Touch business logic or API contracts |
| Reviewer (Claude or Codex profile) | Independent review of a diff, by a different provider than its author | Edit anything |
| Free worker | Narrow, reversible chores (exploration, docs, draft tests, boilerplate) | Run outside a worktree, orchestrate, or merge |

Details, profile settings and report formats: `docs/agents/ROLES.md`, `docs/agents/HANDOFF.md`.

## 4. Orchestrator protocol

1. Clarify only what blocks you (max 3 questions).
2. Check Paseo agent profiles and their notes before delegating. If Paseo tools are not enabled, tell the human.
3. **Trivial change** (one file, a few lines, no behavior risk): do it yourself, run tests, log it in STATUS.md.
4. **Anything else:** Planner → save plan to `docs/plans/` → **human approves** → Implementer (or UI) → Reviewer on the diff (different provider than the author; see `docs/agents/ROLES.md`) → fix loop → docs → ask the human before merging to the main branch.
5. Every delegation prompt is self-contained (use the template in `docs/agents/HANDOFF.md`). Workers do not see this conversation.
6. One Paseo workspace with worktree isolation per independent task. Never let two agents edit the same worktree at once.
7. Free worker: worktree only, never give it Paseo tools, never make it an orchestrator, and review its output before using it.
8. Fix loop: at most 2 Reviewer rounds. If still failing, stop and bring the problem to the human.
9. **Cost:** use the cheapest profile that fits. Do not introduce a more expensive model than the profiles define without asking the human. If a provider is rate-limited, tell the human before swapping.
10. Update `docs/STATUS.md` every time a delegate is launched or returns, not only at the end. Edit `STATUS.md` and number new plans/ADRs only in the main workspace, never inside a task worktree, so branches do not diverge.
11. After a Reviewer finishes, check its worktree has no changes (`git status`). Not every provider can be read-only; discard any edit a Reviewer made.

## 5. Rules for all agents

- Small diffs, one concern per commit. Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Change behavior → add or update a test. Run the test command before saying "done" and report what you actually ran.
- Stay in scope. Things you notice outside it go to "Parked follow-ups" in STATUS.md, not into your diff.
- Simplicity first: build only what was asked. No extra features, abstractions or config "for later". If it can be simpler, make it simpler.
- If a request is ambiguous, state your assumption or ask. Do not silently pick one interpretation.
- Never commit secrets or edit `.env`. Use `.env.example` for documented variables.
- Do not invent project facts. If docs are silent, ask or label the statement as an assumption.
- Hard-to-reverse decisions (data model, public API, dependency choice, folder restructure) get an ADR in `docs/decisions/`.
- Blocked twice on the same problem: stop, report what you tried, do not loop.

## 6. Documentation is the project's memory

Docs are part of Definition of Done. A stale doc is a bug.

| Event | Update |
|---|---|
| Delegate launched/returned, session ends, handoff | `docs/STATUS.md` |
| Plan produced | `docs/plans/NNNN-slug.md` |
| Review finished | One-line result in the plan's "Review log" |
| Structure, components or conventions changed | `docs/ARCHITECTURE.md` |
| Hard-to-reverse decision made | `docs/decisions/NNNN-slug.md` |
| Scope or priorities changed | `docs/ROADMAP.md` (and `docs/PROJECT.md` if scope) |

All project docs (`STATUS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT.md`, plans, ADRs) are written by the Orchestrator, only in the main workspace. Workers never edit them: they list what must change under "DOCS TO UPDATE" in their final report, and the Orchestrator folds it in.

## 7. Definition of done

- Behavior matches the plan's done-criteria.
- Tests pass; lint is clean (or failures are explained).
- Reviewer has no open high/medium findings.
- Docs updated per §6; STATUS.md reflects reality.
- Work is committed on its branch; nothing important lives only in a worktree's uncommitted state.
