# ADR-012: Media identity, scope, and local storage

- Status: Accepted
- Date: 2026-08-12
- Decision owner: Human developer

## Context

Milestone 5 makes reusable media a first-class resource and allows a Campaign
workspace to use an image or map as its base layer. The product specification
anticipates broader media categories, Entry media references, and portable
archives, but this milestone only needs locally imported raster images and maps.

The application already uses PostgreSQL through Prisma, UUIDv7 domain
identifiers, exclusive World or Campaign ownership, and reference-safe archive
behavior. Media bytes are materially different from the structured metadata
stored in PostgreSQL: they can be large, need image processing, and must later be
packaged for export without making source paths part of domain identity.

This decision defines the initial media boundary, metadata, scope, storage
identity, and stored representations. Upload security, delivery, deletion, and
map behavior are covered by ADR-013 and ADR-014.

## Options Considered

### Milestone 5 file-type boundary

#### Option A: Raster images and maps only

Accept PNG, JPEG, and WebP files and classify each imported resource as an
image or map.

Advantages:

- Covers the workspace-background and map-navigation goal directly.
- Allows one well-defined validation and processing pipeline.
- Avoids prematurely designing document, audio, and video handling.

Disadvantages:

- The Media Library does not yet support every category anticipated by the
  product specification.
- Animated images and vector maps are not supported initially.

#### Option B: Implement all anticipated media categories now

Advantages:

- Produces a broader library immediately.

Disadvantages:

- Requires category-specific security, metadata, preview, and delivery rules
  outside Milestone 5.
- Delays the map workflow behind unrelated file handling.

#### Option C: Accept arbitrary files as opaque media

Advantages:

- Requires little category-specific modeling.

Disadvantages:

- Weakens validation and safe delivery.
- Provides no reliable dimensions or display representation for maps.

### Metadata and ownership model

#### Option A: Relational Media with one exclusive owner

Advantages:

- Matches the established World/Campaign scope model.
- Keeps identity and references independent from file names and paths.
- Allows database constraints and reference-aware deletion.

Disadvantages:

- Moving a resource between scopes is not a simple metadata edit.
- Requires both database and filesystem lifecycle handling.

#### Option B: World ownership with Campaign join records

Advantages:

- A single resource can be associated with several Campaigns.

Disadvantages:

- Blurs the distinction between reusable World media and isolated Campaign
  media.
- Adds sharing semantics not required for the single-World hierarchy.

#### Option C: Use a filesystem path as media identity

Advantages:

- Has little initial metadata overhead.

Disadvantages:

- Renames and moves break references.
- Exposes machine-specific details to APIs and future exports.

### Scope changes

#### Option A: Immutable ownership scope

Advantages:

- Preserves stable ownership and visibility rules.
- Avoids silently changing which Campaigns can see a resource or its markers.

Disadvantages:

- Promotion or reassignment requires an explicit future copy workflow.

#### Option B: Reassign Media between World and Campaign

Advantages:

- Makes correcting an initial scope choice convenient.

Disadvantages:

- Can invalidate active backgrounds and marker visibility.
- Requires a reference migration policy.

#### Option C: Copy Media when scope changes

Advantages:

- Preserves the original and its references.

Disadvantages:

- Creates duplicate identities and bytes.
- Requires a product workflow not specified for this milestone.

### Byte persistence

#### Option A: Managed filesystem with PostgreSQL metadata

Advantages:

- Keeps large binary data out of normal relational queries and migrations.
- Works well with Sharp and ordinary local file streaming.
- Allows a future archive process to package metadata and managed files.

Disadvantages:

- Database and filesystem operations are not one atomic transaction.
- Backups must eventually include both stores.

#### Option B: PostgreSQL binary columns

Advantages:

- Keeps bytes and metadata in one backup and transaction boundary.

Disadvantages:

- Enlarges database rows, dumps, and normal query infrastructure.
- Makes image processing and streaming less direct.

#### Option C: Retain the user's original path

Advantages:

- Avoids copying imported files.

Disadvantages:

- Moving, renaming, or unmounting the source breaks the application.
- Prevents a self-contained future export.

### Stored representations

#### Option A: Original, normalized display image, and thumbnail

Advantages:

- Retains source fidelity for future export.
- Gives the workspace a safe, orientation-correct display asset.
- Gives the library a bounded preview asset.

Disadvantages:

- Uses more disk space and requires import processing.

#### Option B: Original only

Advantages:

- Minimizes storage and processing.

Disadvantages:

- Repeats expensive decoding and resizing during ordinary browsing.
- Exposes large originals to routine display paths.

#### Option C: Normalize and discard the original

Advantages:

- Keeps only application-ready bytes.

Disadvantages:

- Permanently loses the imported source and its fidelity.

### Storage identity and deduplication

#### Option A: UUID-derived paths plus a SHA-256 checksum, without automatic deduplication

Advantages:

- Makes stored names collision-resistant and independent of user input.
- Records integrity and duplicate-detection information without coupling
  separate Media lifecycles.
