@AGENTS.md

## Claude Code specifics

- Profiles that run in **plan mode** (Planner, Reviewer-Claude) cannot write files. Return the plan or review in your final message; the Orchestrator saves it.
- As Orchestrator, delegate through Paseo profiles instead of editing non-trivial code yourself.
- Keep final reports short and factual: what changed, what you ran, what is left.
