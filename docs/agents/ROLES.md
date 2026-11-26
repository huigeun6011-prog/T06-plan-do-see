# Agent roles

Roles are stable; models are not. This file is the repo-side copy of the Paseo agent profiles (Paseo stores profiles on the host, not in git). If a profile changes in Paseo, update this table. **Do not write model names anywhere else in the docs.**

## Profiles

| Profile | Provider · Model | Mode | Thinking |
|---|---|---|---|
| Planner | Claude · Sonnet 5.5 | Plan mode | High |
| Implementer | Codex · GPT-6.2-Sol | Auto-review | Medium |
| UI | Claude · Sonnet 5.5 | Accept file edits | Low |
| Reviewer-Claude | Claude · Sonnet 5.5 | Plan mode | Medium |
| Reviewer-Codex | Codex · GPT-6.2-Sol | Auto-review (no read-only mode exists) | Medium |
| Free worker | Antigravity · Gemini 3.8 Flash | Full access | High |

### Profile notes ("When to use" in Paseo — keep identical)

- **Planner:** Architecture design, root-cause analysis, and comparing implementation options. Do not edit code; produce a plan only.
- **Implementer:** Implement features from an approved plan, fix bugs, and make failing tests pass.
- **UI:** Components, layout, styling, and visual polish.
- **Reviewer-Claude / Reviewer-Codex (same note on both):** Independently review a diff written by another model: correctness, missing tests, unnecessary complexity. Report issues only; do not edit.
- **Free worker:** Narrow, easily reversible work: codebase exploration, docs, draft tests, boilerplate. Run in a worktree only. Has no Paseo tools; never use as an orchestrator.

The Orchestrator is whichever agent the human is talking to (Claude Code or Codex). It has Paseo tools; it is not a profile. In loop mode (ADR 0002) it vets chunks, delegates implementation and screens, and writes all project docs; it does not write non-trivial code itself.

## Role details

### Planner
- **When:** big design decisions only (e.g. table layout, stack), not every chunk.
- **Input:** goal, relevant files, constraints.
- **Output:** a plan returned in the final message (plan mode cannot write files); `docs/plans/_TEMPLATE.md` format if useful. Include 2+ options when the choice is not obvious, with a recommendation.
- **Never:** edit code, run destructive commands.

### Implementer
- **Input:** a self-contained delegation prompt for the confirmed chunk (template in `HANDOFF.md`) and a worktree.
- **Output:** commits on the worktree branch, tests run, a report in the format of `HANDOFF.md`.
- **Never:** widen scope or deviate from the prompt silently. If the prompt is wrong, stop and report.

### UI
- **Input:** a self-contained delegation prompt for the confirmed chunk, design constraints, existing components to reuse.
- **Output:** UI changes using existing components/tokens, a note on how it was checked visually.
- **Never:** change business logic, API contracts, or data shapes. Report the need instead.

### Reviewer (Reviewer-Claude or Reviewer-Codex)
- **Pick by author:** the reviewer must be a different provider than the diff's author. Diffs from Implementer (Codex) → Reviewer-Claude. Diffs from UI (Claude) → Reviewer-Codex. Free worker output is reviewed by the Orchestrator first, then by either.
- **When:** on demand, not automatic. The Orchestrator proposes it when risk warrants, and always once near the end.
- **Input:** the diff and the delegation prompt only. Do **not** give it the author's reasoning, so the review stays independent. For the final run, add the focus areas from AGENTS.md §4 (data loss or duplication, wrong aggregates, XSS or secret exposure, core flow blocked). It reads code only.
- **Output:** verdict (`approve` / `changes requested`) plus findings, each with severity (high/medium/low), `file:line`, why it matters, suggested fix.
- **Checks:** correctness, missing or weak tests, unnecessary complexity, scope creep, doc drift.
- **Never:** edit files. Reviewer-Claude is enforced by plan mode; Reviewer-Codex only by instruction, so the Orchestrator checks its worktree with `git status` afterwards and discards any edit (AGENTS.md §4, Reviewer).

### Free worker
- **Off by default:** use only when the human agrees.
- **Input:** a narrow task, a worktree, explicit file scope.
- **Output:** a report plus changes in its worktree. The Orchestrator must review before anything is merged.
- **Never:** merge, touch `docs/STATUS.md`, launch agents, or work outside its worktree. Instruct it explicitly to read `AGENTS.md` first; it may not load it automatically.
- **Known limit:** its profile has full access, so "worktree only" is enforced by instruction and by the Orchestrator's review, not by permissions. Keep secrets out of its reach.

## Changing models

1. Edit the profile in Paseo (Settings → host → Agents → Agent profiles).
2. Update the table above.
3. Add an ADR only if the change alters role responsibilities.

Stay within the human's current subscriptions. Do not move a role to a more expensive model without asking.
