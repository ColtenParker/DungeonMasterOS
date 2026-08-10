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
