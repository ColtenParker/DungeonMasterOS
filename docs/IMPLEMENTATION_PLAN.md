# Implementation Plan

## Development Philosophy

This plan is intentionally structured so the human developer retains ownership of architecture and implementation decisions while using Codex to accelerate coding.

A milestone is not a single Codex prompt.

Each milestone has three phases:

1. **Design Review** — inspect requirements and identify decisions.
2. **Human Decision** — developer chooses and documents meaningful technical direction.
3. **Implementation Tasks** — Codex implements small reviewed slices.

Do not proceed to the next milestone until the current milestone is understandable, testable, and reviewable.

---

# Milestone 0 — Repository and Development Baseline

## Goal

Create a stable development environment without making product-domain decisions.

## Human-owned decisions

- TypeScript usage
- package manager
- basic testing approach
- local PostgreSQL development approach
- formatting/linting conventions

## Codex may implement

- project initialization
- configuration
- basic React shell
- basic Express server
- PostgreSQL connectivity
- test runner setup
- lint/format scripts
- basic README setup

## Developer ownership check

Before completion, be able to explain:

- how the frontend talks to the backend
- how the backend connects to PostgreSQL
- how development scripts work
- how tests are run

## Completion criteria

The frontend, backend, and database run locally and a simple test request can travel through the full stack.

---

# Milestone 1 — World and Campaign Domain

## Goal

Establish the product's top-level hierarchy.

## Design Review first

Codex should inspect `PRODUCT_SPEC.md` and propose:

- required World data
- required Campaign data
- relationship between them
- archive behavior
- likely API operations

No implementation yet.

## Human-owned decisions

Document:

- World/Campaign identifiers
- ownership relationship
- archive strategy
- minimum fields
- relevant uniqueness rules

Create an ADR if the decision is consequential.

## Implementation slices

1. World persistence
2. World API behavior
3. World UI
4. Campaign persistence
5. Campaign API behavior
6. Campaign UI
7. archive behavior
8. tests

## Completion criteria

A DM can create, edit, open, list, and archive Worlds and Campaigns.

---

# Milestone 2 — Universal Entry Foundation

## Goal

Create the shared concept that future NPCs, Locations, Journals, and other content will build on.

## Design Review first

Codex should propose at least two viable approaches for representing shared Entry behavior.

Questions to resolve:

- common Entry data versus specialized data
- World/Campaign scope representation
- archive representation
- rich-text persistence format
- how specialized Entry types extend shared behavior

## Human-owned decisions

The developer chooses:

- Entry modeling approach
- scope strategy
- rich-text storage strategy
- specialization strategy

These decisions should be documented in ADRs.

## Initial Entry types

Implement only:

- NPC
- Location
- Journal

with minimal specialized behavior.

## Implementation slices

1. shared Entry model
2. scope behavior
3. Entry API
4. Entry browsing
5. Entry creation
6. Entry editing
7. archive behavior
8. initial Entry types
9. tests

## Completion criteria

The application functions as a basic World/Campaign notebook with multiple Entry types and context-sensitive scope defaults.

---

# Milestone 3 — Linking, Relationships, Tags, and Search

## Goal

Build the knowledge-management layer.

## Design Review first

Resolve:

- relationship representation
- backlink behavior
- inline-link representation
- tag representation
- search strategy
- search scope rules

Codex should explain tradeoffs before implementation.

## Human-owned decisions

Document the chosen:

- relationship model
- inline-link storage strategy
- search behavior
- deletion/reference rules affected by links

## Implementation slices

1. explicit related-content links
2. backlinks
3. optional context notes on relationships
4. inline links to existing Entries
5. create Entry from highlighted phrase
6. tags
7. category search
8. Campaign/World/global search
9. Quick Open
10. tests

## Completion criteria

The DM can navigate primarily through links and search rather than manually browsing categories.

---

# Milestone 4 — Campaign Workspace

## Goal

Build the defining workspace experience.

## Design Review first

Resolve:

- window-state representation
- persistence strategy
- behavior for duplicate-open Entries
- z-order/focus behavior
- resizing and minimizing expectations
- neutral background versus selected media

Avoid choosing a complex window library without comparing alternatives.

## Human-owned decisions

Document:

- workspace state model
- persistence rules
- chosen UI interaction approach
- dependency/library choice if a third-party window system is used

## Implementation slices

1. workspace shell
2. open Entry as floating window
3. focus/bring-to-front
4. drag
5. resize
6. minimize/restore
7. close
8. prevent duplicate Entry windows
9. persist workspace state
10. restore workspace state
11. tests

## Portfolio checkpoint

At this point, record an initial demo.

## Completion criteria

