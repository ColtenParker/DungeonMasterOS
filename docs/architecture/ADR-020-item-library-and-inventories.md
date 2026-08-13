# ADR-020: Item Library and inventories

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Items exist independently in an Item Library and may eventually originate from
game-system defaults, World custom content, or Campaign custom content.
Inventories are structured lists of Item references representing ownership or
availability from the DM's perspective. Removing an Inventory must remove only
its references, not Item definitions.

No Game System identity, World selection, default catalog, licensing policy, or
system-specific Item schema currently exists. ADR-004 already establishes Entry
as the identity foundation for specialized content.

## Options Considered

### Item Library and Game System boundary

#### Option A: Custom World and Campaign Item Entries now

Advantages:

- Delivers the library and inventory references using established Entry scope.
- Avoids inventing a default dataset or system schema.

Disadvantages:

- Game-system default Items remain deferred.

#### Option B: Add Game System selection and a default catalog now

Advantages:

- Supports all listed Item origins immediately.

Disadvantages:

- Requires several domain, data-source, and licensing decisions outside this
  milestone review.

#### Option C: Use a separate non-Entry Item model

Advantages:

- Could optimize specifically for inventory use.

Disadvantages:

- Loses universal Entry documents, links, tags, scope, and identity.

### Inventory representation

#### Option A: Entry-owned named inventories with stable line rows

Advantages:

- Supports several possession or availability contexts per Entry.
- Preserves Item identity and allows ordered lines, quantities, and notes.

Disadvantages:

- Requires nested collection editing and validation.

#### Option B: One inventory per NPC with one line per unique Item

Advantages:

- Is simpler to query and present.

Disadvantages:

- Cannot represent Location availability or separate containers and lots.

#### Option C: Store inventories in the document or JSON

Advantages:

- Requires fewer relational tables.

Disadvantages:

- Cannot enforce Item references and conflicts with structured behavior.

## Decision

Add `ITEM` as an Entry type. Milestone 6 supports DM-created World- and
Campaign-scoped Items through the normal Entry lifecycle, document, tags,
relationships, search, and archive behavior. Item identity and descriptive
content require no additional subtype fields in this milestone; structured Item
properties must be justified by later application behavior.

Defer Game System identity, World Game System selection, system-default Item
catalogs, and system-specific Item fields to a dedicated design review. Do not
add placeholder origin values that imply an unavailable catalog.

Model an Inventory as a named, ordered collection owned by one Entry. An Entry
may have multiple inventories. Milestone 6 makes the Inventory section
available to NPC and Location Entries: NPC inventories represent possession,
and Location inventories represent availability or contents from the DM's
perspective. Supporting another owner type requires adding that type to the
allow-list deliberately.

Each inventory has UUIDv7 identity, a bounded name, and ordering. Each line has
UUIDv7 identity, an `ITEM` Entry reference, a positive integer quantity, an
optional bounded plain-text note, and ordering. Multiple lines may reference
the same Item to represent distinct lots or notes; they are not automatically
merged.

A World-owned Inventory may reference an Item from the same World. A
Campaign-owned Inventory may reference an Item from its Campaign or parent
World. Archived Items may remain referenced. Removing a line, removing an
Inventory, or removing the Inventory section deletes only inventory records;
it never edits, archives, or deletes Item Entries.

## Reasoning

Items already benefit from universal Entry behavior, while inventories need
strong, scope-aware references to them. Named inventories and distinct line
identity cover personal possessions, containers, and availability without
prematurely modeling individual physical Item instances. Deferring Game System
content avoids committing to a data source and rules model that the project has
not reviewed.

## Consequences

### Positive

- Items are reusable, linkable, searchable Entries.
- Inventories preserve Item identity and cannot accidentally delete definitions.
- Campaign inventories can reuse World Items.
- Duplicate Item lines support separately annotated lots.

### Negative / Tradeoffs

- System-default Items are unavailable until Game System is designed.
- Inventory quantities are whole numbers only.
- Duplicate lines are not automatically totaled or merged.
- Only NPCs and Locations host inventories initially.

### Future implications

- Game System support requires a separate ADR covering identity, selection,
  defaults, overrides, updates, and licensing.
- Unique physical Item instances, transfers, containers within containers, and
  currency require separate behavior decisions.
- Permanent Item deletion must report all inventory-line dependencies.

## Validation

- API tests reject unsupported owners, non-Item targets, nonpositive or
  noninteger quantities, and invalid names or notes.
- integration tests enforce World and Campaign visibility and retain Item rows
  when inventories or lines are removed.
- aggregate-save tests prove inventories and Entry edits commit atomically.
- UI tests cover multiple inventories, ordering, duplicate Item lines, archive
  visibility, removal confirmation, and dirty-window behavior.

