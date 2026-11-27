# Roadmap

Priorities, not tasks. Detailed work lives in `docs/plans/`. Chunk numbers refer to section 8 of `docs/plans/0001-core-schema.md`; W-numbers are the screen steps. Current state and the suggested order: `docs/STATUS.md`.

## Now

Nothing is in flight. The human picks the next item from "Next".

## Next (in this order, the human may reorder)

Screens are wired to the real data one at a time: the UI profile builds the screen, the Implementer adds the server code, Reviewer-Codex reviews UI diffs.

- [ ] W1d follow-ups: minutes after a catalog chip tap (default value or unknown), boss images (files from the human; repository or external address), check on Vercel that `data/boss-catalog.csv` is read
- [ ] W3 minutes input beyond the chip, miss reason (200 characters) on a todo
- [ ] W4 retro screen: numbers with drill-down, history, per-character and per-tag view, improvement line, note for ended plans without a retro on the home page (server side exists: `db/retro.ts`, `db/improvement.ts`)
- [ ] W5 event plans: create, missions, own retro
- [ ] Doping catalog screen (the human gives name, duration, meso price, coin cost), then net meso, "today" suggestion and the monthly coin forecast
- [ ] Chunk 11 AI recap (ADR 0005): needs the API key in the server environment; built with a fake model first

## Finish

- [ ] The human enters real plans (T06-C78 to C81)
- [ ] Final sweep: XSS and secrets (T06-C57, C58), private-window check (T06-C01), refresh keeps data, double-click complete leaves one record
- [ ] Final Reviewer run (`AGENTS.md` section 4, Done); no open high or medium findings
- [ ] Submission text: four-line check method (T06-C59), AI-and-my-judgment lines (T06-C60)
- [ ] Remove `db/ping.*` and drop the production `ping` table (the human's OK first); archive the finished Paseo workspaces

## Later

- [ ] Screenshot import of the in-game scheduler (not with AI for now; the human gives sample screenshots first)
- [ ] Automatic clear-time measurement from a browser screen share (about one week; samples first, then a spike, then a full build; OCR choice gets an ADR)
- [ ] Optional: apply a registration edit to this week's todos too (today an edit affects only todos generated afterwards)

## Done

- [x] Project bootstrapped from template; loop mode (ADR 0002); ROLES.md aligned
- [x] Task text saved as `docs/TASK.md`
- [x] Stack settled and deployed: Next.js on Vercel with GitHub auto-deploy, Neon Postgres (ADR 0003)
- [x] Data model and AI recap decided (ADR 0004, ADR 0005, plan 0001)
- [x] Chunks 1-9: schema, time helpers, characters and versioned registrations, plans and idempotent generation, todos, run records, retro numbers, improvement todo, export and schema contract
- [x] UI shell on `/preview` with mock data (two review rounds)
- [x] Schema applied to `production` (empty)
- [x] W1 registrations screen on real data (`/register`), W1c limits (12 weekly bosses per character, account level missions only), W1d boss catalog picker
- [x] W2 this-week screen on real data as the home page, with the no-login notice
