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

## Milestone 0 Development Baseline

The repository is an npm workspace with:

- `apps/web`: React, Vite, strict TypeScript, Vitest, and React Testing Library
- `apps/api`: Express, strict TypeScript, Prisma, Vitest, and Supertest
- PostgreSQL 17 through Docker Compose by default

The browser calls relative `/api` URLs. During development, Vite proxies those
requests to the Express API at `http://localhost:3000`. The API uses Prisma and
the `DATABASE_URL` environment variable to connect to PostgreSQL.

### Prerequisites

- Node.js 24 or newer
- npm
- Docker Desktop with Docker Compose, or a compatible local PostgreSQL server

### Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL: `docker compose up -d postgres`
4. Generate Prisma Client: `npm run db:generate`
5. Run the migration workflow: `npm run db:migrate`
6. Start both applications: `npm run dev`
7. Open `http://localhost:5173` and select **Check full stack**.

The Prisma schema intentionally contains no product-domain tables. Those begin
only after their milestone-specific design reviews.

To use an existing PostgreSQL server, skip the Compose command and set
`DATABASE_URL` in `.env` to its connection URL.

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
- `npm run typecheck`: type-check both applications
- `npm run lint`: lint the repository
- `npm run format`: format the repository
- `npm run format:check`: check formatting without changing files
- `npm run db:generate`: generate Prisma Client
- `npm run db:migrate`: run Prisma's development migration workflow

### Test database safety

Database integration tests must use `TEST_DATABASE_URL`, shown in
`.env.test.example`, and must never reset the normal development database. The
Set `TEST_DATABASE_URL` before running `npm run test:integration`. The Compose
setup creates `dmos_test` automatically on first initialization. Unit tests
isolate the readiness route behind a database-health interface; the integration
test and browser check exercise the real PostgreSQL connection.
