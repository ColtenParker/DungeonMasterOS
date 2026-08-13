# ADR-023: Encounter initiative and hit-point tracking

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Milestone 7 adds deliberately limited Encounter support so the DM can track
combatants, initiative, current HP, maximum HP, temporary HP, and free-form
notes during play. The product does not require dice rolling, automatic combat
resolution, defeat rules, or a general game-system rules engine.

Tracker commands occur frequently and should survive a reload independently of
the Encounter's explicitly saved rich document. Encounters also need identity,
links, search, archive behavior, preparation, and workspace navigation.

## Options Considered

### Encounter identity and lifecycle

#### Option A: Campaign-only Encounter Entry with prepared, active, and ended states

Advantages:

- Reuses universal Entry behavior and supports preparation before play.
- Makes the live tracker and final history explicit.
- Allows Encounters to be linked from multiple Sessions or Entries.

Disadvantages:

- Adds another Campaign-only Entry type and lifecycle.

#### Option B: One unnamed tracker owned by a Session

Advantages:

- Has a smaller content model.

Disadvantages:

- Prevents reusable preparation and several Encounters within a Session.

#### Option C: Browser-only tracker

Advantages:

- Requires no persistence model.

Disadvantages:

- Loses live state on reload and cannot support activity summaries.

### Combatant identity

#### Option A: Stable rows with a display name and optional NPC reference

Advantages:

- Supports player characters, unnamed creatures, and repeated NPC templates.
- Preserves a visible snapshot even if a linked NPC is later renamed.

Disadvantages:

- Display names and linked NPC titles can diverge intentionally.

#### Option B: Require an NPC Entry

Advantages:

- Gives every combatant canonical content identity.

Disadvantages:

- Forces temporary monsters and player characters into the NPC library.

#### Option C: Store names only

Advantages:

- Is simple and flexible.

Disadvantages:

- Provides no navigation to known NPCs.

### Initiative and turns

#### Option A: Integer initiative, manual ties, round, and current combatant

Advantages:

- Represents common initiative use without game-system automation.
- Persists explicit DM choices for ties and current turn.

Disadvantages:

- Systems using decimal initiative must adapt values manually.

#### Option B: Decimal initiative with automatic tie-breaking

Advantages:

- Can encode more ordering information in one value.

Disadvantages:

- Imposes automated tie rules absent from the product.

#### Option C: Drag order only

Advantages:

- Works for arbitrary initiative systems.

Disadvantages:

- Loses the initiative values the product asks to track.

### HP behavior

#### Option A: Optional integer fields with direct and delta controls

Advantages:

- Supports fast play while leaving interpretation to the DM.
- Avoids automatic damage, healing, temporary-HP, and defeat rules.

Disadvantages:

- Deliberately permits unusual states such as current HP above maximum HP.

#### Option B: Enforce common combat rules

Advantages:

- Automates temporary HP, healing caps, and defeat behavior.

Disadvantages:

- Becomes a game-system rules engine.

#### Option C: Current HP only

Advantages:

- Minimizes state.

Disadvantages:

- Omits requested maximum and temporary HP tracking.

### Tracker persistence

#### Option A: Immediate commands with optimistic UI and retry

Advantages:

- Minimizes loss during active play.
- Keeps tracker operations separate from rich-document drafts.

Disadvantages:

- Requires several narrow commands and partial-failure handling.

#### Option B: Explicit Save for the entire tracker

Advantages:

- Uses one aggregate write.

Disadvantages:

- Makes forgotten saves or reloads costly during combat.

#### Option C: Save only when ending the Encounter

Advantages:

- Minimizes writes.

Disadvantages:

- Risks losing the entire live Encounter.

## Decision

Add `ENCOUNTER` as a Campaign-only Entry type. Its rich document stores
preparation and free-form notes under the established explicit-Save behavior.
Relational tracker state is edited through immediate commands.

Persist Encounter lifecycle as `PREPARED`, `ACTIVE`, or `ENDED`, with nullable
UTC start and end timestamps. Enforce at most one active Encounter per Campaign.
An ended Encounter cannot restart. Starting an Encounter does not require an
active Session; when valid Session context is supplied, start and end produce
Session activity events. Ending a Session never ends an Encounter automatically.
Encounters are independent content referenced by Sessions rather than children
owned by them.

Represent each combatant with UUIDv7 identity, Encounter ownership, required
bounded editable display name, optional NPC Entry reference, initiative and HP
fields, tie order, and timestamps. The optional NPC must be visible to the
Encounter's Campaign. Duplicate references to the same NPC are allowed so one
definition can represent several combatants. The display name is the tracker
snapshot and does not automatically follow later NPC title changes.

Initiative is a nullable signed integer. Active ordering is descending
initiative followed by explicit user-controlled tie order and stable combatant
identity. Combatants without initiative remain in a predictable unrolled group
after rolled combatants. Persist a positive round number and nullable current
combatant identifier on the Encounter tracker. Starting turn tracking,
advancing, reversing, selecting another combatant, changing initiative, and
reordering ties are explicit commands. The application does not roll or break
ties automatically.

Current HP, maximum HP, and temporary HP are nullable nonnegative integers.
Provide direct edits and positive or negative delta controls. Do not
automatically consume temporary HP, cap healing, derive damage, change Entry or
combatant status, remove a combatant, or declare defeat at zero HP. Current HP
may exceed maximum HP when deliberately entered. Clearing a field restores its
unknown state rather than converting it to zero.

Combatant add, edit, remove, reorder, turn, round, lifecycle, and HP operations
persist immediately through narrow validated commands. The UI applies
optimistic state, shows saving and failure state, and retains a retryable desired
command or refresh path. Encounter document changes continue to use explicit
Entry Save and dirty-close protection.

Do not write Session activity for every tracker command. Encounter start is a
meaningful event. Encounter end records a final bounded structured summary,
including combatant display names and final initiative/HP values, when valid
Session context is present.

## Reasoning

An Encounter Entry supports preparation and navigation without making the
Session its lifecycle owner. Stable combatant rows balance temporary actors
with optional NPC navigation. Immediate command persistence protects high-rate
live state, while deliberately passive HP and initiative behavior respects the
product's non-goal of becoming a rules engine.

## Consequences

### Positive

- Prepared Encounters remain reusable and searchable Campaign content.
- Live tracker state survives reloads and individual command failures.
- Temporary and repeated combatants do not pollute the NPC library.
- Initiative and HP remain system-neutral manual tools.

### Negative / Tradeoffs

- Tracker and Entry document have different save policies.
- Optimistic immediate commands require visible error and reconciliation paths.
- No automated tie-breaking, damage resolution, or defeat behavior is provided.
- Only one Encounter may be active in a Campaign.

### Future implications

- Game-system-specific initiative or HP rules require a separate design.
- Conditions, effects, dice, and combat automation are not implied by this
  tracker.
- Export must preserve Encounter and combatant identity and optional NPC
  references.
- Permanent deletion must account for linked NPC and Session activity
  dependencies.

## Validation

- Database tests enforce Campaign-only scope, one active Encounter, combatant
  ownership, and current-combatant membership.
- lifecycle tests cover prepare, start, end, duplicate activation, and no
  automatic coupling to Sessions.
- ordering tests cover ties, null initiative, manual reordering, rounds, advance,
  reverse, and direct turn selection.
- HP tests cover direct, delta, null, zero, above-maximum, and no-side-effect
  behavior.
- failure tests prove optimistic commands expose retry or refresh without
  affecting document drafts.
- activity tests prove only start and final end summary are logged.

