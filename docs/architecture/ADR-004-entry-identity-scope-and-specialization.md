# ADR-004: Entry identity, scope, and specialization

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 2 establishes the universal Entry foundation used by NPCs,
Locations, Journals, and later content types. Entries share behavior such as a
title, editable document, World or Campaign scope, archive state, and future
support for links, tags, search, and media. The initial milestone implements
only NPC, Location, and Journal with minimal specialized behavior.

The persistence model must make universal browsing and future relationships
straightforward without inventing structured fields before the application has
behavior that needs them. It must also enforce that every Entry belongs to
exactly one valid scope while preserving the distinction between reusable World
content and Campaign-specific content.

The existing World and Campaign domain uses UUIDv7 identity, boolean archive
state, duplicate display names, deterministic unpaginated lists, REST
resources, Zod validation, last-write-wins editing, and independent child
lifecycle state. This ADR determines which of those conventions become part of
the Entry foundation.

## Options Considered

### Shared Entry persistence

#### Option A: One universal Entry table with a type discriminator

Store common fields and an Entry type in one table. Initial Entry types differ
by discriminator and user-facing category rather than separate persistence
tables.

Advantages:

- Gives every Entry one stable identity and one target for future references.
- Makes universal browsing, archive filtering, and future search
  straightforward.
- Avoids empty subtype tables before specialized behavior exists.
- Centralizes common validation and lifecycle behavior.

Disadvantages:

- Later structured behavior may require additional subtype tables and joins.
- The discriminator must remain consistent with any future subtype data.

#### Option B: Base Entry plus one-to-one subtype tables immediately

Advantages:

- Gives each Entry type an explicit persistence extension point.
- Can enforce type-specific fields relationally.

Disadvantages:

- Introduces tables and joins with no meaningful specialized fields in
  Milestone 2.
- Requires consistency rules between the base discriminator and subtype rows.

#### Option C: Independent tables for each Entry type

Advantages:

- Allows each type to evolve independently.

Disadvantages:

- Duplicates universal fields and CRUD behavior.
- Makes future universal links, search, archive lists, and polymorphic
  references substantially harder.

### Specialized data

#### Option A: Add relational extension tables only when behavior requires them

Advantages:

- Keeps Milestone 2 limited to proven common behavior.
- Preserves foreign keys and queryable constraints for future structured data.
- Keeps free-form material in the document rather than an untyped property
  bag.

Disadvantages:

- Later Entry types may require additional migrations and joins.

#### Option B: Store specialized data in a generic JSON object

Advantages:

- Optional fields can be introduced without database migrations.
- Supports flexible shapes.

Disadvantages:

- Weakens database guarantees and makes structured relationships difficult to
  enforce.
- Risks using JSON for data the application needs to query or act upon.

#### Option C: Add nullable type-specific columns to Entry

Advantages:

- Avoids joins for specialized fields.

Disadvantages:

- Produces a wide table containing fields irrelevant to most Entry types.
- Makes type-specific constraints awkward.

### Scope representation

#### Option A: Exclusive World or Campaign foreign keys

Store nullable `worldId` and `campaignId` foreign keys and enforce that exactly
one is populated.

Advantages:

- Preserves referential integrity for both scope types.
- Avoids redundantly storing a World on Campaign-scoped Entries.
- Prevents unscoped and multiply scoped Entries.

Disadvantages:

- Queries for all content related to a World must combine direct World Entries
  with Entries reached through its Campaigns.
- Prisma does not express the exact-one check directly, so the migration must
  add a database check constraint.

#### Option B: Required World plus optional Campaign

Advantages:

- Every Entry can be queried directly by World.

Disadvantages:

- Campaign-scoped Entries redundantly store both parents.
- Requires enforcement that the Campaign belongs to the stored World.
- Moving a Campaign between Worlds can invalidate redundant ownership data.

#### Option C: Generic scope type and scope identifier

Advantages:

- Uses one identifier column and is superficially extensible.

Disadvantages:

- PostgreSQL cannot enforce the identifier against two parent tables with a
  conventional foreign key.
- Orphan and mismatched scope references become possible.

### Entry type representation

#### Option A: Prisma and PostgreSQL enum

Advantages:

- Enforces the supported type set in the database and generated client.
- Makes adding a new domain category an explicit reviewed migration.

Disadvantages:

- Renaming or removing enum values requires care.
- Adding each future Entry type requires a migration.

#### Option B: Constrained string

Advantages:

- Is mechanically easier to extend.

Disadvantages:

- Requires synchronized application validation and a separate database check
  constraint.
- Without both layers, invalid type values can be persisted.

#### Option C: Entry-type lookup table

Advantages:

- Supports runtime extension without schema migrations.

Disadvantages:

- Suggests user-defined Entry types and lifecycle behavior that are not an MVP
  requirement.

### Scope visibility and reassignment

#### Option A: Inherited Campaign browsing with immutable Milestone 2 scope

A World context shows its World-scoped Entries. A Campaign context shows both
its Campaign-scoped Entries and reusable Entries from its World. Creation from
Campaign context defaults to Campaign scope but permits an explicit World-scope
override. Scope cannot be changed after creation in Milestone 2.

Advantages:

- Preserves working context while clearly separating shared and Campaign canon.
- Prevents scope changes from silently becoming World-canon promotion.
- Keeps initial lifecycle rules understandable.

