# ADR-014: Workspace backgrounds and map markers

- Status: Accepted
- Date: 2026-08-12
- Decision owner: Human developer

## Context

The Campaign workspace established by ADR-009 and ADR-010 currently renders a
neutral base beneath persistent Entry windows. Milestone 5 lets the DM select a
reusable image or map for that base and place navigational markers on maps.
Activating a marker must use the existing duplicate-safe `openEntry(entryId)`
behavior and must not rearrange or reset the surrounding workspace.

World Media can be reused by Campaigns in that World, while Campaign Media is
isolated. Map references need similarly explicit ownership so a shared World map
can contain reusable setting landmarks without forcing one Campaign's private
markers into another Campaign. Coordinates must survive normal viewport changes
without expanding this milestone into VTT-style pan, zoom, grids, or tokens.

This decision defines the Media Library location, persisted background,
marker ownership and target rules, coordinate model, editing behavior, and
reference lifecycle.

## Options Considered

### Library placement

#### Option A: Dedicated Media Library plus workspace selector sidebar

Advantages:

- Keeps reusable Media management separate from one Campaign workspace.
- Lets a DM select a background without navigating away from active context.
- Fits the long-term base-layer and floating-window experience.

Disadvantages:

- Requires both a routed library surface and workspace selection chrome.

#### Option B: Workspace-only Media Library

Advantages:

- Keeps initial UI work on one surface.

Disadvantages:

- Makes World-level reuse and non-workspace management awkward.

#### Option C: Persist the Media Library as a floating utility window

Advantages:

- Closely resembles a desktop utility.

Disadvantages:

- Requires the generic utility-window lifecycle explicitly deferred by
  ADR-010.

### Background persistence

#### Option A: Nullable Media foreign key on CampaignWorkspace with a separate patch

Advantages:

- Gives the selected base layer relational integrity.
- Allows changing a background without replacing the Entry-window snapshot.
- Preserves the existing window aggregate and save queue.

Disadvantages:

- Adds a second workspace mutation path.

#### Option B: Add background to the existing full workspace snapshot

Advantages:

- Uses one workspace write endpoint.

Disadvantages:

- Window saves can accidentally overwrite a newer background selection.
- Couples two independently edited parts of the workspace.

#### Option C: Store the background in browser local storage

Advantages:

- Requires no schema change.

Disadvantages:

- Does not follow Campaign workspace persistence or future exports.

### Marker ownership

#### Option A: Layered World and Campaign marker scopes

Advantages:

- Supports reusable landmarks on World maps.
- Lets each Campaign add private navigation without redefining World content.
- Mirrors the product's World/Campaign content hierarchy.

Disadvantages:

- A Campaign view may combine two marker layers.
- Creation and editing must make scope explicit.

#### Option B: One global marker set per Media resource

Advantages:

- Is simpler to query and display.

Disadvantages:

- Campaign changes to a shared World map become visible to every Campaign.

#### Option C: Campaign-workspace markers only

Advantages:

- Avoids a World marker layer.

Disadvantages:

- Duplicates reusable landmarks in every Campaign.

### Coordinate and display model

#### Option A: Normalized coordinates on a contained image

Advantages:

- Marker positions scale with the rendered map.

- `object-fit: contain` preserves the complete map and its aspect ratio.
- Avoids committing to pan and zoom persistence.

Disadvantages:

- Letterboxing requires careful rendered-image bounds calculations.
- Very dense maps have limited precision at small viewport sizes.

#### Option B: Source-image pixel coordinates

Advantages:

- Coordinates correspond directly to the imported image dimensions.

Disadvantages:

- Rendering must transform pixels for every display size.
- Replacing or deriving a differently sized image complicates placement.

#### Option C: Add pan and zoom state now

Advantages:

- Provides deeper map navigation immediately.

Disadvantages:

- Adds transforms, persisted viewport state, and marker interaction conflicts
  beyond the milestone.

### Marker creation and editing

#### Option A: Explicit edit mode

Advantages:

- Prevents ordinary workspace clicks from accidentally creating markers.

- Separates marker placement from opening and manipulating Entry windows.

Disadvantages:

- Requires entering and exiting a distinct mode.

#### Option B: Clicking an unoccupied map location always creates a marker

Advantages:

- Makes creation fast.

Disadvantages:

- Conflicts with normal map interaction and creates accidental records.

#### Option C: Coordinate form only

Advantages:

- Is straightforward to validate.

Disadvantages:

- Is difficult to use without visual placement.

### Marker target visibility

#### Option A: Enforce scope at the server boundary

Advantages:

- Prevents invalid references regardless of client behavior.
- Preserves World reuse and Campaign isolation.
- Allows archived Entries to remain intentionally navigable.

Disadvantages:

- Requires contextual validation for every marker mutation.

#### Option B: Permit any Entry target

Advantages:

- Has minimal validation logic.

Disadvantages:

- Leaks unrelated World or Campaign content into the active context.

#### Option C: Permit only Campaign-owned targets

Advantages:

- Is easy to reason about for Campaign markers.

Disadvantages:

- Prevents maps from linking to inherited World Entries.

## Decision

Provide a dedicated routed Media Library for creating, browsing, filtering,
editing metadata, archiving, and reviewing Media. In the Campaign workspace,
provide a fixed or collapsible Media selector sidebar for choosing or clearing
the background without leaving the workspace. Do not make the library a
persisted floating utility window in Milestone 5.

