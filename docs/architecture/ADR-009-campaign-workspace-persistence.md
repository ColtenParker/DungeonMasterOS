# ADR-009: Campaign workspace persistence

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 4 introduces one persistent visual workspace for each Campaign.
Opening, closing, focusing, dragging, resizing, minimizing, and restoring Entry
windows changes workspace state. That state must survive application restarts and
Session changes without becoming part of Entry documents or Session activity.

The application already uses PostgreSQL through Prisma, contextual REST APIs,
UUIDv7 identifiers, Zod validation at API boundaries, and last-write-wins updates
for its local single-user MVP. Campaign search and browsing include both
Campaign-owned Entries and inherited Entries owned by the Campaign's parent
World.

The persistence design must define the workspace aggregate, window identity,
geometry, duplicate prevention, Entry eligibility, restore behavior, API shape,
and write timing. Milestone 5, not this milestone, owns selected media and map
background persistence.

## Options Considered

### Workspace storage

#### Option A: Relational workspace and Entry-window records

Create one `CampaignWorkspace` for each Campaign and one
`WorkspaceEntryWindow` for each open Entry.

Advantages:

- Preserves database-level relationships to Campaigns and Entries.
- Can enforce one open window per Entry in a workspace.
- Keeps structured, behavior-driving workspace state queryable and validated.
- Provides a natural owner for later Campaign workspace settings.

Disadvantages:

- Requires a migration and multiple related records.
- A snapshot update touches several rows in one transaction.
- Future non-Entry window types require an explicit later design.

#### Option B: Versioned JSONB layout on Campaign

Advantages:

- Represents a heterogeneous layout flexibly.
- Can be read and replaced as one value.

Disadvantages:

- Cannot enforce Entry references or duplicate prevention with ordinary foreign
  keys and unique constraints.
- Makes stale Entry identifiers easier to retain.
- Places more validation and migration responsibility in application code.

#### Option C: Browser local storage

Advantages:

- Requires no database or API changes.

Disadvantages:

- Makes a browser profile the source of truth.
- Does not follow the application's PostgreSQL persistence model.
- Weakens future backup, export, and restoration behavior.

### Workspace lifecycle

#### Option A: Required workspace created with each Campaign

Advantages:

- Directly models the rule that every Campaign owns one workspace.
- Avoids absent-workspace branches in reads and writes.
- Lets Campaign creation and workspace creation succeed atomically.

Disadvantages:

- Existing Campaigns require migration backfill.
- Campaigns that are never opened still have an empty workspace row.

#### Option B: Lazy workspace creation

Advantages:

- Avoids rows for Campaigns whose workspace is never used.

Disadvantages:

- Every read or mutation must define absent-workspace behavior.
- A read may need to mutate state or return a synthetic resource.

### Persistence API

#### Option A: Transactional aggregate snapshots

Read the complete workspace and replace its complete window-state snapshot after
discrete interactions.

Advantages:

- Treats a layout as one understandable aggregate.
- Avoids partial application of related focus and window changes.
- Allows the client to serialize and coalesce saves reliably.
- Fits the expected small number of open windows in a local workspace.

Disadvantages:

- Revalidates and writes more than the one window that changed.
- Would require revisiting if layouts become exceptionally large or concurrent.

#### Option B: Per-window REST resources

Advantages:

- Writes only the affected window.
- Maps each client operation to a narrow request.

Disadvantages:

- Focus, close, and open operations can fail independently.
- Requires more ordering and partial-failure recovery logic.

#### Option C: Explicit Save Workspace command

Advantages:

- Makes persistence timing unambiguous.

Disadvantages:

- Makes accidental layout loss likely.
- Does not match the expected persistent-workspace interaction.

## Decision

Represent Campaign workspace state relationally.

Each Campaign has exactly one required `CampaignWorkspace`, created in the same
transaction as the Campaign. The Milestone 4 migration backfills one empty
workspace for every existing Campaign and then enforces a one-to-one Campaign
relationship.

An open Entry is represented by one `WorkspaceEntryWindow` containing:

- its workspace identifier;
- its Entry identifier;
- integer `x` and `y` coordinates relative to the usable workspace origin;
- positive integer `width` and `height`;
- an integer z-order value; and
- a persisted minimized flag.

The existence of the row means that the Entry window is open. Closing the
window removes that row. Do not add a separate open flag, cached Entry title,
Entry document snapshot, pinned flag, selected media identifier, or Session
identifier. Permanent Campaign and Entry deletion behavior remains governed by
the later reference-safe deletion milestone; Milestone 4 does not introduce a
new permanent-delete path.

