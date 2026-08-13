# Milestone 6 Implementation Notes

Milestone 6 implements the accepted decisions in ADR-015 through ADR-021.

## Structured section catalog

| Entry type | Supported optional sections |
| --- | --- |
| NPC | Portrait, Status, Current location, Inventory |
| Location | Hierarchy, Inventory |
| Quest | Status, Objectives |
| Faction | Status, Leadership |
| Item | None; title and rich document remain the Item definition |
| Journal | None |

The rich document remains available for every Entry and is not an optional
section. Section order and structured content are saved atomically with the
Entry. Confirmed section removal deletes that section's structured data.

## Built-in preset matrices

| NPC preset | Initial ordered sections |
| --- | --- |
| Blank | None |
| Merchant | Portrait, Status, Current location, Inventory |
| Noble | Portrait, Status, Current location |
| Guard | Portrait, Status, Current location, Inventory |
| Villain | Portrait, Status, Current location, Inventory |

Location, Quest, Faction, Item, and Journal currently provide only the Blank
preset. Preset identity is not retained after creation; only the resulting
ordinary section layout is persisted.

## Explicit deferrals

- Game System identity, World selection, and system-default Item catalogs
- structured stat blocks
- structured in-world Quest deadlines
- Faction membership, reputation, ranks, and territory
- individual physical Item instances, transfers, nested containers, and
  currency behavior
- custom preset management and applying presets to existing Entries
- full-text indexing of subtype child text
