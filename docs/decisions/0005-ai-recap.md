# 0005 — AI recap through the Anthropic API, on a button, server-side only

- **Status:** accepted (built last; the human's API key is not entered yet)
- **Date:** 2026-11-26

## Context

T06-C33 asks for an improvement from the retro that is reflected in the next plan. The human wants to write why unfinished items were missed, and have an AI judge from the retro and those reasons what to improve and how to apply it (no improvement is a valid outcome when the reason was unavoidable). The human already has an API account and will buy API usage. The site is public and login-free until task 7, so anyone with the link could trigger calls.

## Decision

- Add the official Anthropic SDK (`@anthropic-ai/sdk`) as a dependency, called only from server code. The key is the server environment variable `ANTHROPIC_API_KEY` (Vercel and `.env.local`), never in client code, responses, the repo or logs (T06-C58). The model name is an environment variable; the default is `claude-haiku-5-5`.
- The call happens only when the human presses "make AI recap" on a plan's retro page. At most one stored result per plan; pressing again shows the stored one. A daily call cap is kept in the database and refuses calls beyond it. The human also sets a monthly spend limit in the API console.
- Input: the plan's retro numbers, the unfinished todos and their miss reasons (200 characters each). Output: JSON with an improvement line or "none", and one apply action from a whitelist: add an improvement todo to the next plan, or adjust the expected minutes of a named todo of the next plan. Changing a registration's clear minutes is only suggested, never applied. The app validates the schema, the target ids (they must belong to the next plan) and ranges, and renders all AI text as plain text.
- The AI never produces the retro numbers; SQL does (ADR 0004).
- Tests use a fake model. Without a key the button shows a clear message. A manual improvement line always works.

## Alternatives considered

- Rule-based generation (largest overrun) — cheap but only says that an estimate was off, never why; kept out.
- Calling the AI automatically when an ended plan is opened — any visitor or crawler would spend the human's money.
- Letting the AI change registrations directly — affects every future period; suggestion only.

## Consequences

- Cost is small (one call per plan) and bounded by the cap and the console limit.
- Prompt injection through miss reasons is limited by the whitelist and validation, but anyone with the link can still write reasons until login exists (task 7).
- Reasons and retro text are sent to the API vendor; only job names and short texts are entered, per the public-link rule.
- The Vercel function time limit for a call is unverified; the call is made on a button press and failures show an error with retry.
