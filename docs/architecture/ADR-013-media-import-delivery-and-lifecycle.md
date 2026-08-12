# ADR-013: Media import, delivery, and lifecycle

- Status: Accepted
- Date: 2026-08-12
- Decision owner: Human developer

## Context

ADR-012 places verified raster files in application-managed local storage while
PostgreSQL owns their identity and metadata. Importing and serving user-selected
files crosses a security boundary even in a local single-user application.
Malformed images, misleading extensions, oversized decompressed images, unsafe
response headers, missing files, and references from maps or workspaces all need
defined behavior.

The product distinguishes archive from permanent deletion and requires
reference-safe deletion. Milestone 5 must preserve active backgrounds and map
references while remaining honest when managed files are missing. Generic Entry
attachments and a full repair workflow are outside this milestone.

## Options Considered

### Upload processing

#### Option A: Disk-backed temporary upload, signature detection, and Sharp decoding

Use route-scoped Multer temporary files, inspect file signatures with
`file-type`, and decode accepted images with Sharp before committing them.

Advantages:

- Does not hold the full allowed upload in application memory.
- Verifies actual content instead of trusting browser metadata.
- Proves the image can be decoded and supplies authoritative dimensions.
- Uses the same decoder that creates display representations.

Disadvantages:

- Adds focused dependencies and temporary-file cleanup paths.
- Native image-library compatibility must be maintained.

#### Option B: Hand-written Busboy streaming pipeline

Advantages:

- Gives low-level control over multipart streaming.

Disadvantages:

- Requires more custom parsing, limits, cleanup, and error handling.
- Still needs signature and image-decoding libraries.

#### Option C: Trust extension and client MIME type

Advantages:

- Is simple to implement.

Disadvantages:

- Allows disguised or malformed content into managed storage.
- Cannot safely establish image dimensions or type.

### Import limits

#### Option A: 50 MiB encoded size and 100 megapixels

Advantages:

- Accommodates large practical maps while bounding disk, decode, and memory
  exposure.
- Applies independent limits to compressed bytes and decoded dimensions.

Disadvantages:

- Exceptionally large source maps must be resized before import.

#### Option B: 20 MiB encoded size and 40 megapixels

Advantages:

- Uses fewer local resources.

Disadvantages:

- Rejects more legitimate high-resolution maps.

#### Option C: No application limits

Advantages:

- Never rejects an image solely because of size.

Disadvantages:

- Permits accidental resource exhaustion and decompression bombs.

### Byte delivery

#### Option A: Controlled Media endpoints

Advantages:

- Enforces scope and archive-independent reference visibility on every request.
- Sets verified content types, safe disposition, `nosniff`, caching, and error
  behavior centrally.
- Keeps managed storage private.

Disadvantages:

- Every request passes through the application server.

#### Option B: Public static media directory

Advantages:

- Is simple and efficient for local serving.

Disadvantages:

- Bypasses domain visibility checks and exposes internal storage layout.
- Makes missing-file and security behavior harder to standardize.

#### Option C: Base64 bytes in JSON resources

Advantages:

- Uses one response format for metadata and bytes.

Disadvantages:

- Increases transfer size and memory use.
- Prevents ordinary image caching and streaming.

### Archive and permanent deletion

#### Option A: Archive freely; block deletion while referenced

Advantages:

- Preserves active backgrounds and map navigation.
- Keeps archive as an organizational state rather than referential destruction.
- Matches the product's reference-safe deletion rule.

Disadvantages:

- Users must remove each blocking reference before reclaiming storage.

#### Option B: Cascade marker deletion but block active backgrounds

Advantages:

- Reduces manual cleanup for markers.

Disadvantages:

- Permanently deletes navigation references as a side effect.

#### Option C: Clear or cascade every reference automatically

Advantages:

- Makes permanent deletion convenient.

Disadvantages:

- Silently changes workspace and map behavior.

### Missing managed files

#### Option A: Preserve metadata and references with an explicit broken state

Advantages:

- Avoids compounding filesystem loss by deleting relational context.

- Allows the workspace to fall back safely and supports a future repair flow.

Disadvantages:

- The library and workspace must render unavailable-media states.

#### Option B: Delete metadata when bytes are absent

Advantages:

- Removes unusable records automatically.

Disadvantages:

- Destroys references and evidence needed to diagnose or repair the problem.

#### Option C: Fail the entire workspace

Advantages:

- Makes the storage problem impossible to overlook.

Disadvantages:

- One missing image prevents access to otherwise valid Campaign data.

## Decision

Accept multipart image imports through a route-scoped Multer disk-temporary
pipeline. Do not install upload middleware globally. Limit the multipart request
to one file and bounded textual metadata, reject unexpected fields, and ensure
temporary files are removed after every success or failure path.

