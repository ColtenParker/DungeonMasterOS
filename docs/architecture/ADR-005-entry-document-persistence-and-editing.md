# ADR-005: Entry document persistence and editing

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Every Entry has a free-form document. Rich text is the default editor, while
Markdown is an optional alternative. Future milestones must be able to add
inline Entry links, inspect document text for search, export content, and evolve
the supported document features without silently corrupting long-running
campaign notes.

The project currently has no rich-text dependency and accepts JSON request
bodies of at most 32 KB. Milestone 2 needs a canonical persistence format, an
editor library, schema-version behavior, input validation, and a bounded request
size. These decisions must avoid embedding media or implementing relationships,
search, and import/export ahead of their planned milestones.

## Options Considered

### Canonical rich-text format and editor

#### Option A: Tiptap and ProseMirror JSON stored as JSONB

Use Tiptap's React integration and a deliberately configured ProseMirror schema.
Persist the editor document as structured JSON in PostgreSQL `JSONB`.

Advantages:

- Uses a structured node and mark model suitable for future inline Entry links.
- The editor schema controls which document structures are valid.
- JSON can be inspected and transformed without parsing arbitrary HTML.
- Tiptap supports restoring editor state directly from JSON.

Disadvantages:

- Adds several editor packages and ProseMirror concepts.
- Extension-schema changes can make older documents incompatible without a
  versioning and migration policy.
- API validation must not trust arbitrary client JSON.

#### Option B: Lexical editor state stored as JSON

Advantages:

- Provides a React-focused editor architecture and extensible nodes.
- Supports serialized editor state.

Disadvantages:

- Requires more application-specific decisions for server rendering, Markdown
  conversion, and portable document handling.
- Future inline-link and export behavior remains tied to custom node choices.

#### Option C: HTML as canonical content

Advantages:

- Is broadly renderable and familiar.
- Can be displayed outside the editor with conventional tooling.

Disadvantages:

- Requires strict sanitization at every rendering boundary.
- Structured Entry references become fragile HTML attributes.
- Transformations and validation are more difficult than with a document tree.

#### Option D: Markdown as canonical content

Advantages:

- Is portable, inspectable, and naturally text-oriented.

Disadvantages:

- Rich document features may not round-trip through Markdown.
- Makes the default rich-text experience a projection over a less expressive
  canonical format.

### Markdown behavior

#### Option A: JSON remains canonical and Markdown is a derived projection

Advantages:

- Maintains one source of truth.
- Preserves structured nodes required by future features.
- Allows Markdown support to define and test an explicit compatible subset.

Disadvantages:

- Markdown editing cannot promise lossless support for every future rich-text
  node.
- Conversion requires warnings or blocking behavior for unsupported content.

#### Option B: Each Entry chooses rich-text JSON or Markdown storage

Advantages:

- Markdown-authored Entries preserve their exact source text.

Disadvantages:

- Every renderer, search extractor, linker, and export path must support two
  canonical formats.
- Switching formats requires conversion and conflict rules.

#### Option C: Application-specific editor-independent document tree

Advantages:

- Could theoretically target rich text and Markdown equally.

Disadvantages:

- Requires designing and maintaining a custom document platform before the
  basic notebook workflow is proven.

### Input validation and sizing

#### Option A: Schema-validated and bounded documents

Accept only the configured document nodes, marks, and attributes. Reject raw
HTML and unknown structures. Limit serialized document content to 1 MiB and set
the transport limit slightly above that to accommodate the surrounding request.

Advantages:

- Prevents malformed or unsupported document state from becoming persistent.
- Provides a predictable parsing, storage, and rendering boundary.
- Prevents media data from being smuggled into documents.

Disadvantages:

- Large Entries must be split or reduced.
- Schema evolution requires validators for every supported document version.

#### Option B: Arbitrary JSON with a high transport limit

Advantages:

- Requires little initial validation code.

Disadvantages:

- Allows invalid documents and unbounded payload growth into durable storage.
- Pushes failures from the API boundary into later editing and rendering.

### Save and client-state behavior

#### Option A: Explicit Save with modular local React state

Advantages:

- Makes persistence timing and failures visible to the DM.
- Matches the existing last-write-wins API behavior.
- Avoids selecting global state or page routing before the workspace milestone.

Disadvantages:

- Unsaved changes can be lost if the user navigates away.
- The user must deliberately save edits.

#### Option B: Autosave

Advantages:

- Reduces explicit save actions and the window for unsaved local edits.

Disadvantages:

- Requires debounce, retry, stale-write, navigation, and failure-recovery
  policies.
- Can produce surprising persistence while the editing workflow is still being
  established.

#### Option C: Add router and global client-state dependencies

Advantages:

- Provides deep links, centralized caching, and coordinated mutations.

Disadvantages:

