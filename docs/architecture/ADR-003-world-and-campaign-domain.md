# ADR-003: World and Campaign domain identity and lifecycle

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 1 establishes the application's top-level hierarchy. A World is the
highest-level content container, and a World may contain multiple Campaigns.
The MVP is local, single-user, and DM-only.

The product specification distinguishes archive state from fictional status.
Archived records remain intact but are hidden from default active views. It
also treats portability as a core local-first feature, so identity must remain
stable when data is eventually exported and imported.

Before adding product-domain tables, the project needs explicit decisions for
World and Campaign identity, ownership, minimum fields, archive behavior,
uniqueness, API shape, validation, concurrent edits, and list behavior. These
decisions must fit the existing PostgreSQL, Prisma, Express, React, and strict
TypeScript baseline without introducing later-milestone concepts.

## Options Considered

### Identifiers

#### Option A: UUID identifiers

Use one UUID as both the persistence and external identifier for each World
and Campaign. UUIDv7 provides time-ordered values while retaining globally
portable identity.

Advantages:

- Supports future import and export without relying on installation-local
  sequences.
- Can be created before inserting a record.
- Does not expose approximate record counts through API identifiers.
- UUIDv7 generally has better insertion locality than random UUIDv4 values.

Disadvantages:

- UUIDs are less convenient to read and type while debugging.
- UUIDv7 generation must use a standards-conforming implementation supported
  by the application stack.

#### Option B: PostgreSQL identity integers

Advantages:

- Compact, efficient, and easy to inspect.
- Requires no UUID generation mechanism.

Disadvantages:

- Values are local to a database and require remapping during future imports.
- Sequential external identifiers expose approximate record counts.

#### Option C: Internal integer and public UUID

Advantages:

- Combines compact internal joins with portable external identity.

Disadvantages:

- Adds a second identifier and unique index to every domain model.
- Introduces complexity that is not justified by expected MVP scale.

### World and Campaign ownership

#### Option A: Required World parent with restricted deletion

A Campaign must reference exactly one World. Permanent deletion of a World is
restricted while Campaigns reference it.

Advantages:

- Enforces the documented hierarchy and prevents orphan Campaigns.
- Avoids accidental cascading loss of long-running Campaign data.
- Fits the product's cautious approach to permanent deletion.

Disadvantages:

- Removing a World requires its Campaigns to be handled explicitly first.

#### Option B: Required World parent with cascading deletion

Advantages:

- Makes removal of an entire hierarchy simple.

Disadvantages:

- A single destructive operation can remove every Campaign in a World.
- Conflicts with the product's reference-safe deletion direction.

#### Option C: Optional World parent

Advantages:

- Permits temporarily unassigned Campaigns.

Disadvantages:

- Introduces an orphan Campaign state absent from the product specification.
- Weakens the top-level hierarchy the milestone exists to establish.

### Minimum fields

#### Option A: Absolute minimum

Store only identifiers, names, the Campaign-to-World relationship, and archive
state.

Advantages:

- Makes the smallest immediate domain commitment.

Disadvantages:

- Omits useful descriptive context and reliable creation/update ordering.

#### Option B: Practical CRUD minimum

In addition to identity, ownership, and archive state, store a required name,
an optional description, `createdAt`, and `updatedAt` on both models.

Advantages:

- Supports useful list, create, open, and edit experiences.
- Timestamps support deterministic records and later auditing needs.
- Avoids fields belonging to later milestones.

Disadvantages:

- Timestamps and descriptions add fields before they have specialized
  behavior.

#### Option C: Rich initial metadata

Add fields such as slugs, images, campaign dates, statuses, settings, and a
structured Game System relationship.

Advantages:

- Provides more metadata immediately.

Disadvantages:

- Pulls later-milestone product and architecture choices into Milestone 1.
- Risks confusing fictional status with organizational archive state.

### Archive representation

#### Option A: Nullable archive timestamp

Use `archivedAt`, where `null` is active and a timestamp is archived.

Advantages:

- Records when archiving occurred.

Disadvantages:

- Stores information not required by current archive behavior.

#### Option B: Boolean archive flag

