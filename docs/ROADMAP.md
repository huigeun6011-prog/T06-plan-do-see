# Roadmap

Priorities, not tasks. Detailed work lives in `docs/plans/`.

## Now

- [ ] Core chunks 1-2: schema on the `dev` branch with a test helper, then Seoul time helpers — plan: `docs/plans/0001-core-schema.md`

## Next

- [ ] Core chunks 3-8: characters and registrations, plans with generation and events, todos with search/filter/sort, run records, retro with drill-down and per-character overview, manual improvement
- [ ] Chunks 9-10: export and `contracts/pds-schema-v2.json`, home notice and XSS/secrets sweep
- [ ] Doping table, net meso, "today" suggestion, monthly coin forecast (after the human sends the doping table)

## Later

- [ ] AI recap (chunk 11, ADR 0005): needs the API key in the server environment
- [ ] Automatic clear-time measurement from a browser screen share (about one week; samples first, then a spike, then a full build; OCR choice gets an ADR)
- [ ] Final Reviewer run (`AGENTS.md` section 4, Done)

## Done

- [x] Project bootstrapped from template
- [x] Loop mode (ADR 0002), ROLES.md aligned
- [x] Task text saved as `docs/TASK.md`
- [x] Stack settled and deployed: Next.js on Vercel with GitHub auto-deploy, Neon Postgres (ADR 0003, connection check page live)
- [x] Core data model designed and settled (ADR 0004, plan 0001)
