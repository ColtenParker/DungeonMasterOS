# ADR-015: Specialized Entry sections and persistence

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Milestone 6 adds behavior-specific data to the universal Entry foundation. The
product requires structured data only when the application needs to act on it,
while preserving a rich free-form document for DM-authored material. Presets
must choose which optional sections appear initially, and the DM must later be
able to add, remove, and reorder supported sections.

ADR-004 already selects relational extension tables and explicit relations over
a generic specialized JSON property bag. ADR-011 requires explicit Save and
dirty-window protection. This decision defines how those established choices
apply consistently across the Milestone 6 specializations without designing a
generic replacement for their distinct domain models.

## Options Considered

### Delivery sequence

#### Option A: Separate vertical slices

Design and implement NPC, Location, Quest, Faction, Item Library, Inventory,
and presets in the milestone's stated sequence.

Advantages:

- Keeps each type grounded in behavior the application actually needs.
- Limits premature common abstractions.

Disadvantages:

- Shared patterns may be refined as later slices are completed.

#### Option B: One comprehensive specialized schema

Advantages:

- Produces a single up-front database design.

Disadvantages:

- Encourages speculative modeling across unrelated types.

#### Option C: Build a generic section framework first

Advantages:

- Could reduce repeated UI code.

Disadvantages:

- Risks turning type-specific behavior into an untyped content-management
  abstraction.

### Save boundary

#### Option A: Atomic Entry aggregate Save

Advantages:

- Preserves the existing explicit-save and dirty-window contract.
- Prevents partially saved documents and structured sections.

Disadvantages:

- The Entry payload grows for types with child collections.

#### Option B: Immediately save every section through separate endpoints

Advantages:

- Gives each child resource an independent API.

Disadvantages:

- Produces mixed saved and unsaved state inside one editor window.

#### Option C: Store the aggregate in JSON

Advantages:

- Requires fewer relational writes.

Disadvantages:

- Conflicts with ADR-004 and weakens reference integrity.

### Optional section representation

#### Option A: Persist an ordered allow-listed section layout

Advantages:

- Distinguishes an empty enabled section from a removed section.
- Supports presets, reordering, and restoration across reloads.

Disadvantages:

- Requires validation between Entry type and supported section identifiers.

#### Option B: Infer sections from nullable data

Advantages:

- Avoids separate layout records.

Disadvantages:

- Cannot represent an intentionally enabled but empty section.

#### Option C: Keep layout only in browser state

Advantages:

- Requires no persistence.

Disadvantages:

- Loses user choices across reloads and devices.

### Section removal

#### Option A: Confirm and delete the section's structured data

Advantages:

- Makes removal semantics explicit and avoids hidden retained data.

Disadvantages:

- Removed data is not restored by re-adding the section.

#### Option B: Hide and preserve removed-section data

Advantages:

- Makes accidental removal reversible.

Disadvantages:

- Retains invisible data that can affect export and future behavior.

#### Option C: Prevent removal of nonempty sections

Advantages:

- Avoids accidental loss.

Disadvantages:

- Makes legitimate cleanup cumbersome.

### Status representation

#### Option A: Type-specific bounded text

Advantages:

- Allows NPC, Quest, and Faction vocabularies to differ.
- Supports exact filtering and autocomplete without imposing game rules.

Disadvantages:

- Values require normalization and may vary between Worlds.

#### Option B: Fixed enums

Advantages:

- Produces uniform values.

Disadvantages:

- Imposes an undocumented vocabulary across game systems.

#### Option C: One status column on every Entry

Advantages:

- Simplifies broad queries.

Disadvantages:

- Adds an inapplicable nullable field to types without status behavior.

### Integrity enforcement

#### Option A: Layered database and transactional service enforcement

Advantages:

- Uses foreign keys and checks for local invariants and contextual service
  validation for type, scope visibility, and cycles.
- Matches the existing Prisma/PostgreSQL architecture.

Disadvantages:

- Some cross-row invariants are not expressible as simple database checks.

#### Option B: PostgreSQL triggers for every cross-row invariant

Advantages:

- Protects against invalid out-of-band writes.

Disadvantages:

- Duplicates domain logic and complicates Prisma migrations.

#### Option C: Application validation only

Advantages:

