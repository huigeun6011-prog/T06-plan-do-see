# {{PROJECT_NAME}} — Agent Instructions

Single source of truth for every AI agent in this repo (Claude Code, Codex, Antigravity, …).
`CLAUDE.md` only points here. Talk to the human in the language they use; write repo files in English unless told otherwise.

> **Loop mode (ADR 0002):** this repo is developed in a human-AI loop (§4). The full `docs/BOOTSTRAP.md` ritual is not run;
> `{{...}}` placeholders and `TBD` commands are filled in one confirmed chunk at a time. Delete this callout once none remain.

## 1. Cold start (every new session, every agent)

1. Read this file.
2. Read `docs/STATUS.md`: current state, work in flight, next step, blockers. (Reviewers skip this: they get only the diff and the plan, to stay independent.)
3. Run `git status`, `git log -10 --oneline`, `git worktree list`. If they disagree with STATUS.md, **trust git**, then fix STATUS.md.
4. Read `docs/PROJECT.md` (purpose/scope) and `docs/ARCHITECTURE.md` (structure) only if your task needs them.
5. Work in loop mode (§3-§4). `docs/agents/ROLES.md` describes the older delegation model and does not apply unless the human asks for it.

## 2. Project snapshot

- **What:** {{DESCRIPTION}}
- **Stack:** {{STACK}}
- **Install:** `{{INSTALL_CMD}}`
- **Test:** `{{TEST_CMD}}`
- **Lint/format:** `{{LINT_CMD}}`
- **Run:** `{{RUN_CMD}}`

A command that does not apply to this project (for example lint for a novel) is written `N/A`; skip it, do not invent one.

## 3. Roles (loop mode)

- **Human:** conceives, decides, confirms. Throws ideas one chunk at a time.
- **Agent (you):** vets each chunk, implements confirmed ones, verifies, reports, keeps docs current. You write the code yourself; no Planner/Implementer/Reviewer delegation unless the human asks.

## 4. The loop

1. **Throw:** the human states one chunk.
2. **Vet:** judge it for realism, feasibility, better alternatives and conflicts with the ALEPH task 6 requirements. Verdict: accept / partially accept / reject / other opinion, with reasons. Change no files in this step.
3. **Discuss:** settle disagreements together. Unconfirmed items stay in STATUS.md "Parked / undecided", not in code.
4. **Confirm:** only an explicit confirmation from the human ("반영해" or similar) starts step 5.
5. **Apply:** implement everything in the confirmed chunk (code, tests, docs), run the tests, commit.
6. **Report:** what changed, what you actually ran, what is left. Then back to 1.

- Size of a chunk: whatever the human can say in one sentence.
- Every confirmed decision gets one line in STATUS.md "Decision log" (what + why).
- Hard-to-reverse decisions also get an ADR (§5). Ask the human before merging to `main` or deploying; signups, accounts and secrets are the human's to handle.
- "Deployable" is done when the ALEPH task 6 completion checklist passes and every submitted URL opens in a fresh private window without login (T06-C01).
- Optional: one independent review right before deployment.

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
| Chunk confirmed or applied, session ends, handoff | `docs/STATUS.md` |
| Structure, components or conventions changed | `docs/ARCHITECTURE.md` |
| Hard-to-reverse decision made | `docs/decisions/NNNN-slug.md` |
| Scope or priorities changed | `docs/ROADMAP.md` (and `docs/PROJECT.md` if scope) |

The agent writes all project docs (`STATUS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT.md`, ADRs) when a chunk is applied.

## 7. Definition of done

- Behavior matches the confirmed chunk.
- Tests pass; lint is clean (or failures are explained).
- Docs updated per §6; STATUS.md reflects reality.
- Work is committed; nothing important lives only in uncommitted state.