Use `isArchived`, where `false` is active and `true` is archived.

Advantages:

- Directly represents the two required states.
- Keeps filtering and API payloads simple.

Disadvantages:

- Does not record when a record was archived.

#### Option C: Lifecycle enum

Advantages:

- Can represent additional lifecycle states later.

Disadvantages:

- Encourages states that have no current product requirement.

### Name uniqueness

#### Option A: Allow duplicate names

Advantages:

- Supports legitimate fictional settings and Campaigns with identical names.
- Keeps display names separate from identity.

Disadvantages:

- Lists may need descriptions or parent context to distinguish duplicates.

#### Option B: Case-insensitive uniqueness

Advantages:

- Prevents visually duplicate names in the relevant scope.

Disadvantages:

- Rejects legitimate duplicates and requires explicit normalization rules.

#### Option C: Exact-case uniqueness

Advantages:

- Is straightforward to express as a conventional unique constraint.

Disadvantages:

- Produces confusing behavior by treating differently cased names as distinct.

### API operations

#### Option A: Conventional REST resources

Use World resources and nested Campaign creation/listing, with direct resource
URLs for retrieving and editing individual Campaigns.

Advantages:

- Expresses ownership clearly without requiring deeply nested URLs for every
  Campaign operation.
- Fits the existing Express and Supertest baseline.

Disadvantages:

- Archive transitions must be represented consistently within the resource
  API.

#### Option B: Primarily action-oriented endpoints

Advantages:

- Makes individual commands such as archive and restore explicit.

Disadvantages:

- Adds endpoint surface and can lead to inconsistent CRUD conventions.

### Runtime validation

#### Option A: Zod schemas at API boundaries

Advantages:

- Provides reusable runtime parsing and structured validation errors.
- Integrates well with strict TypeScript while keeping runtime checks explicit.

Disadvantages:

- Adds a dependency and a schema layer distinct from Prisma models.
- Zod schemas must not be treated as persistence models by accident.

#### Option B: Handwritten validation

Advantages:

- Adds no dependency and is manageable for very small payloads.

Disadvantages:

- Becomes repetitive and inconsistent as API operations grow.

### Concurrent edits

#### Option A: Last write wins

Advantages:

- Fits a local, single-user MVP and keeps editing straightforward.

Disadvantages:

- Concurrent browser tabs can silently overwrite a more recent edit.

#### Option B: Optimistic concurrency

Advantages:

- Detects stale edits through a version or timestamp precondition.

Disadvantages:

- Requires conflict payloads and frontend conflict handling before current
  workflows justify them.

### List behavior

#### Option A: Unpaginated deterministic lists

Return the complete matching collection ordered case-insensitively by name and
then by identifier.

Advantages:

- Provides simple and stable behavior for expected local MVP data volumes.
- Avoids premature cursor or offset contracts.

Disadvantages:

- Will need revisiting if real data volumes make full collection reads slow.

#### Option B: Pagination from the first domain endpoint

Advantages:

- Establishes bounded response sizes immediately.

Disadvantages:

- Adds API and UI complexity without evidence that Milestone 1 requires it.

## Decision

Use the following World and Campaign domain design:

- Each World and Campaign has a UUIDv7 identifier. The identifier is the
  stable persistence and external identity.
- Each Campaign has one required World parent. The database relationship must
  prevent orphan Campaigns and restrict permanent World deletion while any
  Campaign references the World.
- Both models have a required, trimmed, non-empty `name`; an optional
  `description`; `isArchived`; `createdAt`; and `updatedAt`. Campaign also has
  its required World identifier.
- `isArchived` is a boolean that defaults to `false`.
- Archiving a World does not change the archive flags of its Campaigns. Its
  Campaigns are excluded from normal active navigation because their parent is
  archived, but remain intact and independently archived or active.
- World and Campaign names are not unique. IDs, not names, establish identity.
- Game System persistence is deferred until Game System behavior is designed.
- Use conventional REST resources. Create and list Campaigns in World context;
  retrieve and edit an individual Campaign through its direct resource URL.
- Listing endpoints exclude archived resources by default and accept an
  explicit archive filter when archived or all records are required.