- Commits to navigation and state strategies before the persistent floating
  workspace is designed.

## Decision

Use Tiptap with a deliberately configured ProseMirror schema as the Milestone 2
rich-text editor. Persist its canonical document JSON in a PostgreSQL `JSONB`
field. Store an integer document-schema version alongside the content so older
documents can be identified and deliberately migrated when the allowed schema
changes.

The initial document schema should contain only ordinary notebook formatting:

- document;
- paragraph and plain text;
- headings;
- ordered and unordered lists with list items;
- block quote;
- code block and hard break; and
- bold, italic, strike, and inline code marks.

Do not include raw HTML, images, media payloads, tags, explicit Entry relations,
or inline Entry-link nodes in Milestone 2. Those features remain owned by later
milestones. Ordinary external-link support should also be omitted until link
validation and the Entry inline-link representation are reviewed together in
Milestone 3.

Validate incoming document JSON against the configured nodes, marks,
attributes, and nesting rules before persistence. Zod may enforce the transport
shape, while ProseMirror schema validation or another targeted validator may be
used where Zod alone is insufficient. Invalid or unsupported content returns the
existing `400` validation error envelope. Rendering must operate on validated
structured content and must never treat stored text as executable HTML.

Limit the serialized document field to 1 MiB. Configure the Express JSON request
limit slightly above the maximum complete Entry update payload so the API can
return a controlled client error rather than accepting unbounded documents. Do
not permit embedded base64 or other media data in the document.

JSON remains the sole canonical representation. Markdown is a derived editing,
import, or export projection over an explicitly supported round-trip subset.
Rich-text editing is implemented first. Markdown editing may be added after its
conversion rules and unsupported-content behavior are tested. Conversion must
never silently discard content: the application must warn, block the switch, or
require explicit confirmation when a document cannot round-trip safely.

Use modular React components with local state and explicit Save behavior. Do not
add a router or global client-state library in Milestone 2. Editing remains
last-write-wins as established for the single-user MVP. Autosave is deferred
until retry, navigation, failure-recovery, and stale-write behavior are designed.

Do not store a derived plain-text search projection yet. Milestone 3 will choose
the search strategy and can extract and backfill text from versioned documents.

## Reasoning

Structured ProseMirror JSON fits the product's rich-text-first requirement while
preparing the document for future inline Entry nodes and controlled
transformations. A deliberately small initial schema reduces compatibility and
security risk. JSONB preserves the document tree without making Prisma's
generated persistence type the API contract.

One canonical representation prevents every future feature from supporting two
independent document models. Treating Markdown as a tested projection preserves
the optional Markdown workflow without promising impossible lossless conversion
for arbitrary future rich nodes.

Versioning, validation, and a bounded payload make durable campaign notes safer
to evolve. Explicit Save and local state keep the initial editing workflow
understandable and avoid making premature decisions for the later workspace.

## Consequences

### Positive

- Entry content has a structured, versioned, and validated canonical format.
- Future inline Entry links can become schema-controlled nodes or marks.
- Raw HTML and embedded media do not enter durable documents.
- Document size and API parsing costs have an explicit upper bound.
- Markdown conversion failures must be visible rather than silently destructive.
- The frontend avoids premature routing and global-state dependencies.

### Negative / Tradeoffs

- The team must understand Tiptap, ProseMirror schemas, and editor extensions.
- Adding Tiptap introduces multiple frontend dependencies.
- Every document-schema change needs backward-compatibility review.
- A 1 MiB limit may require exceptionally long Entries to be divided.
- Explicit Save permits unsaved navigation loss.
- Full Markdown editing is not delivered in the first rich-text slice.

### Future implications

- Milestone 3 must define inline Entry-link nodes or marks without breaking
  version 1 documents.
- Search must define how text is extracted from every supported document
  version.
- Media references must be structured identifiers rather than embedded binary
  data.
- Import and export must preserve document versions and report unsupported
  structures.
- Adding external links requires URL validation and safe rendering behavior.
- Autosave or optimistic concurrency requires a later state-transition and
  failure-policy decision.

## Validation

- Unit tests prove the initial empty document and representative formatted
  documents pass validation.
- API tests reject unknown nodes, marks, attributes, invalid nesting, raw HTML,
  embedded media, and documents over 1 MiB.
- Persistence integration tests prove JSON and document-schema versions
  round-trip without alteration.
- Editor tests prove saved content restores with headings, lists, quotes, code,
  hard breaks, and the supported marks intact.
- UI tests prove explicit Save success, validation errors, API failures, and
  unsaved local edits behave visibly.
- Markdown tests, before that mode is enabled, prove supported content
  round-trips and unsupported content produces an explicit non-destructive
  outcome.
- Real-use review checks editor responsiveness with representative documents
  near the supported size boundary.
