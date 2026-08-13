# ADR-024: Campaign workspace utility windows

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Milestone 7 introduces live tools that must remain available beside Entry
windows while the DM runs a Campaign: initiative, the Campaign calendar, and
Session activity. The product requires utility windows above the persistent
workspace base layer, and existing workspace state already persists window
geometry, minimization, and stacking across Sessions.

These tools own immediately persisted domain state rather than Entry-document
drafts. Their window layout is workspace presentation state and must not become
Session activity.

## Options Considered

### Option A: Typed persistent utility windows in the Campaign workspace

Advantages:

- Gives live tools the same floating, persistent interaction model as Entries.
- Allows one durable position and size per utility type.
- Keeps tool state separate from window-layout state.

Disadvantages:

- Requires the workspace aggregate to coordinate two window kinds in one
  focus and stacking order.
- Adds typed utility commands and persistence.

### Option B: Fixed sidebars or modal dialogs

Advantages:

- Requires less workspace-window infrastructure.

Disadvantages:

- Conflicts with the product's map-centered floating-window experience.
- Prevents the DM from arranging several live tools beside campaign content.

### Option C: Represent utilities as synthetic Entries

Advantages:

- Reuses the existing Entry-window model directly.

Disadvantages:

- Pollutes content navigation and search with non-content records.
- Conflates immediately persisted tool state with explicitly saved documents.

## Decision

Extend each Campaign workspace with typed utility windows for exactly these
Milestone 7 utility types:

- Initiative;
- Calendar; and
- Session Activity.

Persist at most one open window of each utility type per workspace. A utility
window has stable identity plus position, dimensions, z-order, and minimized
state. Opening an already-open utility restores or focuses that same window;
it never creates a duplicate. Closing removes the open-window record but does
not reset the utility's domain state. Reopening uses deterministic default
geometry unless a later, separately approved preference feature retains closed
geometry.

Entry windows and utility windows share one logical focus and z-order domain.
The workspace snapshot returns both typed collections, and bring-to-front
behavior compares and updates their z-order together. Implementations may
renormalize the combined ordering transactionally to keep values bounded.

Utility windows support open, close, drag, resize, minimize, restore, and bring
to front under the same bounds and accessibility expectations as Entry
windows. Optional pinning remains deferred. A Session transition, Encounter
transition, or map/background change does not open, close, move, or reset any
utility window automatically.

Window records contain presentation state only. Initiative state belongs to
the active Encounter, calendar and reminder state belongs to the Campaign, and
Session activity belongs to immutable audit events. Since those tool commands
persist immediately, utility windows have no unsaved-draft close prompt.
Closing a window does not end a Session or Encounter and does not alter calendar
or reminder state.

Workspace utility operations never create Session activity events. They follow
the workspace's existing latest-write-wins layout policy and do not inherit the
Entry document's optimistic-concurrency or dirty-close behavior.

## Reasoning

Typed utility windows preserve the intended Foundry-like workspace experience
without pretending operational tools are content Entries. A shared stacking
domain makes mixed Entry and utility windows behave like one desktop, while
separating window state from tool state prevents layout operations from
changing campaign data.

## Consequences

### Positive

- Live Session tools can be arranged and revisited alongside Entry content.
- Reloading preserves open utility layout without coupling it to a Session.
- Utility domain state remains usable even when its window is closed.
- Search and content navigation remain free of synthetic utility Entries.

### Negative / Tradeoffs

- Workspace reads and focus commands must coordinate two persisted window
  collections.
- Cross-kind z-order consistency needs transactional handling.
- Closed-window geometry is not retained in Milestone 7.

### Future implications

- New utility types require an explicit type addition and a review of whether
  more than one instance is meaningful.
- Pinning and user-defined utility layouts remain separate design decisions.
- Multi-monitor or detachable native windows are not implied.

## Validation

- Persistence tests prove no workspace can open two windows of one utility
  type.
- Workspace tests prove Entry and utility windows share focus and z-order.
- Command tests cover open, repeated open, close, drag, resize, minimize,
  restore, and bring to front.
- Reload tests prove open utility layout persists across Sessions and map
  changes.
- Boundary tests prove closing a utility does not mutate Session, Encounter,
  calendar, reminder, or Entry state.
- activity tests prove utility layout commands never create Session events.
