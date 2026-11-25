# Handoff formats

Workers start cold. They cannot see the human conversation. Everything they need goes in the prompt or in a file the prompt points to.

## Delegation prompt (Orchestrator → worker)

```text
ROLE: <Planner | Implementer | UI | Reviewer-Claude | Reviewer-Codex | Free worker>
FIRST: Read AGENTS.md, docs/STATUS.md, then your section of docs/agents/ROLES.md. (Reviewers: skip docs/STATUS.md.)
GOAL: <1-2 sentences>
CONTEXT: <plan file path, issue, relevant files, prior decisions>
SCOPE: May touch: <paths>. Must not touch: <paths>.
CONSTRAINTS: <style, compatibility, no new dependencies, ...>
DONE WHEN: <verifiable criteria> + commands to run: <cmds>
REPORT BACK: Use the report format in docs/agents/HANDOFF.md.
```

For a Reviewer, attach the diff (or branch name) and the plan. Leave out the author's reasoning.

## Report (worker → Orchestrator)

```text
STATUS: done | partial | blocked
SUMMARY: <what happened, 2-4 lines>
CHANGED: <files / branch / commit hashes>
VERIFIED: <commands actually run and their result; say "not run" if not run>
NOT DONE / RISKS: <anything incomplete, assumptions, surprises>
DOCS TO UPDATE: <what the Orchestrator should fold into STATUS / ARCHITECTURE / ADR>
NEXT SUGGESTED STEP: <one line>
```

## Review report (Reviewer → Orchestrator)

```text
VERDICT: approve | changes requested
FINDINGS:
- [high|medium|low] path/file.ext:LINE — what is wrong, why it matters, suggested fix
MISSING TESTS: <list or "none">
COMPLEXITY / SCOPE NOTES: <list or "none">
```

## Session-end checklist (Orchestrator)

- [ ] `docs/STATUS.md` updated: summary, in-flight table, single next step, open questions for the human
- [ ] Plan files have current status and review log
- [ ] Every active worktree is listed in STATUS.md with its branch and state
- [ ] Uncommitted work is committed to a WIP branch, or explicitly listed as uncommitted
- [ ] New decisions are in `docs/decisions/`; structure changes are in `docs/ARCHITECTURE.md`

If the context is nearly full or the human says to stop, do this checklist **first**, before anything else.
