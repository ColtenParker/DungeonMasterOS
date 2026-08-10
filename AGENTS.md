# Repository Guidelines

## Purpose

This repository contains a Dungeon Master-focused campaign management application.

The repository is being developed with AI-assisted implementation, but product and architectural ownership remains with the human developer.

## Source of Truth

Before making product changes, read:

- `docs/PRODUCT_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISION_LOG.md`

Product behavior must follow `PRODUCT_SPEC.md`.

Milestone scope must follow `IMPLEMENTATION_PLAN.md`.

Important technical choices that have already been made should be reflected in `DECISION_LOG.md` or an Architecture Decision Record under `docs/architecture/`.

## Human Ownership Rule

Do not make consequential product or architecture decisions implicitly.

When a task requires a meaningful choice involving:

- database modeling
- API shape
- ownership or lifecycle rules
- data relationships
- state management strategy
- persistence strategy
- library selection
- security behavior
- import/export format
- error-handling policy
- testing strategy
- performance tradeoffs

present the options and tradeoffs before implementation unless the decision has already been documented.

The human developer chooses the direction.

## Codex Working Style

For each task:

1. Read the relevant product and milestone requirements.
2. Inspect the existing implementation before proposing changes.
3. Identify any architectural decision required.
4. If no new decision is required, implement only the requested scope.
5. Add or update tests for the changed behavior.
6. Run relevant tests and checks.
7. Summarize:
   - what changed
   - why it changed
   - tests run
   - assumptions made
   - unresolved questions

Do not begin future milestone work unless explicitly requested.

## Avoid

- Inventing product requirements.
- Expanding scope because a feature seems useful.
- Replacing documented decisions without discussion.
- Large refactors unrelated to the current task.
- Adding cloud, player, VTT, AI, or multiplayer features unless explicitly requested.
- Hiding design tradeoffs behind implementation details.

## Code Review Expectations

Generated code is not considered accepted merely because it runs.

Changes should be understandable enough for the human developer to explain:

- the data flow
- the relevant database relationships
- the API behavior
- the state transitions
- the main failure cases
- why the chosen approach was selected

Prefer straightforward implementations over clever abstractions unless complexity is justified.
