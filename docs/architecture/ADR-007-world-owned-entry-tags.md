# ADR-007: World-owned Entry tags

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 3 adds optional user-defined tags for cross-category organization,
autocomplete, filtering, and search. Tags must not imply relationships,
hierarchy, or gameplay behavior. World and Campaign Entries need a useful
shared vocabulary without allowing unrelated Worlds to pollute one another's
suggestions.

Entries may have duplicate titles and belong to exactly one World or Campaign
scope. A Campaign belongs to one World and inherits its reusable World Entries.
The tag model must support that inherited context and later World and Campaign
export without storing an inconsistent set of free-form strings on each Entry.

## Options Considered

### Option A: World-owned normalized tags with an Entry join table

Store each tag once within a World and associate it to Entries through a
many-to-many join table. Campaign Entries use the vocabulary owned by their
parent World. Enforce case-insensitive uniqueness within each World while
preserving a display label.

Advantages:

- Supports consistent autocomplete and filtering.
- Allows World and Campaign Entries to share useful labels.
- Prevents tag suggestions from leaking across unrelated Worlds.
- Provides conventional relational data for search and export.
- Makes duplicate associations preventable in the database.

Disadvantages:

- Campaign Entry assignment requires validating the Tag's World through the
  Campaign parent.
- Renaming a shared tag affects every associated Entry in that World.
- Requires joins when listing tags or filtering Entries.

### Option B: One global normalized tag vocabulary

Advantages:

- Has the simplest normalized schema and global autocomplete behavior.
- Makes global tag filtering straightforward.

Disadvantages:

- Unrelated Worlds share spelling and suggestions unintentionally.
- A tag cannot be renamed independently within one World.
- World export does not naturally own its tag definitions.

### Option C: Store tag strings directly on each Entry

Advantages:

- Makes assigning tags mechanically simple.
- Avoids a separate tag lifecycle.

Disadvantages:

- Casing and spelling variants create inconsistent identities.
- Renaming requires rewriting many Entries.
- Autocomplete, filtering, and export must repeatedly deduplicate strings.

## Decision

Use normalized, World-owned tags and a many-to-many Entry association. A Tag
belongs to exactly one World. A World-scoped Entry may use Tags from its World;
a Campaign-scoped Entry may use Tags from its Campaign's parent World. Reject
associations outside that boundary.

Tag identity is case-insensitive within a World, while the stored display name
preserves the DM's chosen casing. Trim and validate tag names at the API
boundary. The database must prevent duplicate normalized names within one
World and duplicate Tag associations on one Entry. The same visible name may
exist independently in different Worlds.

Tags are labels only. Do not add hierarchy, colors, aliases, system behavior,
or implied Entry relationships in Milestone 3. Autocomplete in World context
uses that World's vocabulary. Campaign context uses the same parent-World
vocabulary. Global search may match the displayed tag name across Worlds but
must continue to identify each result's scope.

Expose tag assignment as relational resource behavior rather than embedding a
mutable string array inside the Entry document. Tag changes do not rewrite the
Entry document and are independently queryable for filtering and search.

## Reasoning

World ownership matches the reusable setting boundary and lets every Campaign
inside that World use consistent organizational language. Normalized identity
prevents casing variants from fragmenting autocomplete and filtering, while
preserving display casing keeps the interface natural.

A join table is modest additional structure that directly enables the product
behaviors tags exist to provide. Keeping tags outside the rich-text document
also prevents document parsing from becoming necessary for tag filters and
allows later export to represent tag definitions and associations explicitly.

## Consequences

### Positive

- Autocomplete and filters use one consistent vocabulary per World.
- Campaign and reusable World Entries can share tags.
- Duplicate casing variants and duplicate assignments are preventable.
- Tags remain searchable without parsing document JSON.
- World export has a natural ownership boundary for tag definitions.

### Negative / Tradeoffs

- Assignment validation must traverse a Campaign to its parent World.
- Tag queries require joins.
- Identically named tags in different Worlds remain distinct records.
- Shared tag renaming affects multiple Entries.

### Future implications

- Milestone 8 may refine tag-entry and autocomplete ergonomics based on real
  usage without changing tag identity.
- Milestone 9 World export must include its Tag definitions and associations;
  Campaign export must include or resolve the relevant parent-World tags.
- Advanced hierarchies remain deferred and would require a separate product
  decision.

## Validation

- Migration tests prove case-insensitive uniqueness within a World, permit the
  same name in different Worlds, and prevent duplicate associations.
- Persistence tests prove World and Campaign Entries accept only Tags from the
  correct World boundary.
- API tests prove tag creation, assignment, removal, listing, autocomplete, and
  filtering.
- Search tests prove tag matches respect the selected World, Campaign, or global
  context.
- UI tests prove multiple tags, autocomplete, filtering, and visible removal do
  not alter Entry documents or relationships.

