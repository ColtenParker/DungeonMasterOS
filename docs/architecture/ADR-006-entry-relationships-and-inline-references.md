# ADR-006: Entry relationships and inline references

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 3 adds explicit related-content links, backlinks, inline links to
Entries, and creation of an Entry from highlighted document text. These
features must preserve the distinction between reusable World canon and
Campaign-specific content, maintain referential integrity, and prepare for the
reference-safe permanent deletion workflow planned for Milestone 9.

ADR-004 establishes one universal Entry identity space and immutable World or
Campaign scope. ADR-005 establishes validated, versioned ProseMirror JSON as
the canonical Entry document and requires link removal to preserve document
content. The relationship design must work within those decisions rather than
introducing a second Entry identity or an unvalidated link format.

## Options Considered

### Explicit relationship semantics

#### Option A: Directed relationship with a derived backlink

Store a relationship from one source Entry to one target Entry. The source may
attach an optional context note. The target derives its backlink from that
stored direction.

Advantages:

- Represents that one Entry refers to another without implying reciprocity.
- Gives the optional context note an unambiguous owner.
- Supports backlinks with an ordinary reverse query.
- Leaves typed gameplay relationships for later domain reviews.

Disadvantages:

- A genuinely reciprocal relationship requires a second explicit edge.
- The interface must distinguish outgoing relationships from backlinks.

#### Option B: Symmetric relationship

Advantages:

- Both Entries expose the same connection automatically.

Disadvantages:

- Cannot naturally express that only one Entry mentions the other.
- Makes ownership and wording of a context note ambiguous.

#### Option C: Typed domain relationships

Advantages:

- Can express semantics such as membership, ownership, or location.

Disadvantages:

- Introduces specialized domain behavior before Milestone 6 determines which
  relationships need application behavior.

### Permitted relationship scope

#### Option A: Source-context visibility

A World Entry may target another Entry in the same World. A Campaign Entry may
target an Entry in the same Campaign or a World Entry inherited from that
Campaign's parent World. Cross-Campaign and cross-World references are invalid.

Advantages:

- Prevents reusable World content from depending on Campaign-specific canon.
- Matches the visibility rules established by ADR-004.
- Keeps later Campaign, World, and bundle exports self-contained or
  predictably resolvable.

Disadvantages:

- A DM cannot directly connect isolated Campaign timelines.
- Validation must resolve both source and target scope.

#### Option B: Any Entry in the same World hierarchy

Advantages:

- Supports references between sibling Campaigns.

Disadvantages:

- Weakens Campaign isolation and complicates portability.

#### Option C: Global references

Advantages:

- Provides maximum linking flexibility.

Disadvantages:

- Creates fragile cross-World dependencies and ambiguous search contexts.

### Inline Entry-link representation

#### Option A: ProseMirror mark with a relational reference projection

Represent an inline Entry link as a schema-controlled mark carrying the target
Entry identifier. Keep the visible label as ordinary marked text. On document
save, transactionally synchronize a relational set of distinct source-target
inline references derived from the validated document.

Advantages:

- Naturally applies to highlighted text.
- Removing the mark leaves the visible text intact.
- The relational projection supports backlinks and deletion protection with
  ordinary foreign keys.
- The canonical document remains the source of truth for where links appear.

Disadvantages:

- Requires a new document schema version and compatibility handling.
- Every document write must synchronize the reference projection in the same
  transaction.
- The same target may appear multiple times in a document while the relational
  projection records only that the source depends on it.

#### Option B: Atomic inline node

Advantages:

- Gives each reference a strong editor boundary.

Disadvantages:

- Is awkward for arbitrary highlighted phrases and ordinary text editing.

#### Option C: URL-shaped links inside the document

Advantages:

- Reuses conventional hyperlink behavior.

Disadvantages:

- Weakens referential integrity and makes backlinks and deletion checks depend
  on parsing URL strings.

### Backlink presentation

