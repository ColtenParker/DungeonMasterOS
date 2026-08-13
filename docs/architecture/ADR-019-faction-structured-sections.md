# ADR-019: Faction structured sections

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Factions are standalone Entries rather than structural parents. The product
identifies description, goals, leadership, notes, and status as possible
sections, while also establishing that references do not make other Entries
owned by a Faction.

## Options Considered

### Option A: Structure status and leadership

Advantages:

- Enables status filtering and direct navigation to identified leaders.
- Expresses leadership roles without introducing membership ownership.

Disadvantages:

- General membership, rank, and territory remain unmodeled.

### Option B: Structure status only

Advantages:

- Adds minimal schema.

Disadvantages:

- Leadership remains indistinguishable from generic related NPCs.

### Option C: Structure membership, ranks, reputation, and territory

Advantages:

- Creates a broad faction-management system.

Disadvantages:

- Exceeds the product requirements and introduces undefined gameplay rules.

## Decision

Add `FACTION` as an Entry type with optional status and leadership sections.
Status follows ADR-015. Leadership is an ordered list of references to `NPC`
Entries, each with an optional bounded plain-text role. Leadership references
follow the universal visibility rule: World Factions may reference NPCs in the
same World, and Campaign Factions may reference NPCs in their Campaign or
parent World.

Leadership references do not transfer ownership, create membership, change NPC
status, or create generic `EntryRelationship` rows. They appear as typed
references in backlinks and future deletion dependencies.

Keep description, goals, plans, ideology, notes, membership, rank, reputation,
and territory in the rich document or ordinary related-content links. Do not
add automated faction progression.

## Reasoning

Leadership has a specific navigational meaning that generic relationships alone
cannot reliably identify. Status and leadership therefore support useful
behavior, while broader faction simulation would exceed the milestone and the
product's organizational focus.

## Consequences

### Positive

- Factions can be filtered by status and navigated through named leaders.
- Leadership roles can be expressed without an ownership hierarchy.
- The free-form document remains suitable for arbitrary faction detail.

### Negative / Tradeoffs

- Faction membership and reputation are not queryable structures.
- Leadership lists require scope- and type-aware NPC selection.

### Future implications

- Membership or reputation requires its own user-owned design decision.
- Milestone 7 may log leadership or status changes without causing automatic
  progression.
- NPC deletion must report leadership dependencies.

## Validation

- API tests reject non-NPC leaders, invalid roles, and duplicate leadership-row
  identifiers.
- integration tests enforce World and Campaign visibility.
- editor tests cover leadership ordering, roles, removal, and dirty-state
  behavior.
- backlink tests expose leadership references without implying ownership.

