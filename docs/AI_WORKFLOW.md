# AI-Assisted Development Workflow

## Purpose

Codex is used to accelerate implementation, code review, debugging, test creation, and technical exploration.

It is not the owner of product requirements or architectural decisions.

## Responsibility Split

### Human developer owns

- product vision
- requirements
- architecture choices
- data ownership rules
- acceptance criteria
- final code acceptance
- understanding the implementation

### Codex may assist with

- identifying implementation options
- explaining tradeoffs
- scaffolding code after a decision
- implementing scoped tasks
- writing tests
- finding bugs
- refactoring approved areas
- documenting existing behavior

## Standard Workflow

### 1. Read requirements

Codex reads the relevant section of:

- `docs/PRODUCT_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- existing ADRs

### 2. Inspect existing code

No architecture proposal should be made without first understanding the current implementation.

### 3. Identify decisions

Codex separates:

- decisions already documented
- low-risk implementation details
- consequential decisions requiring human input

### 4. Compare options

For consequential decisions, Codex provides realistic options and tradeoffs.

### 5. Human chooses

The developer chooses the approach and documents it when appropriate.

### 6. Implement a small slice

Codex implements only the requested scope.

### 7. Test

Codex adds and runs relevant tests.

### 8. Review for understanding

Before accepting the work, the developer reviews:

- data flow
- database behavior
- API behavior
- UI state behavior
- error cases
- tests

### 9. Explain back

If the developer cannot explain the change, ask Codex to walk through it before continuing.

## Good Prompt Pattern

> Read the relevant product and milestone documentation and inspect the current implementation. Do not code yet. Identify the technical decisions needed for this task, distinguish decisions already documented from decisions I need to make, and provide tradeoffs for the unresolved decisions.

Then:

> I chose Option B and documented the decision. Implement only [specific behavior]. Keep the change scoped, add tests, run them, and summarize the resulting data flow and failure cases.

## Avoid

- "Build the whole app."
- "Implement this milestone completely."
- accepting large generated diffs without review
- letting Codex silently choose the data model
- letting Codex introduce major dependencies without comparison
- allowing implementation convenience to override the product specification

## Interview Readiness Check

For every major feature, the developer should eventually be able to explain:

1. What problem does this feature solve?
2. Why is the data modeled this way?
3. What alternatives were considered?
4. How does data move through the system?
5. What are the key failure cases?
6. How is the feature tested?
7. What would need to change to scale or extend it?
