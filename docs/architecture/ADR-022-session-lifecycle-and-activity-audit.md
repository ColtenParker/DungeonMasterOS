# ADR-022: Session lifecycle and activity audit

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Milestone 7 must let the DM prepare and explicitly run a Session while recording
meaningful persistent Campaign changes until that Session ends. The log is an
audit trail rather than an automatically generated narrative recap. Searches,
window movement, resizing, focus, minimization, workspace backgrounds, and
other trivial UI activity must never become Session history.

Sessions need Entry behavior such as rich notes, tags, links, archive state,
search, and workspace windows, but their start/end lifecycle and immutable
activity history require relational state. Mutations currently span several
stores and some Campaign-context changes may target inherited World Entries, so
attribution cannot be inferred safely from the mutated record's ownership.

## Options Considered

### Session identity and metadata

#### Option A: Campaign-only Session Entry with minimal structured metadata

Advantages:

- Reuses universal Entry identity, notes, navigation, and archive behavior.
- Keeps preparation prose in the rich document.
- Provides useful session number and real-world date behavior without adding a
  larger planning schema.

Disadvantages:

- Requires enforcing that Session Entries cannot use World scope.

#### Option B: Permit reusable World Sessions

Advantages:

- Allows a Session template to live at World scope.

Disadvantages:

- Confuses a played Campaign event with reusable World canon.

#### Option C: Separate non-Entry Session resource

Advantages:

- Keeps lifecycle fields in a dedicated aggregate.

Disadvantages:

- Duplicates Entry notes, links, search, archive, and workspace behavior.

### Session lifecycle

#### Option A: Planned, active, and ended with one active Session per Campaign

Advantages:

- Gives start and end explicit persisted meaning across restarts.
- Prevents ambiguous concurrent activity attribution.
- Preserves ended history as final.

Disadvantages:

- An incorrectly ended Session requires a new Session rather than reopening
  history.

#### Option B: Derive lifecycle only from timestamps

Advantages:

- Stores fewer fields.

Disadvantages:

- Makes allowed transitions and validation less explicit.

#### Option C: Permit several active Sessions

Advantages:

- Supports parallel tables.

Disadvantages:

- Makes ordinary mutation attribution ambiguous in this single-user product.

### Mutation attribution

#### Option A: Validated optional Session context on mutation commands

Advantages:

- Correctly attributes Campaign-context edits to Campaign or inherited World
  content.
- Allows mutations outside a running Session to remain intentionally unlogged.
- Can write the event transactionally with its mutation.

Disadvantages:

- Mutation APIs and store commands must carry additional context.
- A stale active-Session context becomes a conflict the client must handle.

#### Option B: Infer the Campaign's current active Session automatically

Advantages:

- Requires less client context.

Disadvantages:

- Cannot reliably infer Campaign context for direct or World-owned mutations.

#### Option C: Database triggers

Advantages:

- Observes writes regardless of application code path.

Disadvantages:

- Lacks semantic command context and duplicates domain diff logic in SQL.

### Event granularity and catalog

#### Option A: Semantic events for meaningful committed change categories

Advantages:

- Produces an understandable audit trail without per-field or per-keystroke
  noise.
- Allows one atomic command to record several meaningful categories.

Disadvantages:

- Stores must compute semantic before/after differences.

#### Option B: One event for each API request

Advantages:

- Is straightforward to implement.

Disadvantages:

- Conflates unrelated changes in an aggregate Save.

#### Option C: One event for every field and child row

Advantages:

- Captures very fine detail.

Disadvantages:

- Produces a noisy, implementation-shaped log.

### Activity representation

#### Option A: Immutable versioned event records with bounded structured data

Advantages:

- Retains queryable before/after values and subject snapshots.
- Avoids copying complete rich documents into the audit trail.
- Supports future event-version readers.

Disadvantages:

- Event payload schemas require explicit versioning and serializers.

#### Option B: Complete before/after aggregate snapshots

Advantages:

- Preserves maximum historical detail.

Disadvantages:

- Creates an expensive second document-versioning system.

#### Option C: Human-readable summary strings only

Advantages:

- Is simple to render.

Disadvantages:

- Loses reliable structured review and future migration capability.

### Activity review

#### Option A: Cursor-paginated chronological history with type filters

Advantages:

- Remains bounded as long-running Sessions accumulate activity.
- Supports both Session Entry review and a live utility surface.

Disadvantages:

- Introduces the repository's first cursor-pagination contract.

#### Option B: Unpaginated complete history

Advantages:

- Has a simpler initial API.

Disadvantages:

- Grows without a response-size bound.

#### Option C: Generated narrative recap

Advantages:

- Produces readable prose.

Disadvantages:

