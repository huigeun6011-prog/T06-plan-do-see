# Status

> The first thing a new agent reads after `AGENTS.md`. Keep it short and true. Owned by the Orchestrator.

- **Phase:** UNINITIALIZED   <!-- UNINITIALIZED → Active → Maintenance -->
- **Last updated:** 2026-11-26 by Claude
- **Branch in use:** `main`

## Summary

ALEPH task 6: Plan-Do-See diary (plan/do/see data linked, persisted in a server DB, no login). Working in loop mode with delegation (ADR 0002). Paseo profiles checked: all 6 exist. Task text saved in `docs/TASK.md`. Domain, feature scope and stack are settled (decision log, ADR 0003); no app code yet; install/test/lint/run commands in AGENTS.md are filled when the app exists.

## Next step

1. Human sends the doping table (from home) and confirms the table design direction (see Parked).
2. Orchestrator sends the core table design to Planner, then the core build to Implementer.
2. Human sends the doping table (name, duration, meso price, coin cost) from home.
3. Orchestrator sends the core table design to Planner.

## In flight

| Task | Plan | Profile | Workspace / branch | State |
|---|---|---|---|---|
| DB connection check page (throwaway) | none; delegation prompt only | Implementer | `feat/db-ping` (`3c8519a`), workspace `wks_4bb427a12459055e` | merged to `main` (`ef09043`), deployed |

State: `planning` · `awaiting approval` · `implementing` · `in review` · `fixing` · `blocked` · `ready to merge`

## Decision log