- Permanent deletion endpoints are outside Milestone 1. Archive and restore
  provide the lifecycle behavior required by this milestone.
- Parse API input with Zod at runtime. Use additional targeted validation only
  if Zod cannot adequately enforce a required rule.
- Editing uses last-write-wins semantics for the single-user MVP.
- Lists are initially unpaginated and ordered case-insensitively by name, then
  by identifier for deterministic ties.

The initial resource operations are:

- create, list, retrieve, edit, archive, and restore Worlds;
- create and list Campaigns within a World; and
- retrieve, edit, archive, and restore individual Campaigns.

Exact URL spelling, request and response DTO fields, maximum text lengths, and
the shared error envelope must be specified and tested in the API behavior
slice. They must not be inferred directly from generated Prisma types.

The UUIDv7 generation mechanism must be standards-conforming. If implementation
requires a new runtime library, that library choice must be reviewed before it
is added; this ADR does not implicitly approve a particular package.

## Reasoning

This design establishes the required World-to-Campaign hierarchy with the
smallest useful set of metadata. Required ownership and restricted deletion
preserve data integrity without adding orphan states or destructive cascades.
UUIDv7 identity prepares domain records for later portability while also
providing better insertion locality than random UUIDs.

A boolean archive flag directly represents the two currently required
organizational states. Keeping Campaign archive flags unchanged when a World is
archived avoids hidden automatic state transitions and preserves the ability to
restore the World with its prior Campaign organization intact.

Duplicate display names reflect the fictional domain and prevent names from
becoming accidental identifiers. REST resources and Zod validation fit the
existing API baseline while preserving a boundary between transport contracts
and Prisma persistence models. Last-write-wins editing and unpaginated,
deterministic lists are proportionate to a local, single-user first milestone
and can be revisited based on real-use evidence.

## Consequences

### Positive

- The database will enforce that every Campaign belongs to a valid World.
- A World cannot be permanently removed through a database cascade that also
  destroys its Campaigns.
- Identifiers are suitable for later import and export work.
- Archive operations do not implicitly rewrite child records.
- Duplicate fictional names remain valid.
- API inputs receive runtime validation rather than relying on TypeScript.
- Initial list and edit behavior remains small and understandable.

### Negative / Tradeoffs

- UUIDs are less readable than sequential integers.
- UUIDv7 generation may require a reviewed runtime dependency.
- Boolean archive state cannot answer when a record was archived.
- Hiding Campaigns beneath an archived World requires queries and UI navigation
  to consider parent archive state as well as Campaign archive state.
- Duplicate names may require secondary context in selection interfaces.
- Last-write-wins editing can lose changes made concurrently in multiple tabs.
- Unpaginated endpoints may need to change after real-world scale is known.

### Future implications

- Export and import formats should preserve UUID identity and explicitly handle
  collisions rather than matching by name.
- Permanent deletion behavior remains a later reference-safety decision;
  Milestone 1 must not introduce public delete operations.
- A future requirement for archive timestamps requires a schema and contract
  change or a separate activity record.
- If moving Campaigns between Worlds is introduced, it requires explicit
  product behavior and validation; it is not part of this decision.
- Game System modeling requires its own design review before adding fields or
  relationships.
- Optimistic concurrency and pagination should be introduced only in response
  to demonstrated multi-tab or data-volume needs.

## Validation

- Prisma migration and integration tests prove UUID storage, required Campaign
  ownership, archive defaults, and restricted parent deletion.
- API request tests prove Zod rejects invalid input and never exposes raw
  database errors.
- API tests prove active lists exclude archived records by default and explicit
  filters return archived or all records as requested.
- API tests prove archiving a World does not modify its Campaign rows and hides
  those Campaigns from normal active navigation.
- API tests prove duplicate World names and duplicate Campaign names are
  accepted.
- API tests prove deterministic case-insensitive name ordering with identifier
  tie-breaking.
- Frontend behavior tests prove the DM can create, edit, open, list, archive,
  and restore Worlds and Campaigns through the implemented slices.
- Real-use review checks whether unpaginated lists and last-write-wins editing
  remain adequate before later milestones depend on them.