- Keeps rules in TypeScript.

Disadvantages:

- Gives the database less protection against invalid references.

### Specialized backlinks

#### Option A: Treat typed foreign keys as first-class references

Advantages:

- Backlinks can combine generic relationships, inline links, and specialized
  references without duplicating rows.

Disadvantages:

- Backlink queries must union several reference sources.

#### Option B: Mirror typed references into EntryRelationship

Advantages:

- Reuses one backlink query.

Disadvantages:

- Creates two sources of truth for one relationship.

#### Option C: Exclude typed references from backlinks

Advantages:

- Keeps existing relationship queries unchanged.

Disadvantages:

- Hides important dependencies from navigation and deletion checks.

### Search coverage

#### Option A: Keep full-text search on existing Entry text and add exact filters

Advantages:

- Avoids redesigning generated search vectors around child-table changes.
- Still makes structured status useful through filtering.

Disadvantages:

- Objective text and inventory notes are not initially full-text searchable.

#### Option B: Aggregate every structured text field into full-text search

Advantages:

- Provides broader discovery.

Disadvantages:

- Requires synchronization whenever any subtype child changes.

#### Option C: Copy structured text into the rich document

Advantages:

- Reuses current indexing.

Disadvantages:

- Duplicates data and creates conflicting edit sources.

## Decision

Use separate vertical slices in the required Milestone 6 sequence. Each Entry
continues to own its universal title, document, identity, scope, archive state,
tags, and relationships. Type-specific behavior uses relational one-to-one
extensions or explicit child relations.

An Entry read returns its applicable structured details and ordered section
layout. One validated explicit Save persists the title, rich document, section
layout, subtype values, and subtype child collections atomically. Stable child
identifiers are retained across saves where a child has not been removed.

Persist enabled optional sections as ordered, allow-listed layout records.
Section identifiers are valid only for their Entry type. The rich document is
always available and is not an optional section. Removing a nonempty structured
section requires confirmation and deletes that section's structured data in the
same Save; re-adding it starts empty.

Use separate nullable, bounded status text in the NPC, Quest, and Faction
extensions. Normalize surrounding whitespace, preserve the DM's display value,
offer autocomplete from existing values in the relevant context and type, and
support exact status filtering. Status changes never trigger other domain
changes.

Enforce local ownership, required values, uniqueness, and reference existence
with PostgreSQL foreign keys, unique indexes, and check constraints. Enforce
Entry-type compatibility, World/Campaign visibility, and hierarchy cycles in
the transactional service boundary, with integration tests proving the rules.

Typed foreign keys are first-class references. Backlink and future dependency
views combine them with generic relationships and inline references; the system
does not mirror them into `EntryRelationship`.

Keep Milestone 6 full-text search limited to the existing Entry title,
document, and tags. Add exact structured filters where specified, initially
status. Do not duplicate subtype text into the document or search columns.

## Reasoning

This design preserves the useful common Entry lifecycle while letting each
specialization earn its own schema through application behavior. Atomic saves
fit the established workspace editing model, and persisted layout records are
the smallest reliable representation of optional section presence and order.
Typed references retain relational integrity without corrupting the meaning of
generic related-content links.

## Consequences

### Positive

- Specialized behavior remains type-safe and relational.
- Empty, removed, and reordered sections have unambiguous persisted states.
- A failed Save cannot leave an Entry partially updated.
- Specialized dependencies remain visible to backlinks and later deletion
  checks.

### Negative / Tradeoffs

- Aggregate Save validation and transactional diffing are more involved.
- Backlink queries gain additional typed reference sources.
- Structured child text has limited search coverage in this milestone.
- Confirmed section removal permanently removes its structured data.

### Future implications

- Autosave would require a new decision and cannot bypass the aggregate Save.
- Permanent deletion must include all typed references in dependency results.
- Broader structured full-text search requires an explicit indexing design.
- Common UI components may be extracted only after repeated needs are proven.

## Validation

- API tests reject sections that are unsupported for an Entry type.
- integration tests prove aggregate saves commit or roll back as one unit.
- editor tests cover dirty state for document, layout, scalar, and child edits.
- interaction tests cover add, reorder, confirmed removal, cancellation, and
  failed saves.
- backlink tests include typed references exactly once.

