# Decision Log

This file tracks product and technical decisions made by the human developer.

Use this for smaller decisions.

Use a dedicated Architecture Decision Record under `docs/architecture/` for consequential architectural choices.

## Format

### YYYY-MM-DD — Decision Title

**Context**

What problem required a decision?

**Options considered**

- Option A
- Option B

**Decision**

What was chosen?

**Reasoning**

Why was it chosen?

**Consequences**

What becomes easier, harder, or constrained because of this decision?

---

## Product Decisions Already Established

### World is the top-level content container

Worlds may contain multiple Campaigns and reusable World-level content.

### Campaign changes do not automatically redefine World canon

The DM may choose when Campaign changes should affect the World.

### Structured data exists only when it enables application behavior

Everything else should remain flexible free-form content.

### Relationships are organizational, not gameplay dependencies

Links help the DM navigate without forcing campaign logic.

### Campaign owns the persistent workspace

Sessions do not reset the workspace.

### Status and archive are distinct

Status describes fictional state. Archive describes DM organization.

### MVP is DM-only

Player permissions and collaboration are deferred.

### Permanent deletion is reference-safe

Referenced Entries cannot be permanently deleted until references are removed.

### Search is context-sensitive

Category, Campaign, World, and global searches have different scopes.

### Media is reusable

Media is managed in a dedicated library and referenced by Entries.

### Import warnings are resolvable

Missing references may be linked, removed, or ignored rather than automatically guessed or treated as hard failures.

---

## Milestone 6 Decisions

### 2026-08-13 — Specialized TTRPG Entry architecture

**Context**

Milestone 6 requires useful structured behavior for NPCs, Locations, Quests,
Factions, Items, Inventories, and presets while preserving free-form Entry
documents.

**Decision**

The human developer selected Option A for all twenty Milestone 6 design choices.
The accepted decisions are recorded in:

- ADR-015: Specialized Entry sections and persistence
- ADR-016: NPC structured sections
- ADR-017: Location hierarchy
- ADR-018: Quest structured sections
- ADR-019: Faction structured sections
- ADR-020: Item Library and inventories
- ADR-021: Entry presets and default layouts

**Reasoning**

The selected designs add relational structure only where the application can
provide concrete behavior, preserve the universal Entry and rich-document
foundations, and follow the required type-by-type delivery sequence.

**Consequences**

Milestone 6 implementation is constrained by these ADRs. Game System defaults,
structured deadlines, stat-block schemas, advanced faction mechanics, custom
presets, and broader structured full-text indexing remain deferred.

---

## Milestone 7 Decisions

### 2026-08-13 — Sessions, encounters, workspace utilities, and calendar

**Context**

Milestone 7 makes the application usable during play through explicit Session
state and activity history, a deliberately limited Encounter tracker,
persistent workspace utilities, and manual Campaign time with advisory
reminders.

**Decision**

The human developer selected Option A for all twenty-five Milestone 7 design
choices. The accepted decisions are recorded in:

- ADR-022: Session lifecycle and activity audit
- ADR-023: Encounter initiative and hit-point tracking
- ADR-024: Campaign workspace utility windows
- ADR-025: Campaign calendar, time, and reminders

**Reasoning**

The selected designs keep active-play state durable and explicit while
preserving the application's DM-assistant boundary. Session history records
meaningful semantic changes, Encounter tracking remains system-neutral, live
tools fit the persistent floating workspace, and calendar reminders inform the
DM without executing fictional events.

**Consequences**

Milestone 7 implementation is constrained by these ADRs. Narrative recap
generation, combat automation, game-system rules, recurring reminders,
irregular calendar rules, calendar-definition migration, utility pinning, and
automatic event execution remain deferred.
