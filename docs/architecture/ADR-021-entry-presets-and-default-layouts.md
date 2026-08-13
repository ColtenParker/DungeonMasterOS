# ADR-021: Entry presets and default layouts

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Built-in presets determine which optional sections appear initially. The
product explicitly states that a preset does not create a different domain type,
that the DM may freely add or remove supported sections after creation, and
that custom preset management is deferred. Presets are the final Milestone 6
slice so that they can target sections whose behavior has already been defined.

## Options Considered

### Option A: Server-owned creation templates without persistent association

Advantages:

- Produces deterministic initial layouts at the trusted API boundary.
- Lets an Entry evolve independently after creation.
- Avoids migrations when a built-in preset changes later.

Disadvantages:

- The system cannot later identify which preset originally created an Entry.

### Option B: Persist a preset association and synchronize changes

Advantages:

- Makes preset provenance and later bulk updates possible.

Disadvantages:

- Conflicts with freely customized per-Entry layouts and turns presets into
  lasting domain subtypes.

### Option C: Ship only Blank presets

Advantages:

- Requires little preset content design.

Disadvantages:

- Does not deliver the requested useful built-in defaults.

## Decision

Implement presets as immutable, version-controlled server-owned creation
templates identified by stable type-specific slugs. Entry creation may supply
one valid preset slug for the requested Entry type. The server applies its
initial ordered section layout and any explicitly documented empty defaults in
the same creation transaction. Clients do not submit arbitrary preset-defined
layout payloads during creation.

After creation, persist only the resulting ordinary section layout and
structured data. Do not persist the preset slug, synchronize later preset
changes, or display a preset as an Entry subtype. The DM may add, remove, and
reorder supported sections according to ADR-015.

Every specialized Entry type receives a Blank preset. NPC additionally receives
the product-listed Merchant, Noble, Guard, and Villain presets. Their exact
section matrices must be documented alongside implementation after the
supported NPC, Inventory, and common sections exist; presets may select only
sections approved by the preceding ADRs and may not introduce new domain fields
or game rules.

Custom preset creation, editing, import, export, and synchronization remain
deferred.

## Reasoning

A preset is useful as a starting layout, not as durable Entry identity.
Applying it at the server boundary makes creation predictable and validated,
while discarding provenance prevents future template edits from unexpectedly
rewriting customized Entries. Implementing presets last keeps them subordinate
to reviewed section behavior.

## Consequences

### Positive

- Built-in presets provide useful starting layouts without creating subtypes.
- Existing Entries are insulated from later built-in preset changes.
- Preset creation and normal manual layout editing share one validated model.

### Negative / Tradeoffs

- Original preset provenance is unavailable after creation.
- Preset changes affect only newly created Entries.
- The initial NPC section matrix still needs implementation-level documentation
  constrained by the accepted section catalog.

### Future implications

- Custom presets require their own ownership, naming, versioning, and
  import/export decisions.
- A future “apply preset to existing Entry” feature must define merge and data
  loss behavior rather than reusing creation semantics implicitly.

## Validation

- API tests reject unknown presets and presets belonging to another Entry type.
- creation tests prove each preset produces its documented ordered section
  layout atomically.
- tests prove later preset-definition changes do not mutate existing Entries.
- UI tests prove the preset is selected only during creation and the resulting
  sections remain freely editable.