#### Option A: Combined backlinks with link kind identified

Show incoming explicit relationships and inline mentions in one backlink view,
while identifying their kind. Archived sources remain visible with an archive
indicator.

Advantages:

- Gives the DM one complete view of what depends on an Entry.
- Preserves the useful distinction between an explicit relationship and a
  document mention.

Disadvantages:

- Requires combining two persistence sources.

#### Option B: Separate relationship and mention panels

Advantages:

- Keeps the two reference mechanisms visually isolated.

Disadvantages:

- Adds interface surface and makes dependency review less cohesive.

#### Option C: Backlinks only for explicit relationships

Advantages:

- Requires fewer queries.

Disadvantages:

- Inline links would not participate fully in the knowledge graph.

### Create from highlighted text

#### Option A: Editor picker with explicit-save insertion

Use the highlighted phrase as the proposed title. Let the DM select an existing
Entry or create a new one after choosing its type and scope. Campaign context
defaults new Entries to Campaign scope with the existing World override. After
creation or selection, insert an inline mark into the local editor document;
the source link becomes persistent only when the DM explicitly saves it.

Advantages:

- Fits ADR-005's explicit-save behavior.
- Keeps scope and Entry type under DM control.
- Does not couple the API to unstable editor selection positions.

Disadvantages:

- A newly created target can remain even if the source document is not later
  saved.
- The interface must make the unsaved link state clear.

#### Option B: Atomic server-side create-and-link command

Advantages:

- Could make target creation and source linking one durable operation.

Disadvantages:

- Couples the server to editor positions and conflicts with local explicit-save
  editing.

#### Option C: Leave the editor for the ordinary Entry creator

Advantages:

- Reuses the existing creation form.

Disadvantages:

- Interrupts writing context and weakens the highlighted-phrase workflow.

### Reference-aware deletion timing

#### Option A: Add dependency constraints now and deletion operations later

Persist explicit and inline dependency rows with foreign keys that restrict
deletion of a referenced target. Removing an outgoing relationship or inline
mark removes only its reference metadata, never the target Entry. Do not add a
permanent-delete API or interface until Milestone 9.

Advantages:

- Prevents data from being created now that cannot later satisfy the product's
  deletion policy.
- Keeps Milestone 3 focused on references rather than deletion workflows.

Disadvantages:

- The schema contains deletion safeguards before users can invoke permanent
  deletion.

#### Option B: Implement permanent deletion during Milestone 3

Advantages:

- Exercises dependency review immediately.

Disadvantages:

- Expands beyond the Milestone 3 implementation plan.

#### Option C: Add reference constraints in Milestone 9

Advantages:

- Makes the Milestone 3 migration smaller.

Disadvantages:

- Risks a later integrity retrofit over already-persisted references.

### External hyperlinks

#### Option A: Continue to defer external hyperlinks

Advantages:

- Keeps this milestone focused on Entry knowledge links.
- Defers URL validation and external-navigation security behavior until there
  is an explicit product requirement.

Disadvantages:

- Notes cannot yet contain clickable external websites.

#### Option B: Add validated HTTP and HTTPS links

Advantages:

- Supports common reference-note workflows.

Disadvantages:

- Adds a second link type and security boundary not required by Milestone 3.

## Decision

Use directed explicit relationships. Each relationship has one source Entry,
one target Entry, and an optional context note. Reject self-relationships and
duplicate source-target relationships. Backlinks are derived reverse views;
the application does not automatically create a reciprocal relationship.

Enforce source-context visibility for both explicit and inline links. A
World-scoped source may target only an Entry in the same World. A
Campaign-scoped source may target either the same Campaign or its parent
World. Reject cross-Campaign and cross-World references. The source Entry's
actual scope controls validation even when it is being edited from an inherited
Campaign view.

