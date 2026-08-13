# ADR-016: NPC structured sections

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

NPCs are standalone Entries that may move between Locations. Milestone 6 needs
useful NPC behavior without imposing a game-system stat model or moving prose
out of the rich document. The existing Media Library provides reusable images,
and the existing scope model allows Campaigns to see their parent World's
content.

## Options Considered

### Structured NPC data

#### Option A: Portrait, status, and current Location

Advantages:

- Enables visual identity, filtering, navigation, and movement.
- Leaves descriptive and system-specific material flexible.

Disadvantages:

- Stat blocks remain free-form.

#### Option B: Also structure a game-system-independent stat block

Advantages:

- Provides more fields immediately.

Disadvantages:

- Invents a generic rules model before Game System behavior is defined.

#### Option C: Keep NPCs entirely free-form

Advantages:

- Requires no specialized schema.

Disadvantages:

- Adds no useful NPC behavior in this milestone.

### Portrait storage

#### Option A: Nullable Media Library IMAGE reference

Advantages:

- Reuses processed Media representations and lifecycle rules.
- Avoids NPC-owned duplicate files.

Disadvantages:

- Requires a scope-aware Media selector.

#### Option B: NPC-owned upload

Advantages:

- Keeps upload near the NPC form.

Disadvantages:

- Duplicates Media ownership and processing behavior.

#### Option C: Arbitrary external URL

Advantages:

- Avoids local storage.

Disadvantages:

- Introduces remote availability and privacy behavior outside the product.

### Current Location

#### Option A: One optional mutable typed Location reference

Advantages:

- Represents where the NPC currently is without implying ownership.
- Supports direct navigation and future movement logging.

Disadvantages:

- Represents only one current Location.

#### Option B: Require identical Entry scope

Advantages:

- Simplifies validation.

Disadvantages:

- Prevents Campaign NPCs from using inherited World Locations.

#### Option C: Use an ordinary generic relationship

Advantages:

- Requires no new relation.

Disadvantages:

- Cannot distinguish current location from other related Locations.

## Decision

Give NPC Entries optional portrait, status, and current-location sections. The
Entry title remains the NPC's name. Description, notes, personality, secrets,
dialogue, and stat blocks remain in the rich document. Inventory is introduced
by the later Inventory slice rather than the initial NPC slice.

The portrait is a nullable reference to Media classified as `IMAGE`. A
World-scoped NPC may select an image from its World. A Campaign-scoped NPC may
select an image from its Campaign or parent World. Archived images may remain
referenced and visible when explicitly accessed; an unavailable representation
uses the existing Media fallback without silently clearing the reference.

Current location is one nullable, mutable reference to an Entry whose type is
`LOCATION`. A World NPC may reference a Location in the same World. A Campaign
NPC may reference a Location in its Campaign or parent World. Changing or
clearing current location does not modify either Entry's scope, hierarchy,
generic relationships, or ownership.

Status follows ADR-015's type-specific bounded-text policy and changes only the
NPC's fictional state.

## Reasoning

These three fields enable concrete behavior without attempting to normalize
DM-authored description or game-system rules. A typed Location reference states
the specific meaning that a generic relationship cannot express, while the
visibility rule preserves Campaign reuse of World canon.

## Consequences

### Positive

- NPCs gain image presentation, status filtering, and current-location
  navigation.
- NPC movement is a reference update, not an ownership change.
- Rich prose and arbitrary stat blocks remain available.

### Negative / Tradeoffs

- Only one current Location can be represented.
- Media and Location selectors require contextual visibility checks.
- Structured stat-block behavior remains unavailable.

### Future implications

- Milestone 7 may log current-location changes without changing this ownership
  model.
- A Game System ADR may later add stat-block behavior.
- Permanent deletion of referenced Media or Locations must report the NPC
  dependency.

## Validation

- API tests reject non-image portraits and non-Location current targets.
- integration tests enforce World and Campaign visibility rules.
- editor tests cover adding, editing, clearing, and removing each NPC section.
- backlink tests expose current-location references without generic duplicates.