- Conflicts with the product's audit-trail requirement.

## Decision

Add `SESSION` as a Campaign-only Entry type. The Entry title is the Session
name. Its rich document contains preparation, notes, and any manually authored
recap. Add optional structured Session number and optional real-world date. The
number is a nonnegative integer and is not unique. The real-world date is a
date-only value with no time-of-day or timezone conversion.

Persist Session lifecycle as `PLANNED`, `ACTIVE`, or `ENDED`, together with
nullable UTC start and end timestamps. Starting changes a planned Session to
active. Ending changes the active Session to ended. Enforce at most one active
Session per Campaign with a database-supported invariant. An ended Session
cannot restart, and starting a new Session never ends another automatically.
The active Session must be explicitly ended first. An active Session cannot be
archived. Ending a Session does not reset the Campaign workspace or end an
active Encounter. Session notes remain editable after ending, but later edits
do not alter the ended activity history.

Meaningful mutation requests may carry an optional context containing the
active Session identifier and Campaign identifier. When supplied, the server
must verify that the Session is active in that Campaign. Missing, ended,
unrelated, or stale context returns a lifecycle conflict rather than silently
writing an unattributed mutation. Omitting context means the mutation is
intentionally outside Session activity. This context is not accepted for
workspace layout, background, map-marker, search, or other excluded UI and
organizational commands.

Write activity events in the same PostgreSQL transaction as their domain
mutation. A mutation cannot commit without its required event, and an event
cannot survive a rolled-back mutation. Shared audit helpers may be injected
into stores, but audit ownership stays at semantic command boundaries rather
than Prisma middleware or database triggers.

Record one event for each meaningful change category within a committed
command. The approved catalog is:

- Entry created;
- Entry title, rich document, or optional-section layout changed;
- status changed;
- NPC current Location changed;
- Quest objectives changed;
- Inventory changed;
- Location hierarchy changed;
- Faction leadership changed;
- Entry archived or restored;
- relationship added or removed;
- reminder created, rescheduled, completed, or dismissed;
- Campaign calendar advanced or corrected; and
- Encounter started or ended.

Do not log tag assignments, Media imports or metadata, map markers, Campaign or
World metadata, searches, Quick Open, workspace geometry, focus, z-order,
minimization, backgrounds, or other UI activity. Do not log every initiative
turn or HP adjustment. Encounter end records one final structured summary in
the Session log when valid Session context exists.

Activity events are append-only immutable records with UUIDv7 identity,
Session and Campaign identifiers, UTC occurrence time, event type, schema
version, optional subject Entry identifier, bounded subject title/type snapshot,
and a versioned structured payload containing only values relevant to the
event. Entry-content events record that title, document, or layout changed and
may include bounded title before/after values, but never copy complete rich
documents. Normal APIs cannot edit or delete activity events.

Expose stable chronological cursor pagination, with a deterministic identifier
tie-breaker and optional event-type filtering. The same history may be rendered
inside a Session Entry and a live Session Activity utility. It remains an audit
view and does not generate prose automatically.

## Reasoning

Session as an Entry preserves the application's universal content model while a
small relational extension gives active play an explicit lifecycle. Command
context is necessary because Entry ownership alone cannot identify the Campaign
in which a World Entry was edited. Transactional semantic events provide useful
history without recording implementation details or creating a second copy of
every document.

## Consequences

### Positive

- Session preparation and immutable played history remain connected without
  being conflated.
- Restarting the application cannot lose active Session identity.
- Inherited World content can be attributed to the correct Campaign Session.
- Audit entries and their mutations commit atomically.
- Long Session histories remain bounded and reviewable.

### Negative / Tradeoffs

- Several mutation stores must accept context and calculate semantic diffs.
- A stale Session in the client requires visible conflict recovery.
- Ended Sessions cannot be reopened to repair lifecycle mistakes.
- Complete historical document contents are not recoverable from the activity
  log.

### Future implications

- Export and import must preserve event identity, ordering, versions, and
  subject references.
- A future narrative recap must be explicitly authored or derived as a separate
  feature, never substituted for the audit records.
- New meaningful mutation categories require an explicit audit policy.
- Multi-user attribution would require actor identity beyond this DM-only MVP.

## Validation

- Database tests enforce Campaign-only Session scope and one active Session per
  Campaign.
- Lifecycle tests cover start, end, duplicate start, archive conflicts, and
  rejection of restart or stale context.
- transaction tests prove events and mutations commit or roll back together.
- diff tests prove one aggregate Save creates only its applicable semantic
  categories.
- exclusion tests prove UI, workspace, tags, Media, and marker activity never
  create events.
- pagination tests prove stable chronological traversal without duplicates or
  omissions.