Disadvantages:

- Campaign lists must label and combine two sources.
- Correct defaulting depends on the active UI context.

#### Option B: Strictly isolated browsing

Advantages:

- Makes scope boundaries visually simple.

Disadvantages:

- Requires leaving Campaign context to retrieve reusable World material.

#### Option C: Allow scope reassignment immediately

Advantages:

- Gives the DM maximum flexibility.

Disadvantages:

- Introduces canon-promotion, reference, and conflict behavior before those
  workflows are designed.

## Decision

Use one universal `Entry` persistence model with these fields:

- `id`: UUIDv7 primary and external identifier;
- `type`: Prisma/PostgreSQL enum, initially `NPC`, `LOCATION`, or `JOURNAL`;
- `title`: required, trimmed, and between 1 and 120 characters;
- the versioned document content defined by ADR-005;
- nullable `worldId` and `campaignId` foreign keys;
- `isArchived`: boolean defaulting to `false`;
- `createdAt`; and
- `updatedAt`.

The database must enforce that exactly one of `worldId` and `campaignId` is
populated. Both foreign keys use restricted deletion. Entry titles are not
unique; identifiers establish identity.

NPC, Location, and Journal have no specialized persistence fields in Milestone
2. Their minimal specialized behavior is distinct creation and category
browsing. In particular, Location hierarchy and structured NPC sections remain
deferred to their later design reviews.

When structured behavior is later approved, prefer one-to-one relational
extension tables or explicit relations rather than a generic specialized JSON
property bag. Free-form material remains in the Entry document.

A World context shows World-scoped Entries. A Campaign context shows its own
Campaign-scoped Entries plus the World-scoped Entries inherited from its World,
with scope visibly identified. Creating an Entry from Campaign context defaults
to Campaign scope and permits an explicit World-scope override. Entry scope is
immutable in Milestone 2; moving or promoting an Entry requires a later product
decision.

Entry archive state remains independent of parent archive state. Archiving a
World or Campaign does not modify Entry rows. Normal active navigation hides an
Entry when either the Entry or its scope parent is archived. Explicit archived
or combined browsing may reveal it, and direct retrieval and editing remain
available. Creating an Entry beneath an archived scope returns a `409`
lifecycle conflict.

Use contextual REST operations:

- list and create World Entries in World context;
- list and create Campaign-relevant Entries in Campaign context; and
- retrieve, edit, archive, and restore an Entry through its direct Entry URL.

Entry lists accept type and archive filters. They are initially unpaginated and
ordered case-insensitively by title, then by identifier. Permanent deletion is
not part of Milestone 2.

Use the existing Zod validation and error envelope conventions. Editing remains
last-write-wins. Do not create a derived plain-text search field in Milestone 2;
Milestone 3 will choose the search representation and may backfill it from
documents.

## Reasoning

A single Entry table reflects the product's universal Entry concept and creates
one reliable target for the linking and search layers planned next. Avoiding
empty subtype tables and generic specialized JSON keeps the foundation small
without giving up relational extensions when structured behavior is justified.

Exclusive foreign keys retain database integrity while representing the actual
World-or-Campaign rule. Inherited Campaign browsing gives the DM access to
reusable setting material without treating Campaign-specific content as World
canon. Deferring scope reassignment prevents a simple update operation from
implicitly deciding canon-promotion behavior.

Reusing the established identity, archive, validation, ordering, and error
conventions makes the domain consistent without introducing new abstractions or
dependencies.

## Consequences

### Positive

- All current and future Entry types share one stable identity space.
- Future links can reference one Entry table with a conventional foreign key.
- Scope integrity is enforced by PostgreSQL.
- Campaign workflows can see reusable World content without duplicating it.
- Initial Entry types do not acquire speculative structured fields.
- Archive operations do not automatically rewrite child content.

### Negative / Tradeoffs

- World-relevant and Campaign-relevant list queries require different scope
  predicates.
- The exact-one scope constraint must be represented explicitly in SQL.
- Future structured types may introduce subtype joins.
- Prisma enum evolution requires migrations.
- Duplicate titles require scope and type context in selection interfaces.
- Scope cannot be corrected or promoted after creation until that behavior is
  deliberately designed.

### Future implications

- Milestone 3 can add Entry relationships and backlinks with ordinary Entry
  foreign keys.
- Search must extract text from the document representation selected in
  ADR-005.
- Location hierarchy, NPC structured sections, and other specialized behavior
  require their own reviewed relational designs.
- A scope-move or Campaign-to-World promotion operation must define reference,
  canon, and conflict behavior before implementation.
- Permanent deletion must account for scope parents and all later Entry
  references.

## Validation

- Migration tests prove UUIDv7 generation and the supported enum values.
- Database integration tests prove an Entry must reference exactly one valid
  scope and that parent deletion is restricted.
- Persistence tests prove duplicate titles are accepted and ordering is
  deterministic.
- API tests prove contextual scope defaults and explicit World-scope override.
- API tests prove Campaign browsing combines Campaign and inherited World
  Entries without including another Campaign's Entries.
- Archive tests prove parent archiving does not mutate Entry state and active
  navigation applies parent visibility.
- API tests prove archived parents reject Entry creation while direct retrieval
  and editing remain available.
- UI tests prove NPC, Location, and Journal creation, browsing, editing, archive,
  restore, and visible scope labels.

