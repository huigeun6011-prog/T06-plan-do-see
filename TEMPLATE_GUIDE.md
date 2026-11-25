# Template guide (deleted during bootstrap)

## What this is

A project template for working with AI agents through **Paseo**. It assumes Paseo agent profiles and an Orchestrator (Claude Code or Codex) with Paseo tools enabled.

- **Meant for:** web, game and novel projects of non-trivial size.
- **Not meant for:** small throwaway projects. The plan → approval → implement → review loop is overhead there.

## Starting a new project

1. On GitHub open this template → **Use this template** → **Create a new repository**
   (CLI: `gh repo create new-name --template your-account/this-template --private --clone`)
2. Clone it locally.
3. In Paseo, check that six agent profiles exist: Planner, Implementer, UI, Reviewer-Claude, Reviewer-Codex, Free worker. Their settings are in `docs/agents/ROLES.md`.
4. Run the Orchestrator (Claude Code or Codex) in this folder with Paseo tools enabled and say:

   > Follow docs/BOOTSTRAP.md and set up the project

The Orchestrator asks for name, purpose, type (web / game / novel), stack and commands in one batch, fills the placeholders, deletes this file and makes the first commit.

## Later sessions

A new session needs no explanation: reading `AGENTS.md` and then `docs/STATUS.md` gives the current state.
At the end of a session just say "update STATUS and wrap up".

## Maintaining the template itself

- Settings → General → tick **Template repository**.
- Changing the template does not update projects already created from it (each is a snapshot).
- When you change a model, update the Paseo profile and the table in `docs/agents/ROLES.md` together.
