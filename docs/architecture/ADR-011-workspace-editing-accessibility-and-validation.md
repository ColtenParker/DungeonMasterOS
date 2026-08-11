# ADR-011: Workspace editing, accessibility, and validation

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 4 places an independent `EntryEditor` inside every open workspace
window. Entry documents continue to use explicit Save, so a window may contain
changes that are not yet persisted when the user closes it, leaves the Campaign,
or reloads the browser. The existing editor owns its draft internally and does
not report dirty state to its parent.

Floating windows also introduce interaction behavior that jsdom does not model
faithfully. Dragging, resizing, viewport bounds, focus order, and restoration
need browser evidence in addition to reducer, component, API, and PostgreSQL
tests. Basic controls must remain operable and understandable without deferring
all accessibility structure to the later UX milestone.

This ADR defines the dirty-edit lifecycle, the Milestone 4 accessibility
boundary, and the test strategy. It does not change the explicit-save or
last-write-wins content decisions in ADR-005.

## Options Considered

### Closing a dirty Entry window

#### Option A: Save, Discard, or Cancel

Advantages:

- Prevents silent data loss while preserving an intentional discard path.
- Lets a successful Save complete the requested close operation.
- Applies the same understandable choice to each Entry window.

Disadvantages:

- Requires dirty-state reporting and coordinated asynchronous Save behavior.
- Navigation with several dirty windows needs careful blocking behavior.

#### Option B: Refuse to close until separately saved

Advantages:

- Avoids accidental loss and simplifies the close operation.

Disadvantages:

- Provides no efficient intentional-discard path.
- Forces users back into the editor before closing.

#### Option C: Close and silently discard

Advantages:

- Requires no additional editor coordination.

Disadvantages:

- Can destroy substantial unsaved notes without warning.

### Accessibility scope

#### Option A: Accessible controls now; keyboard geometry later

Advantages:

- Establishes semantic window structure and keyboard-operable lifecycle
  controls immediately.
- Keeps the required drag and resize work within Milestone 4.
- Gives Milestone 8 a clear, documented keyboard-geometry follow-up.

Disadvantages:

- Users cannot yet reposition or resize windows solely with the keyboard.

#### Option B: Full keyboard movement and resizing now

Advantages:

- Makes all window geometry operable without a pointer.

Disadvantages:

- Requires a custom interaction mode beyond the selected drag dependency.
- Expands the milestone before broader accessibility testing and UX refinement.

#### Option C: Defer all accessibility work

Advantages:

- Minimizes immediate implementation.

Disadvantages:

- Creates avoidable structural rework.
- Leaves ordinary window lifecycle controls inaccessible.

### Test strategy

#### Option A: Layered tests plus targeted Playwright coverage

Advantages:

- Tests state transitions and persistence near their implementation layers.
- Verifies real pointer geometry, focus, reload, and viewport behavior in a
  browser.
- Keeps the browser suite small and focused on behavior jsdom cannot prove.

Disadvantages:

- Adds Playwright and a managed browser installation.
- Browser tests take longer and require more environment setup.

#### Option B: Vitest, jsdom, and API tests only

Advantages:

- Uses the existing fast test stack.

Disadvantages:

- Requires drag and resize callbacks to be mocked.
- Cannot prove real layout geometry or browser reload behavior.

#### Option C: Primarily end-to-end browser tests

Advantages:

- Exercises complete user workflows.

Disadvantages:

- Is slower and less precise when diagnosing reducer, API, or database failures.

## Decision

Preserve explicit Save for Entry documents. Extend `EntryEditor` with an
explicit parent-facing dirty-state contract based on whether the current title
or document differs from the last successfully loaded or saved Entry. Workspace
geometry changes do not make an Entry document dirty.

When a user closes a dirty Entry window, present Save, Discard, and Cancel:

- Save validates and persists the Entry, and closes the window only after Save
  succeeds;
- Discard closes the window without writing the draft; and
- Cancel returns to the unchanged open window.

If Save fails, keep the window open, retain the draft, and show the existing
error behavior. Minimize, restore, drag, resize, and focus never discard an Entry
draft.