Add a schema-controlled ProseMirror `entryLink` mark containing the target
Entry UUID. The marked text remains the visible label and is not synchronized
to the target title. Removing the mark therefore preserves the text. Advancing
the document schema from version 1 requires explicit version-aware validation;
existing version 1 documents remain valid.

Treat the validated ProseMirror document as canonical for inline-link placement.
Maintain a relational projection containing each distinct source-target inline
dependency. Document persistence and projection synchronization must succeed or
fail in one database transaction. A target must exist and pass scope validation
before either an explicit relationship or an inline link can be persisted.

Present one backlink view that combines incoming explicit relationships and
inline mentions while identifying their kind. Do not hide references merely
because their source or target Entry is archived; show archive state instead.
Only explicit relationships carry context notes.

When creating from highlighted text, prefill the selected phrase as the target
title and let the DM select an existing Entry or create a new Entry with an
explicit type and scope. Preserve the established Campaign-scope default and
World override. Insert the selected or created target as a local inline mark;
the source document remains governed by explicit Save behavior.

Add foreign-key-backed dependency protection during Milestone 3. A referenced
target cannot be permanently deleted while incoming explicit or inline
references exist. Removing a relationship or inline mark removes only the
reference. Permanent-deletion endpoints, dependency-review UI, and the final
delete workflow remain deferred to Milestone 9.

Do not add ordinary external hyperlinks in Milestone 3.

## Reasoning

Directed relationships and inline mentions both describe that one Entry refers
to another. Keeping their presentation unified but their storage distinct
preserves that meaning without forcing all references into the document or all
document links into explicit relationship records.

The scope rule follows the established canon boundary: Campaign material can
depend on inherited World material, while reusable World material cannot depend
on a particular Campaign. Relational projections complement structured JSON by
providing the database-level integrity, backlink queries, and later dependency
review that JSON alone cannot reliably provide.

An Entry-link mark is the least destructive representation for arbitrary
highlighted text. It also permits the existing label to remain useful if the
link is removed. Deferring external hyperlinks and permanent-deletion
operations keeps the milestone aligned with its knowledge-management goal.

## Consequences

### Positive

- Explicit relationships have clear direction and note ownership.
- Backlinks include both intentional relationships and inline mentions.
- Inline-link removal preserves document text.
- Database constraints prepare reference-safe deletion before delete operations
  exist.
- World and Campaign canon boundaries remain enforceable.
- Document editing remains compatible with explicit Save.

### Negative / Tradeoffs

- Document writes become transactional multi-table operations.
- Scope validation requires resolving both Entries and their parent hierarchy.
- Version 2 document support must coexist with stored version 1 documents.
- Creating a target from highlighted text can leave a valid but unlinked Entry
  if the source is not saved.
- Cross-Campaign and cross-World knowledge links are unavailable.

### Future implications

- Milestone 4 should route Entry-link activation through the workspace's
  open-or-focus behavior.
- Milestone 6 may add typed structured relationships separately when a concrete
  Entry behavior requires them.
- Milestone 9 dependency review can query explicit and inline reference rows
  without scanning document JSON.
- Import and export must preserve explicit edges, inline marks, and their Entry
  identifiers while handling unresolved references deliberately.
- External URL support requires a later URL-validation and safe-navigation
  decision.

## Validation

- Migration tests prove explicit and inline references require valid Entries
  and prevent deletion of referenced targets.
- Persistence tests prove duplicate and self-relationships are rejected.
- Scope tests cover World-to-World, Campaign-to-same-Campaign, and
  Campaign-to-parent-World success and reject cross-scope cases.
- Document tests prove version 1 compatibility and validate version 2
  `entryLink` marks and UUID attributes.
- Transaction tests prove invalid document links do not partially update either
  the document or its reference projection.
- API tests prove relationship creation, removal, context-note editing, and
  combined backlinks.
- Editor tests prove highlighted text can link or create, explicit Save remains
  required, and unlinking preserves visible text.
- Archive tests prove archived references remain resolvable and visibly marked.

