@AGENTS.md

## Claude Code specifics

- Loop mode (AGENTS.md §4): vet the human's chunk first and edit nothing until they confirm.
- As Orchestrator, delegate implementation to Implementer and screens to UI through Paseo profiles; do not write non-trivial code yourself. Docs are yours.
- Profiles that run in **plan mode** (Planner, Reviewer-Claude) cannot write files. Return the plan or review in your final message.
- Keep final reports short and factual: what changed, what you ran, what is left.