Internal navigation away from a workspace with dirty windows must be blocked
until those drafts are saved, explicitly discarded, or navigation is canceled.
A browser reload or tab close uses the browser's native unsaved-changes warning.
Do not promise draft recovery after an intentional discard or confirmed browser
unload in Milestone 4.

Provide baseline accessible window structure in Milestone 4:

- every window has an identifiable semantic title;
- close and minimize controls have accessible names;
- minimized dock controls identify their Entries;
- opening or restoring a window moves focus into an appropriate window target;
- focus and keyboard activation do not require dragging; and
- Quick Open and all Entry-opening actions remain keyboard operable.

Pointer dragging and resizing satisfy the Milestone 4 geometry requirement.
Keyboard movement and resizing are explicitly deferred to the Milestone 8
accessibility review rather than treated as complete or forgotten.

Use a layered validation strategy:

- pure unit tests for geometry helpers and workspace reducer transitions;
- React Testing Library and Vitest tests for window lifecycle, dirty prompts,
  focus intent, Quick Open, links, relationships, and backlinks;
- API contract tests for request validation and error mapping;
- PostgreSQL integration tests for relational ownership, scope rules,
  uniqueness, transactional snapshots, and restoration; and
- a small Playwright suite for real drag, resize, minimize/restore, duplicate
  open, focus order, viewport bounds, dirty-close behavior, reload, and persisted
  restoration.

Playwright is a web development dependency used only for browser validation. Its
configuration and browser-install instructions must be runnable from repository
scripts and documented with the other validation commands. Do not replace
focused unit and integration tests with browser-only coverage.

## Reasoning

Explicit Save is only safe in a windowed interface if closing a container cannot
silently discard the editor it owns. A three-way decision preserves user intent
without converting document editing to autosave. Reporting dirty state upward
is a narrow contract and does not move rich-text draft ownership into global or
workspace state.

Semantic title bars and lifecycle controls are inexpensive to establish while
the window structure is new. Full keyboard geometry is valuable but requires a
separate interaction design; documenting its Milestone 8 ownership avoids
claiming broader accessibility than Milestone 4 delivers.

Browser geometry cannot be validated meaningfully through jsdom alone.
Playwright provides evidence for the defining interaction while the faster test
layers continue to verify state and persistence precisely.

## Consequences

### Positive

- Closing or leaving cannot silently destroy an Entry draft.
- Failed saves retain both the window and its unsaved content.
- Window lifecycle controls have an accessible structure from their first
  implementation.
- Actual browser drag, resize, focus, and reload behavior is tested.
- Failures remain diagnosable through focused unit and integration tests.

### Negative / Tradeoffs

- `EntryEditor` gains dirty-state and close-coordination responsibilities.
- Navigation blocking is more complex with several dirty windows.
- The repository gains Playwright configuration and browser installation cost.
- Keyboard-only movement and resizing remain incomplete until Milestone 8.
- Intentional discard and confirmed unload do not recover drafts.

### Future implications

- Autosave or draft recovery requires a separate decision and must not bypass
  this explicit-save policy implicitly.
- Milestone 8 must evaluate keyboard geometry, focus trapping or movement,
  screen-reader announcements, contrast, reduced motion, and window ergonomics.
- Browser tests should remain focused on high-value geometry and persistence
  workflows rather than duplicating every component test.
- Future utility windows must define whether they can become dirty and how their
  close behavior fits the same lifecycle.

## Validation

- Editor tests prove dirty state begins on title or document changes and resets
  only after load, successful Save, or explicit discard.
- Close tests prove Save, Discard, Cancel, and failed-Save behavior.
- Navigation tests prove dirty windows block internal exit and browser unload.
- Accessibility tests prove names, roles, keyboard activation, dock behavior,
  and focus intent.
- Playwright tests manipulate real windows and verify geometry after reload.
- PostgreSQL-backed browser tests prove a Campaign reopens with its last
  successfully persisted workspace snapshot.
- All documented repository validation commands run from a clean checkout.

