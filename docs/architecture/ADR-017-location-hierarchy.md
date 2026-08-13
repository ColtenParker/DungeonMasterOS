# ADR-017: Location hierarchy

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Locations represent tangible places and may form a hierarchy from broad World
regions to nested rooms. The hierarchy must coexist with exclusive Entry scope:
a Campaign sees its own Entries and inherited World Entries, while a World must
not depend on Campaign-specific content. Points of Interest are mentioned by the
product but do not yet have distinct identity or behavior requirements.

## Options Considered

### Hierarchy representation

#### Option A: Single-parent adjacency list

Advantages:

- Directly represents a forest of Locations with ordinary foreign keys.
- Makes moves a validated parent-reference update.

Disadvantages:

- Ancestor and descendant queries require recursion.

#### Option B: Materialized path or PostgreSQL ltree

Advantages:

- Makes subtree queries efficient.

Disadvantages:

- Makes moves and Prisma integration more complex than current needs justify.

#### Option C: Generic Entry relationships

Advantages:

- Reuses the existing relationship table.

Disadvantages:

- Cannot enforce one parent, acyclic structure, or hierarchy semantics.

### Points of Interest

#### Option A: Nested Locations or free-form content

Advantages:

- Covers current needs without inventing a second place model.

Disadvantages:

- Does not distinguish a POI from another nested Location structurally.

#### Option B: Add a POINT_OF_INTEREST Entry type

Advantages:

- Gives POIs independent identity.

Disadvantages:

- Adds a type whose behavior and lifecycle are not defined.

#### Option C: Add Location-owned POI rows

Advantages:

- Keeps small landmarks beneath a Location.

Disadvantages:

- Creates a second identity and linking model for place-like content.

## Decision

Represent Location hierarchy with one nullable `parentLocationId` on a
Location-specific extension. The reference must target a `LOCATION`, cannot
target itself, and cannot create a direct or indirect cycle. Parent placement is
mutable; moving a Location changes only this hierarchy reference.

A World Location may have no parent or a parent Location in the same World. A
Campaign Location may have no parent, a parent Location in the same Campaign,
or a parent Location in its parent World. A World Location cannot depend on a
Campaign Location, and one Campaign cannot use another Campaign's Location.

Children have deterministic user-controlled ordering within a parent. Root
Locations likewise have deterministic ordering in their visible scope. Cycle,
type, scope, and parent-visibility checks occur in the same transaction as the
Entry aggregate Save. The database retains the parent foreign key and indexes
needed for child lookup.

Do not introduce a separate Point of Interest model in Milestone 6. A POI may
be represented as a nested Location when it needs independent identity and
links, or as free-form material when it does not.

## Reasoning

An adjacency list is the smallest model that expresses the required hierarchy
and supports ordinary reparenting. Permitting a Campaign child under a World
parent lets the DM add Campaign-specific detail beneath shared canon without
allowing Campaign state to redefine the World.

## Consequences

### Positive

- Locations form a navigable, ordered hierarchy.
- Campaign-specific places can extend inherited World geography.
- Moves do not change Entry identity, scope, or generic relationships.

### Negative / Tradeoffs

- Tree traversal requires recursive queries.
- Application transactions must detect cycles and scope-invalid parents.
- Points of Interest have no distinct category in this milestone.

### Future implications

- Permanent deletion must report child Locations and other typed references.
- Scope promotion must define how Campaign descendants are handled.
- A future POI type requires its own behavior and identity review.

## Validation

- integration tests reject self-parenting, indirect cycles, non-Location
  parents, unrelated Worlds, and cross-Campaign parents.
- tests accept same-World, same-Campaign, and Campaign-to-parent-World nesting.
- ordering tests prove stable root and sibling order after moves.
- UI tests cover nesting, reordering, moving, clearing a parent, and cycle
  errors without losing the draft.