Enforce a unique `(workspaceId, entryId)` constraint. A workspace may contain
an Entry owned by its Campaign or an Entry owned by that Campaign's parent
World. It must reject Entries from unrelated Worlds or Campaigns. Archive state
does not invalidate an explicitly opened or restored Entry window.

Store window geometry in pixels. The client bounds dragging and resizing to the
usable workspace and applies minimum dimensions. It renders stored geometry
clamped into the current viewport when necessary. A viewport-only clamp does
not overwrite a larger-screen layout until the user performs a window
interaction. New windows use a deterministic default size and cascade from the
most recently focused window with bounded offsets. Exact dimensions, offsets,
and z-order renormalization thresholds are tuneable implementation constants,
not persisted product policy.

Opening an Entry is idempotent at the product level. If the unique Entry window
already exists, restore it when minimized and bring it to front. Otherwise add
a new window. Focus assigns an order above all ordinary windows. The client may
renumber all window orders when values approach an implementation threshold;
their relative order is the persisted behavior that matters.

Expose a contextual REST workspace resource:

- `GET /api/campaigns/:campaignId/workspace` returns the persisted window
  descriptors; and
- `PUT /api/campaigns/:campaignId/workspace` validates and transactionally
  applies the complete desired window-state snapshot.

The workspace response does not embed complete Entry documents. After restore,
the client retrieves open Entries concurrently through the existing direct
Entry API and gives each window an independent loading or error state. A failed
Entry request must not make the entire workspace unusable or silently discard
the persisted window.

Persist after open, focus, minimize, restore, and close actions. During drag and
resize, update local display state continuously but persist only after the
interaction stops. Serialize saves, coalesce superseded snapshots, and retain
the newest unsaved snapshot for retry. Use optimistic local window behavior
with a visible saving, saved, or failed status. A failed save does not silently
roll back the visible layout.

Use the established last-write-wins policy. Do not add multi-user revisions,
merge logic, WebSockets, or Session activity events for workspace changes.

## Reasoning

Window state is structured because the application acts on every field. A
relational representation therefore follows the existing rule that structured
data should enable behavior while giving the database useful integrity
constraints. A required one-to-one workspace matches the product ownership
rule more directly than optional or browser-local state.

The workspace behaves as a small single-user aggregate. Transactional snapshot
writes make focus and window membership changes atomic and are easier to reason
about than a stream of partially ordered per-window requests. Saving only at
discrete boundaries prevents drag and resize from generating excessive writes.

Keeping Entry documents behind their existing endpoint preserves domain
boundaries and avoids creating a second representation of rich Entry content.
The API can be optimized later if real layouts demonstrate that concurrent
Entry retrieval is a bottleneck.

## Consequences

### Positive

- Campaign workspaces and their windows have clear database ownership.
- Duplicate Entry windows are prevented by both client behavior and a database
  constraint.
- Layout updates are atomic and survive application and Session restarts.
- Campaign and inherited World Entries follow established visibility rules.
- Milestone 5 can add background state without coupling it to window geometry.

### Negative / Tradeoffs

- Campaign creation and migration now include workspace records.
- Snapshot saves perform more relational work than narrow per-window patches.
- A restore may issue several concurrent Entry requests.
- Pixel layouts require viewport clamping on differently sized screens.
- A failed optimistic save requires visible retry behavior.

### Future implications

- Milestone 5 may add selected Media to `CampaignWorkspace` without changing
  Entry-window membership.
- Utility-window persistence requires a separate decision once concrete utility
  types and lifecycles exist.
- Milestone 9 must decide how workspace records participate in reference-safe
  permanent deletion and export/import.
- A future collaborative product would need revisions or conflict handling
  beyond last-write-wins snapshots.

## Validation

- Migration tests prove every existing and newly created Campaign has exactly
  one workspace.
- Store integration tests prove snapshot replacement is transactional.
- Constraint tests prove duplicate Entry windows cannot be persisted.
- Scope tests accept the Campaign and its parent World and reject unrelated
  Campaign and World Entries.
- Archive tests prove explicitly opened archived Entries remain restorable.
- API tests cover Zod validation, bounds, missing resources, invalid scope, and
  deterministic response shapes.
- Client tests prove persistence occurs after discrete actions and drag/resize
  completion rather than during pointer movement.
- Failure tests prove the latest snapshot remains retryable and a single Entry
  load failure does not destroy the workspace.

