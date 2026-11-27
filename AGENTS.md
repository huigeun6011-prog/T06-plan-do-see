# Plan-Do-See Diary — Agent Instructions

Single source of truth for every AI agent in this repo (Claude Code, Codex, Antigravity, …).
`CLAUDE.md` only points here. Talk to the human in the language they use; write repo files in English unless told otherwise.

## 1. Cold start (every new session, every agent)

1. Read this file.
2. Read `docs/STATUS.md`: current state, work in flight, next step, blockers. (Reviewers skip this: they get only the diff and the plan, to stay independent.)
3. Run `git status`, `git log -10 --oneline`, `git worktree list`. If they disagree with STATUS.md, **trust git**, then fix STATUS.md.
4. Read `docs/PROJECT.md` (purpose/scope) and `docs/ARCHITECTURE.md` (structure) only if your task needs them.
5. Work in loop mode (§3-§4), then read your role in `docs/agents/ROLES.md`.

## 2. Project snapshot

- **What:** Plan-Do-See diary (ALEPH task 6, text in `docs/TASK.md`): plan, todo, run record and retro linked in a server DB, no login. First real data: the owner's weekly MapleStory boss routine. Details in `docs/PROJECT.md`.
- **Stack:** Next.js (React, TypeScript) on Vercel, Neon Postgres, plain SQL with parameterized queries (ADR 0003)
- **Install:** `npm ci`
- **Test:** `npm test` (Vitest). Run it in a worktree whose `.env.local` has the `dev` and `test` addresses and the branch markers; it refuses in the main folder (production).
- **Lint/format:** `N/A` for now; the type check runs inside `npm run build`
- **Run:** `npm run dev` (local); `npm run build` then `npm start` for a production run. Needs `.env.local` with `DATABASE_URL` (see `.env.example`).

A command that does not apply to this project (for example lint for a novel) is written `N/A`; skip it, do not invent one.

## 3. Roles (loop mode)

- **Human:** conceives, decides, confirms. Throws ideas one chunk at a time.
- **Agent you talk to (Orchestrator):** vets chunks, delegates, integrates, reports, and writes all project docs. Does not implement non-trivial code itself.
- **Workers** (Paseo profiles, used as needed): Planner (big design decisions, plan only), Implementer (builds a confirmed chunk), UI (components, layout, styling), Reviewer-Claude / Reviewer-Codex (on demand, different provider than the author), Free worker (off by default; only when the human agrees).

Profile settings and report formats: `docs/agents/ROLES.md`, `docs/agents/HANDOFF.md`.

## 4. The loop

1. **Throw:** the human states one chunk.
2. **Vet:** judge it for realism, feasibility, better alternatives and conflicts with the ALEPH task 6 requirements. Verdict: accept / partially accept / reject / other opinion, with reasons. Change no files in this step.
3. **Discuss:** settle disagreements together. Unconfirmed items stay in STATUS.md "Parked / undecided", not in code.
4. **Confirm:** only an explicit confirmation from the human ("반영해" or similar) starts step 5.
5. **Apply:** the confirmed chunk replaces the approved plan. Write a self-contained delegation prompt (template in `docs/agents/HANDOFF.md`; workers do not see this conversation) and send it to Implementer (logic) or UI (screens). The Orchestrator updates the docs. Run the tests and commit.
6. **Report:** what changed, what was actually run, what is left. Then back to 1.

- Size of a chunk: whatever the human can say in one sentence.
- One Paseo workspace with worktree isolation per independent task; never two agents in the same worktree. Edit `STATUS.md` and ADRs only in the main workspace.
- Reviewer: run when needed, by a different provider than the author (Implementer/Codex diff → Reviewer-Claude; UI/Claude diff → Reviewer-Codex). Afterwards check its worktree with `git status` and discard any edit. At most 2 review rounds, then bring it to the human.
- Cost: use the cheapest profile that fits; do not use a more expensive model than the profiles define without asking.
- Every confirmed decision gets one line in STATUS.md "Decision log" (what + why). Update STATUS.md whenever a worker is launched or returns.
- Hard-to-reverse decisions also get an ADR (§5). Ask the human before merging to `main` or deploying; signups, accounts and secrets are the human's to handle.
- **Done** = all pass criteria of ALEPH task 6 cards 1-5 and its completion checklist are met, and a final Reviewer run (near the end) leaves no open high/medium findings.
  - Give the Reviewer these focus areas: data loss or duplication, wrong aggregates, XSS or secret exposure, core flow (plan -> todo -> run -> retro) blocked.
  - The Reviewer reads code only. The Orchestrator also verifies and reports: opens in a fresh private window without login (T06-C01), data survives a refresh, double-clicking complete leaves one record.

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

The Orchestrator writes all project docs (`STATUS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT.md`, ADRs), only in the main workspace. Workers never edit them: they list what must change under "DOCS TO UPDATE" in their final report.

## 7. Definition of done

- Behavior matches the confirmed chunk.
- Tests pass; lint is clean (or failures are explained).
- If a Reviewer ran, it has no open high/medium findings.
- Docs updated per §6; STATUS.md reflects reality.
- Work is committed; nothing important lives only in uncommitted state.

## 8. Working with this human (standing rules from the conversations)

- **Language:** speak Korean to the human, in plain words; explain a term the first time you use it (the human asked "what was an ADR?"). Repo files stay English.
- **Question first:** when the human asks a question or says "just asking", answer it and change nothing. When a doc or process change is proposed, say in Korean how you would change it and wait for the OK before editing. Only an explicit go-ahead ("반영해", "해", "ㅇㅇ") starts work.
- **Judge honestly:** say what is right even if the human leans another way; the human may overrule. Task conditions (`docs/TASK.md`) are guidelines the human may break; useful extras that fit the project are welcome, so ask "does it fit and help?", not only "does the task require it?". Do not make the human do what a tool can do.
- **Report what is true:** say what you ran and what you did not verify (for example a screenshot that timed out, a layout not seen, something only read in the code). Never imply a check you did not do.
- **Approvals:** merging to `main` (which deploys), changes to the `production` database, new accounts, secrets or paid services are the human's call each time. One "decide it yourself" applies only to the item it was said about.
- **Test data:** use the `dev` database with fake data and remove your own test data afterwards; never write test data to `production`; do not erase the human's own test data in `dev` without asking.
- **Cost:** be economical with tokens and agents. A Reviewer runs only for big screen changes and the final check, not early; do not start test or helper agents unless they clearly pay off; print only the values you need from tool and browser output; prefer one batched message to a worker over several small ones.
- **The human's taste:** minimal visible text, neutral black and white, PC first with the phone usable; the human tunes numbers (such as the 12-boss limit) later, so keep them in one named constant. The human enters game knowledge (boss list, prices, doping) as data; do not fetch it from the Nexon Open API and do not scrape sites that forbid it.
- **Where things are:** state and next step in `docs/STATUS.md`; decisions in short form there and in full in `docs/history/`; structure in `docs/ARCHITECTURE.md`; priorities in `docs/ROADMAP.md`.