- 2026-11-25: loop mode with delegation (ADR 0002). Why: solo learning project; human conceives, Orchestrator vets and writes docs, Implementer/UI build, Reviewer on demand, Free worker off by default.
- 2026-11-25: soft update and soft delete (new version row, old row `useYN='N'`) instead of UPDATE/DELETE. Why: keeps edit history. Duplicate completion is blocked by a UNIQUE constraint.
- 2026-11-25: done = all card 1-5 pass criteria and the completion checklist met, plus a final Reviewer run with no open high/medium findings; the Orchestrator separately verifies live behavior. Why: an independent reviewer judges severity better than a fixed list.
- 2026-11-26: ROLES.md aligned with loop mode (delegation prompt instead of approved plan, Reviewer on demand, Free worker off by default). Why: it still described the per-task plan flow of ADR 0001. Profile table checked against Paseo: unchanged.
- 2026-11-26: the real plan to track is the owner's weekly MapleStory boss routine (4 characters, a 5th in winter). The core is domain-neutral; Maple specifics are attributes and tags. Why: it is what the human actually does and has no interest in another topic; card 1 lists game practice. Features beyond the pass criteria are allowed when useful and fitting; they are not dropped just for not matching the task.
- 2026-11-26: each (character, boss) entry has clear minutes (always a number, 1 for under a minute), reward in meso, party size, doping names (default = base doping) and a free memo. Difficulty is part of the boss name, no field. Account-level monthly entries (Dragon Island) have no character. Why: clear time differs per character; party size is used to filter suggestions.
- 2026-11-26: weekly reset Thursday 00:00 KST, monthly reset 1st 00:00 KST. Why: the game's resets; the late count in the retro needs a period boundary.
- 2026-11-26: the goal is to clear every weekly boss; when time is short, pick the set with the highest net meso. Suggestions are advisory, never enforced. Why: the human's stated goal.
- 2026-11-26: doping is preset per entry by the human; the tool does not decide doping, simulate timers, compute damage efficiency or advise swaps. Why: an 8-minute doping can cover a 20-minute clear, so a timer rule would be wrong, and damage needs game internals.
- 2026-11-26: net meso = reward minus doping meso price. Cost method is selectable: full price per boss or time-proportional (default, labeled an estimate). Coin dopings have no meso price. Why: shared doping makes full price count twice.
- 2026-11-26: monthly coin forecast = coins per activation (input per character) x weekly activations (estimate = ceil(minutes of entries using that doping / 30), overridable) x number of Thursdays in the month, compared with coins earned (input). Why: the human runs out of coins late in the month and wants to know in advance.
- 2026-11-26: no "can I finish this week" forecast. Why: it needs daily available minutes typed in every day; the task does not require it.
- 2026-11-26: build order: core (cards 1-5), overview per character, "today" suggestion, coin forecast. Why: the first two satisfy the task; the rest is the part the human wants to dig into and must not block it.
- 2026-11-26: automatic clear-time measurement is planned for later, not now. Method: browser screen share of the game window, analysed in the browser, no frames sent to the server; the boss and difficulty come from the waiting-room map name and the time from the in-game timer. Needs sample screenshots or a recording first, then a spike. Manual entry stays as the fallback and both feed one run record. Why: the human wants full automation, accepts about one week, and does not want to rebuild an external service by hand. No scraping of maple-boss.com (its terms, article 7, forbid it).
- 2026-11-26: stack confirmed (ADR 0003): Next.js (React) on Vercel Hobby, Neon Free Postgres only, plain SQL with parameters, no ORM. TypeScript, plain CSS and Vitest are Orchestrator defaults. Why: server-side layer keeps the connection string off the browser; SQL-level guarantees are what the task checks. Signups done (Neon asked for no card).
- 2026-11-26: Neon set up in the main folder (`neon init`, `neon login`, `neon deploy`): Postgres only, `.env.local` pulled and git-ignored, config committed (`1c6d860`). `neon init` also reported configuring agent plugins or skills outside the repo (claude-code, codex, vscode, others); not inspected. Connection check page delegated to Implementer in a worktree; `.env.local` copied there without reading it.
- 2026-11-26: connection check page built by Implementer (`3c8519a` on `feat/db-ping`). Orchestrator re-ran `npm test` (6 passed) and `npm run build` (passed), read the diff (parameterized queries, server-only connection string, notes rendered as text, no secrets in the tree). Implementer reported a local save and restart check against Neon. Driver: `@neondatabase/serverless` over HTTP. One smoke-test row remains in the `ping` table. No Reviewer run: throwaway code.
- 2026-11-26: workers may use Aside only to read public documentation; they must not open or read the human's signed-in tabs or copy tokens or connection strings. Why: Aside drives the human's own browser. The human set the default Aside profile to the connected one.
- 2026-11-26: merged to `main` and pushed to GitHub with the human's OK (`ef09043`). Vercel project `plan-do-see-diary` created and deployed with the Vercel CLI (no Git integration: the Vercel account has no GitHub login connection yet). `DATABASE_URL` stored as a Production secret, taken from `.env.local` without printing it. Production URL: https://plan-do-see-diary-six.vercel.app . Verified without cookies: GET 200, POST saved a note, it was listed again, a markup note came back escaped, a blank note was rejected (303 to the error page), and the first row came from the Implementer's local run, so both hit the same Neon database. The deployment-specific URL returns 302 (Vercel protection); the production URL is open.

## Parked / undecided

- Doping table is missing: name, duration, meso price, coin cost.
- Table layout (plan versions, todo, run record, completion record; retro computed on read). Open points: one plan per week with the character as a todo attribute (leaning) versus one plan per character; daily 30-minute hunting as one todo per day (proposed, not confirmed).
- What goes into the reward field: net of doping cost or crystal price only. The tool reads the value as entered (proposal).
- Auto clear-time: samples needed (waiting room, in-battle timer, clear screen for a few bosses; game resolution, window mode). OCR library choice needs an ADR.
- Whether a Maple boss routine counts as "game practice" for card 1 is the author's reading; ask the instructor if in doubt.
- Vercel Git integration needs a GitHub login connection on the Vercel account (human, in the browser); until then every deploy is `vercel deploy --prod` from the Orchestrator.
- Check in a real private browser window once (T06-C01); only cookie-less requests were tested so far.
- Delete the connection check page and the `ping` table once the real app exists.

## Blockers and questions for the human

- None

## Parked follow-ups

Things noticed but deliberately out of scope.

- None

## How to verify this page

```bash
git status
git log -10 --oneline
git worktree list
```
