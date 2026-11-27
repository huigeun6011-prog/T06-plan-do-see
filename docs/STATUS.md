# Status

> The first thing a new agent reads after `AGENTS.md`. Keep it short and true. Owned by the Orchestrator.

- **Phase:** Active
- **Last updated:** 2026-11-27 by Claude (Orchestrator)
- **Branch in use:** `main` (all finished work is merged; no open feature branch)

## Summary

ALEPH task 6: a Plan-Do-See diary for the owner's weekly MapleStory (KR) boss routine (plan, todo, run record, retro linked in a server DB, no login). Task text: `docs/TASK.md`. Loop mode with delegation (ADR 0002): the human throws one chunk at a time, the Orchestrator (you, if you talk to the human) vets it, waits for an explicit OK, delegates to Paseo workers, verifies, writes the docs, merges. Talk to the human in Korean; write repo files in English.

**Live and working** (https://plan-do-see-diary-six.vercel.app, a push to `main` deploys):
- `/` this-week screen on real data: no-login notice, remaining strip, show-only-remaining toggle, per-character cards (weekly bosses on one line, mission row, others), monthly section, tap to complete or undo, box editor for cumulative tiles (earlier days locked, today editable), minutes chip.
- `/register` (menu name `수정`): characters, boss picker from `data/boss-catalog.csv` (difficulty chips, reward = crystal price / party), missions, paste box, edit, reorder, delete, 12 weekly bosses per character, account card with missions only.
- `/export` JSON snapshot, `/preview` mock UI shell.
- Server side done and tested: schema, versioned registrations, plans with idempotent generation, todos, run records, retro numbers, grouped retro, history, overview, improvement todo, export (`db/*.ts`). The retro, improvement, history and overview have NO screen yet.

**Not built yet:** retro screen (W4), minutes and miss-reason input beyond the minutes chip (W3), event plans screen (W5), AI recap (ADR 0005, needs the API key), doping catalog, today suggestion, coin forecast, automatic clear-time measurement, boss images.

**Data:** the `production` Neon branch has the schema and is EMPTY (plus the throwaway `ping` table, 4 rows, drop only with the human's OK). The human has not entered real plans yet. The `dev` branch holds the human's own test data and my test data; truncate only after checking `NEON_BRANCH=dev`, and do not erase the human's test data without asking.

## Next step

Ask the human which to do first; suggested order:
1. W1d follow-ups: the boss picker asks for minutes after a chip tap because the server needs `clear_minutes >= 1` and the catalog has none (option: a default such as 10, or accept 0 as unknown; ask). Check once a character exists in production that the catalog CSV is read on Vercel (the page falls back to the typed form if not). Boss images: the human gives files; decide repository versus external address.
2. W3: minutes entry beyond the chip, miss reason (200 characters) on a todo.
3. W4: retro screen (numbers with drill-down, history, per-character and per-tag view, improvement line, ended plans without a retro on the home page).
4. W5: event plans (create, own missions, own retro).
5. Doping catalog (the human gives the table), net meso, today suggestion, monthly coin forecast.
6. AI recap (chunk 11) when the human enters the API key; screenshot import of the in-game scheduler later, not with AI for now.
7. Finish: the human enters real plans; final sweep (XSS, secrets, private-window check T06-C01, refresh keeps data, double click leaves one record); final Reviewer run; submission texts (T06-C59, C60); drop the `ping` table and `db/ping.*`; archive finished Paseo workspaces.

Open question for the human: edits to a registration change only todos generated afterwards (todos are snapshots), so changing a mission's repeat count does not change this week's tile. Leave as designed or add an "apply to this week" option.

## Environment (what exists right now)

| Thing | State |
|---|---|
| Main folder `C:\Users\User\Desktop\T06-plan-do-see` | `main`, `.env.local` points to `production`; DB scripts and DB tests REFUSE here; `npm run build` works |
| Worktree `C:\Users\User\.paseo\worktrees\1fzew51o\ui-shell` | UI agent's; branch `feat/register-catalog` (merged); `.env.local` has the `dev` address only, so DB tests fail there and UI tests work: `npx vitest run tests/ui-*.test.ts` |
| Worktree `...\1fzew51o\core-schema` | Implementer's; branch `feat/week-server` (merged); `.env.local` has `dev` and `test`; full `npm test` works here (289 tests at `d64949f`; switch it to the branch you want checked) |
| Worktrees `db-ping`, `core-schema-plan`, `review-ui-shell` | finished, can be archived |
| Paseo agents | UI `3a7bf0f3-b95d-4bda-836c-7a00a84c7563` (workspace `wks_3256fb9c504da5f0`), Implementer `65420270-e406-491b-adbd-5aa133fe9272` (workspace `wks_4c20089b9b84758d`); reuse them with `send_agent_prompt`; new work starts with `git switch -c <branch> main` in their worktree |
| Dev server | stopped (2026-11-27, at the human's request). To look at a screen locally start `npm run dev -- -p 3010` inside the `ui-shell` worktree (dev DB); a dev server never ends by itself, so stop it by its PID (`netstat -ano` then stop only that PID) when done |
| Neon branches | `production` (real), `dev` (development), `test` (tests reset it) |
| Browser checks | Aside CLI: `aside repl < file.js`; no state survives between calls, so each script starts with `listBrowserTabs()` and `attachBrowserTab(id)` (or `openTab(url)`); read pages with `snapshot(page)` |

## How work runs (learned the hard way)

- Delegate with a self-contained prompt (`docs/agents/HANDOFF.md`); workers do not see the conversation. Approve worker shell commands one by one after reading them; deny `taskkill /IM` style commands, pushes and deploys by workers. Workers never edit docs.
- Verify every worker result yourself: read the diff, run the tests and the build, and for screens drive the real page with Aside on the `dev` DB. Put test data in `dev`, never in `production`.
- UI logic goes into pure functions under `lib/ui/` with tests (there are no DOM test tools). Server actions live next to the screens and return serializable results with generic Korean errors.
- Ask the human before merging to `main`, applying anything to `production`, or adding accounts, secrets or services. The human once said "decide the merge yourself" for W2; do not assume it carries over.
- The human's taste: minimal text, neutral black and white, PC first and phone usable, stacked numbered cards, tiles with icon and difficulty badge letter; the task conditions are guidelines the human may break; useful extras are welcome; no AI for screenshot import for now.

## In flight

No worker agent is running (no dev server is running either). Finished work (all merged to `main`):

| Task | Merge |
|---|---|
| Connection check page, schema, time helpers, characters, entries, plans, todos, runs, retro, improvement, export (chunks 1-9, `docs/plans/0001-core-schema.md`) | `ef09043` through the `feat/export` merge |
| UI shell `/preview` | `5761205` |
| W1a/W1b registrations server and screen | `e4b42f5` |
| W1c 12-boss limit, server and screen | `366b9ef` |
| W2a/W2b week server and screen (home page) | `48391d5` |
| W1d boss catalog picker, nav label, party label, no boss repeat count | `4a30514` |

Details: `docs/history/decision-log-2026-11.md`.

## Decision log

Short form (what + why). Full original entries with the checks that were run: `docs/history/decision-log-2026-11.md`.

**Process and tools**
- Loop mode with delegation (ADR 0002): the human throws a chunk, the Orchestrator vets, waits for an explicit OK, delegates, verifies, writes the docs. Done = task cards 1-5 and the checklist met plus a final Reviewer run with no open high or medium findings. Reviewer runs only when needed and by a different provider than the author (the human, 2026-11-27: not early, and few test agents).
- Workers never edit docs; approve their commands one by one; never kill processes by image name; `next dev` writes into AGENTS.md unless `next.config.mjs` sets `agentRules: false`. Workers use Aside only for public documentation. Real-browser checks by the Orchestrator run on the `dev` DB with fake data, removed afterwards.
- The human treats the task's pass criteria as guidelines and may break them; the Orchestrator still judges what is right and may reject ideas. Useful extras are welcome. A decision log line is written for every confirmed decision; hard-to-reverse ones also get an ADR.

**Product**
- The real data is the owner's weekly MapleStory boss routine (4 characters, a 5th in winter); the core stays domain-neutral. Goal: clear every weekly boss; suggestions (later) are advisory only, there is no "can I finish this week" forecast.
- Entry per (character, boss): clear minutes (at least 1), reward in meso, party size, doping names, memo; difficulty is part of the boss name. Account-level monthly entries (Dragon Island) have no character. Weekly reset Thursday 00:00 KST, monthly reset the 1st 00:00 KST (the retro needs the boundary).
- One plan per week; the character is a todo attribute. Plans are weekly, monthly or event (events have their own period and are never mixed). Recurring tasks are registrations; a non-repeating task is a todo inside an event. Deadlines are clean instants shown as "Wed 24:00".
- Hunting is one weekly todo with a target count (6 per week) that accumulates; one run record per todo per Seoul day, units SET not added (a double click cannot count twice). Boxes filled by earlier days are locked, today's are editable, one confirm sets today's units.
- The reward field holds the crystal price only; doping cost is not subtracted yet (revisit with the doping table). Net meso, doping catalog, today suggestion and the monthly coin forecast come later; the tool never chooses doping or simulates timers.
- Retro improvement: AI recap through the Anthropic API (ADR 0005), button only, key only in the server environment, AI never computes numbers; a manual improvement line always works; key not entered yet.
- Nexon Open API will NOT be used (slow, no static game data). The human provides game knowledge as user input. Boss images are on hold (files from the human). Screenshot import of the in-game scheduler: later, not with AI for now. Automatic clear-time measurement from a browser screen share: planned for later; maple-boss.com is not scraped.
- Boss catalog `data/boss-catalog.csv` (56 weekly and monthly rows, daily bosses dropped, short name 듄켈): prices and silver/gold cubes cross-checked with maple.ygh.kr, bronze (브에큐) with the namuwiki table; unknown cube counts are 0 and mean unknown. A catalog entry's reward = crystal price / party size (assumption).
- Registration rules: at most 12 weekly bosses per character (monthly bosses and missions not counted; numbers tunable in `lib/limits.ts`), unlimited missions, the account card holds missions only. An edit of a registration affects only todos generated afterwards (todos are snapshots).
- UI direction: minimal visible text, neutral near-black and white, stacked numbered cards, boss tiles with icon and difficulty badge letter (E, N, H, C, X), dark and light themes, names toggle, PC first and phone usable (44 px targets). Top menu is `주간` and `수정`.

**Stack and data**
- Next.js (React, TypeScript) on Vercel Hobby with GitHub auto-deploy (a push to `main` deploys), Neon Free Postgres, plain parameterized SQL, no ORM (ADR 0003). Driver `@neondatabase/serverless` over HTTP. Branches `production`, `dev`, `test`; DB scripts and DB tests refuse unless the markers in `.env.local` match.
- Data model in ADR 0004 and `docs/plans/0001-core-schema.md`: soft update and delete (new version row, old row `use_yn='N'`), run records unique per todo and Seoul day, done state and retro numbers derived on read (`todo_state` view, shared `TODO_SCOPE_PREDICATES`). Edits use an expected-version contract; lazy idempotent plan and todo generation on access. Seoul time uses a fixed +09:00 offset.
- Schema applied to `production` on 2026-11-27 with the human's OK (empty). Anyone with the link can read and write (task 6: login-free CRUD; access control comes in task 7), so only content that may be public goes in.

**Build history (all merged to `main`)**
- 2026-11-26: connection check page, chunks 1-8 (schema, time helpers, characters, entries, plans, todos, runs, retro, improvement), `/preview` UI shell after two review rounds.
- 2026-11-27: chunk 9 (`/export`, schema contract), W1 `/register`, W1c limits, W2 this-week screen as the home page (the connection check page and `/ping` removed), W1d catalog picker. Reviews found and fixed: sort order of new entries, stale edit after a conflict, rapid reorder races, tag rewriting on edit, plain-todo undo of an earlier day.
- Not verified yet: the light theme by eye, the 360 px layout of the week screen, whether Vercel reads `data/boss-catalog.csv` (falls back to the typed form), the stale-edit conflict and character rename on the screen.

## Parked / undecided

- Doping table is missing: name, duration, meso price, coin cost (human, around 18:00); not needed before the core is built.
- Boss lists per character as text (names, clear minutes, party size, memo); photos cannot be read by workers.
- Auto clear-time: samples needed (waiting room, in-battle timer, clear screen for a few bosses; game resolution, window mode). OCR library choice needs an ADR.
- Whether a Maple boss routine counts as "game practice" for card 1 is the author's reading; ask the instructor if in doubt.
- The connection check page and `/ping` route are removed; still to remove: `db/ping.*` and the production `ping` table (4 rows, needs the human's OK).
- Character images and boss icons: on hold (the human). Placeholders stay for now.
- UI feedback from the human (2026-11-26); items 1-4 were applied in W2 (boxes, one-line tiles, mission row, minutes chip), kept here as the record:
  1. Cumulative tiles (hunting 6/6; decided: earlier days locked, today editable): today a click only adds one. Wanted: a row of boxes (e.g. six squares) that the user clicks to set the count, several at once, then confirms (확정). Backend fit: `completeTodo` SETS that day's units; boxes filled by earlier days are locked, today's boxes are editable, confirm sends units = clicked total minus units from other days (clamped at 0).
  2. A character's tiles (12 or more bosses) must stay on ONE line unless the screen is narrow: narrower tiles and a wider card on PC (the current max width of 960 px forces a wrap).
  3. Weekly content is not only bosses: 지하수로, 앵글러 컴퍼니 and similar missions also appear per character. They are ordinary weekly registrations (no difficulty word, so no badge); show them as a second tile row (mission) in the character card, mock data to include them; the human will list them with minutes.
  4. Where to enter the time a boss took: the preview has no such input yet; the data side exists (`completeTodo` and `setRunDetails` take minutes, started and ended). Proposal: tapping a single tile completes it at once; a small `분` chip shows the entered minutes and opens an inline number field; cumulative tiles open the box editor with confirm; one small details popover can also hold the miss reason.
- Nexon Open API (MapleStory KR), read from the official pages on 2026-11-27 (https://openapi.nexon.com/game/maplestory/?id=14 and ?id=57, /guide/request-api, /support/terms); nothing built, nothing decided:
  - Key: sign in with a NEXON ID, register an app, send the key in the header `x-nxopen-api-key`. Server `https://open.api.nexon.com`. Which characters a personal key can read is NOT stated on the pages read; test with the real key.
  - `GET /maplestory/v1/character/list`: `account_list` with ocid, character_name, world_name, character_class, character_level. `GET /maplestory/v1/id`: ocid from a character name. `GET /maplestory/v1/character/basic`: includes `character_class` and `character_image` (character look image URL).
  - `GET /maplestory/v1/scheduler/character-state` (per ocid): `boss_contents` (content_name, difficulty, cycle, list_order_no, registration_flag = registered in the in-game scheduler, complete_flag = cleared this period), `weekly_contents` and `daily_contents` (content_name, type, now_count, max_count, quest_state), `weekly_boss_clear_count` and `weekly_boss_clear_limit_count`.
  - NOT provided: crystal prices, clear minutes, party size, doping, boss icons. So reward, minutes, party size, memo and doping stay user input.
  - Terms: attribution text `Data based on NEXON Open API` inside the service; pulled data must be refreshed at least every 30 days; no use in advertising; no scraping outside the API; commercial use needs Nexon's written agreement; call limits may apply without notice (HTTP 429). The real response shapes (difficulty wording, character_image host) are unverified until a real call is made.
  - Complete endpoint map read on 2026-11-27: character (25 endpoints: list, basic, stat, equipment, skill and so on), union (4), guild (2), battle practice (4), personal history of starforce, potential and cubes (via `ouid`), scheduler (1), rankings (overall, union, guild, dojang, theseed, achievement; public), notices (notice, update, event, cashshop; public, event notices might carry event periods, fields unverified). No static game data: no boss list, item, monster, map, crystal price or doping endpoint.
- Doping: the Open API has no doping data. A doping catalog (name, duration, meso price, coin cost) is user input, only needed for net meso and the coin forecast; the human does not need to look the kinds up.

## Blockers and questions for the human

- No blocker. Questions are listed under "Next step".
- Clean-up options: archive the finished Paseo workspaces (`db-ping`, `core-schema-plan`, `review-ui-shell`), stop the dev server when not needed.

## Parked follow-ups

Things noticed but deliberately out of scope.

- `listEntries` and the week view order ties by version id; ordering by `root_id` would keep an entry's place even when sort orders tie (an edit creates a new version id). The append fix removes the common case.

## How to verify this page

```bash
git status
git log -10 --oneline
git worktree list
```