Do not trust the filename extension or browser-provided MIME type. Detect the
file signature with `file-type`, allow only the PNG, JPEG, and WebP types from
ADR-012, and require Sharp to decode the image successfully. Apply EXIF
orientation before measuring or deriving display representations. Reject
animated or multi-page content for this milestone.

Enforce both of these independent limits before committing an import:

- no more than 50 MiB of encoded upload bytes; and
- no more than 100,000,000 decoded pixels (`width * height`).

Validate textual request data with Zod after multipart parsing. Validate the
requested owner and classification through the domain layer. A failed import
must not create a usable Media row or leave committed representations behind;
cleanup failures must be reported or logged rather than silently ignored.

Expose scope-controlled contextual application endpoints for Media metadata and
for its display, thumbnail, and original representations. Do not mount
`MEDIA_ROOT` as a public static directory and do not return absolute paths or
storage keys to the client. Each byte response:

- rechecks that the requested Media is visible in its World or Campaign
  context;
- sets the server-verified `Content-Type`;
- sets `X-Content-Type-Options: nosniff`;
- uses a safe inline filename for displayable raster content;
- supplies an ETag derived from the stored checksum or representation identity
  and honors conditional requests; and
- uses private cache semantics so a later authenticated or multi-user host does
  not treat local media as public shared content.

Archiving Media is always allowed. Archived Media is hidden from default active
library views but remains selectable through an archived filter, retains all
metadata and bytes, and continues to satisfy existing workspace-background and
marker references.

Permanent deletion is allowed only when no active reference depends on the
Media. At minimum, blocking references include Campaign workspace backgrounds,
map markers owned by the Media, and any later relational Media references.
Return a structured dependency list when deletion is blocked. Do not clear a
background, cascade markers, or remove a future attachment implicitly. Once all
references are removed, deletion removes the Media metadata and every managed
representation with explicit handling for partial filesystem failure.

When a database row exists but one or more managed files are missing or
unreadable, preserve the Media row and all references. Metadata responses expose
a derived availability state without converting it into archive or deleting
anything. Representation endpoints return a stable unavailable-media error.
The library shows a broken preview, and an affected workspace uses the neutral
background while displaying a non-blocking warning. Other workspace content
and marker metadata remain usable. A workflow for replacing or repairing bytes
in place is deferred, but it must later preserve stable Media identity and
re-run the complete validation pipeline.

Do not add generic Entry attachments or URLs to Entry documents in this
milestone. Future attachments use stable Media UUID foreign keys and become
additional deletion dependencies.

## Reasoning

A local application still processes untrusted byte structures selected from the
filesystem. Signature detection, bounded disk-backed upload, and actual image
decoding provide complementary evidence before bytes become managed state.
Separate encoded and decoded limits protect against both unusually large files
and compact decompression bombs.

Controlled delivery prevents internal paths from becoming API contracts and
keeps visibility and security headers enforceable. Reference-safe deletion and
explicit broken states preserve user intent: storage damage or a delete request
must not silently rewrite the Campaign workspace or map.

## Consequences

### Positive

- Disguised, malformed, animated, and excessively large images are rejected.
- Upload memory and decode exposure are bounded.
- Managed paths remain private and relocatable.
- Archive never breaks an existing background or marker.
- Missing files degrade one visual resource rather than the whole Campaign.
- Permanent deletion reports exactly what the user must resolve.

### Negative / Tradeoffs

- Multer, `file-type`, and Sharp become server dependencies.
- Native Sharp installation and upgrades need environment validation.
- Import and deletion require careful cross-store cleanup.
- A 50 MiB or 100-megapixel map must be reduced before import.
- Broken Media cannot be repaired through a user workflow yet.

### Future implications

- A later repair operation must invalidate caches and atomically update all
  representation metadata.
- Milestone 9 must reconcile filesystem and PostgreSQL content during export,
  import, backup, and recovery.
- New media categories require their own verified MIME, size, preview, and
  content-disposition policies.
- Entry attachments add explicit dependency records rather than embedding file
  URLs.
- A future remote deployment may replace local byte serving while preserving
  the controlled endpoint contract.

## Validation

- Upload tests cover valid PNG, JPEG, and WebP files; false extensions; false
  client MIME types; malformed images; animation; unexpected fields; and missing
  files.
- Boundary tests cover 50 MiB encoded size and 100-megapixel decoded size.
- Cleanup tests prove rejected and failed imports do not leave temporary or
  committed orphan files.
- Delivery tests cover contextual visibility, MIME type, `nosniff`, safe
  disposition, ETag, conditional requests, and private caching.
- Archive tests prove references remain valid and active lists hide archived
  Media by default.
- Deletion tests return backgrounds and markers as blockers and never cascade
  them.
- Missing-file tests preserve metadata, return a stable error, show the neutral
  fallback, and leave the rest of the workspace usable.
