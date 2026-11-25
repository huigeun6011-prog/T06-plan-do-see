# Bootstrap (first session only)

Run this when `docs/STATUS.md` says `Phase: UNINITIALIZED`. The Orchestrator does it; the human only answers questions.

This template supports **web**, **game** and **novel** projects. Run shell commands in Git Bash; PowerShell equivalents are given where the syntax differs.

1. **Ask the human once, in one batch**, in plain language (add a short explanation to any technical term):
   project name · one-line purpose · **type (web / game / novel)** · public or private · stack (for a game: the engine), only if they already have one in mind · license, only if public (default MIT).
   - Every question accepts **"not sure, you decide"**. Then you pick a sensible default, say why in one line, and record it (ADR if hard to reverse). For an unknown stack, have a Planner propose 2-3 options with a recommendation and get the human's approval.
   - Do **not** ask for install/test/lint/run commands. There is no code yet. Leave them `TBD` (`N/A` for a novel) and fill them in once the stack is scaffolded.
2. **Fill placeholders.** Find them with:
   ```bash
   grep -rnE '\{\{[A-Z_]+\}\}' . --exclude-dir=.git --exclude=BOOTSTRAP.md --exclude=TEMPLATE_GUIDE.md
   ```
   PowerShell:
   ```powershell
   Get-ChildItem -Recurse -File | Where-Object { $_.Name -notin 'BOOTSTRAP.md','TEMPLATE_GUIDE.md' } | Select-String '\{\{[A-Z_]+\}\}'
   ```
   Replace each with real content. Unknown → write `TBD`, never delete the line (commands stay `TBD` until the stack is scaffolded). A command that does not apply → `N/A`.
   Placeholders: `PROJECT_NAME`, `DESCRIPTION`, `STACK`, `INSTALL_CMD`, `TEST_CMD`, `LINT_CMD`, `RUN_CMD`, `DATE`. The Orchestrator fills all of them; `DATE` is today's date as `YYYY-MM-DD`.
3. **Shape the layout** to the type, then update the layout section of `docs/ARCHITECTURE.md`. Add a `LICENSE` if the human chose one. Do not scaffold frameworks unless asked.
   - **web:** keep `src/`, `tests/`, `scripts/`. Add stack-specific `.gitignore` entries.
   - **game:** same as web, plus the engine's standard `.gitignore` entries. If the project will hold large binary assets, ask the human about Git LFS.
   - **novel:** rename `src/` to `manuscript/`, remove `tests/` (keep `scripts/` only if needed). Install/test/lint/run are `N/A`; the Definition of Done in `AGENTS.md` §7 then means: manuscript committed, docs updated, review findings closed.
4. **Check Paseo profiles.** Confirm Planner, Implementer, UI, Reviewer-Claude, Reviewer-Codex and Free worker exist and match `docs/agents/ROLES.md`. If any is missing or different, tell the human what to fix (Settings → host → Agents → Agent profiles). Do not invent profiles.
5. **Seed the docs with the human:** `docs/PROJECT.md` (purpose, scope, non-goals), `docs/ROADMAP.md` (first milestone).
6. **Clean up:** delete `TEMPLATE_GUIDE.md` and this file, and remove the "Not bootstrapped?" callout from `AGENTS.md`.
7. **Finish:** set `Phase: Active` in `docs/STATUS.md`, fill "Next step", commit as `chore: bootstrap project from template`, and tell the human what was set up and what is still `TBD`.
