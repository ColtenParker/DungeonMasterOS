# Dungeon Master OS

Working title for a local-first Dungeon Master campaign management application.

## Project Goal

Create a map-centered DM workspace that combines flexible interconnected notes with structured campaign tools where structure provides real utility.

The MVP is designed for a single Dungeon Master and focuses on:

- Worlds and Campaigns
- interconnected Entries
- rich-text/Markdown notes
- contextual search
- a persistent map-centered Campaign workspace
- lightweight session utilities
- local data ownership and portability

## Development Approach

This project uses AI-assisted implementation while retaining human ownership of product and architecture decisions.

See:

- `docs/PRODUCT_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/AI_WORKFLOW.md`
- `docs/DECISION_LOG.md`
- `docs/architecture/`

## Milestone 1 World and Campaign Domain

The application now supports the top-level content hierarchy:

- create, list, open, edit, archive, and restore Worlds;
- create, list, open, edit, archive, and restore Campaigns within a World;
- active, archived, and combined browsing; and
- validated REST APIs backed by PostgreSQL.

World and Campaign names may be duplicated. Archive state is organizational,
and archiving a World does not rewrite the archive state of its Campaigns.
Game System modeling and permanent deletion remain deferred to their planned
design reviews.

See
[ADR-003](docs/architecture/ADR-003-world-and-campaign-domain.md) for the
identity, ownership, lifecycle, validation, and API decisions.

## Milestone 2 Universal Entry Foundation

Worlds and Campaigns now provide a shared notebook foundation with:

- NPC, Location, and Journal Entry categories;
- reusable World scope and isolated Campaign scope;
- inherited World Entries while browsing a Campaign;
- versioned, validated Tiptap/ProseMirror JSON documents;
- explicit rich-text editing and Save behavior; and
- active, archived, and category-filtered Entry browsing.

Entry scope is immutable in this milestone. Links, tags, search, media,
Markdown editing, specialized NPC fields, and Location hierarchy remain in
their planned later milestones. See
[ADR-004](docs/architecture/ADR-004-entry-identity-scope-and-specialization.md)
and
[ADR-005](docs/architecture/ADR-005-entry-document-persistence-and-editing.md)
for the domain and document decisions.

## Milestone 3 Knowledge Management

Entries now support:

- directed related-content links with optional context notes;
- combined backlinks from explicit relationships and inline document mentions;
- scope-safe inline Entry links and create-from-highlight editing;
- World-owned tags shared by the World's Campaigns;
- title, tag, and rich-document search through PostgreSQL full-text indexes;
- category, World, Campaign, and global search scopes; and
- keyboard-driven Quick Open with `Ctrl+K`.

Search defaults to active Entries and provides archived filtering. Campaign
search includes inherited World Entries, while World search remains limited to
World-scoped canon. Quick Open selects the current editor until Milestone 4
introduces the persistent floating-window workspace. See
[ADR-006](docs/architecture/ADR-006-entry-relationships-and-inline-references.md),
[ADR-007](docs/architecture/ADR-007-world-owned-entry-tags.md), and
[ADR-008](docs/architecture/ADR-008-postgresql-entry-search-and-quick-open.md).

## Milestone 4 Campaign Workspace

Each Campaign now opens into a persistent routed workspace with:

- free-form floating Entry windows over a neutral base layer;
- open-or-focus behavior shared by browsing, Quick Open, inline links,
  relationships, and backlinks;
- drag, resize, focus, minimize, restore, and close controls;
- PostgreSQL-backed geometry, z-order, and minimized-state restoration;
- duplicate prevention for Campaign and inherited World Entries; and
- Save, Discard, and Cancel protection for unsaved Entry drafts.

The workspace uses React Router, a Campaign-scoped reducer and context boundary,
and controlled `react-rnd` interactions. Pinning, persisted utility windows, and
selected map or Media backgrounds remain deferred. See
[ADR-009](docs/architecture/ADR-009-campaign-workspace-persistence.md),
[ADR-010](docs/architecture/ADR-010-campaign-workspace-client-architecture.md),
and
[ADR-011](docs/architecture/ADR-011-workspace-editing-accessibility-and-validation.md).

## Milestone 5 Media Library and Map Navigation

Worlds and Campaigns now provide reusable local raster Media with:

