# ADR-010: Campaign workspace client architecture

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 4 changes Entry navigation from replacing one inline editor to opening
or focusing multiple floating windows without leaving the active Campaign.
Quick Open, category results, inline Entry links, relationships, and backlinks
must share that behavior.

The current React client conditionally renders World and Campaign management in
one `App` component and stores one selected Entry in `EntryManager`. ADR-005 and
ADR-008 intentionally deferred routing and broader client-state choices until
the Campaign workspace milestone. The product's long-term direction resembles
a focused desktop workspace: a base layer with independent windows above it.

The client design must select a navigation boundary, window interaction
approach, state owner, minimize behavior, and Milestone 4 boundary for pinning,
utility windows, and media backgrounds.

## Options Considered

### Navigation boundary

#### Option A: Dedicated Campaign workspace route

Use declarative browser routing for a full Campaign workspace view.

Advantages:

- Gives the library and active workspace clear responsibilities.
- Allows refresh and direct navigation to restore the selected Campaign.
- Keeps Entry navigation inside the workspace rather than replacing the page.
- Resolves the routing question at the milestone where distinct application
  surfaces exist.

Disadvantages:

- Adds a routing dependency and route-level loading/error states.
- Requires development and future production hosts to serve the SPA fallback.

#### Option B: Conditional state in `App`

Advantages:

- Adds no routing dependency.
- Requires less initial restructuring.

Disadvantages:

- Refresh loses the active Campaign location.
- Continues enlarging one component with two distinct experiences.

#### Option C: Workspace embedded in the current editor column

Advantages:

- Minimizes immediate layout changes.

Disadvantages:

- Constrains the defining workspace to a small dashboard region.
- Does not establish the intended base-layer and floating-window experience.

### Drag and resize interaction

#### Option A: `react-rnd` with application-owned window behavior

Use controlled `react-rnd` instances for free-form dragging and resizing while
the application owns window chrome, focus, minimize, persistence, and content.

Advantages:

- Supplies established pointer, touch, resize-handle, and boundary mechanics.
- Supports controlled pixel position and size.
- Exposes stop callbacks aligned with the persistence policy.
- Does not impose a desktop, docking, or grid state model.

Disadvantages:

- Adds a focused third-party dependency.
- Keyboard geometry and higher-level window behavior remain application work.
- Dependency compatibility must be verified during upgrades.

#### Option B: Responsive grid layout library

Advantages:

- Provides responsive breakpoints and layout algorithms.
- Can support overlap with configuration.

Disadvantages:

- Grid, compaction, and breakpoint concepts do not naturally match free-form
  desktop windows.
- Adds behavior the product does not require.

#### Option C: Custom Pointer Events implementation

Advantages:

- Gives complete control with no interaction dependency.

Disadvantages:

- Requires substantial work for pointer capture, touch behavior, transforms,
  bounds, resize handles, and browser edge cases.

### Client state ownership

#### Option A: Workspace-scoped reducer and React context

Advantages:

- Centralizes open, focus, layout, and persistence transitions.
- Avoids prop drilling from every Entry-opening surface.
- Keeps workspace state scoped to the active Campaign.
- Does not introduce a repository-wide global store.

Disadvantages:

- Requires explicit reducer actions and effect boundaries.
- Components must observe context boundaries carefully.

#### Option B: Global state library

Advantages:

- Makes workspace actions available anywhere in the client.
- Provides selectors and external-store tooling.

Disadvantages:

- Adds application-wide state machinery for state owned by one routed surface.
- Creates another dependency before broader global-state needs exist.

#### Option C: Lift state into `App`

Advantages:

- Uses only existing React primitives.

Disadvantages:

- Produces extensive prop drilling.
- Makes the existing root component responsible for interaction-level window
  transitions.

### Minimize, pinning, and workspace contents

#### Option A: Minimized dock, deferred pinning, and Entry windows only

Advantages:

- Gives minimized windows a clear and recoverable location.
- Meets the required Milestone 4 window lifecycle.
- Avoids designing pinned layers and unspecified utility persistence early.
- Preserves Milestone 5 ownership of selected media.

Disadvantages:

- Optional always-on-top pinning is unavailable initially.
- Category browsing remains fixed or transient rather than a floating utility.

#### Option B: Collapse minimized windows in place

Advantages:

- Requires no separate minimized-window dock.

Disadvantages:

- Leaves collapsed windows scattered over the workspace.
- Does not behave like a conventional minimized window.

#### Option C: Implement pinning and generic utility windows now

Advantages:

- Produces a more complete desktop metaphor immediately.

Disadvantages:

- Requires pinned z-order and generic utility lifecycle rules without concrete
  Milestone 4 requirements.
