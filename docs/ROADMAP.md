# Roadmap

Priorities, not tasks. Detailed work lives in `docs/plans/`. Chunk numbers refer to section 8 of `docs/plans/0001-core-schema.md`.

## Now

- [ ] Chunk 9: export (`/export`, one JSON file) and `contracts/pds-schema-v2.json` — Implementer on `feat/export`

## Next (in this order)

Screens are wired to the real data one at a time; the UI profile builds the screen, the Implementer adds the server code (pages, forms, route handlers), Reviewer-Codex reviews UI diffs. The human's detail changes (see STATUS "UI feedback") go in first.

- [ ] W1 registrations screen: characters (job names), recurring bosses and missions typed by the user (add, edit, delete, reorder); proposal: a paste box where each line is `name / minutes / party / memo` with a preview, because many entries are typed at once
- [ ] W2 this-week screen on real data (weekly plus monthly tiles, complete, undo, box editor for cumulative tiles), with the no-login notice on the first screen (T06-C82), "what is left" strip and a show-only-remaining toggle
- [ ] W3 minutes (and later times) and miss reason input
- [ ] W4 retro screen: numbers with drill-down, history, per-character and per-tag view, improvement line, note for ended plans without a retro
- [ ] W5 event plans: create, missions, own retro
- [ ] Apply the schema to production (`npm run db:apply:production`, human's OK first) before the first wired deploy
- [ ] Chunk 11 AI recap (ADR 0005): needs the API key in the server environment; built with a fake model first
- [ ] Doping catalog screen (user input: name, duration, meso price, coin cost), then net meso, "today" suggestion and monthly coin forecast

## Finish

- [ ] The human enters real plans (T06-C78 to C81)
- [ ] Final sweep: XSS and secrets (T06-C57, C58), private-window check (T06-C01), refresh keeps data, double-click complete leaves one record
- [ ] Final Reviewer run (`AGENTS.md` section 4, Done); no open high or medium findings
- [ ] Submission text: four-line check method (T06-C59), AI-and-my-judgment lines (T06-C60)

## Later

- [ ] Automatic clear-time measurement from a browser screen share (about one week; samples first, then a spike, then a full build; OCR choice gets an ADR)
- [ ] Character images and boss icons (on hold; files from the human, decide repo versus external address)

## Done

- [x] Project bootstrapped from template; loop mode (ADR 0002); ROLES.md aligned
- [x] Task text saved as `docs/TASK.md`
- [x] Stack settled and deployed: Next.js on Vercel with GitHub auto-deploy, Neon Postgres (ADR 0003)
- [x] Data model and AI recap decided (ADR 0004, ADR 0005, plan 0001)
- [x] Chunks 1-2: schema on `dev`, branch guard, test helper, Seoul time helpers
- [x] Chunk 3: characters and versioned registrations
- [x] Chunk 4: weekly, monthly and event plans, idempotent todo generation, hand-made todos
- [x] Chunk 5: todo update, delete, search, filter, sort, week view data
- [x] Chunk 6: run records (units per day, minutes kept, un-complete), miss reason
- [x] Chunk 7: retro numbers, grouped retro, history, overview per character
- [x] Chunk 8: improvement as a todo in the next plan, plans needing a retro
- [x] UI shell on `/preview` with mock data (two review rounds)