A Campaign reopens with its prior workspace state and Entries can be rapidly opened and manipulated without navigating away.

---

# Milestone 5 — Media Library and Map Navigation

## Goal

Make maps and media reusable first-class resources.

## Design Review first

Resolve:

- media metadata
- local file storage strategy
- World/Campaign media scope
- map-reference representation
- behavior when referenced media is moved or removed

## Human-owned decisions

Document the local media storage approach and reference model.

## Implementation slices

1. Media Library
2. image import
3. map classification
4. scope behavior
5. select active workspace background
6. map marker/reference creation
7. marker → Entry open behavior
8. reference-aware media deletion
9. tests

## Completion criteria

The DM can use a map as the persistent background and click map references to open campaign content.

---

# Milestone 6 — Specialized TTRPG Entries

## Goal

Layer useful structured behavior onto the Entry foundation.

## Design Review first

Handle each Entry type separately. Do not design all specialized data at once.

## Human-owned decisions

For each specialized type, decide which data is:

- structured because the application needs to act on it
- free-form because only the DM needs to read it

## Recommended sequence

1. NPC structured sections
2. Location hierarchy
3. Quest structured sections
4. Faction structured sections
5. Item Library
6. Inventory references
7. Entry presets/default layouts

## Completion criteria

Structured sections add utility without preventing free-form use.

---

# Milestone 7 — Sessions, Initiative, and Calendar

## Goal

Make the application usable during an actual game session.

## Design Review first

Resolve:

- Session start/end state
- activity-log event granularity
- Initiative persistence
- HP tracking behavior
- calendar representation
- reminder representation

## Human-owned decisions

Document:

- which changes create activity-log events
- what Session state means
- calendar behavior
- initiative lifecycle

## Implementation slices

1. Session Entry
2. Start/End Session
3. Session activity logging
4. activity review
5. initiative tracker
6. HP/temp HP tracking
7. Campaign calendar
8. manual time advancement
9. reminders
10. tests

## Completion criteria

Use the application to run at least one real or mock session and record issues found.

---

# Milestone 8 — Real-Use Refinement

## Goal

Improve friction discovered through actual campaign preparation and play.

This milestone is intentionally not fully specified in advance.

## Inputs

Use:

- actual DM usage
- notes from testing Foundry/Obsidian workflows
- bugs
- repeated friction
- accessibility findings

## Possible work

- better keyboard shortcuts
- recently opened Entries
- improved search
- improved window ergonomics
- better empty states
- better preset defaults
- category filtering

## Rule

Do not add a feature solely because another application has it.

Every change should identify a concrete workflow problem first.

---

# Milestone 9 — Data Safety and Portability

## Goal

Make long-running campaign data trustworthy and movable.

## Design Review first

Resolve:

- archive format
- import/export version metadata
- stable identity strategy
- unresolved reference representation
- media packaging
- single-entry code representation

These are consequential architecture decisions and require ADRs.

## Implementation slices

1. reference-safe permanent deletion
2. deletion dependency review
3. World export
4. World import
5. Campaign export/import
6. single-entry export codes
7. Content Bundles
8. Import Review warnings
9. unresolved-reference workflow
10. tests

## Completion criteria

A World can be exported, moved to another local installation, imported, and used without broken included relationships.

---

# Milestone 10 — Portfolio Quality Pass

## Goal

Stop feature development and make the repository demonstrably professional.

## Work

- test important workflows
- error handling
- validation
- accessibility review
- performance review
- README
- architecture overview
- ADR cleanup
- screenshots
- seed/demo World
- short demo video
- known limitations
- future roadmap

## Ownership requirement

The developer should be able to explain every major architectural decision without relying on Codex.

## Completion criteria

The repository is suitable to discuss in an interview.

---

# Working With Codex

## Recommended task shape

Bad:

> Implement Milestone 4.

Better:

> Read the Campaign Workspace requirements in `docs/PRODUCT_SPEC.md` and Milestone 4 in `docs/IMPLEMENTATION_PLAN.md`. Inspect the existing code. Do not implement yet. Identify the technical decisions required for persistent floating Entry windows, provide 2-3 realistic approaches with tradeoffs, and tell me which decisions I need to make.

After choosing:

> We chose approach B and documented it in ADR-004. Implement only opening an Entry in a floating window and preventing duplicate windows. Do not implement drag, resize, persistence, or later tasks yet. Add tests for the behavior you introduce.

## Review rule

Before accepting a substantial change, the developer should answer:

- What files changed and why?
- What new data is stored?
- What API behavior changed?
- What state transitions occur?
- What failure cases exist?
- What tests prove it works?
- Could I explain this design in an interview?

If not, review the code with Codex before moving forward.