- PNG, JPEG, and WebP import with signature, decode, size, and pixel validation;
- managed originals, normalized display images, and library thumbnails;
- immutable World or Campaign scope with active and archived browsing;
- controlled byte delivery and reference-aware permanent deletion;
- persistent Campaign workspace image or map backgrounds;
- layered World and Campaign map markers using normalized coordinates; and
- marker navigation through the workspace's duplicate-safe Entry windows.

The workspace Media selector does not alter open Entry windows, and missing
managed files retain their metadata and references while the workspace falls
back to its neutral background. Generic Entry attachments, repair workflows,
non-raster media, pan/zoom, grids, tokens, and other VTT behavior remain
deferred. See
[ADR-012](docs/architecture/ADR-012-media-identity-scope-and-local-storage.md),
[ADR-013](docs/architecture/ADR-013-media-import-delivery-and-lifecycle.md), and
[ADR-014](docs/architecture/ADR-014-workspace-backgrounds-and-map-markers.md).

## Development Baseline

The repository is an npm workspace with:

- `apps/web`: React, Vite, strict TypeScript, Vitest, and React Testing Library
- `apps/api`: Express, strict TypeScript, Prisma, Vitest, and Supertest
- PostgreSQL 17 through Docker Compose by default

The browser calls relative `/api` URLs. During development, Vite proxies those
requests to the Express API at `http://localhost:3000`. The API uses Prisma and
the `DATABASE_URL` environment variable to connect to PostgreSQL.
Imported Media is copied beneath the configurable `MEDIA_ROOT`; the default
`.data/media` directory is ignored by Git. Backups must eventually include both
PostgreSQL and this managed directory.

### Prerequisites

- Node.js 24 or newer
- npm
- Docker Desktop with Docker Compose, or a compatible local PostgreSQL server

### Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL: `docker compose up -d postgres`
4. Wait for `docker compose ps postgres` to report `healthy`.
5. Generate Prisma Client: `npm run db:generate`
6. Run the migration workflow: `npm run db:migrate`
7. Start both applications: `npm run dev`
8. Open `http://localhost:5173`.

The Prisma schema and migrations include the reviewed Milestone 1 World and
Campaign domain.

To use an existing PostgreSQL server, skip the Compose command and set
`DATABASE_URL` in `.env` to its connection URL.

If port 5432 is already occupied, set `POSTGRES_PORT` in the ignored `.env` and
use the same port in both database URLs. For example:

```dotenv
POSTGRES_PORT=5433
DATABASE_URL=postgresql://dmos:dmos@localhost:5433/dmos?schema=public
TEST_DATABASE_URL=postgresql://dmos:dmos@localhost:5433/dmos_test?schema=public
```

The Compose credentials are local-development defaults, not production
credentials. PostgreSQL reads them only when initializing a new volume. If the
values are changed later, update the database role explicitly or deliberately
recreate the development volume. Merely recreating the container does not reset
credentials or stored data.

On Windows installations where Docker is available only through WSL, run the
same Compose commands as `wsl docker compose ...` from the repository directory.

### Health endpoints

- `GET /api/health/live` confirms the API process is responding and never
  queries PostgreSQL.
- `GET /api/health/ready` confirms PostgreSQL is reachable. Failures return a
  sanitized `503` response without database details.

### Commands

- `npm run dev`: run the API and web development servers together
- `npm run build`: build both applications
- `npm run test`: run all unit and request-level tests
- `npm run test:integration`: test Express and Prisma against the dedicated test database
- `npm run test:e2e`: run the Campaign workspace browser tests against the dedicated test database
- `npm run test:e2e:install --workspace @dmos/web`: install the Chromium browser used by Playwright
- `npm run typecheck`: type-check both applications
- `npm run lint`: lint the repository
- `npm run format`: format the repository
- `npm run format:check`: check formatting without changing files
- `npm run db:generate`: generate Prisma Client
- `npm run db:migrate`: run Prisma's development migration workflow

### Test database safety

Database integration tests must use `TEST_DATABASE_URL`, shown in
`.env.test.example`, and must never reset the normal development database. Set
`TEST_DATABASE_URL` in the ignored root `.env`, then run
`npm run test:integration`. The command rejects matching development and test
URLs, applies committed migrations only to the test database, and runs database
test files serially so their cleanup cannot race. The Compose setup creates
`dmos_test` only when it initializes a new volume. Unit tests isolate readiness
behind a database-health interface; integration tests exercise Express and
Prisma against PostgreSQL. Playwright uses the same dedicated test database,
applies committed migrations, and refuses to start when the development and
test database URLs match.