Add a nullable `backgroundMediaId` foreign key to `CampaignWorkspace`. A
Campaign may select Campaign-owned Media or World-owned Media from its parent
World; unrelated Media is rejected. Both `IMAGE` and `MAP` resources may be
backgrounds, including archived Media that is already selected. Only `MAP`
resources host markers.

Use a separate contextual mutation, `PATCH
/api/campaigns/:campaignId/workspace/background`, whose validated body contains
`mediaId` as a UUID or `null`. Background updates do not include, replace, open,
close, focus, or rearrange Entry windows. The existing complete window snapshot
endpoint does not write the background field. Background changes use the
established visible saving, saved, failed, and retry expectations without
rolling back the visible selection silently.

Represent each map marker relationally with a UUIDv7 identifier, map Media
identifier, target Entry identifier, exactly one World or Campaign owner,
normalized `x` and `y` coordinates, optional short label, and timestamps. The
map and target relationships are deletion dependencies; marker labels do not
cache the Entry title.

Markers form two possible layers:

- a World marker belongs to the same World as a World-owned map and can target
  only an Entry owned by that World; and
- a Campaign marker belongs to the active Campaign, may be placed on Media
  owned by that Campaign or its parent World, and can target an Entry owned by
  that Campaign or its parent World.

A Campaign viewing a World map sees the map's World markers plus its own
Campaign-marker overlay. It never sees another Campaign's markers. A
Campaign-owned map has only its owning Campaign's markers. Marker creation,
update, and deletion use contextual Media marker endpoints and revalidate map,
owner, Campaign, and Entry relationships at the server boundary. Archived maps
and archived target Entries remain valid and navigable when explicitly shown;
archive never cascades to markers.

Store marker coordinates as decimal normalized values in the inclusive range
`0.0` through `1.0`, measured from the top-left of the actual rendered image:
`x` is a fraction of image width and `y` is a fraction of image height. Render
the complete background with preserved aspect ratio using contain behavior.
Calculate markers against the contained image bounds, excluding any letterbox
space. Keep sufficient database precision for stable round trips and reject
non-finite or out-of-range values.

Do not add persisted pan, zoom, crop, rotation, grid, fog, token, or viewport
state in Milestone 5. Switching or clearing a background changes only the base
layer and available marker overlay; it does not mutate the Entry-window
collection, geometry, focus order, or minimized state.

Normal workspace mode treats marker activation as navigation. Activating a
marker calls the existing shared `openEntry(entryId)` action, which opens or
restores and focuses exactly one window for the target Entry. Marker placement,
movement, relinking, and deletion are available only in an explicit map-marker
edit mode. Clicking the map in normal mode never creates a marker. Edit mode
must be visibly indicated and provide an explicit exit; ordinary window
dragging and resizing remain independent.

If the selected background representation is unavailable, retain
`backgroundMediaId`, render the neutral background, and show the warning defined
by ADR-013. Do not clear the reference automatically. Permanent Media deletion
is blocked while it is selected as any Campaign background or owns any marker.
The DM must clear those backgrounds and explicitly remove markers first.

## Reasoning

A dedicated library preserves Media as reusable content, while the workspace
sidebar maintains working context for the frequent act of selecting a base.
Keeping the background as a relational workspace field extends ADR-009 without
letting independent window snapshot saves overwrite it.

Layered marker ownership directly represents the World/Campaign distinction:
shared landmarks can remain reusable canon, while Campaign-specific navigation
stays isolated. Normalized coordinates and contained rendering provide stable
placement across viewport sizes without taking on VTT transforms. An explicit
edit mode protects ordinary play and preparation from accidental mutations.

## Consequences

### Positive

- A Campaign reopens with its selected background and unchanged windows.
- World maps can provide reusable markers plus private Campaign overlays.
- Markers scale with the rendered image and ignore letterbox space.
- Every marker uses the existing duplicate-safe Entry-opening behavior.
- Scope and archived-target behavior are enforced consistently by the server.
- Missing or archived Media does not silently erase workspace state.

### Negative / Tradeoffs

- Background state and window snapshots use separate persistence requests.
- World-map marker queries must combine World and active-Campaign layers.
- Contain rendering requires image-bound calculations for marker placement.
- Users must explicitly enter edit mode to add or modify markers.
- Pan, zoom, grids, tokens, and other VTT behaviors remain unavailable.

### Future implications

- A later utility-window design may make the Media Library float without
  changing its domain ownership.
- Pan and zoom require a separate persistence and interaction decision.
- Milestone 8 should test edit-mode clarity, keyboard marker operations,
  touch behavior, contrast, and marker density.
- Milestone 9 must export workspace background and marker references with their
  stable Media and Entry identities.
- A future promotion workflow must decide whether Campaign markers can become
  World markers; it cannot change ownership implicitly.

## Validation

- Database tests enforce Media, marker-owner, map-owner, and target-scope rules.
- API tests accept Campaign and parent-World backgrounds and reject unrelated
  Media.
- Workspace tests prove background patching cannot mutate window snapshots and
  window snapshot writes cannot overwrite the background.
- Rendering tests prove contained-image bounds and normalized coordinate
  transforms at multiple viewport aspect ratios.
- Layer tests prove a Campaign sees World markers plus only its own overlay.
- Archive tests prove selected archived Media and archived Entry targets remain
  valid.
- Interaction tests prove normal clicks do not create markers, edit mode can
  create and move them, and marker activation opens, restores, and focuses one
  Entry window.
- Deletion tests prove active backgrounds and owned markers block Media
  deletion with structured dependency details.
- Failure tests prove unavailable bytes retain the background reference and
  fall back to the neutral workspace without disturbing windows.