- Risks constraining later Media and utility designs prematurely.

## Decision

Introduce a dedicated Campaign workspace route using React Router's declarative
browser mode. The canonical active workspace path is
`/campaigns/:campaignId/workspace`. The library remains a separate application
surface with an explicit action that enters a Campaign and an explicit action
that returns from the workspace. Route loading must retrieve the Campaign by
identifier so a refresh does not depend on prior in-memory selection.

Do not adopt React Router loaders/actions, framework mode, or a routing-owned
data layer. Continue using the existing typed API client and React loading/error
state. The host must support an SPA fallback for workspace URLs.

Create a Campaign-scoped workspace provider using a reducer and React context.
The reducer owns:

- hydrated window descriptors;
- local geometry and minimize state;
- focus and z-order transitions;
- open-or-focus behavior;
- per-window Entry loading state; and
- workspace persistence status and retry actions.

Do not add Redux, Zustand, or another global state library. Entry document
editing remains local to each `EntryEditor`; workspace context owns window state,
not canonical Entry document state.

Use controlled `react-rnd` components for each visible Entry window. Restrict
drag initiation to the title bar, exclude interactive title-bar controls, apply
workspace bounds and minimum sizes, update local geometry during interaction,
and dispatch persistence only from drag-stop and resize-stop boundaries. Window
focus is activated by interacting with the window, its title bar, or an
open-or-focus action.

Replace the current single-selection destination with one shared workspace
`openEntry(entryId)` action. Category browsing, Quick Open, inline Entry links,
relationship targets, and backlinks call this action. Opening an existing
window restores it when minimized and brings it to front; it never mounts a
second editor for the same Entry.

Render minimized windows in a persistent dock at the bottom of the workspace.
The dock identifies each minimized Entry and restores and focuses it when
activated. Closing removes the window from both the visible workspace and the
dock.

Use a neutral CSS background in Milestone 4. Category browsing may use fixed or
collapsible workspace chrome, and Quick Open remains a transient keyboard
picker. Persist only Entry windows. Do not add generic utility-window records,
selected Media, map behavior, or an arbitrary background URL. Milestone 5 may
replace the neutral base without opening, closing, or rearranging Entry windows.

Do not implement pinning in Milestone 4. Record it as an optional interaction
deferred until a real always-on-top use case establishes pinned focus behavior.

## Reasoning

The Campaign workspace is now a distinct application surface whose identity is
meaningful across refreshes. Declarative routing supplies that identity while
leaving the established API layer intact. A scoped reducer and context create a
single understandable state machine for all Entry-opening paths without
premature global state.

`react-rnd` handles the browser mechanics that are expensive to reproduce while
leaving product behavior under application control. This is a closer fit than a
grid or docking system because Entry windows may overlap and retain arbitrary
pixel positions.

The minimized dock gives users a predictable restore mechanism. Deferring
pinning, generic utility windows, and media backgrounds keeps Milestone 4
focused and prevents its persistence model from guessing at later requirements.

## Consequences

### Positive

- Refreshing a Campaign workspace retains both Campaign identity and persisted
  layout.
- Every Entry-opening surface shares one duplicate-safe action.
- Window state has a clear Campaign-scoped owner.
- Drag and resize behavior uses a focused dependency without adopting a full
  desktop framework.
- The neutral shell can accept Milestone 5 media without changing window state.

### Negative / Tradeoffs

- The web package gains React Router and `react-rnd` dependencies.
- The application host must serve routed SPA paths correctly.
- Controlled windows require careful render and persistence performance.
- Pinning and persisted utility windows remain unavailable.
- React context and reducer actions add explicit state-management code.

### Future implications

- Milestone 5 supplies active Media or maps beneath the same window layer.
- A concrete utility may later justify a generic or separate persisted window
  model.
- Pinning requires an explicit decision about pinned layers and focus ordering.
- A global client store should be reconsidered only if state genuinely spans
  multiple routed application surfaces.
- Dependency upgrades must retain compatibility with the repository's React
  version and interaction tests.

## Validation

- Route tests prove direct navigation and refresh load the identified Campaign.
- Reducer tests cover open, duplicate open, focus, minimize, restore, close,
  geometry changes, save status, and retry transitions.
- Component tests prove every existing Entry-opening surface dispatches the
  shared open-or-focus action.
- Interaction tests prove title-bar controls do not accidentally begin dragging.
- Restore tests prove multiple windows mount independently and preserve focus
  order.
- Scope tests prove switching maps in the later milestone cannot mutate the
  window collection or geometry.
- Dependency versions and production builds are verified before Milestone 4 is
  accepted.