- Keeps deletion and metadata ownership straightforward.

Disadvantages:

- Identical imports consume additional disk space.

#### Option B: Content-addressed shared storage

Advantages:

- Identical bytes can be stored once.

Disadvantages:

- Requires reference counting or garbage collection.
- Couples otherwise independent Media records.

#### Option C: Original filenames as stored identity

Advantages:

- Files are recognizable when browsing storage manually.

Disadvantages:

- Names collide and can contain unsafe or platform-specific characters.
- Renaming becomes an identity concern.

## Decision

Milestone 5 accepts only non-animated PNG, JPEG, and WebP raster files. Each
Media resource is explicitly classified as `IMAGE` or `MAP`. Documents, audio,
video, tokens with separate behavior, SVG, animated images, and arbitrary files
are deferred until their security and user experience requirements are known.

Create a relational `Media` resource with a UUIDv7 identifier and the following
domain metadata:

- display name and optional description;
- `IMAGE` or `MAP` classification;
- exactly one immutable owner: a World or a Campaign;
- original filename for display only;
- server-verified MIME type;
- original byte size, pixel width, and pixel height;
- SHA-256 checksum of the accepted original bytes;
- managed storage keys for the original, display, and thumbnail
  representations;
- archive state; and
- creation and update timestamps.

Enforce exclusive ownership with the same database-level XOR pattern used for
Entries. Campaign-owned Media belongs to exactly one Campaign and is visible
only in that Campaign context. World-owned Media is reusable by Campaigns whose
parent is that World. Unrelated World and Campaign contexts cannot reference or
serve it. Archive state is organizational and does not change ownership.

Ownership scope is immutable. Milestone 5 does not implement reassignment,
promotion, or copying between scopes. Those workflows must later define how
backgrounds, markers, and exported identity behave rather than mutating scope
implicitly.

Store bytes under an application-managed filesystem root configured by
`MEDIA_ROOT`; never store or return an absolute machine path as domain data.
Development uses a repository-local, gitignored data directory by default, and
tests use isolated temporary directories. Production-like configuration may
place the root elsewhere without changing database identifiers or API shapes.
The application copies an accepted upload into managed storage and never relies
on the user's source path afterward.

Use UUID-derived, application-generated storage paths. Retain a sanitized
original filename only as metadata, not as a directory or object identity.
Record SHA-256 for integrity and future duplicate review, but do not
automatically merge, reuse, or deduplicate Media records or files.

For every import, retain three representations:

- the verified original bytes;
- an orientation-correct, metadata-stripped display representation bounded for
  normal workspace use; and
- an orientation-correct, metadata-stripped thumbnail bounded for library use.

Exact display dimensions, thumbnail dimensions, encoding quality, and directory
sharding are tuneable implementation constants. They must be deterministic and
covered by tests, but are not persisted product behavior. The original remains
the portability source even when the display representations are normalized.

Do not add generic Entry-to-Media attachments in Milestone 5. Future
attachments must reference the stable Media UUID rather than store paths or
duplicate bytes.

## Reasoning

The chosen model makes media reusable and referenceable without expanding this
milestone into a general-purpose file host. PostgreSQL remains authoritative for
identity, ownership, and lifecycle, while the managed filesystem handles the
large immutable byte representations it is better suited to serve.

Exclusive immutable scope matches the Entry model and prevents a metadata edit
from changing visibility beneath existing references. Keeping originals plus
bounded derivatives balances portability, fidelity, and routine interface
performance. UUID storage keys and checksums provide safe identity and
integrity while avoiding the lifecycle complexity of transparent deduplication.

## Consequences

### Positive

- Renaming or moving a user's source file cannot break imported Media.
- World and Campaign visibility follows existing domain rules.
- Library thumbnails and workspace images do not require serving full-size
  originals.
- Original bytes remain available for later export.
- Storage paths never become public or portable identifiers.

### Negative / Tradeoffs

- Each import consumes space for three representations.
- Filesystem and database consistency needs explicit failure handling.
- Scope mistakes cannot be corrected by a simple reassignment.
- The initial library omits several categories named in the product vision.
- Automatic deduplication is unavailable.

### Future implications

- Milestone 9 exports must package managed originals and reconstruct derived
  representations or include them according to a versioned archive decision.
- A future repair workflow must preserve the Media UUID and revalidate bytes.
- Broader file categories require category-specific metadata, validation,
  previews, and delivery decisions.
- Entry attachments must use Media UUID references.
- Any later deduplication must define independent record ownership and garbage
  collection explicitly.

## Validation

- Database tests enforce exactly one owner and immutable scope.
- Visibility tests accept the owning Campaign and its parent World and reject
  unrelated contexts.
- Import tests prove the source path is not retained as storage identity.
- Representation tests prove original, display, and thumbnail files are
  created beneath the configured root.
- Metadata tests verify dimensions, byte size, MIME type, checksum, timestamps,
  and archive state.
- Configuration tests use isolated media roots and prove no absolute storage
  path is exposed by APIs.

